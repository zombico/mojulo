// Metro refacade builders: venues. Each entry is (b, { L, camHint, cityBox }) → faces, drawn only for
// a metro box (b.metro); the stock builder draws everything else. See refacade.js.
//
// Every builder works in a LOCAL plan frame (s along the footprint's long axis, t across it, z up
// from b.z0) and maps to the world through `frameOf`, so a footprint laid either way draws the same
// building. Proportions come from the footprint (the short side S = 2B), never from b.z1.
// Deterministic: no rng, no Date; the figure decimation is a pure function memoised per module.
import { makeKit, mixHex, v3, decimateFaces } from './refacade-kit.js';
import { scaleHex } from '../polygonizer/vexar.js';
import { buildStatueFigure, buildRizalFigure } from './statue-figure.js';

const { sub, add, mul, dot, cross, norm, len } = v3;
const TAU = Math.PI * 2;

// ── local helpers ────────────────────────────────────────────────────────────────────────────

/** The local plan frame: s along the long axis (or x when `fixed`), t across, z up from z0. */
function frameOf(b, fixed = false) {
  const alongX = fixed || b.w >= b.d;
  const A = (alongX ? b.w : b.d) / 2, B = (alongX ? b.d : b.w) / 2;
  const cx = b.x + b.w / 2, cy = b.y + b.d / 2, z0 = b.z0;
  const P = alongX ? (s, t, z) => [cx + s, cy + t, z0 + z] : (s, t, z) => [cx - t, cy + s, z0 + z];
  const D = alongX ? (s, t, z) => [s, t, z] : (s, t, z) => [-t, s, z];
  return { A, B, S: 2 * B, P, D, alongX, cx, cy, z0 };
}

const same = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 1e-9;

/**
 * A surface from rows of world points (row k, column i): quads between consecutive rows, a
 * triangle where a row collapses to a pole. `tint(i, k)` (or a hex; falsy skips the cell) and
 * `inside(i, k)` (a point inside the solid, or { dir }) orient each face.
 */
function sheet(K, rows, tint, inside, closed = false) {
  for (let k = 0; k < rows.length - 1; k++) {
    const R0 = rows[k], R1 = rows[k + 1], n = R0.length, m = closed ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % n;
      const t = typeof tint === 'function' ? tint(i, k) : tint;
      if (!t) continue;
      const out = typeof inside === 'function' ? inside(i, k) : inside;
      if (same(R0[i], R0[j])) K.tri(R1[j], R1[i], R0[i], t, out);
      else if (same(R1[i], R1[j])) K.tri(R0[i], R0[j], R1[i], t, out);
      else K.quad([R0[i], R0[j], R1[j], R1[i]], t, out);
    }
  }
}

/** A wall frame on a local plan segment (p0 → p1, CCW outline so outward is to the right). */
function facetWall(K, F, p0, p1, z) {
  const ds = p1[0] - p0[0], dt = p1[1] - p0[1], l = Math.hypot(ds, dt) || 1;
  const u = F.D(ds / l, dt / l, 0), n = F.D(dt / l, -ds / l, 0);
  return { W: K.wall(F.P(p0[0], p0[1], z), u, [0, 0, 1], n), len: l, n, u };
}

/** A closed local plan outline extruded as a band from z0 to z1 (outward from the plan centre). */
function band(K, F, outline, z0, z1, tint, inset = null) {
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], c = outline[(i + 1) % outline.length];
    const t = typeof tint === 'function' ? tint(i) : tint;
    if (!t) continue;
    const ctr = inset || [0, 0];
    K.quad([F.P(a[0], a[1], z0), F.P(c[0], c[1], z0), F.P(c[0], c[1], z1), F.P(a[0], a[1], z1)], t, F.P(ctr[0], ctr[1], (z0 + z1) / 2));
  }
}

/** A flat ring between two closed local outlines at z (facing up, or down with `down`). */
function ring(K, F, outer, inner, z, tint, down = false, zi = z) {
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length;
    const t = typeof tint === 'function' ? tint(i) : tint;
    if (!t) continue;
    K.quad([F.P(outer[i][0], outer[i][1], z), F.P(outer[j][0], outer[j][1], z), F.P(inner[j][0], inner[j][1], zi), F.P(inner[i][0], inner[i][1], zi)], t, { dir: [0, 0, down ? -1 : 1] });
  }
}

const ellipse = (a, b, n, a0 = 0) => Array.from({ length: n }, (_, i) => { const th = a0 + (i / n) * TAU; return [a * Math.cos(th), b * Math.sin(th)]; });

/** A tube along a polyline of world points with per-point radius, `n` sides (outward from the axis). */
function tube(K, pts, radii, n, tint, { capEnd = null, capStart = null } = {}) {
  const rings = [];
  for (let k = 0; k < pts.length; k++) {
    const T = norm(sub(pts[Math.min(pts.length - 1, k + 1)], pts[Math.max(0, k - 1)]));
    const ref = Math.abs(T[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
    const U = norm(cross(T, ref)), V = norm(cross(T, U)), r = Array.isArray(radii) ? radii[k] : radii;
    rings.push(Array.from({ length: n }, (_, i) => { const a = (i / n) * TAU; return add(pts[k], add(mul(U, Math.cos(a) * r), mul(V, Math.sin(a) * r))); }));
  }
  for (let k = 0; k < rings.length - 1; k++) {
    const mid = v3.lerp(pts[k], pts[k + 1], 0.5);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, t = typeof tint === 'function' ? tint(i, k) : tint;
      K.quad([rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]], t, mid);
    }
  }
  if (capEnd) K.poly(rings[rings.length - 1], capEnd, pts[pts.length - 2]);
  if (capStart) K.poly(rings[0], capStart, pts[1]);
}

/** A disc (n-gon) in the plane through c with normal nrm, radius r. */
function disc(K, c, nrm, r, n, tint) {
  const ref = Math.abs(nrm[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const U = norm(cross(nrm, ref)), V = norm(cross(nrm, U));
  K.poly(Array.from({ length: n }, (_, i) => { const a = (i / n) * TAU; return add(c, add(mul(U, Math.cos(a) * r), mul(V, Math.sin(a) * r))); }), tint, { dir: nrm });
}

// ── Rogers Centre ────────────────────────────────────────────────────────────────────────────
// The SkyDome: a round concrete bowl ringed by fins, a band of concourse glazing and banners, under
// the four-panel retractable roof, closed: the fixed north panel (a barrel run into a quarter dome),
// two sliding barrel vaults and the rotating quarter-sphere south panel, each panel stepped above its
// neighbour where they overlap, arched steel ribs across the barrels and meridian ribs on the domes.
const ROGERS = {
  concrete: '#bcb8ae', fin: '#cdc9bf', base: '#9d9a92', glass: '#3a444c', gate: '#2f3438', banner: '#4c5a6e',
  beam: '#6c7278', roof: '#d8dad6', rib: '#b3b9bb', step: '#6f7579',
};

function rogersCentre(b, { L, camHint }) {
  const faces = [], K = makeKit({ faces, L, camHint }), F = frameOf(b), { S } = F;
  const pal = { ...ROGERS, ...(b.landmarkPalette || {}) };
  const Aw = F.A * 0.97, Bw = F.B * 0.97, Re = Math.min(Aw, Bw * 0.86), c = Aw - Re;
  const nMidAuto = Math.max(1, Math.round((2 * c) / (Math.PI * Re / 14)));
  const stadium = (sc, nEnd = 14, nMid = nMidAuto) => {
    const pts = [], a = Aw * sc, bb = Bw * sc, re = Re * sc, cc = a - re;
    for (let i = 0; i < nEnd; i++) { const p = -Math.PI / 2 + (i / nEnd) * Math.PI; pts.push([cc + re * Math.cos(p), bb * Math.sin(p)]); }
    for (let i = 0; i < nMid; i++) pts.push([cc - (2 * cc) * (i / nMid), bb]);
    for (let i = 0; i < nEnd; i++) { const p = Math.PI / 2 + (i / nEnd) * Math.PI; pts.push([-cc + re * Math.cos(p), bb * Math.sin(p)]); }
    for (let i = 0; i < nMid; i++) pts.push([-cc + (2 * cc) * (i / nMid), -bb]);
    return pts;
  };
  const zPl = S * 0.03, zW = S * 0.30, zRim = S * 0.335, hR = S * 0.235, dStep = S * 0.018;

  // plinth: a sloped podium ring out to the footprint
  const out = stadium(0.995 / 0.97), wall = stadium(1);
  for (let i = 0; i < wall.length; i++) {
    const j = (i + 1) % wall.length;
    K.quad([F.P(out[i][0], out[i][1], 0), F.P(out[j][0], out[j][1], 0), F.P(wall[j][0], wall[j][1], zPl), F.P(wall[i][0], wall[i][1], zPl)], pal.base, F.P(0, 0, -S));
  }
  // the bowl wall: a fin at every facet joint, the concourse glazing band, banners, gates, a coping
  for (let i = 0; i < wall.length; i++) {
    const { W, len: l } = facetWall(K, F, wall[i], wall[(i + 1) % wall.length], zPl), h = zW - zPl;
    W.rect(0, 0, l, h, pal.concrete);
    W.recess(l * 0.16, h * 0.4, l * 0.98, h * 0.5, S * 0.01, pal.glass, null);
    if (i % 2 === 0) { W.rect(l * 0.4, h * 0.56, l * 0.76, h * 0.9, pal.banner, 0.004); W.rect(l * 0.4, h * 0.86, l * 0.76, h * 0.9, scaleHex(pal.banner, 1.5), 0.006); }
    if (i % 5 === 2) W.recess(l * 0.28, 0, l * 0.9, h * 0.24, S * 0.01, pal.gate, null);
    W.proud(-l * 0.02, 0, l * 0.14, h, S * 0.016, pal.fin);
    W.proud(l * 0.14, h * 0.93, l * 0.98, h, S * 0.008, pal.fin);
  }
  // the ring beam the roof rides on
  const rim = stadium(0.985);
  band(K, F, rim, zW, zRim, pal.beam);
  ring(K, F, wall, rim, zW, pal.fin);

  // the roof: panels along s, profile across t; panel 1 = west dome + first barrel (fixed)
  const Br = Bw * 0.97, Rr = Re * 0.97, cr = c * 0.97 + (Aw - Re) * 0.0, nA = 14;
  const prof = (al) => [Br * Math.sin(al), hR * Math.pow(Math.max(0, Math.cos(al)), 1.1)];      // (t, dz) at α ∈ [-π/2, π/2]
  const s1 = -cr + (2 * cr) * 0.3, s2 = -cr + (2 * cr) * 0.64;
  const PANELS = [{ s0: -cr, s1, off: 0 }, { s0: s1, s1: s2, off: dStep }, { s0: s2, s1: cr, off: dStep * 2 }];
  const alphas = Array.from({ length: nA + 1 }, (_, j) => -Math.PI / 2 + (j / nA) * Math.PI);
  const arc = (s, off) => alphas.map((al) => { const [t, dz] = prof(al); return F.P(s, t, zRim + off + dz); });
  const ribArc = (s, off, w, d, tint) => {
    // an arched rib standing proud of the barrel: a crown strip and its two flanks
    const pts = alphas.map((al) => { const [t, dz] = prof(al); const nt = Math.sin(al) / Br, nz = Math.cos(al) / hR, l = Math.hypot(nt, nz) || 1; return [t, dz, nt / l, nz / l]; });
    for (let j = 0; j < nA; j++) {
      const [ta, za, nta, nza] = pts[j], [tb, zb, ntb, nzb] = pts[j + 1];
      const A0 = (s) => F.P(s, ta, zRim + off + za), B0 = (s) => F.P(s, tb, zRim + off + zb);
      const A1 = (s) => F.P(s, ta + nta * d, zRim + off + za + nza * d), B1 = (s) => F.P(s, tb + ntb * d, zRim + off + zb + nzb * d);
      const axis = F.P(s, 0, zRim);
      K.quad([A1(s - w), B1(s - w), B1(s + w), A1(s + w)], tint, axis);
      K.quad([A0(s - w), B0(s - w), B1(s - w), A1(s - w)], scaleHex(tint, 0.95), { dir: F.D(-1, 0, 0) });
      K.quad([A0(s + w), B0(s + w), B1(s + w), A1(s + w)], scaleHex(tint, 0.95), { dir: F.D(1, 0, 0) });
    }
  };
  for (const [pi, p] of PANELS.entries()) {
    const rows = [arc(p.s0, p.off), arc((p.s0 + p.s1) / 2, p.off), arc(p.s1, p.off)];
    // rows run along α (i) for each s (k): transpose so the sheet's cells are (α-step, s-step)
    sheet(K, rows, pal.roof, (i, k) => F.P((p.s0 + p.s1) / 2, 0, zRim));
    if (p.off > 0) for (const sgn of [-1, 1]) K.quad([F.P(p.s0, sgn * Br, zRim), F.P(p.s1, sgn * Br, zRim), F.P(p.s1, sgn * Br, zRim + p.off), F.P(p.s0, sgn * Br, zRim + p.off)], pal.step, F.P(0, 0, zRim));
    // the step where this panel rises above its west neighbour: an arched end face
    const prevOff = pi === 0 ? null : PANELS[pi - 1].off;
    if (prevOff !== null && p.off > prevOff) {
      const hi = arc(p.s0, p.off), lo = arc(p.s0, prevOff);
      for (let j = 0; j < nA; j++) K.quad([lo[j], lo[j + 1], hi[j + 1], hi[j]], pal.step, { dir: F.D(-1, 0, 0) });
    }
    ribArc(p.s0 + S * 0.012, p.off, S * 0.008, S * 0.007, pal.rib);
    ribArc((p.s0 + p.s1) / 2, p.off, S * 0.006, S * 0.006, pal.rib);
    if (pi === PANELS.length - 1) ribArc(p.s1 - S * 0.012, p.off, S * 0.008, S * 0.007, pal.rib);
  }
  // the two quarter domes: west (fixed, with panel 1) and east (the rotating panel 4)
  const dome = (sgn, off, ribbed) => {
    const sE = sgn * cr, nK = 9, nP = 16;
    const pt = (al, ph) => F.P(sE + sgn * Rr * Math.sin(al) * Math.cos(ph), Br * Math.sin(al) * Math.sin(ph), zRim + off + hR * Math.pow(Math.max(0, Math.cos(al)), 1.1));
    const rows = Array.from({ length: nK + 1 }, (_, k) => Array.from({ length: nP + 1 }, (_, i) => pt((k / nK) * Math.PI / 2, -Math.PI / 2 + (i / nP) * Math.PI)));
    sheet(K, rows, pal.roof, F.P(sE, 0, zRim));
    if (off > 0) {
      const e = rows[nK];
      for (let i = 0; i < nP; i++) K.quad([e[i], e[i + 1], sub(e[i + 1], [0, 0, off]), sub(e[i], [0, 0, off])], pal.step, F.P(sE, 0, zRim));
    }
    for (const ph of ribbed) {
      // a meridian rib from the pivot down to the rim: crown strip + flanks
      const w = S * 0.006, d = S * 0.006;
      for (let k = 0; k < nK; k++) {
        const ra = (al, dd, side) => {
          const r = Math.sin(al), dz = Math.pow(Math.max(0, Math.cos(al)), 1.1);
          const nr = Math.sin(al), nz = Math.cos(al), l = Math.hypot(nr, nz) || 1;
          const px = Math.cos(ph), py = Math.sin(ph), qx = -py, qy = px;
          const s = sE + sgn * (Rr * r + (nr / l) * dd) * px + sgn * qx * side, t = (Br * r + (nr / l) * dd) * py + qy * side;
          return F.P(s, t, zRim + off + hR * dz + (nz / l) * dd);
        };
        const a0 = (k / nK) * Math.PI / 2, a1 = ((k + 1) / nK) * Math.PI / 2;
        K.quad([ra(a0, d, -w), ra(a1, d, -w), ra(a1, d, w), ra(a0, d, w)], pal.rib, F.P(sE, 0, zRim));
        K.quad([ra(a0, 0, -w), ra(a1, 0, -w), ra(a1, d, -w), ra(a0, d, -w)], scaleHex(pal.rib, 0.95), F.P(sE, 0, zRim + off + hR * 0.5));
        K.quad([ra(a0, 0, w), ra(a1, 0, w), ra(a1, d, w), ra(a0, d, w)], scaleHex(pal.rib, 0.95), F.P(sE, 0, zRim + off + hR * 0.5));
      }
    }
  };
  dome(-1, 0, [-Math.PI / 3, 0, Math.PI / 3]);
  dome(1, dStep, [-Math.PI / 2.6, -Math.PI / 6, Math.PI / 6, Math.PI / 2.6]);
  // panel 4 rides below panel 3: its step face looks east from the barrel's end
  { const hi = arc(cr, dStep * 2), lo = arc(cr, dStep); for (let j = 0; j < nA; j++) K.quad([lo[j], lo[j + 1], hi[j + 1], hi[j]], pal.step, { dir: F.D(1, 0, 0) }); }
  return faces;
}

// ── Colosseum ────────────────────────────────────────────────────────────────────────────────
// The Flavian amphitheatre: an elliptical travertine drum of three arcaded storeys, each arch
// framed by engaged half-columns (Tuscan, Ionic, Corinthian — told apart by the capital's depth)
// under an entablature, then the attic of flat pilasters and small square windows under the
// cornice. The southern outer ring has fallen: the wall steps down raggedly on either side and the
// lower inner ring stands exposed behind the stumps of the outer piers. Inside, the ruined cavea
// reads as a comb of radial walls over the ring corridors, down to the arena, whose floor is gone
// over the hypogeum's parallel walls but for the modern deck at the east end.
const COLOSSEUM = {
  trav: '#d3c4a0', travShade: '#bfae88', arch: '#3d3527', col: '#dccfad', inner: '#b39b76', innerArch: '#463b2c',
  brickTop: '#ad9676', brickGap: '#86705a', podium: '#cbbb96', hyFloor: '#5a4b3a', hyWall: '#a88e6b', deck: '#b99c6c', ground: '#a89c82',
};

function colosseum(b, { L, camHint }) {
  const faces = [], K = makeKit({ faces, L, camHint }), F = frameOf(b), { S } = F;
  const pal = { ...COLOSSEUM, ...(b.landmarkPalette || {}) };
  const a = F.A * 0.98, bb = F.B * 0.98, N = 40, wt = S * 0.03;
  const TIERS = [{ h: 0.086, cap: 0.05 }, { h: 0.083, cap: 0.07 }, { h: 0.081, cap: 0.1 }];
  const zBase = S * 0.012, attic = S * 0.09;
  const tierZ = [zBase]; for (const t of TIERS) tierZ.push(tierZ[tierZ.length - 1] + t.h * S);
  tierZ.push(tierZ[3] + attic);                                        // [base, t1, t2, t3, attic top]
  const pts = ellipse(a, bb, N, -Math.PI / 2 - Math.PI / N);           // a joint straddles due south
  const inPts = pts.map(([s, t]) => { const l = Math.hypot(s / (a * a), t / (bb * bb)) || 1; return [s - (s / (a * a)) / l * wt, t - (t / (bb * bb)) / l * wt]; });
  // the ruin: storeys still standing per bay, by angular distance from due south
  const level = (i) => {
    const m = [(pts[i][0] + pts[(i + 1) % N][0]) / 2, (pts[i][1] + pts[(i + 1) % N][1]) / 2];
    let d = Math.abs(Math.atan2(m[1] / bb, m[0] / a) + Math.PI / 2); if (d > Math.PI) d = TAU - d;
    const deg = d * 180 / Math.PI;
    return deg < 46 ? 0 : deg < 55 ? 1 : deg < 64 ? 2 : deg < 73 ? 3 : 4;
  };
  const LV = Array.from({ length: N }, (_, i) => level(i));

  // the plinth: two travertine steps round the whole drum
  const step = ellipse(F.A * 0.995, F.B * 0.995, N, -Math.PI / 2 - Math.PI / N);
  band(K, F, step, 0, zBase * 0.5, pal.travShade);
  ring(K, F, step, pts, zBase * 0.5, pal.ground, false, zBase * 0.5);
  band(K, F, pts, zBase * 0.5, zBase, pal.travShade);

  for (let i = 0; i < N; i++) {
    const p0 = pts[i], p1 = pts[(i + 1) % N], lv = LV[i];
    if (lv === 0) {
      // the fallen bays: pier stumps on the plinth
      const { W, len: l } = facetWall(K, F, p0, p1, zBase);
      W.proud(-l * 0.09, 0, l * 0.09, S * (0.03 + 0.02 * ((i * 7) % 3) / 2), wt, pal.travShade);
      continue;
    }
    for (let k = 0; k < Math.min(lv, 3); k++) {
      const { W, len: l } = facetWall(K, F, p0, p1, tierZ[k]), h = tierZ[k + 1] - tierZ[k], T = TIERS[k];
      const r = l * 0.29, tS = h * 0.8 - r;
      W.rect(0, 0, l, h, pal.trav);
      W.arch(l * 0.21, l * 0.79, 0, tS, l * 0.08, pal.arch, null, { seg: 4 });
      // engaged half-column on the joint, its capital, the entablature over the bay
      W.proud(-l * 0.07, 0, l * 0.07, h * 0.8, l * 0.05, pal.col);
      W.proud(-l * 0.1, h * (0.8 - T.cap), l * 0.1, h * 0.8, l * 0.07, pal.col);
      W.proud(-l * 0.02, h * 0.82, l * 1.02, h * 0.97, l * 0.04, pal.trav);
    }
    if (lv === 4) {
      const { W, len: l } = facetWall(K, F, p0, p1, tierZ[3]), h = attic;
      W.rect(0, 0, l, h, pal.trav);
      W.proud(-l * 0.05, 0, l * 0.05, h * 0.86, l * 0.025, pal.col);
      if (i % 2 === 0) W.recess(l * 0.4, h * 0.42, l * 0.6, h * 0.6, l * 0.04, pal.arch, null);
      W.proud(-l * 0.02, h * 0.86, l * 1.02, h, l * 0.06, pal.trav);
    }
    // the wall's thickness: its top, its inner face above the cavea, the broken ends
    const zTop = tierZ[Math.min(lv, 4)] + (lv < 4 ? 0 : 0);
    const q0 = inPts[i], q1 = inPts[(i + 1) % N];
    K.quad([F.P(p0[0], p0[1], zTop), F.P(p1[0], p1[1], zTop), F.P(q1[0], q1[1], zTop), F.P(q0[0], q0[1], zTop)], pal.travShade, { dir: [0, 0, 1] });
    if (lv === 4) {
      // the inner face above the cavea: the top gallery's arches and the attic's windows seen from inside
      const Wi = K.wall(F.P(q1[0], q1[1], S * 0.25), norm(sub(F.P(q0[0], q0[1], 0), F.P(q1[0], q1[1], 0))), [0, 0, 1], norm(sub(F.P(q0[0] * 0.5, q0[1] * 0.5, 0), F.P(q0[0], q0[1], 0))));
      const li = Math.hypot(q1[0] - q0[0], q1[1] - q0[1]), hi = zTop - S * 0.25, g = tierZ[3] - S * 0.25;
      Wi.rect(0, 0, li, hi, pal.travShade);
      if (g > 0) Wi.arch(li * 0.24, li * 0.76, 0, Math.max(0.001, g * 0.9 - li * 0.26), li * 0.06, pal.arch, null, { seg: 4 });
      if (i % 2 === 0) Wi.recess(li * 0.4, g + attic * 0.42, li * 0.6, g + attic * 0.6, li * 0.04, pal.arch, null);
    }
    for (const [e, nb] of [[0, (i + N - 1) % N], [1, (i + 1) % N]]) {
      if (LV[nb] >= lv) continue;
      const po = e ? p1 : p0, pi = e ? q1 : q0, zLo = LV[nb] === 0 ? zBase : tierZ[Math.min(LV[nb], 4)];
      const other = e ? p0 : p1;
      K.quad([F.P(po[0], po[1], zLo), F.P(pi[0], pi[1], zLo), F.P(pi[0], pi[1], zTop), F.P(po[0], po[1], zTop)], pal.travShade, F.P(other[0], other[1], zTop));
    }
  }

  // the inner ring: exposed where the outer ring fell (and a bay either side)
  const ka = 0.87, kb = 0.85, zIn = S * 0.25, inner = ellipse(a * ka, bb * kb, N, -Math.PI / 2 - Math.PI / N);
  for (let i = 0; i < N; i++) {
    const near = Math.min(LV[i], LV[(i + 1) % N], LV[(i + N - 1) % N]);
    if (near >= 4) continue;
    const { W, len: l } = facetWall(K, F, inner[i], inner[(i + 1) % N], zBase), h = zIn - zBase;
    W.rect(0, 0, l, h, pal.inner);
    for (const [t0, t1] of [[0, h * 0.44], [h * 0.52, h * 0.9]]) {
      const r = l * 0.3; W.arch(l * 0.2, l * 0.8, t0, t1 - r, l * 0.08, pal.innerArch, null, { seg: 4 });
    }
    W.proud(-l * 0.02, h * 0.46, l * 1.02, h * 0.52, l * 0.03, pal.inner);
    // the ambulatory floor between the rings
    const o0 = pts[i], o1 = pts[(i + 1) % N];
    K.quad([F.P(o0[0], o0[1], zBase), F.P(o1[0], o1[1], zBase), F.P(inner[(i + 1) % N][0], inner[(i + 1) % N][1], zBase), F.P(inner[i][0], inner[i][1], zBase)], pal.ground, { dir: [0, 0, 1] });
  }
  // the upper gallery floor behind the standing outer wall
  ring(K, F, inPts, inner, zIn, (i) => (LV[i] >= 3 ? pal.brickTop : null), false, zIn);

  // the cavea: a comb of radial wall tops over the ring corridors, down to the podium
  const CAV = [[ka, kb, 0.25], [0.74, 0.7, 0.19], [0.63, 0.56, 0.135], [0.54, 0.44, 0.085], [0.48, 0.36, 0.068]];
  const aA = 0.46, aB = 0.335;
  for (let r = 0; r < CAV.length - 1; r++) {
    const [sa0, sb0, z0] = CAV[r], [sa1, sb1, z1] = CAV[r + 1];
    for (let i = 0; i < N; i++) {
      const th0 = -Math.PI / 2 - Math.PI / N + (i / N) * TAU, th1 = th0 + TAU / N, thm = th0 + (TAU / N) * 0.3;
      const E = (sa, sb, th, z) => F.P(a * sa * Math.cos(th), bb * sb * Math.sin(th), z * S);
      const inside = F.P(0, 0, S);
      K.quad([E(sa0, sb0, th0, z0), E(sa0, sb0, thm, z0), E(sa1, sb1, thm, z1), E(sa1, sb1, th0, z1)], pal.brickTop, inside);
      K.quad([E(sa0, sb0, thm, z0 - 0.012), E(sa0, sb0, th1, z0 - 0.012), E(sa1, sb1, th1, z1 - 0.012), E(sa1, sb1, thm, z1 - 0.012)], r % 2 ? pal.brickGap : scaleHex(pal.brickGap, 0.9), inside);
    }
  }
  // the podium wall down to the arena
  const pod = ellipse(a * 0.48, bb * 0.36, N, -Math.PI / 2 - Math.PI / N), arena = ellipse(a * aA, bb * aB, N, -Math.PI / 2 - Math.PI / N);
  ring(K, F, pod, arena, S * 0.068, pal.podium);
  for (let i = 0; i < N; i++) {
    const p0 = arena[i], p1 = arena[(i + 1) % N];
    K.quad([F.P(p0[0], p0[1], S * 0.012), F.P(p1[0], p1[1], S * 0.012), F.P(p1[0], p1[1], S * 0.068), F.P(p0[0], p0[1], S * 0.068)], pal.podium, F.P(p0[0] * 3, p0[1] * 3, S * 0.04));
  }
  // the arena: the hypogeum's floor and its long walls, the modern deck at the east end
  K.poly(arena.map(([s, t]) => F.P(s, t, S * 0.012)), pal.hyFloor, { dir: [0, 0, 1] });
  const ea = a * aA, eb = bb * aB, zw = S * 0.045, deckS = ea * 0.5;
  for (let k = -3; k <= 3; k++) {
    const t = (k / 3.6) * eb, half = ea * Math.sqrt(Math.max(0, 1 - (t / eb) ** 2)) * 0.94, w = S * 0.006;
    const s0 = -half, s1 = Math.min(half, deckS);
    if (s1 <= s0) continue;
    K.quad([F.P(s0, t - w, zw), F.P(s1, t - w, zw), F.P(s1, t + w, zw), F.P(s0, t + w, zw)], pal.hyWall, { dir: [0, 0, 1] });
    K.quad([F.P(s0, t - w, S * 0.012), F.P(s1, t - w, S * 0.012), F.P(s1, t - w, zw), F.P(s0, t - w, zw)], scaleHex(pal.hyWall, 0.9), { dir: F.D(0, -1, 0) });
  }
  for (let k = -4; k <= 1; k++) {
    const s = (k / 4.6) * ea, half = eb * Math.sqrt(Math.max(0, 1 - (s / ea) ** 2)) * 0.9, w = S * 0.005;
    K.quad([F.P(s - w, -half, zw * 0.8), F.P(s + w, -half, zw * 0.8), F.P(s + w, half, zw * 0.8), F.P(s - w, half, zw * 0.8)], pal.hyWall, { dir: [0, 0, 1] });
  }
  const chord = eb * Math.sqrt(1 - (deckS / ea) ** 2);
  const dk = [[deckS, -chord], ...arena.filter(([s]) => s > deckS), [deckS, chord]];
  const dc = [dk.reduce((m, p) => m + p[0], 0) / dk.length, 0];
  dk.sort((p, q) => Math.atan2(p[1] - dc[1], p[0] - dc[0]) - Math.atan2(q[1] - dc[1], q[0] - dc[0]));
  K.poly(dk.map(([s, t]) => F.P(s, t, zw * 1.1)), pal.deck, { dir: [0, 0, 1] });
  K.quad([F.P(deckS, -chord, S * 0.012), F.P(deckS, chord, S * 0.012), F.P(deckS, chord, zw * 1.1), F.P(deckS, -chord, zw * 1.1)], scaleHex(pal.deck, 0.8), { dir: F.D(-1, 0, 0) });
  return faces;
}


/** A box in the local frame: s0..s1 × t0..t1 × z0..z1 (tint: hex or { side, top, bottom }). */
function lbox(K, F, s0, t0, s1, t1, z0, z1, tint) {
  const t = typeof tint === 'string' ? { side: tint, top: scaleHex(tint, 1.04) } : tint;
  const Q = (s, tt, z) => F.P(s, tt, z), ins = F.P((s0 + s1) / 2, (t0 + t1) / 2, (z0 + z1) / 2);
  K.quad([Q(s0, t0, z0), Q(s1, t0, z0), Q(s1, t0, z1), Q(s0, t0, z1)], t.front || t.side, ins);
  K.quad([Q(s1, t0, z0), Q(s1, t1, z0), Q(s1, t1, z1), Q(s1, t0, z1)], t.side, ins);
  K.quad([Q(s1, t1, z0), Q(s0, t1, z0), Q(s0, t1, z1), Q(s1, t1, z1)], t.back || t.side, ins);
  K.quad([Q(s0, t1, z0), Q(s0, t0, z0), Q(s0, t0, z1), Q(s0, t1, z1)], t.side, ins);
  if (t.top) K.quad([Q(s0, t0, z1), Q(s1, t0, z1), Q(s1, t1, z1), Q(s0, t1, z1)], t.top, ins);
  if (t.bottom) K.quad([Q(s0, t0, z0), Q(s1, t0, z0), Q(s1, t1, z0), Q(s0, t1, z0)], t.bottom, ins);
}

// ── Arena ────────────────────────────────────────────────────────────────────────────────────
// A contemporary domed arena: a glazed concourse storey set back under a cantilevered drum of
// metal panels that leans out as it rises, ruled by structural fins; a dark signage band at the
// eave; a shallow dome carried on radial trusses to a glazed lantern; and on the front a glazed
// entry atrium under a thin canopy.
const ARENA = {
  plinth: '#9ea2a2', glass: '#3b4b56', mullion: '#9aa3a8', soffit: '#596166', skin: '#c3c8cb', fin: '#a3abb0',
  sign: '#30363a', signFace: '#d8dbd6', eave: '#b8bdc0', roof: '#cdd1d2', truss: '#99a2a8', lantern: '#dfe4e4', canopy: '#d6d9d8',
};

function arenaVenue(b, { L, camHint }) {
  const faces = [], K = makeKit({ faces, L, camHint }), F = frameOf(b), { S } = F;
  const pal = { ...ARENA, ...(b.landmarkPalette || {}) };
  const N = 48, a = F.A * 0.97, bb = F.B * 0.86, t0 = F.B * 0.1;
  const E = (sc, n = N) => Array.from({ length: n }, (_, i) => { const th = -Math.PI / 2 + (i / n) * TAU; return [a * sc * Math.cos(th), t0 + bb * sc * Math.sin(th)]; });
  const C = [0, t0];
  const zPl = S * 0.012, zG = S * 0.12, zSk = S * 0.3, rise = S * 0.17;
  const e100 = E(1), e93 = E(0.93), e97 = E(0.97);
  band(K, F, E(1.0), 0, zPl, pal.plinth, C);
  ring(K, F, E(1.0), e93, zPl, pal.plinth);
  // the glazed concourse: glass, mullions at every joint, a transom
  for (let i = 0; i < N; i++) {
    const { W, len: l } = facetWall(K, F, e93[i], e93[(i + 1) % N], zPl), h = zG - zPl;
    W.rect(0, 0, l, h, pal.glass);
    W.rect(0, h * 0.62, l, h * 0.66, pal.mullion, 0.004);
    W.proud(-l * 0.05, 0, l * 0.05, h, S * 0.006, pal.mullion);
  }
  ring(K, F, e97, e93, zG, pal.soffit, true);
  // the leaning metal drum in three panel courses, with a fin at every other joint
  const courses = [zG, zG + (zSk - zG) * 0.36, zG + (zSk - zG) * 0.68, zSk];
  const scAt = (z) => 0.97 + 0.03 * (z - zG) / (zSk - zG);
  for (let c = 0; c < 3; c++) {
    const lo = E(scAt(courses[c])), hi = E(scAt(courses[c + 1]));
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      K.quad([F.P(lo[i][0], lo[i][1], courses[c]), F.P(lo[j][0], lo[j][1], courses[c]), F.P(hi[j][0], hi[j][1], courses[c + 1]), F.P(hi[i][0], hi[i][1], courses[c + 1])], scaleHex(pal.skin, [1, 0.97, 1.02][c]), F.P(0, t0, courses[c]));
    }
  }
  for (let i = 0; i < N; i += 2) {
    const th = -Math.PI / 2 + (i / N) * TAU, lo = E(0.97)[i], hi = e100[i];
    const nx = Math.cos(th) / a, ny = Math.sin(th) / bb, nl = Math.hypot(nx, ny), fd = S * 0.024;
    const o = [nx / nl * fd, ny / nl * fd];
    const tg = F.D(-Math.sin(th) * a, Math.cos(th) * bb, 0);
    K.quad([F.P(lo[0], lo[1], zG), F.P(hi[0], hi[1], zSk), F.P(hi[0] + o[0] * 0.5, hi[1] + o[1] * 0.5, zSk), F.P(lo[0] + o[0], lo[1] + o[1], zG)], pal.fin, { dir: tg });
  }
  // the signage band at the eave, and the name panel over the entry
  band(K, F, E(1.003), zSk - S * 0.045, zSk, pal.sign, C);
  for (let i = N - 3; i < N + 3; i++) {
    const k = ((i % N) + N) % N;
    if (k === N - 3 || k === 2) continue;
    const { W, len: l } = facetWall(K, F, E(1.006)[k], E(1.006)[(k + 1) % N], zSk - S * 0.04);
    W.rect(l * 0.08, S * 0.008, l * 0.92, S * 0.03, pal.signFace, 0.002);
  }
  // the dome: an eave ring, the shell, radial trusses, the lantern
  ring(K, F, E(1.012), E(0.95), zSk, pal.eave);
  band(K, F, E(1.012), zSk - S * 0.006, zSk, pal.eave, C);
  const NK = 7, rows = [];
  for (let k = 0; k <= NK; k++) {
    const ph = (k / NK) * (Math.PI / 2) * 0.93, sc = 0.95 * Math.cos(ph), z = zSk + rise * Math.sin(ph);
    rows.push(E(sc).map(([s, t]) => F.P(s, t, z)));
  }
  sheet(K, rows, pal.roof, F.P(0, t0, zSk), true);
  const top = rows[NK], scTop = 0.95 * Math.cos((Math.PI / 2) * 0.93), zTop = zSk + rise * Math.sin((Math.PI / 2) * 0.93);
  for (let r = 0; r < 16; r++) {
    const i = r * 3, pts = [];
    for (let k = 0; k <= NK; k++) {
      const ph = (k / NK) * (Math.PI / 2) * 0.93, sc = 0.95 * Math.cos(ph), z = zSk + rise * Math.sin(ph), th = -Math.PI / 2 + (i / N) * TAU;
      pts.push([a * sc * Math.cos(th), t0 + bb * sc * Math.sin(th), z, th]);
    }
    for (let k = 0; k < NK; k++) {
      const [s0, u0, z0, th] = pts[k], [s1, u1, z1] = pts[k + 1], w = S * 0.007, hgt = S * 0.012;
      const tx = -Math.sin(th), ty = Math.cos(th);
      const A0 = F.P(s0 + tx * w, u0 + ty * w, z0), A1 = F.P(s0 - tx * w, u0 - ty * w, z0), R0 = F.P(s0, u0, z0 + hgt);
      const B0 = F.P(s1 + tx * w, u1 + ty * w, z1), B1 = F.P(s1 - tx * w, u1 - ty * w, z1), R1 = F.P(s1, u1, z1 + hgt);
      K.quad([A0, B0, R1, R0], pal.truss, F.P(s0, u0, z0 - S));
      K.quad([A1, B1, R1, R0], scaleHex(pal.truss, 0.96), F.P(s0, u0, z0 - S));
    }
  }
  const lz = zTop + S * 0.035, lan = E(scTop * 0.92, 24), lanTop = E(scTop * 0.8, 24);
  band(K, F, E(scTop, 24), zTop, zTop + S * 0.004, pal.eave, C);
  band(K, F, lan, zTop, lz, pal.glass, C);
  K.poly(lanTop.map(([s, t]) => F.P(s, t, lz + S * 0.008)), pal.lantern, { dir: [0, 0, 1] });
  band(K, F, lan.map(([s, t], i) => lanTop[i]), lz, lz + S * 0.008, pal.lantern, C);
  // the entry atrium: a glass box pushed out of the drum under a thin canopy
  const sA = a * 0.34, tF = -F.B * 0.95, tB = -F.B * 0.62, zA = S * 0.15;
  lbox(K, F, -sA, tF, sA, tB, 0, zA, { side: pal.glass, top: null });
  { const { W, len: l } = facetWall(K, F, [-sA, tF], [sA, tF], 0);
    for (let m = 0; m <= 8; m++) W.proud(l * (m / 8) - S * 0.003, 0, l * (m / 8) + S * 0.003, zA, S * 0.004, pal.mullion);
    W.rect(0, zA * 0.34, l, zA * 0.37, pal.mullion, 0.003);
    W.rect(l * 0.36, 0, l * 0.64, zA * 0.3, scaleHex(pal.glass, 0.7), 0.004); }
  lbox(K, F, -sA * 1.12, -F.B * 0.99, sA * 1.12, tB, zA, zA + S * 0.012, { side: pal.canopy, top: scaleHex(pal.canopy, 1.02), bottom: pal.soffit });
  return faces;
}

// ── Cloud Gate ───────────────────────────────────────────────────────────────────────────────
// Kapoor's mirror: a bean of polished stainless, set on two feet with the 12-foot arch walked
// under between them and the omphalos pushed up into the arch's ceiling. A mirror carries no
// diffuse shade of its own: every face takes the colour of what it REFLECTS toward a canonical
// viewer — bright sky on the crown, the dark band of the skyline at the horizon, the pale plaza
// below it, the underside's dark self-reflection.
const BEAN = { skyHi: '#e1e8ee', skyTop: '#9fb4cb', skyline: '#5a636c', plazaFar: '#a29e96', plaza: '#86837c', under: '#4f5256' };

function cloudGate(b, { L, camHint }) {
  const faces = [], F = frameOf(b), { S } = F;
  const pal = { ...BEAN, ...(b.landmarkPalette || {}) };
  const a = F.A * 0.97, bw = F.B * 0.95, H = S * 0.62, zc = 0.45 * H, cUp = H - zc, cLo = zc + 0.16 * H;
  const sA = a * 0.7, hA = 0.38 * H, hO = 0.1 * H;
  const NT = 56, p = 2.4;
  const plan = (th, rho) => { const c = Math.cos(th), s = Math.sin(th); return [a * rho * Math.sign(c) * Math.pow(Math.abs(c), 2 / p), bw * rho * Math.sign(s) * Math.pow(Math.abs(s), 2 / p)]; };
  const under = (s, t, rho) => {
    let z = Math.max(0, zc - cLo * Math.sqrt(Math.max(0, 1 - rho * rho)));
    if (Math.abs(s) < sA) {
      const arch = hA * Math.pow(1 - (s / sA) ** 2, 0.7) + hO * Math.exp(-((s / (0.2 * a)) ** 2 + (t / (0.4 * bw)) ** 2));
      z = Math.max(z, Math.min(arch, zc - (1 - rho) * 0.02 * H));
    }
    return z;
  };
  const RL = [0, 0.14, 0.28, 0.4, 0.5, 0.6, 0.68, 0.76, 0.83, 0.89, 0.94, 0.975, 0.993, 1];
  const lower = RL.map((rho) => Array.from({ length: NT }, (_, i) => { const th = (i / NT) * TAU, [s, t] = plan(th, rho); return F.P(s, t, under(s, t, rho)); }));
  const UP = 12, upper = [];
  for (let k = 0; k <= UP; k++) {
    const ph = (k / UP) * Math.PI / 2, rho = Math.pow(Math.cos(ph), 0.85), z = zc + cUp * Math.sin(ph);
    upper.push(Array.from({ length: NT }, (_, i) => { const th = (i / NT) * TAU, [s, t] = plan(th, rho); return F.P(s, t, z); }));
  }
  // the reflected environment for a viewer standing off the front, a little above the plaza
  const V = F.P(-0.4 * a, -3.4 * F.B, 0.9 * H);
  const env = (r) => {
    const rz = r[2];
    if (rz > 0.14) return mixHex(pal.skyHi, pal.skyTop, Math.min(1, Math.pow((rz - 0.14) / 0.86, 0.7)));
    if (rz > 0.04) return mixHex(pal.skyline, pal.skyHi, (rz - 0.04) / 0.1);
    if (rz > -0.04) return pal.skyline;
    if (rz > -0.14) return mixHex(pal.skyline, pal.plazaFar, Math.min(1, (-rz - 0.04) / 0.05));
    return mixHex(pal.plazaFar, pal.under, Math.min(1, (-rz - 0.14) / 0.7));
  };
  const push = (pts, lowerFace) => {
    if (pts.every((q) => q[2] - b.z0 < 1e-6)) return;
    const c = v3.centroid(pts);
    let n = norm(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
    if (!Number.isFinite(n[0]) || len(n) < 0.5) n = norm(cross(sub(pts[2], pts[1]), sub(pts[3], pts[1])));
    const radial = norm([c[0] - F.cx, c[1] - F.cy, 0]);
    const want = lowerFace ? [radial[0] * 0.3, radial[1] * 0.3, -1] : sub(c, F.P(0, 0, zc * 0.8));
    if (dot(n, want) < 0) n = mul(n, -1);
    const d = norm(sub(c, V)), r = sub(d, mul(n, 2 * dot(d, n)));
    let fill = lowerFace && n[2] < -0.35 ? mixHex(pal.under, pal.plaza, Math.max(0, 1 + n[2]) * 0.8) : env(r);
    faces.push({ corners: pts, fill, doubleSided: true, outNormal: n });
  };
  const grid = (rows, lowerFace) => {
    for (let k = 0; k < rows.length - 1; k++) for (let i = 0; i < NT; i++) {
      const j = (i + 1) % NT, A0 = rows[k][i], A1 = rows[k][j], B0 = rows[k + 1][i], B1 = rows[k + 1][j];
      if (same(A0, A1)) push([A0, B1, B0], lowerFace);
      else if (same(B0, B1)) push([A0, A1, B0], lowerFace);
      else push([A0, A1, B1, B0], lowerFace);
    }
  };
  grid(lower, true);
  grid(upper, false);
  // triangles go out as the kit draws them: a quad clipped to its apex
  for (let f = 0; f < faces.length; f++) {
    const q = faces[f];
    if (q.corners.length === 3) {
      const [A, B, T] = q.corners, Uw = sub(B, A), ub = norm(Uw), AT = sub(T, A), Vw = sub(AT, mul(ub, dot(AT, ub)));
      faces[f] = { ...q, corners: [A, B, add(B, Vw), add(A, Vw)], clip: `polygon(0% 0%, 100% 0%, ${(dot(AT, ub) / len(Uw) * 100).toFixed(1)}% 100%)` };
    }
  }
  return faces;
}

// ── Gateway Arch ─────────────────────────────────────────────────────────────────────────────
// Saarinen's weighted catenary (the as-built curve, C = 3.0022, as tall as it is wide) in brushed
// stainless: an equilateral-triangle section, flat face out and a sharp edge in, tapering from 54 ft
// a side at the feet to 17 at the crown. The skin takes its value from what it faces — darker low
// on the legs where it reflects the grounds, bright where it turns to the sky — with the slit of the
// observation windows at the crown and flush granite pads where the legs meet the ground.
const GATEWAY = { steelLow: '#8f969b', steelHigh: '#d3d8db', window: '#2c3135', pad: '#aaa69c' };

function gatewayArch(b, { L, camHint }) {
  const faces = [], K = makeKit({ faces, L, camHint }), F = frameOf(b), { S, A } = F;
  const pal = { ...GATEWAY, ...(b.landmarkPalette || {}) };
  const span = Math.min(A * 2 * 0.88, S * 1.95), Hh = span, C = 3.0022, cC = Math.cosh(C);
  const hAt = (u) => Hh * (cC - Math.cosh(C * u)) / (cC - 1);
  const sB = 0.086 * span, sT = 0.027 * span;
  const side = (u) => sT + (sB - sT) * (1 - hAt(u) / Hh);
  // sample densely where the legs run steep (uniform in arc length via a warped parameter)
  const NS = 84, us = Array.from({ length: NS + 1 }, (_, i) => { const x = -1 + (2 * i) / NS; return Math.sign(x) * Math.pow(Math.abs(x), 0.8); });
  const ctr = us.map((u) => [u * span / 2, hAt(u)]);
  const bAx = F.D(0, 1, 0);
  const secs = us.map((u, i) => {
    const p0 = ctr[Math.max(0, i - 1)], p1 = ctr[Math.min(NS, i + 1)];
    const T = norm(F.D(p1[0] - p0[0], 0, p1[1] - p0[1]));
    let n = norm(cross(T, bAx)); if (dot(n, F.D(ctr[i][0], 0, ctr[i][1] + Hh * 0.2)) < 0 && n[2] < 0.99) { /* keep */ }
    // n points away from the arch's inside (up at the crown, outward on the legs)
    const inward = F.D(-ctr[i][0], 0, Hh * 0.35 - ctr[i][1]);
    if (dot(n, inward) > 0) n = mul(n, -1);
    const r = side(u) / Math.sqrt(3), P = F.P(ctr[i][0], 0, ctr[i][1]);
    return { P, pts: [add(P, mul(n, -r)), add(add(P, mul(n, r / 2)), mul(bAx, r * 0.866)), add(add(P, mul(n, r / 2)), mul(bAx, -r * 0.866))], h: ctr[i][1] };
  });
  for (let i = 0; i < NS; i++) {
    const S0 = secs[i], S1 = secs[i + 1], hm = (S0.h + S1.h) / 2 / Hh;
    for (let e = 0; e < 3; e++) {
      const f = (e + 1) % 3;
      // the flat outer face (edge 1→2) turns to the sky; the flanks read the grounds low down
      const k = e === 1 ? Math.min(1, 0.35 + hm * 0.8) : Math.min(1, hm * 0.9);
      K.quad([S0.pts[e], S0.pts[f], S1.pts[f], S1.pts[e]], mixHex(pal.steelLow, pal.steelHigh, k), v3.lerp(S0.P, S1.P, 0.5));
    }
  }
  // the observation windows: a dark slit along the crown's outer face
  for (let i = Math.round(NS / 2) - 3; i < Math.round(NS / 2) + 3; i++) {
    const S0 = secs[i], S1 = secs[i + 1];
    const q = (Sx, w) => v3.lerp(v3.lerp(Sx.pts[1], Sx.pts[2], 0.5), Sx.pts[w], 0.35);
    const lift = (p, Sx) => add(p, mul(norm(sub(v3.lerp(Sx.pts[1], Sx.pts[2], 0.5), Sx.P)), S * 0.002));
    K.quad([lift(q(S0, 1), S0), lift(q(S1, 1), S1), lift(q(S1, 2), S1), lift(q(S0, 2), S0)], pal.window, { dir: [0, 0, 1] });
  }
  // flush granite pads round each foot
  for (const e of [0, NS]) {
    const Sx = secs[e], c = Sx.P, pad = Sx.pts.map((p) => add(c, mul(sub([p[0], p[1], c[2]], c), 1.5)));
    const P3 = pad.map((p) => [p[0], p[1], b.z0 + S * 0.006]);
    K.poly(P3, pal.pad, { dir: [0, 0, 1] });
    for (let k = 0; k < 3; k++) K.quad([[pad[k][0], pad[k][1], b.z0], [pad[(k + 1) % 3][0], pad[(k + 1) % 3][1], b.z0], P3[(k + 1) % 3], P3[k]], pal.pad, c);
  }
  return faces;
}


// ── Mobile EDM Hall ──────────────────────────────────────────────────────────────────────────
// The fictional touring venue, drawn as a designed machine: a tracked chassis (a raised front
// idler, a rear drive sprocket, six road wheels and return rollers inside a linked belt) under a
// fendered deck and a turret collar; on it the spherical hull, panelled in bays between seam lines,
// with the stage cut into its front (a proscenium ring, a stage floor, an LED wall), crowned by a
// ring truss of lamps on four posts.
const EDM = {
  belt: '#2f3133', link: '#3d4043', wheel: '#55595c', hub: '#7b7f82', chassis: '#3f4549', deck: '#6b7278', collar: '#50575d',
  hull: '#c8c8c2', seam: '#8a8c89', frame: '#4f555b', stage: '#2a2d31', floor: '#4a4239', screen: '#7187a8', screenHi: '#a9b8cf',
  rig: '#5a6066', lamp: '#e2d4a4', light: '#e8dcae',
};

function mobileEdmHall(b, { L, camHint }) {
  const faces = [], K = makeKit({ faces, L, camHint }), F = frameOf(b, true), sd = Math.min(b.w, b.d), B = F.B;
  const pal = { ...EDM, ...(b.landmarkPalette || {}) };
  const gap = sd * 0.31, tw = sd * 0.15;
  // the track loop in (t, z): a raised front idler (−t), a rear sprocket, flat runs
  const LOOP = [[-0.7, 0], [-0.35, 0], [0, 0], [0.35, 0], [0.7, 0], [0.82, 0.03], [0.9, 0.08], [0.92, 0.12], [0.89, 0.16], [0.82, 0.185], [0.4, 0.185], [0, 0.185], [-0.4, 0.185],
    [-0.82, 0.185], [-0.9, 0.17], [-0.95, 0.13], [-0.93, 0.085], [-0.84, 0.035]].map(([t, z]) => [t * B, z * sd]);
  const lc = [0, 0.09 * sd];
  for (const sg of [-1, 1]) {
    const s0 = sg * gap - tw / 2, s1 = sg * gap + tw / 2, so = sg > 0 ? s1 : s0, si = sg > 0 ? s0 : s1;
    // the belt: links along each edge
    for (let e = 0; e < LOOP.length; e++) {
      const [ta, za] = LOOP[e], [tb, zb] = LOOP[(e + 1) % LOOP.length], nl = Math.max(1, Math.round(Math.hypot(tb - ta, zb - za) / (sd * 0.05)));
      for (let k = 0; k < nl; k++) {
        const t0 = ta + (tb - ta) * k / nl, z0 = za + (zb - za) * k / nl, t1 = ta + (tb - ta) * (k + 1) / nl, z1 = za + (zb - za) * (k + 1) / nl;
        K.quad([F.P(s0, t0, z0), F.P(s1, t0, z0), F.P(s1, t1, z1), F.P(s0, t1, z1)], k % 2 ? pal.belt : pal.link, F.P(sg * gap, lc[0], lc[1]));
      }
    }
    // the belt's edge on both faces, the dark hull behind the wheels
    const inset = LOOP.map(([t, z]) => [t + (lc[0] - t) * 0.1, z + (lc[1] - z) * 0.2]);
    for (const sx of [so, si]) {
      const out = { dir: F.D(sx === so ? sg : -sg, 0, 0) };
      for (let e = 0; e < LOOP.length; e++) {
        const f = (e + 1) % LOOP.length;
        K.quad([F.P(sx, LOOP[e][0], LOOP[e][1]), F.P(sx, LOOP[f][0], LOOP[f][1]), F.P(sx, inset[f][0], inset[f][1]), F.P(sx, inset[e][0], inset[e][1])], pal.belt, out);
      }
      K.poly(inset.map(([t, z]) => F.P(sx - (sx === so ? sg : -sg) * sd * 0.02, t, z)), pal.chassis, out);
    }
    // road wheels, sprocket, idler, return rollers on the outer face
    const nOut = F.D(sg, 0, 0), sw = so + sg * sd * 0.004;
    for (let k = 0; k < 6; k++) {
      const t = (-0.62 + (1.24 * k) / 5) * B;
      disc(K, F.P(sw, t, 0.062 * sd), nOut, 0.056 * sd, 10, pal.wheel);
      disc(K, F.P(sw + sg * sd * 0.003, t, 0.062 * sd), nOut, 0.024 * sd, 6, pal.hub);
    }
    disc(K, F.P(sw, 0.83 * B, 0.1 * sd), nOut, 0.068 * sd, 12, pal.wheel);
    disc(K, F.P(sw + sg * sd * 0.003, 0.83 * B, 0.1 * sd), nOut, 0.04 * sd, 8, pal.hub);
    disc(K, F.P(sw, -0.86 * B, 0.115 * sd), nOut, 0.056 * sd, 10, pal.wheel);
    for (const t of [-0.4, 0, 0.4]) disc(K, F.P(sw, t * B, 0.158 * sd), nOut, 0.018 * sd, 6, pal.hub);
  }
  // chassis, deck with fenders, the sloped glacis and its lamps, the turret collar
  const zD = 0.19 * sd, zDt = 0.215 * sd;
  lbox(K, F, -gap + tw / 2, -0.8 * B, gap - tw / 2, 0.8 * B, 0.03 * sd, zD, pal.chassis);
  lbox(K, F, -gap - tw / 2 - sd * 0.01, -0.84 * B, gap + tw / 2 + sd * 0.01, 0.9 * B, zD, zDt, { side: scaleHex(pal.deck, 0.9), top: pal.deck, bottom: pal.chassis });
  const gs = gap + tw / 2 + sd * 0.01;
  K.quad([F.P(-gs, -0.84 * B, zDt), F.P(gs, -0.84 * B, zDt), F.P(gs * 0.8, -0.97 * B, zD * 0.62), F.P(-gs * 0.8, -0.97 * B, zD * 0.62)], pal.deck, F.P(0, 0, zD * 0.5));
  for (const sg of [-1, 1]) K.tri(F.P(sg * gs, -0.84 * B, zDt), F.P(sg * gs * 0.8, -0.97 * B, zD * 0.62), F.P(sg * gs, -0.84 * B, zD * 0.62), scaleHex(pal.deck, 0.85), F.P(0, 0, zD * 0.5));
  for (const sg of [-1, 1]) disc(K, add(F.P(sg * gs * 0.6, -0.905 * B, zD * 0.84), [0, 0, 0]), norm(F.D(0, -0.97, 0.45)), sd * 0.022, 8, pal.light);
  const R = 0.4 * sd, zc = zDt + R * 0.93;
  K.lathe(F.cx, F.cy, [[0.3 * sd, zDt + b.z0], [0.3 * sd, zDt + 0.03 * sd + b.z0], [0.26 * sd, zDt + 0.045 * sd + b.z0]], 28, pal.collar, { capTop: null });

  // the hull: bays of panels between seams, with the stage cut into its front
  const NA = 32, NL = 16, az0 = -Math.PI / 2;                     // azimuth 0 = the front (−t)
  const sp = (i, k, r = R) => { const az = az0 + (i / NA) * TAU, la = -Math.PI / 2 + (k / NL) * Math.PI; return F.P(Math.cos(az) * Math.cos(la) * r, Math.sin(az) * Math.cos(la) * r, zc - b.z0 + Math.sin(la) * r); };
  const inStage = (i, k) => (i <= 2 || i >= NA - 3) && k >= 7 && k <= 10;
  const rows = Array.from({ length: NL + 1 }, (_, k) => Array.from({ length: NA }, (_, i) => sp(i, k)));
  sheet(K, rows, (i, k) => (inStage(i, k) ? null : scaleHex(pal.hull, ((Math.floor(((i + 2) % NA) / 4) + Math.floor(k / 2)) % 2) ? 1 : 0.955)), F.P(0, 0, zc - b.z0), true);
  // seams: latitude every two bands, meridians every four, a hair proud
  const seamW = 0.012;
  for (let k = 2; k < NL; k += 2) for (let i = 0; i < NA; i++) {
    if (inStage(i, k) || inStage(i, k - 1)) continue;
    const A0 = sp(i, k - seamW * NL / Math.PI, R * 1.004), A1 = sp(i + 1, k - seamW * NL / Math.PI, R * 1.004), B1 = sp(i + 1, k + seamW * NL / Math.PI, R * 1.004), B0 = sp(i, k + seamW * NL / Math.PI, R * 1.004);
    K.quad([A0, A1, B1, B0], pal.seam, F.P(0, 0, zc - b.z0));
  }
  for (let i = 2; i < NA; i += 4) for (let k = 1; k < NL - 1; k++) {
    if (inStage(i, k) || inStage(i - 1, k)) continue;
    const d = 0.1;
    K.quad([sp(i - d, k, R * 1.004), sp(i + d, k, R * 1.004), sp(i + d, k + 1, R * 1.004), sp(i - d, k + 1, R * 1.004)], pal.seam, F.P(0, 0, zc - b.z0));
  }
  // the proscenium: a proud frame round the cut, then the stage box inside
  const fr = (pts, tint) => K.quad(pts, tint, F.P(0, 0, zc - b.z0));
  for (let i = -3; i < 3; i++) {
    fr([sp(i, 7, R * 1.03), sp(i + 1, 7, R * 1.03), sp(i + 1, 7.35, R * 1.03), sp(i, 7.35, R * 1.03)], pal.frame);
    fr([sp(i, 10.65, R * 1.03), sp(i + 1, 10.65, R * 1.03), sp(i + 1, 11, R * 1.03), sp(i, 11, R * 1.03)], pal.frame);
    fr([sp(i, 7, R), sp(i + 1, 7, R), sp(i + 1, 7, R * 1.03), sp(i, 7, R * 1.03)], scaleHex(pal.frame, 0.8));
    fr([sp(i, 11, R), sp(i + 1, 11, R), sp(i + 1, 11, R * 1.03), sp(i, 11, R * 1.03)], scaleHex(pal.frame, 1.1));
  }
  for (const i of [-3, 3]) for (let k = 7; k < 11; k++) {
    const di = i < 0 ? 0.3 : -0.3;
    fr([sp(i, k, R * 1.03), sp(i + di, k, R * 1.03), sp(i + di, k + 1, R * 1.03), sp(i, k + 1, R * 1.03)], pal.frame);
    fr([sp(i, k, R), sp(i, k + 1, R), sp(i, k + 1, R * 1.03), sp(i, k, R * 1.03)], scaleHex(pal.frame, 0.9));
  }
  const la0 = -Math.PI / 2 + (7 / NL) * Math.PI, la1 = -Math.PI / 2 + (11 / NL) * Math.PI, azE = (3 / NA) * TAU;
  const zf = zc - b.z0 + Math.sin(la0) * R, zt = zc - b.z0 + Math.sin(la1) * R;
  const hwB = Math.sin(azE) * Math.cos(la0) * R * 0.99, hwT = Math.sin(azE) * Math.cos(la1) * R * 0.99, hw = hwB;
  const tFB = -Math.cos(azE) * Math.cos(la0) * R * 0.99, tFT = -Math.cos(azE) * Math.cos(la1) * R * 0.99, tBack = -0.2 * R, tFront = tFB;
  K.quad([F.P(-hwB, tFB, zf), F.P(hwB, tFB, zf), F.P(hwB, tBack, zf), F.P(-hwB, tBack, zf)], pal.floor, { dir: [0, 0, 1] });
  K.quad([F.P(-hwT, tFT, zt), F.P(hwT, tFT, zt), F.P(hwT, tBack, zt), F.P(-hwT, tBack, zt)], pal.stage, { dir: [0, 0, -1] });
  for (const sg of [-1, 1]) K.quad([F.P(sg * hwB, tFB, zf), F.P(sg * hwB, tBack, zf), F.P(sg * hwT, tBack, zt), F.P(sg * hwT, tFT, zt)], pal.stage, { dir: F.D(-sg, 0, 0) });
  K.quad([F.P(-hwB, tBack, zf), F.P(hwB, tBack, zf), F.P(hwT, tBack, zt), F.P(-hwT, tBack, zt)], pal.stage, { dir: F.D(0, -1, 0) });
  const back = K.wall(F.P(-hwB, tBack, zf), F.D(1, 0, 0), [0, 0, 1], F.D(0, -1, 0));
  const scr = (f0, f1, tint, d) => { const hw0 = hwB + (hwT - hwB) * f0, hw1 = hwB + (hwT - hwB) * f1, m = Math.min(hw0, hw1) * 0.86; back.rect(hwB - m, (zt - zf) * f0, hwB + m, (zt - zf) * f1, tint, d); };
  scr(0.3, 0.86, pal.screen, 0.004);
  scr(0.52, 0.6, pal.screenHi, 0.006);
  lbox(K, F, -hw * 0.3, tBack - R * 0.36, hw * 0.3, tBack - R * 0.22, zf, zf + (zt - zf) * 0.22, { side: pal.frame, top: scaleHex(pal.frame, 1.2) });
  K.quad([F.P(-hwT * 0.9, tFT * 0.8, zt - 0.004), F.P(hwT * 0.9, tFT * 0.8, zt - 0.004), F.P(hwT * 0.9, tFT * 0.72, zt - 0.004), F.P(-hwT * 0.9, tFT * 0.72, zt - 0.004)], pal.lamp, { dir: [0, 0, -1] });

  // the light rig: four posts to a ring truss of lamps over the crown
  const zR = 1.08 * sd, rr = 0.22 * sd, NR = 12;
  for (let q = 0; q < 4; q++) {
    const a = Math.PI / 4 + q * Math.PI / 2, x = Math.cos(a) * rr * 0.8, y = Math.sin(a) * rr * 0.8;
    const zs = zc - b.z0 + Math.sqrt(Math.max(0, R * R - (x * x + y * y))) - 0.01 * sd;
    tube(K, [F.P(x, y, zs), F.P(Math.cos(a) * rr, Math.sin(a) * rr, zR)], sd * 0.009, 4, pal.rig);
  }
  const rp = Array.from({ length: NR + 1 }, (_, i) => { const a = (i / NR) * TAU; return F.P(Math.cos(a) * rr, Math.sin(a) * rr, zR); });
  for (let i = 0; i < NR; i++) tube(K, [rp[i], rp[i + 1]], sd * 0.011, 4, pal.rig);
  for (let i = 0; i < NR; i++) {
    const a = ((i + 0.5) / NR) * TAU, c = F.P(Math.cos(a) * rr * 1.02, Math.sin(a) * rr * 1.02, zR - 0.03 * sd), o = F.D(Math.cos(a), Math.sin(a), -0.6);
    tube(K, [c, add(c, mul(norm(o), 0.035 * sd))], [0.012 * sd, 0.016 * sd], 6, pal.rig, { capEnd: pal.lamp });
  }
  return faces;
}

// ── statues: the polygonised figures, decimated to a landmark's face budget ─────────────────
// The statue primitive's figures are ~40k faces each; a landmark draws each face as a DOM plane,
// so the figure is re-meshed by vertex clustering (a grid of `g` cells per unit height; every
// face keeps its corners' cluster means; collapsed and repeated faces drop). Normals are re-found
// (the figure mesher's winding is mixed): each face is turned away from the centroid of the
// clustered vertices around it, so the city's key lights the statue like the stone under it.
const FIG_CACHE = new Map();
function decimatedFigure(which, g) {
  const key = `${which}:${g}`;
  if (FIG_CACHE.has(key)) return FIG_CACHE.get(key);
  const src = which === 'liberty' ? buildStatueFigure({}).faces : buildRizalFigure({}).faces;
  const out = decimateFaces(src, g, (f) => (parseInt(f.fill.slice(1, 3), 16) > parseInt(f.fill.slice(3, 5), 16) + 12 ? 'gilt' : 'body'))
    .map(({ pts, n, tag }) => ({ pts, n, metal: tag }));
  FIG_CACHE.set(key, out);
  return out;
}

/** Place a decimated figure: feet at `base` (local s, t, z), facing −t (turned 180° from the figure's +y), `span` tall. */
function placeFigure(K, F, faces, base, span, tints) {
  const X = (p) => F.P(base[0] - p[0] * span, base[1] - p[1] * span, base[2] + p[2] * span);
  for (const f of faces) {
    const pts = f.pts.map(X), n = F.D(-f.n[0], -f.n[1], f.n[2]), t = tints[f.metal] || tints.body;
    if (pts.length === 3) K.tri(pts[0], pts[1], pts[2], t, { dir: n });
    else K.quad(pts, t, { dir: n });
  }
}

// ── Statue of Liberty ────────────────────────────────────────────────────────────────────────
// Liberty Island as built up from the water: the eleven-point star of Fort Wood's granite walls,
// the stepped concrete foundation inside it, Hunt's granite pedestal (a battered base course; a die
// with corner piers; the loggia on every face, its dark opening screened by paired columns over a
// balustrade; the frieze of discs; the cornice and the parapet), and Bartholdi's verdigris copper
// figure with the torch raised in her right hand and the tablet in her left.
const LIBERTY = {
  fort: '#a7a295', fortTop: '#b8b3a6', found: '#bdb8ac', granite: '#c4bba9', loggia: '#3a3833',
  copper: '#6e9f8d', gilt: '#c3a453',
};

function statueOfLiberty(b, { L, camHint }) {
  const faces = [], K = makeKit({ faces, L, camHint }), F = frameOf(b, true), SH = Math.min(b.w, b.d), H = SH * 3 * 0.985;
  const pal = { ...LIBERTY, ...(b.landmarkPalette || {}) };
  // Fort Wood: an eleven-point star, a point to the back so the sally port notch faces front
  const R1 = SH * 0.49, R2 = SH * 0.35, zF = 0.035 * H;
  const star = Array.from({ length: 22 }, (_, i) => { const a = Math.PI / 2 + (i / 22) * TAU, r = i % 2 ? R2 : R1; return [Math.cos(a) * r, Math.sin(a) * r]; });
  const starTop = star.map(([s, t]) => [s * 0.96, t * 0.96]);
  for (let i = 0; i < 22; i++) {
    const j = (i + 1) % 22;
    K.quad([F.P(star[i][0], star[i][1], 0), F.P(star[j][0], star[j][1], 0), F.P(starTop[j][0], starTop[j][1], zF), F.P(starTop[i][0], starTop[i][1], zF)], pal.fort, F.P(0, 0, zF / 2));
  }
  K.poly(starTop.map(([s, t]) => F.P(s, t, zF)), pal.fortTop, { dir: [0, 0, 1] });
  // the stepped foundation
  const STEPS = [[0.27, zF, 0.08 * H], [0.25, 0.08 * H, 0.13 * H], [0.23, 0.13 * H, 0.19 * H]];
  for (const [hw, z0, z1] of STEPS) lbox(K, F, -hw * SH, -hw * SH, hw * SH, hw * SH, z0, z1, { side: pal.found, top: scaleHex(pal.found, 1.05) });
  // the pedestal
  const zB0 = 0.19 * H, zB1 = 0.225 * H, zD1 = 0.37 * H, zL1 = 0.43 * H, zFr = 0.46 * H, zC = 0.475 * H, zP = 0.5 * H;
  const hb0 = 0.215 * SH, hb1 = 0.195 * SH, hd = 0.18 * SH, hc = 0.205 * SH, hp = 0.172 * SH;
  // battered base course
  const bq = (h, z) => [F.P(-h, -h, z), F.P(h, -h, z), F.P(h, h, z), F.P(-h, h, z)];
  const q0 = bq(hb0, zB0), q1 = bq(hb1, zB1);
  for (let e = 0; e < 4; e++) K.quad([q0[e], q0[(e + 1) % 4], q1[(e + 1) % 4], q1[e]], pal.granite, F.P(0, 0, zB0));
  K.quad(bq(hb1, zB1), scaleHex(pal.granite, 1.04), { dir: [0, 0, 1] });
  lbox(K, F, -hd, -hd, hd, hd, zB1, zFr, { side: pal.granite, top: null });
  const walls = [
    K.wall(F.P(-hd, -hd, zB1), F.D(1, 0, 0), [0, 0, 1], F.D(0, -1, 0)),
    K.wall(F.P(hd, -hd, zB1), F.D(0, 1, 0), [0, 0, 1], F.D(1, 0, 0)),
    K.wall(F.P(hd, hd, zB1), F.D(-1, 0, 0), [0, 0, 1], F.D(0, 1, 0)),
    K.wall(F.P(-hd, hd, zB1), F.D(0, -1, 0), [0, 0, 1], F.D(-1, 0, 0)),
  ];
  const w = 2 * hd, pd = SH * 0.012;
  for (const W of walls) {
    // corner piers the full height of the die, a quiet central panel below the loggia
    W.proud(0, 0, w * 0.17, zD1 - zB1, pd, pal.granite);
    W.proud(w * 0.83, 0, w, zD1 - zB1, pd, pal.granite);
    W.proud(w * 0.3, (zD1 - zB1) * 0.18, w * 0.7, (zD1 - zB1) * 0.86, pd * 0.35, scaleHex(pal.granite, 0.97));
    W.proud(0, zD1 - zB1 - SH * 0.012, w, zD1 - zB1, pd * 1.4, pal.granite);                       // the loggia's sill course
    // the loggia: a dark opening screened by two pairs of columns over a balustrade
    W.recess(w * 0.14, zD1 - zB1 + SH * 0.004, w * 0.86, zL1 - zB1, SH * 0.012, pal.loggia, null);
    for (const cxf of [0.2, 0.3, 0.7, 0.8]) W.proud(w * cxf - SH * 0.01, zD1 - zB1, w * cxf + SH * 0.01, zL1 - zB1, pd * 0.8, pal.granite);
    W.proud(w * 0.34, zD1 - zB1, w * 0.66, zD1 - zB1 + (zL1 - zD1) * 0.3, pd * 0.4, scaleHex(pal.granite, 0.95));
    // the frieze of discs
    for (let k = 0; k < 6; k++) { const c = w * (0.14 + (0.72 * (k + 0.5)) / 6); W.proud(c - SH * 0.011, zL1 - zB1 + SH * 0.012, c + SH * 0.011, zFr - zB1 - SH * 0.008, pd * 0.5, scaleHex(pal.granite, 1.06)); }
  }
  lbox(K, F, -hc, -hc, hc, hc, zFr, zC, { side: scaleHex(pal.granite, 1.02), top: scaleHex(pal.granite, 1.06), bottom: scaleHex(pal.granite, 0.8) });
  lbox(K, F, -hp, -hp, hp, hp, zC, zP, { side: pal.granite, top: scaleHex(pal.granite, 1.05) });
  // the figure: verdigris copper, torch and flame gilt
  const fig = decimatedFigure('liberty', 34);
  placeFigure(K, F, fig, [0, 0, zP], H - zP, { body: pal.copper, gilt: pal.gilt });
  return faces;
}


// ── Rizal Monument ───────────────────────────────────────────────────────────────────────────
// Kissling's monument at the Luneta: three granite steps up to the base, whose front carries the
// bronze plaque; the bronze Rizal in his overcoat, book in hand, standing forward on it; behind him
// the allegorical group (the Motherland seated, a child at either side) against the obelisk's
// block; and the tall granite obelisk rising behind them all to a sharp pyramidion.
const RIZAL = { granite: '#b1aca2', step: '#a39e93', bronze: '#6f5b3c', bronzeHi: '#8a7550' };

function rizalMonument(b, { L, camHint }) {
  const faces = [], K = makeKit({ faces, L, camHint }), F = frameOf(b, true), SH = Math.min(b.w, b.d), H = SH * 0.99;
  const pal = { ...RIZAL, ...(b.landmarkPalette || {}) };
  // the steps
  for (let k = 0; k < 3; k++) {
    const hs = F.A * 0.98 - k * SH * 0.055, ht = F.B * 0.98 - k * SH * 0.055;
    lbox(K, F, -hs, -ht, hs, ht, k * 0.028 * H, (k + 1) * 0.028 * H, { side: scaleHex(pal.step, 0.96), top: pal.step });
  }
  const zS = 0.084 * H;
  // the base with its plinth, cornice and the plaque
  const bs = 0.27 * SH, bt0 = -0.31 * SH, bt1 = 0.27 * SH, zB = 0.23 * H;
  lbox(K, F, -bs - SH * 0.012, bt0 - SH * 0.012, bs + SH * 0.012, bt1 + SH * 0.012, zS, zS + 0.025 * H, pal.granite);
  lbox(K, F, -bs, bt0, bs, bt1, zS + 0.025 * H, zB - 0.02 * H, { side: pal.granite, top: null });
  lbox(K, F, -bs - SH * 0.014, bt0 - SH * 0.014, bs + SH * 0.014, bt1 + SH * 0.014, zB - 0.02 * H, zB, { side: scaleHex(pal.granite, 1.03), top: scaleHex(pal.granite, 1.06), bottom: scaleHex(pal.granite, 0.8) });
  const front = K.wall(F.P(-bs, bt0, zS + 0.025 * H), F.D(1, 0, 0), [0, 0, 1], F.D(0, -1, 0)), fh = zB - 0.02 * H - zS - 0.025 * H;
  front.proud(bs * 0.55, fh * 0.22, bs * 1.45, fh * 0.8, SH * 0.006, pal.bronze, scaleHex(pal.bronze, 0.8));
  front.proud(bs * 0.62, fh * 0.3, bs * 1.38, fh * 0.72, SH * 0.004, pal.bronzeHi);
  for (const [s0, s1] of [[bs * 0.08, bs * 0.3], [bs * 1.7, bs * 1.92]]) front.proud(s0, 0, s1, fh, SH * 0.008, pal.granite);
  // the obelisk's block, set back, with its own cornice
  const ks = 0.13 * SH, kt0 = -0.06 * SH, kt1 = 0.2 * SH, zK = 0.35 * H;
  lbox(K, F, -ks, kt0, ks, kt1, zB, zK - 0.018 * H, { side: pal.granite, top: null });
  lbox(K, F, -ks - SH * 0.01, kt0 - SH * 0.01, ks + SH * 0.01, kt1 + SH * 0.01, zK - 0.018 * H, zK, { side: scaleHex(pal.granite, 1.03), top: scaleHex(pal.granite, 1.06), bottom: scaleHex(pal.granite, 0.8) });
  // the obelisk: a battered square shaft to a sharp pyramidion
  const oc = 0.07 * SH, h0 = 0.064 * SH, h1 = 0.042 * SH, zT = 0.925 * H, tip = H;
  const sq = (h, z) => [F.P(-h, oc - h, z), F.P(h, oc - h, z), F.P(h, oc + h, z), F.P(-h, oc + h, z)];
  lbox(K, F, -h0 * 1.25, oc - h0 * 1.25, h0 * 1.25, oc + h0 * 1.25, zK, zK + 0.03 * H, pal.granite);
  const s0 = sq(h0, zK + 0.03 * H), s1 = sq(h1, zT), apex = F.P(0, oc, tip), inO = F.P(0, oc, (zK + zT) / 2);
  for (let e = 0; e < 4; e++) {
    K.quad([s0[e], s0[(e + 1) % 4], s1[(e + 1) % 4], s1[e]], pal.granite, inO);
    K.tri(s1[e], s1[(e + 1) % 4], apex, scaleHex(pal.granite, 1.03), F.P(0, oc, zT));
  }
  // a bronze wreath band high on the shaft's front
  const ob = K.wall(sq(h1 * 1.0, zT - 0.16 * H)[0], F.D(1, 0, 0), [0, 0, 1], F.D(0, -1, 0));
  ob.proud(h1 * 0.45, 0, h1 * 1.55, 0.07 * H, SH * 0.005, pal.bronze);
  // the allegorical group behind Rizal: the seated Motherland, a child at either side
  const gt = -0.105 * SH, zG = zB;
  lbox(K, F, -0.12 * SH, gt - 0.035 * SH, 0.12 * SH, kt0, zG, zG + 0.035 * H, { side: pal.bronze, top: scaleHex(pal.bronze, 1.1) });
  const L3 = (s, t, z) => F.P(s, t, z);
  K.lathe(...L3(0, gt, 0).slice(0, 2), [[0.05 * SH, zG + 0.035 * H], [0.058 * SH, zG + 0.08 * H], [0.038 * SH, zG + 0.12 * H], [0.03 * SH, zG + 0.16 * H], [0.024 * SH, zG + 0.175 * H]].map(([r, z]) => [r, z + b.z0]), 8, pal.bronze, { capTop: scaleHex(pal.bronze, 1.1) });
  K.lathe(...L3(0, gt - 0.004 * SH, 0).slice(0, 2), [[0.001, zG + 0.172 * H], [0.017 * SH, zG + 0.18 * H], [0.019 * SH, zG + 0.195 * H], [0.001, zG + 0.212 * H]].map(([r, z]) => [r, z + b.z0]), 8, pal.bronzeHi);
  for (const sg of [-1, 1]) {
    const cs = sg * 0.085 * SH;
    K.lathe(...L3(cs, gt - 0.01 * SH, 0).slice(0, 2), [[0.024 * SH, zG + 0.035 * H], [0.02 * SH, zG + 0.09 * H], [0.014 * SH, zG + 0.115 * H]].map(([r, z]) => [r, z + b.z0]), 7, pal.bronze, { capTop: pal.bronze });
    K.lathe(...L3(cs, gt - 0.01 * SH, 0).slice(0, 2), [[0.001, zG + 0.113 * H], [0.013 * SH, zG + 0.12 * H], [0.014 * SH, zG + 0.13 * H], [0.001, zG + 0.143 * H]].map(([r, z]) => [r, z + b.z0]), 7, pal.bronzeHi);
    tube(K, [L3(sg * 0.03 * SH, gt, zG + 0.15 * H), L3(sg * 0.06 * SH, gt - 0.012 * SH, zG + 0.13 * H), L3(cs, gt - 0.012 * SH, zG + 0.11 * H)], 0.009 * SH, 5, pal.bronze);
  }
  // Rizal, forward on the base on a low plinth, facing out
  const rt = -0.21 * SH, zR = zB + 0.018 * H;
  lbox(K, F, -0.06 * SH, rt - 0.05 * SH, 0.06 * SH, rt + 0.05 * SH, zB, zR, { side: pal.granite, top: scaleHex(pal.granite, 1.05) });
  placeFigure(K, F, decimatedFigure('rizal', 22), [0, rt, zR], 0.27 * H, { body: pal.bronze, gilt: pal.bronzeHi });
  return faces;
}

export const VENUES = {
  'rogers-centre': rogersCentre,
  colosseum,
  arena: arenaVenue,
  'cloud-gate': cloudGate,
  'gateway-arch': gatewayArch,
  'mobile-edm-hall': mobileEdmHall,
  'statue-of-liberty': statueOfLiberty,
  'rizal-monument': rizalMonument,
};
