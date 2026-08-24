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
  /**
   * Added by migration 0029. Declared here rather than waiting on regenerated
   * types, which needs CLI access to the project.
   */
  birthday?: string | null;
  yeshiva?: string | null;
  in_chinuch?: boolean;
  chinuch_role?: string | null;

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
  rebbeimWithPeople: string[];
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

/**
 * Fetch every row, not just the first 1000.
 *
 * PostgREST caps a response at 1000 rows. staff_connections crossed that (1684),
 * and because a rebbe's rows can sit past the cap, his connections silently
 * vanished on every reload -- a starred man reverted to grey the moment the
 * directory refreshed. This pages through in chunks until a short page ends it.
 * enrollments is already near the cap, so the same treatment guards it too.
 */
async function fetchAll<T>(
  build: () => ReturnType<ReturnType<typeof supabase.from>['select']>,
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

export async function loadDirectory(myStaffId: number | null): Promise<Directory> {
  const [peopleRows, enrolRows, aliasRows, staffRows, connRows, attendRows, eventRows, contactRows] =
    await Promise.all([
      fetchAll<any>(() => supabase.from('people').select('*')
        // Currently-in-program guys are hidden everywhere forward-facing.
        // Their rows stay in the database and their connections are kept;
        // they simply do not appear until the admin flips in_program off.
        .eq('in_program', false).order('last_name') as never),
      fetchAll<any>(() => supabase.from('enrollments').select('person_id, academic_year, level, rebbe_id') as never),
      fetchAll<any>(() => supabase.from('person_aliases').select('person_id, alias') as never),
      fetchAll<any>(() => supabase.from('staff').select('id, name').order('surname') as never),
      fetchAll<any>(() => supabase.from('staff_connections').select('person_id, staff_id') as never),
      fetchAll<any>(() => supabase.from('event_attendance').select('person_id, event_id') as never),
      fetchAll<any>(() => supabase.from('events').select('id, year, type') as never),
      fetchAll<any>(() => supabase.from('person_last_contact').select('person_id, last_contacted_on') as never),
    ]);

  // Keep the rest of the function unchanged: wrap each list back into the
  // { data } shape it already reads from.
  const people = { data: peopleRows as any[] };
  const enrolments = { data: enrolRows as any[] };
  const aliases = { data: aliasRows as any[] };
  const staff = { data: staffRows as any[] };
  const connections = { data: connRows as any[] };
  const attendance = { data: attendRows as any[] };
  const events = { data: eventRows as any[] };
  const contact = { data: contactRows as any[] };

  const staffName = new Map((staff.data ?? []).map((s: any) => [s.id, s.name]));
  const eventYear = new Map((events.data ?? []).map((e: any) => [e.id, String(e.year)]));

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

    // What he is shown as: his nickname if he has one, else his given name.
    // The given name stays on file and in the haystack, so search still finds
    // him under it.
    const shown = (p.nickname && p.nickname.trim()) || p.first_name;
    const name = `${shown} ${p.last_name}`.trim();
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

  const withPeople = new Set(
    records.flatMap((r) => [...r.claimedBy, ...r.programRebbeim.map((x) => x.rebbe)]),
  );

  return {
    people: records,
    byId: new Map(records.map((r) => [r.id, r])),
    years: [...yearSet].sort().reverse(),
    levelsByYear: new Map([...levelsByYear].map(([y, s]) => [y, [...s].sort()])),
    staff: staff.data ?? [],
    // Only rebbeim who have somebody. Offering a name that returns nothing
    // reads as a broken filter rather than an empty one.
    rebbeimWithPeople: (staff.data ?? [])
      .filter((s) => withPeople.has(s.name))
      .map((s) => s.name),
  };
}

export type Filters = {
  query: string;
  year: string | null;
  level: string | null;
  /**
   * A rebbe's name, or 'unclaimed' for men nobody has claimed.
   *
   * Replaces an earlier 'mutual' option, which matched men whose programme
   * rebbe also marked them as close. That was an observation about the data,
   * not a question anyone asks -- "show me Rabbi Caller's guys" is.
   */
  rebbe: string | null;
  mineOnly: boolean;
  /** Only men flagged as in chinuch or kiruv. */
  chinuchOnly: boolean;
};

export const emptyFilters: Filters = {
  query: '',
  year: null,
  level: null,
  rebbe: null,
  mineOnly: false,
  chinuchOnly: false,
};

export function applyFilters(people: AlumniRecord[], f: Filters): AlumniRecord[] {
  // Every term must match, so "shua baltimore" narrows rather than widens.
  const terms = f.query.toLowerCase().split(/\s+/).filter(Boolean);
  return people.filter((p) => {
    if (f.mineOnly && !(p as AlumniRecord & { mine?: boolean }).mine) return false;
    if (f.chinuchOnly && !(p as AlumniRecord & { in_chinuch?: boolean }).in_chinuch) return false;

    // Year and level travel together. Checking them separately would match a man
    // who was here in 2019-20 and was Shana Bet in some entirely different year.
    if (f.year && f.level) {
      if (!p.enrolments.some((e) => e.year === f.year && e.level === f.level)) return false;
    } else if (f.year && !p.years.includes(f.year)) return false;
    else if (f.level && !p.levels.includes(f.level)) return false;

    if (f.rebbe === 'unclaimed') {
      if (p.claimedBy.length || p.programRebbeim.length) return false;
    } else if (f.rebbe) {
      // Either source counts: the rebbe he learned under, or a rebbe who has
      // since said he is close with him.
      const named = f.rebbe;
      if (!p.claimedBy.includes(named) && !p.programRebbeim.some((r) => r.rebbe === named))
        return false;
    }

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
