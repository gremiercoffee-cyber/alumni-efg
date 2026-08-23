-- Re-run the chinuch seed.
--
-- 0038 shipped this same UPDATE, but the live table has nobody flagged -- the
-- flag column exists, so the DDL ran, but the seed did not take (0038 was pasted
-- by hand during a CLI outage, most likely without its tail). Eight occupations
-- match the pattern today; this flags them and is safe to run again, since it
-- only ever sets the flag on and copies the existing occupation as the role.
update people set in_chinuch = true, chinuch_role = occupation
 where in_chinuch = false
   and occupation is not null
   and occupation ~* '(kiruv|chinuch|rebbe|melamed|teacher|teaches|jewish studies|kollel)'
   and occupation !~* '(real estate|deli|ice cream)';
