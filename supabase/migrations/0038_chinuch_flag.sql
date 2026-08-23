-- A man in chinuch or kiruv, flagged so it reads at a glance.
--
-- Two columns, not one. A boolean alone answers "is he in chinuch" but not
-- "doing what", and the second question is the one a rebbe actually wants when
-- he sees the name -- Rebbe at HALB is worth more than a checkmark. The app
-- requires the text when the flag is set, but the column allows null so an
-- import or an admin fixing data is never blocked by it.

alter table people
  add column if not exists in_chinuch boolean not null default false,
  add column if not exists chinuch_role text;

comment on column people.chinuch_role is
  'What he does in chinuch/kiruv, in a few words -- "Rebbe at HALB", "campus '
  'kiruv, Maryland". Shown beside his name wherever he appears.';

-- Any approved user may set it directly, no review. It is the kind of thing a
-- rebbe simply knows about his own guys, like claiming them -- and unlike an
-- address or a wedding date, a wrong chinuch flag misinforms nobody outside the
-- app and is corrected in a tap.
--
-- Scoped to exactly these two columns. The existing admin-write policy still
-- governs everything else on people; this adds a narrow lane beside it rather
-- than opening the whole row.
create or replace function set_chinuch(p_person_id integer, p_in boolean, p_role text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_approved() then
    raise exception 'not allowed';
  end if;
  if p_in and coalesce(trim(p_role), '') = '' then
    raise exception 'say what he does';
  end if;
  update people
     set in_chinuch = p_in,
         chinuch_role = case when p_in then trim(p_role) else null end,
         updated_at = now()
   where id = p_person_id;
end $$;

revoke all on function set_chinuch(integer, boolean, text) from public;
grant execute on function set_chinuch(integer, boolean, text) to authenticated;

-- Seed it from the report, so the flag does not start empty on day one. Only
-- the clear cases -- the eleven the scrape put in "in the field" -- and each
-- keeps whatever the sheet already said as its role text.
update people set in_chinuch = true, chinuch_role = occupation
 where id in (
   select p.id from people p
    where p.occupation is not null
      and p.occupation ~* '(kiruv|chinuch|rebbe|melamed|teacher|teaches|jewish studies|kollel)'
      and p.occupation !~* '(real estate|deli|ice cream)'
 );
