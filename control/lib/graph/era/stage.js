/**
 * STAGE — a level built the way sixth-gen levels were: kit pieces on a grid, small painted tiles
 * multiplied by vertex light, and lights placed by hand. The `stage` world kind.
 *
 * Recipe (z-up, metres):
 *   { kind:'stage', reference:'dmc3', kit:'gothic-stone',
 *     rooms:[{ id, x, y, w, d, h }],                 // axis-aligned boxes on the kit grid; x,y = min corner
 *     links:[{ from, to, width?, height? }],         // a doorway where two rooms share a wall
 *     lights?: 'auto' | [{ at:[x,y,z], color?, intensity?, radius?, fixture? }],
 *     dirt?: { age, damp, soot, traffic, seed } }    // scales the causes in dirt.js; absent ⇒ DIRT_DEFAULTS
 *
 * The level is three layers that never share a material: FLOOR, a JUNCTION band (a recessed gutter in front of
 * the plinth, rubble fallen into it) and WALL; the kit's pairing sets them apart. Dirt is baked per corner by
 * cause (dirt.js). The shell is dressed by the KIT card: a plinth and a cornice run every wall, pilasters stand at each
 * bay and at the corners, ribs cross the ceiling at each bay, a stone frame rings each doorway. Every
 * surface is split into grid cells so vertex light has corners to land on (the era's trick: a pool of
 * torchlight needs vertices under it). Each corner carries its own baked colour (`cornerFills`), the
 * tile multiplies over it (`textureLit`).
 *
 * Lights: `'auto'` (the default) seats a torch on every other pilaster. Each light is baked into the
 * corners, drawn as a sconce with a glowing flame, and leaves as a KHR punctual point light in the GLB.
 * Deterministic: a pure function of the recipe.
 */
import { SIXTH_GEN_REFERENCES, SIXTH_GEN_LOOK_IDS, resolveLook, lookOfReference } from './sixth-gen.js';
import { tileFamilyOf, normalizeTileSpec, proportionsOver } from './tile-specs.js';
import { makeDirt, hash3, DIRT_DEFAULTS } from './dirt.js';
import { rockPool, rockRepeats, expandRepeats } from '../polygonizer/rock-pool.js';
import { add, sub, mul, dot, r5, P, hexRgb, rgbHex, wallFrame, openingU, panel, box, wallBox, solidSpans, onWall } from './geom.js';
import { archedOpening, engagedColumn, naveVault, portal, oculus } from './gothic.js';
import { GOTHIC_NAVE } from './style/gothic-nave.js';
import { naveDress } from './nave.js';
import { cryptDress } from './crypt.js';
import { CRYPT } from './style/crypt.js';
import { plazaDress } from './plaza-dress.js';
import { DELFINO_PLAZA } from './style/delfino-plaza.js';
import { RESEARCH_LAB } from './style/research-lab.js';
import { labRoom } from './lab.js';
import { labDress } from './lab-dress.js';
import { readDecay, pickDecay } from './decay.js';
import { cardMask } from './leaf-cards.js';
import { plazaWall } from './plaza.js';
import { makeSunShadow, sunDir } from './sun.js';
import { assembleNatureScene } from './nature.js';
import { assembleJungleScene } from './jungle.js';
import { assembleIsekaiScene } from './isekai.js';
import { composeCloudDeck } from '../effects/effects-clouds.js';
import { stageDoors, doorFaces, withoutBuild, stageItems } from './doors.js';
import { normalizeJets } from '../materials/jet.js';
import { resolveTerrainWind } from '../vegetation/wind.js';

// ── kit cards ────────────────────────────────────────────────────────────────
export const STAGE_KITS = ({
  'gothic-stone': Object.freeze({
    grid: 1, bay: 4, wall: 0.5,   // wall = thickness between neighbouring rooms (each room's interior sits wall/2 inside its box)
    // light/dirt cells per part: walls and trim finer, so soot plumes and streaks have corners to land on
    cells: { wall: 0.5, trim: 0.5, floor: 1, ceiling: 1, gutter: 0.5 },
    plinth: { h: 0.6, out: 0.18 },
    cornice: { h: 0.45, out: 0.3 },
    pilaster: { w: 0.7, out: 0.28 },
    rib: { w: 0.45, drop: 0.4 },
    door: { width: 2, height: 3.4, frame: 0.35, out: 0.12 },
    // tiles: a family mixes its four seeded variants (per wall run; per flag on the floor); scale = metres per repeat.
    // PAIRING: cool bluestone walls in running-bond COURSES over a warm-neutral, darker FLAGSTONE floor of square and
    // oblong flags — a different material and a different shape. The floor is laid one tile per structural bay, so
    // its long joints land on the pilasters; dressed slate trim sits between the two in value.
    tiles: {
      wall: { family: 'stone-wall-bluestone', scale: 2 },
      floor: { family: 'flagstone', perBay: true },   // one tile per bay; the variant (its own layout, lost/cracked flags) per bay
      ceiling: { family: 'stone-wall-bluestone', scale: 2.5 },
      trim: { key: 'slate', scale: 1.5 },
      gutter: { key: 'soil-mud', scale: 1.2 },
    },
    // material tint under the tile (the tile carries the colour; tint sets the value band each layer lives in)
    tint: { wall: [0.86, 0.88, 0.94], floor: [0.66, 0.6, 0.53], ceiling: [0.7, 0.72, 0.8], trim: [0.88, 0.88, 0.92], gutter: [0.8, 0.8, 0.78] },
    // the junction band: a recessed gutter in front of the plinth, and rubble fallen into it
    gutter: { width: 0.35, depth: 0.08 },
    rubble: { rock: 'basalt', tone: '#5e626c', variants: 6, perMetre: 0.5, size: [0.22, 0.55] },
    torch: { every: 2, z: 2.7, out: 0.38, color: '#ffa850', intensity: 1.7, radius: 7.5 },
  }),
});
// GRIME (`grime: 0…1` on a room-kit recipe): one dial for how long the place has stood. It scales the dressing's moss
// and grime blends, the baked dirt (soot, damp, age, traffic: dirt.js), and the crypt's own wall wear (recessed joints,
// streaks, chipped arrises). The crypt stands at CRYPT_GRIME; a kit without blends takes the dirt only.
export const CRYPT_GRIME = 0.5;
/** The crypt's wall at a grime: the bluestone courses, worn as long as the place has stood. */
function cryptWallFamily(g) {
  return tileFamilyOf({ gen: 'stone-brick', stone: [118, 128, 140], mortar: [70, 78, 88], rows: 6, cols: 4, mortarThick: 0.1, vary: 28, grain: 11, bevel: 0.2,
    accent: 0.14, accentDark: 40, accentLight: 26, jointDepth: r5(0.25 + 0.65 * g), grime: r5(g), chips: r5(0.1 + 0.5 * g) });
}
/** A kit at a grime: blends scaled (as a share of the card's own at the default), the crypt's wall re-worn. */
function withGrime(kit, kitId, g, recipeWall) {
  const f = Math.min(2, g / CRYPT_GRIME), D = kit.dress;
  const dress = D && D.moss && D.grime ? { ...D, moss: { ...D.moss, max: r5(Math.min(1, D.moss.max * f)) }, grime: { ...D.grime, max: r5(Math.min(1, D.grime.max * f)) } } : D;
  const tiles = kitId === 'gothic-stone' && !recipeWall ? { ...kit.tiles, wall: { ...kit.tiles.wall, family: cryptWallFamily(g) } } : kit.tiles;
  return { ...kit, dress, tiles };
}
/** The baked dirt at a grime: each cause scaled from its default, none past 1. */
export const dirtAtGrime = (g) => ({ age: r5(Math.min(1, DIRT_DEFAULTS.age * g * 2)), damp: r5(Math.min(1, DIRT_DEFAULTS.damp * g * 2)), soot: r5(Math.min(1, DIRT_DEFAULTS.soot * g * 2)), traffic: r5(Math.min(1, DIRT_DEFAULTS.traffic * g * 2)) });

// the stone the nave and the plaza are cut from: gothic-stone's own numbers before its crypt dressing
const GOTHIC_STONE_BASE = STAGE_KITS['gothic-stone'];
// The CRYPT: gothic-stone dressed as a burial vault (style/crypt.js, era/crypt.js): a tomb chest on a dais at the end of
// the walk, candles, cobwebs, moss and grime by cause, and a vault of rough limewash, darker than the walls, its own
// material (never the walls' coursed stone carried overhead).
STAGE_KITS['gothic-stone'] = Object.freeze({
  ...GOTHIC_STONE_BASE,
  tiles: { ...GOTHIC_STONE_BASE.tiles, wall: { family: cryptWallFamily(CRYPT_GRIME), scale: 2 }, ceiling: { key: 'stucco', scale: 2 } },
  tint: { ...GOTHIC_STONE_BASE.tint, ceiling: [0.26, 0.25, 0.28] },
  dress: CRYPT,
});
// The NAVE kit: the same stone, but nothing is a box. Each wall bay is a blind pointed arcade arch below a string course
// and a lancet window above; engaged columns stand at the bay lines; the ceiling is a tall pointed barrel vault with
// transverse ribs that continue the columns, a ridge rib, and lunettes filling the end walls.
STAGE_KITS['gothic-nave'] = Object.freeze({
  ...GOTHIC_STONE_BASE,
  shell: 'nave',
  column: { r: 0.34, embed: 0.12, sides: 10, baseH: 0.5 },
  arcade: { margin: 0.32, spring: 0.36, rise: 1.05, depth: 0.45, ring: 0.26, ringOut: 0.14, seg: 8 },
  string: { h: 0.28, out: 0.16, gap: 0.55 },
  lancet: { w: 1.0, rise: 1.6, depth: 0.55, seg: 6, sill: 0.7, glass: '#8fa6e6',
    light: { color: '#7f98e8', intensity: 0.85, radius: 11, off: 1.6 } },
  vault: { rise: 0.62, seg: 12, rib: { w: 0.42, drop: 0.3 } },
  torch: { every: 2, z: 2.7, out: 0.32, color: '#ffa850', intensity: 1.7, radius: 7.5 },
  // the dressing (style/gothic-nave.js, era/nave.js): blends, cutouts, shafts and pools, and the great door
  dress: GOTHIC_NAVE,
});
// The PLAZA kit (Sunshine): an open-air square whose sides are house fronts (plaza.js) over a raised pavement step,
// paved in warm flagstone bays, lit by a hard high sun with baked cast shadows and a blue sky fill.
STAGE_KITS['island-plaza'] = Object.freeze({
  ...GOTHIC_STONE_BASE,
  shell: 'plaza', bay: 5, sun: true, rubble: null,
  cells: { wall: 0.5, trim: 0.5, floor: 0.5, ceiling: 1, gutter: 0.5, base: 0.5, roof: 0.75, step: 0.5 },
  tiles: {
    wall: { key: 'stucco', scale: 1.5 },
    base: { family: 'rock-sandstone', scale: 1.5 },
    floor: { family: 'flagstone-warm', perBay: true },
    trim: { key: 'rock-sandstone', scale: 1.2 },
    roof: { key: 'clay-terracotta', scale: 1.2 },
    step: { key: 'granite-pink', scale: 1.5 },
    ceiling: { key: 'stucco', scale: 2 },
  },
  tint: { wall: [1, 1, 1], base: [0.92, 0.86, 0.78], floor: [1, 0.96, 0.9], ceiling: [1, 1, 1], trim: [1.08, 1.04, 0.98], roof: [1.05, 1, 0.95], step: [0.98, 0.95, 0.9] },
  step: { width: 0.9, h: 0.16 },   // the pavement along the house fronts: the junction band of an exterior
  house: {
    storey: 3.2, storeys: [2, 4], parapet: 0.7,
    palette: ['#f2e4c6', '#f4c8a0', '#f6f0e4', '#bcd4e8', '#eab4a4', '#f0d890'],
    base: { h: 0.7, out: 0.06 },
    door: { w: 1.4, h: 2.6, depth: 0.4, dark: '#2a1e18' },
    window: { w: 0.95, h: 1.5, sill: 0.9, depth: 0.3, glass: '#26303c' },
    eave: { h: 0.35, out: 0.45 },
    roof: { depth: 2.5, rise: 1.4 },
    balcony: { chance: 0.45, w: 2.2, out: 0.85, iron: '#3a3430' },
  },
  sky: { fill: 0.55, bounce: [0.95, 0.82, 0.62], bounceGain: 0.22, sunGain: 1.05 },
  // the dressing (style/delfino-plaza.js, era/plaza-dress.js): the fountain, the fronts' life, blends, the town beyond
  dress: DELFINO_PLAZA,
});
// The RESEARCH-LAB kit (Doom 3): a tall lab whose structure shows (lab.js) — steel columns at the bays, panelled
// walls under a clerestory of observation windows, trusses, ducts and a cable tray under a corrugated deck, troffers
// hung on chains; a vinyl floor. Its dressing (style/research-lab.js, lab-dress.js): the blast door, the tank, the benches.
STAGE_KITS['research-lab'] = Object.freeze({
  shell: 'lab', grid: 1, bay: 4.8, wall: 0.5,
  door: { width: 2, height: 3, frame: 0.3, out: 0.1 },
  torch: { color: '#e8f0ff', intensity: 1.2, radius: 8 },
  rubble: null,
  cells: { wall: 0.6, trim: 0.6, floor: 0.6, ceiling: 1.2, kick: 0.6, upper: 0.8, column: 0.6, skirt: 1, duct: 1.2, cable: 2, housing: 1 },
  tiles: {
    floor: { key: 'lab:vct', scale: 2.4 },
    wall: { key: 'lab:panel', scale: 1.2 },
    kick: { key: 'hull-plate-dark', scale: 1.2 },
    upper: { key: 'concrete-board', scale: 2.4 },
    trim: { key: 'steel-strut', scale: 1.2 },
    column: { key: 'steel-column', scale: 1.5 },
    ceiling: { key: 'lab:deck', scale: 1.6 },
    duct: { key: 'hull-plate', scale: 1.5 },
    skirt: { key: null, scale: 1 }, cable: { key: null, scale: 1 }, housing: { key: null, scale: 1 },
  },
  tint: { floor: [0.98, 0.99, 1.0], wall: [0.68, 0.7, 0.73], kick: [0.7, 0.72, 0.74], upper: [0.62, 0.64, 0.66], trim: [0.78, 0.8, 0.82], column: [0.66, 0.68, 0.72],
    ceiling: [0.42, 0.44, 0.46], duct: [0.78, 0.8, 0.82], skirt: [0.16, 0.16, 0.17], cable: [0.1, 0.1, 0.11], housing: [0.78, 0.8, 0.82] },
  lab: {
    band: { w: 0.6, tint: [0.62, 0.64, 0.66] }, skirt: { h: 0.12, out: 0.03 },
    kick: { h: 1.0, out: 0.05 }, field: { top: 3.9 }, service: { h: 0.32, out: 0.24 },
    column: { w: 0.42, out: 0.32 },
    window: { w: 3.2, h: 1.5, sill: 0.7, margin: 0.4, depth: 0.3, ring: 0.1, ringOut: 0.05, glass: '#4f6c88', light: { color: '#8fb0d8', intensity: 0.35, radius: 7, off: 1.2 } },
    truss: { depth: 0.75, w: 0.3, web: 0.05, flange: 0.05 },
    duct: { at: [0.3, 0.7], r: 0.32, sides: 10, gap: 0.12 },
    tray: { at: 0.5, w: 0.45, side: 0.1, drop: 0.35, cables: [0.03, 0.025, 0.035] },
    troffer: { rows: [0.25, 0.5, 0.75], len: 1.5, w: 0.36, h: 0.1, drop: 1.6, diffuser: '#eef4ff', color: '#dde8ff', intensity: 1.15, radius: 7.5, deadTint: [0.42, 0.44, 0.46] },
  },
  dress: RESEARCH_LAB,
});
// The TRAIL-VALLEY kit: no architecture — a trail, a cliff and trees built to a style card (nature.js).
STAGE_KITS['trail-valley'] = Object.freeze({ shell: 'nature', style: 'nature-trail' });
// The JUNGLE-TRAIL kit: the late sixth-gen jungle — grown giants, leaf cards, a canopy the light comes through (jungle.js).
STAGE_KITS['jungle-trail'] = Object.freeze({ shell: 'jungle', style: 'jungle-mgs3' });
// The ISEKAI-MEADOW kit: the current era's open-field anime look from sixth-gen parts — a locked palette, pixel-locked
// rocks and cliffs, hats (isekai.js).
STAGE_KITS['isekai-meadow'] = Object.freeze({ shell: 'isekai', style: 'isekai-meadow' });
// The isekai GROVES: smaller levels in the same look — a bamboo grove, a sakura grove.
STAGE_KITS['isekai-bamboo'] = Object.freeze({ shell: 'isekai', style: 'isekai-bamboo' });
STAGE_KITS['isekai-sakura'] = Object.freeze({ shell: 'isekai', style: 'isekai-sakura' });
Object.freeze(STAGE_KITS);
/** The proportions each room kit is built by (tile-specs.js PROPORTION_RAILS): a part it inherits but never draws (the
 *  plaza's pilasters, the nave's ribs) is not offered. Measured, and kept honest by tile-specs.test.js. */
export const STAGE_KIT_PROPORTIONS = Object.freeze({
  'gothic-stone': ['bay', 'plinth', 'cornice', 'pilaster', 'rib', 'door', 'torch'],
  'gothic-nave': ['bay', 'plinth', 'cornice', 'torch', 'column', 'arcade', 'vault'],
  'island-plaza': ['bay'],
  'research-lab': ['bay'],
});
/** Kit ids a recipe may still carry from before a kit was renamed: read as the kit it became. */
export const STAGE_KIT_ALIASES = Object.freeze({ 'delfino-plaza': 'island-plaza' });
/** A kit id (or an alias) → the kit's id; the id as given when it names neither, so the refusal can quote it. */
export const resolveKitId = (id) => STAGE_KIT_ALIASES[id] || id;
const VARIANTS = ['a', 'b', 'c', 'd'];

/** The recipe's own tiles (`tiles: { wall: { gen, … } }`, tile-specs.js) over the kit's, surface by surface: each spec
 *  becomes a four-variant family named from its numbers, laid where the kit laid its own. A dressing that paves its own
 *  floor (the nave's runner and kerbs) keeps it. */
function withRecipeTiles(kit, kitId, tiles) {
  if (!tiles || typeof tiles !== 'object' || Array.isArray(tiles)) throw new Error('stage: tiles is { <surface>: { gen, … } }');
  const out = { ...kit.tiles }, tint = { ...kit.tint };
  for (const [part, spec] of Object.entries(tiles)) {
    if (!kit.tiles[part]) throw new Error(`stage: tiles.${part}: kit '${kitId}' has no ${part} surface (surfaces: ${Object.keys(kit.tiles).join(', ')})`);
    const n = normalizeTileSpec(spec, `stage: tiles.${part}`), { key, ...was } = kit.tiles[part];
    out[part] = { ...was, family: tileFamilyOf(spec, `stage: tiles.${part}`), scale: n.scale ?? was.scale ?? 1 };
    // the kit's tint sets the value band a surface lives in; the recipe's own colour is the hue, so keep the band, drop the cast
    if (tint[part]) { const v = r5(tint[part].reduce((a, b) => a + b, 0) / 3); tint[part] = [v, v, v]; }
  }
  return { ...kit, tiles: out, tint };
}

// ── plan ─────────────────────────────────────────────────────────────────────
const onGrid = (v, g) => Math.abs(v / g - Math.round(v / g)) < 1e-9;

/** Validate + resolve the recipe. Structural errors throw (at mint); nothing here is advisory. */
export function planStage(m = {}) {
  const kitId = resolveKitId(m.kit || 'gothic-stone');
  const kit0 = STAGE_KITS[kitId];
  if (!kit0) throw new Error(`stage: unknown kit '${kitId}' (known: ${Object.keys(STAGE_KITS).join(', ')})`);
  const kitT = m.tiles ? withRecipeTiles(kit0, kitId, m.tiles) : kit0;
  // the recipe's own proportions (tile-specs.js PROPORTION_RAILS) over the kit's: its columns, plinths, bays, doors
  const kitP = m.proportions ? { ...kitT, ...proportionsOver(kitT, kitId, m.proportions, STAGE_KIT_PROPORTIONS[kitId] || []) } : kitT;
  if (m.grime !== undefined && !(typeof m.grime === 'number' && m.grime >= 0 && m.grime <= 1)) throw new Error('stage: grime is a number from 0 (just built) to 1 (abandoned for centuries)');
  const kit = m.grime !== undefined ? withGrime(kitP, kitId, m.grime, !!(m.tiles && m.tiles.wall)) : kitP;
  const refId = resolveLook(m.reference || 'gothic-night');
  const ref = SIXTH_GEN_REFERENCES[refId];
  if (!ref) throw new Error(`stage: unknown reference '${m.reference}' (known looks: ${SIXTH_GEN_LOOK_IDS.join(', ')})`);
  // a sunlit kit (the plaza) is lit by its look's key: a look with no sun has nothing to light it with
  if (kit0.sun && !ref.light.key) throw new Error(`stage: kit '${kitId}' is lit by the sun; give it a look with one (${SIXTH_GEN_LOOK_IDS.filter((l) => SIXTH_GEN_REFERENCES[resolveLook(l)].light.key).join(', ')})`);
  if (!Array.isArray(m.rooms) || !m.rooms.length) throw new Error('stage: needs a non-empty `rooms` array ({ id, x, y, w, d, h })');
  const g = kit.grid, byId = new Map();
  const rooms = m.rooms.map((r, i) => {
    const id = r.id ?? `r${i}`;
    if (byId.has(id)) throw new Error(`stage: duplicate room id '${id}'`);
    for (const k of ['x', 'y', 'w', 'd', 'h']) if (!Number.isFinite(r[k])) throw new Error(`stage: room '${id}' needs a numeric ${k}`);
    for (const k of ['x', 'y', 'w', 'd']) if (!onGrid(r[k], g)) throw new Error(`stage: room '${id}' ${k}=${r[k]} is off the ${g} m grid`);
    if (r.w < 2 * g || r.d < 2 * g || r.h < 2.5) throw new Error(`stage: room '${id}' is too small (w, d ≥ ${2 * g} m, h ≥ 2.5 m)`);
    const t = kit.wall / 2;   // the interior: the box inset by half a wall
    // `open`: sides left out (a stage SET seen from the open side while iterating — no third or fourth wall)
    const open = Array.isArray(r.open) ? r.open.filter((s) => ['-x', '+x', '-y', '+y'].includes(s)) : [];
    const room = { id, box: [r.x, r.y, r.x + r.w, r.y + r.d], x0: r.x + t, y0: r.y + t, x1: r.x + r.w - t, y1: r.y + r.d - t, h: r.h, open, openings: { '-x': [], '+x': [], '-y': [], '+y': [] } };
    byId.set(id, room);
    return room;
  });
  const links = (m.links || []).map((l) => {
    const a = byId.get(l.from), b = byId.get(l.to);
    if (!a || !b) throw new Error(`stage: link ${l.from} → ${l.to} names an unknown room`);
    const width = l.width ?? kit.door.width, height = Math.min(l.height ?? kit.door.height, a.h - 0.5, b.h - 0.5);
    // the shared wall: a's +x is b's −x, etc.; the doorway centres on the overlap
    let wall = null;
    const [ax0, ay0, ax1, ay1] = a.box, [bx0, by0, bx1, by1] = b.box;
    if (ax1 === bx0) wall = { ax: '+x', bx: '-x', at: ax1, lo: Math.max(a.y0, b.y0), hi: Math.min(a.y1, b.y1) };
    else if (bx1 === ax0) wall = { ax: '-x', bx: '+x', at: ax0, lo: Math.max(a.y0, b.y0), hi: Math.min(a.y1, b.y1) };
    else if (ay1 === by0) wall = { ax: '+y', bx: '-y', at: ay1, lo: Math.max(a.x0, b.x0), hi: Math.min(a.x1, b.x1) };
    else if (by1 === ay0) wall = { ax: '-y', bx: '+y', at: ay0, lo: Math.max(a.x0, b.x0), hi: Math.min(a.x1, b.x1) };
    if (!wall || wall.hi - wall.lo < width + 2 * kit.door.frame) throw new Error(`stage: rooms '${a.id}' and '${b.id}' do not share enough wall for a ${width} m doorway`);
    const mid = Math.round((wall.lo + wall.hi) / 2 / g) * g;
    const op = { lo: mid - width / 2, hi: mid + width / 2, top: height };
    a.openings[wall.ax].push(op); b.openings[wall.bx].push(op);
    return { from: a.id, to: b.id, wall: wall.ax, at: wall.at, ...op };
  });
  for (const r of rooms) for (const k of Object.keys(r.openings)) r.openings[k].sort((p, q) => p.lo - q.lo);
  const first = rooms[0];
  // `time: 'night'`: the style card's night takes the reference's light and air; its moon is the key (the bake's sun)
  const time = m.time ?? 'day';
  if (time !== 'day' && time !== 'night') throw new Error(`stage: time must be 'day' or 'night', got ${JSON.stringify(time)}`);
  const N = time === 'night' ? kit.dress && kit.dress.night : null;
  if (time === 'night' && !(N && kit.sun)) throw new Error(`stage: kit '${kitId}' has no night (its style card carries none)`);
  const nightRef = N ? { ...ref, light: { ...ref.light, ambient: N.light.ambient, key: { color: N.moon.color, elevation: N.moon.elevation, azimuth: N.moon.azimuth } }, air: { ...ref.air, ...N.air } } : ref;
  const nightKit = N ? { ...kit, sky: { ...kit.sky, ...N.sky, sunGain: N.moon.gain } } : kit;
  // `decay` (decay.js): how hard each event hit and where; a blackout takes the ambient down and thickens the air
  const Dk = readDecay(m.decay);
  if (Dk && !(kit.dress && kit.dress.decay)) throw new Error(`stage: kit '${kitId}' can't decay (its style card carries no decay)`);
  const decay = Dk ? { ...Dk, picks: pickDecay({ kit, rooms }, kit.dress, Dk.seed) } : null;
  const dRef = decay ? (() => {
    const Dd = kit.dress.decay.air, b = decay.k.blackout, a = decay.k.abandon;
    const amb = rgbHex(hexRgb(nightRef.light.ambient).map((v, i) => v * (1 - Dd.dim * b) + Dd.tint[i] * 0.04 * b));
    return { ...nightRef, light: { ...nightRef.light, ambient: amb }, air: { ...nightRef.air, fog: { color: Dd.fog, density: r5(nightRef.air.fog.density * (1 + Dd.thicken * Math.max(a, b))) } } };
  })() : nightRef;
  return { kit: nightKit, kitId, ref: dRef, refId, rooms, links, spawn: [(first.x0 + first.x1) / 2, first.y0 + 1.5, 0], lights: m.lights ?? 'auto', ...(N ? { night: N } : {}), ...(decay ? { decay } : {}) };
}

/** Every kit face for the plan (untinted, unlit), plus the torch seats the kit offers. */
export function buildStageGeometry(plan) {
  const { kit } = plan, out = [], seats = [], drains = [], dressBays = [], columns = [], houses = [], labs = [], pilasters = [];
  const surf = (part, variant = 0) => {
    const t = kit.tiles[part];
    return { key: t.family ? `${t.family}-${VARIANTS[variant % 4]}` : t.key, scale: t.scale, tint: kit.tint[part], group: `stage:${part}`, turn: !!t.turn, cell: kit.cells[part] };
  };
  // the floor is paved in BAYS: one flagstone tile spans each structural bay (so its edge joints meet the
  // pilasters), each bay its own variant; a rectangle of floor is split at the bay lines so no face straddles two
  const ft = kit.tiles.floor;
  const bays = (r) => { const nx = Math.max(1, Math.round((r.x1 - r.x0) / kit.bay)), ny = Math.max(1, Math.round((r.y1 - r.y0) / kit.bay)); return { nx, ny, bx: (r.x1 - r.x0) / nx, by: (r.y1 - r.y0) / ny }; };
  // a DRESSED floor is laid in zones across the room's long axis instead: irregular flags, a slate kerb, the
  // hexagonal runner down the middle, a kerb, flags; each zone's tile mapped the floor's way (world x, y)
  const Fd = kit.dress && kit.dress.floor;
  const zonedRect = (r, X0, Y0, X1, Y1) => {
    const alongY = r.y1 - r.y0 >= r.x1 - r.x0, c = alongY ? (r.x0 + r.x1) / 2 : (r.y0 + r.y1) / 2, w = Fd.runner / 2, base = surf('floor'), trimS = surf('trim');
    const zones = [[-Infinity, c - w - Fd.kerb, Fd.field], [c - w - Fd.kerb, c - w, null], [c - w, c + w, Fd.hex], [c + w, c + w + Fd.kerb, null], [c + w + Fd.kerb, Infinity, Fd.field]];
    for (const [z0, z1, tile] of zones) {
      const a0 = Math.max(alongY ? X0 : Y0, z0), a1 = Math.min(alongY ? X1 : Y1, z1); if (a1 - a0 < 1e-6) continue;
      const sf = tile ? { ...base, key: tile.key, scale: tile.scale } : { ...trimS, tint: Fd.kerbTint, group: 'stage:floor', cell: base.cell };
      const o = alongY ? [a0, Y0, 0] : [X0, a0, 0], A = alongY ? [1, 0, 0] : [0, 1, 0], B = alongY ? [0, 1, 0] : [1, 0, 0];
      const la = a1 - a0, lb = alongY ? Y1 - Y0 : X1 - X0;
      panel(out, o, alongY ? A : B, alongY ? la : lb, alongY ? B : A, alongY ? lb : la, [0, 0, 1], { ...sf, uvOf: (p) => [p[0] / sf.scale, p[1] / sf.scale] }, base.cell);
    }
  };
  const floorRect = (r, ri, X0, Y0, X1, Y1) => {
    if (Fd && Fd.runner) return zonedRect(r, X0, Y0, X1, Y1);
    if (Fd) { const base = surf('floor'), sf = { ...base, key: Fd.field.key, scale: Fd.field.scale }; return panel(out, [X0, Y0, 0], [1, 0, 0], X1 - X0, [0, 1, 0], Y1 - Y0, [0, 0, 1], { ...sf, uvOf: (p) => [p[0] / sf.scale, p[1] / sf.scale] }, base.cell); }
    const { nx, ny, bx, by } = bays(r), base = surf('floor');
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const a0 = Math.max(X0, r.x0 + i * bx), a1 = Math.min(X1, r.x0 + (i + 1) * bx), b0 = Math.max(Y0, r.y0 + j * by), b1 = Math.min(Y1, r.y0 + (j + 1) * by);
      if (a1 - a0 < 1e-6 || b1 - b0 < 1e-6) continue;
      const key = `${ft.family}-${VARIANTS[Math.floor(hash3(ri * 97 + i, j, 103) * 4)]}`;
      panel(out, [a0, b0, 0], [1, 0, 0], a1 - a0, [0, 1, 0], b1 - b0, [0, 0, 1], { ...base, key, uvOf: (p) => [(p[0] - r.x0) / bx, (p[1] - r.y0) / by] }, base.cell);
    }
  };
  const plaza = kit.shell === 'plaza';
  const B = plaza ? kit.step.width : kit.shell === 'lab' ? 0 : kit.plinth.out + kit.gutter.width;   // the junction band's depth off the wall
  // A NAVE wall, bay by bay: an engaged column at each bay line; between them a blind pointed arcade arch, a string
  // course, and a lancet window whose glass glows cool and lights the bay; a bay holding a doorway stays flat.
  const naveWall = (F, cuts, flatWall, sf, h, side) => {
    const col = kit.column, ar = kit.arcade, st = kit.string, ln = kit.lancet;
    const glass = { fill: ln.glass, emissive: hexRgb(ln.glass), emissiveStrength: 1.6, group: 'stage:glass' };
    // the bay lines: even bays, or — on the dressing's portal wall — the great door's bay in the middle, flanked
    const Pt = kit.dress && kit.dress.portal, isPortal = Pt && Pt.side === side && !cuts.length && F.len > Pt.width + 4;
    const lines = isPortal ? [0, (F.len - Pt.width) / 2, (F.len + Pt.width) / 2, F.len] : [...Array(Math.max(1, Math.round(F.len / kit.bay)) + 1)].map((_, k, a) => (F.len * k) / (a.length - 1));
    const n = lines.length - 1;
    for (let k = 0; k < n; k++) {
      const u0 = lines[k], u1 = lines[k + 1];
      if (cuts.some(([c0, c1]) => c1 > u0 && c0 < u1)) { flatWall(u0, u1); continue; }
      if (isPortal && k === 1) {
        // the scale break: the great door, an oculus in the wall above it
        const a = u0 + col.r + ar.margin, b = u1 - col.r - ar.margin, zs = h * Pt.spring, H = (b - a) * Pt.rise, top = h - kit.cornice.h;
        const apex = zs + Math.max(H, (b - a) / 2), O = Pt.oculus, S = Math.min((top - apex - 0.4) / 2, O.R + 0.6), zO = apex + 0.25 + S, mid = (u0 + u1) / 2;
        portal(out, F, { u0, u1, z0: 0, z1: zO - S, a, b, zs, H, seg: Pt.seg, orders: Pt.orders, step: Pt.step, depth: Pt.depth, hood: Pt.hood, hoodOut: Pt.hoodOut, bands: Pt.bands },
          { wall: sf.wall, trim: sf.trim, door: { key: Pt.door.key, scale: Pt.door.scale, tint: Pt.door.tint, group: 'stage:door', cell: 1 }, iron: Pt.iron });
        oculus(out, F, { u: mid, z: zO, R: Math.min(O.R, S - 0.25), S, sides: O.sides, depth: O.depth, ring: O.ring }, sf, glass);
        panel(out, onWall(F, u0, 0, zO - S), F.U, mid - S - u0, [0, 0, 1], 2 * S, F.N, sf.wall, sf.wall.cell);
        panel(out, onWall(F, mid + S, 0, zO - S), F.U, u1 - mid - S, [0, 0, 1], 2 * S, F.N, sf.wall, sf.wall.cell);
        panel(out, onWall(F, u0, 0, zO + S), F.U, u1 - u0, [0, 0, 1], h - zO - S, F.N, sf.wall, sf.wall.cell);
        seats.push({ at: P(onWall(F, mid, ln.light.off, zO)), n: F.N, color: ln.light.color, intensity: ln.light.intensity, radius: ln.light.radius, fixture: 'window' });
        dressBays.push({ F, side, k, u0, u1, portal: true, apex });
        continue;
      }
      const a = u0 + col.r + ar.margin, b = u1 - col.r - ar.margin, z0 = kit.plinth.h;
      const zs = Math.max(z0 + 1.6, h * ar.spring), H = (b - a) * ar.rise;
      const apex = archedOpening(out, F, { u0, u1, z0, z1: zs + Math.max(H, (b - a) / 2) + st.gap, a, b, zs, H, seg: ar.seg, depth: ar.depth, ring: ar.ring, ringOut: ar.ringOut }, sf);
      const zS = apex + st.gap;
      wallBox(out, F, u0, u1, zS, zS + st.h, st.out, sf.trim, sf.trim.cell, true);   // the string course
      // the clerestory lancet, if the wall is tall enough to hold one under the cornice
      const mid = (u0 + u1) / 2, la = mid - ln.w / 2, lb = mid + ln.w / 2, sill = zS + st.h + ln.sill, H2 = ln.w * ln.rise;
      const zs2 = h - kit.cornice.h - 0.35 - H2;
      if (zs2 - sill < 0.8) { panel(out, onWall(F, u0, 0, zS), F.U, u1 - u0, [0, 0, 1], h - zS, F.N, sf.wall, sf.wall.cell); dressBays.push({ F, side, k, u0, u1, a, b, zs, apex, zS }); continue; }
      panel(out, onWall(F, u0, 0, zS), F.U, u1 - u0, [0, 0, 1], sill - zS, F.N, sf.wall, sf.wall.cell);
      archedOpening(out, F, { u0, u1, z0: sill, z1: h, a: la, b: lb, zs: zs2, H: H2, seg: ln.seg, depth: ln.depth, ring: 0.12, ringOut: 0.08 }, sf, { glass });
      seats.push({ at: P(onWall(F, mid, ln.light.off, (sill + zs2 + H2) / 2)), n: F.N, color: ln.light.color, intensity: ln.light.intensity, radius: ln.light.radius, fixture: 'window' });
      dressBays.push({ F, side, k, u0, u1, a, b, zs, apex, zS, lancet: { mid, z: (sill + zs2 + H2) / 2, w: ln.w, sill, top: zs2 + H2 } });
    }
    // columns at every bay line, corners included; torches on every other interior one (a portal's flank both)
    for (let k = 0; k <= n; k++) {
      const u = lines[k];
      if (cuts.some(([c0, c1]) => u > c0 - kit.door.frame - col.r && u < c1 + kit.door.frame + col.r)) continue;
      engagedColumn(out, F, u, { ...col, z0: kit.plinth.h, top: h - kit.cornice.h, gutterDepth: kit.gutter.depth }, sf.trim);
      if (k > 0 && k < n && (isPortal || (k - 1) % kit.torch.every === 0)) seats.push({ at: P(onWall(F, u, col.embed + col.r + kit.torch.out, kit.torch.z)), n: F.N });
      columns.push({ F, side, u, top: h - kit.cornice.h });
    }
  };
  plan.rooms.forEach((r, ri) => {
    const w = r.x1 - r.x0, d = r.y1 - r.y0, h = r.h;
    if (kit.shell === 'lab') {
      // a lab is its own floor, walls and roof (lab.js); its bays and structure go to the dressing
      const L = labRoom(out, r, ri, kit, surf, plan.decay ? { k: plan.decay.k, seed: plan.decay.seed, pick: plan.decay.picks[ri] } : null);
      seats.push(...L.seats); dressBays.push(...L.bays); labs.push({ r, ...L.structure });
      return;
    }
    // the floor field stops at the junction band (or runs to the edge on an open side)
    const inset = (side) => (r.open.includes(side) ? 0 : B);
    floorRect(r, ri, r.x0 + inset('-x'), r.y0 + inset('-y'), r.x1 - inset('+x'), r.y1 - inset('+y'));
    const nave = kit.shell === 'nave';
    if (plaza) {
      // open to the sky: no ceiling; each closed side is a row of house fronts over a raised pavement step
      ['-y', '+x', '+y', '-x'].forEach((s, si) => {
        if (r.open.includes(s)) return;
        const F = wallFrame(r, s), startSide = { '-y': '-x', '+y': '+x', '-x': '+y', '+x': '-y' }[s], endSide = { '-y': '+x', '+y': '-x', '-x': '-y', '+x': '+y' }[s];
        const alongX = s.endsWith('y'), lo = alongX || r.open.includes(startSide) ? 0 : B, hi = alongX || r.open.includes(endSide) ? F.len : F.len - B;
        const stepS = surf('step');
        wallBox(out, F, lo, hi, 0, kit.step.h, kit.step.width, stepS, stepS.cell, true);
        // behind a portico the first floor opens onto its walkway: no balconies there
        const under = kit.dress?.portico?.side === s ? { ...kit, house: { ...kit.house, balcony: { ...kit.house.balcony, chance: 0 } } } : kit;
        plazaWall(out, F, { kit: under, seed: ri * 4 + si + 1, surf, record: houses });
      });
      return;
    }
    if (nave) {
      const alongY = d >= w, ends = (alongY ? ['-y', '+y'] : ['-x', '+x']).filter((e) => !r.open.includes(e));
      const cs = surf('ceiling', ri);
      naveVault(out, r, { ...kit.vault, bay: kit.bay, ends }, { ceiling: kit.dress ? { ...cs, ...kit.dress.vault } : cs, trim: surf('trim'), wall: surf('wall', ri * 4) });
    } else {
      const cs = surf('ceiling', ri);
      panel(out, [r.x0, r.y0, h], [1, 0, 0], w, [0, 1, 0], d, [0, 0, -1], cs, cs.cell);
    }
    ['-y', '+x', '+y', '-x'].forEach((s, si) => {
      if (r.open.includes(s)) return;
      const F = wallFrame(r, s), cuts = r.openings[s].map((op) => [...openingU(F, op), op.top]).sort((p, q) => p[0] - q[0]);
      const wallS = surf('wall', ri * 4 + si), trim = surf('trim'), cell = wallS.cell;
      // the wall: full-height solid spans + the lintel over each opening (a nave composes it per bay instead)
      const flatWall = (u0, u1) => {
        const inBay = cuts.map(([a, b, top]) => [Math.max(a, u0), Math.min(b, u1), top]).filter(([a, b]) => b > a);
        for (const [a, b] of solidSpans(u1 - u0, inBay.map(([a, b, top]) => [a - u0, b - u0, top]))) panel(out, add(F.o, mul(F.U, u0 + a)), F.U, b - a, [0, 0, 1], h, F.N, wallS, cell);
        for (const [a, b, top] of inBay) panel(out, add(add(F.o, mul(F.U, a)), [0, 0, top]), F.U, b - a, [0, 0, 1], h - top, F.N, wallS, cell);
      };
      if (!nave) flatWall(0, F.len);
      else naveWall(F, cuts, flatWall, { wall: wallS, trim }, h, s);
      // plinth + cornice runs, broken at doorways (by the frame's width)
      for (const [a, b] of solidSpans(F.len, cuts, kit.door.frame)) wallBox(out, F, a, b, 0, kit.plinth.h, kit.plinth.out, trim, cell);
      wallBox(out, F, 0, F.len, h - kit.cornice.h, h, kit.cornice.out, trim, cell, true);
      // door frames: two jambs + a head, standing a little proud
      for (const [a, b, top] of cuts) {
        const fw = kit.door.frame, fo = kit.door.out;
        wallBox(out, F, a - fw, a, 0, top + fw, fo, trim, cell);
        wallBox(out, F, b, b + fw, 0, top + fw, fo, trim, cell);
        wallBox(out, F, a, b, top, top + fw, fo, trim, cell, true);
      }
      // the junction band: a gutter in front of the plinth, broken at doorways where the floor runs to the wall.
      // ±y walls own the corner squares; ±x walls stop short of them.
      // the wall at this run's start/end (u = 0 / len); a ±x run stops short of a closed ±y wall's corner square
      const startSide = { '-y': '-x', '+y': '+x', '-x': '+y', '+x': '-y' }[s], endSide = { '-y': '+x', '+y': '-x', '-x': '-y', '+x': '+y' }[s];
      const alongX = s.endsWith('y'), gs = surf('gutter');
      const lo = alongX || r.open.includes(startSide) ? 0 : B, hi = alongX || r.open.includes(endSide) ? F.len : F.len - B;
      const g = kit.gutter, at = (u, off, z) => add(add(add(F.o, mul(F.U, u)), mul(F.N, off)), [0, 0, z]);
      const spans = solidSpans(F.len, cuts, kit.door.frame).map(([a, b]) => [Math.max(a, lo), Math.min(b, hi)]).filter(([a, b]) => b - a > 1e-6);
      for (const [a, b] of spans) {
        panel(out, at(a, kit.plinth.out, -g.depth), F.U, b - a, F.N, g.width, [0, 0, 1], gs, gs.cell);              // trench bed
        panel(out, at(a, kit.plinth.out, -g.depth), F.U, b - a, [0, 0, 1], g.depth, F.N, gs, gs.cell);             // under the plinth
        panel(out, at(a, B, -g.depth), F.U, b - a, [0, 0, 1], g.depth, mul(F.N, -1), trim, gs.cell);              // the lip
        for (const [u, sgn] of [[a, 1], [b, -1]]) if (u > lo + 1e-6 && u < hi - 1e-6) {                          // end caps at a doorway
          panel(out, at(u, kit.plinth.out, -g.depth), F.N, g.width, [0, 0, 1], g.depth, mul(F.U, sgn), trim, gs.cell);
        }
        drains.push({ F, a, b });
      }
      // at a doorway the floor runs from the band's edge up to the wall line (the threshold beyond is the reveal)
      for (const [a, b] of cuts) {
        const u0 = Math.max(lo, a - kit.door.frame), u1 = Math.min(hi, b + kit.door.frame);
        const p0 = at(u0, 0, 0), p1 = add(at(u1, 0, 0), mul(F.N, B));
        floorRect(r, ri, Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1]), Math.max(p0[0], p1[0]), Math.max(p0[1], p1[1]));
      }
      // pilasters: every bay along the wall (corners included), skipped where a doorway would be cut
      const pw = kit.pilaster.w, nBays = Math.max(1, Math.round(F.len / kit.bay));
      for (let k = 0; k <= nBays && !nave; k++) {
        const u = (F.len * k) / nBays, a = Math.max(0, u - pw / 2), b = Math.min(F.len, u + pw / 2);
        if (cuts.some(([c0, c1]) => b > c0 - kit.door.frame && a < c1 + kit.door.frame)) continue;
        wallBox(out, F, a, b, kit.plinth.h, h - kit.cornice.h, kit.pilaster.out, trim, cell);
        pilasters.push({ F, u, k, room: r.id, top: h - kit.cornice.h });
        if (k > 0 && k < nBays && (k - 1) % kit.torch.every === 0) seats.push({ at: P(add(add(F.o, mul(F.U, u)), add(mul(F.N, kit.pilaster.out + kit.torch.out), [0, 0, kit.torch.z]))), n: F.N });
      }
    });
    // ribs across the short span at each bay (a nave's ribs ride its vault)
    const alongX = w >= d, span = alongX ? w : d, nRib = nave ? 0 : Math.max(1, Math.round(span / kit.bay));
    for (let k = 1; k < nRib; k++) {
      const c = (alongX ? r.x0 : r.y0) + (span * k) / nRib, half = kit.rib.w / 2;
      const mn = alongX ? [c - half, r.y0, h - kit.rib.drop] : [r.x0, c - half, h - kit.rib.drop];
      const mx = alongX ? [c + half, r.y1, h] : [r.x1, c + half, h];
      box(out, mn, mx, surf('trim'), kit.cells.trim, ['+z', alongX ? '-y' : '-x', alongX ? '+y' : '+x']);
    }
  });
  // doorway reveals: two jambs, a soffit and a threshold through the wall's thickness
  const t = kit.wall / 2, trim = surf('trim'), cell = trim.cell;
  for (const l of plan.links) {
    const alongX = l.wall.endsWith('y');   // a ±y wall runs along x; the passage crosses y
    const A = alongX ? [0, 1, 0] : [1, 0, 0], base = l.at - t;
    const pt = (u, c, z) => (alongX ? [u, c, z] : [c, u, z]);
    const jn = alongX ? [1, 0, 0] : [0, 1, 0];
    panel(out, pt(l.lo, base, 0), A, 2 * t, [0, 0, 1], l.top, jn, trim, cell);
    panel(out, pt(l.hi, base, 0), A, 2 * t, [0, 0, 1], l.top, mul(jn, -1), trim, cell);
    const S = alongX ? [1, 0, 0] : [0, 1, 0];
    panel(out, pt(l.lo, base, l.top), S, l.hi - l.lo, A, 2 * t, [0, 0, -1], trim, cell);
    panel(out, pt(l.lo, base, 0), S, l.hi - l.lo, A, 2 * t, [0, 0, 1], trim, cell);   // the sill: one dressed stone
  }
  return { faces: out, seats, drains, bays: dressBays, columns, houses, pilasters, ...(labs.length ? { labs } : {}) };
}

// ── rubble: pooled low-detail rocks fallen into the gutter, in small clusters ─────
/** Rubble faces for the gutter runs: clusters seeded per run, each 2–4 stones of a pooled basalt. Untextured; each
 *  face carries `tint` + `normal` so the stage bake lights it like the shell. */
export function stageRubble(plan, drains) {
  const rb = plan.kit.rubble, g = plan.kit.gutter;
  if (!rb || !drains.length) return [];
  const pool = rockPool({ rock: rb.rock, variants: rb.variants, detail: 0, tone: rb.tone, seed: 'stage-rubble', group: 'stage:rubble' });
  const items = [];
  drains.forEach(({ F, a, b }, di) => {
    const n = Math.floor((b - a) * rb.perMetre * (0.5 + hash3(di, 0, 211)));
    for (let c = 0; c < n; c++) {
      const u0 = a + 0.3 + (b - a - 0.6) * hash3(di, c, 223), stones = 2 + Math.floor(hash3(di, c, 227) * 3);
      for (let k = 0; k < stones; k++) {
        const u = u0 + (hash3(di * 31 + c, k, 229) - 0.5) * 0.7;
        if (u < a + 0.1 || u > b - 0.1) continue;
        const off = plan.kit.plinth.out + g.width * (0.2 + 0.6 * hash3(di * 31 + c, k, 233));
        const p = add(add(F.o, mul(F.U, u)), mul(F.N, off));
        const size = rb.size[0] + (rb.size[1] - rb.size[0]) * hash3(di * 31 + c, k, 239) ** 2;
        items.push({ x: r5(p[0]), y: r5(p[1]), z0: -g.depth, size: r5(size) });
      }
    }
  });
  const tint = hexRgb(rb.tone);
  return expandRepeats(rockRepeats(pool, items, { sink: 0.25, group: 'stage:rubble' }))
    .map((f) => ({ corners: f.corners.map(P), normal: f.outNormal, outNormal: f.outNormal, tint, group: 'stage:rubble', doubleSided: true }));
}

// ── light ────────────────────────────────────────────────────────────────────
function nearestWallNormal(plan, [x, y]) {
  let best = null;
  for (const r of plan.rooms) for (const [d, n] of [[x - r.x0, [1, 0, 0]], [r.x1 - x, [-1, 0, 0]], [y - r.y0, [0, 1, 0]], [r.y1 - y, [0, -1, 0]]]) {
    if (d >= -0.6 && (!best || d < best.d)) best = { d, n };
  }
  return best ? best.n : [0, 0, 1];
}
/** Resolve the recipe's lights: 'auto' seats a torch on the kit's seats; an array is taken as authored. */
export function resolveStageLights(plan, seats) {
  const t = plan.kit.torch;
  const list = plan.lights === 'auto' ? seats : Array.isArray(plan.lights) ? plan.lights : [];
  return list.map((l, i) => {
    if (!Array.isArray(l.at) || l.at.length !== 3 || !l.at.every(Number.isFinite)) throw new Error(`stage: light ${i} needs at:[x,y,z]`);
    // the wall a light hangs on (its soot lands there): a seat knows it; an authored light takes the nearest wall
    return { at: P(l.at), n: l.n || nearestWallNormal(plan, l.at), color: l.color || t.color, intensity: l.intensity ?? t.intensity, radius: l.radius ?? t.radius, fixture: l.fixture ?? 'torch' };
  });
}
// the era's vertex colour had headroom (PS2 0x80 = 1.0, up to 2×) but a pool still rolled off before white:
// linear to KNEE, then an exponential shoulder that approaches 1
const KNEE = 0.75, NEAR_LIGHT = 1.1;
const shoulder = (v) => (v <= KNEE ? v : KNEE + (1 - KNEE) * (1 - Math.exp(-(v - KNEE) / (1 - KNEE))));
/** Bake ambient + every light into each corner: Lambert (half-wrapped, so pools spill round corners) × a smooth radius falloff. */
export function bakeStageLight(faces, lights, ambient, dirt = () => [1, 1, 1], sun = null) {
  const L = lights.map((l) => ({ ...l, rgb: hexRgb(l.color) }));
  const at = (f, c) => {
      const lit = [...ambient];
      if (sun) {
        // daylight: the sun's Lambert where the shadow test reaches it, plus warm bounce off the ground onto faces that look down or sideways
        const lam = Math.max(0, dot(f.normal, sun.dir));
        if (lam > 0) { const reach = sun.shadow(c, f.normal); for (let k = 0; k < 3; k++) lit[k] += sun.rgb[k] * sun.gain * lam * reach; }
        const down = Math.max(0, 0.5 - 0.5 * f.normal[2]);
        for (let k = 0; k < 3; k++) lit[k] += sun.bounce[k] * sun.bounceGain * down;
      }
      for (const l of L) {
        const to = sub(l.at, c), dist = Math.hypot(to[0], to[1], to[2]);
        if (dist >= l.radius) continue;
        const ndl = dist > 1e-6 ? dot(f.normal, mul(to, 1 / dist)) : 1;
        // the falloff holds flat inside NEAR_LIGHT: a flame doesn't burn the stone behind it white
        const lam = Math.max(0, (ndl + 0.25) / 1.25), fall = (1 - Math.max(dist, NEAR_LIGHT) / l.radius) ** 2;
        for (let k = 0; k < 3; k++) lit[k] += l.rgb[k] * l.intensity * lam * fall;
      }
      const grime = dirt(f, c);
      return lit.map((v, k) => shoulder(v) * f.tint[k] * grime[k]);
  };
  return faces.map((f) => {
    if (!f.tint) return f;   // self-lit (glass): carries its own fill
    const { tint, top, ...rest } = f;
    // a quad gets a colour per corner; an n-gon (a rubble stone) is lit once at its centroid
    if (f.corners.length !== 4) {
      const c = [0, 1, 2].map((k) => f.corners.reduce((s, p) => s + p[k], 0) / f.corners.length);
      return { ...rest, fill: rgbHex(at(f, c)) };
    }
    const cols = f.corners.map((c) => at(f, c));
    const mean = [0, 1, 2].map((k) => cols.reduce((s, v) => s + v[k], 0) / cols.length);
    return { ...rest, fill: rgbHex(mean), cornerFills: cols.map(rgbHex) };
  });
}
/** A torch: an iron bracket, a bowl, and two crossed flame cards; the flame carries a glow halo and is emissive in the GLB.
 *  With live fire (`live`) the fire channel draws the torch's staff and its flame: the wall keeps only an iron arm and
 *  a collar the staff stands in. */
export function torchFaces(l, live = false) {
  const out = [], [x, y, z] = l.at, plain = { key: null, scale: 1, tint: [1, 1, 1] };
  const iron = (mn, mx, fill) => {
    const raw = [];
    box(raw, mn, mx, plain, 1);
    for (const { texture, textureLit, uv, tint, ...f } of raw) out.push({ ...f, fill, group: 'stage:fixture' });
  };
  if (live) {
    const [nx, ny] = l.n, w = [x - nx * 0.32, y - ny * 0.32];
    iron([Math.min(x, w[0]) - 0.025, Math.min(y, w[1]) - 0.025, z - 0.36], [Math.max(x, w[0]) + 0.025, Math.max(y, w[1]) + 0.025, z - 0.31], '#2a2420');   // the arm
    iron([x - 0.045, y - 0.045, z - 0.4], [x + 0.045, y + 0.045, z - 0.28], '#3a3028');   // the collar
    return out;
  }
  iron([x - 0.07, y - 0.07, z - 0.5], [x + 0.07, y + 0.07, z - 0.14], '#2a2420');   // the bracket
  iron([x - 0.12, y - 0.12, z - 0.14], [x + 0.12, y + 0.12, z - 0.06], '#3a3028');  // the bowl
  // the flame: per card, a tapered lower quad (bowl → belly) and a pointed upper quad (belly → tip)
  const fl = l.color, b0 = 0.06, b1 = 0.14, zb = z - 0.06, zm = z + 0.12, zt = z + 0.46;
  for (const [ax, ay] of [[1, 0], [0, 1]]) {
    const at = (u, zz) => P([x + ax * u, y + ay * u, zz]), n = [ay, -ax, 0];
    const common = { normal: n, outNormal: n, group: 'stage:fixture', emissive: hexRgb(fl), emissiveStrength: 4 };
    out.push({ corners: [at(-b0, zb), at(b0, zb), at(b1, zm), at(-b1, zm)], fill: '#fff0c0', ...common, glow: `0 0 8px 3px ${fl}` });
    out.push({ corners: [at(-b1, zm), at(b1, zm), at(0.01, zt), at(-0.01, zt)], fill: '#ff9a3c', ...common });
  }
  return out;
}

// ── the world kind ───────────────────────────────────────────────────────────
const ambientOf = (ref) => hexRgb(ref.light.ambient).map((v) => Math.min(1, v * 1.7));

/** The night sky: stars, and the moon placed on the dome where the bake's moonlight comes from (the dome's front sky
 *  spans azimuths −180°…0°: u 0…1; h is elevation over 90°). */
function nightSky(N, air) {
  const az = ((((N.moon.azimuth % 360) + 540) % 360) - 180) * (Math.PI / 180);
  return { zenith: air.dome.zenith, horizon: air.dome.horizon, day: 0, stars: N.stars, seed: 1,
    moon: { u: +((az + Math.PI / 2) / Math.PI + 0.5).toFixed(4), h: +(N.moon.elevation / 90).toFixed(4), phase: N.moon.phase, size: N.moon.size } };
}

/** A stage's World page, every element on, stays under this (bytes, inline three.js included): what a level may cost to
 *  open, checked by stage-budget.test.js. */
export const STAGE_PAGE_BUDGET = 7 * 1024 * 1024;

/** A card cut into nu × nv cells (corners and uv interpolated), so a page can bend it down its length. */
function splitCard(f, nu, nv) {
  const [a, b, c, d] = f.corners, lerp = (p, q, t) => p.map((v, k) => v + (q[k] - v) * t), out = [];
  const at = (s, t) => P(lerp(lerp(a, b, s), lerp(d, c, s), t)), uv = (s, t) => lerp(lerp(f.uv[0], f.uv[1], s), lerp(f.uv[3], f.uv[2], s), t).map(r5);
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const s0 = i / nu, s1 = (i + 1) / nu, t0 = j / nv, t1 = (j + 1) / nv;
    out.push({ ...f, corners: [at(s0, t0), at(s1, t0), at(s1, t1), at(s0, t1)], uv: [uv(s0, t0), uv(s1, t0), uv(s1, t1), uv(s0, t1)] });
  }
  return out;
}

/** manifest → World payload (the WORLD_KINDS resolver). */
export function assembleStageScene(manifest = {}, ctx = {}) {
  const kit = STAGE_KITS[resolveKitId(manifest.kit)];
  if (kit && manifest.tiles && ['nature', 'jungle', 'isekai'].includes(kit.shell)) throw new Error(`stage: tiles: kit '${manifest.kit}' is open ground, painted by its style card; tiles are for a room kit`);
  if (kit && kit.shell === 'nature') return assembleNatureScene({ style: kit.style, ...manifest }, ctx);
  if (kit && kit.shell === 'jungle') return assembleJungleScene({ style: kit.style, ...manifest }, ctx);
  if (kit && kit.shell === 'isekai') return assembleIsekaiScene({ style: kit.style, ...manifest }, ctx);
  const plan = planStage(manifest);
  const geom = buildStageGeometry(plan), { seats, drains } = geom;
  // a face with no tile (the portal's iron) carries its tint only
  const shell = geom.faces.map((f) => (f.texture === null ? (({ texture, textureLit, uv, ...g }) => g)(f) : f));
  // the kit's DRESSING (nave.js, plaza-dress.js): its own faces, blends over the shell, unbaked sheets, bake-only pools
  // the ends by which this map links to others, and the things a walker can take (doors.js): resolved first, since a
  // dressing reads the way in from them
  const ends = manifest.doors ? stageDoors(plan, geom, manifest.doors) : [], taken = manifest.items ? stageItems(plan, manifest.items) : null;
  const dress = !plan.kit.dress ? null : plan.kit.dress.id === 'delfino-plaza' ? plazaDress(plan, { ...geom, ends, water: !!manifest.water }) : plan.kit.dress.id === 'research-lab' ? labDress(plan, { ...geom, ends, water: !!manifest.water }) : plan.kit.dress.id === 'crypt' ? cryptDress(plan, geom) : naveDress(plan, geom);
  // live wind (`manifest.wind`): the dressing's hung cloth swings in the gust field on the page; its cards are cut into
  // a grid first, so they bend down their length and the bake lights each cell
  const Sw = manifest.wind && plan.kit.dress && plan.kit.dress.sway, windSpec = Sw ? resolveTerrainWind(manifest.wind) : null;
  const hung = (f) => windSpec && Sw.groups[f.group] && typeof f.texture === 'string' && f.texture.startsWith('card:');
  const base0 = [...(dress ? shell.filter((f) => !dress.cut(f)) : shell), ...stageRubble(plan, drains), ...(dress ? dress.faces : []), ...doorFaces(plan, ends), ...(taken ? taken.faces : [])];
  const base = windSpec ? base0.flatMap((f) => (hung(f) ? splitCard(f, Sw.grid[0], Sw.grid[1]) : [f])) : base0;
  // the night's placed lights (plaza-night.js): lanterns, the basin's glow, lit windows, baked like the torches
  const lights = [...resolveStageLights(plan, seats), ...(dress && dress.night ? dress.night.lights : []), ...(dress && dress.lights ? dress.lights : [])];
  // live fire (`manifest.fire`): a dressing's braziers stand by its portal and light the room like the torches do
  const live = !!manifest.fire, Fk = live && plan.kit.dress && plan.kit.dress.fire, portalBay = (geom.bays || []).find((b) => b.portal);
  const braziers = Fk && Fk.braziers && portalBay ? [-1, 1].map((sg) => {
    const Bz = Fk.braziers, u = (portalBay.u0 + portalBay.u1) / 2 + (sg * Bz.apart) / 2;
    return { at: P(onWall(portalBay.F, u, Bz.out, Bz.z)), n: portalBay.F.N, color: Bz.color, intensity: Bz.intensity, radius: Bz.radius, fixture: 'brazier', size: Bz.size };
  }) : [];
  const key = plan.ref.light.key, daylight = plan.kit.sun && key;
  const sun = daylight ? (() => {
    const dir = sunDir(key.elevation, key.azimuth ?? 225), sk = plan.kit.sky;
    // a painted card stops the sun only where it is painted (an awning's stripes, washing, flowers)
    const isCard = (f) => typeof f.texture === 'string' && f.texture.startsWith('card:');
    return { dir, rgb: hexRgb(key.color), gain: sk.sunGain, bounce: sk.bounce, bounceGain: sk.bounceGain,
      shadow: makeSunShadow(base.filter((f) => f.group !== 'stage:glass' && !(dress && dress.shadowSkip(f))), dir, dress ? { maskOf: (f) => (isCard(f) ? cardMask(f.texture) : null) } : {}) };
  })() : null;
  // the blends come after the sun: they lie on the faces they blend, and must not shade them
  const raw = dress ? [...base, ...dress.blends(base)] : base;
  const ambient = daylight ? hexRgb(plan.ref.light.ambient).map((v) => v * plan.kit.sky.fill) : ambientOf(plan.ref);
  const lit = ctx.unshaded
    ? raw.map(({ tint, top, ...f }) => (tint ? { ...f, fill: rgbHex(tint) } : f))
    : bakeStageLight(raw, (dress && dress.pools.length) || braziers.length ? [...lights, ...braziers, ...(dress ? dress.pools : [])] : lights, ambient, makeDirt(plan, lights, dress && dress.dirt ? { ...(manifest.grime !== undefined ? dirtAtGrime(manifest.grime) : {}), ...dress.dirt, ...(manifest.dirt || {}) } : manifest.grime !== undefined ? { ...dirtAtGrime(manifest.grime), ...(manifest.dirt || {}) } : manifest.dirt), sun);
  // live fire (`manifest.fire`, the fire channel): the torches go to the page as fires its bake already holds, so it
  // only flickers their light; the stage keeps their iron and leaves the flames to the channel
  const torches = lights.filter((l) => l.fixture === 'torch');
  const fixtures = torches.flatMap((l) => torchFaces(l, live));
  const r0 = plan.rooms[0];
  // a SET (a room with open sides) is framed from its open corner, looking up into the far corner of the vault
  const setCam = r0.open.length ? (() => {
    const ox = r0.open.includes('+x') ? r0.x1 - 1.2 : r0.open.includes('-x') ? r0.x0 + 1.2 : (r0.x0 + r0.x1) / 2;
    const oy = r0.open.includes('-y') ? r0.y0 + 1.2 : r0.open.includes('+y') ? r0.y1 - 1.2 : (r0.y0 + r0.y1) / 2;
    const tx = ox > (r0.x0 + r0.x1) / 2 ? r0.x0 + 1 : r0.x1 - 1, ty = oy > (r0.y0 + r0.y1) / 2 ? r0.y0 + 3 : r0.y1 - 3;
    const lookZ = plan.kit.shell === 'plaza' ? 4.5 : r0.h * 0.75;
    return { name: 'set', worldFraming: { cameraPosition: [ox, oy, 1.7], lookAt: [tx, ty, lookZ], horizontalFov: 80, pictureCenter: [560, 390] } };
  })() : null;
  const look = plan.links[0] ? [(plan.links[0].lo + plan.links[0].hi) / 2, plan.links[0].at] : null;
  const lookAt = !look ? [(r0.x0 + r0.x1) / 2, r0.y1, 1.8]
    : plan.links[0].wall.endsWith('y') ? [look[0], look[1], 1.8] : [look[1], look[0], 1.8];
  const air = plan.ref.air;
  const faces = [...(dress && dress.night ? lit.map(dress.night.relight) : lit), ...fixtures, ...(dress ? dress.after : [])];
  const Fk2 = plan.kit.dress && plan.kit.dress.decay && plan.kit.dress.decay.flicker;
  const flickerLamps = !plan.decay || !Fk2 ? [] : [
    ...geom.seats.filter((l) => l.flicker).map((l) => ({ at: l.at, radius: l.radius, share: Fk2.of, base: 1, mode: l.flicker.mode, seed: l.flicker.seed })),
    ...(geom.labs || []).flatMap((L) => (L.sparks || []).map((sp) => ({ at: sp.at, radius: sp.radius, share: Fk2.of, base: 0, mode: sp.mode, seed: sp.seed }))),
  ].slice(0, 8);
  const cutouts = [...new Set(faces.filter((f) => typeof f.texture === 'string' && f.texture.startsWith('card:')).map((f) => f.texture))].sort();
  return {
    faces,
    ...(cutouts.length ? { cutouts } : {}),
    // the page sends its textured geometry welded, its baked colour in 8 bits (scene-three.js `pack`): half the bytes
    pack: true,
    // the ends by which this map links to others, and its items (doors.js): only when the recipe names them
    ...(manifest.doors ? { doors: withoutBuild(ends) } : {}),
    ...(taken ? { items: taken.items } : {}),
    // the fires this map knows (the World route resolves `manifest.fire` against them: fire/fire.js resolveFire)
    ...(live ? { fireSources: [...torches.map((l) => ({ kind: 'torch', at: P([l.at[0], l.at[1], l.at[2] - 0.04]), ...(Fk && Fk.torch ? { size: Fk.torch } : {}), baked: true })),
      ...braziers.map((b) => ({ kind: 'brazier', at: b.at, size: b.size, baked: true }))] } : {}),
    lights: lights.map((l, i) => ({ name: `stage-light-${i}`, type: 'point', position: l.at, color: hexRgb(l.color), intensity: +(l.intensity * 40).toFixed(3), range: l.radius })),
    cameras: [manifest.camera || setCam || { name: 'spawn', worldFraming: { cameraPosition: [plan.spawn[0], plan.spawn[1], 1.7], lookAt, horizontalFov: 75, pictureCenter: [560, 390] } }, ...(dress && dress.cameras ? dress.cameras : [])],
    viewBox: manifest.viewBox || { width: 1120, height: 780 },
    title: ctx.title || manifest.title || `mojulo stage · ${lookOfReference(plan.refId).replace('-', ' ')}`,
    bg: daylight ? rgbHex(air.dome.horizon.map((v) => v / 255)) : air.fog.color,
    haze: { color: air.fog.color, density: air.fog.density },
    // the halo is a depth-tested camera-facing sprite: kept inside the torch's clearance from the wall, or the
    // pilasters around it slice it into bright wedges
    glow: { scale: 0.32, opacity: 0.8 },
    // an exterior gets the reference's painted sky dome; an interior declares itself one (engines keep their sun out)
    sky: plan.night ? nightSky(plan.night, air) : daylight ? { zenith: air.dome.zenith, horizon: air.dome.horizon, day: 1, stars: 0, seed: 1 } : { preset: 'interior' },
    // the dressing's weather: the cloud deck over the square, lit by the same sun (an overlay: exports carry none)
    // live water's falling streams (materials/jet.js), drawn on the page; exports carry the painted floor instead
    ...(dress && dress.jets && dress.jets.length ? { jets: normalizeJets(dress.jets) } : {}),
    // at night the falling water is seen in the basin's glow and the moon, not the sun (scene/channels/jet.js `lit`)
    ...(plan.night && plan.night.jets && dress && dress.jets && dress.jets.length ? { jetLight: plan.night.jets } : {}),
    ...(dress && dress.jetLight && dress.jets && dress.jets.length ? { jetLight: dress.jetLight } : {}),
    // a decayed lab's dying lamps, flickered on the page (scene/channels/stage-flicker.js): baked on and stuttering, or
    // baked off and sparking
    ...(flickerLamps.length ? { flicker: { lamps: flickerLamps } } : {}),
    // live wind's hung cloth (scene/channels/stage-sway.js): indoors the wind is the draught through the doors
    ...(windSpec ? { sway: { wind: { speed: +(windSpec.speed * (Sw.draught ?? 1)).toFixed(4), dir: (windSpec.dir * Math.PI) / 180, gust: windSpec.gust, scale: windSpec.scale, evolve: windSpec.evolve,
      veer: (windSpec.veer * Math.PI) / 180, seed: windSpec.seed, z0: Sw.z0 }, groups: Sw.groups } } : {}),
    ...(dress && dress.clouds && sun ? { effects: [composeCloudDeck([], { up: 'z', ...dress.clouds, sun: sun.dir })] } : {}),
    walk: manifest.walk === false ? false
      : { speed: 7, spawn: plan.spawn, minEye: 1.7, gravity: 22, radius: 0.4, ...(manifest.walk && typeof manifest.walk === 'object' ? manifest.walk : {}) },
  };
}
