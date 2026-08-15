-- Reminders that go out on their own: a week before a wedding, the day of it,
-- and birthdays. Plus somewhere to put a birthday, because nothing in either
-- old workbook recorded one.
--
-- Every switch here defaults to off. The queue fills, the digests build, and
-- nothing is delivered until each is deliberately turned on.

-- ---------------------------------------------------------------------------
-- where announcements go, and what is allowed to go out
-- ---------------------------------------------------------------------------

alter table app_settings
  -- The rebbeim list. One address that fans out on their side, so the app never
  -- holds a list of individual staff addresses that has to be kept in step.
  add column if not exists list_email text,
  -- Separate switches. Weddings are wanted now; birthdays are built but wait.
  add column if not exists wedding_emails_enabled boolean not null default false,
  add column if not exists birthday_emails_enabled boolean not null default false,
  add column if not exists push_enabled boolean not null default false;

comment on column app_settings.list_email is
  'The address every announcement is sent to. Empty means nothing goes out, '
  'whatever the switches say.';

-- ---------------------------------------------------------------------------
-- birthdays
-- ---------------------------------------------------------------------------

alter table people add column if not exists birthday date;

comment on column people.birthday is
  'Date of birth. The year is kept because an age is worth knowing, but nothing '
  'displays it -- only the day and month are ever shown or matched on.';

-- Editable by anyone who can propose an edit. A rebbe who knows a man''s
-- birthday is exactly who this should come from.
create or replace function editable_person_fields() returns text[]
language sql immutable as $$
  select array[
    'first_name', 'last_name', 'nickname', 'email', 'phone',
    'street_address', 'city', 'state', 'zip_code', 'country',
    'high_school', 'college', 'grad_school', 'occupation',
    'marital_status', 'spouse_name', 'notes', 'birthday'
  ];
$$;

-- Whose birthday falls in the next 30 days, in the order they arrive.
--
-- Matched on month and day only, so it works across a year boundary without
-- special-casing December. 29 February is treated as 28 February in a common
-- year rather than being skipped for three years out of four.
create or replace view upcoming_birthdays as
  with b as (
    select p.id as person_id,
           p.first_name || ' ' || p.last_name as name,
           p.email,
           p.phone,
           p.birthday,
           case
             when extract(month from p.birthday) = 2
              and extract(day from p.birthday) = 29
              and not (extract(year from current_date)::int % 4 = 0
                       and (extract(year from current_date)::int % 100 <> 0
                            or extract(year from current_date)::int % 400 = 0))
             then make_date(extract(year from current_date)::int, 2, 28)
             else make_date(extract(year from current_date)::int,
                            extract(month from p.birthday)::int,
                            extract(day from p.birthday)::int)
           end as this_year
      from people p
     where p.birthday is not null
       and not p.do_not_contact
  )
  select person_id,
         name,
         email,
         phone,
         birthday,
         case when this_year < current_date
              then this_year + interval '1 year' else this_year end::date as next_on,
         extract(year from age(
           case when this_year < current_date
                then this_year + interval '1 year' else this_year end,
           birthday))::int as turning
    from b
   where (case when this_year < current_date
               then this_year + interval '1 year' else this_year end)::date
         <= current_date + 30;

alter view upcoming_birthdays set (security_invoker = on);
grant select on upcoming_birthdays to authenticated;

-- ---------------------------------------------------------------------------
-- what is due today
-- ---------------------------------------------------------------------------

-- Fills the outbox with anything owed today, and is safe to run repeatedly:
-- the outbox's unique (kind, subject_table, subject_id) makes a second run in
-- the same day a no-op. That matters more than it sounds -- a retry after a
-- failure must not send a second Mazal Tov.
--
-- Birthdays are keyed on the person and the year, so the same man generates one
-- row a year rather than one ever.
create or replace function queue_due_notifications()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer := 0;
  added integer;
begin
  -- A week out. The point of this one is the people who need notice: a flight,
  -- a present, a day off.
  insert into notification_outbox (kind, subject_table, subject_id, person_id, payload)
  select 'wedding_week_before', 'simchas', s.id, s.person_id,
         jsonb_build_object('on', s.occurred_on)
    from simchas s
   where s.type in ('wedding', 'child_wedding')
     and s.occurred_on = current_date + 7
  on conflict do nothing;
  get diagnostics added = row_count; n := n + added;

  insert into notification_outbox (kind, subject_table, subject_id, person_id, payload)
  select 'wedding_today', 'simchas', s.id, s.person_id,
         jsonb_build_object('on', s.occurred_on)
    from simchas s
   where s.type in ('wedding', 'child_wedding')
     and s.occurred_on = current_date
  on conflict do nothing;
  get diagnostics added = row_count; n := n + added;

  -- Birthdays. subject_id carries the year so it repeats annually and not more.
  insert into notification_outbox (kind, subject_table, subject_id, person_id, payload)
  select 'birthday_today', 'people',
         b.person_id * 10000 + extract(year from current_date)::int,
         b.person_id,
         jsonb_build_object('name', b.name, 'turning', b.turning)
    from upcoming_birthdays b
   where b.next_on = current_date
  on conflict do nothing;
  get diagnostics added = row_count; n := n + added;

  return n;
end $$;

revoke all on function queue_due_notifications() from public;
grant execute on function queue_due_notifications() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- push
-- ---------------------------------------------------------------------------

-- A device belongs to whoever registered it, and nobody else may read the
-- token: it is the address of a person's phone.
alter table push_tokens enable row level security;

drop policy if exists push_own on push_tokens;
create policy push_own on push_tokens
  for all to authenticated
  using (profile_id = auth.uid() or is_admin())
  with check (profile_id = auth.uid());

-- Re-registering the same device must not pile up rows. A token is unique
-- already; this makes the upsert land on it.
create unique index if not exists push_tokens_token_idx on push_tokens (token);
