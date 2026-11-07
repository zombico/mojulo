/**
 * THE WORLD MAP IN MINIATURE — a zoned map (zones.js) drawn from its recipe alone, no page built: the world, a zone, a
 * tile, each a view you drill into and back out of, sideways through a zone's gates as the player crosses them.
 *
 *   world   the plan's segments on their one land: each zone's square (its name, its role), the walk through them and the
 *           joins off it, every gate on its border, the start and the goal; a zone is a link down
 *   zone    its square and its apron (the neighbours' tiles its page shows, faded), its paths, places and pieces, its
 *           gates each a link sideways to the zone across, where its page sets out and where each gate sets one down;
 *           a tile is a link down; `play` (a zone's page) walks it
 *   tile    its ground, its path's shape, what stands on it, its door, what of the game lies on it, its gate
 *
 * With a SKETCH (map-sketch.js: the level decided in miniature before it is built), each view reads it too: the journey
 * numbered over the world, each zone's status (approved, a draft, not yet planned), each tile's ground drawn (wood, rocks,
 * a cliff, water…) and its height in the land's shading, the marks (encounters, loot, landmarks, secrets…) where they lie.
 *
 * HTML and CSS alone (the game book's way, atlas-html.js): each view a section, the one shown the one the address names
 * (`#world`, `#zone-<S>`, `#tile-<r>-<c>`); nothing runs. Ground shaded from the level's one land (era/out-tile.js
 * levelHeight), as every tile lays it.
 *
 *   worldmapView(level, { title? })              → the views' data, pure: { title, T, rows, cols, n, zones, gates, cells, … }
 *   worldmapHtml(view, { play?: { <S>: href }, model? }) → the page (`model`: the 3D model's page, worldmap-model.js)
 */
import { readGrid, placeDoors } from './grid.js';
import { zoneOf } from './zones.js';
import { mapItems } from './map-items.js';
import { gridEnds } from './grid-ends.js';
import { levelHeight, tilePath } from '../era/out-tile.js';
import { readSketch, sketchRise, sketchLaws, sketchStatus, SKETCH_GROUND, SKETCH_MARKS } from './map-sketch.js';

const r1 = (v) => Math.round(v * 10) / 10;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ROLE_WORDS = Object.freeze({ arrival: 'where the walk sets out', passage: 'on the way', climax: 'where the walk ends', pocket: 'off the walk', landmark: 'a landmark', rest: 'a rest' });
// (a segment's tint, by its order on the layout: a hand-picked ring, never random)
const TINTS = ['#c9a86a', '#8fb36a', '#6aa39b', '#b38f6a', '#9a8fc0', '#c08f8f', '#7fa0c4', '#b0b46a'];
// (samples of the land a tile, a side)
const SHADE_K = 4;

/** The views' data: the map read whole, each zone as zones.js reads it, each tile's path and place, the land sampled. */
export function worldmapView(level, { title = null } = {}) {
  const G = readGrid(level.grid, 'level.grid'), P = G.plan;
  if (!P) throw new Error('worldmap: a world map is a planned map (level.grid.plan), each segment a zone');
  const sketch = readSketch(level.sketch, P), rise = sketchRise(G, sketch);
  const T = G.tile, seed = level.seed ?? 1, L = { seed, ...(rise ? { rise } : {}) };
  const status = sketchStatus(sketch, P);
  const ids = Object.keys(P.segments);
  const zones = ids.map((S, i) => {
    const Z = zoneOf(G, S, { seed }), E = gridEnds({ ...level, zone: S });
    return { id: S, name: G.regions?.[S]?.name ?? S, role: P.roles[S], tint: TINTS[i % TINTS.length], at: Z.at, box: Z.box, ways: Z.ways, spawn: E.spawn, holdsGoal: !!E.holdsGoal, exit: E.exit, own: [...Z.own], built: [...Z.built], status: status[S], beats: (sketch?.concept?.journey ?? []).filter((b) => b.at === S).map((b) => b.id), notes: sketch?.segments[S]?.notes ?? null };
  });
  // the land, sampled: SHADE_K × SHADE_K a tile, at each cell's middle
  const step = T / SHADE_K, land = [];
  let lo = Infinity, hi = -Infinity;
  for (let j = 0; j < G.rows * SHADE_K; j++) for (let i = 0; i < G.cols * SHADE_K; i++) {
    const x = (i + 0.5) * step, y = -(j + 0.5) * step, z = levelHeight(x, y, L);
    land.push(z); lo = Math.min(lo, z); hi = Math.max(hi, z);
  }
  // (each cell lit from the north-west: the slope toward it brighter)
  const zAt = (i, j) => land[Math.max(0, Math.min(G.rows * SHADE_K - 1, j)) * G.cols * SHADE_K + Math.max(0, Math.min(G.cols * SHADE_K - 1, i))];
  const shade = land.map((z, k) => { const i = k % (G.cols * SHADE_K), j = Math.floor(k / (G.cols * SHADE_K)); const dx = zAt(i + 1, j) - zAt(i - 1, j), dy = zAt(i, j + 1) - zAt(i, j - 1); return r1(Math.max(-1, Math.min(1, (-dx + dy) / (2 * step) * 2.5)) * 100) / 100; });
  const cells = G.cells.map((x) => {
    const o = [x.c * T, -(x.r + 1) * T];
    const paths = x.kind === 'path' ? tilePath(T, x.open).map((Pl) => Pl.filter((_, k) => k % 4 === 0 || k === Pl.length - 1).map(([px, py]) => [r1(o[0] + px), r1(o[1] + py)])) : [];
    const door = x.kind === 'place' && x.open?.length ? (() => { const D = placeDoors(T)[x.open[0]]; return { side: x.open[0], at: [r1(o[0] + D.x), r1(o[1] + D.y)] }; })() : null;
    const zs = [0.25, 0.75].flatMap((a) => [0.25, 0.75].map((b) => levelHeight(o[0] + a * T, o[1] + b * T, L)));
    const seg = x.region && P.segments[x.region] ? x.region : null, sk = seg ? sketch?.segments[seg] : null, [lr, lc] = seg ? [x.r - P.segments[seg].at[0], x.c - P.segments[seg].at[1]] : [0, 0];
    const ground = sk?.ground && sk.ground[lr][lc] !== '.' ? sk.ground[lr][lc] : null, height = sk?.height ? Number(sk.height[lr][lc]) : null;
    return {
      r: x.r, c: x.c, kind: x.kind, glyph: x.glyph, ...(ground ? { ground } : {}), ...(height !== null ? { height } : {}), ...(x.shape ? { shape: x.shape } : {}), ...(x.open?.length ? { open: x.open } : {}), ...(x.region ? { region: x.region } : {}),
      ...(x.place && typeof x.place === 'object' ? { place: x.place } : {}), paths, ...(door ? { door } : {}), z: [r1(Math.min(...zs)), r1(Math.max(...zs))],
    };
  });
  // (a segment sketched with marks says its own encounters and finds: the pieces derived for it stand down)
  const marked = new Set(Object.entries(sketch?.segments ?? {}).filter(([, v]) => v.marks.length).map(([k]) => k));
  const pieces = mapItems(G).filter((it) => !marked.has(it.segment)).map((it) => ({ id: it.id, kind: it.kind, tile: it.tile, segment: it.segment }));
  const marks = Object.entries(sketch?.segments ?? {}).flatMap(([seg, v]) => v.marks.map((m, i) => ({ ...m, segment: seg, n: i, tile: [P.segments[seg].at[0] + m.at[0], P.segments[seg].at[1] + m.at[1]] })));
  const gates = P.gates.map((g) => { const Z = zones.find((z) => z.id === g.from), w = Z.ways.find((x) => x.to === g.to); return { from: g.from, to: g.to, side: g.side, cross: w.cross, ...(g.join ? { join: true } : {}) }; });
  const concept = sketch?.concept ?? null, laws = sketchLaws(G, sketch);
  return { title: title ?? 'The world map', T, rows: G.rows, cols: G.cols, n: P.size, route: P.route, layout: P.layout, zones, gates, cells, pieces, marks, concept, laws, land: { k: SHADE_K, lo: r1(lo), hi: r1(hi), z: land.map(r1), shade } };
}

// ---- drawing ----
// (the level's frame on the page: x east, y north; the page's y down)
const pt = ([x, y]) => `${r1(x)},${r1(-y)}`;
const lerpHex = (a, b, t) => '#' + [0, 2, 4].map((k) => Math.round(parseInt(a.slice(1 + k, 3 + k), 16) * (1 - t) + parseInt(b.slice(1 + k, 3 + k), 16) * t).toString(16).padStart(2, '0')).join('');
const LOW = '#7fa65a', HIGH = '#c9b98a';

// the ground over a box of tiles: each sample a square, its height's tint, its slope's light
function groundSvg(V, r0, c0, r1_, c1_) {
  const { k, lo, hi, z, shade } = V.land, step = V.T / k, W = V.cols * k, out = [];
  for (let j = r0 * k; j < r1_ * k; j++) for (let i = c0 * k; i < c1_ * k; i++) {
    const n = j * W + i, t = hi > lo ? (z[n] - lo) / (hi - lo) : 0.5, base = lerpHex(LOW, HIGH, t), s = shade[n];
    const fill = s >= 0 ? lerpHex(base, '#ffffff', s * 0.35) : lerpHex(base, '#1e2a14', -s * 0.45);
    out.push(`<rect x="${r1(i * step)}" y="${r1(j * step)}" width="${r1(step + 0.2)}" height="${r1(step + 0.2)}" fill="${fill}"/>`);
  }
  return out.join('');
}
function cellsSvg(V, keep) {
  const T = V.T, out = [];
  for (const x of V.cells) {
    if (!keep(x)) continue;
    for (const Pl of x.paths) out.push(`<polyline class="trail" points="${Pl.map(pt).join(' ')}"/>`);
    if (x.kind === 'place') {
      const cx = (x.c + 0.5) * T, cy = (x.r + 0.5) * T, s = T * 0.46;
      out.push(`<rect class="place${x.place?.goal ? ' goal' : ''}" x="${r1(cx - s / 2)}" y="${r1(cy - s / 2)}" width="${r1(s)}" height="${r1(s)}" rx="1.5"/>`);
      if (x.door) out.push(`<circle class="door" cx="${r1(x.door.at[0])}" cy="${r1(-x.door.at[1])}" r="${r1(T * 0.06)}"/>`);
    }
  }
  return out.join('');
}
// THE SKETCH'S GROUND: each tile's features where its seed puts them (a hash of its place, never dice)
const hash = (r, c, k) => { let h = Math.imul(r + 101, 73856093) ^ Math.imul(c + 7, 19349663) ^ Math.imul(k + 3, 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const GROUND_LOOK = Object.freeze({ f: { n: 11, r: 0.085, fill: '#2f5a32' }, g: { n: 4, r: 0.08, fill: '#4a7a42' }, r: { n: 5, r: 0.05, fill: '#8d887c' }, s: { n: 10, r: 0.02, fill: '#9a8a5a' } });
function sketchSvg(V, keep) {
  const T = V.T, out = [];
  for (const x of V.cells) {
    if (!x.ground || !keep(x)) continue;
    const X = x.c * T, Y = x.r * T, g = x.ground;
    if (g === 'w') { out.push(`<rect class="sk-water" x="${r1(X + T * 0.08)}" y="${r1(Y + T * 0.08)}" width="${r1(T * 0.84)}" height="${r1(T * 0.84)}" rx="${r1(T * 0.3)}"/>`); continue; }
    if (g === 'c') { out.push(`<rect class="sk-cliff" x="${X}" y="${Y}" width="${T}" height="${T}"/>`); for (let k = 1; k < 6; k++) out.push(`<line class="sk-hatch" x1="${r1(X + (k * T) / 6)}" y1="${Y}" x2="${X}" y2="${r1(Y + (k * T) / 6)}"/><line class="sk-hatch" x1="${r1(X + T)}" y1="${r1(Y + (k * T) / 6)}" x2="${r1(X + (k * T) / 6)}" y2="${r1(Y + T)}"/>`); continue; }
    if (g === 'm') { for (let k = 0; k < 7; k++) { const a = X + T * (0.12 + 0.76 * hash(x.r, x.c, k)), b = Y + T * (0.12 + 0.76 * hash(x.r, x.c, k + 40)); out.push(`<path class="sk-tuft" d="M${r1(a - 1)},${r1(b)} l1,-2 l1,2"/>`); } continue; }
    const L = GROUND_LOOK[g];
    for (let k = 0; k < L.n; k++) { const a = X + T * (0.12 + 0.76 * hash(x.r, x.c, k)), b = Y + T * (0.12 + 0.76 * hash(x.r, x.c, k + 40)); out.push(`<circle cx="${r1(a)}" cy="${r1(b)}" r="${r1(T * L.r * (0.75 + 0.5 * hash(x.r, x.c, k + 80)))}" fill="${L.fill}"${g === 'r' ? ' stroke="#4a463c" stroke-width=".3"' : ''}/>`); }
  }
  return out.join('');
}
const MARK_LOOK = Object.freeze({ encounter: ['⚔', '#b04a3a'], loot: ['◆', '#c8962a'], landmark: ['★', '#3a6aa8'], secret: ['?', '#7a4a9a'], rest: ['⌂', '#3a8a5a'], hazard: ['!', '#d0702a'], npc: ['☺', '#2a8a8a'] });
function marksSvg(V, keep, scale = 1) {
  return V.marks.filter((m) => keep(m.tile)).map((m) => {
    const [g, col] = MARK_LOOK[m.kind], same = V.marks.filter((o) => o.tile[0] === m.tile[0] && o.tile[1] === m.tile[1]), k = same.indexOf(m);
    const cx = (m.tile[1] + 0.5) * V.T + (k - (same.length - 1) / 2) * V.T * 0.3 * scale, cy = (m.tile[0] + 0.5) * V.T - V.T * 0.12, r = V.T * 0.13 * scale;
    return `<g class="mark"><circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" fill="${col}"/><text x="${r1(cx)}" y="${r1(cy + r * 0.42)}" font-size="${r1(r * 1.2)}">${g}</text><title>${esc(`${m.kind}: ${m.say}`)}</title></g>`;
  }).join('');
}
const heightsSvg = (V, keep) => V.cells.filter((x) => x.height !== undefined && keep(x)).map((x) => `<text class="sk-h" x="${r1(x.c * V.T + V.T * 0.06)}" y="${r1(x.r * V.T + V.T * 0.16)}" font-size="${r1(V.T * 0.11)}">${x.height}</text>`).join('');
const PIECE_MARK = Object.freeze({ pack: ['P', '#b04a3a'], boss: ['B', '#7a2030'], 'hero-tree': ['T', '#2f6a3a'] });
function piecesSvg(V, keep, scale = 1) {
  return V.pieces.filter((it) => keep(it.tile)).map((it) => {
    const [l, col] = PIECE_MARK[it.kind] ?? ['?', '#444'], cx = (it.tile[1] + 0.5) * V.T + V.T * 0.22, cy = (it.tile[0] + 0.5) * V.T - V.T * 0.22, r = V.T * 0.12 * scale;
    return `<g class="piece"><circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" fill="${col}"/><text x="${r1(cx)}" y="${r1(cy + r * 0.4)}" font-size="${r1(r * 1.15)}">${l}</text><title>${esc(it.id)}</title></g>`;
  }).join('');
}
const arrow = (at, heading, len, cls) => {
  const [x, y] = at, dx = Math.cos(heading) * len, dy = Math.sin(heading) * len, nx = -dy * 0.5, ny = dx * 0.5;
  return `<polygon class="${cls}" points="${pt([x + dx, y + dy])} ${pt([x - dx * 0.4 + nx, y - dy * 0.4 + ny])} ${pt([x - dx * 0.4 - nx, y - dy * 0.4 - ny])}"/>`;
};
const centre = (V, Z) => [(Z.box[0] + Z.box[2]) / 2, (Z.box[1] + Z.box[3]) / 2];

const STATUS_WORDS = Object.freeze({ approved: '✓ approved', draft: '✎ draft', unplanned: '○ not yet planned' });
// (the journey's beats in a segment, numbered in the journey's order, a row of badges over its name)
function beatBadges(V, Z, cx, cy) {
  const all = V.concept?.journey ?? [], here = all.map((b, i) => ({ b, i })).filter(({ b }) => b.at === Z.id), r = V.T * 0.14;
  return here.map(({ b, i }, k) => { const x = cx + (k - (here.length - 1) / 2) * r * 2.4, y = cy - V.T * 0.75; return `<g class="beat"><circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}"/><text x="${r1(x)}" y="${r1(y + r * 0.4)}" font-size="${r1(r * 1.1)}">${i + 1}</text><title>${esc(`${i + 1}. ${b.say}`)}</title></g>`; }).join('');
}
function worldSvg(V) {
  const W = V.cols * V.T, H = V.rows * V.T, m = V.T * 0.6, out = [];
  out.push(groundSvg(V, 0, 0, V.rows, V.cols));
  for (const Z of V.zones) out.push(`<rect class="zone-tint" x="${r1(Z.box[0])}" y="${r1(-Z.box[3])}" width="${r1(Z.box[2] - Z.box[0])}" height="${r1(Z.box[3] - Z.box[1])}" fill="${Z.tint}"/>`);
  out.push(sketchSvg(V, () => true));
  out.push(cellsSvg(V, () => true));
  out.push(piecesSvg(V, () => true, 1.4));
  out.push(marksSvg(V, () => true, 1.15));
  // the walk, zone to zone, and the joins off it
  const at = Object.fromEntries(V.zones.map((Z) => [Z.id, centre(V, Z)]));
  out.push(`<polyline class="route" points="${V.route.map((S) => pt(at[S])).join(' ')}"/>`);
  for (const g of V.gates.filter((x) => x.join)) out.push(`<line class="join" x1="${r1(at[g.from][0])}" y1="${r1(-at[g.from][1])}" x2="${r1(at[g.to][0])}" y2="${r1(-at[g.to][1])}"/>`);
  for (const g of V.gates) out.push(`<circle class="gate" cx="${r1(g.cross[0])}" cy="${r1(-g.cross[1])}" r="${r1(V.T * 0.16)}"><title>${esc(`${g.from} ↔ ${g.to}`)}</title></circle>`);
  for (const Z of V.zones) {
    const [cx, cy] = at[Z.id], s = Z.box[2] - Z.box[0];
    out.push(`<a href="#zone-${Z.id}" class="pick"><rect class="zone" x="${r1(Z.box[0])}" y="${r1(-Z.box[3])}" width="${r1(s)}" height="${r1(Z.box[3] - Z.box[1])}"/>
<text class="zname" x="${r1(cx)}" y="${r1(-cy - V.T * 0.1)}" font-size="${r1(V.T * 0.42)}">${esc(Z.name)}</text><text class="zrole" x="${r1(cx)}" y="${r1(-cy + V.T * 0.32)}" font-size="${r1(V.T * 0.24)}">${esc(Z.role)}${Z.holdsGoal ? ' · the goal' : ''}</text>
<text class="zstatus st-${Z.status}" x="${r1(cx)}" y="${r1(-cy + V.T * 0.62)}" font-size="${r1(V.T * 0.2)}">${STATUS_WORDS[Z.status]}</text>${beatBadges(V, Z, cx, -cy)}</a>`);
  }
  return `<svg class="map" viewBox="${r1(-m)} ${r1(-m)} ${r1(W + 2 * m)} ${r1(H + 2 * m)}" role="img" aria-label="${esc(V.title)}">${out.join('')}</svg>`;
}

function zoneSvg(V, Z) {
  const T = V.T, built = new Set(Z.built), own = new Set(Z.own), out = [];
  const rs = Z.built.map((k) => +k.split(',')[0]), cs = Z.built.map((k) => +k.split(',')[1]);
  const R0 = Math.min(...rs), R1 = Math.max(...rs) + 1, C0 = Math.min(...cs), C1 = Math.max(...cs) + 1, m = T * 0.35;
  out.push(groundSvg(V, R0, C0, R1, C1));
  out.push(`<rect class="zone-tint" x="${r1(Z.box[0])}" y="${r1(-Z.box[3])}" width="${r1(Z.box[2] - Z.box[0])}" height="${r1(Z.box[3] - Z.box[1])}" fill="${Z.tint}"/>`);
  out.push(sketchSvg(V, (x) => built.has(`${x.r},${x.c}`)));
  out.push(cellsSvg(V, (x) => built.has(`${x.r},${x.c}`)));
  out.push(piecesSvg(V, (t) => own.has(`${t[0]},${t[1]}`)));
  out.push(marksSvg(V, (t) => own.has(`${t[0]},${t[1]}`)));
  out.push(heightsSvg(V, (x) => own.has(`${x.r},${x.c}`)));
  // (the apron: the neighbours' tiles the page shows, never walked: veiled)
  for (const k of Z.built) if (!own.has(k)) { const [r, c] = k.split(',').map(Number); out.push(`<rect class="apron" x="${c * T}" y="${r * T}" width="${T}" height="${T}"/>`); }
  // the tiles, each a link down
  for (const k of Z.own) { const [r, c] = k.split(',').map(Number); out.push(`<a href="#tile-${r}-${c}" class="pick"><rect class="tile" x="${c * T}" y="${r * T}" width="${T}" height="${T}"/></a>`); }
  out.push(`<rect class="border" x="${r1(Z.box[0])}" y="${r1(-Z.box[3])}" width="${r1(Z.box[2] - Z.box[0])}" height="${r1(Z.box[3] - Z.box[1])}"/>`);
  // its gates, each sideways to the zone across; where one is set down coming in by it; where the page sets out
  for (const w of Z.ways) {
    const to = V.zones.find((x) => x.id === w.to), out_ = Math.atan2(-Math.sin(w.heading), -Math.cos(w.heading));
    const lab = [w.cross[0] - Math.cos(w.heading) * T * 0.42, w.cross[1] - Math.sin(w.heading) * T * 0.42];
    out.push(`<a href="#zone-${w.to}" class="pick">${arrow([w.cross[0] - Math.cos(w.heading) * T * 0.12, w.cross[1] - Math.sin(w.heading) * T * 0.12], out_, T * 0.16, 'gate-out')}<text class="gate-to" x="${r1(lab[0])}" y="${r1(-lab[1])}" font-size="${r1(T * 0.17)}">${{ n: '↑', e: '→', s: '↓', w: '←' }[w.side]} ${esc(to.name)}</text></a>`);
    out.push(arrow(w.arrive, w.heading, T * 0.08, 'arrive'));
  }
  out.push(`<circle class="spawn" cx="${r1(Z.spawn[0])}" cy="${r1(-Z.spawn[1])}" r="${r1(T * 0.07)}"><title>where its page sets out</title></circle>`);
  return `<svg class="map" viewBox="${r1(C0 * T - m)} ${r1(R0 * T - m)} ${r1((C1 - C0) * T + 2 * m)} ${r1((R1 - R0) * T + 2 * m)}" role="img" aria-label="${esc(Z.name)}">${out.join('')}</svg>`;
}

function tileSvg(V, x) {
  const T = V.T, m = T * 0.08, here = (t) => t[0] === x.r && t[1] === x.c;
  const out = [groundSvg(V, x.r, x.c, x.r + 1, x.c + 1), sketchSvg(V, (y) => y === x), cellsSvg(V, (y) => y === x), piecesSvg(V, here, 1.6), marksSvg(V, here, 1.6)];
  const Z = V.zones.find((z) => z.own.includes(`${x.r},${x.c}`));
  for (const w of Z?.ways ?? []) if (w.tile[0] === x.r && w.tile[1] === x.c) out.push(arrow(w.arrive, w.heading, T * 0.06, 'arrive'), `<circle class="gate" cx="${r1(w.cross[0])}" cy="${r1(-w.cross[1])}" r="${r1(T * 0.05)}"/>`);
  return `<svg class="map tile-map" viewBox="${r1(x.c * T - m)} ${r1(x.r * T - m)} ${r1(T + 2 * m)} ${r1(T + 2 * m)}" role="img">${out.join('')}</svg>`;
}

const SIDE = { n: 'north', e: 'east', s: 'south', w: 'west' };
const shapeWords = (x) => (x.kind === 'path' ? `a path, ${{ end: 'its end', I: 'straight through', L: 'turning a corner', T: 'forking', X: 'a crossing' }[x.shape] ?? x.shape} (open ${x.open.map((s) => SIDE[s]).join(', ')})` : x.kind === 'place' ? `a ${x.place?.use ?? 'place'}${x.place?.goal ? ', the walk\'s goal' : ''}${x.door ? `, its door ${SIDE[x.door.side]}` : ''}` : 'open land');

/** The page: the world, each zone and each of its tiles, the one shown the one the address names. */
export function worldmapHtml(V, { play = {}, model = null, brief = null } = {}) {
  const zoneOfTile = (r, c) => V.zones.find((z) => z.own.includes(`${r},${c}`));
  const crumbs = (...parts) => `<nav class="crumbs">${parts.map(([h, t], i) => (i < parts.length - 1 ? `<a href="#${h}">${esc(t)}</a> <span>›</span> ` : `<b>${esc(t)}</b>`)).join('')}</nav>`;
  const world = `<section id="world" class="view">${crumbs(['world', V.title])}<div class="body">${worldSvg(V)}<aside><h2>${esc(V.title)}</h2>
${V.concept?.pitch ? `<p class="pitch">${esc(V.concept.pitch)}</p>` : ''}
<p>${V.zones.length} zones of ${V.n} × ${V.n} tiles (${V.T} m), each its own page, crossed at the ${V.gates.length} gates on their borders.</p>
${V.concept ? `<h3>The journey</h3><ol class="journey">${V.concept.journey.map((b) => `<li>${esc(b.say)} <small><a href="#zone-${b.at}">${esc(V.zones.find((Z) => Z.id === b.at).name)}</a> · ${esc(b.kind)}</small></li>`).join('')}</ol>` : ''}
<h3>The zones</h3><ul>${V.zones.map((Z) => `<li><a href="#zone-${Z.id}"><i style="background:${Z.tint}"></i>${esc(Z.name)}</a> <small>${esc(ROLE_WORDS[Z.role] ?? Z.role)}${Z.holdsGoal ? ', holds the goal' : ''} · <span class="st-${Z.status}">${STATUS_WORDS[Z.status]}</span></small></li>`).join('')}</ul>
${V.laws.length ? `<h3>The sketch's laws</h3><ul class="laws">${V.laws.map((l) => `<li class="${l.ok ? 'ok' : 'no'}">${l.ok ? '✓' : '✗'} ${esc(l.law)} <small>${esc(l.value)}</small></li>`).join('')}</ul>` : ''}
${V.marks.length || V.cells.some((x) => x.ground) ? `<p class="key">${Object.entries(MARK_LOOK).map(([k, [g, c]]) => `<span class="mk" style="background:${c}">${g}</span> ${k}`).join(' · ')}</p>` : ''}
${model ? `<p><a class="play" href="${esc(model)}">See it as a model ▸</a></p>` : ''}
<p class="key"><span class="k route"></span> the walk · <span class="k join"></span> a join off it · <span class="k gate"></span> a gate</p></aside></div></section>`;
  const zones = V.zones.map((Z) => `<section id="zone-${Z.id}" class="view">${crumbs(['world', V.title], [`zone-${Z.id}`, Z.name])}<div class="body">${zoneSvg(V, Z)}<aside><h2>${esc(Z.name)}</h2>
<p>${esc(ROLE_WORDS[Z.role] ?? Z.role)}${Z.holdsGoal ? '; it holds the walk\'s goal' : ''}. Its page shows its ${Z.own.length} tiles and ${Z.built.length - Z.own.length} of its neighbours' (veiled), never walked.</p>
<p class="status st-${Z.status}">${STATUS_WORDS[Z.status]}${brief ? ` · <a href="${esc(brief(Z.id))}">its brief</a>` : ''}</p>
${Z.beats.length ? `<h3>What happens here</h3><ol class="journey">${Z.beats.map((id) => { const i = V.concept.journey.findIndex((b) => b.id === id); return `<li value="${i + 1}">${esc(V.concept.journey[i].say)} <small>${esc(V.concept.journey[i].kind)}</small></li>`; }).join('')}</ol>` : ''}
${V.marks.some((m) => m.segment === Z.id) ? `<h3>Marked</h3><ul class="marks">${V.marks.filter((m) => m.segment === Z.id).map((m) => `<li><span class="mk" style="background:${MARK_LOOK[m.kind][1]}">${MARK_LOOK[m.kind][0]}</span> ${esc(m.say)}${m.foes ? ` <small>(${esc([m.foes.count, m.foes.kind].filter(Boolean).join(' '))})</small>` : ''}${m.item ? ` <small>(${esc(m.item)})</small>` : ''}</li>`).join('')}</ul>` : ''}
${Z.notes ? `<p class="notes">${esc(Z.notes)}</p>` : ''}
${V.cells.some((x) => x.ground && Z.own.includes(`${x.r},${x.c}`)) ? `<p class="key">${[...new Set(V.cells.filter((x) => x.ground && Z.own.includes(`${x.r},${x.c}`)).map((x) => x.ground))].map((g) => `<b>${g}</b> ${esc(SKETCH_GROUND[g].split(':')[0])}`).join(' · ')}; the small number a tile's height</p>` : ''}
<h3>Its gates</h3><ul>${Z.ways.map((w) => `<li>${SIDE[w.side]}: <a href="#zone-${w.to}">${esc(V.zones.find((x) => x.id === w.to).name)}</a>${w.join ? ' <small>(a join)</small>' : ''}</li>`).join('') || '<li>none</li>'}</ul>
${play[Z.id] ? `<p><a class="play" href="${esc(play[Z.id])}">Walk this zone ▸</a></p>` : ''}
<p class="key"><span class="k spawn"></span> its page sets out · <span class="k arrive"></span> set down, coming in by a gate</p></aside></div></section>`).join('');
  const tiles = V.cells.filter((x) => zoneOfTile(x.r, x.c)).map((x) => {
    const Z = zoneOfTile(x.r, x.c), here = V.pieces.filter((it) => it.tile[0] === x.r && it.tile[1] === x.c), gate = Z.ways.find((w) => w.tile[0] === x.r && w.tile[1] === x.c);
    return `<section id="tile-${x.r}-${x.c}" class="view">${crumbs(['world', V.title], [`zone-${Z.id}`, Z.name], [`tile-${x.r}-${x.c}`, `row ${x.r + 1}, column ${x.c + 1}`])}<div class="body">${tileSvg(V, x)}<aside><h2>Row ${x.r + 1}, column ${x.c + 1}</h2>
<p>${esc(shapeWords(x))}.</p>${x.ground ? `<p>Its ground: ${esc(SKETCH_GROUND[x.ground])}.</p>` : ''}<p>The land from ${x.z[0]} to ${x.z[1]} m${x.height !== undefined ? ` (sketched ${x.height} step${x.height === 1 ? '' : 's'} up)` : ''}.</p>
${V.marks.filter((m) => m.tile[0] === x.r && m.tile[1] === x.c).map((m) => `<p><span class="mk" style="background:${MARK_LOOK[m.kind][1]}">${MARK_LOOK[m.kind][0]}</span> ${esc(m.kind)}: ${esc(m.say)}</p>`).join('')}
${here.length ? `<p>Of the game: ${here.map((it) => esc(it.id)).join(', ')}.</p>` : ''}
${gate ? `<p>A gate: ${SIDE[gate.side]} to <a href="#zone-${gate.to}">${esc(V.zones.find((z) => z.id === gate.to).name)}</a>.</p>` : ''}
<p class="steps">${[['n', -1, 0], ['w', 0, -1], ['e', 0, 1], ['s', 1, 0]].map(([s, dr, dc]) => { const y = zoneOfTile(x.r + dr, x.c + dc); return y ? `<a href="#tile-${x.r + dr}-${x.c + dc}">${SIDE[s]}${y !== Z ? ` (${esc(y.name)})` : ''}</a>` : ''; }).filter(Boolean).join(' · ')}</p></aside></div></section>`;
  }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(V.title)}</title><style>
:root{--ink:#2b2a26;--paper:#f3eee2;--line:#d8cfba;--accent:#a8402a}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.45 Georgia,serif}
.view{display:none;padding:16px;max-width:1200px;margin:0 auto}.view:target{display:block}body:not(:has(.view:target)) #world{display:block}
.crumbs{font:13px system-ui,sans-serif;margin:0 0 10px}.crumbs a{color:var(--accent);text-decoration:none}.crumbs span{color:#998}
.body{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:18px;align-items:start}
@media (max-width:760px){.body{grid-template-columns:1fr}}
.map{width:100%;height:auto;max-height:78vh;background:#e8e1cf;border:1px solid var(--line);border-radius:6px}
aside h2{margin:0 0 6px;font-size:22px}aside h3{margin:14px 0 4px;font-size:15px}aside ul{padding-left:18px;margin:6px 0}aside a{color:var(--accent)}
aside i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px}small{color:#776}
.key{font:12px system-ui,sans-serif;color:#665}.k{display:inline-block;width:14px;height:4px;vertical-align:middle;margin:0 3px}
.k.route{background:#a8402a}.k.join{border-top:2px dashed #a8402a;height:0}.k.gate{width:8px;height:8px;border-radius:50%;background:#fff;border:2px solid #2b2a26}
.k.spawn{width:8px;height:8px;border-radius:50%;background:#f2c14e;border:1px solid #2b2a26}.k.arrive{width:0;height:0;border:5px solid transparent;border-left:8px solid #2b2a26}
.play{display:inline-block;padding:6px 12px;background:var(--accent);color:#fff!important;border-radius:4px;text-decoration:none;font:14px system-ui,sans-serif}
.zone-tint{opacity:.22}.trail{fill:none;stroke:#d8c39a;stroke-width:3.4;stroke-linecap:round;stroke-linejoin:round}
.place{fill:#8a5a4a;stroke:#3a2a22;stroke-width:.5}.place.goal{fill:#6a4a8a}.door{fill:#f2c14e;stroke:#3a2a22;stroke-width:.3}
.route{fill:none;stroke:#a8402a;stroke-width:1.6;stroke-dasharray:none;opacity:.85;marker-end:none}.join{stroke:#a8402a;stroke-width:1.2;stroke-dasharray:3 3;opacity:.85}
.gate{fill:#fff;stroke:#2b2a26;stroke-width:.8}.zone{fill:transparent;stroke:#2b2a26;stroke-width:1}
.pick:hover .zone,.pick:hover .tile{fill:rgba(255,255,255,.18)}.tile{fill:transparent;stroke:rgba(43,42,38,.25);stroke-width:.3}
.zname{text-anchor:middle;fill:#2b2a26;font-weight:bold;paint-order:stroke;stroke:#f3eee2;stroke-width:1.2}.zrole{text-anchor:middle;fill:#4a463c;paint-order:stroke;stroke:#f3eee2;stroke-width:.9}
.apron{fill:#f3eee2;opacity:.55}.border{fill:none;stroke:#2b2a26;stroke-width:.9}
.gate-out{fill:#a8402a}.gate-to{text-anchor:middle;fill:#a8402a;font-family:system-ui,sans-serif;paint-order:stroke;stroke:#f3eee2;stroke-width:.8}
.arrive{fill:#2b2a26}.spawn{fill:#f2c14e;stroke:#2b2a26;stroke-width:.4}
.piece text{text-anchor:middle;fill:#fff;font-family:system-ui,sans-serif;font-weight:bold}
.tile-map{max-height:70vh}.steps a{margin-right:4px}
.sk-water{fill:#5a8ab0;opacity:.85}.sk-cliff{fill:#6a5a48;opacity:.55}.sk-hatch{stroke:#3a3026;stroke-width:.5}.sk-tuft{fill:none;stroke:#e6efc8;stroke-width:.5}
.sk-h{fill:#2b2a26;font-family:system-ui,sans-serif;opacity:.75}
.mark text,.beat text{text-anchor:middle;fill:#fff;font-family:system-ui,sans-serif;font-weight:bold}.beat circle{fill:#2b2a26;stroke:#f3eee2;stroke-width:.6}
.zstatus{text-anchor:middle;font-family:system-ui,sans-serif;paint-order:stroke;stroke:#f3eee2;stroke-width:.8}
.st-approved{fill:#2f6a3a;color:#2f6a3a}.st-draft{fill:#a86a1a;color:#a86a1a}.st-unplanned{fill:#776;color:#776}
.mk{display:inline-block;min-width:18px;height:18px;line-height:18px;border-radius:9px;color:#fff;text-align:center;font:12px system-ui,sans-serif;margin-right:2px}
.journey{padding-left:22px}.journey li{margin:3px 0}.laws{list-style:none;padding:0}.laws .ok{color:#2f6a3a}.laws .no{color:#a8402a}.laws small{color:#665;display:block;margin-left:16px}
.pitch{font-style:italic}.notes{border-left:3px solid var(--line);padding-left:8px;color:#554}
</style></head><body>${world}${zones}${tiles}</body></html>`;
}
