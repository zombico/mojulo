/**
 * craft-shelf — aircraft and spacecraft parts as ONE shelf: the ODM inventory (craft-odm.js),
 * a builder per part kind (craft-parts.js), the archetype rows that assemble whole craft
 * (craft-archetypes.js). The flying sibling of the veh-* shelf (vehicle-designer/): the same
 * `garage` block on every part, the same advisory BOM audit, the same palette roles.
 *
 *   resolveCraftPart(sku)        one inventory row → a workbench recipe (metres, its hardpoints)
 *   assembleCraft(archetype)     an archetype's layout → an assembler recipe and its readout
 *   planCraftBuild(archetype)    the advisory audit: BOM, realm, swapped kinds
 *   craftFootprint(archetype, { rotors?, fold?, look? })   its extent as its form figure stands it; without its rotors,
 *                                its body's (what a walker bumps into)
 *   findCraftPart(words)         the words people say → a part number
 *
 * Everything is a pure function of its arguments: no seed, no clock. An archetype row and an
 * inventory row are compatibility promises over whatever is minted from them.
 */

import { lowerObjectFaces } from '../worlds/workbench.js';
import { resolveAssemblerPlacements } from '../worlds/workbench-assembler.js';
import { planAssemblyBom } from '../vehicle-designer/assembly-bom.js';
import { CRAFT_COLOR_ROLES, CRAFT_PALETTES, DEG, clone, hashSeed, resolveCraftPalette, round3 } from './craft-common.js';
import { CRAFT_BUILDERS } from './craft-parts.js';
import { lookCard, lookSwap } from './drone-looks.js';
import { lookFamily, dressRow } from './heli-looks.js';
import { CRAFT_KINDS, CRAFT_ODM, CRAFT_REALMS } from './craft-odm.js';
import { CRAFT_ARCHETYPES, CRAFT_ROLES } from './craft-archetypes.js';
import { hullFloat, hullEnvelope, hullSection } from './boat-parts.js';
import { boatWake, wakeRecipe } from './boat-wake.js';

export { CRAFT_ARCHETYPES, CRAFT_COLOR_ROLES, CRAFT_KINDS, CRAFT_ODM, CRAFT_PALETTES, CRAFT_REALMS, CRAFT_ROLES };

// the water a boat floats in, its density in kg/m³
const WATER = Object.freeze({ fresh: 1000, salt: 1025 });
const REALM_PALETTE = { earth: 'airlinerWhite', space: 'scoutIvory', water: 'skiffGreen', launch: 'launchWhite' };

// What each colour role is made of, by realm: painted skins satin on an aircraft and matte on a
// starship's plating, bare metal brushed aluminium or blasted steel, and every hot section (a nozzle,
// a plug, a drive bell, an exhaust stack) titanium blued by its own heat.
// (The paints keep the studio's own brightness: a stock satin is a dimmer, greyer white than a livery.)
const GLOSS = { preset: 'satin', ambient: 0.48, diffuse: 0.6, specular: 0.3, shininess: 20 };
const SHEEN = { preset: 'satin', ambient: 0.46, diffuse: 0.6, specular: 0.18, shininess: 12 };
const PLATE = { preset: 'matte', ambient: 0.48, diffuse: 0.58, specular: 0.06, shininess: 4 };
const FINISH = {
  earth: { paint: GLOSS, trim: SHEEN, glass: 'glass', rubber: 'rubber', chrome: { metal: 'aluminium', finish: 'brushed' }, light: 'neon' },
  space: { paint: PLATE, trim: SHEEN, glass: 'glass', rubber: 'rubber', chrome: { metal: 'steel', finish: 'blasted' }, light: 'neon' },
  // (a boat's: a marine enamel's sheen over its hull, its bare metal marine aluminium, brushed)
  water: { paint: GLOSS, trim: SHEEN, glass: 'glass', rubber: 'rubber', chrome: { metal: 'aluminium', finish: 'brushed' }, light: 'neon' },
  // (a launcher's: its paint a satin over its tanks, its tiles and its interstage matte, its bells' metal blasted)
  launch: { paint: GLOSS, trim: PLATE, glass: 'glass', rubber: 'rubber', chrome: { metal: 'steel', finish: 'blasted' }, light: 'neon' },
};
const HOT = { metal: 'titanium', film: { temper: 330 } };
const HOT_ID = /^(plug|nozzle|bell|exhaust|stack_)/;
const ROLE_ORDER = ['paint', 'trim', 'chrome', 'rubber', 'glass', 'light'];

/** Give every monomer without its own material the finish of its colour role (a seam's shade is paint). */
function applyFinish(monomers, C, realm) {
  const table = FINISH[realm];
  const roleOf = (tint) => ROLE_ORDER.find((r) => C[r] === tint) || 'paint';
  return Object.fromEntries(Object.entries(monomers).map(([key, list]) => [key, list.map((m) => {
    if (m.material) return m;
    return { ...m, material: clone(HOT_ID.test(m.id || '') ? HOT : table[roleOf(m.tint)]) };
  })]));
}
const MONOMERS = ['lathes', 'extrudes', 'sweeps', 'lofts'];

function partRow(sku) {
  const row = CRAFT_ODM[sku];
  if (!row) throw new Error(`Unknown craft part '${sku}'; the inventory lists ${Object.keys(CRAFT_ODM).length} parts (listCraftShelf), or findCraftPart('<words>')`);
  return row;
}

const shiftPoint = (p, dz) => (Array.isArray(p) ? [p[0], p[1], round3(p[2] + dz)] : { ...p, z: round3(p.z + dz) });

/** Move every monomer and hardpoint of a part up by dz (seat it on the grid). */
function shiftRecipe(recipe, dz) {
  const out = { ...recipe };
  for (const key of MONOMERS) {
    if (!Array.isArray(recipe[key])) continue;
    out[key] = recipe[key].map((m) => ({
      ...m,
      ...(m.axisFrom ? { axisFrom: shiftPoint(m.axisFrom, dz), axisTo: shiftPoint(m.axisTo, dz) } : {}),
      ...(m.path ? { path: m.path.map((q) => shiftPoint(q, dz)) } : {}),
    }));
  }
  const hp = {};
  for (const [name, v] of Object.entries(recipe.garage.hardpoints)) hp[name] = shiftPoint(v, dz);
  out.garage = { ...recipe.garage, hardpoints: hp, ...(recipe.garage.joints ? { joints: recipe.garage.joints.map((j) => ({ ...j, at: shiftPoint(j.at, dz) })) } : {}) };
  return out;
}

function lowestZ(recipe) {
  let min = Infinity;
  for (const f of lowerObjectFaces(recipe)) for (const c of f.corners) if (c[2] < min) min = c[2];
  return min;
}

/**
 * One inventory row → a workbench recipe in metres. `seat: 'grid'` (the default) rests the part
 * on the measured grid for a lone preview; `seat: 'mount'` keeps its mount at the origin, the
 * frame `assembleCraft` places it in. Hardpoints ride in `garage.hardpoints`, in the same frame.
 * `fold` (0 spread … 1 folded) sets a folding wing's hinge; parts that do not fold ignore it.
 * `pose` moves what articulates — { pitch, roll, yaw (−1 … 1), flaps, gear, canopy (0 … 1), prop
 * (degrees) } — and `side` ('r' | 'l') says which copy of a pair this is (a left aileron throws the
 * other way; a left wingtip shows red). `finish: false` drops the material finishes to bare tints.
 * `lights: 'covert'` darkens a drone arm's LEDs (a military look's).
 */
export function resolveCraftPart(sku, { palette, colors = {}, seat = 'grid', fold = 0, pose = {}, side = null, finish = true, title, made = false, lights } = {}) {
  const row = partRow(sku);
  const { id: paletteId, colors: C } = resolveCraftPalette(palette, colors, REALM_PALETTE[row.realm]);
  const geom = CRAFT_BUILDERS[row.kind](row, C, { fold, pose, side, sku, ...(made ? { made } : {}), ...(lights ? { lights } : {}) });
  const monomers = Object.fromEntries(MONOMERS.filter((k) => geom[k] && geom[k].length).map((k) => [k, geom[k]]));
  const recipe = {
    kind: 'workbench',
    title: title || `${row.label} (${sku})`,
    units: 'm',
    ...(finish ? applyFinish(monomers, C, row.realm) : monomers),
    garage: {
      kind: row.kind,
      sku,
      realm: row.realm,
      family: row.build.family || null,
      label: row.label,
      classOf: row.classOf,
      palette: paletteId,
      colors: clone(C),
      dims: clone(row.dims),
      mass: row.mass,
      ...(row.perf ? { perf: clone(row.perf) } : {}),
      mountFamily: row.mount,
      localFrame: { forward: '+y', up: '+z', right: '+x' },
      hardpoints: geom.hardpoints,
      // a folding wing says how it folds and how far it is folded in this recipe (degrees)
      ...(row.build.fold ? { fold: { ...clone(row.build.fold), angleNow: geom.fold } } : {}),
      // what moves: control surfaces, gear, canopy, propeller — where it turns, how far, where it is now
      ...(geom.joints && geom.joints.length ? { joints: geom.joints } : {}),
      ...(side ? { side } : {}),
      finish: finish ? row.realm : false,
      seat,
    },
  };
  if (seat === 'mount') return recipe;
  if (seat !== 'grid') throw new Error(`craft part seat must be 'grid' or 'mount'; received ${JSON.stringify(seat)}`);
  const dz = -lowestZ(recipe);
  return Math.abs(dz) < 1e-9 ? recipe : shiftRecipe(recipe, dz);
}

// ---- assembly ---------------------------------------------------------------------------------

const flipSet = (f) => new Set(typeof f === 'string' ? f.toLowerCase().split('').filter((c) => 'xyz'.includes(c)) : []);
const flipXor = (a, b) => new Set(['x', 'y', 'z'].filter((c) => a.has(c) !== b.has(c)));
const flipStr = (s) => ['x', 'y', 'z'].filter((c) => s.has(c)).join('');
const applyFlip = (s, v) => [s.has('x') ? -v[0] : v[0], s.has('y') ? -v[1] : v[1], s.has('z') ? -v[2] : v[2]];

// 3×3 rotations. A placed part's orientation is R·F: its flip F in its own frame, then a rotation R
// (the assembler's own order), so a mirror stays a flip and a roll stays a rotation all the way down.
const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const mul3 = (A, B) => A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));
const vec3 = (M, v) => M.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
const flipM = (s) => [[s.has('x') ? -1 : 1, 0, 0], [0, s.has('y') ? -1 : 1, 0], [0, 0, s.has('z') ? -1 : 1]];
const rotXM = (a) => [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]];
const rotYM = (a) => [[Math.cos(a), 0, Math.sin(a)], [0, 1, 0], [-Math.sin(a), 0, Math.cos(a)]];
const rotZM = (a) => [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]];
const rotX = (a, v) => vec3(rotXM(a), v);
const orient = (p, v) => vec3(p.R, applyFlip(p.flip, v));
/** R = Rz·Ry·Rx → [rx, ry, rz] in degrees, the assembler's `rotate`. */
function eulerXYZ(M) {
  const ry = Math.asin(Math.max(-1, Math.min(1, -M[2][0])));
  if (Math.abs(Math.cos(ry)) < 1e-9) return [Math.atan2(-M[1][2], M[1][1]) / DEG, ry / DEG, 0];
  return [Math.atan2(M[2][1], M[2][2]) / DEG, ry / DEG, Math.atan2(M[1][0], M[0][0]) / DEG];
}

function archetypeRow(id) {
  const row = CRAFT_ARCHETYPES[id];
  if (!row) throw new Error(`Unknown craft archetype '${id}'; expected one of: ${Object.keys(CRAFT_ARCHETYPES).join(', ')}`);
  return row;
}

/**
 * Walk a layout: every part placed by its mount at the hardpoint `at` names, mirrors made. A part whose
 * parent was swapped for one without that hardpoint is left off and named (advice, not a refusal).
 */
function placeLayout(row, { palette, colors, swap, fold, pose, finish, made, lights, armour }) {
  const placed = new Map();
  const order = [];
  const skipped = new Set();
  const warnings = [];
  for (const entry of row.layout) {
    const sku = swap[entry.id] || entry.sku;
    // (made: a hull is handed the canopy the layout sets on it, to fit its cockpit under, unless the layout seats a
    // cockpit of its own there (a helicopter's: one cockpit, never two), and the parts set on its own hardpoints, to lay
    // their wells and doors on its skin)
    const rowsOf = row.layout.map((e) => CRAFT_ODM[swap[e.id] || e.sku]);
    const madeOf = made ? {
      canopy: rowsOf.some((r) => r?.kind === 'craft-cockpit') ? null : rowsOf.find((r) => r?.kind === 'craft-canopy') ?? null,
      mounts: row.layout.filter((e) => e.at?.split('.')[0] === entry.id).map((e) => ({ point: e.at.split('.')[1], row: CRAFT_ODM[swap[e.id] || e.sku] ?? null, pair: Boolean(e.pair) })),
      // (a look's word on armour: a civilian card's hull goes without its plates)
      ...(armour === false ? { armour: false } : {}),
    } : false;
    const make = (side) => resolveCraftPart(sku, { palette, colors, seat: 'mount', fold, pose, side, finish, made: madeOf, ...(lights ? { lights } : {}) });
    const recipe = make(entry.pair ? 'r' : null);
    let target = [0, 0, 0];
    let parent = null;
    if (entry.at) {
      const [pid, hp] = entry.at.split('.');
      if (skipped.has(pid)) { skipped.add(entry.id); warnings.push(`${entry.id}: left off, its parent '${pid}' is off`); continue; }
      const parentPaired = placed.has(`${pid}-r`);
      if (parentPaired && !entry.pair) throw new Error(`Layout '${entry.id}' sits on paired '${pid}' and must pair with it`);
      parent = placed.get(parentPaired ? `${pid}-r` : pid);
      if (!parent) throw new Error(`Layout '${entry.id}' is at '${entry.at}', but '${pid}' is not an earlier part`);
      const v = parent.recipe.garage.hardpoints[hp];
      if (!v) {
        skipped.add(entry.id);
        warnings.push(`${entry.id}: left off, '${pid}' (${parent.recipe.garage.sku}) has no hardpoint '${hp}' (it has ${Object.keys(parent.recipe.garage.hardpoints).join(', ')})`);
        continue;
      }
      // an `offset` is a spacer at the mount, in the parent's own frame (a longer gear well, a raised stub)
      const off = entry.offset || [0, 0, 0];
      const w = orient(parent, [v[0] + off[0], v[1] + off[1], v[2] + off[2]]);
      target = [parent.at[0] + w[0], parent.at[1] + w[1], parent.at[2] + w[2]];
    }
    // the part's own flip, `roll` (degrees about the long axis, + turns +x down) and `yaw` (degrees about the vertical, +
    // turns +x toward the nose: a multirotor's radial arms), under its parent's
    const pF = parent ? parent.flip : new Set();
    const pR = parent ? parent.R : I3;
    const ownR = entry.roll && entry.yaw ? mul3(rotYM(entry.roll * DEG), rotZM(entry.yaw * DEG)) : entry.roll ? rotYM(entry.roll * DEG) : entry.yaw ? rotZM(entry.yaw * DEG) : I3;
    const R = mul3(pR, mul3(flipM(pF), mul3(ownR, flipM(pF))));
    const flip = flipXor(pF, flipSet(entry.flip));
    const mount = vec3(R, applyFlip(flip, recipe.garage.hardpoints.mount));
    const at = [target[0] - mount[0], target[1] - mount[1], target[2] - mount[2]];
    if (entry.pair) {
      const X = flipM(new Set(['x']));
      const r = { id: `${entry.id}-r`, slot: entry.id, recipe, at, R, flip };
      // the left copy is its own recipe: it throws its aileron the other way and shows a red light
      const l = { id: `${entry.id}-l`, slot: entry.id, recipe: make('l'), at: [-at[0], at[1], at[2]], R: mul3(X, mul3(R, X)), flip: flipXor(flip, new Set(['x'])) };
      placed.set(r.id, r).set(l.id, l);
      order.push(r, l);
    } else {
      const p = { id: entry.id, slot: entry.id, recipe, at, R, flip };
      placed.set(p.id, p);
      order.push(p);
    }
  }
  return { order, warnings };
}

function toManifest(row, order, { pitch, lift, title }) {
  return {
    kind: 'assembler',
    title: title || `${row.label} (${row.classOf})`,
    units: 'm',
    items: order.map((p) => {
      const at = rotX(pitch, p.at);
      const f = flipStr(p.flip);
      const rot = eulerXYZ(mul3(rotXM(pitch), p.R)).map((d) => round3(d) || 0);
      return {
        id: p.id,
        source: p.recipe,
        at: [round3(at[0]), round3(at[1]), round3(at[2] + lift)],
        ...(f ? { flip: f } : {}),
        ...(rot.some(Boolean) ? { rotate: rot } : {}),
      };
    }),
  };
}

/**
 * An archetype → an assembler recipe of frozen craft parts, standing on its gear.
 * `swap: { <layout id>: <sku> }` puts another inventory part in a slot (audited, never refused).
 * `look` (a drone's: drone-looks.js; a helicopter's: heli-looks.js) dresses it in that card's palette, swaps its payloads
 * and sets its lights; a helicopter's card hangs its kit at its hull's stations and strips its weapons when civilian.
 * `attitude: 'ground'` (default) rests the craft on all its gear, pitching a taildragger nose up;
 * `'level'` keeps the waterline level and rests it on its lowest contact. A craft with no gear
 * rests on its lowest point (a panel interceptor stands on its panels' lower corners; a boat on its keel, or its
 * outboard's skeg). `fold` (0 … 1) folds every folding wing; absent, the archetype's own stance (a shuttle lands with
 * its wings up). Returns `{ manifest, readout }`: the readout measures the craft as built. A boat's readout says where it
 * floats (`afloat`): the waterline its weight sets, its parts' mass and its payload displaced by its hull
 * (boat-parts.js hullFloat) in `water` 'fresh' (default) or 'salt'; `waterline` is that line's height in the manifest's
 * frame, where a level lays its water; a submarine's (a round hull) also its `ballast`, the water it floods to dive.
 * `underway: { speed }` (m/s, or `{ knots }`) sets a boat moving: its readout's `underway` says what it does to the water
 * (its Froude numbers, its regime, its wake's angle and wavelength: boat-wake.js) and a `wake` item lies on the water
 * (its crests, its bow wave, its stern's foam, its wash, its spray). Absent, nothing of it is drawn or read. With a
 * `course` (`true`, or `{ loop, water }`), the manifest carries a `seaway`: its World page runs the boat round the loop
 * on live water (worlds/seaway-scene.js, scene/channels/seaway.js).
 */
export function assembleCraft(archetype, { palette, colors = {}, swap: swapIn = {}, attitude = 'ground', fold, pose = {}, finish = true, title, made = false, look, water = 'fresh', underway } = {}) {
  const stock = archetypeRow(archetype);
  let swap = swapIn;
  const foldNow = Math.max(0, Math.min(1, Number.isFinite(fold) ? fold : (stock.fold || 0)));
  // (a craft asked for a look: that card's palette, its payloads' swaps under the operator's own, its lights; a
  // helicopter's card hangs its kit at the hull's stations and strips its weapons when it is civilian)
  const family = look ? lookFamily(stock, CRAFT_ODM) : null;
  const card = look ? lookCard(look, family) : null;
  const row = card && family === 'heli' ? dressRow(stock, card, CRAFT_ODM) : stock;
  if (card) swap = { ...lookSwap(row, card, CRAFT_ODM), ...swapIn };
  const { order, warnings: placing } = placeLayout(row, { palette: palette || card?.palette || row.palette, colors, swap, fold: foldNow, pose, finish, made, ...(card ? { lights: card.lights, armour: card.armour } : {}) });
  // gear fully up: the craft is in the air, so it does not stand on its wheels (it rests on its belly)
  const gearUp = Number(pose.gear) >= 1;
  const contacts = order
    .filter((p) => !gearUp && p.recipe.garage.hardpoints.contact)
    .map((p) => {
      const c = orient(p, p.recipe.garage.hardpoints.contact);
      return [p.at[0] + c[0], p.at[1] + c[1], p.at[2] + c[2]];
    });
  let pitch = 0;
  let lift;
  // (a launcher stands on its tail: its +y up, on its lowest point)
  if (row.stand === 'vertical') {
    pitch = Math.PI / 2;
    const probe = resolveAssemblerPlacements(toManifest(row, order, { pitch, lift: 0, title }));
    lift = -Math.min(...probe.map((p) => p.bounds.min[2]));
  } else if (contacts.length) {
    if (attitude === 'ground') {
      const yMax = Math.max(...contacts.map((c) => c[1]));
      const yMin = Math.min(...contacts.map((c) => c[1]));
      if (yMax - yMin > 0.5) {
        const mean = (cs) => cs.reduce((s, c) => s + c[2], 0) / cs.length;
        const front = mean(contacts.filter((c) => c[1] > yMax - 0.25));
        const rear = mean(contacts.filter((c) => c[1] < yMin + 0.25));
        pitch = Math.atan2(rear - front, yMax - yMin);
      }
    } else if (attitude !== 'level') throw new Error(`craft attitude must be 'ground' or 'level'; received ${JSON.stringify(attitude)}`);
    lift = -Math.min(...contacts.map((c) => rotX(pitch, c)[2]));
  } else {
    const probe = resolveAssemblerPlacements(toManifest(row, order, { pitch: 0, lift: 0, title }));
    lift = -Math.min(...probe.map((p) => p.bounds.min[2]));
  }
  const manifest = toManifest(row, order, { pitch, lift, title });
  // (a boat: the waterline its weight sets, every part placed and its payload aboard, on its hull's lines)
  const hull = order.find((p) => p.recipe.garage.kind === 'boat-hull');
  let afloat = null;
  if (hull) {
    if (!WATER[water]) throw new Error(`craft water must be ${Object.keys(WATER).join(' or ')}; received ${JSON.stringify(water)}`);
    const kg = order.reduce((s, p) => s + p.recipe.garage.mass, 0) + (row.payload || 0);
    const f = hullFloat(CRAFT_ODM[hull.recipe.garage.sku], kg, { rho: WATER[water] });
    // (a round hull dives: `ballast` the water it floods to weigh what its whole envelope displaces)
    const HR = CRAFT_ODM[hull.recipe.garage.sku], B = HR.build.family === 'round' ? HR.build.body : null;
    const ballast = B ? Math.round(hullEnvelope(HR) * WATER[water] - kg) : null;
    afloat = { water, displacement: Math.round(kg), draft: f.draft, waterline: round3(rotX(pitch, hull.at)[2] + lift + f.draft), freeboard: f.freeboard, volume: f.volume, ...(f.swamped ? { swamped: true } : {}), ...(B ? { ballast } : {}) };
  }
  // where each wheel or pad meets the ground, in the craft's world frame (a fly rule's taxi points)
  const gear = order
    .filter((p) => !gearUp && p.recipe.garage.hardpoints.contact)
    .map((p) => {
      const c = orient(p, p.recipe.garage.hardpoints.contact);
      const w = rotX(pitch, [p.at[0] + c[0], p.at[1] + c[1], p.at[2] + c[2]]);
      return { id: p.id, contact: [round3(w[0]), round3(w[1]), round3(w[2] + lift)] };
    });
  const readout = measureCraft(archetype, manifest, { pitch, swap, ...(row !== stock ? { row } : {}) });
  if (placing.length) readout.audit = { ...readout.audit, ok: false, warnings: [...readout.audit.warnings, ...placing] };
  // every joint on the craft, by item: what a runtime drives (a fly rule's ailerons, a hangar's fold)
  const joints = manifest.items.flatMap((it) => (it.source.garage.joints || []).map((j) => ({
    item: it.id, name: j.name, control: j.control, kind: j.kind, range: j.range, ...(j.kind === 'slide' ? { travel: j.travel } : { angle: j.angle }),
  })));
  // (a boat underway: what it does to the water at its speed, its wake an item on the water, never in its measures)
  let wake = null;
  if (underway && afloat && !afloat.swamped) {
    const speed = Number.isFinite(+underway.knots) ? +underway.knots * 0.514444 : +underway.speed;
    if (!(speed > 0)) throw new Error(`craft underway needs a speed (m/s) or knots above 0; received ${JSON.stringify(underway)}`);
    const HR = CRAFT_ODM[hull.recipe.garage.sku], DRIVE = { 'boat-outboard': ['outboard', 'prop'], 'boat-jet': ['jet', 'nozzle'], 'boat-shaft': ['shaft', 'prop'] };
    // (its drives: those on the hull itself, never a stowed sea boat's)
    const onHull = new Set(row.layout.filter((e) => e.at?.split('.')[0] === hull.slot).map((e) => e.id));
    const drives = order.filter((p) => onHull.has(p.slot) && DRIVE[p.recipe.garage.kind] && p.recipe.garage.hardpoints[DRIVE[p.recipe.garage.kind][1]]).map((p) => {
      const [kind, hp] = DRIVE[p.recipe.garage.kind], c = orient(p, p.recipe.garage.hardpoints[hp]);
      return { kind, at: [p.at[0] + c[0] - hull.at[0], p.at[1] + c[1] - hull.at[1], p.at[2] + c[2] - hull.at[2]] };
    });
    // (a round hull's own screw, on its stern's tip)
    if (HR.build.screw) drives.push({ kind: 'screw', at: [0, -HR.dims.length / 2 - 0.4, HR.build.body.axis] });
    const w = boatWake({ row: HR, draft: afloat.draft, volume: afloat.volume, speed, drives, section: hullSection });
    if (w) {
      const { halfAt, ...numbers } = w;
      void halfAt;
      wake = numbers;
      const hi = manifest.items.findIndex((it) => it.id === hull.id);
      const origin = [manifest.items[hi].at[0], manifest.items[hi].at[1], afloat.waterline];
      manifest.items.push({ id: 'wake', source: wakeRecipe(w, { seed: hashSeed(archetype) }), at: origin });
      // (a course: the World page runs it on live water, scene/channels/seaway.js: a loop of `loop` metres' radius,
      // by default wide enough for its wake to run half round it; a ship's on the sea, a small boat's on a lake)
      if (underway.course) {
        const c = underway.course === true ? {} : underway.course, L = w.waterline.length;
        const loop = Number.isFinite(+c.loop) && +c.loop > 0 ? +c.loop : Math.max(5 * L, w.reach / Math.PI + 2 * L);
        const water = c.water === 'ocean' || c.water === 'lake' ? c.water : L > 30 ? 'ocean' : 'lake';
        manifest.seaway = { origin, course: { loop: round3(loop) }, water, wake: numbers };
      }
    }
  }
  return { manifest, readout: { ...readout, fold: foldNow, pose: clone(pose), gear, joints, ...(look ? { look } : {}), ...(afloat ? { afloat } : {}), ...(wake ? { underway: wake } : {}) } };
}

// what turns over a craft's head, not its body: a walker passes under it
const DISCS = Object.freeze(['heli-rotor', 'drone-rotor', 'craft-propeller']);
const footMemo = new Map();

/**
 * A craft's extent as its form figure stands it (pose { gear: 0 }, on the ground; craftForm.js): `{ min, max }` in the
 * figure's own frame (centred on x and y over all of it, its lowest point z 0). `rotors: false` leaves out what turns
 * over its head (a main rotor's blades, a propeller's disc), so a box over the rest is its body's: what a walker
 * bumps into. `fold` and `look` as assembleCraft takes them. Pure; memoised by its words.
 */
export function craftFootprint(archetype, { rotors = true, fold, look } = {}) {
  const key = JSON.stringify([archetype, rotors, fold ?? null, look ?? null]);
  if (footMemo.has(key)) return footMemo.get(key);
  const { manifest } = assembleCraft(archetype, { pose: { gear: 0 }, attitude: 'ground', ...(fold !== undefined ? { fold } : {}), ...(look ? { look } : {}) });
  const P = resolveAssemblerPlacements(manifest);
  const box = (keep) => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; P.forEach((p, i) => { if (!keep(manifest.items[i])) return; for (let k = 0; k < 3; k += 1) { lo[k] = Math.min(lo[k], p.bounds.min[k]); hi[k] = Math.max(hi[k], p.bounds.max[k]); } }); return { lo, hi }; };
  const all = box(() => true), part = rotors ? all : box((it) => !DISCS.includes(it.source.garage.kind));
  const c = [(all.lo[0] + all.hi[0]) / 2, (all.lo[1] + all.hi[1]) / 2, all.lo[2]], r = (v, k) => Math.round((v - c[k]) * 1000) / 1000;
  const out = Object.freeze({ min: part.lo.map(r), max: part.hi.map(r) });
  footMemo.set(key, out);
  return out;
}

/** What the assembled craft measures, weighs and pushes, beside its reference figure. */
export function measureCraft(archetype, manifest, { pitch = 0, swap = {}, row = archetypeRow(archetype) } = {}) {
  const placements = resolveAssemblerPlacements(manifest);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const lowest = {};
  placements.forEach((p, i) => {
    const kind = manifest.items[i].source.garage.kind;
    for (let k = 0; k < 3; k += 1) {
      min[k] = Math.min(min[k], p.bounds.min[k]);
      max[k] = Math.max(max[k], p.bounds.max[k]);
    }
    lowest[kind] = Math.min(lowest[kind] ?? Infinity, p.bounds.min[2]);
  });
  let mass = 0;
  let thrust = 0;
  let power = 0;
  for (const item of manifest.items) {
    const g = item.source.garage;
    mass += g.mass;
    if (g.perf && g.perf.thrust && g.kind === 'craft-engine') thrust += g.perf.wet || g.perf.thrust;
    if (g.perf && g.perf.power) power += g.perf.power;
  }
  const r1 = (n) => Math.round(n * 100) / 100;
  return {
    archetype,
    realm: row.realm,
    role: row.role,
    class: row.class,
    classOf: row.classOf,
    pitch: r1(pitch / DEG),
    measures: { span: r1(max[0] - min[0]), length: r1(max[1] - min[1]), height: r1(max[2] - min[2]) },
    reference: clone(row.reference),
    // the lowest point of each kind above the ground: a nacelle that scrapes, a prop that strikes
    clearance: Object.fromEntries(Object.entries(lowest).map(([k, z]) => [k, r1(z)])),
    partsMass: Math.round(mass),
    ...(thrust ? { thrust: r1(thrust), thrustToWeight: r1((thrust * 1000) / (row.reference.mtow * 9.80665)) } : {}),
    ...(power ? { power: Math.round(power), powerLoading: r1(power / row.reference.mtow) } : {}),
    audit: planCraftBuild(archetype, { swap, placed: manifest.items.map((i) => i.source.garage), row }),
  };
}

/**
 * The advisory audit of a build (never a refusal): the BOM through the veh-* shelf's own
 * `planAssemblyBom`, plus what is particular to flight — a swapped part of another kind than
 * its slot, a part from the other realm. `placed` (the garages of the parts actually built) counts what
 * `assembleCraft` placed; absent, the layout is counted as written.
 */
export function planCraftBuild(archetype, { swap = {}, placed, row = archetypeRow(archetype) } = {}) {
  const parts = placed ? placed.map((g) => ({ garage: { kind: g.kind, family: g.sku } })) : [];
  const warnings = [];
  for (const entry of row.layout) {
    const sku = swap[entry.id] || entry.sku;
    const part = partRow(sku);
    const stock = partRow(entry.sku);
    const copies = entry.pair ? 2 : 1;
    if (!placed) for (let i = 0; i < copies; i += 1) parts.push({ garage: { kind: part.kind, family: sku } });
    if (part.kind !== stock.kind) warnings.push(`${entry.id}: ${sku} is a ${part.kind} in a ${stock.kind} slot`);
    if (part.realm !== row.realm) warnings.push(`${entry.id}: ${sku} is a ${part.realm} part on a ${row.realm} craft`);
  }
  for (const id of Object.keys(swap)) if (!row.layout.some((e) => e.id === id)) warnings.push(`swap '${id}': the ${archetype} layout has no such slot`);
  const bom = planAssemblyBom(parts, row.bom);
  return { ok: bom.ok && !bom.surplus.length && !warnings.length, bom, warnings };
}

// ---- words ------------------------------------------------------------------------------------

const norm = (w) => String(w).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Every word that names a part → its sku. One word, one part: a collision throws. */
export function craftNameIndex() {
  const index = new Map();
  for (const [sku, row] of Object.entries(CRAFT_ODM)) {
    for (const word of [sku, row.label, ...(row.aliases || [])]) {
      const key = norm(word);
      if (index.has(key) && index.get(key) !== sku) throw new Error(`craft word '${key}' names both ${index.get(key)} and ${sku}`);
      index.set(key, sku);
    }
  }
  return index;
}

/** The words people say ('turbofan', 'bubble canopy', 's-foil') → the part number, or null. */
export function findCraftPart(words) {
  return craftNameIndex().get(norm(words)) || null;
}

/** The inventory as a catalogue: one summary line per part, optionally one realm or kind. */
export function listCraftShelf({ realm, kind } = {}) {
  return Object.entries(CRAFT_ODM)
    .filter(([, r]) => (!realm || r.realm === realm) && (!kind || r.kind === kind))
    .map(([sku, r]) => ({ sku, kind: r.kind, realm: r.realm, label: r.label, classOf: r.classOf, dims: clone(r.dims), mass: r.mass, ...(r.perf ? { perf: clone(r.perf) } : {}) }));
}

/** A role and its craft in both realms: the earth machine and its starship analogue, side by side. A boat's role (its
 *  `realms`, the water's) holds its boats instead: `{ water }`. */
export function craftRoleAnalogues(role) {
  const r = CRAFT_ROLES[role];
  if (!r) throw new Error(`Unknown craft role '${role}'; expected one of: ${Object.keys(CRAFT_ROLES).join(', ')}`);
  const of = (realm) => Object.entries(CRAFT_ARCHETYPES).filter(([, a]) => a.role === role && a.realm === realm).map(([id]) => id);
  if (r.realms) return { role, label: r.label, mission: r.mission, realms: [...r.realms], ...Object.fromEntries(r.realms.map((k) => [k, of(k)])) };
  return { role, label: r.label, mission: r.mission, earth: of('earth'), space: of('space') };
}
