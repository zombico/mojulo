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
import { madeDrone } from './drone-made.js';
import { DEG, lathe, loftWorld, sweep, extrudeWorld, section, facetSection, planeUV, round3, tone } from './craft-common.js';

const r3v = (v) => v.map(round3);
const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
const rotZ = (a, v) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a), v[2]];
const rotY = (a, v) => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];
// a ruggedised body's section: a box with its edges chamfered, CCW from +x
const CHAMFER = [[1, -0.7], [1, 0.7], [0.7, 1], [-0.7, 1], [-1, 0.7], [-1, -0.7], [-0.7, -1], [0.7, -1]];
const circle = (r, z, k = 32) => Array.from({ length: k + 1 }, (_, i) => { const a = (2 * Math.PI * i) / k; return [r * Math.cos(a), r * Math.sin(a), z]; });
// an extrude's ring wound the way the kernel wants it (counter-clockwise in its own plane), from its offsets
const ccw = (from, to, ring) => { const uv = planeUV(from, to, ring), a = uv.reduce((t, p, i) => { const q = uv[(i + 1) % uv.length]; return t + p[0] * q[1] - q[0] * p[1]; }, 0); return a < 0 ? ring.slice().reverse() : ring; };
const NAV = { r: '#2fd36b', l: '#e23b3b', c: '#f4f6f8' };
// a flat rectangle's offsets square to an extrude's axis: w along u, h along v
const rect = (u, v, w, h) => [[0, 1], [1, 1], [1, 0], [0, 0]].map(([a, b]) => [0, 1, 2].map((k) => u[k] * (a - 0.5) * w + v[k] * (b - 0.5) * h));

function buildFrame(row, C) {
  const b = row.build;
  if (b.family === 'plate') return buildPlateStack(row, C);
  if (b.family === 'hub') return buildHub(row, C);
  if (b.family !== 'shell' && b.family !== 'box') throw new Error(`Unknown drone-frame family '${b.family}'`);
  const { length: L, width: W, height: H } = row.dims, box = b.family === 'box';
  // (a shell is moulded round; a box is flat-paneled, its edges chamfered)
  const ring = (w, h) => (box ? facetSection(Math.max((w * W) / 2, 0.002), Math.max((h * H) / 2, 0.002), CHAMFER) : section(Math.max((w * W) / 2, 0.002), Math.max((h * H) / 2, 0.002), b.n || 3, b.belly ?? 1));
  const st = b.stations.map(([s, w, h, zc]) => ({ t: s, points: ring(w, h).map(([x, z]) => [x, 0, zc * H + z]) }));
  const lofts = [loftWorld('shell', [0, L / 2, 0], [0, -L / 2, 0], st, C.paint, box ? {} : { interp: 'smooth', segments: 4 })];
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
    const [, , h] = at(0.38), zb = -((h * H) / 2) * (box ? 1 : (b.belly ?? 1) * 0.985);
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
  return { lofts, extrudes, hardpoints: pointsOf(b) };
}
const pointsOf = (b) => { const h = { mount: [0, 0, 0] }; for (const [name, p] of Object.entries(b.points || {})) h[name] = r3v(p); return h; };

// a racer's carbon plate stack: the bottom plate the arms bolt under, standoffs to the top plate, the boards between,
// the battery strapped on top, the camera tilted up in its cage at the front, the video antenna aft
function buildPlateStack(row, C) {
  const { length: L, width: W, height: H } = row.dims, b = row.build, t = b.plate, t2 = b.top;
  const plateRing = (l, w, k) => [[w / 2, l / 2 - k], [w / 2 - k, l / 2], [-w / 2 + k, l / 2], [-w / 2, l / 2 - k], [-w / 2, -l / 2 + k], [-w / 2 + k, -l / 2], [w / 2 - k, -l / 2], [w / 2, -l / 2 + k]].map(([x, y]) => [x, y, 0]);
  const plate = (id, z0, z1, l, w) => extrudeWorld(id, [0, 0, z0], [0, 0, z1], ccw([0, 0, z0], [0, 0, z1], plateRing(l, w, w * 0.25)), C.paint);
  const extrudes = [plate('plate_bottom', -t, 0, L, W), plate('plate_top', H, H + t2, L * 0.82, W * 0.9)];
  const lathes = [];
  for (const [i, [x, y]] of [[W * 0.36, L * 0.3], [-W * 0.36, L * 0.3], [W * 0.36, -L * 0.3], [-W * 0.36, -L * 0.3]].entries()) lathes.push(lathe(`standoff_${i}`, [x, y, 0], [x, y, H], [[0, 0.0028], [1, 0.0028]], C.chrome, { samples: 8, crossSections: 2 }));
  // the boards between the plates
  const board = (id, z, tint) => extrudeWorld(id, [0, 0, z], [0, 0, z + 0.0016], ccw([0, 0, z], [0, 0, z + 0.0016], plateRing(0.036, 0.036, 0.003)), tint);
  extrudes.push(board('board_esc', H * 0.22, C.trim), board('board_fc', H * 0.6, tone(C.trim, 0.12)));
  // the battery on top, its strap round it
  const [bl, bw, bh] = b.battery, z0 = H + t2, box = (id, c, l, w, h, tint) => extrudeWorld(id, [c[0], c[1] + l / 2, c[2]], [c[0], c[1] - l / 2, c[2]], [[w / 2, 0, 0], [-w / 2, 0, 0], [-w / 2, 0, h], [w / 2, 0, h]], tint);
  extrudes.push(box('battery', [0, -L * 0.05, z0], bl, bw, bh, tone(C.trim, 0.3)), box('strap', [0, -L * 0.05, z0 - 0.0005], 0.016, bw + 0.003, bh + 0.0015, C.rubber));
  // the camera tilted up in its cage, the cage's side plates
  const cy = L / 2 - 0.014, cz = H * 0.5, tilt = (b.camTilt || 30) * DEG, dir = [0, Math.cos(tilt), Math.sin(tilt)];
  for (const sx of [1, -1]) extrudes.push(extrudeWorld(`cage_${sx > 0 ? 'r' : 'l'}`, [sx * 0.012, cy, cz], [sx * 0.0135, cy, cz], [[0, 0.012, -H * 0.5], [0, 0.012, H * 0.5], [0, -0.012, H * 0.5], [0, -0.012, -H * 0.5]], C.paint));
  extrudes.push(box('camera', [0, cy, cz - 0.009], 0.018, 0.019, 0.018, C.trim));
  lathes.push(lathe('lens', [0, cy + 0.009, cz], [0, cy + 0.009 + dir[1] * 0.009, cz + dir[2] * 0.009], [[0, 0.0065], [1, 0.006]], C.trim, { samples: 14, crossSections: 2 }));
  lathes.push(lathe('lens_glass', [0, cy + 0.009 + dir[1] * 0.0085, cz + dir[2] * 0.0085], [0, cy + 0.009 + dir[1] * 0.0105, cz + dir[2] * 0.0105], [[0, 0.005], [1, 0.005]], C.glass, { material: 'glass', samples: 14, crossSections: 2 }));
  // the video antenna, raked aft, its cap
  const ant = [[0, -L / 2 + 0.012, H * 0.6], [0, -L / 2 - 0.006, H + 0.03], [0, -L / 2 - 0.016, H + 0.05]];
  const sweeps = [sweep('antenna', ant, 0.0022, C.trim, { sides: 6 })];
  lathes.push(lathe('antenna_cap', ant[2], [0, ant[2][1] - 0.006, ant[2][2] + 0.012], [[0, 0.006], [1, 0.004]], C.rubber, { samples: 10, crossSections: 2 }));
  return { extrudes, lathes, sweeps, hardpoints: pointsOf(b) };
}

// a heavy lifter's round centre: two plates, the electronics between, the canopy's dome over the top, its lights
function buildHub(row, C) {
  const { diameter: D, height: H } = row.dims, b = row.build, R = D / 2, dome = b.dome || H * 0.6;
  const lathes = [
    lathe('plate_low', [0, 0, 0], [0, 0, 0.006], [[0, R], [1, R]], C.trim, { samples: 24, crossSections: 2 }),
    lathe('core', [0, 0, 0.006], [0, 0, H - 0.006], [[0, R * 0.62], [1, R * 0.62]], tone(C.trim, 0.1), { samples: 18 }),
    lathe('plate_top', [0, 0, H - 0.006], [0, 0, H], [[0, R], [1, R]], C.trim, { samples: 24, crossSections: 2 }),
    lathe('canopy', [0, 0, H], [0, 0, H + dome], [[0, R * 0.9], [0.45, R * 0.8], [0.8, R * 0.52], [1, R * 0.08]], C.paint, { samples: 28, crossSections: 5 }),
  ];
  // the arms' clamps' seats round the rim, between the plates
  const extrudes = [];
  for (const [name, p] of Object.entries(b.points || {})) if (/^arm/.test(name)) {
    const a = Math.atan2(p[1], p[0]), u = [Math.cos(a), Math.sin(a), 0], v = [-Math.sin(a), Math.cos(a), 0];
    for (const sx of [1, -1]) extrudes.push(extrudeWorld(`seat_${name}_${sx > 0 ? 'r' : 'l'}`, [sx * p[0], p[1], 0.006], [sx * p[0], p[1], H - 0.006], ccw([sx * p[0], p[1], 0.006], [sx * p[0], p[1], H - 0.006], rect([sx * u[0], u[1], 0], [sx * v[0], v[1], 0], 0.05, 0.05)), C.paint));
  }
  return { lathes, extrudes, hardpoints: pointsOf(b) };
}

function buildArm(row, C, opts = {}) {
  const b = row.build;
  if (b.family === 'plate') return buildPlateArm(row, C);
  if (b.family === 'tube') return buildTubeArm(row, C, opts);
  const { length: L, width: w, height: h } = row.dims;
  if (b.family !== 'beam') throw new Error(`Unknown drone-arm family '${b.family}'`);
  const rise = b.rise || 0, pad = b.motorPad || 0.016;
  // (folded about the vertical at its root: every point turned by the fold's angle so far)
  const angle = b.fold ? b.fold.angle * clamp01(opts.fold) : 0, A = angle * DEG, P = (v) => rotZ(A, v);
  const sec = (k) => section((w / 2) * k, (h / 2) * k, 3, 1).map(([y, z]) => P([0, y, z]));
  const lofts = [loftWorld('beam', P([0, 0, 0]), P([L - pad * 0.6, 0, rise]), [{ t: 0, points: sec(1) }, { t: 0.6, points: sec(0.9) }, { t: 1, points: sec(0.78) }], C.paint, { interp: 'smooth' })];
  const tip = [L, 0, rise], zPad = rise + h * 0.5 + 0.002, zUnder = rise - h * 0.42;
  const lathes = [
    // the hinge's knuckle at the root, the motor's pad at the tip
    lathe('hinge', P([0.006, 0, -h * 0.7]), P([0.006, 0, h * 0.7]), [[0, h * 0.55], [1, h * 0.55]], C.trim, { samples: 14, crossSections: 2 }),
    lathe('pad', P([tip[0], 0, zUnder]), P([tip[0], 0, zPad]), [[0, pad * 0.7], [0.4, pad], [1, pad * 0.92]], C.paint, { samples: 18, crossSections: 3 }),
  ];
  // a LED under the tip, inboard of the foot
  if (b.led) {
    // (a covert look's LEDs dark: an IR emitter's lens, no light)
    const x = L - pad - 0.004, tint = opts.lights === 'covert' ? C.trim : b.led === 'nav' ? NAV[opts.side || 'c'] : C.light;
    lathes.push(lathe('led', P([x, 0, rise - h * 0.36]), P([x, 0, rise - h * 0.36 - 0.004]), [[0, 0.0045], [1, 0.0035]], tint, { ...(opts.lights === 'covert' ? {} : { material: 'neon' }), samples: 10, crossSections: 2 }));
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

// a racer's flat carbon arm: its outline from the root out round the motor's pad, its motor on top at the tip
function buildPlateArm(row, C) {
  const { length: L, width: w, height: h } = row.dims, pad = row.build.motorPad;
  const ring = [[0, -w / 2, 0], ...Array.from({ length: 11 }, (_, i) => { const a = (-100 + (200 * i) / 10) * DEG; return [L + pad * Math.cos(a), pad * Math.sin(a), 0]; }), [0, w / 2, 0]];
  const extrudes = [extrudeWorld('arm', [0, 0, -h], [0, 0, 0], ccw([0, 0, -h], [0, 0, 0], ring), C.paint)];
  return { extrudes, hardpoints: { mount: [0, 0, 0], motor: [round3(L), 0, 0] } };
}

// a carbon tube arm: the folding clamp at its root, the motor's plate at its tip (and one under it on a coaxial arm), a
// LED under the tip; folding about the vertical, or down about its own horizontal (`fold.axis` 'y')
function buildTubeArm(row, C, opts = {}) {
  const { length: L, diameter: d } = row.dims, b = row.build, pad = b.motorPad, r = d / 2;
  const angle = b.fold ? b.fold.angle * clamp01(opts.fold) : 0, A = angle * DEG, P = (v) => (b.fold?.axis === 'y' ? rotY(A, v) : rotZ(A, v));
  const lathes = [lathe('tube', P([0.02, 0, 0]), P([L - pad * 0.5, 0, 0]), [[0, r], [1, r * 0.92]], C.trim, { samples: 14, crossSections: 2 })];
  const extrudes = [];
  // the clamp at the root: a block round the tube, its hinge pin across
  extrudes.push(extrudeWorld('clamp', P([0, 0, 0]), P([0.07, 0, 0]), ccw(P([0, 0, 0]), P([0.07, 0, 0]), rect(P([0, 1, 0]), P([0, 0, 1]), d * 1.8, d * 1.8)), C.paint));
  lathes.push(lathe('hinge_pin', P([0.035, -d, 0]), P([0.035, d, 0]), [[0, r * 0.45], [1, r * 0.45]], C.chrome, { samples: 10, crossSections: 2 }));
  // the motor's plate on top of the tip, and under it on a coaxial arm
  const plate = (id, z0, z1) => lathe(id, P([L, 0, z0]), P([L, 0, z1]), [[0, pad], [1, pad]], C.paint, { samples: 20, crossSections: 2 });
  lathes.push(plate('pad', -r * 1.1, r + 0.006));
  // (a block holding the tube to the plate)
  extrudes.push(extrudeWorld('tip_block', P([L - pad * 1.4, 0, 0]), P([L - pad * 0.4, 0, 0]), ccw(P([L - pad * 1.4, 0, 0]), P([L - pad * 0.4, 0, 0]), rect(P([0, 1, 0]), P([0, 0, 1]), d * 1.6, d * 1.6)), C.paint));
  const hardpoints = { mount: [0, 0, 0], motor: r3v(P([L, 0, r + 0.006])) };
  if (b.coax) { lathes.push(plate('pad_low', -r - 0.006, -r * 1.1)); hardpoints.motorLow = r3v(P([L, 0, -r - 0.006])); }
  if (b.led) {
    const x = L - pad - 0.012, tint = opts.lights === 'covert' ? C.trim : b.led === 'nav' ? NAV[opts.side || 'c'] : C.light;
    lathes.push(lathe('led', P([x, 0, -r * 0.9]), P([x, 0, -r * 0.9 - 0.006]), [[0, r * 0.5], [1, r * 0.4]], tint, { ...(opts.lights === 'covert' ? {} : { material: 'neon' }), samples: 10, crossSections: 2 }));
  }
  const joints = b.fold ? [{ name: 'fold', control: 'fold', kind: 'hinge', at: [0, 0, 0], dir: b.fold.axis === 'y' ? [0, 1, 0] : [0, 0, 1], range: [0, b.fold.angle], angle: round3(angle) || 0 }] : [];
  return { lathes, extrudes, hardpoints, ...(joints.length ? { joints } : {}), ...(b.fold ? { fold: round3(angle) || 0 } : {}) };
}

function buildMotor(row, C) {
  const { diameter: D, height: h } = row.dims, b = row.build, R = D / 2;
  if (b.family === 'outrunner') {
    const lathes = [
      lathe('base', [0, 0, 0], [0, 0, h * 0.32], [[0, R * 0.92], [1, R * 0.86]], C.trim, { samples: 20, crossSections: 2 }),
      lathe('bell', [0, 0, h * 0.3], [0, 0, h * 0.92], [[0, R], [0.82, R], [1, R * 0.86]], C.trim, { samples: 24, crossSections: 3 }),
      lathe('adapter', [0, 0, h * 0.92], [0, 0, h], [[0, R * 0.42], [1, R * 0.36]], C.chrome, { samples: 16, crossSections: 2 }),
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
      lathe('cowl', [0, 0, h * 0.42], [0, 0, h * 0.25], [[0, R * 0.25], [0.6, R * 0.68], [1, R * 0.8]], C.trim, { samples: 20, crossSections: 3 }),
      lathe('housing', [0, 0, h * 0.25], [0, 0, -h * 0.55], [[0, R * 0.8], [0.2, R], [1, R * 0.9]], C.trim, { samples: 20, crossSections: 4 }),
      lathe('bell', [0, 0, -h * 0.55], [0, 0, -h], [[0, R * 0.72], [1, R * 0.96]], C.chrome, { samples: 20, crossSections: 2 }),
      lathe('glow', [0, 0, -h * 0.9], [0, 0, -h * 0.93], [[0, R * 0.66], [1, R * 0.66]], C.light, { material: 'neon', samples: 16, crossSections: 2 }),
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
  // a folding rotor: the hub's bar across, the blades on pivots at its ends
  const r0 = b.folding ? hub * 2.1 : hub * 0.85;
  const extrudes = [];
  if (b.folding) {
    const a0 = Math.PI / 4 + spin, u = [Math.cos(a0), Math.sin(a0), 0];
    extrudes.push(extrudeWorld('hub_bar', [-u[0] * r0 * 1.05, -u[1] * r0 * 1.05, hubH * 0.55], [u[0] * r0 * 1.05, u[1] * r0 * 1.05, hubH * 0.55], ccw([-u[0] * r0, -u[1] * r0, hubH * 0.55], [u[0] * r0, u[1] * r0, hubH * 0.55], rect([-u[1], u[0], 0], [0, 0, 1], hub * 1.1, hubH * 0.7)), C.trim));
    for (let k = 0; k < b.blades; k++) { const a = a0 + (2 * Math.PI * k) / b.blades, c = [Math.cos(a) * r0 * 0.92, Math.sin(a) * r0 * 0.92]; lathes.push(lathe(`pivot_${k}`, [c[0], c[1], hubH * 0.15], [c[0], c[1], hubH * 1.0], [[0, hub * 0.32], [1, hub * 0.32]], C.chrome, { samples: 10, crossSections: 2 })); }
  }
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
    const from = [rhat[0] * r0, rhat[1] * r0, zb], to = [rhat[0] * R, rhat[1] * R, zb];
    lofts.push(loftWorld(`blade_${k}`, from, to, [0, 0.3, 0.8, 1].map((f) => ({ t: f, points: station(f) })), C.rubber, { interp: 'smooth' }));
  }
  const joints = [{ name: 'rotor', control: 'rotor', kind: 'spin', at: [0, 0, 0], dir: [0, 0, hand], range: [0, 360], angle: round3(((opts.pose && opts.pose.rotor) || 0) % 360) }];
  return { lathes, lofts, ...(extrudes.length ? { extrudes } : {}), hardpoints: { mount: [0, 0, 0] }, joints };
}

function buildGuard(row, C) {
  const { diameter: D, height: h } = row.dims, b = row.build, R = D / 2;
  if (b.family === 'duct') {
    // a duct: its walls (open: the rotor turns inside), its lips rolled round top and bottom, its struts to the motor
    const lathes = [
      lathe('duct_out', [0, 0, -h * 0.4], [0, 0, h * 0.6], [[0, R + 0.012], [0.45, R + 0.02], [1, R + 0.014]], C.paint, { samples: 36, crossSections: 4, caps: false }),
      lathe('duct_in', [0, 0, -h * 0.4], [0, 0, h * 0.6], [[0, R + 0.006], [0.6, R], [1, R + 0.004]], tone(C.paint, -0.15), { samples: 36, crossSections: 3, caps: false }),
    ];
    const sweeps = [sweep('lip_top', circle(R + 0.009, h * 0.6, 36), 0.0055, C.paint, { sides: 6 }), sweep('lip_low', circle(R + 0.009, -h * 0.4, 36), 0.0055, C.paint, { sides: 6 })];
    for (let i = 0; i < (b.struts || 3); i++) { const a = (2 * Math.PI * i) / (b.struts || 3) + Math.PI / 2; sweeps.push(sweep(`strut_${i}`, [[Math.cos(a) * 0.03, Math.sin(a) * 0.03, -h * 0.25], [Math.cos(a) * (R + 0.004), Math.sin(a) * (R + 0.004), -h * 0.25]], 0.006, C.trim, { sides: 6 })); }
    return { lathes, sweeps, hardpoints: { mount: [0, 0, 0] } };
  }
  if (b.family !== 'ring') throw new Error(`Unknown drone-guard family '${b.family}'`);
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
      lathe('yaw', [0, 0, 0], [0, 0, -h * 0.16], [[0, w * 0.26], [1, w * 0.22]], C.trim, { samples: 16, crossSections: 2 }),
      lathe('roll', [w * 0.38, 0, zc], [w * 0.52, 0, zc], [[0, h * 0.17], [1, h * 0.15]], C.trim, { samples: 16, crossSections: 2 }),
      lathe('lens', [0, l * 0.28, zc], [0, l * 0.56, zc], [[0, h * 0.2], [0.7, h * 0.19], [1, h * 0.16]], C.rubber, { samples: 18, crossSections: 3 }),
      lathe('glass', [0, l * 0.56, zc], [0, l * 0.56 + 0.0015, zc], [[0, h * 0.13], [1, h * 0.13]], C.glass, { material: 'glass', samples: 18, crossSections: 2 }),
    ];
    const sweeps = [sweep('bracket', [[0, 0, -h * 0.12], [w * 0.45, -l * 0.08, -h * 0.18], [w * 0.45, -l * 0.08, zc]], 0.0028, C.trim, { sides: 6 })];
    // the camera's body: a box with its corners cut
    const cw = w * 0.36, ch = h * 0.22, k = 0.35;
    const extrudes = [extrudeWorld('camera', [0, l * 0.3, zc], [0, -l * 0.32, zc], [[cw, 0, ch * (1 - k)], [cw * (1 - k), 0, ch], [-cw * (1 - k), 0, ch], [-cw, 0, ch * (1 - k)], [-cw, 0, -ch * (1 - k)], [-cw * (1 - k), 0, -ch], [cw * (1 - k), 0, -ch], [cw, 0, -ch * (1 - k)]], C.trim)];
    return { lathes, sweeps, extrudes, hardpoints: { mount: [0, 0, 0] } };
  }
  if (b.family === 'eoir') {
    // an EO/IR ball: its yaw collar under the mount, the ball, its windows looking ahead (a day camera, a thermal one,
    // a laser's), each a flat glass in a dark bezel
    const D = row.dims.diameter, H = row.dims.height, R = D / 2, zc = -H + R;
    const lathes = [
      lathe('collar', [0, 0, 0], [0, 0, -(H - D) - R * 0.25], [[0, R * 0.62], [1, R * 0.56]], C.trim, { samples: 20, crossSections: 2 }),
      lathe('ball', [0, 0, zc + R], [0, 0, zc - R], Array.from({ length: 9 }, (_, i) => { const t = i / 8, a = Math.PI * t; return [t, Math.max(R * 0.05, R * Math.sin(a))]; }), C.paint, { samples: 24, crossSections: 9 }),
    ];
    const n = b.windows || 2;
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * R * 0.5, z = zc + (i % 2 ? -R * 0.18 : R * 0.12), y = Math.sqrt(Math.max(0, R * R - x * x - (z - zc) ** 2)), r = R * (i === 0 ? 0.26 : 0.18);
      lathes.push(lathe(`bezel_${i}`, [x, y - R * 0.06, z], [x, y + R * 0.02, z], [[0, r * 1.25], [1, r * 1.2]], C.rubber, { samples: 16, crossSections: 2 }));
      lathes.push(lathe(`window_${i}`, [x, y + R * 0.02, z], [x, y + R * 0.02 + Math.max(0.0015, R * 0.02), z], [[0, r], [1, r]], C.glass, { material: 'glass', samples: 16, crossSections: 2 }));
    }
    return { lathes, hardpoints: { mount: [0, 0, 0] } };
  }
  if (b.family === 'eye') {
    // a starship drone's eye: its ring and its glass dome, looking ahead from under its mount
    const zc = -h * 0.5, lathes = [
      lathe('ring', [0, -l * 0.5, zc], [0, l * 0.25, zc], [[0, w * 0.42], [0.2, w * 0.5], [1, w * 0.5]], C.trim, { samples: 24, crossSections: 3 }),
      lathe('dome', [0, l * 0.25, zc], [0, l * 0.5, zc], [[0, w * 0.4], [0.5, w * 0.34], [1, w * 0.06]], C.glass, { material: 'glass', samples: 24, crossSections: 4 }),
      lathe('iris', [0, l * 0.26, zc], [0, l * 0.3, zc], [[0, w * 0.16], [1, w * 0.12]], C.light, { material: 'neon', samples: 16, crossSections: 2 }),
    ];
    return { lathes, hardpoints: { mount: [0, 0, 0] } };
  }
  if (b.family === 'box') {
    // a cargo box hung under its mount: its lid's seam, its latches, the winch's point under it
    const extrudes = [extrudeWorld('box', [0, l / 2, -h], [0, -l / 2, -h], [[w / 2, 0, 0], [-w / 2, 0, 0], [-w / 2, 0, h], [w / 2, 0, h]], C.paint)];
    for (const sx of [1, -1]) extrudes.push(extrudeWorld(`latch_${sx > 0 ? 'r' : 'l'}`, [sx * (w / 2 - 0.001), l * 0.2, -h * 0.2], [sx * (w / 2 + 0.006), l * 0.2, -h * 0.2], rect([0, 1, 0], [0, 0, 1], Math.min(0.04, l * 0.15), Math.min(0.03, h * 0.18)), C.chrome));
    const seam = [[w / 2 + 0.0015, l / 2 + 0.0015], [-w / 2 - 0.0015, l / 2 + 0.0015], [-w / 2 - 0.0015, -l / 2 - 0.0015], [w / 2 + 0.0015, -l / 2 - 0.0015], [w / 2 + 0.0015, l / 2 + 0.0015]].map(([x, y]) => [x, y, -h * 0.16]);
    return { extrudes, sweeps: [sweep('lid_seam', seam, 0.0025, tone(C.paint, -0.35), { sides: 4 })], hardpoints: { mount: [0, 0, 0], winch: [0, 0, round3(-h)] } };
  }
  if (b.family === 'winch') {
    // its drum across, the tether down, the hook
    const D = row.dims.diameter, L2 = row.dims.height;
    const lathes = [lathe('drum', [-D * 0.6, 0, -D * 0.55], [D * 0.6, 0, -D * 0.55], [[0, D * 0.5], [0.15, D * 0.42], [0.85, D * 0.42], [1, D * 0.5]], C.trim, { samples: 16 })];
    const sweeps = [sweep('tether', [[0, 0, -D * 0.9], [0, 0, -L2]], 0.0016, C.rubber, { sides: 5 }), sweep('hook', [[0, 0, -L2], [0, 0, -L2 - 0.03], [0.012, 0, -L2 - 0.042], [0.022, 0, -L2 - 0.03], [0.02, 0, -L2 - 0.02]], 0.004, C.chrome, { sides: 6 })];
    return { lathes, sweeps, hardpoints: { mount: [0, 0, 0] } };
  }
  if (b.family === 'sprayer') {
    // the tank under its mount (its filler cap), the pump under it, the hoses out to a boom across with its nozzles
    const tank = section(w * 0 + l * 0.42, h * 0.5, 3, 1);
    const st = [0, 0.15, 0.85, 1].map((t, i) => ({ t, points: tank.map(([x, z]) => [x * (i === 0 || i === 3 ? 0.86 : 1), 0, z * (i === 0 || i === 3 ? 0.86 : 1) - h * 0.5]) }));
    const lofts = [loftWorld('tank', [0, l / 2, 0], [0, -l / 2, 0], st, tone(C.paint, 0.06), { interp: 'smooth' })];
    const lathes = [
      lathe('filler', [0, l * 0.25, -0.004], [0, l * 0.25, 0.03], [[0, l * 0.1], [1, l * 0.09]], C.light, { samples: 16, crossSections: 2 }),
      lathe('pump', [0, 0, -h], [0, 0, -h - 0.06], [[0, l * 0.16], [1, l * 0.14]], C.trim, { samples: 16, crossSections: 2 }),
      lathe('boom', [-w / 2, -l * 0.1, -h - 0.09], [w / 2, -l * 0.1, -h - 0.09], [[0, 0.011], [1, 0.011]], C.chrome, { samples: 10, crossSections: 2 }),
    ];
    const sweeps = [];
    for (const sx of [1, -1]) sweeps.push(sweep(`hose_${sx > 0 ? 'r' : 'l'}`, [[0, 0, -h - 0.05], [sx * w * 0.12, -l * 0.05, -h - 0.08], [sx * w * 0.25, -l * 0.1, -h - 0.09]], 0.007, C.trim, { sides: 6 }));
    for (let i = 0; i < (b.nozzles || 4); i++) {
      const x = -w / 2 + 0.03 + ((w - 0.06) * i) / Math.max(1, (b.nozzles || 4) - 1);
      lathes.push(lathe(`nozzle_${i}`, [x, -l * 0.1, -h - 0.1], [x, -l * 0.1, -h - 0.135], [[0, 0.009], [0.7, 0.007], [1, 0.004]], C.trim, { samples: 10 }));
    }
    return { lofts, lathes, sweeps, hardpoints: { mount: [0, 0, 0] } };
  }
  if (b.family === 'lidar') {
    // a puck under its mount: its housing, the window band round it, its cap
    const lathes = [
      lathe('mount_plate', [0, 0, 0], [0, 0, -h * 0.12], [[0, w * 0.42], [1, w * 0.42]], C.trim, { samples: 20, crossSections: 2 }),
      lathe('housing', [0, 0, -h * 0.12], [0, 0, -h * 0.45], [[0, w * 0.5], [1, w * 0.5]], C.paint, { samples: 28, crossSections: 2 }),
      lathe('window', [0, 0, -h * 0.45], [0, 0, -h * 0.8], [[0, w * 0.48], [1, w * 0.48]], C.glass, { material: 'glass', samples: 28, crossSections: 2 }),
      lathe('cap', [0, 0, -h * 0.8], [0, 0, -h], [[0, w * 0.5], [0.7, w * 0.48], [1, w * 0.3]], C.paint, { samples: 28, crossSections: 3 }),
    ];
    return { lathes, hardpoints: { mount: [0, 0, 0] } };
  }
  throw new Error(`Unknown drone-payload family '${b.family}'`);
}

function buildMast(row, C) {
  const b = row.build;
  if (b.family === 'paddle') {
    // a flat antenna paddle standing on its hinge
    const { width: w, height: h } = row.dims;
    const lathes = [lathe('hinge', [-0.008, 0, 0.006], [0.008, 0, 0.006], [[0, 0.006], [1, 0.006]], C.trim, { samples: 10, crossSections: 2 })];
    const extrudes = [extrudeWorld('paddle', [-0.004, 0, 0], [0.004, 0, 0], [[0, w / 2, 0.01], [0, w / 2, h * 0.85], [0, w * 0.3, h], [0, -w * 0.3, h], [0, -w / 2, h * 0.85], [0, -w / 2, 0.01]], C.trim)];
    return { lathes, extrudes, hardpoints: { mount: [0, 0, 0] } };
  }
  const { diameter: D, height: h } = row.dims;
  if (b.family !== 'gps') throw new Error(`Unknown drone-mast family '${b.family}'`);
  const lathes = [
    lathe('post', [0, 0, 0], [0, 0, h * 0.72], [[0, 0.005], [1, 0.004]], C.trim, { samples: 10, crossSections: 2 }),
    lathe('puck', [0, 0, h * 0.7], [0, 0, h], [[0, D * 0.46], [0.5, D * 0.5], [1, D * 0.26]], tone(C.paint, 0.08), { samples: 22, crossSections: 3 }),
  ];
  return { lathes, hardpoints: { mount: [0, 0, 0] } };
}

// a skid: two struts from its mount, splaying out and down to a tube along the craft, its ends capped; it stands on
// the tube
function buildGear(row, C) {
  const { height: h, length: l, diameter: d } = row.dims, b = row.build, sx = b.splay || 0, r = d / 2;
  if (b.family !== 'skid') throw new Error(`Unknown drone-gear family '${b.family}'`);
  const sweeps = [-1, 1].map((k) => sweep(`strut_${k > 0 ? 'f' : 'a'}`, [[0, k * l * 0.18, 0], [sx * 0.6, k * l * 0.26, -h * 0.6], [sx, k * l * 0.3, -h + r]], r * 0.85, C.trim, { sides: 8 }));
  const lathes = [
    lathe('tube', [sx, l / 2, -h + r], [sx, -l / 2, -h + r], [[0, r], [1, r]], C.trim, { samples: 12, crossSections: 2 }),
    lathe('cap_f', [sx, l / 2, -h + r], [sx, l / 2 + 0.012, -h + r], [[0, r * 1.05], [1, r * 0.5]], C.rubber, { samples: 12, crossSections: 2 }),
    lathe('cap_a', [sx, -l / 2, -h + r], [sx, -l / 2 - 0.012, -h + r], [[0, r * 1.05], [1, r * 0.5]], C.rubber, { samples: 12, crossSections: 2 }),
  ];
  return { sweeps, lathes, hardpoints: { mount: [0, 0, 0], contact: [round3(sx), 0, round3(-h)] } };
}

// (under the made finish, each part's own fittings laid over its geometry: drone-made.js; absent, the part as it was)
const withMade = (kind, build) => (row, C, opts = {}) => {
  const g = build(row, C, opts), m = madeDrone(kind, row, C, opts);
  if (!m) return g;
  const out = { ...g };
  for (const k of ['lathes', 'sweeps', 'extrudes', 'lofts']) if (m[k]?.length) out[k] = [...(g[k] ?? []), ...m[k]];
  return out;
};

export const DRONE_BUILDERS = {
  'drone-gear': buildGear,
  'drone-frame': withMade('drone-frame', buildFrame),
  'drone-arm': withMade('drone-arm', buildArm),
  'drone-motor': withMade('drone-motor', buildMotor),
  'drone-rotor': withMade('drone-rotor', buildRotor),
  'drone-guard': buildGuard,
  'drone-payload': withMade('drone-payload', buildPayload),
  'drone-mast': buildMast,
};
