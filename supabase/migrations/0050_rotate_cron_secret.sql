select vault.update_secret((select id from vault.secrets where name = 'cron_secret'), 'SEEDED-AT-APPLY-TIME-THEN-SCRUBBED');
