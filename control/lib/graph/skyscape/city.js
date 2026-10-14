/**
 * THE MAP'S CITIES — a fractal city on a pilot's ground, as a metro reads from the air: blocks of plain rectangles,
 * tall at the core and falling away to its edge, on streets painted onto the ground.
 *
 * The city is the terrain world's (terrain/terrain-city.js): sited where the land allows a city, its unbuildable ground
 * reserved before its roads, graded onto a datum (a kernel `grade` layer, as a pad is), and seated mass by mass. Only
 * what a pilot needs differs:
 *
 *   detail     a pilot's eye resolves a block, not a lamp post: the whole plan is pruned to massing (the fractal
 *              city's own fidelity prune: the same buildings as plain extrusions, no street kit, no people), so the
 *              detail radius is 0 unless one is asked for
 *   size       a city is sized to the field (CITY_SHARE of its smaller side), not to a walk: a 440 m metro is a
 *              speck to a craft that crosses it in eight seconds
 *   siting     inside the field, clear of the pads and of each runway's climb-out (a tower in the departure is the
 *              cliff the pad siting already refuses)
 *   roofs      the towers are obstacles: `topAt(x, y)` is the ground or the roof over it, whichever is higher, on a
 *              ROOF_CELL grid of each city's tallest mass per cell, and the course and the autopilot keep clear of it
 *
 *   masses     on the live page each mass is one instance of a lit unit box (its walls and its roof two instanced
 *              meshes, tinted with the mass's own facade and roof), down to the lowest ground under it (its plinth):
 *              thousands of masses are a few numbers each, not eight lit faces. Exports take the seated faces.
 *
 *   readCityAsk(list) → errors; prepareCities(map, field, list, pads) → preps; seatCities(preps, graded) → { faces,
 *   repeats, cities, topAt }
 *
 * `at` is [u, v] in the field (as a pad's), not metres. Pure, deterministic.
 */
import { validateTerrainCities, prepareCity, seatCity, cityLight } from '../terrain/terrain-city.js';
import { assembleBoxCityScene } from '../scene/scene-css3d.js';
import { FLAT_LIGHT } from '../polygonizer/vexar.js';

/** A city's side when none is asked, as a share of the field's smaller side, and its bounds (m). */
export const CITY_SHARE = 0.3, CITY_SIDE = Object.freeze([600, 2400]);
/** The roof grid's cell (m): a tower's footprint is a few cells, so a gate never threads between two roofs it cannot. */
export const ROOF_CELL = 10;
/** The climb-out kept clear of towers: its run past the runway's end (m) and its half-width (m). */
export const CLIMB_OUT = Object.freeze({ run: 2500, half: 300 });

const isUV = (p) => Array.isArray(p) && p.length === 2 && p.every((v) => Number.isFinite(v) && v >= 0 && v <= 1);
const r2 = (v) => Math.round(v * 100) / 100;

/** Errors (strings) for `ground.cities`; [] when they lay. */
export function readCityAsk(list, at = 'ground.cities') {
  if (list === undefined) return [];
  if (!Array.isArray(list) || list.length > 3) return [`${at} must be a list of at most 3 { at?: [u, v], size?, profile?, seed?, detail?, flavor?, landmark? }`];
  const e = [];
  list.forEach((c, i) => { if (c && typeof c === 'object' && c.at !== undefined && !isUV(c.at)) e.push(`${at}[${i}].at must be [u, v] in the field, each 0–1 (omit it and the city is sited on the flattest dry ground)`); });
  if (list.some((c) => c && typeof c === 'object' && c.ref !== undefined)) e.push(`${at}: a stored city ({ ref }) is not read here; give the recipe inline`);
  // the terrain world's own checks, on the recipe without the field-relative `at`
  e.push(...validateTerrainCities(list.map((c) => (c && typeof c === 'object' ? (({ at: _a, ...r }) => r)(c) : c)), at));
  return e;
}

/** The default side (m) of a city on this map. */
export const citySide = (F) => Math.round(Math.min(CITY_SIDE[1], Math.max(CITY_SIDE[0], CITY_SHARE * 2 * Math.min(F.hx, F.hy))) / 10) * 10;

/**
 * Each city prepared on the natural ground: placed (at [u, v], or sited in the field clear of the pads and their
 * climb-outs and of the cities before it), reserved and graded. → preps (terrain-city's), each with its grade layer.
 */
export function prepareCities(map, field, list, pads = []) {
  if (!list || !list.length) return [];
  const F = map.rings.field, side = citySide(F);
  // a field: what terrain-city sites over (siteBounds), the field's ring less a margin, so a city stays in it
  const m = 0.05 * Math.min(F.hx, F.hy);
  const site = { ...field, siteBounds: { x: [-F.hx + m, F.hx - m], y: [-F.hy + m, F.hy - m] } };
  // taken: [cx, cy, w, d] — the pads (with their falloff) and each runway's climb-out
  const taken = [];
  for (const p of pads) {
    taken.push([(p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, p.x1 - p.x0 + 2 * p.falloff, p.y1 - p.y0 + 2 * p.falloff]);
    if (p.kind === 'runway' && p.depart) {
      const half = p.length / 2, run = CLIMB_OUT.run, c = (half + run / 2) * p.depart, [cx, cy] = p.center;
      taken.push(p.along === 'x' ? [cx + c, cy, run, 2 * CLIMB_OUT.half] : [cx, cy + c, 2 * CLIMB_OUT.half, run]);
    }
  }
  return list.map((c, i) => {
    const spec = { profile: 'metro', size: side, detail: { radius: 0 }, ...c };
    if (isUV(c.at)) spec.at = [-F.hx + c.at[0] * 2 * F.hx, -F.hy + c.at[1] * 2 * F.hy];
    const prep = prepareCity(site, spec, { index: i, taken });
    taken.push([prep.center[0], prep.center[1], prep.rect.w, prep.rect.d]);
    return prep;
  });
}

/**
 * Each city seated on the graded ground (the field with every pad's and city's layer): its masses' faces, a report,
 * and `topAt`, the ground or the roof over it.
 */
export function seatCities(preps, graded) {
  if (!preps.length) return { faces: [], repeats: [], cities: [], topAt: graded.groundAt };
  const light = cityLight(graded), faces = [], roofs = [], cities = [], walls = [], tops = [], formed = [];
  for (const prep of preps) {
    const s = seatCity(prep, graded, { light });
    for (const f of s.faces) faces.push(f);
    // the live page's masses: each seat's box (the plan's, matched by its footprint) as a unit box's transform
    const byRect = new Map(s.plan.boxes.map((b) => [`${b.x},${b.y},${b.w},${b.d}`, b])), mpu = prep.mpu, R0 = prep.rect;
    for (const q of s.seats) {
      const b = byRect.get(`${q.x},${q.y},${q.w},${q.d}`); if (!b) continue;
      const X = R0.x0 + (q.x + q.w / 2) * mpu, Y = R0.y0 + (q.y + q.d / 2) * mpu, z0 = Math.min(q.seat, q.low - 0.3), z1 = q.seat + q.height;
      if (b.class === 'landmark' || b.class === 'religious' || b.class === 'civic') {   // a form of its own keeps it
        for (const f of assembleBoxCityScene({ boxes: [b], grounds: [], ribbons: [], faces: [], light }).faces) formed.push({ ...f, corners: f.corners.map((c) => [R0.x0 + c[0] * mpu, R0.y0 + c[1] * mpu, q.seat + c[2] * mpu]), group: 'city' });
        continue;
      }
      const [roof, side] = massColours({ ...b, lod: 'mass' }), at = { pos: [r2(X), r2(Y), r2(z0)], scale: [r2(q.w * mpu), r2(q.d * mpu), r2(z1 - z0)] };
      walls.push({ ...at, tint: side }); tops.push({ ...at, tint: roof });
    }
    // the roof grid: each cell the tallest roof standing on it (the seat plus the mass's height), else -Infinity
    const R = prep.rect, nx = Math.ceil(R.w / ROOF_CELL), ny = Math.ceil(R.d / ROOF_CELL), top = new Float32Array(nx * ny).fill(-Infinity);
    let tallest = 0;
    for (const q of s.seats) {
      const z = q.seat + q.height; tallest = Math.max(tallest, q.height);
      const i0 = Math.max(0, Math.floor((q.x * prep.mpu) / ROOF_CELL)), i1 = Math.min(nx - 1, Math.floor(((q.x + q.w) * prep.mpu) / ROOF_CELL));
      const j0 = Math.max(0, Math.floor((q.y * prep.mpu) / ROOF_CELL)), j1 = Math.min(ny - 1, Math.floor(((q.y + q.d) * prep.mpu) / ROOF_CELL));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (z > top[j * nx + i]) top[j * nx + i] = z;
    }
    roofs.push({ x0: R.x0, y0: R.y0, nx, ny, top });
    cities.push({ center: prep.center.map(r2), size: [r2(R.w), r2(R.d)], profile: prep.profile, sited: prep.sited, masses: s.stats.masses, tallest: r2(tallest), faces: s.faces.length, grade: prep.grade.stats, detail: s.stats.detail });
  }
  const topAt = (x, y) => {
    let z = graded.groundAt(x, y);
    for (const r of roofs) {
      const i = Math.floor((x - r.x0) / ROOF_CELL), j = Math.floor((y - r.y0) / ROOF_CELL);
      if (i >= 0 && j >= 0 && i < r.nx && j < r.ny) { const t = r.top[j * r.nx + i]; if (t > z) z = t; }
    }
    return z;
  };
  const repeats = walls.length ? [
    { group: 'city:walls', template: unitBox(graded.K.light, 'walls'), transforms: walls },
    { group: 'city:roofs', template: unitBox(graded.K.light, 'roof'), transforms: tops },
  ] : [];
  return { faces, repeats, formed, cities, topAt, roofs: roofs.map(packRoofs) };
}

/** A roof grid for the page: its origin and cell, and each cell's roof as decimetres over `base` (Uint16, base64; 0 is
 *  no roof). The page's flight block counts it as ground, so a tower is something a craft can hit. */
function packRoofs(r) {
  let lo = Infinity; for (const t of r.top) if (t > -Infinity && t < lo) lo = t;
  const base = Number.isFinite(lo) ? Math.floor(lo) - 1 : 0, q = new Uint16Array(r.top.length);
  for (let k = 0; k < q.length; k++) q[k] = r.top[k] > -Infinity ? Math.min(65535, Math.max(1, Math.round((r.top[k] - base) * 10))) : 0;
  return { x0: r2(r.x0), y0: r2(r.y0), cell: ROOF_CELL, nx: r.nx, ny: r.ny, base, q: Buffer.from(q.buffer).toString('base64') };
}

// sRGB hex → linear rgb: an instance's tint multiplies the template's (linear) vertex colour on the page
const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const linHex = (h) => [1, 3, 5].map((k) => Math.round(lin(parseInt(h.slice(k, k + 2), 16)) * 1e4) / 1e4);
/** A mass's roof and facade colours, unlit (its massing faces under a flat light). → [roof, side], linear rgb */
function massColours(b) {
  const f = assembleBoxCityScene({ boxes: [{ ...b, z0: 0, z1: Math.max(0.1, b.z1 - (b.z0 || 0)) }], grounds: [], ribbons: [], faces: [], light: FLAT_LIGHT }).faces;
  const flat = (x) => x.corners.every((c) => Math.abs(c[2] - x.corners[0][2]) < 1e-6);
  const hex = (x) => (x && typeof x.fill === 'string' && /^#[0-9a-f]{6}/i.test(x.fill) ? x.fill : '#a9b0b8');
  const top = f.filter(flat).sort((a, b) => b.corners[0][2] - a.corners[0][2])[0], side = f.find((x) => !flat(x));
  return [linHex(hex(top)), linHex(hex(side))];
}
/** The unit box (x, y −½…½, z 0…1): its four walls or its roof, each face grey at the sun's light on it (ambient and
 *  diffuse as the city's), so an instance's tint is its colour lit. */
function unitBox(sun, part) {
  const L = Math.hypot(...sun), l = sun.map((v) => v / L);
  const grey = (n) => { const k = Math.round(255 * Math.min(1, 0.5 + 0.5 * Math.max(0, n[0] * l[0] + n[1] * l[1] + n[2] * l[2]))); const h = k.toString(16).padStart(2, '0'); return `#${h}${h}${h}`; };
  if (part === 'roof') return [{ corners: [[-0.5, -0.5, 1], [0.5, -0.5, 1], [0.5, 0.5, 1], [-0.5, 0.5, 1]], fill: grey([0, 0, 1]) }];
  const q = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
  return q.map((a, i) => { const b = q[(i + 1) % 4], n = [b[1] - a[1], a[0] - b[0], 0]; return { corners: [[a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], 1], [a[0], a[1], 1]], fill: grey(n) }; });
}
