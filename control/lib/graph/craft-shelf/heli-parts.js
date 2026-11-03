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
 *               pylon        a tandem's rotor pylon: a fairing rising from the roof to its mast, the transmission's fairing
 *                            round the mast's foot; `pods` its engines each side (intake, nacelle, exhaust) on their struts
 *   heli-kit    rockets      a rocket pod: its body, its bands, a tube's mouth in a ring of rings at its face, its lugs on top
 *               rack         a missile rack: its rail beam, its spine down, its rounds in rows each side of the spine
 *               chin         a chin gun's turret: its ring, its drum and cheeks, the gun's receiver and its barrel and brake
 *                            (all modelled, never fired); each kit's mount on its top, where a pylon or the nose carries it
 *               doorGun      a door gun on its pintle: the arm out from the door, the post, the receiver, the barrel ahead,
 *                            the ammunition box under it (modelled, never fired); its mount on the hull's side
 *               cutter       a wire-strike cutter: a toothed blade raked forward from its root (turned down under the chin)
 *               flares       a flare dispenser: its box standing off the skin, its cartridges' mouths in rows on its face
 *               searchlight  a searchlight on its yoke under the belly: the lamp, its bezel and lens looking ahead
 *               hoist        a rescue hoist: its arm out from the roof over the door, the drum, the cable down, its hook
 *               floats       an emergency float pack along a skid's tube (`out` and `drop` from the skid's mount to its tube)
 *
 * Made (an earth part's, absent without the word): the rotor head's bolt ring and blade cuffs, the tail hub's bolts, the
 * cowling's hinge lines and latches (heli-made.js).
 *
 * Craft space: +y forward, +z up, +x right, metres. Pure.
 */
import { DEG, airfoil, lathe, loftWorld, sweep, extrudeWorld, section, planeUV, round3, tone } from './craft-common.js';
import { madeRotorHead, madeTailHub, madeCowling } from './heli-made.js';

// made: the field's finish on a helicopter's parts (heli-made.js), an earth part's only
const madeFor = (row, opts) => Boolean(opts?.made) && row.realm === 'earth';

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
  const extrudes = [], lofts = [], phis = [];
  const z = [0, 0, 1];
  for (let k = 0; k < b.blades; k++) {
    // (a blade folds aft about its grip, its tip swinging round to lie along the boom, each a little apart)
    const phi0 = (2 * Math.PI * k) / b.blades + Math.PI / 6 + spin, aft = -Math.PI / 2 + (k - (b.blades - 1) / 2) * 0.06;
    let d = aft - phi0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    const phi = phi0 + fold * d, rh = [Math.cos(phi0), Math.sin(phi0), 0], th = [-Math.sin(phi0) * hand, Math.cos(phi0) * hand, 0];
    phis.push(phi0);
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
  // made: the hub's bolt ring, a cuff round each blade's root
  if (madeFor(row, opts)) lathes.push(...madeRotorHead({ M, hub, phis, r0: Math.max(hub * 2.3, b.root * R), chord: b.chord, C }).lathes);
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
    if (madeFor(row, opts)) lathes.push(...madeTailHub({ o, hub }).lathes);
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

/** A tandem's rotor pylon: a fairing rising from the roof (its mount under the mast) to the mast's foot, its engines' pods
 *  each side on their struts. */
function buildPylonCowl(row, C) {
  const { length: L, width: W, height: H } = row.dims, b = row.build, yF = b.mastAt * L, yc = yF - L / 2;
  // (its plan a rounded box at the roof, narrowing and shortening as it rises; its top round the mast)
  const plan = (k, l) => section((k * W) / 2, (l * L) / 2, 3, 1).map(([x, y]) => [x, y, 0]);
  const st = [[0, 1, 1], [0.55, 0.9, 0.9], [0.88, 0.72, 0.7], [1, 0.5, 0.48]].map(([t, k, l]) => ({ t, points: plan(k, l) }));
  const lofts = [loftWorld('pylon', [0, yc, -0.02], [0, yc, H], st, C.paint, { interp: 'smooth' })];
  const lathes = [lathe('fairing', [0, 0, H - 0.04], [0, 0, H + 0.12], [[0, W * 0.24], [0.6, W * 0.2], [1, W * 0.14]], C.paint, { samples: 22, crossSections: 3 })];
  const extrudes = [];
  if (b.pods) {
    // its engines each side: a nacelle along the craft, its intake's dark face and lip ahead, its exhaust aft, on a strut
    const { diameter: D, length: pl, at = 0.5 } = b.pods, R = D / 2, z = H * at, half = ((0.9 * W) / 2), x0 = half + R + 0.12;
    for (const sx of [1, -1]) {
      const x = sx * x0, side = sx > 0 ? 'r' : 'l', y0 = yc + pl / 2;
      lathes.push(lathe(`nacelle_${side}`, [x, y0, z], [x, y0 - pl, z], [[0, R * 0.92], [0.08, R], [0.75, R * 0.96], [1, R * 0.7]], C.paint, { samples: 20, crossSections: 4 }));
      lathes.push(lathe(`intake_${side}`, [x, y0 + 0.004, z], [x, y0 - 0.02, z], [[0, R * 0.8], [1, R * 0.8]], C.rubber, { samples: 20, crossSections: 2 }));
      lathes.push(lathe(`exhaust_${side}`, [x, y0 - pl + 0.02, z], [x, y0 - pl - R * 0.6, z], [[0, R * 0.62], [1, R * 0.5]], C.chrome, { samples: 18, crossSections: 2 }));
      extrudes.push(box(`strut_${side}`, [sx * (half - 0.06), y0 - pl * 0.5, z], [x - sx * R * 0.6, y0 - pl * 0.5, z], [0, 1, 0], [0, 0, 1], pl * 0.4, R * 0.35, C.paint));
    }
  }
  return { lofts, lathes, ...(extrudes.length ? { extrudes } : {}), hardpoints: { mount: [0, 0, 0], mast: [0, 0, round3(H + 0.12)] } };
}

function buildCowl(row, C, opts = {}) {
  const { length: L, width: W, height: H } = row.dims, b = row.build;
  if (b.family === 'pylon') return buildPylonCowl(row, C);
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
  // made: the access panels' hinge lines along the cowling's top, their latches along its foot
  if (madeFor(row, opts)) { const mc = madeCowling({ L, W, H, yF, C }); sweeps.push(...mc.sweeps); extrudes.push(...mc.extrudes); }
  return { lofts, lathes, extrudes, sweeps, hardpoints: { mount: [0, 0, 0], mast: [0, 0, round3(H + 0.12)] } };
}

const shift = (m, d) => {
  const p = (q) => ({ x: round3(q.x + d[0]), y: round3(q.y + d[1]), z: round3(q.z + d[2]) });
  return m.path ? { ...m, path: m.path.map((q) => r3v([q[0] + d[0], q[1] + d[1], q[2] + d[2]])) } : { ...m, axisFrom: p(m.axisFrom), axisTo: p(m.axisTo) };
};

/** A helicopter's kit, its mount on its top where a pylon (or the nose) carries it. Modelled, never fired. */
function buildKit(row, C) {
  const b = row.build, y = [0, 1, 0], z = [0, 0, 1], x = [1, 0, 0];
  if (b.family === 'rockets') {
    // a rocket pod: its body hung under its lugs, banded fore and aft, a ring of rings of tubes' mouths at its face
    const { length: L, diameter: D } = row.dims, R = D / 2, zc = -R - 0.02, yF = L / 2;
    const lathes = [
      lathe('body', [0, -yF, zc], [0, yF, zc], [[0, R * 0.78], [0.05, R * 0.97], [0.5, R], [0.95, R * 0.98], [1, R * 0.9]], C.paint, { samples: 20, crossSections: 5 }),
      lathe('band_front', [0, yF - L * 0.06, zc], [0, yF - L * 0.02, zc], [[0, R * 1.015], [1, R * 1.015]], C.trim, { samples: 20, crossSections: 2 }),
      lathe('band_aft', [0, -yF + L * 0.03, zc], [0, -yF + L * 0.07, zc], [[0, R * 1.015], [1, R * 1.015]], C.trim, { samples: 20, crossSections: 2 }),
    ];
    const rt = R * 0.13, d = R * 0.3, tubes = [[0, 0]];
    for (let k = 0; k < 6; k++) tubes.push([d * Math.cos((k * Math.PI) / 3), d * Math.sin((k * Math.PI) / 3)]);
    for (let k = 0; k < 12; k++) tubes.push([2 * d * Math.cos((k * Math.PI) / 6 + Math.PI / 12), 2 * d * Math.sin((k * Math.PI) / 6 + Math.PI / 12)]);
    tubes.slice(0, b.tubes || 19).forEach(([u, v], i) => lathes.push(lathe(`tube_${i}`, [u, yF - 0.01, zc + v], [u, yF + 0.006, zc + v], [[0, rt], [1, rt]], C.rubber, { samples: 10, crossSections: 2 })));
    const extrudes = [-1, 1].map((s) => box(`lug_${s > 0 ? 'f' : 'a'}`, [0, s * L * 0.18, -0.03], [0, s * L * 0.18, 0], x, y, R * 0.25, 0.06, C.trim));
    return { lathes, extrudes, hardpoints: { mount: [0, 0, 0] } };
  }
  if (b.family === 'rack') {
    // a missile rack: its rail beam under the mount, its spine down, its rounds each side of the spine, row under row
    const { length: L, diameter: D } = row.dims, R = D / 2, rows = b.rows || 2, gap = D * 1.25, depth = rows * gap;
    const extrudes = [
      box('beam', [0, L * 0.3, -0.04], [0, -L * 0.3, -0.04], x, z, D * 0.9, 0.08, C.trim),
      box('spine', [0, 0, -0.06], [0, 0, -0.08 - depth + gap * 0.3], x, y, 0.04, L * 0.44, C.trim),
    ];
    const lathes = [];
    for (let r = 0; r < rows; r++) for (const sx of [1, -1]) {
      const id = `round_${r}${sx > 0 ? 'r' : 'l'}`, c = [sx * (R + 0.04), 0, -0.08 - gap * (r + 0.5)];
      const m = [
        lathe(`${id}`, [0, -L / 2, 0], [0, L / 2 - L * 0.08, 0], [[0, R * 0.9], [0.04, R], [1, R]], C.paint, { samples: 14, crossSections: 3 }),
        lathe(`${id}_seeker`, [0, L / 2 - L * 0.08, 0], [0, L / 2, 0], [[0, R], [0.6, R * 0.75], [1, R * 0.12]], C.trim, { samples: 14, crossSections: 3 }),
      ];
      lathes.push(...m.map((q) => shift(q, c)));
      // (its fins crossed at its tail)
      for (const [k, [u, v]] of [[x, z], [z, x]].entries()) extrudes.push(shift(box(`${id}_fin_${k}`, [0, -L / 2 + L * 0.02, 0], [0, -L / 2 + L * 0.14, 0], u, v, D * 2.1, 0.008, C.trim), c));
    }
    return { lathes, extrudes, hardpoints: { mount: [0, 0, 0] } };
  }
  if (b.family === 'chin') {
    // a chin gun: its turret's ring under the mount, its drum across between its cheeks, its receiver and barrel ahead
    const { length: L, diameter: D } = row.dims, R = D / 2, zc = -R * 1.05;
    const lathes = [
      lathe('ring', [0, 0, 0.01], [0, 0, -R * 0.35], [[0, R * 0.95], [1, R * 0.88]], C.trim, { samples: 22, crossSections: 2 }),
      lathe('drum', [-R * 0.62, 0, zc], [R * 0.62, 0, zc], [[0, R * 0.55], [0.5, R * 0.6], [1, R * 0.55]], C.paint, { samples: 20, crossSections: 3 }),
      lathe('receiver', [0, -R * 0.1, zc], [0, R * 1.1, zc], [[0, R * 0.26], [1, R * 0.22]], C.trim, { samples: 14, crossSections: 2 }),
      lathe('barrel', [0, R * 1.1, zc], [0, L, zc], [[0, R * 0.09], [1, R * 0.08]], C.chrome, { samples: 12, crossSections: 2 }),
      lathe('brake', [0, L - 0.12, zc], [0, L + 0.02, zc], [[0, R * 0.13], [1, R * 0.12]], C.trim, { samples: 12, crossSections: 2 }),
    ];
    const extrudes = [-1, 1].map((s) => box(`cheek_${s > 0 ? 'r' : 'l'}`, [s * R * 0.62, R * 0.25, -R * 0.3], [s * R * 0.62, R * 0.25, zc - R * 0.35], y, x, R * 1.0, 0.04, C.paint));
    return { lathes, extrudes, hardpoints: { mount: [0, 0, 0], muzzle: [0, round3(L), round3(zc)] } };
  }
  if (b.family === 'doorGun') {
    // a door gun on its pintle: the arm out from the door's frame, the post up, the receiver and its barrel ahead, the box
    const { length: L, diameter: D, reach: r } = row.dims, zg = 0.18;
    const sweeps = [sweep('arm', [[0, 0, 0], [r * 0.6, 0, 0.02], [r, 0, 0.04]], 0.025, C.trim, { sides: 6 }), sweep('post', [[r, 0, 0.04], [r, 0, zg - 0.04]], 0.022, C.trim, { sides: 6 })];
    const extrudes = [box('receiver', [r, -L * 0.22, zg], [r, L * 0.16, zg], x, z, D * 0.9, D * 1.1, C.rubber), box('ammo', [r - D * 0.9, -L * 0.08, zg - D * 0.4], [r - D * 0.9, L * 0.08, zg - D * 0.4], x, z, D * 1.1, D * 1.5, C.trim)];
    const lathes = [
      lathe('barrel', [r, L * 0.16, zg], [r, L * 0.74, zg], [[0, D * 0.2], [1, D * 0.18]], C.rubber, { samples: 10, crossSections: 2 }),
      lathe('muzzle', [r, L * 0.74, zg], [r, L * 0.78, zg], [[0, D * 0.26], [1, D * 0.24]], C.trim, { samples: 10, crossSections: 2 }),
      lathe('grips', [r, -L * 0.22, zg], [r, -L * 0.3, zg], [[0, D * 0.25], [1, D * 0.2]], C.rubber, { samples: 10, crossSections: 2 }),
    ];
    return { sweeps, extrudes, lathes, hardpoints: { mount: [0, 0, 0], muzzle: r3v([r, L * 0.78, zg]) } };
  }
  if (b.family === 'cutter') {
    // a wire-strike cutter: a toothed blade raked forward from its root, thin across
    const { length: L, height: H } = row.dims, t = 0.012;
    const yz = [[-L * 0.55, 0], [L * 0.1, 0], [L * 0.16, H * 0.22], [L * 0.1, H * 0.28], [L * 0.24, H * 0.5], [L * 0.18, H * 0.56], [L * 0.33, H * 0.8], [L * 0.45, H], [L * 0.05, H * 0.62]];
    const from = [-t, 0, 0], to = [t, 0, 0];
    const extrudes = [extrudeWorld('blade', from, to, ccw(from, to, yz.map(([yy, zz]) => [0, yy, zz])), C.chrome), box('root', [0, -L * 0.25, -0.02], [0, -L * 0.25, 0.04], x, y, 0.07, L * 0.55, C.trim)];
    return { extrudes, hardpoints: { mount: [0, 0, 0] } };
  }
  if (b.family === 'flares') {
    // a flare dispenser: its box standing off the skin (+x), its cartridges' mouths in rows on its face
    const { length: L, height: H, depth: d } = row.dims, rows = b.rows || 2, cols = b.cols || 5;
    const extrudes = [box('box', [-0.02, 0, 0], [d, 0, 0], y, z, L, H, C.trim)];
    const p = Math.min(L / cols, H / rows), m = p * 0.62;
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const yy = (j - (cols - 1) / 2) * (L / cols), zz = (i - (rows - 1) / 2) * (H / rows);
      extrudes.push(box(`cartridge_${i}${j}`, [d - 0.004, yy, zz], [d + 0.006, yy, zz], y, z, m, m, C.rubber));
    }
    return { extrudes, hardpoints: { mount: [0, 0, 0] } };
  }
  if (b.family === 'searchlight') {
    // a searchlight on its yoke under the belly: the bracket down, the fork's cheeks, the lamp looking ahead, its lens
    const { length: L, diameter: D } = row.dims, R = D / 2, zc = -0.1 - R;
    const extrudes = [box('bracket', [0, 0, 0.02], [0, 0, -0.1], x, y, R * 0.8, R * 0.8, C.trim), ...[-1, 1].map((s) => box(`cheek_${s > 0 ? 'r' : 'l'}`, [s * (R + 0.03), 0, -0.08], [s * (R + 0.03), 0, zc - R * 0.3], x, y, 0.025, R * 0.9, C.trim))];
    extrudes.push(box('fork', [0, 0, -0.1], [0, 0, -0.08], x, y, 2 * R + 0.09, R * 0.9, C.trim));
    const lathes = [
      lathe('lamp', [0, -L / 2, zc], [0, L / 2, zc], [[0, R * 0.55], [0.35, R * 0.85], [1, R]], C.paint, { samples: 20, crossSections: 3 }),
      lathe('bezel', [0, L / 2 - 0.01, zc], [0, L / 2 + 0.02, zc], [[0, R * 1.04], [1, R * 1.02]], C.chrome, { samples: 20, crossSections: 2 }),
      lathe('lens', [0, L / 2 + 0.005, zc], [0, L / 2 + 0.024, zc], [[0, R * 0.9], [1, R * 0.88]], C.glass, { material: 'glass', samples: 20, crossSections: 2 }),
    ];
    return { extrudes, lathes, hardpoints: { mount: [0, 0, 0] } };
  }
  if (b.family === 'hoist') {
    // a rescue hoist: its arm out from the roof's edge (+x) over the door, the drum at its end, the cable down, its hook
    const { reach: r, drop: h, diameter: D } = row.dims, R = D / 2;
    const sweeps = [
      sweep('arm', [[0, 0, 0], [r * 0.5, 0, R * 0.9], [r, 0, R * 0.9]], 0.035, C.trim, { sides: 8 }),
      sweep('cable', [[r, 0, -R * 0.4], [r, 0, -h]], 0.006, C.chrome, { sides: 4 }),
      sweep('hook', [[r, 0, -h], [r, 0, -h - 0.08], [r + 0.04, 0, -h - 0.12], [r + 0.07, 0, -h - 0.07]], 0.012, C.chrome, { sides: 6 }),
    ];
    const lathes = [lathe('drum', [r, -R * 1.6, R * 0.2], [r, R * 1.6, R * 0.2], [[0, R * 0.8], [0.15, R], [0.85, R], [1, R * 0.8]], C.paint, { samples: 18, crossSections: 4 })];
    return { sweeps, lathes, hardpoints: { mount: [0, 0, 0] } };
  }
  if (b.family === 'floats') {
    // an emergency float pack along a skid's tube: its bag rolled tight, its straps round it
    const { length: L, diameter: D } = row.dims, R = D / 2, c = [b.out, 0, -b.drop];
    const lathes = [
      lathe('pack', [c[0], -L / 2, c[2]], [c[0], L / 2, c[2]], [[0, R * 0.5], [0.06, R * 0.95], [0.5, R], [0.94, R * 0.95], [1, R * 0.5]], C.trim, { samples: 16, crossSections: 5 }),
      ...[-0.25, 0.25].map((f, i) => lathe(`strap_${i}`, [c[0], L * f - 0.025, c[2]], [c[0], L * f + 0.025, c[2]], [[0, R * 1.03], [1, R * 1.03]], C.rubber, { samples: 16, crossSections: 2 })),
    ];
    return { lathes, hardpoints: { mount: [0, 0, 0] } };
  }
  throw new Error(`Unknown heli-kit family '${b.family}'`);
}

export const HELI_BUILDERS = {
  'heli-rotor': buildRotor,
  'heli-tail': buildTail,
  'heli-cowl': buildCowl,
  'heli-kit': buildKit,
};
