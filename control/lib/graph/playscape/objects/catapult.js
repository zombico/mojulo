/**
 * catapult — a launcher that stays put and throws the player, its throw tuned by how the player comes in.
 *
 *   fixed     one arc whatever the approach (a cannon, a launch star); give a `target` and it solves the power
 *   redirect  keeps the run-up's speed (× `gain`) and sends it along the pad at `angle` (a dash panel, an angled spring)
 *   bounce    returns the fall (× `restitution`, at least `power`) and keeps the run (a trampoline, a mushroom)
 *
 * The rider steers in the air by default (the platform rule's air control rides on top of the throw); `locked` takes
 * the steering until it lands, for a scenic route that must arrive where it was aimed. `cone` limits the approaches
 * it takes (degrees about `dir`); absent, any.
 *
 * A catapult answers for itself: the ARC for an approach (stepped with the platform rule's own integrator: its rise
 * and fall gravity and its fall cap, so a solved target is where the world lands the rider), its apex and landing,
 * the TUBE the rider's body flies through (a level keeps it clear), how far steering can move the landing (`reach`),
 * and the pieces the world runs: a pad, its collider, and a `launcher` entity. Its moving part is a plate on a lift
 * joint, so t is the throw.
 */
import { obox } from '../../era/props.js';
import { r5, P } from '../../era/geom.js';
import { collider, sweep } from './mechanism.js';

const Z = [0, 0, 1];
const DT = 1 / 60;
// the platform rule's defaults: its rise and fall gravity, fall cap, run speed and air control; the walker's body
export const RIDER = Object.freeze({ gravity: 20, fallGravity: 34, maxFall: 26, speed: 6, airControl: 0.7, radius: 0.35, height: 1.8 });

export const CATAPULT_VARIANTS = {
  fixed: { about: 'one arc whatever the approach; give a target and it solves the power' },
  redirect: { about: 'keeps the run-up\'s speed and sends it along the pad' },
  bounce: { about: 'returns the fall, so a higher drop goes higher, and keeps the run' },
};
export const CATAPULT_VARIANT_IDS = Object.freeze(Object.keys(CATAPULT_VARIANTS));

const unit2 = (d) => { const n = Math.hypot(d[0], d[1]); if (!(n > 0)) throw new Error('catapult: dir must be a heading [x, y], not zero'); return [d[0] / n, d[1] / n]; };
const riderOf = (r) => ({ ...RIDER, ...(r || {}), fallGravity: r?.fallGravity ?? (r?.gravity ? r.gravity * 1.7 : RIDER.fallGravity) });

/** The flight from a throw `v` [x, y, z], stepped as the platform rule steps it, until it comes down to `floor` (z off the pad top). */
export function flight(v, rider = RIDER, floor = 0, maxT = 12) {
  const R = riderOf(rider);
  let p = [0, 0, 0], vz = v[2], t = 0, apex = [0, 0, 0];
  const pts = [[0, 0, 0]];
  while (t < maxT) {
    vz = Math.max(-R.maxFall, vz - (vz > 0 ? R.gravity : R.fallGravity) * DT);
    const q = [p[0] + v[0] * DT, p[1] + v[1] * DT, p[2] + vz * DT];
    t += DT;
    if (vz <= 0 && q[2] <= floor) {   // down through the floor this tick: land where the path crosses it
      const f = (p[2] - floor) / Math.max(1e-9, p[2] - q[2]);
      p = [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, floor];
      pts.push(p);
      return { pts, apex, land: p, time: t, vz, landed: true };
    }
    p = q;
    if (p[2] > apex[2]) apex = p;
    pts.push(p);
  }
  return { pts, apex, land: p, time: t, vz, landed: false };
}

/** The throw for an approach: `run` [vx, vy] m/s across the ground, `fall` m/s coming down. */
export function throwFor(p, { run = [0, 0], fall = 0 } = {}) {
  const a = (p.angle * Math.PI) / 180, d = p.dir, runSpeed = Math.hypot(run[0], run[1]);
  if (p.cone != null && !(runSpeed > 0.5 && (run[0] * d[0] + run[1] * d[1]) / runSpeed >= Math.cos(((p.cone / 2) * Math.PI) / 180))) return null;
  if (p.mode === 'bounce') return [run[0] * p.gain, run[1] * p.gain, Math.min(p.cap, Math.max(p.power, p.restitution * fall))];
  const s = Math.min(p.cap, p.power + (p.mode === 'redirect' ? p.gain * runSpeed : 0));
  return [d[0] * s * Math.cos(a), d[1] * s * Math.cos(a), s * Math.sin(a)];
}

/** The power that lands a fixed throw at `target` [dx, dy, dz] off the pad top, at `angle`; by bisection on the stepped flight. */
export function solvePower(target, angle, rider = RIDER, cap = 40) {
  const D = Math.hypot(target[0], target[1]), a = (angle * Math.PI) / 180;
  const reach = (s) => { const f = flight([s * Math.cos(a), 0, s * Math.sin(a)], rider, target[2]); return f.landed ? f.land[0] : -1; };
  if (reach(cap) < D) throw new Error(`catapult: a target ${r5(D)} m out and ${r5(target[2])} m up is out of reach at ${angle}° under a cap of ${cap} m/s`);
  let lo = 0, hi = cap;
  for (let i = 0; i < 48; i++) { const m = (lo + hi) / 2; if (reach(m) < D) lo = m; else hi = m; }
  return r5(hi);
}

export function catapultParams({ mode = 'fixed', at = [0, 0, 0], dir = [1, 0], angle = 60, power = 12, gain = 1, cap = 40, restitution = 0.8, cone, target, area = 2.25, aspect = 1, height = 0.3, reload = 0.6, locked = false, rider } = {}) {
  if (!CATAPULT_VARIANTS[mode]) throw new Error(`playscape: a catapult has no variant '${mode}' (variants: ${CATAPULT_VARIANT_IDS.join(', ')})`);
  if (!(area > 0)) throw new Error('catapult: area must be square metres above 0 (the pad\'s top)');
  if (!(angle > 0 && angle < 90)) throw new Error('catapult: angle must be degrees between 0 and 90');
  if (target && mode !== 'fixed') throw new Error('catapult: a target is solved for a fixed throw only (redirect and bounce depend on the approach)');
  const R = riderOf(rider), u = target ? unit2(target) : unit2(dir);
  const pw = target ? solvePower(target, angle, R, cap) : power;
  return {
    mode, at: P(at), dir: P(u), angle, power: pw, gain, cap, restitution, ...(cone != null ? { cone } : {}), ...(target ? { target: P(target) } : {}),
    area: r5(area), w: r5(Math.sqrt(area * aspect)), d: r5(Math.sqrt(area / aspect)), height, reload, locked: !!locked, rider: R,
  };
}

// the plate: a lift leaf in the pad's own frame (u across, n front, z up), thrown up by t
const plateLeaf = (p) => ({ id: 'plate', span: [-p.w / 2, p.w / 2], rise: [p.height - 0.08, p.height], thick: p.d, joint: { type: 'lift', travel: 0.25 } });

// ── skins: values only, on the obj:* groups ──────────────────────────────────────────────────────────────────────
const surf = (group, v) => ({ key: null, scale: 1, tint: [v, v, v], group });
function box(out, part, group, v, c, A, B, h) {
  const from = out.length;
  obox(out, c, A, B, Z, h, surf(group, v), 8);
  for (let i = from; i < out.length; i++) Object.assign(out[i], { part, value: v });
}

export const CATAPULT_SKINS = {
  // a dark base, the plate a band lighter riding on it, and between them the spring, darkest, a third of the pad wide
  // (the 33: it shows the throw, and opens as the plate goes up). The accent says where it throws: a run of chevrons
  // along the heading (a longer run, a stronger throw: juxtaposition), a ring for a bounce, which throws back up
  greybox: (out, p, t) => {
    const [x, y, z] = p.at, X = [p.dir[0], p.dir[1], 0], Y = [-p.dir[1], p.dir[0], 0], lift = 0.25 * t, base = p.height - 0.18;
    box(out, 'body', 'obj:body', 0.38, [x, y, z + base / 2], X, Y, [p.w / 2, p.d / 2, base / 2]);
    const coil = (0.1 + lift) / 2;
    box(out, 'detail', 'obj:detail', 0.16, [x, y, z + base + coil], X, Y, [p.w * 0.18, p.d * 0.18, coil]);
    const top = z + p.height + lift;
    box(out, 'fill', 'obj:fill', 0.74, [x, y, top - 0.04], X, Y, [p.w / 2 - 0.03, p.d / 2 - 0.03, 0.04]);
    const at = (f, s) => [x + X[0] * f + Y[0] * s, y + X[1] * f + Y[1] * s, top + 0.012];
    if (p.mode === 'bounce') {
      const r = Math.min(p.w, p.d) * 0.3, k = 0.06;
      for (const [f, s, hx, hy] of [[0, r, r, k], [0, -r, r, k], [r, 0, k, r], [-r, 0, k, r]]) box(out, 'handle', 'obj:status', 0.9, at(f, s), X, Y, [hx, hy, 0.012]);
      return;
    }
    const n = Math.max(1, Math.min(3, Math.round(p.power / 8))), step = p.w / (n + 2), arm = Math.min(p.d, p.w) * 0.22;
    const c45 = Math.SQRT1_2, A1 = [(X[0] - Y[0]) * c45, (X[1] - Y[1]) * c45, 0], A2 = [(X[0] + Y[0]) * c45, (X[1] + Y[1]) * c45, 0];
    for (let i = 0; i < n; i++) {
      const f = (i - (n - 1) / 2) * step;
      box(out, 'handle', 'obj:status', 0.9, at(f - arm * c45 / 2, arm * c45 / 2), A1, [-A1[1], A1[0], 0], [arm / 2, 0.05, 0.012]);
      box(out, 'handle', 'obj:status', 0.9, at(f - arm * c45 / 2, -arm * c45 / 2), A2, [-A2[1], A2[0], 0], [arm / 2, 0.05, 0.012]);
    }
  },
};
export const CATAPULT_SKIN_IDS = Object.freeze(Object.keys(CATAPULT_SKINS));

// the default approach a card or a bench reads an arc for: a walk-in for redirect, a 3 m drop for bounce
const defaultApproach = (p) => (p.mode === 'bounce'
  ? { run: [0, 0], fall: Math.min(p.rider.maxFall, Math.sqrt(2 * p.rider.fallGravity * 3)) }
  : { run: [p.dir[0] * p.rider.speed, p.dir[1] * p.rider.speed], fall: 0 });

/** The tube a rider's body flies through: a box per stretch of the arc, the walker's radius about it and its height over it. */
function tube(pts, at, R, every = 6) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i += every) {
    const a = pts[i], b = pts[Math.min(pts.length - 1, i + every)];
    out.push({ min: P([0, 1, 2].map((k) => at[k] + Math.min(a[k], b[k]) - (k === 2 ? 0 : R.radius))), max: P([0, 1, 2].map((k) => at[k] + Math.max(a[k], b[k]) + (k === 2 ? R.height : R.radius))) });
  }
  return out;
}

export const CATAPULT = {
  id: 'catapult',
  name: 'Catapult',
  role: 'stays put and throws the player, tuned by how they come in',
  interest: 'interactable',
  variants: CATAPULT_VARIANTS,
  skins: CATAPULT_SKINS,
  when: 'a catapult, a launcher, a launch pad, a spring, a jump pad, a bounce pad, a trampoline, a cannon, a boost pad, a dash panel, a scenic launch',

  resolve({ variant, skin = 'greybox', t = 0, params, approach, ...spec } = {}) {
    if (!CATAPULT_SKINS[skin]) throw new Error(`playscape: a catapult has no skin '${skin}' (skins: ${CATAPULT_SKIN_IDS.join(', ')})`);
    const p = params || catapultParams({ mode: variant ?? spec.mode, ...spec }), at = Math.min(1, Math.max(0, t)), faces = [];
    CATAPULT_SKINS[skin](faces, p, at);
    const top = P([p.at[0], p.at[1], p.at[2] + p.height]), app = approach || defaultApproach(p), v = throwFor(p, app);
    const f = v && flight(v, p.rider, p.target ? p.target[2] : 0);
    const W = (q) => P([top[0] + q[0], top[1] + q[1], top[2] + q[2]]);
    const frame = { at: P(p.at), N: [-p.dir[1], p.dir[0], 0].map((k) => -k), U: [p.dir[0], p.dir[1], 0] };
    const leaf = plateLeaf(p), toW = (b) => ({ ...b, min: W([b.min[0], b.min[1], b.min[2] - p.height]), max: W([b.max[0], b.max[1], b.max[2] - p.height]) });
    return {
      entry: 'catapult', variant: p.mode, skin, t: at, params: p, interest: this.interest, frame, faces,
      pad: { top, half: [r5(p.w / 2), r5(p.d / 2)] },
      collider: collider([leaf], at).map(toW).map((b) => ({ ...b, of: 'plate' })),
      sweep: sweep([leaf]).map(toW),
      approach: app,
      throw: v ? P(v) : null,   // null: the approach is outside the cone, so it does not throw
      arc: f ? {
        points: f.pts.filter((_, i) => i % 3 === 0 || i === f.pts.length - 1).map(W),
        apex: W(f.apex), land: W(f.land), seconds: r5(f.time), landed: f.landed,
        tube: tube(f.pts, top, p.rider),
      } : null,
      steer: !p.locked,
      reach: f && !p.locked ? r5(p.rider.airControl * p.rider.speed * f.time) : 0,   // how far steering can move the landing
      world: this.lower(p),
    };
  },

  /** A pad (a box body with its collider) and the `launcher` the world runs on it. */
  lower(p, id = 'catapult') {
    const [x, y, z] = p.at, hw = p.w / 2, hd = p.d / 2, rad = Math.atan2(p.dir[1], p.dir[0]);
    return {
      faces: [],
      colliders: [{ min: P([x - hw, y - hd, z]), max: P([x + hw, y + hd, z + p.height]) }],
      entities: [{
        id,
        rule: {
          type: 'launcher', mode: p.mode, dir: [...p.dir], angle: p.angle, power: p.power, gain: p.gain, cap: p.cap, restitution: p.restitution,
          ...(p.cone != null ? { cone: p.cone } : {}), half: [r5(hw), r5(hd)], top: r5(p.height / 2), reload: p.reload, ...(p.locked ? { locked: true } : {}),
        },
        body: { type: 'mesh', shape: 'box', size: [p.w, p.d, p.height], color: '#9aa0a8', marker: false },
        transform: { pos: P([x, y, z + p.height / 2]), heading: r5(rad) },
      }],
    };
  },
};
