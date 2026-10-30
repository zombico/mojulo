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
 *   evoked     an evocation (metro.js EVOKES, design.js `evoked`): its blocks at a building's detail, each core and frame
 *              mass a lot the facade pipeline wears (city/plan/facades.js skinLot: curtainwall, punched stone, brick,
 *              a tower's shape; its windows lit at night on the facades' own grids, night.js), brought back from its
 *              units to metres; the neighbourhoods round them as massing; the rest of the metro its skyline (each
 *              neighbourhood one coarse drape, its tall buildings, its low fabric a flat mass along each long side).
 *              Seen first from over what it evokes and from its own street, where its walk starts
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
import { skinLot } from '../city/plan/facades.js';
import { nightFaces } from '../city/plan/night.js';
import { ORGANIC_SHAPES } from '../city/plan/organic.js';
import { assembleBoxCityScene } from '../scene/scene-css3d.js';
import { kitTemplates } from './kit.js';
import { materialContext, wordTile } from '../era/arch-style.js';
import { dressTownFace } from '../era/town-dress.js';
import { plantPool, plantRepeats } from '../vegetation/pool.js';
import { litFactor } from '../polygonizer/vexar.js';

export const GEOCITY_KEYS = Object.freeze(['kind', 'cube', 'show', 'title', 'seed', 'hour', 'clouds', 'geocity', 'walk', 'shadows', 'occlusion', 'light']);
export const GEOCITY_FACES = 200000;
// the cells streets and grounds are draped on the land in (m), a kerb's height, a sidewalk round a block, a terrace's
// most step to the next
const CELL = 40, KERB = 0.15, WALK = 2.4, STEP = 1.2;
// an outskirts house: a semi pair's frontage, the gap between pairs, its depth, its front yard; a storey; a shop's depth
const PAIR = 13.6, GAP = 1.4, HOUSE_D = 12, SETBACK = 5, STOREY = 3, SHOP_D = 14;
// the skyline's ground cells (m); what it draws of a neighbourhood (its tall buildings); what a block at detail wears
// facades on (the core's and the frame's: an outskirts block keeps its massing until it is a geotown's)
// the street's kit: drawn within NEAR metres of the camera (the page's near repeats), a lamp every LAMP metres along a
// kerb (the metro's stride, fractal-city.js METRO_LAMP_STEP), a streetcar's poles every POLE
const NEAR = 320, LAMP = 31, POLE = 35;
// the furniture's strides (m): a hydrant, a bench and its bike rings, a residential street's hydro poles
const HYDRANT = 90, BENCH = 70, HYDRO = 38;
// the ground and the masses in their material words (era/arch-style.js MATERIAL_WORDS), laid as tiles (texel × light):
// a floor's on a face that lies flat, a wall's on an upright one; each word's seed its own
const FINISHES = Object.freeze({
  'geocity:road': ['asphalt', 'floor'], 'geocity:walk': ['pavement', 'floor'], 'geocity:paving': ['flags', 'floor'], 'geocity:streetcar-row': ['setts', 'floor'],
  'geocity:platform': ['pavement', 'floor'], 'geocity:site': ['gravel', 'floor'], 'geocity:lot': ['asphalt', 'floor'], 'geocity:retain': ['sawn-stone', 'wall'], 'geocity:house': ['wire-brick', 'wall'], 'geocity:shops': ['wire-brick', 'wall'],
  'geocity:avenue': ['wire-brick', 'wall'], 'geocity:midrise': ['wire-brick', 'wall'], 'geocity:lowrise': ['wire-brick', 'wall'], 'geocity:walkup': ['wire-brick', 'wall'],
  'geocity:school': ['wire-brick', 'wall'], 'geocity:podium': ['sawn-stone', 'wall'], 'geocity:slab': ['precast', 'wall'],
});
// a glass tower's sheen: the specular channel's strength and power (scene/channels/specular.js)
const GLASS_SPEC = Object.freeze([0.55, 48]);
// street trees: a pit's stride along a close-built arterial, a verge's along an outskirts street, their species, the
// height they are grown to (m), the detail their template keeps and its faces' budget
const TREE = Object.freeze({ pit: 12, verge: 11, species: { dense: ['maple', 'beech'], low: ['maple', 'cherry'] }, height: [12, 17], level: 'L1', budget: 400000, raise: 0.42 });
const FAR_CELL = 160, TALL = Object.freeze(['tower', 'podium', 'midrise', 'slab']), DETAILED = Object.freeze(['tower', 'podium', 'midrise', 'slab']);

const r5 = (v) => Math.round(v * 1e5) / 1e5 + 0;
const P3 = (p) => p.map(r5);
const newell = (c) => { const n = [0, 0, 0]; for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); } const l = Math.hypot(...n) || 1; return n.map((v) => v / l); };
const mix = (a, b, t) => rgbToHex(hexToRgb(a).map((v, i) => v + (hexToRgb(b)[i] - v) * t));
const no = (msg) => { throw new Error(`geocube: ${msg}`); };
/** Cut [a, b] into pieces no longer than `step`, at least one. */
const cuts = (a, b, step) => { const n = Math.max(1, Math.ceil((b - a) / step - 1e-9)); return Array.from({ length: n + 1 }, (_, k) => a + ((b - a) * k) / n); };

// the outskirts' palettes: brick and its trim, a shop's front, a roof
// a parked car's paint as an instance's tint (linear rgb over its pale body): geotown/yards.js CAR_PAINTS
const linC = (h) => [1, 3, 5].map((k) => { const c = parseInt(h.slice(k, k + 2), 16) / 255; return Math.round((c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4) * 1e4) / 1e4; });
const CAR_TINTS = Object.freeze(['#8a2a2a', '#2a3f6a', '#d8d6d0', '#3a3d42', '#6a6f75', '#2f5a3a', '#c9b48a'].map(linC));
const HOUSE_BRICK = Object.freeze(['#a3563f', '#b5654a', '#9c4b36', '#c9a57a', '#d2c3a8', '#8c5a44']);
const SHOP_FRONT = Object.freeze(['#8a3a2e', '#3e5e3a', '#24405e', '#6e5a3a', '#7a2e4a']);
const ROOFS = Object.freeze(['#4a4f55', '#5b4a3f', '#3f4448', '#6a5a4c']);

function coloursOf(cube) {
  const C = cube.colour;
  return {
    road: mix('#4d5055', C.floor, 0.15), walk: mix('#c8c2b4', C.stone, 0.3), kerb: mix('#b3ad9f', C.stone, 0.3), retain: mix('#9a9284', C.stone, 0.5),
    lawn: C.grass, park: mix(C.grass, C.foliage, 0.12), plaza: mix('#bdb6a8', C.stone, 0.3), lot: mix('#6a6c70', C.floor, 0.1), field: mix(C.grass, '#3f8a34', 0.4),
    water: mix('#3e6a84', C.sky ?? '#6f97b8', 0.25), court: mix(C.grass, C.foliage, 0.25), bike: '#3f8a5a', site: mix('#8a7a62', C.floor, 0.2), scrub: mix('#8a8a5a', C.grass, 0.35), row: mix('#8a8780', C.stone, 0.2), platform: mix('#bdb6a8', C.stone, 0.2),
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
  // (the finishes in the cube's material context, each a tile; geotown/scene.js finishesOf)
  const MX = materialContext(cube), FIN = {};
  Object.entries(FINISHES).forEach(([group, [word, as]], k) => { const T = wordTile(word, MX, 211 + 17 * k); if (T) FIN[group] = { spec: T.spec, metres: T.metres, ...(as === 'floor' ? { floor: true } : {}) }; });
  const col = coloursOf(cube), faces = [], counts = { towers: 0, buildings: 0, houses: 0, panes: 0, detailed: 0 };
  const put = (corners, group, hex, want = null) => {
    let c = corners, n = newell(c);
    if (want && n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0) { c = c.slice().reverse(); n = n.map((x) => -x); }
    if (!want && n[2] < 0) { c = c.slice().reverse(); n = n.map((x) => -x); }
    const fill = shadeHex(hex, n, LIGHT), F0 = { corners: c.map(P3), normal: P3(n), outNormal: P3(n), group, fill, cornerFills: c.map(() => fill) }, E = FIN[group];
    faces.push(E && (E.floor ? Math.abs(n[2]) > 0.7 : Math.abs(n[2]) < 0.3) ? dressTownFace(F0, group, FIN) : F0);
  };
  // the street's kit stamped where it stands: each template's transforms, drawn near the camera only
  const KIT = kitTemplates(LIGHT, { gauge: d.metro.roads.streetcar.gauge }), stamps = new Map();
  const stamp = (key, pos, rotZ, scale = null) => { if (!stamps.has(key)) stamps.set(key, []); stamps.get(key).push({ pos: P3(pos), ...(rotZ ? { rotZ: r5(rotZ) } : {}), ...(scale ? { scale } : {}) }); };
  const templateOf = (key) => { const [k, f] = key.split(':'); return f ? KIT[k][f] : KIT[k]; };
  // the street trees, by species, grown after the cameras (their detail is what the cameras see)
  const trees = new Map();
  const plant = (where, x, y, z, key) => {
    const R = streamOf(seed, 'trees', key), list = TREE.species[where], sp = list[Math.floor(R() * list.length)];
    if (!trees.has(sp)) trees.set(sp, []);
    trees.get(sp).push({ x: r5(x), y: r5(y), z0: r5(z), height: r5(TREE.height[0] + (TREE.height[1] - TREE.height[0]) * R()) });
  };
  // a pane no light shades (a lit room at night)
  const pane = (corners, n, hex) => { faces.push({ corners: corners.map(P3), normal: P3(n), outNormal: P3(n), group: 'geocity:night-window', fill: hex, cornerFills: corners.map(() => hex) }); counts.panes++; };
  // a rect draped on the land at `lift` over it, in cells
  const drape = (r, group, hex, lift = 0, cell = CELL) => {
    const xs = cuts(r[0], r[2], cell), ys = cuts(r[1], r[3], cell);
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

  // ── the arterials, each by its own cross-section (roads.js): a road between two walks; its spacer a planted median
  // (or the streetcars' right-of-way) over a kerb; a bike lane painted; a north-south one between the east-west ones'
  // rights-of-way, an east-west one over the crossings ──
  const sec = d.section, NS = d.lines.filter((l) => l.axis === 'ns'), EW = d.lines.filter((l) => l.axis === 'ew'), [lx0, ly0, lx1, ly1] = d.land.rect;
  const runsOf = (spans, lo, hi) => { const out = []; let at = lo; for (const [a, b] of spans.slice().sort((p, q) => p[0] - q[0])) { if (a > at) out.push([at, a]); at = Math.max(at, b); } if (hi > at) out.push([at, hi]); return out; };
  const runsNS = runsOf(EW.map((l) => [l.at - l.half, l.at + l.half]), ly0, ly1), runsEW = runsOf(NS.map((l) => [l.at - l.half, l.at + l.half]), lx0, lx1);
  const across = (l, a, b, p, q) => (l.axis === 'ns' ? [l.at + a, p, l.at + b, q] : [p, l.at + a, q, l.at + b]);
  for (const l of d.lines) {
    const R2 = l.road / 2;
    for (const [p, q] of l.axis === 'ns' ? runsNS : [[lx0, lx1]]) {
      drape(across(l, -R2, R2, p, q), 'geocity:road', col.road);
      drape(across(l, -l.half, -R2, p, q), 'geocity:walk', col.walk, KERB); drape(across(l, R2, l.half, p, q), 'geocity:walk', col.walk, KERB);
      for (const b of l.bands) {
        if (b.kind === 'median') drape(across(l, b.from, b.to, p, q), 'geocity:median', col.lawn, KERB);
        else if (b.kind === 'streetcar-row') drape(across(l, b.from, b.to, p, q), 'geocity:streetcar-row', col.row, 0.06);
        else if (b.kind === 'bike') drape(across(l, b.from, b.to, p, q), 'geocity:bike', col.bike, 0.03);
      }
    }
  }

  // ── each neighbourhood: its ground (its streets), a walk round each block, each block's terraced pad and buildings ──
  const glass = G.skin.glass, stone = G.skin.stone, brick = G.skin.brick, roofs = G.skin.roof, office = G.floorH.office, resid = G.floorH.residential;
  const famOf = (fams, id) => fams[strHash(id) % fams.length];
  let firstBlock = null;
  // an evocation's tiers: its blocks at a building's detail, the neighbourhoods round them as massing, the rest its
  // skyline (each neighbourhood's ground one coarse drape, its tall buildings on it, nothing low)
  const E = d.evoked, detail = new Set(E?.blocks ?? []), massed = E ? new Set(E.regions) : null, lots = [];
  for (const r of d.regions) {
    if (massed && !massed.has(r.id)) { backdrop(r); continue; }
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
      const padHex = b.kind === 'park' ? col.park : ['tower', 'podium', 'square', 'midrise'].includes(b.kind) ? col.plaza : b.kind === 'construction' ? col.site : b.kind === 'parking' ? col.lot : b.kind === 'vacant' ? col.scrub : col.lawn;
      const padGroup = padHex === col.plaza ? 'geocity:paving' : { construction: 'geocity:site', parking: 'geocity:lot', vacant: 'geocity:scrub' }[b.kind] ?? 'geocity:pad';
      terraces.forEach((t, k) => {
        const [a0, b0, a1, b1] = t.q;
        put([[a0, b0, t.z], [a1, b0, t.z], [a1, b1, t.z], [a0, b1, t.z]], padGroup, padHex);
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
      if (detail.has(b.id) && DETAILED.includes(b.kind)) detailed(b, { x0, y0, x1, y1, zAt, Rb });
      else building(b, { x0, y0, x1, y1, longY, zAt, Rb });
    }
  }

  /** THE STREET, NEAR (kit.js): along every arterial its paint (lane lines dashed between lanes one way, a double
   *  yellow between a two-way street's directions where no spacer parts them, solid white at its parking and bike
   *  lanes), its streetcars' rails and overhead (a pole at each kerb, a span across, a contact wire over each track),
   *  its lamps at both kerbs (the metro's stride, staggered); at each crossing its crosswalks, a signal on each corner
   *  (the metro's: every crossing signalled), a street-name sign, and on a streetcar line a stop each way past it (a
   *  platform down a right-of-way). All stamped as repeats drawn only near the camera: from far the blocks suffice. */
  function street() {
    const lift = 0.05, at = (l, off, s) => (l.axis === 'ns' ? [l.at + off, s] : [s, l.at + off]), rotAlong = (l) => (l.axis === 'ns' ? Math.PI / 2 : 0);
    const flat = (key, l, off, s) => { const [x, yy] = at(l, off, s); stamp(key, [x, yy, S(x, yy) + lift], rotAlong(l)); };
    for (const l of d.lines) {
      const runs = l.axis === 'ns' ? runsNS : runsEW, bands = l.bands.slice().sort((a, b) => a.from - b.from);
      // the lines between bands
      const marks = [];
      for (let i = 0; i + 1 < bands.length; i++) {
        const a = bands[i], b = bands[i + 1], off = a.to;
        if (a.kind === 'travel' && b.kind === 'travel') marks.push([a.dir === b.dir ? 'dash' : 'yellow', off]);
        else if ((a.kind === 'travel') !== (b.kind === 'travel') && ![a.kind, b.kind].some((k) => k === 'median' || k === 'streetcar-row')) marks.push(['line', off]);
      }
      for (const [p, q] of runs) for (const [key, off] of marks) {
        const step = key === 'dash' ? 9 : 10;
        for (let s0 = p + 1; s0 + step <= q - 1 + 1e-6; s0 += step) flat(key, l, off, s0);
      }
      // the streetcars: rails end to end (over the crossings too), and the overhead between kerb poles
      if (l.tracks.length) {
        const lo = l.axis === 'ns' ? ly0 : lx0, hi = l.axis === 'ns' ? ly1 : lx1;
        for (const t of l.tracks) for (let s0 = lo; s0 + 10 <= hi; s0 += 10) flat('rail', l, t.at, s0);
        for (const [p, q] of runs) for (let s0 = p + 6; s0 + POLE <= q; s0 += POLE) {
          for (const side of [-1, 1]) { const [x, yy] = at(l, side * (l.road / 2 + 0.3), s0); stamp(`pole:${facing(l, -side)}`, [x, yy, S(x, yy) + KERB], 0); }
          const [x0w, y0w] = at(l, -(l.road / 2 + 0.3), s0);
          stamp('wire', [x0w, y0w, S(x0w, y0w) + 6.45], l.axis === 'ns' ? 0 : Math.PI / 2, [l.road + 0.6, 1, 1]);
          for (const t of l.tracks) { const [x, yy] = at(l, t.at, s0); stamp('wire', [x, yy, S(x, yy) + 5.6], rotAlong(l), [POLE, 1, 1]); }
        }
      }
      // its lamps at both kerbs, staggered, clear of the crossings
      for (const [p, q] of runs) for (const side of [-1, 1]) for (let s0 = p + 8 + (side > 0 ? LAMP / 2 : 0); s0 <= q - 8; s0 += LAMP) {
        const [x, yy] = at(l, side * (l.road / 2 + 0.5), s0);
        stamp(`lamp:${facing(l, -side)}`, [x, yy, S(x, yy) + KERB], 0);
      }
      // its furniture: a bin by each crossing at each kerb, a hydrant along one, and where the city is close-built
      // (the core, the frame) benches, bike rings and, at a corner, newspaper boxes
      const kerb = (side, o, s0, key, rot = 0) => { const [x, yy] = at(l, side * (l.road / 2 + o), s0); stamp(key, [x, yy, S(x, yy) + KERB], rot); };
      const dense = (s0) => { const [x, yy] = at(l, 0, s0); return d.heights.storeysAt(x, yy).ring !== 'outskirts'; };
      for (const [p, q] of runs) {
        if (q - p < 30) continue;
        for (const side of [-1, 1]) { kerb(side, 1.4, p + 12, 'bin'); kerb(side, 1.4, q - 12, 'bin'); }
        for (let s0 = p + 25; s0 <= q - 20; s0 += HYDRANT) kerb(1, 0.9, s0, 'hydrant');
        for (let s0 = p + 40; s0 <= q - 30; s0 += BENCH) if (dense(s0)) for (const side of [-1, 1]) {
          kerb(side, l.half - l.road / 2 - 1.1, s0, `bench:${facing(l, -side)}`);
          for (let k = 0; k < 3; k++) kerb(side, 1.6, s0 + 9 + k * 1.3, 'ring', l.axis === 'ns' ? Math.PI / 2 : 0);
        }
        if (dense(p + 6)) kerb(-1, l.half - l.road / 2 - 0.7, p + 6, `papers:${facing(l, 1)}`);
        // its street trees in their pits, where the city is close-built, clear of its lamps
        for (const side of [-1, 1]) for (let s0 = p + 14 + (side > 0 ? TREE.pit / 2 : 0); s0 <= q - 10; s0 += TREE.pit) {
          const lampAt = (s0 - (p + 8 + (side > 0 ? LAMP / 2 : 0))) % LAMP;
          if (!dense(s0) || lampAt < 2 || lampAt > LAMP - 2) continue;
          kerb(side, 1.3, s0, 'pit');
          const [x, yy] = at(l, side * (l.road / 2 + 1.3), s0);
          plant('dense', x, yy, S(x, yy) + KERB, `${l.id}:${side}:${Math.round(s0)}`);
        }
      }
    }
    // the crossings
    for (const a of NS) for (const b of EW) {
      const x = a.at, yy = b.at, z = S(x, yy);
      // crosswalks across each arm, just outside the crossing; stop bars behind them
      for (const sy of [-1, 1]) for (let o = -a.road / 2 + 0.6; o <= a.road / 2 - 0.6; o += 1.2) stamp('bar', [x + o, yy + sy * (b.half + 0.6) + (sy < 0 ? -3 : 0), z + lift], Math.PI / 2);
      for (const sx of [-1, 1]) for (let o = -b.road / 2 + 0.6; o <= b.road / 2 - 0.6; o += 1.2) stamp('bar', [x + sx * (a.half + 0.6) + (sx < 0 ? -3 : 0), yy + o, z + lift], 0);
      // a signal on each corner, the diagonal pairs reaching over the two roads; a street-name sign on one
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        const px = x + sx * (a.road / 2 + 0.9), py = yy + sy * (b.road / 2 + 0.9), face = sx * sy > 0 ? (sx > 0 ? 'w' : 'e') : (sy > 0 ? 's' : 'n');
        stamp(`signal:${face}`, [px, py, S(px, py) + KERB], 0);
      }
      const gx = x + a.road / 2 + 1.6, gy = yy + b.road / 2 + 1.6;
      stamp('sign', [gx, gy, S(gx, gy) + KERB], 0);
      // a streetcar line's stops, each way past the crossing (its right-of-way's on a platform beside its track)
      for (const l of [a, b]) {
        if (!l.tracks.length) continue;
        const o = l === a ? b : a, row = l.bands.some((x2) => x2.kind === 'streetcar-row');
        for (const t of l.tracks) {
          const s0 = (l === a ? yy : x) + t.dir * (o.half + 4), side = Math.sign(t.at) || 1;
          if (row) {
            const pa = side * (Math.abs(t.at) - 0.9) , pb = side * (Math.abs(t.at) - 3.1), q0 = Math.min(s0, s0 + t.dir * 30), q1 = Math.max(s0, s0 + t.dir * 30);
            drape(across(l, Math.min(pa, pb), Math.max(pa, pb), q0, q1), 'geocity:platform', col.platform, 0.3);
            const [px, py] = at(l, (pa + pb) / 2, s0 + t.dir * 4);
            stamp(`stop:${facing(l, side)}`, [px, py, S(px, py) + 0.3], 0);
          } else {
            const [px, py] = at(l, side * (l.road / 2 + 0.8), s0);
            stamp(`stop:${facing(l, -side)}`, [px, py, S(px, py) + KERB], 0);
            const [bx2, by2] = at(l, side * (l.road / 2 + 2.6), s0 + t.dir * 6);
            stamp(`bench:${facing(l, -side)}`, [bx2, by2, S(bx2, by2) + KERB], 0);
          }
        }
      }
    }
  }
  /** Each built neighbourhood's own streets, near: in the outskirts a wooden hydro pole every HYDRO metres along one
   *  side (its crossarm, three wires on to the next, a lamp hung off it over the road), a hydrant along the other; in
   *  the core and the frame the metro's kerb lamps at both kerbs and a bin at each end; round a square benches facing
   *  its planting, bins at its corners, bollards along its edges. The skyline's neighbourhoods none. */
  function streetsNear() {
    for (const r of d.regions) {
      if (r.park || (massed && !massed.has(r.id))) continue;
      const low = r.builds === 'outskirts';
      for (const st of r.streets) {
        const ns = st.axis === 'ns', kerbOff = st.w / 2 - WALK + 0.4, pt = (side, s0, o = kerbOff) => (ns ? [st.at + side * o, s0] : [s0, st.at + side * o]);
        const side = streamOf(seed, 'scene', `hydro:${st.id}`)() < 0.5 ? -1 : 1;
        const face = (sd) => (ns ? (sd > 0 ? 'w' : 'e') : (sd > 0 ? 's' : 'n'));
        for (const [a, b] of st.runs) {
          if (b - a < 20) continue;
          if (low) {
            let prev = null;
            for (let s0 = a + 6; s0 <= b - 6; s0 += HYDRO) {
              const [x, yy] = pt(side, s0), z = S(x, yy) + KERB;
              stamp(`hydro:${face(side)}`, [x, yy, z], 0);
              if (prev) for (const o of [-0.9, 0, 0.9]) {
                const p0 = ns ? [prev[0] + o, prev[1]] : [prev[0], prev[1] + o];
                stamp('wire', [p0[0], p0[1], (prev[2] + z) / 2 + 10.05], ns ? Math.PI / 2 : 0, [HYDRO, 1, 1]);
              }
              prev = [x, yy, z];
            }
            for (let s0 = a + 30; s0 <= b - 10; s0 += HYDRANT) { const [x, yy] = pt(-side, s0); stamp('hydrant', [x, yy, S(x, yy) + KERB], 0); }
            // its trees on the verge each side (a streetcar suburb's boulevard), clear of its poles
            for (const sd of [-1, 1]) for (let s0 = a + 9 + (sd > 0 ? TREE.verge / 2 : 0); s0 <= b - 9; s0 += TREE.verge) {
              if (sd === side && Math.abs(((s0 - a - 6) % HYDRO + HYDRO) % HYDRO) < 2.5) continue;
              const [x, yy] = pt(sd, s0, st.w / 2 - WALK - 1.0);
              plant('low', x, yy, S(x, yy), `${st.id}:${sd}:${Math.round(s0)}`);
            }
          } else {
            for (const sd of [-1, 1]) for (let s0 = a + 8 + (sd > 0 ? LAMP / 2 : 0); s0 <= b - 8; s0 += LAMP) { const [x, yy] = pt(sd, s0); stamp(`lamp:${face(sd)}`, [x, yy, S(x, yy) + KERB], 0); }
            for (const s0 of [a + 6, b - 6]) { const [x, yy] = pt(1, s0, kerbOff + 0.8); stamp('bin', [x, yy, S(x, yy) + KERB], 0); }
          }
        }
      }
      for (const b of r.blocks.filter((x) => x.kind === 'square')) {
        const [x0, y0, x1, y1] = b.rect, e = Math.min(x1 - x0, y1 - y0) * 0.18, z = S((x0 + x1) / 2, (y0 + y1) / 2) + KERB;
        for (const [k, f] of [[[x0 + e - 1.2, null], 'e'], [[x1 - e + 1.2, null], 'w'], [[null, y0 + e - 1.2], 'n'], [[null, y1 - e + 1.2], 's']]) for (let t = 0.2; t < 0.81; t += 0.2) {
          const px = k[0] ?? x0 + e + (x1 - x0 - 2 * e) * t, py = k[1] ?? y0 + e + (y1 - y0 - 2 * e) * t;
          stamp(`bench:${f}`, [px, py, z], 0);
        }
        for (const [cx, cy] of [[x0 + 2, y0 + 2], [x1 - 2, y0 + 2], [x1 - 2, y1 - 2], [x0 + 2, y1 - 2]]) stamp('bin', [cx, cy, z], 0);
        for (let x = x0 + 2; x <= x1 - 2; x += 4) for (const yy of [y0 + 0.5, y1 - 0.5]) stamp('bollard', [x, yy, z], 0);
      }
    }
  }
  /** The way a kerb piece on `side` of a line reaches (toward its road: −side). */
  function facing(l, toward) { return l.axis === 'ns' ? (toward > 0 ? 'e' : 'w') : (toward > 0 ? 'n' : 's'); }

  /** A neighbourhood as the skyline sees it: its ground one coarse drape, its tall buildings standing on it. */
  function backdrop(r) {
    if (r.park) { drape(r.rect, 'geocity:park', col.park, 0, FAR_CELL); return; }
    drape(r.rect, 'geocity:ground', r.builds === 'outskirts' ? mix(col.lawn, col.road, 0.35) : mix(col.plaza, col.road, 0.5), 0, FAR_CELL);
    for (const b of r.blocks) {
      if (b.kind === 'park') continue;
      const [x0, y0, x1, y1] = b.rect, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, z = S(cx, cy) + KERB, longY = y1 - y0 >= x1 - x0;
      if (TALL.includes(b.kind) || b.kind === 'construction') { building(b, { x0, y0, x1, y1, longY, zAt: () => z, Rb: streamOf(seed, 'scene', b.id), far: true }); continue; }
      if (b.kind === 'parking' || b.kind === 'vacant') continue;
      // the low fabric as the skyline sees it: a flat mass along each long side, at the block's storeys
      const dp = Math.min(HOUSE_D + SETBACK, (longY ? x1 - x0 : y1 - y0) / 2 - 3), zt = z + Math.max(1, b.storeys.median) * STOREY + 1.5, hex = mix(HOUSE_BRICK[strHash(b.id) % HOUSE_BRICK.length], col.road, 0.25);
      if (dp < 6) continue;
      for (const q of longY ? [[x0 + SETBACK, y0 + 2, x0 + dp, y1 - 2], [x1 - dp, y0 + 2, x1 - SETBACK, y1 - 2]] : [[x0 + 2, y0 + SETBACK, x1 - 2, y0 + dp], [x0 + 2, y1 - dp, x1 - 2, y1 - SETBACK]]) box(q[0], q[1], q[2], q[3], z, zt, hex, ROOFS[0], 'geocity:low');
    }
  }

  /** A block at a building's detail: its masses as lots the facade pipeline wears (city/plan/facades.js), on their
   *  terraces; drawn together after, in the pipeline's units, and brought back to metres. */
  function detailed(b, { x0, y0, x1, y1, zAt, Rb }) {
    const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, med = b.storeys.median, zc = zAt(cx, cy);
    const inset = (share) => { const e = ((w + h) - Math.sqrt((w + h) ** 2 - 4 * w * h * (1 - share))) / 4; return [x0 + e, y0 + e, x1 - e, y1 - e]; };
    // the face it fronts: an arterial's side first, else its south
    const fs = ['s', 'n', 'w', 'e'].find((k) => b.sides[k]?.kind === 'arterial') ?? 's', front = { n: '+y', s: '-y', e: '+x', w: '-x' }[fs];
    const lot = (id, [a0, b0, a1, b1], z0, floors, floorH, skin, use, extra = {}) => lots.push({ id, x0: a0, y0: b0, x1: a1, y1: b1, z0, h: floors * floorH, floors, floorH, skin, use, front, shopfront: use !== 'residential', ...extra });
    if (b.kind === 'tower') {
      lot(`${b.id}:podium`, inset(0.62), zc, b.podium, office, 'stone', 'mixed');
      b.towers.forEach((t, k) => {
        const sh = Rb(), [s1, s2, s3] = G.tower.shapes, shape = sh < s1 ? 'setback' : sh < s2 ? 'box' : sh < s3 ? 'podium' : 'cylinder';
        lot(`${b.id}:t${k}`, t.rect, zAt((t.rect[0] + t.rect[2]) / 2, (t.rect[1] + t.rect[3]) / 2), t.storeys, office, Rb() < G.skin.towerGlass ? 'glass' : 'stone', 'office', { tower: true, shape, shopfront: false });
        counts.towers++;
      });
    } else if (b.kind === 'podium') lot(`${b.id}:podium`, inset(0.8), zc, Math.max(1, Math.round(med)), office, Rb() < 0.5 ? 'stone' : 'glass', 'office');
    else if (b.kind === 'midrise') {
      const dp = Math.min(14, w / 3, h / 3);
      put([[x0 + dp, y0 + dp, zc + 0.02], [x1 - dp, y0 + dp, zc + 0.02], [x1 - dp, y1 - dp, zc + 0.02], [x0 + dp, y1 - dp, zc + 0.02]], 'geocity:court', col.court);
      [[x0, y0, x1, y0 + dp], [x0, y1 - dp, x1, y1], [x0, y0 + dp, x0 + dp, y1 - dp], [x1 - dp, y0 + dp, x1, y1 - dp]].forEach((q, k) => lot(`${b.id}:m${k}`, q, zc, Math.max(1, Math.round(med)), resid, 'brick', 'residential'));
    } else if (b.kind === 'slab') {
      const long = Math.max(w, h) * 0.72, dp = Math.min(15, Math.min(w, h) * 0.35), longY = h >= w;
      lot(`${b.id}:slab`, longY ? [cx - dp / 2, cy - long / 2, cx + dp / 2, cy + long / 2] : [cx - long / 2, cy - dp / 2, cx + long / 2, cy + dp / 2], zc, Math.max(1, Math.round(med)), resid, 'stone', 'residential');
    }
    counts.detailed++;
  }

  /** A block's buildings, by its segment, on its terraces. */
  function building(b, { x0, y0, x1, y1, longY, zAt, Rb, far = false }) {
    const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, med = b.storeys.median;
    const inset = (share) => { const e = ((w + h) - Math.sqrt((w + h) ** 2 - 4 * w * h * (1 - share))) / 4; return [x0 + e, y0 + e, x1 - e, y1 - e]; };
    const zc = zAt(cx, cy);
    if (b.kind === 'tower') {
      const [g, frame] = famOf(glass, b.id), pod = inset(0.62), zp = zc + b.podium * office, [, ston] = famOf(stone, b.id);
      box(pod[0], pod[1], pod[2], pod[3], zc, zp, ston, roofs[strHash(b.id) % roofs.length], 'geocity:podium');
      lights(pod[0], pod[1], pod[2], pod[3], zc, zp, office, Rb);
      for (const t of b.towers) {
        const [a0, b0, a1, b1] = t.rect, z0 = zAt((a0 + a1) / 2, (b0 + b1) / 2), z1 = z0 + t.storeys * office;
        const glassy = Rb() < G.skin.towerGlass;
        box(a0, b0, a1, b1, z0, z1, glassy ? g : frame, frame, 'geocity:tower');
        // (a glass tower's walls take the sun's sheen)
        if (glassy) for (const f of faces.slice(-4)) f.spec = GLASS_SPEC;
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
    } else if (b.kind === 'construction') going(b, { x0, y0, x1, y1, longY, zAt, Rb, far });
    else if (b.kind === 'parking') parked(b, { x0, y0, x1, y1, longY, zAt, Rb });
    else if (b.kind === 'vacant') fenced(b, { x0, y0, x1, y1 }, zAt((x0 + x1) / 2, (y0 + y1) / 2), 'fence');
    else outskirts(b, { x0, y0, x1, y1, longY, zAt, Rb });
  }

  /** A building going up (segments.js `construction`): its columns and floor slabs risen to its `progress` of the
   *  storeys it becomes, its concrete core a little above them, a tower crane over it (seen from afar); near the camera
   *  scaffolding up its two long faces, hoarding along its streets and temporary fencing round the rest, barriers and
   *  cones on a walk beside it. */
  function going(b, { x0, y0, x1, y1, longY, zAt, Rb, far }) {
    const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, zc = zAt(cx, cy), fh = b.ring === 'core' ? office : resid;
    const target = Math.max(3, Math.round(b.storeys.median)), n = Math.max(2, Math.round(target * b.progress)), top = zc + n * fh;
    const e = Math.min(w, h) * 0.18, q = [x0 + e, y0 + e, x1 - e, y1 - e], conc = '#9a9a96', yellow = '#e3b13a';
    if (far) box(q[0], q[1], q[2], q[3], zc, top, conc, conc, 'geocity:frame');
    else {
      for (let k = 1; k <= n; k++) box(q[0], q[1], q[2], q[3], zc + k * fh - 0.3, zc + k * fh, conc, conc, 'geocity:frame');
      for (const px of [q[0], (q[0] + q[2]) / 2, q[2] - 0.6]) for (const py of [q[1], (q[1] + q[3]) / 2, q[3] - 0.6]) box(px, py, px + 0.6, py + 0.6, zc, top, conc, conc, 'geocity:frame');
    }
    const cw = (q[2] - q[0]) * 0.22, cd = (q[3] - q[1]) * 0.22;
    box(cx - cw / 2, cy - cd / 2, cx + cw / 2, cy + cd / 2, zc, top + 2 * fh, '#8c8c88', '#8c8c88', 'geocity:frame');
    // the crane: its mast at a corner of the site, its jib across the building, its counter-jib and weight, its cab
    const mx = x0 + 3, my = y0 + 3, mt = top + 3 * fh + 14, jib = Math.max(w, h) * 0.85;
    box(mx, my, mx + 2, my + 2, zc, mt, yellow, yellow, 'geocity:crane');
    if (longY) { box(mx - 0.4, my, mx + 2.4, my + jib, mt, mt + 1.6, yellow, yellow, 'geocity:crane'); box(mx - 0.2, my - 14, mx + 2.2, my, mt, mt + 1.4, yellow, yellow, 'geocity:crane'); box(mx - 0.8, my - 13, mx + 2.8, my - 9, mt - 2.2, mt, conc, conc, 'geocity:crane'); }
    else { box(mx, my - 0.4, mx + jib, my + 2.4, mt, mt + 1.6, yellow, yellow, 'geocity:crane'); box(mx - 14, my - 0.2, mx, my + 2.2, mt, mt + 1.4, yellow, yellow, 'geocity:crane'); box(mx - 13, my - 0.8, mx - 9, my + 2.8, mt - 2.2, mt, conc, conc, 'geocity:crane'); }
    box(mx + 2, my, mx + 4.2, my + 2, mt - 3, mt, '#d8d4c8', '#d8d4c8', 'geocity:crane');
    if (far) return;
    // near: scaffolding up its two long faces, a bay every 2 m along and every lift up
    const faces2 = longY ? [['w', q[0], 'y', q[1], q[3]], ['e', q[2], 'y', q[1], q[3]]] : [['s', q[1], 'x', q[0], q[2]], ['n', q[3], 'x', q[0], q[2]]];
    for (const [f, at2, along, a, c] of faces2) for (let t = a + 1; t <= c - 1; t += 2) for (let z = zc; z + 2 <= top + 1e-6; z += 2) stamp(`scaffold:${f}`, along === 'y' ? [at2, t, z] : [t, at2, z], 0);
    fenced(b, { x0, y0, x1, y1 }, zc, 'hoarding');
    // barriers and cones on the walk along a street side (the one it fronts first)
    const s = ['s', 'n', 'w', 'e'].find((k) => b.sides[k]?.kind === 'street' || b.sides[k]?.kind === 'arterial') ?? 's', o = WALK / 2;
    for (let k = 0; k < 5; k++) {
      const p = s === 's' ? [x0 + 6 + k * 2, y0 - o] : s === 'n' ? [x0 + 6 + k * 2, y1 + o] : s === 'w' ? [x0 - o, y0 + 6 + k * 2] : [x1 + o, y0 + 6 + k * 2];
      stamp('barrier', [p[0], p[1], S(p[0], p[1]) + KERB], s === 'w' || s === 'e' ? Math.PI / 2 : 0);
    }
    for (let k = 0; k < 4; k++) { const p = s === 's' ? [x0 + 17 + k * 1.6, y0 - o] : s === 'n' ? [x0 + 17 + k * 1.6, y1 + o] : s === 'w' ? [x0 - o, y0 + 17 + k * 1.6] : [x1 + o, y0 + 17 + k * 1.6]; stamp('cone', [p[0], p[1], S(p[0], p[1]) + KERB], 0); }
  }
  /** A block's edge fenced near the camera: hoarding along its streets (a site's), temporary panels along the rest. */
  function fenced(b, { x0, y0, x1, y1 }, z, street) {
    for (const [k, a, c, fixed, ax] of [['s', x0, x1, y0 + 0.4, 'x'], ['n', x0, x1, y1 - 0.4, 'x'], ['w', y0, y1, x0 + 0.4, 'y'], ['e', y0, y1, x1 - 0.4, 'y']]) {
      const kind = street === 'hoarding' && (b.sides[k]?.kind === 'street' || b.sides[k]?.kind === 'arterial') ? 'hoarding' : 'fence', len = kind === 'hoarding' ? 2.4 : 3.5;
      for (let t = a + len / 2; t <= c - len / 2 + 1e-6; t += len) stamp(kind, ax === 'x' ? [t, fixed, z] : [fixed, t, z], ax === 'x' ? 0 : Math.PI / 2);
    }
  }
  /** A surface parking lot (segments.js `parking`): rows of stalls across its short side, an aisle between each two,
   *  their lines and cars in most, near the camera. */
  function parked(b, { x0, y0, x1, y1, longY, zAt, Rb }) {
    const z = zAt((x0 + x1) / 2, (y0 + y1) / 2), [s0, s1] = longY ? [x0, x1] : [y0, y1], [a0, a1] = longY ? [y0, y1] : [x0, x1];
    for (let m = s0 + 2; m + 10 <= s1 - 2; m += 16.5) for (const row of [m, m + 11.5]) for (let t = a0 + 3; t + 2.6 <= a1 - 3; t += 2.6) {
      // its line (across its row, 5 m) and, in most stalls, a car
      stamp('stall', longY ? [row, t, z + 0.03] : [t, row, z + 0.03], longY ? 0 : Math.PI / 2);
      if (Rb() < 0.72) {
        const c = longY ? [row + 2.5, t + 1.3] : [t + 1.3, row + 2.5], paint = CAR_TINTS[Math.floor(Rb() * CAR_TINTS.length)];
        stamps.has(longY ? 'car:e' : 'car:n') || stamps.set(longY ? 'car:e' : 'car:n', []);
        stamps.get(longY ? 'car:e' : 'car:n').push({ pos: P3([c[0], c[1], z]), tint: paint });
      }
    }
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

  street();
  streetsNear();

  // ── the blocks at a building's detail: their masses through the facade pipeline (its units), back to metres; at
  // night its windows lit on the facades' own grids (city/plan/night.js) ──
  let textures = null;
  if (lots.length) {
    const U = CITY_METERS_PER_UNIT, u = (v) => Math.round((v / U) * 1000) / 1000;
    const boxes = lots.map((l) => {
      const { skin, shape } = skinLot(l, G, seed);
      return { x: u(l.x0), y: u(l.y0), w: u(l.x1 - l.x0), d: u(l.y1 - l.y0), z0: u(l.z0), z1: u(l.z0 + l.h), kind: 'building', metro: true, floors: l.floors, floorH: u(l.floorH),
        skin, shape: ORGANIC_SHAPES.includes(shape) ? 'box' : shape, front: l.front, roadFaces: [l.front], ...(l.tower ? { tower: true } : {}), lot: l.id };
    });
    const sc = assembleBoxCityScene({ boxes, faces: [], cameras: [], viewBox: { width: 1280, height: 720 }, title: '', light: LIGHT });
    const fs = night ? nightFaces(sc.faces, boxes, new Map(lots.map((l) => [l.id, l])), G.night, seed) : sc.faces;
    for (const f of fs) {
      if (f.group === 'city:night-window' || f.group === 'city:night-shop') counts.panes++;
      // (a facade's own faces come untagged: they are the detail's)
      faces.push({ ...f, group: f.group ?? 'geocity:facade', corners: f.corners.map((c) => c.map((v) => r5(v * U))) });
    }
    if (sc.textures && Object.keys(sc.textures).length) textures = sc.textures;
    counts.buildings += lots.length;
  }

  // ── the cameras: the skyline from its water (or from past its land's edge), over the metro, the core, up its spine ──
  const [sx, sy] = d.seat, zs = S(sx, sy), toward = d.metro.fall.toward, out = { s: [0, -1], n: [0, 1], w: [-1, 0], e: [1, 0] }[toward];
  const top = Math.max(60, ...d.regions.flatMap((r) => r.blocks.flatMap((b) => (b.towers ?? []).map((t) => t.storeys * office))));
  const W = d.frame.W, D = d.frame.D, far = Math.max(W, D);
  const spine = NS.find((l) => l.rank === 'spine'), up = toward === 's' ? 1 : -1, ex = spine.at + spine.half - sec.walk / 2;
  let eye = [ex, sy + up * (sec.half + 30), 0];
  eye[2] = S(eye[0], eye[1]) + KERB + 1.7;
  let cameras = [
    { name: 'skyline', worldFraming: { cameraPosition: P3([sx + out[0] * far * 0.42 + out[1] * 120, sy + out[1] * far * 0.42 + out[0] * 120, zs + 40]), lookAt: P3([sx, sy, zs + top * 0.35]), horizontalFov: 55 } },
    { name: 'over', worldFraming: { cameraPosition: P3([W * 1.05, -D * 0.25, far * 0.55]), lookAt: P3([W / 2, D / 2, 0]), horizontalFov: 55 } },
    { name: 'core', worldFraming: { cameraPosition: P3([sx + 520, sy + out[1] * 380 + 260, zs + 260]), lookAt: P3([sx, sy, zs + 40]), horizontalFov: 55 } },
    { name: 'street', worldFraming: { cameraPosition: P3(eye), lookAt: P3([ex, eye[1] + up * 120, eye[2] + 8]), horizontalFov: 75 } },
  ];
  // an evocation is seen first where it is: from over it and from its own street (where its walk starts), then as the
  // metro is
  let fb = firstBlock?.rect ?? [sx + 20, sy + 20, sx + 60, sy + 60];
  if (E && E.evoke !== 'skyline') {
    const blocks = d.regions.flatMap((r) => r.blocks), byId = new Map(blocks.map((b) => [b.id, b]));
    const shown = E.blocks.map((id) => byId.get(id)), hull = [Math.min(...shown.map((b) => b.rect[0])), Math.min(...shown.map((b) => b.rect[1])), Math.max(...shown.map((b) => b.rect[2])), Math.max(...shown.map((b) => b.rect[3]))];
    const mid = [(hull[0] + hull[2]) / 2, (hull[1] + hull[3]) / 2], span = Math.max(hull[2] - hull[0], hull[3] - hull[1], 240), zm = S(mid[0], mid[1]);
    const tall = Math.max(30, ...shown.flatMap((b) => [b.storeys.median * office, ...(b.towers ?? []).map((t) => t.storeys * office)]));
    // its street: along the evoked block nearest its middle (a corridor's: along its arterial, from the seat's end)
    let st, look;
    if (E.evoke === 'corridor') {
      const l = d.lines.find((x) => x.id === E.along), ns = l.axis === 'ns', a = ns ? sy : sx, lo = ns ? hull[1] : hull[0], hi = ns ? hull[3] : hull[2], dir = Math.abs(a - lo) <= Math.abs(a - hi) ? 1 : -1, from = Math.max(lo, Math.min(hi, a));
      const off = l.at + l.half - sec.walk / 2;
      st = ns ? [off, from + dir * 30] : [from + dir * 30, off];
      look = ns ? [off, st[1] + dir * 160] : [st[0] + dir * 160, off];
    } else {
      const b = shown.slice().sort((p, q) => Math.hypot((p.rect[0] + p.rect[2]) / 2 - mid[0], (p.rect[1] + p.rect[3]) / 2 - mid[1]) - Math.hypot((q.rect[0] + q.rect[2]) / 2 - mid[0], (q.rect[1] + q.rect[3]) / 2 - mid[1]))[0];
      st = [b.rect[0] - WALK / 2, b.rect[1] - WALK / 2];
      look = [b.rect[2], b.rect[1] - WALK / 2];
      fb = b.rect;
    }
    eye = [st[0], st[1], S(st[0], st[1]) + KERB + 1.7];
    cameras = [
      // (over it: higher than its tallest, so a neighbour's tower never stands between)
      { name: 'evoked', worldFraming: { cameraPosition: P3([mid[0] + span * 0.75, mid[1] - span * 0.95, zm + Math.max(span * 0.55 + tall * 0.6, top * 1.1)]), lookAt: P3([mid[0], mid[1], zm + tall * 0.25]), horizontalFov: 55 } },
      { name: 'street', worldFraming: { cameraPosition: P3(eye), lookAt: P3([look[0], look[1], eye[2] + 10]), horizontalFov: 75 } },
      // the arterial crossing nearest its street, from over one of its arms a little up: its signals, crosswalks and stops
      ...(() => { const c = d.crossings.slice().sort((p, q) => Math.hypot(p.at[0] - st[0], p.at[1] - st[1]) - Math.hypot(q.at[0] - st[0], q.at[1] - st[1]))[0]; const cp = [c.at[0] + 3, c.at[1] - 45]; return c ? [{ name: 'crossing', worldFraming: { cameraPosition: P3([cp[0], cp[1], S(cp[0], cp[1]) + 9]), lookAt: P3([c.at[0], c.at[1], c.z + 2]), horizontalFov: 70 } }] : []; })(),
      ...cameras.filter((c) => c.name === 'skyline' || c.name === 'over'),
    ];
  } else if (E) cameras = cameras.filter((c) => c.name === 'skyline' || c.name === 'over');
  // ── the route round the block nearest the seat (the dummy's), or the evoked block's, on its walk ──
  const o = WALK / 2;
  const ring = [[fb[0] - o, fb[1] - o], [fb[2] + o, fb[1] - o], [fb[2] + o, fb[3] + o], [fb[0] - o, fb[3] + o]], route = [];
  for (let k = 0; k < 4; k++) { const p = ring[k], q = ring[(k + 1) % 4], nn = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 2)); for (let i = 0; i < nn; i++) { const x = p[0] + ((q[0] - p[0]) * i) / nn, yy = p[1] + ((q[1] - p[1]) * i) / nn; route.push(P3([x, yy, S(x, yy) + KERB])); } }
  route.push(route[0]);

  // ── the laws the scene adds: the faces' budget ──
  const laws = [...d.laws, { law: 'faces', ok: faces.length <= GEOCITY_FACES, value: `${faces.length} faces (budget ${GEOCITY_FACES})${night ? `, ${counts.panes} lit panes` : ''}`, want: 'the metro as massing' }];
  const bg = night ? air.fog.color : rgbToHex(air.dome.horizon);
  const kinds = d.regions.flatMap((r) => r.blocks).reduce((acc, b) => ({ ...acc, [b.kind]: (acc[b.kind] ?? 0) + 1 }), {});
  // (the kit's repeats, each drawn near the camera only; the skyline draws none)
  const repeats = E?.evoke === 'skyline' ? [] : [...stamps].map(([key, transforms]) => ({ group: `geocity:${key.split(':')[0]}`, template: templateOf(key), transforms, near: NEAR }));
  // the street trees grown (vegetation/pool.js): a few variants a species, each at the detail the cameras see it at,
  // their crowns raised over the walk, drawn near the camera only like the kit
  if (E?.evoke !== 'skyline' && trees.size) {
    const eyes = cameras.map(({ worldFraming: wf }) => ({ pos: wf.cameraPosition, focalPx: 1280 / (2 * Math.tan((wf.horizontalFov * Math.PI) / 360)) }));
    for (const sp of [...trees.keys()].sort()) {
      const pool = plantPool({ species: sp, variants: 2, seed: `geocity::${sp}`, light: LIGHT, maxLevel: TREE.level, group: `geocity:tree-${sp}`, clear: TREE.raise });
      const placed = plantRepeats(pool, trees.get(sp), { eyes, level: TREE.level, budget: Math.round(TREE.budget / trees.size), sink: 0.05 });
      repeats.push(...placed.repeats.map((r) => ({ ...r, group: `geocity:tree-${r.group}`, near: NEAR })));
      if (pool.textures) textures = { ...(textures || {}), ...pool.textures };
      counts.trees = (counts.trees ?? 0) + trees.get(sp).length;
    }
  }
  // the live light's SUN SHARE (ctx.liveSun: a page taking live shadows, scene/live-light.js): each face's key part of
  // its light by its normal (city/plan/scene.js keyShare), so a shadow takes the sun away and leaves the sky; a lit
  // window carries its own light
  if (ctx.liveSun) for (let i = 0; i < faces.length; i++) {
    const f = faces[i];
    if (f.group === 'geocity:night-window' || f.group === 'city:night-window' || f.group === 'city:night-shop') continue;
    const N = Array.isArray(f.normal) ? f.normal : newell(f.corners), key = LIGHT.diffuse * Math.max(0, N[0] * LIGHT.toLight[0] + N[1] * LIGHT.toLight[1] + N[2] * LIGHT.toLight[2]), all = litFactor(N, LIGHT);
    faces[i] = { ...f, sunShare: all > 1e-9 ? Math.round(Math.min(1, key / all) * 1000) / 1000 : 0 };
  }
  counts.kit = repeats.reduce((a, r) => a + r.transforms.length, 0);
  return {
    faces, ...(repeats.length ? { repeats } : {}), ...(textures ? { textures } : {}), cameras, viewBox: { width: 1280, height: 720 }, title: ctx.title || `${cube.title} · geocity`,
    // (the city's haze is laid per its world unit, city/plan/scene.js; this world's unit is the metre)
    bg, haze: { color: air.fog.color, density: r5((air.fog.density * CITY_HAZE) / CITY_METERS_PER_UNIT) },
    sky: { zenith: air.dome.zenith, horizon: air.dome.horizon, day: night ? 0 : 1, stars: 0, seed: 1, ...(night ? {} : { sun: { dir: P3(sun), size: 1.4, glow: 1.3 } }), ...(spec.air ? hourSky(spec.air) : {}) },
    walk: m.walk === false ? false : { speed: 6, spawn: P3(eye), minEye: 1.7, gravity: 22, radius: 0.4 },
    route,
    geocube: geocubeReadout(cube, 'geocity', null, m),
    geocity: {
      metro: d.metro.id, grammar: G.label, frame: d.frame, land: d.land.range, seat: d.seat, evoke: d.spec.evoke, play: d.spec.play,
      ...(E ? { evoked: { ...(E.at ? { at: E.at } : {}), ...(E.along ? { along: E.along } : {}), detail: E.blocks.length, massing: E.regions.length } } : {}),
      counts: { neighbourhoods: d.regions.length, blocks: Object.values(kinds).reduce((a, n) => a + n, 0), segments: kinds, ...counts, faces: faces.length },
      neighbourhoods: d.regions.map((r) => ({ id: r.id, ring: r.ring, builds: r.builds, storeys: r.storeys.median, blocks: r.blocks.length, park: r.park || !!r.parkRect, ...(r.node ? { node: r.node } : {}), ...(r.beyond.length ? { beyond: r.beyond } : {}) })),
      graph: { nodes: d.graph.nodes.length, edges: d.graph.edges.length, beyond: d.graph.beyond },
      ledger: d.ledger, laws: laws.map((l) => ({ law: l.law, ok: l.ok, value: l.value })),
    },
  };
}
