-- Simchas for staff as well as alumni, richer simcha types, events on the feed,
-- and automatic logging of who contacted whom.

-- ---------------------------------------------------------------------------
-- a simcha can belong to a rebbe, not just an alumnus
-- ---------------------------------------------------------------------------

-- A rebbe's simcha is usually about his child rather than himself, so the type
-- list has to say whose. 'birth' stays as-is for an alumnus having a baby.
alter type simcha_type add value if not exists 'child_engagement';
alter type simcha_type add value if not exists 'child_wedding';
alter type simcha_type add value if not exists 'grandchild_birth';

alter type claim_type add value if not exists 'child_engagement';
alter type claim_type add value if not exists 'child_wedding';
alter type claim_type add value if not exists 'grandchild_birth';
