/**
 * THE GEOTOWN, BUILT — the geocube kind's `show: 'geotown'`: a neighbourhood's map (design.js) stood on the cube's own
 * land at its hour, LEVELLED: its streets draped on the land's smoothed ground (they keep its grade), each plot a level
 * pad over the walk at its front. Only what the map needs is drawn, each surface once:
 *
 *   streets   each piece of the right-of-way in cells along it (cut where the plots beside it are cut, so the walk and
 *             the front yards meet at the same points): the road on the streets' ground, the verge and the walk a kerb
 *             over it, a kerb's face along every road edge a walk or a verge stands on
 *   plots     the front yard a bank from the walk up (or down) to the pad, the path through it and its steps set in the
 *             bank, the pad one level quad behind (the side yards, the house's ground, the back yard), a hedge along a
 *             share of the front lines; where two pads meet at different heights a retaining face between them (along a
 *             row, at a corner's flank over its cross street, and where a block's two rows meet at their back line). The
 *             land under the town is never drawn
 *   buildings each built plot's building spoken in its style's language (era/out-anchor-structure.js `speak`) on its
 *             envelope, standing on its pad: in an evocation each house a type of its pattern's, each shop its own brick,
 *             sign and awning, a walk-up its own (houses.js), each wearing its front (fronts.js: a bay and a porch, a
 *             shopfront, a canopy) and its material words as tiles; a semi pair one design mirrored about its party
 *             wall; painted from the kit's structure ramps and lit by the cube's sun, as a stage's town is
 *   yards     an evocation's back yards each their own plan (a feature a zone, a balcony over some) behind their own fences, a shop's service yard and a
 *             walk-up's lot (yards.js)
 *   finishes  the ground's surfaces laid in the pattern's material words as tiles (`finishes`: the road's asphalt, the
 *             walk's scored concrete, the paths' brick, the kerb's stone)
 *   parks     the land as it lies, eased to the walks round it, its paths across it
 *   margin    the town's border only: the land just round it, eased from the outer walks to the natural ground, bare
 *   green     trees only on the surfaces that grow them (pattern.js SURFACES) and only inside the town: the streets'
 *             trees on the verges (and in a main street's pits) that face a block, a yard's, a park's; grown variants
 *             stamped as repeats, each at the detail the cameras see it at (vegetation/pool.js)
 *
 *   GEOTOWN_KEYS                 the settings of the geocube kind's geotown
 *   GEOTOWN_FACES                the face budget a geotown is held to (a law, advice)
 *   assembleGeotownScene(m, ctx) → the payload: faces, repeats, colliders, anchors, cameras, sky, the walk and a route
 *                                  round the first block (the dummy's), and `geotown`: the ledger, the laws, the counts,
 *                                  the segments, the ports (its perimeter streets: a geocity graph's joins)
 *
 * Metres, the design's frame (x east, y north, z up). Pure; seeded dice only.
 */
import { designGeotown } from './design.js';
import { SURFACES } from './pattern.js';
import { readGeocube, cubeBuildings, settlementStyle, CUBE_STREET_PAINT, geocubeReadout } from '../era/geocube.js';
import { readPaint, cubeLookSpec, lookLight, hourSky } from '../city/plan/look.js';
import { shadeHex, hexToRgb, rgbToHex } from '../polygonizer/vexar.js';
import { speak } from '../era/out-anchor-structure.js';
import { townLanguage } from '../era/out-town.js';
import { structureStyle, hasStructureRails } from '../era/out-structures.js';
import { structurePaint, paintStop } from '../era/out-structures-paint.js';
import { madeRamp } from '../era/style/swatches.js';
import { townDressOf, dressTownFace } from '../era/town-dress.js';
import { styleTownDress, styleReadout } from '../era/arch-style.js';
import { plantPool, plantRepeats } from '../vegetation/pool.js';
import { SPECIES } from '../vegetation/species.js';
import { streamOf } from '../city/plan/dice.js';
import { buildingKits } from './houses.js';
import { frontOf, FRONT } from './fronts.js';
import { yardOf, fenceOf, serviceOf, garageOf, balconyOf, carOf, CAR_PAINTS, ZONES } from './yards.js';
import { gatesOf } from './gates.js';
import { pitchOf, trackOf, diamondOf, courtsOf, hoopsOf, lotOf, fieldhouseOf, bleachersOf, lightsOf, flagOf, playgroundOf, pavilionOf, benchOf } from './sites.js';
import { backTouch } from './laws.js';
import { materialContext, wordTile } from '../era/arch-style.js';
import { WALK } from '../era/out-ikebana.js';

export const GEOTOWN_KEYS = Object.freeze(['kind', 'cube', 'show', 'title', 'seed', 'hour', 'clouds', 'style', 'geotown', 'walk', 'shadows', 'occlusion', 'light']);
// the faces a geotown draws at most (its trees are repeats, budgeted apart): a law, advice. The town to scale's is one
// budget; an evocation spends its own on each segment's buildings, so its budget is a segment's times its segments,
// or a building's times its buildings where a dense streetscape stands more
export const GEOTOWN_FACES = 60000, SEGMENT_FACES = 12000;   // (a main-street segment's shopfronts and its houses' zoned yards, 10.1k)
// (a denser streetscape puts more buildings in a segment: an evocation's budget at least this a building it stands)
export const BUILDING_FACES = 1200;
// the trees' faces, summed over their instances: each starts at its least detail and the trees the views see largest
// step up until this is spent (vegetation/pool.js plantRepeats); the views' thresholds held this much stricter
const TREE_FACES = 400000, TREE_EYE = 0.05;
// a street cell's longest side (m); the park's and the margin's lattice (m)
const CELL = 6, PARK_CELL = 6, MARGIN_CELL = 6;
// the seeds the ground's finishes are laid with, a surface each
const FINISH_SEEDS = { road: 151, walk: 141, furnish: 143, path: 145, side: 147, service: 149, 'park-path': 153, step: 155, kerb: 157, drive: 161 };
// a building's kit family: a mansion's its own
const familyOf = (pl) => (pl.form === 'mansion' ? 'mansions' : pl.kind);
/** A rect less some rects inside it, as rects (u0, v0, u1, v1). */
function lessRects(r, cuts) {
  let out = [r];
  for (const c of cuts) {
    const next = [];
    for (const q of out) {
      if (c[0] >= q[2] || c[2] <= q[0] || c[1] >= q[3] || c[3] <= q[1]) { next.push(q); continue; }
      if (c[1] > q[1]) next.push([q[0], q[1], q[2], c[1]]);
      if (c[3] < q[3]) next.push([q[0], c[3], q[2], q[3]]);
      const v0 = Math.max(q[1], c[1]), v1 = Math.min(q[3], c[3]);
      if (c[0] > q[0]) next.push([q[0], v0, c[0], v1]);
      if (c[2] < q[2]) next.push([c[2], v0, q[2], v1]);
    }
    out = next;
  }
  return out.filter((q) => q[2] - q[0] > 1e-3 && q[3] - q[1] > 1e-3);
}
// a step's rise at most (m), a bank lower than this takes no steps; a hedge's height and depth (m)
const STEP_RISE = 0.18, NO_STEPS = 0.25, HEDGE = { h: 0.85, d: 0.55, in: 0.25 };
// a town tree is at least twice a person's height (the geocube's walk, era/out-ikebana.js WALK.body), its crown's reach
// this far short of any building at the least
const TREE_LEAST = 2 * WALK.body, TREE_GAP = 0.6;
// the town's air: a share of the cube's, since a town is seen across hundreds of metres, not a trail's seventy
const TOWN_HAZE = 0.45;

const no = (msg) => { throw new Error(`geotown: ${msg}`); };
const r5 = (v) => Math.round(v * 1e5) / 1e5 + 0;
const P3 = (p) => p.map(r5);
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const newell = (c) => { const n = [0, 0, 0]; for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); } return unit(n); };
const mix = (a, b, t) => rgbToHex(hexToRgb(a).map((v, i) => v + (hexToRgb(b)[i] - v) * t));
const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
// a shed's paint, one a yard
const SHEDS = ['#6f7d63', '#8a5b4a', '#5e6f7d', '#b9ab8f', '#7d6a8a'];
/** A key by its weight (`{ key: weight }`), never `prev`. */
const pickWeighted = (R, table, prev = null) => {
  const keys = Object.keys(table).filter((k) => k !== prev && table[k] > 0), sum = keys.reduce((a, k) => a + table[k], 0);
  let t = R() * sum;
  for (const k of keys) { t -= table[k]; if (t <= 0) return k; }
  return keys[keys.length - 1];
};
const hexOf = (c) => (typeof c === 'string' ? c : `#${c.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')}`);

/** The breaks along [lo, hi]: its ends, every `extra` inside it, and no gap longer than `step`. */
function breaks(lo, hi, extra, step) {
  const s = [...new Set([lo, hi, ...extra.filter((v) => v > lo + 1e-6 && v < hi - 1e-6)].map((v) => Math.round(v * 1000) / 1000))].sort((a, b) => a - b), out = [s[0]];
  for (let i = 1; i < s.length; i++) { const g = s[i] - s[i - 1], n = Math.ceil(g / step - 1e-9); for (let k = 1; k < n; k++) out.push(s[i - 1] + (g * k) / n); out.push(s[i]); }
  return out;
}

/** The town's colours, leant to the cube's: its paving and its lawns. */
function coloursOf(cube) {
  const C = cube.colour;
  return {
    road: mix('#4d5055', C.floor, 0.15), walk: mix('#c8c2b4', C.stone, 0.3), kerb: mix('#b3ad9f', C.stone, 0.3), path: mix('#b7a68c', C.floor, 0.35),
    step: mix('#beb6a6', C.stone, 0.35), side: mix('#a59a86', C.floor, 0.3), 'park-path': mix('#c9b48f', C.sand ?? C.floor, 0.4), wall: mix('#9a9284', C.stone, 0.5),
    house: mix('#7a7266', C.stone, 0.3), lawn: C.grass, verge: C.grass, park: mix(C.grass, C.foliage, 0.12), margin: mix(C.grass, C.foliage, 0.3), hedge: C.foliage,
    // an evocation's yards and fronts
    glass: '#3b4654', timber: mix('#8b6b4c', C.floor, 0.25), deck: mix('#9a7a58', C.floor, 0.25), paving: mix('#b9b1a2', C.stone, 0.3), soil: '#5a4535',
    leaf: mix(C.foliage, C.grass, 0.25), sand: mix('#d8c69a', C.sand ?? C.floor, 0.3), shed: '#6f7d63', roof: '#4b4f55', door: '#3a3632', canvas: C.accent,
    metal: '#5c6166', gravel: '#9d978a', picket: '#ece7dc',
    // a mansion's drive, its garage, its pool's water and coping
    drive: mix('#8f8373', C.floor, 0.25), garage: mix('#ddd3c1', C.trim, 0.3), water: '#3f86a8', coping: '#d9d3c6',
    // a yard's things: a trampoline's mat, a grill, mulch round a tree, a compost bin, a balcony's rail
    mat: '#24262a', grill: '#2b2b2d', mulch: mix('#5b4232', C.floor, 0.2), compost: '#4f5a3c', rail: mix('#ece8de', C.trim, 0.2),
    // a gated front: its iron, its low wall's brick, its piers' stone
    lane: mix('#55585c', C.floor, 0.12), iron: '#24282c', brick: mix('#8f4c3a', C.stone, 0.15), pier: mix('#cfc6b4', C.stone, 0.3),
    // a site's ground and its things: lawn, turf and its mown stripes, the lines, a court, a track, a diamond's dirt, the
    // chips under a playground; goals, nets, fences, a field house's block walls, lamps, a flag, seats
    grounds: mix(C.grass, C.foliage, 0.08), field: mix('#4f8f3a', C.grass, 0.35), turf: mix('#4f8f3a', C.grass, 0.35), stripe: mix('#5e9e46', C.grass, 0.35), line: '#f2f0e8',
    court: '#3f6f5a', track: '#a5503a', infield: '#b08560', dirt: '#b08560', base: '#f4f2ec', play: '#8a6a4a', chips: '#8a6a4a', netting: '#3a3f44', fence: '#2f4a3a',
    goal: '#f2f0e8', net: '#2a2c2e', board: '#e8e6e0', lamp: '#d8d4c8', flag: '#c8322f', seat: '#7b8a96', block: mix('#c2b49a', C.stone, 0.25),
    // a main street's paving by its kerb, its trees' grates; a shop's yard and a walk-up's lot, its lines, its bins
    furnish: mix('#b39f88', C.floor, 0.25), pit: '#3b3a38', service: mix('#55585c', C.floor, 0.15), line: '#e8e4d8', bin: '#3f5a46', cabin: '#2b3036',
  };
}

/** The kit's structure paint, re-pointed to the cube's ramps (a stage's town street's, geocube.js CUBE_STREET_PAINT). */
function housePaint(kitId) {
  const has = (n) => { try { madeRamp(kitId, n); return true; } catch { return false; } };
  try {
    const P = structurePaint(kitId, { swatches: Object.fromEntries(Object.entries(CUBE_STREET_PAINT).filter(([, n]) => has(n))) });
    return (group, v) => hexOf(paintStop(P, group, v));
  } catch {
    const base = { 'str:plaster': [196, 186, 166], 'str:stone': [150, 146, 138], 'str:roof': [122, 72, 56] };
    return (group, v) => hexOf((base[group] ?? base['str:stone']).map((x) => x * (0.55 + 0.6 * v)));
  }
}

/** The ground's finishes: each surface's material word as its tile, a floor (the kerb's a wall). */
function finishesOf(P, cube) {
  const X = materialContext(cube), out = {};
  for (const [surface, word] of Object.entries(P.finishes ?? {})) {
    const T = wordTile(word, X, FINISH_SEEDS[surface] ?? 159);
    if (T) out[`geotown:${surface}`] = { spec: T.spec, metres: T.metres, ...(surface === 'kerb' ? {} : { floor: true }) };
  }
  return out;
}

/** A front fitted to its setback: a porch across the front where the yard holds it with half a metre to spare, else
 *  one at the door, else none (a stoop: the path's steps to the door); a bay on the ground storey only where it stands
 *  clear of the front line, else raised over the door (an oriel). */
export function fitFront(front, F) {
  const room = F - 0.5, out = { ...front };
  if (out.porch === 'full' && room < FRONT.porch.full) out.porch = 'door';
  if (out.porch === 'door' && room < FRONT.porch.door) delete out.porch;
  if (out.bay && out.bayStoreys !== 'upper' && room < FRONT.bay.proj + 0.3) out.bayStoreys = 'upper';
  return out;
}

/** The street a block's row fronts: its line's id and its section. */
const lineOf = (d, B, side) => (side === 'w' ? { id: `ns-${B.i}`, S: d.sections.x[B.i] } : side === 'e' ? { id: `ns-${B.i1 + 1}`, S: d.sections.x[B.i1 + 1] } : side === 's' ? { id: `ew-${B.j}`, S: d.sections.y[B.j] } : { id: `ew-${B.j1 + 1}`, S: d.sections.y[B.j1 + 1] });

/** The geocube kind's geotown: the town's map stood on the cube's land at its hour. */
export function assembleGeotownScene(m, ctx = {}) {
  for (const k of Object.keys(m)) if (!GEOTOWN_KEYS.includes(k)) no(`'${k}' is not a setting of the geocube kind's geotown (cube, seed, hour, clouds, style, geotown)`);
  if (m.seed !== undefined && !Number.isInteger(m.seed)) no('seed is an integer');
  if (m.cube === undefined || m.cube === null) no('cube is a preset id or a document');
  const cube = readGeocube(m.cube), seed = m.seed ?? 1, d = designGeotown(m.geotown ?? {}, { seed }), P = d.pattern, row = d.row;
  const { S, N } = d.land, wk = (x, y) => S(x, y) + row.kerb, [C, Rn] = d.spec.grid;
  // ── the light: the cube's at its hour, under its clouds (city/plan/look.js: as it lights a city) ──
  const paint = readPaint({ geocube: m.cube, amount: 1, ...(m.hour !== undefined ? { hour: m.hour } : {}), ...(m.clouds !== undefined ? { clouds: m.clouds } : {}) });
  const spec = cubeLookSpec(paint), lit = lookLight(spec, paint), LIGHT = lit.light, sun = LIGHT.toLight, air = spec.air ?? spec.ref.air;
  const col = coloursOf(cube), faces = [], colliders = [], anchors = [], finish = finishesOf(P, cube);
  // a face, wound to `want` (else up), shaded by the cube's light, its ground's finish laid where it has one (a floor's
  // on a face that lies flat)
  const put = (corners, group, hex, want = null) => {
    let c = corners, n = newell(c);
    if (want && n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0) { c = c.slice().reverse(); n = n.map((x) => -x); }
    if (!want && n[2] < 0) { c = c.slice().reverse(); n = n.map((x) => -x); }
    const fill = shadeHex(hex, n, LIGHT), F0 = { corners: c.map(P3), normal: P3(n), outNormal: P3(n), group, fill, cornerFills: c.map(() => fill) }, E = finish[group];
    faces.push(E && (E.floor ? Math.abs(n[2]) > 0.7 : Math.abs(n[2]) < 0.3) ? dressTownFace(F0, group, finish) : F0);
  };
  // ── the streets ──
  const plotYs = d.plots.flatMap((pl) => [pl.rect[1], pl.rect[3], pl.A[1] + pl.ey[1] * pl.setback]), plotXs = d.plots.flatMap((pl) => [pl.rect[0], pl.rect[2], pl.A[0] + pl.ey[0] * pl.setback]);
  const hexOfPiece = { road: col.road, verge: col.verge, walk: col.walk, furnish: col.furnish };
  for (const p of d.pieces) {
    const [x0, y0, x1, y1] = p.rect, along = p.street ? (p.street.startsWith('ns') ? 'y' : 'x') : null;
    const xs = along === 'x' ? breaks(x0, x1, plotXs, CELL) : [x0, x1], ys = along === 'y' ? breaks(y0, y1, plotYs, CELL) : [y0, y1];
    const lift = p.cls === 'road' ? 0 : row.kerb, hex = hexOfPiece[p.cls] ?? col.walk;
    for (let j = 0; j + 1 < ys.length; j++) for (let i = 0; i + 1 < xs.length; i++) {
      const q = [[xs[i], ys[j]], [xs[i + 1], ys[j]], [xs[i + 1], ys[j + 1]], [xs[i], ys[j + 1]]];
      put(q.map(([x, y]) => [x, y, S(x, y) + lift]), `geotown:${p.cls}`, hex);
    }
    // the kerb's face along each road edge a walk or a verge stands on, toward the road
    for (const side of p.kerbs ?? []) {
      const ax = side.endsWith('x'), at = side.startsWith('-') ? (ax ? x0 : y0) : (ax ? x1 : y1), into = side.startsWith('-') ? 1 : -1, run = ax ? ys : xs;
      for (let k = 0; k + 1 < run.length; k++) {
        const a = ax ? [at, run[k]] : [run[k], at], b = ax ? [at, run[k + 1]] : [run[k + 1], at];
        put([[...a, S(...a)], [...b, S(...b)], [...b, S(...b) + row.kerb], [...a, S(...a) + row.kerb]], 'geotown:kerb', col.kerb, ax ? [into, 0, 0] : [0, into, 0]);
      }
    }
  }
  // ── the buildings' languages: the recipe's style, else the pattern's, else the cube's buildings', else the timber hall ──
  const { style, anchor: a0 } = settlementStyle(cube, null, m.style ?? P.style), anchor = a0 ?? cubeBuildings(cube)?.anchor ?? 'timber-hall';
  const kitId = hasStructureRails(cube.outside.base) ? cube.outside.base : 'isekai-meadow';
  const sStyle = structureStyle(kitId, seed), L = townLanguage(sStyle, anchor), Pt = housePaint(kitId);
  const dress = style ? styleTownDress(style, cube, townDressOf(cube)) : townDressOf(cube);
  const litV = (n) => 0.55 + 0.45 * Math.max(0, n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]);
  const [sLo, sHi] = P.house.storeys, spoken = new Map();
  // an EVOCATION's buildings each a kit of their row's kind (houses.js), no two neighbours alike; each yard its own
  const evoked = !!d.evoked, kits = evoked ? buildingKits(P, m.style ?? P.style, cube, kitId, seed) : null, types = new Map();
  if (kits) for (const B of d.blocks) for (const r of B.rows ?? []) {
    const R = streamOf(seed, 'types', `${B.id}:${r.side}`);
    let prev = null;
    for (const pl of d.plots.filter((q) => q.block === B.id && q.side === r.side).sort((p, q) => p.k - q.k)) {
      const key = pl.pair ?? pl.id;
      if (!types.has(key)) { prev = pl.type ? `${pl.type}:${pl.k}` : kits.pick(familyOf(pl), R, prev); types.set(key, prev); }
    }
  }
  // ── the plots ──
  const W = (pl, u, v, z) => [pl.A[0] + pl.ex[0] * u + pl.ey[0] * v, pl.A[1] + pl.ex[1] * u + pl.ey[1] * v, z];
  const items = {}, grows = (sp, x, y, z, h, on) => { (items[sp] ||= []).push({ x: r5(x), y: r5(y), z0: r5(z), height: r5(h), on }); };
  // a town tree's height: from twice a person's height (the geocube's walk: era/out-ikebana.js WALK.body) to its
  // species' most, or `top`; its room among the buildings holds it lower later
  const treeH = (sp, f, top = Infinity) => { const hh = Math.max(TREE_LEAST, Math.min(SPECIES[sp].heights[1], top)); return TREE_LEAST + (hh - TREE_LEAST) * f; };
  // a yard's or a fence's face, in its plot's frame (u, v, z over its pad), painted by its role (or its own paint)
  const yardPrev = new Map(), yardsOf = {};
  const yardFace = (pl, f, shedHex = col.shed) => {
    const cs = f.corners.map(([u, v, z]) => W(pl, u, v, pl.pad + z)), o = f.out, want = unit([pl.ex[0] * o[0] + pl.ey[0] * o[1], pl.ex[1] * o[0] + pl.ey[1] * o[1], o[2]]);
    put(cs, `geotown:${f.role}`, f.hex ?? (f.role === 'shed' ? shedHex : col[f.role] ?? col.timber), want);
  };
  let built = 0, hedges = 0, gated = 0, padCars = 0;
  const builtOf = {};
  for (const pl of d.plots) {
    const { w, d: dep, setback: F, pad } = pl, { env, depth: Hd } = pl.house, envW = env[2] - env[0];
    const wkAt = (u) => { const [x, y] = W(pl, u, 0, 0); return wk(x, y); };
    // the building: its design (a semi's second half is its partner's, mirrored about the party wall), its door
    let house = null;
    if (pl.built) {
      const key = pl.pair ?? pl.id, R0 = streamOf(seed, 'house', key), K = kits ? kits.kit(familyOf(pl), types.get(key)) : null;
      if (!spoken.has(key)) {
        const s = Math.floor(R0() * 1e6) + 1, [b0, b1] = K ? K.band : [sLo, sHi];
        spoken.set(key, speak(K ? K.L : L, K ? K.use : pl.use ?? 'dwelling', { w: r5(envW), d: r5(Hd) }, K ? kits.sStyle : sStyle, s, { ring: 'near', band: [b0, b1], ...(K?.accent ? { accent: true } : {}), over: { front: 0, side: 0, rear: 0, area: envW * Hd * b0 } }));
      }
      const dz = spoken.get(key), mirror = pl.half === 'R';
      const door = dz.faces.find((f) => f.part === 'door' || f.part === 'accent'), dx = door ? door.corners.reduce((a, c) => a + c[0], 0) / door.corners.length : envW / 2;
      // (its front: a bay and a porch, a shopfront, a canopy, fronts.js, in its own frame; a semi's halves mirrored)
      const front = K ? frontOf(fitFront(K.front, env[1]), { W: dz.dims.W0, n: dz.dims.n, storeyH: dz.dims.storeyH, doorX: dx, doorW: dz.dims.doorW }) : null;
      house = { design: dz, mirror, doorU: env[0] + (mirror ? envW - dx : dx), kit: K, front, porch: front?.porch ?? 0 };
    }
    const R = streamOf(seed, 'yard', pl.id), lawn = mix(col.lawn, R() < 0.5 ? col.hedge : '#ffffff', 0.04 + 0.08 * R());
    // the path to the door (or the envelope's middle), inside the front yard
    // (beside a parking pad, never across it)
    const pw = pl.path.w, Pk = pl.park, lo0 = Pk && Pk[0] === 0 ? Pk[1] + 0.1 : 0, hi0 = Pk && Pk[0] > 0 ? Pk[0] - 0.1 : w;
    const pu = Math.max(lo0 + pw / 2 + 0.05, Math.min(hi0 - pw / 2 - 0.05, house ? house.doorU : pl.path.u)), a = pu - pw / 2, b = pu + pw / 2;
    if (F > 0) {
      // the front bank: the walk's back edge up (or down) to the pad at the setback line, in strips about the path (and a
      // mansion's drive); a mansion's wider lawn on its pad behind it, to its house
      const Mn = pl.mansion, F1 = env[1], cuts = [[a, b, 'path', col.path], ...(Mn ? [[Mn.drive[0], Mn.drive[1], 'drive', col.drive]] : []), ...(Pk ? [[Pk[0], Pk[1], 'drive', col.drive]] : [])].sort((p, q) => p[0] - q[0]);
      const strips = [];
      let u = 0;
      for (const [c0, c1, grp, hex] of cuts) { if (c0 > u) strips.push([u, c0, 'front', lawn]); strips.push([c0, c1, grp, hex]); u = c1; }
      if (u < w) strips.push([u, w, 'front', lawn]);
      for (const [u0, u1, grp, hex] of strips) {
        if (u1 - u0 < 1e-3) continue;
        put([W(pl, u0, 0, wkAt(u0)), W(pl, u1, 0, wkAt(u1)), W(pl, u1, F, pad), W(pl, u0, F, pad)], `geotown:${grp}`, hex);
        if (F1 > F + 1e-3) put([W(pl, u0, F, pad), W(pl, u1, F, pad), W(pl, u1, F1, pad), W(pl, u0, F1, pad)], `geotown:${grp}`, hex);
      }
      // the path's steps, set in the bank: each tread level with the bank at its back, its riser down to the bank at its
      // foot (up to a porch's deck where the house has one: its steps end at the deck's front)
      const rise = pad - wkAt(pu), Fs = F - (env[1] > F + 1e-3 ? 0 : house?.porch ?? 0);
      if (Math.abs(rise) > NO_STEPS) {
        const n = Math.ceil(Math.abs(rise) / STEP_RISE), go = Fs / n, base = wkAt(pu), up = Math.sign(rise);
        for (let i = 0; i < n; i++) {
          const v0 = i * go, v1 = (i + 1) * go, zt = base + (rise * (up > 0 ? i + 1 : i)) / n, zb0 = base + (rise * i) / n, zb1 = base + (rise * (i + 1)) / n;
          put([W(pl, a, v0, zt), W(pl, b, v0, zt), W(pl, b, v1, zt), W(pl, a, v1, zt)], 'geotown:step', col.step);
          const vr = up > 0 ? v0 : v1, zr = up > 0 ? zb0 : zb1;
          if (Math.abs(zt - zr) > 1e-3) put([W(pl, a, vr, zr), W(pl, b, vr, zr), W(pl, b, vr, zt), W(pl, a, vr, zt)], 'geotown:step', col.step, up > 0 ? [-pl.ey[0], -pl.ey[1], 0] : [pl.ey[0], pl.ey[1], 0]);
          for (const [u, sg] of [[a, -1], [b, 1]]) {
            const out = [pl.ex[0] * sg, pl.ex[1] * sg, 0];
            if (up > 0) put([W(pl, u, v0, zb0), W(pl, u, v1, zt), W(pl, u, v0, zt)], 'geotown:step', col.step, out);
            else put([W(pl, u, v0, zb0), W(pl, u, v1, zb1), W(pl, u, v1, zt)], 'geotown:step', col.step, out);
          }
        }
      }
    } else {
      // a building built to its walk: its threshold's face between the walk and its floor, along its front
      if (Math.abs(pad - wkAt(w / 2)) > 0.01) put([W(pl, 0, 0, wkAt(0)), W(pl, w, 0, wkAt(w)), W(pl, w, 0, pad), W(pl, 0, 0, pad)], 'geotown:step', col.kerb, [-pl.ey[0], -pl.ey[1], 0]);
      // (an avenue's building set back by its type: its forecourt of parking, cars nose in, or its lawn and path)
      const F1 = env[1];
      if (F1 > 1e-3) {
        put([W(pl, 0, 0, pad), W(pl, w, 0, pad), W(pl, w, F1, pad), W(pl, 0, F1, pad)], `geotown:${pl.paved ? 'service' : 'front'}`, pl.paved ? col.service : lawn);
        if (pw > 0) put([W(pl, a, 0, pad + 0.01), W(pl, b, 0, pad + 0.01), W(pl, b, F1, pad + 0.01), W(pl, a, F1, pad + 0.01)], 'geotown:path', col.path);
        if (pl.paved && F1 > 5) for (let u = 1.6; u + 1.2 < w; u += 2.8) {
          if (u + 1 > a && u - 1 < b) continue;
          if (R() < 0.6) for (const f of carOf(u, F1 / 2, 'v', CAR_PAINTS[Math.floor(R() * CAR_PAINTS.length)])) yardFace(pl, f);
        }
      }
    }
    // the pad: the side yards (a mansion's drive-side its drive), the building's ground, the back yard or the service
    // yard (round a mansion's apron and garage), one level quad each
    const [sL, sR] = pl.house.sides, Mn = pl.mansion, [, F1, , F3] = env;
    const quadAt = (u0, v0, u1, v1, grp, hex) => { if (u1 - u0 > 1e-3 && v1 - v0 > 1e-3) put([W(pl, u0, v0, pad), W(pl, u1, v0, pad), W(pl, u1, v1, pad), W(pl, u0, v1, pad)], `geotown:${grp}`, hex); };
    quadAt(0, F1, sL, F3, Mn?.left ? 'drive' : 'side', Mn?.left ? col.drive : col.side); quadAt(w - sR, F1, w, F3, Mn && !Mn.left ? 'drive' : 'side', Mn && !Mn.left ? col.drive : col.side);
    quadAt(sL, F1, w - sR, F3, 'house', col.house);
    const apron = Mn?.garage ? [Mn.drive[0], F3, Mn.drive[1], Mn.garage[1]] : null;
    for (const q of lessRects([0, F3, w, dep], [apron, Mn?.garage].filter(Boolean))) quadAt(...q, pl.rear, pl.rear === 'back' ? lawn : col.service);
    if (apron) { quadAt(...apron, 'drive', col.drive); quadAt(...Mn.garage, 'drive', col.drive); for (const f of garageOf(Mn.garage)) yardFace(pl, f); }
    if (pl.laneGarage && pl.built) for (const f of garageOf(pl.laneGarage, 'v1')) yardFace(pl, f);
    // a hedge along a house's front line, a share of the households keep one (not across the path)
    if (pl.kind === 'houses' && F > 1.5 && R() < P.grow.front) {
      hedges++;
      for (const [h0, h1] of [[HEDGE.in, a - 0.3], [b + 0.3, w - HEDGE.in]]) {
        // (never across a parking pad)
        const u0 = Pk && Pk[0] === 0 ? Math.max(h0, Pk[1] + 0.3) : h0, u1 = Pk && Pk[0] > 0 ? Math.min(h1, Pk[0] - 0.3) : h1;
        if (u1 - u0 < 0.8) continue;
        const v0 = HEDGE.in, v1 = HEDGE.in + HEDGE.d, z0 = Math.min(wkAt(u0), wkAt(u1)) - 0.05, zt = z0 + HEDGE.h + Math.max(0, (pad - wkAt((u0 + u1) / 2)) * (v1 / F));
        const c = [W(pl, u0, v0, 0), W(pl, u1, v0, 0), W(pl, u1, v1, 0), W(pl, u0, v1, 0)];
        put(c.map((p) => [p[0], p[1], zt]), 'geotown:hedge', col.hedge);
        for (let k = 0; k < 4; k++) { const p = c[k], q = c[(k + 1) % 4], o = unit([...cross(sub3(q, p), [0, 0, 1]).slice(0, 2), 0]); put([[p[0], p[1], z0], [q[0], q[1], z0], [q[0], q[1], zt], [p[0], p[1], zt]], 'geotown:hedge', col.hedge, o); }
      }
    }
    // a parking pad's car, now and then, nose to the house on the pad's gentle slope
    if (Pk && streamOf(seed, 'parking', `car:${pl.id}`)() < P.parking.share) {
      const Rc = streamOf(seed, 'parking', `paint:${pl.id}`), cu = (Pk[0] + Pk[1]) / 2, cv = F / 2 + 0.2, zc = wkAt(cu) + (pad - wkAt(cu)) * (cv / F);
      for (const f of carOf(cu, cv, 'v', CAR_PAINTS[Math.floor(Rc() * CAR_PAINTS.length)])) yardFace(pl, { ...f, corners: f.corners.map(([u, v, z]) => [u, v, z + zc - pad]) });
      padCars++;
    }
    // a gated front (its streetscape's share; a mansion's more often): its boundary along the front line from the walk's
    // lowest point along it, a gate at its path, a pad left open, a mansion's drive between piers behind its gates
    if (pl.built && F > 0.4 && (pl.kind === 'houses' || pl.kind === 'apartments') && P.gates?.share > 0) {
      const Rg = streamOf(seed, 'gates', pl.id);
      if (Rg() < (pl.mansion ? Math.sqrt(P.gates.share) : P.gates.share)) {
        const kind = pickWeighted(Rg, P.gates.kinds), z0 = Math.min(wkAt(0), wkAt(w)) - 0.03;
        const open = [[a, b, 'path'], ...(Pk ? [[...Pk, 'pad']] : []), ...(pl.mansion ? [[...pl.mansion.drive, 'drive']] : [])];
        for (const f of gatesOf(kind, { w, open, mansion: !!pl.mansion })) yardFace(pl, { ...f, corners: f.corners.map(([u, v, z]) => [u, v, z + z0 - pad]) });
        gated++; pl.gate = kind;
      }
    }
    // the building on its pad: its faces (and an evocation's its tile's marks too: its lights a budget put there) from
    // its design, a semi's second half mirrored; painted and lit as a stage's town
    if (house) {
      built++; builtOf[familyOf(pl)] = (builtOf[familyOf(pl)] ?? 0) + 1;
      const dz = house.design, X = (x) => env[0] + (house.mirror ? envW - x : x), toW = (c) => W(pl, X(c[0]), env[1] + c[1], pad + c[2]);
      let top = 0, lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
      const Dr = house.kit ? house.kit.dress : dress;
      for (const f of evoked ? [...dz.faces, ...dz.tile] : dz.faces) {
        const cs = (house.mirror ? f.corners.slice().reverse() : f.corners).map(toW), nl = f.normal ?? [0, 0, 1], nn = unit([pl.ex[0] * (house.mirror ? -nl[0] : nl[0]) + pl.ey[0] * nl[1], pl.ex[1] * (house.mirror ? -nl[0] : nl[0]) + pl.ey[1] * nl[1], nl[2]]);
        for (const c of cs) { top = Math.max(top, c[2] - pad); lo = [Math.min(lo[0], c[0]), Math.min(lo[1], c[1])]; hi = [Math.max(hi[0], c[0]), Math.max(hi[1], c[1])]; }
        const fill = Pt(f.group, Math.min(1, (f.value ?? 0.6) * litV(nn))), F0 = { corners: cs.map(P3), group: `town:${f.part}`, fill, cornerFills: cs.map(() => fill), normal: P3(nn), outNormal: P3(nn) };
        faces.push(Dr ? dressTownFace(F0, f.group, Dr) : F0);
      }
      // its front: the bay's walls in their storey's own wall, its lights, its trim and its top; the porch's deck, posts
      // and roof; a shopfront's glazing, sign and awning; a canopy
      if (house.front) {
        const wallOf = new Map();
        for (const f of dz.faces) if (f.part === 'wall') { const s0 = Math.floor((Math.min(...f.corners.map((c) => c[2])) + 0.05) / dz.dims.storeyH); if (!wallOf.has(s0)) wallOf.set(s0, { group: f.group, value: f.value ?? 0.5 }); }
        for (const f of house.front.faces) {
          const cs = (house.mirror ? f.corners.slice().reverse() : f.corners).map(toW), o = f.out, ox = house.mirror ? -o[0] : o[0], nn = unit([pl.ex[0] * ox + pl.ey[0] * o[1], pl.ex[1] * ox + pl.ey[1] * o[1], o[2]]);
          const n0 = newell(cs), nf = n0[0] * nn[0] + n0[1] * nn[1] + n0[2] * nn[2] < 0 ? n0.map((x) => -x) : n0, cw = n0 === nf ? cs : cs.slice().reverse();
          for (const c of cw) { top = Math.max(top, c[2] - pad); lo = [Math.min(lo[0], c[0]), Math.min(lo[1], c[1])]; hi = [Math.max(hi[0], c[0]), Math.max(hi[1], c[1])]; }
          const W0 = wallOf.get(Math.min(f.storey ?? 0, dz.dims.n - 1)) ?? wallOf.get(0) ?? { group: dz.dims.ground, value: 0.5 };
          const [grp, v] = f.role === 'wall' ? [W0.group, W0.value] : f.role === 'roof' ? [dz.dims.covering, 0.34] : f.role === 'trim' ? ['str:paint', 0.92] : f.role === 'deck' ? ['str:timber', 0.5] : [null, 0];
          const own = f.role === 'sign' ? house.kit.sign ?? col.door : f.role === 'canvas' ? house.kit.awning ?? col.canvas : col.glass;
          const fill = grp ? Pt(grp, Math.min(1, v * litV(nf))) : shadeHex(own, nf, LIGHT), F0 = { corners: cw.map(P3), group: `geotown:${f.role === 'glass' ? 'glass' : f.role === 'wall' ? 'bay' : f.role === 'deck' ? 'porch' : f.role}`, fill, cornerFills: cw.map(() => fill), normal: P3(nf), outNormal: P3(nf) };
          faces.push(grp && Dr && f.role !== 'deck' ? dressTownFace(F0, grp, Dr) : F0);
        }
      }
      colliders.push({ min: P3([lo[0], lo[1], pad]), max: P3([hi[0], hi[1], pad + top]), of: `${pl.id}:house` });
      anchors.push({ id: `house-${pl.id}`, kind: 'house', use: house.kit?.use ?? pl.use ?? 'dwelling', row: pl.kind, ...(pl.form === 'mansion' ? { mansion: true } : {}), at: P3(W(pl, house.doorU, env[1], pad)), N: P3([-pl.ey[0], -pl.ey[1], 0]), floor: r5(pad), box: { min: P3([lo[0], lo[1], pad]), max: P3([hi[0], hi[1], pad + top]) }, ...(house.kit ? { type: house.kit.type } : {}) });
      // an evocation's rear: a house's back yard its own program, a shop's service yard, a walk-up's lot
      if (evoked) {
        const Ry = streamOf(seed, 'yards', pl.id), v0 = env[1] + Math.min(Hd, dz.dims.D0);
        if (pl.rear === 'back') {
          // (a mansion's plan its own, on its lawn beside its drive and garage): each zone's feature never the one its
          // row neighbour drew there
          const Mn = pl.mansion, table = Mn ? P.mansion.yards : P.yards, key = `${pl.block}:${pl.side}`, prev = Mn ? null : yardPrev.get(key);
          const pickZ = (t, was) => (Object.keys(t).length > 1 ? pickWeighted(Ry, t, was) : Object.keys(t)[0]);
          const want = Object.fromEntries(ZONES.map((z) => [z, table[z] ? pickZ(table[z], prev?.[z] ?? null) : 'lawn']));
          pl.fence = Mn ? 'hedge' : pickWeighted(Ry, P.fences);
          const busy = Mn?.garage ? [Math.min(Mn.drive[0], Mn.garage[0]) - 0.5, Math.max(Mn.drive[1], Mn.garage[2]) + 0.5] : null;
          const [ua, ub] = busy ? (Mn.left ? [busy[1], w] : [0, busy[0]]) : [0, w];
          const Y = yardOf(want, { w: ub - ua, v0, v1: pl.laneGarage ? pl.laneGarage[1] - 0.6 : dep, R: Ry }), shedHex = SHEDS[Math.floor(Ry() * SHEDS.length)];
          if (!Mn) yardPrev.set(key, Y.plan);
          const drawn = ZONES.map((z) => Y.plan[z]).filter((x) => x !== 'lawn');
          for (const x of drawn) yardsOf[x] = (yardsOf[x] ?? 0) + 1;
          for (const f of Y.faces) yardFace(pl, { ...f, corners: f.corners.map(([u, v, z]) => [u + ua, v, z]) }, shedHex);
          // its trees: a shade tree the pattern's broad one (`grow.shade`), grown near its most; the rest younger
          const tall = P.grow.shade ?? P.grow.trees[0];
          pl.yardV0 = v0;
          for (const t of Y.trees) { const [x, y] = W(pl, t.u + ua, t.v, 0), sp = t.large ? tall : P.grow.trees[Math.floor(Ry() * P.grow.trees.length)]; grows(sp, x, y, pad, treeH(sp, t.large ? 0.8 + 0.2 * Ry() : 0.25 + 0.5 * Ry()), 'back'); }
          // a balcony off an upper floor at the back, on a share of the houses: its reach into the house's room
          const bw = Math.min(3.4, envW - 1.2);
          if (Ry() < (table.balcony ?? 0) && dz.dims.n >= 2 && bw >= 1.8) {
            const cu = (env[0] + env[2]) / 2, Cb = colliders[colliders.length - 1];
            for (const f of balconyOf({ u0: cu - bw / 2, u1: cu + bw / 2, v: v0, z: dz.dims.storeyH, R: Ry })) {
              yardFace(pl, f);
              for (const [u, v] of f.corners) { const [x, y] = W(pl, u, v, 0); Cb.min[0] = r5(Math.min(Cb.min[0], x)); Cb.min[1] = r5(Math.min(Cb.min[1], y)); Cb.max[0] = r5(Math.max(Cb.max[0], x)); Cb.max[1] = r5(Math.max(Cb.max[1], y)); }
            }
            drawn.push('balcony'); yardsOf.balcony = (yardsOf.balcony ?? 0) + 1;
          }
          pl.yard = drawn.length ? drawn.join(', ') : 'lawn';
        } else {
          pl.fence = 'board';
          for (const f of serviceOf(pl.kind, { w, v0, v1: dep, R: Ry }).faces) yardFace(pl, f);
        }
      }
    }
  }
  // ── where pads meet: along each row, at a corner's flank, and at a block's back line ──
  const wall = (cs, want) => put(cs, 'geotown:wall', col.wall, want);
  const rowsOf = (B) => (B.rows ?? []).map((r) => d.plots.filter((pl) => pl.block === B.id && pl.side === r.side).sort((p, q) => p.k - q.k));
  for (const B of d.blocks) {
    for (const rowP of rowsOf(B)) {
      for (let k = 0; k + 1 < rowP.length; k++) {
        const p = rowP[k], q = rowP[k + 1];
        if (Math.abs(p.pad - q.pad) < 0.01) continue;
        const lowSide = p.pad > q.pad ? [p.ex[0], p.ex[1], 0] : [-p.ex[0], -p.ex[1], 0], f0 = W(p, p.w, 0, 0), f0z = wk(f0[0], f0[1]);
        if (p.setback > 0) wall([[f0[0], f0[1], f0z], W(p, p.w, p.setback, p.pad), W(p, p.w, p.setback, q.pad)], lowSide);
        wall([W(p, p.w, p.setback, p.pad), W(p, p.w, p.d, p.pad), W(p, p.w, p.d, q.pad), W(p, p.w, p.setback, q.pad)], lowSide);
      }
      // the flanks: the first plot's start and the last plot's end stand over (or under) the cross street's walk
      for (const [p, u, sg] of [[rowP[0], 0, -1], [rowP[rowP.length - 1], rowP[rowP.length - 1]?.w, 1]]) {
        if (!p) continue;
        const pts = [0, p.setback, p.d].map((v) => { const q = W(p, u, v, 0); return [q[0], q[1], wk(q[0], q[1])]; }), out = [p.ex[0] * sg, p.ex[1] * sg, 0];
        const want = (z) => (p.pad >= z ? out : out.map((x) => -x));
        if (p.setback > 0 && Math.abs(p.pad - pts[1][2]) > 0.01) wall([pts[0], pts[1], [pts[1][0], pts[1][1], p.pad]], want(pts[1][2]));
        if (Math.abs(p.pad - (pts[1][2] + pts[2][2]) / 2) > 0.01) wall([pts[1], pts[2], [pts[2][0], pts[2][1], p.pad], [pts[1][0], pts[1][1], p.pad]], want((pts[1][2] + pts[2][2]) / 2));
      }
    }
    // the back line: the first row's backs against the second's, wherever they meet
    const [A, Bq] = rowsOf(B);
    if (A && Bq) for (const p of A) for (const q of Bq) {
      if (!backTouch(p, q) || Math.abs(p.pad - q.pad) < 0.01) continue;
      const [a, b] = [p.rect, q.rect], alongY = Math.abs(a[2] - b[0]) < 1e-3 || Math.abs(b[2] - a[0]) < 1e-3;
      if (alongY) { const x = Math.abs(a[2] - b[0]) < 1e-3 ? a[2] : a[0], y0 = Math.max(a[1], b[1]), y1 = Math.min(a[3], b[3]), toQ = Math.sign((b[0] + b[2]) / 2 - x); wall([[x, y0, p.pad], [x, y1, p.pad], [x, y1, q.pad], [x, y0, q.pad]], [p.pad > q.pad ? toQ : -toQ, 0, 0]); }
      else { const y = Math.abs(a[3] - b[1]) < 1e-3 ? a[3] : a[1], x0 = Math.max(a[0], b[0]), x1 = Math.min(a[2], b[2]), toQ = Math.sign((b[1] + b[3]) / 2 - y); wall([[x0, y, p.pad], [x1, y, p.pad], [x1, y, q.pad], [x0, y, q.pad]], [0, p.pad > q.pad ? toQ : -toQ, 0]); }
    }
  }
  // ── an edge's LANE: the streets' ground between its rows' backs; a face where each lot's pad stands over (or under) it ──
  for (const B of d.blocks) {
    if (!B.lane) continue;
    const [x0, y0, x1, y1] = B.lane, ax = x1 - x0 >= y1 - y0, xs = ax ? breaks(x0, x1, plotXs, CELL) : [x0, x1], ys = ax ? [y0, y1] : breaks(y0, y1, plotYs, CELL);
    for (let j = 0; j + 1 < ys.length; j++) for (let i = 0; i + 1 < xs.length; i++) put([[xs[i], ys[j]], [xs[i + 1], ys[j]], [xs[i + 1], ys[j + 1]], [xs[i], ys[j + 1]]].map(([x, y]) => [x, y, S(x, y)]), 'geotown:lane', col.lane);
    for (const pl of d.plots.filter((q) => q.block === B.id)) {
      const a = W(pl, 0, pl.d, 0), b = W(pl, pl.w, pl.d, 0), za = S(a[0], a[1]), zb = S(b[0], b[1]);
      if (Math.abs(pl.pad - (za + zb) / 2) < 0.01) continue;
      wall([[a[0], a[1], za], [b[0], b[1], zb], [b[0], b[1], pl.pad], [a[0], a[1], pl.pad]], pl.pad > (za + zb) / 2 ? [pl.ey[0], pl.ey[1], 0] : [-pl.ey[0], -pl.ey[1], 0]);
    }
  }
  // ── an evocation's fences: between each yard and the next (from the buildings' back walls), on its flanks, and along
  // the back line (the first row's), each plot's own kind, standing on the higher of the two pads ──
  if (evoked) for (const B of d.blocks) rowsOf(B).forEach((rowP0, ri) => {
    const rowP = rowP0.filter((pl) => pl.fence);
    rowP.forEach((p, k) => {
      const q = rowP[k + 1], vb = (pl) => pl.house.env[3];
      if (q) for (const f of fenceOf(p.fence, [p.w, Math.max(vb(p), vb(q))], [p.w, p.d], Math.max(0, q.pad - p.pad))) yardFace(p, f);
      if (k === 0) for (const f of fenceOf(p.fence, [0, vb(p)], [0, p.d], 0)) yardFace(p, f);
      if (!q) for (const f of fenceOf(p.fence, [p.w, vb(p)], [p.w, p.d], 0)) yardFace(p, f);
      if (ri === 0 || B.lane) for (const [u0, u1] of p.laneGarage ? [[0, p.laneGarage[0]], [p.laneGarage[2], p.w]] : [[0, p.w]]) if (u1 - u0 > 0.2) for (const f of fenceOf(p.fence, [u0, p.d], [u1, p.d], 0)) yardFace(p, f);
    });
  });
  // ── the parks: the land as it lies, eased to the walks round it; their paths on the same lattice ──
  const parkZ = (B) => (x, y) => { const [x0, y0, x1, y1] = B.rect, e = Math.min(x - x0, x1 - x, y - y0, y1 - y), t = smooth(0, 14, e); return wk(x, y) * (1 - t) + N(x, y) * t; };
  const inRect = (r, x, y, pad = 0) => x > r[0] - pad && x < r[2] + pad && y > r[1] - pad && y < r[3] + pad;
  // (a site's things that no tree stands in: its playground, its pavilion, its field house, its lot, in the world)
  const siteRects = (B) => { const St = B.site; if (!St) return []; const Wl = (u, v) => [St.A[0] + St.ex[0] * u + St.ey[0] * v, St.A[1] + St.ex[1] * u + St.ey[1] * v]; return ['playground', 'pavilion', 'fieldhouse', 'lot'].map((k) => St.what[k]).filter(Boolean).map((r) => { const a = Wl(r[0], r[1]), b = Wl(r[2], r[3]); return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]; }); };
  for (const B of d.blocks) {
    if (!B.paths) continue;
    const [x0, y0, x1, y1] = B.rect, z = parkZ(B), edgesX = B.paths.flatMap((r) => [r[0], r[2]]), edgesY = B.paths.flatMap((r) => [r[1], r[3]]);
    const xs = breaks(x0, x1, [...edgesX, ...plotXs], PARK_CELL), ys = breaks(y0, y1, [...edgesY, ...plotYs], PARK_CELL);
    for (let j = 0; j + 1 < ys.length; j++) for (let i = 0; i + 1 < xs.length; i++) {
      const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2, path = B.paths.some((r) => inRect(r, cx, cy));
      put([[xs[i], ys[j]], [xs[i + 1], ys[j]], [xs[i + 1], ys[j + 1]], [xs[i], ys[j + 1]]].map(([x, y]) => [x, y, z(x, y)]), path ? 'geotown:park-path' : 'geotown:park', path ? col['park-path'] : col.park);
    }
    // its trees, loose, clear of its paths and a little in from its edges
    const R = streamOf(seed, 'green', `park:${B.id}`), want = Math.round(((x1 - x0) * (y1 - y0) / 10000) * P.grow.park);
    for (let k = 0, tries = 0; k < want && tries < want * 12; tries++) {
      const x = x0 + 4 + R() * (x1 - x0 - 8), y = y0 + 4 + R() * (y1 - y0 - 8);
      if (B.paths.some((r) => inRect(r, x, y, 3)) || siteRects(B).some((r) => inRect(r, x, y, 3))) continue;
      const sp = P.grow.parkTrees[Math.floor(R() * P.grow.parkTrees.length)];
      grows(sp, x, y, z(x, y), treeH(sp, 0.4 + 0.6 * R()), 'park'); k++;
    }
  }
  // ── the SITES (sites.js): a school's or a sports field's ground one level, each part drawn as what it is, its edges
  // standing over (or under) the walks round it and its school's lot; their things on it; a park's things on its land ──
  const siteCount = {};
  for (const B of d.blocks) {
    const St = B.site;
    if (!St) continue;
    siteCount[St.type] = (siteCount[St.type] ?? 0) + 1;
    const Wl = (u, v) => [St.A[0] + St.ex[0] * u + St.ey[0] * v, St.A[1] + St.ex[1] * u + St.ey[1] * v], park = St.type === 'park', pz = park ? parkZ(B) : null;
    const zOf = (u, v) => (park ? pz(...Wl(u, v)) : B.z), Rs = streamOf(seed, 'site', `${B.id}:draw`), w = St.what;
    // a thing in the site's frame, on its ground (a park's at the land under its middle)
    const thing = (fs, z0 = null) => {
      for (const f of fs) {
        const o = f.out, want = unit([St.ex[0] * o[0] + St.ey[0] * o[1], St.ex[1] * o[0] + St.ey[1] * o[1], o[2]]);
        put(f.corners.map(([u, v, z]) => { const [x, y] = Wl(u, v); return [x, y, (z0 ?? zOf(u, v)) + z]; }), `geotown:${f.role}`, f.hex ?? col[f.role] ?? col.metal, want);
      }
    };
    // (a thing stands on its ground's highest corner: on a park's slope its floor proud on the low side, never buried)
    const mid = (r) => Math.max(zOf(r[0], r[1]), zOf(r[2], r[1]), zOf(r[2], r[3]), zOf(r[0], r[3]), zOf((r[0] + r[2]) / 2, (r[1] + r[3]) / 2)), box2 = (r) => { const a = Wl(r[0], r[1]), b = Wl(r[2], r[3]); return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]; };
    const building = (r, fs, of) => { const z0 = mid(r); thing(fs, z0); const q = box2(r); colliders.push({ min: P3([q[0], q[1], z0]), max: P3([q[2], q[3], z0 + 5]), of: `${B.id}:${of}:house` }); };
    if (park) {
      // (its chips laid on the land, its play things on their highest point)
      if (w.playground) { const [chips, ...rest] = playgroundOf(w.playground, Rs); thing([chips]); thing(rest, mid(w.playground)); }
      if (w.pavilion) building(w.pavilion, pavilionOf(w.pavilion), 'pavilion');
      // benches along the paths, a side each by turns, clear of the crossing
      for (const p of w.paths) {
        const along = p[2] - p[0] >= p[3] - p[1] ? 'u' : 'v', [a0, a1] = along === 'u' ? [p[0], p[2]] : [p[1], p[3]], c = along === 'u' ? (p[1] + p[3]) / 2 : (p[0] + p[2]) / 2, half = (along === 'u' ? p[3] - p[1] : p[2] - p[0]) / 2;
        let k = 0;
        for (let s = a0 + 6; s < a1 - 6; s += P.sites.park.bench) {
          const side = k++ % 2 ? 1 : -1, cu = along === 'u' ? s : c + side * (half + 0.6), cv = along === 'u' ? c + side * (half + 0.6) : s;
          if (Math.hypot(cu - St.L / 2, cv - St.D / 2) < 8) continue;
          thing(benchOf(cu, cv, along, -side), zOf(cu, cv));
        }
      }
      continue;
    }
    // its ground: each part one level quad (a track's ring and its turf, a diamond's dirt drawn as they lie)
    const lot = d.plots.find((pl) => pl.block === B.id && pl.kind === 'school');
    for (const s of d.surfaces) {
      if (s.block !== B.id || s.plot || s.what === 'track' || s.what === 'field' || s.cls === 'infield' || s.cls === 'house') continue;
      const [x0, y0, x1, y1] = s.rect;
      put([[x0, y0, B.z], [x1, y0, B.z], [x1, y1, B.z], [x0, y1, B.z]], `geotown:${s.cls}`, col[s.cls] ?? col.lawn);
    }
    if (w.pitch) thing(pitchOf(w.pitch, Rs));
    if (w.track) thing(trackOf(w.track, P.sites.school.track.band));
    if (w.diamond) thing(diamondOf(w.diamond, Rs));
    if (w.courts) thing(courtsOf(w.courts.rect, w.courts.n));
    if (w.lot) thing(lotOf(w.lot, Rs));
    if (w.fieldhouse) building(w.fieldhouse, fieldhouseOf(w.fieldhouse), 'fieldhouse');
    if (w.flag) thing(flagOf(...w.flag), lot?.pad ?? B.z);
    if (w.yard && lot) thing(hoopsOf(w.yard), lot.pad);
    // bleachers along the pitch's near side, its lights at its corners (a sports field's)
    if (w.pitch) { const p = w.pitch, um = (p[0] + p[2]) / 2; thing(bleachersOf(um - 10, um + 10, (w.track ?? p)[1] - 0.5, 1)); if (St.type === 'sports') thing(lightsOf(p)); }
    // its edges: over (or under) the walk round it, the school's lot's own pad along its lot; and between that pad and
    // the site's ground inside it
    const [x0, y0, x1, y1] = B.rect, lr = lot?.rect, inLot = (x, y) => lr && x > lr[0] - 1e-6 && x < lr[2] + 1e-6 && y > lr[1] - 1e-6 && y < lr[3] + 1e-6;
    const front = lot ? [W(lot, 0, 0, 0), W(lot, lot.w, 0, 0)] : null, onFront = (x, y) => front && Math.abs((x - front[0][0]) * lot.ey[0] + (y - front[0][1]) * lot.ey[1]) < 1e-6;
    for (const [a, b, out] of [[[x0, y0], [x1, y0], [0, -1, 0]], [[x1, y0], [x1, y1], [1, 0, 0]], [[x1, y1], [x0, y1], [0, 1, 0]], [[x0, y1], [x0, y0], [-1, 0, 0]]]) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(len / CELL)), ts = new Set(Array.from({ length: n + 1 }, (_, k) => k / n));
      if (lr) for (const v of [lr[0], lr[2]]) if (a[1] === b[1]) ts.add(Math.max(0, Math.min(1, (v - a[0]) / (b[0] - a[0])))); for (const v of lr ? [lr[1], lr[3]] : []) if (a[0] === b[0]) ts.add(Math.max(0, Math.min(1, (v - a[1]) / (b[1] - a[1]))));
      const t = [...ts].sort((p, q) => p - q);
      for (let k = 0; k + 1 < t.length; k++) {
        const p = [a[0] + (b[0] - a[0]) * t[k], a[1] + (b[1] - a[1]) * t[k]], q = [a[0] + (b[0] - a[0]) * t[k + 1], a[1] + (b[1] - a[1]) * t[k + 1]], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        if (onFront(...m) && inLot(...m)) continue;
        const z = inLot(...m) ? lot.pad : B.z;
        if (Math.abs(z - wk(...m)) > 0.01) wall([[...p, wk(...p)], [...q, wk(...q)], [...q, z], [...p, z]], z > wk(...m) ? out : out.map((x) => -x));
      }
    }
    if (lot && Math.abs(lot.pad - B.z) > 0.01) {
      const toward = lot.pad > B.z ? 1 : -1;
      wall([W(lot, lot.w, 0, B.z), W(lot, lot.w, lot.d, B.z), W(lot, lot.w, lot.d, lot.pad), W(lot, lot.w, 0, lot.pad)], [lot.ex[0] * toward, lot.ex[1] * toward, 0]);
      wall([W(lot, 0, lot.d, B.z), W(lot, lot.w, lot.d, B.z), W(lot, lot.w, lot.d, lot.pad), W(lot, 0, lot.d, lot.pad)], [lot.ey[0] * toward, lot.ey[1] * toward, 0]);
    }
    // trees along its lawns (none on its fields, courts or track), at their stride, each still held to its room
    for (const s of d.surfaces) {
      if (s.block !== B.id || s.cls !== 'grounds' || s.area !== undefined || s.plot) continue;
      const [gx0, gy0, gx1, gy1] = s.rect, ax = gx1 - gx0 >= gy1 - gy0, len = ax ? gx1 - gx0 : gy1 - gy0, wid = ax ? gy1 - gy0 : gx1 - gx0;
      if (wid < 3) continue;
      for (let t = 4 + Rs() * 4; t < len - 3; t += P.grow.stride * (1.1 + 0.4 * Rs())) {
        if (Rs() < 0.3) continue;
        const x = ax ? gx0 + t : (gx0 + gx1) / 2, y = ax ? (gy0 + gy1) / 2 : gy0 + t, sp = P.grow.parkTrees[Math.floor(Rs() * P.grow.parkTrees.length)];
        if (siteRects(B).some((r) => inRect(r, x, y, 2))) continue;
        grows(sp, x, y, B.z, treeH(sp, 0.35 + 0.55 * Rs()), 'grounds');
      }
    }
  }
  // ── the margin: the town's border only, the land just round it eased from the outer walks to the natural ground;
  // nothing grows there (a town is styled to its borders, not past them) ──
  const { W: FW, D: FD, margin: M } = d.frame;
  const marginZ = (x, y) => { const qx = Math.max(0, Math.min(FW, x)), qy = Math.max(0, Math.min(FD, y)), e = Math.hypot(x - qx, y - qy), t = smooth(0, Math.max(1, 0.7 * M), e); return wk(qx, qy) * (1 - t) + N(x, y) * t; };
  if (M > 0) {
    const xs = breaks(-M, FW + M, [0, FW], MARGIN_CELL), ys = breaks(-M, FD + M, [0, FD], MARGIN_CELL);
    for (let j = 0; j + 1 < ys.length; j++) for (let i = 0; i + 1 < xs.length; i++) {
      const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
      if (cx > 0 && cx < FW && cy > 0 && cy < FD) continue;
      put([[xs[i], ys[j]], [xs[i + 1], ys[j]], [xs[i + 1], ys[j + 1]], [xs[i], ys[j + 1]]].map(([x, y]) => [x, y, marginZ(x, y)]), 'geotown:margin', col.margin);
    }
  }
  // ── the streets' trees: on each verge, and in each main street's pits, that faces a block (a perimeter street's outer
  // side faces nothing: no tree); a tree or two in a back yard of the town to scale ──
  const facesBlock = (p) => { const k = Number(p.street.slice(3)); return p.street.startsWith('ns') ? (p.side === 'w' ? k > 0 : k < C) : (p.side === 's' ? k > 0 : k < Rn); };
  for (const p of d.pieces) {
    if ((p.cls !== 'verge' && p.cls !== 'furnish') || !facesBlock(p)) continue;
    const [x0, y0, x1, y1] = p.rect, ax = x1 - x0 > y1 - y0, len = ax ? x1 - x0 : y1 - y0, R = streamOf(seed, 'green', `street:${p.street}:${p.seg}:${p.side}`), pits = p.cls === 'furnish';
    // (a boulevard's trees at its streetscape's stride, its share of them planted, none at a drive's kerb cut; a main
    // street's pits at the pattern's; a major street's sparse, `major.trees`)
    const major = d.streets.find((s) => s.id === p.street)?.rank === 'major' ? P.major?.trees : null, cut = d.parking?.cuts?.[`${p.street}:${p.side}`] ?? [];
    const stride = major ? major.stride : pits ? P.grow.stride : P.trees?.stride ?? P.grow.stride, share = major ? major.share : pits ? 1 : P.trees?.share ?? 1;
    if (!(share > 0)) continue;
    for (let s = 3 + R() * stride * 0.6; s < len - 3; s += stride * (0.85 + 0.3 * R())) {
      const x = ax ? x0 + s : (x0 + x1) / 2, y = ax ? (y0 + y1) / 2 : y0 + s, sp = P.grow.street[Math.floor(R() * P.grow.street.length)];
      if (R() >= share || cut.some(([c0, c1]) => (ax ? x : y) > c0 - 1 && (ax ? x : y) < c1 + 1)) continue;
      grows(sp, x, y, wk(x, y), treeH(sp, 0.3 + 0.5 * R(), 16), p.cls);
      // (a main street's tree stands in its pit, under a grate)
      if (pits) { const g = 0.6; put([[x - g, y - g], [x + g, y - g], [x + g, y + g], [x - g, y + g]].map(([a, b]) => [a, b, wk(a, b) + 0.01]), 'geotown:pit', col.pit); }
    }
  }
  // ── the parked cars: a car in most stalls of each parking lane, at the kerb, along its street ──
  let parked = 0;
  for (const L of d.parking?.lanes ?? []) {
    const Rl = streamOf(seed, 'parking', `lane:${L.street}:${L.seg}:${L.side}`), [x0, y0, x1, y1] = L.rect;
    for (const [s0, s1] of L.stalls) {
      const take = Rl() < P.parking.share, s = (s0 + s1) / 2 + (Rl() - 0.5) * 0.6, hex = CAR_PAINTS[Math.floor(Rl() * CAR_PAINTS.length)];
      if (!take) continue;
      const [x, y] = L.axis === 'y' ? [(x0 + x1) / 2, s] : [s, (y0 + y1) / 2], z = S(x, y);
      for (const f of carOf(0, 0, L.axis === 'y' ? 'v' : 'u', hex)) put(f.corners.map(([u, v, zz]) => [x + u, y + v, z + zz]), `geotown:${f.role}`, f.hex ?? col[f.role] ?? col.metal, f.out);
      parked++;
    }
  }
  for (const pl of d.plots) {
    if (!pl.built || evoked || pl.rear !== 'back') continue;
    const back = pl.d - pl.setback - pl.house.depth;
    if (back < 5) continue;
    const R = streamOf(seed, 'green', `back:${pl.id}`), [lo, hi] = P.grow.back, n = Math.min(hi, lo + Math.floor(R() * (hi - lo + 1)));
    for (let k = 0; k < n; k++) {
      const u = 1.5 + R() * (pl.w - 3), v = pl.setback + pl.house.depth + 3 + R() * Math.max(0, back - 5), [x, y] = W(pl, u, v, 0);
      const sp = P.grow.trees[Math.floor(R() * P.grow.trees.length)];
      grows(sp, x, y, pl.pad, treeH(sp, 0.25 + 0.5 * R()), 'back');
    }
  }
  // ── the views: down a street of houses from its walk, a house from its walk, the main street, the back yards, over ──
  const cam = (name, from, to, fov) => ({ name, worldFraming: { cameraPosition: P3(from), lookAt: P3(to), horizontalFov: fov } });
  const rowWith = (kind) => { for (const B of d.blocks) for (const rp of rowsOf(B)) if (rp.length && rp[0].kind === kind && rp[0].built) return { B, rp }; return null; };
  const H0 = rowWith('houses'), S0 = rowWith('shops'), B0 = H0?.B ?? S0?.B ?? d.blocks[0], zMean = (d.land.range[0] + d.land.range[1]) / 2;
  // (along a row's walk: from before its first plot, along its frontage, toward its buildings)
  const along = ({ B, rp }, name, ahead) => {
    const p = rp[0], q = rp[Math.min(rp.length - 1, Math.max(1, Math.floor(rp.length / 2)))], ws = lineOf(d, B, p.side).S.walk;
    const e = [p.A[0] - p.ey[0] * ws / 2 - p.ex[0] * 6, p.A[1] - p.ey[1] * ws / 2 - p.ex[1] * 6], t = W(q, q.w / 2, q.setback + 2, 0);
    return cam(name, [...e, wk(...e) + 1.7], [t[0] + p.ex[0] * ahead, t[1] + p.ex[1] * ahead, wk(...e) + 2.9], 70);
  };
  const cameras = [];
  if (H0) {
    cameras.push(along(H0, 'street', 20));
    // a house from its walk, a few metres along it (between its street's trees and its front yard)
    // (from the walk, or out at the kerb where the house stands close to it)
    const q = H0.rp[Math.floor(H0.rp.length / 2)], Sq = lineOf(d, H0.B, q.side).S, ws = Math.min(Sq.walk + Sq.verge + 1, Math.max(Sq.walk / 2, 7 - q.setback)), e = [q.A[0] - q.ey[0] * ws - q.ex[0] * 4, q.A[1] - q.ey[1] * ws - q.ex[1] * 4], t = W(q, q.w / 2, q.setback + 2, 0);
    cameras.push(cam('house', [...e, wk(...e) + 1.6], [t[0], t[1], q.pad + 3.5], 66));
  }
  if (S0) cameras.push(along(S0, 'main', 26));
  const V0 = rowWith('avenue');
  if (V0) cameras.push(along(V0, 'avenue', 24));
  // a school from the walk across its street, its doors before it; a site's fields from beyond its corner, over its trees
  const Sb = d.blocks.find((b) => b.site?.type === 'school'), Sl = Sb && d.plots.find((pl) => pl.block === Sb.id && pl.kind === 'school');
  if (Sl) {
    const Sq = lineOf(d, Sb, Sl.side).S, e = W(Sl, Sl.w / 2 - 16, -(Sq.row - Sq.walk / 2), 0), t = W(Sl, Sl.w / 2, Sl.setback + 4, 0);
    cameras.push(cam('school', [e[0], e[1], wk(e[0], e[1]) + 1.7], [t[0], t[1], Sl.pad + 6], 70));
  }
  const Fb = d.blocks.find((b) => b.site?.what?.diamond) ?? d.blocks.find((b) => b.site?.what?.track) ?? d.blocks.find((b) => b.site?.what?.pitch);
  if (Fb) {
    const St = Fb.site, Wl = (u, v) => [St.A[0] + St.ex[0] * u + St.ey[0] * v, St.A[1] + St.ex[1] * u + St.ey[1] * v], p = St.what.pitch, e = Wl(-12, St.D + 12), t = Wl((p[0] + p[2]) / 2, (p[1] + p[3]) / 2);
    cameras.push(cam('field', [e[0], e[1], Fb.z + 30], [t[0], t[1], Fb.z], 62));
  }
  // a mansion from its street's walk, a little along: its lawn before it, its drive beside it
  const Mq = d.plots.find((pl) => pl.form === 'mansion' && pl.built);
  if (Mq) {
    const B = d.blocks.find((b) => b.id === Mq.block), ws = lineOf(d, B, Mq.side).S.walk, e = [Mq.A[0] - Mq.ey[0] * ws / 2 - Mq.ex[0] * 9, Mq.A[1] - Mq.ey[1] * ws / 2 - Mq.ex[1] * 9], t = W(Mq, Mq.w / 2, Mq.house.env[1] + 4, 0);
    cameras.push(cam('mansion', [...e, wk(...e) + 1.7], [t[0], t[1], Mq.pad + 5], 68));
  }
  if (evoked && H0) {
    // over the back yards from beyond the back line's end, above their trees
    const p = H0.rp[0], z = Math.max(...H0.rp.map((pl) => pl.pad)), e = W(p, -8, p.d, 0), t = W(H0.rp[H0.rp.length - 1], H0.rp[H0.rp.length - 1].w * 0.5, p.d - 4, 0);
    cameras.push(cam('yards', [e[0], e[1], z + 26], [t[0], t[1], z], 66));
    // a yard from its house's back window, looking down it to its back fence (one with something in its middle)
    const Yq = H0.rp.find((pl) => /trampoline|play|pool/.test(pl.yard ?? '')) ?? H0.rp.find((pl) => pl.yardV0 !== undefined);
    if (Yq?.yardV0 !== undefined) { const a = W(Yq, Yq.w / 2, Yq.yardV0 + 0.6, 0), b = W(Yq, Yq.w / 2, Yq.d - 1, 0); cameras.push(cam('yard', [a[0], a[1], Yq.pad + 7.5], [b[0], b[1], Yq.pad], 70)); }
  }
  const span = Math.max(FW, FD), one = d.blocks.length === 1;
  cameras.push(one ? cam('aerial', [B0.rect[0] - 28, B0.rect[1] - 34, zMean + 38], [(B0.rect[0] + B0.rect[2]) / 2, (B0.rect[1] + B0.rect[3]) / 2, zMean], 55) : cam('aerial', [-0.18 * FW, -0.22 * FD, zMean + 0.45 * span], [FW * 0.5, FD * 0.45, zMean], 58));
  const eye = cameras[0].worldFraming.cameraPosition;
  // ── the trees, grown and stamped at the detail the views see them at ──
  const repeats = [], textures = {}, eyes = cameras.map(({ worldFraming: wf }) => ({ pos: wf.cameraPosition, focalPx: (TREE_EYE * 1280) / (2 * Math.tan((wf.horizontalFov * Math.PI) / 360)) }));
  // each tree held to its ROOM: its crown's reach (its species' widest crown over its height, measured on its grown
  // variants) and a gap short of every building's footprint (its porch, bay and awning in it); one that has not room to
  // stand twice a person's height is not planted
  const footprints = colliders.filter((c) => c.of.endsWith(':house')).map((c) => [c.min[0], c.min[1], c.max[0], c.max[1]]);
  const roomAt = (x, y) => footprints.reduce((a, [x0, y0, x1, y1]) => Math.min(a, Math.hypot(Math.max(0, x0 - x, x - x1), Math.max(0, y0 - y, y - y1))), Infinity);
  const pools = {}, kept = {};
  let crowded = 0, nearest = Infinity;
  for (const sp of Object.keys(items).sort()) {
    const pool = plantPool({ species: sp, variants: 2, seed: `geotown::${sp}`, light: LIGHT, maxLevel: 'L2', group: `geotown:tree-${sp}` });
    const reach = Math.max(...pool.variants.map((v) => { const T = v.levels?.L1 ?? []; let r = 0, h = 0; for (const f of T) for (const c of f.corners) { r = Math.max(r, Math.hypot(c[0], c[1])); h = Math.max(h, c[2]); } return h > 0 ? r / h : 0.5; }));
    pools[sp] = pool;
    kept[sp] = [];
    for (const it of items[sp]) {
      const h = Math.min(it.height, (roomAt(it.x, it.y) - TREE_GAP) / reach);
      if (h < TREE_LEAST) { crowded++; continue; }
      kept[sp].push({ ...it, height: r5(h) });
      nearest = Math.min(nearest, roomAt(it.x, it.y) - reach * h);
    }
  }
  // (each species its share of the budget, by how many of the trees it is)
  const all = Object.values(kept).reduce((a, l) => a + l.length, 0) || 1, growth = {};
  let treeFaces = 0;
  for (const sp of Object.keys(kept).sort()) {
    if (!kept[sp].length) continue;
    for (const it of kept[sp]) growth[it.on] = (growth[it.on] ?? 0) + 1;
    const pool = pools[sp];
    const placed = plantRepeats(pool, kept[sp].map(({ on, ...it }) => it), { eyes, level: 'L2', budget: Math.round((TREE_FACES * kept[sp].length) / all), sink: 0.05 });
    treeFaces += placed.stats.drawnFaces;
    repeats.push(...placed.repeats);
    Object.assign(textures, pool.textures || {});
  }
  // ── the route round the first block's walks (the dummy's), from its far corner ──
  const sx0 = d.sections.x[B0.i], sx1 = d.sections.x[B0.i1 + 1], sy0 = d.sections.y[B0.j], sy1 = d.sections.y[B0.j1 + 1];
  const xa = d.X[B0.i] + sx0.half - sx0.walk / 2, xb = d.X[B0.i1 + 1] - sx1.half + sx1.walk / 2, ya = d.Y[B0.j] + sy0.half - sy0.walk / 2, yb = d.Y[B0.j1 + 1] - sy1.half + sy1.walk / 2;
  const ring = [[xa, ya], [xb, ya], [xb, yb], [xa, yb]], route = [];
  for (let k = 0; k < 4; k++) { const p = ring[k], q = ring[(k + 1) % 4], n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 2)); for (let i = 0; i < n; i++) { const x = p[0] + ((q[0] - p[0]) * i) / n, y = p[1] + ((q[1] - p[1]) * i) / n; route.push(P3([x, y, wk(x, y)])); } }
  route.push(route[0]);
  const half0 = Math.floor(route.length / 2), routeFrom = [...route.slice(half0, -1), ...route.slice(0, half0 + 1)];
  // ── the laws the scene adds: nothing grows on a hard surface (a main street's pits its own); the faces' budget ──
  const budget = evoked ? Math.max(SEGMENT_FACES * d.blocks.length, BUILDING_FACES * built) : GEOTOWN_FACES;
  const hard = Object.entries(growth).filter(([on]) => !(SURFACES[on]?.grows ?? []).some((g) => g === 'tree' || g === 'street-tree')).reduce((a, [, n]) => a + n, 0);
  const laws = [...d.laws,
    { law: 'bare', ok: hard === 0, value: `trees ${Object.entries(growth).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}; ${hard} on a hard surface`, want: 'nothing grows on a road, a walk, a path, a side yard or a building\'s footprint' },
    { law: 'room', ok: nearest >= TREE_GAP - 1e-6, value: `every crown at least ${Number.isFinite(nearest) ? Math.round(nearest * 100) / 100 : '—'} m off a building; ${crowded} trees without room to stand ${TREE_LEAST} m not planted`, want: 'no tree\'s crown reaches into a building: each held to its room, at least twice a person\'s height' },
    { law: 'faces', ok: faces.length <= budget, value: `${faces.length} faces (budget ${budget}); trees ${treeFaces} faces as repeats`, want: 'only what the map needs is drawn' }];
  const night = lit.night, bg = night ? air.fog.color : rgbToHex(air.dome.horizon);
  const counts = { plots: d.plots.length, buildings: built, ...builtOf, hedges, gated, parked, pads: d.parking?.pads ?? 0, padCars, trees: Object.values(kept).reduce((a, l) => a + l.length, 0), crowded, faces: faces.length, treeFaces };
  return {
    faces, repeats, ...(Object.keys(textures).length ? { textures } : {}), colliders, anchors, cameras,
    viewBox: { width: 1280, height: 720 }, title: ctx.title || `${cube.title} · geotown`,
    bg, haze: { color: air.fog.color, density: r5(air.fog.density * TOWN_HAZE) },
    sky: { zenith: air.dome.zenith, horizon: air.dome.horizon, day: night ? 0 : 1, stars: 0, seed: 1, ...(night ? {} : { sun: { dir: P3(sun), size: 1.4, glow: 1.3 } }), ...(spec.air ? hourSky(spec.air) : {}) },
    walk: m.walk === false ? false : { speed: 6, spawn: P3(eye), minEye: 1.7, gravity: 22, radius: 0.4 },
    route: routeFrom,
    geocube: { ...geocubeReadout(cube, 'geotown', null, m), ...(style ? { style: styleReadout(style) } : {}) },
    geotown: {
      pattern: d.pattern.id, streetscape: d.pattern.streetscape, evoke: d.spec.evoke, grid: d.spec.grid, frame: d.frame, land: d.land.range, language: L.id ?? anchor,
      segments: d.blocks.map((b) => { const pads = d.plots.filter((pl) => pl.block === b.id).map((pl) => pl.pad); return { id: b.id, use: b.use, built: b.built, rows: (b.rows ?? []).map((r) => ({ side: r.side, kind: r.kind, count: r.count })), ...(pads.length ? { pads: [Math.min(...pads), Math.max(...pads)] } : {}) }; }),
      ports: d.ports, counts, ledger: d.ledger, laws: laws.map((l) => ({ law: l.law, ok: l.ok, value: l.value })),
      ...(evoked ? { stands: d.evoked.stands, shows: d.evoked.shows, yards: Object.fromEntries(d.plots.filter((pl) => pl.yard).map((pl) => [pl.id, pl.yard])), features: yardsOf } : {}),
    },
  };
}
