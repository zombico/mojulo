// Tian Tan Buddha (Ngong Ping, Lantau): the seated bronze Buddha on a lotus throne, raised on a
// three-tier round altar modelled on the Temple of Heaven's, a stair up its front, and the six
// kneeling Devas offering to it around the second tier. Right hand raised (abhaya), left hand
// resting on the lap.
//
// One builder for every city (a new shape has no stored rows to keep), drawn with the refacade
// kit. It works in the square of the footprint's short side s, facing −y: the statue and its stair
// look toward the front of the box. The figure is low-poly masses hung on the vajra armature's pose
// (seatedNodes), wearing the vajra figure's own head (buddhaHeadFaces). Heights: altar top 0.21 s,
// lotus 0.06 s, the figure 0.62 s — a crown under LANDMARK_HEIGHTS × s. No rng.
import { makeKit, v3, decimateFaces } from './refacade-kit.js';
import { scaleHex } from '../polygonizer/vexar.js';
import { renderFigureWorldFrames } from '../polygonizer/figure-render.js';
import { basePositions, articulate } from '../polygonizer/figure-vajra.js';
import * as dmath from '../../util/dmath.js';
import { withMath, mathKey } from '../../util/math-scope.js';

const PALETTE = {
  bronze: '#6f6c57', bronzeDark: '#57554a', bronzeLight: '#858268',
  granite: '#d8d4c9', hall: '#8c877b', graniteShade: '#bdb8ab', rail: '#e7e3d9', stair: '#c8c3b5', paving: '#b4b0a4',
};

// ── the pose: the vajra armature, seated ────────────────────────────────────────────────────────
// The arms are the figure's own FK (articulate): the right hand raised palm out (abhaya), the left
// resting on the lap. The joint cones stop a thigh at 62°, so the lotus legs are AUTHORED: each
// thigh out and forward to a knee a little under the hip, each shin across the front onto the
// other thigh, at the armature's own bone lengths. Positions are STAND units, the figure facing +y.
const LOTUS = {
  thighL: [-0.72, 0.64, -0.2], thighR: [0.72, 0.64, -0.2],
  shinL: [0.94, -0.1, 0.1], shinR: [-0.94, -0.18, 0.2],
};
const ARMS = { shR: { pitch: 20, roll: 50 }, elbowR: 140, shL: { pitch: 15, yaw: -5, roll: 60 }, elbowL: 55 };
function seatedNodes() {
  const m = articulate(ARMS);
  const dist = (a, b) => dmath.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const along = (o, d, l) => { const n = dmath.hypot(d[0], d[1], d[2]); return { x: o.x + (d[0] / n) * l, y: o.y + (d[1] / n) * l, z: o.z + (d[2] / n) * l }; };
  const thigh = dist(m.hipL, m.kneeL), shin = dist(m.kneeL, m.ankleL);
  m.kneeL = along(m.hipL, LOTUS.thighL, thigh); m.kneeR = along(m.hipR, LOTUS.thighR, thigh);
  m.ankleL = along(m.kneeL, LOTUS.shinL, shin); m.ankleR = along(m.kneeR, LOTUS.shinR, shin);
  return m;
}

// ── the head: the vajra figure's own, in bronze ─────────────────────────────────────────────────
// The production figure (protoform flesh on the vajra armature) built bare and standing; its head
// is cut out above the atlas, re-meshed to a small budget, and carries the mesher's shading (one
// material, so the shade is consistent) as a brightness the landmark maps onto bronze. Returned in
// STAND units about the atlas (headBase), facing +y. Memoised: the figure build is ~1 s.
const FIGURE_S = 1.95;   // figure-render: STAND → render world
const HEADS = new Map();   // mathKey() → the head
export function buddhaHeadFaces() {
  if (HEADS.has(mathKey())) return HEADS.get(mathKey());
  const rest = basePositions();
  const src = renderFigureWorldFrames({}).frames[0].faces;
  // world → STAND: a uniform scale, anchored at the crown (the highest point is the skull's top, the
  // headTop node plus its radius); the cut runs under the jaw, the centre band excludes the shoulders
  let zTop = -Infinity; for (const f of src) for (const p of f.corners) if (p[2] > zTop) zTop = p[2];
  const dz = rest.headTop.z + 0.046 - zTop / FIGURE_S;
  const toStand = (p) => [p[0] / FIGURE_S, p[1] / FIGURE_S, p[2] / FIGURE_S + dz];
  const cut = rest.headBase.z - 0.04;
  const head = src.map((f) => ({ ...f, corners: f.corners.map(toStand) }))
    .filter((f) => f.corners.every((p) => p[2] > cut && Math.abs(p[0]) < 0.075));
  const lum = (h) => { const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16); return 0.3 * r + 0.59 * g + 0.11 * b; };
  const faces = decimateFaces(head, 140, (f) => lum(f.fill || '#808080'));
  const mean = faces.reduce((acc, f) => acc + f.tag, 0) / (faces.length || 1);
  const HEAD = faces.map((f) => ({ pts: f.pts.map((p) => [p[0] - rest.headBase.x, p[1] - rest.headBase.y, p[2] - rest.headBase.z]), shade: Math.max(0.6, Math.min(1.35, f.tag / (mean || 1))) }));
  HEADS.set(mathKey(), HEAD);
  return HEAD;
}

/** tianTanBuddhaBuilding on dmath: the shared helpers it reaches answer the same everywhere (util/math-scope.js). */
export function tianTanBuddhaBuilding(b, o) { return withMath(dmath, () => tianTanBuddhaBuildingIn(b, o)); }
function tianTanBuddhaBuildingIn(b, { L, camHint }) {
  const pal = { ...PALETTE, ...(b.landmarkPalette || {}) };
  const faces = [];
  const K = makeKit({ faces, L, camHint });
  const s = Math.min(b.w, b.d), cx = b.x + b.w / 2, cy = b.y + b.d / 2, z0 = b.z0;
  const { sub, add, mul, norm, cross, lerp } = v3;

  // ── helpers: an ellipsoid (lat-long) and a tapered tube between two points ───────────────────
  const ellipsoid = (c, rx, ry, rz, tint, { nU = 12, nV = 7 } = {}) => {
    const P = (i, j) => {
      const th = (i / nU) * 2 * Math.PI, ph = -Math.PI / 2 + (j / nV) * Math.PI;
      return [c[0] + dmath.cos(ph) * dmath.cos(th) * rx, c[1] + dmath.cos(ph) * dmath.sin(th) * ry, c[2] + dmath.sin(ph) * rz];
    };
    for (let j = 0; j < nV; j++) for (let i = 0; i < nU; i++) {
      const A = P(i, j), B = P(i + 1, j), C = P(i + 1, j + 1), D = P(i, j + 1);
      if (j === 0) K.tri(D, C, A, tint, c);
      else if (j === nV - 1) K.tri(A, B, D, tint, c);
      else K.quad([A, B, C, D], tint, c);
    }
  };
  const tube = (A, B, ra, rb, tint, n = 8) => {
    const t = norm(sub(B, A)), ref = Math.abs(t[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const p = norm(cross(t, ref)), q = cross(t, p), mid = lerp(A, B, 0.5);
    const ring = (O, r) => Array.from({ length: n }, (_, i) => { const a = (i / n) * 2 * Math.PI; return add(O, add(mul(p, dmath.cos(a) * r), mul(q, dmath.sin(a) * r))); });
    const ra0 = ring(A, ra), rb0 = ring(B, rb);
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; K.quad([ra0[i], ra0[j], rb0[j], rb0[i]], tint, mid); }
  };
  const F = (x, y, z) => [cx + x, cy + y, z0 + z];   // local offsets in the s-square, z from the ground

  // ── ground and the three-tier altar ──────────────────────────────────────────────────────────
  K.box(cx - s / 2, cy - s / 2, z0, cx + s / 2, cy + s / 2, z0 + s * 0.01, { side: pal.graniteShade, top: pal.paving });
  const tiers = [[0.40, 0.01, 0.08], [0.33, 0.08, 0.15], [0.27, 0.15, 0.21]];   // [radius, zBottom, zTop] × s
  const N = 36;
  tiers.forEach(([r, lo, hi], k) => {
    // the tier's drum: a plain base course, a recessed band of halls, a cornice lip
    K.lathe(cx, cy, [[r * s, lo * s], [r * s, (lo + (hi - lo) * 0.25) * s]], N, pal.granite);
    K.lathe(cx, cy, [[r * s * 0.985, (lo + (hi - lo) * 0.25) * s], [r * s * 0.985, (hi - (hi - lo) * 0.18) * s]], N, (i) => (i % 3 === 1 ? pal.hall : pal.graniteShade));
    K.lathe(cx, cy, [[r * s * 0.985, (hi - (hi - lo) * 0.18) * s], [r * s * 1.02, (hi - (hi - lo) * 0.12) * s], [r * s * 1.02, hi * s]], N, pal.rail);
    // the tier's terrace: the ring out to the next tier's foot is paved; the top tier is capped whole
    const inner = k < 2 ? tiers[k + 1][0] * s : 0;
    K.lathe(cx, cy, [[r * s * 1.02, hi * s], [inner, hi * s]], N, pal.granite);
    // the white balustrade round the terrace edge: posts and a top rail, broken at the stair
    const railR = r * s * 0.99, railH = s * 0.018, postW = s * 0.006;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * 2 * Math.PI, a1 = ((i + 1) / N) * 2 * Math.PI;
      if (Math.abs(dmath.sin(a) + 1) < 0.02 || Math.abs(dmath.sin(a1) + 1) < 0.02 || (dmath.sin((a + a1) / 2) < -0.985)) continue;   // the stair's gap at −y
      const x = cx + dmath.cos(a) * railR, y = cy + dmath.sin(a) * railR;
      K.box(x - postW, y - postW, z0 + hi * s, x + postW, y + postW, z0 + hi * s + railH, pal.rail);
      const P0 = [x, y, z0 + hi * s + railH], P1 = [cx + dmath.cos(a1) * railR, cy + dmath.sin(a1) * railR, z0 + hi * s + railH];
      K.quad([P0, P1, [P1[0], P1[1], P1[2] - railH * 0.22], [P0[0], P0[1], P0[2] - railH * 0.22]], pal.rail, [cx, cy, P0[2]]);
    }
  });

  // ── the stair up the front: one flight per tier, cheeks either side ──────────────────────────
  const sw = s * 0.05;
  const flights = [[0.5, 0.40, 0.01, 0.08], [0.40, 0.33, 0.08, 0.15], [0.33, 0.27, 0.15, 0.21]];   // [yFrom, yTo] (distance in front of centre), [zFrom, zTo] × s
  for (const [yf, yt, zf, zt] of flights) {
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      const y0 = cy - (yf - (yf - yt) * (i / steps)) * s, y1 = cy - (yf - (yf - yt) * ((i + 1) / steps)) * s;
      K.box(cx - sw, y0, z0, cx + sw, y1, z0 + (zf + (zt - zf) * ((i + 1) / steps)) * s, { side: pal.graniteShade, top: pal.stair });
    }
    for (const side of [-1, 1]) {
      const x = cx + side * (sw + s * 0.006);
      K.box(x - s * 0.006, cy - yf * s, z0, x + s * 0.006, cy - yt * s, z0 + (zf + zt) / 2 * s + s * 0.012, pal.rail);
    }
  }

  // ── the six Devas kneeling on the second tier, offering toward the Buddha ────────────────────
  const devaR = 0.30 * s, zDeva = 0.15 * s, dh = s * 0.055;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * 2 * Math.PI;   // every 60° from +x: the nearest two stand 30° off the stair at −y
    const dx = dmath.cos(a), dy = dmath.sin(a), px = cx + dx * devaR, py = cy + dy * devaR, z = z0 + zDeva;
    const inward = [-dx, -dy, 0];
    ellipsoid([px, py, z + dh * 0.22], dh * 0.28, dh * 0.28, dh * 0.22, pal.bronzeDark, { nU: 8, nV: 5 });   // kneeling legs and robe
    ellipsoid([px, py, z + dh * 0.58], dh * 0.17, dh * 0.17, dh * 0.26, pal.bronze, { nU: 8, nV: 5 });      // torso
    ellipsoid([px, py, z + dh * 0.92], dh * 0.1, dh * 0.1, dh * 0.12, pal.bronzeLight, { nU: 8, nV: 4 });    // head
    const hands = [px + inward[0] * dh * 0.3, py + inward[1] * dh * 0.3, z + dh * 0.82];
    tube([px, py, z + dh * 0.7], hands, dh * 0.05, dh * 0.04, pal.bronze, 5);                              // arms raised with the offering
    ellipsoid(hands, dh * 0.07, dh * 0.07, dh * 0.05, pal.bronzeLight, { nU: 6, nV: 3 });
  }

  // ── the lotus throne: a drum and two rings of petals ─────────────────────────────────────────
  const zl = 0.21 * s, lr = 0.25 * s, lh = 0.06 * s;
  K.lathe(cx, cy, [[lr * 0.78, zl], [lr * 0.82, zl + lh * 0.35], [lr * 0.9, zl + lh], [0, zl + lh]], 24, pal.bronzeDark);
  for (const [ring, rIn, rOut, zBase, zTip, tint] of [[0, 0.72, 1.0, 0.1, 0.62, pal.bronze], [1, 0.82, 1.06, 0.45, 1.0, pal.bronzeLight]]) {
    const n = 16, off = ring * (Math.PI / n);
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * 2 * Math.PI, h = (Math.PI / n) * 0.95;
      const base = (da) => [cx + dmath.cos(a + da) * lr * rIn, cy + dmath.sin(a + da) * lr * rIn, z0 + zl + lh * zBase];
      const tip = [cx + dmath.cos(a) * lr * rOut, cy + dmath.sin(a) * lr * rOut, z0 + zl + lh * zTip];
      K.tri(base(-h), base(h), tip, tint, [cx, cy, z0 + zl + lh * 0.3]);
    }
  }

  // ── the Buddha, seated in lotus, facing −y: low-poly masses hung on the vajra pose ────────────
  const J = seatedNodes(), hd = buddhaHeadFaces();
  // a Buddha's head is large: the vajra head at HS× about the atlas; its crown carries the ushnisha
  const HS = 1.2, crownZ = J.headBase.z + (J.headTop.z + 0.046 - J.headBase.z) * HS;
  const zSeat = Math.min(J.kneeL.z, J.kneeR.z, J.ankleL.z, J.ankleR.z) - 0.05, span = crownZ + 0.04 - zSeat;
  const h = 0.62 * s, k = h / span, zb = zl + lh * 0.75, yc = (J.pelvisHub.y + Math.max(J.kneeL.y, J.kneeR.y)) / 2;
  const P = (q) => [cx - q.x * k, cy - (q.y - yc) * k, z0 + zb + (q.z - zSeat) * k];   // STAND → world, turned to face −y
  const at = (q, dx = 0, dy = 0, dz = 0) => P({ x: q.x + dx, y: q.y + dy, z: q.z + dz });
  const mid = (a, b, t = 0.5) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
  const r = (v) => v * k;
  // the lap: the crossed legs under the robe — a broad low mass, the thighs and shins as tapered
  // tubes on their bones, the knees, the soles turned up on the opposite thighs
  ellipsoid(at(mid(J.hipL, J.hipR), 0, 0.05, -0.02), r(0.16), r(0.13), r(0.065), pal.bronzeDark, { nU: 14, nV: 6 });
  for (const S of ['L', 'R']) {
    tube(P(J['hip' + S]), P(J['knee' + S]), r(0.075), r(0.06), pal.bronzeDark, 8);
    tube(P(J['knee' + S]), P(J['ankle' + S]), r(0.058), r(0.042), S === 'R' ? pal.bronze : pal.bronzeDark, 8);
    ellipsoid(P(J['knee' + S]), r(0.068), r(0.068), r(0.058), pal.bronzeDark, { nU: 10, nV: 5 });
    ellipsoid(at(J['ankle' + S], 0, 0.02, 0.015), r(0.05), r(0.03), r(0.018), pal.bronzeLight, { nU: 8, nV: 4 });
  }
  // the robe's hem falling over the lotus at the front
  ellipsoid(at(mid(J.kneeL, J.kneeR), 0, 0.0, -0.03), r(0.18), r(0.06), r(0.03), pal.bronzeDark, { nU: 12, nV: 4 });
  // the trunk on the spine: belly to chest, the shoulders, the robe over the left shoulder
  ellipsoid(at(mid(J.pelvisHub, J.navel, 0.7)), r(0.13), r(0.095), r(0.13), pal.bronze, { nU: 14, nV: 7 });
  ellipsoid(at(mid(J.navel, J.neckHub, 0.6)), r(0.17), r(0.1), r(0.1), pal.bronze, { nU: 14, nV: 6 });
  ellipsoid(at(mid(J.neckHub, J.shoulderL, 0.6), 0, 0, -0.06), r(0.08), r(0.1), r(0.12), pal.bronzeDark, { nU: 10, nV: 6 });
  tube(P(J.neckHub), at(J.headBase, 0, 0, 0.01), r(0.04), r(0.036), pal.bronze, 8);
  // the arms on their bones: shoulder caps, the upper arms, the forearms, the hands
  for (const S of ['L', 'R']) {
    const sleeve = S === 'L' ? pal.bronzeDark : pal.bronze;
    ellipsoid(P(J['shoulder' + S]), r(0.05), r(0.05), r(0.045), sleeve, { nU: 10, nV: 5 });
    tube(P(J['shoulder' + S]), P(J['elbow' + S]), r(S === 'L' ? 0.05 : 0.042), r(S === 'L' ? 0.045 : 0.036), sleeve, 8);
    tube(P(J['elbow' + S]), P(J['wrist' + S]), r(S === 'L' ? 0.042 : 0.034), r(0.028), sleeve, 8);
  }
  // the right hand raised palm out (a flat upright mitten), the left lying palm up in the lap
  ellipsoid(at(J.wristR, 0, 0.005, 0.05), r(0.034), r(0.014), r(0.055), pal.bronzeLight, { nU: 8, nV: 4 });
  ellipsoid(at(J.wristL, 0, 0.04, -0.005), r(0.03), r(0.045), r(0.013), pal.bronzeLight, { nU: 8, nV: 4 });
  // the head: the vajra figure's own, in bronze, on the atlas
  const base = J.headBase;
  for (const f of hd) {
    const pts = f.pts.map((p) => P({ x: base.x + p[0] * HS, y: base.y + p[1] * HS, z: base.z + p[2] * HS })), fill = scaleHex(pal.bronze, f.shade * 0.94);
    if (pts.length === 3) {
      const [A, B2, T] = pts, U = sub(B2, A), ub = norm(U), AT = sub(T, A), V = sub(AT, mul(ub, v3.dot(AT, ub)));
      if (v3.len(V) < 1e-9 || v3.len(U) < 1e-9) continue;
      faces.push({ corners: [A, B2, add(B2, V), add(A, V)], fill, doubleSided: true, clip: `polygon(0% 0%, 100% 0%, ${(v3.dot(AT, ub) / v3.len(U) * 100).toFixed(1)}% 100%)` });
    } else faces.push({ corners: pts, fill, doubleSided: true });
  }
  // the Buddha's signs on it: the curled-hair cap over the crown, the ushnisha, the long ear lobes
  const crown = { x: base.x, y: base.y - 0.008 * HS, z: crownZ };
  ellipsoid(at(crown, 0, 0, -0.03 * HS), r(0.052 * HS), r(0.056 * HS), r(0.034 * HS), pal.bronzeDark, { nU: 14, nV: 5 });
  ellipsoid(at(crown, 0, -0.004, 0.008), r(0.028 * HS), r(0.028 * HS), r(0.03 * HS), pal.bronzeDark, { nU: 12, nV: 5 });
  for (const sx of [-1, 1]) ellipsoid(at(base, sx * 0.062 * HS, -0.004, 0.012 * HS), r(0.011 * HS), r(0.018 * HS), r(0.04 * HS), pal.bronze, { nU: 6, nV: 4 });

  return faces;
}
