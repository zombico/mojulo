/**
 * ladder — a CLIMB from one level to the next: the body leaves the walk and goes hand over hand. Called by its ends
 * like a bridge: `from`, a point on the lower level where the climb starts, and `to`, the LIP of the upper level
 * (its edge, on its top). The way from `to` back toward `from` is the side the climber stands on.
 *
 *   ladder  a lean ladder: two rails against the lip, rungs between, the rails standing past the lip to grab when you
 *           step off; its foot set back a quarter of the rise (4:1) unless `from` sets it
 *   rungs   a fixed ladder up a wall: flat rails on brackets, iron rungs, grab bars over the lip, a cage when tall
 *   rope    a rope hung from a beam over the lip, wrapped where hands go, a whipped tail to catch
 *   net     a cargo net draped from a bar on the lip to stakes on the lower level: climbed across as well as up
 *
 * What it is built of is ELEMENTS (each can be turned off), and how its parts meet follows the kit's JOINT word from a
 * scapeshift kit (era/out-made.js): lashed rungs wear lashings, pegged rungs pegs, iron rungs collars; the joints in the
 * middle third are the 33, dark against the light rungs. `timber` (sawn, round, culm) sets the rails' section.
 *
 * It answers as a link does: the CLIMB (form, rise, seconds at its speed, whether it mounts the lip, whether it climbs
 * across), its LAWS in the man-made index's shape ({ law, want, why, ok, value }: rung pitch, 4:1, the extension past
 * the lip, the cage, the mesh), and the pieces the world runs: a `climbable` entity the climb owner reads (the
 * surface's base, axis, normal, width and landings), nothing that blocks the walk.
 */
import { obox, blockSink } from '../../era/props.js';
import { r5, P } from '../../era/geom.js';

const Z = [0, 0, 1];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const deg = (r) => (r * 180) / Math.PI;

export const LADDER_VARIANTS = {
  ladder: { about: 'a lean ladder: two rails against the lip at 4:1, rungs between, the rails standing past the lip', elements: ['rails', 'rungs', 'joints', 'feet', 'horns'], speed: 2.2 },
  rungs: { about: 'a fixed ladder up a wall: rails on brackets, iron rungs, grab bars over the lip, a cage past 6 m', elements: ['rails', 'rungs', 'joints', 'brackets', 'grabs', 'cage'], speed: 2 },
  rope: { about: 'a rope hung from a beam over the lip, wrapped where the hands go, a whipped tail to catch', elements: ['beam', 'rope', 'wraps', 'tail'], speed: 1.4 },
  net: { about: 'a cargo net from a bar on the lip to stakes below: climbed across as well as up', elements: ['bar', 'cords', 'knots', 'stakes', 'lip'], speed: 1.2 },
};
export const LADDER_VARIANT_IDS = Object.freeze(Object.keys(LADDER_VARIANTS));
export const LADDER_ELEMENTS = Object.freeze([...new Set(Object.values(LADDER_VARIANTS).flatMap((v) => v.elements))]);
// the kit words a ladder reads (era/out-made.js MADE_RAILS: timber, joint)
export const LADDER_TIMBER = Object.freeze(['sawn', 'round', 'culm']);
export const LADDER_JOINTS = Object.freeze(['lashed', 'pegged', 'notched', 'collared']);

// what a rung is, by how it meets the rail: the joint the 33 shows
const JOINT_PART = { lashed: 'lashings', pegged: 'pegs', notched: 'notches', collared: 'collars' };

/**
 * The LAWS, in the man-made index's shape: `test(m)` reads the ladder's measures. Where a law is met by construction
 * it is (a lean ladder's foot comes from 4:1, rung pitch from the rise), so a ladder built from its ends holds them;
 * one given its own numbers is measured, never refused.
 */
const within = (v, [lo, hi]) => v >= lo - 1e-9 && v <= hi + 1e-9;
export const LADDER_LAWS = Object.freeze([
  { forms: ['ladder', 'rungs'], law: 'rung-pitch', want: 'rungs 0.25–0.30 m apart, every one the same', why: 'the hand finds the next rung without looking', test: (m) => within(m.pitch, [0.25, 0.3]), show: (m) => m.pitch },
  { forms: ['ladder', 'rungs'], law: 'width', want: '≥ 0.40 m clear between the rails', why: 'both boots on a rung, the shoulders between the rails', test: (m) => m.clear >= 0.4 - 1e-9, show: (m) => m.clear },
  { forms: ['ladder'], law: 'four-to-one', want: 'leans 70–78° (a foot out for every four up)', why: 'steeper tips back off the lip, flatter slides out at the foot', test: (m) => within(m.lean, [70, 78]), show: (m) => m.lean },
  { forms: ['ladder', 'rungs'], law: 'extension', want: 'rails or grabs ≥ 0.9 m past the lip', why: 'something to hold while the feet step off onto the level', test: (m) => !m.mounts || m.extension >= 0.9 - 1e-9, show: (m) => (m.mounts ? m.extension : 'does not mount') },
  { forms: ['rungs'], law: 'cage', want: 'caged past a 6 m rise', why: 'a fall from a fixed ladder is a fall the whole height', test: (m) => m.rise <= 6 || m.caged, show: (m) => (m.caged ? 'caged' : m.rise) },
  { forms: ['rope'], law: 'holds', want: 'wraps 0.30–0.50 m apart', why: 'a rope is climbed hand over hand; the wraps are where the hands close', test: (m) => within(m.pitch, [0.3, 0.5]), show: (m) => m.pitch },
  { forms: ['rope'], law: 'clear', want: 'hangs ≥ 0.30 m off the wall', why: 'the knuckles clear the stone', test: (m) => m.clear >= 0.3 - 1e-9, show: (m) => m.clear },
  { forms: ['net'], law: 'mesh', want: 'mesh 0.20–0.35 m', why: 'a boot goes through a square; a body does not', test: (m) => within(m.pitch, [0.2, 0.35]), show: (m) => m.pitch },
  { forms: ['net'], law: 'drape', want: 'drapes 45–80°', why: 'flatter is walked, steeper hangs off the bar and swings', test: (m) => within(m.lean, [45, 80]), show: (m) => m.lean },
]);
export const ladderLaws = (form, m) => LADDER_LAWS.filter((l) => l.forms.includes(form)).map((l) => ({ law: l.law, want: l.want, why: l.why, ok: l.test(m), value: l.show(m) }));

export function ladderParams({ variant = 'ladder', from, to, rise: riseAsked, facing, width, lean, pitch, speed, mount, timber = 'sawn', joint, elements = {} } = {}) {
  if (!LADDER_VARIANTS[variant]) throw new Error(`playscape: a ladder has no variant '${variant}' (variants: ${LADDER_VARIANT_IDS.join(', ')})`);
  if (!to) throw new Error('ladder: give its ends: `to`, the lip of the upper level (its edge, on its top), and `from`, a point on the level below (or a `rise` and a `facing`)');
  for (const k of Object.keys(elements)) if (!LADDER_ELEMENTS.includes(k)) throw new Error(`ladder: '${k}' is not a ladder element (${LADDER_ELEMENTS.join(', ')})`);
  if (!LADDER_TIMBER.includes(timber)) throw new Error(`ladder: timber is one of ${LADDER_TIMBER.join(', ')}`);
  const j = joint ?? (variant === 'rungs' ? 'collared' : timber === 'culm' ? 'lashed' : 'pegged');
  if (!LADDER_JOINTS.includes(j)) throw new Error(`ladder: joint is one of ${LADDER_JOINTS.join(', ')}`);
  const a = from || [to[0], to[1], to[2] - (riseAsked ?? 3)], rise = r5(to[2] - a[2]);
  if (!(rise >= 0.6)) throw new Error('ladder: the lip must stand at least 0.6 m over the level below (lower is a step)');
  const flat = [a[0] - to[0], a[1] - to[1], 0], run = Math.hypot(flat[0], flat[1]);
  const Nh = run > 0.05 ? unit(flat) : unit([...(facing || [0, -1]).slice(0, 2), 0]);
  // the lean: a lean ladder's from its foot (4:1 unless `from` set one out), a net's its drape; rungs and rope hang plumb
  const fromRun = run > 0.05 && from;
  const L = variant === 'ladder' ? (lean ?? (fromRun ? deg(Math.atan2(rise, run)) : deg(Math.atan(4))))
    : variant === 'net' ? (lean ?? (fromRun ? deg(Math.atan2(rise, run)) : 60)) : 90;
  const w = width ?? (variant === 'net' ? 1.8 : variant === 'rope' ? 0 : 0.46);
  if (variant !== 'rope' && !(w >= 0.3)) throw new Error('ladder: width is the clear metres between its sides, 0.3 or more');
  const pitchDefault = variant === 'rope' ? 0.4 : variant === 'net' ? 0.28 : 0.28;
  // the rungs are spaced evenly up the rise: as near the asked pitch as a whole number allows
  const n = Math.max(2, Math.round(rise / (pitch ?? pitchDefault))), even = r5(rise / n);
  return {
    variant, to: P(to), from: P(a), rise, Nh: P(Nh), U: P(unit(cross(Z, Nh))), lean: r5(L), width: r5(w), pitch: even, steps: n,
    speed: speed ?? LADDER_VARIANTS[variant].speed, mount: mount ?? true, timber, joint: j, elements,
  };
}

const on = (p, k) => p.elements[k] !== false;

/** The climb SURFACE: where the body goes. `base` is the surface's foot on the lower level, `axis` up it, `N` the
 *  surface's normal on the climber's side (perpendicular to the axis), `length` along the axis to the lip's height. */
export function climbSurface(p) {
  const rad = (p.lean * Math.PI) / 180, back = p.rise / Math.tan(rad);
  // a plumb surface stands off the wall: the rungs on brackets, the rope off its beam
  const off = p.variant === 'rungs' ? 0.2 : p.variant === 'rope' ? 0.4 : 0;
  const base = add([p.to[0], p.to[1], p.from[2]], mul(p.Nh, p.lean >= 89.99 ? off : back));
  const axis = unit(sub(add(p.to, mul(p.Nh, p.lean >= 89.99 ? off : 0)), base));
  const N = unit(sub(p.Nh, mul(axis, dot(p.Nh, axis))));
  return { base: P(base), axis: P(axis), N: P(N), length: r5(Math.hypot(...sub(add(p.to, mul(p.Nh, p.lean >= 89.99 ? off : 0)), base))), off };
}

// ── the build: blocks, values only on the obj:* groups ─────────────────────────────────────────────────────────────
const surf = (group, v) => ({ key: null, scale: 1, tint: [v, v, v], group });
function put(out, part, group, v, c, A, B, C, h) {
  const from = out.length;
  obox(out, c, A, B, C, h, surf(group, v), 8);
  for (let i = from; i < out.length; i++) Object.assign(out[i], { part, value: v });
  if (out.boxes) out.boxes[out.boxes.length - 1].part = part;
}
// a member from a to b: `t` wide across U, `d` deep across the third axis
function member(out, part, group, v, a, b, U, t, d) {
  const A = unit(sub(b, a)), C = unit(cross(A, U)), B = unit(cross(C, A));
  put(out, part, group, v, mul(add(a, b), 0.5), A, B, C, [Math.hypot(...sub(b, a)) / 2, t / 2, d / 2]);
}
// a block at c, `x` across U, `y` along N, `z` up the axis
function block(out, part, group, v, c, S, U, x, y, z) {
  put(out, part, group, v, c, U, S.N, S.axis, [x / 2, y / 2, z / 2]);
}

// the rails' section by timber: sawn is a plank on edge, round a pole, culm a thinner pole
const RAIL = { sawn: [0.05, 0.09], round: [0.08, 0.08], culm: [0.06, 0.06] };

const BUILD = {
  ladder(out, p, S) {
    const half = p.width / 2, [rt, rd] = RAIL[p.timber], up = (h) => h / Math.sin((p.lean * Math.PI) / 180);
    const at = (h, x) => add(add(S.base, mul(S.axis, up(h))), mul(p.U, x));
    const ext = 1.0;   // the horns: the rails past the lip, to hold stepping off (the extension law)
    for (const x of [-half - rt / 2, half + rt / 2]) {
      if (on(p, 'rails')) member(out, 'rails', 'obj:body', 0.42, at(0, x), at(p.rise, x), p.U, rt, rd);
      if (on(p, 'horns') && p.mount) member(out, 'horns', 'obj:status', 0.9, at(p.rise - 0.02, x), at(p.rise + ext, x), p.U, rt, rd);
      if (on(p, 'feet')) block(out, 'feet', 'obj:fill', 0.62, add(at(0, x), mul(S.axis, 0.04)), S, p.U, rt + 0.04, rd + 0.06, 0.08);
    }
    rungsUp(out, p, S, at, half, rt);
  },
  rungs(out, p, S) {
    const half = p.width / 2, rt = 0.06, rd = 0.014, at = (h, x) => add(add(S.base, mul(Z, h)), mul(p.U, x));
    for (const x of [-half - rt / 2, half + rt / 2]) {
      if (on(p, 'rails')) member(out, 'rails', 'obj:body', 0.4, at(0, x), at(p.rise, x), p.U, rt, rd);
      // grab bars: the rails carried on over the lip and bent back down onto the level
      if (on(p, 'grabs') && p.mount) {
        member(out, 'grabs', 'obj:status', 0.9, at(p.rise - 0.02, x), at(p.rise + 1.0, x), p.U, rt, rd);
        member(out, 'grabs', 'obj:status', 0.9, add(at(p.rise + 1.0, x), mul(p.Nh, 0.02)), add(at(p.rise + 1.0, x), mul(p.Nh, -S.off - 0.3)), p.U, rt, rd);
      }
      if (on(p, 'brackets')) for (let h = 0.4; h < p.rise; h += 1.5) member(out, 'brackets', 'obj:fill', 0.58, at(h, x), add(at(h, x), mul(p.Nh, -S.off)), p.U, 0.05, 0.06);
    }
    rungsUp(out, p, S, at, half, rt);
    // the cage: hoops round the climber from 2.2 m, tied by straps down its sides and back
    if (on(p, 'cage') && p.rise > 3 && (p.elements.cage || p.rise > 6)) {
      const R = 0.36, c0 = 2.2, top = p.rise + 1.0;
      for (let h = c0; h <= top + 1e-9; h += 0.9) for (const [a, b] of [[[-R, 0], [-R, R * 1.6]], [[-R, R * 1.6], [R, R * 1.6]], [[R, R * 1.6], [R, 0]]]) {
        const pa = add(at(h, a[0]), mul(p.Nh, a[1])), pb = add(at(h, b[0]), mul(p.Nh, b[1]));
        member(out, 'cage', 'obj:fill', 0.56, pa, pb, Z, 0.05, 0.012);
      }
      for (const [x, y] of [[-R, 0.4], [-R, R * 1.6], [0, R * 1.6], [R, R * 1.6], [R, 0.4]]) member(out, 'cage', 'obj:fill', 0.56, add(at(c0, x), mul(p.Nh, y)), add(at(top, x), mul(p.Nh, y)), p.U, 0.04, 0.012);
    }
  },
  rope(out, p, S) {
    const top = add(p.to, add(mul(p.Nh, S.off), [0, 0, 0.3])), bottom = add(S.base, [0, 0, 0.3]), r = 0.045;
    if (on(p, 'beam')) member(out, 'beam', 'obj:body', 0.4, add(top, mul(p.Nh, -S.off - 0.6)), add(top, mul(p.Nh, 0.18)), p.U, 0.16, 0.14);
    if (on(p, 'rope')) member(out, 'rope', 'obj:fill', 0.66, top, add(bottom, [0, 0, 0.3]), p.Nh, r, r);
    // the 33: wraps where the hands close, flush with the rope (the silhouette stays one line), the middle third's
    for (let h = 0.3 + p.pitch; h < p.rise; h += p.pitch) {
      const z = bottom[2] + h - 0.3;
      if (on(p, 'wraps') && z - bottom[2] > p.rise / 3 && z - bottom[2] < (2 * p.rise) / 3) member(out, 'wraps', 'obj:detail', 0.16, [bottom[0], bottom[1], z - 0.05], [bottom[0], bottom[1], z + 0.05], p.Nh, r + 0.004, r + 0.004);
    }
    // the tail: the whipped end below the climb, the thing a jump catches
    if (on(p, 'tail')) member(out, 'tail', 'obj:status', 0.9, bottom, add(bottom, [0, 0, 0.3]), p.Nh, r + 0.012, r + 0.012);
  },
  net(out, p, S) {
    const half = p.width / 2, up = (h) => h / Math.sin((p.lean * Math.PI) / 180), cols = Math.max(2, Math.round(p.width / p.pitch));
    const at = (h, x) => add(add(S.base, mul(S.axis, up(h))), mul(p.U, x)), dx = p.width / cols;
    if (on(p, 'bar')) member(out, 'bar', 'obj:body', 0.38, add(at(p.rise, -half - 0.35), [0, 0, 0.06]), add(at(p.rise, half + 0.35), [0, 0, 0.06]), S.axis, 0.12, 0.12);
    if (on(p, 'lip')) member(out, 'lip', 'obj:status', 0.9, add(at(p.rise, -half), [0, 0, 0.15]), add(at(p.rise, half), [0, 0, 0.15]), S.axis, 0.06, 0.06);
    if (on(p, 'cords')) {
      for (let i = 0; i <= cols; i++) member(out, 'cords', 'obj:fill', 0.64, at(0, -half + i * dx), at(p.rise, -half + i * dx), p.U, 0.03, 0.03);
      for (let k = 0; k <= p.steps; k++) member(out, 'cords', 'obj:fill', 0.7, at(k * p.pitch, -half - 0.015), at(k * p.pitch, half + 0.015), S.axis, 0.03, 0.03);
    }
    // the 33: the knots in the net's middle, dark where hands and boots cross it most
    if (on(p, 'knots')) for (let k = 0; k <= p.steps; k++) for (let i = 0; i <= cols; i++) {
      const h = k * p.pitch, x = -half + i * dx;
      if (h > p.rise / 3 - 1e-6 && h < (2 * p.rise) / 3 + 1e-6 && Math.abs(x) <= p.width / 6 + 1e-6) block(out, 'knots', 'obj:detail', 0.16, at(h, x), S, p.U, 0.05, 0.04, 0.05);
    }
    if (on(p, 'stakes')) for (const x of [-half, 0, half]) block(out, 'stakes', 'obj:body', 0.4, add(at(0, x), [0, 0, -0.12]), S, p.U, 0.06, 0.06, 0.34);
  },
};
// rungs up the rise, the middle third's joints dark (the 33): lashings, pegs, notches or collars by the joint
function rungsUp(out, p, S, at, half, rt) {
  for (let k = 1; k <= p.steps - (p.mount ? 1 : 0); k++) {
    const h = k * p.pitch;
    if (on(p, 'rungs')) member(out, 'rungs', 'obj:fill', 0.68 - 0.04 * (k % 2), at(h, -half - rt / 2), at(h, half + rt / 2), S.axis, 0.035, 0.035);
    if (on(p, 'joints') && h > p.rise / 3 - p.pitch / 2 && h < (2 * p.rise) / 3 + p.pitch / 2) for (const x of [-half - rt / 2, half + rt / 2]) block(out, JOINT_PART[p.joint], 'obj:detail', 0.18, at(h, x), S, p.U, rt + 0.03, 0.07, 0.08);
  }
}

/** The ladder's own numbers, for its laws. */
function measuresOf(p, S, faces) {
  const parts = new Set(faces.boxes.map((b) => b.part));
  return {
    pitch: p.pitch, clear: p.variant === 'rope' ? S.off : p.width, lean: p.lean, rise: p.rise, mounts: p.mount,
    extension: parts.has('horns') || parts.has('grabs') ? 1 : 0, caged: parts.has('cage'),
  };
}

export const LADDER = {
  id: 'ladder',
  name: 'Ladder',
  role: 'a climb from one level to the next: a ladder, fixed rungs, a rope, a net',
  interest: 'interactable',
  variants: LADDER_VARIANTS,
  skins: { greybox: true },
  when: 'a ladder, climb up, rungs up the wall, a fixed ladder, a rope to climb, a climbing rope, a cargo net, a climbing net, up to the ledge, onto the roof, a hatch ladder, up the tower',

  resolve({ variant, skin = 'greybox', params, ...spec } = {}) {
    if (skin !== 'greybox') throw new Error("playscape: a ladder has no skin '" + skin + "' (skins: greybox)");
    const p = params || ladderParams({ variant: variant ?? spec.variant, ...spec }), S = climbSurface(p), faces = blockSink();
    BUILD[p.variant](faces, p, S);
    const lateral = p.variant === 'net';
    return {
      entry: 'ladder', variant: p.variant, skin, params: p, interest: this.interest,
      frame: { at: P([p.to[0], p.to[1], p.from[2]]), N: p.Nh, U: p.U },   // judged face-on, from where the climb starts
      faces,
      climb: {
        form: p.variant, rise: p.rise, length: S.length, lean: p.lean, speed: p.speed, lateral, mounts: p.mount,
        seconds: r5(S.length / p.speed + (p.mount ? 0.5 : 0)),
        bottom: P(add(S.base, mul(p.Nh, 0.6))), top: p.mount ? P(add(p.to, mul(p.Nh, -0.5))) : null,
      },
      laws: ladderLaws(p.variant, measuresOf(p, S, faces)),
      elements: [...new Set(faces.boxes.map((b) => b.part))],
      world: this.lower(p, S),
    };
  },

  /** The climbable the world runs: its surface and landings. Nothing blocks the walk (the climber stands off it). */
  lower(p, S, id = `ladder-${p.variant}`) {
    const lateral = p.variant === 'net';
    return {
      faces: [], colliders: [],
      entities: [{
        id,
        rule: {
          type: 'climbable', form: p.variant, base: S.base, axis: S.axis, length: S.length, N: S.N, Nh: p.Nh, U: p.U,
          half: lateral ? r5(p.width / 2 - 0.25) : 0, speed: p.speed, standoff: 0.35, pitch: p.pitch,
          ...(p.variant === 'rope' ? { omni: true } : {}),
          top: p.mount ? P(add(p.to, mul(p.Nh, -0.5))) : null,
        },
        body: { type: 'none' },
        transform: { pos: S.base, heading: r5(Math.atan2(-p.Nh[1], -p.Nh[0])) },
      }],
    };
  },
};
