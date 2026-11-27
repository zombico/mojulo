/**
 * THE GEOCITY'S BACK LANDS — what an outskirts block holds behind its rows, and what its little parks, its school's field
 * and its empty lots hold, laid from the geotown's own primitives (geotown/yards.js, geotown/sites.js) so the metro's
 * neighbourhoods at a walker's eye are lived in the way a composed town is, and no new piece is invented here:
 *
 *   behind a row of houses   each house's YARD (yardOf: a patio or a deck off its back door, a garden, a play set, a
 *                            trampoline, a shed, beds, a shade tree, by the pattern's tables, no two neighbours alike),
 *                            its back door (backDoorOf), the FENCES (fenceOf) between yards, at the row's ends and along
 *                            the block's spine where two rows' yards meet; a yard that crosses a terrace's step is two
 *                            yards, a fence along the step's top
 *   behind a row of shops    its SERVICE YARD (serviceOf: bins by each back door, a car now and then) on a paved lane, a
 *                            fence along the spine
 *   beside a low-rise        its residents' LOT (serviceOf: stalls, cars in some) between its street and its wall
 *   a block's park           the geotown's PARK SITE (sitePlan 'park': two paths across it, a playground on its chips, a
 *                            pavilion, benches along the paths) and its trees, loose, clear of them
 *   a school's field         a PITCH on it (pitchOf: its lines, its goals)
 *   a vacant lot             the trees that seed themselves on one, young, nearer its fence than its middle
 *
 * Each in a SIDE's frame: `u` along the block from its start, `v` into it from that side's edge, `z` absolute (from the
 * caller's `zAt(u, v)`, the block's terraces); a face { corners: [[u, v, z]], out: [ou, ov, oz], role, hex? } the geotown's
 * roles (the scene paints them by the town's colours, geotown/scene.js coloursOf). Trees { u, v, z, h }; cars
 * { u, v, z, along: 'u' | 'v' }.
 *
 *   BACKS                                    the yards' and the lots' figures (m), the back fences by weight
 *   rowYards(plots, { v0, v1, zAt, P, R, spine, steps })   → { faces, trees, plans }  a row of houses' yards
 *   shopYards(bays, { v0, v1, zAt, R, spine })              → { faces, cars }         a row of shops' service yard
 *   residentsLot(u0, u1, { v0, v1, zAt, R })                → { faces, cars }         a low-rise's lot
 *   blockPark(L, D, { zAt, P, R })                          → { faces, trees, paths } a block's park
 *   schoolPitch(rect, { zAt, R })                           → { faces }               a field's pitch
 *   volunteers([u0, v0, u1, v1], { zAt, R })                → { trees }               a vacant lot's young trees
 *
 * Pure: the dice are the caller's.
 */
import { yardOf, fenceOf, serviceOf, backDoorOf, FENCES, ZONES } from '../geotown/yards.js';
import { sitePlan, playgroundOf, pavilionOf, benchOf, pitchOf } from '../geotown/sites.js';

export const BACKS = Object.freeze({
  // a yard narrower than this is lawn (its fences still stand); a yard's fence stands this far off a step's edge
  least: 2.6, edge: 0.15,
  // the fences between back yards, by weight: the pattern's, less a front garden's iron railing
  fences: Object.freeze({ board: 4, lattice: 2, slat: 1, chainlink: 2, picket: 1, brick: 1, stone: 1, hedge: 1 }),
  // a yard's trees: a shade tree's height, a young one's (m)
  shade: Object.freeze([9, 12.5]), young: Object.freeze([4.5, 7.5]),
  // a service yard's lane: its ground's lift over the pad, the spine fence of a shop row
  lift: 0.03, spine: 'chainlink',
  // a park's trees: one every so many square metres of its lawn, kept this far off a path and a thing; their heights
  park: Object.freeze({ per: 260, clear: 3, h: Object.freeze([8, 14]) }),
  // a vacant lot's young trees: one every so many square metres, their heights, how far in from its fence at most
  wild: Object.freeze({ per: 450, h: Object.freeze([3, 6.5]), edge: 9 }),
});

const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;
const roll = (R, lo, hi) => lo + (hi - lo) * R();
const pickWeighted = (R, table, prev = null) => {
  const ks = Object.keys(table).filter((k) => k !== prev || Object.keys(table).length === 1), sum = ks.reduce((a, k) => a + table[k], 0);
  let t = R() * sum;
  for (const k of ks) { t -= table[k]; if (t <= 0) return k; }
  return ks[ks.length - 1];
};
/** Faces made in a plot's own frame (u from 0 across it, v as the side's), moved to the side's: along by `du`, each
 *  corner on `z0`. */
const moved = (fs, du, z0) => fs.map((f) => ({ ...f, corners: f.corners.map(([u, v, z]) => [r4(u + du), r4(v), r4(z0 + z)]) }));

/** A row of houses' yards: `plots` each house's [u0, u1] along the row, contiguous; `v0` their back walls, `v1` where
 *  the yards end (the spine, or the row behind's); `steps` the u where a terrace steps (a yard there is two); `spine`
 *  this row draws the fence along v1 (one row of two draws it). */
export function rowYards(plots, { v0, v1, zAt, P, R, spine = true, steps = [] }) {
  const faces = [], trees = [], plans = [];
  if (!plots.length || v1 - v0 < 2) return { faces, trees, plans };
  const fenceOfPlot = [], yardPrev = { v: null };
  // (each house's fence its own make and paint; a yard's lot line its left neighbour's)
  for (let k = 0; k < plots.length; k++) { const kind = pickWeighted(R, BACKS.fences), ps = FENCES[kind].paints; fenceOfPlot.push({ kind, hex: ps.length ? ps[Math.floor(R() * ps.length)] : null }); }
  const fence = (k, a, b, z) => faces.push(...fenceOf(fenceOfPlot[k].kind, a, b, z, fenceOfPlot[k].hex));
  plots.forEach(([u0, u1], k) => {
    // (the house's yard cut at each terrace step inside it: a yard each, the step's top its fence)
    const cut = [u0, ...steps.filter((s) => s > u0 + 0.5 && s < u1 - 0.5), u1];
    const door = (u0 + u1) / 2;
    for (let j = 0; j + 1 < cut.length; j++) {
      const a = cut[j], b = cut[j + 1], w = b - a, um = (a + b) / 2, z = zAt(um, (v0 + v1) / 2);
      // its plan: each zone's feature never the one the yard before drew there
      const want = Object.fromEntries(ZONES.map((zn) => [zn, P.yards[zn] ? pickWeighted(R, P.yards[zn], yardPrev.v?.[zn] ?? null) : 'lawn']));
      if (w >= BACKS.least) {
        const Y = yardOf(want, { w: w - 2 * BACKS.edge, v0, v1: v1 - 0.3, R });
        yardPrev.v = Y.plan;
        plans.push(Y.plan);
        faces.push(...moved(Y.faces, a + BACKS.edge, z));
        for (const t of Y.trees) trees.push({ u: r4(a + BACKS.edge + t.u), v: r4(t.v), z: r4(z), h: r4(roll(R, ...(t.large ? BACKS.shade : BACKS.young))) });
        // its back door on the house's back wall, where the house's middle is
        if (door >= a && door < b) { const kind = Y.plan.near === 'deck' ? 'deck' : Y.plan.near === 'patio' ? 'patio' : 'stoop'; faces.push(...moved(backDoorOf({ u: Math.min(w - 1.4, Math.max(1.4, door - a)), v: v0, w: kind === 'stoop' ? 0.95 : 1.8, kind }), a, z)); }
      }
      // its fences: the lot line at its start (a step's on the higher side's top), along the spine
      const zs = j > 0 ? Math.max(zAt(a - 0.3, (v0 + v1) / 2), zAt(a + 0.3, (v0 + v1) / 2)) : z;
      fence(j > 0 || k === 0 ? k : k - 1, [a, v0], [a, v1], zs);
      if (spine) fence(k, [a, v1], [b, v1], z);
    }
  });
  // (and at the row's far end)
  const end = plots[plots.length - 1][1];
  fence(plots.length - 1, [end, v0], [end, v1], zAt(end - 0.3, (v0 + v1) / 2));
  return { faces, trees, plans };
}

/** A row of shops' service yard: a paved lane behind them (`v0` their back walls to `v1`), each bay's bins by its back
 *  door and a car now and then; a fence along the spine where `spine`. */
export function shopYards(bays, { v0, v1, zAt, R, spine = true }) {
  const faces = [], cars = [];
  for (const [u0, u1] of bays) {
    const z = zAt((u0 + u1) / 2, (v0 + v1) / 2);
    faces.push({ corners: [[u0, v0, z + BACKS.lift], [u1, v0, z + BACKS.lift], [u1, v1, z + BACKS.lift], [u0, v1, z + BACKS.lift]].map((c) => c.map(r4)), out: [0, 0, 1], role: 'lane' });
    const S = serviceOf('shop', { w: u1 - u0, v0, v1, R });
    faces.push(...moved(S.faces, u0, z + BACKS.lift));
    for (const c of S.cars) cars.push({ u: r4(u0 + c.u), v: r4(c.v), z: r4(z + BACKS.lift), along: c.along });
    if (spine) faces.push(...fenceOf(BACKS.spine, [u0, v1], [u1, v1], z));
  }
  return { faces, cars };
}

/** A low-rise's lot between its street (v0) and its wall (v1), along [u0, u1]: paved, its stalls painted, cars in some. */
export function residentsLot(u0, u1, { v0, v1, zAt, R }) {
  const z = zAt((u0 + u1) / 2, (v0 + v1) / 2) + BACKS.lift, faces = [{ corners: [[u0, v0, z], [u1, v0, z], [u1, v1, z], [u0, v1, z]].map((c) => c.map(r4)), out: [0, 0, 1], role: 'lane' }];
  const S = serviceOf('lowrise', { w: u1 - u0, v0, v1, R });
  faces.push(...moved(S.faces, u0, z));
  return { faces, cars: S.cars.map((c) => ({ u: r4(u0 + c.u), v: r4(c.v), z: r4(z), along: c.along })) };
}

/** A block's park, L along u by D along v: the geotown's park site (its paths, its playground, its pavilion, its benches)
 *  and its trees, loose, clear of them. */
export function blockPark(L, D, { zAt, P, R }) {
  const faces = [], trees = [], S = sitePlan('park', P.sites.park, { L, D, R }), w = S.what;
  const at = (fs, z0 = null) => { for (const f of fs) { const c = f.corners[0]; faces.push({ ...f, corners: f.corners.map(([u, v, z]) => [r4(u), r4(v), r4((z0 ?? zAt(c[0], c[1])) + z)]) }); } };
  // (a thing on its ground's highest corner, never buried on a terrace's step)
  const top = (r) => Math.max(zAt(r[0], r[1]), zAt(r[2], r[1]), zAt(r[2], r[3]), zAt(r[0], r[3]));
  // its paths, cut where the terraces step (each piece on its own level)
  for (const p of w.paths) {
    const alongU = p[2] - p[0] >= p[3] - p[1], n = Math.max(1, Math.ceil((alongU ? p[2] - p[0] : p[3] - p[1]) / 4));
    for (let k = 0; k < n; k++) {
      const q = alongU ? [p[0] + ((p[2] - p[0]) * k) / n, p[1], p[0] + ((p[2] - p[0]) * (k + 1)) / n, p[3]] : [p[0], p[1] + ((p[3] - p[1]) * k) / n, p[2], p[1] + ((p[3] - p[1]) * (k + 1)) / n];
      const z = zAt((q[0] + q[2]) / 2, (q[1] + q[3]) / 2) + BACKS.lift;
      faces.push({ corners: [[q[0], q[1], z], [q[2], q[1], z], [q[2], q[3], z], [q[0], q[3], z]].map((c) => c.map(r4)), out: [0, 0, 1], role: 'park-path' });
    }
  }
  if (w.playground) { const [chips, ...rest] = playgroundOf(w.playground, R), z = top(w.playground); at([chips], z); at(rest, z); }
  if (w.pavilion) at(pavilionOf(w.pavilion), top(w.pavilion));
  for (const p of w.paths) {
    const along = p[2] - p[0] >= p[3] - p[1] ? 'u' : 'v', [a0, a1] = along === 'u' ? [p[0], p[2]] : [p[1], p[3]], c = along === 'u' ? (p[1] + p[3]) / 2 : (p[0] + p[2]) / 2, half = (along === 'u' ? p[3] - p[1] : p[2] - p[0]) / 2;
    let k = 0;
    for (let s = a0 + 6; s < a1 - 6; s += P.sites.park.bench) {
      const side = k++ % 2 ? 1 : -1, cu = along === 'u' ? s : c + side * (half + 0.6), cv = along === 'u' ? c + side * (half + 0.6) : s;
      if (Math.hypot(cu - L / 2, cv - D / 2) < 8) continue;
      at(benchOf(cu, cv, along, -side), zAt(cu, cv));
    }
  }
  // its trees on its lawn, clear of its paths and its things
  const things = [...w.paths, w.playground, w.pavilion].filter(Boolean), clear = (u, v) => things.every((r) => u < r[0] - BACKS.park.clear || u > r[2] + BACKS.park.clear || v < r[1] - BACKS.park.clear || v > r[3] + BACKS.park.clear);
  const want = Math.round((L * D) / BACKS.park.per);
  for (let k = 0, tries = 0; k < want && tries < want * 12; tries++) {
    const u = roll(R, 4, L - 4), v = roll(R, 4, D - 4);
    if (!clear(u, v) || trees.some((t) => Math.hypot(t.u - u, t.v - v) < 5)) continue;
    trees.push({ u: r4(u), v: r4(v), z: r4(zAt(u, v)), h: r4(roll(R, ...BACKS.park.h)) }); k++;
  }
  return { faces, trees, paths: w.paths, things };
}

/** A school field's pitch over `rect` (its lines and its goals), on the field's level. */
export function schoolPitch([u0, v0, u1, v1], { zAt, R }) {
  const z = zAt((u0 + u1) / 2, (v0 + v1) / 2);
  return { faces: moved(pitchOf([u0, v0, u1, v1], R), 0, z) };
}

/** A vacant lot's young trees, seeded where they fall: nearer its fence than its middle, never two on one spot. */
export function volunteers([u0, v0, u1, v1], { zAt, R }) {
  const trees = [], W = BACKS.wild, want = Math.round(((u1 - u0) * (v1 - v0)) / W.per);
  for (let k = 0, tries = 0; k < want && tries < want * 12; tries++) {
    const u = roll(R, u0 + 1.5, u1 - 1.5), v = roll(R, v0 + 1.5, v1 - 1.5), e = Math.min(u - u0, u1 - u, v - v0, v1 - v);
    if (e > W.edge * (0.4 + R()) || trees.some((t) => Math.hypot(t.u - u, t.v - v) < 3)) continue;
    trees.push({ u: r4(u), v: r4(v), z: r4(zAt(u, v)), h: r4(roll(R, ...W.h)) }); k++;
  }
  return { trees };
}
