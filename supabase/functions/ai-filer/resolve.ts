/**
 * Turn a spoken name into a person, or into a short list to choose between.
 *
 * The same rules the migration used to fold 743 spreadsheet records into 724
 * people: Hebrew/English equivalences, nicknames, and one-letter typos. Worth
 * having here for the same reason it was worth having there -- the sheet said
 * "Jason Heideman" and "Jason Heidman" for one man, and speech will do worse.
 *
 * Returning several candidates is a feature. There are two unrelated Avi
 * Greens; guessing between them is how a simcha ends up on the wrong record.
 */

export type Person = {
  id: number;
  first_name: string;
  last_name: string;
  nickname: string | null;
  do_not_contact: boolean;
};

export type Candidate = {
  id: number;
  name: string;
  do_not_contact: boolean;
  /** 0 is exact. Higher is a looser match. */
  distance: number;
};

const EQUIV: string[][] = [
  ['joseph', 'yosef', 'yossi', 'joey', 'jo'],
  ['joshua', 'josh', 'yehoshua', 'shua', 'shuey', 'shia'],
  ['jacob', 'yaakov', 'yakov', 'jake', 'koby'],
  ['abraham', 'avraham', 'avrohom', 'avi', 'abe', 'avromi'],
  ['isaac', 'issac', 'yitzchak', 'yitzy'],
  ['david', 'dovid', 'dave', 'duvi'],
  ['aaron', 'aron', 'aharon', 'aahron'],
  ['benjamin', 'ben', 'benny', 'binyamin'],
  ['daniel', 'dan', 'danny', 'dani'],
  ['michael', 'mike', 'micha', 'mikey'],
  ['gabriel', 'gabe', 'gavriel'],
  ['samuel', 'sam', 'shmuel', 'shmulie', 'shmully'],
  ['nathan', 'natan', 'nat', 'nate'],
  ['eliyahu', 'eli', 'elijah', 'eliezer'],
  ['matthew', 'mathew', 'matt', 'matisyahu'],
  ['alexander', 'alex'],
  ['reuben', 'ruben', 'reuven'],
  ['solomon', 'shlomo'],
  ['zev', 'zevi', 'zvi'],
  ['moshe', 'moe', 'mo'],
  ['emanuel', 'manny', 'menachem'],
  ['ezekial', 'ezekiel', 'zeke', 'yechezkel'],
];

const norm = (s: string) =>
  s.normalize('NFKD').toLowerCase().replace(/[^a-z]/g, '');

function lev(a: string, b: string): number {
  if (a === b) return 0;
  if (!a || !b) return Math.max(a.length, b.length);
  let prev = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let i = 1; i <= b.length; i++) {
    const cur = [i];
    for (let j = 1; j <= a.length; j++) {
      cur.push(Math.min(
        prev[j - 1] + (a[j - 1] === b[i - 1] ? 0 : 1),
        cur[j - 1] + 1,
        prev[j] + 1,
      ));
    }
    prev = cur;
  }
  return prev[a.length];
}

function firstNamesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (EQUIV.some((g) => g.includes(a) && g.includes(b))) return true;
  // "Shmuel" against "Shmulie".
  return a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a));
}

export function resolvePerson(
  said: string,
  people: Person[],
  aliases: { person_id: number; alias: string }[],
): Candidate[] {
  const parts = said.replace(/[(),]/g, ' ').split(/\s+/).filter(Boolean);
  if (parts.length === 0) return [];

  const first = norm(parts[0]);
  const last = norm(parts.slice(1).join(''));

  const aliasByPerson = new Map<number, string[]>();
  for (const a of aliases) {
    const list = aliasByPerson.get(a.person_id) ?? [];
    list.push(a.alias);
    aliasByPerson.set(a.person_id, list);
  }

  const scored: Candidate[] = [];
  for (const p of people) {
    const name = `${p.first_name} ${p.last_name}`.trim();
    const labels = [name, ...(aliasByPerson.get(p.id) ?? [])];
    if (p.nickname) labels.push(`${p.nickname} ${p.last_name}`);

    let best = Infinity;
    for (const label of labels) {
      const lp = label.replace(/[(),]/g, ' ').split(/\s+/).filter(Boolean);
      if (!lp.length) continue;
      const lf = norm(lp[0]);
      const ll = norm(lp.slice(1).join(''));

      // Only a surname was said: match on that alone, but loosely enough that
      // several people come back rather than one arbitrary pick.
      if (!last) {
        if (lev(ll, first) <= 1 || lev(lf, first) === 0) best = Math.min(best, 3);
        continue;
      }

      const dl = lev(ll, last);
      if (dl > 2) continue;
      if (dl === 0 && lf === first) best = Math.min(best, 0);
      else if (dl === 0 && firstNamesMatch(lf, first)) best = Math.min(best, 1);
      else if (dl <= 1 && firstNamesMatch(lf, first)) best = Math.min(best, 2);
      else if (dl <= 1 && lev(lf, first) <= 2) best = Math.min(best, 3);
    }

    if (best < Infinity) {
      scored.push({ id: p.id, name, do_not_contact: p.do_not_contact, distance: best });
    }
  }

  scored.sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name));
  if (!scored.length) return [];

  // Exactly one exact match wins outright. Otherwise hand back everything at
  // the best tier, so the admin picks rather than the computer guessing.
  const bestTier = scored[0].distance;
  const tied = scored.filter((c) => c.distance === bestTier);
  return tied.length === 1 ? [tied[0]] : tied.slice(0, 5);
}
