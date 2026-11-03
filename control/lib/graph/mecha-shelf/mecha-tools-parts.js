/**
 * mecha-tools-parts — a builder per manipulator tool (an ODM row of kind `mecha-tool`, by its family): each drawn in its
 * coupler's frame, hanging along −z from the wrist's quick coupler at the origin, its `tip` the point it works at (a
 * bucket's teeth, a hammer's chisel, a fork's tines' ends, a pad's face). At a claw angle of 90° a tool points ahead.
 *
 *   builder(row, C) → { lathes?, sweeps?, extrudes?, hardpoints: { tip, … } }
 *
 * Every tool carries the same coupler plate on its top: one interface, any tool (an excavator's quick coupler is the
 * model). A giant arm's tools are drawn at its size, on its larger coupler. Pure: no clock, no dice.
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

// ── a giant hand: its palm, its fingers (two, or three) and a thumb opposing them, each in two segments, its pads ──
function hand(row, C) {
  const d = row.dims, [pw, pd, ph] = d.palm, extrudes = [...coupler(C, 0.34)], sweeps = [], pad = C.light, r = d.r;
  extrudes.push(box('palm', [0, 0, -0.06], [0, 0, -0.06 - ph], pw, pd, C.paint, [0, 1, 0]));
  extrudes.push(box('knuckles', [-pw / 2, pd / 2 - 0.04, -0.06 - ph], [pw / 2, pd / 2 - 0.04, -0.06 - ph], 0.08, 0.08, tone(C.trim, -0.1)));
  // (a finger: from its knuckle down and curled in toward the thumb, a pad at its tip)
  const finger = (id, x, y0, dir, L) => {
    const k = [x, y0, -0.06 - ph], m = [x, y0 + dir * 0.06, k[2] - L * 0.55], t = [x, y0 + dir * 0.18, k[2] - L * 0.95];
    sweeps.push(tube(`${id}_a`, [k, m], r, tone(C.trim, 0.05), 10));
    sweeps.push(tube(`${id}_b`, [m, t], r * 0.85, tone(C.trim, 0.05), 10));
    extrudes.push(box(`${id}_pad`, add(t, [0, -dir * 0.02, 0.05]), add(t, [0, -dir * 0.02, -0.03]), r * 2.2, r * 1.6, pad, [0, 1, 0]));
  };
  // (its fingers side by side across the palm, `fingers` counting the thumb: three by default, a fourth for a heavier grip)
  const n = (d.fingers ?? 3) - 1;
  for (let i = 0; i < n; i++) finger(['index', 'middle', 'ring'][i] ?? `finger${i}`, pw * (0.5 - (i + 0.5) / n), pd / 2 - 0.04, -1, d.finger);
  finger('thumb', 0, -pd / 2 + 0.04, 1, d.thumb);
  return { extrudes, sweeps, hardpoints: { tip: [0, 0, -0.06 - ph - d.finger * 0.8] } };
}

// ── a parallel gripper: a body, its guide rods, two flat jaws, their pads ────────────────────────────────────────
function gripper(row, C) {
  const d = row.dims, [pw, pd, ph] = d.palm, extrudes = [...coupler(C, 0.34)], lathes = [], g = d.gap / 2, F = d.finger;
  extrudes.push(box('body', [0, 0, -0.06], [0, 0, -0.06 - ph], pw, pd, C.paint, [0, 1, 0]));
  for (const y of [pd * 0.25, -pd * 0.25]) lathes.push(spin(`rod_${y > 0 ? 'f' : 'b'}`, [-g - 0.06, y, -0.06 - ph * 0.55], [g + 0.06, y, -0.06 - ph * 0.55], [[0, 0.022], [1, 0.022]], C.chrome, 10));
  for (const s of [1, -1]) {
    const side = s > 0 ? 'o' : 'i', x = s * g;
    extrudes.push(box(`carriage_${side}`, [x, 0, -0.06 - ph * 0.2], [x, 0, -0.06 - ph * 0.9], 0.07, pd * 0.8, C.trim, [0, 1, 0]));
    extrudes.push(box(`jaw_${side}`, [x, 0, -0.06 - ph * 0.8], [x, 0, -0.06 - ph - F], 0.05, pd * 0.7, C.paint, [0, 1, 0]));
    extrudes.push(box(`pad_${side}`, [x - s * 0.03, 0, -0.06 - ph - 0.04], [x - s * 0.03, 0, -0.06 - ph - F + 0.02], 0.014, pd * 0.6, C.rubber, [0, 1, 0]));
  }
  return { extrudes, lathes, hardpoints: { tip: [0, 0, -0.06 - ph - F * 0.8] } };
}

// ── a rescue spreader: its body, its two arms opened about their pin, their tips' teeth ─────────────────────────
function spreader(row, C) {
  const d = row.dims, extrudes = [...coupler(C, 0.3)], lathes = [], sweeps = [];
  lathes.push(spin('body', [0, 0, -0.06], [0, 0, -0.42], [[0, 0.1], [0.1, 0.12], [0.9, 0.12], [1, 0.09]], C.paint, 16));
  lathes.push(spin('pin', [-0.08, 0, -0.44], [0.08, 0, -0.44], [[0, 0.06], [1, 0.06]], C.chrome, 12));
  for (const s of [1, -1]) {
    const tip = [0, s * d.open / 2, -0.44 - d.arm];
    sweeps.push(tube(`arm_${s > 0 ? 'f' : 'b'}`, [[0, s * 0.03, -0.44], [0, s * d.open * 0.32, -0.44 - d.arm * 0.5], tip], 0.05, C.light, 10));
    extrudes.push(box(`tip_${s > 0 ? 'f' : 'b'}`, add(tip, [0, -s * 0.03, 0.02]), add(tip, [0, s * 0.02, -0.06]), 0.12, 0.06, C.chrome, [0, 1, 0]));
  }
  return { extrudes, lathes, sweeps, hardpoints: { tip: [0, 0, -0.44 - d.arm] } };
}

// ── a shoring prop: its barrel, its screw stage, its swivel head plate (it holds a load up: a slab, a ceiling) ────
function prop(row, C) {
  const d = row.dims, extrudes = [...coupler(C, 0.24)], lathes = [];
  lathes.push(spin('barrel', [0, 0, -0.06], [0, 0, -d.length * 0.6], [[0, d.r], [0.95, d.r], [1, d.r * 1.15]], C.paint, 14));
  lathes.push(spin('stage', [0, 0, -d.length * 0.6], [0, 0, -d.length + 0.06], [[0, d.r * 0.7], [1, d.r * 0.7]], C.chrome, 12));
  lathes.push(spin('collar', [0, 0, -d.length * 0.62], [0, 0, -d.length * 0.66], [[0, d.r * 1.4], [1, d.r * 1.4]], tone(C.trim, -0.1), 12));
  extrudes.push(box('head', [0, 0, -d.length + 0.06], [0, 0, -d.length], d.pad[0], d.pad[1], tone(C.trim, 0.1), [0, 1, 0]));
  extrudes.push(box('headPad', [0, 0, -d.length], [0, 0, -d.length - 0.02], d.pad[0] - 0.04, d.pad[1] - 0.04, C.rubber, [0, 1, 0]));
  return { extrudes, lathes, hardpoints: { tip: [0, 0, -d.length - 0.02] } };
}

// ── a shear: its head, its two curved blades open about their pivot (a felling head's, a steel shear's) ─────────
function shear(row, C) {
  const d = row.dims, extrudes = [...coupler(C, 0.3)], lathes = [], sweeps = [];
  extrudes.push(box('head', [0, 0, -0.06], [0, 0, -0.34], d.w, 0.3, C.paint, [0, 1, 0]));
  lathes.push(spin('pivot', [-d.w / 2 - 0.03, 0, -0.34], [d.w / 2 + 0.03, 0, -0.34], [[0, 0.07], [1, 0.07]], C.chrome, 12));
  for (const s of [1, -1]) {
    const o = s * d.gap / 2;
    sweeps.push(tube(`blade_${s > 0 ? 'f' : 'b'}`, [[0, s * 0.05, -0.34], [0, o, -0.5], [0, o * 0.8, -d.length + 0.12], [0, o * 0.2, -d.length]], 0.045, s > 0 ? C.chrome : tone(C.trim, 0.1), 10));
  }
  extrudes.push(box('cylinder', [0, -0.18, -0.08], [0, -0.18, -0.3], 0.1, 0.1, C.chrome, [0, 1, 0]));
  return { extrudes, lathes, sweeps, hardpoints: { tip: [0, 0, -d.length] } };
}

// ── a vibratory driver: its exciter case on its dampers, its clamp's jaws below (a pile, a sheet pile) ──────────
function vibro(row, C) {
  const d = row.dims, extrudes = [...coupler(C, 0.34)], lathes = [];
  extrudes.push(box('suspension', [0, 0, -0.06], [0, 0, -0.16], d.w * 0.8, d.d * 0.8, tone(C.trim, -0.1), [0, 1, 0]));
  for (const x of [-d.w / 3, d.w / 3]) lathes.push(spin(`damper_${x > 0 ? 'r' : 'l'}`, [x, 0, -0.16], [x, 0, -0.24], [[0, 0.06], [0.5, 0.07], [1, 0.06]], C.rubber, 12));
  extrudes.push(box('exciter', [0, 0, -0.24], [0, 0, -0.24 - d.h], d.w, d.d, C.paint, [0, 1, 0]));
  extrudes.push(box('band', [0, 0, -0.24 - d.h * 0.3], [0, 0, -0.24 - d.h * 0.4], d.w + 0.012, d.d + 0.012, C.light, [0, 1, 0]));
  for (const s of [1, -1]) extrudes.push(box(`jaw_${s > 0 ? 'f' : 'b'}`, [0, s * 0.06, -0.24 - d.h], [0, s * 0.06, -0.24 - d.h - d.jaw], d.w * 0.4, 0.06, C.chrome, [0, 1, 0]));
  return { extrudes, lathes, hardpoints: { tip: [0, 0, -0.24 - d.h - d.jaw] } };
}

// ── a clamshell: its head, its two half-shells open about their pins ────────────────────────────────────────────
function clamshell(row, C) {
  const d = row.dims, extrudes = [...coupler(C, 0.34)], lathes = [], sweeps = [];
  extrudes.push(box('head', [0, 0, -0.06], [0, 0, -0.3], 0.34, 0.24, C.trim, [0, 1, 0]));
  lathes.push(spin('pins', [-d.w / 2, 0, -0.3], [d.w / 2, 0, -0.3], [[0, 0.05], [1, 0.05]], C.chrome, 12));
  for (const s of [1, -1]) {
    // (a half-shell: two side plates and a curved floor of slats, opened out)
    const o = s * d.r;
    for (const x of [-d.w / 2, d.w / 2]) sweeps.push(tube(`rim_${s > 0 ? 'f' : 'b'}${x > 0 ? 'r' : 'l'}`, [[x, s * 0.04, -0.3], [x, o, -0.5], [x, o * 0.85, -d.length + 0.1], [x, o * 0.1, -d.length]], 0.03, C.paint, 8));
    for (let i = 0; i < 4; i++) { const t = 0.3 + i * 0.2, y = o * (1 - t * 0.6), z = -0.5 - t * (d.length - 0.55); extrudes.push(box(`slat_${s > 0 ? 'f' : 'b'}${i}`, [-d.w / 2, y, z], [d.w / 2, y, z], 0.05, 0.12, C.paint)); }
    extrudes.push(box(`lip_${s > 0 ? 'f' : 'b'}`, [-d.w / 2, o * 0.1, -d.length], [d.w / 2, o * 0.1, -d.length], 0.05, 0.04, C.chrome));
  }
  return { extrudes, lathes, sweeps, hardpoints: { tip: [0, 0, -d.length] } };
}

export const TOOL_BUILDERS = Object.freeze({ bucket, breaker, crusher, forks, auger, vacuum, magnet, hook, hand, gripper, spreader, prop, shear, vibro, clamshell });
