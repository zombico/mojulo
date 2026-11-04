/**
 * interior-odm — the design grammar of a railway car's inside, on the vehicle ODM's pattern: the car's design (a cab car's
 * from cab-odm.js, a car's from car-odm.js) solved into a plan of its inside held to laws. The lining follows the body's
 * own section in from its skin and is cut by the body's own openings (body-shell.js), so a window seen from inside is
 * the window seen from outside; the seats, the partitions and the cab stand inside it. interior-surface.js compiles it.
 * Pure, deterministic, generic (no operator's fit-out is copied).
 *
 *   plan           what it is                                                        a family's by default
 *   longitudinal   benches down both walls between the doors, poles and rails to hold, draft screens at the doors,
 *                  a wheelchair bay, wide floor to stand on                           metro
 *   tram           seats across in facing pairs, two and one abreast, poles at the doors, a low floor   tram
 *   bays           seats across in facing bays, two and two, tables at the windows, luggage racks, vestibules
 *                  behind partitions at the doors, a washroom                        regional
 *   airline        seats across in rows facing the car's middle, two and two, a table bay where they meet, racks,
 *                  headrests, vestibules, a washroom                                 highSpeed
 *   compartments   a side corridor down one wall, compartments off it (two facing benches, a door from the corridor
 *                  each), racks, vestibules, a washroom                             coach
 *   machine        a locomotive's machine room: its equipment down the middle, a corridor down each side   boxCab
 *   A cab car's front carries its CAB: the driver's raised floor, the desk as far forward as the nose lets it stand,
 *   the seat set back from it so the driver's seated eye is the eye its screen was drawn for, the partition behind.
 *
 *   solveInterior(design, { plan?, pitch? }) → { version, plan, family, cab, span, lining, zones, runs, levels, podiums,
 *        lanes, seats, tables, racks, poles, rails, screens, displays, partitions, walls, equipment, washrooms, capacity,
 *        laws, valid }
 *     a floor lower than its bogies (a streetcar's) is raised over each on a PODIUM, a step up to it; the seats on it
 *     stand on its level (`levels`, a run's floor; a seat's and a table's `floor`), a cab over one has its floor over it
 *     a wagon carries no interior: null
 *     pitch   a row's pitch (airline) or a facing bay's length (bays, tram), in INTERIOR_LIMITS.pitch
 *
 * Coordinates: the car's own (+y forward, x right, z up from the rail); a cab car's nose at +y.
 */
import { halfWidthAt, frontAt } from './cab-odm.js';
import { openings, endsOf } from './body-shell.js';
import { solveBogieDesign } from './bogie-odm.js';
import { mulberry32, hashSeed } from '../vehicle-designer/veh-common.js';

const frozen = (x) => Object.freeze(x);
const r4 = (x) => Math.round(x * 10000) / 10000 + 0;
export const INTERIOR_GRAMMAR_VERSION = 'rail-interior-v0.1';
// a plan's numbers: its seating, a place's width and a seat's depth (cushion), its back's top over the floor, its bay or
// pitch, the narrowest aisle it allows, the people it stands to the square metre, and what it carries
export const INTERIOR_PLANS = frozen({
  longitudinal: frozen({ seating: 'longitudinal', seat: 0.46, depth: 0.48, back: 0.95, aisle: 0.9, standing: 4, poles: true, rails: true, draft: true, wheelchair: true, displays: true }),
  tram: frozen({ seating: 'bays', abreast: [2, 1], seat: 0.45, depth: 0.45, back: 1.05, pitch: 1.62, aisle: 0.6, standing: 4, poles: true, rails: true, wheelchair: true, displays: true }),
  bays: frozen({ seating: 'bays', abreast: [2, 2], seat: 0.46, depth: 0.47, back: 1.12, pitch: 1.86, aisle: 0.5, standing: 2, tables: true, racks: true, vestibule: true, washroom: true, wheelchair: true, displays: true }),
  airline: frozen({ seating: 'airline', abreast: [2, 2], seat: 0.5, depth: 0.5, back: 1.12, pitch: 0.95, aisle: 0.5, standing: 0, tables: true, racks: true, vestibule: true, washroom: true, headrests: true, displays: true }),
  compartments: frozen({ seating: 'compartments', seat: 0.55, depth: 0.55, back: 1.15, pitch: 2.05, corridor: 0.8, places: 3, aisle: 0.7, standing: 0, racks: true, vestibule: true, washroom: true }),
  machine: frozen({ seating: 'machine', corridor: 0.62, aisle: 0.55, standing: 0 }),
});
export const INTERIOR_PLAN_KINDS = Object.freeze(Object.keys(INTERIOR_PLANS));
export const INTERIOR_FAMILY_PLAN = frozen({ metro: 'longitudinal', tram: 'tram', regional: 'bays', highSpeed: 'airline', coach: 'compartments', boxCab: 'machine' });
export const INTERIOR_LIMITS = frozen({ pitch: [0.7, 2.6] });
// the lining's thickness in from the skin, the roof's void over the ceiling, a back's thickness, the landing at an end
// the gangway opens onto, a door's clear zone beyond its leaves, the vestibule a door this near an end makes
const LINING = 0.07, VOID = 0.32, BACK = 0.08, LANDING = 0.45, DOOR_CLEAR = 0.3, VESTIBULE_REACH = 3.4, WASHROOM = [1.7, 1.45];
// the opening each end's kind leaves through its end wall: [width, height]
const END_OPENING = frozen({ gangway: [1.0, 1.95], buffers: [0.8, 1.95], articulated: [1.4, 2.0] });

/** How far out from the centreline the inside reaches at (y, z): the lining's half-width, and ahead of a cab car's root
 *  as far as the front's own surface (its lining's thickness in) lets it. */
export function insideHalfWidth(d, y, z, t = LINING) {
  const hw = halfWidthAt(d, z);
  if (hw <= t) return 0;
  if (!d.front || y <= d.front.root) return hw - t;
  if (frontAt(d, 0, z) - t < y) return 0;
  let lo = 0, hi = hw - t;
  if (frontAt(d, hi, z) - t >= y) return hi;
  for (let k = 0; k < 40; k += 1) { const m = (lo + hi) / 2; if (frontAt(d, m, z) - t >= y) lo = m; else hi = m; }
  return lo;
}

export function solveInterior(d, { plan, pitch } = {}) {
  if (d.kind === 'freight') return null;
  const family = d.front ? d.archetype : d.family, name = plan ?? INTERIOR_FAMILY_PLAN[family];
  const P0 = INTERIOR_PLANS[name];
  if (!P0) throw new Error(`rail-interior: unknown plan ${name} (known: ${INTERIOR_PLAN_KINDS.join(', ')})`);
  if (pitch !== undefined && (typeof pitch !== 'number' || !(pitch >= INTERIOR_LIMITS.pitch[0] && pitch <= INTERIOR_LIMITS.pitch[1]))) throw new Error(`rail-interior: pitch must be in [${INTERIOR_LIMITS.pitch.join(', ')}]`);
  const P = pitch === undefined ? P0 : { ...P0, pitch };
  const { length: L, height: H, floor } = d.frame, O = openings(d), E = endsOf(d);
  const hwIn = (z) => Math.max(0, halfWidthAt(d, z) - LINING);
  // the ceiling: the roof's void over it, brought down while the ceiling would be too narrow to carry its lamps
  let zCeil = H - VOID;
  while (hwIn(zCeil) < 0.75 && zCeil > floor + 1.9) zCeil -= 0.02;
  zCeil = r4(zCeil);
  const minHw = (z0, z1) => { let m = Infinity; for (let k = 0; k <= 12; k += 1) m = Math.min(m, hwIn(z0 + ((z1 - z0) * k) / 12)); return m; };

  // ── a floor lower than its bogies (a streetcar's) raised over each: a podium as long as the bogie reaches, a step up ──
  const yRear = r4(-L / 2 + LINING);
  let yEnd = r4(L / 2 - LINING);
  const BG = d.frame.bogieKinds.map((k) => solveBogieDesign({ seed: d.seed, archetype: k })), low = BG.length > 0 && floor < d.frame.pivot - 0.05;
  const podiums = low ? d.frame.bogies.map((y, k) => { const h = BG[k].base / 2 + BG[k].wheel / 2 + 0.1; return { y: [r4(Math.max(yRear, y - h)), r4(Math.min(yEnd, y + h))], z: r4(BG[k].pivot.z + 0.06), bogie: k }; }) : [];
  // ── the cab: its raised floor, its desk as far forward as the nose lets it, its seat, the driver's eye, its partition ──
  let cab = null;
  if (d.front) {
    const root = d.front.root, under = podiums.filter((q) => q.y[1] > root - 2.6), cabFloor = r4(Math.max(floor + 1.65 - 1.28, ...under.map((q) => q.z))), eye = cabFloor + 1.28;
    const deskTop = cabFloor + 0.92, deskHalf = d.archetype === 'boxCab' ? 1.0 : 0.9;
    const fits = (y) => [cabFloor + 0.02, (cabFloor + deskTop) / 2, deskTop].every((z) => insideHalfWidth(d, y, z) >= deskHalf);
    let lo = root - 4, hi = d.anchors.tip;
    for (let k = 0; k < 40; k += 1) { const m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; }
    const deskFront = r4(lo - 0.02), deskBack = r4(deskFront - 0.62), seatBack = r4(deskBack - 0.18 - 0.48 - 0.1);
    const driverX = d.archetype === 'boxCab' ? 0.62 : 0, seats = d.archetype === 'boxCab' ? [driverX, -driverX] : [driverX];
    const eyeAt = [driverX, r4(seatBack + 0.32), r4(eye)];
    let yP = r4(Math.min(seatBack - 0.75, root));
    if (O.cabW) yP = r4(Math.min(yP, O.cabW[0] - 0.1));
    // (a podium reaching back past the partition: the cab begins where it does, its floor over it)
    for (const q of under) if (q.y[1] > yP) yP = r4(Math.min(yP, q.y[0]));
    cab = { floor: cabFloor, partition: yP, desk: { y: [deskBack, deskFront], half: deskHalf, z: [r4(cabFloor + 0.78), r4(deskTop)] },
      seats: seats.map((x) => ({ x: r4(x), y: [seatBack, r4(seatBack + 0.1 + 0.48)], z: r4(cabFloor + 0.5) })), eye: eyeAt, driver: r4(driverX) };
    yEnd = r4(root);
  }
  const span = [yRear, yEnd], saloonEnd = cab ? cab.partition : yEnd;

  // ── the zones along it where no seat stands: the ends' landings, the doors' clear zones (a vestibule when a door is
  //    near an end and the plan closes its saloon off), the cab, a washroom ──
  const zones = [];
  const ends = [[yRear, 1, E.rear]];
  if (!cab) ends.push([yEnd, -1, E.front]);
  for (const [y, s, kind] of ends) zones.push({ kind: 'end', y: s > 0 ? [y, r4(y + (kind === 'articulated' ? 0.25 : LANDING))] : [r4(y - (kind === 'articulated' ? 0.25 : LANDING)), y], end: kind });
  for (const [a, b] of O.doors) {
    const near = P.vestibule ? (a - yRear < VESTIBULE_REACH ? -1 : !cab && yEnd - b < VESTIBULE_REACH ? 1 : 0) : 0;
    if (near < 0) zones.push({ kind: 'vestibule', y: [yRear, r4(b + DOOR_CLEAR)], door: [a, b] });
    else if (near > 0) zones.push({ kind: 'vestibule', y: [r4(a - DOOR_CLEAR), yEnd], door: [a, b] });
    else zones.push({ kind: 'door', y: [r4(a - DOOR_CLEAR), r4(b + DOOR_CLEAR)], door: [a, b] });
  }
  if (cab) zones.push({ kind: 'cab', y: [cab.partition, yEnd] });
  // (the steps up: a tread's length before each podium's edge that stands inside the saloon; before a raised cab)
  const rises = [...podiums.filter((q) => !cab || q.y[1] <= cab.partition + 1e-6).flatMap((q) => [[q.y[0], -1, q.z], [q.y[1], 1, q.z]]), ...(cab ? [[cab.partition, -1, cab.floor]] : [])]
    .filter(([y]) => y > yRear + 0.05 && y < saloonEnd + 1e-6 && (!cab || y <= cab.partition + 1e-6));
  for (const [y, s, z] of rises) zones.push({ kind: 'step', y: s < 0 ? [r4(y - 0.32), r4(y)] : [r4(y), r4(y + 0.32)], rise: r4(z - floor), up: -s });
  const free = (zs) => {
    const iv = zs.map((z) => z.y).sort((p, q) => p[0] - q[0]), out = [];
    let at = yRear;
    for (const [a, b] of iv) { if (a > at + 1e-6) out.push([r4(at), r4(Math.min(a, saloonEnd))]); at = Math.max(at, b); }
    if (saloonEnd > at + 1e-6) out.push([r4(at), r4(saloonEnd)]);
    return out.filter(([a, b]) => b - a > 0.05);
  };
  const washrooms = [];
  if (P.washroom && !cab) {
    const R = free(zones), top = R.at(-1);
    if (top && top[1] - top[0] > WASHROOM[0] + 0.9) {
      const side = P.seating === 'compartments' ? 1 : -1, xo = minHw(floor, zCeil - 0.1);
      washrooms.push({ y: [r4(top[1] - WASHROOM[0]), top[1]], x: side > 0 ? [r4(xo - WASHROOM[1]), r4(xo)] : [r4(-xo), r4(-xo + WASHROOM[1])], side });
      zones.push({ kind: 'washroom', y: [r4(top[1] - WASHROOM[0]), top[1]] });
    }
  }
  // (the free runs, each parted at a podium's edges, each on its own level: the floor, or a podium)
  const cuts = podiums.flatMap((q) => q.y);
  const runs = free(zones).flatMap(([a, b]) => { const c = [a, ...cuts.filter((y) => y > a + 0.05 && y < b - 0.05), b]; return c.slice(1).map((v, i) => [c[i], v]); });
  const levels = runs.map(([a, b]) => { const q = podiums.find((p) => (a + b) / 2 > p.y[0] && (a + b) / 2 < p.y[1]); return q ? q.z : floor; });

  // ── the seats, run by run, by the plan's seating ──
  const seats = [], tables = [], racks = [], poles = [], rails = [], screens = [], displays = [], partitions = [], walls = [], equipment = [], lanes = [];
  const zb = P.back ? floor + P.back + (P.headrests ? 0.2 : 0) : zCeil - 0.1, xo = r4(minHw(floor, Math.min(zb, zCeil)) - 0.03), rowLen = (P.depth ?? 0) + BACK;
  const unitW = (n) => n * P.seat + 0.05;
  const row = (yb, f) => {
    const ya = f > 0 ? yb : yb - rowLen, yz = f > 0 ? yb + rowLen : yb;
    const [nl, nr] = P.abreast;
    seats.push({ kind: 'row', side: -1, facing: f, places: nl, x: [r4(-xo), r4(-xo + unitW(nl))], y: [r4(ya), r4(yz)], back: r4(yb), floor: lv });
    seats.push({ kind: 'row', side: 1, facing: f, places: nr, x: [r4(xo - unitW(nr)), r4(xo)], y: [r4(ya), r4(yz)], back: r4(yb), floor: lv });
  };
  const doorAt = (y) => zones.some((z) => (z.kind === 'door' || z.kind === 'vestibule') && (Math.abs(z.y[0] - y) < 1e-6 || Math.abs(z.y[1] - y) < 1e-6));
  let lv = floor;
  for (const [ri, [a, b]] of runs.entries()) {
    const len = b - a;
    lv = levels[ri];
    if (P.seating === 'longitudinal') {
      if (len < 0.92) continue;
      const wheel = P.wheelchair && ri === runs.reduce((best, r, i) => (Math.abs((r[0] + r[1]) / 2) < Math.abs((runs[best][0] + runs[best][1]) / 2) ? i : best), 0);
      for (const s of [1, -1]) {
        const x = s > 0 ? [r4(xo - P.depth), r4(xo)] : [r4(-xo), r4(-xo + P.depth)];
        if (wheel && s > 0) seats.push({ kind: 'perch', side: s, places: 0, wheelchair: 1, x: [r4(xo - 0.2), r4(xo)], y: [r4(a + 0.05), r4(b - 0.05)], floor: lv });
        else seats.push({ kind: 'bench', side: s, facing: -s, places: Math.floor((len - 0.1) / P.seat), x, y: [r4(a + 0.05), r4(b - 0.05)], floor: lv });
      }
      lanes.push({ y: [a, b], x: [r4(-xo + P.depth), r4(xo - P.depth)] });
    } else if (P.seating === 'bays') {
      const bay = P.pitch, n = Math.floor(len / bay);
      if (n === 0) {
        // (a run too short for a bay: one row, its back to the run's end away from the door, facing it)
        if (len >= rowLen + 0.3) { const backAtB = doorAt(a) && !doorAt(b); row(backAtB ? b : a, backAtB ? -1 : 1); }
      } else {
        const s0 = a + (len - n * bay) / 2;
        for (let k = 0; k < n; k += 1) {
          const s = s0 + k * bay;
          row(s, 1); row(s + bay, -1);
          if (P.tables) for (const sd of [1, -1]) tables.push({ side: sd, x: sd > 0 ? [r4(xo - 0.5), r4(xo)] : [r4(-xo), r4(-xo + 0.5)], y: [r4(s + bay / 2 - 0.3), r4(s + bay / 2 + 0.3)], z: r4(lv + 0.72), floor: lv });
        }
      }
      lanes.push({ y: [a, b], x: [r4(-xo + unitW(P.abreast[0])), r4(xo - unitW(P.abreast[1]))] });
    } else if (P.seating === 'airline') {
      // (rows from each end of the run facing its middle, a table bay where the two halves meet)
      let m = Math.floor(len / P.pitch) + 1;
      const gapOf = (k) => { const mR = Math.ceil(k / 2), mF = k - mR; return len - (mR ? (mR - 1) * P.pitch + rowLen : 0) - (mF ? (mF - 1) * P.pitch + rowLen : 0); };
      while (m > 0 && gapOf(m) < 0.62) m -= 1;
      const mR = Math.ceil(m / 2), mF = m - mR;
      for (let k = 0; k < mR; k += 1) row(a + k * P.pitch, 1);
      for (let k = 0; k < mF; k += 1) row(b - k * P.pitch, -1);
      if (P.tables && mR && mF) {
        const y0 = a + (mR - 1) * P.pitch + rowLen, y1 = b - (mF - 1) * P.pitch - rowLen, ym = (y0 + y1) / 2;
        for (const sd of [1, -1]) tables.push({ side: sd, x: sd > 0 ? [r4(xo - 0.5), r4(xo)] : [r4(-xo), r4(-xo + 0.5)], y: [r4(ym - Math.min(0.3, (y1 - y0) / 2 - 0.05)), r4(ym + Math.min(0.3, (y1 - y0) / 2 - 0.05))], z: r4(lv + 0.72), floor: lv });
      }
      lanes.push({ y: [a, b], x: [r4(-xo + unitW(P.abreast[0])), r4(xo - unitW(P.abreast[1]))] });
    } else if (P.seating === 'compartments') {
      // (the corridor down the left wall, compartments off it to the right: two facing benches, a door from the corridor)
      const xw = r4(-xo + P.corridor), comp = P.pitch, n = Math.floor(len / comp);
      if (n) {
        const s0 = r4(a + (len - n * comp) / 2), doorsIn = [];
        for (let k = 0; k <= n; k += 1) partitions.push({ kind: 'compartment', y: r4(s0 + k * comp), x: [r4(xw), r4(xo + 0.03)], opening: null });
        for (let k = 0; k < n; k += 1) {
          const s = s0 + k * comp, m = s + comp / 2;
          for (const [yb, f] of [[s + 0.03, 1], [s + comp - 0.03, -1]]) seats.push({ kind: 'bench', across: true, side: 1, facing: f, places: P.places, x: [r4(xw + 0.06), r4(xo)], y: f > 0 ? [r4(yb), r4(yb + rowLen)] : [r4(yb - rowLen), r4(yb)], back: r4(yb), floor: lv });
          tables.push({ side: 1, x: [r4(xo - 0.42), r4(xo)], y: [r4(m - 0.25), r4(m + 0.25)], z: r4(lv + 0.72), floor: lv });
          doorsIn.push([r4(m - 0.31), r4(m + 0.31)]);
        }
        walls.push({ kind: 'corridor', x: xw, y: [s0, r4(s0 + n * comp)], doors: doorsIn, glazed: [r4(floor + 0.95), r4(floor + 1.95)] });
      }
      lanes.push({ y: [a, b], x: [r4(-xo), r4(xw)] });
    } else {
      // (the machine room: its equipment down the middle in cabinets of seeded lengths, a corridor down each side)
      const rnd = mulberry32(hashSeed(`machine:${d.seed}:${ri}`)), x = [r4(-xo + P.corridor), r4(xo - P.corridor)];
      let y = a + 0.1;
      while (b - 0.1 - y > 0.6) {
        const l = Math.min(b - 0.1 - y, 1.2 + rnd() * 1.2), h = Math.min(zCeil - 0.12 - floor, 1.6 + rnd() * 0.5);
        equipment.push({ x, y: [r4(y), r4(y + l)], z: [r4(floor), r4(floor + h)] });
        y += l + 0.06;
      }
      lanes.push({ y: [a, b], x: [r4(-xo), x[0]] }, { y: [a, b], x: [x[1], r4(xo)] });
    }
  }
  // (a wheelchair bay in a plan with seats across: by the door nearest the car's middle, the right side's seats beside it
  //  given up for a padded perch at the wall)
  if (P.wheelchair && P.seating === 'bays') {
    const edges = zones.filter((z) => z.kind === 'door' || z.kind === 'vestibule').flatMap((z) => [[z.y[0], -1], [z.y[1], 1]])
      .filter(([y, s]) => runs.some(([a, b]) => Math.abs((s > 0 ? a : b) - y) < 1e-6)).sort((p, q) => Math.abs(p[0]) - Math.abs(q[0]));
    if (edges.length) {
      const [y, s] = edges[0], run = runs.find(([a, b]) => Math.abs((s > 0 ? a : b) - y) < 1e-6), bay = s > 0 ? [r4(y), r4(Math.min(run[1], y + 1.4))] : [r4(Math.max(run[0], y - 1.4)), r4(y)], hit = (q) => q.side > 0 && q.y[1] > bay[0] + 1e-6 && q.y[0] < bay[1] - 1e-6;
      for (const list of [seats, tables]) for (let i = list.length - 1; i >= 0; i -= 1) if (hit(list[i])) list.splice(i, 1);
      seats.push({ kind: 'perch', side: 1, places: 0, wheelchair: 1, x: [r4(xo - 0.2), r4(xo)], y: bay, floor: levels[runs.indexOf(run)] });
    }
  }
  // (the cab's own equipment behind the driver, when the cab is long enough to hold it)
  if (cab && cab.seats[0].y[0] - cab.partition > 1.3) for (const s of [1, -1]) {
    const y = [r4(cab.partition + 0.1), r4(Math.min(cab.seats[0].y[0] - 0.5, cab.partition + 2.2))], z = [cab.floor, r4(Math.min(cab.floor + 1.6, zCeil - 0.1))];
    const w = Math.min(insideHalfWidth(d, y[1], z[1]), insideHalfWidth(d, y[1], z[0])) - 0.02;
    if (w > 0.9) equipment.push({ cab: true, x: s > 0 ? [r4(w - 0.55), r4(w)] : [r4(-w), r4(-w + 0.55)], y, z });
  }

  // ── what to hold: poles at the doors' zones and the benches' ends, rails over the aisle, draft screens at the doors ──
  for (const z of zones.filter((q) => q.kind === 'door')) {
    if (P.poles) poles.push({ x: 0, y: r4((z.door[0] + z.door[1]) / 2) });
    if (P.displays) for (const s of [1, -1]) displays.push({ side: s, y: r4((z.door[0] + z.door[1]) / 2), z: r4(O.doorTop + 0.12) });
    for (const [y, sgn] of [[z.y[0], -1], [z.y[1], 1]]) {
      if (P.draft && runs.some(([a, b]) => Math.abs(sgn < 0 ? b - y : a - y) < 1e-6)) for (const s of [1, -1]) screens.push({ side: s, y: r4(y + sgn * 0.02), x: s > 0 ? [r4(xo - P.depth - 0.12), r4(xo)] : [r4(-xo), r4(-xo + P.depth + 0.12)], z: [r4(floor + 0.1), r4(floor + 1.85)] });
      if (P.poles && runs.some(([a, b]) => Math.abs(sgn < 0 ? b - y : a - y) < 1e-6)) {
        const lane = lanes.find((l) => l.y[0] <= y + sgn * 0.1 && l.y[1] >= y + sgn * 0.1);
        if (lane) for (const x of lane.x) poles.push({ x: r4(x + (x > 0 ? -0.08 : 0.08)), y: r4(y + sgn * 0.15) });
      }
    }
  }
  if (P.rails) for (const l of lanes) for (const x of l.x) rails.push({ x: r4(x + (x > 0 ? -0.1 : 0.1)), y: [r4(l.y[0]), r4(l.y[1])], z: r4(floor + 1.92) });
  if (P.racks) for (const l of P.seating === 'compartments' ? partitions.filter((q) => q.kind === 'compartment').slice(1).map((q) => ({ y: [r4(q.y - P.pitch + 0.03), r4(q.y - 0.03)] })) : lanes) {
    const zr = r4(O.win[1] + 0.14), xr = r4(hwIn(zr + 0.05) - 0.02);
    for (const s of P.seating === 'compartments' ? [1] : [1, -1]) racks.push({ side: s, x: s > 0 ? [r4(xr - 0.36), xr] : [r4(-xr), r4(-xr + 0.36)], y: [r4(l.y[0] + 0.1), r4(l.y[1] - 0.1)], z: zr });
  }
  // ── the partitions across: the vestibules' (an opening as wide as the plan's passage), the cab's, the ends' walls ──
  const passage = P.seating === 'compartments' ? [r4(-xo + 0.06), r4(-xo + P.corridor - 0.06)] : P.seating === 'machine' ? [r4(xo - P.corridor + 0.03), r4(xo - 0.03)] : null;
  const centre = (w) => [r4(-w / 2), r4(w / 2)];
  for (const z of zones.filter((q) => q.kind === 'vestibule')) {
    const y = z.y[0] === yRear ? z.y[1] : z.y[0];
    partitions.push({ kind: 'vestibule', y, opening: { x: passage ?? centre(P.seating === 'bays' ? 1.1 : 0.85), z: [r4(floor), r4(floor + 2.0)] } });
  }
  if (cab) partitions.push({ kind: 'cab', y: cab.partition, opening: { x: P.seating === 'machine' ? passage : centre(0.66), z: [r4(floor), r4(floor + 1.95)] } });
  for (const [y, , kind] of ends) { const [w, h] = END_OPENING[kind]; partitions.push({ kind: 'end', y, end: kind, opening: { x: centre(w), z: [r4(floor), r4(floor + h)] } }); }

  // ── the capacity: its places, its wheelchair bays, the people its free floor stands ──
  const seated = seats.reduce((t, s) => t + s.places, 0), wheelchair = seats.reduce((t, s) => t + (s.wheelchair || 0), 0);
  const standArea = P.standing ? zones.filter((z) => z.kind === 'door' || z.kind === 'vestibule').reduce((t, z) => t + (z.y[1] - z.y[0]) * 2 * xo, 0) + lanes.reduce((t, l) => t + (l.y[1] - l.y[0]) * (l.x[1] - l.x[0]), 0) : 0;
  const capacity = { seated, standing: Math.floor(standArea * P.standing), wheelchair };

  // ── the laws ──
  const box = (x, y, z) => [[x[0], y[0], z[0]], [x[1], y[0], z[0]], [x[0], y[1], z[0]], [x[1], y[1], z[0]], [x[0], y[0], z[1]], [x[1], y[0], z[1]], [x[0], y[1], z[1]], [x[1], y[1], z[1]]];
  const within = (p) => p[1] >= yRear - 1e-6 && p[1] <= (cab ? d.anchors.tip : yEnd) + 1e-6 && Math.abs(p[0]) <= insideHalfWidth(d, p[1], p[2]) + 1e-6;
  const solids = [...seats.map((s) => box(s.x, s.y, [s.floor, s.kind === 'perch' ? s.floor + 0.95 : s.floor + zb - floor])), ...tables.map((t) => box(t.x, t.y, [t.floor, t.z])),
    ...racks.map((r) => box(r.x, r.y, [r.z, r.z + 0.05])), ...equipment.map((e) => box(e.x, e.y, e.z)), ...washrooms.map((w) => box(w.x, w.y, [floor, floor + 2.1]))];
  const doorZones = zones.filter((z) => z.kind === 'door' || z.kind === 'vestibule').map((z) => z.door);
  const laneAt = (y) => { const l = lanes.filter((q) => y >= q.y[0] - 1e-6 && y <= q.y[1] + 1e-6); return l.length ? l.map((q) => q.x) : [[-xo, xo]]; };
  const overlap = (a, b) => Math.min(a[1], b[1]) - Math.max(a[0], b[0]);
  const laws = [
    { id: 'headroom', pass: zCeil - floor >= 1.95 },
    { id: 'aisle-wide', pass: lanes.every((l) => l.x[1] - l.x[0] >= P.aisle - 1e-6) },
    { id: 'doors-clear', pass: [...seats, ...tables, ...equipment.filter((e) => !e.cab), ...washrooms].every((s) => doorZones.every(([a, b]) => s.y[1] <= a - DOOR_CLEAR + 1e-6 || s.y[0] >= b + DOOR_CLEAR - 1e-6)) },
    { id: 'inside-lining', pass: solids.every((c) => c.every(within)) },
    { id: 'knee-room', pass: P.seating === 'airline' ? P.pitch - rowLen >= 0.3 : P.seating === 'bays' || P.seating === 'compartments' ? P.pitch - 2 * rowLen >= 0.5 : true },
    { id: 'passage-through', pass: partitions.filter((q) => q.opening).every((q) => q.opening.z[1] - q.opening.z[0] >= 1.9 && [q.y - 0.1, q.y + 0.1].every((y) => laneAt(y).some((l) => overlap(l, q.opening.x) >= 0.55 - 1e-6))) },
  ];
  laws.push(
    // (a podium over each bogie of a low floor, a step up to it no higher than one tread pair, standing headroom over it)
    { id: 'bogies-covered', pass: !low || d.frame.bogies.every((y, k) => podiums.some((q) => q.bogie === k) && (BG[k].pivot.z < (cab && y > cab.partition ? cab.floor : podiums[k].z))) },
    { id: 'podium-step', pass: podiums.every((q) => q.z - floor <= 0.6 && zCeil - q.z >= 1.9) },
  );
  if (cab) {
    const S = d.screen, [ex, ey, ez] = cab.eye, top = (() => { let z = ez; while (z < H && insideHalfWidth(d, ey, z) > 0.2) z += 0.02; return z; })();
    laws.push(
      { id: 'driver-eye', pass: ez > S.z0 && ez < S.z1 && frontAt(d, ex, ez) - ey >= 0.5 },
      { id: 'desk-inside', pass: box([-cab.desk.half, cab.desk.half], cab.desk.y, [cab.floor, cab.desk.z[1]]).every(within) },
      { id: 'cab-headroom', pass: top - ez >= 0.2 },
    );
  }
  const out = { version: INTERIOR_GRAMMAR_VERSION, plan: name, family, seed: d.seed, cab, span, lining: { thickness: LINING, floor, ceiling: zCeil, reach: xo },
    zones, runs, levels, podiums, lanes, seats, tables, racks, poles, rails, screens, displays, partitions, walls, equipment, washrooms, capacity, numbers: { ...P } };
  return frozen({ ...out, laws: frozen(laws.map(frozen)), valid: laws.every((l) => l.pass) });
}
