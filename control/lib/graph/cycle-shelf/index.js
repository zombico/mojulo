/**
 * cycle-shelf — the machines a rider sits astride and steers by a bar, as ONE shelf: the inventory (cycle-odm.js), a
 * builder per kind (cycle-parts.js), the archetypes that lay whole machines out (cycle-archetypes.js), the chassis solve
 * they are built on (cycle-chassis.js) and the laws they are held to (cycle-laws.js). The craft shelf's grammar for
 * the ground: the same `garage` block on every part, the same advisory BOM audit, the same colour roles.
 *
 *   resolveCyclePart(sku, opts)      one inventory row → a workbench recipe in the machine's frame (metres)
 *   assembleCycle(archetype, opts)   an archetype → an assembler recipe and its readout (measures, geometry, the rider's
 *                                    points, the joints, the laws)
 *   chassisOf(archetype)             its solve
 *   findCyclePart(words)             the words people say → a part number
 *
 * Every part is authored in its machine's frame (cycle-common.js): the ground z = 0, the rear contact at the origin.
 * A pose moves what articulates: `steer` (degrees, + to the right) turns the parts that steer about the steering axis;
 * `stand: 'down'` drops the side stand and leans the machine onto it, about the line its tyres meet the ground on.
 *
 * Pure: no clock, no dice. An archetype row and an inventory row are compatibility promises over what is minted.
 */
import { resolveAssemblerPlacements } from '../worlds/workbench-assembler.js';
import { planAssemblyBom } from '../vehicle-designer/assembly-bom.js';
import { VEHICLES as PHYSICS } from '../roads/vehicles.js';
import { CYCLE_COLOR_ROLES, CYCLE_PALETTES, DEG, clone, resolveCyclePalette, round3, sub, unit } from './cycle-common.js';
import { CYCLE_BUILDERS } from './cycle-parts.js';
import { CYCLE_KINDS, CYCLE_ODM } from './cycle-odm.js';
import { CYCLE_ARCHETYPES } from './cycle-archetypes.js';
import { solveChassis } from './cycle-chassis.js';
import { cycleLaws } from './cycle-laws.js';
import { CYCLE_LOOKS, lookCard, lookMaterial } from './cycle-looks.js';

export { CYCLE_ARCHETYPES, CYCLE_COLOR_ROLES, CYCLE_KINDS, CYCLE_LOOKS, CYCLE_ODM, CYCLE_PALETTES };

const MONOMERS = ['lathes', 'extrudes', 'sweeps', 'lofts'];

// what each colour role is made of: the plastics satin, the castings a softer sheen, bare metal brushed aluminium
const SATIN = { preset: 'satin', ambient: 0.48, diffuse: 0.6, specular: 0.3, shininess: 20 };
const SHEEN = { preset: 'satin', ambient: 0.46, diffuse: 0.6, specular: 0.18, shininess: 12 };
const FINISH = { paint: SATIN, trim: SHEEN, chrome: { metal: 'aluminium', finish: 'brushed' }, rubber: 'rubber', glass: 'glass', light: SHEEN };
const hexRGB = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
/** The role a tint was drawn from: its own colour, or the role whose colour it was toned from (the nearest). */
function roleOf(tint, C) {
  const exact = CYCLE_COLOR_ROLES.find((r) => C[r] === tint);
  if (exact) return exact;
  const t = hexRGB(tint);
  let best = 'paint', d = Infinity;
  for (const r of CYCLE_COLOR_ROLES) {
    const c = hexRGB(C[r]), e = (c[0] - t[0]) ** 2 + (c[1] - t[1]) ** 2 + (c[2] - t[2]) ** 2;
    if (e < d) { d = e; best = r; }
  }
  return best;
}
const applyFinish = (monomers, C) => Object.fromEntries(Object.entries(monomers).map(([k, list]) => [k, list.map((m) => (m.material ? m : { ...m, material: clone(FINISH[roleOf(m.tint, C)]) }))]));
/** A look's finish over the stock one (cycle-looks.js): its paint and trim, what its bright metal becomes. */
const applyLook = (monomers, C, card) => Object.fromEntries(Object.entries(monomers).map(([k, list]) => [k, list.map((m) => {
  const role = roleOf(m.tint, C), base = m.material ?? clone(FINISH[role]);
  return { ...m, material: clone(lookMaterial(card, role, base)) };
})]));
const roundPt = (v) => (Array.isArray(v) ? v.map((x) => round3(x) + 0) : v);

function partRow(sku) {
  const row = CYCLE_ODM[sku];
  if (!row) throw new Error(`Unknown cycle part '${sku}'; the inventory lists ${Object.keys(CYCLE_ODM).join(', ')} (or findCyclePart('<words>'))`);
  return row;
}
function archetypeRow(id) {
  const row = CYCLE_ARCHETYPES[id];
  if (!row) throw new Error(`Unknown cycle archetype '${id}'; expected one of: ${Object.keys(CYCLE_ARCHETYPES).join(', ')}`);
  return row;
}

const CHASSIS = new Map();
/** An archetype's chassis solve: its card on its physics class's wheelbase and its wheels' radii. */
export function chassisOf(id) {
  if (CHASSIS.has(id)) return CHASSIS.get(id);
  const row = archetypeRow(id), physics = PHYSICS[row.physics];
  if (!physics) throw new Error(`cycle archetype '${id}': physics class '${row.physics}' is not in roads/vehicles.js`);
  const wheelOf = (slot) => {
    const e = row.layout.find((x) => x.slot === slot && partRow(x.sku).kind === 'cycle-wheel');
    if (!e) throw new Error(`cycle archetype '${id}' has no ${slot} wheel`);
    return { radius: partRow(e.sku).dims.radius };
  };
  const G = solveChassis(row.chassis, physics, { front: wheelOf('front'), rear: wheelOf('rear') });
  CHASSIS.set(id, G);
  return G;
}

/** The archetype a lone part is previewed on: the first whose layout carries it, and the slot and side it has there. */
function homeOf(sku) {
  for (const [id, row] of Object.entries(CYCLE_ARCHETYPES)) {
    const e = row.layout.find((x) => x.sku === sku);
    if (e) return { archetype: id, entry: e };
  }
  return null;
}

/**
 * One inventory row → a workbench recipe in metres, in its machine's frame. `archetype` is the machine it is built
 * for (absent, the first that carries it); `slot` and `side` are the end and the side it is on (absent, its place
 * there); `pose` what articulates; `finish: false` keeps the bare tints.
 */
export function resolveCyclePart(sku, { archetype, slot, side, pose = {}, palette, colors = {}, finish = true, title, look } = {}) {
  const row = partRow(sku), home = homeOf(sku);
  const machine = archetype ?? home?.archetype;
  if (!machine) throw new Error(`cycle part '${sku}' is on no machine yet: name an archetype to build it for`);
  const G = chassisOf(machine), entry = home?.archetype === machine ? home.entry : null;
  const at = { slot: slot ?? entry?.slot ?? null, side: side ?? (entry?.pair ? 'r' : null) };
  // (a look other than stock brings its palette, under the operator's own, and its finish)
  const card = look && look !== 'stock' ? lookCard(look) : (lookCard(look), null);
  const { id: paletteId, colors: C } = resolveCyclePalette(palette ?? card?.palette, colors, CYCLE_ARCHETYPES[machine].palette);
  const geom = CYCLE_BUILDERS[row.kind](row, C, { G, slot: at.slot, side: at.side, pose });
  const monomers = Object.fromEntries(MONOMERS.filter((k) => geom[k] && geom[k].length).map((k) => [k, geom[k]]));
  return {
    kind: 'workbench',
    title: title || `${row.label} (${sku})`,
    units: 'm',
    ...(!finish ? monomers : card ? applyLook(monomers, C, card) : applyFinish(monomers, C)),
    garage: {
      kind: row.kind,
      sku,
      family: row.build.family || null,
      label: row.label,
      classOf: row.classOf,
      machine,
      palette: paletteId,
      colors: clone(C),
      dims: clone(row.dims),
      mass: row.mass,
      localFrame: { forward: '+y', up: '+z', right: '+x', origin: 'the rear tyre\'s contact' },
      hardpoints: Object.fromEntries(Object.entries(geom.hardpoints).map(([k, v]) => [k, roundPt(v)])),
      ...(geom.joints && geom.joints.length ? { joints: geom.joints.map((j) => ({ ...j, at: roundPt(j.at), dir: roundPt(j.dir) })) } : {}),
      ...(at.slot ? { slot: at.slot } : {}),
      ...(at.side ? { side: at.side } : {}),
      finish: Boolean(finish),
      ...(card ? { look } : {}),
    },
  };
}

// ── rotations (the assembler's order: R = Rz·Ry·Rx, `rotate: [rx, ry, rz]` in degrees) ──
const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const mul3 = (A, B) => A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));
const vec3 = (M, v) => M.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
const rotY = (a) => [[Math.cos(a), 0, Math.sin(a)], [0, 1, 0], [-Math.sin(a), 0, Math.cos(a)]];
/** A rotation by `a` about the unit axis k (Rodrigues). */
function about(k, a) {
  const [x, y, z] = unit(k), c = Math.cos(a), s = Math.sin(a), t = 1 - c;
  return [[t * x * x + c, t * x * y - s * z, t * x * z + s * y], [t * x * y + s * z, t * y * y + c, t * y * z - s * x], [t * x * z - s * y, t * y * z + s * x, t * z * z + c]];
}
function eulerXYZ(M) {
  const ry = Math.asin(Math.max(-1, Math.min(1, -M[2][0])));
  if (Math.abs(Math.cos(ry)) < 1e-9) return [Math.atan2(-M[1][2], M[1][1]) / DEG, ry / DEG, 0];
  return [Math.atan2(M[2][1], M[2][2]) / DEG, ry / DEG, Math.atan2(M[1][0], M[0][0]) / DEG];
}

/** The parts of a layout, built: [{ id, slot, steers, recipe }], a pair's two sides each its own. */
function buildLayout(id, { palette, colors, pose, finish, look }) {
  const row = archetypeRow(id), out = [];
  for (const e of row.layout) {
    for (const side of e.pair ? ['r', 'l'] : [null]) {
      out.push({ id: side ? `${e.id}-${side}` : e.id, entry: e, recipe: resolveCyclePart(e.sku, { archetype: id, slot: e.slot, side, pose, palette, colors, finish, look }) });
    }
  }
  return out;
}

const boundsOf = (manifest) => {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of resolveAssemblerPlacements(manifest)) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p.bounds.min[k]); max[k] = Math.max(max[k], p.bounds.max[k]); }
  return { min, max };
};
const r2 = (n) => Math.round(n * 100) / 100;

/** What an assembled machine measures, from its parts' bounds. */
export function measureCycle(manifest) {
  const { min, max } = boundsOf(manifest);
  return { length: r2(max[1] - min[1]), width: r2(max[0] - min[0]), height: r2(max[2] - min[2]) };
}

/**
 * An archetype → `{ manifest, readout }`: an assembler recipe of its parts in its frame, standing upright on its tyres,
 * or parked on its stand (`pose.stand: 'down'`), its front steered by `pose.steer` degrees. The readout measures it as
 * built, says its geometry and its laws (read upright, its stand up; the stand's lean from the stand down), the points
 * a rider meets, every joint, the BOM.
 */
export function assembleCycle(archetype, { palette, colors = {}, pose = {}, finish = true, title, look } = {}) {
  const row = archetypeRow(archetype), G = chassisOf(archetype), physics = PHYSICS[row.physics];
  if (pose.stand !== undefined && !['up', 'down'].includes(pose.stand)) throw new Error(`cycle pose.stand is 'up' or 'down'; received ${JSON.stringify(pose.stand)}`);
  const steer = Number.isFinite(pose.steer) ? Math.max(-40, Math.min(40, pose.steer)) : 0;
  const parts = buildLayout(archetype, { palette, colors, pose: { ...pose, steer }, finish, look });
  // (the stand's foot, down: where the machine leans to rest on it, about the line its tyres meet the ground on)
  const standDown = row.layout.some((e) => CYCLE_ODM[e.sku].kind === 'cycle-stand')
    ? resolveCyclePart(row.layout.find((e) => CYCLE_ODM[e.sku].kind === 'cycle-stand').sku, { archetype, pose: { stand: 'down' }, finish: false }).garage.hardpoints.foot : null;
  const lean = pose.stand === 'down' && standDown ? -Math.atan2(standDown[2], -standDown[0]) : 0;
  // (a positive turn about the axis up the head is anticlockwise from above, to the left: a steer to the right is its negative)
  const Rl = lean ? rotY(lean) : I3, Rs = steer ? about(G.axis.d, -steer * DEG) : I3, P = G.head.lo;
  const items = parts.map((p) => {
    const R = p.entry.steers && steer ? mul3(Rl, Rs) : Rl;
    // (a steered part turns about the axis through the head: x' = R·x + (P − R·P), then the whole machine leans)
    const t = p.entry.steers && steer ? vec3(Rl, sub(P, vec3(Rs, P))) : [0, 0, 0];
    const rot = eulerXYZ(R).map((d) => round3(d) || 0);
    return { id: p.id, source: p.recipe, at: t.map((v) => round3(v) + 0), ...(rot.some(Boolean) ? { rotate: rot } : {}) };
  });
  const manifest = { kind: 'assembler', title: title || `${row.label} (${row.classOf})`, units: 'm', items };
  // the laws and the measures read upright, its stand up (a lone build when the pose moved anything)
  const upright = !steer && pose.stand !== 'down' ? parts : buildLayout(archetype, { palette, colors, pose: {}, finish: false });
  const uprightManifest = { kind: 'assembler', units: 'm', items: upright.map((p) => ({ id: p.id, source: p.recipe, at: [0, 0, 0] })) };
  const measures = measureCycle(uprightManifest);
  const laws = cycleLaws({ row, G, physics, parts: upright, measures, standFoot: standDown });
  const hp = (name) => { for (const p of upright) { const v = p.recipe.garage.hardpoints[name]; if (v) return v; } return null; };
  const contacts = parts.filter((p) => p.recipe.garage.hardpoints.contact).map((p) => ({ id: p.id, at: roundPt(vec3(Rl, p.recipe.garage.hardpoints.contact)) }));
  if (lean && standDown) contacts.push({ id: 'stand', at: roundPt(vec3(Rl, standDown)) });
  const mass = parts.reduce((s, p) => s + p.recipe.garage.mass, 0);
  const bom = planAssemblyBom(parts.map((p) => ({ garage: { kind: p.recipe.garage.kind } })), row.bom);
  return {
    manifest,
    readout: {
      archetype,
      label: row.label,
      classOf: row.classOf,
      physics: row.physics,
      layout: wheelLayoutOf(upright),
      geometry: laws.G,
      measures,
      contacts,
      ...(lean ? { lean: Math.round((lean / DEG) * 10) / 10 } : {}),
      // (a peg each side, or the floor or the pedals a rider's feet are on)
      rider: { seat: hp('seat'), 'grip.l': hp('grip.l'), 'grip.r': hp('grip.r'), 'peg.l': parts.find((p) => p.id === 'peg-l')?.recipe.garage.hardpoints.peg ?? hp('peg.l'), 'peg.r': parts.find((p) => p.id === 'peg-r')?.recipe.garage.hardpoints.peg ?? hp('peg.r') },
      joints: items.flatMap((it) => (it.source.garage.joints || []).map((j) => ({ item: it.id, name: j.name, control: j.control, kind: j.kind, at: j.at, dir: j.dir, range: j.range, ...(j.kind === 'slide' ? { travel: j.travel } : { angle: j.angle }) }))),
      laws: { ok: laws.ok, laws: laws.laws },
      partsMass: Math.round(mass),
      pose: { steer, stand: pose.stand ?? 'up' },
      ...(look && look !== 'stock' ? { look } : {}),
      audit: { ok: bom.ok && !bom.surplus.length, bom },
    },
  };
}

/** How the machine stands on its wheels, read from its wheels as built: two in line (inline), or more. */
function wheelLayoutOf(parts) {
  const wheels = parts.filter((p) => p.recipe.garage.kind === 'cycle-wheel').map((p) => p.recipe.garage.hardpoints.contact);
  if (wheels.length === 2 && wheels.every((c) => Math.abs(c[0]) < 1e-3)) return 'inline';
  return `${wheels.length} wheels`;
}

// ── words ───────────────────────────────────────────────────────────────────
const norm = (w) => String(w).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
let INDEX = null;
/** Every word that names a part → its sku. One word, one part: a collision throws. */
export function cycleNameIndex() {
  if (INDEX) return INDEX;
  const index = new Map();
  for (const [sku, row] of Object.entries(CYCLE_ODM)) {
    for (const word of [sku, row.label, ...(row.aliases || [])]) {
      const key = norm(word);
      if (index.has(key) && index.get(key) !== sku) throw new Error(`cycle word '${key}' names both ${index.get(key)} and ${sku}`);
      index.set(key, sku);
    }
  }
  INDEX = index;
  return index;
}
/** The words people say ('usd fork', 'kickstand') → the part number, or null. */
export const findCyclePart = (words) => cycleNameIndex().get(norm(words)) || null;
/** The inventory as a catalogue, optionally one kind. */
export const listCycleShelf = ({ kind } = {}) => Object.entries(CYCLE_ODM).filter(([, r]) => !kind || r.kind === kind)
  .map(([sku, r]) => ({ sku, kind: r.kind, label: r.label, classOf: r.classOf, dims: clone(r.dims), mass: r.mass }));
