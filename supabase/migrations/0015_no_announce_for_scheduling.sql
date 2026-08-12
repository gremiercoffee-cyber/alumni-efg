-- Nothing gets announced for a wedding date being set.
--
-- The admin queue treated every simcha with no announced_at as something to
-- announce, which swept in the wedding_scheduled rows -- so the To Do list
-- offered to send "his wedding date is set" to the whole staff list. Nobody
-- wants that message. The date arriving is bookkeeping: it is what makes the
-- reminders possible and what clears a man off the "engaged, no date" list.
--
-- Same reasoning as 0014, which took these out of the feed. This takes them out
-- of the announce queue.

create or replace view admin_queue as
  select 'claim'::text as kind,
         c.id,
         c.type::text  as subtype,
         c.created_at  as since,
         c.person_id,
         c.staff_id,
         coalesce(p.first_name || ' ' || p.last_name, st.name) as subject_name,
         (select count(*) from claim_reports r where r.claim_id = c.id) as report_count,
         c.status::text as status,
         null::date     as on_date
    from claims c
    left join people p  on p.id = c.person_id
    left join staff  st on st.id = c.staff_id
   where c.status = 'pending'

  union all

  select 'awaiting_date',
         e.engagement_id,
         'engagement',
         (e.engaged_on)::timestamptz,
         e.person_id,
         e.staff_id,
         e.subject_name,
         e.days_since,
         'open',
         e.engaged_on
    from engagements_awaiting_date e

  union all

  select 'announce',
         s.id,
         s.type::text,
         s.created_at,
         s.person_id,
         s.staff_id,
         coalesce(p.first_name || ' ' || p.last_name, st.name),
         0,
         'unannounced',
         s.occurred_on
    from simchas s
    left join people p  on p.id = s.person_id
    left join staff  st on st.id = s.staff_id
   where s.announced_at is null
     and s.type not in ('wedding_scheduled', 'child_wedding_scheduled')
     and s.created_at > now() - interval '90 days';

alter view admin_queue set (security_invoker = on);
grant select on admin_queue to authenticated;
