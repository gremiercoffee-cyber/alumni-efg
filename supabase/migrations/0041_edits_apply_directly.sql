-- Alumni Portal: profile edits apply on the spot.
--
-- A moved house or a new number is not something to sit in a queue waiting on
-- one man. Anyone approved changes it and it takes effect immediately; the
-- admin is told, not asked. Life events -- engaged, married, a birth -- are the
-- opposite: those still go through him, and that flow (claims, simcha_edits) is
-- untouched. The split is the whole point: facts anyone can see go straight in,
-- announcements that carry weight wait for a person.

-- Every applied edit is still written to person_edits, now as a record rather
-- than a request: status 'approved', reviewed_at stamped, reviewed_by null to
-- mean "the system, not a person". That gives the admin a change log to read
-- and the daily summary something to count, without a new table.

create or replace function edit_person(p_person_id integer, p_changes jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  allowed text[] := editable_person_fields();
  k text;
  v text;
  oldv text;
begin
  if not is_approved() then
    raise exception 'not allowed';
  end if;

  for k, v in select key, value from jsonb_each_text(p_changes) loop
    if not (k = any (allowed)) then
      raise exception 'field % is not editable', k;
    end if;
    execute format('select %I::text from people where id = $1', k)
      into oldv using p_person_id;
    v := nullif(trim(v), '');
    -- Skip no-ops so the log and the summary only carry real changes.
    if v is distinct from oldv then
      execute format('update people set %I = $1, updated_at = now() where id = $2', k)
        using v, p_person_id;
      insert into person_edits
        (person_id, field, old_value, new_value, status, submitted_by, reviewed_at)
      values (p_person_id, k, oldv, v, 'approved', auth.uid(), now());
    end if;
  end loop;
end $$;

revoke all on function edit_person(integer, jsonb) from public;
grant execute on function edit_person(integer, jsonb) to authenticated;

-- What changed lately, for the drawer and the daily summary. Auto-applied edits
-- are the ones with a reviewed_at and no human reviewer.
create or replace view recent_profile_changes as
  select e.id,
         e.person_id,
         coalesce(p.first_name || ' ' || p.last_name, 'Someone') as subject_name,
         e.field,
         e.old_value,
         e.new_value,
         e.reviewed_at as changed_at,
         coalesce(pr.display_name, s.name, 'someone') as changed_by
    from person_edits e
    join people p on p.id = e.person_id
    left join profiles pr on pr.id = e.submitted_by
    left join staff s on s.id = pr.staff_id
   where e.reviewed_at is not null
     and e.reviewed_by is null           -- auto-applied, not a human decision
   order by e.reviewed_at desc;

alter view recent_profile_changes set (security_invoker = on);
grant select on recent_profile_changes to authenticated;

-- An on-demand note to the whole rebbeim list: "he moved to Israel", "call him".
-- Queued here; the sender drains it to app_settings.list_email. Kept apart from
-- the automated digests because a person wrote it and chose to send it.
create table if not exists staff_broadcasts (
  id          bigserial primary key,
  subject     text not null,
  body        text not null,
  person_id   integer references people on delete set null,
  created_by  uuid references profiles on delete set null,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  last_error  text
);

alter table staff_broadcasts enable row level security;
create policy broadcasts_admin on staff_broadcasts
  for all to authenticated using (is_admin()) with check (is_admin());
