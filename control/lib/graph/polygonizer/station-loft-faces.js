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
import { seatPanels, clipCells } from './seat-panels.js';
import * as dmath from '../../util/dmath.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const FALLBACK = '#8a8f96';

/** The seat shift: −(lowest z) when seating, else 0. */
export function layeredSeat(mesh, seat = true) { if (!seat) return 0; let mn = Infinity; for (const v of mesh.vertices) if (v[2] < mn) mn = v[2]; return Number.isFinite(mn) ? -mn : 0; }

/** A face's swimsuit cut (a `swim` panel of seat-panels.js on its `corners`) as triangles `{ corners, inside }` (each
 * convex cell a fan), or null when the panel is not the swimsuit's or misses the face */
export function swimCells(corners, pan) {
  if (pan?.kind !== 'swim') return null;
  const cells = clipCells(corners.map((p, j) => ({ w: [0, 1, 2].map((k) => (k === j ? 1 : 0)), p })), pan.sets, (w) => ({ w, p: [0, 1, 2].map((c) => w[0] * corners[0][c] + w[1] * corners[1][c] + w[2] * corners[2][c]) }));
  if (!cells.some((c) => c.inside)) return null;
  const out = []; for (const { ring, inside } of cells) for (let k = 1; k + 1 < ring.length; k++) out.push({ corners: [ring[0].p, ring[k].p, ring[k + 1].p], inside });
  return out;
}

/** The compiled mesh as studio faces `{ corners, fill, group, outNormal }`. `dz` (default: the mesh's own seat) seats
 * a posed mesh on its REST floor, so a figure standing in its gesture keeps the ground its planted toes hold. The
 * swimsuit's lines on the structured core's seat (seat-panels.js: the thong's back, the speedo's leg line) are cut out
 * of their faces by the REST mesh `rest` (same topology; the mesh itself when absent), so a figure under the studio
 * light wears the swimsuit the character light draws. */
export function layeredFaces(mesh, recipe = {}, { light = DEFAULT_LIGHT, seat = true, group = null, dz: seatAt = null, rest = mesh } = {}) {
  const dz = Number.isFinite(seatAt) ? seatAt : layeredSeat(mesh, seat); const palette = recipe.palette && typeof recipe.palette === 'object' ? recipe.palette : {};
  const glows = new Set(Array.isArray(recipe.emissive) ? recipe.emissive : []);   // emissive groups: full-bright, not shaded
  const faces = [], panels = seatPanels(rest);
  mesh.faces.forEach((tri, i) => {
    const partName = mesh.provenance[tri[0]].part; const part = mesh.parts[partName]; const g = mesh.groups[i];
    const hex = palette[g] || part?.tint || FALLBACK;
    const corners = tri.map((vi) => { const v = mesh.vertices[vi]; return [v[0], v[1], v[2] + dz]; });
    const n = cross(sub(corners[1], corners[0]), sub(corners[2], corners[0])); const l = dmath.hypot(n[0], n[1], n[2]);
    if (!(l > 1e-14)) return;   // a degenerate triangle has no face
    const outNormal = [n[0] / l, n[1] / l, n[2] / l];
    const cut = swimCells(corners, panels && panels.at(i, g));
    if (cut) {
      // the swimsuit's cells in its own colour, the rest in the face's
      const fills = [shadeHex(hex, outNormal, light), shadeHex(palette.Swim || hex, outNormal, light)];
      for (const c of cut) faces.push({ corners: c.corners, fill: fills[c.inside ? 1 : 0], group: group || partName, outNormal });
      return;
    }
    faces.push({ corners, fill: glows.has(g) ? hex : shadeHex(hex, outNormal, light), group: group || partName, outNormal });
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

/** `strokes` rides only when the manifest carries strokes (layered-strokes.js), so a row without them keeps its bytes. */
export function persistedLayeredLedger(ledger) { if (!ledger) return undefined; return { recipe_bytes: ledger.recipe_bytes, faces: ledger.faces, closed: ledger.closed, ...(ledger.strokes ? { strokes: ledger.strokes } : {}) }; }
