// Metro refacade builders: shrines. Each entry is (b, { L, camHint, cityBox }) → faces, drawn only for
// a metro box (b.metro); the stock builder draws everything else. See refacade.js.
//
// The mosque (b.mosqueVariant: ottoman | persian | sahelian | nusantara) and the Buddhist temple
// (b.templeVariant: pagoda | stupa | tibetan), each composed on the lot's LONG axis in a local frame
// (a along, c across, front at a = 0 facing −a) so a long thin lot reads as a precinct with its
// approach, and sized from the footprint and the seeded z1 (which the seeder takes from the SHORT
// side). Pure functions of the box: no rng, no Date.
import { makeKit, mixHex, v3 } from './refacade-kit.js';

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * The lot's local frame. a runs along the long side (front at a = 0), c across. A square-ish lot
 * turns its front to −y (`frontY`) so the street reads the facade; `sideFront` builders (the dzong)
 * use the long c = 0 side as their facade instead and flip that preference.
 */
function frameOf(b, { sideFront = false } = {}) {
  const ratio = b.w / Math.max(1e-6, b.d);
  const along = sideFront ? (ratio >= 0.93 ? 'x' : 'y') : (ratio > 1.08 ? 'x' : 'y');
  const A = along === 'x' ? b.w : b.d, C = along === 'x' ? b.d : b.w;
  const oa = along === 'x' ? b.x : b.y, oc = along === 'x' ? b.y : b.x;
  const P = (a, c, z = 0) => (along === 'x' ? [oa + a, oc + c, z] : [oc + c, oa + a, z]);
  const D = (da, dc, dz = 0) => (along === 'x' ? [da, dc, dz] : [dc, da, dz]);
  // a local angle (from +a toward +c) → the world angle
  const ang = (t) => (along === 'x' ? t : Math.PI / 2 - t);
  return { along, A, C, P, D, ang };
}

/** The kit, addressed in the lot's local (a, c, z) frame. */
function localKit(b, ctx, opts) {
  const faces = [];
  const K = makeKit({ faces, L: ctx.L, camHint: ctx.camHint });
  const F = frameOf(b, opts);
  const { P, D } = F;
  const W = (p) => P(p[0], p[1], p[2]);
  const O = (out) => (out == null ? null : out.dir ? { dir: D(...out.dir) } : W(out));
  const polyL = (pts, tint, out) => K.poly(pts.map(W), tint, O(out));
  const quadL = (pts, tint, out) => K.quad(pts.map(W), tint, O(out));
  const triL = (A, B, T, tint, out) => K.tri(W(A), W(B), W(T), tint, O(out));
  const boxL = (a0, a1, c0, c1, zl, zh, tint) => {
    const p = P(a0, c0), q = P(a1, c1);
    K.box(Math.min(p[0], q[0]), Math.min(p[1], q[1]), zl, Math.max(p[0], q[0]), Math.max(p[1], q[1]), zh, tint);
  };
  const latheL = (a, c, profile, n, tint, { t0 = 0, t1 = TAU, ...rest } = {}) => {
    const [x, y] = P(a, c), w0 = F.ang(t0), w1 = F.ang(t1);
    K.lathe(x, y, profile, n, tint, { a0: Math.min(w0, w1), a1: Math.max(w0, w1), ...rest });
  };
  /** A wall frame in the local plan: origin (a, c, z), u along the wall, n outward (local 2D dirs). */
  const wallL = (a, c, z, u, n) => K.wall(P(a, c, z), D(u[0], u[1]), [0, 0, 1], D(n[0], n[1]));
  /** The four walls of a local block, each seen from outside. */
  const wallsL = (a0, a1, c0, c1, z) => ({
    front: wallL(a0, c0, z, [0, 1], [-1, 0]),
    back: wallL(a1, c1, z, [0, -1], [1, 0]),
    left: wallL(a1, c0, z, [-1, 0], [0, -1]),
    right: wallL(a0, c1, z, [1, 0], [0, 1]),
    len: { front: c1 - c0, back: c1 - c0, left: a1 - a0, right: a1 - a0 },
  });
  /**
   * A battered (inward-sloping) block: base rect → top rect inset by `ins`, with its four sloped
   * walls as wall frames (s along the base edge, t up the slope), so openings and pilasters follow
   * the batter. `top` tints the roof (null skips it).
   */
  const batter = (a0, a1, c0, c1, zb, zt, ins, tint, top = null) => {
    const h = zt - zb, sl = Math.hypot(ins, h);
    const cen = [(a0 + a1) / 2, (c0 + c1) / 2, (zb + zt) / 2];
    const B = [[a0, c0], [a1, c0], [a1, c1], [a0, c1]], T = [[a0 + ins, c0 + ins], [a1 - ins, c0 + ins], [a1 - ins, c1 - ins], [a0 + ins, c1 - ins]];
    const sideTint = typeof tint === 'function' ? tint : () => tint;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      quadL([[...B[i], zb], [...B[j], zb], [...T[j], zt], [...T[i], zt]], sideTint(i), cen);
    }
    if (top) quadL(T.map(([a, c]) => [a, c, zt]), top, { dir: [0, 0, 1] });
    const fr = (oa, oc, u, n) => {
      const vv = v3.norm([n[0] * -ins, n[1] * -ins, h]);
      return K.wall(P(oa, oc, zb), D(u[0], u[1]), D(vv[0], vv[1], vv[2]), v3.norm(D(n[0] * h, n[1] * h, ins)));
    };
    return {
      front: fr(a0, c0, [0, 1], [-1, 0]), back: fr(a1, c1, [0, -1], [1, 0]),
      left: fr(a1, c0, [-1, 0], [0, -1]), right: fr(a0, c1, [1, 0], [0, 1]),
      len: { front: c1 - c0, back: c1 - c0, left: a1 - a0, right: a1 - a0 }, slant: sl,
    };
  };
  /** A truncated pyramid (hip) from an outer rect at zb to an inner rect at zt; `lift` curls the corners up. */
  const hipRing = (ca, cc, oa, oc, ia, ic, zb, zt, tint, { lift = 0, soffit = null, fascia = null, fz = 0 } = {}) => {
    const inside = [ca, cc, zb - (zt - zb) * 2 - 1];
    const O4 = [[-oa, -oc], [oa, -oc], [oa, oc], [-oa, oc]], I4 = [[-ia, -ic], [ia, -ic], [ia, ic], [-ia, ic]];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const o0 = [ca + O4[i][0], cc + O4[i][1], zb + lift], o1 = [ca + O4[j][0], cc + O4[j][1], zb + lift];
      const om = [(o0[0] + o1[0]) / 2, (o0[1] + o1[1]) / 2, zb];
      const i0 = [ca + I4[i][0], cc + I4[i][1], zt], i1 = [ca + I4[j][0], cc + I4[j][1], zt];
      const im = [(i0[0] + i1[0]) / 2, (i0[1] + i1[1]) / 2, zt];
      if (lift > 0) {
        triL(o0, om, i0, tint, inside); triL(om, im, i0, tint, inside);
        triL(om, o1, im, tint, inside); triL(o1, i1, im, tint, inside);
      } else quadL([o0, o1, i1, i0], tint, inside);
      if (fascia && fz > 0) {
        const d = [o0[0], o0[1], o0[2] - fz], e = [om[0], om[1], om[2] - fz], f = [o1[0], o1[1], o1[2] - fz];
        const out = { dir: [(O4[i][0] + O4[j][0]), (O4[i][1] + O4[j][1]), 0] };
        quadL([o0, om, e, d], fascia, out); quadL([om, o1, f, e], fascia, out);
      }
      if (soffit) {
        const s0 = [o0[0], o0[1], o0[2] - fz], s1 = [o1[0], o1[1], o1[2] - fz];
        const w = (x) => [ca + I4[x][0] * 0.999, cc + I4[x][1] * 0.999, zb - fz];
        quadL([s0, s1, w(j), w(i)], soffit, { dir: [0, 0, -1] });
      }
    }
    if (zt > zb && ia > 1e-6) { /* open top: the next storey closes it */ }
  };
  /** A hip roof over a rect with a ridge along the longer side (a pyramid when square). */
  const hipRoof = (a0, a1, c0, c1, zE, zR, tint) => {
    const la = a1 - a0, lc = c1 - c0, ca = (a0 + a1) / 2, cc = (c0 + c1) / 2, inside = [ca, cc, zE - 1];
    const ra = la >= lc ? (la - lc) / 2 : 0, rc = lc > la ? (lc - la) / 2 : 0;
    const r0 = [ca - ra, cc - rc, zR], r1 = [ca + ra, cc + rc, zR];
    const C4 = [[a0, c0, zE], [a1, c0, zE], [a1, c1, zE], [a0, c1, zE]];
    if (ra > 0) {
      quadL([C4[0], C4[1], r1, r0], tint, inside); quadL([C4[2], C4[3], r0, r1], tint, inside);
      triL(C4[1], C4[2], r1, tint, inside); triL(C4[3], C4[0], r0, tint, inside);
    } else if (rc > 0) {
      quadL([C4[1], C4[2], r1, r0], tint, inside); quadL([C4[3], C4[0], r0, r1], tint, inside);
      triL(C4[0], C4[1], r0, tint, inside); triL(C4[2], C4[3], r1, tint, inside);
    } else for (let i = 0; i < 4; i++) triL(C4[i], C4[(i + 1) % 4], r0, tint, inside);
  };
  /** Openings / panels evenly spaced along a wall: `fn(wall, sCentre, bay)` per bay. */
  const bays = (wall, len, n, fn) => { const bay = len / n; for (let i = 0; i < n; i++) fn(wall, bay * (i + 0.5), bay, i); };
  return { faces, K, F, W, polyL, quadL, triL, boxL, latheL, wallL, wallsL, batter, hipRing, hipRoof, bays, A: F.A, C: F.C, z0: b.z0, H: b.z1 - b.z0 };
}

/** A crescent in the plane facing ±a (horns up), as a strip of quads round its belly. */
function crescentL(G, a, c, zc, r, tint) {
  const N = 8, pts = [];
  for (let k = 0; k <= N; k++) {
    const th = Math.PI + (Math.PI * k) / N;                    // left horn → belly → right horn
    const t = r * 0.42 * Math.sin((Math.PI * k) / N);
    pts.push([[a, c + Math.cos(th) * r, zc + Math.sin(th) * r], [a, c + Math.cos(th) * (r - t), zc + Math.sin(th) * (r - t) + t * 0.35]]);
  }
  for (let k = 0; k < N; k++) G.quadL([pts[k][0], pts[k + 1][0], pts[k + 1][1], pts[k][1]], tint, { dir: [-1, 0, 0] });
}
/** A gilded finial rod with beads (the alem), optionally crowned by a crescent. */
function alemL(G, a, c, zb, h, tint, { crescent = true } = {}) {
  const r = h * 0.07;
  G.latheL(a, c, [[r * 0.6, zb], [r * 0.5, zb + h * 0.3], [r * 1.5, zb + h * 0.36], [r * 0.5, zb + h * 0.44], [r * 1.2, zb + h * 0.52], [r * 0.4, zb + h * 0.6], [0.0, zb + h * (crescent ? 0.66 : 1)]], 6, tint);
  if (crescent) crescentL(G, a, c, zb + h * 0.8, h * 0.18, tint);
}

/** The shaft of an Ottoman-style pencil minaret with `balconies` şerefe and a conical lead cap. */
function pencilMinaret(G, a, c, zb, zTop, rM, pal, { balconies = 2, capFrac = 0.2, base = 0 } = {}) {
  const h = zTop - zb, capH = h * capFrac, shaftTop = zTop - capH;
  if (base > 0) G.boxL(a - rM * 1.5, a + rM * 1.5, c - rM * 1.5, c + rM * 1.5, zb, zb + base, { side: pal.stone2, top: pal.stone2 });
  G.latheL(a, c, [[rM * 1.18, zb + base], [rM * 1.18, zb + base + h * 0.04], [rM, zb + base + h * 0.06], [rM, shaftTop]], 10, pal.stone);
  for (let k = 0; k < balconies; k++) {
    const zB = zb + base + (shaftTop - zb - base) * (balconies === 1 ? 0.8 : 0.55 + (0.33 * k) / (balconies - 1));
    const d = rM * 1.1;
    G.latheL(a, c, [[rM, zB - d * 1.3], [rM * 1.6, zB], [rM * 1.6, zB + d * 0.6]], 10, (i, kk) => (kk === 0 ? pal.stone2 : pal.stone), { capTop: pal.stone2 });
  }
  // the lantern ring under the cap, the lead cone, the alem
  G.latheL(a, c, [[rM * 1.12, shaftTop], [rM * 1.12, shaftTop + capH * 0.06], [0, zTop - capH * 0.1]], 10, pal.lead);
  alemL(G, a, c, zTop - capH * 0.12, capH * 0.12 + 1e-3, pal.gold, { crescent: false });
}

// ── MOSQUE ────────────────────────────────────────────────────────────────────

const OTTOMAN = { stone: '#dcd5c3', stone2: '#cbc3af', lead: '#7f878b', leadDark: '#6c7377', win: '#34302b', shade: '#8a8374', court: '#c8c1ae', gold: '#c8a24c' };

function ottoman(b, ctx) {
  const G = localKit(b, ctx);
  const { A, C, z0, H } = G;
  const pal = { ...OTTOMAN, ...(b.churchPalette?.wall ? { stone: b.churchPalette.wall } : {}) };
  // PLAN along a: [outer precinct] [arcaded forecourt] [prayer hall] (the hall against the rear)
  const hallL = Math.min(A * 0.64, C * 1.0);
  const courtL = Math.min(A - hallL, hallL * 0.9);
  const hA0 = A - hallL, cA0 = hA0 - courtL;
  const m = C * 0.03, hc0 = m, hc1 = C - m, Wc = hc1 - hc0;
  const aH = hA0 + hallL / 2, cH = C / 2;
  const S = Math.min(hallL, Wc);
  // the central dome: its two semi-domes run on whichever axis has the room for them (the qibla
  // axis when the hall is deep, across when the lot is shallow); four when both do (the Blue Mosque)
  const Ra = hallL * 0.235, Rc = Wc * 0.235;
  const R = Math.min(Math.max(Ra, Rc), S * 0.44);
  const semiA = Ra >= R * 0.98, semiC = Rc >= R * 0.98 && (!semiA || Math.abs(Ra - Rc) < R * 0.08);
  const hw = Math.min(H * 0.24, S * 0.36);                   // the hall's wall head
  const zT = z0 + hw + R * 0.72;                             // the tympanum line / drum foot
  // HALL — the stone cube with two tiers of arched windows
  G.boxL(hA0, A, hc0, hc1, z0, z0 + hw, { side: pal.stone, top: pal.lead });
  const hwls = G.wallsL(hA0, A, hc0, hc1, 0);
  for (const k of ['front', 'back', 'left', 'right']) {
    const wl = hwls[k], len = hwls.len[k], n = Math.max(3, Math.round(len / (hw * 0.42)));
    wl.proud(0, hw * 0.93, len, hw, hw * 0.03, pal.stone2);                                      // cornice
    G.bays(wl, len, n, (w, s, bay) => {
      w.arch(s - bay * 0.17, s + bay * 0.17, hw * 0.16, hw * 0.34, bay * 0.05, pal.win, null, { seg: 4 });
      w.arch(s - bay * 0.14, s + bay * 0.14, hw * 0.5, hw * 0.66, bay * 0.05, pal.win, null, { seg: 4 });
    });
  }
  // the portal into the hall from the forecourt: a stone pishtaq with a pointed arch
  const pw = Math.min(Wc * 0.3, R * 1.4);
  G.boxL(hA0 - hw * 0.08, hA0 + 0.01, cH - pw / 2, cH + pw / 2, z0, z0 + hw * 1.1, { side: pal.stone2, top: pal.lead });
  G.wallL(hA0 - hw * 0.08, cH - pw / 2, z0, [0, 1], [-1, 0]).arch(pw * 0.22, pw * 0.78, 0, hw * 0.6, pw * 0.06, pal.win, null, { seg: 6, pointed: true, frame: pw * 0.03 });

  // THE CASCADE — corner domes, semi-domes, turrets, the central dome on its drum
  const rs = Math.min(R * 0.4, hallL * 0.14);
  for (const sa of [-1, 1]) for (const sc of [-1, 1]) {
    const da = aH + sa * (hallL / 2 - rs * 1.25), dc = cH + sc * (Wc / 2 - rs * 1.25);
    G.latheL(da, dc, [[rs, z0 + hw], [rs, z0 + hw + rs * 0.25]], 8, pal.stone2);
    G.latheL(da, dc, [[rs * 1.02, z0 + hw + rs * 0.25], [rs * 0.85, z0 + hw + rs * 0.75], [rs * 0.45, z0 + hw + rs * 1.1], [0, z0 + hw + rs * 1.22]], 8, pal.lead);
  }
  // the square the dome stands on, with its tympanum arches
  const q = R * 1.02;
  G.boxL(aH - q, aH + q, cH - q, cH + q, z0 + hw, zT, { side: pal.stone, top: pal.lead });
  const tw = G.wallsL(aH - q, aH + q, cH - q, cH + q, z0 + hw);
  for (const k of [...(semiA ? [] : ['front', 'back']), ...(semiC ? [] : ['left', 'right'])]) {
    tw[k].arch(q * 0.12, q * 1.88, 0, (zT - z0 - hw) * 0.25, 0.001, pal.stone2, null, { seg: 8, rise: (zT - z0 - hw) * 0.68 });
    for (const f of [0.55, 1.0, 1.45]) tw[k].arch(q * f - q * 0.1, q * f + q * 0.1, (zT - z0 - hw) * 0.2, (zT - z0 - hw) * 0.46, 0.01, pal.win, null, { seg: 4 });
  }
  // semi-domes stepping down from the tympanum line, each with its shoulder domes
  const semi = (onA, sg) => {
    const X = (u, v) => (onA ? [aH + u, cH + v] : [aH + v, cH + u]);
    const [ca, cc] = X(sg * q, 0), zs = z0 + hw;
    const prof = [[R, zs], [R * 0.97, zs + R * 0.25], [R * 0.84, zs + R * 0.48], [R * 0.6, zs + R * 0.64], [R * 0.3, zs + R * 0.72], [0.001, zs + R * 0.74]];
    const mid = onA ? (sg > 0 ? 0 : Math.PI) : (sg > 0 ? Math.PI / 2 : -Math.PI / 2);
    G.latheL(ca, cc, prof, 8, pal.lead, { t0: mid - Math.PI / 2, t1: mid + Math.PI / 2 });
    for (const sv of [-1, 1]) {
      const r2 = R * 0.3, [da, dc] = X(sg * (q + R * 0.35), sv * R * 0.95);
      G.latheL(da, dc, [[r2, zs], [r2 * 0.85, zs + r2 * 0.5], [r2 * 0.45, zs + r2 * 0.85], [0, zs + r2 * 0.95]], 8, pal.lead);
    }
  };
  if (semiA) { semi(true, -1); semi(true, 1); }
  if (semiC) { semi(false, -1); semi(false, 1); }
  // buttress turrets at the square's corners, each with a little dome
  for (const sa of [-1, 1]) for (const sc of [-1, 1]) {
    const ta = aH + sa * q * 0.96, tc = cH + sc * q * 0.96, rt = R * 0.13, ztop = zT + R * 0.3;
    G.latheL(ta, tc, [[rt, z0 + hw], [rt, ztop]], 8, pal.stone2);
    G.latheL(ta, tc, [[rt * 1.15, ztop], [rt * 0.8, ztop + rt * 0.8], [0, ztop + rt * 1.5]], 8, pal.lead);
  }
  // drum (windowed) and the lead dome, crowned by the alem
  const dH = R * 0.26, Nd = 16;
  G.latheL(aH, cH, [[R, zT], [R, zT + dH * 0.2]], Nd, pal.stone);
  G.latheL(aH, cH, [[R, zT + dH * 0.2], [R, zT + dH * 0.8]], Nd, (i) => (i % 2 ? pal.stone : pal.win));
  G.latheL(aH, cH, [[R, zT + dH * 0.8], [R * 1.03, zT + dH]], Nd, pal.stone2);
  const zD = zT + dH, dome = [[R * 1.02, zD], [R * 0.98, zD + R * 0.26], [R * 0.86, zD + R * 0.52], [R * 0.64, zD + R * 0.74], [R * 0.36, zD + R * 0.88], [0, zD + R * 0.93]];
  G.latheL(aH, cH, dome, Nd, (i, k) => (k === 0 ? pal.leadDark : pal.lead));
  const apex = zD + R * 0.93;
  alemL(G, aH, cH, apex, R * 0.55, pal.gold);

  // FORECOURT — an arcaded court with a row of small domes and the ablution fountain
  // minarets about half again the dome's height (Süleymaniye 76 m over a 53 m dome)
  const mTop = Math.min(z0 + H * 0.995, z0 + (apex - z0) * 1.6);
  const rM = clamp(C * 0.021, 0.05, 0.22);
  if (courtL > C * 0.2) {
    const pd = Math.min(courtL, Wc) * 0.16, hcl = hw * 0.5;
    const a0 = cA0, a1 = hA0, c0 = hc0, c1 = hc1;
    // the four portico ranges (front + two sides; the hall closes the rear)
    const ranges = [[a0, a0 + pd, c0, c1, 'front'], [a0 + pd, a1, c0, c0 + pd, 'left'], [a0 + pd, a1, c1 - pd, c1, 'right']];
    for (const [ra0, ra1, rc0, rc1] of ranges) G.boxL(ra0, ra1, rc0, rc1, z0, z0 + hcl, { side: pal.stone, top: pal.stone2 });
    G.quadL([[a0 + pd, c0 + pd, z0 + 0.01], [a1, c0 + pd, z0 + 0.01], [a1, c1 - pd, z0 + 0.01], [a0 + pd, c1 - pd, z0 + 0.01]], pal.court, { dir: [0, 0, 1] });
    // arcades on the court faces (the shaded porticoes read as a row of arches)
    const inner = [
      G.wallL(a0 + pd, c0 + pd, z0, [0, 1], [1, 0]), G.wallL(a0 + pd, c0 + pd, z0, [1, 0], [0, 1]), G.wallL(a0 + pd, c1 - pd, z0, [1, 0], [0, -1]),
    ];
    const lens = [c1 - c0 - pd * 2, a1 - a0 - pd, a1 - a0 - pd];
    inner.forEach((w, i) => { const n = Math.max(2, Math.round(lens[i] / pd)); G.bays(w, lens[i], n, (ww, s, bay) => ww.arch(s - bay * 0.36, s + bay * 0.36, 0, hcl * 0.55, bay * 0.08, pal.shade, null, { seg: 4 })); });
    // outer faces: small windows
    const outer = G.wallsL(a0, a1, c0, c1, z0);
    for (const k of ['front', 'left', 'right']) {
      const len = outer.len[k], n = Math.max(2, Math.round(len / pd));
      G.bays(outer[k], len, n, (ww, s, bay) => { if (!(k === 'front' && Math.abs(s - len / 2) < bay * 0.6)) ww.arch(s - bay * 0.12, s + bay * 0.12, hcl * 0.25, hcl * 0.55, 0.01, pal.win, null, { seg: 4 }); });
    }
    // the row of small domes over every bay
    const rd = pd * 0.4, zc = z0 + hcl;
    const smallDome = (da, dc) => G.latheL(da, dc, [[rd, zc], [rd * 0.86, zc + rd * 0.5], [rd * 0.45, zc + rd * 0.86], [0, zc + rd * 0.95]], 8, pal.lead);
    { const n = Math.max(2, Math.round((c1 - c0) / pd)); for (let i = 0; i < n; i++) smallDome(a0 + pd / 2, c0 + (c1 - c0) * (i + 0.5) / n); }
    for (const cc of [c0 + pd / 2, c1 - pd / 2]) { const n = Math.max(1, Math.round((a1 - a0 - pd) / pd)); for (let i = 0; i < n; i++) smallDome(a0 + pd + (a1 - a0 - pd) * (i + 0.5) / n, cc); }
    // the entrance portal in the front range, taller, with its own dome
    const ep = pd * 1.6;
    G.boxL(a0, a0 + pd * 1.05, cH - ep / 2, cH + ep / 2, z0, z0 + hcl * 1.45, { side: pal.stone, top: pal.stone2 });
    G.wallL(a0, cH - ep / 2, z0, [0, 1], [-1, 0]).arch(ep * 0.25, ep * 0.75, 0, hcl * 0.7, ep * 0.08, pal.win, null, { seg: 6, pointed: true, frame: ep * 0.03 });
    G.latheL(a0 + pd * 0.52, cH, [[pd * 0.45, z0 + hcl * 1.45], [pd * 0.36, z0 + hcl * 1.45 + pd * 0.3], [0, z0 + hcl * 1.45 + pd * 0.48]], 8, pal.lead);
    // the şadırvan: an octagonal fountain kiosk under a broad lead hat
    const fa = (a0 + pd + a1) / 2, fr = Math.min(pd * 0.6, (a1 - a0 - pd) * 0.18), fz = z0 + hcl * 0.45;
    G.latheL(fa, cH, [[fr, z0], [fr, fz]], 8, pal.stone2);
    G.latheL(fa, cH, [[fr * 1.5, fz], [fr * 0.9, fz + fr * 0.35], [0, fz + fr * 0.75]], 8, pal.lead);
    // FOUR minarets at the court's corners (the Süleymaniye read)
    const mi = rM * 2.4;
    const spots = [[a0 + mi, c0 + mi], [a0 + mi, c1 - mi], [a1 - mi * 0.2, c0 + mi], [a1 - mi * 0.2, c1 - mi]];
    spots.forEach(([ma, mc], i) => pencilMinaret(G, ma, mc, z0, i < 2 ? mTop - (mTop - z0) * 0.14 : mTop, rM, pal, { balconies: i < 2 ? 2 : 3, base: hcl * 1.02 }));
    // the outer precinct ahead of the court, if the lot runs on
    if (cA0 > C * 0.12) {
      const pz = z0 + hw * 0.14, t = C * 0.02;
      G.boxL(0, cA0, 0, t, z0, pz, pal.stone2); G.boxL(0, cA0, C - t, C, z0, pz, pal.stone2);
      G.boxL(0, t, 0, C * 0.36, z0, pz, pal.stone2); G.boxL(0, t, C * 0.64, C, z0, pz, pal.stone2);
      G.quadL([[t, t, z0 + 0.008], [cA0, t, z0 + 0.008], [cA0, C - t, z0 + 0.008], [t, C - t, z0 + 0.008]], pal.court, { dir: [0, 0, 1] });
    }
  } else {
    // no room for a court: two minarets at the hall's front corners
    const mi = rM * 2.2;
    for (const mc of [hc0 + mi, hc1 - mi]) pencilMinaret(G, hA0 + mi, mc, z0, mTop, rM, pal, { balconies: 2, base: hw * 0.5 });
  }
  return G.faces;
}

const PERSIAN = { brick: '#c8b28c', brick2: '#b9a37e', tile: '#2f5d86', tile2: '#284f73', turq: '#3a9c9a', dome: '#3aa39f', domeDark: '#2e8784', callig: '#d7dcd4', iwan: '#1f2a36', cell: '#5b7f96', pool: '#7d98a0', gold: '#c8a24c', win: '#26303a' };

/** A Persian pishtaq facing −a: a tiled rectangular frame round a pointed iwan with a muqarnas hood. */
function pishtaq(G, a, cMid, pw, pD, hp, z0, pal) {
  G.boxL(a, a + pD, cMid - pw / 2, cMid + pw / 2, z0, z0 + hp, { side: pal.brick, top: pal.brick2 });
  const w = G.wallL(a, cMid - pw / 2, z0, [0, 1], [-1, 0]);
  const bw = pw * 0.07;
  w.rect(bw * 0.5, 0, pw - bw * 0.5, hp * 0.97, pal.tile, 0.006);                                   // the tiled field
  w.proud(bw * 0.5, hp * 0.86, pw - bw * 0.5, hp * 0.94, bw * 0.2, pal.callig);                    // the inscription band
  w.proud(bw * 0.5, 0, bw * 1.3, hp * 0.86, bw * 0.25, pal.turq);                                  // the frame, left
  w.proud(pw - bw * 1.3, 0, pw - bw * 0.5, hp * 0.86, bw * 0.25, pal.turq);                        // the frame, right
  const aw = pw * 0.58, s0 = (pw - aw) / 2, tS = Math.min(hp * 0.5, hp * 0.82 - aw * 0.87);
  w.arch(s0, s0 + aw, 0, tS, aw * 0.1, pal.iwan, null, { seg: 8, pointed: true, frame: bw * 0.35 });
  // muqarnas: a lit hood over the springing, honeycombed with rows of small pointed niches
  const hood = G.K.wall(w.at(0, 0, 0.008), w.u, w.v, w.n), cell = G.K.wall(w.at(0, 0, 0.016), w.u, w.v, w.n);
  hood.arch(s0 + aw * 0.07, s0 + aw * 0.93, tS - aw * 0.02, tS, 0.0005, pal.cell, null, { seg: 8, pointed: true });
  for (let r = 0; r < 4; r++) {
    const nC = 5 - r, cw = (aw * 0.78 * (1 - r * 0.2)) / nC, t = tS - aw * 0.02 + r * aw * 0.17;
    for (let k = 0; k < nC; k++) {
      const sc = pw / 2 + (k - (nC - 1) / 2) * cw;
      cell.arch(sc - cw * 0.3, sc + cw * 0.3, t, t + aw * 0.05, 0.0005, pal.iwan, null, { seg: 4, pointed: true });
    }
  }
  w.rect(pw / 2 - aw * 0.18, 0, pw / 2 + aw * 0.18, tS * 0.62, mixHex(pal.iwan, pal.brick, 0.25), 0.02);    // the door at the back of the iwan
  // spandrel panels above the arch
  w.rect(bw * 1.5, tS + aw * 0.9, pw - bw * 1.5, hp * 0.84, pal.tile2, 0.01);
}

/** A Persian minaret: a banded brick-and-tile shaft, a corbelled balcony, a little tiled cap. */
function persianMinaret(G, a, c, zb, zTop, rM, pal) {
  const h = zTop - zb, zBal = zb + h * 0.8;
  const prof = [[rM * 1.12, zb], [rM * 1.04, zb + h * 0.22], [rM, zb + h * 0.26], [rM * 0.97, zb + h * 0.44], [rM * 0.95, zb + h * 0.48], [rM * 0.92, zb + h * 0.66], [rM * 0.9, zBal - rM]];
  G.latheL(a, c, prof, 12, (i, k) => (k === 0 ? pal.brick : k === 1 || k === 3 ? pal.callig : k === 2 ? ((i % 2) ? pal.brick : pal.tile) : k === 4 ? ((i % 2) ? pal.tile : pal.brick) : pal.turq));
  G.latheL(a, c, [[rM * 0.9, zBal - rM], [rM * 1.55, zBal], [rM * 1.55, zBal + rM * 0.35]], 12, (i, k) => (k === 0 ? pal.turq : pal.callig), { capTop: pal.brick2 });
  const zk = zBal + rM * 0.35, kh = h * 0.1;
  G.latheL(a, c, [[rM * 0.72, zk], [rM * 0.72, zk + kh]], 12, (i) => (i % 2 ? pal.win : pal.turq));
  G.latheL(a, c, [[rM * 0.95, zk + kh], [rM * 0.95, zk + kh + rM * 0.2], [rM * 0.7, zk + kh + rM * 0.9], [0, zTop - h * 0.02]], 12, pal.dome);
  G.latheL(a, c, [[rM * 0.08, zTop - h * 0.02], [0, zTop]], 4, pal.gold);
}

function persian(b, ctx) {
  const G = localKit(b, ctx);
  const { A, C, z0, H } = G;
  const pal = { ...PERSIAN, ...(b.churchPalette?.dome ? { dome: b.churchPalette.dome } : {}) };
  const cH = C / 2, m = C * 0.02;
  // PLAN along a: [entry portal] [four-iwan court] [pishtaq + minarets] [domed sanctuary]
  const hasCourt = A > C * 1.45;
  const Sc = C * 0.94, pD0 = C * 0.12;                        // the sanctuary's width; the pishtaq's depth
  const Sa = hasCourt ? Math.min(Sc, A * 0.5) : A - m - pD0 * 0.5;   // its length on a
  const sa0 = A - m - Sa, sc0 = cH - Sc / 2, sc1 = cH + Sc / 2;
  const S = Math.min(Sa, Sc);
  const Rd = S * 0.33;                                       // the drum radius
  let hs = Math.min(H * 0.28, S * 0.5);
  // the dome stack: sanctuary walls → octagonal zone → high tiled drum → the bulb
  const zone = Rd * 0.35, drumH = Rd * 1.05, bulbH = Rd * 1.95;
  const k = Math.min(1, (H * 0.86 - hs) / (zone + drumH + bulbH));
  const zZ = z0 + hs, zDr = zZ + zone * k, zB = zDr + drumH * k, apex = zB + bulbH * k;
  G.boxL(sa0, A - m, sc0, sc1, z0, zZ, { side: pal.brick, top: pal.brick2 });
  const dc = A - m - Math.min(Sa, Sc * 1.1) / 2;             // the dome over the qibla end
  const sw = G.wallsL(sa0, A - m, sc0, sc1, 0);
  for (const kk of ['left', 'right', 'back']) {
    const len = sw.len[kk], n = Math.max(3, Math.round(len / (hs * 0.45)));
    sw[kk].rect(0, hs * 0.86, len, hs * 0.94, pal.tile, 0.006);
    G.bays(sw[kk], len, n, (w, s, bay) => w.arch(s - bay * 0.3, s + bay * 0.3, hs * 0.14, hs * 0.5, bay * 0.08, mixHex(pal.brick, pal.iwan, 0.55), null, { seg: 6, pointed: true }));
  }
  G.latheL(dc, cH, [[Rd * 1.22, zZ], [Rd * 1.08, zDr]], 8, pal.brick2, { t0: Math.PI / 8, t1: Math.PI / 8 + TAU });
  const Nd = 16;
  G.latheL(dc, cH, [[Rd, zDr], [Rd, zDr + (zB - zDr) * 0.2]], Nd, pal.tile2);
  G.latheL(dc, cH, [[Rd, zDr + (zB - zDr) * 0.2], [Rd, zDr + (zB - zDr) * 0.62]], Nd, (i) => (i % 2 ? pal.win : pal.tile));
  G.latheL(dc, cH, [[Rd, zDr + (zB - zDr) * 0.62], [Rd, zDr + (zB - zDr) * 0.84]], Nd, pal.callig);
  G.latheL(dc, cH, [[Rd, zDr + (zB - zDr) * 0.84], [Rd * 1.04, zB]], Nd, pal.tile);
  const bh = apex - zB;
  const bulb = [[1.03, 0], [1.1, 0.1], [1.13, 0.24], [1.06, 0.4], [0.88, 0.56], [0.6, 0.72], [0.3, 0.86], [0.1, 0.95], [0, 1]].map(([r, t]) => [Rd * r, zB + bh * t]);
  G.latheL(dc, cH, bulb, Nd, (i, kk) => (kk === 0 ? pal.domeDark : (i % 2 ? pal.dome : mixHex(pal.dome, pal.domeDark, 0.3))));
  G.latheL(dc, cH, [[Rd * 0.05, apex], [0, apex + Math.min(H * 0.99 + z0 - apex, Rd * 0.3)]], 4, pal.gold);
  // THE PISHTAQ before the dome, flanked by two minarets
  const pw = Math.min(C * 0.62, Sc * 0.66), pD = pD0, hp = Math.min(zB - z0, (apex - z0) * 0.62);
  const pa = Math.max(sa0 - pD * 0.5, C * 0.03);             // set back a hair: the frame and hood stand proud of it
  pishtaq(G, pa, cH, pw, pD, hp, z0, pal);
  const rM = clamp(C * 0.026, 0.05, 0.24), mTop = z0 + Math.min(H * 0.995, (apex - z0) * 1.3);
  for (const sc of [-1, 1]) persianMinaret(G, pa + pD * 0.5, cH + sc * (pw / 2 + rM * 1.25), z0, mTop, rM, pal);
  if (hasCourt) {
    // THE COURT: two-tier arcaded ranges round a pool, an iwan at the middle of each side
    const a0 = 0, a1 = pa, pd = Math.min(C, a1) * 0.13, hc = hs * 0.62;
    const ranges = [[a0, a0 + pd, 0, C], [a0 + pd, a1, 0, pd], [a0 + pd, a1, C - pd, C]];
    for (const [r0, r1, q0, q1] of ranges) G.boxL(r0, r1, q0, q1, z0, z0 + hc, { side: pal.brick, top: pal.brick2 });
    G.quadL([[pd, pd, z0 + 0.01], [a1, pd, z0 + 0.01], [a1, C - pd, z0 + 0.01], [pd, C - pd, z0 + 0.01]], mixHex(pal.brick, '#d8cfbd', 0.5), { dir: [0, 0, 1] });
    const pl = Math.min((a1 - pd) * 0.4, (C - pd * 2) * 0.3);
    G.quadL([[(pd + a1) / 2 - pl, cH - pl * 0.5, z0 + 0.02], [(pd + a1) / 2 + pl, cH - pl * 0.5, z0 + 0.02], [(pd + a1) / 2 + pl, cH + pl * 0.5, z0 + 0.02], [(pd + a1) / 2 - pl, cH + pl * 0.5, z0 + 0.02]], pal.pool, { dir: [0, 0, 1] });
    const inner = [[G.wallL(pd, pd, z0, [0, 1], [1, 0]), C - pd * 2], [G.wallL(pd, pd, z0, [1, 0], [0, 1]), a1 - pd], [G.wallL(pd, C - pd, z0, [1, 0], [0, -1]), a1 - pd]];
    for (const [w, len] of inner) {
      const n = Math.max(3, Math.round(len / (hc * 0.45)));
      w.rect(0, hc * 0.9, len, hc, pal.tile, 0.006);
      G.bays(w, len, n, (ww, s, bay) => { if (Math.abs(s - len / 2) > bay * 0.7) { ww.arch(s - bay * 0.3, s + bay * 0.3, 0, hc * 0.24, bay * 0.06, pal.iwan, null, { seg: 4, pointed: true }); ww.arch(s - bay * 0.3, s + bay * 0.3, hc * 0.5, hc * 0.68, bay * 0.06, pal.iwan, null, { seg: 4, pointed: true }); } });
      // the side iwan: a small tiled pishtaq rising over the arcade at mid-side
      const iw = Math.min(len * 0.3, hc * 0.9);
      w.proud(len / 2 - iw / 2, 0, len / 2 + iw / 2, hc * 1.35, pd * 0.15, pal.tile);
      w.arch(len / 2 - iw * 0.3, len / 2 + iw * 0.3, 0, hc * 0.62, iw * 0.08, pal.iwan, null, { seg: 6, pointed: true });
    }
    // the outer walls: blind arcading in brick, a tile band
    const ow = G.wallsL(0, a1, 0, C, z0);
    for (const kk of ['front', 'left', 'right']) {
      const len = ow.len[kk], n = Math.max(3, Math.round(len / (hc * 0.45)));
      ow[kk].rect(0, hc * 0.88, len, hc * 0.96, pal.tile, 0.006);
      G.bays(ow[kk], len, n, (ww, s, bay) => { if (!(kk === 'front' && Math.abs(s - len / 2) < bay)) ww.arch(s - bay * 0.28, s + bay * 0.28, hc * 0.12, hc * 0.52, bay * 0.05, pal.brick2, null, { seg: 4, pointed: true }); });
    }
    // the entry portal: a smaller pishtaq on the street
    pishtaq(G, C * 0.03, cH, Math.min(C * 0.36, pw * 0.62), pd * 0.9, hc * 1.55, z0, pal);
  }
  return G.faces;
}

const SAHEL = { mud: '#a57d58', mud2: '#957050', mudLit: '#ae8660', toron: '#57402c', egg: '#ece5d4', dark: '#3a2a1c', plinth: '#8f6c4c' };

function sahelian(b, ctx) {
  const G = localKit(b, ctx);
  const { A, C, z0, H } = G;
  const pal = { ...SAHEL, ...(b.churchPalette?.wall ? { mud: b.churchPalette.wall } : {}) };
  const cH = C / 2, pz = z0 + Math.min(H * 0.035, C * 0.045);
  // the raised plinth over the whole lot
  G.boxL(0, A, 0, C, z0, pz, { side: pal.plinth, top: mixHex(pal.plinth, pal.mudLit, 0.4) });
  // Djenné is broad and low: the towers stand about a facade's width high at most
  const topC = z0 + Math.min(H * 0.995, C * 1.1), topS = z0 + (topC - z0) * 0.84;
  const hw = (topC - z0) * 0.46;                               // the wall head (above z0)
  const sp = clamp(hw * 0.2, C * 0.035, C * 0.08);             // pilaster spacing
  const pw = sp * 0.42, pdp = pw * 0.55, pin = pw * 1.7, mg = pdp * 2.2;
  const course = hw * 0.2;                                     // toron courses, shared by walls and towers
  const pinnacle = (p, r, h, tint = pal.mudLit) => G.K.lathe(p[0], p[1], [[r, p[2]], [r * 0.92, p[2] + h * 0.4], [r * 0.6, p[2] + h * 0.78], [0, p[2] + h]], 6, tint);
  // a mud wall run: pilasters rising through the parapet into rounded pinnacles, toron in courses
  const mudWall = (w, len, top, zBase, { skip = null } = {}) => {
    const n = Math.max(2, Math.round(len / sp)), bay = len / n;
    w.proud(0, top * 0.93, len, top, pdp * 0.25, pal.mud2);                                  // the parapet coping
    for (let i = 0; i <= n; i++) {
      const s = clamp(i * bay - pw / 2, 0, len - pw);
      if (skip && skip(s + pw / 2)) continue;
      w.proud(s, 0, s + pw, top + pin * 0.3, pdp, pal.mudLit, pal.mud2);
      pinnacle(w.at(s + pw / 2, top + pin * 0.3, pdp * 0.5), pw * 0.5, pin);
    }
    for (let k = 1; k * course < top * 0.88; k++) {
      const t = k * course - (zBase - pz), st = pw * 0.2;
      if (t < top * 0.12) continue;
      for (let i = 0; i < n; i++) {
        const s = (i + 0.5) * bay;
        if (skip && skip(s)) continue;
        w.proud(s - st / 2, t - st / 2, s + st / 2, t + st / 2, pdp * 1.9, pal.toron);
      }
    }
  };
  // PLAN along a: [three towers] [the qibla wall and prayer hall] [the walled court behind]
  const td = C * 0.09, ha0 = mg + td;
  const hallL = Math.min(A - ha0 - mg, Math.max(C * 0.6, (A - ha0) * 0.55));
  const ha1 = ha0 + hallL, C0 = mg, C1 = C - mg;
  G.boxL(ha0, ha1, C0, C1, pz, z0 + hw, { side: pal.mud, top: pal.mud2 });
  const hwl = G.wallsL(ha0, ha1, C0, C1, pz), hwTop = z0 + hw - pz;
  const tc = [C * 0.2, cH, C * 0.8], tW = [C * 0.15, C * 0.22, C * 0.15], tEnd = [topS, topC, topS];
  const inTower = (s) => tc.some((c, i) => Math.abs(s + C0 - c) < tW[i] * 0.6);
  mudWall(hwl.front, hwl.len.front, hwTop, pz, { skip: inTower });
  mudWall(hwl.left, hwl.len.left, hwTop, pz);
  mudWall(hwl.right, hwl.len.right, hwTop, pz);
  if (ha1 >= A - mg - 0.01) mudWall(hwl.back, hwl.len.back, hwTop, pz);
  // the roof: a grid of vents with their terracotta caps
  for (let i = 1; i < 4; i++) for (let j = 1; j < 4; j++) {
    const va = ha0 + (hallL * i) / 4, vc = C0 + ((C1 - C0) * j) / 4, vr = sp * 0.14;
    G.boxL(va - vr, va + vr, vc - vr, vc + vr, z0 + hw, z0 + hw + vr * 1.2, { side: pal.mud2, top: pal.dark });
  }
  // THE THREE TOWERS on the qibla wall, the centre one broadest and highest
  tc.forEach((c, i) => {
    const w = tW[i], zt = z0 + (tEnd[i] - z0) * 0.8, ins = w * 0.15;
    const d0 = mg, d1 = ha0 + w * 0.25;
    const bt = G.batter(d0, d1, c - w / 2, c + w / 2, pz, zt, ins, pal.mud, pal.mud2);
    const f = bt.front, len = w, sl = bt.slant, rw = len * 0.14;
    // ribs up the face, each running on into a pinnacle over the tower's head
    for (const s of [len * 0.2, len * 0.5, len * 0.8]) {
      f.proud(s - rw / 2, 0, s + rw / 2, sl, rw * 0.45, pal.mudLit, pal.mud2);
      if (s !== len * 0.5) pinnacle(f.at(s, sl, rw * 0.2), rw * 0.55, pin * 1.2);
    }
    // toron on the same courses as the walls, between the ribs
    for (let k = 1; k * course < (zt - pz) * 0.92; k++) {
      const t = k * course * (sl / (zt - pz)), st = rw * 0.3;
      for (const s of [len * 0.35, len * 0.65]) f.proud(s - st / 2, t - st / 2, s + st / 2, t + st / 2, rw * 1.1, pal.toron);
      for (const side of [bt.left, bt.right]) { const sm = (d1 - d0) / 2; side.proud(sm - st / 2, t - st / 2, sm + st / 2, t + st / 2, rw * 1.1, pal.toron); }
    }
    if (i === 1) f.arch(len * 0.38, len * 0.62, 0, sl * 0.2, 0.01, pal.dark, null, { seg: 4, rise: len * 0.08 });
    // the crown: a blunt mud cone stepping up to the ostrich egg
    const ca = (d0 + d1) / 2, rr = Math.min((d1 - d0) / 2, w / 2) - ins;
    const eggH = Math.min((tEnd[i] - zt) * 0.3, rr * 0.9), coneTop = tEnd[i] - eggH;
    G.latheL(ca, c, [[rr * 0.62, zt], [rr * 0.5, zt + (coneTop - zt) * 0.5], [rr * 0.3, zt + (coneTop - zt) * 0.85], [rr * 0.14, coneTop]], 8, pal.mudLit, { t0: Math.PI / 8, t1: Math.PI / 8 + TAU });
    const er = Math.min(rr * 0.3, eggH * 0.36);
    G.latheL(ca, c, [[0.001, coneTop], [er * 0.9, coneTop + eggH * 0.22], [er, coneTop + eggH * 0.5], [er * 0.7, coneTop + eggH * 0.82], [0, coneTop + eggH]], 8, pal.egg);
  });
  // corner buttresses at the qibla wall's ends
  for (const c of [C0 + pw * 1.2, C1 - pw * 1.2]) {
    const bw = pw * 2.4, zt = z0 + hw + pin * 0.6;
    G.batter(mg, ha0 + bw * 0.5, c - bw / 2, c + bw / 2, pz, zt, bw * 0.08, pal.mudLit, pal.mud2);
    pinnacle(G.F.P((mg + ha0 + bw * 0.5) / 2, c, zt), bw * 0.42, pin * 1.3);
  }
  // THE COURT behind: lower mud walls with the same pilasters, a gate in the back wall
  if (A - ha1 > C * 0.15) {
    const ch = hwTop * 0.62, t = sp * 0.35, A1 = A - mg;
    const rng = [[ha1, A1, C0, C0 + t], [ha1, A1, C1 - t, C1], [A1 - t, A1, C0, C1]];
    for (const [r0, r1, q0, q1] of rng) G.boxL(r0, r1, q0, q1, pz, pz + ch, { side: pal.mud, top: pal.mud2 });
    mudWall(G.wallL(A1, C0, pz, [-1, 0], [0, -1]), A1 - ha1, ch, pz);
    mudWall(G.wallL(ha1, C1, pz, [1, 0], [0, 1]), A1 - ha1, ch, pz);
    mudWall(G.wallL(A1, C1, pz, [0, -1], [1, 0]), C1 - C0, ch, pz, { skip: (s) => Math.abs(s - (C1 - C0) / 2) < sp * 0.9 });
    G.quadL([[ha1, C0 + t, pz + 0.01], [A1 - t, C0 + t, pz + 0.01], [A1 - t, C1 - t, pz + 0.01], [ha1, C1 - t, pz + 0.01]], mixHex(pal.plinth, pal.mudLit, 0.6), { dir: [0, 0, 1] });
  }
  return G.faces;
}

const NUSANTARA = { brick: '#9a5f48', brick2: '#86523f', plaster: '#e4ddcb', plaster2: '#d3cbb7', roof: '#4d4038', roof2: '#43372f', soffit: '#2e2620', timber: '#5d4332', stone: '#9d968a', gold: '#b99a52', dark: '#2a211b', yard: '#bdb6a6' };

function nusantara(b, ctx) {
  const G = localKit(b, ctx);
  const { A, C, z0, H } = G;
  const pal = { ...NUSANTARA, ...(b.churchPalette?.roof ? { roof: b.churchPalette.roof } : {}) };
  const cH = C / 2;
  // PLAN along a: [gate + low wall] [yard] [serambi veranda] [main hall under the tajug]
  const S = Math.min(C * 0.92, A * 0.6);                       // the lowest roof tier's outer square
  const ha = A - S / 2 - C * 0.03;                             // the hall's centre on a
  const plinthH = Math.min(H * 0.04, S * 0.05);
  const B = S * 0.7;                                          // the columned hall under the eaves
  // roof heights: eave, three tiers, the mustaka — as fractions of what z1 allows
  const eave = Math.min(H * 0.2, S * 0.3);
  const t1 = S * 0.2, g1 = S * 0.06, t2 = S * 0.21, g2 = S * 0.05, t3 = S * 0.34, mk = S * 0.16;
  const k = Math.min(1.35, (H * 0.9 - eave - plinthH) / (t1 + g1 + t2 + g2 + t3 + mk));
  // the stone plinth and the hall: a plaster core, a ring of timber posts
  G.boxL(ha - B / 2 - S * 0.04, ha + B / 2 + S * 0.04, cH - B / 2 - S * 0.04, cH + B / 2 + S * 0.04, z0, z0 + plinthH, { side: pal.stone, top: mixHex(pal.stone, pal.plaster, 0.4) });
  const zp = z0 + plinthH, ze = zp + eave;
  const core = B * 0.66;
  G.boxL(ha - core / 2, ha + core / 2, cH - core / 2, cH + core / 2, zp, ze, { side: pal.plaster, top: pal.plaster2 });
  const cw = G.wallsL(ha - core / 2, ha + core / 2, cH - core / 2, cH + core / 2, zp);
  for (const kk of ['front', 'left', 'right', 'back']) G.bays(cw[kk], core, 3, (w, s, bay, i) => {
    if (i === 1) w.recess(s - bay * 0.22, 0, s + bay * 0.22, eave * 0.68, bay * 0.06, pal.timber, null, { frame: bay * 0.04 });
    else w.recess(s - bay * 0.14, eave * 0.3, s + bay * 0.14, eave * 0.62, bay * 0.05, pal.dark, null);
  });
  const nP = 4, rp = B * 0.016;
  for (let i = 0; i < nP; i++) for (let j = 0; j < nP; j++) {
    if (i > 0 && i < nP - 1 && j > 0 && j < nP - 1) continue;
    const pa = ha - B / 2 + (B * i) / (nP - 1), pc = cH - B / 2 + (B * j) / (nP - 1);
    G.boxL(pa - rp, pa + rp, pc - rp, pc + rp, zp, ze, pal.timber);
  }
  // a beam ring on the posts
  G.boxL(ha - B / 2 - rp, ha + B / 2 + rp, cH - B / 2 - rp, cH - B / 2 + rp, ze - eave * 0.08, ze, pal.timber);
  G.boxL(ha - B / 2 - rp, ha + B / 2 + rp, cH + B / 2 - rp, cH + B / 2 + rp, ze - eave * 0.08, ze, pal.timber);
  G.boxL(ha - B / 2 - rp, ha - B / 2 + rp, cH - B / 2, cH + B / 2, ze - eave * 0.08, ze, pal.timber);
  G.boxL(ha + B / 2 - rp, ha + B / 2 + rp, cH - B / 2, cH + B / 2, ze - eave * 0.08, ze, pal.timber);
  // THE TAJUG: three pyramidal tiers, each steeper, with plastered clerestory steps between
  const o1 = S / 2, i1 = S * 0.21, z1a = ze + t1 * k;
  G.hipRing(ha, cH, o1, o1, i1, i1, ze, z1a, pal.roof, { lift: S * 0.018, soffit: pal.soffit, fascia: pal.roof2, fz: S * 0.012 });
  const z2 = z1a + g1 * k;
  G.boxL(ha - i1, ha + i1, cH - i1, cH + i1, z1a - 0.01, z2, { side: pal.plaster2, top: null });
  const o2 = i1 * 1.32, i2 = S * 0.1, z2a = z2 + t2 * k;
  G.hipRing(ha, cH, o2, o2, i2, i2, z2, z2a, pal.roof, { lift: S * 0.012, soffit: pal.soffit, fascia: pal.roof2, fz: S * 0.01 });
  const z3 = z2a + g2 * k;
  G.boxL(ha - i2, ha + i2, cH - i2, cH + i2, z2a - 0.01, z3, { side: pal.plaster2, top: null });
  const o3 = i2 * 1.4, z3a = z3 + t3 * k;
  G.hipRing(ha, cH, o3, o3, 0.0001, 0.0001, z3, z3a, pal.roof, { lift: S * 0.008, soffit: pal.soffit, fascia: pal.roof2, fz: S * 0.008 });
  // the mustaka: a crown of stacked, flaring tiers and a point
  const mh = mk * k, mr = S * 0.035;
  G.latheL(ha, cH, [[mr * 0.8, z3a - mh * 0.05], [mr * 1.25, z3a + mh * 0.18], [mr * 0.5, z3a + mh * 0.3], [mr * 1.05, z3a + mh * 0.45], [mr * 0.35, z3a + mh * 0.58], [mr * 0.7, z3a + mh * 0.7], [0, z3a + mh]], 8, pal.gold);
  // THE SERAMBI: an open veranda on posts under a low hipped roof, ahead of the hall
  const sa1 = ha - S / 2 + S * 0.02, sDepth = Math.min(S * 0.55, sa1 - C * 0.12);
  if (sDepth > S * 0.2) {
    const sa0 = sa1 - sDepth, sw = S * 0.92, sc0 = cH - sw / 2, sc1 = cH + sw / 2, se = zp + eave * 0.72;
    G.boxL(sa0 + S * 0.02, sa1, sc0 + S * 0.02, sc1 - S * 0.02, z0, zp, { side: pal.stone, top: mixHex(pal.stone, pal.plaster, 0.5) });
    const nA = 3, nC = 5;
    for (let i = 0; i < nA; i++) for (let j = 0; j < nC; j++) {
      const pa = sa0 + S * 0.05 + ((sDepth - S * 0.07) * i) / (nA - 1), pc = sc0 + S * 0.05 + ((sw - S * 0.1) * j) / (nC - 1);
      G.boxL(pa - rp, pa + rp, pc - rp, pc + rp, zp, se, pal.timber);
    }
    G.hipRoof(sa0, sa1 + S * 0.04, sc0, sc1, se, se + Math.min(sDepth, sw) * 0.36, pal.roof);
    // its soffit, dark, so the open hall reads as shade
    G.quadL([[sa0, sc0, se - 0.005], [sa1, sc0, se - 0.005], [sa1, sc1, se - 0.005], [sa0, sc1, se - 0.005]], pal.soffit, { dir: [0, 0, -1] });
  }
  // THE COMPOUND: a low plastered wall and a brick paduraksa gate (a stepped, roofed arch) on the front
  const ww = Math.min(C * 0.018, 0.15), wh = Math.min(H * 0.035, C * 0.05);
  const gate = C * 0.1;
  G.boxL(0, ww, 0, cH - gate / 2, z0, z0 + wh, { side: pal.plaster, top: pal.stone });
  G.boxL(0, ww, cH + gate / 2, C, z0, z0 + wh, { side: pal.plaster, top: pal.stone });
  G.boxL(ww, A, 0, ww, z0, z0 + wh, { side: pal.plaster, top: pal.stone });
  G.boxL(ww, A, C - ww, C, z0, z0 + wh, { side: pal.plaster, top: pal.stone });
  G.boxL(A - ww, A, ww, C - ww, z0, z0 + wh, { side: pal.plaster, top: pal.stone });
  const gw = gate * 1.6, gd = C * 0.045, gh = wh * 2.6;
  G.boxL(0, gd, cH - gw / 2, cH + gw / 2, z0, z0 + gh, { side: pal.brick, top: pal.brick2 });
  G.wallL(0, cH - gw / 2, z0, [0, 1], [-1, 0]).recess(gw * 0.3, 0, gw * 0.7, gh * 0.62, gw * 0.06, pal.dark, null);
  G.wallL(gd, cH + gw / 2, z0, [0, -1], [1, 0]).recess(gw * 0.3, 0, gw * 0.7, gh * 0.62, gw * 0.06, pal.dark, null);
  for (let st = 0; st < 3; st++) {
    const inA = gd * 0.12 * st, inC = gw * 0.13 * (st + 1), zb = z0 + gh + gh * 0.16 * st;
    G.boxL(inA, gd - inA, cH - gw / 2 + inC, cH + gw / 2 - inC, zb, zb + gh * 0.16, { side: st % 2 ? pal.brick2 : pal.brick, top: pal.brick2 });
  }
  G.quadL([[ww, ww, z0 + 0.008], [A - ww, ww, z0 + 0.008], [A - ww, C - ww, z0 + 0.008], [ww, C - ww, z0 + 0.008]], pal.yard, { dir: [0, 0, 1] });
  return G.faces;
}

// ── TEMPLE ────────────────────────────────────────────────────────────────────

const PAGODA = { post: '#9a3c2c', postDark: '#7e3024', plaster: '#e6e0d0', tile: '#3f4144', tile2: '#34363a', soffit: '#4a3b31', bracket: '#5e4a36', stone: '#a39c90', bronze: '#9c8a5a', gold: '#c6a24e', door: '#3b2a20', path: '#b9b3a6', lantern: '#9c968b' };

function pagoda(b, ctx) {
  const G = localKit(b, ctx);
  const { A, C, z0, H } = G;
  const pal = { ...PAGODA, ...(b.churchPalette?.wall ? { post: b.churchPalette.wall } : {}) };
  const cH = C / 2;
  const E = Math.min(C, A) * 0.97;                            // the lowest eave's square
  const pa = A - E / 2 - Math.min(C, A) * 0.015;              // the tower's centre on a
  const B1 = E * 0.48, ov = (E - B1) / 2;                     // body width, eave overhang
  // height: 70% the five-storey stack, 30% the sōrin
  const plinth = Math.min(H * 0.035, E * 0.06);
  const stack = H * 0.69 - plinth, u = stack / (5 - 0.07 * 10);
  G.boxL(pa - E * 0.34, pa + E * 0.34, cH - E * 0.34, cH + E * 0.34, z0, z0 + plinth, { side: pal.stone, top: mixHex(pal.stone, pal.plaster, 0.3) });
  let z = z0 + plinth;
  let bodyTop = z;
  for (let i = 0; i < 5; i++) {
    const unit = u * (1 - 0.07 * i), bh = unit * 0.6, rise = unit * 0.4;
    const bw = B1 * (1 - 0.1 * i), hb = bw / 2;
    const oh = hb + ov * (1 - 0.07 * i);
    // the storey's body: vermilion posts and rails, white plaster panels, a dark door in the middle bay
    G.boxL(pa - hb, pa + hb, cH - hb, cH + hb, z, z + bh, { side: pal.plaster, top: null });
    const ws = G.wallsL(pa - hb, pa + hb, cH - hb, cH + hb, z);
    const brk = bh * 0.2;
    for (const kk of ['front', 'back', 'left', 'right']) {
      const w = ws[kk], pw = bw * 0.07, d = bw * 0.012;
      w.recess(bw * 0.36, 0, bw * 0.64, (bh - brk) * 0.82, bw * 0.02, pal.door, null);
      for (const s of [0, bw / 3, (bw * 2) / 3, bw]) w.proud(clamp(s - pw / 2, 0, bw - pw), 0, clamp(s - pw / 2, 0, bw - pw) + pw, bh - brk, d, pal.post, pal.postDark);
      w.proud(0, (bh - brk) * 0.84, bw, (bh - brk) * 0.92, d * 0.8, pal.post, pal.postDark);    // the tie beam
      // the bracket band under the eave: a dark frieze with a rhythm of blocks
      w.proud(0, bh - brk, bw, bh, d * 1.4, pal.bracket);
      for (const s of [bw * 0.1, bw / 3, bw / 2, (bw * 2) / 3, bw * 0.9]) w.proud(s - bw * 0.035, bh - brk * 0.85, s + bw * 0.035, bh - brk * 0.1, d * 3.2, mixHex(pal.bracket, pal.post, 0.35));
    }
    if (i > 0) {
      // the balcony round the storey's foot
      const bo = hb + bw * 0.07, rh = bh * 0.14;
      G.boxL(pa - bo, pa + bo, cH - bo, cH + bo, z, z + bh * 0.03, { side: pal.bracket, top: pal.bracket });
      for (const [a0, a1, c0, c1] of [[-bo, bo, -bo, -bo + 0.004], [-bo, bo, bo - 0.004, bo], [-bo, -bo + 0.004, -bo, bo], [bo - 0.004, bo, -bo, bo]]) G.boxL(pa + a0, pa + a1, cH + c0, cH + c1, z + bh * 0.03, z + rh, pal.post);
    }
    z += bh; bodyTop = z;
    // the deep eave and its tile roof, corners curling up
    const nextHalf = i < 4 ? (B1 * (1 - 0.1 * (i + 1))) / 2 : B1 * (1 - 0.1 * i) * 0.18;
    const lift = oh * 0.09, zr = z + (i < 4 ? rise : rise * 1.25);
    G.hipRing(pa, cH, oh, oh, nextHalf, nextHalf, z + unit * 0.06, zr, pal.tile, { lift, soffit: pal.soffit, fascia: pal.tile2, fz: unit * 0.05 });
    z = zr;
  }
  // THE SŌRIN: roban, bowl, nine rings on the mast, the water-flame and jewel
  const sTop = z0 + H * 0.995, sH = sTop - z, sr = B1 * 0.1;
  G.boxL(pa - sr, pa + sr, cH - sr, cH + sr, z - sH * 0.02, z + sH * 0.06, { side: pal.bronze, top: pal.bronze });
  G.latheL(pa, cH, [[sr * 0.95, z + sH * 0.06], [sr * 0.9, z + sH * 0.1], [sr * 0.55, z + sH * 0.14], [sr * 0.2, z + sH * 0.15]], 8, pal.bronze);
  G.latheL(pa, cH, [[sr * 0.12, z + sH * 0.15], [sr * 0.1, z + sH * 0.84]], 6, pal.bronze);
  for (let r = 0; r < 9; r++) {
    const zr = z + sH * (0.2 + r * 0.065), rr = sr * (0.82 - r * 0.02), t = sH * 0.018;
    G.latheL(pa, cH, [[sr * 0.12, zr - t], [rr, zr - t * 0.3], [rr, zr + t * 0.3], [sr * 0.12, zr + t]], 8, (ii, kk) => (kk === 1 ? pal.gold : pal.bronze));
  }
  G.latheL(pa, cH, [[sr * 0.1, z + sH * 0.8], [sr * 0.5, z + sH * 0.86], [sr * 0.3, z + sH * 0.92], [sr * 0.35, z + sH * 0.95], [0, sTop]], 6, pal.gold);
  // THE APPROACH: a stone path and paired lanterns, a small roofed gate at the street
  const front = pa - E / 2;
  if (front > C * 0.2) {
    const pw = C * 0.14;
    G.quadL([[0, cH - pw / 2, z0 + 0.01], [front + E * 0.16, cH - pw / 2, z0 + 0.01], [front + E * 0.16, cH + pw / 2, z0 + 0.01], [0, cH + pw / 2, z0 + 0.01]], pal.path, { dir: [0, 0, 1] });
    const nL = Math.max(1, Math.floor(front / (C * 0.35)));
    for (let i = 0; i < nL; i++) {
      const la = front * ((i + 0.6) / (nL + 0.3));
      for (const sc of [-1, 1]) lantern(G, la, cH + sc * pw * 1.1, z0, C * 0.035, pal);
    }
    // the gate (mon): a roofed bay between plaster walls, its roof as deep as the gate is wide
    const gw = pw * 1.7, gh = Math.min(H * 0.12, C * 0.26), gp = C * 0.018, gd = gw * 0.5, ga = C * 0.02 + gd;
    for (const sc of [-1, 1]) {
      G.boxL(ga - gd / 2, ga + gd / 2, cH + sc * gw / 2 - gp, cH + sc * gw / 2 + gp, z0, z0 + gh, pal.post);
      G.boxL(ga - gd * 0.3, ga + gd * 0.3, Math.min(cH + sc * (gw / 2 + gp), cH + sc * gw * 0.95), Math.max(cH + sc * (gw / 2 + gp), cH + sc * gw * 0.95), z0, z0 + gh * 0.7, { side: pal.plaster, top: pal.tile });
    }
    G.boxL(ga - gd / 2, ga + gd / 2, cH - gw / 2 - gp, cH + gw / 2 + gp, z0 + gh * 0.84, z0 + gh, { side: pal.bracket, top: pal.bracket });
    G.hipRing(ga, cH, gd * 0.95, gw * 0.62, gd * 0.05, gw * 0.4, z0 + gh, z0 + gh + gw * 0.28, pal.tile, { lift: gp * 0.8, soffit: pal.soffit, fascia: pal.tile2, fz: gp * 0.5 });
  } else {
    for (const sc of [-1, 1]) lantern(G, Math.max(C * 0.05, pa - E * 0.4), cH + sc * E * 0.4, z0, Math.min(C, A) * 0.03, pal);
  }
  return G.faces;
}

/** A stone lantern (tōrō): post, fire-box, a little hipped cap, a jewel. */
function lantern(G, a, c, z0, s, pal) {
  G.latheL(a, c, [[s * 0.9, z0], [s * 0.5, z0 + s * 0.4], [s * 0.35, z0 + s * 2.2]], 6, pal.lantern);
  G.boxL(a - s * 0.7, a + s * 0.7, c - s * 0.7, c + s * 0.7, z0 + s * 2.2, z0 + s * 3.1, { side: mixHex(pal.lantern, '#3a3a36', 0.35), top: pal.lantern });
  G.hipRoof(a - s * 1.1, a + s * 1.1, c - s * 1.1, c + s * 1.1, z0 + s * 3.1, z0 + s * 3.8, pal.lantern);
}

const STUPA = { saffron: '#cf9f4c', white: '#ebe7dc', white2: '#dad5c8', terrace: '#d9d3c4', gold: '#c6a14a', gold2: '#a98a3f', eye: '#f1ede2', ink: '#262320', nose: '#8e3a2e', flags: ['#3f6c9c', '#e7e3d6', '#a8473a', '#4f7d55', '#cfa843'], path: '#b8b2a5', wheel: '#7a3a2c' };

function stupa(b, ctx) {
  const G = localKit(b, ctx);
  const { A, C, z0, H } = G;
  const pal = { ...STUPA, ...(b.churchPalette?.bell ? { white: b.churchPalette.bell } : {}) };
  const cH = C / 2;
  const E = Math.min(C, A) * 0.97, ca = A - E / 2 - Math.min(C, A) * 0.015;
  // three mandala terraces, each a square with its corners stepped in
  const th = Math.min(E * 0.055, H * 0.05);
  let z = z0;
  const mandala = (h, n) => [[h, -(h - n)], [h, h - n], [h - n, h - n], [h - n, h], [-(h - n), h], [-(h - n), h - n], [-h, h - n], [-h, -(h - n)], [-(h - n), -(h - n)], [-(h - n), -h], [h - n, -h], [h - n, -(h - n)]];
  const toW = (pts) => pts.map(([da, dc]) => { const p = G.F.P(ca + da, cH + dc); return [p[0], p[1]]; });
  for (let i = 0; i < 3; i++) {
    const h = (E / 2) * (1 - i * 0.13), n = h * 0.16;
    G.K.prism(toW(mandala(h, n)), z, z + th, i % 2 ? pal.white2 : pal.terrace, { cap: mixHex(pal.terrace, pal.white, 0.5) });
    // a band of prayer-wheel niches round the lowest terrace
    z += th;
  }
  // the drum plinth, two rings
  const Rd = E * 0.31;
  G.latheL(ca, cH, [[Rd * 1.12, z], [Rd * 1.12, z + th * 0.5]], 20, pal.white2, { capTop: pal.white });
  G.latheL(ca, cH, [[Rd * 1.05, z + th * 0.5], [Rd * 1.05, z + th]], 20, pal.white, { capTop: pal.white });
  z += th;
  // the anda: a broad whitewashed dome, a gold band at its foot
  const hA = Rd * 0.72;
  const anda = [[1, 0], [0.99, 0.18], [0.94, 0.4], [0.83, 0.62], [0.64, 0.82], [0.38, 0.96], [0.2, 1]].map(([r, t]) => [Rd * r, z + hA * t]);
  // the saffron lotus petals splashed round the dome's crown
  G.latheL(ca, cH, anda, 20, (i, k) => (k === 0 ? pal.white2 : k === 4 && i % 2 ? pal.saffron : pal.white));
  z += hA;
  // the harmika: the gilded cube with the painted eyes on all four faces
  const hk = Rd * 0.3, hh = hk * 1.6;
  G.boxL(ca - hk * 1.15, ca + hk * 1.15, cH - hk * 1.15, cH + hk * 1.15, z - hA * 0.02, z + hh * 0.1, { side: pal.white2, top: pal.white });
  const hz = z + hh * 0.1;
  G.boxL(ca - hk, ca + hk, cH - hk, cH + hk, hz, hz + hh, { side: pal.gold, top: pal.gold2 });
  const hw = G.wallsL(ca - hk, ca + hk, cH - hk, cH + hk, hz);
  for (const kk of ['front', 'back', 'left', 'right']) eyes(G, hw[kk], hk * 2, hh, pal);
  G.boxL(ca - hk * 1.18, ca + hk * 1.18, cH - hk * 1.18, cH + hk * 1.18, hz + hh, hz + hh * 1.12, { side: pal.gold2, top: pal.gold });
  z = hz + hh * 1.12;
  // the thirteen gilded steps of the spire, the umbrella, the pinnacle
  const spTop = z0 + H * 0.995, spH = Math.min(spTop - z, Rd * 2.4), stepH = (spH * 0.6) / 13;
  for (let i = 0; i < 13; i++) {
    const s = hk * (1.02 - i * 0.052);
    G.boxL(ca - s, ca + s, cH - s, cH + s, z + i * stepH, z + (i + 1) * stepH * 0.985, { side: i % 2 ? pal.gold2 : pal.gold, top: pal.gold });
  }
  const zu = z + stepH * 13;
  G.latheL(ca, cH, [[hk * 0.2, zu], [hk * 0.72, zu + spH * 0.05], [hk * 0.6, zu + spH * 0.08], [hk * 0.1, zu + spH * 0.12]], 10, (i, k) => (k === 0 ? pal.gold2 : pal.gold), { capBottom: pal.wheel });
  G.latheL(ca, cH, [[hk * 0.1, zu + spH * 0.12], [hk * 0.22, zu + spH * 0.17], [hk * 0.05, zu + spH * 0.24], [hk * 0.14, zu + spH * 0.26], [0, z + spH]], 6, pal.gold);
  // prayer-flag lines from the spire down to the outer terrace corners
  const fTop = [ca, cH, zu - stepH * 1.5];
  const eh = E / 2 - 0.02;
  const ends = [[eh, 0], [eh, eh * 0.84], [0, eh], [-eh * 0.84, eh], [-eh, 0], [-eh, -eh * 0.84], [0, -eh], [eh * 0.84, -eh]];
  const fz = z0 + th * 1.2, nF = 11, fsz = E * 0.022;
  ends.forEach(([da, dc], li) => {
    const end = [ca + da, cH + dc, fz];
    for (let f = 0; f < nF; f++) {
      const t0 = (f + 0.5) / (nF + 1), t1 = t0 + 0.5 / (nF + 1);
      const sag = (t) => -Math.sin(Math.PI * t) * E * 0.08;
      const p0 = v3.lerp(fTop, end, t0), p1 = v3.lerp(fTop, end, t1);
      p0[2] += sag(t0); p1[2] += sag(t1);
      G.quadL([p0, p1, [p1[0], p1[1], p1[2] - fsz * 1.2], [p0[0], p0[1], p0[2] - fsz * 1.2]], pal.flags[(f + li) % 5], null);
    }
  });
  // the approach: a paved path and a small gateway
  const front = ca - E / 2;
  if (front > C * 0.2) {
    const pw = C * 0.12;
    G.quadL([[0, cH - pw / 2, z0 + 0.01], [front + 0.01, cH - pw / 2, z0 + 0.01], [front + 0.01, cH + pw / 2, z0 + 0.01], [0, cH + pw / 2, z0 + 0.01]], pal.path, { dir: [0, 0, 1] });
    // a row of prayer-wheel walls lining the path
    const wl = front * 0.8, wh = C * 0.06;
    for (const sc of [-1, 1]) {
      const c0 = cH + sc * pw * 0.9;
      G.boxL(front * 0.1, front * 0.1 + wl, Math.min(c0, c0 + sc * C * 0.03), Math.max(c0, c0 + sc * C * 0.03), z0, z0 + wh, { side: pal.white2, top: pal.wheel });
      const w = sc < 0 ? G.wallL(front * 0.1, Math.min(c0, c0 + sc * C * 0.03) + C * 0.03, z0, [1, 0], [0, 1]) : G.wallL(front * 0.1 + wl, Math.min(c0, c0 + sc * C * 0.03), z0, [-1, 0], [0, -1]);
      G.bays(w, wl, Math.max(3, Math.round(wl / (wh * 0.8))), (ww, s, bay) => ww.recess(s - bay * 0.3, wh * 0.2, s + bay * 0.3, wh * 0.8, bay * 0.1, pal.wheel, null));
    }
    const gw = pw * 1.8, gh = C * 0.28, gp = C * 0.025;
    for (const sc of [-1, 1]) G.boxL(C * 0.02, C * 0.02 + gp * 2, cH + sc * gw / 2 - gp, cH + sc * gw / 2 + gp, z0, z0 + gh, { side: pal.white, top: pal.white2 });
    G.boxL(C * 0.02, C * 0.02 + gp * 2, cH - gw / 2 - gp, cH + gw / 2 + gp, z0 + gh, z0 + gh + gp * 1.5, { side: pal.wheel, top: pal.gold2 });
  }
  return G.faces;
}

/** Buddha eyes on a harmika face (w: a wall frame, len × ht): brows, almond eyes, the nose-curl. */
function eyes(G, w, len, ht, pal) {
  const d = 0.004;
  for (const side of [-1, 1]) {
    const cs = len / 2 + side * len * 0.23, ez = ht * 0.5, ew = len * 0.2, eh = ht * 0.12;
    // brow: a three-piece arch
    const br = [[-1, 0.62], [-0.45, 0.8], [0.45, 0.8], [1, 0.62]].map(([u, t]) => [cs + u * ew * 1.05, ht * t]);
    for (let i = 0; i < 3; i++) G.K.quad([w.at(br[i][0], br[i][1], d), w.at(br[i + 1][0], br[i + 1][1], d), w.at(br[i + 1][0], br[i + 1][1] + ht * 0.05, d), w.at(br[i][0], br[i][1] + ht * 0.05, d)], pal.ink, { dir: w.n });
    // the almond: white, heavy-lidded, the iris low
    const alm = [[-1, 0], [-0.5, 0.75], [0.5, 0.75], [1, 0], [0.5, -0.55], [-0.5, -0.55]].map(([u, v]) => w.at(cs + u * ew, ez + v * eh, d));
    G.K.poly(alm, pal.eye, { dir: w.n });
    G.K.quad([w.at(cs - ew * 0.3, ez - eh * 0.45, d * 2), w.at(cs + ew * 0.3, ez - eh * 0.45, d * 2), w.at(cs + ew * 0.3, ez + eh * 0.55, d * 2), w.at(cs - ew * 0.3, ez + eh * 0.55, d * 2)], pal.ink, { dir: w.n });
    G.K.quad([w.at(cs - ew, ez + eh * 0.72, d * 2), w.at(cs + ew, ez + eh * 0.72, d * 2), w.at(cs + ew * 0.5, ez + eh * 0.95, d * 2), w.at(cs - ew * 0.5, ez + eh * 0.95, d * 2)], pal.ink, { dir: w.n });
  }
  // the nose: the curl (the numeral one) under and between the eyes, and the third eye
  const c = len / 2;
  G.K.quad([w.at(c - len * 0.03, ht * 0.12, d), w.at(c + len * 0.03, ht * 0.12, d), w.at(c + len * 0.03, ht * 0.4, d), w.at(c - len * 0.03, ht * 0.4, d)], pal.nose, { dir: w.n });
  G.K.quad([w.at(c - len * 0.03, ht * 0.4, d), w.at(c + len * 0.03, ht * 0.4, d), w.at(c + len * 0.1, ht * 0.5, d), w.at(c + len * 0.04, ht * 0.5, d)], pal.nose, { dir: w.n });
  G.K.quad([w.at(c - len * 0.025, ht * 0.7, d), w.at(c + len * 0.025, ht * 0.7, d), w.at(c + len * 0.025, ht * 0.78, d), w.at(c - len * 0.025, ht * 0.78, d)], pal.nose, { dir: w.n });
}

const TIBET = { white: '#e9e4d8', white2: '#d9d3c5', red: '#7c3128', red2: '#6a2a22', penbey: '#5a2b22', frame: '#24201d', wood: '#7c4a2c', gold: '#c9a24a', gold2: '#a8863c', stair: '#b3aa98', roof: '#b99a58' };

function tibetan(b, ctx) {
  const G = localKit(b, ctx, { sideFront: true });
  const { A, C, z0, H } = G;
  const pal = { ...TIBET, ...(b.churchPalette?.band ? { penbey: b.churchPalette.band } : {}) };
  // the long c = 0 side is the facade: terraced volumes rise toward the rear (c) and the middle (a)
  const top3 = z0 + H * 0.8, top2 = z0 + H * 0.56, top1 = z0 + H * 0.3;
  const bat = 0.08;
  const stairHalf = A * 0.2;
  // a battered volume with window rows on its sloped walls, the penbey band, a white coping
  const volume = (a0, a1, c0, c1, zb, zt, wallTint, { rows = 2, frontRows = rows, faces = ['front', 'left', 'right', 'back'], penbey = true } = {}) => {
    const h = zt - zb, ins = h * bat;
    const V = G.batter(a0, a1, c0, c1, zb, zt, ins, wallTint, mixHex(pal.white2, '#9a917f', 0.2));
    const sl = V.slant, bandLo = sl * 0.8;
    for (const kk of faces) {
      const w = V[kk], len = V.len[kk];
      if (penbey) {
        w.proud(ins * 1.1, bandLo, len - ins * 1.1, sl * 0.94, h * 0.015, pal.penbey);
        const nG = Math.max(2, Math.round(len / (h * 0.35)));
        for (let g = 0; g < nG; g++) { const s = ins * 1.1 + (len - ins * 2.2) * (g + 0.5) / nG, gr = h * 0.022; w.rect(s - gr, (bandLo + sl * 0.94) / 2 - gr, s + gr, (bandLo + sl * 0.94) / 2 + gr, pal.gold, h * 0.017); }
        w.proud(ins * 1.1, sl * 0.94, len - ins * 1.1, sl, h * 0.012, pal.white);
      }
      const nr = kk === 'left' ? frontRows : rows;
      const nW = Math.max(2, Math.round((len - ins * 2) / (h * 0.3)));
      for (let r = 0; r < nr; r++) {
        const t0 = sl * (0.2 + (0.52 * r) / Math.max(1, nr)), t1 = t0 + sl * (0.3 / Math.max(1.4, nr));
        for (let i = 0; i < nW; i++) {
          const s = ins * 1.4 + (len - ins * 2.8) * (i + 0.5) / nW, wb = Math.min((len / nW) * 0.24, h * 0.06);
          if (kk === 'left' && zb === z0 && Math.abs(s - len / 2) < stairHalf + wb) continue;   // the stair's bay
          G.K.poly([w.at(s - wb, t0, 0.006), w.at(s + wb, t0, 0.006), w.at(s + wb * 0.7, t1, 0.006), w.at(s - wb * 0.7, t1, 0.006)], pal.frame, { dir: w.n });
          w.rect(s - wb * 0.36, t0 + (t1 - t0) * 0.14, s + wb * 0.36, t0 + (t1 - t0) * 0.7, pal.wood, 0.01);
          w.rect(s - wb * 0.9, t1, s + wb * 0.9, t1 + (t1 - t0) * 0.14, pal.red2, 0.012);   // the painted lintel
        }
      }
    }
    return V;
  };
  // V1: the broad white base across the whole lot
  const V1 = volume(0, A, 0, C, z0, top1, pal.white, { rows: 2 });
  const i1 = (top1 - z0) * bat;
  // the zigzag stair across the base facade
  {
    const w = V1.left, len = A, sl = V1.slant, fl = 4, run = stairHalf * 1.7;
    for (let f = 0; f < fl; f++) {
      const t0 = sl * (0.03 + f * 0.18), t1 = t0 + sl * 0.15, dir = f % 2 ? -1 : 1, s0 = len * 0.5 - dir * run * 0.5;
      const s1 = s0 + dir * run, sw = sl * 0.06;
      G.K.poly([w.at(s0, t0 - sw * 0.6, 0.015), w.at(s1, t1 - sw * 0.6, 0.015), w.at(s1, t1, 0.015), w.at(s0, t0, 0.015)], mixHex(pal.stair, pal.frame, 0.35), { dir: w.n });
      G.K.poly([w.at(s0, t0, 0.02), w.at(s1, t1, 0.02), w.at(s1, t1 + sw, 0.02), w.at(s0, t0 + sw, 0.02)], pal.stair, { dir: w.n });
      G.K.poly([w.at(s0, t0 + sw, 0.03), w.at(s1, t1 + sw, 0.03), w.at(s1, t1 + sw * 1.6, 0.03), w.at(s0, t0 + sw * 1.6, 0.03)], pal.white, { dir: w.n });
    }
    w.recess(len / 2 - sl * 0.08, 0, len / 2 + sl * 0.08, sl * 0.2, sl * 0.02, pal.frame, null, { frame: sl * 0.02 });
  }
  // V2: the white palace, set back and up
  const a2 = [i1 + A * 0.07, A - i1 - A * 0.07], c2 = [C * 0.3, C - i1 - C * 0.02];
  volume(a2[0], a2[1], c2[0], c2[1], top1, top2, pal.white, { rows: 2 });
  const i2 = (top2 - top1) * bat;
  // V3: the red palace at the heart, the highest
  const wA = Math.max((a2[1] - a2[0]) * 0.46, C * 0.4), a3 = [(A - wA) / 2, (A + wA) / 2], c3 = [C * 0.48, c2[1] - i2 - C * 0.02];
  const V3 = volume(Math.max(a3[0], a2[0] + i2), Math.min(a3[1], a2[1] - i2), c3[0], c3[1], top2, top3, pal.red, { rows: 2 });
  // white wings flanking the red palace (lower), so the red reads as the centre
  // ROOF ORNAMENTS: gilded pavilion roofs, the gyaltsen at the corners, the wheel with its deer
  const i3 = (top3 - top2) * bat, ra0 = Math.max(a3[0], a2[0] + i2) + i3, ra1 = Math.min(a3[1], a2[1] - i2) - i3, rc0 = c3[0] + i3, rc1 = c3[1] - i3;
  const rw = ra1 - ra0, rd = rc1 - rc0, zr = top3, orn = z0 + H * 0.995 - zr;
  // two gilded pavilions on the red palace roof
  for (const f of rw > rd * 1.3 ? [0.28, 0.72] : [0.5]) {
    const pa = ra0 + rw * f, pc = rc0 + rd * 0.6, ph = Math.min(rw, rd) * 0.2, pz = zr + orn * 0.25;
    G.boxL(pa - ph * 0.7, pa + ph * 0.7, pc - ph * 0.7, pc + ph * 0.7, zr, pz, { side: pal.red2, top: null });
    G.hipRing(pa, pc, ph * 1.15, ph * 1.15, ph * 0.05, ph * 0.05, pz, pz + orn * 0.35, pal.gold, { lift: ph * 0.14, soffit: pal.red2, fascia: pal.gold2, fz: ph * 0.08 });
    G.latheL(pa, pc, [[ph * 0.1, pz + orn * 0.33], [ph * 0.16, pz + orn * 0.45], [0, pz + orn * 0.7]], 6, pal.gold);
  }
  // gyaltsen: gilded cylinders at the front corners of the red palace
  for (const pa of [ra0 + rw * 0.06, ra1 - rw * 0.06]) {
    const r = Math.min(rw, rd) * 0.045, gh = orn * 0.55;
    G.latheL(pa, rc0 + r * 1.5, [[r, zr], [r, zr + gh * 0.8], [r * 1.2, zr + gh * 0.84], [0.001, zr + gh]], 8, (i, k) => (k === 0 ? pal.gold2 : pal.gold));
  }
  // the dharma wheel between two deer on the front parapet of the red palace
  {
    const wa = (ra0 + ra1) / 2, wc = rc0 + rd * 0.08, wr = Math.min(orn * 0.22, rw * 0.1), wz = zr + wr * 1.15;
    const N = 12, ring = (r, dz = 0) => Array.from({ length: N }, (_, i) => { const t = (i / N) * TAU; return [wa + Math.cos(t) * r, wc, wz + Math.sin(t) * r + dz]; });
    const R0 = ring(wr), R1 = ring(wr * 0.72);
    for (let i = 0; i < N; i++) { const j = (i + 1) % N; G.quadL([R0[i], R0[j], R1[j], R1[i]], pal.gold, { dir: [0, -1, 0] }); }
    for (let i = 0; i < 4; i++) { const t = (i / 8) * TAU, cs = Math.cos(t) * wr * 0.72, sn = Math.sin(t) * wr * 0.72, e = wr * 0.06; G.quadL([[wa - cs - e * sn, wc, wz - sn + e * cs], [wa + cs - e * sn, wc, wz + sn + e * cs], [wa + cs + e * sn, wc, wz + sn - e * cs], [wa - cs + e * sn, wc, wz - sn - e * cs]], pal.gold2, { dir: [0, -1, 0] }); }
    G.boxL(wa - wr * 0.1, wa + wr * 0.1, wc - wr * 0.05, wc + wr * 0.05, zr, wz - wr, pal.gold);
    for (const sd of [-1, 1]) {
      const da = wa + sd * wr * 1.6, dh = wr * 0.9;
      // a recumbent deer, gazing at the wheel: body, neck and head as a gilded silhouette
      G.polyL([[da - wr * 0.45, wc, zr], [da + wr * 0.45, wc, zr], [da + wr * 0.4, wc, zr + dh * 0.45], [da - wr * 0.45, wc, zr + dh * 0.4]], pal.gold, { dir: [0, -1, 0] });
      G.polyL([[da - sd * wr * 0.2, wc, zr + dh * 0.4], [da - sd * wr * 0.42, wc, zr + dh * 0.42], [da - sd * wr * 0.55, wc, zr + dh * 0.95], [da - sd * wr * 0.35, wc, zr + dh * 0.95]], pal.gold, { dir: [0, -1, 0] });
    }
  }
  // gyaltsen at the corners of the white palace too (smaller)
  void V3;
  return G.faces;
}

export const SHRINES = {
  mosque: (b, ctx) => {
    const v = b.mosqueVariant || 'ottoman';
    return v === 'persian' ? persian(b, ctx) : v === 'sahelian' ? sahelian(b, ctx) : v === 'nusantara' ? nusantara(b, ctx) : ottoman(b, ctx);
  },
  temple: (b, ctx) => {
    const v = b.templeVariant || 'pagoda';
    return v === 'stupa' ? stupa(b, ctx) : v === 'tibetan' ? tibetan(b, ctx) : pagoda(b, ctx);
  },
};
