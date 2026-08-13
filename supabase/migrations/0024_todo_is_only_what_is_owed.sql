-- To Do drops "coming up", and the announce window follows the date rather than
-- when the row was typed.
--
-- A wedding three months away is not work. It is news, and news belongs on the
-- feed, where the tense already reads correctly. Putting it in To Do meant the
-- queue was mostly things there was nothing to do about, which is how a queue
-- stops being read.
--
-- Removing it exposes a second problem. The announce branch only looked at rows
-- created in the last 90 days, on the assumption that anything older was
-- historical. But a wedding is typically recorded months ahead of the day: an
-- engagement in March, a date set for November, and by November the row is
-- eight months old. It would have aged out of the queue before the day it was
-- waiting for -- and with "coming up" gone, nothing else would have shown it.
--
-- So the window follows occurred_on. Simchas imported from the old sheets were
-- stamped announced_at at import time and are excluded regardless.

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

  -- Happened, and the Mazal Tov has not gone out. The only wedding row that is
  -- ever work.
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
     and (
       (s.occurred_on <= current_date and s.occurred_on > current_date - interval '90 days')
       -- An undated simcha still has to be announceable, so it falls back to
       -- when it was filed rather than dropping out of the queue entirely.
       or (s.occurred_on is null and s.created_at > now() - interval '90 days')
     );

alter view admin_queue set (security_invoker = on);
grant select on admin_queue to authenticated;
