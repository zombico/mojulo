/**
 * craft-shelf — aircraft and spacecraft parts as ONE shelf: the ODM inventory (craft-odm.js),
 * a builder per part kind (craft-parts.js), the archetype rows that assemble whole craft
 * (craft-archetypes.js). The flying sibling of the veh-* shelf (vehicle-designer/): the same
 * `garage` block on every part, the same advisory BOM audit, the same palette roles.
 *
 *   resolveCraftPart(sku)        one inventory row → a workbench recipe (metres, its hardpoints)
 *   assembleCraft(archetype)     an archetype's layout → an assembler recipe and its readout
 *   planCraftBuild(archetype)    the advisory audit: BOM, realm, swapped kinds
 *   findCraftPart(words)         the words people say → a part number
 *
 * Everything is a pure function of its arguments: no seed, no clock. An archetype row and an
 * inventory row are compatibility promises over whatever is minted from them.
 */

import { lowerObjectFaces } from '../worlds/workbench.js';
import { resolveAssemblerPlacements } from '../worlds/workbench-assembler.js';
import { planAssemblyBom } from '../vehicle-designer/assembly-bom.js';
import { CRAFT_COLOR_ROLES, CRAFT_PALETTES, DEG, clone, resolveCraftPalette, round3 } from './craft-common.js';
import { CRAFT_BUILDERS } from './craft-parts.js';
import { CRAFT_KINDS, CRAFT_ODM, CRAFT_REALMS } from './craft-odm.js';
import { CRAFT_ARCHETYPES } from './craft-archetypes.js';

export { CRAFT_ARCHETYPES, CRAFT_COLOR_ROLES, CRAFT_KINDS, CRAFT_ODM, CRAFT_PALETTES, CRAFT_REALMS };

const REALM_PALETTE = { earth: 'airlinerWhite', space: 'scoutIvory' };
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
  out.garage = { ...recipe.garage, hardpoints: hp };
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
 */
export function resolveCraftPart(sku, { palette, colors = {}, seat = 'grid', title } = {}) {
  const row = partRow(sku);
  const { id: paletteId, colors: C } = resolveCraftPalette(palette, colors, REALM_PALETTE[row.realm]);
  const geom = CRAFT_BUILDERS[row.kind](row, C);
  const recipe = {
    kind: 'workbench',
    title: title || `${row.label} (${sku})`,
    units: 'm',
    ...Object.fromEntries(MONOMERS.filter((k) => geom[k] && geom[k].length).map((k) => [k, geom[k]])),
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
const rotX = (a, v) => [v[0], v[1] * Math.cos(a) - v[2] * Math.sin(a), v[1] * Math.sin(a) + v[2] * Math.cos(a)];

function archetypeRow(id) {
  const row = CRAFT_ARCHETYPES[id];
  if (!row) throw new Error(`Unknown craft archetype '${id}'; expected one of: ${Object.keys(CRAFT_ARCHETYPES).join(', ')}`);
  return row;
}

/**
 * Walk a layout: every part placed by its mount at the hardpoint `at` names, mirrors made. A part whose
 * parent was swapped for one without that hardpoint is left off and named (advice, not a refusal).
 */
function placeLayout(row, { palette, colors, swap }) {
  const placed = new Map();
  const order = [];
  const skipped = new Set();
  const warnings = [];
  for (const entry of row.layout) {
    const sku = swap[entry.id] || entry.sku;
    const recipe = resolveCraftPart(sku, { palette, colors, seat: 'mount' });
    let target = [0, 0, 0];
    let parentFlip = new Set();
    if (entry.at) {
      const [pid, hp] = entry.at.split('.');
      if (skipped.has(pid)) { skipped.add(entry.id); warnings.push(`${entry.id}: left off, its parent '${pid}' is off`); continue; }
      const parentPaired = placed.has(`${pid}-r`);
      if (parentPaired && !entry.pair) throw new Error(`Layout '${entry.id}' sits on paired '${pid}' and must pair with it`);
      const parent = placed.get(parentPaired ? `${pid}-r` : pid);
      if (!parent) throw new Error(`Layout '${entry.id}' is at '${entry.at}', but '${pid}' is not an earlier part`);
      const v = parent.recipe.garage.hardpoints[hp];
      if (!v) {
        skipped.add(entry.id);
        warnings.push(`${entry.id}: left off, '${pid}' (${parent.recipe.garage.sku}) has no hardpoint '${hp}' (it has ${Object.keys(parent.recipe.garage.hardpoints).join(', ')})`);
        continue;
      }
      const w = applyFlip(parent.flip, v);
      target = [parent.at[0] + w[0], parent.at[1] + w[1], parent.at[2] + w[2]];
      parentFlip = parent.flip;
    }
    const flip = flipXor(parentFlip, flipSet(entry.flip));
    const mount = applyFlip(flip, recipe.garage.hardpoints.mount);
    const at = [target[0] - mount[0], target[1] - mount[1], target[2] - mount[2]];
    if (entry.pair) {
      const r = { id: `${entry.id}-r`, slot: entry.id, recipe, at, flip };
      const l = { id: `${entry.id}-l`, slot: entry.id, recipe, at: [-at[0], at[1], at[2]], flip: flipXor(flip, new Set(['x'])) };
      placed.set(r.id, r).set(l.id, l);
      order.push(r, l);
    } else {
      const p = { id: entry.id, slot: entry.id, recipe, at, flip };
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
      const deg = round3(pitch / DEG);
      return {
        id: p.id,
        source: p.recipe,
        at: [round3(at[0]), round3(at[1]), round3(at[2] + lift)],
        ...(f ? { flip: f } : {}),
        ...(deg ? { rotate: [deg, 0, 0] } : {}),
      };
    }),
  };
}

/**
 * An archetype → an assembler recipe of frozen craft parts, standing on its gear.
 * `swap: { <layout id>: <sku> }` puts another inventory part in a slot (audited, never refused).
 * `attitude: 'ground'` (default) rests the craft on all its gear, pitching a taildragger nose up;
 * `'level'` keeps the waterline level and rests it on its lowest contact. A craft with no gear
 * rests on its lowest point (a panel interceptor stands on its panels' lower corners).
 * Returns `{ manifest, readout }`: the readout measures the craft as built.
 */
export function assembleCraft(archetype, { palette, colors = {}, swap = {}, attitude = 'ground', title } = {}) {
  const row = archetypeRow(archetype);
  const { order, warnings: placing } = placeLayout(row, { palette: palette || row.palette, colors, swap });
  const contacts = order
    .filter((p) => p.recipe.garage.hardpoints.contact)
    .map((p) => {
      const c = applyFlip(p.flip, p.recipe.garage.hardpoints.contact);
      return [p.at[0] + c[0], p.at[1] + c[1], p.at[2] + c[2]];
    });
  let pitch = 0;
  let lift;
  if (contacts.length) {
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
  // where each wheel or pad meets the ground, in the craft's world frame (a fly rule's taxi points)
  const gear = order
    .filter((p) => p.recipe.garage.hardpoints.contact)
    .map((p) => {
      const c = applyFlip(p.flip, p.recipe.garage.hardpoints.contact);
      const w = rotX(pitch, [p.at[0] + c[0], p.at[1] + c[1], p.at[2] + c[2]]);
      return { id: p.id, contact: [round3(w[0]), round3(w[1]), round3(w[2] + lift)] };
    });
  const readout = measureCraft(archetype, manifest, { pitch, swap });
  if (placing.length) readout.audit = { ...readout.audit, ok: false, warnings: [...readout.audit.warnings, ...placing] };
  return { manifest, readout: { ...readout, gear } };
}

/** What the assembled craft measures, weighs and pushes, beside its reference figure. */
export function measureCraft(archetype, manifest, { pitch = 0, swap = {} } = {}) {
  const row = archetypeRow(archetype);
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
    audit: planCraftBuild(archetype, { swap, placed: manifest.items.map((i) => i.source.garage) }),
  };
}

/**
 * The advisory audit of a build (never a refusal): the BOM through the veh-* shelf's own
 * `planAssemblyBom`, plus what is particular to flight — a swapped part of another kind than
 * its slot, a part from the other realm. `placed` (the garages of the parts actually built) counts what
 * `assembleCraft` placed; absent, the layout is counted as written.
 */
export function planCraftBuild(archetype, { swap = {}, placed } = {}) {
  const row = archetypeRow(archetype);
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
