/**
 * THE METRO'S FLEETS AND THEIR YARDS — the vehicles a metro keeps, each fleet by its ROLE in the city (the vehicle
 * registry's roles: vehicle-registry/roster.js), every vehicle a registry row read to the realistic body it stands as
 * (a car shelf card, a realistic loft, a construction shelf machine), and the YARD each role is kept in (a parking
 * block given to it, design.js `yards`).
 *
 *   FLEETS        { <role>: { read, rows: [{ word, weight, paint?, extra? , stand? }] } }: civilian (the family cars),
 *                 taxi, police, ambulance, fire, garbage, utility, delivery, bus, construction; a row the registry
 *                 builds no realistic body for yet (a taxi, a police car, an ambulance, a fire engine) STANDS as the
 *                 nearest one that is (`stand`), in its livery, its roof's extra marking it
 *   YARDS         { lot, depot, works, emergency, contractor }: what each yard keeps (its roles) and its building
 *   fleetOf(role) → [{ word, vehicle, model, weight, paints, extra?, stand? }], memoized: each row read through the
 *                 registry (cars.js carModel's keys: a card, `loft:<class>`; a machine `site:<archetype>`)
 *   pickOf(fleet, R) → one of a fleet by its weight (one die), its paint (another)
 *   assignYards(regions, seed) → { <block id>: yard }: the metro's parking blocks each a yard, a vacant block by a
 *                 construction site its contractor's yard, by the metro's own dice (`${seed}|yards`)
 *
 * Pure and deterministic.
 */
import { parkable } from '../vehicle-registry/parked.js';
import { handlesOf, resolveVehicle } from '../vehicle-registry/roster.js';
import { streamOf } from '../city/plan/dice.js';
import { CAR_PAINT_HEX, TOWN_CARS } from '../geotown/cars.js';

// the family cars a metro parks (of the town's, cars.js TOWN_CARS)
const METRO_CARS = Object.freeze(['sedan', 'hatchback', 'crossover', 'suv']);
export const FLEETS = Object.freeze({
  // (four models: each a heavy template, a metro's page carries each once)
  civilian: { read: 'the family cars people park', rows: Object.entries(TOWN_CARS).filter(([w]) => METRO_CARS.includes(w)).map(([word, weight]) => ({ word, weight })) },
  taxi: { read: 'taxis at their rank and on the kerb', rows: [{ word: 'taxi', stand: 'sedan', weight: 1, paint: ['#f2c230'], extra: 'taxi-sign' }] },
  police: { read: 'the police: patrol cars', rows: [{ word: 'police-car', stand: 'sedan', weight: 1, paint: ['#f1f1ee'], extra: 'lightbar-rb' }] },
  ambulance: { read: 'ambulances', rows: [{ word: 'ambulance', stand: 'cargo-van', weight: 1, paint: ['#f4f4f0'], extra: 'lightbar-r' }] },
  fire: { read: 'fire engines', rows: [{ word: 'fire-engine', stand: 'box-truck', weight: 1, paint: ['#b3221d'], extra: 'lightbar-r' }] },
  garbage: { read: 'the city\'s garbage trucks', rows: [{ word: 'box-truck', weight: 1, paint: ['#2f6b3a'] }] },
  utility: { read: 'the city\'s works pickups and vans', rows: [{ word: 'pickup', weight: 2, paint: ['#f1f1ee', '#e07b25'], extra: 'beacon' }, { word: 'cargo-van', weight: 1, paint: ['#f1f1ee'], extra: 'beacon' }] },
  delivery: { read: 'vans and box trucks delivering', rows: [{ word: 'cargo-van', weight: 3, paint: ['#f1f1ee', '#5a3a22', '#2a3f6a', '#c9b48a'] }, { word: 'box-truck', weight: 1, paint: ['#f1f1ee', '#8a2a2a'] }] },
  bus: { read: 'the city\'s buses', rows: [{ word: 'bus', weight: 1, paint: ['#c8322a'] }] },
  // (two machines, the site's own tipper among them: each a heavy template, a page carries each once)
  construction: { read: 'a site\'s machines: mixer trucks and tippers', rows: [{ word: 'mixer-truck', weight: 1 }, { word: 'tipper-truck', weight: 1 }] },
});

// what each yard keeps, by role and how often, and what stands in it besides
export const YARDS = Object.freeze({
  lot: { read: 'a car park', roles: { civilian: 1 } },
  depot: { read: 'a bus depot: its buses in rows under a shed', roles: { bus: 1 }, building: 'shed' },
  works: { read: 'the city\'s works yard: its garbage trucks, its works pickups and vans, its shed', roles: { garbage: 2, utility: 3 }, building: 'shed' },
  emergency: { read: 'an emergency station: its fire engines before their bays, its ambulances, its police cars', roles: { fire: 2, ambulance: 2, police: 3 }, building: 'station' },
  contractor: { read: 'a contractor\'s yard by its sites: their mixers, tippers and loaders', roles: { construction: 1 }, building: 'shed' },
});

const MEMO = new Map();
/** A role's fleet, each row read through the registry to the body it stands as. */
export function fleetOf(role) {
  if (MEMO.has(role)) return MEMO.get(role);
  const F = FLEETS[role];
  if (!F) throw new Error(`fleets: '${role}' is no role a metro keeps (${Object.keys(FLEETS).join(', ')})`);
  const out = F.rows.map((r) => {
    const hit = resolveVehicle(r.word);
    if (!hit) throw new Error(`fleets: '${r.word}' is no vehicle the registry names`);
    // (its own realistic body, else the one it stands as for now)
    const p = parkable(r.stand ?? r.word, `fleets.${role} '${r.word}'`);
    // (a construction shelf machine; a car shelf card, the row's own or its first; else its class's realistic loft)
    const card = p.car ?? handlesOf(p.vehicle).car?.[0], model = p.construction ? `site:${p.construction}` : card ? card : `loft:${p.class}`;
    return { word: r.word, vehicle: hit.id, model, weight: r.weight, paints: r.paint ?? CAR_PAINT_HEX, ...(r.extra ? { extra: r.extra } : {}), ...(r.stand ? { stand: p.vehicle } : {}) };
  });
  MEMO.set(role, out);
  return out;
}

/** One of a fleet by its weight, its paint by another die. */
export function pickOf(fleet, R) {
  const sum = fleet.reduce((a, f) => a + f.weight, 0);
  let t = R() * sum, f = fleet[fleet.length - 1];
  for (const x of fleet) { t -= x.weight; if (t <= 0) { f = x; break; } }
  return { ...f, paint: f.paints[Math.floor(R() * f.paints.length)] };
}

/** The metro's yards: its parking blocks each given a role by the metro's dice (a bus depot, a works yard, an emergency
 *  station for every dozen neighbourhoods, the frame's and the outskirts' before the core's; the rest car parks), and
 *  the vacant block or car park nearest each neighbourhood's sites its contractor's yard. → { <block id>: yard } */
export function assignYards(regions, seed) {
  const R = streamOf(seed, 'yards', 'metro'), out = {};
  const parks = regions.flatMap((r) => (r.blocks ?? []).filter((b) => b.kind === 'parking').map((b) => ({ b, r })));
  const n = regions.length, want = [['depot', Math.max(1, Math.round(n / 30))], ['works', Math.max(1, Math.round(n / 30))], ['emergency', Math.max(1, Math.round(n / 12))]];
  // (each role's yards from the parking blocks out of the core first, by the dice among them)
  const order = (ring) => (ring === 'outskirts' ? 0 : ring === 'frame' ? 1 : 2);
  const pool = parks.map((p) => ({ ...p, k: order(p.r.ring) + R() })).sort((a, b) => a.k - b.k);
  // (the contractor's yards first: a neighbourhood's sites take its vacant block, else its car park, nearest them)
  for (const r of regions) {
    const sites = (r.blocks ?? []).filter((b) => b.kind === 'construction');
    if (!sites.length) continue;
    const mid = (b) => [(b.rect[0] + b.rect[2]) / 2, (b.rect[1] + b.rect[3]) / 2], c = mid(sites[0]);
    const cand = (r.blocks ?? []).filter((b) => (b.kind === 'vacant' || b.kind === 'parking') && !out[b.id]).sort((a, b) => (a.kind === 'vacant' ? 0 : 1) - (b.kind === 'vacant' ? 0 : 1) || Math.hypot(...mid(a).map((v, i) => v - c[i])) - Math.hypot(...mid(b).map((v, i) => v - c[i])));
    if (cand[0]?.kind === 'vacant') out[cand[0].id] = 'contractor';
  }
  for (const [yard, k] of want) for (let i = 0; i < k; i++) { const p = pool.find((q) => !out[q.b.id]); if (p) out[p.b.id] = yard; }
  for (const { b } of parks) if (!out[b.id]) out[b.id] = 'lot';
  return out;
}
