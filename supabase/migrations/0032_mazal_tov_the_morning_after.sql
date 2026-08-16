-- The nudge to send the Mazal Tov, the morning after the wedding.
--
-- This is the one that was missing. The queue has shown "SEND THE MAZAL TOV"
-- from the day after since Friday, but silently -- it waits in the app until
-- someone opens it, which is precisely the failure the old Apps Script had.
--
-- Deliberately the day after and not the day of: on the day he is at his own
-- wedding, and an announcement then lands in the middle of it.

create or replace function queue_due_notifications()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer := 0;
  added integer;
begin
  -- A week out. For the people who need notice: a flight, a present, a day off.
  insert into notification_outbox (kind, subject_table, subject_id, person_id, payload)
  select 'wedding_week_before', 'simchas', s.id, s.person_id,
         jsonb_build_object('on', s.occurred_on)
    from simchas s
   where s.type in ('wedding', 'child_wedding')
     and s.occurred_on = current_date + 7
  on conflict do nothing;
  get diagnostics added = row_count; n := n + added;

  insert into notification_outbox (kind, subject_table, subject_id, person_id, payload)
  select 'wedding_today', 'simchas', s.id, s.person_id,
         jsonb_build_object('on', s.occurred_on)
    from simchas s
   where s.type in ('wedding', 'child_wedding')
     and s.occurred_on = current_date
  on conflict do nothing;
  get diagnostics added = row_count; n := n + added;

  -- The morning after: send the Mazal Tov. Only raised while it has not gone
  -- out, so announcing it early takes the reminder with it rather than nagging
  -- about something already done.
  insert into notification_outbox (kind, subject_table, subject_id, person_id, payload)
  select 'wedding_day_after', 'simchas', s.id, s.person_id,
         jsonb_build_object('on', s.occurred_on)
    from simchas s
   where s.type in ('wedding', 'child_wedding')
     and s.occurred_on = current_date - 1
     and s.announced_at is null
  on conflict do nothing;
  get diagnostics added = row_count; n := n + added;

  insert into notification_outbox (kind, subject_table, subject_id, person_id, payload)
  select 'birthday_today', 'people',
         b.person_id * 10000 + extract(year from current_date)::int,
         b.person_id,
         jsonb_build_object('name', b.name, 'turning', b.turning)
    from upcoming_birthdays b
   where b.next_on = current_date
  on conflict do nothing;
  get diagnostics added = row_count; n := n + added;

  return n;
end $$;

-- Which devices belong to an admin.
--
-- The Mazal Tov reminder is a job, not news: it goes to whoever will actually
-- send the announcement, and to nobody else. Every other alert still goes to
-- everyone with the app.
create or replace view admin_push_tokens as
  select t.token
    from push_tokens t
    join profiles p on p.id = t.profile_id
   where p.role = 'admin';

alter view admin_push_tokens set (security_invoker = off);
revoke all on admin_push_tokens from anon, authenticated;

-- Run hourly instead of once at dawn.
--
-- The send itself is gated on the clock in Jerusalem, which is the only way to
-- hit 9am local all year: pg_cron speaks UTC, and Israel moves by an hour twice
-- a year, so a fixed UTC time is 9am for half of it and 10am for the rest.
-- Queueing is idempotent, so the extra runs cost nothing.
select cron.unschedule('daily-notify') where exists (
  select 1 from cron.job where jobname = 'daily-notify'
);

select cron.schedule('daily-notify', '5 * * * *', $$
  select net.http_post(
    url := 'https://uamogipdeoonteezduvs.supabase.co/functions/v1/notify',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
$$);
