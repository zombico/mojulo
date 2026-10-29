/**
 * THE LAND'S LAYERS (gen-7's layered ground, the engine's terrain primitive: Unreal's landscape layers, Godot's splat):
 * the ground read as rock, scree, soil, sand and path, each a tiling cut the renderer blends by weight and by its own
 * height (scree's stones stand out of the soil, sand settles between), never a soft cross-fade. This is the overlay; a
 * renderer, or an engine pack, owns the materials.
 *
 *   landLayers(faces, form, { seed? }) → { ids, layered(i), weightAt(corner), path }
 *       faces: a payload's faces (`corners`); form: their read (form/land-form.js `landForm`: each face's `cls`, `under`).
 *       `layered(i)`: face i is ground the layers cover (a land class, not under the sea, not water).
 *       `weightAt(corner)`: the four natural layers' weights at a layered face's corner (rock, scree, soil, sand; summing
 *         to 1). Rock is where the land's geometry has it (the classes of the faces round the corner). The rest are worn
 *         into one another over metres, never along the faces' edges: scree FANS from the foot of a cliff over the soil
 *         and onto the beach (its reach wandering along the foot, up to FOOT metres); the soil and the sand are parted by
 *         a smooth signed distance across their border, the sand reaching up into the soil (up to SAND_REACH metres, in
 *         tongues) and the soil down onto the top of the beach (up to SOIL_REACH); seeded patches of scree lie over the
 *         soil. Last, the three are averaged over SMOOTH metres round each corner (its rock share kept as it is), so no
 *         border steps with the cells. A renderer blends what the corners give by each layer's own height, so the border it draws
 *         is a wandering contour, not a cross-fade.
 *       `path`: null without a trail; else the path's MASK, a top-down grid (`origin`, `cell`, `size` [nx, ny], `weight`
 *         and `z`, one per texel, row by row from the origin) over the trail faces' footprint. A path 1.6 m wide on 1.5 m
 *         land cells would read as a zig-zag of corners, so its weight is a map at its own resolution, as an engine's
 *         painted layer is: 1 inside a trail face, easing to 0 over a ragged PATH_EDGE outside (worn edges, never a
 *         ruled line); `dist` the plan distance to the trail (0 on it, to PATH_REACH: the verge a trail's dress lays its
 *         dust and rubble in); `inside` how deep in the trail (its distance to the nearest point off it: 0 off it, its
 *         half width at its middle; with `dist`, a signed distance across its edge); `z` the trail's height there, so a reader can keep the path off the flank under a shelf. Every
 *         other layer is scaled by (1 − path); the path is ground, so a reader lays it on what faces up.
 *
 * Pure and seeded: the same faces, the same weights and mask, byte for byte. Nothing in the recipe reads it.
 */
import { strHash } from '../city/plan/dice.js';

/** The layers, in the order a weight lists them (the path last: its weight is the mask's, not a corner's). */
export const LAYER_IDS = Object.freeze(['rock', 'scree', 'soil', 'sand', 'path']);
/** A land class → its natural layer (the trail's own faces are soil under the path's mask). */
export const LAYER_OF = Object.freeze({ cliff: 0, rock: 0, scree: 1, soil: 2, ground: 2, trail: 2, sand: 3 });
/** Foothill scree: the most it reaches from rock (metres), how much of the soil and of the sand at the foot it takes;
 *  patches: their lattice (metres), the share of the lattice they cover, how much of the soil they take. */
export const FOOT = 8, FOOT_SCREE = 0.95, FOOT_ON_SAND = 0.6, PATCH = 8, PATCH_FROM = 0.62, PATCH_SCREE = 0.9;
/** The soil and the sand's border: the most the sand reaches up into the soil and the soil down into the beach (metres). */
export const SAND_REACH = 3.5, SOIL_REACH = 2.5;
/** How far a border's reach wanders along it: the lattice (metres) and the least share of the most it reaches. */
export const WANDER = 5, WANDER_LEAST = 0.3;
/** How far a corner's scree, soil and sand are averaged with its neighbours' (metres): the corners sit on the land's
 *  cells, and a border read off them steps with the cells until it is smoothed over more than one. */
export const SMOOTH = 3;
/** The path's mask: its texel (metres), how far past the trail it wears out (metres, at most), and its edge's wander (metres). */
export const PATH_CELL = 0.25, PATH_EDGE = 0.9, PATH_WANDER = 1.6;
/** How far past the trail the mask reads its distance (metres): its verge, where a trail's dust and rubble lie. */
export const PATH_REACH = 3;

const ease = (t) => t * t * (3 - 2 * t);
// a smooth field in 0..1 over the ground: seeded values at a lattice, blended between
function lattice(seed, tag, cell) {
  const at = (i, j) => strHash(`${seed}|${tag}|${i},${j}`) / 4294967296;
  return (x, y) => {
    const u = x / cell, v = y / cell, i = Math.floor(u), j = Math.floor(v), a = ease(u - i), b = ease(v - j);
    return (at(i, j) * (1 - a) + at(i + 1, j) * a) * (1 - b) + (at(i, j + 1) * (1 - a) + at(i + 1, j + 1) * a) * b;
  };
}
const keyAt = (c) => `${Math.round(c[0] * 100)},${Math.round(c[1] * 100)},${Math.round(c[2] * 100)}`;

// the distance in plan from (x, y) to a polygon's footprint: 0 inside (corners in either winding)
function planDistance(cs, x, y) {
  let inside = false, d = Infinity;
  for (let i = 0, j = cs.length - 1; i < cs.length; j = i++) {
    const [ax, ay] = cs[j], [bx, by] = cs[i];
    if ((ay > y) !== (by > y) && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
    const ex = bx - ax, ey = by - ay, L = ex * ex + ey * ey, t = L ? Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / L)) : 0;
    d = Math.min(d, Math.hypot(x - ax - t * ex, y - ay - t * ey));
  }
  return inside ? 0 : d;
}

function pathMask(trail, seed) {
  if (!trail.length) return null;
  const reach = PATH_REACH + 1e-9, lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
  for (const cs of trail) for (const c of cs) for (const k of [0, 1]) { lo[k] = Math.min(lo[k], c[k]); hi[k] = Math.max(hi[k], c[k]); }
  const origin = lo.map((v) => Math.floor((v - reach) / PATH_CELL) * PATH_CELL);
  const nx = Math.ceil((hi[0] + reach - origin[0]) / PATH_CELL) + 1, ny = Math.ceil((hi[1] + reach - origin[1]) / PATH_CELL) + 1;
  const dist = new Float32Array(nx * ny).fill(Infinity), z = new Float32Array(nx * ny);
  for (const cs of trail) {
    const zm = cs.reduce((s, c) => s + c[2], 0) / cs.length;
    const i0 = Math.max(0, Math.floor((Math.min(...cs.map((c) => c[0])) - reach - origin[0]) / PATH_CELL)), i1 = Math.min(nx - 1, Math.ceil((Math.max(...cs.map((c) => c[0])) + reach - origin[0]) / PATH_CELL));
    const j0 = Math.max(0, Math.floor((Math.min(...cs.map((c) => c[1])) - reach - origin[1]) / PATH_CELL)), j1 = Math.min(ny - 1, Math.ceil((Math.max(...cs.map((c) => c[1])) + reach - origin[1]) / PATH_CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * nx + i, d = planDistance(cs, origin[0] + i * PATH_CELL, origin[1] + j * PATH_CELL);
      if (d < dist[k]) { dist[k] = d; z[k] = zm; }
    }
  }
  // the worn edge: how far past the trail the path reaches wanders along it, from a third of PATH_EDGE to the whole
  const wander = lattice(seed, 'path-edge-v1', PATH_WANDER), weight = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, d = dist[k];
    if (!(d < Infinity)) continue;
    const edge = PATH_EDGE * (0.33 + 0.67 * wander(origin[0] + i * PATH_CELL, origin[1] + j * PATH_CELL));
    weight[k] = d <= 0 ? 1 : d >= edge ? 0 : 1 - ease(d / edge);
  }
  // (and the distance itself, to PATH_REACH: the verge a dress lays its dust and rubble in)
  for (let k = 0; k < dist.length; k++) dist[k] = Math.min(PATH_REACH, dist[k]);
  // (and how deep a texel lies inside the trail: its distance to the nearest texel off it, a two-pass chamfer over the
  // grid, so a reader can tell the trail's middle from its edge)
  const inside = new Float32Array(nx * ny), D2 = PATH_CELL * Math.SQRT2;
  for (let k = 0; k < inside.length; k++) inside[k] = dist[k] > 0 ? 0 : Infinity;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i; let v = inside[k];
    if (i > 0) v = Math.min(v, inside[k - 1] + PATH_CELL);
    if (j > 0) { v = Math.min(v, inside[k - nx] + PATH_CELL); if (i > 0) v = Math.min(v, inside[k - nx - 1] + D2); if (i < nx - 1) v = Math.min(v, inside[k - nx + 1] + D2); }
    inside[k] = v;
  }
  for (let j = ny - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
    const k = j * nx + i; let v = inside[k];
    if (i < nx - 1) v = Math.min(v, inside[k + 1] + PATH_CELL);
    if (j < ny - 1) { v = Math.min(v, inside[k + nx] + PATH_CELL); if (i < nx - 1) v = Math.min(v, inside[k + nx + 1] + D2); if (i > 0) v = Math.min(v, inside[k + nx - 1] + D2); }
    inside[k] = v;
  }
  return { origin, cell: PATH_CELL, size: [nx, ny], weight, dist, inside, z };
}

export function landLayers(faces, form, { seed = 1 } = {}) {
  const F = form.faces, layered = (i) => !!F[i].cls && F[i].cls in LAYER_OF && !F[i].under;
  // the classes round each corner (keyed to a centimetre)
  const W = new Map();
  faces.forEach((f, i) => {
    if (!layered(i)) return;
    for (const c of f.corners) { const k = keyAt(c), w = W.get(k) ?? W.set(k, { at: c, w: [0, 0, 0, 0] }).get(k); w.w[LAYER_OF[F[i].cls]] += 1; if (F[i].cls === 'cliff') w.cliff = true; }
  });
  // the nearest corner of a layer: a bucket grid of the corners where the geometry lays it
  const nearestOf = (li, cell, only = () => true) => {
    const B = new Map(), key = (i, j) => `${i},${j}`;
    for (const v of W.values()) if (v.w[li] > 0 && only(v)) { const k = key(Math.floor(v.at[0] / cell), Math.floor(v.at[1] / cell)); (B.get(k) ?? B.set(k, []).get(k)).push(v.at); }
    return (x, y) => {
      let d = Infinity; const bi = Math.floor(x / cell), bj = Math.floor(y / cell);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const c of B.get(key(bi + a, bj + b)) || []) d = Math.min(d, Math.hypot(c[0] - x, c[1] - y));
      return d;
    };
  };
  // (the scree is a cliff's: a boulder on the grass sheds none)
  const nearRock = nearestOf(0, FOOT, (v) => v.cliff), nearSand = nearestOf(3, SAND_REACH), nearSoil = nearestOf(2, SOIL_REACH);
  const patch = lattice(seed, 'scree-patch-v1', PATCH), wFoot = lattice(seed, 'foot-reach-v1', WANDER), wSand = lattice(seed, 'sand-reach-v1', WANDER), wSoil = lattice(seed, 'soil-reach-v1', WANDER);
  // (1 at the source, easing to 0 at a reach that wanders along the border between WANDER_LEAST and the whole)
  const worn = (d, most, wander, x, y) => { const r = most * (WANDER_LEAST + (1 - WANDER_LEAST) * wander(x, y)); return d >= r ? 0 : 1 - ease(d / r); };
  for (const v of W.values()) {
    const n = v.w.reduce((s, x) => s + x, 0), w0 = v.w.map((x) => x / n), [x, y] = v.at, w = [...w0];
    const foot = worn(nearRock(x, y), FOOT, wFoot, x, y);
    const S = w0[2] + w0[3];
    if (S > 0) {
      // the soil and the sand one ground, parted by a signed distance across their border (into the soil +, into the
      // sand −), never by the classes' cells: the cells step, the distance a few metres out from them does not
      const d = w0[2] > 0 && w0[3] > 0 ? 0 : w0[2] > 0 ? nearSand(x, y) : -nearSoil(x, y);
      const r = SAND_REACH * (WANDER_LEAST + (1 - WANDER_LEAST) * wSand(x, y)), c = SOIL_REACH * (WANDER_LEAST + (1 - WANDER_LEAST) * wSoil(x, y));
      const sand = S * (1 - ease(Math.max(0, Math.min(1, (d + c) / (c + r))))), soil = S - sand;
      // and the scree: fanning from the foot over both, in patches over the soil
      const p = Math.max(0, (patch(x, y) - PATCH_FROM) / (1 - PATCH_FROM));
      const onSoil = soil * Math.min(1, FOOT_SCREE * foot + PATCH_SCREE * p), onSand = sand * FOOT_ON_SAND * foot;
      w[1] += onSoil + onSand; w[2] = soil - onSoil; w[3] = sand - onSand;
    }
    const m = w.reduce((s, q) => s + q, 0); v.w = w.map((q) => q / m);
  }
  // the smoothing: each corner's scree, soil and sand (as shares of what is not rock) averaged with its neighbours'
  const NB = new Map(), cellKey = (i, j) => `${i},${j}`, V = [...W.values()];
  for (const v of V) { const k = cellKey(Math.floor(v.at[0] / SMOOTH), Math.floor(v.at[1] / SMOOTH)); (NB.get(k) ?? NB.set(k, []).get(k)).push(v); }
  const share = new Map(V.map((v) => { const q = 1 - v.w[0]; return [v, q > 1e-9 ? [v.w[1] / q, v.w[2] / q, v.w[3] / q] : null]; }));
  const smoothed = V.map((v) => {
    const q = 1 - v.w[0]; if (q <= 1e-9) return v.w;
    const acc = [0, 0, 0]; let t = 0; const bi = Math.floor(v.at[0] / SMOOTH), bj = Math.floor(v.at[1] / SMOOTH);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const u of NB.get(cellKey(bi + a, bj + b)) || []) {
      const s3 = share.get(u), d = Math.hypot(u.at[0] - v.at[0], u.at[1] - v.at[1]);
      if (!s3 || d >= SMOOTH) continue;
      const k = (1 - (d / SMOOTH) ** 2) ** 2; t += k; for (let c = 0; c < 3; c++) acc[c] += s3[c] * k;
    }
    return [v.w[0], ...acc.map((x) => (q * x) / t)];
  });
  V.forEach((v, n) => { v.w = smoothed[n]; });
  const trail = faces.filter((f, i) => F[i].cls === 'trail').map((f) => f.corners);
  return { ids: LAYER_IDS, layered, weightAt: (c) => W.get(keyAt(c))?.w ?? null, path: pathMask(trail, seed) };
}
