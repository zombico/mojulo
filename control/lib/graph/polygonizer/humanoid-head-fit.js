/** humanoid-head-fit.js — the humanoid heads' cranium and jaw rings, resampled from heads FITTED to reference images.
 * Core since face-tune (the hero door regenerates the head from its face controls); docs/examples/humanoid/head-fit.mjs re-exports it.
 * `head-fit/female/` (front, three-quarter, side) and `head-fit/male/` (three-quarter, side) each hold one exactly
 * symmetric polygon head (named points, +x right, +y front, +z up, fit units) solved jointly against hand-placed
 * landmarks, with one orthographic camera per reference; the fits are authoring steps and their points are frozen,
 * never re-solved on read. This module registers each surface into the hero head frame once, deforms it by the head
 * knobs, and reads the landmark head's rows and slots off it: each front slot is the surface's front-most point at a
 * named x, each back slot its rear-most, the side slot the section's widest point. Ears and ear roots are never
 * sampled. The cheek is then built as four flat planes around a rounded apex (`FIT_CHEEK`), the lower side keeps its
 * volume down the ramus, the jaw meets the ear, and the chin and jaw below the cheek are the fit's own.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { moduleDir } from '../../module-dir.js';
import { r6 } from './station-loft-plan.js';
import { rasterDepth } from '../scene/depth-raster.js';

const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
/** the frozen fits' data dir (`head-fit/<preset>/`), bundler-proof like the vocab cards; tests pin its bytes */
export const FIT_DATA_DIR = path.join(moduleDir(import.meta.url, 'lib/graph/polygonizer'), 'head-fit');
const readJson = (preset, file) => JSON.parse(readFileSync(path.join(FIT_DATA_DIR, preset, file), 'utf8'));
// Registration into the hero head frame (metres about the atlas), per head: chin to the landmark preset's menton,
// crown-to-chin height to its, and the head's length centred where its cranium was. The figure's collar, neck and
// head scale were built around those numbers.
const REGISTRATION = { female: { menton: -0.042, height: 0.219, midY: 0.014 }, male: { menton: -0.041, height: 0.228, midY: 0.0198 } };
const EAR_GROUPS = new Set(['Ear inset', 'Ear attachment']);
/** One frozen fit: its named points, its sampling triangles (the fit's own corrected triangulation, ears and ear
 * roots left out, the skull's ear openings patched) and its registration. */
function loadFit(preset) {
  const src = readJson(preset, 'head-source.json'), report = readJson(preset, 'fit-report.json');
  const BASE = Object.fromEntries(src.pointIds.map((k, i) => [k, src.vertices[i]])), at = Object.fromEntries(src.pointIds.map((k, i) => [k, i]));
  const faces = src.faces.map((f) => new Set(f));
  const groupOf = (t) => src.groups[faces.findIndex((f) => t.every((v) => f.has(v)))];
  const tris = (src.occluderTriangles ?? src.faces.flatMap((f) => f.slice(1, -1).map((_, k) => [f[0], f[k + 1], f[k + 2]])))
    .filter((t) => !EAR_GROUPS.has(groupOf(t)));
  for (const side of ['R', 'L']) {
    const q = ['Top', 'Front', 'Bottom', 'Back'].map((n) => at[`earAttach${n}${side}`]);
    if (q.every((v) => v !== undefined)) tris.push([q[0], q[1], q[2]], [q[0], q[2], q[3]]);
  }
  const { menton, height, midY } = REGISTRATION[preset], S = height / (BASE.crown[2] - BASE.chinBottom[2]);
  const TY = midY - S * (BASE.tip[1] + BASE.back[1]) / 2, TZ = menton - S * BASE.chinBottom[2];
  return { preset, src, report, BASE, TRIS: tris, S, TY, TZ,
    toM: (p) => [r6(p[0] * S), r6(p[1] * S + TY), r6(p[2] * S + TZ)], fromM: (p) => [p[0] / S, (p[1] - TY) / S, (p[2] - TZ) / S] };
}
const FITS = { female: loadFit('female'), male: loadFit('male') };
export const FIT_PRESETS = Object.keys(FITS);
const fitOf = (preset) => { const F = FITS[preset]; if (!F) throw new Error(`head-fit: no fitted head for '${preset}'`); return F; };

/** the face controls the fitted head adds to the figure's head knobs (face-tune, the face proportion lab's words) */
export const FACE_EXTRA_DEFAULTS = Object.freeze({
  skullWidth: 1,      // width of the vault and rear skull (blends into the face)
  faceWidth: 1,       // width of the face (blends into the vault)
  faceLength: 1,      // the face below the eye line stretches down; the chin drops, the head grows
  chinProjection: 1,  // the chin forward (bottom, front, fold, sides; the jaw front a little)
  eyeSpacing: 1,      // the eyes out from the midline (the brows follow 0.8)
  browHeight: 1,      // the brow and glabella up; the pinned brow rides its row
  mouthWidth: 1,      // the mouth corners and lip sides out; the V3 mouth span with them
});
/** every half point's depth as a fraction from the ear root (0) to the cheekbone crest (1, and everything forward of it):
 * the lab's face ↔ vault blend, with the face's widest point (the cheekbone) counted as face */
const frontOf = (P) => { const back = P.earRoot[1], span = Math.max(1e-6, P.cheekbone[1] - back); return (p) => Math.max(0, Math.min(1, (p[1] - back) / span)); };
const headHeight = (P) => P.crown[2] - P.chinBottom[2];
/** Knobs deform named fitted points (both sides) before sampling; 1 is the fit itself. Broad controls run over every
 * point with a depth weight; feature controls move named points with their support. */
const KNOB_MOVES = {
  skullWidth: (k, P) => { const front = frontOf(P); for (const p of Object.values(P)) p[0] *= 1 + (k - 1) * (1 - 0.8 * front(p)); },
  faceWidth: (k, P) => { const front = frontOf(P); for (const p of Object.values(P)) p[0] *= 1 + (k - 1) * front(p); },
  faceLength: (k, P) => { const front = frontOf(P), zRef = P.eyeCenter[2]; for (const p of Object.values(P)) p[2] += Math.min(0, p[2] - zRef) * (k - 1) * front(p); },
  // the chin and brow displacements are the lab's (0.22 and 0.20 of a 1.6-unit head) as fractions of this head's height
  chinProjection: (k, P) => { const d = (k - 1) * 0.14 * headHeight(P); for (const [n, w] of [['chinBottom', 0.9], ['chinFront', 1], ['chinFold', 0.5], ['chinSide', 0.7], ['jawFront', 0.35]]) P[n][1] += d * w; },
  eyeSpacing: (k, P) => { const d = (k - 1) * P.eyeCenter[0]; for (const n of Object.keys(P)) { const w = /^eye/.test(n) ? 1 : /^brow/.test(n) ? 0.8 : /^socket|^malar/.test(n) ? 0.5 : 0; if (w) P[n][0] += d * w; } },
  browHeight: (k, P) => { const d = (k - 1) * 0.125 * headHeight(P); for (const n of ['glabella', 'browInner', 'browMid', 'browOuter']) P[n][2] += d; },
  mouthWidth: (k, P) => { for (const n of ['mouthCorner', 'upperLipSide', 'lowerLipSide']) P[n][0] *= k; },
  noseWidth: (k, P) => { for (const n of ['noseSide', 'noseWing', 'nostril']) P[n][0] *= k; },
  noseSize: (k, P) => { const face = P.nasion[1]; for (const n of ['bridge', 'tip', 'columella', 'noseSide', 'noseWing', 'nostril']) P[n][1] = face + (P[n][1] - face) * k; },
  noseDroop: (k, P) => { P.tip[2] -= (k - 1) * 0.05; },
  browRidge: (k, P) => { for (const n of ['glabella', 'browInner', 'browMid', 'browOuter']) P[n][1] += (k - 1) * 0.05; },
  foreheadSlope: (k, P) => { for (const n of ['forehead', 'frontal']) P[n][1] -= (k - 1) * 0.12; },
  cheekbone: (k, P) => { for (const n of ['cheekbone', 'sideCheek']) P[n][0] *= k; },
  cheek: (k, P) => { P.cheek[0] *= k; },
  jawWidth: (k, P) => { for (const n of ['jawAngle', 'cheek']) P[n][0] *= k; P.jawFront[0] *= 1 + (k - 1) * 0.5; },
  chinPoint: (k, P) => { P.chinSide[0] /= k; P.jawFront[0] /= Math.sqrt(k); },
};
/** Knobs with no fitted counterpart (the ear and eye are pinned details; the neck is the body's). */
export const FIT_INERT_KNOBS = ['earSize', 'eyeSize', 'neckGirth'];

function deformed(F, knobs, jaw = 0) {
  const half = Object.fromEntries(Object.entries(F.BASE).filter(([k]) => !k.endsWith('L')).map(([k, p]) => [k.replace(/R$/, ''), [...p]]));
  for (const [name, move] of Object.entries(KNOB_MOVES)) if (knobs[name] !== undefined && knobs[name] !== 1) move(knobs[name], half);
  // The jaw angle's width is the jawline coordinate the references constrain least (no front view sees the angle);
  // widening it on the fitted surface itself lets the fit's lower-side face follow it.
  if (jaw) half.jawAngle[0] += jaw;
  const V = F.src.pointIds.map((id) => { const L = id.endsWith('L'), p = half[id.replace(/[RL]$/, '')]; return L ? [-p[0], p[1], p[2]] : p; });
  return { P: half, V };
}
/** The fitted surface's front-most (or rear-most) point at (x, z): a ray along y through the triangles. */
function castY(F, V, x, z, front) {
  let best = null;
  for (const [a, b, c] of F.TRIS) {
    const A = V[a], B = V[b], C = V[c];
    const den = (B[2] - C[2]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[2] - C[2]);
    if (Math.abs(den) < 1e-12) continue;
    const u = ((B[2] - C[2]) * (x - C[0]) + (C[0] - B[0]) * (z - C[2])) / den;
    const v = ((C[2] - A[2]) * (x - C[0]) + (A[0] - C[0]) * (z - C[2])) / den;
    if (u < -1e-9 || v < -1e-9 || u + v > 1 + 1e-9) continue;
    const y = u * A[1] + v * B[1] + (1 - u - v) * C[1];
    if (best === null || (front ? y > best : y < best)) best = y;
  }
  if (best === null) throw new Error(`head-fit: ${F.preset} has no surface at x=${x.toFixed(3)} z=${z.toFixed(3)}`);
  return [x, best, z];
}
/** The widest right-side point of the fitted section at height z. */
function widest(F, V, z) {
  let best = null;
  for (const tri of F.TRIS) for (let i = 0; i < 3; i++) {
    const A = V[tri[i]], B = V[tri[(i + 1) % 3]];
    if ((A[2] - z) * (B[2] - z) > 0 || A[2] === B[2]) continue;
    const p = lerp(A, B, (z - A[2]) / (B[2] - A[2]));
    if (!best || p[0] > best[0]) best = p;
  }
  return best;
}
// Rows in the landmark head's order (mouth, subnasale, nose tip, bridge, eye, glabella, frontal, vault, crown)
// and the x of the bridge / nose / ala / inner / outer slots: a named point's x, or a fraction of the section width.
// FEATURE rows (the nose rows sit ~7 mm apart; the eye row crosses the eye) sample only their face slots, the eye
// row its outer slot too (the eye pins between inner and outer, so that chord must stay on the fitted eye);
// (`own`); their skull slots are interpolated by height between the structural rows either side, so the
// cheek and skull planes run clean instead of twisting into thin strips between near-coincident rings.
const ROWS = [
  { z: 'lipSeam', x: [0.035, 0.07, 0.11, 'mouthCorner', 0.40] },
  { z: 'columella', x: [0.03, 'nostril', 'noseWing', 0.21, 0.43], own: 4 },
  { z: 'tip', x: [0.03, 0.07, 'noseWing', 0.19, 0.46], own: 4 },
  { z: 'bridge', x: [0.02, 0.05, 'noseSide', 0.16, 0.44] },
  { z: 'eyeCenter', x: [0.012, 0.025, 0.045, 0.10, 'eyeOuter'], own: 5, holdDepth: true },
  { z: 'glabella', x: [0.02, 0.05, 0.09, 'browInner', 'browOuter'] },
  { z: 'foreheadSide', frac: [0.05, 0.1, 0.16, 0.4, 0.8] },
  { z: 'vault', frac: [0.05, 0.1, 0.16, 0.4, 0.8] },
  { z: (P) => P.crown[2] - 0.04, frac: [0.05, 0.1, 0.16, 0.4, 0.8] }, // just under each head's own crown
];
const FRONT = ['bridge', 'nose', 'ala', 'inner', 'outer'], HALF = ['front', ...FRONT, 'side', 'rear', 'back'];
function ring(F, half, slots) {
  const n = slots.length, mid = n / 2;
  return Object.fromEntries(slots.map((slot, k) => {
    const p = half[slots[k <= mid ? k : n - k].replace(/R$/, '')];
    return [slot, F.toM(k > mid ? [-p[0], p[1], p[2]] : p)];
  }));
}

/** Fitted anchors under the landmark head's names, in hero metres. */
export function fittedAnchors(preset, knobs) {
  const F = fitOf(preset), { P } = deformed(F, knobs), m = (p) => F.toM(p), mirror = (p) => [-p[0], p[1], p[2]];
  const condyle = [P.earRoot[0] * 0.8, P.earRoot[1], P.earRoot[2]];
  const named = { crown: P.crown, menton: P.chinBottom, nasion: P.nasion, glabella: P.glabella, noseTip: P.tip,
    subnasale: P.columella, stomion: P.lipSeam, noseBridge: P.bridge, frontal: P.forehead, chinFront: P.chinFront, chinFold: P.chinFold };
  const sided = { eye: P.eyeCenter, tragion: P.earRoot, zygion: P.cheekbone, gonion: P.jawAngle, condyle, cheek: P.cheek };
  const out = Object.fromEntries(Object.entries(named).map(([k, p]) => [k, m(p)]));
  for (const [k, p] of Object.entries(sided)) { out[`${k}R`] = m(p); out[`${k}L`] = m(mirror(p)); }
  return out;
}

/** The cheek as four planes around a rounded apex (fit units). `on: false` renders the raw sampling for review.
 *   lead  how far the malar apex stands in front of the chord from the eye corner to the jawline (~3 mm)
 *   turn  how far along the fitted jawline, from the jaw front toward the angle, the front/side turn lands
 *   fullness  how far (~7 mm) the fullness row's side bows out past the straight ramus: the lower side rounds out
 *         (never wider than the cheekbone crest)
 *   jaw   how far (~7 mm) the jaw angle moves outward, on the fitted surface before sampling. Only the side
 *         reference sees the female's angle, so its width was a seed guess; her front-view widths at mouth and jaw
 *         height asked for this much (see the plan logs)
 *   ear   the jaw meets the ear: the rear column below the crest becomes the back of the ramus
 *   ramus how far (~12 mm) the ramus's back edge sits behind the jaw angle */
export const FIT_CHEEK = { on: true, lead: 0.03, turn: 0.25, fullness: 0.07, jaw: 0.07, ear: true, ramus: 0.12 };
/** Per-head overrides of `FIT_CHEEK`, each measured against that head's own references (see the plan logs). The
 * jaw-angle widening came from the female's front-view widths; the male's three-quarter view sees his jaw angle. */
export const FIT_TUNING = { female: {}, male: { jaw: 0 } };
const cheekOf = (preset) => ({ ...FIT_CHEEK, ...FIT_TUNING[preset] });
// Stack rows (jawline, chin front, chin fold, cranium mouth … glabella): the cheek's corner rows, its fullness row,
// and the rows between.
const JAW = 0, FULL = 4, CREST = 6, EYE = 7, UPPER = [5], LOWER = [1, 2, 3], MOUTH = 3;
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** The plane through three points: { n, d } with n·p = d. */
function plane3(a, b, c) { const n = cross3(sub3(b, a), sub3(c, a)); return { n, d: dot3(n, a) }; }
/** On plane P: the missing coordinate `axis` (0 = x, 1 = y) of a point given the others. */
function solveOn(P, p, axis) { const q = [...p]; q[axis] = 0; q[axis] = (P.d - dot3(P.n, q)) / P.n[axis]; return q; }
/** Best-fit plane distance (Newell normal through the centroid) of points from a polygon's plane. */
function planeDeviation(poly, pts) {
  const n = [0, 0, 0], c = [0, 1, 2].map((k) => poly.reduce((s, p) => s + p[k], 0) / poly.length);
  poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length]; n[0] += (p[1] - q[1]) * (p[2] + q[2]); n[1] += (p[2] - q[2]) * (p[0] + q[0]); n[2] += (p[0] - q[0]) * (p[1] + q[1]); });
  const l = Math.hypot(...n) || 1;
  return Math.max(...pts.map((p) => Math.abs(dot3(n, sub3(p, c))) / l));
}
/** Depth-first plane y = a·x + b·z + c through points (least squares); returns the plane's y at (x, z). */
function depthPlane(pts) {
  const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], v = [0, 0, 0];
  for (const [x, y, z] of pts) { const r = [x, z, 1]; for (let i = 0; i < 3; i++) { v[i] += r[i] * y; for (let j = 0; j < 3; j++) M[i][j] += r[i] * r[j]; } }
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(M), c = [0, 1, 2].map((k) => det(M.map((row, i) => row.map((e, j) => (j === k ? v[i] : e)))) / D);
  return (x, z) => c[0] * x + c[1] * z + c[2];
}
/** The cheek's corner grid (eye / crest / fullness / jawline × nose side / turn / ear) and its flat planes: four
 * around the apex, and the lower side (one mass from the nose line down to the jawline). */
export function cheekQuads(G) {
  return { underEyeFront: [G.Ei, G.Eo, G.A, G.Ci], underEyeSide: [G.Eo, G.Es, G.Cs, G.A],
    upperFront: [G.Ci, G.A, G.Mo, G.Mi], upperSide: [G.A, G.Cs, G.Ms, G.Mo], lowerSide: [G.Mo, G.Ms, G.Js, G.Jo] };
}
/** Build the planes in place on the stack, by construction rather than search. Held: the eye row (the eye pins
 * on its inner / outer chord; its side with the crest side carries the ear), the jaw front and jaw angle (the fit's
 * jawline). Then, in order:
 *   1. the under-eye side plane runs through the eye corner and the two ear-side corners; the apex sits on it at
 *      crest height, `lead` in front of the chord from the eye corner to the jawline (the rounded mass), never
 *      inside the fit; the crest's nose-side corner takes its depth from the under-eye front plane;
 *   2. the fullness row: its side point bows `fullness` outward past the straight ramus from crest to jaw angle
 *      (no cavity), its turn point lies on the upper side plane (apex, crest side, that point) at the straight
 *      turn's depth, and its nose-side point on the upper front plane (crest inner, apex, turn point);
 *   3. below the fullness row the lower side is one flat mass down to the jawline: the plane of the fullness row's
 *      turn and side and the jaw angle. The side column keeps the volume (down the bowed ramus to the jaw angle);
 *      the front/side corner keeps the fitted jawline's height and depth `turn` along it and moves only across the
 *      face onto the plane. The chin rows' nose-side points are read off the fitted chin.
 * No lower-front plane could also meet the fitted jawline without pulling the turn far behind the face (see the
 * plan log), so the lower front follows the fit. */
function cheekPlanes(F, V, P, stack, cfg) {
  const eye = stack[EYE], crest = stack[CREST], full = stack[FULL], jaw = stack[JAW], { lead, fullness, turn } = cfg;
  const Ei = eye.inner, Eo = eye.outer, Es = eye.side, Cs = crest.side, Ji = jaw.inner, Js = jaw.side, z = crest.outer[2];
  const side = depthPlane([Eo, Es, Cs]);
  const guess = jaw.outer, t = (z - Eo[2]) / (guess[2] - Eo[2]);
  let depth = Eo[1] + (guess[1] - Eo[1]) * t + lead;
  const xAt = (y) => { const f0 = side(0, z), f1 = side(1, z); return (y - f0) / (f1 - f0); };
  let ax = xAt(depth); const surf = castY(F, V, ax, z, true)[1];
  if (depth < surf) { depth = surf; ax = xAt(depth); }
  const A = [ax, depth, z];
  const Ci = solveOn(plane3(Ei, Eo, A), crest.inner, 1);
  const along = (a, b, zz) => lerp(a, b, Math.max(0, Math.min(1, (zz - a[2]) / (b[2] - a[2]))));
  // The fitted jawline, front to angle, and a point `u` of the way along it (by length).
  const line = [Ji, ...(P.jawSweep ? [P.jawSweep] : []), Js], lens = line.slice(1).map((p, i) => Math.hypot(...sub3(p, line[i])));
  const onLine = (u) => { let d = u * lens.reduce((a, b) => a + b, 0); for (let i = 0; i < lens.length; i++) { if (d <= lens[i] || i === lens.length - 1) return lerp(line[i], line[i + 1], Math.min(1, d / lens[i])); d -= lens[i]; } };
  const J0 = onLine(turn), straight = along(A, J0, full.outer[2]);
  const zm = full.side[2], ramus = along(Cs, Js, zm);
  // The bow never widens the lower face past the cheekbone crest (the face is widest across the cheekbones).
  const Ms = [Math.min(ramus[0] + fullness, Cs[0]), ramus[1], zm];
  const Mo = solveOn(plane3(A, Cs, Ms), [0, straight[1], full.outer[2]], 0);
  const upperFront = plane3(Ci, A, Mo), Mi = solveOn(upperFront, full.inner, 1);
  // Below the fullness row the lower side is one mass from the nose line down to the jawline: one plane through
  // the fullness row's turn and side and the jaw angle. The turn corner keeps the fitted jawline's height and depth
  // `turn` along it and moves only across the face onto that plane, so the jaw outline stays the fit's.
  const lowerSide = plane3(Mo, Ms, Js), Jo = solveOn(lowerSide, J0, 0), lowerFront = plane3(Mi, Mo, Jo);
  crest.outer = A; crest.inner = Ci; full.side = Ms; full.outer = Mo; full.inner = Mi; jaw.outer = Jo;
  for (const i of UPPER) {
    const r = stack[i];
    r.outer = along(A, Mo, r.outer[2]); r.side = along(Cs, Ms, r.side[2]); r.inner = solveOn(upperFront, r.inner, 1);
  }
  // Every row below lies on that mass's edges (the turn from the fullness row to the jaw corner, the side column down
  // the bowed ramus to the jaw angle), so it shades as one plane; the mouth row's nose-side point joins the lower
  // front, and the chin rows' nose-side points stay on the fit's own chin.
  for (const i of LOWER) {
    const r = stack[i];
    r.outer = along(Mo, Jo, r.outer[2]); r.side = along(Ms, Js, r.side[2]);
    if (i === MOUTH) r.inner = solveOn(lowerFront, r.inner, 1);
  }
}

/** The jaw meets the ear. Below the crest the rear column was the landmark cage's hinge lift (straight up to the
 * condyle), which left a notch behind the jaw angle and a cavity under the ear lobe. Now it is the ramus's back
 * edge, each point at its own row's height so the lower cheek, the jaw and the ear close as one surface. The
 * midline back slots keep their lift, so the jaw still hinges by the ear. */
function earConnect(P, stack, cfg) {
  // The ramus's back edge runs parallel to the side column, `ramus` behind it: the band between them is one flat
  // strip per ramus segment, from under the jaw angle up to the ear, where the side column carries the worn ear.
  for (const row of stack.slice(0, CREST)) row.rear = [row.side[0] - 0.01, row.side[1] - cfg.ramus, row.side[2]];
}

/** A fitted head's cranium stations (row points on the landmark head's slots) and the jaw's two lower rings. */
export function fittedCage(preset, knobs, slots) {
  const F = fitOf(preset), cfg = cheekOf(preset), { P, V } = deformed(F, knobs, cfg.on ? cfg.jaw : 0);
  const halves = ROWS.map((row) => {
    const z = typeof row.z === 'function' ? row.z(P) : P[row.z][2];
    const side = widest(F, V, z), W = side[0];
    const xs = row.x ? row.x.map((x) => (typeof x === 'string' ? P[x][0] : x)) : row.frac.map((f) => f * W);
    const half = { front: castY(F, V, 0, z, true), side: [W, side[1], z], rear: castY(F, V, 0.8 * W, z, false), back: castY(F, V, 0, z, false) };
    FRONT.forEach((k, i) => { half[k] = castY(F, V, xs[i], z, true); });
    const named = new Set(row.x ? FRONT.filter((k, i) => typeof row.x[i] === 'string') : []);
    return { z, half, named, holdDepth: !!row.holdDepth, own: row.own ?? HALF.length };
  });
  for (const [i, row] of halves.entries()) {
    if (row.own === HALF.length) continue;
    let lo = i - 1, hi = i + 1;
    while (halves[lo].own < HALF.length) lo--;
    while (halves[hi].own < HALF.length) hi++;
    const t = (row.z - halves[lo].z) / (halves[hi].z - halves[lo].z);
    for (const k of HALF.slice(row.own + 1)) { const p = lerp(halves[lo].half[k], halves[hi].half[k], t); row.half[k] = [p[0], p[1], row.z]; }
  }
  // The jawline: chin, chin sides and the mandible's lower border to its angle, then up behind it.
  const behind = lerp(P.jawAngle, P.earLobe, 0.6);
  const jaw0 = { front: P.chinBottom, bridge: lerp(P.chinBottom, P.chinSide, 0.35), nose: lerp(P.chinBottom, P.chinSide, 0.7),
    ala: P.chinSide, inner: P.jawFront, outer: lerp(P.jawFront, P.jawAngle, 0.5), side: P.jawAngle,
    rear: [behind[0] * 0.9, behind[1], behind[2]], back: [0, behind[1], behind[2]] };
  // The chin as the fit draws it: chin front, then the fold under the lower lip. Their near-midline points are read
  // off the fitted surface (the fit's own chin planes); their other points start at their own heights between the
  // jawline and the mouth row, where the cheek planes and the ear take them.
  const mouth = halves[0].half, zOf = (p) => p[2];
  const chinRow = (front, innerX) => {
    const z = zOf(front), t = (z - zOf(jaw0.front)) / (zOf(mouth.front) - zOf(jaw0.front)), row = { front: [...front] };
    for (const k of ['bridge', 'nose', 'ala']) row[k] = castY(F, V, mouth[k][0], z, true);
    row.inner = castY(F, V, innerX, z, true);
    for (const k of ['outer', 'side', 'rear', 'back']) row[k] = lerp(jaw0[k], mouth[k], t);
    return row;
  };
  const chin = chinRow(P.chinFront, P.chinSide[0]);
  const fold = chinRow(P.chinFold, lerp(P.jawFront, P.mouthCorner, (zOf(P.chinFold) - zOf(P.jawFront)) / (zOf(P.mouthCorner) - zOf(P.jawFront)))[0]);
  const stack = [jaw0, chin, fold, ...halves.map((r) => r.half)];
  if (cfg.on) cheekPlanes(F, V, P, stack, cfg);
  if (cfg.on && cfg.ear) earConnect(P, stack, cfg);
  const rowsZ = halves.map((r) => F.toM([0, 0, r.z])[2]);
  return { cranium: stack.slice(3).map((h) => ring(F, h, slots)), jaw: stack.slice(0, 3).map((h) => ring(F, h, slots)), rowsZ, crown: F.toM(P.crown),
    jawRows: 3, earConnected: cfg.on && cfg.ear };
}

/** The cheek planes of a built head (hero metres): each plane's flatness (largest distance, mm, of its corners and
 * of every row between from its plane), the apex's lead and the fullness row's bow past the straight ramus (mm).
 * Below the fullness row only the lower side is a plane; the lower front and the chin follow the fit. */
export function cheekReport(parts) {
  const rows = [...parts.jaw.stations.slice(0, -1), ...parts.cranium.stations].map((st) => st.points);
  const c = (i, slot) => rows[i][`${slot}R`];
  const G = { Ei: c(EYE, 'inner'), Eo: c(EYE, 'outer'), Es: c(EYE, 'side'), Ci: c(CREST, 'inner'), A: c(CREST, 'outer'), Cs: c(CREST, 'side'),
    Mi: c(FULL, 'inner'), Mo: c(FULL, 'outer'), Ms: c(FULL, 'side'), Ji: c(JAW, 'inner'), Jo: c(JAW, 'outer'), Js: c(JAW, 'side') };
  const between = { upperFront: [UPPER, ['inner', 'outer']], upperSide: [UPPER, ['outer', 'side']], lowerSide: [LOWER, ['outer', 'side']] };
  const planes = Object.fromEntries(Object.entries(cheekQuads(G)).map(([name, q]) => {
    const [rs, slots] = between[name] ?? [[], []];
    return [name, r6(planeDeviation(q, [...q, ...rs.flatMap((i) => slots.map((slot) => c(i, slot)))]) * 1000)];
  }));
  const lead = G.A[1] - depthPlane([G.Eo, G.Ci, G.Jo, G.Cs])(G.A[0], G.A[2]);
  const t = (G.Ms[2] - G.Cs[2]) / (G.Js[2] - G.Cs[2]), chordX = G.Cs[0] + (G.Js[0] - G.Cs[0]) * t;
  return { flatnessMm: planes, apexLeadMm: r6(lead * 1000), sideFullnessMm: r6((G.Ms[0] - chordX) * 1000) };
}

// Review: each head's fitted reference cameras (orthographic), applied to anything in the hero head frame.
/** The reference views a head was fitted to. */
export const fitViews = (preset) => Object.keys(fitOf(preset).report.views);
/** What the fit KNOWS and what it assumes: the views it was fitted to (their fitted yaw, rounded), and the views it only
 * infers (the male's front: no reference existed, so his width across the face rests on the template). The report's
 * "observed / estimated / unseen" labels as data, from the frozen fit report. */
export function fitEvidence(preset) {
  const R = fitOf(preset).report;
  return { observed: Object.entries(R.views).map(([view, v]) => ({ view, yawDegrees: Math.round(Math.abs(v.camera.yawDegrees)) })), inferred: R.frontIsInferred || R.inferredFront ? ['front'] : [] };
}
function fitProject(p, c) {
  const [a, b, d] = [c.yawDegrees, c.pitchDegrees, c.rollDegrees].map((x) => x * Math.PI / 180);
  const X = p[0] * Math.cos(a) + p[1] * Math.sin(a), depth = -p[0] * Math.sin(a) + p[1] * Math.cos(a);
  const Y = -p[2] * Math.cos(b) + depth * Math.sin(b), k = c.pixelsPerUnit;
  return [c.translateX + k * (X * Math.cos(d) - Y * Math.sin(d)), c.translateY + k * (X * Math.sin(d) + Y * Math.cos(d)), -k * (depth * Math.cos(b) + p[2] * Math.sin(b))];
}
/** A mesh in hero head metres re-expressed so depth-raster's pinhole camera reproduces a fitted orthographic
 * camera: 1e6 px away on the image centre (float32 depth still resolves; under 0.03 px from orthographic). */
export function fitCameraSource(preset, mesh, view, size = 600, { metres = true, yawDegrees } = {}) {
  const F = fitOf(preset), fitted = F.report.views[view].camera, D = 1e6, o = size / 2;
  const c = yawDegrees === undefined ? fitted : { ...fitted, yawDegrees }; // a turned camera: an unscored view
  const vertices = mesh.vertices.map((v) => { const [x, y, z] = fitProject(metres ? F.fromM(v) : v, c); return [x - o, y - o, z]; });
  return { source: { vertices, faces: mesh.faces }, cam: { position: [0, 0, -D], R: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], f: D, principal: [o, o], size } };
}
/** Silhouette agreement (IoU of covered pixels) between a head in hero metres and its fitted source, per camera. */
export function fitSilhouetteAgreement(preset, mesh, res = 300) {
  const F = fitOf(preset), fitted = { vertices: F.src.vertices, faces: F.src.faces };
  return Object.fromEntries(fitViews(preset).map((view) => {
    const a = fitCameraSource(preset, mesh, view), b = fitCameraSource(preset, fitted, view, 600, { metres: false });
    const A = rasterDepth(a.source, a.cam, res).face, B = rasterDepth(b.source, b.cam, res).face;
    let both = 0, either = 0;
    for (let i = 0; i < A.length; i++) { const x = A[i] >= 0, y = B[i] >= 0; both += x && y; either += x || y; }
    return [view, r6(both / either)];
  }));
}
