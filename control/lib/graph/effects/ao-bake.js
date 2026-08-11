/**
 * ao-bake — baked ambient occlusion over the engine-agnostic face list (renderer-ladder.plan.md, P1).
 *
 * A second baked lighting term beside the vexar Lambert solve: geometric occlusion darkening in
 * corners, crevices, and contact junctions. Like the Lambert term it is camera-independent and is
 * computed ONCE at geometry-solve time, so it rides into every consumer of the face payload —
 * the three.js World, the headless PNG/MP4 bakes, and the .glb export — with zero runtime cost.
 *
 * Model: classic SDF normal-tap AO, made deterministic (no random kernel). For each face corner,
 * step along the face's open-side normal and compare each step's distance-to-scene against the
 * distance stepped: geometry crowding the corner makes the scene distance fall short, and the
 * shortfall (distance-weighted, near taps dominating) becomes an occlusion factor. Two properties
 * make the single-direction tap sufficient here:
 *   • a face's own plane — and any coplanar neighbour tile — measures exactly the stepped
 *     distance, so flat tessellated surfaces contribute ZERO occlusion (no self-shadowing);
 *   • any face crossing the tap ray's neighbourhood (a wall meeting a floor, a crate on the
 *     ground) measures short, darkening both sides of the junction.
 *
 * The occluder query is a JS sibling of effects-occluder.js's grid-culled field: a uniform 2D
 * grid over the ground plane (z-up world, grid over XY) listing the faces whose padded footprint
 * overlaps each cell, with a 3D-AABB reject before the exact point-to-quad distance. Same
 * discipline as bakeBoxField — cap per cell, count overflow, never silently O(N).
 *
 * Deterministic by construction: pure arithmetic over the face list in its given order.
 * Same faces + same options → identical `vao` arrays, byte for byte.
 *
 * Output: faces gain `vao: [a0, a1, a2, a3]` — one multiplier in (0, 1] per corner, 1 = open.
 * faceListToMesh (figures/face-mesh.js) multiplies them into the baked vertex colours; emitters
 * that cannot gradient a face (CSS-3D, SVG) may take the corner average. Faces the pass does not
 * darken are returned by reference, mirroring decollideFaces' convention.
 */

const TRIS = [[0, 1, 2], [0, 2, 3]]; // quad → two triangles, same split as face-mesh.js

// ── vector helpers (plain arrays, hot path — no allocation beyond scratch) ──

function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }

// Winding normal of a quad — NOT hemisphere-canonicalized (face-mesh's faceNormal is, for plane
// bucketing); AO needs the authored orientation because the tap direction must face open space.
function windingNormal(c) {
  const u = sub(c[1], c[0]), v = sub(c[3], c[0]);
  const n = cross(u, v);
  const L = Math.hypot(n[0], n[1], n[2]);
  return L < 1e-12 ? null : [n[0] / L, n[1] / L, n[2] / L];
}

// Squared distance from point p to triangle (a, b, c). Standard region-clamped closest point
// (Ericson, Real-Time Collision Detection §5.1.5) — branchy but allocation-free and exact.
function distSqPointTri(p, a, b, c) {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return dot(ap, ap);                       // vertex a
  const bp = sub(p, b);
  const d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return dot(bp, bp);                      // vertex b
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {                              // edge ab
    const t = d1 / (d1 - d3);
    const q = [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t];
    const dq = sub(p, q); return dot(dq, dq);
  }
  const cp = sub(p, c);
  const d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return dot(cp, cp);                      // vertex c
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {                              // edge ac
    const t = d2 / (d2 - d6);
    const q = [a[0] + ac[0] * t, a[1] + ac[1] * t, a[2] + ac[2] * t];
    const dq = sub(p, q); return dot(dq, dq);
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {                // edge bc
    const t = (d4 - d3) / ((d4 - d3) + (d5 - d6));
    const q = [b[0] + (c[0] - b[0]) * t, b[1] + (c[1] - b[1]) * t, b[2] + (c[2] - b[2]) * t];
    const dq = sub(p, q); return dot(dq, dq);
  }
  const n = cross(ab, ac);                                          // interior: plane distance
  const d = dot(ap, n);
  return (d * d) / dot(n, n);
}

// An occluder is any face that reads as solid mass. Decal passes (shadow/ink), translucent water,
// see-through wireframe cages, and translucent groups (alpha < 1) don't block light meaningfully.
function isOccluder(f) {
  if (!f || !Array.isArray(f.corners) || f.corners.length < 4) return false;
  if (f.decal === 'shadow' || f.decal === 'ink') return false;
  if (f.water || f.wireframe) return false;
  if (typeof f.alpha === 'number' && f.alpha < 1) return false;
  return true;
}

// A receiver is a face worth darkening: same solidity test, plus unlit texture stickers are
// skipped (their consumer ignores vertex colours entirely).
function isReceiver(f) {
  if (!isOccluder(f)) return false;
  if (typeof f.texture === 'string' && !f.textureLit) return false;
  return true;
}

// Build the grid-culled occluder field over a face list: per-occluder AABBs, a uniform XY grid
// (cell = 2R, insertion padded by R so a query never scans neighbour cells), and the clamped
// nearest-distance query both the corner bake and the instance-ambient sampler share.
// Returns null when the list holds no occluders.
function buildOccluderField(faces, { radius = null, kPerCell = 64 } = {}) {
  const occIdx = [];
  for (let i = 0; i < faces.length; i++) if (isOccluder(faces[i])) occIdx.push(i);
  if (!occIdx.length) return null;

  // scene bounds → default radius + per-occluder AABBs
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  const aabbs = new Map(); // face index → [x0,y0,z0,x1,y1,z1]
  for (const i of occIdx) {
    const c = faces[i].corners;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let k = 0; k < 4; k++) {
      const p = c[k];
      if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
      if (p[2] < z0) z0 = p[2]; if (p[2] > z1) z1 = p[2];
    }
    aabbs.set(i, [x0, y0, z0, x1, y1, z1]);
    if (x0 < minX) minX = x0; if (x1 > maxX) maxX = x1;
    if (y0 < minY) minY = y0; if (y1 > maxY) maxY = y1;
    if (z0 < minZ) minZ = z0; if (z1 > maxZ) maxZ = z1;
  }
  const diag = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) || 1;
  const R = Number.isFinite(radius) && radius > 0 ? radius : Math.min(3.5, Math.max(0.4, diag * 0.02));

  const cell = 2 * R;
  const ox = minX - R, oy = minY - R;
  const cols = Math.max(1, Math.ceil((maxX + R - ox) / cell));
  const rows = Math.max(1, Math.ceil((maxY + R - oy) / cell));
  const cells = new Map(); // row * cols + col → face indices (capped at kPerCell)
  let overflow = 0;
  for (const i of occIdx) {
    const [x0, y0, , x1, y1] = aabbs.get(i);
    const c0 = Math.max(0, Math.floor((x0 - R - ox) / cell)), c1 = Math.min(cols - 1, Math.floor((x1 + R - ox) / cell));
    const r0 = Math.max(0, Math.floor((y0 - R - oy) / cell)), r1 = Math.min(rows - 1, Math.floor((y1 + R - oy) / cell));
    for (let r = r0; r <= r1; r++) {
      for (let ci = c0; ci <= c1; ci++) {
        const key = r * cols + ci;
        let list = cells.get(key);
        if (!list) { list = []; cells.set(key, list); }
        if (list.length >= kPerCell) { overflow++; continue; }
        list.push(i);
      }
    }
  }

  // distance from p to the nearest occluder (excluding face `self`), clamped: anything ≥ `cap`
  // is reported as `cap` (a tap only cares about shortfall below its stepped distance).
  const sdfNear = (p, cap, self) => {
    const ci = Math.floor((p[0] - ox) / cell), ri = Math.floor((p[1] - oy) / cell);
    if (ci < 0 || ci >= cols || ri < 0 || ri >= rows) return cap;
    const list = cells.get(ri * cols + ci);
    if (!list) return cap;
    let bestSq = cap * cap;
    for (const i of list) {
      if (i === self) continue;
      const b = aabbs.get(i);
      // 3D AABB reject — cheap lower bound on the exact distance
      const dx = Math.max(b[0] - p[0], 0, p[0] - b[3]);
      const dy = Math.max(b[1] - p[1], 0, p[1] - b[4]);
      const dz = Math.max(b[2] - p[2], 0, p[2] - b[5]);
      if (dx * dx + dy * dy + dz * dz >= bestSq) continue;
      const c = faces[i].corners;
      for (const t of TRIS) {
        const d2 = distSqPointTri(p, c[t[0]], c[t[1]], c[t[2]]);
        if (d2 < bestSq) bestSq = d2;
      }
      if (bestSq < 1e-12) return 0;
    }
    return Math.sqrt(bestSq);
  };

  return { sdfNear, R, cellCount: cells.size, overflow };
}

// tap weights: nearest dominates (1/2^i), normalized to sum 1 so occ ∈ [0, 1]
function tapWeights(steps) {
  const nSteps = Math.max(1, Math.round(steps));
  const weights = [];
  let wSum = 0;
  for (let i = 0; i < nSteps; i++) { const w = 1 / 2 ** i; weights.push(w); wSum += w; }
  for (let i = 0; i < nSteps; i++) weights[i] /= wSum;
  return weights;
}

/**
 * instanceOccluderFaces(template, transforms) → phantom occluder faces.
 *
 * Expands a `repeats` entry into bake-time-only occluder quads: each solid template face is
 * transformed by every instance TRS (translate + yaw about +Z + uniform scale — the same
 * composition the emitters' InstancedMesh/thin-node lowerings apply). Feed the result to
 * bakeAmbientOcclusion's `extraOccluders` so instanced geometry CASTS onto the world's faces
 * (a tree canopy darkens the terrain under it) without ever entering the render payload.
 */
export function instanceOccluderFaces(template = [], transforms = []) {
  const out = [];
  const solid = (Array.isArray(template) ? template : []).filter(isOccluder);
  for (const t of (Array.isArray(transforms) ? transforms : [])) {
    const pos = t && Array.isArray(t.pos) ? t.pos : [0, 0, 0];
    const rot = t && Number.isFinite(t.rotZ) ? t.rotZ : 0;
    const s = t && Number.isFinite(t.scale) ? t.scale : 1;
    const cosR = Math.cos(rot), sinR = Math.sin(rot);
    for (const f of solid) {
      const corners = f.corners.slice(0, 4).map((p) => {
        const x = p[0] * s, y = p[1] * s, z = p[2] * s;
        return [pos[0] + x * cosR - y * sinR, pos[1] + x * sinR + y * cosR, pos[2] + z];
      });
      out.push({ corners });
    }
  }
  return out;
}

/**
 * sampleAmbientAt(faces, points, opts) → ao multipliers, one per point (each in [minAo, 1]).
 *
 * Instance-granularity ambient level (renderer-convergence.plan.md, 1a "receive"): one
 * deterministic occlusion sample per point — four lateral taps (±X, ±Y) plus one up-tap,
 * averaged — against the world's OWN faces. Instanced geometry cannot take per-vertex AO
 * (instances share one template geometry), so the caller multiplies these into the
 * per-instance `instanceColor` tint: a tree hemmed in by towers reads dimmer than one in the
 * open. APPROXIMATE by design (instance-level, not vertex-level), and deliberately blind to
 * OTHER instances (no instance-vs-instance shading — that would need per-point self-exclusion;
 * take it up only with real demand). Shares the bake's field, weights, and defaults.
 */
export function sampleAmbientAt(faces = [], points = [], { strength = 0.65, radius = null, steps = 4, minAo = 0.2, kPerCell = 64 } = {}) {
  if (!Array.isArray(points) || !points.length) return [];
  const field = buildOccluderField(faces, { radius, kPerCell });
  if (!field) return points.map(() => 1);
  const { sdfNear, R } = field;
  const weights = tapWeights(steps);
  const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1]];
  return points.map((p) => {
    if (!Array.isArray(p) || p.length < 3) return 1;
    let occ = 0;
    for (const dir of DIRS) {
      for (let s = 1; s <= weights.length; s++) {
        const d = (R * s) / weights.length;
        const q = [p[0] + dir[0] * d, p[1] + dir[1] * d, p[2] + dir[2] * d];
        const sd = sdfNear(q, d, -1);
        occ += (weights[s - 1] / DIRS.length) * Math.max(0, (d - sd) / d);
      }
    }
    return Math.max(minAo, 1 - strength * occ);
  });
}

/**
 * bakeAmbientOcclusion(faces, opts) → faces (new array; only darkened faces are new objects).
 *
 * @param {Array} faces engine-agnostic face list ({ corners, fill, ... }), z-up world coords.
 * @param {object} [opts]
 * @param {number} [opts.strength=0.65] how dark full occlusion gets (0..1); ao floor is 1-strength.
 * @param {number} [opts.radius]  tap reach in world units. Default scales with the scene: 2% of
 *   the bounds diagonal, clamped to [0.4, 3.5] — contact-shadow range, never global gray.
 * @param {number} [opts.steps=4] taps along the normal (nearest tap dominates: weights 1/2^i).
 * @param {number} [opts.minAo=0.2] hard floor on the multiplier — corners never go black.
 * @param {number} [opts.kPerCell=64] max occluder faces listed per grid cell; overflow counted in
 *   the result's non-enumerable `aoStats`. Dropped occluders make dense spots read LIGHTER than
 *   truth (never darker) — measured on a 7k-face fractal-city: K=64 ≈ 120ms, raising K trades
 *   linearly more time for less overflow.
 * @param {Array} [opts.extraOccluders=[]] occluder-ONLY faces (typically instanceOccluderFaces
 *   phantoms) that cast onto the receivers but are never darkened or returned themselves.
 * @param {boolean|object} [opts.subdivide=false] contact pools on large receiver quads
 *   (renderer-convergence 1c): AO samples at face CORNERS only, so a crate mid-floor darkens
 *   its own base but casts nothing onto a single-quad floor (no vertex there to darken). With
 *   `subdivide`, a plain receiver quad whose edges exceed `maxEdge` (default 2R) is bake-time
 *   tessellated into a bilinear sub-grid — each sub-quad gets its own corner taps — and the
 *   sub-faces REPLACE the original ONLY when at least one darkened (an open floor far from
 *   everything keeps its single quad). `{ maxEdge?, cap? }` tunes it; `cap` (default 4096)
 *   bounds the total added sub-faces per bake, overflow counted in aoStats (never silent).
 * @returns {Array} faces, with `vao: [a0,a1,a2,a3]` on darkened receivers. NOTE: with
 *   `subdivide` the output may hold MORE faces than the input (pool tessellation).
 */
// ── in-process AO memoization (renderer-emitter.plan.md E6) ────────────────────────
// The bake re-runs on every render of the same recipe (692ms / 74k faces on the condo
// fixture) even though `vao` is a pure function of geometry + bake opts. Same recipe →
// same bake is guaranteed by the determinism invariant, so an in-process LRU is a
// CACHE, not persistence — nothing hits disk, recipes stay the source of truth. The key
// hashes exactly the inputs vao depends on (corners, authored normals, the
// receiver/occluder classification, opts, extra-occluder phantoms); colors are
// deliberately OUT of the key, so a re-themed world with identical geometry still hits.
// On a hit the FRESH input faces are re-mapped with the cached per-index vao arrays —
// no stale face objects ever cross emissions. `subdivide` bakes bypass the cache (the
// output face list changes shape); aoStats gains `cached:true` on hits so tests can see.
const AO_CACHE = new Map();
// 32: shared between WORLD bakes and per-suit `ao` bakes — the arena roster alone is 14
// figures, so 16 would let one map bake start evicting suit entries mid-session.
const AO_CACHE_MAX = 32;

function aoCacheKey(faces, extraOccluders, nums) {
  const f64 = new Float64Array(1);
  const u32 = new Uint32Array(f64.buffer);
  let h1 = 0x811c9dc5, h2 = 0x1000193;
  const mixInt = (x) => {
    h1 = (h1 ^ x) >>> 0; h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 = (h2 + x) >>> 0; h2 = Math.imul(h2 ^ (h2 >>> 15), 0x85ebca6b) >>> 0;
  };
  const mixNum = (x) => { f64[0] = x; mixInt(u32[0]); mixInt(u32[1]); };
  const mixFace = (f, tag) => {
    mixInt(tag);
    if (!f || !Array.isArray(f.corners)) { mixInt(0xdead); return; }
    for (const c of f.corners) { mixNum(c[0]); mixNum(c[1]); mixNum(c[2]); }
    if (Array.isArray(f.normal) && f.normal.length === 3) { mixInt(7); mixNum(f.normal[0]); mixNum(f.normal[1]); mixNum(f.normal[2]); }
    // input vao matters: bakeSkyShadow MULTIPLIES into it, so the same geometry with a
    // different upstream crevice bake must not alias (crevice-pass inputs never carry vao).
    if (Array.isArray(f.vao) && f.vao.length >= 4) { mixInt(9); mixNum(f.vao[0]); mixNum(f.vao[1]); mixNum(f.vao[2]); mixNum(f.vao[3]); }
    mixInt((isReceiver(f) ? 2 : 0) | (isOccluder(f) ? 1 : 0));
  };
  for (const n of nums) mixNum(n);
  mixInt(faces.length);
  for (const f of faces) mixFace(f, 1);
  mixInt(extraOccluders.length);
  for (const f of extraOccluders) mixFace(f, 2);
  return `${h1.toString(36)}:${h2.toString(36)}:${faces.length}`;
}

/**
 * bakeSkyShadow(faces, opts) → faces (new array; only darkened faces are new objects).
 *
 * The DIRECTIONAL sibling of the AO bake: top-light "roof" shadow. For each receiver corner,
 * rays (Möller–Trumbore over grid-culled candidates) ask "is there solid geometry overhead
 * within `reach`?" — a hit darkens the corner, scaled by how close the roof is (near roof ≈
 * full shadow, roof at `reach` ≈ none). This captures exactly the coverage the normal-tap AO
 * cannot: a face's own tangent plane hugs an up-ray (distance ~0 everywhere), so SDF taps
 * can't run skyward, but a parallel ray simply never intersects — only geometry truly
 * CROSSING the ray registers. Deterministic pure arithmetic, same discipline as the AO bake.
 *
 * Ray CONE (the boxy-build fix): a single vertical ray can't shade a VERTICAL surface under
 * an OUTBOARD overhang — a skirt plate hanging beside a thigh panel is parallel to the ray.
 * So each corner casts a small fan tilted from vertical TOWARD the face's OPEN side (up ·
 * up-and-out) — the same open-side convention as the AO taps above: an authored `normal`
 * wins (shell faces author it toward the room), else the winding. Rays never lean into the
 * solid side, so there are no false interior hits. Combined by MAX occlusion (see below);
 * the penumbra comes from the distance falloff.
 *
 * Composes with bakeAmbientOcclusion: existing `vao` factors are multiplied, not replaced.
 *
 * @param {Array} faces engine-agnostic face list, z-up world coords.
 * @param {object} [opts]
 * @param {number} [opts.reach]  how far overhead a roof still shades, world units. Default 8%
 *   of the bounds diagonal.
 * @param {number} [opts.strength=0.6] shadow depth at zero roof distance (0..1).
 * @param {number} [opts.minAo=0.25] hard floor on the combined multiplier.
 * @param {boolean} [opts.cone=true] cast the tilted fan (false → single vertical ray).
 * @param {number} [opts.kPerCell=64] max occluder faces per XY grid cell (overflow → lighter).
 */
// Sky-pass LRU (same discipline as AO_CACHE below): the pass is a pure function of geometry +
// input vao + opts, and the ray fan is the expensive half of a suit's `ao` bake (~3–5s at unit
// face counts) — a cache is what makes per-level arena resolves (a dozen figures) affordable.
const SKY_CACHE = new Map();
const SKY_CACHE_MAX = 32;   // sized with AO_CACHE_MAX — the arena roster is 14 figures

export function bakeSkyShadow(faces = [], opts = {}) {
  const { reach = null, strength = 0.6, minAo = 0.25, cone = true, kPerCell = 64 } = opts;
  const key = aoCacheKey(faces, [], [2, reach ?? -1, strength, minAo, cone ? 1 : 0, kPerCell]);
  const hit = SKY_CACHE.get(key);
  if (hit) {
    SKY_CACHE.delete(key); SKY_CACHE.set(key, hit);   // refresh LRU recency
    const out = faces.map((f, i) => (hit.vaos[i] ? { ...f, vao: hit.vaos[i] } : f));
    Object.defineProperty(out, 'skyStats', { value: { ...hit.stats, cached: true }, enumerable: false });
    return out;
  }
  const out = bakeSkyUncached(faces, { reach, strength, minAo, cone, kPerCell });
  if (out.skyStats) {
    SKY_CACHE.set(key, { vaos: out.map((f) => f.vao || null), stats: out.skyStats });
    if (SKY_CACHE.size > SKY_CACHE_MAX) SKY_CACHE.delete(SKY_CACHE.keys().next().value);
  }
  return out;
}

function bakeSkyUncached(faces = [], { reach = null, strength = 0.6, minAo = 0.25, cone = true, kPerCell = 64 } = {}) {
  const occIdx = [];
  for (let i = 0; i < faces.length; i++) if (isOccluder(faces[i])) occIdx.push(i);
  if (!occIdx.length) return faces.slice();

  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const i of occIdx) {
    for (const p of faces[i].corners) {
      if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
      if (p[2] < minZ) minZ = p[2]; if (p[2] > maxZ) maxZ = p[2];
    }
  }
  const diag = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) || 1;
  const R = Number.isFinite(reach) && reach > 0 ? reach : diag * 0.08;
  const eps = R * 0.02;   // skip the corner's own surface / coplanar neighbour tiles at t≈0

  // XY grid — a vertical ray culls by point-in-cell, so insertion covers each face's XY AABB.
  const cell = Math.max(1e-9, diag / 64);
  const cols = Math.max(1, Math.ceil((maxX - minX) / cell) + 1);
  const rows = Math.max(1, Math.ceil((maxY - minY) / cell) + 1);
  const cells = new Map();
  let overflow = 0;
  for (const i of occIdx) {
    const c = faces[i].corners;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of c) {
      if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
    }
    const c0 = Math.max(0, Math.floor((x0 - minX) / cell)), c1 = Math.min(cols - 1, Math.floor((x1 - minX) / cell));
    const r0 = Math.max(0, Math.floor((y0 - minY) / cell)), r1 = Math.min(rows - 1, Math.floor((y1 - minY) / cell));
    for (let r = r0; r <= r1; r++) {
      for (let ci = c0; ci <= c1; ci++) {
        const key = r * cols + ci;
        let list = cells.get(key);
        if (!list) { list = []; cells.set(key, list); }
        if (list.length >= kPerCell) { overflow++; continue; }
        list.push(i);
      }
    }
  }

  // Generic Möller–Trumbore along `dir` (unit), walking every XY grid cell the ray's
  // projection crosses (a tilted ray leaves its origin cell). Returns the nearest hit
  // distance in (eps, cap], or Infinity. `stamp`/`seen` dedupe faces across cells.
  const seen = new Int32Array(faces.length);
  let stamp = 0;
  const rayNear = (p, dx, dy, dz, cap, self) => {
    stamp++;
    let best = cap;
    let hit = false;
    const xyLen = Math.hypot(dx, dy);
    const steps = xyLen > 1e-9 ? Math.max(1, Math.ceil((xyLen * cap) / (cell * 0.5))) : 1;
    let lastKey = -1;
    for (let j = 0; j <= steps; j++) {
      const tj = (cap * j) / steps;
      const ci = Math.floor((p[0] + dx * tj - minX) / cell), ri = Math.floor((p[1] + dy * tj - minY) / cell);
      if (ci < 0 || ci >= cols || ri < 0 || ri >= rows) continue;
      const key = ri * cols + ci;
      if (key === lastKey) continue;
      lastKey = key;
      const list = cells.get(key);
      if (!list) continue;
      for (const i of list) {
        if (i === self || seen[i] === stamp) continue;
        seen[i] = stamp;
        const c = faces[i].corners;
        for (const t of TRIS) {
          const a = c[t[0]], b = c[t[1]], d = c[t[2]];
          const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
          const acx = d[0] - a[0], acy = d[1] - a[1], acz = d[2] - a[2];
          // h = dir × ac
          const hx = dy * acz - dz * acy, hy = dz * acx - dx * acz, hz = dx * acy - dy * acx;
          const det = abx * hx + aby * hy + abz * hz;
          if (det > -1e-12 && det < 1e-12) continue;   // ray parallel to the plane — no roof
          const inv = 1 / det;
          const sx = p[0] - a[0], sy = p[1] - a[1], sz = p[2] - a[2];
          const u = (sx * hx + sy * hy + sz * hz) * inv;
          if (u < 0 || u > 1) continue;
          // q = s × ab
          const qx = sy * abz - sz * aby, qy = sz * abx - sx * abz, qz = sx * aby - sy * abx;
          const v = (dx * qx + dy * qy + dz * qz) * inv;
          if (v < 0 || u + v > 1) continue;
          const tt = (acx * qx + acy * qy + acz * qz) * inv;
          if (tt > eps && tt < best) { best = tt; hit = true; }
        }
      }
    }
    return hit ? best : Infinity;
  };

  // fan angles from vertical toward the face normal — 0° (straight up) always; the tilted
  // pair only with `cone`, reaching outboard overhangs a vertical ray runs parallel to.
  const TILT = cone ? [0, 25 * Math.PI / 180, 50 * Math.PI / 180] : [0];

  const out = [];
  for (let fi = 0; fi < faces.length; fi++) {
    const f = faces[fi];
    if (!isReceiver(f)) { out.push(f); continue; }
    const c4 = f.corners;
    // outward direction for the fan: the authored normal (shell faces point at the room —
    // the open side) or the winding normal, flattened to XY (the tilt is a lean off vertical).
    const n = Array.isArray(f.normal) && f.normal.length === 3 ? f.normal : windingNormal(c4);
    let ox = 0, oy = 0;
    if (n) {
      const L = Math.hypot(n[0], n[1]);
      if (L > 1e-9) { ox = n[0] / L; oy = n[1] / L; }
    }
    const prev = Array.isArray(f.vao) && f.vao.length >= 4 ? f.vao : null;
    let vao = null;
    for (let k = 0; k < 4; k++) {
      // MAX occlusion across the fan: any ray finding a roof shades the corner (an averaged
      // fan dilutes a single outboard hit to invisibility); the penumbra comes from the
      // distance falloff, near roof ≈ full shadow.
      let occ = 0;
      for (const a of TILT) {
        const sA = Math.sin(a), cA = Math.cos(a);
        if (a > 0 && ox === 0 && oy === 0) continue;   // no lean axis (horizontal face) — the fan collapses to the vertical ray
        const t = rayNear(c4[k], ox * sA, oy * sA, cA, R, fi);
        if (t !== Infinity) { const o = 1 - t / R; if (o > occ) occ = o; }
      }
      const shade = Math.max(minAo, 1 - strength * occ);
      if (shade < 0.999) {
        if (!vao) vao = prev ? prev.slice() : [1, 1, 1, 1];
        vao[k] = Math.max(minAo, vao[k] * shade);
      }
    }
    out.push(vao ? { ...f, vao } : f);
  }
  Object.defineProperty(out, 'skyStats', {
    value: { reach: R, cells: cells.size, overflow },
    enumerable: false,
  });
  return out;
}

export function bakeAmbientOcclusion(faces = [], opts = {}) {
  const { subdivide = false, extraOccluders = [] } = opts;
  if (subdivide) return bakeAoUncached(faces, opts);   // tessellation reshapes the list — uncached
  const key = aoCacheKey(faces, Array.isArray(extraOccluders) ? extraOccluders : [],
    [1, opts.strength ?? 0.65, opts.radius ?? -1, opts.steps ?? 4, opts.minAo ?? 0.2, opts.kPerCell ?? 64]);
  const hit = AO_CACHE.get(key);
  if (hit) {
    AO_CACHE.delete(key); AO_CACHE.set(key, hit);      // refresh LRU recency
    const out = faces.map((f, i) => (hit.vaos[i] ? { ...f, vao: hit.vaos[i] } : f));
    Object.defineProperty(out, 'aoStats', { value: { ...hit.stats, cached: true }, enumerable: false });
    return out;
  }
  const out = bakeAoUncached(faces, opts);
  // cache only real bakes: the empty-field early return is already cheap and carries no
  // stats, and a length drift (impossible sans subdivide) must never alias by index.
  if (out.aoStats && out.length === faces.length) {
    AO_CACHE.set(key, { vaos: out.map((f) => f.vao || null), stats: out.aoStats });
    if (AO_CACHE.size > AO_CACHE_MAX) AO_CACHE.delete(AO_CACHE.keys().next().value);
  }
  return out;
}

function bakeAoUncached(faces = [], { strength = 0.65, radius = null, steps = 4, minAo = 0.2, kPerCell = 64, extraOccluders = [], subdivide = false } = {}) {
  // receivers keep their `faces` indices in the combined list, so own-face exclusion stays exact.
  const all = Array.isArray(extraOccluders) && extraOccluders.length ? faces.concat(extraOccluders) : faces;
  const field = buildOccluderField(all, { radius, kPerCell });
  if (!field) return faces.slice();
  const { sdfNear, R } = field;
  const weights = tapWeights(steps);
  const nSteps = weights.length;

  // per-corner occlusion for an arbitrary quad, tapping along the face's unit open-side normal;
  // returns a vao array or null when nothing darkened. `self` is the parent face's index in
  // `all` (sub-quads inherit it — they're coplanar with the parent, which self-cancels anyway).
  const darken = (corners, nx, ny, nz, self) => {
    const vao = [1, 1, 1, 1];
    let darkened = false;
    for (let k = 0; k < 4; k++) {
      const p = corners[k];
      let occ = 0;
      for (let s = 1; s <= nSteps; s++) {
        const d = (R * s) / nSteps;
        const q = [p[0] + nx * d, p[1] + ny * d, p[2] + nz * d];
        // own-face exclusion is exact (self index skipped); coplanar neighbours self-cancel
        // (they measure exactly d), so flat floors stay flat.
        const sd = sdfNear(q, d, self);
        occ += weights[s - 1] * Math.max(0, (d - sd) / d);
      }
      const ao = Math.max(minAo, 1 - strength * occ);
      if (ao < 0.999) { vao[k] = ao; darkened = true; }
    }
    return darkened ? vao : null;
  };

  const sub = subdivide ? (subdivide === true ? {} : subdivide) : null;
  const maxEdge = sub ? (Number.isFinite(sub.maxEdge) && sub.maxEdge > 0 ? sub.maxEdge : 2 * R) : 0;
  const subCap = sub ? (Number.isFinite(sub.cap) ? sub.cap : 4096) : 0;
  // only plain filled quads tessellate — clip/html/bg/card/texture faces carry surface content
  // a bilinear split would tear.
  const plainQuad = (f) => typeof f.fill === 'string' && !f.texture && !f.clip && !f.html && !f.bg && !f.card;
  let subFaces = 0, subdivided = 0, subOverflow = 0;

  const out = [];
  for (let fi = 0; fi < faces.length; fi++) {
    const f = faces[fi];
    if (!isReceiver(f)) { out.push(f); continue; }
    const c = f.corners;
    // open-side direction: an explicit face `normal` (shell faces author it toward the room —
    // the open side) wins; otherwise the authored winding.
    const n = Array.isArray(f.normal) && f.normal.length === 3 ? f.normal : windingNormal(c);
    if (!n) { out.push(f); continue; }
    const nl = Math.hypot(n[0], n[1], n[2]);
    if (nl < 1e-12) { out.push(f); continue; }
    const nx = n[0] / nl, ny = n[1] / nl, nz = n[2] / nl;

    if (sub && plainQuad(f)) {
      const eLen = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const uLen = Math.max(eLen(c[0], c[1]), eLen(c[3], c[2]));
      const vLen = Math.max(eLen(c[0], c[3]), eLen(c[1], c[2]));
      if (uLen > maxEdge || vLen > maxEdge) {
        const nu = Math.min(12, Math.ceil(uLen / maxEdge));
        const nv = Math.min(12, Math.ceil(vLen / maxEdge));
        if (subFaces + nu * nv > subCap) { subOverflow++; }
        else {
          const P = (u, v) => [0, 1, 2].map((k) =>
            (1 - v) * ((1 - u) * c[0][k] + u * c[1][k]) + v * ((1 - u) * c[3][k] + u * c[2][k]));
          const pieces = [];
          let any = false;
          for (let i = 0; i < nu; i++) {
            for (let j = 0; j < nv; j++) {
              const corners = [P(i / nu, j / nv), P((i + 1) / nu, j / nv), P((i + 1) / nu, (j + 1) / nv), P(i / nu, (j + 1) / nv)];
              const vao = darken(corners, nx, ny, nz, fi);
              if (vao) { any = true; pieces.push({ ...f, corners, vao }); }
              else pieces.push({ ...f, corners });
            }
          }
          // tessellate only where it bought a pool — an open quad keeps its single face
          if (any) { out.push(...pieces); subFaces += pieces.length; subdivided++; continue; }
        }
      }
    }

    const vao = darken(c, nx, ny, nz, fi);
    out.push(vao ? { ...f, vao } : f);
  }
  // stash query stats for callers/tests that care (non-enumerable — never serialized)
  Object.defineProperty(out, 'aoStats', {
    value: {
      radius: R, cells: field.cellCount, overflow: field.overflow,
      extraOccluders: Array.isArray(extraOccluders) ? extraOccluders.length : 0,
      ...(sub ? { subdivided, subFaces, subOverflow } : {}),
    },
    enumerable: false,
  });
  return out;
}
