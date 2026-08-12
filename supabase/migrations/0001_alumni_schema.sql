-- Aish Gesher alumni database.
--
-- Replaces four Google Sheets and the Apps Scripts that ran on them. Structure
-- follows the source data: a person is one row no matter how many years he was
-- here, and every year he attended is an enrollment.
--
-- Person ids are NOT generated fresh. They carry over the AlumniIDs from the
-- rebbeim connection sheet, because the rabbis are filling that sheet in right
-- now and their answers are keyed to those numbers.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- enums
-- ---------------------------------------------------------------------------

create type user_role as enum ('admin', 'staff', 'viewer');

create type program_level as enum (
  'Shana Alef', 'Shana Bet', 'Shana Gimel', 'Shana Daled', 'Madrich'
);

create type simcha_type as enum ('engagement', 'wedding', 'birth', 'other');

-- What a non-admin can assert about an alumnus. Kept separate from simcha_type:
-- graduation is claimable but is not a simcha.
create type claim_type as enum (
  'engagement', 'wedding', 'birth', 'graduation', 'contact_update', 'other'
);

create type claim_status as enum ('pending', 'approved', 'rejected');

create type family_relation as enum ('father', 'mother', 'other');

create type event_type as enum ('shabbaton', 'dinner', 'other');

-- ---------------------------------------------------------------------------
-- who can use the app
-- ---------------------------------------------------------------------------

-- The 36 rabbis. 30 came from the connection workbook; 6 more were referenced
-- only by the alumni database's free-text 'Rebbe Contact' column.
create table staff (
  id            serial primary key,
  name          text not null unique,
  title         text,
  surname       text not null,
  email         text,
  phone         text,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- One row per login. Linked to a staff row when the user is one of the rabbis,
-- which is what makes a personal "my guys" list possible.
create table profiles (
  id            uuid primary key references auth.users on delete cascade,
  role          user_role not null default 'viewer',
  staff_id      integer unique references staff on delete set null,
  display_name  text,
  created_at    timestamptz not null default now()
);

-- Expo push tokens. A user may sign in on more than one device.
create table push_tokens (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles on delete cascade,
  token         text not null unique,
  platform      text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- the alumni
-- ---------------------------------------------------------------------------

create table people (
  id                        integer primary key,   -- the sheet's AlumniID
  first_name                text not null,
  last_name                 text not null,
  nickname                  text,

  email                     text,
  phone                     text,

  street_address            text,
  city                      text,
  state                     text,
  zip_code                  text,
  country                   text,
  hometown                  text,

  high_school               text,
  college                   text,
  grad_school               text,
  occupation                text,

  marital_status            text,
  spouse_name               text,

  -- Roughly three to four years after his last year here, then corrected by hand
  -- as the real answer becomes known. Drives the yearly "who is graduating" sweep.
  expected_graduation_year  integer,
  graduated_year            integer,

  -- Several alumni asked in writing not to be contacted. In the sheets that
  -- lived in free-text notes (and in one case in the date column), which means
  -- any automated outreach would have contacted them anyway.
  do_not_contact            boolean not null default false,
  do_not_contact_reason     text,

  learning_post_gesher      text,
  aish_impact               text,
  spotlight                 boolean not null default false,
  notes                     text,

  contact_updated_on        date,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- New people get ids above the imported range rather than colliding with it.
create sequence people_id_seq owned by people.id;
alter table people alter column id set default nextval('people_id_seq');

-- Alternate spellings folded in during the dedupe review ("Jason Heideman" for
-- "Jason Heidman"). Kept so search still finds a man under the name someone
-- else knows him by, and so a re-import can recognise the old spelling.
create table person_aliases (
  person_id     integer not null references people on delete cascade,
  alias         text not null,
  primary key (person_id, alias)
);

create table enrollments (
  id              bigserial primary key,
  person_id       integer not null references people on delete cascade,
  academic_year   text not null,             -- '2024-2025'
  level           program_level,
  rebbe_id        integer references staff on delete set null,
  -- The source sheets listed '13th Year - 2024-2025' twice for 115 people.
  -- This constraint makes that class of duplicate impossible.
  unique (person_id, academic_year, level)
);

create index on enrollments (person_id);
create index on enrollments (academic_year);

-- Parent contacts, from the 2024-25 and 2025-26 intake sheets. Often the only
-- way to reach an alumnus who has changed his number.
create table family_contacts (
  id            bigserial primary key,
  person_id     integer not null references people on delete cascade,
  relation      family_relation not null,
  name          text,
  email         text,
  phone         text
);

create index on family_contacts (person_id);

-- ---------------------------------------------------------------------------
-- relationships
-- ---------------------------------------------------------------------------

-- Which rabbi wants to stay in touch with which alumnus. This one table
-- replaces 30 near-identical spreadsheet tabs, and it is what powers both the
-- coverage report and each rebbe's personal list.
create table staff_connections (
  staff_id      integer not null references staff on delete cascade,
  person_id     integer not null references people on delete cascade,
  note          text,
  created_at    timestamptz not null default now(),
  primary key (staff_id, person_id)
);

create index on staff_connections (person_id);

-- ---------------------------------------------------------------------------
-- what alumni do: events they attend, visits they make
-- ---------------------------------------------------------------------------

create table events (
  id            bigserial primary key,
  type          event_type not null default 'shabbaton',
  name          text not null,               -- 'Alumni Shabbaton 2025'
  year          integer not null,
  starts_on     date,
  ends_on       date,
  location      text,
  created_at    timestamptz not null default now(),
  unique (type, year)
);

create table event_attendance (
  event_id      bigint not null references events on delete cascade,
  person_id     integer not null references people on delete cascade,
  note          text,
  primary key (event_id, person_id)
);

create index on event_attendance (person_id);

-- Coming back to the yeshiva. Ad-hoc rather than a shared event, so it is not
-- an `events` row. Sleeping here is tracked apart from just dropping in --
-- it is a much stronger signal and worth filtering on separately.
create table visits (
  id            bigserial primary key,
  person_id     integer not null references people on delete cascade,
  visited_on    date not null,
  overnight     boolean not null default false,
  nights        integer,
  note          text,
  recorded_by   uuid references profiles on delete set null,
  created_at    timestamptz not null default now()
);

create index on visits (person_id, visited_on desc);

-- What *we* did, as opposed to what he did: calls, texts, campaign outreach.
-- Seeded from the 'Rebbe Contact - Alumni 2022' tab, whose Summer 5782 /
-- Chanukah 5783 / Pesach 5783 columns were a touchpoint log.
create table interactions (
  id            bigserial primary key,
  person_id     integer not null references people on delete cascade,
  occurred_on   date not null,
  channel       text,                        -- 'whatsapp', 'call', 'email', 'in person'
  campaign      text,                        -- 'Chanukah 5783'
  staff_id      integer references staff on delete set null,
  note          text,
  recorded_by   uuid references profiles on delete set null,
  created_at    timestamptz not null default now()
);

create index on interactions (person_id, occurred_on desc);

-- ---------------------------------------------------------------------------
-- simchas
-- ---------------------------------------------------------------------------

-- Only an admin writes here, and writing here is what sends things outward.
create table simchas (
  id            bigserial primary key,
  person_id     integer not null references people on delete cascade,
  type          simcha_type not null,
  occurred_on   date,                        -- wedding date, or engagement date
  spouse_name   text,
  note          text,
  created_by    uuid references profiles on delete set null,
  created_at    timestamptz not null default now()
);

create index on simchas (person_id);
create index on simchas (occurred_on);

-- ---------------------------------------------------------------------------
-- claims: how non-admins propose a change
-- ---------------------------------------------------------------------------

-- One row per (alumnus, thing being claimed). The unique constraint is the
-- whole point: if ten rebbeim mark Avi Green engaged, there is one claim and
-- therefore one notification to the admin, not ten.
create table claims (
  id            bigserial primary key,
  person_id     integer not null references people on delete cascade,
  type          claim_type not null,
  status        claim_status not null default 'pending',
  payload       jsonb not null default '{}'::jsonb,   -- proposed date, spouse name, ...
  reviewed_by   uuid references profiles on delete set null,
  reviewed_at   timestamptz,
  reopened_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (person_id, type)
);

create index on claims (status, created_at desc);

-- Every individual report, kept even though only the first one notifies.
-- "Seven different rebbeim say so" is worth knowing when deciding whether to act,
-- and it tells the admin who to ask.
create table claim_reports (
  id            bigserial primary key,
  claim_id      bigint not null references claims on delete cascade,
  reported_by   uuid references profiles on delete set null,
  note          text,
  created_at    timestamptz not null default now()
);

create index on claim_reports (claim_id);

-- ---------------------------------------------------------------------------
-- outbound notifications
-- ---------------------------------------------------------------------------

-- A queue, not a log. Triggers and scheduled jobs write rows; an Edge Function
-- drains it and marks them sent. This replaces the "SENT" columns the Apps
-- Script wrote back into the spreadsheet, and unlike those it cannot lose track
-- of what it already sent.
create table notification_outbox (
  id            bigserial primary key,
  kind          text not null,       -- 'claim_filed', 'engagement', 'wedding_week_before', ...
  subject_table text not null,       -- 'claims', 'simchas'
  subject_id    bigint not null,
  person_id     integer references people on delete cascade,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  sent_at       timestamptz,
  attempts      integer not null default 0,
  last_error    text,
  -- Idempotency. A given alert fires once per subject, full stop.
  unique (kind, subject_table, subject_id)
);

create index on notification_outbox (sent_at) where sent_at is null;

-- ---------------------------------------------------------------------------
-- triggers
-- ---------------------------------------------------------------------------

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger people_touch before update on people
  for each row execute function touch_updated_at();

-- A new claim notifies the admin exactly once.
create or replace function claim_notify_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notification_outbox (kind, subject_table, subject_id, person_id, payload)
  values ('claim_filed', 'claims', new.id, new.person_id,
          jsonb_build_object('claim_type', new.type, 'payload', new.payload))
  on conflict do nothing;
  return new;
end $$;

create trigger claims_notify after insert on claims
  for each row execute function claim_notify_admin();

-- A further report against a *rejected* claim reopens it and notifies again --
-- the situation may genuinely have changed since it was turned down. Reports
-- against a pending or approved claim stay silent.
create or replace function claim_report_reopen() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c claims%rowtype;
begin
  select * into c from claims where id = new.claim_id;
  if c.status = 'rejected' then
    update claims
       set status = 'pending', reopened_at = now(), reviewed_by = null, reviewed_at = null
     where id = c.id;

    -- The outbox is unique on (kind, subject_table, subject_id), so a reopen
    -- needs its own kind to get past the alert already sent the first time.
    insert into notification_outbox (kind, subject_table, subject_id, person_id, payload)
    values ('claim_reopened', 'claims', c.id, c.person_id,
            jsonb_build_object('claim_type', c.type, 'report_id', new.id))
    on conflict (kind, subject_table, subject_id) do update
      set created_at = now(), sent_at = null, attempts = 0, last_error = null;
  end if;
  return new;
end $$;

create trigger claim_reports_reopen after insert on claim_reports
  for each row execute function claim_report_reopen();

-- An admin recording a simcha is what actually sends things outward.
create or replace function simcha_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'engagement' then
    insert into notification_outbox (kind, subject_table, subject_id, person_id, payload)
    values ('engagement', 'simchas', new.id, new.person_id, '{}'::jsonb)
    on conflict do nothing;
  end if;
  -- Wedding alerts are date-relative (a week before, the day of, the day after)
  -- and are enqueued by a scheduled job, not here.
  return new;
end $$;

create trigger simchas_notify after insert on simchas
  for each row execute function simcha_notify();
