/**
 * THE STRUCTURE BOOK — a house as one document: a tab per component concern, every tab read from the same recipe,
 * every element and object carrying one tag that links its sheet, its schedule row, its room card and the walk.
 *
 *   Cover       title block, key numbers, the sheet index, each tab given or open
 *   Site        C-101: the lot, setbacks, street, drive                                     (perimeter)
 *   Massing     A-20x: four elevations, roof and storeys
 *   Plan        A-10x per level, the grade and its five parts, egress
 *   Rooms       one card per room: its bounding elements, openings and objects, a plan crop
 *   Elements    what the structure is made of: wall types, walls, doors, windows, slabs, stairs, roof
 *   Objects     what it holds: the FF&E types, each piece, a ref piece linking its own page   (furnish / items)
 *   Structure   S-10x and the member schedule                                               (framing)
 *   Services    E-10x and the panel schedule, P-101 and the rainwater                        (framing / drainage)
 *   Quantities  cut list, sheet goods, takeoff, each a CSV                                   (framing)
 *   Checks      every check with its source; a failed check advises and never refuses
 *   Walk        the live world in a plate, the downloads, walking and filming it
 *   Open        each concern the recipe has not reached, and the field that adds it
 *
 * Anchors: rooms `#rm-101`; elements `#el-W3` (wall), `#el-101A` (door), `#el-win-A` (window type), `#el-WN4`
 * (window), `#el-wt-1` (wall type), `#el-SL1`, `#el-ST1`, `#el-B1` (member type); objects `#ob-CH-1` (type),
 * `#ob-OB12` (piece). A tag clicked on a sheet goes to its row.
 *
 * Light drafting: ink on white paper, one accent for the selected tag; dark mode darkens the frame and leaves the
 * sheets as paper. `structureBookHtml(manifest, { read, ref, world, lookup })` is pure: the same recipe gives the same
 * page. Each sheet is fenced `<!--plate:<id>-->…<!--/plate-->` so a raster can replace it.
 */

import { readStructure } from './read.js';
import { drawingSet, sheetIndex } from './sheets/index.js';
import { planDrawing } from './sheets/plan.js';
import { makeView, ftIn, areaText, sheetStyle } from './sheets/kit.js';
import { tradeTables, checkRows, stairCrowding } from './tables.js';
import { tableCsv, scheduleTables } from './sheets/schedules.js';
import { ROLES } from './trades.js';
import { openConcerns, OUTCOMES } from './open.js';

export { openConcerns };

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// the tabs a house reaches and a room never offers (a room shows them only if its recipe has them anyway)
const HOUSE_TABS = new Set(['site', 'structure', 'services', 'quantities']);
const inchesText = (ft) => `${Math.round(ft * 12 * 4) / 4} in`;
const plate = (name, svg) => `<!--plate:${name}-->${svg}<!--/plate-->`;
const r1 = (v) => Math.round(v * 10) / 10;
const pct = (v) => `${Math.round(v * 100)}%`;
const title = (s) => String(s || '').replace(/^./, (c) => c.toUpperCase());

/** The anchor of each thing the book tags, so every page links the same way. */
export const anchors = {
  room: (t) => `rm-${t}`, wall: (t) => `el-${t}`, door: (t) => `el-${t}`, windowType: (t) => `el-win-${t}`, window: (m) => `el-${m}`,
  wallType: (t) => `el-wt-${t}`, slab: (t) => `el-${t}`, stair: (t) => `el-${t}`, member: (t) => `el-${t}`, objectType: (t) => `ob-${t}`, piece: (m) => `ob-${m}`,
};
const a = (id, text) => `<a href="#${esc(id)}">${esc(text)}</a>`;
const links = (list, fn) => (list && list.length ? list.map((x) => a(fn(x), x)).join(' ') : '<span class="muted">—</span>');
const dl = (rows) => `<dl class="facts">${rows.filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;

/** An HTML schedule: columns [{ key, label, align }], rows of cells (strings of HTML), an id per row. */
function table(columns, rows, { id, cls = '' } = {}) {
  return `<div class="tw"><table class="sched ${cls}"><thead><tr>${columns.map((c) => `<th${c.align === 'end' ? ' class="r"' : ''}>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${id && id(r) ? ` id="${esc(id(r))}"` : ''}>${columns.map((c) => `<td${c.align === 'end' ? ' class="r"' : ''}>${r[c.key] ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
/** A schedule table (structure/tables.js shape) as HTML, its CSV a download beside its title. */
function dataTable(t, { first = (v) => esc(v), idOf } = {}) {
  const csv = `data:text/csv;charset=utf-8,${encodeURIComponent(tableCsv(t))}`;
  const rows = t.rows.map((r) => Object.fromEntries(t.columns.map((c, i) => [c.key, i === 0 ? first(r[c.key], r) : esc(r[c.key])])));
  if (t.total) rows.push(Object.fromEntries(t.columns.map((c) => [c.key, `<b>${esc(t.total[c.key] ?? '')}</b>`])));
  return `<div class="tblock"><div class="th"><h4>${esc(t.title)}</h4><a class="dl" download="${esc(t.id)}.csv" href="${csv}">CSV</a></div>${table(t.columns, rows, { id: idOf ? (r) => idOf(r) : null })}</div>`;
}

const sheetPlate = (s) => `<figure class="sheet" id="sh-${esc(s.id)}">${plate(s.id, s.svg)}<figcaption><b>${esc(s.id)}</b> ${esc(s.title)}</figcaption></figure>`;

/** The concerns the recipe has not reached: [{ tab, field, adds }]. */

const CSS = `
:root{--paper:#f4f4f1;--sheet:#fff;--ink:#16181d;--muted:#5f6670;--rule:#d9dad6;--accent:#c2410c;--pass:#2f7d4f;--advise:#b45309;
--body:"Helvetica Neue",Helvetica,Arial,sans-serif;--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--paper:#121418;--sheet:#1b1e24;--ink:#e8e9eb;--muted:#9aa1ab;--rule:#2d3139;--accent:#fb923c;--pass:#5cb57c;--advise:#f0a64b;color-scheme:dark}}
:root[data-theme="dark"]{--paper:#121418;--sheet:#1b1e24;--ink:#e8e9eb;--muted:#9aa1ab;--rule:#2d3139;--accent:#fb923c;--pass:#5cb57c;--advise:#f0a64b;color-scheme:dark}
*{box-sizing:border-box}@media (prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}body{margin:0;background:var(--paper);color:var(--ink);font:14.5px/1.5 var(--body)}
.wrap{max-width:1280px;margin-inline:auto;padding:0 16px 64px}
h1,h2,h3{margin:0;font-weight:700;letter-spacing:-.01em;line-height:1.05}h1{font-size:clamp(34px,5vw,58px)}h2{font-size:clamp(24px,3vw,34px)}h3{font-size:19px}
h4{margin:0;font:600 11px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
p{margin:0}a{color:inherit;text-decoration-color:var(--rule);text-underline-offset:2px}a:hover{color:var(--accent)}
.muted{color:var(--muted);font-size:13px}.eyebrow{font:500 11px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.mast{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:6px 20px;padding:20px 0 12px;border-bottom:2px solid var(--ink)}
.mast b{font:700 13px var(--mono);letter-spacing:.16em;text-transform:uppercase}
.tabs{position:sticky;top:0;z-index:5;background:var(--paper);display:flex;gap:2px;overflow-x:auto;padding-top:8px;border-bottom:1px solid var(--rule);scrollbar-width:thin}
.tabs a{flex:none;display:grid;gap:1px;text-decoration:none;color:var(--muted);padding:6px 12px 7px;border:1px solid var(--rule);border-bottom:0;border-radius:4px 4px 0 0;background:var(--sheet);font:500 12px var(--mono);letter-spacing:.06em;text-transform:uppercase}
.tabs a i{font-style:normal;font-size:9.5px;letter-spacing:.08em;opacity:.75}.tabs a:hover{color:var(--ink);box-shadow:inset 0 2px 0 var(--accent)}
.part{padding-top:48px;scroll-margin-top:52px;display:grid;gap:16px}.part-h{display:grid;gap:6px;border-top:1px solid var(--ink);padding-top:12px}
.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.card{background:var(--sheet);border:1px solid var(--rule);border-radius:4px;padding:14px 16px;display:grid;gap:10px;align-content:start;min-width:0;scroll-margin-top:60px}
.card.open{background:transparent;border-style:dashed}
.facts{display:grid;grid-template-columns:max-content 1fr;margin:0;border-top:1px solid var(--rule);font-size:13.5px}
.facts dt,.facts dd{margin:0;padding:5px 8px;border-bottom:1px solid var(--rule)}.facts dt{font:500 10.5px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding-top:7px}
.nums{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}.num{background:var(--sheet);border:1px solid var(--rule);border-radius:4px;padding:10px 12px}.num b{display:block;font-size:24px;font-weight:700;letter-spacing:-.01em}.num span{font:500 10.5px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.tw{overflow-x:auto;border:1px solid var(--rule);border-radius:4px;background:var(--sheet)}
table.sched{border-collapse:collapse;width:100%;font-size:13px}table.sched th,table.sched td{text-align:left;padding:5px 9px;border-bottom:1px solid var(--rule);white-space:nowrap}
table.sched th{position:sticky;top:0;background:var(--ink);color:var(--sheet);font:600 10.5px var(--mono);letter-spacing:.08em;text-transform:uppercase}
table.sched td:first-child{font-weight:700}table.sched .r{text-align:right}table.sched tr:target td,.card:target{background:color-mix(in srgb,var(--accent) 14%,var(--sheet))}
table.sched td.wrapc{white-space:normal;min-width:260px}
.tblock{display:grid;gap:6px;align-content:start;min-width:0}table.sched tr{scroll-margin-top:72px}.th{display:flex;justify-content:space-between;align-items:baseline;gap:8px}.dl{font:600 10.5px var(--mono);letter-spacing:.08em;border:1px solid var(--rule);border-radius:3px;padding:1px 6px;text-decoration:none}
.sheets{display:grid;gap:18px}.sheet{margin:0;display:grid;gap:4px;scroll-margin-top:60px}
.sheet svg{width:100%;height:auto;display:block;border:1px solid var(--rule);border-radius:2px;background:#fff;--paper:#fff;--ink:#111;--poche:#2b2b2b;--accent:#c2410c;box-shadow:0 1px 2px rgb(0 0 0 / .06)}
.sheet figcaption{font:11px var(--mono);color:var(--muted)}.sheet figcaption b{color:var(--ink)}
.sheet .s-tag[data-tag],.crop .s-tag[data-tag]{cursor:pointer}.sheet .s-tag.on>*{stroke:var(--accent)!important}.sheet .s-tag.on text{fill:var(--accent)!important}
.rooms{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,360px),1fr));gap:16px}
.crop{width:100%;height:auto;display:block;border:1px solid var(--rule);border-radius:2px;background:#fff;--paper:#fff;--ink:#111;--poche:#2b2b2b}
.pill{display:inline-block;font:600 10px var(--mono);letter-spacing:.08em;text-transform:uppercase;padding:1px 6px;border-radius:3px;border:1.5px solid currentColor}
.pass{color:var(--pass)}.advise{color:var(--advise)}.waived{color:var(--muted);text-decoration:line-through}.notrun,.open-st{color:var(--muted)}.given{color:var(--pass)}.inferred{color:#4f7fd0}
.bars{display:grid;gap:6px}.bar{display:grid;grid-template-columns:120px minmax(0,1fr) 44px;gap:10px;align-items:center;font:12px var(--mono)}.bar i{display:block;height:6px;border-radius:3px;background:var(--rule);position:relative;overflow:hidden}.bar i b{position:absolute;inset:0 auto 0 0;background:var(--ink)}
.states{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr));gap:4px 16px}.states li{display:flex;gap:8px;align-items:baseline;justify-content:space-between;padding:5px 0;border-bottom:1px dashed var(--rule)}
.live iframe{width:100%;height:min(72vh,640px);border:1px solid var(--rule);border-radius:4px;background:#fff;display:block}
.norender{border:1.5px dashed var(--rule);border-radius:4px;padding:16px;display:grid;gap:6px}
code{font:12.5px var(--mono);background:color-mix(in srgb,var(--rule) 45%,transparent);padding:1px 4px;border-radius:3px}pre{font:12px/1.5 var(--mono);overflow-x:auto;margin:0;white-space:pre}
details{background:var(--sheet);border:1px solid var(--rule);border-radius:4px;padding:8px 12px}summary{cursor:pointer;font:500 11.5px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}details[open]>summary{margin-bottom:8px}
footer{margin-top:48px;padding-top:12px;border-top:2px solid var(--ink);display:flex;justify-content:space-between;gap:8px 20px;flex-wrap:wrap}
@media (max-width:860px){.grid2,.grid3{grid-template-columns:1fr}}
`;

// a tag clicked on a sheet or a crop goes to its row; the row's tag lights on every sheet
const SCRIPT = `(()=>{const by={door:t=>'el-'+t,window:t=>'el-win-'+t,wall:t=>'el-wt-'+t,object:t=>'ob-'+t,room:t=>'rm-'+t,member:t=>'el-'+t};
const light=()=>{document.querySelectorAll('.s-tag.on').forEach(e=>e.classList.remove('on'));const h=decodeURIComponent(location.hash.slice(1));if(!h)return;
document.querySelectorAll('.s-tag[data-tag]').forEach(e=>{const k=[...e.classList].find(c=>by[c]);if(k&&by[k](e.dataset.tag)===h)e.classList.add('on')})};
document.addEventListener('click',ev=>{const g=ev.target.closest('.s-tag[data-tag]');if(!g)return;const k=[...g.classList].find(c=>by[c]);if(!k)return;const id=by[k](g.dataset.tag),el=document.getElementById(id);if(!el)return;if(location.hash==='#'+id)el.scrollIntoView({block:'start'});else location.hash=id;el.scrollIntoView({block:'start'})});
addEventListener('hashchange',light);light()})();`;

/**
 * The structure book of a floorplan row, as one page. `read` defaults to readStructure(manifest); `ref` names the
 * row (links to its own pages); `world` = { src } (an iframe onto the row's World) or { html } (the World page baked
 * in, for a page that leaves the dashboard); `lookup(ref)` → { title } for an object that is another row.
 */
export function structureBookHtml(manifest, { read = readStructure(manifest), ref = null, world = null, lookup = null, units = 'imperial' } = {}) {
  if (!read) throw new Error("structure book: the row is not a building (kind 'floorplan', 'store', 'restaurant' or 'mall')");
  const m = manifest || {};
  // a store, restaurant or mall: read as that building, by its occupancy (structure/programs.js)
  const occ = read.occupancy || null;
  const name = read.title || m.title || ref || (occ ? title(occ.label) : 'House');
  const sheets = drawingSet(read, { units, project: name });
  const of = (p) => sheets.filter((s) => p.test(s.id));
  const roomBy = new Map(read.rooms.map((r) => [r.tag, r]));
  const levelName = (i) => { const s = read.storeys.find((x) => x.index === i); return s ? `L${s.number}` : `L${i + 1}`; };
  const fp = read.footprint;
  const trades = Object.fromEntries(tradeTables(read).map((t) => [t.id, t]));
  const checks = checkRows(read);
  const opens = openConcerns(m, read);
  const inferred = Array.isArray(m.notes?.inferred) ? m.notes.inferred : [];

  // ── which tabs the recipe reaches ──
  const TABS = [
    { id: 'cover', name: 'Cover', sheet: 'G-001', on: true },
    { id: 'site', name: 'Site', sheet: 'C-101', on: !!read.site },
    { id: 'massing', name: 'Massing', sheet: 'A-201', on: true },
    { id: 'plan', name: 'Plan', sheet: 'A-101', on: true },
    { id: 'rooms', name: 'Rooms', sheet: `${read.rooms.length}`, on: read.rooms.length > 0 },
    { id: 'elements', name: 'Elements', sheet: 'A-601', on: true },
    { id: 'objects', name: 'Objects', sheet: `${read.objects.types.length} types`, on: read.objects.pieces.length > 0 },
    { id: 'structure', name: 'Structure', sheet: 'S-101', on: !!read.construction },
    { id: 'services', name: 'Services', sheet: read.wiring ? 'E-101' : 'P-101', on: !!(read.wiring || read.drainage) },
    { id: 'quantities', name: 'Quantities', sheet: 'takeoff', on: !!read.construction },
    { id: 'checks', name: 'Checks', sheet: `${checks.filter((c) => c.ok === false && !c.waived).length} advise`, on: true },
    { id: 'walk', name: 'Walk', sheet: 'world', on: true },
    { id: 'open', name: 'Open', sheet: `${opens.length}`, on: true },
  ];
  const on = (id) => TABS.find((t) => t.id === id).on;
  const tabFor = (sheetId) => (/^C-/.test(sheetId) ? 'site' : /^A-10/.test(sheetId) ? 'plan' : /^A-[23]/.test(sheetId) ? 'massing' : /^A-6/.test(sheetId) ? 'elements' : /^S-/.test(sheetId) ? 'structure' : 'services');

  // ── Cover ──
  const gross = read.schedules.grossArea;
  // a room and a house are different things, said everywhere: a room is one space, furnished and walked; a house is
  // rooms that make a home, judged livable or not
  const isRoom = read.subject === 'room';
  const bookName = isRoom ? 'Room book' : 'Structure book';
  const stateOf = (t) => (t.on ? (inferred.some((x) => String(x.tab || '').toLowerCase() === t.id) ? 'inferred' : 'given') : 'open-st');
  const cover = `<section class="part" id="cover"><div class="grid2" style="align-items:end"><div style="display:grid;gap:10px"><span class="eyebrow">${bookName} · G-001</span><h1>${esc(name)}</h1>
<p class="muted">${occ ? `A ${esc(occ.label)}: ${esc(occ.name)} occupancy (${esc(occ.group)}) · ` : isRoom ? `A room, not a house: ${esc(title(read.rooms.find((r) => r.glyph !== 'H')?.name || 'one space'))}, furnished and walked, never judged as a home · ` : read.dwelling?.missing.length ? `A house, not yet a home: no ${esc(read.dwelling.missing.join(', no '))} · ` : read.dwelling ? 'A house: a kitchen, a bathroom and a bedroom · ' : ''}${read.storeys.length} level${read.storeys.length === 1 ? '' : 's'} · ${esc(areaText(gross, units))} gross · ${read.rooms.length} room${read.rooms.length === 1 ? '' : 's'} · footprint ${esc(ftIn(fp.x1 - fp.x0))} × ${esc(ftIn(fp.y1 - fp.y0))}${read.construction ? ` · ${esc(read.construction.system)} frame` : ''}</p></div>
<div class="nums"><div class="num"><b>${esc(areaText(gross, units))}</b><span>gross area</span></div><div class="num"><b>${read.storeys.length}</b><span>levels</span></div><div class="num"><b>${read.rooms.length}</b><span>rooms</span></div><div class="num"><b>${read.grade ? pct(read.grade.score) : '—'}</b><span>${occ ? `${esc(occ.label)} grade` : `plan grade${read.dwelling ? ' (rooms, not the home)' : ''}`}</span></div>${read.dwelling ? `<div class="num"><b class="${read.dwelling.missing.length ? 'advise' : 'pass'}">${read.dwelling.missing.length ? 'no' : 'yes'}</b><span>a home${read.dwelling.missing.length ? `: no ${esc(read.dwelling.missing.join(', '))}` : ''}</span></div>` : ''}<div class="num"><b>${sheets.length}</b><span>sheets</span></div></div></div>
<div class="grid2"><div class="card"><h4>Sheet index</h4>${table([{ key: 'id', label: 'Sheet' }, { key: 'title', label: 'Title' }, { key: 'tab', label: 'Tab' }], sheetIndex(sheets).map((s) => ({ id: a(`sh-${s.id}`, s.id), title: esc(s.title), tab: a(tabFor(s.id), title(tabFor(s.id))) })))}</div>
<div class="card"><h4>${isRoom ? 'What the room has' : 'How deep the building goes'}</h4><ul class="states">${TABS.filter((t) => !['cover', 'open'].includes(t.id) && !((isRoom || occ) && !t.on && HOUSE_TABS.has(t.id))).map((t) => `<li>${t.on ? a(t.id, t.name) : `<span class="muted">${esc(t.name)}</span>`}<span class="pill ${stateOf(t)}">${stateOf(t) === 'open-st' ? 'open' : stateOf(t)}</span></li>`).join('')}</ul>
${occ ? `<p class="muted">The site, the frame, the trades and the takeoff (Site, Structure, Services, Quantities) are on the rail for a house; not yet for a ${esc(occ.label)}.</p>\n` : ''}${inferred.length ? `<h4>Inferred</h4><ul class="muted">${inferred.map((x) => `<li><b>${esc(x.field ?? x.key ?? '')}</b> ${esc(x.reason ?? x.why ?? '')}</li>`).join('')}</ul>` : ''}
<p class="muted">An open tab is a field the recipe has not set: ${a('open', 'Open')} names it. Every page is read from the recipe; nothing here is stored.</p></div></div></section>`;

  // ── Site ──
  const site = on('site') ? `<section class="part" id="site"><div class="part-h"><span class="eyebrow">Site · C-101</span><h2>The lot</h2></div>
<div class="sheets">${of(/^C-/).map(sheetPlate).join('')}</div>
${dl([['lot', `${esc(ftIn(read.site.lot.x1 - read.site.lot.x0))} × ${esc(ftIn(read.site.lot.y1 - read.site.lot.y0))}`], ['setbacks', `front ${esc(ftIn(fp.y0 - read.site.lot.y0))} · rear ${esc(ftIn(read.site.lot.y1 - fp.y1))} · side ${esc(ftIn(fp.x0 - read.site.lot.x0))}`], ['on it', Object.keys(read.site).filter((k) => k !== 'lot').map(esc).join(', ') || '—']])}</section>` : '';

  // ── Massing ──
  const roof = read.elements.roof;
  const massing = `<section class="part" id="massing"><div class="part-h"><span class="eyebrow">Massing · A-201</span><h2>The envelope</h2></div>
<div class="grid3"><div class="card" style="grid-column:span 1">${dl([
    ['levels', read.storeys.map((s) => `${levelName(s.index)} ${esc(ftIn(s.height))}`).join(' · ')],
    ['footprint', `${esc(ftIn(fp.x1 - fp.x0))} × ${esc(ftIn(fp.y1 - fp.y0))}`],
    ['roof', occ ? `<span class="muted">not drawn for a ${esc(occ.label)} yet</span>` : roof ? `${esc(roof.style)}${roof.form ? ` (${esc(roof.form)})` : ''}${roof.pitch ? ` · pitch ${esc(roof.pitch)}` : ''}${roof.covering ? ` · ${esc(typeof roof.covering === 'object' ? roof.covering.type : roof.covering)}` : ''}` : '<span class="muted">none: open</span>'],
    ['style', m.style ? esc(typeof m.style === 'object' ? JSON.stringify(m.style) : m.style) : '<span class="muted">the default</span>'],
    ['walls', read.elements.wallTypes.filter((t) => !t.interior).map((t) => `${a(anchors.wallType(t.type), `type ${t.type}`)} ${esc(ftIn(t.thickness))}`).join(' · ')],
  ])}</div></div>
<div class="sheets">${of(/^A-[23]/).map(sheetPlate).join('')}</div></section>`;

  // ── Livability: the walkways and the stair's approaches, the rules in force, and how to change them ──
  const RL = read.rules || {};
  const sayIn = (ft) => (RL.units === 'mm' ? `${Math.round(ft * 304.8 / 10) * 10} mm` : `${Math.round(ft * 12)} in`);
  const livRows = checks.filter((c) => c.source === 'livability' || c.source === 'design');
  const livBad = livRows.filter((c) => c.ok === false && !c.waived);
  const livCard = occ ? `<div class="card" id="livability"><h4>A ${esc(occ.label)}, not a home</h4><p class="muted">Read as the building it is: its rooms are named by what they are for, and it is graded by reachability (a door into every space) and its program's rules${occ.id === 'store' ? ", from the store card's own assessment" : ''}, never by bedrooms, egress windows or a kitchen and a bath. Card <code>building-commercial</code>.</p></div>`
    : isRoom ? `<div class="card" id="livability"><h4>A room, not a house</h4><p class="muted">One space: it is furnished, lit, walked and drawn, and graded as the room it is. Livability (a kitchen, a bathroom and a bedroom; walkways; a stair kept clear) is read for a house. More rooms (<code>rooms[]</code>, or a seed with no <code>rooms</code>, which the mint draws as a home) make it one.</p></div>`
    : `<div class="card" id="livability"><h4>Livability · ${livBad.length ? `${livBad.length} advise` : 'clear'}</h4>
${livRows.length ? `<ul class="muted">${livRows.map((c) => `<li><span class="pill ${c.ok ? 'pass' : c.waived ? 'waived' : 'advise'}">${c.ok ? 'pass' : c.waived ? 'waived' : 'advise'}</span> ${c.subject && roomBy.has(c.subject) ? a(anchors.room(c.subject), c.subject) : esc(c.subject)} ${esc(c.detail)}</li>`).join('')}</ul>` : ''}
${dl([['tradition', esc(RL.tradition || '—')], ['passage', esc(sayIn(RL.passage || 3))], ['stair clearance', RL.clearance > 0 ? esc(sayIn(RL.clearance)) : '<span class="muted">the flight only (checked against the passage)</span>'], ['repair', RL.repair ? 'on: the plan keeps a passage past the stair' : '<span class="muted">off</span>'], ['waived', RL.waive?.length ? RL.waive.map((w) => `<code>${esc(w)}</code>`).join(' ') : '<span class="muted">none</span>']])}
<p class="muted">Yours to set with <code>update_sketch</code>: <code>design: { repair: true }</code> reshapes the plan so walkways clear the stair; <code>clearance: true</code> keeps furniture a passage off it (or feet, or <code>false</code>); <code>passage</code> in feet; <code>waive: ['stair-clearance:101']</code> accepts a finding as built.</p></div>`;

  // ── Plan ──
  const g = read.grade;
  const plan = `<section class="part" id="plan"><div class="part-h"><span class="eyebrow">Plan · ${of(/^A-10/).map((s) => s.id).join(' ')}</span><h2>The layout</h2></div>
<div class="grid2">${g ? `<div class="card"><h4>The grade · ${pct(g.score)}</h4><div class="bars">${Object.entries(g.breakdown || {}).map(([k, v]) => `<div class="bar"><span>${esc(k)}</span><i><b style="width:${pct(v)}"></b></i><span>${pct(v)}</span></div>`).join('')}</div>${g.violations?.length ? `<ul class="muted">${g.violations.map((v) => `<li>${esc(v)}</li>`).join('')}</ul>` : '<p class="muted">Nothing advises.</p>'}${read.storeys.length > 1 ? '<p class="muted">Graded floor by floor; the stack is checked, not improved.</p>' : ''}</div>` : ''}
${livCard}
${occ ? `<div class="card"><h4>Exits</h4>${table([{ key: 'door', label: 'Door' }, { key: 'room', label: 'From' }, { key: 'width', label: 'Width', align: 'end' }], read.elements.doors.filter((d) => d.exterior).map((d) => ({ door: a(anchors.door(d.tag), d.tag), room: d.serves && roomBy.has(d.serves) ? a(anchors.room(d.serves), `${d.serves} ${roomBy.get(d.serves).name}`) : '—', width: esc(ftIn(d.width)) })))}</div>` : `<div class="card"><h4>Egress</h4>${table([{ key: 'room', label: 'Room' }, { key: 'requires', label: 'Requires' }, { key: 'windows', label: 'Windows', align: 'end' }, { key: 'ok', label: '' }], (read.schedules.egress || []).map((e) => { const r = read.rooms.find((x) => x.id === e.id); return { room: r ? a(anchors.room(r.tag), `${r.tag} ${r.name}`) : esc(e.name), requires: esc(e.requires), windows: esc(e.windows), ok: `<span class="pill ${e.ok ? 'pass' : 'advise'}">${e.ok ? 'pass' : 'advise'}</span>` }; }))}</div>`}</div>
<div class="sheets">${of(/^A-10/).map(sheetPlate).join('')}</div></section>`;

  // ── Rooms: a card each, its plan cropped from its level's drawing ──
  const cropView = makeView({ scale: '1/4', origin: [0, 0], at: [0, 0] });
  const drawn = new Map();
  const levelDrawing = (i) => { if (!drawn.has(i)) drawn.set(i, planDrawing(read, i, cropView, { units, dims: false })); return drawn.get(i); };
  const crop = (r) => {
    const pad = 2.5, x = cropView.x(r.rect.x - pad), y = cropView.y(r.rect.y - pad), w = cropView.len(r.rect.w + 2 * pad), h = cropView.len(r.rect.h + 2 * pad);
    return `<svg class="crop" viewBox="${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}" role="img" aria-label="${esc(`${r.tag} ${r.name}, plan`)}">${sheetStyle()}<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="#fff"/>${levelDrawing(r.storey)}</svg>`;
  };
  const piecesBy = new Map(read.objects.pieces.map((p) => [p.mark, p]));
  const roomCard = (r) => {
    const counts = new Map();
    for (const mk of r.objects) { const p = piecesBy.get(mk); if (p) counts.set(p.tag, (counts.get(p.tag) || 0) + 1); }
    return `<article class="card" id="${esc(anchors.room(r.tag))}"><div><span class="eyebrow">Room ${esc(r.tag)} · ${esc(levelName(r.storey))}</span><h3>${esc(title(r.name))}</h3></div>
${plate(`room-${r.tag}`, crop(r))}
${dl([
    ['role', esc(r.role || r.glyph || '—')],
    ['area', `${esc(areaText(r.area, units))} · ${esc(ftIn(r.rect.w))} × ${esc(ftIn(r.rect.h))}`],
    ['daylight', `${r.windows.length} window${r.windows.length === 1 ? '' : 's'}${r.needsWindow && !r.windows.length ? ' <span class="pill advise">needs one</span>' : ''}`],
    ['opens to', links(r.connects, anchors.room)],
    ['bounded by', links(r.walls, anchors.wall)],
    ['doors', links(r.doors, anchors.door)],
    ['windows', links(r.windows, anchors.window)],
    ['holds', counts.size ? [...counts.entries()].sort().map(([t, n]) => `${a(anchors.objectType(t), t)}${n > 1 ? ` ×${n}` : ''}`).join(' ') : '<span class="muted">nothing</span>'],
  ])}</article>`;
  };
  const rooms = on('rooms') ? `<section class="part" id="rooms"><div class="part-h"><span class="eyebrow">Rooms · ${read.rooms.length}</span><h2>Each room</h2><p class="muted">A room is bounded by elements and holds objects; each links to its row, and back.</p></div>
${read.storeys.map((s) => `<h4>${esc(levelName(s.index))}</h4><div class="rooms">${read.rooms.filter((r) => r.storey === s.index).map(roomCard).join('')}</div>`).join('')}</section>` : '';

  // ── Elements ──
  const E = read.elements;
  const elements = `<section class="part" id="elements"><div class="part-h"><span class="eyebrow">Elements · A-601</span><h2>What the structure is made of</h2></div>
<div class="grid2"><div class="tblock"><h4>Wall types</h4>${table([{ key: 'type', label: 'Type' }, { key: 'where', label: 'Where' }, { key: 't', label: 'Thickness', align: 'end' }, { key: 'n', label: 'Walls', align: 'end' }, { key: 'len', label: 'Length', align: 'end' }],
    E.wallTypes.map((t) => ({ type: esc(t.type), where: t.interior ? 'interior' : 'exterior', t: esc(ftIn(t.thickness)), n: t.count, len: esc(ftIn(t.length)) })), { id: (r) => anchors.wallType(r.type) })}</div>
<div class="tblock"><h4>Window types</h4>${table([{ key: 'type', label: 'Type' }, { key: 'w', label: 'Width', align: 'end' }, { key: 'h', label: 'Height', align: 'end' }, { key: 'sill', label: 'Sill', align: 'end' }, { key: 'n', label: 'Qty', align: 'end' }],
    E.windowTypes.map((t) => ({ type: esc(t.type), w: esc(ftIn(t.widthIn / 12)), h: esc(ftIn(t.heightIn / 12)), sill: esc(ftIn(t.sillIn / 12)), n: t.count })), { id: (r) => anchors.windowType(r.type) })}</div></div>
<div class="tblock"><h4>Doors</h4>${table([{ key: 'tag', label: 'Door' }, { key: 'lvl', label: 'Level' }, { key: 'w', label: 'Width', align: 'end' }, { key: 'h', label: 'Height', align: 'end' }, { key: 'x', label: 'Int / Ext' }, { key: 'host', label: 'Wall' }, { key: 'rooms', label: 'Between' }],
    E.doors.map((d) => ({ tag: esc(d.tag), lvl: esc(levelName(d.storey)), w: esc(ftIn(d.width)), h: esc(ftIn(d.height)), x: d.exterior ? `exterior${d.entry ? ' · entry' : ''}` : 'interior', host: a(anchors.wall(d.host), d.host), rooms: links(d.connects, anchors.room) })), { id: (r) => anchors.door(r.tag) })}</div>
<div class="grid2"><div class="tblock"><h4>Walls</h4>${table([{ key: 'tag', label: 'Wall' }, { key: 'type', label: 'Type' }, { key: 'lvl', label: 'Level' }, { key: 'len', label: 'Length', align: 'end' }, { key: 'rooms', label: 'Bounds' }],
    E.walls.map((w) => ({ tag: esc(w.tag), type: a(anchors.wallType(w.type), w.type), lvl: esc(levelName(w.storey)), len: esc(ftIn(w.length)), rooms: links(w.bounds, anchors.room) })), { id: (r) => anchors.wall(r.tag) })}</div>
<div class="tblock"><h4>Windows</h4>${table([{ key: 'mark', label: 'Mark' }, { key: 'type', label: 'Type' }, { key: 'lvl', label: 'Level' }, { key: 'host', label: 'Wall' }, { key: 'rooms', label: 'Lights' }],
    E.windows.map((w) => ({ mark: esc(w.mark), type: a(anchors.windowType(w.tag), w.tag), lvl: esc(levelName(w.storey)), host: a(anchors.wall(w.host), w.host), rooms: links(w.connects, anchors.room) })), { id: (r) => anchors.window(r.mark) })}</div></div>
<div class="grid2"><div class="tblock"><h4>Slabs and stairs</h4>${table([{ key: 'tag', label: 'Tag' }, { key: 'what', label: 'Element' }, { key: 'detail', label: '' }],
    [...E.slabs.map((s) => ({ tag: esc(s.tag), what: `slab ${esc(levelName(s.storey))}`, detail: `${esc(areaText(s.area, units))}${s.holes.length ? ` · ${s.holes.length} void${s.holes.length === 1 ? '' : 's'}` : ''}` })),
      ...E.stairs.map((s) => ({ tag: esc(s.tag), what: 'stair', detail: `${esc(levelName(s.from))} → ${esc(levelName(s.to))}${s.width ? ` · ${esc(ftIn(s.width))} wide` : ''}${s.risers ? ` · ${s.risers} risers of ${esc(inchesText(s.rise))} · going ${esc(inchesText(s.going))}` : ''}${s.switchback ? ' · switchback' : ''}` }))], { id: (r) => `el-${r.tag}` })}</div>
${roof ? `<div class="tblock"><h4>Roof planes</h4>${table([{ key: 'key', label: 'Plane' }, { key: 'pts', label: 'Corners' }], roof.planes.map((p) => ({ key: esc(p.key), pts: p.corners.length })))}</div>` : ''}</div>
<details><summary>The schedules as a sheet (A-60x)</summary><div class="sheets">${of(/^A-6/).map(sheetPlate).join('')}</div></details></section>`;

  // ── Objects ──
  const srcCell = (t) => (t.source === 'ref' ? `<a href="/sketches/${encodeURIComponent(t.ref)}">${esc(lookup?.(t.ref)?.title || t.ref)}</a> <span class="muted">its own page</span>` : t.source === 'composed' ? `composed${t.like ? ` · like ${esc(t.like)}` : ''}` : t.source === 'item' ? 'placed by the recipe' : esc(t.source));
  // a fitted house's plumbing fixtures, scheduled as a plumber reads them (sheets/schedules.js)
  const fixtureTable = scheduleTables(read, { units }).find((t) => t.id === 'fixtures');
  const objects = on('objects') ? `<section class="part" id="objects"><div class="part-h"><span class="eyebrow">Objects · FF&amp;E</span><h2>What the structure holds</h2><p class="muted">Furniture, fixtures and appliances, by type. A piece with a ref is another row: it opens on its own page.</p></div>
${table([{ key: 'tag', label: 'Tag' }, { key: 'item', label: 'Item' }, { key: 'src', label: 'Source' }, { key: 'n', label: 'Qty', align: 'end' }, { key: 'rooms', label: 'Rooms' }],
    read.objects.types.map((t) => ({ tag: esc(t.tag), item: esc(t.type === 'ref' ? 'custom piece' : t.type), src: srcCell(t), n: t.count, rooms: links(t.rooms, anchors.room) })), { id: (r) => anchors.objectType(r.tag) })}
${fixtureTable ? `<div class="tblock"><h4>${esc(fixtureTable.title)}</h4>${table([{ key: 'tag', label: 'Mark' }, { key: 'item', label: 'Fixture' }, { key: 'size', label: 'W × D × H' }, { key: 'count', label: 'Qty', align: 'end' }, { key: 'rooms', label: 'Rooms' }], fixtureTable.rows.map((x) => ({ tag: a(anchors.objectType(x.tag), x.tag), item: esc(x.item.toLowerCase()), size: esc(x.size), count: esc(x.count), rooms: links(x.rooms.split(' ').filter(Boolean), anchors.room) })))}</div>` : ''}
<details><summary>Every piece (${read.objects.pieces.length})</summary>${table([{ key: 'mark', label: 'Mark' }, { key: 'tag', label: 'Type' }, { key: 'room', label: 'Room' }, { key: 'size', label: 'Size', align: 'end' }],
    read.objects.pieces.map((p) => ({ mark: esc(p.mark), tag: a(anchors.objectType(p.tag), p.tag), room: p.room ? a(anchors.room(p.room), p.room) : '<span class="muted">unplaced</span>', size: `${esc(ftIn(p.rect.w))} × ${esc(ftIn(p.rect.h))}` })), { id: (r) => anchors.piece(r.mark) })}</details></section>` : '';

  // ── Structure ──
  const C = read.construction;
  const spanRow = checks.find((c) => c.rule === 'span' && c.ok === null);
  const structure = on('structure') ? `<section class="part" id="structure"><div class="part-h"><span class="eyebrow">Structure · ${of(/^S-/).map((s) => s.id).join(' ')}</span><h2>The frame</h2></div>
<div class="grid2"><div class="card">${dl([['system', esc(C.system)], ['tradition', esc(C.tradition)], ['stage', esc(C.stage)], ['members', `${C.summary?.elements ?? '—'} in the model`], ['takeoff', C.report?.takeoff ? `timber ${C.report.takeoff.timber.pieces} pcs / ${C.report.takeoff.timber.boardFeet} bd ft · concrete ${C.report.takeoff.concrete.cubicYards} yd³${C.report.takeoff.steel.pieces ? ` · steel ${C.report.takeoff.steel.pieces} pcs` : ''}` : '—']])}
${spanRow ? `<p class="muted"><span class="pill notrun">span checks not run</span> ${esc(spanRow.detail)}.</p>` : ''}</div>
${trades.members ? dataTable(trades.members, { idOf: (r) => anchors.member(r.mark) }) : ''}</div>
<div class="sheets">${of(/^S-/).map(sheetPlate).join('')}</div></section>` : '';

  // ── Services ──
  const D = read.drainage;
  const services = on('services') ? `<section class="part" id="services"><div class="part-h"><span class="eyebrow">Services · ${of(/^[EP]-/).map((s) => s.id).join(' ')}</span><h2>The trades</h2><p class="muted">Electrical as roughed into the frame; rainwater as designed. Plumbing and HVAC are not drawn.</p></div>
${trades.circuits ? dataTable(trades.circuits) : ''}
${D ? `<div class="card">${dl([['tradition', esc(D.report.tradition)], ['roof area', `${esc(D.report.roofAreaM2)} m² in plan`], ['gutters', `${D.report.gutters.runs} runs · ${esc(ftIn(D.report.gutters.lengthFt))} · fall ${esc(D.report.gutters.fall)}`], ['downspouts', `${D.report.downpipes.count} · ${esc(ftIn(D.report.downpipes.lengthFt))}`], ['outlets', `${D.report.outlets.count} ${esc(D.report.outlets.kind)}`]])}</div>` : ''}
<div class="sheets">${of(/^P-/).map(sheetPlate).join('')}${of(/^E-/).map(sheetPlate).join('')}</div></section>` : '';

  // ── Quantities ──
  const quantities = on('quantities') ? `<section class="part" id="quantities"><div class="part-h"><span class="eyebrow">Quantities</span><h2>What it takes</h2><p class="muted">Counted from the construction model: the same pieces the IFC carries. Each table is a CSV.</p></div>
${['sheet-goods', 'takeoff', 'cut-list'].filter((k) => trades[k]).map((k) => dataTable(trades[k])).join('')}</section>` : '';

  // ── Checks ──
  const tabOfSource = { plan: 'plan', design: 'plan', livability: 'plan', frame: 'structure', wiring: 'services', rainwater: 'services' };
  const nPass = checks.filter((c) => c.ok === true).length, nAdv = checks.filter((c) => c.ok === false && !c.waived).length, nWv = checks.filter((c) => c.waived).length, nNot = checks.filter((c) => c.ok === null).length;
  const checksPart = `<section class="part" id="checks"><div class="part-h"><span class="eyebrow">Checks</span><h2>Is it right</h2><p class="muted">${nPass} pass · ${nAdv} advise${nWv ? ` · ${nWv} waived` : ''} · ${nNot} not run. A check advises; none refuses. This is arithmetic on the recipe, not an engineer's review. To accept one as built: <code>design: { waive: ['rule:at'] }</code> (or the rule alone for all of it).</p></div>
${table([{ key: 'src', label: 'Source' }, { key: 'rule', label: 'Rule' }, { key: 'res', label: 'Result' }, { key: 'at', label: 'At' }, { key: 'detail', label: 'Detail' }],
    checks.map((c) => ({ src: a(tabOfSource[c.source] || 'checks', c.source), rule: esc(c.rule), res: `<span class="pill ${c.ok === null ? 'notrun' : c.ok ? 'pass' : c.waived ? 'waived' : 'advise'}">${c.ok === null ? 'not run' : c.ok ? 'pass' : c.waived ? 'waived' : 'advise'}</span>`, at: c.subject && roomBy.has(c.subject) ? a(anchors.room(c.subject), c.subject) : esc(c.subject), detail: `<span class="wrapc">${esc(c.detail)}</span>` })))}</section>`;

  // ── Walk ──
  const r = ref ? encodeURIComponent(ref) : null;
  const live = world?.html ? `<iframe sandbox="allow-scripts" title="${esc(name)}, live" srcdoc="${esc(world.html)}"></iframe>` : world?.src ? `<iframe title="${esc(name)}, live" src="${esc(world.src)}" loading="lazy"></iframe>` : '';
  const walk = `<section class="part" id="walk"><div class="part-h"><span class="eyebrow">Walk · the world</span><h2>Through it</h2></div>
${live ? `<figure class="live">${live}<p class="muted">Drag to orbit; walk where the page offers it. The same recipe the sheets are drawn from.</p></figure>` : `<div class="norender"><span class="eyebrow">No live view in this copy</span><p class="muted">Open the row in the dashboard to walk it, or export it: <code>export_model({ ref${ref ? `: '${esc(ref)}'` : ''}, format: 'html' })</code>.</p></div>`}
<div class="grid2"><div class="card"><h4>Take it elsewhere</h4>${dl([
    ['mesh', r ? `<a href="/api/sketches/${r}/model.glb">model.glb</a> · <code>export_model({ format: 'glb' | 'usdz' })</code>` : "<code>export_model({ format: 'glb' })</code>"],
    ['BIM', `<code>export_model({ format: 'ifc' })</code>${read.stacked ? '' : ' <span class="muted">(needs levels)</span>'}`],
    ['drawings', "<code>export_model({ format: 'sheets' })</code> · SVG per sheet"],
    ['schedules', "<code>export_model({ format: 'schedules' })</code> · CSV and JSON"],
    ['film', '<code>forge_motion</code> · a turntable or a walkthrough'],
  ])}</div><div class="card"><h4>Walk it, film it</h4><p class="muted">The world's <b>walk</b> button walks the ${occ ? esc(occ.label) : 'house'} at eye height, with gravity and walls (WASD, mouse to look); <b>fly</b> floats through it. A film of it is a camera on the world:</p><pre>forge_motion({ subject: { world_ref: '${esc(ref || '<ref>')}' }, shot: { motion: 'orbit' } })</pre></div></div></section>`;

  // ── Open ──
  const open = `<section class="part" id="open"><div class="part-h"><span class="eyebrow">Open</span><h2>What is left</h2><p class="muted">Each concern the recipe has not reached, and the field that adds it with <code>update_sketch</code>.</p></div>
${opens.length ? `<div class="grid2">${opens.map((o) => `<article class="card open" id="open-${esc(o.id)}"><span class="eyebrow">${esc(OUTCOMES.find((x) => x.id === o.outcome).name)} · ${esc(o.tab)}</span><p><code>${esc(o.field)}</code></p><p class="muted">Adds ${esc(o.adds)}. Card <code>${esc(o.card)}</code>.</p></article>`).join('')}</div>` : '<p class="muted">Every tab is reached.</p>'}</section>`;

  const nav = TABS.filter((t) => t.on).map((t) => `<a href="#${t.id}">${esc(t.name)}<i>${esc(t.sheet)}</i></a>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(name)} · ${bookName}</title>
<style>${CSS}</style></head><body><div class="wrap">
<div class="mast"><b>${bookName}</b><span class="eyebrow">${esc(ref || name)} · ${sheets.length} sheets · ${read.units || 'ft'}</span></div>
<nav class="tabs" aria-label="Tabs">${nav}</nav>
${cover}${site}${massing}${plan}${rooms}${elements}${objects}${structure}${services}${quantities}${checksPart}${walk}${open}
<footer><span class="eyebrow">Every page read from its recipe</span><span class="eyebrow">Advisory drawings, not an engineered design</span></footer>
</div><script>${SCRIPT}</script></body></html>`;
}

export { CSS as BOOK_CSS };
