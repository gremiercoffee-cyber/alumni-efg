"""
Import the live simcha sheet.

    python migration/build_simchas.py

Writes migration/out/simchas.sql.

Two things this has to get right:

1. A marriage is three rows -- engagement, wedding_scheduled, wedding -- chained
   by parent_simcha_id. Twelve of the 31 men have no wedding date at all, and
   those correctly get only the engagement, which is what puts them on the
   "engaged, no date" queue.

2. Nothing here may notify anyone. Every one of these has already been announced
   -- the sheet's SENT columns say so -- and inserting them fires the simcha
   trigger. So the import disables that trigger, and stamps announced_at on
   everything it inserts.
"""

import json
import re
import sys
import unicodedata
from pathlib import Path

import openpyxl

SRC = Path.home() / "Downloads" / "Simcha Database efg.xlsx"
OUT = Path(__file__).parent / "out"


def norm(s):
    s = unicodedata.normalize("NFKD", str(s or ""))
    return re.sub(r"[^a-z]", "", s.lower())


def lit(v):
    if v is None or v == "":
        return "NULL"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def lev(a, b):
    if a == b:
        return 0
    if not a or not b:
        return max(len(a), len(b))
    prev = list(range(len(a) + 1))
    for i, cb in enumerate(b, 1):
        cur = [i]
        for j, ca in enumerate(a, 1):
            cur.append(min(prev[j - 1] + (ca != cb), cur[j - 1] + 1, prev[j] + 1))
        prev = cur
    return prev[-1]


# Same first-name equivalences the dedupe used; the simcha sheet is typed by
# hand and drifts the same way ("Yaakov"/"Jacob", "Zevi"/"Zev").
EQUIV = [
    {"joseph", "yosef", "yossi", "joey", "jo"},
    {"joshua", "josh", "yehoshua", "shua", "shuey"},
    {"jacob", "yaakov", "yakov", "jake", "koby"},
    {"abraham", "avraham", "avrohom", "avi", "abe"},
    {"isaac", "issac", "yitzchak", "yitzy"},
    {"david", "dovid", "dave"},
    {"aaron", "aron", "aharon"},
    {"benjamin", "ben", "benny", "binyamin"},
    {"daniel", "dan", "danny", "dani"},
    {"eliezer", "eli", "elie"},
    {"zev", "zevi", "zvi"},
    {"moshe", "moe", "mo"},
    {"nathan", "natan", "nat"},
    {"matisyahu", "matthew", "mati"},
]


# Names on the simcha sheet that no amount of matching will resolve, because the
# sheet records them differently from the alumni database. Resolved by hand.
OVERRIDES = {
    "josh cohen": 377,   # actually Joshua Kohn -- 'Cohen' was a mis-transcription
}

# Men on the simcha sheet who are in no year tab and on no alumni list, so there
# is nobody to match them to. Jared Stern was a madrich, and madrichim are badly
# under-recorded -- only 15 Madrich enrollments exist across all 14 years, which
# for a programme running since 2012 cannot be right. Expect more of these.
#
# Created with no enrollment: the year he was a madrich is not known, and
# inventing one would put a false fact in the database. Add it when it is known.
MISSING_PEOPLE = [
    {"name": "Jared Stern", "first": "Jared", "last": "Stern",
     "note": "Madrich. Added from the 2026 simcha sheet; not in any year tab."},
]


def first_equiv(a, b):
    if not a or not b:
        return False
    if a == b:
        return True
    if any(a in g and b in g for g in EQUIV):
        return True
    return len(a) >= 3 and len(b) >= 3 and (a.startswith(b) or b.startswith(a))


def main():
    if not SRC.exists():
        sys.exit(f"missing {SRC}")

    people = json.loads((OUT / "people.json").read_text())

    # Index on the canonical name and on every alias folded in during the dedupe.
    index = {}
    for p in people:
        for label in [p["name"], *p.get("aliases", [])]:
            # 'Jeremiah (Jeremy) Klein' has to be findable under both first names:
            # the simcha sheet is typed from memory and uses whichever one sticks.
            paren = re.findall(r"\(([^)]*)\)", label)
            stripped = re.sub(r"\([^)]*\)", " ", label).replace(",", " ")
            parts = stripped.split()
            if len(parts) < 2:
                continue
            last = norm(" ".join(parts[1:]))
            index.setdefault((norm(parts[0]), last), p)
            for nick in paren:
                if nick.strip():
                    index.setdefault((norm(nick), last), p)

    ws = openpyxl.load_workbook(SRC, data_only=True)["2026"]
    rows = [list(r) for r in ws.iter_rows(values_only=True)][1:]

    matched, unmatched = [], []
    for r in rows:
        raw = str(r[0] or "").strip()
        if not raw:
            continue
        parts = raw.split()
        if len(parts) < 2:
            unmatched.append((raw, "single word"))
            continue
        f, l = norm(parts[0]), norm(" ".join(parts[1:]))

        by_id = {p["alumni_id"]: p for p in people}
        forced = OVERRIDES.get(raw.strip().lower())
        hit = by_id.get(forced) if forced else index.get((f, l))
        if not hit and not forced:
            near = [p for (pf, pl), p in index.items()
                    if pl == l and first_equiv(pf, f)]
            if not near:
                near = [p for (pf, pl), p in index.items()
                        if lev(pl, l) <= 1 and (first_equiv(pf, f) or lev(pf, f) <= 1)]
            hit = near[0] if len(set(id(x) for x in near)) == 1 else None

        if not hit:
            extra = next((x for x in MISSING_PEOPLE
                          if x["name"].lower() == raw.strip().lower()), None)
            if extra:
                matched.append(dict(
                    person_id=None, lookup=extra, name=extra["name"], sheet_name=raw,
                    wedding_on=(r[1].date().isoformat() if hasattr(r[1], "date") else None),
                    location=(str(r[2]).strip() or None) if r[2] else None,
                    sent_engagement=str(r[4] or "").upper() == "SENT",
                    sent_week=str(r[5] or "").upper() == "SENT",
                    sent_day=str(r[6] or "").upper() == "SENT",
                    sent_after=str(r[7] or "").upper() == "SENT",
                ))
                continue
            unmatched.append((raw, "no match"))
            continue

        date = r[1]
        matched.append(dict(
            person_id=hit["alumni_id"],
            name=hit["name"],
            sheet_name=raw,
            wedding_on=date.date().isoformat() if hasattr(date, "date") else None,
            location=(str(r[2]).strip() or None) if r[2] else None,
            # Column E onward are the old script's "already sent" flags.
            sent_engagement=str(r[4] or "").upper() == "SENT",
            sent_week=str(r[5] or "").upper() == "SENT",
            sent_day=str(r[6] or "").upper() == "SENT",
            sent_after=str(r[7] or "").upper() == "SENT",
        ))

    print(f"rows {len(rows)} | matched {len(matched)} | unmatched {len(unmatched)}")
    for name, why in unmatched:
        print(f"   UNMATCHED  {name}  ({why})")
    awaiting = [m for m in matched if not m["wedding_on"]]
    print(f"\nwith a wedding date : {len(matched) - len(awaiting)}")
    print(f"awaiting a date     : {len(awaiting)}")
    for m in awaiting:
        print(f"   {m['name']}")

    people_sql = "\n".join(
        f"""
-- {m['name']} -- not in the alumni database at all. See MISSING_PEOPLE.
insert into people (first_name, last_name, notes)
select {lit(m['first'])}, {lit(m['last'])}, {lit(m['note'])}
 where not exists (
   select 1 from people
    where lower(first_name) = lower({lit(m['first'])})
      and lower(last_name)  = lower({lit(m['last'])})
 );"""
        for m in MISSING_PEOPLE)

    sql = ["""-- Live simchas, imported from 'Simcha Database efg.xlsx' (tab 2026).
-- Generated by migration/build_simchas.py -- regenerate rather than hand-editing.
--
-- SAFE TO RE-RUN. Each engagement is guarded by a `where not exists` on this
-- import's own note text, and the wedding rows hang off that engagement's CTE --
-- so on a second run the CTE is empty and nothing is inserted at all.
--
-- Every one of these has ALREADY been announced; the sheet's SENT columns say so.
-- Inserting a simcha normally fires the notification trigger, so the trigger is
-- disabled around the insert and announced_at is stamped on every row. Without
-- that, running this would blast the staff list with months-old Mazal Tovs.

alter table simchas disable trigger simchas_notify;
""" + people_sql]

    for m in matched:
        pid = (str(m["person_id"]) if m["person_id"] is not None else
               f"(select id from people where lower(first_name)=lower({lit(m['lookup']['first'])})"
               f" and lower(last_name)=lower({lit(m['lookup']['last'])}) limit 1)")
        note = f"Imported from the 2026 simcha sheet as '{m['sheet_name']}'."
        sql.append(f"""
-- {m['name']}
with e as (
  insert into simchas (person_id, type, occurred_on, note, announced_at)
  select {pid}, 'engagement', null, {lit(note)},
         {'now()' if m['sent_engagement'] else 'null'}
   where not exists (
     select 1 from simchas s
      where s.person_id = {pid}
        and s.type = 'engagement'
        and s.note like 'Imported from the 2026 simcha sheet%'
   )
  returning id
)""")
        if m["wedding_on"]:
            loc = f" Venue: {m['location']}." if m["location"] else ""
            sql.append(f"""insert into simchas (person_id, type, occurred_on, wedding_on,
                     parent_simcha_id, note, announced_at)
select {pid}, v.t, {lit(m['wedding_on'])}, {lit(m['wedding_on'])},
       e.id, {lit(note + loc)}, v.announced
  from e, (values
    -- Cast the nulls: where neither flag was sent the column is all-NULL and
    -- Postgres resolves it to text, which will not go into a timestamptz.
    ('wedding_scheduled'::simcha_type, {'now()' if m['sent_week'] else 'null::timestamptz'}),
    ('wedding'::simcha_type,           {'now()' if m['sent_day'] or m['sent_after'] else 'null::timestamptz'})
  ) as v(t, announced);
""")
        else:
            # No date known. The engagement alone is the point -- it is what puts
            # him on the "engaged, no wedding date" queue.
            sql.append("select id from e;\n")

    sql.append("""
alter table simchas enable trigger simchas_notify;
""")

    path = OUT / "simchas.sql"
    path.write_text("\n".join(sql), encoding="utf-8")
    print(f"\nwrote {path}  ({len(matched)} engagements, "
          f"{sum(1 for m in matched if m['wedding_on']) * 2} follow-on rows)")


if __name__ == "__main__":
    main()
