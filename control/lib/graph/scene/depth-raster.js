/**
 * depth-raster — a small software z-buffer over the wire camera: every triangle of an indexed source
 * ({ vertices, faces, groups? }) rasterised at `res` × `res` with perspective-correct depth, keeping the
 * nearest face id per pixel. It is the shared eye for two machine gates that the dream loop had and the
 * layered kind lacked: EXPOSURE (which faces of a pinned detail are visible from a named azimuth) and the
 * SILHOUETTE (the pixels a source covers from a camera, compared against a reference at the same azimuth).
 *
 * Named azimuths follow the wire CLI's default views for a +y-facing solid (the animal convention):
 * frontal = 180 (camera on +y looking −y), three-quarter = 150 (from the right) / 210 (from the left), lateral = 90,
 * left = 270, back = 0.
 * Pure, deterministic.
 */
import { orbitCamera, projectVertices, frameSource } from './wire-svg.js';

export const LAYERED_VIEW_AZ = { frontal: 180, 'three-quarter': 150, 'three-quarter-left': 210, lateral: 90, left: 270, back: 0 };
/** the symmetric default set: a detail on either side is seen from its own side */
export const DEFAULT_VIEWS = ['frontal', 'three-quarter', 'three-quarter-left', 'lateral', 'left', 'back'];
export const LAYERED_VIEWS = Object.keys(LAYERED_VIEW_AZ);

/** The azimuth of a named view, or a number passed through. */
export function viewAzimuth(view) {
  if (Number.isFinite(view)) return Number(view);
  if (!(view in LAYERED_VIEW_AZ)) throw new Error(`depth-raster: unknown view '${view}' (have ${LAYERED_VIEWS.join(', ')} or an azimuth in degrees)`);
  return LAYERED_VIEW_AZ[view];
}

/** A camera at a named view that keeps the whole source in frame (the wire CLI's framing). */
export function viewCamera(source, view, { elevationDegrees = 10, size = 900, focalPixels = 1400, distanceMultiplier = null } = {}) {
  const { target, distance } = frameSource(source, { focalPixels, size, distanceMultiplier });
  return orbitCamera({ azimuthDegrees: viewAzimuth(view), elevationDegrees, target, distance, focalPixels, size });
}

/**
 * Rasterise: returns { res, depth: Float32Array (Infinity where empty), face: Int32Array (−1 where empty),
 * covered: number of covered pixels, bbox: [x0, y0, x1, y1] in pixels or null }. Pixel (i, j) samples the
 * camera image at ((i + 0.5) / res × size, (j + 0.5) / res × size).
 */
export function rasterDepth(source, cam, res = 256) {
  const q = projectVertices(source.vertices, cam); const scale = res / cam.size;
  const depth = new Float32Array(res * res).fill(Infinity); const face = new Int32Array(res * res).fill(-1);
  let covered = 0; let x0 = res, y0 = res, x1 = -1, y1 = -1;
  source.faces.forEach((f, fi) => {
    for (let k = 1; k + 1 < f.length; k++) {
      const p = [q[f[0]], q[f[k]], q[f[k + 1]]].map((v) => [v[0] * scale, v[1] * scale, v[2]]);
      const den = (p[1][1] - p[2][1]) * (p[0][0] - p[2][0]) + (p[2][0] - p[1][0]) * (p[0][1] - p[2][1]);
      if (Math.abs(den) <= 1e-12) continue;
      const minX = Math.max(0, Math.floor(Math.min(p[0][0], p[1][0], p[2][0]))), maxX = Math.min(res - 1, Math.ceil(Math.max(p[0][0], p[1][0], p[2][0])));
      const minY = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1]))), maxY = Math.min(res - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1])));
      for (let j = minY; j <= maxY; j++) for (let i = minX; i <= maxX; i++) {
        const x = i + 0.5, y = j + 0.5;
        const ba = ((p[1][1] - p[2][1]) * (x - p[2][0]) + (p[2][0] - p[1][0]) * (y - p[2][1])) / den;
        const bb = ((p[2][1] - p[0][1]) * (x - p[2][0]) + (p[0][0] - p[2][0]) * (y - p[2][1])) / den;
        const bc = 1 - ba - bb;
        if (ba < -1e-9 || bb < -1e-9 || bc < -1e-9) continue;
        const d = 1 / (ba / p[0][2] + bb / p[1][2] + bc / p[2][2]); const at = j * res + i;
        if (d < depth[at]) { if (depth[at] === Infinity) { covered++; if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; } depth[at] = d; face[at] = fi; }
      }
    }
  });
  return { res, depth, face, covered, bbox: covered ? [x0, y0, x1, y1] : null };
}

/** The silhouette mask (Uint8Array, 1 where covered) of a raster, optionally only the pixels owned by faces passing `own(faceIndex)`. */
export function rasterMask(raster, own = null) {
  const m = new Uint8Array(raster.res * raster.res);
  for (let k = 0; k < m.length; k++) if (raster.face[k] >= 0 && (!own || own(raster.face[k]))) m[k] = 1;
  return m;
}
