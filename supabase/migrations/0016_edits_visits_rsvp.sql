-- Three things: proposed edits to an alumnus, visits to the yeshiva on the
-- feed, and RSVPs to an event.

-- ---------------------------------------------------------------------------
-- proposed edits
-- ---------------------------------------------------------------------------

-- Anyone may propose a correction; only an admin commits it. Same shape as
-- claims, and for the same reason -- an alumnus's record is the thing everything
-- else hangs off, so it does not change because somebody typed in a box.
--
-- One row per field rather than per form: a rebbe who fixes a phone number and
-- guesses at an occupation should have the phone accepted and the guess
-- refused, without an all-or-nothing decision.
create table person_edits (
  id            bigserial primary key,
  person_id     integer not null references people on delete cascade,
  field         text not null,
  old_value     text,
  new_value     text,
  status        claim_status not null default 'pending',
  submitted_by  uuid references profiles on delete set null,
  reviewed_by   uuid references profiles on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index on person_edits (status, created_at desc);
create index on person_edits (person_id);

-- Which columns may be proposed. Deliberately not everything: ids, flags that
-- carry consequences (do_not_contact, spotlight) and anything the migration
-- owns stay admin-only, so a proposal cannot quietly turn outreach back on for
-- a man who asked not to be contacted.
create or replace function editable_person_fields() returns text[]
language sql immutable as $$
  select array[
    'first_name', 'last_name', 'nickname', 'email', 'phone',
    'street_address', 'city', 'state', 'zip_code', 'country',
    'high_school', 'college', 'grad_school', 'occupation',
    'marital_status', 'spouse_name', 'notes'
  ];
$$;

alter table person_edits enable row level security;

create policy edits_read on person_edits
  for select to authenticated using (is_approved());

create policy edits_propose on person_edits
  for insert to authenticated
  with check (
    is_approved()
    and field = any (editable_person_fields())
    and (is_admin() or (status = 'pending' and submitted_by = auth.uid()))
  );

create policy edits_review on person_edits
  for update to authenticated using (is_admin()) with check (is_admin());

create policy edits_delete on person_edits
  for delete to authenticated using (is_admin());

-- Tell the admin an edit is waiting. One notification per person per field, so
-- three rebbeim correcting the same wrong phone number is one nudge.
create or replace function edit_notify_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notification_outbox (kind, subject_table, subject_id, person_id, payload)
  values ('edit_proposed', 'person_edits', new.id, new.person_id,
          jsonb_build_object('field', new.field, 'new_value', new.new_value))
  on conflict do nothing;
  return new;
end $$;

create trigger person_edits_notify after insert on person_edits
  for each row when (new.status = 'pending') execute function edit_notify_admin();

-- Apply an approved edit. In SQL rather than the client so the allowed-field
-- list is enforced in one place, and a client cannot name a column it likes.
create or replace function apply_person_edit(p_edit_id bigint, p_approve boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  e person_edits%rowtype;
begin
  if not is_admin() then
    raise exception 'only an admin can review edits';
  end if;

  select * into e from person_edits where id = p_edit_id;
  if not found then
    raise exception 'no such edit';
  end if;

  if p_approve then
    if not (e.field = any (editable_person_fields())) then
      raise exception 'field % is not editable', e.field;
    end if;
    execute format('update people set %I = $1, updated_at = now() where id = $2', e.field)
      using nullif(e.new_value, ''), e.person_id;
  end if;

  update person_edits
     set status = case when p_approve then 'approved' else 'rejected' end::claim_status,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_edit_id;
end $$;

revoke all on function apply_person_edit(bigint, boolean) from public;
grant execute on function apply_person_edit(bigint, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- visits to the yeshiva
-- ---------------------------------------------------------------------------

-- A visit can be in the future -- "he is coming next Tuesday" is the useful
-- case, not just the record of one that happened.
alter table visits
  add column if not exists expected boolean not null default false;

comment on column visits.expected is
  'True while the visit is still planned. The distinction matters: "coming" and '
  '"came" are different facts, and only the second is evidence of anything.';

-- ---------------------------------------------------------------------------
-- RSVPs
-- ---------------------------------------------------------------------------

-- A shareable link per event. The token is the whole credential, so it is
-- random and long; anyone holding it can RSVP but can read nothing else.
alter table events
  add column if not exists rsvp_token text unique default encode(gen_random_bytes(16), 'hex'),
  add column if not exists rsvp_open boolean not null default true;

update events set rsvp_token = encode(gen_random_bytes(16), 'hex') where rsvp_token is null;

alter table event_attendance
  add column if not exists rsvped_at timestamptz,
  add column if not exists source text not null default 'admin'
    check (source in ('admin', 'rsvp', 'import')),
  add column if not exists guests integer not null default 0;
