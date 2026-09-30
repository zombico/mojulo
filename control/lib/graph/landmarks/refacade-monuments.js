// Metro refacade builders: monuments. Each entry is (b, { L, camHint, cityBox }) → faces, drawn only for
// a metro box (b.metro); the stock builder draws everything else. See refacade.js.
//
// Every builder works in a LOCAL frame: u runs along the footprint's long side, v across it (v = 0 is
// the front, the side the city camera and the key light favour), z up from b.z0. A footprint laid
// the other way (d > w) swaps the axes, so the long axis always carries the building's length.
// Sizes come from the short side `s` and the long side `Lu`, never from b.z1; each builder's top stays
// under LANDMARK_HEIGHTS × s. No rng: a ruin or an irregular pattern is a fixed, designed table.
import { makeKit, mixHex } from './refacade-kit.js';
import { scaleHex } from '../polygonizer/vexar.js';
import * as dmath from '../../util/dmath.js';

// ── the local frame ──────────────────────────────────────────────────────────────────────────
function localKit(b, ctx) {
  const faces = [];
  const kit = makeKit({ faces, L: ctx.L, camHint: ctx.camHint });
  const swap = b.d > b.w;
  const Lu = swap ? b.d : b.w, Dv = swap ? b.w : b.d, s = Math.min(b.w, b.d), z0 = b.z0;
  const P = (u, v, z = 0) => (swap ? [b.x + v, b.y + u, z0 + z] : [b.x + u, b.y + v, z0 + z]);
  const V = (d) => (swap ? [d[1], d[0], d[2]] : [d[0], d[1], d[2]]);
  const O = (out) => (out == null ? null : Array.isArray(out) ? P(out[0], out[1], out[2]) : { dir: V(out.dir) });
  const M = (pts) => pts.map((p) => P(p[0], p[1], p[2]));

  const quad = (pts, tint, out = null) => kit.quad(M(pts), tint, O(out));
  const tri = (A, B, T, tint, out = null) => kit.tri(P(...A), P(...B), P(...T), tint, O(out));
  const poly = (pts, tint, out = null) => kit.poly(M(pts), tint, O(out));
  /** axis-aligned box in local coords; `tint` a hex or { side, top, bottom } */
  const box = (u0, v0, za, u1, v1, zb, tint) => {
    const A = P(Math.min(u0, u1), Math.min(v0, v1), za), B = P(Math.max(u0, u1), Math.max(v0, v1), zb);
    kit.box(Math.min(A[0], B[0]), Math.min(A[1], B[1]), A[2], Math.max(A[0], B[0]), Math.max(A[1], B[1]), B[2], tint);
  };
  const lathe = (cu, cv, profile, n, tint, opts) => {
    const c = P(cu, cv, 0);
    kit.lathe(c[0], c[1], profile.map(([r, z]) => [r, z0 + z]), n, tint, opts);
  };
  const prism = (outline, za, zb, tint, opts = {}) => {
    const w = outline.map(([u, v]) => P(u, v, 0).slice(0, 2));
    kit.prism(w, z0 + za, z0 + zb, tint, { ...opts, inside: opts.inside ? P(...opts.inside) : null });
  };
  /** a wall frame in local coords: origin, along-wall unit u, up v, outward n */
  const wall = (o, uu, vv, nn) => kit.wall(P(o[0], o[1], o[2]), V(uu), V(vv), V(nn));
  /** the four faces of an axis-aligned local block as wall frames (s runs left → right seen from outside) */
  const walls = (u0, v0, u1, v1, za) => ({
    front: wall([u0, v0, za], [1, 0, 0], [0, 0, 1], [0, -1, 0]),
    right: wall([u1, v0, za], [0, 1, 0], [0, 0, 1], [1, 0, 0]),
    back: wall([u1, v1, za], [-1, 0, 0], [0, 0, 1], [0, 1, 0]),
    left: wall([u0, v1, za], [0, -1, 0], [0, 0, 1], [-1, 0, 0]),
    len: { front: u1 - u0, right: v1 - v0, back: u1 - u0, left: v1 - v0 },
  });
  /**
   * An oriented block (a dressed stone, a beam): centre (cu, cv), `yaw` in plan, half-extents a (along
   * yaw) × c (across), from za to zb. `top` shrinks the top face (taper), `lean` = [du, dv] shifts it.
   */
  const obox = (cu, cv, yaw, a, c, za, zb, tint, { top = 1, lean = [0, 0], topTint = null, bottom = false } = {}) => {
    const cs = dmath.cos(yaw), sn = dmath.sin(yaw);
    const at = (x, y, z, k, dl) => [cu + (x * cs - y * sn) * k + dl[0], cv + (x * sn + y * cs) * k + dl[1], z];
    const lo = [[-a, -c], [a, -c], [a, c], [-a, c]].map(([x, y]) => at(x, y, za, 1, [0, 0]));
    const hi = [[-a, -c], [a, -c], [a, c], [-a, c]].map(([x, y]) => at(x, y, zb, top, lean));
    const inside = [cu + lean[0] / 2, cv + lean[1] / 2, (za + zb) / 2];
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad([lo[i], lo[j], hi[j], hi[i]], tint, inside); }
    quad(hi, topTint || scaleHex(tint, 1.05), inside);
    if (bottom) quad(lo, scaleHex(tint, 0.8), inside);
  };
  return { faces, kit, swap, Lu, Dv, s, P, V, quad, tri, poly, box, lathe, prism, wall, walls, obox };
}

/**
 * A wall frame on the plan edge p → q of a convex outline round `centre`, walked so s runs left →
 * right seen from outside. `off` pushes the frame out along the normal (a proud panel's own plane).
 */
function edgeWall(K, p, q, za, centre, off = 0) {
  const du = q[0] - p[0], dv = q[1] - p[1], l = dmath.hypot(du, dv) || 1;
  let u = [du / l, dv / l, 0], o = p;
  // the outward normal for a left → right walk is u × up = (u_v, -u_u)
  let n = [u[1], -u[0], 0];
  const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  if ((m[0] - centre[0]) * n[0] + (m[1] - centre[1]) * n[1] < 0) { u = [-u[0], -u[1], 0]; o = q; n = [-n[0], -n[1], 0]; }
  return { w: K.wall([o[0] + n[0] * off, o[1] + n[1] * off, za], u, [0, 0, 1], n), len: l, n, o, u };
}

// ── TAJ MAHAL ────────────────────────────────────────────────────────────────────────────────
// The raised marble plinth on its sandstone terrace, the four minarets at the plinth corners
// (three balconies, a chhatri cap), the chamfered mausoleum with its four pishtaqs (a tall pointed
// iwan in a rectangular calligraphy frame, flanked by stacked niches), the onion dome on its drum
// with a lotus crown and gilt finial, and the four chhatris round it.
const TAJ = {
  marble: '#f4f0e7', marbleWarm: '#ebe4d4', shade: '#dcd4c3', niche: '#9a917f', iwan: '#5e5649',
  inlay: '#4b4740', gold: '#b7974f', terrace: '#a8897a', terraceTop: '#b99c8b',
};
function tajMahal(b, ctx) {
  const K = localKit(b, ctx), { s, Lu, Dv } = K, p = TAJ;
  const cu = Lu / 2, cv = Dv / 2;
  // terrace + plinth (the plinth is square on the short side, centred on the footprint)
  const half = s / 2, zT = s * 0.012, zP = s * 0.082;
  K.box(cu - half, cv - half, 0, cu + half, cv + half, zT, { side: p.terrace, top: p.terraceTop });
  const ph = half - s * 0.018;
  K.box(cu - ph, cv - ph, zT, cu + ph, cv + ph, zP, { side: p.marbleWarm, top: p.marble });
  // the plinth's blind arcade: a row of shallow arched niches along each side
  const pw = K.walls(cu - ph, cv - ph, cu + ph, cv + ph, zT);
  for (const side of ['front', 'right', 'back', 'left']) {
    const w = pw[side], n = 13, span = pw.len[side], bay = span / n;
    for (let i = 1; i < n - 1; i++) {
      const a = i * bay + bay * 0.22, c = (i + 1) * bay - bay * 0.22;
      w.arch(a, c, (zP - zT) * 0.14, (zP - zT) * 0.58, 0.002, p.niche, null, { seg: 4, pointed: true, rise: (zP - zT) * 0.22 });
    }
  }

  // minarets at the plinth corners
  const mIn = s * 0.052, rM = s * 0.026, mTop = zP + s * 0.40;
  for (const [mu, mv] of [[cu - ph + mIn, cv - ph + mIn], [cu + ph - mIn, cv - ph + mIn], [cu - ph + mIn, cv + ph - mIn], [cu + ph - mIn, cv + ph - mIn]]) {
    K.lathe(mu, mv, [[rM * 1.35, zP], [rM * 1.35, zP + s * 0.018], [rM, zP + s * 0.022]], 8, p.marbleWarm, { capTop: p.marble });
    let z = zP + s * 0.022;
    const bands = [0.34, 0.64, 0.9], rr = (t) => rM * (1 - 0.22 * t);
    for (const t of bands) {
      const zb = zP + (mTop - zP) * t, r0 = rr((z - zP) / (mTop - zP)), r1 = rr(t);
      K.lathe(mu, mv, [[r0, z], [r1, zb]], 10, p.marble);
      // balcony: a corbelled ring, a parapet band, a floor
      const rb = r1 * 1.75, hb = s * 0.011;
      K.lathe(mu, mv, [[r1, zb], [rb, zb + hb]], 10, p.shade);
      K.lathe(mu, mv, [[rb, zb + hb], [rb, zb + hb * 1.9]], 10, p.marble, { capTop: p.marble });
      z = zb + hb * 1.9;
    }
    // the chhatri: eight posts under a flared eave and a small dome
    const rc = rM * 1.25, zc = z, hc = s * 0.03;
    K.lathe(mu, mv, [[rc, zc], [rc, zc + hc]], 16, (i) => (i % 2 ? p.iwan : p.marble));
    K.lathe(mu, mv, [[rc, zc + hc], [rc * 1.45, zc + hc + s * 0.004], [rc * 1.45, zc + hc + s * 0.008]], 12, p.marble, { capTop: p.marble });
    const zd = zc + hc + s * 0.008, hd = s * 0.034;
    K.lathe(mu, mv, [[rc * 0.95, zd], [rc * 1.05, zd + hd * 0.3], [rc * 0.8, zd + hd * 0.62], [rc * 0.35, zd + hd * 0.88], [0, zd + hd]], 10, p.marble);
    K.lathe(mu, mv, [[s * 0.003, zd + hd], [s * 0.003, zd + hd + s * 0.022], [0, zd + hd + s * 0.026]], 4, p.gold);
  }

  // the mausoleum: a square with chamfered corners
  const hb = s * 0.285, ch = s * 0.08, zW = zP + s * 0.29;
  const oct = [
    [cu - hb + ch, cv - hb], [cu + hb - ch, cv - hb], [cu + hb, cv - hb + ch], [cu + hb, cv + hb - ch],
    [cu + hb - ch, cv + hb], [cu - hb + ch, cv + hb], [cu - hb, cv + hb - ch], [cu - hb, cv - hb + ch],
  ];
  K.prism(oct, zP, zW, p.marble, { cap: p.marble });
  // cornice band
  const octC = oct.map(([u, v]) => [cu + (u - cu) * 1.025, cv + (v - cv) * 1.025]);
  K.prism(octC, zW - s * 0.012, zW, p.marbleWarm, { cap: p.marble });
  const ctr = [cu, cv];
  for (let e = 0; e < 8; e++) {
    const { w, len, n } = edgeWall(K, oct[e], oct[(e + 1) % 8], zP, ctr);
    const t0 = s * 0.006, H = zW - zP;
    if (e % 2 === 0) {
      // main face: the pishtaq
      const a = len / 2 - s * 0.115, c = len / 2 + s * 0.115, top = H + s * 0.045, pd = s * 0.012;
      w.proud(a, 0, c, top, pd, p.marble, p.shade);
      pishtaq(K, e, oct, ctr, zP, pd, len, p, s, H);
      // flanking bays: two stacked pointed niches each side
      for (const [sa, sc] of [[s * 0.018, a - s * 0.018], [c + s * 0.018, len - s * 0.018]]) {
        const m = (sa + sc) / 2, hw = Math.min((sc - sa) / 2, s * 0.028);
        w.arch(m - hw, m + hw, t0 + s * 0.012, H * 0.3, 0.003, p.niche, p.shade, { seg: 6, pointed: true, rise: s * 0.035, frame: s * 0.004 });
        w.arch(m - hw, m + hw, H * 0.52, H * 0.78, 0.003, p.niche, p.shade, { seg: 6, pointed: true, rise: s * 0.035, frame: s * 0.004 });
      }
    } else {
      // chamfer: stacked niches
      const m = len / 2, hw = len * 0.3;
      w.arch(m - hw, m + hw, t0 + s * 0.012, H * 0.3, 0.003, p.niche, p.shade, { seg: 6, pointed: true, rise: s * 0.038, frame: s * 0.004 });
      w.arch(m - hw, m + hw, H * 0.52, H * 0.78, 0.003, p.niche, p.shade, { seg: 6, pointed: true, rise: s * 0.038, frame: s * 0.004 });
    }
  }
  // pinnacles (guldastas): at the octagon's vertices and the pishtaq edges
  const pinnacle = (u, v, zb, h, r) => {
    K.lathe(u, v, [[r, zb], [r * 0.85, zb + h * 0.78]], 6, p.marble);
    K.lathe(u, v, [[r * 1.3, zb + h * 0.78], [r * 1.2, zb + h * 0.86], [0, zb + h]], 6, p.marble);
  };
  for (const [u, v] of oct) pinnacle(u, v, zW, s * 0.045, s * 0.007);
  for (let e = 0; e < 8; e += 2) {
    const A = oct[e], B = oct[e + 1], du = B[0] - A[0], dv = B[1] - A[1], l = dmath.hypot(du, dv);
    const nu = dv / l, nv = -du / l, sg = ((A[0] + B[0]) / 2 - cu) * nu + ((A[1] + B[1]) / 2 - cv) * nv < 0 ? -1 : 1;
    for (const f of [l / 2 - s * 0.115, l / 2 + s * 0.115]) {
      pinnacle(A[0] + du / l * f + nu * sg * s * 0.012, A[1] + dv / l * f + nv * sg * s * 0.012, zW + s * 0.045, s * 0.04, s * 0.008);
    }
  }

  // drum, onion dome, lotus crown, finial
  const rD = s * 0.138, zD = zW + s * 0.085;
  K.lathe(cu, cv, [[rD * 1.04, zW], [rD * 1.04, zW + s * 0.008], [rD, zW + s * 0.01], [rD, zD - s * 0.008], [rD * 1.04, zD - s * 0.004], [rD * 1.04, zD]], 24, p.marble);
  const hD = s * 0.3;
  const ON = [[1.0, 0], [1.14, 0.08], [1.22, 0.2], [1.2, 0.33], [1.08, 0.47], [0.84, 0.62], [0.54, 0.76], [0.28, 0.87], [0.12, 0.95]];
  K.lathe(cu, cv, ON.map(([r, t]) => [rD * r, zD + hD * t]), 24, p.marble);
  const zL = zD + hD * 0.95;
  // lotus: petals folded over the crown
  K.lathe(cu, cv, [[rD * 0.2, zL - hD * 0.03], [rD * 0.1, zL + hD * 0.02], [0, zL + hD * 0.035]], 12, (i) => (i % 2 ? p.marbleWarm : p.shade));
  const zF = zL + hD * 0.035, fr = s * 0.012;
  K.lathe(cu, cv, [[fr * 0.5, zF], [fr, zF + s * 0.012], [fr * 0.3, zF + s * 0.024], [fr * 0.9, zF + s * 0.034], [fr * 0.3, zF + s * 0.045], [fr * 0.25, zF + s * 0.07], [0, zF + s * 0.085]], 6, p.gold);

  // four chhatris round the dome
  const dd = s * 0.192, rc = s * 0.046;
  for (const [su, sv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const u = cu + su * dd, v = cv + sv * dd;
    K.lathe(u, v, [[rc * 1.1, zW], [rc * 1.1, zW + s * 0.01]], 8, p.marble, { capTop: p.marble });
    const z1 = zW + s * 0.01, hp = s * 0.05;
    K.lathe(u, v, [[rc, z1], [rc, z1 + hp]], 16, (i) => (i % 2 ? p.iwan : p.marble));
    K.lathe(u, v, [[rc, z1 + hp], [rc * 1.3, z1 + hp + s * 0.004], [rc * 1.3, z1 + hp + s * 0.009], [rc * 0.9, z1 + hp + s * 0.01]], 12, p.marble);
    const zd = z1 + hp + s * 0.01, hd = s * 0.06;
    K.lathe(u, v, [[rc * 0.9, zd], [rc * 1.0, zd + hd * 0.25], [rc * 0.78, zd + hd * 0.55], [rc * 0.35, zd + hd * 0.85], [0, zd + hd]], 12, p.marble);
    K.lathe(u, v, [[s * 0.004, zd + hd - s * 0.004], [s * 0.004, zd + hd + s * 0.018], [0, zd + hd + s * 0.024]], 4, p.gold);
  }
  return K.faces;
}

/** A pishtaq's face on its own proud plane: the pointed iwan in its rectangular calligraphy frame. */
function pishtaq(K, e, oct, ctr, zP, pd, len, p, s, H) {
  const { w } = edgeWall(K, oct[e], oct[(e + 1) % 8], zP, ctr, pd);
  const m = len / 2, iw = s * 0.066;
  // calligraphy frame: the dark inlay band round the iwan
  const fa = m - s * 0.088, fc = m + s * 0.088, ft = H + s * 0.025, fb = s * 0.006;
  w.rect(fa, s * 0.004, fa + fb, ft, p.inlay, 0.002);
  w.rect(fc - fb, s * 0.004, fc, ft, p.inlay, 0.002);
  w.rect(fa, ft - fb, fc, ft, p.inlay, 0.002);
  // the iwan: a tall pointed arch, and the inner portal inside it
  w.arch(m - iw, m + iw, s * 0.004, H * 0.66, 0.02, p.iwan, p.shade, { seg: 8, pointed: true, rise: s * 0.09, frame: s * 0.005 });
  w.arch(m - iw * 0.45, m + iw * 0.45, s * 0.004, H * 0.3, 0.004, scaleHex(p.iwan, 0.8), null, { seg: 6, pointed: true, rise: s * 0.03 });
  w.recess(m - iw * 0.5, H * 0.45, m + iw * 0.5, H * 0.58, 0.003, scaleHex(p.iwan, 0.85), null);
}

// ── GREAT PYRAMID ────────────────────────────────────────────────────────────────────────────
// Khufu as it stands: the casing stripped, a limestone mass whose read is its horizontal course
// banding (a riser and a tread per course, thicker courses at the foot), the truncated top, the
// entrance on the north face (the gabled chevron and Al-Ma'mun's robbers' tunnel), and the three
// queens' pyramids as low ruined step-mounds along the east side.
const PYR = { lime: '#d6c197', limeDark: '#c4ab80', limeLight: '#e6d4ad', plateau: '#c7b491', plateauTop: '#d4c29d', hole: '#4a3d2b' };
function greatPyramid(b, ctx) {
  const K = localKit(b, ctx), { s, Lu, Dv } = K, p = PYR;
  const cu = Lu / 2, cv = Dv / 2;
  K.box(cu - s / 2, cv - s / 2, 0, cu + s / 2, cv + s / 2, s * 0.008, { side: p.plateau, top: p.plateauTop });
  const zb = s * 0.008;
  // main pyramid, pushed west to leave the queens a strip on the east
  const a = s * 0.4, pu = cu - s * 0.07, pv = cv, H0 = 2 * a * 0.636, N = 34, stop = 0.955;
  const zAt = (k) => H0 * stop * (1 - dmath.pow(1 - k / N, 1.22));
  const hwAt = (z) => a * (1 - z / H0);
  const tone = (k) => {
    // a designed rhythm: every fourth course a hair darker, a slow drift lighter toward the top
    const base = k % 4 === 3 ? p.limeDark : p.lime;
    return mixHex(base, p.limeLight, Math.min(0.5, k / N * 0.5) + (k % 7 === 2 ? 0.12 : 0));
  };
  // each course: a band a touch steeper than the ideal face (so it reads as a mass, not a ziggurat)
  // and a narrow lit tread where the next course steps back
  const run = (a * stop) / N, dl = run * 0.32;
  const sq = (h, z) => [[pu - h, pv - h, zb + z], [pu + h, pv - h, zb + z], [pu + h, pv + h, zb + z], [pu - h, pv + h, zb + z]];
  for (let k = 0; k < N; k++) {
    const za = zAt(k), zc = zAt(k + 1), tint = tone(k), inside = [pu, pv, zb + (za + zc) / 2];
    const lo = sq(hwAt(za) + (k === 0 ? dl : 0), za), hi = sq(hwAt(zc) + dl, zc), inn = sq(hwAt(zc), zc);
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; K.quad([lo[i], lo[j], hi[j], hi[i]], tint, inside); }
    if (k + 1 < N) for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; K.quad([hi[i], hi[j], inn[j], inn[i]], mixHex(tint, p.limeLight, 0.5), { dir: [0, 0, 1] }); }
    else K.quad(hi, mixHex(tint, p.limeLight, 0.35), { dir: [0, 0, 1] });
  }
  // the truncated top: a few ragged blocks and the survey mast
  const zTop = zb + zAt(N), ht = hwAt(zAt(N));
  K.box(pu - ht * 0.6, pv - ht * 0.5, zTop, pu + ht * 0.2, pv + ht * 0.4, zTop + s * 0.012, p.limeDark);
  K.box(pu - s * 0.002, pv - s * 0.002, zTop, pu + s * 0.002, pv + s * 0.002, zTop + s * 0.05, '#6d6250');
  // north face entrance: a proud gabled block over a dark mouth, and the robbers' tunnel lower down
  const ze = H0 * 0.13, off = s * 0.012;
  const northAt = (z) => pv + hwAt(z) + off;
  const slopeQ = (u0, u1, za, zc, tint) => K.quad([[u0, northAt(za), zb + za], [u1, northAt(za), zb + za], [u1, northAt(zc), zb + zc], [u0, northAt(zc), zb + zc]], tint, { dir: [0, 1, 0.8] });
  slopeQ(pu - s * 0.022, pu + s * 0.022, ze - s * 0.012, ze + s * 0.05, p.limeLight);
  slopeQ(pu - s * 0.009, pu + s * 0.009, ze - s * 0.004, ze + s * 0.02, p.hole);
  const zg = ze + s * 0.022, vg = northAt(zg) + s * 0.002;
  K.tri([pu - s * 0.02, vg, zb + zg], [pu + s * 0.02, vg, zb + zg], [pu, northAt(zg + s * 0.024) + s * 0.002, zb + zg + s * 0.024], p.limeDark, { dir: [0, 1, 0.8] });
  slopeQ(pu + s * 0.012, pu + s * 0.026, H0 * 0.055, H0 * 0.075, p.hole);

  // queens' pyramids: ruined step mounds on the east strip
  const qu = pu + a + s * 0.085, qa = s * 0.05;
  for (const [qv, hq, steps] of [[cv - s * 0.3, s * 0.058, 4], [cv - s * 0.16, s * 0.05, 4], [cv - s * 0.02, s * 0.034, 3]]) {
    for (let k = 0; k < steps; k++) {
      const hw = qa * (1 - k / (steps + 0.6)), za = zb + hq * (k / steps), zc = zb + hq * ((k + 1) / steps);
      K.box(qu - hw, qv - hw, za, qu + hw, qv + hw, zc, { side: k % 2 ? p.limeDark : p.lime, top: p.limeLight });
    }
  }
  // the east temple's basalt pavement stub on the causeway line
  K.box(pu + a + s * 0.01, cv + s * 0.1, zb, pu + a + s * 0.07, cv + s * 0.2, zb + s * 0.004, { side: '#5e5a52', top: '#6d6960' });
  return K.faces;
}

// ── LOUVRE PYRAMID ───────────────────────────────────────────────────────────────────────────
// Pei's glass pyramid on the Cour Napoléon: a steel-framed rhombus grid (two families of mullions
// parallel to the face's raking edges, so the base row closes in triangles), a granite curb, the
// three pyramidions standing in their basins on the north, south and east, the dark reflecting
// water round the court, and the entrance canopy on the west.
const LOUVRE = {
  pave: '#cbc5b7', paveTop: '#d9d3c5', curb: '#8a8c88', curbTop: '#a4a6a1', water: '#5d7580', coping: '#bdb7a8',
  glass: '#9fb8c2', glassSky: '#b4cad3', steelTone: '#667073',
};
/** A glass pyramid: four faces, a mullion grid of `n` bars per family, heavier hip ribs. */
function glassPyramid(K, pu, pv, a, zb, H, n, p) {
  const c = [[pu - a, pv - a, zb], [pu + a, pv - a, zb], [pu + a, pv + a, zb], [pu - a, pv + a, zb]];
  const T = [pu, pv, zb + H], ctr = [pu, pv, zb + H * 0.25];
  const lerp = (A, B, t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
  const plus = (A, d, t) => [A[0] + d[0] * t, A[1] + d[1] * t, A[2] + d[2] * t];
  const sub = (A, B) => [A[0] - B[0], A[1] - B[1], A[2] - B[2]];
  const steel = p.steelTone, hip = scaleHex(p.steelTone, 0.85);
  for (let f = 0; f < 4; f++) {
    const A = c[f], B = c[(f + 1) % 4];
    const e1 = sub(B, A), e2 = sub(T, A);
    let nn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const l = dmath.hypot(...nn); nn = nn.map((x) => x / l);
    if ((A[0] + B[0]) / 2 * nn[0] + (A[1] + B[1]) / 2 * nn[1] - (pu * nn[0] + pv * nn[1]) < 0) nn = nn.map((x) => -x);
    K.tri(A, B, T, f === 0 ? p.glassSky : p.glass, ctr);
    const bar = (P0, P1, w, tint) => {
      const d = sub(P1, P0), dl = dmath.hypot(...d) || 1;
      const sd = [nn[1] * d[2] - nn[2] * d[1], nn[2] * d[0] - nn[0] * d[2], nn[0] * d[1] - nn[1] * d[0]].map((x) => (x / dl) * w / 2);
      const up = (P, k) => [P[0] + sd[0] * k + nn[0] * w * 0.4, P[1] + sd[1] * k + nn[1] * w * 0.4, P[2] + sd[2] * k + nn[2] * w * 0.4];
      K.quad([up(P0, -1), up(P0, 1), up(P1, 1), up(P1, -1)], tint, ctr);
    };
    const W = a * 0.012;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const P = lerp(A, B, t); bar(P, plus(P, e2, 1 - t), W, steel);
      const Q = lerp(B, A, t); bar(Q, plus(Q, sub(T, B), 1 - t), W, steel);
    }
    bar(A, T, W * 2.2, hip);
    bar(A, B, W * 2.2, hip);
  }
}
function louvrePyramid(b, ctx) {
  const K = localKit(b, ctx), { s, Lu, Dv } = K, p = LOUVRE;
  const cu = Lu / 2, cv = Dv / 2, h = s / 2, zP = s * 0.008;
  K.box(cu - h, cv - h, 0, cu + h, cv + h, zP, { side: p.pave, top: p.paveTop });
  const a = s * 0.35, H = 2 * a * 0.61, zc = zP + s * 0.014;
  // granite curb
  K.box(cu - a - s * 0.018, cv - a - s * 0.018, zP, cu + a + s * 0.018, cv + a + s * 0.018, zc, { side: p.curb, top: p.curbTop });
  glassPyramid(K, cu, cv, a, zc, H, 14, p);
  // the basins: water in the ring between the curb and the court edge, broken by the pyramidions
  // (N, S, E) and the entrance walk (W), with paved diagonals from the pyramid's corners
  const r0 = a + s * 0.045, r1 = h - s * 0.03, gap = s * 0.05, zw = zP + s * 0.0015;
  const water = (u0, v0, u1, v1) => {
    K.quad([[u0, v0, zw + 0.0004 * s], [u1, v0, zw + 0.0004 * s], [u1, v1, zw + 0.0004 * s], [u0, v1, zw + 0.0004 * s]], p.coping, { dir: [0, 0, 1] });
    const e = s * 0.006;
    K.quad([[u0 + e, v0 + e, zw + 0.001 * s], [u1 - e, v0 + e, zw + 0.001 * s], [u1 - e, v1 - e, zw + 0.001 * s], [u0 + e, v1 - e, zw + 0.001 * s]], p.water, { dir: [0, 0, 1] });
  };
  for (const sg of [-1, 1]) {
    for (const hs of [-1, 1]) {
      const m0 = hs < 0 ? -r1 + gap * 0.6 : gap, m1 = hs < 0 ? -gap : r1 - gap * 0.6;
      water(cu + m0, cv + sg * r0, cu + m1, cv + sg * r1);           // south / north strips
      water(cu + sg * r0, cv + m0, cu + sg * r1, cv + m1);           // west / east strips
    }
  }
  // pyramidions: small glass pyramids standing in the basins
  const pa = s * 0.036, pH = 2 * pa * 0.66, rm = (r0 + r1) / 2;
  for (const [u, v] of [[cu, cv - rm], [cu, cv + rm], [cu + rm, cv]]) {
    K.box(u - pa - s * 0.006, v - pa - s * 0.006, zP, u + pa + s * 0.006, v + pa + s * 0.006, zP + s * 0.008, { side: p.curb, top: p.curbTop });
    glassPyramid(K, u, v, pa, zP + s * 0.008, pH, 4, p);
  }
  // west entrance: the steel-and-glass canopy over the stair
  const eu = cu - a - s * 0.018;
  K.box(eu - s * 0.07, cv - s * 0.028, zP, eu - s * 0.005, cv + s * 0.028, zP + s * 0.004, { side: p.curb, top: '#3b4245' });
  K.box(eu - s * 0.06, cv - s * 0.024, zP + s * 0.034, eu - s * 0.005, cv + s * 0.024, zP + s * 0.038, { side: p.steelTone, top: p.glassSky });
  for (const dv of [-0.022, 0.022]) K.box(eu - s * 0.058, cv + dv * s - s * 0.002, zP, eu - s * 0.054, cv + dv * s + s * 0.002, zP + s * 0.034, p.steelTone);
  return K.faces;
}

// ── MESOAMERICAN PYRAMID (Teotihuacan) ────────────────────────────────────────────────────────
// Stacked talud-tablero terraces: a battered talud under a vertical tablero that overhangs it, the
// tablero a framed, recessed panel. A broad staircase with alfarda balustrades climbs the front face
// to the summit platform, where the temple stands on its own talud-tablero base with its doorways
// between pillars and a flat roof with a crest of merlons.
const TEO = {
  stone: '#a39583', stoneLight: '#b9ab96', stoneDark: '#8a7c69', frame: '#b3a58f', panel: '#7d705f',
  stair: '#b8ab95', stairRiser: '#968874', alfarda: '#a99b85', temple: '#a88f78', templeTop: '#bda892',
  door: '#3c332a', plaza: '#9f937f', plazaTop: '#aea28d', stucco: '#9c6a58',
};
function mexicanPyramid(b, ctx) {
  const K = localKit(b, ctx), { s, Lu, Dv } = K, p = TEO;
  const cu = Lu / 2, cv = Dv / 2, h = s / 2;
  K.box(cu - h, cv - h, 0, cu + h, cv + h, s * 0.006, { side: p.plaza, top: p.plazaTop });
  const TIERS = 4, th = s * 0.097, talH = th * 0.56, tabH = th - talH, batter = s * 0.052, over = s * 0.008, walk = s * 0.03;
  let hw = h - s * 0.03, z = s * 0.006;
  const sw = s * 0.085;   // staircase half-width
  const tiers = [];
  for (let k = 0; k < TIERS; k++) {
    // talud: a battered skirt
    const top = hw - batter;
    const sq = (r, zz) => [[cu - r, cv - r, zz], [cu + r, cv - r, zz], [cu + r, cv + r, zz], [cu - r, cv + r, zz]];
    const lo = sq(hw, z), hi = sq(top, z + talH);
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; K.quad([lo[i], lo[j], hi[j], hi[i]], p.stone, [cu, cv, z]); }
    // tablero: a vertical box overhanging the talud, its faces framed panels
    const tb = top + over, za = z + talH, zc = za + tabH;
    K.box(cu - tb, cv - tb, za, cu + tb, cv + tb, zc, { side: p.frame, top: p.stoneLight });
    const W = K.walls(cu - tb, cv - tb, cu + tb, cv + tb, za);
    for (const side of ['front', 'right', 'back', 'left']) {
      const w = W[side], L0 = W.len[side], fb = tabH * 0.2;
      // panels between frame posts; the front leaves the stair's width free
      const segs = side === 'front' ? [[0, L0 / 2 - sw - s * 0.012], [L0 / 2 + sw + s * 0.012, L0]] : [[0, L0]];
      for (const [a0, a1] of segs) {
        const nP = Math.max(1, Math.round((a1 - a0) / (s * 0.16)));
        for (let q = 0; q < nP; q++) {
          const x0 = a0 + (a1 - a0) * q / nP + fb, x1 = a0 + (a1 - a0) * (q + 1) / nP - fb;
          w.recess(x0, fb, x1, tabH - fb, fb * 0.8, p.panel, null);
        }
      }
      w.proud(0, tabH - fb * 0.6, L0, tabH, fb * 0.35, p.stoneLight);   // the cornice lip of the frame
    }
    tiers.push({ z, zc, hw, tb });
    z = zc;
    hw = tb - walk;
  }
  // summit platform
  const zs = z, ps = hw + walk;
  // the staircase: a proud flight up the front face, riser + tread, with alfardas
  const vFoot = cv - (h - s * 0.03) - s * 0.012, vTop = cv - ps + s * 0.004, steps = 26;
  const run = (vTop - vFoot) / steps, rise = (zs - s * 0.006) / steps;
  for (let i = 0; i < steps; i++) {
    const v0 = vFoot + run * i, zA = s * 0.006 + rise * i;
    K.quad([[cu - sw, v0, zA], [cu + sw, v0, zA], [cu + sw, v0, zA + rise], [cu - sw, v0, zA + rise]], p.stairRiser, { dir: [0, -1, 0] });
    K.quad([[cu - sw, v0, zA + rise], [cu + sw, v0, zA + rise], [cu + sw, v0 + run, zA + rise], [cu - sw, v0 + run, zA + rise]], p.stair, { dir: [0, 0, 1] });
  }
  const aw = s * 0.018, ah = s * 0.012;
  for (const sg of [-1, 1]) {
    const u0 = cu + sg * sw, u1 = cu + sg * (sw + aw);
    const zF = s * 0.006, zT = zs;
    // the alfarda: a sloped slab riding over the steps, and its outer cheek wall down to the tiers
    K.quad([[u0, vFoot, zF + ah], [u1, vFoot, zF + ah], [u1, vTop, zT + ah], [u0, vTop, zT + ah]], p.alfarda, { dir: [0, -0.7, 0.7] });
    K.quad([[u1, vFoot, zF], [u1, vFoot, zF + ah], [u1, vTop, zT + ah], [u1, vTop, zT]], scaleHex(p.alfarda, 0.94), { dir: [sg, 0, 0] });
    K.quad([[u0, vFoot, zF], [u0, vFoot, zF + ah], [u0, vTop, zT + ah], [u0, vTop, zT]], scaleHex(p.alfarda, 0.94), { dir: [-sg, 0, 0] });
    K.quad([[u0, vFoot, zF], [u1, vFoot, zF], [u1, vFoot, zF + ah], [u0, vFoot, zF + ah]], p.alfarda, { dir: [0, -1, 0] });
    // the cheek wall that carries the flight: a triangle down to the tiers
    K.tri([u1, vFoot, zF], [u1, vTop, zF], [u1, vTop, zT], scaleHex(p.stone, 0.96), { dir: [sg, 0, 0] });
  }
  // temple: its own low talud-tablero base, walls with three doorways, a flat roof, merlons
  const tu = s * 0.12, tv = s * 0.085, tvC = cv + s * 0.01, zt0 = zs, tb0 = s * 0.028;
  K.prism([[cu - tu - s * 0.012, tvC - tv - s * 0.012], [cu + tu + s * 0.012, tvC - tv - s * 0.012], [cu + tu + s * 0.006, tvC + tv + s * 0.006], [cu - tu - s * 0.006, tvC + tv + s * 0.006]], zt0, zt0 + tb0 * 0.5, p.stone, { cap: p.stoneLight });
  K.box(cu - tu, tvC - tv, zt0 + tb0 * 0.5, cu + tu, tvC + tv, zt0 + tb0, { side: p.frame, top: p.stoneLight });
  const zw0 = zt0 + tb0, zw1 = zw0 + s * 0.068;
  const iu = tu * 0.9, iv = tv * 0.86;
  K.box(cu - iu, tvC - iv, zw0, cu + iu, tvC + iv, zw1, { side: p.temple, top: p.templeTop });
  const TW = K.walls(cu - iu, tvC - iv, cu + iu, tvC + iv, zw0);
  const fl = TW.len.front;
  for (let q = 0; q < 3; q++) {
    const m = fl * (q + 1) / 4, dw = fl * 0.085;
    TW.front.recess(m - dw, 0.0005, m + dw, (zw1 - zw0) * 0.72, s * 0.01, p.door, null);
  }
  TW.right.recess(TW.len.right * 0.4, 0.0005, TW.len.right * 0.6, (zw1 - zw0) * 0.66, s * 0.01, p.door, null);
  TW.left.recess(TW.len.left * 0.4, 0.0005, TW.len.left * 0.6, (zw1 - zw0) * 0.66, s * 0.01, p.door, null);
  // the painted stucco band under the roof (the red of Teotihuacan, weathered)
  TW.front.rect(0, (zw1 - zw0) * 0.8, fl, (zw1 - zw0) * 0.95, p.stucco, 0.002);
  const zr = zw1 + s * 0.014;
  K.box(cu - tu - s * 0.008, tvC - tv - s * 0.008, zw1, cu + tu + s * 0.008, tvC + tv + s * 0.008, zr, { side: p.stoneDark, top: p.templeTop });
  // merlons along the roof edge (front and back)
  const nm = 7, mh = s * 0.03, mw = (2 * tu) / nm;
  for (let q = 0; q < nm; q++) {
    const u0 = cu - tu + mw * q + mw * 0.2, u1 = cu - tu + mw * (q + 1) - mw * 0.2;
    for (const vv of [tvC - tv, tvC + tv - s * 0.014]) K.box(u0, vv, zr, u1, vv + s * 0.014, zr + mh, { side: p.stoneLight, top: p.stoneLight });
  }
  void tiers;
  return K.faces;
}

// ── STONEHENGE ───────────────────────────────────────────────────────────────────────────────
// The monument as it stands: the sarsen circle of dressed uprights under its lintel ring, with the
// real gaps and a surviving run of lintels on the north-east; the five trilithons in a horseshoe
// opening to the north-east (the great trilithon's lintel fallen, one leaf of another down); the
// bluestone circle and horseshoe; the altar stone; the heel stone out on the avenue; the henge bank
// and ditch with the entrance gap. Stone heights are lifted ~1.6× so the ring reads at city scale.
const HENGE = {
  sarsen: '#a09c8d', sarsenWarm: '#aaa38f', sarsenCool: '#949589', lichen: '#9c9d86', blue: '#7d8286', altar: '#8f8b7d',
  grass: '#858d70', grassTop: '#8d9677', bank: '#8c9573', ditch: '#6e765b', path: '#b0a994',
};
// sarsen circle state: 30 uprights, clockwise from the axis. S = standing, L = leaning, F = fallen, - = gone.
const SARSEN_STATE = 'SSSSSSSSF-SS-F-S-F-SLS-F--SSSS';
// lintels in place over the gaps between upright i and i + 1 (the north-east run and one on the south-west)
const SARSEN_LINTELS = new Set([0, 1, 2, 3, 4, 5, 6, 10, 26, 27, 28, 29]);
function stonehenge(b, ctx) {
  const K = localKit(b, ctx), { s, Lu, Dv } = K, p = HENGE;
  const cu = s * 0.5 + (Lu - s) * 0.12, cv = Dv / 2;
  const axis = dmath.atan2(0.62, 0.78);   // north-east: toward +u, a little toward +v (either footprint lay)
  const ax = [dmath.cos(axis), dmath.sin(axis)];
  // ground: a grass plate over the whole lot
  K.box(0.001, 0.001, 0, Lu - 0.001, Dv - 0.001, s * 0.004, { side: p.grass, top: p.grassTop });
  const zg = s * 0.004;
  // the henge: ditch (outer, darker) and bank (inner, a low rounded rise), with the NE entrance gap
  const rB = s * 0.44, nB = 44, gapA = 0.3;
  const angOf = (i) => (i / nB) * Math.PI * 2;
  const rel = (a) => { let d = a - axis; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
  const annulus = (r0, r1, z, tint) => {
    for (let i = 0; i < nB; i++) {
      const a0 = angOf(i), a1 = angOf(i + 1);
      if (Math.abs(rel((a0 + a1) / 2)) < gapA / 2) continue;
      const P = (r, a) => [cu + dmath.cos(a) * r, cv + dmath.sin(a) * r, z];
      K.quad([P(r0, a0), P(r0, a1), P(r1, a1), P(r1, a0)], tint, { dir: [0, 0, 1] });
    }
  };
  annulus(rB + s * 0.012, rB + s * 0.04, zg + s * 0.0006, p.ditch);
  for (let i = 0; i < nB; i++) {
    const a0 = angOf(i), a1 = angOf(i + 1);
    if (Math.abs(rel((a0 + a1) / 2)) < gapA / 2) continue;
    K.lathe(cu, cv, [[rB + s * 0.01, zg], [rB, zg + s * 0.01], [rB - s * 0.022, zg]], 1, p.bank, { a0, a1 });
  }
  // the avenue: a pale track out from the entrance, and the heel stone on it
  const out = (r, off = 0) => [cu + ax[0] * r - ax[1] * off, cv + ax[1] * r + ax[0] * off];
  const tr = (r, off) => [...out(r, off), zg + s * 0.0008];
  const rEnd = Math.min((Lu - cu - s * 0.05 * Math.abs(ax[1])) / ax[0], (Dv - cv - s * 0.05 * ax[0]) / Math.abs(ax[1])) - s * 0.015;
  K.quad([tr(rB - s * 0.02, -s * 0.05), tr(rEnd, -s * 0.05), tr(rEnd, s * 0.05), tr(rB - s * 0.02, s * 0.05)], p.path, { dir: [0, 0, 1] });
  // stones: sizes lifted for the city read
  const k = s / 18 * 1.0;          // metres → local, one metre of the real stone at s = 18
  const rS = s * 0.28, upH = s * 0.17, upW = s * 0.038, upT = s * 0.024, linH = s * 0.026;
  const stone = (u, v, yaw, a, c, za, zb, tint, opts) => K.obox(u, v, yaw, a, c, za, zb, tint, opts);
  const tone = (i) => [p.sarsen, p.sarsenWarm, p.sarsenCool, p.lichen][(i * 7) % 4];
  const N = 30, ang = (i) => axis + (i / N) * Math.PI * 2 * -1 + Math.PI / N;
  for (let i = 0; i < N; i++) {
    const st = SARSEN_STATE[i], a = ang(i), u = cu + dmath.cos(a) * rS, v = cv + dmath.sin(a) * rS, yaw = a + Math.PI / 2;
    if (st === 'S') stone(u, v, yaw, upW / 2, upT / 2, zg, zg + upH * (1 - ((i * 5) % 3) * 0.02), tone(i), { top: 0.88 });
    else if (st === 'L') stone(u, v, yaw, upW / 2, upT / 2, zg, zg + upH * 0.95, tone(i), { top: 0.88, lean: [dmath.cos(a) * s * 0.03, dmath.sin(a) * s * 0.03] });
    else if (st === 'F') {
      // lying where it fell, across the ring's line, broken in two
      const r2 = rS + upH * 0.3, f = (i % 2 ? 1 : -1);
      stone(cu + dmath.cos(a) * r2, cv + dmath.sin(a) * r2, a + Math.PI / 2 + f * 0.5, upH * 0.3, upW / 2, zg, zg + upT * 0.9, tone(i), {});
      stone(cu + dmath.cos(a + f * 0.06) * (r2 + upH * 0.25), cv + dmath.sin(a + f * 0.06) * (r2 + upH * 0.25), a + f * 0.9, upH * 0.14, upW * 0.45, zg, zg + upT * 0.8, tone(i + 1), {});
    }
  }
  for (const i of SARSEN_LINTELS) {
    const j = (i + 1) % N;
    if (SARSEN_STATE[i] !== 'S' || SARSEN_STATE[j] !== 'S') continue;
    const a = (ang(i) + ang(j)) / 2, rl = rS;
    const half = rS * dmath.sin(Math.PI / N) + upW * 0.45;
    stone(cu + dmath.cos(a) * rl, cv + dmath.sin(a) * rl, a + Math.PI / 2, half, upT * 0.55, zg + upH * 0.96, zg + upH * 0.96 + linH, p.sarsenWarm, {});
  }
  // the trilithon horseshoe, opening to the axis: [angle off the back, radius, height, state]
  const TRI = [[-1.25, 0.64, 0.84, 'S'], [-0.68, 0.6, 0.94, 'S'], [0, 0.56, 1.12, 'G'], [0.68, 0.6, 0.94, 'S'], [1.25, 0.64, 0.84, 'H']];
  for (const [off, rf, hf, st] of TRI) {
    const a = axis + Math.PI + off, r = rS * rf, u = cu + dmath.cos(a) * r, v = cv + dmath.sin(a) * r, t = a + Math.PI / 2;
    const tu = [dmath.cos(t), dmath.sin(t)], H = upH * 1.25 * hf, lw = upW * 0.66, gapT = upW * 0.5;
    const legs = [-1, 1].map((sg) => [u + tu[0] * sg * (lw + gapT / 2), v + tu[1] * sg * (lw + gapT / 2)]);
    if (st === 'S') {
      for (const [lu, lv] of legs) stone(lu, lv, t, lw, upT * 0.7, zg, zg + H, p.sarsen, { top: 0.9 });
      stone(u, v, t, lw * 2 + gapT / 2 + upW * 0.1, upT * 0.62, zg + H, zg + H + linH * 1.2, p.sarsenWarm, {});
    } else if (st === 'G') {
      // the great trilithon: one leaf standing tall and leaning in, the lintel and the other leaf down
      stone(legs[1][0], legs[1][1], t, lw, upT * 0.7, zg, zg + H, p.sarsenCool, { top: 0.88, lean: [-dmath.cos(a) * s * 0.012, -dmath.sin(a) * s * 0.012] });
      stone(u - dmath.cos(a) * H * 0.3, v - dmath.sin(a) * H * 0.3, a, H * 0.42, lw, zg, zg + upT * 0.8, p.sarsen, {});
      stone(legs[0][0] + dmath.cos(a) * s * 0.02, legs[0][1] + dmath.sin(a) * s * 0.02, t + 0.25, lw * 2, upT * 0.6, zg, zg + linH, p.sarsenWarm, {});
    } else {
      // a half-fallen trilithon: one leaf up, its lintel propped against the ground
      stone(legs[0][0], legs[0][1], t, lw, upT * 0.7, zg, zg + H * 0.96, p.sarsen, { top: 0.9 });
      stone(legs[1][0] - dmath.cos(a) * s * 0.03, legs[1][1] - dmath.sin(a) * s * 0.03, a + 0.3, H * 0.38, lw, zg, zg + upT * 0.9, p.sarsenCool, {});
    }
  }
  // bluestones: an outer circle inside the sarsens and an inner horseshoe (a fixed pattern of stumps)
  const BLUE_C = [1, 0.8, 0, 1, 0.6, 0, 0.9, 1, 0, 0.5, 0.8, 0, 1, 0, 0.7, 0.9, 0, 0.6, 1, 0.8, 0, 0.7, 1, 0, 0.5, 0.9];
  const rBl = rS * 0.82, bh = upH * 0.42;
  BLUE_C.forEach((f, i) => {
    if (!f) return;
    const a = axis + (i / BLUE_C.length) * Math.PI * 2 + 0.08;
    stone(cu + dmath.cos(a) * rBl, cv + dmath.sin(a) * rBl, a + Math.PI / 2, upW * 0.24, upT * 0.3, zg, zg + bh * f, p.blue, { top: 0.8 });
  });
  const BLUE_H = [0.9, 1, 0.7, 1, 1.1, 1, 0.8, 1, 0.9];
  BLUE_H.forEach((f, i) => {
    const a = axis + Math.PI + (i / (BLUE_H.length - 1) - 0.5) * 3.0, r = rS * (0.4 - 0.06 * dmath.cos((i / (BLUE_H.length - 1) - 0.5) * 3.0));
    stone(cu + dmath.cos(a) * r, cv + dmath.sin(a) * r, a + Math.PI / 2, upW * 0.17, upT * 0.28, zg, zg + bh * 1.2 * f, p.blue, { top: 0.75 });
  });
  // altar stone, fallen flat inside the great trilithon
  stone(cu - ax[0] * rS * 0.33, cv - ax[1] * rS * 0.33, axis + Math.PI / 2 + 0.2, upW * 1.4, upW * 0.35, zg, zg + s * 0.008, p.altar, {});
  // slaughter stone in the entrance, heel stone out on the avenue
  const sl = out(rB + s * 0.005, s * 0.015);
  stone(sl[0], sl[1], axis + 1.2, upW * 0.9, upW * 0.3, zg, zg + s * 0.007, p.sarsenCool, {});
  const hs = out(Math.min(rEnd - s * 0.03, rB + s * 0.16), s * 0.012);
  stone(hs[0], hs[1], axis + 0.4, upW * 0.62, upW * 0.5, zg, zg + upH * 0.82, p.sarsenWarm, { top: 0.55, lean: [ax[0] * -s * 0.02, ax[1] * -s * 0.02] });
  void k;
  return K.faces;
}

// ── CHINATOWN GATE (paifang) ─────────────────────────────────────────────────────────────────
// A three-bay gate: four red columns on granite bases with clasping drum stones, painted beams
// with the central plaque between them, a band of dougong brackets under each roof, and the
// hipped, glazed-tile roofs with concave slopes and upturned corners (the central roof high and
// broad, the side roofs lower), ridge beams ending in curled ornaments.
const GATE = {
  red: '#8f3b30', redDark: '#6c2c25', gold: '#b8964d', jade: '#3f6e62', blue: '#3e5a68', tile: '#41796a',
  tileDark: '#2f5a4f', ridge: '#35634f', granite: '#a29e93', graniteTop: '#b3afa3', plaque: '#24363a', paving: '#a8a397',
};
/**
 * A hip roof with a concave slope and upturned corners over [u0, u1] × [vc − dh, vc + dh]: eaves at
 * zE lifting by `up` toward the corners, a ridge at zR, `m` segments per slope. Returns nothing.
 */
function hipRoof(K, { u0, u1, vc, dh, zE, zR, up, ext, sag, m = 6, tint, fascia, ridge, horn }) {
  const uc = (u0 + u1) / 2, hk = Math.min(dh * 0.6, (u1 - u0) / 2 - 1e-6);
  const r0 = [u0 + hk, vc, zR], r1 = [u1 - hk, vc, zR];
  const cor = [[u0, vc - dh], [u1, vc - dh], [u1, vc + dh], [u0, vc + dh]];
  const inside = [uc, vc, zE - dh];
  const eave = (P, Q, t, outN) => {
    const c = dmath.pow(Math.abs(2 * t - 1), 3), sg = Math.sign(2 * t - 1);
    const du = Q[0] - P[0], dv = Q[1] - P[1], l = dmath.hypot(du, dv);
    return [P[0] + du * t + outN[0] * ext * c + (du / l) * sg * ext * c * 0.6, P[1] + dv * t + outN[1] * ext * c + (dv / l) * sg * ext * c * 0.6, zE + up * c];
  };
  const edges = [[0, 1, [0, -1], r0, r1], [1, 2, [1, 0], r1, r1], [2, 3, [0, 1], r1, r0], [3, 0, [-1, 0], r0, r0]];
  const mix = (A, B, t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
  for (const [a, bq, outN, RA, RB] of edges) {
    const P = cor[a], Q = cor[bq];
    const E = [], Mid = [], R = [];
    for (let i = 0; i <= m; i++) {
      const t = i / m, e = eave(P, Q, t, outN), r = mix(RA, RB, t);
      const mm = mix(e, r, 0.42); mm[2] -= sag;
      E.push(e); Mid.push(mm); R.push(r);
    }
    for (let i = 0; i < m; i++) {
      const shade = i % 2 ? tint : scaleHex(tint, 0.97);
      K.quad([E[i], E[i + 1], Mid[i + 1], Mid[i]], shade, inside);
      if (RA === RB) K.tri(Mid[i], Mid[i + 1], RA, shade, inside);
      else K.quad([Mid[i], Mid[i + 1], R[i + 1], R[i]], shade, inside);
      // the fascia board under the eave edge
      if (fascia) K.quad([E[i], E[i + 1], [E[i + 1][0], E[i + 1][1], E[i + 1][2] - fascia.h], [E[i][0], E[i][1], E[i][2] - fascia.h]], fascia.tint, { dir: [outN[0], outN[1], 0] });
    }
    // the hip ridge along the corner line
    if (ridge) {
      const w = ridge.w * 0.6, a0 = E[0], a1 = RA;
      K.quad([[a0[0], a0[1], a0[2] + w], [a1[0], a1[1], a1[2] + w], [a1[0], a1[1], a1[2]], [a0[0], a0[1], a0[2]]], ridge.tint, { dir: [outN[0] - outN[1], outN[1] + outN[0], 0.3] });
    }
  }
  if (ridge) {
    const w = ridge.w;
    K.box(r0[0] - w, vc - w * 0.6, zR - w * 0.3, r1[0] + w, vc + w * 0.6, zR + w * 1.6, { side: ridge.tint, top: scaleHex(ridge.tint, 1.1) });
    if (horn) for (const [R, sg] of [[r0, -1], [r1, 1]]) {
      // the curled ridge-end ornament (chiwen): a fin rising and curling outward
      K.quad([[R[0] - sg * w, vc, zR + w * 1.6], [R[0] + sg * w * 1.2, vc, zR + w * 1.6], [R[0] + sg * w * 2.4, vc, zR + horn], [R[0] + sg * w * 0.6, vc, zR + horn * 0.9]], ridge.tint, { dir: [0, -1, 0] });
    }
  }
}
function chinatownGate(b, ctx) {
  const K = localKit(b, ctx), { s, Lu: G, Dv: D } = K, p = GATE;
  const vc = D / 2;
  // a paved threshold under the gate
  K.box(G * 0.02, vc - s * 0.3, 0, G * 0.98, vc + s * 0.3, s * 0.008, { side: p.paving, top: scaleHex(p.paving, 1.05) });
  const z0 = s * 0.008;
  const cols = [[G * 0.105, s * 0.034, s * 0.56], [G * 0.3, s * 0.045, s * 0.8], [G * 0.7, s * 0.045, s * 0.8], [G * 0.895, s * 0.034, s * 0.56]];
  for (const [u, r, top] of cols) {
    // granite base, clasping drum stones front and back, the red column
    K.box(u - r * 1.5, vc - r * 1.5, z0, u + r * 1.5, vc + r * 1.5, z0 + s * 0.06, { side: p.granite, top: p.graniteTop });
    K.box(u - r * 0.8, vc - r * 3.4, z0, u + r * 0.8, vc + r * 3.4, z0 + s * 0.05, { side: p.granite, top: p.graniteTop });
    for (const sg of [-1, 1]) K.lathe(u, vc + sg * r * 2.5, [[r * 0.7, z0 + s * 0.05], [r * 0.85, z0 + s * 0.07], [r * 0.7, z0 + s * 0.09]], 8, p.granite, { capTop: p.graniteTop });
    K.lathe(u, vc, [[r, z0 + s * 0.06], [r, top]], 10, p.red);
    K.lathe(u, vc, [[r * 1.1, z0 + s * 0.06], [r * 1.1, z0 + s * 0.075]], 10, p.gold);
  }
  // beams: painted jade and blue with gilt edges
  const beam = (u0, u1, za, zb, tint, dep) => {
    K.box(u0, vc - dep, za, u1, vc + dep, zb, { side: tint, top: scaleHex(tint, 1.05), bottom: scaleHex(tint, 0.8) });
    for (const sg of [-1, 1]) {
      const vv = vc + sg * (dep + s * 0.002);
      for (const zz of [za + (zb - za) * 0.08, zb - (zb - za) * 0.16]) K.quad([[u0, vv, zz], [u1, vv, zz], [u1, vv, zz + (zb - za) * 0.08], [u0, vv, zz + (zb - za) * 0.08]], p.gold, { dir: [0, sg, 0] });
    }
  };
  // dougong: a row of bracket sets under an eave, front and back
  const brackets = (u0, u1, za, zb, dep, n) => {
    K.box(u0, vc - dep * 0.8, za, u1, vc + dep * 0.8, za + (zb - za) * 0.35, { side: p.blue, top: p.blue });
    for (let i = 0; i < n; i++) {
      const u = u0 + (u1 - u0) * (i + 0.5) / n, w = (u1 - u0) / n * 0.3;
      K.box(u - w * 0.6, vc - dep, za + (zb - za) * 0.35, u + w * 0.6, vc + dep, za + (zb - za) * 0.65, { side: i % 2 ? p.jade : p.blue, top: p.gold });
      K.box(u - w, vc - dep * 1.25, za + (zb - za) * 0.65, u + w, vc + dep * 1.25, zb, { side: p.gold, top: p.redDark });
    }
  };
  // side bays
  for (const [ua, ub] of [[cols[0][0], cols[1][0]], [cols[2][0], cols[3][0]]]) {
    beam(ua, ub, s * 0.44, s * 0.49, p.jade, s * 0.035);
    K.box(ua, vc - s * 0.02, s * 0.49, ub, vc + s * 0.02, s * 0.515, { side: p.red, top: p.red });
    brackets(ua - s * 0.02, ub + s * 0.02, s * 0.515, s * 0.575, s * 0.05, 4);
  }
  // central bay: lower beam, plaque panel, upper beam
  const cu0 = cols[1][0], cu1 = cols[2][0], gm = G / 2;
  beam(cu0, cu1, s * 0.5, s * 0.56, p.jade, s * 0.04);
  K.box(cu0, vc - s * 0.02, s * 0.56, cu1, vc + s * 0.02, s * 0.7, { side: p.red, top: p.red });
  beam(cu0, cu1, s * 0.7, s * 0.76, p.blue, s * 0.042);
  // the plaque, proud on both faces: a dark board in a gilt frame
  const pw = (cu1 - cu0) * 0.3;
  for (const sg of [-1, 1]) {
    const w = sg < 0 ? K.wall([gm - pw, vc - s * 0.02, s * 0.575], [1, 0, 0], [0, 0, 1], [0, -1, 0]) : K.wall([gm + pw, vc + s * 0.02, s * 0.575], [-1, 0, 0], [0, 0, 1], [0, 1, 0]);
    w.proud(0, 0, pw * 2, s * 0.11, s * 0.012, p.gold);
    w.rect(pw * 0.1, s * 0.012, pw * 1.9, s * 0.098, p.plaque, s * 0.0125);
    // four characters, as gilt marks
    for (let q = 0; q < 4; q++) w.rect(pw * (0.3 + q * 0.4) - pw * 0.1, s * 0.035, pw * (0.3 + q * 0.4) + pw * 0.1, s * 0.075, p.gold, s * 0.013);
  }
  brackets(cu0 - s * 0.03, cu1 + s * 0.03, s * 0.76, s * 0.83, s * 0.055, 7);
  // roofs: the side pair lower, the central roof high and broad
  const fas = { h: s * 0.018, tint: p.redDark };
  for (const [ua, ub] of [[G * 0.012, cols[1][0] + s * 0.06], [cols[2][0] - s * 0.06, G * 0.988]]) {
    hipRoof(K, { u0: ua + G * 0.012, u1: ub - G * 0.012, vc, dh: s * 0.2, zE: s * 0.59, zR: s * 0.68, up: s * 0.035, ext: G * 0.012, sag: s * 0.018, m: 5, tint: p.tile, fascia: fas, ridge: { w: s * 0.014, tint: p.ridge }, horn: s * 0.05 });
  }
  hipRoof(K, { u0: cu0 - s * 0.14, u1: cu1 + s * 0.14, vc, dh: s * 0.25, zE: s * 0.85, zR: s * 0.98, up: s * 0.045, ext: G * 0.014, sag: s * 0.024, m: 7, tint: p.tile, fascia: fas, ridge: { w: s * 0.018, tint: p.ridge }, horn: s * 0.075 });
  // the pearl on the ridge
  K.lathe(gm, vc, [[s * 0.012, s * 1.008], [s * 0.028, s * 1.03], [s * 0.012, s * 1.055], [0, s * 1.07]], 8, p.gold);
  return K.faces;
}

// ── ARC DE TRIOMPHE ──────────────────────────────────────────────────────────────────────────
// Real see-through geometry: four piers split by the transverse arches, the great barrel vault
// (coffered) and the transverse vaults, archivolts and keystones. On the pier faces the four
// sculpture groups on their pedestals (carved as bevelled bosses, so the relief turns to the light)
// and the bas-relief panels above them; the impost band; the entablature with its figured frieze;
// the heavy cornice; the attic with its row of shields and top cornice. Proportions from the
// monument (45 × 22 × 50 m).
const ARC = {
  stone: '#e0d8c6', stoneLight: '#ebe4d4', stoneDark: '#a9a08a', vault: '#b8ae9b', coffer: '#8f8672',
  carve: '#d6cbb3', recess: '#6b6353', pave: '#b7b1a3', paveTop: '#c4beb0', flame: '#c28a4c',
};
/** A bevelled boss on a wall frame: a proud face inset `bev` inside its footprint, four chamfers down to the wall. */
function boss(w, s0, t0, s1, t1, d, bev, tint) {
  const f = [w.at(s0 + bev, t0 + bev, d), w.at(s1 - bev, t0 + bev, d), w.at(s1 - bev, t1 - bev, d), w.at(s0 + bev, t1 - bev, d)];
  const g = [w.at(s0, t0, 0.001), w.at(s1, t0, 0.001), w.at(s1, t1, 0.001), w.at(s0, t1, 0.001)];
  return { f, g };
}
function arcDeTriomphe(b, ctx) {
  const K = localKit(b, ctx), { s, Lu, Dv } = K, p = ARC;
  const cu = Lu / 2, cv = Dv / 2;
  K.box(cu - s / 2, cv - s / 2, 0, cu + s / 2, cv + s / 2, s * 0.005, { side: p.pave, top: p.paveTop });
  const W = s * 0.97, uL = cu - W / 2, D = W * 0.49, vF = cv - D / 2, zb = s * 0.005;
  const U = (x) => uL + x * W, Vv = (y) => vF + y * W, Z = (z) => zb + z * W;
  // key proportions (× W)
  const tv0 = 0.1515, tv1 = 0.3385, rT = (tv1 - tv0) / 2, zsT = 0.3215;   // transverse arch
  const gu0 = 0.338, gu1 = 0.662, rG = (gu1 - gu0) / 2, zsG = 0.488;     // great arch
  const zE = 0.71, dep = 0.49;
  const seg = 12;
  const inside = [cu, cv, Z(0.5)];
  // ── piers ──
  for (const [a, c, side] of [[0, gu0, -1], [gu1, 1, 1]]) {
    const pin = [U((a + c) / 2), cv, Z(0.3)];
    // front and back faces of the pier, full height to the entablature
    for (const [y, ny] of [[0, -1], [dep, 1]]) K.quad([[U(a), Vv(y), Z(0)], [U(c), Vv(y), Z(0)], [U(c), Vv(y), Z(zE)], [U(a), Vv(y), Z(zE)]], p.stone, { dir: [0, ny, 0] });
    // the outer side face (to the entablature) and the inner face (to the great arch springing)
    const outerU = side < 0 ? a : c, innerU = side < 0 ? c : a;
    for (const [x, top, nx] of [[outerU, zE, side], [innerU, zsG, -side]]) {
      for (const [y0, y1] of [[0, tv0], [tv1, dep]]) K.quad([[U(x), Vv(y0), Z(0)], [U(x), Vv(y1), Z(0)], [U(x), Vv(y1), Z(top)], [U(x), Vv(y0), Z(top)]], p.stone, { dir: [nx, 0, 0] });
      // spandrel over the transverse arch
      for (let i = 0; i < seg; i++) {
        const y0 = tv0 + (tv1 - tv0) * i / seg, y1 = tv0 + (tv1 - tv0) * (i + 1) / seg;
        const h0 = zsT + Math.sqrt(Math.max(0, rT * rT - (y0 - tv0 - rT) ** 2)), h1 = zsT + Math.sqrt(Math.max(0, rT * rT - (y1 - tv0 - rT) ** 2));
        K.quad([[U(x), Vv(y0), Z(h0)], [U(x), Vv(y1), Z(h1)], [U(x), Vv(y1), Z(top)], [U(x), Vv(y0), Z(top)]], p.stone, { dir: [nx, 0, 0] });
      }
    }
    // the transverse tunnel: its two jamb walls and the barrel soffit
    for (const [y, ny] of [[tv0, 1], [tv1, -1]]) K.quad([[U(a), Vv(y), Z(0)], [U(c), Vv(y), Z(0)], [U(c), Vv(y), Z(zsT)], [U(a), Vv(y), Z(zsT)]], p.vault, { dir: [0, ny, 0] });
    for (let i = 0; i < seg; i++) {
      const a0 = Math.PI * i / seg, a1 = Math.PI * (i + 1) / seg;
      const y0 = tv0 + rT - dmath.cos(a0) * rT, y1 = tv0 + rT - dmath.cos(a1) * rT, h0 = zsT + dmath.sin(a0) * rT, h1 = zsT + dmath.sin(a1) * rT;
      K.quad([[U(a), Vv(y0), Z(h0)], [U(c), Vv(y0), Z(h0)], [U(c), Vv(y1), Z(h1)], [U(a), Vv(y1), Z(h1)]], p.vault, [U((a + c) / 2), Vv(tv0 + rT), Z(zsT)]);
    }
    void pin;
  }
  // ── the great arch: spandrels on both facades and the coffered barrel vault ──
  const gseg = 16;
  for (const [y, ny] of [[0, -1], [dep, 1]]) {
    for (let i = 0; i < gseg; i++) {
      const x0 = gu0 + (gu1 - gu0) * i / gseg, x1 = gu0 + (gu1 - gu0) * (i + 1) / gseg;
      const h0 = zsG + Math.sqrt(Math.max(0, rG * rG - (x0 - gu0 - rG) ** 2)), h1 = zsG + Math.sqrt(Math.max(0, rG * rG - (x1 - gu0 - rG) ** 2));
      K.quad([[U(x0), Vv(y), Z(h0)], [U(x1), Vv(y), Z(h1)], [U(x1), Vv(y), Z(zE)], [U(x0), Vv(y), Z(zE)]], p.stone, { dir: [0, ny, 0] });
    }
    // archivolt: a proud moulded ring round the arch, and the keystone
    const pr = 0.006;
    for (let i = 0; i < gseg; i++) {
      const a0 = Math.PI * i / gseg, a1 = Math.PI * (i + 1) / gseg;
      const P = (ang, r) => [U(0.5 - dmath.cos(ang) * r), Vv(y + ny * pr), Z(zsG + dmath.sin(ang) * r)];
      K.quad([P(a0, rG), P(a1, rG), P(a1, rG + 0.022), P(a0, rG + 0.022)], p.stoneLight, { dir: [0, ny, 0] });
    }
    K.quad([[U(0.485), Vv(y + ny * 0.01), Z(zsG + rG - 0.01)], [U(0.515), Vv(y + ny * 0.01), Z(zsG + rG - 0.01)], [U(0.522), Vv(y + ny * 0.01), Z(zsG + rG + 0.045)], [U(0.478), Vv(y + ny * 0.01), Z(zsG + rG + 0.045)]], p.carve, { dir: [0, ny, 0] });
  }
  for (let i = 0; i < gseg; i++) {
    const a0 = Math.PI * i / gseg, a1 = Math.PI * (i + 1) / gseg;
    const x0 = 0.5 - dmath.cos(a0) * rG, x1 = 0.5 - dmath.cos(a1) * rG, h0 = zsG + dmath.sin(a0) * rG, h1 = zsG + dmath.sin(a1) * rG;
    K.quad([[U(x0), Vv(0), Z(h0)], [U(x1), Vv(0), Z(h1)], [U(x1), Vv(dep), Z(h1)], [U(x0), Vv(dep), Z(h0)]], p.vault, [U(0.5), Vv(dep / 2), Z(zsG)]);
    // coffers: a darker sunk square in each bay of the vault (every other segment, five rows)
    if (i % 2 === 1) for (let r = 0; r < 5; r++) {
      const ya = 0.03 + r * 0.09, yb = ya + 0.06, k = 0.985;
      const q = (x, h, yy) => [U(0.5 + (x - 0.5) * k), Vv(yy), Z(zsG + (h - zsG) * k)];
      K.quad([q(x0, h0, ya), q(x1, h1, ya), q(x1, h1, yb), q(x0, h0, yb)], p.coffer, [U(0.5), Vv(dep / 2), Z(zsG)]);
    }
  }
  // ── pier ornament: base course, impost band, sculpture groups, bas-relief panels ──
  const faceWalls = [];
  for (const [a, c] of [[0, gu0], [gu1, 1]]) {
    faceWalls.push({ w: K.wall([U(a), Vv(0), Z(0)], [1, 0, 0], [0, 0, 1], [0, -1, 0]), len: (c - a) * W });
    faceWalls.push({ w: K.wall([U(c), Vv(dep), Z(0)], [-1, 0, 0], [0, 0, 1], [0, 1, 0]), len: (c - a) * W });
  }
  // a sculpture group as a pyramidal heap of figures: [x0, y0, x1, y1, depth] in fractions of its field
  const GROUP = [
    [0.04, 0.0, 0.3, 0.2, 0.5], [0.7, 0.0, 0.96, 0.24, 0.55], [0.14, 0.0, 0.36, 0.46, 0.75], [0.62, 0.02, 0.84, 0.5, 0.7],
    [0.34, 0.0, 0.54, 0.64, 1.0], [0.5, 0.04, 0.68, 0.58, 0.9], [0.26, 0.4, 0.46, 0.7, 0.6], [0.54, 0.46, 0.72, 0.72, 0.65],
    [0.4, 0.62, 0.58, 0.84, 0.8], [0.2, 0.76, 0.42, 0.92, 0.4], [0.56, 0.8, 0.8, 0.96, 0.4], [0.44, 0.82, 0.54, 1.0, 0.7],
  ];
  const drawBoss = (w, s0, t0, s1, t1, d, tint) => {
    const bev = Math.min(s1 - s0, t1 - t0) * 0.34, { f, g } = boss(w, s0, t0, s1, t1, d, bev, tint);
    K.kit.quad(f, tint, { dir: w.n });
    const lt = [scaleHex(tint, 0.9), tint, scaleHex(tint, 1.05), tint];
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; K.kit.quad([g[i], g[j], f[j], f[i]], lt[i], w.at((s0 + s1) / 2, (t0 + t1) / 2, -d)); }
  };
  faceWalls.forEach(({ w, len }, idx) => {
    const wS = W;
    w.proud(-0.004 * wS, 0, len + 0.004 * wS, 0.035 * wS, 0.006 * wS, p.stoneDark);                 // base course
    w.proud(-0.004 * wS, (zsG - 0.022) * wS, len + 0.004 * wS, zsG * wS, 0.008 * wS, p.stoneLight);   // impost band
    // the sculpture group on its pedestal
    const gw = len * 0.62, g0 = (len - gw) / 2;
    w.proud(g0, 0.035 * wS, g0 + gw, 0.1 * wS, 0.03 * wS, p.stoneLight);
    const t0 = 0.1 * wS, t1 = 0.37 * wS, mirror = idx % 2 === 1;
    for (const [x0, y0, x1, y1, dd] of GROUP) {
      const a = mirror ? 1 - x1 : x0, c = mirror ? 1 - x0 : x1;
      drawBoss(w, g0 + gw * a, t0 + (t1 - t0) * y0, g0 + gw * c, t0 + (t1 - t0) * y1, 0.012 * wS + dd * 0.018 * wS, p.carve);
    }
    // the bas-relief panel above: a framed field with a row of low figures
    const r0 = 0.52 * wS, r1 = 0.66 * wS, pa = len * 0.12, pc = len * 0.88;
    w.proud(pa, r0, pc, r0 + 0.012 * wS, 0.008 * wS, p.stoneLight);
    w.proud(pa, r1 - 0.012 * wS, pc, r1, 0.008 * wS, p.stoneLight);
    w.proud(pa, r0, pa + 0.012 * wS, r1, 0.008 * wS, p.stoneLight);
    w.proud(pc - 0.012 * wS, r0, pc, r1, 0.008 * wS, p.stoneLight);
    w.rect(pa + 0.012 * wS, r0 + 0.012 * wS, pc - 0.012 * wS, r1 - 0.012 * wS, scaleHex(p.stone, 0.9), 0.002);
    // a crowd of figures standing on one ground line, heads nearly level, overlapping in depth
    const FIG = [[0.92, 0.5], [1, 0.9], [0.95, 0.6], [0.88, 1], [1, 0.7], [0.9, 0.5], [0.97, 0.9], [0.93, 0.6], [1, 0.8], [0.9, 0.5]];
    const fw = (pc - pa - 0.03 * wS) / FIG.length;
    FIG.forEach(([h, dd], q) => {
      const fx0 = pa + 0.015 * wS + fw * q - fw * 0.1, fx1 = fx0 + fw * 1.1;
      drawBoss(w, fx0, r0 + 0.016 * wS, fx1, r0 + 0.016 * wS + (r1 - r0 - 0.034 * wS) * h, 0.004 * wS + 0.006 * wS * dd, p.carve);
    });
  });
  // side faces: base course, impost, the relief panel over the transverse arch
  for (const [x, nx] of [[0, -1], [1, 1]]) {
    const w = nx < 0 ? K.wall([U(0), Vv(dep), Z(0)], [0, -1, 0], [0, 0, 1], [-1, 0, 0]) : K.wall([U(1), Vv(0), Z(0)], [0, 1, 0], [0, 0, 1], [1, 0, 0]);
    const len = dep * W;
    for (const [y0, y1] of [[0, tv0], [tv1, dep]]) w.proud(y0 * W - 0.004 * W, 0, y1 * W + 0.004 * W, 0.035 * W, 0.006 * W, p.stoneDark);
    w.proud(-0.004 * W, (zsG - 0.022) * W, len + 0.004 * W, zsG * W, 0.008 * W, p.stoneLight);
    const r0 = 0.52 * W, r1 = 0.66 * W, pa = len * 0.12, pc = len * 0.88;
    w.proud(pa, r0, pc, r1, 0.006 * W, p.stoneLight);
    w.rect(pa + 0.012 * W, r0 + 0.012 * W, pc - 0.012 * W, r1 - 0.012 * W, scaleHex(p.stone, 0.9), 0.0065 * W);
    [0.9, 0.75, 1, 0.8].forEach((h, q) => {
      const fx0 = pa + 0.02 * W + (pc - pa - 0.04 * W) * q / 4;
      drawBoss(w, fx0, r0 + 0.02 * W, fx0 + (pc - pa - 0.04 * W) / 4 * 0.78, r0 + 0.02 * W + (r1 - r0 - 0.04 * W) * h, 0.014 * W, p.carve);
    });
    // archivolt round the transverse arch
    for (let i = 0; i < seg; i++) {
      const a0 = Math.PI * i / seg, a1 = Math.PI * (i + 1) / seg, o = 0.005 * W;
      const P = (ang, r) => w.at(len / 2 - dmath.cos(ang) * r * W * (nx < 0 ? 1 : 1), (zsT + dmath.sin(ang) * r) * W, o);
      K.kit.quad([P(a0, rT), P(a1, rT), P(a1, rT + 0.018), P(a0, rT + 0.018)], p.stoneLight, { dir: w.n });
    }
    void x;
  }
  // ── entablature: architrave, figured frieze, cornice; the attic with its shields ──
  const band = (z0b, z1b, out, tint) => K.box(U(0) - out * W, Vv(0) - out * W, Z(z0b), U(1) + out * W, Vv(dep) + out * W, Z(z1b), tint);
  band(zE, 0.735, 0.004, { side: p.stoneLight, top: p.stone });
  band(0.735, 0.80, 0.0, { side: p.stone, top: p.stone });
  band(0.80, 0.815, 0.008, { side: p.stoneLight, top: p.stone, bottom: p.stoneDark });
  band(0.815, 0.845, 0.016, { side: p.stoneLight, top: p.stoneLight, bottom: p.stoneDark });
  band(0.845, 1.045, 0.0, { side: p.stone, top: p.stone });
  band(1.045, 1.075, 0.012, { side: p.stoneLight, top: p.stoneLight, bottom: p.stoneDark });
  band(1.075, 1.105, -0.01, { side: p.stone, top: p.stoneLight });
  const ents = [
    { w: K.wall([U(0), Vv(0), Z(0)], [1, 0, 0], [0, 0, 1], [0, -1, 0]), len: W },
    { w: K.wall([U(1), Vv(dep), Z(0)], [-1, 0, 0], [0, 0, 1], [0, 1, 0]), len: W },
    { w: K.wall([U(0), Vv(dep), Z(0)], [0, -1, 0], [0, 0, 1], [-1, 0, 0]), len: dep * W },
    { w: K.wall([U(1), Vv(0), Z(0)], [0, 1, 0], [0, 0, 1], [1, 0, 0]), len: dep * W },
  ];
  const FRIEZE = [1, 0.8, 0.9, 1, 0.7, 0.95, 0.85, 1, 0.75, 0.9];
  for (const { w, len } of ents) {
    // frieze: a procession of figures, a designed rhythm of low bosses
    const n = Math.round(len / (0.035 * W));
    for (let q = 0; q < n; q++) {
      const h = FRIEZE[q % FRIEZE.length], x0 = len * q / n + len / n * 0.15, x1 = len * (q + 1) / n - len / n * 0.15;
      drawBoss(w, x0, 0.742 * W, x1, (0.742 + 0.05 * h) * W, 0.006 * W, p.carve);
    }
    // attic: a recessed panel strip, the band of shields, pilaster strips at the ends
    w.proud(0, 0.845 * W, len, 0.87 * W, 0.005 * W, p.stoneLight);
    w.rect(0.04 * W, 0.885 * W, len - 0.04 * W, 0.92 * W, scaleHex(p.stone, 0.92), 0.002);
    const ns = Math.max(3, Math.round(len / (0.1 * W)));
    for (let q = 0; q < ns; q++) {
      const sc = len * (q + 0.5) / ns, sz = 0.975 * W, r = 0.024 * W, pts = [];
      for (let k = 0; k < 8; k++) { const ang = (k / 8) * Math.PI * 2 + Math.PI / 8; pts.push(w.at(sc + dmath.cos(ang) * r, sz + dmath.sin(ang) * r, 0.006 * W)); }
      K.kit.poly(pts, p.stoneLight, { dir: w.n });
      K.kit.poly(pts.map((P, k) => { const c = w.at(sc, sz, 0.0065 * W); return [c[0] + (P[0] - c[0]) * 0.55, c[1] + (P[1] - c[1]) * 0.55, c[2] + (P[2] - c[2]) * 0.55]; }), p.carve, { dir: w.n });
    }
    w.proud(0, 0.845 * W, 0.03 * W, 1.045 * W, 0.006 * W, p.stoneLight);
    w.proud(len - 0.03 * W, 0.845 * W, len, 1.045 * W, 0.006 * W, p.stoneLight);
  }
  // the tomb of the unknown soldier under the vault
  K.box(U(0.46), Vv(0.2), Z(0), U(0.54), Vv(0.29), Z(0.006), { side: p.recess, top: '#5c574c' });
  K.lathe(U(0.5), Vv(0.245), [[0.008 * W, Z(0.006) - zb], [0.003 * W, Z(0.03) - zb], [0, Z(0.04) - zb]], 5, p.flame);
  void inside;
  return K.faces;
}

// ── PARTHENON ────────────────────────────────────────────────────────────────────────────────
// The temple as it stands: the three-step crepidoma, the Doric peristyle of 8 × 17 fluted columns
// (echinus and abacus), the architrave, the triglyph-and-metope frieze and the geison; no roof.
// The west pediment survives with its raking cornice and a few corner figures; the east keeps
// only broken raking stubs. The south flank has lost columns and its entablature over the gap
// (the 1687 explosion). Inside, the cella walls stand full height at the west (with the great door)
// and step down to low courses; the west porch columns stand, the east porch is stumps.
const PARTH = {
  marble: '#ece3d0', marbleLight: '#f4eee1', weather: '#dccdae', shadow: '#b3a68b', recess: '#6d6450',
  step: '#ddd3be', stepTop: '#e8e0cd', rock: '#a79d8b', rockTop: '#b6ad9b', fresh: '#f5f2ea',
};
function parthenon(b, ctx) {
  const K = localKit(b, ctx), { s, Lu, Dv } = K, p = PARTH;
  const k = Math.min(s / 35.6, Lu / 74.2);          // metres of the real temple → local
  const Ws = 30.88 * k, Ls = 69.5 * k, cu = Lu / 2, cv = Dv / 2;
  const u0 = cu - Ls / 2, v0 = cv - Ws / 2;
  // the Acropolis rock under it, then the three steps
  K.box(cu - Ls / 2 - 2.2 * k, cv - Ws / 2 - 2.2 * k, 0, cu + Ls / 2 + 2.2 * k, cv + Ws / 2 + 2.2 * k, 0.25 * k, { side: p.rock, top: p.rockTop });
  let z = 0.25 * k;
  for (let i = 2; i >= 0; i--) {
    const o = (i + 0.0) * 0.7 * k;
    K.box(u0 - o, v0 - o, z, u0 + Ls + o, v0 + Ws + o, z + 0.51 * k, { side: p.step, top: p.stepTop });
    z += 0.51 * k;
  }
  const zS = z;                                     // stylobate top
  const colH = 10.43 * k, r = 0.95 * k, inset = 1.05 * k;
  const zC = zS + colH;
  const column = (u, v, h, rr, tint, band2 = tint) => {
    const hs = h - 0.85 * k * (h / colH);
    K.lathe(u, v, [[rr, zS], [rr * 0.93, zS + hs * 0.5], [rr * 0.78, zS + hs]], 12, (i, kk) => {
      const t = kk === 0 ? tint : band2;
      return i % 2 ? t : scaleHex(t, 0.92);
    });
    if (h >= colH * 0.98) {
      K.lathe(u, v, [[rr * 0.78, zS + hs], [rr * 1.14, zS + hs + 0.42 * k * (h / colH)]], 12, p.marble);
      K.box(u - rr * 1.18, v - rr * 1.18, zS + hs + 0.42 * k, u + rr * 1.18, v + rr * 1.18, zS + h, { side: p.marble, top: p.marbleLight });
    } else {
      K.lathe(u, v, [[rr * (0.93 - 0.15 * (h / colH)), zS + hs], [0.001, zS + hs + 0.001]], 12, p.weather);
    }
  };
  // the peristyle: 17 along the flanks, 8 across the ends
  const nL = 17, nW = 8;
  const cuAt = (i) => u0 + inset + (Ls - 2 * inset) * i / (nL - 1);
  const cvAt = (j) => v0 + inset + (Ws - 2 * inset) * j / (nW - 1);
  const GAP = new Set([8]);                        // lost from the south flank
  const STUB = { 7: 0.34, 9: 0.2 };                // broken shafts beside the gap
  // restored drums (fresh Pentelic) on a few shafts, the rest weathered warm; a designed pattern
  const tintOf = (i, j) => ((i * 3 + j * 5) % 11 === 0 ? p.fresh : p.marble);
  for (let i = 0; i < nL; i++) for (const j of [0, nW - 1]) {
    if (j === 0 && GAP.has(i)) continue;
    const h = j === 0 && STUB[i] ? colH * STUB[i] : colH;
    column(cuAt(i), cvAt(j), h, i === 0 || i === nL - 1 ? r * 1.03 : r, mixHex(p.marble, p.weather, 0.45), tintOf(i, j));
  }
  for (let j = 1; j < nW - 1; j++) for (const i of [0, nL - 1]) column(cuAt(i), cvAt(j), colH, r, mixHex(p.marble, p.weather, 0.45), tintOf(i, j));
  // fallen drums on the stylobate by the gap
  for (const [du, dv, yaw] of [[7.5, 2.6, 0.3], [8.3, 3.4, -0.5], [8.9, 2.2, 1.1]]) {
    const u = cuAt(0) + (cuAt(1) - cuAt(0)) * du, v = v0 + dv * k;
    K.obox(u, v, yaw, 0.8 * k, 0.8 * k, zS, zS + 1.5 * k, p.weather, {});
  }
  // ── entablature: architrave, frieze with triglyphs, geison ──
  const ab = r * 1.18, aOut = inset - ab;           // outer face of the architrave from the stylobate edge
  const zA = zC + 1.35 * k, zF = zA + 1.35 * k, zG = zF + 0.6 * k;
  const ring = [                                    // [u0, v0, u1, v1, face] per side; the south split by the gap
    [u0 + aOut, v0 + aOut, u0 + Ls - aOut, v0 + aOut + 2 * ab, 'north'],
  ];
  void ring;
  const gapU0 = cuAt(7) - r * 0.2, gapU1 = cuAt(9) + r * 0.2;
  const sides = [
    { a: u0 + aOut, c: gapU0, v: v0 + aOut, face: 'front', cut: [false, true] },
    { a: gapU1, c: u0 + Ls - aOut, v: v0 + aOut, face: 'front', cut: [true, false] },
    { a: u0 + aOut, c: u0 + Ls - aOut, v: v0 + Ws - aOut - 2 * ab, face: 'back', cut: [false, false] },
  ];
  const deep = 2 * ab;
  for (const { a, c, v, cut } of sides) {
    // stepped ruin at a cut end: the architrave reaches further than the frieze, the frieze than the geison
    const ca = cut[0] ? 0 : 0, cc = cut[1] ? 0 : 0;
    K.box(a - ca, v, zC, c + cc, v + deep, zA, { side: p.marble, top: p.marble, bottom: p.shadow });
    K.box(a + (cut[0] ? 1.2 * k : 0), v + 0.08 * k, zA, c - (cut[1] ? 1.2 * k : 0), v + deep - 0.08 * k, zF, { side: p.marble, top: p.marble });
    K.box(a - (cut[0] ? -2.6 * k : 0.3 * k), v - 0.3 * k, zF, c + (cut[1] ? -2.6 * k : 0.3 * k), v + deep + 0.3 * k, zG, { side: p.marbleLight, top: p.marbleLight, bottom: p.shadow });
  }
  for (const u of [u0 + aOut, u0 + Ls - aOut - deep]) {
    K.box(u, v0 + aOut, zC, u + deep, v0 + Ws - aOut, zA, { side: p.marble, top: p.marble, bottom: p.shadow });
    K.box(u + 0.08 * k, v0 + aOut + 0.08 * k, zA, u + deep - 0.08 * k, v0 + Ws - aOut - 0.08 * k, zF, { side: p.marble, top: p.marble });
    K.box(u - (u < cu ? 0.3 * k : -0.3 * k) * 0 - 0.3 * k, v0 + aOut - 0.3 * k, zF, u + deep + 0.3 * k, v0 + Ws - aOut + 0.3 * k, zG, { side: p.marbleLight, top: p.marbleLight, bottom: p.shadow });
  }
  // triglyphs over every column and every intercolumniation, the corner ones pushed to the corner
  const trig = (w, len, cols, skip) => {
    const tw = 0.84 * k, pos = [];
    for (let i = 0; i < cols.length; i++) {
      pos.push(cols[i]);
      if (i + 1 < cols.length) pos.push((cols[i] + cols[i + 1]) / 2);
    }
    pos[0] = tw / 2; pos[pos.length - 1] = len - tw / 2;
    pos.forEach((x) => {
      if (skip && skip(x)) return;
      w.proud(x - tw / 2, zA + 0.08 * k - w.base, x + tw / 2, zF - 0.05 * k - w.base, 0.1 * k, p.shadow, scaleHex(p.shadow, 0.9));
      w.rect(x - tw * 0.08, zA + 0.2 * k - w.base, x + tw * 0.08, zF - 0.15 * k - w.base, p.recess, 0.105 * k);
    });
  };
  // frieze wall frames (outer faces, at the frieze plane)
  const fu0 = u0 + aOut + 0.08 * k, fu1 = u0 + Ls - aOut - 0.08 * k, fv0 = v0 + aOut + 0.08 * k, fv1 = v0 + Ws - aOut - 0.08 * k;
  const colU = Array.from({ length: nL }, (_, i) => cuAt(i) - fu0), colV = Array.from({ length: nW }, (_, j) => cvAt(j) - fv0);
  const mk = (o, uu, nn) => Object.assign(K.wall(o, uu, [0, 0, 1], nn), { base: 0 });
  trig(mk([fu0, fv0, 0], [1, 0, 0], [0, -1, 0]), fu1 - fu0, colU, (x) => x + fu0 > gapU0 + 1.0 * k && x + fu0 < gapU1 - 1.0 * k);
  trig(mk([fu1, fv1, 0], [-1, 0, 0], [0, 1, 0]), fu1 - fu0, colU.map((x) => fu1 - fu0 - x).reverse(), null);
  trig(mk([fu0, fv1, 0], [0, -1, 0], [-1, 0, 0]), fv1 - fv0, colV.map((x) => fv1 - fv0 - x).reverse(), null);
  trig(mk([fu1, fv0, 0], [0, 1, 0], [1, 0, 0]), fv1 - fv0, colV, null);
  // ── pediments: west whole, east broken ──
  const rise = 3.55 * k, pd = 1.0 * k;
  for (const [ue, dir, whole] of [[u0 + aOut, 1, true], [u0 + Ls - aOut, -1, false]]) {
    const va = v0 + aOut - 0.3 * k, vb = v0 + Ws - aOut + 0.3 * k, vm = (va + vb) / 2, zt = zG + rise;
    const face = ue + dir * 0.35 * k;               // tympanum set back behind the cornice line
    const inside = [ue + dir * 3 * k, vm, zG];
    const out = { dir: [-dir, 0, 0] };
    if (whole) {
      K.tri([face, va + 0.6 * k, zG], [face, vb - 0.6 * k, zG], [face, vm, zt - 0.4 * k], p.weather, out);
      // surviving figures at the corners and a stub at the centre
      for (const [fv, fh, fw] of [[0.13, 0.7, 1.4], [0.22, 1.2, 1.1], [0.8, 1.1, 1.2], [0.88, 0.6, 1.3], [0.47, 1.8, 0.9]]) {
        const v = va + (vb - va) * fv;
        K.box(face - dir * 0.9 * k, v - fw * k / 2, zG, face - dir * 0.05 * k, v + fw * k / 2, zG + fh * k, { side: p.marble, top: p.marbleLight });
      }
    } else {
      for (const [va2, vb2, apexF] of [[va + 0.6 * k, va + 5.5 * k, 0.42], [vb - 5.5 * k, vb - 0.6 * k, 0.42]]) {
        const hi = rise * ((vb2 - va2) / (vm - va)) * apexF / 0.42 * 0.85;
        K.tri([face, va2, zG], [face, vb2, zG], [face, va2 < vm ? vb2 : va2, zG + hi], p.weather, out);
      }
    }
    // raking cornices: sloped slabs rising from each corner to the apex (east: broken stubs)
    const reach = whole ? 1 : 0.45;
    for (const [vc0, sg] of [[va, 1], [vb, -1]]) {
      const vEnd = vc0 + (vm - vc0) * reach, zEnd = zG + rise * reach;
      const A = [ue - dir * 0.3 * k, vc0, zG], B = [ue - dir * 0.3 * k, vEnd, zEnd], th = 0.75 * k;
      const A2 = [ue + dir * pd, vc0, zG], B2 = [ue + dir * pd, vEnd, zEnd];
      K.quad([A, B, [B[0], B[1], B[2] + th], [A[0], A[1], A[2] + th]], p.marbleLight, out);
      K.quad([[A[0], A[1], A[2] + th], [B[0], B[1], B[2] + th], [B2[0], B2[1], B2[2] + th], [A2[0], A2[1], A2[2] + th]], p.marble, { dir: [0, -sg * 0.5, 1] });
      K.quad([A, B, B2, A2], p.shadow, { dir: [0, sg * 0.3, -1] });
      void inside;
    }
  }
  // ── the cella: west wall with the great door full height, flanks stepping down, porches ──
  const cU0 = u0 + 7.4 * k, cU1 = u0 + Ls - 7.4 * k, cV0 = v0 + 4.9 * k, cV1 = v0 + Ws - 4.9 * k, t = 1.2 * k;
  const wallH = colH + 1.0 * k;
  K.box(cU0, cV0, zS, cU0 + t, cV1, zS + wallH, { side: p.marble, top: p.weather });
  const ww = K.wall([cU0, cV1, zS], [0, -1, 0], [0, 0, 1], [-1, 0, 0]);
  ww.recess((cV1 - cV0) / 2 - 2.4 * k, 0.02 * k, (cV1 - cV0) / 2 + 2.4 * k, 10.1 * k, 0.6 * k, p.recess, p.marble, { frame: 0.35 * k });
  const RUIN = [[0, 0.1, 1.0], [0.1, 0.18, 0.72], [0.18, 0.24, 0.44], [0.24, 0.3, 0.2], [0.3, 1.0, 0.09]];
  for (const [f0, f1, hf] of RUIN) for (const [va, vb] of [[cV0, cV0 + t], [cV1 - t, cV1]]) {
    K.box(cU0 + (cU1 - cU0) * f0, va, zS, cU0 + (cU1 - cU0) * f1, vb, zS + wallH * hf, { side: p.marble, top: p.weather });
  }
  K.box(cU1 - t, cV0, zS, cU1, cV1, zS + wallH * 0.12, { side: p.marble, top: p.weather });
  // the inner hexastyle porches: west standing with its architrave, east broken stumps
  const pr = r * 0.9, porch = (u, hs) => {
    for (let j = 0; j < 6; j++) {
      const v = cV0 + 0.6 * k + (cV1 - cV0 - 1.2 * k) * j / 5;
      column(u, v, hs[j] * colH * 0.97, pr, p.marble, p.weather);
    }
  };
  porch(u0 + 5.2 * k, [1, 1, 1, 1, 1, 1]);
  K.box(u0 + 5.2 * k - pr * 1.18, cV0, zC - 0.3 * k, u0 + 5.2 * k + pr * 1.18, cV1, zC - 0.3 * k + 1.3 * k, { side: p.marble, top: p.marble, bottom: p.shadow });
  porch(u0 + Ls - 5.2 * k, [0.3, 0.14, 0.42, 0.1, 0.22, 0.36]);
  return K.faces;
}

// ── GRIFFITH OBSERVATORY ─────────────────────────────────────────────────────────────────────
// The white Art Deco block on its hill: the entrance pavilion with fluted piers and a stepped
// parapet, the copper-green planetarium dome on its drum behind it, the long wings fronted by
// colonnades, the end towers carrying the two telescope domes; before it the front lawn with its
// path and the Astronomers Monument (the shaft, the six figures, the armillary crown).
const GRIFFITH = {
  wall: '#e6dfcf', wallLight: '#f0eadd', trim: '#c2b8a2', shade: '#b0a690', glass: '#414a4f', door: '#343a3d',
  copper: '#6f8b7f', copperDark: '#587268', copperLight: '#86a093', lawn: '#88926f', lawnTop: '#909a77', path: '#cdc4b0',
  monument: '#c9c2b1', bronze: '#6d6048', plinth: '#cfc7b5', plinthTop: '#ddd6c6',
};
function griffith(b, ctx) {
  const K = localKit(b, ctx), { s, Lu, Dv } = K, p = GRIFFITH;
  const cu = Lu / 2;
  const half = Math.min(Lu / 2 - s * 0.03, s * 0.98);          // half the building's length
  // lawn and forecourt
  K.box(cu - half - s * 0.02, s * 0.01, 0, cu + half + s * 0.02, s * 0.47, s * 0.004, { side: p.lawn, top: p.lawnTop });
  const zl = s * 0.004;
  const flat = (u0, v0, u1, v1, tint, dz = 0.0008) => K.quad([[u0, v0, zl + s * dz], [u1, v0, zl + s * dz], [u1, v1, zl + s * dz], [u0, v1, zl + s * dz]], tint, { dir: [0, 0, 1] });
  flat(cu - s * 0.04, s * 0.01, cu + s * 0.04, s * 0.47, p.path);
  flat(cu - half * 0.8, s * 0.4, cu + half * 0.8, s * 0.47, p.path);
  K.lathe(cu, s * 0.21, [[s * 0.11, zl + s * 0.0008]], 20, null, { capTop: p.path });
  // plinth terrace the building stands on
  K.box(cu - half, s * 0.46, 0, cu + half, s * 0.97, s * 0.03, { side: p.plinth, top: p.plinthTop });
  const zb = s * 0.03;
  // ── wings with their front colonnades ──
  const wingIn = s * 0.3, wingOut = half - s * 0.22, zWing = zb + s * 0.16;
  for (const sg of [-1, 1]) {
    const ua = sg < 0 ? cu - wingOut : cu + wingIn, uc = sg < 0 ? cu - wingIn : cu + wingOut;
    K.box(ua, s * 0.58, zb, uc, s * 0.93, zWing, { side: p.wall, top: p.wallLight });
    const W = K.walls(ua, s * 0.58, uc, s * 0.93, zb);
    const n = Math.max(3, Math.round((uc - ua) / (s * 0.075)));
    for (let i = 0; i < n; i++) {
      const x0 = (uc - ua) * (i + 0.3) / n, x1 = (uc - ua) * (i + 0.7) / n;
      W.front.recess(x0, s * 0.03, x1, s * 0.12, s * 0.008, p.glass, null);
      W.back.recess(x0, s * 0.04, x1, s * 0.11, s * 0.006, p.glass, null);
    }
    // the colonnade: square piers carrying a flat roof slab and a parapet
    K.box(ua, s * 0.49, zWing - s * 0.02, uc, s * 0.58, zWing, { side: p.wallLight, top: p.wallLight, bottom: p.shade });
    for (let i = 0; i <= n; i++) {
      const u = ua + (uc - ua) * i / n, w = s * 0.011;
      K.box(Math.max(ua, u - w), s * 0.5, zb, Math.min(uc, u + w), s * 0.522, zWing - s * 0.02, { side: p.wall, top: p.wall });
    }
    K.box(ua, s * 0.49, zWing, uc, s * 0.5, zWing + s * 0.018, { side: p.trim, top: p.wallLight });
    // the end tower with its telescope dome
    const tu0 = sg < 0 ? cu - half : cu + wingOut, tu1 = sg < 0 ? cu - wingOut : cu + half, tv0 = s * 0.5, tv1 = s * 0.76;
    const zT = zb + s * 0.24;
    K.box(tu0, tv0, zb, tu1, tv1, zT, { side: p.wall, top: p.wallLight });
    K.box(tu0 + s * 0.014, tv0 + s * 0.014, zT, tu1 - s * 0.014, tv1 - s * 0.014, zT + s * 0.03, { side: p.wallLight, top: p.wallLight });
    const TW = K.walls(tu0, tv0, tu1, tv1, zb);
    for (const side of ['front', 'left', 'right']) {
      const L0 = TW.len[side];
      // fluted Art Deco strips framing a tall window slot
      for (const f of [0.12, 0.3, 0.7, 0.88]) TW[side].proud(L0 * f - s * 0.006, s * 0.02, L0 * f + s * 0.006, zT - zb - s * 0.01, s * 0.006, p.wallLight, p.shade);
      TW[side].recess(L0 * 0.4, s * 0.05, L0 * 0.6, zT - zb - s * 0.04, s * 0.01, p.glass, p.trim);
    }
    const dc = [(tu0 + tu1) / 2, (tv0 + tv1) / 2], rd = Math.min(tu1 - tu0, tv1 - tv0) * 0.42, zd = zT + s * 0.03;
    K.lathe(dc[0], dc[1], [[rd * 1.05, zd], [rd * 1.05, zd + s * 0.025]], 16, p.wallLight);
    K.lathe(dc[0], dc[1], [[rd, zd + s * 0.025], [rd * 0.97, zd + s * 0.025 + rd * 0.3], [rd * 0.84, zd + s * 0.025 + rd * 0.58], [rd * 0.6, zd + s * 0.025 + rd * 0.82], [rd * 0.3, zd + s * 0.025 + rd * 0.96], [0, zd + s * 0.025 + rd]], 16, (i) => (i === 3 ? p.copperDark : p.copper));
  }
  // ── the central block: the planetarium drum and its great dome ──
  const dv = s * 0.74, rD = s * 0.25, zDr = zb + s * 0.3;
  K.lathe(cu, dv, [[rD * 1.02, zb], [rD * 1.02, zDr]], 24, p.wall);
  K.lathe(cu, dv, [[rD * 1.06, zDr], [rD * 1.06, zDr + s * 0.025], [rD, zDr + s * 0.03]], 24, p.wallLight, { capTop: null });
  const zd0 = zDr + s * 0.03;
  const DOME = [[1, 0], [0.98, 0.2], [0.92, 0.4], [0.8, 0.6], [0.6, 0.8], [0.32, 0.95], [0.1, 1.0]];
  K.lathe(cu, dv, DOME.map(([r, t]) => [rD * r, zd0 + rD * 0.92 * t]), 24, (i, k) => (k < 2 && i % 3 === 0 ? p.copperDark : p.copper));
  const zTop = zd0 + rD * 0.92;
  K.lathe(cu, dv, [[rD * 0.1, zTop], [rD * 0.1, zTop + s * 0.02], [rD * 0.05, zTop + s * 0.028], [0, zTop + s * 0.05]], 8, p.copperLight);
  // the entrance pavilion before the dome: piers, tall bays, stepped parapet
  const eu0 = cu - wingIn, eu1 = cu + wingIn, ev0 = s * 0.47, ev1 = s * 0.62, zE = zb + s * 0.25;
  K.box(eu0, ev0, zb, eu1, ev1, zE, { side: p.wall, top: p.wallLight });
  K.box(eu0 + s * 0.05, ev0 + s * 0.01, zE, eu1 - s * 0.05, ev1, zE + s * 0.03, { side: p.wallLight, top: p.wallLight });
  K.box(eu0 + s * 0.12, ev0 + s * 0.02, zE + s * 0.03, eu1 - s * 0.12, ev1, zE + s * 0.05, { side: p.wall, top: p.wallLight });
  const EW = K.walls(eu0, ev0, eu1, ev1, zb), L0 = EW.len.front, nb = 7;
  for (let i = 0; i <= nb; i++) EW.front.proud(L0 * i / nb - s * 0.012, 0, L0 * i / nb + s * 0.012, zE - zb, s * 0.012, p.wallLight, p.shade);
  for (let i = 0; i < nb; i++) {
    const x0 = L0 * i / nb + s * 0.022, x1 = L0 * (i + 1) / nb - s * 0.022;
    if (i === 3) EW.front.recess(x0, 0.001, x1, s * 0.15, s * 0.012, p.door, null, { frame: s * 0.006 });
    else EW.front.recess(x0, s * 0.03, x1, s * 0.2, s * 0.01, p.glass, p.trim);
  }
  EW.front.proud(0, zE - zb - s * 0.03, L0, zE - zb - s * 0.018, s * 0.016, p.trim);
  for (const side of ['left', 'right']) EW[side].recess(EW.len[side] * 0.3, s * 0.05, EW.len[side] * 0.7, s * 0.18, s * 0.01, p.glass, p.trim);
  // ── the Astronomers Monument ──
  const mu = cu, mv = s * 0.21;
  K.lathe(mu, mv, [[s * 0.07, zl], [s * 0.07, zl + s * 0.012], [s * 0.05, zl + s * 0.016]], 16, p.plinth, { capTop: p.plinthTop });
  const zm = zl + s * 0.016;
  for (let q = 0; q < 6; q++) {
    const a = (q / 6) * Math.PI * 2 + Math.PI / 6, fu = mu + dmath.cos(a) * s * 0.036, fv = mv + dmath.sin(a) * s * 0.036;
    K.lathe(fu, fv, [[s * 0.009, zm], [s * 0.008, zm + s * 0.03], [s * 0.006, zm + s * 0.036], [s * 0.004, zm + s * 0.042], [0, zm + s * 0.047]], 6, p.monument);
  }
  K.obox(mu, mv, 0, s * 0.022, s * 0.022, zm, zm + s * 0.24, p.monument, { top: 0.72 });
  K.obox(mu, mv, 0, s * 0.02, s * 0.02, zm + s * 0.24, zm + s * 0.26, p.monument, { top: 0.7 });
  K.lathe(mu, mv, [[s * 0.004, zm + s * 0.26], [s * 0.016, zm + s * 0.268], [s * 0.019, zm + s * 0.28], [s * 0.016, zm + s * 0.292], [0, zm + s * 0.3]], 8, p.bronze);
  return K.faces;
}

// ── PARLIAMENT HILL (Centre Block) ────────────────────────────────────────────────────────────
// Gothic Revival in buff Nepean sandstone: the symmetrical front with its projecting pavilions,
// buttressed bays of pointed windows, steep copper-green roofs with dormers and dark iron cresting,
// tall pyramidal roofs on the pavilions; the Peace Tower on the axis: the entrance arch, the lancet
// shaft with corner buttresses, the four clock faces, the open belfry with corner turrets, the
// copper spire with its lucarnes, the flagstaff.
const PARL = {
  stone: '#cdbb98', stoneLight: '#dccda9', stoneDark: '#a8987a', trim: '#e0d4b9', glass: '#3f403d', door: '#34312c',
  roof: '#6c9383', roofDark: '#557a6b', roofLight: '#7fa595', iron: '#3b3e3b', clock: '#e4dfcf', clockRing: '#3a3a36',
  terrace: '#b5ad9d', terraceTop: '#c3bcad', lawn: '#8a946f', flag: '#b53a33', flagWhite: '#ece8df',
};
/**
 * A steep hip roof over an axis-aligned local rect: slopes at `pitch` (rise / run), truncated to a
 * flat copper deck at `hMax` when the rect is deep (the Centre Block's roofs), iron cresting along
 * the ridge or round the deck, iron finials, and gabled dormers on the front slope.
 */
function steepRoof(K, u0, v0, u1, v1, zE, pitch, p, { dormers = 0, hMax = Infinity, s = 1 } = {}) {
  const du = u1 - u0, dv = v1 - v0, hFull = Math.min(du, dv) / 2 * pitch;
  const h = Math.min(hFull, hMax), ins = h / pitch, zt = zE + h;
  const c = [[u0, v0, zE], [u1, v0, zE], [u1, v1, zE], [u0, v1, zE]];
  const top = [[u0 + ins, v0 + ins, zt], [u1 - ins, v0 + ins, zt], [u1 - ins, v1 - ins, zt], [u0 + ins, v1 - ins, zt]];
  const inside = [(u0 + u1) / 2, (v0 + v1) / 2, zE];
  if (h < hFull - 1e-9) {
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; K.quad([c[i], c[j], top[j], top[i]], p.roof, inside); }
    K.quad(top, p.roofDark, { dir: [0, 0, 1] });
  } else {
    // a full hip: the ridge along the longer side (a pyramid when square)
    const r0 = du >= dv ? [u0 + dv / 2, (v0 + v1) / 2, zt] : [(u0 + u1) / 2, v0 + du / 2, zt];
    const r1 = du >= dv ? [u1 - dv / 2, (v0 + v1) / 2, zt] : [(u0 + u1) / 2, v1 - du / 2, zt];
    if (du >= dv) { K.quad([c[0], c[1], r1, r0], p.roof, inside); K.quad([c[2], c[3], r0, r1], p.roof, inside); K.tri(c[1], c[2], r1, p.roof, inside); K.tri(c[3], c[0], r0, p.roof, inside); }
    else { K.quad([c[1], c[2], r1, r0], p.roof, inside); K.quad([c[3], c[0], r0, r1], p.roof, inside); K.tri(c[0], c[1], r0, p.roof, inside); K.tri(c[2], c[3], r1, p.roof, inside); }
    top.splice(0, 4, r0, r1, r1, r0);
  }
  // iron cresting on the long top edges, finials at the ends
  const w = s * 0.004;
  for (const [A, B] of [[top[0], top[1]], [top[3], top[2]]]) {
    if (dmath.hypot(B[0] - A[0], B[1] - A[1]) < 1e-6) continue;
    K.box(Math.min(A[0], B[0]), Math.min(A[1], B[1]) - w, zt, Math.max(A[0], B[0]), Math.max(A[1], B[1]) + w, zt + w * 4, p.iron);
  }
  for (const R of [top[0], top[1]]) K.lathe(R[0], R[1], [[w * 1.6, zt], [w * 0.6, zt + w * 5], [0, zt + w * 12]], 4, p.iron);
  // dormers on the front slope: a small gabled box with a window
  for (let i = 0; i < dormers; i++) {
    const u = u0 + ins + (du - 2 * ins) * (i + 0.5) / dormers, dw = Math.min((du - 2 * ins) / dormers * 0.24, ins * 0.4);
    const dvF = v0 + ins * 0.3, zd = zE + h * 0.3 - dw * 0.4, hd = dw * 1.5, dd = dw * 2.2;
    K.box(u - dw, dvF, zd - dw, u + dw, dvF + dd, zd + hd, { side: p.stoneLight, top: p.roofDark });
    K.quad([[u - dw * 1.15, dvF - dw * 0.1, zd + hd], [u, dvF - dw * 0.1, zd + hd + dw * 1.2], [u, dvF + dd, zd + hd + dw * 1.2], [u - dw * 1.15, dvF + dd, zd + hd]], p.roofDark, [u, dvF + dw, zd]);
    K.quad([[u + dw * 1.15, dvF - dw * 0.1, zd + hd], [u, dvF - dw * 0.1, zd + hd + dw * 1.2], [u, dvF + dd, zd + hd + dw * 1.2], [u + dw * 1.15, dvF + dd, zd + hd]], p.roofDark, [u, dvF + dw, zd]);
    K.tri([u - dw, dvF - 0.0001, zd + hd], [u + dw, dvF - 0.0001, zd + hd], [u, dvF - 0.0001, zd + hd + dw * 1.1], p.stoneLight, { dir: [0, -1, 0] });
    const wf = K.wall([u - dw, dvF - 0.0002, zd - dw], [1, 0, 0], [0, 0, 1], [0, -1, 0]);
    wf.arch(dw * 0.5, dw * 1.5, dw * 1.1, dw * 1.1 + hd * 0.55, 0.001, p.glass, null, { seg: 3, pointed: true, rise: dw * 0.45 });
  }
}
function parliamentHill(b, ctx) {
  const K = localKit(b, ctx), { s, Lu, Dv } = K, p = PARL;
  const cu = Lu / 2, half = Lu / 2 - s * 0.05;
  // the front terrace
  K.box(cu - half - s * 0.03, s * 0.005, 0, cu + half + s * 0.03, s * 0.99, s * 0.012, { side: p.terrace, top: p.terraceTop });
  const zb = s * 0.012, vF = s * 0.16, vB = s * 0.95;
  // sections along the front, mirrored about the tower: [inner, outer, front, wall top, roof pitch, dormers]
  const bayW = s * 0.07;
  const secs = [
    [s * 0.11, s * 0.42, vF, zb + s * 0.34, 1.6, 3],
    [s * 0.42, s * 0.6, vF - s * 0.04, zb + s * 0.39, 1.9, 0],
    [s * 0.6, Math.max(s * 0.62, half - s * 0.2), vF, zb + s * 0.34, 1.6, 5],
    [Math.max(s * 0.62, half - s * 0.2), half, vF - s * 0.05, zb + s * 0.4, 2.1, 0],
  ];
  const buttress = (w, x, t1, d) => {
    w.proud(x - s * 0.011, 0, x + s * 0.011, t1, d, p.stoneLight, p.stoneDark);
    w.proud(x - s * 0.008, t1, x + s * 0.008, t1 + s * 0.03, d * 0.7, p.stoneLight, p.stoneDark);
  };
  for (const sg of [-1, 1]) {
    for (const [a, c, vf, zt, pitch, dorm] of secs) {
      if (c - a < s * 0.02) continue;
      const u0 = sg < 0 ? cu - c : cu + a, u1 = sg < 0 ? cu - a : cu + c;
      K.box(u0, vf, zb, u1, vB, zt, { side: p.stone, top: p.stone });
      // parapet string course
      K.box(u0 - s * 0.004, vf - s * 0.004, zt - s * 0.018, u1 + s * 0.004, vB + s * 0.004, zt - s * 0.008, { side: p.trim, top: p.trim });
      const W = K.walls(u0, vf, u1, vB, zb), L0 = W.len.front, H = zt - zb;
      const n = Math.max(2, Math.round(L0 / bayW));
      for (let i = 0; i <= n; i++) buttress(W.front, L0 * i / n, H * 0.9, s * 0.012);
      for (let i = 0; i < n; i++) {
        const m = L0 * (i + 0.5) / n, hw = L0 / n * 0.22;
        W.front.recess(m - hw, H * 0.08, m + hw, H * 0.27, s * 0.006, p.glass, p.trim);
        W.front.arch(m - hw, m + hw, H * 0.38, H * 0.52, s * 0.006, p.glass, p.trim, { seg: 4, pointed: true, rise: hw * 1.4 });
        W.front.arch(m - hw, m + hw, H * 0.64, H * 0.76, s * 0.006, p.glass, p.trim, { seg: 4, pointed: true, rise: hw * 1.4 });
        W.back.recess(m - hw, H * 0.3, m + hw, H * 0.7, s * 0.005, p.glass, null);
      }
      // the outer end walls of the end pavilions
      if (c === half) {
        const side = sg < 0 ? 'left' : 'right', LS = W.len[side], ns = Math.max(3, Math.round(LS / bayW));
        for (let i = 0; i <= ns; i++) buttress(W[side], LS * i / ns, H * 0.9, s * 0.012);
        for (let i = 0; i < ns; i++) {
          const m = LS * (i + 0.5) / ns, hw = LS / ns * 0.22;
          W[side].arch(m - hw, m + hw, H * 0.12, H * 0.6, s * 0.006, p.glass, p.trim, { seg: 4, pointed: true, rise: hw * 1.4 });
        }
      }
      if (dorm === 0) {
        // a pavilion: a tall pyramidal roof over its front square, a deck roof behind
        const sqD = Math.min(u1 - u0, vB - vf);
        steepRoof(K, u0, vf, u1, vf + sqD, zt, pitch, p, { s });
        steepRoof(K, u0 + s * 0.01, vf + sqD, u1 - s * 0.01, vB, zt, 1.4, p, { hMax: s * 0.16, s });
      } else steepRoof(K, u0, vf, u1, vB, zt, pitch, p, { dormers: dorm, hMax: s * 0.17, s });
      // pinnacles on the pavilion corners
      if (dorm === 0) for (const uu of [u0, u1]) K.lathe(uu, vf, [[s * 0.012, zt], [s * 0.012, zt + s * 0.03], [0, zt + s * 0.08]], 4, p.stoneLight);
    }
  }
  // ── the Peace Tower ──
  const T = Math.min(Lu * 0.64, s * 3.3), tw = s * 0.22, tv = vF - s * 0.07 + tw / 2;
  const box = (hw, za, zc, tint) => K.box(cu - hw, tv - hw, za, cu + hw, tv + hw, zc, tint);
  const zB = zb + T * 0.28, zS = zb + T * 0.55, zC = zb + T * 0.63, zBel = zb + T * 0.72, zSp = zb + T * 0.965;
  box(tw / 2, zb, zB, { side: p.stone, top: p.stone });
  box(tw * 0.46, zB, zS, { side: p.stone, top: p.stone });
  box(tw * 0.47, zS, zC, { side: p.stoneLight, top: p.stone });
  box(tw * 0.45, zC, zBel, { side: p.stone, top: p.stone });
  box(tw * 0.49, zBel - s * 0.02, zBel, { side: p.trim, top: p.stoneLight });
  const tWalls = (hw, za) => K.walls(cu - hw, tv - hw, cu + hw, tv + hw, za);
  const W0 = tWalls(tw / 2, zb), W1 = tWalls(tw * 0.46, zB), W2 = tWalls(tw * 0.47, zS), W3 = tWalls(tw * 0.45, zC);
  for (const side of ['front', 'right', 'back', 'left']) {
    const L0 = W0.len[side], H0 = zB - zb;
    // corner buttresses up the base and shaft
    for (const x of [s * 0.012, L0 - s * 0.012]) W0[side].proud(x - s * 0.012, 0, x + s * 0.012, H0, s * 0.014, p.stoneLight, p.stoneDark);
    if (side === 'front') W0.front.arch(L0 * 0.3, L0 * 0.7, 0.001, H0 * 0.5, s * 0.02, p.door, p.trim, { seg: 6, pointed: true, frame: s * 0.012 });
    else W0[side].arch(L0 * 0.36, L0 * 0.64, H0 * 0.35, H0 * 0.7, s * 0.01, p.glass, p.trim, { seg: 4, pointed: true });
    const L1 = W1.len[side], H1 = zS - zB;
    for (const x of [s * 0.01, L1 - s * 0.01]) W1[side].proud(x - s * 0.01, 0, x + s * 0.01, H1, s * 0.012, p.stoneLight, p.stoneDark);
    for (const f of [0.36, 0.64]) W1[side].arch(L1 * f - L1 * 0.08, L1 * f + L1 * 0.08, H1 * 0.12, H1 * 0.8, s * 0.008, p.glass, p.trim, { seg: 4, pointed: true });
    // clock face in a gabled surround
    const L2 = W2.len[side], H2 = zC - zS, cr = Math.min(L2 * 0.36, H2 * 0.44), cc = [L2 / 2, H2 * 0.5];
    const ring = (r, d, tint) => { const pts = []; for (let q = 0; q < 12; q++) { const a = (q / 12) * Math.PI * 2; pts.push(W2[side].at(cc[0] + dmath.cos(a) * r, cc[1] + dmath.sin(a) * r, d)); } K.kit.poly(pts, tint, { dir: W2[side].n }); };
    ring(cr * 1.12, 0.004 * s, p.clockRing);
    ring(cr, 0.006 * s, p.clock);
    W2[side].rect(cc[0] - cr * 0.04, cc[1], cc[0] + cr * 0.04, cc[1] + cr * 0.78, p.clockRing, 0.008 * s);
    W2[side].rect(cc[0], cc[1] - cr * 0.04, cc[0] + cr * 0.55, cc[1] + cr * 0.04, p.clockRing, 0.008 * s);
    // the belfry: tall open arches in pairs
    const L3 = W3.len[side], H3 = zBel - zC;
    for (const f of [0.3, 0.7]) W3[side].arch(L3 * f - L3 * 0.14, L3 * f + L3 * 0.14, H3 * 0.08, H3 * 0.62, s * 0.012, p.door, p.trim, { seg: 4, pointed: true, frame: s * 0.006 });
  }
  // corner turrets round the belfry
  for (const [du, dv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const u = cu + du * tw * 0.47, v = tv + dv * tw * 0.47, r = tw * 0.07;
    K.lathe(u, v, [[r, zC], [r, zBel + s * 0.05], [r * 1.2, zBel + s * 0.06], [0, zBel + s * 0.2]], 6, (i, k) => (k === 2 ? p.roofDark : p.stoneLight));
  }
  // the copper spire, lucarnes at its foot, the finial and the flag
  const sb = tw * 0.42;
  const apex = [cu, tv, zSp];
  const sq = [[cu - sb, tv - sb, zBel], [cu + sb, tv - sb, zBel], [cu + sb, tv + sb, zBel], [cu - sb, tv + sb, zBel]];
  for (let i = 0; i < 4; i++) K.tri(sq[i], sq[(i + 1) % 4], apex, p.roof, [cu, tv, zBel]);
  for (const [nu, nv] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const u = cu + nu * sb * 0.72, v = tv + nv * sb * 0.72, zl = zBel + (zSp - zBel) * 0.1, lw = sb * 0.22;
    const tu = [-nv, nu];
    const A = [u - tu[0] * lw, v - tu[1] * lw, zl], B = [u + tu[0] * lw, v + tu[1] * lw, zl];
    const Tt = [u + nu * lw * 0.2, v + nv * lw * 0.2, zl + lw * 2.6];
    K.tri(A, B, Tt, p.roofLight, [cu, tv, zl]);
    K.quad([[A[0], A[1], zl - lw * 0.1], [B[0], B[1], zl - lw * 0.1], [B[0], B[1], zl + lw * 1.1], [A[0], A[1], zl + lw * 1.1]], p.glass, [cu, tv, zl]);
  }
  K.lathe(cu, tv, [[s * 0.008, zSp - s * 0.02], [s * 0.004, zSp + s * 0.01]], 6, p.iron);
  const zF = zb + T * 0.995;
  K.lathe(cu, tv, [[s * 0.003, zSp], [s * 0.002, zF]], 4, p.iron);
  const fl = s * 0.09, fh = s * 0.05;
  K.quad([[cu, tv, zF - fh], [cu + fl, tv, zF - fh], [cu + fl, tv, zF], [cu, tv, zF]], p.flagWhite, null);
  K.quad([[cu, tv, zF - fh], [cu + fl * 0.26, tv, zF - fh], [cu + fl * 0.26, tv, zF], [cu, tv, zF]], p.flag, { dir: [0, -1, 0] });
  K.quad([[cu + fl * 0.74, tv, zF - fh], [cu + fl, tv, zF - fh], [cu + fl, tv, zF], [cu + fl * 0.74, tv, zF]], p.flag, { dir: [0, -1, 0] });
  return K.faces;
}

export const MONUMENTS = {
  taj: tajMahal,
  'great-pyramid': greatPyramid,
  'louvre-pyramid': louvrePyramid,
  'mexican-pyramid': mexicanPyramid,
  stonehenge,
  'chinatown-gate': chinatownGate,
  'arc-de-triomphe': arcDeTriomphe,
  parthenon,
  'griffith-observatory': griffith,
  'parliament-hill': parliamentHill,
};
