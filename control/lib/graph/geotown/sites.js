/**
 * THE SITES — a block given to one program rather than to rows of plots: a SCHOOL (its building on its own lot facing
 * its front street, a schoolyard behind it, a staff lot beside it, its playing field and track behind), a SPORTS field
 * (a ball diamond, a pitch, tennis courts, a field house and a lot, bleachers and lights), a PARK (its paths, a
 * playground, a pavilion, benches). A site is laid in its block's frame (u along its front street, v into the block,
 * metres), PROPORTIONED to the block it is given (an evocation's cell, or the town to scale's), so what an evocation
 * shows keeps the site to scale's shares (laws.js `sites`). Its parts tile the block exactly: every square metre is one
 * surface (a part drawn with a curve, a track or a diamond's dirt, carries its own `area`, and the part it lies in
 * gives that much up), so the ledger closes.
 *
 *   SITE_TYPES               the programs: school, sports, park
 *   sitePlan(type, S, { L, D, R }) → { parts: [{ cls, rect, area?, inside?, what? }], plot?, what: { … } }
 *       `S` the pattern's `sites[type]`; `rect`s in the block's frame [u0, v0, u1, v1]; `plot` a school's lot (its
 *       frontage, depth, setback, building and side yards: design.js makes it a plot like a row's); `what` where each
 *       drawn thing stands (the pitch, the track, the diamond, the courts, the lot, the field house, the playground…)
 *   siteShares(plan, L, D) → { <cls>: share of the site }
 *   stadium(w, h) → the area of a stadium (a rect w × h, its short ends half discs)
 *
 *   the drawn things, each → [{ corners, out, role, hex? }] in the block's frame, z up from the site's level:
 *   pitchOf(rect, R), trackOf(rect, band), diamondOf(rect, R), courtsOf(rect, n), hoopsOf(rect), lotOf(rect, R),
 *   fieldhouseOf(rect), bleachersOf(u0, u1, v, toward), lightsOf(rect), flagOf(u, v), playgroundOf(rect, R),
 *   pavilionOf(rect), benchOf(u, v, along, facing), picnicOf(u, v)
 *
 * `role`: turf, stripe, line, track, dirt, base, court, net, netting, fence, goal, board, metal, timber, roof, block,
 * door, chips, deck, canopy, slide, paving, lamp, flag, seat, glass. Pure: the dice are the caller's.
 */
import { box } from './fronts.js';
import { serviceOf } from './yards.js';

export const SITE_TYPES = Object.freeze(['school', 'sports', 'park']);

const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;
const P = (x, y, z) => [r4(x), r4(y), r4(z)];
const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const roll = (R, lo, hi) => lo + (hi - lo) * R();
const rect = (u0, v0, u1, v1) => [r3(u0), r3(v0), r3(u1), r3(v1)];
const areaOf = (r) => (r[2] - r[0]) * (r[3] - r[1]);
/** A stadium's area: a rect w × h whose short ends are half discs. */
export const stadium = (w, h) => { const s = Math.min(w, h), l = Math.max(w, h); return (l - s) * s + Math.PI * (s / 2) ** 2; };
/** A rect less a margin all round: the ring as four rects (`cls`), and the inside. */
function ring(r, m, cls) {
  const [u0, v0, u1, v1] = r, i = rect(u0 + m, v0 + m, u1 - m, v1 - m);
  return { parts: [[u0, v0, u1, i[1]], [u0, i[3], u1, v1], [u0, i[1], i[0], i[3]], [i[2], i[1], u1, i[3]]].map((q) => ({ cls, rect: rect(...q) })), inner: i };
}

/** A site's plan in its block's frame: its parts, its school's lot, where its drawn things stand. */
export function sitePlan(type, S, { L, D, R }) {
  const parts = [], what = {};
  if (type === 'school') {
    // the school's lot on its front street, a staff lot beside it, lawn beyond; its field behind, round a track
    const Dp = r3(Math.min(cl(S.lot.deep * D, 30, 48), D * 0.6)), Lp = r3(Math.min(cl(S.lot.long * L, 40, 90), L * 0.62)), lw = r3(Math.min(cl(S.parking * L, 16, 32), L - Lp)), ld = r3(Math.min(Dp, 30));
    const F = r3(cl(S.setback * Dp, 5, 9)), Hd = r3(cl(S.building.deep * Dp, 13, 18)), side = r3(cl(S.building.side * Lp, 4, 12)), pw = 2.4;
    const plot = { w: Lp, d: Dp, setback: F, depth: Hd, sides: [side, side], path: pw };
    what.lot = rect(Lp, 0, Lp + lw, ld);
    if (lw > 0) parts.push({ cls: 'service', rect: what.lot });
    if (ld < Dp && lw > 0) parts.push({ cls: 'grounds', rect: rect(Lp, ld, Lp + lw, Dp) });
    if (Lp + lw < L) parts.push({ cls: 'grounds', rect: rect(Lp + lw, 0, L, Dp) });
    what.flag = [r3(Lp / 2 + Math.min(6, (Lp - 2 * side) / 3)), r3(F * 0.45)];
    what.yard = rect(0, F + Hd, Lp, Dp);
    // the field: a margin of lawn, a track round it where the field holds one, the turf inside it
    const fr = ring(rect(0, Dp, L, D), S.margin, 'grounds');
    parts.push(...fr.parts);
    const [a0, b0, a1, b1] = fr.inner, w = a1 - a0, h = b1 - b0, T = S.track;
    if (w >= T.least[0] && h >= T.least[1]) {
      const band = T.band, inner = rect(a0 + band, b0 + band, a1 - band, b1 - band), out = stadium(w, h), inn = stadium(w - 2 * band, h - 2 * band);
      parts.push({ cls: 'track', rect: fr.inner, area: r3(out - inn), what: 'track' });
      parts.push({ cls: 'field', rect: inner, area: r3(inn), what: 'field' });
      parts.push({ cls: 'grounds', rect: fr.inner, area: r3(w * h - out), what: 'corners' });
      what.track = fr.inner; what.pitch = rect(inner[0] + h * 0.18, inner[1] + 2, inner[2] - h * 0.18, inner[3] - 2);
    } else { parts.push({ cls: 'field', rect: fr.inner }); what.pitch = rect(a0 + 3, b0 + 3, a1 - 3, b1 - 3); }
    return { parts, plot, what };
  }
  if (type === 'sports') {
    // a strip along its front street: a lot, lawn and the field house; behind it a diamond, a pitch, and courts
    const Sd = r3(cl(S.front * D, 10, 16)), lw = r3(cl(S.parking * L, 18, 30)), H = D - Sd;
    what.lot = rect(0, 0, lw, Sd);
    parts.push({ cls: 'service', rect: what.lot }, { cls: 'grounds', rect: rect(lw, 0, L, Sd) });
    const fh = rect(lw + 6, Sd - 10, lw + 6 + S.house.w, Sd - 10 + S.house.d);
    if (fh[2] < L - 2 && fh[1] > 0.5) { what.fieldhouse = fh; parts.push({ cls: 'house', rect: fh, inside: 'grounds', kind: 'fieldhouse' }); }
    const cw = L >= S.courts.from ? S.courts.w : 0, n = cw ? Math.min(S.courts.most, Math.floor(H / S.courts.d)) : 0, dw = r3(Math.min(H, 0.5 * (L - cw)));
    // the diamond's square, its lawn round it, its turf, its dirt (drawn round, its own area) on the turf
    const dr = ring(rect(0, Sd, dw, D), S.margin, 'grounds');
    parts.push(...dr.parts, { cls: 'field', rect: dr.inner });
    what.diamond = dr.inner;
    const dirt = diamondDirt(dr.inner);
    if (dirt) parts.push({ cls: 'infield', rect: dr.inner, area: r3(dirt), inside: 'field' });
    // the pitch between them
    const pr = ring(rect(dw, Sd, L - cw, D), S.margin, 'grounds');
    parts.push(...pr.parts, { cls: 'field', rect: pr.inner });
    what.pitch = rect(pr.inner[0] + 2, pr.inner[1] + 2, pr.inner[2] - 2, pr.inner[3] - 2);
    // the courts at the far end, end to end along v, lawn past them
    if (cw) {
      const c = rect(L - cw, Sd, L, Sd + n * S.courts.d);
      if (n) { parts.push({ cls: 'court', rect: c }); what.courts = { rect: c, n }; }
      if (c[3] < D) parts.push({ cls: 'grounds', rect: rect(L - cw, n ? c[3] : Sd, L, D) });
    }
    return { parts, what };
  }
  // a park: two paths across it, the lawn between them; a playground in one quarter, a pavilion in another
  const pw = S.path, uc = L / 2, vc = D / 2;
  const paths = [rect(0, vc - pw / 2, L, vc + pw / 2), rect(uc - pw / 2, 0, uc + pw / 2, vc - pw / 2), rect(uc - pw / 2, vc + pw / 2, uc + pw / 2, D)];
  for (const p of paths) parts.push({ cls: 'park-path', rect: p });
  const quarters = [rect(0, 0, uc - pw / 2, vc - pw / 2), rect(uc + pw / 2, 0, L, vc - pw / 2), rect(0, vc + pw / 2, uc - pw / 2, D), rect(uc + pw / 2, vc + pw / 2, L, D)];
  for (const q of quarters) parts.push({ cls: 'park', rect: q });
  const [pq, vq] = R() < 0.5 ? [0, 3] : [1, 2], Q = quarters[pq], V = quarters[vq], g = S.playground;
  if (Q[2] - Q[0] > g.w + 8 && Q[3] - Q[1] > g.d + 8) {
    const u0 = pq % 2 ? Q[0] + 4 : Q[2] - 4 - g.w, v0 = pq < 2 ? Q[3] - 4 - g.d : Q[1] + 4;
    what.playground = rect(u0, v0, u0 + g.w, v0 + g.d);
    parts.push({ cls: 'play', rect: what.playground, inside: 'park' });
  }
  const pv = S.pavilion;
  if (V[2] - V[0] > pv.w + 10 && V[3] - V[1] > pv.d + 10) {
    const u0 = vq % 2 ? V[0] + 5 : V[2] - 5 - pv.w, v0 = vq < 2 ? V[3] - 5 - pv.d : V[1] + 5;
    what.pavilion = rect(u0, v0, u0 + pv.w, v0 + pv.d);
    parts.push({ cls: 'house', rect: what.pavilion, inside: 'park', kind: 'pavilion' });
  }
  what.paths = paths;
  return { parts, what };
}

/** Each surface's share of a site, its school's lot by its own allocation (`lot`: { cls: m² }). */
export function siteShares(plan, L, D, lot = {}) {
  const out = {}, add = (k, a) => { out[k] = (out[k] ?? 0) + a; };
  for (const p of plan.parts) { const a = p.area ?? areaOf(p.rect); add(p.cls, a); if (p.inside) add(p.inside, -a); }
  for (const [k, a] of Object.entries(lot)) add(k, a);
  const all = L * D || 1;
  return Object.fromEntries(Object.entries(out).map(([k, a]) => [k, a / all]));
}

// ── the drawn things ─────────────────────────────────────────────────────────────────────────────────────────────────
const flat = (u0, v0, u1, v1, z, role, extra = {}) => ({ corners: [P(u0, v0, z), P(u1, v0, z), P(u1, v1, z), P(u0, v1, z)], out: [0, 0, 1], role, ...extra });
/** A painted line from a to b, `t` wide, at z. */
function line([ua, va], [ub, vb], z, t = 0.1, role = 'line') {
  const l = Math.hypot(ub - ua, vb - va) || 1, nu = (-(vb - va) / l) * (t / 2), nv = ((ub - ua) / l) * (t / 2);
  return { corners: [P(ua + nu, va + nv, z), P(ub + nu, vb + nv, z), P(ub - nu, vb - nv, z), P(ua - nu, va - nv, z)], out: [0, 0, 1], role };
}
const loop = (pts, z, t, role) => pts.map((p, k) => line(p, pts[(k + 1) % pts.length], z, t, role));
const circle = (cu, cv, r, n, a0 = 0, a1 = 2 * Math.PI) => Array.from({ length: n + 1 }, (_, k) => { const t = a0 + ((a1 - a0) * k) / n; return [cu + r * Math.cos(t), cv + r * Math.sin(t)]; });
const post = (u, v, z0, z1, s = 0.06, role = 'metal') => box(u - s, v - s, u + s, v + s, z0, z1, role).slice(1);

/** A pitch on its turf: stripes mown along it, its lines, its centre circle, its boxes, a goal at each end. */
export function pitchOf([u0, v0, u1, v1], R) {
  const out = [], along = u1 - u0 >= v1 - v0, Lg = along ? u1 - u0 : v1 - v0, Wd = along ? v1 - v0 : u1 - u0;
  // (the pitch in its frame: x along it, y across; mapped back to u, v)
  const M = (x, y) => (along ? [u0 + x, v0 + y] : [u0 + y, v0 + x]);
  const n = Math.max(4, Math.round(Lg / 7)), z = 0.02;
  for (let k = 0; k < n; k++) if (k % 2) { const [a, b] = [M((Lg * k) / n, 0), M((Lg * (k + 1)) / n, Wd)]; out.push(flat(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), z, 'stripe')); }
  const zl = 0.035;
  out.push(...loop([M(0, 0), M(Lg, 0), M(Lg, Wd), M(0, Wd)], zl, 0.12), line(M(Lg / 2, 0), M(Lg / 2, Wd), zl, 0.12));
  const cr = Math.min(9.15, Wd / 5), c = circle(0, 0, cr, 16).map(([x, y]) => M(Lg / 2 + x, Wd / 2 + y));
  for (let k = 0; k + 1 < c.length; k++) out.push(line(c[k], c[k + 1], zl, 0.12));
  const bx = Math.min(16.5, Lg / 6), by = Math.min(40.3, Wd * 0.6), gw = Math.min(7.32, Wd / 6);
  for (const end of [0, 1]) {
    const x0 = end ? Lg : 0, s = end ? -1 : 1;
    out.push(line(M(x0, (Wd - by) / 2), M(x0 + s * bx, (Wd - by) / 2), zl, 0.12), line(M(x0 + s * bx, (Wd - by) / 2), M(x0 + s * bx, (Wd + by) / 2), zl, 0.12), line(M(x0 + s * bx, (Wd + by) / 2), M(x0, (Wd + by) / 2), zl, 0.12));
    // the goal: two posts and a bar, white
    for (const y of [(Wd - gw) / 2, (Wd + gw) / 2]) { const [u, v] = M(x0, y); out.push(...post(u, v, 0, 2.44, 0.06, 'goal')); }
    const [a, b] = [M(x0, (Wd - gw) / 2), M(x0, (Wd + gw) / 2)];
    out.push(...box(Math.min(a[0], b[0]) - 0.06, Math.min(a[1], b[1]) - 0.06, Math.max(a[0], b[0]) + 0.06, Math.max(a[1], b[1]) + 0.06, 2.38, 2.5, 'goal'));
  }
  return out;
}

/** A track round its rect: a stadium ring `band` wide, its lanes' lines, the turf inside it its own (the pitch). */
export function trackOf([u0, v0, u1, v1], band) {
  const out = [], along = u1 - u0 >= v1 - v0, cu = (u0 + u1) / 2, cv = (v0 + v1) / 2, Lg = Math.max(u1 - u0, v1 - v0), Wd = Math.min(u1 - u0, v1 - v0);
  // a stadium's outline at an inset: straights along the long axis, half circles at its ends
  const shape = (inset) => {
    const r = Wd / 2 - inset, s = (Lg - Wd) / 2, pts = [];
    for (const [cx, a0] of [[s, -Math.PI / 2], [-s, Math.PI / 2]]) for (const [x, y] of circle(cx, 0, r, 10, a0, a0 + Math.PI)) pts.push(along ? [cu + x, cv + y] : [cu + y, cv + x]);
    return pts;
  };
  const o = shape(0), i = shape(band), z = 0.025;
  for (let k = 0; k < o.length; k++) { const k1 = (k + 1) % o.length; out.push({ corners: [P(...o[k], z), P(...o[k1], z), P(...i[k1], z), P(...i[k], z)], out: [0, 0, 1], role: 'track' }); }
  for (const f of [0.25, 0.5, 0.75]) { const l = shape(band * f); out.push(...loop(l, 0.035, 0.06)); }
  // the infield's turf, the stadium inside the track
  const t = shape(band);
  for (let k = 1; k + 1 < t.length; k++) out.push({ corners: [P(...t[0], 0.015), P(...t[k], 0.015), P(...t[k + 1], 0.015)], out: [0, 0, 1], role: 'turf' });
  return out;
}

// a local field's diamond (softball's, a little league's): home at its near corner, bases 18.29 m apart, the mound, its
// dirt's arc round it, its fence's farthest reach
const BASE = 18.29, MOUND = 14.02, ARC = 15.24, REACH = 64;
const polyArea = (p) => Math.abs(p.reduce((a, q, k) => { const n = p[(k + 1) % p.length]; return a + q[0] * n[1] - n[0] * q[1]; }, 0)) / 2;
/** A diamond's ground in its square: home, the dirt's fan (an arc round the mound from foul line to foul line), the
 *  grass inside the bases; null where the square is too small for one. */
function diamondGround([u0, v0, u1, v1]) {
  const s = Math.min(u1 - u0, v1 - v0);
  if (s < BASE + 12) return null;
  const h = [u0 + 4, v0 + 4], M = (x, y) => [h[0] + x, h[1] + y], d = Math.SQRT1_2, m = M(MOUND * d, MOUND * d);
  const arc = circle(m[0], m[1], ARC, 10, 0, Math.PI / 2).map(([u, v]) => [Math.max(h[0], u), Math.max(h[1], v)]);
  // (round from the first-base line to the third: the polygon's own order)
  const fan = [h, M(BASE + 3, 0), ...arc.filter((p) => p[1] > h[1] + 1 && p[0] > h[0] + 1), M(0, BASE + 3)], g = BASE - 3;
  return { s, h, M, m, fan, grass: [M(3, 3), M(3 + g, 3), M(3 + g, 3 + g), M(3, 3 + g)] };
}
/** The area of a diamond's dirt: its fan less the grass inside its bases. */
const diamondDirt = (r) => { const G = diamondGround(r); return G ? polyArea(G.fan) - polyArea(G.grass) : 0; };
/** A ball diamond in its square: home in its near corner facing out across it; its dirt, its grass infield, the mound,
 *  the bases, the foul lines, a backstop behind home, benches by the lines, an outfield fence round its reach. */
export function diamondOf([u0, v0, u1, v1], R) {
  const out = [], G = diamondGround([u0, v0, u1, v1]);
  if (!G) return out;
  // the dirt: its fan from foul line to foul line, the grass inside the bases over it
  const { s, h, M, m, fan } = G, z = 0.02;
  for (let k = 1; k + 1 < fan.length; k++) out.push({ corners: [P(...fan[0], z), P(...fan[k], z), P(...fan[k + 1], z)], out: [0, 0, 1], role: 'dirt' });
  out.push({ corners: G.grass.map((p) => P(...p, 0.03)), out: [0, 0, 1], role: 'turf' });
  const mo = circle(m[0], m[1], 2.7, 8);
  for (let k = 0; k + 1 < mo.length; k++) out.push({ corners: [P(...m, 0.18), P(...mo[k], 0.04), P(...mo[k + 1], 0.04)], out: [0, 0, 1], role: 'dirt' });
  for (const [x, y] of [[BASE, 0], [BASE, BASE], [0, BASE]]) { const [u, v] = M(x, y); out.push(...box(u - 0.2, v - 0.2, u + 0.2, v + 0.2, 0.02, 0.1, 'base')); }
  out.push(flat(h[0] - 0.22, h[1] - 0.22, h[0] + 0.22, h[1] + 0.22, 0.05, 'base'));
  const reach = Math.min(s - 6, REACH);
  out.push(line(h, M(reach, 0), 0.04, 0.1), line(h, M(0, reach), 0.04, 0.1));
  // the backstop behind home: its panels and posts; benches along each line
  for (const [a, b] of [[M(-3, 4), M(-3, -3)], [M(-3, -3), M(4, -3)]]) { out.push({ corners: [P(...a, 0), P(...b, 0), P(...b, 4), P(...a, 4)], out: [-1, -1, 0], role: 'netting' }); out.push(...post(...a, 0, 4.1), ...post(...b, 0, 4.1)); }
  for (const [x, y, along] of [[10, -2.5, 'u'], [-2.5, 10, 'v']]) { const [u, v] = M(x, y); out.push(...(along === 'u' ? box(u, v - 0.3, u + 5, v + 0.3, 0.42, 0.48, 'seat') : box(u - 0.3, v, u + 0.3, v + 5, 0.42, 0.48, 'seat'))); }
  // the outfield fence round its reach, from line to line
  const fence = circle(h[0], h[1], reach, 10, 0, Math.PI / 2);
  for (let k = 0; k + 1 < fence.length; k++) { const [a, b] = [fence[k], fence[k + 1]]; out.push({ corners: [P(...a, 0), P(...b, 0), P(...b, 1.8), P(...a, 1.8)], out: [a[0] + b[0] - 2 * h[0], a[1] + b[1] - 2 * h[1], 0], role: 'fence' }); }
  return out;
}

/** `n` tennis courts end to end along v in their strip: each its surface, its lines, its net and posts; a fence of posts
 *  and rails round them all. */
export function courtsOf([u0, v0, u1, v1], n) {
  const out = [], dv = (v1 - v0) / n, cu = (u0 + u1) / 2, Lc = 23.77, Wc = 10.97, ws = 8.23, sv = 6.4;
  for (let k = 0; k < n; k++) {
    const cv = v0 + dv * (k + 0.5), a = cu - Lc / 2, b = cu + Lc / 2, c = cv - Wc / 2, e = cv + Wc / 2;
    out.push(flat(a - 3, c - 2.5, b + 3, e + 2.5, 0.02, 'court'));
    out.push(...loop([[a, c], [b, c], [b, e], [a, e]], 0.03, 0.06));
    out.push(line([a, cv - ws / 2], [b, cv - ws / 2], 0.03, 0.05), line([a, cv + ws / 2], [b, cv + ws / 2], 0.03, 0.05));
    out.push(line([cu - sv, cv - ws / 2], [cu - sv, cv + ws / 2], 0.03, 0.05), line([cu + sv, cv - ws / 2], [cu + sv, cv + ws / 2], 0.03, 0.05), line([cu - sv, cv], [cu + sv, cv], 0.03, 0.05));
    out.push({ corners: [P(cu, c - 0.9, 0.02), P(cu, e + 0.9, 0.02), P(cu, e + 0.9, 0.95), P(cu, c - 0.9, 0.95)], out: [1, 0, 0], role: 'net' }, ...post(cu, c - 0.9, 0, 1.07, 0.05), ...post(cu, e + 0.9, 0, 1.07, 0.05));
  }
  // the fence: posts every 6 m round the strip, a rail at its top
  const per = [[u0 + 0.5, v0 + 0.5], [u1 - 0.5, v0 + 0.5], [u1 - 0.5, v1 - 0.5], [u0 + 0.5, v1 - 0.5]];
  for (let k = 0; k < 4; k++) {
    const [a, b] = [per[k], per[(k + 1) % 4]], m = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6));
    for (let i = 0; i < m; i++) { const t = i / m; out.push(...post(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0, 3, 0.04)); }
    out.push(...box(Math.min(a[0], b[0]) - 0.03, Math.min(a[1], b[1]) - 0.03, Math.max(a[0], b[0]) + 0.03, Math.max(a[1], b[1]) + 0.03, 2.94, 3, 'metal'));
  }
  return out;
}

/** A schoolyard's courts: a basketball court where the yard holds one (else a half court), its lines and hoops, and
 *  four-square boxes painted by it. */
export function hoopsOf([u0, v0, u1, v1]) {
  const out = [], w = u1 - u0, d = v1 - v0, along = w >= d, Lg = Math.min(28, (along ? w : d) - 3), Wd = Math.min(15, (along ? d : w) - 3);
  if (Lg < 12 || Wd < 8) return out;
  const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2, M = (x, y) => (along ? [cu + x, cv + y] : [cu + y, cv + x]), z = 0.03, half = Lg < 20;
  const x0 = half ? -Lg / 2 : -Lg / 2, x1 = Lg / 2;
  out.push(...loop([M(x0, -Wd / 2), M(x1, -Wd / 2), M(x1, Wd / 2), M(x0, Wd / 2)], z, 0.06));
  if (!half) { out.push(line(M(0, -Wd / 2), M(0, Wd / 2), z, 0.06)); const c = circle(0, 0, 1.8, 12).map(([x, y]) => M(x, y)); for (let k = 0; k + 1 < c.length; k++) out.push(line(c[k], c[k + 1], z, 0.06)); }
  for (const end of half ? [1] : [-1, 1]) {
    const xb = end * Lg / 2, xk = xb - end * 5.8;
    out.push(...loop([M(xb, -2.45), M(xk, -2.45), M(xk, 2.45), M(xb, 2.45)], z, 0.06));
    // the hoop: its post just off the line, the board over the key
    const [pu, pv] = M(xb + end * 0.6, 0), [bu, bv] = M(xb - end * 1.2, 0);
    out.push(...post(pu, pv, 0, 3.4, 0.07), ...(along ? box(Math.min(pu, bu), bv - 0.05, Math.max(pu, bu), bv + 0.05, 3.3, 3.4, 'metal') : box(bu - 0.05, Math.min(pv, bv), bu + 0.05, Math.max(pv, bv), 3.3, 3.4, 'metal')));
    out.push(along ? { corners: [P(bu, bv - 0.9, 2.9), P(bu, bv + 0.9, 2.9), P(bu, bv + 0.9, 3.95), P(bu, bv - 0.9, 3.95)], out: [-end, 0, 0], role: 'board' } : { corners: [P(bu - 0.9, bv, 2.9), P(bu + 0.9, bv, 2.9), P(bu + 0.9, bv, 3.95), P(bu - 0.9, bv, 3.95)], out: [0, -end, 0], role: 'board' });
  }
  return out;
}

/** A parking lot: its stalls painted, cars in some (yards.js, as a walk-up's lot). */
export function lotOf([u0, v0, u1, v1], R) {
  return serviceOf('apartments', { w: u1 - u0, v0: v0, v1: v1, R }).faces.map((f) => ({ ...f, corners: f.corners.map(([u, v, z]) => [r4(u + u0), v, z]) }));
}

/** A field house: its walls, a low hip roof over them, its doors and a light or two. */
export function fieldhouseOf([u0, v0, u1, v1]) {
  const out = box(u0, v0, u1, v1, 0, 3.4, 'block').slice(1), um = (u0 + u1) / 2, vm = (v0 + v1) / 2, o = 0.5, z = 3.4, zr = 4.6;
  const c = [[u0 - o, v0 - o], [u1 + o, v0 - o], [u1 + o, v1 + o], [u0 - o, v1 + o]], ridge = [[um - (u1 - u0) / 4, vm], [um + (u1 - u0) / 4, vm]];
  out.push({ corners: [P(...c[0], z), P(...c[1], z), P(...ridge[1], zr), P(...ridge[0], zr)], out: [0, -1, 1], role: 'roof' }, { corners: [P(...c[2], z), P(...c[3], z), P(...ridge[0], zr), P(...ridge[1], zr)], out: [0, 1, 1], role: 'roof' });
  out.push({ corners: [P(...c[3], z), P(...c[0], z), P(...ridge[0], zr)], out: [-1, 0, 1], role: 'roof' }, { corners: [P(...c[1], z), P(...c[2], z), P(...ridge[1], zr)], out: [1, 0, 1], role: 'roof' });
  for (const u of [u0 + 1.5, u1 - 2.6]) out.push({ corners: [P(u, v1 + 0.02, 0.02), P(u + 1.1, v1 + 0.02, 0.02), P(u + 1.1, v1 + 0.02, 2.2), P(u, v1 + 0.02, 2.2)], out: [0, 1, 0], role: 'door' });
  out.push({ corners: [P(um - 1.5, v1 + 0.02, 1.2), P(um + 1.5, v1 + 0.02, 1.2), P(um + 1.5, v1 + 0.02, 2.3), P(um - 1.5, v1 + 0.02, 2.3)], out: [0, 1, 0], role: 'glass' });
  return out;
}

/** Bleachers from u0 to u1 along a line at v, rising away from it (`toward` the side the pitch is on: ±1). */
export function bleachersOf(u0, u1, v, toward) {
  const out = [];
  for (let k = 0; k < 4; k++) { const a = v - toward * k * 0.7, b = a - toward * 0.7; out.push(...box(u0, Math.min(a, b), u1, Math.max(a, b), 0, 0.45 * (k + 1), 'seat').slice(0, k === 3 ? 5 : 2)); }
  return out;
}

/** Lights at a pitch's four corners, off it: a mast and its lamp head. */
export function lightsOf([u0, v0, u1, v1]) {
  const out = [];
  for (const [u, v] of [[u0 - 2, v0 - 2], [u1 + 2, v0 - 2], [u1 + 2, v1 + 2], [u0 - 2, v1 + 2]]) out.push(...post(u, v, 0, 14, 0.12), ...box(u - 0.7, v - 0.3, u + 0.7, v + 0.3, 14, 14.8, 'lamp'));
  return out;
}

/** A flagpole and its flag. */
export function flagOf(u, v) {
  return [...post(u, v, 0, 9, 0.05), { corners: [P(u, v, 7.6), P(u + 1.6, v, 7.7), P(u + 1.6, v, 8.7), P(u, v, 8.9)], out: [0, -1, 0], role: 'flag' }];
}

/** A playground on its chips: a climbing tower (posts, a deck, a roof) and its slide, a swing set, a spring rider. */
export function playgroundOf([u0, v0, u1, v1], R) {
  const out = [flat(u0, v0, u1, v1, 0.03, 'chips')], w = u1 - u0, d = v1 - v0, tu = u0 + w * 0.3, tv = v0 + d * 0.45, s = 1.4, zd = 1.5;
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) out.push(...post(tu + a * s, tv + b * s, 0, 3.2, 0.07, 'timber'));
  out.push(...box(tu - s, tv - s, tu + s, tv + s, zd - 0.12, zd, 'deck'));
  const pk = [tu, tv, 4.2], c = [[tu - s - 0.2, tv - s - 0.2], [tu + s + 0.2, tv - s - 0.2], [tu + s + 0.2, tv + s + 0.2], [tu - s - 0.2, tv + s + 0.2]];
  const hue = ['#d8452f', '#2f7fd8', '#f2b632', '#3aa35a'][Math.floor(R() * 4)];
  for (let k = 0; k < 4; k++) out.push({ corners: [P(...c[k], 3.2), P(...c[(k + 1) % 4], 3.2), P(...pk)], out: [Math.sign(c[k][0] + c[(k + 1) % 4][0] - 2 * tu), Math.sign(c[k][1] + c[(k + 1) % 4][1] - 2 * tv), 1], role: 'canopy', hex: hue });
  out.push({ corners: [P(tu + s, tv - 0.3, zd), P(tu + s, tv + 0.3, zd), P(tu + s + 3, tv + 0.3, 0.1), P(tu + s + 3, tv - 0.3, 0.1)], out: [0.5, 0, 1], role: 'slide', hex: hue });
  // the swings beyond it
  const su = u0 + w * 0.75, top = 2.4, span = Math.min(3.6, w * 0.4);
  for (const u of [su - span / 2, su + span / 2]) for (const dv of [-0.8, 0.8]) out.push({ corners: [P(u - 0.05, tv + dv, 0), P(u + 0.05, tv + dv, 0), P(u + 0.05, tv, top), P(u - 0.05, tv, top)], out: [0, Math.sign(dv), 0.3], role: 'metal' });
  out.push(...box(su - span / 2, tv - 0.05, su + span / 2, tv + 0.05, top - 0.1, top, 'metal'));
  for (const u of [su - span / 4, su + span / 4]) out.push(...box(u - 0.25, tv - 0.12, u + 0.25, tv + 0.12, 0.45, 0.5, 'seat'));
  return out;
}

/** A pavilion: an open shelter, its slab, its posts, its hip roof, picnic tables under it. */
export function pavilionOf([u0, v0, u1, v1]) {
  const out = [...box(u0, v0, u1, v1, 0, 0.15, 'paving')], um = (u0 + u1) / 2, vm = (v0 + v1) / 2, z = 2.8, o = 0.6;
  for (const [u, v] of [[u0 + 0.3, v0 + 0.3], [u1 - 0.3, v0 + 0.3], [u1 - 0.3, v1 - 0.3], [u0 + 0.3, v1 - 0.3], [um, v0 + 0.3], [um, v1 - 0.3]]) out.push(...post(u, v, 0.15, z, 0.12, 'timber'));
  const c = [[u0 - o, v0 - o], [u1 + o, v0 - o], [u1 + o, v1 + o], [u0 - o, v1 + o]], r = [[u0 + (u1 - u0) * 0.3, vm], [u1 - (u1 - u0) * 0.3, vm]], zr = z + 1.6;
  out.push({ corners: [P(...c[0], z), P(...c[1], z), P(...r[1], zr), P(...r[0], zr)], out: [0, -1, 1], role: 'roof' }, { corners: [P(...c[2], z), P(...c[3], z), P(...r[0], zr), P(...r[1], zr)], out: [0, 1, 1], role: 'roof' });
  out.push({ corners: [P(...c[3], z), P(...c[0], z), P(...r[0], zr)], out: [-1, 0, 1], role: 'roof' }, { corners: [P(...c[1], z), P(...c[2], z), P(...r[1], zr)], out: [1, 0, 1], role: 'roof' });
  for (const u of [u0 + (u1 - u0) * 0.3, u1 - (u1 - u0) * 0.3]) out.push(...picnicOf(u, vm, 0.15));
  return out;
}

/** A bench at (u, v), its seat along u or v, its back away from `facing` (±1 across it). */
export function benchOf(u, v, along, facing) {
  const [du, dv] = along === 'u' ? [0.9, 0.22] : [0.22, 0.9], s = along === 'u' ? [0, -facing * 0.24] : [-facing * 0.24, 0];
  const out = [...box(u - du, v - dv, u + du, v + dv, 0.42, 0.47, 'seat')];
  out.push(...box(u + s[0] - (along === 'u' ? du : 0.03), v + s[1] - (along === 'u' ? 0.03 : dv), u + s[0] + (along === 'u' ? du : 0.03), v + s[1] + (along === 'u' ? 0.03 : dv), 0.5, 0.85, 'seat'));
  for (const k of [-1, 1]) { const [a, b] = along === 'u' ? [u + k * (du - 0.1), v] : [u, v + k * (dv - 0.1)]; out.push(...post(a, b, 0, 0.42, 0.05, 'metal')); }
  return out;
}

/** A picnic table and its two benches, at (u, v), on a floor `z0` high. */
export function picnicOf(u, v, z0 = 0) {
  return [...box(u - 0.9, v - 0.4, u + 0.9, v + 0.4, z0 + 0.72, z0 + 0.78, 'timber'), ...box(u - 0.9, v - 0.85, u + 0.9, v - 0.6, z0 + 0.42, z0 + 0.47, 'timber'), ...box(u - 0.9, v + 0.6, u + 0.9, v + 0.85, z0 + 0.42, z0 + 0.47, 'timber'), ...post(u, v, z0, z0 + 0.72, 0.08, 'timber')];
}
