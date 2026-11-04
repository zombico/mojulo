/**
 * con-lifters — the builders of the machines that lift: an all-terrain crane's carrier (its frame on five axles, its
 * outrigger boxes, its slewing seat), its superstructure (its side frames and the boom's foot, its winch, its engine),
 * its counterweight's slabs, its outriggers' beams and jacks; a hook block and its rope; and a tower crane: its cross
 * base and its ballast, its mast's lattice sections, its slewing unit, its tower head and its pendants, its jib, its
 * counter-jib and its ballast slabs, its trolley. Each drawn in its body's frame (con-parts.js says the contract).
 *
 * A lattice is chords and bracing drawn as tubes: a mast section's four chords and the zigzag on each face, a jib's
 * triangle of two bottom chords (the trolley's rails) and a top chord, braced panel by panel. Pure: no clock, no dice.
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
const concrete = (C) => tone(C.light, -0.28);

// ── an all-terrain crane's carrier: its frame, its decks over the wheels, its outrigger boxes, its axles, its slewing
// seat, its steps and its lamps ───────────────────────────────────────────────────────────────────────────────────
export function craneCarrier(row, C, { physics }) {
  const d = row.dims, extrudes = [], lathes = [], body = C.paint, dark = C.trim, tw = physics.track, r = physics.wheelRadius;
  const [rear, front] = d.length, W = d.w;
  // the box frame along the middle, the decks over the wheels each side, the front's nose under the cab
  extrudes.push(box('frame', [0, rear + 0.2, d.frameZ], [0, front - 0.3, d.frameZ], 1.1, 0.6, dark));
  for (const s of [1, -1]) {
    extrudes.push(panel(`deck_${side(s)}`, s * 0.5, s * W / 2, [[rear, d.deckZ - 0.3], [front - 2.3, d.deckZ - 0.3], [front - 2.3, d.deckZ], [rear, d.deckZ]], body));
    // (the wheel arches' skirts, a dark band along the deck's edge)
    extrudes.push(panel(`skirt_${side(s)}`, s * (W / 2 - 0.01), s * (W / 2 + 0.01), [[rear, d.deckZ - 0.42], [front - 0.2, d.deckZ - 0.42], [front - 0.2, d.deckZ - 0.3], [rear, d.deckZ - 0.3]], dark));
  }
  extrudes.push(plan('nose', d.frameZ - 0.2, d.deckZ - 0.1, rect(-W / 2 + 0.05, W / 2 - 0.05, front - 2.3, front), body));
  // the outrigger boxes across the frame, ahead of the middle axles and behind the last
  for (const [k, y] of [['f', d.outF], ['r', d.outR]]) extrudes.push(box(`outbox_${k}`, [-W / 2 + 0.02, y, d.outZ], [W / 2 - 0.02, y, d.outZ], 1.0, 0.5, tone(body, -0.08), [0, 0, 1]));
  d.axles.forEach((y, i) => lathes.push(spin(`axle_${i}`, [-tw / 2 + 0.25, y, r], [tw / 2 - 0.25, y, r], [[0, 0.11], [0.4, 0.16], [0.6, 0.16], [1, 0.11]], tone(dark, 0.1), 16)));
  // the slewing seat on the frame, the bumper and the tail's lamps, the steps up to the deck
  lathes.push(spin('seat', [d.slew[0], d.slew[1], d.deckZ - 0.3], [d.slew[0], d.slew[1], d.slew[2]], [[0, 1.05], [1, 1.0]], dark, 28));
  extrudes.push(box('bumper', [-W / 2 + 0.1, rear - 0.05, 0.7], [W / 2 - 0.1, rear - 0.05, 0.7], 0.12, 0.28, dark));
  for (const s of [1, -1]) extrudes.push(box(`lamp_${side(s)}`, [s * (W / 2 - 0.3), rear - 0.08, 0.95], [s * (W / 2 - 0.3), rear - 0.12, 0.95], 0.4, 0.12, '#b8322a'));
  for (const s of [1, -1]) for (const z of [0.55, 0.95]) extrudes.push(box(`step_${side(s)}_${z}`, [s * (W / 2 - 0.12), d.outR + 0.75, z], [s * (W / 2 - 0.12), d.outR + 1.15, z], 0.24, 0.04, tone(C.chrome, -0.2)));
  const hp = { cab: d.cab, slew: d.slew };
  d.axles.forEach((y, i) => { hp[`axle${i}.r`] = [tw / 2, y, r]; hp[`axle${i}.l`] = [-tw / 2, y, r]; });
  // (each outrigger beam's root, the right's and the left's a beam's width apart along the box)
  for (const [k, y] of [['F', d.outF], ['R', d.outR]]) { hp[`out${k}.r`] = [-d.beamRoot, y + 0.2, d.outZ]; hp[`out${k}.l`] = [d.beamRoot, y - 0.2, d.outZ]; }
  return { extrudes, lathes, hardpoints: hp };
}

// ── an all-terrain crane's superstructure: its deck, the side frames that carry the boom's foot, the winch between
// them, the engine's housing on the right, the luffing ram's seat ─────────────────────────────────────────────
export function craneHouse(row, C) {
  const d = row.dims, w = d.w, extrudes = [], lathes = [], body = C.paint, dark = C.trim, F = d.foot;
  extrudes.push(plan('deck', 0, d.deck, rect(-w / 2, w / 2, d.back, d.front), dark));
  // the side frames: plates from the deck up to the boom's foot pin, each a wedge
  for (const s of [1, -1]) {
    const x = s * d.frames;
    extrudes.push(panel(`frame_${side(s)}`, x - 0.04, x + 0.04, [[d.back + 0.2, d.deck], [d.ramBase[1] + 0.5, d.deck], [F[1] + 0.6, F[2] + 0.2], [F[1] - 0.45, F[2] + 0.2], [d.back + 0.2, d.deck + 0.9]], body));
    lathes.push(boss(`foot_${side(s)}`, F, x - 0.09, x + 0.09, 0.16, tone(dark, 0.2)));
  }
  lathes.push(boss('foot_pin', F, -d.frames - 0.1, d.frames + 0.1, 0.08, C.chrome));
  // the hoist winch between the frames, its drum dark, its flanges paint
  lathes.push(spin('winch', [-d.frames + 0.08, d.winch[1], d.winch[2]], [d.frames - 0.08, d.winch[1], d.winch[2]], [[0, 0.38], [0.04, 0.38], [0.05, 0.28], [0.95, 0.28], [0.96, 0.38], [1, 0.38]], dark, 22));
  // the engine's housing on the right, its grille, the tank on the left behind the cab
  extrudes.push(plan('engine', d.deck, d.deck + 1.25, rect(d.frames + 0.12, w / 2, d.back + 0.1, d.front - 0.4), body));
  extrudes.push(panel('grille', w / 2, w / 2 + 0.01, [[d.back + 0.6, d.deck + 0.3], [d.back + 1.8, d.deck + 0.3], [d.back + 1.8, d.deck + 1.0], [d.back + 0.6, d.deck + 1.0]], dark));
  extrudes.push(plan('tank', d.deck, d.deck + 0.8, rect(-w / 2, -d.frames - 0.12, d.back + 0.1, d.back + 1.6), tone(body, -0.05)));
  // the luffing ram's seat between the frames, low at the front
  extrudes.push(box('ram_seat', [0, d.ramBase[1], d.deck], [0, d.ramBase[1], d.ramBase[2]], 0.7, 0.5, dark, [0, 1, 0]));
  lathes.push(boss('ram_pin', d.ramBase, -0.3, 0.3, 0.1, tone(dark, 0.2)));
  return { extrudes, lathes, hardpoints: { foot: F, ramBase: d.ramBase, cab: d.cab, cw: d.cw } };
}

// ── a counterweight of slabs: a crane's stacked behind its superstructure, a tower crane's hung at its counter-jib's
// end ────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function counterSlabs(row, C) {
  const d = row.dims, extrudes = [], n = d.n, t = d.depth / n, tint = d.hang ? concrete(C) : C.paint;
  for (let k = 0; k < n; k++) {
    const y0 = -k * t - 0.01, y1 = -(k + 1) * t + 0.01;
    extrudes.push(plan(`slab_${k}`, d.hang ? -d.h + 0.2 : 0, d.hang ? 0.2 : d.h, rect(-d.w / 2, d.w / 2, y1, y0), k % 2 ? tone(tint, -0.05) : tint));
  }
  // (a hung slab's lifting eyes on the beams; a stack's dark band)
  if (!d.hang) extrudes.push(plan('band', d.h * 0.55, d.h * 0.62, rect(-d.w / 2 - 0.005, d.w / 2 + 0.005, -d.depth - 0.005, 0.005), C.trim));
  return { extrudes, hardpoints: { mount: [0, 0, 0] } };
}

// ── an outrigger: its beam sliding out of its box (its jack's housing at its tip), and its jack's leg and float ─────
export function outriggerBeam(row, C) {
  const d = row.dims, extrudes = [], lathes = [];
  extrudes.push(box('beam', [0, 0, 0], [d.length, 0, 0], d.w, d.h, C.paint, [0, 0, 1]));
  extrudes.push(box('stripe', [d.length - 0.6, 0, 0], [d.length - 0.3, 0, 0], d.w + 0.01, d.h + 0.01, '#c43a2a', [0, 0, 1]));
  lathes.push(spin('housing', [d.length - 0.15, 0, -d.h / 2 - 0.05], [d.length - 0.15, 0, d.h / 2 + 0.25], [[0, 0.15], [1, 0.15]], tone(C.trim, 0.1), 16));
  return { extrudes, lathes, hardpoints: { tip: [d.length - 0.15, 0, -d.h / 2 - 0.05] } };
}
export function outriggerJack(row, C) {
  const d = row.dims, lathes = [], z = -d.leg;
  lathes.push(spin('leg', [0, 0, 0.6], [0, 0, z], [[0, 0.11], [1, 0.11]], C.chrome, 14));
  lathes.push(spin('ball', [0, 0, z], [0, 0, z - 0.06], [[0, 0.12], [1, 0.09]], tone(C.trim, 0.2), 12));
  lathes.push(spin('float', [0, 0, z - 0.06], [0, 0, z - 0.14], [[0, d.pad], [1, d.pad]], C.trim, 24));
  const outline = Array.from({ length: 8 }, (_, k) => [d.pad * Math.cos((k * Math.PI) / 4), d.pad * Math.sin((k * Math.PI) / 4), z - 0.14]);
  return { lathes, hardpoints: { pad: [0, 0, z - 0.14] }, outline };
}

// ── a hook block: its sheaves between its cheek plates, its swivel and its hook; hung from its top ─────────────────
export function hookBlock(row, C) {
  const d = row.dims, extrudes = [], lathes = [], sweeps = [], hookZ = -d.h - d.hook;
  extrudes.push(box('cheeks', [0, 0, -0.08], [0, 0, -d.h], d.w, d.t, C.paint, [0, 1, 0]));
  extrudes.push(box('stripe', [0, 0, -d.h * 0.55], [0, 0, -d.h * 0.75], d.w + 0.01, d.t + 0.01, '#202020', [0, 1, 0]));
  for (let k = 0; k < d.sheaves; k++) {
    const x = -d.w / 2 + 0.1 + ((d.w - 0.2) * (k + 0.5)) / d.sheaves;
    lathes.push(spin(`sheave_${k}`, [x - 0.03, 0, -d.h * 0.35], [x + 0.03, 0, -d.h * 0.35], [[0, d.t * 0.62], [1, d.t * 0.62]], tone(C.trim, 0.2), 18));
  }
  lathes.push(spin('swivel', [0, 0, -d.h], [0, 0, -d.h - d.hook * 0.3], [[0, 0.12], [1, 0.08]], tone(C.trim, 0.15), 14));
  // the hook: its shank down, its bowl curled forward and up to its point, its latch across its mouth
  const k = d.hook, z0 = -d.h - k * 0.3;
  sweeps.push(tube('hook', [[0, 0, z0], [0, 0, z0 - k * 0.35], [0, 0.06, z0 - k * 0.6], [0, k * 0.22, z0 - k * 0.72], [0, k * 0.38, z0 - k * 0.6], [0, k * 0.4, z0 - k * 0.42]], 0.035 + k * 0.03, tone(C.chrome, -0.2), 10));
  sweeps.push(tube('latch', [[0, 0.04, z0 - k * 0.32], [0, k * 0.38, z0 - k * 0.4]], 0.012, C.light, 6));
  const outline = [[-d.w / 2, -d.t / 2, -d.h], [d.w / 2, -d.t / 2, -d.h], [d.w / 2, d.t / 2, -d.h], [-d.w / 2, d.t / 2, -d.h], [0, k * 0.22, hookZ + k * 0.28]];
  return { extrudes, lathes, sweeps, hardpoints: { top: [0, 0, 0], hook: [0, k * 0.2, z0 - k * 0.66] }, outline };
}
/** One length of a rope's falls, along +y from 0: the parallel lines its block is reeved with. */
export function ropeFalls(row, C) {
  const d = row.dims;
  return { sweeps: d.falls.map((x, k) => tube(`fall_${k}`, [[x, 0, 0], [x, d.length, 0]], d.r, tone(C.trim, 0.25), 6)), hardpoints: { end: [0, 0, 0] } };
}

// ── a tower crane's cross base: its two crossed beams on their pads, its foot, its ballast blocks on its arms ───────
export function towerBase(row, C) {
  const d = row.dims, extrudes = [], body = C.paint, dark = C.trim, a = d.arm, b = d.beam;
  for (const [k, dir] of [['x', [1, 0, 0]], ['y', [0, 1, 0]]]) {
    extrudes.push(box(`beam_${k}`, [-dir[0] * a, -dir[1] * a, b.h / 2], [dir[0] * a, dir[1] * a, b.h / 2], b.w, b.h, body, [0, 0, 1]));
    for (const s of [1, -1]) extrudes.push(plan(`pad_${k}${side(s)}`, 0, 0.08, rect(s * dir[0] * a - 0.5, s * dir[0] * a + 0.5, s * dir[1] * a - 0.5, s * dir[1] * a + 0.5), dark));
  }
  extrudes.push(plan('foot', b.h, d.top, rect(-d.foot / 2, d.foot / 2, -d.foot / 2, d.foot / 2), tone(body, -0.06)));
  // (the ballast blocks stacked on each arm, out toward its end)
  const blk = d.block, tint = concrete(C);
  for (const [ux, uy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let k = 0; k < blk.n; k++) {
    const cx = ux * blk.at, cy = uy * blk.at, hx = ux ? blk.d / 2 : blk.w / 2, hy = ux ? blk.w / 2 : blk.d / 2;
    extrudes.push(plan(`block_${ux}${uy}_${k}`, b.h + k * blk.h + 0.01, b.h + (k + 1) * blk.h, rect(cx - hx, cx + hx, cy - hy, cy + hy), k % 2 ? tone(tint, -0.04) : tint));
  }
  return { extrudes, hardpoints: { top: [0, 0, d.top] } };
}

// ── a mast section: four chords, a frame at each end, the zigzag on each face, the ladder inside ─────────────────
export function mastSection(row, C) {
  const d = row.dims, a = d.a / 2 - d.chord / 2, L = d.length, extrudes = [], sweeps = [], body = C.paint, r = d.brace;
  const corners = [[a, a], [-a, a], [-a, -a], [a, -a]];
  corners.forEach(([x, y], k) => extrudes.push(box(`chord_${k}`, [x, y, 0], [x, y, L], d.chord, d.chord, body, [0, 1, 0])));
  for (let f = 0; f < 4; f++) {
    const [p, q] = [corners[f], corners[(f + 1) % 4]], n = d.panels, h = L / n;
    for (const z of [0.12, L - 0.12]) sweeps.push(tube(`ring_${f}_${z > 1 ? 't' : 'b'}`, [[p[0], p[1], z], [q[0], q[1], z]], r, body, 6));
    for (let k = 0; k < n; k++) {
      const [u, v] = k % 2 ? [q, p] : [p, q];
      sweeps.push(tube(`diag_${f}_${k}`, [[u[0], u[1], k * h + 0.12], [v[0], v[1], (k + 1) * h - 0.12]], r, body, 6));
    }
  }
  // the ladder up one face, inside
  for (const s of [1, -1]) sweeps.push(tube(`stile_${side(s)}`, [[s * 0.22, a - 0.2, 0], [s * 0.22, a - 0.2, L]], 0.02, tone(body, -0.1), 6));
  for (let k = 0; k < Math.floor(L / 0.3); k++) sweeps.push(tube(`rung_${k}`, [[-0.22, a - 0.2, 0.15 + k * 0.3], [0.22, a - 0.2, 0.15 + k * 0.3]], 0.012, tone(body, -0.1), 4));
  return { extrudes, sweeps, hardpoints: { top: [0, 0, L] } };
}

// ── a tower crane's slewing unit: the bearing's seat on the mast, the ring, the turntable, its motors, the jib's and
// the counter-jib's pins, the platform round it ──────────────────────────────────────────────────────────────────
export function slewingUnit(row, C) {
  const d = row.dims, extrudes = [], lathes = [], body = C.paint, dark = C.trim, s = d.a / 2;
  extrudes.push(plan('seat', 0, 0.3, rect(-s, s, -s, s), body));
  lathes.push(spin('ring', [0, 0, 0.3], [0, 0, 0.5], [[0, d.ring], [0.5, d.ring + 0.03], [1, d.ring]], tone(dark, 0.2), 32));
  extrudes.push(plan('table', 0.5, d.top, rect(-s - 0.2, s + 0.2, -s - 0.4, s + 0.4), body));
  for (const k of [1, -1]) lathes.push(spin(`motor_${side(k)}`, [k * (s - 0.2), -s - 0.1, 0.55], [k * (s - 0.2), -s - 0.1, 1.2], [[0, 0.16], [1, 0.16]], dark, 14));
  // (the platform round the turntable, its handrail)
  extrudes.push(plan('platform', 0.45, 0.5, rect(-s - 0.9, s + 0.9, -s - 0.9, s + 0.9), tone(dark, 0.15)));
  for (const k of [1, -1]) {
    extrudes.push(panel(`lug_j_${side(k)}`, k * (s - 0.05), k * (s + 0.05), [[d.jib[1] - 0.5, d.top - 0.1], [d.jib[1] + 0.2, d.top - 0.1], [d.jib[1] + 0.2, d.jib[2] + 0.25], [d.jib[1] - 0.5, d.jib[2] + 0.25]], body));
    extrudes.push(panel(`lug_c_${side(k)}`, k * (s - 0.05), k * (s + 0.05), [[d.counter[1] + 0.5, d.top - 0.1], [d.counter[1] - 0.2, d.top - 0.1], [d.counter[1] - 0.2, d.counter[2] + 0.25], [d.counter[1] + 0.5, d.counter[2] + 0.25]], body));
  }
  return { extrudes, lathes, hardpoints: { apex: d.apex, jib: d.jib, counter: d.counter, cab: d.cab } };
}

// ── a tower head: the A-frame over the turntable, its apex, and the pendants that hang the jib and the counter-jib
// from it (their far ends where the jib's ties are as built) ────────────────────────────────────────────────────
export function towerHead(row, C) {
  const d = row.dims, sweeps = [], extrudes = [], lathes = [], body = C.paint, s = d.a / 2 - 0.1, H = d.h;
  const legs = [[s, s], [-s, s], [-s, -s], [s, -s]];
  legs.forEach(([x, y], k) => sweeps.push(tube(`leg_${k}`, [[x, y, 0], [x * 0.15, y * 0.15, H]], d.leg, body, 8)));
  for (const z of [H * 0.35, H * 0.65]) {
    const k = 1 - (z / H) * 0.85;
    legs.forEach(([x, y], i) => { const [u, v] = legs[(i + 1) % 4]; sweeps.push(tube(`tie_${i}_${Math.round(z * 10)}`, [[x * k, y * k, z], [u * k, v * k, z]], d.leg * 0.45, body, 6)); });
  }
  extrudes.push(plan('cap', H - 0.05, H + 0.25, rect(-0.35, 0.35, -0.35, 0.35), body));
  lathes.push(spin('apex_pin', [-0.4, 0, H + 0.1], [0.4, 0, H + 0.1], [[0, 0.08], [1, 0.08]], C.chrome, 12));
  // the pendants: a pair of bars from the apex to each tie
  d.ties.forEach((t, k) => { for (const x of [0.07, -0.07]) sweeps.push(tube(`pendant_${k}_${x > 0 ? 'r' : 'l'}`, [[x, 0, H + 0.1], [x, t[1], t[2]]], d.bar, tone(C.trim, 0.3), 6)); });
  return { sweeps, extrudes, lathes, hardpoints: { apex: [0, 0, H] } };
}

// ── a tower crane's jib: a triangle of two bottom chords (the trolley's rails) and a top chord, braced panel by panel;
// its root's pins, its tip's frame; a walkway along its middle ─────────────────────────────────────────────────
export function jibLattice(row, C) {
  const d = row.dims, sweeps = [], extrudes = [], body = C.paint, L = d.length, b = d.base / 2, H = d.height, n = Math.round(L / d.panel), p = L / n, r = d.brace;
  for (const s of [1, -1]) extrudes.push(box(`rail_${side(s)}`, [s * b, 0, 0], [s * b, L, 0], d.chord, d.chord, body));
  sweeps.push(tube('top', [[0, 0.3, H], [0, L - 0.4, H]], d.chord * 0.55, body, 8));
  for (let k = 0; k < n; k++) {
    const y0 = k * p, y1 = (k + 1) * p, zig = k % 2;
    // (each side face: bottom chord to top chord and back; the bottom face: rail to rail)
    for (const s of [1, -1]) sweeps.push(tube(`side_${side(s)}_${k}`, zig ? [[0, y0, H], [s * b, y1, 0]] : [[s * b, y0, 0], [0, y1, H]], r, body, 6));
    sweeps.push(tube(`floor_${k}`, zig ? [[b, y0, 0], [-b, y1, 0]] : [[-b, y0, 0], [b, y1, 0]], r * 0.8, body, 6));
  }
  // the end frames: the root's triangle over its pins, the tip's
  for (const [k, y] of [['root', 0.05], ['tip', L - 0.05]]) {
    sweeps.push(tube(`${k}_frame`, [[-b, y, 0], [0, y, H], [b, y, 0], [-b, y, 0]], r * 1.4, body, 6));
  }
  // the walkway's grating between the rails at the root half, its handrail
  extrudes.push(plan('walkway', 0.02, 0.05, rect(-b + 0.15, b - 0.15, 0.4, L * 0.55), tone(C.trim, 0.25)));
  return { sweeps, extrudes, hardpoints: { root: [0, d.run[0], 0], tip: [0, L, 0], ...Object.fromEntries(d.ties.map((t, k) => [`tie${k}`, t])) } };
}

// ── a counter-jib: two side beams and their cross members, its walkway and its rails, its hoist winch and its
// cabinet; its ballast hung at its end ───────────────────────────────────────────────────────────────────────────
export function counterJib(row, C) {
  const d = row.dims, extrudes = [], lathes = [], sweeps = [], body = C.paint, dark = C.trim, L = d.length, b = d.w / 2;
  for (const s of [1, -1]) extrudes.push(box(`beam_${side(s)}`, [s * b, 0, 0], [s * b, -L, 0], 0.22, 0.36, body));
  for (let k = 0; k <= 8; k++) { const y = -0.2 - ((L - 0.4) * k) / 8; extrudes.push(box(`cross_${k}`, [-b, y, 0.05], [b, y, 0.05], 0.12, 0.2, body, [0, 0, 1])); }
  extrudes.push(plan('walkway', 0.18, 0.21, rect(-b + 0.12, b - 0.12, -L + 0.3, -0.3), tone(dark, 0.25)));
  for (const s of [1, -1]) sweeps.push(tube(`rail_${side(s)}`, [[s * (b + 0.05), -0.3, 1.2], [s * (b + 0.05), -L + 0.3, 1.2]], 0.025, tone(body, -0.1), 6));
  for (const s of [1, -1]) for (let k = 0; k <= 4; k++) { const y = -0.3 - ((L - 0.6) * k) / 4; sweeps.push(tube(`post_${side(s)}_${k}`, [[s * (b + 0.05), y, 0.2], [s * (b + 0.05), y, 1.2]], 0.02, tone(body, -0.1), 4)); }
  // the hoist winch: its drum, its motor, its gearbox; the cabinet beside it
  const w = d.winch;
  lathes.push(spin('drum', [-0.55, w[1], w[2]], [0.45, w[1], w[2]], [[0, 0.42], [0.05, 0.42], [0.06, 0.32], [0.94, 0.32], [0.95, 0.42], [1, 0.42]], dark, 22));
  extrudes.push(plan('motor', 0.21, 0.95, rect(0.5, b - 0.15, w[1] - 0.45, w[1] + 0.35), tone(body, -0.1)));
  extrudes.push(plan('cabinet', 0.21, 1.55, rect(-b + 0.15, -0.65, d.cabinet - 0.4, d.cabinet + 0.4), C.light));
  return { extrudes, lathes, sweeps, hardpoints: { ballast: d.ballast, tie: d.tie } };
}

// ── a trolley: its frame under the rails, its wheels on them, its sheaves under it ──────────────────────────────
export function trolley(row, C) {
  const d = row.dims, extrudes = [], lathes = [], body = C.paint, b = d.rail;
  for (const s of [1, -1]) {
    extrudes.push(panel(`plate_${side(s)}`, s * (b + 0.1), s * (b + 0.14), [[-d.l / 2, 0.2], [d.l / 2, 0.2], [d.l / 2 - 0.15, -d.h], [-d.l / 2 + 0.15, -d.h]], body));
    for (const y of [-d.l / 2 + 0.25, d.l / 2 - 0.25]) lathes.push(spin(`wheel_${side(s)}_${y > 0 ? 'f' : 'r'}`, [s * (b + 0.02), y, 0.17], [s * (b + 0.1), y, 0.17], [[0, 0.1], [1, 0.1]], tone(C.trim, 0.2), 14));
  }
  extrudes.push(plan('cross', -d.h, -d.h + 0.15, rect(-b - 0.14, b + 0.14, -d.l / 2 + 0.15, d.l / 2 - 0.15), body));
  for (const x of [-0.18, 0.18]) lathes.push(spin(`sheave_${x > 0 ? 'r' : 'l'}`, [x - 0.03, 0, -d.h - 0.05], [x + 0.03, 0, -d.h - 0.05], [[0, 0.2], [1, 0.2]], tone(C.trim, 0.25), 16));
  return { extrudes, lathes, hardpoints: { sheave: [0, 0, -d.h - 0.25] } };
}
