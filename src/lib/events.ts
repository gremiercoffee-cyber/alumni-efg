import { supabase } from './supabase';

/**
 * Events, and the RSVPs that come back from a shared link.
 *
 * The link is the whole point. Getting 200 men to answer a WhatsApp is a week of
 * chasing; getting them to tap a link and type an email is not. What arrives
 * back is only ever a promise to turn up -- nothing here notifies anybody.
 */

export type EventRow = {
  id: number;
  name: string;
  type: string;
  year: number;
  starts_on: string | null;
  ends_on: string | null;
  location: string | null;
  description: string | null;
  on_feed: boolean;
  rsvp_open: boolean;
  rsvp_token: string;
  coming: number;
  heads: number;
  unmatched: number;
  via_link: number;
};

export type RosterRow = {
  id: number;
  event_id: number;
  person_id: number | null;
  source: string;
  guests: number;
  rsvped_at: string | null;
  note: string | null;
  display_name: string;
  email: string | null;
  phone: string | null;
  unmatched: boolean;
};

export const EVENT_TYPES: [string, string][] = [
  ['shabbaton', 'Shabbaton'],
  ['dinner', 'Dinner'],
  ['other', 'Something else'],
];

/**
 * Where the RSVP link points.
 *
 * On the web the page serving the app is the page serving the form, so the
 * origin is correct by definition and wins outright -- put a custom domain on
 * this and the website starts handing out links to the new host on its own.
 * Preferring the configured value would mean the site kept advertising the old
 * one until someone remembered to edit .env.
 *
 * The APK has no origin, so there it has to be configured, and that is the only
 * thing EXPO_PUBLIC_SITE_URL is for. A link built against the wrong host looks
 * fine and goes nowhere, which is the worst kind of broken -- so when it is
 * unset this returns null and the screen says so rather than inventing a host.
 */
export function siteOrigin(): string | null {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  const configured = process.env.EXPO_PUBLIC_SITE_URL;
  return configured ? configured.replace(/\/+$/, '') : null;
}

export function rsvpLink(token: string): string | null {
  const origin = siteOrigin();
  return origin ? `${origin}/rsvp/${token}` : null;
}

/** The token out of /rsvp/<token>, or null if this is a normal visit. */
export function rsvpTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const m = /^\/rsvp\/([a-f0-9]{8,})\/?$/i.exec(window.location.pathname);
  return m ? m[1] : null;
}

export async function loadEvents(): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from('event_summary')
    .select('*')
    .order('starts_on', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as EventRow[];
}

export async function loadRoster(eventId: number): Promise<RosterRow[]> {
  const { data, error } = await supabase
    .from('event_roster')
    .select('*')
    .eq('event_id', eventId);
  if (error) throw error;
  // Unmatched first: they are the rows that need a decision. Everything else
  // alphabetically, because that is how a guest list gets read at a door.
  return ((data ?? []) as RosterRow[]).sort((a, b) =>
    a.unmatched === b.unmatched
      ? a.display_name.localeCompare(b.display_name)
      : a.unmatched ? -1 : 1,
  );
}

/**
 * The message that goes out with the link.
 *
 * Written to be forwarded: it has to make sense to a man who gets it third-hand
 * in a group with no idea who sent it.
 */
export function inviteText(ev: EventRow): string {
  const when = ev.starts_on
    ? new Date(ev.starts_on + 'T00:00:00').toLocaleDateString(undefined, {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    : null;
  const link = rsvpLink(ev.rsvp_token);
  return [
    `${ev.name} — EFG@Aish alumni`,
    when ? when : null,
    ev.location ? ev.location : null,
    ev.description ? '' : null,
    ev.description ? ev.description : null,
    '',
    link ? `Let us know if you are coming: ${link}` : 'Let us know if you are coming.',
  ]
    .filter((l) => l !== null)
    .join('\n');
}
