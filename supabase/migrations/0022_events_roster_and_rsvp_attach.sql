-- Events the admin runs, and the RSVPs that come back from a shared link.
--
-- The plumbing for the link itself landed in 0016/0017 (rsvp_token,
-- rsvp_event(), submit_rsvp()). This adds what the admin needs on his side:
-- a roster he can read, a count he can see without opening each event, and a
-- way to attach an RSVP that matched nobody.

-- ---------------------------------------------------------------------------
-- the roster
-- ---------------------------------------------------------------------------

-- One row per person on an event, matched or not.
--
-- Unmatched RSVPs are kept as first-class rows rather than dropped: someone who
-- typed a different address than the one on file is still coming, and the meal
-- count has to include him. `display_name` is what to put on a list -- his real
-- name if we know him, otherwise whatever he typed.
create or replace view event_roster as
  select a.id,
         a.event_id,
         a.person_id,
         a.source,
         a.guests,
         a.rsvped_at,
         a.note,
         coalesce(p.first_name || ' ' || p.last_name,
                  nullif(trim(split_part(a.note, '<', 1)), ''),
                  'Someone') as display_name,
         -- The email is only in `note` for unmatched rows; for matched ones it
         -- is on the person, which is the address actually worth writing to.
         coalesce(p.email,
                  nullif(trim(both '>' from split_part(a.note, '<', 2)), ''))
           as email,
         p.phone,
         a.person_id is null as unmatched
    from event_attendance a
    left join people p on p.id = a.person_id;

alter view event_roster set (security_invoker = on);
grant select on event_roster to authenticated;

-- The list view. Counting in SQL keeps the events screen one query rather than
-- one per event, and `heads` is the number that actually matters -- guests eat
-- too.
create or replace view event_summary as
  select e.id,
         e.name,
         e.type::text as type,
         e.year,
         e.starts_on,
         e.ends_on,
         e.location,
         e.description,
         e.on_feed,
         e.rsvp_open,
         e.rsvp_token,
         count(a.id)                                        as coming,
         count(a.id) + coalesce(sum(a.guests), 0)           as heads,
         count(a.id) filter (where a.person_id is null)     as unmatched,
         count(a.id) filter (where a.source = 'rsvp')       as via_link
    from events e
    left join event_attendance a on a.event_id = e.id
   group by e.id;

alter view event_summary set (security_invoker = on);
grant select on event_summary to authenticated;

-- ---------------------------------------------------------------------------
-- attaching an RSVP that matched nobody
-- ---------------------------------------------------------------------------

-- Done in SQL because of the collision case: the man may already be on the
-- roster (the admin added him, then he RSVPed from a different address). Two
-- rows for one man would double the meal count, so the guest numbers are folded
-- together and the stray row goes.
create or replace function attach_rsvp(p_attendance_id bigint, p_person_id integer)
returns void
language plpgsql security definer set search_path = public as $$
declare
  a event_attendance%rowtype;
  existing_id bigint;
begin
  if not is_admin() then
    raise exception 'only an admin can attach an RSVP';
  end if;

  select * into a from event_attendance where id = p_attendance_id;
  if not found then
    raise exception 'no such RSVP';
  end if;

  select id into existing_id
    from event_attendance
   where event_id = a.event_id and person_id = p_person_id;

  if existing_id is not null then
    update event_attendance
       set guests = greatest(guests, a.guests),
           rsvped_at = coalesce(rsvped_at, a.rsvped_at),
           source = case when a.source = 'rsvp' then 'rsvp' else source end
     where id = existing_id;
    delete from event_attendance where id = p_attendance_id;
  else
    update event_attendance
       set person_id = p_person_id,
           note = null
     where id = p_attendance_id;
  end if;
end $$;

revoke all on function attach_rsvp(bigint, integer) from public;
grant execute on function attach_rsvp(bigint, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- the link
-- ---------------------------------------------------------------------------

-- Let the admin roll a token. If a link ends up somewhere it should not be,
-- there has to be a way to kill it that is not deleting the event.
create or replace function reset_rsvp_token(p_event_id bigint)
returns text
language plpgsql security definer set search_path = public as $$
declare
  fresh text;
begin
  if not is_admin() then
    raise exception 'only an admin can reset the link';
  end if;
  fresh := encode(gen_random_bytes(16), 'hex');
  update events set rsvp_token = fresh where id = p_event_id;
  return fresh;
end $$;

revoke all on function reset_rsvp_token(bigint) from public;
grant execute on function reset_rsvp_token(bigint) to authenticated;

-- rsvp_event() returned only the four fields the form needed. The form also
-- wants to say when it ends and whether he is already down as coming, so it
-- returns the end date now too. Dropped rather than replaced: the return type
-- changes, and CREATE OR REPLACE cannot do that.
drop function if exists rsvp_event(text);

create function rsvp_event(p_token text)
returns table (
  event_name  text,
  starts_on   date,
  ends_on     date,
  location    text,
  description text
)
language sql security definer stable set search_path = public as $$
  select e.name, e.starts_on, e.ends_on, e.location, e.description
    from events e
   where e.rsvp_token = p_token and e.rsvp_open;
$$;

grant execute on function rsvp_event(text) to anon, authenticated;

-- An RSVP is a promise to turn up, not an announcement. Nothing here writes to
-- notification_outbox on purpose: 200 men replying to a link must not become
-- 200 notifications.
