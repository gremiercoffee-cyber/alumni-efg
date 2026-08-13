-- A wedding with a date is a wedding, not a separate kind of thing.
--
-- The three-part story is still right: engaged, then a date arrives, then the
-- day comes. But the middle one was being stored as its own type,
-- 'wedding_scheduled', and that type is excluded from the feed -- so recording
-- the date cleared the man out of To Do and put him nowhere. He simply
-- vanished.
--
-- The rows that work already do it the other way: a 'wedding' row dated in the
-- future, which reads as "is getting married" on the feed because the tense
-- follows the date, and becomes "send the Mazal Tov" on the day. One row that
-- ages into the right meaning, rather than two rows describing one wedding.
--
-- So the scheduling types are retired as things to create. They stay in the
-- enum because history references them.

-- Convert the strays. Guarded: only where nothing else already records the
-- wedding for that man, so a scheduled row that was later followed by a real
-- one is left alone rather than becoming a duplicate.
update simchas s
   set type = 'wedding'
 where s.type = 'wedding_scheduled'
   and not exists (
     select 1 from simchas w
      where w.type = 'wedding'
        and w.id <> s.id
        and (
          (s.person_id is not null and w.person_id = s.person_id)
          or (s.staff_id is not null and w.staff_id = s.staff_id)
        )
   );

update simchas s
   set type = 'child_wedding'
 where s.type = 'child_wedding_scheduled'
   and not exists (
     select 1 from simchas w
      where w.type = 'child_wedding'
        and w.id <> s.id
        and (
          (s.person_id is not null and w.person_id = s.person_id)
          or (s.staff_id is not null and w.staff_id = s.staff_id)
        )
   );

-- A converted row inherits announced_at = null, and its date may be in the
-- past if someone recorded a wedding that had already happened. That is
-- correct: it belongs in "send the Mazal Tov", which is where it now lands.

comment on type simcha_type is
  'wedding_scheduled and child_wedding_scheduled are historical. A dated '
  'wedding is a wedding row dated in the future -- it reads as "is getting '
  'married" until the day and as an announcement to send afterwards.';
