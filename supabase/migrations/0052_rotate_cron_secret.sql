-- Rotate the cron secret (the previous one was briefly committed in plaintext).
-- Seeded at apply time and scrubbed from this file before commit.
select vault.update_secret((select id from vault.secrets where name = 'cron_secret'), 'SEEDED-AT-APPLY-TIME-THEN-SCRUBBED');
