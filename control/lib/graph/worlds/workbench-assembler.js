/**
 * workbench-assembler — compose several finished workbench PARTS into one worldspace.
 *
 *   Assembler makes a chariot. Workbench makes chariot parts.
 *   A chariot is a combination of chariot parts; a part is whatever the workbench can output that
 *   makes sense as ONE part. Workbench's invariant is single-subject, so it cannot honestly build
 *   "something complicated" — the assembler is the ring above it: it takes several whole workbench
 *   manifests and places them in a shared, meru-scaled worldspace.
 *
 * The MAIN move is REPOSITION. Each part was authored alone at its own origin; imported as-is they
 * all sit at [0,0,0] (a pile, not a chariot). Placement has two modes: GRAVITY SEATING (`on`/`gap`)
 * is the standard — a part drops so its lowest point (measured AFTER rotate/flip/scale) rests on the
 * ground or on an earlier part, so you never hand-compute a lift; SUPERPOSITION (absolute `at` z) is
 * the allowed non-standard fallback for parts that bridge (a chariot's bed sits between its wheels,
 * not on the floor). `repeat` is reposition automated (one spindle → a banister), and
 * `rotate`/`flip`/`scale` are per-item adjustments on top of a placement (peg → spindle).
 *
 * Source policy — FROZEN at import. An item's `source` is a literal workbench manifest stored
 * inline in the assembler (the mint tool resolves any `{ref}` into an inline copy). No binding, no
 * live refs, no staleness question. Re-mint = re-import + redo; an honest cost, not a bug.
 *
 * It rides the workbench's existing seams: each part lowers through the same monomer→faces bake
 * (`lowerObjectFaces`), and the merged faces stage through the same measured studio vantage
 * (`studioSceneFromFaces`) the workbench gives a single object — same /world + /scene routes,
 * same neutral studio light.
 *
 * Stored manifest (the recipe):
 *   { kind:'assembler', title?, units?, viewBox?, items:[ <placed item> … ] }
 * A placed item:
 *   { source:{ lathes?, extrudes?, sweeps? },   // a frozen workbench part
 *     id?:string,             // name this part so a later part can rest `on` it
 *     at?:[x,y,z],            // REPOSITION — x/y always; z used only as superposition fallback
 *     on?:'ground'|id|index,  // GRAVITY SEAT — drop the part to rest on this support (standard)
 *     gap?:number,            // lift above the support (default 0)
 *     rotate?:[rx,ry,rz],     // orient, degrees (applied Rz·Ry·Rx, after flip)
 *     flip?:'x'|'y'|'z'|'xy'…,// mirror on axes (peg→spindle); any combo of x/y/z
 *     scale?:number,          // uniform nudge within the shared meru scale (default 1)
 *     repeat?:{ count, step:[dx,dy,dz] } }  // linear array — the same part at stepped positions
 *
 * Design: control/lib/graph/workbench-assembler.plan.md.
 */

import { lowerObjectFaces, studioSceneFromFaces, WORKBENCH_LIGHT, bakeBoundSkinFaces } from './workbench.js';
import { emitPreserve3dScene } from '../scene/scene-css3d.js';
import { makeLight } from '../polygonizer/vexar.js';

const DEG = Math.PI / 180;

// ---- small 3×3 linear-algebra helpers (euler + flip → one orientation matrix) ----------------
const matMul = (A, B) => A.map((row, i) => B[0].map((_, j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));
const matVec = (M, v) => [M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2], M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2], M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]];
const transpose = (M) => [[M[0][0], M[1][0], M[2][0]], [M[0][1], M[1][1], M[2][1]], [M[0][2], M[1][2], M[2][2]]];
const IDENT = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

function rotX(a) { const c = Math.cos(a); const s = Math.sin(a); return [[1, 0, 0], [0, c, -s], [0, s, c]]; }
function rotY(a) { const c = Math.cos(a); const s = Math.sin(a); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; }
function rotZ(a) { const c = Math.cos(a); const s = Math.sin(a); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; }

// flip string ('x' | 'z' | 'xy' | …) → a diagonal reflection matrix (mirror the listed axes).
function flipMatrix(flip) {
  if (!flip || typeof flip !== 'string') return IDENT;
  const f = flip.toLowerCase();
  return [[f.includes('x') ? -1 : 1, 0, 0], [0, f.includes('y') ? -1 : 1, 0], [0, 0, f.includes('z') ? -1 : 1]];
}

/**
 * The item's orientation matrix A = R · F (flip in the part's local frame, then rotate). Returns
 * the identity for a plain reposition/scale item — the common case stays a no-op.
 */
function orientationMatrix(item) {
  const r = Array.isArray(item.rotate) ? item.rotate : null;
  const hasRot = r && (r[0] || r[1] || r[2]);
  const F = flipMatrix(item.flip);
  if (!hasRot) return F;
  // Rz·Ry·Rx applied to a column vector (intrinsic-looking, deterministic).
  const R = matMul(rotZ((r[2] || 0) * DEG), matMul(rotY((r[1] || 0) * DEG), rotX((r[0] || 0) * DEG)));
  return matMul(R, F);
}

/**
 * Bake ONE part with its orientation (rotate/flip) + scale applied but NO translate — so the caller
 * can read its post-transform z-extent for gravity seating before deciding where to drop it.
 * Reposition/scale are orientation-invariant, so they're exact; for rotate/flip we relight: a
 * directional flat-shaded face reads `normal·toLight`, and rotating geometry by A rotates its
 * normals by A — so baking with light direction Aᵀ·dir and THEN rotating the geometry by A leaves
 * every face lit exactly as WORKBENCH_LIGHT would light it in the final orientation. (Faces are
 * doubleSided, so a mirror's winding flip needs no special handling.)
 */
function bakeOriented(item) {
  const source = item && item.source && typeof item.source === 'object' ? item.source : {};
  const A = orientationMatrix(item);
  const isIdentity = A === IDENT;
  const light = isIdentity
    ? WORKBENCH_LIGHT
    : makeLight({ direction: matVec(transpose(A), WORKBENCH_LIGHT.dir), ambient: WORKBENCH_LIGHT.ambient, diffuse: WORKBENCH_LIGHT.diffuse });
  const s = Number.isFinite(item.scale) ? item.scale : 1;
  return lowerObjectFaces(source, light).map((f) => ({
    ...f,
    corners: f.corners.map((c) => {
      const v = isIdentity ? c : matVec(A, c);
      return [v[0] * s, v[1] * s, v[2] * s];
    }),
  }));
}

/** Post-orientation z-extent of a baked part (the seating math needs only z). */
function zExtent(faces) {
  let min = Infinity; let max = -Infinity;
  for (const f of faces) for (const c of f.corners) { if (c[2] < min) min = c[2]; if (c[2] > max) max = c[2]; }
  return faces.length ? { min, max } : { min: 0, max: 0 };
}

/** Expand an item's `repeat` into per-copy translate offsets (the banister: same part, stepped). */
function repeatOffsets(item) {
  const rep = item && item.repeat && typeof item.repeat === 'object' ? item.repeat : null;
  const count = rep && Number.isFinite(rep.count) ? Math.max(1, Math.floor(rep.count)) : 1;
  const step = rep && Array.isArray(rep.step) ? rep.step : [0, 0, 0];
  return Array.from({ length: count }, (_, k) => [step[0] * k, step[1] * k, step[2] * k]);
}

/**
 * Walk the items in order, resolving each one's placement and threading a running top-of-stack z so
 * later parts can rest on earlier ones. Returns the merged faces AND a per-item placement readout.
 *
 * GRAVITY SEATING (`on`/`gap`) is the standard move: a part's resolved z drops it so its lowest
 * point — measured AFTER rotate/flip/scale, which is what makes this richer than the workbench's
 * monomer-level `on` — rests on its support (`'ground'` = z 0, or an earlier item's id/index top),
 * lifted by `gap`. SUPERPOSITION (absolute `at` z) is the allowed non-standard fallback used when no
 * `on` is given. `at` always supplies x/y; with `on`, the z from `at` is ignored. A `repeat` arrays
 * the seated base part by `step` (so you seat the first, then step).
 */
function walkAssembler(manifest = {}) {
  const items = Array.isArray(manifest.items) ? manifest.items : [];
  const tops = new Map();              // item id / index → top-of-stack world z
  const faces = [];
  const placements = [];

  items.forEach((item, index) => {
    const oriented = bakeOriented(item);
    const { min: zmin, max: zmax } = zExtent(oriented);
    const at = Array.isArray(item.at) ? item.at : [0, 0, 0];
    const gap = Number.isFinite(item.gap) ? item.gap : 0;

    let translateZ;
    let supportTop = null;
    if (item.on != null) {
      supportTop = item.on === 'ground' ? 0 : (tops.has(item.on) ? tops.get(item.on) : 0);
      translateZ = supportTop + gap - zmin;        // drop so the lowest point rests on the support
    } else {
      translateZ = Number.isFinite(at[2]) ? at[2] : 0;   // superposition: explicit z
    }

    const offsets = repeatOffsets(item);
    let itemTop = -Infinity;
    for (const off of offsets) {
      const tx = at[0] + off[0];
      const ty = at[1] + off[1];
      const tz = translateZ + off[2];
      for (const f of oriented) faces.push({ ...f, corners: f.corners.map(([x, y, z]) => [x + tx, y + ty, z + tz]) });
      if (zmax + tz > itemTop) itemTop = zmax + tz;
    }
    if (itemTop === -Infinity) itemTop = zmax + translateZ;

    tops.set(index, itemTop);
    if (typeof item.id === 'string' && item.id) tops.set(item.id, itemTop);

    placements.push({
      index,
      ...(typeof item.id === 'string' && item.id ? { id: item.id } : {}),
      copies: offsets.length,
      baseZ: translateZ + zmin,
      topZ: itemTop,
      ...(item.on != null ? { on: item.on, gap } : {}),
    });
  });

  return { faces, placements };
}

/** Lower the whole assembler to one merged World face list (every seated + repeated part). */
export function lowerAssemblerFaces(manifest = {}) {
  return walkAssembler(manifest).faces;
}

const round1 = (n) => Math.round(n * 10) / 10;

function boundsOf(faces) {
  if (!faces.length) return null;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let i = 0; i < 3; i += 1) {
    if (c[i] < min[i]) min[i] = c[i];
    if (c[i] > max[i]) max[i] = c[i];
  }
  return { min, max };
}

/**
 * Validate the assembler recipe + return a stat readout (no geometry persisted). A part with no
 * renderable monomer is a clear error before the render→view loop; the readout reports the part
 * count, total placements (after repeat), merged size, and where each part sits.
 */
export function planAssembler(manifest = {}) {
  const items = Array.isArray(manifest.items) ? manifest.items : [];
  if (!items.length) {
    throw new Error('An assembler needs at least one item — a non-empty `items` array of placed workbench parts.');
  }

  // Validate sources render + `on` references resolve to an EARLIER part (gravity seats top-down, in
  // order — a forward/unknown support can't have a computed top yet).
  const seen = new Set();
  items.forEach((item, index) => {
    const src = item && item.source;
    const hasMonomer = src && typeof src === 'object'
      && ((Array.isArray(src.lathes) && src.lathes.length) || (Array.isArray(src.extrudes) && src.extrudes.length) || (Array.isArray(src.sweeps) && src.sweeps.length) || (Array.isArray(src.reliefs) && src.reliefs.length));
    if (!hasMonomer) {
      throw new Error(`Item ${index} has no renderable part — \`source\` must be a workbench manifest with a non-empty lathes/extrudes/sweeps/reliefs (or a {ref} the mint tool froze into one).`);
    }
    if (item.on != null && item.on !== 'ground' && !seen.has(item.on)) {
      throw new Error(`Item ${index}: on='${item.on}' must be 'ground' or the id/index of an EARLIER item (gravity seats in order).`);
    }
    seen.add(index);
    if (typeof item.id === 'string' && item.id) seen.add(item.id);
  });

  const { faces, placements } = walkAssembler(manifest);
  const bounds = boundsOf(faces);
  const units = typeof manifest.units === 'string' ? manifest.units : 'cm';
  const size = bounds
    ? { w: round1(bounds.max[0] - bounds.min[0]), d: round1(bounds.max[1] - bounds.min[1]), h: round1(bounds.max[2] - bounds.min[2]) }
    : null;

  // Per-part readout — the COMPUTED base/top z (so gravity-seated coordinates are legible) plus the
  // placement intent (at xy, copies, seating, adjustments).
  const parts = placements.map((p, i) => {
    const item = items[i];
    const at = Array.isArray(item.at) ? item.at : [0, 0, 0];
    return {
      index: p.index,
      ...(p.id ? { id: p.id } : {}),
      at: [round1(at[0]), round1(at[1])],
      baseZ: round1(p.baseZ),
      topZ: round1(p.topZ),
      copies: p.copies,
      ...(p.on != null ? { on: p.on, ...(p.gap ? { gap: p.gap } : {}) } : { placement: 'superposition' }),
      ...(item.flip ? { flip: item.flip } : {}),
      ...(Array.isArray(item.rotate) && (item.rotate[0] || item.rotate[1] || item.rotate[2]) ? { rotate: item.rotate } : {}),
      ...(Number.isFinite(item.scale) && item.scale !== 1 ? { scale: item.scale } : {}),
    };
  });

  const warnings = [];
  if (bounds) {
    const tol = Math.max(0.2, (bounds.max[2] - bounds.min[2]) * 0.02);
    if (bounds.min[2] > tol) warnings.push(`Assembly floats ${round1(bounds.min[2])} ${units} above the grid (lowest z=${round1(bounds.min[2])}). Seat the base part(s) with on:'ground' (or lower their z) so the lowest z = 0.`);
    else if (bounds.min[2] < -tol) warnings.push(`Assembly sinks ${round1(-bounds.min[2])} ${units} below the grid (lowest z=${round1(bounds.min[2])}). Seat the base part(s) with on:'ground' (or raise their z) so the lowest z = 0.`);
  }

  return {
    stats: {
      items: items.length,
      placements: parts.reduce((n, p) => n + p.copies, 0),
      faces: faces.length,
      units,
      size,
      parts,
      ...(warnings.length ? { warnings } : {}),
    },
  };
}

/**
 * Assemble the merged faces into the shared scene payload (faces + grounds + cameras + light),
 * consumed by BOTH emitPreserve3dScene (/scene) and emitThreeWorld (/world). Rides the workbench's
 * own measured studio vantage so a chariot is verified on the same grid its parts were.
 */
export function assembleAssemblerScene(opts = {}) {
  const faces = bakeBoundSkinFaces(lowerAssemblerFaces(opts), opts.skin, opts);
  return studioSceneFromFaces(faces, { ...opts, title: opts.title || 'mojulo assembler' });
}

/** /scene + PNG path: CSS-3D preset-shot HTML. (The /world route calls assembleAssemblerScene → emitThreeWorld.) */
export function renderAssemblerToHtml(opts = {}) {
  return emitPreserve3dScene({ ...assembleAssemblerScene(opts), signs: opts.signs });
}
