-- Being in the country is worth knowing on its own.
--
-- A man who is in Israel can be invited to the yeshiva; a man who is not
-- cannot. So "coming to Israel" is a different fact from "coming to the
-- yeshiva", and collapsing them would lose the one that prompts an invitation.

alter table visits
  add column if not exists kind text not null default 'yeshiva'
    check (kind in ('yeshiva', 'israel'));

comment on column visits.kind is
  'yeshiva = he was, or will be, in the building. israel = in the country, '
  'which is the cue to invite him.';

create index if not exists visits_kind_idx on visits (kind, visited_on desc);

-- The feed wording follows both kind and whether the date has passed. `expected`
-- is set from the date at write time, so a visit re-reads itself correctly once
-- the day arrives without anyone editing it.
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

  select 'visit',
         v.id,
         case
           when v.kind = 'israel' and v.visited_on > current_date then 'israel_expected'
           when v.kind = 'israel'                                 then 'israel_here'
           when v.visited_on > current_date and v.overnight       then 'visit_staying_expected'
           when v.visited_on > current_date                       then 'visit_expected'
           when v.overnight                                       then 'visit_stayed'
           else                                                        'visit_came'
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
