// Metro refacade builders: sacred. Each entry is (b, { L, camHint, cityBox }) → faces, drawn only for
// a metro box (b.metro); the stock builder draws everything else. See refacade.js.
//
// Two keys: `church` (branching on b.churchVariant: 'basilica' a Gothic cathedral, 'chapel' a
// steepled parish church, 'orthodox' a five-domed cross-in-square) and `rotunda` (the neoclassical
// civic dome, by b.domeForm). Every builder works in a LOCAL plan frame: `a` runs along the lot's
// long side (the nave axis; the entrance at a = 0 faces −a), `c` across it (0 on the centreline),
// z up from b.z0. Sizes come from the footprint (the short side for widths, the seeded z1 for
// heights), so a 3 × 4 lot and a 9 × 20 lot both read. Pure functions of the box: no rng, no Date.
import { makeKit, mixHex, v3 } from './refacade-kit.js';
import { scaleHex } from '../polygonizer/vexar.js';

const TAU = Math.PI * 2;
const { add, sub, mul, centroid } = v3;

// ── the local frame ──────────────────────────────────────────────────────────────
function localFrame(b) {
  const alongX = b.w >= b.d;
  const aLen = alongX ? b.w : b.d, cLen = alongX ? b.d : b.w;
  const a0 = alongX ? b.x : b.y, cM = alongX ? b.y + b.d / 2 : b.x + b.w / 2, z0 = b.z0 || 0;
  const P = (a, c, z) => (alongX ? [a0 + a, cM + c, z0 + z] : [cM + c, a0 + a, z0 + z]);
  const V = (a, c, z = 0) => (alongX ? [a, c, z] : [c, a, z]);
  // a local plan angle (0 = +a, π/2 = +c) → the world sweep the kit's lathe uses
  const sweep = (t0, t1) => (alongX ? [t0, t1] : [Math.PI / 2 - t1, Math.PI / 2 - t0]);
  return { alongX, aLen, cLen, cH: cLen / 2, P, V, sweep, z0 };
}

/** The kit, addressed in the local frame. */
function localKit(F, k) {
  const { P, V } = F;
  const box = (aA, cA, zA, aB, cB, zB, tint) => {
    const p = P(aA, cA, zA), q = P(aB, cB, zB);
    if (Math.abs(p[0] - q[0]) < 1e-6 || Math.abs(p[1] - q[1]) < 1e-6 || Math.abs(p[2] - q[2]) < 1e-6) return;
    k.box(Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.min(p[2], q[2]), Math.max(p[0], q[0]), Math.max(p[1], q[1]), Math.max(p[2], q[2]), tint);
  };
  /** A wall frame: origin (a, c, z), `u` and `n` local plan directions [da, dc]. */
  const wall = (a, c, z, u, n) => k.wall(P(a, c, z), V(u[0], u[1]), [0, 0, 1], V(n[0], n[1]));
  const front = (a, cL = -F.cH) => wall(a, cL, 0, [0, 1], [-1, 0]);    // s = c − cL, facing −a
  const back = (a, cL = -F.cH) => wall(a, cL, 0, [0, 1], [1, 0]);      // s = c − cL, facing +a
  const side = (sgn, c) => wall(0, c, 0, [1, 0], [0, sgn]);             // s = a, facing ±c
  const gable = (aA, cA, aB, cB, zE, zR, roof, gt, ridgeAlongA = true, o = 0) => {
    const p = P(aA, cA, zE), q = P(aB, cB, zE);
    const axis = (ridgeAlongA === F.alongX) ? 'x' : 'y';
    k.gable(Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1]), p[2], zR + F.z0, roof, gt, axis, o);
  };
  const lathe = (a, c, prof, n, tint, { t0 = 0, t1 = TAU, capTop = null, capBottom = null } = {}) => {
    const [x, y] = P(a, c, 0), [w0, w1] = F.sweep(t0, t1);
    k.lathe(x, y, prof.map(([r, z]) => [r, z + F.z0]), n, tint, { a0: w0, a1: w1, capTop, capBottom });
  };
  /** Wall frames on the n facets of a lathe about (a, c) at radius r (same points as `lathe`). */
  const facets = (a, c, r, n, zb, { t0 = 0, t1 = TAU } = {}) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const ta = t0 + (t1 - t0) * (i / n), tb = t0 + (t1 - t0) * ((i + 1) / n), tm = (ta + tb) / 2;
      const pa = [a + Math.cos(ta) * r, c + Math.sin(ta) * r], pb = [a + Math.cos(tb) * r, c + Math.sin(tb) * r];
      const du = [pb[0] - pa[0], pb[1] - pa[1]], l = Math.hypot(du[0], du[1]);
      out.push({ W: wall(pa[0], pa[1], zb, [du[0] / l, du[1] / l], [Math.cos(tm), Math.sin(tm)]), len: l, t: tm });
    }
    return out;
  };
  /** A square pyramid (pinnacle) on (a, c), half-side s, from z to z + h, with a plinth block. */
  const pinnacle = (a, c, s, z, h, tint) => {
    box(a - s, c - s, z, a + s, c + s, z + h * 0.18, tint);
    lathe(a, c, [[s * Math.SQRT2, z + h * 0.18], [0, z + h]], 4, tint, { t0: Math.PI / 4, t1: Math.PI / 4 + TAU });
  };
  /** A slab between two centreline top points (flying buttress, raking cornice). `half` is a world half-width vector. */
  const slab = (p0, p1, half, thick, tint) => {
    const dn = [0, 0, -thick];
    const A = sub(p0, half), B = add(p0, half), C = add(p1, half), D = sub(p1, half);
    const A2 = add(A, dn), B2 = add(B, dn), C2 = add(C, dn), D2 = add(D, dn);
    const ins = centroid([A, B, C, D, A2, B2, C2, D2]);
    k.quad([A, B, C, D], scaleHex(tint, 1.03), ins);
    k.quad([A2, B2, C2, D2], scaleHex(tint, 0.9), ins);
    k.quad([A, D, D2, A2], tint, ins);
    k.quad([B, C, C2, B2], tint, ins);
  };
  /** The same wall frame lifted `d` off its plane (nested archivolts, layered openings). */
  const shift = (W, d) => k.wall(W.at(0, 0, d), W.u, W.v, W.n);
  return { box, wall, front, back, side, gable, lathe, facets, pinnacle, slab, shift };
}

/** A rose window painted on a wall frame: glass disc, moulded rim, inner ring, spokes, boss. */
function rose(k, W, sc, tc, R, glass, stone, n = 16) {
  const out = { dir: W.n };
  const pt = (r, th, d) => W.at(sc + Math.cos(th) * r, tc + Math.sin(th) * r, d);
  const d0 = 0.012, dr = R * 0.07;
  k.poly(Array.from({ length: n }, (_, i) => pt(R * 0.9, (i / n) * TAU, d0)), glass, out);
  const ring = (r0, r1, d, tint) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, b = ((i + 1) / n) * TAU;
      k.quad([pt(r0, a, d), pt(r0, b, d), pt(r1, b, d), pt(r1, a, d)], tint, out);
    }
  };
  ring(R * 0.86, R * 1.04, dr, stone);
  ring(R * 0.4, R * 0.48, dr * 0.6, stone);
  const hw = R * 0.035;
  for (let i = 0; i < n; i += 2) {
    const th = (i / n) * TAU + Math.PI / n, cs = Math.cos(th), sn = Math.sin(th);
    const p = (r, s) => W.at(sc + cs * r - sn * s, tc + sn * r + cs * s, dr * 0.5);
    k.quad([p(R * 0.48, -hw), p(R * 0.86, -hw), p(R * 0.86, hw), p(R * 0.48, hw)], stone, out);
  }
  k.poly(Array.from({ length: 8 }, (_, i) => pt(R * 0.14, (i / 8) * TAU, dr * 0.6)), stone, out);
}

/** Never let a build overtop its seeded silhouette: squash z about z0 if the top overshoots. */
function fitUnder(faces, z0, z1) {
  const drawnTop = (f) => {
    const m = typeof f.clip === 'string' && f.clip.match(/^polygon\(0% 0%, 100% 0%, (-?[\d.]+)% 100%\)$/);
    if (!m) return Math.max(...f.corners.map((c) => c[2]));
    const t = Number(m[1]) / 100, [c0, c1, c2, c3] = f.corners;
    return Math.max(c0[2], c1[2], c3[2] + (c2[2] - c3[2]) * t);
  };
  let top = -Infinity;
  for (const f of faces) top = Math.max(top, drawnTop(f));
  if (!(top > z1) || top - z0 < 1e-9) return faces;
  const s = (z1 - z0) / (top - z0);
  for (const f of faces) f.corners = f.corners.map((c) => [c[0], c[1], z0 + (c[2] - z0) * s]);
  return faces;
}

const hash01 = (b) => { const h = Math.abs(Math.sin(b.x * 12.9898 + b.y * 78.233) * 43758.5453); return h - Math.floor(h); };

// ── the Gothic cathedral (basilica) ─────────────────────────────────────────────
// West front: twin towers (flat Gothic tops with pinnacles, or openwork spires) over three
// pointed portals, a gallery of kings, the rose, an open gallery. A tall nave with clerestory
// and flying buttresses over lean-to aisles, a transept when the lot allows, and a chevet (apse
// over an ambulatory). Pale limestone under lead-grey roofs.
const BASILICA = { wall: '#ebe3d0', trim: '#f5efe1', roof: '#6c737a', glass: '#323846', rose: '#3a3752', portal: '#2b2622', pinnacle: '#e4dcc8' };
function basilica(b, ctx) {
  const pal = { ...BASILICA, ...(b.churchPalette || {}) };
  const faces = [];
  const k = makeKit({ faces, L: ctx.L, camHint: ctx.camHint });
  const F = localFrame(b), K = localKit(F, k);
  const { aLen, cLen, cH } = F, H = b.z1 - (b.z0 || 0);
  const spires = hash01(b) < 0.5;
  const m = cLen * 0.035;
  const cO = cH - m;                                   // the outer line (facade, transept ends, pier faces)
  const tw = Math.min(cLen * 0.3, aLen * 0.24);        // tower side
  const tD = m + tw;                                   // depth of the west block
  const nHalf = cLen * 0.2, pierD = cLen * 0.07, aisleOut = cO - pierD;
  const Hc = spires ? H * 0.46 : H * 0.62;            // top of the centre bay of the front
  const towerTop = spires ? H * 0.62 : H * 0.9;
  const naveE = H * 0.4, naveR = naveE + nHalf * 1.35;
  const aisleE = H * 0.2, aisleTop = aisleE + (aisleOut - nHalf) * 0.45;
  const aApse = Math.max(tD + nHalf * 1.2, aLen - cH);  // apse / ambulatory centre on the axis
  const hasTransept = aApse - tD >= cLen * 0.8;
  const aX = aApse - nHalf * 2.3;                       // crossing centre
  const bw = cLen * 0.05, bd = cLen * 0.025;           // facade buttress width / projection

  // ── nave, aisles, roofs ──
  K.box(tD, -nHalf, 0, aApse, nHalf, naveE, { side: pal.wall });
  K.gable(tD, -nHalf, aApse, nHalf, naveE, naveR, pal.roof, pal.wall, true);
  for (const sg of [-1, 1]) {
    // aisle outer wall + lean-to roof
    k.quad([F.P(tD, sg * aisleOut, 0), F.P(aApse, sg * aisleOut, 0), F.P(aApse, sg * aisleOut, aisleE), F.P(tD, sg * aisleOut, aisleE)], pal.wall, F.P((tD + aApse) / 2, 0, aisleE / 2));
    k.quad([F.P(tD, sg * aisleOut, aisleE), F.P(aApse, sg * aisleOut, aisleE), F.P(aApse, sg * nHalf, aisleTop), F.P(tD, sg * nHalf, aisleTop)], pal.roof, F.P((tD + aApse) / 2, 0, 0));
  }
  // bays: nave (west block → crossing) and choir (crossing → apse)
  const runs = hasTransept ? [[tD, aX - nHalf], [aX + nHalf, aApse]] : [[tD, aApse]];
  const bayT = Math.max(nHalf * 0.9, cLen * 0.16);
  for (const [r0, r1] of runs) {
    const n = Math.max(1, Math.round((r1 - r0) / bayT)), bl = (r1 - r0) / n;
    for (const sg of [-1, 1]) {
      const Wn = K.side(sg, sg * nHalf), Wa = K.side(sg, sg * aisleOut);
      for (let i = 0; i < n; i++) {
        const s0 = r0 + i * bl, sm = s0 + bl / 2;
        // clerestory lancet
        const cw = bl * 0.42, cz0 = aisleTop + H * 0.02, cz1 = naveE - H * 0.03;
        Wn.arch(sm - cw / 2, sm + cw / 2, cz0, Math.max(cz0 + 0.05, cz1 - cw * 0.87), 0.05, pal.glass, null, { pointed: true, seg: 6 });
        // aisle lancet
        const aw = bl * 0.36, az0 = aisleE * 0.25, az1 = aisleE * 0.86;
        Wa.arch(sm - aw / 2, sm + aw / 2, az0, Math.max(az0 + 0.05, az1 - aw * 0.87), 0.05, pal.glass, pal.trim, { pointed: true, seg: 6 });
      }
      // piers + flyers at bay lines (not against the west block or the crossing)
      for (let i = 0; i <= n; i++) {
        const s = r0 + i * bl;
        if (s < tD + 0.01 || (hasTransept && Math.abs(s - aX) < nHalf + 0.01)) continue;
        const pw = Math.min(bl * 0.2, cLen * 0.05), pierTop = aisleTop + H * 0.05;
        const pa0 = Math.max(tD, s - pw / 2), pa1 = Math.min(aApse, s + pw / 2);
        K.box(pa0, sg * aisleOut, 0, pa1, sg * (aisleOut + pierD), pierTop, pal.wall);
        K.pinnacle(s, sg * (aisleOut + pierD * 0.5), Math.min(pierD, pw) * 0.42, pierTop, H * 0.07, pal.pinnacle);
        K.slab(F.P(s, sg * (aisleOut + pierD * 0.15), pierTop - H * 0.012), F.P(s, sg * nHalf, naveE - H * 0.04), F.V(pw * 0.3, 0), H * 0.022, pal.wall);
      }
    }
  }
  // ── transept + crossing flèche ──
  if (hasTransept) {
    K.box(aX - nHalf, -cO, 0, aX + nHalf, cO, naveE, { side: pal.wall });
    K.gable(aX - nHalf, -cO, aX + nHalf, cO, naveE, naveR, pal.roof, pal.wall, false);
    for (const sg of [-1, 1]) {
      // the transept end: portal, rose, buttresses on its corners
      const W = F.alongX ? K.wall(aX - nHalf, sg * cO, 0, [1, 0], [0, sg]) : K.wall(aX - nHalf, sg * cO, 0, [1, 0], [0, sg]);
      const tl = nHalf * 2, sm = tl / 2;
      W.arch(sm - tl * 0.18, sm + tl * 0.18, 0, aisleE * 0.9, 0.08, pal.portal, pal.trim, { pointed: true, seg: 6, frame: tl * 0.04 });
      rose(k, W, sm, naveE * 0.72, Math.min(tl * 0.34, H * 0.07), pal.rose, pal.trim, 12);
      W.proud(0, 0, bw, naveE * 0.96, bd, pal.wall);
      W.proud(tl - bw, 0, tl, naveE * 0.96, bd, pal.wall);
    }
    const fz = naveR - nHalf * 0.2, fTop = spires ? H * 0.74 : H * 0.86, fr = nHalf * 0.26;
    K.lathe(aX, 0, [[fr, fz], [fr, fz + H * 0.05]], 8, pal.roof, { t0: Math.PI / 8, t1: Math.PI / 8 + TAU });
    K.lathe(aX, 0, [[fr, fz + H * 0.05], [fr * 0.45, fz + (fTop - fz) * 0.45], [0, fTop]], 8, pal.roof, { t0: Math.PI / 8, t1: Math.PI / 8 + TAU });
  }
  // ── chevet: ambulatory + apse ──
  const tA = [-Math.PI / 2, Math.PI / 2];
  K.lathe(aApse, 0, [[aisleOut, 0], [aisleOut, aisleE], [nHalf, aisleTop]], 6, (i, kk) => (kk === 0 ? pal.wall : pal.roof), { t0: tA[0], t1: tA[1] });
  K.lathe(aApse, 0, [[nHalf, aisleTop - 0.01], [nHalf, naveE], [0, naveR]], 6, (i, kk) => (kk === 0 ? pal.wall : pal.roof), { t0: tA[0], t1: tA[1] });
  for (const { W, len: fl } of K.facets(aApse, 0, aisleOut, 6, 0, { t0: tA[0], t1: tA[1] })) {
    const aw = fl * 0.34;
    W.arch(fl / 2 - aw / 2, fl / 2 + aw / 2, aisleE * 0.25, Math.max(aisleE * 0.3, aisleE * 0.86 - aw * 0.87), 0.05, pal.glass, pal.trim, { pointed: true, seg: 6 });
  }
  for (const { W, len: fl } of K.facets(aApse, 0, nHalf, 6, 0, { t0: tA[0], t1: tA[1] })) {
    const aw = fl * 0.45;
    W.arch(fl / 2 - aw / 2, fl / 2 + aw / 2, aisleTop + H * 0.02, Math.max(aisleTop + H * 0.03, naveE - H * 0.03 - aw * 0.87), 0.05, pal.glass, null, { pointed: true, seg: 6 });
  }
  // radiating piers round the chevet
  for (let i = 1; i < 6; i++) {
    const t = tA[0] + (tA[1] - tA[0]) * (i / 6), ca = Math.cos(t), sa = Math.sin(t);
    const r0 = aisleOut, r1 = aisleOut + pierD * 0.9, pw = cLen * 0.025, pierTop = aisleTop + H * 0.05;
    const pc = (r, s) => [aApse + ca * r - sa * s, sa * r + ca * s];
    const q = [pc(r0, -pw), pc(r1, -pw), pc(r1, pw), pc(r0, pw)].map(([a, c]) => F.P(a, c, 0).slice(0, 2));
    k.prism(q, F.z0, F.z0 + pierTop, pal.wall, { cap: pal.wall });
    const [ma, mc] = pc((r0 + r1) / 2, 0);
    K.pinnacle(ma, mc, pw * 0.9, pierTop, H * 0.06, pal.pinnacle);
    const [ia, ic] = pc(nHalf, 0), [oa, oc] = pc(r0 + (r1 - r0) * 0.15, 0);
    K.slab(F.P(oa, oc, pierTop - H * 0.012), F.P(ia, ic, naveE - H * 0.04), F.V(-sa * pw * 0.6, ca * pw * 0.6), H * 0.02, pal.wall);
  }

  // ── west block: the front ──
  K.box(m, -cO, 0, tD, cO, Hc, { side: pal.wall, top: pal.trim });
  const Wf = cLen - 2 * m, Fr = K.front(m, -cO), centreW = Wf - 2 * tw;
  // buttresses: the rhythm of the front (outer corners and the tower / centre joints)
  for (const s of [0, tw - bw / 2, Wf - tw - bw / 2, Wf - bw]) Fr.proud(s, 0, s + bw, towerTop * 0.97, bd, pal.wall);
  // portals: the central one larger, one in each tower base; archivolts and a gable over the centre
  const pH = Hc * 0.32;
  const portal = (sc, pw) => Fr.arch(sc - pw / 2, sc + pw / 2, 0, pH - pw * 0.87, 0.1, pal.portal, pal.trim, { pointed: true, seg: 8, frame: pw * 0.1 });
  const pwC = Math.min(centreW * 0.62, pH / 1.6), pwS = Math.min(tw * 0.48, pwC * 0.8);
  portal(Wf / 2, pwC); portal(tw / 2, pwS); portal(Wf - tw / 2, pwS);
  k.tri(Fr.at(Wf / 2 - pwC * 0.62, pH - pwC * 0.1, bd * 0.8), Fr.at(Wf / 2 + pwC * 0.62, pH - pwC * 0.1, bd * 0.8), Fr.at(Wf / 2, pH + pwC * 0.5, bd * 0.8), pal.trim, { dir: Fr.n });
  // gallery of kings: a string course and a row of niches
  const gk0 = Hc * 0.38, gk1 = Hc * 0.45;
  Fr.proud(0, gk0 - Hc * 0.015, Wf, gk0, bd * 0.8, pal.trim);
  const nk = Math.max(6, Math.round(Wf / (cLen * 0.075))), kw = Wf / nk;
  for (let i = 0; i < nk; i++) Fr.recess(i * kw + kw * 0.22, gk0 + Hc * 0.008, (i + 1) * kw - kw * 0.22, gk1 - Hc * 0.008, 0.03, scaleHex(pal.wall, 0.62), null);
  Fr.proud(0, gk1, Wf, gk1 + Hc * 0.015, bd * 0.8, pal.trim);
  // the rose, centred in the centre bay, and paired lancets in the towers beside it
  const rc = Hc * 0.62, R = Math.min(centreW * 0.47, Hc * 0.15);
  rose(k, Fr, Wf / 2, rc, R, pal.rose, pal.trim);
  for (const sc of [tw / 2, Wf - tw / 2]) {
    const lw = tw * 0.2;
    for (const o of [-1, 1]) Fr.arch(sc + o * tw * 0.14 - lw / 2, sc + o * tw * 0.14 + lw / 2, Hc * 0.5, Hc * 0.74 - lw * 0.87, 0.05, pal.glass, null, { pointed: true, seg: 6 });
  }
  // open gallery under the parapet, then the parapet
  if (!spires) {
    const g0 = Hc * 0.8, g1 = Hc * 0.93, ng = Math.max(8, Math.round(Wf / (cLen * 0.09))), gw = Wf / ng;
    Fr.proud(0, g0 - Hc * 0.015, Wf, g0, bd, pal.trim);
    for (let i = 0; i < ng; i++) Fr.arch(i * gw + gw * 0.2, (i + 1) * gw - gw * 0.2, g0 + Hc * 0.01, g1 - gw * 0.6 * 0.87, 0.03, pal.glass, null, { pointed: true, seg: 4 });
  } else {
    // the nave gable stands between the towers
    k.tri(Fr.at(tw, Hc, 0), Fr.at(Wf - tw, Hc, 0), Fr.at(Wf / 2, Math.min(naveR + H * 0.02, towerTop - H * 0.02), 0), pal.wall, { dir: Fr.n });
  }
  Fr.proud(0, Hc - Hc * 0.03, Wf, Hc, bd * 1.2, pal.trim);

  // ── twin towers ──
  for (const sg of [-1, 1]) {
    const c0 = sg < 0 ? -cO : cO - tw, c1 = c0 + tw, sH = towerTop - Hc;
    K.box(m, c0, Hc, tD, c1, towerTop, { side: pal.wall, top: pal.roof });
    const walls = [
      [K.front(m, c0), tw], [K.back(tD, c0), tw],
      [K.wall(m, sg < 0 ? c0 : c1, 0, [1, 0], [0, sg]), tw], [K.wall(m, sg < 0 ? c1 : c0, 0, [1, 0], [0, -sg]), tw],
    ];
    const lw = tw * 0.17;
    for (const [W, wl] of walls) {
      for (const o of [-1, 1]) {
        const sc = wl / 2 + o * wl * 0.16;
        W.arch(sc - lw / 2, sc + lw / 2, Hc + sH * 0.12, Math.max(Hc + sH * 0.2, towerTop - sH * 0.14 - lw * 0.87), 0.06, pal.glass, pal.trim, { pointed: true, seg: 6, frame: lw * 0.12 });
      }
      W.proud(0, towerTop - sH * 0.07, wl, towerTop, bd * 0.8, pal.trim);                 // cornice / parapet
    }
    // outer-side buttresses
    const Ws = walls[2][0];
    Ws.proud(0, 0, bw, towerTop * 0.97, bd, pal.wall);
    Ws.proud(tw - bw, 0, tw, towerTop * 0.97, bd, pal.wall);
    const ca = m + tw / 2, cc = (c0 + c1) / 2, ps = tw * 0.1;
    if (spires) {
      // an openwork octagonal spire: bands alternate open (dark) and stone, corner pinnacles
      const sr = tw * 0.4, h = H * 0.985 - towerTop;
      K.lathe(ca, cc, [[sr, towerTop], [sr * 0.84, towerTop + h * 0.16], [sr * 0.68, towerTop + h * 0.32], [sr * 0.52, towerTop + h * 0.48], [sr * 0.36, towerTop + h * 0.64], [sr * 0.2, towerTop + h * 0.8], [sr * 0.06, towerTop + h * 0.95], [0, towerTop + h]], 8,
        (i, kk) => (kk % 2 === 1 && kk < 6 ? scaleHex(pal.wall, 0.72) : pal.wall), { t0: Math.PI / 8, t1: Math.PI / 8 + TAU });
      for (const [pa, pc] of [[m + ps, c0 + ps], [tD - ps, c0 + ps], [m + ps, c1 - ps], [tD - ps, c1 - ps]]) K.pinnacle(pa, pc, ps, towerTop, H * 0.1, pal.pinnacle);
    } else {
      for (const [pa, pc] of [[m + ps, c0 + ps], [tD - ps, c0 + ps], [m + ps, c1 - ps], [tD - ps, c1 - ps]]) K.pinnacle(pa, pc, ps, towerTop, Math.min(H * 0.08, H * 0.99 - towerTop), pal.pinnacle);
    }
  }
  return fitUnder(faces, F.z0, b.z1);
}

// ── the chapel: a steepled parish church ─────────────────────────────────────────
// A gabled nave with lancets between stepped buttresses, a square tower at the entrance end with a
// louvred belfry, a clock, corner pinnacles and a slate spire, a gabled porch before the door, and
// a lower chancel at the east end when the lot is long enough.
const CHAPEL = { wall: '#e2dac8', trim: '#efe8d8', roof: '#5b6169', spire: '#56645f', door: '#3a2b22', glass: '#333947', cross: '#c9a23a' };
function chapel(b, ctx) {
  const pal = { ...CHAPEL, ...(b.churchPalette || {}) };
  const faces = [];
  const k = makeKit({ faces, L: ctx.L, camHint: ctx.camHint });
  const F = localFrame(b), K = localKit(F, k);
  const { aLen, cLen, cH } = F, H = b.z1 - (b.z0 || 0);
  const m = cLen * 0.03, bd = cLen * 0.07, bwid = cLen * 0.06;
  const pd = Math.min(cLen * 0.2, aLen * 0.1);                       // porch depth
  const tw = Math.min(cLen * 0.5, aLen * 0.28);                      // tower side
  const aT0 = m + pd, aT1 = aT0 + tw;
  const nw2 = cH - m - bd;                                            // nave half-width (buttresses outside)
  const zE = Math.min(H * 0.24, nw2 * 1.7), zR = zE + nw2 * 1.25;
  const zT = Math.max(zR + H * 0.08, H * 0.5), zSpire = H * 0.93;
  const aEnd = aLen - m;
  const naveLen = aEnd - aT1;
  const hasChancel = naveLen > cLen * 1.3;
  const chL = hasChancel ? Math.min(naveLen * 0.26, cLen * 0.8) : 0, aN1 = aEnd - chL;

  // ── nave ──
  K.box(aT1 - tw * 0.1, -nw2, 0, aN1, nw2, zE, { side: pal.wall });
  K.gable(aT1 - tw * 0.1, -nw2, aN1, nw2, zE, zR, pal.roof, pal.wall, true, Math.min(bd * 0.7, cLen * 0.04));
  const bayT = cLen * 0.42, nb = Math.max(2, Math.round((aN1 - aT1) / bayT)), bl = (aN1 - aT1) / nb;
  for (const sg of [-1, 1]) {
    const W = K.side(sg, sg * nw2);
    for (let i = 0; i < nb; i++) {
      const sm = aT1 + (i + 0.5) * bl, lw = Math.min(bl * 0.3, cLen * 0.14);
      W.arch(sm - lw / 2, sm + lw / 2, zE * 0.28, Math.max(zE * 0.35, zE * 0.84 - lw * 0.87), 0.05, pal.glass, pal.trim, { pointed: true, seg: 6, frame: lw * 0.1 });
    }
    for (let i = 1; i <= nb; i++) {
      // stepped buttresses: a deep lower stage, a set-off, a slimmer upper stage with a weathered top
      const s = aT1 + i * bl - (i === nb ? bwid / 2 : 0), c0 = sg * nw2;
      K.box(s - bwid / 2, c0, 0, s + bwid / 2, sg * (nw2 + bd), zE * 0.45, pal.wall);
      K.box(s - bwid / 2, c0, zE * 0.45, s + bwid / 2, sg * (nw2 + bd * 0.6), zE * 0.8, pal.wall);
      k.quad([F.P(s - bwid / 2, sg * (nw2 + bd * 0.6), zE * 0.8), F.P(s + bwid / 2, sg * (nw2 + bd * 0.6), zE * 0.8), F.P(s + bwid / 2, c0, zE * 0.92), F.P(s - bwid / 2, c0, zE * 0.92)], pal.trim, F.P(s, 0, 0));
      for (const e of [-1, 1]) k.tri(F.P(s + e * bwid / 2, sg * (nw2 + bd * 0.6), zE * 0.8), F.P(s + e * bwid / 2, c0, zE * 0.8), F.P(s + e * bwid / 2, c0, zE * 0.92), pal.wall, { dir: F.V(e, 0) });
    }
  }
  // ── chancel ──
  const endW = hasChancel ? K.back(aEnd, -nw2 * 0.72) : K.back(aN1, -nw2);
  if (hasChancel) {
    const ch2 = nw2 * 0.72, cE = zE * 0.82, cR = cE + ch2 * 1.25;
    K.box(aN1 - 0.02, -ch2, 0, aEnd, ch2, cE, { side: pal.wall });
    K.gable(aN1 - 0.02, -ch2, aEnd, ch2, cE, cR, pal.roof, pal.wall, true);
    for (const sg of [-1, 1]) {
      const W = K.side(sg, sg * ch2), lw = Math.min(chL * 0.22, cLen * 0.1);
      W.arch(aN1 + chL / 2 - lw / 2, aN1 + chL / 2 + lw / 2, cE * 0.3, Math.max(cE * 0.35, cE * 0.84 - lw * 0.87), 0.05, pal.glass, pal.trim, { pointed: true, seg: 6 });
    }
    // east window: three stepped lancets
    const ew = ch2 * 2;
    for (const [o, h] of [[-1, 0.72], [0, 0.86], [1, 0.72]]) {
      const lw = ew * 0.14, sc = ew / 2 + o * ew * 0.19;
      endW.arch(sc - lw / 2, sc + lw / 2, cE * 0.3, Math.max(cE * 0.35, cE * h + (cR - cE) * 0.3 * (o === 0 ? 1 : 0.4) - lw * 0.87), 0.05, pal.glass, null, { pointed: true, seg: 6 });
    }
  } else {
    const ew = nw2 * 2, lw = ew * 0.22;
    endW.arch(ew / 2 - lw / 2, ew / 2 + lw / 2, zE * 0.3, zE * 0.9 - lw * 0.87, 0.05, pal.glass, pal.trim, { pointed: true, seg: 6 });
  }
  // ── tower ──
  const tc = tw / 2;
  K.box(aT0, -tc, 0, aT1, tc, zT, { side: pal.wall, top: pal.roof });
  const tWalls = [K.front(aT0, -tc), K.back(aT1, -tc), K.wall(aT0, -tc, 0, [1, 0], [0, -1]), K.wall(aT0, tc, 0, [1, 0], [0, 1])];
  const zB0 = zT - Math.min(tw * 1.1, (zT - zR) * 0.8), zB1 = zT - tw * 0.1;          // belfry stage
  for (const [j, W] of tWalls.entries()) {
    // string courses mark the stages; corner buttresses climb to the belfry
    W.proud(0, zB0 - tw * 0.06, tw, zB0, cLen * 0.015, pal.trim);
    W.proud(0, zT - tw * 0.08, tw, zT, cLen * 0.02, pal.trim);
    W.proud(0, 0, tw * 0.1, zB0 - tw * 0.06, cLen * 0.015, pal.wall);
    W.proud(tw * 0.9, 0, tw, zB0 - tw * 0.06, cLen * 0.015, pal.wall);
    // louvred belfry opening
    const lw = tw * 0.42, t0 = zB0 + (zB1 - zB0) * 0.1, tS = Math.max(t0 + tw * 0.1, zB1 - lw * 0.87);
    W.arch(tw / 2 - lw / 2, tw / 2 + lw / 2, t0, tS, 0.06, scaleHex(pal.door, 0.8), pal.trim, { pointed: true, seg: 6, frame: lw * 0.08 });
    const nl = 4;
    for (let i = 0; i < nl; i++) {
      const t = t0 + (tS - t0) * ((i + 0.6) / nl);
      W.proud(tw / 2 - lw * 0.46, t - (tS - t0) * 0.05, tw / 2 + lw * 0.46, t, 0.03, scaleHex(pal.roof, 1.1));
    }
    // a clock on the front, a lancet on the others
    const zc = zB0 - tw * 0.36;
    if (j === 0) {
      const cr = tw * 0.24, out = { dir: W.n };
      k.poly(Array.from({ length: 12 }, (_, i) => W.at(tw / 2 + Math.cos((i / 12) * TAU) * cr, zc + Math.sin((i / 12) * TAU) * cr, 0.02)), scaleHex(pal.roof, 0.85), out);
      k.poly(Array.from({ length: 12 }, (_, i) => W.at(tw / 2 + Math.cos((i / 12) * TAU) * cr * 0.8, zc + Math.sin((i / 12) * TAU) * cr * 0.8, 0.03)), '#f4f0e4', out);
      k.quad([W.at(tw / 2 - cr * 0.04, zc, 0.04), W.at(tw / 2 + cr * 0.04, zc, 0.04), W.at(tw / 2 + cr * 0.04, zc + cr * 0.6, 0.04), W.at(tw / 2 - cr * 0.04, zc + cr * 0.6, 0.04)], '#2a2622', out);
      k.quad([W.at(tw / 2, zc - cr * 0.04, 0.04), W.at(tw / 2 + cr * 0.45, zc - cr * 0.04, 0.04), W.at(tw / 2 + cr * 0.45, zc + cr * 0.04, 0.04), W.at(tw / 2, zc + cr * 0.04, 0.04)], '#2a2622', out);
    } else if (zc - tw * 0.3 > zE * 0.5) {
      const lw2 = tw * 0.14;
      W.arch(tw / 2 - lw2 / 2, tw / 2 + lw2 / 2, zc - tw * 0.3, zc + tw * 0.1, 0.04, pal.glass, null, { pointed: true, seg: 4 });
    }
  }
  // the west door in the tower, behind the porch
  const Wt = tWalls[0];
  // ── porch ──
  const pw2 = tw * 0.36, pE = Math.min(zE * 0.42, tw * 0.75), pR = pE + pw2 * 0.9;
  K.box(m, -pw2, 0, aT0, pw2, pE, { side: pal.wall });
  K.gable(m, -pw2, aT0 + 0.01, pw2, pE, pR, pal.roof, pal.wall, true, cLen * 0.015);
  const Wp = K.front(m, -pw2), dw = pw2 * 1.1;
  Wp.arch(pw2 - dw / 2, pw2 + dw / 2, 0, pE * 0.95 - dw * 0.87 * 0.6, 0.08, pal.door, pal.trim, { pointed: true, seg: 6, frame: dw * 0.08 });
  Wt.proud(0, pR + tw * 0.02, tw, pR + tw * 0.06, cLen * 0.01, pal.trim);
  // ── spire: corner pinnacles and an octagonal slate spire with a cross ──
  const ps = tw * 0.08;
  for (const [pa, pc] of [[aT0 + ps, -tc + ps], [aT1 - ps, -tc + ps], [aT0 + ps, tc - ps], [aT1 - ps, tc - ps]]) K.pinnacle(pa, pc, ps, zT, tw * 0.55, pal.trim);
  const sr = tw * 0.42, ac = (aT0 + aT1) / 2;
  K.lathe(ac, 0, [[sr, zT], [sr * 0.8, zT + (zSpire - zT) * 0.12], [0, zSpire]], 8, (i, kk) => (kk === 0 ? scaleHex(pal.spire, 0.92) : pal.spire), { t0: Math.PI / 8, t1: Math.PI / 8 + TAU });
  // lucarnes: small gabled openings on the cardinal faces of the spire
  const zl = zT + (zSpire - zT) * 0.2, lr = sr * 0.72;
  for (const [da, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const W = K.wall(ac + da * lr - dc * sr * 0.18, dc * lr + da * sr * 0.18, 0, [dc, -da], [da, dc]);
    W.recess(0, zl, sr * 0.36, zl + sr * 0.4, 0.02, scaleHex(pal.door, 0.8), null);
    k.tri(W.at(-sr * 0.04, zl + sr * 0.4, 0.01), W.at(sr * 0.4, zl + sr * 0.4, 0.01), W.at(sr * 0.18, zl + sr * 0.62, 0.01), pal.spire, { dir: W.n });
  }
  const cz = zSpire, ch = H - zSpire, cb = Math.max(cLen * 0.012, ch * 0.08);
  K.box(ac - cb / 2, -cb / 2, cz - ch * 0.05, ac + cb / 2, cb / 2, H * 0.998, pal.cross);
  K.box(ac - cb / 2, -ch * 0.28, cz + ch * 0.55, ac + cb / 2, ch * 0.28, cz + ch * 0.55 + cb, pal.cross);
  return fitUnder(faces, F.z0, b.z1);
}

// ── the Orthodox church: cross-in-square, five domes ─────────────────────────────
// A square naos of three bays a side, pilaster-strip walls rising to zakomar arches, the roof
// following them as intersecting barrel vaults; a tall windowed central drum under the great onion,
// four smaller drums and onions at the corners, Orthodox crosses, a semicircular apse to the east
// and, when the lot runs long, a narthex with an arched portal and a tented bell tower at the west.
const ORTHODOX = { wall: '#f0ece2', trim: '#faf7ef', roof: '#62786f', domeMain: '#caa64a', domeSide: '#34508f', drum: '#ebe6da', window: '#2f2a25', cross: '#d8b94a', door: '#3b2c21' };
function onionProfile(r, z, h) {
  return [[r, z], [r * 1.22, z + h * 0.1], [r * 1.34, z + h * 0.26], [r * 1.2, z + h * 0.44], [r * 0.82, z + h * 0.6], [r * 0.42, z + h * 0.76], [r * 0.16, z + h * 0.9], [r * 0.08, z + h * 0.97], [0, z + h]];
}
function orthodox(b, ctx) {
  const pal = { ...ORTHODOX, ...(b.churchPalette || {}) };
  const faces = [];
  const k = makeKit({ faces, L: ctx.L, camHint: ctx.camHint });
  const F = localFrame(b), K = localKit(F, k);
  const { aLen, cLen, cH } = F, H = b.z1 - (b.z0 || 0);
  const m = cLen * 0.04;
  const s = Math.min(cLen - 2 * m, aLen * 0.66);                    // the naos square
  const apseR = s * 0.2;
  const aC1 = aLen - m - apseR, aC0 = aC1 - s, cS = s / 2;          // naos a-range, half-width
  const zE = Math.min(H * 0.32, s * 1.05);
  const bays = [0.3, 0.4, 0.3].map((f) => f * s), edges = [0, bays[0], bays[0] + bays[1], s];
  const cross = (a, c, zb, h) => {
    const bar = Math.max(cLen * 0.008, h * 0.07);
    K.box(a - bar / 2, c - bar / 2, zb, a + bar / 2, c + bar / 2, zb + h, pal.cross);
    K.box(a - bar / 2, c - h * 0.28, zb + h * 0.6, a + bar / 2, c + h * 0.28, zb + h * 0.6 + bar, pal.cross);
    K.box(a - bar / 2, c - h * 0.15, zb + h * 0.8, a + bar / 2, c + h * 0.15, zb + h * 0.8 + bar, pal.cross);
    K.slab(F.P(a, c - h * 0.17, zb + h * 0.3), F.P(a, c + h * 0.17, zb + h * 0.4), F.V(bar / 2, 0), bar, pal.cross);
  };

  // ── naos walls ──
  K.box(aC0, -cS, 0, aC1, cS, zE, { side: pal.wall });
  // four faces: pilaster strips at the bay lines, a window per bay, a zakomar over each bay
  const faceW = [
    [K.front(aC0, -cS), 'W'], [K.back(aC1, -cS), 'E'],
    [K.wall(aC0, -cS, 0, [1, 0], [0, -1]), 'S'], [K.wall(aC0, cS, 0, [1, 0], [0, 1])],
  ];
  const narthexD = aC0 - m;
  const hasNarthex = narthexD > s * 0.22;
  for (const [W, tag] of faceW) {
    for (const e of edges) W.proud(Math.max(0, Math.min(s - s * 0.05, e - s * 0.025)), 0, Math.max(s * 0.05, Math.min(s, e + s * 0.025)), zE, cLen * 0.012, pal.trim);
    for (let i = 0; i < 3; i++) {
      const b0 = edges[i], b1 = edges[i + 1], bm = (b0 + b1) / 2, r = (b1 - b0) / 2;
      // zakomar: the half-disc gable over the bay, with a moulded rim
      const n = 8, out = { dir: W.n };
      const arc = Array.from({ length: n + 1 }, (_, j) => W.at(bm - Math.cos((j / n) * Math.PI) * r, zE + Math.sin((j / n) * Math.PI) * r, 0));
      for (let j = 0; j < n; j++) k.tri(arc[j], arc[j + 1], W.at(bm, zE, 0), pal.wall, out);
      for (let j = 0; j < n; j++) {
        const a0 = (j / n) * Math.PI, a1 = ((j + 1) / n) * Math.PI, ri = r * 0.86, d = cLen * 0.012;
        k.quad([W.at(bm - Math.cos(a0) * ri, zE + Math.sin(a0) * ri, d), W.at(bm - Math.cos(a1) * ri, zE + Math.sin(a1) * ri, d), W.at(bm - Math.cos(a1) * r, zE + Math.sin(a1) * r, d), W.at(bm - Math.cos(a0) * r, zE + Math.sin(a0) * r, d)], pal.trim, out);
      }
      // windows: tall round-headed in the bays, a small one in each zakomar
      if (tag === 'E' && i === 1) continue;                            // the apse covers it
      if (tag === 'W' && i === 1) {
        if (!hasNarthex) {
          const pw = (b1 - b0) * 0.5;
          [0.34, 0.2, 0.08].forEach((f, j) => K.shift(W, cLen * 0.008 * j).arch(bm - pw / 2 - pw * f, bm + pw / 2 + pw * f, 0, zE * 0.46, 0.02, scaleHex(pal.wall, 0.94 - f), null, { seg: 8 }));
          K.shift(W, cLen * 0.024).arch(bm - pw / 2, bm + pw / 2, 0, zE * 0.46, 0.1, pal.door, null, { seg: 8 });
          W.arch(bm - pw * 0.3, bm + pw * 0.3, zE * 0.7, zE * 0.84, 0.04, pal.domeMain, pal.trim, { seg: 6 });  // the icon over the door
          continue;
        }
      }
      const ww = (b1 - b0) * 0.2;
      W.arch(bm - ww / 2, bm + ww / 2, zE * 0.42, zE * 0.78, 0.05, pal.window, pal.trim, { seg: 6, frame: ww * 0.12 });
      W.arch(bm - ww * 0.35, bm + ww * 0.35, zE + r * 0.15, zE + r * 0.45, 0.04, pal.window, null, { seg: 6 });
    }
    W.proud(0, 0, s, zE * 0.06, cLen * 0.01, scaleHex(pal.wall, 0.9));            // plinth
  }
  // ── the roof po zakomaram: intersecting barrel vaults over the three strips each way ──
  const barrel = (along, lo, hi, from, to) => {
    const r = (hi - lo) / 2, mid = (lo + hi) / 2, n = 8;
    for (let j = 0; j < n; j++) {
      const t0 = (j / n) * Math.PI, t1 = ((j + 1) / n) * Math.PI;
      const q = (t, x) => (along ? F.P(x, mid - Math.cos(t) * r, zE + Math.sin(t) * r) : F.P(mid - Math.cos(t) * r, x, zE + Math.sin(t) * r));
      k.quad([q(t0, from), q(t1, from), q(t1, to), q(t0, to)], pal.roof, along ? F.P((from + to) / 2, mid, zE) : F.P(mid, (from + to) / 2, zE));
    }
  };
  for (let i = 0; i < 3; i++) {
    barrel(true, -cS + edges[i], -cS + edges[i + 1], aC0, aC1);
    barrel(false, aC0 + edges[i], aC0 + edges[i + 1], -cS, cS);
  }
  // ── apse ──
  const apE = zE * 0.72;
  K.lathe(aC1, 0, [[apseR, 0], [apseR, apE]], 6, pal.wall, { t0: -Math.PI / 2, t1: Math.PI / 2 });
  K.lathe(aC1, 0, [[apseR, apE], [apseR * 0.92, apE + apseR * 0.4], [apseR * 0.6, apE + apseR * 0.8], [0, apE + apseR * 0.95]], 6, pal.roof, { t0: -Math.PI / 2, t1: Math.PI / 2 });
  for (const [j, { W, len }] of K.facets(aC1, 0, apseR, 6, 0, { t0: -Math.PI / 2, t1: Math.PI / 2 }).entries()) {
    if (j === 0 || j === 5) continue;
    W.arch(len * 0.34, len * 0.66, apE * 0.4, apE * 0.72, 0.04, pal.window, null, { seg: 4 });
  }
  // ── central pedestal with kokoshniki, drum, great onion ──
  const zRoofTop = zE + bays[1] / 2, aMid = aC0 + s / 2;
  // proportioned from the naos, not stretched to the seeded height: a drum ~3 radii tall, an onion
  // a little taller than it is wide (fitUnder squashes the rare lot whose z1 is short)
  const rC = s * 0.22, ph = rC * 1.3, zP1 = zRoofTop + s * 0.14;
  const zD = zP1 + rC * 3.1, zDome = zD + rC * 0.14, domeH = rC * 2.7;
  K.box(aMid - ph, -ph, zE + bays[1] * 0.25, aMid + ph, ph, zP1, { side: pal.wall, top: pal.roof });
  for (const W of [K.front(aMid - ph, -ph), K.back(aMid + ph, -ph), K.wall(aMid - ph, -ph, 0, [1, 0], [0, -1]), K.wall(aMid - ph, ph, 0, [1, 0], [0, 1])]) {
    const n = 6, out = { dir: W.n };
    for (const bm of [ph / 2, ph * 1.5]) {
      const r = ph / 2;
      const arc = Array.from({ length: n + 1 }, (_, j) => W.at(bm - Math.cos((j / n) * Math.PI) * r, zP1 + Math.sin((j / n) * Math.PI) * r * 1.2, 0));
      for (let j = 0; j < n; j++) k.tri(arc[j], arc[j + 1], W.at(bm, zP1, 0), pal.wall, out);
      const arcI = Array.from({ length: n + 1 }, (_, j) => W.at(bm - Math.cos((j / n) * Math.PI) * r * 0.8, zP1 + Math.sin((j / n) * Math.PI) * r * 0.96, cLen * 0.006));
      for (let j = 0; j < n; j++) k.quad([arcI[j], arcI[j + 1], W.at(bm - Math.cos(((j + 1) / n) * Math.PI) * r, zP1 + Math.sin(((j + 1) / n) * Math.PI) * r * 1.2, cLen * 0.006), W.at(bm - Math.cos((j / n) * Math.PI) * r, zP1 + Math.sin((j / n) * Math.PI) * r * 1.2, cLen * 0.006)], pal.trim, out);
    }
    W.proud(0, zP1 - H * 0.01, ph * 2, zP1, cLen * 0.008, pal.trim);
  }
  K.lathe(aMid, 0, [[rC, zP1 - H * 0.01], [rC, zD]], 12, pal.drum);
  for (const [j, { W, len }] of K.facets(aMid, 0, rC, 12, 0).entries()) {
    if (j % 2 === 0) W.arch(len * 0.25, len * 0.75, zP1 + (zD - zP1) * 0.22, zD - (zD - zP1) * 0.2 - len * 0.25, 0.03, pal.window, null, { seg: 4 });
    else W.proud(len * 0.42, zP1, len * 0.58, zD, cLen * 0.006, pal.trim);
  }
  K.lathe(aMid, 0, [[rC, zD], [rC * 1.12, zD + H * 0.008], [rC * 1.12, zDome], [rC, zDome]], 12, pal.trim);
  K.lathe(aMid, 0, onionProfile(rC * 0.98, zDome, domeH), 12, (i) => (i % 2 ? scaleHex(pal.domeMain, 0.94) : pal.domeMain));
  cross(aMid, 0, zDome + domeH * 0.97, rC * 1.55);
  // ── four corner drums + onions ──
  const rS = s * 0.1, zSD = zE + bays[0] / 2 + rS * 2.6, sdH = rS * 2.6;
  for (const [da, dc] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const pa = aMid + da * (s / 2 - bays[0] / 2), pc = dc * (s / 2 - bays[0] / 2);
    K.lathe(pa, pc, [[rS, zE], [rS, zSD]], 8, pal.drum);
    for (const [j, { W, len }] of K.facets(pa, pc, rS, 8, 0).entries()) if (j % 2 === 0) W.arch(len * 0.3, len * 0.7, zSD - (zSD - zE) * 0.4, zSD - (zSD - zE) * 0.14, 0.02, pal.window, null, { seg: 3 });
    K.lathe(pa, pc, [[rS, zSD], [rS * 1.12, zSD + H * 0.01], [rS, zSD + H * 0.012]], 8, pal.trim);
    K.lathe(pa, pc, onionProfile(rS * 0.98, zSD + H * 0.012, sdH), 8, pal.domeSide);
    cross(pa, pc, zSD + H * 0.012 + sdH * 0.97, rS * 1.8);
  }
  // ── narthex, portal, bell tower ──
  if (hasNarthex) {
    const hasBell = narthexD > s * 0.75;
    const bt = hasBell ? Math.min(narthexD * 0.42, s * 0.42) : 0;
    const nA0 = m + bt, nW = s * 0.84 / 2, nE = zE * 0.58, nR = nE + nW * 0.5;
    K.box(nA0, -nW, 0, aC0 + 0.01, nW, nE, { side: pal.wall });
    K.gable(nA0, -nW, aC0 + 0.01, nW, nE, nR, pal.roof, pal.wall, true, cLen * 0.012);
    for (const sg of [-1, 1]) {
      const W = K.side(sg, sg * nW), nl = Math.max(1, Math.round((aC0 - nA0) / (s * 0.3)));
      for (let i = 0; i < nl; i++) { const sm = nA0 + (aC0 - nA0) * ((i + 0.5) / nl), ww = s * 0.06; W.arch(sm - ww / 2, sm + ww / 2, nE * 0.4, nE * 0.72, 0.04, pal.window, pal.trim, { seg: 4 }); }
    }
    if (!hasBell) {
      const W = K.front(nA0, -nW), pw = nW * 0.55;
      [0.36, 0.22, 0.1].forEach((f, j) => K.shift(W, cLen * 0.008 * j).arch(nW - pw / 2 - pw * f, nW + pw / 2 + pw * f, 0, nE * 0.72 - (pw / 2) * (1 + 2 * f), 0.02, scaleHex(pal.wall, 0.95 - f * 0.8), null, { seg: 8 }));
      K.shift(W, cLen * 0.024).arch(nW - pw / 2, nW + pw / 2, 0, nE * 0.72 - pw / 2, 0.1, pal.door, null, { seg: 8 });
      k.tri(W.at(nW - pw * 1.0, nE * 0.8, cLen * 0.01), W.at(nW + pw * 1.0, nE * 0.8, cLen * 0.01), W.at(nW, nE * 0.8 + pw * 0.5, cLen * 0.01), pal.roof, { dir: W.n });
    } else {
      // bell tower on the axis: a square shaft, an open belfry, a tent roof, a small onion
      const b2 = bt / 2, zBT = Math.min(zE * 1.5, zD), zBel = zBT - bt * 0.9, tent = zBT + bt * 1.6;
      K.box(m, -b2, 0, m + bt, b2, zBT, { side: pal.wall, top: pal.roof });
      const bw = [K.front(m, -b2), K.back(m + bt, -b2), K.wall(m, -b2, 0, [1, 0], [0, -1]), K.wall(m, b2, 0, [1, 0], [0, 1])];
      for (const [j, W] of bw.entries()) {
        W.arch(bt * 0.22, bt * 0.78, zBel, zBT - bt * 0.5, 0.05, pal.window, pal.trim, { seg: 6, frame: bt * 0.05 });
        W.proud(0, zBel - bt * 0.08, bt, zBel - bt * 0.03, cLen * 0.01, pal.trim);
        W.proud(0, zBT - bt * 0.1, bt, zBT, cLen * 0.012, pal.trim);
        if (j === 0) {
          const pw = bt * 0.5;
          [0.3, 0.15].forEach((f, jj) => K.shift(W, cLen * 0.008 * jj).arch(bt / 2 - pw / 2 - pw * f, bt / 2 + pw / 2 + pw * f, 0, nE * 0.6, 0.02, scaleHex(pal.wall, 0.94 - f), null, { seg: 8 }));
          K.shift(W, cLen * 0.016).arch(bt / 2 - pw / 2, bt / 2 + pw / 2, 0, nE * 0.6, 0.1, pal.door, null, { seg: 8 });
        }
      }
      K.lathe(m + b2, 0, [[b2 * 1.02 * Math.SQRT2 * 0.72, zBT], [b2 * 0.12, tent]], 8, pal.roof, { t0: Math.PI / 8, t1: Math.PI / 8 + TAU });
      K.lathe(m + b2, 0, onionProfile(b2 * 0.16, tent, H * 0.05), 8, pal.domeMain);
      cross(m + b2, 0, tent + H * 0.048, bt * 0.5);
    }
  }
  return fitUnder(faces, F.z0, b.z1);
}

// ── the civic rotunda (neoclassical) ─────────────────────────────────────────────
// A stepped stylobate; a drum ringed by a peristyle standing ON it; an entablature, a windowed
// attic and a cornice; the dome by b.domeForm (a ribbed copper-green hemisphere with a lantern, the
// gilded onion, the persian bulb); a pedimented hexastyle portico on the front. A long lot adds
// two low wings either side of the rotunda, the portico on the front wing.
const ROTUNDA = { wall: '#e9e3d4', step: '#d9d2c2', column: '#f1ede2', cornice: '#e2dccd', window: '#343a44', domeStone: '#86a596', domeOnion: '#caa63f', domeBulbous: '#23b3ab', lantern: '#ece7da', finial: '#d8b94a', roof: '#8e959a' };
function rotunda(b, ctx) {
  const pal = { ...ROTUNDA, ...(b.domePalette || {}) };
  const form = b.domeForm || 'hemispheric';
  const faces = [];
  const k = makeKit({ faces, L: ctx.L, camHint: ctx.camHint });
  const F = localFrame(b), K = localKit(F, k);
  const { aLen, cLen, cH } = F, fM = cLen, m = fM * 0.02;
  const aC = aLen / 2;
  const wings = aLen > fM * 1.5;
  // heights, as fractions of the short side (the seeder's z1 budget: see fitUnder)
  const zS = fM * 0.09, zCol0 = zS + fM * 0.012, zCol1 = fM * 0.6, zEnt = fM * 0.67, zAt = fM * 0.85, zCor = fM * 0.88;
  const rP = fM * 0.41, colR = fM * 0.024, rD = fM * 0.32, rEnt = rP + colR * 1.6;
  // ── stylobate: three steps over the whole footprint ──
  for (let i = 0; i < 3; i++) {
    const inset = m + i * fM * 0.022, z0 = (zS / 3) * i, z1 = (zS / 3) * (i + 1);
    K.box(inset, -cH + inset, z0, aLen - inset, cH - inset, z1, { side: scaleHex(pal.step, 0.97), top: pal.step });
  }
  K.lathe(aC, 0, [[rEnt * 1.01, zS], [rEnt * 1.01, zCol0]], 24, pal.step, { capTop: pal.step });   // the peristyle's own step
  // ── cella drum + peristyle ──
  K.lathe(aC, 0, [[rD, zCol0], [rD, zAt]], 20, pal.wall);
  const portHalf = Math.min(cLen * 0.33, rP * 0.9);
  const skip = (t) => {
    const pa = aC + Math.cos(t) * rP, pc = Math.sin(t) * rP;
    if (wings) return Math.abs(pc) < fM * 0.3 + colR * 2;
    return pa < aC && Math.abs(pc) < portHalf + colR * 3;
  };
  const NC = 20;
  for (const [j, { W, len, t }] of K.facets(aC, 0, rD, 20, 0).entries()) {
    if (skip(t)) continue;
    if (j % 2 === 0) W.arch(len * 0.28, len * 0.72, zCol0 + (zCol1 - zCol0) * 0.2, zCol0 + (zCol1 - zCol0) * 0.62, 0.04, pal.window, pal.cornice, { seg: 4, frame: len * 0.05 });
  }
  for (let i = 0; i < NC; i++) {
    const t = ((i + 0.5) / NC) * TAU;
    if (skip(t)) continue;
    const [x, y, z] = F.P(aC + Math.cos(t) * rP, Math.sin(t) * rP, zCol0);
    k.column(x, y, colR, z, F.z0 + zCol1, pal.column, { n: 8, capTint: pal.cornice });
  }
  // entablature: architrave + frieze band, a projecting cornice, a roof ring back to the attic
  K.lathe(aC, 0, [[rEnt, zCol1], [rEnt, zEnt - fM * 0.02], [rEnt * 1.03, zEnt - fM * 0.015], [rEnt * 1.03, zEnt], [rD * 0.97, zEnt + fM * 0.01]], 24,
    (i, kk) => (kk === 3 ? pal.roof : kk === 0 ? pal.cornice : pal.wall));
  // attic drum with small windows, and its cornice
  K.lathe(aC, 0, [[rD * 0.97, zEnt], [rD * 0.97, zAt]], 20, pal.wall);
  for (const { W, len } of K.facets(aC, 0, rD * 0.97, 20, 0)) W.recess(len * 0.3, zEnt + (zAt - zEnt) * 0.3, len * 0.7, zEnt + (zAt - zEnt) * 0.72, 0.03, pal.window, null);
  K.lathe(aC, 0, [[rD * 0.97, zAt], [rD * 1.06, zAt + fM * 0.012], [rD * 1.06, zCor], [rD * 0.99, zCor + fM * 0.006]], 20, (i, kk) => (kk === 2 ? pal.roof : pal.cornice));
  // ── dome by form ──
  const zDome = zCor + fM * 0.004, rDome = rD * 0.99;
  const domeTint = b.domeTint || (form === 'onion' ? pal.domeOnion : form === 'bulbous' ? pal.domeBulbous : pal.domeStone);
  if (form === 'hemispheric') {
    const dh = fM * 0.33, prof = [];
    for (let i = 0; i <= 6; i++) { const t = (i / 6) * (Math.PI / 2) * 0.86; prof.push([rDome * Math.cos(t), zDome + dh * Math.sin(t) / Math.sin((Math.PI / 2) * 0.86)]); }
    const rTop = prof[6][0];
    K.lathe(aC, 0, prof, 24, (i, kk) => (i % 3 === 0 ? mixHex(domeTint, '#e8ece6', 0.22) : domeTint), { capTop: domeTint });
    // lantern: an open colonnaded drum, a small dome, a ball
    const zL = zDome + dh, rL = Math.max(rTop * 0.85, fM * 0.055), lh = fM * 0.13;
    K.lathe(aC, 0, [[rL * 1.25, zL - fM * 0.01], [rL * 1.25, zL + fM * 0.012]], 12, pal.lantern, { capTop: pal.lantern });
    K.lathe(aC, 0, [[rL, zL + fM * 0.012], [rL, zL + lh]], 12, (i) => (i % 2 ? scaleHex(pal.window, 1.1) : pal.lantern));
    K.lathe(aC, 0, [[rL * 1.12, zL + lh], [rL * 1.12, zL + lh + fM * 0.012], [rL, zL + lh + fM * 0.02], [rL * 0.7, zL + lh + fM * 0.06], [0, zL + lh + fM * 0.075]], 12, (i, kk) => (kk < 2 ? pal.lantern : domeTint));
    const zb = zL + lh + fM * 0.075;
    K.lathe(aC, 0, [[fM * 0.006, zb], [fM * 0.022, zb + fM * 0.03], [fM * 0.022, zb + fM * 0.045], [0, zb + fM * 0.07]], 8, pal.finial);
  } else {
    const dh = form === 'onion' ? fM * 0.6 : fM * 0.48;
    const prof = form === 'onion'
      ? onionProfile(rDome * 0.84, zDome, dh)
      : [[rDome * 0.86, zDome], [rDome * 0.99, zDome + dh * 0.12], [rDome * 1.06, zDome + dh * 0.3], [rDome, zDome + dh * 0.5], [rDome * 0.82, zDome + dh * 0.68], [rDome * 0.48, zDome + dh * 0.85], [rDome * 0.12, zDome + dh * 0.97], [0, zDome + dh]];
    K.lathe(aC, 0, prof, 20, (i) => (i % 2 ? scaleHex(domeTint, 0.95) : domeTint));
    const zb = zDome + dh * 0.97;
    K.lathe(aC, 0, [[fM * 0.01, zb], [fM * 0.01, zb + fM * 0.08], [fM * 0.03, zb + fM * 0.1], [fM * 0.03, zb + fM * 0.12], [0, zb + fM * 0.15]], 8, pal.finial);
  }
  // ── wings (a long lot) ──
  const zW = zCol1 * 0.78, wH = fM * 0.3;
  if (wings) {
    const zWr = zW + wH * 0.35;
    for (const [w0, w1] of [[m + fM * 0.2, aC - rD * 0.6], [aC + rD * 0.6, aLen - m - fM * 0.06]]) {
      if (w1 - w0 < fM * 0.1) continue;
      K.box(w0, -wH, zS, w1, wH, zW, { side: pal.wall });
      K.gable(w0, -wH, w1, wH, zW, zWr, pal.roof, pal.cornice, true, fM * 0.01);
      for (const sg of [-1, 1]) {
        const W = K.side(sg, sg * wH), nb = Math.max(2, Math.round((w1 - w0) / (fM * 0.12))), bl = (w1 - w0) / nb;
        W.proud(w0, zW - fM * 0.04, w1, zW, fM * 0.012, pal.cornice);
        for (let i = 0; i < nb; i++) {
          const s0 = w0 + i * bl;
          W.proud(s0 + bl * 0.02, zS, s0 + bl * 0.12, zW - fM * 0.04, fM * 0.008, pal.column);
          W.recess(s0 + bl * 0.36, zS + (zW - zS) * 0.2, s0 + bl * 0.76, zS + (zW - zS) * 0.4, 0.03, pal.window, pal.cornice);
          W.arch(s0 + bl * 0.36, s0 + bl * 0.76, zS + (zW - zS) * 0.5, zS + (zW - zS) * 0.72, 0.03, pal.window, pal.cornice, { seg: 4 });
        }
      }
    }
  }
  // ── portico: six columns, entablature, pediment, on the front ──
  const pW = wings ? wH * 1.05 : portHalf;
  const pa0 = m + fM * (wings ? 0.04 : 0.07), pa1 = wings ? m + fM * 0.2 : aC - rD * 0.5, colTopP = wings ? zW - fM * 0.07 : zCol1;
  const pEnt = colTopP + fM * 0.07, pR = pEnt + pW * 0.36;
  const nCol = 6, cr = Math.min(colR * 1.15, (pW * 2) / nCol * 0.22);
  for (let i = 0; i < nCol; i++) {
    const c = -pW + cr * 1.6 + (i / (nCol - 1)) * (pW * 2 - cr * 3.2);
    for (const aa of [pa0 + cr * 1.5, pa0 + cr * 1.5 + fM * 0.1]) {
      if (aa > pa1 - cr) continue;
      const [x, y, z] = F.P(aa, c, zS);
      k.column(x, y, cr, z, F.z0 + colTopP, pal.column, { n: 8, capTint: pal.cornice });
    }
  }
  K.box(pa0, -pW, colTopP, pa1, pW, pEnt, { side: pal.cornice, top: pal.roof });
  const Wp = K.front(pa0, -pW);
  Wp.proud(0, pEnt - fM * 0.02, pW * 2, pEnt, fM * 0.012, pal.wall);
  K.gable(pa0, -pW, pa1, pW, pEnt, pR, pal.roof, pal.wall, true);
  // the raking cornices
  const lo = (sg) => F.P(pa0 - fM * 0.005, sg * pW, pEnt), apex = F.P(pa0 - fM * 0.005, 0, pR);
  for (const sg of [-1, 1]) K.slab(add(lo(sg), [0, 0, fM * 0.018]), add(apex, [0, 0, fM * 0.018]), F.V(fM * 0.012, 0), fM * 0.03, pal.cornice);
  // the door in the portico's back wall (the cella / wing face behind the columns)
  const Wd = K.front(wings ? m + fM * 0.2 : aC - rD * 0.5, -pW);
  Wd.recess(pW * 0.72, zS, pW * 1.28, zS + (colTopP - zS) * 0.62, 0.05, scaleHex(pal.window, 0.9), pal.cornice, { frame: fM * 0.012 });
  if (!wings) K.box(aC - rD * 0.5 - 0.001, -pW, zS, aC - rD * 0.3, pW, colTopP, { side: pal.wall });
  return fitUnder(faces, F.z0, b.z1);
}

export const SACRED = {
  church: (b, ctx) => (b.churchVariant === 'basilica' ? basilica(b, ctx) : b.churchVariant === 'orthodox' ? orthodox(b, ctx) : chapel(b, ctx)),
  rotunda: (b, ctx) => rotunda(b, ctx),
};
