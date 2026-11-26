/**
 * JOBSIFIED — the phone app of the city's driving jobs. A job on it is a SHIFT done in one of the city's own vehicles:
 * taken on the phone, the hero goes to the DEPOT that keeps that vehicle (a yard of the metro's: geocity/fleets.js
 * YARDS), gets into one there, drives its route (its STOPS, each reached in the vehicle) and brings it back to the depot,
 * where it is paid. A standing shift (`repeat`) is driven again for more pay.
 *
 * A shift is an errand with `vehicle` (gameworld/errand.js): the word is a row of SHIFTS, and the row says the rest. Its
 * MODE is how it is worked:
 *   collect  a round of piles (a garbage truck's): got into at its depot, driven to a pile and held at (a key held,
 *            `hold` seconds) to take it on, `load` of them filling the truck; full, it is driven to the district's
 *            DUMP (geocity `dump`, a tipping hall on a car park) and emptied there, which pays. A district with no dump
 *            unloads at the depot. Taken piles are laid again once every one is taken (the city makes more)
 *   route    a round of stops in order (a bus's): at the next stop, held at (`hold` seconds, the doors open) the people
 *            waiting there board and those who boarded at the stop before get off; the last stop pays, and the round
 *            begins again
 *   dig      a machine OPERATED on a building site (an excavator: its swing, boom, arm and bucket under the keys,
 *            construction-shelf/con-operate.js): the site's own excavator taken over, a pile of spoil beside it and a
 *            tipper waiting along the band; scooped from the pile and tipped into the truck, `loads` of them fill it,
 *            which pays (the page says each scoop and each tip: scene/channels/operate.js)
 *   sweep    a street sweeper's route: litter along the kerb side of a few streets near its yard (sweepRoute), each
 *            heap swept by driving over it in the sweeper; every one swept pays, and the streets get dirty again
 *   mow      a groundskeeper's lawn: a park near the start (geocity's block parks, ends.parks) cut into cells of long
 *            grass round its trees, its paths and its things (lawnOf); the ride-on mower issued on its path, each cell
 *            mown by driving over it; every one mown pays, and the grass grows back
 *   haul     a heavy vehicle driven to a job (a general heavy driver's): one is ISSUED at the kerb by the yard (one of
 *            the `fleet`'s models, stood there for the job: issuedOf), got into and driven across the district to a
 *            building site (a construction lot near the eye, else a far place), which pays; left there, it is taken
 *            back to the yard for the next
 * Its vehicle is either the depot's own (a collect's garbage trucks, a fleet role its yard keeps whose body a hero can get
 * into: no roof extra yet, geocity/fleets.js `extra`) or ISSUED (a row with a `fleet`: a haul's truck, a route's bus,
 * stood at the kerb by its yard, or by the start where the district keeps no such yard). A new kind of driving job is a
 * row.
 *
 *   JOBSIFIED          the app's id (phone-ui.js: a shift's app unless it names its own)
 *   SHIFT_MODES        collect | route | haul | dig | sweep | mow
 *   SHIFTS             { <word>: { name, mode, yard, vehicle, item, stops, stop?, done, load?, hold?, fleet?, to?, riders? } }
 *   YARD_NAMES         a yard as people call it (the works yard, the bus depot)
 *   SHIFT              the laying's numbers: how far a stop is driven from the one before, how far apart, the depot's reach
 *   shiftOf(word)      → the row, or throws (teaching)
 *   shiftRoles(errands, level) → the fleet roles a level's shifts are driven in from their depots (its depots'
 *                      vehicles made cabs: gameworld/cars.js levelCars `roles`)
 *   issuedOf(ends, errands, level) → [{ id, at, heading, model, paint, word, place }]: the vehicles a level's shifts
 *                      issue, each at the kerb by its yard (gameworld/cars.js levelCars `issue`)
 *
 * Pure.
 */
import { YARDS, fleetOf } from '../geocity/fleets.js';

export const JOBSIFIED = 'jobsified';
export const SHIFT_MODES = Object.freeze(['collect', 'route', 'haul', 'dig', 'sweep', 'mow']);

export const YARD_NAMES = Object.freeze({ park: 'park', dock: 'dock', works: 'works yard', depot: 'bus depot', emergency: 'emergency station', contractor: 'contractor\'s yard', lot: 'car park' });

// each driving job: its mode, the yard it starts from, the vehicle as it is called, what is had at a stop (an item word:
// the round's), how many stops (piles) a round has (an errand's list count says its own), what a stop says and what
// doing it says; a collect's `load` (piles a truck holds); `hold` (seconds a pile or a stop is held at); `fleet` (the
// fleet its vehicle is issued from, where it is not the depot's own); a haul's `to` (where it is driven); a route's
// `riders` (how few and how many wait at a stop); `licence`: taken only with the papers a world's forger sells
// (gameworld/shops.js FORGED, a heavy machinery licence), where it sells them
export const SHIFTS = Object.freeze({
  garbage: Object.freeze({ name: 'Bin round', mode: 'collect', yard: 'works', vehicle: 'garbage truck', item: 'garbage', stops: 8, load: 4, hold: 1.5, stop: 'Collect the garbage', done: 'Garbage collected' }),
  bus: Object.freeze({ name: 'Bus route', mode: 'route', yard: 'depot', fleet: 'bus', vehicle: 'bus', item: 'riders', stops: 5, hold: 1.5, riders: Object.freeze([1, 3]), stop: 'Pick up at the bus stop', done: 'Doors closed' }),
  excavator: Object.freeze({ name: 'Dig and load', mode: 'dig', yard: 'works', machine: 'crawlerExcavator', vehicle: 'excavator', item: 'spoil', stops: 1, loads: 3, licence: true, done: 'Load tipped' }),
  // (the Dockers' delivery orders: given at the faction's HQ, `given`, not on an app; told by a call, `story`, once the
  // errand it waits on has paid (the foreman's pit dug, his materials never come); its trucks at the district's DOCK)
  freight: Object.freeze({ name: 'Delivery orders', mode: 'haul', yard: 'dock', vehicles: 'freight', calls: 3, given: 'dockers', vehicle: 'truck', item: 'materials', stops: 1, to: 'building site', done: 'Materials delivered',
    story: Object.freeze({ from: 'Foreman', says: 'The pit\'s dug, but our building materials never turned up. You know a logistics outfit? We need trucks.', hq: 'Dockers: materials for a site? We move anything. Trucks are at the dock; orders come to your phone.' }) }),
  sweeper: Object.freeze({ name: 'Street sweeping', mode: 'sweep', yard: 'works', vehicles: 'sweeper', calls: 1, vehicle: 'street sweeper', item: 'litter', stops: 3, done: 'Streets swept' }),
  // (the parks' groundskeeper, for licence holders: the crew is off sick, so anyone with papers will do; `pitch` what
  // the parks office says as it is taken)
  groundskeeper: Object.freeze({ name: 'Groundskeeping', mode: 'mow', yard: 'park', vehicles: 'mower', calls: 1, licence: true, vehicle: 'ride-on mower', item: 'lawn', stops: 1, done: 'Lawn mowed',
    pitch: 'Parks office: half the grounds crew is off sick again and the grass won\'t wait. Got a licence? The mower\'s on the path. Cut the long grass.' }),
  heavy: Object.freeze({ name: 'Heavy vehicle call', mode: 'haul', yard: 'works', vehicles: 'heavy', calls: 3, licence: true, vehicle: 'heavy vehicle', item: 'haul', stops: 1, to: 'building site', done: 'Delivered' }),
});
// THE HEAVY CALL'S VEHICLES (a row's `vehicles: 'heavy'`): trucks and a site's machines turn about, each a body a hero
// can drive (a car shelf loft or a construction shelf machine, geotown/cars.js carModel), what it is called and its
// paint (a machine wears its own colours). A job's calls are the next `calls` of them from its own word
export const HEAVY_VEHICLES = Object.freeze([
  Object.freeze({ model: 'site:mixerTruck', word: 'concrete mixer', paint: '#d8d4ca' }),
  Object.freeze({ model: 'loft:flatbedTruck', word: 'flatbed truck', paint: '#20497f' }),
  Object.freeze({ model: 'site:wheelLoader', word: 'wheel loader', paint: '#e0b02a' }),
  Object.freeze({ model: 'site:tipperTruck', word: 'tipper truck', paint: '#d8d4ca' }),
  Object.freeze({ model: 'loft:skipLoader', word: 'skip lorry', paint: '#c45a1d' }),
  Object.freeze({ model: 'site:backhoeLoader', word: 'backhoe', paint: '#e0b02a' }),
  Object.freeze({ model: 'loft:straightBox', word: 'box truck', paint: '#e6e6e2' }),
  Object.freeze({ model: 'site:wheeledExcavator', word: 'wheeled excavator', paint: '#e0b02a' }),
]);
// THE DOCK'S TRUCKS (a row's `vehicles: 'freight'`): what the Dockers send building materials in
export const FREIGHT_VEHICLES = Object.freeze([
  Object.freeze({ model: 'loft:rollOff', word: 'container truck', paint: '#2e86c1' }),
  Object.freeze({ model: 'loft:flatbedTruck', word: 'flatbed of steel', paint: '#2e86c1' }),
  Object.freeze({ model: 'loft:straightBox', word: 'box truck of fittings', paint: '#e6e6e2' }),
  Object.freeze({ model: 'loft:mediumTruck', word: 'stake truck of timber', paint: '#2e86c1' }),
]);
// THE WORKS YARD'S SWEEPER (a row's `vehicles: 'sweeper'`)
export const SWEEPERS = Object.freeze([Object.freeze({ model: 'loft:streetSweeper', word: 'street sweeper', paint: '#f1f1ee' })]);
// THE PARKS' MOWER (a row's `vehicles: 'mower'`): the car shelf's ride-on mower
export const MOWERS = Object.freeze([Object.freeze({ model: 'loft:rideOnMower', word: 'ride-on mower', paint: '#3f7a3a' })]);
const VEHICLE_LISTS = Object.freeze({ heavy: HEAVY_VEHICLES, freight: FREIGHT_VEHICLES, sweeper: SWEEPERS, mower: MOWERS });
/** Whether a row's vehicle is issued (a fleet's, or one of a list's turn about), not the depot's own. */
export const issues = (S) => !!(S && (S.fleet || S.vehicles || S.machine));
for (const [word, S] of Object.entries(SHIFTS)) {
  if (!SHIFT_MODES.includes(S.mode)) throw new Error(`jobsified: '${word}' works as ${SHIFT_MODES.join(', ')}`);
  if (!issues(S) && !YARDS[S.yard]?.roles?.[word]) throw new Error(`jobsified: the ${S.yard} yard keeps no ${word} (geocity/fleets.js YARDS); a vehicle it does not keep is issued (fleet, vehicles)`);
  if (S.mode === 'haul' && !issues(S)) throw new Error(`jobsified: '${word}' is a haul: its vehicle is issued (fleet, vehicles)`);
  if (S.vehicles && !VEHICLE_LISTS[S.vehicles]) throw new Error(`jobsified: '${word}' issues from no list (${Object.keys(VEHICLE_LISTS).join(', ')})`);
}

// how a round is laid (m): each stop about `hop` from the one before (the nearest place to that), never nearer than
// `apart` to another stop or the depot; the depot reached within its yard, `reach` at the least; a haul's site at least
// `haul` from its yard, reached `site` past its lot's edge
export const SHIFT = Object.freeze({ hop: 160, apart: 60, reach: 9, haul: 300, site: 8 });

export function shiftOf(word) {
  const S = SHIFTS[word];
  if (!S) throw new Error(`jobsified: '${word}' is no driving job (vehicle: ${Object.keys(SHIFTS).join(', ')})`);
  return S;
}

export const shiftRoles = (errands, level) => [...new Set((errands ?? []).filter((E) => E?.vehicle && E.giver === level && SHIFTS[E.vehicle] && !issues(SHIFTS[E.vehicle])).map((E) => E.vehicle))];

// (a word's own number, for a choice no die makes: the same job issues the same truck)
const hashOf = (w) => [...String(w)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
/** The vehicles a level's shifts issue: a fleet's one (a route's bus) or a list's `calls` (a heavy call's, each the next
 *  of the list from the job's own word, `call` its number), each at the kerb before one of the places nearest its yard
 *  (the start where the district keeps no such yard), turned along the street. */
export function issuedOf(ends, errands, level) {
  const out = [], d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]), taken = [];
  for (const E of errands ?? []) {
    const S = E?.vehicle && E.giver === level ? SHIFTS[E.vehicle] : null;
    if (!issues(S) || S.machine || typeof ends?.kerbAt !== 'function') continue;
    // (its yard: a depot's, or the district's dock, geocity `dock`; the start where it has neither)
    // (a park's mower: on its lawn's path, lawnOf, never at a kerb)
    if (S.yard === 'park') {
      const L = lawnOf(ends), V = VEHICLE_LISTS[S.vehicles][hashOf(E.id) % VEHICLE_LISTS[S.vehicles].length];
      if (L) out.push({ id: E.id, call: 1, at: L.spot.at.slice(), heading: L.spot.heading, model: V.model, paint: V.paint, word: V.word, place: null, yard: YARD_NAMES.park });
      continue;
    }
    const D = S.yard === 'dock' ? ends.dock ?? null : (ends.depots ?? []).find((x) => x.yard === S.yard), from = D ? D.at : ends.spawn;
    const list = S.vehicles ? VEHICLE_LISTS[S.vehicles] : null, n = list ? Math.min(S.calls ?? 1, list.length) : 1, h = hashOf(E.id);
    const which = (k) => { if (list) return list[(h + k) % list.length]; const rows = fleetOf(S.fleet), R = rows[h % rows.length]; return { model: R.model, word: R.word, paint: R.paints[0] }; };
    const near = (ends.places ?? []).slice().sort((a, b) => d2(a.at, from) - d2(b.at, from) || a.at[0] - b.at[0] || a.at[1] - b.at[1]);
    let k = 0;
    // (a dock's own bays, where it has them: a truck backed to each, its first ones)
    for (const bay of S.yard === 'dock' ? D?.bays ?? [] : []) {
      if (k >= n) break;
      const V = which(k);
      out.push({ id: E.id, ...(list ? { call: k + 1 } : {}), at: bay.at.slice(), heading: bay.heading, model: V.model, paint: V.paint, word: V.word, place: null, yard: YARD_NAMES.dock });
      taken.push(bay.at);
      k++;
    }
    // (each at a kerb of its own, clear of the others' by a long vehicle's length)
    for (const q of near.slice(0, 40 + n * 4)) {
      if (k >= n) break;
      if (!taken.every((t) => d2(q.at, t) > 16)) continue;
      const spot = ends.kerbAt(q.at, q.N);
      if (!spot || !taken.every((t) => d2(spot.at, t) > 16)) continue;
      const V = which(k);
      out.push({ id: E.id, ...(list ? { call: k + 1 } : {}), at: spot.at, heading: spot.heading, model: V.model, paint: V.paint, word: V.word, place: q.card, yard: D ? YARD_NAMES[S.yard] : null });
      taken.push(spot.at);
      k++;
    }
  }
  return out;
}

// WHERE A DIG IS WORKED (m): its machine at a building site's staged excavator, turned as it stands; its pile `pile`
// along the band to one side, the tipper `truck` along it to the other, nose along the band; the pile's reach
export const DIG = Object.freeze({ pile: 7, truck: 7.5, reach: 2.6, bed: Object.freeze({ back: 1.6, half: Object.freeze([1.25, 2.4]), top: 1.6 }) });
/** The machines a level's dig shifts operate: each at the building site nearest the start that stages an excavator and a
 *  tipper (ends.lots `digger`, `truck`), its pile and its tipper beside it along the band.
 *  → [{ id, cab, truckCab, site, archetype, at, heading, pile: { at, radius }, truck: { at, heading, model }, bed: { at, half, heading } }] */
export function operatedOf(ends, errands, level) {
  const out = [], d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]), used = new Set();
  for (const E of errands ?? []) {
    const S = E?.vehicle && E.giver === level ? SHIFTS[E.vehicle] : null;
    if (!S || S.mode !== 'dig') continue;
    const lots = (ends?.lots ?? []).filter((q) => q.kind === 'construction' && q.digger && !used.has(q.id)).sort((a, b) => d2(a.at, ends.spawn) - d2(b.at, ends.spawn) || a.id.localeCompare(b.id));
    const L = lots[0];
    if (!L) continue;
    used.add(L.id);
    // (its heading as a parked body's, from its turn; along the band to its right and its left)
    const at = L.digger.at, heading = L.digger.rotZ + Math.PI / 2, right = [Math.sin(heading), -Math.cos(heading)], along = Math.atan2(right[1], right[0]);
    const p = (k) => [Math.round((at[0] + right[0] * k) * 1000) / 1000, Math.round((at[1] + right[1] * k) * 1000) / 1000, at[2]];
    const truck = { at: p(-DIG.truck), heading: along + Math.PI, model: 'site:tipperTruck' };
    // (its bed: behind its cab, along its nose)
    const nose = [Math.cos(truck.heading), Math.sin(truck.heading)], bed = { at: [truck.at[0] - nose[0] * DIG.bed.back, truck.at[1] - nose[1] * DIG.bed.back, truck.at[2] + DIG.bed.top], half: DIG.bed.half.slice(), heading: truck.heading };
    out.push({ id: E.id, cab: `op-${E.id}`, truckCab: `op-${E.id}-truck`, site: L.id, archetype: S.machine, at: at.slice(), heading, pile: { at: p(DIG.pile), radius: DIG.reach }, truck, bed });
  }
  return out;
}

// A SWEEP'S ROUTE (m): how many stretches of street, how long each, a heap of litter every so far along it, how far off
// the street's middle (its kerb side) and how near a sweeper takes one
export const SWEEP = Object.freeze({ stretches: 3, length: 120, every: 12, kerb: 2.6, reach: 3.2 });
/** A sweep's litter: on each of the streets nearest `from` (ends.roads, a run each), the stretch of it nearest, a heap
 *  every SWEEP.every along it on its kerb side, on the ground there.  → [{ at, stretch }] */
export function sweepRoute(ends, from, { stretches = SWEEP.stretches } = {}) {
  const runs = (ends?.roads ?? []).filter((r) => r[3] - r[2] >= SWEEP.length), pt = (r, u, o = 0) => (r[0] === 0 ? [u, r[1] + o] : [r[1] + o, u]);
  const near = runs.map((r) => { const u = Math.max(r[2], Math.min(r[3], r[0] === 0 ? from[0] : from[1])), p = pt(r, u); return { r, u, d: Math.hypot(p[0] - from[0], p[1] - from[1]) }; }).sort((a, b) => a.d - b.d || a.r[1] - b.r[1]);
  const out = [], used = [];
  for (const N of near) {
    if (used.length >= stretches) break;
    if (used.some((x) => x.r[0] === N.r[0] && Math.abs(x.r[1] - N.r[1]) < 20)) continue;
    const u0 = Math.max(N.r[2] + 2, Math.min(N.r[3] - SWEEP.length - 2, N.u - SWEEP.length / 2));
    const heaps = [];
    for (let u = u0; u <= u0 + SWEEP.length + 1e-6; u += SWEEP.every) {
      const [x, y] = pt(N.r, u, SWEEP.kerb), z = typeof ends.ground === 'function' ? ends.ground(x, y) : null;
      if (z === null || z === undefined) continue;
      heaps.push({ at: [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000, Math.round(z * 1000) / 1000], stretch: used.length });
    }
    if (heaps.length < 4) continue;
    used.push(N); out.push(...heaps);
  }
  return out;
}

// A GROUNDSKEEPER'S LAWN (m): its cells' side, the most a round mows, how far in from the park's edge, how clear of its
// paths and things, how far from a tree's trunk, the least a park is across to be mown, how far up its path the mower
// stands
export const MOW = Object.freeze({ cell: 6, most: 36, inset: 1.2, clear: 0.6, tree: 2.2, deep: 20, spot: 3 });
const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
/** A lawn to mow: the park nearest `from` (the start) at least MOW.deep across (ends.parks, geocity/scene.js), cut into
 *  cells of MOW.cell clear of its paths and its things, none on a tree's trunk; the mower's spot on its path, up from the park's edge
 *  nearest the start, nosed into the park; the MOW.most cells nearest the spot.
 *  → { park, rect, spot: { at, heading }, cells: [{ at, half }] } | null */
export function lawnOf(ends, from = ends?.spawn) {
  const f = from ?? [0, 0], d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const P = (ends?.parks ?? []).filter((q) => Math.min(q.rect[2] - q.rect[0], q.rect[3] - q.rect[1]) >= MOW.deep).sort((a, b) => d2(a.at, f) - d2(b.at, f) || a.id.localeCompare(b.id))[0];
  if (!P) return null;
  const [x0, y0, x1, y1] = P.rect, C = MOW.cell, h = C / 2, ground = (x, y) => { const z = typeof ends.ground === 'function' ? ends.ground(x, y) : null; return Number.isFinite(z) ? z : P.z; };
  // (its paths: the things that run from edge to edge; the spot up the end of one nearest the start)
  const paths = P.things.filter((q) => q[2] - q[0] >= (x1 - x0) * 0.6 || q[3] - q[1] >= (y1 - y0) * 0.6);
  const ends2 = paths.flatMap((q) => (q[2] - q[0] >= q[3] - q[1] ? [[q[0], (q[1] + q[3]) / 2, 1, 0], [q[2], (q[1] + q[3]) / 2, -1, 0]] : [[(q[0] + q[2]) / 2, q[1], 0, 1], [(q[0] + q[2]) / 2, q[3], 0, -1]]));
  const E = ends2.sort((a, b) => d2(a, f) - d2(b, f) || a[0] - b[0] || a[1] - b[1])[0] ?? [x0 + MOW.spot, (y0 + y1) / 2, 1, 0];
  const sx = E[0] + E[2] * MOW.spot, sy = E[1] + E[3] * MOW.spot, spot = { at: [r3(sx), r3(sy), r3(ground(sx, sy))], heading: r3(Math.atan2(E[3], E[2])) };
  // (its cells on a grid from its middle, each clear of its paths and things, its middle off a tree's trunk)
  const nx = Math.floor((x1 - x0 - 2 * MOW.inset) / C), ny = Math.floor((y1 - y0 - 2 * MOW.inset) / C), ox = (x0 + x1) / 2 - (nx * C) / 2 + h, oy = (y0 + y1) / 2 - (ny * C) / 2 + h, cells = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const cx = ox + i * C, cy = oy + j * C;
    if (P.things.some((q) => cx + h > q[0] - MOW.clear && cx - h < q[2] + MOW.clear && cy + h > q[1] - MOW.clear && cy - h < q[3] + MOW.clear)) continue;
    if (P.trees.some((t) => Math.hypot(t[0] - cx, t[1] - cy) < MOW.tree)) continue;
    cells.push({ at: [r3(cx), r3(cy), r3(ground(cx, cy))], half: [r3(h), r3(h)] });
  }
  const near = cells.sort((a, b) => d2(a.at, spot.at) - d2(b.at, spot.at) || a.at[0] - b.at[0] || a.at[1] - b.at[1]).slice(0, MOW.most);
  return { park: P.id, rect: P.rect.slice(), spot, cells: near };
}
