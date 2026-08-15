-- Four things: a switch that keeps email off, saying which rebbe you are, the
-- weekly five, and a rotation that does not repeat.

-- ---------------------------------------------------------------------------
-- the switch
-- ---------------------------------------------------------------------------

-- Everything below can be built, queued and inspected with nothing leaving the
-- building. The sender refuses to send while this is false, so the wiring can
-- be finished and watched before a single alumnus or rebbe is emailed.
--
-- Deliberately a row in the database rather than an environment variable: it
-- can be turned off from a phone, in a second, without a deploy -- which is the
-- only thing that matters when something is going out wrongly.
create table if not exists app_settings (
  id            boolean primary key default true check (id),
  emails_enabled boolean not null default false,
  -- Where the weekly digest goes while it is being tested: set this and every
  -- digest goes here instead of to the rebbeim, however many are queued.
  redirect_all_to text,
  from_name      text not null default 'EFG@Aish Alumni',
  from_email     text not null default 'ygrey@aish.edu',
  updated_at     timestamptz not null default now()
);

insert into app_settings (id) values (true) on conflict do nothing;

alter table app_settings enable row level security;

create policy settings_read on app_settings
  for select to authenticated using (is_approved());
create policy settings_write on app_settings
  for update to authenticated using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- which rebbe are you
-- ---------------------------------------------------------------------------

-- An email address does not say who someone is. rabbimiller@gmail.com might be
-- Rabbi Miller and might be his son, and the whole app hangs off knowing which
-- rebbe a login belongs to -- his alumni, his weekly five, the contact history.
--
-- So a new user picks himself off the list, and the admin confirms it when he
-- lets him in. Held apart from profiles.staff_id until then: a claim is what
-- someone says about himself, and staff_id is what the admin has agreed.
alter table profiles
  add column if not exists claimed_staff_id integer references staff on delete set null;

comment on column profiles.claimed_staff_id is
  'Who this person says he is. profiles.staff_id is who the admin agrees he is; '
  'nothing reads this except the approval screen.';

-- The list to pick from. Names only -- no emails or phone numbers, because
-- anyone with a Google account can reach this before being approved.
create or replace view staff_choices as
  select id, name, title from staff where active order by surname;

alter view staff_choices set (security_invoker = off);
grant select on staff_choices to authenticated;

-- Claim a name. Yours only, and only while you are still waiting: once the
-- admin has decided, changing who you are is his call.
create or replace function claim_staff(p_staff_id integer)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  update profiles
     set claimed_staff_id = p_staff_id
   where id = auth.uid()
     and role = 'pending';
  if not found then
    raise exception 'your account has already been decided; ask the admin';
  end if;
end $$;

grant execute on function claim_staff(integer) to authenticated;

-- Show the admin what they claimed, so approving is one decision and not a
-- guessing game about who just signed up.
create or replace view pending_users as
  select p.id,
         u.email,
         p.display_name,
         u.created_at as signed_up_at,
         u.raw_user_meta_data ->> 'avatar_url' as avatar_url,
         p.claimed_staff_id,
         s.name as claimed_staff_name
    from profiles p
    join auth.users u on u.id = p.id
    left join staff s on s.id = p.claimed_staff_id
   where p.role = 'pending'
     and is_admin();

grant select on pending_users to authenticated;

-- Approving now also attaches him to the rebbe he said he was. Same function,
-- one more argument, so the screen cannot approve someone and forget to link
-- him -- which would leave a rebbe signed in with no alumni and no digest.
create or replace function set_user_role(p_user uuid, p_role user_role, p_staff_id integer default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin can change roles';
  end if;
  if p_role = 'admin' then
    raise exception 'admin cannot be granted from the app';
  end if;
  update profiles
     set role = p_role,
         staff_id = coalesce(p_staff_id, staff_id, claimed_staff_id)
   where id = p_user;
end $$;

-- ---------------------------------------------------------------------------
-- the weekly five
-- ---------------------------------------------------------------------------

-- Who a rebbe is responsible for: the men he has said he is close with, and the
-- men whose programme rebbe he was. Both, because the two disagree for 208 men
-- and each is a real relationship.
create or replace view rebbe_alumni as
  select distinct s.id as staff_id, s.name as staff_name, s.email, p.id as person_id
    from staff s
    join (
      select staff_id, person_id from staff_connections
      union
      select e.rebbe_id, e.person_id from enrollments e where e.rebbe_id is not null
    ) link on link.staff_id = s.id
    join people p on p.id = link.person_id
   where s.active
     and not p.do_not_contact;

alter view rebbe_alumni set (security_invoker = off);
grant select on rebbe_alumni to authenticated;

-- What has been sent, and in which pass through the list.
--
-- The rule is "no repeats until the whole list is done", which needs memory:
-- without it, random five each week means some men come up three times before
-- others come up once. A cycle number is what makes "done" definable -- when
-- nobody is left unsent in the current cycle, the cycle advances and everyone
-- is eligible again.
create table if not exists digest_sent (
  id          bigserial primary key,
  staff_id    integer not null references staff on delete cascade,
  person_id   integer not null references people on delete cascade,
  cycle       integer not null,
  sent_on     date not null default current_date,
  unique (staff_id, person_id, cycle)
);

create index if not exists digest_sent_lookup on digest_sent (staff_id, cycle);

-- Pick this week's five for one rebbe, and record them.
--
-- Random within the cycle, so the order is genuinely unpredictable, but the set
-- is not: a man cannot come up twice until his rebbe has seen everyone. When
-- fewer than five are left the cycle closes and the remainder is topped up from
-- the new one, so a rebbe with 23 men gets 5, 5, 5, 5, then 3 + 2 rather than a
-- short week.
create or replace function pick_weekly_five(p_staff_id integer, p_count integer default 5)
returns table (person_id integer)
language plpgsql security definer set search_path = public as $$
declare
  cur   integer;
  ids   integer[];
  more  integer[];
begin
  select coalesce(max(cycle), 1) into cur from digest_sent where staff_id = p_staff_id;

  -- An array rather than a temp table: this is called once per rebbe in a loop,
  -- and a temp table would still exist from the previous rebbe.
  select coalesce(array_agg(a.person_id), '{}')
    into ids
    from (
      select a.person_id
        from rebbe_alumni a
       where a.staff_id = p_staff_id
         and not exists (
           select 1 from digest_sent d
            where d.staff_id = p_staff_id
              and d.person_id = a.person_id
              and d.cycle = cur
         )
       order by random()
       limit p_count
    ) a;

  -- The list ran out mid-week. Close the cycle and fill from the next one, so a
  -- rebbe with 23 men gets 5, 5, 5, 5, then 3 + 2 rather than a short week and
  -- the boundary is invisible to him.
  if array_length(ids, 1) is null or array_length(ids, 1) < p_count then
    cur := cur + 1;
    select coalesce(array_agg(a.person_id), '{}')
      into more
      from (
        select a.person_id
          from rebbe_alumni a
         where a.staff_id = p_staff_id
           and not (a.person_id = any (ids))
         order by random()
         limit p_count - coalesce(array_length(ids, 1), 0)
      ) a;
    ids := ids || more;
  end if;

  insert into digest_sent (staff_id, person_id, cycle)
  select p_staff_id, unnest(ids), cur
  on conflict do nothing;

  return query select unnest(ids);
end $$;

revoke all on function pick_weekly_five(integer, integer) from public;
grant execute on function pick_weekly_five(integer, integer) to authenticated, service_role;
