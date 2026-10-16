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
import { shadeHex, DEFAULT_LIGHT, hexToRgb, rgbToHex } from './vexar.js';
import { auditLayered } from './station-loft.js';
import { seatPanels, clipCells } from './seat-panels.js';
import { resolveMaterial, tagFacesWithMaterial } from './materials.js';
import * as dmath from '../../util/dmath.js';
import { faceHex } from './face-hex.js';
import { cellTriangles } from './field-paint.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = dmath.hypot(a[0], a[1], a[2]); return l > 1e-300 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 1]; };

/** The seat shift: −(lowest z) when seating, else 0. */
export function layeredSeat(mesh, seat = true) { if (!seat) return 0; let mn = Infinity; for (const v of mesh.vertices) if (v[2] < mn) mn = v[2]; return Number.isFinite(mn) ? -mn : 0; }

/** A face's swimsuit cut (a `swim` panel of seat-panels.js on its `corners`) as triangles `{ corners, inside, w }` (each
 * convex cell a fan; `w` each corner's weights over the face's three), or null when the panel is not the swimsuit's or
 * misses the face */
export function swimCells(corners, pan) {
  if (pan?.kind !== 'swim') return null;
  const cells = clipCells(corners.map((p, j) => ({ w: [0, 1, 2].map((k) => (k === j ? 1 : 0)), p })), pan.sets, (w) => ({ w, p: [0, 1, 2].map((c) => w[0] * corners[0][c] + w[1] * corners[1][c] + w[2] * corners[2][c]) }));
  if (!cells.some((c) => c.inside)) return null;
  const out = []; for (const { ring, inside } of cells) for (let k = 1; k + 1 < ring.length; k++) out.push({ corners: [ring[0].p, ring[k].p, ring[k + 1].p], inside, w: [ring[0].w, ring[k].w, ring[k + 1].w] });
  return out;
}

/** The compiled mesh as studio faces `{ corners, fill, group, outNormal }`. `dz` (default: the mesh's own seat) seats
 * a posed mesh on its REST floor, so a figure standing in its gesture keeps the ground its planted toes hold. The
 * swimsuit's lines on the structured core's seat (seat-panels.js: the thong's back, the speedo's leg line) are cut out
 * of their faces by the REST mesh `rest` (same topology; the mesh itself when absent), so a figure under the studio
 * light wears the swimsuit the character light draws.
 * `normals` (per-face-corner shading normals shaped like `mesh.faces`, station-loft-shade.js layeredShadingNormals)
 * shades SMOOTHLY: each face also carries `cornerFills`, the same key at its corners (a triangle's as `[a, b, c, c]`,
 * the face payload's per-corner form; a swimsuit cell's corners by their weights in the face), blended across the face
 * by the World page and the GLB; its `fill` stays the face-normal shade for every reader of one colour per face. An
 * emissive face has none. Absent ⇒ byte-identical.
 * `recipe.surfaces` (group → a shelf material or a metal surface, `'*'` every other group; a statue's, statue/expand.js)
 * tags each face with its material's channel keys (`spec` / `pbr`, a metal's `metal`) for the World page and the
 * exporters (polygonizer/materials.js tagFacesWithMaterial); the fill stays the palette's. Absent ⇒ byte-identical.
 * `paint` (face-paint.js facePaintOf): the painted face under the studio or a cast light, as characterLitFaces carries
 * it under the character light. Absent ⇒ byte-identical. */
/** a colour times [r, g, b] */
const tintHex = (hex, m) => { const [r, g, b] = hexToRgb(hex); return rgbToHex([r * m[0], g * m[1], b * m[2]].map((x) => Math.max(0, Math.min(255, x)))); };
export function layeredFaces(mesh, recipe = {}, { light = DEFAULT_LIGHT, seat = true, group = null, dz: seatAt = null, rest = mesh, normals = null, tint = null, paint = null, cornerTint = false, fields = null, cellTint = null } = {}) {
  // `fields` (field-paint.js fieldPaintOf, on the rest mesh): a face an entry touches is cut into its cells, each in its
  // group's colour (over the swimsuit's cut when it has one); absent, or a face no entry touches ⇒ as before. `cellTint(fi,
  // group)` (the bake's sampler): a cell's corners tinted under its own group's finish, in place of its face's tint
  // `tint` (face-tint.js): per face, its corners' colour multipliers (a face's occlusion and blush); absent ⇒ as before.
  // `cornerTint` (the bake stack, surface-bake.js): the tint rides the corners even without smooth normals (each corner
  // the face normal's shade of its own tinted colour), and a swimsuit cell takes it by its weights in the face
  const dz = Number.isFinite(seatAt) ? seatAt : layeredSeat(mesh, seat); const palette = recipe.palette && typeof recipe.palette === 'object' ? recipe.palette : {};
  const glows = new Set(Array.isArray(recipe.emissive) ? recipe.emissive : []);   // emissive groups: full-bright, not shaded
  const faces = [], panels = seatPanels(rest);
  const surfaces = recipe.surfaces && typeof recipe.surfaces === 'object' ? Object.fromEntries(Object.entries(recipe.surfaces).map(([g, m]) => [g, resolveMaterial(m)])) : null;
  const groupOf = [];   // each face's palette group, for its surface
  mesh.faces.forEach((tri, i) => {
    const partName = mesh.provenance[tri[0]].part; const part = mesh.parts[partName]; const g = mesh.groups[i];
    const hex = faceHex(palette, g, part);
    const corners = tri.map((vi) => { const v = mesh.vertices[vi]; return [v[0], v[1], v[2] + dz]; });
    const n = cross(sub(corners[1], corners[0]), sub(corners[2], corners[0])); const l = dmath.hypot(n[0], n[1], n[2]);
    if (!(l > 1e-14)) return;   // a degenerate triangle has no face
    const outNormal = [n[0] / l, n[1] / l, n[2] / l];
    const cut = swimCells(corners, panels && panels.at(i, g));
    // the smooth key at a point of the face by its weights over the corners (the corners' normals blended)
    const cn = normals && !glows.has(g) ? normals[i] : null;
    const at = (h, w) => shadeHex(h, unit([0, 1, 2].map((k) => w[0] * cn[0][k] + w[1] * cn[1][k] + w[2] * cn[2][k])), light);
    const fc = fields && !paint?.painted(i) ? fields.cut(i, cut ? cut.map((c) => ({ ring: c.w.map((w) => ({ w })), group: c.inside ? 'Swim' : g })) : null) : null;
    if (fc) {
      // the field paint's cells: each in its group's colour (the face's own, the swimsuit's as above), lit and tinted at
      // its corners by their weights over the face's
      const tf = cornerTint || cn ? tint?.[i] : null, hexOf = (grp) => (grp === g || (grp === 'Swim' && !palette.Swim) ? hex : faceHex(palette, grp, part));
      for (const cell of fc) {
        const tc = cellTint ? cellTint(i, cell.group) : tf;
        const tw = (h, w) => (tc ? tintHex(h, [0, 1, 2].map((c) => w[0] * tc[0][c] + w[1] * tc[1][c] + w[2] * tc[2][c])) : h);
        const h = hexOf(cell.group), lit = glows.has(cell.group), avg = tc ? tintHex(h, [0, 1, 2].map((c) => (tc[0][c] + tc[1][c] + tc[2][c]) / 3)) : h;
        const fill = lit ? h : shadeHex(avg, outNormal, light);
        for (const T of cellTriangles(cell.ring)) {
          const cs = T.map(({ w }) => [0, 1, 2].map((k) => w[0] * corners[0][k] + w[1] * corners[1][k] + w[2] * corners[2][k]));
          const cf = lit ? null : cn ? T.map(({ w }) => at(tw(h, w), w)) : tc ? T.map(({ w }) => shadeHex(tw(h, w), outNormal, light)) : null;
          faces.push({ corners: cs, fill, ...(cf ? { cornerFills: [...cf, cf[2]] } : {}), group: group || partName, outNormal }); groupOf.push(cell.group);
        }
      }
      return;
    }
    if (cut) {
      // the swimsuit's cells in its own colour, the rest in the face's
      const hexes = [hex, palette.Swim || hex], fills = hexes.map((h) => shadeHex(h, outNormal, light)), tc = cornerTint ? tint?.[i] : null;
      // (a baked tint at a cell's corner: the face's corners' blended by its weights)
      const tw = (h, w) => (tc ? tintHex(h, [0, 1, 2].map((c) => w[0] * tc[0][c] + w[1] * tc[1][c] + w[2] * tc[2][c])) : h);
      for (const c of cut) {
        const h = hexes[c.inside ? 1 : 0], cf = cn ? c.w.map((w) => at(tw(h, w), w)) : tc ? c.w.map((w) => shadeHex(tw(h, w), outNormal, light)) : null;
        faces.push({ corners: c.corners, fill: fills[c.inside ? 1 : 0], ...(cf ? { cornerFills: [...cf, cf[2]] } : {}), group: group || partName, outNormal }); groupOf.push(c.inside ? 'Swim' : g);
      }
      return;
    }
    const tt = tint?.[i], th = (k) => (tt ? tintHex(hex, tt[k]) : hex);
    const cf = cn ? cn.map((n, k) => shadeHex(th(k), n, light)) : tt && cornerTint && !glows.has(g) ? [0, 1, 2].map((k) => shadeHex(th(k), outNormal, light)) : null;
    const fill = glows.has(g) ? hex : shadeHex(tt ? tintHex(hex, [0, 1, 2].map((c) => (tt[0][c] + tt[1][c] + tt[2][c]) / 3)) : hex, outNormal, light);
    // `paint` (face-paint.js facePaintOf): a face the painted face's texture covers carries it, its fill the light alone
    if (paint?.painted(i)) { faces.push({ corners, fill: paint.light(fill), ...(cf ? { cornerFills: [...cf, cf[2]].map(paint.light) } : {}), group: group || partName, outNormal, texture: paint.key, uv: tri.map((vi) => paint.uvAt({ vi })), textureLit: true }); groupOf.push(g); return; }
    faces.push({ corners, fill, ...(cf ? { cornerFills: [...cf, cf[2]] } : {}), group: group || partName, outNormal }); groupOf.push(g);
  });
  if (surfaces) faces.forEach((f, k) => { const m = surfaces[groupOf[k]] ?? surfaces['*']; if (m && !glows.has(groupOf[k])) tagFacesWithMaterial([f], m); });
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
