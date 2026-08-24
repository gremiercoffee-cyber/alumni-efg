-- What someone is shown as, everywhere.
--
-- A man is in the database under the name the sheet had -- Rowen Young. He goes
-- by Avi. Rather than overwrite his given name (which is real and worth
-- keeping), a nickname is what shows: "Avi Young" forward-facing, "Rowen" still
-- on file and still searchable.
--
-- One helper so every screen agrees, rather than the || ' ' || spelled out a
-- dozen times and half of them missed.
create or replace function display_name(first text, nick text, last text)
returns text
language sql immutable as $$
  select nullif(
    trim(both ' ' from concat_ws(' ', coalesce(nullif(trim(nick), ''), first), last)),
    ''
  );
$$;

-- Feed: home, seen by everyone.
create or replace view feed as
  select 'simcha'::text as kind, s.id, s.type::text as subtype, s.occurred_on as on_date,
         s.person_id, s.staff_id,
         coalesce(display_name(pe.first_name, pe.nickname, pe.last_name), st.name) as subject_name,
         s.spouse_name as detail, s.note, s.created_at
    from simchas s
    left join people pe on pe.id = s.person_id
    left join staff  st on st.id = s.staff_id
   where s.type not in ('wedding_scheduled', 'child_wedding_scheduled')
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
    from visits v join people p on p.id = v.person_id;
alter view feed set (security_invoker = on);
grant select on feed to authenticated;

-- Engagements awaiting a date (feeds the queue and the report).
create or replace view engagements_awaiting_date as
  select s.id as engagement_id, s.person_id, s.staff_id,
         coalesce(display_name(p.first_name, p.nickname, p.last_name), st.name) as subject_name,
         s.occurred_on as engaged_on, (current_date - s.occurred_on) as days_since
    from simchas s
    left join people p  on p.id = s.person_id
    left join staff  st on st.id = s.staff_id
   where s.type = 'engagement'
     and not exists (select 1 from simchas f
        where f.parent_simcha_id = s.id and f.type in ('wedding_scheduled', 'wedding'));
alter view engagements_awaiting_date set (security_invoker = on);
grant select on engagements_awaiting_date to authenticated;

-- Who needs a bed.
create or replace view stays_needing_beds as
  select v.id as visit_id, v.person_id,
         display_name(p.first_name, p.nickname, p.last_name) as name,
         v.visited_on as arrives,
         coalesce(v.until_date, v.visited_on) as leaves,
         (coalesce(v.until_date, v.visited_on) - v.visited_on + 1) as nights_here,
         (v.visited_on - current_date) as days_until
    from visits v join people p on p.id = v.person_id
   where v.overnight and v.kind = 'yeshiva' and v.has_bed is not true
     and coalesce(v.until_date, v.visited_on) >= current_date;
alter view stays_needing_beds set (security_invoker = on);
grant select on stays_needing_beds to authenticated;

-- The To Do queue's announce branch.
create or replace view admin_queue as
  select 'awaiting_date'::text as kind, e.engagement_id as id, 'engagement' as subtype,
         (e.engaged_on)::timestamptz as since, e.person_id, e.staff_id, e.subject_name,
         e.days_since::bigint as report_count, 'open' as status, e.engaged_on as on_date
    from engagements_awaiting_date e
  union all
  select 'needs_bed', b.visit_id, 'stay', (b.arrives)::timestamptz, b.person_id, null,
         b.name, b.nights_here::bigint, 'open', b.arrives
    from stays_needing_beds b
  union all
  select 'announce', s.id, s.type::text, s.created_at, s.person_id, s.staff_id,
         coalesce(display_name(p.first_name, p.nickname, p.last_name), st.name),
         0::bigint, 'unannounced', s.occurred_on
    from simchas s
    left join people p  on p.id = s.person_id
    left join staff  st on st.id = s.staff_id
   where s.announced_at is null
     and s.type not in ('wedding_scheduled', 'child_wedding_scheduled')
     and ((s.occurred_on <= current_date and s.occurred_on > current_date - interval '90 days')
       or (s.occurred_on is null and s.created_at > now() - interval '90 days'));
alter view admin_queue set (security_invoker = on);
grant select on admin_queue to authenticated;

-- Recent changes log.
create or replace view recent_profile_changes as
  select e.id, e.person_id,
         coalesce(display_name(p.first_name, p.nickname, p.last_name), 'Someone') as subject_name,
         e.field, e.old_value, e.new_value, e.reviewed_at as changed_at,
         coalesce(pr.display_name, s.name, 'someone') as changed_by
    from person_edits e
    join people p on p.id = e.person_id
    left join profiles pr on pr.id = e.submitted_by
    left join staff s on s.id = pr.staff_id
   where e.reviewed_at is not null and e.reviewed_by is null
   order by e.reviewed_at desc;
alter view recent_profile_changes set (security_invoker = on);
grant select on recent_profile_changes to authenticated;
