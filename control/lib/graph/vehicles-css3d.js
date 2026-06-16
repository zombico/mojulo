/**
 * vehicles-css3d — first-class CSS3D vehicles (cars / buses / trucks) for scenes.
 *
 * Built from the PRODUCTION swept-superellipse models (polygonizer/
 * vehicle-swept-net.js) via the multi-camera adapter (vehicles-swept.js): curved
 * bodies, baked liveries, coin wheels. Output is raw faces ready for the `faces`
 * passthrough of renderBoxCityToHtml, so any CSS3D scene can drop in a vehicle.
 *
 * The registry is annotated, extendable data. Each entry:
 *   net / family — which swept model to build
 *   class        — coarse family (car / truck / bus) for callers that group
 *   size         — intrinsic real-world size multiplier baked onto `scale`, so ONE
 *                  caller scale yields believable RELATIVE sizes across types (a tram
 *                  reads ~2.5× a bus without per-scene fudging). 1.0 = the net's own
 *                  proportions (already ~real for cars/vans/trucks).
 *   weight       — relative sampling frequency (the "ant" placement weights)
 *   contexts     — WHERE this vehicle may be SAMPLED. The annotation that keeps
 *                  non-city vehicles out of city sampling: a future 'cargo-plane'
 *                  with contexts:['airfield'] never matches 'lot'/'street', so the
 *                  city sampler skips it. (vehicleFaces() can still build any type.)
 * To add a vehicle: add a swept net (or another adapter) + ONE entry here.
 */

import { sweptFaces, fuselageFaces } from './vehicles-swept.js';
import { fuselageFootprint } from './polygonizer/vehicle-fuselage-net.js';
import { pickCarPaint, pickCarHull } from './polygonizer/vehicle-swept-net.js';
import { streetcarTrack, streetcarPlatform, roadRibbons, straightPath } from './roads.js';

// `paint:true` → the placement sampler gives this type a random factory color; every
// `class:'car'` type also gets a random hull variant (see vehicleAntFaces). Taxi keeps
// its yellow livery (no paint flag) but still varies its hull.
const VEHICLES = {
  sedan:    { net: 'sedan',     family: 'car',   class: 'car',      size: 1.0,  weight: 10, contexts: ['lot', 'street'], paint: true },
  suv:      { net: 'suv',       family: 'car',   class: 'car',      size: 1.0,  weight: 6,  contexts: ['lot', 'street'], paint: true },
  taxi:     { net: 'taxi',      family: 'car',   class: 'car',      size: 1.0,  weight: 3,  contexts: ['lot', 'street'] },
  boxVan:   { net: 'box-van',   family: 'box',   class: 'truck',    size: 1.0,  weight: 2,  contexts: ['lot', 'street'] },
  boxTruck: { net: 'box-truck', family: 'box',   class: 'truck',    size: 1.0,  weight: 2,  contexts: ['street'] },        // too long for car stalls
  cityBus:  { net: 'city-bus',  family: 'box',   class: 'bus',      size: 1.0,  weight: 1,  contexts: ['street', 'terminal'] },
  streetcar:{ net: 'streetcar', family: 'box',   class: 'tram',     size: 1.0,  weight: 1,  contexts: ['rail', 'terminal'] },   // articulated tram — bus cross-section, 2.5× bus length (baked into the net, no size multiplier)
  // ground-support equipment (GSE) — airfield-only; placed beside parked aircraft by the
  // hub planner, never sampled into city/street scenes (contexts gate it out).
  cateringTruck:  { net: 'catering-truck', family: 'box', class: 'truck', size: 1.0, weight: 1, contexts: ['airfield'] },    // hi-loader galley van
  opsWagon:       { net: 'station-wagon',  family: 'car', class: 'car',   size: 1.0, weight: 1, contexts: ['airfield'], paint: true },  // follow-me / ops estate
  beltLoader:     { net: 'belt-loader',    family: 'box', class: 'truck', size: 1.0, weight: 1, contexts: ['airfield'] },    // conveyor to the cargo hold
  boardingStairs: { net: 'boarding-stairs', family: 'box', class: 'truck', size: 1.0, weight: 1, contexts: ['airfield'] },   // passenger stairs to the door
  // aircraft — one net per class; the net's own proportions carry the size hierarchy
  airliner: { net: 'jet',       family: 'plane', class: 'aircraft', size: 1.0,  weight: 5,  contexts: ['airfield'] },        // narrowbody (curved swept fuselage)
  widebody: { net: 'widebody',  family: 'plane', class: 'aircraft', size: 1.0,  weight: 2,  contexts: ['airfield'] },        // jumbo
  regional: { net: 'regional',  family: 'plane', class: 'aircraft', size: 1.0,  weight: 3,  contexts: ['airfield'] },        // regional / continental hopper
  bizjet:   { net: 'bizjet',    family: 'plane', class: 'aircraft', size: 1.0,  weight: 2,  contexts: ['airfield'] },        // private jet
};

/** Every type name (buildable by name via vehicleFaces, regardless of context). */
export const VEHICLE_TYPES = Object.keys(VEHICLES);
/** Read-only metadata view (class / weight / contexts) for callers that introspect. */
export const VEHICLE_REGISTRY = Object.freeze(Object.fromEntries(
  Object.entries(VEHICLES).map(([k, v]) => [k, Object.freeze({ class: v.class, size: v.size ?? 1, weight: v.weight, contexts: Object.freeze([...v.contexts]) })]),
));
export function isVehicleType(t) { return Object.prototype.hasOwnProperty.call(VEHICLES, t); }

/** World footprint (length / wingspan / radius) of an aircraft type at a render
 *  scale — `size` baked in, matching vehicleFaces. null for non-plane types. */
export function aircraftFootprint(type, scale = 1) {
  const v = VEHICLES[type];
  if (!v || v.family !== 'plane') return null;
  return fuselageFootprint(v.net, scale * (v.size ?? 1));
}

/** Types eligible in a context (no context → all types). */
export function vehicleTypesFor(context) {
  return VEHICLE_TYPES.filter((t) => !context || VEHICLES[t].contexts.includes(context));
}

/** Weighted-random vehicle type for a context. `rng()` → [0,1). null if the pool is empty. */
export function sampleVehicleType(rng = Math.random, { context } = {}) {
  const pool = vehicleTypesFor(context);
  if (!pool.length) return null;
  const total = pool.reduce((s, t) => s + VEHICLES[t].weight, 0);
  let r = rng() * total;
  for (const t of pool) { r -= VEHICLES[t].weight; if (r <= 0) return t; }
  return pool[pool.length - 1];
}

/**
 * Build a vehicle as CSS3D faces, centred at (cx, cy) on the ground (z=0), facing
 * along `axis` ('x'|'y') in direction `dir` (+1/-1). `scale` resizes uniformly.
 * Optional `ns`/`na`/`quality` tune tessellation; `cull:true` is the cheaper
 * single-camera shell. Car-family finishes: `paint` (body hex) recolors the shell,
 * `hull` (variant name | multipliers) reshapes the silhouette. Feed the result to
 * renderBoxCityToHtml({ faces }).
 */
export function vehicleFaces({ type = 'sedan', cx = 0, cy = 0, axis = 'x', dir = 1, heading, scale = 1, ns, na, quality, cull, camHint, stations, angles, livery, paint, hull } = {}) {
  const v = VEHICLES[type] || VEHICLES.sedan;
  const s = scale * (v.size ?? 1);                                  // bake the intrinsic real-world size onto the caller's scale
  if (v.family === 'plane') return fuselageFaces({ net: v.net, cx, cy, axis, dir, heading, scale: s, quality, stations, angles, camHint, livery });
  return sweptFaces({ net: v.net, family: v.family, cx, cy, axis, dir, heading, scale: s, ns, na, quality, cull, paint, hull });
}

/**
 * The "ant" placement entry: SAMPLE a context-appropriate vehicle (weighted) and
 * build it at a pose. This is how scenes populate movable vehicles — non-city
 * types are excluded by their `contexts` annotation. Returns [] if no type fits.
 */
export function vehicleAntFaces({ rng = Math.random, context, cx = 0, cy = 0, axis = 'x', dir = 1, heading, scale = 1, ns, na, quality, cull, camHint } = {}) {
  const type = sampleVehicleType(rng, { context });
  if (!type) return [];
  const v = VEHICLES[type];
  const paint = v.paint ? pickCarPaint(rng).body : undefined;        // sedans/SUVs → random factory color
  const hull = v.class === 'car' ? pickCarHull(rng) : undefined;     // every car → random hull variant
  return vehicleFaces({ type, cx, cy, axis, dir, heading, scale, ns, na, quality, cull, camHint, paint, hull });
}

// point + heading at arc-length fraction f∈[0,1] along a polyline path [[x,y],...]
function sampleTrack(path, f) {
  const seg = [];
  let total = 0;
  for (let i = 1; i < path.length; i += 1) { const d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); seg.push(d); total += d; }
  let target = Math.max(0, Math.min(1, f)) * total;
  for (let i = 0; i < seg.length; i += 1) {
    if (target <= seg[i] || i === seg.length - 1) {
      const t = seg[i] ? target / seg[i] : 0, a = path[i], b = path[i + 1];
      return { cx: a[0] + (b[0] - a[0]) * t, cy: a[1] + (b[1] - a[1]) * t, heading: Math.atan2(b[1] - a[1], b[0] - a[0]) };
    }
    target -= seg[i];
  }
  return { cx: path[0][0], cy: path[0][1], heading: 0 };
}

/**
 * Place tram(s) ON a streetcar track: takes the SAME `path` waypoints fed to
 * `streetcarTrack`, sits each car on the rails, and noses it along the local
 * tangent. `positions` are arc-length fractions [0,1] along the path; `dir`
 * flips facing (use -1 for the return track). Returns faces for renderBoxCityToHtml.
 * This is the rail analogue of placeStreetCars — trams never ride car lanes, so
 * the `streetcar` type stays out of the 'street' sampling context.
 */
export function tramsOnTrack({ path, positions = [0.5], dir = 1, scale = 1, type = 'streetcar', quality, ns, na, camHint } = {}) {
  if (!Array.isArray(path) || path.length < 2) return [];
  const out = [];
  for (const f of positions) {
    const { cx, cy, heading } = sampleTrack(path, f);
    out.push(...vehicleFaces({ type, cx, cy, heading: dir < 0 ? heading + Math.PI : heading, scale, quality, ns, na, camHint }));
  }
  return out;
}

const TRAM_LEN_PER_SCALE = 20 * 0.35;          // streetcar net length × GLOBAL_K → world length per unit `scale`

/**
 * THE canonical way to depict a streetcar in a city scene: a symmetric CORRIDOR,
 * outside→in  road | bay | track+tram→ ←track+tram | bay | road. The centre is a
 * DOUBLE track (one streetcar each way) running the FULL [lo,hi] uninterrupted; a
 * one-way road flanks each side (opposing travel) with a boarding BAY (roofed
 * platform) between each road and the outer track; the bay→road separator is a hair
 * (`sep`). `axis` is the run direction ('y' → tracks at x≈fixed; 'x' → at y≈fixed).
 * `tracks` parallel rails (default 2) at `trackSep` spacing, each with `tramsPerTrack`
 * cars headed in alternating directions. Returns ribbons/boxes/grounds/faces for
 * renderBoxCityToHtml plus a `footprint` (reserve it so blocks never intrude).
 */
export function streetcarCorridor({
  axis = 'y', fixed = 0, lo = 0, hi = 10,
  roadWidth = 2.0, bayWidth = 0.7, sep = 0.04, trackGap = 0.85,
  tracks = 2, trackSep = 1.0, tramScale = 0.85, tramsPerTrack = 1,
  wireZ = 1.5, gauge = null, paved = true,
  stopAt = [0.32, 0.68], carScale = 0.85, cars = true, rng = Math.random,
} = {}) {
  const ribbons = [], boxes = [], grounds = [], faces = [];
  const span = Math.max(0.001, hi - lo);
  // rail-to-rail gauge tracks the tram body: rails sit ~65% out to the body edge
  // (streetcar body half-width = 1.16 × GLOBAL_K(0.35) × tramScale, i.e. bus width)
  const railGauge = gauge ?? +(1.3 * 1.16 * 0.35 * tramScale).toFixed(3);
  const trackHalf = (tracks - 1) * trackSep / 2;                    // outermost track offset from centre
  const bayInner = trackHalf + trackGap, roadInner = bayInner + bayWidth + sep;
  const roadCenter = roadInner + roadWidth / 2, halfW = roadInner + roadWidth;
  const W = (o, a) => (axis === 'y' ? [fixed + o, a] : [a, fixed + o]);   // across-offset o, along a → world point
  const segs = Math.max(3, Math.round(span / 1.5));
  // one paved deck under the whole track bundle (rails sit proud of it)
  if (paved) ribbons.push({ path: straightPath(W(0, lo), W(0, hi), segs), z0: 0.02, z1: 0.04, width: 2 * trackHalf + trackSep, tint: '#363b43' });
  // the parallel tracks — each rails + overhead wire + cantilever poles (poles on the
  // OUTER flank, tucked between the track and its bay) + a streetcar headed each way
  const gapF = (TRAM_LEN_PER_SCALE * tramScale + 0.3) / span;
  for (let i = 0; i < tracks; i += 1) {
    const off = -trackHalf + i * trackSep;
    const tpath = straightPath(W(off, lo), W(off, hi), segs);
    const track = streetcarTrack({ path: tpath, gauge: railGauge, deckWidth: 0.7, wireZ, poleEvery: 3, poleSide: off >= 0 ? 1 : -1, paved: false });
    ribbons.push(...track.ribbons); boxes.push(...track.boxes);
    const dir = i % 2 === 0 ? 1 : -1, base = 0.5 + (i - (tracks - 1) / 2) * 0.08;   // slight along-stagger so passing cars both read
    const positions = (tramsPerTrack <= 1 ? [base] : Array.from({ length: tramsPerTrack }, (_, k) => base + (k - (tramsPerTrack - 1) / 2) * gapF)).filter((p) => p > 0.02 && p < 0.98);
    faces.push(...tramsOnTrack({ path: tpath, positions, dir, scale: tramScale }));
  }
  // a one-way road on each flank (+ light traffic, opposing directions)
  for (const s of [-1, 1]) {
    const road = roadRibbons({ path: straightPath(W(s * roadCenter, lo), W(s * roadCenter, hi), segs), width: roadWidth, lanes: 1, laneLine: false, asphalt: '#3a414b' });
    ribbons.push(...road.ribbons);
    if (cars) for (let t = 0.06; t < 0.95; t += 0.12) {
      if (rng() < 0.5) continue;
      const p = W(s * roadCenter, lo + t * span);
      faces.push(...vehicleAntFaces({ rng, context: 'street', cx: p[0], cy: p[1], axis, dir: s > 0 ? 1 : -1, scale: carScale }));
    }
  }
  // boarding bays — a low roofed platform on each flank, outboard of the outer track
  for (const f of stopAt) {
    const p = W(0, lo + f * span);
    for (const s of [-1, 1]) {
      const stop = streetcarPlatform({ center: p, axis, side: s, length: Math.min(3.4, span * 0.3), width: bayWidth, trackGap: bayInner, height: 0.16, wallHeight: 1.4, wallThick: 0.12, scale: 1 });
      boxes.push(...stop.boxes); grounds.push(...stop.grounds);
    }
  }
  const footprint = axis === 'y'
    ? { x: fixed - halfW, y: lo, w: 2 * halfW, d: span }
    : { x: lo, y: fixed - halfW, w: span, d: 2 * halfW };
  return { ribbons, boxes, grounds, faces, footprint, halfW };
}
