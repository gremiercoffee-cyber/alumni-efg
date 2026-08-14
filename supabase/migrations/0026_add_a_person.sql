-- Somewhere for a new alumnus to come from.
--
-- people.id is the AlumniID off the original sheet, deliberately preserved so
-- the 1,646 answers the rebbeim had already given stayed attached to the right
-- men. That left it with no default, so the app could edit anybody and create
-- nobody -- a man who turns up now simply could not be added.
--
-- The sequence starts at 10000, well clear of the imported ids, so a new person
-- can never take an id that a later import of the old sheets would want. It
-- also makes app-created records obvious at a glance.

create sequence if not exists people_id_seq;

select setval(
  'people_id_seq',
  greatest((select coalesce(max(id), 0) from people), 9999)
);

alter sequence people_id_seq owned by people.id;
alter table people alter column id set default nextval('people_id_seq');

-- Inserting is already admin-only through people_admin_write. Nothing else to
-- open up: a rebbe who meets someone new tells the admin, the same as with
-- every other fact that is not an observation.
