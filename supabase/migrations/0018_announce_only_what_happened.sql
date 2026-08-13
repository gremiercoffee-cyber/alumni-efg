-- Do not offer to announce a wedding that has not happened yet.
--
-- The announce queue took any simcha with no announced_at, which swept in every
-- future wedding -- so the To Do list offered to send "Mazal tov on his wedding"
-- three months early, and the card read "got married" about a date still to come.
--
-- A wedding becomes announceable on the day. An engagement or a birth is
-- announced after the fact and is announceable immediately; those carry the date
-- they happened, so the same rule covers both.
--
-- What a future wedding needs instead is its date confirmed and a reminder
-- nearer the time, which is what the awaiting-date section is for.

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

  -- Coming up: a wedding with a date, still ahead of us. Not announceable yet,
  -- but worth seeing -- this is the week's diary.
  select 'upcoming',
         s.id,
         s.type::text,
         s.created_at,
         s.person_id,
         s.staff_id,
         coalesce(p.first_name || ' ' || p.last_name, st.name),
         (s.occurred_on - current_date),
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
         0,
         'unannounced',
         s.occurred_on
    from simchas s
    left join people p  on p.id = s.person_id
    left join staff  st on st.id = s.staff_id
   where s.announced_at is null
     and s.type not in ('wedding_scheduled', 'child_wedding_scheduled')
     -- Happened, or has no date of its own to wait for.
     and (s.occurred_on is null or s.occurred_on <= current_date)
     and s.created_at > now() - interval '90 days';

alter view admin_queue set (security_invoker = on);
grant select on admin_queue to authenticated;
