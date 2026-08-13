-- To Do becomes the admin's own work only, plus beds.
--
-- Reported items move out to their own screen in the drawer. They are a review
-- job -- reading someone else's judgement -- and mixing them with "send the
-- Mazal Tov" made the list read as two different kinds of work stacked
-- together.
--
-- Beds come in, because an alumnus arriving on Sunday with nowhere to sleep is
-- exactly the sort of thing that should be nagging from the front screen.

-- Dropped rather than replaced: report_count changes from bigint to integer,
-- and CREATE OR REPLACE VIEW can add a column but never retype one.
drop view if exists admin_queue;

create view admin_queue as
  select 'awaiting_date'::text as kind,
         e.engagement_id as id,
         'engagement'    as subtype,
         (e.engaged_on)::timestamptz as since,
         e.person_id,
         e.staff_id,
         e.subject_name,
         e.days_since::bigint as report_count,
         'open'          as status,
         e.engaged_on    as on_date
    from engagements_awaiting_date e

  union all

  -- Arriving with nowhere to sleep. Sorted nearest-first by the view below.
  select 'needs_bed',
         b.visit_id,
         'stay',
         (b.arrives)::timestamptz,
         b.person_id,
         null,
         b.name,
         b.nights_here::bigint,
         'open',
         b.arrives
    from stays_needing_beds b

  union all

  select 'upcoming',
         s.id,
         s.type::text,
         s.created_at,
         s.person_id,
         s.staff_id,
         coalesce(p.first_name || ' ' || p.last_name, st.name),
         (s.occurred_on - current_date)::bigint,
         'scheduled',
         s.occurred_on
    from simchas s
    left join people p  on p.id = s.person_id
    left join staff  st on st.id = s.staff_id
   where s.announced_at is null
     and s.occurred_on > current_date
     and s.type in ('wedding', 'child_wedding')

  union all

  select 'announce',
         s.id,
         s.type::text,
         s.created_at,
         s.person_id,
         s.staff_id,
         coalesce(p.first_name || ' ' || p.last_name, st.name),
         0::bigint,
         'unannounced',
         s.occurred_on
    from simchas s
    left join people p  on p.id = s.person_id
    left join staff  st on st.id = s.staff_id
   where s.announced_at is null
     and s.type not in ('wedding_scheduled', 'child_wedding_scheduled')
     and (s.occurred_on is null or s.occurred_on <= current_date)
     and s.created_at > now() - interval '90 days';

alter view admin_queue set (security_invoker = on);
grant select on admin_queue to authenticated;

-- What other people have reported, for the drawer. Same shape as before, just
-- no longer mixed into the admin's own list.
create or replace view reported_claims as
  select c.id,
         c.type::text as subtype,
         c.created_at as since,
         c.person_id,
         c.staff_id,
         coalesce(p.first_name || ' ' || p.last_name, st.name) as subject_name,
         (select count(*) from claim_reports r where r.claim_id = c.id) as report_count,
         c.status::text as status,
         (c.payload ->> 'date')::date as on_date
    from claims c
    left join people p  on p.id = c.person_id
    left join staff  st on st.id = c.staff_id
   where c.status = 'pending';

alter view reported_claims set (security_invoker = on);
grant select on reported_claims to authenticated;
