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
 *   boat-arch    radar    a radar arch: on each side an A-frame of two legs from feet on the sole up to the crossbar, the
 *                         crossbar across, a platform on it with the radar's dome, an all-round light, a light bar facing
 *                         forward, two whip antennas at its ends. Points: `mount`, `top`
 *
 * Craft space: +y forward, +z up, +x starboard, metres.
 */
import { DEG, lathe, sweep, extrudeWorld, planeUV, round3, tone } from './craft-common.js';

const r3v = (v) => v.map(round3);
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number.isFinite(v) ? v : 0));
const ccw = (from, to, ring) => { const uv = planeUV(from, to, ring), a = uv.reduce((t, p, i) => { const q = uv[(i + 1) % uv.length]; return t + p[0] * q[1] - q[0] * p[1]; }, 0); return a < 0 ? ring.slice().reverse() : ring; };
const rect = (u, v, w, h) => [[0, 1], [1, 1], [1, 0], [0, 0]].map(([a, b]) => [0, 1, 2].map((k) => u[k] * (a - 0.5) * w + v[k] * (b - 0.5) * h));
const NAVC = { c: '#f4f6f8' };
// (a weapon's dark steel, its ammunition can's olive drab: the same on any boat, whatever its paint)
const GUNMETAL = '#2e3032', CAN = '#4b5132';

function buildMount(row, C, opts = {}) {
  const b = row.build, pose = opts.pose || {};
  if (b.family !== 'pintle') throw new Error(`Unknown boat-mount family '${b.family}'`);
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
  return { ...out, hardpoints: { mount: [0, 0, 0], grip: r3v(FR.gun.P([0, -0.31, zG - 0.04])) }, joints };
}

function buildArch(row, C) {
  const b = row.build;
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
  lathes.push(lathe('all_round_light', [W * 0.18, -0.08, pz + 0.4], [W * 0.18, -0.08, pz + 0.46], [[0, 0.02], [0.5, 0.022], [1, 0.012]], NAVC.c, { material: 'neon', samples: 12, crossSections: 3 }));
  extrudes.push(extrudeWorld('light_bar', [0, 0.06, H - 0.07], [0, 0.12, H - 0.07], ccw([0, 0.06, H - 0.07], [0, 0.12, H - 0.07], rect([1, 0, 0], [0, 0, 1], W * 0.45, 0.07)), C.rubber));
  extrudes.push(extrudeWorld('light_bar_lens', [0, 0.118, H - 0.07], [0, 0.126, H - 0.07], ccw([0, 0.118, H - 0.07], [0, 0.126, H - 0.07], rect([1, 0, 0], [0, 0, 1], W * 0.42, 0.045)), NAVC.c, { material: 'neon' }));
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

export const MIL_BUILDERS = {
  'boat-mount': buildMount,
  'boat-arch': buildArch,
};
