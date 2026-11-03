/**
 * mecha-tools-parts — a builder per manipulator tool (an ODM row of kind `mecha-tool`, by its family): each drawn in its
 * coupler's frame, hanging along −z from the wrist's quick coupler at the origin, its `tip` the point it works at (a
 * bucket's teeth, a hammer's chisel, a fork's tines' ends, a pad's face). At a claw angle of 90° a tool points ahead.
 *
 *   builder(row, C) → { lathes?, sweeps?, extrudes?, hardpoints: { tip, … } }
 *
 * Every tool carries the same coupler plate on its top: one interface, any tool (an excavator's quick coupler is the
 * model). Pure: no clock, no dice.
 */
import { add, box, spin, tone, tube } from './mecha-common.js';

/** The quick coupler's plate and its two pins: the same on every tool. */
function coupler(C, w = 0.2) {
  const frame = tone(C.trim, -0.1);
  return [
    box('couplerPlate', [0, -0.08, -0.03], [0, 0.08, -0.03], w, 0.06, frame),
    ...[-0.05, 0.05].map((y) => box(`couplerPin_${y > 0 ? 'f' : 'b'}`, [-w / 2 - 0.01, y, -0.005], [w / 2 + 0.01, y, -0.005], 0.03, 0.03, C.chrome)),
  ];
}

// ── a digging bucket: its shell, its cutting edge, its teeth ────────────────────────────────────────────────────
function bucket(row, C) {
  const d = row.dims, extrudes = [...coupler(C)], half = d.w / 2;
  for (const s of [1, -1]) extrudes.push(box(`side_${s > 0 ? 'r' : 'l'}`, [s * half, 0, -0.06], [s * half, 0, -d.length], 0.02, d.depth, C.paint, [0, 1, 0]));
  extrudes.push(box('back', [0, -d.depth / 2, -0.06], [0, -d.depth / 2, -d.length + 0.04], d.w, 0.02, C.paint, [0, 1, 0]));
  extrudes.push(box('floor', [0, -d.depth / 2, -d.length + 0.02], [0, d.depth / 2, -d.length + 0.02], d.w, 0.025, C.paint));
  extrudes.push(box('edge', [-half, d.depth / 2 - 0.02, -d.length + 0.02], [half, d.depth / 2 - 0.02, -d.length + 0.02], 0.04, 0.03, tone(C.trim, 0.2)));
  for (let i = 0; i < d.teeth; i++) {
    const x = -half + 0.04 + (i * (d.w - 0.08)) / (d.teeth - 1);
    extrudes.push(box(`tooth_${i}`, [x, d.depth / 2 - 0.02, -d.length + 0.02], [x, d.depth / 2 + 0.08, -d.length - 0.01], 0.035, 0.03, C.chrome));
  }
  return { extrudes, hardpoints: { tip: [0, d.depth / 2 + 0.08, -d.length - 0.01] } };
}

// ── a hydraulic breaker: its housing, its accumulator, its chisel ───────────────────────────────────────────────
function breaker(row, C) {
  const d = row.dims, extrudes = [...coupler(C)], lathes = [];
  extrudes.push(box('housing', [0, 0, -0.06], [0, 0, -d.body], d.w, d.w * 0.85, C.paint, [0, 1, 0]));
  extrudes.push(box('band', [0, 0, -d.body * 0.45], [0, 0, -d.body * 0.52], d.w + 0.012, d.w * 0.85 + 0.012, tone(C.trim, -0.1), [0, 1, 0]));
  lathes.push(spin('accumulator', [0, -d.w * 0.55, -0.14], [0, -d.w * 0.55, -0.34], [[0, 0.04], [0.15, 0.06], [0.85, 0.06], [1, 0.04]], tone(C.trim, 0.1), 12));
  lathes.push(spin('bush', [0, 0, -d.body], [0, 0, -d.body - 0.05], [[0, 0.06], [1, 0.05]], tone(C.trim, -0.1), 14));
  lathes.push(spin('chisel', [0, 0, -d.body - 0.05], [0, 0, -d.length], [[0, 0.035], [0.75, 0.035], [1, 0.006]], C.chrome, 12));
  return { extrudes, lathes, hardpoints: { tip: [0, 0, -d.length] } };
}

// ── a crusher: its jaws, open, about their pivot ────────────────────────────────────────────────────────────────
function crusher(row, C) {
  const d = row.dims, extrudes = [...coupler(C)], lathes = [], sweeps = [];
  extrudes.push(box('head', [0, 0, -0.06], [0, 0, -0.26], d.w, 0.22, C.paint, [0, 1, 0]));
  lathes.push(spin('pivot', [-d.w / 2 - 0.02, 0, -0.26], [d.w / 2 + 0.02, 0, -0.26], [[0, 0.05], [1, 0.05]], C.chrome, 12));
  for (const s of [1, -1]) {
    // (each jaw curved toward the other, its teeth along its inner edge)
    const o = s * d.gap / 2;
    sweeps.push(tube(`jaw_${s > 0 ? 'f' : 'b'}`, [[0, s * 0.05, -0.26], [0, o, -0.38], [0, o * 0.9, -d.length + 0.08], [0, o * 0.35, -d.length]], 0.05, C.paint, 10));
    for (let i = 0; i < 3; i++) extrudes.push(box(`tooth_${s > 0 ? 'f' : 'b'}${i}`, [0, o * 0.8 - s * 0.04, -0.4 - i * 0.09], [0, o * 0.8 - s * 0.09, -0.42 - i * 0.09], 0.08, 0.03, C.chrome));
  }
  extrudes.push(box('cylinder', [0, 0, -0.08], [0, 0, -0.24], 0.08, 0.08, C.chrome, [0, 1, 0]));
  return { extrudes, lathes, sweeps, hardpoints: { tip: [0, 0, -d.length] } };
}

// ── pallet forks: their carriage and its backrest, two tines along −z ───────────────────────────────────────────
function forks(row, C) {
  const d = row.dims, extrudes = [...coupler(C)], half = d.w / 2;
  extrudes.push(box('carriage', [-half, -0.04, -0.1], [half, -0.04, -0.1], 0.06, 0.12, C.trim));
  extrudes.push(box('backrest', [-half, -0.06, -0.05], [half, -0.06, -0.05], 0.03, 0.24, C.paint));
  for (const s of [1, -1]) {
    const x = s * d.spread / 2;
    extrudes.push(box(`shank_${s > 0 ? 'r' : 'l'}`, [x, -0.04, -0.06], [x, -0.04, -0.18], 0.07, 0.04, tone(C.trim, 0.1)));
    extrudes.push(box(`tine_${s > 0 ? 'r' : 'l'}`, [x, 0.0, -0.18], [x, 0.0, -d.length], 0.08, 0.035, tone(C.trim, 0.1), [0, 1, 0]));
  }
  return { extrudes, hardpoints: { tip: [0, 0, -d.length] } };
}

// ── an earth auger: its motor, its shaft, its flight ────────────────────────────────────────────────────────────
function auger(row, C) {
  const d = row.dims, extrudes = [...coupler(C)], lathes = [], sweeps = [];
  lathes.push(spin('motor', [0, 0, -0.06], [0, 0, -0.3], [[0, 0.1], [0.1, 0.12], [0.9, 0.12], [1, 0.09]], C.paint, 16));
  lathes.push(spin('shaft', [0, 0, -0.3], [0, 0, -d.length], [[0, 0.035], [0.95, 0.035], [1, 0.01]], tone(C.trim, 0.2), 10));
  // (its flight: a helix round the shaft, a sweep of short turns)
  const pts = [], turns = 4, top = -0.36, bot = -d.length + 0.06;
  for (let i = 0; i <= turns * 12; i++) { const a = (i / 12) * 2 * Math.PI, z = top + ((bot - top) * i) / (turns * 12); pts.push([Math.cos(a) * d.r, Math.sin(a) * d.r, z]); }
  sweeps.push(tube('flight', pts, 0.018, tone(C.trim, 0.25), 6));
  return { extrudes, lathes, sweeps, hardpoints: { tip: [0, 0, -d.length] } };
}

// ── a vacuum lifter: its pump, its beam, its pad ────────────────────────────────────────────────────────────────
function vacuum(row, C) {
  const d = row.dims, extrudes = [...coupler(C)], lathes = [];
  extrudes.push(box('pump', [0, 0, -0.06], [0, 0, -0.18], 0.18, 0.14, C.paint, [0, 1, 0]));
  extrudes.push(box('beam', [0, 0, -0.2], [0, 0, -0.26], d.w, 0.08, C.trim, [0, 1, 0]));
  extrudes.push(box('pad', [0, 0, -0.26], [0, 0, -d.length + 0.01], d.w + 0.04, d.d, C.light, [0, 1, 0]));
  extrudes.push(box('seal', [0, 0, -d.length + 0.01], [0, 0, -d.length], d.w + 0.05, d.d + 0.01, C.rubber, [0, 1, 0]));
  lathes.push(spin('gauge', [0.06, 0.08, -0.12], [0.06, 0.1, -0.12], [[0, 0.025], [1, 0.025]], C.glass, 10));
  return { extrudes, lathes, hardpoints: { tip: [0, 0, -d.length] } };
}

// ── a lifting magnet: its disc on its chains ────────────────────────────────────────────────────────────────────
function magnet(row, C) {
  const d = row.dims, extrudes = [...coupler(C)], lathes = [], sweeps = [];
  for (const [i, a] of [0, 2.1, 4.2].entries()) sweeps.push(tube(`chain_${i}`, [[0, 0, -0.06], [Math.cos(a) * d.r * 0.7, Math.sin(a) * d.r * 0.7, -d.length + 0.12]], 0.01, C.chrome, 6));
  lathes.push(spin('disc', [0, 0, -d.length + 0.12], [0, 0, -d.length], [[0, d.r * 0.92], [0.15, d.r], [1, d.r]], C.paint, 24));
  lathes.push(spin('face', [0, 0, -d.length + 0.006], [0, 0, -d.length - 0.004], [[0, d.r * 0.85], [1, d.r * 0.85]], tone(C.trim, -0.1), 24));
  extrudes.push(box('box', [0, 0, -d.length + 0.12], [0, 0, -d.length + 0.18], 0.16, 0.12, C.trim, [0, 1, 0]));
  return { extrudes, lathes, sweeps, hardpoints: { tip: [0, 0, -d.length] } };
}

// ── a lifting hook: its swivel, its shank, its hook and latch ───────────────────────────────────────────────────
function hook(row, C) {
  const d = row.dims, extrudes = [...coupler(C, 0.14)], lathes = [], sweeps = [];
  lathes.push(spin('swivel', [0, 0, -0.06], [0, 0, -0.14], [[0, 0.05], [1, 0.04]], C.chrome, 12));
  sweeps.push(tube('hook', [[0, 0, -0.14], [0, 0, -d.length + 0.1], [0, 0.04, -d.length + 0.02], [0, 0.1, -d.length + 0.01], [0, 0.13, -d.length + 0.06], [0, 0.11, -d.length + 0.1]], 0.025, C.light, 10));
  extrudes.push(box('latch', [0, 0.02, -d.length + 0.14], [0, 0.11, -d.length + 0.1], 0.02, 0.01, C.chrome));
  return { extrudes, lathes, sweeps, hardpoints: { tip: add([0, 0.06, 0], [0, 0, -d.length]) } };
}

export const TOOL_BUILDERS = Object.freeze({ bucket, breaker, crusher, forks, auger, vacuum, magnet, hook });
