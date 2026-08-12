"""
Generate the merge review page from analyze.py's output.

    python migration/analyze.py && python migration/build_review.py

Writes migration/out/review.html -- a self-contained page for approving or
rejecting each proposed merge. Decisions persist in the browser and export as
decisions.json, which analyze.py reads back on the next run.
"""

import json
from pathlib import Path

OUT = Path(__file__).parent / "out"

CSS = """
:root{
  --ground:#f4f7fb; --surface:#ffffff; --surface-2:#e6edf7;
  --ink:#061437; --ink-2:#3a4d7a; --ink-3:#7286aa;
  --rule:#d3deec; --rule-2:#b6c6de;
  --accent:#1c4fb0; --accent-soft:#e2ebfa;
  --merge:#0f7a6d; --merge-soft:#dff5f2;
  --separate:#a33a4e; --separate-soft:#fae3e8;
  --diff:#ffd166; --diff-ink:#3d2c00; --on-strong:#ffffff;
  --serif:Poppins,ui-sans-serif,system-ui,"Segoe UI",Roboto,sans-serif;
  --sans:Poppins,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  --mono:ui-monospace,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace;
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --ground:#061437; --surface:#0d2461; --surface-2:#143174;
    --ink:#ffffff; --ink-2:#b9cbee; --ink-3:#7f97c6;
    --rule:#1b3a72; --rule-2:#2a5099;
    --accent:#2fe0d2; --accent-soft:#0b2f6b;
    --merge:#2fe0d2; --merge-soft:#0b3b43;
    --separate:#ff9aa8; --separate-soft:#4a1626;
    --diff:#8a6a12; --diff-ink:#ffe9b0; --on-strong:#061437;
  }
}
:root[data-theme="dark"]{
  --ground:#061437; --surface:#0d2461; --surface-2:#143174;
    --ink:#ffffff; --ink-2:#b9cbee; --ink-3:#7f97c6;
    --rule:#1b3a72; --rule-2:#2a5099;
    --accent:#2fe0d2; --accent-soft:#0b2f6b;
    --merge:#2fe0d2; --merge-soft:#0b3b43;
    --separate:#ff9aa8; --separate-soft:#4a1626;
    --diff:#8a6a12; --diff-ink:#ffe9b0; --on-strong:#061437;
}

*{box-sizing:border-box}
body{
  margin:0; background:var(--ground); color:var(--ink);
  font-family:var(--sans); font-size:15px; line-height:1.55;
  -webkit-font-smoothing:antialiased;
}
.wrap{max-width:1000px; margin:0 auto; padding:0 20px 96px}

/* --- masthead --- */
header{padding:56px 0 28px; border-bottom:3px solid var(--accent)}
h1{
  font-family:var(--serif); font-weight:700; font-size:clamp(28px,4.5vw,40px);
  margin:0 0 8px; letter-spacing:-.02em; text-wrap:balance;
}
.standfirst{margin:0; max-width:62ch; color:var(--ink-2); font-size:16px}
.eyebrow{
  font-size:11px; font-weight:700; letter-spacing:.14em; text-transform:uppercase;
  color:var(--accent); margin:0 0 14px;
}

/* --- sticky control bar --- */
.bar{
  position:sticky; top:0; z-index:10; background:var(--ground);
  border-bottom:1px solid var(--rule); padding:12px 0;
  display:flex; flex-wrap:wrap; gap:12px; align-items:center;
}
.tally{display:flex; gap:16px; font-size:13px; font-variant-numeric:tabular-nums}
.tally b{font-weight:600}
.tally .m b{color:var(--merge)} .tally .s b{color:var(--separate)}
.spacer{flex:1 1 auto}
.filters{display:flex; gap:4px}
button{font:inherit; cursor:pointer; border-radius:6px; border:1px solid var(--rule-2)}
button:focus-visible{outline:2px solid var(--accent); outline-offset:2px}
.chip{
  background:var(--surface); color:var(--ink-2); padding:5px 11px; font-size:13px;
}
.chip[aria-pressed="true"]{background:var(--ink); color:var(--ground); border-color:var(--ink)}
.export{
  background:var(--accent); color:var(--on-strong); border-color:var(--accent);
  padding:6px 14px; font-size:13px; font-weight:500;
}
.progress{height:3px; background:var(--surface-2); border-radius:2px; overflow:hidden; width:100%}
.progress i{display:block; height:100%; background:var(--accent); width:0; transition:width .25s}

/* --- tier sections --- */
.tier{margin-top:40px}
.tier > h2{
  font-family:var(--serif); font-size:18px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; margin:0 0 4px;
  display:flex; align-items:baseline; gap:10px;
}
.tier > h2 .count{font-family:var(--mono); font-size:13px; color:var(--ink-3); font-weight:400}
.tier > p{margin:0 0 18px; color:var(--ink-2); font-size:14px; max-width:62ch}

/* --- a candidate --- */
.pair{
  background:var(--surface); border:1px solid var(--rule); border-radius:10px;
  margin-bottom:14px; overflow:hidden; border-left:3px solid var(--rule-2);
}
.pair[data-decision="merge"]{border-left-color:var(--merge); background:var(--merge-soft)}
.pair[data-decision="separate"]{border-left-color:var(--separate); background:var(--separate-soft)}
.pair-head{
  display:flex; gap:10px; align-items:center; flex-wrap:wrap;
  padding:10px 16px; border-bottom:1px solid var(--rule); font-size:13px; color:var(--ink-2);
}
.reason{flex:1 1 auto}
.flag{
  font-size:11px; font-weight:600; letter-spacing:.06em; text-transform:uppercase;
  padding:3px 8px; border-radius:99px; background:var(--accent-soft); color:var(--accent);
}
.flag.warn{background:var(--separate-soft); color:var(--separate)}

.records{display:grid; grid-template-columns:1fr 1fr; gap:1px; background:var(--rule)}
@media (max-width:640px){.records{grid-template-columns:1fr}}
.rec{background:var(--surface); padding:14px 16px; display:flex; flex-direction:column; gap:8px}
.pair[data-decision="merge"] .rec{background:var(--merge-soft)}
.pair[data-decision="separate"] .rec{background:var(--separate-soft)}
.rec .name{font-family:var(--mono); font-size:16px; font-weight:600; letter-spacing:-.01em; word-break:break-word}
.rec .name mark{background:var(--diff); color:var(--diff-ink); border-radius:2px; padding:0 1px}
.rec dl{display:grid; grid-template-columns:auto 1fr; gap:3px 12px; margin:0; font-size:13px}
.rec dt{color:var(--ink-3); font-size:11px; letter-spacing:.06em; text-transform:uppercase; padding-top:2px}
.rec dd{margin:0; font-family:var(--mono); font-size:12.5px; color:var(--ink-2); word-break:break-word}
.rec dd.none{color:var(--ink-3); font-style:italic; font-family:var(--sans)}

.choose{display:flex; gap:8px; padding:12px 16px; border-top:1px solid var(--rule); flex-wrap:wrap}
.choose button{padding:7px 16px; font-size:14px; background:var(--surface); color:var(--ink-2)}
.choose button[data-v="merge"][aria-pressed="true"]{background:var(--merge); border-color:var(--merge); color:var(--on-strong)}
.choose button[data-v="separate"][aria-pressed="true"]{background:var(--separate); border-color:var(--separate); color:var(--on-strong)}
.hint{margin-left:auto; align-self:center; font-size:12px; color:var(--ink-3)}

dialog{
  border:1px solid var(--rule-2); border-radius:12px; background:var(--surface);
  color:var(--ink); max-width:640px; width:92vw; padding:20px;
}
dialog::backdrop{background:rgba(10,13,18,.55)}
dialog h3{font-family:var(--serif); margin:0 0 8px; font-size:19px}
dialog p{margin:0 0 12px; color:var(--ink-2); font-size:14px}
textarea{
  width:100%; height:220px; font-family:var(--mono); font-size:12px; padding:10px;
  border:1px solid var(--rule-2); border-radius:8px; background:var(--ground); color:var(--ink);
  resize:vertical;
}
.dialog-actions{display:flex; gap:8px; margin-top:12px}
.dialog-actions button{padding:7px 14px; font-size:14px; background:var(--surface); color:var(--ink)}
.dialog-actions .primary{background:var(--accent); border-color:var(--accent); color:var(--on-strong)}
.opts{display:flex; flex-direction:column; gap:6px}
.opts button{
  display:flex; flex-direction:column; align-items:flex-start; gap:2px;
  padding:8px 12px; background:var(--surface); color:var(--ink); text-align:left; width:100%;
}
.opts button[aria-pressed="true"]{background:var(--accent); border-color:var(--accent); color:var(--on-strong)}
.opts button[aria-pressed="true"] .opt-meta{color:var(--on-strong); opacity:.75}
.opts button[data-v="new"]{border-style:dashed}
.opt-name{font-family:var(--mono); font-size:14px; font-weight:600}
.opt-name mark{background:var(--diff); color:var(--diff-ink); border-radius:2px; padding:0 1px}
.opt-meta{font-size:11px; color:var(--ink-3); letter-spacing:.04em; text-transform:uppercase}
.no-opt{margin:0 0 6px; font-size:13px; color:var(--ink-3); font-style:italic}
@media (prefers-reduced-motion:reduce){*{transition:none!important; animation:none!important}}
"""

JS = r"""
const DATA = __DATA__;
const ORPHANS = __ORPHANS__;
const KEY = 'gesher-merge-decisions';
let decisions = {};
try { decisions = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { decisions = {}; }
DATA.forEach(c => { if (c.decision && !decisions[c.key]) decisions[c.key] = c.decision; });

/* Highlight the characters of `a` that are absent from `b`, so near-identical
   names read at a glance. Longest-common-subsequence, so an insertion in the
   middle ("Ben" vs "Benjamin") marks only the inserted run -- a naive
   character-by-character walk desynchronises and marks the rest of the string. */
function diffMark(a, b) {
  const la = a.toLowerCase(), lb = b.toLowerCase();
  const n = la.length, m = lb.length;
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      L[i][j] = la[i] === lb[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    }
  }
  let out = '', run = '', i = 0, j = 0;
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const flush = () => { if (run) { out += `<mark>${esc(run)}</mark>`; run = ''; } };
  while (i < n) {
    if (j < m && la[i] === lb[j]) { flush(); out += esc(a[i]); i++; j++; }
    else if (j < m && L[i + 1][j] < L[i][j + 1]) { j++; }
    else { run += a[i]; i++; }
  }
  flush();
  return out;
}

const field = (label, value) => {
  const empty = !value || (Array.isArray(value) && !value.length);
  const shown = Array.isArray(value) ? value.join('<br>') : value;
  return `<dt>${label}</dt><dd class="${empty ? 'none' : ''}">${empty ? 'none on file' : shown}</dd>`;
};

function recordHtml(rec, otherName) {
  return `<div class="rec">
    <div class="name">${diffMark(rec.name, otherName)}</div>
    <dl>
      ${field('ID', String(rec.id))}
      ${field('Years', rec.years)}
      ${field('Email', rec.emails)}
      ${field('Rebbeim', rec.rebbeim.length ? `${rec.rebbeim.length} marked` : '')}
    </dl>
  </div>`;
}

function pairHtml(c) {
  const warn = c.same_year.length
    ? `<span class="flag warn">both in ${c.same_year.join(', ')}</span>` : '';
  const stake = c.connections_at_stake
    ? `<span class="flag">${c.connections_at_stake} rebbe connection${c.connections_at_stake === 1 ? '' : 's'}</span>` : '';
  return `<article class="pair" id="p-${c.key}" data-key="${c.key}" data-decision="${decisions[c.key] || ''}">
    <div class="pair-head"><span class="reason">${c.reason}</span>${warn}${stake}</div>
    <div class="records">${recordHtml(c.a, c.b.name)}${recordHtml(c.b, c.a.name)}</div>
    <div class="choose">
      <button data-v="merge" aria-pressed="${decisions[c.key] === 'merge'}">Same person — merge</button>
      <button data-v="separate" aria-pressed="${decisions[c.key] === 'separate'}">Different people — keep both</button>
      <span class="hint">${c.tier === 'certain' ? 'high confidence' : c.tier === 'likely' ? 'probable' : 'needs your eye'}</span>
    </div>
  </article>`;
}

/* --- second pass: year-tab rows that matched nobody in the canonical list --- */
function orphanHtml(o) {
  const r = o.row;
  const chosen = decisions[o.key] || '';
  const opts = o.suggestions.map(s => `
    <button data-v="${s.id}" aria-pressed="${chosen === String(s.id)}">
      <span class="opt-name">${diffMark(s.name, r.name)}</span>
      <span class="opt-meta">id ${s.id} · ${s.rebbeim} rebbeim${s.certain ? ' · same email' : ''}</span>
    </button>`).join('');
  return `<article class="pair orphan" data-key="${o.key}" data-decision="${chosen ? (chosen === 'new' ? 'separate' : 'merge') : ''}">
    <div class="pair-head">
      <span class="reason">Appears in <b>${r.tab}</b> but matches no one on the list</span>
      ${o.suggestions.some(s => s.certain) ? '<span class="flag">email match</span>' : ''}
    </div>
    <div class="records">
      <div class="rec">
        <div class="name">${diffMark(r.name, o.suggestions[0] ? o.suggestions[0].name : r.name)}</div>
        <dl>${field('Year', r.year)}${field('Program', r.program)}${field('Email', r.email)}</dl>
      </div>
      <div class="rec">
        <div class="opts">${opts || '<p class="no-opt">Nobody on the list resembles this name.</p>'}
          <button data-v="new" aria-pressed="${chosen === 'new'}">
            <span class="opt-name">Add as a new person</span>
            <span class="opt-meta">no existing record</span>
          </button>
        </div>
      </div>
    </div>
  </article>`;
}

const TIERS = [
  ['certain', 'Certain', 'Identical names, or two records sharing one email address. Expect to merge nearly all of these.'],
  ['likely', 'Probable', 'The same surname with a first name that is a known Hebrew/English pair, a nickname, or a one-letter typo.'],
  ['review', 'Needs your eye', 'Weaker signal — similar names that may well be different people. Brothers and cousins land here. When unsure, keep both: a wrong split is easy to fix later, a wrong merge is not.'],
];

function render() {
  const active = [...document.querySelectorAll('.chip[aria-pressed="true"]')].map(b => b.dataset.tier);
  document.getElementById('list').innerHTML = TIERS
    .filter(([t]) => active.includes(t))
    .map(([t, title, blurb]) => {
      const items = DATA.filter(c => c.tier === t);
      if (!items.length) return '';
      return `<section class="tier"><h2>${title} <span class="count">${items.length}</span></h2>
        <p>${blurb}</p>${items.map(pairHtml).join('')}</section>`;
    }).join('') + (ORPHANS.length ? `<section class="tier"><h2>Unrecognised records <span class="count">${ORPHANS.length}</span></h2>
      <p>These rows appear in a year tab under a spelling that matches nobody on the alumni list.
         Attach each to the person it belongs to, or admit it as someone new.</p>
      ${ORPHANS.map(orphanHtml).join('')}</section>` : '');
  tally();
}

function tally() {
  const total = DATA.length + ORPHANS.length;
  const done = DATA.concat(ORPHANS).filter(c => decisions[c.key]).length;
  const v = Object.values(decisions);
  document.getElementById('n-merge').textContent =
    v.filter(x => x === 'merge').length + v.filter(x => /^\d+$/.test(x)).length;
  document.getElementById('n-sep').textContent =
    v.filter(x => x === 'separate').length + v.filter(x => x === 'new').length;
  document.getElementById('n-left').textContent = total - done;
  document.querySelector('.progress i').style.width = (done / total * 100) + '%';
}

document.addEventListener('click', e => {
  const choice = e.target.closest('.choose button, .opts button');
  if (choice) {
    const pair = choice.closest('.pair');
    const key = pair.dataset.key;
    decisions[key] = decisions[key] === choice.dataset.v ? '' : choice.dataset.v;
    if (!decisions[key]) delete decisions[key];
    localStorage.setItem(KEY, JSON.stringify(decisions));
    const d = decisions[key] || '';
    pair.dataset.decision = pair.classList.contains('orphan')
      ? (d ? (d === 'new' ? 'separate' : 'merge') : '') : d;
    pair.querySelectorAll('.choose button, .opts button').forEach(b =>
      b.setAttribute('aria-pressed', String(decisions[key] === b.dataset.v)));
    tally();
    return;
  }
  const chip = e.target.closest('.chip');
  if (chip) {
    chip.setAttribute('aria-pressed', chip.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
    render();
  }
});

document.getElementById('export').addEventListener('click', () => {
  const dlg = document.getElementById('out');
  document.getElementById('json').value = JSON.stringify(decisions, null, 1);
  dlg.showModal();
});
document.getElementById('copy').addEventListener('click', async () => {
  const ta = document.getElementById('json');
  ta.select();
  try { await navigator.clipboard.writeText(ta.value); } catch (e) { document.execCommand('copy'); }
  document.getElementById('copy').textContent = 'Copied';
  setTimeout(() => { document.getElementById('copy').textContent = 'Copy'; }, 1600);
});
document.getElementById('close').addEventListener('click', () => document.getElementById('out').close());

render();
"""

HTML = """<title>Merge review — Aish Gesher alumni</title>
<style>{css}</style>
<div class="wrap">
  <header>
    <p class="eyebrow">Migration step 1 of 4 · nothing is written yet</p>
    <h1>Which of these are the same person?</h1>
    <p class="standfirst">Two things to settle before the import runs: <b>{npairs}</b> pairs that may be one
      person written twice, and <b>{norph}</b> records from the year sheets that match nobody on the alumni list.
      Merging folds two records into one, combining their program years, contact details and rebbeim.
      Your answers save as you go.</p>
  </header>

  <div class="bar">
    <div class="tally">
      <span class="m">Merge <b id="n-merge">0</b></span>
      <span class="s">Keep both <b id="n-sep">0</b></span>
      <span>Undecided <b id="n-left">0</b></span>
    </div>
    <div class="spacer"></div>
    <div class="filters">
      <button class="chip" data-tier="certain" aria-pressed="true">Certain</button>
      <button class="chip" data-tier="likely" aria-pressed="true">Probable</button>
      <button class="chip" data-tier="review" aria-pressed="true">Needs your eye</button>
    </div>
    <button class="export" id="export">Export decisions</button>
    <div class="progress"><i></i></div>
  </div>

  <div id="list"></div>
</div>

<dialog id="out">
  <h3>Decisions</h3>
  <p>Copy this and send it back to me, or save it as <code>migration/decisions.json</code>.
     The analysis reads it on the next run and keeps everything you have already answered.</p>
  <textarea id="json" readonly></textarea>
  <div class="dialog-actions">
    <button class="primary" id="copy">Copy</button>
    <button id="close">Close</button>
  </div>
</dialog>

<script>{js}</script>
"""


def main():
    cands = json.loads((OUT / "merge_candidates.json").read_text())
    orphans = json.loads((OUT / "unmatched.json").read_text())
    html = HTML.format(
        css=CSS,
        js=JS.replace("__DATA__", json.dumps(cands)).replace("__ORPHANS__", json.dumps(orphans)),
        npairs=len(cands),
        norph=len(orphans),
    )
    path = OUT / "review.html"
    path.write_text(html, encoding="utf-8")
    print(f"wrote {path}  ({len(cands)} merge pairs + {len(orphans)} unrecognised, {len(html) // 1024} KB)")


if __name__ == "__main__":
    main()
