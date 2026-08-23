-- Post-Aish: not everyone goes to college. Some stay in yeshiva, some work, some
-- go to the army. College already exists; this adds yeshiva beside it so "where
-- did he go after" has a home for the ones still learning.
alter table people add column if not exists yeshiva text;

comment on column people.yeshiva is
  'Yeshiva he went to after Aish, for the guys who kept learning rather than '
  'going straight to college. Sits in the Post-Aish group beside college.';

-- Make it editable like the rest of the post-Aish fields.
create or replace function editable_person_fields() returns text[]
language sql immutable as $$
  select array[
    'first_name', 'last_name', 'nickname', 'email', 'phone',
    'street_address', 'city', 'state', 'zip_code', 'country',
    'high_school', 'college', 'yeshiva', 'grad_school', 'occupation',
    'marital_status', 'spouse_name', 'notes', 'birthday'
  ];
$$;
