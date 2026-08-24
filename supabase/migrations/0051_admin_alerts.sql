-- Immediate admin pushes: someone needs approval, or a profile changed.
--
-- The daily summary was too slow for approvals -- a rebbe waiting to be let in
-- should reach the admin now, not at 9am. These queue the moment they happen
-- and a five-minute cron drains them straight to the admin's phone.

-- Someone new is waiting to be let in.
create or replace function notify_needs_approval() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'pending' and (tg_op = 'INSERT' or old.role is distinct from new.role) then
    insert into notification_outbox (kind, subject_table, subject_id, person_id, payload)
    values ('needs_approval', 'profiles', abs(hashtext(new.id::text)), null,
            jsonb_build_object('email', new.email))
    on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists profiles_needs_approval on profiles;
create trigger profiles_needs_approval
  after insert or update of role on profiles
  for each row execute function notify_needs_approval();

-- A profile field was changed (edits apply on their own now).
create or replace function notify_profile_updated() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.reviewed_at is not null and new.reviewed_by is null then
    insert into notification_outbox (kind, subject_table, subject_id, person_id, payload)
    values ('profile_updated', 'person_edits', new.id, new.person_id,
            jsonb_build_object('field', new.field))
    on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists person_edits_pushed on person_edits;
create trigger person_edits_pushed
  after insert on person_edits
  for each row execute function notify_profile_updated();

-- Drain them promptly: every five minutes, alerts only.
select cron.unschedule('alerts') where exists (select 1 from cron.job where jobname = 'alerts');
select cron.schedule('alerts', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://uamogipdeoonteezduvs.supabase.co/functions/v1/notify',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{"only":"alerts"}'::jsonb
  );
$$);
