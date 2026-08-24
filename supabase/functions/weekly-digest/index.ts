import { createClient } from 'jsr:@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

/**
 * The weekly five.
 *
 * Every rebbe with alumni gets five of them, chosen at random, and never the
 * same man twice until he has been through the whole list. The picking and the
 * no-repeats rule live in pick_weekly_five() in the database, because the rule
 * is about state -- who has already been sent -- and doing it here would mean
 * reading it out and writing it back across the network.
 *
 * NOTHING IS SENT while app_settings.emails_enabled is false. Every digest is
 * still built and recorded, so the whole thing can be watched working for weeks
 * before a single rebbe is emailed. That is the deliberate default.
 *
 * Run weekly by pg_cron. Also runnable by hand with {"dry_run": true}, which
 * builds and returns the digests without recording or sending anything.
 */

type Person = {
  id: number;
  first_name: string;
  last_name: string;
  nickname?: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  occupation: string | null;
  marital_status: string | null;
  last_contacted_on?: string | null;
};

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A man's card. Enough to know who he is and reach him without opening the app. */
function card(p: Person, siteUrl: string) {
  const where = [p.city, p.country].filter(Boolean).join(', ');
  const facts = [p.occupation, where, p.marital_status].filter(Boolean).join(' · ');
  const digits = (p.phone ?? '').replace(/\D/g, '');

  return `
  <tr><td style="padding:14px 0;border-bottom:1px solid #1e2f52;">
    <div style="font:600 16px Helvetica,Arial,sans-serif;color:#ffffff;">
      ${esc((p.nickname && p.nickname.trim()) || p.first_name)} ${esc(p.last_name)}
    </div>
    ${facts ? `<div style="font:400 13px Helvetica,Arial,sans-serif;color:#b9cbee;padding-top:2px;">${esc(facts)}</div>` : ''}
    <div style="padding-top:8px;">
      ${digits ? `<a href="https://wa.me/${digits}" style="font:600 13px Helvetica,Arial,sans-serif;color:#2fe0d2;text-decoration:none;padding-right:14px;">WhatsApp</a>` : ''}
      ${p.email ? `<a href="mailto:${esc(p.email)}" style="font:600 13px Helvetica,Arial,sans-serif;color:#2fe0d2;text-decoration:none;padding-right:14px;">Email</a>` : ''}
      <a href="${siteUrl}" style="font:600 13px Helvetica,Arial,sans-serif;color:#8fa6cf;text-decoration:none;">Open in the app</a>
    </div>
  </td></tr>`;
}

function digestHtml(staffName: string, people: Person[], siteUrl: string) {
  return `<!doctype html>
<html><body style="margin:0;background:#0a1733;padding:24px 12px;">
  <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#0f1f42;border-radius:14px;padding:22px;">
    <tr><td>
      <div style="font:700 13px Helvetica,Arial,sans-serif;color:#ffffff;letter-spacing:.5px;">
        efg<span style="color:#2fe0d2;">@</span>aish
      </div>
      <div style="font:700 21px Helvetica,Arial,sans-serif;color:#ffffff;padding-top:14px;">
        Five of your alumni this week
      </div>
      <div style="font:400 14px Helvetica,Arial,sans-serif;color:#b9cbee;padding-top:6px;line-height:20px;">
        ${esc(staffName)} — a reminder, not a task. Reach out to whichever one you can.
        Nobody comes up twice until you have been through your whole list.
      </div>
      <table role="presentation" width="100%" style="padding-top:8px;">
        ${people.map((p) => card(p, siteUrl)).join('')}
      </table>
      <div style="font:400 12px Helvetica,Arial,sans-serif;color:#8fa6cf;padding-top:16px;line-height:18px;">
        Anything you learn — an engagement, a wedding date, a new number — goes in
        through the app and reaches everyone at once.
      </div>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * Only the scheduler may run this.
 *
 * The function is deployed without JWT checking, because the cron job calls it
 * with no user -- which leaves the URL open to anyone who learns it. Sending is
 * idempotent, so the damage is bounded, but "bounded" is not "none": once mail
 * is switched on, a stranger could decide when the yeshiva emails its alumni.
 */
function authorised(req: Request): boolean {
  const expected = Deno.env.get('CRON_SECRET');
  if (!expected) return true; // Not configured yet; fail open rather than dead.
  return req.headers.get('x-cron-secret') === expected;
}

Deno.serve(async (req) => {
  if (!authorised(req)) {
    return Response.json({ error: 'not authorised' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dry_run === true;

  const { data: settings } = await admin.from('app_settings').select('*').single();
  const siteUrl = Deno.env.get('SITE_URL') ?? 'https://efg-alumni.gremiercoffee.workers.dev';

  // Every rebbe who has anybody, and an address to send to.
  const { data: links, error } = await admin
    .from('rebbe_alumni')
    .select('staff_id, staff_name, email');
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const rebbeim = new Map<number, { name: string; email: string | null }>();
  for (const l of links ?? []) {
    rebbeim.set(l.staff_id, { name: l.staff_name, email: l.email });
  }

  const built: unknown[] = [];

  for (const [staffId, rebbe] of rebbeim) {
    // Dry runs must not consume anyone's rotation, so the picker is only
    // called for real sends.
    let ids: number[] = [];
    if (dryRun) {
      const { data } = await admin
        .from('rebbe_alumni')
        .select('person_id')
        .eq('staff_id', staffId)
        .limit(5);
      ids = (data ?? []).map((r: { person_id: number }) => r.person_id);
    } else {
      const { data } = await admin.rpc('pick_weekly_five', { p_staff_id: staffId });
      ids = (data ?? []).map((r: { person_id: number }) => r.person_id);
    }
    if (!ids.length) continue;

    const { data: people } = await admin
      .from('people')
      .select('id, first_name, last_name, nickname, email, phone, city, country, occupation, marital_status')
      .in('id', ids);

    const html = digestHtml(rebbe.name, (people ?? []) as Person[], siteUrl);
    const to = settings?.redirect_all_to || rebbe.email;

    built.push({ staff_id: staffId, rebbe: rebbe.name, to, count: ids.length });

    if (dryRun || !settings?.emails_enabled) continue;
    if (!to) continue;

    // Gmail, with an App Password. Not the account password -- that will not
    // work with 2-Step Verification on, and 2-Step Verification is required to
    // create an App Password in the first place.
    const client = new SMTPClient({
      connection: {
        hostname: 'smtp.gmail.com',
        port: 465,
        tls: true,
        auth: {
          username: Deno.env.get('GMAIL_USER')!,
          password: Deno.env.get('GMAIL_APP_PASSWORD')!,
        },
      },
    });

    try {
      await client.send({
        from: `${settings.from_name} <${settings.from_email}>`,
        to,
        subject: 'Five of your alumni this week',
        html,
      });
    } catch (e) {
      built[built.length - 1] = {
        ...(built[built.length - 1] as object),
        error: e instanceof Error ? e.message : String(e),
      };
    } finally {
      await client.close();
    }
  }

  return Response.json({
    sending: !!settings?.emails_enabled && !dryRun,
    redirected_to: settings?.redirect_all_to ?? null,
    rebbeim: built.length,
    digests: built,
  });
});
