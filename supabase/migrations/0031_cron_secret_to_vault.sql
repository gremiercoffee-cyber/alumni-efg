-- The shared secret the cron jobs send to the Edge Functions.
--
-- Seeded once at apply time with a generated value and deliberately not written
-- here: this repository is public, and a secret in a migration is a secret on
-- GitHub. It now lives in Supabase's encrypted vault and in the function's own
-- environment, and the cron job below decrypts it fresh on every run rather
-- than baking it into the schedule.
--
-- To rotate it: generate a value, set it as the CRON_SECRET function secret,
-- and update the vault entry of the same name. Both sides must match.
--
--   select vault.create_secret('<generated>', 'cron_secret', 'Shared secret ...');

select cron.unschedule('daily-notify') where exists (select 1 from cron.job where jobname = 'daily-notify');
select cron.unschedule('weekly-five') where exists (select 1 from cron.job where jobname = 'weekly-five');

select cron.schedule('daily-notify', '0 5 * * *', $$
  select net.http_post(
    url := 'https://uamogipdeoonteezduvs.supabase.co/functions/v1/notify',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
$$);

select cron.schedule('weekly-five', '0 5 * * 0', $$
  select net.http_post(
    url := 'https://uamogipdeoonteezduvs.supabase.co/functions/v1/weekly-digest',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
$$);
