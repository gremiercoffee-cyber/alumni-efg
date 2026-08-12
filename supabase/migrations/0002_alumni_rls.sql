-- Row level security for the alumni database.
--
-- The shape, in one line: everyone signed in can read everything; almost nobody
-- can write anything.
--
-- Reading is deliberately not partitioned. A rebbe sees every alumnus, and his
-- personal "my guys" list is a filter over staff_connections, not a permission
-- boundary. Partitioning reads would have made the app worse and the policies
-- harder to reason about.
--
-- Writing is where the roles bite. An admin is the only one who can change an
-- alumnus's record or cause anything to be sent. Everyone else proposes, via
-- claims. The one exception is a rebbe marking who he is close with, which is
-- his own data and needs no approval.

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- The staff row behind the current login, if this user is one of the rabbis.
create or replace function current_staff_id() returns integer
language sql stable security definer set search_path = public as $$
  select staff_id from profiles where id = auth.uid();
$$;

-- Both of these read `profiles`, and both are used inside policies ON profiles.
-- They must be security definer: an inline subquery against profiles from within
-- a profiles policy re-enters that same policy and recurses.
create or replace function my_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
alter table profiles            enable row level security;
alter table staff               enable row level security;
alter table push_tokens         enable row level security;
alter table people              enable row level security;
alter table person_aliases      enable row level security;
alter table enrollments         enable row level security;
alter table family_contacts     enable row level security;
alter table staff_connections   enable row level security;
alter table events              enable row level security;
alter table event_attendance    enable row level security;
alter table visits              enable row level security;
alter table interactions        enable row level security;
alter table simchas             enable row level security;
alter table claims              enable row level security;
alter table claim_reports       enable row level security;
alter table notification_outbox enable row level security;

-- ---------------------------------------------------------------------------
-- read: everything, to anyone signed in
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'staff', 'people', 'person_aliases', 'enrollments', 'family_contacts',
    'staff_connections', 'events', 'event_attendance', 'visits', 'interactions',
    'simchas', 'claims', 'claim_reports'
  ] loop
    execute format(
      'create policy %I on %I for select to authenticated using (true)',
      t || '_read', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- write: admin only, for everything that is the record of truth
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'staff', 'people', 'person_aliases', 'enrollments', 'family_contacts',
    'events', 'event_attendance', 'simchas'
  ] loop
    execute format(
      'create policy %I on %I for all to authenticated using (is_admin()) with check (is_admin())',
      t || '_admin_write', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- profiles: you see and edit your own; an admin sees and assigns roles
-- ---------------------------------------------------------------------------

create policy profiles_read_self on profiles
  for select to authenticated using (id = auth.uid() or is_admin());

-- Deliberately not "for all": a user updating his own row must not be able to
-- promote himself. Role and staff_id changes go through an admin.
create policy profiles_update_self on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = my_role()
    and staff_id is not distinct from current_staff_id()
  );

create policy profiles_admin_write on profiles
  for all to authenticated using (is_admin()) with check (is_admin());

create policy push_tokens_own on push_tokens
  for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- staff_connections: a rebbe curates his own list directly, no review
-- ---------------------------------------------------------------------------

create policy staff_connections_own on staff_connections
  for all to authenticated
  using (staff_id = current_staff_id() or is_admin())
  with check (staff_id = current_staff_id() or is_admin());

-- ---------------------------------------------------------------------------
-- visits and interactions: any signed-in user may record that something happened
--
-- These are observations, not changes to the alumnus's record, and nothing is
-- sent as a result. Letting a rebbe log "he stayed over last Shabbos" without
-- waiting for approval is the point. Editing or deleting someone else's entry
-- is still admin-only.
-- ---------------------------------------------------------------------------

create policy visits_insert on visits
  for insert to authenticated with check (recorded_by = auth.uid() or is_admin());
create policy visits_modify_own on visits
  for update to authenticated using (recorded_by = auth.uid() or is_admin());
create policy visits_delete_admin on visits
  for delete to authenticated using (is_admin());

create policy interactions_insert on interactions
  for insert to authenticated with check (recorded_by = auth.uid() or is_admin());
create policy interactions_modify_own on interactions
  for update to authenticated using (recorded_by = auth.uid() or is_admin());
create policy interactions_delete_admin on interactions
  for delete to authenticated using (is_admin());

-- ---------------------------------------------------------------------------
-- claims: anyone may propose, only an admin may rule on it
-- ---------------------------------------------------------------------------

-- A non-admin creating a claim must leave it pending. Without this check a
-- user could insert a row already marked 'approved'.
create policy claims_propose on claims
  for insert to authenticated
  with check (is_admin() or (status = 'pending' and reviewed_by is null));

create policy claims_review on claims
  for update to authenticated using (is_admin()) with check (is_admin());

create policy claims_delete_admin on claims
  for delete to authenticated using (is_admin());

create policy claim_reports_insert on claim_reports
  for insert to authenticated
  with check (reported_by = auth.uid() or is_admin());

create policy claim_reports_delete_admin on claim_reports
  for delete to authenticated using (is_admin());

-- ---------------------------------------------------------------------------
-- outbox: nobody. the service role bypasses RLS and is the only writer.
--
-- No policy is created, so with RLS enabled every ordinary client is denied.
-- This is what stops a non-admin from causing a Mazel Tov blast to go out.
-- Admins read the queue through an Edge Function, not directly.
-- ---------------------------------------------------------------------------
