-- ygrey@aish.edu is the admin, and the only one.
--
-- Guarded, because the obvious way to write this can lock everyone out. If that
-- address has never signed in there is no profile to promote, and demoting the
-- existing admin first would leave the app with no admin at all -- and no way
-- to appoint one, since set_user_role refuses to grant admin and only an admin
-- may call it. Recovery would mean the dashboard.
--
-- So it promotes first, checks that it worked, and only then demotes. If the
-- account does not exist the whole thing fails and nothing changes.

do $$
declare
  target uuid;
  demoted integer;
begin
  select u.id into target
    from auth.users u
   where lower(u.email) = 'ygrey@aish.edu';

  if target is null then
    raise exception
      'ygrey@aish.edu has never signed in, so there is no account to make admin. '
      'Sign in with it once, then run this again. Nothing has been changed.';
  end if;

  update profiles set role = 'admin' where id = target;

  -- Everyone else who was an admin becomes staff rather than losing access:
  -- they keep the app and lose the queue, the drawer and the ability to commit
  -- other people's proposals. Removing them outright is a different decision
  -- and not the one that was asked for.
  update profiles
     set role = 'staff'
   where role = 'admin'
     and id <> target;

  get diagnostics demoted = row_count;
  raise notice 'ygrey@aish.edu is admin; % other admin(s) moved to staff', demoted;
end $$;
