/**
 * cycle-families — the part families beyond the motocross machine's (cycle-parts.js keeps those): a kind's builder is
 * its family's when a row names one here. Each draws in the machine's frame from the chassis solve and its card, the
 * way every cycle part does (cycle-parts.js).
 *
 *   frame     tubes (each tube a path on the card), trellis (two rails a side laced by diagonals)
 *   fork      telescopic (stanchions up in the clamps, sliders below), rigid (a bicycle's blades and crown)
 *   swingarm  roadArm (its arms, its pivot, its brace, a linkage only where the card draws one)
 *   shock     twin (a shock each side, from the arm's end to the subframe)
 *   wheel     cast (a road tyre on a cast rim, its spokes flat bars), wire (a light rim on many thin spokes)
 *   brake     twin (a disc each side of the front wheel, a caliper on each leg), drum (a drum in the hub)
 *   engine    inline (n cylinders abreast), vee (two finned cylinders in a V), swingUnit (a scooter's engine and its
 *             belt case, the arm the rear wheel rides on), flat (a finned single laid forward), midDrive (a motor at
 *             the cranks)
 *   radiator  front (one core ahead of the engine)
 *   drive     belt, pedal (cranks, pedals, a chainring, a cassette, a chain on the right)
 *   exhaust   pipes (any number of headers, each with its silencer or into another's)
 *   tank      pod (a tank lofted along the machine)
 *   seat      contour (a seat lofted from its card's stations), saddle (a bicycle's, on its post)
 *   bars      roadBar (a bar on risers, its grips, levers and mirrors), clipOn (a bar clamped to each fork leg),
 *             stemBar (a bicycle's bar on its stem), cowled (a scooter's bar inside its headset)
 *   body      pod (a tail, a fairing, a belly pan, a scooter's body), slab (a leg shield, a floor), screen
 *   lamp      head, tail
 *   peg       road (a peg on its hanger), floor (a floorboard: the rider's feet on it)
 *   battery   downtube (an e-bike's battery along its down tube)
 *
 * Pure: no clock, no dice.
 */
import { DEG, add, bend, cross, extrudeWorld, lerp, loftWorld, mul, rect, ring, roundRect, sideSign, sub, tone, unit } from './cycle-common.js';
import { at, axleOf, beltLoop, box, curve, need, panel, pod, spin, strip, tube } from './cycle-kit.js';

const X = [1, 0, 0];
const NEON = 'neon';
const CHROME = { metal: 'chrome', finish: 'mirror' };
const CHAIN = { metal: 'steel', finish: 'blasted' };
const LEATHER = 'leather';
const glow = (m) => ({ ...m, material: NEON });
const made = (m, material) => ({ ...m, material });
const len = (v) => Math.hypot(v[0], v[1], v[2]);

/** A polyline resampled at n + 1 points evenly along its length. */
function resample(pts, n) {
  const seg = [], acc = [0];
  for (let i = 0; i + 1 < pts.length; i++) { seg.push(len(sub(pts[i + 1], pts[i]))); acc.push(acc[i] + seg[i]); }
  const L = acc.at(-1), out = [];
  for (let k = 0; k <= n; k++) {
    const s = (L * k) / n;
    let i = 0;
    while (i < seg.length - 1 && acc[i + 1] < s) i++;
    out.push(lerp(pts[i], pts[i + 1], seg[i] ? (s - acc[i]) / seg[i] : 0));
  }
  return out;
}
/** The steering joints every front end has: the steer about the head, the fork's travel along its legs. */
const frontJoints = (G, pose, travel) => [
  { name: 'steer', control: 'steer', kind: 'hinge', at: G.head.lo, dir: G.axis.d, range: [-40, 40], angle: pose.steer ?? 0 },
  { name: 'fork', control: 'suspension', kind: 'slide', at: G.frontAxle, dir: mul(G.axis.d, -1), range: [0, 1], travel },
];
/** The triple clamps square to the steering axis, holding both legs and the stem. */
function clamps(G, C, { lo = 0.03, hi = 0.022, wide = 0.135 } = {}) {
  const d = G.axis.d, n = G.axis.n, o = G.offset, out = [];
  const clamp = (id, s, t) => {
    const c = G.axis.at(s), off = [[wide, o - 0.03], [wide, o + 0.035], [0.035, o + 0.05], [-0.035, o + 0.05], [-wide, o + 0.035], [-wide, o - 0.03], [-0.04, -0.04], [0.04, -0.04]];
    out.push(extrudeWorld(id, sub(c, mul(d, t / 2)), add(c, mul(d, t / 2)), off.map(([x, m]) => add(mul(X, x), mul(n, m))), tone(C.trim, 0.3)));
  };
  clamp('clamp_lo', G.fork.sLo, lo);
  clamp('clamp_hi', G.fork.sHi, hi);
  return out;
}

// ── frames ──────────────────────────────────────────────────────────────────
function frameTubes(row, C, { G }) {
  const F = need(G, 'frame'), metal = F.tint ? C[F.tint] : C.chrome, sweeps = [], lathes = [], extrudes = [];
  for (const t of F.tubes ?? []) {
    for (const side of t.pair ? ['r', 'l'] : [null]) {
      const pts = t.pts.map((p) => at(G, p, side));
      sweeps.push(tube(`${t.id}${side ? `_${side}` : ''}`, t.bend === 0 ? pts : bend(pts, t.bend ?? 0.05), t.r, metal, t.sides ?? 8));
    }
  }
  if (row.build.family === 'trellis') {
    const T = F.trellis;
    for (const side of ['r', 'l']) {
      const up = resample(T.upper.map((p) => at(G, p, side)), T.n), lo = resample(T.lower.map((p) => at(G, p, side)), T.n);
      sweeps.push(tube(`rail_up_${side}`, up, T.r, metal, 8), tube(`rail_lo_${side}`, lo, T.r, metal, 8));
      for (let k = 0; k < T.n; k++) sweeps.push(tube(`lace_${side}_${k}`, k % 2 ? [lo[k], up[k + 1]] : [up[k], lo[k + 1]], T.r * 0.8, metal, 6));
    }
  }
  lathes.push(spin('head', G.axis.at(G.fork.sLo - 0.01), G.axis.at(G.fork.sHi + 0.01), [[0, F.head ?? 0.03], [1, F.head ?? 0.03]], metal));
  if (G.pivot && F.plates !== false) {
    for (const [side, s] of [['r', 1], ['l', -1]]) extrudes.push(box(`plate_${side}`, [s * (G.swingarm.half - 0.026), G.pivot[1], G.pivot[2]], [s * (G.swingarm.half - 0.002), G.pivot[1], G.pivot[2]], 0.1, 0.16, metal));
    lathes.push(spin('pivot', [-G.swingarm.half - 0.02, G.pivot[1], G.pivot[2]], [G.swingarm.half + 0.02, G.pivot[1], G.pivot[2]], [[0, 0.013], [1, 0.013]], tone(metal, -0.3), 12));
  }
  for (const [k, c] of (F.cross ?? []).entries()) lathes.push(spin(`cross_${k}`, [-c.half, c.at[1], c.at[2]], [c.half, c.at[1], c.at[2]], [[0, c.r ?? 0.012], [1, c.r ?? 0.012]], metal, 12));
  if (G.bb) lathes.push(spin('bb', [-0.035, G.bb[1], G.bb[2]], [0.035, G.bb[1], G.bb[2]], [[0, 0.022], [1, 0.022]], metal, 16));
  return { sweeps, lathes, extrudes, hardpoints: { mount: [0, 0, 0], head: G.head.lo, ...(G.pivot ? { pivot: G.pivot } : {}) } };
}

// ── forks ───────────────────────────────────────────────────────────────────
function forkTelescopic(row, C, { G, pose }) {
  const b = row.build, f = G.fork, lathes = [], extrudes = [];
  for (const side of ['r', 'l']) {
    const leg = (s) => f.leg(s, side);
    lathes.push(made(spin(`stanchion_${side}`, leg(0.3), leg(f.length), [[0, b.inner], [1, b.inner]], tone(C.chrome, 0.2)), CHROME));
    lathes.push(spin(`slider_${side}`, leg(-0.03), leg(b.slider ?? 0.38), [[0, b.outer * 0.8], [0.06, b.outer], [0.9, b.outer], [1, b.inner + 0.004]], tone(C.chrome, -0.05), 16));
    if (b.covers) lathes.push(spin(`cover_${side}`, leg(f.sLo - 0.1), leg(f.sLo - 0.005), [[0, b.inner + 0.004], [1, b.inner + 0.01]], C.paint, 16));
    extrudes.push(box(`lug_${side}`, leg(-0.03), leg(0.05), b.outer * 1.6, b.outer * 1.8, tone(C.chrome, -0.1), G.axis.n));
  }
  lathes.push(spin('axle', add(G.frontAxle, [-f.half - 0.02, 0, 0]), add(G.frontAxle, [f.half + 0.02, 0, 0]), [[0, 0.01], [1, 0.01]], tone(C.chrome, -0.2), 12));
  extrudes.push(...clamps(G, C, { wide: f.half + 0.035 }));
  return { lathes, extrudes, hardpoints: { mount: [0, 0, 0], axle: G.frontAxle }, joints: frontJoints(G, pose, row.dims.travel) };
}

function forkRigid(row, C, { G, pose }) {
  const b = row.build, f = G.fork, sweeps = [], lathes = [], extrudes = [];
  const crown = G.axis.at(f.sLo - 0.03);
  for (const [side, s] of [['r', 1], ['l', -1]]) {
    const foot = add(G.frontAxle, [s * f.half, 0, 0]), top = add(crown, [s * f.half, 0, 0]), mid = add(lerp(foot, top, 0.55), mul(G.axis.n, G.offset * 0.35));
    sweeps.push(tube(`blade_${side}`, curve(foot, mid, top, 6), b.blade, C[b.tint || 'paint'], 8));
    extrudes.push(box(`dropout_${side}`, sub(foot, mul(G.axis.d, 0.012)), add(foot, mul(G.axis.d, 0.03)), 0.01, 0.03, tone(C.chrome, -0.15), G.axis.n));
  }
  extrudes.push(box('crown', add(crown, [-f.half - 0.012, 0, 0]), add(crown, [f.half + 0.012, 0, 0]), 0.035, 0.022, C[b.tint || 'paint'], G.axis.d));
  lathes.push(spin('steerer', crown, G.axis.at(f.sHi + 0.03), [[0, 0.0145], [1, 0.0145]], tone(C.chrome, -0.2), 12));
  lathes.push(spin('axle', add(G.frontAxle, [-f.half - 0.008, 0, 0]), add(G.frontAxle, [f.half + 0.008, 0, 0]), [[0, 0.005], [1, 0.005]], C.chrome, 10));
  return { sweeps, lathes, extrudes, hardpoints: { mount: [0, 0, 0], axle: G.frontAxle }, joints: frontJoints(G, pose, 0) };
}

// ── the rear ────────────────────────────────────────────────────────────────
function roadArm(row, C, { G }) {
  const b = row.build, h = G.swingarm.half, metal = tone(C.chrome, -0.05), lofts = [], lathes = [], sweeps = [];
  for (const [side, s] of [['r', 1], ['l', -1]]) {
    const from = [s * h, G.pivot[1], G.pivot[2]], to = [s * h, -0.02, G.rR], ax = sub(to, from);
    lofts.push(loftWorld(`arm_${side}`, from, to, [
      { t: 0, points: roundRect(ax, b.wall, b.depth, 0.008) },
      { t: 1, points: roundRect(ax, b.wall, b.tip, 0.008) },
    ], b.tint ? C[b.tint] : metal));
  }
  lathes.push(spin('pivot_tube', [-h, G.pivot[1], G.pivot[2]], [h, G.pivot[1], G.pivot[2]], [[0, 0.024], [1, 0.024]], metal, 16));
  const by = G.pivot[1] * 0.72, bz = G.rR + ((G.pivot[2] - G.rR) * by) / G.pivot[1];
  lathes.push(spin('brace', [-h, by, bz + 0.01], [h, by, bz + 0.01], [[0, 0.015], [1, 0.015]], metal, 12));
  lathes.push(spin('axle', [-h - 0.02, 0, G.rR], [h + 0.02, 0, G.rR], [[0, 0.011], [1, 0.011]], tone(C.chrome, -0.2), 12));
  if (G.shock?.link) sweeps.push(tube('link', G.shock.link.map((p) => at(G, p)), 0.013, tone(C.trim, 0.2), 8));
  return { lofts, lathes, sweeps, hardpoints: { mount: [0, 0, 0], axle: G.rearAxle }, joints: [{ name: 'swingarm', control: 'suspension', kind: 'hinge', at: G.pivot, dir: X, range: [-12, 18], angle: 0 }] };
}

/** A coil-over from `bottom` to `top`: its body, its spring, chrome where the card says. */
function coilOver(id, bottom, top, b, C) {
  const ax = unit(sub(top, bottom)), v = unit(cross(ax, X)), u = cross(v, ax), coil = [], per = 10;
  for (let i = 0; i <= b.turns * per; i++) {
    const t = i / (b.turns * per), a = (2 * Math.PI * i) / per, c = lerp(bottom, top, 0.12 + 0.72 * t);
    coil.push(add(c, add(mul(u, b.coil * Math.cos(a)), mul(v, b.coil * Math.sin(a)))));
  }
  const body = spin(`${id}_body`, bottom, top, [[0, 0.015], [0.1, b.body], [0.88, b.body], [0.92, b.body + 0.008], [1, 0.016]], tone(C.trim, 0.15), 14);
  return { lathes: [b.chrome ? made(body, CHROME) : body], sweeps: [tube(`${id}_spring`, coil, b.wire, b.chrome ? tone(C.chrome, 0.2) : C.paint, 5)] };
}
function shockTwin(row, C, { G, side }) {
  const S = need(G, 'shock'), s = sideSign(side), bottom = [s * S.x, ...S.bottom], top = [s * S.x, ...S.top];
  const { lathes, sweeps } = coilOver('shock', bottom, top, row.build, C);
  return { lathes, sweeps, hardpoints: { mount: [0, 0, 0] } };
}

// ── wheels and brakes ───────────────────────────────────────────────────────
/** A road tyre round axle `a`: one torus for a narrow one, a crown and two shoulders for a wide one (its flat tread). */
function roadTyre(a, R, sec, C) {
  if (sec <= 0.1) return [tube('tyre', ring(a, X, R - sec / 2, 44), sec / 2, C.rubber, 12)];
  const rc = sec * 0.32, rs = sec * 0.27, xs = sec * 0.22;
  return [
    tube('tyre', ring(a, X, R - rc, 44), rc, C.rubber, 12),
    ...[1, -1].map((s) => tube(`tyre_${s > 0 ? 'r' : 'l'}`, ring(add(a, [s * xs, 0, 0]), X, R - sec * 0.05 - rs, 44), rs, C.rubber, 10)),
  ];
}
function rimRings(a, rim, half, C, tint = C.chrome) {
  const out = [];
  for (const [k, x] of [['r', half], ['l', -half]]) out.push(tube(`rim_${k}`, ring(add(a, [x, 0, 0]), X, rim + 0.002, 40), 0.007, tint, 6));
  const beds = half > 0.04 ? [-half * 0.5, 0, half * 0.5] : [0];
  beds.forEach((x, k) => out.push(tube(`rim_bed_${k}`, ring(add(a, [x, 0, 0]), X, rim - 0.008, 40), 0.011, tone(tint, -0.08), 6)));
  return out;
}
function wheelCast(row, C, { G, slot }) {
  const { radius: R, section: sec, rim } = row.dims, b = row.build, a = axleOf(G, slot), half = b.rimHalf;
  const sweeps = [...roadTyre(a, R, sec, C), ...rimRings(a, rim, half, C, C[b.rimTint || 'trim'])], extrudes = [], lathes = [];
  const [h0, h1] = need(G, 'hubs')[slot];
  lathes.push(spin('hub', add(a, [h0, 0, 0]), add(a, [h1, 0, 0]), [[0, b.hub * 0.8], [0.15, b.hub], [0.85, b.hub], [1, b.hub * 0.8]], C[b.rimTint || 'trim']));
  // (the spokes: flat bars from the hub to the rim, a Y at the rim when the card says so)
  for (let i = 0; i < b.spokes; i++) {
    const t = (2 * Math.PI * i) / b.spokes, foot = add(a, [0, b.hub * 0.9 * Math.cos(t), b.hub * 0.9 * Math.sin(t)]);
    const ends = b.split ? [t - b.split, t + b.split] : [t];
    ends.forEach((e, k) => {
      const tip = add(a, [0, (rim - 0.012) * Math.cos(e), (rim - 0.012) * Math.sin(e)]);
      extrudes.push(box(`spoke_${i}_${k}`, foot, tip, 0.014, Math.min(0.03, half * 0.8), C[b.rimTint || 'trim'], X));
    });
  }
  return { sweeps, extrudes, lathes, hardpoints: { mount: [0, 0, 0], axle: a, contact: [0, a[1], 0] }, joints: [{ name: `roll_${slot}`, control: 'roll', kind: 'spin', at: a, dir: X, range: [0, 360], angle: 0 }] };
}
function wheelWire(row, C, { G, slot }) {
  const { radius: R, section: sec, rim } = row.dims, b = row.build, a = axleOf(G, slot), sweeps = [], lathes = [];
  sweeps.push(tube('tyre', ring(a, X, R - sec / 2, 48), sec / 2, C.rubber, 10));
  sweeps.push(tube('rim', ring(a, X, rim, 48), b.rimR ?? 0.009, C[b.rimTint || 'chrome'], 6));
  const [h0, h1] = need(G, 'hubs')[slot], hr = b.hub;
  lathes.push(spin('hub', add(a, [h0, 0, 0]), add(a, [h1, 0, 0]), [[0, hr], [0.15, hr * 0.6], [0.85, hr * 0.6], [1, hr]], tone(C.chrome, -0.1), 14));
  for (let i = 0; i < b.spokes; i++) {
    const t = (2 * Math.PI * i) / b.spokes, left = i % 2, lean = (i % 4 < 2 ? 1 : -1) * 0.35;
    const hub = add(a, [left ? h0 + 0.004 : h1 - 0.004, hr * 0.9 * Math.cos(t + lean), hr * 0.9 * Math.sin(t + lean)]);
    sweeps.push(tube(`spoke_${i}`, [hub, add(a, [0, (rim - 0.006) * Math.cos(t), (rim - 0.006) * Math.sin(t)])], 0.0012, C.chrome, 3));
  }
  return { sweeps, lathes, hardpoints: { mount: [0, 0, 0], axle: a, contact: [0, a[1], 0] }, joints: [{ name: `roll_${slot}`, control: 'roll', kind: 'spin', at: a, dir: X, range: [0, 360], angle: 0 }] };
}

function discAt(id, a, x, R, b, C, caliperAngle, bracketTo) {
  const lathes = [spin(`${id}_disc`, add(a, [x - b.thick / 2, 0, 0]), add(a, [x + b.thick / 2, 0, 0]), [[0, R], [1, R]], tone(C.chrome, 0.1), 32)];
  lathes.push(spin(`${id}_carrier`, add(a, [x - 0.006, 0, 0]), add(a, [x + 0.006, 0, 0]), [[0, R * 0.55], [1, R * 0.55]], C.trim, 20));
  const t = caliperAngle * DEG, rad = [0, Math.cos(t), Math.sin(t)], tan = [0, -Math.sin(t), Math.cos(t)], [cw, cl, ch] = b.caliper;
  const c = add(a, add([x, 0, 0], mul(rad, R - ch * 0.35)));
  const off = [add(mul(tan, cl / 2), mul(rad, ch / 2)), add(mul(tan, -cl / 2), mul(rad, ch / 2)), add(mul(tan, -cl / 2), mul(rad, -ch / 2)), add(mul(tan, cl / 2), mul(rad, -ch / 2))];
  const extrudes = [extrudeWorld(`${id}_caliper`, add(c, [-cw / 2, 0, 0]), add(c, [cw / 2, 0, 0]), off, b.caliperTint ? C[b.caliperTint] : tone(C.trim, 0.35))];
  const sweeps = bracketTo ? [tube(`${id}_bracket`, [c, bracketTo], 0.009, tone(C.trim, 0.2), 6)] : [];
  return { lathes, extrudes, sweeps };
}
function brakeTwin(row, C, { G, slot }) {
  const R = row.dims.radius, b = row.build, a = axleOf(G, slot), A = need(G, 'brakes')[slot], out = { lathes: [], extrudes: [], sweeps: [] };
  for (const [side, s] of [['r', 1], ['l', -1]]) {
    const part = discAt(`disc_${side}`, a, s * A.x, R, b, C, A.caliper, slot === 'front' ? G.fork.leg(0.06, side) : null);
    for (const k of Object.keys(out)) out[k].push(...part[k]);
  }
  return { ...out, hardpoints: { mount: [0, 0, 0] } };
}
/** A bicycle's disc: its caliper bracketed to the fork's leg, or to the frame's stay at the rear. */
function brakeMini(row, C, { G, slot }) {
  const R = row.dims.radius, b = row.build, a = axleOf(G, slot), A = need(G, 'brakes')[slot];
  const to = slot === 'front' ? G.fork.leg(0.07, A.x < 0 ? 'l' : 'r') : add(a, [A.x, 0.07, 0.05]);
  return { ...discAt('disc', a, A.x, R, b, C, A.caliper, to), hardpoints: { mount: [0, 0, 0] } };
}
function brakeDrum(row, C, { G, slot }) {
  const R = row.dims.radius, a = axleOf(G, slot), A = need(G, 'brakes')[slot];
  const lathes = [spin('drum', add(a, [A.x - 0.022, 0, 0]), add(a, [A.x + 0.022, 0, 0]), [[0, R * 0.9], [0.2, R], [0.8, R], [1, R * 0.82]], tone(C.chrome, -0.1), 24)];
  const lever = add(a, [A.x + Math.sign(A.x || 1) * 0.026, -R * 0.5, R * 0.55]);
  const sweeps = [tube('arm', [add(a, [lever[0] - a[0], 0, 0]), lever, add(lever, [0, 0.18, 0.02])], 0.006, tone(C.trim, 0.2), 6)];
  return { lathes, sweeps, hardpoints: { mount: [0, 0, 0] } };
}

// ── engines ─────────────────────────────────────────────────────────────────
function cases(c, [hx, hy, hz], tint) {
  const oct = [[hy, -hz * 0.55], [hy, hz * 0.7], [hy * 0.55, hz], [-hy * 0.6, hz], [-hy, hz * 0.45], [-hy, -hz * 0.6], [-hy * 0.5, -hz], [hy * 0.6, -hz]];
  return extrudeWorld('cases', [c[0] - hx, c[1], c[2]], [c[0] + hx, c[1], c[2]], oct.map(([y, z]) => [0, y, z]), tint);
}
function engineInline(row, C, { G }) {
  const E = need(G, 'engine'), [hx, hy, hz] = E.half, c = E.at, b = row.build, dark = C.trim, lathes = [], lofts = [], extrudes = [];
  extrudes.push(cases(c, E.half, tone(dark, 0.15)));
  lathes.push(spin('cover_l', [c[0] - hx - 0.014, c[1] - 0.05, c[2] - 0.02], [c[0] - hx + 0.002, c[1] - 0.05, c[2] - 0.02], [[0, 0.065], [0.6, 0.075], [1, 0.075]], tone(dark, 0.35), 24));
  lathes.push(spin('cover_r', [c[0] + hx - 0.002, c[1] + 0.02, c[2] - 0.02], [c[0] + hx + 0.018, c[1] + 0.02, c[2] - 0.02], [[0, 0.085], [0.4, 0.085], [1, 0.072]], tone(dark, 0.35), 24));
  const u = [0, Math.sin(b.tilt * DEG), Math.cos(b.tilt * DEG)], base = add(c, [0, hy * 0.35, hz - 0.01]), on = (k) => add(base, mul(u, k));
  const w = b.cylinders * (b.bore + 0.014) + 0.03;
  const block = (id, k0, k1, ww, l, r, tint) => lofts.push(loftWorld(id, on(k0), on(k1), [{ t: 0, points: roundRect(u, ww, l, r, 2, [0, 1, 0]) }, { t: 1, points: roundRect(u, ww, l, r, 2, [0, 1, 0]) }], tint));
  block('block', 0, b.height ?? 0.14, w, b.bore + 0.03, 0.012, tone(dark, 0.4));
  block('head', b.height ?? 0.14, (b.height ?? 0.14) + 0.07, w + 0.02, b.bore + 0.045, 0.014, tone(dark, 0.45));
  block('cam', (b.height ?? 0.14) + 0.07, (b.height ?? 0.14) + 0.095, w - 0.01, b.bore + 0.02, 0.012, b.camTint ? C[b.camTint] : tone(dark, 0.05));
  extrudes.push(box('sump', add(c, [0, 0.02, -hz]), add(c, [0, 0.02, -hz - 0.04]), hx * 1.4, hy * 1.1, tone(dark, 0.1), [0, 1, 0]));
  return { lathes, lofts, extrudes, hardpoints: { mount: [0, 0, 0], head: on((b.height ?? 0.14) + 0.035) } };
}
function finnedCylinder(id, from, dir, L, r, fins, tint) {
  const pairs = [[0, r * 0.9]];
  for (let k = 0; k < fins; k++) { const t0 = 0.05 + (0.9 * k) / fins; pairs.push([t0, r * 0.9], [t0 + 0.012, r * 1.35], [t0 + 0.9 / fins - 0.012, r * 1.35], [t0 + 0.9 / fins, r * 0.9]); }
  pairs.push([1, r * 0.9]);
  return spin(id, from, add(from, mul(dir, L)), pairs, tint, 16);
}
function engineVee(row, C, { G }) {
  const E = need(G, 'engine'), [hx, hy, hz] = E.half, c = E.at, b = row.build, metal = tone(C.chrome, -0.05), lathes = [], lofts = [], extrudes = [];
  extrudes.push(cases(c, E.half, tone(C.trim, 0.2)));
  lathes.push(made(spin('primary', [c[0] - hx - 0.03, c[1] - hy * 0.6, c[2] - hz * 0.3], [c[0] - hx, c[1] - hy * 0.6, c[2] - hz * 0.3], [[0, 0.1], [0.5, 0.115], [1, 0.115]], C.chrome, 24), CHROME));
  lathes.push(made(spin('cam_cover', [c[0] + hx, c[1] + hy * 0.3, c[2] + hz * 0.2], [c[0] + hx + 0.025, c[1] + hy * 0.3, c[2] + hz * 0.2], [[0, 0.07], [1, 0.06]], C.chrome, 20), CHROME));
  const top = add(c, [0, 0, hz - 0.01]);
  for (const [k, ang] of b.vee.entries()) {
    const dir = [0, Math.sin(ang * DEG), Math.cos(ang * DEG)], foot = add(top, mul(dir, 0.01));
    lathes.push(finnedCylinder(`cyl_${k}`, foot, dir, b.height, b.bore / 2 + 0.012, b.fins, metal));
    const h0 = add(foot, mul(dir, b.height)), h1 = add(h0, mul(dir, 0.08));
    lathes.push(finnedCylinder(`head_${k}`, h0, dir, 0.08, b.bore / 2 + 0.02, 4, tone(metal, 0.1)));
    lathes.push(made(spin(`rocker_${k}`, h1, add(h1, mul(dir, 0.035)), [[0, b.bore / 2 + 0.01], [1, b.bore / 2 - 0.01]], C.chrome, 16), CHROME));
  }
  if (b.cleaner) lathes.push(made(spin('cleaner', [b.cleaner[0], b.cleaner[1], b.cleaner[2]], [b.cleaner[0] + 0.05, b.cleaner[1], b.cleaner[2]], [[0, 0.09], [0.3, 0.1], [1, 0.08]], C.chrome, 24), CHROME));
  return { lathes, lofts, extrudes, hardpoints: { mount: [0, 0, 0] } };
}
function engineSwingUnit(row, C, { G }) {
  const E = need(G, 'engine'), b = row.build, c = E.at, dark = tone(C.trim, 0.25), lathes = [], lofts = [], extrudes = [];
  // the belt case: from the engine back along the left to the rear axle (the arm the wheel rides on)
  const x = E.caseX, front = [x, c[1], c[2]], back = [x, 0, G.rR], ax = sub(back, front);
  lofts.push(loftWorld('case', front, back, [{ t: 0, points: roundRect(ax, 0.06, 0.2, 0.05, 3, [0, 0, 1]) }, { t: 0.7, points: roundRect(ax, 0.06, 0.18, 0.05, 3, [0, 0, 1]) }, { t: 1, points: roundRect(ax, 0.055, 0.13, 0.05, 3, [0, 0, 1]) }], tone(C.chrome, -0.1)));
  extrudes.push(extrudeWorld('crank', [-0.06, c[1], c[2]], [x + 0.03, c[1], c[2]], rect([1, 0, 0], 0.2, 0.17), dark));
  // (the cylinder laid forward, finned, its fan cowl on the right)
  const dir = unit([0, Math.cos(b.tilt * DEG), Math.sin(b.tilt * DEG)]);
  lathes.push(finnedCylinder('cyl', add(c, [-0.01, 0.07, 0.02]), dir, b.height, b.bore / 2 + 0.01, b.fins, tone(C.chrome, -0.2)));
  lathes.push(spin('fan', [0.04, c[1] + 0.02, c[2] + 0.02], [0.1, c[1] + 0.02, c[2] + 0.02], [[0, 0.09], [1, 0.085]], dark, 20));
  return { lathes, lofts, extrudes, hardpoints: { mount: [0, 0, 0], axle: G.rearAxle }, joints: [{ name: 'swingarm', control: 'suspension', kind: 'hinge', at: c, dir: X, range: [-8, 12], angle: 0 }] };
}
function engineFlat(row, C, { G }) {
  const E = need(G, 'engine'), b = row.build, c = E.at, lathes = [], extrudes = [];
  extrudes.push(cases(c, E.half, tone(C.trim, 0.25)));
  const dir = unit([0, Math.cos(b.tilt * DEG), Math.sin(b.tilt * DEG)]);
  lathes.push(finnedCylinder('cyl', add(c, [0, E.half[1] * 0.6, E.half[2] * 0.2]), dir, b.height, b.bore / 2 + 0.01, b.fins, tone(C.chrome, -0.15)));
  lathes.push(spin('cover_r', [E.half[0], c[1], c[2]], [E.half[0] + 0.02, c[1], c[2]], [[0, 0.07], [1, 0.06]], tone(C.chrome, -0.05), 20));
  return { lathes, extrudes, hardpoints: { mount: [0, 0, 0] } };
}
function engineMidDrive(row, C, { G }) {
  const b = row.build, c = G.bb;
  const lathes = [spin('motor', [-0.05, c[1] + 0.03, c[2] + 0.02], [0.05, c[1] + 0.03, c[2] + 0.02], [[0, b.r * 0.9], [0.15, b.r], [0.85, b.r], [1, b.r * 0.9]], tone(C.trim, 0.1), 24)];
  const extrudes = [box('mount', [0, c[1] + 0.06, c[2] + 0.05], [0, c[1] + 0.12, c[2] + 0.1], 0.08, 0.06, tone(C.trim, 0.1), [0, 0, 1])];
  return { lathes, extrudes, hardpoints: { mount: [0, 0, 0] } };
}

function radiatorFront(row, C, { G }) {
  const R = need(G, 'radiator'), c = R.at, { width: w, height: h, thick: t } = row.dims, lean = R.lean * DEG;
  const n = [0, Math.cos(lean), Math.sin(lean)], up = [0, -Math.sin(lean), Math.cos(lean)];
  const extrudes = [extrudeWorld('core', sub(c, mul(n, t / 2)), add(c, mul(n, t / 2)), rect(n, w, h, up), tone(C.trim, -0.25))];
  for (const s of [1, -1]) extrudes.push(extrudeWorld(`tank_${s > 0 ? 'r' : 'l'}`, add(sub(c, mul(n, t / 2)), [s * (w / 2 + 0.012), 0, 0]), add(add(c, mul(n, t / 2)), [s * (w / 2 + 0.012), 0, 0]), rect(n, 0.024, h, up), tone(C.trim, 0.1)));
  return { extrudes, hardpoints: { mount: [0, 0, 0] } };
}

// ── drives ──────────────────────────────────────────────────────────────────
function driveBelt(row, C, { G }) {
  const D = need(G, 'drive'), b = row.build, x = D.x, front = D.front;
  const lathes = [
    spin('pulley_f', [x - 0.012, front[0], front[1]], [x + 0.012, front[0], front[1]], [[0, b.front], [1, b.front]], tone(C.chrome, -0.2), 20),
    made(spin('pulley_r', [x - 0.012, 0, G.rR], [x + 0.012, 0, G.rR], [[0, b.rear], [1, b.rear]], C.chrome, 32), CHROME),
  ];
  const sweeps = [tube('belt', beltLoop(x, front, b.front + 0.004, [0, G.rR], b.rear + 0.004), 0.01, C.rubber, 6)];
  return { lathes, sweeps, hardpoints: { mount: [0, 0, 0], front: [x, front[0], front[1]], rear: [x, 0, G.rR] } };
}
function drivePedal(row, C, { G, pose }) {
  const D = need(G, 'drive'), b = row.build, bb = G.bb, x = D.x, lathes = [], sweeps = [], extrudes = [];
  // the cranks at their angle (degrees from forward; the right crank leads), a pedal at each end
  const a = (D.crank ?? 0) * DEG, armEnd = (s) => add(bb, [s * (b.q / 2), (s > 0 ? 1 : -1) * b.crank * Math.cos(a), (s > 0 ? 1 : -1) * b.crank * Math.sin(a)]);
  const pedals = {};
  for (const [side, s] of [['r', 1], ['l', -1]]) {
    const end = armEnd(s);
    extrudes.push(box(`crank_${side}`, add(bb, [s * (b.q / 2), 0, 0]), end, 0.012, 0.03, tone(C.chrome, -0.1), [1, 0, 0]));
    const p0 = add(end, [s * 0.008, 0, 0]), p1 = add(end, [s * 0.1, 0, 0]);
    extrudes.push(box(`pedal_${side}`, p0, p1, 0.07, 0.02, C.trim, [0, 0, 1]));
    pedals[`peg.${side}`] = add(lerp(p0, p1, 0.5), [0, 0, 0.012]);
  }
  lathes.push(made(spin('chainring', [x - 0.003, bb[1], bb[2]], [x + 0.003, bb[1], bb[2]], [[0, b.ring], [1, b.ring]], tone(C.chrome, 0.05), 32), CHAIN));
  lathes.push(made(spin('cassette', [x - 0.02, 0, G.rR], [x + 0.008, 0, G.rR], [[0, b.cog * 1.6], [1, b.cog]], C.chrome, 24), CHAIN));
  sweeps.push(made(tube('chain', beltLoop(x, [0, G.rR], b.cog * 1.3, [bb[1], bb[2]], b.ring), 0.0035, tone(C.trim, -0.1), 4), CHAIN));
  extrudes.push(box('mech', add([x + 0.012, 0, G.rR], [0, -0.01, -0.03]), add([x + 0.012, 0, G.rR], [0, 0.02, -0.1]), 0.02, 0.04, tone(C.trim, 0.1), [0, 1, 0]));
  return { lathes, sweeps, extrudes, hardpoints: { mount: [0, 0, 0], front: [x, bb[1], bb[2]], rear: [x, 0, G.rR], ...pedals } };
}

// ── exhausts, tanks, seats ──────────────────────────────────────────────────
function exhaustPipes(row, C, { G }) {
  const E = need(G, 'exhaust'), b = row.build, steel = b.chrome ? tone(C.chrome, 0.15) : tone(C.chrome, -0.12), sweeps = [], lathes = [];
  for (const [k, p] of E.pipes.entries()) {
    const s = made(tube(`header_${k}`, bend(p.pts, 0.05, 4), p.r ?? b.pipe, steel, 10), b.chrome ? CHROME : { metal: 'stainless', finish: 'brushed' });
    sweeps.push(s);
    if (p.can) {
      const [c0, c1] = p.can, r = p.canR ?? b.can;
      lathes.push(made(spin(`can_${k}`, c0, c1, [[0, r * 0.6], [0.08, r], [0.88, r], [1, r * 0.75]], b.chrome ? C.chrome : tone(C.trim, 0.2), 20), b.chrome ? CHROME : { metal: b.can_metal ?? 'titanium', finish: 'brushed' }));
    }
  }
  return { sweeps, lathes, hardpoints: { mount: [0, 0, 0] } };
}
function tankPod(row, C, { G }) {
  const T = need(G, 'tank'), lofts = [pod('tank', T.stations, C.paint)], lathes = [];
  if (T.cap) lathes.push(made(spin('cap', T.cap, add(T.cap, [0, 0, 0.012]), [[0, 0.03], [1, 0.026]], C.chrome, 16), CHROME));
  return { lofts, lathes, hardpoints: { mount: [0, 0, 0] } };
}
function seatContour(row, C, { G }) {
  const S = need(G, 'seat'), m = row.build.leather ? LEATHER : null;
  const lofts = [m ? made(pod('seat', S.stations, C.rubber), m) : pod('seat', S.stations, C.rubber)];
  return { lofts, hardpoints: { mount: [0, 0, 0], seat: [0, S.ride, S.z] } };
}
function seatSaddle(row, C, { G }) {
  const S = need(G, 'seat'), lofts = [pod('saddle', S.stations, C.rubber)];
  const lathes = [spin('post', S.post[0], S.post[1], [[0, 0.0135], [1, 0.0135]], tone(C.chrome, -0.05), 12)];
  return { lofts, lathes, hardpoints: { mount: [0, 0, 0], seat: [0, S.ride, S.z] } };
}

// ── bars ────────────────────────────────────────────────────────────────────
function grips(W, by, bz, rise, pull, b, C, sweeps, lathes) {
  for (const [side, s] of [['r', 1], ['l', -1]]) {
    const end = [s * W, by - pull, bz + rise], inner = [s * (W - 0.13), by - pull * 0.85, bz + rise * 0.97];
    lathes.push(spin(`grip_${side}`, inner, end, [[0, b.grip], [0.1, b.grip * 1.12], [0.9, b.grip * 1.12], [1, b.grip * 1.2]], C.rubber, 14));
    if (b.levers !== false) sweeps.push(tube(`lever_${side}`, [inner, add(inner, [s * 0.04, 0.035, -0.012]), add(inner, [s * 0.14, 0.045, -0.03])], 0.006, tone(C.trim, 0.25), 6));
    if (b.mirrors) {
      const stalk = add(inner, [-s * 0.02, 0.01, 0.01]), head = add(stalk, [s * 0.11, -0.03, 0.17]);
      sweeps.push(tube(`mirror_stalk_${side}`, [stalk, add(stalk, [s * 0.04, 0, 0.1]), head], 0.006, C.trim, 6));
      lathes.push(spin(`mirror_${side}`, sub(head, [0, 0.012, 0]), add(head, [0, 0.008, 0]), [[0, 0.055], [1, 0.05]], C.trim, 16));
    }
  }
}
function barsRoad(row, C, { G }) {
  const b = row.build, W = row.dims.width / 2, rise = row.dims.rise, pull = row.dims.pull ?? 0.07, [, by, bz] = G.barsAt, sweeps = [], lathes = [];
  const half = [[0.1, by, bz], [W - 0.17, by - pull * 0.7, bz + rise * 0.92], [W, by - pull, bz + rise]];
  sweeps.push(made(tube('bar', bend([...half.slice().reverse().map(([x, y, z]) => [-x, y, z]), ...half], 0.06, 5), b.tube, C.chrome, 10), b.chrome ? CHROME : { metal: 'aluminium', finish: 'brushed' }));
  for (const s of [1, -1]) lathes.push(spin(`riser_${s > 0 ? 'r' : 'l'}`, add(G.axis.at(G.fork.sHi + 0.012), [s * 0.05, 0, 0]), [s * 0.05, by, bz], [[0, 0.018], [1, 0.016]], tone(C.trim, 0.3), 12));
  grips(W, by, bz, rise, pull, b, C, sweeps, lathes);
  const grip = (s) => [s * (W - 0.065), by - pull * 0.95, bz + rise];
  return { sweeps, lathes, hardpoints: { mount: [0, 0, 0], 'grip.r': grip(1), 'grip.l': grip(-1) } };
}
function barsClipOn(row, C, { G }) {
  const b = row.build, W = row.dims.width / 2, drop = row.dims.drop, pull = row.dims.pull ?? 0.06, sweeps = [], lathes = [], hp = {};
  for (const [side, s] of [['r', 1], ['l', -1]]) {
    const clampAt = G.fork.leg(G.fork.sHi - 0.04, side), end = add(clampAt, [s * (W - G.fork.half), -pull, -drop]);
    lathes.push(spin(`clamp_${side}`, sub(clampAt, mul(G.axis.d, 0.025)), add(clampAt, mul(G.axis.d, 0.025)), [[0, 0.036], [1, 0.036]], tone(C.trim, 0.3), 14));
    sweeps.push(tube(`bar_${side}`, [clampAt, end], b.tube, C.chrome, 10));
    const inner = lerp(clampAt, end, 0.25);
    lathes.push(spin(`grip_${side}`, lerp(clampAt, end, 0.42), end, [[0, b.grip], [0.1, b.grip * 1.12], [0.9, b.grip * 1.12], [1, b.grip * 1.2]], C.rubber, 14));
    sweeps.push(tube(`lever_${side}`, [inner, add(inner, [s * 0.05, 0.04, -0.01]), add(inner, [s * 0.14, 0.05, -0.025])], 0.006, tone(C.trim, 0.25), 6));
    hp[`grip.${side}`] = lerp(clampAt, end, 0.72);
  }
  return { sweeps, lathes, hardpoints: { mount: [0, 0, 0], ...hp } };
}
function barsStem(row, C, { G }) {
  const b = row.build, W = row.dims.width / 2, rise = row.dims.rise, pull = row.dims.pull ?? 0.02, top = G.axis.at(G.fork.sHi + (b.spacer ?? 0.04)), sweeps = [], lathes = [];
  const clampAt = add(top, mul(G.axis.n, b.stem)), [, by, bz] = clampAt;
  // (the steerer and its spacers up from the head to the stem, then the stem out to the bar)
  lathes.push(spin('spacers', G.axis.at(G.fork.sHi), top, [[0, 0.018], [1, 0.018]], tone(C.trim, 0.1), 12));
  lathes.push(spin('stem', top, clampAt, [[0, 0.016], [1, 0.016]], tone(C.trim, 0.2), 12));
  const half = [[0.04, by, bz], [W - 0.12, by - pull * 0.6, bz + rise * 0.8], [W, by - pull, bz + rise]];
  sweeps.push(tube('bar', bend([...half.slice().reverse().map(([x, y, z]) => [-x, y, z]), ...half], 0.05, 4), b.tube, C.trim, 8));
  grips(W, by, bz, rise, pull, b, C, sweeps, lathes);
  const grip = (s) => [s * (W - 0.065), by - pull * 0.95, bz + rise];
  return { sweeps, lathes, hardpoints: { mount: [0, 0, 0], 'grip.r': grip(1), 'grip.l': grip(-1) } };
}
function barsCowled(row, C, { G }) {
  const b = row.build, W = row.dims.width / 2, [, by, bz] = G.barsAt, sweeps = [], lathes = [];
  sweeps.push(tube('bar', [[-W, by - 0.03, bz], [W, by - 0.03, bz]], b.tube, C.chrome, 8));
  const cowl = need(G, 'cowl');
  const lofts = [pod('cowl', cowl.stations, C.paint)];
  grips(W, by - 0.03, bz, 0, 0, { ...b, mirrors: b.mirrors }, C, sweeps, lathes);
  const grip = (s) => [s * (W - 0.065), by - 0.03, bz];
  return { sweeps, lathes, lofts, hardpoints: { mount: [0, 0, 0], 'grip.r': grip(1), 'grip.l': grip(-1) } };
}

// ── body, lamps, pegs, battery ──────────────────────────────────────────────
function bodyPod(row, C, { G, side }) {
  const P = need(G, row.build.place), s = sideSign(side), tint = C[row.build.tint || 'paint'];
  const stations = side === 'l' ? P.stations : P.stations;
  return { lofts: [pod('pod', stations, tint, { x: (P.x ?? 0) * s })], hardpoints: { mount: [0, 0, 0] } };
}
function bodySlab(row, C, { G, side }) {
  const P = need(G, row.build.place), s = side ? sideSign(side) : 1;
  const [x0, x1] = side ? [s * P.x[0], s * P.x[1]] : P.x;
  return { extrudes: [panel('slab', x0, x1, P.outline, C[row.build.tint || 'paint'])], hardpoints: { mount: [0, 0, 0] } };
}
function bodyScreen(row, C, { G }) {
  const P = need(G, row.build.place), d = G.axis.d, tilt = (P.tilt ?? 0) * DEG, n = unit(add(mul(G.axis.n, Math.cos(tilt)), mul(d, Math.sin(tilt)))), up = unit(cross(n, X)), c = P.at;
  const ext = extrudeWorld('screen', sub(c, mul(n, 0.002)), add(c, mul(n, 0.002)), roundRect(n, row.dims.width, row.dims.height, 0.05, 3, up), C.glass);
  return { extrudes: [made(ext, 'glass')], hardpoints: { mount: [0, 0, 0] } };
}
function lampHead(row, C, { G }) {
  const P = need(G, row.build.place), c = P.at, f = unit(P.dir ?? G.axis.n), r = row.dims.radius;
  const lathes = [
    spin('bowl', sub(c, mul(f, r * 0.9)), c, [[0, r * 0.55], [0.6, r * 0.95], [1, r]], C[row.build.tint || 'trim'], 20),
    glow(spin('lens', c, add(c, mul(f, 0.01)), [[0, r * 0.94], [1, r * 0.9]], C.light, 20)),
  ];
  return { lathes, hardpoints: { mount: [0, 0, 0] } };
}
function lampTail(row, C, { G }) {
  const P = need(G, row.build.place), c = P.at, { width: w, height: h } = row.dims;
  const extrudes = [glow(extrudeWorld('lens', c, add(c, [0, -0.012, 0]), rect([0, -1, 0], w, h), '#cf2a22'))];
  return { extrudes, hardpoints: { mount: [0, 0, 0] } };
}
function pegRoad(row, C, { G, side }) {
  const P = need(G, 'peg'), s = sideSign(side), base = [s * P.at[0], P.at[1], P.at[2]], out = add(base, [s * P.out, 0, 0]), w = row.dims.width;
  const extrudes = [box('peg', base, out, w, 0.026, C.rubber, [0, 0, 1])];
  if (P.hanger) extrudes.push(panel('hanger', s * (P.at[0] - 0.012), s * (P.at[0] - 0.002), P.hanger, tone(C.chrome, -0.1)));
  return { extrudes, hardpoints: { mount: [0, 0, 0], peg: [base[0] + s * P.out * 0.55, base[1], base[2] + 0.013] } };
}
function pegFloor(row, C, { G }) {
  const P = need(G, 'floor');
  const extrudes = [panel('floor', -P.width / 2, P.width / 2, P.outline, C[row.build.tint || 'trim'])];
  const top = Math.max(...P.outline.map((q) => q[1]));
  return { extrudes, hardpoints: { mount: [0, 0, 0], 'peg.r': [P.width * 0.3, P.feet, top], 'peg.l': [-P.width * 0.3, P.feet, top] } };
}
function batteryDowntube(row, C, { G }) {
  const B = need(G, 'battery'), [a, b] = B.along, ax = sub(b, a);
  const lofts = [loftWorld('battery', a, b, [{ t: 0, points: roundRect(ax, 0.075, 0.085, 0.025, 3, B.up ?? [0, 0, 1]) }, { t: 1, points: roundRect(ax, 0.075, 0.085, 0.025, 3, B.up ?? [0, 0, 1]) }], C.trim)];
  return { lofts, hardpoints: { mount: [0, 0, 0] } };
}

export const FAMILIES = Object.freeze({
  'cycle-frame': { tubes: frameTubes, trellis: frameTubes },
  'cycle-fork': { telescopic: forkTelescopic, rigid: forkRigid },
  'cycle-swingarm': { roadArm },
  'cycle-shock': { twin: shockTwin },
  'cycle-wheel': { cast: wheelCast, wire: wheelWire },
  'cycle-brake': { twin: brakeTwin, drum: brakeDrum, mini: brakeMini },
  'cycle-engine': { inline: engineInline, vee: engineVee, swingUnit: engineSwingUnit, flat: engineFlat, midDrive: engineMidDrive },
  'cycle-radiator': { front: radiatorFront },
  'cycle-drive': { belt: driveBelt, pedal: drivePedal },
  'cycle-exhaust': { pipes: exhaustPipes },
  'cycle-tank': { pod: tankPod },
  'cycle-seat': { contour: seatContour, saddle: seatSaddle },
  'cycle-bars': { roadBar: barsRoad, clipOn: barsClipOn, stemBar: barsStem, cowled: barsCowled },
  'cycle-body': { pod: bodyPod, slab: bodySlab, screen: bodyScreen },
  'cycle-lamp': { head: lampHead, tail: lampTail },
  'cycle-peg': { road: pegRoad, floor: pegFloor },
  'cycle-battery': { downtube: batteryDowntube },
});
