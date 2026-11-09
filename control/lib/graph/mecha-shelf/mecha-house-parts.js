/**
 * mecha-house-parts — a giant arm pack's parts as each design house builds them (mecha-gap-makers.js): the same joints,
 * pins and hardpoints as the shelf's own builders (an arm is posed and held to the laws the same whatever its house), drawn
 * in the house's construction:
 *
 *   arm beams    'plated' (a box core under bolted side plates), 'tube' (a round tube between collars), 'truss' (four
 *                chords and their lacing, open), 'sealed' (a closed beam, its joints under bellows boots)
 *   shoulders    'faired' (a teardrop fairing over the drive), 'truss' (an open cage over it), 'sealed' (its pitch joint
 *                under a bellows drum)
 *   packs        'spine' (one central mast, a crossbar out to the shoulders), 'gantry' (two lattice towers and a lattice
 *                beam, the power unit's motor and tank in the open), 'sealed' (one closed shell, its towers closed boxes)
 *   actuators    'screw' (an electric screw actuator: a square housing, its motor alongside on a belt case, a polished
 *                screw; booted when the house seals its joints)
 *
 * houseBuilders(kit) → the builders by family, `kit` the shelf's own (boss, legBeam, plateBox, shoulder, upperarm,
 * forearm, giantPack), so a house's part is the shelf's part redressed. Pure: no clock, no dice.
 */
import { add, box, pod, spin, tone, tube } from './mecha-common.js';

/** A bellows boot along a line: `n` folds, from radius r0 to r1 at its ends, each fold `fold` deep. */
function bellows(id, from, to, r0, r1, tint, n = 6, fold = 0.014) {
  const pairs = [];
  for (let i = 0; i <= 2 * n; i++) { const t = i / (2 * n), r = r0 + (r1 - r0) * t; pairs.push([t, i % 2 ? r : r - fold]); }
  return spin(id, from, to, pairs, tint, 16);
}
/** A lattice between two stations along z: four chords at a section's corners and lacing zigzagging each face. */
function lattice(id, z0, z1, w, d, w1, d1, chord, lace, { at = [0, 0], r = 0.012, rl = 0.007 } = {}) {
  const sweeps = [], span = Math.abs(z1 - z0), bays = Math.max(2, Math.round(span / Math.max(0.06, (d + d1) * 0.55)));
  const corner = (t, cx, cy) => [at[0] + cx * ((w + (w1 - w) * t) / 2), at[1] + cy * ((d + (d1 - d) * t) / 2), z0 + (z1 - z0) * t];
  const C4 = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (const [i, [cx, cy]] of C4.entries()) sweeps.push(tube(`${id}_chord_${i}`, [corner(0, cx, cy), corner(1, cx, cy)], r, chord, 8));
  for (let f = 0; f < 4; f++) {
    const [ax, ay] = C4[f], [bx, by] = C4[(f + 1) % 4], pts = [];
    for (let b = 0; b <= bays; b++) { const t = b / bays, [cx, cy] = b % 2 ? [bx, by] : [ax, ay]; pts.push(corner(t, cx, cy)); }
    sweeps.push(tube(`${id}_lace_${f}`, pts, rl, lace, 6));
  }
  return sweeps;
}
const without = (list, ids) => (list ?? []).filter((m) => !ids.includes(m.id));

export function houseBuilders(kit) {
  const { boss, legBeam, plateBox } = kit;

  // ── the arm's beams: the shelf's upper arm and forearm, their hub, clevis, pins and brackets kept, the beam redrawn ──
  /** An arm beam's run: from z0 down to z1, its section w × d0 tapering to w1 × d1. */
  function run(row, kind) {
    const d = row.dims, L = d.length;
    return kind === 'upper'
      ? { z0: -0.03, z1: -(L - d.clevis) + 0.02, w: d.w, d0: d.d0, w1: d.w * 0.92, d1: d.d1 }
      : { z0: -0.04, z1: -L + 0.03, w: d.w, d0: d.d0, w1: d.w * 0.85, d1: d.d1 };
  }
  function beam(kind) {
    const base = kind === 'upper' ? kit.upperarm : kit.forearm;
    return (row, C, ctx) => {
      const g = base(row, C, ctx), Rn = run(row, kind), fam = row.build.family, dark = tone(C.trim, -0.18);
      const lofts = without(g.lofts, ['beam', 'band']), extrudes = [...(g.extrudes ?? [])], lathes = [...(g.lathes ?? [])], sweeps = [...(g.sweeps ?? [])];
      const { z0, z1, w, d0, w1, d1 } = Rn, zm = (z0 + z1) / 2, dm = (d0 + d1) / 2, wm = (w + w1) / 2;
      if (fam === 'plated') {
        // (a dark box core, a bolted plate on each flank and a cap plate fore and aft; a row of bolt heads down each plate)
        lofts.push(legBeam('core', z0, z1, w * 0.9, d0 * 0.9, w1 * 0.9, d1 * 0.9, dark));
        for (const s of [1, -1]) {
          const side = s > 0 ? 'o' : 'i';
          extrudes.push(box(`plate_${side}`, [s * (wm / 2 + 0.004), 0, z0 - 0.01], [s * (wm / 2 + 0.004), 0, z1 + 0.01], 0.016, dm * 1.06, C.paint, [0, 1, 0]));
          for (let i = 0; i < 4; i++) for (const t of [1, -1]) {
            const z = z0 + ((z1 - z0) * (i + 0.5)) / 4, y = t * dm * 0.38;
            lathes.push(spin(`bolt_${side}_${i}_${t > 0 ? 'f' : 'b'}`, [s * (wm / 2 + 0.012), y, z], [s * (wm / 2 + 0.022), y, z], [[0, 0.011], [1, 0.011]], tone(C.chrome, -0.2), 6));
          }
        }
        for (const t of [1, -1]) extrudes.push(box(`cap_${t > 0 ? 'f' : 'b'}`, [0, t * (dm / 2 + 0.004), z0 - 0.005], [0, t * (dm / 2 + 0.004), z1 + 0.005], wm + 0.012, 0.012, tone(C.paint, -0.06), [0, 1, 0]));
        lofts.push(legBeam('band', zm + 0.02, zm - 0.02, wm + 0.04, dm * 1.06 + 0.02, wm + 0.04, dm * 1.06 + 0.02, dark, 0.016));
      } else if (fam === 'tube') {
        // (a round tube, its collars at its ends, a slim fin down its back, a hose along its flank)
        const r0 = Math.max(w, d0) * 0.46, r1 = Math.max(w1, d1) * 0.46;
        lathes.push(spin('tube', [0, 0, z0], [0, 0, z1], [[0, r0], [1, r1]], C.paint, 20));
        for (const [i, [z, r]] of [[z0, r0], [z1, r1]].entries()) lathes.push(spin(`collar_${i}`, [0, 0, z + (i ? 0.025 : -0.025)], [0, 0, z - (i ? 0.025 : -0.025)], [[0, r + 0.012], [1, r + 0.012]], C.trim, 20));
        extrudes.push(box('fin', [0, -(r0 + r1) / 2 - 0.006, z0 - 0.04], [0, -(r0 + r1) / 2 - 0.006, z1 + 0.04], 0.012, 0.03, C.light, [0, 1, 0]));
        sweeps.push(tube('hose', [[-(r0 + 0.012), 0.02, z0 - 0.02], [-(r0 + r1) / 2 - 0.014, 0.02, zm], [-(r1 + 0.012), 0.02, z1 + 0.02]], 0.01, C.rubber, 8));
      } else if (fam === 'truss') {
        // (four chords at the section's corners and their lacing, open: every pin and hose in sight; a plate at each end)
        sweeps.push(...lattice('truss', z0, z1, w, d0, w1, d1, C.paint, tone(C.paint, -0.12)));
        for (const [i, [z, ww, dd]] of [[z0, w, d0], [z1, w1, d1]].entries()) extrudes.push(box(`end_${i}`, [0, 0, z + (i ? 0.012 : -0.012)], [0, 0, z - (i ? 0.012 : -0.012)], ww + 0.02, dd + 0.02, C.trim, [0, 1, 0]));
        sweeps.push(tube('hose', [[0, 0.01, z0 - 0.01], [0, 0.01, z1 + 0.01]], 0.011, C.rubber, 8));
      } else if (fam === 'sealed') {
        // (a closed beam, its corners rounded deep; a bellows boot over each joint at its ends; a seam band)
        lofts.push(legBeam('shell', z0, z1, w, d0, w1, d1, C.paint, Math.min(w1, d1) * 0.42));
        lathes.push(bellows('bootTop', [0, 0, 0.05], [0, 0, z0 - 0.02], Math.max(w, d0) * 0.62, Math.max(w, d0) * 0.5, C.rubber));
        lathes.push(bellows('bootEnd', [0, 0, z1 + 0.06], [0, 0, z1 - 0.08], Math.max(w1, d1) * 0.5, Math.max(w1, d1) * 0.6, C.rubber, 5));
        lofts.push(legBeam('seam', zm + 0.012, zm - 0.012, wm + 0.012, dm + 0.012, wm + 0.012, dm + 0.012, C.light, Math.min(wm, dm) * 0.42));
      }
      return { ...g, lofts, extrudes, lathes, ...(sweeps.length ? { sweeps } : {}) };
    };
  }

  // ── the shoulders: the shelf's shoulder (its drive, its clevis, its horn), dressed by the house ──────────────────
  function fairedShoulder(row, C, ctx) {
    const g = kit.shoulder(row, C, ctx), lofts = [...(g.lofts ?? [])], extrudes = [...g.extrudes];
    // (a teardrop fairing over the drive, nose ahead, tapering aft; a stripe down its crown)
    lofts.push(pod('fairing', [
      { y: 0.17, w: 0.06, h: 0.06, z: 0.08 }, { y: 0.08, w: 0.2, h: 0.17, z: 0.1 },
      { y: -0.06, w: 0.21, h: 0.18, z: 0.1, r: 0.07 }, { y: -0.2, w: 0.08, h: 0.07, z: 0.11 },
    ], C.paint));
    extrudes.push(box('stripe', [0, 0.12, 0.185], [0, -0.14, 0.192], 0.03, 0.008, C.light));
    return { ...g, lofts, extrudes };
  }
  function trussShoulder(row, C, ctx) {
    const g = kit.shoulder(row, C, ctx), sweeps = [...(g.sweeps ?? [])], extrudes = [...g.extrudes];
    // (an open cage over the drive: four posts from the block's corners to a top plate, crossed on each face)
    const lo = [[0.075, 0.07], [-0.075, 0.07], [-0.075, -0.07], [0.075, -0.07]], z0 = -0.02, z1 = 0.22;
    for (const [i, [x, y]] of lo.entries()) sweeps.push(tube(`post_${i}`, [[x, y, z0], [x * 0.8, y * 0.8, z1]], 0.01, C.paint, 8));
    for (let f = 0; f < 4; f++) { const [ax, ay] = lo[f], [bx, by] = lo[(f + 1) % 4]; sweeps.push(tube(`brace_${f}`, [[ax, ay, z0], [bx * 0.8, by * 0.8, z1]], 0.006, tone(C.paint, -0.12), 6)); }
    extrudes.push(box('top', [0, 0, z1], [0, 0, z1 + 0.018], 0.15, 0.14, C.trim));
    return { ...g, sweeps, extrudes };
  }
  function sealedShoulder(row, C, ctx) {
    const g = kit.shoulder(row, C, ctx), lathes = [...g.lathes];
    // (the pitch joint under a bellows drum across its axle, a smooth cap over the drive)
    lathes.push(bellows('drum', [-0.1, 0, 0], [0.1, 0, 0], 0.1, 0.1, C.rubber, 5, 0.012));
    lathes.push(spin('cap', [0, 0, 0.05], [0, 0, 0.23], [[0, 0.115], [0.7, 0.115], [0.9, 0.1], [1, 0.07]], C.paint, 20));
    return { ...g, lathes };
  }

  // ── the packs: the same frame, power unit and shoulders' places, built by the house ─────────────────────────────
  function spinePack(row, C) {
    const d = row.dims, T = d.tower, extrudes = [], lathes = [], lofts = [], sweeps = [], dark = tone(C.trim, -0.2);
    // (a rounded case against the cab's back, one mast up its middle, a faired crossbar out to both shoulders)
    lofts.push(pod('case', [{ y: -d.d / 2, w: d.w * 0.86, h: d.h * 0.86, z: d.h / 2, r: 0.12 }, { y: d.d / 2, w: d.w, h: d.h, z: d.h / 2, r: 0.14 }], C.paint));
    extrudes.push(box('intake', [0, -d.d / 2 - 0.01, d.h * 0.55], [0, -d.d / 2, d.h * 0.55], d.w * 0.5, d.h * 0.3, dark));
    const top = d.shoulder[2] - 0.08;
    lofts.push(pod('mast', [{ y: d.d / 2 - 0.02, w: 0.16, h: 0.12, z: d.h, r: 0.05 }, { y: d.d / 2 + 0.02, w: 0.18, h: 0.12, z: d.h, r: 0.05 }], C.trim));
    extrudes.push(box('mastRise', [0, T.y * 0.4, d.h - 0.05], [0, T.y * 0.5, top], 0.16, 0.14, C.trim));
    for (const s of [1, -1]) {
      const side = s > 0 ? 'r' : 'l';
      extrudes.push(box(`bar_${side}`, [0, T.y * 0.5, top], [s * (d.shoulder[0] - 0.02), d.shoulder[1], top], 0.12, 0.1, C.paint));
      extrudes.push(box(`barStripe_${side}`, [s * 0.1, T.y * 0.5 + 0.002, top + 0.052], [s * (d.shoulder[0] - 0.12), d.shoulder[1] + 0.002, top + 0.052], 0.03, 0.006, C.light));
      sweeps.push(tube(`cable_${side}`, [[s * 0.06, d.d / 2, d.h], [s * 0.06, T.y * 0.5 - 0.08, top - 0.04], [s * (d.shoulder[0] - 0.14), d.shoulder[1] - 0.06, top - 0.04]], 0.014, C.rubber, 8));
    }
    lathes.push(spin('beacon', [0, T.y * 0.5, top + 0.05], [0, T.y * 0.5, top + 0.11], [[0, 0.04], [1, 0.03]], C.light, 12));
    return { extrudes, lathes, lofts, sweeps, hardpoints: { 'shoulder.r': [...d.shoulder], 'shoulder.l': [-d.shoulder[0], d.shoulder[1], d.shoulder[2]] } };
  }
  function gantryPack(row, C) {
    const d = row.dims, T = d.tower, extrudes = [], lathes = [], sweeps = [], frame = C.trim;
    // (a skid frame, the power unit in the open on it: its motor, its pump, its tank, its cooler on edge)
    extrudes.push(box('skid', [0, -d.d / 2, 0.03], [0, d.d / 2, 0.03], d.w, 0.06, frame));
    lathes.push(spin('motor', [-d.w * 0.3, -d.d * 0.3, 0.2], [-d.w * 0.3, d.d * 0.3, 0.2], [[0, 0.13], [0.1, 0.14], [0.9, 0.14], [1, 0.12]], tone(C.trim, 0.25), 16));
    lathes.push(spin('tank', [d.w * 0.12, -d.d * 0.35, 0.2], [d.w * 0.12, d.d * 0.35, 0.2], [[0, 0.12], [1, 0.12]], C.paint, 16));
    extrudes.push(box('cooler', [d.w * 0.36, -d.d * 0.4, 0.26], [d.w * 0.36, d.d * 0.4, 0.26], 0.06, 0.4, tone(C.trim, -0.2)));
    // (a lattice tower each side up to its shoulder, a lattice beam across their heads, a ladder up the back)
    const h = d.shoulder[2] - 0.08;
    for (const s of [1, -1]) {
      const side = s > 0 ? 'r' : 'l';
      sweeps.push(...lattice(`tower_${side}`, 0.06, h, 0.18, 0.18, 0.14, 0.14, C.paint, tone(C.paint, -0.12), { at: [s * (T.x - 0.02), T.y * 0.5] }));
      extrudes.push(box(`head_${side}`, [s * (T.x - 0.02), T.y * 0.5, h], [s * (d.shoulder[0] - 0.02), d.shoulder[1], h + 0.04], 0.18, 0.08, frame));
      sweeps.push(tube(`hose_${side}`, [[s * 0.2, 0, 0.3], [s * (T.x - 0.1), T.y * 0.5, h * 0.6], [s * (d.shoulder[0] - 0.12), d.shoulder[1] + 0.1, d.shoulder[2] - 0.1]], 0.02, C.rubber, 8));
    }
    const beamZ = h * 0.62;
    extrudes.push(box('beamTop', [-(T.x - 0.1), T.y * 0.5, beamZ + 0.06], [T.x - 0.1, T.y * 0.5, beamZ + 0.06], 0.02, 0.02, C.paint));
    extrudes.push(box('beamBottom', [-(T.x - 0.1), T.y * 0.5, beamZ - 0.06], [T.x - 0.1, T.y * 0.5, beamZ - 0.06], 0.02, 0.02, C.paint));
    const zig = [];
    for (let i = 0; i <= 10; i++) zig.push([-(T.x - 0.1) + ((2 * (T.x - 0.1)) * i) / 10, T.y * 0.5, beamZ + (i % 2 ? 0.06 : -0.06)]);
    sweeps.push(tube('beamLace', zig, 0.007, tone(C.paint, -0.12), 6));
    for (let i = 0; i < 6; i++) extrudes.push(box(`rung_${i}`, [-0.12, -d.d / 2 - 0.03, 0.2 + i * 0.16], [0.12, -d.d / 2 - 0.03, 0.2 + i * 0.16], 0.02, 0.02, C.light));
    for (const s of [1, -1]) extrudes.push(box(`ladderRail_${s > 0 ? 'r' : 'l'}`, [s * 0.13, -d.d / 2 - 0.03, 0.12], [s * 0.13, -d.d / 2 - 0.03, 1.12], 0.02, 0.02, frame));
    return { extrudes, lathes, sweeps, hardpoints: { 'shoulder.r': [...d.shoulder], 'shoulder.l': [-d.shoulder[0], d.shoulder[1], d.shoulder[2]] } };
  }
  function sealedPack(row, C) {
    const d = row.dims, T = d.tower, extrudes = [], lathes = [], dark = tone(C.trim, -0.2);
    // (one closed shell, its corners cut deep; its towers closed boxes; a filtered intake, no grille open to the site)
    extrudes.push(plateBox('shell', [0, 0, d.h / 2 + 0.02], d.w + 0.06, d.d + 0.06, d.h + 0.04, 0.14, C.paint));
    extrudes.push(box('intake', [0, -d.d / 2 - 0.04, d.h * 0.62], [0, -d.d / 2 - 0.03, d.h * 0.62], d.w * 0.42, d.h * 0.22, dark));
    extrudes.push(box('seam', [-d.w / 2 - 0.035, 0, d.h * 0.32], [d.w / 2 + 0.035, 0, d.h * 0.32], d.d + 0.07, 0.02, C.light));
    for (const s of [1, -1]) {
      const side = s > 0 ? 'r' : 'l', top = [s * d.shoulder[0], d.shoulder[1], d.shoulder[2] - 0.1];
      extrudes.push(plateBox(`tower_${side}`, [s * (T.x - 0.06), T.y * 0.5, (d.h + top[2]) / 2], T.w + 0.04, T.w + 0.04, top[2] - d.h + 0.1, 0.05, C.paint));
      extrudes.push(box(`arm_${side}`, [s * (T.x - 0.06), T.y * 0.5, top[2]], top, T.w * 0.8, T.w * 0.7, C.paint));
      lathes.push(bellows(`boot_${side}`, add(top, [0, 0, -0.04]), add(top, [0, 0, 0.04]), 0.09, 0.08, C.rubber, 3, 0.01));
    }
    return { extrudes, lathes, hardpoints: { 'shoulder.r': [...d.shoulder], 'shoulder.l': [-d.shoulder[0], d.shoulder[1], d.shoulder[2]] } };
  }

  // ── an electric screw actuator: the ram's place and pins, a screw's construction ─────────────────────────────────
  /** `L` the actuator's barrel and rod lengths (the chain's); its housing square, its motor alongside on a belt case. */
  function screw(row, C, { part = 'barrel' } = {}, L) {
    const d = row.dims, lathes = [], extrudes = [], R = d.bore / 2, housing = tone(C.trim, 0.12), boot = row.build.boot;
    if (part === 'rod') {
      lathes.push(boss('eye', [0, 0, 0], 'x', 0.05, d.rod / 2 + 0.03, tone(C.trim, 0.2), 12));
      lathes.push(spin('screw', [0, 0.04, 0], [0, L.rod, 0], [[0, d.rod / 2], [1, d.rod / 2]], C.chrome, 14));
      if (boot) lathes.push(bellows('boot', [0, 0.06, 0], [0, L.rod * 0.92, 0], d.rod / 2 + 0.03, d.rod / 2 + 0.034, C.rubber, 8, 0.01));
      return { lathes, hardpoints: { eye: [0, 0, 0] } };
    }
    lathes.push(boss('eye', [0, 0, 0], 'x', 0.06, R * 0.7, tone(C.trim, 0.2), 12));
    extrudes.push(box('housing', [0, 0.05, 0], [0, L.barrel, 0], R * 1.7, R * 1.7, housing));
    extrudes.push(box('nose', [0, L.barrel - 0.02, 0], [0, L.barrel + 0.01, 0], R * 1.9, R * 1.9, C.trim));
    // (the motor alongside, its belt case joining it to the screw's end)
    const m = R * 0.75, up = R * 0.85 + m;
    lathes.push(spin('motor', [0, 0.07, up], [0, 0.07 + L.barrel * 0.42, up], [[0, m * 0.9], [0.08, m], [0.92, m], [1, m * 0.8]], C.paint, 14));
    extrudes.push(box('belt', [0, 0.04, 0], [0, 0.07, 0], R * 1.5, (up + m) * 2, C.trim));
    extrudes.push(box('plug', [0, 0.07 + L.barrel * 0.42, up], [0, 0.07 + L.barrel * 0.42 + 0.03, up], m, m, C.light));
    return { lathes, extrudes, hardpoints: { eye: [0, 0, 0] } };
  }

  return {
    upper: beam('upper'), fore: beam('fore'),
    shoulder: { faired: fairedShoulder, truss: trussShoulder, sealed: sealedShoulder },
    pack: { spine: spinePack, gantry: gantryPack, sealed: sealedPack },
    screw,
  };
}
