import type { AlumniRecord } from './alumni';

/**
 * The pre-filled WhatsApp announcement.
 *
 * Keeps the wording of the old Apps Script, which is what people are used to
 * reading: "Mazal tov to alumnus <name> (<years>) on his wedding!"
 *
 * The years are the span he was in the programme, written out in full --
 * "2018-2020" rather than the abbreviated "2018-20" used in list rows, because
 * this is read as a sentence by people outside the app.
 */

const OCCASION: Record<string, string> = {
  engagement: 'on his engagement',
  wedding: 'on his wedding',
  birth: 'on the birth of his child',
  bar_mitzvah: "on his son's bar mitzvah",
  child_engagement: "on his child's engagement",
  child_wedding: "on his child's wedding",
  grandchild_birth: 'on the birth of his grandchild',
  other: 'on his simcha',
};

/** '2018-2019' + '2019-2020' -> '2018-2020'; a single year stays as it is. */
export function programSpan(years: string[]): string | null {
  if (!years.length) return null;
  const sorted = [...years].sort();
  const first = sorted[0].split('-')[0];
  const last = sorted[sorted.length - 1].split('-')[1] ?? first;
  return first === last ? first : `${first}-${last}`;
}

export function announcementFor(
  subjectName: string,
  subtype: string,
  person: AlumniRecord | null,
  isStaff: boolean,
): string {
  const occasion = OCCASION[subtype] ?? 'on his simcha';

  // A rebbe is not an alumnus, so he does not get called one and has no years.
  if (isStaff) return `Mazal tov to ${subjectName} ${occasion}!`;

  const span = person ? programSpan(person.years) : null;
  const who = span ? `${subjectName} (${span})` : subjectName;
  return `Mazal tov to alumnus ${who} ${occasion}!`;
}
