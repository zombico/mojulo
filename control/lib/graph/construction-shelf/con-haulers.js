/**
 * con-haulers — the builders of the machines that carry: a truck's chassis (its rails, its axles on single and twin
 * wheels, a mixer's pedestals), a cab over the front axle, a tipping body (a tipper's, an articulated dump truck's, a
 * haul truck's with its canopy over the cab), an articulated hauler's two frames, a haul truck's frame and its deck,
 * a mixer's drum. Each drawn in its body's frame (con-parts.js says the contract).
 *
 * A wheel's hardpoints are named for its axle, counted from the front: `axle0.r` (a single wheel), `axle2.ro` and
 * `axle2.ri` (a twin pair's outer and inner). Pure: no clock, no dice.
 */
import { box, extrudeWorld, loftWorld, panel as rawPanel, roundRect, spin, sub, tone, tube, unit } from './con-common.js';

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

/** The wheels' hardpoints along a machine's axles: a single wheel each side, or a twin pair's outer and inner. */
function wheelPoints(axles, track, r, twin = 0.34) {
  const hp = {};
  axles.forEach((a, i) => {
    for (const [sd, s] of [['r', 1], ['l', -1]]) {
      if (a.twin) { hp[`axle${i}.${sd}o`] = [s * (track / 2 + twin / 2), a.y, r]; hp[`axle${i}.${sd}i`] = [s * (track / 2 - twin / 2), a.y, r]; }
      else hp[`axle${i}.${sd}`] = [s * (a.track ?? track) / 2, a.y, r];
    }
  });
  return hp;
}

// ── a truck's chassis: its two rails, their cross members, its axles, its tank, its mudguards; a mixer's pedestals ─
export function truckChassis(row, C, { physics }) {
  const d = row.dims, R = d.rails, extrudes = [], lathes = [], dark = C.trim, body = C.paint, tw = physics.track, r = physics.wheelRadius;
  for (const s of [1, -1]) extrudes.push(box(`rail_${side(s)}`, [s * R.w / 2, R.rear, R.z], [s * R.w / 2, R.front, R.z], 0.1, R.h, dark));
  for (let k = 0; k <= 6; k++) { const y = R.rear + 0.2 + ((R.front - R.rear - 0.4) * k) / 6; extrudes.push(box(`cross_${k}`, [-R.w / 2, y, R.z], [R.w / 2, y, R.z], 0.08, R.h * 0.8, dark, [0, 0, 1])); }
  d.axles.forEach((a, i) => {
    lathes.push(spin(`axle_${i}`, [-tw / 2 + 0.2, a.y, r], [tw / 2 - 0.2, a.y, r], [[0, 0.1], [0.4, a.twin ? 0.2 : 0.13], [0.6, a.twin ? 0.2 : 0.13], [1, 0.1]], tone(dark, 0.1), 16));
    // (a twin axle's mudguards over both its wheels; a steered axle's over its wheel, on the cab's side)
    if (a.twin) for (const s of [1, -1]) extrudes.push(box(`guard_${i}${side(s)}`, [s * tw / 2, a.y - r - 0.12, 2 * r + 0.08], [s * tw / 2, a.y + r + 0.12, 2 * r + 0.08], 0.75, 0.04, dark));
  });
  // the fuel tank on the right, the battery box on the left, the bumper and the underrun bar
  lathes.push(spin('tank', [R.w / 2 + 0.38, d.tank - 0.6, R.z - 0.1], [R.w / 2 + 0.38, d.tank + 0.6, R.z - 0.1], [[0, 0.24], [0.05, 0.3], [0.95, 0.3], [1, 0.24]], tone(C.chrome, -0.1), 16));
  extrudes.push(box('battery', [-R.w / 2 - 0.3, d.tank - 0.3, R.z - 0.1], [-R.w / 2 - 0.3, d.tank + 0.3, R.z - 0.1], 0.45, 0.45, dark));
  extrudes.push(box('underrun', [-tw / 2 + 0.1, R.rear - 0.05, 0.55], [tw / 2 - 0.1, R.rear - 0.05, 0.55], 0.1, 0.12, dark, [0, 0, 1]));
  for (const s of [1, -1]) extrudes.push(box(`lamp_${side(s)}`, [s * (tw / 2 - 0.25), R.rear - 0.02, 0.85], [s * (tw / 2 - 0.25), R.rear - 0.06, 0.85], 0.35, 0.12, '#b8322a'));
  const hp = { cab: d.cab, ...wheelPoints(d.axles, tw, r) };
  if (d.tip) {
    // the tipping body's hinge at the rails' tail, its hoist's cradle behind the cab
    for (const s of [1, -1]) extrudes.push(panel(`hinge_${side(s)}`, s * (R.w / 2 - 0.05), s * (R.w / 2 + 0.03), [[d.tip[1] - 0.25, R.z], [d.tip[1] + 0.25, R.z], [d.tip[1] + 0.08, d.tip[2] + 0.08], [d.tip[1] - 0.08, d.tip[2] + 0.08]], dark));
    lathes.push(boss('hinge_pin', d.tip, -R.w / 2 - 0.05, R.w / 2 + 0.05, 0.06, tone(dark, 0.2)));
    extrudes.push(box('cradle', [0, d.tipRam[1], R.z + 0.1], [0, d.tipRam[1], d.tipRam[2]], 0.35, 0.25, dark, [0, 1, 0]));
    Object.assign(hp, { tip: d.tip, tipRam: d.tipRam });
  }
  if (d.drum) {
    // a mixer's drum: its front pedestal and its bearing, its rear rollers, the hopper over its mouth and the chute
    const D = d.drum, M = d.mouth;
    extrudes.push(box('pedestal', [0, D[1], R.z + 0.1], [0, D[1], D[2]], 0.6, 0.35, body, [0, 1, 0]));
    lathes.push(spin('bearing', [0, D[1] - 0.15, D[2]], [0, D[1] + 0.05, D[2]], [[0, 0.3], [1, 0.3]], dark, 18));
    for (const s of [1, -1]) {
      extrudes.push(box(`stand_${side(s)}`, [s * 0.7, M[1] + 0.9, R.z + 0.1], [s * 0.7, M[1] + 0.9, M[2] - 0.75], 0.18, 0.18, body, [0, 1, 0]));
      lathes.push(spin(`roller_${side(s)}`, [s * 0.62, M[1] + 0.82, M[2] - 0.75], [s * 0.62, M[1] + 1.0, M[2] - 0.75], [[0, 0.16], [1, 0.16]], dark, 14));
    }
    extrudes.push(extrudeWorld('hopper', [0, M[1] - 0.15, M[2] + 0.4], [0, M[1] - 0.15, M[2] + 0.85], [[-0.55, -0.4, 0], [0.55, -0.4, 0], [0.75, 0.45, 0], [-0.75, 0.45, 0]], body));
    extrudes.push(extrudeWorld('chute', [0, M[1] - 0.35, M[2] - 0.35], [0, M[1] - 1.55, M[2] - 0.95], [[-0.25, 0, 0.1], [0.25, 0, 0.1], [0.3, 0, -0.1], [-0.3, 0, -0.1]], tone(C.chrome, -0.25)));
    Object.assign(hp, { drum: D });
  }
  return { extrudes, lathes, hardpoints: hp };
}

// ── a cab over the front axle: its shell, its glass, its grille and its bumper, its mirrors ──────────────────────
export function truckCab(row, C) {
  const { w, l, h } = row.dims, extrudes = [], sweeps = [], body = C.paint, dark = C.trim, glass = C.glass, k = 0.52;
  extrudes.push(plan('shell', 0, h * k, rect(-w / 2, w / 2, 0, l), body));
  extrudes.push(plan('cabin', h * k, h - 0.1, rect(-w / 2 + 0.03, w / 2 - 0.03, 0.03, l - 0.12), body));
  for (const s of [1, -1]) extrudes.push(panel(`window_${side(s)}`, s * (w / 2 - 0.02), s * (w / 2 + 0.005), [[l * 0.45, h * k + 0.08], [l - 0.2, h * k + 0.08], [l - 0.24, h - 0.2], [l * 0.45, h - 0.2]], glass));
  extrudes.push(box('screen', [0, l - 0.1, h * k + 0.45], [0, l - 0.08, h * k + 0.45], w - 0.2, 0.8, glass, [0, 0, 1]));
  extrudes.push(plan('roof', h - 0.1, h, rect(-w / 2 + 0.05, w / 2 - 0.05, 0.05, l - 0.15), tone(body, -0.06)));
  extrudes.push(box('grille', [0, l + 0.005, h * 0.3], [0, l + 0.02, h * 0.3], w * 0.55, h * 0.3, dark));
  extrudes.push(box('bumper', [0, l + 0.08, 0.05], [0, l + 0.08, 0.05], w, 0.3, dark, [0, 0, 1]));
  for (const s of [1, -1]) {
    extrudes.push(box(`lamp_${side(s)}`, [s * (w / 2 - 0.3), l + 0.02, 0.32], [s * (w / 2 - 0.3), l + 0.05, 0.32], 0.35, 0.14, C.light));
    sweeps.push(tube(`mirror_arm_${side(s)}`, [[s * w / 2, l - 0.25, h * 0.75], [s * (w / 2 + 0.18), l - 0.2, h * 0.75]], 0.02, dark, 6));
    extrudes.push(box(`mirror_${side(s)}`, [s * (w / 2 + 0.2), l - 0.2, h * 0.6], [s * (w / 2 + 0.2), l - 0.2, h * 0.9], 0.04, 0.2, dark, [0, 1, 0]));
  }
  return { extrudes, sweeps, hardpoints: { mount: [0, 0, 0] } };
}

// ── a tipping body: its floor, its sides, its headboard (and a haul truck's canopy over the cab), its tailgate, its
// hinge's bosses at the rear, its hoist's eye at the front ─────────────────────────────────────────────────────
export function tipBody(row, C) {
  const d = row.dims, extrudes = [], lathes = [], body = C.paint, dark = C.trim, w = d.width, L = d.length, f = d.floor, H = d.side;
  // the sub-frame from the hinge forward, the floor on it
  for (const s of [1, -1]) extrudes.push(box(`sub_${side(s)}`, [s * d.sub, 0, f / 2], [s * d.sub, L, f / 2], 0.14, f, dark));
  extrudes.push(plan('floor', f, f + 0.06, rect(-w / 2, w / 2, -0.05, L), body));
  // the sides, their ribs; the headboard (and the canopy over the cab, a haul truck's)
  for (const s of [1, -1]) {
    extrudes.push(panel(`side_${side(s)}`, s * (w / 2 - 0.05), s * (w / 2), [[-0.05, f], [L, f], [L, f + H + d.head], [L - 0.4, f + H], [-0.05, f + H]], body));
    for (let k = 1; k < 5; k++) extrudes.push(box(`rib_${side(s)}${k}`, [s * (w / 2 + 0.03), (L * k) / 5, f], [s * (w / 2 + 0.03), (L * k) / 5, f + H], 0.06, 0.08, tone(body, -0.1), [0, 1, 0]));
  }
  extrudes.push(box('headboard', [0, L - 0.03, f + (H + d.head) / 2], [0, L + 0.03, f + (H + d.head) / 2], w, H + d.head, body));
  if (d.canopy) extrudes.push(plan('canopy', f + H + d.head - 0.08, f + H + d.head, rect(-w / 2, w / 2, L - 0.3, L + d.canopy), body));
  // the tailgate at the rear (or an open tail, a rock body's), the hinge's bosses, the hoist's eye
  if (!d.open) extrudes.push(box('tailgate', [0, -0.08, f + H / 2], [0, -0.03, f + H / 2], w - 0.04, H, tone(body, -0.05)));
  for (const s of [1, -1]) lathes.push(boss(`hinge_${side(s)}`, [0, 0, 0], s * (d.sub - 0.12), s * (d.sub + 0.12), 0.09, tone(dark, 0.2)));
  const E = d.ramEye, hp = { hinge: [0, 0, 0], tail: [0, -0.08, f], top: [0, L, f + H + d.head] };
  if (E[0]) { for (const s of [1, -1]) lathes.push(boss(`eye_${side(s)}`, [s * E[0], E[1], E[2]], s * (E[0] - 0.1), s * (E[0] + 0.1), 0.08, tone(dark, 0.2))); Object.assign(hp, { 'ramEye.r': E, 'ramEye.l': [-E[0], E[1], E[2]] }); }
  else { lathes.push(boss('eye', E, -0.2, 0.2, 0.09, tone(dark, 0.2))); hp.ramEye = E; }
  return { extrudes, lathes, hardpoints: hp, outline: [[0, -0.08, 0], [w / 2, -0.08, f], [-w / 2, -0.08, f]] };
}

// ── an articulated hauler's front frame: its engine's hood, its cab's deck, its axle, the hitch at its tail ──────
export function adtFront(row, C, { physics }) {
  const d = row.dims, extrudes = [], lathes = [], body = C.paint, dark = C.trim, tw = physics.track, r = physics.wheelRadius;
  extrudes.push(box('frame', [0, d.hitch[1], 1.0], [0, d.nose, 1.0], 0.9, 0.5, dark));
  extrudes.push(plan('hood', 1.25, 2.3, rect(-0.75, 0.75, d.axle - 0.2, d.nose), body));
  extrudes.push(box('grille', [0, d.nose + 0.01, 1.75], [0, d.nose + 0.03, 1.75], 1.2, 0.8, dark));
  extrudes.push(plan('deck', 1.2, 1.3, rect(-1.3, 1.3, d.hitch[1] + 0.3, d.axle + 0.4), dark));
  lathes.push(spin('axle', [-tw / 2 + 0.3, d.axle, r], [tw / 2 - 0.3, d.axle, r], [[0, 0.15], [0.4, 0.22], [0.6, 0.22], [1, 0.15]], tone(dark, 0.1), 16));
  for (const s of [1, -1]) extrudes.push(box(`fender_${side(s)}`, [s * tw / 2, d.axle - r - 0.1, 2 * r + 0.06], [s * tw / 2, d.axle + r * 0.7, 2 * r + 0.06], 0.75, 0.05, body));
  for (const z of [0.7, 1.3]) extrudes.push(box(`hitch_${z < 1 ? 'lo' : 'hi'}`, [0, d.hitch[1] - 0.3, z], [0, d.hitch[1] + 0.3, z], 0.7, 0.07, dark));
  const S = d.steerRam;
  return { extrudes, lathes, hardpoints: { hitch: d.hitch, cab: d.cab, 'steerRam.r': S, 'steerRam.l': [-S[0], S[1], S[2]], ...wheelPoints([{ y: d.axle }], tw, r) } };
}

// ── an articulated hauler's rear frame: its bogie's two axles, the body's hinge at its tail, the hoist's bases ───
export function adtRear(row, C, { physics }) {
  const d = row.dims, extrudes = [], lathes = [], body = C.paint, dark = C.trim, tw = physics.track, r = physics.wheelRadius;
  extrudes.push(box('frame', [0, 0, 1.0], [0, d.tip[1] - 0.1, 1.0], 1.0, 0.55, dark));
  for (const y of d.axles) lathes.push(spin(`axle_${Math.round(-y * 10)}`, [-tw / 2 + 0.3, y, r], [tw / 2 - 0.3, y, r], [[0, 0.15], [0.4, 0.22], [0.6, 0.22], [1, 0.15]], tone(dark, 0.1), 16));
  for (const s of [1, -1]) extrudes.push(box(`beam_${side(s)}`, [s * (tw / 2 - 0.55), d.axles[0], r], [s * (tw / 2 - 0.55), d.axles[1], r], 0.25, 0.35, dark));
  const S = d.steerEye, H = d.hoist;
  for (const s of [1, -1]) {
    lathes.push(boss(`steer_eye_${side(s)}`, [s * S[0], S[1], S[2]], s * (S[0] - 0.08), s * (S[0] + 0.08), 0.06, tone(dark, 0.2)));
    lathes.push(boss(`hoist_pin_${side(s)}`, [s * H[0], H[1], H[2]], s * (H[0] - 0.1), s * (H[0] + 0.1), 0.08, tone(dark, 0.2)));
  }
  lathes.push(boss('tip_pin', d.tip, -0.55, 0.55, 0.08, tone(dark, 0.2)));
  return { extrudes, lathes, hardpoints: { tip: d.tip, 'steerEye.r': S, 'steerEye.l': [-S[0], S[1], S[2]], 'hoistRam.r': H, 'hoistRam.l': [-H[0], H[1], H[2]], ...wheelPoints(d.axles.map((y) => ({ y })), tw, r) } };
}

// ── a haul truck's frame: its rails, its deck over the front axle (the cab to the left), its grille, its stairs ──
export function haulFrame(row, C, { physics }) {
  const d = row.dims, extrudes = [], lathes = [], lofts = [], body = C.paint, dark = C.trim, tw = physics.track, r = physics.wheelRadius;
  for (const s of [1, -1]) extrudes.push(box(`rail_${side(s)}`, [s * 0.55, d.tip[1] - 0.2, 1.7], [s * 0.55, d.nose, 1.7], 0.25, 0.9, dark));
  extrudes.push(plan('deck', d.deck - 0.12, d.deck, rect(-d.deckW / 2, d.deckW / 2, d.axleF - 1.0, d.nose + 0.2), dark));
  extrudes.push(plan('engine', 1.4, d.deck - 0.12, rect(-0.9, 0.9, d.axleF - 1.2, d.nose), body));
  extrudes.push(box('grille', [0, d.nose + 0.02, d.deck - 0.9], [0, d.nose + 0.06, d.deck - 0.9], 2.4, 1.4, dark));
  for (const [i, y, wide] of [[0, d.axleF, false], [1, d.axleR, true]]) lathes.push(spin(`axle_${i}`, [-tw / 2 + 0.4, y, r], [tw / 2 - 0.4, y, r], [[0, 0.3], [0.4, wide ? 0.55 : 0.35], [0.6, wide ? 0.55 : 0.35], [1, 0.3]], tone(dark, 0.1), 18));
  // the stairs up the front to the deck, the rails along it
  lofts.push(loftWorld('stairs', [-d.deckW / 2 + 0.6, d.nose + 0.3, 0.3], [d.deckW / 2 - 1.2, d.nose + 0.3, d.deck], [{ t: 0, points: roundRect([1, 0, 1.6], 0.6, 0.06, 0.01, 1) }, { t: 1, points: roundRect([1, 0, 1.6], 0.6, 0.06, 0.01, 1) }], dark));
  for (const s of [1, -1]) lathes.push(spin(`rail_post_${side(s)}`, [s * (d.deckW / 2 - 0.05), d.nose + 0.1, d.deck], [s * (d.deckW / 2 - 0.05), d.nose + 0.1, d.deck + 1.0], [[0, 0.025], [1, 0.025]], C.light, 8));
  extrudes.push(box('rail_top', [-d.deckW / 2, d.nose + 0.1, d.deck + 1.0], [d.deckW / 2, d.nose + 0.1, d.deck + 1.0], 0.05, 0.05, C.light));
  const H = d.hoist;
  for (const s of [1, -1]) lathes.push(boss(`hoist_pin_${side(s)}`, [s * H[0], H[1], H[2]], s * (H[0] - 0.12), s * (H[0] + 0.12), 0.1, tone(dark, 0.2)));
  lathes.push(boss('tip_pin', d.tip, -0.75, 0.75, 0.12, tone(dark, 0.2)));
  return { extrudes, lathes, lofts, hardpoints: { tip: d.tip, cab: d.cab, 'hoistRam.r': H, 'hoistRam.l': [-H[0], H[1], H[2]], ...wheelPoints([{ y: d.axleF }, { y: d.axleR, twin: true }], tw, r, d.twin) } };
}

// ── a mixer's drum: its shell turned about its own axis, the spiral painted round it ─────────────────────────────
export function mixerDrum(row, C) {
  const d = row.dims, a = unit(d.axis), L = d.length, lathes = [], sweeps = [];
  const at = (t) => [a[0] * L * t, a[1] * L * t, a[2] * L * t];
  lathes.push(spin('drum', at(0), at(1), d.profile, C.paint, 28));
  // (the stripes wound round it: what a turn of the drum is seen by)
  const u = unit(Math.abs(a[0]) < 0.9 ? [a[1] * 0 - a[2] * 0, a[2], -a[1]] : [0, 1, 0]), v = [a[1] * u[2] - a[2] * u[1], a[2] * u[0] - a[0] * u[2], a[0] * u[1] - a[1] * u[0]];
  const rAt = (t) => { const p = d.profile; for (let i = 1; i < p.length; i++) if (t <= p[i][0]) { const f = (t - p[i - 1][0]) / (p[i][0] - p[i - 1][0]); return p[i - 1][1] + (p[i][1] - p[i - 1][1]) * f; } return p[p.length - 1][1]; };
  for (const [k, ph] of [[0, 0], [1, Math.PI]]) {
    const pts = Array.from({ length: 41 }, (_, i) => { const t = 0.08 + (0.84 * i) / 40, th = ph + 2 * Math.PI * 1.5 * t, r = rAt(t) + 0.012, c = at(t); return [c[0] + r * (Math.cos(th) * u[0] + Math.sin(th) * v[0]), c[1] + r * (Math.cos(th) * u[1] + Math.sin(th) * v[1]), c[2] + r * (Math.cos(th) * u[2] + Math.sin(th) * v[2])]; });
    sweeps.push(tube(`stripe_${k}`, pts, 0.05, C.light, 6));
  }
  return { lathes, sweeps, hardpoints: { front: [0, 0, 0], mouth: at(1) } };
}

export { sub };
