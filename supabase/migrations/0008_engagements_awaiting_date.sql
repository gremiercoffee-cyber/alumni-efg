-- Split from 0007: this view names 'wedding_scheduled', and Postgres will not
-- let a transaction use an enum value that the same transaction added.

-- The reminder job's working set: engagements whose wedding date is still
-- unknown. This is the list the app should nag about -- it is the gap that let
-- weddings go unannounced.
create or replace view engagements_awaiting_date as
  select s.id as engagement_id,
         s.person_id,
         s.staff_id,
         coalesce(p.first_name || ' ' || p.last_name, st.name) as subject_name,
         s.occurred_on as engaged_on,
         (current_date - s.occurred_on) as days_since
    from simchas s
    left join people p  on p.id = s.person_id
    left join staff  st on st.id = s.staff_id
   where s.type = 'engagement'
     and not exists (
       select 1 from simchas f
        where f.parent_simcha_id = s.id
          and f.type in ('wedding_scheduled', 'wedding')
     );

alter view engagements_awaiting_date set (security_invoker = on);
grant select on engagements_awaiting_date to authenticated;
