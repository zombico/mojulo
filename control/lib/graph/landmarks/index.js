import { litFactor, scaleHex, hexToRgb } from '../polygonizer/vexar.js';
import { buildStatueFigure, buildRizalFigure } from './statue-figure.js';

// vgl seam colour = the darkest swatch already in the palette (no hand-picked ink).
function darkestHex(palette) {
  let best = '#000000', bestL = Infinity;
  for (const v of Object.values(palette || {})) {
    if (typeof v !== 'string' || v[0] !== '#') continue;
    const [r, g, b] = hexToRgb(v);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum < bestL) { bestL = lum; best = v; }
  }
  return best;
}

// Concave-edge ("vgl") seam detector for a set of axis-aligned boxes (+ implicit solid
// ground below `groundZ`) — the same rule proven on the double-box L spike, generalised.
// For every box edge, sample the 4 cells in the plane perpendicular to the edge; exactly
// THREE solid = a concave valley. Ink ONE hairline strip, on the NEIGHBOUR box's face (the
// surface the shadow falls on) — not an L of two strips, which reads as a doubled line.
// Where two boxes genuinely share an edge they each ink the other's face → a clean
// perpendicular corner. Convex edges (1 solid) and interior edges (4) draw nothing, so the
// outer silhouette and top rims stay clean: internal shadow, never an outline.
function inkConcaveSeams(boxes, { push, width, liftZ, liftXY, probe, groundZ = -Infinity }) {
  const E = 1e-6;
  const solid = (x, y, z) => {
    if (z < groundZ - E) return true;
    for (const b of boxes) if (x > b.x + E && x < b.x + b.w - E && y > b.y + E && y < b.y + b.d - E && z > b.z0 + E && z < b.z1 - E) return true;
    return false;
  };
  const pt = (a, t, pa, pv, qa, qv) => { const v = [0, 0, 0]; v[a] = t; v[pa] = pv; v[qa] = qv; return v; };
  for (const b of boxes) {
    const X = [b.x, b.x + b.w], Y = [b.y, b.y + b.d], Z = [b.z0, b.z1];
    const ctr = [(X[0] + X[1]) / 2, (Y[0] + Y[1]) / 2, (Z[0] + Z[1]) / 2];
    const edgeSets = [
      { a: 0, lo: X[0], hi: X[1], pa: 1, qa: 2, corners: [[Y[0], Z[0]], [Y[1], Z[0]], [Y[0], Z[1]], [Y[1], Z[1]]] },
      { a: 1, lo: Y[0], hi: Y[1], pa: 0, qa: 2, corners: [[X[0], Z[0]], [X[1], Z[0]], [X[0], Z[1]], [X[1], Z[1]]] },
      { a: 2, lo: Z[0], hi: Z[1], pa: 0, qa: 1, corners: [[X[0], Y[0]], [X[1], Y[0]], [X[0], Y[1]], [X[1], Y[1]]] },
    ];
    for (const es of edgeSets) {
      const len = es.hi - es.lo;
      if (len <= E) continue;
      const N = Math.max(3, Math.ceil(len / (width * 2)));
      const step = len / N;
      for (const [pe, qe] of es.corners) {
        let span = null;
        const flush = () => {
          if (span && span.t1 - span.t0 > width * 1.5) {
            const { sp, sq, t0, t1 } = span;
            const strip = (fa, fv, sa, from, to) =>
              push([pt(es.a, t0, fa, fv, sa, from), pt(es.a, t1, fa, fv, sa, from),
                pt(es.a, t1, fa, fv, sa, to), pt(es.a, t0, fa, fv, sa, to)]);
            if (es.a === 2) {
              // VERTICAL collision (two side-walls meet) → the L-plan inner-corner line: an
              // L-section on both vertical faces, reading as one clean line up the shared height.
              strip(es.pa, pe + sp * liftXY, es.qa, qe, qe + sq * width);
              strip(es.qa, qe + sq * liftXY, es.pa, pe, pe + sp * width);
            } else {
              // HORIZONTAL collision → ONE strip on the neighbour's face. Hug ledges (tiny liftZ
              // when lifting vertically); clear walls (liftXY when lifting sideways).
              const onQaFace = (ctr[es.pa] > pe ? 1 : -1) === -sp && (ctr[es.qa] > qe ? 1 : -1) === sq;
              if (onQaFace) strip(es.qa, qe + sq * (es.qa === 2 ? liftZ : liftXY), es.pa, pe, pe + sp * width);
              else strip(es.pa, pe + sp * (es.pa === 2 ? liftZ : liftXY), es.qa, qe, qe + sq * width);
            }
          }
          span = null;
        };
        for (let i = 0; i < N; i++) {
          const t = es.lo + (i + 0.5) * step;
          const cells = [];
          for (const sp of [1, -1]) for (const sq of [1, -1]) {
            const P = pt(es.a, t, es.pa, pe + sp * probe, es.qa, qe + sq * probe);
            cells.push([sp, sq, solid(P[0], P[1], P[2])]);
          }
          if (cells.filter((c) => c[2]).length === 3) {
            const em = cells.find((c) => !c[2]);
            if (!span || span.sp !== em[0] || span.sq !== em[1]) { flush(); span = { sp: em[0], sq: em[1], t0: es.lo + i * step, t1: es.lo + (i + 1) * step }; }
            else span.t1 = es.lo + (i + 1) * step;
          } else flush();
        }
        flush();
      }
    }
  }
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]) || 1;
const norm = (a) => { const l = len(a); return [a[0] / l, a[1] / l, a[2] / l]; };
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const centroid = (pts) => scale(pts.reduce((acc, p) => add(acc, p), [0, 0, 0]), 1 / pts.length);

function normalToward(corners, towardPt) {
  let n = norm(cross(sub(corners[1], corners[0]), sub(corners[2], corners[0])));
  if (towardPt && dot(n, sub(towardPt, centroid(corners))) < 0) n = scale(n, -1);
  return n;
}

function makeFaceKit({ faces, L, camHint }) {
  const lit = (corners, tint) => faces.push({ corners, fill: scaleHex(tint, litFactor(normalToward(corners, camHint), L)), doubleSided: true });
  const tri = (A, B, T, tint) => {
    const Uw = sub(B, A), ub = norm(Uw), Vw = sub(sub(T, A), scale(ub, dot(sub(T, A), ub)));
    if (len(Vw) < 1e-4) return;
    faces.push({
      corners: [A, B, add(B, Vw), add(A, Vw)],
      fill: scaleHex(tint, litFactor(normalToward([A, B, T], camHint), L)),
      doubleSided: true,
      clip: `polygon(0% 0%, 100% 0%, ${(dot(sub(T, A), ub) / len(Uw) * 100).toFixed(1)}% 100%)`,
    });
  };
  return { lit, tri };
}

const TAJ_PALETTE = { plinth: '#d8d1c0', wall: '#ece8dd', roof: '#d8d2c4', dome: '#e9e4d7', drum: '#e1dccd', frame: '#e4dfd1', recess: '#5b5346', trim: '#caa63f', minaret: '#e6e1d4' };

function tajMahalBuilding(b, { L, camHint, cityBox }) {
  const pal = { ...TAJ_PALETTE, ...(b.churchPalette || {}) };
  const faces = [];
  const { lit, tri } = makeFaceKit({ faces, L, camHint });
  const cx = b.x + b.w / 2, cy = b.y + b.d / 2, side = Math.min(b.w, b.d), z0 = b.z0, Nr = 16;
  const ring = (r, z, ox, oy) => Array.from({ length: Nr }, (_, i) => { const a = (i / Nr) * 2 * Math.PI; return [ox + Math.cos(a) * r, oy + Math.sin(a) * r, z]; });
  const band = (lo, hi, tint) => { for (let i = 0; i < Nr; i++) { const j = (i + 1) % Nr; lit([lo[i], lo[j], hi[j], hi[i]], tint); } };
  const drum = (ox, oy, r, zl, zh, tint) => band(ring(r, zl, ox, oy), ring(r, zh, ox, oy), tint);
  const ONION = [[0, 0.86], [0.12, 1.0], [0.28, 1.08], [0.46, 1.02], [0.62, 0.82], [0.76, 0.56], [0.88, 0.3], [1.0, 0.0]];
  const onion = (ox, oy, baseR, baseZ, h, tint) => {
    let prev = null;
    for (const [hf, rf] of ONION) {
      const z = baseZ + hf * h, r = baseR * rf, pts = r < 1e-3 ? null : ring(r, z, ox, oy);
      if (prev) { if (pts) band(prev, pts, tint); else { const ap = [ox, oy, z]; for (let i = 0; i < Nr; i++) tri(prev[i], prev[(i + 1) % Nr], ap, tint); } }
      if (pts) prev = pts;
    }
  };
  const finial = (ox, oy, zb, h, tint) => {
    const post = Math.max(0.04, h * 0.07);
    faces.push(...cityBox({ x: ox - post / 2, y: oy - post / 2, w: post, d: post }, zb, zb + h * 0.6, { top: scaleHex(tint, 1.1), side: tint }, L, camHint));
    drum(ox, oy, h * 0.12, zb + h * 0.48, zb + h * 0.58, tint);
    onion(ox, oy, h * 0.1, zb + h * 0.58, h * 0.42, tint);
  };

  const eps = 0.04;
  const plinthTop = z0 + side * 0.05;
  faces.push(...cityBox({ x: b.x, y: b.y, w: b.w, d: b.d }, z0, plinthTop, { top: scaleHex(pal.plinth, 1.06), side: pal.plinth }, L, camHint));

  const bh = side * 0.30, ch = bh * 0.42, bodyTop = plinthTop + side * 0.26;
  const oct = [
    [cx + bh, cy - (bh - ch)], [cx + bh, cy + (bh - ch)],
    [cx + (bh - ch), cy + bh], [cx - (bh - ch), cy + bh],
    [cx - bh, cy + (bh - ch)], [cx - bh, cy - (bh - ch)],
    [cx - (bh - ch), cy - bh], [cx + (bh - ch), cy - bh],
  ];
  for (let i = 0; i < 8; i++) {
    const p = oct[i], q = oct[(i + 1) % 8];
    lit([[p[0], p[1], plinthTop], [q[0], q[1], plinthTop], [q[0], q[1], bodyTop], [p[0], p[1], bodyTop]], pal.wall);
    tri([p[0], p[1], bodyTop], [q[0], q[1], bodyTop], [cx, cy, bodyTop], pal.roof);
  }

  const recessArch = (p, q, zlo, zhi, frac, tint) => {
    const ex = q[0] - p[0], ey = q[1] - p[1], el = Math.hypot(ex, ey) || 1, ux = ex / el, uy = ey / el;
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    let nx = -uy, ny = ux; if ((mx - cx) * nx + (my - cy) * ny < 0) { nx = -nx; ny = -ny; }
    const hw = el * frac, ox = mx + nx * eps, oy = my + ny * eps;
    const A = [ox + ux * hw, oy + uy * hw, zlo], B = [ox - ux * hw, oy - uy * hw, zlo];
    const cs = [A, B, [B[0], B[1], zhi], [A[0], A[1], zhi]];
    faces.push({ corners: cs, fill: scaleHex(tint, litFactor(normalToward(cs, camHint), L)), doubleSided: true, radius: '0 0 46% 46% / 0 0 60% 60%' });
  };

  const proud = side * 0.03, frameTop = bodyTop + side * 0.06, pishW = (bh - ch) * 1.7;
  for (const [nx, ny] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
    const fcx = cx + nx * bh, fcy = cy + ny * bh, tx = -ny, ty = nx;
    const px = fcx + nx * proud, py = fcy + ny * proud;
    const A = [px + tx * pishW / 2, py + ty * pishW / 2, plinthTop], B = [px - tx * pishW / 2, py - ty * pishW / 2, plinthTop];
    lit([A, B, [B[0], B[1], frameTop], [A[0], A[1], frameTop]], pal.frame);
    const rx = fcx + nx * (proud + eps), ry = fcy + ny * (proud + eps), rw = pishW * 0.66, rTop = bodyTop + (frameTop - bodyTop) * 0.2;
    const ra = [rx + tx * rw / 2, ry + ty * rw / 2, plinthTop + eps], rb = [rx - tx * rw / 2, ry - ty * rw / 2, plinthTop + eps];
    const cs = [ra, rb, [rb[0], rb[1], rTop], [ra[0], ra[1], rTop]];
    faces.push({ corners: cs, fill: scaleHex(pal.recess, litFactor(normalToward(cs, camHint), L)), doubleSided: true, radius: '0 0 44% 44% / 0 0 56% 56%' });
  }

  const hh = bodyTop - plinthTop;
  for (const [ia, ib] of [[1, 2], [3, 4], [5, 6], [7, 0]]) {
    const p = oct[ia], q = oct[ib];
    recessArch(p, q, plinthTop + hh * 0.08, plinthTop + hh * 0.46, 0.3, pal.recess);
    recessArch(p, q, plinthTop + hh * 0.52, plinthTop + hh * 0.9, 0.3, pal.recess);
  }

  const rC = bh * 0.52, drumTop = bodyTop + side * 0.14, domeH = rC * 1.95;
  drum(cx, cy, rC, bodyTop, drumTop, pal.drum);
  onion(cx, cy, rC * 1.05, drumTop, domeH, pal.dome);
  finial(cx, cy, drumTop + domeH, side * 0.13, pal.trim);

  const chOff = (bh - ch / 2) * 0.92, rCh = side * 0.05, chTop = bodyTop + side * 0.08, chH = side * 0.16;
  for (const [sx, sy] of [[cx - chOff, cy - chOff], [cx + chOff, cy - chOff], [cx - chOff, cy + chOff], [cx + chOff, cy + chOff]]) {
    drum(sx, sy, rCh, bodyTop, chTop, pal.drum);
    onion(sx, sy, rCh * 1.1, chTop, chH, pal.dome);
    finial(sx, sy, chTop + chH, side * 0.09, pal.trim);
  }

  const mInset = side * 0.05, rM = side * 0.045, mTop = plinthTop + side * 0.36, capH = side * 0.09;
  for (const [mx, my] of [[b.x + mInset, b.y + mInset], [b.x + b.w - mInset, b.y + mInset], [b.x + mInset, b.y + b.d - mInset], [b.x + b.w - mInset, b.y + b.d - mInset]]) {
    drum(mx, my, rM, plinthTop, mTop, pal.minaret);
    for (const t of [0.4, 0.64, 0.85]) { const bz = plinthTop + (mTop - plinthTop) * t; drum(mx, my, rM * 1.5, bz, bz + side * 0.025, pal.trim); }
    drum(mx, my, rM * 1.3, mTop, mTop + side * 0.035, pal.minaret);
    onion(mx, my, rM * 1.25, mTop + side * 0.035, capH, pal.dome);
    finial(mx, my, mTop + side * 0.035 + capH, side * 0.09, pal.trim);
  }
  return faces;
}

const CN_TOWER_PALETTE = {
  concrete: '#c8cdd0', shadow: '#9aa3a8', glass: '#355468', darkGlass: '#1d3443',
  deck: '#d8d2c6', trim: '#aeb7bb', base: '#b9b4a6', antenna: '#d6dadb', red: '#b93630',
};

function cnTowerBuilding(b, { L, camHint }) {
  const pal = { ...CN_TOWER_PALETTE, ...(b.churchPalette || b.landmarkPalette || {}) };
  const faces = [];
  const { lit, tri } = makeFaceKit({ faces, L, camHint });
  const cx = b.x + b.w / 2, cy = b.y + b.d / 2, side = Math.min(b.w, b.d), z0 = b.z0, Nr = 32;
  const ring = (r, z, ox = cx, oy = cy) => Array.from({ length: Nr }, (_, i) => {
    const a = (i / Nr) * 2 * Math.PI;
    return [ox + Math.cos(a) * r, oy + Math.sin(a) * r, z];
  });
  const band = (lo, hi, tint) => {
    for (let i = 0; i < Nr; i++) { const j = (i + 1) % Nr; lit([lo[i], lo[j], hi[j], hi[i]], tint); }
  };
  const taper = (r0, zlo, r1, zhi, tint) => band(ring(r0, zlo), ring(r1, zhi), tint);
  const rib = (angle, r0, zlo, r1, zhi, width, tint) => {
    const ux = Math.cos(angle), uy = Math.sin(angle), tx = -uy, ty = ux;
    const A = [cx + ux * r0 + tx * width, cy + uy * r0 + ty * width, zlo];
    const B = [cx + ux * r0 - tx * width, cy + uy * r0 - ty * width, zlo];
    const C = [cx + ux * r1 - tx * width * 0.75, cy + uy * r1 - ty * width * 0.75, zhi];
    const D = [cx + ux * r1 + tx * width * 0.75, cy + uy * r1 + ty * width * 0.75, zhi];
    lit([A, B, C, D], tint);
  };
  const radialRib = (angle, rInner, zInner, rOuter, zOuter, width, tint) => {
    const ux = Math.cos(angle), uy = Math.sin(angle), tx = -uy, ty = ux;
    const A = [cx + ux * rInner + tx * width, cy + uy * rInner + ty * width, zInner];
    const B = [cx + ux * rOuter + tx * width * 1.2, cy + uy * rOuter + ty * width * 1.2, zOuter];
    const C = [cx + ux * rOuter - tx * width * 1.2, cy + uy * rOuter - ty * width * 1.2, zOuter];
    const D = [cx + ux * rInner - tx * width, cy + uy * rInner - ty * width, zInner];
    lit([A, B, C, D], tint);
  };

  const meru = {
    baseTop: z0 + side * 0.06,
    legTop: z0 + side * 0.88,
    shaftTop: z0 + side * 2.9,
    podSoffit: z0 + side * 2.04,
    podBelly: z0 + side * 2.075,
    podSkirt: z0 + side * 2.115,
    lowerGlass: z0 + side * 2.18,
    midBelt: z0 + side * 2.245,
    railDeck: z0 + side * 2.305,
    redBand: z0 + side * 2.355,
    crownTop: z0 + side * 2.455,
    skyPodBottom: z0 + side * 2.56,
    skyPodTop: z0 + side * 2.68,
    mastTop: z0 + side * 3.72,
  };
  const mandala = {
    shaftBase: side * 0.092,
    shaftNeck: side * 0.052,
    bucketCore: side * 0.09,
    belly: side * 0.23,
    glass: side * 0.215,
    rail: side * 0.245,
    crown: side * 0.195,
  };

  // ── base: hexagonal core + three splayed tripod legs (the CN Tower Y-plan) ──────────
  // The tower's defining feature, from the real floor plan: a HEXAGONAL core foundation with
  // three SOLID buttress legs at 120°, each splaying from a wide foot on the ground up and
  // inward into the shaft. Built as filled wedges (soffit + outer splay + inner + two sides),
  // not flat fins, so the base reads as the massive concrete tripod it is.
  const hexRing = (r, z) => Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * 2 * Math.PI; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, z]; });
  const hexBand = (lo, hi, tint) => { for (let i = 0; i < 6; i++) { const j = (i + 1) % 6; lit([lo[i], lo[j], hi[j], hi[i]], tint); } };
  const hexCap = (r, z, tint) => { const p = hexRing(r, z); for (let i = 0; i < 6; i++) tri(p[i], p[(i + 1) % 6], [cx, cy, z], tint); };

  // hexagonal foundation pad + the core body rising through the legs into the shaft
  const padTop = z0 + side * 0.05;
  hexBand(hexRing(side * 0.19, z0), hexRing(side * 0.18, padTop), scaleHex(pal.base, 0.95));
  hexCap(side * 0.18, padTop, scaleHex(pal.base, 1.04));
  hexBand(hexRing(side * 0.15, padTop), hexRing(side * 0.10, meru.legTop), pal.concrete);
  hexCap(side * 0.10, meru.legTop, scaleHex(pal.concrete, 1.03));

  // three solid buttress legs — each a tapering wedge tucked into the core at the top
  const legAngles = [-Math.PI / 2, Math.PI / 6, Math.PI * 5 / 6];
  const footR = side * 0.42, innerR = side * 0.15, shaftR = side * 0.10;
  const wFoot = side * 0.10, wTop = side * 0.052;
  for (const a of legAngles) {
    const ux = Math.cos(a), uy = Math.sin(a), tx = -uy, ty = ux;
    const tint = a < 0 ? pal.concrete : pal.shadow;
    const P = (r, w, z) => [cx + ux * r + tx * w, cy + uy * r + ty * w, z];
    const FoL = P(footR, wFoot, z0), FoR = P(footR, -wFoot, z0);
    const FiL = P(innerR, wFoot, z0), FiR = P(innerR, -wFoot, z0);
    const ToL = P(shaftR, wTop, meru.legTop), ToR = P(shaftR, -wTop, meru.legTop);
    lit([FoL, FoR, FiR, FiL], scaleHex(tint, 0.84));   // ground soffit
    lit([FoL, FoR, ToR, ToL], tint);                   // outer splay face (foot → shaft)
    lit([FiL, FiR, ToR, ToL], scaleHex(tint, 0.95));   // inner face toward the core
    tri(FoL, FiL, ToL, scaleHex(tint, 1.06));          // left tangential side
    tri(FoR, FiR, ToR, scaleHex(tint, 1.06));          // right tangential side
  }

  taper(mandala.shaftBase, meru.baseTop, mandala.shaftNeck, meru.podBelly, pal.concrete);
  taper(mandala.shaftNeck, meru.podBelly, side * 0.043, meru.shaftTop, pal.concrete);
  for (const a of legAngles) {
    rib(a, side * 0.104, meru.legTop, side * 0.065, meru.podBelly, side * 0.012, a < 0 ? pal.shadow : scaleHex(pal.concrete, 0.88));
  }

  taper(mandala.bucketCore, meru.podSoffit, mandala.belly * 0.9, meru.podBelly, scaleHex(pal.deck, 0.98));
  taper(mandala.belly * 0.9, meru.podBelly, mandala.belly, meru.podSkirt, pal.deck);
  taper(mandala.belly, meru.podSkirt, mandala.glass * 0.96, meru.lowerGlass, scaleHex(pal.darkGlass, 0.82));
  taper(mandala.glass * 0.96, meru.lowerGlass, mandala.glass, meru.midBelt, pal.darkGlass);
  taper(mandala.glass, meru.midBelt, mandala.glass * 0.97, meru.midBelt + side * 0.03, pal.trim);
  taper(mandala.glass * 0.97, meru.midBelt + side * 0.03, mandala.glass * 0.92, meru.railDeck, pal.darkGlass);
  taper(mandala.glass * 0.92, meru.railDeck, mandala.rail, meru.railDeck + side * 0.025, pal.trim);
  taper(mandala.rail, meru.railDeck + side * 0.025, mandala.rail * 0.98, meru.redBand, pal.red);
  taper(mandala.rail * 0.98, meru.redBand, mandala.crown, meru.crownTop, pal.deck);

  for (let i = 0; i < Nr; i += 1) {
    const a = (i / Nr) * 2 * Math.PI;
    radialRib(a, mandala.bucketCore * 1.05, meru.podSoffit + side * 0.02, mandala.belly * 0.95, meru.podSkirt, side * 0.007, scaleHex(pal.shadow, 0.74));
    rib(a, mandala.rail * 1.03, meru.railDeck + side * 0.015, mandala.rail * 1.06, meru.redBand + side * 0.02, side * 0.0045, pal.trim);
  }

  taper(side * 0.075, meru.skyPodBottom, side * 0.16, meru.skyPodBottom + side * 0.028, pal.trim);
  taper(side * 0.16, meru.skyPodBottom + side * 0.028, side * 0.155, meru.skyPodTop, pal.darkGlass);
  taper(side * 0.155, meru.skyPodTop, side * 0.07, meru.skyPodTop + side * 0.03, pal.trim);

  const antennaSegments = [
    [meru.shaftTop, z0 + side * 3.02, side * 0.036, side * 0.032, pal.antenna],
    [z0 + side * 3.02, z0 + side * 3.07, side * 0.032, side * 0.030, pal.red],
    [z0 + side * 3.07, z0 + side * 3.28, side * 0.030, side * 0.026, pal.antenna],
    [z0 + side * 3.28, z0 + side * 3.33, side * 0.026, side * 0.024, pal.red],
    [z0 + side * 3.33, z0 + side * 3.55, side * 0.024, side * 0.018, pal.antenna],
    [z0 + side * 3.55, z0 + side * 3.6, side * 0.018, side * 0.016, pal.red],
  ];
  for (const [zlo, zhi, r0, r1, tint] of antennaSegments) taper(r0, zlo, r1, zhi, tint);
  const tip = [cx, cy, meru.mastTop], topRing = ring(side * 0.016, z0 + side * 3.6);
  for (let i = 0; i < Nr; i++) tri(topRing[i], topRing[(i + 1) % Nr], tip, pal.antenna);

  return faces;
}

const SKYTREE_PALETTE = {
  lattice: '#dfe6e8', latticeShadow: '#9ba9ad', deck: '#cfd8da', glass: '#43606f',
  darkGlass: '#223946', trim: '#edf1f1', mast: '#d7e0e3', band: '#7e8e95',
};

function skytreeBuilding(b, { L, camHint }) {
  const pal = { ...SKYTREE_PALETTE, ...(b.landmarkPalette || {}) };
  const faces = [];
  const { lit, tri } = makeFaceKit({ faces, L, camHint });
  const cx = b.x + b.w / 2, cy = b.y + b.d / 2, side = Math.min(b.w, b.d), z0 = b.z0, Nr = 32;
  const ring = (r, z, ox = cx, oy = cy) => Array.from({ length: Nr }, (_, i) => {
    const a = (i / Nr) * 2 * Math.PI;
    return [ox + Math.cos(a) * r, oy + Math.sin(a) * r, z];
  });
  const band = (lo, hi, tint) => {
    for (let i = 0; i < Nr; i += 1) { const j = (i + 1) % Nr; lit([lo[i], lo[j], hi[j], hi[i]], tint); }
  };
  const taper = (r0, zlo, r1, zhi, tint) => band(ring(r0, zlo), ring(r1, zhi), tint);
  const cap = (r, z, tint) => {
    const pts = ring(r, z);
    for (let i = 0; i < Nr; i += 1) tri(pts[i], pts[(i + 1) % Nr], [cx, cy, z], tint);
  };
  const node = (angle, r, z) => [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, z];
  const radiusAt = (z) => {
    const t = Math.max(0, Math.min(1, (z - z0) / (side * 2.35)));
    return side * (0.43 + (0.17 - 0.43) * t);
  };
  const strut = (A, B, width, tint) => {
    let tx = -(B[1] - A[1]), ty = B[0] - A[0];
    const tl = Math.hypot(tx, ty) || 1;
    tx = tx / tl * width; ty = ty / tl * width;
    lit([[A[0] + tx, A[1] + ty, A[2]], [A[0] - tx, A[1] - ty, A[2]], [B[0] - tx, B[1] - ty, B[2]], [B[0] + tx, B[1] + ty, B[2]]], tint);
  };
  const rib = (angle, r0, zlo, r1, zhi, width, tint) => strut(node(angle, r0, zlo), node(angle, r1, zhi), width, tint);
  const brace = (angle, zlo, zhi, width, tint, dir = 1) => {
    const r0 = radiusAt(zlo), r1 = radiusAt(zhi);
    strut(node(angle, r0, zlo), node(angle + dir * Math.PI / 9, r1, zhi), width, tint);
  };
  const hoop = (r, z, h, tint) => taper(r, z, r * 0.99, z + h, tint);

  const meru = {
    baseTop: z0 + side * 0.08,
    waistTop: z0 + side * 2.28,
    deck1Lo: z0 + side * 2.35,
    deck1Belly: z0 + side * 2.49,
    deck1Top: z0 + side * 2.68,
    upperNeck: z0 + side * 3.16,
    deck2Lo: z0 + side * 3.24,
    deck2Top: z0 + side * 3.48,
    mastBase: z0 + side * 3.55,
    mastTop: z0 + side * 4.9,
  };

  taper(side * 0.47, z0, side * 0.43, meru.baseTop, scaleHex(pal.lattice, 0.88));
  cap(side * 0.47, z0, scaleHex(pal.latticeShadow, 0.86));

  taper(side * 0.12, meru.baseTop, side * 0.075, meru.deck1Lo, scaleHex(pal.latticeShadow, 0.8));
  const primaryAngles = Array.from({ length: 12 }, (_, i) => (i / 12) * 2 * Math.PI);
  for (const a of primaryAngles) {
    rib(a, side * 0.43, meru.baseTop, side * 0.18, meru.waistTop, side * 0.009, pal.lattice);
  }
  for (let i = 0; i <= 12; i += 1) {
    const z = meru.baseTop + (meru.waistTop - meru.baseTop) * (i / 12);
    hoop(radiusAt(z), z, side * 0.008, i % 3 === 0 ? pal.trim : pal.latticeShadow);
  }
  for (let tier = 0; tier < 13; tier += 1) {
    const zlo = meru.baseTop + (meru.waistTop - meru.baseTop) * (tier / 13);
    const zhi = meru.baseTop + (meru.waistTop - meru.baseTop) * ((tier + 1) / 13);
    for (let i = 0; i < primaryAngles.length; i += 1) {
      brace(primaryAngles[i], zlo, zhi, side * 0.0055, i % 2 === 0 ? pal.lattice : pal.latticeShadow, tier % 2 === 0 ? 1 : -1);
    }
  }

  taper(side * 0.18, meru.deck1Lo, side * 0.37, meru.deck1Belly, pal.deck);
  taper(side * 0.37, meru.deck1Belly, side * 0.35, meru.deck1Belly + side * 0.06, pal.darkGlass);
  taper(side * 0.35, meru.deck1Belly + side * 0.06, side * 0.31, meru.deck1Top, pal.glass);
  taper(side * 0.31, meru.deck1Top, side * 0.2, meru.deck1Top + side * 0.06, pal.trim);
  for (let i = 0; i < Nr; i += 1) {
    const a = (i / Nr) * 2 * Math.PI;
    rib(a, side * 0.33, meru.deck1Belly, side * 0.3, meru.deck1Top, side * 0.004, pal.trim);
  }

  taper(side * 0.15, meru.deck1Top + side * 0.06, side * 0.1, meru.upperNeck, scaleHex(pal.latticeShadow, 0.85));
  for (const a of primaryAngles) {
    rib(a, side * 0.18, meru.deck1Top, side * 0.11, meru.upperNeck, side * 0.006, pal.lattice);
  }
  for (let tier = 0; tier < 5; tier += 1) {
    const zlo = meru.deck1Top + side * 0.06 + (meru.upperNeck - meru.deck1Top - side * 0.06) * (tier / 5);
    const zhi = meru.deck1Top + side * 0.06 + (meru.upperNeck - meru.deck1Top - side * 0.06) * ((tier + 1) / 5);
    for (const a of primaryAngles) strut(node(a, side * 0.16, zlo), node(a + Math.PI / 8, side * 0.11, zhi), side * 0.004, pal.lattice);
  }

  taper(side * 0.1, meru.deck2Lo, side * 0.22, meru.deck2Lo + side * 0.07, pal.deck);
  taper(side * 0.22, meru.deck2Lo + side * 0.07, side * 0.2, meru.deck2Top - side * 0.04, pal.darkGlass);
  taper(side * 0.2, meru.deck2Top - side * 0.04, side * 0.12, meru.deck2Top, pal.trim);

  const mastSegments = [
    [meru.deck2Top, meru.mastBase, side * 0.075, side * 0.06, pal.mast],
    [meru.mastBase, z0 + side * 3.8, side * 0.06, side * 0.052, pal.mast],
    [z0 + side * 3.8, z0 + side * 4.04, side * 0.052, side * 0.045, pal.band],
    [z0 + side * 4.04, z0 + side * 4.26, side * 0.045, side * 0.038, pal.mast],
    [z0 + side * 4.26, z0 + side * 4.46, side * 0.038, side * 0.033, pal.band],
    [z0 + side * 4.46, z0 + side * 4.72, side * 0.033, side * 0.026, pal.mast],
  ];
  for (const [zlo, zhi, r0, r1, tint] of mastSegments) taper(r0, zlo, r1, zhi, tint);
  for (const z of [side * 3.68, side * 3.96, side * 4.18, side * 4.38, side * 4.62].map((v) => z0 + v)) {
    hoop(side * 0.09, z, side * 0.018, pal.trim);
  }
  const tip = [cx, cy, meru.mastTop], topRing = ring(side * 0.026, z0 + side * 4.72);
  for (let i = 0; i < Nr; i += 1) tri(topRing[i], topRing[(i + 1) % Nr], tip, pal.mast);

  return faces;
}

const ROGERS_CENTRE_PALETTE = {
  wall: '#c9c7bf', shadow: '#8d9295', glass: '#40515b', roof: '#d7d9d6',
  roofAlt: '#c3c8c8', seam: '#7d8588', field: '#496d52', deck: '#b9b6aa',
  seats: '#294a63', dirt: '#9b7651',
};

function rogersCentreBuilding(b, { L, camHint }) {
  const pal = { ...ROGERS_CENTRE_PALETTE, ...(b.landmarkPalette || {}) };
  const faces = [];
  const { lit, tri } = makeFaceKit({ faces, L, camHint });
  const cx = b.x + b.w / 2, cy = b.y + b.d / 2, z0 = b.z0, Nr = 40;
  const rx = b.w / 2, ry = b.d / 2;
  const oval = (sx, sy, z) => Array.from({ length: Nr }, (_, i) => {
    const a = (i / Nr) * 2 * Math.PI;
    return [cx + Math.cos(a) * rx * sx, cy + Math.sin(a) * ry * sy, z];
  });
  const band = (lo, hi, tint) => {
    for (let i = 0; i < Nr; i += 1) { const j = (i + 1) % Nr; lit([lo[i], lo[j], hi[j], hi[i]], tint); }
  };
  const capRing = (outer, inner, tint) => {
    for (let i = 0; i < Nr; i += 1) {
      const j = (i + 1) % Nr;
      lit([outer[i], outer[j], inner[j], inner[i]], tint);
    }
  };
  const capArc = (outer, inner, tint, keep) => {
    for (let i = 0; i < Nr; i += 1) {
      const a = ((i + 0.5) / Nr) * 2 * Math.PI;
      if (!keep(a)) continue;
      const j = (i + 1) % Nr;
      lit([outer[i], outer[j], inner[j], inner[i]], tint);
    }
  };
  const quad = (pts, tint) => lit(pts, tint);
  const spoke = (angle, r0, r1, z, width, tint) => {
    const ux = Math.cos(angle), uy = Math.sin(angle), tx = -uy, ty = ux;
    const A = [cx + ux * rx * r0 + tx * width, cy + uy * ry * r0 + ty * width, z];
    const B = [cx + ux * rx * r1 + tx * width * 1.2, cy + uy * ry * r1 + ty * width * 1.2, z + b.d * 0.02];
    const C = [cx + ux * rx * r1 - tx * width * 1.2, cy + uy * ry * r1 - ty * width * 1.2, z + b.d * 0.02];
    const D = [cx + ux * rx * r0 - tx * width, cy + uy * ry * r0 - ty * width, z];
    lit([A, B, C, D], tint);
  };

  const podiumTop = z0 + b.d * 0.08;
  const wallTop = z0 + b.d * 0.34;
  const glassTop = z0 + b.d * 0.45;
  const roofRim = z0 + b.d * 0.56;
  const roofCrown = z0 + b.d * 0.66;

  band(oval(1.02, 1.02, z0), oval(1.0, 1.0, podiumTop), pal.deck);
  band(oval(1.0, 1.0, podiumTop), oval(0.98, 0.98, wallTop), pal.wall);
  band(oval(0.98, 0.98, wallTop), oval(0.96, 0.96, glassTop), pal.glass);
  band(oval(0.96, 0.96, glassTop), oval(0.9, 0.9, roofRim), pal.roofAlt);

  // Interior bowl first, visible through the open front half.
  capRing(oval(0.78, 0.76, wallTop + b.d * 0.02), oval(0.6, 0.62, wallTop + b.d * 0.045), scaleHex(pal.seats, 0.78));
  capRing(oval(0.6, 0.62, wallTop + b.d * 0.046), oval(0.42, 0.46, wallTop + b.d * 0.07), pal.seats);
  capRing(oval(0.42, 0.46, wallTop + b.d * 0.071), oval(0.12, 0.18, wallTop + b.d * 0.09), pal.field);
  const fieldZ = wallTop + b.d * 0.095;
  quad([[cx - rx * 0.09, cy, fieldZ], [cx, cy - ry * 0.11, fieldZ], [cx + rx * 0.09, cy, fieldZ], [cx, cy + ry * 0.11, fieldZ]], pal.dirt);

  // Retractable roof in the open-game position: a single white canopy parked over
  // the back half, with the front half of the bowl exposed.
  const roofOuter = oval(0.9, 0.9, roofRim);
  const roofMid = oval(0.54, 0.62, roofCrown);
  const roofInner = oval(0.18, 0.28, roofCrown + b.d * 0.045);
  const rearCanopy = (a) => Math.sin(a) < 0.12;
  const openFront = (a) => Math.sin(a) > -0.05;
  capArc(roofOuter, roofMid, pal.roof, rearCanopy);
  capArc(roofMid, roofInner, pal.roofAlt, rearCanopy);
  capRing(oval(0.9, 0.9, roofRim + b.d * 0.01), oval(0.86, 0.86, roofRim + b.d * 0.025), pal.seam); // outer rim
  capArc(oval(0.86, 0.86, roofRim + b.d * 0.035), oval(0.8, 0.8, roofRim + b.d * 0.06), pal.seam, openFront);

  for (const t of [Math.PI * 0.1, Math.PI * 0.22, Math.PI * 0.36, Math.PI * 0.64, Math.PI * 0.78, Math.PI * 0.9]) {
    spoke(t, 0.46, 0.9, roofRim + b.d * 0.04, b.d * 0.008, pal.seam);
  }
  return faces;
}

// ── primitive: sports ARENA / COLISEUM ──────────────────────────────────────────────
// A generalized elliptical-bowl venue, distilled from the Rogers Centre landmark (oval
// rings + tiered seating cavea + a roof mode). Two variants today, driven off the same kit:
//   • 'colosseum' — Roman amphitheatre: stacked arcade tiers (light piers / dark arched
//        openings), an OPEN top exposing the tiered cavea sloping to a sand arena floor.
//   • 'arena'    — modern domed venue: low concrete/glass drum under a ribbed closed DOME.
// Both read at recognizable silhouette fidelity and, being landmark-eligible, inherit the
// reserved plaza budget — which a venue (open space all around) actually wants.
const ARENA_PALETTES = {
  colosseum: { base: '#b3a785', wall: '#d8caa6', arch: '#4d452f', cornice: '#c6b690', seats: '#a99e82', sand: '#c9a96d', hypogeum: '#6b5c43' },
  arena: { base: '#b4babe', wall: '#cdd3d7', glass: '#3f5a6b', roof: '#d6dadd', rib: '#a7b1b6', lantern: '#e7ecec' },
};

function arenaBuilding(b, { L, camHint }, variant) {
  const pal = { ...(ARENA_PALETTES[variant] || ARENA_PALETTES.arena), ...(b.landmarkPalette || {}) };
  const faces = [];
  const { lit, tri } = makeFaceKit({ faces, L, camHint });
  const cx = b.x + b.w / 2, cy = b.y + b.d / 2, z0 = b.z0, Nr = 48, axis = b.d;
  const rx = b.w / 2, ry = b.d / 2;
  const oval = (s, z) => Array.from({ length: Nr }, (_, i) => { const a = (i / Nr) * 2 * Math.PI; return [cx + Math.cos(a) * rx * s, cy + Math.sin(a) * ry * s, z]; });
  const band = (lo, hi, tint) => { for (let i = 0; i < Nr; i += 1) { const j = (i + 1) % Nr; lit([lo[i], lo[j], hi[j], hi[i]], tint); } };
  const capRing = (outer, inner, tint) => { for (let i = 0; i < Nr; i += 1) { const j = (i + 1) % Nr; lit([outer[i], outer[j], inner[j], inner[i]], tint); } };
  const fan = (ring, apexZ, tint) => { const ap = [cx, cy, apexZ]; for (let i = 0; i < Nr; i += 1) { const j = (i + 1) % Nr; tri(ring[i], ring[j], ap, tint); } };

  if (variant === 'colosseum') {
    const podiumTop = z0 + axis * 0.03, wallTop = z0 + axis * 0.40, tiers = 3;
    const tierH = (wallTop - podiumTop) / tiers;
    band(oval(1.05, z0), oval(1.0, podiumTop), pal.base);
    for (let t = 0; t < tiers; t += 1) {
      const zlo = podiumTop + t * tierH, zhi = zlo + tierH, s = 1.0 - t * 0.015;
      const lo = oval(s, zlo), hi = oval(s, zhi), attic = t === tiers - 1;
      for (let i = 0; i < Nr; i += 1) {
        const j = (i + 1) % Nr, corners = [lo[i], lo[j], hi[j], hi[i]];
        // attic = solid wall; lower tiers alternate light PIER / dark ARCHED opening (rounded top)
        if (!attic && i % 2 === 1) faces.push({ corners, fill: scaleHex(pal.arch, litFactor(normalToward(corners, camHint), L)), doubleSided: true, radius: '0 0 48% 48% / 0 0 72% 72%' });
        else lit(corners, attic ? scaleHex(pal.wall, 1.03) : pal.wall);
      }
      capRing(oval(s, zhi), oval(s - 0.02, zhi), pal.cornice);                 // tier cornice ledge
    }
    band(oval(0.97, wallTop), oval(0.955, wallTop + axis * 0.02), pal.cornice); // crowning cornice
    // INTERIOR cavea — concentric seating annuli sloping DOWN toward the arena floor
    const rim = wallTop - axis * 0.01;
    capRing(oval(0.93, rim), oval(0.72, rim - axis * 0.08), scaleHex(pal.seats, 0.82));
    capRing(oval(0.72, rim - axis * 0.08), oval(0.5, rim - axis * 0.14), pal.seats);
    capRing(oval(0.5, rim - axis * 0.14), oval(0.36, rim - axis * 0.17), scaleHex(pal.seats, 0.92));
    const floorZ = rim - axis * 0.18;
    fan(oval(0.36, floorZ), floorZ, pal.sand);                                 // sand arena floor
    capRing(oval(0.2, floorZ + 0.006), oval(0.18, floorZ + 0.006), pal.hypogeum); // hypogeum seam
    return faces;
  }

  // modern domed ARENA
  const baseTop = z0 + axis * 0.04, wallTop = z0 + axis * 0.20, glassTop = z0 + axis * 0.28, domeH = axis * 0.34;
  band(oval(1.03, z0), oval(1.0, baseTop), pal.base);
  band(oval(1.0, baseTop), oval(0.99, wallTop), pal.wall);
  band(oval(0.99, wallTop), oval(0.97, glassTop), pal.glass);                  // clerestory ring
  const DOME = [[0, 0.97], [0.18, 0.955], [0.36, 0.91], [0.54, 0.84], [0.7, 0.72], [0.84, 0.54], [0.94, 0.3]];
  let prev = oval(0.97, glassTop);
  for (let k = 1; k < DOME.length; k += 1) { const [hf, sf] = DOME[k]; const ring = oval(sf, glassTop + hf * domeH); band(prev, ring, pal.roof); prev = ring; }
  fan(prev, glassTop + domeH, scaleHex(pal.roof, 1.02));                       // close the cap to the apex
  for (let r = 0; r < 12; r += 1) {                                            // meridian ribs
    const a = (r / 12) * 2 * Math.PI, ux = Math.cos(a), uy = Math.sin(a), tx = -uy, ty = ux, w = axis * 0.006;
    let pPrev = null;
    for (let k = 0; k < DOME.length; k += 1) {
      const [hf, sf] = DOME[k], p = [cx + ux * rx * sf, cy + uy * ry * sf, glassTop + hf * domeH];
      if (pPrev) lit([[pPrev[0] + tx * w, pPrev[1] + ty * w, pPrev[2]], [pPrev[0] - tx * w, pPrev[1] - ty * w, pPrev[2]], [p[0] - tx * w, p[1] - ty * w, p[2]], [p[0] + tx * w, p[1] + ty * w, p[2]]], pal.rib);
      pPrev = p;
    }
  }
  band(oval(0.15, glassTop + domeH * 0.9), oval(0.11, glassTop + domeH + axis * 0.025), pal.lantern); // crown lantern
  return faces;
}

// ── primitive: GREAT PYRAMID OF GIZA ───────────────────────────────────────────────
// A deliberately simple landmark: square footprint, true pyramid height ratio, four
// sloped faces. This is the easy first case for the landmark budget/render path.
const PYRAMID_PALETTE = {
  plinth: '#bca97d',
  north: '#d6c18b',
  east: '#c8ae78',
  south: '#e0cc98',
  west: '#bfa675',
  cap: '#ead7a3',
  entry: '#4f4028',
};

const LOUVRE_PYRAMID_PALETTE = {
  plinth: '#8f9899',
  curb: '#ccd3d2',
  glassNorth: '#86b8c3',
  glassEast: '#6f9daa',
  glassSouth: '#9ccbd2',
  glassWest: '#5f8794',
  mullion: '#d8dedc',
  mullionDark: '#a7b0af',
  cap: '#f1f5f2',
};

const MEXICAN_PYRAMID_PALETTE = {
  plinth: '#8f7a54',
  stone: '#b89a63',
  stoneLight: '#cdb47a',
  stoneDark: '#8c7048',
  stair: '#d2bd86',
  rail: '#9a7a4d',
  temple: '#b7935c',
  templeTop: '#d4bd81',
  shadow: '#4f3d28',
};

function greatPyramidBuilding(b, { L, camHint, cityBox }) {
  const pal = { ...PYRAMID_PALETTE, ...(b.landmarkPalette || {}) };
  const faces = [];
  const { lit, tri } = makeFaceKit({ faces, L, camHint });
  const cx = b.x + b.w / 2, cy = b.y + b.d / 2, z0 = b.z0;
  const side = Math.min(b.w, b.d);
  const insetX = (b.w - side) / 2, insetY = (b.d - side) / 2;
  const x0 = b.x + insetX, x1 = x0 + side, y0 = b.y + insetY, y1 = y0 + side;
  const plinthH = side * 0.035;
  const baseZ = z0 + plinthH;
  const apex = [cx, cy, baseZ + side * 0.636];
  faces.push(...cityBox({ x: x0 - side * 0.04, y: y0 - side * 0.04, w: side * 1.08, d: side * 1.08 }, z0, baseZ, { top: scaleHex(pal.plinth, 1.05), side: pal.plinth }, L, camHint));

  const nw = [x0, y0, baseZ], ne = [x1, y0, baseZ], se = [x1, y1, baseZ], sw = [x0, y1, baseZ];
  tri(nw, ne, apex, pal.north);
  tri(ne, se, apex, pal.east);
  tri(se, sw, apex, pal.south);
  tri(sw, nw, apex, pal.west);

  // Subtle course lines: shallow bands on each face, enough to break the single-plane read.
  const lerp = (a, c, t) => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t];
  const courses = (A, B, tint) => {
    for (const t of [0.16, 0.3, 0.44, 0.58, 0.72]) {
      const a0 = lerp(A, apex, t), b0 = lerp(B, apex, t), a1 = lerp(A, apex, t + 0.01), b1 = lerp(B, apex, t + 0.01);
      lit([a0, b0, b1, a1], scaleHex(tint, 0.78));
    }
  };
  courses(nw, ne, pal.north); courses(ne, se, pal.east); courses(se, sw, pal.south); courses(sw, nw, pal.west);

  // Small front entrance, projected onto the south face so the pyramid has a readable scale cue.
  const f = 0.18, eh = side * 0.09, ew = side * 0.09;
  const c = lerp([(x0 + x1) / 2, y1, baseZ], apex, f);
  const nudge = 0.015;
  const entry = [
    [c[0] - ew / 2, c[1] - nudge, c[2] - eh / 2],
    [c[0] + ew / 2, c[1] - nudge, c[2] - eh / 2],
    [c[0] + ew * 0.38, c[1] - nudge, c[2] + eh / 2],
    [c[0] - ew * 0.38, c[1] - nudge, c[2] + eh / 2],
  ];
  faces.push({ corners: entry, fill: scaleHex(pal.entry, litFactor(normalToward(entry, camHint), L)), doubleSided: true });

  const capT = 0.88;
  const capRing = [lerp(nw, apex, capT), lerp(ne, apex, capT), lerp(se, apex, capT), lerp(sw, apex, capT)];
  tri(capRing[0], capRing[1], apex, pal.cap);
  tri(capRing[1], capRing[2], apex, pal.cap);
  tri(capRing[2], capRing[3], apex, pal.cap);
  tri(capRing[3], capRing[0], apex, pal.cap);
  return faces;
}

function mexicanPyramidBuilding(b, { L, camHint, cityBox }) {
  const pal = { ...MEXICAN_PYRAMID_PALETTE, ...(b.landmarkPalette || {}) };
  const faces = [];
  const { lit } = makeFaceKit({ faces, L, camHint });
  const cx = b.x + b.w / 2, cy = b.y + b.d / 2, z0 = b.z0;
  const side = Math.min(b.w, b.d);
  const insetX = (b.w - side) / 2, insetY = (b.d - side) / 2;
  const x0 = b.x + insetX, y0 = b.y + insetY;
  const tierH = side * 0.055;
  const tiers = [1.0, 0.84, 0.69, 0.55, 0.42, 0.30];
  // vgl seams are derived from the whole box massing in one pass (inkConcaveSeams) — the
  // concave-valley rule from the double-box L spike. Collect each solid mass as it is built.
  const vglW = side * 0.003;        // ~1px hairline
  const vglLiftZ = side * 0.0008;   // ledge seams: hug the contact (tiny vertical lift)
  const vglLiftXY = side * 0.004;   // wall/vertical seams: ~1px sideways lift to clear z-fighting
  const VGL = darkestHex(pal);      // palette's darkest swatch, opaque
  const vglBoxes = [];
  const boxed = (r, za, zb, colors) => {
    faces.push(...cityBox(r, za, zb, colors, L, camHint));
    vglBoxes.push({ x: r.x, y: r.y, w: r.w, d: r.d, z0: za, z1: zb });
  };

  boxed({ x: x0 - side * 0.08, y: y0 - side * 0.08, w: side * 1.16, d: side * 1.16 }, z0, z0 + side * 0.035, { top: scaleHex(pal.plinth, 1.06), side: pal.plinth });

  for (let i = 0; i < tiers.length; i += 1) {
    const s = side * tiers[i];
    const za = z0 + side * 0.035 + tierH * i;
    const zb = za + tierH;
    const tint = i % 2 === 0 ? pal.stone : pal.stoneLight;
    boxed({ x: cx - s / 2, y: cy - s / 2, w: s, d: s }, za, zb, { top: scaleHex(tint, 1.08), side: tint });
    if (i > 0) {
      const prev = side * tiers[i - 1];
      const lip = (prev - s) / 2;
      boxed({ x: cx - prev / 2, y: cy + s / 2, w: prev, d: lip * 0.42 }, za - side * 0.006, za + side * 0.006, { top: pal.stoneDark, side: pal.stoneDark });
    }
  }

  const baseZ = z0 + side * 0.035;
  const stairTop = baseZ + tierH * tiers.length;
  const stairW = side * 0.25;
  const stairD = side * 0.5;
  const steps = 13;
  for (let i = 0; i < steps; i += 1) {
    const t0 = i / steps, t1 = (i + 1) / steps;
    const y = cy + side * 0.5 - stairD * t1;
    const z = baseZ + (stairTop - baseZ) * t0;
    const h = (stairTop - baseZ) / steps;
    boxed({ x: cx - stairW / 2, y, w: stairW, d: stairD / steps * 0.95 }, z, z + h, { top: scaleHex(pal.stair, 1.05), side: pal.stair });
  }
  for (const sx of [-1, 1]) {
    boxed({ x: cx + sx * stairW / 2 - (sx < 0 ? side * 0.035 : 0), y: cy + side * 0.02, w: side * 0.035, d: side * 0.48 }, baseZ + side * 0.02, stairTop + side * 0.015, { top: pal.rail, side: pal.rail });
  }

  const topS = side * 0.23;
  const templeZ = stairTop;
  const templeH = side * 0.15;
  boxed({ x: cx - topS / 2, y: cy - topS * 0.42, w: topS, d: topS * 0.84 }, templeZ, templeZ + templeH, { top: pal.templeTop, side: pal.temple });
  boxed({ x: cx - topS * 0.6, y: cy - topS * 0.52, w: topS * 1.2, d: topS * 1.04 }, templeZ + templeH, templeZ + templeH + side * 0.035, { top: pal.templeTop, side: pal.rail });

  const eps = side * 0.006;
  const doorW = side * 0.075, doorH = side * 0.09;
  const door = [
    [cx - doorW / 2, cy + topS * 0.42 + eps, templeZ + side * 0.018],
    [cx + doorW / 2, cy + topS * 0.42 + eps, templeZ + side * 0.018],
    [cx + doorW / 2, cy + topS * 0.42 + eps, templeZ + side * 0.018 + doorH],
    [cx - doorW / 2, cy + topS * 0.42 + eps, templeZ + side * 0.018 + doorH],
  ];
  lit(door, pal.shadow);

  // One pass: ink every concave valley in the box massing (tier feet, stair-wall, contacts).
  inkConcaveSeams(vglBoxes, {
    push: (corners) => faces.push({ corners, fill: VGL, doubleSided: true }),
    width: vglW, liftZ: vglLiftZ, liftXY: vglLiftXY, probe: side * 0.0025, groundZ: z0,
  });

  return faces;
}

function louvrePyramidBuilding(b, { L, camHint, cityBox }) {
  const pal = { ...LOUVRE_PYRAMID_PALETTE, ...(b.landmarkPalette || {}) };
  const faces = [];
  const { lit, tri } = makeFaceKit({ faces, L, camHint });
  const cx = b.x + b.w / 2, cy = b.y + b.d / 2, z0 = b.z0;
  const side = Math.min(b.w, b.d);
  const insetX = (b.w - side) / 2, insetY = (b.d - side) / 2;
  const x0 = b.x + insetX, x1 = x0 + side, y0 = b.y + insetY, y1 = y0 + side;
  const plinthH = side * 0.055;
  const baseZ = z0 + plinthH;
  const apex = [cx, cy, baseZ + side * 0.61];

  faces.push(...cityBox({ x: x0 - side * 0.09, y: y0 - side * 0.09, w: side * 1.18, d: side * 1.18 }, z0, baseZ, { top: scaleHex(pal.plinth, 1.05), side: pal.plinth }, L, camHint));
  faces.push(...cityBox({ x: x0 - side * 0.025, y: y0 - side * 0.025, w: side * 1.05, d: side * 1.05 }, baseZ, baseZ + side * 0.018, { top: scaleHex(pal.curb, 1.02), side: pal.curb }, L, camHint));

  const corners = {
    nw: [x0, y0, baseZ + side * 0.018],
    ne: [x1, y0, baseZ + side * 0.018],
    se: [x1, y1, baseZ + side * 0.018],
    sw: [x0, y1, baseZ + side * 0.018],
  };
  const faceDefs = [
    [corners.nw, corners.ne, pal.glassNorth],
    [corners.ne, corners.se, pal.glassEast],
    [corners.se, corners.sw, pal.glassSouth],
    [corners.sw, corners.nw, pal.glassWest],
  ];

  const lerp = (a, c, t) => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t];
  const faceNormal = (A, B) => {
    const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, baseZ];
    return normalToward([A, B, apex], [mid[0] + (mid[0] - cx), mid[1] + (mid[1] - cy), mid[2]]);
  };
  const nudge = (p, n, e = side * 0.006) => [p[0] + n[0] * e, p[1] + n[1] * e, p[2] + n[2] * e];
  const onFace = (A, B, t, s) => {
    const left = lerp(A, apex, t), right = lerp(B, apex, t);
    return lerp(left, right, (s + 1) / 2);
  };
  const rib = (A, B, n, t0, s0, t1, s1, width, tint) => {
    const P0 = onFace(A, B, t0, s0), P1 = onFace(A, B, t1, s1);
    const dx = B[0] - A[0], dy = B[1] - A[1], dl = Math.hypot(dx, dy) || 1;
    const ux = dx / dl, uy = dy / dl;
    const w0 = width * (1 - t0), w1 = width * (1 - t1);
    const q = [
      nudge([P0[0] - ux * w0, P0[1] - uy * w0, P0[2]], n),
      nudge([P0[0] + ux * w0, P0[1] + uy * w0, P0[2]], n),
      nudge([P1[0] + ux * w1, P1[1] + uy * w1, P1[2]], n),
      nudge([P1[0] - ux * w1, P1[1] - uy * w1, P1[2]], n),
    ];
    lit(q, tint);
  };

  faceDefs.forEach(([A, B, glass]) => {
    tri(A, B, apex, glass);
    const n = faceNormal(A, B);
    rib(A, B, n, 0, -1, 0, 1, side * 0.007, pal.mullionDark);
    rib(A, B, n, 0, -1, 0.97, 0, side * 0.007, pal.mullionDark);
    rib(A, B, n, 0, 1, 0.97, 0, side * 0.007, pal.mullionDark);

    const levels = [0.14, 0.27, 0.4, 0.53, 0.66, 0.79, 0.92];
    for (const t of levels) {
      const down = Math.min(0.94, -0.92 + t * 1.95);
      rib(A, B, n, t, -1, 0.02, down, side * 0.0048, pal.mullion);
    }
    for (const t of levels) {
      const down = Math.max(-0.94, 0.92 - t * 1.95);
      rib(A, B, n, t, 1, 0.02, down, side * 0.0048, pal.mullion);
    }
  });

  const capT = 0.92;
  const capRing = [lerp(corners.nw, apex, capT), lerp(corners.ne, apex, capT), lerp(corners.se, apex, capT), lerp(corners.sw, apex, capT)];
  tri(capRing[0], capRing[1], apex, pal.cap);
  tri(capRing[1], capRing[2], apex, pal.cap);
  tri(capRing[2], capRing[3], apex, pal.cap);
  tri(capRing[3], capRing[0], apex, pal.cap);
  return faces;
}

// ── primitive: PETRONAS TOWERS ───────────────────────────────────────────────────
// Promoted from the workbench study: two flared star-plan towers, rear service cylinders,
// needle spires, center skybridge with two straight supports, and a larger Y-base + dome.
const PETRONAS_PALETTE = {
  silver: '#aeb8bd',
  alt: '#8fa1a9',
  rib: '#d6dde0',
  deep: '#6d7a82',
  cyl: '#9facb2',
  base: '#7e8b91',
  baseTop: '#aeb8bd',
  dome: '#c7d0d4',
  bridge: '#93a9b3',
};

function petronasTowersBuilding(b, { L, camHint }) {
  const pal = { ...PETRONAS_PALETTE, ...(b.landmarkPalette || {}) };
  const faces = [];
  const { lit, tri } = makeFaceKit({ faces, L, camHint });
  const cx = b.x + b.w / 2, cy = b.y + b.d / 2, z0 = b.z0;
  const side = Math.min(b.w, b.d);
  const H = side * 3.95, shaftH = side * 3.28;
  const gap = side * 0.52;

  const star = (r, lobe = 0.44, points = 8) => Array.from({ length: points * 2 }, (_, i) => {
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 8;
    const rr = r * (i % 2 === 0 ? 1 : lobe);
    return [Math.cos(a) * rr, Math.sin(a) * rr];
  });
  const prism = (poly, ox, oy, za, zb, tint) => {
    const lo = poly.map(([x, y]) => [ox + x, oy + y, za]);
    const hi = poly.map(([x, y]) => [ox + x, oy + y, zb]);
    for (let i = 0; i < poly.length; i += 1) {
      const j = (i + 1) % poly.length;
      lit([lo[i], lo[j], hi[j], hi[i]], tint);
      tri(hi[i], hi[j], [ox, oy, zb], scaleHex(tint, 1.05));
    }
  };
  const ring = (ox, oy, r, z, n = 24) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [ox + Math.cos(a) * r, oy + Math.sin(a) * r, z];
  });
  const band = (lo, hi, tint) => {
    for (let i = 0; i < lo.length; i += 1) {
      const j = (i + 1) % lo.length;
      lit([lo[i], lo[j], hi[j], hi[i]], tint);
    }
  };
  const cyl = (ox, oy, r0, za, r1, zb, tint, n = 24) => band(ring(ox, oy, r0, za, n), ring(ox, oy, r1, zb, n), tint);
  const dome = (ox, oy, r, za, h, tint) => {
    const prof = [[0, 1], [0.22, 1.05], [0.48, 0.88], [0.75, 0.48], [1, 0]];
    let prev = ring(ox, oy, r, za, 28);
    for (let i = 1; i < prof.length; i += 1) {
      const [t, rf] = prof[i], z = za + h * t;
      if (rf > 0.001) { const next = ring(ox, oy, r * rf, z, 28); band(prev, next, tint); prev = next; }
      else { const ap = [ox, oy, z]; for (let k = 0; k < prev.length; k += 1) tri(prev[k], prev[(k + 1) % prev.length], ap, tint); }
    }
  };
  const rod = (A, B, w, tint) => {
    const d = sub(B, A), u = norm(d);
    const ref = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
    const v = norm(cross(u, ref)), n = norm(cross(u, v));
    const pts = (P) => [add(P, scale(v, w)), add(P, scale(n, w)), add(P, scale(v, -w)), add(P, scale(n, -w))];
    const a = pts(A), bb = pts(B);
    for (let i = 0; i < 4; i += 1) lit([a[i], a[(i + 1) % 4], bb[(i + 1) % 4], bb[i]], tint);
  };

  const tower = (tx, sideSign) => {
    const segments = 12;
    for (let i = 0; i < segments; i += 1) {
      const za = z0 + i * (shaftH / segments), zb = z0 + (i + 1) * (shaftH / segments) + side * 0.004;
      const zm = (za + zb) / 2 - z0;
      const lower = Math.min(1, zm / (shaftH * 0.66)), upper = Math.max(0, (zm - shaftH * 0.66) / (shaftH * 0.34));
      const r = zm <= shaftH * 0.66 ? side * (0.205 - lower * 0.047) : side * (0.158 - upper * 0.019);
      prism(star(r), tx, cy, za, zb, i % 2 ? pal.alt : pal.silver);
    }
    for (let z = z0 + side * 0.1; z < z0 + shaftH - side * 0.1; z += side * 0.095) {
      const zm = z - z0, lower = Math.min(1, zm / (shaftH * 0.66)), upper = Math.max(0, (zm - shaftH * 0.66) / (shaftH * 0.34));
      const r = zm <= shaftH * 0.66 ? side * (0.218 - lower * 0.05) : side * (0.168 - upper * 0.02);
      prism(star(r, 0.46), tx, cy, z, z + side * 0.01, pal.rib);
    }

    const backY = cy - side * 0.22, cylTop = z0 + shaftH * 0.68;
    for (const [dx, r] of [[sideSign * side * 0.03, side * 0.029], [sideSign * side * 0.061, side * 0.035]]) {
      cyl(tx + dx, backY, r, z0, r * 0.86, cylTop, pal.cyl);
      for (let z = z0 + side * 0.1; z < cylTop; z += side * 0.18) cyl(tx + dx, backY, r * 1.08, z, r * 1.08, z + side * 0.012, pal.rib);
      cyl(tx + dx, backY, r * 0.95, cylTop - side * 0.02, r * 0.28, cylTop + side * 0.11, pal.rib);
    }
    cyl(tx, cy, side * 0.095, z0 + shaftH - side * 0.05, side * 0.055, z0 + shaftH + side * 0.16, pal.rib);
    cyl(tx, cy, side * 0.055, z0 + shaftH + side * 0.14, side * 0.018, z0 + shaftH + side * 0.3, pal.silver);
    cyl(tx, cy, side * 0.015, z0 + shaftH + side * 0.28, 0, z0 + H, '#dce2e4', 18);
  };

  tower(cx - gap / 2, -1);
  tower(cx + gap / 2, 1);

  const bridgeZ = z0 + shaftH * 0.51;
  prism([[-side * 0.17, -side * 0.045], [side * 0.17, -side * 0.045], [side * 0.17, side * 0.045], [-side * 0.17, side * 0.045]], cx, cy, bridgeZ, bridgeZ + side * 0.04, pal.bridge);
  prism([[-side * 0.18, -side * 0.055], [side * 0.18, -side * 0.055], [side * 0.18, side * 0.055], [-side * 0.18, side * 0.055]], cx, cy, bridgeZ - side * 0.04, bridgeZ - side * 0.015, pal.rib);
  rod([cx, cy, bridgeZ - side * 0.05], [cx - gap * 0.37, cy, bridgeZ - side * 0.25], side * 0.008, pal.deep);
  rod([cx, cy, bridgeZ - side * 0.05], [cx + gap * 0.37, cy, bridgeZ - side * 0.25], side * 0.008, pal.deep);

  // Y-base, enlarged from the workbench iteration; dome at the fork.
  const baseZ = z0 - side * 0.025;
  prism([[-side * 0.10, -side * 0.3], [side * 0.10, -side * 0.3], [side * 0.10, side * 0.31], [-side * 0.10, side * 0.31]], cx, cy + side * 0.14, baseZ, z0 + side * 0.035, pal.base);
  rod([cx, cy + side * 0.14, z0 + side * 0.055], [cx - gap * 0.52, cy, z0 + side * 0.055], side * 0.035, pal.baseTop);
  rod([cx, cy + side * 0.14, z0 + side * 0.055], [cx + gap * 0.52, cy, z0 + side * 0.055], side * 0.035, pal.baseTop);
  dome(cx, cy + side * 0.12, side * 0.14, z0 + side * 0.035, side * 0.22, pal.dome);

  return faces;
}

// ── primitive: ELIZABETH TOWER / BIG BEN ──────────────────────────────────────────
// A slender Westminster clock tower: ribbed stone shaft, projecting clock stage,
// ornate belfry, steep slate roof, and gold finial. The clock faces are stickered
// quads on the four sides, matching the existing CSS3D surface vocabulary.
const BIG_BEN_PALETTE = {
  stone: '#b98b4e',
  stoneLight: '#d0ad72',
  stoneDark: '#7c5a33',
  trim: '#d9bc75',
  shadow: '#473323',
  clock: '#edf1f2',
  clockRing: '#172437',
  clockMark: '#222a34',
  roof: '#4a5664',
  roofDark: '#2f3946',
  gold: '#d2a33a',
};

function bigBenBuilding(b, { L, camHint, cityBox }) {
  const pal = { ...BIG_BEN_PALETTE, ...(b.landmarkPalette || {}) };
  const faces = [];
  const { lit, tri } = makeFaceKit({ faces, L, camHint });
  const cx = b.x + b.w / 2, cy = b.y + b.d / 2, z0 = b.z0;
  const side = Math.min(b.w, b.d);
  const shaftW = side * 0.42, shaftD = side * 0.42;
  const clockW = side * 0.6, clockD = side * 0.6;
  const baseTop = z0 + side * 0.16;
  const shaftTop = z0 + side * 2.25;
  const clockTop = z0 + side * 2.78;
  const belfryTop = z0 + side * 3.2;
  const roofBase = belfryTop + side * 0.03;
  const roofApex = z0 + side * 3.62;
  const finialTop = z0 + side * 3.88;
  const eps = side * 0.003;

  const centeredBox = (w, d, za, zb, top, wall = pal.stone) => faces.push(...cityBox(
    { x: cx - w / 2, y: cy - d / 2, w, d },
    za,
    zb,
    { top, side: wall },
    L,
    camHint,
  ));

  const facade = (nx, ny, halfW, halfD, tCenter, zCenter, w, h, tint, radius, out = 0) => {
    const tx = -ny, ty = nx;
    const ox = cx + nx * (halfD + eps + out) + tx * tCenter;
    const oy = cy + ny * (halfD + eps + out) + ty * tCenter;
    const corners = [
      [ox - tx * w / 2, oy - ty * w / 2, zCenter - h / 2],
      [ox + tx * w / 2, oy + ty * w / 2, zCenter - h / 2],
      [ox + tx * w / 2, oy + ty * w / 2, zCenter + h / 2],
      [ox - tx * w / 2, oy - ty * w / 2, zCenter + h / 2],
    ];
    const face = { corners, fill: scaleHex(tint, litFactor(normalToward(corners, camHint), L)), doubleSided: true };
    if (radius) face.radius = radius;
    faces.push(face);
    return corners;
  };
  const allSides = (halfW, halfD, fn) => {
    fn(0, 1, halfW, halfD);
    fn(0, -1, halfW, halfD);
    fn(1, 0, halfD, halfW);
    fn(-1, 0, halfD, halfW);
  };
  const lineOnFacade = (nx, ny, halfW, halfD, a, za, c, zc, width, tint, out = 0) => {
    const tx = -ny, ty = nx;
    const p = (t, z, off = 0) => [cx + nx * (halfD + eps * 2 + out) + tx * t + nx * off, cy + ny * (halfD + eps * 2 + out) + ty * t + ny * off, z];
    const dx = c - a, dz = zc - za, l = Math.hypot(dx, dz) || 1;
    const pt = -dz / l * width, pz = dx / l * width;
    const corners = [p(a + pt, za + pz), p(a - pt, za - pz), p(c - pt, zc - pz), p(c + pt, zc + pz)];
    lit(corners, tint);
  };

  centeredBox(side * 0.7, side * 0.66, z0, baseTop, scaleHex(pal.stoneLight, 1.02), pal.stone);
  centeredBox(shaftW, shaftD, baseTop, shaftTop, pal.stoneLight, pal.stone);
  centeredBox(clockW, clockD, shaftTop, clockTop, pal.trim, pal.stoneLight);
  centeredBox(side * 0.54, side * 0.54, clockTop, belfryTop, pal.trim, pal.stone);

  for (let z = baseTop + side * 0.12; z < shaftTop - side * 0.05; z += side * 0.24) {
    centeredBox(shaftW * 1.04, shaftD * 1.04, z, z + side * 0.025, pal.trim, pal.trim);
  }
  for (const t of [-0.34, -0.17, 0.17, 0.34]) {
    allSides(shaftW / 2, shaftD / 2, (nx, ny, hw, hd) => facade(nx, ny, hw, hd, t * hw, (baseTop + shaftTop) / 2, side * 0.018, shaftTop - baseTop, t === -0.34 || t === 0.34 ? pal.stoneDark : pal.trim));
  }
  for (let z = baseTop + side * 0.22; z < shaftTop - side * 0.08; z += side * 0.42) {
    allSides(shaftW / 2, shaftD / 2, (nx, ny, hw, hd) => {
      for (const t of [-0.18, 0, 0.18]) facade(nx, ny, hw, hd, t * hw, z, side * 0.055, side * 0.22, scaleHex(pal.shadow, 0.9), '45% 45% 0 0 / 60% 60% 0 0');
    });
  }

  allSides(clockW / 2, clockD / 2, (nx, ny, hw, hd) => {
    const cz = shaftTop + (clockTop - shaftTop) * 0.52;
    const layer = side * 0.006;
    facade(nx, ny, hw, hd, 0, cz, side * 0.42, side * 0.42, pal.clockRing, '50%', layer);
    facade(nx, ny, hw, hd, 0, cz, side * 0.35, side * 0.35, pal.clock, '50%', layer * 2);
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      facade(nx, ny, hw, hd, Math.sin(a) * side * 0.145, cz + Math.cos(a) * side * 0.145, side * 0.012, side * 0.035, pal.clockMark, undefined, layer * 3);
    }
    lineOnFacade(nx, ny, hw, hd, 0, cz, side * 0.105, cz + side * 0.055, side * 0.009, pal.clockMark, layer * 4);
    lineOnFacade(nx, ny, hw, hd, 0, cz, -side * 0.018, cz + side * 0.112, side * 0.007, pal.clockMark, layer * 5);
    facade(nx, ny, hw, hd, 0, cz, side * 0.035, side * 0.035, pal.gold, '50%', layer * 6);
  });

  for (const z of [shaftTop - side * 0.02, clockTop - side * 0.03, clockTop + side * 0.1]) {
    centeredBox(clockW * 1.05, clockD * 1.05, z, z + side * 0.028, pal.trim, pal.trim);
  }
  allSides(side * 0.54 / 2, side * 0.54 / 2, (nx, ny, hw, hd) => {
    for (const t of [-0.24, 0, 0.24]) facade(nx, ny, hw, hd, t * hw, clockTop + side * 0.19, side * 0.075, side * 0.3, pal.shadow, '45% 45% 0 0 / 62% 62% 0 0');
    for (const t of [-0.42, 0.42]) facade(nx, ny, hw, hd, t * hw, clockTop + side * 0.18, side * 0.028, side * 0.36, pal.trim);
  });

  const r = side * 0.31, rb = roofBase;
  const roofCorners = [
    [cx - r, cy - r, rb],
    [cx + r, cy - r, rb],
    [cx + r, cy + r, rb],
    [cx - r, cy + r, rb],
  ];
  const apex = [cx, cy, roofApex];
  tri(roofCorners[0], roofCorners[1], apex, pal.roofDark);
  tri(roofCorners[1], roofCorners[2], apex, pal.roof);
  tri(roofCorners[2], roofCorners[3], apex, pal.roof);
  tri(roofCorners[3], roofCorners[0], apex, pal.roofDark);
  for (const t of [-0.18, 0, 0.18]) {
    lineOnFacade(0, 1, r, r, t * r, rb + side * 0.02, 0, roofApex - side * 0.02, side * 0.006, pal.gold);
    lineOnFacade(0, -1, r, r, t * r, rb + side * 0.02, 0, roofApex - side * 0.02, side * 0.006, pal.gold);
  }

  for (const [px, py] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const ox = cx + px * side * 0.28, oy = cy + py * side * 0.28;
    faces.push(...cityBox({ x: ox - side * 0.025, y: oy - side * 0.025, w: side * 0.05, d: side * 0.05 }, clockTop + side * 0.02, rb + side * 0.08, { top: pal.gold, side: pal.trim }, L, camHint));
    const pTop = [ox, oy, rb + side * 0.18];
    tri([ox - side * 0.035, oy - side * 0.035, rb + side * 0.08], [ox + side * 0.035, oy - side * 0.035, rb + side * 0.08], pTop, pal.gold);
    tri([ox + side * 0.035, oy - side * 0.035, rb + side * 0.08], [ox + side * 0.035, oy + side * 0.035, rb + side * 0.08], pTop, pal.gold);
    tri([ox + side * 0.035, oy + side * 0.035, rb + side * 0.08], [ox - side * 0.035, oy + side * 0.035, rb + side * 0.08], pTop, pal.gold);
    tri([ox - side * 0.035, oy + side * 0.035, rb + side * 0.08], [ox - side * 0.035, oy - side * 0.035, rb + side * 0.08], pTop, pal.gold);
  }

  centeredBox(side * 0.055, side * 0.055, roofApex - side * 0.02, roofApex + side * 0.12, pal.gold, pal.gold);
  centeredBox(side * 0.028, side * 0.028, roofApex + side * 0.1, finialTop, pal.gold, pal.gold);
  facade(0, 1, side * 0.04, side * 0.04, 0, finialTop, side * 0.08, side * 0.08, pal.gold, '50%');
  facade(1, 0, side * 0.04, side * 0.04, 0, finialTop, side * 0.08, side * 0.08, pal.gold, '50%');

  return faces;
}

// ── primitive: STONEHENGE ────────────────────────────────────────────────────────
// Promoted from the assembler study: an incomplete outer sarsen circle, an inner
// horseshoe of trilithons, lower inner stones, foreground fallen slabs, and the
// offset heel stone. Built directly from rotated cuboids so the city landmark stays
// self-contained and scales to any reserved footprint.
const STONEHENGE_PALETTE = {
  stone: '#9b9788',
  stoneDark: '#777668',
  stoneLight: '#b7b1a0',
  fallen: '#8d897b',
  heel: '#a9a38f',
};

function stonehengeBuilding(b, { L, camHint }) {
  const pal = { ...STONEHENGE_PALETTE, ...(b.landmarkPalette || {}) };
  const faces = [];
  const { lit } = makeFaceKit({ faces, L, camHint });
  const cx = b.x + b.w / 2, cy = b.y + b.d / 2, z0 = b.z0;
  const side = Math.min(b.w, b.d);

  const cuboid = (x, y, za, zb, length, depth, angle, tint) => {
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const ux = ca * length / 2, uy = sa * length / 2;
    const vx = -sa * depth / 2, vy = ca * depth / 2;
    const lo = [
      [x - ux - vx, y - uy - vy, za],
      [x + ux - vx, y + uy - vy, za],
      [x + ux + vx, y + uy + vy, za],
      [x - ux + vx, y - uy + vy, za],
    ];
    const hi = lo.map(([px, py]) => [px, py, zb]);
    for (let i = 0; i < 4; i += 1) {
      const j = (i + 1) % 4;
      lit([lo[i], lo[j], hi[j], hi[i]], tint);
    }
    lit([hi[0], hi[1], hi[2], hi[3]], scaleHex(tint, 1.06));
    lit([lo[3], lo[2], lo[1], lo[0]], scaleHex(tint, 0.82));
  };
  const place = (rx, ry, deg, opts = {}) => {
    const a = deg * Math.PI / 180;
    cuboid(
      cx + Math.cos(a) * rx,
      cy + Math.sin(a) * ry,
      z0 + (opts.z || 0),
      z0 + (opts.z || 0) + opts.h,
      opts.length,
      opts.depth,
      a + Math.PI / 2 + (opts.twist || 0),
      opts.tint,
    );
  };

  const outerRx = b.w * 0.36, outerRy = b.d * 0.34;
  const outerMissing = new Set([3, 8, 13, 17]);
  for (let i = 0; i < 20; i += 1) {
    if (outerMissing.has(i)) continue;
    const deg = 6 + i * 18;
    const tint = i % 3 === 0 ? pal.stoneLight : (i % 3 === 1 ? pal.stone : pal.stoneDark);
    place(outerRx, outerRy, deg, {
      h: side * (0.34 + (i % 4) * 0.014),
      length: side * (0.085 + (i % 2) * 0.014),
      depth: side * 0.064,
      twist: ((i % 5) - 2) * 0.018,
      tint,
    });
  }
  for (const i of [0, 1, 5, 10, 15]) {
    const deg = 6 + i * 18;
    const a = deg * Math.PI / 180;
    cuboid(
      cx + Math.cos(a) * outerRx * 0.985,
      cy + Math.sin(a) * outerRy * 0.985,
      z0 + side * 0.34,
      z0 + side * 0.39,
      side * 0.26,
      side * 0.075,
      a + Math.PI / 2,
      '#aaa493',
    );
  }

  // Inner trilithon horseshoe, open toward the northeast.
  for (let i = 0; i < 5; i += 1) {
    const deg = 210 - i * 60;
    const a = deg * Math.PI / 180;
    const x = cx + Math.cos(a) * b.w * 0.15;
    const y = cy + Math.sin(a) * b.d * 0.21;
    const tangent = a + Math.PI / 2;
    const off = side * 0.07;
    const ox = Math.cos(tangent) * off, oy = Math.sin(tangent) * off;
    const lean = (i - 2) * 0.012;
    cuboid(x - ox, y - oy, z0, z0 + side * 0.47, side * 0.1, side * 0.074, tangent + lean, pal.stone);
    cuboid(x + ox, y + oy, z0, z0 + side * 0.47, side * 0.1, side * 0.074, tangent - lean, pal.stone);
    cuboid(x, y, z0 + side * 0.47, z0 + side * 0.535, side * 0.32, side * 0.086, tangent, pal.stoneLight);
  }

  for (let i = 0; i < 14; i += 1) {
    if (i === 2 || i === 11) continue;
    const deg = 12 + i * (360 / 14);
    place(b.w * 0.235, b.d * 0.2, deg, {
      h: side * (0.24 + (i % 3) * 0.018),
      length: side * 0.075,
      depth: side * 0.056,
      twist: ((i % 4) - 1.5) * 0.02,
      tint: pal.stoneDark,
    });
  }

  [
    [-0.23, -0.29, -22, 0.34],
    [-0.06, -0.18, 16, 0.26],
    [0.18, -0.27, 31, 0.3],
    [0.27, 0.07, -56, 0.24],
  ].forEach(([fx, fy, rz, scale]) => {
    cuboid(cx + b.w * fx, cy + b.d * fy, z0 + side * 0.018, z0 + side * 0.07, side * scale, side * 0.075, rz * Math.PI / 180, pal.fallen);
  });

  cuboid(cx + b.w * 0.42, cy + b.d * 0.32, z0, z0 + side * 0.36, side * 0.105, side * 0.078, 34 * Math.PI / 180, pal.heel);
  return faces;
}

// ── primitive: CHINATOWN GATE / PAIFANG ──────────────────────────────────────────
// A smaller gateway landmark: red post pairs, gold plinths and brackets, a central sign,
// a green tiled main roof, and two smaller side roofs with upturned eaves.
const CHINATOWN_GATE_PALETTE = {
  red: '#a92e26',
  redDark: '#6f1d1a',
  gold: '#d2a33a',
  goldLight: '#e5c65f',
  jade: '#2f806d',
  jadeDark: '#1f554a',
  tile: '#3a8f78',
  sign: '#254245',
};

function chinatownGateBuilding(b, { L, camHint, cityBox }) {
  const pal = { ...CHINATOWN_GATE_PALETTE, ...(b.landmarkPalette || {}) };
  const faces = [];
  const { lit, tri } = makeFaceKit({ faces, L, camHint });
  const cx = b.x + b.w / 2, cy = b.y + b.d / 2, z0 = b.z0;
  const side = Math.min(b.w, b.d);
  const box = (x, y, w, d, za, zb, top, wall = top) => faces.push(...cityBox({ x: cx + x - w / 2, y: cy + y - d / 2, w, d }, z0 + za, z0 + zb, { top, side: wall }, L, camHint));
  const slabFace = (x0, x1, y, za, zb, tint, lift = 0) => {
    const q = [[cx + x0, cy + y - lift, z0 + za], [cx + x1, cy + y - lift, z0 + za], [cx + x1, cy + y - lift, z0 + zb], [cx + x0, cy + y - lift, z0 + zb]];
    lit(q, tint);
  };
  const roof = (x, y, w, d, za, h, tint) => {
    const z = z0 + za, top = z + h;
    const x0 = cx + x - w / 2, x1 = cx + x + w / 2, y0 = cy + y - d / 2, y1 = cy + y + d / 2;
    const e = side * 0.035;
    const r0 = [x0 + e, cy + y, top], r1 = [x1 - e, cy + y, top];
    lit([[x0, y0, z], [x1, y0, z], r1, r0], tint);
    lit([[x1, y1, z], [x0, y1, z], r0, r1], tint);
    tri([x0, y1, z], [x0, y0, z], r0, pal.jadeDark);
    tri([x1, y0, z], [x1, y1, z], r1, pal.jadeDark);
    // Upturned eaves: little gold-capped fins at four corners.
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const px = sx > 0 ? x1 : x0, py = sy > 0 ? y1 : y0;
      tri([px, py, z], [px - sx * side * 0.06, py, z], [px, py + sy * side * 0.08, z + h * 0.45], pal.gold);
    }
    // Tile ribs across the roof.
    for (let i = -3; i <= 3; i += 1) {
      const xx = x + i * w / 8;
      box(xx, y, side * 0.01, d * 1.03, za + h * 0.06, za + h * 0.13, pal.jadeDark, pal.jadeDark);
    }
  };

  const postH = side * 0.78;
  const roofBase = postH + side * 0.16;
  const postW = side * 0.09, postD = side * 0.12;
  const postXs = [-b.w * 0.38, -b.w * 0.18, b.w * 0.18, b.w * 0.38];
  for (const x of postXs) {
    box(x, 0, postW * 1.35, postD * 1.25, 0, side * 0.06, pal.goldLight, pal.gold);
    box(x, 0, postW, postD, side * 0.06, postH, pal.red, pal.redDark);
    box(x, 0, postW * 1.22, postD * 1.16, postH - side * 0.04, postH + side * 0.015, pal.gold, pal.gold);
  }

  box(0, 0, b.w * 0.86, side * 0.13, postH * 0.72, postH * 0.82, pal.red, pal.redDark);
  box(0, 0, b.w * 0.78, side * 0.1, postH, postH + side * 0.08, pal.red, pal.redDark);
  box(0, -postD * 0.58, b.w * 0.34, side * 0.025, postH * 0.5, postH * 0.68, pal.gold, pal.gold);
  slabFace(-b.w * 0.16, b.w * 0.16, -postD * 0.595, postH * 0.525, postH * 0.655, pal.sign, side * 0.005);
  for (const t of [-0.09, 0, 0.09]) box(t * b.w, -postD * 0.63, side * 0.012, side * 0.018, postH * 0.55, postH * 0.63, pal.goldLight, pal.goldLight);

  roof(0, 0, b.w * 0.92, side * 0.38, roofBase, side * 0.2, pal.tile);
  roof(-b.w * 0.28, 0, b.w * 0.28, side * 0.28, postH + side * 0.05, side * 0.12, pal.tile);
  roof(b.w * 0.28, 0, b.w * 0.28, side * 0.28, postH + side * 0.05, side * 0.12, pal.tile);

  for (const x of [-b.w * 0.28, b.w * 0.28]) {
    box(x, 0, side * 0.11, side * 0.09, postH * 0.82, postH + side * 0.08, pal.gold, pal.gold);
  }
  return faces;
}

// ── primitive: ARC DE TRIOMPHE ───────────────────────────────────────────────────
// A blocky triumphal arch: two heavy piers with a real open central passage,
// a tall attic, layered cornices, dark arched recesses, and shallow carved panels.
const ARC_DE_TRIOMPHE_PALETTE = {
  stone: '#d7cfbd',
  stoneLight: '#e7dfcf',
  stoneDark: '#9d927d',
  vault: '#b3aa95',   // arch soffit / tunnel interior, sits in self-shade
  recess: '#4f493d',
  carving: '#c9bda5',
};

// The three.js World renderer flattens every face to its 4 corners (radius/clip are
// ignored), so the arch CANNOT be faked with a rounded recess panel — it has to be real
// geometry: see-through barrel vaults, curved soffits, and stone spandrels that actually
// frame the openings. Great arch runs through the depth (±y faces); two shorter transverse
// arches run through the width (±x faces); both crowns sit below the solid entablature.
function arcDeTriompheBuilding(b, { L, camHint, cityBox }) {
  const pal = { ...ARC_DE_TRIOMPHE_PALETTE, ...(b.landmarkPalette || {}) };
  const faces = [];
  const { lit } = makeFaceKit({ faces, L, camHint });
  const cx = b.x + b.w / 2, cy = b.y + b.d / 2, z0 = b.z0;
  const S = Math.min(b.w, b.d);
  const box = (x, y, w, d, za, zb, top = pal.stoneLight, wall = pal.stone) =>
    faces.push(...cityBox({ x: cx + x - w / 2, y: cy + y - d / 2, w, d }, z0 + za, z0 + zb, { top, side: wall }, L, camHint));

  // ── proportions (attic-heavy, like the real monument: legs ~0.50, entablature, tall attic) ──
  const plinthH = S * 0.05;
  const springMain = S * 0.58;             // springline of the great arch
  const rMain = b.w * 0.18;                // half opening width on the wide (±y) faces
  const crownMain = springMain + rMain;
  const springTrans = S * 0.40;
  const rTrans = b.d * 0.115;              // smaller transverse arch on the ±x faces
  const upperBase = crownMain + S * 0.05;  // solid mass begins just above the great-arch crown
  const corniceTop = S * 1.0;
  const atticTop = S * 1.34;
  const eps = S * 0.006;

  // ── solid mass: plinth, four corner piers, entablature, projecting cornice, tall attic ──
  box(0, 0, b.w, b.d, 0, plinthH, pal.stoneLight, pal.stoneDark);
  const pwx = b.w / 2 - rMain, pcx = rMain + pwx / 2;
  const pwy = b.d / 2 - rTrans, pcy = rTrans + pwy / 2;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    box(sx * pcx, sy * pcy, pwx, pwy, plinthH, upperBase, pal.stoneLight, pal.stone);
  }
  box(0, 0, b.w * 0.985, b.d * 0.985, upperBase, corniceTop, pal.stoneLight, pal.stone);
  box(0, 0, b.w * 1.015, b.d * 1.015, corniceTop, corniceTop + S * 0.035, pal.stoneLight, pal.stoneDark);
  box(0, 0, b.w * 0.92, b.d * 0.92, corniceTop + S * 0.035, atticTop, pal.stoneLight, pal.stone);
  box(0, 0, b.w * 0.945, b.d * 0.945, atticTop, atticTop + S * 0.025, pal.stoneLight, pal.stoneDark);

  // ── great arch: see-through barrel vault through the depth (±y) ──
  const soffitMain = (n = 18) => {
    const zc = z0 + springMain;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI, a1 = ((i + 1) / n) * Math.PI;
      const x0 = Math.cos(a0) * rMain, h0 = Math.sin(a0) * rMain;
      const x1 = Math.cos(a1) * rMain, h1 = Math.sin(a1) * rMain;
      lit([[cx + x0, b.y, zc + h0], [cx + x1, b.y, zc + h1], [cx + x1, b.y + b.d, zc + h1], [cx + x0, b.y + b.d, zc + h0]], pal.vault);
    }
  };
  const spandrelMain = (Y, n = 24) => { // flat stone filling above the arch curve to the entablature
    const zc = z0 + springMain, zt = z0 + upperBase;
    for (let i = 0; i < n; i++) {
      const x0 = -rMain + 2 * rMain * (i / n), x1 = -rMain + 2 * rMain * ((i + 1) / n);
      const c0 = zc + Math.sqrt(Math.max(0, rMain * rMain - x0 * x0));
      const c1 = zc + Math.sqrt(Math.max(0, rMain * rMain - x1 * x1));
      lit([[cx + x0, Y, c0], [cx + x1, Y, c1], [cx + x1, Y, zt], [cx + x0, Y, zt]], pal.stone);
    }
  };
  soffitMain();
  spandrelMain(b.y);
  spandrelMain(b.y + b.d);

  // ── transverse arches: two shorter barrel vaults through the width (±x), one per pier pair ──
  const soffitTrans = (xa, xb, n = 12) => {
    const zc = z0 + springTrans;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI, a1 = ((i + 1) / n) * Math.PI;
      const y0 = Math.cos(a0) * rTrans, h0 = Math.sin(a0) * rTrans;
      const y1 = Math.cos(a1) * rTrans, h1 = Math.sin(a1) * rTrans;
      lit([[xa, cy + y0, zc + h0], [xb, cy + y0, zc + h0], [xb, cy + y1, zc + h1], [xa, cy + y1, zc + h1]], pal.vault);
    }
  };
  const spandrelTrans = (X, n = 16) => {
    const zc = z0 + springTrans, zt = z0 + upperBase;
    for (let i = 0; i < n; i++) {
      const y0 = -rTrans + 2 * rTrans * (i / n), y1 = -rTrans + 2 * rTrans * ((i + 1) / n);
      const c0 = zc + Math.sqrt(Math.max(0, rTrans * rTrans - y0 * y0));
      const c1 = zc + Math.sqrt(Math.max(0, rTrans * rTrans - y1 * y1));
      lit([[X, cy + y0, c0], [X, cy + y1, c1], [X, cy + y1, zt], [X, cy + y0, zt]], pal.stone);
    }
  };
  soffitTrans(b.x, cx - rMain);
  soffitTrans(cx + rMain, b.x + b.w);
  spandrelTrans(b.x);
  spandrelTrans(b.x + b.w);

  // ── carved detail: keystones, pier reliefs, attic inscription panels ──
  for (const [Y, ny] of [[b.y, -1], [b.y + b.d, 1]]) {
    const kw = rMain * 0.36, kh = S * 0.16, zk0 = z0 + crownMain - S * 0.03, zk1 = zk0 + kh, yo = Y + ny * eps * 1.6;
    lit([[cx - kw / 2, yo, zk0], [cx + kw / 2, yo, zk0], [cx + kw * 0.34, yo, zk1], [cx - kw * 0.34, yo, zk1]], pal.carving);
    for (const sx of [-1, 1]) { // sculptural relief group on each pier face: raised stone panel in a thin recessed frame
      const w = pwx * 0.56, rx = sx * pcx, zlo = z0 + plinthH + S * 0.12, zhi = z0 + springMain - S * 0.1, yo2 = Y + ny * eps;
      lit([[cx + rx - w / 2 - eps, yo2, zlo - eps], [cx + rx + w / 2 + eps, yo2, zlo - eps], [cx + rx + w / 2 + eps, yo2, zhi + eps], [cx + rx - w / 2 - eps, yo2, zhi + eps]], pal.recess);
      lit([[cx + rx - w / 2, Y + ny * eps * 1.8, zlo], [cx + rx + w / 2, Y + ny * eps * 1.8, zlo], [cx + rx + w / 2, Y + ny * eps * 1.8, zhi], [cx + rx - w / 2, Y + ny * eps * 1.8, zhi]], pal.carving);
    }
    const aw = b.w * 0.58, az0 = z0 + corniceTop + S * 0.12, az1 = z0 + atticTop - S * 0.12, ayo = cy + ny * (b.d * 0.92 / 2 + eps);
    lit([[cx - aw / 2, ayo, az0], [cx + aw / 2, ayo, az0], [cx + aw / 2, ayo, az1], [cx - aw / 2, ayo, az1]], pal.carving);
  }
  for (const [X, nx] of [[b.x, -1], [b.x + b.w, 1]]) { // raised relief on the narrow faces
    const w = pwy * 0.5, zlo = z0 + plinthH + S * 0.12, zhi = z0 + springTrans + S * 0.18, xo = X + nx * eps * 1.8;
    for (const sy of [-1, 1]) lit([[xo, cy + sy * pcy - w / 2, zlo], [xo, cy + sy * pcy + w / 2, zlo], [xo, cy + sy * pcy + w / 2, zhi], [xo, cy + sy * pcy - w / 2, zhi]], pal.carving);
  }

  return faces;
}

// ── primitive: PARTHENON (contemporary / ruined state) ──────────────────────────
// Not the pristine reconstruction — the monument as it stands today: a long Doric
// peripteral colonnade (8×17) on a three-step stylobate, with a COLLAPSED run of
// columns on one flank, entablature surviving only over the two end façades and the
// corner stubs, both pediments reduced to their raking-cornice frames over an empty
// tympanum, no roof, and broken inner cella walls. Built from real quad geometry
// (the World renderer flattens radius/clip), with weather-stained marble.
const PARTHENON_PALETTE = {
  marble: '#e4dcc9',
  marbleLight: '#f1ebdc',
  marbleShadow: '#b4a98f',
  step: '#d6cdb7',
  weather: '#c7bb9d',   // ochre staining on sheltered/old surfaces
  recess: '#6d6450',
};

function parthenonBuilding(b, { L, camHint, cityBox }) {
  const pal = { ...PARTHENON_PALETTE, ...(b.landmarkPalette || {}) };
  const faces = [];
  const { lit } = makeFaceKit({ faces, L, camHint });
  const z0 = b.z0, W = b.w, D = b.d, SHORT = Math.min(W, D);
  const box = (x, y, w, d, za, zb, top = pal.marbleLight, wall = pal.marble) =>
    faces.push(...cityBox({ x, y, w, d }, z0 + za, z0 + zb, { top, side: wall }, L, camHint));
  const longX = W >= D;                                  // long colonnade axis
  const NL = 17, NS = 8;                                 // columns along flank / end
  const inset = SHORT * 0.07;
  const P = (u, v) => longX                              // u: along-long, v: across → world [x,y]
    ? [b.x + inset + (W - 2 * inset) * u, b.y + inset + (D - 2 * inset) * v]
    : [b.x + inset + (W - 2 * inset) * v, b.y + inset + (D - 2 * inset) * u];

  // ── three-step stylobate ──
  for (let s = 0; s < 3; s++) {
    const m = SHORT * 0.022 * s;
    box(b.x + m, b.y + m, W - 2 * m, D - 2 * m, SHORT * 0.022 * s, SHORT * 0.022 * (s + 1), pal.step, pal.marbleShadow);
  }
  const baseZ = SHORT * 0.066;                           // stylobate top

  const longLen = (longX ? W : D) - 2 * inset, shortLen = (longX ? D : W) - 2 * inset;
  const colR = Math.min(longLen / (NL - 1), shortLen / (NS - 1)) * 0.34;
  const colH = SHORT * 0.34;
  const archH = colH * 0.15, friezeH = colH * 0.15, geisonH = colH * 0.05, entH = archH + friezeH + geisonH;
  const colTopZ = baseZ + colH;

  // ── fluted Doric column with entasis + echinus/abacus capital ──
  const NF = 12, SEG = 5;
  const ringAt = (ox, oy, r, z) => Array.from({ length: NF }, (_, i) => { const a = (i / NF) * 2 * Math.PI; return [ox + Math.cos(a) * r, oy + Math.sin(a) * r, z]; });
  const band = (lo, hi, tint) => { for (let i = 0; i < NF; i++) { const j = (i + 1) % NF; lit([lo[i], lo[j], hi[j], hi[i]], tint); } };
  const column = (ox, oy) => {
    const topR = colR * 0.80;
    let prev = ringAt(ox, oy, colR, z0 + baseZ);
    for (let s = 1; s <= SEG; s++) {
      const t = s / SEG;
      const r = colR + (topR - colR) * t + colR * 0.05 * Math.sin(t * Math.PI);   // entasis
      const cur = ringAt(ox, oy, r, z0 + baseZ + colH * t);
      band(prev, cur, pal.marble); prev = cur;
    }
    band(ringAt(ox, oy, topR, z0 + colTopZ - colH * 0.02), ringAt(ox, oy, topR * 1.42, z0 + colTopZ + colH * 0.018), pal.marbleLight); // echinus
    const ab = topR * 1.5;
    box(ox - ab, oy - ab, ab * 2, ab * 2, colTopZ + colH * 0.018, colTopZ + colH * 0.06, pal.marbleLight, pal.marble); // abacus
  };

  // ── ruin map: which columns still stand ──
  const stands = (side, t) => {
    if (side === 'flankA') return !(t > 0.32 && t < 0.64);    // collapsed central run
    if (side === 'flankB') return !(t > 0.80 && t < 0.88);    // one toppled
    return true;                                              // both end façades intact
  };
  for (let k = 0; k < NL; k++) {
    const t = k / (NL - 1);
    for (const [v, side] of [[0, 'flankA'], [1, 'flankB']]) if (stands(side, t)) { const [x, y] = P(t, v); column(x, y); }
  }
  for (let k = 1; k < NS - 1; k++) {
    const v = k / (NS - 1);
    for (const u of [0, 1]) { const [x, y] = P(u, v); column(x, y); }
  }

  // ── entablature (architrave + frieze + projecting geison) over surviving spans ──
  const beam = (xa, ya, xb, yb) => {
    const horiz = Math.abs(yb - ya) < 1e-6;
    const x = horiz ? Math.min(xa, xb) : xa - colR, y = horiz ? ya - colR : Math.min(ya, yb);
    const w = horiz ? Math.abs(xb - xa) : colR * 2, d = horiz ? colR * 2 : Math.abs(yb - ya);
    box(x, y, w, d, colH, colH + archH, pal.marbleLight, pal.marble);
    box(x, y, w, d, colH + archH, colH + archH + friezeH, pal.marble, pal.marbleShadow);
    box(x - colR * 0.25, y - colR * 0.25, w + colR * 0.5, d + colR * 0.5, colH + archH + friezeH, colH + entH, pal.marbleLight, pal.marble);
  };
  const entPresent = (side, tm) => side === 'flankA' ? (tm < 0.24 || tm > 0.9) : side === 'flankB' ? tm < 0.16 : true;
  for (let k = 0; k < NL - 1; k++) {
    const t0 = k / (NL - 1), t1 = (k + 1) / (NL - 1), tm = (t0 + t1) / 2;
    for (const [v, side] of [[0, 'flankA'], [1, 'flankB']]) {
      if (stands(side, t0) && stands(side, t1) && entPresent(side, tm)) { const [xa, ya] = P(t0, v), [xb, yb] = P(t1, v); beam(xa, ya, xb, yb); }
    }
  }
  for (let k = 0; k < NS - 1; k++) {
    const v0 = k / (NS - 1), v1 = (k + 1) / (NS - 1);
    for (const u of [0, 1]) { const [xa, ya] = P(u, v0), [xb, yb] = P(u, v1); beam(xa, ya, xb, yb); }
  }

  // ── broken inner cella walls (no roof) ──
  const wallLong = (v, ua, ub, h) => { const A = P(ua, v), B = P(ub, v); longX ? box(Math.min(A[0], B[0]), A[1] - colR * 0.5, Math.abs(B[0] - A[0]), colR, baseZ, baseZ + h, pal.marbleLight, pal.weather) : box(A[0] - colR * 0.5, Math.min(A[1], B[1]), colR, Math.abs(B[1] - A[1]), baseZ, baseZ + h, pal.marbleLight, pal.weather); };
  const wallAcross = (u, va, vb, h) => { const A = P(u, va), B = P(u, vb); longX ? box(A[0] - colR * 0.5, Math.min(A[1], B[1]), colR, Math.abs(B[1] - A[1]), baseZ, baseZ + h, pal.marbleLight, pal.weather) : box(Math.min(A[0], B[0]), A[1] - colR * 0.5, Math.abs(B[0] - A[0]), colR, baseZ, baseZ + h, pal.marbleLight, pal.weather); };
  const cwH = colH * 0.6;
  wallLong(0.30, 0.12, 0.64, cwH);
  wallLong(0.70, 0.12, 0.64, cwH);
  wallAcross(0.12, 0.30, 0.70, cwH);
  wallAcross(0.64, 0.30, 0.70, cwH * 0.66);

  return faces;
}

// ── primitive: GRIFFITH OBSERVATORY ─────────────────────────────────────────────
// The unmistakable silhouette: one large central dome flanked by two smaller end
// domes on a long, symmetric Art Deco building. Buff concrete walls with vertical
// pilaster rhythm; weathered-copper (verdigris-grey) hemispherical domes on drums,
// each capped by a small finial. Real quad geometry (no radius/clip).
const GRIFFITH_PALETTE = {
  wall: '#d8cdb4',
  wallLight: '#e7ddc8',
  wallShadow: '#a99c80',
  step: '#cfc4aa',
  dome: '#8d9c92',
  domeLight: '#a6b3a9',
  trim: '#7a7156',
};

function griffithObservatoryBuilding(b, { L, camHint, cityBox }) {
  const pal = { ...GRIFFITH_PALETTE, ...(b.landmarkPalette || {}) };
  const faces = [];
  const { lit } = makeFaceKit({ faces, L, camHint });
  const z0 = b.z0, W = b.w, D = b.d, SHORT = Math.min(W, D);
  const box = (x, y, w, d, za, zb, top = pal.wallLight, wall = pal.wall) =>
    faces.push(...cityBox({ x, y, w, d }, z0 + za, z0 + zb, { top, side: wall }, L, camHint));
  const longX = W >= D;
  const shortDepth = longX ? D : W;
  const Pc = (u) => longX ? [b.x + W * u, b.y + D / 2] : [b.x + W / 2, b.y + D * u]; // centreline point
  const blockAt = (u, al, ac, za, zb, top, wall) => {
    const [cx, cy] = Pc(u), w = longX ? al : ac, d = longX ? ac : al;
    box(cx - w / 2, cy - d / 2, w, d, za, zb, top, wall);
  };

  // dome / drum / finial helpers (centred on a [x,y] point)
  const NF = 24;
  const ring = (ox, oy, r, z) => Array.from({ length: NF }, (_, i) => { const a = (i / NF) * 2 * Math.PI; return [ox + Math.cos(a) * r, oy + Math.sin(a) * r, z]; });
  const band = (lo, hi, tint) => { for (let i = 0; i < NF; i++) { const j = (i + 1) % NF; lit([lo[i], lo[j], hi[j], hi[i]], tint); } };
  const drum = (ox, oy, r, zb, h, tint) => band(ring(ox, oy, r, z0 + zb), ring(ox, oy, r, z0 + zb + h), tint);
  const dome = (ox, oy, r, zb) => {
    const steps = 8;
    let prev = ring(ox, oy, r, z0 + zb);
    for (let k = 1; k <= steps; k++) {
      const a = (k / steps) * (Math.PI / 2), tint = k > steps * 0.6 ? pal.domeLight : pal.dome;
      if (k === steps) { const apex = [ox, oy, z0 + zb + r]; for (let i = 0; i < NF; i++) lit([prev[i], prev[(i + 1) % NF], apex, apex], pal.domeLight); }
      else { const cur = ring(ox, oy, r * Math.cos(a), z0 + zb + r * Math.sin(a)); band(prev, cur, tint); prev = cur; }
    }
  };
  const finial = (ox, oy, zb, h) => {
    drum(ox, oy, h * 0.16, zb, h * 0.6, pal.trim);
    const ap = ring(ox, oy, h * 0.16, z0 + zb + h * 0.6), top = [ox, oy, z0 + zb + h];
    for (let i = 0; i < NF; i++) lit([ap[i], ap[(i + 1) % NF], top, top], pal.trim);
  };

  // ── terrace podium + long base building + cornice ──
  box(b.x, b.y, W, D, 0, SHORT * 0.04, pal.step, pal.wallShadow);
  const baseZ = SHORT * 0.04, bm = SHORT * 0.06;
  box(b.x + bm, b.y + bm, W - 2 * bm, D - 2 * bm, baseZ, baseZ + SHORT * 0.30, pal.wallLight, pal.wall);
  const baseTop = baseZ + SHORT * 0.30;
  box(b.x + bm * 0.6, b.y + bm * 0.6, W - 1.2 * bm, D - 1.2 * bm, baseTop, baseTop + SHORT * 0.03, pal.wallLight, pal.wallShadow);
  const corn = baseTop + SHORT * 0.03;

  // ── Art Deco vertical pilaster rhythm on the two long faces ──
  const inMinX = b.x + bm, inMaxX = b.x + W - bm, inMinY = b.y + bm, inMaxY = b.y + D - bm, eps = SHORT * 0.004;
  const nP = longX ? 16 : 9;
  for (let i = 1; i < nP; i++) {
    const f = i / nP, zlo = z0 + baseZ + SHORT * 0.03, zhi = z0 + baseTop - SHORT * 0.02, hw = SHORT * 0.012;
    if (longX) {
      const x = inMinX + (inMaxX - inMinX) * f;
      lit([[x - hw, inMinY - eps, zlo], [x + hw, inMinY - eps, zlo], [x + hw, inMinY - eps, zhi], [x - hw, inMinY - eps, zhi]], pal.wallShadow);
      lit([[x - hw, inMaxY + eps, zlo], [x + hw, inMaxY + eps, zlo], [x + hw, inMaxY + eps, zhi], [x - hw, inMaxY + eps, zhi]], pal.wallShadow);
    } else {
      const y = inMinY + (inMaxY - inMinY) * f;
      lit([[inMinX - eps, y - hw, zlo], [inMinX - eps, y + hw, zlo], [inMinX - eps, y + hw, zhi], [inMinX - eps, y - hw, zhi]], pal.wallShadow);
      lit([[inMaxX + eps, y - hw, zlo], [inMaxX + eps, y + hw, zlo], [inMaxX + eps, y + hw, zhi], [inMaxX + eps, y - hw, zhi]], pal.wallShadow);
    }
  }

  // ── central pavilion + great dome ──
  const rC = shortDepth * 0.30;
  blockAt(0.5, SHORT * 0.62, shortDepth * 0.86, corn, corn + SHORT * 0.16, pal.wallLight, pal.wall);
  const cBlk = corn + SHORT * 0.16;
  drum(...Pc(0.5), rC, cBlk, SHORT * 0.08, pal.wallLight);
  const cDrumTop = cBlk + SHORT * 0.08;
  dome(...Pc(0.5), rC, cDrumTop);
  finial(...Pc(0.5), cDrumTop + rC, SHORT * 0.13);

  // ── two end pavilions + smaller domes ──
  const rE = shortDepth * 0.19, uEnd = 0.13;
  for (const u of [uEnd, 1 - uEnd]) {
    blockAt(u, SHORT * 0.46, shortDepth * 0.72, corn, corn + SHORT * 0.10, pal.wallLight, pal.wall);
    const eBlk = corn + SHORT * 0.10;
    drum(...Pc(u), rE, eBlk, SHORT * 0.05, pal.wallLight);
    const eDrumTop = eBlk + SHORT * 0.05;
    dome(...Pc(u), rE, eDrumTop);
    finial(...Pc(u), eDrumTop + rE, SHORT * 0.07);
  }

  return faces;
}

// ── primitive: WASHINGTON MONUMENT ──────────────────────────────────────────────
// A tall, slender tapered obelisk (≈ 10:1) with a pyramidion cap, the famous two-
// tone marble band where construction paused, a row of small observation windows
// near the shaft top, and a low base terrace. Real quad geometry (tapered frustum).
const WASHINGTON_PALETTE = {
  stone: '#dcd7cb',       // upper marble
  stoneLight: '#ece7db',  // sunlit pyramidion
  stoneLow: '#c1b9a6',    // lower third — the slightly darker construction-pause band
  window: '#2c343c',
};

function washingtonMonumentBuilding(b, { L, camHint, cityBox }) {
  const pal = { ...WASHINGTON_PALETTE, ...(b.landmarkPalette || {}) };
  const faces = [];
  const { lit } = makeFaceKit({ faces, L, camHint });
  const z0 = b.z0, W = b.w, D = b.d, SHORT = Math.min(W, D);
  const cx = b.x + W / 2, cy = b.y + D / 2;

  const H = SHORT * 6.0;
  const shaftTop = H * 0.9, baseHalf = SHORT * 0.46, topHalf = baseHalf * 0.62;
  const halfAt = (z) => baseHalf + (topHalf - baseHalf) * (z / shaftTop);
  const c = (hx, hy, zoff) => [cx + hx, cy + hy, z0 + zoff];

  // ── low base terrace ──
  faces.push(...cityBox({ x: b.x, y: b.y, w: W, d: D }, z0, z0 + SHORT * 0.18, { top: pal.stoneLight, side: pal.stoneLow }, L, camHint));

  // ── tapered shaft (two-tone) ──
  const shaftSeg = (za, zb, tint) => {
    const ha = halfAt(za), hb = halfAt(zb);
    lit([c(ha, -ha, za), c(ha, ha, za), c(hb, hb, zb), c(hb, -hb, zb)], tint);     // +x
    lit([c(-ha, ha, za), c(-ha, -ha, za), c(-hb, -hb, zb), c(-hb, hb, zb)], tint); // -x
    lit([c(ha, ha, za), c(-ha, ha, za), c(-hb, hb, zb), c(hb, hb, zb)], tint);     // +y
    lit([c(-ha, -ha, za), c(ha, -ha, za), c(hb, -hb, zb), c(-hb, -hb, zb)], tint); // -y
  };
  const splitZ = shaftTop * 0.3;
  shaftSeg(0, splitZ, pal.stoneLow);
  shaftSeg(splitZ, shaftTop, pal.stone);

  // ── pyramidion ──
  const ap = [cx, cy, z0 + H], hp = topHalf;
  lit([c(hp, -hp, shaftTop), c(hp, hp, shaftTop), ap, ap], pal.stoneLight);
  lit([c(-hp, hp, shaftTop), c(-hp, -hp, shaftTop), ap, ap], pal.stone);
  lit([c(hp, hp, shaftTop), c(-hp, hp, shaftTop), ap, ap], pal.stoneLight);
  lit([c(-hp, -hp, shaftTop), c(hp, -hp, shaftTop), ap, ap], pal.stone);

  // ── observation windows near the shaft top ──
  const zw = shaftTop * 0.965, hw = halfAt(zw) + SHORT * 0.008, s = topHalf * 0.18;
  for (const [nx, ny] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const tx = -ny, ty = nx, ox = cx + nx * hw, oy = cy + ny * hw;
    lit([[ox - tx * s, oy - ty * s, z0 + zw - s], [ox + tx * s, oy + ty * s, z0 + zw - s], [ox + tx * s, oy + ty * s, z0 + zw + s], [ox - tx * s, oy - ty * s, z0 + zw + s]], pal.window);
  }

  return faces;
}

// ── primitive: PARLIAMENT HILL — CENTRE BLOCK ───────────────────────────────────
// Canada's Centre Block: the Peace Tower (a tall Gothic Revival clock tower with a
// steep verdigris-copper spire and four corner pinnacles) rising from the middle of
// two symmetric Nepean-sandstone wings under steep copper gable roofs, with end
// pavilions. Real quad geometry (gable roofs, square pyramids via the apex trick).
const PARLIAMENT_PALETTE = {
  stone: '#cdbfa3',
  stoneLight: '#ddd0b6',
  stoneShadow: '#9f9176',
  roof: '#5f8f7f',        // verdigris copper
  roofLight: '#79a594',
  roofDark: '#3f6357',
  trim: '#7d7256',
  clock: '#2a2f33',
  clockFace: '#d8d2c2',
  flag: '#b9322f',
};

function parliamentHillBuilding(b, { L, camHint, cityBox }) {
  const pal = { ...PARLIAMENT_PALETTE, ...(b.landmarkPalette || {}) };
  const faces = [];
  const { lit } = makeFaceKit({ faces, L, camHint });
  const z0 = b.z0, W = b.w, D = b.d, SHORT = Math.min(W, D);
  const box = (x, y, w, d, za, zb, top = pal.stoneLight, wall = pal.stone) =>
    faces.push(...cityBox({ x, y, w, d }, z0 + za, z0 + zb, { top, side: wall }, L, camHint));
  const longX = W >= D;
  const shortDepth = longX ? D : W;
  const P = (u, v) => longX ? [b.x + W * u, b.y + D * v] : [b.x + W * v, b.y + D * u]; // u along-long, v across
  const at = (uv, zoff) => [uv[0], uv[1], z0 + zoff];
  const Pc = (u) => P(u, 0.5);
  const blockAt = (u, al, ac, za, zb, top, wall) => {
    const [px, py] = Pc(u), w = longX ? al : ac, d = longX ? ac : al;
    box(px - w / 2, py - d / 2, w, d, za, zb, top, wall);
  };
  const pyramid = (px, py, half, zb, h, tintA, tintB) => {
    const ap = [px, py, z0 + zb + h], k = (sx, sy) => [px + sx * half, py + sy * half, z0 + zb];
    lit([k(1, -1), k(1, 1), ap, ap], tintA); lit([k(-1, 1), k(-1, -1), ap, ap], tintB);
    lit([k(1, 1), k(-1, 1), ap, ap], tintA); lit([k(-1, -1), k(1, -1), ap, ap], tintB);
  };
  const gable = (u0, u1, zE, h, endU0, endU1) => {
    const ridge = zE + h;
    lit([at(P(u0, 0), zE), at(P(u1, 0), zE), at(P(u1, 0.5), ridge), at(P(u0, 0.5), ridge)], pal.roofLight);
    lit([at(P(u0, 1), zE), at(P(u1, 1), zE), at(P(u1, 0.5), ridge), at(P(u0, 0.5), ridge)], pal.roof);
    if (endU0) lit([at(P(u0, 0), zE), at(P(u0, 1), zE), at(P(u0, 0.5), ridge), at(P(u0, 0.5), ridge)], pal.stone);
    if (endU1) lit([at(P(u1, 0), zE), at(P(u1, 1), zE), at(P(u1, 0.5), ridge), at(P(u1, 0.5), ridge)], pal.stone);
  };

  // ── wings: long sandstone body + stringcourse + steep copper gable roofs ──
  const wallH = SHORT * 0.5, em = SHORT * 0.04, roofH = SHORT * 0.4;
  box(b.x + em, b.y + em, W - 2 * em, D - 2 * em, 0, wallH, pal.stoneLight, pal.stone);
  box(b.x + em * 0.5, b.y + em * 0.5, W - em, D - em, wallH, wallH + SHORT * 0.03, pal.stoneLight, pal.stoneShadow);
  const eaveZ = wallH + SHORT * 0.03;
  const tHalf = shortDepth * 0.23;
  const tuHalf = tHalf / (longX ? W : D);
  gable(0.04, 0.5 - tuHalf, eaveZ, roofH, true, false);
  gable(0.5 + tuHalf, 0.96, eaveZ, roofH, false, true);

  // ── end pavilions with pyramid roofs ──
  for (const u of [0.085, 0.915]) {
    const pavTop = wallH + SHORT * 0.16;
    blockAt(u, shortDepth * 0.5, shortDepth * 0.92, 0, pavTop, pal.stoneLight, pal.stone);
    pyramid(...Pc(u), shortDepth * 0.25, pavTop, SHORT * 0.46, pal.roofLight, pal.roof);
  }

  // ── Art Deco-less Gothic verticality on the long faces (buttress strips) ──
  const inMinX = b.x + em, inMaxX = b.x + W - em, inMinY = b.y + em, inMaxY = b.y + D - em, eps = SHORT * 0.004;
  const nP = longX ? 18 : 8;
  for (let i = 1; i < nP; i++) {
    const f = i / nP, zlo = z0 + SHORT * 0.06, zhi = z0 + wallH - SHORT * 0.03, hw = SHORT * 0.014;
    if (longX) {
      const x = inMinX + (inMaxX - inMinX) * f;
      lit([[x - hw, inMinY - eps, zlo], [x + hw, inMinY - eps, zlo], [x + hw, inMinY - eps, zhi], [x - hw, inMinY - eps, zhi]], pal.stoneShadow);
      lit([[x - hw, inMaxY + eps, zlo], [x + hw, inMaxY + eps, zlo], [x + hw, inMaxY + eps, zhi], [x - hw, inMaxY + eps, zhi]], pal.stoneShadow);
    } else {
      const y = inMinY + (inMaxY - inMinY) * f;
      lit([[inMinX - eps, y - hw, zlo], [inMinX - eps, y + hw, zlo], [inMinX - eps, y + hw, zhi], [inMinX - eps, y - hw, zhi]], pal.stoneShadow);
      lit([[inMaxX + eps, y - hw, zlo], [inMaxX + eps, y + hw, zlo], [inMaxX + eps, y + hw, zhi], [inMaxX + eps, y - hw, zhi]], pal.stoneShadow);
    }
  }

  // ── Peace Tower ──
  const [tx, ty] = Pc(0.5), tShaftTop = SHORT * 2.05;
  box(tx - tHalf, ty - tHalf, tHalf * 2, tHalf * 2, 0, tShaftTop, pal.stoneLight, pal.stone);
  for (const [nx, ny] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { // buttress ribs + clock face
    const txn = -ny, tyn = nx, off = tHalf + eps;
    for (const o of [-0.62, 0, 0.62]) {
      const ox = tx + nx * off + txn * o * tHalf, oy = ty + ny * off + tyn * o * tHalf, rw = SHORT * 0.02;
      lit([[ox - txn * rw, oy - tyn * rw, z0 + SHORT * 0.08], [ox + txn * rw, oy + tyn * rw, z0 + SHORT * 0.08], [ox + txn * rw, oy + tyn * rw, z0 + tShaftTop * 0.7], [ox - txn * rw, oy - tyn * rw, z0 + tShaftTop * 0.7]], pal.stoneShadow);
    }
    const czc = tShaftTop * 0.83, cf = tHalf * 0.6, ci = cf * 0.66, o1 = tHalf + eps * 1.5, o2 = tHalf + eps * 2.5;
    const fx = tx + nx * o1, fy = ty + ny * o1, dx = tx + nx * o2, dy = ty + ny * o2;
    lit([[fx - txn * cf, fy - tyn * cf, z0 + czc - cf], [fx + txn * cf, fy + tyn * cf, z0 + czc - cf], [fx + txn * cf, fy + tyn * cf, z0 + czc + cf], [fx - txn * cf, fy - tyn * cf, z0 + czc + cf]], pal.clockFace);
    lit([[dx - txn * ci, dy - tyn * ci, z0 + czc - ci], [dx + txn * ci, dy + tyn * ci, z0 + czc - ci], [dx + txn * ci, dy + tyn * ci, z0 + czc + ci], [dx - txn * ci, dy - tyn * ci, z0 + czc + ci]], pal.clock);
  }
  box(tx - tHalf * 1.06, ty - tHalf * 1.06, tHalf * 2.12, tHalf * 2.12, tShaftTop, tShaftTop + SHORT * 0.05, pal.stoneLight, pal.stoneShadow); // cornice
  const corT = tShaftTop + SHORT * 0.05;
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { // corner pinnacles
    const px = tx + sx * tHalf * 0.9, py = ty + sy * tHalf * 0.9, ph = tHalf * 0.2;
    box(px - ph, py - ph, ph * 2, ph * 2, corT, corT + SHORT * 0.2, pal.stoneLight, pal.stone);
    pyramid(px, py, ph * 1.1, corT + SHORT * 0.2, SHORT * 0.28, pal.roof, pal.roofDark);
  }
  pyramid(tx, ty, tHalf * 0.92, corT, SHORT * 1.0, pal.roofLight, pal.roof); // steep spire
  const apexZ = corT + SHORT * 1.0;
  box(tx - SHORT * 0.012, ty - SHORT * 0.012, SHORT * 0.024, SHORT * 0.024, apexZ, apexZ + SHORT * 0.26, pal.trim, pal.trim); // flagpole
  const fz = apexZ + SHORT * 0.22;
  lit([[tx, ty, z0 + fz], [tx + (longX ? SHORT * 0.13 : 0), ty + (longX ? 0 : SHORT * 0.13), z0 + fz], [tx + (longX ? SHORT * 0.13 : 0), ty + (longX ? 0 : SHORT * 0.13), z0 + fz - SHORT * 0.08], [tx, ty, z0 + fz - SHORT * 0.08]], pal.flag);

  return faces;
}

// ── primitive: MOBILE EDM HALL ──────────────────────────────────────────────────
// Promoted from the assembler study: tank treads under a square socket-base, a
// large paneled spherical hull, a small eye sphere, a front train-head cockpit,
// and a short forward E/fork prong assembly.
const MOBILE_EDM_HALL_PALETTE = {
  track: '#20242b',
  wheel: '#7d8792',
  base: '#596471',
  socket: '#11131b',
  rim: '#9aa3ad',
  hull: '#c9cdd1',
  panel: '#8f98a3',
  panelLight: '#dfe2e5',
  cockpit: '#6f7b87',
  cockpitDark: '#2e3540',
  glass: '#1b2938',
  light: '#ffeaa0',
  eye: '#56a8d8',
  pupil: '#10131a',
  prong: '#e2e7eb',
};

function mobileEdmHallBuilding(b, { L, camHint, cityBox }) {
  const pal = { ...MOBILE_EDM_HALL_PALETTE, ...(b.landmarkPalette || {}) };
  const faces = [];
  const { lit } = makeFaceKit({ faces, L, camHint });
  const cx = b.x + b.w / 2, cy = b.y + b.d / 2, z0 = b.z0;
  const side = Math.min(b.w, b.d);
  const box = (x, y, w, d, za, zb, top, wall = top) =>
    faces.push(...cityBox({ x: cx + x - w / 2, y: cy + y - d / 2, w, d }, z0 + za, z0 + zb, { top, side: wall }, L, camHint));

  const ring = (ox, oy, r, z, n = 32) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [ox + Math.cos(a) * r, oy + Math.sin(a) * r, z];
  });
  const band = (lo, hi, tint) => {
    for (let i = 0; i < lo.length; i += 1) {
      const j = (i + 1) % lo.length;
      lit([lo[i], lo[j], hi[j], hi[i]], tint);
    }
  };
  const sphere = (ox, oy, oz, r, tint, n = 36) => {
    const steps = 14;
    let prev = null;
    for (let k = 0; k <= steps; k += 1) {
      const v = -Math.PI / 2 + (k / steps) * Math.PI;
      const rr = Math.cos(v) * r;
      const z = oz + Math.sin(v) * r;
      const pts = Math.abs(rr) < 1e-4 ? null : ring(ox, oy, rr, z, n);
      if (prev && pts) band(prev, pts, tint);
      if (prev && !pts) {
        const apex = [ox, oy, z];
        for (let i = 0; i < prev.length; i += 1) lit([prev[i], prev[(i + 1) % prev.length], apex, apex], tint);
      }
      if (pts) prev = pts;
    }
  };
  const tube = (a, c, r0, r1, tint, n = 8) => {
    const axis = sub(c, a);
    const w = norm(axis);
    const ref = Math.abs(w[2]) > 0.88 ? [1, 0, 0] : [0, 0, 1];
    const u = norm(cross(w, ref));
    const v = norm(cross(w, u));
    const mk = (p, r) => Array.from({ length: n }, (_, i) => {
      const t = (i / n) * Math.PI * 2;
      return add(p, add(scale(u, Math.cos(t) * r), scale(v, Math.sin(t) * r)));
    });
    band(mk(a, r0), mk(c, r1), tint);
  };
  const polyTube = (pts, r0, r1, tint) => {
    for (let i = 0; i < pts.length - 1; i += 1) {
      const t0 = i / (pts.length - 1), t1 = (i + 1) / (pts.length - 1);
      tube(pts[i], pts[i + 1], r0 + (r1 - r0) * t0, r0 + (r1 - r0) * t1, tint);
    }
  };
  const q = (p0, p1, p2, t) => {
    const u = 1 - t;
    return [
      u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
      u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
      u * u * p0[2] + 2 * u * t * p1[2] + t * t * p2[2],
    ];
  };
  const curve = (p0, p1, p2, steps = 8) => Array.from({ length: steps + 1 }, (_, i) => q(p0, p1, p2, i / steps));

  // Under-square treads and square socket base.
  const trackW = side * 0.12, trackD = side * 0.86, trackGap = side * 0.25;
  box(-trackGap, 0, trackW, trackD, 0, side * 0.08, pal.track);
  box(trackGap, 0, trackW, trackD, 0, side * 0.08, pal.track);
  for (const sx of [-1, 1]) for (let i = -3; i <= 3; i += 1) {
    const wy = i * side * 0.105;
    tube([cx + sx * trackGap, cy + wy, z0 + side * 0.02], [cx + sx * trackGap, cy + wy, z0 + side * 0.16], side * 0.045, side * 0.045, pal.wheel, 16);
  }
  const baseTop = side * 0.28;
  box(0, 0, side * 0.72, side * 0.72, side * 0.16, baseTop, pal.base);
  band(ring(cx, cy, side * 0.3, z0 + baseTop + side * 0.004, 48), ring(cx, cy, side * 0.33, z0 + baseTop + side * 0.035, 48), pal.rim);
  band(ring(cx, cy, side * 0.25, z0 + baseTop + side * 0.006, 48), ring(cx, cy, side * 0.25, z0 + baseTop + side * 0.012, 48), pal.socket);

  // Spherical hull, raised panel framing, and small eye.
  const hullR = side * 0.4;
  const hullZ = z0 + side * 0.58;
  sphere(cx, cy, hullZ, hullR, pal.hull, 40);
  for (const dz of [-0.62, -0.42, -0.22, 0, 0.22, 0.42, 0.62]) {
    const z = hullZ + dz * hullR;
    const rr = Math.sqrt(Math.max(0, hullR * hullR - (z - hullZ) ** 2));
    band(ring(cx, cy, rr, z - side * 0.004, 48), ring(cx, cy, rr, z + side * 0.004, 48), dz === 0 ? pal.panelLight : pal.panel);
  }
  for (let i = 0; i < 18; i += 1) {
    const a = (i / 18) * Math.PI * 2;
    const pts = [];
    for (let k = -5; k <= 5; k += 1) {
      const dz = (k / 6) * hullR;
      const rr = Math.sqrt(Math.max(0, hullR * hullR - dz * dz));
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, hullZ + dz]);
    }
    polyTube(pts, side * 0.004, side * 0.004, i % 3 === 0 ? pal.panelLight : pal.panel);
  }
  const eyeR = hullR * 0.2;
  const eyeZ = hullZ + hullR + eyeR * 0.85;
  sphere(cx, cy, eyeZ, eyeR, pal.hull, 24);
  tube([cx, cy - eyeR * 1.05, eyeZ], [cx, cy - eyeR * 1.22, eyeZ], eyeR * 0.56, eyeR * 0.56, pal.eye, 24);
  tube([cx, cy - eyeR * 1.24, eyeZ], [cx, cy - eyeR * 1.34, eyeZ], eyeR * 0.24, eyeR * 0.24, pal.pupil, 18);

  // Front cockpit on the square base.
  const frontY = -side * 0.45;
  box(0, -side * 0.33, side * 0.34, side * 0.18, side * 0.2, side * 0.36, pal.cockpit, pal.cockpitDark);
  box(0, frontY, side * 0.24, side * 0.12, side * 0.18, side * 0.28, pal.cockpit);
  box(0, frontY - side * 0.04, side * 0.18, side * 0.035, side * 0.3, side * 0.35, pal.glass);
  for (const x of [-side * 0.08, side * 0.08]) tube([cx + x, cy + frontY - side * 0.08, z0 + side * 0.245], [cx + x, cy + frontY - side * 0.11, z0 + side * 0.245], side * 0.025, side * 0.025, pal.light, 16);

  // Shortened top-down E/fork prongs centered on the hull.
  const fy = cy - hullR * 0.98, zc = hullZ;
  tube([cx - side * 0.25, cy + side * 0.08, zc], [cx + side * 0.25, cy + side * 0.08, zc], side * 0.014, side * 0.011, pal.prong);
  polyTube(curve([cx - side * 0.2, cy + side * 0.08, zc], [cx - side * 0.36, cy - side * 0.04, zc], [cx - side * 0.34, fy, zc]), side * 0.02, side * 0.006, pal.prong);
  polyTube(curve([cx + side * 0.2, cy + side * 0.08, zc], [cx + side * 0.36, cy - side * 0.04, zc], [cx + side * 0.34, fy, zc]), side * 0.02, side * 0.006, pal.prong);
  polyTube(curve([cx, cy + side * 0.08, zc], [cx, cy - side * 0.08, zc], [cx, cy - side * 0.36, zc]), side * 0.022, side * 0.007, scaleHex(pal.prong, 1.08));
  return faces;
}

// ── primitive: EIFFEL TOWER ─────────────────────────────────────────────────────────
// A wrought-iron lattice pylon: four splayed corner legs that curve inward through the
// first platform, merge into a single tapering square-section lattice shaft at the second
// platform, and rise to a slender top deck + antenna. Built as a SQUARE lattice — four
// corner CHORDS following a height-varying half-width profile, horizontal BELTS, X-braces
// per face per bay (the open ironwork), the iconic see-through ARCH under the first
// platform, and three observation DECKS. Distilled from skytreeBuilding (lattice chords/
// braces) + arcDeTriompheBuilding (see-through arch). Proportions locked from the assembler
// blockout against the real tower (base 125 m; platforms at 57 / 115 / 276 m; tip 330 m):
// first deck 0.17·H, second 0.35·H, top deck 0.84·H, tip 1.0·H, base half-width 0.42·S.
// Deterministic (no rng) like every other landmark.
const EIFFEL_PALETTE = {
  iron: '#6f5a42', ironLight: '#8a7355', ironShadow: '#4d3f2e',
  deck: '#7d6a50', deckTop: '#95825f',
};

function eiffelTowerBuilding(b, { L, camHint, cityBox }) {
  const pal = { ...EIFFEL_PALETTE, ...(b.landmarkPalette || {}) };
  const faces = [];
  const { lit } = makeFaceKit({ faces, L, camHint });
  const cx = b.x + b.w / 2, cy = b.y + b.d / 2, z0 = b.z0;
  const S = Math.min(b.w, b.d);
  const H = S * 2.64;

  // crossed-billboard beam: two perpendicular ribbons through A→B read as a solid angle-iron
  // member from any vantage (robust for vertical chords where a single billboard degenerates).
  const beam = (A, B, w, tint) => {
    const d = sub(B, A);
    let u = cross(d, [0, 0, 1]);
    if (len(u) < 1e-6) u = [1, 0, 0];
    u = scale(norm(u), w);
    const v = scale(norm(cross(d, u)), w);
    lit([add(A, u), sub(A, u), sub(B, u), add(B, u)], tint);
    lit([add(A, v), sub(A, v), sub(B, v), add(B, v)], tint);
  };

  // half-width profile (fraction of S) vs height fraction u∈[0,1] — the flared silhouette.
  const PROFILE = [[0, 0.42], [0.06, 0.35], [0.17, 0.265], [0.35, 0.105], [0.55, 0.064], [0.84, 0.036], [0.92, 0.024], [1, 0.006]];
  const hwAt = (uu) => {
    const t = Math.max(0, Math.min(1, uu));
    for (let i = 1; i < PROFILE.length; i += 1) {
      if (t <= PROFILE[i][0]) {
        const [u0, r0] = PROFILE[i - 1], [u1, r1] = PROFILE[i];
        return S * (r0 + (r1 - r0) * ((t - u0) / (u1 - u0 || 1)));
      }
    }
    return S * PROFILE[PROFILE.length - 1][1];
  };
  const cornerPt = (sx, sy, uu) => [cx + sx * hwAt(uu), cy + sy * hwAt(uu), z0 + uu * H];
  const CS = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  const uP1 = 0.17, uP2 = 0.35, uTop = 0.84, uAnt = 0.90;

  // ── four corner chords (legs below, shaft above), sampled along the flared profile ──
  const chordW = (uu) => S * (0.020 * (1 - uu) + 0.0045);
  const NSEG = 26;
  for (const [sx, sy] of CS) {
    let prev = cornerPt(sx, sy, 0);
    for (let i = 1; i <= NSEG; i += 1) {
      const uu = (i / NSEG) * uAnt;
      const cur = cornerPt(sx, sy, uu);
      beam(prev, cur, chordW(uu), i % 2 ? pal.iron : pal.ironLight);
      prev = cur;
    }
  }

  // ── horizontal belts: square rings tying the four corners at chosen levels ──
  const beltU = [0.05, 0.10, uP1, 0.25, uP2, 0.45, 0.55, 0.68, 0.76, uTop, uAnt];
  for (const uu of beltU) {
    const ring = CS.map(([sx, sy]) => cornerPt(sx, sy, uu));
    for (let i = 0; i < 4; i += 1) beam(ring[i], ring[(i + 1) % 4], S * 0.006, pal.ironShadow);
  }

  // ── X-braces per face per bay: the open ironwork that fills the legs and shaft ──
  for (let k = 0; k < beltU.length - 1; k += 1) {
    const lo = beltU[k], hi = beltU[k + 1];
    for (let i = 0; i < 4; i += 1) {
      const [ax, ay] = CS[i], [bx, by] = CS[(i + 1) % 4];
      beam(cornerPt(ax, ay, lo), cornerPt(bx, by, hi), S * 0.004, pal.iron);
      beam(cornerPt(bx, by, lo), cornerPt(ax, ay, hi), S * 0.004, pal.iron);
    }
  }

  // ── the see-through arch under the first platform, one graceful rib per face ──
  const archBaseU = 0.045, archApex = z0 + uP1 * H * 0.92, NA = 16;
  for (let i = 0; i < 4; i += 1) {
    const [ax, ay] = CS[i], [bx, by] = CS[(i + 1) % 4];
    const Pl = cornerPt(ax, ay, archBaseU), Pr = cornerPt(bx, by, archBaseU);
    let prev = Pl;
    for (let j = 1; j <= NA; j += 1) {
      const t = j / NA;
      const cur = [Pl[0] + (Pr[0] - Pl[0]) * t, Pl[1] + (Pr[1] - Pl[1]) * t, Pl[2] + (archApex - Pl[2]) * Math.sin(Math.PI * t)];
      beam(prev, cur, S * 0.009, pal.ironLight);
      prev = cur;
    }
  }

  // ── three observation decks (slabs slightly wider than the lattice at that height) ──
  const deck = (uu, padFrac, th) => {
    const pw = hwAt(uu) * 1.18 + S * padFrac, zc = z0 + uu * H;
    faces.push(...cityBox({ x: cx - pw, y: cy - pw, w: pw * 2, d: pw * 2 }, zc - th, zc + th, { top: pal.deckTop, side: pal.deck }, L, camHint));
  };
  deck(uP1, 0.05, S * 0.022);
  deck(uP2, 0.03, S * 0.018);
  deck(uTop, 0.02, S * 0.02);

  // ── antenna mast above the top deck to the tip ──
  beam([cx, cy, z0 + uTop * H], [cx, cy, z0 + uAnt * H], S * 0.012, pal.ironLight);
  beam([cx, cy, z0 + uAnt * H], [cx, cy, z0 + H], S * 0.006, pal.ironLight);

  return faces;
}

// ─── Tokyo Tower ──────────────────────────────────────────────────────────────
// Tokyo's 1958 lattice tower — Eiffel's structural cousin, deliberately modelled on
// it, so this is a copy-adapt of eiffelTowerBuilding with four changes: a steeper,
// more slender PROFILE (taller shaft on a narrower base — real 333 m over an ≈88 m
// leg span, so 3.3·S vs Eiffel's 2.64), the signature international-orange / white
// AVIATION BANDING painted up the whole lattice (7 equal bands, both ends orange,
// per the regulation paint scheme), two observation decks instead of three (main
// deck ≈ 0.45·H / 150 m, top deck ≈ 0.75·H / 250 m), and NO grand see-through arch
// (Tokyo's legs are straight-braced, not arched). Deterministic (no rng) like every
// other landmark. Distilled from eiffelTowerBuilding (lattice chords/belts/braces).
const TOKYO_PALETTE = {
  orange: '#cf4a2a', orangeLight: '#e76a44', orangeShadow: '#97331a',
  white: '#e7e3da', whiteLight: '#f3f0ea', whiteShadow: '#b6b0a4',
  deck: '#c7c1b4', deckTop: '#dcd7cb',
};

function tokyoTowerBuilding(b, { L, camHint, cityBox }) {
  const pal = { ...TOKYO_PALETTE, ...(b.landmarkPalette || {}) };
  const faces = [];
  const { lit } = makeFaceKit({ faces, L, camHint });
  const cx = b.x + b.w / 2, cy = b.y + b.d / 2, z0 = b.z0;
  const S = Math.min(b.w, b.d);
  const H = S * 3.3;

  // crossed-billboard beam (see eiffelTowerBuilding): two perpendicular ribbons read
  // as a solid angle-iron member from any vantage, robust for vertical chords.
  const beam = (A, B, w, tint) => {
    const d = sub(B, A);
    let u = cross(d, [0, 0, 1]);
    if (len(u) < 1e-6) u = [1, 0, 0];
    u = scale(norm(u), w);
    const v = scale(norm(cross(d, u)), w);
    lit([add(A, u), sub(A, u), sub(B, u), add(B, u)], tint);
    lit([add(A, v), sub(A, v), sub(B, v), add(B, v)], tint);
  };

  // steeper/slenderer half-width profile than Eiffel — straighter legs, tall thin shaft.
  const PROFILE = [[0, 0.38], [0.08, 0.30], [0.20, 0.175], [0.45, 0.075], [0.75, 0.045], [0.88, 0.03], [1, 0.006]];
  const hwAt = (uu) => {
    const t = Math.max(0, Math.min(1, uu));
    for (let i = 1; i < PROFILE.length; i += 1) {
      if (t <= PROFILE[i][0]) {
        const [u0, r0] = PROFILE[i - 1], [u1, r1] = PROFILE[i];
        return S * (r0 + (r1 - r0) * ((t - u0) / (u1 - u0 || 1)));
      }
    }
    return S * PROFILE[PROFILE.length - 1][1];
  };
  const cornerPt = (sx, sy, uu) => [cx + sx * hwAt(uu), cy + sy * hwAt(uu), z0 + uu * H];
  const CS = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  const uMain = 0.45, uTop = 0.75, uAnt = 0.88;

  // aviation banding: 7 equal-height bands of international-orange / white up the tower,
  // both ends orange (regulation scheme). `even` picks the lit/shadow shade within a band.
  const NB = 7;
  const bandOrange = (uu) => Math.min(NB - 1, Math.floor(Math.max(0, Math.min(1, uu)) * NB)) % 2 === 0;
  const chordTint = (uu, even) => (bandOrange(uu)
    ? (even ? pal.orange : pal.orangeLight)
    : (even ? pal.white : pal.whiteLight));
  const beltTint = (uu) => (bandOrange(uu) ? pal.orangeShadow : pal.whiteShadow);
  const braceTint = (uu) => (bandOrange(uu) ? pal.orange : pal.white);

  // ── four corner chords (legs below, slender shaft above), banded along the profile ──
  const chordW = (uu) => S * (0.020 * (1 - uu) + 0.0045);
  const NSEG = 28;
  for (const [sx, sy] of CS) {
    let prev = cornerPt(sx, sy, 0);
    for (let i = 1; i <= NSEG; i += 1) {
      const uu = (i / NSEG) * uAnt;
      const cur = cornerPt(sx, sy, uu);
      beam(prev, cur, chordW(uu), chordTint(uu, i % 2 === 0));
      prev = cur;
    }
  }

  // ── horizontal belts: square rings tying the four corners, shaded by their band ──
  const beltU = [0.05, 0.11, 0.20, 0.30, uMain, 0.55, 0.65, uTop, 0.82, uAnt];
  for (const uu of beltU) {
    const ring = CS.map(([sx, sy]) => cornerPt(sx, sy, uu));
    for (let i = 0; i < 4; i += 1) beam(ring[i], ring[(i + 1) % 4], S * 0.006, beltTint(uu));
  }

  // ── X-braces per face per bay: the open banded ironwork filling legs and shaft ──
  for (let k = 0; k < beltU.length - 1; k += 1) {
    const lo = beltU[k], hi = beltU[k + 1], mid = (lo + hi) / 2;
    for (let i = 0; i < 4; i += 1) {
      const [ax, ay] = CS[i], [bx, by] = CS[(i + 1) % 4];
      beam(cornerPt(ax, ay, lo), cornerPt(bx, by, hi), S * 0.004, braceTint(mid));
      beam(cornerPt(bx, by, lo), cornerPt(ax, ay, hi), S * 0.004, braceTint(mid));
    }
  }

  // ── two observation decks (slabs slightly wider than the lattice at that height) ──
  const deck = (uu, padFrac, th) => {
    const pw = hwAt(uu) * 1.18 + S * padFrac, zc = z0 + uu * H;
    faces.push(...cityBox({ x: cx - pw, y: cy - pw, w: pw * 2, d: pw * 2 }, zc - th, zc + th, { top: pal.deckTop, side: pal.deck }, L, camHint));
  };
  deck(uMain, 0.05, S * 0.030); // big two-story main deck
  deck(uTop, 0.02, S * 0.018);  // smaller special observatory

  // ── antenna mast above the top deck to the tip ──
  beam([cx, cy, z0 + uTop * H], [cx, cy, z0 + uAnt * H], S * 0.012, pal.orangeLight);
  beam([cx, cy, z0 + uAnt * H], [cx, cy, z0 + H], S * 0.006, pal.whiteLight);

  return faces;
}

// ─── Empire State Building ────────────────────────────────────────────────────
// The 1931 Art Deco setback skyscraper: a wide five-story limestone base, a tall
// pier-and-spandrel SHAFT whose verticality reads as fine window pinstripes, a
// stack of ziggurat SETBACKS into a slender crown, the aluminium mooring MAST, and
// a thin antenna spire to the tip. Pure box massing (cityBox) + lit accent quads —
// no lattice/dome. Proportions from the real tower (381 m roof / 443 m tip over an
// ≈ 129×86 m base): the masses below are fractions of full footprint half-width and
// of overall H = 5·short side. Deterministic (no rng) like every other landmark.
const EMPIRE_PALETTE = {
  stone: '#cfc6b2', stoneTop: '#ded6c4', stoneShadow: '#a89e88',
  window: '#3a4048', mast: '#9aa0a6', crown: '#bcc3c9',
};

function empireStateBuilding(b, { L, camHint, cityBox }) {
  const pal = { ...EMPIRE_PALETTE, ...(b.landmarkPalette || {}) };
  const faces = [];
  const { lit } = makeFaceKit({ faces, L, camHint });
  const W = b.w, D = b.d, SHORT = Math.min(W, D), z0 = b.z0;
  const cx = b.x + W / 2, cy = b.y + D / 2;
  const H = SHORT * 5.0;

  // centered box from half-width fractions (of full W/D) and height fractions of H.
  const box = (fx, fy, uLo, uHi, side, top) => {
    const hx = fx * W, hy = fy * D;
    faces.push(...cityBox({ x: cx - hx, y: cy - hy, w: hx * 2, d: hy * 2 }, z0 + uLo * H, z0 + uHi * H, { top, side }, L, camHint));
  };

  // ── ziggurat massing: wide base → tall shaft → stepped crown setbacks ──
  const TIERS = [
    [0.50, 0.50, 0.00, 0.10],   // five-story lot-filling base
    [0.43, 0.45, 0.10, 0.16],   // base shoulder setback
    [0.34, 0.40, 0.16, 0.74],   // the main shaft (long vertical run)
    [0.27, 0.31, 0.74, 0.81],   // crown setback 1
    [0.21, 0.24, 0.81, 0.87],   // crown setback 2
    [0.16, 0.18, 0.87, 0.915],  // 86th-floor observatory deck
    [0.11, 0.12, 0.915, 0.95],  // Art Deco crown drum
  ];
  for (const [fx, fy, uLo, uHi] of TIERS) box(fx, fy, uLo, uHi, pal.stone, pal.stoneTop);

  // ── vertical window pinstripes: the pier-and-spandrel verticality on a face set ──
  const stripe = (axis, sign, fx, fy, uLo, uHi, n) => {
    const hx = fx * W, hy = fy * D, z1 = z0 + uLo * H, z2 = z0 + uHi * H;
    for (let i = 0; i < n; i += 1) {
      const t0 = -1 + (2 * (i + 0.3)) / n, t1 = -1 + (2 * (i + 0.7)) / n;
      if (axis === 'x') {
        const xx = cx + sign * (hx + W * 0.002), y0 = cy + t0 * hy, y1 = cy + t1 * hy;
        lit([[xx, y0, z1], [xx, y1, z1], [xx, y1, z2], [xx, y0, z2]], pal.window);
      } else {
        const yy = cy + sign * (hy + D * 0.002), x0 = cx + t0 * hx, x1 = cx + t1 * hx;
        lit([[x0, yy, z1], [x1, yy, z1], [x1, yy, z2], [x0, yy, z2]], pal.window);
      }
    }
  };
  // shaft (long run) and base get the pinstripes; shaft denser.
  for (const [axis, sign] of [['x', 1], ['x', -1], ['y', 1], ['y', -1]]) {
    stripe(axis, sign, 0.34, 0.40, 0.17, 0.735, 9);
    stripe(axis, sign, 0.50, 0.50, 0.02, 0.095, 11);
  }

  // ── aluminium mooring mast + antenna spire to the tip ──
  box(0.045, 0.05, 0.95, 0.982, pal.mast, pal.crown);   // mooring mast tower
  box(0.018, 0.02, 0.982, 0.992, pal.mast, pal.crown);  // mast cap
  box(0.006, 0.007, 0.992, 1.0, pal.crown, pal.crown);  // antenna spire

  return faces;
}

// ─── Gateway Arch (St. Louis) ─────────────────────────────────────────────────
// Saarinen's 1965 stainless-steel monument: a single soaring weighted-CATENARY arch,
// as wide as it is tall (real 192 m span = 192 m rise), built as a hollow TRIANGULAR
// tube that tapers from broad legs to a slim crown. Reuses the curve-sampling idiom
// of the Eiffel arch / Arc de Triomphe, but swaps the sin rib for a cosh centerline
// and extrudes an equilateral-triangle cross-section (flat face outward, apex inward)
// along it — the section nothing else in the set has. Deterministic (no rng).
const GATEWAY_PALETTE = {
  steel: '#b9bfc4', steelLight: '#d8dde0', steelDark: '#969ca2', footing: '#8b8f93',
};

function gatewayArchBuilding(b, { L, camHint, cityBox }) {
  const pal = { ...GATEWAY_PALETTE, ...(b.landmarkPalette || {}) };
  const faces = [];
  const { lit } = makeFaceKit({ faces, L, camHint });
  const W = b.w, D = b.d, SHORT = Math.min(W, D), LONG = Math.max(W, D), z0 = b.z0;
  const cx = b.x + W / 2, cy = b.y + D / 2;
  const alongX = W >= D;                       // the arch plane lies along the longer axis
  const span = LONG * 0.92;                    // distance between the two leg bases
  const apexH = span;                          // as-tall-as-wide

  // weighted catenary: height fraction over u∈[-1,1] (apex at u=0, bases at u=±1) — the
  // flattened-top, steep-legged inverted-cosh profile that reads unmistakably as the Arch.
  const A = 2.7, coshA = Math.cosh(A);
  const heightAt = (u) => apexH * (coshA - Math.cosh(A * u)) / (coshA - 1);
  const center = (u) => {
    const along = u * (span / 2), h = z0 + heightAt(u);
    return alongX ? [cx + along, cy, h] : [cx, cy + along, h];
  };

  // equilateral-triangle cross-section radius tapers ~3:1 from base legs to crown.
  const rBase = SHORT * 0.16, rApex = SHORT * 0.052;
  const rAt = (u) => rApex + (rBase - rApex) * Math.abs(u);
  const bAxis = alongX ? [0, 1, 0] : [1, 0, 0];  // horizontal out-of-plane axis
  // three section vertices: apex pointing inward (−n), flat face spanning outward (+n).
  const section = (u, T) => {
    const P = center(u), r = rAt(u);
    let n = cross(T, bAxis);
    if (len(n) < 1e-6) n = alongX ? [1, 0, 0] : [0, 1, 0];
    n = norm(n);
    return [
      add(P, scale(n, -r)),                                        // 0: inner apex
      add(add(P, scale(n, r * 0.5)), scale(bAxis, r * 0.866)),     // 1: outer +b
      add(add(P, scale(n, r * 0.5)), scale(bAxis, -r * 0.866)),    // 2: outer −b
    ];
  };

  // sample the centerline, build per-sample tangents (central difference), extrude the
  // triangular prism between successive sections as three lit quad strips.
  const NSEG = 46;
  const us = Array.from({ length: NSEG + 1 }, (_, i) => -1 + (2 * i) / NSEG);
  const pts = us.map(center);
  const tan = (i) => norm(sub(pts[Math.min(NSEG, i + 1)], pts[Math.max(0, i - 1)]));
  const secs = us.map((u, i) => section(u, tan(i)));
  const edgeTint = [pal.steel, pal.steelLight, pal.steelDark]; // edge 1 (out→out) is the bright flat face
  for (let i = 0; i < NSEG; i += 1) {
    const S0 = secs[i], S1 = secs[i + 1];
    for (let e = 0; e < 3; e += 1) {
      const f = (e + 1) % 3;
      lit([S0[e], S0[f], S1[f], S1[e]], edgeTint[e]);
    }
  }

  // squat footings grounding each leg base.
  for (const s of [-1, 1]) {
    const along = s * (span / 2), fr = rBase * 1.3, th = SHORT * 0.05;
    const fx = (alongX ? cx + along : cx), fy = (alongX ? cy : cy + along);
    faces.push(...cityBox({ x: fx - fr, y: fy - fr, w: fr * 2, d: fr * 2 }, z0, z0 + th, { top: pal.footing, side: pal.footing }, L, camHint));
  }

  return faces;
}

// ─── Cloud Gate / "The Bean" (Chicago) ────────────────────────────────────────
// Kapoor's 2006 mirror-polished blob: a squashed, elongated ELLIPSOID hugging the
// plaza, with a concave underside vaulting up to the central "omphalos" navel you
// walk under. No box/lattice — it's a stainless SURFACE of revolution-ish dome built
// from elliptical latitude rings (the Taj-dome / sphere idiom), plus an inverted
// concave under-shell rising from the rim to a high central navel. The mirror finish
// is faked as a vertical chrome gradient (reflected ground → steel → sky) across the
// rings, modulated by the usual lit() normal shading. Deterministic (no rng).
const BEAN_PALETTE = {
  sky: '#cdd9e4', steel: '#8b97a3', ground: '#566069', under: '#6c7682',
};

function cloudGateBuilding(b, { L, camHint }) {
  const pal = { ...BEAN_PALETTE, ...(b.landmarkPalette || {}) };
  const faces = [];
  const { lit } = makeFaceKit({ faces, L, camHint });
  const W = b.w, D = b.d, SHORT = Math.min(W, D), LONG = Math.max(W, D), z0 = b.z0;
  const cx = b.x + W / 2, cy = b.y + D / 2;
  const alongX = W >= D;
  const ax = (alongX ? LONG : SHORT) * 0.49;   // long horizontal half-axis
  const ay = (alongX ? SHORT : LONG) * 0.49;   // short horizontal half-axis
  const Ht = SHORT * 0.66;                      // distinctly flatter than wide — the squashed bean
  const zEq = z0 + Ht * 0.18, zTop = z0 + Ht, zNavel = z0 + Ht * 0.55;

  // linear hex blend — for the reflected-environment chrome gradient up the body.
  const mixHex = (h1, h2, t) => {
    const ch = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const a = ch(h1), c = ch(h2);
    return `#${a.map((v, i) => Math.round(v + (c[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
  };
  const mirrorTint = (z) => {
    const hf = Math.max(0, Math.min(1, (z - z0) / Ht));
    return hf < 0.5 ? mixHex(pal.ground, pal.steel, hf * 2) : mixHex(pal.steel, pal.sky, (hf - 0.5) * 2);
  };

  const Nr = 26;
  const eRing = (rx, ry, z) => Array.from({ length: Nr }, (_, i) => {
    const a = (i / Nr) * 2 * Math.PI;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, z];
  });
  const band = (r0, r1, tint) => { for (let i = 0; i < Nr; i += 1) { const j = (i + 1) % Nr; lit([r0[i], r0[j], r1[j], r1[i]], tint); } };

  // ── upper mirror shell: elliptical rings from the rim up to a rounded crown ──
  const NL = 14;
  let prev = eRing(ax, ay, zEq);
  for (let k = 1; k <= NL; k += 1) {
    const phi = (k / NL) * (Math.PI / 2), rs = Math.cos(phi);
    const z = zEq + (zTop - zEq) * Math.sin(phi);
    const ring = eRing(ax * rs, ay * rs, z);
    band(prev, ring, mirrorTint(z));
    prev = ring;
  }

  // ── concave underside: rises from the rim inward/up to the omphalos navel ──
  const NLu = 9;
  let prevU = eRing(ax, ay, zEq);
  for (let k = 1; k <= NLu; k += 1) {
    const s = (k / NLu) * (Math.PI / 2), rs = Math.cos(s);
    const z = zEq + (zNavel - zEq) * Math.sin(s);
    const ring = eRing(ax * rs, ay * rs, z);
    band(prevU, ring, mixHex(pal.under, pal.steel, (k / NLu) * 0.5));
    prevU = ring;
  }

  return faces;
}

// ─── Statue of Liberty ────────────────────────────────────────────────────────
// The 1886 copper colossus: a robed female figure on a tall granite pedestal, right
// arm raised with the TORCH, left arm cradling the TABLET, a seven-spike CROWN. The
// first landmark to drive the human-figure polygonizer (renderFigureWorldFrames) —
// a posed, robed figure comes out as z-up {corners,fill} faces; we luminance-remap
// every face to verdigris (preserving the baked form shading), scale it onto the
// pedestal, then graft on torch/crown/tablet attributes located off the placed
// figure's own geometry (raised hand = top vertex; head = top-of-center). The
// pedestal is stacked cityBox granite. Deterministic — the figure is rng-free.
const LIBERTY_PALETTE = {
  copper: '#5fa893', // verdigris patina (robe + skin, remapped)
  stone: '#b3aa99', stoneTop: '#cbc3b4', stoneShadow: '#8d8576', // pedestal granite
  torch: '#caa23e', flame: '#ffd45e', // gilded torch + flame
};

function statueOfLibertyBuilding(b, { L, camHint, cityBox }) {
  const pal = { ...LIBERTY_PALETTE, ...(b.landmarkPalette || {}) };
  const faces = [];
  const W = b.w, D = b.d, SHORT = Math.min(W, D), z0 = b.z0;
  const cx = b.x + W / 2, cy = b.y + D / 2;
  const H = SHORT * 3.0, pedH = H * 0.5, figSpan = H - pedH; // torch tip reaches ≈ H

  // ── pedestal: slim tapered granite die — narrow enough to suit the figure, with a
  // plinth foot and a cornice cap just wide enough to seat the figure's base. [fx, uLo, uHi] ──
  const TIERS = [
    [0.34, 0.00, 0.07], [0.27, 0.07, 0.14], [0.20, 0.14, 0.88], [0.25, 0.88, 1.00],
  ];
  for (const [fx, uLo, uHi] of TIERS) {
    const hx = fx * W, hy = fx * D;
    faces.push(...cityBox({ x: cx - hx, y: cy - hy, w: hx * 2, d: hy * 2 }, z0 + uLo * pedH, z0 + uHi * pedH,
      { top: pal.stoneTop, side: fx > 0.45 ? pal.stoneShadow : pal.stone }, L, camHint));
  }
  const pedTop = z0 + pedH;

  // ── the posed verdigris figure (robe + folded sash + crown + torch + tablet) ──
  // The reusable statue primitive returns the whole composition NORMALISED (feet at
  // z=0, body centred, unit height); we drop it on the pedestal with one uniform
  // factor. Its faces carry their own baked shading, so push them as-is (doubleSided
  // for orbit). See ./statue-figure.js and docs in lib/graph/landmarks/.
  const fig = buildStatueFigure({ copper: pal.copper, torch: pal.torch, flame: pal.flame, mirror: true });
  for (const f of fig.faces) {
    const corners = f.corners.map(([x, y, z]) => [cx + x * figSpan, cy + y * figSpan, pedTop + z * figSpan]);
    faces.push({ corners, fill: f.fill, doubleSided: true });
  }

  return faces;
}

// ─── Rizal Monument (Luneta, Manila) ──────────────────────────────────────────
// Kissling's 1913 monument: a bronze José Rizal figure standing at the FRONT of a
// granite base, a tall tapered granite OBELISK (pylon + pyramidion) rising behind
// him. The figure is the reusable statue primitive (buildRizalFigure → normalised
// bronze faces); the base + obelisk are built here. Deterministic.
const RIZAL_PALETTE = {
  bronze: '#7a633e',                                              // the cast figure
  stone: '#a89f8e', stoneTop: '#bdb4a2', stoneShadow: '#857d6d',  // granite base + obelisk
};

function rizalMonumentBuilding(b, { L, camHint }) {
  const pal = { ...RIZAL_PALETTE, ...(b.landmarkPalette || {}) };
  const faces = [];
  const { lit } = makeFaceKit({ faces, L, camHint });
  const W = b.w, D = b.d, SHORT = Math.min(W, D), z0 = b.z0;
  const cx = b.x + W / 2, cy = b.y + D / 2;
  // Geometry per the reference: a HEXAGONAL base that tapers up; a Washington-style
  // OBELISK centred on it at ~half the base width; the bronze figure standing in the
  // FRONT gap (between obelisk and base edge) at ⅓ the obelisk height.
  const H = SHORT * 1.0, baseH = H * 0.34, platTop = z0 + baseH;
  const Hob = H - baseH, figSpan = Hob / 3; // tall obelisk (≈2× the base); figure = ⅓ the obelisk

  // ── hexagonal tapering base (flat side facing front +y) ──
  const Rbot = 0.46 * SHORT, Rtop = 0.26 * SHORT;
  const hexRing = (R, z) => Array.from({ length: 6 }, (_, i) => { const a = i * Math.PI / 3; return [cx + R * Math.cos(a), cy + R * Math.sin(a), z]; });
  const rb = hexRing(Rbot, z0), rt = hexRing(Rtop, platTop);
  for (let i = 0; i < 6; i += 1) { const j = (i + 1) % 6; lit([rb[i], rb[j], rt[j], rt[i]], pal.stone); }   // 6 tapering sides
  const ctr = [cx, cy, platTop];
  for (let i = 0; i < 6; i += 1) { const j = (i + 1) % 6; lit([rt[i], rt[j], ctr, ctr], pal.stoneTop); }    // top platform cap
  // bronze inscription plaque on the front (+y) face of the base
  const apoMid = ((Rbot + Rtop) / 2) * Math.cos(Math.PI / 6), pz = z0 + baseH * 0.5, pw = 0.11 * SHORT, ph = 0.11 * baseH, py = cy + apoMid + 0.008 * SHORT;
  lit([[cx - pw, py, pz - ph], [cx + pw, py, pz - ph], [cx + pw, py, pz + ph], [cx - pw, py, pz + ph]], pal.bronze);

  // ── Washington-style obelisk: square shaft tapering to a pyramidion, centred, ~½ base width ──
  const obHW0 = 0.40 * Rtop, obHW1 = 0.75 * obHW0, shaftTop = platTop + Hob * 0.88, tip = z0 + H; // near-straight shaft + a small SHARP pyramidion (Washington-style)
  const obHalf = (z) => obHW0 + (obHW1 - obHW0) * ((z - platTop) / (shaftTop - platTop));
  const oc = (hx, hy, zz) => [cx + hx, cy + hy, zz];
  const a = obHalf(platTop), bb = obHalf(shaftTop);
  lit([oc(a, -a, platTop), oc(a, a, platTop), oc(bb, bb, shaftTop), oc(bb, -bb, shaftTop)], pal.stone);          // +x
  lit([oc(-a, a, platTop), oc(-a, -a, platTop), oc(-bb, -bb, shaftTop), oc(-bb, bb, shaftTop)], pal.stoneShadow); // -x
  lit([oc(a, a, platTop), oc(-a, a, platTop), oc(-bb, bb, shaftTop), oc(bb, bb, shaftTop)], pal.stoneTop);        // +y (front)
  lit([oc(-a, -a, platTop), oc(a, -a, platTop), oc(bb, -bb, shaftTop), oc(-bb, -bb, shaftTop)], pal.stoneShadow); // -y (back)
  const ap = [cx, cy, tip];
  lit([oc(bb, -bb, shaftTop), oc(bb, bb, shaftTop), ap, ap], pal.stone);
  lit([oc(-bb, bb, shaftTop), oc(-bb, -bb, shaftTop), ap, ap], pal.stoneShadow);
  lit([oc(bb, bb, shaftTop), oc(-bb, bb, shaftTop), ap, ap], pal.stoneTop);
  lit([oc(-bb, -bb, shaftTop), oc(bb, -bb, shaftTop), ap, ap], pal.stoneShadow);

  // ── bronze figure in the front gap (between obelisk front and the base's front edge) ──
  const fig = buildRizalFigure({ bronze: pal.bronze });
  const gapY = cy + 0.5 * (obHW0 + Rtop * Math.cos(Math.PI / 6));   // midway across the front gap
  for (const f of fig.faces) {
    const corners = f.corners.map(([x, y, z]) => [cx + x * figSpan, gapY + y * figSpan, platTop + z * figSpan]);
    faces.push({ corners, fill: f.fill, doubleSided: true });
  }

  return faces;
}

export const LANDMARK_SHAPES = new Set(['taj', 'cn-tower', 'skytree', 'rogers-centre', 'skydome', 'colosseum', 'arena', 'great-pyramid', 'louvre-pyramid', 'mexican-pyramid', 'petronas-towers', 'big-ben', 'stonehenge', 'chinatown-gate', 'arc-de-triomphe', 'parthenon', 'griffith-observatory', 'washington-monument', 'parliament-hill', 'mobile-edm-hall', 'eiffel-tower', 'eiffel', 'tokyo-tower', 'tokyo', 'empire-state-building', 'empire-state', 'empire', 'gateway-arch', 'gateway', 'cloud-gate', 'chicago-bean', 'bean', 'statue-of-liberty', 'liberty', 'rizal-monument', 'rizal']);

// Approximate overall height as a multiple of the footprint's MIN side — the silhouette
// each builder actually reaches (taj finial ≈ 0.88·side; cn-tower mast = 3.72·side;
// skytree mast = 4.9·side; the oval stadium crowns low at ≈ 0.66·depth). Callers use this
// only to set a box's `z1` bbox hint for layout/framing; renderLandmarkBuilding computes
// its own geometry from the footprint and ignores z1.
export const LANDMARK_HEIGHTS = {
  taj: 0.9,
  'cn-tower': 3.72,
  skytree: 4.9,
  'rogers-centre': 0.7,
  skydome: 0.7,
  colosseum: 0.45,   // open arcade crowns at ≈ 0.42·axis
  arena: 0.65,      // domed venue apex at ≈ 0.62·axis
  'great-pyramid': 0.68, // plinth + pyramid apex; main body uses the real ≈0.636 height/base ratio
  'louvre-pyramid': 0.68, // glass pyramid + low stone curb; real Louvre Pyramid is squat like Giza
  'mexican-pyramid': 0.55, // stepped terraces + small temple shrine, flat-topped rather than apexed
  'petronas-towers': 4.0,
  'big-ben': 3.9,
  stonehenge: 0.56, // megalith caps sit low and broad over the ring
  'chinatown-gate': 1.18, // compact gateway with roof tiers and upturned eaves
  'arc-de-triomphe': 1.36, // see-through great arch + transverse arches + tall attic
  parthenon: 0.58, // long low Doric temple ruin; entablature top ≈ 0.52·short side (no pediment)
  'griffith-observatory': 1.1, // long Art Deco building; great central dome apex ≈ 0.9·short side + finial
  'washington-monument': 6.0, // slender tapered obelisk; apex at 6·base width
  'parliament-hill': 3.4, // Gothic wings + central Peace Tower spire (apex ≈ 3.3·short side + flag)
  'mobile-edm-hall': 1.18, // tank base + socketed spherical hull + small eye sphere
  'eiffel-tower': 2.64, // wrought-iron lattice pylon; antenna tip at 2.64·base (real 330/125)
  eiffel: 2.64,
  'tokyo-tower': 3.3, // slender banded lattice tower; antenna tip at 3.3·base (real 333/≈88 span)
  tokyo: 3.3,
  'empire-state-building': 5.0, // Art Deco setback skyscraper; antenna spire at 5·short side
  'empire-state': 5.0,
  empire: 5.0,
  'gateway-arch': 2.0, // stainless catenary, as-wide-as-tall; apex ≈ 0.92·long ≈ 2·short side
  gateway: 2.0,
  'cloud-gate': 0.66, // squashed mirror ellipsoid; crown at ≈ 0.66·short side (distinctly wider than tall)
  'chicago-bean': 0.66,
  bean: 0.66,
  'statue-of-liberty': 3.0, // robed figure on a tall granite pedestal; torch tip at ≈ 3·short side
  liberty: 3.0,
  'rizal-monument': 1.0, // bronze figure at the base of a granite obelisk; tip at ≈ 1·short side (modest, ≈¾ of a city building)
  rizal: 1.0,
};

export function isLandmarkShape(shape) {
  return LANDMARK_SHAPES.has(shape);
}

export function renderLandmarkBuilding(b, ctx) {
  if (b.shape === 'taj') return tajMahalBuilding(b, ctx);
  if (b.shape === 'cn-tower') return cnTowerBuilding(b, ctx);
  if (b.shape === 'skytree') return skytreeBuilding(b, ctx);
  if (b.shape === 'rogers-centre' || b.shape === 'skydome') return rogersCentreBuilding(b, ctx);
  if (b.shape === 'colosseum') return arenaBuilding(b, ctx, 'colosseum');
  if (b.shape === 'arena') return arenaBuilding(b, ctx, 'arena');
  if (b.shape === 'great-pyramid') return greatPyramidBuilding(b, ctx);
  if (b.shape === 'louvre-pyramid') return louvrePyramidBuilding(b, ctx);
  if (b.shape === 'mexican-pyramid') return mexicanPyramidBuilding(b, ctx);
  if (b.shape === 'petronas-towers') return petronasTowersBuilding(b, ctx);
  if (b.shape === 'big-ben') return bigBenBuilding(b, ctx);
  if (b.shape === 'stonehenge') return stonehengeBuilding(b, ctx);
  if (b.shape === 'chinatown-gate') return chinatownGateBuilding(b, ctx);
  if (b.shape === 'arc-de-triomphe') return arcDeTriompheBuilding(b, ctx);
  if (b.shape === 'parthenon') return parthenonBuilding(b, ctx);
  if (b.shape === 'griffith-observatory') return griffithObservatoryBuilding(b, ctx);
  if (b.shape === 'washington-monument') return washingtonMonumentBuilding(b, ctx);
  if (b.shape === 'parliament-hill') return parliamentHillBuilding(b, ctx);
  if (b.shape === 'mobile-edm-hall') return mobileEdmHallBuilding(b, ctx);
  if (b.shape === 'eiffel-tower' || b.shape === 'eiffel') return eiffelTowerBuilding(b, ctx);
  if (b.shape === 'tokyo-tower' || b.shape === 'tokyo') return tokyoTowerBuilding(b, ctx);
  if (b.shape === 'empire-state-building' || b.shape === 'empire-state' || b.shape === 'empire') return empireStateBuilding(b, ctx);
  if (b.shape === 'gateway-arch' || b.shape === 'gateway') return gatewayArchBuilding(b, ctx);
  if (b.shape === 'cloud-gate' || b.shape === 'chicago-bean' || b.shape === 'bean') return cloudGateBuilding(b, ctx);
  if (b.shape === 'statue-of-liberty' || b.shape === 'liberty') return statueOfLibertyBuilding(b, ctx);
  if (b.shape === 'rizal-monument' || b.shape === 'rizal') return rizalMonumentBuilding(b, ctx);
  return null;
}
