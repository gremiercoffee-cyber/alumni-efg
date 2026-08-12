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
  | 'grandchild_birth' | 'other';

/**
 * Reads as "<name><label>". Possessive labels open with an apostrophe.
 *
 * wedding_scheduled is here for the admin queue, not the feed -- the `feed` view
 * filters those out. A date being set is bookkeeping, and showing it would double
 * every wedding into two near-identical entries.
 */
export const SIMCHA_LABEL: Record<string, string> = {
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
};

export const SIMCHA_ICON: Record<string, string> = {
  engagement: '\u{1F48D}',
  wedding_scheduled: '\u{1F4C5}',
  wedding: '\u{1F389}',
  birth: '\u{1F476}',
  bar_mitzvah: '\u{1F4D6}',
  child_engagement: '\u{1F48D}',
  child_wedding_scheduled: '\u{1F4C5}',
  child_wedding: '\u{1F389}',
  grandchild_birth: '\u{1F476}',
  other: '\u{2728}',
  shabbaton: '\u{1F56F}',
  dinner: '\u{1F37D}',
};

export const ALUMNUS_TYPES: [SimchaType, string][] = [
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

export async function loadFeed(monthsBack = 24): Promise<FeedItem[]> {
  const from = new Date();
  from.setMonth(from.getMonth() - monthsBack);
  const { data, error } = await supabase
    .from('feed')
    .select('*')
    .gte('on_date', from.toISOString().slice(0, 10))
    .order('on_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as FeedItem[];
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
  note?: string;
}): Promise<{ committed: boolean }> {
  const { isAdmin, personId, staffId, type, date, note } = opts;

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
