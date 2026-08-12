-- The app offers a rebbe "Child's wedding date set", but that value was never
-- added to the enum -- I added child_engagement and child_wedding in 0005 and
-- wedding_scheduled in 0007, and missed the one that crosses the two.
--
-- It surfaced when a view named the value, but the real damage would have been
-- worse and quieter: any rebbe choosing that option would have hit an enum error
-- on save, and only after filling the whole form in.

alter type simcha_type add value if not exists 'child_wedding_scheduled';
alter type claim_type  add value if not exists 'child_wedding_scheduled';
