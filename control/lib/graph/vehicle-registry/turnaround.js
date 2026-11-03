/**
 * THE TURNAROUND: the airfield's ground crew set to work round a parked aircraft, each vehicle placed and posed to the
 * aircraft's own geometry, read off its form (craft-shelf/craft-form.js), not typed per type:
 *
 *   stairs        at its first door on the left (the passengers' side), its platform at that door's sill
 *   catering      at its first door on the right (the service side), its galley raised to that sill, its platform out
 *   belt loaders  at its holds on the right, low in the belly ahead of the wing and behind it, each belt's nose at a sill
 *   baggage tug   and its carts, a train parallel to the fuselage beyond the forward belt's tail
 *   fuel truck    on the right, clear ahead of the wing and its engine
 *   pushback tug  ahead of the nose gear, its open U toward it
 *
 * A vehicle whose reach a door is out of (a regional's sill below a stair truck's platform) or that has nothing to meet
 * (no doors, no nose gear) is left off. An airliner's crew is all of them; another aircraft's what it can use (a
 * transport's or a jet's fuel and pushback). Its colours are the aircraft's: a camo'd aircraft's crew in the field's
 * camo nearest the air's (the inverse of parked.js's), else the airside's white.
 *
 *   CREW_ROLES                      the rows a crew is made of, by their role in it
 *   craftService(archetype)         → { nose?, doors: [{ y, sill, h, x: { L, R } }], holds: [{ y, sill, x }], clear(x0, x1),
 *                                     tip, wingY }
 *                                     in the parked craft's frame (+y its nose, +x its right, its
 *                                     footprint centred, the ground z = 0)
 *   crewFor(archetype, words?)      → the crew's rows, by default its role's
 *   turnaround(craft, { crew?, livery?, seed? }) → parked entries ({ vehicle, at, heading, reach?, livery?, seed }) in the
 *                                     world, for the craft entry `craft` ({ craft, at, heading, livery? })
 *
 * Pure and deterministic. A craft's service read is memoised (it assembles the craft once).
 */
import { CRAFT_ARCHETYPES, CRAFT_ODM } from '../craft-shelf/index.js';
import { craftForm } from '../craft-shelf/craft-form.js';
import { VEHICLES as PHYSICS } from '../roads/vehicles.js';
import { AIRSIDE_REACH, reachFront } from '../car-designer/road-airside.js';
import { resolveVehicle, handlesOf } from './roster.js';

/** The rows a crew is made of, by their part in it. */
export const CREW_ROLES = Object.freeze({
  stairs: 'boarding-stairs', catering: 'catering-truck', belt: 'belt-loader', tug: 'baggage-tug', cart: 'baggage-cart', fuel: 'fuel-truck', pushback: 'pushback-tug',
});
const ROLE_OF = Object.freeze(Object.fromEntries(Object.entries(CREW_ROLES).map(([k, v]) => [v, k])));
// an aircraft's role → the crew it calls by default (an airliner's whole turnaround; anything else its fuel and its push)
const DEFAULT_CREW = Object.freeze({
  liner: Object.freeze(['stairs', 'catering', 'belt', 'belt', 'tug', 'cart', 'cart', 'fuel', 'pushback']),
  other: Object.freeze(['fuel', 'pushback']),
});
// a field camo from the air's pattern (parked.js's AIR_OF_CAMO, read back)
const CAMO_OF_AIR = Object.freeze({ wraparound: 'woodland', desert: 'desert', splinter: 'tiger', arctic: 'winter', counterShaded: 'urban' });
const GAP = 0.08;   // (a rubber nose short of the skin)
const r3 = (n) => Math.round(n * 1e3) / 1e3 + 0;

const memo = new Map();
/** What a turnaround reads of a parked craft: its nose gear, its doors and holds with their sills and the skin's x at
 *  them each side, and how far aft its wing and engines reach over a band of x. */
export function craftService(archetype) {
  if (memo.has(archetype)) return memo.get(archetype);
  const row = CRAFT_ARCHETYPES[archetype];
  if (!row) throw new Error(`turnaround: no archetype '${archetype}' on the shelf`);
  const { items } = craftForm(archetype, { attitude: 'ground', pose: { gear: 0 } });
  // (the parked frame: the footprint's centre in plan, as craftFootprint and the figure stand it)
  const all = items.flatMap((it) => it.faces.flatMap((f) => f.corners));
  const lo = [0, 1].map((k) => Math.min(...all.map((p) => p[k]))), hi = [0, 1].map((k) => Math.max(...all.map((p) => p[k])));
  const c = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2], at = (p) => [p[0] - c[0], p[1] - c[1], p[2]];
  const facesOf = (re) => items.filter((it) => re.test(it.id)).flatMap((it) => it.faces.map((f) => f.corners.map(at)));
  const pts = (re) => facesOf(re).flat();
  const hullFaces = facesOf(/^hull$/), hull = hullFaces.flat(), nosePts = pts(/^nose$/);
  const yNose = Math.max(...hull.map((p) => p[1])), L = yNose - Math.min(...hull.map((p) => p[1]));
  // the skin's ring at a station: its centre, half height; the skin's x at a height, each side
  // (the hull cut by the plane at y: each edge that crosses it, where it does)
  const ring = (y) => {
    const q = [];
    for (const F of hullFaces) for (let i = 0; i < F.length; i++) {
      const a = F[i], b = F[(i + 1) % F.length];
      if ((a[1] - y) * (b[1] - y) > 0 || a[1] === b[1]) continue;
      const t = (y - a[1]) / (b[1] - a[1]);
      q.push([a[0] + (b[0] - a[0]) * t, y, a[2] + (b[2] - a[2]) * t]);
    }
    const zs = q.map((p) => p[2]);
    return { q, z0: Math.min(...zs), z1: Math.max(...zs) };
  };
  // (the ring's points on one side, by height, read between the two either side of z)
  const skinX = (R, z, s) => {
    const q = R.q.filter((p) => Math.sign(p[0]) === s).sort((a, b) => a[2] - b[2] || Math.abs(b[0]) - Math.abs(a[0]));
    let best = 0;
    for (let i = 0; i + 1 < q.length; i++) {
      const [a, b] = [q[i], q[i + 1]];
      if (z < a[2] || z > b[2]) continue;
      const t = b[2] > a[2] ? (z - a[2]) / (b[2] - a[2]) : 0;
      best = Math.max(best, Math.abs(a[0]) + (Math.abs(b[0]) - Math.abs(a[0])) * t);
    }
    return best;
  };
  const doors = (hullRow(archetype)?.build?.doors ?? []).map(([sf, zf, w, h]) => {
    const y = yNose - sf * L, R = ring(y), cz = (R.z0 + R.z1) / 2, hh = (R.z1 - R.z0) / 2, sill = cz + zf * hh - h / 2;
    return { y: r3(y), sill: r3(sill), w, h, x: { L: r3(skinX(R, sill + 0.3, -1)), R: r3(skinX(R, sill + 0.3, 1)) } };
  });
  // what stands over a band of x on the right (the wing, its engine and pylon, the tailplane, the main gear): how far
  // forward it reaches
  // (by faces, so a wing lofted root to tip with nothing between still stands over the band: its face's foremost corner)
  const parts = facesOf(/^(wing|engine|pylon|stab)-r$|^main-r$/);
  const clear = (x0, x1) => {
    const q = parts.filter((F) => Math.max(...F.map((p) => p[0])) >= x0 && Math.min(...F.map((p) => p[0])) <= x1);
    return q.length ? Math.max(...q.flat().map((p) => p[1])) : -Infinity;
  };
  // the holds, low in the belly on the right: ahead of the wing, between it and the nose gear, and behind it
  const noseGear = nosePts.length ? [r3((Math.min(...nosePts.map((p) => p[0])) + Math.max(...nosePts.map((p) => p[0]))) / 2), r3((Math.min(...nosePts.map((p) => p[1])) + Math.max(...nosePts.map((p) => p[1]))) / 2)] : null;
  const wingRoot = pts(/^wing-r$/).filter((p) => p[0] < 4);
  const holds = [];
  if (noseGear && wingRoot.length && row.role === 'liner') {
    const le = Math.max(...wingRoot.map((p) => p[1])), te = Math.min(...wingRoot.map((p) => p[1]));
    for (const y of [le + (noseGear[1] - le) * 0.45, te - 1.6]) {
      const R = ring(y), sill = R.z0 + 0.35;
      holds.push({ y: r3(y), sill: r3(sill), x: r3(skinX(R, sill + 0.15, 1)) });
    }
  }
  const wingR = pts(/^wing-r$/), tip = wingR.length ? Math.max(...wingR.map((p) => p[0])) : 3, wingY = wingR.length ? (Math.min(...wingR.map((p) => p[1])) + Math.max(...wingR.map((p) => p[1]))) / 2 : 0;
  const out = Object.freeze({ nose: noseGear, doors, holds, clear, tip: r3(tip), wingY: r3(wingY), length: r3(L) });
  memo.set(archetype, out);
  return out;
}
// (the archetype's hull row, as the shelf lists it)
const hullRow = (archetype) => { const e = CRAFT_ARCHETYPES[archetype].layout.find((x) => x.id === 'hull'); return e ? CRAFT_ODM[e.sku] : null; };

/** The crew's rows: the words asked (each one of the ground crew), else the craft's role's. */
export function crewFor(archetype, words, at = 'crew') {
  if (words === undefined || words === true) {
    const role = CRAFT_ARCHETYPES[archetype]?.role === 'liner' ? 'liner' : 'other';
    return DEFAULT_CREW[role].map((r) => CREW_ROLES[r]);
  }
  if (!Array.isArray(words) || !words.length || words.length > 12) throw new Error(`${at} is true (its role's crew) or a list of 1 to 12 of the ground crew (${Object.values(CREW_ROLES).join(', ')})`);
  return words.map((w, k) => {
    const hit = typeof w === 'string' ? resolveVehicle(w) : null;
    if (!hit || !ROLE_OF[hit.id]) throw new Error(`${at}[${k}]: '${w}' is not one of the ground crew (${Object.values(CREW_ROLES).join(', ')})`);
    return hit.id;
  });
}

const classOf = (id) => handlesOf(id).physics[0];
const clampReach = (kind, z) => (z >= AIRSIDE_REACH[kind].range[0] - 1e-6 && z <= AIRSIDE_REACH[kind].range[1] + 1e-6 ? r3(z) : null);

/** The crew round a parked craft: parked entries in the world (each its place, heading and reach). */
export function turnaround(craft, { crew, livery, seed = 1 } = {}) {
  const S = craftService(craft.craft), rows = crewFor(craft.craft, crew);
  const paint = livery ?? (typeof craft.livery === 'string' && CAMO_OF_AIR[craft.livery] ? CAMO_OF_AIR[craft.livery] : undefined);
  const c = Math.cos(craft.heading ?? 0), s = Math.sin(craft.heading ?? 0);
  // (the craft's frame to the world's: x its right, y its nose; a vehicle's nose along d in it)
  const world = ([x, y], [dx, dy]) => {
    const p = [craft.at[0] + x * s + y * c, craft.at[1] - x * c + y * s], d = [dx * s + dy * c, -dx * c + dy * s];
    return { at: [r3(p[0]), r3(p[1]), craft.at[2]], heading: r3(Math.atan2(d[1], d[0])) };
  };
  const out = [], used = { belt: 0, cart: 0 };
  let beltTail = null, train = null;
  const put = (id, xy, dir, reach) => out.push({ vehicle: id, ...world(xy, dir), ...(reach !== undefined ? { reach } : {}), ...(paint !== undefined ? { livery: paint } : {}), seed: seed + out.length });
  for (const id of rows) {
    const role = ROLE_OF[id], cls = classOf(id), v = PHYSICS[cls];
    if (role === 'stairs' || role === 'catering') {
      // (the first door, the stairs on the left, the galley on the right, nose on to the skin)
      const d = S.doors[0], kind = role === 'stairs' ? 'stairs' : 'catering', side = role === 'stairs' ? -1 : 1;
      const reach = d && clampReach(kind, d.sill);
      if (!reach) continue;
      const front = reachFront(cls, reach), x = side * (d.x[side < 0 ? 'L' : 'R'] + GAP + front);
      put(id, [x, d.y], [-side, 0], reach);
    } else if (role === 'belt') {
      const h = S.holds[used.belt++], reach = h && clampReach('beltLoader', h.sill);
      if (!reach) continue;
      const front = reachFront(cls, reach), x = h.x + GAP + front;
      put(id, [x, h.y], [-1, 0], reach);
      if (beltTail === null) beltTail = { x: x + v.L / 2, y: h.y };
    } else if (role === 'tug' || role === 'cart') {
      // (a train parallel to the fuselage beyond the forward belt's tail, the tug ahead, its carts behind it)
      if (!beltTail) continue;
      if (!train) train = { x: beltTail.x + 1.4, y: beltTail.y + 1.2 };
      put(id, [train.x, train.y - v.L / 2], [0, 1]);
      train.y -= v.L + 0.35;
    } else if (role === 'fuel') {
      // (on the right beyond the baggage train, its tail clear ahead of whatever of the wing and its engine stands over its
      // band; with no train, beside the wing's tip)
      if (!train) { put(id, [S.tip + 2 + v.W / 2, S.wingY], [0, 1]); continue; }
      const x = train.x + 3.2, yTail = S.clear(x - v.W / 2 - 0.5, x + v.W / 2 + 0.5) + 1.2;
      put(id, [x, Number.isFinite(yTail) ? yTail + v.L / 2 : S.wingY], [0, 1]);
    } else if (role === 'pushback') {
      // (ahead of the nose gear, its open U toward it, two metres off)
      if (!S.nose) continue;
      put(id, [S.nose[0], S.nose[1] + 2 + v.L / 2], [0, 1]);
    }
  }
  return out;
}
