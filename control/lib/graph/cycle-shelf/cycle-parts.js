/**
 * cycle-parts — a builder per kind of part (cycle-odm.js CYCLE_KINDS), each drawing its part in the MACHINE's frame from
 * the chassis solve (cycle-chassis.js) and its own row: a fork stands on the steering axis the solve raked, a swingarm
 * runs from the pivot it found to the rear axle, a wheel turns about the axle of its slot. A part fits the machine it is
 * on, the way a craft hull is handed the canopy it carries.
 *
 *   builder(row, C, { G, slot, side, pose }) → { lathes?, sweeps?, extrudes?, lofts?, hardpoints, joints? }
 *     C      the palette's six colours
 *     G      the solve
 *     slot   front | rear (a wheel, a brake, a fender)
 *     side   r | l (a part built on both sides; the left the mirror of the right)
 *     pose   { stand: 'up' | 'down', steer (degrees) }
 *
 * Pure: no clock, no dice. A part's emission for its row and its machine is a compatibility promise (cycle-shelf.char.test.js).
 */
import {
  DEG, add, bend, cross, extrudeWorld, lathe, lerp, loftWorld, mul, rect, ring, roundRect, sided, sideSign, sub, sweep, tone, unit,
} from './cycle-common.js';

const X = [1, 0, 0];
const tube = (id, pts, r, tint, sides = 8) => sweep(id, pts, r, tint, { sides });
// (a lathe's cross-sections are its profile's own points: a straight one needs two, not the lowerer's default many)
const spin = (id, from, to, pairs, tint, samples = 20) => lathe(id, from, to, pairs, tint, { samples, crossSections: pairs.length });
/** A box from `from` to `to`, `w` across (u) and `h` up (v, from the hint). */
const box = (id, from, to, w, h, tint, up = [0, 0, 1]) => extrudeWorld(id, from, to, rect(sub(to, from), w, h, up), tint);
/** A flat panel square to x, its outline [[y, z]…] round its centroid, from x0 to x1. */
function panel(id, x0, x1, outline, tint) {
  const yc = outline.reduce((s, p) => s + p[0], 0) / outline.length, zc = outline.reduce((s, p) => s + p[1], 0) / outline.length;
  return extrudeWorld(id, [x0, yc, zc], [x1, yc, zc], outline.map(([y, z]) => [0, y - yc, z - zc]), tint);
}
/** A quadratic Bezier through a mount, a crown (its control point) and a tip, sampled at k + 1 points. */
const curve = (a, c, b, k = 6) => Array.from({ length: k + 1 }, (_, i) => { const t = i / k, u = 1 - t; return add(add(mul(a, u * u), mul(c, 2 * u * t)), mul(b, t * t)); });
/** A thin strip along a path (a fender), each span a flat slab overlapping the next, its edges turned down by `skirt`
 *  (a U section: the fender's sides, what reads of it from the side). */
function strip(id, pts, w, thick, tint, { taper = 0.7, skirt = 0 } = {}) {
  const out = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const d = unit(sub(pts[i + 1], pts[i])), from = sub(pts[i], mul(d, i ? 0.008 : 0)), to = add(pts[i + 1], mul(d, i + 2 < pts.length ? 0.008 : 0));
    const f = i / (pts.length - 2 || 1), wi = w * (1 - (1 - taper) * Math.abs(2 * f - 1) ** 2), ax = sub(to, from);
    out.push(extrudeWorld(`${id}_${i}`, from, to, rect(ax, wi, thick, [0, 0, 1]), tint));
    if (skirt) for (const s of [1, -1]) {
      const k = skirt;
      out.push(extrudeWorld(`${id}_${i}_${s > 0 ? 'r' : 'l'}`, from, to, rect(ax, thick, k, [0, 0, 1]).map((p) => add(p, [s * (wi / 2 - thick / 2), 0, -k / 2 + thick / 2])), tint));
    }
  }
  return out;
}
const axleOf = (G, slot) => (slot === 'front' ? G.frontAxle : G.rearAxle);
const need = (G, key) => { if (!G[key]) throw new Error(`cycle part: the chassis card has no '${key}'`); return G[key]; };

// ── the frame ───────────────────────────────────────────────────────────────
function frame(row, C, { G }) {
  const b = row.build, F = need(G, 'frame'), metal = C.chrome, sweeps = [], lathes = [], extrudes = [];
  const mirror = (pts, s) => pts.map((p) => [s * p[0], p[1], p[2]]);
  for (const [side, s] of [['r', 1], ['l', -1]]) {
    sweeps.push(tube(`spar_${side}`, bend([G.head.hi, ...mirror(F.spar, s)], 0.07), b.spar, metal, 10));
    sweeps.push(tube(`cradle_${side}`, bend([G.head.lo, ...mirror(F.down, s), ...mirror(F.cradle, s)], 0.06), b.rail, metal));
    sweeps.push(tube(`sub_${side}`, bend(mirror(F.sub, s), 0.05), b.sub, metal));
    sweeps.push(tube(`strut_${side}`, mirror(F.strut, s), b.sub, metal));
    // (the pivot's plate: where the spar, the cradle and the swingarm meet)
    const pv = [s * 0.116, G.pivot[1], G.pivot[2]];
    extrudes.push(box(`plate_${side}`, [s * 0.104, pv[1], pv[2]], [s * 0.128, pv[1], pv[2]], 0.11, 0.2, metal));
  }
  // the head tube on the steering axis, the swingarm's pivot shaft, the shock's cross member
  lathes.push(spin('head', G.axis.at(G.fork.sLo - 0.01), G.axis.at(G.fork.sHi + 0.01), [[0, 0.03], [0.08, 0.028], [0.92, 0.028], [1, 0.03]], metal));
  lathes.push(spin('pivot', [-0.145, G.pivot[1], G.pivot[2]], [0.145, G.pivot[1], G.pivot[2]], [[0, 0.013], [1, 0.013]], tone(metal, -0.3), 12));
  const top = need(G, 'shock').top;
  lathes.push(spin('shock_mount', [-0.112, top[1], top[2] + 0.02], [0.112, top[1], top[2] + 0.02], [[0, 0.013], [1, 0.013]], metal, 12));
  return { sweeps, lathes, extrudes, hardpoints: { mount: [0, 0, 0], head: G.head.lo, pivot: G.pivot } };
}

// ── the fork ────────────────────────────────────────────────────────────────
function fork(row, C, { G, pose }) {
  const b = row.build, f = G.fork, d = G.axis.d, n = G.axis.n, lathes = [], extrudes = [];
  for (const side of ['r', 'l']) {
    const leg = (s) => f.leg(s, side);
    lathes.push(spin(`outer_${side}`, leg(0.4), leg(f.length), [[0, b.outer * 0.92], [0.04, b.outer], [0.96, b.outer], [1, b.outer * 0.85]], tone(C.trim, 0.25)));
    lathes.push(spin(`inner_${side}`, leg(0.02), leg(0.42), [[0, b.inner], [1, b.inner]], tone(C.chrome, 0.15)));
    if (b.guard) lathes.push(spin(`guard_${side}`, leg(0.07), leg(0.33), [[0, b.inner + 0.004], [0.1, b.inner + 0.009], [0.9, b.inner + 0.009], [1, b.inner + 0.004]], C.paint, 16));
    // (the axle's lug at the foot of the leg)
    extrudes.push(box(`lug_${side}`, leg(-0.035), leg(0.06), 0.05, 0.06, tone(C.trim, 0.1), n));
  }
  lathes.push(spin('axle', add(G.frontAxle, [-f.half - 0.025, 0, 0]), add(G.frontAxle, [f.half + 0.025, 0, 0]), [[0, 0.011], [1, 0.011]], tone(C.chrome, -0.2), 12));
  // the triple clamps, square to the steering axis: each holds both legs and the stem
  const o = G.offset;
  const clamp = (id, s, t) => {
    const c = G.axis.at(s), off = [[0.14, o - 0.03], [0.14, o + 0.035], [0.035, o + 0.05], [-0.035, o + 0.05], [-0.14, o + 0.035], [-0.14, o - 0.03], [-0.04, -0.04], [0.04, -0.04]];
    extrudes.push(extrudeWorld(id, sub(c, mul(d, t / 2)), add(c, mul(d, t / 2)), off.map(([x, m]) => add(mul(X, x), mul(n, m))), tone(C.trim, 0.3)));
  };
  clamp('clamp_lo', f.sLo, 0.03);
  clamp('clamp_hi', f.sHi, 0.022);
  return {
    lathes, extrudes,
    hardpoints: { mount: [0, 0, 0], axle: G.frontAxle },
    joints: [
      { name: 'steer', control: 'steer', kind: 'hinge', at: G.head.lo, dir: d, range: [-40, 40], angle: pose.steer ?? 0 },
      { name: 'fork', control: 'suspension', kind: 'slide', at: G.frontAxle, dir: mul(d, -1), range: [0, 1], travel: row.dims.travel },
    ],
  };
}

// ── the swingarm and the shock ──────────────────────────────────────────────
function swingarm(row, C, { G }) {
  const b = row.build, h = G.swingarm.half, metal = tone(C.chrome, -0.05), lofts = [], lathes = [], sweeps = [];
  for (const [side, s] of [['r', 1], ['l', -1]]) {
    const from = [s * h, G.pivot[1], G.pivot[2]], to = [s * h, -0.02, G.rR], ax = sub(to, from);
    lofts.push(loftWorld(`arm_${side}`, from, to, [
      { t: 0, points: roundRect(ax, b.wall, b.depth, 0.008) },
      { t: 0.45, points: roundRect(ax, b.wall, b.depth * 0.92, 0.008) },
      { t: 1, points: roundRect(ax, b.wall, b.tip, 0.008) },
    ], metal));
  }
  lathes.push(spin('pivot_tube', [-h, G.pivot[1], G.pivot[2]], [h, G.pivot[1], G.pivot[2]], [[0, 0.026], [1, 0.026]], metal, 16));
  const by = 0.45, bz = G.rR + ((G.pivot[2] - G.rR) * by) / G.pivot[1];
  lathes.push(spin('brace', [-h, by, bz + 0.012], [h, by, bz + 0.012], [[0, 0.016], [1, 0.016]], metal, 12));
  lathes.push(spin('axle', [-h - 0.025, 0, G.rR], [h + 0.025, 0, G.rR], [[0, 0.011], [1, 0.011]], tone(C.chrome, -0.2), 12));
  // (the linkage: the shock's foot under the arm, its rod to the frame's cradle)
  const foot = need(G, 'shock').bottom;
  sweeps.push(tube('link', [[0, by - 0.03, bz - 0.01], foot, [0, G.pivot[1] + 0.04, G.frame.cradle[1][2] + 0.02]], 0.014, tone(C.trim, 0.2), 8));
  return {
    lofts, lathes, sweeps,
    hardpoints: { mount: [0, 0, 0], axle: G.rearAxle },
    joints: [{ name: 'swingarm', control: 'suspension', kind: 'hinge', at: G.pivot, dir: X, range: [-12, 18], angle: 0 }],
  };
}

function shock(row, C, { G }) {
  const b = row.build, { top, bottom } = need(G, 'shock'), ax = unit(sub(top, bottom)), L = Math.hypot(...sub(top, bottom));
  const lathes = [
    spin('body', bottom, top, [[0, 0.016], [0.08, 0.016], [0.1, b.body], [0.86, b.body], [0.9, b.body + 0.01], [1, 0.018]], tone(C.trim, 0.15)),
    spin('reservoir', add(lerp(bottom, top, 0.7), [0.045, 0, 0]), add(top, [0.045, -0.01, -0.02]), [[0, 0.019], [1, 0.019]], tone(C.trim, 0.2), 14),
  ];
  // the spring, a coil round the body
  const u = X, v = [0, -ax[2], ax[1]], coil = [], per = 12;
  for (let i = 0; i <= b.turns * per; i++) {
    const t = i / (b.turns * per), a = (2 * Math.PI * i) / per, c = lerp(bottom, top, 0.14 + 0.7 * t);
    coil.push(add(c, add(mul(u, b.coil * Math.cos(a)), mul(v, b.coil * Math.sin(a)))));
  }
  return { lathes, sweeps: [tube('spring', coil, b.wire, C.paint, 5)], hardpoints: { mount: [0, 0, 0], length: [0, 0, L] } };
}

// ── a wheel and its brake ───────────────────────────────────────────────────
function wheel(row, C, { G, slot }) {
  const { radius: R, section: sec, rim } = row.dims, b = row.build, a = axleOf(G, slot), knob = b.tread === 'knobby' ? 0.009 : 0;
  const rc = R - knob - sec / 2, sweeps = [], extrudes = [], lathes = [];
  sweeps.push(tube('tyre', ring(a, X, rc, 48), sec / 2, C.rubber, 12));
  if (knob) {
    // (the knobs: two staggered rows on the crown, a row on each shoulder)
    const N = 30;
    const rows = [[-sec * 0.2, 0], [sec * 0.2, 0.5], [-sec * 0.41, 0.5], [sec * 0.41, 0]];
    rows.forEach(([x, phase], k) => {
      const rr = rc + Math.sqrt(Math.max(0, (sec / 2) ** 2 - x * x));
      for (let i = 0; i < N; i++) {
        const t = ((i + phase) * 2 * Math.PI) / N, rad = [0, Math.cos(t), Math.sin(t)], tan = [0, -Math.sin(t), Math.cos(t)];
        const p = add(a, add([x, 0, 0], mul(rad, rr - 0.003)));
        extrudes.push(extrudeWorld(`knob_${k}_${i}`, p, add(p, mul(rad, knob + 0.003)), rect(rad, k < 2 ? 0.022 : 0.016, 0.02, tan), C.rubber));
      }
    });
  }
  // the rim: its two flanges and its bed
  const half = Math.min(0.03, sec * 0.3);
  for (const [k, x] of [['r', half], ['l', -half]]) sweeps.push(tube(`rim_${k}`, ring(add(a, [x, 0, 0]), X, rim + 0.002, 40), 0.006, C.chrome, 6));
  sweeps.push(tube('rim_bed', ring(a, X, rim - 0.006, 40), 0.009, tone(C.chrome, -0.1), 6));
  // the hub and its spokes, laced tangentially from each flange to the rim
  const [h0, h1] = need(G, 'hubs')[slot], hr = b.hub;
  lathes.push(spin('hub', add(a, [h0, 0, 0]), add(a, [h1, 0, 0]), [[0, hr * 0.7], [0.08, hr], [0.2, hr], [0.28, hr * 0.62], [0.72, hr * 0.62], [0.8, hr], [0.92, hr], [1, hr * 0.7]], tone(C.chrome, -0.15)));
  const n = b.spokes;
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n, left = i % 2, lean = (i % 4 < 2 ? 1 : -1) * 0.55;
    const hub = add(a, [left ? h0 + 0.012 : h1 - 0.012, hr * 0.85 * Math.cos(t + lean), hr * 0.85 * Math.sin(t + lean)]);
    const out = add(a, [left ? -half * 0.4 : half * 0.4, (rim - 0.012) * Math.cos(t), (rim - 0.012) * Math.sin(t)]);
    sweeps.push(tube(`spoke_${i}`, [hub, out], 0.0019, C.chrome, 4));
  }
  return {
    sweeps, extrudes, lathes,
    hardpoints: { mount: [0, 0, 0], axle: a, contact: [0, a[1], 0] },
    joints: [{ name: `roll_${slot}`, control: 'roll', kind: 'spin', at: a, dir: X, range: [0, 360], angle: 0 }],
  };
}

function brake(row, C, { G, slot }) {
  const R = row.dims.radius, b = row.build, a = axleOf(G, slot), at = need(G, 'brakes')[slot], x = at.x;
  const lathes = [spin('disc', add(a, [x - b.thick / 2, 0, 0]), add(a, [x + b.thick / 2, 0, 0]), [[0, R], [1, R]], tone(C.chrome, 0.1), 32)];
  lathes.push(spin('carrier', add(a, [x - 0.006, 0, 0]), add(a, [x + 0.006, 0, 0]), [[0, R * 0.42], [1, R * 0.42]], tone(C.chrome, -0.25), 20));
  // the caliper straddling the disc's edge at its angle round the axle
  const t = at.caliper * DEG, rad = [0, Math.cos(t), Math.sin(t)], tan = [0, -Math.sin(t), Math.cos(t)], [cw, cl, ch] = b.caliper;
  const c = add(a, add([x, 0, 0], mul(rad, R - ch * 0.35)));
  const off = [add(mul(tan, cl / 2), mul(rad, ch / 2)), add(mul(tan, -cl / 2), mul(rad, ch / 2)), add(mul(tan, -cl / 2), mul(rad, -ch / 2)), add(mul(tan, cl / 2), mul(rad, -ch / 2))];
  const extrudes = [extrudeWorld('caliper', add(c, [-cw / 2, 0, 0]), add(c, [cw / 2, 0, 0]), off, tone(C.trim, 0.35))];
  // (its bracket to the leg or the arm it rides on)
  const to = slot === 'front' ? G.fork.leg(0.08, x < 0 ? 'l' : 'r') : [Math.sign(x) * G.swingarm.half, 0.12, G.rR + 0.02];
  const sweeps = [tube('bracket', [c, to], 0.009, tone(C.trim, 0.2), 6)];
  return { lathes, extrudes, sweeps, hardpoints: { mount: [0, 0, 0] } };
}

// ── the engine and its cooling ──────────────────────────────────────────────
function engine(row, C, { G }) {
  const E = need(G, 'engine'), [hx, hy, hz] = E.half, c = E.at, b = row.build, dark = C.trim, lathes = [], lofts = [], extrudes = [];
  const oct = [[hy, -hz * 0.55], [hy, hz * 0.7], [hy * 0.55, hz], [-hy * 0.6, hz], [-hy, hz * 0.45], [-hy, -hz * 0.6], [-hy * 0.5, -hz], [hy * 0.6, -hz]];
  extrudes.push(extrudeWorld('cases', [c[0] - hx, c[1], c[2]], [c[0] + hx, c[1], c[2]], oct.map(([y, z]) => [0, y, z]), tone(dark, 0.15)));
  // the side covers: the stator's on the left, the clutch's on the right
  lathes.push(spin('cover_l', [c[0] - hx - 0.014, c[1] - 0.04, c[2] - 0.01], [c[0] - hx + 0.002, c[1] - 0.04, c[2] - 0.01], [[0, 0.07], [0.6, 0.08], [1, 0.08]], tone(dark, 0.3), 24));
  lathes.push(spin('cover_r', [c[0] + hx - 0.002, c[1] + 0.03, c[2] - 0.02], [c[0] + hx + 0.018, c[1] + 0.03, c[2] - 0.02], [[0, 0.088], [0.4, 0.088], [1, 0.075]], tone(dark, 0.3), 24));
  // the cylinder leaning forward, its head, its cover
  const u = [0, Math.sin(b.tilt * DEG), Math.cos(b.tilt * DEG)], base = add(c, [0, 0.06, hz - 0.01]), at = (k) => add(base, mul(u, k));
  const block = (id, k0, k1, w, l, r, tint) => lofts.push(loftWorld(id, at(k0), at(k1), [{ t: 0, points: roundRect(u, w, l, r, 2, [0, 1, 0]) }, { t: 1, points: roundRect(u, w, l, r, 2, [0, 1, 0]) }], tint));
  block('cylinder', 0, 0.17, b.bore + 0.03, b.bore + 0.02, 0.012, tone(dark, 0.4));
  block('head', 0.17, 0.25, b.bore + 0.055, b.bore + 0.035, 0.015, tone(dark, 0.45));
  block('cover', 0.25, 0.275, b.bore + 0.03, b.bore + 0.01, 0.01, tone(dark, 0.05));
  // (the throttle body back to the airbox under the seat)
  lathes.push(spin('intake', add(at(0.2), [0, -0.06, 0]), [0, c[1] - 0.2, c[2] + 0.36], [[0, 0.026], [1, 0.03]], tone(dark, 0.2), 14));
  return { lathes, lofts, extrudes, hardpoints: { mount: [0, 0, 0], port: G.exhaust.port, head: at(0.21) } };
}

function radiator(row, C, { G, side }) {
  const R = need(G, 'radiator'), s = sideSign(side), c = sided(R.at, side), { length: l, height: h, thick: t } = row.dims;
  const lean = R.lean * DEG, up = [0, -Math.sin(lean), Math.cos(lean)], fwd = [0, Math.cos(lean), Math.sin(lean)];
  const off = [add(mul(fwd, l / 2), mul(up, -h / 2)), add(mul(fwd, l / 2), mul(up, h / 2)), add(mul(fwd, -l / 2), mul(up, h / 2)), add(mul(fwd, -l / 2), mul(up, -h / 2))];
  const extrudes = [extrudeWorld('core', add(c, [-t / 2, 0, 0]), add(c, [t / 2, 0, 0]), off, tone(C.trim, -0.2))];
  const head = G.engine.at;
  const sweeps = [tube('hose', [add(c, add(mul(up, h * 0.42), mul(fwd, -l * 0.45))), [s * 0.07, head[1] + 0.12, head[2] + 0.36], [s * 0.04, head[1] + 0.1, head[2] + 0.34]], 0.012, tone(C.trim, 0.1), 8)];
  return { extrudes, sweeps, hardpoints: { mount: [0, 0, 0] } };
}

// ── the final drive and the exhaust ─────────────────────────────────────────
/** A belt round two pulleys in the plane square to x: the closed loop (its first point repeated last). */
function beltLoop(x, c1, r1, c2, r2, step = 8 * DEG) {
  // c1 the small (front) pulley, c2 the large (rear); e from c2 to c1
  const D = Math.hypot(c1[0] - c2[0], c1[1] - c2[1]), phi = Math.atan2(c1[1] - c2[1], c1[0] - c2[0]), beta = Math.asin((r2 - r1) / D);
  const aU = phi + (Math.PI / 2 - beta), aL = phi - (Math.PI / 2 - beta), P = (c, r, t) => [x, c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)];
  const out = [];
  const arc = (c, r, a0, a1) => { const k = Math.max(2, Math.ceil(Math.abs(a1 - a0) / step)); for (let i = 0; i <= k; i++) out.push(P(c, r, a0 + ((a1 - a0) * i) / k)); };
  arc(c1, r1, aU, aL);
  arc(c2, r2, aL, aU - 2 * Math.PI);
  out.push([...out[0]]);
  return out;
}

function drive(row, C, { G }) {
  const D = need(G, 'drive'), b = row.build, x = D.x, front = D.front, rear = [0, G.rR];
  const lathes = [
    spin('sprocket_f', [x - 0.004, front[0], front[1]], [x + 0.004, front[0], front[1]], [[0, b.front], [1, b.front]], tone(C.chrome, -0.2), 16),
    spin('sprocket_r', [x - 0.003, 0, G.rR], [x + 0.003, 0, G.rR], [[0, b.rear], [1, b.rear]], tone(C.chrome, 0.05), 32),
  ];
  const sweeps = [tube('chain', beltLoop(x, front, b.front + 0.006, rear, b.rear + 0.006), 0.006, tone(C.trim, -0.1), 5)];
  return { lathes, sweeps, hardpoints: { mount: [0, 0, 0], front: [x, front[0], front[1]], rear: [x, 0, G.rR] } };
}

function exhaust(row, C, { G }) {
  const E = need(G, 'exhaust'), b = row.build, steel = tone(C.chrome, -0.12);
  const sweeps = [tube('header', bend([E.port, ...E.header], 0.06, 5), b.pipe, steel, 10)];
  const [c0, c1] = E.can;
  const lathes = [
    spin('can', c0, c1, [[0, b.can * 0.55], [0.06, b.can], [0.9, b.can], [0.97, b.can * 0.85], [1, b.can * 0.6]], tone(C.chrome, 0.08), 20),
    spin('outlet', c1, add(c1, mul(unit(sub(c1, c0)), 0.04)), [[0, 0.018], [1, 0.018]], steel, 12),
  ];
  // (its strap to the subframe)
  const mid = lerp(c0, c1, 0.6), sub0 = G.frame.sub[1];
  sweeps.push(tube('strap', [mid, [sub0[0], mid[1], sub0[2] - 0.01]], 0.007, tone(C.trim, 0.1), 6));
  return { sweeps, lathes, hardpoints: { mount: [0, 0, 0] } };
}

// ── what the rider meets ────────────────────────────────────────────────────
function tank(row, C, { G }) {
  const T = need(G, 'tank'), [y0, y1] = T.y, [z0, z1] = T.z, zc = (z0 + z1) / 2, h = z1 - z0, w = T.width, ax = [0, 1, 0];
  const lofts = [loftWorld('tank', [0, y0, zc], [0, y1, zc], [
    { t: 0, points: roundRect(ax, w * 0.8, h * 0.85, 0.04) },
    { t: 0.5, points: roundRect(ax, w, h, 0.05) },
    { t: 1, points: roundRect(ax, w * 0.72, h * 0.8, 0.04) },
  ], tone(C.light, -0.12))];
  const lathes = [spin('cap', [0, y1 - 0.06, z1 - 0.01], [0, y1 - 0.06, z1 + 0.022], [[0, 0.026], [1, 0.022]], C.trim, 16)];
  return { lofts, lathes, hardpoints: { mount: [0, 0, 0] } };
}

function seat(row, C, { G }) {
  const S = need(G, 'seat'), [y0, y1] = S.y, th = row.build.thick, w = row.dims.width, zc = S.z - th / 2, ax = [0, 1, 0];
  const st = (t, wk, lift) => ({ t, points: roundRect(ax, w * wk, th, 0.03).map((p) => add(p, [0, 0, lift])) });
  const lofts = [loftWorld('seat', [0, y0, zc], [0, y1, zc], [
    st(0, 0.62, 0.002), st(0.15, 0.85, 0), st(0.55, 1, 0), st(0.78, 0.92, 0.004), st(0.92, 0.66, (S.nose - S.z) * 0.7), st(1, 0.46, S.nose - S.z),
  ], C.rubber)];
  return { lofts, hardpoints: { mount: [0, 0, 0], seat: [0, S.ride, S.z] } };
}

function bars(row, C, { G }) {
  const b = row.build, W = row.dims.width / 2, rise = row.dims.rise, [, by, bz] = G.barsAt, metal = C.chrome;
  const half = [[0.11, by, bz + 0.005], [W - 0.17, by - 0.055, bz + rise - 0.006], [W, by - 0.075, bz + rise]];
  const path = [...half.slice().reverse().map(([x, y, z]) => [-x, y, z]), ...half];
  const sweeps = [tube('bar', bend(path, 0.05, 5), b.tube, metal, 10)];
  const lathes = [spin('pad', [-0.09, by + 0.004, bz + 0.03], [0.09, by + 0.004, bz + 0.03], [[0, 0.02], [0.1, 0.022], [0.9, 0.022], [1, 0.02]], C.trim, 14)];
  for (const [side, s] of [['r', 1], ['l', -1]]) {
    const end = [s * W, by - 0.075, bz + rise], inner = lerp([s * (W - 0.17), by - 0.055, bz + rise - 0.006], end, 0.25);
    lathes.push(spin(`grip_${side}`, inner, end, [[0, b.grip], [0.1, b.grip * 1.12], [0.9, b.grip * 1.12], [1, b.grip * 1.25]], C.rubber, 14));
    const perch = lerp([s * (W - 0.17), by - 0.055, bz + rise - 0.006], end, 0.12);
    sweeps.push(tube(`lever_${side}`, [perch, add(perch, [s * 0.05, 0.035, -0.012]), add(perch, [s * 0.15, 0.05, -0.03])], 0.006, tone(C.trim, 0.25), 6));
    // (the risers up from the top clamp to the bar)
    const foot = add(G.axis.at(G.fork.sHi + 0.012), [s * 0.05, 0, 0]);
    lathes.push(spin(`riser_${side}`, foot, [s * 0.05, by, bz], [[0, 0.018], [1, 0.016]], tone(C.trim, 0.3), 12));
  }
  const grip = (s) => [s * (W - 0.065), by - 0.072, bz + rise];
  return { sweeps, lathes, hardpoints: { mount: [0, 0, 0], 'grip.r': grip(1), 'grip.l': grip(-1) } };
}

// ── the body ────────────────────────────────────────────────────────────────
function body(row, C, { G, side }) {
  const b = row.build, P = need(G, b.place), extrudes = [];
  if (b.family === 'fender') {
    extrudes.push(...strip('fender', curve(P.mount, P.crown, P.tip, 10), row.dims.width, b.thick, C.paint, { skirt: b.skirt ?? 0 }));
  } else if (b.family === 'plate') {
    const n = G.axis.n, d = G.axis.d, c = add(G.axis.at(P.s), mul(n, P.ahead + G.offset));
    extrudes.push(extrudeWorld('plate', sub(c, mul(n, b.thick / 2)), add(c, mul(n, b.thick / 2)), roundRect(n, row.dims.width, row.dims.height, 0.035, 3, d), C.paint));
    const [fw, fh] = b.field, f = add(c, mul(d, -0.01));
    extrudes.push(extrudeWorld('field', add(f, mul(n, b.thick / 2 - 0.001)), add(f, mul(n, b.thick / 2 + 0.002)), roundRect(n, fw, fh, 0.05, 4, d), C.light));
  } else if (b.family === 'sidePanel') {
    const s = sideSign(side), x0 = s * P.x, x1 = s * (P.x + b.thick);
    extrudes.push(panel('panel', x0, x1, P.outline, C[b.tint || 'paint']));
  } else throw new Error(`cycle body: no family '${b.family}'`);
  return { extrudes, hardpoints: { mount: [0, 0, 0] } };
}

function peg(row, C, { G, side }) {
  const P = need(G, 'peg'), s = sideSign(side), at = sided(P.at, side), out = add(at, [s * P.out, 0, 0]), w = row.dims.width;
  const extrudes = [box('peg', at, out, w, 0.022, tone(C.chrome, -0.1), [0, 0, 1])];
  for (let k = 0; k < 3; k++) {
    const x = at[0] + s * (0.025 + 0.035 * k);
    extrudes.push(box(`cleat_${k}`, [x, at[1], at[2] + 0.01], [x + s * 0.012, at[1], at[2] + 0.01], w, 0.012, tone(C.chrome, -0.25), [0, 0, 1]));
  }
  const lathes = [spin('spring', [at[0] - s * 0.012, at[1], at[2]], [at[0] + s * 0.012, at[1], at[2]], [[0, 0.016], [1, 0.016]], tone(C.trim, 0.1), 12)];
  return { extrudes, lathes, hardpoints: { mount: [0, 0, 0], peg: [at[0] + s * P.out * 0.55, at[1], at[2] + 0.011] } };
}

function stand(row, C, { G, pose }) {
  const S = need(G, 'stand'), down = pose.stand === 'down', foot = down ? S.down : S.up, b = row.build;
  const knee = lerp(S.pivot, foot, 0.5), metal = tone(C.trim, 0.2);
  const sweeps = [tube('leg', [S.pivot, add(knee, down ? [-0.01, 0, 0] : [0, 0, -0.012]), foot], b.tube, metal, 8)];
  const dir = unit(sub(foot, S.pivot));
  const extrudes = [box('foot', sub(foot, mul(dir, 0.012)), add(foot, mul(dir, 0.004)), 0.04, 0.03, metal, [0, 1, 0])];
  return {
    sweeps, extrudes,
    hardpoints: { mount: [0, 0, 0], ...(down ? { foot } : {}) },
    joints: [{ name: 'stand', control: 'stand', kind: 'hinge', at: S.pivot, dir: unit(cross(sub(S.down, S.pivot), sub(S.up, S.pivot))), range: [0, 1], angle: down ? 1 : 0 }],
  };
}

export const CYCLE_BUILDERS = Object.freeze({
  'cycle-frame': frame,
  'cycle-fork': fork,
  'cycle-swingarm': swingarm,
  'cycle-shock': shock,
  'cycle-wheel': wheel,
  'cycle-brake': brake,
  'cycle-engine': engine,
  'cycle-radiator': radiator,
  'cycle-drive': drive,
  'cycle-exhaust': exhaust,
  'cycle-tank': tank,
  'cycle-seat': seat,
  'cycle-bars': bars,
  'cycle-body': body,
  'cycle-peg': peg,
  'cycle-stand': stand,
});

export { beltLoop };
