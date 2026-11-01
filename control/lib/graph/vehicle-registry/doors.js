/**
 * vehicle-registry/doors — every old door's vehicle word, read through the registry first.
 *
 * The old doors named a vehicle by their own table's key: the quick game's `ride` (car | coupe | van), its `vehicle`
 * (a physics class), its `craft` (the fly goal's flight model) and its transformer's `vehicle.ride` / `vehicle.craft`
 * (a craft archetype), and mint_solid's vehicle preview by a scenery `type`. They keep those keys (a stored recipe is a
 * compatibility promise), and they now take any word the registry knows: the word is read to its row and written as
 * the row's key in that table, so a game that says `ride: 'sedan'` stores exactly what `ride: 'car'` stores. A ride also
 * takes a row it can drive by the row's own id (`ride: 'a pickup truck'` is stored as `ride: 'pickup'`: ride.js). A word
 * the registry knows whose row has no key in that table is refused with what the row does have; a word it does not know is
 * refused with the rows it nearly names. Nothing new is ever written to a legacy table here: a new vehicle is a row.
 *
 *   quickVehicleWords(Q)  → { quick, redirects: [{ key, said, id, as }] }   Q with every vehicle word at its table's key
 *   patchVehicleWords(ops) → { patch, redirects }   design_game's JSON Pointer ops, each setting a quick vehicle word
 *                          read the same way (`/quick/ride`, `/quick/vehicle`, `/quick/craft`, `/quick/transformer/vehicle/…`)
 *   registryReadout(id, { tier? })  → { id, label, realm, role, tier, build, builds, upscale } a readout's `registry`
 */
import { VEHICLES, resolveVehicle, handlesOf, rowOfHandle, suggestVehicles } from './roster.js';
import { buildsOf, buildOf, upscaleOf } from './builds.js';
import { RIDES } from '../gameworld/ride.js';
import { VEHICLES as PHYSICS } from '../roads/vehicles.js';
import { CRAFT } from '../skyscape/eye.js';
import { CRAFT_ARCHETYPES } from '../craft-shelf/craft-archetypes.js';
import { rideableRows } from './ride.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
// a quick ride takes a row by its own id when the row has no assembled ride but can be driven (vehicle-registry/ride.js)
const RIDE_ROWS = Object.freeze({ orRow: (id) => rideableRows().includes(id) });
const fail = (m) => new Error(`gameworld: quick${m}`);

/** The rows a table's keys belong to, in prose: "car (sedan), coupe (coupe), van (minivan)". */
export function keysInWords(table, keys) {
  return keys.map((k) => { const id = rowOfHandle(table, k); return id && id !== k ? `${k} (${id})` : k; }).join(', ');
}

/** One word, read for one table: its key there (a key of the table stays as it is), or a refusal naming the registry. */
export function readThrough(word, table, keys, where, { orRow } = {}) {
  if (typeof word !== 'string' || keys.includes(word)) return { as: word };
  const hit = resolveVehicle(word);
  if (!hit) throw fail(`${where} is one of ${keysInWords(table, keys)}; or a vehicle the registry names (${suggestVehicles(word)})`);
  const [as] = handlesOf(hit.id)[table] ?? [];
  // (a door that also takes a row by its own id, as a ride takes any row it can drive: the row's id is written)
  if (as === undefined && orRow?.(hit.id)) return { as: hit.id, id: hit.id };
  if (as === undefined) {
    const up = upscaleOf(hit.id);
    throw fail(`${where} is one of ${keysInWords(table, keys)}: '${word}' is the registry's ${hit.id} (${hit.row.label}), which has none here yet${up.next ? ` (it needs ${up.next})` : ''}`);
  }
  return { as, id: hit.id };
}

/** A quick game's spec with every vehicle word at its table's key, and what was read. Pure; Q is not mutated. */
export function quickVehicleWords(Q) {
  if (!isObj(Q)) return { quick: Q, redirects: [] };
  const redirects = [], out = { ...Q };
  const take = (key, value, table, keys, where, set, opts) => {
    if (value === undefined) return;
    const r = readThrough(value, table, keys, where, opts);
    if (r.id && r.as !== value) { redirects.push({ key: where.replace(/^\./, ''), said: value, id: r.id, as: r.as }); set(r.as); }
  };
  take('ride', Q.ride, 'ride', Object.keys(RIDES), '.ride', (v) => { out.ride = v; }, RIDE_ROWS);
  take('vehicle', Q.vehicle, 'physics', Object.keys(PHYSICS), '.vehicle', (v) => { out.vehicle = v; });
  take('craft', Q.craft, 'sky', Object.keys(CRAFT), '.craft', (v) => { out.craft = v; });
  const V = isObj(Q.transformer) && isObj(Q.transformer.vehicle) ? Q.transformer.vehicle : null;
  if (V) {
    const v2 = { ...V };
    take('ride', V.ride, 'ride', Object.keys(RIDES), '.transformer.vehicle.ride', (v) => { v2.ride = v; });
    take('craft', V.craft, 'craft', Object.keys(CRAFT_ARCHETYPES), '.transformer.vehicle.craft', (v) => { v2.craft = v; });
    if (v2.ride !== V.ride || v2.craft !== V.craft) out.transformer = { ...Q.transformer, vehicle: v2 };
  }
  return { quick: redirects.length ? out : Q, redirects };
}

// the quick spec's vehicle words, by JSON Pointer under the world: the table each reads through
const QUICK_POINTERS = Object.freeze({
  '/quick/ride': ['ride', () => Object.keys(RIDES), '.ride', RIDE_ROWS],
  '/quick/vehicle': ['physics', () => Object.keys(PHYSICS), '.vehicle'],
  '/quick/craft': ['sky', () => Object.keys(CRAFT), '.craft'],
  '/quick/transformer/vehicle/ride': ['ride', () => Object.keys(RIDES), '.transformer.vehicle.ride'],
  '/quick/transformer/vehicle/craft': ['craft', () => Object.keys(CRAFT_ARCHETYPES), '.transformer.vehicle.craft'],
});

/** design_game's patch ops with every quick vehicle word read through the registry (an op setting a whole `/quick` or
 *  `/quick/transformer` is read as a quick spec). Ops that touch no vehicle word pass as they are. */
export function patchVehicleWords(ops) {
  if (!Array.isArray(ops)) return { patch: ops, redirects: [] };
  const redirects = [];
  const patch = ops.map((op) => {
    if (!isObj(op) || !['set', 'add', 'replace'].includes(op.op) || typeof op.path !== 'string') return op;
    const at = QUICK_POINTERS[op.path];
    if (at) {
      const [table, keys, where, opts] = at, r = readThrough(op.value, table, keys(), where, opts);
      if (r.id && r.as !== op.value) { redirects.push({ key: where.replace(/^\./, ''), said: op.value, id: r.id, as: r.as }); return { ...op, value: r.as }; }
      return op;
    }
    if (op.path === '/quick' || op.path === '/quick/transformer') {
      const wrap = op.path === '/quick' ? op.value : { transformer: op.value };
      const { quick, redirects: rs } = quickVehicleWords(wrap);
      redirects.push(...rs);
      return rs.length ? { ...op, value: op.path === '/quick' ? quick : quick.transformer } : op;
    }
    return op;
  });
  return { patch: redirects.length ? patch : ops, redirects };
}

/** A readout's `registry`: the row, the build drawn at the tier, every build it has and what it needs to be realistic. */
export function registryReadout(id, { tier = 'stylised', use } = {}) {
  const r = VEHICLES[id];
  if (!r) return null;
  const at = buildOf(id, tier, { use });
  return {
    id, label: r.label, realm: r.realm, role: r.role,
    tier: at.tier, build: at.build.via, ...(at.fell ? { fell: at.fell } : {}),
    builds: buildsOf(id).map((b) => `${b.tier ?? 'concept'}: ${b.via}${b.key ? ` ${b.key}` : ''} (${b.status})`),
    upscale: upscaleOf(id),
  };
}
