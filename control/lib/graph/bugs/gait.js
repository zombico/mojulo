/**
 * BUG GAIT — a bug's skeleton (skeleton.js) posed through one stride of one gait: per bone the rest → posed rotation
 * (`m`, row-major) and the posed head, the frames the fauna rig packs (fauna/rig.js packFaunaRig's format). Pure and
 * deterministic.
 *
 * In place (a treadmill): the body stays over its rest place, the ground slides back under the planted feet.
 *  - METACHRONAL footfalls (locomotion.js): each ground leg plants at its phase for `duty`, sliding back by the stride,
 *    then swings forward lifted. The coxa yaws the leg toward its foot about the body's up axis at the socket; femur
 *    and tibia solve two-link to the ankle, the knee on the side it bends at rest; the tarsus keeps its attitude. A
 *    leg built off the ground (a chela, a raptorial foreleg, a palp) rides the body. The body bobs with the stance and
 *    rocks about its up axis with each half stride (`rock`); a centipede's trunk snakes (`snake`).
 *  - STROKE (flight): the legs drawn in, the wings beat about the body's long axis at their roots (the hind pair `lag`
 *    of a beat behind), wing cases raised and spread first (`cases`).
 *  - ROW (a diving beetle's oars): the named legs sweep back together, the others drawn in.
 *  - TAIL FLIP (a lobster's escape): the abdomen curls under and snaps back, the body thrown backwards.
 *  - ANTENNAE sway, the two half a cycle apart.
 */
import { bugSkeleton } from './skeleton.js';
import { bugGaits } from './locomotion.js';
import { sub, add, mul, dot, cross, norm, unit, I3, mm, mv, rotX, rotY, rotZ, axisAngle, between } from '../fauna/vec.js';

const TAU = 2 * Math.PI, DEG = Math.PI / 180;
const frac = (x) => x - Math.floor(x);
const ease = (v) => 0.5 - 0.5 * Math.cos(Math.PI * v);
const T3 = (A) => [[A[0][0], A[1][0], A[2][0]], [A[0][1], A[1][1], A[2][1]], [A[0][2], A[1][2], A[2][2]]];

/** Everything a pose reads, once per bug: the skeleton, its bones by id, each leg's rest joints, the body's size. */
export function prepareBug(B, id = null) {
  const K = bugSkeleton(B), by = Object.fromEntries(K.bones.map((b) => [b.id, b]));
  const legs = [];
  for (const g of K.legs) for (const side of ['R', 'L']) {
    const ids = g[side], [c, f, t, s] = ids.map((x) => by[x]);
    legs.push({ key: `${g.pair}${side}`, pair: g.pair, side, ground: g.ground, ids, rest: { socket: c.head, hip: c.tail, knee: f.tail, ankle: t.tail, foot: s.tail } });
  }
  const ground = [...new Set(legs.filter((l) => l.ground).map((l) => l.pair))].sort((a, b) => a - b);
  const trunk = K.bones.filter((b) => /^trunk\d+$/.test(b.id));
  const pivot = mul(add(trunk[0].head, trunk[trunk.length - 1].tail), 0.5);
  const hipH = ground.length ? legs.filter((l) => l.ground).reduce((s, l) => s + l.rest.hip[2], 0) / legs.filter((l) => l.ground).length : B.length * 0.1;
  const gaits = Object.fromEntries(Object.entries(bugGaits(B.order, id)).map(([k, g]) => [k, { ...g }]).filter(([, g]) => {
    if (g.pattern === 'stroke') return K.bones.some((b) => b.role === 'wing');
    if (g.pattern === 'tailFlip') return K.bones.some((b) => /^tail\d+$/.test(b.id)) && K.rig.sections.tail.n >= 3;
    if (g.pattern === 'metachronal') return ground.length >= 2;
    return true;
  }));
  // the STRIDE a leg can take: no longer than the ground legs reach either way along the stride's line from their rest
  // foot (bisected against each leg's femur + tibia), so a planted foot is never asked past its reach
  const reach = (dir) => Math.min(...legs.filter((l) => l.ground).map((l) => {
    const { hip, knee, ankle, foot } = l.rest, span = 0.97 * (norm(sub(knee, hip)) + norm(sub(ankle, knee))), A0 = ankle;
    const ok = (dl) => [-1, 1].every((sg) => { const A = add(A0, mul(dir, sg * dl)), dx = A[0] - hip[0], dy = A[1] - hip[1];
      return Math.hypot(dx, dy, A[2] - hip[2]) <= span; });
    let lo = 0, hi = B.length; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; }
    return 2 * lo;
  }));
  for (const g of Object.values(gaits)) if (g.pattern === 'metachronal') g.exc = Math.min(g.stride * B.length, 0.9 * reach(g.sideways ? [1, 0, 0] : [0, 1, 0]));
  return { B, K, by, legs, ground, pivot, L: B.length, hipH, gaits };
}

/**
 * Forward kinematics with leg targets. `pose`: { root: { R, T } (about the trunk's middle), local: { <bone>: R }
 * (about its rest head, in the rest frame), feet: { <pair><side>: [x, y, z] } (a world target for that leg's foot) }.
 */
export function poseBones(ctx, pose) {
  const { K, by } = ctx, out = {}, root = pose.root || { R: I3, T: [0, 0, 0] };
  const legOf = Object.fromEntries(ctx.legs.map((l) => [l.ids[0], l]));
  for (const b of K.bones) {
    if (out[b.id]) continue;
    const Lb = pose.local?.[b.id] || I3;
    let head, m;
    if (!b.parent) { m = mm(root.R, Lb); head = add(add(ctx.pivot, root.T), mv(root.R, sub(b.head, ctx.pivot))); }
    else { const p = out[b.parent], P = by[b.parent]; head = add(p.head, mv(p.m, sub(b.head, P.head))); m = mm(p.m, Lb); }
    const leg = legOf[b.id], F = leg && pose.feet?.[leg.key];
    if (leg && F) { Object.assign(out, solveLeg(ctx, leg, out[b.parent], head, F, pose.local)); continue; }
    out[b.id] = { m, head };
  }
  return out;
}

/** one leg to its foot target: the coxa's yaw, the femur and tibia two-link, the tarsus held */
function solveLeg(ctx, leg, parent, socketW, Fw, local) {
  const { by } = ctx, Mp = parent.m, Mt = T3(Mp), { socket: s, hip: hp, knee: kn, ankle: an, foot: ft } = leg.rest;
  const toL = (q) => add(s, mv(Mt, sub(q, socketW))), toW = (q) => add(socketW, mv(Mp, sub(q, s)));
  const Fl = toL(Fw), Al0 = sub(Fl, sub(ft, an));
  // the coxa's yaw about the body's up axis: the rest ankle's bearing from the socket onto the target's
  const a = [an[0] - s[0], an[1] - s[1]], b = [Al0[0] - s[0], Al0[1] - s[1]];
  const yaw = Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]);
  const R0 = mm(rotZ(yaw), local?.[leg.ids[0]] || I3), rot = (q) => add(s, mv(R0, sub(q, s)));
  const hip = rot(hp), A = sub(Fl, mv(R0, sub(ft, an)));
  const l1 = norm(sub(kn, hp)), l2 = norm(sub(an, kn));
  let d = sub(A, hip), D = norm(d); const Dc = Math.max(Math.abs(l1 - l2) * 1.001 + 1e-12, Math.min((l1 + l2) * 0.999, D));
  const dh = D > 1e-12 ? mul(d, 1 / D) : [0, 0, -1], Ac = add(hip, mul(dh, Dc));
  const pole0 = mv(R0, sub(kn, hp)), poleP = sub(pole0, mul(dh, dot(pole0, dh))), pole = norm(poleP) > 1e-12 ? unit(poleP) : [0, 0, 1];
  const x = (l1 * l1 - l2 * l2 + Dc * Dc) / (2 * Dc), h = Math.sqrt(Math.max(0, l1 * l1 - x * x)), knee = add(add(hip, mul(dh, x)), mul(pole, h));
  const Fc = add(Ac, mv(R0, sub(ft, an)));
  const turn = (restA, restB, newA, newB) => mm(between(unit(mv(R0, sub(restB, restA))), unit(sub(newB, newA))), R0);
  const [c, f, t, ts] = leg.ids, res = {};
  res[c] = { m: mm(Mp, R0), head: socketW };
  res[f] = { m: mm(Mp, turn(hp, kn, hip, knee)), head: toW(hip) };
  res[t] = { m: mm(Mp, turn(kn, an, knee, Ac)), head: toW(knee) };
  res[ts] = { m: mm(Mp, turn(an, ft, Ac, Fc)), head: toW(Ac) };
  // a chela's movable finger rides its tarsus
  const dac = `leg${leg.pair}Dactyl${leg.side}`;
  if (by[dac]) res[dac] = { m: mm(res[ts].m, local?.[dac] || I3), head: add(res[ts].head, mv(res[ts].m, sub(by[dac].head, an))) };
  return res;
}

/** the antennae's sway, the two half a cycle apart */
function antennae(ctx, t, amp = 8, local = {}) {
  for (const b of ctx.K.bones) if (b.role === 'antenna' && /^antenna0[RL]$/.test(b.id)) {
    const s = b.id.endsWith('R') ? 1 : -1, ph = t + (s > 0 ? 0 : 0.5);
    local[b.id] = mm(rotZ(s * amp * DEG * Math.sin(TAU * ph)), rotX(0.5 * amp * DEG * Math.sin(TAU * ph + 1)));
  }
  return local;
}

/** a ground leg's phase offset in the metachronal rule */
const legPhase = (ctx, leg, g) => {
  const n = ctx.ground.length, k = ctx.ground.indexOf(leg.pair), j = g.wave === 'retrograde' ? k : n - 1 - k;
  return frac(j * g.w + (leg.side === 'L' ? 0.5 : 0));
};

/** the drawn-in foot (flight, rowing, a tuck): the foot pulled toward under its socket by `k`, raised off the ground */
const tucked = (leg, k) => { const { socket: s, foot: f } = leg.rest; return [s[0] + (f[0] - s[0]) * (1 - k), s[1] + (f[1] - s[1]) * (1 - k), Math.max(f[2], s[2] * (0.2 + 0.6 * k))]; };

/** A gait's pose at phase t ∈ [0, 1): the pose spec poseBones reads. */
export function gaitPose(ctx, gait, t) {
  const g = ctx.gaits[gait]; if (!g) throw new Error(`bug gait: no '${gait}' (it moves by: ${Object.keys(ctx.gaits).join(', ')})`);
  const L = ctx.L, local = antennae(ctx, t), feet = {};
  let R = I3, T = [0, 0, 0];
  if (g.pattern === 'metachronal') {
    const exc = g.exc ?? g.stride * L, lift = g.lift * ctx.hipH;
    for (const leg of ctx.legs) {
      if (!leg.ground) continue;
      const u = frac(t - legPhase(ctx, leg, g)), f = leg.rest.foot;
      let slide, z = f[2];
      if (u < g.duty) slide = exc * (0.5 - u / g.duty);
      else { const v = (u - g.duty) / (1 - g.duty); slide = exc * (ease(v) - 0.5); z += lift * Math.sin(Math.PI * v); }
      // a crab walks to its right: the stride along x
      feet[leg.key] = g.sideways ? [f[0] - slide, f[1], z] : [f[0], f[1] + slide, z];
    }
    // the body bobs with the stance (twice a stride) and rocks about its up axis with each half
    T = [0, 0, -0.04 * ctx.hipH * Math.cos(2 * TAU * t)];
    R = rotZ((g.rock || 0) * DEG * Math.sin(TAU * t));
    if (g.snake) for (const b of ctx.K.bones) { const m = b.id.match(/^trunk(\d+)$/); if (m) local[b.id] = rotZ(g.snake * DEG * Math.sin(TAU * (t - +m[1] * 0.12))); }
  } else if (g.pattern === 'stroke') {
    for (const leg of ctx.legs) feet[leg.key] = tucked(leg, g.tuck);
    T = [0, 0, ctx.hipH * 0.6]; R = rotX(-8 * DEG);
    for (const b of ctx.K.bones) {
      const s = b.id.endsWith('R') ? 1 : -1;
      // a wing folded back over the body is first spread out to its side (about the up axis), then beats
      if (b.role === 'wing') { const lag = /Hind/.test(b.id) ? g.lag : 0, a = g.amp * DEG * Math.sin(TAU * (t - lag)), sw = g.sweep * DEG * Math.cos(TAU * (t - lag));
        const d = sub(b.tail, b.head), hz = unit([d[0], d[1], 0]), out = [s * Math.cos(10 * DEG), -Math.sin(10 * DEG), 0];
        local[b.id] = mm(mm(rotY(-s * a), rotZ(s * sw)), norm(hz) > 0 ? between(hz, out) : I3); }
      // a wing case hinges at its front: its rear raised, then swung out
      if (b.role === 'elytron') local[b.id] = mm(rotZ(s * 25 * DEG), rotX(-(g.cases ?? 35) * DEG));
    }
  } else if (g.pattern === 'row') {
    const amp = g.amp * DEG, hind = ctx.ground.length ? ctx.ground[ctx.ground.length - 1] : -1;
    for (const leg of ctx.legs) {
      if (leg.pair === hind || g.legs !== 'hind') {
        // the oar: a fast power stroke back (the first 40 %), a slow recovery forward
        const v = t < 0.4 ? t / 0.4 : 1 - (t - 0.4) / 0.6, s = leg.side === 'R' ? 1 : -1;
        local[leg.ids[0]] = rotZ(-s * amp * (ease(v) - 0.5));
      } else feet[leg.key] = tucked(leg, 0.5);
    }
    T = [0, 0, ctx.hipH * 0.8];
  } else if (g.pattern === 'tailFlip') {
    // the snap: a fast curl under (the first quarter), held, a slow uncurl; the body thrown back and up
    const v = t < 0.25 ? ease(t / 0.25) : t < 0.45 ? 1 : 1 - ease((t - 0.45) / 0.55);
    const tails = ctx.K.bones.filter((b) => /^tail\d+$/.test(b.id));
    for (const b of tails) local[b.id] = rotX((g.curl / tails.length) * 1.4 * DEG * v);
    for (const leg of ctx.legs) feet[leg.key] = tucked(leg, 0.35 * v);
    T = [0, -0.25 * L * v, ctx.hipH * 0.5 * v];
    R = rotX(-12 * DEG * v);
  }
  return { root: { R, T }, local, feet };
}

/** n frames of a gait: per bone `{ m, head }` (the shape fauna/rig.js packs) */
export function bugGaitFrames(ctx, gait, n = 24) {
  return Array.from({ length: n }, (_, i) => ({ t: i / n, bones: poseBones(ctx, gaitPose(ctx, gait, i / n)) }));
}

/** the most beats a second a 60 fps screen still shows as beats (three frames or more a beat); faster strobes */
export const WINGBEAT_CAP = 18;
export const WINGBEATS = ['auto', 'beat', 'blur'];

/**
 * How a flight's wings show: `{ mode: 'beat' | 'blur', hz (the beats a second the clip plays), real (the order's
 * measured rate) }`. `ask`: 'auto' (the default) beats at the real rate when a screen can show it (a butterfly's 10, a
 * dragonfly's 30 is past it) and blurs past it (a bee's 230); 'beat' always beats, at most at the cap; 'blur' always
 * blurs; a number of beats a second beats at it up to the cap, blurs past it. A blurred flight's clip still beats at
 * the cap (an engine export plays it); the World draws the swept fan over it instead (bugs/rig.js).
 */
export function wingbeat(ctx, gait, ask = 'auto') {
  const g = ctx.gaits[gait], real = g.hz ?? 50;
  if (typeof ask === 'number') { if (!(ask > 0)) throw new Error('`wingbeat` beats a second must be a positive number'); return ask <= WINGBEAT_CAP ? { mode: 'beat', hz: ask, real } : { mode: 'blur', hz: WINGBEAT_CAP, real }; }
  if (!WINGBEATS.includes(ask)) throw new Error(`\`wingbeat\` is ${WINGBEATS.join(' | ')} or beats a second`);
  if (ask === 'blur') return { mode: 'blur', hz: Math.min(real, WINGBEAT_CAP), real };
  if (ask === 'beat') return { mode: 'beat', hz: Math.min(real, WINGBEAT_CAP), real };
  return real <= WINGBEAT_CAP ? { mode: 'beat', hz: real, real } : { mode: 'blur', hz: WINGBEAT_CAP, real };
}

/** a stride's (a beat's, a flip's) duration, seconds: a slower stride on a bigger bug; a wingbeat at its shown rate */
export function bugGaitSeconds(ctx, gait, { wingbeat: ask = 'auto' } = {}) {
  const g = ctx.gaits[gait], size = Math.sqrt(ctx.L / 0.05);
  if (g.pattern === 'stroke') return Math.round((1 / wingbeat(ctx, gait, ask).hz) * 1e4) / 1e4;
  const base = g.pattern === 'tailFlip' ? 0.8 : g.pattern === 'row' ? 0.6 : g.duty < 0.45 ? 0.35 : 0.6;
  return Math.round(Math.max(0.08, Math.min(2, base * size)) * 1e4) / 1e4;
}
