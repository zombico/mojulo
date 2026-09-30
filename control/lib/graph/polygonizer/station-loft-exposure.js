/**
 * station-loft-exposure — the EXPOSURE ledger of a compiled layered mesh: for every pinned part (layer ≥ 2),
 * how much of it a viewer sees from the named azimuths. The saturation spike's per-pass ledger (`exposed`,
 * `proudPct`, `reads`) made into a machine gate for the layered kind: a detail that is buried in its host
 * (a claw pinned inside a thigh, a tooth swallowed by the lip) is named, never silently shipped. Advisory:
 * it stamps, it does not refuse.
 *
 * Per part: `visible[view]` = the area-weighted fraction of its faces whose centroid is the nearest surface
 * at its pixel from that view (a z-buffer test, depth-raster.js), `pixels[view]` = the pixels the part owns,
 * `exposed` = the best visible fraction over the views, `proud` = the part's owned pixels over the whole
 * solid's covered pixels at its best view (how much of the picture it is), and a flag:
 * `reads` (exposed ≥ 0.25), `faint` (0.05 ≤ exposed < 0.25), `buried` (< 0.05 from every view).
 * Pure, deterministic.
 */
import { rasterDepth, viewCamera, LAYERED_VIEWS, DEFAULT_VIEWS } from '../scene/depth-raster.js';
import { projectVertices } from '../scene/wire-svg.js';
import * as dmath from '../../util/dmath.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const r3 = (x) => Math.round(x * 1000) / 1000;
export const EXPOSURE_FLAGS = { reads: 0.25, faint: 0.05 };

/** exposure of every pinned part; `views` are names (LAYERED_VIEW_AZ) or azimuths; `res` the raster size. */
export function layeredExposure(mesh, { views = DEFAULT_VIEWS, res = 512, elevationDegrees = 10, minLayer = 2 } = {}) {
  const source = { vertices: mesh.vertices, faces: mesh.faces };
  const partOf = mesh.faces.map((tri) => mesh.provenance[tri[0]].part);
  const area = mesh.faces.map((tri) => { const [a, b, c] = tri.map((i) => mesh.vertices[i]); const n = cross(sub(b, a), sub(c, a)); return dmath.hypot(n[0], n[1], n[2]) / 2; });
  const centroid = mesh.faces.map((tri) => { const [a, b, c] = tri.map((i) => mesh.vertices[i]); return [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]; });
  const pinned = Object.entries(mesh.parts).filter(([, p]) => (p.layer ?? 1) >= minLayer).map(([n]) => n);
  const facesOf = Object.fromEntries(pinned.map((n) => [n, []])); mesh.faces.forEach((_, i) => { if (facesOf[partOf[i]]) facesOf[partOf[i]].push(i); });
  const ledger = Object.fromEntries(pinned.map((n) => [n, { visible: {}, pixels: {}, exposed: 0, proud: 0, flag: 'buried' }]));
  const coveredBy = {};
  for (const view of views) {
    const cam = viewCamera(source, view, { elevationDegrees }); const raster = rasterDepth(source, cam, res); coveredBy[view] = raster.covered;
    const owned = Object.fromEntries(pinned.map((n) => [n, 0])); for (let k = 0; k < raster.face.length; k++) { const f = raster.face[k]; if (f >= 0 && owned[partOf[f]] !== undefined) owned[partOf[f]]++; }
    const q = projectVertices(centroid, cam); const scale = res / cam.size;
    for (const name of pinned) {
      let seen = 0, total = 0;
      for (const fi of facesOf[name]) {
        const [x, y, z] = q[fi]; const i = Math.floor(x * scale), j = Math.floor(y * scale); total += area[fi];
        if (i < 0 || j < 0 || i >= res || j >= res) continue;
        const d = raster.depth[j * res + i]; const near = raster.face[j * res + i];
        if (near === fi || partOf[near] === name || z <= d * (1 + 2e-3)) seen += area[fi];   // the part's own surface, or nothing nearer than it
      }
      const L = ledger[name]; L.visible[view] = total ? r3(seen / total) : 0; L.pixels[view] = owned[name];
      if (L.visible[view] > L.exposed) { L.exposed = L.visible[view]; L.proud = raster.covered ? r3(owned[name] / raster.covered) : 0; }
    }
  }
  for (const L of Object.values(ledger)) L.flag = L.exposed >= EXPOSURE_FLAGS.reads ? 'reads' : L.exposed >= EXPOSURE_FLAGS.faint ? 'faint' : 'buried';
  const flags = { reads: 0, faint: 0, buried: 0 }; for (const L of Object.values(ledger)) flags[L.flag]++;
  return { views: views.map(String), res, parts: ledger, buried: Object.keys(ledger).filter((n) => ledger[n].flag === 'buried'), flags, covered: coveredBy };
}

export { LAYERED_VIEWS };
