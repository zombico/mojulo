/**
 * historic/assets/orders — the Roman orders at walking scale: base, shaft, capital and entablature as real parts,
 * not massing. Each part is built once in its own frame and stands in a building many times (the World page's
 * `repeats`: one template, N transforms), so the detail costs its faces once.
 *
 * Units: metres, measured in the column's lower diameter `D` (the Roman module) the way the orders are written.
 * Frames: a column stands on (0, 0) at z = 0 and rises along +z; an entablature segment runs along +x from 0 to its
 * `span`, its architrave face on y = 0 (the front, toward −y as every asset's front) and its depth back along +y.
 *
 * Built from `panel` solids (../assets/solids.js): a lathe turns a profile into rings of quads; the fluted shaft is a
 * star section; leaves, volutes and mouldings are panels and small frusta. Proportions default to the Augustan and
 * Tiberian norm, read from the style card (../style/forum.js `kit.order`); every number here is the kit's, not the site's.
 */
import { FORUM_STYLE } from '../style/forum.js';

const TAU = Math.PI * 2;
const ORDER = FORUM_STYLE.kit.order;

const bbox = (pts) => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), zs = pts.map((p) => p[2]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, d: Math.max(...ys) - y, z0: Math.min(...zs), z1: Math.max(...zs) };
};
/** One planar face, `out` the side it faces (the true normal is taken from its corners). */
export const panel = (kind, pts, out, tint) => ({ kind, solid: 'panel', pts, out, tint, ...bbox(pts) });
const box = (kind, x, y, w, d, z0, z1, tint, o = {}) => ({ kind, solid: 'frustum', x, y, w, d, z0, z1, top: { x, y, w, d }, tint, ...o });

/**
 * A profile turned about the vertical axis at (cx, cy): `profile` is [[r, z], ...] bottom to top, `sides` facets
 * round. A band whose two rings sit at one height is a ledge (facing up where the profile steps in, down where it
 * steps out). `cap` closes the top ring.
 */
export function lathe(kind, cx, cy, profile, tint, { sides = 24, phase = 0, cap = false } = {}) {
  const out = [], ring = ([r, z]) => Array.from({ length: sides }, (_, i) => { const a = phase + (i / sides) * TAU; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, z]; });
  for (let k = 0; k < profile.length - 1; k++) {
    const [r0, z0] = profile[k], [r1, z1] = profile[k + 1];
    if (Math.abs(r0 - r1) < 1e-6 && Math.abs(z0 - z1) < 1e-6) continue;
    const lo = ring(profile[k]), hi = ring(profile[k + 1]);
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides, a = phase + ((i + 0.5) / sides) * TAU;
      const flat = Math.abs(z1 - z0) < 1e-6, o = flat ? [0, 0, r1 < r0 ? 1 : -1] : [Math.cos(a), Math.sin(a), -(r1 - r0) / (z1 - z0)];
      out.push(panel(kind, [lo[i], lo[j], hi[j], hi[i]], o, tint));
    }
  }
  if (cap) out.push(panel(kind, ring(profile[profile.length - 1]), [0, 0, 1], tint));
  return out;
}

/**
 * A fluted shaft: `flutes` channels, each a V cut `depth` deep between flat fillets, the section a star of 3 points a
 * flute (fillet, fillet, channel floor). Straight for its lower third, then tapering to `rTop` (entasis read as taper).
 */
export function flutedShaft(kind, cx, cy, r0, rTop, z0, z1, tint, { flutes = 24, depth = 0.06, fillet = 0.22 } = {}) {
  const out = [], step = TAU / flutes, zs = [z0, z0 + (z1 - z0) / 3, z1], rs = [r0, r0, rTop];
  const section = (r, z) => {
    const pts = [];
    for (let i = 0; i < flutes; i++) {
      const a = i * step, f = (fillet * step) / 2, d = depth * r;
      pts.push([a - f, r], [a + f, r], [a + step / 2, r - d]);
    }
    return pts.map(([a, rr]) => [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, z]);
  };
  for (let k = 0; k < 2; k++) {
    const lo = section(rs[k], zs[k]), hi = section(rs[k + 1], zs[k + 1]), n = lo.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, m = [(lo[i][0] + lo[j][0]) / 2 - cx, (lo[i][1] + lo[j][1]) / 2 - cy];
      out.push(panel(kind, [lo[i], lo[j], hi[j], hi[i]], [m[0], m[1], 0], tint));
    }
  }
  return out;
}

/** The Attic base (Vitruvius III.5): a square plinth, the lower torus, the scotia between fillets, the upper torus. Height `h`. */
export function atticBase(kind, D, tint, { h = 0.5 * D, plinth = 1.42 } = {}) {
  const r = D / 2, p = h / 3, half = (plinth * D) / 2, out = [box(kind, -half, -half, 2 * half, 2 * half, 0, p, tint)];
  // the mouldings above the plinth, as a profile: torus (a half-round in three facets), fillet, scotia, fillet, torus
  const t1 = (h - p) * 0.38, sc = (h - p) * 0.34, t2 = (h - p) * 0.28, z = p;
  const R1 = half * 0.97, R2 = r * 1.18;
  out.push(...lathe(kind, 0, 0, [
    [R1 * 0.93, z], [R1, z + t1 * 0.35], [R1, z + t1 * 0.65], [R1 * 0.93, z + t1],          // lower torus
    [r * 1.12, z + t1], [r * 1.12, z + t1 + sc * 0.12], [r * 1.02, z + t1 + sc * 0.5],       // fillet, into the scotia
    [r * 1.1, z + t1 + sc * 0.88], [r * 1.1, z + t1 + sc], [R2 * 0.95, z + t1 + sc],        // out of it, the upper fillet
    [R2, z + t1 + sc + t2 * 0.4], [R2 * 0.94, z + t1 + sc + t2 * 0.8], [r, h],              // upper torus, onto the shaft
  ], tint, { sides: 24 }));
  return out;
}

/** The astragal and the shaft's flare under the capital: a small bead and fillet round the shaft's top. */
const necking = (kind, rTop, z, tint) => lathe(kind, 0, 0, [[rTop, z - 0.12 * rTop], [rTop * 1.1, z - 0.08 * rTop], [rTop * 1.1, z - 0.02 * rTop], [rTop, z]], tint, { sides: 24 });

/**
 * The Corinthian capital, `hc` high on a shaft top of radius `rTop` (the Roman scheme, as at Castor and Mars Ultor):
 *  - the bell, flaring a little to the abacus;
 *  - two rows of eight acanthus leaves: the lower between the axes, the upper on them (under each flower and each
 *    corner volute). A leaf has a raised midrib, spreads as it rises, and its top lobe curls out and down;
 *  - the caulicoli, fluted stalks with a crown, rising between the upper leaves;
 *  - from each, a stalk out to a corner volute under an abacus horn and an inner helix toward the face's middle,
 *    each ending in a spiral (a disc with a raised eye);
 *  - the abacus, its corners cut (a canted square reads as the concave one at a distance), a flower on each face.
 */
export function corinthianCapital(kind, D, rTop, z0, tint, { hc = 1.15 * D, leaf } = {}) {
  const out = [], ab = hc / 7, zb = z0 + hc - ab, rBell = (z) => rTop + (rTop * 0.14) * ((z - z0) / (hc - ab));
  const L = leaf || tint, A = 0.74 * D;
  out.push(...lathe(kind, 0, 0, [[rTop, z0], [rBell(zb), zb]], tint, { sides: 16 }));
  const dir = (a) => [Math.cos(a), Math.sin(a)];
  const at = (a, r, along, z) => { const c = dir(a); return [c[0] * r - c[1] * along, c[1] * r + c[0] * along, z]; };
  // an acanthus leaf on the bell at angle `a`, from za to zt, `w` wide at its foot
  const acanthus = (a, za, zt, w) => {
    const h = zt - za, c = dir(a), rows = [
      // [height fraction, outward lean (D), half-width (of w), midrib proud (D)]
      [0, 0, 0.36, 0.02], [0.55, 0.05, 0.52, 0.035], [1, 0.13, 0.5, 0.03],
    ].map(([f, lean, hw, rib]) => { const z = za + f * h, r = rBell(z) + 0.01 * D + lean * D; return { l: at(a, r, -hw * w, z), m: at(a, r + rib * D, 0, z), rr: at(a, r, hw * w, z) }; });
    for (let k = 0; k < rows.length - 1; k++) {
      const lo = rows[k], hi = rows[k + 1], o = [c[0], c[1], 0.15];
      out.push(panel(kind, [lo.l, lo.m, hi.m, hi.l], o, L), panel(kind, [lo.m, lo.rr, hi.rr, hi.m], o, L));
    }
    // the top lobe, curling out and down from the leaf's head
    // the top lobe: over the leaf's head and hanging down outside it, a narrower blade with its own rib
    const top = rows[rows.length - 1], tr = rBell(zt) + 0.24 * D, over = at(a, tr - 0.04 * D, 0, zt + 0.03 * D), tip = at(a, tr, 0, zt - 0.16 * D);
    const ol = at(a, tr - 0.07 * D, -0.3 * w, zt - 0.02 * D), orr = at(a, tr - 0.07 * D, 0.3 * w, zt - 0.02 * D);
    out.push(panel(kind, [top.l, top.m, over, ol], [c[0], c[1], 1.2], L), panel(kind, [top.m, top.rr, orr, over], [c[0], c[1], 1.2], L));
    out.push(panel(kind, [ol, over, tip], [c[0], c[1], -0.2], L), panel(kind, [over, orr, tip], [c[0], c[1], -0.2], L));
  };
  const wl = (TAU * rTop) / 8;
  for (let k = 0; k < 8; k++) acanthus(((k + 0.5) * TAU) / 8, z0, z0 + hc * 0.36, wl * 1.05);
  for (let k = 0; k < 8; k++) acanthus((k * TAU) / 8, z0 + hc * 0.06, z0 + hc * 0.64, wl * 1.1);
  // a spiral: a disc facing `n` (a 10-gon) with a smaller raised eye
  const spiral = (p, n, r) => {
    const u = Math.abs(n[2]) > 0.9 ? [1, 0, 0] : [-n[1], n[0], 0], ul = Math.hypot(...u), U = u.map((v) => v / ul), V = [n[1] * U[2] - n[2] * U[1], n[2] * U[0] - n[0] * U[2], n[0] * U[1] - n[1] * U[0]];
    const disc = (rr, off) => Array.from({ length: 10 }, (_, i) => { const t = (i / 10) * TAU; return [0, 1, 2].map((k) => p[k] + n[k] * off + U[k] * Math.cos(t) * rr + V[k] * Math.sin(t) * rr); });
    out.push(panel(kind, disc(r, 0), n, tint), panel(kind, disc(r * 0.45, 0.025 * D), n, tint));
    // the coil's rim: the disc's edge as a short band, so it reads with depth from the side
    const a0 = disc(r, 0), a1 = disc(r, -0.07 * D);
    for (let i = 0; i < 10; i++) { const j = (i + 1) % 10; out.push(panel(kind, [a0[i], a0[j], a1[j], a1[i]], [0, 1, 2].map((k) => (a0[i][k] + a0[j][k]) / 2 - p[k]), tint)); }
  };
  // the caulicoli between the upper leaves; from each, a stalk to the corner volute and one to the inner helix
  const zc = z0 + hc * 0.56, zv = zb - 0.11 * D;
  for (let k = 0; k < 8; k++) {
    const a = ((k + 0.5) * TAU) / 8, c = dir(a), cr = rBell(zc) + 0.05 * D, cs = 0.055 * D;
    const cx = c[0] * cr, cy = c[1] * cr;
    out.push(...flutedShaft(kind, cx, cy, cs, cs, zc - 0.12 * D, zc + 0.05 * D, tint, { flutes: 5, depth: 0.2 }));
    out.push(...lathe(kind, cx, cy, [[cs, zc + 0.05 * D], [cs * 1.6, zc + 0.1 * D], [cs * 1.2, zc + 0.12 * D]], L, { sides: 6, cap: true }));
    // which way this caulis's volute goes: the nearer diagonal (corner) and the nearer axis (helix)
    const corner = (Math.floor(k / 2) * 2 + 1) * (TAU / 8), axis = k % 2 === 0 ? (k * TAU) / 8 : ((k + 1) * TAU) / 8;
    for (const [b, far, zz, rr] of [[corner, A * 0.98, zv, 0.09 * D], [axis, rBell(zb) + 0.02 * D, zv - 0.04 * D, 0.06 * D]]) {
      const cb = dir(b), toward = b === corner ? [cb[0] * far, cb[1] * far] : [cb[0] * far + (cx - cb[0] * far) * 0.35, cb[1] * far + (cy - cb[1] * far) * 0.35];
      const s0 = [cx, cy, zc + 0.1 * D], s1 = [(cx + toward[0]) / 2 * 1.08, (cy + toward[1]) / 2 * 1.08, (zc + zz) / 2 + 0.06 * D], s2 = [toward[0], toward[1], zz];
      const side = [-(s2[1] - s0[1]), s2[0] - s0[0]], sl = Math.hypot(...side) || 1, hw = 0.035 * D, sd = [side[0] / sl * hw, side[1] / sl * hw, 0];
      const pl = (p, g) => [p[0] + sd[0] * g, p[1] + sd[1] * g, p[2]];
      out.push(panel(kind, [pl(s0, -1), pl(s0, 1), pl(s1, 1), pl(s1, -1)], [s1[0], s1[1], 0.4], tint), panel(kind, [pl(s1, -1), pl(s1, 1), pl(s2, 1), pl(s2, -1)], [s2[0], s2[1], -0.2], tint));
      if (b === corner || k % 2 === 0) spiral(s2, [cb[0] * 0.92, cb[1] * 0.92, -0.38], rr);
    }
  }
  // the abacus
  const cut = 0.17 * D, oct = [[A - cut, -A], [A, -A + cut], [A, A - cut], [A - cut, A], [-A + cut, A], [-A, A - cut], [-A, -A + cut], [-A + cut, -A]];
  const ring = (z, f = 1) => oct.map(([x, y]) => [x * f, y * f, z]);
  const lo = ring(zb, 0.93), mid = ring(zb + ab * 0.45, 0.97), hi = ring(zb + ab);
  for (const [p, q] of [[lo, mid], [mid, hi]]) for (let i = 0; i < 8; i++) { const j = (i + 1) % 8, m = [(q[i][0] + q[j][0]) / 2, (q[i][1] + q[j][1]) / 2]; out.push(panel(kind, [p[i], p[j], q[j], q[i]], [m[0], m[1], 0], tint)); }
  out.push(panel(kind, hi, [0, 0, 1], tint), panel(kind, lo, [0, 0, -1], tint));
  // the flower on each face, over the helices: a disc of petals
  for (let k = 0; k < 4; k++) { const c = dir((k * TAU) / 4); spiral([c[0] * (A * 0.96), c[1] * (A * 0.96), zb + ab * 0.45], [c[0], c[1], 0], 0.1 * D); }
  return out;
}

/** The Ionic capital: an echinus with its egg-and-dart read as a bulge, the cushion and its two volutes front and back, a thin abacus. */
export function ionicCapital(kind, D, rTop, z0, tint, { hc = 0.55 * D } = {}) {
  const out = [], vr = 0.2 * D, half = 0.72 * D, zt = z0 + hc;
  out.push(...lathe(kind, 0, 0, [[rTop, z0], [rTop * 1.18, z0 + hc * 0.35], [rTop * 1.1, z0 + hc * 0.55]], tint, { sides: 20 }));
  out.push(box(kind, -half + vr, -rTop * 1.05, 2 * (half - vr), 2 * rTop * 1.05, z0 + hc * 0.5, zt - hc * 0.12, tint));   // the cushion
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    // a volute: a round face (an octagon) with its eye, on the front and back of the cushion's ends
    const cx = sx * (half - vr), cz = z0 + hc * 0.4, y = sy * rTop * 1.08;
    const pts = Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * TAU; return [cx + Math.cos(a) * vr, y, cz + Math.sin(a) * vr]; });
    out.push(panel(kind, pts, [0, sy, 0], tint));
    out.push(box(kind, cx - vr * 0.18, y - (sy < 0 ? 0.03 * D : 0), vr * 0.36, 0.03 * D, cz - vr * 0.18, cz + vr * 0.18, tint));
  }
  out.push(box(kind, -half, -half * 0.75, 2 * half, 1.5 * half, zt - hc * 0.12, zt, tint));   // the abacus
  return out;
}

/** The Tuscan capital: necking, a quarter-round echinus and a square abacus. */
export function tuscanCapital(kind, D, rTop, z0, tint, { hc = 0.5 * D } = {}) {
  const half = 0.6 * D;
  return [
    ...lathe(kind, 0, 0, [[rTop, z0], [rTop, z0 + hc * 0.3], [rTop * 1.08, z0 + hc * 0.3], [rTop * 1.08, z0 + hc * 0.4], [half * 1.02, z0 + hc * 0.66]], tint, { sides: 20 }),
    box(kind, -half, -half, 2 * half, 2 * half, z0 + hc * 0.66, z0 + hc, tint),
  ];
}

/**
 * A whole column of the order (`'corinthian' | 'ionic' | 'tuscan'`) with lower diameter `D`, standing on (0, 0): `H`
 * high overall (base to abacus top; default the card's height in diameters). Base, capital, taper and flutes from the
 * style card (`kit`: FORUM_STYLE.kit.order[order]); `fluted: false` leaves the shaft plain.
 * Returns the masses and the heights a builder needs (`base`, `shaftTop`, `top`, `rTop`).
 */
export function column(order, { D, H, tint, leaf, fluted, kit = ORDER[order] } = {}) {
  const kind = 'column', r = D / 2, rTop = r * kit.taper, height = H ?? kit.column * D;
  const hc = kit.capital * D, hb = kit.base * D, zs = height - hc, out = [...atticBase(kind, D, tint, { h: hb })];
  const flute = fluted ?? kit.flutes > 0;
  if (flute) out.push(...flutedShaft(kind, 0, 0, r, rTop, hb, zs, tint, { flutes: kit.flutes || 24 }));
  else out.push(...lathe(kind, 0, 0, [[r, hb], [r, hb + (zs - hb) / 3], [rTop, zs]], tint, { sides: 20 }));
  out.push(...necking(kind, rTop, zs, tint));
  if (order === 'corinthian') out.push(...corinthianCapital(kind, D, rTop, zs, tint, { hc, leaf }));
  else if (order === 'ionic') out.push(...ionicCapital(kind, D, rTop, zs, tint, { hc }));
  else out.push(...tuscanCapital(kind, D, rTop, zs, tint, { hc }));
  return { masses: out, base: hb, shaftTop: zs, top: height, rTop };
}

/**
 * A run of entablature `span` long (along +x), the architrave face on y = 0, `deep` back. Heights from `D`:
 * the architrave in three fasciae, each stepping out, a crowning moulding; the frieze; the cornice: dentils, the
 * modillions (brackets) on a `pitch`, the corona and the sima. `returns` closes an end ('lo' | 'hi' | both) where the
 * entablature turns a corner, so a run reads as solid stone from the side.
 */
export function entablature(order, { D, span, deep = 1.2 * D, tint, pitch, dentils = true } = {}) {
  const kind = 'entablature', out = [];
  const corinthian = order === 'corinthian', ionic = order === 'ionic';
  const ha = (corinthian ? 0.78 : ionic ? 0.7 : 0.6) * D, hf = (corinthian ? 0.72 : ionic ? 0.6 : 0.5) * D;
  // the architrave: three fasciae, each a little proud of the one below (Tuscan: one face)
  const fasc = corinthian || ionic ? [0.28, 0.33, 0.39] : [1];
  let z = 0;
  fasc.forEach((f, i) => { const h = ha * 0.86 * f, o = 0.025 * D * i; out.push(box(kind, 0, -o, span, deep + o, z, z + h, tint)); z += h; });
  out.push(box(kind, 0, -0.09 * D, span, deep + 0.09 * D, z, ha, tint));   // the crowning moulding
  // the frieze, flush with the lowest fascia
  out.push(box(kind, 0, 0, span, deep, ha, ha + hf, tint));
  z = ha + hf;
  // the cornice: bed moulding, dentils, the modillion zone, corona, sima
  out.push(box(kind, 0, -0.08 * D, span, deep + 0.08 * D, z, z + 0.1 * D, tint)); z += 0.1 * D;
  if (dentils && (corinthian || ionic)) {
    const dw = 0.11 * D, dp = 0.18 * D, dh = 0.16 * D, n = Math.max(1, Math.floor(span / dp));
    out.push(box(kind, 0, -0.06 * D, span, deep + 0.06 * D, z, z + dh, tint));   // the band behind them
    for (let i = 0; i < n; i++) { const x = (span - n * dp) / 2 + i * dp + (dp - dw) / 2; out.push(box(kind, x, -0.17 * D, dw, 0.11 * D, z, z + dh, tint)); }
    z += dh + 0.03 * D;
  }
  if (corinthian) {
    const hm = 0.2 * D, mp = pitch || 0.62 * D, n = Math.max(1, Math.round(span / mp)), step = span / n;
    out.push(box(kind, 0, -0.14 * D, span, deep + 0.14 * D, z, z + hm, tint));   // the soffit's backing
    for (let i = 0; i < n; i++) {
      // a modillion: a scrolled bracket read as a block stepping down outward, a small leaf under its front
      const x = i * step + step / 2 - 0.11 * D;
      out.push(box(kind, x, -0.62 * D, 0.22 * D, 0.48 * D, z + hm * 0.45, z + hm, tint), box(kind, x + 0.03 * D, -0.6 * D, 0.16 * D, 0.1 * D, z + hm * 0.2, z + hm * 0.45, tint));
    }
    z += hm;
  }
  const pc = corinthian ? 0.7 * D : ionic ? 0.55 * D : 0.4 * D;
  out.push(box(kind, 0, -pc, span, deep + pc, z, z + 0.2 * D, tint)); z += 0.2 * D;       // the corona
  out.push(box(kind, 0, -pc - 0.04 * D, span, deep + pc + 0.04 * D, z, z + 0.18 * D, tint)); z += 0.18 * D;   // the sima
  return { masses: out, height: z };
}

/** Faces of a template (metres in its own frame) as a mass list for the asset sheet; the counts a builder budgets with. */
export function partStats(masses) {
  return { masses: masses.length, panels: masses.filter((m) => m.solid === 'panel').length };
}
