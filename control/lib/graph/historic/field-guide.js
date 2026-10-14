/**
 * historic/field-guide — a historic scene read as a field guide: what the solver chose for it and why, and the knob that
 * changes each thing. Served from /bible like a city's plan book. Drawn from the manifest every time, never stored.
 *
 *   the cover      the caption (place, period, how it is drawn), the scene, the record's basis, the counts
 *   the plan       the solved plan from above (./solver/sheet.js), its monuments and views marked
 *   the principles one section per part of the form (./form/schema.js): its values, each the `form` path that changes
 *                  it and what that path takes; the record's rows it stands on (their dates, confidence and sources)
 *   the monuments  each one's record size, what it is, what it stands on
 *   what they had  at its place and year (./ledger/): the surfaces a wall could show, the roofs, the storeys, each made
 *                  by named rows; the anachronisms found
 *   the laws       walkability, advisory: what holds, what does not
 *   the views      the `view`s it opens on; the slices of life (`scene: 'slice', focus`) it can be cut round
 *
 * `historicGuideHtml(manifest, { ref })` is pure: the same manifest, the same page.
 */
import { historicOptions, historicFoci } from './historic-kind.js';
import { planHistoricCity, HISTORIC_CULTURES } from './historic-city.js';
import { FORM_SCHEMA, FORM_KEYS, WHERE } from './form/schema.js';
import { MONUMENTS } from './monuments/index.js';
import { ledgerRow } from './ledger/index.js';
import { planSheetSvg } from './solver/sheet.js';
import { describeHistoric, fmtYear } from '../depiction.js';
import { BASIS } from './entries.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const show = (v) => (Array.isArray(v) ? `[${v.map((x) => (isObj(x) ? JSON.stringify(x) : x)).join(', ')}]` : isObj(v) ? JSON.stringify(v) : String(v));
/** What a leaf of the form takes, in words: its validator's own refusal of nothing. */
const takes = (leaf) => (typeof leaf === 'function' ? leaf(undefined, '') ?? '' : '');
const spanOf = (e) => (e.kind === 'type' ? e.built : e.attested);

const WHY = {
  frame: 'the ground each scene plans on: the town, the region round it (a slice is cut from the region)',
  site: 'the lie of the land: flat, a bluff, a hill in terraces, a plateau; where the high ground is',
  water: 'none, a canal through the town, a river along a side, the sea',
  armature: 'what the town is organised round: its monument at the heart, at the end of an axis, on the summit, at a forum\'s head',
  enclosure: 'a ring wall with towers and gates, walled wards, or none',
  streets: 'the street pattern, the widths, how far apart the alleys run and how often they jog',
  density: 'the lot sizes and the gap between neighbours',
  houses: 'the house assets by size: the largest whose threshold a lot meets',
  walls: 'the wall\'s assets: its runs, towers and gates',
  placement: 'what stands by meaning or need, and where',
  hinterland: 'the fields and trees outside the town',
  activities: 'the work done in the land: the farm and the crafts, laid in the region and its slices',
  borrow: 'the cultures whose kits stand in where this one has no asset of its own',
};

/** The rows a principle cites, as a table: each with its date, its basis and its sources; out of reach marked. */
function citeRows(keys, place, findings) {
  const out = (keys || []).map((k) => {
    const r = ledgerRow(k);
    if (!r) return `<tr class="open"><td><code>${esc(k)}</code></td><td colspan="3">not a ledger row</td></tr>`;
    const e = r.entry, s = spanOf(e), late = findings.some((f) => f.id === k);
    return `<tr class="${late ? 'open' : 'ok'}"><td><b>${esc(e.name)}</b><div class="why"><code>${esc(k)}</code></div></td><td>${s ? `${fmtYear(s.from)}${s.to ? `–${fmtYear(s.to)}` : ' on'}` : '—'}${late ? `<div class="why">not yet in reach at ${fmtYear(place.year)}</div>` : ''}</td><td>${esc(BASIS[e.confidence] ?? e.confidence)}</td><td>${(e.sources || []).slice(0, 3).map((x) => esc(`${x.author}, ${x.title} (${x.year})`)).join('<br>')}</td></tr>`;
  });
  return out.length ? `<table><tr><th>stands on</th><th>attested</th><th>basis</th><th>sources</th></tr>${out.join('')}</table>` : '<p class="why">No record row cited for this yet: read it as CONJECTURAL.</p>';
}

/** One principle's values: the `form` path of each leaf, its value, what it takes. */
function valueRows(key, value, schema, kit) {
  const rows = [];
  const walk = (v, sch, path) => {
    if (isObj(v) && isObj(sch)) { for (const [k, x] of Object.entries(v)) walk(x, sch[k], `${path}.${k}`); return; }
    const t = takes(sch), assetLeaf = /an asset id/.test(t);
    rows.push(`<tr><td><code>${esc(path)}</code></td><td>${esc(show(v))}</td><td class="why">${esc(t)}${assetLeaf ? ` — this kit: ${esc(Object.keys(kit).slice(0, 24).join(', '))}${Object.keys(kit).length > 24 ? ' …' : ''}` : ''}</td></tr>`);
  };
  if (Array.isArray(value)) value.forEach((x, i) => rows.push(`<tr><td><code>form.${key}[${i}]</code></td><td>${esc(show(x))}</td><td class="why">${esc(key === 'placement' && x.where ? WHERE[x.where] : '')}</td></tr>`));
  else walk(value, schema, `form.${key}`);
  return `<table><tr><th>knob</th><th>value</th><th>takes</th></tr>${rows.join('')}</table>`;
}

/** A historic manifest's field guide, as a self-contained page. */
export function historicGuideHtml(m, { ref = null } = {}) {
  const { scene, opts } = historicOptions(m);
  const plan = planHistoricCity(opts), F = plan.form, K = HISTORIC_CULTURES[opts.culture], d = describeHistoric({ ...m, scene });
  const L = plan.ledger, place = L.place, kit = { ...Object.assign({}, ...(F.borrow || []).map((b) => HISTORIC_CULTURES[b]?.assets || {})), ...(K.assets || {}) };
  const R = K.record, basis = R ? Object.entries(R.entries.reduce((n, e) => ({ ...n, [e.confidence]: (n[e.confidence] || 0) + 1 }), {})).map(([k, n]) => `${n} ${BASIS[k] ?? k}`).join(' · ') : 'no record yet: every part CONJECTURAL';
  const title = m.title || d.subject;
  const principles = FORM_KEYS.filter((k) => k !== 'label' && k !== 'cites' && F[k] !== undefined).map((k) => `<section><h3>${esc(k)}</h3><p class="why">${esc(WHY[k] ?? '')}</p>${valueRows(k, F[k], FORM_SCHEMA[k], kit)}${citeRows(F.cites?.[k], place, L.findings)}</section>`).join('');
  const monuments = plan.stats.monuments.map((x) => { const M = MONUMENTS[x.id]; return `<tr><td><b>${esc(M.label)}</b><div class="why"><code>${esc(x.id)}</code>${x.main ? ' · the armature\'s' : ''}</div></td><td>${esc(M.read)}</td><td>${M.size[0]} × ${M.size[1]} m · faces ${esc(x.facing)}</td><td>${citeRows(M.cites, place, L.findings)}</td></tr>`; }).join('');
  const made = (list, word) => list.map((x) => `<tr><td><b>${esc(x.id)}</b><div class="why">${esc(x.read)}</div></td><td>${x.by.map((k) => `<code>${esc(k)}</code>`).join(' ')}</td></tr>`).join('') || `<tr><td colspan="2" class="why">no ${word} in reach</td></tr>`;
  const B = L.buildable, storeys = B.storeys ? `${B.storeys.range[0]}–${B.storeys.range[1]} storeys, from ${B.storeys.by.map((k) => `<code>${esc(k)}</code>`).join(', ')}` : 'not stated by any house type in reach';
  const laws = plan.laws.map((l) => `<tr class="${l.ok ? 'ok' : 'open'}"><td><b>${esc(l.id)}</b></td><td>${esc(l.want)}</td><td>${esc(l.detail)}</td></tr>`).join('');
  const findings = L.findings.length ? `<ul>${L.findings.map((f) => `<li>${esc(f.message)}</li>`).join('')}</ul>` : '<p class="why">Nothing used here is outside what its place had at its year.</p>';
  const notes = plan.notes.length ? `<ul>${plan.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : '';
  const views = ['aerial', 'approach', ...Object.keys(plan.views)].map((v) => `<code>${esc(v)}</code>`).join(' ');
  const foci = historicFoci(opts).map((f) => `<code>${esc(f)}</code>`).join(' ');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · field guide</title>
<style>
:root{--bg:#f6f3ea;--ink:#26231d;--muted:#6f6a5f;--rule:#ddd5c2;--card:#fffdf7;--open:#a8442e;--ok:#3f6e44}
@media (prefers-color-scheme:dark){:root{--bg:#18170f;--ink:#e8e2d2;--muted:#a39d8c;--rule:#38352b;--card:#22201a}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px 64px}h1{font-size:28px;margin:0 0 4px}h2{margin:36px 0 10px;font-size:20px;border-bottom:1px solid var(--rule);padding-bottom:6px}h3{margin:22px 0 4px;font-size:16px}
.sub,.why{color:var(--muted)}.why{font-size:13px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:16px}
.stat{background:var(--card);border:1px solid var(--rule);border-radius:8px;padding:10px 12px}.stat b{display:block;font-size:20px}.stat span{color:var(--muted);font-size:13px}
.sheet{width:100%;height:auto;border:1px solid var(--rule);border-radius:6px}table{width:100%;border-collapse:collapse;font-size:14px;margin:6px 0}td,th{border-bottom:1px solid var(--rule);padding:6px 8px;text-align:left;vertical-align:top}
th{font-weight:600;color:var(--muted);font-size:13px}tr.open td:first-child b{color:var(--open)}tr.ok td:first-child b{color:var(--ok)}code{font-size:12.5px;word-break:break-word}section{background:var(--card);border:1px solid var(--rule);border-radius:8px;padding:4px 14px 10px;margin:12px 0;overflow-x:auto}
</style></head><body><main>
<h1>${esc(title)}</h1>
<div class="sub">${esc(d.caption)}</div>
<div class="sub">scene <code>${esc(scene)}</code>${opts.focus ? ` round <code>${esc(opts.focus)}</code>` : ''} · seed ${opts.seed} · read at ${fmtYear(place.year)} in ${esc(place.region)}${ref ? ` · <code>${esc(ref)}</code>` : ''}</div>
<div class="grid">
<div class="stat"><b>${plan.stats.houses}</b><span>houses</span></div>
<div class="stat"><b>${plan.stats.monuments.length}</b><span>monuments</span></div>
<div class="stat"><b>${plan.stats.activities.length}</b><span>activities in the land</span></div>
<div class="stat"><b>${Math.round(plan.frame.w)} × ${Math.round(plan.frame.d)} m</b><span>frame</span></div>
</div>
<p class="sub">A general depiction of its period, solved from its form: expect anachronisms where the record is thin. The record's basis: ${esc(basis)}. Change any part with <code>update_sketch</code>: a manifest's <code>form</code> rewrites the culture's (<code>{ "form": { "streets": { "jog": 0 } } }</code>), refused by name when a knob or value is not one.</p>
<h2>The plan</h2>
${planSheetSvg(plan, { width: 1060 })}
<h2>The principles</h2>
${principles}
<h2>The monuments</h2>
<div style="overflow-x:auto"><table><tr><th>monument</th><th>what it is</th><th>size</th><th>stands on</th></tr>${monuments}</table></div>
<h2>What its builders had, at ${fmtYear(place.year)}</h2>
<h3>Wall surfaces</h3><table><tr><th>surface</th><th>made by</th></tr>${made(B.surfaces, 'surface')}</table>
<h3>Roofs</h3><table><tr><th>roof</th><th>made by</th></tr>${made(B.roofs, 'roof')}</table>
<p>Houses: ${storeys}.</p>
<h3>Anachronisms</h3>${findings}
${notes ? `<h3>What the solver left out</h3>${notes}` : ''}
<h2>The laws</h2>
<table><tr><th>law</th><th>wants</th><th>here</th></tr>${laws}</table>
<h2>Views and slices</h2>
<p><code>view</code>: ${views}</p>
<p><code>scene: 'slice'</code>, <code>focus</code>: ${foci}</p>
</main></body></html>`;
}
