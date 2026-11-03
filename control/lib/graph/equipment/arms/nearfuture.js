// equipment/arms/nearfuture — the near line's own models (arms law 9: futuristic, styled real; each inspired by a
// modern design and drawn as a factory would make it):
//   pdw       (smg) a compact top-feeder: the magazine a translucent box lying along the top of the shell, its stack
//             of rounds showing through; a thumbhole behind the grip, a guard that takes the whole hand
//   caseless  (rifle) a monolithic shell over a fully shrouded barrel: a cassette loaded from the top along the bore, a
//             smart sight riding on two posts over it, vent rows down the fore-end, a display by the thumb
//   coilgun   (rifle) a bullpup chassis driving a barrel wound with copper coils you can count, held in a skeleton of
//             rails and bulkheads; a capacitor bank where a magazine would be, its cells and terminals bare, a cable
//             to the coils, a charge display in its rear face
// Generic forms, no make or model. The bore is y = 0 along +z; the shells are side outlines pushed through their widths
// (law 1), moulded (law 9's 1.3× chamfer through chamferOf), parted by their seams.
import { slabC, tube, box, band, r4 } from './geom.js';
import { optic, muzzle, boreDisc, smartSight, display, seam, vents, rail, rod } from './fittings.js';
import { pistolGrip, guardAndTrigger } from './longguns.js';
import { GRIP_RAKE } from './laws.js';
import * as dmath from '../../../util/dmath.js';

const rad = (d) => (d * Math.PI) / 180;
const RAKE = [0, dmath.cos(rad(GRIP_RAKE)), dmath.sin(rad(GRIP_RAKE))];
const push = (c, o) => slabC(o).forEach((e) => c.add('extrudes', e));
const matOf = (role) => (Array.isArray(role) ? { material: role[0], tint: role[1] } : { material: role });
const buttPad = (c, z, yt, yb, hw) => push(c, { ring: [[z, yt], [z - 1.0, yt - 0.1], [z - 1.0, yb + 0.1], [z, yb]], plane: 'side', hw: hw * 1.03, chamfer: 0.2, role: c.R.grip, group: 'buttpad' });

/** The PDW: a compact top-feeder with a translucent magazine along its top. */
export function buildPdw(c) {
  const p = c.parts, g = c.P.girth, hw = 2.2 * g, zN = 12, top = 2.6;
  const zM = -6 + c.barrel * c.P.length;
  push(c, { ring: [[-24, -8.6], [-24, 1.6], [-23, top], [zN - 2.5, top], [zN, 1.0], [zN, -2.5], [4.6, -2.6], [-1.2, -2.8], [-7, -3.6], [-22, -8.4], [-23.4, -8.9]], plane: 'side', hw, chamfer: c.ch(hw * 2), role: c.R.frame, group: 'body' });
  buttPad(c, -24, 1.6, -8.6, hw);
  // the grip, the thumbhole behind it, the guard that takes the hand in front (law 6)
  const G = pistolGrip(c, { zBack: 0, yTop: -2.6, drop: 9.4, depth: 3.9, hw: 1.45 });
  push(c, { ring: band([[-6.4, -3.3], [-6.2, -8.8], [-5.2, -10.8], [G.backAt(G.bottom) + 0.2, G.bottom + 0.5]], 1.1 * g), plane: 'side', hw: hw * 0.82, chamfer: c.ch(hw), role: c.R.frame, group: 'thumbhole' });
  push(c, { ring: band([[zN - 1.4, -2.4], [zN - 1.4, -9.2], [zN - 2.4, -10.4], [G.frontAt(-10.8) + 0.3, -10.8]], 0.75 * g), plane: 'side', hw: hw * 0.55, chamfer: c.ch(hw * 0.6), role: c.R.frame, group: 'guard' });
  push(c, { ring: [[5.2, -2.6], [5.75, -2.6], [5.5, -3.6], [4.9, -4.35], [4.6, -4.25], [5.05, -3.5]], plane: 'side', hw: 0.34, chamfer: 0.08, role: c.R.accent, group: 'trigger' });
  // the magazine: a translucent box along the top, its stack of rounds inside (law 9: a part shows what it does)
  const mt = top + 2.8 * g;
  c.add('extrudes', box({ lo: [-1.25 * g, top + 0.4, -14], hi: [1.25 * g, mt - 0.4, 7], role: c.R.accent, group: 'magazine', chamfer: 0.2 }));
  push(c, { ring: [[-15, top], [8, top], [8, mt - 0.6], [7.2, mt], [-14.2, mt], [-15, mt - 0.6]], plane: 'side', hw: hw * 0.95, chamfer: c.ch(hw * 2), role: c.R.glass, group: 'magazine' });
  c.add('extrudes', box({ lo: [-0.8, top - 0.2, -16.4], hi: [0.8, top + 1.6, -15], role: c.R.furniture, group: 'magazine', chamfer: 0.15 }));
  // the shell's seam and vents, the counter by the thumb (law 9)
  seam(c, { z0: -23, z1: zN - 0.5, y: -0.9, hw });
  vents(c, { z0: zN - 8.5, z1: zN - 2.6, y: 0.4, hw, h: 1.1 });
  display(c, { face: 'left', x: hw, z0: -1.2, z1: 2.6, y0: 0.2, y1: 1.4 });
  // the barrel out of the nose, its device; the sight on the magazine's top
  const rB = 0.78 * g;
  c.add('lathes', tube({ z0: zN - 1, z1: zM, profile: [[0, rB * 1.1], [1, rB]], samples: 16, role: c.R.metal, group: 'barrel' }));
  const front = muzzle(c, p.muzzle, { zM, rB });
  if (p.optic === 'smart') smartSight(c, { z0: -5, yTop: mt, L: 9 });
  else optic(c, p.optic, { z0: -4, z1: 8, yTop: mt, zRear: -12, zFront: 6 });
  if (p.underbarrel === 'light') { const x = hw + 1.1; c.add('lathes', tube({ z0: zN - 9, z1: zN - 0.5, x, y: -0.6, profile: [[0, 0.95], [0.72, 0.95], [0.8, 1.2], [1, 1.2]], samples: 16, role: c.R.furniture, group: 'light' })); }
  return { back: -25, front, fist: G.fist, axis: RAKE, butt: [0, -3.5, -25], top: mt, guardOpening: zN - 1.4 - 0.38 * g - G.frontAt(-6), bottom: G.bottom };
}

/** The caseless rifle: a monolithic shell over a shrouded barrel, its cassette loaded from the top. */
export function buildCaseless(c) {
  const p = c.parts, g = c.P.girth, hw = 2.4 * g, top = 4.4, bot = -4.2;
  const zM = -14 + c.barrel * c.P.length;
  push(c, { ring: [[-36, -9.4], [-36, 3.6], [-34.5, top], [zM - 10, top], [zM - 3, 3.2], [zM, 1.7], [zM, -2.3], [zM - 4, -3.6], [16, bot], [10.8, bot], [2.4, bot - 0.1], [-4, bot - 0.4], [-30, -9.0], [-34.5, -9.8]], plane: 'side', hw, chamfer: c.ch(hw * 2), role: c.R.frame, group: 'body' });
  buttPad(c, -36, 3.6, -9.4, hw);
  const G = pistolGrip(c, { zBack: 3.0, yTop: bot, drop: 9.6, depth: 4.0, hw: 1.4 });
  const guardOpening = guardAndTrigger(c, { zF: 10.6, zB: G.frontAt(bot - 3.0), yTop: bot, yBot: bot - 3.4, zTrig: 8.2 });
  // the cassette along the top, its door's seam and its latch; the sight on two posts over it (law 9)
  const ct = top + 1.15;
  push(c, { ring: [[-19, top - 0.2], [11, top - 0.2], [11, ct - 0.25], [10.5, ct], [-18.5, ct], [-19, ct - 0.25]], plane: 'side', hw: 1.55 * g, chamfer: c.ch(1.5), role: c.R.furniture, group: 'magazine' });
  c.add('extrudes', box({ lo: [-1.6 * g, top - 0.2, -4.1], hi: [1.6 * g, ct + 0.02, -3.98], role: c.R.bore, group: 'magazine' }));
  c.add('extrudes', box({ lo: [-0.7, ct, 9.2], hi: [0.7, ct + 0.35, 10.6], role: c.R.accent, group: 'magazine', chamfer: 0.08 }));
  const postTop = ct + 1.2;
  for (const z of [-11, 4]) c.add('extrudes', box({ lo: [-1.1 * g, top - 0.2, z], hi: [1.1 * g, postTop, z + 1.4], role: c.R.frame, group: 'optic', chamfer: 0.2 }));
  if (p.optic === 'smart') smartSight(c, { z0: -13.5, yTop: postTop, L: 21 });
  else optic(c, p.optic, { z0: -12, z1: 12, yTop: postTop, zRear: -12, zFront: 4 });
  // the fore-end's vent rows, the shell's seams (its parting line, the panel split), the display by the thumb
  vents(c, { z0: 17, z1: zM - 5, y: 1.0, hw, h: 1.3, base: 1.6 });
  vents(c, { z0: 18, z1: zM - 7, y: -1.8, hw, h: 0.8, base: 1.6 });
  seam(c, { z0: -35, z1: zM - 1, y: -0.2, hw });
  c.add('extrudes', box({ lo: [-hw - 0.015, bot + 0.2, 14], hi: [hw + 0.015, top - 0.1, 14.08], role: c.R.bore, group: 'seam' }));
  display(c, { face: 'left', x: hw, z0: 1.0, z1: 5.4, y0: 1.2, y1: 2.8 });
  // the shrouded muzzle: a ring in the nose, the bore's dark; or a can on it
  c.add('lathes', tube({ z0: zM - 0.25, z1: zM + 0.06, y: 0, profile: [[0, 1.15 * g], [1, 1.05 * g]], samples: 18, role: c.R.metal, group: 'muzzle' }));
  let front = zM + 0.06;
  if (p.muzzle === 'plain') boreDisc(c, { z: zM + 0.06, r: 0.5 * g });
  else front = muzzle(c, p.muzzle, { zM: zM + 0.06, rB: 1.0 * g });
  if (p.underbarrel === 'grip') c.add('lathes', tube({ axis: 'y', z0: bot - 7.8, z1: bot + 0.4, x: 0, y: 24, profile: [[0, 1.4], [0.1, 1.55], [0.9, 1.3], [1, 1.5]], samples: 16, role: c.R.grip, group: 'foregrip' }));
  return { back: -37, front, fist: G.fist, axis: RAKE, butt: [0, -3, -37], top: postTop, guardOpening, bottom: G.bottom };
}

/** The coilgun: a bullpup chassis, a barrel wound with copper coils in a skeleton, a capacitor bank for a magazine. */
export function buildCoilgun(c) {
  const p = c.parts, g = c.P.girth, hw = 2.0 * g, top = 3.2;
  const zM = -4 + c.barrel * c.P.length;
  // the chassis: the stock and the action behind the grip, the trigger housing under the coils' start
  push(c, { ring: [[-38, -9.4], [-38, 2.4], [-37, top], [0, top], [2, 2.0], [2, -3.4], [-3.6, -3.6], [-14.5, -4.6], [-16, -4.4], [-34, -8.8], [-35.5, -9.8]], plane: 'side', hw, chamfer: c.ch(hw * 2), role: c.R.frame, group: 'body' });
  buttPad(c, -38, 2.4, -9.4, hw);
  push(c, { ring: [[-1, -1.6], [12.5, -1.6], [12.5, -3.4], [11.8, -4.2], [-1, -4.2]], plane: 'side', hw: hw * 0.9, chamfer: c.ch(hw), role: c.R.furniture, group: 'housing' });
  const G = pistolGrip(c, { zBack: 3.4, yTop: -4.2, drop: 9.4, depth: 3.9, hw: 1.45 });
  push(c, { ring: band([[11.6, -4.1], [11.6, -10.6], [10.6, -11.8], [G.frontAt(-12.2) + 0.3, -12.2]], 0.72 * g), plane: 'side', hw: hw * 0.5, chamfer: c.ch(hw * 0.5), role: c.R.furniture, group: 'guard' });
  push(c, { ring: [[8.8, -4.2], [9.35, -4.2], [9.1, -5.2], [8.5, -5.95], [8.2, -5.85], [8.65, -5.1]], plane: 'side', hw: 0.34, chamfer: 0.08, role: c.R.accent, group: 'trigger' });
  // the capacitor bank where a magazine would hang: its housing, its cells bare on both sides, their terminals
  push(c, { ring: [[-14.2, -3.8], [-4.8, -3.6], [-4.8, -12.2], [-5.6, -13.2], [-13.4, -13.2], [-14.2, -12.4]], plane: 'side', hw: hw * 0.92, chamfer: c.ch(hw), role: c.R.furniture, group: 'capacitor' });
  for (const z of [-12, -9.5, -7]) for (const s of [1, -1]) {
    c.add('lathes', tube({ axis: 'y', z0: -12.3, z1: -4.6, x: s * hw * 0.62, y: z, profile: [[0, 0.95], [0.05, 1.05], [0.95, 1.05], [1, 0.9]], samples: 14, role: c.R.accent, group: 'cells' }));
    c.add('extrudes', box({ lo: [s * hw * 0.62 - 0.35, -4.6, z - 0.35], hi: [s * hw * 0.62 + 0.35, -3.9, z + 0.35], role: c.R.coil, group: 'cells' }));
  }
  display(c, { z: -14.2, x0: -0.9 * g, x1: 0.9 * g, y0: -9.6, y1: -6.8 });
  // the barrel: a core, its coils (copper, countable: law 9), held by four rails and the bulkheads between them
  const rB = 0.7 * g, z0 = 3.5, z1 = zM - 7, rc = 1.95 * g, pc = c.pitch(3.0), n = Math.max(3, Math.floor((z1 - z0) / pc));
  c.add('lathes', tube({ z0: -1, z1: zM, profile: [[0, rB], [1, rB]], samples: 14, role: c.R.metal, group: 'barrel' }));
  for (let i = 0; i < n; i++) {
    const z = z0 + i * ((z1 - z0) / n);
    if (i % 4 === 0) c.add('lathes', tube({ z0: z - 0.1, z1: z + 0.8, profile: [[0, rc + 0.5], [1, rc + 0.5]], samples: 20, role: c.R.frame, group: 'bulkheads' }));
    else c.add('lathes', tube({ z0: z, z1: z + pc * 0.62, profile: [[0, rc * 0.92], [0.12, rc], [0.88, rc], [1, rc * 0.92]], samples: 18, role: c.R.coil, group: 'coils' }));
  }
  const rr = rc + 0.3;
  for (const [x, y] of [[rr, 0], [-rr, 0], [0, rr], [0, -rr]]) c.add('extrudes', box({ lo: [x - 0.28, y - 0.28, 1.8], hi: [x + 0.28, y + 0.28, zM - 5], role: c.R.metal, group: 'rails', chamfer: 0.08 }));
  // the muzzle housing; the cable from the bank to the coils' first bulkhead
  c.add('lathes', tube({ z0: zM - 6, z1: zM, profile: [[0, rc + 0.6], [0.85, rc + 0.6], [1, rc * 0.8]], samples: 22, role: c.R.frame, group: 'muzzle' }));
  boreDisc(c, { z: zM + 0.02, r: rB * 0.8 });
  const front = p.muzzle === 'plain' ? zM : muzzle(c, p.muzzle, { zM, rB: rc * 0.8 });
  const cable = [[1.9, -4.6, -4.8], [2.5, -4.3, -2.6], [2.8, -3.2, 0.4], [2.7, -1.9, 2.6], [2.35, -1.0, 3.6]].map((q) => q.map((v, i) => r4(i === 0 ? v * g : v)));
  c.add('sweeps', { group: 'cable', path: cable, radius: r4(0.3 * g), sides: 8, ...matOf(c.R.grip) });
  // the chassis's rail and sight, its seam and vents (law 9)
  const yTop = rail(c, { z0: -30, z1: -1, yTop: top, hw: 1.05 * g });
  if (p.optic === 'smart') smartSight(c, { z0: -16, yTop, L: 11 });
  else optic(c, p.optic, { z0: -14, z1: 10, yTop, zRear: -26, zFront: -2 });
  seam(c, { z0: -37, z1: 1.5, y: 0.2, hw });
  vents(c, { z0: -31, z1: -19, y: 0.6, hw, h: 1.2 });
  if (p.underbarrel === 'grip') c.add('lathes', tube({ axis: 'y', z0: -rr - 8.2, z1: -rr + 0.2, x: 0, y: z0 + (z1 - z0) * 0.55, profile: [[0, 1.4], [0.1, 1.55], [0.9, 1.3], [1, 1.5]], samples: 16, role: c.R.grip, group: 'foregrip' }));
  if (p.underbarrel === 'bipod') { const zb = zM - 8; for (const s of [1, -1]) rod(c, { from: [s * 1.2, -rr, zb], to: [s * 7.5, -rr - 20, zb + 6], r: 0.55, role: c.R.metal, group: 'bipod' }); }
  return { back: -39, front, fist: G.fist, axis: RAKE, butt: [0, -3.5, -39], top: yTop, guardOpening: 11.6 - 0.36 * g - G.frontAt(-6.5), bottom: -13.2 };
}
