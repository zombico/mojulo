/**
 * THE MASK — where on a plate the figure can stand, and where it stands hidden. Per cell of a coarse raster over the
 * plate: 0 nothing, 1 floor seen, 2 floor hidden (a figure standing there loses its feet behind something nearer).
 *
 *   plateMask(plate, w = 192)   a read plate (walkmesh.js) → { w, h, cells }
 *
 * Only the plate's zone counts when it has one (one floor, several cameras: this camera answers for its zone).
 * Painted: the floor is the polygons; a cell is hidden when it lies inside an occluder above its base line (the
 * ground there is farther than where the occluder stands). Baked: the world's own geometry (bake.js bakeMask).
 */
import { inPoly } from './geom.js';
import { bakeMask } from './bake.js';
import { lift } from './camera.js';

export function plateMask(plate, w = 192) {
  // a plate judges the floor its camera holds: its zone, when it has one
  const zone = plate.zone && plate.zone.m.every(Boolean) ? plate.zone.m : null;
  if (plate.source === 'baked') return bakeMask(plate.payload, plate.basis, plate.size, plate.bake, w, zone);
  const [W, H] = plate.size, h = Math.max(1, Math.round((w * H) / W)), s = W / w, cells = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const p = [(i + 0.5) * s, (j + 0.5) * (H / h)];
    if (p[1] <= plate.horizon || !plate.floor.some((f) => inPoly(p, f.px)) || plate.holes.some((q) => inPoly(p, q.px))) continue;
    if (zone) { const g = lift(plate.basis, p); if (!g || !inPoly(g, zone)) continue; }
    cells[j * w + i] = plate.occluders.some((o) => p[1] < o.base && inPoly(p, o.px)) ? 2 : 1;
  }
  return { w, h, cells };
}
