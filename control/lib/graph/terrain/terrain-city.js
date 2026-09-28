/**
 * terrain-city — a fractal city standing on a terrain world's ground.
 *
 * The fractal city's own order, carried onto land:
 *
 *   1. SITE. The city's footprint (metres) goes where the land allows a city: `at`, or by score over the world's ground
 *      (the share it can build on, how flat that is, water within reach), clear of cities already sited.
 *   2. RESERVE BEFORE ROADS. Ground a city cannot build on (a datum steeper than `grade.max`, a cliff, a talus apron,
 *      water) is merged into rectangles and handed to the planner as operator blocks with `use: 'empty'`: claimed
 *      before the road skeleton runs, so the streets flank it and nothing is built on it. It keeps its natural ground.
 *   3. GRADE. The city stands on a datum: the natural ground (no detail) smoothed at half a block by a normalised
 *      convolution over the buildable ground only (a cliff beside the city does not pull its streets up), held above
 *      the water. It becomes a grade layer in the kernel (terrain-kernel.js `K.grade`), so the terrain under the city
 *      IS the datum, softened into the natural ground over one cell (an embankment).
 *   4. SEAT. Each mass is assembled on its own (per-box assembly equals the whole city's, face for face) and lifted
 *      rigidly: its floor at the datum where its front door meets the street (its centre when it fronts nothing), a
 *      stone plinth down to the lowest ground under it when the land falls away. What stands against a mass (its
 *      entrances, stoops, cornices) rides with it; the rest of the street kit stands on the datum at its own centre.
 *      The ground layer (streets, walks, lots, lawns) is clipped on a shared grid, so neighbours cut at the same
 *      points, and draped. Towers keep to the flat: on a datum steeper than 8 % a mass keeps at most 6 floors, over
 *      15 % at most 4.
 *   5. SPRAWL. A city wider than DETAIL_ALL is planned whole, once, and keeps full detail within `detail.radius` of its
 *      core (a metro's height-field core, else its centre); beyond it the planner's own fidelity prune takes it to
 *      massing: the same buildings, as plain extrusions, on the same streets, without the street kit or the people.
 *      Fidelity is a prune of one plan (fractal-city.js), so the skyline does not change where the detail stops.
 *      The whole ground plan (streets, walks, lots, lawns) is also painted onto the grade layer on a grid, so the
 *      terrain itself wears the city's streets; only within the detail radius do they come as draped faces too.
 *
 * Everything the planner makes is in city units (CITY_METERS_PER_UNIT metres); everything here returns metres, the
 * terrain world's frame, with the footprint's city-frame origin at its south-west corner.
 */
import { planFractalCity, pruneFidelity, CITY_METERS_PER_UNIT, normalizeCityBlocks, expandCityBlockMap } from '../city/fractal-city.js';
import { assembleBoxCityScene } from '../scene/scene-css3d.js';
import { makeLight } from '../polygonizer/vexar.js';

export const CITY_PROFILES = Object.freeze(['city', 'town', 'metro']);
export const CITY_SIZES = Object.freeze({ city: [220, 132], town: [240, 160], metro: [440, 290] });   // metres, the default footprint per profile
export const CITY_GRADE_DEFAULTS = Object.freeze({ max: 0.2, cliff: 0.6, freeboard: 1.5 });
const HALF_BLOCK = { city: 15, town: 15, metro: 45 };     // metres: the datum's smoothing (σ), half a block of the profile
const CELL_UNITS = 2;                                    // the grade grid's cell, city units (7.3 m)
const DRAPE_UNITS = 1;                                   // the ground layer's clip grid, city units (3.7 m)
const MASS = new Set(['building', 'anchor', 'midtower', 'townhouse', 'house', 'garage']);
const SINK = 0.12;                                       // metres a mass's floor sits below the datum at its seat
const PLINTH = { min: 0.3, tint: '#8e877b' };            // a plinth when the ground falls this far below the floor
const FLOOR_CAPS = [[0.15, 4], [0.08, 6]];               // datum slope over → at most this many floors
const GROUND_LIFT = 0.03;                                // metres the ground layer rides above the datum
const FAR = { drape: 4, lift: 0.12 };                    // beyond the detail radius: the clip grid (units) and lift (metres)
const DETAIL_ALL = 600;                                  // metres: a footprint no wider than this is full detail throughout
const DETAIL_RADIUS = 200;                               // metres of full detail around a larger city's core
const PAINT_UNITS = 1.5;                                 // the painted ground plan's texel, city units (5.5 m)

// a mass's front face: '+y' … on buildings, 'y+' … on a town's houses (the planner's two vocabularies)
const FRONT = { '+y': '+y', '-y': '-y', '+x': '+x', '-x': '-x', 'y+': '+y', 'y-': '-y', 'x+': '+x', 'x-': '-x' };
const isPt = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);

/** Errors (strings) for `cities`; a `{ ref }` entry passes here and is checked where it resolves. */
export function validateTerrainCities(list, at = 'terrain.cities') {
  if (list === undefined) return [];
  if (!Array.isArray(list)) return [`${at} must be a list of { at?, size?, profile?, seed?, grade?, … } or { ref, at? }`];
  const e = [];
  list.forEach((c, i) => {
    const here = `${at}[${i}]`;
    if (!c || typeof c !== 'object' || Array.isArray(c)) { e.push(`${here} must be an object (a fractal-city recipe, or { ref })`); return; }
    if (c.ref !== undefined && (typeof c.ref !== 'string' || !c.ref)) e.push(`${here}.ref must name a stored fractal-city sketch`);
    if (c.at !== undefined && !isPt(c.at)) e.push(`${here}.at must be [x, y] in metres (omit it and the city is sited on the flattest dry ground)`);
    const sz = c.size; if (sz !== undefined && !(Number.isFinite(sz) && sz >= 60 && sz <= 4000) && !(Array.isArray(sz) && sz.length === 2 && sz.every((v) => Number.isFinite(v) && v >= 60 && v <= 4000))) e.push(`${here}.size must be metres (60–4000), or [width, depth]`);
    if (c.profile !== undefined && !CITY_PROFILES.includes(c.profile)) e.push(`${here}.profile must be one of ${CITY_PROFILES.join(', ')} (a canal city carries its own water; not on terrain)`);
    if (c.detail !== undefined && !(c.detail && typeof c.detail === 'object' && (c.detail.radius === undefined || (Number.isFinite(c.detail.radius) && c.detail.radius >= 0)))) e.push(`${here}.detail must be { radius } (metres of full detail around the city's core; beyond it, massing)`);
    const g = c.grade;
    if (g !== undefined) {
      if (!g || typeof g !== 'object') e.push(`${here}.grade must be { max?, cliff? }`);
      else {
        if (g.max !== undefined && !(Number.isFinite(g.max) && g.max >= 0.02 && g.max <= 0.5)) e.push(`${here}.grade.max must be a slope 0.02–0.5 (rise over run; 0.2 default): steeper ground is left unbuilt`);
        if (g.cliff !== undefined && !(Number.isFinite(g.cliff) && g.cliff >= 0.1 && g.cliff <= 3)) e.push(`${here}.grade.cliff must be a slope 0.1–3 (0.6 default): natural ground steeper than this is a cliff`);
      }
    }
  });
  return e;
}

/** `{ ref }` entries → the stored fractal-city's recipe under the entry's own keys; inline entries pass through. */
export async function resolveTerrainCities(list) {
  if (!Array.isArray(list) || !list.some((c) => c && typeof c.ref === 'string')) return list;
  const { SketchRepository } = await import('@/lib/db/repositories/sketches');
  return list.map((c) => {
    if (!c || typeof c.ref !== 'string') return c;
    const src = SketchRepository.getByRef(c.ref);
    if (!src) throw new Error(`terrain.cities: ref '${c.ref}' is not a stored sketch`);
    if (src.manifest?.kind !== 'fractal-city') throw new Error(`terrain.cities: ref '${c.ref}' is a ${src.manifest?.kind || 'sketch'}, not a fractal-city`);
    if (src.manifest.profile === 'canal') throw new Error(`terrain.cities: ref '${c.ref}' is a canal city, which carries its own water; not on terrain`);
    const { ref, ...own } = c; void ref;
    const { kind, title, ...recipe } = src.manifest; void kind; void title;
    return { ...recipe, ...own };
  });
}

/** The footprint in metres: `size`, else the recipe's own region, else the profile's default. */
export function cityFootprint(c, mpu = CITY_METERS_PER_UNIT) {
  if (Array.isArray(c.size)) return [c.size[0], c.size[1]];
  if (Number.isFinite(c.size)) return [c.size, c.size];
  if (c.region && Number.isFinite(c.region.w) && Number.isFinite(c.region.d)) return [c.region.w * mpu, c.region.d * mpu];
  return CITY_SIZES[c.profile || 'city'].slice();
}

// ── the land test ────────────────────────────────────────────────────────────────────────────────────────────────
function natural(field, X, Y, e, g) {
  const k = field.kernel, z = k.baseAt(X, Y);
  const gx = (k.baseAt(X + e, Y) - k.baseAt(X - e, Y)) / (2 * e), gy = (k.baseAt(X, Y + e) - k.baseAt(X, Y - e)) / (2 * e);
  const sea = k.seaZ, wet = k.waterAt ? k.waterAt(X, Y) !== null : false;
  const ok = !wet && Math.hypot(gx, gy) <= g.cliff && (sea === null || z > sea + 0.5 * g.freeboard) && k.looseAt(X, Y) < 0.3;
  return { z, slope: Math.hypot(gx, gy), ok };
}

/**
 * Where a city of `size` metres goes on this ground: the lattice point (half the footprint's short side apart, over
 * the world's bounds) whose footprint is most buildable and flattest, with water within reach, clear of `taken`.
 */
export function siteCity(field, size, { grade = CITY_GRADE_DEFAULTS, taken = [] } = {}) {
  const [W, D] = size, b = field.siteBounds || field.bounds, step = Math.max(40, Math.min(W, D) / 2);   // a composed world sites on its finest level
  const g = { ...CITY_GRADE_DEFAULTS, ...grade }; const sea = field.kernel.seaZ;
  let best = null;
  for (let y = b.y[0] + D / 2; y <= b.y[1] - D / 2 + 1e-9; y += step) {
    for (let x = b.x[0] + W / 2; x <= b.x[1] - W / 2 + 1e-9; x += step) {
      if (taken.some((r) => Math.abs(r[0] - x) < (r[2] + W) / 2 && Math.abs(r[1] - y) < (r[3] + D) / 2)) continue;
      let ok = 0, n = 0, slope = 0, wet = false;
      for (let j = 0; j <= 6; j++) for (let i = 0; i <= 8; i++) {
        const X = x - W / 2 + (W * i) / 8, Y = y - D / 2 + (D * j) / 6, p = natural(field, X, Y, 6, g); n++;
        if (p.ok && p.slope <= g.max) { ok++; slope += p.slope; }
      }
      for (let a = 0; a < 12 && !wet; a++) { const r = 0.5 * Math.hypot(W, D) + 150, X = x + r * Math.cos(a * Math.PI / 6), Y = y + r * Math.sin(a * Math.PI / 6); if ((sea !== null && field.kernel.baseAt(X, Y) < sea) || (field.kernel.waterAt && field.kernel.waterAt(X, Y) !== null)) wet = true; }
      const frac = ok / n, score = frac - (ok ? 0.5 * (slope / ok) / g.max : 1) + (wet ? 0.15 : 0);
      if (!best || score > best.score + 1e-12) best = { at: [x, y], score, frac };
    }
  }
  if (!best) throw new Error(`terrain.cities: a city of ${Math.round(W)} × ${Math.round(D)} m does not fit on this world's ground; give it a smaller size or an 'at'`);
  return best;
}

// separable gaussian over a grid (edges clamp)
function blur(a, nx, ny, sigma) {
  if (!(sigma > 0)) return Float64Array.from(a);
  const r = Math.ceil(3 * sigma), k = []; let s = 0; for (let i = -r; i <= r; i++) { const v = Math.exp(-(i * i) / (2 * sigma * sigma)); k.push(v); s += v; }
  for (let i = 0; i < k.length; i++) k[i] /= s;
  const t = new Float64Array(nx * ny), o = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { let v = 0; for (let q = -r; q <= r; q++) v += k[q + r] * a[j * nx + Math.min(nx - 1, Math.max(0, i + q))]; t[j * nx + i] = v; }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { let v = 0; for (let q = -r; q <= r; q++) v += k[q + r] * t[Math.min(ny - 1, Math.max(0, j + q)) * nx + i]; o[j * nx + i] = v; }
  return o;
}
// the datum: the natural ground smoothed over the ground marked in m only (a normalised convolution)
function datum(z0, m, nx, ny, sigma) {
  const num = new Float64Array(nx * ny); for (let k = 0; k < nx * ny; k++) num[k] = z0[k] * m[k];
  const a = blur(num, nx, ny, sigma), b = blur(Float64Array.from(m), nx, ny, sigma), out = new Float64Array(nx * ny);
  for (let k = 0; k < nx * ny; k++) out[k] = b[k] > 0.05 ? a[k] / b[k] : z0[k];
  return out;
}
const slopeOf = (z, nx, ny, i, j, cell) => {
  const zx = (z[j * nx + Math.min(nx - 1, i + 1)] - z[j * nx + Math.max(0, i - 1)]) / (cell * (Math.min(nx - 1, i + 1) - Math.max(0, i - 1)));
  const zy = (z[Math.min(ny - 1, j + 1) * nx + i] - z[Math.max(0, j - 1) * nx + i]) / (cell * (Math.min(ny - 1, j + 1) - Math.max(0, j - 1)));
  return Math.hypot(zx, zy);
};

/**
 * The grade of a city at footprint `rect` ({ x0, y0, w, d } metres): the kernel's grade layer, the ground reserved
 * from building as rectangles in metres, and what was measured.
 */
export function gradeCity(field, rect, { profile = 'city', grade = {}, mpu = CITY_METERS_PER_UNIT, ramp } = {}) {
  const g = { ...CITY_GRADE_DEFAULTS, ...grade }, cell = CELL_UNITS * mpu, sigma = (HALF_BLOCK[profile] || 15) / cell;
  const mi = Math.max(2, Math.ceil(2 * sigma)), x0 = rect.x0 - mi * cell, y0 = rect.y0 - mi * cell;
  const nx = Math.ceil(rect.w / cell) + 2 * mi + 1, ny = Math.ceil(rect.d / cell) + 2 * mi + 1, N = nx * ny;
  const z0 = new Float64Array(N), nat = new Uint8Array(N), inside = new Uint8Array(N);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const X = x0 + i * cell, Y = y0 + j * cell, k = j * nx + i, p = natural(field, X, Y, cell / 2, g);
    z0[k] = p.z; nat[k] = p.ok ? 1 : 0;
    inside[k] = X >= rect.x0 - 1e-6 && X <= rect.x0 + rect.w + 1e-6 && Y >= rect.y0 - 1e-6 && Y <= rect.y0 + rect.d + 1e-6 ? 1 : 0;
  }
  // two passes: smooth over the dry, gentle ground; then drop what the smoothed ground still finds too steep
  const d1 = datum(z0, nat, nx, ny, sigma), m = new Uint8Array(N);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) m[j * nx + i] = nat[j * nx + i] && slopeOf(d1, nx, ny, i, j, cell) <= g.max ? 1 : 0;
  const D = datum(z0, m, nx, ny, sigma); const sea = field.kernel.seaZ;
  if (sea !== null) for (let k = 0; k < N; k++) if (m[k] && D[k] < sea + g.freeboard) D[k] = sea + g.freeboard;
  const build = new Uint8Array(N); let nIn = 0, nBuild = 0, worst = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i; if (!inside[k]) continue; nIn++;
    if (m[k]) { build[k] = 1; nBuild++; worst = Math.max(worst, slopeOf(D, nx, ny, i, j, cell)); }
  }
  // the weight: 1 on the built ground, softened over one cell into the natural ground (an embankment)
  const w = new Uint8Array(N);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let s = 0, c = 0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue; s += build[jj * nx + ii]; c++; }
    w[j * nx + i] = build[j * nx + i] ? 255 : Math.round((255 * s) / c / 2);
  }
  let lo = Infinity, hi = -Infinity; for (let k = 0; k < N; k++) { if (D[k] < lo) lo = D[k]; if (D[k] > hi) hi = D[k]; }
  const dStep = (hi - lo) / 65535 || 1e-9, dq = new Uint16Array(N); for (let k = 0; k < N; k++) dq[k] = Math.round((D[k] - lo) / dStep);
  // reserved: the footprint's unbuildable cells, merged into maximal rectangles (row runs grown downward)
  const bad = (i, j) => inside[j * nx + i] && !build[j * nx + i], used = new Uint8Array(N), rects = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (!bad(i, j) || used[j * nx + i]) continue;
    let i2 = i; while (i2 + 1 < nx && bad(i2 + 1, j) && !used[j * nx + i2 + 1]) i2++;
    let j2 = j; for (;;) { const jj = j2 + 1; if (jj >= ny) break; let all = true; for (let q = i; q <= i2; q++) if (!bad(q, jj) || used[jj * nx + q]) { all = false; break; } if (!all) break; j2 = jj; }
    for (let b = j; b <= j2; b++) for (let a = i; a <= i2; a++) used[b * nx + a] = 1;
    const rx0 = Math.max(rect.x0, x0 + (i - 0.5) * cell), rx1 = Math.min(rect.x0 + rect.w, x0 + (i2 + 0.5) * cell);
    const ry0 = Math.max(rect.y0, y0 + (j - 0.5) * cell), ry1 = Math.min(rect.y0 + rect.d, y0 + (j2 + 0.5) * cell);
    if (rx1 - rx0 > 1e-6 && ry1 - ry0 > 1e-6) rects.push({ x0: rx0, y0: ry0, w: rx1 - rx0, d: ry1 - ry0 });
  }
  return {
    layer: { x0, y0, dx: cell, nx, ny, dMin: lo, dStep, dq, w, ramp },
    reserved: rects,
    stats: { buildable: nIn ? +(nBuild / nIn).toFixed(3) : 0, reserved: rects.length, datumRelief: +(hi - lo).toFixed(1), maxDatumSlope: +worst.toFixed(3) },
  };
}

// ── the ground layer: clip on a shared grid, then drape ──────────────────────────────────────────────────────────
// Sutherland–Hodgman against one axis-aligned half-plane; vertices carry [x, y, z, u?, v?]
function clipHalf(poly, axis, val, keepBelow) {
  const out = []; const inside = (p) => (keepBelow ? p[axis] <= val : p[axis] >= val);
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], ia = inside(a), ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) { const t = (val - a[axis]) / (b[axis] - a[axis]); out.push(a.map((v, k) => v + (b[k] - v) * t)); }
  }
  return out;
}
/** A face → its pieces on the `step` grid (city units), each fan-split into padded quads [a, b, c, c]. */
function clipToGrid(f, step) {
  const uv = Array.isArray(f.uv) && f.uv.length >= f.corners.length ? f.uv : null;
  let poly = f.corners.map((c, i) => (uv ? [c[0], c[1], c[2], uv[i][0], uv[i][1]] : [c[0], c[1], c[2]]));
  if (poly.length === 4 && poly[2].every((v, k) => v === poly[3][k])) poly = poly.slice(0, 3);   // an already-padded triangle
  let lx = Infinity, hx = -Infinity, ly = Infinity, hy = -Infinity; for (const p of poly) { lx = Math.min(lx, p[0]); hx = Math.max(hx, p[0]); ly = Math.min(ly, p[1]); hy = Math.max(hy, p[1]); }
  const out = [];
  for (let gx = Math.floor(lx / step); gx * step < hx; gx++) {
    const px = clipHalf(clipHalf(poly, 0, gx * step, false), 0, (gx + 1) * step, true); if (px.length < 3) continue;
    for (let gy = Math.floor(ly / step); gy * step < hy; gy++) {
      const p = clipHalf(clipHalf(px, 1, gy * step, false), 1, (gy + 1) * step, true); if (p.length < 3) continue;
      for (let t = 1; t + 1 < p.length; t++) {
        const tri = [p[0], p[t], p[t + 1]], piece = { ...f, corners: [...tri, tri[2]].map((q) => [q[0], q[1], q[2]]) };
        if (uv) piece.uv = [...tri, tri[2]].map((q) => [q[3], q[4]]);
        out.push(piece);
      }
    }
  }
  if (!out.length && poly.length >= 3) out.push(f);   // degenerate in plan (a vertical sliver on a grid line): as it was
  return out;
}

const faceCentroid = (f) => { let x = 0, y = 0, z = 0; for (const c of f.corners) { x += c[0]; y += c[1]; z += c[2]; } const n = f.corners.length; return [x / n, y / n, z / n]; };
const nearRect = (b, x, y, pad) => x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.d + pad;

/**
 * Plan, reserve, grade and seat one city. `field` is the natural field (siting and grading read its natural ground);
 * `graded(X, Y)` is the graded field's ground (`gradedField` with this city's layer), which the seats stand on.
 * Two steps because the layer must exist before the seats: `prepareCity` then `seatCity`.
 */
export function prepareCity(field, spec, { index = 0, taken = [], mpu = CITY_METERS_PER_UNIT } = {}) {
  const profile = spec.profile || 'city';
  const [W, Dp] = cityFootprint(spec, mpu);
  const sited = isPt(spec.at) ? null : siteCity(field, [W, Dp], { grade: spec.grade, taken });
  const [cx, cy] = sited ? sited.at : spec.at;
  const rect = { x0: cx - W / 2, y0: cy - Dp / 2, w: W, d: Dp };
  const G = gradeCity(field, rect, { profile, grade: spec.grade, mpu, ramp: groundRamp(field) });
  const region = { x: 0, y: 0, w: W / mpu, d: Dp / mpu };
  const toFrame = (r) => ({ x: (r.x0 - rect.x0) / mpu, y: (r.y0 - rect.y0) / mpu, w: r.w / mpu, d: r.d / mpu });
  const own = normalizeCityBlocks(spec.blocks);
  const ownList = !own ? [] : Array.isArray(own) ? own : expandCityBlockMap(own.map, region, own.gap ?? 3);
  const { at, size, grade, ref, blocks, detail, region: _r, kind, title, fidelity, ...recipe } = spec; void at; void size; void grade; void ref; void blocks; void _r; void kind; void title; void fidelity;
  const depth = profile === 'metro' ? recipe.depth : (recipe.depth ?? Math.max(2, 2 + Math.round(Math.log2(Math.max(region.w / 30, region.d / 18)))));
  const cityRecipe = {
    ...recipe, profile, region, seed: recipe.seed ?? 1 + index, ...(depth !== undefined ? { depth } : {}),
    blocks: [...ownList, ...G.reserved.map((r) => ({ rect: toFrame(r), use: 'empty' }))],
    elements: { frontage: true, ...(recipe.elements || {}) },
  };
  const radius = detail && Number.isFinite(detail.radius) ? detail.radius : Math.max(W, Dp) <= DETAIL_ALL ? Infinity : DETAIL_RADIUS;
  return { profile, rect, center: [cx, cy], sited: sited ? { score: +sited.score.toFixed(3), frac: sited.frac } : null, grade: G, recipe: cityRecipe, mpu, reservedFrom: ownList.length, reservedRects: G.reserved.map(toFrame), radius };
}

// the graded ground's colour: the painting's soil at its mid tone, greyed toward packed earth and paving
function groundRamp(field) {
  const s = field.K.ramps.soil || field.K.ramps.low; const grey = (c, t, k) => c.map((v) => v * (1 - t) + k * t);
  return { stops: s.stops.map((c, i) => grey(c, 0.55, [70, 110, 150, 185][i])), pos: s.pos.slice(), gamma: s.gamma };
}

export function seatCity(prep, field, { light = null } = {}) {
  const { rect, mpu } = prep; const plan = planFractalCity(prep.recipe); const graded = field.heightAt;
  // the reserved ground keeps its natural surface: its 'empty' blocks lose the vacant-lot tile the planner lays, and
  // the street kit the planner lets stand on a claimed block (it is plaza to the planner) stays off it
  const RS = prep.reservedRects || [], inRes = (u, v) => RS.some((r) => u > r.x + 0.3 && u < r.x + r.w - 0.3 && v > r.y + 0.3 && v < r.y + r.d - 0.3);
  const off = (x, y) => !inRes(x, y);
  const grounds = plan.grounds.slice(1).filter((g) => !(g.use === 'empty' && g.block >= prep.reservedFrom) && off(g.x + g.w / 2, g.y + g.d / 2));
  plan.boxes = plan.boxes.filter((b) => MASS.has(b.kind) || b.class === 'landmark' || off(b.x + b.w / 2, b.y + b.d / 2));
  plan.faces = plan.faces.filter((f) => { const c = faceCentroid(f); return off(c[0], c[1]); });
  // the detail radius: near the core the full plan, beyond it the same plan pruned to massing
  // the core: a metro's height-field core, else the middle of what is built (the footprint's centre may be reserved land)
  const massesAll = plan.boxes.filter((b) => MASS.has(b.kind) || b.class === 'landmark');
  const focus = plan.core ? [plan.core.cx, plan.core.cy] : massesAll.length ? [massesAll.reduce((a, b) => a + b.x + b.w / 2, 0) / massesAll.length, massesAll.reduce((a, b) => a + b.y + b.d / 2, 0) / massesAll.length] : [rect.w / mpu / 2, rect.d / mpu / 2];
  const ru = prep.radius / mpu;
  const near = (u, v) => Math.hypot(u - focus[0], v - focus[1]) <= ru;
  const nearBox = (b) => near(b.x + b.w / 2, b.y + b.d / 2), nearG = (g) => near(g.x + g.w / 2, g.y + g.d / 2), nearF = (f) => { const c = faceCentroid(f); return near(c[0], c[1]); };
  let boxes = plan.boxes, ground = grounds, dress = plan.faces, far = null;
  if (Number.isFinite(ru)) {
    const fb = boxes.filter((b) => !nearBox(b)), fg = ground.filter((g) => !nearG(g)), ff = dress.filter((f) => !nearF(f));
    far = pruneFidelity('massing', { boxes: fb, grounds: fg, faces: ff });
    boxes = [...plan.boxes.filter(nearBox), ...fb]; ground = [...grounds.filter(nearG), ...fg]; dress = [...plan.faces.filter(nearF), ...ff];
  }
  const toX = (u) => rect.x0 + u * mpu, toY = (v) => rect.y0 + v * mpu;
  const G = (u, v) => graded(toX(u), toY(v));
  const e = 0.5 * CELL_UNITS;
  const slopeAt = (u, v) => Math.hypot(G(u + e, v) - G(u - e, v), G(u, v + e) - G(u, v - e)) / (2 * e * mpu);
  const faces = [], stats = { masses: 0, plinths: 0, plinthMax: 0, capped: 0, props: 0, ridden: 0, draped: 0, rigidDressing: 0 };
  const lit = light ? { light } : {};
  const emitBox = (b, lift) => { for (const f of assembleBoxCityScene({ boxes: [b], grounds: [], ribbons: [], faces: [], ...lit }).faces) faces.push(place(f, lift)); };
  const place = (f, lift) => ({ ...f, corners: f.corners.map((c) => [toX(c[0]), toY(c[1]), lift + c[2] * mpu]), ...(Number.isFinite(f.radius) ? { radius: f.radius * mpu } : {}), group: 'city' });
  // masses first: each one's seat, plinth and height
  const masses = [], lifts = new Map(), seats = [];
  for (const b0 of boxes) {
    if (!MASS.has(b0.kind) && b0.class !== 'landmark') continue;
    let b = b0; const cu = b.x + b.w / 2, cv = b.y + b.d / 2, fr = FRONT[b.front] || null;
    const [su, sv] = fr === '+y' ? [cu, b.y + b.d] : fr === '-y' ? [cu, b.y] : fr === '+x' ? [b.x + b.w, cv] : fr === '-x' ? [b.x, cv] : [cu, cv];
    const seat = G(su, sv) - SINK;
    if (b.floorH > 0 && b.class !== 'landmark' && b.kind !== 'anchor') {
      const floors = b.floors ?? Math.max(1, Math.round((b.z1 - (b.z0 || 0)) / b.floorH)), g = slopeAt(cu, cv);
      const cap = FLOOR_CAPS.find(([s]) => g > s);
      if (cap && floors > cap[1]) { const k = cap[1] / floors; b = { ...b, z1: (b.z0 || 0) + (b.z1 - (b.z0 || 0)) * k, ...(b.floors ? { floors: cap[1] } : {}) }; stats.capped++; }
    }
    let low = Infinity; for (const [a, c] of [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0], [0.5, 1], [0, 0.5], [1, 0.5], [0.5, 0.5]]) low = Math.min(low, G(b.x + a * b.w, b.y + c * b.d));
    const plinth = seat - low > PLINTH.min;
    if (plinth) {
      emitBox({ x: b.x, y: b.y, w: b.w, d: b.d, z0: (low - 0.3 - seat) / mpu, z1: (b.z0 || 0), kind: 'plinth', tint: PLINTH.tint }, seat);
      stats.plinths++; stats.plinthMax = Math.max(stats.plinthMax, +(seat - low).toFixed(2));
    }
    seats.push({ kind: b.kind, x: b.x, y: b.y, w: b.w, d: b.d, front: fr, at: [su, sv], seat, low, plinth, height: (b.z1 - (b.z0 || 0)) * mpu, floors: b.floors ?? (b.floorH > 0 ? Math.round((b.z1 - (b.z0 || 0)) / b.floorH) : null), lod: b.lod || null });
    emitBox(b, seat); masses.push(b0); lifts.set(b0, seat); stats.masses++;
  }
  const hostOf = (x, y, pad, z) => { let best = null, bd = Infinity; for (const m of masses) { if (!nearRect(m, x, y, pad)) continue; if (z !== undefined && (z < (m.z0 || 0) - 0.2 || z > m.z1 + 0.6)) continue; const d = Math.hypot(x - (m.x + m.w / 2), y - (m.y + m.d / 2)); if (d < bd) { bd = d; best = m; } } return best; };
  // the street kit: against a mass it rides with it, else it stands on the datum at its centre
  for (const b of boxes) {
    if (MASS.has(b.kind) || b.class === 'landmark') continue;
    const cu = b.x + b.w / 2, cv = b.y + b.d / 2, host = hostOf(cu, cv, 0.6);
    if (host) { emitBox(b, lifts.get(host)); stats.ridden++; } else { emitBox(b, G(cu, cv)); stats.props++; }
  }
  // dressing faces (vehicles, people, stickers, playground quads): on a mass → with it; else draped per vertex
  for (const f of dress) {
    const [cu, cv, cz] = faceCentroid(f), host = hostOf(cu, cv, 0.4, cz);
    if (host) { faces.push(place(f, lifts.get(host))); stats.rigidDressing++; continue; }
    faces.push({ ...f, corners: f.corners.map((c) => [toX(c[0]), toY(c[1]), G(c[0], c[1]) + c[2] * mpu]), group: 'city' }); stats.draped++;
  }
  // the ground layer (the base plane is the terrain itself now): clipped on the shared grid, draped on the datum
  const layer = assembleBoxCityScene({ boxes: [], grounds: ground, ribbons: plan.ribbons, faces: [], ...lit }).faces;
  prep.grade.layer.paint = paintGround(layer, rect, mpu);
  let pieces = 0; const pin = [Infinity, -Infinity, Infinity, -Infinity];
  for (const f of layer) {
    const c = faceCentroid(f); if (!near(c[0], c[1])) continue;
    for (const p of clipToGrid(f, DRAPE_UNITS)) {
      faces.push({ ...p, corners: p.corners.map((q) => [toX(q[0]), toY(q[1]), G(q[0], q[1]) + q[2] * mpu + GROUND_LIFT]), group: 'city' }); pieces++;
      for (const q of p.corners) { const X = toX(q[0]), Y = toY(q[1]); if (X < pin[0]) pin[0] = X; if (X > pin[1]) pin[1] = X; if (Y < pin[2]) pin[2] = Y; if (Y > pin[3]) pin[3] = Y; }
    }
  }
  stats.groundPieces = pieces;
  const built = (u, v) => { const g = field.kernel.gradeAt(toX(u), toY(v)); return !!g && g[1] >= 1; };
  stats.streets = streetGrades(plan.ribbons, G, mpu, built);
  const detail = far ? { radius: prep.radius, massing: boxes.filter((b) => b.lod === 'mass').length, pruned: far.dropped } : { radius: null };
  // the draped ground's extent: the page keeps its terrain fine there (a pin), so the drape never sinks into it
  return { faces, plan, seats, pin: pieces ? pin : null, stats: { ...stats, faces: faces.length, boxes: boxes.length, detail, ...pickPlanStats(plan.stats) }, walk: streetSpot(plan, grounds, focus, boxes, G, toX, toY) };
}

const pickPlanStats = (s) => ({ buildings: s.buildings, townhouses: s.townhouses, blocksLaid: s.blocksLaid ? s.blocksLaid.length : 0 });

// the ground plan painted on a grid (grid nodes, city frame → metres): each node takes the colour of the topmost flat
// face over it; rgba, premultiplied, so the kernel's bilinear sample blends the edges. Faces above the lot tiles (paint,
// kerbs) are drawn in height order, so a crosswalk lies over its street.
function paintGround(layer, rect, mpu) {
  const dx = PAINT_UNITS * mpu, nx = Math.ceil(rect.w / dx) + 1, ny = Math.ceil(rect.d / dx) + 1, pc = new Uint8Array(nx * ny * 4), top = new Float32Array(nx * ny).fill(-Infinity);
  const rgb = (f) => { const h = typeof f.fill === 'string' ? f.fill : ''; if (h[0] === '#' && h.length >= 7) return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; const m = h.match(/rgba?\(([^)]+)\)/); return m ? m[1].split(',').slice(0, 3).map(Number) : null; };
  for (const f of layer) {
    const c = f.corners; if (!c || c.length < 3) continue;
    const up = (c[1][0] - c[0][0]) * (c[2][1] - c[0][1]) - (c[1][1] - c[0][1]) * (c[2][0] - c[0][0]); if (Math.abs(up) < 1e-9) continue;   // edge-on (a kerb's side)
    const col = rgb(f); if (!col) continue;
    let lx = Infinity, hx = -Infinity, ly = Infinity, hy = -Infinity, z = 0; for (const p of c) { lx = Math.min(lx, p[0]); hx = Math.max(hx, p[0]); ly = Math.min(ly, p[1]); hy = Math.max(hy, p[1]); z += p[2] / c.length; }
    const i0 = Math.max(0, Math.ceil((lx * mpu) / dx)), i1 = Math.min(nx - 1, Math.floor((hx * mpu) / dx)), j0 = Math.max(0, Math.ceil((ly * mpu) / dx)), j1 = Math.min(ny - 1, Math.floor((hy * mpu) / dx));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const u = (i * dx) / mpu, v = (j * dx) / mpu, k = j * nx + i; if (z < top[k]) continue;
      let inside = false; for (let a = 0, b = c.length - 1; a < c.length; b = a++) if ((c[a][1] > v) !== (c[b][1] > v) && u < ((c[b][0] - c[a][0]) * (v - c[a][1])) / (c[b][1] - c[a][1]) + c[a][0]) inside = !inside;
      if (!inside) continue;
      top[k] = z; pc[k * 4] = col[0]; pc[k * 4 + 1] = col[1]; pc[k * 4 + 2] = col[2]; pc[k * 4 + 3] = 255;
    }
  }
  return { x0: rect.x0, y0: rect.y0, dx, nx, ny, pc };
}

// the streets' grades along their centrelines, on the built ground: the steepest, and the share of street length
// steeper than 15 % (where a street runs off the built ground it ends; the planner clips it at the reserved block)
function streetGrades(ribbons, G, mpu, built = () => true) {
  let len = 0, steep = 0, max = 0;
  for (const r of ribbons) {
    const p = r.path; if (!Array.isArray(p) || p.length < 2) continue;
    for (let i = 0; i + 1 < p.length; i++) {
      const L = Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]), n = Math.max(1, Math.ceil(L));
      let prev = G(p[i][0], p[i][1]);
      for (let s = 1; s <= n; s++) {
        const t = s / n, u = p[i][0] + (p[i + 1][0] - p[i][0]) * t, v = p[i][1] + (p[i + 1][1] - p[i][1]) * t, z = G(u, v), dl = (L / n) * mpu, gr = Math.abs(z - prev) / dl;
        if (built(u, v)) { len += dl; if (gr > 0.15) steep += dl; if (gr > max) max = gr; }
        prev = z;
      }
    }
  }
  return { lengthM: Math.round(len), maxGrade: +max.toFixed(3), over15: len ? +(steep / len).toFixed(3) : 0 };
}

// a place to stand: a walk near the core, at least a block long, looking along it the way the view runs furthest
function streetSpot(plan, grounds, focus, boxes, G, toX, toY) {
  const walks = grounds.filter((g) => typeof g.kind === 'string' && g.kind.startsWith('sidewalk') && g.kind !== 'sidewalk-joint' && Math.min(g.w, g.d) > 0.5);
  const cand = walks.length ? walks : grounds.filter((g) => g.w > 1 && g.d > 1);
  if (!cand.length) return null;
  const solid = boxes.filter((b) => MASS.has(b.kind) || b.class === 'landmark');
  const blocked = (u, v) => solid.some((b) => u > b.x && u < b.x + b.w && v > b.y && v < b.y + b.d);
  const run = (u, v, du, dv) => { let n = 0; while (n < 80 && !blocked(u + du * (n + 1), v + dv * (n + 1))) n++; return n; };
  let best = null;
  for (const g of cand) {
    const long = Math.max(g.w, g.d), short = Math.min(g.w, g.d); if (walks.length && long < 6) continue;
    // a walk band wider than a pavement runs under its street (the town and city profiles): stand at its kerb-side edge
    const off = short > 2.4 ? short / 2 - 0.35 : 0, ax = g.w >= g.d ? [1, 0] : [0, 1];
    const u = g.x + g.w / 2 + (ax[0] ? 0 : off), v = g.y + g.d / 2 + (ax[0] ? off : 0);
    // look the way that runs furthest along the street, preferring the way into town when it runs a block or more
    const fwd = run(u, v, ax[0], ax[1]), back = run(u, v, -ax[0], -ax[1]), inward = (focus[0] - u) * ax[0] + (focus[1] - v) * ax[1] >= 0;
    const dir = (inward ? fwd : back) >= 20 ? (inward ? ax : [-ax[0], -ax[1]]) : fwd >= back ? ax : [-ax[0], -ax[1]];
    const score = Math.hypot(u - focus[0], v - focus[1]) - 0.5 * Math.min(40, Math.max(fwd, back));
    if (!best || score < best.score) best = { score, u, v, dir };
  }
  if (!best) return null;
  const { u, v, dir } = best;
  return { at: [toX(u), toY(v)], z: G(u, v), look: [toX(u + dir[0] * 30), toY(v + dir[1] * 30)] };
}

/** The terrain light as the city's key light (the city's faces are lit by the same sun as the ground). */
export function cityLight(field) {
  const L = field.K.light; return makeLight({ direction: [-L[0], -L[1], -L[2]], ambient: 0.5, diffuse: 0.5 });
}
