/**
 * THE MADE FINISH, part by part: what each of the shelf's part builders (craft-parts.js) adds or swaps under the made
 * finish (`made`), drawn with the aircraft detail kit's parts (air-kit-parts.js), so a fighter reads as built and not
 * lofted. Each takes what its builder already knows (its rows, its own section, its hinges) and returns monomers; none
 * reads a seed, and a part without the word is built as it always was (its builder never calls these).
 *
 *   madeHull({ b, L, zp, ringAt, skinX, skinZ, C })        the radome's break ring; the angle-of-attack vanes and the
 *                                                         IFF blades; the heat-tinted bands over the engine's end
 *   madeCanopy({ rows, L, W, H, bows, C })                 the canopy's frame: its sill rails, the windscreen's bow, its
 *                                                         aft frame (moving with it when it opens)
 *   madeIntake({ ring, family, w, h, L, duct, C })                a rolled lip, polished; the duct lined dark and deep; a side
 *                                                         intake's splitter plate on its struts
 *   madeNozzle({ L, R, C })                                an afterburning core's petal nozzle in place of its turned one
 *   madeWheel(id, x, y, z, D, W, C)                        a treaded tyre on its hub and brake disc
 *   madeLeg({ b, axle, S, nose, C })                       a leg's brake line, a nose leg's taxi light
 *   madeWell({ id, at, inboard, b, S, D, W, how, angle, C })   a retracting leg's well on the airframe (its roof in
 *                                                         primer, ribbed, its plumbing) and its doors, open with the
 *                                                         leg down, shut up: the hull's, so they stay as the leg swings
 *   madeSurface({ place, world, foil, surfaces, kind, nav, vertical, side, span, at, C })   a wing's or a tail's hinge
 *                                                         gaps above and below, the actuator fairings under a wing, the
 *                                                         leading-edge flap's line; a fin's cap and its beacon
 *   madeMissile({ L, R, C })                                a missile's live bands, its seeker's dome, its canards
 *
 * Craft space: +y forward, +z up, +x right, metres. Pure.
 */
import { DEG, lathe, sweep, extrudeWorld, loftWorld, tone } from './craft-common.js';
import { hingeLine, panelDoor, treadTyre, petalNozzle, coveredLight, blister, blade, mergeKit } from './air-kit-parts.js';

// a gear well's zinc-chromate primer; a hinge's gap; the bands an engine's heat leaves on the skin over it
export const PRIMER = '#8e9450';
const GAP = '#1a1b1d';
const HEAT = ['#b8a274', '#5c6a9e', '#7a5a42'];
// a colour moved part of the way to another (a heat tint over the paint)
const mix = (a, b, k) => `#${[1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - k) + parseInt(b.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('')}`;
// a missile's bands: its warhead's yellow, its live motor's brown
const BAND = { warhead: '#c9a227', motor: '#6b4a2e' };
const NAV = { r: '#2fd36b', l: '#e23b3b', c: '#f4f6f8' };

// the made pieces are fittings, not skin (their faces carry the monomer's group): the skin's panel lines, its fasteners
// and a livery pass them by (craft-form.js)
export const FITTING = 'fitting';
export const asFitting = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v.map((m) => ({ ...m, group: FITTING })) : v]));

const closed = (pts) => [...pts, pts[0]];
const centreOf = (ring) => { const xs = ring.map((p) => p[0]), zs = ring.map((p) => p[1]); return { c: [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2], hw: (Math.max(...xs) - Math.min(...xs)) / 2, hh: (Math.max(...zs) - Math.min(...zs)) / 2 }; };
// a ring of the skin pushed out from its centre by d
const proud = (ring, d) => { const { c } = centreOf(ring); return ring.map(([x, z]) => { const dx = x - c[0], dz = z - c[1], r = Math.hypot(dx, dz) || 1; return [x + (dx / r) * d, z + (dz / r) * d]; }); };

export function madeHull({ b, L, zp, ringAt, skinX, skinZ, C }) {
  const lofts = [], sweeps = [], extrudes = [];
  // the radome's break: a dark ring where the composite nose meets the metal
  if (b.nose) {
    const y = -b.nose * L;
    sweeps.push(sweep('radome_break', closed(proud(ringAt(b.nose), 0.004).map(([x, z]) => [x, y, z])), 0.009, tone(C.trim, -0.4), { sides: 5 }));
  }
  // the angle-of-attack vanes each side of the nose, the IFF blades over and under it
  const sv = Math.min(0.97, (b.nose || 0.06) + 0.035), ring = ringAt(sv), { c, hh } = centreOf(ring);
  for (const side of [1, -1]) {
    const z = c[1] + 0.2 * hh, x = skinX(ring, z, side);
    if (x !== null) extrudes.push(...blade(`aoa_${side > 0 ? 'r' : 'l'}`, [x - side * 0.004, -sv * L, z], [side, 0, 0], [0, 1, 0], { len: 0.08, chord: 0.06, rake: 0.5, tint: C.chrome }).extrudes);
  }
  for (const [k, s, up] of [['iff_top', sv + 0.02, 1], ['iff_belly', sv + 0.07, -1]]) {
    const z = skinZ(ringAt(s), 0, up);
    if (z !== null) extrudes.push(...blade(k, [0, -s * L, z - up * 0.004], [0, 0, up], [0, 1, 0], { len: 0.11, chord: 0.09, rake: 0.4, tint: C.trim }).extrudes);
  }
  // the bands the engine's heat leaves over its end: straw, then blue, then brown toward the tail
  HEAT.forEach((tint, k) => {
    const s0 = 0.9 + k * 0.03, s1 = s0 + 0.03;
    const st = [s0, s1].map((s, i) => ({ t: i, points: proud(ringAt(s), 0.0015).map(([x, z]) => [x, 0, z - zp]) }));
    lofts.push(loftWorld(`heat_band_${k}`, [0, -s0 * L, zp], [0, -s1 * L, zp], st, mix(C.paint, tint, 0.3 + 0.08 * k), { caps: false }));
  });
  // (the bands are the skin's own, tinted; the rest are fittings)
  return { lofts, ...asFitting({ sweeps, extrudes }) };
}

export function madeCanopy({ rows, L, W, H, bows = [], C }) {
  const at = (f) => { let i = 1; while (i < rows.length - 1 && f > rows[i][0]) i += 1; const [a, q] = [rows[i - 1], rows[i]], k = Math.max(0, Math.min(1, (f - a[0]) / (q[0] - a[0] || 1))); return { w: a[1] + k * (q[1] - a[1]), h: a[2] + k * (q[2] - a[2]) }; };
  const frame = tone(C.trim, -0.25), sweeps = [];
  // the sill rails along both sides of its base
  const fs = Array.from({ length: 13 }, (_, i) => 0.03 + (0.94 * i) / 12);
  for (const side of [1, -1]) sweeps.push(sweep(`sill_${side > 0 ? 'r' : 'l'}`, fs.map((f) => [side * ((at(f).w * W) / 2 + 0.006), -f * L, 0.03]), 0.022, frame, { sides: 6 }));
  // the windscreen's bow (where the row names none) and the aft frame: arches over it
  const arch = (id, f) => { const { w, h } = at(f), a = (w * W) / 2 * 1.02, hh = h * H * 1.02; return sweep(id, Array.from({ length: 9 }, (_, i) => { const th = (i / 8) * Math.PI; return [Math.cos(th) * a, -f * L, 0.02 + Math.sin(th) * hh]; }), 0.02, frame, { sides: 6 }); };
  if (!bows.length) sweeps.push(arch('bow_made', 0.24));
  sweeps.push(arch('frame_aft', 0.95));
  return asFitting({ sweeps });
}

export function madeIntake({ ring, family, w, h, L, duct, C }) {
  // the rolled lip, polished; the duct lined dark back to its face, so the mouth reads deep
  const sweeps = [sweep('lip', closed(ring(1)).map(([x, , z]) => [x, 0.004, z]), Math.max(0.018, Math.min(w, h) * 0.035), C.chrome, { sides: 8 })];
  const lofts = [loftWorld('liner', [0, -0.01, 0], [0, -0.7, 0], [{ t: 0, points: ring(0.975) }, { t: 1, points: ring(0.9) }], GAP, { caps: false })];
  const extrudes = [extrudeWorld('mouth', [0, -0.7, 0], [0, -0.76, 0], ring(0.92), C.rubber)];
  // (the duct's own ends open, so the lining shows; its aft end closed by a plate of its own)
  extrudes.push(extrudeWorld('duct_end', [0, -L + 0.02, 0], [0, -L, 0], ring(0.6), C.paint));
  // a side intake's splitter: a plate standing off the fuselage ahead of the mouth, on struts
  if (family !== 'chin') {
    const hh = h * 0.58;
    extrudes.push(extrudeWorld('splitter', [-0.012, 0.18, 0], [0.004, 0.18, 0], [[0, 0, hh], [0, -0.9, hh], [0, -0.9, -hh], [0, 0, -hh]], C.paint));
    for (const [k, y, z] of [[0, -0.15, hh * 0.6], [1, -0.15, -hh * 0.6], [2, -0.6, 0]]) sweeps.push(sweep(`splitter_strut_${k}`, [[-0.01, y, z], [-0.1, y - 0.04, z]], 0.012, C.trim, { sides: 5 }));
  }
  return { ...asFitting({ sweeps, extrudes }), lofts: [{ ...duct, caps: false }, ...asFitting({ lofts }).lofts] };
}

export function madeNozzle({ L, R, C }) {
  // (the engine's face inside, dark behind the flameholder, so its case's end does not show through the petals)
  const nz = petalNozzle('nozzle', [0, -L * 0.82, 0], [0, -L, 0], { R0: R * 0.9, R1: R * 0.78, n: 15, gap: 0.08 }, { metal: C.chrome, dark: GAP, hot: '#6a5a8a' });
  nz.lathes.push(lathe('core_face', [0, -L * 0.83, 0], [0, -L * 0.835, 0], [[0, R * 0.88], [1, R * 0.88]], GAP, { samples: 20, crossSections: 2 }));
  return asFitting(nz);
}

export function madeWheel(id, x, y, z, D, W, C) {
  return asFitting(treadTyre(id, [x, y, z], [1, 0, 0], { D, W }, { rubber: C.rubber, metal: C.chrome })).lathes;
}

export function madeLeg({ b, axle, S, nose, C }) {
  const sweeps = [], lathes = [];
  // the brake line down the leg's side to the hub
  const o = b.oleo * 1.25;
  sweeps.push(sweep('brake_line', [[o, 0, -0.05], [o, axle[1] * 0.5, -S * 0.5], [o * 0.8, axle[1], -S + b.oleo]], 0.007, GAP, { sides: 5 }));
  // a nose leg's taxi light facing ahead
  if (nose) lathes.push(...coveredLight('taxi_light', [0, axle[1] * 0.4 + b.oleo * 1.1, -S * 0.42], [0, 1, 0], { r: 0.05, light: '#fff4d8', glass: C.glass }).lathes);
  return asFitting({ sweeps, lathes });
}

export function madeWell({ id = 'well', at = [0, 0, 0], inboard = -1, b, S, D, W, how, angle, C }) {
  // the bay a leg folds into, on the airframe at `at` (where the leg's mount meets the skin): as long as the leg and its
  // tyre, a little wider than the tyre, lying the way the leg folds (`inboard`, the side toward the centreline, for one
  // that folds inward); seen from below its roof in primer, ribbed, its plumbing along it
  const [ox, oy, oz] = at, len = S + D * 0.75, ww = Math.max(W, b.oleo * 2.5) + 0.14;
  const along = how === 'inward' ? 0 : 1;
  const [cx, cy, lx, ly] = along
    ? [ox, oy + (how === 'aft' ? D * 0.35 - len / 2 : len / 2 - D * 0.35), ww, len]
    : [ox + inboard * (len / 2 - D * 0.35), oy, len, ww];
  const extrudes = [extrudeWorld(`${id}_roof`, [cx, cy, oz + 0.004], [cx, cy, oz - 0.006], [[lx / 2, ly / 2, 0], [-lx / 2, ly / 2, 0], [-lx / 2, -ly / 2, 0], [lx / 2, -ly / 2, 0]], PRIMER)];
  const sweeps = [];
  const n = Math.max(2, Math.round((along ? ly : lx) / 0.25));
  for (let k = 1; k < n; k++) {
    const t = -0.5 + k / n, z = oz - 0.006;
    const a = along ? [cx - lx / 2 + 0.01, cy + t * ly, z] : [cx + t * lx, cy - ly / 2 + 0.01, z];
    const e = along ? [cx + lx / 2 - 0.01, cy + t * ly, z] : [cx + t * lx, cy + ly / 2 - 0.01, z];
    extrudes.push(extrudeWorld(`${id}_rib_${k}`, a, e, along ? [[0, 0.012, 0], [0, -0.012, 0], [0, -0.012, -0.035], [0, 0.012, -0.035]] : [[0.012, 0, 0], [-0.012, 0, 0], [-0.012, 0, -0.035], [0.012, 0, -0.035]], PRIMER));
  }
  for (let k = 0; k < 2; k++) {
    const off = (k - 0.5) * 0.05, z = oz - 0.02;
    sweeps.push(sweep(`${id}_pipe_${k}`, along ? [[cx + lx * 0.3 + off, cy + ly * 0.45, z], [cx + lx * 0.3 + off, cy - ly * 0.45, z]] : [[cx + lx * 0.45, cy + ly * 0.3 + off, z], [cx - lx * 0.45, cy + ly * 0.3 + off, z]], 0.009, C.chrome, { sides: 5 }));
  }
  // its doors along its long edges: hanging open with the leg down, folded shut under it as the leg comes up
  const shut = Math.min(1, Math.abs(angle) / 90), phi = shut * 90 * DEG, doors = [];
  for (const s of [1, -1]) {
    const hinge = along ? [cx + s * lx / 2, cy - ly / 2, oz - 0.01] : [cx - lx / 2, cy + s * ly / 2, oz - 0.01];
    const u = along ? [0, 1, 0] : [1, 0, 0], v = along ? [-s * Math.sin(phi), 0, -Math.cos(phi)] : [0, -s * Math.sin(phi), -Math.cos(phi)];
    doors.push(panelDoor(`${id}_door_${s > 0 ? 'r' : 'l'}`, hinge, u, v, { w: along ? ly : lx, h: (along ? lx : ly) / 2, tint: C.paint, metal: C.chrome }));
  }
  const kit = mergeKit({ extrudes, sweeps }, ...doors);
  return asFitting({ extrudes: kit.extrudes, sweeps: kit.sweeps });
}

export function madeSurface({ place, world, foil, surfaces, kind, nav = false, vertical, side, span, at, C }) {
  const sweeps = [], lathes = [];
  const sub = (a, q) => [a[0] - q[0], a[1] - q[1], a[2] - q[2]];
  // a point on its upper (or lower) skin at span fraction f, chord fraction c
  const skin = (f, c, face) => world(f, place(f, c, foil(f, c)[face]));
  // (its span's direction, its tip's out)
  const out = sub(world(1, [1, 0, 0]), world(1, [0, 0, 0]));
  // the hinge gaps: a dark line along each control surface's hinge on both its faces
  for (const sf of surfaces) {
    const cut = 1 - sf.chord, fs = [sf.span[0], sf.span[1]];
    for (const face of ['upper', 'lower']) sweeps.push(...hingeLine(`hinge_${sf.control}_${face}_${Math.round(sf.span[0] * 100)}`, skin(fs[0], cut, face), skin(fs[1], cut, face), GAP, { r: 0.006 }).sweeps);
    // the actuator fairings under a wing's surface: canoes ahead of its hinge
    if (!vertical) {
      const n = Math.max(1, Math.round((sf.span[1] - sf.span[0]) * span / 1.6));
      for (let k = 0; k < n; k++) {
        const f = sf.span[0] + ((k + 0.5) * (sf.span[1] - sf.span[0])) / n;
        const p = skin(f, cut - 0.04, 'lower'), down = sub(skin(f, cut - 0.04, 'lower'), skin(f, cut - 0.04, 'upper')), aft = sub(skin(f, cut + 0.02, 'lower'), skin(f, cut - 0.1, 'lower'));
        lathes.push(...blister(`actuator_${sf.control}_${k}_${Math.round(sf.span[0] * 100)}`, p, down, aft, { len: 0.42, wid: 0.07, h: 0.04, tint: tone(C.paint, -0.05) }).lathes);
      }
    }
  }
  // a wing's leading-edge flap: its line along the span on both faces, outboard of the root
  if (kind === 'craft-wing' && surfaces.length) {
    const f0 = Math.max(0.06, surfaces[0].span[0]), f1 = 0.96, k = 6;
    for (const face of ['upper', 'lower']) sweeps.push(sweep(`le_flap_${face}`, Array.from({ length: k + 1 }, (_, i) => skin(f0 + ((f1 - f0) * i) / k, 0.13, face)), 0.005, GAP, { sides: 5 }));
  }
  // a fin's cap: its antenna housing along the tip and the beacon on it
  if (vertical) {
    const tip = at(1), front = world(1, place(1, 0.15, 0)), back = world(1, place(1, 0.85, 0));
    lathes.push(...blister('cap', world(1, place(1, 0.5, 0)), out, sub(front, back), { len: tip.chord * 0.75, wid: Math.max(0.06, tip.chord * 0.07), h: 0.04, tint: C.trim }).lathes);
    lathes.push(...coveredLight('beacon', world(1, place(1, 0.72, 0)).map((v, i) => v + out[i] * 0.03), out, { r: 0.045, light: NAV.l, glass: C.glass }).lathes);
  }
  // a wing's nav light in its clear cover at the tip (in place of the bare one)
  if (nav) {
    lathes.push(...coveredLight('nav_light', world(1, place(1, 0.05, 0)), out, { r: 0.055, light: NAV[side || 'c'], glass: C.glass }).lathes);
  }
  return asFitting({ sweeps, lathes });
}

export function madeMissile({ L, R, C }) {
  // its bands (the warhead's yellow ahead, the live motor's brown aft), its seeker's dome, its canards
  const lathes = [
    lathe('band_warhead', [0, L * 0.68, 0], [0, L * 0.7, 0], [[0, R * 1.012], [1, R * 1.012]], BAND.warhead, { samples: 14, crossSections: 2 }),
    lathe('band_motor', [0, L * 0.3, 0], [0, L * 0.32, 0], [[0, R * 1.012], [1, R * 1.012]], BAND.motor, { samples: 14, crossSections: 2 }),
    lathe('seeker', [0, L * 0.9, 0], [0, L * 1.006, 0], [[0, R * 0.86], [0.5, R * 0.62], [0.85, R * 0.3], [1, 0.006]], C.glass, { samples: 14, crossSections: 4, material: 'glass' }),
  ];
  const extrudes = [0, 90, 180, 270].map((deg, i) => {
    const c = Math.cos(deg * DEG + Math.PI / 4), s = Math.sin(deg * DEG + Math.PI / 4), t = 0.004;
    const fin = [[L * 0.8, R], [L * 0.86, R], [L * 0.84, R * 1.9], [L * 0.81, R * 1.9]];
    return extrudeWorld(`canard_${i}`, [s * t, L * 0.83, -c * t], [-s * t, L * 0.83, c * t], fin.map(([y, r]) => [c * r, y - L * 0.83, s * r]), C.trim);
  });
  return asFitting({ lathes, extrudes });
}
