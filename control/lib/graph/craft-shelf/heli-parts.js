/**
 * heli-parts — the builders of the craft shelf's helicopter kinds (heli-odm.js), merged into CRAFT_BUILDERS: pure
 * functions of a row, its palette's colours and the pose, returning the shelf's monomers in metres and their hardpoints.
 *
 *   heli-rotor  articulated  the mast; the swashplate's fixed lower ring and turning upper ring; a pitch link from the
 *                            upper ring to each blade's horn, leading it; the scissors; the hub and its cap; each blade's
 *                            grip and its elastomeric bearing; the blades (cambered, washing out, drooping toward their
 *                            tips as a rotor at rest does, their tips swept back and banded). Spun by `pose.rotor` (degrees)
 *                            the way its hand turns; its blades swing aft about their grips by the craft's `fold`
 *   heli-tail   rotor        its gearbox out to the side, its hub, its blades turning about the craft's x, the pitch spider
 *               fan          a ducted fan: the shroud's walls (open, the fan inside) and its lips, the hub, the blades
 *                            (spaced unevenly, as a quiet fan's are), the stators behind them; a fin's root on its top
 *   heli-cowl   single|twin  the cowling on the roof, its intakes' grilles each side, its exhaust or two, the transmission's
 *                            fairing round the mast
 *
 * Craft space: +y forward, +z up, +x right, metres. Pure.
 */
import { DEG, airfoil, lathe, loftWorld, sweep, extrudeWorld, section, planeUV, round3, tone } from './craft-common.js';

const r3v = (v) => v.map(round3);
const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
// a flat rectangle's offsets square to an extrude's axis, wound the way the kernel wants it
const rect = (u, v, w, h) => [[0.5, 0.5], [-0.5, 0.5], [-0.5, -0.5], [0.5, -0.5]].map(([a, b]) => [0, 1, 2].map((k) => u[k] * a * w + v[k] * b * h));
const ccw = (from, to, ring) => { const uv = planeUV(from, to, ring), a = uv.reduce((t, p, i) => { const q = uv[(i + 1) % uv.length]; return t + p[0] * q[1] - q[0] * p[1]; }, 0); return a < 0 ? ring.slice().reverse() : ring; };
const box = (id, from, to, u, v, w, h, tint) => extrudeWorld(id, from, to, ccw(from, to, rect(u, v, w, h)), tint);
const TIP_BAND = '#e2c33c';

/** A blade lofted from r0 out to R along `rhat`, travelling `that`, its root at height z0: cambered, twisted from its
 *  root's pitch to its tip's, drooping toward its tip, its tip swept back; split where its tip's band begins. */
function blades(id, { rhat, that, up, r0, R, z0, origin = null, chord, rootPitch, tipPitch, droop = 0, tipSweep = 0, thickness = 0.12, camber = 0, rootChord = 0.8, band = 0.06, tint, bandTint }) {
  // (its root at `origin` in the plane, else r0 out along rhat: a folded blade pivots at its grip's end)
  const foil = airfoil({ thickness, camber }), drop = (R - r0) * Math.tan(droop * DEG), o = origin ?? mul(rhat, r0);
  const at = (f) => add(add(o, mul(rhat, f * (R - r0))), mul(up, z0 - drop * f * f));
  const station = (f, from, to) => {
    const beta = (rootPitch + f * (tipPitch - rootPitch)) * DEG, c = chord * (f < 0.08 ? rootChord + (1 - rootChord) * (f / 0.08) : f > 0.97 ? 1 - 0.45 * ((f - 0.97) / 0.03) : 1);
    const cv = add(mul(that, Math.cos(beta)), mul(up, Math.sin(beta))), nv = add(mul(that, -Math.sin(beta)), mul(up, Math.cos(beta)));
    const back = f > 0.9 ? -tipSweep * chord * ((f - 0.9) / 0.1) : 0;
    const t = (f - from) / (to - from), axisPt = add(at(from), mul(add(at(to), mul(at(from), -1)), t)), off = add(at(f), mul(axisPt, -1));
    return { t, points: foil.map(([x, y]) => add(add(mul(cv, (0.25 - x) * c), mul(nv, y * c)), add(mul(that, back), off))) };
  };
  const fb = 1 - band, lofts = [];
  const part = (pid, fs, tnt) => lofts.push(loftWorld(pid, at(fs[0]), at(fs[fs.length - 1]), fs.map((f) => station(f, fs[0], fs[fs.length - 1])), tnt, { interp: 'smooth' }));
  part(id, [0, 0.08, 0.4, 0.75, fb], tint);
  part(`${id}_tip`, [fb, 0.97, 1], bandTint);
  return lofts;
}

function buildRotor(row, C, opts = {}) {
  const { diameter: D, mast: M } = row.dims, b = row.build, R = D / 2, hub = b.hub;
  if (b.family !== 'articulated') throw new Error(`Unknown heli-rotor family '${b.family}'`);
  const hand = b.hand === 'cw' ? -1 : 1, spin = ((opts.pose && opts.pose.rotor) || 0) * DEG * hand, fold = clamp01(opts.fold);
  const lathes = [
    lathe('mast', [0, 0, 0], [0, 0, M], [[0, hub * 0.3], [1, hub * 0.27]], C.chrome, { samples: 14, crossSections: 2 }),
    lathe('swash_low', [0, 0, M * 0.32], [0, 0, M * 0.32 + 0.05], [[0, hub * 1.05], [1, hub * 1.0]], C.trim, { samples: 24, crossSections: 2 }),
    lathe('swash_up', [0, 0, M * 0.32 + 0.055], [0, 0, M * 0.32 + 0.1], [[0, hub * 0.92], [1, hub * 0.88]], C.chrome, { samples: 24, crossSections: 2 }),
    lathe('hub', [0, 0, M - 0.1], [0, 0, M + 0.1], [[0, hub * 0.9], [0.5, hub], [1, hub * 0.85]], C.trim, { samples: 20, crossSections: 3 }),
    lathe('cap', [0, 0, M + 0.1], [0, 0, M + 0.22], [[0, hub * 0.7], [0.6, hub * 0.5], [1, 0.03]], C.chrome, { samples: 18, crossSections: 3 }),
  ];
  const sweeps = [sweep('scissors', [[hub * 0.32, 0, M * 0.7], [hub * 0.8, 0, M * 0.55], [hub * 0.85, 0, M * 0.32 + 0.1]], 0.014, C.trim, { sides: 6 })];
  const extrudes = [], lofts = [];
  const z = [0, 0, 1];
  for (let k = 0; k < b.blades; k++) {
    // (a blade folds aft about its grip, its tip swinging round to lie along the boom, each a little apart)
    const phi0 = (2 * Math.PI * k) / b.blades + Math.PI / 6 + spin, aft = -Math.PI / 2 + (k - (b.blades - 1) / 2) * 0.06;
    let d = aft - phi0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    const phi = phi0 + fold * d, rh = [Math.cos(phi0), Math.sin(phi0), 0], th = [-Math.sin(phi0) * hand, Math.cos(phi0) * hand, 0];
    const fr = [Math.cos(phi), Math.sin(phi), 0], ft = [-Math.sin(phi) * hand, Math.cos(phi) * hand, 0];
    // the grip and its bearing on the hub's arm; the pitch horn ahead of it; the link down to the upper ring, leading
    extrudes.push(box(`grip_${k}`, add(mul(rh, hub * 0.6), [0, 0, M]), add(mul(rh, hub * 2.3), [0, 0, M]), th, z, hub * 0.6, hub * 0.4, C.trim));
    lathes.push(lathe(`bearing_${k}`, add(mul(rh, hub * 0.85), [0, 0, M]), add(mul(rh, hub * 1.25), [0, 0, M]), [[0, hub * 0.32], [1, hub * 0.3]], C.rubber, { samples: 12, crossSections: 2 }));
    const horn = add(add(mul(rh, hub * 1.3), mul(th, hub * 0.55)), [0, 0, M - 0.03]);
    extrudes.push(box(`horn_${k}`, add(mul(rh, hub * 1.1), [0, 0, M - 0.03]), add(add(mul(rh, hub * 1.1), mul(th, hub * 0.6)), [0, 0, M - 0.03]), rh, z, hub * 0.2, hub * 0.15, C.trim));
    const a = phi0 + 0.35 * hand, low = [Math.cos(a) * hub * 0.85, Math.sin(a) * hub * 0.85, M * 0.32 + 0.1];
    sweeps.push(sweep(`pitch_link_${k}`, [low, horn], 0.014, C.chrome, { sides: 6 }));
    // the blade from the grip's end out, folded about the grip's pivot when the craft folds
    const r0 = Math.max(hub * 2.3, b.root * R);
    lofts.push(...blades(`blade_${k}`, { rhat: fr, that: ft, up: z, r0, R, z0: M, origin: mul(rh, r0), chord: b.chord, rootPitch: b.rootPitch, tipPitch: b.tipPitch, droop: b.droop, tipSweep: b.tipSweep, thickness: b.thickness, camber: b.camber, tint: C.rubber, bandTint: TIP_BAND }));
  }
  const joints = [{ name: 'rotor', control: 'rotor', kind: 'spin', at: [0, 0, round3(M)], dir: [0, 0, hand], range: [0, 360], angle: round3(((opts.pose && opts.pose.rotor) || 0) % 360) }];
  return { lathes, sweeps, extrudes, lofts, hardpoints: { mount: [0, 0, 0], hub: [0, 0, round3(M)] }, joints, ...(fold ? { fold: round3(fold) } : {}) };
}

function buildTail(row, C, opts = {}) {
  const b = row.build, hand = b.hand === 'cw' ? -1 : 1, spin = ((opts.pose && opts.pose.rotor) || 0) * DEG * hand * 4.6;
  const x = [1, 0, 0];
  if (b.family === 'rotor') {
    const { diameter: D, offset: o } = row.dims, R = D / 2, hub = b.hub;
    const lathes = [
      lathe('gearbox', [0, 0, 0], [o * 0.75, 0, 0], [[0, hub * 1.1], [0.6, hub * 1.0], [1, hub * 0.8]], C.paint, { samples: 16, crossSections: 3 }),
      lathe('hub', [o * 0.75, 0, 0], [o, 0, 0], [[0, hub], [1, hub * 0.8]], C.trim, { samples: 16, crossSections: 2 }),
      lathe('spider', [o, 0, 0], [o + hub * 0.9, 0, 0], [[0, hub * 0.5], [0.7, hub * 0.4], [1, hub * 0.1]], C.chrome, { samples: 12, crossSections: 3 }),
    ];
    const lofts = [];
    for (let k = 0; k < b.blades; k++) {
      const phi = (2 * Math.PI * k) / b.blades + spin, rh = [0, Math.cos(phi), Math.sin(phi)], th = [0, -Math.sin(phi) * hand, Math.cos(phi) * hand];
      lofts.push(...blades(`blade_${k}`, { rhat: rh, that: th, up: x, r0: hub * 1.1, R, z0: o * 0.9, chord: b.chord, rootPitch: b.pitch, tipPitch: b.pitch * 0.6, thickness: 0.12, band: 0.12, tint: C.rubber, bandTint: TIP_BAND }));
    }
    const joints = [{ name: 'tail', control: 'rotor', kind: 'spin', at: [round3(o), 0, 0], dir: [hand, 0, 0], range: [0, 360], angle: 0 }];
    return { lathes, lofts, hardpoints: { mount: [0, 0, 0] }, joints };
  }
  if (b.family === 'fan') {
    // the shroud's walls open (the fan turns inside), its lips round both faces; the hub, the blades, the stators aft
    const { diameter: D, depth: d } = row.dims, R = D / 2, hub = b.hub, w = d / 2;
    const ring = (r, xx) => Array.from({ length: 37 }, (_, i) => { const a = (2 * Math.PI * i) / 36; return [xx, r * Math.cos(a), r * Math.sin(a)]; });
    const lathes = [
      lathe('shroud_out', [-w, 0, 0], [w, 0, 0], [[0, R + 0.16], [0.5, R + 0.18], [1, R + 0.16]], C.paint, { samples: 36, crossSections: 3, caps: false }),
      lathe('shroud_in', [-w, 0, 0], [w, 0, 0], [[0, R + 0.03], [0.4, R + 0.008], [1, R + 0.02]], tone(C.paint, -0.25), { samples: 36, crossSections: 3, caps: false }),
      lathe('hub', [-w * 0.6, 0, 0], [w * 0.5, 0, 0], [[0, hub * 0.8], [0.3, hub], [1, hub * 0.85]], C.trim, { samples: 18, crossSections: 3 }),
    ];
    const sweeps = [sweep('lip_l', ring(R + 0.095, -w), 0.068, C.paint, { sides: 8 }), sweep('lip_r', ring(R + 0.095, w), 0.068, C.paint, { sides: 8 })];
    const lofts = [];
    for (let k = 0; k < b.blades; k++) {
      // (spaced unevenly: a fan's blades a little bunched so its tone spreads)
      const phi = (2 * Math.PI * k) / b.blades + 0.18 * Math.sin((4 * Math.PI * k) / b.blades) + spin, rh = [0, Math.cos(phi), Math.sin(phi)], th = [0, -Math.sin(phi) * hand, Math.cos(phi) * hand];
      lofts.push(...blades(`blade_${k}`, { rhat: rh, that: th, up: x, r0: hub, R: R - 0.004, z0: w * 0.15, chord: R * 0.32, rootPitch: 28, tipPitch: 18, thickness: 0.1, band: 0.05, tint: C.trim, bandTint: C.trim }));
    }
    const extrudes = [];
    for (let k = 0; k < (b.stators || 8); k++) {
      const a = (2 * Math.PI * k) / (b.stators || 8) + 0.2, rh = [0, Math.cos(a), Math.sin(a)], tv = [0, -Math.sin(a), Math.cos(a)];
      extrudes.push(box(`stator_${k}`, mul(rh, hub * 0.9), mul(rh, R + 0.02), x, tv, d * 0.28, 0.012, C.trim));
      extrudes[extrudes.length - 1] = { ...extrudes[extrudes.length - 1], axisFrom: { ...extrudes[extrudes.length - 1].axisFrom, x: round3(-w * 0.55) }, axisTo: { ...extrudes[extrudes.length - 1].axisTo, x: round3(-w * 0.55) } };
    }
    const joints = [{ name: 'tail', control: 'rotor', kind: 'spin', at: [0, 0, 0], dir: [hand, 0, 0], range: [0, 360], angle: 0 }];
    return { lathes, sweeps, lofts, extrudes, hardpoints: { mount: [0, 0, 0], finRoot: [0, 0, round3(R + 0.17)] }, joints };
  }
  throw new Error(`Unknown heli-tail family '${b.family}'`);
}

function buildCowl(row, C) {
  const { length: L, width: W, height: H } = row.dims, b = row.build;
  if (b.family !== 'single' && b.family !== 'twin') throw new Error(`Unknown heli-cowl family '${b.family}'`);
  // the cowling lofted nose to tail on the roof (its mount the roof under its mast)
  const yF = b.mastAt * L, yA = yF - L;
  const st = [[0, 0.55, 0.5], [0.14, 0.95, 0.9], [0.6, 1, 1], [0.88, 0.8, 0.8], [1, 0.42, 0.45]].map(([t, w, h]) => ({ t, points: section((w * W) / 2, (h * H) / 2, 3.2, 1).map(([x, z2]) => [x, 0, (h * H) / 2 + z2 - 0.02]) }));
  const lofts = [loftWorld('cowling', [0, yF, 0], [0, yA, 0], st, C.paint, { interp: 'smooth' })];
  const lathes = [lathe('fairing', [0, 0, H * 0.75], [0, 0, H + 0.12], [[0, W * 0.32], [0.6, W * 0.25], [1, W * 0.17]], C.paint, { samples: 22, crossSections: 4 })];
  const extrudes = [], sweeps = [];
  // the intakes' grilles each side, behind the mast: a dark panel, its slats across it
  const yi = yF - b.intakeAt * L;
  for (const sx of [1, -1]) {
    const x = sx * (W / 2 - 0.01);
    extrudes.push(box(`intake_${sx > 0 ? 'r' : 'l'}`, [x - sx * 0.03, yi, H * 0.5], [x + sx * 0.012, yi, H * 0.5], [0, 1, 0], [0, 0, 1], L * 0.18, H * 0.45, C.rubber));
    for (let k = 0; k < 4; k++) sweeps.push(sweep(`slat_${sx > 0 ? 'r' : 'l'}${k}`, [[x + sx * 0.016, yi + L * 0.09, H * (0.33 + k * 0.11)], [x + sx * 0.016, yi - L * 0.09, H * (0.33 + k * 0.11)]], 0.008, C.trim, { sides: 5 }));
  }
  // its exhaust (or two), raked up and aft from the cowling's tail
  const ye = yF - b.exhaustAt * L, xs = b.family === 'twin' ? [W * 0.28, -W * 0.28] : [0];
  for (const [i, xx] of xs.entries()) lathes.push(lathe(`exhaust_${i}`, [xx, ye + 0.08, H * 0.5], [xx, ye - 0.38, H * 0.82], [[0, H * 0.24], [0.7, H * 0.28], [1, H * 0.3]], C.chrome, { samples: 18, crossSections: 3 }));
  return { lofts, lathes, extrudes, sweeps, hardpoints: { mount: [0, 0, 0], mast: [0, 0, round3(H + 0.12)] } };
}

export const HELI_BUILDERS = {
  'heli-rotor': buildRotor,
  'heli-tail': buildTail,
  'heli-cowl': buildCowl,
};
