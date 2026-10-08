/**
 * THE MASK — where on a plate the figure can stand, and where it stands hidden. Per cell of a coarse raster over the
 * plate: 0 nothing, 1 floor seen, 2 floor hidden (a figure standing there loses its feet behind something nearer).
 *
 *   plateMask(plate, w = 192)   a read plate (walkmesh.js) → { w, h, cells }
 *
 * Painted: the floor is the polygons; a cell is hidden when it lies inside an occluder above its base line (the
 * ground there is farther than where the occluder stands). Baked: the world's own geometry (bake.js bakeMask).
 */
import { inPoly } from './geom.js';
import { bakeMask } from './bake.js';

export function plateMask(plate, w = 192) {
  if (plate.source === 'baked') return bakeMask(plate.payload, plate.basis, plate.size, plate.bake, w);
  const [W, H] = plate.size, h = Math.max(1, Math.round((w * H) / W)), s = W / w, cells = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const p = [(i + 0.5) * s, (j + 0.5) * (H / h)];
    if (p[1] <= plate.horizon || !plate.floor.some((f) => inPoly(p, f.px))) continue;
    cells[j * w + i] = plate.occluders.some((o) => p[1] < o.base && inPoly(p, o.px)) ? 2 : 1;
  }
  return { w, h, cells };
}
