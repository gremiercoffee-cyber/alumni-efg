-- What the admin screen needs to show, and what it needs to be allowed to read.

-- Sharing the Mazal Tov is a separate act from recording the simcha. The old
-- Apps Script emailed the director a pre-filled WhatsApp announcement and left
-- it to him to actually send it; nothing tracked whether he had. This does.
alter table simchas
  add column if not exists announced_at timestamptz,
  add column if not exists announced_by uuid references profiles on delete set null;

-- The outbox had no policy at all, which correctly denied everyone. But the
-- admin screen has to show what is queued and what failed, so admins get read
-- access. Writing is still service-role only -- that is what stops a non-admin
-- causing a Mazal Tov blast.
create policy outbox_admin_read on notification_outbox
  for select to authenticated using (is_admin());

-- Everything waiting on the admin, in one query.
--
-- Three kinds of work, deliberately in one list: a claim someone filed, an
-- engagement whose wedding date never arrived, and a simcha that has been
-- recorded but not yet announced.
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
     and s.created_at > now() - interval '90 days';

alter view admin_queue set (security_invoker = on);
grant select on admin_queue to authenticated;
