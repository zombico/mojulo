/**
 * PIAZZA — the Renaissance pieces the `delfino-plaza` dressing stands in its square, read from its style card
 * (style/delfino-plaza.js):
 *   portico     an arcade of grey-stone columns and round arches along one closed side, roundels in the spandrels, on a
 *               stylobate; its roof is a walkway, reached by a stair that climbs its front to a landing;
 *   balustrade  turned balusters between a plinth and a rail, pedestals on the column lines carrying urns, along the
 *               walkway's edges and raking up the stair;
 *   obelisks    red granite needles on stepped pedestals, either side of the fountain across the line from the way in;
 *   quoins      long-and-short stone blocks up each house edge;
 *   skyline     the town's ribbed dome and its bell tower over the roofs: not baked, faded toward the horizon.
 * A pure function of the plan and the houses; no dice are needed (the order is the point).
 */
import { P, r5, sub, dot, lathe, wallFrame } from './geom.js';

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mean = (cs) => [0, 1, 2].map((k) => cs.reduce((s, p) => s + p[k], 0) / cs.length);
const lerp3 = (a, b, t) => [0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * t);
const at = (F, u, off, z) => [F.o[0] + F.U[0] * u + F.N[0] * off, F.o[1] + F.U[1] * u + F.N[1] * off, z];

/** One face, wound counter-clockwise about the normal that points away from `inside`, its uv projected on its own
 *  axes; a surface without a key is a plain tinted face (bronze, the roundels' glaze). */
function face(out, cs, surf, inside) {
  let n = [0, 0, 0];
  for (let i = 0; i < cs.length; i++) {   // Newell: robust when an edge collapses (a lathe's tip, a pyramid)
    const a = cs[i], b = cs[(i + 1) % cs.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  n = unit(n);
  if (inside && dot(n, sub(mean(cs), inside)) < 0) { cs = [...cs].reverse(); n = n.map((v) => -v); }
  const e = sub(cs[1], cs[0]), A = unit(Math.hypot(...e) > 1e-9 ? e : sub(cs[2], cs[1])), B = cross(n, A);
  const f = { corners: cs.map(P), normal: n.map(r5), outNormal: n.map(r5), tint: surf.tint, group: surf.group };
  if (surf.key) Object.assign(f, { texture: surf.key, textureLit: true, uv: cs.map((p) => [r5(dot(p, A) / surf.scale), r5(dot(p, B) / surf.scale)]) });
  out.push(f);
}
/** A quad split into cells about `cell` m on a side, so the bake can put a shadow across it. */
function cells(out, cs, surf, inside, cell = 0.6) {
  const nu = Math.max(1, Math.ceil(Math.hypot(...sub(cs[1], cs[0])) / cell)), nv = Math.max(1, Math.ceil(Math.hypot(...sub(cs[3], cs[0])) / cell));
  const p = (i, j) => lerp3(lerp3(cs[0], cs[1], i / nu), lerp3(cs[3], cs[2], i / nu), j / nv);
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) face(out, [p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)], surf, inside);
}
/** A solid between a bottom ring and a top ring of four corners each (a box, a sheared rail, a tapered shaft). */
function solid(out, bot, top, surf, { cell = 0.6, bottom = false, topFace = true } = {}) {
  const inside = mean([...bot, ...top]);
  for (let i = 0; i < 4; i++) cells(out, [bot[i], bot[(i + 1) % 4], top[(i + 1) % 4], top[i]], surf, inside, cell);
  if (topFace) cells(out, top, surf, inside, cell);
  if (bottom) cells(out, bot, surf, inside, cell);
}
const ring = (c, hx, hy, z) => [[c[0] - hx, c[1] - hy, z], [c[0] + hx, c[1] - hy, z], [c[0] + hx, c[1] + hy, z], [c[0] - hx, c[1] + hy, z]];
const xbox = (out, c, h, z0, z1, surf, opts) => solid(out, ring(c, h, h, z0), ring(c, h, h, z1), surf, opts);
const fring = (F, u0, u1, o0, o1, z) => [at(F, u0, o0, z), at(F, u1, o0, z), at(F, u1, o1, z), at(F, u0, o1, z)];
const fbox = (out, F, u0, u1, o0, o1, z0, z1, surf, opts) => solid(out, fring(F, u0, u1, o0, o1, z0), fring(F, u0, u1, o0, o1, z1), surf, opts);
/** A lathe that is a plain tinted solid (no tile): bronze. */
const plainLathe = (out, c, prof, sides, surf) => { const raw = []; lathe(raw, c, prof, sides, { key: 'x', scale: 1, tint: surf.tint }, surf.group); for (const { texture, textureLit, uv, ...f } of raw) out.push(f); };
const sphere = (R, z) => Array.from({ length: 7 }, (_, j) => { const t = -Math.PI / 2 + (j * Math.PI) / 6; return [r5(Math.cos(t) * R), z + R + Math.sin(t) * R]; });

/**
 * An ARCADE WALL in frame G ({ o, U, N }): between offsets n0 (back) and n1 (front, facing +N), along a0..a1, from the
 * springing zs up to zt; round-headed openings [{ m, Ru, Rz }] through it, piers between, soffits through its depth.
 * Returns the highest crown.
 */
function arcade(out, G, n0, n1, a0, a1, arches, zs, zt, surf, seg) {
  const W = (u, n, z) => [G.o[0] + G.U[0] * u + G.N[0] * n, G.o[1] + G.U[1] * u + G.N[1] * n, z];
  const mid = (n0 + n1) / 2, crown = Math.max(...arches.map((a) => zs + a.Rz));
  const both = (u0, z0a, u1, z0b, z1) => { for (const n of [n0, n1]) face(out, [W(u0, n, z0a), W(u1, n, z0b), W(u1, n, z1), W(u0, n, z1)], surf, W((u0 + u1) / 2, mid, z1 - 0.01)); };
  const pier = (u0, u1) => { if (u1 - u0 < 1e-6) return; cells(out, [W(u0, n0, zs), W(u1, n0, zs), W(u1, n1, zs), W(u0, n1, zs)], surf, W((u0 + u1) / 2, mid, zs + 1)); for (const n of [n0, n1]) cells(out, [W(u0, n, zs), W(u1, n, zs), W(u1, n, crown), W(u0, n, crown)], surf, W((u0 + u1) / 2, mid, zs + 0.01)); };
  let u = a0;
  for (const { m, Ru, Rz } of arches) {
    pier(u, m - Ru);
    const pts = Array.from({ length: seg + 1 }, (_, j) => { const t = Math.PI - (j * Math.PI) / seg; return [m + Ru * Math.cos(t), zs + Rz * Math.sin(t)]; });
    for (let j = 0; j < seg; j++) {
      const [ua, za] = pts[j], [ub, zb] = pts[j + 1];
      both(ua, za, ub, zb, crown);
      const q = [(ua + ub) / 2, (za + zb) / 2], away = unit([q[0] - m, 0, (q[1] - zs) * (Ru / Rz)]);
      face(out, [W(ua, n0, za), W(ub, n0, zb), W(ub, n1, zb), W(ua, n1, za)], surf, W(q[0] + away[0] * 0.05, mid, q[1] + away[2] * 0.05));
    }
    u = m + Ru;
  }
  pier(u, a1);
  for (const n of [n0, n1]) cells(out, [W(a0, n, crown), W(a1, n, crown), W(a1, n, zt), W(a0, n, zt)], surf, W((a0 + a1) / 2, mid, crown + 0.01));
  return crown;
}

/**
 * A BALUSTRADE from a to b ([x, y]) standing on za…zb (a stair's run rakes): a plinth, balusters every `every`, a rail;
 * pedestals at the ends and at `posts` (distances along), an urn on the pedestals `urnAt` names. `start: false` leaves
 * the first pedestal to the run it continues (a corner carries one, not two).
 */
function balustrade(out, a, b, za, zb, D, { posts = [], urnAt = () => false, start = true } = {}) {
  const Bl = D.balustrade, Ur = D.urn, L = Math.hypot(b[0] - a[0], b[1] - a[1]), d = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], s = [-d[1], d[0]];
  const stone = { ...Bl.stone, group: 'stage:balustrade' }, zAt = (t) => za + ((zb - za) * t) / L, raked = Math.abs(zb - za) > 1e-6;
  const p = (t, w) => [a[0] + d[0] * t + s[0] * w, a[1] + d[1] * t + s[1] * w];
  const run = (t0, t1, w, z0, z1) => solid(out, [[...p(t0, -w), zAt(t0) + z0], [...p(t1, -w), zAt(t1) + z0], [...p(t1, w), zAt(t1) + z0], [...p(t0, w), zAt(t0) + z0]],
    [[...p(t0, -w), zAt(t0) + z1], [...p(t1, -w), zAt(t1) + z1], [...p(t1, w), zAt(t1) + z1], [...p(t0, w), zAt(t0) + z1]], stone, { cell: 0.8 });
  const pw = Bl.pedestal, stand = [...new Set([0, ...posts.filter((t) => t > pw && t < L - pw), L])].sort((x, y) => x - y);
  run(0, L, 0.13, 0, Bl.plinth);
  run(0, L, 0.15, Bl.h - 0.1, Bl.h); run(0, L, 0.11, Bl.h - 0.2, Bl.h - 0.1);
  const prof = [[0.66, 0], [0.52, 0.07], [1, 0.33], [0.78, 0.54], [0.5, 0.76], [0.74, 0.86], [0.74, 1]];
  stand.forEach((t, i) => {
    const c = p(t, 0), z = zAt(t), zLow = raked ? Math.min(zAt(t - pw / 2), zAt(t + pw / 2)) - 0.25 : z;
    const drawn = i > 0 || start;
    if (drawn) { xbox(out, c, pw / 2, zLow, z + Bl.h, stone, { cell: 0.8 }); xbox(out, c, pw / 2 + 0.04, z + Bl.h, z + Bl.h + 0.08, stone, { cell: 0.8 }); }
    if (drawn && urnAt(i, stand.length)) {
      const z0 = z + Bl.h + 0.08, R = Ur.r, H = Ur.h;
      lathe(out, c, [[0.55, 0], [0.6, 0.06], [0.34, 0.12], [0.4, 0.18], [0.92, 0.4], [1, 0.54], [0.74, 0.72], [0.58, 0.78], [0.7, 0.83], [0.6, 0.87], [0.28, 0.91], [0.16, 0.97], [0, 1]].map(([r, zz]) => [r5(r * R), r5(z0 + zz * H)]), Ur.sides, Bl.stone, 'stage:urn');
    }
    if (i + 1 < stand.length) {   // the balusters between this pedestal and the next, centred in the gap
      const g0 = t + pw / 2, g1 = stand[i + 1] - pw / 2, n = Math.floor((g1 - g0) / Bl.every);
      for (let k = 0; k < n; k++) {
        const tk = g0 + (g1 - g0 - (n - 1) * Bl.every) / 2 + k * Bl.every, zb0 = zAt(tk) + Bl.plinth, zb1 = zAt(tk) + Bl.h - 0.2;
        lathe(out, p(tk, 0), prof.map(([r, zz]) => [r5(r * Bl.baluster.r), r5(zb0 + zz * (zb1 - zb0))]), Bl.baluster.sides, Bl.stone, 'stage:balustrade');
      }
    }
  });
}

/** The PORTICO along its side: stylobate, columns, arcade, roundels, deck and walkway, cornice, stair, balustrades.
 *  Returns { faces, F, U1, foot } (foot: the floor it stands on, for the floor's cut). */
export function plazaPortico(plan, site) {
  const D = plan.kit.dress, Po = D.portico, F = wallFrame(site.r, Po.side), out = [], { depth, stylobate: sty, spring: zs, deck } = Po;
  const U1 = F.len - Po.end, cr = Po.column.r, pw = 2 * 1.45 * cr, n = Math.max(1, Math.round((U1 - 0.6) / Po.bay)), col = depth - Po.wall / 2;
  const stone = { ...Po.stone, group: 'stage:portico' }, stucco = { ...Po.stucco, group: 'stage:portico' }, floorS = { ...Po.floor, group: 'stage:walkway' };
  const cols = Array.from({ length: n + 1 }, (_, i) => 0.3 + ((U1 - 0.6) * i) / n);
  // the stylobate it stands on: grey stone sides, a floor of hexagonal cotto
  const S = Po.stair, Lw = S.landing, steps = Math.ceil(deck / S.rise - 1e-9), rise = deck / steps, foot = U1 - Lw - (steps - 1) * S.run;
  fbox(out, F, 0, U1, 0, depth + 0.12, 0, sty, stone, { topFace: false });
  cells(out, fring(F, 0, U1, 0, depth + 0.12, sty), floorS, at(F, U1 / 2, depth / 2, 0), 0.7);
  // the columns: Tuscan, a base, a swelling shaft, an echinus and an abacus the arches spring from
  const prof = [[1.45, 0], [1.45, 0.1], [1.22, 0.17], [1.08, 0.24], [1, 0.3], [1.03, (zs - sty) * 0.35], [0.86, zs - sty - 0.34], [0.98, zs - sty - 0.3], [0.88, zs - sty - 0.26], [1.3, zs - sty - 0.1], [1.45, zs - sty - 0.1], [1.45, zs - sty]];
  for (const u of cols) lathe(out, at(F, u, col, 0), prof.map(([r, z]) => [r5(r * cr), r5(sty + z)]), Po.column.sides, Po.stone, 'stage:column');
  // the arcade along the front, and one across each end (from a pilaster at the fronts to the corner column)
  const arches = cols.slice(0, -1).map((u, i) => ({ m: (u + cols[i + 1]) / 2, Ru: (cols[i + 1] - u - pw) / 2, Rz: (cols[i + 1] - u - pw) / 2 }));
  const under = deck - Po.slab, crown = arcade(out, { o: F.o, U: F.U, N: F.N }, depth - Po.wall, depth, 0, U1, arches, zs, deck, stucco, Po.seg);
  const endSpan = col - pw / 2 - 0.3, endArch = [{ m: 0.3 + endSpan / 2, Ru: endSpan / 2, Rz: Math.min(endSpan / 2, crown - zs) }];
  for (const [u, sgn] of [[0, -1], [U1, 1]]) {
    const o = at(F, u, 0, 0), N = F.U.map((v) => v * sgn);
    arcade(out, { o, U: F.N, N }, -Po.wall, 0, 0, depth, endArch, zs, deck, stucco, Po.seg);
    fbox(out, F, sgn < 0 ? 0 : U1 - Po.wall, sgn < 0 ? Po.wall : U1, 0.02, 0.3, sty, zs, stone);   // the pilaster at the fronts
  }
  // a string course over the crowns, the roundels between the arches, the cornice the walkway's edge stands on
  fbox(out, F, 0, U1, depth, depth + 0.06, crown + 0.06, crown + 0.16, stone);
  const Rd = Po.roundel, rz = crown - 0.32;
  for (const u of cols.slice(1, -1)) for (const [R, tint, lift] of [[Rd.r, Rd.blue, 0.03], [Rd.r * 0.62, Rd.white, 0.045]]) {
    const cs = Array.from({ length: Rd.sides }, (_, k) => { const t = (2 * Math.PI * k) / Rd.sides; return at(F, u + Math.cos(t) * R, depth + lift, rz + Math.sin(t) * R); });
    face(out, cs, { key: null, tint, group: 'stage:roundel' }, at(F, u, depth - 1, rz));
  }
  fbox(out, F, 0, U1, depth - 0.02, depth + Po.cornice.out, deck - Po.cornice.h, deck, stone, { bottom: true, topFace: false });
  // the deck: a stucco ceiling under it, the walkway (the same cotto) on it
  cells(out, fring(F, Po.wall, U1 - Po.wall, 0, depth - Po.wall, under), stucco, at(F, U1 / 2, depth / 2, under + 1), 0.9);
  cells(out, fring(F, 0, U1, 0, depth + Po.cornice.out, deck), floorS, at(F, U1 / 2, depth / 2, deck - 1), 0.7);
  // the stair climbs the front toward the far end, stucco masonry under stone treads, to a landing level with the walkway
  const o0 = depth + Po.cornice.out, o1 = o0 + S.width;
  for (let k = 0; k < steps - 1; k++) {
    fbox(out, F, foot + k * S.run, foot + (k + 1) * S.run, o0, o1, 0, (k + 1) * rise, stucco, { cell: 0.8, topFace: false });
    cells(out, fring(F, foot + k * S.run - 0.03, foot + (k + 1) * S.run, o0, o1 + 0.03, (k + 1) * rise), stone, at(F, foot, o0, 0), 0.8);
  }
  fbox(out, F, U1 - Lw, U1, depth + Po.cornice.out, o1, 0, deck, stucco, { topFace: false, cell: 0.8 });
  cells(out, fring(F, U1 - Lw, U1, depth + Po.cornice.out, o1, deck), floorS, at(F, U1 - Lw / 2, o0, deck - 1), 0.7);
  // the balustrades: along the walkway's front (open where the landing joins it), across the open end, round the
  // landing and down the stair; pedestals on the column lines, urns on every other one
  const edge = depth + Po.cornice.out - 0.16, wr = (u, o) => at(F, u, o, 0).slice(0, 2), ue = U1 - Lw, rail = o1 - 0.16;
  balustrade(out, wr(0.2, 0.25), wr(0.2, edge), deck, deck, D, { urnAt: (i, len) => i === len - 1 });
  balustrade(out, wr(0.2, edge), wr(ue, edge), deck, deck, D, { start: false, posts: cols.map((u) => u - 0.2), urnAt: (i, len) => i === len - 1 || i % D.urn.every === 0 });
  balustrade(out, wr(U1 - 0.2, 0.25), wr(U1 - 0.2, rail), deck, deck, D, { urnAt: (i, len) => i === len - 1 });
  balustrade(out, wr(U1 - 0.2, rail), wr(ue, rail), deck, deck, D, { start: false });
  // the stair's rail rakes with the nosings: a rise over the foot, level with the walkway at the landing
  balustrade(out, wr(ue, rail), wr(foot, rail), deck, rise, D, { start: false, urnAt: (i, len) => i === len - 1 });
  // what it stands on: the floor under the stylobate, the stair and the landing is cut away
  const corners = [fring(F, 0, U1, 0, depth + 0.12, 0), fring(F, foot, U1, o0, o1, 0)];
  const inside = (q) => corners.some((cs) => { const xs = cs.map((p) => p[0]), ys = cs.map((p) => p[1]); return q[0] >= Math.min(...xs) - 1e-6 && q[0] <= Math.max(...xs) + 1e-6 && q[1] >= Math.min(...ys) - 1e-6 && q[1] <= Math.max(...ys) + 1e-6; });
  return { faces: out, F, U1, depth, deck, foot, under: (f) => f.corners.every(inside) };
}

/** The OBELISKS: either side of the fountain, across the line from the way in (the open corner) to the centre. */
export function plazaObelisks(plan, site) {
  const O = plan.kit.dress.obelisks, { r, c } = site, out = [];
  const way = [r.open.includes('+x') ? r.x1 : r.open.includes('-x') ? r.x0 : c[0], r.open.includes('-y') ? r.y0 : r.open.includes('+y') ? r.y1 : c[1]];
  const v = unit([c[0] - way[0], c[1] - way[1], 0]), perp = Math.hypot(v[0], v[1]) > 0.5 ? [-v[1], v[0]] : [1, 0];
  const granite = { ...O.granite, group: 'stage:obelisk' }, stone = { ...O.stone, group: 'stage:obelisk' }, bronze = { key: null, tint: O.bronze, group: 'stage:bronze' };
  const spots = [1, -1].map((sg) => [c[0] + perp[0] * O.spread * sg, c[1] + perp[1] * O.spread * sg]);
  for (const p of spots) {
    let z = 0;
    for (const [w, h] of O.steps) { xbox(out, p, w / 2, z, z + h, stone); z += h; }
    const Pw = O.pedestal.w;
    xbox(out, p, Pw / 2 + 0.08, z, z + 0.2, stone); xbox(out, p, Pw / 2, z + 0.2, z + O.pedestal.h - 0.2, stone); xbox(out, p, Pw / 2 + 0.1, z + O.pedestal.h - 0.2, z + O.pedestal.h, stone);
    z += O.pedestal.h;
    const b = O.shaft.base / 2;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) plainLathe(out, [p[0] + sx * b * 0.8, p[1] + sy * b * 0.8], sphere(O.balls, z), 8, bronze);
    z += 2 * O.balls;
    const t = O.shaft.top / 2, z1 = z + O.shaft.h;
    solid(out, ring(p, b, b, z), ring(p, t, t, z1), granite, { cell: 0.7, topFace: false, bottom: true });
    const apex = [p[0], p[1], z1 + O.point], top = ring(p, t, t, z1);
    for (let i = 0; i < 4; i++) face(out, [top[i], top[(i + 1) % 4], apex], granite, [p[0], p[1], z1]);
    // the cross on the point
    const zc = z1 + O.point, X = O.cross, th = 0.05;
    xbox(out, [p[0], p[1]], th, zc, zc + X, bronze);
    solid(out, ring(p, X * 0.3, th, zc + X * 0.6), ring(p, X * 0.3, th, zc + X * 0.6 + 2 * th), bronze, { bottom: true });
  }
  return { faces: out, spots };
}

/** QUOINS up every house edge (on the portico side, from the walkway up): long and short courses, alternately. */
export function plazaQuoins(plan, houses, portico) {
  const Q = plan.kit.dress.quoins, H = plan.kit.house, out = [], stone = { key: plan.kit.tiles.trim.key, scale: plan.kit.tiles.trim.scale, tint: Q.tint, group: 'stage:quoin' };
  const walls = new Map(); for (const h of houses) (walls.get(h.F.o.join()) || walls.set(h.F.o.join(), []).get(h.F.o.join())).push(h);
  for (const list of walls.values()) {
    const F = list[0].F, onPortico = portico && F.o.join() === portico.F.o.join();
    const edges = list.map((h, i) => [h.u0, Math.max(h.top, list[i - 1]?.top ?? 0)]).concat([[list[list.length - 1].u1, list[list.length - 1].top]]);
    for (const [u, top] of edges) {
      const z0 = onPortico && u <= portico.U1 + 0.01 ? portico.deck + 0.05 : H.base.h, z1 = top - H.eave.h, nC = Math.floor((z1 - z0) / Q.h);
      const lo = u < 0.01 ? 0 : u > F.len - 0.01 ? -1 : -0.5;   // at a wall's end the block runs into the front, else it straddles the edge
      for (let k = 0; k < nC; k++) {
        const w = k % 2 ? Q.short : Q.long, a = u + lo * w, za = z0 + k * Q.h;
        fbox(out, F, Math.max(0, a), Math.min(F.len, a + w), 0, Q.out, za + 0.012, za + Q.h - 0.012, stone, { cell: 1 });
      }
    }
  }
  return out;
}

/** The SKYLINE's dome and bell tower: unbaked fills, lit by the way a face turns to the sun, faded toward the horizon. */
export function plazaSkyline(plan, site, toSun) {
  const Sk = plan.kit.dress.skyline, { r } = site, horizon = plan.ref.air.dome.horizon.map((v) => v / 255), out = [];
  const tone = (f, rgb, fade) => {
    const lam = Math.max(0, dot(f.normal, toSun)), light = 0.6 + 0.48 * lam;
    const { texture, textureLit, uv, tint, rib, ...g } = f;
    const c = rgb.map((v, k) => v * light + (horizon[k] - v * light) * fade);
    return { ...g, fill: `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0')).join('')}`, group: 'stage:skyline' };
  };
  const Dm = Sk.dome, dc = [r.x0 + Dm.at[0], r.y0 + Dm.at[1]], raw = [];
  const put = (faces, rgbOf, fade) => { for (const f of faces) out.push(tone(f, rgbOf(f), fade)); };
  // the drum (an octagon, a cornice), the pointed dome (a circle struck from a centre inside the far side), its ribs
  // white on the terracotta, the lantern and its cone
  const Dr = Dm.drum, zd = Dr.z + Dr.h, Rc = Dm.R * Dm.pointed, cx = Dm.R - Rc, lt = Dm.lantern;
  lathe(raw, dc, [[Dr.R, Dr.z], [Dr.R, zd - 0.6], [Dr.R + 0.5, zd - 0.3], [Dr.R + 0.5, zd], [Dm.R, zd]], 8, { key: 'x', scale: 1, tint: [1, 1, 1] }, 'drum');
  put(raw.splice(0), () => Dr.color, Dm.fade);
  const t1 = Math.acos((lt.r - cx) / Rc), prof = Array.from({ length: 9 }, (_, j) => { const t = (t1 * j) / 8; return [r5(cx + Rc * Math.cos(t)), r5(zd + Rc * Math.sin(t))]; });
  lathe(raw, dc, prof, Dm.sides, { key: 'x', scale: 1, tint: [1, 1, 1] }, 'dome');
  const per = Dm.sides / Dm.ribs;
  put(raw.splice(0).map((f, i) => ({ ...f, rib: i % Dm.sides % per === 0 })), (f) => (f.rib ? Dm.rib : Dm.color), Dm.fade);
  const zl = prof[prof.length - 1][1];
  lathe(raw, dc, [[lt.r, zl], [lt.r, zl + lt.h * 0.5], [lt.r * 1.25, zl + lt.h * 0.55], [lt.r * 0.5, zl + lt.h * 0.9], [0.25, zl + lt.h * 0.92], [0, zl + lt.h]], 8, { key: 'x', scale: 1, tint: [1, 1, 1] }, 'lantern');
  put(raw.splice(0), () => Dm.rib, Dm.fade);
  // the bell tower: a square shaft banded every storey, the belfry's dark arches, a cornice, a pyramid roof
  const Cp = Sk.campanile, cc = [r.x0 + Cp.at[0], r.y0 + Cp.at[1]], h = Cp.w / 2, zb = Cp.z + Cp.h - Cp.belfry, zt = Cp.z + Cp.h;
  for (let z = Cp.z, k = 0; z < zb - 1e-6; z += 3, k++) { solid(raw, ring(cc, h, h, z), ring(cc, h, h, Math.min(zb, z + 3)), { key: null, tint: [1, 1, 1] }, { cell: 99, topFace: false }); put(raw.splice(0), () => (k % 2 ? Cp.band : Cp.color), Cp.fade); }
  solid(raw, ring(cc, h, h, zb), ring(cc, h, h, zt), { key: null, tint: [1, 1, 1] }, { cell: 99, topFace: false });
  put(raw.splice(0), () => Cp.color, Cp.fade);
  for (const [nx, ny] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const s of [-0.24, 0.24]) {   // two arches a side
    const ax = [-ny, nx], cen = [cc[0] + nx * (h + 0.02) + ax[0] * s * Cp.w, cc[1] + ny * (h + 0.02) + ax[1] * s * Cp.w], hw = Cp.w * 0.14, z0 = zb + 0.6, z1 = zt - 0.9;
    const cs = [[cen[0] - ax[0] * hw, cen[1] - ax[1] * hw, z0], [cen[0] + ax[0] * hw, cen[1] + ax[1] * hw, z0], [cen[0] + ax[0] * hw, cen[1] + ax[1] * hw, z1 - hw], [cen[0], cen[1], z1], [cen[0] - ax[0] * hw, cen[1] - ax[1] * hw, z1 - hw]];
    face(raw, cs, { key: null, tint: [1, 1, 1] }, [cc[0], cc[1], (z0 + z1) / 2]);
    put(raw.splice(0), () => Cp.dark, Cp.fade);
  }
  solid(raw, ring(cc, h + 0.35, h + 0.35, zt), ring(cc, h + 0.35, h + 0.35, zt + 0.5), { key: null, tint: [1, 1, 1] }, { cell: 99, bottom: true });
  put(raw.splice(0), () => Cp.band, Cp.fade);
  const top = ring(cc, h + 0.2, h + 0.2, zt + 0.5), apex = [cc[0], cc[1], zt + 0.5 + Cp.spire];
  for (let i = 0; i < 4; i++) face(raw, [top[i], top[(i + 1) % 4], apex], { key: null, tint: [1, 1, 1] }, [cc[0], cc[1], zt]);
  put(raw.splice(0), () => Cp.roof, Cp.fade);
  return out;
}
