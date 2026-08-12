-- Signing in is not the same as being allowed in.
--
-- Google OAuth is configured as an External app, which means any Google account
-- on earth can complete a sign-in -- not only aish.edu addresses. Every read
-- policy so far grants access to `authenticated`, so without this a stranger
-- could sign in with a personal Gmail and read all 723 alumni: phone numbers,
-- home addresses, parents' contact details.
--
-- So a new account now lands in 'pending', which grants nothing. An admin has to
-- promote it. The only exception is an address on the admin list, which is how
-- the first account bootstraps itself.

alter type user_role add value if not exists 'pending';
