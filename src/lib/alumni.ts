import { supabase } from './supabase';
import type { Person } from './supabase';

/**
 * The alumni directory, loaded once and held in memory.
 *
 * ~720 people and ~990 enrollments is roughly 200KB. Small enough to fetch in
 * one go, which makes search and the filters instant and keeps them working when
 * the signal drops. A round trip per keystroke would be the slower design at
 * this size. Revisit if this ever reaches five figures.
 */

export type ProgramRebbe = { year: string; rebbe: string };

export type AlumniRecord = Person & {
  name: string;
  aliases: string[];
  years: string[];
  levels: string[];
  enrolments: { year: string; level: string | null }[];
  shabbatons: string[];

  /**
   * Two different claims, deliberately kept apart.
   *
   * programRebbeim is from the alumni database: who his rebbe actually was, per
   * year. claimedBy is from the rebbeim's own sheet: who says he is close with
   * him now. Across the data these disagree for 208 men, which is not an error --
   * a man's rebbe in 2016 need not be who he is close with a decade later.
   * Merging them would hide that.
   */
  programRebbeim: ProgramRebbe[];
  claimedBy: string[];
  mutual: string[];

  lastContactedOn: string | null;
  haystack: string;
};

export type Directory = {
  people: AlumniRecord[];
  byId: Map<number, AlumniRecord>;
  years: string[];
  levelsByYear: Map<string, string[]>;
  staff: { id: number; name: string }[];
};

const groupBy = <T extends { person_id: number }>(rows: T[] | null) => {
  const m = new Map<number, T[]>();
  for (const r of rows ?? []) {
    const list = m.get(r.person_id);
    if (list) list.push(r);
    else m.set(r.person_id, [r]);
  }
  return m;
};

export async function loadDirectory(myStaffId: number | null): Promise<Directory> {
  const [people, enrolments, aliases, staff, connections, attendance, events, contact] =
    await Promise.all([
      supabase.from('people').select('*').order('last_name'),
      supabase.from('enrollments').select('person_id, academic_year, level, rebbe_id'),
      supabase.from('person_aliases').select('person_id, alias'),
      supabase.from('staff').select('id, name').order('surname'),
      supabase.from('staff_connections').select('person_id, staff_id'),
      supabase.from('event_attendance').select('person_id, event_id'),
      supabase.from('events').select('id, year, type'),
      supabase.from('person_last_contact').select('person_id, last_contacted_on'),
    ]);

  const failed = [people, enrolments, aliases, staff, connections, attendance, events, contact]
    .find((r) => r.error);
  if (failed?.error) throw failed.error;

  const staffName = new Map((staff.data ?? []).map((s) => [s.id, s.name]));
  const eventYear = new Map((events.data ?? []).map((e) => [e.id, String(e.year)]));

  const enrolMap = groupBy(enrolments.data);
  const aliasMap = groupBy(aliases.data);
  const connMap = groupBy(connections.data);
  const attendMap = groupBy(attendance.data as { person_id: number; event_id: number }[]);
  const contactMap = new Map(
    (contact.data ?? []).map((c) => [c.person_id!, c.last_contacted_on]),
  );

  const yearSet = new Set<string>();
  const levelsByYear = new Map<string, Set<string>>();

  const records: AlumniRecord[] = (people.data ?? []).map((p) => {
    const rows = (enrolMap.get(p.id) ?? []).sort((a, b) =>
      a.academic_year.localeCompare(b.academic_year),
    );
    const personAliases = (aliasMap.get(p.id) ?? []).map((a) => a.alias);

    const programRebbeim = rows
      .filter((r) => r.rebbe_id)
      .map((r) => ({ year: r.academic_year, rebbe: staffName.get(r.rebbe_id!) ?? '' }))
      .filter((r) => r.rebbe);

    const claimedBy = [
      ...new Set(
        (connMap.get(p.id) ?? [])
          .map((c) => staffName.get(c.staff_id))
          .filter(Boolean) as string[],
      ),
    ].sort();

    const programNames = new Set(programRebbeim.map((r) => r.rebbe));
    const mutual = claimedBy.filter((r) => programNames.has(r));

    for (const r of rows) {
      yearSet.add(r.academic_year);
      if (r.level) {
        const set = levelsByYear.get(r.academic_year) ?? new Set<string>();
        set.add(r.level);
        levelsByYear.set(r.academic_year, set);
      }
    }

    const name = `${p.first_name} ${p.last_name}`.trim();
    return {
      ...p,
      name,
      aliases: personAliases,
      years: [...new Set(rows.map((r) => r.academic_year))],
      levels: [...new Set(rows.map((r) => r.level).filter(Boolean))] as string[],
      enrolments: rows.map((r) => ({ year: r.academic_year, level: r.level })),
      shabbatons: [
        ...new Set(
          (attendMap.get(p.id) ?? [])
            .map((a) => eventYear.get(a.event_id))
            .filter(Boolean) as string[],
        ),
      ].sort(),
      programRebbeim,
      claimedBy,
      mutual,
      lastContactedOn: contactMap.get(p.id) ?? null,
      // Lowercased once at load rather than on every keystroke.
      haystack: [
        name, p.nickname, p.email, p.phone, p.city, p.state, p.country,
        p.college, p.occupation, ...personAliases,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    };
  });

  const myPeople = new Set(
    myStaffId
      ? (connections.data ?? []).filter((c) => c.staff_id === myStaffId).map((c) => c.person_id)
      : [],
  );
  for (const r of records) (r as AlumniRecord & { mine: boolean }).mine = myPeople.has(r.id);

  return {
    people: records,
    byId: new Map(records.map((r) => [r.id, r])),
    years: [...yearSet].sort().reverse(),
    levelsByYear: new Map([...levelsByYear].map(([y, s]) => [y, [...s].sort()])),
    staff: staff.data ?? [],
  };
}

export type Filters = {
  query: string;
  year: string | null;
  level: string | null;
  claim: 'unclaimed' | 'mutual' | null;
  mineOnly: boolean;
};

export const emptyFilters: Filters = {
  query: '',
  year: null,
  level: null,
  claim: null,
  mineOnly: false,
};

export function applyFilters(people: AlumniRecord[], f: Filters): AlumniRecord[] {
  // Every term must match, so "shua baltimore" narrows rather than widens.
  const terms = f.query.toLowerCase().split(/\s+/).filter(Boolean);
  return people.filter((p) => {
    if (f.mineOnly && !(p as AlumniRecord & { mine?: boolean }).mine) return false;

    // Year and level travel together. Checking them separately would match a man
    // who was here in 2019-20 and was Shana Bet in some entirely different year.
    if (f.year && f.level) {
      if (!p.enrolments.some((e) => e.year === f.year && e.level === f.level)) return false;
    } else if (f.year && !p.years.includes(f.year)) return false;
    else if (f.level && !p.levels.includes(f.level)) return false;

    if (f.claim === 'unclaimed' && p.claimedBy.length) return false;
    if (f.claim === 'mutual' && !p.mutual.length) return false;

    return terms.every((t) => p.haystack.includes(t));
  });
}

/** '2012-2013' … '2013-2014' -> '2012–14', which is what fits on a list row. */
export function yearRange(years: string[]): string {
  if (!years.length) return '';
  const start = years[0].split('-')[0];
  const end = years[years.length - 1].split('-')[1];
  return start === end.slice(0, 4) ? start : `${start}–${end.slice(2)}`;
}

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
