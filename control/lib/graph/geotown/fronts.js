/**
 * A HOUSE'S FRONT — what an evoked house wears on its street face over the shell its language speaks
 * (era/out-anchor-structure.js `speak`): a BAY and a PORCH, so the polygons an evocation saves on count go to the face a
 * walker meets. In the house's frame (metres: x along its front from 0 to its width, y into it, its front wall at y = 0
 * facing −y, z up from its floor), so the scene turns and mirrors it with the house.
 *
 *   FRONT                     the numbers: a porch's depth (at the door, across the full front), its posts, its roof;
 *                             a bay's projection, its width, its lights
 *   frontOf(front, house)     → { faces: [{ corners, out, role, storey? }], porch: depth (0 with none) }
 *       front   { bay?: 'canted' | 'square', bayStoreys?: 1 | 2 | 'upper', porch?: 'door' | 'full', porch2?: true (a porch
 *                 over the porch), doors?: 2 (a split house's), shop?: true | { sign, awning, frame, signHex, awningHex,
 *                 letterHex, kick }, canopy?: true, balconies?: true }
 *               (pattern.js types, rows): a SHOPFRONT the ground storey glazed, its door in it, a sign band and an awning;
 *               a CANOPY a slab over a walk-up's door
 *       house   { W, n, storeyH, doorX, doorW }: its width, storeys and storey's height, its door's middle and width
 *     `role` says how the scene paints a face: `wall` (the storey's own wall, `storey` 0 the ground), `glass`, `trim`,
 *     `roof`, `deck`, `sign`, `canvas` (an awning); `out` the way it faces
 *   box(x0, y0, x1, y1, z0, z1, role) → the five faces of a box (no floor), each facing out
 *
 * The bay stands on the side of the front away from the door; under a porch across the front it is the porch's
 * (no higher than its roof) or, `upper`, an oriel over it. Pure: no dice.
 */
export const FRONT = Object.freeze({
  porch: Object.freeze({ door: 1.8, full: 2.2, beside: 0.8, post: 0.18, stride: 2.6, skirt: 0.7, slab: 0.12, over: 0.3, rail: 0.9 }),
  // a shopfront: its glazing's head under the storey's top, its kick plate, its mullions' stride, the sign band, the awning
  shop: Object.freeze({ head: 0.75, kick: 0.45, mullion: 1.5, edge: 0.35, sign: 0.6, awning: 1.4 }),
  canopy: Object.freeze({ w: 2.4, d: 1.4, z: 2.7 }),
  // a low-rise's balconies: their stride across the front, their width, depth, balustrade, the front's edge kept clear
  balcony: Object.freeze({ stride: 6.5, w: 3, d: 1.3, rail: 1, edge: 1.5 }),
  bay: Object.freeze({ proj: 0.85, most: 3, least: 1.8, clear: 1.2, edge: 0.35, fascia: 0.25, glass: Object.freeze({ w: 0.62, h: 0.56, sill: 0.8, frame: 0.07, bar: 0.05 }) }),
});

const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;
const P = (x, y, z) => [r4(x), r4(y), r4(z)];

/** A box's five faces (no floor), each facing out. */
export function box(x0, y0, x1, y1, z0, z1, role, extra = {}) {
  return [
    { corners: [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], out: [0, 0, 1], role, ...extra },
    { corners: [P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], out: [0, -1, 0], role, ...extra },
    { corners: [P(x1, y1, z0), P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1)], out: [0, 1, 0], role, ...extra },
    { corners: [P(x0, y1, z0), P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1)], out: [-1, 0, 0], role, ...extra },
    { corners: [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], out: [1, 0, 0], role, ...extra },
  ];
}

/** The span of the front a bay takes: the side away from the door, clear of it. → { c, w } | null */
function baySpan({ W, doorX, doorW }) {
  const B = FRONT.bay, right = doorX < W / 2, lo = right ? doorX + doorW / 2 + B.clear : B.edge, hi = right ? W - B.edge : doorX - doorW / 2 - B.clear;
  const w = Math.min(B.most, hi - lo);
  return w >= B.least ? { c: (lo + hi) / 2, w } : null;
}

/** The front an evoked house wears: its porch, then its bay. */
export function frontOf(front = {}, house) {
  const { W, n, storeyH: sh, doorX, doorW } = house, out = [], Pc = FRONT.porch;
  // ── the porch: a deck at the floor over the bank before the house, its posts, a slab of roof sloping off the wall ──
  let pd = 0, roofZ = null;
  // (a split house's second door, the upper flat's, beside the first, toward the front's nearer end)
  const d2 = front.doors === 2 ? (() => { const s = doorX < W / 2 ? -1 : 1, x = doorX + s * (doorW + 0.35); return x - doorW / 2 > 0.15 && x + doorW / 2 < W - 0.15 ? x : doorX - s * (doorW + 0.35); })() : null;
  if (front.porch === 'door' || front.porch === 'full') {
    const full = front.porch === 'full', lo = Math.min(doorX, d2 ?? doorX), hi = Math.max(doorX, d2 ?? doorX), a = full ? 0 : Math.max(0, lo - doorW / 2 - Pc.beside), b = full ? W : Math.min(W, hi + doorW / 2 + Pc.beside);
    pd = full ? Pc.full : Pc.door;
    // (a porch over a porch, a split house's: its posts up two storeys, the upper flat's deck between them, its roof over that)
    const two = front.porch2 && n >= 2, zr = (two ? 2 * sh : sh) - 0.3, zw = zr + 0.35, o = Pc.over;
    if (two) {
      out.push(...box(a, -pd, b, 0, sh - 0.15, sh, 'deck'), ...box(a, -pd + 0.06, b, -pd + 0.12, sh + 0.85, sh + 0.95, 'trim'));
      for (const x of [a + 0.06, b - 0.12]) out.push(...box(x, -pd, x + 0.06, 0, sh + 0.85, sh + 0.95, 'trim'));
      out.push({ corners: [P(doorX - doorW / 2, -0.03, sh), P(doorX + doorW / 2, -0.03, sh), P(doorX + doorW / 2, -0.03, sh + 2.1), P(doorX - doorW / 2, -0.03, sh + 2.1)], out: [0, -1, 0], role: 'door', storey: 1 });
    }
    roofZ = zr;
    out.push(...box(a, -pd, b, 0, -Pc.skirt, 0, 'deck'));
    // the posts: one at each end of its front, and across a full porch at their stride, never before the door
    const xs = [a + Pc.post, b - Pc.post];
    if (full) { const k = Math.max(1, Math.round((b - a) / Pc.stride)); for (let i = 1; i < k; i++) xs.push(a + ((b - a) * i) / k); }
    const posts = [...new Set(xs.map(r4))].filter((x) => Math.abs(x - doorX) > doorW / 2 + 0.25 || x === r4(a + Pc.post) || x === r4(b - Pc.post)).sort((p, q) => p - q);
    for (const x of posts) out.push(...box(x - Pc.post / 2, -pd + 0.05, x + Pc.post / 2, -pd + 0.05 + Pc.post, 0, zr, 'trim'));
    // a full porch's rail between its posts, open before the door
    if (full) for (let i = 0; i + 1 < posts.length; i++) {
      const x0 = posts[i] + Pc.post / 2, x1 = posts[i + 1] - Pc.post / 2;
      if (doorX > x0 && doorX < x1) continue;
      out.push(...box(x0, -pd + 0.08, x1, -pd + 0.14, Pc.rail - 0.06, Pc.rail, 'trim'));
    }
    // the roof: its top sloping off the wall over the posts, its underside, its edge and its ends
    const t = Pc.slab, A = [a - o, 0], B = [b + o, 0], Cf = [b + o, -pd - o], Df = [a - o, -pd - o];
    out.push({ corners: [P(Df[0], Df[1], zr), P(Cf[0], Cf[1], zr), P(B[0], B[1], zw), P(A[0], A[1], zw)], out: [0, -0.6, 0.8], role: 'roof' });
    out.push({ corners: [P(Df[0], Df[1], zr - t), P(A[0], A[1], zw - t), P(B[0], B[1], zw - t), P(Cf[0], Cf[1], zr - t)], out: [0, 0, -1], role: 'trim' });
    out.push({ corners: [P(Df[0], Df[1], zr - t), P(Cf[0], Cf[1], zr - t), P(Cf[0], Cf[1], zr), P(Df[0], Df[1], zr)], out: [0, -1, 0], role: 'trim' });
    for (const [x, s] of [[a - o, -1], [b + o, 1]]) out.push({ corners: [P(x, -pd - o, zr - t), P(x, 0, zw - t), P(x, 0, zw), P(x, -pd - o, zr)], out: [s, 0, 0], role: 'trim' });
  }
  // ── the bay: canted or square, on the side away from the door, its lights in each face, a fascia and a flat top ──
  const S = front.bay ? baySpan(house) : null;
  if (S) {
    const B = FRONT.bay, p = B.proj, h = S.w / 2, canted = front.bay === 'canted';
    const upper = front.bayStoreys === 'upper' && n >= 2, rise = upper ? 1 : Math.min(n, front.bayStoreys === 1 ? 1 : 2);
    const z0 = upper ? sh : 0, zTop = upper ? 2 * sh : rise * sh, z1 = !upper && roofZ !== null && front.porch === 'full' ? Math.min(zTop, roofZ - 0.15) : zTop;
    const zb = z0 === 0 ? -Pc.skirt : z0, zf = z1 - B.fascia;
    const L = [S.c - h, 0], R = [S.c + h, 0], FL = [S.c - h + (canted ? p : 0), -p], FR = [S.c + h - (canted ? p : 0), -p];
    const sides = [[L, FL], [FL, FR], [FR, R]];
    for (const [a, b] of sides) {
      const nx = b[1] - a[1], ny = -(b[0] - a[0]), l = Math.hypot(nx, ny) || 1, o = [nx / l, ny / l, 0];
      // (the wall storey by storey, so each wears its own storey's material)
      const cuts = [zb, ...Array.from({ length: Math.max(0, Math.ceil((zf - z0) / sh) - 1) }, (_, i) => z0 + (i + 1) * sh).filter((z) => z < zf - 0.05), zf];
      for (let i = 0; i + 1 < cuts.length; i++) out.push({ corners: [P(a[0], a[1], cuts[i]), P(b[0], b[1], cuts[i]), P(b[0], b[1], cuts[i + 1]), P(a[0], a[1], cuts[i + 1])], out: o, role: 'wall', storey: Math.max(0, Math.floor((cuts[i] - 0 + 0.01) / sh)) });
      out.push({ corners: [P(a[0], a[1], zf), P(b[0], b[1], zf), P(b[0], b[1], z1), P(a[0], a[1], z1)], out: o, role: 'trim' });
      // a light in this face at each storey it rises, a hand proud of it
      const fw = Math.hypot(b[0] - a[0], b[1] - a[1]), gw = Math.min(fw - 0.3, fw * B.glass.w * (fw < 1.4 ? 0.9 : 1));
      if (gw < 0.3) continue;
      for (let s = 0; s < rise; s++) {
        const zs = z0 + s * sh + B.glass.sill, ze = Math.min(zs + sh * B.glass.h, zf - 0.15);
        if (ze - zs < 0.4) continue;
        const t0 = (fw - gw) / 2 / fw, t1 = 1 - t0, at = (t) => [a[0] + (b[0] - a[0]) * t + o[0] * 0.03, a[1] + (b[1] - a[1]) * t + o[1] * 0.03];
        const [g0, g1] = [at(t0), at(t1)], fr = B.glass.frame, ft = [(b[0] - a[0]) / fw, (b[1] - a[1]) / fw], off = (p, d, k) => [p[0] + ft[0] * d + o[0] * k, p[1] + ft[1] * d + o[1] * k];
        // its frame a hand wider than the glass, the glass in it, a sash bar across its middle and a mullion down it
        const [f0, f1] = [off(g0, -fr, -0.012), off(g1, fr, -0.012)];
        out.push({ corners: [P(f0[0], f0[1], zs - fr), P(f1[0], f1[1], zs - fr), P(f1[0], f1[1], ze + fr), P(f0[0], f0[1], ze + fr)], out: o, role: 'trim' });
        out.push({ corners: [P(g0[0], g0[1], zs), P(g1[0], g1[1], zs), P(g1[0], g1[1], ze), P(g0[0], g0[1], ze)], out: o, role: 'glass' });
        const [m0, m1] = [off(g0, 0, 0.012), off(g1, 0, 0.012)], zm = (zs + ze) / 2, mid = [(m0[0] + m1[0]) / 2, (m0[1] + m1[1]) / 2], bar = B.glass.bar / 2;
        out.push({ corners: [P(m0[0], m0[1], zm - bar), P(m1[0], m1[1], zm - bar), P(m1[0], m1[1], zm + bar), P(m0[0], m0[1], zm + bar)], out: o, role: 'trim' });
        const [c0, c1] = [off(mid, -bar, 0), off(mid, bar, 0)];
        out.push({ corners: [P(c0[0], c0[1], zs), P(c1[0], c1[1], zs), P(c1[0], c1[1], ze), P(c0[0], c0[1], ze)], out: o, role: 'trim' });
      }
    }
    // its top: flat, over its plan; and under it where it stands out over a porch's roof or the bank, its soffit
    out.push({ corners: [P(L[0], L[1], z1), P(R[0], R[1], z1), P(FR[0], FR[1], z1), P(FL[0], FL[1], z1)], out: [0, 0, 1], role: 'roof' });
    if (upper) out.push({ corners: [P(L[0], L[1], z0), P(FL[0], FL[1], z0), P(FR[0], FR[1], z0), P(R[0], R[1], z0)], out: [0, 0, -1], role: 'trim' });
  }
  // ── a shopfront: the ground storey glazed between its frame and mullions, the door in it; its sign and its awning
  // its own (`shop`: true, the band and the sloped canvas, or { sign, awning, frame, signHex, awningHex, kick }) ──
  if (front.shop) {
    const Sf = FRONT.shop, V = front.shop === true ? {} : front.shop, kick = V.kick ?? Sf.kick, zt = sh - Sf.head, gaps = [[Sf.edge, doorX - doorW / 2 - 0.12], [doorX + doorW / 2 + 0.12, W - Sf.edge]];
    const fr = V.frame ? { hex: V.frame } : {}, sg = V.signHex ? { hex: V.signHex } : {}, aw = V.awningHex ? { hex: V.awningHex } : {};
    for (const [a, b] of gaps) {
      if (b - a < 0.6) continue;
      out.push({ corners: [P(a, -0.04, 0), P(b, -0.04, 0), P(b, -0.04, zt), P(a, -0.04, zt)], out: [0, -1, 0], role: 'trim', ...fr });
      out.push({ corners: [P(a + 0.08, -0.06, kick), P(b - 0.08, -0.06, kick), P(b - 0.08, -0.06, zt - 0.1), P(a + 0.08, -0.06, zt - 0.1)], out: [0, -1, 0], role: 'glass' });
      const k = Math.max(1, Math.round((b - a) / Sf.mullion));
      for (let i = 1; i < k; i++) { const x = a + ((b - a) * i) / k; out.push({ corners: [P(x - 0.04, -0.08, kick), P(x + 0.04, -0.08, kick), P(x + 0.04, -0.08, zt - 0.1), P(x - 0.04, -0.08, zt - 0.1)], out: [0, -1, 0], role: 'trim', ...fr }); }
      out.push({ corners: [P(a + 0.08, -0.08, zt - 0.62), P(b - 0.08, -0.08, zt - 0.62), P(b - 0.08, -0.08, zt - 0.56), P(a + 0.08, -0.08, zt - 0.56)], out: [0, -1, 0], role: 'trim', ...fr });
    }
    // its sign: a band across the front, a board over its door, a blade off the wall, lettering on its widest glass, none
    const sign = V.sign ?? 'band', wide = gaps.reduce((p, q) => (q[1] - q[0] > p[1] - p[0] ? q : p));
    if (sign === 'band') out.push(...box(0.15, -0.14, W - 0.15, -0.02, sh - Sf.sign - 0.08, sh - 0.08, 'sign', sg));
    else if (sign === 'board') { const a = Math.max(0.15, doorX - 1.3), b = Math.min(W - 0.15, doorX + 1.3); out.push(...box(a, -0.12, b, -0.02, zt + 0.08, zt + 0.62, 'sign', sg)); }
    else if (sign === 'blade') { const x = doorX < W / 2 ? W - 0.45 : 0.45; out.push(...box(x - 0.04, -1.05, x + 0.04, -0.2, sh + 0.25, sh + 1.15, 'sign', sg), ...box(x - 0.03, -1.1, x + 0.03, 0, sh + 1.15, sh + 1.2, 'trim', fr)); }
    else if (sign === 'window' && wide[1] - wide[0] > 1.6) { const m = (wide[0] + wide[1]) / 2, h = Math.min(0.9, (wide[1] - wide[0]) * 0.35); out.push({ corners: [P(m - h, -0.075, zt - 1.05), P(m + h, -0.075, zt - 1.05), P(m + h, -0.075, zt - 0.8), P(m - h, -0.075, zt - 0.8)], out: [0, -1, 0], role: 'sign', ...(V.letterHex ? { hex: V.letterHex } : sg) }); }
    // its awning: sloped canvas, a flat metal canopy on its rods, a rounded one, none
    const awning = V.awning ?? 'slope', ao = Sf.awning, a0 = Sf.edge * 0.6, a1 = W - Sf.edge * 0.6, zh = zt + 0.05, zl = zh - ao * 0.45;
    if (awning === 'slope') {
      out.push({ corners: [P(a0, -ao, zl), P(a1, -ao, zl), P(a1, 0, zh), P(a0, 0, zh)], out: [0, -0.4, 0.9], role: 'canvas', ...aw });
      out.push({ corners: [P(a0, -ao, zl - 0.25), P(a1, -ao, zl - 0.25), P(a1, -ao, zl), P(a0, -ao, zl)], out: [0, -1, 0], role: 'canvas', ...aw });
      for (const [x, sx] of [[a0, -1], [a1, 1]]) out.push({ corners: [P(x, 0, zh), P(x, -ao, zl), P(x, -ao, zl - 0.25)], out: [sx, 0, 0], role: 'canvas', ...aw });
    } else if (awning === 'flat') {
      out.push(...box(a0, -ao * 0.85, a1, -0.02, zh - 0.12, zh, 'canopy', aw));
      for (const x of [a0 + 0.3, a1 - 0.3]) out.push({ corners: [P(x, -0.02, zh + 0.9), P(x, -ao * 0.85, zh), P(x, -ao * 0.85, zh + 0.04), P(x, -0.02, zh + 0.94)], out: [1, 0, 0], role: 'trim', ...fr });
    } else if (awning === 'round') {
      // (a quarter barrel off the wall, in three facets, its two ends closed)
      const prof = [[0, zh + 0.35], [-ao * 0.45, zh + 0.25], [-ao * 0.82, zh - 0.02], [-ao, zh - 0.4]];
      for (let k = 0; k + 1 < prof.length; k++) { const [y0, z0] = prof[k], [y1, z1] = prof[k + 1]; out.push({ corners: [P(a0, y1, z1), P(a1, y1, z1), P(a1, y0, z0), P(a0, y0, z0)], out: [0, -(z0 - z1), y0 - y1], role: 'canvas', ...aw }); }
      for (const [x, sx] of [[a0, -1], [a1, 1]]) for (let k = 1; k + 1 < prof.length; k++) out.push({ corners: [P(x, 0, prof[prof.length - 1][1]), P(x, prof[k][0], prof[k][1]), P(x, prof[k + 1][0], prof[k + 1][1])], out: [sx, 0, 0], role: 'canvas', ...aw });
    }
  }
  // ── a split house's second door: its frame, its leaf, its transom ──
  if (d2 !== null) {
    out.push({ corners: [P(d2 - doorW / 2 - 0.08, -0.02, 0), P(d2 + doorW / 2 + 0.08, -0.02, 0), P(d2 + doorW / 2 + 0.08, -0.02, 2.62), P(d2 - doorW / 2 - 0.08, -0.02, 2.62)], out: [0, -1, 0], role: 'trim' });
    out.push({ corners: [P(d2 - doorW / 2, -0.04, 0.02), P(d2 + doorW / 2, -0.04, 0.02), P(d2 + doorW / 2, -0.04, 2.1), P(d2 - doorW / 2, -0.04, 2.1)], out: [0, -1, 0], role: 'door' });
    out.push({ corners: [P(d2 - doorW / 2, -0.04, 2.18), P(d2 + doorW / 2, -0.04, 2.18), P(d2 + doorW / 2, -0.04, 2.52), P(d2 - doorW / 2, -0.04, 2.52)], out: [0, -1, 0], role: 'glass' });
  }
  // ── a low-rise's balconies, stacked over its front from its second storey up, in bays clear of its door: each a slab,
  // its solid balustrade, its glazed door ──
  if (front.balconies) {
    const B = FRONT.balcony, k = Math.max(1, Math.floor((W - 2 * B.edge) / B.stride)), xs = Array.from({ length: k }, (_, i) => B.edge + B.stride * (i + 0.5) * ((W - 2 * B.edge) / (k * B.stride)));
    for (const x of xs.filter((x) => Math.abs(x - doorX) > B.w / 2 + doorW / 2 + 0.6)) for (let s = 1; s < n; s++) {
      const z = s * sh, a = x - B.w / 2, b = x + B.w / 2, d = B.d;
      out.push(...box(a, -d, b, 0, z - 0.16, z, 'trim'));
      out.push({ corners: [P(a, -d, z), P(b, -d, z), P(b, -d, z + B.rail), P(a, -d, z + B.rail)], out: [0, -1, 0], role: 'trim' });
      for (const [u, sx] of [[a, -1], [b, 1]]) out.push({ corners: [P(u, 0, z), P(u, -d, z), P(u, -d, z + B.rail), P(u, 0, z + B.rail)], out: [sx, 0, 0], role: 'trim' });
      out.push({ corners: [P(x - 0.55, -0.03, z), P(x + 0.55, -0.03, z), P(x + 0.55, -0.03, z + 2.1), P(x - 0.55, -0.03, z + 2.1)], out: [0, -1, 0], role: 'glass', storey: s });
    }
  }
  // ── a walk-up's canopy over its door, on two brackets ──
  if (front.canopy) {
    const c = FRONT.canopy, a = Math.max(0, doorX - c.w / 2), b = Math.min(W, doorX + c.w / 2);
    out.push(...box(a, -c.d, b, 0, c.z, c.z + 0.16, 'trim'));
    for (const x of [a + 0.15, b - 0.15]) out.push({ corners: [P(x, 0, c.z - 0.6), P(x, 0, c.z), P(x, -c.d * 0.8, c.z)], out: [1, 0, 0], role: 'trim' });
  }
  return { faces: out, porch: pd };
}
