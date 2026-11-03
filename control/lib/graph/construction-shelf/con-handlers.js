/**
 * con-handlers — the builders of the material handlers and the small diggers: a forklift's chassis, its mast's
 * channels and its carriage, a pair of forks; a telehandler's chassis and its boom's sections; a mini excavator's
 * swing post and its canopy; a backhoe loader's chassis, its swing frame and its stabiliser legs. Each drawn in its
 * body's frame (con-parts.js says the contract).
 *
 * Pure: no clock, no dice.
 */
import { add, box, extrudeWorld, loftWorld, mul, panel as rawPanel, roundRect, spin, sub, tone, tube } from './con-common.js';

const area = (o) => o.reduce((s, p, i) => { const q = o[(i + 1) % o.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
const wound = (o, sign) => (area(o) * sign < 0 ? o.slice().reverse() : o);
const panel = (id, x0, x1, outline, tint) => rawPanel(id, x0, x1, wound(outline, Math.sign(x1 - x0) || 1), tint);
function plan(id, z0, z1, raw, tint) {
  const outline = wound(raw, Math.sign(z1 - z0) || 1);
  const xc = outline.reduce((s, p) => s + p[0], 0) / outline.length, yc = outline.reduce((s, p) => s + p[1], 0) / outline.length;
  return extrudeWorld(id, [xc, yc, z0], [xc, yc, z1], outline.map(([x, y]) => [x - xc, y - yc, 0]), tint);
}
const boss = (id, p, x0, x1, r, tint) => spin(id, [x0, p[1], p[2]], [x1, p[1], p[2]], [[0, r], [1, r]], tint, 16);
const side = (s) => (s > 0 ? 'r' : 'l');
function beam(id, a, b, w, h, w1, h1, tint, r = 0.03) {
  const ax = sub(b, a);
  return loftWorld(id, a, b, [{ t: 0, points: roundRect(ax, w, h, r, 2) }, { t: 1, points: roundRect(ax, w1, h1, r, 2) }], tint);
}
/** A canopy or a guard: four posts and a roof, from z0 up to z1, `w` across and from y0 to y1. */
function canopy(id, { w, y0, y1, z0, z1, post = 0.06, rake = 0 }, tint, roof) {
  const ex = [];
  for (const s of [1, -1]) {
    ex.push(box(`${id}_post_${side(s)}b`, [s * (w / 2 - post / 2), y0 + post / 2, z0], [s * (w / 2 - post / 2), y0 + post / 2, z1], post, post, tint, [0, 1, 0]));
    ex.push(box(`${id}_post_${side(s)}f`, [s * (w / 2 - post / 2), y1 - post / 2, z0], [s * (w / 2 - post / 2), y1 - post / 2 - rake, z1], post, post, tint, [0, 1, 0]));
  }
  ex.push(plan(`${id}_roof`, z1, z1 + 0.05, [[-w / 2 - 0.02, y0 - 0.02], [w / 2 + 0.02, y0 - 0.02], [w / 2 + 0.02, y1 - rake + 0.02], [-w / 2 - 0.02, y1 - rake + 0.02]], roof ?? tint));
  return ex;
}

// ── a counterbalance forklift's chassis: its counterweight aft, its overhead guard, its seat, its axles ─────────
export function forkChassis(row, C, { physics }) {
  const d = row.dims, extrudes = [], lathes = [], body = C.paint, dark = C.trim;
  const tw = physics.track / 2, yF = physics.wheelbase / 2, yR = -yF;
  extrudes.push(plan('frame', 0.15, 0.95, [[-0.5, yR - 0.2], [0.5, yR - 0.2], [0.5, yF - 0.05], [-0.5, yF - 0.05]], dark));
  // the counterweight round the tail, its top swept up to the hood
  extrudes.push(plan('counterweight', 0.18, 1.15, [[-d.w / 2, d.tail], [d.w / 2, d.tail], [d.w / 2, yR + 0.25], [-d.w / 2, yR + 0.25]], body));
  extrudes.push(plan('hood', 0.95, 1.12, [[-0.48, yR + 0.25], [0.48, yR + 0.25], [0.48, yF - 0.35], [-0.48, yF - 0.35]], body));
  for (const s of [1, -1]) extrudes.push(box(`step_${side(s)}`, [s * 0.52, yR + 0.4, 0.35], [s * 0.52, yF - 0.2, 0.35], 0.06, 0.08, dark));
  // the overhead guard over the seat, the seat
  extrudes.push(...canopy('guard', { w: d.w - 0.05, y0: yR + 0.1, y1: yF + 0.05, z0: 1.12, z1: d.guard, rake: 0.25 }, dark));
  extrudes.push(box('seat', [0, yR + 0.35, 1.2], [0, yR + 0.75, 1.2], 0.45, 0.12, C.rubber));
  extrudes.push(box('seat_back', [0, yR + 0.3, 1.25], [0, yR + 0.38, 1.7], 0.43, 0.1, C.rubber, [0, 1, 0]));
  // the mast's foot pins on the front axle, the tilt rams' bases low on the frame
  const M = d.mastFoot, Tr = d.tiltRam;
  for (const s of [1, -1]) {
    lathes.push(boss(`mast_pin_${side(s)}`, [s * M[0], M[1], M[2]], s * (M[0] - 0.06), s * (M[0] + 0.06), 0.05, tone(dark, 0.2)));
    lathes.push(boss(`tilt_pin_${side(s)}`, [s * Tr[0], Tr[1], Tr[2]], s * (Tr[0] - 0.05), s * (Tr[0] + 0.05), 0.04, tone(dark, 0.2)));
  }
  return { extrudes, lathes, hardpoints: { mastFoot: [0, M[1], M[2]], 'tiltRam.r': Tr, 'tiltRam.l': [-Tr[0], Tr[1], Tr[2]], 'wheelF.r': [tw, yF, d.rF], 'wheelF.l': [-tw, yF, d.rF], 'wheelR.r': [d.rearTrack / 2, yR, d.rR], 'wheelR.l': [-d.rearTrack / 2, yR, d.rR] } };
}

// ── a mast's channel (an outer one stood on its foot, a stage inside it), its cross ties ──────────────────────
export function mastChannel(row, C) {
  const d = row.dims, extrudes = [], lathes = [], steel = tone(C.trim, 0.1);
  for (const s of [1, -1]) {
    extrudes.push(box(`rail_${side(s)}`, [s * d.w / 2, 0, 0], [s * d.w / 2, 0, d.h], 0.07, 0.12, steel, [0, 1, 0]));
    lathes.push(spin(`roller_${side(s)}`, [s * (d.w / 2 - 0.03), 0.02, d.h - 0.08], [s * (d.w / 2 + 0.03), 0.02, d.h - 0.08], [[0, 0.04], [1, 0.04]], tone(C.trim, 0.3), 12));
  }
  for (const z of d.ties) extrudes.push(box(`tie_${Math.round(z * 100)}`, [-d.w / 2, -0.02, z], [d.w / 2, -0.02, z], 0.08, 0.1, steel, [0, 0, 1]));
  // (an outer channel carries the lift ram up its middle, its tilt rams' eyes on its sides)
  if (d.ram) lathes.push(spin('lift_ram', [0, -0.04, 0.05], [0, -0.04, d.h * 0.92], [[0, 0.05], [1, 0.05]], tone(C.trim, -0.1), 14));
  const hp = { foot: [0, 0, 0], stage: [0, d.inset ?? 0.02, d.stageZ ?? 0.04] };
  if (d.tiltEye) Object.assign(hp, { 'tiltEye.r': d.tiltEye, 'tiltEye.l': [-d.tiltEye[0], d.tiltEye[1], d.tiltEye[2]] });
  return { extrudes, lathes, hardpoints: hp };
}

// ── a fork carriage, its backrest and its forks (or a telehandler's carriage on its pin) ──────────────────────
export function carriage(row, C) {
  const d = row.dims, extrudes = [], lathes = [], lofts = [], steel = tone(C.trim, 0.15), fork = tone(C.trim, -0.05);
  const z0 = d.z0 ?? 0;
  extrudes.push(box('plate', [-d.w / 2, d.y, z0 + 0.12], [d.w / 2, d.y, z0 + 0.12], 0.06, 0.12, steel, [0, 0, 1]));
  extrudes.push(box('plate_top', [-d.w / 2, d.y, z0 + 0.42], [d.w / 2, d.y, z0 + 0.42], 0.06, 0.1, steel, [0, 0, 1]));
  for (let k = 0; k <= 6; k++) { const x = -d.w / 2 + (d.w * k) / 6; extrudes.push(box(`rest_${k}`, [x, d.y, z0 + 0.42], [x, d.y, z0 + 0.42 + d.rest], 0.025, 0.025, steel, [0, 1, 0])); }
  extrudes.push(box('rest_top', [-d.w / 2, d.y, z0 + 0.42 + d.rest], [d.w / 2, d.y, z0 + 0.42 + d.rest], 0.04, 0.04, steel, [0, 0, 1]));
  for (const s of [1, -1]) {
    // a fork: its shank up the carriage's face, its blade along the ground, the heel bent between
    const x = s * d.spread / 2;
    extrudes.push(box(`shank_${side(s)}`, [x, d.y + 0.05, z0 + 0.02], [x, d.y + 0.05, z0 + 0.5], 0.1, 0.045, fork, [0, 1, 0]));
    lofts.push(loftWorld(`blade_${side(s)}`, [x, d.y + 0.03, z0 + 0.0225], [x, d.y + 0.05 + d.fork, z0 + 0.0225], [{ t: 0, points: roundRect([0, 1, 0], 0.1, 0.045, 0.005, 1) }, { t: 1, points: roundRect([0, 1, 0], 0.1, 0.02, 0.005, 1) }], fork));
  }
  if (d.pin) lathes.push(boss('pin', [0, 0, 0], -0.25, 0.25, 0.07, tone(C.trim, 0.2)));
  const hp = { mount: [0, 0, 0], tip: [0, d.y + 0.05 + d.fork, z0], top: [0, d.y, z0 + 0.42 + d.rest] };
  if (d.tiltEye) Object.assign(hp, { tiltEye: d.tiltEye });
  return { extrudes, lathes, lofts, hardpoints: hp, outline: [[-d.spread / 2, d.y + 0.05 + d.fork, z0], [d.spread / 2, d.y + 0.05 + d.fork, z0], [0, d.y, z0 + 0.42 + d.rest]] };
}

// ── a telehandler's chassis: its frame, the cab to the left, the engine to the right, the boom's pivot aft ──────
export function teleChassis(row, C, { physics }) {
  const d = row.dims, extrudes = [], lathes = [], body = C.paint, dark = C.trim;
  const tw = physics.track / 2, hb = physics.wheelbase / 2, z = physics.wheelRadius;
  extrudes.push(plan('frame', 0.45, 0.95, [[-0.38, -hb - 0.55], [0.38, -hb - 0.55], [0.38, hb + 0.45], [-0.38, hb + 0.45]], dark));
  for (const y of [-hb, hb]) lathes.push(spin(`axle_${y > 0 ? 'f' : 'r'}`, [-tw + 0.25, y, z], [tw - 0.25, y, z], [[0, 0.12], [0.35, 0.17], [0.65, 0.17], [1, 0.12]], tone(dark, 0.1), 16));
  // the engine's bay to the right, the fenders over the wheels
  extrudes.push(plan('engine', 0.9, 1.75, [[0.38, -hb - 0.3], [tw + 0.05, -hb - 0.3], [tw + 0.05, hb - 0.2], [0.38, hb - 0.2]], body));
  for (const s of [1, -1]) for (const y of [-hb, hb]) extrudes.push(box(`fender_${side(s)}${y > 0 ? 'f' : 'r'}`, [s * tw, y - physics.wheelRadius - 0.05, z + physics.wheelRadius + 0.05], [s * tw, y + physics.wheelRadius + 0.05, z + physics.wheelRadius + 0.05], 0.55, 0.04, body));
  // the boom's pivot on its towers aft, the lift ram's base on the frame ahead
  const P = d.pivot, L = d.liftRam;
  for (const s of [1, -1]) extrudes.push(panel(`tower_${side(s)}`, s * 0.22, s * 0.3, [[P[1] - 0.45, 0.9], [P[1] + 0.4, 0.9], [P[1] + 0.12, P[2] + 0.12], [P[1] - 0.15, P[2] + 0.12]], body));
  lathes.push(boss('pivot', P, -0.32, 0.32, 0.09, tone(dark, 0.2)));
  extrudes.push(panel('lift_lug', -0.09, 0.09, [[L[1] - 0.25, 0.9], [L[1] + 0.25, 0.9], [L[1] + 0.08, L[2] + 0.08], [L[1] - 0.08, L[2] + 0.08]], dark));
  lathes.push(boss('lift_pin', L, -0.1, 0.1, 0.06, tone(dark, 0.2)));
  return { extrudes, lathes, hardpoints: { cab: d.cab, pivot: P, liftRam: L, 'wheelF.r': [tw, hb, z], 'wheelF.l': [-tw, hb, z], 'wheelR.r': [tw, -hb, z], 'wheelR.l': [-tw, -hb, z] } };
}

// ── a boom's section: a box beam along +y from its foot (or its seat in the section outside it) to its head ─────
export function boomSection(row, C) {
  const d = row.dims, lofts = [], lathes = [], extrudes = [], body = C.paint;
  lofts.push(beam('section', [0, d.from ?? 0, 0], [0, d.length, 0], d.w, d.h, d.w * 0.96, d.h * 0.94, body, 0.02));
  const hp = { foot: [0, 0, 0], head: [0, d.length, 0], seat: [0, d.seat ?? 0.3, 0] };
  if (d.pin) lathes.push(boss('pin', [0, 0, 0], -d.w / 2 - 0.04, d.w / 2 + 0.04, 0.09, tone(C.trim, 0.2)));
  if (d.ramEye) { lathes.push(boss('ram_eye', d.ramEye, -0.12, 0.12, 0.06, tone(C.trim, 0.2))); hp.ramEye = d.ramEye; }
  if (d.tiltRam) { lathes.push(boss('tilt_pin', d.tiltRam, -0.1, 0.1, 0.05, tone(C.trim, 0.2))); hp.tiltRam = d.tiltRam; }
  if (d.headPin) { lathes.push(boss('head_pin', [0, d.length, 0], -d.w / 2 - 0.02, d.w / 2 + 0.02, 0.07, tone(C.trim, 0.2))); }
  // (a section's wear pads at its mouth, where the next slides out of it)
  if (d.pads) for (const s of [1, -1]) extrudes.push(box(`pad_${side(s)}`, [s * (d.w / 2 - 0.02), d.length - 0.12, 0], [s * (d.w / 2 - 0.02), d.length - 0.02, 0], 0.03, d.h * 0.8, tone(C.trim, 0.3)));
  return { lofts, lathes, extrudes, hardpoints: hp };
}

// ── a mini excavator's swing post: the boom's foot turned left and right on its kingpin, its ram's eye ──────────
export function swingPost(row, C) {
  const d = row.dims, extrudes = [], lathes = [], body = tone(C.paint, -0.05);
  lathes.push(spin('kingpin', [0, 0, -0.18], [0, 0, 0.32], [[0, 0.07], [1, 0.07]], tone(C.trim, 0.2), 14));
  for (const s of [1, -1]) extrudes.push(panel(`cheek_${side(s)}`, s * 0.1, s * 0.14, [[-0.12, -0.18], [0.12, -0.18], [d.foot[1] + 0.12, d.foot[2] - 0.1], [d.foot[1] + 0.1, d.foot[2] + 0.12], [d.foot[1] - 0.08, d.foot[2] + 0.12], [-0.12, 0.32]], body));
  lathes.push(boss('foot', d.foot, -0.16, 0.16, 0.07, tone(C.trim, 0.2)));
  lathes.push(boss('boom_ram', d.boomRam, -0.14, 0.14, 0.05, tone(C.trim, 0.2)));
  lathes.push(spin('swing_eye', [d.swingEye[0], d.swingEye[1], d.swingEye[2] - 0.06], [d.swingEye[0], d.swingEye[1], d.swingEye[2] + 0.06], [[0, 0.05], [1, 0.05]], tone(C.trim, 0.2), 12));
  return { extrudes, lathes, hardpoints: { pin: [0, 0, 0], boomFoot: d.foot, boomRam: d.boomRam, swingEye: d.swingEye } };
}

// ── a canopy over an operator's seat: its posts, its roof, the seat and the controls' consoles ─────────────────
export function canopyCab(row, C) {
  const d = row.dims, extrudes = [], lathes = [];
  extrudes.push(...canopy('canopy', { w: d.w, y0: -0.35, y1: -0.35 + d.l, z0: 0, z1: d.h, rake: 0.1 }, tone(C.trim, 0.05), C.paint));
  extrudes.push(box('seat', [0, -0.15, 0.42], [0, 0.3, 0.42], 0.46, 0.1, C.rubber));
  extrudes.push(box('seat_back', [0, -0.2, 0.45], [0, -0.12, 0.95], 0.44, 0.08, C.rubber, [0, 1, 0]));
  for (const s of [1, -1]) extrudes.push(box(`console_${side(s)}`, [s * 0.32, -0.1, 0.45], [s * 0.32, 0.35, 0.45], 0.12, 0.3, tone(C.trim, 0.15)));
  return { extrudes, lathes, hardpoints: { mount: [0, 0, 0], eye: [0, 0.1, 1.15] } };
}

// ── a backhoe loader's chassis: the hood ahead of the cab, its axles, the loader arms' pivots, the swing frame's
// kingpost aft, the stabilisers' pins at its rear corners ────────────────────────────────────────────────────
export function backhoeChassis(row, C, { physics }) {
  const d = row.dims, extrudes = [], lathes = [], body = C.paint, dark = C.trim;
  const hb = physics.wheelbase / 2, tw = physics.track / 2;
  extrudes.push(plan('frame', 0.45, 0.95, [[-0.42, -hb - 0.75], [0.42, -hb - 0.75], [0.42, hb + 0.95], [-0.42, hb + 0.95]], dark));
  extrudes.push(plan('hood', 0.95, 1.65, [[-0.5, hb - 0.55], [0.5, hb - 0.55], [0.45, hb + 0.95], [-0.45, hb + 0.95]], body));
  extrudes.push(box('grille', [0, hb + 0.94, 1.25], [0, hb + 0.98, 1.25], 0.7, 0.5, dark));
  lathes.push(spin('stack', [0.3, hb - 0.4, 1.65], [0.3, hb - 0.4, 2.1], [[0, 0.05], [1, 0.055]], tone(dark, 0.2), 12));
  lathes.push(spin('axle_r', [-tw + 0.3, -hb, d.rR], [tw - 0.3, -hb, d.rR], [[0, 0.12], [0.35, 0.18], [0.65, 0.18], [1, 0.12]], tone(dark, 0.1), 16));
  lathes.push(spin('axle_f', [-tw + 0.3, hb, d.rF], [tw - 0.3, hb, d.rF], [[0, 0.1], [0.4, 0.14], [0.6, 0.14], [1, 0.1]], tone(dark, 0.1), 16));
  for (const s of [1, -1]) extrudes.push(box(`fender_${side(s)}`, [s * tw, -hb - d.rR - 0.05, d.rR * 2 + 0.06], [s * tw, -hb + d.rR + 0.05, d.rR * 2 + 0.06], 0.46, 0.05, body));
  // the loader arms' pivots on towers either side of the cab's front, their lift rams' bases on the frame
  const A = d.armPivot, Lr = d.liftRam;
  for (const s of [1, -1]) {
    extrudes.push(panel(`tower_${side(s)}`, s * (A[0] - 0.06), s * (A[0] + 0.06), [[A[1] - 0.4, 0.9], [A[1] + 0.35, 0.9], [A[1] + 0.12, A[2] + 0.12], [A[1] - 0.15, A[2] + 0.12]], body));
    lathes.push(boss(`arm_pin_${side(s)}`, [s * A[0], A[1], A[2]], s * (A[0] - 0.08), s * (A[0] + 0.08), 0.07, tone(dark, 0.2)));
    lathes.push(boss(`lift_pin_${side(s)}`, [s * Lr[0], Lr[1], Lr[2]], s * (Lr[0] - 0.07), s * (Lr[0] + 0.07), 0.05, tone(dark, 0.2)));
  }
  // the kingpost frame aft (the swing frame's pins above and below), the swing rams' bases, the stabilisers' pins
  const K = d.post, S = d.swingRam, St = d.stab, Sr = d.stabRam;
  extrudes.push(plan('kingpost', 0.55, 1.45, [[-0.55, -hb - 1.05], [0.55, -hb - 1.05], [0.55, -hb - 0.6], [-0.55, -hb - 0.6]], dark));
  for (const s of [1, -1]) {
    lathes.push(spin(`swing_pin_${side(s)}`, [s * S[0], S[1], S[2] - 0.06], [s * S[0], S[1], S[2] + 0.06], [[0, 0.05], [1, 0.05]], tone(dark, 0.2), 12));
    lathes.push(boss(`stab_pin_${side(s)}`, [s * St[0], St[1], St[2]], s * (St[0] - 0.08), s * (St[0] + 0.08), 0.07, tone(dark, 0.2)));
    lathes.push(boss(`stab_ram_${side(s)}`, [s * Sr[0], Sr[1], Sr[2]], s * (Sr[0] - 0.06), s * (Sr[0] + 0.06), 0.05, tone(dark, 0.2)));
  }
  return {
    extrudes, lathes,
    hardpoints: { cab: d.cab, armPivot: [0, A[1], A[2]], 'liftRam.r': Lr, 'liftRam.l': [-Lr[0], Lr[1], Lr[2]], post: K, 'swingRam.r': S, 'swingRam.l': [-S[0], S[1], S[2]], 'stab.r': St, 'stab.l': [-St[0], St[1], St[2]], 'stabRam.r': Sr, 'stabRam.l': [-Sr[0], Sr[1], Sr[2]], 'wheelF.r': [tw, hb, d.rF], 'wheelF.l': [-tw, hb, d.rF], 'wheelR.r': [tw, -hb, d.rR], 'wheelR.l': [-tw, -hb, d.rR] },
  };
}

// ── a backhoe's swing frame: on the kingpost's pins, the boom's foot and its ram's base, the swing rams' eyes ───
export function swingFrame(row, C) {
  const d = row.dims, extrudes = [], lathes = [], body = tone(C.paint, -0.04);
  for (const s of [1, -1]) extrudes.push(panel(`cheek_${side(s)}`, s * 0.12, s * 0.18, [[0.15, -0.45], [-0.25, -0.45], [d.foot[1] - 0.12, d.foot[2] - 0.15], [d.foot[1] - 0.1, d.foot[2] + 0.12], [d.foot[1] + 0.12, d.foot[2] + 0.12], [0.15, 0.45]], body));
  lathes.push(spin('pins', [0, 0, -0.5], [0, 0, 0.5], [[0, 0.06], [1, 0.06]], tone(C.trim, 0.2), 12));
  lathes.push(boss('foot', d.foot, -0.2, 0.2, 0.08, tone(C.trim, 0.2)));
  lathes.push(boss('boom_ram', d.boomRam, -0.16, 0.16, 0.06, tone(C.trim, 0.2)));
  for (const s of [1, -1]) lathes.push(spin(`swing_eye_${side(s)}`, [s * d.swingEye[0], d.swingEye[1], d.swingEye[2] - 0.05], [s * d.swingEye[0], d.swingEye[1], d.swingEye[2] + 0.05], [[0, 0.045], [1, 0.045]], tone(C.trim, 0.2), 12));
  return { extrudes, lathes, hardpoints: { pin: [0, 0, 0], boomFoot: d.foot, boomRam: d.boomRam, 'swingEye.r': d.swingEye, 'swingEye.l': [-d.swingEye[0], d.swingEye[1], d.swingEye[2]] } };
}

// ── a stabiliser leg: its arm down from its pin, its pad on the ground, its ram's eye ──────────────────────────
export function stabLeg(row, C) {
  const d = row.dims, lofts = [], lathes = [], extrudes = [], body = C.paint, pad = tone(C.trim, 0.1);
  lofts.push(beam('leg', [0, 0, 0], d.foot, 0.16, 0.2, 0.14, 0.16, body));
  lathes.push(boss('pin', [0, 0, 0], -0.1, 0.1, 0.07, tone(C.trim, 0.2)));
  lathes.push(boss('eye', d.ramEye, -0.08, 0.08, 0.05, tone(C.trim, 0.2)));
  extrudes.push(box('pad', add(d.foot, [-0.18, 0, -0.03]), add(d.foot, [0.18, 0, -0.03]), 0.4, 0.05, pad, [0, 0, 1]));
  return { lathes, lofts, extrudes, hardpoints: { pin: [0, 0, 0], foot: add(d.foot, [0, 0, -0.055]), ramEye: d.ramEye }, outline: [add(d.foot, [0, 0, -0.055])] };
}

// ── a mini excavator's upper: a round deck inside its tracks, the engine's cover over its back, the tank to the
// right, the swing post's bracket at its front, the swing ram's base ───────────────────────────────────────────
export function houseMini(row, C) {
  const d = row.dims, extrudes = [], lathes = [], body = C.paint, dark = C.trim, R0 = d.r;
  const circle = (r, n, a0 = 0, a1 = 2 * Math.PI) => Array.from({ length: n + 1 }, (_, k) => { const a = a0 + ((a1 - a0) * k) / n; return [r * Math.cos(a), r * Math.sin(a)]; });
  extrudes.push(plan('deck', 0, d.deck, circle(R0, 24).slice(0, -1), dark));
  // (the cover over the back half, its top rounded in plan; the tank to the right ahead of it)
  extrudes.push(plan('cover', d.deck, d.cover, [[R0 - 0.04, -0.05], ...circle(R0 - 0.04, 12, 0, -Math.PI).slice(1, -1).map(([x, y]) => [x, y]), [-R0 + 0.04, -0.05]], body));
  extrudes.push(plan('tank', d.deck, d.cover - 0.1, [[0.2, -0.05], [R0 - 0.08, -0.05], [R0 - 0.2, 0.42], [0.2, 0.42]], body));
  // the swing post's bracket at the front, its pins above and below the post
  const P = d.post;
  extrudes.push(plan('bracket', 0, d.deck + 0.05, [[-0.2, R0 - 0.2], [0.2, R0 - 0.2], [0.16, P[1] + 0.1], [-0.16, P[1] + 0.1]], dark));
  for (const z of [P[2] - 0.2, P[2] + 0.3]) extrudes.push(plan(`post_lug_${z < P[2] ? 'lo' : 'hi'}`, z - 0.03, z + 0.03, [[-0.12, P[1] - 0.15], [0.12, P[1] - 0.15], [0.1, P[1] + 0.1], [-0.1, P[1] + 0.1]], dark));
  const S = d.swingRam;
  lathes.push(spin('swing_pin', [S[0], S[1], S[2] - 0.05], [S[0], S[1], S[2] + 0.05], [[0, 0.04], [1, 0.04]], tone(dark, 0.2), 12));
  return { extrudes, lathes, hardpoints: { post: P, swingRam: S, cab: d.cab, counterweight: d.counterweight } };
}

// ── a wheeled excavator's chassis: its frame, its two axles on twin tyres, the slewing ring's seat ─────────────
export function wheeledExChassis(row, C, { physics }) {
  const d = row.dims, extrudes = [], lathes = [], dark = C.trim, body = C.paint;
  const hb = physics.wheelbase / 2, tw = physics.track / 2, z = physics.wheelRadius, gap = d.twin / 2;
  extrudes.push(plan('frame', z - 0.15, d.slewZ - 0.25, [[-0.55, -hb - 0.55], [0.55, -hb - 0.55], [0.55, hb + 0.5], [-0.55, hb + 0.5]], dark));
  extrudes.push(plan('deck', d.slewZ - 0.25, d.slewZ - 0.15, [[-1.0, -0.9], [1.0, -0.9], [1.0, 0.9], [-1.0, 0.9]], dark));
  for (const y of [-hb, hb]) lathes.push(spin(`axle_${y > 0 ? 'f' : 'r'}`, [-tw + 0.15, y, z], [tw - 0.15, y, z], [[0, 0.12], [0.35, 0.18], [0.65, 0.18], [1, 0.12]], tone(dark, 0.1), 16));
  for (const s of [1, -1]) {
    extrudes.push(box(`step_${side(s)}`, [s * 1.0, -0.6, d.slewZ - 0.5], [s * 1.0, 0.6, d.slewZ - 0.5], 0.08, 0.06, body));
    for (const y of [-hb, hb]) extrudes.push(box(`fender_${side(s)}${y > 0 ? 'f' : 'r'}`, [s * tw, y - z - 0.05, 2 * z + 0.06], [s * tw, y + z + 0.05, 2 * z + 0.06], d.twin + 0.3, 0.04, body));
  }
  lathes.push(spin('seat', [0, 0, d.slewZ - 0.15], [0, 0, d.slewZ - 0.1], [[0, 0.7], [1, 0.66]], tone(dark, 0.1), 28));
  const W = (y, s, io) => [s * (tw + (io === 'o' ? gap : -gap)), y, z];
  const hp = { slew: [0, 0, d.slewZ - 0.1], ground: [0, 0, 0] };
  for (const [e, y] of [['F', hb], ['R', -hb]]) for (const [sd, s] of [['r', 1], ['l', -1]]) for (const io of ['o', 'i']) hp[`wheel${e}.${sd}${io}`] = W(y, s, io);
  return { extrudes, lathes, hardpoints: hp };
}

export { tube, mul };
