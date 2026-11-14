/**
 * STAGE BUILDINGS — game buildings standing in open ground, walked into as terrain (`enter: 'walk'`). An outdoor
 * stage recipe's `buildings` seats each one on the land the stage already laid:
 *
 *   buildings: [{ id?, use, seed?, at?, rooms?, add?, kit?, civilization?, look?, tone?, storeys?, wings?, loading?, bays?, embed?, apron?, yard? }]
 *     use            a program (era/programs.js): its rooms and doorways, its goal room
 *     at             a pocket beat's id ('pocket-1': the building stands in the clearing, its door to the trail), or
 *                    { x, y, facing: '+x' | '-x' | '+y' | '-y' } (its door's middle, and the way the door faces out);
 *                    absent, the next pocket the trail laid
 *     civilization   the language its builders speak (an anchor): absent, the outdoor kit's own (STRUCTURE_RAILS)
 *     kit            the room kit its inside is built in: absent, a lab's for a shell language, else the stone
 *     look, tone     a base's building (`base` uses), or a use given a `look` ({ construction?, palette? }), is COMPOSED
 *                    as a building level is (gameworld/levels.js buildingStage): its bay kit, its rooms stocked, its tone,
 *                    its plan's storeys, wings, loading and bays its own. Its windows open through its shell onto the
 *                    land (the sky cards behind them are where the shell is cut), the land's sun at its hour lays their
 *                    patches and its day dims their daylight; it wears its construction outside (style/bay-exterior.js),
 *                    a flat roof behind a parapet or a low steel one, its walls rising over a lower room's roof; and a
 *                    yard YARD deep before its front is kept clear of what grows
 *     embed          true | { up? }: SET INTO ITS SLOPE (embedOf). Its front, the program's way in, is a walkout on the
 *                    land before it; a door out of storey `up` (1) through its back opens on the land behind, that
 *                    storey's height higher. It is placed where the land falls most nearly that much across it, every way
 *                    round, clear of the trail and its landmark with room to walk round it inside the bounds; the land is
 *                    GRADED to it (era/grade.js: a ramp along its sides, level ground before and behind) and laid again,
 *                    the building standing where the first pass placed it. Beside it a STAIR climbs the land
 *                    (era/outdoor-stair.js), the land under its flight a riser below its treads, its other side a bank;
 *                    PATHS of slabs run from the trail to its walkout, along its yard to the stair and from the stair's head
 *                    to its upper door; no window is laid where the land stands over it. Its anchor's `embed` says its
 *                    doors, its stair, `through` (in at the upper door, down its own stairs, out at the walkout) and
 *                    `round` (out of the walkout, up the stair, to the upper door), each point at its height
 *
 * Each building is its INSIDE (the room kit's stage, its rooms laid from the program, a way out of its entry through
 * the front wall, baked in its own torchlight), its OUTSIDE (the outer walls of every room, a plinth down to the
 * land, a roof per room in the language's cap, painted in the kit's structure paint and lit by the stage's sun) and
 * its place: turned so the door faces out, its floor level with the land at its door (cut into its slope, as a game
 * building is), the land, trees, rocks and grass inside its footprint cleared. Its colliders (the stage's own walls, cut at the way out) and lights join the stage's, and
 * an anchor names it: its door, its rooms, its goal room.
 *
 * Pure: a function of the outdoor payload and the recipe. Colliders stay axis-aligned, so a building turns in
 * quarter turns.
 */
import { assembleStageScene, planStage } from './stage.js';
import { withProgram, PROGRAMS } from './programs.js';
import { stageLevel } from '../structure/level.js';
import { STRUCTURE_RAILS } from './out-structures.js';
import { structurePaint, paintStop } from './out-structures-paint.js';
import { madeRamp } from './style/swatches.js';
import { decompileAnchor, ANCHOR_STRUCTURES, ANCHOR_IDS } from './out-anchor-structure.js';
import { designTown } from './out-town.js';
import { structureStyle } from './out-structures.js';
import { dressTownFace } from './town-dress.js';
import { stepsLift } from './out-openings.js';
import { townLanguage } from './out-town.js';
import { streetSpan, layStreet } from './stage-street.js';
import { streetWalls } from './stage-walls.js';
import { registerPalette, registerConstruction, CONSTRUCTIONS } from './style/bay-axes.js';
import { fortOfLanguage } from './out-fortress.js';
import { outTrailOf } from './out-trail-board.js';
import { slabOf } from './solid.js';
import { exteriorOf, stairConcrete, yardSlab, containerSkin } from './style/bay-exterior.js';
import { sunLitFaces, skyAt } from '../form/sun-light.js';
import { readWetness } from './wetness.js';
import { puddles, join, rasterSplatter } from '../rupa/splatter.js';
import { hash3 } from './dirt.js';
import { containerRaw } from '../geocity/industry.js';
import { planStair, stairFaces, slabPath, STAIR } from './outdoor-stair.js';

const r5 = (v) => Math.round(v * 1e5) / 1e5;
const P3 = (p) => p.map(r5);
const GROUND = /:(ground|trail|top|scree)$/;
// a solid roof's thickness: its covering, battens and rafters (era/solid.js)
const ROOF_T = 0.18;
const CLEARED = /:(wood|crown|tree|bough|rock|hat|blaze|debris|grass|grassblend|shadow|card|bush|flower|ikebana)$/;
const FACINGS = { '+x': [1, 0], '-x': [-1, 0], '+y': [0, 1], '-y': [0, -1] };
// a composed building's yard: how deep the ground before its front is kept clear (m)
const YARD = 8;
// a composed building's own ground: how far its apron reaches past its sides and back and before its front (m), how far
// under its floor the land is laid level beneath it, how far the land eases back to its own height round it, the slab's
// thickness at its edge
// (`bank`: the bank round it runs this many metres out for each metre cut or filled, at least `fall` and at most
// `reach`; `steep`: a cut or a fill past this is said as a finding, the site a poor one)
// the lines' colours a yard's containers come in (oxide red, a deep blue, a green, orange, grey, a pale blue, white)
const YARD_LINES = Object.freeze([[0.62, 0.2, 0.14], [0.13, 0.27, 0.5], [0.16, 0.42, 0.3], [0.85, 0.42, 0.1], [0.5, 0.52, 0.54], [0.35, 0.58, 0.72], [0.86, 0.86, 0.84]]);
// how each built part gives the sky back (roughness 0 a mirror to 1 chalk; metal 1 a bare metal): painted steel
// sheens, a container's enamel more, poured concrete barely
// a yard's floodlight: its mast's height (m), its light where its falloff is whole (linear, the solve's units) and its reach
const FLOOD = Object.freeze({ h: 9, key: Object.freeze([2.9, 2.4, 1.5]), radius: 34 });   // (a sodium lamp's amber)
const BUILT_SURFACES = Object.freeze({ 'building:wall': { rough: 0.5 }, 'building:gable': { rough: 0.5 }, 'building:roof': { rough: 0.42 }, 'building:apron': { rough: 0.86 }, 'yard:container': { rough: 0.36 }, 'yard:mast': { rough: 0.45, metal: 1 } });
const APRON = Object.freeze({ side: 3, front: 9, under: 0.1, fall: 5, over: 0.02, edge: 0.35, bank: 3, reach: 18, steep: 1.5, hard: 0.15, wet: 0.55, skirt: 0.25 });
// a building set into its slope: how far its grade runs out past its sides, and how deep the level ground behind it is (m)
const EMBED = { side: 4, back: 6 };

/** The quarter turn that carries the plan's front (-y, out of the entry) onto `facing`. */
function turnFor(facing) {
  // R(θ)·[0,-1] = facing: -y→-y 0, -y→+x a quarter turn anticlockwise, -y→+y a half, -y→-x three quarters
  const q = { '-y': 0, '+x': 1, '+y': 2, '-x': 3 }[facing];
  const c = [1, 0, -1, 0][q], s = [0, 1, 0, -1][q];
  return { q, rot: ([x, y]) => [c * x - s * y, s * x + c * y] };
}

/** The land's sun (its sky's `sun.dir`, toward it, world frame) as a bay's window sun in a plan turned `q` quarters: its
 * elevation in degrees and the way its light travels, in the plan's frame (era/bay-glass.js sunPatches), and its day. */
// (how many times the land's sun a room's paint takes it: a room's bases are solved under its lamps, darker than a
// shell's under the day, so the same sun on them reads as bright as it does outside)
const INDOOR_SUN = 7, INDOOR_HUE = 0.8, INDOOR_DAY = 0.55;
// (is it day? the land's key is a sun standing clear of the horizon under a sky that gives light; at night the key is
// the moon, high in a sky that gives almost none: era/cube-light.js. By day the floods are dark and the rooms' lamps
// stand lower beside the sun; by night the lamps are the light and the moon's patches are faint)
const lumL = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const isDay = (L) => !!L && L.dir[2] > 0.12 && lumL(L.ambient) >= 0.08;
const INDOOR_MOON = 1.5;
function sunIn(sky, q) {
  // (a sky with no sun, a night's or a dusk's under its moon, lays no patch; its day dims the daylight at the windows)
  const day = r5(Math.max(0, Math.min(1, sky?.day ?? 1)));
  if (!sky?.sun?.dir) return { el: 0, toward: [0, -1], day };
  const dir = unit(sky.sun.dir), c = [1, 0, -1, 0][q], s = [0, 1, 0, -1][q], [x, y] = [-dir[0], -dir[1]];
  return { el: r5((Math.asin(Math.max(-1, Math.min(1, dir[2]))) * 180) / Math.PI), toward: [r5(c * x + s * y), r5(-s * x + c * y)], day };
}

/** The land's height under a point: the highest ground face over it (the land's quads are flat enough to plane). */
function groundIndex(faces) {
  const cells = new Map(), C = 1;
  for (const f of faces) {
    if (!GROUND.test(f.group || '') || !f.corners || f.corners.length < 3) continue;
    const xs = f.corners.map((c) => c[0]), ys = f.corners.map((c) => c[1]);
    for (let i = Math.floor(Math.min(...xs) / C); i <= Math.floor(Math.max(...xs) / C); i++) for (let j = Math.floor(Math.min(...ys) / C); j <= Math.floor(Math.max(...ys) / C); j++) {
      const k = `${i},${j}`; if (!cells.has(k)) cells.set(k, []); cells.get(k).push(f);
    }
  }
  return (x, y) => {
    let best = null;
    for (const f of cells.get(`${Math.floor(x / C)},${Math.floor(y / C)}`) || []) {
      const xs = f.corners.map((c) => c[0]), ys = f.corners.map((c) => c[1]);
      if (x < Math.min(...xs) - 1e-6 || x > Math.max(...xs) + 1e-6 || y < Math.min(...ys) - 1e-6 || y > Math.max(...ys) + 1e-6) continue;
      const n = f.normal, p = f.corners[0];
      if (!n || Math.abs(n[2]) < 0.2) continue;
      const z = p[2] - (n[0] * (x - p[0]) + n[1] * (y - p[1])) / n[2];
      if (best === null || z > best) best = z;
    }
    return best;
  };
}

/** The cells (a metre) where the land is rough (a cliff, its lip, a ridge) and where the trail runs. */
const ROUGH = /:(cliff|lip|ridge)$/, PATH = /:(trail|top)$/;
// the land's hard ground (era/substrate.js: sand, bare rock's pavement, scree): what a building may stand on as it is
const HARD = /:(sand|pavement|scree)$/;
function cellsOf(faces, re) {
  const out = new Set();
  for (const f of faces) {
    if (!re.test(f.group || '') || !f.corners) continue;
    const xs = f.corners.map((c) => c[0]), ys = f.corners.map((c) => c[1]);
    for (let i = Math.floor(Math.min(...xs)); i <= Math.floor(Math.max(...xs)); i++) for (let j = Math.floor(Math.min(...ys)); j <= Math.floor(Math.max(...ys)); j++) out.add(`${i},${j}`);
  }
  return out;
}

/** A building's language: an anchor id (or elements), else the outdoor kit's own, else the timber hall. */
function anchorOf(b, kitId) {
  const a = b.civilization ?? STRUCTURE_RAILS[kitId]?.anchor ?? 'timber-hall';
  if (typeof a === 'string' && !ANCHOR_IDS.includes(a)) throw new Error(`stage: building civilization '${a}' is not an anchor (${ANCHOR_IDS.join(', ')})`);
  return a;
}

/**
 * A building composed as a building level is (gameworld/levels.js buildingStage): a base's use (era/programs.js
 * `base`), or any use given a `look` ({ construction, palette }, as a walled-core dungeon's space carries it), on the bay
 * kit its use names, its look composed and its `tone` laid, its plan's `storeys`, `wings`, `loading` and `bays` its own;
 * null for every other building, laid as it was.
 */
function composedOf(b) {
  if (!PROGRAMS[b.use]?.base && b.look === undefined) return null;
  if (b.look !== undefined && (!b.look || typeof b.look !== 'object' || Array.isArray(b.look) || Object.keys(b.look).some((k) => !['construction', 'palette', 'dressing'].includes(k)))) throw new Error(`stage: building '${b.use}' look is { construction?, palette?, dressing? }`);
  // (its plan's settings as a building level takes them: era/programs.js)
  const look = b.look ?? {}, plan = Object.fromEntries(['storeys', 'wings', 'loading', 'bays'].filter((k) => b[k] !== undefined).map((k) => [k, b[k]]));
  return {
    kind: 'stage', kit: b.kit ?? PROGRAMS[b.use]?.kit ?? `bay-${look.construction ?? 'utility'}`,
    program: { use: b.use, seed: b.seed ?? 1, ...(b.rooms ? { rooms: b.rooms } : {}), ...(b.add ? { add: b.add } : {}), ...plan },
    compose: { ...(look.construction ? { construction: look.construction } : {}), ...(look.palette ? { palette: look.palette } : {}), ...(look.dressing ? { dressing: look.dressing } : {}) },
    ...(b.tone !== undefined ? { tone: b.tone } : {}),
  };
}

/**
 * A building SET INTO ITS SLOPE (`embed: true | { up? }`): its front (the program's way in) downhill on the lower land,
 * a way out of its storey `up` (1 by default) through a back wall onto the land behind, which stands that storey's
 * height higher: a walkout. The way is the outermost back wall of a room of that storey, a stair's room last (its walls
 * are its flight's). → { up, rise, way, at } (`rise` the storey's floor over the ground's, `at` the upper way's middle in
 * plan). Refused by name when the building has no such storey or no room of it with a back wall facing out.
 */
function embedOf(b, inner, i, id) {
  const e = b.embed === true ? {} : b.embed;
  if (!e || typeof e !== 'object' || Array.isArray(e) || Object.keys(e).some((k) => k !== 'up')) throw new Error(`stage: buildings[${i}].embed is true or { up?: <storey> } (the storey whose back door meets the land behind)`);
  const up = e.up ?? 1, PI = planStage(inner);
  if (!Number.isInteger(up) || up < 1 || !PI.storeys || up >= PI.storeys.length) throw new Error(`stage: buildings[${i}] (${id}) is set into its slope at storey ${up}, but stands ${PI.storeys?.length ?? 1} storey${(PI.storeys?.length ?? 1) === 1 ? '' : 's'}: give it storeys (a plan's storeys, or a use that has them)`);
  // (a stair's room is the last chosen: its walls are the flight's to climb along)
  const storeyOf = new Map(inner.rooms.map((r) => [r.id, r.storey ?? 0])), stair = new Set((inner.links ?? []).filter((l) => storeyOf.get(l.from) !== storeyOf.get(l.to)).flatMap((l) => [l.from, l.to]));
  // (a room of the storey whose back wall faces out: no room of its storey stands against it there)
  const mine = inner.rooms.filter((r) => (r.storey ?? 0) === up);
  const outward = (r) => !mine.some((q) => q !== r && Math.abs(q.y - (r.y + r.d)) < 1e-6 && q.x < r.x + r.w - 1e-6 && q.x + q.w > r.x + 1e-6);
  const on = mine.filter(outward).sort((p, q) => stair.has(p.id) - stair.has(q.id) || (q.y + q.d) - (p.y + p.d) || q.w - p.w || p.x - q.x);
  if (!on.length) throw new Error(`stage: buildings[${i}] (${id}) is set into its slope at storey ${up}, but no room of that storey has a back wall to open onto the land behind`);
  const r = on[0];
  return { up, rise: r5(PI.storeys[up].z0), way: { room: r.id, side: '+y' }, at: [r.x + r.w / 2, r.y + r.d] };
}

/** The kit's structure paint, or a plain one for a kit its towns are not painted for. `repoint`: a town's `paint`, a
 * group at another of the kit's ramps (a geocube's look carries the cube's: era/geocube.js CUBE_STREET_PAINT); a ramp the
 * kit lacks is passed over, so a street painted for a cube stands in another kit in that kit's own paint. */
function paintFor(kitId, repoint) {
  const hex = (c) => (typeof c === 'string' ? c : `#${c.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')}`);
  const has = (n) => { try { madeRamp(kitId, n); return true; } catch { return false; } };
  const swatches = repoint ? Object.fromEntries(Object.entries(repoint).filter(([, n]) => has(n))) : undefined;
  try { const P = structurePaint(kitId, swatches ? { swatches } : {}); return (group, v) => hex(paintStop(P, group, v)); }
  catch { const base = { 'str:plaster': [196, 186, 166], 'str:stone': [150, 146, 138], 'str:roof': [122, 72, 56] };
    return (group, v) => { const c = base[group] ?? base['str:stone'], k = 0.55 + 0.6 * v; return `#${c.map((x) => Math.max(0, Math.min(255, Math.round(x * k))).toString(16).padStart(2, '0')).join('')}`; }; }
}

/** The kit's structure paint at a group and value, as hex (the town's own groups: str:plaster, str:thatch …). */
const paintRaw = (kitId, repoint) => paintFor(kitId, repoint);

/**
 * A town's street: the civilization's town designed on the kit (era/out-town.js), its lots in the town's own order
 * (the focus, then the near ring, a counter before a dwelling), the first `houses` of them standing; the first
 * `enter` of those walked into (their use's program inside; `goal`: the first holds the level's end), the rest
 * standing as the town draws them.
 */
const USE_ORDER = ['hall', 'shop', 'workshop', 'tower', 'barn', 'dwelling'];
const DOOR_USES = new Set(['dwelling', 'shop', 'tavern', 'keep', 'temple', 'crypt', 'guardhouse', 'library', 'lab']);
const RING_ORDER = { near: 0, mid: 1, far: 2 };
/** The lots a town's street stands, in its order (the focus, then the near ring, a counter before a dwelling), the
 * first `houses` of them: `{ seed, houses, enter, town, lots: [{ l, k }] }`, `town` the designed town (its seed, its
 * heartbeat) and `k` a lot's place in it. Its houses are `town-<use>-<n>` in this order (the folk stand by them). */
export function streetLots(town, kitId, seed0, solid = false) {
  const seed = town.seed ?? seed0 ?? 1, houses = town.houses ?? 6, named = Array.isArray(town.enter);
  const enter = named ? Math.min(town.enter.length, houses) : Math.min(town.enter ?? 1, houses);
  const T = designTown(structureStyle(kitId, seed), seed, { ...(town.recipe ?? {}), ...(town.anchor !== undefined ? { anchor: town.anchor } : {}) }, { solid });
  const all = T.lots.map((l, k) => ({ l, k })).sort((a, b) => (b.l.focus ? 1 : 0) - (a.l.focus ? 1 : 0) || (RING_ORDER[a.l.ring] ?? 3) - (RING_ORDER[b.l.ring] ?? 3)
    || USE_ORDER.indexOf(a.l.use) - USE_ORDER.indexOf(b.l.use) || a.k - b.k);
  // (the uses walked into named, `enter: ['shop', 'dwelling']`: the first lot of each from the whole town, in the street's
  // order, entered first, and the street's own order after them; a house from the next ring stands on the street)
  if (!named) return { seed, houses, enter, town: T, lots: all.slice(0, houses) };
  const picked = [];
  for (const use of town.enter.slice(0, enter)) { const hit = all.find((x) => x.l.use === use && !picked.includes(x)); if (!hit) throw new Error(`stage: town.enter names '${use}', and the town has no ${use} left to walk into (its uses: ${[...new Set(T.lots.map((l) => l.use))].join(', ')})`); picked.push(hit); }
  return { seed, houses, enter, town: T, lots: [...picked, ...all.filter((x) => !picked.includes(x))].slice(0, houses) };
}
function townStreet(town, kitId, seed0, solid = false) {
  if (!town || typeof town !== 'object') throw new Error('stage: town is { anchor?, seed?, houses?, enter?, goal?, recipe?, paint?, street? }');
  for (const k of Object.keys(town)) if (!['anchor', 'seed', 'houses', 'enter', 'goal', 'doors', 'walk', 'walls', 'inside', 'recipe', 'paint', 'dress', 'street'].includes(k)) throw new Error(`stage: town.${k} is not a setting (anchor, seed, houses, enter, goal, doors, walk, walls, inside, recipe, paint, dress, street)`);
  if (town.inside !== undefined && !(town.inside === true || (town.inside && typeof town.inside === 'object' && !Array.isArray(town.inside)))) throw new Error('stage: town.inside is true (its walked-in buildings laid as a town\'s, the vernacular register: rendered walls under beams, furnished by each room\'s role) or { palette }');
  if (town.walls !== undefined && !(town.walls === true || typeof town.walls === 'string' || (town.walls && typeof town.walls === 'object'))) throw new Error('stage: town.walls is true (the town\'s own, from its building language), a fortification\'s id (crenellated, battered), { seed }, or its elements: a gatehouse at each end of the street, its curtain behind the houses');
  if (town.walls !== undefined && !town.street) throw new Error('stage: town.walls closes the street: give the town its street (town.street: true)');
  if (town.walk !== undefined && !(Array.isArray(town.walk) && town.walk.every((u) => typeof u === 'string'))) throw new Error('stage: town.walk is the uses walked into as part of the world (a shop: [\'shop\']), the rest of those entered changing the scene at their door');
  if (town.street !== undefined && typeof town.street !== 'boolean') throw new Error('stage: town.street is true (the trail through the town laid as its language\'s street) or false');
  if (town.paint !== undefined && (typeof town.paint !== 'object' || town.paint === null || Array.isArray(town.paint) || !Object.values(town.paint).every((n) => typeof n === 'string'))) throw new Error('stage: town.paint is { <surface group>: <one of the kit\'s ramps> }: the street\'s houses re-pointed');
  const { seed, enter, lots } = streetLots(town, kitId, seed0, solid);
  // (a language written as its elements is spoken by the houses too; a seeded one, { seed }, only by the street)
  const anchor = typeof town.anchor === 'string' || town.anchor?.elements || town.anchor?.pieces ? town.anchor : STRUCTURE_RAILS[kitId]?.anchor ?? 'timber-hall';
  // how each is entered: a household or a counter changes the scene at its door; a hall, a tower, a barn, a work floor
  // is walked into as terrain (the recipe's `doors: false` walks into all of them; `walk` names the uses that are, a
  // single room's shop part of the world while a house keeps its door)
  return lots.map(({ l }, n) => (n < enter
    ? (town.doors !== false && DOOR_USES.has(l.use) && !(town.walk ?? []).includes(l.use)
      ? { id: `town-${l.use}-${n + 1}`, use: l.use, lot: l, enter: 'door', seed: seed + n, civilization: anchor }
      : { id: `town-${l.use}-${n + 1}`, use: l.use, seed: seed + n, civilization: anchor, ...(town.goal && n === 0 ? { goal: true } : {}), ...insideLook(town, kitId, seed) })
    : { id: `town-${l.use}-${n + 1}`, use: l.use, lot: l }));
}

// (a town's walked-in buildings laid as a town's, `town.inside`: the vernacular register composed, its palette the
// town's where it names one; absent, the room kit as before)
/** A HOMELY building's inside (`homely: true` on a house, a shop, a tavern…: HOMELY_USES) laid as a town's, wherever it
 * stands: the vernacular register in the outdoor kit's own palette, never the stone rooms a crypt or a keep is built in.
 * A building's own kit or look wins; any other use is left as it was. A glyph map's places ask for it (level/grid-scene.js). */
export const HOMELY_USES = Object.freeze(['dwelling', 'shop', 'tavern', 'workshop', 'hall', 'barn', 'library', 'guardhouse']);
const homelyOf = (b, kitId, seed) => {
  if (!b?.homely) return b;
  const { homely: _h, ...rest } = b;
  return HOMELY_USES.includes(rest.use) && rest.kit === undefined && rest.look === undefined ? { ...insideLook({ inside: true }, kitId, rest.seed ?? seed ?? 1), ...rest } : rest;
};
const insideLook = (town, kitId, seed) => (town.inside ? { kit: 'bay-vernacular', look: { construction: insideConstruction(kitId, town, seed), palette: (town.inside === true ? null : town.inside.palette) ?? insidePalette(kitId, town) } } : {});
// the town's interiors built as its houses are: the vernacular construction with its walls in the language's own
// materials (a timbered town's boards, a stone town's ashlar, a plastered one's lime render) and its windows the
// language's lights (their width, their sill and their height), leaded small, registered under its print
function insideConstruction(kitId, town, seed) {
  const L = townLanguage(structureStyle(kitId, seed), town.anchor), V = CONSTRUCTIONS.vernacular;
  const D = (cut, metres, o) => ({ dressed: { cut, ...o }, metres });
  const ofGroup = (g, bond) => (g === 'str:timber' ? D('boards', 2.4, { cols: 8, grit: 0.35 }) : g === 'str:stone' ? D('ashlar', 3, bond === 'rubble' ? { rows: 6, cols: 5, grit: 0.5 } : { rows: 5, cols: 4, grit: 0.4 })
    : g === 'str:plaster' ? D('render', 3, { rows: 4, cols: 3, grit: 0.3, loss: 0.04 }) : D('stucco', 3, { cols: 2, rows: 2, grit: 0.3 }));
  const storeys = L.values?.storeys ?? [], walls = [...new Map(storeys.map((st) => [st.group, ofGroup(st.group, st.bond ?? L.bonds?.[0])])).values()];
  if (walls.length < 2) walls.push(D('stucco', 3, { cols: 2, rows: 2, grit: 0.3 }));
  const Lt = L.elements?.lights ?? {}, cl = (v, a, b, d0) => Math.max(a, Math.min(b, Number.isFinite(v) ? v : d0)), sill = cl(Lt.sill, 0.6, 1.2, 0.9);
  const spec = { ...V, surfaces: { ...V.surfaces, wall: walls }, shell: { ...V.shell, glass: { ...V.shell.glass, punched: { w: cl(Lt.w, 0.6, 1.4, 0.9), sill, head: Math.round((sill + cl(Lt.h, 1.0, 1.8, 1.2)) * 100) / 100 } } } };
  let h = 2166136261; const t = JSON.stringify(spec); for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619);
  return registerConstruction(`vernacular-${(h >>> 0).toString(36)}`, spec);
}
// the town's interiors in the town's own colours: its houses' plaster, stone, timber and tile as its exterior is painted
// (paintFor: the kit's, or the cube's where it paints the stage), made into the vernacular register's palette and
// registered under its print (style/bay-axes.js registerPalette)
function insidePalette(kitId, town) {
  const P = paintRaw(kitId, town.paint), rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const k = (c, f) => c.map((v) => Math.max(0, Math.min(255, Math.round(v * f)))), mix = (a, b, t) => a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));
  const plaster = rgb(P('str:plaster', 0.88)), stone = rgb(P('str:stone', 0.6)), timber = rgb(P('str:timber', 0.42)), board = rgb(P('str:timber', 0.62)), tile = rgb(P('str:tile', 0.55));
  const sw = (c, f = 0.7) => ({ stone: c, mortar: k(c, f) });
  const spec = {
    ambient: '#4a4036',
    floor: [sw(mix(stone, [140, 134, 124], 0.3), 0.62), sw(board, 0.66)], band: [sw(k(stone, 0.92), 0.66)], hazard: [sw(timber)],
    base: [sw(k(stone, 0.85), 0.72)], wall: [sw(plaster, 0.9), sw(mix(plaster, tile, 0.12), 0.9), sw(stone, 0.72)],
    crown: [sw(timber)], column: [sw(timber)], paint: [sw(mix(tile, plaster, 0.35))], services: [sw(timber)], cabinet: [sw(board)], trim: [sw(k(timber, 0.92))],
    ceiling: [sw(board, 0.68), sw(plaster, 0.9)], soffit: [sw(board, 0.68)], concrete: [sw(stone, 0.7)], beam: [sw(k(timber, 0.9))], grate: [sw(board, 0.62)], infill: [sw(board, 0.62)],
  };
  let h = 2166136261; const t = JSON.stringify(spec); for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619);
  return registerPalette(`town-${(h >>> 0).toString(36)}`, spec);
}
const quad = (corners, group, fill) => ({ corners: corners.map(P3), group, fill, cornerFills: [fill, fill, fill, fill].slice(0, corners.length) });
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };

/**
 * The outside of a planned building, in plan coordinates (metres, z from the floor): every room's outer walls where no
 * room stands against them (cut at the way out), a plinth under them `below` deep, and a roof per room in the cap's
 * form, over the highest thing built inside it (`tops`: a kit's vault rises over its walls). → [{ corners, group }]
 * (unpainted). `solid` (era/solid.js: no flat building polygons): each way out cut through the wall's depth (two jambs,
 * a head and a threshold from the outer face to the inside's), each roof a slab ROOF_T thick (its underside, its fascia
 * and verges); absent, the skin as it was, every byte.
 */
function shellOf(plan, ways, wall, cap, pitch, below, tops = {}, solid = false, bay = null) {
  const out = [], t = wall / 2, rooms = plan.rooms, holes = bay?.holes ?? null, parapet = bay?.parapet ?? 0;
  // a face wound so its normal points along `n`
  const faceN = (c, n, group) => { const nn = unit(cross(sub3(c[1], c[0]), sub3(c[c.length - 1], c[0]))); out.push({ corners: nn[0] * n[0] + nn[1] * n[1] + nn[2] * n[2] < 0 ? c.slice().reverse() : c, group, n }); };
  // a room's roof faces as a slab: its underside and a band down each free edge (era/solid.js)
  const slab = (from) => {
    const polys = out.slice(from).filter((f) => f.group === 'roof').map((f) => f.corners), S = slabOf(polys, ROOF_T);
    for (const c of S.under) out.push({ corners: c, group: 'roof', n: [0, 0, -1] });
    for (const e of S.edges) faceN(e.corners, e.out, 'roof');
  };
  // on storeys (storeys.js): each room's walls from its floor (the ground storey's from the plinth), a room with one
  // over it walled up to the floor over it and flat-roofed there (hidden under it, or a terrace where it is not)
  const S = rooms.some((r) => r.storey) ? planStage(plan) : null, at0 = (r) => (S ? S.rooms.find((q) => q.id === (r.id)).z0 : 0);
  const sOf = (r) => r.storey ?? 0, under = (r) => !!S && S.flat.has(r.id);
  const topOf = (r) => (under(r) ? S.storeys[sOf(r) + 1].z0 : Math.max(at0(r) + r.h, tops[r.id] ?? 0) + 0.35);
  // (a bay building's flat roof stands behind a parapet: its outer walls rise past the roof, capped)
  const flatTop = (r) => !under(r) && (cap === 'flat' || (pitch ?? 40) <= 0);
  for (const r of rooms) {
    const zr = at0(r), base = sOf(r) ? zr : -below;
    const [x0, y0, x1, y1] = [r.x, r.y, r.x + r.w, r.y + r.d], top = topOf(r), wallTop = top + (parapet && flatTop(r) ? parapet : 0);
    for (const side of ['-y', '+x', '+y', '-x']) {
      const alongX = side.endsWith('y'), line = side === '-y' ? y0 : side === '+y' ? y1 : side === '-x' ? x0 : x1;
      const out0 = side.startsWith('+') ? t : -t, a0 = (alongX ? x0 : y0) - t, a1 = (alongX ? x1 : y1) + t;
      // the spans of this side another room (of its storey) stands against
      const covered = rooms.filter((q) => q !== r && sOf(q) === sOf(r)).map((q) => {
        const qLine = side === '-y' ? q.y + q.d : side === '+y' ? q.y : side === '-x' ? q.x + q.w : q.x;
        if (Math.abs(qLine - line) > 1e-6) return null;
        const lo = alongX ? q.x : q.y, hi = alongX ? q.x + q.w : q.y + q.d;
        return [Math.max(lo, a0), Math.min(hi, a1), q];
      }).filter((s) => s && s[1] > s[0]).sort((p, q) => p[0] - q[0]);
      const free = [];
      let u = a0;
      for (const [lo, hi] of covered) { if (lo > u) free.push([u, lo]); u = Math.max(u, hi); }
      if (u < a1) free.push([u, a1]);
      const at = (uu, z) => (alongX ? [uu, line + out0, z] : [line + out0, uu, z]);
      const atIn = (uu, z) => (alongX ? [uu, line - out0, z] : [line - out0, uu, z]);
      const n = alongX ? [0, Math.sign(out0), 0] : [Math.sign(out0), 0, 0], un = alongX ? [1, 0, 0] : [0, 1, 0];
      const W = ways.filter((w) => w.room === r.id && w.side === side);
      // (the glazed openings on this side, `holes`: each cut through the shell, a reveal across to the room's wall)
      const H = holes ? openingsOn(holes, alongX, line + out0, n, a0, a1) : [];
      for (const h of H) {
        const atP = (uu, z) => (alongX ? [uu, h.plane, z] : [h.plane, uu, z]);
        faceN([at(h.u0, h.z0), atP(h.u0, h.z0), atP(h.u0, h.z1), at(h.u0, h.z1)], un, 'wall');
        faceN([at(h.u1, h.z0), atP(h.u1, h.z0), atP(h.u1, h.z1), at(h.u1, h.z1)], un.map((x) => -x), 'wall');
        faceN([at(h.u0, h.z1), at(h.u1, h.z1), atP(h.u1, h.z1), atP(h.u0, h.z1)], [0, 0, -1], 'wall');
        faceN([at(h.u0, h.z0), at(h.u1, h.z0), atP(h.u1, h.z0), atP(h.u0, h.z0)], [0, 0, 1], 'wall');
      }
      // the face winds so its normal points out (cut round the openings on it)
      const face0 = (u0, u1, z0, z1) => { if (u1 - u0 < 1e-3 || z1 - z0 < 1e-3) return; const c = [at(u0, z0), at(u1, z0), at(u1, z1), at(u0, z1)], nn = unit(cross(sub3(c[1], c[0]), sub3(c[3], c[0]))); out.push({ corners: nn[0] * n[0] + nn[1] * n[1] < 0 ? c.reverse() : c, group: 'wall', n }); };
      const face = H.length ? (u0, u1, z0, z1) => { for (const q of cutRect(u0, u1, z0, z1, H)) face0(...q); } : face0;
      // (a bay building: where a lower room stands against this side, its wall still rises over that room's roof)
      if (bay) for (const [lo, hi, q] of covered) if (topOf(q) + 1e-6 < wallTop) face(lo, hi, Math.max(base, topOf(q)), wallTop);
      // (and its parapet: an inner face down to the roof from the wall's line, and its coping)
      const atL = (uu, z) => (alongX ? [uu, line, z] : [line, uu, z]), [r0, r1] = alongX ? [x0, x1] : [y0, y1];
      if (wallTop > top) for (const [s0, s1] of free) {
        const p0 = Math.max(s0, r0), p1 = Math.min(s1, r1);
        if (p1 - p0 < 1e-3) continue;
        faceN([atL(p0, top), atL(p1, top), atL(p1, wallTop), atL(p0, wallTop)], n.map((x) => -x), 'wall');
        faceN([at(s0, wallTop), at(s1, wallTop), atL(Math.min(s1, r1 + t), wallTop), atL(Math.max(s0, r0 - t), wallTop)], [0, 0, 1], 'wall');
      }
      for (const [s0, s1] of free) {
        let v = s0;
        for (const w of W) {
          if (w.hi < s0 || w.lo > s1) continue;
          // (a way out of an upper storey stands at its floor, `zr`: a building set into its slope)
          const wt = zr + w.top;
          face(v, w.lo, base, wallTop); face(w.lo, w.hi, wt, wallTop); face(w.lo, w.hi, base, zr); v = w.hi;
          // (solid: the way cut through the wall, outer face to inner: its jambs facing in, its head down, its threshold up)
          if (solid) {
            faceN([at(w.lo, zr), atIn(w.lo, zr), atIn(w.lo, wt), at(w.lo, wt)], un, 'wall');
            faceN([at(w.hi, zr), atIn(w.hi, zr), atIn(w.hi, wt), at(w.hi, wt)], un.map((x) => -x), 'wall');
            faceN([at(w.lo, wt), at(w.hi, wt), atIn(w.hi, wt), atIn(w.lo, wt)], [0, 0, -1], 'wall');
            faceN([at(w.lo, zr), at(w.hi, zr), atIn(w.hi, zr), atIn(w.lo, zr)], [0, 0, 1], 'wall');
          }
        }
        face(v, s1, base, wallTop);
      }
    }
    // the roof: a gable along the long side (a hip when the cap is hipped), flat for a flat cap, a pyramid for a dome
    // (behind a parapet, to the wall's line and no further)
    const e = wallTop > top ? -t : 0.45, X0 = x0 - t - e, X1 = x1 + t + e, Y0 = y0 - t - e, Y1 = y1 + t + e, along = r.w >= r.d;
    const span = along ? Y1 - Y0 : X1 - X0, rise = cap === 'flat' || under(r) ? 0 : Math.min(r.h, (span / 2) * Math.tan(((pitch ?? 40) * Math.PI) / 180));
    const z0 = top, z1 = top + rise, from = out.length;
    if (under(r)) { out.push({ corners: [[x0 - t, y0 - t, z0], [x1 + t, y0 - t, z0], [x1 + t, y1 + t, z0], [x0 - t, y1 + t, z0]], group: 'roof', n: [0, 0, 1] }); continue; }   // (a floor over it, or a terrace walled by the storey on it)
    if (cap === 'flat' || rise < 0.05) { out.push({ corners: [[X0, Y0, z0], [X1, Y0, z0], [X1, Y1, z0], [X0, Y1, z0]], group: 'roof', n: [0, 0, 1] }); if (solid) slab(from); continue; }
    if (cap === 'dome' || cap === 'pyramid' || cap === 'cone' || cap === null) {
      const c = [(X0 + X1) / 2, (Y0 + Y1) / 2, z1];
      for (const [a, b] of [[[X0, Y0, z0], [X1, Y0, z0]], [[X1, Y0, z0], [X1, Y1, z0]], [[X1, Y1, z0], [X0, Y1, z0]], [[X0, Y1, z0], [X0, Y0, z0]]]) out.push({ corners: [a, b, c], group: 'roof' });
      if (solid) slab(from);
      continue;
    }
    const hip = cap === 'hip' ? Math.min(span / 2, (along ? X1 - X0 : Y1 - Y0) / 2 - 0.01) : 0;
    if (along) {
      const ym = (Y0 + Y1) / 2, r0 = [X0 + hip, ym, z1], r1 = [X1 - hip, ym, z1];
      out.push({ corners: [[X0, Y0, z0], [X1, Y0, z0], r1, r0], group: 'roof' }, { corners: [[X1, Y1, z0], [X0, Y1, z0], r0, r1], group: 'roof' });
      out.push({ corners: [[X0, Y1, z0], [X0, Y0, z0], r0], group: hip ? 'roof' : 'gable' }, { corners: [[X1, Y0, z0], [X1, Y1, z0], r1], group: hip ? 'roof' : 'gable' });
    } else {
      const xm = (X0 + X1) / 2, r0 = [xm, Y0 + hip, z1], r1 = [xm, Y1 - hip, z1];
      out.push({ corners: [[X1, Y0, z0], [X1, Y1, z0], r1, r0], group: 'roof' }, { corners: [[X0, Y1, z0], [X0, Y0, z0], r0, r1], group: 'roof' });
      out.push({ corners: [[X0, Y0, z0], [X1, Y0, z0], r0], group: hip ? 'roof' : 'gable' }, { corners: [[X1, Y1, z0], [X0, Y1, z0], r1], group: hip ? 'roof' : 'gable' });
    }
    if (solid) slab(from);
  }
  return out;
}

/**
 * The glazed openings on one side of the shell: the holes (`{ n, plane, u0, u1, z0, z1 }`, plan coordinates, `n` the way
 * the opening looks out, `plane` its outer face) whose outward way is this side's and whose outer face stands within a
 * wall's breadth inside the shell's face at `shellAt`, clipped to the side's run `a0..a1`.
 */
function openingsOn(holes, alongX, shellAt, n, a0, a1) {
  return holes.filter((h) => h.n[0] === n[0] && h.n[1] === n[1] && Math.abs(h.plane - shellAt) < 0.6 && h.u1 > a0 && h.u0 < a1)
    .map((h) => ({ ...h, u0: Math.max(a0, h.u0), u1: Math.min(a1, h.u1) }));
}

/** A wall's rectangle `u0..u1 × z0..z1` less the openings in it: the strips between and round them. → [[u0, u1, z0, z1]] */
function cutRect(u0, u1, z0, z1, H) {
  const cuts = [...new Set([u0, u1, ...H.flatMap((h) => [h.u0, h.u1]).filter((u) => u > u0 && u < u1)])].sort((a, b) => a - b), out = [];
  for (let k = 0; k + 1 < cuts.length; k++) {
    const a = cuts[k], b = cuts[k + 1], mid = (a + b) / 2;
    const over = H.filter((h) => h.u0 <= mid && h.u1 >= mid && h.z1 > z0 && h.z0 < z1).map((h) => [Math.max(z0, h.z0), Math.min(z1, h.z1)]).sort((p, q) => p[0] - q[0]);
    let z = z0;
    for (const [lo, hi] of over) { if (lo > z) out.push([a, b, z, lo]); z = Math.max(z, hi); }
    if (z < z1) out.push([a, b, z, z1]);
  }
  return out;
}

/**
 * A bay building's glazed openings, read off its inside before it is moved: each window's sky card (era/bay-glass.js
 * glazeOpening) stands at the opening's outer face, as wide and as tall as it, facing in. → [{ n, plane, u0, u1, z0, z1 }]
 */
function openingsOf(faces) {
  return faces.filter((f) => f.group === 'stage:sky').map((f) => {
    const xs = f.corners.map((c) => c[0]), ys = f.corners.map((c) => c[1]), zs = f.corners.map((c) => c[2]);
    const alongX = Math.abs(f.normal[1]) > 0.5, n = alongX ? [0, -Math.sign(f.normal[1])] : [-Math.sign(f.normal[0]), 0];
    const [u0, u1] = alongX ? [Math.min(...xs), Math.max(...xs)] : [Math.min(...ys), Math.max(...ys)];
    return { n, plane: alongX ? ys[0] : xs[0], u0, u1, z0: Math.min(...zs), z1: Math.max(...zs) };
  });
}

/**
 * The door a building is entered by when the scene changes at it (`enter: 'door'`): its zone on the threshold
 * outside, and where a walker coming back out stands (on the land a few steps out, facing away). `x` the door's
 * middle and `y0` its wall's outer face, in plan (the front faces -y); `out` how far the stoop runs.
 */
function doorOf(id, x, y0, out, F, ground) {
  const zone = F.toWorld([x, y0 - 0.7]), back = F.toWorld([x, y0 - out - 2.4]), [nx, ny] = F.rot([0, -1]), odd = F.q % 2 === 1;
  const gz = (p) => ground(p[0], p[1]) ?? F.floor;
  return { id, at: P3([zone[0], zone[1], F.floor]), half: odd ? [0.75, 1.4, 2] : [1.4, 0.75, 2], spawn: P3([back[0], back[1], gz(back)]), heading: r5(Math.atan2(ny, nx)) };
}

/** Whether a point lies on a street's paving (its road, walks, kerbs and door paths): a lookup over their top faces. */
function pavedBy(faces, re = /^street:(road|walk|kerb)$/) {
  const C = 2, cells = new Map(), tops = faces.filter((f) => re.test(f.group) && f.normal[2] > 0.7);
  for (const f of tops) {
    const P = f.corners.map((c) => [c[0], c[1]]), xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
    for (let i = Math.floor(Math.min(...xs) / C); i <= Math.floor(Math.max(...xs) / C); i++) for (let j = Math.floor(Math.min(...ys) / C); j <= Math.floor(Math.max(...ys) / C); j++) {
      const k = `${i},${j}`; if (!cells.has(k)) cells.set(k, []); cells.get(k).push(P);
    }
  }
  const inside = (P, x, y) => { let s = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) s = !s; } return s; };
  return (x, y) => (cells.get(`${Math.floor(x / C)},${Math.floor(y / C)}`) || []).some((P) => inside(P, x, y));
}

/** The live grass with no cell on the paving: a cell's tufts stand anywhere in it, so a cell any corner of which is paved
 *  grows none (era/isekai.js liveGrassConfig's mask, bit 1 the cell grows). */
function offPaving(L, paved) {
  const g = L.grid, M = Uint8Array.from(Buffer.from(g.m.__b64, 'base64')), CX = g.nx - 1;
  let n = 0;
  for (let j = 0; j < g.ny - 1; j++) for (let i = 0; i < CX; i++) {
    if (!(M[j * CX + i] & 1)) continue;
    const at = (a, b) => paved(g.x0 + (i + a) * g.cell, g.y0 + (j + b) * g.cell);
    if (at(0, 0) || at(1, 0) || at(1, 1) || at(0, 1) || at(0.5, 0.5)) { M[j * CX + i] = 0; n++; }
  }
  return n ? { ...L, grid: { ...g, m: { ...g.m, __b64: Buffer.from(M.buffer).toString('base64') } } } : L;
}

// A face less the boxes it crosses (in plan): the pieces of it outside every box, each corner's height and whatever
// else it carries a corner (a colour, a share) carried along its edges; a face clear of every box is returned as it came.
function cutOutBoxes(f, boxes) {
  const n = f.corners.length, hit = boxes.filter((B) => { const xs = f.corners.map((c) => c[0]), ys = f.corners.map((c) => c[1]); return Math.max(...xs) > B[0] && Math.min(...xs) < B[2] && Math.max(...ys) > B[1] && Math.min(...ys) < B[3]; });
  if (!hit.length) return [f];
  // a corner of a piece: a mix of two of the face's own corners
  let polys = [f.corners.map((c, i) => ({ p: c, a: i, b: i, t: 0 }))];
  const mix = (P, Q, t) => ({ p: [0, 1, 2].map((k) => P.p[k] + (Q.p[k] - P.p[k]) * t), src: [P, Q, t] });
  const clip = (poly, axis, at, keepLess) => { const out = [], side = (v) => (keepLess ? at - v.p[axis] : v.p[axis] - at);
    for (let i = 0; i < poly.length; i++) { const P = poly[i], Q = poly[(i + 1) % poly.length], sp = side(P), sq = side(Q);
      if (sp >= 0) out.push(P);
      if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) out.push(mix(P, Q, sp / (sp - sq))); }
    return out; };
  for (const B of hit) { const next = [];
    for (let rem of polys) {
      for (const [axis, at, less] of [[0, B[0], true], [0, B[2], false], [1, B[1], true], [1, B[3], false]]) {
        if (rem.length < 3) break;
        const outside = clip(rem, axis, at, less);
        if (outside.length >= 3) next.push(outside);
        rem = clip(rem, axis, at, !less);
      }
    }
    polys = next; }
  // each corner's weights over the face's own corners
  const weights = (v) => { if (!v.src) return { [v.a]: 1 }; const [P, Q, t] = v.src, wp = weights(P), wq = weights(Q), w = {};
    for (const [k, x] of Object.entries(wp)) w[k] = (w[k] || 0) + x * (1 - t);
    for (const [k, x] of Object.entries(wq)) w[k] = (w[k] || 0) + x * t;
    return w; };
  const perCorner = Object.keys(f).filter((k) => k !== 'corners' && Array.isArray(f[k]) && f[k].length === n && k !== 'normal' && k !== 'outNormal');
  const at = (arr, w) => { const ks = Object.keys(w), v0 = arr[ks[0]];
    if (typeof v0 === 'number') return r5(ks.reduce((s, k) => s + arr[k] * w[k], 0));
    if (Array.isArray(v0) && typeof v0[0] === 'number') return v0.map((_, c) => r5(ks.reduce((s, k) => s + arr[k][c] * w[k], 0)));
    return arr[ks.reduce((m, k) => (w[k] > w[m] ? k : m), ks[0])]; };
  const out = [];
  for (const poly of polys) for (let i = 1; i + 1 < poly.length; i += 2) {
    const part = [poly[0], poly[i], poly[i + 1], ...(i + 2 < poly.length ? [poly[i + 2]] : [])], ws = part.map(weights);
    const area = Math.abs(part.reduce((s, v, k) => { const q = part[(k + 1) % part.length]; return s + v.p[0] * q.p[1] - q.p[0] * v.p[1]; }, 0)) / 2;
    if (area < 1e-6) continue;
    out.push({ ...f, corners: part.map((v) => P3(v.p)), ...Object.fromEntries(perCorner.map((k) => [k, ws.map((w) => at(f[k], w))])) });
  }
  return out;
}

/**
 * The outdoor payload with its buildings seated: their faces, lights, colliders and anchors added, the land's growth
 * cleared from their footprints. A recipe without `buildings` returns the payload as it came. `ctx.planOnly` seats
 * nothing and answers `{ reserved }`, the ground each would claim (the stage lays its land again round it: reserve.js).
 */
export function withBuildings(payload, manifest, ctx = {}) {
  if (manifest.buildings === undefined && manifest.town === undefined) return payload;
  const list0 = manifest.buildings ?? [];
  if (!Array.isArray(list0) || (manifest.buildings !== undefined && !list0.length)) throw new Error('stage: buildings is [{ use, at?, seed?, civilization?, kit? }], at least one');
  // a town's street (`town`): its lots in the town's own order, the first `enter` of them walked into, the rest its
  // houses standing as shells; seated after the recipe's own buildings, on what land is left
  const street = manifest.town !== undefined ? townStreet(manifest.town, manifest.kit, manifest.seed, !!ctx.solid) : [];
  const list = [...list0, ...street].map((b) => homelyOf(b, manifest.kit, manifest.seed));
  const kitId = manifest.kit, ground = groundIndex(payload.faces), paint = paintFor(kitId, manifest.town?.paint);
  const pockets = (payload.anchors || []).filter((a) => a.kind === 'beat' && a.beat === 'pocket');
  const sun = unit(payload.sky?.sun?.dir ?? [0.45, -0.55, 0.7]);
  const seated = [], taken = [], reserved = [], grades = [], placed = [], pathFaces = [];
  const beats = (payload.anchors || []).filter((a) => a.kind === 'beat' && Array.isArray(a.at)).sort((p, q) => (p.s ?? p.at[1]) - (q.s ?? q.at[1]));
  const stones = beats.filter((a) => a.beat === 'landmark');
  const bounds = (payload.colliders || []).filter((c) => String(c.of || '').startsWith('bound:'));
  // (the ground the bounds' walls enclose, from the wall on each side, when every side has one)
  const sideOf = (k) => bounds.filter((c) => String(c.of).endsWith(`:${k}`));
  const inBounds = ['-x', '-y', '+x', '+y'].every((k) => sideOf(k).length) ? [Math.max(...sideOf('-x').map((c) => c.max[0])), Math.max(...sideOf('-y').map((c) => c.max[1])), Math.min(...sideOf('+x').map((c) => c.min[0])), Math.min(...sideOf('+y').map((c) => c.min[1]))] : null;
  const rough = cellsOf(payload.faces, ROUGH), path = cellsOf(payload.faces, PATH);
  // (the form render's record of the buildings' rooms, in the world's frame: their lamps, the sun they were baked under)
  const formRooms = [];
  // (the yards' floodlights: their lamp faces, and their lights for the form render's record)
  const lampFaces = [], floods = [];
  // (each slab apron laid: its rect and the boxes that stand on it)
  const aprons = [];
  const roofs = [], netFaces = [];
  // (the hard standing a wet recipe films: every building's apron slab)
  const wetQuads = [];
  // (every footprint the land was cleared under: what the form render grows there, payload.plants, is cleared too)
  const clearedBoxes = [];
  let faces = payload.faces, lights = [...(payload.lights || [])], colliders = [...(payload.colliders || [])], anchors = [...(payload.anchors || [])];
  const cutouts = new Set(payload.cutouts || []);
  // the town's street (`town.street`, stage-street.js): the trail through it laid as its language's lane; the houses
  // seated to front it, behind its footway, and kept off it
  const ST = manifest.town?.street && manifest.trail !== undefined ? (() => {
    const L = townLanguage(structureStyle(kitId, manifest.town.seed ?? manifest.seed ?? 1), manifest.town.anchor);
    return { L, span: streetSpan(L), site: outTrailOf(manifest).site };
  })() : null;
  const offStreet = (x, y) => ST && Math.abs(x - ST.site.trailX(y)) < ST.span.half + 0.2;
  // the street's stretch: from before its first house to past its last, along the trail
  const streetRange = (ys) => [Math.max(0, Math.min(...ys) - 6), Math.min(ST.site.D, Math.max(...ys) + 6)], planned = [];
  // the walls a fortified street closes it with (town.walls): true, the town's own, from its building language
  // (out-fortress.js fortOfLanguage); else the fortification named
  const wallsOf = (y0, y1) => streetWalls(ST.site, ST.span, { y0, y1, taken, ground: (x, y) => ground(x, y), fort: manifest.town.walls === true ? fortOfLanguage(ST.L, manifest.town.seed ?? manifest.seed ?? 1) : manifest.town.walls, seed: manifest.town.seed ?? manifest.seed ?? 1 });
  list.forEach((b, i) => {
    if (!b || typeof b.use !== 'string') throw new Error(`stage: buildings[${i}] needs a use`);
    const id = b.id ?? `${b.use}-${i + 1}`, anchor = anchorOf(b, kitId), t = 0.25;
    // a house of the town's standing as its shell (no inside): its footprint the lot's building, its door on its front
    const lot = b.lot ?? null;
    let inner = null, entry = null, doorPlan, rects, E = null;
    if (lot) {
      const fs = lot.design.faces, xs = fs.flatMap((f) => f.corners.map((c) => c[0])), ys = fs.flatMap((f) => f.corners.map((c) => c[1]));
      const dr = fs.find((f) => f.part === 'door' || f.part === 'accent');
      rects = [[Math.min(...xs), Math.max(0, Math.min(...ys)), Math.max(...xs), Math.max(...ys)]];
      doorPlan = [dr ? dr.corners.reduce((a, c) => a + c[0], 0) / dr.corners.length : (rects[0][0] + rects[0][2]) / 2, 0];
    } else {
      // the inside: the program on its room kit, a way out of the entry through its front; a base's building (or one
      // given a look) on its bay kit and composed, as a building level is (gameworld/levels.js buildingStage), so its
      // rooms are stocked, its own ways out (a hangar's doors) kept beside the front
      const inner0 = withProgram(composedOf(b) ?? { kind: 'stage', kit: b.kit ?? (anchor === 'shell' ? 'research-lab' : 'gothic-stone'), program: { use: b.use, seed: b.seed ?? 1, civilization: anchor, ...(b.rooms ? { rooms: b.rooms } : {}), ...(b.add ? { add: b.add } : {}) } });
      entry = inner0.rooms.find((r) => r.id === inner0._program.entry);
      const front = { room: entry.id, side: '-y' };
      inner = { ...inner0, ways: composedOf(b) ? [front, ...(inner0.ways ?? []).filter((w) => w.room !== front.room || w.side !== front.side)] : [front] };
      doorPlan = [(entry.x + entry.x + entry.w) / 2, entry.y];
      rects = inner.rooms.map((r) => [r.x - t, r.y - t, r.x + r.w + t, r.y + r.d + t]);
      // (set into its slope: a way out of its upper storey through its back wall, onto the land behind it)
      if (b.embed !== undefined) { E = embedOf(b, inner, i, id); inner = { ...inner, ways: [...inner.ways, E.way] }; }
    }
    if (E && (lot || b.enter === 'door')) throw new Error(`stage: buildings[${i}] (${id}) is set into its slope (embed) and walked into: it changes no scene at a door`);
    // how the building fits standing with its door at T facing out: its floor level with the land at its door (a game
    // building is cut into its slope, not stood on stilts over it), how far the land behind stands over that floor, how
    // much cliff and trail it covers, whether it crosses the stage's bounds or another building
    const fit = (T, facing) => {
      const { q, rot } = turnFor(facing);
      const toWorld = ([x, y]) => { const [u, v] = rot([x - doorPlan[0], y - doorPlan[1]]); return [T[0] + u, T[1] + v]; };
      const boxes = rects.map((R0) => { const a = toWorld([R0[0], R0[1]]), c = toWorld([R0[2], R0[3]]); return [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[0], c[0]), Math.max(a[1], c[1])]; });
      const samples = [];
      for (const R0 of rects) for (let x = R0[0]; x <= R0[2] + 1e-6; x += 1) for (let y = R0[1]; y <= R0[3] + 1e-6; y += 1) samples.push(toWorld([x, y]));
      const zs = samples.map(([x, y]) => ground(x, y)).filter((z) => z !== null);
      const atDoor = [toWorld([doorPlan[0], doorPlan[1] - 0.6]), toWorld([doorPlan[0], doorPlan[1] + 0.6])].map(([x, y]) => ground(x, y)).filter((z) => z !== null);
      if (zs.length < samples.length * 0.9 || !atDoor.length) return { off: true };
      // (a door with steps stands its floor up them: the steps' foot on the land, era/out-openings.js)
      const floor = Math.max(...atDoor) + (lot?.design?.dims?.steps ? stepsLift(lot.design.dims.steps) : 0.12);
      const cellsIn = (set) => { let n = 0; for (const B of boxes) for (let i = Math.floor(B[0]); i <= Math.floor(B[2]); i++) for (let j = Math.floor(B[1]); j <= Math.floor(B[3]); j++) if (set.has(`${i},${j}`)) n++; return n; };
      const hits = (B, c) => B[0] < c.max[0] && c.min[0] < B[2] && B[1] < c.max[1] && c.min[1] < B[3];
      // a building never stands on a beat of the trail (the way runs through them) or another building
      // (one set into its slope keeps its walk round clear of them, and of the landmark's great stone)
      const onBeat = boxes.some((B) => beats.some((bt) => bt.at[0] > B[0] - 2 && bt.at[0] < B[2] + 2 && bt.at[1] > B[1] - 2 && bt.at[1] < B[3] + 2))
        || (!!E && boxes.some((B) => stones.some((a) => a.at[0] > B[0] - 9 && a.at[0] < B[2] + 9 && a.at[1] > B[1] - 9 && a.at[1] < B[3] + 9)));
      const onStreet = !!ST && String(id).startsWith('town-') && boxes.some((B) => [[B[0], B[1]], [B[2], B[1]], [B[0], B[3]], [B[2], B[3]], [(B[0] + B[2]) / 2, (B[1] + B[3]) / 2]].some(([x, y]) => offStreet(x, y)));
      // (a composed building, or one set into its slope, stands inside the bounds' walls, not wholly past one)
      // (one set into its slope with room to walk round it inside them, on its grade's banks)
      const mg = E ? 3 : 0;
      const past = (composedOf(b) || E) && inBounds && boxes.some((B) => B[0] < inBounds[0] + mg || B[1] < inBounds[1] + mg || B[2] > inBounds[2] - mg || B[3] > inBounds[3] - mg);
      const blocked = onBeat || onStreet || past || boxes.some((B) => bounds.some((c) => hits(B, c)) || taken.some((T2) => B[0] < T2[2] && T2[0] < B[2] && B[1] < T2[3] && T2[1] < B[3]));
      // (set into its slope: how far the land falls from behind it, at its upper door, to before its front, at its own)
      const drop = E ? (ground(...toWorld([E.at[0], E.at[1] + 1.5])) ?? floor) - (ground(...toWorld([doorPlan[0], doorPlan[1] - 1.5])) ?? floor) : 0;
      return { q, rot, toWorld, boxes, zs, floor, into: Math.max(...zs) - floor, drop, rough: cellsIn(rough), path: cellsIn(path), blocked };
    };
    // (a building set into its slope wants the land to fall a storey across it, its front downhill, not the flattest)
    // (and stands clear of the trail, its grade too: the walk keeps its own height, so a bank would stand beside it)
    const score = (F) => (F.off ? Infinity : (E ? 3 * Math.abs(F.drop - E.rise) : F.into) + 3 * F.rough + (F.path ? (E ? 1000 : 40) : 0) + (F.blocked ? 1000 : 0));
    let T, facing;
    const was = ctx.placed?.[i] ?? null;
    if (was) { T = was.T; facing = was.facing; }
    else if (b.at && typeof b.at === 'object') {
      if (!Number.isFinite(b.at.x) || !Number.isFinite(b.at.y) || !FACINGS[b.at.facing]) throw new Error(`stage: buildings[${i}].at is a pocket id or { x, y, facing: +x | -x | +y | -y }`);
      T = [b.at.x, b.at.y]; facing = b.at.facing;
    } else if (typeof b.at === 'string') {
      const p = pockets.find((q) => q.id === b.at);
      if (!p) throw new Error(`stage: buildings[${i}] names '${b.at}', which is not a pocket (pockets: ${pockets.map((q) => q.id).join(', ') || 'none'}); give at: { x, y, facing }`);
      const toMouth = p.mouth ? [p.mouth[0] - p.at[0], p.mouth[1] - p.at[1]] : [0, -1];
      facing = Math.abs(toMouth[0]) >= Math.abs(toMouth[1]) ? (toMouth[0] >= 0 ? '+x' : '-x') : (toMouth[1] >= 0 ? '+y' : '-y');
      T = [p.at[0], p.at[1]];
    } else {
      // absent: the flattest place beside the trail, its door to the trail; the trail's beats and pockets the places
      // looked at (each beat a few distances out to either side), the first best kept
      const cands = [], street = ST && String(id).startsWith('town-');
      if (street) {
        // a town with a street fronts it: a seat every metre and a half along it, either side, just behind its footway
        // and facing it (the house turned to the nearest quarter), the seats nearest the town's heart first
        for (let y = 2; y <= ST.site.D - 2 + 1e-9; y += 1.5) {
          const x = ST.site.trailX(y), dx = ST.site.trailX(y + 0.5) - ST.site.trailX(y - 0.5), l = Math.hypot(dx, 1), n = [1 / l, -dx / l];
          for (const sg of [1, -1]) {
            const out = [-sg * n[0], -sg * n[1]], f = Math.abs(out[0]) >= Math.abs(out[1]) ? (out[0] >= 0 ? '+x' : '-x') : (out[1] >= 0 ? '+y' : '-y');
            cands.push([[r5(x + sg * n[0] * (ST.span.half + 1.4)), r5(y + sg * n[1] * (ST.span.half + 1.4))], f, 0.15 * Math.abs(y - ST.site.D / 2)]);
          }
        }
      } else {
        for (const p of pockets) { const m = p.mouth ? [p.mouth[0] - p.at[0], p.mouth[1] - p.at[1]] : [0, -1]; cands.push([[p.at[0], p.at[1]], Math.abs(m[0]) >= Math.abs(m[1]) ? (m[0] >= 0 ? '+x' : '-x') : (m[1] >= 0 ? '+y' : '-y')]); }
        beats.forEach((bt, k) => {
          const a = beats[Math.max(0, k - 1)].at, c = beats[Math.min(beats.length - 1, k + 1)].at, d = unit([c[0] - a[0], c[1] - a[1], 0]), n = [-d[1], d[0]];
          for (const off of E ? [8, 11, 14, 17, 20] : [5, 8, 11]) for (const sg of [1, -1]) {
            const out = [-sg * n[0], -sg * n[1]], f = Math.abs(out[0]) >= Math.abs(out[1]) ? (out[0] >= 0 ? '+x' : '-x') : (out[1] >= 0 ? '+y' : '-y');
            cands.push([[r5(bt.at[0] + sg * n[0] * off), r5(bt.at[1] + sg * n[1] * off)], f]);
          }
        });
      }
      let best = null;
      // (set into its slope, it is tried every way round: its front where the land falls away)
      const tries = E ? cands.flatMap(([P0, , near]) => Object.keys(FACINGS).map((f) => [P0, f, near])) : cands;
      for (const [P0, f, near = 0] of tries) { const F = fit(P0, f), sc = score(F) + near; if (!best || sc < best.sc - 1e-9) best = { T: P0, facing: f, sc }; }
      if (!best || best.sc === Infinity) throw new Error(`stage: buildings[${i}] (${id}) finds no place on the land beside the trail; give at: { x, y, facing }`);
      // (a street's house with no free frontage left is not built: stacked on another it would be a ruin)
      if (street && best.sc >= 1000) return;
      T = best.T; facing = best.facing;
    }
    const F0 = fit(T, facing);
    if (F0.off) throw new Error(`stage: buildings[${i}] (${id}) stands off the land`);
    // (on land graded for it, it stands at the floor it was planned at)
    const F = was ? { ...F0, floor: was.floor, into: Math.max(...F0.zs) - was.floor } : F0;
    const { q, rot, toWorld, zs, floor, into } = F;
    taken.push(...F.boxes);
    // the planning pass only claims the ground (era/reserve.js): the land is laid again round it before anything is built
    if (ctx.planOnly) {
      reserved.push(...F.boxes.map((B) => B.map(r5)));
      // (a composed building's yard, or one set into its slope: the ground before its front, as wide as it and YARD deep,
      // kept clear of what grows)
      if (composedOf(b) || E) { const x0 = Math.min(...rects.map((R0) => R0[0])), x1 = Math.max(...rects.map((R0) => R0[2])), y0 = Math.min(...rects.map((R0) => R0[1])), a = F.toWorld([x0 - 1, y0 - YARD]), c = F.toWorld([x1 + 1, y0]); reserved.push([Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[0], c[0]), Math.max(a[1], c[1])].map(r5)); }
      if (ST && String(id).startsWith('town-')) planned.push(T[1]);
      // (ITS OWN GROUND, a composed building's that is not set into a slope: it clears a level place on the land a
      // margin wider than itself, its yard before its front, and lays its apron there, era/grade.js; the land eases up
      // or down to it round its edge, and nothing grows on it)
      if (composedOf(b) && !E) {
        const x0 = Math.min(...rects.map((R0) => R0[0])), x1 = Math.max(...rects.map((R0) => R0[2])), y0 = Math.min(...rects.map((R0) => R0[1])), y1 = Math.max(...rects.map((R0) => R0[3]));
        const a = F.toWorld([x0 - APRON.side, y0 - APRON.front]), c = F.toWorld([x1 + APRON.side, y1 + APRON.side]), apron = [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[0], c[0]), Math.max(a[1], c[1])].map(r5);
        // THE SITE IT ASKS THE LAND FOR: its level is the land's own mean across its ground where that stands over its
        // door's land, so what is cut on the high side is filled on the low one and it is never jammed into a slope; the land eases back
        // to itself over a bank no steeper than one in APRON.bank, however far that is. What it asked and what it
        // cost (the cut, the fill, the bank's run) are said on the building
        const hs = []; for (let x = apron[0]; x <= apron[2] + 1e-6; x += 2) for (let y = apron[1]; y <= apron[3] + 1e-6; y += 2) { const z = ground(x, y); if (z !== null) hs.push(z); }
        // (never below the land at its door: the way in comes off the land, or up a stoop, never down into a pit)
        const level = hs.length ? Math.max(hs.reduce((p, q) => p + q, 0) / hs.length, floor - APRON.under) : floor - APRON.under, cut = hs.length ? Math.max(...hs) - level : 0, fill = hs.length ? level - Math.min(...hs) : 0;
        const fall = r5(Math.min(APRON.reach, Math.max(APRON.fall, APRON.bank * Math.max(cut, fill))));
        grades.push({ box: apron, z: r5(level), fall });
        reserved.push(apron);
        placed[i] = { T, facing, floor: r5(level + APRON.under), apron, site: { level: r5(level), cut: r5(cut), fill: r5(fill), bank: fall } };
      }
      // (set into its slope: the land cut and filled round it, era/grade.js, and its place kept for the second pass)
      if (E) {
        const x0 = Math.min(...rects.map((R0) => R0[0])), x1 = Math.max(...rects.map((R0) => R0[2])), y0 = Math.min(...rects.map((R0) => R0[1])), y1 = Math.max(...rects.map((R0) => R0[3]));
        const box = ([a0, b0, a1, b1]) => { const a = F.toWorld([a0, b0]), c = F.toWorld([a1, b1]); return [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[0], c[0]), Math.max(a[1], c[1])].map(r5); };
        // (the ramp from its front to the wall its upper door is in, the land level behind from there: what stands further
        // back of that wall is buried)
        const lo = r5(floor - 0.12), hi = r5(floor + E.rise - 0.12), [dx, dy] = F.rot([0, 1]), yu = E.at[1] + t, dir = [Math.round(dx), Math.round(dy)];
        // (its stair, era/outdoor-stair.js: up the strip beside it nearer the trail, else the other; on its side the land
        // stands level before the flight's foot and past its head, the flight between; the other side its bank)
        const sideAt = (sg) => { const m = F.toWorld([sg > 0 ? x1 + EMBED.side / 2 : x0 - EMBED.side / 2, (y0 + yu) / 2]); return Math.min(Infinity, ...beats.map((bt) => Math.hypot(bt.at[0] - m[0], bt.at[1] - m[1]))); };
        const St = [1, -1].sort((p, q) => sideAt(p) - sideAt(q)).map((side) => planStair({ x0, x1, y0, yu, rise: E.rise, side })).find(Boolean) ?? null;
        grades.push({ box: box([x0 - EMBED.side, y0, x1 + EMBED.side, yu]), z: [lo, hi], dir },
          { box: box([x0 - EMBED.side, y0 - YARD, x1 + EMBED.side, y0]), z: lo }, { box: box([x0 - EMBED.side, yu, x1 + EMBED.side, Math.max(y1, yu + EMBED.back)]), z: hi });
        if (St) {
          // (laid last, each easing out only a little, so nothing laid round it leaks onto the flight; under the flight the
          // land runs a riser and a hand below its treads: each step stands on it, none buried)
          const [sx0, sx1] = St.side > 0 ? [x1, x1 + EMBED.side] : [x0 - EMBED.side, x0], under = St.h + 0.05, fall = STAIR.landing;
          grades.push({ box: box([sx0, y0, sx1, St.foot]), z: lo, fall }, { box: box([sx0, St.head, sx1, yu]), z: hi, fall }, { box: box([sx0, St.foot, sx1, St.head]), z: [r5(lo - under), r5(hi - under)], dir, fall });
        }
        // (nothing grows on its banks, its stair's strip or the level ground behind it: they are walked round it)
        reserved.push(box([x0 - EMBED.side, y0, x1 + EMBED.side, Math.max(y1, yu + EMBED.back)]));
        placed[i] = { T, facing, floor, drop: r5(F.drop), stair: St };
      }
      return;
    }
    const clearUnder = (pad, land = true) => {
      if (land) clearedBoxes.push(...F.boxes);
      const grow = F.boxes.map((B) => [B[0] - pad, B[1] - pad, B[2] + pad, B[3] + pad]), mid = (f) => { const n = f.corners.length; return [f.corners.reduce((a, c) => a + c[0], 0) / n, f.corners.reduce((a, c) => a + c[1], 0) / n]; };
      // (the land is CUT at the footprint, not dropped by its faces' middles: a face that straddles a wall keeps what
      // of it lies outside, so no corner of the land stands inside the building over its floor)
      faces = faces.flatMap((f) => { const g = f.group || '';
        if (CLEARED.test(g)) { const [cx, cy] = mid(f); return grow.some((B) => cx >= B[0] && cx <= B[2] && cy >= B[1] && cy <= B[3]) ? [] : [f]; }
        if (land && (GROUND.test(g) || ROUGH.test(g))) return cutOutBoxes(f, F.boxes);
        return [f]; });
    };
    if (lot) {
      // the shell: the lot's building as the town draws it, painted and lit by the stage's sun, a plinth to the land,
      // one collider round it
      const below0 = Math.max(0.3, floor - Math.min(...zs) + 0.3), Wl = (p) => { const [x, y] = toWorld(p); return [x, y, p[2] + floor]; };
      clearUnder(0.4, false);   // a shell has no floor: its land stays (its collider keeps a walker out)
      const Pt = paintRaw(kitId, manifest.town?.paint), lit = (n) => 0.55 + 0.45 * Math.max(0, n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]);
      // (a cube's street dressed: its walls painted from relief, town-dress.js; absent, the paint alone)
      const Dr = manifest.town?.dress, dressed = (face, grp) => (Dr ? dressTownFace(face, grp, Dr) : face);
      const shellF = lot.design.faces.map((f) => { const c = f.corners.map(Wl), nn = unit(cross(sub3(c[1], c[0]), sub3(c[c.length - 1], c[0]))); return dressed({ ...quad(c, `town:${f.part}`, Pt(f.group, Math.min(1, (f.value ?? 0.6) * lit(nn)))), normal: P3(nn), outNormal: P3(nn) }, f.group); });
      const [x0, y0, x1, y1] = rects[0], plinth = [[[x0, y0], [x1, y0]], [[x1, y0], [x1, y1]], [[x1, y1], [x0, y1]], [[x0, y1], [x0, y0]]].map(([a, c]) => { const cs = [Wl([...a, -below0]), Wl([...c, -below0]), Wl([...c, 0]), Wl([...a, 0])], nn = unit(cross(sub3(cs[1], cs[0]), sub3(cs[3], cs[0]))); return dressed({ ...quad(cs, 'town:plinth', Pt('str:stone', 0.45 * lit(nn))), normal: P3(nn), outNormal: P3(nn) }, 'plinth'); });
      // (a screen over a light: one card, its star field a cutout texture, era/screen-tiles.js)
      const screenF = (lot.design.screens || []).map((f) => { const c = f.corners.map(Wl), nn = unit(cross(sub3(c[1], c[0]), sub3(c[c.length - 1], c[0]))), fill = Pt(f.group, Math.min(1, (f.value ?? 0.6) * lit(nn))); cutouts.add(f.texture); return { corners: c.map(P3), group: 'town:screen', fill, cornerFills: c.map(() => fill), normal: P3(nn), outNormal: P3(nn), texture: f.texture, textureLit: true, uv: f.uv }; });
      faces = [...faces, ...shellF, ...screenF, ...plinth];
      const top = Math.max(...lot.design.faces.flatMap((f) => f.corners.map((c) => c[2]))), B = F.boxes[0];
      colliders.push({ min: P3([B[0], B[1], floor - below0]), max: P3([B[2], B[3], floor + top]), of: `${id}:house` });
      const door = b.enter === 'door' ? doorOf(id, doorPlan[0], 0, 0, F, ground) : null;
      anchors.push({ id: `house-${id}`, kind: 'house', use: b.use, at: P3(Wl([doorPlan[0], doorPlan[1], 0])), N: P3((() => { const [nx, ny] = F.rot([0, -1]); return [nx, ny, 0]; })()), floor: r5(floor), box: { min: P3([B[0], B[1], floor]), max: P3([B[2], B[3], floor + top]) },
        ...(door ? { enter: 'door', door, inside: { use: b.use, seed: b.seed ?? 1, civilization: anchor } } : {}) });
      seated.push({ id, use: b.use, house: true, floor: r5(floor), ...(door ? { enter: 'door' } : {}) });
      return;
    }
    if (b.enter === 'door') {
      // the scene changes at its door: the outside only (walls, roofs, stoop), a door shut in the way in, solid; the
      // inside is a level of its own (its program, entered by its door)
      const waysD = planStage(inner).ways ?? [], belowD = Math.max(0.3, floor - Math.min(...zs) + 0.3);
      const Wd = (p) => { const [x, y] = toWorld(p); return [x, y, p[2] + floor]; };
      clearUnder(0.4);
      const L0 = decompileAnchor(typeof anchor === 'string' ? ANCHOR_STRUCTURES[anchor] : anchor, typeof anchor === 'string' ? anchor : null);
      const massD = L0.anchor.pieces.find((p) => p.role === 'mass') ?? {}, capD = L0.anchor.pieces.find((p) => p.role === 'cap') ?? null;
      const lam = (nn) => Math.max(0, nn[0] * sun[0] + nn[1] * sun[1] + nn[2] * sun[2]);
      const DrD = manifest.town?.dress;
      const paintFace = (cs, group, grp, v) => { const nn = unit(cross(sub3(cs[1], cs[0]), sub3(cs[cs.length - 1], cs[0]))), F0 = { ...quad(cs, group, paint(grp, Math.min(1, v * (0.55 + 0.45 * lam(nn))))), normal: P3(nn), outNormal: P3(nn) }; return DrD && group !== 'building:door' ? dressTownFace(F0, grp, DrD) : F0; };
      const shellD = shellOf(inner, waysD, 0.5, L0.vocab.cap, L0.proportions.pitch, belowD, {}, !!ctx.solid).map((sf) => paintFace(sf.corners.map(Wd), `building:${sf.group}`, sf.group === 'roof' ? (capD?.group ?? 'str:plaster') : (massD.group ?? 'str:plaster'), sf.group === 'roof' ? (capD?.value ?? 0.5) : (massD.value ?? 0.7)));
      // the door, shut: a leaf filling the way in, set a hand's width inside the outer face
      const wy = waysD[0], y = entry.y - t + 0.08, leaf = [[wy.lo, y, 0], [wy.hi, y, 0], [wy.hi, y, wy.top], [wy.lo, y, wy.top]].map(Wd);
      const doorLeaf = { ...paintFace(leaf.slice().reverse(), 'building:door', 'str:timber', 0.35) };
      const dropD = floor - (ground(...toWorld([doorPlan[0], doorPlan[1] - 0.6])) ?? floor), runD = Math.max(0.6, dropD * 2.5);
      const stoopD = dropD > 0.05 ? (() => {
        const a = wy.lo - 0.2, c = wy.hi + 0.2, y0 = entry.y - t, y1 = y0 - runD, zb = -dropD - 0.15;
        return [[[a, y1, zb], [c, y1, zb], [c, y0, 0], [a, y0, 0]], [[a, y0, 0], [a, y1, zb], [a, y0, zb]], [[c, y1, zb], [c, y0, 0], [c, y0, zb]]].map((cs) => paintFace(cs.map(Wd), 'building:stoop', 'str:stone', 0.5));
      })() : [];
      faces = [...faces, ...shellD, doorLeaf, ...stoopD];
      const tallD = Math.max(12, ...shellD.flatMap((f) => f.corners.map((c) => c[2] - floor)));
      for (const B of F.boxes) colliders.push({ min: P3([B[0], B[1], floor - belowD]), max: P3([B[2], B[3], floor + tallD]), of: `${id}:shut` });
      const door = doorOf(id, doorPlan[0], entry.y - t, dropD > 0.05 ? runD : 0, F, ground);
      anchors.push({ id: `building-${id}`, kind: 'building', use: b.use, enter: 'door', language: L0.id, turn: q, at: P3(Wd([doorPlan[0], doorPlan[1], 0])), N: P3((() => { const [nx, ny] = rot([0, -1]); return [nx, ny, 0]; })()), floor: r5(floor),
        door, inside: { use: b.use, seed: b.seed ?? 1, civilization: anchor, ...(b.kit ? { kit: b.kit } : {}), ...(b.rooms ? { rooms: b.rooms } : {}), ...(b.add ? { add: b.add } : {}), ...(b.look !== undefined ? { look: b.look } : {}), ...(b.tone !== undefined ? { tone: b.tone } : {}) }, ...(b.goal ? { isGoal: true } : {}) });
      seated.push({ id, use: b.use, enter: 'door', language: L0.id, floor: r5(floor), into: r5(Math.max(0, into)), rough: F.rough, findings: inner._program.findings.map((f) => f.says) });
      return;
    }
    // (a composed bay building takes the land's sun at its windows, turned into its plan's frame, and its windows open
    // through the shell: the sky cards that stood behind them in a room on its own are where the shell is cut)
    const bay = !!composedOf(b);
    // (set into its slope, the land against its walls in its plan's frame: from its front's floor to its upper storey's)
    const inGround = E ? { _ground: { y0: Math.min(...rects.map((R0) => R0[1])), y1: E.at[1] + t, z0: -0.12, z1: r5(E.rise - 0.12) } } : {};
    const P0 = assembleStageScene(bay ? { ...inner, ...inGround, _sun: sunIn(payload.sky, q) } : E ? { ...inner, ...inGround } : inner, ctx), ways = planStage(inner).ways ?? [];
    const holes = bay ? openingsOf(P0.faces) : null, P = bay ? { ...P0, faces: P0.faces.filter((f) => f.group !== 'stage:sky') } : P0;
    const below = Math.max(0.3, floor - Math.min(...zs) + 0.3);
    const W = (p) => { const [x, y] = toWorld(p); return [x, y, p[2] + floor]; };
    const turnN = (n) => { const [x, y] = rot([n[0], n[1]]); return [x, y, n[2]]; };
    // the land's growth (a wall's width out) and the land itself (cliffs too) cleared under it: the floor the only ground inside
    clearUnder(0.4);
    // the inside, moved
    const moved = P.faces.map((f) => ({ ...f, corners: f.corners.map((c) => P3(W(c))), ...(f.normal ? { normal: P3(turnN(f.normal)) } : {}), ...(f.outNormal ? { outNormal: P3(turnN(f.outNormal)) } : {}), node: f.node ? `${id}:${f.node}` : undefined }))
      .map(({ node, ...f }) => (node ? { ...f, node } : f));
    if (bay && P0.form?.room) formRooms.push({ _of: `building-${id}`, ...P0.form.room, lights: P0.form.room.lights.map((l) => ({ ...l, at: l.radius >= 1e8 ? P3(turnN(l.at)) : P3(W(l.at)) })) });
    // (its shell baked as its rooms are, its colour and the day's light apart, under the day the land stands in:
    // form/sun-light.js, under the land's day, `ctx.dayLight`; the sun's cast shadow is the page's live one)
    const shellLight = bay && P0.form?.room && ctx.dayLight ? ctx.dayLight : null;
    // the outside, painted and lit by the stage's sun
    const L = decompileAnchor(typeof anchor === 'string' ? ANCHOR_STRUCTURES[anchor] : anchor, typeof anchor === 'string' ? anchor : null);
    // painted as the language paints its houses: the mass's group and value on the walls, the cap's on the roof
    const mass = L.anchor.pieces.find((p) => p.role === 'mass') ?? {}, capP = L.anchor.pieces.find((p) => p.role === 'cap') ?? null;
    const wallGroup = mass.group ?? 'str:plaster', wallV = mass.value ?? 0.7, roofGroup = capP?.group ?? wallGroup, roofV = capP?.value ?? wallV * 0.7;
    // each room's highest face inside: the roof stands over the vault, not through it
    const tops = Object.fromEntries(inner.rooms.map((r) => [r.id, Math.max(0, ...P.faces.filter((f) => { const n = f.corners.length, cx = f.corners.reduce((a, c) => a + c[0], 0) / n, cy = f.corners.reduce((a, c) => a + c[1], 0) / n; return cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.d; }).flatMap((f) => f.corners.map((c) => c[2])))]));
    // (a composed bay building wears its construction outside, painted in its palette: style/bay-exterior.js)
    // (a town's building, its interior the vernacular made from its language (`town.inside`), wears its town's outside
    // as the street's houses do: the language's wall and roof, painted and dressed as theirs, its windows cut through)
    const vern = bay && /^vernacular/.test(P0.compose?.axes?.construction ?? '');
    const X = bay && !vern ? exteriorOf(P0.compose?.axes) : null;
    const shell0 = X ? shellOf(inner, ways, 0.5, X.cap, X.pitch, below, tops, !!ctx.solid, { holes, parapet: X.parapet }).map((s) => {
      // (lit by the land's sun where its sky has one, else by its day alone: a dusk under its moon, a night; the fill is
      // the light the page multiplies the tile by, so a sunlit wall carries white and shows its material as painted)
      const c = s.corners.map(W), nn = unit(cross(sub3(c[1], c[0]), sub3(c[c.length - 1], c[0]))), lam = payload.sky?.sun?.dir ? Math.max(0, nn[0] * sun[0] + nn[1] * sun[1] + nn[2] * sun[2]) : 0;
      const T = s.group === 'roof' ? X.roof : X.wall, flat = Math.abs(nn[2]) > 0.5, day = Math.max(0, Math.min(1, payload.sky?.day ?? 1)), g = Math.round(255 * Math.min(1, (0.68 + 0.32 * lam) * (0.35 + 0.65 * day))), fill = `#${g.toString(16).padStart(2, '0').repeat(3)}`;
      const uv = c.map((p) => (flat ? [p[0], p[1]] : [p[0] * -nn[1] + p[1] * nn[0], p[2]]).map((v) => r5(v / T.scale)));
      return { ...quad(c, `building:${s.group}`, fill), texture: T.key, textureLit: true, uv, normal: P3(nn), outNormal: P3(nn) };
    }) : shellOf(inner, ways, 0.5, L.vocab.cap, L.proportions.pitch, below, tops, !!ctx.solid, vern ? { holes } : null).map((s) => {
      const c = s.corners.map(W), nn = unit(cross(sub3(c[1], c[0]), sub3(c[c.length - 1], c[0]))), lam = Math.max(0, nn[0] * sun[0] + nn[1] * sun[1] + nn[2] * sun[2]);
      const roof = s.group === 'roof', v = (roof ? roofV : wallV) * (0.55 + 0.45 * lam);
      const F0 = { ...quad(c, `building:${s.group}`, paint(roof ? roofGroup : wallGroup, Math.min(1, v))), normal: P3(nn), outNormal: P3(nn) };
      return manifest.town?.dress ? dressTownFace(F0, roof ? roofGroup : wallGroup, manifest.town.dress) : F0;
    });
    // THE APRON (its own ground, planned above): a slab of poured concrete over the level place, a hair over the land
    // laid for it, its edge a kerb down into the land; cut round the building, the land under it cut away so nothing
    // grows through it. Lit as the shell is
    // (`apron`: 'slab', poured concrete, a hardstanding on soft land; or 'ground', the land's own, levelled and left
    // as it is, so a building on rock or sand stands on rock or sand. Its own word, else by what the land is
    // under it: the ground where APRON.hard of it is already hard, else a slab)
    // (what the land is under its site, read off the land itself: the share of its ground there that is sand, bare
    // rock or scree, by area; a land mostly hard is its own hardstanding)
    const hardShare = was && was.apron ? (() => { const [ax0, ay0, ax1, ay1] = was.apron; let hard = 0, all = 0;
      for (const f of faces) { const g = f.group || ''; if (!(GROUND.test(g) || HARD.test(g))) continue;
        const n = f.corners.length, cx = f.corners.reduce((p, c) => p + c[0], 0) / n, cy = f.corners.reduce((p, c) => p + c[1], 0) / n;
        if (cx < ax0 || cx > ax1 || cy < ay0 || cy > ay1) continue;
        let ar = 0; for (let k = 0; k < n; k++) { const p = f.corners[k], q = f.corners[(k + 1) % n]; ar += p[0] * q[1] - q[0] * p[1]; }
        ar = Math.abs(ar) / 2; all += ar; if (HARD.test(g)) hard += ar; }
      return all > 0 ? r5(hard / all) : 0; })() : 0;
    const apronKind = b.apron ?? ctx.apron ?? (hardShare >= APRON.hard ? 'ground' : 'slab');
    if (!['slab', 'ground'].includes(apronKind)) throw new Error(`stage: buildings[${i}].apron is 'slab' (poured concrete) or 'ground' (the land's own, levelled)`);
    if (was && was.apron && apronKind === 'slab') aprons.push({ rect: was.apron, boxes: F.boxes });
    // (what its roofs keep dry: its footprint up to its roof, for the weather that falls, scene/channels/weather.js)
    { const top = floor + Math.max(0, ...shell0.flatMap((f) => f.corners.map((c) => c[2]))); for (const B of F.boxes) roofs.push([B[0], B[1], B[2], B[3], top].map(r5)); }
    // A NET UNDER ITS GROUND (unseen): one level face a hand under its apron and a stride past its edge, so a walker who
    // finds a gap (at a threshold, at the slab's kerb, where the land's bank meets it) lands on it and never falls through
    if (was && was.apron) { const [nx0, ny0, nx1, ny1] = was.apron, m = 1, zn = floor - APRON.under - 0.04;
      netFaces.push({ corners: [[nx0 - m, ny0 - m, zn], [nx1 + m, ny0 - m, zn], [nx1 + m, ny1 + m, zn], [nx0 - m, ny1 + m, zn]].map(P3), normal: [0, 0, 1], outNormal: [0, 0, 1], group: 'building:net', fill: '#000000', alpha: 0, noInk: true }); }
    const apron0 = was && was.apron && apronKind === 'slab' ? (() => {
      const [ax0, ay0, ax1, ay1] = was.apron, zt = floor - APRON.under + APRON.over, T = yardSlab(), out = [];
      const lam = (nn) => (payload.sky?.sun?.dir ? Math.max(0, nn[0] * sun[0] + nn[1] * sun[1] + nn[2] * sun[2]) : 0), day = Math.max(0, Math.min(1, payload.sky?.day ?? 1));
      const face = (c, nn) => { const flat = Math.abs(nn[2]) > 0.5, g = Math.round(255 * Math.min(1, (0.68 + 0.32 * lam(nn)) * (0.35 + 0.65 * day)));
        return { ...quad(c, 'building:apron', `#${g.toString(16).padStart(2, '0').repeat(3)}`), texture: T.key, textureLit: true, uv: c.map((p) => (flat ? [p[0], p[1]] : [p[0] * -nn[1] + p[1] * nn[0], p[2]]).map((v) => r5(v / T.scale))), normal: P3(nn), outNormal: P3(nn) }; };
      // (laid in bays of its own joints' size, so the sun's light has corners to land on; each cut round the building)
      const step = 3, nx = Math.max(1, Math.round((ax1 - ax0) / step)), ny = Math.max(1, Math.round((ay1 - ay0) / step));
      for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy < ny; iy++) { const u0 = ax0 + ((ax1 - ax0) * ix) / nx, u1 = ax0 + ((ax1 - ax0) * (ix + 1)) / nx, v0 = ay0 + ((ay1 - ay0) * iy) / ny, v1 = ay0 + ((ay1 - ay0) * (iy + 1)) / ny;
        out.push(...cutOutBoxes(face([[u0, v0, zt], [u1, v0, zt], [u1, v1, zt], [u0, v1, zt]].map(P3), [0, 0, 1]), F.boxes)); }
      // ITS SKIRT: the kerb round its edge goes down to the land, wherever the land lies. Where the site was filled the
      // land falls away from the slab's edge, and a kerb of one depth would hang over it with a gap under; each stretch
      // of the edge is taken down to the lowest land beside it (at the edge, and a stride out), and a hand further
      const landAt = (x, y, nn) => Math.min(...[0, 0.6, 1.2].map((d) => ground(x + nn[0] * d, y + nn[1] * d) ?? Infinity));
      const foot = (x, y, nn) => { const g = landAt(x, y, nn); return Math.min(zt - APRON.edge, Number.isFinite(g) ? g - APRON.skirt : zt - APRON.edge); };
      for (const [p, q, nn] of [[[ax0, ay0], [ax1, ay0], [0, -1, 0]], [[ax1, ay0], [ax1, ay1], [1, 0, 0]], [[ax1, ay1], [ax0, ay1], [0, 1, 0]], [[ax0, ay1], [ax0, ay0], [-1, 0, 0]]]) {
        const L = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.max(1, Math.round(L / 2));
        for (let k = 0; k < n; k++) { const a = [p[0] + ((q[0] - p[0]) * k) / n, p[1] + ((q[1] - p[1]) * k) / n], b = [p[0] + ((q[0] - p[0]) * (k + 1)) / n, p[1] + ((q[1] - p[1]) * (k + 1)) / n];
          out.push(face([[a[0], a[1], foot(a[0], a[1], nn)], [b[0], b[1], foot(b[0], b[1], nn)], [b[0], b[1], zt], [a[0], a[1], zt]].map(P3), nn)); }
      }
      // (the land under it, in from its edge: cut away)
      const inner = [[ax0 + 0.3, ay0 + 0.3, ax1 - 0.3, ay1 - 0.3]];
      faces = faces.flatMap((f) => (GROUND.test(f.group || '') || ROUGH.test(f.group || '') ? cutOutBoxes(f, inner) : [f]));
      clearedBoxes.push(...inner);
      return out;
    })() : [];
    // (THE SUN'S SHADOW IS LIVE, never baked into a built thing's corners: a corner every few metres of a flat wall
    // holds a shadow's edge as blotches. Each corner carries the sun's share of its light, and the page's hour map
    // takes that share away where the sun is hidden: an eave's shadow on its wall, a wing's on the hall, a
    // container's on the next and on the slab, each with its own edge)
    const shell = X && shellLight ? sunLitFaces(shell0.map((f) => ({ ...f, fill: '#ffffff' })), shellLight, {}).faces : shell0;
    // (the apron takes no baked shadow: it is flat and wide, a corner every few metres, and the building's shadow on it
    // is the page's live one, as it is on the land beside it)
    // (wet, a slab is darker: the water in its pores drinks the light, and the film over it gives the sky back; the
    // form render darkens it where its water lies, so its bake stays dry)
    const wetK = manifest.wet ? APRON.wet : 1, wetHex = '#' + Math.round(255 * wetK).toString(16).padStart(2, '0').repeat(3);
    const apronF = shellLight && apron0.length ? sunLitFaces(apron0.map((f) => ({ ...f, fill: '#ffffff' })), shellLight, {}).faces
      : wetK < 1 ? apron0.map((f) => { const d = (h) => '#' + [1, 3, 5].map((q) => Math.round(parseInt(h.slice(q, q + 2), 16) * wetK).toString(16).padStart(2, '0')).join(''); return { ...f, fill: d(f.fill), cornerFills: f.cornerFills.map(d) }; }) : apron0;
    // the stoop: a ramp down from the threshold to the land in front of the door, as wide as the way out, so a walker
    // (and a hero, who steps only so high) comes in off the land
    const wy = ways[0], drop = floor - (ground(...toWorld([doorPlan[0], doorPlan[1] - 0.6])) ?? floor), run = Math.max(0.6, drop * 2.5);
    const stoop = drop > 0.05 ? (() => {
      const a = wy.lo - 0.2, c = wy.hi + 0.2, y0 = entry.y - t, y1 = y0 - run, zt = 0, zb = -drop - 0.15;
      const top = [[a, y1, zb], [c, y1, zb], [c, y0, zt], [a, y0, zt]].map(W), sides = [[[a, y0, zt], [a, y1, zb], [a, y0, zb]], [[c, y1, zb], [c, y0, zt], [c, y0, zb]]].map((tri) => tri.map(W));
      return [top, ...sides].map((cs) => { const nn = unit(cross(sub3(cs[1], cs[0]), sub3(cs[cs.length - 1], cs[0]))), lit = 0.35 + 0.65 * Math.max(0, nn[0] * sun[0] + nn[1] * sun[1] + nn[2] * sun[2]); const F0 = { ...quad(cs, 'building:stoop', paint('str:stone', Math.min(1, 0.5 * lit))), normal: P3(nn), outNormal: P3(nn) }; return manifest.town?.dress ? dressTownFace(F0, 'plinth', manifest.town.dress) : F0; });
    })() : [];
    // (set into its slope: its stair beside it and the paths of slabs to its doors, from the trail, the yard and the
    // stair's head; painted and lit as its shell is)
    // (the level ground behind is walked along behind the building's furthest back wall, `yb`: a room standing proud of
    // the upper door's wall, a stair's core, is walked round)
    const St = E ? was?.stair ?? null : null, yu = E ? E.at[1] + t : 0, sx = St ? (St.x[0] + St.x[1]) / 2 : 0, yb = E ? Math.max(yu, ...rects.map((R0) => R0[3])) + 1.5 : 0;
    const litFill = (nn) => { const lam = payload.sky?.sun?.dir ? Math.max(0, nn[0] * sun[0] + nn[1] * sun[1] + nn[2] * sun[2]) : 0, day = Math.max(0, Math.min(1, payload.sky?.day ?? 1)), g = Math.round(255 * Math.min(1, (0.68 + 0.32 * lam) * (0.35 + 0.65 * day))); return `#${g.toString(16).padStart(2, '0').repeat(3)}`; };
    const SC = E ? stairConcrete() : null, texd = (c, group) => {
      const nn = unit(cross(sub3(c[1], c[0]), sub3(c[c.length - 1], c[0]))), flat = Math.abs(nn[2]) > 0.5;
      return { ...quad(c, group, litFill(nn)), texture: SC.key, textureLit: true, uv: c.map((p) => (flat ? [p[0], p[1]] : [p[0] * -nn[1] + p[1] * nn[0], p[2]]).map((v) => r5(v / SC.scale))), normal: P3(nn), outNormal: P3(nn) };
    };
    const SF = St ? stairFaces(St) : null, stairF = SF ? SF.faces.map((f) => texd(f.corners.map(W), `building:${f.group}`)) : [];
    const doorOut = W([doorPlan[0], doorPlan[1] - 1.5, 0]), nearTrail = E ? [...path].map((k) => k.split(',').map((v) => +v + 0.5)).sort((p, q) => Math.hypot(p[0] - doorOut[0], p[1] - doorOut[1]) - Math.hypot(q[0] - doorOut[0], q[1] - doorOut[1]))[0] : null;
    const legs = !E ? [] : [
      ...(nearTrail ? [[nearTrail, doorOut]] : []),
      ...(St ? [[[doorPlan[0], doorPlan[1] - 1.5], [sx, doorPlan[1] - 1.5]], [[sx, doorPlan[1] - 1.5], [sx, St.foot - 0.4]], [[sx, St.head + 0.4], [sx, yb]], [[sx, yb], [E.at[0], yb]], [[E.at[0], yb], [E.at[0], yu + 0.3]]].map(([p, q2]) => [toWorld(p), toWorld(q2)]) : []),
    ];
    const pathF = legs.flatMap(([p, q2]) => slabPath(p, q2, (x, y) => ground(x, y) ?? floor)).map((f) => { const nn = unit(cross(sub3(f.corners[1], f.corners[0]), sub3(f.corners[3], f.corners[0]))); return { ...quad(nn[2] < 0 ? f.corners.slice().reverse() : f.corners, 'building:path', paint('str:stone', 0.62)), normal: P3(nn[2] < 0 ? nn.map((v) => -v) : nn), outNormal: P3(nn[2] < 0 ? nn.map((v) => -v) : nn) }; });
    if (pathF.length) pathFaces.push(...pathF);
    if (SF) colliders.push(...SF.colliders.map((c) => { const a = W(c.min), z = W(c.max); return { min: P3([Math.min(a[0], z[0]), Math.min(a[1], z[1]), a[2]]), max: P3([Math.max(a[0], z[0]), Math.max(a[1], z[1]), z[2]]), of: `${id}:stair` }; }));
    // (a town's building's windows framed as its houses' are: a lintel over each and a sill under it, in its language's
    // ornament, painted and lit as its shell)
    const trims = vern ? (holes ?? []).flatMap((h) => {
      const orn = L.values?.ornaments ?? {}, lin = orn.lintel ?? orn.lintels ?? orn.cornice ?? { group: 'str:stone', value: 0.6 }, sl = orn.sill ?? orn.sills ?? lin;
      const along = h.n[0] === 0, o = (u, v, z) => (along ? [u, h.plane + h.n[1] * v, z] : [h.plane + h.n[0] * v, u, z]);
      const piece = (u0, u1, z0, z1, d, P0) => {
        const c = (u, v, z) => W(o(u, v, z)), fs = [[[u0, d, z0], [u1, d, z0], [u1, d, z1], [u0, d, z1]], [[u0, 0, z1], [u1, 0, z1], [u1, d, z1], [u0, d, z1]], [[u0, 0, z0], [u0, d, z0], [u0, d, z1], [u0, 0, z1]], [[u1, d, z0], [u1, 0, z0], [u1, 0, z1], [u1, d, z1]], [[u0, 0, z0], [u1, 0, z0], [u1, d, z0], [u0, d, z0]]];
        return fs.map((q) => { const cs = q.map((p) => c(...p)), nn = unit(cross(sub3(cs[1], cs[0]), sub3(cs[cs.length - 1], cs[0]))), lam = Math.max(0, nn[0] * sun[0] + nn[1] * sun[1] + nn[2] * sun[2]);
          return { ...quad(cs, 'building:trim', paint(P0.group ?? 'str:stone', Math.min(1, (P0.value ?? 0.6) * (0.55 + 0.45 * lam)))), normal: P3(nn), outNormal: P3(nn) }; });
      };
      return [...piece(h.u0 - 0.14, h.u1 + 0.14, h.z1, h.z1 + 0.2, 0.09, lin), ...piece(h.u0 - 0.08, h.u1 + 0.08, h.z0 - 0.08, h.z0, 0.11, sl)];
    }) : [];
    // ITS YARD (`yard: { containers }`): shipping containers stacked on its apron before its front, in a row along it,
    // each stack one to three high by the building's dice, each container in a line's colour; the way to its door kept
    // clear. Lit as the shell is; each stack a collider
    const yardF = [];
    if (b.yard !== undefined) {
      if (!b.yard || typeof b.yard !== 'object' || Object.keys(b.yard).some((k) => !['containers', 'floods', 'floodsAt'].includes(k)) || (b.yard.floodsAt !== undefined && !['edge', 'middle'].includes(b.yard.floodsAt)) || (b.yard.containers !== undefined && !(Number.isInteger(b.yard.containers) && b.yard.containers >= 1 && b.yard.containers <= 40))
        || (b.yard.floods !== undefined && !(Number.isInteger(b.yard.floods) && b.yard.floods >= 1 && b.yard.floods <= 8))) throw new Error(`stage: buildings[${i}].yard is { containers?: 1 to 40, floods?: 1 to 8 (floodlights on masts), floodsAt?: 'edge' (along its yard's outer edge) | 'middle' (down the middle of its yard) }`);
      if (!(was && was.apron)) throw new Error(`stage: buildings[${i}] (${id}) has no apron to stack a yard on (a composed building's, not one set into a slope)`);
      const SKIN = containerSkin(), raw = containerRaw(), CL = 12.19, CW = 2.44, CH = 2.59, x0 = Math.min(...rects.map((R0) => R0[0])), x1 = Math.max(...rects.map((R0) => R0[2])), y0 = Math.min(...rects.map((R0) => R0[1]));
      const zt = -APRON.under + APRON.over, dice = (k) => hash3(i, k, 4431), slots = [];
      // (slots along the front, a row nearer the building and one further out, none across the way to the door)
      for (const yr of [y0 - APRON.front + CW / 2 + 0.6, y0 - APRON.front + CW * 1.5 + 1.4]) for (let x = x0 - APRON.side + CL / 2 + 0.5; x + CL / 2 <= x1 + APRON.side - 0.5; x += CL + 0.8) if (Math.abs(x - doorPlan[0]) > CL / 2 + 2) slots.push([x, yr]);
      let left = b.yard.containers ?? 0, k = 0;
      const day = Math.max(0, Math.min(1, payload.sky?.day ?? 1));
      for (const [sx, sy] of slots) { if (left <= 0) break;
        const high = Math.min(left, 1 + Math.floor(dice(k++) * 3)); left -= high;
        for (let lv = 0; lv < high; lv++) { const tint = YARD_LINES[Math.floor(dice(k++) * YARD_LINES.length) % YARD_LINES.length], jog = (dice(k++) - 0.5) * 0.16;
          // (its body the container's skin: corrugated sheet, the flutes upright on its sides and across its top, the
          // line's colour its tint; the painted ribs give way to the sheet's own relief. Its doors' bars stay)
          for (const f of raw) { if (f.hex === '#d6d6d6') continue;
            const c = f.corners.map(([u, v, z]) => W([sx + u + jog, sy + v, zt + lv * CH + z])), nn = turnN(f.normal), body = f.hex === '#f2f2f2';
            const frame = f.hex === '#dedede', col = body ? tint : frame ? tint.map((t) => t * 0.8) : [0.5, 0.5, 0.5], lam = payload.sky?.sun?.dir ? Math.max(0, nn[0] * sun[0] + nn[1] * sun[1] + nn[2] * sun[2]) : 0;
            const shade = shellLight ? 1 : (0.6 + 0.4 * lam) * (0.35 + 0.65 * day), fill = '#' + col.map((t) => Math.round(255 * Math.min(1, t * shade)).toString(16).padStart(2, '0')).join('');
            const flat = Math.abs(nn[2]) > 0.5, uv = body ? c.map((p) => (flat ? [p[0], p[1]] : [p[0] * -nn[1] + p[1] * nn[0], p[2]]).map((v) => r5(v / SKIN.scale))) : null;
            yardF.push({ ...quad(c, 'yard:container', fill), ...(uv ? { texture: SKIN.key, textureLit: true, uv } : {}), normal: P3(nn), outNormal: P3(nn), node: `${id}:container-${k}` }); } }
        const a = toWorld([sx - CL / 2, sy - CW / 2]), c2 = toWorld([sx + CL / 2, sy + CW / 2]);
        colliders.push({ min: P3([Math.min(a[0], c2[0]), Math.min(a[1], c2[1]), floor + zt]), max: P3([Math.max(a[0], c2[0]), Math.max(a[1], c2[1]), floor + zt + high * CH]), of: `${id}:yard` }); }
    }
    // ITS FLOODLIGHTS (`yard.floods`): masts along the yard's outer edge, a lamp head on each turned in over the yard.
    // Each is a light no bake holds: the page lays it live (scene/channels/form.js), on the slab, the walls and what
    // stands in the yard, with its highlight; its lamp's face glows
    if (b.yard && b.yard.floods) {
      const x0f = Math.min(...rects.map((R0) => R0[0])), x1f = Math.max(...rects.map((R0) => R0[2])), y0f = Math.min(...rects.map((R0) => R0[1])), n = b.yard.floods, H = FLOOD.h, zt = -APRON.under + APRON.over;
      for (let q = 0; q < n; q++) {
        const px = n === 1 ? (x0f + x1f) / 2 : x0f - APRON.side + 0.7 + ((x1f - x0f + 2 * APRON.side - 1.4) * q) / (n - 1), py = b.yard.floodsAt === 'middle' ? y0f - APRON.front / 2 : y0f - APRON.front + 0.5, mid = b.yard.floodsAt === 'middle';
        // (the mast: six sides, tapering; never a box)
        for (let sd = 0; sd < 6; sd++) { const a0 = (sd / 6) * 2 * Math.PI, a1 = ((sd + 1) / 6) * 2 * Math.PI, am = (a0 + a1) / 2, at = (a, r, z) => W([px + Math.cos(a) * r, py + Math.sin(a) * r, zt + z]);
          const nn = turnN([Math.cos(am), Math.sin(am), 0]);
          yardF.push({ ...quad([at(a0, 0.11, 0), at(a1, 0.11, 0), at(a1, 0.06, H), at(a0, 0.06, H)], 'yard:mast', '#5a5e62'), normal: P3(nn), outNormal: P3(nn), node: `${id}:flood-${q + 1}` }); }
        // (its head: a lamp face a hand under the mast's top, turned down and in toward the building)
        const hx = px, hy = py + (mid ? 0 : 0.5), hz = zt + H - 0.1, down = turnN([0, 0, -1]);
        const lampC = [[hx - 0.3, hy - 0.2, hz], [hx + 0.3, hy - 0.2, hz], [hx + 0.3, hy + 0.2, hz], [hx - 0.3, hy + 0.2, hz]].map(W);
        lampFaces.push({ corners: lampC.map(P3), group: 'yard:flood', normal: P3(down), outNormal: P3(down), ...(isDay(ctx.dayLight) ? { fill: '#8a8f94' } : { fill: '#fff6dc', emissive: [1, 0.95, 0.82], emissiveStrength: 4, glow: '0 0 14px 6px #ffe9b8' }), doubleSided: true, node: `${id}:flood-${q + 1}` });
        const L = W([hx, hy + (mid ? 0.35 : 0.6), hz - 0.2]);
        // (a flood is lit when the sun is down or low: by day its mast stands dark, and what stands under it wears the
        // sun's shadow, not a lamp's)
        if (!isDay(ctx.dayLight)) floods.push({ at: P3(L), key: FLOOD.key, radius: FLOOD.radius });
      }
    }
    const yardLit = shellLight && yardF.length ? sunLitFaces(yardF, shellLight, {}).faces : yardF;
    // (THE SUN INDOORS IS THE LAND'S, LIVE: every lit face of a room turned to the sun carries the sun's light at its
    // cosine and its share of the corner's light (`sunShare`), no shadow baked; the page's hour map takes that share
    // away wherever the sun is hidden, which indoors is everywhere but through an opening, so a window lays its patch
    // on the floor and the far wall, a mullion its bar across it, and what stands in the patch its shadow. A face turned
    // from the sun says the sun has no share of it (0), so the map darkens nothing there: a tree behind a wall lays no
    // shadow on the wall's inner face. The painted patches a room laid at its windows give way to the real ones)
    const byDay = isDay(shellLight), sunUp = shellLight && shellLight.dir[2] > 0.02, lumOf = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    const indoors = !shellLight ? moved : moved.filter((f) => !(sunUp && f.group === 'stage:sunpatch')).map((f0) => {
      if (!f0.cornerLight || f0.sunShare !== undefined) return f0;
      // (by day the eye is set for the sun: the lamps' light stands lower beside it, so a patch of sun reads as one)
      const dim = (c) => c.map((v) => r5(v * INDOOR_DAY)), f = sunUp && byDay ? { ...f0, cornerLight: typeof f0.cornerLight[0] === 'number' ? dim(f0.cornerLight) : f0.cornerLight.map(dim) } : f0;
      const n = f.normal, cos = sunUp && Array.isArray(n) ? Math.max(0, n[0] * shellLight.dir[0] + n[1] * shellLight.dir[1] + n[2] * shellLight.dir[2]) : 0;
      if (!(cos > 0)) return { ...f, sunShare: 0 };
      const sun = shellLight.sun.map((v) => v * cos * (byDay ? INDOOR_SUN : INDOOR_MOON)), one = typeof f.cornerLight[0] === 'number', sunY = lumOf(sun);
      // (the sun laid mostly in the hue of the light the corner already stands in: the page takes the sun's share away
      // by one number a corner, not one a channel, so a sun of another hue would leave its colour behind in the shade)
      const add = (c) => { const y = Math.max(1e-9, lumOf(c)); return c.map((v, k) => r5(v + sun[k] * (1 - INDOOR_HUE) + (sunY * v / y) * INDOOR_HUE)); };
      // (the share as the page takes it away: from the finished, encoded colour, so the shade it leaves is the room's
      // own light and not darker than the wall beside it)
      const share = (c) => Math.round((1 - Math.pow(Math.max(0, 1 - Math.min(1, lumOf(sun) / Math.max(1e-9, lumOf(c)))), 1 / 2.2)) * 1000) / 1000;
      // (one light for the face, or one a corner: as the room's bake laid it)
      const lit = one ? add(f.cornerLight) : f.cornerLight.map(add);
      return { ...f, cornerLight: lit, sunShare: one ? share(lit) : lit.map(share) };
    });
    faces = [...faces, ...indoors, ...shell, ...apronF, ...yardLit, ...lampFaces.splice(0), ...trims, ...stoop, ...stairF, ...pathF];
    // WET (`wet: true` on the recipe: it has just rained): on a painted page the apron's slab films the sky,
    // channels/wet-road.js; the form render wets the slab itself (its record's `reflect.wet`, below)
    if (manifest.wet && apronF.length && !shellLight) wetQuads.push(...apronF.filter((f) => f.corners.length === 4 && f.normal && f.normal[2] > 0.9).map((f) => f.corners));
    for (const c of P.cutouts || []) cutouts.add(c);
    lights.push(...(P.lights || []).map((l) => ({ ...l, name: `${id}-${l.name}`, position: P3(W(l.position)) })));
    // its colliders: the stage's own, moved (a quarter turn keeps a box a box)
    colliders.push(...(P.colliders || []).map((c) => {
      const a = W(c.min), z = W(c.max);
      return { min: P3([Math.min(a[0], z[0]), Math.min(a[1], z[1]), a[2]]), max: P3([Math.max(a[0], z[0]), Math.max(a[1], z[1]), z[2]]), of: `${id}:${c.of}` };
    }));
    const goal = inner.rooms.find((r) => r.id === inner._program.goal);
    // the way to its goal room from the land: in front of the stoop, through the door, on through its doorways
    const L2 = stageLevel(inner, { goal: goal?.id ?? 'deepest', from: entry.id });
    const lead = [[doorPlan[0], entry.y - (drop > 0.05 ? Math.max(0.6, drop * 2.5) : 0) - 1.5], [doorPlan[0], entry.y + 1.5]];
    const route = [...lead, ...L2.route].map((p) => P3(toWorld(p)));
    // (on storeys, each room at its floor: storeys.js)
    const PI = planStage(inner), zIn = (r) => PI.rooms.find((q) => q.id === r.id).z0 ?? 0;
    const roomBox = (r) => { const a = W([r.x + t, r.y + t, zIn(r)]), c = W([r.x + r.w - t, r.y + r.d - t, zIn(r) + r.h]); return { min: P3([Math.min(a[0], c[0]), Math.min(a[1], c[1]), a[2]]), max: P3([Math.max(a[0], c[0]), Math.max(a[1], c[1]), c[2]]) }; };
    // (set into its slope: its two doors, upper and lower, and the way through, in at the upper, down its stairs, out at
    // the lower, each point at its floor)
    const embed = E ? (() => {
      const [nx, ny] = rot([0, 1]), up = inner.rooms.find((r) => r.id === E.way.room), Lt = stageLevel(inner, { goal: entry.id, from: up.id });
      // (each point at the floor of the storey it is walked on: down a stair from its arrival to its approach, the points
      // on its flights between them eased)
      const PS = planStage(inner), near = (p, q) => q && Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.05, sOf = new Map(PS.rooms.map((r) => [r.id, r.storey ?? 0]));
      let cur = E.up;
      const zs = Lt.route.map((p) => {
        const st = (PS.stairs ?? []).find((x) => near(p, x.approach) || near(p, x.arrival) || (x.route ?? []).some((q) => near(p, q)));
        if (!st) return PS.storeys[cur].z0;
        if (near(p, st.approach)) { cur = sOf.get(st.lower); return st.z0; }
        if (near(p, st.arrival)) { cur = sOf.get(st.upper); return st.z1; }
        return null;
      });
      for (let k = 0; k < zs.length; k++) if (zs[k] === null) { let a = k - 1, c = k + 1; while (c < zs.length && zs[c] === null) c++; const za = a >= 0 ? zs[a] : E.rise, zc = c < zs.length ? zs[c] : 0; zs[k] = za + ((zc - za) * (k - a)) / (c - a); }
      const pt = (p, zz) => P3([...toWorld(p), floor + zz]);
      const through = [pt([E.at[0], E.at[1] + 1.5], E.rise), pt([E.at[0], E.at[1] - 1.5], E.rise), ...Lt.route.map((p, k) => pt(p, zs[k])), pt([doorPlan[0], entry.y + 1.5], 0), pt([doorPlan[0], entry.y - 1.5], 0)];
      // (the way round outside: out of the walkout, along the yard to the stair's foot, up it, along the level ground
      // behind to the upper door; each point on the land, or on the flight)
      const onLand = (p) => { const [x, y] = toWorld(p); return P3([x, y, ground(x, y) ?? floor]); };
      const round = St ? [onLand([doorPlan[0], doorPlan[1] - 1.5]), onLand([sx, doorPlan[1] - 1.5]), onLand([sx, St.foot - 0.4]),
        ...Array.from({ length: St.n + 1 }, (_, k) => pt([sx, St.foot + k * STAIR.going - 0.15], St.lo + k * St.h)), onLand([sx, St.head + 0.4]), onLand([sx, yb]), onLand([E.at[0], yb]), onLand([E.at[0], yu + 0.3])] : null;
      return { up: E.up, rise: E.rise, drop: r5(was?.drop ?? F0.drop), upper: { room: up.id, at: pt(E.at, E.rise), N: P3([nx, ny, 0]) }, lower: { room: entry.id, at: P3(W([doorPlan[0], doorPlan[1], 0])), N: P3(turnN([0, -1, 0])) }, through,
        ...(St ? { stair: { side: St.side, steps: St.n, riser: St.h, foot: pt([sx, St.foot], St.lo), head: pt([sx, St.head], St.hi) }, round } : {}), paths: legs.length };
    })() : null;
    const anchorRec = {
      id: `building-${id}`, kind: 'building', use: b.use, enter: 'walk', language: L.id, ...(X || vern ? { look: { construction: P0.compose.axes.construction, palette: P0.compose.axes.palette } } : {}), ...(embed ? { embed } : {}), turn: q,
      at: P3(W([doorPlan[0], doorPlan[1], 0])), N: P3(turnN([0, -1, 0])), floor: r5(floor),
      entry: entry.id, goal: goal?.id ?? null, rooms: inner.rooms.map((r) => ({ id: r.id, box: roomBox(r), ...(r.storey ? { storey: r.storey } : {}) })),
      route, goalAt: P3([...toWorld(L2.goal.at), floor + (L2.goal.at[2] ?? 0)]), ...(PI.storeys ? { storeys: PI.storeys.length } : {}), ...(b.goal ? { isGoal: true } : {}),
    };
    anchors.push(anchorRec);
    const siteSays = was?.site && Math.max(was.site.cut, was.site.fill) > APRON.steep ? [`the ${id} stands on a slope: its ground is cut ${was.site.cut} m into the land on its high side and filled ${was.site.fill} m on its low one, the bank round it ${was.site.bank} m wide (a flatter place, at: { x, y, facing }, or a smaller plan)`] : [];
    seated.push({ id, use: b.use, entry: entry.id, goal: goal?.id ?? null, language: L.id, ...(X || vern ? { look: anchorRec.look } : {}), floor: r5(floor), into: r5(Math.max(0, into)), rough: F.rough, ...(was?.site ? { site: { apron: was.apron, of: apronKind, hard: hardShare, ...was.site } } : {}),
      findings: [...inner._program.findings.map((f) => f.says), ...siteSays, ...(!E && !was?.site && into > 2.5 ? [`the ${id} is cut ${r5(into)} m into its slope: its back rooms stand below the land (another pocket, or at a flatter place)`] : []),
        ...(E && !St ? [`the ${id} is set into its slope with no stair beside it: neither side is long enough to hold the flight and its landings, so its bank is the way up`] : []),
        ...(E && Math.abs(embed.drop - E.rise) > 1 ? [`the ${id} is set into land that ${embed.drop >= 0 ? `falls ${embed.drop}` : `rises ${-embed.drop}`} m from its back to its front where its upper storey stands ${E.rise} m up: the land is cut and filled ${r5(Math.abs(embed.drop - E.rise))} m to take it`] : []),
        ...(bay && F.blocked ? [`the ${id} found no place clear of the trail's beats, the stage's edge and the other buildings: it stands over one (a smaller plan, fewer bays or wings, or at: { x, y, facing })`] : [])] });
  });
  // (planning: the street's ground is reserved too, so nothing grows on it when the land is laid again)
  if (ctx.planOnly && ST && planned.length) {
    const [y0, y1] = streetRange(planned);
    for (let y = y0; y < y1; y += 2) { const xs = [y, y + 1, y + 2].map((q) => ST.site.trailX(Math.min(q, y1))), h = ST.span.half + 0.5; reserved.push([r5(Math.min(...xs) - h), r5(y), r5(Math.max(...xs) + h), r5(Math.min(y + 2, y1))]); }
  }
  // (planning: the walls' ground too, era/stage-walls.js)
  if (ctx.planOnly && ST && planned.length && manifest.town.walls) {
    const [y0, y1] = streetRange(planned);
    reserved.push(...wallsOf(y0, y1).keep.map((B) => B.map(r5)));
  }
  if (ctx.planOnly) return { reserved, ...(grades.length ? { grade: grades, placed } : {}) };
  // the street, once its houses stand: from before the first to past the last along the trail, the land's growth and
  // the trail under it cleared, a path of slabs to each door
  let liveGrass = null;
  if (ST && !ctx.planOnly) {
    const doors = anchors.filter((a) => (a.kind === 'house' || a.kind === 'building') && String(a.id).includes('town-'));
    if (doors.length) {
      const [y0, y1] = streetRange(doors.map((d) => d.at[1]));
      const fillOf = (re) => faces.find((f) => re.test(f.group || '') && typeof f.fill === 'string')?.fill ?? '#8a7a62';
      const lit = (n) => 0.55 + 0.45 * Math.max(0, n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]);
      const { faces: SF, clear } = layStreet(ST.site, ST.L, ST.span, { y0, y1, ground, paint, lit, soil: fillOf(/:trail$/), grass: fillOf(/:ground$/), dress: manifest.town.dress, doors });
      const mid = (f) => { const n = f.corners.length; return [f.corners.reduce((a, c) => a + c[0], 0) / n, f.corners.reduce((a, c) => a + c[1], 0) / n]; };
      // (nothing grows on the street's own ground either, its door paths among it: what stands within a hand of it goes;
      // and the land wholly under its paving goes with the trail, so no blend of the trail's runs under the street: its
      // kerbs and walks are its edge)
      const paved = pavedBy(SF), near = (x, y) => paved(x, y) || [[0.15, 0], [-0.15, 0], [0, 0.15], [0, -0.15]].some(([dx, dy]) => paved(x + dx, y + dy));
      const under = (f) => f.corners.every((c) => paved(c[0], c[1])) && paved(...mid(f));
      faces = [...faces.filter((f) => { const g = f.group || ''; if (GROUND.test(g) && under(f)) return false; if (!(CLEARED.test(g) || PATH.test(g))) return true; const [cx, cy] = mid(f); return !clear(cx, cy) && !(CLEARED.test(g) && near(cx, cy)); }), ...SF];
      if (payload.liveGrass) liveGrass = offPaving(payload.liveGrass, paved);
      // THE WALLS (town.walls, era/stage-walls.js): the street closed by its fortification, a gatehouse at each end, its
      // curtain and towers behind the houses, painted in the town's paint and light, each a collider (its gates open)
      if (manifest.town.walls) {
        const Wl = wallsOf(y0, y1), Pw = paintRaw(kitId, manifest.town?.paint);
        for (const P of Wl.pieces) {
          for (const f of P.faces) { const nn = unit(cross(sub3(f.corners[1], f.corners[0]), sub3(f.corners[f.corners.length - 1], f.corners[0]))); faces.push({ ...quad(f.corners, 'town:wall', Pw(f.group ?? 'str:stone', Math.min(1, (f.value ?? 0.6) * lit(nn)))), normal: P3(nn), outNormal: P3(nn) }); }
          for (const B of P.boxes) colliders.push({ min: P3([B[0], B[1], P.z0]), max: P3([B[2], B[3], P.z1]), of: `town:walls${P.gatehouse ? ':gate' : P.tower ? ':tower' : ''}` });
        }
        anchors.push({ id: 'town-walls', kind: 'walls', fort: Wl.fort.read ?? null, gates: Wl.pieces.filter((P) => P.gatehouse).length, height: Wl.H });
      }
    }
  }
  // (no grass through the paths of slabs to a building set into its slope)
  if (pathFaces.length && (liveGrass ?? payload.liveGrass)) liveGrass = offPaving(liveGrass ?? payload.liveGrass, pavedBy(pathFaces, /^building:path$/));
  // (one record for every building's rooms: the lamps of each, the one sun, the first's ambient)
  // (THE LIGHT OF WHERE A BODY STANDS, `form.room.place`: each room's own light as a body in it takes it (what its lamps
  // lay at a person's chest in its middle, over its ambient: overhead, so the sky's part of a body's light, and a share
  // of it thrown back up off the floor), lower by day as the room's faces are; and the yard's floods. The page lights a
  // body under the cast rig by the room it stands in, or by the sky out of doors: scene/channels/controllable)
  const place = ctx.dayLight && formRooms.length ? (() => {
    const day = isDay(ctx.dayLight) ? INDOOR_DAY : 1, rooms = [];
    for (const R of formRooms) {
      const A = anchors.find((a) => a.id === R._of), lamps = R.lights.filter((l) => l.radius < 1e8 && !l.beat), fall = R.fall ?? 1;
      for (const r of (A && A.rooms) || []) {
        const c = [(r.box.min[0] + r.box.max[0]) / 2, (r.box.min[1] + r.box.max[1]) / 2, r.box.min[2] + 1.5], E = [0, 0, 0];
        for (const l of lamps) { const t = Math.max(0, 1 - Math.hypot(l.at[0] - c[0], l.at[1] - c[1], l.at[2] - c[2]) / l.radius), w = Math.pow(t * t, fall); for (let k = 0; k < 3; k++) E[k] += l.key[k] * w; }
        rooms.push({ min: r.box.min.map(r5), max: r.box.max.map(r5), sky: R.ambient.map((v, k) => r5((v + E[k]) * day)), ground: R.ambient.map((v, k) => r5((v + E[k] * 0.35) * day)) });
      }
    }
    return rooms.length ? { rooms, ...(floods.length ? { floods } : {}) } : null;
  })() : null;
  const formRoom = formRooms.length ? { ...(({ _of, ...R0 }) => R0)(formRooms[0]), lights: [...formRooms.flatMap((R) => R.lights.filter((l) => l.radius < 1e8)), ...(ctx.dayLight ? [{ at: P3(ctx.dayLight.dir.map((v) => v * 1e6)), key: ctx.dayLight.sun, radius: 1e9, live: true }] : formRooms[0].lights.filter((l) => l.radius >= 1e8))] } : null;
  // (a plant the form grows from its seat, form/flora-read.js: none inside a building, none whose crown would stand through its wall)
  const PLANT_CLEAR = { trees: 3, bushes: 1, shrubs: 1, skirt: 3 };
  const plants = payload.plants && clearedBoxes.length ? { ...payload.plants, ...Object.fromEntries(Object.entries(PLANT_CLEAR).filter(([k]) => Array.isArray(payload.plants[k])).map(([k, pad]) => [k,
    payload.plants[k].filter((p) => !clearedBoxes.some((B) => p.x > B[0] - pad && p.x < B[2] + pad && p.y > B[1] - pad && p.y < B[3] + pad))])) } : null;
  // WHAT ITS BUILT THINGS GIVE BACK (the form render's, scene/channels/form.js `reflect`): the sky its land stands under,
  // each part's roughness (painted steel sheens, concrete barely), and where it has just rained the water on its slab
  const wetness = (() => { try { return readWetness(manifest.wet); } catch (e) { throw new Error(`stage: ${e.message}`); } })();
  // THE PUDDLES ON ITS SLABS (a wet place whose degree stands pools): laid by a pattern, rupa/splatter.js: rain's blots
  // and splashes over every apron, none with its heart inside a building, each apron's edges seamed where water gathers
  // against the kerb; rastered once over the aprons' bounds for the page
  const puddleMask = wetness && wetness.pools > 0 && aprons.length ? (() => {
    const R = [Math.min(...aprons.map((a) => a.rect[0])), Math.min(...aprons.map((a) => a.rect[1])), Math.max(...aprons.map((a) => a.rect[2])), Math.max(...aprons.map((a) => a.rect[3]))].map(r5);
    const prims = join(...aprons.map((a, k) => puddles(a.rect, { cover: wetness.pools, seed: (manifest.seed ?? 1) * 31 + k, keepOut: a.boxes })));
    const size = 256, px = rasterSplatter(prims, R, size);
    return { rect: R, size, data: Buffer.from(px).toString('base64') };
  })() : null;
  const lin = (c) => c.map((v) => r5((v / 255) ** 2.2));
  // (THE YARD'S OWN CAPTURE: where the yard is wet, a cube of the place as it stands lit, taken from a point in the widest
  // strip of slab beside the buildings, so what the wet ground and the wet walls round it give back is the buildings,
  // the containers and the land that stand there, where they stand: corrected to that strip's box, its near side the
  // wall. A surface outside the box keeps the sky's gradient: the capture is of this side only)
  const yardProbe = (() => {
    if (!wetness) return null;
    const bound = (re) => { const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; let n = 0;
      for (const f of faces) if (re.test(f.group || '')) { n++; for (const c of f.corners) for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], c[k]); b[k + 3] = Math.max(b[k + 3], c[k]); } }
      return n ? b : null; };
    const A = bound(/^building:apron$/), Wl = bound(/^building:wall$/);
    if (!A || !Wl) return null;
    // the four strips of slab round the walls: [x0, y0, x1, y1], the widest taken
    const strips = [[A[0], A[1], Wl[0], A[4]], [Wl[3], A[1], A[3], A[4]], [A[0], A[1], A[3], Wl[1]], [A[0], Wl[4], A[3], A[4]]];
    const wide = (q) => Math.min(q[2] - q[0], q[3] - q[1]), best = strips.reduce((m, q) => (wide(q) > wide(m) ? q : m));
    if (!(wide(best) > 2)) return null;
    return { at: [(best[0] + best[2]) / 2, (best[1] + best[3]) / 2, A[5] + 1.7].map(r5), box: [[best[0], best[1], A[5] - 0.05].map(r5), [best[2], best[3], Wl[5]].map(r5)], open: true };
  })();
  const reflect = ctx.dayLight && formRooms.length && payload.sky?.zenith && payload.sky?.horizon ? {
    env: { zenith: lin(payload.sky.zenith.slice(0, 3)), horizon: lin(payload.sky.horizon.slice(0, 3)), ground: lin(payload.sky.horizon.slice(0, 3)).map((v) => r5(v * 0.35)) },
    surfaces: BUILT_SURFACES, ...(floods.length ? { floods } : {}), ...(yardProbe ? { probe: yardProbe } : {}),
    // (it has rained: every built thing out of doors is wet with no depth, era/laws.js 'wet-hugs-the-surface': the slab's
    // joints full, its faces dark, walls and containers run with it)
    ...(wetness ? { wet: { ...wetness, seed: r5(((manifest.seed ?? 1) * 7.31) % 50), groups: Object.keys(BUILT_SURFACES), damp: true, ...(puddleMask ? { mask: puddleMask } : {}) } } : {}) } : null;

  const wetRoad = wetQuads.length ? { quads: wetQuads, lamps: [], zenith: payload.sky?.zenith ?? [120, 150, 200], horizon: payload.sky?.horizon ?? [200, 215, 230] } : null;
  faces = [...faces, ...netFaces];
  return { ...payload, ...(roofs.length ? { roofs } : {}), ...(wetRoad ? { wetRoad } : {}), ...(formRoom ? { form: { ...(payload.form || {}), room: { ...formRoom, ...(ctx.dayLight ? { sun: { ground: skyAt([0, 0, -1], ctx.dayLight).map(r5) }, ...(reflect ? { reflect } : {}), ...(place ? { place } : {}) } : {}) } } } : {}), ...(plants ? { plants } : {}), faces, ...(liveGrass ? { liveGrass } : {}), ...(cutouts.size ? { cutouts: [...cutouts].sort() } : {}), lights, colliders, anchors, buildings: seated };
}
