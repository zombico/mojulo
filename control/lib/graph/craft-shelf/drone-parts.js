/**
 * drone-parts — the builders of the craft shelf's drone kinds (drone-odm.js), merged into CRAFT_BUILDERS: each a pure
 * function of its row, its palette's colours and the pose, returning the shelf's own monomers (lofts, lathes, sweeps,
 * extrudes in metres) and its hardpoints, as craft-parts.js's builders do. A part number always makes the same part.
 *
 *   drone-frame    shell      a moulded body lofted nose to tail; the sensors' windows in its nose, tail and belly, the
 *                             battery's cover on top, vents along its sides
 *   drone-arm      beam       a beam from its root (the mount) along +x to its motor's pad, its tip lifted by `rise`; the
 *                             hinge's knuckle at its root, a LED and a foot under its tip; folds about the vertical at its
 *                             root by the craft's `fold` (0 spread … 1 folded)
 *   drone-motor    outrunner  its base, its bell and the cooling slots round it, the prop adapter on top
 *                  vent       a starship drone's lift vent: a housing, its bell down, the glow in its throat
 *   drone-rotor    blades     its hub and cap, the blades lofted from the hub out with their pitch washing out to the tip,
 *                             swept back; turned by `pose.rotor` (degrees) the way its hand turns
 *   drone-guard    ring       two rings round the disc on spokes from the motor
 *   drone-payload  gimbal3    the yaw motor under its plate, the bracket down one side, the roll motor, the camera's body
 *                             and its lens
 *                  eye        a starship drone's sensor eye: its ring and its glass dome, looking ahead
 *   drone-mast     gps        a post and the GPS puck on it
 *
 * Craft space: +y forward, +z up, +x right, metres. Pure.
 */
import { DEG, lathe, loftWorld, sweep, extrudeWorld, section, round3, tone } from './craft-common.js';

const r3v = (v) => v.map(round3);
const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
const rotZ = (a, v) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a), v[2]];
const NAV = { r: '#2fd36b', l: '#e23b3b', c: '#f4f6f8' };
// a flat rectangle's offsets square to an extrude's axis: w along u, h along v
const rect = (u, v, w, h) => [[0, 1], [1, 1], [1, 0], [0, 0]].map(([a, b]) => [0, 1, 2].map((k) => u[k] * (a - 0.5) * w + v[k] * (b - 0.5) * h));

function buildFrame(row, C) {
  const { length: L, width: W, height: H } = row.dims, b = row.build;
  if (b.family !== 'shell') throw new Error(`Unknown drone-frame family '${b.family}'`);
  const st = b.stations.map(([s, w, h, zc]) => ({ t: s, points: section(Math.max((w * W) / 2, 0.002), Math.max((h * H) / 2, 0.002), b.n || 3, b.belly ?? 1).map(([x, z]) => [x, 0, zc * H + z]) }));
  const lofts = [loftWorld('shell', [0, L / 2, 0], [0, -L / 2, 0], st, C.paint, { interp: 'smooth', segments: 4 })];
  const extrudes = [];
  const at = (s) => { let i = 1; while (i < b.stations.length - 1 && s > b.stations[i][0]) i += 1; const [p, q] = [b.stations[i - 1], b.stations[i]], k = (s - p[0]) / (q[0] - p[0] || 1); return p.map((v, j) => v + k * (q[j] - v)); };
  // the sensors' windows: a pair in the flat nose and tail, a pair under the belly
  const S = b.sensors || {}, ws = W * 0.13, hs = H * 0.12;
  for (const [end, y, dir] of [['nose', L / 2, 1], ['tail', -L / 2, -1]]) {
    const [, w, , zc] = at(end === 'nose' ? 0 : 1);
    for (let i = 0; i < (S[end] || 0); i++) {
      const x = (i - ((S[end] || 1) - 1) / 2) * ((w * W) / 2), z = zc * H + 0.002;
      extrudes.push(extrudeWorld(`sensor_${end}_${i}`, [x, y + dir * 0.0015, z], [x, y - dir * 0.004, z], rect([1, 0, 0], [0, 0, 1], ws, hs), C.glass, { material: 'glass' }));
    }
  }
  if (S.belly) {
    const [, , h] = at(0.38), zb = -((h * H) / 2) * (b.belly ?? 1) * 0.985;
    for (let i = 0; i < S.belly; i++) {
      const x = (i - (S.belly - 1) / 2) * W * 0.28;
      extrudes.push(extrudeWorld(`sensor_belly_${i}`, [x, L * 0.12, zb - 0.0015], [x, L * 0.12, zb + 0.004], rect([1, 0, 0], [0, 1, 0], ws, hs), C.glass, { material: 'glass' }));
    }
  }
  // the battery's cover along the top, its own colour, standing a hair proud of the shell
  if (b.battery) {
    const [s0, s1] = b.battery, top = Math.max(...[s0, (s0 + s1) / 2, s1].map((s) => { const [, , h, zc] = at(s); return zc * H + (h * H) / 2; })) + 0.0015;
    extrudes.push(extrudeWorld('battery', [0, L / 2 - s0 * L, 0], [0, L / 2 - s1 * L, 0], [[W * 0.27, 0, H * 0.18], [-W * 0.27, 0, H * 0.18], [-W * 0.27, 0, top], [W * 0.27, 0, top]], tone(C.paint, -0.12)));
  }
  // vents along both sides, aft of the middle
  for (let i = 0; i < (b.vents || 0); i++) {
    const s = 0.56 + i * 0.07, [, w, , zc] = at(s), y = L / 2 - s * L, a = (w * W) / 2;
    for (const sx of [1, -1]) extrudes.push(extrudeWorld(`vent_${sx > 0 ? 'r' : 'l'}${i}`, [sx * (a - 0.003), y, zc * H + H * 0.06], [sx * (a + 0.0008), y, zc * H + H * 0.06], rect([0, 1, 0], [0, 0, 1], L * 0.05, H * 0.045), C.rubber));
  }
  const hardpoints = { mount: [0, 0, 0] };
  for (const [name, p] of Object.entries(b.points || {})) hardpoints[name] = r3v(p);
  return { lofts, extrudes, hardpoints };
}

function buildArm(row, C, opts = {}) {
  const { length: L, width: w, height: h } = row.dims, b = row.build;
  if (b.family !== 'beam') throw new Error(`Unknown drone-arm family '${b.family}'`);
  const rise = b.rise || 0, pad = b.motorPad || 0.016;
  // (folded about the vertical at its root: every point turned by the fold's angle so far)
  const angle = b.fold ? b.fold.angle * clamp01(opts.fold) : 0, A = angle * DEG, P = (v) => rotZ(A, v);
  const sec = (k) => section((w / 2) * k, (h / 2) * k, 3, 1).map(([y, z]) => P([0, y, z]));
  const lofts = [loftWorld('beam', P([0, 0, 0]), P([L - pad * 0.6, 0, rise]), [{ t: 0, points: sec(1) }, { t: 0.6, points: sec(0.9) }, { t: 1, points: sec(0.78) }], C.paint, { interp: 'smooth' })];
  const tip = [L, 0, rise], zPad = rise + h * 0.5 + 0.002, zUnder = rise - h * 0.42;
  const lathes = [
    // the hinge's knuckle at the root, the motor's pad at the tip
    lathe('hinge', P([0.006, 0, -h * 0.7]), P([0.006, 0, h * 0.7]), [[0, h * 0.55], [1, h * 0.55]], C.trim, { samples: 14 }),
    lathe('pad', P([tip[0], 0, zUnder]), P([tip[0], 0, zPad]), [[0, pad * 0.7], [0.4, pad], [1, pad * 0.92]], C.paint, { samples: 18, crossSections: 3 }),
  ];
  // a LED under the tip, inboard of the foot
  if (b.led) {
    const x = L - pad - 0.004, tint = b.led === 'nav' ? NAV[opts.side || 'c'] : C.light;
    lathes.push(lathe('led', P([x, 0, rise - h * 0.36]), P([x, 0, rise - h * 0.36 - 0.004]), [[0, 0.0045], [1, 0.0035]], tint, { material: 'neon', samples: 10, crossSections: 2 }));
  }
  const hardpoints = { mount: [0, 0, 0], motor: r3v(P([tip[0], 0, zPad])) };
  // a foot under the tip: where the drone stands
  if (b.foot) {
    lathes.push(lathe('foot', P([tip[0], 0, zUnder]), P([tip[0], 0, zUnder - b.foot]), [[0, pad * 0.45], [0.8, pad * 0.3], [1, pad * 0.22]], C.rubber, { samples: 12, crossSections: 3 }));
    hardpoints.contact = r3v(P([tip[0], 0, zUnder - b.foot]));
  }
  const joints = b.fold ? [{ name: 'fold', control: 'fold', kind: 'hinge', at: [0, 0, 0], dir: [0, 0, 1], range: [0, b.fold.angle], angle: round3(angle) || 0 }] : [];
  return { lofts, lathes, hardpoints, ...(joints.length ? { joints } : {}), ...(b.fold ? { fold: round3(angle) || 0 } : {}) };
}

function buildMotor(row, C) {
  const { diameter: D, height: h } = row.dims, b = row.build, R = D / 2;
  if (b.family === 'outrunner') {
    const lathes = [
      lathe('base', [0, 0, 0], [0, 0, h * 0.32], [[0, R * 0.92], [1, R * 0.86]], C.trim, { samples: 20 }),
      lathe('bell', [0, 0, h * 0.3], [0, 0, h * 0.92], [[0, R], [0.82, R], [1, R * 0.86]], C.trim, { samples: 24, crossSections: 3 }),
      lathe('adapter', [0, 0, h * 0.92], [0, 0, h], [[0, R * 0.42], [1, R * 0.36]], C.chrome, { samples: 16 }),
    ];
    // the cooling slots round the bell
    const extrudes = Array.from({ length: b.slots || 6 }, (_, i) => {
      const a = (2 * Math.PI * i) / (b.slots || 6) + Math.PI / (b.slots || 6), out = [Math.cos(a), Math.sin(a), 0], tan = [-Math.sin(a), Math.cos(a), 0];
      return extrudeWorld(`slot_${i}`, [out[0] * (R + 0.0004), out[1] * (R + 0.0004), h * 0.6], [out[0] * (R - 0.001), out[1] * (R - 0.001), h * 0.6], rect(tan, [0, 0, 1], R * 0.32, h * 0.32), C.rubber);
    });
    return { lathes, extrudes, hardpoints: { mount: [0, 0, 0], shaft: [0, 0, round3(h)] } };
  }
  if (b.family === 'vent') {
    // a starship drone's lift vent: its housing round the arm's tip, its bell down, the glow in its throat
    const lathes = [
      lathe('housing', [0, 0, h * 0.25], [0, 0, -h * 0.55], [[0, R * 0.8], [0.2, R], [1, R * 0.9]], C.trim, { samples: 20, crossSections: 4 }),
      lathe('bell', [0, 0, -h * 0.55], [0, 0, -h], [[0, R * 0.72], [1, R * 0.96]], C.chrome, { samples: 20 }),
      lathe('glow', [0, 0, -h * 0.9], [0, 0, -h * 0.93], [[0, R * 0.66], [1, R * 0.66]], C.light, { material: 'neon', samples: 16 }),
    ];
    return { lathes, hardpoints: { mount: [0, 0, 0], shaft: [0, 0, round3(h * 0.25)] } };
  }
  throw new Error(`Unknown drone-motor family '${b.family}'`);
}

function buildRotor(row, C, opts = {}) {
  const D = row.dims.diameter, b = row.build, R = D / 2, hub = b.hub, hubH = hub * 0.9;
  if (b.family !== 'blades') throw new Error(`Unknown drone-rotor family '${b.family}'`);
  // ccw seen from above: a blade travels +90° from its radius; cw the other way. A mirrored copy turns the other way
  const hand = b.hand === 'cw' ? -1 : 1, spin = ((opts.pose && opts.pose.rotor) || 0) * DEG * hand;
  const lathes = [
    lathe('hub', [0, 0, 0], [0, 0, hubH], [[0, hub], [0.7, hub], [1, hub * 0.8]], C.trim, { samples: 18, crossSections: 3 }),
    lathe('cap', [0, 0, hubH], [0, 0, hubH + hub * 0.35], [[0, hub * 0.62], [0.6, hub * 0.5], [1, hub * 0.12]], C.chrome, { samples: 14, crossSections: 3 }),
  ];
  const lofts = [], zb = hubH * 0.55;
  for (let k = 0; k < b.blades; k++) {
    const phi = (2 * Math.PI * k) / b.blades + Math.PI / 4 + spin, rhat = [Math.cos(phi), Math.sin(phi), 0], that = [-Math.sin(phi) * hand, Math.cos(phi) * hand, 0];
    // a station at f out along the blade: its chord (widest a third out), its pitch washing out, swept back toward the tip
    const chordAt = (f) => (f < 0.3 ? b.rootChord + (b.maxChord - b.rootChord) * (f / 0.3) : b.maxChord + (b.tipChord - b.maxChord) * ((f - 0.3) / 0.7) ** 1.6);
    const station = (f) => {
      const beta = (b.rootPitch + f * (b.tipPitch - b.rootPitch)) * DEG, chord = chordAt(f), thick = chord * (0.14 - 0.08 * f), back = -(b.sweep || 0) * R * f * f;
      const c = [that[0] * Math.cos(beta), that[1] * Math.cos(beta), Math.sin(beta)], n = [-that[0] * Math.sin(beta), -that[1] * Math.sin(beta), Math.cos(beta)];
      return Array.from({ length: 8 }, (_, i) => {
        const th = (i / 8) * 2 * Math.PI, a = (chord / 2) * Math.cos(th), t = (thick / 2) * Math.sin(th);
        return [0, 1, 2].map((j) => a * c[j] + t * n[j] + back * that[j]);
      });
    };
    const r0 = hub * 0.85;
    const from = [rhat[0] * r0, rhat[1] * r0, zb], to = [rhat[0] * R, rhat[1] * R, zb];
    lofts.push(loftWorld(`blade_${k}`, from, to, [0, 0.3, 0.8, 1].map((f) => ({ t: f, points: station(f) })), C.rubber, { interp: 'smooth' }));
  }
  const joints = [{ name: 'rotor', control: 'rotor', kind: 'spin', at: [0, 0, 0], dir: [0, 0, hand], range: [0, 360], angle: round3(((opts.pose && opts.pose.rotor) || 0) % 360) }];
  return { lathes, lofts, hardpoints: { mount: [0, 0, 0] }, joints };
}

function buildGuard(row, C) {
  const { diameter: D, height: h } = row.dims, b = row.build, R = D / 2;
  if (b.family !== 'ring') throw new Error(`Unknown drone-guard family '${b.family}'`);
  const circle = (r, z) => Array.from({ length: 33 }, (_, i) => { const a = (2 * Math.PI * i) / 32; return [r * Math.cos(a), r * Math.sin(a), z]; });
  const sweeps = [sweep('ring_top', circle(R, h), 0.0028, C.paint, { sides: 6 }), sweep('ring_low', circle(R, h * 0.25), 0.0028, C.paint, { sides: 6 })];
  for (let i = 0; i < (b.spokes || 3); i++) {
    const a = (2 * Math.PI * i) / (b.spokes || 3) + Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
    sweeps.push(sweep(`spoke_${i}`, [[c * 0.016, s * 0.016, -0.004], [c * R * 0.6, s * R * 0.6, h * 0.1], [c * R, s * R, h * 0.25]], 0.0032, C.paint, { sides: 6 }));
    sweeps.push(sweep(`post_${i}`, [[c * R, s * R, h * 0.25], [c * R, s * R, h]], 0.0026, C.paint, { sides: 6 }));
  }
  return { sweeps, hardpoints: { mount: [0, 0, 0] } };
}

function buildPayload(row, C) {
  const { width: w, length: l, height: h } = row.dims, b = row.build;
  if (b.family === 'gimbal3') {
    // the yaw motor under its plate, the bracket down the right side to the roll motor, the camera and its lens ahead
    const zc = -h * 0.62, lathes = [
      lathe('yaw', [0, 0, 0], [0, 0, -h * 0.16], [[0, w * 0.26], [1, w * 0.22]], C.trim, { samples: 16 }),
      lathe('roll', [w * 0.38, 0, zc], [w * 0.52, 0, zc], [[0, h * 0.17], [1, h * 0.15]], C.trim, { samples: 16 }),
      lathe('lens', [0, l * 0.28, zc], [0, l * 0.56, zc], [[0, h * 0.2], [0.7, h * 0.19], [1, h * 0.16]], C.rubber, { samples: 18, crossSections: 3 }),
      lathe('glass', [0, l * 0.56, zc], [0, l * 0.565, zc], [[0, h * 0.13], [1, h * 0.13]], C.glass, { material: 'glass', samples: 18 }),
    ];
    const sweeps = [sweep('bracket', [[0, 0, -h * 0.12], [w * 0.45, -l * 0.08, -h * 0.18], [w * 0.45, -l * 0.08, zc]], 0.0028, C.trim, { sides: 6 })];
    // the camera's body: a box with its corners cut
    const cw = w * 0.36, ch = h * 0.22, k = 0.35;
    const extrudes = [extrudeWorld('camera', [0, l * 0.3, zc], [0, -l * 0.32, zc], [[cw, 0, ch * (1 - k)], [cw * (1 - k), 0, ch], [-cw * (1 - k), 0, ch], [-cw, 0, ch * (1 - k)], [-cw, 0, -ch * (1 - k)], [-cw * (1 - k), 0, -ch], [cw * (1 - k), 0, -ch], [cw, 0, -ch * (1 - k)]], C.trim)];
    return { lathes, sweeps, extrudes, hardpoints: { mount: [0, 0, 0] } };
  }
  if (b.family === 'eye') {
    // a starship drone's eye: its ring and its glass dome, looking ahead from under its mount
    const zc = -h * 0.5, lathes = [
      lathe('ring', [0, -l * 0.5, zc], [0, l * 0.25, zc], [[0, w * 0.42], [0.2, w * 0.5], [1, w * 0.5]], C.trim, { samples: 24, crossSections: 3 }),
      lathe('dome', [0, l * 0.25, zc], [0, l * 0.5, zc], [[0, w * 0.4], [0.5, w * 0.34], [1, w * 0.06]], C.glass, { material: 'glass', samples: 24, crossSections: 4 }),
      lathe('iris', [0, l * 0.26, zc], [0, l * 0.3, zc], [[0, w * 0.16], [1, w * 0.12]], C.light, { material: 'neon', samples: 16 }),
    ];
    return { lathes, hardpoints: { mount: [0, 0, 0] } };
  }
  throw new Error(`Unknown drone-payload family '${b.family}'`);
}

function buildMast(row, C) {
  const { diameter: D, height: h } = row.dims, b = row.build;
  if (b.family !== 'gps') throw new Error(`Unknown drone-mast family '${b.family}'`);
  const lathes = [
    lathe('post', [0, 0, 0], [0, 0, h * 0.72], [[0, 0.005], [1, 0.004]], C.trim, { samples: 10 }),
    lathe('puck', [0, 0, h * 0.7], [0, 0, h], [[0, D * 0.46], [0.5, D * 0.5], [1, D * 0.26]], tone(C.paint, 0.08), { samples: 22, crossSections: 3 }),
  ];
  return { lathes, hardpoints: { mount: [0, 0, 0] } };
}

export const DRONE_BUILDERS = {
  'drone-frame': buildFrame,
  'drone-arm': buildArm,
  'drone-motor': buildMotor,
  'drone-rotor': buildRotor,
  'drone-guard': buildGuard,
  'drone-payload': buildPayload,
  'drone-mast': buildMast,
};
