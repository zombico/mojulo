/**
 * field-faces — the `fields` monomer: composition in FIELD SPACE, polygonized once.
 *
 * The other monomers are surface sweeps; each emits its own closed shell and they mix by
 * juxtaposition. A `fields` entry is one solid described as a TERM LIST read top-down
 * (`add` / `subtract` / `intersect` shapes, `stroke` dabs, `displace` noise, `shell`, `round`)
 * and surfaced by the surface-net polygonizer (field-mesh.js) — so cuts, pockets, bores,
 * blended masses and organic detail are recipe dials, not a Blender round trip.
 *
 * What it is NOT: a mesh CSG kernel. No half-edge, no intersection curves, no repair. Every
 * edge rounds to about one grid cell (`cells` along the longest side, default 64); a machined
 * edge is Manifold's (`export_model union:true`) or Blender's job. To cut INTO a lathe, author
 * the lathe as a `fields` term (its field twin), not as a `lathes` entry — the one mixing rule.
 *
 * Emits the face-list currency (`{ corners:[[x,y,z]…], fill, doubleSided, outNormal, group }`),
 * vexar-shaded on the field-gradient normal the polygonizer returns, `tagFacesWithMaterial`'d.
 * `group` = the id of the term whose shape is nearest at the face centroid, so `selectFaces`
 * and the panel-module ops can address a bore or a boss by name.
 *
 * Cost: cubic in `cells` (65³ ≈ 275k field evaluations at the default). MAX_FIELD_CELLS is the
 * hard backstop (the field-mesh twin of MAX_FACES_PER_LATHE). Closed by construction — a
 * non-zero boundary-edge count here is a BUG (bounds too tight), not a warning.
 *
 * Design: lite-template/integration/0904/field-solids.plan.md F3. Siblings: lathe-faces.js
 * (a face-list monomer), field-terms.js (the term library), field-mesh.js (the polygonizer).
 */

import { shadeHexMat, DEFAULT_LIGHT } from './vexar.js';
import { resolveMaterial, tagFacesWithMaterial } from './materials.js';
import { surfaceNetFaces } from './field-mesh.js';
import { composeFieldTerms, validateFieldTerms, padBounds } from './field-terms.js';
import { exactSupport } from './field-exact-reach.js';

// The exact kernel (field-exact.js) registers its renderer here once its WASM is loaded
// (`ensureExactKernel()`, awaited at the async seams). This module never imports it: field-faces
// is reachable from client bundles, and the kernel's package entry reads `node:module`.
let exactRenderer = null;
export function setExactFieldRenderer(fn) { exactRenderer = typeof fn === 'function' ? fn : null; }

const DEFAULT_CELLS = 64;
const MIN_FIELD_CELLS = 16;
const MAX_FIELD_CELLS = 128;
const BOUNDS_PAD_CELLS = 2;   // the surface must never graze the grid boundary (a truncated cell drops its quad)

/** Representative albedo. A spec's `style.fill`/`fill`/`tint` carries it; else a neutral. */
export function pickTint(spec) {
  return (spec && (spec.tint || spec.fill || (spec.style && spec.style.fill))) || '#9aa3b0';
}

const clampCells = (c) => (Number.isInteger(c) ? Math.max(MIN_FIELD_CELLS, Math.min(MAX_FIELD_CELLS, c)) : DEFAULT_CELLS);

/** Optional whole-solid translation (`translate:[x,y,z]`) — how an assembled field part stacks. */
function translated(term, t) {
  if (!Array.isArray(t) || t.length !== 3 || !t.every(Number.isFinite) || (t[0] === 0 && t[1] === 0 && t[2] === 0)) return term;
  const d = (p) => term.d({ x: p.x - t[0], y: p.y - t[1], z: p.z - t[2] });
  const b = term.bounds;
  const bounds = { min: { x: b.min.x + t[0], y: b.min.y + t[1], z: b.min.z + t[2] }, max: { x: b.max.x + t[0], y: b.max.y + t[1], z: b.max.z + t[2] } };
  const parts = term.parts.map((pt) => ({ ...pt, term: { d: (p) => pt.term.d({ x: p.x - t[0], y: p.y - t[1], z: p.z - t[2] }), bounds: pt.term.bounds } }));
  return { d, bounds, parts };
}

/** The grid a spec will be sampled on: { cells, cell (world units), bounds } — pure, no polygonizing. */
export function fieldGrid(spec = {}) {
  const composed = translated(composeFieldTerms(spec.terms), spec.translate);
  const cells = clampCells(spec.cells);
  const b = composed.bounds;
  const longest = Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);
  const cell = longest / cells;
  return { cells, cell, bounds: padBounds(b, cell * BOUNDS_PAD_CELLS), composed };
}

/**
 * fieldToFaces(spec, opts) → [{ corners, fill, doubleSided, outNormal, group }]
 *
 * spec: { terms:[…], cells?, translate?, tint?, material? }
 */
export function fieldToFaces(spec = {}, opts = {}) {
  // `exact: true` (field-exact.js): the same term list composed by Manifold — sharp edges in the
  // recipe itself. Opt-in, so every other entry is byte-identical to before.
  if (spec.exact === true) {
    if (!exactRenderer) throw new Error(`fields '${spec.id || ''}' asks for exact: true but the exact kernel is not loaded — the entry point must await ensureExactKernel() first, and manifold-3d must be installed (an optional creative dependency: \`npm install --include=optional\` in control/)`);
    return tagFacesWithMaterial(exactRenderer(spec, opts), opts.material ? resolveMaterial(opts.material) : null);
  }
  const light = opts.light || DEFAULT_LIGHT;
  const mat = opts.material ? resolveMaterial(opts.material) : null;
  const tint = opts.tint || spec.tint || spec.fill || (spec.style && spec.style.fill) || (mat && mat.base) || pickTint(spec);
  const shade = (hex, n) => shadeHexMat(hex, n, mat, { light });

  const { cells, bounds, composed } = fieldGrid(spec);
  const quads = surfaceNetFaces(composed.d, bounds, { cells });
  const parts = composed.parts;
  const faces = quads.map((q) => {
    const corners = q.corners.map((c) => [c.x, c.y, c.z]);
    let group;
    if (parts.length === 1) group = parts[0].id;
    else {
      const cen = { x: 0, y: 0, z: 0 };
      for (const c of q.corners) { cen.x += c.x / 4; cen.y += c.y / 4; cen.z += c.z / 4; }
      let best = Infinity;
      for (const pt of parts) { const dd = Math.abs(pt.term.d(cen)); if (dd < best) { best = dd; group = pt.id; } }
    }
    return { corners, fill: shade(tint, q.n), doubleSided: true, outNormal: q.n, group };
  });
  return tagFacesWithMaterial(faces, mat);
}

/** Validate `fields` specs (mirrors validateLathes / validateLofts). Returns an array of error strings. */
export function validateFields(fields, _emittedNodes) {
  const errors = [];
  if (!Array.isArray(fields)) return errors;
  fields.forEach((spec, i) => {
    const at = `fields[${i}]`;
    if (!spec || typeof spec !== 'object') { errors.push(`${at}: must be an object { terms, cells? }`); return; }
    if (spec.id !== undefined && (typeof spec.id !== 'string' || !spec.id)) errors.push(`${at}.id: must be a non-empty string when provided`);
    if (spec.cells !== undefined && !(Number.isInteger(spec.cells) && spec.cells >= MIN_FIELD_CELLS && spec.cells <= MAX_FIELD_CELLS)) {
      errors.push(`${at}.cells: must be an integer in [${MIN_FIELD_CELLS}, ${MAX_FIELD_CELLS}] when provided (grid cells along the longest side; cost is cubic — 64 for a live world, 96–128 for a hero render or export)`);
    }
    if (spec.translate !== undefined && !(Array.isArray(spec.translate) && spec.translate.length === 3 && spec.translate.every(Number.isFinite))) errors.push(`${at}.translate: must be [x, y, z] when provided`);
    if (spec.exact !== undefined && typeof spec.exact !== 'boolean') errors.push(`${at}.exact: must be true or false when provided`);
    if (spec.segments !== undefined && !(Number.isInteger(spec.segments) && spec.segments >= 8 && spec.segments <= 256)) errors.push(`${at}.segments: must be an integer in [8, 256] when provided (facets around a curved primitive under exact: true)`);
    errors.push(...validateFieldTerms(spec.terms, `${at}.terms`));
    if (spec.exact === true && Array.isArray(spec.terms)) {
      const reach = exactSupport(spec.terms, `${at}.terms`);
      if (!reach.ok) errors.push(`${at}.exact: ${reach.at} — ${reach.why}. An exact field takes the nine shapes, add / subtract / intersect without blend, transform and repeat; drop \`exact\` for a blended, stroked, noisy or warped solid.`);
    }
  });
  return errors;
}

export { DEFAULT_CELLS, MIN_FIELD_CELLS, MAX_FIELD_CELLS, BOUNDS_PAD_CELLS };
