-- A marriage is three events, not one.
--
-- When a man gets engaged nobody knows the wedding date yet. It arrives weeks or
-- months later, and that is its own piece of news worth announcing. Then the
-- wedding itself. Same simcha throughout, three separate moments:
--
--   1. got engaged          -- no date known
--   2. wedding date set     -- the date arrives; only now can reminders be scheduled
--   3. got married
--
-- Each is its own row so each is its own feed entry and its own notification.
-- They are tied together by parent_simcha_id, pointing back at the engagement,
-- so the whole story can be read as one thread.
--
-- This is also the fix for the old Apps Script's blind spot: it could only remind
-- about weddings whose date had already been typed into the sheet, and nothing
-- prompted anyone to go back and type it.

-- Enum values and columns only. Anything that names one of these new values --
-- the view in 0008 -- has to wait for the next transaction, because Postgres
-- refuses to use an enum value added by the transaction it is still inside.
alter type simcha_type add value if not exists 'wedding_scheduled';
alter type simcha_type add value if not exists 'bar_mitzvah';
alter type simcha_type add value if not exists 'child_bar_mitzvah';

alter type claim_type add value if not exists 'wedding_scheduled';
alter type claim_type add value if not exists 'bar_mitzvah';
alter type claim_type add value if not exists 'child_bar_mitzvah';

alter table simchas
  -- Points at the engagement this follows from. Null for a standalone simcha.
  add column if not exists parent_simcha_id bigint
    references simchas (id) on delete set null,
  -- The wedding date, once known. Carried on the wedding_scheduled row and
  -- copied forward, so the reminder job has one column to look at.
  add column if not exists wedding_on date;

create index if not exists simchas_parent_idx on simchas (parent_simcha_id);
