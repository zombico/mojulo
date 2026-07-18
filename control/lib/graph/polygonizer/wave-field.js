/**
 * wave-field — 2D height-field primitive over a 4-corner quad in 3D
 * world space, sampled as a grid of 1px crest lines.
 *
 * Same discipline as line-between, raised one dimension:
 *   line-between → 1D curve between 2 points, polyline output.
 *   wave-field   → 2D surface over 4 corners, grid-of-polylines output.
 *
 * Use cases:
 *   - Hall / room floor with NO waves (the default) — renders as a flat
 *     bilinear quad sampled as a wavy grid with zero deflection. The
 *     "flat is still good" case is the zero-waves case; no special code.
 *   - Subtle hall-floor ripple — one low-amplitude component for a sense
 *     of an uneven stone surface, water table, etc.
 *   - Ocean wide-shot — a sum of swell + chop + capillary components
 *     produces a recognizable water field from a wide-angle camera.
 *
 * Authoring model (matches line-between's discipline):
 *   - One math primitive — superposition of plane waves in a 2D
 *     parameter space (u, v) ∈ [0,1]² that's bilinearly mapped to the
 *     quad in 3D.
 *   - Continuous parameters chosen by the model (amplitude, cycles,
 *     phase) — no closed vocabulary of named "ocean kinds."
 *   - Scene-global physics carries the default displacement direction
 *     (gravity, since a horizontal field's waves lift/lower along it).
 */

/**
 * Validate a list of wave-field specs against a walker's emitted nodes.
 * Checks that each field carries a 4-corner array and that every corner
 * path resolves via the shared endpoint resolver. Returns a flat array
 * of error strings (empty when valid).
 */
import { buildEndpointResolver } from './line-between.js';

export function validateWaveFields(waveFields, emittedNodes) {
  const errors = [];
  if (!Array.isArray(waveFields)) return errors;
  const resolveEndpoint = buildEndpointResolver(emittedNodes);
  waveFields.forEach((spec, i) => {
    if (!spec || typeof spec !== 'object') {
      errors.push(`waveFields[${i}]: must be an object with corners[]`);
      return;
    }
    if (!Array.isArray(spec.corners) || spec.corners.length !== 4) {
      errors.push(`waveFields[${i}].corners: must be a 4-element array of endpoint paths or {x,y,z} points`);
      return;
    }
    spec.corners.forEach((corner, j) => {
      if (corner && Number.isFinite(corner.x) && Number.isFinite(corner.y) && Number.isFinite(corner.z)) {
        return;
      }
      try {
        resolveEndpoint(corner);
      } catch (err) {
        errors.push(`waveFields[${i}].corners[${j}]: ${err.message}`);
      }
    });
    if (spec.waves !== undefined && !Array.isArray(spec.waves)) {
      errors.push(`waveFields[${i}].waves: must be an array when provided`);
    }
    if (spec.heightField !== undefined) {
      if (typeof spec.heightField !== 'string' || spec.heightField.length === 0) {
        errors.push(`waveFields[${i}].heightField: must be a non-empty string field id when provided`);
      }
      if (Array.isArray(spec.waves) && spec.waves.length > 0) {
        errors.push(`waveFields[${i}]: heightField and a non-empty waves array are mutually exclusive — author a sum field to combine them`);
      }
    }
  });
  return errors;
}

/**
 * Cross-validate that every wave-field spec's `heightField` (when
 * present) points at a field id declared in the merged fields map.
 * Runs after validateFields and after collectMergedFields. Mirrors
 * validateWaveManjiFieldRefs.
 */
export function validateWaveFieldsFieldRefs(waveFields, mergedFields) {
  const errors = [];
  if (!Array.isArray(waveFields)) return errors;
  const known = new Set(
    mergedFields && typeof mergedFields === 'object' ? Object.keys(mergedFields) : [],
  );
  waveFields.forEach((spec, i) => {
    if (typeof spec?.heightField !== 'string') return;
    if (!known.has(spec.heightField)) {
      const available = [...known].join(', ') || '<none>';
      errors.push(
        `waveFields[${i}].heightField: unknown field '${spec.heightField}' (available: ${available})`,
      );
    }
  });
  return errors;
}

/**
 * Sample a wave field on a (Nu+1) × (Nv+1) grid in (u, v) space and
 * return the world-XYZ points plus the crest-line polylines that
 * connect them. The renderer projects each polyline like any other
 * world-XYZ samples.
 *
 * Output shape:
 *   {
 *     gridPoints: Point3D[][],       // [iu][iv] = displaced world XYZ
 *     isoUPolylines: Point3D[][],    // one polyline per iso-u line (constant u)
 *     isoVPolylines: Point3D[][],    // one polyline per iso-v line (constant v)
 *     displacementDir: { x, y, z },  // normalized
 *   }
 *
 * Spec shape (all optional except corners):
 *   {
 *     corners,                   // [{x,y,z}, ...] × 4 (CCW from u=0,v=0)
 *     waves?: [{ amplitude, cycles: {u,v}, phase? }],
 *     displacement?: {x,y,z},    // override direction; default = gravity
 *     samples?: { u, v },        // grid density; defaults 16×16
 *   }
 */
export function sampleWaveField(spec, physics, resolvedCorners, heightFn = null) {
  if (!spec || typeof spec !== 'object') {
    throw new Error('sampleWaveField: spec object required');
  }
  if (!Array.isArray(resolvedCorners) || resolvedCorners.length !== 4) {
    throw new Error('sampleWaveField: 4 resolved corners required');
  }
  const [C0, C1, C2, C3] = resolvedCorners;
  const Nu = Math.max(2, Math.floor(spec.samples?.u ?? 16));
  const Nv = Math.max(2, Math.floor(spec.samples?.v ?? 16));
  const waves = Array.isArray(spec.waves) ? spec.waves : [];
  const gravity = physics?.gravity || { x: 0, y: 0, z: -1 };
  const displacementDir = normalize3(
    isFiniteVec(spec.displacement) ? spec.displacement : gravity,
  );
  // When a heightFn is provided (from the caller's field resolver),
  // replace the inline waveHeight(u, v, waves) call with the field
  // evaluated at each grid sample's bilinear-interpolated base point.
  // Same scalar semantics — displacement-axis offset, not absolute
  // world position — so wave-surface fields with z=0 corners produce
  // the same visible surface they always have.
  const useHeightFn = typeof heightFn === 'function';

  const gridPoints = new Array(Nu + 1);
  for (let iu = 0; iu <= Nu; iu += 1) {
    gridPoints[iu] = new Array(Nv + 1);
    const u = iu / Nu;
    for (let iv = 0; iv <= Nv; iv += 1) {
      const v = iv / Nv;
      const base = bilinear(C0, C1, C2, C3, u, v);
      const h = useHeightFn ? heightFn(base) : waveHeight(u, v, waves);
      gridPoints[iu][iv] = add3(base, scale3(displacementDir, h));
    }
  }

  // Iso-u polylines: constant u, varying v.
  const isoUPolylines = [];
  for (let iu = 0; iu <= Nu; iu += 1) {
    const polyline = new Array(Nv + 1);
    for (let iv = 0; iv <= Nv; iv += 1) polyline[iv] = gridPoints[iu][iv];
    isoUPolylines.push(polyline);
  }
  // Iso-v polylines: constant v, varying u.
  const isoVPolylines = [];
  for (let iv = 0; iv <= Nv; iv += 1) {
    const polyline = new Array(Nu + 1);
    for (let iu = 0; iu <= Nu; iu += 1) polyline[iu] = gridPoints[iu][iv];
    isoVPolylines.push(polyline);
  }

  return { gridPoints, isoUPolylines, isoVPolylines, displacementDir };
}

/**
 * Sum of plane waves in (u, v) parameter space, returning a scalar
 * height. Zero waves → zero height (flat surface). The model authors
 * each component independently; superposition is the substrate's job.
 */
function waveHeight(u, v, waves) {
  let h = 0;
  for (const w of waves) {
    if (!w || typeof w !== 'object') continue;
    const amp = Number.isFinite(w.amplitude) ? w.amplitude : 0;
    if (amp === 0) continue;
    const cu = Number.isFinite(w.cycles?.u) ? w.cycles.u : 0;
    const cv = Number.isFinite(w.cycles?.v) ? w.cycles.v : 0;
    const phase = Number.isFinite(w.phase) ? w.phase : 0;
    h += amp * Math.sin(2 * Math.PI * (cu * u + cv * v) + phase);
  }
  return h;
}

function bilinear(C0, C1, C2, C3, u, v) {
  // Corner ordering, CCW starting from (u=0, v=0):
  //   C0 = (0,0), C1 = (1,0), C2 = (1,1), C3 = (0,1)
  const w0 = (1 - u) * (1 - v);
  const w1 = u * (1 - v);
  const w2 = u * v;
  const w3 = (1 - u) * v;
  return {
    x: w0 * C0.x + w1 * C1.x + w2 * C2.x + w3 * C3.x,
    y: w0 * C0.y + w1 * C1.y + w2 * C2.y + w3 * C3.y,
    z: w0 * C0.z + w1 * C1.z + w2 * C2.z + w3 * C3.z,
  };
}

// ─── 3D vector helpers (internal) ─────────────────────────────────────

function add3(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function scale3(a, k) { return { x: a.x * k, y: a.y * k, z: a.z * k }; }
function normalize3(v) {
  const len = Math.hypot(v.x, v.y, v.z);
  if (len < 1e-12) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}
function isFiniteVec(v) {
  return v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

// ─── drape sheet — a hanging cloth SHEET over ANY form ────────────────
// The FORM-AGNOSTIC kernel behind both the human wardrobe (buildWaveDrape in
// figure-garments.js) and the manji `drapes[]` covering (any polygonized form).
// A drape is a wave-field specialized into cloth: a top edge PINNED to two anchor
// points, hem corners flared + dropped (sag baked in, no solver), a rest fold
// superposition, and a pin→free envelope (folds grow 0 at the pinned edge → 1 at
// the free hem). It takes EXPLICIT anchor points — nothing here knows about a
// human body, so the same kernel drapes a shoulder cape, a horse's caparison, or
// a cloth over a table. Returns the sheet as ring-stacks (for lit-face meshers)
// AND as iso-u/iso-v polylines (for the manji stroke renderer).

// Default rest folds: u = across the width, v = down the drop. Folds run VERTICAL
// (cycle across u, ~constant down v) so cloth reads as pleats, not a cross-hatch.
export const DEFAULT_DRAPE_FOLDS = [
  { amplitude: 1.15, cycles: { u: 3.0, v: 0.35 }, phase: 0 },
  { amplitude: 0.50, cycles: { u: 6.0, v: 0.60 }, phase: 1.1 },
  { amplitude: 0.20, cycles: { u: 11.0, v: 0.0 }, phase: 2.0 },
];

const _smooth01 = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
const _polyCentroid = (poly) => {
  const c = { x: 0, y: 0, z: 0 };
  for (const p of poly) { c.x += p.x; c.y += p.y; c.z += p.z; }
  return { x: c.x / poly.length, y: c.y / poly.length, z: c.z / poly.length };
};

/**
 * Build a draped sheet from an explicit top edge (cL, cR) and drape dials.
 * @param {object} opts
 * @param {{x,y,z}} opts.cL, opts.cR   the two pinned top-edge anchor points
 * @param {'back'|'front'} [opts.hang]  which way the sheet falls (−/+ the edge normal axis, y)
 * @param {number} [opts.back=1.0]      standoff of the whole sheet off the form
 * @param {number} [opts.drop=3.0]      how far the hem swings past `back`
 * @param {number} [opts.flare=1.32]    hem widening about the top-edge MIDPOINT (form-agnostic)
 * @param {number} [opts.hemZ]          absolute hem height; default = cL.z * 0.16
 * @param {number} [opts.spread=1]      widen/narrow the top edge about its midpoint
 * @param {Array}  [opts.waves]         rest folds (default DEFAULT_DRAPE_FOLDS)
 * @param {boolean}[opts.pinToFree=true] fold envelope 0 at the pinned edge → 1 at the hem
 * @param {{u,v}}  [opts.samples]       grid density (default 22×30)
 * @param {{x,y,z}}[opts.displacement]  fold axis; default = the corner-quad normal
 * @returns {{ rings, isoUPolylines, isoVPolylines, corners }}
 */
export function drapeSheet(opts = {}) {
  let { cL, cR } = opts;
  if (!isFiniteVec(cL) || !isFiniteVec(cR)) throw new Error('drapeSheet: cL and cR anchor points are required');
  const {
    hang = 'back', back = 1.0, drop = 3.0, flare = 1.32, hemZ = null, spread = 1,
    waves = DEFAULT_DRAPE_FOLDS, pinToFree = true, samples = { u: 22, v: 30 },
    displacement = null, physics = null,
  } = opts;
  // spread widens/narrows the pinned edge about its midpoint (a narrow neck → a cowl).
  if (spread !== 1) {
    const mx = (cL.x + cR.x) / 2, my = (cL.y + cR.y) / 2;
    cL = { x: mx + (cL.x - mx) * spread, y: my + (cL.y - my) * spread, z: cL.z };
    cR = { x: mx + (cR.x - mx) * spread, y: my + (cR.y - my) * spread, z: cR.z };
  }
  const s = hang === 'front' ? -1 : 1;                             // 'back' (s=1) is the canonical cape case
  const hz = hemZ != null ? hemZ : cL.z * 0.16;
  const midX = (cL.x + cR.x) / 2;
  const fx = (x) => midX + (x - midX) * flare;                     // flare about the MIDPOINT, not world origin
  // corners CCW from (u=0,v=0): top-left → top-right → hem-right → hem-left.
  const C0 = { x: cL.x, y: cL.y - s * back, z: cL.z };
  const C1 = { x: cR.x, y: cR.y - s * back, z: cR.z };
  const C2 = { x: fx(cR.x), y: cR.y - s * (back + drop), z: hz };
  const C3 = { x: fx(cL.x), y: cL.y - s * (back + drop), z: hz };
  const corners = [C0, C1, C2, C3];
  // fold axis = the corner-quad out-of-plane normal (cloth flaps toward/away from the form)
  let disp = displacement;
  if (!isFiniteVec(disp)) {
    const e1 = { x: C1.x - C0.x, y: C1.y - C0.y, z: C1.z - C0.z };
    const e2 = { x: C3.x - C0.x, y: C3.y - C0.y, z: C3.z - C0.z };
    const nx = e1.y * e2.z - e1.z * e2.y, ny = e1.z * e2.x - e1.x * e2.z, nz = e1.x * e2.y - e1.y * e2.x;
    const nl = Math.hypot(nx, ny, nz) || 1;
    disp = { x: nx / nl, y: ny / nl, z: nz / nl };
  }
  const phys = physics || { gravity: { x: 0, y: 0, z: -1 } };
  const flat = sampleWaveField({ samples, waves: [], displacement: disp }, phys, corners).gridPoints;
  const wavy = sampleWaveField({ samples, waves, displacement: disp }, phys, corners).gridPoints;
  const Nu = flat.length - 1, Nv = flat[0].length - 1;
  const grid = [];                                                 // [iu][iv] pin→free-blended points
  for (let iu = 0; iu <= Nu; iu++) {
    const row = [];
    for (let iv = 0; iv <= Nv; iv++) {
      const env = pinToFree ? _smooth01(iv / Nv) : 1;
      const f = flat[iu][iv], w = wavy[iu][iv];
      row.push({ x: f.x + (w.x - f.x) * env, y: f.y + (w.y - f.y) * env, z: f.z + (w.z - f.z) * env });
    }
    grid.push(row);
  }
  const rings = grid.map((poly) => ({ center: _polyCentroid(poly), polyline: poly }));   // one ring per iso-u line
  const isoUPolylines = grid.map((row) => row.slice());                                  // constant u, varying v
  const isoVPolylines = [];                                                              // constant v, varying u
  for (let iv = 0; iv <= Nv; iv++) { const line = []; for (let iu = 0; iu <= Nu; iu++) line.push(grid[iu][iv]); isoVPolylines.push(line); }
  return { rings, isoUPolylines, isoVPolylines, corners };
}
