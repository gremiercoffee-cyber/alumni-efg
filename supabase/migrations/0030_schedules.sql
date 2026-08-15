-- When the reminders actually run.
--
-- Daily at 07:00 Israel time (04:00 UTC in winter, 05:00 in summer -- pg_cron
-- speaks UTC only, and 05:00 UTC is chosen so it never fires before 7am local
-- and never later than 8am). The weekly five goes out Sunday morning, which is
-- the start of the week here and the day a rebbe can act on it.
--
-- Both endpoints are called with a shared secret, because the functions are
-- deployed without JWT checking so that cron can reach them at all. Without it
-- anyone who learned the URL could decide when the yeshiva emails its alumni.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('daily-notify') where exists (
  select 1 from cron.job where jobname = 'daily-notify'
);
select cron.unschedule('weekly-five') where exists (
  select 1 from cron.job where jobname = 'weekly-five'
);

select cron.schedule(
  'daily-notify',
  '0 5 * * *',
  $$
  select net.http_post(
    url := 'https://uamogipdeoonteezduvs.supabase.co/functions/v1/notify',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', 'SEEDED-AT-APPLY-TIME-SEE-0031'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'weekly-five',
  '0 5 * * 0',
  $$
  select net.http_post(
    url := 'https://uamogipdeoonteezduvs.supabase.co/functions/v1/weekly-digest',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', 'SEEDED-AT-APPLY-TIME-SEE-0031'
    ),
    body := '{}'::jsonb
  );
  $$
);
