-- New users must land as 'pending', not 'viewer'.
--
-- 0012 set this correctly. 0035, adding the email column, rewrote
-- handle_new_user and copied the old 'viewer' default back in by mistake -- so
-- since then every sign-in has been an approved viewer that skips the "which
-- rebbe are you" screen entirely (it only shows for 'pending'). A rebbe gets
-- into the app but can never say who he is or pick his alumni.
--
-- 'viewer' is also in is_approved(), which is why they got in at all rather than
-- hitting a wall -- the failure was silent.

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  is_admin_email boolean := lower(new.email) = any (admin_emails());
begin
  insert into profiles (id, role, staff_id, display_name, email)
  values (
    new.id,
    case when is_admin_email then 'admin'::user_role else 'pending'::user_role end,
    case when is_admin_email then (select id from staff where name = 'Rabbi Grey') end,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

-- Rescue the ones already stuck as viewer: move them to pending so the app asks
-- them who they are on next open. The admin's own accounts stay as they are --
-- he does not need to claim a rebbe.
update profiles
   set role = 'pending'
 where role = 'viewer'
   and lower(email) <> all (admin_emails());
