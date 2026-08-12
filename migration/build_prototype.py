"""
Build a clickable prototype of the EFG Alumni app as a single HTML page.

    python migration/build_prototype.py

A design preview, not the app -- it exists so the shape of the screens can be
argued about before they are written in React Native.

Real alumni names and program history, so the density is honest. Contact details
are masked: there is no reason to publish 723 people's phone numbers to settle a
question about layout. Feed entries are invented, since no simchas or events
have been entered yet.
"""

import base64
import json
import random
from pathlib import Path

OUT = Path(__file__).parent / "out"
FONTS = Path(__file__).parents[1] / "node_modules/@expo-google-fonts/poppins"
SAMPLE = 70


def font_face(name, weight, filename):
    """Inline the font: the artifact CSP blocks font CDNs, so a linked webfont
    would silently fall back to system sans and misrepresent the design."""
    data = base64.b64encode((FONTS / filename).read_bytes()).decode()
    return (f"@font-face{{font-family:'{name}';font-weight:{weight};font-style:normal;"
            f"font-display:block;src:url(data:font/ttf;base64,{data}) format('truetype')}}")


def mask_email(e):
    if not e or "@" not in e:
        return None
    local, _, domain = e.partition("@")
    return (local[0] if local else "") + "•" * 6 + "@" + domain


def mask_phone(p):
    if not p:
        return None
    digits = [c for c in p if c.isdigit()]
    return "••• ••• " + "".join(digits[-4:]) if len(digits) >= 4 else None


def main():
    people = json.loads((OUT / "people.json").read_text())
    enrollments = json.loads((OUT / "enrollments.json").read_text())
    connections = json.loads((OUT / "connections.json").read_text())
    staff = json.loads((OUT / "staff.json").read_text())["staff"]

    enrol, conns = {}, {}
    for e in enrollments:
        enrol.setdefault(e["person_id"], []).append(e)
    for c in connections:
        conns.setdefault(c["person_id"], []).append(c["staff"])

    rng = random.Random(4)

    # Always carry the flagged records -- five do-not-contact and ten spotlight
    # across 723, so a plain sample would miss them, and they are exactly the
    # states the design has to prove it handles.
    must = [p for p in people if p.get("do_not_contact") or p.get("spotlight")]
    must_ids = {p["alumni_id"] for p in must}
    interesting = [p for p in people
                   if p["alumni_id"] not in must_ids
                   and (len(enrol.get(p["alumni_id"], [])) > 1 or p.get("occupation")
                        or p.get("aish_impact") or p.get("aliases"))]
    rest = [p for p in people
            if p["alumni_id"] not in must_ids and p not in interesting]
    room = max(SAMPLE - len(must), 0)
    chosen = must + rng.sample(interesting, min(int(room * .7), len(interesting))) \
                  + rng.sample(rest, min(room - int(room * .7), len(rest)))

    records = []
    for p in sorted(chosen, key=lambda x: x["name"].split()[-1]):
        rows = sorted(enrol.get(p["alumni_id"], []), key=lambda r: r["academic_year"])
        program_rebbeim = [dict(year=r["academic_year"], rebbe=r["rebbe"])
                           for r in rows if r.get("rebbe")]
        claimed_by = sorted(set(conns.get(p["alumni_id"], [])))
        # Where both sources name the same man, that is the strongest signal
        # there is: he was his rebbe, and the rebbe still wants him.
        mutual = sorted({r["rebbe"] for r in rows if r.get("rebbe")} & set(claimed_by))
        rebbeim = sorted({r["rebbe"] for r in rows if r.get("rebbe")} | set(claimed_by))
        records.append(dict(
            id=p["alumni_id"], name=p["name"], aliases=p.get("aliases", []),
            years=[r["academic_year"] for r in rows],
            levels=[r["program_level"] for r in rows if r["program_level"]],
            enrols=[dict(year=r["academic_year"], level=r["program_level"]) for r in rows],
            rebbeim=rebbeim, programRebbeim=program_rebbeim,
            claimedBy=claimed_by, mutual=mutual,
            city=p.get("city"), state=p.get("state"), country=p.get("country"),
            college=p.get("college"), occupation=p.get("occupation"),
            spouse=p.get("spouse_name"),
            email=mask_email(p.get("email")), phone=mask_phone(p.get("phone")),
            hasWhatsapp=bool(p.get("phone")) and rng.random() > .25,
            grad=p.get("expected_graduation_year"),
            dnc=bool(p.get("do_not_contact")), dncReason=p.get("do_not_contact_reason"),
            spotlight=bool(p.get("spotlight")),
            learning=p.get("learning_post_gesher"), impact=p.get("aish_impact"),
            updated=p.get("contact_updated_on"),
            parents=len(p.get("family_contacts", [])),
            # Stands in for the contact log the app will build from taps.
            lastContact=rng.choice([None, "2026-07-28", "2026-05-14", "2026-02-03",
                                    "2025-11-19", "2024-09-02"]),
            lastContactBy=rng.choice(rebbeim) if rebbeim and rng.random() > .4 else None,
            mine=bool(rng.random() > .8),
            # Deliberately empty. No shabbaton history has been supplied, and
            # inventing years -- or asserting "he has never come" -- would put
            # made-up claims about real men on screen.
            shabbatons=[],
        ))

    # No simchas or events exist yet, so the feed is invented -- but spread over
    # two years, because that is how far back it scrolls and a handful of items
    # would not show whether the grouping holds up.
    from datetime import date, timedelta
    TODAY = date(2026, 8, 12)
    pool = [r for r in records if not r["dnc"]]
    rabbis = [s["name"] for s in staff if s["has_own_tab"]]
    brides = ["Rivka Feldman", "Shira Blumenthal", "Tamar Rosenberg", "Chani Weiss",
              "Miriam Adler", "Leah Stern", "Devora Katz", "Esti Farber"]

    feed = [
        dict(kind="event", subtype="shabbaton", date=str(TODAY + timedelta(days=23)),
             title="Alumni Shabbaton 2026", detail="Yeshiva campus",
             note="Registration opens next week."),
        dict(kind="event", subtype="dinner", date=str(TODAY - timedelta(days=13)),
             title="London alumni reunion", detail="Mr. Baker, Hendon",
             note="Turnout: 34."),
        dict(kind="event", subtype="shabbaton", date=str(TODAY - timedelta(days=350)),
             title="Alumni Shabbaton 2025", detail="Yeshiva campus", note=None),
    ]

    # One man's marriage, all three moments, so the thread is visible in the feed.
    thread = pool[5]
    feed += [
        dict(kind="simcha", subtype="engagement", date=str(TODAY - timedelta(days=96)),
             who=thread["name"], detail=thread["years"], subject="alumnus",
             pid=thread["id"], years=thread["years"], mine=thread["mine"], spouse="Rivka Feldman"),
        dict(kind="simcha", subtype="wedding_scheduled",
             date=str(TODAY - timedelta(days=31)), who=thread["name"],
             detail=thread["years"], subject="alumnus", pid=thread["id"],
             years=thread["years"], mine=thread["mine"], spouse="12 November"),
        dict(kind="simcha", subtype="wedding", date=str(TODAY + timedelta(days=92)),
             who=thread["name"], detail=thread["years"], subject="alumnus",
             pid=thread["id"], years=thread["years"], mine=thread["mine"],
             spouse="Rivka Feldman"),
    ]

    # Roughly one simcha a fortnight, alternating alumni and rebbeim.
    alum_types = ["engagement", "wedding", "birth"]
    rebbe_types = ["child_engagement", "child_wedding", "grandchild_birth"]
    for i in range(46):
        offset = 21 - i * 16          # a few ahead, the rest trailing backwards
        when = TODAY + timedelta(days=offset)
        if rng.random() < .3:
            feed.append(dict(kind="simcha", subtype=rebbe_types[i % 3],
                             date=str(when), who=rabbis[i % len(rabbis)],
                             subject="rebbe", detail=None))
        else:
            man = pool[i % len(pool)]
            kind = alum_types[i % 3]
            feed.append(dict(kind="simcha", subtype=kind, date=str(when),
                             who=man["name"], detail=man["years"], subject="alumnus",
                             pid=man["id"], years=man["years"], mine=man["mine"],
                             spouse=brides[i % len(brides)] if kind != "birth" else None))

    feed = [f for f in feed if (TODAY - date.fromisoformat(f["date"])).days <= 730]
    feed.sort(key=lambda f: f["date"], reverse=True)

    totals = dict(
        people=len(people), enrollments=len(enrollments),
        multiYear=sum(1 for p in people
                      if len({r["academic_year"] for r in enrol.get(p["alumni_id"], [])}) > 1),
    )

    fonts = "".join([
        font_face("Poppins", 400, "Poppins_400Regular.ttf"),
        font_face("Poppins", 600, "Poppins_600SemiBold.ttf"),
        font_face("Poppins", 700, "Poppins_700Bold.ttf"),
    ])

    html = (TEMPLATE
            .replace("__FONTS__", fonts)
            .replace("__DATA__", json.dumps(records))
            .replace("__FEED__", json.dumps(feed))
            .replace("__RABBIS__", json.dumps(sorted(rabbis)))
            .replace("__TOTALS__", json.dumps(totals))
            .replace("__SAMPLE__", str(len(records))))
    path = OUT / "prototype.html"
    path.write_text(html, encoding="utf-8")
    print(f"wrote {path}  ({len(html)//1024} KB, {len(records)} alumni, {len(feed)} feed items)")


TEMPLATE = r"""<title>EFG Alumni - app preview</title>
<style>
__FONTS__
:root{
  --navy900:#061437;--navy800:#0d2461;--navy700:#143174;--navy600:#1b3a72;
  --blue:#1c4fb0;--cyan:#2fe0d2;--white:#fff;
  --muted:#b9cbee;--dim:#7f97c6;--rule:#1b3a72;--warn:#ffd166;--bad:#ff9aa8;
  --font:'Poppins',ui-sans-serif,system-ui,sans-serif;
}
*{box-sizing:border-box}
body{margin:0;background:#0a1020;color:var(--white);font-family:var(--font);font-size:15px;line-height:1.5}
.page{max-width:1320px;margin:0 auto;padding:40px 20px 80px}
.intro{margin-bottom:30px;max-width:64ch}
.eyebrow{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--cyan);margin:0 0 10px}
h1{font-size:clamp(26px,4vw,38px);font-weight:700;letter-spacing:-.02em;margin:0 0 12px;text-wrap:balance}
.intro p{color:var(--muted);margin:0 0 10px}
.note{font-size:13px;color:var(--dim);border-left:2px solid var(--rule);padding-left:12px;margin-top:16px}

.frames{display:flex;gap:34px;align-items:flex-start;flex-wrap:wrap;margin-top:34px}
.caption{font-size:12px;color:var(--dim);margin:0 0 10px;letter-spacing:.06em;text-transform:uppercase;font-weight:600}
.phone{width:372px;height:780px;background:var(--navy900);border-radius:32px;border:1px solid var(--navy600);
  overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.5)}
@media(max-width:820px){.phone{width:100%;max-width:372px}}

.appbar{padding:18px 18px 12px;flex:0 0 auto}
.brand{display:flex;align-items:center;gap:9px}
.flame{width:22px;height:22px;flex:0 0 auto}
.brandname{font-weight:700;font-size:15px;letter-spacing:-.01em}
.brandname i{font-style:normal;color:var(--cyan)}
.bell{margin-left:auto;background:none;border:0;cursor:pointer;color:var(--dim);font-size:18px;padding:0 2px}
.bell.on{color:var(--cyan)}

/* stat strip */
.stats{display:flex;gap:0;padding:4px 18px 16px;border-bottom:1px solid var(--rule);flex:0 0 auto}
.stat{flex:1}
.stat b{display:block;font-size:21px;font-weight:700;color:var(--cyan);font-variant-numeric:tabular-nums;line-height:1.2}
.stat span{font-size:9.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--dim)}

.body{flex:1 1 auto;overflow-y:auto}
.body::-webkit-scrollbar{width:6px}
.body::-webkit-scrollbar-thumb{background:var(--navy600);border-radius:3px}
.grouphead{padding:16px 18px 6px;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--cyan);font-weight:700}

/* feed */
.card{display:flex;gap:12px;padding:13px 18px;border-bottom:1px solid rgba(27,58,114,.55);width:100%;
  background:none;border-left:0;border-right:0;border-top:0;text-align:left;font-family:var(--font);color:inherit;cursor:pointer}
.card:hover{background:var(--navy800)}
.card .ic{width:34px;height:34px;border-radius:9px;flex:0 0 auto;display:grid;place-items:center;font-size:16px;background:var(--navy700)}
.card .ic.ev{background:rgba(28,79,176,.4)}
.card .main{flex:1 1 auto;min-width:0}
.card .t{font-weight:600;font-size:14.5px}
.card .s{font-size:12.5px;color:var(--dim)}
.card .d{font-size:11.5px;color:var(--muted);flex:0 0 auto;text-align:right;font-variant-numeric:tabular-nums}
.soon{color:var(--cyan);font-weight:600}

/* list */
.search{width:100%;background:var(--navy800);border:1px solid var(--rule);border-radius:10px;
  padding:11px 13px;color:var(--white);font-family:var(--font);font-size:14px}
.search::placeholder{color:var(--dim)}
.search:focus{outline:2px solid var(--cyan);outline-offset:-1px}
.chips{display:flex;gap:6px;padding:10px 18px;overflow-x:auto;flex:0 0 auto;border-bottom:1px solid var(--rule)}
.chips::-webkit-scrollbar{display:none}
.chip{flex:0 0 auto;background:transparent;border:1px solid var(--rule);color:var(--muted);border-radius:99px;
  padding:5px 12px;font-size:12.5px;font-family:var(--font);cursor:pointer;white-space:nowrap}
.chip[aria-pressed="true"]{background:var(--cyan);border-color:var(--cyan);color:var(--navy900);font-weight:600}
.chips.sub{background:rgba(20,49,116,.35);padding-top:8px;padding-bottom:8px}
.within{flex:0 0 auto;align-self:center;font-size:10px;letter-spacing:.1em;text-transform:uppercase;
  color:var(--dim);padding-right:4px;white-space:nowrap}
.count{padding:9px 18px 4px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}
.row{display:flex;align-items:center;border-bottom:1px solid rgba(27,58,114,.5);padding-right:10px}
.row:hover{background:var(--navy800)}
.rowmain{display:flex;gap:12px;align-items:center;flex:1 1 auto;min-width:0;text-align:left;
  background:transparent;border:0;padding:11px 8px 11px 18px;cursor:pointer;font-family:var(--font);color:inherit}
.quick{display:flex;gap:5px;flex:0 0 auto}
.qb{width:32px;height:32px;border-radius:9px;border:1px solid var(--rule);background:var(--navy800);
  cursor:pointer;font-size:14px;line-height:1;display:grid;place-items:center;padding:0}
.qb:hover:not(:disabled){border-color:var(--cyan)}
.qb:disabled{opacity:.25;cursor:not-allowed}
.qb.wa{background:rgba(37,211,102,.14)}
.avatar{width:36px;height:36px;flex:0 0 auto;border-radius:50%;display:grid;place-items:center;
  background:var(--navy700);color:var(--cyan);font-weight:600;font-size:12.5px}
.who{flex:1 1 auto;min-width:0}
.nm{font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sub{font-size:12px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.yr{font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums;flex:0 0 auto}
.dot{width:6px;height:6px;border-radius:50%;flex:0 0 auto}
.dot.dnc{background:var(--bad)}.dot.spot{background:var(--warn)}
.unclaimed{flex:0 0 auto;font-size:9px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;
  color:var(--dim);border:1px solid var(--rule);border-radius:99px;padding:2px 6px}
.empty{padding:40px 18px;color:var(--dim);font-size:14px;text-align:center}

/* detail */
.back{background:none;border:0;color:var(--cyan);font-family:var(--font);font-size:13px;cursor:pointer;padding:14px 18px 0}
.dhead{padding:8px 18px 16px;border-bottom:1px solid var(--rule)}
.dhead h2{margin:0;font-size:23px;font-weight:700;letter-spacing:-.02em}
.alias{font-size:12.5px;color:var(--dim);margin-top:2px}
.badges{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.badge{font-size:10.5px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;padding:3px 8px;
  border-radius:99px;background:var(--navy700);color:var(--muted)}
.badge.cy{background:rgba(47,224,210,.16);color:var(--cyan)}
.badge.wn{background:rgba(255,209,102,.16);color:var(--warn)}
.badge.bd{background:rgba(255,154,168,.16);color:var(--bad)}
.sect{padding:15px 18px;border-bottom:1px solid var(--rule)}
.sect h3{margin:0 0 10px;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--cyan);font-weight:700}
.prose{font-size:13.5px;color:var(--muted);margin:0}
.srcnote{margin:9px 0 0;font-size:11px;color:var(--dim);font-style:italic}
.both{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
  color:var(--cyan);background:rgba(47,224,210,.14);border-radius:99px;padding:2px 7px;margin-left:5px}
.tl{display:flex;gap:10px;align-items:baseline;font-size:13.5px;margin-bottom:7px}
.tl b{color:var(--cyan);font-variant-numeric:tabular-nums;font-weight:600;flex:0 0 74px}
.pill-row{display:flex;flex-wrap:wrap;gap:6px}

/* tappable contact rows */
.tap{display:flex;align-items:center;gap:11px;width:100%;background:var(--navy800);border:1px solid var(--rule);
  border-radius:10px;padding:10px 12px;margin-bottom:7px;font-family:var(--font);color:var(--white);
  font-size:13.5px;cursor:pointer;text-align:left}
.tap:hover{border-color:var(--cyan)}
.tap:disabled{opacity:.45;cursor:not-allowed}
.tap .gl{width:26px;height:26px;border-radius:7px;display:grid;place-items:center;flex:0 0 auto;font-size:14px}
.gl.wa{background:rgba(37,211,102,.18)}.gl.ph{background:rgba(47,224,210,.16)}.gl.em{background:rgba(28,79,176,.4)}
.tap .val{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tap .go{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);flex:0 0 auto}
.logged{font-size:11.5px;color:var(--cyan);padding:2px 0 0}

/* report form */
.field{padding:0 18px 14px}
.field label{display:block;font-size:10.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--cyan);
  font-weight:700;margin-bottom:7px}
.sel{width:100%;background:var(--navy800);border:1px solid var(--rule);border-radius:10px;padding:12px 13px;
  color:var(--white);font-family:var(--font);font-size:14px;appearance:none;cursor:pointer}
.sel:focus{outline:2px solid var(--cyan);outline-offset:-1px}
.sel.empty{color:var(--dim)}
.hintline{font-size:12px;color:var(--dim);margin:6px 0 0}
.submit{margin:6px 18px 0;width:calc(100% - 36px);background:var(--cyan);border:0;border-radius:10px;
  padding:13px;color:var(--navy900);font-family:var(--font);font-weight:700;font-size:15px;cursor:pointer}
.submit:disabled{opacity:.35;cursor:not-allowed}
.result{margin:14px 18px 0;padding:13px;border-radius:10px;background:rgba(47,224,210,.1);
  border:1px solid rgba(47,224,210,.35);font-size:13px;color:var(--muted)}
.result b{color:var(--cyan)}

.feedend{padding:18px;margin:0;text-align:center;font-size:12px;color:var(--dim)}
.tabs{display:flex;border-top:1px solid var(--rule);flex:0 0 auto;background:var(--navy900)}
.tab{flex:1;background:none;border:0;padding:10px 3px 13px;color:var(--dim);font-family:var(--font);
  font-size:10px;font-weight:600;cursor:pointer;letter-spacing:.03em}
.tab[aria-selected="true"]{color:var(--cyan);box-shadow:inset 0 2px 0 var(--cyan)}
.tab .ti{display:block;font-size:16px;margin-bottom:3px}

.legend{margin-top:38px;padding-top:22px;border-top:1px solid var(--rule);max-width:74ch}
.legend h3{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--cyan);margin:0 0 12px}
.legend li{color:var(--muted);font-size:14px;margin-bottom:9px}
.legend b{color:var(--white);font-weight:600}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style>

<div class="page">
  <div class="intro">
    <p class="eyebrow">Design preview - not the real app</p>
    <h1>EFG Alumni</h1>
    <p>Home is the simcha feed, with the counts you liked pinned above it. Four tabs.
      Every phone below is live - search, filters, the dropdowns and the contact buttons
      all work.</p>
    <p class="note">Real names and program history so the density is honest; emails and
      phones are masked. Showing __SAMPLE__ of 723. The feed entries are invented, since no
      simchas or events have been entered yet.</p>
  </div>

  <div class="frames">
    <div><p class="caption">Home - the feed</p><div class="phone" id="p-home"></div></div>
    <div><p class="caption">Report a simcha</p><div class="phone" id="p-report"></div></div>
    <div><p class="caption">Contacts - and one record</p><div class="phone" id="p-contacts"></div></div>
  </div>

  <div class="legend">
    <h3>What I changed, and what I'm still guessing at</h3>
    <ul>
      <li><b>Follow up is gone.</b> You didn't see the use, so the tabs are Home, Report,
        Contacts, My alumni.</li>
      <li><b>Three dropdowns on the report screen</b>, as you said: alumnus, rebbe, and what
        happened. Picking one person clears the other, since a simcha belongs to one man.
        The third list changes to suit - a rebbe gets "child got engaged", an alumnus gets
        "got engaged".</li>
      <li><b>Phone numbers are WhatsApp links</b>, falling back to a call when he has no
        WhatsApp. Email opens the mail app. Try them on a record.</li>
      <li><b>Every tap is logged.</b> That answers your question: yes, we can build the
        contact history from what people press, with no extra work from anyone. The honest
        limit is that it records that WhatsApp was <em>opened</em>, not that a message was
        sent - so it reads "reached out", never "made contact".</li>
      <li><b>Notifications toggle</b> is the bell, top right of Home.</li>
      <li><b>Admin adds events</b> and they land in the feed alongside simchas, sorted by
        date, upcoming first.</li>
      <li><b>Still guessing:</b> whether the feed should reach further back than a month,
        and whether "my alumni" or Home should be the screen the app opens on.</li>
    </ul>
  </div>
</div>

<script>
const DATA = __DATA__, FEED = __FEED__, RABBIS = __RABBIS__, TOTALS = __TOTALS__;
const TODAY = new Date('2026-08-12');

const FLAME = `<svg class="flame" viewBox="0 0 24 24" aria-hidden="true">
 <defs><linearGradient id="fg" x1="0" y1="1" x2="1" y2="0">
 <stop offset="0" stop-color="#1c4fb0"/><stop offset="1" stop-color="#2fe0d2"/></linearGradient></defs>
 <path d="M12 2c0 4-5 5.5-5 10a5 5 0 0 0 10 0c0-3-2-4-2-6.5C15 3.5 12 2 12 2z" fill="url(#fg)"/></svg>`;

const SIMCHA_LABEL = {
  engagement:'got engaged',
  wedding_scheduled:"'s wedding date is set",
  wedding:'got married',
  birth:'had a baby',
  bar_mitzvah:'made a bar mitzvah',
  child_engagement:"'s child got engaged",
  child_wedding_scheduled:"'s child's wedding date is set",
  child_wedding:"'s child got married",
  grandchild_birth:'has a new grandchild'
};
const ICON = { engagement:'💍', wedding_scheduled:'📅', wedding:'🎉',
  birth:'👶', bar_mitzvah:'📖', child_engagement:'💍',
  child_wedding_scheduled:'📅', child_wedding:'🎉',
  grandchild_birth:'👶', shabbaton:'🕯', dinner:'🍽' };

// An engagement, the date arriving, and the wedding are three separate reports.
// When a man gets engaged nobody knows the wedding date yet -- that is the whole
// point, and it is why the old script could only remind about weddings someone
// had already gone back and typed a date for.
const ALUMNUS_TYPES = [['engagement','Got engaged'],['wedding_scheduled','Wedding date set'],
  ['wedding','Got married'],['birth','Had a child'],['bar_mitzvah','Made a bar mitzvah'],
  ['other','Something else']];
const REBBE_TYPES = [['child_engagement','Child got engaged'],
  ['child_wedding_scheduled',"Child's wedding date set"],['child_wedding','Child got married'],
  ['birth','Had a child'],['grandchild_birth','New grandchild'],
  ['bar_mitzvah','Made a bar mitzvah'],['other','Something else']];
const NEEDS_DATE = ['wedding_scheduled','child_wedding_scheduled'];

const state = { tab:'home', q:'', year:null, level:null, mineOnly:false, rDate:'', feedMine:false, feedYear:null, claim:null,
  selected:null, notif:false, rAlum:'', rRebbe:'', rType:'', submitted:null, taps:[] };

const esc = s => String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
const initials = n => n.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();
const years = [...new Set(DATA.flatMap(p=>p.years))].sort().reverse();
const levels = [...new Set(DATA.flatMap(p=>p.levels))];
const levelsIn = y => [...new Set(DATA.flatMap(p=>p.enrols)
  .filter(e=>e.year===y && e.level).map(e=>e.level))].sort();

function range(ys){ if(!ys.length) return '';
  const a=ys[0].split('-')[0], b=ys[ys.length-1].split('-')[1];
  return a===b.slice(0,4) ? a : a+'–'+b.slice(2); }
function fmt(d){ return new Date(d+'T00:00:00')
  .toLocaleDateString('en-GB',{day:'numeric',month:'short'}); }
function days(d){ return Math.round((new Date(d+'T00:00:00')-TODAY)/864e5); }

function shell(id, inner, bar){
  document.getElementById(id).innerHTML = bar + inner + tabs();
}
function appbar(extra=''){
  return `<div class="appbar"><div class="brand">${FLAME}
    <span class="brandname">efg<i>@</i>aish</span>${extra}</div></div>`;
}
function tabs(){
  const t=[['home','\u{1F3E0}','Home'],['report','\u{2795}','Report'],
           ['contacts','\u{1F4C7}','Contacts'],['mine','\u{2B50}','My alumni']];
  return `<div class="tabs">${t.map(([k,i,l])=>
    `<button class="tab" data-tab="${k}" aria-selected="${state.tab===k}">
      <span class="ti">${i}</span>${l}</button>`).join('')}</div>`;
}

/* ---------- home ---------- */
function renderHome(){
  // Rebbeim's own simchas have no program year and no owner, so a filter on
  // either drops them -- which is right: you asked for a filter on your alumni.
  const shown = FEED.filter(f=>{
    if(state.feedMine && !f.mine) return false;
    if(state.feedYear && !(f.years||[]).includes(state.feedYear)) return false;
    return true;
  });
  const upcoming = shown.filter(f=>days(f.date)>=0).sort((a,b)=>a.date.localeCompare(b.date));
  const recent   = shown.filter(f=>days(f.date)<0).sort((a,b)=>b.date.localeCompare(a.date));
  const monthOf = d => new Date(d+'T00:00:00')
    .toLocaleDateString('en-GB',{month:'long',year:'numeric'});
  const card = f => {
    const isEv = f.kind==='event';
    const lbl = SIMCHA_LABEL[f.subtype] || '';
    // Possessive labels open with an apostrophe and must not take a space.
    const title = isEv ? f.title : f.who + (lbl.startsWith("'") ? lbl : ' ' + lbl);
    const sub = isEv ? f.detail
      : (f.subject==='rebbe' ? 'Rebbe' :
         [Array.isArray(f.detail)?range(f.detail):null, f.spouse].filter(Boolean).join(' · '));
    const d = days(f.date);
    const when = d===0 ? '<span class="soon">today</span>'
      : d>0 ? `<span class="soon">in ${d}d</span>` : fmt(f.date);
    return `<button class="card" data-feed="${f.date}">
      <span class="ic ${isEv?'ev':''}">${ICON[f.subtype]||'\u{1F4C5}'}</span>
      <span class="main"><span class="t">${esc(title)}</span>
        <span class="s">${esc(sub||'')}</span></span>
      <span class="d">${when}</span></button>`;
  };
  const bell = `<button class="bell ${state.notif?'on':''}" id="bell"
      title="${state.notif?'Notifications on':'Turn on notifications'}">${state.notif?'\u{1F514}':'\u{1F515}'}</button>`;
  shell('p-home', `
    <div class="stats">
      <div class="stat"><b>${TOTALS.people}</b><span>Alumni</span></div>
      <div class="stat"><b>${TOTALS.enrollments}</b><span>Enrollments</span></div>
      <div class="stat"><b>${TOTALS.multiYear}</b><span>Stayed 2+ yrs</span></div>
    </div>
    <div class="chips">
      <button class="chip" data-k="feedMine" data-v="" aria-pressed="${!state.feedMine}">Everyone</button>
      <button class="chip" data-k="feedMine" data-v="1" aria-pressed="${state.feedMine}">My alumni</button>
    </div>
    <div class="chips sub">
      <span class="within">year</span>
      <button class="chip" data-k="feedYear" data-v="" aria-pressed="${!state.feedYear}">Any</button>
      ${years.map(y=>`<button class="chip" data-k="feedYear" data-v="${y}" aria-pressed="${state.feedYear===y}">${esc(y)}</button>`).join('')}
    </div>
    <div class="body">
      ${shown.length?'':'<p class="empty">No simchas match that filter.</p>'}
      ${state.notif?'':`<div class="result" style="margin-top:14px">
        <b>Notifications are off.</b> Tap the bell to get a push when a simcha is
        reported or an event is added.</div>`}
      <div class="grouphead">Coming up</div>${upcoming.map(card).join('')}
      ${(() => { let last=null; return recent.map(f=>{
          const m = monthOf(f.date);
          const head = m===last ? '' : `<div class="grouphead">${m}</div>`;
          last = m; return head + card(f);
        }).join(''); })()}
      <p class="feedend">That's two years. Anything older isn't shown.</p>
    </div>`, appbar(bell));
}

/* ---------- report ---------- */
function renderReport(){
  const types = state.rRebbe ? REBBE_TYPES : ALUMNUS_TYPES;
  const ready = (state.rAlum || state.rRebbe) && state.rType
    && (!NEEDS_DATE.includes(state.rType) || state.rDate);
  const who = state.rRebbe || (DATA.find(p=>p.id==state.rAlum)||{}).name;
  shell('p-report', `
    <div class="body">
      <div class="field" style="padding-top:4px">
        <label>Alumnus</label>
        <select class="sel ${state.rAlum?'':'empty'}" id="r-alum">
          <option value="">Search alumni…</option>
          ${DATA.map(p=>`<option value="${p.id}" ${state.rAlum==p.id?'selected':''}>${esc(p.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Or a rebbe</label>
        <select class="sel ${state.rRebbe?'':'empty'}" id="r-rebbe">
          <option value="">Search rebbeim…</option>
          ${RABBIS.map(r=>`<option ${state.rRebbe===r?'selected':''}>${esc(r)}</option>`).join('')}
        </select>
        <p class="hintline">Picking one clears the other — a simcha belongs to one person.</p>
      </div>
      <div class="field">
        <label>What happened</label>
        <select class="sel ${state.rType?'':'empty'}" id="r-type">
          <option value="">Choose…</option>
          ${types.map(([v,l])=>`<option value="${v}" ${state.rType===v?'selected':''}>${esc(l)}</option>`).join('')}
        </select>
        <p class="hintline">${state.rRebbe?'Rebbe':'Alumnus'} list.</p>
      </div>
      ${NEEDS_DATE.includes(state.rType) ? `<div class="field">
        <label>Wedding date</label>
        <input class="sel" type="date" id="r-date" value="${state.rDate||''}">
        <p class="hintline">This is the piece that was always missing. Until it is
          known, no reminder can be scheduled.</p>
      </div>` : ''}
      <button class="submit" id="r-go" ${ready?'':'disabled'}>Report it</button>
      ${state.submitted ? `<div class="result">
        <b>Filed for review.</b> ${esc(state.submitted)}<br><br>
        You are admin, so this would post straight to the feed and email staff.
        From anyone else it becomes a claim for you to approve — and if ten
        rebbeim report the same thing, you still get one notification.</div>` : ''}
    </div>`, appbar());
}

/* ---------- contacts / my alumni ---------- */
function filtered(){
  const terms = state.q.toLowerCase().split(/\s+/).filter(Boolean);
  return DATA.filter(p=>{
    if(state.tab==='mine' && !p.mine) return false;
    if(state.year && state.level){
      // Both set: he must have been that level *in that year*.
      if(!p.enrols.some(e=>e.year===state.year && e.level===state.level)) return false;
    } else if(state.year && !p.years.includes(state.year)) return false;
      else if(state.level && !p.levels.includes(state.level)) return false;
    if(state.claim==='unclaimed' && p.claimedBy.length) return false;
    if(state.claim==='mutual' && !p.mutual.length) return false;
    const hay=[p.name,...p.aliases,p.city,p.state,p.country,p.college,p.occupation]
      .filter(Boolean).join(' ').toLowerCase();
    return terms.every(t=>hay.includes(t));
  });
}
function renderContacts(){
  const id = state.tab==='mine' ? 'p-contacts' : 'p-contacts';
  if(state.selected){ return renderDetail(); }
  const rows = filtered();
  shell('p-contacts', `
    <div class="field" style="padding:0 18px 12px">
      <input class="search" id="q" placeholder="Search name, city, college…" value="${esc(state.q)}">
    </div>
    <div class="chips">
      <button class="chip" data-k="year" data-v="" aria-pressed="${!state.year}">All years</button>
      ${years.map(y=>`<button class="chip" data-k="year" data-v="${y}" aria-pressed="${state.year===y}">${esc(y)}</button>`).join('')}
    </div>
    <div class="chips sub">
      <span class="within">rebbe</span>
      <button class="chip" data-k="claim" data-v="" aria-pressed="${!state.claim}">Any</button>
      <button class="chip" data-k="claim" data-v="unclaimed" aria-pressed="${state.claim==='unclaimed'}">Unclaimed</button>
      <button class="chip" data-k="claim" data-v="mutual" aria-pressed="${state.claim==='mutual'}">Rebbe &amp; close</button>
    </div>
    ${state.year ? `<div class="chips sub">
      <span class="within">in ${esc(state.year)}</span>
      ${levelsIn(state.year).map(l=>`<button class="chip" data-k="level" data-v="${esc(l)}" aria-pressed="${state.level===l}">${esc(l)}</button>`).join('')}
    </div>` : (state.level ? `<div class="chips sub">
      <span class="within">any year</span>
      ${levels.map(l=>`<button class="chip" data-k="level" data-v="${esc(l)}" aria-pressed="${state.level===l}">${esc(l)}</button>`).join('')}
    </div>` : '')}
    <div class="count">${rows.length} ${state.tab==='mine'?'of yours':'of '+DATA.length}</div>
    <div class="body">
      ${rows.length?rows.map(p=>`<div class="row">
        <button class="rowmain" data-id="${p.id}">
          <span class="avatar">${initials(p.name)}</span>
          <span class="who"><span class="nm">${esc(p.name)}</span>
            <span class="sub">${esc([p.city,p.occupation||p.college].filter(Boolean).join(' · ')||'—')}</span></span>
          ${p.dnc?'<span class="dot dnc"></span>':''}${p.spotlight?'<span class="dot spot"></span>':''}
          ${p.claimedBy.length?'':'<span class="unclaimed" title="No rebbe has claimed him">unclaimed</span>'}
          <span class="yr">${range(p.years)}</span>
        </button>
        <span class="quick">
          <button class="qb wa" data-tap="wa" data-id="${p.id}" ${p.dnc||!p.phone?'disabled':''}
            title="${p.dnc?'Do not contact':(p.phone? (p.hasWhatsapp?'WhatsApp':'Call'):'No number')}"
            >${p.hasWhatsapp&&p.phone?'💬':'📞'}</button>
          <button class="qb em" data-tap="em" data-id="${p.id}" ${p.dnc||!p.email?'disabled':''}
            title="${p.dnc?'Do not contact':(p.email?'Email':'No email')}">✉️</button>
        </span>
      </div>`).join('')
      :'<p class="empty">Nobody matches that.</p>'}
    </div>`, appbar());
}

function renderDetail(){
  const p = DATA.find(x=>x.id===state.selected);
  const tapped = k => state.taps.includes(p.id+':'+k);
  const waLabel = p.hasWhatsapp ? 'WhatsApp' : 'No WhatsApp — calls instead';
  shell('p-contacts', `
    <button class="back" id="back">‹ ${state.tab==='mine'?'My alumni':'Contacts'}</button>
    <div class="body">
      <div class="dhead">
        <h2>${esc(p.name)}</h2>
        ${p.aliases.length?`<div class="alias">also recorded as ${esc(p.aliases.join(', '))}</div>`:''}
        <div class="badges">
          ${p.levels.map(l=>`<span class="badge cy">${esc(l)}</span>`).join('')}
          ${p.spotlight?'<span class="badge wn">Spotlight</span>':''}
          ${p.dnc?'<span class="badge bd">Do not contact</span>':''}
        </div>
      </div>
      ${p.dnc?`<div class="sect"><h3>Why he is flagged</h3>
        <p class="prose">${esc(p.dncReason||'Asked not to be contacted.')}</p></div>`:''}
      <div class="sect">
        <h3>Reach him</h3>
        <button class="tap" data-tap="wa" data-id="${p.id}" ${p.dnc||!p.phone?'disabled':''}>
          <span class="gl ${p.hasWhatsapp?'wa':'ph'}">${p.hasWhatsapp?'\u{1F4AC}':'\u{1F4DE}'}</span>
          <span class="val">${esc(p.phone||'No number on file')}</span>
          <span class="go">${p.phone?waLabel:''}</span></button>
        ${tapped('wa')?'<p class="logged">Logged: you reached out today</p>':''}
        <button class="tap" data-tap="em" data-id="${p.id}" ${p.dnc||!p.email?'disabled':''}>
          <span class="gl em">\u{2709}\u{FE0F}</span>
          <span class="val">${esc(p.email||'No email on file')}</span>
          <span class="go">${p.email?'Email':''}</span></button>
        ${tapped('em')?'<p class="logged">Logged: you reached out today</p>':''}
      </div>
      <div class="sect"><h3>In the program</h3>
        ${p.years.map((y,i)=>`<div class="tl"><b>${y}</b><span>${esc(p.levels[i]||'—')}</span></div>`).join('')}
      </div>
      <div class="sect"><h3>Alumni shabbaton</h3>
        ${p.shabbatons.length
          ? `<div class="pill-row">${p.shabbatons.map(y=>`<span class="badge cy">${y}</span>`).join('')}</div>`
          : '<p class="prose">&mdash;</p>'}</div>
      <div class="sect"><h3>Contact history</h3>
        <p class="prose">${p.lastContact
          ? `Last reached out ${fmt(p.lastContact)}${p.lastContactBy?' by '+esc(p.lastContactBy):''}.`
          : 'Nobody has reached out through the app yet.'}</p></div>
      <div class="sect"><h3>Life</h3>
        <p class="prose">${esc([p.college,p.occupation,p.spouse&&'Married to '+p.spouse,
          [p.city,p.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ')||'Nothing on file yet.')}</p></div>
      ${(p.learning||p.impact)?`<div class="sect"><h3>Learning &amp; impact</h3>
        <p class="prose">${esc(p.learning||p.impact)}</p></div>`:''}
      <div class="sect"><h3>His rebbe in the program</h3>
        ${p.programRebbeim.length
          ? p.programRebbeim.map(r=>`<div class="tl"><b>${r.year}</b>
              <span>${esc(r.rebbe)}${p.mutual.includes(r.rebbe)?' <span class="both">also close</span>':''}</span></div>`).join('')
          : '<p class="prose">Not recorded.</p>'}
        <p class="srcnote">From the alumni database — who his rebbe was.</p>
      </div>
      <div class="sect"><h3>Rebbeim who say they are close with him</h3>
        ${p.claimedBy.length
          ? `<div class="pill-row">${p.claimedBy.map(r=>
              `<span class="badge ${p.mutual.includes(r)?'cy':''}">${esc(r)}</span>`).join('')}</div>`
          : '<p class="prose">Nobody has claimed him.</p>'}
        <p class="srcnote">From the rebbeim's own sheet — their answer, not his.</p>
      </div>
    </div>`, appbar());
}

function render(){
  renderHome(); renderReport();
  if(state.tab==='report'||state.tab==='home'){ renderContacts(); } else { renderContacts(); }
}

document.addEventListener('input', e=>{
  if(e.target.id==='q'){ state.q=e.target.value; renderContacts();
    const b=document.getElementById('q'); b.focus(); b.setSelectionRange(b.value.length,b.value.length); }
});
document.addEventListener('change', e=>{
  const id=e.target.id;
  if(id==='r-alum'){ state.rAlum=e.target.value; if(state.rAlum) state.rRebbe=''; state.rType=''; renderReport(); }
  if(id==='r-rebbe'){ state.rRebbe=e.target.value; if(state.rRebbe) state.rAlum=''; state.rType=''; renderReport(); }
  if(id==='r-type'){ state.rType=e.target.value; state.rDate=''; renderReport(); }
  if(id==='r-date'){ state.rDate=e.target.value; renderReport(); }
});
document.addEventListener('click', e=>{
  const t=e.target;
  if(t.closest('#bell')){ state.notif=!state.notif; renderHome(); return; }
  const tab=t.closest('.tab');
  if(tab){ state.tab=tab.dataset.tab; state.selected=null; render(); return; }
  const chip=t.closest('.chip');
  if(chip){
    const {k,v}=chip.dataset;
    state[k] = (v==='' || state[k]===v) ? null : v;
    // A level only means something inside a year, so dropping the year drops it.
    if(k==='year' && !state.year) state.level=null;
    if(k==='year' && state.level && !levelsIn(state.year).includes(state.level)) state.level=null;
    // The feed has its own chips; they must redraw Home, not the contacts list.
    if(k.startsWith('feed')) renderHome(); else renderContacts();
    return; }
  const row=t.closest('.rowmain');
  if(row){ state.selected=+row.dataset.id; renderDetail(); return; }
  if(t.closest('#back')){ state.selected=null; renderContacts(); return; }
  const tap=t.closest('.tap, .qb');
  if(tap && !tap.disabled){
    state.taps.push(tap.dataset.id+':'+tap.dataset.tap);
    if(tap.classList.contains('qb')){ renderContacts(); } else { renderDetail(); }
    return; }
  if(t.closest('#r-go')){
    const who = state.rRebbe || (DATA.find(p=>p.id==state.rAlum)||{}).name;
    const label = (state.rRebbe?REBBE_TYPES:ALUMNUS_TYPES).find(x=>x[0]===state.rType);
    state.submitted = who+' — '+(label?label[1].toLowerCase():'');
    renderReport(); return;
  }
});

render();
</script>
"""


if __name__ == "__main__":
    main()
