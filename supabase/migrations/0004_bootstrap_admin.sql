-- Give every new sign-in a profile, and make the alumni director an admin.
--
-- profiles.id references auth.users, so a profile cannot exist before its user
-- does. This trigger creates one the moment someone signs up, which means the
-- app never has to cope with a logged-in user who has no profile row.

-- Both addresses belong to the same person; whichever he signs in with, he is
-- the admin. Also matched against the `staff` row so his "my guys" list works.
create or replace function admin_emails() returns text[]
language sql immutable as $$
  select array['ygrey@aish.edu', 'ygrey@aish.com'];
$$;

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  is_admin_email boolean := lower(new.email) = any (admin_emails());
begin
  insert into profiles (id, role, staff_id, display_name)
  values (
    new.id,
    case when is_admin_email then 'admin'::user_role else 'viewer'::user_role end,
    case when is_admin_email then (select id from staff where name = 'Rabbi Grey') end,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Covers the case where the account already exists: sign in once before this
-- migration runs and the trigger would never have fired for you.
insert into profiles (id, role, staff_id, display_name)
select u.id, 'admin'::user_role, (select id from staff where name = 'Rabbi Grey'),
       coalesce(u.raw_user_meta_data ->> 'full_name', u.email)
  from auth.users u
 where lower(u.email) = any (admin_emails())
on conflict (id) do update
  set role = 'admin',
      staff_id = coalesce(profiles.staff_id, excluded.staff_id);
