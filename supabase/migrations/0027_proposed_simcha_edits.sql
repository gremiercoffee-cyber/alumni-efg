-- Suggesting a change to something already filed.
--
-- Until now a rebbe who spotted a wrong wedding date could only mention it in
-- passing, and a rebbe who knew the date of a wedding nobody had recorded had
-- nowhere to put it. Both are the most valuable thing anyone can offer: they
-- are the people who actually know.
--
-- Same shape as person_edits, and for the same reason -- proposals are cheap,
-- and the record only changes when the admin says so.

create table simcha_edits (
  id            bigserial primary key,
  simcha_id     bigint not null references simchas on delete cascade,
  -- 'occurred_on' moves the thing itself. 'wedding_on' against an engagement
  -- means "the wedding is on this date", which creates the wedding rather than
  -- editing the engagement -- the case the old sheet could never handle.
  field         text not null check (field in ('occurred_on', 'wedding_on', 'note')),
  new_value     text,
  reason        text,
  status        claim_status not null default 'pending',
  submitted_by  uuid references profiles on delete set null,
  reviewed_by   uuid references profiles on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index on simcha_edits (status, created_at desc);
create index on simcha_edits (simcha_id);

-- One pending suggestion per person per field, so a rebbe correcting himself
-- replaces his own suggestion instead of stacking them up.
create unique index simcha_edits_one_open
  on simcha_edits (simcha_id, field, submitted_by)
  where status = 'pending';

alter table simcha_edits enable row level security;

create policy simcha_edits_read on simcha_edits
  for select to authenticated using (is_approved());

create policy simcha_edits_propose on simcha_edits
  for insert to authenticated
  with check (
    is_approved()
    and (is_admin() or (status = 'pending' and submitted_by = auth.uid()))
  );

create policy simcha_edits_review on simcha_edits
  for update to authenticated using (is_admin()) with check (is_admin());

create policy simcha_edits_withdraw on simcha_edits
  for delete to authenticated
  using (is_admin() or (status = 'pending' and submitted_by = auth.uid()));

-- Tell the admin. One per simcha per field, so three rebbeim who all know the
-- wedding is in November are one nudge, not three.
create or replace function simcha_edit_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notification_outbox (kind, subject_table, subject_id, person_id, payload)
  select 'simcha_edit_proposed', 'simcha_edits', new.id, s.person_id,
         jsonb_build_object('field', new.field, 'new_value', new.new_value)
    from simchas s where s.id = new.simcha_id
  on conflict do nothing;
  return new;
end $$;

create trigger simcha_edits_notify after insert on simcha_edits
  for each row when (new.status = 'pending') execute function simcha_edit_notify();

-- What the admin reads: the suggestion, what it would replace, and who says so.
create or replace view proposed_simcha_edits as
  select e.id,
         e.simcha_id,
         e.field,
         e.new_value,
         e.reason,
         e.created_at,
         s.type::text as subtype,
         s.occurred_on as current_date_value,
         s.note        as current_note,
         coalesce(p.first_name || ' ' || p.last_name, st.name) as subject_name,
         s.person_id,
         coalesce(pr.display_name, prs.name, 'someone') as proposed_by
    from simcha_edits e
    join simchas s   on s.id = e.simcha_id
    left join people p  on p.id = s.person_id
    left join staff  st on st.id = s.staff_id
    left join profiles pr on pr.id = e.submitted_by
    left join staff prs on prs.id = pr.staff_id
   where e.status = 'pending';

alter view proposed_simcha_edits set (security_invoker = on);
grant select on proposed_simcha_edits to authenticated;

-- Commit or refuse one.
--
-- In SQL because approving a wedding_on against an engagement is not an update
-- at all -- it creates the wedding and links it back, which is what takes the
-- engagement out of the "needs a date" queue. Doing that in the client would
-- mean two round trips that can half-fail.
create or replace function apply_simcha_edit(p_edit_id bigint, p_approve boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  e simcha_edits%rowtype;
  s simchas%rowtype;
  d date;
begin
  if not is_admin() then
    raise exception 'only an admin can review suggestions';
  end if;

  select * into e from simcha_edits where id = p_edit_id;
  if not found then raise exception 'no such suggestion'; end if;
  select * into s from simchas where id = e.simcha_id;
  if not found then raise exception 'the simcha it refers to is gone'; end if;

  if p_approve then
    if e.field = 'note' then
      update simchas set note = nullif(e.new_value, '') where id = s.id;

    elsif e.field = 'occurred_on' then
      d := e.new_value::date;
      update simchas
         set occurred_on = d,
             wedding_on = case when type in ('wedding', 'child_wedding')
                               then d else wedding_on end,
             -- Back into the future means it has not happened, so it cannot
             -- have been announced.
             announced_at = case when d > current_date then null else announced_at end,
             announced_by = case when d > current_date then null else announced_by end
       where id = s.id;

    elsif e.field = 'wedding_on' then
      d := e.new_value::date;
      if s.type = 'engagement' then
        -- The wedding is its own row, dated ahead, hung off the engagement.
        -- Guarded so two approvals of the same suggestion cannot make two
        -- weddings.
        insert into simchas (person_id, staff_id, type, occurred_on, wedding_on,
                             parent_simcha_id, created_by)
        select s.person_id, s.staff_id, 'wedding', d, d, s.id, e.submitted_by
         where not exists (
           select 1 from simchas w
            where w.parent_simcha_id = s.id
              and w.type in ('wedding', 'wedding_scheduled')
         );
      else
        update simchas set occurred_on = d, wedding_on = d where id = s.id;
      end if;
    end if;
  end if;

  update simcha_edits
     set status = case when p_approve then 'approved' else 'rejected' end::claim_status,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_edit_id;
end $$;

revoke all on function apply_simcha_edit(bigint, boolean) from public;
grant execute on function apply_simcha_edit(bigint, boolean) to authenticated;
