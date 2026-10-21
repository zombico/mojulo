// plating/layouts — FITTED-SHELL LAYOUTS: how a segment's shell is cut (shell.js), panel by panel, in the segment's design
// coordinates (`t` 0 … 1 down it: the shank from the knee to the ankle, the foot from over the ankle to past the toe base,
// the toes to their tips; `s` −1 … 1 round it: 0 its front line, + its lateral side, ±1 its back). The lines are a
// supercar's: lines that run STRAIGHT and JOG (shell.js `stepped`: | |, \ \, | |, / /), sharing their jogs so the panels
// either side fit along them; chevrons narrowing down the front; an underplate showing through the windows the overplates
// leave.
//
// A panel: { id, seg (a segment, or 'fingers': the four), layer: under | mid | over | cap | light | joint, t: [t0, t1], left: [[t, s], …], right: [[t, s], …],
//            mirror? (a copy on the other side: s negated), dome? (m), lift? (m, over the layer's: a light set on a cap),
//            circle? { t, s, r (m) } (a round panel, a servo's, in place of t, left and right; its shape in metres),
//            s past ±1 (a line through the back, carrying on round to the other side),
//            role? (its colour's role over the layer's) }
// LAYERS set each layer's height off the shell, its depth and its bevel (a card's `bulk` scales the heights).
export const LAYERS = Object.freeze({
  under: Object.freeze({ lift: 0.005, thick: 0.003, bevel: 0.0015, role: 'Alloy' }),
  mid: Object.freeze({ lift: 0.0075, thick: 0.003, bevel: 0.002, role: 'Trim' }),
  over: Object.freeze({ lift: 0.0105, thick: 0.004, bevel: 0.003, role: 'Plate' }),
  cap: Object.freeze({ lift: 0.0135, thick: 0.004, bevel: 0.003, role: 'Plate' }),
  light: Object.freeze({ lift: 0.012, thick: 0.002, bevel: 0.0005, role: 'Light' }),
  joint: Object.freeze({ lift: 0.0065, thick: 0.003, bevel: 0.0015, role: 'Joint' }),
});

import { stepped } from './shell.js';

const line = (s, t0 = 0, t1 = 1) => [[t0, s], [t1, s]];
/** a pair of jogs a whole layout shares (a seam that steps out, runs on, steps back), so its neighbours fit along it */
const J = { a: [0.3, 0.36], b: [0.58, 0.64] };

const BASE = {
  // the GREAVE: an underplate all round to a back seam; a shin plate narrowing down the front in a chevron; side plates
  // sweeping forward to the ankle, a window of underplate between them and the shin plate with a trim strip in it; calf
  // plates a layer higher, overlapping the sides; a cuff over the ankle; vents
  greave: [
    { id: 'Under', seg: 'shank', layer: 'under', t: [0.03, 0.97], left: line(-0.995), right: line(0.995) },
    // the shin plate: straight down, a jog in, straight, a jog in, then narrowing to the ankle
    { id: 'Shin', seg: 'shank', layer: 'over', t: [0.15, 0.86], left: stepped(-0.32, [[...J.a, 0.1], [...J.b, 0.08], [0.78, 0.86, 0.08]], 0.15, 0.86), right: stepped(0.32, [[...J.a, -0.1], [...J.b, -0.08], [0.78, 0.86, -0.08]], 0.15, 0.86) },
    // the trim strip: two parallel lines jogging together (| |, \ \, | |, / /)
    { id: 'Strip', seg: 'shank', layer: 'mid', mirror: true, t: [0.18, 0.84], left: stepped(0.37, [[...J.a, -0.12], [...J.b, 0.12], [0.76, 0.84, -0.14]], 0.18, 0.84), right: stepped(0.43, [[...J.a, -0.12], [...J.b, 0.12], [0.76, 0.84, -0.14]], 0.18, 0.84) },
    // the side plate, its front edge stepping with the strip's, its back edge straight then jogging back under the calf
    { id: 'Side', seg: 'shank', layer: 'over', mirror: true, t: [0.08, 0.86], left: stepped(0.48, [[...J.a, -0.12], [...J.b, 0.12], [0.76, 0.84, -0.14]], 0.08, 0.86), right: stepped(0.78, [[0.44, 0.5, 0.06], [0.66, 0.72, 0.08]], 0.08, 0.86) },
    // the calf plate, a layer up: its front edge straight, a jog in, straight, a jog back out
    { id: 'Calf', seg: 'shank', layer: 'cap', mirror: true, t: [0.1, 0.74], left: stepped(0.7, [[0.36, 0.42, -0.1], [0.62, 0.68, 0.16]], 0.1, 0.74), right: line(0.99, 0.1, 0.74) },
    // the cuff over the ankle: its top edge stepping down at the sides
    { id: 'Cuff', seg: 'shank', layer: 'over', t: [0.86, 0.98], left: line(-0.99, 0.86, 0.98), right: line(0.99, 0.86, 0.98) },
    { id: 'Vent', seg: 'shank', layer: 'light', lift: 0.016, mirror: true, t: [0.13, 0.17], left: line(0.82), right: line(0.92) },
  ],
  // the JOINTS: two narrow bands round each joint, articulated (the lames a joint bends under), where the suit is not plated:
  // the shoulder under the deltoid, the elbow, the wrist, the waist, the hip and the groin, the back of the knee
  joints: [
    ...[['upperArm', [[0.02, 0.09], [0.11, 0.18]]], ['upperArm', [[0.85, 0.915], [0.935, 0.995]]], ['foreArm', [[0.01, 0.07], [0.09, 0.15]]], ['foreArm', [[0.88, 0.935], [0.95, 0.995]]],
      ['torso', [[0.005, 0.05], [0.065, 0.11]]], ['pelvis', [[0.9, 0.945], [0.955, 0.995]]], ['pelvis', [[0.01, 0.08], [0.1, 0.17]]],
      ['thigh', [[0.01, 0.06], [0.075, 0.125]]], ['thigh', [[0.86, 0.915], [0.935, 0.995]]]]
      .flatMap(([seg, bands], k) => bands.map((t, i) => ({ id: `${seg[0].toUpperCase()}${seg.slice(1)}${k}${i}`, seg, layer: 'joint', t, left: line(-0.995), right: line(0.995) }))),
  ],
  // the SPINE: a dark channel down the back, a column of vertebrae on it (each a little wider at its top), a sacrum plate
  // ending in a chevron on the pelvis. Its lines run through the back (s past 1 carries on round to the other side)
  spine: [
    { id: 'Channel', seg: 'torso', layer: 'mid', role: 'Joint', t: [0.08, 0.95], left: line(0.9), right: line(1.1) },
    ...Array.from({ length: 9 }, (_, i) => { const t0 = 0.11 + i * 0.092, t1 = t0 + 0.07;
      return { id: `Vertebra${i}`, seg: 'torso', layer: 'cap', role: 'Alloy', t: [t0, t1], left: [[t0, 0.935], [t1, 0.92]], right: [[t0, 1.065], [t1, 1.08]] }; }),
    { id: 'Sacrum', seg: 'pelvis', layer: 'cap', role: 'Alloy', t: [0.5, 0.94], left: [[0.5, 0.97], [0.72, 0.9], [0.94, 0.9]], right: [[0.5, 1.03], [0.72, 1.1], [0.94, 1.1]] },
  ],
  // the LUMBAR plates either side of the spine over the small of the back, stepped, a layer over the lats
  lumbar: [
    { id: 'Plate', seg: 'torso', layer: 'cap', mirror: true, t: [0.1, 0.44], left: stepped(0.6, [[0.24, 0.29, 0.06]], 0.1, 0.44), right: stepped(0.86, [[0.3, 0.35, -0.03]], 0.1, 0.44) },
    { id: 'Kidney', seg: 'torso', layer: 'over', mirror: true, t: [0.12, 0.3], left: line(0.44, 0.12, 0.3), right: line(0.57, 0.12, 0.3), role: 'Trim' },
  ],
  // the HIPS (the pelvis by design, where its muscles interleave too finely to cut by): an underplate, seat plates and hip
  // plates stepped, a codpiece and a low-abdominal plate at the front
  hips: [
    { id: 'Under', seg: 'pelvis', layer: 'under', t: [0.03, 0.97], left: line(-0.995), right: line(0.995) },
    { id: 'Seat', seg: 'pelvis', layer: 'over', mirror: true, t: [0.22, 0.86], left: stepped(0.6, [[0.5, 0.56, -0.05]], 0.22, 0.86), right: stepped(0.86, [[0.4, 0.46, 0.02]], 0.22, 0.86) },
    { id: 'Side', seg: 'pelvis', layer: 'over', mirror: true, t: [0.3, 0.9], left: stepped(0.28, [[0.55, 0.61, 0.05]], 0.3, 0.9), right: stepped(0.54, [[0.62, 0.68, -0.05]], 0.3, 0.9) },
    { id: 'Codpiece', seg: 'pelvis', layer: 'cap', t: [0.04, 0.44], left: [[0.04, -0.12], [0.3, -0.2], [0.44, -0.2]], right: [[0.04, 0.12], [0.3, 0.2], [0.44, 0.2]] },
    { id: 'LowAbs', seg: 'pelvis', layer: 'over', role: 'Trim', t: [0.52, 0.92], left: stepped(-0.2, [[0.7, 0.76, -0.04]], 0.52, 0.92), right: stepped(0.2, [[0.7, 0.76, 0.04]], 0.52, 0.92) },
  ],
  // the THIGHS (the thigh by design, where its muscles' labels run noisy toward the groin): an underplate between the joint
  // bands; a quadriceps plate down the front narrowing to the knee in a chevron; a trim strip down the outside (the iliotibial
  // band's line) jogging with the side plate's front edge; the side plate behind it; an adductor plate inside, narrowing as
  // the adductors do, and a teardrop over the vastus medialis above the knee; hamstring plates a layer up, either side of a
  // back seam
  thighs: [
    { id: 'Under', seg: 'thigh', layer: 'under', t: [0.13, 0.86], left: line(-0.995), right: line(0.995) },
    { id: 'Quad', seg: 'thigh', layer: 'cap', t: [0.15, 0.84], left: stepped(-0.3, [[...J.a, 0.06], [...J.b, 0.06], [0.74, 0.82, 0.1]], 0.15, 0.84), right: stepped(0.32, [[...J.a, -0.06], [...J.b, -0.06], [0.74, 0.82, -0.1]], 0.15, 0.84) },
    { id: 'Strip', seg: 'thigh', layer: 'mid', t: [0.17, 0.82], left: stepped(0.38, [[...J.a, -0.06], [...J.b, 0.08], [0.72, 0.8, -0.1]], 0.17, 0.82), right: stepped(0.44, [[...J.a, -0.06], [...J.b, 0.08], [0.72, 0.8, -0.1]], 0.17, 0.82) },
    { id: 'Side', seg: 'thigh', layer: 'over', t: [0.15, 0.84], left: stepped(0.49, [[...J.a, -0.06], [...J.b, 0.08], [0.72, 0.8, -0.1]], 0.15, 0.84), right: stepped(0.8, [[0.44, 0.5, 0.05], [0.68, 0.74, -0.06]], 0.15, 0.84) },
    { id: 'Adductor', seg: 'thigh', layer: 'over', role: 'Alloy', t: [0.2, 0.62], left: stepped(-0.78, [[0.4, 0.46, 0.08]], 0.2, 0.62), right: stepped(-0.38, [[...J.a, -0.04], [0.52, 0.58, -0.06]], 0.2, 0.62) },
    { id: 'Medialis', seg: 'thigh', layer: 'over', t: [0.66, 0.84], left: [[0.66, -0.62], [0.76, -0.66], [0.84, -0.5]], right: [[0.66, -0.4], [0.76, -0.36], [0.84, -0.3]] },
    { id: 'Hamstring', seg: 'thigh', layer: 'cap', mirror: true, t: [0.18, 0.8], left: stepped(0.84, [[0.42, 0.48, -0.04], [0.64, 0.7, 0.06]], 0.18, 0.8), right: line(0.99, 0.18, 0.8) },
  ],
  // the VAMBRACE (the forearm by design; t 0 the elbow … 1 the wrist; s 0 its front, the radius's side as the arm hangs,
  // + its lateral side, the back of the forearm, the extensors'): an underplate between the joint bands; a top plate over
  // the extensors narrowing to the wrist, a vent in it; a trim strip down the radius jogging with it; a flexor plate on the
  // inner side; an ulnar plate down the back across the line; a cuff standing proud over the wrist
  vambrace: [
    { id: 'Under', seg: 'foreArm', layer: 'under', t: [0.15, 0.88], left: line(-0.995), right: line(0.995) },
    { id: 'Top', seg: 'foreArm', layer: 'cap', t: [0.17, 0.8], left: stepped(0.22, [[...J.a, 0.06], [...J.b, 0.06]], 0.17, 0.8), right: stepped(0.84, [[...J.a, -0.04], [...J.b, -0.08]], 0.17, 0.8) },
    { id: 'Vent', seg: 'foreArm', layer: 'light', lift: 0.016, t: [0.21, 0.31], left: line(0.47, 0.21, 0.31), right: line(0.56, 0.21, 0.31) },
    { id: 'Strip', seg: 'foreArm', layer: 'mid', t: [0.18, 0.79], left: stepped(0.08, [[...J.a, 0.06], [...J.b, 0.06]], 0.18, 0.79), right: stepped(0.15, [[...J.a, 0.06], [...J.b, 0.06]], 0.18, 0.79) },
    { id: 'Flexor', seg: 'foreArm', layer: 'over', t: [0.17, 0.8], left: stepped(-0.8, [[0.5, 0.56, 0.08]], 0.17, 0.8), right: stepped(-0.1, [[...J.a, -0.04], [...J.b, 0.04]], 0.17, 0.8) },
    { id: 'Ulnar', seg: 'foreArm', layer: 'over', role: 'Alloy', t: [0.2, 0.78], left: stepped(0.9, [[...J.b, -0.06]], 0.2, 0.78), right: line(1.14, 0.2, 0.78) },
    { id: 'Cuff', seg: 'foreArm', layer: 'cap', lift: 0.015, t: [0.81, 0.875], left: line(-0.995), right: line(0.995) },
  ],
  // the GAUNTLET (the hand by design; t 0 the wrist … 1 the knuckles' arc; s 0 the back of the hand, + the thumb's side,
  // ±1 the palm): an underplate over the back and the sides; a back plate stepped; a blade down the little finger's
  // edge; a knuckle cap domed; a repulsor in the palm (a hub and its light); the thumb's and each finger's lames, one a
  // phalanx, low (a finger is thin)
  gauntlet: [
    { id: 'Under', seg: 'hand', layer: 'under', lift: 0.0025, t: [0.06, 0.98], left: line(-0.72), right: line(0.72) },
    { id: 'Back', seg: 'hand', layer: 'over', lift: 0.0055, t: [0.12, 0.72], left: stepped(-0.5, [[0.4, 0.46, 0.08]], 0.12, 0.72), right: stepped(0.42, [[0.4, 0.46, -0.06]], 0.12, 0.72) },
    { id: 'Blade', seg: 'hand', layer: 'mid', role: 'Trim', lift: 0.004, t: [0.14, 0.9], left: stepped(-0.68, [[0.4, 0.46, 0.08]], 0.14, 0.9), right: stepped(-0.58, [[0.4, 0.46, 0.08]], 0.14, 0.9) },
    { id: 'Knuckle', seg: 'hand', layer: 'cap', lift: 0.0065, dome: 0.003, t: [0.76, 0.99], left: line(-0.56, 0.76, 0.99), right: line(0.5, 0.76, 0.99) },
    { id: 'Repulsor', seg: 'hand', layer: 'cap', role: 'Alloy', lift: 0.005, circle: { t: 0.5, s: 1, r: 0.016 } },
    { id: 'RepulsorLight', seg: 'hand', layer: 'light', lift: 0.0075, circle: { t: 0.5, s: 1, r: 0.011 } },
    ...[[0.22, 0.48], [0.52, 0.73], [0.77, 0.98]].map((t, i) => ({ id: `Thumb${i}`, seg: 'thumb', layer: 'over', lift: 0.002, t, left: line(-0.46), right: line(0.46) })),
    ...[[0.28, 0.48], [0.53, 0.73], [0.77, 0.98]].map((t, i) => ({ id: `Lame${i}`, seg: 'fingers', layer: 'over', lift: 0.002, t, left: line(-0.46), right: line(0.46) })),
  ],
  // the HEAVY VAMBRACE: the vambrace with a ridge down its top plate and a cuff flaring wide over the wrist
  vambraceHeavy: [
    { id: 'Ridge', seg: 'foreArm', layer: 'cap', role: 'Alloy', lift: 0.019, t: [0.2, 0.78], left: stepped(0.47, [[...J.b, -0.02]], 0.2, 0.78), right: stepped(0.55, [[...J.b, -0.02]], 0.2, 0.78) },
    { id: 'Flare', seg: 'foreArm', layer: 'cap', lift: 0.022, t: [0.8, 0.88], left: line(-0.995), right: line(0.995) },
  ],
  // the HEAVY GAUNTLET: a back plate a layer up reaching the knuckle bar; the bar wide and domed, a stud over each
  // knuckle; a guard over the thumb's root; the lames wider
  gauntletHeavy: [
    { id: 'Under', seg: 'hand', layer: 'under', lift: 0.0025, t: [0.06, 0.98], left: line(-0.76), right: line(0.76) },
    { id: 'Back', seg: 'hand', layer: 'cap', lift: 0.007, t: [0.12, 0.74], left: stepped(-0.6, [[0.4, 0.46, 0.06]], 0.12, 0.74), right: stepped(0.52, [[0.4, 0.46, -0.06]], 0.12, 0.74) },
    { id: 'Bar', seg: 'hand', layer: 'cap', lift: 0.0078, dome: 0.004, t: [0.77, 0.99], left: line(-0.58, 0.77, 0.99), right: line(0.52, 0.77, 0.99) },
    ...[0.36, 0.12, -0.12, -0.36].map((sc, i) => ({ id: `Stud${i}`, seg: 'hand', layer: 'cap', role: 'Alloy', lift: 0.011, dome: 0.002, circle: { t: 0.88, s: sc, r: 0.0065 } })),
    { id: 'Repulsor', seg: 'hand', layer: 'cap', role: 'Alloy', lift: 0.005, circle: { t: 0.5, s: 1, r: 0.017 } },
    { id: 'RepulsorLight', seg: 'hand', layer: 'light', lift: 0.0075, circle: { t: 0.5, s: 1, r: 0.012 } },
    { id: 'ThumbGuard', seg: 'thumb', layer: 'cap', lift: 0.0045, t: [0.12, 0.5], left: line(-0.7), right: line(0.7) },
    ...[[0.53, 0.73], [0.77, 0.98]].map((t, i) => ({ id: `Thumb${i}`, seg: 'thumb', layer: 'over', lift: 0.003, t, left: line(-0.56), right: line(0.56) })),
    ...[[0.27, 0.48], [0.52, 0.73], [0.77, 0.99]].map((t, i) => ({ id: `Lame${i}`, seg: 'fingers', layer: 'over', lift: 0.003, t, left: line(-0.58), right: line(0.58) })),
  ],
  // the SLEEK GAUNTLET: one plate over the back of the hand to the knuckles, a light line down it; narrow lames
  gauntletSleek: [
    { id: 'Under', seg: 'hand', layer: 'under', lift: 0.002, t: [0.06, 0.98], left: line(-0.66), right: line(0.66) },
    { id: 'Back', seg: 'hand', layer: 'over', lift: 0.0045, t: [0.12, 0.98], left: stepped(-0.52, [[0.62, 0.7, 0.06]], 0.12, 0.98), right: stepped(0.46, [[0.62, 0.7, -0.04]], 0.12, 0.98) },
    { id: 'Line', seg: 'hand', layer: 'light', lift: 0.0058, t: [0.2, 0.62], left: line(-0.035, 0.2, 0.62), right: line(0.035, 0.2, 0.62) },
    { id: 'RepulsorLight', seg: 'hand', layer: 'light', lift: 0.004, circle: { t: 0.5, s: 1, r: 0.012 } },
    ...[[0.52, 0.73], [0.77, 0.98]].map((t, i) => ({ id: `Thumb${i}`, seg: 'thumb', layer: 'over', lift: 0.0016, t, left: line(-0.38), right: line(0.38) })),
    ...[[0.28, 0.48], [0.53, 0.73], [0.77, 0.98]].map((t, i) => ({ id: `Lame${i}`, seg: 'fingers', layer: 'over', lift: 0.0016, t, left: line(-0.38), right: line(0.38) })),
  ],
  // the SERVOS: a hub at the outer and the inner side of each knee and elbow, a mechanical joint's: a disc, a domed core,
  // a light at its middle (a panel `circle`: { t, s, r (m) } on its segment, mirrored to the other side)
  servos: [
    ...[['thigh', 0.95, 0.03], ['upperArm', 0.94, 0.024]].flatMap(([seg, t, r]) => [
      { id: `${seg[0].toUpperCase()}${seg.slice(1)}Hub`, seg, layer: 'cap', role: 'Alloy', mirror: true, circle: { t, s: 0.5, r }, lift: 0.016 },
      { id: `${seg[0].toUpperCase()}${seg.slice(1)}Core`, seg, layer: 'cap', role: 'Joint', mirror: true, circle: { t, s: 0.5, r: r * 0.6 }, lift: 0.019, dome: 0.004 },
      { id: `${seg[0].toUpperCase()}${seg.slice(1)}Light`, seg, layer: 'light', mirror: true, circle: { t, s: 0.5, r: r * 0.2 }, lift: 0.0245 },
    ]),
  ],
  // the KNEE CAP: a domed cap over the top of the shank, chevroned below
  kneeCap: [
    { id: 'Cap', seg: 'shank', layer: 'cap', dome: 0.008, t: [0.0, 0.14], left: [[0, -0.36], [0.14, -0.14]], right: [[0, 0.36], [0.14, 0.14]] },
  ],
  // the SABATON: an underplate over the foot's top and sides; an instep plate and side plates leaving windows; a heel cap
  // (the toe and the sole are the footwear library's: a card's `feet`)
  sabaton: [
    { id: 'Under', seg: 'foot', layer: 'under', t: [0.14, 0.92], left: line(-0.74), right: line(0.74) },
    { id: 'Instep', seg: 'foot', layer: 'over', t: [0.28, 0.8], left: stepped(-0.22, [[0.48, 0.54, -0.08], [0.7, 0.76, -0.04]], 0.28, 0.8), right: stepped(0.22, [[0.48, 0.54, 0.08], [0.7, 0.76, 0.04]], 0.28, 0.8) },
    { id: 'Side', seg: 'foot', layer: 'over', mirror: true, t: [0.18, 0.9], left: stepped(0.36, [[0.48, 0.54, 0.1], [0.7, 0.76, 0.02]], 0.18, 0.9), right: line(0.72, 0.18, 0.9) },
    { id: 'Heel', seg: 'foot', layer: 'cap', mirror: true, t: [0.04, 0.34], left: stepped(0.78, [[0.18, 0.24, -0.06]], 0.04, 0.34), right: line(0.995, 0.04, 0.34) },
  ],
};
/** the layouts by name (greaveFront: the greave without its drawn calf plate, for a suit that cuts the calf by its muscles) */
export const LAYOUTS = Object.freeze({ ...BASE, greaveFront: BASE.greave.filter((p) => p.id !== 'Calf') });
