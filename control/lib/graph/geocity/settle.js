/**
 * THE GEOCITY'S PIECES SETTLED ON WHAT IS DRAWN — a street's paint and its furniture are stamped where the land says
 * (`S(x, y)`, the metro's analytic ground), but the road and the walk under them are draped on the land in cells, each
 * cell's quad two flat triangles: inside a cell the drawn surface is a plane, not the land, and a piece stood on the land
 * floats over it or sinks into it (up to half a metre on a hill's crown). Settling reads the surface DRAWN under each
 * piece, its own faces as the page triangulates them (a fan from the first corner), and seats the piece on it:
 *
 *   paint       (a lane's dash, a line, a centre line's pair, a rail, a crosswalk's bar, a stall's line, a tree's pit)
 *               lies on the road: its start and its end each on the surface under them (`along`, its length along its
 *               own +x), the slope across it the surface's own there, a hair over it (`lift`: the page's depth is
 *               logarithmic, so a centimetre parts it cleanly at any distance, and casts no shadow a sun could show)
 *   standing    (a lamp, a signal, a pole, a hydrant, a bin, a bench, a bike ring, a sign, a stop, a barrier, a cone, a
 *               fence's panel, a hoarding's) its foot on the surface under its foot
 *
 * A piece seats only on the surfaces its kind stands on (paint on a carriageway, the rest on a walk, a forecourt, a
 * platform, a plaza, a lot) and only on one within `reach` of where it was put; a piece over none is left as it was.
 *
 *   SETTLE                         its lift (m), its reach (m), its index's cell (m), the kinds and their surfaces
 *   drawnGround(faces, groups)  → { at(x, y, zNear, reach?) → { z, grad: [dz/dx, dz/dy], group } | null }
 *   settleStamps(stamps, ground) → { seated, left }   (each stamp's transforms re-seated in place)
 *   settleTrees(trees, ground)   → { seated, left }   (each tree's foot, `z0`, on the walk or the lawn under it)
 *
 * Pure: no dice.
 */

export const SETTLE = Object.freeze({
  lift: 0.012, reach: 0.8, cell: 4,
  // paint: each piece's length along its own +x (0: a square seated by the slope under its middle)
  paint: Object.freeze({ dash: 3, line: 10, yellow: 10, rail: 10, bar: 3, stall: 0, pit: 0, soil: 0 }),
  // standing on the ground
  stands: Object.freeze(['lamp', 'signal', 'pole', 'hydro', 'hydrant', 'bin', 'bench', 'ring', 'papers', 'sign', 'stop', 'barrier', 'cone', 'fence', 'hoarding']),
  // the surfaces each lies on: paint on a carriageway or a lot; the rest on a walk and what a walk becomes
  carriage: Object.freeze(['geocity:road', 'geocity:highway', 'geocity:bike', 'geocity:streetcar-row', 'geocity:lot', 'geocity:back-lane']),
  walked: Object.freeze(['geocity:walk', 'geocity:stoop', 'geocity:paving', 'geocity:platform', 'geocity:promenade', 'geocity:quay', 'geocity:median', 'geocity:site', 'geocity:pad', 'geocity:park', 'geocity:margin', 'geocity:scrub', 'geocity:lot', 'geocity:yard', 'geocity:back-park-path', 'geocity:back-lane']),
});

const r5 = (v) => Math.round(v * 1e5) / 1e5 + 0;

/** The surfaces of `groups` among `faces`, each upward face's fan triangles in a grid, read at (x, y): the one nearest
 *  `zNear` within `reach`, its height and its plane's slope. */
export function drawnGround(faces, groups) {
  const want = new Set(groups), C = SETTLE.cell, grid = new Map(), tris = [];
  for (const f of faces) {
    if (!want.has(f.group) || !(f.normal?.[2] > 0.5) || f.corners.length < 3) continue;
    const c = f.corners;
    for (let k = 1; k + 1 < c.length; k++) {
      const a = c[0], b = c[k], d = c[k + 1], det = (b[1] - d[1]) * (a[0] - d[0]) + (d[0] - b[0]) * (a[1] - d[1]);
      if (Math.abs(det) < 1e-12) continue;
      // its plane: z = z(a) + gx (x - ax) + gy (y - ay)
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2], nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (Math.abs(nz) < 1e-12) continue;
      const t = { a, b, d, det, gx: -nx / nz, gy: -ny / nz, group: f.group }, i = tris.push(t) - 1;
      for (let gi = Math.floor(Math.min(a[0], b[0], d[0]) / C); gi <= Math.floor(Math.max(a[0], b[0], d[0]) / C); gi++) for (let gj = Math.floor(Math.min(a[1], b[1], d[1]) / C); gj <= Math.floor(Math.max(a[1], b[1], d[1]) / C); gj++) {
        const key = `${gi},${gj}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(i);
      }
    }
  }
  return {
    at(x, y, zNear, reach = SETTLE.reach) {
      let best = null;
      for (const i of grid.get(`${Math.floor(x / C)},${Math.floor(y / C)}`) ?? []) {
        const { a, b, d, det, gx, gy, group } = tris[i];
        const l1 = ((b[1] - d[1]) * (x - d[0]) + (d[0] - b[0]) * (y - d[1])) / det, l2 = ((d[1] - a[1]) * (x - d[0]) + (a[0] - d[0]) * (y - d[1])) / det, l3 = 1 - l1 - l2;
        if (l1 < -1e-7 || l2 < -1e-7 || l3 < -1e-7) continue;
        const z = l1 * a[2] + l2 * b[2] + l3 * d[2];
        if (Math.abs(z - zNear) <= reach && (!best || Math.abs(z - zNear) < Math.abs(best.z - zNear))) best = { z, grad: [gx, gy], group };
      }
      return best;
    },
  };
}

/** Each stamp re-seated on the surface drawn under it: `stamps` the scene's Map of key ('dash', 'lamp:e', …) → its
 *  transforms ({ pos, rotZ?, scale?, slope? }); `ground` { carriage, walked } (drawnGround each). */
export function settleStamps(stamps, ground) {
  let seated = 0, left = 0;
  for (const [key, list] of stamps) {
    const kind = key.split(':')[0], len = SETTLE.paint[kind], paint = len !== undefined;
    if (!paint && !SETTLE.stands.includes(kind)) continue;
    // (a tree's pit and its box of soil lie in the walk; the rest of the paint on a carriageway or a lot)
    const G = paint && kind !== 'pit' && kind !== 'soil' ? ground.carriage : ground.walked;
    for (const t of list) {
      const [x, y, z] = t.pos, a = t.rotZ ?? 0, dx = Math.cos(a), dy = Math.sin(a);
      const zl = z, h0 = G.at(x, y, zl);
      if (!h0) { left++; continue; }
      if (!paint) { t.pos = [x, y, r5(h0.z)]; seated++; continue; }
      let slope = h0.grad;
      if (len > 0) {
        // (its end on the surface too: the slope along it between them, the slope across it the surface's at its start)
        const h1 = G.at(x + dx * len, y + dy * len, zl + (slope[0] * dx + slope[1] * dy) * len);
        const along = h1 ? (h1.z - h0.z) / len : slope[0] * dx + slope[1] * dy, across = -slope[0] * dy + slope[1] * dx;
        slope = [along * dx - across * dy, along * dy + across * dx];
      }
      t.pos = [x, y, r5(h0.z + SETTLE.lift)];
      if (Math.abs(slope[0]) > 1e-6 || Math.abs(slope[1]) > 1e-6) t.slope = slope.map(r5);
      else delete t.slope;
      seated++;
    }
  }
  return { seated, left };
}

/** Each tree's foot (`z0`) on the walk, the lawn or the plaza drawn under it. */
export function settleTrees(trees, ground) {
  let seated = 0, left = 0;
  for (const list of trees.values()) for (const t of list) {
    const h = ground.at(t.x, t.y, t.z0);
    if (h) { t.z0 = r5(h.z); seated++; } else left++;
  }
  return { seated, left };
}
