-- submit_rsvp() upserted with `on conflict (event_id, person_id)`, but 0017 made
-- that a PARTIAL unique index (`where person_id is not null`, so unmatched RSVPs
-- can pile up against no person). Postgres will not infer a partial index from a
-- bare column list -- it raises "no unique or exclusion constraint matching the
-- ON CONFLICT specification".
--
-- So the first RSVP from a recognised man worked and a second one from him blew
-- up: exactly the case nobody tests, and exactly the case that happens (he taps
-- the link again to change his guest count).
--
-- The predicate has to be repeated for the inference to succeed.

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
    -- Answering twice from an address we do not know would otherwise add him
    -- twice and double the meal count, so the earlier row is updated instead.
    update event_attendance
       set guests = greatest(coalesce(p_guests, 0), 0),
           rsvped_at = now()
     where event_id = ev.id
       and person_id is null
       and lower(note) like '%<' || lower(trim(p_email)) || '>';
    if found then
      return 'recorded_unmatched';
    end if;

    insert into event_attendance (event_id, person_id, note, source, rsvped_at, guests)
    values (ev.id, null, coalesce(p_name, '') || ' <' || lower(trim(p_email)) || '>',
            'rsvp', now(), greatest(coalesce(p_guests, 0), 0));
    return 'recorded_unmatched';
  end if;

  insert into event_attendance (event_id, person_id, source, rsvped_at, guests)
  values (ev.id, match_id, 'rsvp', now(), greatest(coalesce(p_guests, 0), 0))
  on conflict (event_id, person_id) where person_id is not null do update
    set rsvped_at = now(),
        guests = excluded.guests,
        source = 'rsvp';
  return 'recorded';
end $$;

grant execute on function submit_rsvp(text, text, text, integer) to anon, authenticated;
