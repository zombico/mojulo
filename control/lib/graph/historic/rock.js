/**
 * historic/rock — the rock a city stands on or under, made by the landform operators
 * (../polygonizer/landform.js) rather than drawn: a layout's `hAt` gives the rock its shape (the summit, the sheer
 * sides, the ledges), and here it is baked on a grid and weathered — STRATA bench the faces and band them, JOINTS
 * break them into blocky facets, TALUS sheds a scree apron at their feet — then meshed by
 * ../polygonizer/landform-mesh.js, sliced at the bed planes so each bed reads as a band up the cliff.
 *
 * Only steep ground is weathered: a mask picks the cliffs and ledges (and a margin round them); everything
 * else — a summit the temple stands on, a street, the sea — keeps the layout's exact level, so slots stay on
 * their ground. The mask is counted in `block`-sized cells (the terrain's cell): the rock is meshed in the cells
 * it touches and ../terrain.js meshes the rest (`skip`), and `hAt` here is the two together, for the light bake.
 *
 * Plans in metres. Pure and deterministic (the landform ops are seeded).
 */
import { landformGrid, bakeGrid, applyLandform, gridX, gridY, gridSample, bedAt } from '../polygonizer/landform.js';
import { slicedTerrainFaces, sliceLevels } from '../polygonizer/landform-mesh.js';
import { scaleHex } from '../polygonizer/vexar.js';

/**
 * `hAt` the layout's height; `region` { x, y, w, d } (multiples of `block`) where rock may be; `cell` the grid's
 * spacing (divides `block`); `steep` the slope (rise over run) that counts as rock; `keep(x, y)` true where the
 * layout's level must hold whatever the slope (a summit's built floor); `owned(x0, y0, size)` true for a cell the
 * terrain must mesh whatever lies in it (a town's terraces: houses stand on their exact level); `ops`; `seed`.
 */
export function weatherRock({ hAt, region, cell = 5, block = 20, steep = 0.9, margin = 2, keep = () => false, owned = () => false, ops, seed = 'rock', below = -Infinity }) {
  const g = landformGrid({ x0: region.x, x1: region.x + region.w, y0: region.y, y1: region.y + region.d, res: Math.round(region.d / cell) + 1 });
  bakeGrid(g, hAt);
  const base = Float64Array.from(g.z), { nx, ny } = g;
  // the mask: steep nodes, grown by `margin` nodes, never where the layout's level must hold
  const steepAt = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const q = j * nx + i, z = base[q];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < nx && b < ny && Math.abs(base[b * nx + a] - z) / g.dx > steep) { steepAt[q] = 1; break; } }
  }
  const mask = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (keep(gridX(g, i), gridY(g, j))) continue;
    let near = Infinity;
    for (let dj = -margin; dj <= margin; dj++) for (let di = -margin; di <= margin; di++) { const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < nx && b < ny && steepAt[b * nx + a]) near = Math.min(near, Math.hypot(di, dj)); }
    if (near <= margin) mask[j * nx + i] = 1 - 0.5 * Math.max(0, near - 1) / Math.max(1, margin);
  }
  applyLandform(g, ops, { seed });
  // the weathered rock where the mask says, the layout's ground elsewhere
  for (let q = 0; q < nx * ny; q++) g.z[q] = base[q] + (g.z[q] - base[q]) * mask[q];
  // the rock's cells: every terrain cell the mask touches (the edges of the region never: they meet the terrain flat)
  const bx = Math.round(region.w / block), by = Math.round(region.d / block), per = Math.round(block / g.dx), cells = new Uint8Array(bx * by);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (mask[j * nx + i] > 0) {
    for (const [ci, cj] of [[Math.floor(i / per), Math.floor(j / per)], [Math.floor((i - 1) / per), Math.floor(j / per)], [Math.floor(i / per), Math.floor((j - 1) / per)], [Math.floor((i - 1) / per), Math.floor((j - 1) / per)]]) {
      if (ci > 0 && cj > 0 && ci < bx - 1 && cj < by - 1 && !owned(region.x + ci * block, region.y + cj * block, block)) cells[cj * bx + ci] = 1;
    }
  }
  const inRock = (x, y) => { const ci = Math.floor((x - region.x) / block), cj = Math.floor((y - region.y) / block); return ci >= 0 && cj >= 0 && ci < bx && cj < by && cells[cj * bx + ci] === 1; };
  const height = (x, y) => (inRock(x, y) ? gridSample(g, x, y) : hAt(x, y));

  /**
   * The rock's faces as panels (metres): triangles of the weathered grid in the rock's cells, sliced at the bed
   * planes, coloured by `paint(n, bed, hard, apron, z)`. Triangles wholly under `below` (the sea) are left out.
   */
  const faces = (paint) => {
    const beds = g.strata ? g.strata.layers.map((L) => L.b) : [];
    let lo = Infinity, hi = -Infinity; for (const z of g.z) { lo = Math.min(lo, z); hi = Math.max(hi, z); }
    const all = slicedTerrainFaces(g, { levels: sliceLevels(lo, hi, 1e9, beds), paint: () => '#000000' });
    const out = [];
    for (const f of all) {
      const c = f.corners, mx = (c[0][0] + c[1][0] + c[2][0]) / 3, my = (c[0][1] + c[1][1] + c[2][1]) / 3, mz = (c[0][2] + c[1][2] + c[2][2]) / 3;
      if (!inRock(mx, my) || Math.max(c[0][2], c[1][2], c[2][2]) < below) continue;
      const bed = bedAt(g, mx, my, mz), hard = bed >= 0 && g.strata.layers[bed].hard;
      const n = f.outNormal[2] < 0 ? f.outNormal.map((v) => -v) : f.outNormal;
      const tint = paint(n, bed, hard, gridSample(g, mx, my, g.apron), mz);
      const xs = c.map((p) => p[0]), ys = c.map((p) => p[1]), zs = c.map((p) => p[2]);
      out.push({ kind: n[2] < 0.5 ? 'cliff' : 'rock', solid: 'panel', pts: c, out: n, x: Math.min(...xs), y: Math.min(...ys), w: Math.max(0.01, Math.max(...xs) - Math.min(...xs)), d: Math.max(0.01, Math.max(...ys) - Math.min(...ys)), z0: Math.min(...zs), z1: Math.max(...zs), tint, skin: null });
    }
    return out;
  };
  return { grid: g, mask, inRock, skip: (x0, y0, s) => inRock(x0 + s / 2, y0 + s / 2), hAt: height, faces };
}

/** A limestone rock's colouring: the hard beds pale and standing out, the soft ones darker and recessed, scree pale, tops the rock's own. */
export function limestonePaint({ rock, cliff, scree }, seedTone = 0) {
  return (n, bed, hard, apron) => {
    const jit = 0.94 + 0.12 * (((Math.imul((bed + 7) * 2654435761 + seedTone, 1) >>> 0) % 1000) / 1000);
    if (apron > 0.15) return scaleHex(scree, jit);
    if (n[2] >= 0.5) return scaleHex(rock, jit);
    return scaleHex(cliff, jit * (hard ? 1.12 : 0.9));
  };
}
