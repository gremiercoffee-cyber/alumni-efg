-- A rebbe who signs in has told us his address. Use it.
--
-- Not one staff record has an email on it -- neither old workbook carried them
-- -- so the weekly five was built for thirty rebbeim and addressed to nobody.
-- Meanwhile every rebbe who signs in hands over a working address as a side
-- effect of signing in, and it was being thrown away.
--
-- Only fills a blank. An address typed deliberately onto a staff record is
-- someone's decision and outranks whatever Google happened to authenticate
-- with -- a man may sign in with a personal account and want yeshiva mail
-- elsewhere.

create or replace function staff_email_from_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.staff_id is not null and new.email is not null then
    update staff
       set email = new.email
     where id = new.staff_id
       and (email is null or email = '');
  end if;
  return new;
end $$;

drop trigger if exists profiles_fill_staff_email on profiles;
create trigger profiles_fill_staff_email
  after insert or update of staff_id, email on profiles
  for each row execute function staff_email_from_profile();

-- Everyone who has already signed in and been linked.
update staff s
   set email = p.email
  from profiles p
 where p.staff_id = s.id
   and p.email is not null
   and (s.email is null or s.email = '');
