-- Where the wedding is. Set alongside the date -- once the date is known the
-- next question is always where, and the announcement reads better for it.
alter table simchas add column if not exists venue text;

comment on column simchas.venue is
  'Where the wedding is being held. Set when the date is set; shown on the '
  'simcha and folded into the Mazal Tov.';
