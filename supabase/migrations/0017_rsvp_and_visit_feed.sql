-- Split from 0016: the feed view names 'visit', and the RSVP function reads
-- columns 0016 adds. Both need those to exist already.

-- ---------------------------------------------------------------------------
-- RSVP from a link, without an account
-- ---------------------------------------------------------------------------

-- What someone holding the link is allowed to see: the event, and nothing else.
-- Not the guest list -- an RSVP link is public, and who else is coming is not
-- the link-holder's business.
create or replace function rsvp_event(p_token text)
returns table (event_name text, starts_on date, location text, description text)
language sql security definer stable set search_path = public as $$
  select e.name, e.starts_on, e.location, e.description
    from events e
   where e.rsvp_token = p_token and e.rsvp_open;
$$;

-- Record an RSVP.
--
-- Matches the man by email, which is the only thing he is likely to type the
-- same way twice. Where there is no match the RSVP is still recorded, against
-- no person, so the count is right and the admin can attach him afterwards --
-- losing an RSVP because a name was spelled differently would be worse.
create or replace function submit_rsvp(
  p_token text,
  p_email text,
  p_name text default null,
  p_guests integer default 0
) returns text
language plpgsql security definer set search_path = public as $$
declare
  ev events%rowtype;
  match_id integer;
begin
  select * into ev from events where rsvp_token = p_token and rsvp_open;
  if not found then
    return 'closed';
  end if;
  if p_email is null or position('@' in p_email) = 0 then
    raise exception 'an email address is needed';
  end if;

  select id into match_id
    from people
   where lower(email) = lower(trim(p_email))
   limit 1;

  if match_id is null then
    insert into event_attendance (event_id, person_id, note, source, rsvped_at, guests)
    values (ev.id, null, coalesce(p_name, '') || ' <' || lower(trim(p_email)) || '>',
            'rsvp', now(), greatest(coalesce(p_guests, 0), 0));
    return 'recorded_unmatched';
  end if;

  insert into event_attendance (event_id, person_id, source, rsvped_at, guests)
  values (ev.id, match_id, 'rsvp', now(), greatest(coalesce(p_guests, 0), 0))
  on conflict (event_id, person_id) do update
    set rsvped_at = now(),
        guests = excluded.guests,
        source = 'rsvp';
  return 'recorded';
end $$;

-- Deliberately reachable without an account -- that is the point of a link.
grant execute on function rsvp_event(text) to anon, authenticated;
grant execute on function submit_rsvp(text, text, text, integer) to anon, authenticated;

-- person_id had a NOT NULL through the primary key; an unmatched RSVP needs it
-- nullable, so the key moves to a partial unique index instead.
alter table event_attendance drop constraint if exists event_attendance_pkey;
alter table event_attendance alter column person_id drop not null;
alter table event_attendance add column if not exists id bigserial primary key;

create unique index if not exists event_attendance_person_idx
  on event_attendance (event_id, person_id) where person_id is not null;

-- Anyone signed in may mark that someone was here. It is an observation, it
-- sends nothing, and making a rebbe wait for approval to record "he stayed over
-- last Shabbos" would simply mean it never gets recorded.
create policy attendance_record on event_attendance
  for insert to authenticated with check (is_approved());

-- ---------------------------------------------------------------------------
-- visits on the feed
-- ---------------------------------------------------------------------------

create or replace view feed as
  select 'simcha'::text as kind,
         s.id,
         s.type::text   as subtype,
         s.occurred_on  as on_date,
         s.person_id,
         s.staff_id,
         coalesce(pe.first_name || ' ' || pe.last_name, st.name) as subject_name,
         s.spouse_name  as detail,
         s.note,
         s.created_at
    from simchas s
    left join people pe on pe.id = s.person_id
    left join staff  st on st.id = s.staff_id
   where s.type not in ('wedding_scheduled', 'child_wedding_scheduled')

  union all

  select 'event',
         e.id,
         e.type::text,
         e.starts_on,
         null, null,
         e.name,
         e.location,
         e.description,
         e.created_at
    from events e
   where e.on_feed

  union all

  -- Someone coming to, or having been at, the yeshiva. `expected` decides the
  -- wording, and `overnight` is kept apart because staying is a far stronger
  -- signal than dropping in.
  select 'visit',
         v.id,
         case
           when v.expected and v.overnight then 'visit_staying_expected'
           when v.expected                 then 'visit_expected'
           when v.overnight                then 'visit_stayed'
           else                                 'visit_came'
         end,
         v.visited_on,
         v.person_id,
         null,
         p.first_name || ' ' || p.last_name,
         case when v.nights is not null and v.nights > 1
              then v.nights || ' nights' end,
         v.note,
         v.created_at
    from visits v
    join people p on p.id = v.person_id;

alter view feed set (security_invoker = on);
grant select on feed to authenticated;
