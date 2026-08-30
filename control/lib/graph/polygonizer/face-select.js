/**
 * face-select — SEMANTIC selection over a baked face list.
 *
 * Every monomer in this directory lowers to the same record — `{ corners:[[x,y,z],…], fill,
 * doubleSided, outNormal, material?, group? }`. Once a solid is a face list, the interesting
 * question is no longer "how was it built" but "WHICH faces do I mean": the up-facing ones, the
 * hexagons, the ring around the equator, every third pentagon. Hand-numbering face indices is how
 * that gets answered today, and a hand-numbered index is a render-order accident — it silently
 * means a different face the moment the generator changes.
 *
 * This module is the answer as a PURE DERIVE: a face list plus a selector object in, integer
 * indices out. No geometry is built, nothing is mutated, nothing is rendered. That is deliberate —
 * it makes selection usable over EVERY face list mojulo already produces (workbench monomers,
 * fractal cities, dungeons, edifices, an imported .glb via glbToFaces), not just the faceted
 * shells it was written for.
 *
 * ```js
 * selectFaces(faces, { facing: '+z', within: 30 })      // up-facing, 30° cone
 * selectFaces(faces, { sides: 6 })                       // every hexagon
 * selectFaces(faces, { sides: 5, every: 3 })             // every third pentagon
 * selectFaces(faces, { ring: 'equator', band: 0.2 })
 * selectFaces(faces, { near: [1, 0, 0], count: 4 })      // the 4 faces most facing +x
 * selectFaces(faces, { group: 'panel', not: { facing: '-z' } })
 * ```
 *
 * Determinism is the whole contract (see the invariants below): a recipe that selects a set today
 * selects the same set forever, which is what lets face-ops carry an op list as a durable recipe.
 *
 * Design: faceted-shell.plan.md §A. Consumers: face-ops.js, shell-faces.js.
 */

import { norm3, dot3, centroid, newellNormal } from './vexar.js';

/** Named axis directions accepted by `facing` / `near`. */
export const AXIS_DIRECTIONS = {
  '+x': [1, 0, 0], '-x': [-1, 0, 0],
  '+y': [0, 1, 0], '-y': [0, -1, 0],
  '+z': [0, 0, 1], '-z': [0, 0, -1],
};
const AXIS_NAMES = Object.keys(AXIS_DIRECTIONS);

export const RING_BANDS = ['equator', 'top', 'bottom'];
export const SELECTOR_KEYS = ['facing', 'within', 'ring', 'band', 'sides', 'near', 'count', 'group', 'every', 'not', 'and'];

const DEFAULT_WITHIN = 45;   // degrees — the `facing` acceptance cone
const DEFAULT_BAND = 0.15;   // fraction of the model's z-extent a `ring` occupies
const DUP_EPS = 1e-9;

// ---------------------------------------------------------------------------
// face geometry helpers (exported — face-ops.js builds on these)
// ---------------------------------------------------------------------------

/**
 * A face's corners with consecutive duplicates (including the wrap-around pair) removed.
 *
 * Load-bearing: several existing emitters close a fan triangle as a 4-corner quad whose first and
 * last corner coincide (`[c, a, b, c]` in extrude-faces.js). Counting `corners.length` there would
 * call a triangle a quad, so `sides` — and every centroid/normal below — works off this instead.
 */
export function distinctCorners(face) {
  const pts = (face && Array.isArray(face.corners)) ? face.corners : [];
  const out = [];
  for (const p of pts) {
    if (!Array.isArray(p) || p.length < 3 || !p.every(Number.isFinite)) continue;
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev[0] - p[0]) < DUP_EPS && Math.abs(prev[1] - p[1]) < DUP_EPS && Math.abs(prev[2] - p[2]) < DUP_EPS) continue;
    out.push(p);
  }
  // wrap-around duplicate
  if (out.length > 1) {
    const a = out[0], b = out[out.length - 1];
    if (Math.abs(a[0] - b[0]) < DUP_EPS && Math.abs(a[1] - b[1]) < DUP_EPS && Math.abs(a[2] - b[2]) < DUP_EPS) out.pop();
  }
  return out;
}

/** Polygon corner count, duplicates collapsed (5 → pentagon, 6 → hexagon). */
export function faceSides(face) {
  return distinctCorners(face).length;
}

/** Centroid of the face's distinct corners, `[x,y,z]`. */
export function faceCenter(face) {
  const pts = distinctCorners(face);
  return pts.length ? centroid(pts) : [0, 0, 0];
}

/**
 * The face's outward normal. Prefers the authored `outNormal` (stamped by every monomer and
 * required by the GI bake — see scene/export-normals.plan.md); falls back to a Newell normal so
 * selection also works over legacy face lists that predate the stamp.
 */
export function faceNormal(face) {
  const n = face && face.outNormal;
  if (Array.isArray(n) && n.length === 3 && n.every(Number.isFinite) && Math.hypot(n[0], n[1], n[2]) > DUP_EPS) return norm3(n);
  const pts = distinctCorners(face);
  return pts.length >= 3 ? newellNormal(pts) : [0, 0, 1];
}

// ---------------------------------------------------------------------------
// selector plumbing
// ---------------------------------------------------------------------------

function resolveDirection(d, at) {
  if (typeof d === 'string') {
    if (!AXIS_DIRECTIONS[d]) throw new Error(`face-select: ${at} must be one of ${AXIS_NAMES.join(', ')} or a [x,y,z] vector — got '${d}'`);
    return AXIS_DIRECTIONS[d];
  }
  if (Array.isArray(d) && d.length === 3 && d.every(Number.isFinite) && Math.hypot(d[0], d[1], d[2]) > DUP_EPS) return norm3(d);
  throw new Error(`face-select: ${at} must be one of ${AXIS_NAMES.join(', ')} or a non-zero [x,y,z] vector`);
}

function assertSelector(selector) {
  if (selector == null) return {};
  if (typeof selector !== 'object' || Array.isArray(selector)) {
    throw new Error(`face-select: a selector must be an object (e.g. { facing:'+z' }) — got ${Array.isArray(selector) ? 'an array' : typeof selector}`);
  }
  const unknown = Object.keys(selector).filter((k) => !SELECTOR_KEYS.includes(k));
  if (unknown.length) {
    throw new Error(`face-select: unknown selector key${unknown.length > 1 ? 's' : ''} ${unknown.map((k) => `'${k}'`).join(', ')} — use one of: ${SELECTOR_KEYS.join(', ')}`);
  }
  return selector;
}

/**
 * The model's z-extent, measured over face CENTERS of the WHOLE input list.
 *
 * Measured over the whole list on purpose: it makes `ring` mean the same band regardless of what
 * other filters run alongside it, so `{ ring:'top', sides:6 }` is "hexagons in the model's top
 * band" and not "the top band of the hexagons".
 */
function zExtentOf(faces) {
  let min = Infinity, max = -Infinity;
  for (const f of faces) {
    const z = faceCenter(f)[2];
    if (z < min) min = z;
    if (z > max) max = z;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 0, span: 0 };
  return { min, max, span: max - min };
}

function modelCenter(faces) {
  const centers = faces.map((f) => faceCenter(f));
  return centers.length ? centroid(centers) : [0, 0, 0];
}

// ---------------------------------------------------------------------------
// selectFaces
// ---------------------------------------------------------------------------

/**
 * Resolve a selector against a face list → the matching face INDICES.
 *
 * Selector keys (all optional; multiple keys AND together):
 *   - `facing`  '+x'|'-x'|'+y'|'-y'|'+z'|'-z'|[x,y,z] — normal within `within` degrees (default 45)
 *   - `ring`    'equator'|'top'|'bottom' — a `band` fraction (default 0.15) of the model's z-extent
 *   - `sides`   polygon corner count (5 → pentagons, 6 → hexagons)
 *   - `group`   an existing `face.group` tag
 *   - `near`    a direction; with `count`, the N faces whose centers most align with it
 *   - `count`   truncate to N (ranked by alignment when `near` is present, else index order)
 *   - `every`   keep every Nth of the surviving selection
 *   - `not`     a sub-selector whose matches are excluded
 *   - `and`     a sub-selector to intersect with
 *
 * Returns `[]` when nothing matches — an empty selection is NOT an error here. The caller decides
 * whether that is a refusal (face-ops: yes, it means a broken recipe) or merely nothing to do.
 */
export function selectFaces(faces, selector = {}, _opts = {}) {
  const list = Array.isArray(faces) ? faces : [];
  const sel = assertSelector(selector);
  if (!list.length) return [];

  let idx = list.map((_, i) => i);

  if (sel.group !== undefined) {
    const want = sel.group;
    idx = idx.filter((i) => list[i] && list[i].group === want);
  }

  if (sel.sides !== undefined) {
    if (!Number.isInteger(sel.sides) || sel.sides < 3) throw new Error(`face-select: 'sides' must be an integer ≥ 3 — got ${JSON.stringify(sel.sides)}`);
    idx = idx.filter((i) => faceSides(list[i]) === sel.sides);
  }

  if (sel.facing !== undefined) {
    const dir = resolveDirection(sel.facing, "'facing'");
    const within = sel.within === undefined ? DEFAULT_WITHIN : sel.within;
    if (!Number.isFinite(within) || within <= 0 || within > 180) throw new Error(`face-select: 'within' must be a number in (0, 180] degrees — got ${JSON.stringify(sel.within)}`);
    const minDot = Math.cos((within * Math.PI) / 180);
    idx = idx.filter((i) => dot3(faceNormal(list[i]), dir) >= minDot - 1e-9);
  } else if (sel.within !== undefined) {
    throw new Error("face-select: 'within' only means something alongside 'facing'");
  }

  if (sel.ring !== undefined) {
    if (!RING_BANDS.includes(sel.ring)) throw new Error(`face-select: 'ring' must be one of ${RING_BANDS.join(', ')} — got '${sel.ring}'`);
    const band = sel.band === undefined ? DEFAULT_BAND : sel.band;
    if (!Number.isFinite(band) || band <= 0 || band > 1) throw new Error(`face-select: 'band' must be a fraction in (0, 1] of the model's z-extent — got ${JSON.stringify(sel.band)}`);
    const { min, max, span } = zExtentOf(list);
    // A flat model has no bands to speak of — every ring matches everything rather than nothing.
    if (span > DUP_EPS) {
      const width = span * band;
      const lo = sel.ring === 'top' ? max - width : sel.ring === 'bottom' ? min : (min + max) / 2 - width / 2;
      const hi = lo + width;
      idx = idx.filter((i) => {
        const z = faceCenter(list[i])[2];
        return z >= lo - DUP_EPS && z <= hi + DUP_EPS;
      });
    }
  } else if (sel.band !== undefined) {
    throw new Error("face-select: 'band' only means something alongside 'ring'");
  }

  if (sel.and !== undefined) {
    const keep = new Set(selectFaces(list, sel.and));
    idx = idx.filter((i) => keep.has(i));
  }

  if (sel.not !== undefined) {
    const drop = new Set(selectFaces(list, sel.not));
    idx = idx.filter((i) => !drop.has(i));
  }

  // `near` RANKS rather than filters — it reorders the survivors by alignment so `count` can take
  // the best N. Ties break on face index, so the order is total and reproducible.
  if (sel.near !== undefined) {
    const dir = resolveDirection(sel.near, "'near'");
    const origin = modelCenter(list);
    const score = new Map(idx.map((i) => {
      const c = faceCenter(list[i]);
      const v = [c[0] - origin[0], c[1] - origin[1], c[2] - origin[2]];
      const mag = Math.hypot(v[0], v[1], v[2]);
      // A face centered ON the model origin has no direction of its own — fall back to its normal.
      return [i, dot3(mag > DUP_EPS ? norm3(v) : faceNormal(list[i]), dir)];
    }));
    idx = idx.slice().sort((a, b) => (score.get(b) - score.get(a)) || (a - b));
  }

  if (sel.count !== undefined) {
    if (!Number.isInteger(sel.count) || sel.count < 0) throw new Error(`face-select: 'count' must be a non-negative integer — got ${JSON.stringify(sel.count)}`);
    idx = idx.slice(0, sel.count);
  }

  if (sel.every !== undefined) {
    if (!Number.isInteger(sel.every) || sel.every < 1) throw new Error(`face-select: 'every' must be an integer ≥ 1 — got ${JSON.stringify(sel.every)}`);
    idx = idx.filter((_, pos) => pos % sel.every === 0);
  }

  // `near` left the survivors in alignment order; everything downstream (face-ops, error messages)
  // expects face-list order, and re-sorting keeps the result independent of HOW it was narrowed.
  return sel.near !== undefined ? idx.slice().sort((a, b) => a - b) : idx;
}

// A minimal well-formed face list, so validateSelector can exercise every per-key check.
const SELECTOR_PROBE = [{ corners: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], outNormal: [0, 0, 1] }];

/**
 * Validate a selector without running it. Returns an error string, or null when well-formed —
 * the `validateMaterialRef` convention, so a bad selector can be refused at MINT (in a
 * `validate*` pass) rather than surfacing as an empty selection at render time.
 */
export function validateSelector(selector, at = 'select') {
  try {
    // Run against a one-face PROBE, not an empty list: selectFaces short-circuits on an empty list
    // before it ever reaches the per-key checks, so validating against [] would pass a selector
    // with a bad axis name or an out-of-range band.
    selectFaces(SELECTOR_PROBE, selector);
    return null;
  } catch (err) {
    return `${at}: ${err.message.replace(/^face-select: /, '')}`;
  }
}

/**
 * What a face list offers a selector — the raw material for "your selector matched nothing, here
 * is what IS here" errors. Counts are small and cheap; this is called on the failure path.
 */
export function describeFaces(faces) {
  const list = Array.isArray(faces) ? faces : [];
  const groups = new Map();
  const sides = new Map();
  for (const f of list) {
    const g = f && f.group;
    if (g !== undefined && g !== null) groups.set(g, (groups.get(g) || 0) + 1);
    const s = faceSides(f);
    if (s >= 3) sides.set(s, (sides.get(s) || 0) + 1);
  }
  const { min, max, span } = zExtentOf(list);
  return {
    count: list.length,
    groups: [...groups.entries()].sort((a, b) => (b[1] - a[1]) || String(a[0]).localeCompare(String(b[0]))).map(([name, n]) => ({ name, count: n })),
    sides: [...sides.entries()].sort((a, b) => a[0] - b[0]).map(([n, count]) => ({ sides: n, count })),
    zExtent: { min, max, span },
  };
}

/** One-line English summary of describeFaces(), for error messages. */
export function summarizeFaces(faces) {
  const d = describeFaces(faces);
  const groups = d.groups.length ? d.groups.map((g) => `'${g.name}'×${g.count}`).join(', ') : 'none';
  const sides = d.sides.length ? d.sides.map((s) => `${s.sides}-sided×${s.count}`).join(', ') : 'none';
  return `${d.count} faces — groups: ${groups}; polygons: ${sides}`;
}
