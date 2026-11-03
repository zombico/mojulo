/**
 * mecha-parts — a builder per kind of part (mecha-odm.js MECHA_KINDS), each drawing its part in ITS BODY's frame: the
 * pelvis in its own (the root), a body on a leg about its pivot, hanging along −z. A part's hardpoints are where its
 * children, its rams and the rider meet it, in that frame.
 *
 *   builder(row, C, ctx) → { lathes?, sweeps?, extrudes?, lofts?, hardpoints, outline? }
 *     C      the palette's six colours
 *     ctx    { side: 'r' | 'l' (a leg's: the left's is the right's design drawn mirrored), part (a ram's 'barrel' | 'rod') }
 *
 * A ram is the construction shelf's (its barrel and its rod drawn along +y from their own pins, aimed by the chain). A
 * foot's `outline` is its sole's corners (what it stands on: the support polygon's). Pure: no clock, no dice. A part's
 * emission for its row is a compatibility promise (mecha-shelf.char.test.js). A family picks a kind's design: a seat
 * astride or a platform stood on, a convertible's cabin or a torso frame.
 */
import { CON_BUILDERS } from '../construction-shelf/con-parts.js';
import { add, box, extrudeWorld, loftWorld, mul, pod, roundRect, spin, sub, tone, tube, unit } from './mecha-common.js';

const sgn = (side) => (side === 'l' ? -1 : 1);
/** A pin's boss along an axis through a point: `along` 'x' | 'y' | 'z', from −h to +h about it, `r` round. */
function boss(id, p, along, h, r, tint, samples = 16) {
  const k = { x: 0, y: 1, z: 2 }[along], a = [...p], b = [...p];
  a[k] -= h; b[k] += h;
  return spin(id, a, b, [[0, r], [1, r]], tint, samples);
}
/** A box beam along −z from z0 down to z1, its section `w` across x and `d` deep along y, tapering to w1 × d1. */
function legBeam(id, z0, z1, w, d, w1, d1, tint, r = 0.022, at = [0, 0]) {
  const from = [at[0], at[1], z0], to = [at[0], at[1], z1], ax = sub(to, from);
  return loftWorld(id, from, to, [{ t: 0, points: roundRect(ax, w, d, r, 2, [0, 1, 0]) }, { t: 1, points: roundRect(ax, w1, d1, r, 2, [0, 1, 0]) }], tint);
}
/** A plate standing square to x between x0 and x1, its outline [[y, z]…] wound to face out either way. */
function slab(id, x0, x1, outline, tint) {
  const area = outline.reduce((s, p, i) => { const q = outline[(i + 1) % outline.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
  const o = area * Math.sign(x1 - x0 || 1) < 0 ? outline.slice().reverse() : outline;
  const yc = o.reduce((s, p) => s + p[0], 0) / o.length, zc = o.reduce((s, p) => s + p[1], 0) / o.length;
  return extrudeWorld(id, [x0, yc, zc], [x1, yc, zc], o.map(([y, z]) => [0, y - yc, z - zc]), tint);
}
/** A polyline's corners rounded: each inner corner cut back `r` each way and bridged by `k` points (a bent tube). */
function rounded(pts, r, k = 3) {
  const out = [pts[0]];
  for (let i = 1; i + 1 < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1], u = unit(sub(a, b)), v = unit(sub(c, b));
    const p = add(b, mul(u, r)), q = add(b, mul(v, r));
    for (let j = 0; j <= k; j++) { const t = j / k, s = 1 - t; out.push(add(add(mul(p, s * s), mul(b, 2 * s * t)), mul(q, t * t))); }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// ── the pelvis: the keel (the battery's case), the hip beams and the yaw bearings ────────────────────────────────
function pelvis(row, C) {
  const d = row.dims, K = d.keel, extrudes = [], lathes = [], sweeps = [];
  const zc = (K.z0 + K.z1) / 2, frame = C.trim, dark = tone(C.trim, -0.2);
  extrudes.push(box('keel', [0, K.y0, zc], [0, K.y1, zc], K.w, K.z1 - K.z0, frame));
  // (the battery's case: its lid's panels in the cover colour, its ribs dark)
  extrudes.push(box('lid', [0, K.y0 + 0.36, K.z1 + 0.006], [0, K.y1 - 0.04, K.z1 + 0.006], K.w - 0.05, 0.012, C.paint));
  for (const [i, y] of [-0.12, 0.1].entries()) extrudes.push(box(`rib_${i}`, [-K.w / 2 - 0.006, y, zc], [K.w / 2 + 0.006, y, zc], 0.03, K.z1 - K.z0 - 0.04, dark));
  extrudes.push(box('skid', [0, K.y0 + 0.05, K.z0 - 0.012], [0, K.y1 - 0.02, K.z0 - 0.012], K.w + 0.03, 0.024, tone(C.trim, 0.12)));
  // (the warning mark on the battery's flank)
  for (const s of [1, -1]) extrudes.push(box(`mark_${s > 0 ? 'r' : 'l'}`, [s * (K.w / 2 + 0.004), -0.02, zc], [s * (K.w / 2 + 0.01), -0.02, zc], 0.16, 0.05, C.light));
  for (const s of [1, -1]) {
    const side = s > 0 ? 'r' : 'l', x = s * d.hipX, D = d.drum;
    extrudes.push(box(`beam_${side}`, [s * (K.w / 2 - 0.02), 0, 0.02], [s * (d.hipX - D.r + 0.02), 0, 0.02], 0.17, 0.12, frame));
    lathes.push(spin(`drum_${side}`, [x, 0, D.z0], [x, 0, D.z1], [[0, D.r * 0.9], [0.12, D.r], [0.86, D.r], [1, D.r * 0.82]], C.paint, 20));
    lathes.push(spin(`ring_${side}`, [x, 0, D.z0 - 0.006], [x, 0, D.z0 + 0.03], [[0, D.r + 0.008], [1, D.r + 0.008]], dark, 20));
  }
  return {
    extrudes, lathes, sweeps,
    hardpoints: { 'hip.r': [d.hipX, 0, d.drum.z0], 'hip.l': [-d.hipX, 0, d.drum.z0], seat: [...d.seat], cage: [...d.cage], pack: [...d.pack] },
  };
}

// ── a hip's yaw housing: its drive, its roll clevis, its roll ram's arm ──────────────────────────────────────────
function hip(row, C, { side }) {
  const d = row.dims, s = sgn(side), lathes = [], extrudes = [], dark = tone(C.trim, -0.15);
  lathes.push(spin('drive', [0, 0, 0], [0, 0, -0.055], [[0, d.r], [0.7, d.r], [1, d.r * 0.82]], C.trim, 20));
  lathes.push(spin('motor', [0, -0.05, -0.028], [0, -0.17, -0.028], [[0, 0.038], [0.85, 0.038], [1, 0.03]], dark, 14));
  for (const y of [0.066, -0.066]) extrudes.push(box(`lug_${y > 0 ? 'f' : 'b'}`, [0, y, -0.03], [0, y, -d.drop - 0.045], 0.1, 0.024, C.trim));
  lathes.push(boss('pin', [0, 0, -d.drop], 'y', 0.082, 0.022, C.chrome, 12));
  const P = [s * d.rollRam[0], d.rollRam[1], d.rollRam[2]];
  extrudes.push(box('arm', [s * 0.05, 0, -0.02], P, 0.07, 0.05, C.trim));
  lathes.push(boss('armEye', P, 'y', 0.035, 0.03, dark, 12));
  return { lathes, extrudes, hardpoints: { roll: [0, 0, -d.drop], rollRam: P } };
}

// ── a hip's roll yoke: the trunnion, the pitch axle, the horn, the roll ram's arm ────────────────────────────────
function yoke(row, C, { side }) {
  const d = row.dims, s = sgn(side), lathes = [], extrudes = [], dark = tone(C.trim, -0.15);
  lathes.push(boss('trunnion', [0, 0, 0], 'y', 0.05, 0.048, C.trim, 16));
  extrudes.push(box('block', [0, 0, 0.012], [0, 0, -d.drop + 0.01], 0.1, 0.09, C.trim));
  for (const t of [1, -1]) extrudes.push(box(`cheek_${t > 0 ? 'o' : 'i'}`, [t * 0.086, 0, -0.012], [t * 0.086, 0, -d.drop - 0.04], 0.018, 0.1, C.trim));
  lathes.push(boss('axle', [0, 0, -d.drop], 'x', 0.098, 0.032, C.chrome, 12));
  const H = [...d.horn];
  extrudes.push(box('horn', [0, Math.sign(H[1]) * 0.03, H[2] - 0.005], H, 0.05, 0.045, C.trim));
  lathes.push(boss('hornEye', H, 'x', 0.03, 0.026, dark, 12));
  const E = [s * d.rollEye[0], d.rollEye[1], d.rollEye[2]];
  extrudes.push(box('arm', [s * 0.09, 0, -0.03], E, 0.05, 0.045, C.trim));
  lathes.push(boss('armEye', E, 'y', 0.03, 0.026, dark, 12));
  return { lathes, extrudes, hardpoints: { pitch: [0, 0, -d.drop], horn: H, rollEye: E } };
}

// ── a thigh: its box beam, the knee's clevis, the rams' brackets ─────────────────────────────────────────────────
function thigh(row, C, { side }) {
  const d = row.dims, s = sgn(side), L = d.length, lathes = [], extrudes = [], lofts = [], dark = tone(C.trim, -0.15);
  lathes.push(boss('hub', [0, 0, 0], 'x', 0.07, 0.068, C.trim, 18));
  const zc = -(L - d.clevis);
  lofts.push(legBeam('beam', -0.03, zc + 0.02, d.w, d.d0, d.w * 0.92, d.d1, C.paint));
  // (the cover's seam: a dark band round the beam a third of the way down)
  lofts.push(legBeam('band', -0.17, -0.2, d.w + 0.01, d.d0 * 0.9 + 0.01, d.w + 0.01, d.d0 * 0.88 + 0.01, dark, 0.02));
  for (const t of [1, -1]) extrudes.push(box(`clevis_${t > 0 ? 'o' : 'i'}`, [t * 0.07, 0, zc + 0.04], [t * 0.07, 0, -L - 0.05], 0.02, d.d1 + 0.03, C.trim));
  lathes.push(boss('kneePin', [0, 0, -L], 'x', 0.088, 0.028, C.chrome, 12));
  const H = [0, d.hipRam[1], d.hipRam[2]], K = [s * d.kneeRam[0], d.kneeRam[1], d.kneeRam[2]];
  extrudes.push(box('hipBracket', [0, Math.sign(H[1]) * (d.d1 / 2 - 0.01), H[2] + 0.01], H, 0.05, 0.05, C.trim));
  lathes.push(boss('hipEye', H, 'x', 0.032, 0.026, dark, 12));
  extrudes.push(box('kneeBracket', [s * 0.03, Math.sign(K[1]) * 0.03, K[2]], K, 0.05, 0.05, C.trim));
  lathes.push(boss('kneeEye', K, 'x', 0.034, 0.028, dark, 12));
  return { lathes, extrudes, lofts, hardpoints: { knee: [0, 0, -L], hipRam: H, kneeRam: K } };
}

// ── a shank: the knee's hub, its box beam, the ankle's clevis, its horn and its bracket ──────────────────────────
function shank(row, C, { side }) {
  const d = row.dims, s = sgn(side), L = d.length, lathes = [], extrudes = [], lofts = [], dark = tone(C.trim, -0.15);
  lathes.push(boss('hub', [0, 0, 0], 'x', 0.058, 0.066, C.trim, 18));
  const zc = -(L - d.clevis);
  lofts.push(legBeam('beam', -0.05, zc + 0.02, d.w, d.d0, d.w * 0.9, d.d1, C.paint));
  lofts.push(legBeam('band', -0.3, -0.33, d.w + 0.01, d.d0 * 0.82 + 0.01, d.w + 0.01, d.d0 * 0.8 + 0.01, dark, 0.02));
  for (const t of [1, -1]) extrudes.push(box(`clevis_${t > 0 ? 'o' : 'i'}`, [t * 0.072, 0, zc + 0.04], [t * 0.072, 0, -L - 0.045], 0.02, d.d1 + 0.02, C.trim));
  lathes.push(boss('anklePin', [0, 0, -L], 'x', 0.09, 0.024, C.chrome, 12));
  const K = [s * d.kneeEye[0], d.kneeEye[1], d.kneeEye[2]], A = [0, d.ankleRam[1], d.ankleRam[2]];
  extrudes.push(box('horn', [s * 0.02, Math.sign(K[1]) * 0.035, K[2] + 0.02], K, 0.05, 0.05, C.trim));
  lathes.push(boss('hornEye', K, 'x', 0.03, 0.026, dark, 12));
  extrudes.push(box('ankleBracket', [0, Math.sign(A[1]) * (d.d0 / 2 - 0.01), A[2] - 0.01], A, 0.05, 0.05, C.trim));
  lathes.push(boss('ankleEye', A, 'x', 0.03, 0.024, dark, 12));
  return { lathes, extrudes, lofts, hardpoints: { ankle: [0, 0, -L], kneeEye: K, ankleRam: A } };
}

// ── an ankle's cross: the spider, its trunnions, its roll drive, the ankle ram's horn ────────────────────────────
function ankle(row, C) {
  const d = row.dims, lathes = [], extrudes = [], dark = tone(C.trim, -0.15);
  extrudes.push(box('spider', [0, -0.05, 0], [0, 0.05, 0], 0.11, 0.09, C.trim));
  lathes.push(boss('pitchPin', [0, 0, 0], 'x', 0.064, 0.026, C.chrome, 12));
  lathes.push(boss('rollPin', [0, 0, 0], 'y', 0.082, 0.026, C.chrome, 12));
  const H = [...d.horn], aft = Math.sign(H[1]);
  // (its roll drive on the side away from the ram's horn)
  lathes.push(spin('drive', [0, -aft * 0.085, 0.0], [0, -aft * 0.15, 0.0], [[0, d.r * 0.9], [0.8, d.r * 0.9], [1, d.r * 0.7]], dark, 14));
  extrudes.push(box('horn', [0, aft * 0.05, 0.012], H, 0.045, 0.045, C.trim));
  lathes.push(boss('hornEye', H, 'x', 0.03, 0.024, dark, 12));
  return { lathes, extrudes, hardpoints: { roll: [0, 0, 0], horn: H } };
}

// ── a foot: its plate, its ears round the cross, its sole pads, its toe guard ───────────────────────────────────
function foot(row, C) {
  const d = row.dims, extrudes = [], y0 = -d.heel, y1 = d.length - d.heel, zs = -d.sole, zp = zs + d.pad, zt = zp + d.plate;
  extrudes.push(box('plate', [0, y0 + 0.01, (zp + zt) / 2], [0, y1 - 0.03, (zp + zt) / 2], d.w, d.plate, C.trim));
  // (the sole: a heel pad and a toe pad, the arch between them clear of the ground)
  extrudes.push(box('heelPad', [0, y0, zs + d.pad / 2], [0, y0 + 0.17, zs + d.pad / 2], d.w, d.pad, C.rubber));
  extrudes.push(box('toePad', [0, y1 - 0.2, zs + d.pad / 2], [0, y1, zs + d.pad / 2], d.w, d.pad, C.rubber));
  extrudes.push(box('arch', [0, y0 + 0.17, zs + d.pad * 0.65], [0, y1 - 0.2, zs + d.pad * 0.65], d.w - 0.02, d.pad * 0.7, tone(C.rubber, 0.12)));
  // (the toe guard: a plate raked up at the front, the cover colour)
  extrudes.push(slab('toeGuard', -d.w / 2, d.w / 2, [[y1 - 0.17, zt], [y1 - 0.01, zt], [y1 + 0.005, zt - 0.02], [y1 - 0.02, zt + 0.045], [y1 - 0.17, zt + 0.06]], C.paint));
  extrudes.push(slab('heelGuard', -d.w / 2 + 0.01, d.w / 2 - 0.01, [[y0 + 0.005, zt], [y0 + 0.05, zt], [y0 + 0.05, zt + 0.035], [y0 + 0.02, zt + 0.03]], tone(C.trim, 0.1)));
  // (the ears round the cross's roll trunnions, fore and aft)
  for (const y of [0.096, -0.096]) extrudes.push(box(`ear_${y > 0 ? 'f' : 'b'}`, [0, y, zt - 0.005], [0, y, 0.035], 0.09, 0.022, C.trim));
  const corners = [[-d.w / 2, y0, zs], [d.w / 2, y0, zs], [d.w / 2, y1, zs], [-d.w / 2, y1, zs]];
  return { extrudes, hardpoints: { sole: [0, 0, zs], toe: [0, y1, zs], heel: [0, y0, zs] }, outline: corners };
}

// ── the rider's place astride: the spine, the saddle, the tank, the nose, the clip-ons, the pegs ─────────────────
function seat(row, C) {
  const d = row.dims, extrudes = [], lathes = [], sweeps = [], lofts = [], cushion = tone(C.rubber, 0.16), frame = C.trim;
  // (the spine over the keel, the saddle's and the tank's frame, on two posts)
  extrudes.push(box('spine', [0, -0.5, 0.15], [0, 0.6, 0.15], 0.12, 0.09, frame));
  for (const [i, y] of [-0.3, 0.12].entries()) extrudes.push(box(`post_${i}`, [0, y, 0.0], [0, y, 0.12], 0.1, 0.08, frame, [0, 1, 0]));
  // (the tank: gripped by the knees, its top a pad the rider's chest leans toward)
  lofts.push(pod('tank', [{ y: 0.0, z: 0.3, w: 0.22, h: 0.12 }, { y: 0.12, z: 0.36, w: 0.32, h: 0.26 }, { y: 0.3, z: 0.38, w: 0.34, h: 0.28 }, { y: 0.44, z: 0.34, w: 0.28, h: 0.2 }], C.paint));
  for (const s of [1, -1]) extrudes.push(box(`kneeGrip_${s > 0 ? 'r' : 'l'}`, [s * 0.163, 0.05, 0.37], [s * 0.163, 0.24, 0.37], 0.014, 0.12, C.rubber));
  extrudes.push(box('chestPad', [0, 0.1, 0.512], [0, 0.32, 0.512], 0.2, 0.035, cushion));
  // (the saddle: wide under the sit bones, narrow at the tank where the thighs close round it; the tail's hump behind)
  lofts.push(pod('saddle', [{ y: -0.34, z: 0.3, w: 0.2, h: 0.08 }, { y: -0.2, z: 0.3, w: 0.28, h: 0.09 }, { y: -0.04, z: 0.29, w: 0.24, h: 0.08 }, { y: 0.04, z: 0.28, w: 0.16, h: 0.06 }], cushion));
  extrudes.push(box('pan', [0, -0.34, 0.235], [0, 0.04, 0.235], 0.22, 0.03, frame));
  lofts.push(pod('tail', [{ y: -0.56, z: 0.37, w: 0.12, h: 0.08 }, { y: -0.44, z: 0.37, w: 0.24, h: 0.16 }, { y: -0.33, z: 0.35, w: 0.26, h: 0.12 }], C.paint));
  extrudes.push(box('taillight', [0, -0.575, 0.37], [0, -0.555, 0.37], 0.1, 0.04, C.light));
  // (the nose: one shape from the cabin's front, as wide as its tub and as high as its windshield's foot, drawn down and
  // in to a narrow rounded leading edge; its lamps strips flush along its flanks)
  lofts.push(pod('nose', [
    { y: 0.66, z: 0.3, w: 0.69, h: 0.38, r: 0.05 }, { y: 0.8, z: 0.285, w: 0.62, h: 0.34, r: 0.09 }, { y: 0.94, z: 0.265, w: 0.44, h: 0.27, r: 0.09 },
    { y: 1.03, z: 0.245, w: 0.2, h: 0.18, r: 0.07 }, { y: 1.08, z: 0.24, w: 0.05, h: 0.1, r: 0.024 },
  ], C.paint));
  for (const s of [1, -1]) {
    const side = s > 0 ? 'r' : 'l';
    extrudes.push(box(`lamp_${side}`, [s * 0.305, 0.83, 0.33], [s * 0.19, 1.0, 0.29], 0.012, 0.035, C.glass));
    extrudes.push(box(`marker_${side}`, [s * 0.305, 0.83, 0.25], [s * 0.2, 0.98, 0.235], 0.01, 0.014, C.light));
  }
  // (the display inside the cockpit, under the windshield's foot)
  extrudes.push(slab('display', -0.1, 0.1, [[0.56, 0.46], [0.6, 0.46], [0.64, 0.5], [0.61, 0.52]], tone(C.glass, -0.3)));
  // (the clip-on bars, each from the head under the windshield out to its grip; the rider walks it by the grips' sticks)
  for (const s of [1, -1]) {
    const side = s > 0 ? 'r' : 'l', g = [s * d.grip[0], d.grip[1], d.grip[2]], P = [s * d.peg[0], d.peg[1], d.peg[2]], S = [s * d.step[0], d.step[1], d.step[2]];
    sweeps.push(tube(`clip_${side}`, [[s * 0.1, g[1] - 0.04, g[2] - 0.05], [s * 0.19, g[1] - 0.01, g[2] - 0.01], [g[0] - s * 0.05, g[1], g[2]]], 0.016, frame, 8));
    lathes.push(spin(`grip_${side}`, [g[0] - s * 0.06, g[1], g[2]], [g[0] + s * 0.06, g[1], g[2]], [[0, 0.018], [0.15, 0.021], [0.85, 0.021], [1, 0.017]], C.rubber, 12));
    lathes.push(spin(`thumb_${side}`, [g[0] - s * 0.05, g[1] + 0.01, g[2] + 0.02], [g[0] - s * 0.05, g[1] + 0.01, g[2] + 0.045], [[0, 0.011], [1, 0.011]], C.light, 10));
    // (the peg set back under the hip, its hanger from the spine; the boarding step hung below it)
    extrudes.push(box(`hanger_${side}`, [s * 0.05, P[1] + 0.06, 0.12], [P[0] - s * 0.03, P[1] + 0.02, P[2] + 0.02], 0.05, 0.03, frame));
    lathes.push(spin(`peg_${side}`, [P[0] - s * 0.03, P[1], P[2]], [P[0] + s * 0.06, P[1], P[2]], [[0, 0.018], [1, 0.018]], C.rubber, 10));
    extrudes.push(box(`heelPlate_${side}`, [P[0] - s * 0.025, P[1] - 0.07, P[2] + 0.04], [P[0] - s * 0.025, P[1] + 0.05, P[2] + 0.08], 0.012, 0.1, tone(frame, 0.12), [0, 0, 1]));
    sweeps.push(tube(`stepHanger_${side}`, [P, [S[0], S[1] - 0.02, S[2] + 0.02]], 0.014, frame, 8));
    extrudes.push(box(`step_${side}`, [S[0] - s * 0.04, S[1], S[2]], [S[0] + s * 0.07, S[1], S[2]], 0.1, 0.018, tone(C.trim, 0.25)));
  }
  const at = (p, s) => [s * p[0], p[1], p[2]];
  return {
    extrudes, lathes, sweeps, lofts,
    hardpoints: { sit: [...d.sit], 'grip.r': at(d.grip, 1), 'grip.l': at(d.grip, -1), 'peg.r': add(at(d.peg, 1), [0, 0, 0.02]), 'peg.l': add(at(d.peg, -1), [0, 0, 0.02]), 'step.r': add(at(d.step, 1), [0, 0, 0.01]), 'step.l': add(at(d.step, -1), [0, 0, 0.01]) },
  };
}

// ── the rider's cabin: a convertible's tub round the rider, its windshield, its roll hoop ───────────────────────
function cage(row, C) {
  const d = row.dims, T = d.tub, W = d.shield, H = d.hoop, sweeps = [], extrudes = [], lathes = [], frame = C.trim;
  for (const s of [1, -1]) {
    const side = s > 0 ? 'r' : 'l', x = s * T.x;
    // (the tub's side: its beltline swept down beside the saddle, up to the dash, a seam where its door is cut)
    extrudes.push(slab(`side_${side}`, x - s * 0.007, x + s * 0.007, T.side, C.paint));
    extrudes.push(box(`seam_${side}`, [x + s * 0.008, T.door, 0.14], [x + s * 0.008, T.door, T.belt - 0.03], 0.004, 0.008, tone(C.paint, -0.35), [0, 1, 0]));
    // (the sill along its top, from the windshield's pillar back to the hoop: what the hands hold climbing in)
    sweeps.push(tube(`sill_${side}`, T.side.filter((p) => p[1] > 0.3).map(([y, z]) => [x, y, z + 0.01]), d.r * 0.8, frame, 8));
    extrudes.push(box(`slider_${side}`, [x + s * 0.025, -0.08, 0.28], [x + s * 0.025, 0.08, 0.28], 0.04, 0.07, C.rubber));
    // (its quarter pane, wrapping the windshield back to the sill)
    extrudes.push({ ...slab(`quarter_${side}`, s * (W.x - 0.004), s * (W.x + 0.006), [[W.y0 - 0.02, W.z0 + 0.02], [W.y1 + 0.02, W.z1 - 0.03], [W.y1 - 0.08, T.belt + 0.08]], tone(C.glass, 0.55)), material: { preset: 'satin', ambient: 0.62, diffuse: 0.45, specular: 0.7, shininess: 70 } });
    // (the windshield's pillar, raked back from the dash's corner to the header)
    sweeps.push(tube(`pillar_${side}`, [[s * W.x, W.y0, W.z0], [s * (W.x - 0.01), W.y1, W.z1]], d.r, frame, 8));
  }
  // (the windshield: a low deflector of framed glass raked back over the dash, its top under the leaning rider's eyes)
  extrudes.push({ ...slab('shield', -W.x + 0.01, W.x - 0.01, [[W.y0, W.z0], [W.y0 + 0.012, W.z0 + 0.004], [W.y1 + 0.012, W.z1 + 0.004], [W.y1, W.z1]], tone(C.glass, 0.55)), material: { preset: 'satin', ambient: 0.62, diffuse: 0.45, specular: 0.7, shininess: 70 } });
  sweeps.push(tube('header', [[-(W.x - 0.01), W.y1, W.z1], [W.x - 0.01, W.y1, W.z1]], d.r, frame, 8));
  sweeps.push(tube('cowl', [[-W.x, W.y0, W.z0], [W.x, W.y0, W.z0]], d.r * 0.8, frame, 8));
  // (the hoop behind the saddle, the convertible's roll bar: on its side the cabin rests on the hoop and the tub's sides)
  sweeps.push(tube('hoop', rounded([[-H.x, H.y, 0.3], [-H.x, H.y - 0.02, H.top - 0.1], [-H.x + 0.1, H.y - 0.03, H.top], [H.x - 0.1, H.y - 0.03, H.top], [H.x, H.y - 0.02, H.top - 0.1], [H.x, H.y, 0.3]], 0.08, 3), d.r, frame, 10));
  sweeps.push(tube('hoopFoot', [[-H.x, H.y, 0.3], [-0.07, H.y + 0.04, 0.14], [0.07, H.y + 0.04, 0.14], [H.x, H.y, 0.3]], d.r * 0.8, frame, 8));
  for (const s of [1, -1]) sweeps.push(tube(`stay_${s > 0 ? 'r' : 'l'}`, [[s * H.x, H.y, 0.42], [s * (T.x - 0.01), -0.28, T.side[T.side.length - 1][1]]], d.r * 0.8, frame, 8));
  for (const s of [1, -1]) {
    const side = s > 0 ? 'r' : 'l', c = [s * 0.14, H.y + 0.01, H.top + 0.005];
    extrudes.push(box(`lamp_${side}`, add(c, [0, -0.03, 0]), add(c, [0, 0.04, 0]), 0.08, 0.05, frame));
    extrudes.push(box(`lens_${side}`, add(c, [0, 0.04, 0]), add(c, [0, 0.046, 0]), 0.068, 0.038, C.glass));
  }
  lathes.push(spin('beacon', [0, H.y - 0.03, H.top + 0.01], [0, H.y - 0.03, H.top + 0.07], [[0, 0.032], [0.8, 0.032], [1, 0.018]], C.light, 12));
  return { sweeps, extrudes, lathes, hardpoints: { top: [0, H.y, H.top] } };
}

// ── a standing operator's place: the platform, the hip pad, the guardrail, the consoles, the steps ───────────────
function platform(row, C) {
  const d = row.dims, P = d.plate, extrudes = [], lathes = [], sweeps = [], frame = C.trim, cushion = tone(C.rubber, 0.16);
  extrudes.push(box('plate', [0, P.y0, P.z - 0.025], [0, P.y1, P.z - 0.025], 2 * P.x, 0.05, frame));
  extrudes.push(box('tread', [0, P.y0 + 0.03, P.z + 0.004], [0, P.y1 - 0.03, P.z + 0.004], 2 * P.x - 0.06, 0.008, C.rubber));
  extrudes.push(box('kick', [0, P.y1 - 0.01, P.z + 0.06], [0, P.y1 + 0.005, P.z + 0.06], 2 * P.x, 0.12, C.light));
  // (the hip pad the operator leans back on, standing: a long day's work taken off the legs)
  const S = d.sit;
  extrudes.push(box('hipPad', [0, S[1] - 0.05, S[2]], [0, S[1] - 0.01, S[2]], 0.36, 0.16, cushion));
  for (const s of [1, -1]) sweeps.push(tube(`padPost_${s > 0 ? 'r' : 'l'}`, [[s * 0.13, S[1] - 0.06, P.z], [s * 0.13, S[1] - 0.06, S[2] + 0.04]], 0.018, frame, 8));
  // (the guardrail at the waist: across ahead, down each side to the hip pad)
  const R = d.rail, x = P.x + 0.03, y1 = P.y1 + 0.04;
  sweeps.push(tube('rail', rounded([[-x, S[1] - 0.02, R], [-x, y1, R], [x, y1, R], [x, S[1] - 0.02, R]], 0.08, 3), 0.02, frame, 8));
  for (const s of [1, -1]) for (const [i, y] of [y1, 0.06].entries()) sweeps.push(tube(`upright_${s > 0 ? 'r' : 'l'}${i}`, [[s * x, y, P.z], [s * x, y, R]], 0.018, frame, 8));
  // (a console at each hand, its stick the arm's master: the operator works the arms by hand, the walker by foot pedals)
  for (const s of [1, -1]) {
    const side = s > 0 ? 'r' : 'l', g = [s * d.grip[0], d.grip[1], d.grip[2]];
    sweeps.push(tube(`consolePost_${side}`, [[s * (x - 0.02), g[1] - 0.06, P.z], [s * (x - 0.02), g[1] - 0.06, g[2] - 0.08]], 0.02, frame, 8));
    extrudes.push(box(`console_${side}`, [g[0] + s * 0.05, g[1] - 0.14, g[2] - 0.07], [g[0] + s * 0.05, g[1] + 0.05, g[2] - 0.07], 0.12, 0.05, frame));
    lathes.push(spin(`stick_${side}`, [g[0], g[1], g[2] - 0.06], [g[0], g[1], g[2] + 0.05], [[0, 0.016], [0.2, 0.02], [0.85, 0.021], [1, 0.012]], C.rubber, 12));
    lathes.push(spin(`thumb_${side}`, [g[0], g[1] + 0.005, g[2] + 0.045], [g[0], g[1] + 0.005, g[2] + 0.06], [[0, 0.012], [1, 0.012]], C.light, 10));
    extrudes.push(box(`pedal_${side}`, [s * 0.12, 0.16, P.z + 0.02], [s * 0.12, 0.28, P.z + 0.04], 0.1, 0.012, tone(frame, 0.2)));
    // (the steps hung from the platform's back: a ladder of two rungs)
    const st = [s * d.step[0], d.step[1], d.step[2]];
    sweeps.push(tube(`ladder_${side}`, [[st[0], P.y0 + 0.02, P.z - 0.04], [st[0], st[1], st[2]]], 0.016, frame, 8));
  }
  for (const [i, z] of [d.step[2], d.rung].entries()) extrudes.push(box(`rung_${i}`, [-d.step[0], d.step[1] + (z - d.step[2]) * -0.2, z], [d.step[0], d.step[1] + (z - d.step[2]) * -0.2, z], 0.06, 0.02, tone(C.trim, 0.25)));
  const at = (p, s) => [s * p[0], p[1], p[2]];
  return {
    extrudes, lathes, sweeps,
    hardpoints: { sit: [...S], 'grip.r': at(d.grip, 1), 'grip.l': at(d.grip, -1), 'peg.r': at(d.peg, 1), 'peg.l': at(d.peg, -1), 'step.r': add(at(d.step, 1), [0, 0, 0.01]), 'step.l': add(at(d.step, -1), [0, 0, 0.01]) },
  };
}

// ── a torso frame round a standing operator: its posts, its shoulder beam and mounts, its hoop over the head ────
function torso(row, C) {
  const d = row.dims, sweeps = [], extrudes = [], lathes = [], frame = C.trim, Sh = d.shoulder, P = d.post;
  for (const s of [1, -1]) {
    const side = s > 0 ? 'r' : 'l';
    // (a post each side from the pelvis up to the shoulder, braced back)
    extrudes.push(box(`post_${side}`, [s * P.x, P.y, 0.0], [s * P.x, P.y, Sh[2] + 0.04], 0.07, 0.09, C.paint, [0, 1, 0]));
    sweeps.push(tube(`brace_${side}`, [[s * P.x, P.y - 0.03, 0.1], [s * 0.18, -0.3, 0.6], [s * (P.x - 0.02), P.y - 0.02, Sh[2] - 0.1]], d.r * 0.8, frame, 8));
    // (the shoulder's mount: a bracket out from the post's head, the arm's yaw drive under it)
    extrudes.push(box(`mount_${side}`, [s * (P.x - 0.03), Sh[1], Sh[2] + 0.2], [s * (Sh[0] + 0.06), Sh[1], Sh[2] + 0.2], 0.16, 0.06, frame));
    extrudes.push(box(`plate_${side}`, [s * (P.x + 0.005), P.y - 0.1, Sh[2] - 0.2], [s * (P.x + 0.005), P.y + 0.12, Sh[2] - 0.2], 0.012, 0.34, C.paint));
  }
  extrudes.push(box('beam', [-P.x, P.y, Sh[2] + 0.1], [P.x, P.y, Sh[2] + 0.1], 0.1, 0.1, frame));
  // (the power pack's arms: back from the posts to the pack on the torso's back)
  if (d.pack) for (const s of [1, -1]) for (const [i, z] of d.pack.z.entries()) extrudes.push(box(`packArm_${s > 0 ? 'r' : 'l'}${i}`, [s * P.x, P.y - 0.03, z], [s * 0.2, d.pack.y, z], 0.04, 0.05, frame));
  // (the hoop over the operator's head)
  sweeps.push(tube('hoop', rounded([[-0.3, P.y, Sh[2] + 0.12], [-0.3, P.y - 0.02, d.top - 0.1], [-0.2, P.y - 0.02, d.top], [0.2, P.y - 0.02, d.top], [0.3, P.y - 0.02, d.top - 0.1], [0.3, P.y, Sh[2] + 0.12]], 0.08, 3), d.r, frame, 10));
  sweeps.push(tube('visor', [[-0.22, P.y - 0.02, d.top], [-0.22, 0.24, d.top - 0.12], [0.22, 0.24, d.top - 0.12], [0.22, P.y - 0.02, d.top]], d.r * 0.7, frame, 8));
  for (const s of [1, -1]) {
    const side = s > 0 ? 'r' : 'l', c = [s * 0.12, 0.25, d.top - 0.12];
    extrudes.push(box(`lamp_${side}`, add(c, [0, -0.04, 0]), add(c, [0, 0.02, 0]), 0.08, 0.05, frame));
    extrudes.push(box(`lens_${side}`, add(c, [0, 0.02, 0]), add(c, [0, 0.026, 0]), 0.068, 0.038, C.glass));
  }
  lathes.push(spin('beacon', [0, P.y - 0.02, d.top + 0.02], [0, P.y - 0.02, d.top + 0.08], [[0, 0.032], [0.8, 0.032], [1, 0.018]], C.light, 12));
  return { sweeps, extrudes, lathes, hardpoints: { top: [0, P.y, d.top], 'shoulder.r': [...Sh], 'shoulder.l': [-Sh[0], Sh[1], Sh[2]] } };
}

// ── an arm: its shoulder, its upper arm and forearm, its wrist and its claw ──────────────────────────────────────
function shoulder(row, C, { side }) {
  const d = row.dims, s = sgn(side), lathes = [], extrudes = [], dark = tone(C.trim, -0.15);
  lathes.push(spin('drive', [0, 0, 0.06], [0, 0, 0.2], [[0, d.r * 0.85], [0.15, d.r], [1, d.r]], C.paint, 18));
  extrudes.push(box('block', [0, 0, 0.07], [0, 0, -0.03], 0.11, 0.12, C.trim));
  for (const t of [1, -1]) extrudes.push(box(`cheek_${t > 0 ? 'o' : 'i'}`, [t * 0.075, 0, 0.04], [t * 0.075, 0, -0.06], 0.018, 0.12, C.trim));
  lathes.push(boss('axle', [0, 0, 0], 'x', 0.09, 0.03, C.chrome, 12));
  const H = [s * d.horn[0], d.horn[1], d.horn[2]];
  extrudes.push(box('horn', [s * 0.07, 0.03, 0.04], H, 0.045, 0.045, C.trim));
  lathes.push(boss('hornEye', H, 'x', 0.03, 0.026, dark, 12));
  return { lathes, extrudes, hardpoints: { pitch: [0, 0, 0], horn: H } };
}
function upperarm(row, C, { side }) {
  const d = row.dims, s = sgn(side), L = d.length, lathes = [], extrudes = [], lofts = [], dark = tone(C.trim, -0.15);
  lathes.push(boss('hub', [0, 0, 0], 'x', 0.062, 0.062, C.trim, 16));
  lofts.push(legBeam('beam', -0.03, -(L - d.clevis) + 0.02, d.w, d.d0, d.w * 0.92, d.d1, C.paint));
  lofts.push(legBeam('band', -0.15, -0.18, d.w + 0.01, d.d0 * 0.9 + 0.01, d.w + 0.01, d.d0 * 0.88 + 0.01, dark, 0.02));
  for (const t of [1, -1]) extrudes.push(box(`clevis_${t > 0 ? 'o' : 'i'}`, [t * 0.064, 0, -(L - d.clevis) + 0.04], [t * 0.064, 0, -L - 0.05], 0.018, d.d1 + 0.02, C.trim));
  lathes.push(boss('elbowPin', [0, 0, -L], 'x', 0.08, 0.026, C.chrome, 12));
  const A = [s * d.shoulderRam[0], d.shoulderRam[1], d.shoulderRam[2]], B = [s * d.elbowRam[0], d.elbowRam[1], d.elbowRam[2]];
  for (const [id, p] of [['shoulderBracket', A], ['elbowBracket', B]]) {
    extrudes.push(box(id, [Math.sign(p[0]) * 0.03, Math.sign(p[1]) * 0.03, p[2]], p, 0.045, 0.045, C.trim));
    lathes.push(boss(`${id}Eye`, p, 'x', 0.03, 0.026, dark, 12));
  }
  return { lathes, extrudes, lofts, hardpoints: { elbow: [0, 0, -L], shoulderRam: A, elbowRam: B } };
}
function forearm(row, C, { side }) {
  const d = row.dims, s = sgn(side), L = d.length, lathes = [], extrudes = [], lofts = [], dark = tone(C.trim, -0.15);
  lathes.push(boss('hub', [0, 0, 0], 'x', 0.054, 0.058, C.trim, 16));
  lofts.push(legBeam('beam', -0.04, -L + 0.03, d.w, d.d0, d.w * 0.85, d.d1, C.paint));
  lofts.push(legBeam('band', -L + 0.1, -L + 0.13, d.w + 0.01, d.d1 + 0.012, d.w + 0.01, d.d1 + 0.012, dark, 0.02));
  const E = [s * d.elbowEye[0], d.elbowEye[1], d.elbowEye[2]];
  extrudes.push(box('horn', [Math.sign(E[0]) * 0.02, Math.sign(E[1]) * 0.03, E[2] + 0.02], E, 0.045, 0.045, C.trim));
  lathes.push(boss('hornEye', E, 'x', 0.03, 0.026, dark, 12));
  return { lathes, extrudes, lofts, hardpoints: { wrist: [0, 0, -L], elbowEye: E } };
}
function wrist(row, C) {
  const d = row.dims, lathes = [], extrudes = [];
  lathes.push(boss('drive', [0, 0, 0], 'x', 0.07, d.r, tone(C.trim, -0.15), 16));
  extrudes.push(box('flange', [0, 0, -0.02], [0, 0, -d.drop], 0.1, 0.1, C.trim));
  return { lathes, extrudes, hardpoints: { claw: [0, 0, -d.drop] } };
}
function claw(row, C) {
  const d = row.dims, extrudes = [], sweeps = [], F = d.finger, g = d.gap / 2;
  extrudes.push(box('palm', [0, 0, 0], [0, 0, -0.07], d.w, 0.12, C.trim));
  for (const t of [1, -1]) {
    const side = t > 0 ? 'o' : 'i';
    // (a finger each side, out from the palm and curled in at its tip, a pad on its inner face)
    sweeps.push(tube(`finger_${side}`, rounded([[t * (d.w / 2 - 0.02), 0, -0.05], [t * g, 0, -0.1], [t * g, 0, -F + 0.05], [t * (g - 0.06), 0, -F]], 0.03, 3), 0.024, C.paint, 10));
    extrudes.push(box(`pad_${side}`, [t * (g - 0.026), 0, -0.13], [t * (g - 0.026), 0, -F + 0.06], 0.014, 0.06, C.rubber, [0, 1, 0]));
  }
  return { extrudes, sweeps, hardpoints: { tip: [0, 0, -F] } };
}

// ── the power pack: the hydraulic power unit's case, its cooler, its hoses ──────────────────────────────────────
function pack(row, C) {
  const d = row.dims, extrudes = [], lathes = [], sweeps = [], dark = tone(C.trim, -0.2), h = d.h;
  extrudes.push(box('case', [0, -d.d / 2, h / 2], [0, d.d / 2, h / 2], d.w, h, C.paint));
  extrudes.push(box('frame', [0, -d.d / 2 - 0.01, 0.02], [0, d.d / 2 + 0.01, 0.02], d.w + 0.03, 0.04, C.trim));
  // (the cooler's grille on its back, its fan's ring)
  extrudes.push(box('grille', [0, -d.d / 2 - 0.012, h * 0.55], [0, -d.d / 2, h * 0.55], d.w - 0.08, h - 0.12, dark));
  for (let i = 0; i < 5; i++) extrudes.push(box(`slat_${i}`, [0, -d.d / 2 - 0.02, 0.09 + i * 0.05], [0, -d.d / 2 - 0.012, 0.09 + i * 0.05], d.w - 0.1, 0.012, C.trim));
  lathes.push(spin('fan', [0, -d.d / 2 - 0.022, h * 0.55], [0, -d.d / 2 - 0.012, h * 0.55], [[0, 0.11], [1, 0.11]], tone(C.trim, 0.1), 18));
  // (the tank's cap and the hoses down to the hips: the lines that feed every ram)
  lathes.push(spin('cap', [0.12, 0.05, h], [0.12, 0.05, h + 0.03], [[0, 0.03], [1, 0.03]], C.chrome, 10));
  for (const s of [1, -1]) sweeps.push(tube(`hose_${s > 0 ? 'r' : 'l'}`, [[s * 0.12, d.d / 2, h * 0.25], [s * 0.2, d.d / 2 + 0.12, 0.0], [s * 0.26, d.d / 2 + 0.36, -0.1]], 0.012, C.rubber, 8));
  extrudes.push(box('mark', [d.w / 2 + 0.002, -0.05, h * 0.7], [d.w / 2 + 0.008, 0.05, h * 0.7], 0.1, 0.05, C.light));
  return { extrudes, lathes, sweeps, hardpoints: {} };
}

export const MECHA_BUILDERS = Object.freeze({
  'mecha-pelvis': pelvis,
  'mecha-hip': hip,
  'mecha-yoke': yoke,
  'mecha-thigh': thigh,
  'mecha-shank': shank,
  'mecha-ankle': ankle,
  'mecha-foot': foot,
  'mecha-seat': (row, C, ctx) => (row.build.family === 'standing' ? platform : seat)(row, C, ctx),
  'mecha-cage': (row, C, ctx) => (row.build.family === 'torso' ? torso : cage)(row, C, ctx),
  'mecha-shoulder': shoulder,
  'mecha-upperarm': upperarm,
  'mecha-forearm': forearm,
  'mecha-wrist': wrist,
  'mecha-claw': claw,
  'mecha-pack': pack,
  // (a ram is the construction shelf's, its barrel a bare steel grey: the hydraulics read apart from the covers)
  'mecha-ram': (row, C, ctx) => CON_BUILDERS['con-ram'](row, { ...C, paint: tone(C.chrome, -0.42) }, ctx),
});
