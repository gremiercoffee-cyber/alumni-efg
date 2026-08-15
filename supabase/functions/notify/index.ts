import { createClient } from 'jsr:@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

/**
 * The daily run: work out what is owed today, email it, push it.
 *
 * Run once each morning. Everything it does is idempotent -- the outbox holds
 * one row per (kind, subject), so running it twice in a day sends nothing
 * twice, and a retry after a half-failure picks up only what did not go.
 *
 * Every channel is off by default and each is a separate switch, so weddings
 * can go live while birthdays are still being filled in. With
 * app_settings.list_email empty, nothing is emailed at all whatever the
 * switches say.
 *
 * Call with {"dry_run": true} to see exactly what would be sent, delivering
 * nothing and marking nothing as sent.
 */

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const esc = (s: string) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const SITE = Deno.env.get('SITE_URL') ?? 'https://efg-alumni.gremiercoffee.workers.dev';

function shell(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#0a1733;padding:24px 12px;">
  <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#0f1f42;border-radius:14px;padding:22px;">
    <tr><td>
      <div style="font:700 13px Helvetica,Arial,sans-serif;color:#fff;">efg<span style="color:#2fe0d2;">@</span>aish</div>
      <div style="font:700 20px Helvetica,Arial,sans-serif;color:#fff;padding-top:14px;">${title}</div>
      ${body}
      <div style="font:400 12px Helvetica,Arial,sans-serif;color:#8fa6cf;padding-top:18px;">
        <a href="${SITE}" style="color:#8fa6cf;">Open the alumni app</a>
      </div>
    </td></tr></table></body></html>`;
}

const para = (t: string) =>
  `<div style="font:400 15px Helvetica,Arial,sans-serif;color:#b9cbee;padding-top:8px;line-height:22px;">${t}</div>`;

type Settings = {
  emails_enabled: boolean;
  wedding_emails_enabled: boolean;
  birthday_emails_enabled: boolean;
  push_enabled: boolean;
  list_email: string | null;
  redirect_all_to: string | null;
  from_name: string;
  from_email: string;
};

async function sendMail(to: string, subject: string, html: string) {
  const client = new SMTPClient({
    connection: {
      hostname: 'smtp.gmail.com',
      port: 465,
      tls: true,
      auth: {
        username: Deno.env.get('GMAIL_USER')!,
        // An App Password, not the account password. The account password will
        // not authenticate with 2-Step Verification on, and 2-Step Verification
        // is required before an App Password can be created at all.
        password: Deno.env.get('GMAIL_APP_PASSWORD')!,
      },
    },
  });
  try {
    const { data: s } = await admin.from('app_settings').select('from_name, from_email').single();
    await client.send({
      from: `${s!.from_name} <${s!.from_email}>`,
      to,
      subject,
      html,
    });
  } finally {
    await client.close();
  }
}

/** Expo takes up to 100 tokens per request and answers per message. */
async function push(tokens: string[], title: string, body: string) {
  for (let i = 0; i < tokens.length; i += 100) {
    const batch = tokens.slice(i, i + 100).map((to) => ({
      to,
      title,
      body,
      sound: 'default',
    }));
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(batch),
    });
  }
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
  const opts = await req.json().catch(() => ({}));
  const dryRun = opts?.dry_run === true;

  const { data: settings } = await admin.from('app_settings').select('*').single();
  const s = settings as Settings;

  // Fill the outbox first, so a same-day run after a wedding is recorded picks
  // it up rather than waiting until tomorrow.
  const { data: queued } = await admin.rpc('queue_due_notifications');

  const { data: due } = await admin
    .from('notification_outbox')
    .select('*')
    .is('sent_at', null)
    .in('kind', ['wedding_week_before', 'wedding_today', 'birthday_today'])
    .order('created_at');

  const { data: tokenRows } = await admin.from('push_tokens').select('token');
  const tokens = (tokenRows ?? []).map((t: { token: string }) => t.token);

  const done: unknown[] = [];

  for (const row of due ?? []) {
    const { data: person } = await admin
      .from('people')
      .select('first_name, last_name')
      .eq('id', row.person_id)
      .maybeSingle();
    const name = person ? `${person.first_name} ${person.last_name}` : 'An alumnus';

    let subject = '';
    let title = '';
    let body = '';

    if (row.kind === 'wedding_week_before') {
      subject = `${name} is getting married next week`;
      title = 'A wedding next week';
      body = `${name} is getting married on ${row.payload?.on}.`;
    } else if (row.kind === 'wedding_today') {
      subject = `Mazal tov — ${name} is getting married today`;
      title = 'Mazal tov';
      body = `${name} is getting married today.`;
    } else {
      subject = `${name}'s birthday is today`;
      title = 'A birthday today';
      body = `It's ${name}'s birthday today.`;
    }

    const isBirthday = row.kind === 'birthday_today';
    const emailOn =
      s.emails_enabled &&
      (isBirthday ? s.birthday_emails_enabled : s.wedding_emails_enabled);
    const to = s.redirect_all_to || s.list_email;

    const plan = {
      kind: row.kind,
      who: name,
      email_to: emailOn && to ? to : null,
      push_to: s.push_enabled ? tokens.length : 0,
    };
    done.push(plan);

    if (dryRun) continue;

    let failed: string | null = null;
    try {
      if (emailOn && to) await sendMail(to, subject, shell(title, para(body)));
      if (s.push_enabled && tokens.length) await push(tokens, title, body);
    } catch (e) {
      failed = e instanceof Error ? e.message : String(e);
    }

    // Only stamped when something actually went out. A row nobody was
    // configured to receive stays pending, so turning a switch on later
    // delivers it rather than silently skipping it.
    if (!failed && ((emailOn && to) || (s.push_enabled && tokens.length))) {
      await admin
        .from('notification_outbox')
        .update({ sent_at: new Date().toISOString() })
        .eq('id', row.id);
    } else if (failed) {
      await admin
        .from('notification_outbox')
        .update({ attempts: (row.attempts ?? 0) + 1, last_error: failed })
        .eq('id', row.id);
    }
  }

  // Sunday: everyone with a birthday in the next 30 days, in one email.
  let birthdayDigest: unknown = null;
  const isSunday = new Date().getUTCDay() === 0;
  if (isSunday || opts?.force_birthday_digest) {
    const { data: soon } = await admin
      .from('upcoming_birthdays')
      .select('*')
      .order('next_on');

    if (soon?.length) {
      const rows = soon
        .map(
          (b: { name: string; next_on: string; turning: number }) =>
            `<tr><td style="padding:9px 0;border-bottom:1px solid #1e2f52;">
               <span style="font:600 15px Helvetica,Arial,sans-serif;color:#fff;">${esc(b.name)}</span>
               <span style="font:400 13px Helvetica,Arial,sans-serif;color:#b9cbee;"> — ${b.next_on}${
                 b.turning ? `, turning ${b.turning}` : ''
               }</span>
             </td></tr>`,
        )
        .join('');
      const html = shell(
        'Birthdays coming up',
        `<table role="presentation" width="100%" style="padding-top:10px;">${rows}</table>`,
      );
      const to = s.redirect_all_to || s.list_email;
      birthdayDigest = { count: soon.length, to: s.birthday_emails_enabled && to ? to : null };
      if (!dryRun && s.emails_enabled && s.birthday_emails_enabled && to) {
        await sendMail(to, 'Birthdays coming up', html);
      }
    }
  }

  return Response.json({
    dry_run: dryRun,
    queued,
    considered: (due ?? []).length,
    emails_on: s.emails_enabled,
    list_email: s.list_email,
    push_devices: tokens.length,
    items: done,
    birthday_digest: birthdayDigest,
  });
});
