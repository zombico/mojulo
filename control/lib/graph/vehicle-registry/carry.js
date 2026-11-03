/**
 * vehicle-registry/carry — what a boat's well deck carries: the registry's own vehicles, by their own dimensions.
 *
 * A landing craft's hull says where its well deck is (its row's `cargo: { from, to, width }`, a `cargo` point on its sole:
 * craft-shelf/boat-parts.js) and how much it carries (its plate's `perf.load`, kilograms). The vehicles it holds are the
 * registry's rows that stand parked (parked.js `parkable`: a realistic body a level can park), each by its class's own
 * length, width and mass (roads/vehicles.js), never retyped: what fits nose to the ramp with a clearance round it, and
 * how many, by the deck's area and its load.
 *
 *   wellDeck(archetype) → { at, heading, length, width, load, holds: [{ id, class, L, W, mass, count }] } | null
 *     at        the deck's middle on the sole, in the assembled craft's frame (assembleCraft's manifest: a level adds it
 *               to where it lays the craft, and parks the vehicle there with parked.js)
 *     heading   'bow': a vehicle stands nose to the ramp, along the craft's +y
 *     holds     every vehicle that fits, the most of it the deck takes (`count`), largest first
 *
 * Pure: it reads the shelf and the registry, writes nothing.
 */
import { assembleCraft, CRAFT_ARCHETYPES, CRAFT_ODM } from '../craft-shelf/index.js';
import { VEHICLES } from './roster.js';
import { VEHICLES as PHYSICS } from '../roads/vehicles.js';
import { parkable } from './parked.js';

// (the room a vehicle needs round it: to walk past it and to lash it)
export const CLEAR = Object.freeze({ length: 0.5, width: 0.4 });
const r3 = (n) => Math.round(n * 1e3) / 1e3 + 0;

export function wellDeck(archetype) {
  const row = CRAFT_ARCHETYPES[archetype];
  if (!row) throw new Error(`carry: '${archetype}' is no craft on the shelf`);
  const hullRow = CRAFT_ODM[row.layout[0].sku], K = hullRow?.build?.cargo;
  if (!K) return null;
  const { manifest } = assembleCraft(archetype), hull = manifest.items[0], p = hull.source.garage.hardpoints.cargo;
  const length = r3((K.to - K.from) * hullRow.dims.length), width = K.width, load = hullRow.perf?.load ?? Infinity;
  const holds = [];
  for (const id of Object.keys(VEHICLES)) {
    if (!['road', 'offroad'].includes(VEHICLES[id].realm)) continue;
    let cls;
    try { ({ class: cls } = parkable(id)); } catch { continue; }
    const v = PHYSICS[cls];
    if (!v?.L || v.L + CLEAR.length > length || v.W + CLEAR.width > width || v.mass > load) continue;
    const files = Math.floor(length / (v.L + CLEAR.length)), lanes = Math.floor(width / (v.W + CLEAR.width));
    holds.push({ id, class: cls, L: v.L, W: v.W, mass: v.mass, count: Math.min(files * lanes, Math.floor(load / v.mass)) });
  }
  holds.sort((a, b) => b.mass - a.mass || a.id.localeCompare(b.id));
  return { at: [r3(hull.at[0] + p[0]), r3(hull.at[1] + p[1]), r3(hull.at[2] + p[2])], heading: 'bow', length, width, load, holds };
}
