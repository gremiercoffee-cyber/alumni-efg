-- Beds, and stays that span more than one night.
--
-- A visit had one date, which is enough to say "he came on Tuesday" but not
-- enough to answer "who is here on Tuesday" -- a man staying from Sunday for
-- three nights is here on Monday too, and a calendar has to know that.
--
-- Beds apply to overnight stays only. Someone dropping in for the day needs
-- nowhere to sleep, and putting day visits in the bed queue would bury the ones
-- that matter.

alter table visits
  -- The last night he is here. Null for a day visit.
  add column if not exists until_date date,
  -- Null means "not decided yet", which is different from false ("no bed").
  -- The queue is built from the difference.
  add column if not exists has_bed boolean,
  add column if not exists bed_note text;

comment on column visits.until_date is
  'Last night of the stay. Null for a day visit, which occupies no bed.';
comment on column visits.has_bed is
  'Null = not sorted yet, true = bed arranged, false = deliberately none needed.';

-- Backfill from nights where it was recorded, so existing stays have a span.
update visits
   set until_date = visited_on + ((nights - 1) * interval '1 day')
 where overnight and until_date is null and nights is not null and nights > 1;

update visits
   set until_date = visited_on
 where overnight and until_date is null;

create index if not exists visits_stay_idx
  on visits (visited_on, until_date) where overnight;

-- Every night of every stay, one row per man per night. This is what the
-- calendar reads: expanding the span in SQL rather than in the client means a
-- stay that crosses a month boundary cannot be got wrong in two places.
create or replace view stay_nights as
  select v.id as visit_id,
         v.person_id,
         p.first_name || ' ' || p.last_name as name,
         d::date as night,
         v.has_bed,
         v.bed_note,
         v.visited_on as arrives,
         coalesce(v.until_date, v.visited_on) as leaves,
         (v.visited_on > current_date) as expected
    from visits v
    join people p on p.id = v.person_id
    cross join lateral generate_series(
      v.visited_on,
      coalesce(v.until_date, v.visited_on),
      interval '1 day'
    ) as d
   where v.overnight
     and v.kind = 'yeshiva';

alter view stay_nights set (security_invoker = on);
grant select on stay_nights to authenticated;

-- Who still needs somewhere to sleep. Upcoming stays only -- a bed that was
-- never sorted for a stay that has already ended is history, not a job.
create or replace view stays_needing_beds as
  select v.id as visit_id,
         v.person_id,
         p.first_name || ' ' || p.last_name as name,
         v.visited_on as arrives,
         coalesce(v.until_date, v.visited_on) as leaves,
         (coalesce(v.until_date, v.visited_on) - v.visited_on + 1) as nights_here,
         (v.visited_on - current_date) as days_until
    from visits v
    join people p on p.id = v.person_id
   where v.overnight
     and v.kind = 'yeshiva'
     and v.has_bed is not true
     and coalesce(v.until_date, v.visited_on) >= current_date;

alter view stays_needing_beds set (security_invoker = on);
grant select on stays_needing_beds to authenticated;

-- Anyone may say a bed is sorted. It is a fact about a room, not a change to
-- an alumnus's record, and the person who arranged it is usually not the admin.
create policy visits_bed_update on visits
  for update to authenticated using (is_approved()) with check (is_approved());
