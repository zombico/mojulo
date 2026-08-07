/**
 * assembly-bom — the industrial-mode mapping layer of the vehicle designer
 * (vehicle-designer.plan.md VA): the archetype table as code, the chassis
 * STATION MAP, and the advisory bill-of-materials audit.
 *
 * Industrial mode's accuracy edge is COMPONENT PRESENCE. This module maps
 * it three ways:
 *  - `VEH_ARCHETYPES` — class → type → the part families and the `bom`
 *    (which components a build of this type requires at all). "Trailer has
 *    no engine" is a row, not a special case.
 *  - `mapChassisStations(chassis)` — the chassis as a map: every derived
 *    socket paired with the part kind expected to fill it.
 *  - `planAssemblyBom(parts, bom)` / `planVehicleBuild(...)` — advisory
 *    audit (never a mint refusal, same posture as edifice livability):
 *    are the required components there, in the right counts, and does a
 *    station go unfilled?
 *
 * The audit is generic over `garage.kind` + counts, so later shelves
 * (ships, buildings) can reuse it with their own tables.
 */

import { deriveAxleSockets, deriveBaySockets } from './veh-garage.js';

// D3 (drivable-vehicles.plan.md): rows carry `curbMass` (kg-ish in world units) and optional
// `brake` (N) overrides — deriveDrivetrain composes them with the engine part's horsepower into
// the drive rule's params. The trailer stays a row, not a special case (assembly-bom doctrine).
export const VEH_ARCHETYPES = {
  sedan: {
    class: 'car',
    curbMass: 1450,
    chassis: { family: 'unibodyPan' },
    body: { family: 'sedanThree' },
    bom: { 'veh-chassis': 1, 'veh-wheel': 4, 'veh-engine': 1, 'veh-cabin': 1, 'veh-steering': 1, 'veh-dash': 1, 'veh-body': 1, 'veh-lights': 2 },
  },
  coupe: {
    class: 'car',
    curbMass: 1300,
    chassis: { family: 'sportPan' },
    body: { family: 'coupeThree' },
    bom: { 'veh-chassis': 1, 'veh-wheel': 4, 'veh-engine': 1, 'veh-cabin': 1, 'veh-steering': 1, 'veh-dash': 1, 'veh-body': 1, 'veh-lights': 2 },
  },
  suv: {
    class: 'car',
    curbMass: 1900,
    chassis: { family: 'unibodyPan', overrides: { rideHeight: 'high' } },
    body: { family: 'wagonTwo' },
    bom: { 'veh-chassis': 1, 'veh-wheel': 4, 'veh-engine': 1, 'veh-cabin': 1, 'veh-steering': 1, 'veh-dash': 1, 'veh-body': 1, 'veh-lights': 2 },
  },
  minivan: {
    class: 'van',
    curbMass: 1850,
    chassis: { family: 'unibodyPan', overrides: { wheelbase: 'long' } },
    body: { family: 'vanOne', overrides: { glasshouse: 'glassy' } },
    bom: { 'veh-chassis': 1, 'veh-wheel': 4, 'veh-engine': 1, 'veh-cabin': 1, 'veh-steering': 1, 'veh-dash': 1, 'veh-body': 1, 'veh-lights': 2 },
  },
  caravanVan: {
    class: 'van',
    curbMass: 1950,
    chassis: { family: 'unibodyPan', overrides: { wheelbase: 'long' } },
    body: { family: 'vanOne' },
    bom: { 'veh-chassis': 1, 'veh-wheel': 4, 'veh-engine': 1, 'veh-cabin': 2, 'veh-steering': 1, 'veh-dash': 1, 'veh-body': 1, 'veh-lights': 2 },
  },
  towtruck: {
    class: 'truck',
    curbMass: 3400,
    brake: 16000,   // truck brakes don't scale with the towing mass — it stops LONG (D3)
    chassis: { family: 'ladderFrame' },
    body: { family: 'truckCab' },
    payload: { family: 'towBoom' },
    bom: { 'veh-chassis': 1, 'veh-wheel': 4, 'veh-engine': 1, 'veh-cabin': 1, 'veh-steering': 1, 'veh-dash': 1, 'veh-body': 1, 'veh-lights': 2, 'veh-payload': 1 },
  },
  flatbed: {
    class: 'truck',
    curbMass: 3200,
    brake: 16000,
    chassis: { family: 'ladderFrame' },
    body: { family: 'truckCab' },
    payload: { family: 'flatbedDeck' },
    bom: { 'veh-chassis': 1, 'veh-wheel': 4, 'veh-engine': 1, 'veh-cabin': 1, 'veh-steering': 1, 'veh-dash': 1, 'veh-body': 1, 'veh-lights': 2, 'veh-payload': 1 },
  },
  trailer: {
    class: 'trailer',
    curbMass: 900,   // a row like any other — not drivable BY DATA (no engine in the bom)
    chassis: { family: 'towedFrame' },
    payload: { family: 'boxVan' },
    bom: { 'veh-chassis': 1, 'veh-wheel': 4, 'veh-payload': 1 },
  },
};

const EXPECTS_BY_BAY = {
  engineBay: ['veh-engine'],
  cabinDeck: ['veh-cabin'],
  dashRail: ['veh-dash', 'veh-steering'],
  rearDeck: ['veh-payload'],
  hitch: [],
};

/** The chassis as a map: every derived socket + the part kind that fills it. */
export function mapChassisStations(chassis) {
  const stations = deriveAxleSockets(chassis).map((s) => ({
    station: `${s.axle}-${s.side}-hub`,
    mount: 'hub-mount',
    expects: ['veh-wheel'],
    anchor: s.anchor,
  }));
  for (const [bay, socket] of Object.entries(deriveBaySockets(chassis))) {
    stations.push({ station: bay, mount: bay === 'hitch' ? 'hitch' : 'bay', expects: EXPECTS_BY_BAY[bay] || [], anchor: socket.anchor });
  }
  return stations;
}

/**
 * Advisory BOM audit over part recipes. `parts` is an array of veh-*
 * recipes (each carrying `garage.kind`); `bom` maps kind → required count.
 * Returns { ok, missing, surplus, counts } — advisory, never a refusal.
 */
export function planAssemblyBom(parts, bom) {
  const counts = {};
  for (const p of parts) {
    const kind = p && p.garage && p.garage.kind;
    if (kind) counts[kind] = (counts[kind] || 0) + 1;
  }
  const missing = [];
  for (const [kind, need] of Object.entries(bom)) {
    const have = counts[kind] || 0;
    if (have < need) missing.push(`${kind}: have ${have}, need ${need}`);
  }
  const surplus = Object.keys(counts).filter((kind) => !(kind in bom)).map((kind) => `${kind}: not in this archetype's BOM`);
  return { ok: missing.length === 0, missing, surplus, counts };
}

/**
 * The industrial-mode map: audit a build against its archetype and fill
 * the chassis station map from the supplied parts. `parts` includes the
 * chassis itself. Returns { archetype, class, audit, stations, warnings }.
 */
export function planVehicleBuild({ archetype, chassis, parts }) {
  const row = VEH_ARCHETYPES[archetype];
  if (!row) throw new Error(`Unknown vehicle archetype '${archetype}' - expected one of: ${Object.keys(VEH_ARCHETYPES).join(', ')}`);
  const audit = planAssemblyBom(parts, row.bom);
  const remaining = parts.filter((p) => p.garage && p.garage.kind !== 'veh-chassis');
  const stations = mapChassisStations(chassis).map((st) => {
    const i = remaining.findIndex((p) => st.expects.includes(p.garage.kind));
    if (i === -1) return { ...st, filledBy: null };
    const [part] = remaining.splice(i, 1);
    return { ...st, filledBy: { kind: part.garage.kind, family: part.garage.family } };
  });
  const warnings = [];
  for (const st of stations) {
    if (st.expects.length && !st.filledBy && st.expects.some((kind) => kind in row.bom)) {
      warnings.push(`station ${st.station} is unfilled (expects ${st.expects.join('/')})`);
    }
  }
  // dashRail hosts two parts; the map above fills it once — report the second
  const unstationed = remaining.filter((p) => !['veh-body', 'veh-lights'].includes(p.garage.kind));
  for (const p of unstationed) {
    if (p.garage.kind === 'veh-steering' || p.garage.kind === 'veh-dash') continue; // second dashRail rider
    warnings.push(`${p.garage.kind} (${p.garage.family}) has no station on this chassis`);
  }
  return { archetype, class: row.class, audit, stations, warnings };
}
