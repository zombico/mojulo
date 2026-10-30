/**
 * THE GEOCITY, BUILT — the geocube kind's `show: 'geocity'`: a metro's map (design.js) stood on the cube's own land at its
 * hour, as massing: every block's buildings by its segment, every street keeping the land's grade, under a face budget.
 * The whole metro at once (a skyline seen from its water, a street walked from its seat); a neighbourhood at a building's
 * detail is an evocation's (later).
 *
 *   water      a plane along each shore, under the land's lowest, out to the horizon
 *   streets    the arterials (a road between two walks, a kerb over it, an east-west one over a crossing), each
 *              neighbourhood's ground under its blocks on the streets' ground (its collectors and locals), a walk round
 *              every block, all draped on the land in cells along them
 *   blocks     each a PAD in TERRACES along its long side, each terrace level over the walk at its highest corner, a
 *              retaining face where it stands over its walk or the terrace below it; a park's pad its lawn, the city
 *              park the land as it lies
 *   buildings  by segment, on their terrace: a tower block's podium and its towers, a podium block, a square's lawn and
 *              kiosk, a mid-rise ring round its court, a slab on its lawn; in the outskirts semi pairs under gables to
 *              the street in two rows back to back, an edge's or a main street's shops along its street, low-rises, a
 *              walk-up, a school and its field. Glass in the core, stone and brick outward (its grammar's skins)
 *   night      past dusk each tall wall's floors lit in runs (the grammar's share), panes no light shades: the room's own
 *
 *   GEOCITY_KEYS              the settings of the geocube kind's geocity
 *   GEOCITY_FACES             the face budget a geocity is held to (a law, advice)
 *   assembleGeocityScene(m, ctx) → the payload: faces, cameras, sky and haze, the walk and a route round the block
 *                                  nearest the seat (the dummy's), and `geocity`: the metro, its counts, its ledger, its
 *                                  laws, its neighbourhoods and its region graph (a Quest Open World's)
 *
 * Metres, the design's frame (x east, y north, z up). Pure; seeded dice only.
 */
import { designGeocity } from './design.js';
import { readGeocube, geocubeReadout } from '../era/geocube.js';
import { readPaint, cubeLookSpec, lookLight, hourSky, CITY_HAZE } from '../city/plan/look.js';
import { shadeHex, hexToRgb, rgbToHex } from '../polygonizer/vexar.js';
import { streamOf, strHash } from '../city/plan/dice.js';
import { CITY_METERS_PER_UNIT } from '../city/fractal-city.js';

export const GEOCITY_KEYS = Object.freeze(['kind', 'cube', 'show', 'title', 'seed', 'hour', 'clouds', 'geocity', 'walk', 'shadows', 'occlusion', 'light']);
export const GEOCITY_FACES = 200000;
// the cells streets and grounds are draped on the land in (m), a kerb's height, a sidewalk round a block, a terrace's
// most step to the next
const CELL = 40, KERB = 0.15, WALK = 2.4, STEP = 1.2;
// an outskirts house: a semi pair's frontage, the gap between pairs, its depth, its front yard; a storey; a shop's depth
const PAIR = 13.6, GAP = 1.4, HOUSE_D = 12, SETBACK = 5, STOREY = 3, SHOP_D = 14;

const r5 = (v) => Math.round(v * 1e5) / 1e5 + 0;
const P3 = (p) => p.map(r5);
const newell = (c) => { const n = [0, 0, 0]; for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); } const l = Math.hypot(...n) || 1; return n.map((v) => v / l); };
const mix = (a, b, t) => rgbToHex(hexToRgb(a).map((v, i) => v + (hexToRgb(b)[i] - v) * t));
const no = (msg) => { throw new Error(`geocube: ${msg}`); };
/** Cut [a, b] into pieces no longer than `step`, at least one. */
const cuts = (a, b, step) => { const n = Math.max(1, Math.ceil((b - a) / step - 1e-9)); return Array.from({ length: n + 1 }, (_, k) => a + ((b - a) * k) / n); };

// the outskirts' palettes: brick and its trim, a shop's front, a roof
const HOUSE_BRICK = Object.freeze(['#a3563f', '#b5654a', '#9c4b36', '#c9a57a', '#d2c3a8', '#8c5a44']);
const SHOP_FRONT = Object.freeze(['#8a3a2e', '#3e5e3a', '#24405e', '#6e5a3a', '#7a2e4a']);
const ROOFS = Object.freeze(['#4a4f55', '#5b4a3f', '#3f4448', '#6a5a4c']);

function coloursOf(cube) {
  const C = cube.colour;
  return {
    road: mix('#4d5055', C.floor, 0.15), walk: mix('#c8c2b4', C.stone, 0.3), kerb: mix('#b3ad9f', C.stone, 0.3), retain: mix('#9a9284', C.stone, 0.5),
    lawn: C.grass, park: mix(C.grass, C.foliage, 0.12), plaza: mix('#bdb6a8', C.stone, 0.3), lot: mix('#6a6c70', C.floor, 0.1), field: mix(C.grass, '#3f8a34', 0.4),
    water: mix('#3e6a84', C.sky ?? '#6f97b8', 0.25), court: mix(C.grass, C.foliage, 0.25),
  };
}

export function assembleGeocityScene(m, ctx = {}) {
  for (const k of Object.keys(m)) if (!GEOCITY_KEYS.includes(k)) no(`'${k}' is not a setting of the geocube kind's geocity (cube, seed, hour, clouds, geocity)`);
  if (m.seed !== undefined && !Number.isInteger(m.seed)) no('seed is an integer');
  if (m.cube === undefined || m.cube === null) no('cube is a preset id or a document');
  const cube = readGeocube(m.cube), seed = m.seed ?? 1, d = designGeocity(m.geocity ?? {}, { seed }), G = d.grammar, S = d.land.S;
  // ── the light: the cube's at its hour, under its clouds (city/plan/look.js: as it lights a city) ──
  const paint = readPaint({ geocube: m.cube, amount: 1, ...(m.hour !== undefined ? { hour: m.hour } : {}), ...(m.clouds !== undefined ? { clouds: m.clouds } : {}) });
  const spec = cubeLookSpec(paint), lit = lookLight(spec, paint), LIGHT = lit.light, sun = LIGHT.toLight, air = spec.air ?? spec.ref.air, night = lit.night;
  const col = coloursOf(cube), faces = [], counts = { towers: 0, buildings: 0, houses: 0, panes: 0 };
  const put = (corners, group, hex, want = null) => {
    let c = corners, n = newell(c);
    if (want && n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0) { c = c.slice().reverse(); n = n.map((x) => -x); }
    if (!want && n[2] < 0) { c = c.slice().reverse(); n = n.map((x) => -x); }
    const fill = shadeHex(hex, n, LIGHT);
    faces.push({ corners: c.map(P3), normal: P3(n), outNormal: P3(n), group, fill, cornerFills: c.map(() => fill) });
  };
  // a pane no light shades (a lit room at night)
  const pane = (corners, n, hex) => { faces.push({ corners: corners.map(P3), normal: P3(n), outNormal: P3(n), group: 'geocity:night-window', fill: hex, cornerFills: corners.map(() => hex) }); counts.panes++; };
  // a rect draped on the land at `lift` over it, in cells
  const drape = (r, group, hex, lift = 0) => {
    const xs = cuts(r[0], r[2], CELL), ys = cuts(r[1], r[3], CELL);
    for (let j = 0; j + 1 < ys.length; j++) for (let i = 0; i + 1 < xs.length; i++) put([[xs[i], ys[j]], [xs[i + 1], ys[j]], [xs[i + 1], ys[j + 1]], [xs[i], ys[j + 1]]].map(([x, y]) => [x, y, S(x, y) + lift]), group, hex);
  };
  const box = (x0, y0, x1, y1, z0, z1, wall, roof, group) => {
    put([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], `${group}:roof`, roof);
    put([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], group, wall, [0, -1, 0]);
    put([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], group, wall, [1, 0, 0]);
    put([[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]], group, wall, [0, 1, 0]);
    put([[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], group, wall, [-1, 0, 0]);
    counts.buildings++;
  };
  // a mass under a gable, its ridge along `axis` ('x' or 'y')
  const gable = (x0, y0, x1, y1, z0, ze, zr, axis, wall, roof, group) => {
    if (axis === 'y') {
      const xm = (x0 + x1) / 2;
      put([[x0, y0, z0], [x0, y1, z0], [x0, y1, ze], [x0, y0, ze]], group, wall, [-1, 0, 0]); put([[x1, y0, z0], [x1, y1, z0], [x1, y1, ze], [x1, y0, ze]], group, wall, [1, 0, 0]);
      put([[x0, y0, z0], [x1, y0, z0], [x1, y0, ze], [x0, y0, ze]], group, wall, [0, -1, 0]); put([[x0, y0, ze], [x1, y0, ze], [xm, y0, zr]], group, wall, [0, -1, 0]);
      put([[x0, y1, z0], [x1, y1, z0], [x1, y1, ze], [x0, y1, ze]], group, wall, [0, 1, 0]); put([[x0, y1, ze], [x1, y1, ze], [xm, y1, zr]], group, wall, [0, 1, 0]);
      put([[x0, y0, ze], [x0, y1, ze], [xm, y1, zr], [xm, y0, zr]], `${group}:roof`, roof); put([[x1, y0, ze], [x1, y1, ze], [xm, y1, zr], [xm, y0, zr]], `${group}:roof`, roof);
    } else {
      const ym = (y0 + y1) / 2;
      put([[x0, y0, z0], [x1, y0, z0], [x1, y0, ze], [x0, y0, ze]], group, wall, [0, -1, 0]); put([[x0, y1, z0], [x1, y1, z0], [x1, y1, ze], [x0, y1, ze]], group, wall, [0, 1, 0]);
      put([[x0, y0, z0], [x0, y1, z0], [x0, y1, ze], [x0, y0, ze]], group, wall, [-1, 0, 0]); put([[x0, y0, ze], [x0, y1, ze], [x0, ym, zr]], group, wall, [-1, 0, 0]);
      put([[x1, y0, z0], [x1, y1, z0], [x1, y1, ze], [x1, y0, ze]], group, wall, [1, 0, 0]); put([[x1, y0, ze], [x1, y1, ze], [x1, ym, zr]], group, wall, [1, 0, 0]);
      put([[x0, y0, ze], [x1, y0, ze], [x1, ym, zr], [x0, ym, zr]], `${group}:roof`, roof); put([[x0, y1, ze], [x1, y1, ze], [x1, ym, zr], [x0, ym, zr]], `${group}:roof`, roof);
    }
    counts.buildings++;
  };
  // at night a tall box's walls lit in runs along its floors: each floor's run its own length and place (the block's dice)
  const lights = (x0, y0, x1, y1, z0, z1, floorH, R) => {
    if (!night || z1 - z0 < 3 * floorH) return;
    const share = G.night.windows, P = G.night.palette;
    const walls = [[[x0, y0], [x1, y0], [0, -1, 0]], [[x1, y0], [x1, y1], [1, 0, 0]], [[x1, y1], [x0, y1], [0, 1, 0]], [[x0, y1], [x0, y0], [-1, 0, 0]]];
    for (const [a, b, n] of walls) {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let z = z0 + floorH; z + floorH <= z1 + 1e-6; z += floorH) {
        if (R() > share) continue;
        const t0 = R() * 0.7, t1 = Math.min(1, t0 + 0.15 + R() * 0.45), at = (t) => [a[0] + (b[0] - a[0]) * t + n[0] * 0.05, a[1] + (b[1] - a[1]) * t + n[1] * 0.05];
        if (L * (t1 - t0) < 2) continue;
        const p = at(t0), q = at(t1), lo = z + floorH * 0.28, hi = z + floorH * 0.82;
        pane([[p[0], p[1], lo], [q[0], q[1], lo], [q[0], q[1], hi], [p[0], p[1], hi]], n, P[Math.floor(R() * P.length)]);
      }
    }
  };

  // ── the water: a plane along each shore, under the land's lowest ──
  // (each band carried out past the map to the horizon, so a shore looks out over open water and an island stands in it)
  const zWater = d.land.range[0] - 1.2, X = Math.max(d.frame.W, d.frame.D) * 2, [wx0, wy0, wx1, wy1] = d.land.rect;
  const sea = { s: [-X, -X, d.frame.W + X, wy0], n: [-X, wy1, d.frame.W + X, d.frame.D + X], w: [-X, wy0, wx0, wy1], e: [wx1, wy0, d.frame.W + X, wy1] };
  for (const w of d.water) { const q = sea[w.side]; put([[q[0], q[1], zWater], [q[2], q[1], zWater], [q[2], q[3], zWater], [q[0], q[3], zWater]], 'geocity:water', col.water); }

  // ── the arterials: a road between two walks; a north-south one between the east-west ones' rights-of-way ──
  const sec = d.section, NS = d.lines.filter((l) => l.axis === 'ns'), EW = d.lines.filter((l) => l.axis === 'ew'), [lx0, ly0, lx1, ly1] = d.land.rect;
  const ewSpans = EW.map((l) => [l.at - sec.half, l.at + sec.half]).sort((a, b) => a[0] - b[0]);
  const runsNS = []; let y = ly0;
  for (const [a, b] of ewSpans) { if (a > y) runsNS.push([y, a]); y = Math.max(y, b); }
  if (ly1 > y) runsNS.push([y, ly1]);
  const R2 = sec.road / 2;
  for (const l of NS) for (const [a, b] of runsNS) {
    drape([l.at - R2, a, l.at + R2, b], 'geocity:road', col.road);
    drape([l.at - sec.half, a, l.at - R2, b], 'geocity:walk', col.walk, KERB); drape([l.at + R2, a, l.at + sec.half, b], 'geocity:walk', col.walk, KERB);
  }
  for (const l of EW) {
    drape([lx0, l.at - R2, lx1, l.at + R2], 'geocity:road', col.road);
    drape([lx0, l.at - sec.half, lx1, l.at - R2], 'geocity:walk', col.walk, KERB); drape([lx0, l.at + R2, lx1, l.at + sec.half], 'geocity:walk', col.walk, KERB);
  }

  // ── each neighbourhood: its ground (its streets), a walk round each block, each block's terraced pad and buildings ──
  const glass = G.skin.glass, stone = G.skin.stone, brick = G.skin.brick, roofs = G.skin.roof, office = G.floorH.office, resid = G.floorH.residential;
  const famOf = (fams, id) => fams[strHash(id) % fams.length];
  let firstBlock = null;
  for (const r of d.regions) {
    if (r.park) { drape(r.rect, 'geocity:park', col.park); continue; }
    drape(r.rect, 'geocity:road', col.road);
    for (const b of r.blocks) {
      const [x0, y0, x1, y1] = b.rect, Rb = streamOf(seed, 'scene', b.id), longY = y1 - y0 >= x1 - x0;
      // the walk round it (into the street, at a kerb over it), where the street is the neighbourhood's
      const wk = (s) => b.kind === 'park' || b.sides?.[s]?.kind === 'street';
      if (wk('s')) drape([x0 - (wk('w') ? WALK : 0), y0 - WALK, x1 + (wk('e') ? WALK : 0), y0], 'geocity:walk', col.walk, KERB);
      if (wk('n')) drape([x0 - (wk('w') ? WALK : 0), y1, x1 + (wk('e') ? WALK : 0), y1 + WALK], 'geocity:walk', col.walk, KERB);
      if (wk('w')) drape([x0 - WALK, y0, x0, y1], 'geocity:walk', col.walk, KERB);
      if (wk('e')) drape([x1, y0, x1 + WALK, y1], 'geocity:walk', col.walk, KERB);
      // the pad in terraces along its long side, each level over the walk at its highest corner
      const span = longY ? [y0, y1] : [x0, x1];
      const piece = (a, c) => (longY ? [x0, a, x1, c] : [a, y0, c, y1]);
      let ts = [span];
      const fall = (q) => Math.max(...[[q[0], q[1]], [q[2], q[1]], [q[2], q[3]], [q[0], q[3]]].map(([x, yy]) => S(x, yy))) - Math.min(...[[q[0], q[1]], [q[2], q[1]], [q[2], q[3]], [q[0], q[3]]].map(([x, yy]) => S(x, yy)));
      const n = Math.max(1, Math.min(8, Math.ceil(fall(b.rect) / STEP)));
      ts = cuts(span[0], span[1], (span[1] - span[0]) / n).slice(0, -1).map((a, k, arr) => [a, k + 1 < arr.length ? arr[k + 1] : span[1]]);
      const terraces = ts.map(([a, c]) => { const q = piece(a, c); return { q, z: Math.max(...[[q[0], q[1]], [q[2], q[1]], [q[2], q[3]], [q[0], q[3]]].map(([x, yy]) => S(x, yy))) + KERB }; });
      const zAt = (x, yy) => { const t = terraces.find((tt) => (longY ? yy <= tt.q[3] + 1e-6 : x <= tt.q[2] + 1e-6)) ?? terraces[terraces.length - 1]; return t.z; };
      const padHex = b.kind === 'park' ? col.park : ['tower', 'podium', 'square', 'midrise'].includes(b.kind) ? col.plaza : col.lawn;
      terraces.forEach((t, k) => {
        const [a0, b0, a1, b1] = t.q;
        put([[a0, b0, t.z], [a1, b0, t.z], [a1, b1, t.z], [a0, b1, t.z]], `geocity:pad`, padHex);
        // its retaining faces: down to the walk on its street sides, down to the terrace below between them
        const edges = [[[a0, b0], [a1, b0], [0, -1, 0], 's'], [[a1, b0], [a1, b1], [1, 0, 0], 'e'], [[a1, b1], [a0, b1], [0, 1, 0], 'n'], [[a0, b1], [a0, b0], [-1, 0, 0], 'w']];
        for (const [p, q, nn, s] of edges) {
          const inner = longY ? (s === 's' && k > 0) || (s === 'n' && k + 1 < terraces.length) : (s === 'w' && k > 0) || (s === 'e' && k + 1 < terraces.length);
          const below = inner ? terraces[k + ((s === 's' || s === 'w') ? -1 : 1)].z : null;
          if (inner && below >= t.z - 1e-6) continue;
          const zb = (pt) => (inner ? below : S(pt[0], pt[1]) + KERB);
          if (t.z - Math.max(zb(p), zb(q)) < 0.02 && t.z - Math.min(zb(p), zb(q)) < 0.02) continue;
          put([[p[0], p[1], zb(p)], [q[0], q[1], zb(q)], [q[0], q[1], t.z], [p[0], p[1], t.z]], 'geocity:retain', col.retain, nn);
        }
      });
      if (b.kind === 'park') continue;
      if (!firstBlock || Math.hypot((x0 + x1) / 2 - d.seat[0], (y0 + y1) / 2 - d.seat[1]) < Math.hypot((firstBlock.rect[0] + firstBlock.rect[2]) / 2 - d.seat[0], (firstBlock.rect[1] + firstBlock.rect[3]) / 2 - d.seat[1])) firstBlock = b;
      building(b, { x0, y0, x1, y1, longY, zAt, Rb });
    }
  }

  /** A block's buildings, by its segment, on its terraces. */
  function building(b, { x0, y0, x1, y1, longY, zAt, Rb }) {
    const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, med = b.storeys.median;
    const inset = (share) => { const e = ((w + h) - Math.sqrt((w + h) ** 2 - 4 * w * h * (1 - share))) / 4; return [x0 + e, y0 + e, x1 - e, y1 - e]; };
    const zc = zAt(cx, cy);
    if (b.kind === 'tower') {
      const [g, frame] = famOf(glass, b.id), pod = inset(0.62), zp = zc + b.podium * office, [, ston] = famOf(stone, b.id);
      box(pod[0], pod[1], pod[2], pod[3], zc, zp, ston, roofs[strHash(b.id) % roofs.length], 'geocity:podium');
      lights(pod[0], pod[1], pod[2], pod[3], zc, zp, office, Rb);
      for (const t of b.towers) {
        const [a0, b0, a1, b1] = t.rect, z0 = zAt((a0 + a1) / 2, (b0 + b1) / 2), z1 = z0 + t.storeys * office;
        box(a0, b0, a1, b1, z0, z1, Rb() < G.skin.towerGlass ? g : frame, frame, 'geocity:tower');
        lights(a0, b0, a1, b1, z0, z1, office, Rb);
        counts.towers++;
      }
    } else if (b.kind === 'podium') {
      const q = inset(0.8), [, ston] = famOf(stone, b.id), z1 = zc + med * office;
      box(q[0], q[1], q[2], q[3], zc, z1, ston, roofs[strHash(b.id) % roofs.length], 'geocity:podium');
      lights(q[0], q[1], q[2], q[3], zc, z1, office, Rb);
    } else if (b.kind === 'square') {
      const e = Math.min(w, h) * 0.18;
      put([[x0 + e, y0 + e, zc + 0.02], [x1 - e, y0 + e, zc + 0.02], [x1 - e, y1 - e, zc + 0.02], [x0 + e, y1 - e, zc + 0.02]], 'geocity:planting', col.court);
      box(cx - 4, cy - 4, cx + 4, cy + 4, zc, zc + 4, col.plaza, roofs[0], 'geocity:kiosk');
    } else if (b.kind === 'midrise') {
      const dp = Math.min(14, w / 3, h / 3), [, br] = famOf(brick, b.id), roof = roofs[strHash(b.id) % roofs.length], z1 = zc + med * resid;
      put([[x0 + dp, y0 + dp, zc + 0.02], [x1 - dp, y0 + dp, zc + 0.02], [x1 - dp, y1 - dp, zc + 0.02], [x0 + dp, y1 - dp, zc + 0.02]], 'geocity:court', col.court);
      for (const q of [[x0, y0, x1, y0 + dp], [x0, y1 - dp, x1, y1], [x0, y0 + dp, x0 + dp, y1 - dp], [x1 - dp, y0 + dp, x1, y1 - dp]]) {
        box(q[0], q[1], q[2], q[3], zc, z1, br, roof, 'geocity:midrise');
        lights(q[0], q[1], q[2], q[3], zc, z1, resid, Rb);
      }
    } else if (b.kind === 'slab') {
      const long = Math.max(w, h) * 0.72, dp = Math.min(15, Math.min(w, h) * 0.35), [, ston] = famOf(stone, b.id), z1 = zc + med * resid;
      const q = longY ? [cx - dp / 2, cy - long / 2, cx + dp / 2, cy + long / 2] : [cx - long / 2, cy - dp / 2, cx + long / 2, cy + dp / 2];
      const lot = longY ? [x0 + 3, y0 + 3, x0 + Math.min(w * 0.3, 26), y1 - 3] : [x0 + 3, y0 + 3, x1 - 3, y0 + Math.min(h * 0.3, 26)];
      put([[lot[0], lot[1], zAt(cx, cy) + 0.02], [lot[2], lot[1], zAt(cx, cy) + 0.02], [lot[2], lot[3], zAt(cx, cy) + 0.02], [lot[0], lot[3], zAt(cx, cy) + 0.02]], 'geocity:lot', col.lot);
      box(q[0], q[1], q[2], q[3], zc, z1, ston, roofs[strHash(b.id) % roofs.length], 'geocity:slab');
      lights(q[0], q[1], q[2], q[3], zc, z1, resid, Rb);
    } else outskirts(b, { x0, y0, x1, y1, longY, zAt, Rb });
  }

  /** An outskirts block: two rows along its long sides, each the row its segment puts on that side. */
  function outskirts(b, { x0, y0, x1, y1, longY, zAt, Rb }) {
    const sides = longY ? ['w', 'e'] : ['s', 'n'], med = Math.max(1, Math.round(b.storeys.median)), brickOf = () => HOUSE_BRICK[Math.floor(Rb() * HOUSE_BRICK.length)];
    const along = longY ? [y0, y1] : [x0, x1], deep = longY ? x1 - x0 : y1 - y0;
    // a row's frame: `u` along the block from its start, `v` into it from its side's edge
    const at = (s, u, v) => (s === 'w' ? [x0 + v, along[0] + u] : s === 'e' ? [x1 - v, along[0] + u] : s === 's' ? [along[0] + u, y0 + v] : [along[0] + u, y1 - v]);
    const rectOf = (s, u0, u1, v0, v1) => { const p = at(s, u0, v0), q = at(s, u1, v1); return [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1])]; };
    const L = along[1] - along[0];
    const houses = (s, u0, u1) => {
      const len = u1 - u0, n = Math.max(1, Math.floor((len + GAP) / (PAIR + GAP))), f = (len - (n - 1) * GAP) / n, dpt = Math.min(HOUSE_D, deep / 2 - SETBACK - 4);
      if (dpt < 6) return;
      for (let k = 0; k < n; k++) {
        const u = u0 + k * (f + GAP), q = rectOf(s, u, u + f, SETBACK, SETBACK + dpt), z0 = zAt((q[0] + q[2]) / 2, (q[1] + q[3]) / 2);
        const st = Math.max(1, Math.min(b.storeys.rail[1], med + (Rb() < 0.3 ? 1 : 0) - (Rb() < 0.2 ? 1 : 0))), ze = z0 + st * STOREY, zr = ze + Math.min(4.5, 0.32 * f);
        // the gable to the street: its ridge runs into the block
        gable(q[0], q[1], q[2], q[3], z0, ze, zr, longY ? 'x' : 'y', brickOf(), ROOFS[Math.floor(Rb() * ROOFS.length)], 'geocity:house');
        counts.houses += 2;
      }
    };
    const shops = (s, storeys, group) => {
      const n = Math.max(1, Math.round(L / 30)), f = L / n;
      for (let k = 0; k < n; k++) {
        const q = rectOf(s, k * f + 0.4, (k + 1) * f - 0.4, 0, Math.min(SHOP_D, deep / 2 - 2)), z0 = zAt((q[0] + q[2]) / 2, (q[1] + q[3]) / 2);
        box(q[0], q[1], q[2], q[3], z0, z0 + (storeys + (Rb() < 0.3 ? 1 : 0)) * STOREY + 0.6, SHOP_FRONT[Math.floor(Rb() * SHOP_FRONT.length)], ROOFS[2], group);
      }
    };
    const onLong = (rank) => sides.find((s) => (rank === 'arterial' ? b.sides[s].kind === 'arterial' : b.sides[s].rank === rank));
    if (b.kind === 'edge' || b.kind === 'main-street') {
      const s = onLong(b.kind === 'edge' ? 'arterial' : 'collector') ?? sides[0], other = sides.find((x) => x !== s);
      shops(s, b.kind === 'edge' ? 2 : 3, b.kind === 'edge' ? 'geocity:avenue' : 'geocity:shops');
      houses(other, 2, L - 2);
    } else if (b.kind === 'lowrise') {
      const n = Math.max(1, Math.floor(L / 40));
      for (let k = 0; k < n; k++) {
        const u = (k + 0.5) * (L / n), q = rectOf(sides[0], u - 14, u + 14, deep / 2 - 7.5, deep / 2 + 7.5), z0 = zAt((q[0] + q[2]) / 2, (q[1] + q[3]) / 2), z1 = z0 + 4 * STOREY;
        box(q[0], q[1], q[2], q[3], z0, z1, famOf(brick, `${b.id}:${k}`)[0], ROOFS[2], 'geocity:lowrise');
        lights(q[0], q[1], q[2], q[3], z0, z1, STOREY, Rb);
      }
    } else if (b.kind === 'apartments') {
      const q = rectOf(sides[0], 4, 34, 6, 20), z0 = zAt((q[0] + q[2]) / 2, (q[1] + q[3]) / 2);
      box(q[0], q[1], q[2], q[3], z0, z0 + 4 * STOREY, famOf(brick, b.id)[0], ROOFS[2], 'geocity:walkup');
      houses(sides[0], 40, L - 2); houses(sides[1], 2, L - 2);
    } else if (b.kind === 'school') {
      const q = rectOf(sides[0], L / 2 - 30, L / 2 + 30, 6, 22), z0 = zAt((q[0] + q[2]) / 2, (q[1] + q[3]) / 2);
      box(q[0], q[1], q[2], q[3], z0, z0 + 3 * 4, '#9a4f3c', ROOFS[2], 'geocity:school');
      const fq = rectOf(sides[1], L * 0.15, L * 0.85, 6, Math.max(8, deep / 2 - 4));
      put([[fq[0], fq[1], zAt(fq[0], fq[1]) + 0.03], [fq[2], fq[1], zAt(fq[0], fq[1]) + 0.03], [fq[2], fq[3], zAt(fq[0], fq[1]) + 0.03], [fq[0], fq[3], zAt(fq[0], fq[1]) + 0.03]], 'geocity:field', col.field);
    } else { houses(sides[0], 2, L - 2); houses(sides[1], 2, L - 2); }
  }

  // ── the cameras: the skyline from its water (or from past its land's edge), over the metro, the core, up its spine ──
  const [sx, sy] = d.seat, zs = S(sx, sy), toward = d.metro.fall.toward, out = { s: [0, -1], n: [0, 1], w: [-1, 0], e: [1, 0] }[toward];
  const top = Math.max(60, ...d.regions.flatMap((r) => r.blocks.flatMap((b) => (b.towers ?? []).map((t) => t.storeys * office))));
  const W = d.frame.W, D = d.frame.D, far = Math.max(W, D);
  const spine = NS.find((l) => l.rank === 'spine'), up = toward === 's' ? 1 : -1, ex = spine.at + sec.half - sec.walk / 2;
  const eye = [ex, sy + up * (sec.half + 30), 0];
  eye[2] = S(eye[0], eye[1]) + KERB + 1.7;
  const cameras = [
    { name: 'skyline', worldFraming: { cameraPosition: P3([sx + out[0] * far * 0.42 + out[1] * 120, sy + out[1] * far * 0.42 + out[0] * 120, zs + 40]), lookAt: P3([sx, sy, zs + top * 0.35]), horizontalFov: 55 } },
    { name: 'over', worldFraming: { cameraPosition: P3([W * 1.05, -D * 0.25, far * 0.55]), lookAt: P3([W / 2, D / 2, 0]), horizontalFov: 55 } },
    { name: 'core', worldFraming: { cameraPosition: P3([sx + 520, sy + out[1] * 380 + 260, zs + 260]), lookAt: P3([sx, sy, zs + 40]), horizontalFov: 55 } },
    { name: 'street', worldFraming: { cameraPosition: P3(eye), lookAt: P3([ex, eye[1] + up * 120, eye[2] + 8]), horizontalFov: 75 } },
  ];
  // ── the route round the block nearest the seat (the dummy's), on its walk ──
  const fb = firstBlock?.rect ?? [sx + 20, sy + 20, sx + 60, sy + 60], o = WALK / 2;
  const ring = [[fb[0] - o, fb[1] - o], [fb[2] + o, fb[1] - o], [fb[2] + o, fb[3] + o], [fb[0] - o, fb[3] + o]], route = [];
  for (let k = 0; k < 4; k++) { const p = ring[k], q = ring[(k + 1) % 4], nn = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 2)); for (let i = 0; i < nn; i++) { const x = p[0] + ((q[0] - p[0]) * i) / nn, yy = p[1] + ((q[1] - p[1]) * i) / nn; route.push(P3([x, yy, S(x, yy) + KERB])); } }
  route.push(route[0]);

  // ── the laws the scene adds: the faces' budget ──
  const laws = [...d.laws, { law: 'faces', ok: faces.length <= GEOCITY_FACES, value: `${faces.length} faces (budget ${GEOCITY_FACES})${night ? `, ${counts.panes} lit panes` : ''}`, want: 'the metro as massing' }];
  const bg = night ? air.fog.color : rgbToHex(air.dome.horizon);
  const kinds = d.regions.flatMap((r) => r.blocks).reduce((acc, b) => ({ ...acc, [b.kind]: (acc[b.kind] ?? 0) + 1 }), {});
  return {
    faces, cameras, viewBox: { width: 1280, height: 720 }, title: ctx.title || `${cube.title} · geocity`,
    // (the city's haze is laid per its world unit, city/plan/scene.js; this world's unit is the metre)
    bg, haze: { color: air.fog.color, density: r5((air.fog.density * CITY_HAZE) / CITY_METERS_PER_UNIT) },
    sky: { zenith: air.dome.zenith, horizon: air.dome.horizon, day: night ? 0 : 1, stars: 0, seed: 1, ...(night ? {} : { sun: { dir: P3(sun), size: 1.4, glow: 1.3 } }), ...(spec.air ? hourSky(spec.air) : {}) },
    walk: m.walk === false ? false : { speed: 6, spawn: P3(eye), minEye: 1.7, gravity: 22, radius: 0.4 },
    route,
    geocube: geocubeReadout(cube, 'geocity', null, m),
    geocity: {
      metro: d.metro.id, grammar: G.label, frame: d.frame, land: d.land.range, seat: d.seat,
      counts: { neighbourhoods: d.regions.length, blocks: Object.values(kinds).reduce((a, n) => a + n, 0), segments: kinds, ...counts, faces: faces.length },
      neighbourhoods: d.regions.map((r) => ({ id: r.id, ring: r.ring, builds: r.builds, storeys: r.storeys.median, blocks: r.blocks.length, park: r.park || !!r.parkRect, ...(r.node ? { node: r.node } : {}), ...(r.beyond.length ? { beyond: r.beyond } : {}) })),
      graph: { nodes: d.graph.nodes.length, edges: d.graph.edges.length, beyond: d.graph.beyond },
      ledger: d.ledger, laws: laws.map((l) => ({ law: l.law, ok: l.ok, value: l.value })),
    },
  };
}
