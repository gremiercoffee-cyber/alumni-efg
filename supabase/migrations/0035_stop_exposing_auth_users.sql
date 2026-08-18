-- Stop serving auth.users through the API.
--
-- pending_users joined auth.users to show the admin who had signed up and what
-- their address was. It was guarded -- is_admin() in the WHERE, and a definer
-- view so ordinary roles could read the join at all -- but it still put a table
-- Supabase owns onto the public API surface, one WHERE clause away from being
-- everyone's email address. Supabase's own linter flags it, and it is right:
-- the guard is correct today and is the sort of thing that stops being correct
-- during some later edit.
--
-- The fix is to not need the join. An email is copied onto the profile when the
-- account is made, and the view reads only public tables.

alter table profiles add column if not exists email text;

comment on column profiles.email is
  'Copied from auth.users at signup. Held here so nothing has to read auth.users '
  'through the API -- profiles has RLS of its own and is meant to be read.';

-- Everyone who already exists.
update profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id
   and p.email is distinct from u.email;

-- And everyone who arrives from now on. Same trigger that already creates the
-- profile, so there is no second thing to keep in step.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  is_admin_email boolean := lower(new.email) = any (admin_emails());
begin
  insert into profiles (id, role, staff_id, display_name, email)
  values (
    new.id,
    case when is_admin_email then 'admin'::user_role else 'viewer'::user_role end,
    case when is_admin_email then (select id from staff where name = 'Rabbi Grey') end,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

-- Rebuilt on public tables only, and running as the caller rather than the
-- owner -- so the profiles policies decide who sees what, which is where that
-- decision belongs. An admin reads every row; nobody else reads anyone's but
-- their own, and a non-admin gets an empty list rather than a refusal.
drop view if exists pending_users;

create view pending_users as
  select p.id,
         p.email,
         p.display_name,
         p.created_at as signed_up_at,
         p.claimed_staff_id,
         s.name as claimed_staff_name
    from profiles p
    left join staff s on s.id = p.claimed_staff_id
   where p.role = 'pending';

alter view pending_users set (security_invoker = on);
grant select on pending_users to authenticated;

-- While here: rebbe_alumni carries staff email addresses and is only ever read
-- by the weekly digest, which runs as the service role. It has no business
-- being readable by every signed-in user.
revoke all on rebbe_alumni from anon, authenticated;
