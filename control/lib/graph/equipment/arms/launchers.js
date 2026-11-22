// equipment/arms/launchers — the shoulder-fired launchers: the GRENADE LAUNCHER (a 40 mm revolving launcher: a short fat
// barrel over a six-chamber cylinder on its axis, a strap over the cylinder carrying the rail and the sight, a raked
// grip and its guard behind, a stock, a vertical grip forward under the barrel) and the ROCKET LAUNCHER (a bazooka: one
// long tube carried on the shoulder, its sight off its left side). Generic forms, no make or model. The bore
// is y = 0 along +z; every major part a side outline pushed through its width or a lathe along its axis (arms law 1),
// chamfered (law 2), the bore one line with the sight over it (law 4).
import * as dmath from '../../../util/dmath.js';
import { slabC, tube, box } from './geom.js';
import { optic, rail, conduit, seam, display } from './fittings.js';
import { pistolGrip, guardAndTrigger, stock } from './longguns.js';
import { GRIP_RAKE } from './laws.js';

const rad = (d) => (d * Math.PI) / 180;
const RAKE = [0, dmath.cos(rad(GRIP_RAKE)), dmath.sin(rad(GRIP_RAKE))];
const push = (c, o) => slabC(o).forEach((e) => c.add('extrudes', e));

/**
 * The grenade launcher. The cylinder turns on an axis under the bore, its top chamber in line with the barrel: its six
 * chambers' mouths are the dark rounds in its front face, its bands the detail along it. The strap over it ties the
 * frame behind to the breech block round the barrel's root; a bar under it ties them below. → its stations.
 */
function buildGrenade(c) {
  const p = c.parts, g = c.P.girth, fut = c.line === 'future';
  // the bore's radius (a 40 mm round's) and the barrel's; the cylinder's axis under the bore, its radius and its run
  const rBore = 2.0 * g, rB = 2.75 * g, yc = -4.4 * g, rD = 6.4 * g, zD0 = -12, zD1 = 7;
  const zM = 11 + c.barrel * c.P.length;
  const top = rB + 1.1 * g, low = yc - rD - 0.4;
  // the cylinder: a drum with chamfered ends, three bands along it, its chambers' mouths in its front face
  c.add('lathes', tube({ z0: zD0, z1: zD1, y: yc, profile: [[0, rD * 0.9], [0.05, rD], [0.95, rD], [1, rD * 0.9]], samples: 30, role: c.R.metal, group: 'cylinder' }));
  for (const t of [0.2, 0.5, 0.8]) { const z = zD0 + (zD1 - zD0) * t; c.add('lathes', tube({ z0: z - 0.45, z1: z + 0.45, y: yc, profile: [[0, rD + 0.12], [1, rD + 0.12]], samples: 30, role: c.R.accent, group: 'cylinder' })); }
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3, x = dmath.sin(a) * -yc, y = yc + dmath.cos(a) * -yc;
    c.add('lathes', tube({ z0: zD1 - 0.02, z1: zD1 + 0.2, x, y, profile: [[0, rBore * 1.18], [1, rBore * 1.18]], samples: 16, role: c.R.accent, group: 'cylinder' }));
    c.add('lathes', tube({ z0: zD1 + 0.18, z1: zD1 + 0.24, x, y, profile: [[0, rBore], [1, rBore]], samples: 16, role: c.R.bore, group: 'bore' }));
  }
  // the frame behind the cylinder, down to the grip; the strap over the cylinder; the bar under it; the breech block
  const fhw = 2.3 * g;
  push(c, { ring: [[zD0 - 5.5, top], [zD0 - 0.2, top], [zD0 - 0.2, low], [zD0 - 4.2, low - 1.4], [zD0 - 5.5, low + 1.2]], plane: 'side', hw: fhw, chamfer: c.ch(fhw * 2), role: c.R.frame, group: 'frame' });
  push(c, { ring: [[zD0 - 0.5, top + 0.2], [zD1 + 4.5, top + 0.2], [zD1 + 4.5, top - 1.6], [zD0 - 0.5, top - 1.6]], plane: 'side', hw: 1.7 * g, chamfer: c.ch(1.6), role: c.R.frame, group: 'frame' });
  push(c, { ring: [[zD0 - 0.5, low], [zD1 + 4.2, low], [zD1 + 4.2, low - 1.4], [zD0 - 0.5, low - 1.4]], plane: 'side', hw: 1.5 * g, chamfer: c.ch(1.4), role: c.R.frame, group: 'frame' });
  push(c, { ring: [[zD1 + 0.3, top], [zD1 + 4.5, top], [zD1 + 4.5, -rB - 0.6], [zD1 + 3.4, low], [zD1 + 1.6, low], [zD1 + 0.3, -rB - 0.6]], plane: 'side', hw: rB + 0.5, chamfer: c.ch(rB), role: c.R.metal, group: 'breech' });
  // the axis's cap in the breech block's front, under the barrel
  c.add('lathes', tube({ z0: zD1 + 4.4, z1: zD1 + 5.0, y: yc, profile: [[0, 1.1 * g], [1, 0.9 * g]], samples: 14, role: c.R.accent, group: 'breech' }));
  if (fut) { conduit(c, { z0: zD0 - 0.3, z1: zD1 + 4, y: top - 0.8, hw: 1.7 * g }); }
  if (c.line === 'near') { seam(c, { z0: zD0 - 5.3, z1: zD0 - 0.4, y: top - 3.2, hw: fhw * 1.01 }); display(c, { face: 'left', x: fhw, z0: zD0 - 4.6, z1: zD0 - 1.4, y0: top - 2.6, y1: top - 1.4 }); }
  // the barrel: a fat tube out of the breech block, a band at its front, the dark of the bore in its crown
  c.add('lathes', tube({ z0: zD1 + 4.4, z1: zM, profile: [[0, rB * 1.04], [0.1, rB], [0.85, rB], [0.9, rB * 1.1], [1, rB * 1.1]], samples: 24, role: c.R.metal, group: 'barrel' }));
  c.add('lathes', tube({ z0: zM - 0.05, z1: zM + 0.03, profile: [[0, rBore], [1, rBore]], samples: 18, role: c.R.bore, group: 'bore' }));
  // the grip raked back under the frame, its guard and trigger forward of it
  const yG = low - 0.2, G = pistolGrip(c, { zBack: zD0 - 5.0, yTop: yG, drop: 10, depth: 4.3, hw: 1.45 });
  const guardOpening = guardAndTrigger(c, { zF: zD0 + 2.8, zB: G.frontAt(yG - 3.2), yTop: yG, yBot: yG - 3.4, zTrig: zD0 - 0.6 });
  // the rail over the strap and the sight on it (law 4: one line over the bore)
  let yTop = top + 0.2;
  if (p.rail !== 'none') yTop = rail(c, { z0: zD0 - 4.8, z1: zD1 + 4.2, yTop, hw: 1.05 * g });
  if (p.optic !== 'none') optic(c, p.optic, { z0: zD0 - 3.5, z1: zD0 + 20, yTop, zRear: zD0 - 4, zFront: zD1 + 3.6 });
  // the stock off the frame's back
  const S = stock(c, p.stock, { z0: zD0 - 5.4, yHi: top - 0.2, yLo: yc - 2, length: 24 });
  // under the barrel: a rail's short stretch and a vertical grip on it
  if (p.underbarrel === 'grip') {
    const zg = zD1 + 4.6 + (zM - zD1 - 4.6) * 0.42, yb = -rB;
    c.add('extrudes', box({ lo: [-1.2 * g, yb - 1.1, zD1 + 4.6], hi: [1.2 * g, yb + 0.2, Math.min(zM - 2, zg + 6)], role: c.R.frame, group: 'handguard', chamfer: 0.15 }));
    c.add('lathes', tube({ axis: 'y', z0: yb - 10, z1: yb - 0.9, x: 0, y: zg, profile: [[0, 1.45], [0.1, 1.6], [0.9, 1.35], [1, 1.55]], samples: 16, role: c.R.grip, group: 'foregrip' }));
  }
  return { back: S.back, front: zM, fist: G.fist, axis: RAKE, butt: S.butt, top: yTop, guardOpening, bottom: G.bottom };
}

/**
 * The rocket launcher (a bazooka): one long tube on the shoulder, its bore the tube's own, flared to a venturi at its
 * back; a pad under it where the shoulder takes it, a raked grip and its guard ahead of the pad, a vertical grip forward;
 * the sight on a bracket off the tube's LEFT side, where the eye is (the tube on the right shoulder lies beside the cheek,
 * never under it). → its stations.
 */
function buildRocket(c) {
  const p = c.parts, g = c.P.girth, fut = c.line === 'future';
  const rT = 4.6 * g, L = c.barrel * c.P.length, zF = 0.47 * L, zR = -0.53 * L;
  // the tube: flared at its back (the venturi), a lip at its mouth; bands of the metal along it
  c.add('lathes', tube({ z0: zR, z1: zF, profile: [[0, rT * 1.42], [0.06, rT * 1.28], [0.12, rT], [0.97, rT], [0.985, rT * 1.1], [1, rT * 1.1]], samples: 28, role: c.R.frame, group: 'tube' }));
  for (const t of [0.18, 0.5, 0.82]) { const z = zR + (zF - zR) * t; c.add('lathes', tube({ z0: z - 0.9, z1: z + 0.9, profile: [[0, rT + 0.18], [1, rT + 0.18]], samples: 28, role: c.R.metal, group: 'tube' })); }
  c.add('lathes', tube({ z0: zF - 0.05, z1: zF + 0.03, profile: [[0, rT * 0.9], [1, rT * 0.9]], samples: 22, role: c.R.bore, group: 'bore' }));
  c.add('lathes', tube({ z0: zR - 0.03, z1: zR + 0.05, profile: [[0, rT * 1.25], [1, rT * 1.25]], samples: 22, role: c.R.bore, group: 'bore' }));
  if (fut) conduit(c, { z0: zR + 0.15 * L, z1: zF - 0.1 * L, y: rT * 0.55, hw: rT * 0.84 });
  if (c.line === 'near') { seam(c, { z0: zR + 0.14 * L, z1: zF - 0.05 * L, y: 0, hw: rT * 1.005 }); display(c, { face: 'left', x: rT * 0.95, z0: -3, z1: 1.5, y0: -rT * 0.55, y1: -rT * 0.15 }); }
  // the pad under the tube where the shoulder takes it
  const yU = -rT + 0.4;
  push(c, { ring: [[-15, yU], [1, yU], [0, yU - 3.2], [-13, yU - 3.6], [-15, yU - 2]], plane: 'side', hw: 2.4 * g, chamfer: c.ch(2.4), role: c.R.grip, group: 'buttpad' });
  // the grip ahead of the pad on its mount, the guard and the trigger
  push(c, { ring: [[3, yU + 0.3], [16, yU + 0.3], [16, yU - 1.4], [3, yU - 1.4]], plane: 'side', hw: 1.6 * g, chamfer: c.ch(1.6), role: c.R.metal, group: 'mount' });
  const yG = yU - 1.4, G = pistolGrip(c, { zBack: 4, yTop: yG, drop: 9.8, depth: 4.2, hw: 1.45 });
  const guardOpening = guardAndTrigger(c, { zF: 15.4, zB: G.frontAt(yG - 3.2), yTop: yG, yBot: yG - 3.4, zTrig: 8.6 });
  // the sight on its bracket off the left side: a housing and its lens (a red dot), or a flip-up rear and a front post
  const xs = -(rT + 2.4), ys = 1.6;
  if (p.optic !== 'none') c.add('extrudes', box({ lo: [-rT - 1.2, -0.6, -4], hi: [-rT + 0.6, 0.6, 3], role: c.R.metal, group: 'mount', chamfer: 0.15 }));
  if (p.optic === 'reddot') {
    c.add('extrudes', box({ lo: [xs - 1.3, ys - 1.6, -5], hi: [xs + 1.3, ys + 1.6, 4], role: c.R.accent, group: 'optic', chamfer: c.ch(1.3) }));
    c.add('extrudes', box({ lo: [xs - 1.0, ys - 1.2, 3.95], hi: [xs + 1.0, ys + 1.2, 4.05], role: c.R.glass, group: 'optic' }));
    c.add('extrudes', box({ lo: [xs - 1.0, ys - 1.2, -5.05], hi: [xs + 1.0, ys + 1.2, -4.95], role: c.R.glass, group: 'optic' }));
  } else if (p.optic === 'irons') {
    c.add('extrudes', box({ lo: [xs - 0.8, ys - 0.6, -4], hi: [xs + 0.8, ys + 1.4, -3.3], role: c.R.accent, group: 'sights', chamfer: 0.08 }));
    c.add('extrudes', box({ lo: [xs - 0.25, ys - 0.6, 18], hi: [xs + 0.25, ys + 1.3, 18.6], role: c.R.accent, group: 'sights', chamfer: 0.06 }));
    c.add('extrudes', box({ lo: [-rT - 1.2, -0.6, 17.5], hi: [xs + 0.3, 0.6, 19.1], role: c.R.metal, group: 'mount', chamfer: 0.12 }));
  }
  if (p.underbarrel === 'grip') c.add('lathes', tube({ axis: 'y', z0: yU - 9.5, z1: yU + 0.2, x: 0, y: zF * 0.55, profile: [[0, 1.45], [0.1, 1.6], [0.9, 1.35], [1, 1.55]], samples: 16, role: c.R.grip, group: 'foregrip' }));
  return { back: zR, front: zF, fist: G.fist, axis: RAKE, butt: [0, yU - 2, -6], top: rT, guardOpening, bottom: G.bottom };
}

/** The launchers by layout. */
export function buildLauncher(c, M) {
  return M.layout === 'rocket' ? buildRocket(c, M) : buildGrenade(c, M);
}
