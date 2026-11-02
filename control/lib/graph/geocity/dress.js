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
 *       it, so the ways through stay walked. In the mall's glass and steel (polygonizer/floorplan-mall.js): a shopfront a
 *       display pane out from its lit display in a steel frame under a sign bulkhead; a laylight down each concourse's
 *       middle (its glass lit, its frame steel); glass panes down the lobby's stair-well rails under a steel cap; a glass
 *       canopy on a steel frame over each street door (`street`: outside, in the sun). → { faces, street, colliders,
 *       readout: { routes, shops (a concourse its bays), court: { podium, tables } } }
 *
 * Metres, the design's frame (x east, y north, z up). Pure; seeded dice only (a shop's sign colour).
 */
import { streamOf } from '../city/plan/dice.js';
import { setFaces, fitFaces, SETS, FITTINGS } from './court-kit.js';

const r5 = (v) => Math.round(v * 1e5) / 1e5 + 0;
const P3 = (p) => p.map(r5);

export const ROUTES = Object.freeze({ ns: '#2f8fb0', ew: '#d9a03a' });
// a shopfront as a mall glazes one (polygonizer/floorplan-mall.js `glazedFront`): a display pane `depth` out from the
// wall the shop's lit display stands against, its frame real steel members (a kick plinth, a head rail, slim mullions,
// end jambs), a deeper sign bulkhead over it in the shop's colour, dark steel returns either end
export const SHOP = Object.freeze({
  bay: 5, least: 3, gap: 0.4, kick: 0.45, glass: 2.75, bulkhead: 3.35, mullion: 1.75, depth: 0.5, proud: 0.04,
  // how far a shopfront keeps from a way out's frame and from the stair's flight (m: room for a pair of bins beside a
  // way out)
  clear: 1.7,
});
// the mall's glass and steel: display glass light enough to read the shop through, brushed steel, a darker mullion, the
// kick's dark steel (polygonizer/floorplan-mall.js)
export const GLASS = 'rgba(205,228,235,0.16)', STEEL = '#9aa0a6', MULLION = '#7c8088', DARK = '#3a3d42';
// a wall's cladding: pale stone (the mall's piers', polygonizer/floorplan-mall.js) in large-format panels a module wide
const CLAD = Object.freeze({ stone: '#d6cfc0', module: 1.5 });
// the sign bands' colours (a shop's, by its dice), the food court's warmer
const SIGNS = ['#c8433a', '#2f6db0', '#e0b13c', '#3f8f5a', '#8a4fb0', '#d9733a', '#2a2a2e', '#b03a6d'];
const FOOD = ['#d9733a', '#c8433a', '#e0b13c', '#7a9a3a'];
// the food court: its cells, its margin to the walls, its clearance to a walk (m), the most sets it seats, the mix its
// dice draw a set from, its upholstery and its tables' tops
const COURT = Object.freeze({ step: 3.4, margin: 2, clear: 0.6, most: 14, mix: ['cafe', 'cafe', 'bistro', 'communal', 'booth'],
  seats: ['#c8433a', '#2f6f8a', '#d9a03a', '#3f7f5a'], woods: ['#b08a5a', '#8a6a48', '#c9b08a'] });
// the laylight: how far under the concourse's ceiling's height it hangs from its floor (m), its glow, its frame, its ribs
const LAYLIGHT = Object.freeze({ under: 3.82, glow: '#eef4f7', frame: '#6c7176', rib: 2.4 });
// the entrance canopy: its width, its reach out from the facade, its height over the plaza (m)
const CANOPY = Object.freeze({ width: 7, reach: 2.6, height: 3.4 });

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

/**
 * A room's walls clad as a mall's are (`box` its inside, `z0` its floor, `top` the cladding's head): on each wall, where
 * nothing stands (`cuts(side, ax)` → the spans along it taken), large-format pale stone panels a module wide, a steel
 * reveal between each two, a steel skirting under them and a steel band over them.
 */
function clad(out, cb, z0, top, cuts) {
  const walls = [['-y', cb.min[1], 0, [0, 1, 0]], ['+y', cb.max[1], 0, [0, -1, 0]], ['-x', cb.min[0], 1, [1, 0, 0]], ['+x', cb.max[0], 1, [-1, 0, 0]]];
  for (const [side, line, ax, n] of walls) {
    const o = 1 - ax, lo = cb.min[ax] + 0.05, hi = cb.max[ax] - 0.05, free = [];
    let at0 = lo;
    for (const [a, b] of cuts(side, ax).slice().sort((p, q) => p[0] - q[0])) { if (a > at0) free.push([at0, Math.min(a, hi)]); at0 = Math.max(at0, b); }
    if (at0 < hi) free.push([at0, hi]);
    const pt = (u, z, d) => { const p = [0, 0, z]; p[ax] = u; p[o] = line + n[o] * d; return p; };
    for (const [a, b] of free) {
      if (b - a < 0.3) continue;
      quad(out, [pt(a, z0, 0.03), pt(b, z0, 0.03), pt(b, z0 + 0.15, 0.03), pt(a, z0 + 0.15, 0.03)], n, 'geocity:cladding', shade(DARK, 1.6));
      const m = Math.max(1, Math.round((b - a) / CLAD.module));
      for (let i = 0; i < m; i++) {
        const u0 = a + ((b - a) * i) / m, u1 = a + ((b - a) * (i + 1)) / m;
        quad(out, [pt(u0, z0 + 0.15, 0.025), pt(u1, z0 + 0.15, 0.025), pt(u1, top, 0.025), pt(u0, top, 0.025)], n, 'geocity:cladding', shade(CLAD.stone, 0.92 + 0.08 * ((i * 7) % 3) / 2));
        if (i) quad(out, [pt(u0 - 0.015, z0 + 0.15, 0.035), pt(u0 + 0.015, z0 + 0.15, 0.035), pt(u0 + 0.015, top, 0.035), pt(u0 - 0.015, top, 0.035)], n, 'geocity:cladding', MULLION);
      }
      quad(out, [pt(a, top, 0.035), pt(b, top, 0.035), pt(b, top + 0.1, 0.035), pt(a, top + 0.1, 0.035)], n, 'geocity:cladding', STEEL);
    }
  }
}

/** The spans along a room's wall its openings take: its street door, its ways out, its stair's flight where it stands
 *  against that wall, each with a hand to spare. */
function openingsOn(I, side, cb, ax) {
  const line = side === '-y' ? cb.min[1] : side === '+y' ? cb.max[1] : side === '-x' ? cb.min[0] : cb.max[0], o = 1 - ax, out = [];
  const D = I.door;
  if ((D.axis === 'x') === (ax === 0) && Math.abs(D.plane - line) < 0.8) out.push([D.u0 - 0.4, D.u1 + 0.4]);
  for (const q of I.ports) if ((q.side.endsWith('y')) === (ax === 0) && Math.abs(q.plane - line) < 0.8) out.push([q.lo - 0.4, q.hi + 0.4]);
  const F = I.flight, gap = side.startsWith('-') ? F[o] - line : line - F[o + 2];
  if (gap < 1.2) out.push([F[ax] - 0.4, F[ax + 2] + 0.4]);
  return out;
}

/** A podium's walks: its way through, its way down, each way out's reach. */
const walksOf = (I) => [I.through, I.down, ...I.ports.map((q) => q.reach)].filter((l) => Array.isArray(l) && l.length > 1);

/** The least distance from a polyline to a rectangle in plan (0 where it enters it), sampled a tenth of a metre apart. */
function toRect(line, R) {
  let best = Infinity;
  for (let k = 0; k + 1 < line.length; k++) {
    const a = line[k], b = line[k + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.1));
    for (let i = 0; i <= n; i++) {
      const x = a[0] + ((b[0] - a[0]) * i) / n, y = a[1] + ((b[1] - a[1]) * i) / n;
      best = Math.min(best, Math.hypot(Math.max(R[0] - x, 0, x - R[2]), Math.max(R[1] - y, 0, y - R[3])));
    }
  }
  return best;
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
  const faces = [], colliders = [], shops = {}, street = [];
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
    const taken = Object.fromEntries(walls.map(([side]) => [side, []]));
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
          // (a bay where a walk passes within a body's width of its glass is left as wall: the walks are the concourse's)
          const foot = [[u0, 0], [u1, 0], [u1, SHOP.depth + 0.18], [u0, SHOP.depth + 0.18]].map(([uu, d]) => { const p = [0, 0]; p[ax] = uu; p[o] = w + n[o] * d; return p; });
          const fr = [Math.min(...foot.map((p) => p[0])), Math.min(...foot.map((p) => p[1])), Math.max(...foot.map((p) => p[0])), Math.max(...foot.map((p) => p[1]))];
          if (walksOf(I).some((l) => toRect(l, fr) < 0.4)) continue;
          taken[side].push([u0, u1]);
          // (a point `d` out from the wall; a box from u0..u1, d0..d1 out, z0..z1 up, in the world)
          const pt = (u, z, d = 0) => { const p = [0, 0, z]; p[ax] = u; p[o] = w + n[o] * d; return p; };
          const slab = (ua, ub, d0, d1, za, zb, group, fill) => { const p = pt(ua, za, d0), q = pt(ub, zb, d1); box(faces, [Math.min(p[0], q[0]), Math.min(p[1], q[1]), za], [Math.max(p[0], q[0]), Math.max(p[1], q[1]), zb], group, fill); };
          const sign = (food ? FOOD : SIGNS)[Math.floor(R() * (food ? FOOD : SIGNS).length)], display = food ? '#f0d8b0' : '#e8e4da';
          const D = SHOP.depth, zk = z0 + SHOP.kick, zg = z0 + SHOP.glass, zb = z0 + SHOP.bulkhead;
          // its display, lit, against the wall: its back and its shelves (a darker band each, a hand proud)
          quad(faces, [pt(u0, zk), pt(u1, zk), pt(u1, zg), pt(u0, zg)], n, 'geocity:shop-display', shade(display, 0.92));
          for (const zz of [0.95, 1.55, 2.15]) quad(faces, [pt(u0 + 0.1, z0 + zz, 0.03), pt(u1 - 0.1, z0 + zz, 0.03), pt(u1 - 0.1, z0 + zz + 0.05, 0.03), pt(u0 + 0.1, z0 + zz + 0.05, 0.03)], n, 'geocity:shop-display', shade(display, 0.5));
          // the display glass, translucent (the page's glass pass), its depth out from the wall
          faces.push({ ...(() => { const t = []; quad(t, [pt(u0, zk, D), pt(u1, zk, D), pt(u1, zg, D), pt(u0, zg, D)], n, 'geocity:shop-glass', GLASS); return t[0]; })(), water: true });
          // its frame in steel: the kick plinth (wall to glass), the head rail, the mullions, the end jambs; the sign
          // bulkhead over it, deeper; dark steel returns either end, wall to glass
          slab(u0, u1, 0, D + 0.06, z0, zk, 'geocity:shopfront', DARK);
          slab(u0, u1, D - 0.06, D + 0.06, zg - 0.1, zg, 'geocity:shopfront', STEEL);
          const nm = Math.max(1, Math.round(bay / SHOP.mullion));
          for (let j = 0; j <= nm; j++) { const um = u0 + (bay * j) / nm, h = j === 0 || j === nm ? 0.07 : 0.045; slab(Math.max(u0, um - h), Math.min(u1, um + h), D - 0.05, D + 0.05, zk, zg - 0.1, 'geocity:shopfront', j === 0 || j === nm ? STEEL : MULLION); }
          slab(u0, u1, 0, D + 0.18, zg, zb, 'geocity:shop-sign', shade(sign, 1.05));
          for (const ue of [u0, u1]) { const nr = [0, 0, 0]; nr[ax] = ue === u0 ? 1 : -1; quad(faces, [pt(ue, zk, 0), pt(ue, zk, D), pt(ue, zg, D), pt(ue, zg, 0)], nr, 'geocity:shopfront', shade(DARK, 1.3)); }
          // (held: a body is kept off its glass)
          { const p = pt(u0, z0, 0), q = pt(u1, z0, D + 0.18); colliders.push({ min: P3([Math.min(p[0], q[0]), Math.min(p[1], q[1]), z0]), max: P3([Math.max(p[0], q[0]), Math.max(p[1], q[1]), zb]), of: `${P.block}:shop` }); }
          count++;
        }
      }
    }
    shops[P.block] = count;
    // ── its walls clad between the shopfronts, as a mall's are: pale stone panels to the bulkheads' height ──
    clad(faces, cb, z0, z0 + SHOP.bulkhead, (side, ax) => [...taken[side], ...openingsOn(I, side, cb, ax)]);
    // (and the lobby's, round its street door and its stair's well)
    { const lb = I.rooms.find((r) => r.id === 'lobby').box; clad(faces, lb, lb.min[2], lb.min[2] + Math.min(3.4, lb.max[2] - lb.min[2] - 0.5), (side, ax) => openingsOn(I, side, lb, ax)); }
    // ── the laylight: a lit glass strip down the concourse's long middle in a steel frame, the mall's skylight under the
    // street, clear of the stair's well ──
    const la = cb.max[0] - cb.min[0] >= cb.max[1] - cb.min[1] ? 0 : 1, sa = 1 - la, half = Math.min(1.5, 0.15 * (cb.max[sa] - cb.min[sa])), mid = (cb.min[sa] + cb.max[sa]) / 2;
    const F = I.flight, crosses = F[sa] < mid + half + 0.6 && F[sa + 2] > mid - half - 0.6, zl = z0 + LAYLIGHT.under;
    const runs = crosses ? [[cb.min[la] + 1.2, F[la] - 0.6], [F[la + 2] + 0.6, cb.max[la] - 1.2]] : [[cb.min[la] + 1.2, cb.max[la] - 1.2]];
    const lp = (a, b, z) => { const p = [0, 0, z]; p[la] = a; p[sa] = b; return p; };
    const lbox = (a0, a1, b0, b1, za, zb, fill) => { const p = lp(a0, b0, za), q = lp(a1, b1, zb); box(faces, [Math.min(p[0], q[0]), Math.min(p[1], q[1]), za], [Math.max(p[0], q[0]), Math.max(p[1], q[1]), zb], 'geocity:laylight-frame', fill); };
    for (const [a, b] of runs) {
      if (b - a < 2) continue;
      quad(faces, [lp(a, mid - half, zl), lp(b, mid - half, zl), lp(b, mid + half, zl), lp(a, mid + half, zl)], [0, 0, -1], 'geocity:laylight', LAYLIGHT.glow);
      for (const e of [mid - half, mid + half]) lbox(a, b, e - 0.1, e + 0.1, zl - 0.05, zl + 0.2, LAYLIGHT.frame);
      const nr = Math.max(1, Math.round((b - a) / LAYLIGHT.rib));
      for (let j = 0; j <= nr; j++) { const at = a + ((b - a) * j) / nr; lbox(at - 0.06, at + 0.06, mid - half, mid + half, zl - 0.04, zl + 0.2, LAYLIGHT.frame); }
    }
    // ── the lobby's stair well behind glass: a pane down each rail and a steel cap on it ──
    for (const c of I.colliders.filter((x) => /:rail:lobby$/.test(x.of))) {
      const ra = c.max[0] - c.min[0] >= c.max[1] - c.min[1] ? 0 : 1, rs = 1 - ra, at = (c.min[rs] + c.max[rs]) / 2, za = c.min[2], zt = za + 1.05;
      const rp = (a, z) => { const p = [0, 0, z]; p[ra] = a; p[rs] = at; return p; }, nn = [0, 0, 0];
      nn[rs] = 1;
      const pane = []; quad(pane, [rp(c.min[ra], za + 0.05), rp(c.max[ra], za + 0.05), rp(c.max[ra], zt), rp(c.min[ra], zt)], nn, 'geocity:balustrade', GLASS);
      faces.push({ ...pane[0], water: true, doubleSided: true });
      const p = rp(c.min[ra], zt), q = rp(c.max[ra], zt + 0.05), lo = [Math.min(p[0], q[0]), Math.min(p[1], q[1])], hi = [Math.max(p[0], q[0]), Math.max(p[1], q[1])];
      lo[rs] -= 0.03; hi[rs] += 0.03;
      box(faces, [lo[0], lo[1], zt], [hi[0], hi[1], zt + 0.05], 'geocity:balustrade', STEEL);
    }
    // ── over its street door, outside: a glass canopy on a steel frame, tied back to the facade ──
    {
      const Dr = I.door, ax2 = Dr.axis === 'x' ? 0 : 1, o2 = 1 - ax2, Nn = Dr.N, zc = Dr.z0 + CANOPY.height, mu = (Dr.u0 + Dr.u1) / 2, hw = CANOPY.width / 2;
      const cp = (u, d, z) => { const p = [0, 0, z]; p[ax2] = u; p[o2] = Dr.plane + Nn[o2] * d; return p; };
      const pane = []; quad(pane, [cp(mu - hw, 0, zc), cp(mu + hw, 0, zc), cp(mu + hw, CANOPY.reach, zc - 0.12), cp(mu - hw, CANOPY.reach, zc - 0.12)], [0, 0, 1], 'geocity:canopy', 'rgba(210,228,236,0.3)');
      street.push({ ...pane[0], water: true, doubleSided: true });
      const cb2 = (u0, u1, d0, d1, za, zb) => { const p = cp(u0, d0, za), q = cp(u1, d1, zb); box(street, [Math.min(p[0], q[0]), Math.min(p[1], q[1]), za], [Math.max(p[0], q[0]), Math.max(p[1], q[1]), zb], 'geocity:canopy', STEEL); };
      cb2(mu - hw, mu + hw, CANOPY.reach - 0.08, CANOPY.reach + 0.04, zc - 0.22, zc - 0.08);
      for (const e of [mu - hw, mu, mu + hw]) cb2(e - 0.05, e + 0.05, 0, CANOPY.reach, zc - 0.16, zc - 0.02);
      for (const e of [mu - hw + 0.3, mu + hw - 0.3]) for (let t = 0; t < 6; t++) {
        // (a tie rod from the canopy's outer edge up to the facade, in short steps)
        const d0 = CANOPY.reach * (1 - t / 6), d1 = CANOPY.reach * (1 - (t + 1) / 6), za = zc + (1.2 * t) / 6, zb = zc + (1.2 * (t + 1)) / 6;
        cb2(e - 0.025, e + 0.025, Math.min(d0, d1), Math.max(d0, d1), za, zb);
      }
    }
  }
  // ── the food court in the hub: its seating sets by its dice (round cafe tables and their chairs, high bistro tables
  // and their stools, long communal tables and their benches, booths), each on a cell clear of the stair and a body's
  // width and more of every walk through it ──
  let court = null;
  const fitted = {};
  if (hub && hub.I.ports.length) {
    const I = hub.I, cb = I.rooms.find((r) => r.id === 'concourse').box, z0 = cb.min[2], R = streamOf(seed, 'under-court', hub.block);
    const walks = walksOf(I), la = cb.max[0] - cb.min[0] >= cb.max[1] - cb.min[1] ? 0 : 1;
    const F = I.flight, x0 = cb.min[0] + COURT.margin, y0 = cb.min[1] + COURT.margin, x1 = cb.max[0] - COURT.margin, y1 = cb.max[1] - COURT.margin;
    const nx = Math.floor((x1 - x0) / COURT.step), ny = Math.floor((y1 - y0) / COURT.step), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const look = { seat: COURT.seats[Math.floor(R() * COURT.seats.length)], wood: COURT.woods[Math.floor(R() * COURT.woods.length)] };
    const sets = [];
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) {
      if (sets.length >= COURT.most) break;
      const p = [cx + (i - nx / 2) * COURT.step, cy + (j - ny / 2) * COURT.step], type = COURT.mix[Math.floor(R() * COURT.mix.length)];
      // (a long set runs down the concourse's long way)
      const turn = (type === 'communal' || type === 'booth') && la === 1 ? 1 : 0, [hx, hy] = turn ? [SETS[type].half[1], SETS[type].half[0]] : SETS[type].half;
      const rect = [p[0] - hx, p[1] - hy, p[0] + hx, p[1] + hy];
      if (!(rect[2] < F[0] - 1 || rect[0] > F[2] + 1 || rect[3] < F[1] - 1 || rect[1] > F[3] + 1)) continue;
      if (walks.some((l) => toRect(l, rect) < COURT.clear)) continue;
      sets.push(type);
      faces.push(...setFaces(type, [p[0], p[1], z0], turn, look));
      colliders.push({ min: P3([rect[0], rect[1], z0]), max: P3([rect[2], rect[3], z0 + (type === 'booth' ? 1.26 : type === 'bistro' ? 1.09 : 0.8)]), of: `${hub.block}:court` });
    }
    court = { podium: hub.block, tables: sets.length, sets: Object.fromEntries(Object.keys(SETS).map((k) => [k, sets.filter((t) => t === k).length]).filter(([, n]) => n)) };
  }
  // ── each concourse's fittings: a waste and a recycling bin beside each way out and at the food court's corners, a
  // directory by the stair's foot, benches down its long middle between planters; each where it stands clear of the
  // walks, the shopfronts, the court and the stair ──
  for (const P of podia) {
    const I = P.I, cb = I.rooms.find((r) => r.id === 'concourse').box, z0 = cb.min[2], walks = walksOf(I), F = I.flight;
    const mine = colliders.filter((c) => c.of.startsWith(`${P.block}:`)).map((c) => [c.min[0], c.min[1], c.max[0], c.max[1]]);
    const taken = [...mine, [F[0] - 0.6, F[1] - 0.6, F[2] + 0.6, F[3] + 0.6]], room = [cb.min[0] + 0.3, cb.min[1] + 0.3, cb.max[0] - 0.3, cb.max[1] - 0.3];
    // (in front of each way out, the zone a walker comes through it in)
    for (const q of I.ports) { const ax = q.side.endsWith('y') ? 0 : 1, inner = q.plane - q.N[1 - ax] * 0.5, d = -q.N[1 - ax], lo = [0, 0], hi = [0, 0]; lo[ax] = q.lo - 0.1; hi[ax] = q.hi + 0.1; lo[1 - ax] = Math.min(inner, inner + d * 3); hi[1 - ax] = Math.max(inner, inner + d * 3); taken.push([lo[0], lo[1], hi[0], hi[1]]); }
    const count = {};
    const fit = (kind, at, turn, h, extra = {}) => {
      const [hx, hy] = turn % 2 ? [FITTINGS[kind].half[1], FITTINGS[kind].half[0]] : FITTINGS[kind].half, rect = [at[0] - hx, at[1] - hy, at[0] + hx, at[1] + hy];
      if (rect[0] < room[0] || rect[1] < room[1] || rect[2] > room[2] || rect[3] > room[3]) return false;
      if (taken.some((t) => rect[0] < t[2] + 0.3 && rect[2] > t[0] - 0.3 && rect[1] < t[3] + 0.3 && rect[3] > t[1] - 0.3)) return false;
      if (walks.some((l) => toRect(l, rect) < 0.5)) return false;
      faces.push(...fitFaces(kind, [at[0], at[1], z0], turn, extra));
      colliders.push({ min: P3([rect[0], rect[1], z0]), max: P3([rect[2], rect[3], z0 + h]), of: `${P.block}:${kind}` });
      taken.push(rect);
      count[kind] = (count[kind] ?? 0) + 1;
      return true;
    };
    // bins beside each way out, end on to its wall, either side of the zone a walker comes through
    for (const q of I.ports) {
      const ax = q.side.endsWith('y') ? 0 : 1, d = -q.N[1 - ax], inner = q.plane - q.N[1 - ax] * 0.5, turn = ax === 0 ? (d > 0 ? 1 : 3) : (d > 0 ? 0 : 2);
      for (const u of [q.lo - 0.8, q.hi + 0.8]) { const at = [0, 0]; at[ax] = u; at[1 - ax] = inner + d * 0.95; if (fit('bins', at, turn, 0.97)) break; }
    }
    // a directory by the stair's foot, turned to the room
    {
      const foot = [(F[0] + F[2]) / 2, (F[1] + F[3]) / 2], mid = [(cb.min[0] + cb.max[0]) / 2, (cb.min[1] + cb.max[1]) / 2], toward = [mid[0] - foot[0], mid[1] - foot[1]];
      const turn = Math.abs(toward[0]) > Math.abs(toward[1]) ? (toward[0] > 0 ? 1 : 3) : (toward[1] > 0 ? 2 : 0), off = Math.hypot(...toward) || 1;
      const band = ROUTES[I.ports[0] ? (routeOf.get(I.ports[0].id) ?? 'ns') : 'ns'];
      for (const k of [2.2, 3, 4]) if (fit('directory', [foot[0] + (toward[0] / off) * k, foot[1] + (toward[1] / off) * k], turn, 2.1, { band })) break;
    }
    // benches down the long middle, a planter at either end of each where it fits
    {
      const la = cb.max[0] - cb.min[0] >= cb.max[1] - cb.min[1] ? 0 : 1, sa = 1 - la, mid = (cb.min[sa] + cb.max[sa]) / 2, turn = la === 0 ? 0 : 1;
      for (let a = cb.min[la] + 3; a <= cb.max[la] - 3; a += 1) {
        for (const off of [0, -2.2, 2.2]) {
          const at = [0, 0]; at[la] = a; at[sa] = mid + off;
          if (!fit('bench', at, turn, 0.47, { wood: COURT.woods[0] })) continue;
          for (const e of [-2.05, 2.05]) { const pp = [...at]; pp[la] += e; fit('planter', pp, 0, 1.1); }
          a += 4;
          break;
        }
      }
    }
    // (and at the food court's corners, a pair of bins)
    if (court && P === hub) {
      const C = colliders.filter((c) => c.of === `${P.block}:court`);
      if (C.length) {
        const bx = [Math.min(...C.map((c) => c.min[0])), Math.min(...C.map((c) => c.min[1])), Math.max(...C.map((c) => c.max[0])), Math.max(...C.map((c) => c.max[1]))];
        for (const [x, y] of [[bx[0] - 0.9, bx[1] - 0.6], [bx[2] + 0.9, bx[3] + 0.6], [bx[0] - 0.9, bx[3] + 0.6], [bx[2] + 0.9, bx[1] - 0.6]]) fit('bins', [x, y], 0, 0.97);
      }
    }
    fitted[P.block] = count;
  }
  return { faces, street, colliders, readout: { routes: { ...ROUTES }, shops, fittings: fitted, ...(court ? { court } : {}) } };
}
