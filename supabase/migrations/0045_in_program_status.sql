-- Currently in the program, vs an alumnus.
--
-- Until now "current student" was guessed -- enrolled this year as Shana Alef.
-- That was wrong twice over: it missed the Shana Bet guys who are still here,
-- and it could not survive a year rolling over. This makes it an explicit fact
-- the admin sets: on while a man is learning, off once he has left. Everything
-- that means "alumni only" reads this instead of guessing.
--
-- Default false: the database is an alumni database, so a man is an alumnus
-- unless someone says he is still in. The admin turns it on for the current
-- cohort (this year's Shana Alef and the returning Shana Bet), and flips it off
-- at year end for those who graduate.
alter table people add column if not exists in_program boolean not null default false;

comment on column people.in_program is
  'True while he is currently learning in the program; false once he is an '
  'alumnus. Set by the admin. What "alumni only" reads, instead of guessing '
  'from enrollment year.';
