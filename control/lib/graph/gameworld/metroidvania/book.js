/**
 * THE BOX IN ITS BOOK (docs/metroidvania-map.md "In the book"): a metroidvania level's page in its world's gameworld
 * bible, the level design read off the box as its level builds it (levels.js: the level's or the world's geocube, else
 * the side strip's; the side map's hero), so the book and the game cannot disagree.
 *
 *   the plan   the box's screens, each room in its ring's colour (its look's stone, a locale's own where it has one;
 *              the greybox's by ring where it has no look), the closed parts it stands on, its doorways and holes cut,
 *              its gates in their colours, its pockets, its saves, its bosses, its keys and the powers found, the
 *              climbs' stands and ladders, the way in
 *   the rings  a card each: its place, its rooms, its locales, its colours, what it is built of (its fabric, its rock,
 *              its gem), its hazard, its light, what it holds (a key, a boss, a power, its pockets) and the gate on inward
 *   the powers each one, what it opens and where it is found
 *   the laws   every law the box is held to and what each says: the machine gate, measured; the eyes gate is the
 *              person's, who plays it
 *
 *   boxOfLevel(G, id)              → the level's box, built as its stage builds it (cached per world)
 *   boxPlanSvg(B, { width? })      → the plan, an svg `width` wide
 *   boxPage(G, esc)                → the section's html, '' for a world with no box level
 *   BOX_CSS
 *
 * Pure: the same world, the same page.
 */
import { boxOf } from './scene.js';
import { lookOf } from './themes.js';
import { GATES } from './gates.js';
import { resolveLevel } from '../world.js';
import { SIDE_CUBE } from '../../era/geocube-side.js';
import { SIDE_MAP_STATURE } from '../side-map/scene.js';

/** the greybox's ring colours, where a box has no look (scene.js) */
const RING_FILL = ['#5a6478', '#5d5478', '#6e5060', '#7a4648', '#6a3c54'];
const INK = '#1d1b20', PAPER = '#ffffff', r1 = (v) => Math.round(v * 10) / 10;

const built = new WeakMap();
/** The level's box, as its stage builds it: on the level's cube (or the world's, or the side strip's), for the side
 * map's hero. */
export function boxOfLevel(G, id) {
  const per = built.get(G) ?? built.set(G, new Map()).get(G);
  if (!per.has(id)) {
    const R = resolveLevel(G, id);
    per.set(id, boxOf({ kind: 'geocube', show: 'metroidvania', metroidvania: R.metroidvania, cube: R.style?.geocube ?? G.style?.geocube ?? SIDE_CUBE, stature: SIDE_MAP_STATURE, ...(G.feel ? { feel: G.feel } : {}) }));
  }
  return per.get(id);
}

/** A room's look as it is dressed (its locale's over its ring's), or null on a greybox. */
function lookOfRoom(B, r) {
  if (!B.look) return null;
  const T = B.look.theme, L = lookOf(T, r.ring, B.layout.rings.length), loc = B.dress?.plan[r.id]?.locale;
  return loc && T.locales?.[loc] ? { ...L, ...T.locales[loc] } : L;
}

/** The plan: the box drawn in elevation, north up (the box's rows bottom to top), `width` pixels wide. */
export function boxPlanSvg(B, { width = 900, marks = true } = {}) {
  const { layout: L, greybox: G } = B, W = G.screen.width, H = G.screen.height, [cols, rows] = L.box;
  const k = width / (cols * W), h = rows * H * k, X = (s) => r1(s * k), Y = (z) => r1(h - z * k), o = [];
  const box = (s0, s1, z0, z1, fill, more = '') => `<rect x="${X(s0)}" y="${Y(z1)}" width="${r1(Math.max(1, (s1 - s0) * k))}" height="${r1(Math.max(1, (z1 - z0) * k))}" fill="${fill}"${more}/>`;
  // the rooms in their ring's colour
  for (const r of L.rooms) {
    const [c, rr, w, hh] = r.rect, Lk = lookOfRoom(B, r);
    o.push(box(c * W, (c + w) * W, rr * H, (rr + hh) * H, Lk ? Lk.stone : RING_FILL[r.ring % RING_FILL.length], ` stroke="${INK}" stroke-width="1.2"`));
  }
  // what it stands on: the closed parts, a stair's steps and landings, its ledges
  for (const s of G.solids) o.push(box(s.s0, s.s1, s.z0, s.z1, s.role === 'ledge' || s.role === 'lip' ? '#e9e4d8' : '#2a2730', s.role === 'ledge' || s.role === 'lip' ? '' : ' fill-opacity="0.82"'));
  for (const l of G.ladders ?? []) o.push(box(l.s - 0.3, l.s + 0.3, l.z0, l.z1, '#c9a66b'));
  // its doorways and holes cut through, a shortcut's dashed
  for (const d of G.doorways) o.push(box(d.s - 0.7, d.s + 0.7, d.z0, d.z1, PAPER));
  for (const d of G.holes) o.push(box(d.s0, d.s1, d.z - 0.7, d.z + 0.7, PAPER));
  // its gates in their colours
  for (const g of G.gates) o.push(box(g.s0, g.s1, g.z0, g.z1, GATES[g.kind].colour, ` stroke="${INK}" stroke-width="0.6"`));
  if (marks) {
    const W2 = W * k, mark = (r, glyph, fill, dx = 0) => { const [c, rr, w] = r.rect; return `<text x="${X((c + w / 2) * W) + dx}" y="${Y(rr * H + H * 0.62)}" text-anchor="middle" font-size="${r1(Math.max(8, W2 * 0.22))}" font-family="ui-monospace,monospace" font-weight="700" fill="${fill}" stroke="${PAPER}" stroke-width="2.5" paint-order="stroke">${glyph}</text>`; };
    for (const r of L.rooms) {
      const g = [];
      if (r.save) g.push(['S', '#2c6fb0']);
      if (r.boss) g.push(['B', '#b0353a']);
      if (r.key) g.push(['K', '#a8861c']);
      if (r.finds) g.push(['◆', GATES[L.powers[r.finds].opens].colour]);
      g.forEach(([t, f], i) => o.push(mark(r, t, f, (i - (g.length - 1) / 2) * W2 * 0.26)));
    }
    for (const p of G.pockets) o.push(`<circle cx="${X(p.at[0])}" cy="${Y(p.at[1] + 0.6)}" r="${r1(Math.max(2.5, 0.9 * k))}" fill="#f3efe6" stroke="${GATES[p.gate].colour}" stroke-width="1.6"/>`);
    // the way in
    const e = L.rooms.find((r) => r.id === L.entry.room), ez = (e.rect[1] + 0.25) * H;
    o.push(`<path d="M${X(-W * 0.18)} ${Y(ez)} L${X(0)} ${Y(ez)} M${X(-W * 0.06)} ${r1(Y(ez) - 5)} L${X(0)} ${Y(ez)} L${X(-W * 0.06)} ${r1(Y(ez) + 5)}" stroke="${INK}" stroke-width="2" fill="none"/>`);
  }
  const pad = r1(W * k * 0.2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} -4 ${r1(width + pad + 4)} ${r1(h + 8)}" width="${width}" role="img" aria-label="the box's plan">${o.join('')}</svg>`;
}

/** what a gate is, as a thing a prize stands behind */
const BEHIND = Object.freeze({ sill: 'a sill', cracked: 'a cracked wall', grate: 'a grate', lock: 'a locked door', seal: 'a seal' });
const swatch = (c, esc) => `<span class="sw" style="background:${esc(c)}" title="${esc(c)}"></span>`;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** One ring's card. */
function ringCard(B, k, esc) {
  const { layout: L, greybox: G } = B, ring = L.rings[k], rooms = L.rooms.filter((r) => r.ring === k), last = k === L.rings.length - 1;
  const Lk = B.look ? lookOf(B.look.theme, k, L.rings.length) : null, locales = {};
  for (const r of rooms) { const l = B.dress?.plan[r.id]?.locale; if (l) locales[l] = (locales[l] ?? 0) + 1; }
  const T = B.look?.theme, place = (l) => T?.locales?.[l]?.place ?? l;
  const kinds = {}; for (const r of rooms) kinds[r.kind] = (kinds[r.kind] ?? 0) + 1;
  const climbs = {}; for (const c of G.chains.filter((c) => rooms.some((r) => r.id === c.room))) climbs[c.figure] = (climbs[c.figure] ?? 0) + 1;
  const holds = [
    ...rooms.filter((r) => r.key).map(() => 'its key'),
    ...rooms.filter((r) => r.boss).map((r) => `${esc(r.boss)}${r.finds ? `, who gives ${esc(L.powers[r.finds].name ?? r.finds)}` : ''}`),
    ...rooms.filter((r) => r.finds && !r.boss).map((r) => esc(L.powers[r.finds].name ?? r.finds)),
    ...G.pockets.filter((p) => rooms.some((r) => r.id === p.room)).map((p) => `${esc(p.holds)} behind ${esc(BEHIND[GATES[p.gate].shape] ?? GATES[p.gate].shape)}`),
  ];
  const way = (() => { const d = L.doors.find((x) => x.gate && rooms.some((r) => r.id === x.a) && !rooms.some((r) => r.id === x.b) && L.rooms.find((r) => r.id === x.b)?.ring === k + 1); return d ? `${esc(d.gate)}: ${esc(GATES[d.gate].read)}` : last ? 'the core' : '—'; })();
  const row = (t, d) => (d ? `<dt>${t}</dt><dd>${d}</dd>` : '');
  return `<div class="card box-ring" style="border-top:3px solid ${esc(Lk?.stone ?? RING_FILL[k % RING_FILL.length])}"><h4>${esc(ring.place ?? ring.id)}${last ? ' · the core' : ''}</h4><dl class="vocab">`
    + row('rooms', esc(Object.entries(kinds).map(([kk, n]) => plural(n, kk)).join(', ')))
    + row('look', Lk ? `${esc(Lk.place)} ${['back', 'stone', 'top', 'trim'].map((c) => (Lk[c] ? swatch(Lk[c], esc) : '')).join('')}` : 'greybox')
    + row('locales', Object.keys(locales).length ? esc(Object.entries(locales).map(([l, n]) => `${place(l)}${n > 1 ? ` × ${n}` : ''}`).join(', ')) : '')
    + row('built of', Lk ? esc([Lk.fabric === 'rock' ? 'rock, fractured' : 'masonry', Lk.rock ? `${Lk.rock} boulders` : '', Lk.gem ? `${Lk.gem} crystals` : ''].filter(Boolean).join(' · ')) : '')
    + row('hazard', Lk?.hazard ? esc(Lk.hazard) : '')
    + row('light', Lk?.lamp ? `${esc(Lk.lamp.kind)} ${swatch(Lk.lamp.colour, esc)} reach ${Lk.lamp.reach} m · dark ${Lk.dark}` : '')
    + row('climbs', Object.keys(climbs).length ? esc(Object.entries(climbs).map(([f, n]) => `${f}${n > 1 ? ` × ${n}` : ''}`).join(', ')) : '')
    + row('holds', holds.length ? holds.join('; ') : '—')
    + row('the way on', way)
    + '</dl></div>';
}

/** The box levels' section of the book. */
export function boxPage(G, esc) {
  const ids = (G.ids ?? Object.keys(G.levels ?? {})).filter((id) => G.levels[id]?.metroidvania);
  if (!ids.length) return '';
  const pages = ids.map((id) => {
    const B = boxOfLevel(G, id), L = B.layout, name = G.levels[id].name ?? id;
    const from = !B.look ? 'greybox: its words name no theme and its geocube no box' : B.look.from === 'words' ? `dressed as <b>${esc(B.look.id)}</b>, by its words' theme` : `dressed as <b>${esc(B.look.id)}</b>, by its geocube <b>${esc(B.look.cube)}</b>`;
    const powers = Object.entries(L.powers).map(([pid, p]) => {
      const at = L.rooms.find((r) => r.finds === pid);
      return `<tr><td><b>${esc(p.name ?? pid)}</b></td><td>${esc(p.opens)}</td><td>${esc(GATES[p.opens].read)}</td><td>${at ? `${esc(L.rings[at.ring].place)}${at.boss ? `, from ${esc(at.boss)}` : ''}` : '—'}</td></tr>`;
    }).join('');
    const held = B.laws.filter((l) => l.holds).length, laws = B.laws.map((l) => `<li class="${l.holds ? 'ok' : 'off'}"><b>${l.holds ? '✓' : '✗'} ${esc(l.id)}</b> ${esc(l.says)}</li>`).join('');
    return `<div class="box-level" id="box-${esc(id)}"><h3>${esc(name)}</h3><p class="muted">${esc(L.premise ?? '')}</p>`
      + `<p class="mono">${L.box[0]} × ${L.box[1]} screens · ${plural(L.rooms.length, 'room')} · ${plural(L.rings.length, 'ring')} · ${esc(L.shape)} · ${from}</p>`
      + `<div class="canvas box-plate">${boxPlanSvg(B)}</div>`
      + '<p class="muted box-key">the rooms in their ring\'s colour · the closed parts dark, ledges pale, ladders gold · the way through cut white · gates in their colours · <b>S</b> save · <b>B</b> boss · <b>K</b> key · <b>◆</b> a power · ○ a pocket · → the way in</p>'
      + `<div class="cards box-rings">${L.rings.map((_, k) => ringCard(B, k, esc)).join('')}</div>`
      + `<h4>The powers</h4><table class="wcd-t"><thead><tr><th>power</th><th>opens</th><th>what it opens reads as</th><th>found</th></tr></thead><tbody>${powers}</tbody></table>`
      + `<details><summary>Its laws · ${held} of ${B.laws.length} hold</summary><p class="muted">The machine gate: each measured on the box as built. The eyes gate is the person's, who plays it.</p><ul class="box-laws">${laws}</ul></details></div>`;
  }).join('');
  return `<section class="part" id="boxes"><div class="part-h"><span class="eyebrow">Level design</span><h2>The box${ids.length === 1 ? '' : 'es'}: rooms, rings and powers</h2></div>${pages}</section>`;
}

export const BOX_CSS = '.box-level{display:grid;gap:12px;margin-bottom:28px}.box-plate svg{width:100%;height:auto;background:#fff}.box-key{font-size:12.5px}'
  + '.box-rings{grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr))}.box-ring h4{margin:0}'
  + '.box-laws{margin:0;padding-left:0;list-style:none;display:grid;gap:4px;font-size:13px}.box-laws li.off b{color:#b0353a}';
