/**
 * THE DRONE PARTS' MADE FINISH: what each drone kind adds under the made finish (`made`), as air-made.js does for an
 * aircraft's parts, every piece a fitting (its monomer's group: the skin's seams, a livery and the wear pass it by).
 * Laid over a drone builder's own geometry (drone-parts.js), computed from the same row and turned by the same fold, so
 * a part without the word is built as it always was. Earth drones only: a starship drone's language is its own.
 *
 *   drone-frame    a moulded shell's or a box's parting line round its waist, the screws under its belly, a box's
 *                  accessory rails along its top; a plate stack's screws on its top plate; a hub's ring of screws
 *   drone-arm      its motor's cable run (under a beam or a tube, along a flat arm's top), a tube's clamp bolts
 *   drone-motor    its three wires out toward the arm's root
 *   drone-rotor    the screws in its hub
 *   drone-payload  a gimbal's lens ring and its flex cable
 *
 *   madeDrone(kind, row, C, opts) → monomers ({ lathes?, sweeps? }), or null when the part has none
 *
 * Craft space: +y forward, +z up, +x right, metres. Pure.
 */
import { DEG, lathe, sweep, tone } from './craft-common.js';
import { asFitting } from './air-made.js';

const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
const rotZ = (a, v) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a), v[2]];
const rotY = (a, v) => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];
const WIRE = '#1c1c1e';
// a screw's head: a short lathe along `axis` at `at`
const screw = (id, at, axis, r, tint) => lathe(id, at, at.map((v, k) => v + axis[k] * Math.max(0.0015, r * 0.6)), [[0, r], [1, r * 0.8]], tint, { samples: 8, crossSections: 2 });

function frameMade(row, C) {
  const b = row.build, sweeps = [], lathes = [], screwTint = C.chrome, line = tone(C.paint, -0.35);
  if (b.family === 'shell' || b.family === 'box') {
    const { length: L, width: W, height: H } = row.dims;
    const at = (s) => { let i = 1; while (i < b.stations.length - 1 && s > b.stations[i][0]) i += 1; const [p, q] = [b.stations[i - 1], b.stations[i]], k = (s - p[0]) / (q[0] - p[0] || 1); return p.map((v, j) => v + k * (q[j] - v)); };
    // the parting line round its waist, a hair proud of each side, closed across its nose and tail
    const ss = Array.from({ length: 13 }, (_, i) => 0.03 + (0.94 * i) / 12);
    const side = (sx) => ss.map((s) => { const [, w, , zc] = at(s); return [sx * ((w * W) / 2 + 0.0008), L / 2 - s * L, zc * H]; });
    const ring = [...side(1), ...side(-1).reverse()];
    sweeps.push(sweep('parting_line', [...ring, ring[0]], Math.max(0.0008, H * 0.011), line, { sides: 4 }));
    // the screws under its belly
    const [, , hb] = at(0.5), zb = -((hb * H) / 2) * (b.family === 'box' ? 1 : (b.belly ?? 1)) - 0.0003;
    for (const [i, [sx, sy]] of [[1, 1], [-1, 1], [1, -1], [-1, -1]].entries()) lathes.push(screw(`belly_screw_${i}`, [sx * W * 0.26, sy * L * 0.28, zb], [0, 0, -1], W * 0.022, screwTint));
    // a box's accessory rails along its top
    if (b.family === 'box') for (const sx of [1, -1]) sweeps.push(sweep(`rail_${sx > 0 ? 'r' : 'l'}`, [[sx * W * 0.32, L * 0.28, H / 2 + 0.004], [sx * W * 0.32, -L * 0.3, H / 2 + 0.004]], Math.max(0.003, W * 0.015), C.trim, { sides: 6 }));
  } else if (b.family === 'plate') {
    const { length: L, width: W, height: H } = row.dims, z = H + b.top;
    for (const [i, [x, y]] of [[W * 0.36, L * 0.3], [-W * 0.36, L * 0.3], [W * 0.36, -L * 0.3], [-W * 0.36, -L * 0.3]].entries()) lathes.push(screw(`top_screw_${i}`, [x, y, z], [0, 0, 1], 0.0027, screwTint));
  } else if (b.family === 'hub') {
    const { diameter: D, height: H } = row.dims, R = D / 2;
    for (let i = 0; i < 12; i++) { const a = (2 * Math.PI * i) / 12; lathes.push(screw(`rim_screw_${i}`, [R * 0.86 * Math.cos(a), R * 0.86 * Math.sin(a), H], [0, 0, 1], R * 0.03, screwTint)); }
  }
  return { sweeps, lathes };
}

function armMade(row, C, opts) {
  const b = row.build, sweeps = [], lathes = [];
  const angle = b.fold ? b.fold.angle * clamp01(opts.fold) * DEG : 0, P = (v) => (!angle ? v : b.fold.axis === 'y' ? rotY(angle, v) : rotZ(angle, v));
  if (b.family === 'beam') {
    const { length: L, height: h } = row.dims, rise = b.rise || 0, pad = b.motorPad;
    // the motor's cable under the beam, root to pad
    sweeps.push(sweep('cable', [0.02, 0.5, 1].map((t) => { const x = 0.012 + t * (L - pad * 1.3 - 0.012); return P([x, 0, rise * (x / L) - h * 0.5 * (1 - 0.22 * (x / L)) - 0.001]); }), Math.max(0.0012, h * 0.09), WIRE, { sides: 5 }));
  } else if (b.family === 'tube') {
    const { length: L, diameter: d } = row.dims, r = d / 2, pad = b.motorPad;
    sweeps.push(sweep('cable', [[0.08, 0, -r - 0.002], [(L + 0.08) / 2, 0, -r - 0.003], [L - pad * 1.5, 0, -r - 0.002]].map(P), Math.max(0.0018, r * 0.16), WIRE, { sides: 5 }));
    // the clamp's bolts through its side
    for (const [i, x] of [0.018, 0.052].entries()) lathes.push(lathe(`clamp_bolt_${i}`, P([x, d * 0.9, 0]), P([x, d * 0.9 + Math.max(0.002, d * 0.12), 0]), [[0, d * 0.16], [1, d * 0.14]], C.chrome, { samples: 8, crossSections: 2 }));
  } else if (b.family === 'plate') {
    const { length: L } = row.dims, pad = b.motorPad;
    for (const [i, y] of [-0.003, 0, 0.003].entries()) sweeps.push(sweep(`wire_${i}`, [[0.012, y, 0.001], [L - pad * 1.1, y, 0.001]], 0.0011, i === 1 ? '#a8241c' : WIRE, { sides: 4 }));
  }
  return { sweeps, lathes };
}

function motorMade(row) {
  if (row.build.family !== 'outrunner') return null;
  const { diameter: D, height: h } = row.dims, R = D / 2;
  // its three wires out of its base toward the arm's root (the arm runs from its root along +x: the root is at -x)
  return { sweeps: [-1, 0, 1].map((k) => sweep(`wire_${k + 1}`, [[-R * 0.8, k * R * 0.14, h * 0.12], [-R * 1.25, k * R * 0.12, h * 0.02], [-R * 1.6, k * R * 0.1, -h * 0.05]], Math.max(0.0008, R * 0.045), WIRE, { sides: 4 })) };
}

function rotorMade(row, C, opts) {
  const b = row.build, hub = b.hub, hubH = hub * 0.9, hand = b.hand === 'cw' ? -1 : 1, a = Math.PI / 4 + ((opts.pose && opts.pose.rotor) || 0) * DEG * hand;
  const u = [Math.cos(a + Math.PI / 2), Math.sin(a + Math.PI / 2)];
  return { lathes: [1, -1].map((s) => screw(`hub_screw_${s > 0 ? 'a' : 'b'}`, [s * u[0] * hub * 0.48, s * u[1] * hub * 0.48, hubH], [0, 0, 1], hub * 0.13, C.chrome)) };
}

function payloadMade(row, C) {
  if (row.build.family !== 'gimbal3') return null;
  const { width: w, length: l, height: h } = row.dims, zc = -h * 0.62;
  return {
    lathes: [lathe('lens_ring', [0, l * 0.5, zc], [0, l * 0.53, zc], [[0, h * 0.215], [1, h * 0.205]], tone(C.trim, 0.25), { samples: 18, crossSections: 2 })],
    sweeps: [sweep('flex_cable', [[0, -l * 0.05, -h * 0.16], [-w * 0.1, -l * 0.3, -h * 0.3], [0, -l * 0.33, zc + h * 0.06]], Math.max(0.0012, w * 0.025), WIRE, { sides: 4 })],
  };
}

const MADE = { 'drone-frame': frameMade, 'drone-arm': armMade, 'drone-motor': motorMade, 'drone-rotor': rotorMade, 'drone-payload': payloadMade };

export function madeDrone(kind, row, C, opts = {}) {
  const f = MADE[kind];
  if (!f || !opts.made || row.realm !== 'earth') return null;
  const m = f(row, C, opts);
  return m ? asFitting(m) : null;
}
