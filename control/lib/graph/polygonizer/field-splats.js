/**
 * field-splats — the SECOND emission off a signed-distance field
 * (field-splats.plan.md phase 1): oriented gaussians, for the soft register.
 *
 * The sibling of field-mesh.js, and deliberately its twin: same
 * `(field, bounds, opts)` contract, same uniform grid, same one-root-per-
 * sign-change-cell walk, same central-difference gradient. Where the surface
 * net folds those roots into quads, this pushes them OUT along the gradient in
 * fading shells. The two emissions therefore agree by construction — a coat
 * sits on the mesh it was grown from, with no registration step.
 *
 * Why a second primitive at all: a quad can only be a surface. Fur, pelage,
 * foliage and fluff are volume with no surface, so mojulo has been minting
 * strand GEOMETRY to fake them — figure-animal-pelage.js rebuilt its strands
 * twice (its header records flat blades reading as "angular spikes"), and the
 * result is reachable from exactly one line in the repo: a tail plume. The
 * raccoon, whose whole read is a bushy ringed tail, picks painted `tailBands`
 * over fur outright. The tuning was never the problem.
 *
 * What a splat is NOT: a surface. Nothing here declares one. Splats contribute
 * nothing to the T0-T4 world contract, are absent from the printable set, and
 * are skipped by the closure audit. A coat cannot break a print or move a tier
 * by construction, not by care.
 *
 * Placed, never trained: the field is known, so the gaussians are computed in
 * one pass rather than fitted from images. Deterministic — fixed loop order,
 * integer-hash dice, no Math.random, no clock. Same field + same coat →
 * byte-identical splats, forever.
 */

// ── the coat dial ─────────────────────────────────────────────────────────────
// Named for figure-animal-pelage.js's comb so the authoring intent carries over:
// loft lifts off the skin, flow combs toward `rear`, down is gravity, curl is the
// seeded side wisp. Those dials survive; what they drive changes.
export const COAT_DEFAULT = Object.freeze({
  depth: 0.05,          // how far the outermost shell stands off the surface (world units)
  layers: 4,            // shells, including the one seated ON the surface
  density: 1,           // ×  the surface-net cell count (1 = one root per surface-net vertex)
  spread: 2.4,          // outer-shell tangential radius ÷ the seated radius
  thickness: 0.22,      // seated normal-axis radius ÷ the tangential radius (a flat disc)
  puff: 2.0,            // outer-shell normal-axis growth ÷ seated (shells get rounder outward)
  falloff: 1.6,         // alpha decay exponent across the shells
  radius: 1.35,         // seated tangential radius ÷ the grid cell — see `seated` below
  bias: 0.35,           // outward standoff of the SEATED shell, ÷ the grid cell — see below
  keep: 0.55,           // fraction of roots carried into each shell past the first
  loft: 0.25,           // outward lift along the gradient, as a fraction of depth
  flow: 1.0,            // comb toward `rear`
  down: 0.5,            // gravity, world −z
  curl: 0.12,           // seeded side wisp
  jitter: 0.3,          // seeded positional scatter, as a fraction of the shell step
  rear: [0, -1, 0],     // body-rear in the field's own frame (hips at −y, per the pelage comb)
  likeColor: null,      // grow only where the surface is already this colour (see below)
  likeTol: 0.30,        // how far a face's fill may sit from `likeColor` and still wear coat
  color: null,          // base colour (hex) — null leaves it to the caller
  tipColor: null,       // outer-shell colour; null = base
  seed: 7,
});

// ── seeded dice: an integer spatial hash, never Math.random ───────────────────
function hash3(ix, iy, iz, salt) {
  let a = (Math.imul(ix, 73856093) ^ Math.imul(iy, 19349663) ^ Math.imul(iz, 83492791) ^ Math.imul(salt, 2654435761)) | 0;
  a = Math.imul(a ^ (a >>> 15), 1 | a);
  a ^= a + Math.imul(a ^ (a >>> 7), 61 | a);
  return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
}

// ── small vector kit ({x,y,z}, matching field-terms/field-mesh) ───────────────
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Tangent frame for a normal — deterministic branch, never a random perpendicular. */
function tangents(n) {
  const t1 = unit(Math.abs(n[2]) > 0.9 ? cross(n, [1, 0, 0]) : cross(n, [0, 0, 1]));
  return [t1, cross(n, t1)];
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Normalized RGB distance between two hexes — 0 identical, 1 opposite corners of the cube. */
function colorNear(a, b, tol) {
  if (typeof a !== 'string' || typeof b !== 'string' || a[0] !== '#' || b[0] !== '#') return true;
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16) / 255);
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16) / 255);
  if (pa.some(Number.isNaN) || pb.some(Number.isNaN)) return true;
  const d = Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]) / Math.sqrt(3);
  return d <= tol;
}

function lerpHex(a, b, t) {
  if (!a) return b || null;
  if (!b) return a;
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/**
 * The bounds a coat occupies — the field's own box grown by the worst-case reach.
 * Callers that hand the box to a renderer or a fit must grow it through here, the
 * same discipline field-terms.js applies to shell / round / displace.
 */
export function coatBounds(bounds, coat = {}) {
  const c = { ...COAT_DEFAULT, ...coat };
  const reach = c.depth * (1 + c.loft + Math.abs(c.down) + c.jitter) + c.depth * c.spread;
  return {
    min: { x: bounds.min.x - reach, y: bounds.min.y - reach, z: bounds.min.z - reach },
    max: { x: bounds.max.x + reach, y: bounds.max.y + reach, z: bounds.max.z + reach },
  };
}

/**
 * Grow a coat of gaussians on the field's iso-surface (field = 0) inside `bounds`.
 *
 * @param {(p:{x,y,z}) => number} field   signed distance (negative inside)
 * @param {{min:{x,y,z}, max:{x,y,z}}} bounds   must contain the SURFACE with margin
 *        (the coat may extend past it — see coatBounds)
 * @param {object} [coat]   COAT_DEFAULT knobs
 * @param {{cells?:number}} [opts]   grid cells along the longest side (default 64,
 *        matching surfaceNetFaces so roots coincide with its vertices)
 * @returns {Array<{c:number[], n:number[], t1:number[], t2:number[], scale:number[],
 *                  alpha:number, color:(string|null), shell:number}>}
 *          `scale` is the gaussian's radii along [t1, t2, n].
 */
export function surfaceSplats(field, bounds, coat = {}, opts = {}) {
  const c = { ...COAT_DEFAULT, ...coat };
  const baseCells = Number.isFinite(opts.cells) ? opts.cells : 64;
  const cells = Math.max(2, Math.round(baseCells * (c.density > 0 ? c.density : 1)));

  const ex = bounds.max.x - bounds.min.x, ey = bounds.max.y - bounds.min.y, ez = bounds.max.z - bounds.min.z;
  const longest = Math.max(ex, ey, ez);
  if (!(longest > 0)) return [];
  const h = longest / cells;
  const nx = Math.max(2, Math.ceil(ex / h)), ny = Math.max(2, Math.ceil(ey / h)), nz = Math.max(2, Math.ceil(ez / h));
  const px = nx + 1, py = ny + 1, pz = nz + 1;
  const gx = (i) => bounds.min.x + i * h, gy = (j) => bounds.min.y + j * h, gz = (k) => bounds.min.z + k * h;

  // 1. sample the field at every grid point — the surface net's step 1, verbatim
  const D = new Float64Array(px * py * pz);
  const at = (i, j, k) => D[(i * py + j) * pz + k];
  for (let i = 0; i < px; i++) for (let j = 0; j < py; j++) for (let k = 0; k < pz; k++) {
    D[(i * py + j) * pz + k] = field({ x: gx(i), y: gy(j), z: gz(k) });
  }

  // 2. one ROOT per sign-change cell, at the mean of its edge crossings — the surface
  //    net's step 2, verbatim, so every root coincides with a surface-net vertex and
  //    the coat lands on the mesh it was grown from with no registration step.
  const CELL_EDGES = [
    [0, 1], [2, 3], [4, 5], [6, 7],
    [0, 2], [1, 3], [4, 6], [5, 7],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const roots = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
    const d = [
      at(i, j, k), at(i + 1, j, k), at(i, j + 1, k), at(i + 1, j + 1, k),
      at(i, j, k + 1), at(i + 1, j, k + 1), at(i, j + 1, k + 1), at(i + 1, j + 1, k + 1),
    ];
    let inside = 0;
    for (const v of d) if (v <= 0) inside++;
    if (inside === 0 || inside === 8) continue;
    const corner = (q) => ({ x: gx(i + (q & 1)), y: gy(j + ((q >> 1) & 1)), z: gz(k + ((q >> 2) & 1)) });
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of CELL_EDGES) {
      const da = d[a], db = d[b];
      if ((da <= 0) === (db <= 0)) continue;
      const t = da / (da - db);
      const pa = corner(a), pb = corner(b);
      sx += pa.x + (pb.x - pa.x) * t; sy += pa.y + (pb.y - pa.y) * t; sz += pa.z + (pb.z - pa.z) * t;
      n++;
    }
    roots.push({ p: [sx / n, sy / n, sz / n], i, j, k });
  }

  // 3. the gradient normal — the surface net's gradAt, same eps convention
  const eps = h * 0.5;
  const gradAt = (p) => unit([
    field({ x: p[0] + eps, y: p[1], z: p[2] }) - field({ x: p[0] - eps, y: p[1], z: p[2] }),
    field({ x: p[0], y: p[1] + eps, z: p[2] }) - field({ x: p[0], y: p[1] - eps, z: p[2] }),
    field({ x: p[0], y: p[1], z: p[2] + eps }) - field({ x: p[0], y: p[1], z: p[2] - eps }),
  ]);

  // 4. grow the shells off those roots
  return growShells(roots.map((r) => ({ p: r.p, n: gradAt(r.p), k: [r.i, r.j, r.k] })), c, h);
}

/**
 * The shared shell grower. Roots are `{ p, n, k }` — a point on the surface, its outward
 * normal, and an integer key the seeded dice hash (so thinning and jitter are stable per
 * root, never per call order). `cell` is the root spacing, which sets the seated radius.
 */
function growShells(roots, c, cell, colorOf = null) {
  const layers = Math.max(1, Math.round(c.layers));
  // Seated tangential radius. A gaussian's NOMINAL radius is not its coverage: alpha is
  // already down to ~0.2 at 0.78 of it, so discs sized to the root spacing leave a regular
  // checker of gaps between neighbours (visible as mottling, and read as mange on a coat).
  // Size for the EFFECTIVE radius instead — the surface reads continuous from ~1.3x.
  const seated = cell * (c.radius > 0 ? c.radius : COAT_DEFAULT.radius);
  const rear = unit(Array.isArray(c.rear) && c.rear.length === 3 ? c.rear : [0, -1, 0]);
  const out = [];

  for (let s = 0; s < layers; s++) {
    const t = layers > 1 ? s / (layers - 1) : 0;         // 0 at the skin, 1 at the tips
    const alpha = Math.pow(1 - t, c.falloff);
    const rT = seated * (1 + (c.spread - 1) * t);        // tangential radius
    const rN = seated * c.thickness * (1 + (c.puff - 1) * t);

    for (let ri = 0; ri < roots.length; ri++) {
      const r = roots[ri];
      // thinning past the seated shell — seeded, stable per (root, shell)
      if (s > 0 && hash3(r.k[0], r.k[1], r.k[2], s * 7919) > c.keep) continue;

      const n = r.n;
      const [t1, t2] = tangents(n);
      // Every shell, the seated one included, stands off by `bias`. A splat sitting exactly
      // ON the surface is coplanar with the quad the surface net emits from the same root,
      // so it z-fights the body mesh and loses about half its fragments — which reads as a
      // coat that only survives at the silhouette. The standoff is in root spacings, so it
      // scales with the sampling rather than with the subject's size.
      const step = c.depth * t + cell * c.bias;

      // the comb: lift along the normal, then flow toward rear, then gravity, then a
      // seeded side wisp — figure-animal-pelage.js's dials, re-aimed.
      const side = cross(n, rear);
      const sideL = Math.hypot(side[0], side[1], side[2]);
      const wisp = sideL > 1e-6 ? unit(side) : t1;
      const curlAmt = (hash3(r.k[0], r.k[1], r.k[2], 104729) - 0.5) * 2 * c.curl * step;
      // the comb only bites where it is not pushing INTO the body
      const flowAmt = c.flow * step * (1 - clamp01(Math.abs(dot(n, rear))));
      const jx = (hash3(r.k[0], r.k[1], r.k[2], 15485863 + s) - 0.5) * c.jitter * step;
      const jy = (hash3(r.k[0], r.k[1], r.k[2], 32452843 + s) - 0.5) * c.jitter * step;
      const jz = (hash3(r.k[0], r.k[1], r.k[2], 49979687 + s) - 0.5) * c.jitter * step;

      const cx = r.p[0] + n[0] * step * (1 + c.loft) + rear[0] * flowAmt + wisp[0] * curlAmt + jx;
      const cy = r.p[1] + n[1] * step * (1 + c.loft) + rear[1] * flowAmt + wisp[1] * curlAmt + jy;
      const cz = r.p[2] + n[2] * step * (1 + c.loft) + rear[2] * flowAmt + wisp[2] * curlAmt - c.down * step + jz;

      const base = colorOf ? colorOf(ri) : c.color;
      const col = c.tipColor ? lerpHex(base, c.tipColor, t) : base;
      out.push({ c: [cx, cy, cz], n, t1, t2, scale: [rT, rT, rN], alpha, color: col, shell: s });
    }
  }
  return out;
}

/**
 * Grow a coat off an already-surfaced, already-transformed FACE list — the seam for
 * pipelines that surface their field upstream and then plant / light / recolour it
 * (the animal path: figure-render.js animalWorldFaces). Roots are face centroids,
 * normals are the authored `outNormal`, and each splat inherits its face's own `fill`,
 * so the coat carries the body's final colour for free.
 *
 * PRECONDITION, and it is not decorative: the faces must be FIELD-DERIVED — small,
 * uniform quads off a surface net. A coat grown off architecture (large flat rectangles
 * with straight edges) costs hundreds of gaussians per wall to reproduce what one quad
 * already had exactly, and frays the edge. Measured at 200x-2500x for no gain; see the
 * plan's out-of-scope. This function does not police that — the caller must.
 */
export function facesToSplats(faces, coat = {}) {
  const c = { ...COAT_DEFAULT, ...coat };
  const list = (Array.isArray(faces) ? faces : []).filter((f) => f && Array.isArray(f.corners) && f.corners.length >= 3);
  if (!list.length) return [];

  const roots = [];
  const fills = [];
  let spacingSum = 0;
  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    const pts = f.corners.map((q) => (Array.isArray(q) ? q : [q.x, q.y, q.z]));
    let px = 0, py = 0, pz = 0;
    for (const q of pts) { px += q[0]; py += q[1]; pz += q[2]; }
    const p = [px / pts.length, py / pts.length, pz / pts.length];

    let n = Array.isArray(f.outNormal) && f.outNormal.length === 3 ? unit(f.outNormal) : null;
    if (!n) {   // no authored normal: Newell over the polygon, sign from winding
      let wx = 0, wy = 0, wz = 0;
      for (let m = 0; m < pts.length; m++) {
        const a = pts[m], b = pts[(m + 1) % pts.length];
        wx += (a[1] - b[1]) * (a[2] + b[2]); wy += (a[2] - b[2]) * (a[0] + b[0]); wz += (a[0] - b[0]) * (a[1] + b[1]);
      }
      n = unit([wx, wy, wz]);
    }
    let reach = 0;
    for (const q of pts) reach = Math.max(reach, Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]));
    spacingSum += reach;

    // The dice key must be a stable function of WHERE the root is, not of its index —
    // else a face-order change reshuffles the whole coat and determinism means nothing.
    const q = 1 / Math.max(1e-6, reach);
    const fill = typeof f.fill === 'string' ? f.fill : (Array.isArray(f.cornerFills) ? f.cornerFills[0] : c.color);
    // ZONES. A coat does not grow on paw pads, nose leather, or eyes — and growing it there
    // is not merely wrong, it is ugly: those faces are painted a different colour, so the
    // tip lerp muddies them into dark blobs at exactly the places the eye checks first.
    // Mojulo already marks the furred region: the `coat` paint colorizes body + head and
    // leaves the extremities their own colours. So fur grows WHERE THE COAT PAINT IS —
    // tested by colour proximity rather than exact match, because countershading shifts
    // each face's fill a little. No `likeColor` ⇒ no filtering, and every face wears coat.
    if (c.likeColor && !colorNear(fill, c.likeColor, c.likeTol)) continue;
    roots.push({ p, n, k: [Math.round(p[0] * q), Math.round(p[1] * q), Math.round(p[2] * q)] });
    fills.push(fill);
  }
  if (!roots.length) return [];
  const cell = (spacingSum / roots.length) * 1.05;
  return growShells(roots, c, cell, (i) => fills[i] || c.color);
}
