-- Keep scheduling out of the feed.
--
-- "wedding date is set" is an internal milestone, not news. It matters because it
-- is what makes reminders possible and what clears a man off the "engaged, no
-- date" queue -- but in the feed it doubles every wedding into two near-identical
-- entries.
--
-- The rows stay. They are still the link between an engagement and its wedding,
-- and the admin queue still reads them. They just do not surface here.
--
-- Separate from 0013 because Postgres will not let a transaction use an enum
-- value that the same transaction added -- which is exactly what broke the first
-- attempt at this view.

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
   where e.on_feed;

alter view feed set (security_invoker = on);
grant select on feed to authenticated;
