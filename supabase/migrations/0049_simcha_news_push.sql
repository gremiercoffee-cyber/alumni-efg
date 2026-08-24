-- Every simcha tells everyone.
--
-- Weddings are date-relative and already handled (a week out, the day, the day
-- after). Everything else -- an engagement, a birth, a bar mitzvah -- is news
-- the moment it is recorded, and until now none of it pushed: the trigger
-- queued 'engagement' and nothing drained it, and births and the rest were not
-- queued at all. This queues one 'simcha_news' for every point-in-time simcha,
-- which the daily job pushes to everyone with the app.
--
-- child_wedding is left out on purpose: it is date-relative like a wedding and
-- already goes through the week-before / today path. So are the scheduling
-- types, which are not news.
create or replace function simcha_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.type in ('engagement','birth','bar_mitzvah','child_engagement',
                  'child_bar_mitzvah','grandchild_birth','other') then
    insert into notification_outbox (kind, subject_table, subject_id, person_id, payload)
    values ('simcha_news', 'simchas', new.id, new.person_id,
            jsonb_build_object('simcha_type', new.type::text))
    on conflict do nothing;
  end if;
  return new;
end $$;

-- Re-key the engagement row that has been sitting unsent, so it goes out with
-- the rest rather than staying stranded under a kind nothing handles.
update notification_outbox
   set kind = 'simcha_news',
       payload = jsonb_build_object('simcha_type', 'engagement')
 where kind = 'engagement' and sent_at is null;
