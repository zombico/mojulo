/**
 * boat-mil — the builders of the craft shelf's military boat kinds (boat-odm.js), merged into BOAT_BUILDERS: a weapon on
 * its mount and a radar arch, each standing on a hull's point (its mount the middle of its foot, +y the bow). Every
 * weapon is modelled, never fired: it trains and elevates as a pose, and nothing leaves its muzzle. Pure.
 *
 *   boat-mount   pintle   a pedestal from the deck or the sole (`post` high), its socket and its cradle, a generic
 *                         medium machine gun on it (its receiver and feed cover, its barrel in its jacket, its flash hider
 *                         and front sight, its carry handle, the spade grips and their trigger behind), its ammunition can
 *                         on the cradle's left and the belt up to the feed tray. Its `bearing` (degrees from the bow, its
 *                         stock trained aft at 180) and `pose.train` (−1 … 1 of half a turn) turn it about the post;
 *                         `pose.elevate` (−1 … 1 of its `elevation`) tips it about the cradle's pin. Points: `mount`, `grip`
 *                tub      the same gun on its post inside a tub: armour plates in a ring round it, open aft for its gunner
 *                         (`tub`: radius, height, sides); `shield` a plate before the gun, training with it
 *   boat-jet     jet      a waterjet drive through the transom: its flange, the pump's bowl, the nozzle (it steers:
 *                         `pose.yaw`), its rams, the reverse bucket (it drops: `pose.reverse`). Points: `mount`, `nozzle`
 *   boat-cabin   pilothouse  an armoured pilothouse: its walls faceted, its front raked to its windows, the seams along
 *                         its facets, its doors, a searchlight, a mast with its radar, light and whips, a gun ring aft on
 *                         its roof. Points: `mount`, `roofGun`
 *   boat-ramp    ramp     a landing craft's bow ramp hinged across its foot: its plate, stiffeners, edge beams, treads,
 *                         hinge and lip; it lowers (`pose.ramp`). Points: `mount`, `toe`
 *   boat-shaft   shaft    an inboard drive's running gear: the shaft out of the bottom, its strut, a four-bladed
 *                         propeller (`pose.prop`), the rudder on its stock (`pose.yaw`). Points: `mount`, `prop`
 *                cannon   a stabilised naval autocannon: its drum and turntable (it trains), its gun house (it
 *                         elevates), its long barrel, sleeve and brake, its ammunition box and its sight
 *   boat-cabin   bridge   a patrol boat's superstructure: its deckhouse, the bridge raked to a band of windows, its wings
 *                         out to the beam (`wingR`, `wingL`) with their rails and sidelights, the tripod mast on its
 *                         roof with the radar's array and dome, the masthead light and the whips
 *   boat-arch    davit    a davit: its post, head, jib, fall and hook (a layout's `yaw` swings it)
 *   boat-arch    radar    a radar arch: on each side an A-frame of two legs from feet on the sole up to the crossbar, the
 *                         crossbar across, a platform on it with the radar's dome, an all-round light, a light bar facing
 *                         forward, two whip antennas at its ends. Points: `mount`, `top`
 *
 * Craft space: +y forward, +z up, +x starboard, metres.
 */
import { DEG, lathe, sweep, extrudeWorld, loftWorld, planeUV, round3, tone } from './craft-common.js';

const r3v = (v) => v.map(round3);
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const unitV = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number.isFinite(v) ? v : 0));
const ccw = (from, to, ring) => { const uv = planeUV(from, to, ring), a = uv.reduce((t, p, i) => { const q = uv[(i + 1) % uv.length]; return t + p[0] * q[1] - q[0] * p[1]; }, 0); return a < 0 ? ring.slice().reverse() : ring; };
const rect = (u, v, w, h) => [[0, 1], [1, 1], [1, 0], [0, 0]].map(([a, b]) => [0, 1, 2].map((k) => u[k] * (a - 0.5) * w + v[k] * (b - 0.5) * h));
const NAVC = { c: '#f4f6f8' };
// (a weapon's dark steel, its ammunition can's olive drab: the same on any boat, whatever its paint)
const GUNMETAL = '#2e3032', CAN = '#4b5132';

function buildMount(row, C, opts = {}) {
  const b = row.build, pose = opts.pose || {};
  if (b.family === 'cannon') return buildCannon(row, C, opts);
  if (b.family !== 'pintle' && b.family !== 'tub') throw new Error(`Unknown boat-mount family '${b.family}'`);
  const P = b.post, zG = P + 0.12;
  // its train about the post (its bearing and the pose's half-turn either way) and its elevation about the cradle's pin
  const yaw = ((b.bearing ?? 0) + clamp(pose.train, -1, 1) * 180) * DEG, pitch = clamp(pose.elevate, -1, 1) * (b.elevation ?? 30) * DEG;
  const rz = (v) => [v[0] * Math.cos(yaw) - v[1] * Math.sin(yaw), v[0] * Math.sin(yaw) + v[1] * Math.cos(yaw), v[2]];
  const rx = (v) => [v[0], v[1] * Math.cos(pitch) - v[2] * Math.sin(pitch), v[1] * Math.sin(pitch) + v[2] * Math.cos(pitch)];
  const PIN = [0, 0, zG - 0.03];
  // three frames: the post (still), the cradle (it trains), the gun (it trains and elevates)
  const FR = {
    post: { P: (p) => p, D: (v) => v },
    cradle: { P: (p) => rz(p), D: (v) => rz(v) },
    gun: { P: (p) => rz(add(PIN, rx([p[0] - PIN[0], p[1] - PIN[1], p[2] - PIN[2]]))), D: (v) => rz(rx(v)) },
  };
  const out = { lathes: [], extrudes: [], sweeps: [] };
  const L_ = (f, id, a, z, pairs, tint, extra) => out.lathes.push(lathe(id, FR[f].P(a), FR[f].P(z), pairs, tint, extra));
  const E_ = (f, id, a, z, offsets, tint, extra) => { const A = FR[f].P(a), Z = FR[f].P(z), o = offsets.map(FR[f].D); out.extrudes.push(extrudeWorld(id, A, Z, ccw(A, Z, o), tint, extra)); };
  const W_ = (f, id, path, r, tint, extra) => out.sweeps.push(sweep(id, path.map(FR[f].P), r, tint, extra));
  const box = (f, id, c, l, w, h, tint) => E_(f, id, [c[0], c[1] + l / 2, c[2]], [c[0], c[1] - l / 2, c[2]], rect([1, 0, 0], [0, 0, 1], w, h), tint);
  // the pedestal: its foot, its post, its socket
  L_('post', 'foot', [0, 0, -0.004], [0, 0, 0.02], [[0, 0.13], [0.6, 0.12], [1, 0.07]], C.chrome, { samples: 16, crossSections: 3 });
  L_('post', 'post', [0, 0, 0.02], [0, 0, P - 0.06], [[0, 0.05], [1, 0.045]], C.chrome, { samples: 12, crossSections: 2 });
  L_('cradle', 'socket', [0, 0, P - 0.08], [0, 0, P + 0.02], [[0, 0.055], [1, 0.05]], GUNMETAL, { samples: 12, crossSections: 2 });
  // the cradle: a yoke's two cheeks either side of the gun, its pin across
  for (const sx of [1, -1]) E_('cradle', `cheek_${sx > 0 ? 'r' : 'l'}`, [sx * 0.05, 0, 0], [sx * 0.062, 0, 0], [[0, 0.08, P], [0, 0.08, zG], [0, -0.06, zG], [0, -0.06, P]], GUNMETAL);
  L_('cradle', 'pin', [-0.07, 0, zG - 0.03], [0.07, 0, zG - 0.03], [[0, 0.014], [1, 0.014]], C.chrome, { samples: 8, crossSections: 2 });
  // the gun: its receiver, feed cover, barrel in its jacket, flash hider, front sight, carry handle, spade grips
  box('gun', 'receiver', [0, -0.04, zG + 0.02], 0.44, 0.075, 0.12, GUNMETAL);
  box('gun', 'feed_cover', [0, 0.0, zG + 0.095], 0.2, 0.085, 0.03, tone(GUNMETAL, 0.12));
  L_('gun', 'jacket', [0, 0.18, zG + 0.03], [0, 0.48, zG + 0.03], [[0, 0.024], [1, 0.022]], tone(GUNMETAL, 0.06), { samples: 12, crossSections: 2 });
  L_('gun', 'barrel', [0, 0.47, zG + 0.03], [0, 0.78, zG + 0.03], [[0, 0.013], [1, 0.012]], GUNMETAL, { samples: 10, crossSections: 2 });
  L_('gun', 'flash_hider', [0, 0.77, zG + 0.03], [0, 0.85, zG + 0.03], [[0, 0.019], [0.3, 0.021], [1, 0.02]], GUNMETAL, { samples: 10, crossSections: 3 });
  box('gun', 'front_sight', [0, 0.74, zG + 0.06], 0.012, 0.006, 0.05, GUNMETAL);
  W_('gun', 'carry_handle', [[0, 0.24, zG + 0.05], [0, 0.27, zG + 0.11], [0, 0.39, zG + 0.11], [0, 0.42, zG + 0.05]], 0.008, GUNMETAL, { sides: 6 });
  for (const sx of [1, -1]) W_('gun', `grip_${sx > 0 ? 'r' : 'l'}`, [[sx * 0.03, -0.25, zG + 0.03], [sx * 0.07, -0.29, zG + 0.0], [sx * 0.075, -0.31, zG - 0.09]], 0.014, C.rubber, { sides: 8 });
  L_('gun', 'trigger_bar', [-0.07, -0.29, zG - 0.01], [0.07, -0.29, zG - 0.01], [[0, 0.008], [1, 0.008]], C.chrome, { samples: 8, crossSections: 2 });
  // its ammunition can on the cradle's left, the belt up into the feed tray
  box('cradle', 'ammo_can', [-0.105, 0.0, zG - 0.06], 0.28, 0.1, 0.18, CAN);
  W_('gun', 'belt', [[-0.105, 0.0, zG + 0.035], [-0.1, 0.0, zG + 0.08], [-0.04, 0.0, zG + 0.09]], 0.012, tone(CAN, 0.25), { sides: 6 });
  const joints = [
    { name: 'train', control: 'train', kind: 'hinge', at: [0, 0, P], dir: [0, 0, 1], range: [-180, 180], angle: round3((yaw / DEG) - (b.bearing ?? 0)) || 0 },
    { name: 'elevate', control: 'elevate', kind: 'hinge', at: r3v(FR.cradle.P(PIN)), dir: r3v(FR.cradle.D([1, 0, 0])), range: [-(b.elevation ?? 30), b.elevation ?? 30], angle: round3(pitch / DEG) || 0 },
  ];
  // (a shield: a plate before the gun on its cradle, training with it; its sight's notch above the barrel)
  if (b.shield) {
    const sh = b.shield;
    E_('cradle', 'shield', [0, 0.2, 0], [0, 0.22, 0], [[sh.width / 2, 0, P - 0.02], [sh.width / 2, 0, zG + sh.height * 0.6], [0.05, 0, zG + sh.height * 0.6], [0.05, 0, zG + 0.06], [-0.05, 0, zG + 0.06], [-0.05, 0, zG + sh.height * 0.6], [-sh.width / 2, 0, zG + sh.height * 0.6], [-sh.width / 2, 0, P - 0.02]], tone(C.paint, -0.15));
  }
  // (a tub: armour plates round the post in a ring, open aft where its gunner steps in; still, as the boat is)
  if (b.family === 'tub') {
    const T = b.tub, n = T.sides, t = 0.022;
    for (let i = 0; i < n; i += 1) {
      const a0 = (2 * Math.PI * i) / n + Math.PI / n, a1 = (2 * Math.PI * (i + 1)) / n + Math.PI / n, mid = (a0 + a1) / 2;
      // (the plate centred aft is left out: the way in)
      if (Math.abs(Math.sin(mid) + 1) < 0.1) continue;
      // (each plate run a little past its corners, so the ring's plates lap one another)
      const lap = 0.04 / Math.max(0.1, T.radius), e0 = a0 - lap, e1 = a1 + lap;
      const p0 = [T.radius * Math.cos(e0), T.radius * Math.sin(e0), 0], p1 = [T.radius * Math.cos(e1), T.radius * Math.sin(e1), 0], nrm = [Math.cos(mid) * t, Math.sin(mid) * t, 0];
      E_('post', `tub_${i}`, [0, 0, -0.01], [0, 0, T.height], [p0, p1, add(p1, nrm), add(p0, nrm)], C.paint);
    }
    const rim = Array.from({ length: n + 1 }, (_, i) => { const a = (2 * Math.PI * i) / n + Math.PI / n; return [(T.radius + t / 2) * Math.cos(a), (T.radius + t / 2) * Math.sin(a), T.height]; });
    W_('post', 'tub_rim', rim, 0.018, tone(C.paint, -0.12), { sides: 6 });
  }
  return { ...out, hardpoints: { mount: [0, 0, 0], grip: r3v(FR.gun.P([0, -0.31, zG - 0.04])) }, joints };
}

function buildArch(row, C, opts = {}) {
  const b = row.build;
  if (b.family === 'davit') return buildDavit(row, C);
  if (b.family !== 'radar') throw new Error(`Unknown boat-arch family '${b.family}'`);
  const { width: W } = row.dims, H = b.height, x = W / 2, f = b.foot, r = b.radius;
  const lathes = [], sweeps = [], extrudes = [];
  // on each side an A-frame: two legs from their feet fore and aft up to the crossbar's end
  for (const sx of [1, -1]) {
    const top = [sx * (x - 0.05), 0, H];
    for (const [k, y] of [f, -f].entries()) {
      lathes.push(lathe(`foot_${sx > 0 ? 'r' : 'l'}${k}`, [sx * x, y, -0.004], [sx * x, y, 0.015], [[0, 0.07], [1, 0.06]], C.chrome, { samples: 12, crossSections: 2 }));
      sweeps.push(sweep(`leg_${sx > 0 ? 'r' : 'l'}${k}`, [[sx * x, y, 0], [sx * x, y * 0.55, H * 0.6], top], r, C.chrome, { sides: 10 }));
    }
  }
  // the crossbar, the platform on it, the radar's dome, the all-round light, the light bar, the whips
  sweeps.push(sweep('crossbar', [[x - 0.05, 0, H], [-(x - 0.05), 0, H]], r * 1.1, C.chrome, { sides: 10 }));
  const pz = H + r * 1.1;
  extrudes.push(extrudeWorld('platform', [0, 0.2, pz + 0.015], [0, -0.2, pz + 0.015], ccw([0, 0.2, pz + 0.015], [0, -0.2, pz + 0.015], rect([1, 0, 0], [0, 0, 1], W * 0.5, 0.03)), C.paint));
  lathes.push(lathe('radar_pedestal', [0, 0, pz + 0.03], [0, 0, pz + 0.09], [[0, 0.08], [1, 0.07]], C.paint, { samples: 16, crossSections: 2 }));
  lathes.push(lathe('radar_dome', [0, 0, pz + 0.09], [0, 0, pz + 0.32], [[0, 0.27], [0.55, 0.27], [0.85, 0.2], [1, 0.04]], C.paint, { samples: 28, crossSections: 5 }));
  lathes.push(lathe('light_mast', [W * 0.18, -0.08, pz + 0.03], [W * 0.18, -0.08, pz + 0.4], [[0, 0.02], [1, 0.012]], C.chrome, { samples: 8, crossSections: 2 }));
  // (a covert look's lights dark: their lenses unlit)
  const lit = opts.lights === 'covert' ? [C.rubber, {}] : [NAVC.c, { material: 'neon' }];
  lathes.push(lathe('all_round_light', [W * 0.18, -0.08, pz + 0.4], [W * 0.18, -0.08, pz + 0.46], [[0, 0.02], [0.5, 0.022], [1, 0.012]], lit[0], { ...lit[1], samples: 12, crossSections: 3 }));
  extrudes.push(extrudeWorld('light_bar', [0, 0.06, H - 0.07], [0, 0.12, H - 0.07], ccw([0, 0.06, H - 0.07], [0, 0.12, H - 0.07], rect([1, 0, 0], [0, 0, 1], W * 0.45, 0.07)), C.rubber));
  extrudes.push(extrudeWorld('light_bar_lens', [0, 0.118, H - 0.07], [0, 0.126, H - 0.07], ccw([0, 0.118, H - 0.07], [0, 0.126, H - 0.07], rect([1, 0, 0], [0, 0, 1], W * 0.42, 0.045)), lit[0], lit[1]));
  for (const sx of [1, -1]) {
    const base = [sx * (x - 0.12), 0, H + r];
    lathes.push(lathe(`antenna_base_${sx > 0 ? 'r' : 'l'}`, base, add(base, [0, 0, 0.12]), [[0, 0.028], [1, 0.016]], C.chrome, { samples: 10, crossSections: 2 }));
    sweeps.push(sweep(`whip_${sx > 0 ? 'r' : 'l'}`, [add(base, [0, 0, 0.11]), add(base, [sx * 0.02, -0.04, 1.0]), add(base, [sx * 0.05, -0.12, 1.9])], 0.006, C.rubber, { sides: 6 }));
  }
  return { lathes, sweeps, extrudes, hardpoints: { mount: [0, 0, 0], top: [0, 0, round3(pz)] } };
}

// a jockey seat: a straddle seat on its moulded box, its bolster behind, its grab bar across the front
export function buildJockey(row, C) {
  const b = row.build, { width: W, length: D, height: H } = row.dims, s = b.saddle;
  const E = (id, from, to, off, tint) => extrudeWorld(id, from, to, ccw(from, to, off), tint);
  const extrudes = [
    E('box', [0, D / 2, (H - s) / 2], [0, -D / 2, (H - s) / 2], rect([1, 0, 0], [0, 0, 1], W * 0.8, H - s), C.paint),
    // (the saddle: narrow between the knees, wider behind)
    E('saddle', [0, D / 2 - 0.02, H - s / 2], [0, -D / 2 + 0.06, H - s / 2], [[W * 0.32, 0, -s / 2], [W * 0.3, 0, s / 2], [-W * 0.3, 0, s / 2], [-W * 0.32, 0, -s / 2]], C.rubber),
  ];
  const lathes = [lathe('bolster', [-W * 0.32, -D / 2 + 0.05, H + 0.1], [W * 0.32, -D / 2 + 0.05, H + 0.1], [[0, 0.07], [0.15, 0.09], [0.85, 0.09], [1, 0.07]], C.rubber, { samples: 14, crossSections: 4 })];
  const sweeps = [
    sweep('bolster_post', [[0, -D / 2 + 0.08, H - s], [0, -D / 2 + 0.06, H + 0.05]], 0.022, C.chrome, { sides: 8 }),
    sweep('grab_bar', [[W * 0.36, D / 2 - 0.08, H - s], [W * 0.36, D / 2 - 0.02, H + 0.2], [-W * 0.36, D / 2 - 0.02, H + 0.2], [-W * 0.36, D / 2 - 0.08, H - s]], 0.014, C.chrome, { sides: 8 }),
  ];
  return { extrudes, lathes, sweeps, hardpoints: { mount: [0, 0, 0], seat: [0, 0, H] } };
}

// a waterjet drive through the transom: its flange on the transom's face, the pump's bowl aft of it, the nozzle (it steers
// about the vertical: `pose.yaw`, −1 … 1 of its `steer`), its steering rams, the reverse bucket over the nozzle (it drops:
// `pose.reverse`, 0 up … 1 down over the nozzle) and its ram; a pair's port jet the starboard one mirrored, steering with it
function buildJet(row, C, opts = {}) {
  const b = row.build, pose = opts.pose || {};
  if (b.family !== 'jet') throw new Error(`Unknown boat-jet family '${b.family}'`);
  const R = b.bowl, Ln = b.length, steer = clamp(pose.yaw, -1, 1) * b.steer * DEG * (opts.side === 'l' ? -1 : 1), rev = clamp(pose.reverse, 0, 1) * 70 * DEG;
  const SY = -Ln * 0.62, BY = -Ln * 0.82, BZ = R * 1.05;
  const rz = (p) => { const q = [p[0], p[1] - SY, p[2]]; return [q[0] * Math.cos(steer) - q[1] * Math.sin(steer), q[0] * Math.sin(steer) + q[1] * Math.cos(steer) + SY, q[2]]; };
  const rzD = (v) => [v[0] * Math.cos(steer) - v[1] * Math.sin(steer), v[0] * Math.sin(steer) + v[1] * Math.cos(steer), v[2]];
  const rxB = (p) => { const q = [p[0], p[1] - BY, p[2] - BZ]; return rz([q[0], q[1] * Math.cos(rev) + q[2] * Math.sin(rev) + BY, -q[1] * Math.sin(rev) + q[2] * Math.cos(rev) + BZ]); };
  const FR = { still: { P: (p) => p, D: (v) => v }, nozzle: { P: rz, D: rzD }, bucket: { P: rxB, D: (v) => rzD([v[0], v[1] * Math.cos(rev) + v[2] * Math.sin(rev), -v[1] * Math.sin(rev) + v[2] * Math.cos(rev)]) } };
  const out = { lathes: [], extrudes: [], sweeps: [] };
  const L_ = (f, id, a, z, pairs, tint, extra) => out.lathes.push(lathe(id, FR[f].P(a), FR[f].P(z), pairs, tint, extra));
  const E_ = (f, id, a, z, offsets, tint) => { const A = FR[f].P(a), Z = FR[f].P(z), o = offsets.map(FR[f].D); out.extrudes.push(extrudeWorld(id, A, Z, ccw(A, Z, o), tint)); };
  const W_ = (f, id, path, r, tint, extra) => out.sweeps.push(sweep(id, path.map(FR[f].P), r, tint, extra));
  E_('still', 'flange', [0, 0.01, 0], [0, -0.025, 0], rect([1, 0, 0], [0, 0, 1], R * 2.6, R * 2.6), C.chrome);
  L_('still', 'bowl', [0, -0.02, 0], [0, SY + 0.02, 0], [[0, R], [0.5, R * 0.97], [1, R * 0.78]], C.chrome, { samples: 20, crossSections: 4 });
  L_('nozzle', 'nozzle', [0, SY + 0.03, 0], [0, -Ln, 0], [[0, R * 0.8], [0.6, R * 0.66], [1, R * 0.58]], tone(C.chrome, -0.12), { samples: 18, crossSections: 3 });
  for (const sx of [1, -1]) W_('still', `steer_ram_${sx > 0 ? 'r' : 'l'}`, [[sx * R * 1.05, -0.03, R * 0.2], [sx * R * 0.95, SY + 0.05, R * 0.1]], 0.022, C.rubber, { sides: 8 });
  // the reverse bucket: a scoop over the nozzle's end on its pivot, its ram from the bowl's top
  const sc = Array.from({ length: 9 }, (_, i) => { const a = Math.PI * (i / 8); return [R * 0.95 * Math.cos(a), 0, R * 0.95 * Math.sin(a) - R * 0.2]; });
  E_('bucket', 'bucket', [0, BY, BZ - R], [0, -Ln - 0.06, BZ - R], [...sc, ...sc.slice().reverse().map(([x, y, z]) => [x * 0.86, y, z * 0.86])], tone(C.chrome, -0.2));
  L_('nozzle', 'bucket_pivot', [-R * 0.95, BY, BZ - R * 0.35], [R * 0.95, BY, BZ - R * 0.35], [[0, 0.025], [1, 0.025]], C.chrome, { samples: 8, crossSections: 2 });
  W_('still', 'bucket_ram', [[0, -0.04, R * 1.0], [0, BY + 0.06, R * 1.1]], 0.025, C.rubber, { sides: 8 });
  const joints = [
    { name: 'steer', control: 'yaw', kind: 'hinge', at: [0, round3(SY), 0], dir: [0, 0, 1], range: [-b.steer, b.steer], angle: round3(steer / DEG) || 0 },
    { name: 'bucket', control: 'reverse', kind: 'hinge', at: r3v(rz([0, BY, BZ - R * 0.35])), dir: r3v(rzD([1, 0, 0])), range: [0, 70], angle: round3(rev / DEG) || 0 },
  ];
  return { ...out, hardpoints: { mount: [0, 0, 0], nozzle: r3v(rz([0, -Ln, 0])) }, joints };
}

// an armoured pilothouse on the sole: its walls faceted (upright to the shoulder, leaning in above it), its front raked
// to its windows, the plate's seams along its facets; armoured glass, a door each side, a searchlight and a mast on its
// roof, a gun ring aft on it (its `roofGun` point)
function buildPilothouse(row, C, opts = {}) {
  const b = row.build;
  if (b.family === 'bridge') return buildBridge(row, C, opts);
  if (b.family !== 'pilothouse') throw new Error(`Unknown boat-cabin family '${b.family}'`);
  const { width: W, length: D } = row.dims, H = b.height, sh = b.shoulder * H, lean = b.lean, rake = b.rake;
  const sec = (k) => { const h = H * k, w = W / 2, s2 = Math.min(sh, h * 0.9), top = w - lean * Math.min(1, (h - s2) / Math.max(0.01, H - sh)); return [[w, 0, 0], [w, 0, s2], [top, 0, h], [-top, 0, h], [-w, 0, s2], [-w, 0, 0]]; };
  const y0 = -D / 2, y1 = D / 2;
  const lofts = [loftWorld('house', [0, y0, 0], [0, y1, 0], [[0, 1], [1 - rake / D, 1], [1, b.front]].map(([t, k]) => ({ t, points: sec(k) })), C.paint)];
  const extrudes = [], lathes = [], sweeps = [];
  // its windows: on the raked front (the facet from its brow down to its sill), slits along its sides
  const yb = y1 - rake, hf = H * b.front, mid = (k) => [0, yb + (y1 - yb) * k, H + (hf - H) * k];
  const fw = W / 2 - lean - 0.06, fp = (k, x) => add(mid(k), [x, 0, 0]);
  const slope = [0, (y1 - yb), hf - H], sl = Math.hypot(slope[1], slope[2]), su = [0, slope[1] / sl, slope[2] / sl], sn = [0, -su[2], su[1]].map((v) => v * (su[1] > 0 ? 1 : -1));
  const nUp = sn[2] < 0 ? sn.map((v) => -v) : sn;
  for (const [i, x] of [-fw * 0.52, 0, fw * 0.52].entries()) {
    const c = fp(0.5, x);
    extrudes.push(extrudeWorld(`window_front_${i}`, add(c, nUp.map((v) => -v * 0.005)), add(c, nUp.map((v) => v * 0.012)), ccw(add(c, nUp.map((v) => -v * 0.005)), add(c, nUp.map((v) => v * 0.012)), rect([1, 0, 0], su, fw * 0.44, sl * 0.62)), C.glass, { material: 'glass' }));
  }
  for (const sx of [1, -1]) for (const [k, yy] of [0.25, -0.15].entries()) {
    const x = sx * (W / 2 - lean * 0.55), z = sh + (H - sh) * 0.5;
    extrudes.push(extrudeWorld(`window_side_${sx > 0 ? 'r' : 'l'}${k}`, [x - sx * 0.03, yy * D, z], [x + sx * 0.012, yy * D, z], ccw([x - sx * 0.03, yy * D, z], [x + sx * 0.012, yy * D, z], rect([0, 1, 0], [0, 0, 1], D * 0.26, (H - sh) * 0.45)), C.glass, { material: 'glass' }));
  }
  // its doors, a hair proud on each side below the shoulder; their handles
  for (const sx of [1, -1]) {
    extrudes.push(extrudeWorld(`door_${sx > 0 ? 'r' : 'l'}`, [sx * (W / 2 - 0.004), -D * 0.22, sh * 0.5 + 0.02], [sx * (W / 2 + 0.012), -D * 0.22, sh * 0.5 + 0.02], ccw([sx * (W / 2 - 0.004), -D * 0.22, sh * 0.5 + 0.02], [sx * (W / 2 + 0.012), -D * 0.22, sh * 0.5 + 0.02], rect([0, 1, 0], [0, 0, 1], 0.7, sh * 0.9)), tone(C.paint, -0.1)));
    lathes.push(lathe(`door_handle_${sx > 0 ? 'r' : 'l'}`, [sx * (W / 2 + 0.01), -D * 0.22 + 0.25, sh * 0.55], [sx * (W / 2 + 0.05), -D * 0.22 + 0.25, sh * 0.55], [[0, 0.016], [1, 0.016]], C.chrome, { samples: 8, crossSections: 2 }));
  }
  // the plate's seams along its facets: the shoulders, the roof's edges
  for (const sx of [1, -1]) {
    sweeps.push(sweep(`seam_shoulder_${sx > 0 ? 'r' : 'l'}`, [[sx * W / 2, y0 + 0.01, sh], [sx * W / 2, yb, sh], [sx * W / 2, y1 - 0.01, Math.min(sh, hf * 0.9)]], 0.012, tone(C.paint, -0.18), { sides: 6 }));
    sweeps.push(sweep(`seam_roof_${sx > 0 ? 'r' : 'l'}`, [[sx * (W / 2 - lean), y0 + 0.01, H], [sx * (W / 2 - lean), yb, H]], 0.012, tone(C.paint, -0.18), { sides: 6 }));
  }
  // on its roof: the gun ring aft, the searchlight forward, the mast with its radar, its light and its whips
  const G = b.ring, gy = y0 + D * G.at;
  lathes.push(lathe('gun_ring', [0, gy, H - 0.02], [0, gy, H + G.height], [[0, G.radius], [1, G.radius]], tone(C.paint, -0.1), { samples: 24, crossSections: 2 }));
  lathes.push(lathe('searchlight_base', [W * 0.22, yb - 0.1, H - 0.01], [W * 0.22, yb - 0.1, H + 0.12], [[0, 0.06], [1, 0.04]], C.rubber, { samples: 10, crossSections: 2 }));
  lathes.push(lathe('searchlight', [W * 0.22, yb - 0.2, H + 0.2], [W * 0.22, yb + 0.02, H + 0.2], [[0, 0.09], [0.8, 0.11], [1, 0.11]], C.rubber, { samples: 14, crossSections: 3 }));
  const covert = opts.lights === 'covert', lit = covert ? [C.rubber, {}] : [NAVC.c, { material: 'neon' }];
  lathes.push(lathe('searchlight_lens', [W * 0.22, yb + 0.02, H + 0.2], [W * 0.22, yb + 0.03, H + 0.2], [[0, 0.1], [1, 0.1]], lit[0], { ...lit[1], samples: 14, crossSections: 2 }));
  const mp = [-W * 0.25, y0 + D * 0.3, H];
  lathes.push(lathe('mast', add(mp, [0, 0, -0.02]), add(mp, [0, 0, b.mast]), [[0, 0.05], [1, 0.035]], C.chrome, { samples: 10, crossSections: 2 }));
  lathes.push(lathe('radar_dome', add(mp, [0, 0, b.mast]), add(mp, [0, 0, b.mast + 0.22]), [[0, 0.26], [0.55, 0.26], [0.85, 0.19], [1, 0.04]], C.paint, { samples: 26, crossSections: 5 }));
  lathes.push(lathe('all_round_light', add(mp, [0.3, 0, b.mast * 0.6]), add(mp, [0.3, 0, b.mast * 0.6 + 0.06]), [[0, 0.02], [0.5, 0.022], [1, 0.012]], lit[0], { ...lit[1], samples: 12, crossSections: 3 }));
  sweeps.push(sweep('light_arm', [add(mp, [0, 0, b.mast * 0.6 - 0.01]), add(mp, [0.3, 0, b.mast * 0.6 - 0.01])], 0.012, C.chrome, { sides: 6 }));
  for (const sx of [1, -1]) {
    const base = [sx * (W / 2 - lean - 0.1), y0 + 0.15, H];
    lathes.push(lathe(`whip_base_${sx > 0 ? 'r' : 'l'}`, base, add(base, [0, 0, 0.1]), [[0, 0.03], [1, 0.016]], C.chrome, { samples: 10, crossSections: 2 }));
    sweeps.push(sweep(`whip_${sx > 0 ? 'r' : 'l'}`, [add(base, [0, 0, 0.09]), add(base, [sx * 0.02, -0.06, 1.2]), add(base, [sx * 0.05, -0.16, 2.3])], 0.006, C.rubber, { sides: 6 }));
  }
  return { lofts, extrudes, lathes, sweeps, hardpoints: { mount: [0, 0, 0], roofGun: r3v([0, gy, H + G.height - 0.02]) } };
}

// a landing craft's bow ramp, hinged across its foot: its plate (its outer face forward when it is up), the stiffeners
// across its outer face, the edge beams, the treads across its inner face (what a vehicle drives down when it is
// lowered), its hinge's barrels and its lip. It lowers about its hinge (`pose.ramp`, 0 up … 1 down, `drop` degrees).
// Points: `mount` (the hinge's middle), `toe` (its lip: where a vehicle leaves it)
function buildRamp(row, C, opts = {}) {
  const b = row.build, pose = opts.pose || {};
  if (b.family !== 'ramp') throw new Error(`Unknown boat-ramp family '${b.family}'`);
  const { width: W, height: Hr } = row.dims, t = b.thickness, a = clamp(pose.ramp, 0, 1) * b.drop * DEG;
  const P = (p) => [p[0], p[1] * Math.cos(a) + p[2] * Math.sin(a), -p[1] * Math.sin(a) + p[2] * Math.cos(a)];
  const extrudes = [], lathes = [];
  const across = (id, y0, y1, z0, z1, w, tint) => {
    const ring = [[0, y0, z0], [0, y1, z0], [0, y1, z1], [0, y0, z1]].map(P), A = P([-w / 2, 0, 0]), Z = P([w / 2, 0, 0]);
    extrudes.push(extrudeWorld(id, A, Z, ccw(A, Z, ring.map((q, i) => [q[0] - A[0], q[1] - A[1], q[2] - A[2]])), tint));
  };
  across('plate', 0, t, 0, Hr, W, C.paint);
  for (let k = 1; k <= b.stiffeners; k += 1) across(`stiffener_${k}`, t - 0.01, t + 0.09, (Hr * k) / (b.stiffeners + 1) - 0.06, (Hr * k) / (b.stiffeners + 1) + 0.06, W - 0.1, tone(C.paint, -0.08));
  for (const sx of [1, -1]) {
    const A = P([sx * (W / 2 - 0.12), 0, 0]), Z = P([sx * (W / 2 - 0.01), 0, 0]);
    extrudes.push(extrudeWorld(`edge_beam_${sx > 0 ? 'r' : 'l'}`, A, Z, ccw(A, Z, [[0, t - 0.01, 0], [0, t + 0.12, 0], [0, t + 0.12, Hr], [0, t - 0.01, Hr]].map(P).map((q) => [0, q[1] - A[1], q[2] - A[2]])), tone(C.paint, -0.08)));
  }
  for (let k = 0; k < b.treads; k += 1) { const z = 0.25 + ((Hr - 0.4) * k) / Math.max(1, b.treads - 1); across(`tread_${k}`, -0.035, 0.005, z - 0.025, z + 0.025, W - 0.3, tone(C.paint, -0.25)); }
  for (const x of [-W * 0.35, 0, W * 0.35]) lathes.push(lathe(`hinge_${Math.round(x * 10)}`, P([x - 0.25, t / 2, 0]), P([x + 0.25, t / 2, 0]), [[0, 0.12], [1, 0.12]], C.chrome, { samples: 12, crossSections: 2 }));
  lathes.push(lathe('lip', P([-W / 2 + 0.05, t / 2, Hr]), P([W / 2 - 0.05, t / 2, Hr]), [[0, t * 0.55], [1, t * 0.55]], tone(C.paint, -0.12), { samples: 10, crossSections: 2 }));
  const joints = [{ name: 'ramp', control: 'ramp', kind: 'hinge', at: [0, 0, 0], dir: [1, 0, 0], range: [0, b.drop], angle: round3(a / DEG) || 0 }];
  return { extrudes, lathes, hardpoints: { mount: [0, 0, 0], toe: r3v(P([0, t / 2, Hr])) }, joints };
}

// an inboard drive's running gear under the hull: the shaft out of the bottom raked aft and down, its strut, a
// four-bladed propeller on its end (each blade pitched to its helix, handed; `pose.prop` turns it), the rudder aft of it
// on its stock (it steers: `pose.yaw`); a pair's port shaft the starboard one mirrored, its rudder steering with it and
// its propeller counter-rotating. Points: `mount` (where the shaft leaves the bottom), `prop`
function buildShaft(row, C, opts = {}) {
  const b = row.build, pose = opts.pose || {};
  if (b.family !== 'shaft') throw new Error(`Unknown boat-shaft family '${b.family}'`);
  const th = b.rake * DEG, Ls = b.length, R = b.prop.diameter / 2, hand = b.prop.hand === 'lh' ? -1 : 1;
  const steer = clamp(pose.yaw, -1, 1) * b.steer * DEG * (opts.side === 'l' ? -1 : 1), spin = ((Number(pose.prop) || 0) % 360) * DEG * hand;
  const aft = [0, -Math.cos(th), -Math.sin(th)], fwd = aft.map((v) => -v), at = (d) => [0, aft[1] * d, aft[2] * d];
  const P1 = at(Ls), lathes = [], extrudes = [], lofts = [];
  lathes.push(lathe('shaft', [0, 0.3 * Math.cos(th), 0.3 * Math.sin(th) + 0.04], P1, [[0, 0.055], [1, 0.05]], C.chrome, { samples: 12, crossSections: 2 }));
  lathes.push(lathe('stern_tube', [0, 0.05, 0.08], at(0.25), [[0, 0.11], [1, 0.08]], tone(C.paint, -0.15), { samples: 12, crossSections: 2 }));
  // the strut: a blade from the bottom down to its bearing on the shaft, ahead of the propeller
  const sp = at(Ls - 0.35), sb = [0, sp[1], 0.06];
  extrudes.push(extrudeWorld('strut', [-0.025, 0, 0], [0.025, 0, 0], ccw([-0.025, 0, 0], [0.025, 0, 0], [[0, sb[1] + 0.14, sb[2]], [0, sb[1] - 0.12, sb[2]], [0, sp[1] - 0.1, sp[2]], [0, sp[1] + 0.1, sp[2]]]), tone(C.paint, -0.15)));
  lathes.push(lathe('strut_bearing', at(Ls - 0.47), at(Ls - 0.23), [[0, 0.09], [1, 0.09]], tone(C.paint, -0.15), { samples: 12, crossSections: 2 }));
  // the propeller: its hub, its blades about the shaft's axis
  lathes.push(lathe('prop_hub', at(Ls - 0.12), at(Ls + 0.16), [[0, 0.12], [0.6, 0.11], [1, 0.06]], C.chrome, { samples: 16, crossSections: 3 }));
  const e1 = [1, 0, 0], e2 = [0, fwd[2] * e1[0] - fwd[0] * e1[2], fwd[0] * e1[1] - fwd[1] * e1[0]].map((v) => v), hub = at(Ls);
  const e2n = (() => { const c = [aft[1] * e1[2] - aft[2] * e1[1], aft[2] * e1[0] - aft[0] * e1[2], aft[0] * e1[1] - aft[1] * e1[0]], l = Math.hypot(...c) || 1; return c.map((v) => v / l); })();
  void e2;
  const r0 = 0.1, chordAt = (f) => R * (f < 0.5 ? 0.42 + 0.3 * f : 0.57 - 0.5 * (f - 0.5) ** 1.5);
  for (let k = 0; k < b.prop.blades; k += 1) {
    const phi = (2 * Math.PI * k) / b.prop.blades + spin, rhat = e1.map((v, i) => Math.cos(phi) * v + Math.sin(phi) * e2n[i]);
    const tan = [fwd[1] * rhat[2] - fwd[2] * rhat[1], fwd[2] * rhat[0] - fwd[0] * rhat[2], fwd[0] * rhat[1] - fwd[1] * rhat[0]].map((v) => v * hand);
    const station = (f) => {
      const r = r0 + f * (R - r0), beta = Math.atan(b.prop.pitch / (2 * Math.PI * r)), c = chordAt(f), tk = c * (0.1 - 0.06 * f);
      const cd = add(tan.map((v) => v * Math.cos(beta)), fwd.map((v) => v * Math.sin(beta))), nd = add(tan.map((v) => -v * Math.sin(beta)), fwd.map((v) => v * Math.cos(beta)));
      return Array.from({ length: 10 }, (_, i) => { const q = (2 * Math.PI * i) / 10; return add(cd.map((v) => v * (c / 2) * Math.cos(q)), nd.map((v) => v * (tk / 2) * Math.sin(q))); });
    };
    lofts.push(loftWorld(`blade_${k}`, add(hub, rhat.map((v) => v * r0)), add(hub, rhat.map((v) => v * R)), [0, 0.4, 0.8, 1].map((f) => ({ t: f, points: station(f) })), C.chrome, { interp: 'smooth', segments: 3 }));
  }
  // the rudder aft of it on its stock, steering about the stock's vertical
  const ry = P1[1] - R * 0.5 - 0.12, rz0 = 0.06, rz1 = P1[2] - R * 0.95, ch = b.rudder;
  const rot = (p) => { const q = [p[0], p[1] - ry, p[2]]; return [q[0] * Math.cos(steer) - q[1] * Math.sin(steer), q[0] * Math.sin(steer) + q[1] * Math.cos(steer) + ry, q[2]]; };
  const rotD = (v) => [v[0] * Math.cos(steer) - v[1] * Math.sin(steer), v[0] * Math.sin(steer) + v[1] * Math.cos(steer), v[2]];
  const A = rot([-0.03, ry, 0]), Z = rot([0.03, ry, 0]);
  extrudes.push(extrudeWorld('rudder', A, Z, ccw(A, Z, [[0, ch * 0.2, rz0], [0, -ch * 0.8, rz0], [0, -ch * 0.75, rz1], [0, ch * 0.15, rz1]].map((q) => rotD([0, q[1], q[2]])).map((q) => [q[0], q[1], q[2]])), tone(C.paint, -0.15)));
  lathes.push(lathe('rudder_stock', [0, ry, rz1 + 0.05], [0, ry, 0.45], [[0, 0.06], [1, 0.06]], C.chrome, { samples: 10, crossSections: 2 }));
  const joints = [
    { name: 'prop', control: 'prop', kind: 'spin', at: r3v(hub), dir: r3v(fwd.map((v) => v * hand)), range: [0, 360], angle: round3((Number(pose.prop) || 0) % 360) || 0 },
    { name: 'rudder', control: 'yaw', kind: 'hinge', at: [0, round3(ry), 0], dir: [0, 0, 1], range: [-b.steer, b.steer], angle: round3(steer / DEG) || 0 },
  ];
  return { lathes, extrudes, lofts, hardpoints: { mount: [0, 0, 0], prop: r3v(hub) }, joints };
}

// a stabilised naval autocannon on its pedestal: its drum and turntable (it trains: `pose.train`), its gun house on the
// cradle (it elevates: `pose.elevate`), the long barrel with its recoil sleeve and muzzle brake, the ammunition box on its
// left, the sight's head on its right; modelled, never fired. Points: `mount`, `muzzle`
function buildCannon(row, C, opts = {}) {
  const b = row.build, pose = opts.pose || {}, k = b.scale ?? 1;
  const yaw = ((b.bearing ?? 0) + clamp(pose.train, -1, 1) * 180) * DEG, pitch = clamp(pose.elevate, -1, 1) * (b.elevation ?? 40) * DEG;
  const Zt = b.pedestal, PIN = [0, 0, Zt + 0.42 * k];
  const rz = (v) => [v[0] * Math.cos(yaw) - v[1] * Math.sin(yaw), v[0] * Math.sin(yaw) + v[1] * Math.cos(yaw), v[2]];
  const rx = (v) => [v[0], v[1] * Math.cos(pitch) - v[2] * Math.sin(pitch), v[1] * Math.sin(pitch) + v[2] * Math.cos(pitch)];
  const FR = { base: { P: (p) => p, D: (v) => v }, turn: { P: rz, D: rz }, gun: { P: (p) => rz(add(PIN, rx([p[0] - PIN[0], p[1] - PIN[1], p[2] - PIN[2]]))), D: (v) => rz(rx(v)) } };
  const out = { lathes: [], extrudes: [] };
  const L_ = (f, id, a, z, pairs, tint, extra) => out.lathes.push(lathe(id, FR[f].P(a), FR[f].P(z), pairs, tint, extra));
  const box = (f, id, c, l, w, h, tint, extra) => { const A = FR[f].P([c[0], c[1] + l / 2, c[2]]), Z = FR[f].P([c[0], c[1] - l / 2, c[2]]); out.extrudes.push(extrudeWorld(id, A, Z, ccw(A, Z, rect([1, 0, 0], [0, 0, 1], w, h).map(FR[f].D)), tint, extra)); };
  L_('base', 'drum', [0, 0, -0.01], [0, 0, Zt], [[0, 0.6 * k], [1, 0.55 * k]], C.paint, { samples: 24, crossSections: 2 });
  L_('turn', 'turntable', [0, 0, Zt - 0.01], [0, 0, Zt + 0.16 * k], [[0, 0.72 * k], [1, 0.68 * k]], tone(C.paint, -0.08), { samples: 24, crossSections: 2 });
  for (const sx of [1, -1]) box('turn', `trunnion_${sx > 0 ? 'r' : 'l'}`, [sx * 0.42 * k, 0, Zt + 0.3 * k], 0.5 * k, 0.08 * k, 0.32 * k, tone(C.paint, -0.08));
  // the gun house (chamfered fore and aft), its barrel, sleeve and brake, its ammunition box and its sight's head
  const hz = PIN[2], hl = 1.1 * k, hw = 0.7 * k, hh = 0.46 * k;
  const house = [[hw / 2, 0, -hh / 2], [hw / 2, 0, hh / 2 - 0.08 * k], [hw / 2 - 0.08 * k, 0, hh / 2], [-(hw / 2 - 0.08 * k), 0, hh / 2], [-hw / 2, 0, hh / 2 - 0.08 * k], [-hw / 2, 0, -hh / 2]];
  { const A = FR.gun.P([0, hl * 0.42, hz]), Z = FR.gun.P([0, -hl * 0.58, hz]); out.extrudes.push(extrudeWorld('gun_house', A, Z, ccw(A, Z, house.map(FR.gun.D)), C.paint)); }
  L_('gun', 'recoil_sleeve', [0, hl * 0.4, hz + 0.02 * k], [0, hl * 0.4 + 0.55 * k, hz + 0.02 * k], [[0, 0.11 * k], [1, 0.09 * k]], tone(C.paint, -0.1), { samples: 14, crossSections: 2 });
  L_('gun', 'barrel', [0, hl * 0.4 + 0.5 * k, hz + 0.02 * k], [0, hl * 0.4 + b.barrel, hz + 0.02 * k], [[0, 0.055 * k], [1, 0.045 * k]], GUNMETAL, { samples: 12, crossSections: 2 });
  L_('gun', 'muzzle_brake', [0, hl * 0.4 + b.barrel - 0.02, hz + 0.02 * k], [0, hl * 0.4 + b.barrel + 0.2 * k, hz + 0.02 * k], [[0, 0.08 * k], [0.5, 0.085 * k], [1, 0.07 * k]], GUNMETAL, { samples: 12, crossSections: 3 });
  box('gun', 'ammo_box', [-(hw / 2 + 0.16 * k), -0.1 * k, hz - 0.04 * k], 0.7 * k, 0.32 * k, 0.4 * k, tone(C.paint, -0.05));
  box('gun', 'sight_head', [hw / 2 + 0.13 * k, 0.1 * k, hz + 0.26 * k], 0.34 * k, 0.24 * k, 0.26 * k, tone(C.paint, -0.15));
  L_('gun', 'sight_lens', [hw / 2 + 0.13 * k, 0.27 * k, hz + 0.26 * k], [hw / 2 + 0.13 * k, 0.3 * k, hz + 0.26 * k], [[0, 0.08 * k], [1, 0.08 * k]], C.glass, { material: 'glass', samples: 14, crossSections: 2 });
  const joints = [
    { name: 'train', control: 'train', kind: 'hinge', at: [0, 0, Zt], dir: [0, 0, 1], range: [-180, 180], angle: round3((yaw / DEG) - (b.bearing ?? 0)) || 0 },
    { name: 'elevate', control: 'elevate', kind: 'hinge', at: r3v(FR.turn.P(PIN)), dir: r3v(FR.turn.D([1, 0, 0])), range: [-(b.elevation ?? 40), b.elevation ?? 40], angle: round3(pitch / DEG) || 0 },
  ];
  return { ...out, hardpoints: { mount: [0, 0, 0], muzzle: r3v(FR.gun.P([0, hl * 0.4 + b.barrel + 0.2 * k, hz + 0.02 * k])) }, joints };
}

// a patrol boat's superstructure: its deckhouse on the deck (faceted, its doors and portholes), the bridge on it (raked
// to a band of windows round its front and sides), the bridge's wings out to the beam (a heavy gun's point on each, its
// rails, its sidelights), the tripod mast on the bridge's roof (its platform, its yard, the radar's array on its
// pedestal and the dome on its bracket, the masthead light, the whips from its yard's ends). Points: `mount`, `wingR`,
// `wingL`, `roof`
function buildBridge(row, C, opts = {}) {
  const b = row.build, { width: W, length: D } = row.dims, Hd = b.house, Hb = b.bridge.height, Lb = b.bridge.length, Wb = b.bridge.width;
  const lofts = [], extrudes = [], lathes = [], sweeps = [];
  const covert = opts.lights === 'covert', lit = (tint) => (covert ? [C.rubber, {}] : [tint, { material: 'neon' }]);
  // (a faceted section: upright to its shoulder, leaning in above it; at z0, `h` high, `w` wide)
  const sec = (w, h, z0, lean, sh) => [[w / 2, 0, z0], [w / 2, 0, z0 + sh], [w / 2 - lean, 0, z0 + h], [-(w / 2 - lean), 0, z0 + h], [-w / 2, 0, z0 + sh], [-w / 2, 0, z0]];
  lofts.push(loftWorld('deckhouse', [0, -D / 2, 0], [0, D / 2, 0], [0, 1].map((t) => ({ t, points: sec(W, Hd, 0, 0.12, Hd * 0.75) })), C.paint));
  // the bridge on it, at its front, raked from its brow to its sill
  const yB0 = D / 2 - Lb, yB1 = D / 2 + 0.2, rk = b.bridge.rake;
  const bsec = (k) => sec(Wb, Hb * k, Hd - 0.02, 0.35, Hb * 0.25);
  lofts.push(loftWorld('bridge', [0, yB0, 0], [0, yB1, 0], [[0, 1], [1 - rk / (yB1 - yB0), 1], [1, 0.3]].map(([t, k]) => ({ t, points: bsec(k) })), C.paint));
  // its windows: a band of panes on the raked front, three on each leaning side
  const zs = Hd - 0.02 + Hb * 0.3, ze = Hd - 0.02 + Hb, yf = yB1 - rk, slope = unitV([0, yB1 - yf, zs - ze]), nrm = unitV([0, -slope[2], slope[1]].map((v) => v * (slope[1] > 0 ? -1 : 1)));
  const up = nrm[2] < 0 ? nrm.map((v) => -v) : nrm, mid = [0, (yf + yB1) / 2, (ze + zs) / 2], span = Math.hypot(yB1 - yf, ze - zs);
  for (let i = 0; i < 5; i += 1) {
    const x = (i - 2) * (Wb - 0.9) / 5, c = add(mid, [x, 0, 0]), A = add(c, up.map((v) => -v * 0.01)), Z = add(c, up.map((v) => v * 0.02));
    extrudes.push(extrudeWorld(`window_front_${i}`, A, Z, ccw(A, Z, rect([1, 0, 0], slope, (Wb - 0.9) / 5 - 0.08, span * 0.62)), C.glass, { material: 'glass' }));
  }
  for (const sx of [1, -1]) for (let i = 0; i < 3; i += 1) {
    const y = yB0 + 0.5 + i * (yf - yB0 - 0.6) / 3, x = sx * (Wb / 2 - 0.2), z = Hd - 0.02 + Hb * 0.62;
    extrudes.push(extrudeWorld(`window_side_${sx > 0 ? 'r' : 'l'}${i}`, [x - sx * 0.04, y, z], [x + sx * 0.03, y, z], ccw([x - sx * 0.04, y, z], [x + sx * 0.03, y, z], rect([0, 1, 0], [0, 0, 1], (yf - yB0 - 0.6) / 3 - 0.12, Hb * 0.38)), C.glass, { material: 'glass' }));
  }
  // the deckhouse's doors and portholes
  for (const sx of [1, -1]) {
    extrudes.push(extrudeWorld(`door_${sx > 0 ? 'r' : 'l'}`, [sx * (W / 2 - 0.005), -D * 0.1, Hd * 0.42], [sx * (W / 2 + 0.015), -D * 0.1, Hd * 0.42], ccw([sx * (W / 2 - 0.005), -D * 0.1, Hd * 0.42], [sx * (W / 2 + 0.015), -D * 0.1, Hd * 0.42], rect([0, 1, 0], [0, 0, 1], 0.8, Hd * 0.75)), tone(C.paint, -0.1)));
    for (let i = 0; i < 4; i += 1) { const y = -D * 0.42 + i * D * 0.13 + (i > 1 ? D * 0.18 : 0); lathes.push(lathe(`port_${sx > 0 ? 'r' : 'l'}${i}`, [sx * (W / 2 - 0.01), y, Hd * 0.58], [sx * (W / 2 + 0.02), y, Hd * 0.58], [[0, 0.17], [0.4, 0.17], [0.5, 0.13], [1, 0.13]], C.glass, { material: 'glass', samples: 14, crossSections: 3 })); }
  }
  // the bridge's wings out to the beam, their rails, a sidelight at each end
  const wing = b.wing, wy = yB0 + 0.6, wz = Hd - 0.02;
  const hardpoints = { mount: [0, 0, 0], roof: r3v([0, (yB0 + yf) / 2, Hd - 0.02 + Hb]) };
  for (const sx of [1, -1]) {
    const x0 = sx * (Wb / 2 - 0.1), x1 = sx * wing.reach;
    extrudes.push(extrudeWorld(`wing_${sx > 0 ? 'r' : 'l'}`, [x0, wy, wz], [x1, wy, wz], ccw([x0, wy, wz], [x1, wy, wz], [[0, 0.75, -0.06], [0, 0.75, 0.06], [0, -0.75, 0.06], [0, -0.75, -0.06]]), C.paint));
    sweeps.push(sweep(`wing_rail_${sx > 0 ? 'r' : 'l'}`, [[x0, wy + 0.72, wz + 0.06], [x1 - sx * 0.05, wy + 0.72, wz + 1.0], [x1 - sx * 0.05, wy - 0.72, wz + 1.0], [x0, wy - 0.72, wz + 0.06]], 0.025, C.chrome, { sides: 6 }));
    const L = lit(sx > 0 ? '#2fd36b' : '#e23b3b');
    lathes.push(lathe(`sidelight_${sx > 0 ? 'r' : 'l'}`, [x1 - sx * 0.08, wy + 0.6, wz + 1.0], [x1 - sx * 0.08, wy + 0.6, wz + 1.12], [[0, 0.06], [1, 0.05]], L[0], { ...L[1], samples: 12, crossSections: 2 }));
    // (its gun's place near the wing's end, outboard of the bridge's side)
    hardpoints[sx > 0 ? 'wingR' : 'wingL'] = r3v([x1 - sx * 0.35, wy, wz + 0.06]);
  }
  // the tripod mast on the bridge's roof
  const M = b.mast, rz = Hd - 0.02 + Hb, my = yB0 + Lb * 0.35, apex = [0, my - 0.2, rz + M.height];
  for (const [k, [fx, fy]] of [[M.spread, my + M.spread * 0.5], [-M.spread, my + M.spread * 0.5], [0, my - M.spread]].entries()) sweeps.push(sweep(`mast_leg_${k}`, [[fx, fy, rz - 0.02], apex], 0.06, C.paint, { sides: 8 }));
  lathes.push(lathe('mast_platform', add(apex, [0, 0, -0.04]), add(apex, [0, 0, 0.06]), [[0, 0.55], [1, 0.55]], C.paint, { samples: 18, crossSections: 2 }));
  const yard = add(apex, [0, 0, -M.height * 0.28]);
  sweeps.push(sweep('yard', [add(yard, [-M.yard / 2, 0, 0]), add(yard, [M.yard / 2, 0, 0])], 0.04, C.paint, { sides: 8 }));
  lathes.push(lathe('radar_pedestal', add(apex, [0, 0, 0.06]), add(apex, [0, 0, 0.34]), [[0, 0.16], [1, 0.12]], tone(C.paint, -0.1), { samples: 12, crossSections: 2 }));
  extrudes.push(extrudeWorld('radar_array', add(apex, [-M.array / 2, 0, 0.44]), add(apex, [M.array / 2, 0, 0.44]), ccw(add(apex, [-M.array / 2, 0, 0.44]), add(apex, [M.array / 2, 0, 0.44]), [[0, 0.12, -0.1], [0, 0.12, 0.1], [0, -0.05, 0.12], [0, -0.1, -0.1]]), tone(C.paint, 0.12)));
  sweeps.push(sweep('dome_bracket', [add(apex, [0.3, 0, 0]), add(apex, [0.75, -0.2, -0.3])], 0.035, C.paint, { sides: 6 }));
  lathes.push(lathe('dome', add(apex, [0.75, -0.2, -0.3]), add(apex, [0.75, -0.2, 0.05]), [[0, 0.3], [0.55, 0.3], [0.85, 0.22], [1, 0.05]], tone(C.paint, 0.15), { samples: 22, crossSections: 5 }));
  const Lm = lit('#f4f6f8');
  lathes.push(lathe('masthead_light', add(apex, [-0.35, 0, 0.06]), add(apex, [-0.35, 0, 0.18]), [[0, 0.05], [0.5, 0.055], [1, 0.03]], Lm[0], { ...Lm[1], samples: 12, crossSections: 3 }));
  for (const sx of [1, -1]) { const e = add(yard, [sx * M.yard / 2, 0, 0]); sweeps.push(sweep(`whip_${sx > 0 ? 'r' : 'l'}`, [e, add(e, [sx * 0.05, -0.08, 1.4]), add(e, [sx * 0.12, -0.25, 2.8])], 0.008, C.rubber, { sides: 6 })); }
  return { lofts, extrudes, lathes, sweeps, hardpoints };
}

// a davit: its post, its slewing head, its jib out along +x, the fall and its hook; a layout's `yaw` swings it
function buildDavit(row, C) {
  const b = row.build, H = b.height, J = b.reach;
  const lathes = [
    lathe('davit_foot', [0, 0, -0.01], [0, 0, 0.05], [[0, 0.3], [1, 0.25]], C.paint, { samples: 16, crossSections: 2 }),
    lathe('davit_post', [0, 0, 0.05], [0, 0, H], [[0, 0.16], [1, 0.12]], C.paint, { samples: 14, crossSections: 2 }),
    lathe('davit_head', [0, 0, H - 0.05], [0, 0, H + 0.2], [[0, 0.2], [1, 0.18]], tone(C.paint, -0.1), { samples: 14, crossSections: 2 }),
    lathe('hook', [J, 0, H - b.drop - 0.15], [J, 0, H - b.drop], [[0, 0.02], [0.5, 0.06], [1, 0.05]], C.chrome, { samples: 10, crossSections: 3 }),
  ];
  const sweeps = [
    sweep('jib', [[0, 0, H + 0.1], [J * 0.55, 0, H + 0.35], [J, 0, H + 0.2]], 0.09, C.paint, { sides: 10 }),
    sweep('fall', [[J, 0, H + 0.12], [J, 0, H - b.drop]], 0.012, C.rubber, { sides: 6 }),
  ];
  return { lathes, sweeps, hardpoints: { mount: [0, 0, 0], hook: r3v([J, 0, H - b.drop - 0.15]) } };
}

export const MIL_BUILDERS = {
  'boat-ramp': buildRamp,
  'boat-shaft': buildShaft,
  'boat-mount': buildMount,
  'boat-arch': buildArch,
  'boat-jet': buildJet,
  'boat-cabin': buildPilothouse,
};
