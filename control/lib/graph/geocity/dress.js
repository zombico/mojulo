/**
 * THE CONCOURSES DRESSED — what makes the geocity's walked-in podiums (geocity/podium.js) and the passages between them
 * (geocity/tunnels.js) read as the public space under a downtown rather than a basement: shopfronts along each
 * concourse's walls, a food court in the busiest concourse, and its wayfinding, a colour a route.
 *
 *   ROUTES                       a colour a route: the passages running north and south one, those running east and
 *                                west the other (a stripe down each passage's floor, tunnels.js `look.stripe`, and a
 *                                sign over each concourse's way out onto it)
 *   SHOP                         a shopfront's numbers: its bay, its glass, its mullions, its sign band, how far it
 *                                keeps from a way out and the stair
 *   dressUnder({ podia, tunnels, seed }) → { faces, colliders, readout }
 *       podia: [{ block, I }] (podium.js podiumInside: its concourse's box, its flight, its ways out and its walks);
 *       tunnels: the passages built. Shopfronts in bays along every concourse wall but where a way out or the stair
 *       stands; a sign in its route's colour over each way out; a food court (tables and their stools, each a box) in
 *       the concourse with the most ways out (the hub), on the cells a body's width and more clear of every walk through
 *       it, so the ways through stay walked. → readout: { routes, shops (a concourse its bays), court: { podium, tables } }
 *
 * Metres, the design's frame (x east, y north, z up). Pure; seeded dice only (a shop's sign colour).
 */
import { streamOf } from '../city/plan/dice.js';

const r5 = (v) => Math.round(v * 1e5) / 1e5 + 0;
const P3 = (p) => p.map(r5);

export const ROUTES = Object.freeze({ ns: '#2f8fb0', ew: '#d9a03a' });
export const SHOP = Object.freeze({
  bay: 5, least: 3, gap: 0.4, kick: 0.25, glass: 2.7, frame: 0.12, sign: 0.48, mullion: 1.6, proud: 0.06,
  // how far a shopfront keeps from a way out's frame and from the stair's flight (m)
  clear: 1.2,
});
// the sign bands' colours (a shop's, by its dice), the food court's warmer
const SIGNS = ['#c8433a', '#2f6db0', '#e0b13c', '#3f8f5a', '#8a4fb0', '#d9733a', '#2a2a2e', '#b03a6d'];
const FOOD = ['#d9733a', '#c8433a', '#e0b13c', '#7a9a3a'];
const COURT = Object.freeze({ step: 3.2, margin: 2.2, clear: 1.3, most: 16 });

const shade = (hex, g) => `#${[1, 3, 5].map((i) => Math.round(Math.max(0, Math.min(255, parseInt(hex.slice(i, i + 2), 16) * g))).toString(16).padStart(2, '0')).join('')}`;

/** A quad wound so its normal points along `n`, one fill. */
function quad(out, cs, n, group, fill) {
  const e1 = [cs[1][0] - cs[0][0], cs[1][1] - cs[0][1], cs[1][2] - cs[0][2]], e2 = [cs[3][0] - cs[0][0], cs[3][1] - cs[0][1], cs[3][2] - cs[0][2]];
  const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], c = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0 ? cs.slice().reverse() : cs;
  out.push({ corners: c.map(P3), normal: P3(n), outNormal: P3(n), group, fill, cornerFills: c.map(() => fill) });
}

/** A box square to the axes: its top and its four sides (its underside never seen), one fill, the sides a little darker. */
function box(out, [x0, y0, z0], [x1, y1, z1], group, fill) {
  quad(out, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], group, fill);
  const side = shade(fill, 0.8);
  quad(out, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], group, side);
  quad(out, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0], group, side);
  quad(out, [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], [-1, 0, 0], group, side);
  quad(out, [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0], group, side);
}

/** The least distance from a point to a polyline in plan. */
function toLine(p, line) {
  let best = Infinity;
  for (let k = 0; k + 1 < line.length; k++) {
    const a = line[k], b = line[k + 1], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
    best = Math.min(best, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy));
  }
  return best;
}

export function dressUnder({ podia, tunnels = [], seed = 1 }) {
  const faces = [], colliders = [], shops = {};
  const routeOf = new Map(tunnels.map((t) => [t.id, Math.abs(t.line[t.line.length - 1][0] - t.line[0][0]) > Math.abs(t.line[t.line.length - 1][1] - t.line[0][1]) ? 'ew' : 'ns']));
  // the hub: the concourse with the most ways out (the nearest the seat first, as the podiums stand)
  const hub = podia.length ? podia.reduce((a, b) => (b.I.ports.length > a.I.ports.length ? b : a)) : null;
  for (const P of podia) {
    const I = P.I, cb = I.rooms.find((r) => r.id === 'concourse').box, z0 = cb.min[2], R = streamOf(seed, 'under-shops', P.block), food = P === hub && I.ports.length > 0;
    const lum = 1.0, walls = [
      // [the wall's side, its line, the axis along it, the way into the room]
      ['-y', cb.min[1], 0, [0, 1, 0]], ['+y', cb.max[1], 0, [0, -1, 0]], ['-x', cb.min[0], 1, [1, 0, 0]], ['+x', cb.max[0], 1, [-1, 0, 0]],
    ];
    // ── a sign over each way out, in its route's colour, facing into the concourse ──
    for (const q of I.ports) {
      const colour = ROUTES[routeOf.get(q.id) ?? (q.side.endsWith('y') ? 'ns' : 'ew')], n = [-q.N[0], -q.N[1], 0], ax = q.side.endsWith('y') ? 0 : 1;
      // (on the wall's inner face, a wall's depth inside its outer one)
      const line = q.plane - (q.N[1 - ax] || 0) * 0.5 + n[1 - ax] * SHOP.proud, za = q.z0 + q.top + 0.12, zb = za + 0.5;
      const at = (u, z) => { const p = [0, 0, z]; p[ax] = u; p[1 - ax] = line; return p; };
      quad(faces, [at(q.lo - 0.2, za), at(q.hi + 0.2, za), at(q.hi + 0.2, zb), at(q.lo - 0.2, zb)], n, 'geocity:under-sign', shade(colour, 1.15));
      const zc = za - 0.08;
      quad(faces, [at(q.lo - 0.2, zc), at(q.hi + 0.2, zc), at(q.hi + 0.2, za), at(q.lo - 0.2, za)], n, 'geocity:under-sign', '#f2f2ee');
    }
    // ── shopfronts in bays along each wall, clear of its ways out and its stair ──
    let count = 0;
    for (const [side, line, ax, n] of walls) {
      const lo = cb.min[ax] + 0.6, hi = cb.max[ax] - 0.6, cuts = [];
      for (const q of I.ports) if (q.side === side) cuts.push([q.lo - SHOP.clear, q.hi + SHOP.clear]);
      // (the stair's flight, where it stands against this wall)
      const F = I.flight, o = 1 - ax, gap = side.startsWith('-') ? F[o] - line : line - F[o + 2];
      if (gap < SHOP.clear + 0.6) cuts.push([F[ax] - SHOP.clear, F[ax + 2] + SHOP.clear]);
      const free = [];
      let at0 = lo;
      for (const [a, b] of cuts.sort((p, q) => p[0] - q[0])) { if (a > at0) free.push([at0, Math.min(a, hi)]); at0 = Math.max(at0, b); }
      if (at0 < hi) free.push([at0, hi]);
      for (const [a, b] of free) {
        const len = b - a, m = Math.floor((len + SHOP.gap) / (SHOP.bay + SHOP.gap));
        if (len < SHOP.least) continue;
        const k = Math.max(1, m), bay = (len - (k - 1) * SHOP.gap) / k;
        for (let i = 0; i < k; i++) {
          const u0 = a + i * (bay + SHOP.gap), u1 = u0 + bay, w = line + n[o] * SHOP.proud;
          const pt = (u, z, d = 0) => { const p = [0, 0, z]; p[ax] = u; p[o] = w + n[o] * d; return p; };
          const sign = (food ? FOOD : SIGNS)[Math.floor(R() * (food ? FOOD : SIGNS).length)];
          const zk = z0 + SHOP.kick, zg = z0 + SHOP.glass, zf = zg + SHOP.frame, zs = zf + SHOP.sign;
          quad(faces, [pt(u0, z0), pt(u1, z0), pt(u1, zk), pt(u0, zk)], n, 'geocity:shopfront', shade('#3a3a3e', lum));
          // (the glass: a lit shop behind it, warm)
          quad(faces, [pt(u0, zk), pt(u1, zk), pt(u1, zg), pt(u0, zg)], n, 'geocity:shop-glass', shade(food ? '#f0d8b0' : '#dfe6ea', 0.95));
          quad(faces, [pt(u0, zg), pt(u1, zg), pt(u1, zf), pt(u0, zf)], n, 'geocity:shopfront', shade('#3a3a3e', lum));
          quad(faces, [pt(u0, zf), pt(u1, zf), pt(u1, zs), pt(u0, zs)], n, 'geocity:shop-sign', shade(sign, 1.1));
          // (its mullions, a hand proud of the glass)
          const nm = Math.max(1, Math.round(bay / SHOP.mullion));
          for (let j = 1; j < nm; j++) { const um = u0 + (bay * j) / nm; quad(faces, [pt(um - 0.04, zk, 0.03), pt(um + 0.04, zk, 0.03), pt(um + 0.04, zg, 0.03), pt(um - 0.04, zg, 0.03)], n, 'geocity:shopfront', shade('#3a3a3e', lum)); }
          count++;
        }
      }
    }
    shops[P.block] = count;
  }
  // ── the food court: tables and their stools in the hub, on the cells clear of every walk through it ──
  let court = null;
  if (hub && hub.I.ports.length) {
    const I = hub.I, cb = I.rooms.find((r) => r.id === 'concourse').box, z0 = cb.min[2];
    const walks = [I.through, I.down, ...I.ports.map((q) => q.reach)].filter((l) => Array.isArray(l) && l.length > 1);
    const F = I.flight, x0 = cb.min[0] + COURT.margin, y0 = cb.min[1] + COURT.margin, x1 = cb.max[0] - COURT.margin, y1 = cb.max[1] - COURT.margin;
    const nx = Math.floor((x1 - x0) / COURT.step), ny = Math.floor((y1 - y0) / COURT.step), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const cells = [];
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) {
      const p = [cx + (i - nx / 2) * COURT.step, cy + (j - ny / 2) * COURT.step];
      // (a table and its stools, 1.9 m across: clear of the flight and a body's width and more from every walk)
      const clearFlight = p[0] + 0.95 < F[0] - 1 || p[0] - 0.95 > F[2] + 1 || p[1] + 0.95 < F[1] - 1 || p[1] - 0.95 > F[3] + 1;
      if (clearFlight && walks.every((l) => toLine(p, l) > 0.95 + COURT.clear)) cells.push(p);
    }
    const kept = cells.slice(0, COURT.most);
    for (const [x, y] of kept) {
      box(faces, [x - 0.45, y - 0.45, z0 + 0.72], [x + 0.45, y + 0.45, z0 + 0.76], 'geocity:food-court', '#b8a07a');
      box(faces, [x - 0.07, y - 0.07, z0], [x + 0.07, y + 0.07, z0 + 0.72], 'geocity:food-court', '#4a4a4e');
      for (const [dx, dy] of [[-0.75, 0], [0.75, 0], [0, -0.75], [0, 0.75]]) {
        box(faces, [x + dx - 0.19, y + dy - 0.19, z0 + 0.42], [x + dx + 0.19, y + dy + 0.19, z0 + 0.46], 'geocity:food-court', '#c8433a');
        box(faces, [x + dx - 0.04, y + dy - 0.04, z0], [x + dx + 0.04, y + dy + 0.04, z0 + 0.42], 'geocity:food-court', '#4a4a4e');
      }
      colliders.push({ min: P3([x - 0.95, y - 0.95, z0]), max: P3([x + 0.95, y + 0.95, z0 + 0.8]), of: `${hub.block}:court` });
    }
    court = { podium: hub.block, tables: kept.length };
  }
  return { faces, colliders, readout: { routes: { ...ROUTES }, shops, ...(court ? { court } : {}) } };
}
