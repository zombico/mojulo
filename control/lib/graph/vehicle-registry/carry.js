/**
 * vehicle-registry/carry — what a boat's well deck carries: the registry's own vehicles, by their own dimensions; what
 * a carrier's flight deck carries: the field's carrier-borne aircraft, by their own.
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
 *   flightDeck(archetype) → { at, spots: [{ at, heading }], spot, lifts: [{ at, length, width, load }], holds } | null
 *     A carrier's deck (its `boat-deck` part: craft-shelf/boat-carrier.js) parks an aircraft on each of its spots, its
 *     wings folded, and strikes it below on a lift. Its aircraft are the registry's air rows in the field's `carrier`
 *     role drawn on the shelf, each by its own assembled span (spread and folded), length and weight: what parks on a
 *     spot (`spot`: its length and width, the clearance round it) and whether a lift takes it below (`lift`: a lift's
 *     length and width against it folded, its weight against the deck's `load`).
 *     at        the deck's top amidships; a spot's `at` its middle on the deck, its `heading` degrees (+ turns its nose
 *               to port), in the assembled craft's frame
 *     holds     [{ id, craft, span, folded, length, mass, count, lift }], heaviest first
 *
 * Pure: it reads the shelf and the registry, writes nothing.
 */
import { assembleCraft, CRAFT_ARCHETYPES, CRAFT_ODM } from '../craft-shelf/index.js';
import { VEHICLES, handlesOf } from './roster.js';
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

export function flightDeck(archetype) {
  const row = CRAFT_ARCHETYPES[archetype];
  if (!row) throw new Error(`carry: '${archetype}' is no craft on the shelf`);
  const entry = row.layout.find((e) => CRAFT_ODM[e.sku]?.kind === 'boat-deck');
  if (!entry) return null;
  const D = CRAFT_ODM[entry.sku].build, { manifest } = assembleCraft(archetype), deck = manifest.items.find((i) => i.id === entry.id);
  const hp = deck.source.garage.hardpoints, world = (p) => [r3(deck.at[0] + p[0]), r3(deck.at[1] + p[1]), r3(deck.at[2] + p[2])];
  const spots = D.spots.map(([, , heading], k) => ({ at: world(hp[`spot_${k}`]), heading }));
  const lifts = D.lifts.map((L) => ({ at: world([L.x + (L.side * L.width) / 2, (L.y[0] + L.y[1]) / 2, D.thickness]), length: L.y[1] - L.y[0], width: L.width }));
  const load = CRAFT_ODM[entry.sku].perf?.load ?? Infinity, holds = [];
  for (const id of Object.keys(VEHICLES)) {
    const v = VEHICLES[id], craft = handlesOf(id).craft?.[0];
    if (v.realm !== 'air' || v.role !== 'carrier' || !craft || !CRAFT_ARCHETYPES[craft]) continue;
    const spread = assembleCraft(craft, { fold: 0 }).readout, folded = assembleCraft(craft, { fold: 1 }).readout.measures;
    const mass = CRAFT_ARCHETYPES[craft].reference?.mtow ?? spread.partsMass, L = spread.measures.length;
    if (L + CLEAR.length > D.spot.length || folded.span + CLEAR.width > D.spot.width) continue;
    const lift = mass <= load && lifts.some((l) => (L + CLEAR.length <= l.length && folded.span + CLEAR.width <= l.width) || (L + CLEAR.length <= l.width && folded.span + CLEAR.width <= l.length));
    holds.push({ id, craft, span: spread.measures.span, folded: folded.span, length: L, mass, count: spots.length, lift });
  }
  holds.sort((a, b) => b.mass - a.mass || a.id.localeCompare(b.id));
  return { at: world([0, 0, D.thickness]), spots, spot: { ...D.spot }, lifts: lifts.map((l) => ({ ...l, load })), holds };
}
