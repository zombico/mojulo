// equipment/arms/handguns — the pistol's models: service (a polymer-framed striker pistol, the default), compact (the
// same, shorter in the slide and the grip), heavy (a steel-framed single-stack with an exposed hammer and a beavertail)
// revolver (a swing-out double action: the frame round a fluted cylinder, a barrel with its underlug and rib) and
// smart (the near line's: a moulded shroud over the slide, its crown recessed, an ammo counter in its rear face).
// Generic forms, no make or model. The bore is y = 0 along +z; the slide and the frame are side outlines pushed
// through their widths (arms law 1), chamfered to their thickness (law 2); the grip rakes back 18° (law 4).
import * as dmath from '../../../util/dmath.js';
import { slab, slabC, tube, box, band } from './geom.js';
import { optic, muzzle, conduit, shellGap, boreDisc, smartSight, display, seam, vents } from './fittings.js';
import { GRIP_RAKE } from './laws.js';

const rad = (d) => (d * Math.PI) / 180;
const RAKE = [0, dmath.cos(rad(GRIP_RAKE)), dmath.sin(rad(GRIP_RAKE))];

/** The self-loading pistols: a slide over a frame. `spec` is the model's row (arms/models.js). */
export function buildPistol(c, spec) {
  const { parts: p, P } = c, g = P.girth, fut = c.line === 'future', near = c.line === 'near';
  const heavy = spec.frame === 'steel', shroud = !!spec.shroud;
  const B = c.barrel, zR = -3.6 * P.length, zM = 3.6 + B * P.length;
  const sH = (heavy ? 2.05 : 2.2) * g, sB = -0.95 * g, sHW = (heavy ? 1.12 : 1.27) * g, fHW = (heavy ? 1.2 : 1.42) * g;
  const gripDrop = (spec.grip ?? 11) * P.length, yB = -gripDrop;
  // the future line's shell is the slide (the frame's finish over the metal's frame): law 7 keeps the stations
  // (law 9) a smart pistol's shroud is moulded over its slide: the frame's finish over the furniture's frame
  const frameRole = heavy || fut ? c.R.metal : shroud ? c.R.furniture : c.R.frame, slideRole = fut || shroud ? c.R.frame : c.R.metal;
  // the slide: its nose bevelled, its rear square (law 1); a shroud squarer, full to its nose
  const slide = shroud ? [[zR, sB], [zR, sH - 0.3], [zR + 0.3, sH], [zM - 0.4, sH], [zM, sH - 0.4], [zM, sB]] : [[zR, sB], [zR, sH - 0.5], [zR + 0.5, sH], [zM - 1.2, sH], [zM, sH - 0.65], [zM, sB]];
  slabC({ ring: slide, plane: 'side', hw: sHW, chamfer: c.ch(sHW * 2), role: slideRole, group: 'slide' }).forEach((e) => c.add('extrudes', e));
  // the frame and its grip, one outline: the dust cover, the front strap behind the guard, the raked grip, the
  // beavertail (law 4: the grip raked back off the bore)
  const k = dmath.tan(rad(GRIP_RAKE));
  const fs = (y) => 1.75 - (-4.4 - y) * k, bs = (y) => -3.7 - (-2.0 - y) * k;
  const frame = [[zR + 0.4, sB], [zM - 0.5, sB], [zM - 0.5, -1.7 * g], [zM - 1.3, -2.35 * g], [2.3, -2.35 * g], [1.75, -4.4], [fs(-5.6) - 0.15, -5.6], [fs(yB + 2) , yB + 2], [fs(yB) + 0.2, yB],
    [bs(yB) - 0.3, yB], [bs(yB + 1.4), yB + 1.4], [bs(-2.0), -2.0], [zR - 0.75, -1.55], [zR - 0.85, -1.1]];
  slabC({ ring: frame, plane: 'side', hw: fHW, chamfer: c.ch(fHW * 2), role: frameRole, group: 'frame' }).forEach((e) => c.add('extrudes', e));
  // the grip's panel: the hand's own response, proud of the frame (law 3)
  const panel = [[fs(-4.9) - 0.35, -4.9], [fs(yB + 1.0) - 0.3, yB + 1.0], [bs(yB + 1.0) + 0.35, yB + 1.0], [bs(-3.0) + 0.35, -3.0], [fs(-3.0) - 1.4, -3.0]];
  slabC({ ring: panel, plane: 'side', hw: fHW + 0.07, chamfer: 0.1, role: c.R.grip, group: 'grip' }).forEach((e) => c.add('extrudes', e));
  // the trigger guard: a band under the dust cover, its opening a finger's (law 6), and the trigger in it
  const gF = Math.min(zM - 1.6, 7.7), gY = -4.95;
  slabC({ ring: band([[gF, -2.3 * g], [gF, gY + 0.7], [gF - 0.6, gY], [2.1, gY], [1.55, gY + 0.35]], 0.55 * g), plane: 'side', hw: 0.72 * g, chamfer: 0.12, role: frameRole, group: 'guard' }).forEach((e) => c.add('extrudes', e));
  slabC({ ring: [[4.3, -2.3], [4.85, -2.3], [4.6, -3.2], [4.0, -3.95], [3.7, -3.85], [4.15, -3.1]], plane: 'side', hw: 0.34, chamfer: 0.08, role: heavy ? c.R.edge : c.R.frame, group: 'trigger' }).forEach((e) => c.add('extrudes', e));
  // the magazine's base plate (or its extension, or the future line's cell)
  const mag = p.magazine;
  const yM = mag === 'extended' ? yB - 2.6 : yB;
  if (mag === 'extended') slabC({ ring: [[bs(yB) + 0.1, yB + 0.2], [fs(yB) - 0.1, yB + 0.2], [fs(yM) + 0.2, yM], [bs(yM) - 0.2, yM]], plane: 'side', hw: fHW * 0.86, chamfer: 0.1, role: c.R.frame, group: 'magazine' }).forEach((e) => c.add('extrudes', e));
  slabC({ ring: [[bs(yM) - 0.35, yM], [fs(yM) + 0.3, yM], [fs(yM - 0.7) + 0.2, yM - 0.7], [bs(yM - 0.7) - 0.25, yM - 0.7]], plane: 'side', hw: fHW * 1.02, chamfer: 0.14, role: mag === 'cell' ? c.R.metal : c.R.accent, group: 'magazine' }).forEach((e) => c.add('extrudes', e));
  if (mag === 'cell' && c.R.glow) c.add('extrudes', box({ lo: [-fHW * 1.06, yM - 0.5, bs(yM) + 0.4], hi: [fHW * 1.06, yM - 0.25, fs(yM) - 0.4], role: c.R.glow, group: 'glow' }));
  // the slide's tertiary detail (law 5): the rear serrations (the future line's vents), the port and the barrel's hood
  const wide = fut || shroud, sw = fut ? 3 : shroud ? 2 : Math.max(3, Math.round(2.6 / c.pitch(0.42)));
  const span = wide ? 2.8 : 2.6, step = span / sw;
  for (let i = 0; i < sw; i++) {
    const z = zR + 0.55 + i * step, w = wide ? step * 0.45 : 0.13;
    for (const s of [1, -1]) c.add('extrudes', box({ lo: [s > 0 ? sHW - 0.01 : -sHW - 0.035, sB + 0.45, z], hi: [s > 0 ? sHW + 0.035 : -sHW + 0.01, sH - 0.45, z + w], role: c.R.bore, group: 'serrations' }));
  }
  if (heavy) for (let i = 0; i < 4; i++) { const z = zM - 4.2 + i * 0.7; for (const s of [1, -1]) c.add('extrudes', box({ lo: [s > 0 ? sHW - 0.01 : -sHW - 0.035, sB + 0.45, z], hi: [s > 0 ? sHW + 0.035 : -sHW + 0.01, sH - 0.45, z + 0.13], role: c.R.bore, group: 'serrations' })); }
  const pz0 = 2.8, pz1 = Math.min(zM - 6.4, 6.6);
  if (shroud) vents(c, { z0: zM - 5.6, z1: zM - 1.0, y: 0.75, hw: sHW, h: 0.55, base: 0.8 });   // the shroud hides its port; it breathes
  else {
    c.add('extrudes', box({ lo: [sHW - 0.01, 0.5, pz0], hi: [sHW + 0.03, sH - 0.25, pz1], role: c.R.bore, group: 'port' }));
    c.add('extrudes', box({ lo: [0.05, sH - 0.02, pz0 + 0.2], hi: [sHW - 0.25, sH + 0.03, pz1 - 0.2], role: c.R.accent, group: 'port' }));
  }
  // the controls (tertiary): the slide stop and the takedown on the left, the magazine catch behind the guard; a steel
  // frame's small parts are bright (a two-tone: law 3's third response)
  const ctl = heavy ? c.R.edge : c.R.accent;
  c.add('extrudes', box({ lo: [-fHW - 0.07, -1.35, 0.6], hi: [-fHW + 0.01, -0.95, 3.4], role: ctl, group: 'controls', chamfer: 0.05 }));
  c.add('extrudes', box({ lo: [-fHW - 0.06, -1.75, 4.9], hi: [-fHW + 0.01, -1.3, 6.2], role: ctl, group: 'controls', chamfer: 0.05 }));
  c.add('extrudes', box({ lo: [-fHW - 0.08, -3.3, 1.55], hi: [-fHW + 0.01, -2.7, 2.25], role: ctl, group: 'controls', chamfer: 0.06 }));
  // the accessory rail's slots under the dust cover, or the heavy frame's plain dust cover
  if (!heavy) for (let i = 0; i < 3; i++) { const z = zM - 5.4 + i * 1.15; if (z > gF + 0.3) c.add('extrudes', box({ lo: [-fHW * 0.86, -2.4 * g, z], hi: [fHW * 0.86, -2.3 * g, z + 0.35], role: c.R.bore, group: 'rail' })); }
  // the heavy frame's hammer and grip safety
  if (heavy) slabC({ ring: [[zR - 0.1, 0.2], [zR + 0.3, 1.2], [zR - 0.6, 2.05], [zR - 1.3, 1.85], [zR - 0.8, 0.6]], plane: 'side', hw: 0.4, chamfer: 0.08, role: c.R.edge, group: 'hammer' }).forEach((e) => c.add('extrudes', e));
  // the barrel's crown in the slide's nose, the bore's dark, and the muzzle device
  const rB = 0.66 * g;
  // (a shroud's crown sits recessed in its nose: the bore's dark in the face)
  const crown = shroud ? zM + 0.01 : zM + 0.08;
  c.add('lathes', tube({ z0: zM - 1.0, z1: crown, profile: [[0, rB], [1, rB]], samples: 16, role: c.R.metal, group: 'barrel' }));
  let front = crown;
  if (p.muzzle === 'plain') boreDisc(c, { z: crown, r: rB * 0.66 });
  else front = muzzle(c, p.muzzle, { zM: crown, rB });
  // the future line (law 7): the shell split from the frame by a dark gap, a lit conduit down the slide
  if (fut) { shellGap(c, { z0: zR + 0.2, z1: zM - 0.3, y: sB, hw: fHW * 0.98, t: 0.24 }); conduit(c, { z0: zR + 3.6, z1: zM - 1.8, y: 0.55, hw: sHW, h: 0.28 }); }
  // the near line (law 9): the slide parted from the frame by its seam, an ammo counter in the slide's rear face
  if (near || shroud) { seam(c, { z0: zR + 0.3, z1: zM - 0.3, y: sB, hw: Math.max(sHW, fHW) }); display(c, { z: zR, x0: -0.55 * g, x1: 0.55 * g, y0: 0.15, y1: 0.95 }); }
  // the sights or an optic on the slide's top line (law 4); a light under the dust cover
  if (p.optic === 'smart') smartSight(c, { z0: zR + 1.4, yTop: sH, L: 4.6, k: 0.6 });
  else optic(c, p.optic, { z0: -1.9, z1: 0, yTop: sH, zRear: zR + 1.2, zFront: zM - 0.8 });
  if (p.optic === 'reddot') optic(c, 'irons', { yTop: sH, zRear: zR + 1.2, zFront: zM - 0.8 });
  if (p.underbarrel === 'light') {
    const yl = -2.35 * g - 1.15, z0 = Math.max(gF + 0.3, zM - 6.6), z1 = zM - 0.6;
    c.add('extrudes', box({ lo: [-0.9, -2.35 * g - 0.5, z0 + 0.6], hi: [0.9, -2.3 * g, z1 - 1.2], role: c.R.frame, group: 'light' }));
    c.add('lathes', tube({ z0, z1, y: yl, profile: [[0, 0.95], [0.75, 0.95], [0.82, 1.2], [1, 1.2]], samples: 16, role: c.R.frame, group: 'light' }));
    c.add('lathes', tube({ z0: z1 - 0.02, z1: z1 + 0.03, y: yl, profile: [[0, 1.0], [1, 1.0]], samples: 16, role: c.R.glass, group: 'light' }));
  }
  const fist = [0, -5.3, (fs(-5.3) + bs(-5.3)) / 2];
  return { back: zR - 0.9, front, fist, axis: RAKE, butt: [0, yM - 0.7, bs(yM)], top: sH, guardOpening: gF - 0.28 * g - fs(-3.6) };
}

/** The revolver: a frame round a fluted cylinder, a barrel with its underlug and rib, a hammer, a rounded grip. */
export function buildRevolver(c) {
  const { parts: p, P } = c, g = P.girth, fut = c.line === 'future';
  const B = c.barrel * P.length, zF = 3.6, zM = zF + B, cy = -1.28, Rc = 1.9 * g, zc0 = -1.95, zc1 = 2.35;
  const hw = 1.45 * g, frame = c.R.metal;
  const push = (o) => slabC(o).forEach((e) => c.add('extrudes', e));
  // the frame in four parts round the cylinder's window: the recoil shield and its hammer, the top strap, the
  // yoke at the front and the strap under it
  push({ ring: [[-4.7, 1.7], [zc0 - 0.05, 2.75], [zc0 - 0.05, cy - Rc - 0.25], [-3.2, -3.6], [-4.7, -2.2]], plane: 'side', hw, chamfer: c.ch(hw * 2), role: frame, group: 'frame' });
  push({ ring: [[zc0 - 0.1, 2.0], [zc1 + 0.1, 2.0], [zc1 + 0.1, 2.75], [zc0 - 0.1, 2.75]], plane: 'side', hw: hw * 0.72, chamfer: c.ch(hw), role: frame, group: 'frame' });
  push({ ring: [[zc1 + 0.05, 2.75], [zF, 2.3], [zF, -1.6], [zc1 + 0.05, cy - Rc - 0.25]], plane: 'side', hw, chamfer: c.ch(hw * 2), role: frame, group: 'frame' });
  push({ ring: [[zc0 - 0.1, cy - Rc - 0.25], [zc1 + 0.1, cy - Rc - 0.25], [zc1 + 0.1, cy - Rc - 0.75], [zc0 - 0.1, cy - Rc - 0.75]], plane: 'side', hw: hw * 0.8, chamfer: 0.14, role: frame, group: 'frame' });
  // the cylinder: fluted (six lobes), its ends chamfered, its six chambers dark in its face (law 5)
  c.add('lathes', tube({ z0: zc0, z1: zc1, y: cy, profile: [[0, Rc * 0.86], [0.07, Rc], [0.93, Rc], [1, Rc * 0.86]], samples: 48, role: c.R.metal, group: 'cylinder', harmonics: [{ n: 6, amplitude: -0.12 * g, phase: Math.PI / 6 }] }));
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 3, x = dmath.cos(a) * 1.28 * g, y = cy + dmath.sin(a) * 1.28 * g;
    c.add('lathes', tube({ z0: zc1 - 0.02, z1: zc1 + 0.025, x, y, profile: [[0, 0.46 * g], [1, 0.46 * g]], samples: 10, role: c.R.bore, group: 'cylinder' }));
  }
  if (fut && c.R.glow) c.add('lathes', tube({ z0: (zc0 + zc1) / 2 - 0.25, z1: (zc0 + zc1) / 2 + 0.25, y: cy, profile: [[0, Rc + 0.03], [1, Rc + 0.03]], samples: 36, role: c.R.glow, group: 'glow' }));
  // the barrel: round, an underlug the length of it, a rib on top carrying the front sight
  const rB = 0.92 * g;
  c.add('lathes', tube({ z0: zF - 0.2, z1: zM, profile: [[0, rB], [1, rB * 0.97]], samples: 20, role: c.R.metal, group: 'barrel' }));
  push({ ring: [[zF - 0.1, -0.35], [zM, -0.35], [zM, -1.55], [zM - 0.55, -2.0], [zF - 0.1, -2.0]], plane: 'side', hw: rB * 0.95, chamfer: c.ch(rB), role: c.R.metal, group: 'barrel' });
  push({ ring: [[zF - 0.1, 0.55], [zM - 0.1, 0.55], [zM - 0.1, 1.25], [zF - 0.1, 1.25]], plane: 'side', hw: 0.5 * g, chamfer: 0.1, role: c.R.metal, group: 'rib' });
  push({ ring: [[zM - 1.6, 1.25], [zM - 0.15, 1.25], [zM - 0.15, 1.95], [zM - 0.7, 1.95]], plane: 'side', hw: 0.22 * g * P.sight, chamfer: 0.05, role: c.R.accent, group: 'sights' });
  if (p.muzzle === 'plain') boreDisc(c, { z: zM, r: rB * 0.48 });
  const front = p.muzzle === 'plain' ? zM : muzzle(c, p.muzzle, { zM, rB });
  // the hammer, the trigger in its guard, the cylinder latch
  push({ ring: [[-4.5, 1.5], [-3.9, 1.75], [-4.7, 3.35], [-5.5, 3.45], [-5.65, 3.0]], plane: 'side', hw: 0.38, chamfer: 0.09, role: c.R.edge, group: 'hammer' });
  push({ ring: band([[2.7, cy - Rc - 0.5], [2.7, -4.9], [2.0, -5.85], [-2.2, -5.8], [-3.3, -4.7]], 0.52 * g), plane: 'side', hw: 0.72 * g, chamfer: 0.12, role: frame, group: 'guard' });
  push({ ring: [[-0.25, -3.6], [0.32, -3.6], [0.12, -4.65], [-0.5, -5.2], [-0.72, -5.0], [-0.28, -4.4]], plane: 'side', hw: 0.34, chamfer: 0.08, role: c.R.edge, group: 'trigger' });
  c.add('extrudes', box({ lo: [-hw - 0.08, 0.6, -3.9], hi: [-hw + 0.01, 1.2, -2.5], role: c.R.edge, group: 'controls', chamfer: 0.06 }));
  // the grip: the hand's own, rounded (a deep chamfer), its heel swept back
  const grip = [[-3.3, -3.4], [-3.55, -6.0], [-4.5, -9.0], [-4.9, -11.4], [-8.3, -11.6], [-8.6, -10.6], [-7.5, -6.6], [-6.1, -3.1], [-4.7, -2.1]];
  push({ ring: grip, plane: 'side', hw: 1.62 * g * P.hand, chamfer: c.ch(1.62 * 2) * 1.6, role: c.R.grip, group: 'grip' });
  optic(c, p.optic === 'irons' ? 'none' : p.optic, { z0: zF + 0.4, z1: zF + 6, yTop: 1.25, zRear: -1.6, zFront: zM - 0.8 });
  c.add('extrudes', box({ lo: [-0.55, 2.75, -1.7], hi: [-0.16, 3.05, -0.9], role: frame, group: 'sights' }));
  c.add('extrudes', box({ lo: [0.16, 2.75, -1.7], hi: [0.55, 3.05, -0.9], role: frame, group: 'sights' }));
  const fist = [0, -7, -5.9];
  return { back: -8.6, front, fist, axis: RAKE, butt: [0, -11.6, -6.6], top: 2.75, guardOpening: 2.7 - 0.26 * g - -3.4 };
}
