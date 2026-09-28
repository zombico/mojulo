/**
 * vegetation-kernel — where the plants of a terrain world stand, as one self-contained function.
 *
 * Like the ground kernels, `vegetationKernel(V, G)` closes over nothing: the server calls it and the World page inlines
 * its source, calling it with the page's own ground kernel `G` (atlas-kernel.js), so both place the same plants. It
 * reads the ground's painter (`G.landAt`: cover, the treeline's wobble, water, bareness), so a tree stands exactly where
 * the ground is painted wood, and never where it is painted water, sand, rock, snow or a city's graded ground.
 *
 * Two dials, not one: a climate's temperature falls with altitude (`lapse`, °C a kilometre, from `T0` at sea level: the
 * growing-season mean that puts the treeline at the painter's `zones.tree`), and its moisture rises near water. A
 * species row takes the ground whose temperature, moisture and zone suit it; trees shorten toward the treeline.
 *
 * Placement is a jittered grid per layer, global in world metres and hashed per cell, so a tile anywhere holds the same
 * plants whoever computes it. A tile owns the cells whose corner lies in it.
 *
 * V (world metres):
 *   seed, T0, lapse, treeT         the temperature law: T(z) = T0 − lapse · z / 1000; no tree below treeT
 *   moist                          the climate's moisture, 0..1 (+0.35 near water)
 *   zones { tree, snow }, sea      the painter's treeline and snowline (K.zones), and the sea level (0 or null)
 *   species [{ name, h: [lo, hi] metres, crown (a tree's diameter, a clump's, over the height) }]
 *   layers [{ cell, salt, kind: 'canopy' | 'clumps' | 'shore', rows: [{ s (species index), zone: 'land' | 'coast' | 'riparian' |
 *          'shore', T?: [lo, hi], M?: [lo, hi], w, grove? (culms a cell: a running bamboo), clump? ({ culms, radius }:
 *          a clumping one: placed by the 'clumps' layer on its own coarser grid, skipped by the canopy's) }] }]
 * → { standAt(X, Y), plantsIn(x0, y0, size) }: plantsIn packs PER numbers a plant: x, y, z, height, species, pick (0..1,
 *   the variant), age (years; −1 when the species has none), lean (degrees; 0 upright), az (degrees, the lean's way).
 */
export const PER = 9;
export function vegetationKernel(V, G) {
  const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  function hash(i, j, s) { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(s, 1274126177); h = Math.imul(h ^ (h >>> 13), 1103515245); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
  const Z = V.zones, SEED = V.seed | 0;
  /** How well a value sits in a range, with soft edges (`e` wide). */
  const within = (x, r, e) => (r ? smooth(r[0] - e, r[0] + e, x) * (1 - smooth(r[1] - e, r[1] + e, x)) : 1);
  /**
   * The ground at (X, Y) as a place for plants: { ok, why?, z, canopy (the painter's wood, 0..1, where it is not bare,
   * sand, snow or above the treeline), T, M, nearWater, coastal, shore (height over the water beside it, or null) }.
   */
  function standAt(X, Y) {
    const land = G.landAt(X, Y, 0), z = land[0], bareG = land[1], r = land[2], w = land[3], cover = land[4], hn = land[5];
    if (w !== null && w > z) return { ok: 0, why: 'water', z };
    const g = G.gradeAt(X, Y); if (g && g[1] > 0.2) return { ok: 0, why: 'graded', z };
    const n = G.normalAt(X, Y, 1.5), gN = n[2] > 1e-6 ? Math.sqrt(n[0] * n[0] + n[1] * n[1]) / n[2] : 1e6;
    const bare = Math.max(bareG, smooth(0.7, 1.3, gN));
    // the painter's shore: ground within a metre and a half of the water beside it, at the water's edge
    const edge = r ? r[0] - r[1] : w !== null ? 0 : 1e9, wl = w !== null ? w : r ? r[2] : null;
    const sw = Math.max(6, 0.05 * (r ? r[1] : 120)), small = !!r && r[1] < 15 && (w === null || w <= z);
    let sand = 0; if (wl !== null && edge < sw && !small) { const up = z - wl; if (up < 1.6) sand = (1 - smooth(0.2, 1.6, up)) * (1 - bare) * (1 - smooth(0, sw, edge)); }
    const high = smooth(Z.tree * 0.8, Z.tree * 1.1, z + (hn - 0.5) * 0.25 * Z.tree);
    const snow = smooth(Z.snow - 150, Z.snow + 150, z + (hn - 0.5) * 700 + 3 * (z - G.gridAt(X, Y))) * (1 - smooth(0.8, 1.2, gN));
    const canopy = smooth(-0.25, 0.35, cover) * (1 - high) * (1 - bare) * (1 - sand) * (1 - snow);
    const T = V.T0 - (V.lapse * z) / 1000, nearWater = r ? 1 - smooth(r[1] + 20, r[1] + 400 + 4 * r[1], r[0]) : 0;
    // a shore a reed stands on: a lake's or a river's (not the sea's, not a stream's), low over its water, bare of rock
    const reedy = wl !== null && !small && !(V.sea !== null && wl <= V.sea + 0.01) && edge < 3 * sw ? z - wl : null;
    return { ok: 1, z, canopy, bare, sand, T, M: V.moist + 0.35 * nearWater, nearWater, coastal: V.sea !== null && z - V.sea < 12, shore: reedy };
  }
  // riparian: within about two hundred metres of a river's bank (a gallery forest, an oasis)
  const zoneOk = (row, st) => (row.zone === 'coast' ? (st.coastal ? 1 : 0) : row.zone === 'riparian' ? smooth(0.55, 0.85, st.nearWater) : 1);
  function pick(rows, st, u) {
    let sum = 0; const wts = rows.map((row) => { const x = row.w * zoneOk(row, st) * within(st.T, row.T, 1.5) * within(st.M, row.M, 0.08); sum += x; return x; });
    if (sum <= 0) return null; let acc = 0; for (let q = 0; q < rows.length; q++) { acc += wts[q]; if (u * sum < acc) return rows[q]; }
    return rows[rows.length - 1];
  }
  /** The plants whose cells' corners lie in the square [x0, x0 + size) × [y0, y0 + size). */
  function plantsIn(x0, y0, size) {
    const out = []; const put = (x, y, h, sp, pk, age, lean, az) => out.push(x, y, G.groundAt(x, y), h, sp, pk, age, lean, az);
    // a culm of a clump or a grove stands off its cell's point: it checks its own ground (dry, not graded)
    const dry = (x, y) => { const l = G.landAt(x, y, 0); if (l[3] !== null && l[3] > l[0]) return false; const g = G.gradeAt(x, y); return !(g && g[1] > 0.2); };
    for (const L of V.layers) {
      const c = L.cell, i0 = Math.ceil(x0 / c), i1 = Math.ceil((x0 + size) / c), j0 = Math.ceil(y0 / c), j1 = Math.ceil((y0 + size) / c), s = SEED + L.salt;
      for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
        const u = hash(i, j, s);
        const X = (i + 0.15 + 0.7 * hash(i, j, s + 1)) * c, Y = (j + 0.15 + 0.7 * hash(i, j, s + 2)) * c;
        if (L.kind !== 'shore') {
          // most of the land is open or open enough: read the painter's cover and treeline first, and stop there when
          // even a full stand would not keep this cell
          const land = G.landAt(X, Y, 0), z = land[0], w = land[3], hn = land[5];
          if (w !== null && w > z) continue;
          if (u >= smooth(-0.25, 0.35, land[4]) * (1 - smooth(Z.tree * 0.8, Z.tree * 1.1, z + (hn - 0.5) * 0.25 * Z.tree))) continue;
        }
        const st = standAt(X, Y); if (!st.ok) continue;
        if (L.kind === 'shore') {
          // a reed belt: ground within a metre of the water beside it
          if (st.shore === null || st.shore > 1 || st.bare > 0.5) continue;
          const row = pick(L.rows, st, hash(i, j, s + 3)); if (!row) continue;
          if (u > 0.7 * (1 - smooth(0.4, 1, st.shore))) continue;
          const sp = V.species[row.s]; put(X, Y, sp.h[0] + (sp.h[1] - sp.h[0]) * hash(i, j, s + 4), row.s, hash(i, j, s + 5), -1, 0, 0);
          continue;
        }
        if (st.canopy <= 0) continue;
        // the canopy and the clumps share the land: each places only what its pick here is for
        const row = pick(L.rows, st, hash(i, j, s + 3)); if (!row || !row.clump !== (L.kind === 'canopy')) continue;
        const sp = V.species[row.s], stature = 0.35 + 0.65 * smooth(V.treeT, V.treeT + 4, st.T);
        if (row.grove) {
          // a running bamboo: this cell's share of the grove's culms, each of its own age
          if (u >= st.canopy) continue;
          for (let q = 0; q < row.grove; q++) {
            const xq = (i + hash(i * 31 + q, j, s + 6)) * c, yq = (j + hash(i, j * 31 + q, s + 7)) * c; if (!dry(xq, yq)) continue;
            put(xq, yq, (sp.h[0] + (sp.h[1] - sp.h[0]) * hash(i + q, j - q, s + 8)) * stature, row.s, hash(q, i + j, s + 9), Math.floor(10 * hash(i - q, j + q, s + 10)), 0, 0);
          }
          continue;
        }
        // a tree (or a clump) keeps its cell with the probability that makes the crowns cover what the painter shows
        const hMean = 0.5 * (sp.h[0] + sp.h[1]) * stature, rCrown = 0.5 * sp.crown * hMean;
        if (u >= st.canopy * Math.min(1, (c * c) / (Math.PI * rCrown * rCrown))) continue;
        if (row.clump) {
          // a clumping bamboo: culms round the cell's point, the outer ones leaning out (clumpGrove's rule)
          const R = row.clump.radius;
          for (let q = 0; q < row.clump.culms; q++) {
            const d = R * Math.sqrt(hash(i * 7 + q, j, s + 11)), a = 2 * Math.PI * hash(i, j * 7 + q, s + 12), xq = X + d * Math.cos(a), yq = Y + d * Math.sin(a);
            if (!dry(xq, yq)) continue;
            put(xq, yq, (sp.h[0] + (sp.h[1] - sp.h[0]) * hash(q, i - j, s + 13)) * stature, row.s, hash(i + q, j + q, s + 14), Math.floor(10 * hash(q - i, j, s + 15)), 3 + 24 * Math.pow(d / R, 1.2), (a * 180) / Math.PI);
          }
          continue;
        }
        put(X, Y, (sp.h[0] + (sp.h[1] - sp.h[0]) * hash(i, j, s + 4)) * stature, row.s, hash(i, j, s + 5), -1, 0, 0);
      }
    }
    return out;
  }
  return { standAt, plantsIn };
}
