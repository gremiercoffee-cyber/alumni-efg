-- Signing up when you are not on the list.
--
-- The staff list came off workbooks written before this app existed, so it is a
-- snapshot of who was teaching then. A rebbe who has joined since has nothing to
-- claim, and the sign-up screen tells him to ask the admin -- which means the
-- admin adding a row by hand, in a dashboard, before the man can do anything.
--
-- So he can say who he is in his own words. It is still only a claim: no staff
-- record is created until the admin approves him, or anyone with a Google
-- account could add rebbeim to the yeshiva's staff list.

alter table profiles add column if not exists claimed_staff_name text;

comment on column profiles.claimed_staff_name is
  'What someone calls himself when he is not on the staff list. A claim, not a '
  'record -- approving is what creates the staff row.';

-- Claim a name that does not exist yet. Same rules as claiming an existing one:
-- your own profile, and only while you are still waiting.
create or replace function claim_new_staff(p_name text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'a name is needed';
  end if;

  update profiles
     set claimed_staff_name = trim(p_name),
         claimed_staff_id = null
   where id = auth.uid()
     and role = 'pending';

  if not found then
    raise exception 'your account has already been decided; ask the admin';
  end if;
end $$;

grant execute on function claim_new_staff(text) to authenticated;

-- The admin sees what he wrote.
create or replace view pending_users as
  select p.id,
         p.email,
         p.display_name,
         p.created_at as signed_up_at,
         p.claimed_staff_id,
         s.name as claimed_staff_name,
         p.claimed_staff_name as proposed_staff_name
    from profiles p
    left join staff s on s.id = p.claimed_staff_id
   where p.role = 'pending';

alter view pending_users set (security_invoker = on);
grant select on pending_users to authenticated;

-- Approving, with the option of creating the staff record as part of it.
--
-- Dropped and recreated rather than overloaded: two versions differing only by
-- a defaulted argument make a three-argument call ambiguous, and PostgREST
-- calls these by name.
drop function if exists set_user_role(uuid, user_role, integer);
drop function if exists set_user_role(uuid, user_role);

create or replace function set_user_role(
  p_user uuid,
  p_role user_role,
  p_staff_id integer default null,
  p_new_staff_name text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  target_staff integer := p_staff_id;
  proposed     text;
  surname_part text;
begin
  if not is_admin() then
    raise exception 'only an admin can change roles';
  end if;
  if p_role = 'admin' then
    raise exception 'admin cannot be granted from the app';
  end if;

  select coalesce(nullif(trim(p_new_staff_name), ''), claimed_staff_name)
    into proposed
    from profiles where id = p_user;

  -- Make the staff record, if he asked for one and is not already matched.
  if target_staff is null and proposed is not null then
    -- Reuse rather than duplicate: names are unique, and someone typing a name
    -- that already exists means he is that person, not a second one.
    select id into target_staff from staff where lower(name) = lower(proposed);

    if target_staff is null then
      -- surname is NOT NULL and is what the staff list sorts by. The last word
      -- of the name is right far more often than it is wrong, and the admin can
      -- correct it afterwards.
      surname_part := nullif(regexp_replace(proposed, '^.*\s', ''), '');
      insert into staff (name, surname, active)
      values (proposed, coalesce(surname_part, proposed), true)
      returning id into target_staff;
    end if;
  end if;

  update profiles
     set role = p_role,
         staff_id = coalesce(target_staff, staff_id, claimed_staff_id)
   where id = p_user;
end $$;

revoke all on function set_user_role(uuid, user_role, integer, text) from public;
grant execute on function set_user_role(uuid, user_role, integer, text) to authenticated;
