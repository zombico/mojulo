/**
 * station-loft-legibility — the LEGIBILITY ledger of a compiled layered mesh: at what CHARACTER HEIGHT (the figure's
 * height on screen, in pixels) does each detail start to read? The art direction's "protect the read at 128, 256 and
 * 512 px; remove what only shimmers" made into a number. Exposure asks whether a detail is SEEN; this asks whether,
 * seen, it is big enough to be anything but noise.
 *
 * Per pinned part (layer ≥ 2), at its best view (the one where it owns the most pixels, through the same z-buffer the
 * exposure ledger uses): its owned AREA and its THICKNESS (area over its longest extent), scaled from the raster to each
 * character height. A part READS at a height when it has at least `LEGIBLE.area` px² and `LEGIBLE.thickness` px of
 * thickness there; `readsFrom` is the smallest height in `heights` at which it reads (null: not even at the largest).
 * Parts are grouped into FAMILIES (a tile window, a crease joint, a row, an adornment and its signature, a feature: the
 * name with its sides and indices dropped); a family reads from the height at which at least HALF its parts read (a
 * few tiles hidden under a strap do not sink the quilt), and `never` counts the parts that read at no height. `shimmers`
 * lists the families that do not read at the declared viewing height `viewPx`. Advisory. Pure, deterministic.
 */
import { rasterDepth, viewCamera } from '../scene/depth-raster.js';

export const LEGIBLE = { area: 4, thickness: 1 };
export const CHARACTER_HEIGHTS = [64, 128, 256, 512, 1024];   // a game sprite … a portrait
const r2 = (x) => Math.round(x * 100) / 100;

/** a part name's FAMILY: sides (R / L, Rf, Lb …) and indices dropped, `adorn.<id>.sig` kept apart from its adornment */
export function familyOf(name) {
  const segs = name.split('.').map((s) => s.replace(/\d+$/, '').split('-').map((w) => w.replace(/([a-z])[RL]$/, '$1')).join('-')).filter((s) => s && !/^[RL][fb]?$/.test(s));
  return segs.slice(0, segs[0] === 'adorn' ? 3 : 2).join('.');
}

/** The ledger. `views`: named views; `res`: the raster size (the figure must stand taller than the largest height). */
export function layeredLegibility(mesh, { views = ['frontal', 'three-quarter', 'lateral', 'back'], res = 1536, heights = CHARACTER_HEIGHTS, viewPx = 256, minLayer = 2, elevationDegrees = 10 } = {}) {
  const source = { vertices: mesh.vertices, faces: mesh.faces };
  const partOf = mesh.faces.map((tri) => mesh.provenance[tri[0]].part);
  const pinned = new Set(Object.entries(mesh.parts).filter(([, p]) => (p.layer ?? 1) >= minLayer).map(([n]) => n));
  const best = {};   // part → { view, area (raster px), thickness (raster px), figurePx }
  for (const view of views) {
    const cam = viewCamera(source, view, { elevationDegrees }); const raster = rasterDepth(source, cam, res);
    let top = res, bottom = -1; const box = {};
    for (let k = 0; k < raster.face.length; k++) { const f = raster.face[k]; if (f < 0) continue; const y = Math.floor(k / res), x = k % res; if (y < top) top = y; if (y > bottom) bottom = y;
      const n = partOf[f]; if (!pinned.has(n)) continue; const b = (box[n] ??= { a: 0, x0: x, x1: x, y0: y, y1: y }); b.a++; if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y; }
    const figurePx = bottom - top + 1;
    for (const [n, b] of Object.entries(box)) { const major = Math.max(b.x1 - b.x0 + 1, b.y1 - b.y0 + 1); if (!best[n] || b.a > best[n].area) best[n] = { view, area: b.a, thickness: b.a / major, figurePx }; }
  }
  const parts = {};
  for (const n of pinned) { const b = best[n];
    const at = (H) => (b ? { area: r2(b.area * (H / b.figurePx) ** 2), thickness: r2(b.thickness * (H / b.figurePx)) } : { area: 0, thickness: 0 });
    const reads = (H) => { const q = at(H); return q.area >= LEGIBLE.area && q.thickness >= LEGIBLE.thickness; };
    parts[n] = { view: b?.view ?? null, readsFrom: heights.find(reads) ?? null, at: Object.fromEntries(heights.map((H) => [H, at(H)])) }; }
  const fam = {};
  for (const [n, p] of Object.entries(parts)) (fam[familyOf(n)] ??= []).push(p.readsFrom ?? Infinity);
  const families = Object.entries(fam).map(([family, hs]) => { hs.sort((a, b) => a - b); const half = hs[Math.ceil(hs.length / 2) - 1]; const never = hs.filter((h) => h === Infinity).length;
    return { family, parts: hs.length, readsFrom: half === Infinity ? null : half, ...(never ? { never } : {}) }; })
    .sort((a, b) => (b.readsFrom ?? Infinity) - (a.readsFrom ?? Infinity) || (a.family < b.family ? -1 : 1));
  return { heights, viewPx, legible: LEGIBLE, families, parts, shimmers: families.filter((f) => f.readsFrom === null || f.readsFrom > viewPx).map((f) => f.family) };
}
