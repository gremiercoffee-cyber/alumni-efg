-- Structural half of the change. Separate from 0005 because Postgres will not
-- let a transaction use an enum value that the same transaction added.

-- ---------------------------------------------------------------------------
-- a simcha belongs to an alumnus OR a rebbe
-- ---------------------------------------------------------------------------

alter table simchas
  add column if not exists staff_id integer references staff on delete cascade,
  alter column person_id drop not null;

alter table simchas
  add constraint simchas_one_subject
  check ((person_id is not null) <> (staff_id is not null));

create index if not exists simchas_staff_idx on simchas (staff_id);

alter table claims
  add column if not exists staff_id integer references staff on delete cascade,
  alter column person_id drop not null;

alter table claims
  add constraint claims_one_subject
  check ((person_id is not null) <> (staff_id is not null));

-- The "ten rebbeim reporting the same engagement is one notification" rule has
-- to hold for staff simchas too. The original UNIQUE (person_id, type) does not
-- constrain rows where person_id is null, so each subject gets its own partial
-- unique index instead.
alter table claims drop constraint if exists claims_person_id_type_key;

create unique index if not exists claims_person_subject_idx
  on claims (person_id, type) where person_id is not null;

create unique index if not exists claims_staff_subject_idx
  on claims (staff_id, type) where staff_id is not null;

-- ---------------------------------------------------------------------------
-- events on the feed
-- ---------------------------------------------------------------------------

alter table events
  add column if not exists description text,
  add column if not exists on_feed boolean not null default true,
  add column if not exists created_by uuid references profiles on delete set null;

-- The shabbaton is once a year, but dinners and one-off gatherings are not, so
-- the original UNIQUE (type, year) is too strict now that admins add events.
alter table events drop constraint if exists events_type_year_key;

create index if not exists events_feed_idx on events (starts_on desc) where on_feed;

-- ---------------------------------------------------------------------------
-- who contacted whom
-- ---------------------------------------------------------------------------

-- Tapping WhatsApp, call or email in the app records an interaction, so contact
-- history builds itself instead of relying on anyone to log it.
--
-- Honest limitation: this records that the app was handed off to WhatsApp, not
-- that a message was actually sent. Treat it as "he reached out", not "he made
-- contact", and never as proof the alumnus heard anything.
alter table interactions
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'app_tap', 'import'));

create index if not exists interactions_recent_idx
  on interactions (person_id, occurred_on desc);

-- Who has gone quiet, and who last reached out. Used by the contacts list and
-- by any future "nobody has spoken to these men" sweep.
create or replace view person_last_contact as
  select p.id as person_id,
         max(i.occurred_on) as last_contacted_on,
         count(i.id)        as contact_count
    from people p
    left join interactions i on i.person_id = p.id
   group by p.id;

-- ---------------------------------------------------------------------------
-- feed
-- ---------------------------------------------------------------------------

-- One ordered stream of simchas and events for the home screen, so the client
-- makes a single query instead of merging two lists and sorting them itself.
create or replace view feed as
  select 'simcha'::text as kind,
         s.id,
         s.type::text   as subtype,
         s.occurred_on  as on_date,
         s.person_id,
         s.staff_id,
         coalesce(pe.first_name || ' ' || pe.last_name, st.name) as subject_name,
         s.spouse_name  as detail,
         s.note,
         s.created_at
    from simchas s
    left join people pe on pe.id = s.person_id
    left join staff  st on st.id = s.staff_id
  union all
  select 'event',
         e.id,
         e.type::text,
         e.starts_on,
         null, null,
         e.name,
         e.location,
         e.description,
         e.created_at
    from events e
   where e.on_feed;

alter view feed set (security_invoker = on);
alter view person_last_contact set (security_invoker = on);

-- Views do not inherit the grants their underlying tables have, so without this
-- a signed-in user gets "permission denied for view feed". Row visibility is
-- still decided by the tables' own policies, because both views are
-- security_invoker.
grant select on feed to authenticated;
grant select on person_last_contact to authenticated;
