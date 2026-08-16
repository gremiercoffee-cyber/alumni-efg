-- Rotate the cron secret.
--
-- The value is seeded at apply time and scrubbed from this file before it is
-- committed; the repository is public. It lives in the vault and in the
-- function's own environment, and both sides must always match.
select vault.update_secret(
  (select id from vault.secrets where name = 'cron_secret'),
  'SEEDED-AT-APPLY-TIME'
);
