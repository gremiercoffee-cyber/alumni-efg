-- Split from 0011: Postgres will not let a transaction use an enum value that
-- the same transaction added.

-- New accounts land here and can see nothing until an admin promotes them.
alter table profiles alter column role set default 'pending';

-- Anyone already in the system keeps their access; this is only about who
-- arrives from now on.

create or replace function is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
     where id = auth.uid()
       and role in ('admin', 'staff', 'viewer')
  );
$$;

-- Rewrite every read policy to require approval rather than merely a session.
do $$
declare t text;
begin
  foreach t in array array[
    'staff', 'people', 'person_aliases', 'enrollments', 'family_contacts',
    'staff_connections', 'events', 'event_attendance', 'visits', 'interactions',
    'simchas', 'claims', 'claim_reports'
  ] loop
    execute format('drop policy if exists %I on %I', t || '_read', t);
    execute format(
      'create policy %I on %I for select to authenticated using (is_approved())',
      t || '_read', t);
  end loop;
end $$;

create policy recipients_read_approved on notification_recipients
  for select to authenticated using (is_approved());
drop policy if exists recipients_read on notification_recipients;

-- Writes were already gated on is_admin() or on owning the row, so they need no
-- change: a pending user owns nothing and is not an admin.

-- Bring the signup trigger in line. An address on the admin list still becomes
-- an admin -- that is what lets the first account exist at all.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  is_admin_email boolean := lower(new.email) = any (admin_emails());
begin
  insert into profiles (id, role, staff_id, display_name)
  values (
    new.id,
    case when is_admin_email then 'admin'::user_role else 'pending'::user_role end,
    case when is_admin_email then (select id from staff where name = 'Rabbi Grey') end,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- So the admin can see who is waiting, and promote them.
--
-- Deliberately NOT security_invoker: it reads auth.users, which ordinary roles
-- cannot. It runs as owner instead, and the is_admin() guard inside the view is
-- what stops a non-admin reading it -- a pending user asking this view what it
-- knows gets nothing back.
create or replace view pending_users as
  select p.id,
         u.email,
         p.display_name,
         u.created_at as signed_up_at,
         u.raw_user_meta_data ->> 'avatar_url' as avatar_url
    from profiles p
    join auth.users u on u.id = p.id
   where p.role = 'pending'
     and is_admin();

grant select on pending_users to authenticated;

-- Promote or refuse someone waiting. Admin-only, and it refuses to hand out the
-- admin role -- that stays a deliberate act in the dashboard.
create or replace function set_user_role(p_user uuid, p_role user_role)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin can change roles';
  end if;
  if p_role = 'admin' then
    raise exception 'admin cannot be granted from the app';
  end if;
  update profiles set role = p_role where id = p_user;
end $$;

revoke all on function set_user_role(uuid, user_role) from public;
grant execute on function set_user_role(uuid, user_role) to authenticated;
