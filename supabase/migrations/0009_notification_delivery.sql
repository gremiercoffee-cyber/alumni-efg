-- Getting a notification to everyone who should have it.
--
-- notification_outbox says *what happened*. This says *who was told, how, and
-- whether it worked*. They are separate because one event fans out to many
-- people over several channels, and a failure to email one rabbi must not
-- silently lose the whole announcement.
--
-- Channel policy, decided 2026-08-12:
--   email  always, to everyone -- the only channel that reaches people with no
--          app, no smartphone, or an iPhone that has not added the web app
--   push   additionally, to anyone with a registered device token
--
-- Push is an upgrade on top of email, never a substitute. If a man's push fails
-- he has still been emailed.

create type notify_channel as enum ('email', 'push', 'sms');

create type delivery_status as enum ('pending', 'sent', 'failed', 'skipped');

-- Who should hear about things, including staff who have no login.
--
-- A rabbi with no account still needs the Mazal Tov email, so a recipient is
-- keyed on an email address and only optionally linked to a profile. When he
-- eventually signs in, the profile link makes push possible too.
create table notification_recipients (
  id            bigserial primary key,
  profile_id    uuid references profiles on delete cascade,
  staff_id      integer references staff on delete cascade,
  email         text not null,
  name          text,
  -- Off for someone who wants nothing; the record stays so it is a deliberate
  -- choice rather than a missing row.
  wants_email   boolean not null default true,
  wants_push    boolean not null default true,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (email)
);

create index on notification_recipients (profile_id);

-- One row per (event, recipient, channel). This is what makes retries safe:
-- a failed push can be retried without re-sending the email beside it.
create table notification_deliveries (
  id            bigserial primary key,
  outbox_id     bigint not null references notification_outbox on delete cascade,
  recipient_id  bigint references notification_recipients on delete set null,
  channel       notify_channel not null,
  address       text not null,          -- the email or the push token used
  status        delivery_status not null default 'pending',
  attempts      integer not null default 0,
  error         text,
  sent_at       timestamptz,
  created_at    timestamptz not null default now(),
  unique (outbox_id, recipient_id, channel)
);

create index on notification_deliveries (status) where status = 'pending';
create index on notification_deliveries (outbox_id);

-- Web push, for iPhone users who add the site to their Home Screen and for
-- desktop browsers. Kept apart from push_tokens because the payload is a
-- different shape entirely -- an endpoint plus two keys, not an Expo token.
create table web_push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  user_agent    text,
  created_at    timestamptz not null default now()
);

create index on web_push_subscriptions (profile_id);

alter table notification_recipients  enable row level security;
alter table notification_deliveries  enable row level security;
alter table web_push_subscriptions   enable row level security;

-- Recipients are readable by anyone signed in (it is a staff list, not secrets)
-- but only an admin decides who is on it.
create policy recipients_read on notification_recipients
  for select to authenticated using (true);
create policy recipients_admin on notification_recipients
  for all to authenticated using (is_admin()) with check (is_admin());
-- ...except your own preferences, which are yours to change.
create policy recipients_own_prefs on notification_recipients
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Delivery records are operational detail. Admin only; the Edge Function writes
-- them through the service role, which bypasses RLS entirely.
create policy deliveries_admin on notification_deliveries
  for select to authenticated using (is_admin());

create policy web_push_own on web_push_subscriptions
  for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Seeded from the addresses the old Apps Script actually sent to. None of the 36
-- staff rows carry an email -- the source spreadsheets never had them -- so
-- seeding from `staff` would produce an empty list and notifications that go
-- nowhere. efgrebbeim@aish.edu appears to be a group alias covering the rebbeim;
-- individual addresses can be added later and linked to their staff row.
insert into notification_recipients (email, name) values
  ('efgrebbeim@aish.edu', 'EFG Rebbeim (group)'),
  ('dcutler@aish.edu',    'D. Cutler'),
  ('ygrey@aish.com',      'Yoni Grey'),
  ('ygrey@aish.edu',      'Yoni Grey')
on conflict (email) do nothing;

-- Link the director's recipient rows to his staff record and profile once he
-- exists, so he gets push as well as email.
update notification_recipients r
   set staff_id = (select id from staff where name = 'Rabbi Grey'),
       profile_id = (select p.id from profiles p
                       join auth.users u on u.id = p.id
                      where lower(u.email) = r.email
                      limit 1)
 where r.email in ('ygrey@aish.com', 'ygrey@aish.edu');

-- And pick up any staff email that does get filled in later.
insert into notification_recipients (staff_id, email, name)
select s.id, lower(s.email), s.name
  from staff s
 where s.email is not null and s.email <> ''
on conflict (email) do nothing;

-- Fan one outbox row out to everyone who should hear about it. Called by the
-- Edge Function that drains the queue; kept in SQL so the policy lives in one
-- place rather than being reimplemented per notification type.
create or replace function fan_out_notification(p_outbox_id bigint)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer := 0;
begin
  -- Email: everyone who wants it. The floor, and the only universal channel.
  insert into notification_deliveries (outbox_id, recipient_id, channel, address)
  select p_outbox_id, r.id, 'email', r.email
    from notification_recipients r
   where r.active and r.wants_email
  on conflict do nothing;

  -- Push, on top, for anyone with a registered device.
  insert into notification_deliveries (outbox_id, recipient_id, channel, address)
  select distinct p_outbox_id, r.id, 'push', t.token
    from notification_recipients r
    join push_tokens t on t.profile_id = r.profile_id
   where r.active and r.wants_push
  on conflict do nothing;

  get diagnostics n = row_count;
  return n;
end $$;
