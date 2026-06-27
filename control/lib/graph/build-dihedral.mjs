// vgl-rules DIHEDRAL (0617) — generalizes the box-specific seam rules to ANY angular form.
//
// One detector replaces verticalEdges + abutX/Y/Z + groundFoot from build-stack.mjs:
//
//   For every candidate edge of the massing, walk it; at each step probe the SOLID in a
//   ring in the plane PERPENDICULAR to the edge. The filled fraction is the dihedral:
//       ~1/4 filled (≈90°  wedge) → CONVEX  edge / silhouette → SKIP   (not-outer-outline)
//       ~1/2 filled (≈180°)       → FLAT (coplanar / flush join) → SKIP (R1 superimposed)
//       ~3/4 filled (≈270°)       → CONCAVE inner edge           → INK
//       ~all filled               → INTERIOR / buried            → SKIP
//   This is the 3-of-4 plan-quadrant test from the box spike, lifted to arbitrary edge
//   orientation (the ring is N directions instead of 4 quadrants). It needs no CSG and no
//   face-adjacency welding — only point-in-solid occupancy, which any convex solid supplies
//   via half-space tests. Ground feet fall out for free: add the ground as a slab in occ(),
//   and the wall⊓ground reentrant edge inks itself.
//
// Proves the two locked invariants on angular forms:
//   • CONCAVE-ONLY — a rotated box standing alone gets NO outline (only its ground contact);
//     a wedge ramp leaning on a wall gets the reentrant crease where slope meets wall.
//   • HUE-FROM-SURFACE, VALUE-CONSTANT — each strip samples the solid it lies in (SEAM_L pin).
//
// Run:  node build-dihedral.mjs   then   node rasterize.mjs vgl-rules-dihedral.html

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

import { assembleBoxCityScene, emitPreserve3dScene } from '../../../../../control/lib/graph/scene-css3d.js';
import { emitThreeWorld } from '../../../../../control/lib/graph/scene-three.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const viewBox = { width: 1280, height: 860 };
const unitScale = 56;

const EPS = 1e-6;
const SEAM_W = 1.2 / unitScale;
const LIFT = 1.0 / unitScale;

// --- vec ---------------------------------------------------------------------------------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a) || 1; return scl(a, 1 / l); };
const mean = (ps) => scl(ps.reduce(add, [0, 0, 0]), 1 / ps.length);

// --- seam colour: hue+chroma from the surface, value pinned (the locked rule) -------------
const hexToRgb = (h) => { const s = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)); };
const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
const SEAM_L = 0.21;
const rgb2hsl = ([r, g, b]) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const dd = mx - mn, s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
  let h = mx === r ? (g - b) / dd + (g < b ? 6 : 0) : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
  return [h / 6, s, l];
};
const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
const hsl2rgb = (h, s, l) => { if (s === 0) return [l * 255, l * 255, l * 255]; const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)].map((v) => v * 255); };
const seamColor = (srcHex) => { const [h, s] = rgb2hsl(hexToRgb(srcHex)); const [r, g, b] = hsl2rgb(h, s, SEAM_L); return `#${toHex(r)}${toHex(g)}${toHex(b)}`; };

// --- convex solid model: faces with outward normals (works for any angular form) ---------
function makeSolid(faceVertLists, tint) {
  const allV = faceVertLists.flat();
  const c = mean(allV);
  const faces = faceVertLists.map((vs) => {
    let n = unit(cross(sub(vs[1], vs[0]), sub(vs[2], vs[0])));
    if (dot(n, sub(mean(vs), c)) < 0) n = scl(n, -1);   // orient outward (convex → away from centroid)
    return { vs, n, p: vs[0] };
  });
  return { faces, c, tint };
}
function boxSolid(x, y, w, d, z0, z1, tint) {
  const x1 = x + w, y1 = y + d;
  const a = [x, y, z0], b = [x1, y, z0], cc = [x1, y1, z0], e = [x, y1, z0];
  const f = [x, y, z1], g = [x1, y, z1], h = [x1, y1, z1], k = [x, y1, z1];
  return makeSolid([[a, b, cc, e], [f, g, h, k], [a, b, g, f], [b, cc, h, g], [cc, e, k, h], [e, a, f, k]], tint);
}
function transformSolid(solid, fn, tint) {
  return makeSolid(solid.faces.map((face) => face.vs.map(fn)), tint ?? solid.tint);
}
function rotZ(theta, cx, cy) {
  const c = Math.cos(theta), s = Math.sin(theta);
  return ([x, y, z]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c, z];
}
// triangular-prism ramp: rectangular base, high vertical wall at xHi, sloping down to xLo.
function wedgeSolid(xLo, xHi, y0, y1, H, tint) {
  const bz = 0;
  const bl0 = [xLo, y0, bz], br0 = [xHi, y0, bz], tr0 = [xHi, y0, H];
  const bl1 = [xLo, y1, bz], br1 = [xHi, y1, bz], tr1 = [xHi, y1, H];
  return makeSolid([
    [bl0, br0, tr0], [bl1, br1, tr1],            // the two triangle ends
    [bl0, br0, br1, bl1],                         // bottom
    [br0, tr0, tr1, br1],                         // tall back wall at xHi
    [bl0, tr0, tr1, bl1],                         // the sloped hypotenuse
  ], tint);
}

// --- the massing -------------------------------------------------------------------------
const COL = { stone: '#bda873', terracotta: '#b67250', sage: '#7f9b84', slate: '#7486a0', violet: '#a98bb0', gold: '#c9b25c', copper: '#b08d57', teal: '#4f9a8c' };
const P = boxSolid(-3, -3, 2, 2, 0, 2, COL.stone);        // base
const Q = boxSolid(-1, -3, 2, 2, 0, 2, COL.terracotta);   // flush with P (no seam) → bar
const Cc = boxSolid(-1, -1, 2, 2, 0, 2, COL.sage);        // off Q's +y → L (concave vertical)
const R = boxSolid(1, -3, 2, 2, 0, 3.2, COL.slate);       // taller, abuts Q +x → abut crease
const S = boxSolid(-2, -2, 2, 2, 2, 4, COL.violet);       // cantilever on the L roof → armpits
const E = boxSolid(-1.5, -1.5, 1, 1, 4, 5, COL.gold);     // penthouse
const T = transformSolid(boxSolid(2.7, 0.6, 1.6, 1.6, 0, 2.2, COL.copper), rotZ(0.56, 3.5, 1.4)); // ROTATED, alone
const W = wedgeSolid(3, 5, -3, -1, 2, COL.teal);          // ramp leaning on R's +x wall
const massing = [P, Q, Cc, R, S, E, T, W];

const ground = boxSolid(-12, -12, 26, 26, -0.5, 0.0, COL.stone); // occ-only slab (gives feet)
const occSolids = [...massing, ground];

const inside = (S, p) => S.faces.every((f) => dot(f.n, sub(p, f.p)) < -EPS);
const occ = (p) => occSolids.some((s) => inside(s, p));
const occTint = (p) => { for (const s of massing) if (inside(s, p)) return s.tint; return null; };

// --- candidate edges: every face edge of the massing, globally de-duped ------------------
function candidateEdges() {
  const seen = new Map();
  const key = (a, b) => [a, b].map((p) => p.map((v) => v.toFixed(3)).join(',')).sort().join('|');
  for (const s of massing) for (const f of s.faces) {
    for (let i = 0; i < f.vs.length; i++) {
      const a = f.vs[i], b = f.vs[(i + 1) % f.vs.length];
      const k = key(a, b);
      if (!seen.has(k)) seen.set(k, [a, b]);
    }
  }
  return [...seen.values()];
}

// --- the dihedral detector ---------------------------------------------------------------
const seams = [];
const ink = (corners, src) => seams.push({ corners, fill: seamColor(src), doubleSided: true });

function longestFalseRun(arr) {
  const K = arr.length;
  if (arr.every((x) => x)) return null;
  let best = { len: 0, start: 0 }, curStart = 0, curLen = 0;
  for (let k = 0; k < 2 * K; k++) {
    if (!arr[k % K]) { if (curLen === 0) curStart = k; curLen++; if (curLen > best.len) best = { len: Math.min(curLen, K), start: curStart % K }; }
    else curLen = 0;
  }
  return best;
}

const K = 32, PROBE = 0.05, INSET = 0.09, STEP = 0.05;
const stats = { edges: 0, inked: 0 };

function detect() {
  for (const [P0, P1] of candidateEdges()) {
    stats.edges++;
    const T = unit(sub(P1, P0)), L = len(sub(P1, P0));
    if (L < 2 * INSET + 1e-4) continue;
    const U = Math.abs(T[2]) < 0.9 ? unit(cross(T, [0, 0, 1])) : unit(cross(T, [1, 0, 0]));
    const V = unit(cross(T, U));
    const dirOf = (idx) => { const th = (idx / K) * 2 * Math.PI; return add(scl(U, Math.cos(th)), scl(V, Math.sin(th))); };
    const Nn = Math.max(2, Math.floor((L - 2 * INSET) / STEP));
    let run = null;
    const flush = () => {
      if (!run) return;
      emitStrips(run, P0, T, dirOf);
      run = null;
    };
    for (let i = 0; i <= Nn; i++) {
      const t = INSET + (L - 2 * INSET) * (i / Nn);
      const M = add(P0, scl(T, t));
      const filled = Array.from({ length: K }, (_, k) => occ(add(M, scl(dirOf(k), PROBE))));
      const frac = filled.filter(Boolean).length / K;
      if (frac > 0.55 && frac < 0.97) { if (!run) run = { t0: t, filled, M }; run.t1 = t; run.filled = filled; run.M = M; }
      else flush();
    }
    flush();
  }
}

function emitStrips(run, P0, T, dirOf) {
  const f = run.filled, empty = longestFalseRun(f);
  if (!empty) return;
  const before = (empty.start - 1 + K) % K, after = (empty.start + empty.len) % K;
  const midE = (empty.start + Math.floor(empty.len / 2)) % K;
  const emptyMid = dirOf(midE);
  const S0 = add(P0, scl(T, run.t0)), S1 = add(P0, scl(T, run.t1));
  for (const fi of [before, after]) {
    const r = dirOf(fi);                                   // along the face surface, away from the edge
    const nA = cross(T, r), n = dot(nA, emptyMid) >= 0 ? unit(nA) : unit(scl(nA, -1)); // outward, into the open air
    const probe = add(add(run.M, scl(r, PROBE * 0.5)), scl(n, -PROBE * 0.5));          // just behind this face
    const src = occTint(probe) || run && occTint(add(run.M, scl(r, PROBE * 0.6))) || COL.stone;
    const A = add(S0, scl(n, LIFT)), B = add(S1, scl(n, LIFT));
    ink([A, B, add(B, scl(r, SEAM_W)), add(A, scl(r, SEAM_W))], src);
    stats.inked++;
  }
}

detect();

// --- assemble: feed our solids to the renderer as plain boxes + the seam faces ------------
// (assembleBoxCityScene draws axis boxes itself; the rotated box + wedge we hand it as raw
//  pre-lit faces so the renderer shows the angular geometry the detector ran on.)
const L = { direction: [0.34, 0.46, -0.82] };
const litFactor = (n) => { const d = Math.max(0, dot(unit(n), unit(scl(L.direction, -1)))); return 0.5 + 0.5 * d; };
const shadeHex = (hex, k) => { const [r, g, b] = hexToRgb(hex); return `#${toHex(r * k)}${toHex(g * k)}${toHex(b * k)}`; };
const rawFaces = [];
for (const s of [T, W]) for (const f of s.faces) rawFaces.push({ corners: f.vs.length === 3 ? [...f.vs, f.vs[2]] : f.vs, fill: shadeHex(s.tint, 0.62 + 0.5 * litFactor(f.n)), doubleSided: true });

const axisBoxes = [P, Q, Cc, R, S, E].map((s, i) => {
  const xs = s.faces.flatMap((f) => f.vs.map((v) => v[0])), ys = s.faces.flatMap((f) => f.vs.map((v) => v[1])), zs = s.faces.flatMap((f) => f.vs.map((v) => v[2]));
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), d: Math.max(...ys) - Math.min(...ys), z0: Math.min(...zs), z1: Math.max(...zs), tint: s.tint, kind: 'plain' };
});

const cameras = [
  { name: 'hero 3/4', worldFraming: { cameraPosition: [-8, 12, 7.5], lookAt: [0.6, -0.9, 2.0], horizontalFov: 50, pictureCenter: [640, 470] } },
  { name: 'high', worldFraming: { cameraPosition: [-5, 10, 14], lookAt: [0.6, -0.9, 1.6], horizontalFov: 50, pictureCenter: [640, 430] } },
  { name: 'ramp + rotated', worldFraming: { cameraPosition: [11, 4, 6], lookAt: [2.4, -1.2, 1.4], horizontalFov: 48, pictureCenter: [640, 460] } },
];

const payload = assembleBoxCityScene({
  viewBox, unitScale, cameras,
  sky: { preset: 'day' },
  title: 'vgl rules — dihedral (angular forms)',
  boxes: axisBoxes,
  faces: [...rawFaces, ...seams],
  grounds: [{ x: -12, y: -12, w: 26, d: 26, z: 0, fill: '#a99a78' }],
});

const cssHtml = emitPreserve3dScene({ ...payload, viewBox, unitScale, title: 'vgl rules — dihedral' });
fs.writeFileSync(path.join(HERE, 'vgl-rules-dihedral.html'), cssHtml);
const worldHtml = emitThreeWorld({ ...payload, title: 'vgl rules — dihedral (world)', viewBox, inline: true, walk: { enabled: true, speed: 4.0, eyeHeight: 1.35, start: [0.6, 11, 1.35], yaw: Math.PI } });
fs.writeFileSync(path.join(HERE, 'vgl-rules-dihedral-world.html'), worldHtml);

console.log(JSON.stringify({ css: 'vgl-rules-dihedral.html', world: 'vgl-rules-dihedral-world.html', solids: massing.length, edges: stats.edges, seamStrips: seams.length }, null, 2));
