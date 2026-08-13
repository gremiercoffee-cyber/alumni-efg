import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

/**
 * Simcha types, and how they read on the feed.
 *
 * A marriage is three separate reports, not one. When a man gets engaged nobody
 * knows the wedding date yet -- it arrives weeks or months later and is its own
 * piece of news. That gap is why the old Apps Script could only remind about
 * weddings whose date someone had already gone back and typed in.
 */

export type SimchaType =
  | 'engagement' | 'wedding_scheduled' | 'wedding' | 'birth' | 'bar_mitzvah'
  | 'child_engagement' | 'child_wedding_scheduled' | 'child_wedding'
  | 'grandchild_birth' | 'other'
  // Not simchas, but reported the same way and shown in the same feed.
  | 'visit_israel' | 'visit_came' | 'visit_stayed';

/**
 * How a simcha reads, given whether its date has passed.
 *
 * A wedding row carries the wedding date, which is usually in the future when
 * it is first recorded -- so the tense has to follow the date. Saying "got
 * married" about a wedding four days from now is simply wrong, and it was.
 *
 * Engagements and births are announced after the fact, so they are always past.
 */
const PAST: Record<string, string> = {
  engagement: ' got engaged',
  wedding_scheduled: "'s wedding date is set",
  wedding: ' got married',
  birth: ' had a baby',
  bar_mitzvah: ' made a bar mitzvah',
  child_engagement: "'s child got engaged",
  child_wedding_scheduled: "'s child's wedding date is set",
  child_wedding: "'s child got married",
  grandchild_birth: ' has a new grandchild',
  other: ' has a simcha',
  shabbaton: '',
  dinner: '',
  israel_expected: ' is coming to Israel',
  israel_here: ' was in Israel',
  visit_expected: ' is coming to yeshiva',
  visit_staying_expected: ' is coming to stay in yeshiva',
  visit_came: ' came to yeshiva',
  visit_stayed: ' stayed in yeshiva',
};

/** Only the ones whose date can legitimately be ahead of us. */
const FUTURE: Record<string, string> = {
  wedding: ' is getting married',
  child_wedding: "'s child is getting married",
  other: ' has a simcha coming up',
};

/**
 * `days` is the offset from today: negative is past, 0 is today, positive is
 * ahead. Callers with no date should pass a negative number.
 */
export function labelFor(subtype: string, days: number): string {
  if (days > 0 && FUTURE[subtype]) return FUTURE[subtype];
  if (days === 0 && subtype === 'wedding') return ' is getting married today';
  if (days === 0 && subtype === 'child_wedding') return "'s child is getting married today";
  return PAST[subtype] ?? '';
}

/**
 * Past-tense forms, for places with no date in hand -- the admin queue, mostly.
 * Prefer labelFor wherever a date is available.
 */
export const SIMCHA_LABEL: Record<string, string> = PAST;

/**
 * A distinct glyph and colour per simcha, so the type reads before the words do.
 * MaterialCommunityIcons names, drawn from the font Expo already ships.
 */
export const SIMCHA_VISUAL: Record<string, { icon: string; tint: string }> = {
  engagement: { icon: 'ring', tint: '#ff9ac4' },
  wedding: { icon: 'party-popper', tint: '#2fe0d2' },
  birth: { icon: 'baby-carriage', tint: '#ffd166' },
  bar_mitzvah: { icon: 'book-open-variant', tint: '#a99bff' },
  child_engagement: { icon: 'ring', tint: '#ff9ac4' },
  child_wedding: { icon: 'party-popper', tint: '#2fe0d2' },
  grandchild_birth: { icon: 'baby-face-outline', tint: '#ffd166' },
  other: { icon: 'star-four-points', tint: '#b9cbee' },
  shabbaton: { icon: 'calendar-star', tint: '#6fa8ff' },
  dinner: { icon: 'silverware-fork-knife', tint: '#6fa8ff' },
  israel_expected: { icon: 'airplane', tint: '#7ee8c0' },
  israel_here: { icon: 'airplane-landing', tint: '#7ee8c0' },
  visit_expected: { icon: 'door-open', tint: '#9fd0ff' },
  visit_staying_expected: { icon: 'bed-outline', tint: '#9fd0ff' },
  visit_came: { icon: 'door-open', tint: '#9fd0ff' },
  visit_stayed: { icon: 'bed-outline', tint: '#9fd0ff' },
};

export const visualFor = (subtype: string) =>
  SIMCHA_VISUAL[subtype] ?? { icon: 'calendar', tint: '#b9cbee' };

export const ALUMNUS_TYPES: [SimchaType, string][] = [
  ['visit_israel', 'Coming to Israel'],
  ['visit_came', 'Visiting yeshiva'],
  ['visit_stayed', 'Staying in yeshiva'],
  ['engagement', 'Got engaged'],
  ['wedding_scheduled', 'Wedding date set'],
  ['wedding', 'Got married'],
  ['birth', 'Had a child'],
  ['bar_mitzvah', 'Made a bar mitzvah'],
  ['other', 'Something else'],
];

export const REBBE_TYPES: [SimchaType, string][] = [
  ['child_engagement', 'Child got engaged'],
  ['child_wedding_scheduled', "Child's wedding date set"],
  ['child_wedding', 'Child got married'],
  ['birth', 'Had a child'],
  ['grandchild_birth', 'New grandchild'],
  ['bar_mitzvah', 'Made a bar mitzvah'],
  ['other', 'Something else'],
];

/** These two are meaningless without the date -- it is the whole point of them. */
export const NEEDS_DATE: SimchaType[] = ['wedding_scheduled', 'child_wedding_scheduled'];

/**
 * Visits are observations, not announcements. Anyone approved records one
 * directly and nothing is sent -- making a rebbe wait for approval to note
 * "he stayed over last Shabbos" would simply mean it never gets noted.
 */
export const VISIT_TYPES: SimchaType[] = ['visit_israel', 'visit_came', 'visit_stayed'];
export const isVisit = (t: string) => (VISIT_TYPES as string[]).includes(t);

/**
 * A stay has to say how long. Without it the bed calendar cannot answer
 * "who is here on Tuesday", which is the whole point of tracking stays.
 */
export const NEEDS_SPAN: SimchaType[] = ['visit_stayed'];
export const needsSpan = (t: string) => (NEEDS_SPAN as string[]).includes(t);

export type FeedItem = {
  kind: string;
  id: number;
  subtype: string;
  on_date: string | null;
  person_id: number | null;
  staff_id: number | null;
  subject_name: string | null;
  detail: string | null;
  note: string | null;
  created_at: string;
};

/**
 * The feed, as it was last time the app ran.
 *
 * Home is the first thing anyone sees, and on mobile data the round trip is
 * long enough to read as the app being broken. The cached copy paints
 * immediately and the live one replaces it a moment later -- a slightly stale
 * feed for half a second beats an empty one for three.
 *
 * Deliberately only the feed. The directory is ten times the size and nothing
 * on this screen falls over without it: the filters and the stat row simply
 * appear when it arrives.
 */
const FEED_CACHE = 'feed:v1';

export async function cachedFeed(): Promise<FeedItem[] | null> {
  try {
    const raw = await AsyncStorage.getItem(FEED_CACHE);
    return raw ? (JSON.parse(raw) as FeedItem[]) : null;
  } catch {
    return null;
  }
}

export async function loadFeed(monthsBack = 24): Promise<FeedItem[]> {
  const from = new Date();
  from.setMonth(from.getMonth() - monthsBack);
  const { data, error } = await supabase
    .from('feed')
    .select('*')
    .gte('on_date', from.toISOString().slice(0, 10))
    .order('on_date', { ascending: false });
  if (error) throw error;
  const items = (data ?? []) as FeedItem[];
  // Fire and forget: failing to cache must never fail the load.
  void AsyncStorage.setItem(FEED_CACHE, JSON.stringify(items)).catch(() => {});
  return items;
}

/**
 * File a report.
 *
 * An admin writes the simcha directly and that is what sends anything outward.
 * Everyone else files a claim, which notifies the admin exactly once per person
 * per type -- ten rebbeim reporting the same engagement is one notification, and
 * the database enforces that rather than the client.
 */
export async function reportSimcha(opts: {
  isAdmin: boolean;
  personId: number | null;
  staffId: number | null;
  type: SimchaType;
  date: string | null;
  until?: string | null;
  note?: string;
}): Promise<{ committed: boolean }> {
  const { isAdmin, personId, staffId, type, date, until, note } = opts;

  if (isVisit(type)) {
    if (!personId) throw new Error('a visit belongs to an alumnus');
    const on = date ?? new Date().toISOString().slice(0, 10);
    const lastNight = type === 'visit_stayed' ? (until || on) : null;
    if (type === 'visit_stayed' && lastNight && lastNight < on) {
      throw new Error('the last night cannot be before he arrives');
    }

    const { error } = await supabase.from('visits').insert({
      person_id: personId,
      visited_on: on,
      until_date: lastNight,
      kind: type === 'visit_israel' ? 'israel' : 'yeshiva',
      overnight: type === 'visit_stayed',
      // Derived from the date rather than asked for separately: a date ahead of
      // us is a plan, one behind is a record, and the feed re-reads it once the
      // day passes.
      expected: on > new Date().toISOString().slice(0, 10),
      note: note ?? null,
    });
    if (error) throw error;
    return { committed: true };
  }

  if (isAdmin) {
    const { error } = await supabase.from('simchas').insert({
      person_id: personId,
      staff_id: staffId,
      type: type as never,
      occurred_on: date,
      wedding_on: NEEDS_DATE.includes(type) ? date : null,
      note: note ?? null,
    });
    if (error) throw error;
    return { committed: true };
  }

  // Upsert, so a second reporter attaches to the existing claim rather than
  // failing on the unique index that makes the one-notification rule work.
  const { data: existing } = await supabase
    .from('claims')
    .select('id')
    .eq('type', type as never)
    .eq(personId ? 'person_id' : 'staff_id', (personId ?? staffId) as number)
    .maybeSingle();

  let claimId = existing?.id;
  if (!claimId) {
    const { data, error } = await supabase
      .from('claims')
      .insert({
        person_id: personId,
        staff_id: staffId,
        type: type as never,
        payload: date ? { date } : {},
      })
      .select('id')
      .single();
    if (error) throw error;
    claimId = data.id;
  }

  const { data: me } = await supabase.auth.getUser();
  const { error: repErr } = await supabase.from('claim_reports').insert({
    claim_id: claimId,
    reported_by: me.user?.id ?? null,
    note: note ?? null,
  });
  if (repErr) throw repErr;
  return { committed: false };
}
