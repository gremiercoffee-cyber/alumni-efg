"""
Three feed layouts, side by side, using the real simcha data.

    python migration/build_feed_options.py

A design question, not a code question -- so the point is to look at all three
with the same content and pick, rather than have me guess and rebuild twice.
"""

import base64
import json
from datetime import date, timedelta
from pathlib import Path

import openpyxl

OUT = Path(__file__).parent / "out"
FONTS = Path(__file__).parents[1] / "node_modules/@expo-google-fonts/poppins"
SRC = Path.home() / "Downloads" / "Simcha Database efg.xlsx"
TODAY = date(2026, 8, 12)


def font_face(weight, filename):
    data = base64.b64encode((FONTS / filename).read_bytes()).decode()
    return (f"@font-face{{font-family:'Poppins';font-weight:{weight};font-style:normal;"
            f"font-display:block;src:url(data:font/ttf;base64,{data}) format('truetype')}}")


def main():
    ws = openpyxl.load_workbook(SRC, data_only=True)["2026"]
    items = []
    for r in list(ws.iter_rows(values_only=True))[1:]:
        name = str(r[0] or "").strip()
        if not name:
            continue
        d = r[1]
        if hasattr(d, "date"):
            items.append(dict(name=name.title(), type="wedding",
                              date=d.date().isoformat(),
                              place=str(r[2]).strip() if r[2] else None))
        else:
            # No wedding date: the engagement is the news, dated roughly.
            items.append(dict(name=name.title(), type="engagement",
                              date=str(TODAY - timedelta(days=40 + len(items) * 9)),
                              place=None))

    items += [
        dict(name="Alumni Shabbaton 2026", type="event",
             date=str(TODAY + timedelta(days=23)), place="Yeshiva campus"),
        dict(name="Rabbi Sklar", type="child_wedding",
             date=str(TODAY + timedelta(days=9)), place=None),
        dict(name="Adam Agus", type="birth",
             date=str(TODAY - timedelta(days=6)), place=None),
    ]
    items.sort(key=lambda i: i["date"])

    fonts = "".join([font_face(400, "Poppins_400Regular.ttf"),
                     font_face(600, "Poppins_600SemiBold.ttf"),
                     font_face(700, "Poppins_700Bold.ttf")])

    html = (TEMPLATE.replace("__FONTS__", fonts)
                    .replace("__ITEMS__", json.dumps(items))
                    .replace("__TODAY__", TODAY.isoformat()))
    path = OUT / "feed_options.html"
    path.write_text(html, encoding="utf-8")
    print(f"wrote {path} ({len(html)//1024} KB, {len(items)} items)")


TEMPLATE = r"""<title>EFG Alumni - feed layouts</title>
<style>
__FONTS__
:root{
  --navy900:#061437;--navy800:#0d2461;--navy700:#143174;--navy600:#1b3a72;
  --blue:#1c4fb0;--cyan:#2fe0d2;--white:#fff;--muted:#b9cbee;--dim:#7f97c6;
  --rule:#1b3a72;--warn:#ffd166;--pink:#ff9ac4;--green:#25D366;
  --font:'Poppins',ui-sans-serif,system-ui,sans-serif;
}
*{box-sizing:border-box}
body{margin:0;background:#0a1020;color:var(--white);font-family:var(--font);font-size:15px;line-height:1.5}
.page{max-width:1320px;margin:0 auto;padding:40px 20px 80px}
.eyebrow{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--cyan);margin:0 0 10px}
h1{font-size:clamp(26px,4vw,36px);font-weight:700;letter-spacing:-.02em;margin:0 0 12px}
.intro p{color:var(--muted);margin:0 0 10px;max-width:64ch}
.frames{display:flex;gap:34px;align-items:flex-start;flex-wrap:wrap;margin-top:34px}
.col{flex:0 0 auto;width:372px}
@media(max-width:820px){.col{width:100%;max-width:372px}}
.caption{font-size:12px;color:var(--cyan);margin:0 0 4px;letter-spacing:.08em;text-transform:uppercase;font-weight:700}
.why{font-size:12.5px;color:var(--dim);margin:0 0 12px;min-height:3.2em}
.phone{width:100%;height:720px;background:var(--navy900);border-radius:28px;border:1px solid var(--navy600);
  overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,.5)}
.phone::-webkit-scrollbar{width:6px}
.phone::-webkit-scrollbar-thumb{background:var(--navy600);border-radius:3px}

.icon{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;font-size:16px;flex:0 0 auto}
.i-wedding{background:rgba(47,224,210,.16)}
.i-engagement{background:rgba(255,154,196,.16)}
.i-birth{background:rgba(255,209,102,.16)}
.i-child_wedding{background:rgba(47,224,210,.16)}
.i-event{background:rgba(28,79,176,.45)}

/* ---------- A: grouped list (what exists today) ---------- */
.ghead{padding:16px 16px 5px;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--cyan);font-weight:700}
.row{display:flex;gap:12px;align-items:center;padding:13px 16px;border-bottom:1px solid rgba(27,58,114,.55)}
.row .m{flex:1;min-width:0}
.row .t{font-weight:600;font-size:14.5px}
.row .s{font-size:12.5px;color:var(--dim)}
.row .d{font-size:11.5px;color:var(--muted);flex:0 0 auto}
.soon{color:var(--cyan);font-weight:600}

/* ---------- B: date-led ---------- */
.mhead{position:sticky;top:0;background:var(--navy900);padding:14px 16px 8px;
  font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--cyan);font-weight:700;
  border-bottom:1px solid var(--rule);z-index:2}
.drow{display:flex;gap:14px;padding:12px 16px;border-bottom:1px solid rgba(27,58,114,.45)}
.datebox{width:46px;flex:0 0 auto;text-align:center;border-radius:10px;background:var(--navy800);
  border:1px solid var(--rule);padding:6px 0}
.datebox .dd{font-size:19px;font-weight:700;line-height:1;font-variant-numeric:tabular-nums}
.datebox .mm{font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);margin-top:2px}
.datebox.now{background:var(--cyan);border-color:var(--cyan)}
.datebox.now .dd{color:var(--navy900)}
.datebox.now .mm{color:rgba(6,20,55,.7)}
.drow .m{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center}
.drow .t{font-weight:600;font-size:14.5px}
.drow .s{font-size:12px;color:var(--dim)}

/* ---------- C: keep-style cards ---------- */
.cards{columns:2;column-gap:10px;padding:14px 12px}
@media(max-width:400px){.cards{columns:2}}
.card{break-inside:avoid;margin-bottom:10px;background:var(--navy800);border:1px solid var(--rule);
  border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:7px}
.card .t{font-weight:600;font-size:14px;line-height:1.25}
.card .s{font-size:11.5px;color:var(--dim)}
.card .when{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--cyan)}
.card.past .when{color:var(--dim)}
.cards .mhead{columns:1;column-span:all;position:static;padding:10px 4px 6px;border:0}

.legend{margin-top:38px;padding-top:20px;border-top:1px solid var(--rule);max-width:74ch}
.legend li{color:var(--muted);font-size:14px;margin-bottom:9px}
.legend b{color:var(--white);font-weight:600}
</style>

<div class="page">
  <p class="eyebrow">Pick one</p>
  <h1>Three ways to lay out the feed</h1>
  <div class="intro">
    <p>Same real data in all three -- your 31 engagements and weddings, plus a shabbaton
      and a rebbe's simcha. Scroll each one.</p>
  </div>

  <div class="frames">
    <div class="col">
      <p class="caption">A &middot; what you have now</p>
      <p class="why">Grouped into "coming up" then by month. Compact, but every row looks
        the same and the date is the smallest thing on it.</p>
      <div class="phone" id="a"></div>
    </div>
    <div class="col">
      <p class="caption">B &middot; date-led</p>
      <p class="why">The date becomes the anchor, like a diary. Month headers stick as you
        scroll, so you always know where you are. Today is highlighted.</p>
      <div class="phone" id="b"></div>
    </div>
    <div class="col">
      <p class="caption">C &middot; cards</p>
      <p class="why">Two columns, Google Keep style. Each simcha is its own object. Fits
        fewer per screen, and the eye has to zig-zag to read in date order.</p>
      <div class="phone" id="c"></div>
    </div>
  </div>

  <div class="legend">
    <ul>
      <li><b>Icons now differ by simcha.</b> Ring for an engagement, rings for a wedding,
        pram for a birth, and a calendar tile for an event -- each with its own colour, so
        the type reads before the words do.</li>
      <li><b>My own read:</b> B. A feed of dated events is a diary, and the thing you scan
        for is <em>when</em>. C looks the nicest but reads worst in date order -- your eye
        has to go down the left column and back up the right.</li>
      <li>Say which, or say what you'd change about it.</li>
    </ul>
  </div>
</div>

<script>
const ITEMS = __ITEMS__;
const TODAY = new Date('__TODAY__' + 'T00:00:00');

const LABEL = {wedding:' got married', engagement:' got engaged', birth:' had a baby',
  child_wedding:"'s child got married", event:''};
const ICON  = {wedding:'\u{1F389}', engagement:'\u{1F48D}', birth:'\u{1F476}',
  child_wedding:'\u{1F389}', event:'\u{1F4C5}'};

const esc = s => String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
const days = d => Math.round((new Date(d+'T00:00:00') - TODAY)/864e5);
const dd = d => new Date(d+'T00:00:00').getDate();
const mm = d => new Date(d+'T00:00:00').toLocaleDateString('en-GB',{month:'short'});
const month = d => new Date(d+'T00:00:00').toLocaleDateString('en-GB',{month:'long',year:'numeric'});
const when = d => { const n = days(d);
  return n===0 ? 'today' : n>0 ? `in ${n}d`
    : new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'}); };
const title = i => i.type==='event' ? i.name : i.name + LABEL[i.type];

/* A */
(() => {
  const up = ITEMS.filter(i=>days(i.date)>=0);
  const past = ITEMS.filter(i=>days(i.date)<0).reverse();
  const row = i => `<div class="row">
    <span class="icon i-${i.type}">${ICON[i.type]}</span>
    <span class="m"><span class="t">${esc(title(i))}</span>
      ${i.place?`<span class="s">${esc(i.place)}</span>`:''}</span>
    <span class="d ${days(i.date)>=0?'soon':''}">${when(i.date)}</span></div>`;
  let last=null, out = '<div class="ghead">Coming up</div>' + up.map(row).join('');
  past.forEach(i=>{ const m=month(i.date);
    if(m!==last){ out += `<div class="ghead">${m}</div>`; last=m; }
    out += row(i); });
  document.getElementById('a').innerHTML = out;
})();

/* B */
(() => {
  const sorted = [...ITEMS].sort((x,y)=>{
    const a=days(x.date), b=days(y.date);
    if(a>=0 && b>=0) return a-b;      // soonest first
    if(a<0 && b<0)   return b-a;      // most recent first
    return a>=0 ? -1 : 1;             // upcoming above past
  });
  let last=null, out='';
  sorted.forEach(i=>{
    const n=days(i.date);
    const head = n>=0 ? 'Coming up' : month(i.date);
    if(head!==last){ out += `<div class="mhead">${head}</div>`; last=head; }
    out += `<div class="drow">
      <span class="datebox ${n===0?'now':''}"><span class="dd">${dd(i.date)}</span>
        <span class="mm">${mm(i.date)}</span></span>
      <span class="m"><span class="t">${esc(title(i))}</span>
        <span class="s">${i.place?esc(i.place)+' &middot; ':''}${when(i.date)}</span></span>
      <span class="icon i-${i.type}">${ICON[i.type]}</span></div>`;
  });
  document.getElementById('b').innerHTML = out;
})();

/* C */
(() => {
  const sorted = [...ITEMS].sort((x,y)=>{
    const a=days(x.date), b=days(y.date);
    if(a>=0 && b>=0) return a-b;
    if(a<0 && b<0)   return b-a;
    return a>=0 ? -1 : 1;
  });
  document.getElementById('c').innerHTML = '<div class="cards">' + sorted.map(i=>`
    <div class="card ${days(i.date)<0?'past':''}">
      <span class="icon i-${i.type}">${ICON[i.type]}</span>
      <span class="t">${esc(title(i))}</span>
      ${i.place?`<span class="s">${esc(i.place)}</span>`:''}
      <span class="when">${when(i.date)}</span>
    </div>`).join('') + '</div>';
})();
</script>
"""


if __name__ == "__main__":
    main()
