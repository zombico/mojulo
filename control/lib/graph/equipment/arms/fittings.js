// equipment/arms/fittings — the parts every gun shares, placed on the bore line (y = 0 along +z, +y up, x across, cm):
// the sights and optics on the top line, the rail and its teeth, the muzzle and its device, the dark of the bore, the
// future line's conduit and emitter. Each takes the arm's context `c` (arms/index.js armContext): its roles `R`, its
// chamfer `ch(thick)`, its tertiary pitch `pitch(base)`, its proportion `P`, its line, and the monomer sink `add`.
import * as dmath from '../../../util/dmath.js';
import { slab, slabC, tube, box, r4 } from './geom.js';

/** Iron sights: a rear notch (two ears) at zRear and a front post at zFront, standing on yTop. */
export function irons(c, { zRear, zFront, yTop, w = 1.8, h = 0.65, group = 'sights' }) {
  const s = c.P.sight, hh = h * s, ear = (w / 2) * s, gap = 0.24 * s;
  for (const x0 of [-ear, gap]) c.add('extrudes', box({ lo: [x0, yTop, zRear - 0.8], hi: [x0 + ear - gap, yTop + hh, zRear], role: c.R.accent, group, chamfer: 0.08 }));
  c.add('extrudes', box({ lo: [-0.22 * s, yTop, zFront - 0.6], hi: [0.22 * s, yTop + hh * 0.95, zFront], role: c.R.accent, group, chamfer: 0.06 }));
  if (c.line === 'future' && c.R.glow) {
    c.add('extrudes', box({ lo: [-0.12 * s, yTop + hh * 0.95, zFront - 0.45], hi: [0.12 * s, yTop + hh * 1.08, zFront - 0.15], role: c.R.glow, group }));
  }
}

/** A red dot: a short housing with a window, its lens, on a low mount (z0 its rear, on yTop). */
export function reddot(c, { z0, yTop, group = 'optic' }) {
  const s = c.P.sight, L = 4.6 * s, H = 3.0 * s, hw = 1.35 * s;
  slabC({ ring: [[z0, yTop], [z0 + L, yTop], [z0 + L, yTop + 0.7 * s], [z0 + L * 0.82, yTop + H], [z0 + L * 0.18, yTop + H], [z0, yTop + 0.8 * s]], plane: 'side', hw, chamfer: c.ch(hw), role: c.R.frame, group }).forEach((e) => c.add('extrudes', e));
  // the window: a lens across the housing's upper half, its rim the bore's dark
  c.add('extrudes', box({ lo: [-hw * 0.82, yTop + H * 0.42, z0 + L * 0.45], hi: [hw * 0.82, yTop + H * 0.92, z0 + L * 0.52], role: c.R.glass, group }));
  if (c.line === 'future' && c.R.glow) c.add('extrudes', box({ lo: [hw, yTop + H * 0.35, z0 + L * 0.2], hi: [hw + 0.06, yTop + H * 0.48, z0 + L * 0.8], role: c.R.glow, group }));
}

/** A holographic sight: a hood over a window, a base with its battery. */
export function holo(c, { z0, yTop, group = 'optic' }) {
  const s = c.P.sight, L = 9.5 * s, hw = 1.7 * s, H = 4.2 * s, t = 0.42 * s;
  slabC({ ring: [[z0, yTop], [z0 + L, yTop], [z0 + L, yTop + 1.3 * s], [z0 + L * 0.3, yTop + 1.5 * s], [z0, yTop + 1.2 * s]], plane: 'side', hw, chamfer: c.ch(hw), role: c.R.frame, group }).forEach((e) => c.add('extrudes', e));
  // the hood: a ⊓ over the window, pushed along the bore
  const hood = [[-hw, yTop + 1.2 * s], [-hw, yTop + H], [hw, yTop + H], [hw, yTop + 1.2 * s], [hw - t, yTop + 1.2 * s], [hw - t, yTop + H - t], [-hw + t, yTop + H - t], [-hw + t, yTop + 1.2 * s]];
  slab({ ring: hood, plane: 'front', w0: z0 + L * 0.42, w1: z0 + L, chamfer: c.ch(t) * 0.6, role: c.R.frame, group }).forEach((e) => c.add('extrudes', e));
  c.add('extrudes', box({ lo: [-hw + t, yTop + 1.3 * s, z0 + L * 0.6], hi: [hw - t, yTop + H - t, z0 + L * 0.63], role: c.R.glass, group }));
}

/** A scope: a tube with its bells, the turrets, two rings down to the rail; its centre `lift` over yTop. */
export function scope(c, { z0, z1, yTop, group = 'optic' }) {
  const s = c.P.sight, rT = 1.3 * s, rO = 2.25 * s, rE = 1.95 * s, y = yTop + rO + 1.0 * s, L = z1 - z0;
  c.add('lathes', tube({ z0, z1, y, profile: [[0, rE], [0.16, rE], [0.24, rT], [0.66, rT], [0.78, rO], [1, rO]], samples: 24, role: c.R.metal, group }));
  for (const [zz, r] of [[z0, rE], [z1, rO]]) c.add('lathes', tube({ z0: zz - 0.02, z1: zz + 0.02, y, profile: [[0, r * 0.84], [1, r * 0.84]], samples: 20, role: c.R.glass, group }));
  const zt = z0 + L * 0.45;
  c.add('lathes', tube({ axis: 'y', z0: y + rT - 0.1, z1: y + rT + 1.4 * s, x: 0, y: zt, profile: [[0, 0.95 * s], [1, 0.95 * s]], samples: 16, role: c.R.metal, group }));
  c.add('lathes', tube({ axis: 'x', z0: rT - 0.1, z1: rT + 1.3 * s, x: zt, y, profile: [[0, 0.9 * s], [1, 0.9 * s]], samples: 16, role: c.R.metal, group }));
  for (const zr of [z0 + L * 0.3, z0 + L * 0.6]) {
    c.add('lathes', tube({ z0: zr - 0.7, z1: zr + 0.7, y, profile: [[0, rT + 0.28], [1, rT + 0.28]], samples: 20, role: c.R.accent, group }));
    c.add('extrudes', box({ lo: [-1.1 * s, yTop, zr - 0.7], hi: [1.1 * s, y - rT, zr + 0.7], role: c.R.accent, group, chamfer: 0.15 }));
  }
  return { y, rT };
}

/** The optic a build names, on the top line from z0 (a scope runs to z1). */
export function optic(c, kind, { z0, z1, yTop, zFront, zRear }) {
  if (kind === 'irons') irons(c, { zRear, zFront, yTop });
  else if (kind === 'reddot') reddot(c, { z0, yTop });
  else if (kind === 'holo') holo(c, { z0, yTop });
  else if (kind === 'scope') scope(c, { z0, z1, yTop });
  else if (kind === 'smart') smartSight(c, { z0, yTop });
}

/**
 * A smart sight (law 9): a low moulded housing on a clamp (k its section's scale: a pistol's is small), its objective lens in a chamfered front, its screen dim in
 * the rear face (the one light: the display), a button and a sensor window on its side. z0 its rear, on yTop.
 */
export function smartSight(c, { z0, yTop, L = 9, k = 1, group = 'optic' }) {
  const s = c.P.sight, len = L * s, H = 3.6 * s * k, hw = 1.75 * s * k, base = 0.9 * s * k;
  c.add('extrudes', box({ lo: [-1.25 * s, yTop, z0 + len * 0.2], hi: [1.25 * s, yTop + base, z0 + len * 0.75], role: c.R.accent, group, chamfer: 0.12 }));
  slabC({ ring: [[z0, yTop + base], [z0 + len, yTop + base], [z0 + len, yTop + H * 0.82], [z0 + len * 0.9, yTop + H], [z0 + len * 0.08, yTop + H], [z0, yTop + H * 0.9]], plane: 'side', hw, chamfer: c.ch(hw * 2), role: c.R.frame, group }).forEach((e) => c.add('extrudes', e));
  const yc = yTop + base + (H - base) * 0.52, rl = (H - base) * 0.36;
  c.add('lathes', tube({ z0: z0 + len - 0.25, z1: z0 + len + 0.04, y: yc, profile: [[0, rl], [1, rl]], samples: 20, role: c.R.glass, group }));
  c.add('lathes', tube({ z0: z0 + len - 0.3, z1: z0 + len + 0.12, y: yc, profile: [[0, rl * 1.18], [1, rl * 1.18]], samples: 20, role: c.R.bore, group }));
  display(c, { z: z0, y0: yc - rl * 0.75, y1: yc + rl * 0.75, x0: -hw * 0.7, x1: hw * 0.7, face: 'rear', group });
  c.add('extrudes', box({ lo: [hw - 0.01, yTop + H * 0.55, z0 + len * 0.3], hi: [hw + 0.08, yTop + H * 0.72, z0 + len * 0.42], role: c.R.accent, group, chamfer: 0.04 }));
  c.add('extrudes', box({ lo: [-hw - 0.03, yTop + H * 0.48, z0 + len * 0.55], hi: [-hw + 0.01, yTop + H * 0.78, z0 + len * 0.8], role: c.R.glass, group }));
}

/** A display (law 9's one light): a dark bezel and a dim screen inset in it, on a part's rear face at z (face 'rear')
 * or on its side at x (face 'left' | 'right', from z0 to z1). Without a glow role it is the bezel and a glass. */
export function display(c, { z, z0, z1, x, x0, x1, y0, y1, face = 'rear', group = 'display' }) {
  const scr = c.R.glow ?? c.R.glass, m = 0.12;
  if (face === 'rear') {
    c.add('extrudes', box({ lo: [x0 - m, y0 - m, z - 0.04], hi: [x1 + m, y1 + m, z + 0.01], role: c.R.bore, group }));
    c.add('extrudes', box({ lo: [x0, y0, z - 0.07], hi: [x1, y1, z - 0.03], role: scr, group: 'screen' }));
  } else {
    const s = face === 'right' ? 1 : -1;
    c.add('extrudes', box({ lo: s > 0 ? [x - 0.01, y0 - m, z0 - m] : [-x - 0.04, y0 - m, z0 - m], hi: s > 0 ? [x + 0.04, y1 + m, z1 + m] : [-x + 0.01, y1 + m, z1 + m], role: c.R.bore, group }));
    c.add('extrudes', box({ lo: s > 0 ? [x + 0.03, y0, z0] : [-x - 0.07, y0, z0], hi: s > 0 ? [x + 0.07, y1, z1] : [-x - 0.03, y1, z1], role: scr, group: 'screen' }));
  }
}

/** A parting line (law 9): a thin dark seam round a moulded shell at height y, from z0 to z1, at half-width hw. */
export const seam = (c, { z0, z1, y, hw, group = 'seam' }) => c.add('extrudes', box({ lo: [-hw - 0.015, y - 0.035, z0], hi: [hw + 0.015, y + 0.035, z1], role: c.R.bore, group }));

/** A vent row (law 9): n dark slots on each side at half-width hw, centred on y, from z0, every pitch (fewer as it
 * stylizes), each h tall. */
export function vents(c, { z0, z1, y, hw, h = 1.0, base = 1.1, group = 'vents' }) {
  const p = c.pitch(base), n = Math.max(2, Math.floor((z1 - z0) / p)), w = p * 0.45;
  for (let i = 0; i < n; i++) { const z = z0 + i * p + (z1 - z0 - n * p) / 2 + (p - w) / 2; for (const sx of [1, -1]) c.add('extrudes', box({ lo: sx > 0 ? [hw - 0.01, y - h / 2, z] : [-hw - 0.04, y - h / 2, z], hi: sx > 0 ? [hw + 0.04, y + h / 2, z + w] : [-hw + 0.01, y + h / 2, z + w], role: c.R.bore, group })); }
}

/** A rail on the top line from z0 to z1 at yTop: its base and its teeth, every pitch. */
export function rail(c, { z0, z1, yTop, hw = 1.05, group = 'rail' }) {
  const h = 0.32, tH = 0.28;
  c.add('extrudes', box({ lo: [-hw, yTop, z0], hi: [hw, yTop + h, z1], role: c.R.frame, group, chamfer: 0.12 }));
  const p = c.pitch(1.0), n = Math.max(1, Math.floor((z1 - z0 - 0.4) / p));
  const off = (z1 - z0 - n * p) / 2;
  for (let i = 0; i < n; i++) {
    const z = z0 + off + i * p + p * 0.22;
    c.add('extrudes', box({ lo: [-hw * 0.96, yTop + h, z], hi: [hw * 0.96, yTop + h + tH, z + p * 0.56], role: c.R.frame, group, chamfer: 0.06 }));
  }
  return yTop + h + tH;
}

/** The dark of the bore: a disc in the muzzle's face at z (radius r). */
export const boreDisc = (c, { z, r, y = 0 }) => c.add('lathes', tube({ z0: z - 0.05, z1: z + 0.03, y, profile: [[0, r], [1, r]], samples: 12, role: c.R.bore, group: 'bore' }));

/**
 * The muzzle at zM on a barrel of radius rB: plain (a crown), flash (a slotted hider), brake (a ported block),
 * suppressor (a can), emitter (the future line's flared ring and its glow). → the muzzle's z (the item's front).
 */
export function muzzle(c, kind, { zM, rB, y = 0, group = 'muzzle' }) {
  const g = c.P.girth;
  if (kind === 'plain') { c.add('lathes', tube({ z0: zM - 0.6, z1: zM, y, profile: [[0, rB * 1.08], [0.7, rB * 1.08], [1, rB * 0.96]], samples: 16, role: c.R.metal, group })); boreDisc(c, { z: zM, r: rB * 0.5, y }); return zM; }
  if (kind === 'flash') {
    const L = 5.2 * g, r = rB * 1.35;
    c.add('lathes', tube({ z0: zM, z1: zM + L, y, profile: [[0, rB], [0.12, r], [0.88, r], [1, r * 0.92]], samples: 16, role: c.R.metal, group }));
    for (let i = 0; i < 3; i++) { const a = (i * 2 * Math.PI) / 3 + Math.PI / 2, x = dmath.cos(a) * r * 0.97, yy = y + dmath.sin(a) * r * 0.97; c.add('extrudes', box({ lo: [x - 0.18, yy - 0.18, zM + L * 0.45], hi: [x + 0.18, yy + 0.18, zM + L * 0.98], role: c.R.bore, group })); }
    boreDisc(c, { z: zM + L, r: rB * 0.7, y }); return zM + L;
  }
  if (kind === 'brake') {
    const L = 6.4 * g, hw = rB * 1.55, hh = rB * 1.35;
    slab({ ring: [[zM, y - hh], [zM + L, y - hh], [zM + L, y + hh], [zM, y + hh]], plane: 'side', w0: -hw, w1: hw, chamfer: c.ch(hw), role: c.R.metal, group }).forEach((e) => c.add('extrudes', e));
    const n = Math.max(2, Math.round(3 / (c.pitch(1) / 1)));
    for (let i = 0; i < n; i++) { const z = zM + L * (0.2 + (0.6 * i) / Math.max(1, n - 1)); for (const sx of [1, -1]) c.add('extrudes', box({ lo: sx > 0 ? [hw - 0.02, y - hh * 0.6, z - 0.4] : [-hw - 0.02, y - hh * 0.6, z - 0.4], hi: sx > 0 ? [hw + 0.02, y + hh * 0.6, z + 0.4] : [-hw + 0.02, y + hh * 0.6, z + 0.4], role: c.R.bore, group })); }
    boreDisc(c, { z: zM + L, r: rB * 0.6, y }); return zM + L;
  }
  if (kind === 'suppressor') {
    const L = 16 * g, r = 1.9 * g;
    c.add('lathes', tube({ z0: zM - 1.2, z1: zM + L, y, profile: [[0, rB * 1.2], [0.06, r * 0.9], [0.1, r], [0.94, r], [1, r * 0.82]], samples: 24, role: c.R.frame, group }));
    boreDisc(c, { z: zM + L, r: rB * 0.55, y }); return zM + L;
  }
  // emitter: a flared shroud, a lit ring in its throat, heat-sink fins behind it
  const L = 5.5 * g, r = rB * 1.9;
  c.add('lathes', tube({ z0: zM, z1: zM + L, y, profile: [[0, rB * 1.1], [0.3, r * 0.82], [0.85, r], [1, r * 0.9]], samples: 20, role: c.R.metal, group }));
  if (c.R.glow) c.add('lathes', tube({ z0: zM + L - 0.4, z1: zM + L + 0.04, y, profile: [[0, r * 0.68], [1, r * 0.68]], samples: 20, role: c.R.glow, group: 'glow' }));
  boreDisc(c, { z: zM + L + 0.05, r: r * 0.36, y });
  return zM + L;
}

/** The future line's heat-sink fins: rings of the metal along a barrel from z0 to z1, every pitch. */
export function fins(c, { z0, z1, r, y = 0, group = 'fins' }) {
  const p = c.pitch(1.3), n = Math.max(2, Math.floor((z1 - z0) / p));
  for (let i = 0; i < n; i++) { const z = z0 + (i + 0.5) * ((z1 - z0) / n); c.add('lathes', tube({ z0: z - 0.22, z1: z + 0.22, y, profile: [[0, r], [1, r]], samples: 16, role: c.R.metal, group })); }
}

/** The future line's conduit: a lit strip proud of each side at height y, from z0 to z1, at half-width hw. */
export function conduit(c, { z0, z1, y, hw, h = 0.32, group = 'glow' }) {
  if (!c.R.glow) return;
  for (const s of [1, -1]) c.add('extrudes', box({ lo: [s > 0 ? hw - 0.01 : -hw - 0.07, y - h / 2, z0], hi: [s > 0 ? hw + 0.07 : -hw + 0.01, y + h / 2, z1], role: c.R.glow, group }));
}

/** The future line's shell gap: a dark band of `t` across the part at height y, from z0 to z1, inset into hw. */
export function shellGap(c, { z0, z1, y, hw, t = 0.22, group = 'gap' }) {
  c.add('extrudes', box({ lo: [-hw - 0.02, y - t / 2, z0], hi: [hw + 0.02, y + t / 2, z1], role: c.R.bore, group }));
}

/** A thin rod between two points (a bipod leg, a pin), its radius r. */
export function rod(c, { from, to, r, role, group, samples = 10 }) {
  c.add('lathes', { group, axisFrom: { x: r4(from[0]), y: r4(from[1]), z: r4(from[2]) }, axisTo: { x: r4(to[0]), y: r4(to[1]), z: r4(to[2]) }, profile: [{ t: 0, radius: r4(r) }, { t: 1, radius: r4(r) }], samples, crossSections: 2, ...(Array.isArray(role) ? { material: role[0], tint: role[1] } : { material: role }) });
}
