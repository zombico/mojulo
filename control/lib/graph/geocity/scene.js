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
 *                                  nearest the seat (the dummy's), its colliders, and `geocity`: the metro, its counts,
 *                                  its ledger, its laws, its neighbourhoods and its region graph (a Quest Open World's)
 *
 *   under      (`under`) the evoked podiums walked into from their plazas, each a lobby and a concourse under it
 *              (geocity/podium.js), and the passages under the streets between their concourses (lib/graph/network, its
 *              `passage` section: straight across a street, or a dog-leg where two concourses do not face each other):
 *              the facades cut at each door, the ground cut round each inside and along each passage under its blocks,
 *              their lights, a `building` anchor a podium (its ways through and out) and a `tunnel` anchor a passage,
 *              cameras into the nearest lobby, along its concourse, down the first passage and over the food court, the
 *              network's laws; dressed (geocity/dress.js): shopfronts along the concourses, a sign over each way out in
 *              its route's colour (a stripe down each passage's floor in it), a food court in the hub
 *   held       every mass a walker can reach in a box (`colliders`, { min, max, of: '<block>:<group>' }): each mass of a
 *              neighbourhood built at block scale, each evoked lot, each composed geotown's houses in the metro's frame
 *              (a block town's cut to its block); the skyline's backdrop and a far town none. The walk-clear law: the
 *              dummy's route and the walk's spawn in no box
 *
 * Metres, the design's frame (x east, y north, z up). Pure; seeded dice only.
 */
import { readCone } from '../scene/channels/view-cone.js';
import { designGeocity } from './design.js';
import { readGeocube, geocubeReadout } from '../era/geocube.js';
import { readPaint, cubeLookSpec, lookLight, hourSky, CITY_HAZE } from '../city/plan/look.js';
import { shadeHex, hexToRgb, rgbToHex } from '../polygonizer/vexar.js';
import { streamOf, strHash } from '../city/plan/dice.js';
import { CITY_METERS_PER_UNIT } from '../city/fractal-city.js';
import { skinLot } from '../city/plan/facades.js';
import { CON_ARCHETYPES, CON_ODM, assembleMachine } from '../construction-shelf/index.js';
import { lowerAssemblerFaces } from '../worlds/workbench-assembler.js';
import { nightFaces } from '../city/plan/night.js';
import { ORGANIC_SHAPES } from '../city/plan/organic.js';
import { assembleBoxCityScene } from '../scene/scene-css3d.js';
import { kitTemplates } from './kit.js';
import { frontageTemplates, frontsOf, wallsOf } from './frontage.js';
import { parkCar, carRepeats, carModel } from '../geotown/cars.js';
import { fleetOf, pickOf, YARDS } from './fleets.js';
import { flowOf, flowLaws } from './flow.js';
import { industryTemplates, industrialPlan, INDUSTRY_FAR, PYLON, INDUSTRY_FINISHES, finishOf } from './industry.js';
import { INDUSTRY_SEGMENTS } from './segments.js';
import { HIGHWAY, deckAt } from './highways.js';
import { WATERFRONT, WATERFRONT_PAINT, frameOf, waterfrontTemplates } from './waterfront.js';
import { rooftopTemplates, rooftopPlan, beaconsOf, BEACON } from './rooftop.js';
import { assembleGeotownScene } from '../geotown/scene.js';
import { materialContext, wordTile } from '../era/arch-style.js';
import { dressTownFace } from '../era/town-dress.js';
import { plantPool, plantRepeats } from '../vegetation/pool.js';
import { litFactor } from '../polygonizer/vexar.js';
import { podiumFit, podiumInside, portsHold, cutFace, groundLess, wallLess, PODIUM } from './podium.js';
import { networkEdges, pathOf } from '../network/edges.js';
import { passageOf } from '../network/passage.js';
import { networkLaws } from '../network/laws.js';
import { readSection } from '../network/sections.js';
import { dressUnder, ROUTES } from './dress.js';
import { subwayUnder, subwayPlan, withGeocitySubwayLevel } from './subway.js';
import { registerLevelKind } from '../structure/level.js';
import { streetcarFaces, STREETCAR } from './streetcar.js';

export const GEOCITY_KEYS = Object.freeze(['kind', 'cube', 'show', 'title', 'seed', 'hour', 'clouds', 'geocity', 'walk', 'shadows', 'occlusion', 'light', 'cone', 'air', 'level', 'game',
  // (what plays in it: the world reads these, worlds/world-scene.js; a city with nobody in it reads none)
  'entities', 'camera', 'pilot', 'play', 'destruction', 'matter', 'scars', 'wind',
  // (its traffic: on unless `flow: false`, flow.js)
  'flow']);
// destructible physics (`destruction: 'physical'`, rupa/): the buildings within RING metres of where the walk starts, the
// nearest RING_MAX of them, are handed over as blocks (rupa/shell-blocks.js: walls and a roof); the rest stay massing
export const RING = 100, RING_MAX = 24;
// (a mass with no finish of its own: a glass tower and a skyline slab stand on concrete frames)
const RING_WORD = Object.freeze({ 'geocity:tower': 'concrete', 'geocity:low': 'concrete' });
export const GEOCITY_FACES = 200000;
// the section its passages under the streets are built to (network/sections.js)
const SECTION = readSection('passage');
// the cells streets and grounds are draped on the land in (m), a kerb's height, a sidewalk round a block, a terrace's
// most step to the next
const CELL = 40, KERB = 0.15, WALK = 2.4, STEP = 1.2;
// an outskirts house: a semi pair's frontage, the gap between pairs, its depth, its front yard; a storey; a shop's depth
const PAIR = 13.6, GAP = 1.4, HOUSE_D = 12, SETBACK = 5, STOREY = 3, SHOP_D = 14;
// the skyline's ground cells (m); what it draws of a neighbourhood (its tall buildings); what a block at detail wears
// facades on (the core's and the frame's: an outskirts block keeps its massing until it is a geotown's)
// the street's kit: drawn within NEAR metres of the camera (the page's near repeats), a lamp every LAMP metres along a
// (read by the seventh generation, ctx.form) the metro's soft ground the form's land draws and grows its grass on: its
// parks, its medians' lawns, the green round its towns, its lawned pads (the paved, the lots, the sites and the scrub stay
// paint, as a geotown's paving does)
export const FORM_GROUND = Object.freeze(['geocity:park', 'geocity:median', 'geocity:margin', 'geocity:pad']);
/** The PLANTS a form read grows (form/flora-read.js): the metro's street trees, each its species at its height, and its
 *  composed towns' (their trees, bushes and shrubs moved into the metro's frame; a block town's those on its block, its
 *  bushes' kinds merged into one list), with the ground every trunk and claim takes from the grass. */
function metroPlants(trees, towns) {
  const T = [], B = [], Sh = [], clear = [], kinds = [], kindKey = new Map();
  for (const sp of [...trees.keys()].sort()) for (const t of trees.get(sp)) T.push({ x: t.x, y: t.y, z: r5(t.z0 - 0.15), h: t.height, kind: -1, cluster: T.length, species: sp });
  // (the street trees' trunks claim their ground; a town's claims come with it)
  const street = T.map((t) => [t.x, t.y, 0.6]);
  for (const { p, at, keep } of towns) {
    const ok = (q) => !keep || keep(q.x, q.y), mv = (q) => ({ ...q, x: r5(q.x + at[0]), y: r5(q.y + at[1]) });
    for (const t of (p.trees ?? []).filter(ok)) T.push({ ...mv(t), cluster: T.length });
    // (a bush's kind its town's: the merged list's index for it)
    const remap = (p.bushKinds ?? []).map((k) => { const key = JSON.stringify(k); if (!kindKey.has(key)) { kindKey.set(key, kinds.length); kinds.push(k); } return kindKey.get(key); });
    for (const b of (p.bushes ?? []).filter(ok)) B.push({ ...mv(b), kind: remap[b.kind] ?? b.kind });
    for (const q of (p.shrubs ?? []).filter(ok)) Sh.push(mv(q));
    for (const c of (p.clear ?? []).filter(([x, y]) => !keep || keep(x, y))) clear.push([r5(c[0] + at[0]), r5(c[1] + at[1]), c[2]]);
  }
  if (!T.length && !B.length && !Sh.length) return null;
  return { form: 'blob', kinds: null, bushKinds: kinds.length ? kinds : null, trees: T, bushes: B, shrubs: Sh, clear: [...street, ...clear] };
}
// (the town-seams law: a composed town's ground and the metro's round it, read this far either side of its outline,
// within this: a kerb's height and the drapes' cells)
export const TOWN_SEAM = Object.freeze({ probe: 0.6, tol: 0.3 });
const STREET_LEVEL = /^geotown:(road|walk|verge|furnish|lane|margin)$/;
// kerb (the metro's stride, fractal-city.js METRO_LAMP_STEP), a streetcar's poles every POLE
const NEAR = 320, LAMP = 31, POLE = 35;
// the frontage's eyes: the cameras within this many metres of the ground (a person's, not a bird's)
const FRONT_EYE = 25;
// (a detailed lot's ground floor stood this proud of its facade's plane, before its piers)
const FRONT_PROUD = 0.35;
// the frontage's paints: a building's window frames and balcony rails, its shops' frames, signs and awnings, its doors
const FRONT_PAINT = Object.freeze({
  frame: ['#efe9dd', '#e4ddcf', '#f4f1ea', '#d2c8b4', '#8a8f94', '#4a5547'],
  shop: ['#1f3a2c', '#262626', '#5b1f24', '#6b4a2e', '#1e2f4a', '#ece6d8', '#3d5a4a'],
  sign: ['#b8322a', '#f2c14e', '#2c5f8a', '#1d1d1d', '#ece6d8', '#3c7a4f', '#8a3d6b', '#d9792b'],
  awning: ['#9c2b27', '#245b3a', '#1f3f6a', '#d9cfb8', '#2b2b2b', '#c46a2b', '#6a2c4f'],
  door: ['#5a3a22', '#1f1f1f', '#7d2a24', '#22384f', '#2f4a33', '#6e6a62'],
  rail: ['#2b2b2b', '#e8e4dc', '#3a3f45'],
});
// the furniture's strides (m): a hydrant, a bench and its bike rings, a residential street's hydro poles
const HYDRANT = 90, BENCH = 70, HYDRO = 38;
// the ground and the masses in their material words (era/arch-style.js MATERIAL_WORDS), laid as tiles (texel × light):
// a floor's on a face that lies flat, a wall's on an upright one; each word's seed its own
const FINISHES = Object.freeze({
  'geocity:road': ['asphalt', 'floor'], 'geocity:walk': ['pavement', 'floor'], 'geocity:paving': ['flags', 'floor'], 'geocity:streetcar-row': ['setts', 'floor'],
  'geocity:platform': ['pavement', 'floor'], 'geocity:site': ['gravel', 'floor'], 'geocity:lot': ['asphalt', 'floor'], 'geocity:retain': ['sawn-stone', 'wall'], 'geocity:house': ['wire-brick', 'wall'], 'geocity:shops': ['wire-brick', 'wall'],
  'geocity:avenue': ['wire-brick', 'wall'], 'geocity:midrise': ['wire-brick', 'wall'], 'geocity:lowrise': ['wire-brick', 'wall'], 'geocity:walkup': ['wire-brick', 'wall'],
  'geocity:school': ['wire-brick', 'wall'], 'geocity:podium': ['sawn-stone', 'wall'], 'geocity:slab': ['precast', 'wall'],
  // (the sheds and halls of its yards and its industry: corrugated steel, cladding, block, standing-seam roofs; their
  // grounds concrete and gravel)
  'geocity:shed': ['corrugated', 'wall'], 'geocity:shed:roof': ['standing-seam', 'floor'], 'geocity:station': ['wire-brick', 'wall'],
  'geocity:works': ['corrugated', 'wall'], 'geocity:works:roof': ['standing-seam', 'floor'], 'geocity:warehouse': ['cladding', 'wall'],
  'geocity:warehouse:roof': ['membrane', 'floor'], 'geocity:control': ['cmu', 'wall'], 'geocity:yard': ['hardstanding', 'floor'],
  'geocity:bund': ['gravel', 'floor'], 'geocity:switchyard': ['ballast', 'floor'], 'geocity:bund-wall': ['concrete', 'wall'],
  // (its highways' decks: asphalt over concrete, highways.js)
  'geocity:highway': ['asphalt', 'floor'], 'geocity:highway-side': ['concrete', 'wall'],
  // (its waterfront, waterfront.js: granite quays, concrete walls, timber decks, a promenade, rocks, sand)
  'geocity:quay': ['granite', 'floor'], 'geocity:quay-wall': ['concrete', 'wall'], 'geocity:deck': ['decking', 'floor'],
  'geocity:promenade': ['pavement', 'floor'], 'geocity:riprap': ['armour-stone', 'floor'], 'geocity:sand': ['sand', 'floor'],
  // (a marina's and a pier's quay wall steel sheet piling)
  'geocity:quay-wall-steel': ['sheet-pile', 'wall'],
  // (each industrial family's variants, industry.js INDUSTRY_FINISHES: its wall's word and its roof's)
  ...Object.fromEntries(Object.entries(INDUSTRY_FINISHES).flatMap(([fam, vs]) => Object.entries(vs).flatMap(([v, [w, r]]) => [[`geocity:${fam}-${v}`, [w, 'wall']], [`geocity:${fam}-${v}:roof`, [r, 'floor']]]))),
});
// an industrial block's ground: a works' concrete, a tank farm's and a switchyard's gravel
const IND_GROUND = Object.freeze({ works: ['geocity:yard', '#a29f97'], warehouse: ['geocity:yard', '#a29f97'], storage: ['geocity:yard', '#a29f97'], tanks: ['geocity:bund', '#938e82'], substation: ['geocity:switchyard', '#8f8a7f'] });
// a glass tower's sheen: the specular channel's strength and power (scene/channels/specular.js)
const GLASS_SPEC = Object.freeze([0.55, 48]);
// street trees: a pit's stride along a close-built arterial, a verge's along an outskirts street, their species, the
// height they are grown to (m), the detail their template keeps and its faces' budget
const TREE = Object.freeze({ pit: 12, verge: 11, species: { dense: ['maple', 'beech'], low: ['maple', 'cherry'] }, height: [12, 17], level: 'L1', budget: 400000, raise: 0.42 });
const FAR_CELL = 160, TALL = Object.freeze(['tower', 'podium', 'midrise', 'slab']), DETAILED = Object.freeze(['tower', 'podium', 'midrise', 'slab']);

const r5 = (v) => Math.round(v * 1e5) / 1e5 + 0;
const P3 = (p) => p.map(r5);
/** A rectangle [x0, y0, x1, y1] less another: the strips of it round the other (none where it covers it). */
function rectLess(q, c) {
  const [x0, y0, x1, y1] = q, a0 = Math.max(x0, c[0]), b0 = Math.max(y0, c[1]), a1 = Math.min(x1, c[2]), b1 = Math.min(y1, c[3]);
  if (a1 <= a0 || b1 <= b0) return [q];
  return [[x0, y0, a0, y1], [a1, y0, x1, y1], [a0, y0, a1, b0], [a0, b1, a1, y1]].filter((r) => r[2] - r[0] > 1e-3 && r[3] - r[1] > 1e-3);
}
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

// A SITE's machines off the construction shelf (construction-shelf/), lowered under the city's light once a process for
// each light: the tower crane at a height (its mast's sections), an excavator digging, a tipper waiting. Their recipes
// are the shelf's words; a crane taller than its mast stands freestanding is beyond the shelf (a climbing crane), and the
// site keeps its massing crane
// (a crane is seen from across its district: it is drawn within CRANE_NEAR of the camera, the kit within NEAR)
const SITE = Object.freeze({ crane: 'towerCrane', craneMinClear: 6, digger: ['crawlerExcavator', 'dig'], truck: ['tipperTruck', 'rest'] });
const CRANE_NEAR = 1500;
const TOWER = (() => {
  const M = CON_ARCHETYPES[SITE.crane].sections, per = CON_ODM[M.sku].dims.length;
  return { ...M, per, base: CON_ODM['base-tc'].dims.top, head: CON_ODM['slew-tc'].dims.jib[2] };
})();
const SITE_FACES = new Map();
function siteFaces(L, key, build) {
  const k = `${JSON.stringify(L)}|${key}`;
  if (!SITE_FACES.has(k)) SITE_FACES.set(k, lowerAssemblerFaces(build().manifest, { light: L }));
  return SITE_FACES.get(k);
}
/** The tower crane of `n` mast sections, its trolley half out and its hook a third down (its jib along +y). */
const craneAt = (L, n) => siteFaces(L, `crane:${n}`, () => {
  const h0 = assembleMachine(SITE.crane, { laws: false }).readout.height;
  return assembleMachine(SITE.crane, { height: h0 + (n - TOWER.n) * TOWER.per, pose: { trolley: 20, hoist: Math.max(1.2, (TOWER.base + n * TOWER.per) / 3) }, laws: false });
});

function coloursOf(cube) {
  const C = cube.colour;
  return {
    road: mix('#4d5055', C.floor, 0.15), walk: mix('#c8c2b4', C.stone, 0.3), kerb: mix('#b3ad9f', C.stone, 0.3), retain: mix('#9a9284', C.stone, 0.5),
    lawn: C.grass, park: mix(C.grass, C.foliage, 0.12), plaza: mix('#bdb6a8', C.stone, 0.3), lot: mix('#6a6c70', C.floor, 0.1), field: mix(C.grass, '#3f8a34', 0.4),
    water: mix('#3e6a84', C.sky ?? '#6f97b8', 0.25), court: mix(C.grass, C.foliage, 0.25), bike: '#3f8a5a', site: mix('#8a7a62', C.floor, 0.2), scrub: mix('#8a8a5a', C.grass, 0.35), row: mix('#8a8780', C.stone, 0.2), platform: mix('#bdb6a8', C.stone, 0.2),
  };
}

export function assembleGeocityScene(m, ctx = {}) {
  for (const k of Object.keys(m)) if (!GEOCITY_KEYS.includes(k)) no(`'${k}' is not a setting of the geocube kind's geocity (cube, seed, hour, clouds, geocity, cone, air)`);
  // (`cone`: gameplay's view cone, its far structures past it: scene/channels/view-cone.js, far-structures.js)
  if (m.cone !== undefined) readCone(m.cone);
  if (m.seed !== undefined && !Number.isInteger(m.seed)) no('seed is an integer');
  if (m.flow !== undefined && typeof m.flow !== 'boolean') no('flow is true or false: the traffic on its arterials (on unless false)');
  if (m.cube === undefined || m.cube === null) no('cube is a preset id or a document');
  const cube = readGeocube(m.cube), seed = m.seed ?? 1, d = designGeocity(m.geocity ?? {}, { seed }), G = d.grammar, S = d.land.S;
  // ── the light: the cube's at its hour, under its clouds (city/plan/look.js: as it lights a city) ──
  const paint = readPaint({ geocube: m.cube, amount: 1, ...(m.hour !== undefined ? { hour: m.hour } : {}), ...(m.clouds !== undefined ? { clouds: m.clouds } : {}) });
  const spec = cubeLookSpec(paint), lit = lookLight(spec, paint), LIGHT = lit.light, sun = LIGHT.toLight, air = spec.air ?? spec.ref.air, night = lit.night;
  // (the finishes in the cube's material context, each a tile; geotown/scene.js finishesOf)
  const MX = materialContext(cube), FIN = {};
  Object.entries(FINISHES).forEach(([group, [word, as]], k) => { const T = wordTile(word, MX, 211 + 17 * k); if (T) FIN[group] = { spec: T.spec, metres: T.metres, ...(as === 'floor' ? { floor: true } : {}) }; });
  const col = coloursOf(cube), faces = [], counts = { towers: 0, buildings: 0, houses: 0, panes: 0, detailed: 0 };
  // the analytic hull (worlds/controllable/core.js resolveBlocking, an engine's static boxes, the route audit): a box
  // round every mass a walker can reach, `of` its block and its group; `holder` the block being built at block scale
  // (none while the skyline's backdrop or a far town is drawn: nothing walks there)
  const colliders = [];
  let holder = null;
  const hold = (x0, y0, x1, y1, z0, z1, of) => { if (holder !== null) colliders.push({ min: P3([x0, y0, z0]), max: P3([x1, y1, z1]), of }); };
  const put = (corners, group, hex, want = null) => {
    let c = corners, n = newell(c);
    if (want && n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0) { c = c.slice().reverse(); n = n.map((x) => -x); }
    if (!want && n[2] < 0) { c = c.slice().reverse(); n = n.map((x) => -x); }
    const fill = shadeHex(hex, n, LIGHT), F0 = { corners: c.map(P3), normal: P3(n), outNormal: P3(n), group, fill, cornerFills: c.map(() => fill) }, E = FIN[group];
    faces.push(E && (E.floor ? Math.abs(n[2]) > 0.7 : Math.abs(n[2]) < 0.3) ? dressTownFace(F0, group, FIN) : F0);
  };
  // the street's kit stamped where it stands: each template's transforms, drawn near the camera only
  const KIT = kitTemplates(LIGHT, { gauge: d.metro.roads.streetcar.gauge }), stamps = new Map();
  // THE FRONTAGE (frontage.js): each building's walls as the street sees them, recorded as it is laid (its boxes, its
  // storeys, its use, the walls inside it), dressed once the cameras say which are near a person's eye
  const fronts = [], frontOf = (b, q, z0, storeys, floorH, use, { skip = [], only = null, ground = false, house = null } = {}) => { if (storeys >= 1) fronts.push({ b, q, z0, storeys: Math.round(storeys), floorH, use, skip, only, ground, house }); };
  const stamp = (key, pos, rotZ, scale = null) => { if (!stamps.has(key)) stamps.set(key, []); stamps.get(key).push({ pos: P3(pos), ...(rotZ ? { rotZ: r5(rotZ) } : {}), ...(scale ? { scale } : {}) }); };
  const templateOf = (key) => { const [k, f] = key.split(':'); return f ? KIT[k][f] : KIT[k]; };
  // a site's machines (SITE above): the crane drawn within its district's reach of the camera, the machines inside its
  // hoarding near the camera only, like the kit
  const siteStamps = new Map(), siteNears = new Map();
  const siteNear = (key, pos, rotZ) => { if (!siteNears.has(key)) siteNears.set(key, []); siteNears.get(key).push({ pos: P3(pos), rotZ: r5(rotZ) }); };
  // THE METRO'S VEHICLES (fleets.js): each of a role's fleet, its body the registry's realistic one (a car shelf card, a
  // loft, a construction shelf machine), parked where its role keeps it (a lot, a yard, a kerb, a site); a vehicle's
  // model and paint its own dice's; drawn as repeats near the camera (cars.js; a machine the shelf's assembly)
  const vehicles = [], machines = new Map();
  // ITS INDUSTRY (industry.js): its pieces stamped by key, the halls a pylon keeps clear of
  const indStamps = new Map(), halls = [];
  // ITS WATERFRONT'S KIT (waterfront.js): parasols, patios, loungers, bollards, railings, piles, planters, boats
  const wfStamps = new Map();
  // ITS CELL TOWERS (rooftop.js: a monopole's foot) and its tall buildings' tops, for their aviation lights
  const towersAt = [];
  counts.industry = {};
  // (a tipper the site's own waiting truck, SITE.truck: one template between them)
  const machineAt = (arch, pos, rotZ) => { counts.machines = (counts.machines ?? 0) + 1; if (arch === SITE.truck[0]) { siteNear('truck', pos, rotZ); return; } (machines.get(arch) ?? machines.set(arch, []).get(arch)).push({ pos: P3(pos), ...(rotZ ? { rotZ: r5(rotZ) } : {}) }); };
  // (its nose along `nose`, [dx, dy])
  const vehicleAt = (role, x, y, z, nose, key) => {
    const v = pickOf(fleetOf(role), streamOf(seed, 'fleet', key)), heading = Math.atan2(-nose[0], nose[1]);
    if (v.model.startsWith('site:')) machineAt(v.model.slice(5), [x, y, z], heading);
    else { parkCar(vehicles, { x, y, z, heading, paint: v.paint, model: v.model, ...(v.extra ? { extra: v.extra } : {}) }); counts.vehicles = (counts.vehicles ?? 0) + 1; }
  };
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
  // (each composed town's outline and its faces, for the town-seams law: its ground meets the metro's round it)
  const seamsOf = [];
  // (each building as it is laid: its footprint, foot, eave and top, its group, for the physical ring)
  const shells = [], shell = (x0, y0, x1, y1, z0, ze, z1, group, flat = false) => shells.push({ id: `geocity-b${shells.length}`, min: [x0, y0, z0], max: [x1, y1, z1], eave: ze, group, ...(flat ? { flat: true } : {}) });
  const box = (x0, y0, x1, y1, z0, z1, wall, roof, group) => {
    shell(Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1), z0, z1 - Math.min(0.3, (z1 - z0) / 4), z1, group, true);
    hold(x0, y0, x1, y1, z0, z1, `${holder}:${group.slice(8)}`);
    put([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], `${group}:roof`, roof);
    put([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], group, wall, [0, -1, 0]);
    put([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], group, wall, [1, 0, 0]);
    put([[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]], group, wall, [0, 1, 0]);
    put([[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], group, wall, [-1, 0, 0]);
    counts.buildings++;
  };
  // a mass under a gable, its ridge along `axis` ('x' or 'y')
  const gable = (x0, y0, x1, y1, z0, ze, zr, axis, wall, roof, group) => {
    shell(Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1), z0, ze, zr, group);
    hold(x0, y0, x1, y1, z0, zr, `${holder}:${group.slice(8)}`);
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
  // (what the composed geotowns hand back: their trees, their readouts, and the textures of all)
  const townRepeats = [], towns = {};
  // (read by the seventh generation, ctx.form: the metro's soft ground is the form's land and its trees the form's own,
  // FORM_GROUND and `plants`; its composed towns built so too, their plants carried into the metro's)
  const form = !!ctx.form, townPlants = [];
  let textures = null;
  // an evocation's tiers: its blocks at a building's detail, the neighbourhoods round them as massing, the rest its
  // skyline (each neighbourhood's ground one coarse drape, its tall buildings on it, nothing low)
  const E = d.evoked, detail = new Set(E?.blocks ?? []), massed = E ? new Set(E.regions) : null, lots = [];
  // (each block's terraces, read again by what is walked into: geocity/podium.js)
  const zOf = new Map();
  for (const r of d.regions) {
    if (r.geotown) { town(r, massed && !massed.has(r.id)); continue; }
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
      const padGroup = IND_GROUND[b.kind]?.[0] ?? (padHex === col.plaza ? 'geocity:paving' : { construction: 'geocity:site', parking: 'geocity:lot', vacant: 'geocity:scrub' }[b.kind] ?? 'geocity:pad');
      // (a block given to the geotown: its block built by the town, the green round it; no pad of the metro's)
      if (b.geotown) { blockTown(b, false); continue; }
      terraces.forEach((t, k) => {
        const [a0, b0, a1, b1] = t.q;
        put([[a0, b0, t.z], [a1, b0, t.z], [a1, b1, t.z], [a0, b1, t.z]], padGroup, IND_GROUND[b.kind]?.[1] ?? padHex);
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
      holder = b.id; zOf.set(b.id, zAt);
      if (detail.has(b.id) && DETAILED.includes(b.kind)) detailed(b, { x0, y0, x1, y1, zAt, Rb });
      else building(b, { x0, y0, x1, y1, longY, zAt, Rb });
      holder = null;
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
            let prev = null, pole = 0;
            for (let s0 = a + 6; s0 <= b - 6; s0 += HYDRO) {
              const [x, yy] = pt(side, s0), z = S(x, yy) + KERB;
              stamp(`hydro:${face(side)}`, [x, yy, z], 0);
              // (a transformer's can hung on every fourth pole)
              if (pole++ % 4 === 2) stamp(`can:${face(side)}`, [x, yy, z], 0);
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
              plant(r.industrial ? 'dense' : 'low', x, yy, S(x, yy), `${st.id}:${sd}:${Math.round(s0)}`);
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

  /** A geotown's neighbourhood (towns.js): the green round its frame on the land, and the town itself, built by the
   *  geotown (geotown/scene.js, on the metro's land, at the metro's hour) and stood in its frame's place; its trees
   *  drawn near the camera only, like the metro's. As the skyline sees it: its houses as boxes on its pads. */
  function town(r, far) {
    const T = r.geotown, [ox, oy] = T.origin, W = T.frame.W, D = T.frame.D, [x0, y0, x1, y1] = r.rect;
    for (const q of [[x0, y0, x1, oy], [x0, oy + D, x1, y1], [x0, oy, ox, oy + D], [ox + W, oy, x1, oy + D]]) if (q[2] - q[0] > 0.05 && q[3] - q[1] > 0.05) drape(q, 'geocity:margin', col.lawn, 0, far ? FAR_CELL : CELL);
    if (far) {
      drape([ox, oy, ox + W, oy + D], 'geocity:ground', mix(col.lawn, col.road, 0.35), 0, FAR_CELL);
      const pads = new Map(T.design.plots.map((pl) => [pl.id, pl.pad]));
      for (const sf of T.design.surfaces.filter((x) => x.cls === 'house' && x.plot)) {
        const q = sf.rect, z = (pads.get(sf.plot) ?? T.field((q[0] + q[2]) / 2, (q[1] + q[3]) / 2));
        box(ox + q[0], oy + q[1], ox + q[2], oy + q[3], z, z + 8, HOUSE_BRICK[strHash(sf.plot) % HOUSE_BRICK.length], ROOFS[0], 'geocity:low');
      }
      return;
    }
    const P = assembleGeotownScene({ kind: 'geocube', cube: m.cube, show: 'geotown', seed: T.seed, ...(m.hour !== undefined ? { hour: m.hour } : {}), ...(m.clouds !== undefined ? { clouds: m.clouds } : {}), geotown: T.spec, walk: false }, { field: T.field, ...(T.streets ? { streets: T.streets } : {}), ...(form ? { form: true } : {}) });
    const mv = (p) => [r5(p[0] + ox), r5(p[1] + oy), p[2]], at0 = faces.length;
    for (const f of P.faces) faces.push({ ...f, corners: f.corners.map(mv) });
    seamsOf.push({ id: r.id, rect: [ox, oy, ox + W, oy + D], from: at0, to: faces.length });
    if (P.plants) townPlants.push({ p: P.plants, at: [ox, oy] });
    // (its houses' boxes, in the metro's frame)
    for (const c of P.colliders ?? []) colliders.push({ ...c, min: P3(mv(c.min)), max: P3(mv(c.max)), of: `${r.id}:${c.of}` });
    for (const rp of P.repeats ?? []) townRepeats.push({ ...rp, group: `geocity:town-${rp.group ?? 'repeat'}`, transforms: rp.transforms.map((t) => ({ ...t, pos: mv(t.pos) })), near: NEAR });
    if (P.textures) textures = { ...(textures || {}), ...P.textures };
    towns[r.id] = { grid: T.design.spec.grid ?? null, streetscape: T.design.pattern.streetscape, frame: T.frame, origin: T.origin, counts: P.geotown.counts, laws: P.geotown.laws.filter((l) => !l.ok).map((l) => `${l.law}: ${l.value}`) };
  }

  /** A block given to the geotown (towns.js blockTownsOf): its segment built by the geotown (on the metro's land, at its
   *  hour), only what stands on its block (its streets the metro's), shifted into the metro's block; the green round it.
   *  As the skyline sees it: its houses as boxes. */
  function blockTown(b, far) {
    const T = b.geotown, [dx, dy] = T.shift, g = T.rect, q = [g[0] + dx, g[1] + dy, g[2] + dx, g[3] + dy], [x0, y0, x1, y1] = b.rect;
    for (const s2 of [[x0, y0, x1, Math.max(y0, q[1])], [x0, Math.min(y1, q[3]), x1, y1], [x0, Math.max(y0, q[1]), Math.max(x0, q[0]), Math.min(y1, q[3])], [Math.min(x1, q[2]), Math.max(y0, q[1]), x1, Math.min(y1, q[3])]]) if (s2[2] - s2[0] > 0.05 && s2[3] - s2[1] > 0.05) drape(s2, 'geocity:margin', col.lawn, KERB, far ? FAR_CELL : CELL);
    const inside = (x, y) => x >= g[0] - 0.3 && x <= g[2] + 0.3 && y >= g[1] - 0.3 && y <= g[3] + 0.3;
    if (far) {
      const pads = new Map(T.design.plots.map((pl) => [pl.id, pl.pad]));
      for (const sf of T.design.surfaces.filter((x) => x.cls === 'house' && x.plot && x.block === T.block)) {
        const r0 = sf.rect, z = pads.get(sf.plot) ?? T.field((r0[0] + r0[2]) / 2, (r0[1] + r0[3]) / 2);
        box(r0[0] + dx, r0[1] + dy, r0[2] + dx, r0[3] + dy, z, z + 8, HOUSE_BRICK[strHash(sf.plot) % HOUSE_BRICK.length], ROOFS[0], 'geocity:low');
      }
      return;
    }
    const P = assembleGeotownScene({ kind: 'geocube', cube: m.cube, show: 'geotown', seed: T.seed, ...(m.hour !== undefined ? { hour: m.hour } : {}), ...(m.clouds !== undefined ? { clouds: m.clouds } : {}), geotown: T.spec, walk: false }, { field: T.field, ...(T.streets ? { streets: T.streets } : {}), ...(form ? { form: true } : {}) });
    const mv = (p) => [r5(p[0] + dx), r5(p[1] + dy), p[2]], at0 = faces.length;
    for (const f of P.faces) {
      const c = f.corners, cx = c.reduce((a, p) => a + p[0], 0) / c.length, cy = c.reduce((a, p) => a + p[1], 0) / c.length;
      if (inside(cx, cy)) faces.push({ ...f, corners: c.map(mv) });
    }
    seamsOf.push({ id: b.id, rect: q, from: at0, to: faces.length });
    if (P.plants) townPlants.push({ p: P.plants, at: [dx, dy], keep: (x, y) => inside(x, y) });
    // (the boxes of what stands on its block, in the metro's frame, cut to the block: a front's steps the crop leaves
    // out never stand on the metro's walk)
    for (const c of P.colliders ?? []) {
      if (!inside((c.min[0] + c.max[0]) / 2, (c.min[1] + c.max[1]) / 2)) continue;
      const lo = mv(c.min), hi = mv(c.max), mn = [Math.max(lo[0], x0), Math.max(lo[1], y0), lo[2]], mx = [Math.min(hi[0], x1), Math.min(hi[1], y1), hi[2]];
      if (mx[0] > mn[0] && mx[1] > mn[1]) colliders.push({ ...c, min: P3(mn), max: P3(mx), of: `${b.id}:${c.of}` });
    }
    for (const rp of P.repeats ?? []) {
      const ts = rp.transforms.filter((t) => inside(t.pos[0], t.pos[1]));
      if (ts.length) townRepeats.push({ ...rp, group: `geocity:town-${rp.group ?? 'repeat'}`, transforms: ts.map((t) => ({ ...t, pos: mv(t.pos) })), near: NEAR });
    }
    if (P.textures) textures = { ...(textures || {}), ...P.textures };
    towns[b.id] = { segment: T.spec.segment ?? null, streetscape: T.design.pattern.streetscape, rect: q.map(r5), laws: P.geotown.laws.filter((l) => !l.ok).map((l) => `${l.law}: ${l.value}`) };
  }

  /** A neighbourhood as the skyline sees it: its ground one coarse drape, its tall buildings standing on it. */
  function backdrop(r) {
    if (r.park) { drape(r.rect, 'geocity:park', col.park, 0, FAR_CELL); return; }
    drape(r.rect, 'geocity:ground', r.builds === 'outskirts' ? mix(col.lawn, col.road, 0.35) : mix(col.plaza, col.road, 0.5), 0, FAR_CELL);
    for (const b of r.blocks) {
      if (b.kind === 'park') continue;
      const [x0, y0, x1, y1] = b.rect, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, z = S(cx, cy) + KERB, longY = y1 - y0 >= x1 - x0;
      if (b.geotown) { blockTown(b, true); continue; }
      if (TALL.includes(b.kind) || b.kind === 'construction' || INDUSTRY_SEGMENTS.includes(b.kind)) { building(b, { x0, y0, x1, y1, longY, zAt: () => z, Rb: streamOf(seed, 'scene', b.id), far: true }); continue; }
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
    // (a lot's ground floor the frontage's, its storefronts, lobby or entries; its storeys over it the facade's; a tower's
    // shaft its lobby among shops where it meets the walk)
    const lot = (id, [a0, b0, a1, b1], z0, floors, floorH, skin, use, { skip = [], ...extra } = {}) => { lots.push({ id, x0: a0, y0: b0, x1: a1, y1: b1, z0, h: floors * floorH, floors, floorH, skin, use, front, shopfront: use !== 'residential', ...extra }); frontOf(b, [a0, b0, a1, b1], z0, floors, floorH, use === 'office' ? 'office' : use === 'mixed' ? 'mixed' : 'residential', { ground: true, skip }); };
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
      const inner = [['n'], ['s'], ['e', 's', 'n'], ['w', 's', 'n']];
      [[x0, y0, x1, y0 + dp], [x0, y1 - dp, x1, y1], [x0, y0 + dp, x0 + dp, y1 - dp], [x1 - dp, y0 + dp, x1, y1 - dp]].forEach((q, k) => lot(`${b.id}:m${k}`, q, zc, Math.max(1, Math.round(med)), resid, 'brick', 'residential', { skip: inner[k] }));
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
      frontOf(b, pod, zc, b.podium, office, 'mixed');
      for (const t of b.towers) {
        const [a0, b0, a1, b1] = t.rect, z0 = zAt((a0 + a1) / 2, (b0 + b1) / 2), z1 = z0 + t.storeys * office;
        const glassy = Rb() < G.skin.towerGlass;
        box(a0, b0, a1, b1, z0, z1, glassy ? g : frame, frame, 'geocity:tower');
        // (its shaft's ground floor where it meets the walk: a lobby among shops; its shaft over it the tower's skin)
        frontOf(b, t.rect, z0, t.storeys, office, 'office', { ground: true });
        // (a glass tower's walls take the sun's sheen)
        if (glassy) for (const f of faces.slice(-4)) f.spec = GLASS_SPEC;
        lights(a0, b0, a1, b1, z0, z1, office, Rb);
        counts.towers++;
      }
    } else if (b.kind === 'podium') {
      const q = inset(0.8), [, ston] = famOf(stone, b.id), z1 = zc + med * office;
      box(q[0], q[1], q[2], q[3], zc, z1, ston, roofs[strHash(b.id) % roofs.length], 'geocity:podium');
      lights(q[0], q[1], q[2], q[3], zc, z1, office, Rb);
      frontOf(b, q, zc, med, office, 'office');
    } else if (b.kind === 'square') {
      const e = Math.min(w, h) * 0.18;
      put([[x0 + e, y0 + e, zc + 0.02], [x1 - e, y0 + e, zc + 0.02], [x1 - e, y1 - e, zc + 0.02], [x0 + e, y1 - e, zc + 0.02]], 'geocity:planting', col.court);
      box(cx - 4, cy - 4, cx + 4, cy + 4, zc, zc + 4, col.plaza, roofs[0], 'geocity:kiosk');
    } else if (b.kind === 'midrise') {
      const dp = Math.min(14, w / 3, h / 3), [, br] = famOf(brick, b.id), roof = roofs[strHash(b.id) % roofs.length], z1 = zc + med * resid;
      put([[x0 + dp, y0 + dp, zc + 0.02], [x1 - dp, y0 + dp, zc + 0.02], [x1 - dp, y1 - dp, zc + 0.02], [x0 + dp, y1 - dp, zc + 0.02]], 'geocity:court', col.court);
      // (its four wings round its court: each wing's walls on the court and at its joins inside it)
      const inner = [['n'], ['s'], ['e', 's', 'n'], ['w', 's', 'n']];
      [[x0, y0, x1, y0 + dp], [x0, y1 - dp, x1, y1], [x0, y0 + dp, x0 + dp, y1 - dp], [x1 - dp, y0 + dp, x1, y1 - dp]].forEach((q, k) => {
        box(q[0], q[1], q[2], q[3], zc, z1, br, roof, 'geocity:midrise');
        lights(q[0], q[1], q[2], q[3], zc, z1, resid, Rb);
        frontOf(b, q, zc, med, resid, 'residential', { skip: inner[k] });
      });
    } else if (b.kind === 'slab') {
      const long = Math.max(w, h) * 0.72, dp = Math.min(15, Math.min(w, h) * 0.35), [, ston] = famOf(stone, b.id), z1 = zc + med * resid;
      const q = longY ? [cx - dp / 2, cy - long / 2, cx + dp / 2, cy + long / 2] : [cx - long / 2, cy - dp / 2, cx + long / 2, cy + dp / 2];
      const lot = longY ? [x0 + 3, y0 + 3, x0 + Math.min(w * 0.3, 26), y1 - 3] : [x0 + 3, y0 + 3, x1 - 3, y0 + Math.min(h * 0.3, 26)];
      put([[lot[0], lot[1], zAt(cx, cy) + 0.02], [lot[2], lot[1], zAt(cx, cy) + 0.02], [lot[2], lot[3], zAt(cx, cy) + 0.02], [lot[0], lot[3], zAt(cx, cy) + 0.02]], 'geocity:lot', col.lot);
      box(q[0], q[1], q[2], q[3], zc, z1, ston, roofs[strHash(b.id) % roofs.length], 'geocity:slab');
      lights(q[0], q[1], q[2], q[3], zc, z1, resid, Rb);
      frontOf(b, q, zc, med, resid, 'residential');
    } else if (b.kind === 'construction') going(b, { x0, y0, x1, y1, longY, zAt, Rb, far });
    else if (b.kind === 'parking') parked(b, { x0, y0, x1, y1, longY, zAt, Rb });
    // (a vacant block by its neighbourhood's sites its contractor's yard, fleets.js: their machines staged on it)
    else if (b.kind === 'vacant' && d.yards?.[b.id]) { fenced(b, { x0, y0, x1, y1 }, zAt((x0 + x1) / 2, (y0 + y1) / 2), 'fence'); yardOf(b, d.yards[b.id], { x0, y0, x1, y1, longY, zAt }); }
    else if (b.kind === 'vacant') fenced(b, { x0, y0, x1, y1 }, zAt((x0 + x1) / 2, (y0 + y1) / 2), 'fence');
    else if (INDUSTRY_SEGMENTS.includes(b.kind)) industrial(b, { zAt, Rb, far });
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
    // near: the construction shelf's tower crane at a corner of the site, its jib over the building, its mast as many
    // sections as clear the building's core; one taller than its mast stands freestanding keeps the massing crane
    const sections = Math.ceil((top + 2 * fh + SITE.craneMinClear - zc - TOWER.base - TOWER.head) / TOWER.per), shelf = !far && sections <= TOWER.max;
    if (shelf) {
      const k = Math.max(TOWER.min, sections), at = [x0 + 4.6, y0 + 4.6, zc];
      siteStamps.set(`crane:${k}`, [...(siteStamps.get(`crane:${k}`) ?? []), { pos: P3(at), ...(longY ? {} : { rotZ: r5(-Math.PI / 2) }) }]);
      counts.cranes = (counts.cranes ?? 0) + 1;
    }
    // the crane: its mast at a corner of the site, its jib across the building, its counter-jib and weight, its cab
    const mx = x0 + 3, my = y0 + 3, mt = top + 3 * fh + 14, jib = Math.max(w, h) * 0.85;
    if (!shelf) {
      box(mx, my, mx + 2, my + 2, zc, mt, yellow, yellow, 'geocity:crane');
      if (longY) { box(mx - 0.4, my, mx + 2.4, my + jib, mt, mt + 1.6, yellow, yellow, 'geocity:crane'); box(mx - 0.2, my - 14, mx + 2.2, my, mt, mt + 1.4, yellow, yellow, 'geocity:crane'); box(mx - 0.8, my - 13, mx + 2.8, my - 9, mt - 2.2, mt, conc, conc, 'geocity:crane'); }
      else { box(mx, my - 0.4, mx + jib, my + 2.4, mt, mt + 1.6, yellow, yellow, 'geocity:crane'); box(mx - 14, my - 0.2, mx, my + 2.2, mt, mt + 1.4, yellow, yellow, 'geocity:crane'); box(mx - 13, my - 0.8, mx - 9, my + 2.8, mt - 2.2, mt, conc, conc, 'geocity:crane'); }
      box(mx + 2, my, mx + 4.2, my + 2, mt - 3, mt, '#d8d4c8', '#d8d4c8', 'geocity:crane');
    }
    if (far) return;
    // inside the hoarding, near the camera: an excavator digging on the band beside the building, facing it, and a
    // tipper waiting on the band along its front, nose along it (each where the band is wide enough to hold it)
    const bx = x1 - (x1 - q[2]) / 2, by = y0 + (q[1] - y0) / 2;
    if (x1 - q[2] >= 7) siteNear('digger', [bx, cy, zc], Math.PI / 2);
    if (q[1] - y0 >= 6) siteNear('truck', [cx, by, zc], -Math.PI / 2);
    // (and its mixer on the band along its back: the construction shelf's)
    if (y1 - q[3] >= 6) machineAt('mixerTruck', [cx, y1 - (y1 - q[3]) / 2, zc], Math.PI / 2);
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
    // (a parking block given to a role, design.js `yards`: its yard; else a car park)
    const yard = d.yards?.[b.id] ?? 'lot';
    if (yard !== 'lot') { yardOf(b, yard, { x0, y0, x1, y1, longY, zAt }); return; }
    // (a cell tower in a corner of some, rooftop.js)
    if (streamOf(seed, 'celltower', b.id)() < 0.2) towersAt.push([x0 + 3, y0 + 3, zAt(x0 + 3, y0 + 3)]);
    const z = zAt((x0 + x1) / 2, (y0 + y1) / 2), [s0, s1] = longY ? [x0, x1] : [y0, y1], [a0, a1] = longY ? [y0, y1] : [x0, x1];
    for (let m = s0 + 2; m + 10 <= s1 - 2; m += 16.5) for (const row of [m, m + 11.5]) for (let t = a0 + 3; t + 2.6 <= a1 - 3; t += 2.6) {
      // its line (across its row, 5 m) and, in most stalls, a car, its nose to the aisle (the registry's: fleets.js)
      stamp('stall', longY ? [row, t, z + 0.03] : [t, row, z + 0.03], longY ? 0 : Math.PI / 2);
      if (Rb() < 0.72) {
        const c = longY ? [row + 2.5, t + 1.3] : [t + 1.3, row + 2.5], out = row === m ? 1 : -1;
        Rb();   // (its paint's die, as it was: the fleet's own dice paint it now)
        vehicleAt('civilian', c[0], c[1], z, longY ? [out, 0] : [0, out], `${b.id}:${r5(c[0])}:${r5(c[1])}`);
      }
    }
  }

  /** A YARD (fleets.js YARDS): a parking block a role keeps its vehicles in; its building at its far end (a station with
   *  its bays, a shed), its vehicles in pairs of rows across it, each nose to the aisle between, a stall each. */
  function yardOf(b, yard, { x0, y0, x1, y1, longY, zAt }) {
    const Y = YARDS[yard], z = zAt((x0 + x1) / 2, (y0 + y1) / 2), Ry = streamOf(seed, 'yard', b.id);
    const [s0, s1] = longY ? [x0, x1] : [y0, y1], [a0, a1] = longY ? [y0, y1] : [x0, x1], P = (a, sv) => (longY ? [sv, a] : [a, sv]);
    // its building: a station of brick, its bay doors to the yard; a shed of sheeting
    const station = Y.building === 'station', bd = station ? 16 : 12, bh = station ? 8 : 6.5, b0 = a1 - 2 - bd;
    if (a1 - a0 > bd + 30) {
      const p = P(b0, s0 + 3), q = P(a1 - 2, s1 - 3);
      const sf = station ? null : finishOf('shed', Ry);
      box(Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1]), z, z + bh, station ? '#8a3b2c' : sf.wall, station ? ROOFS[0] : sf.roof, station ? 'geocity:station' : sf.group);
      // (its doors to the yard: a station's tall bays, a shed's roller doors)
      const n = Math.max(1, Math.floor((s1 - s0 - 8) / 6)), dw = station ? 4 : 3.6, dh = station ? 4.4 : 4;
      for (let k = 0; k < n; k++) {
        const c = s0 + 4 + ((k + 0.5) * (s1 - s0 - 8)) / n, A = P(b0 - 0.03, c - dw / 2), B = P(b0 - 0.03, c + dw / 2);
        put([[A[0], A[1], z], [B[0], B[1], z], [B[0], B[1], z + dh], [A[0], A[1], z + dh]], 'geocity:door', '#2d3033', longY ? [0, -1, 0] : [-1, 0, 0]);
      }
    }
    // its stalls: a vehicle's length deep, its width and a walk between wide, in pairs of rows about an aisle
    const roles = Object.entries(Y.roles), deep = yard === 'depot' ? 14 : yard === 'contractor' ? 11.5 : 10.5, wide = yard === 'depot' ? 4.2 : yard === 'contractor' ? 4.6 : 3.8, aisle = yard === 'depot' ? 14 : 9;
    const roleOf = () => { const t = Ry() * roles.reduce((s2, [, w]) => s2 + w, 0); let u = 0; for (const [r, w] of roles) { u += w; if (t <= u) return r; } return roles[roles.length - 1][0]; };
    const end = (a1 - a0 > bd + 30 ? b0 - 3 : a1 - 3);
    for (let a = a0 + 3; a + 2 * deep + aisle <= end; a += 2 * deep + aisle) for (const [r0, out] of [[a, 1], [a + deep + aisle, -1]]) {
      for (let sv = s0 + 3; sv + wide <= s1 - 3; sv += wide) {
        if (Ry() >= 0.82) continue;
        const c = P(r0 + deep / 2, sv + wide / 2);
        vehicleAt(roleOf(), c[0], c[1], z, longY ? [0, out] : [out, 0], `${b.id}:${r5(c[0])}:${r5(c[1])}`);
      }
    }
    counts.yards = { ...(counts.yards ?? {}), [yard]: (counts.yards?.[yard] ?? 0) + 1 };
  }

  /** THE WATERFRONT (waterfront.js): each reclaimed strip on its ground (the land's at its back, falling to its
   *  promenade a little over the water), its boulevard along its main shore (its walks, its lanes, its arterials run on
   *  to it), its segments each their own way of meeting the water (a quay's wall and its bollards, piers on piles, a
   *  restaurant row's patios, a park's lawn and rocks, a beach's sand into the water under parasols, a marina's pontoons
   *  and boats, timber steps down to the water), a promenade along its edge (its lamps, its benches facing the water,
   *  a railing where it drops), walls down to the water where its edge steps; the kit and its boats near the camera. */
  function waterfront() {
    const Ws = d.waterfront ?? [];
    if (!Ws.length) return;
    const zw = zWater, PROM = WATERFRONT.promenade, wfs = (key, pos, extra = {}) => (wfStamps.get(key) ?? wfStamps.set(key, []).get(key)).push({ pos: P3(pos), ...extra });
    for (const W of Ws) {
      const fr = frameOf(W), P = fr.P, ax = fr.along === 'x', out = [fr.out[0], fr.out[1], 0], back = [-fr.out[0], -fr.out[1], 0];
      const alongV = ax ? [1, 0, 0] : [0, 1, 0], rotA = ax ? 0 : Math.PI / 2, rotT = ax ? Math.PI / 2 : 0, axA = ax ? 'x' : 'y', axT = ax ? 'y' : 'x';
      const zl = (a) => S(...P(a, 0)), zq = (a) => Math.min(zw + 2.2, Math.max(zw + WATERFRONT.quay - 0.4, zl(a) - 0.2));
      const BV = W.boulevard, tc0 = BV ? BV.t1 : 0;
      // (a quad in the strip's frame: a0…a1 along, t0…t1 out, its height at each corner)
      const quad = (a0, a1, t0, t1, z, group, hex, want = null) => { const c = [[a0, t0], [a1, t0], [a1, t1], [a0, t1]].map(([a, t]) => [...P(a, t), z(a, t)]); put(c, group, hex, want); };
      const wall = (a0, a1, t, ztop, zbot, group, hex, facing = out) => put([[...P(a0, t), zbot], [...P(a1, t), zbot], [...P(a1, t), ztop(a1)], [...P(a0, t), ztop(a0)]], group, hex, facing);
      const cut = (a0, a1, step) => { const n = Math.max(1, Math.ceil((a1 - a0) / step)); return Array.from({ length: n }, (_, i) => [a0 + ((a1 - a0) * i) / n, a0 + ((a1 - a0) * (i + 1)) / n]); };
      const col2 = { quay: '#bdb7aa', deck: '#9b7d5a', prom: '#c8c2b4', sand: '#d9c9a0', pontoon: '#b9b3a6', wall: '#a8a49b', rip: '#8f8a80' };
      // its back: a walk along the land's edge, the boulevard (its walks at a kerb over its road), the arterials on to it
      if (BV) {
        const road0 = BV.t0 + 6, road1 = BV.t1 - 6;
        for (const [p, q] of cut(W.a0, W.a1, CELL)) {
          quad(p, q, 0, BV.t0, (a) => zl(a) + KERB, 'geocity:walk', col.walk);
          quad(p, q, BV.t0, road0, (a) => zl(a) + KERB, 'geocity:walk', col.walk);
          quad(p, q, road0, road1, (a) => zl(a), 'geocity:road', col.road);
          quad(p, q, road1, BV.t1, (a) => zl(a) + KERB, 'geocity:walk', col.walk);
          wall(p, q, road0, (a) => zl(a) + KERB, 0, 'geocity:retain', col.retain);
        }
        const mid = (road0 + road1) / 2;
        for (let a = W.a0 + 2; a + 10 <= W.a1; a += 10) { const [x, y] = P(a, mid); wfsKit('yellow', [x, y, zl(a) + 0.05], rotA); for (const o of [-4, 4]) { const [x2, y2] = P(a, mid + o); wfsKit('dash', [x2, y2, zl(a) + 0.05], rotA); } }
        // (each arterial that reaches the shore run on across the land's edge to the boulevard)
        for (const l of d.lines) {
          if ((l.axis === 'ns') !== ax || l.at < W.a0 || l.at > W.a1) continue;
          quad(l.at - l.road / 2, l.at + l.road / 2, -0.5, road0, (a) => zl(a) + KERB + 0.01, 'geocity:road', col.road);
        }
      } else for (const [p, q] of cut(W.a0, W.a1, CELL)) quad(p, q, 0, 6, (a) => zl(a) + KERB, 'geocity:walk', col.walk);
      const t0c = BV ? BV.t1 : 6;
      W.segments.forEach((g, k) => {
        // (a walker's box round each of its masses, but on the skyline, never walked)
        holder = E?.evoke === 'skyline' ? null : `wf-${W.side}-${k}`;
        const D = g.depth, te = D - PROM, mid = (g.a0 + g.a1) / 2, len = g.a1 - g.a0, R = streamOf(seed, 'waterfront', `${W.side}:${k}`);
        const zAt = (a, t) => (t <= t0c ? zl(a) + KERB : t >= te ? zq(a) : zl(a) + KERB + ((zq(a) - zl(a) - KERB) * (t - t0c)) / (te - t0c));
        const at = (a, t, dz = 0) => [...P(a, t), zAt(a, t) + dz];
        const soft = g.kind === 'park' || g.kind === 'steps' || g.kind === 'beach';
        // its ground: paved (a quay's granite) or a lawn, falling to its promenade; its promenade along its edge
        for (const [p, q] of cut(g.a0, g.a1, CELL)) {
          quad(p, q, t0c, g.kind === 'beach' ? te - 38 : te, zAt, soft ? 'geocity:park' : 'geocity:quay', soft ? col.park : col2.quay);
          if (g.kind === 'marina') quad(p, q, t0c + 26, t0c + 54, (a, t) => zAt(a, t) + 0.02, 'geocity:lot', col.lot);
          if (g.kind !== 'beach') quad(p, q, te, D, (a) => zq(a), g.kind === 'park' || g.kind === 'steps' ? 'geocity:deck' : 'geocity:promenade', g.kind === 'park' || g.kind === 'steps' ? col2.deck : col2.prom);
        }
        // its edge down to the water, by its kind
        const zqA = (a) => zq(a);
        if (g.kind === 'park') for (const [p, q] of cut(g.a0, g.a1, CELL)) quad(p, q, D, D + 7, (a, t) => (t <= D ? zq(a) : zw - 1.2), 'geocity:riprap', col2.rip);
        else if (g.kind === 'beach') {
          // (its sand from the boardwalk down to the water and on under it; a boardwalk behind it)
          for (const [p, q] of cut(g.a0, g.a1, CELL)) {
            quad(p, q, te - 30, D + 14, (a, t) => (t <= te - 30 ? zAt(a, te - 30) : t <= D ? zAt(a, te - 30) + ((zw + 0.25 - zAt(a, te - 30)) * (t - (te - 30))) / (D - (te - 30)) : zw + 0.25 - ((t - D) / 14) * 1.5), 'geocity:sand', col2.sand);
            quad(p, q, te - 38, te - 30, (a, t) => zAt(a, t) + 0.45, 'geocity:deck', col2.deck);
            wall(p, q, te - 30, (a) => zAt(a, te - 30) + 0.45, zAt(p, te - 30) - 0.1, 'geocity:deck', mix(col2.deck, '#000000', 0.3));
          }
          for (let a = g.a0 + 8; a <= g.a1 - 8; a += 9) for (let t = te - 24; t <= D - 8; t += 10) {
            const z = zAt(a, te - 30) + ((zw + 0.25 - zAt(a, te - 30)) * (t - (te - 30))) / (D - (te - 30));
            wfs('parasol', [...P(a, t), z], { tint: linC(WATERFRONT_PAINT.beach[Math.floor(R() * 2)]) });
            if (R() < 0.7) wfs(`lounger`, [...P(a + 1.2, t + 0.6), z], { rotZ: r5(rotT), tint: linC(WATERFRONT_PAINT.lounger[Math.floor(R() * WATERFRONT_PAINT.lounger.length)]) });
          }
        } else if (g.kind === 'steps') {
          // (timber steps down to the water: four of them, each a deck and its riser)
          const n = 4, z0 = (a) => zq(a), dz = (a) => (zq(a) - (zw + 0.3)) / n;
          for (let i = 0; i < n; i++) for (const [p, q] of cut(g.a0, g.a1, CELL)) {
            const zt = (a) => z0(a) - (i + 1) * dz(a);
            quad(p, q, D + i * 2, D + (i + 1) * 2, (a) => zt(a), 'geocity:deck', col2.deck);
            wall(p, q, D + i * 2, (a) => zt(a) + dz(a), zt(p), 'geocity:deck', mix(col2.deck, '#000000', 0.25));
          }
          for (const [p, q] of cut(g.a0, g.a1, CELL)) wall(p, q, D + 2 * n, (a) => zw + 0.3, zw - 1.5, 'geocity:quay-wall', col2.wall);
        } else for (const [p, q] of cut(g.a0, g.a1, CELL)) {
          const steel = g.kind === 'marina' || g.kind === 'pier';
          wall(p, q, D, zqA, zw - 1.5, steel ? 'geocity:quay-wall-steel' : 'geocity:quay-wall', steel ? '#3e403e' : col2.wall);
          quad(p, q, D - 0.5, D, (a) => zq(a) + 0.12, 'geocity:quay-wall', mix(col2.wall, '#ffffff', 0.25));
        }
        // its promenade's lamps and benches facing the water; a railing where it drops (bollards on a quay instead)
        if (g.kind !== 'beach') {
          for (let a = g.a0 + 12; a <= g.a1 - 6; a += 30) wfsKit(`lamp:${W.side}`, at(a, te + 1), 0);
          for (let a = g.a0 + 20; a <= g.a1 - 10; a += 25) wfsKit(`bench:${W.side}`, at(a, D - 3), 0);
          if (g.kind === 'dining' || g.kind === 'park') for (let a = g.a0; a + 3 <= g.a1; a += 3) wfs(`rail:${axA}`, at(a, D - 0.3));
          if (g.kind === 'quay' || g.kind === 'pier' || g.kind === 'marina') for (let a = g.a0 + 6; a <= g.a1 - 4; a += 15) wfs('bollard', at(a, D - 0.8));
        }
        // its content, by its kind
        const trees = (t0, t1, every) => { for (let a = g.a0 + 8; a <= g.a1 - 8; a += every) for (let t = t0; t <= t1; t += every) { const j = (R() - 0.5) * every * 0.5; plant('dense', ...P(a + j, t + j * 0.5), zAt(a, t), `wf:${W.side}:${k}:${Math.round(a)}:${Math.round(t)}`); } };
        const pav = (a0, a1, t0, t1, h, wallHex, roofHex) => { const p = P(a0, t0), q = P(a1, t1), z = zAt((a0 + a1) / 2, (t0 + t1) / 2); box(Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1]), z, z + h, wallHex, roofHex, 'geocity:pavilion'); };
        // (along its boulevard a row of the waterfront's own buildings: condominiums and offices, shops facing the water)
        if (BV && (g.kind === 'quay' || g.kind === 'pier' || g.kind === 'dining')) {
          const pseudo = { id: `wf-${W.side}-${k}`, ring: 'frame', sides: Object.fromEntries(['s', 'n', 'e', 'w'].map((f) => [f, { kind: 'arterial' }])) };
          for (let a = g.a0 + 6; a + 24 <= g.a1 - 6;) {
            const wd = Math.min(g.a1 - 6 - a, 26 + R() * 30), storeys = Math.round((g.kind === 'dining' ? 3 : 5) + R() * (g.kind === 'dining' ? 4 : 10));
            const p = P(a, t0c + 6), q = P(a + wd, t0c + 34), z = zAt(a + wd / 2, t0c + 20), qq = [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1])];
            const brickish = R() < 0.5, wallHex = brickish ? HOUSE_BRICK[Math.floor(R() * HOUSE_BRICK.length)] : ['#b8c2c9', '#cfc8ba', '#9fb3bd'][Math.floor(R() * 3)];
            box(qq[0], qq[1], qq[2], qq[3], z, z + storeys * resid, wallHex, ROOFS[Math.floor(R() * ROOFS.length)], brickish ? 'geocity:midrise' : 'geocity:podium');
            lights(qq[0], qq[1], qq[2], qq[3], z, z + storeys * resid, resid, R);
            frontOf(pseudo, qq, z, storeys, resid, 'residential');
            a += wd + 10 + R() * 8;
          }
        }
        // (its plazas furnished: a kiosk now and then, planters)
        if (g.kind === 'quay' || g.kind === 'pier' || g.kind === 'dining') for (let a = g.a0 + 30; a <= g.a1 - 20; a += 60) {
          const [x, y] = P(a, te - 14), z = zAt(a, te - 14);
          box(x - 2.2, y - 2.2, x + 2.2, y + 2.2, z, z + 3.2, ['#2f5d8a', '#c4362c', '#3d7a4a'][Math.floor(R() * 3)], '#e9e5dc', 'geocity:kiosk');
          for (const da of [-6, 6]) wfs('planter', at(a + da, te - 14));
        }
        // (a quay's rink: a long sheet of ice in the plaza, skated in winter, a reflecting pool in summer)
        if (g.kind === 'quay' && len > 120) quad(mid - 40, mid + 40, t0c + 80, t0c + 104, (a, t) => zAt(a, t) + 0.05, 'geocity:pool', '#a9cbd8');
        if (g.kind === 'quay' || g.kind === 'pier') {
          for (let a = g.a0 + 10; a <= g.a1 - 10; a += 14) for (const t of [t0c + 48, t0c + 72, te - 6]) plant('dense', ...P(a, t), zAt(a, t), `wf:${W.side}:${k}:${Math.round(a)}:${Math.round(t)}`);
          if (g.kind === 'quay') {
            pav(mid - 16, mid + 16, t0c + 52, t0c + 68, 7, '#9fb3bd', '#e4e1da');
            wfs(`boat-ferry:${axA}`, [...P(mid, D + 5.5), zw], {});
          }
        }
        if (g.kind === 'pier') for (const pr of g.piers) {
          // a finger pier out over the water on its piles, a shed or a restaurant on it, boats along it
          const pa0 = pr.a - pr.w / 2, pa1 = pr.a + pr.w / 2, t1 = D + pr.len, zp = zq(pr.a);
          quad(pa0, pa1, D, t1, () => zp, 'geocity:deck', col2.deck);
          for (const [aa, n] of [[pa0, ax ? [-1, 0, 0] : [0, -1, 0]], [pa1, ax ? [1, 0, 0] : [0, 1, 0]]]) put([[...P(aa, D), zp - 0.7], [...P(aa, t1), zp - 0.7], [...P(aa, t1), zp], [...P(aa, D), zp]], 'geocity:deck', mix(col2.deck, '#000000', 0.3), n);
          put([[...P(pa0, t1), zp - 0.7], [...P(pa1, t1), zp - 0.7], [...P(pa1, t1), zp], [...P(pa0, t1), zp]], 'geocity:deck', mix(col2.deck, '#000000', 0.3), out);
          for (let t = D + 3; t <= t1; t += 6) for (const aa of [pa0 + 0.3, pa1 - 0.3]) wfs('pile', [...P(aa, t), zw - 2], { scale: [1, 1, r5(zp - 0.7 - (zw - 2))] });
          for (let t = D; t + 3 <= t1; t += 3) for (const aa of [pa0 + 0.2, pa1 - 0.2]) wfs(`rail:${axT}`, [...P(aa, t), zp]);
          const shed = R() < 0.55;
          if (shed) { const p = P(pa0 + 2, D + 8), q = P(pa1 - 2, D + 8 + pr.len * 0.55), sf = finishOf('shed', R); box(Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1]), zp, zp + 7, sf.wall, sf.roof, sf.group); }
          else {
            const p = P(pa0 + 3, t1 - 26), q = P(pa1 - 3, t1 - 6); box(Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1]), zp, zp + 5, '#9fb3bd', '#8a6a48', 'geocity:pavilion');
            for (let t = D + 10; t <= t1 - 32; t += 5) for (const aa of [pr.a - pr.w / 4, pr.a + pr.w / 4]) { wfs('patio', [...P(aa, t), zp]); wfs('parasol', [...P(aa, t), zp], { tint: linC(WATERFRONT_PAINT.patio[Math.floor(R() * WATERFRONT_PAINT.patio.length)]) }); }
          }
          for (let t = D + pr.len * 0.25; t <= t1 - 10; t += 14) for (const sgn of [-1, 1]) if (R() < 0.6) wfs(`boat-${R() < 0.5 ? 'sail' : 'motor'}:${axT}`, [...P(pr.a + sgn * (pr.w / 2 + 2.2), t), zw], { tint: linC(WATERFRONT_PAINT.hull[Math.floor(R() * WATERFRONT_PAINT.hull.length)]) });
        }
        if (g.kind === 'dining') {
          // restaurant pavilions along its promenade, their patios out front of them, planters, a kiosk
          const n = Math.max(1, Math.floor(len / 46));
          for (let i = 0; i < n; i++) {
            const c = g.a0 + ((i + 0.5) * len) / n;
            pav(c - 11, c + 11, te - 34, te - 20, 4.5 + R() * 2, ['#9fb3bd', '#c9b48a', '#8a6a48'][Math.floor(R() * 3)], '#5d6266');
            for (let a = c - 10; a <= c + 10; a += 4) for (let t = te - 16; t <= te - 4; t += 4) { wfs('patio', at(a, t)); wfs('parasol', at(a, t), { tint: linC(WATERFRONT_PAINT.patio[(i + Math.floor(R() * 2)) % WATERFRONT_PAINT.patio.length]) }); }
            for (const a of [c - 12, c + 12]) wfs('planter', at(a, te - 10));
          }
          trees(t0c + 10, te - 40, 16);
        }
        if (g.kind === 'park') { trees(t0c + 8, te - 6, 15); for (let a = g.a0 + 6; a <= g.a1 - 6; a += 6) quad(a, Math.min(a + 6, g.a1 - 6), (t0c + te) / 2 - 2, (t0c + te) / 2 + 2, (aa, t) => zAt(aa, t) + 0.03, 'geocity:promenade', col2.prom); }
        if (g.kind === 'steps') { trees(t0c + 8, te - 20, 18); for (let a = g.a0 + 6; a <= g.a1 - 6; a += 7) if (R() < 0.7) wfs('lounger', at(a, te - 6 - R() * 10), { rotZ: r5(rotT + Math.PI), tint: linC(WATERFRONT_PAINT.lounger[Math.floor(R() * WATERFRONT_PAINT.lounger.length)]) }); }
        if (g.kind === 'beach') trees(t0c + 6, te - 42, 14);
        if (g.kind === 'marina') {
          // its clubhouse and its lot, its pontoons combed out into the water at the water's level, boats in their slips
          pav(mid - 14, mid + 14, t0c + 8, t0c + 22, 6, '#8a6a48', '#4a4f55');
          for (let a = g.a0 + 6; a + 3 <= g.a1 - 6; a += 3) for (const t of [t0c + 34, t0c + 46]) if (R() < 0.65) vehicleAt('civilian', ...P(a + 1.5, t), zAt(a, t), ax ? (t < t0c + 40 ? [0, out[1] * -1] : [0, out[1]]) : (t < t0c + 40 ? [-out[0], 0] : [out[0], 0]), `wf:${W.side}:${k}:${Math.round(a)}:${Math.round(t)}`);
          const zp = zw + 0.35, mains = len > 160 ? [mid - len / 4, mid + len / 4] : [mid];
          for (const m of mains) {
            const T1 = D + WATERFRONT.marina;
            quad(m - 1.5, m + 1.5, D + 4, T1, () => zp, 'geocity:pontoon', col2.pontoon);
            quad(m - 1.2, m + 1.2, D - 0.3, D + 4, (a, t) => zq(m) + ((zp - zq(m)) * (t - D + 0.3)) / 4.3, 'geocity:deck', col2.deck);
            for (let t = D + 10; t <= T1 - 4; t += 9) for (const sgn of [-1, 1]) {
              quad(sgn > 0 ? m + 1.5 : m - 12.5, sgn > 0 ? m + 12.5 : m - 1.5, t - 0.6, t + 0.6, () => zp, 'geocity:pontoon', col2.pontoon);
              if (R() < 0.8) wfs(`boat-${R() < 0.55 ? 'sail' : 'motor'}:${axA}`, [...P(m + sgn * 7.5, t + 4.5), zw], { tint: linC(WATERFRONT_PAINT.hull[Math.floor(R() * WATERFRONT_PAINT.hull.length)]) });
            }
          }
        }
        // (where its edge steps from its neighbour's, a wall down to the water across the step)
        const prev = W.segments[k - 1], dPrev = prev ? prev.depth : 0;
        if (Math.abs(dPrev - D) > 0.5) { const tA = Math.min(dPrev, D), tB = Math.max(dPrev, D), facing = dPrev < D ? alongV.map((v) => -v) : alongV; put([[...P(g.a0, tA), zw - 1.5], [...P(g.a0, tB), zw - 1.5], [...P(g.a0, tB), zq(g.a0)], [...P(g.a0, tA), zq(g.a0)]], 'geocity:quay-wall', col2.wall, facing); }
        if (k === W.segments.length - 1) put([[...P(g.a1, 0), zw - 1.5], [...P(g.a1, D), zw - 1.5], [...P(g.a1, D), zq(g.a1)], [...P(g.a1, 0), zl(g.a1)]], 'geocity:quay-wall', col2.wall, alongV);
        holder = null;
        counts.waterfront = { ...(counts.waterfront ?? {}), [g.kind]: (counts.waterfront?.[g.kind] ?? 0) + 1 };
      });
      put([[...P(W.a0, 0), zw - 1.5], [...P(W.a0, W.segments[0].depth), zw - 1.5], [...P(W.a0, W.segments[0].depth), zq(W.a0)], [...P(W.a0, 0), zl(W.a0)]], 'geocity:quay-wall', col2.wall, alongV.map((v) => -v));
    }
    function wfsKit(key, pos, rotZ) { stamp(key, pos, rotZ); }
  }

  /** THE HIGHWAYS (highways.js): each deck laid along its run in its stations' steps (its asphalt, its concrete fascia and
   *  underside, a barrier at each edge and down its median), on its piers (a pair of columns in its arterial's kerb
   *  lanes under a cap beam, one under its middle over the water); its lanes' lines and the lamps down its median near
   *  the camera; under it, nothing taller than its underside left standing (the street's lamps, its poles and their
   *  wires, its trees). */
  function highways() {
    const hws = d.highways ?? [];
    if (!hws.length) return;
    const conc = '#b7b3aa', barrier = '#cfcbc2', under = [];
    for (const h of hws) {
      const ax = h.axis === 'x', P = (u, off) => (ax ? [u, h.at + off] : [h.at + off, u]), half = h.w / 2, g = h.stations, D = HIGHWAY.depth;
      const across = ax ? [0, 1, 0] : [1, 0, 0], neg = across.map((v) => -v);
      // (a strip of it, from u0 to u1, between two offsets, its top `dz` over the deck: its top and its two sides)
      const strip = (u0, u1, o0, o1, dz, group, hex) => {
        const z0 = deckAt(h, u0), z1 = deckAt(h, u1), [a, b, c, e] = [P(u0, o0), P(u1, o0), P(u1, o1), P(u0, o1)];
        put([[a[0], a[1], z0 + dz], [b[0], b[1], z1 + dz], [c[0], c[1], z1 + dz], [e[0], e[1], z0 + dz]], group, hex);
        put([[a[0], a[1], z0], [b[0], b[1], z1], [b[0], b[1], z1 + dz], [a[0], a[1], z0 + dz]], group, hex, neg);
        put([[e[0], e[1], z0], [c[0], c[1], z1], [c[0], c[1], z1 + dz], [e[0], e[1], z0 + dz]], group, hex, across);
      };
      for (let i = 0; i + 2 < g.length; i += 2) {
        const u0 = g[i], u1 = g[i + 2], z0 = g[i + 1], z1 = g[i + 3], [a, b, c, e] = [P(u0, -half), P(u1, -half), P(u1, half), P(u0, half)];
        put([[a[0], a[1], z0], [b[0], b[1], z1], [c[0], c[1], z1], [e[0], e[1], z0]], 'geocity:highway', col.road);
        put([[a[0], a[1], z0 - D], [b[0], b[1], z1 - D], [b[0], b[1], z1], [a[0], a[1], z0]], 'geocity:highway-side', conc, neg);
        put([[e[0], e[1], z0 - D], [c[0], c[1], z1 - D], [c[0], c[1], z1], [e[0], e[1], z0]], 'geocity:highway-side', conc, across);
        put([[a[0], a[1], z0 - D], [b[0], b[1], z1 - D], [c[0], c[1], z1 - D], [e[0], e[1], z0 - D]], 'geocity:highway-side', mix(conc, '#000000', 0.25), [0, 0, -1]);
        for (const [o0, o1] of [[-half, -half + 0.45], [half - 0.45, half], [-HIGHWAY.median / 2 + 0.2, HIGHWAY.median / 2 - 0.2]]) strip(u0, u1, o0, o1, 0.85, 'geocity:barrier', barrier);
      }
      // its piers: columns up to its underside, a cap beam across under it
      for (const pr of h.piers) {
        const zt = deckAt(h, pr.u) - D, cw = h.water ? 2.4 : 1.6;
        for (const o of pr.cols) {
          const [x, y] = P(pr.u, o), zb = h.water ? zWater - 3 : S(x, y);
          put([[x - cw / 2, y - cw / 2, zb], [x + cw / 2, y - cw / 2, zb], [x + cw / 2, y - cw / 2, zt], [x - cw / 2, y - cw / 2, zt]], 'geocity:highway-side', conc, [0, -1, 0]);
          put([[x + cw / 2, y - cw / 2, zb], [x + cw / 2, y + cw / 2, zb], [x + cw / 2, y + cw / 2, zt], [x + cw / 2, y - cw / 2, zt]], 'geocity:highway-side', conc, [1, 0, 0]);
          put([[x + cw / 2, y + cw / 2, zb], [x - cw / 2, y + cw / 2, zb], [x - cw / 2, y + cw / 2, zt], [x + cw / 2, y + cw / 2, zt]], 'geocity:highway-side', conc, [0, 1, 0]);
          put([[x - cw / 2, y + cw / 2, zb], [x - cw / 2, y - cw / 2, zb], [x - cw / 2, y - cw / 2, zt], [x - cw / 2, y + cw / 2, zt]], 'geocity:highway-side', conc, [-1, 0, 0]);
          // (a walker's collider where the metro is walked: none on the skyline, an evocation's in what it masses)
          if (E?.evoke !== 'skyline' && (!massed || d.regions.some((r) => massed.has(r.id) && x >= r.rect[0] && x <= r.rect[2] && y >= r.rect[1] && y <= r.rect[3]))) colliders.push({ min: P3([x - cw / 2, y - cw / 2, zb]), max: P3([x + cw / 2, y + cw / 2, zt]), of: `${h.id}:pier` });
        }
        const [p0, p1] = [P(pr.u - 1, -half + 1), P(pr.u + 1, half - 1)], q = [Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1]), Math.max(p0[0], p1[0]), Math.max(p0[1], p1[1])];
        put([[q[0], q[1], zt - 1.3], [q[2], q[1], zt - 1.3], [q[2], q[1], zt], [q[0], q[1], zt]], 'geocity:highway-side', conc, [0, -1, 0]);
        put([[q[2], q[1], zt - 1.3], [q[2], q[3], zt - 1.3], [q[2], q[3], zt], [q[2], q[1], zt]], 'geocity:highway-side', conc, [1, 0, 0]);
        put([[q[2], q[3], zt - 1.3], [q[0], q[3], zt - 1.3], [q[0], q[3], zt], [q[2], q[3], zt]], 'geocity:highway-side', conc, [0, 1, 0]);
        put([[q[0], q[3], zt - 1.3], [q[0], q[1], zt - 1.3], [q[0], q[1], zt], [q[0], q[3], zt]], 'geocity:highway-side', conc, [-1, 0, 0]);
        put([[q[0], q[1], zt - 1.3], [q[2], q[1], zt - 1.3], [q[2], q[3], zt - 1.3], [q[0], q[3], zt - 1.3]], 'geocity:highway-side', mix(conc, '#000000', 0.25), [0, 0, -1]);
      }
      // its lanes' lines (a dash between each two each way, a solid line at each shoulder) and its median's lamps
      if (E?.evoke !== 'skyline') {
        const lane = HIGHWAY.lane, inner = HIGHWAY.median / 2 + HIGHWAY.shoulder, rot = ax ? 0 : Math.PI / 2;
        for (let u = h.lo + 2; u + 10 <= h.hi; u += 12) for (const sg of [-1, 1]) {
          const zz = Math.max(deckAt(h, u), deckAt(h, u + 10)) + 0.04;
          for (let k = 1; k < h.lanes; k++) { const [x, y] = P(u, sg * (inner + k * lane)); stamp('dash', [x, y, zz], rot); }
          for (const o of [inner - 0.15, inner + h.lanes * lane + 0.15]) { const [x, y] = P(u, sg * o); stamp('line', [x, y, zz], rot); }
        }
        for (let u = h.lo + 20; u <= h.hi - 10; u += 48) { const [x, y] = P(u, 0); for (const f of ax ? ['n', 's'] : ['e', 'w']) stamp(`lamp:${f}`, [x, y, deckAt(h, u) + 0.85], 0); }
      }
      if (!h.water) under.push(ax ? [h.lo, h.at - half - 2, h.hi, h.at + half + 2] : [h.at - half - 2, h.lo, h.at + half + 2, h.hi]);
      counts.highways = (counts.highways ?? 0) + 1;
    }
    // (under a deck: the street's lamps, its wooden poles and their wires, its trees taken out)
    const inUnder = (x, y) => under.some((q) => x > q[0] && x < q[2] && y > q[1] && y < q[3]);
    const TALLER = ['lamp', 'hydro', 'wire', 'can'];
    for (const [k, list] of stamps) if (TALLER.includes(k.split(':')[0])) stamps.set(k, list.filter((t) => { const zd = hws.find((h) => !h.water && (h.axis === 'x' ? Math.abs(t.pos[1] - h.at) < h.w / 2 + 2 : Math.abs(t.pos[0] - h.at) < h.w / 2 + 2)); return !(zd && inUnder(t.pos[0], t.pos[1]) && t.pos[2] < deckAt(zd, zd.axis === 'x' ? t.pos[0] : t.pos[1]) - 1); }));
    for (const [k, list] of trees) trees.set(k, list.filter((t) => !inUnder(t.x, t.y)));
  }

  /** THE GRID (industry.js PYLON): each industrial neighbourhood's substation fed by a high-voltage line on lattice
   *  pylons from the country beyond the land's edge, straight out from its switchyard across the neighbourhood, a pylon
   *  every span or so (stood clear of its halls and off its streets), six conductors sagging between each two, in from
   *  the switchyard's gantry. The skyline's draws its pylons, not its wires. */
  function grid() {
    const [Lx0, Ly0, Lx1, Ly1] = d.land.rect, sag = 0.035;
    const onStreet = (x, y) => d.lines.some((l) => Math.abs((l.axis === 'ns' ? x : y) - l.at) < l.half + 4) || d.regions.some((r) => (r.streets ?? []).some((st) => x >= r.rect[0] && x <= r.rect[2] && y >= r.rect[1] && y <= r.rect[3] && Math.abs((st.axis === 'ns' ? x : y) - st.at) < st.w / 2 + 4));
    const inHall = (x, y) => halls.some((q) => x > q[0] - 8 && x < q[2] + 8 && y > q[1] - 8 && y < q[3] + 8);
    for (const r of d.regions) {
      const sub = r.industrial && r.blocks.find((b) => b.kind === 'substation'), side = sub && ['e', 'w', 'n', 's'].find((k) => r.beyond.includes(k));
      if (!side) continue;
      const far = massed && !massed.has(r.id), [bx0, by0, bx1, by1] = sub.rect, c = [(bx0 + bx1) / 2, (by0 + by1) / 2];
      const along = side === 'e' || side === 'w' ? 'x' : 'y', sg = side === 'e' || side === 'n' ? 1 : -1, perp = along === 'x' ? [0, 1] : [1, 0];
      const from = along === 'x' ? (sg > 0 ? bx1 : bx0) : (sg > 0 ? by1 : by0), to = along === 'x' ? (sg > 0 ? Lx1 : Lx0) : (sg > 0 ? Ly1 : Ly0), run = Math.abs(to - from);
      const at = (u) => (along === 'x' ? [u, c[1]] : [c[0], u]);
      // (its pylons: evenly at about a span, each moved on along the line where it would stand in a hall or a street)
      const n = Math.max(1, Math.round(run / PYLON.span)), towers = [];
      for (let k = 1; k <= n; k++) {
        let u = from + sg * Math.min(run - 4, (k * run) / n - (k === n ? 6 : 0)), tries = 0;
        while (tries++ < 12 && (inHall(...at(u)) || onStreet(...at(u)))) u += sg * 5;
        if (sg * (to - u) < 2) continue;
        const [x, y] = at(u);
        towers.push([x, y, S(x, y)]);
        (indStamps.get(`pylon:${along}`) ?? indStamps.set(`pylon:${along}`, []).get(`pylon:${along}`)).push({ pos: P3([x, y, S(x, y)]) });
      }
      counts.industry.pylons = (counts.industry.pylons ?? 0) + towers.length;
      if (far || !towers.length) continue;
      // (its conductors: from the gantry over the switchyard, then pylon to pylon, each sagging a little in its span)
      const zs = sub ? zOf.get(sub.id)?.(c[0], c[1]) ?? S(c[0], c[1]) : S(c[0], c[1]);
      const anchors = [{ p: [c[0], c[1], zs], arms: PYLON.arms.map(([reach], k) => [reach * 0.45 + k * 0.5, 9.4]) }, ...towers.map((p) => ({ p, arms: PYLON.arms.map(([reach, z]) => [reach, z - PYLON.drop]) }))];
      for (let k = 0; k + 1 < anchors.length; k++) {
        const A = anchors[k], B = anchors[k + 1], span = Math.hypot(B.p[0] - A.p[0], B.p[1] - A.p[1]);
        for (let a = 0; a < 3; a++) for (const s2 of [-1, 1]) {
          const pa = [A.p[0] + perp[0] * s2 * A.arms[a][0], A.p[1] + perp[1] * s2 * A.arms[a][0], A.p[2] + A.arms[a][1]];
          const pb = [B.p[0] + perp[0] * s2 * B.arms[a][0], B.p[1] + perp[1] * s2 * B.arms[a][0], B.p[2] + B.arms[a][1]];
          const pt = (t) => [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t, pa[2] + (pb[2] - pa[2]) * t - 4 * sag * span * t * (1 - t)];
          for (let i = 0; i < 6; i++) { const p = pt(i / 6), q = pt((i + 1) / 6), w = 0.05; put([[p[0] - perp[0] * w, p[1] - perp[1] * w, p[2]], [q[0] - perp[0] * w, q[1] - perp[1] * w, q[2]], [q[0] + perp[0] * w, q[1] + perp[1] * w, q[2]], [p[0] + perp[0] * w, p[1] + perp[1] * w, p[2]]], 'geocity:wire', '#2a2c2e'); put([[p[0], p[1], p[2] - w], [q[0], q[1], q[2] - w], [q[0], q[1], q[2] + w], [p[0], p[1], p[2] + w]], 'geocity:wire', '#2a2c2e', [perp[0], perp[1], 0]); }
        }
      }
      counts.industry.lines = (counts.industry.lines ?? 0) + 1;
    }
  }

  /** An INDUSTRIAL block (segments.js: a works, a warehouse, storage, a tank farm, a substation): its plan's ops drawn
   *  (industry.js industrialPlan): its halls and sheds in their cladding, their doors, its tanks, silos, containers,
   *  transformers and gantries stamped (the tall ones seen across their district, the rest near the camera), its trucks
   *  and its people's cars, its fence; far off (the skyline's), its halls and its tall pieces only. */
  function industrial(b, { zAt, Rb, far = false }) {
    const zg = (x, y) => zAt(x, y);
    for (const o of industrialPlan(b, Rb, { far })) {
      if (o.op === 'box' || o.op === 'gable') {
        const [a0, b0, a1, b1] = o.q, z0 = zg((a0 + a1) / 2, (b0 + b1) / 2) + o.z;
        if (o.op === 'box') box(a0, b0, a1, b1, z0, z0 + o.h, o.wall, o.roof, o.group);
        else gable(a0, b0, a1, b1, z0, z0 + o.ze, z0 + o.zr, o.axis, o.wall, o.roof, o.group);
        if (o.group !== 'geocity:works:lantern' && o.group !== 'geocity:canopy') halls.push(o.q);
      } else if (o.op === 'door') {
        const ns = o.side === 'w' || o.side === 'e', sg = o.side === 'e' || o.side === 'n' ? 1 : -1, p = o.at + sg * 0.04, A = ns ? [p, o.a - o.w / 2] : [o.a - o.w / 2, p], B = ns ? [p, o.a + o.w / 2] : [o.a + o.w / 2, p], z0 = zg(A[0], A[1]);
        put([[A[0], A[1], z0], [B[0], B[1], z0], [B[0], B[1], z0 + o.h], [A[0], A[1], z0 + o.h]], 'geocity:door', '#3b4045', ns ? [sg, 0, 0] : [0, sg, 0]);
      } else if (o.op === 'ribbon' || o.op === 'punched') {
        // (its windows: glazing proud of its wall, lit at night by the dice)
        const [a0, b0, a1, b1] = o.q, z0 = zg((a0 + a1) / 2, (b0 + b1) / 2), rows = o.op === 'ribbon' ? [o.z] : Array.from({ length: o.storeys }, (_, k) => k * o.floorH + 0.95);
        for (const f of o.sides) {
          const ns = f === 'w' || f === 'e', at = f === 'w' ? a0 - 0.05 : f === 'e' ? a1 + 0.05 : f === 's' ? b0 - 0.05 : b1 + 0.05, lo = ns ? b0 : a0, hi = ns ? b1 : a1, n = [f === 'e' ? 1 : f === 'w' ? -1 : 0, f === 'n' ? 1 : f === 's' ? -1 : 0, 0];
          const cnt = Math.floor((hi - lo - 1.5) / o.pitch);
          if (cnt < 1) continue;
          const start = lo + (hi - lo - cnt * o.pitch) / 2 + o.pitch / 2;
          for (const zr of rows) for (let i = 0; i < cnt; i++) {
            const c = start + i * o.pitch, p = ns ? [at, c - o.w / 2] : [c - o.w / 2, at], q = ns ? [at, c + o.w / 2] : [c + o.w / 2, at], zA = z0 + zr, zB = zA + o.h;
            const corners = [[p[0], p[1], zA], [q[0], q[1], zA], [q[0], q[1], zB], [p[0], p[1], zB]];
            put(corners, 'geocity:glass', '#46525c', n); faces[faces.length - 1].spec = GLASS_SPEC;
            // (past dusk some of them lit: a pane over the glass, the room's own light)
            if (night && Rb() < G.night.windows * 0.6) pane(corners.map(([x, y, z]) => [x + n[0] * 0.02, y + n[1] * 0.02, z]), n, G.night.palette[Math.floor(Rb() * G.night.palette.length)]);
          }
        }
        counts.industry.windows = (counts.industry.windows ?? 0) + 1;
      } else if (o.op === 'stamp' && o.key === 'celltower') {
        const [x, y] = o.at, z = zg(x, y);
        towersAt.push([x, y, z]);
      } else if (o.op === 'stamp') {
        const [x, y] = o.at, name = o.key.split(':')[0];
        if (far && !INDUSTRY_FAR.includes(name)) continue;
        (indStamps.get(o.key) ?? indStamps.set(o.key, []).get(o.key)).push({ pos: P3([x, y, zg(x, y) + (o.z ?? 0)]), ...(o.scale ? { scale: o.scale } : {}), ...(o.tint ? { tint: linC(o.tint) } : {}) });
        counts.industry[name] = (counts.industry[name] ?? 0) + 1;
      } else if (o.op === 'vehicle' && !far) vehicleAt(o.role, o.at[0], o.at[1], zg(o.at[0], o.at[1]), o.nose, `${b.id}:${r5(o.at[0])}:${r5(o.at[1])}`);
      else if (o.op === 'bund' && !far) {
        const [a0, b0, a1, b1] = o.q, z0 = zg((a0 + a1) / 2, (b0 + b1) / 2);
        for (const q of [[a0, b0, a1, b0 + 0.3], [a0, b1 - 0.3, a1, b1], [a0, b0, a0 + 0.3, b1], [a1 - 0.3, b0, a1, b1]]) box(q[0], q[1], q[2], q[3], z0, z0 + 1.2, '#b9b4a9', '#c4bfb4', 'geocity:bund-wall');
      } else if (o.op === 'fence' && !far) {
        // (its fence round it in panels, a gate's gap at the middle of its front)
        const [a0, b0, a1, b1] = o.q;
        for (const [ax, lo, hi, at] of [['x', a0, a1, b0], ['x', a0, a1, b1], ['y', b0, b1, a0], ['y', b0, b1, a1]]) {
          const mid = (lo + hi) / 2;
          for (let u = lo; u + 3 <= hi + 1e-6; u += 3) {
            if (Math.abs(u + 1.5 - mid) < 4) continue;
            const [x, y] = ax === 'x' ? [u, at] : [at, u];
            (indStamps.get(`chainlink:${ax}`) ?? indStamps.set(`chainlink:${ax}`, []).get(`chainlink:${ax}`)).push({ pos: P3([x, y, zg(x, y)]) });
          }
        }
      }
    }
    counts.industry.blocks = (counts.industry.blocks ?? 0) + 1;
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
        // (its windows each storey, its door to its street)
        frontOf(b, q, z0, st, STOREY, 'residential', { house: s });
        counts.houses += 2;
      }
    };
    const shops = (s, storeys, group) => {
      const n = Math.max(1, Math.round(L / 30)), f = L / n;
      for (let k = 0; k < n; k++) {
        const q = rectOf(s, k * f + 0.4, (k + 1) * f - 0.4, 0, Math.min(SHOP_D, deep / 2 - 2)), z0 = zAt((q[0] + q[2]) / 2, (q[1] + q[3]) / 2), st = storeys + (Rb() < 0.3 ? 1 : 0);
        box(q[0], q[1], q[2], q[3], z0, z0 + st * STOREY + 0.6, SHOP_FRONT[Math.floor(Rb() * SHOP_FRONT.length)], ROOFS[2], group);
        // (its shops on its street, flats or offices over them)
        frontOf(b, q, z0, st, STOREY, group === 'geocity:avenue' ? 'office' : 'residential', { only: [s] });
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
        frontOf(b, q, z0, 4, STOREY, 'residential');
      }
    } else if (b.kind === 'apartments') {
      const q = rectOf(sides[0], 4, 34, 6, 20), z0 = zAt((q[0] + q[2]) / 2, (q[1] + q[3]) / 2);
      box(q[0], q[1], q[2], q[3], z0, z0 + 4 * STOREY, famOf(brick, b.id)[0], ROOFS[2], 'geocity:walkup');
      frontOf(b, q, z0, 4, STOREY, 'residential');
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
  grid();
  waterfront();
  highways();

  // ── the blocks at a building's detail: their masses through the facade pipeline (its units), back to metres; at
  // night its windows lit on the facades' own grids (city/plan/night.js) ──
  // ── under it (`under`, geocity/podium.js, lib/graph/network): the evoked podiums walked into from their streets, each a lobby
  // level with its plaza and a concourse under it, and the passages under the streets between their concourses; `at`
  // one podium alone. A podium is passed over where it holds no lobby clear of its towers, or where its plaza at its
  // door stands off its floor by more than a kerb ──
  const UN = d.spec.under ?? null, podia = [], tunnels = [], netLaws = [];
  let underWhy = null, dressed = null;
  // (the subway placed first, geocity/subway.js: its stations are nodes of the network under the city, so the PATH's
  // passages meet its mezzanines)
  const SUBP = d.spec.subway ? subwayPlan(d, { S, kerb: KERB }) : null;
  let SUB = null;
  if (UN) {
    const all = lots.filter((l) => l.id.endsWith(':podium')), seatD = (l) => Math.hypot((l.x0 + l.x1) / 2 - d.seat[0], (l.y0 + l.y1) / 2 - d.seat[1]);
    const cands = all.filter((l) => UN.at === undefined || l.id === `${UN.at}:podium`).sort((p, q) => seatD(p) - seatD(q) || (p.id < q.id ? -1 : 1));
    if (UN.at !== undefined && !cands.length) no(`under.at '${UN.at}' is not an evoked tower or podium block (${all.map((l) => `'${l.id.split(':')[0]}'`).join(', ') || 'none is evoked'})`);
    const blockOf = new Map(d.regions.flatMap((r) => r.blocks).map((b) => [b.id, b])), tried = [], fits = [];
    for (const l of cands) {
      const bid = l.id.split(':')[0], zA = zOf.get(bid);
      // (its door on its front, else another side, where the plaza before it is within a kerb of the podium's floor: its
      // lobby's floor is the plaza's)
      const plaza = (F, N) => zA(F[0] + N[0] * 1.5, F[1] + N[1] * 1.5), sides = [l.front, ...['-y', '+y', '-x', '+x'].filter((x) => x !== l.front)];
      const fit = podiumFit(l, { avoid: lots.filter((x) => x.id.startsWith(`${bid}:t`)).map((x) => [x.x0, x.y0, x.x1, x.y1]), sides, accept: (F, N) => Math.abs(plaza(F, N) - l.z0) <= KERB + 1e-6 });
      if (!fit) { tried.push(`${bid}: its podium holds no lobby clear of its towers with its plaza at its floor`); continue; }
      const zp = plaza(fit.F, fit.N);
      fits.push({ lot: l, block: bid, fit, padZ: zp, rect: blockOf.get(bid).rect });
    }
    if (!fits.length) {
      underWhy = tried.join('; ') || 'no tower or podium block is evoked';
      if (UN.at !== undefined) no(`under.at '${UN.at}' cannot be walked into: ${underWhy}`);
    }
    // the network (lib/graph/network): a passage between each two concourses facing each other across one street,
    // straight where they overlap along it and a dog-leg where they do not, kept where both their plans hold its way out
    // (one podium named by `at` stands alone)
    const nodes = [...fits.map((f) => ({ id: f.block, rect: f.rect, room: f.fit.concourse, door: PODIUM.door.width })), ...(SUBP && UN.at === undefined ? SUBP.nodes : [])];
    const fitOf = new Map(fits.map((f) => [f.block, f])), portsOf = (id, es) => es.flatMap((e) => (e.a === id ? [{ id: `${e.a}-${e.b}`, side: e.sideA, u: e.uA }] : e.b === id ? [{ id: `${e.a}-${e.b}`, side: e.sideB, u: e.uB }] : []));
    let edges = [];
    if (UN.at === undefined) for (const e of networkEdges(nodes, { section: SECTION, blocks: [...[...blockOf.values()].map((b) => b.rect), ...(SUBP ? SUBP.nodes.map((q) => q.rect) : [])] })) {
      const next = [...edges, e];
      if ([e.a, e.b].filter((id) => fitOf.has(id)).every((id) => portsHold(fitOf.get(id).fit, portsOf(id, next)))) edges = next;
    }
    for (const f of fits) podia.push({ ...f, I: podiumInside(f.lot, { padZ: f.padZ, fit: f.fit, ports: portsOf(f.block, edges) }) });
    // each passage between its two concourses' ways out, in the concourse's own tiles and at its floor's light
    const podOf = new Map(podia.map((p) => [p.block, p]));
    // (the tile the concourse lays most on that surface, under its own ceiling: a lobby's or a stair's is not its)
    const tileOf = (I, group) => {
      const own = I.faces.filter((x) => x.group === group && x.texture && x.uv && Math.max(...x.corners.map((c) => c[2])) <= I.floor0 + 4.2 && Math.hypot(x.uv[1][0] - x.uv[0][0], x.uv[1][1] - x.uv[0][1]) > 1e-6);
      const n = new Map();
      for (const x of own) n.set(x.texture, (n.get(x.texture) ?? 0) + 1);
      const key = [...n].sort((p, q) => q[1] - p[1] || (p[0] < q[0] ? -1 : 1))[0]?.[0], f = own.find((x) => x.texture === key);
      return f ? { texture: f.texture, scale: r5(Math.hypot(...[0, 1, 2].map((k) => f.corners[1][k] - f.corners[0][k])) / Math.hypot(f.uv[1][0] - f.uv[0][0], f.uv[1][1] - f.uv[0][1])) } : null;
    };
    // (each surface's light as the concourse bakes it: the mean of its corners' light, under the concourse's ceiling)
    const lumOf = (I, group) => {
      const v = I.faces.filter((x) => x.group === group && Math.max(...x.corners.map((c) => c[2])) <= I.floor0 + 4.2).flatMap((x) => x.cornerFills ?? [x.fill]).filter((c) => typeof c === 'string')
        .map((c) => (parseInt(c.slice(1, 3), 16) * 0.3 + parseInt(c.slice(3, 5), 16) * 0.59 + parseInt(c.slice(5, 7), 16) * 0.11) / 255);
      return v.length ? r5(v.reduce((a, x) => a + x, 0) / v.length) : 0.45;
    };
    // (what stands over a point: a block's plaza, where a slab's cover is wanted; else the street's land)
    const blocksBuilt = [...blockOf.values()].filter((b) => zOf.has(b.id));
    const over = (x, y) => { const b = blocksBuilt.find((q) => x >= q.rect[0] && x <= q.rect[2] && y >= q.rect[1] && y <= q.rect[3]); return b ? { z: zOf.get(b.id)(x, y), under: 'slab' } : { z: S(x, y), under: 'ground' }; };
    const stationEdges = edges.filter((e) => !podOf.has(e.a) || !podOf.has(e.b));
    for (const e of edges) {
      if (!podOf.has(e.a) || !podOf.has(e.b)) continue;
      const A = podOf.get(e.a), B = podOf.get(e.b), id = `${e.a}-${e.b}`;
      const look = { floor: tileOf(A.I, 'stage:floor'), wall: tileOf(A.I, 'stage:wall'), ceiling: tileOf(A.I, 'stage:soffit'), light: { floor: lumOf(A.I, 'stage:floor'), wall: lumOf(A.I, 'stage:wall'), ceiling: lumOf(A.I, 'stage:soffit') }, stripe: ROUTES[e.axis === 'y' ? 'ns' : 'ew'] };
      // (each end: its way out's floor, its jambs on its outer face, its head)
      const end = (q) => { const ax = q.side.endsWith('y') ? 0 : 1, P = (u) => { const p = [0, 0]; p[ax] = u; p[1 - ax] = q.plane; return p; }; return { z0: q.z0, lo: P(q.lo), hi: P(q.hi), top: q.top, plane: q.plane }; };
      const pa = end(A.I.ports.find((p) => p.id === id)), pb = end(B.I.ports.find((p) => p.id === id));
      tunnels.push({ ...passageOf({ id, path: pathOf(e, pa, pb), a: pa, b: pb, section: SECTION, over, look, prefix: 'geocity' }), a: e.a, b: e.b, kind: e.kind });
    }
    // the subway built with the ways out its links ask of it, and each link's passage from a concourse down to its
    // mezzanine: its platforms lead on into the PATH's lower level
    if (SUBP) {
      const links = {};
      for (const e of stationEdges) for (const [sid, side, u, width] of [[e.a, e.sideA, e.uA, e.doorA], [e.b, e.sideB, e.uB, e.doorB]]) if (!podOf.has(sid)) (links[sid] ??= []).push({ side, u, width, id: `${e.a}-${e.b}` });
      SUB = subwayUnder(d, { S, kerb: KERB, plan: SUBP, links });
      for (const e of stationEdges) {
        const id = `${e.a}-${e.b}`, P0 = podOf.get(podOf.has(e.a) ? e.a : e.b);
        const look = { floor: tileOf(P0.I, 'stage:floor'), wall: tileOf(P0.I, 'stage:wall'), ceiling: tileOf(P0.I, 'stage:soffit'), light: { floor: lumOf(P0.I, 'stage:floor'), wall: lumOf(P0.I, 'stage:wall'), ceiling: lumOf(P0.I, 'stage:soffit') }, stripe: ROUTES[e.axis === 'y' ? 'ns' : 'ew'] };
        const endOf = (nid) => { if (podOf.has(nid)) { const q = podOf.get(nid).I.ports.find((p) => p.id === id), ax = q.side.endsWith('y') ? 0 : 1, P = (u) => { const pp = [0, 0]; pp[ax] = u; pp[1 - ax] = q.plane; return pp; }; return { z0: q.z0, lo: P(q.lo), hi: P(q.hi), top: q.top, plane: q.plane }; } const q = SUB.ports.find((p) => p.id === id); return { z0: q.z0, lo: q.lo, hi: q.hi, top: q.top, plane: q.plane }; };
        const pa = endOf(e.a), pb = endOf(e.b);
        tunnels.push({ ...passageOf({ id, path: pathOf(e, pa, pb), a: pa, b: pb, section: SECTION, over, look, prefix: 'geocity' }), a: e.a, b: e.b, kind: e.kind, station: true });
      }
    }
    // (its laws over its passages; a line's stations reached from each other by their own running tunnels)
    if (UN.at === undefined && podia.length) netLaws.push(...networkLaws(nodes, [...tunnels, ...(SUBP && UN.at === undefined ? SUBP.rails : [])], { section: SECTION, prefix: 'under', noun: 'concourse' }));
    // dressed (geocity/dress.js): shopfronts along the concourses, a sign over each way out in its route's colour, a food
    // court in the hub
    if (podia.length) dressed = dressUnder({ podia, tunnels: tunnels.filter((t) => !t.station), seed });
  }
  // the ground under each cut round it: its pads (the lobby's floor is the plaza's there, its stair's well open under it,
  // a higher terrace's pad and the retaining face up to it would stand in the lobby) and the land's own drape under the
  // block (it would run through the concourse); under each passage's run inside its blocks, the land's drape where it
  // would run through the passage
  const groundCut = (rect, keep) => {
    for (let i = faces.length - 1; i >= 0; i--) {
      const f = faces[i];
      if (!((f.normal?.[2] ?? 0) > 0.5) || keep(f)) continue;
      const cut = groundLess(f, rect);
      if (cut.length !== 1 || cut[0] !== f) faces.splice(i, 1, ...cut);
    }
  };
  for (const P of podia) {
    const ceilZ = P.I.door.z0 + P.I.plan.h;
    groundCut(P.I.footprint, (f) => Math.min(...f.corners.map((c) => c[2])) >= ceilZ);
    for (let i = faces.length - 1; i >= 0; i--) {
      if (faces[i].group !== 'geocity:retain') continue;
      const cut = wallLess(faces[i], P.I.footprint);
      if (cut.length !== 1 || cut[0] !== faces[i]) faces.splice(i, 1, ...cut);
    }
  }
  for (const t of tunnels) for (const R of t.footprint) groundCut(R, (f) => Math.min(...f.corners.map((cc) => cc[2])) >= t.top + 0.2);
  // the subway under its street (geocity/subway.js): its stations, tunnels and entrances, the walk open over each
  // entrance's stairwell
  if (SUBP && !SUB) SUB = subwayUnder(d, { S, kerb: KERB, plan: SUBP });
  const streetcars = [];
  if (SUB) {
    for (const R of [...SUB.wells, ...SUB.openings]) groundCut(R, () => false);
    // (nothing of the street's stands in a stairwell or a run's cut: its trees, its lamps, poles and signs kept out of
    // each, by a margin; nor under an el, its stations, its flights and its viaducts over the street)
    const inR = (Rs, m) => (x, y) => Rs.some((R) => x > R[0] - m && x < R[2] + m && y > R[1] - m && y < R[3] + m);
    const inWell = inR([...SUB.wells, ...SUB.openings], 0.6), underEl = inR(SUB.overhead, 1), crownEl = inR(SUB.overhead, 3);
    // (a wire's span checked along its length: a streetcar's contact wire under an el stops short of it)
    const along = (t, f) => { const L = t.scale?.[0] ?? 0, c = Math.cos(t.rotZ ?? 0), sn = Math.sin(t.rotZ ?? 0); for (let u = -L; u <= L + 1e-6; u += 2) if (f(t.pos[0] + c * u, t.pos[1] + sn * u)) return true; return false; };
    for (const [k, list] of stamps) stamps.set(k, list.filter((t) => !inWell(t.pos[0], t.pos[1]) && !(k === 'wire' && SUB.overhead.length ? along(t, underEl) : underEl(t.pos[0], t.pos[1]))));
    for (const [k, list] of trees) trees.set(k, list.filter((t) => !inWell(t.x, t.y) && !crownEl(t.x, t.y)));
    // the streetcars across it: on each streetcar line crossing its street along its run, the metro's own streetcar at
    // the stop each way past the crossing (geocity/streetcar.js)
    const run = SUB.span, o = SUB.line;
    for (const l of d.lines) {
      if (l.axis === o.axis || !l.tracks.length || l.at < run[0] - 40 || l.at > run[1] + 40) continue;
      for (const t of l.tracks) {
        const s0 = o.at + t.dir * (o.half + 4), car = streetcarFaces({ axis: l.axis, at: l.at + t.at, s0: s0 + t.dir * (STREETCAR.length + 1), dir: t.dir, z: S });
        for (const f of car) if (f.hex) put(f.corners, f.group, f.hex, f.normal); else faces.push(f);
        const xs = car.flatMap((f) => f.corners.map((c) => c[0])), ys = car.flatMap((f) => f.corners.map((c) => c[1])), zs = car.flatMap((f) => f.corners.map((c) => c[2]));
        colliders.push({ min: P3([Math.min(...xs), Math.min(...ys), Math.min(...zs)]), max: P3([Math.max(...xs), Math.max(...ys), Math.min(...zs) + STREETCAR.height]), of: `streetcar:${l.id}:${t.dir}` });
        streetcars.push({ line: l.id, dir: t.dir, at: P3([xs.reduce((a, v) => a + v, 0) / xs.length, ys.reduce((a, v) => a + v, 0) / ys.length, Math.min(...zs)]) });
      }
    }
  }
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
      // (a facade's own faces come untagged: they are the detail's; the podium walked into cut at its door)
      const F1 = { ...f, group: f.group ?? 'geocity:facade', corners: f.corners.map((c) => c.map((v) => r5(v * U))) };
      faces.push(...podia.reduce((ps, P) => ps.flatMap((x) => cutFace(x, P.I.door)), [F1]));
    }
    if (sc.textures && Object.keys(sc.textures).length) textures = sc.textures;
    counts.buildings += lots.length;
    // (each lot held by its own box: a tower's shape stands inside its lot's)
    const podOfLot = new Map(podia.map((P) => [P.lot, P]));
    for (const l of lots) {
      const inside = podOfLot.get(l);
      if (!inside) { colliders.push({ min: P3([l.x0, l.y0, l.z0]), max: P3([l.x1, l.y1, l.z0 + l.h]), of: l.id }); continue; }
      // (the podium walked into: its mass round its inside, its inside's own walls, the mass over its lobby to its roof)
      const fp = inside.I.footprint, top = Math.max(...inside.I.rooms.map((r) => r.box.max[2])) + 0.3;
      for (const r of rectLess([l.x0, l.y0, l.x1, l.y1], fp)) colliders.push({ min: P3([r[0], r[1], l.z0]), max: P3([r[2], r[3], l.z0 + l.h]), of: l.id });
      if (l.z0 + l.h > top) colliders.push({ min: P3([Math.max(l.x0, fp[0]), Math.max(l.y0, fp[1]), top]), max: P3([Math.min(l.x1, fp[2]), Math.min(l.y1, fp[3]), l.z0 + l.h]), of: `${l.id}:over` });
      colliders.push(...inside.I.colliders);
    }
  }
  // the insides' own faces and the passages', baked in their own lamps (the page's live sun takes none of their light)
  const inFaces = new Set([...podia.flatMap((P) => P.I.faces), ...tunnels.flatMap((t) => t.faces), ...(dressed?.faces ?? []), ...(SUB?.faces ?? [])]);
  if (SUB) { faces.push(...SUB.faces); colliders.push(...SUB.colliders); }
  for (const P of podia) { faces.push(...P.I.faces); counts.buildings++; }
  for (const t of tunnels) { faces.push(...t.faces); colliders.push(...t.colliders); }
  // (its canopies stand outside, over the street doors: in the sun, not among the faces under the city)
  if (dressed) { faces.push(...dressed.faces, ...dressed.street); colliders.push(...dressed.colliders); }
  const inside = podia[0] ?? null;

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
    // (a geotown's neighbourhood has no blocks of the metro's: the neighbourhood itself is what is shown, as one block)
    const atR = d.regions.find((x) => x.id === E.at), shown = E.blocks.length ? E.blocks.map((id) => byId.get(id)) : [{ rect: atR?.rect ?? [sx - 60, sy - 60, sx + 60, sy + 60], storeys: { median: 3 } }];
    const hull = [Math.min(...shown.map((b) => b.rect[0])), Math.min(...shown.map((b) => b.rect[1])), Math.max(...shown.map((b) => b.rect[2])), Math.max(...shown.map((b) => b.rect[3]))];
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
  // (the podium walked into: from its plaza into its lobby, and along its concourse from its stair's foot)
  if (inside) {
    // (the concourse from beside the stair's foot, clear of its flight, across to its far side: the way through's last leg)
    const Dr = inside.I.door, o = [Dr.at[0] + Dr.N[0] * 7, Dr.at[1] + Dr.N[1] * 7], [off, far] = inside.I.through.slice(-2);
    cameras.push({ name: 'lobby', worldFraming: { cameraPosition: P3([o[0], o[1], Dr.z0 + 1.7]), lookAt: P3([Dr.at[0] - Dr.N[0] * 8, Dr.at[1] - Dr.N[1] * 8, Dr.z0 + 1.4]), horizontalFov: 70 } },
      { name: 'concourse', worldFraming: { cameraPosition: P3([off[0], off[1], off[2] + 1.7]), lookAt: P3([far[0], far[1], far[2] + 1.3]), horizontalFov: 75 } });
    // (and down the first passage from its first landing)
    const t = tunnels[0];
    if (t) { const a = t.line[1], b = t.line[t.line.length - 2]; cameras.push({ name: 'tunnel', worldFraming: { cameraPosition: P3([a[0], a[1], a[2] + 1.7]), lookAt: P3([b[0], b[1], b[2] + 1.5]), horizontalFov: 70 } }); }
    // (and the food court, from toward the hub's corner furthest from its stair, back over its tables)
    const C = dressed?.readout.court, hub = C ? podia.find((P) => P.block === C.podium) : null;
    if (hub) {
      const tables = dressed.colliders.filter((c) => c.of === `${hub.block}:court`), cb = hub.I.rooms.find((r) => r.id === 'concourse').box, F = hub.I.flight;
      const mid = [tables.reduce((a, c) => a + c.min[0] + c.max[0], 0) / (2 * tables.length), tables.reduce((a, c) => a + c.min[1] + c.max[1], 0) / (2 * tables.length)], fm = [(F[0] + F[2]) / 2, (F[1] + F[3]) / 2];
      const corner = [[cb.min[0], cb.min[1]], [cb.max[0], cb.min[1]], [cb.max[0], cb.max[1]], [cb.min[0], cb.max[1]]].sort((p, q) => Math.hypot(q[0] - fm[0], q[1] - fm[1]) - Math.hypot(p[0] - fm[0], p[1] - fm[1]))[0];
      const at = [mid[0] + (corner[0] - mid[0]) * 0.85, mid[1] + (corner[1] - mid[1]) * 0.85];
      cameras.push({ name: 'food-court', worldFraming: { cameraPosition: P3([at[0], at[1], cb.min[2] + 1.8]), lookAt: P3([mid[0], mid[1], cb.min[2] + 0.6]), horizontalFov: 75 } });
    }
  }
  // (the subway's: down a platform, into a tunnel, an entrance from the walk and down its stair)
  if (SUB) cameras.push(...SUB.cameras);
  // (from a PATH passage that meets a station, looking out through its doorway onto the platform)
  const tl = tunnels.find((t) => t.station);
  if (tl) {
    const toSt = !podia.some((P) => P.block === tl.b) ? tl.line : tl.line.slice().reverse(), a = toSt[Math.max(0, toSt.length - 4)], b = toSt[toSt.length - 1];
    cameras.push({ name: 'subway-path', worldFraming: { cameraPosition: P3([a[0], a[1], a[2] + 1.7]), lookAt: P3([b[0] + (b[0] - a[0]) * 2, b[1] + (b[1] - a[1]) * 2, b[2] + 1.0]), horizontalFov: 75 } });
  }
  // (the first streetcar from across its street, the subway's street behind it)
  if (streetcars[0]) {
    const c = streetcars[0], l = d.lines.find((x) => x.id === c.line), ax = l.axis === 'ns' ? 0 : 1, from = [...c.at];
    from[ax] = l.at - Math.sign(c.at[ax] - l.at || 1) * (l.half - 1);
    from[1 - ax] += (l.axis === 'ns' ? 1 : 1) * 18 * c.dir;
    cameras.push({ name: 'streetcar', worldFraming: { cameraPosition: P3([from[0], from[1], S(from[0], from[1]) + KERB + 1.7]), lookAt: P3([c.at[0], c.at[1], c.at[2] + 1.8]), horizontalFov: 65 } });
  }
  // ── the route round the block nearest the seat (the dummy's), or the evoked block's, on its walk ──
  const o = WALK / 2;
  const ring = [[fb[0] - o, fb[1] - o], [fb[2] + o, fb[1] - o], [fb[2] + o, fb[3] + o], [fb[0] - o, fb[3] + o]], route = [];
  for (let k = 0; k < 4; k++) { const p = ring[k], q = ring[(k + 1) % 4], nn = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 2)); for (let i = 0; i < nn; i++) { const x = p[0] + ((q[0] - p[0]) * i) / nn, yy = p[1] + ((q[1] - p[1]) * i) / nn; route.push(P3([x, yy, S(x, yy) + KERB])); } }
  route.push(route[0]);

  // ── the laws the scene adds: the faces' budget ──
  const laws = [...d.laws, { law: 'faces', ok: faces.length <= GEOCITY_FACES, value: `${faces.length} faces (budget ${GEOCITY_FACES})${night ? `, ${counts.panes} lit panes` : ''}`, want: 'the metro as massing' }];
  // the walk clear of the hull: the dummy's route and the walk's spawn stand in no building's box
  const within = (p, c) => p[0] > c.min[0] && p[0] < c.max[0] && p[1] > c.min[1] && p[1] < c.max[1] && p[2] > c.min[2] && p[2] < c.max[2];
  const blocked = [...route, P3(eye)].filter((p) => colliders.some((c) => within([p[0], p[1], p[2] + 0.5], c))).length;
  laws.push({ law: 'walk-clear', ok: blocked === 0, value: blocked ? `${blocked} of the walk's points inside a building's box` : `the walk clear of ${colliders.length} boxes`, want: 'the route round the seat\'s block and the spawn outside every box' });
  // the TOWNS' SEAMS (towns.js: a composed town on the metro's own streets' ground): along each town's outline, its own
  // street-level ground just inside (its roads, walks, verges, lanes and margin; never a house's pad, stepped over its
  // walk on purpose and closed by its own bank or wall) and the metro's green just outside stand at one height, as built
  // (within TOWN_SEAM: a kerb's)
  if (seamsOf.length) {
    const flat = (f) => { const c = f.corners; if (c.length < 3) return false; const u = [c[1][0] - c[0][0], c[1][1] - c[0][1], c[1][2] - c[0][2]], v = [c[2][0] - c[0][0], c[2][1] - c[0][1], c[2][2] - c[0][2]], n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; return Math.abs(n[2]) > 0.9 * Math.hypot(...n); };
    // (the height of the flat faces in a list at (x, y): the face whose footprint holds it, on its plane)
    const zIn = (list, x, y) => {
      for (const f of list) {
        const c = f.corners; let inPoly = false;
        for (let i = 0, j = c.length - 1; i < c.length; j = i++) if ((c[i][1] > y) !== (c[j][1] > y) && x < ((c[j][0] - c[i][0]) * (y - c[i][1])) / (c[j][1] - c[i][1] || 1e-12) + c[i][0]) inPoly = !inPoly;
        if (!inPoly) continue;
        const [a, b, e] = c, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [e[0] - a[0], e[1] - a[1], e[2] - a[2]], n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        return a[2] - (n[0] * (x - a[0]) + n[1] * (y - a[1])) / n[2];
      }
      return null;
    };
    const metro = faces.filter((f) => f.group === 'geocity:margin' && flat(f));
    let worst = 0, where = '', seen = 0;
    for (const T of seamsOf) {
      const [x0, y0, x1, y1] = T.rect, own = faces.slice(T.from, T.to).filter((f) => flat(f) && STREET_LEVEL.test(f.group ?? '')), e = TOWN_SEAM.probe;
      const near = (L, x, y) => L.filter((f) => f.corners.some((c) => Math.abs(c[0] - x) < 30 && Math.abs(c[1] - y) < 30));
      const sides = [[[x0, y0], [x1, y0], [0, -1]], [[x1, y0], [x1, y1], [1, 0]], [[x1, y1], [x0, y1], [0, 1]], [[x0, y1], [x0, y0], [-1, 0]]];
      for (const [p, q, o] of sides) for (let t = 0.05; t < 1; t += 0.1) {
        const x = p[0] + (q[0] - p[0]) * t, y = p[1] + (q[1] - p[1]) * t;
        const zi = zIn(near(own, x, y), x - o[0] * e, y - o[1] * e), zo = zIn(near(metro, x, y), x + o[0] * e, y + o[1] * e);
        if (zi === null || zo === null) continue;
        seen++;
        if (Math.abs(zi - zo) > worst) { worst = Math.abs(zi - zo); where = ` (${T.id})`; }
      }
    }
    laws.push({ law: 'town-seams', ok: worst <= TOWN_SEAM.tol, value: `${seen} points round ${seamsOf.length} composed town${seamsOf.length === 1 ? '' : 's'}: their ground and the metro's apart by ${worst.toFixed(2)} m at most${where}`, want: `within ${TOWN_SEAM.tol} m (a kerb's)` });
  }
  counts.colliders = colliders.length;
  if (!Object.keys(counts.industry).length) delete counts.industry;
  laws.push(...netLaws);
  const bg = night ? air.fog.color : rgbToHex(air.dome.horizon);
  const kinds = d.regions.flatMap((r) => r.blocks).reduce((acc, b) => ({ ...acc, [b.kind]: (acc[b.kind] ?? 0) + 1 }), {});
  // ── the FRONTAGE dressed (frontage.js): each wall of each building within reach of a person's eye (a camera near the
  // ground) its ground floor by the street it faces (an office's lobby among shops; a residential building's shops on an
  // arterial or a collector in the core and the frame, else its entries; windows only on the water and the land's
  // edge), its windows over it, balconies on some, its cornice; each piece a repeat drawn near the camera ──
  const eyes = cameras.map((c) => c.worldFraming.cameraPosition).filter(([x, y, z]) => z - S(x, y) < FRONT_EYE), frontStamps = new Map();
  const nearEye = (q) => eyes.some(([x, y]) => Math.hypot(Math.max(q[0] - x, 0, x - q[2]), Math.max(q[1] - y, 0, y - q[3])) < NEAR + 60);
  const groundOf = (use, side, b) => {
    if (!side || side.kind === 'water' || side.kind === 'beyond') return 'windows';
    if (use !== 'residential') return 'lobby';
    return (side.kind === 'arterial' || side.rank === 'collector') && b.ring !== 'outskirts' ? 'shops' : 'entries';
  };
  for (const F of fronts) {
    if (!nearEye(F.q)) continue;
    const R = streamOf(seed, 'frontage', `${F.b.id}:${F.q.map((v) => Math.round(v)).join(',')}`), one = (xs) => [xs[Math.floor(R() * xs.length)]];
    const palette = { frame: one(FRONT_PAINT.frame), shop: FRONT_PAINT.shop, sign: FRONT_PAINT.sign, awning: FRONT_PAINT.awning, door: FRONT_PAINT.door, rail: one(FRONT_PAINT.rail) };
    const W4 = wallsOf(F.q);
    for (const f of ['s', 'e', 'n', 'w']) {
      if (F.skip.includes(f) || (F.only && !F.only.includes(f))) continue;
      // (a house its door on its street, windows round it)
      const side = F.b.sides?.[f], ground = F.house ? (f === F.house ? 'entries' : 'windows') : groundOf(F.use, side, F.b);
      for (const p of frontsOf({ facing: f, a: W4[f].a, L: W4[f].L, z0: F.z0, ...(F.ground ? { out: FRONT_PROUD } : {}) }, { storeys: F.storeys, floorH: F.floorH, use: F.use, ground, palette, frames: FRONT_PAINT.frame, ...(F.ground ? { windows: false } : {}), ...(F.house ? { balconies: false } : {}) }, R)) {
        (frontStamps.get(p.key) ?? frontStamps.set(p.key, []).get(p.key)).push({ pos: P3(p.pos), ...(p.scale ? { scale: p.scale } : {}), ...(p.tint ? { tint: p.tint } : {}) });
      }
      counts.fronts = (counts.fronts ?? 0) + 1;
    }
  }
  // ── the TRAFFIC (flow.js): every arterial's travel lanes driven by the fleets' vehicles, a signal at each crossing; the
  // page steps a lane and draws its vehicles only near the camera (scene/channels/flow.js); its kerbs kept clear ──
  const F = E?.evoke === 'skyline' || m.flow === false ? null : flowOf(d, { seed, near: NEAR, kerb: KERB });
  if (F) { laws.push(...flowLaws(F)); counts.flow = { lanes: F.lanes.length, vehicles: F.cars.length, signals: F.signals.length }; }
  // ── THE ROOFTOPS AND MASTS (rooftop.js): each low or mid-rise flat roof its air handlers, a cell site, dishes, a mast, a
  // satellite dish by its dice; the cell towers on the ground; the aviation lights over the tallest and on each tower ──
  const roofStamps = new Map(), beaconAt = [];
  if (E?.evoke !== 'skyline') {
    for (const it of rooftopPlan(shells, seed)) (roofStamps.get(it.key) ?? roofStamps.set(it.key, []).get(it.key)).push({ pos: P3(it.at) });
    for (const [x, y, z] of towersAt) { (roofStamps.get('celltower') ?? roofStamps.set('celltower', []).get('celltower')).push({ pos: P3([x, y, z]) }); beaconAt.push([r5(x), r5(y), r5(z + 30.6)]); }
    counts.rooftop = Object.fromEntries([...roofStamps].map(([k, v]) => [k.split(':')[0], v.length]).reduce((m, [k, n]) => m.set(k, (m.get(k) ?? 0) + n), new Map()));
  }
  {
    const tall = [];
    for (const r of d.regions) for (const b of r.blocks ?? []) for (const t of b.towers ?? []) {
      const [a0, b0, a1, b1] = t.rect, cx = (a0 + a1) / 2, cy = (b0 + b1) / 2, z0 = zOf.get(b.id)?.(cx, cy) ?? S(cx, cy) + KERB;
      tall.push({ rect: t.rect, z0, z1: z0 + t.storeys * office });
    }
    beaconAt.push(...beaconsOf(tall));
    if (beaconAt.length) counts.beacons = beaconAt.length;
  }
  // (the kit's repeats, each drawn near the camera only; the skyline draws none)
  // (the URBAN PIZZA VIEWER, a live page whose world asks for the view cone, scene/channels/city-cone.js: the kit drawn by
  // the cone's rule rather than the ring; an export, and a page without the cone, as before)
  const coned = !!ctx.live && m.cone !== undefined && m.cone !== null, kit = coned ? { cone: 'kit' } : {};
  const repeats = E?.evoke === 'skyline' ? [] : [...stamps].map(([key, transforms]) => ({ group: `geocity:${key.split(':')[0]}`, template: templateOf(key), transforms, near: NEAR, ...kit }));
  if (E?.evoke !== 'skyline') {
    // (its vehicles: each model's paint and trim and its roof's extras, cars.js; its machines the shelf's assembly)
    // (none of them an occluder in the ambient bake: a parked car, a machine, a window darkens nothing the bake needs)
    for (const r of carRepeats(vehicles, { group: 'geocity:vehicle', ...(F ? { pool: F.kinds } : {}) })) repeats.push({ ...r, near: NEAR, occlude: false, ...kit });
    for (const [arch, transforms] of [...machines].sort(([a], [b]) => a.localeCompare(b))) repeats.push({ group: `geocity:machine-${arch}`, template: siteFaces(LIGHT, `m:${arch}`, () => assembleMachine(arch, { laws: false })), transforms, near: NEAR, occlude: false, ...kit });
    // (its industry's pieces, industry.js: the tall ones seen across their district, the rest near the camera)
    if (indStamps.size) {
      const IT = industryTemplates(LIGHT);
      for (const [key, transforms] of [...indStamps].sort(([a], [b]) => a.localeCompare(b))) {
        const [name, ax] = key.split(':');
        repeats.push({ group: `geocity:industry-${name}`, template: ax ? IT[name][ax] : IT[name], transforms, near: INDUSTRY_FAR.includes(name) ? CRANE_NEAR : NEAR, occlude: false, ...kit });
      }
    }
    // (its rooftops' kit near the camera, its cell towers seen across their district, rooftop.js)
    if (roofStamps.size) {
      const RT = rooftopTemplates(LIGHT);
      for (const [key, transforms] of [...roofStamps].sort(([a], [b]) => a.localeCompare(b))) {
        const [name, f] = key.split(':');
        repeats.push({ group: `geocity:roof-${name}`, template: f ? RT[name][f] : RT[name], transforms, near: name === 'celltower' ? CRANE_NEAR : NEAR, occlude: false, ...kit });
      }
    }
    // (its waterfront's kit and its boats, waterfront.js: near the camera)
    if (wfStamps.size) {
      const WT = waterfrontTemplates(LIGHT);
      for (const [key, transforms] of [...wfStamps].sort(([a], [b]) => a.localeCompare(b))) {
        const [name, ax] = key.split(':'), tpl = name.startsWith('boat-') ? WT.boat[name.slice(5)][ax] : ax ? WT[name][ax] : WT[name];
        repeats.push({ group: `geocity:waterfront-${name}`, template: tpl, transforms, near: NEAR, occlude: false, ...kit });
      }
    }
    const FT = frontageTemplates(LIGHT, { frames: FRONT_PAINT.frame });
    for (const [key, transforms] of [...frontStamps].sort(([a], [b]) => a.localeCompare(b))) { repeats.push({ group: `geocity:front-${key.split(':')[0]}`, template: FT[key], transforms, near: NEAR, occlude: false, ...kit }); counts.frontPieces = (counts.frontPieces ?? 0) + transforms.length; }
  }
  // the street trees grown (vegetation/pool.js): a few variants a species, each at the detail the cameras see it at,
  // their crowns raised over the walk, drawn near the camera only like the kit
  // (read by the seventh generation: the street trees the form grows, each its species at its height, form/flora-read.js)
  let plants = null;
  if (form && E?.evoke !== 'skyline') plants = metroPlants(trees, townPlants);
  if (!form && E?.evoke !== 'skyline' && trees.size) {
    const eyes = cameras.map(({ worldFraming: wf }) => ({ pos: wf.cameraPosition, focalPx: 1280 / (2 * Math.tan((wf.horizontalFov * Math.PI) / 360)) }));
    for (const sp of [...trees.keys()].sort()) {
      const pool = plantPool({ species: sp, variants: 2, seed: `geocity::${sp}`, light: LIGHT, maxLevel: TREE.level, group: `geocity:tree-${sp}`, clear: TREE.raise });
      if (coned) {
        // (on the cone every tree twice, on one grid of tiles: its near level inside the reach, its far one past it to
        // the ring, the page choosing by the live eye rather than the scene's bookmarks)
        for (const [level, side] of [[TREE.level, 'in'], ['L0', 'out']]) {
          const placed = plantRepeats(pool, trees.get(sp), { level, sink: 0.05 });
          repeats.push(...placed.repeats.map((r) => ({ ...r, group: `geocity:tree-${r.group}`, near: NEAR, cone: side })));
        }
      } else {
        const placed = plantRepeats(pool, trees.get(sp), { eyes, level: TREE.level, budget: Math.round(TREE.budget / trees.size), sink: 0.05 });
        repeats.push(...placed.repeats.map((r) => ({ ...r, group: `geocity:tree-${r.group}`, near: NEAR })));
      }
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
    if (inFaces.has(f)) { faces[i] = { ...f, sunShare: 0 }; continue; }
    const N = Array.isArray(f.normal) ? f.normal : newell(f.corners), key = LIGHT.diffuse * Math.max(0, N[0] * LIGHT.toLight[0] + N[1] * LIGHT.toLight[1] + N[2] * LIGHT.toLight[2]), all = litFactor(N, LIGHT);
    faces[i] = { ...f, sunShare: all > 1e-9 ? Math.round(Math.min(1, key / all) * 1000) / 1000 : 0 };
  }
  // the site's machines: the shelf's tower cranes (seen across their district), its machines near the camera
  if (E?.evoke !== 'skyline') {
    for (const [key, transforms] of [...siteStamps].sort(([a], [b]) => a.localeCompare(b))) repeats.push({ group: 'geocity:tower-crane', template: craneAt(LIGHT, Number(key.split(':')[1])), transforms, near: CRANE_NEAR, ...kit });
    for (const [key, transforms] of [...siteNears].sort(([a], [b]) => a.localeCompare(b))) {
      const [arch, pose] = SITE[key];
      repeats.push({ group: `geocity:site-${key}`, template: siteFaces(LIGHT, key, () => assembleMachine(arch, { pose, laws: false })), transforms, near: NEAR, ...kit });
    }
  }
  repeats.push(...townRepeats.map((r) => ({ ...r, ...kit })));
  counts.kit = repeats.reduce((a, r) => a + r.transforms.length, 0);
  // (read by the seventh generation: the metro's soft ground the form's own, `isekai:ground`, where its land read draws it
  // and grows its grass, form/land-read.js, worlds/world-scene.js; its street trees counted as the form grows them)
  if (form) {
    for (const f of faces) if (FORM_GROUND.includes(f.group)) f.group = 'isekai:ground';
    counts.trees = [...trees.values()].reduce((a, l) => a + l.length, 0);
  }
  return {
    faces, ...(repeats.length ? { repeats } : {}), ...(F ? { flow: F } : {}), ...(beaconAt.length ? { beacons: { at: beaconAt, color: BEACON.color, period: BEACON.period, duty: BEACON.duty } } : {}), ...(counts.industry.lines ? { footless: ['geocity:wire'] } : {}), ...(plants ? { plants } : {}), ...(textures ? { textures } : {}), ...(colliders.length ? { colliders } : {}), cameras, viewBox: { width: 1280, height: 720 }, title: ctx.title || `${cube.title} · geocity`,
    // (the city's haze is laid per its world unit, city/plan/scene.js; this world's unit is the metre)
    bg, haze: { color: air.fog.color, density: r5((air.fog.density * CITY_HAZE) / CITY_METERS_PER_UNIT) },
    sky: { zenith: air.dome.zenith, horizon: air.dome.horizon, day: night ? 0 : 1, stars: 0, seed: 1, ...(night ? {} : { sun: { dir: P3(sun), size: 1.4, glow: 1.3 } }), ...(spec.air ? hourSky(spec.air) : {}) },
    ...(podia.length || SUB ? { ...(podia.length ? { lights: podia.flatMap((P) => P.I.lights) } : {}), anchors: [
      ...(SUB?.anchors ?? []),
      ...(dressed?.readout.court ? [{ id: `food-court-${dressed.readout.court.podium}`, kind: 'food-court', podium: `podium-${dressed.readout.court.podium}`, tables: dressed.readout.court.tables }] : []),
      ...podia.map((P) => ({ id: `podium-${P.block}`, kind: 'building', use: 'podium', enter: 'walk', at: P.I.door.at, N: P.I.door.N, floor: P.I.door.z0, rise: P.I.rise, storeys: 2, rooms: P.I.rooms, through: P.I.through, down: P.I.down, ports: P.I.ports.map((q) => ({ id: q.id, side: q.side, at: P3(q.side.endsWith('y') ? [q.u, q.plane, q.z0] : [q.plane, q.u, q.z0]), reach: q.reach })) })),
      ...tunnels.map((t) => { const end = (id) => (podia.some((P) => P.block === id) ? `podium-${id}` : `station-${id}`); return { id: `tunnel-${t.id}`, kind: 'tunnel', from: end(t.a), to: end(t.b), length: t.length, line: t.line }; }),
    ] } : {}),
    walk: m.walk === false ? false : { speed: 6, spawn: P3(eye), minEye: 1.7, gravity: 22, radius: 0.4 },
    // (a physical city: its nearest buildings to the walk's start, each as a shell for rupa/shell-blocks.js, with its
    // finish's material word; absent otherwise)
    ...(m.destruction === 'physical' ? { physicalRing: shells.map((b) => ({ ...b, d: Math.hypot(Math.max(b.min[0] - eye[0], 0, eye[0] - b.max[0]), Math.max(b.min[1] - eye[1], 0, eye[1] - b.max[1])) }))
      .filter((b) => b.d <= RING && b.max[2] - b.min[2] > 1 && (FINISHES[b.group] || RING_WORD[b.group])).sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : 1)).slice(0, RING_MAX)
      .map(({ d: _d, ...b }) => ({ ...b, min: P3(b.min), max: P3(b.max), eave: r5(b.eave), word: FINISHES[b.group] ? FINISHES[b.group][0] : RING_WORD[b.group] })) } : {}),
    route,
    geocube: geocubeReadout(cube, 'geocity', null, m),
    geocity: {
      metro: d.metro.id, grammar: G.label, frame: d.frame, land: d.land.range, seat: d.seat, evoke: d.spec.evoke, play: d.spec.play,
      ...(E ? { evoked: { ...(E.at ? { at: E.at } : {}), ...(E.along ? { along: E.along } : {}), detail: E.blocks.length, massing: E.regions.length } } : {}),
      counts: { neighbourhoods: d.regions.length, blocks: Object.values(kinds).reduce((a, n) => a + n, 0), segments: kinds, ...counts, faces: faces.length },
      neighbourhoods: d.regions.map((r) => ({ id: r.id, ring: r.ring, builds: r.builds, ...(r.industrial ? { industrial: true } : {}), storeys: r.storeys.median, blocks: r.blocks.length, park: r.park || !!r.parkRect, ...(r.node ? { node: r.node } : {}), ...(r.beyond.length ? { beyond: r.beyond } : {}) })),
      graph: { nodes: d.graph.nodes.length, edges: d.graph.edges.length, beyond: d.graph.beyond },
      ...(Object.keys(towns).length ? { geotowns: towns } : {}),
      ...(UN ? { under: inside ? {
        podium: inside.block, plan: inside.I.plan, rise: inside.I.rise,
        podia: podia.map((P) => ({ id: P.block, plan: P.I.plan, ports: P.I.ports.length, findings: P.I.findings })),
        section: SECTION.id,
        tunnels: tunnels.map((t) => ({ id: t.id, kind: t.kind, length: r5(t.length), level: t.level, cover: t.cover, slab: t.slab, grade: t.grade, turns: t.turns, ends: t.ends, ...(t.findings.length ? { findings: t.findings } : {}) })),
        faces: [...podia.flatMap((P) => P.I.faces), ...tunnels.flatMap((t) => t.faces)].length, colliders: podia.reduce((a, P) => a + P.I.colliders.length, 0) + tunnels.reduce((a, t) => a + t.colliders.length, 0), lights: podia.reduce((a, P) => a + P.I.lights.length, 0),
        findings: podia.flatMap((P) => P.I.findings), ...(dressed ? { dress: dressed.readout } : {}),
      } : { podium: null, why: underWhy } } : {}),
      ...(SUB ? { subway: { ...SUB.readout, ...(streetcars.length ? { streetcars } : {}) } } : {}),
      ledger: d.ledger, laws: laws.map((l) => ({ law: l.law, ok: l.ok, value: l.value })),
      ...(d.waterfront ? { waterfront: d.waterfront.map((W) => ({ side: W.side, main: W.main, ...(W.boulevard ? { boulevard: true } : {}), segments: W.segments.map((g) => g.kind), reclaimed: Math.round(W.segments.reduce((a, g) => a + (g.a1 - g.a0) * g.depth, 0)) })) } : {}),
      ...(d.highways ? { highways: d.highways.map((h) => ({ id: h.id, role: h.role, along: h.along, length: Math.round(h.hi - h.lo), lanes: h.lanes, ...(h.joins ? { joins: h.joins } : {}), ...(h.over ? { over: h.over } : {}) })) } : {}),
      ...(F ? { flow: { lanes: F.lanes.length, vehicles: F.cars.length, signals: F.signals.length, cycle: F.signals[0].cycle, clearance: F.T.CLEARANCE, near: F.near } } : {}),
      // (its streets' profiles where it asks them: the arterials', and how many of each neighbourhood's streets)
      ...(d.profile ? { profile: { arterials: d.profile.arterials, neighbourhoods: Object.fromEntries(Object.entries(d.profile.neighbourhoods).map(([id, st]) => [id, st.length])), ...(d.spec.slope ? { slope: d.spec.slope } : {}) } } : {}),
    },
  };
}

// a geocity with a subway played as a level (geocity/subway.js): its walker, its line's tunnels or warps, its goal on
// the street; any other geocube passes through
registerLevelKind('geocube', (m, ref) => withGeocitySubwayLevel(m, ref, { designGeocity }));
