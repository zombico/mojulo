/**
 * con-finishers — the builders of the machines that finish a surface: a tandem roller's two frames (the engine's over
 * the rear drum and the operator's platform, the water tank's over the front drum, a yoke round each drum, the hitch
 * between them) and its smooth drums; a motor grader's rear frame (its engine, its cab's deck, its tandems), its front
 * frame (the gooseneck over the blade, the saddle its lift rams hang from, its front axle, the drawbar's ball), its
 * drawbar, its circle, the saddle its moldboard slides on, and its moldboard. Each drawn in its body's frame
 * (con-parts.js says the contract); an articulated machine's frames meet at its hitch, on the ground under the joint.
 * Pure: no clock, no dice.
 */
import { box, extrudeWorld, panel as rawPanel, spin, tone, tube } from './con-common.js';

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
const rect = (x0, x1, y0, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/** The hitch's plates (the other frame's pins between them) and its steer rams' pins: a loader's, a roller's. */
function hitch(extrudes, lathes, S, dark, front) {
  for (const z of [0.5, 1.05]) extrudes.push(box(`hitch_${z < 1 ? 'lo' : 'hi'}`, [0, front ? 0.05 : -0.35, z], [0, front ? 0.35 : -0.05, z], 0.5, 0.06, dark));
  for (const s of [1, -1]) lathes.push(boss(`steer_${front ? 'eye' : 'pin'}_${side(s)}`, [s * S[0], S[1], S[2]], s * (S[0] - 0.08), s * (S[0] + 0.08), 0.05, tone(dark, 0.2)));
}

// ── a drum's yoke: the side plates either side of it, its bearings, the scraper bar across its face ─────────────
function yoke(extrudes, lathes, y, d, r, body, dark, face) {
  const w = d.drumW / 2;
  for (const s of [1, -1]) {
    extrudes.push(panel(`yoke_${face}_${side(s)}`, s * (w + 0.02), s * (w + 0.06), [[y - r - 0.15, r - 0.1], [y + r + 0.15, r - 0.1], [y + r + 0.15, 2 * r + 0.25], [y - r - 0.15, 2 * r + 0.25]], body));
    lathes.push(boss(`bearing_${face}_${side(s)}`, [0, y, r], s * (w + 0.06), s * (w + 0.1), 0.22, dark));
  }
  extrudes.push(box(`scraper_${face}`, [-w, y + (face === 'f' ? r + 0.06 : -r - 0.06), r * 0.55], [w, y + (face === 'f' ? r + 0.06 : -r - 0.06), r * 0.55], 0.04, 0.12, dark));
  extrudes.push(plan(`deck_${face}`, 2 * r + 0.15, 2 * r + 0.27, rect(-w - 0.1, w + 0.1, y - r - 0.15, y + r + 0.15), body));
  // (the sprinkler bar over the drum's face)
  extrudes.push(box(`sprinkler_${face}`, [-w + 0.05, y + (face === 'f' ? r + 0.18 : -r - 0.18), 2 * r], [w - 0.05, y + (face === 'f' ? r + 0.18 : -r - 0.18), 2 * r], 0.05, 0.05, tone(dark, 0.2)));
}

// ── a tandem roller's rear frame: the engine's hood over its drum, the operator's platform, its console and seat ─
export function rollerRear(row, C, { physics }) {
  const d = row.dims, extrudes = [], lathes = [], sweeps = [], body = C.paint, dark = C.trim, hb = physics.wheelbase / 2, r = physics.wheelRadius, w = d.drumW / 2;
  yoke(extrudes, lathes, -hb, d, r, body, dark, 'r');
  extrudes.push(box('frame', [0, -hb + r, 0.8], [0, -0.3, 0.8], 0.8, 0.4, dark));
  // the engine's hood over the rear drum, its grille, its stack
  extrudes.push(plan('hood', 2 * r + 0.27, d.hoodTop, rect(-w + 0.05, w - 0.05, -hb - r - 0.1, d.platform[0]), body));
  extrudes.push(plan('hood_cap', d.hoodTop, d.hoodTop + 0.04, rect(-w + 0.12, w - 0.12, -hb - r - 0.02, d.platform[0] - 0.08), tone(body, -0.06)));
  extrudes.push(panel('grille', -w + 0.3, w - 0.3, [[-hb - r - 0.11, 2 * r + 0.45], [-hb - r - 0.09, 2 * r + 0.45], [-hb - r - 0.09, d.hoodTop - 0.12], [-hb - r - 0.11, d.hoodTop - 0.12]], dark));
  lathes.push(spin('stack', [0.45, -hb - 0.2, d.hoodTop], [0.45, -hb - 0.2, d.hoodTop + 0.4], [[0, 0.05], [1, 0.055]], tone(dark, 0.2), 12));
  // the operator's platform over the hitch, its steering console and wheel, its seat, its rails
  extrudes.push(plan('platform', d.deckZ - 0.1, d.deckZ, rect(-w - 0.05, w + 0.05, d.platform[0], d.platform[1]), dark));
  extrudes.push(box('pillar', [0, d.platform[0] + 0.1, 0.9], [0, d.platform[0] + 0.1, d.deckZ - 0.1], 0.7, 0.3, body, [0, 1, 0]));
  extrudes.push(box('console', [0, d.platform[1] - 0.2, d.deckZ], [0, d.platform[1] - 0.2, d.deckZ + 0.75], 0.45, 0.25, tone(dark, 0.1), [0, 1, 0]));
  lathes.push(spin('wheel', [0, d.platform[1] - 0.32, d.deckZ + 0.8], [0, d.platform[1] - 0.36, d.deckZ + 0.85], [[0, 0.2], [1, 0.2]], dark, 16));
  extrudes.push(box('seat', [0, -0.3, d.deckZ + 0.4], [0, 0.1, d.deckZ + 0.4], 0.5, 0.1, C.rubber));
  extrudes.push(box('seat_back', [0, -0.35, d.deckZ + 0.45], [0, -0.28, d.deckZ + 0.95], 0.48, 0.08, C.rubber, [0, 1, 0]));
  for (const s of [1, -1]) sweeps.push(tube(`rail_${side(s)}`, [[s * (w + 0.02), d.platform[0], d.deckZ], [s * (w + 0.02), d.platform[0], d.deckZ + 0.7], [s * (w + 0.02), d.platform[1], d.deckZ + 0.7], [s * (w + 0.02), d.platform[1], d.deckZ]], 0.018, C.light, 6));
  hitch(extrudes, lathes, d.steerRam, dark, false);
  const S = d.steerRam;
  return { extrudes, lathes, sweeps, hardpoints: { hitch: [0, 0, 0], cab: [0, d.cab, d.deckZ], drum: [0, -hb, r], 'steerRam.r': S, 'steerRam.l': [-S[0], S[1], S[2]] } };
}

// ── a tandem roller's front frame: its drum's yoke, the water tank over it, the frame back to the hitch ─────────
export function rollerFront(row, C, { physics }) {
  const d = row.dims, extrudes = [], lathes = [], body = C.paint, dark = C.trim, hb = physics.wheelbase / 2, r = physics.wheelRadius, w = d.drumW / 2;
  yoke(extrudes, lathes, hb, d, r, body, dark, 'f');
  extrudes.push(box('frame', [0, 0.3, 0.8], [0, hb - r, 0.8], 0.8, 0.4, dark));
  // the water tank over the front drum, its filler cap, its lamps
  extrudes.push(plan('tank', 2 * r + 0.27, d.tankTop, rect(-w + 0.05, w - 0.05, d.tank, hb + r + 0.1), body));
  lathes.push(spin('filler', [0, hb, d.tankTop], [0, hb, d.tankTop + 0.08], [[0, 0.12], [1, 0.12]], dark, 14));
  for (const s of [1, -1]) extrudes.push(box(`lamp_${side(s)}`, [s * (w - 0.25), hb + r + 0.1, d.tankTop - 0.15], [s * (w - 0.25), hb + r + 0.14, d.tankTop - 0.15], 0.22, 0.12, C.light));
  hitch(extrudes, lathes, d.steerEye, dark, true);
  const S = d.steerEye;
  return { extrudes, lathes, hardpoints: { drum: [0, hb, r], 'steerEye.r': S, 'steerEye.l': [-S[0], S[1], S[2]] } };
}

// ── a roller's drum: its smooth shell, its end plates, its hubs (the drum is its wheel) ─────────────────────────
export function rollerDrum(row, C) {
  const { r, width: w } = row.dims, steel = tone(C.chrome, -0.32), dark = C.trim;
  const lathes = [
    spin('shell', [-w / 2, 0, 0], [w / 2, 0, 0], [[0, r - 0.02], [0.01, r], [0.99, r], [1, r - 0.02]], steel, 36),
    spin('plate_r', [w / 2 - 0.005, 0, 0], [w / 2 + 0.01, 0, 0], [[0, r - 0.05], [1, r - 0.05]], dark, 28),
    spin('plate_l', [-w / 2 - 0.01, 0, 0], [-w / 2 + 0.005, 0, 0], [[0, r - 0.05], [1, r - 0.05]], dark, 28),
    spin('hub', [-w / 2 - 0.08, 0, 0], [w / 2 + 0.08, 0, 0], [[0, 0.12], [1, 0.12]], tone(dark, 0.2), 16),
  ];
  return { lathes, hardpoints: { hub: [0, 0, 0] } };
}

// ── a motor grader's rear frame: its engine module over its tandems, its cab's deck, the hitch ahead ────────────
export function graderRear(row, C, { physics }) {
  const d = row.dims, extrudes = [], lathes = [], sweeps = [], body = C.paint, dark = C.trim, tw = physics.track / 2, r = physics.wheelRadius, [a0, a1] = d.axles;
  extrudes.push(box('frame', [0, 0.1, 1.05], [0, d.tail + 0.2, 1.05], 0.8, 0.5, dark));
  // the tandems: a case each side the two wheels turn on, rocking on its pivot
  for (const s of [1, -1]) {
    extrudes.push(box(`tandem_${side(s)}`, [s * (tw - 0.33), a0 + 0.55, r], [s * (tw - 0.33), a1 - 0.55, r], 0.24, 0.6, dark));
    lathes.push(boss(`tandem_pivot_${side(s)}`, [0, (a0 + a1) / 2, r + 0.1], s * 0.4, s * (tw - 0.45), 0.16, tone(dark, 0.15)));
    extrudes.push(box(`fender_${side(s)}`, [s * tw, a0 + r + 0.15, 2 * r + 0.12], [s * tw, a1 - r - 0.15, 2 * r + 0.12], 0.42, 0.05, body));
  }
  // the engine's hood over the tandems, its grille, the rear bumper, its stack
  extrudes.push(plan('hood', 1.3, d.hoodTop, rect(-0.72, 0.72, d.tail + 0.15, d.cab[1] - 0.75), body));
  extrudes.push(plan('hood_cap', d.hoodTop, d.hoodTop + 0.05, rect(-0.66, 0.66, d.tail + 0.2, d.cab[1] - 0.8), tone(body, -0.06)));
  extrudes.push(panel('grille', -0.5, 0.5, [[d.tail + 0.13, 1.5], [d.tail + 0.15, 1.5], [d.tail + 0.15, d.hoodTop - 0.15], [d.tail + 0.13, d.hoodTop - 0.15]], dark));
  extrudes.push(box('bumper', [-1.0, d.tail, 0.75], [1.0, d.tail, 0.75], 0.2, 0.3, dark));
  lathes.push(spin('stack', [0.4, d.tail + 1.0, d.hoodTop], [0.4, d.tail + 1.0, d.hoodTop + 0.45], [[0, 0.06], [1, 0.065]], tone(dark, 0.2), 12));
  // the cab's deck and its steps
  extrudes.push(plan('deck', d.cab[2] - 0.1, d.cab[2], rect(-1.0, 1.0, d.cab[1] - 0.75, 0.05), dark));
  for (const s of [1, -1]) sweeps.push(tube(`step_${side(s)}`, [[s * 1.0, d.cab[1] - 0.2, d.cab[2] - 0.1], [s * 1.05, d.cab[1] - 0.2, 0.55], [s * 1.05, d.cab[1] + 0.2, 0.55], [s * 1.0, d.cab[1] + 0.2, d.cab[2] - 0.1]], 0.02, tone(C.chrome, -0.2), 6));
  hitch(extrudes, lathes, d.steerRam, dark, false);
  const S = d.steerRam, hp = { hitch: [0, 0, 0], cab: d.cab, 'steerRam.r': S, 'steerRam.l': [-S[0], S[1], S[2]] };
  [a0, a1].forEach((y, i) => { hp[`axle${i}.r`] = [tw, y, r]; hp[`axle${i}.l`] = [-tw, y, r]; });
  return { extrudes, lathes, sweeps, hardpoints: hp };
}

// ── a motor grader's front frame: the gooseneck from the hitch over the blade to the front axle, the saddle its lift
// rams hang from, the drawbar's ball under its nose, its front axle and its push block ─────────────────────────
export function graderFront(row, C, { physics }) {
  const d = row.dims, extrudes = [], lathes = [], body = C.paint, dark = C.trim, tw = physics.track / 2, r = physics.wheelRadius, B = d.beam, y1 = d.axle;
  // the gooseneck: up from the hitch, along over the blade, down to the front axle
  const pts = [[0.15, 1.0], [B.rise, B.z], [B.drop, B.z], [y1 + 0.25, r + 0.5], [y1 + 0.7, r + 0.45]];
  for (let k = 0; k < pts.length - 1; k++) extrudes.push(box(`neck_${k}`, [0, pts[k][0], pts[k][1]], [0, pts[k + 1][0], pts[k + 1][1]], B.w, B.h, body));
  extrudes.push(plan('push_block', r + 0.15, r + 0.8, rect(-0.5, 0.5, y1 + 0.65, y1 + 0.95), dark));
  // the saddle over the beam: its brackets up to the lift rams' pins
  const L = d.liftRam;
  extrudes.push(box('saddle', [0, L[1], B.z], [0, L[1], L[2] + 0.12], 2 * L[0] + 0.2, 0.3, body, [0, 1, 0]));
  for (const s of [1, -1]) lathes.push(boss(`lift_pin_${side(s)}`, [s * L[0], L[1], L[2]], s * (L[0] - 0.08), s * (L[0] + 0.12), 0.07, tone(dark, 0.2)));
  // the drawbar's ball under the nose, on its bracket
  const P = d.ball;
  extrudes.push(box('ball_bracket', [0, P[1], P[2]], [0, P[1], B.z - B.h / 2], 0.3, 0.3, dark, [0, 1, 0]));
  lathes.push(spin('ball', [0, P[1], P[2] - 0.12], [0, P[1], P[2] + 0.12], [[0, 0.05], [0.5, 0.13], [1, 0.05]], tone(dark, 0.25), 14));
  // the front axle, oscillating under the nose
  lathes.push(spin('axle', [-tw + 0.2, y1, r], [tw - 0.2, y1, r], [[0, 0.1], [0.45, 0.14], [0.55, 0.14], [1, 0.1]], tone(dark, 0.1), 16));
  lathes.push(boss('axle_pivot', [0, y1, r + 0.2], -0.25, 0.25, 0.14, dark));
  hitch(extrudes, lathes, d.steerEye, dark, true);
  const S = d.steerEye;
  return { extrudes, lathes, hardpoints: { ball: P, 'liftRam.r': L, 'liftRam.l': [-L[0], L[1], L[2]], 'steerEye.r': S, 'steerEye.l': [-S[0], S[1], S[2]], 'axle.r': [tw, y1, r], 'axle.l': [-tw, y1, r] } };
}

// ── a drawbar: an A-frame from its ball back to the circle's drive, the lift rams' eyes at its sides ────────────
export function drawbar(row, C) {
  const d = row.dims, extrudes = [], lathes = [], body = C.paint, dark = C.trim, Cc = d.circle, E = d.liftEye;
  lathes.push(spin('socket', [0, 0, -0.12], [0, 0, 0.12], [[0, 0.16], [1, 0.16]], dark, 14));
  for (const s of [1, -1]) extrudes.push(box(`leg_${side(s)}`, [0, -0.1, -0.02], [s * d.spread, Cc[1] + 0.3, Cc[2] + 0.12], 0.18, 0.2, body));
  extrudes.push(box('cross', [-d.spread, Cc[1] + 0.3, Cc[2] + 0.12], [d.spread, Cc[1] + 0.3, Cc[2] + 0.12], 0.18, 0.2, body));
  // the circle's drive: its gearbox and motor over the circle's front
  extrudes.push(plan('drive', Cc[2] + 0.1, Cc[2] + 0.55, rect(-0.25, 0.25, Cc[1] + 0.55, Cc[1] + 0.95), dark));
  extrudes.push(plan('plate', Cc[2] + 0.02, Cc[2] + 0.1, rect(-0.6, 0.6, Cc[1] - 0.5, Cc[1] + 0.95), body));
  for (const s of [1, -1]) {
    extrudes.push(box(`eye_lug_${side(s)}`, [s * E[0], E[1], E[2]], [s * E[0], E[1], Cc[2] + 0.1], 0.14, 0.2, body, [0, 1, 0]));
    lathes.push(boss(`eye_${side(s)}`, [s * E[0], E[1], E[2]], s * (E[0] - 0.08), s * (E[0] + 0.08), 0.06, tone(dark, 0.2)));
  }
  return { extrudes, lathes, hardpoints: { circle: Cc, 'liftEye.r': E, 'liftEye.l': [-E[0], E[1], E[2]] } };
}

// ── a grader's circle: its toothed ring, its two arms down to the moldboard's pivots, its tip ram's bracket ─────
export function graderCircle(row, C) {
  const d = row.dims, extrudes = [], lathes = [], body = C.paint, dark = C.trim, R = d.r, P = d.pivot, T = d.tipRam;
  lathes.push(spin('ring', [0, 0, -0.06], [0, 0, 0.06], [[0, R], [1, R]], body, 40));
  lathes.push(spin('teeth', [0, 0, -0.04], [0, 0, 0.04], [[0, R + 0.04], [1, R + 0.04]], dark, 40));
  lathes.push(spin('hole', [0, 0, -0.07], [0, 0, 0.07], [[0, R - 0.18], [1, R - 0.18]], tone(dark, 0.1), 32));
  for (const s of [1, -1]) {
    extrudes.push(panel(`arm_${side(s)}`, s * (d.arm - 0.06), s * (d.arm + 0.06), [[-0.35, 0.0], [0.35, 0.0], [P[1] + 0.18, P[2]], [P[1] - 0.18, P[2]]], body));
    lathes.push(boss(`pivot_${side(s)}`, [0, P[1], P[2]], s * (d.arm - 0.1), s * (d.arm + 0.1), 0.08, tone(dark, 0.2)));
  }
  extrudes.push(box('tip_bracket', [T[0], T[1], 0], [T[0], T[1], T[2] - 0.08], 0.16, 0.2, body, [0, 1, 0]));
  lathes.push(boss('tip_pin', T, T[0] - 0.08, T[0] + 0.08, 0.05, tone(dark, 0.2)));
  return { extrudes, lathes, hardpoints: { blade: P, tipRam: T } };
}
/** A grader's moldboard saddle: its brackets from the pivots up, the rails the moldboard slides along. */
export function graderSaddle(row, C) {
  const d = row.dims, extrudes = [], lathes = [], body = C.paint, dark = C.trim, E = d.tipEye;
  for (const s of [1, -1]) extrudes.push(panel(`bracket_${side(s)}`, s * (d.arm - 0.05), s * (d.arm + 0.05), [[-0.12, -0.08], [0.12, -0.08], [0.1, E[2] + 0.08], [-0.1, E[2] + 0.08]], body));
  for (const z of d.rails) lathes.push(spin(`rail_${z > 0.2 ? 'hi' : 'lo'}`, [-d.arm - 0.25, d.rail, z], [d.arm + 0.25, d.rail, z], [[0, 0.05], [1, 0.05]], tone(C.chrome, -0.2), 12));
  extrudes.push(box('tip_lug', [E[0], E[1], E[2] - 0.15], [E[0], E[1], E[2] + 0.06], 0.14, 0.16, body, [0, 1, 0]));
  lathes.push(boss('tip_eye', E, E[0] - 0.08, E[0] + 0.08, 0.05, tone(dark, 0.2)));
  return { extrudes, lathes, hardpoints: { rail: [0, d.rail, 0], tipEye: E } };
}
/** A grader's moldboard: its curved face along its length, its back's rail clamps, its cutting edge and end bits. */
export function moldboard(row, C) {
  const d = row.dims, extrudes = [], body = C.paint, dark = C.trim, L = d.length / 2, H = d.height;
  // (its face in (y, z): the cutting edge forward and low, curling back to its top)
  const face = [[0.06, -H / 2], [0.2, -H / 2 + 0.02], [0.17, -H / 2 + 0.16], [0.1, -H / 2 + 0.32], [0.08, H / 2 - 0.15], [0.12, H / 2], [0.04, H / 2], [0.0, H / 2 - 0.1], [0.0, -H / 2 + 0.05]];
  extrudes.push(panel('face', -L, L, face, body));
  extrudes.push(panel('edge', -L, L, [[0.1, -H / 2 - 0.06], [0.23, -H / 2 - 0.06], [0.22, -H / 2 + 0.06], [0.09, -H / 2 + 0.06]], dark));
  for (const s of [1, -1]) extrudes.push(panel(`end_bit_${side(s)}`, s * (L - 0.02), s * (L + 0.03), [[0.0, -H / 2 - 0.08], [0.26, -H / 2 - 0.08], [0.22, H / 2 - 0.1], [0.0, H / 2 - 0.1]], dark));
  for (const x of [-0.6, 0.6]) extrudes.push(box(`clamp_${x > 0 ? 'r' : 'l'}`, [x, -0.06, -0.12], [x, -0.06, 0.45], 0.2, 0.1, dark, [0, 1, 0]));
  const E = [0, 0.22, -H / 2 - 0.06];
  return { extrudes, hardpoints: { edge: E, 'edge.r': [L, E[1], E[2]], 'edge.l': [-L, E[1], E[2]] }, outline: [[L, E[1], E[2]], [-L, E[1], E[2]], [L, 0.1, -H / 2 - 0.06], [-L, 0.1, -H / 2 - 0.06]] };
}
