/**
 * THE WORLD MAP AS A MODEL — a zoned map (zones.js) as a greybox diorama on a plinth, from its recipe alone (no tile
 * built, no page baked): the level's one land, its rise lifted so it reads at table scale; each zone's ground faintly
 * its own tint, its border a dark line broken at its gates; the paths, the places as blocks (the walk's goal taller), a
 * post either side of every gate, the pieces as markers, where each zone's page sets out. With a SKETCH (map-sketch.js):
 * its heights in the land, its ground laid as greybox (trees in a forest or a grove, boulders, a cliff's slabs, water,
 * meadow and scrub in their tints) and its marks as coloured posts, each told on hover. A camera bookmark over the
 * whole and one over each zone; each zone named over its middle.
 *
 *   worldmapModel(level, { lift?, title? }) → { faces, cameras, signs, title }   (the World payload's own words, z up)
 *   worldmapModelHtml(level, opts)          → the page (scene/scene-three.js emitThreeWorld, orbit, three.js inlined)
 *
 * Pure: the land's heights from era/out-tile.js levelHeight, as every tile lays them; no dice.
 */
import { worldmapView } from './worldmap-view.js';
import { levelHeight } from '../era/out-tile.js';
import { readGrid } from './grid.js';
import { readSketch, sketchRise } from './map-sketch.js';

export const MODEL = Object.freeze({ lift: 4, k: 6, trail: 4, post: [1.6, 6], border: 0.9, gap: 7, plinth: 10 });
const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
const GREY = '#bdb9ae', BASE = '#3a3833', TRAIL = '#e4d6b4', BORDER = '#2b2a26', POST = '#a8402a';
const lerpHex = (a, b, t) => '#' + [0, 2, 4].map((k) => Math.round(parseInt(a.slice(1 + k, 3 + k), 16) * (1 - t) + parseInt(b.slice(1 + k, 3 + k), 16) * t).toString(16).padStart(2, '0')).join('');

// a quad, its corners counter-clockwise seen from the side it faces
function quad(a, b, c, d, fill, group) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], L = Math.hypot(...n) || 1;
  return { corners: [a, b, c, d].map((p) => p.map(r3)), normal: n.map((x) => r3(x / L)), fill, group, doubleSided: true };
}
// an upright box from z0 up h, centred on (x, y)
function box(x, y, z0, w, dpt, h, fill, group) {
  const x0 = x - w / 2, x1 = x + w / 2, y0 = y - dpt / 2, y1 = y + dpt / 2, z1 = z0 + h;
  return [
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], fill, group),
    quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], fill, group), quad([x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], fill, group),
    quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], fill, group), quad([x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], fill, group),
  ];
}
// a ribbon draped on the land along a polyline, `w` wide, `up` over it
function ribbon(line, w, up, ground, fill, group) {
  const out = [];
  for (let i = 0; i + 1 < line.length; i++) {
    const [ax, ay] = line[i], [bx, by] = line[i + 1], L = Math.hypot(bx - ax, by - ay) || 1, nx = (-(by - ay) / L) * (w / 2), ny = ((bx - ax) / L) * (w / 2);
    const za = ground(ax, ay) + up, zb = ground(bx, by) + up;
    out.push(quad([ax - nx, ay - ny, za], [bx - nx, by - ny, zb], [bx + nx, by + ny, zb], [ax + nx, ay + ny, za], fill, group));
  }
  return out;
}

export function worldmapModel(level, { lift = MODEL.lift, title = null } = {}) {
  const V = worldmapView(level, { title }), G = readGrid(level.grid, 'level.grid'), T = V.T, k = MODEL.k, step = T / k;
  const rise = sketchRise(G, readSketch(level.sketch, G.plan));
  const L = { seed: level.seed ?? 1, ...(rise ? { rise } : {}) }, ground = (x, y) => levelHeight(x, y, L) * lift;
  const groundOf = (r, c) => V.cells[r * V.cols + c]?.ground ?? null;
  const TINT = { m: '#b9c79a', s: '#cbbb92', c: '#7d7366', f: '#8f9e80', g: '#a8b392' };
  const W = V.cols * T, H = V.rows * T, faces = [];
  const zoneAt = (r, c) => V.zones.find((Z) => Z.own.includes(`${r},${c}`));
  // THE LAND: a greybox sheet, each zone's ground faintly its tint
  let lo = Infinity;
  for (let j = 0; j < V.rows * k; j++) for (let i = 0; i < V.cols * k; i++) {
    const x0 = i * step, x1 = x0 + step, y1 = -j * step, y0 = y1 - step, Z = zoneAt(Math.floor(j / k), Math.floor(i / k));
    const c = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => [x, y, ground(x, y)]);
    for (const p of c) lo = Math.min(lo, p[2]);
    // (lit from the north-west, high: the slope toward it lighter, away darker, baked into its colour)
    const gr = groundOf(Math.floor(j / k), Math.floor(i / k)), tint = Z ? lerpHex(GREY, Z.tint, 0.28) : GREY;
    const f = quad(c[0], c[1], c[2], c[3], gr && TINT[gr] ? lerpHex(tint, TINT[gr], 0.55) : tint, 'worldmap:land'), l = f.normal[0] * -0.45 + f.normal[1] * 0.45 + f.normal[2] * 0.77 - 0.77;
    f.fill = l >= 0 ? lerpHex(f.fill, '#ffffff', Math.min(0.3, l * 1.6)) : lerpHex(f.fill, '#1e1c18', Math.min(0.3, -l * 1.6));
    faces.push(f);
  }
  // THE PLINTH: the land's edge carried down to a base, and the base under it
  const base = lo - MODEL.plinth, edge = [];
  for (let i = 0; i < V.cols * k; i++) edge.push([i * step, 0]);
  for (let j = 0; j < V.rows * k; j++) edge.push([W, -j * step]);
  for (let i = V.cols * k; i > 0; i--) edge.push([i * step, -H]);
  for (let j = V.rows * k; j > 0; j--) edge.push([0, -j * step]);
  edge.forEach(([x, y], n) => { const [x2, y2] = edge[(n + 1) % edge.length]; faces.push(quad([x, y, base], [x2, y2, base], [x2, y2, ground(x2, y2)], [x, y, ground(x, y)], BASE, 'worldmap:plinth')); });
  faces.push(quad([0, -H, base], [W, -H, base], [W, 0, base], [0, 0, base], BASE, 'worldmap:plinth'));
  // THE PATHS and THE PLACES
  for (const x of V.cells) {
    for (const Pl of x.paths) faces.push(...ribbon(Pl, MODEL.trail, 0.25, ground, TRAIL, 'worldmap:trail'));
    if (x.kind === 'place') {
      const cx = (x.c + 0.5) * T, cy = -(x.r + 0.5) * T, s = T * 0.46, z0 = Math.min(...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ground(cx + (a * s) / 2, cy + (b * s) / 2)));
      faces.push(...box(cx, cy, z0 - 0.5, s, s, x.place?.goal ? 14 : 7, x.place?.goal ? '#6a4a8a' : '#8a6a5a', 'worldmap:place'));
      if (x.door) faces.push(...box(x.door.at[0], x.door.at[1], ground(...x.door.at), 2, 2, 0.6, '#f2c14e', 'worldmap:door'));
    }
  }
  // THE SKETCH'S GROUND: trees, boulders, a cliff's slabs, water, where each tile's seed puts them
  const hash = (r, c, n) => { let h = Math.imul(r + 101, 73856093) ^ Math.imul(c + 7, 19349663) ^ Math.imul(n + 3, 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const spot = (x, n) => { const a = (x.c + 0.12 + 0.76 * hash(x.r, x.c, n)) * T, b = -(x.r + 0.12 + 0.76 * hash(x.r, x.c, n + 40)) * T; return [a, b]; };
  const clearOfPath = (x, p) => !x.paths.some((Pl) => Pl.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < MODEL.trail));
  for (const x of V.cells) {
    if (!x.ground) continue;
    const g = x.ground;
    if (g === 'f' || g === 'g') for (let n = 0; n < (g === 'f' ? 12 : 5); n++) { const p = spot(x, n); if (clearOfPath(x, p)) faces.push(...box(p[0], p[1], ground(...p) - 0.3, 2.6, 2.6, 5 + 4 * hash(x.r, x.c, n + 80), g === 'f' ? '#3f6a3f' : '#5a8a4a', 'worldmap:tree')); }
    if (g === 'r') for (let n = 0; n < 5; n++) { const p = spot(x, n), w = 1.6 + 2 * hash(x.r, x.c, n + 80); if (clearOfPath(x, p)) faces.push(...box(p[0], p[1], ground(...p) - 0.4, w, w * 0.8, w * 0.7, '#9a958a', 'worldmap:rock')); }
    if (g === 'c') for (let n = 0; n < 3; n++) { const p = spot(x, n); faces.push(...box(p[0], p[1], ground(...p) - 1, 5, 3, 8 + 4 * hash(x.r, x.c, n + 80), '#6f655a', 'worldmap:cliff')); }
    if (g === 'w') { const X0 = x.c * T + T * 0.1, X1 = (x.c + 1) * T - T * 0.1, Y1 = -x.r * T - T * 0.1, Y0 = -(x.r + 1) * T + T * 0.1, z = Math.min(...[[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1]].map((p) => ground(...p))) + 0.6; faces.push(quad([X0, Y0, z], [X1, Y0, z], [X1, Y1, z], [X0, Y1, z], '#5a8ab0', 'worldmap:water')); }
  }
  // THE BORDERS between zones, broken at their gates; A POST either side of every gate
  const gates = V.gates.map((g) => g.cross);
  const nearGate = (x, y) => gates.some((p) => Math.hypot(p[0] - x, p[1] - y) < MODEL.gap / 2);
  const seg = (a, b) => { const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2)), pts = Array.from({ length: n + 1 }, (_, t) => [a[0] + ((b[0] - a[0]) * t) / n, a[1] + ((b[1] - a[1]) * t) / n]); let run = []; for (const p of pts) { if (nearGate(...p)) { if (run.length > 1) faces.push(...ribbon(run, MODEL.border, 0.35, ground, BORDER, 'worldmap:border')); run = []; } else run.push(p); } if (run.length > 1) faces.push(...ribbon(run, MODEL.border, 0.35, ground, BORDER, 'worldmap:border')); };
  for (const Z of V.zones) { const [x0, y0, x1, y1] = Z.box; seg([x0, y1], [x1, y1]); seg([x1, y1], [x1, y0]); seg([x1, y0], [x0, y0]); seg([x0, y0], [x0, y1]); }
  for (const g of V.gates) {
    const across = g.side === 'n' || g.side === 's' ? [1, 0] : [0, 1];
    for (const sgn of [-1, 1]) { const x = g.cross[0] + across[0] * sgn * (MODEL.gap / 2 + 0.5), y = g.cross[1] + across[1] * sgn * (MODEL.gap / 2 + 0.5); faces.push(...box(x, y, ground(x, y) - 0.3, MODEL.post[0], MODEL.post[0], MODEL.post[1], POST, 'worldmap:gate')); }
  }
  // THE PIECES and where each zone's page sets out
  const MARK = { pack: '#b04a3a', boss: '#7a2030', 'hero-tree': '#2f6a3a' };
  for (const it of V.pieces) { const x = (it.tile[1] + 0.5) * T + T * 0.22, y = -(it.tile[0] + 0.5) * T - T * 0.22; faces.push(...box(x, y, ground(x, y), 3, 3, it.kind === 'hero-tree' ? 9 : 4, MARK[it.kind] ?? '#444', 'worldmap:piece')); }
  for (const Z of V.zones) faces.push(...box(Z.spawn[0], Z.spawn[1], ground(Z.spawn[0], Z.spawn[1]), 2.2, 2.2, 2.2, '#f2c14e', 'worldmap:spawn'));
  // THE MARKS: a coloured post each, a cap on it, told on hover
  const MARKC = { encounter: '#b04a3a', loot: '#c8962a', landmark: '#3a6aa8', secret: '#7a4a9a', rest: '#3a8a5a', hazard: '#d0702a', npc: '#2a8a8a' };
  const markAt = (m) => { const same = V.marks.filter((o) => o.tile[0] === m.tile[0] && o.tile[1] === m.tile[1]), k = same.indexOf(m); return [(m.tile[1] + 0.5) * T + (k - (same.length - 1) / 2) * 6, -(m.tile[0] + 0.5) * T + 3]; };
  for (const m of V.marks) { const [x, y] = markAt(m), z = ground(x, y); faces.push(...box(x, y, z, 1.4, 1.4, 7, MARKC[m.kind], 'worldmap:mark'), ...box(x, y, z + 7, 3, 3, 2, MARKC[m.kind], 'worldmap:mark')); }
  // THE CAMERAS: the whole from the south, a little east; each zone from its south, nearer
  const top = Math.max(...faces.map((f) => Math.max(...f.corners.map((c) => c[2])))), span = Math.max(W, H);
  const view = (name, cx, cy, s) => ({ name, worldFraming: { cameraPosition: [r3(cx + s * 0.3), r3(cy - s * 1.35), r3(top + s * 1.2)], lookAt: [r3(cx), r3(cy), r3(lo)], horizontalFov: 50 } });
  const cameras = [view('the whole map', W / 2, -H / 2, span), ...V.zones.map((Z) => view(Z.name, (Z.box[0] + Z.box[2]) / 2, (Z.box[1] + Z.box[3]) / 2, (Z.box[2] - Z.box[0]) * 1.25))];
  // THE NAMES, over each zone's middle
  const chrome = { bg: 'rgba(243,238,226,.92)', color: '#2b2a26', border: '1px solid #2b2a26', radius: '4px', shadow: 'none', glow: 'none', font: 'Georgia, serif', fontSize: 13, fontWeight: 600, padding: '3px 7px' };
  const signs = V.zones.map((Z) => { const cx = (Z.box[0] + Z.box[2]) / 2, cy = (Z.box[1] + Z.box[3]) / 2; return { id: `zone-${Z.id}`, variant: 'popup', anchor: { kind: 'world', world: [r3(cx), r3(cy), r3(ground(cx, cy) + 18)] }, text: Z.name, body: [`${Z.name} · ${Z.role}${Z.holdsGoal ? ' · the goal' : ''}`], chrome }; });
  const tip = { ...chrome, fontSize: 12, fontWeight: 500 };
  for (const m of V.marks) { const [x, y] = markAt(m); signs.push({ id: `mark-${m.segment}-${m.n}`, variant: 'tooltip', anchor: { kind: 'world', world: [r3(x), r3(y), r3(ground(x, y) + 9.5)] }, text: `${m.kind}: ${m.say}`, body: [], chrome: tip }); }
  return { faces, cameras, signs, title: V.title };
}

/** The model as a page: orbit it, its bookmarks over the whole and each zone. */
export async function worldmapModelHtml(level, opts = {}) {
  const { emitThreeWorld } = await import('../scene/scene-three.js');
  const M = worldmapModel(level, opts);
  return emitThreeWorld({ faces: M.faces, cameras: M.cameras, signs: M.signs, title: `${M.title} · model`, bg: '#e8e1cf', inline: true, hud: true, walk: false, decollide: false, glow: false });
}
