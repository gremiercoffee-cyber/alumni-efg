-- Currently-in-program guys live in the database but stay hidden.
--
-- This year's men are entered now so they are ready, but they are not alumni
-- yet -- a Shana Bet is still learning. in_program = true keeps a man off every
-- forward-facing list (All Alumni, My Alumni, search, the feed) while leaving
-- everything about him intact: his profile, and any rebbe who marked him as
-- "my alumni". At year end the admin flips it off and he simply appears.
--
-- Default false, because the database is an alumni database: a man is an alumnus
-- unless the admin says he is still in.
alter table people add column if not exists in_program boolean not null default false;

comment on column people.in_program is
  'True = currently learning, hidden from the forward-facing app but fully kept. '
  'False = alumnus, shown. The admin flips it at year end. Connections and '
  'profile are never touched by it.';

-- The feed drops in-program guys too -- same reasoning, it is forward-facing.
create or replace view feed as
  select 'simcha'::text as kind, s.id, s.type::text as subtype, s.occurred_on as on_date,
         s.person_id, s.staff_id,
         coalesce(display_name(pe.first_name, pe.nickname, pe.last_name), st.name) as subject_name,
         s.spouse_name as detail, s.note, s.created_at
    from simchas s
    left join people pe on pe.id = s.person_id
    left join staff  st on st.id = s.staff_id
   where s.type not in ('wedding_scheduled', 'child_wedding_scheduled')
     and coalesce(pe.in_program, false) = false
  union all
  select 'event', e.id, e.type::text, e.starts_on, null, null,
         e.name, e.location, e.description, e.created_at
    from events e where e.on_feed
  union all
  select 'visit', v.id,
         case
           when v.kind = 'israel' and v.visited_on > current_date then 'israel_expected'
           when v.kind = 'israel'                                 then 'israel_here'
           when v.visited_on > current_date and v.overnight       then 'visit_staying_expected'
           when v.visited_on > current_date                       then 'visit_expected'
           when v.overnight                                       then 'visit_stayed'
           else                                                        'visit_came'
         end,
         v.visited_on, v.person_id, null,
         display_name(p.first_name, p.nickname, p.last_name),
         case when v.nights is not null and v.nights > 1 then v.nights || ' nights' end,
         v.note, v.created_at
    from visits v join people p on p.id = v.person_id
   where coalesce(p.in_program, false) = false;
alter view feed set (security_invoker = on);
grant select on feed to authenticated;
