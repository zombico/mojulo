/**
 * station-loft-faces — a compiled LAYERED mesh as studio faces: the World page, `measure_solid` and every
 * export leg read the compiled mesh itself (every closed part exact, whatever its shape) through the
 * workbench studio's faces seam (`studioSceneFromFaces`), the way the scad kind rides it.
 *
 * Colour: a face's group (the part's per-face `groups`, else its `group`) looks up `recipe.palette`; absent,
 * the part's `tint`; absent, a neutral grey. Shading is the studio key (`shadeHex`) on the face normal.
 * `seat` (default true) drops the mesh so its lowest point sits on the grid (z = 0), the same shift the
 * loft lowering applied, so a rigged solid's packed figure and its static faces share one floor.
 * Render group: `group` names one group for every face (a rigged solid's `body`, so the rig preview can
 * hide it and the skinned export can drop it); absent, faces group by part.
 *
 * Pure, deterministic. The straight-loft lowering (station-loft-workbench.js) is no longer the kind's
 * render path; it stays as a library for a print-friendly monomer form.
 */
import { shadeHex, DEFAULT_LIGHT } from './vexar.js';
import { auditLayered } from './station-loft.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const FALLBACK = '#8a8f96';

/** The seat shift: −(lowest z) when seating, else 0. */
export function layeredSeat(mesh, seat = true) { if (!seat) return 0; let mn = Infinity; for (const v of mesh.vertices) if (v[2] < mn) mn = v[2]; return Number.isFinite(mn) ? -mn : 0; }

/** The compiled mesh as studio faces `{ corners, fill, group, outNormal }`. */
export function layeredFaces(mesh, recipe = {}, { light = DEFAULT_LIGHT, seat = true, group = null } = {}) {
  const dz = layeredSeat(mesh, seat); const palette = recipe.palette && typeof recipe.palette === 'object' ? recipe.palette : {};
  const faces = [];
  mesh.faces.forEach((tri, i) => {
    const partName = mesh.provenance[tri[0]].part; const part = mesh.parts[partName]; const g = mesh.groups[i];
    const hex = palette[g] || part?.tint || FALLBACK;
    const corners = tri.map((vi) => { const v = mesh.vertices[vi]; return [v[0], v[1], v[2] + dz]; });
    const n = cross(sub(corners[1], corners[0]), sub(corners[2], corners[0])); const l = Math.hypot(n[0], n[1], n[2]);
    if (!(l > 1e-14)) return;   // a degenerate triangle has no face
    const outNormal = [n[0] / l, n[1] / l, n[2] / l];
    faces.push({ corners, fill: shadeHex(hex, outNormal, light), group: group || partName, outNormal });
  });
  return faces;
}

/**
 * The mint / measure readout for a compiled mesh: per-part sizes in recipe units, closure, bounds, and the
 * ledger the sketch row persists (`recipe_bytes`, `faces`, `closed`).
 */
export function layeredStats(mesh, recipe = {}, { units = 'm', seat = true } = {}) {
  const dz = layeredSeat(mesh, seat); const audit = auditLayered(mesh); const r3 = (x) => Math.round(x * 1000) / 1000;
  const parts = []; let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const [id, part] of Object.entries(mesh.parts)) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const p of Object.values(part.points)) for (let k = 0; k < 3; k++) { const v = p[k] + (k === 2 ? dz : 0); if (v < lo[k]) lo[k] = v; if (v > hi[k]) hi[k] = v; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; }
    parts.push({ kind: 'layered', id, layer: part.layer, size: { w: r3(hi[0] - lo[0]), d: r3(hi[1] - lo[1]), h: r3(hi[2] - lo[2]) }, base: r3(lo[2]), top: r3(hi[2]), closed: audit[id]?.pass ?? false });
  }
  const failing = Object.entries(audit).filter(([, r]) => !r.pass).map(([n, r]) => `${n} (${r.closure}: boundary ${r.boundaryEdges}, non-manifold ${r.nonManifold}, winding ${r.windingErrors}, degenerate ${r.degenerate})`);
  const closed = failing.length === 0;
  const recipeBytes = Buffer.byteLength(JSON.stringify(recipe));
  return {
    units, parts, monomers: parts.length, faces: mesh.faces.length, vertices: mesh.vertices.length, closed, auditFailures: failing,
    size: parts.length ? { w: r3(mx[0] - mn[0]), d: r3(mx[1] - mn[1]), h: r3(mx[2] - mn[2]) } : { w: 0, d: 0, h: 0 },
    ledger: { recipe_bytes: recipeBytes, faces: mesh.faces.length, closed },
  };
}

export function persistedLayeredLedger(ledger) { if (!ledger) return undefined; return { recipe_bytes: ledger.recipe_bytes, faces: ledger.faces, closed: ledger.closed }; }
