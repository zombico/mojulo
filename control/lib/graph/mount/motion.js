/**
 * motion — a mount's ONE-SHOTS: a change of gait, a halt, a move off from the stand. Not periodic, so solved on a
 * timeline in seconds, hooves planted in the WORLD (the clip carries its root's travel), the frames given in the
 * body-following frame the cycles use (the centre of mass over y = 0), so a one-shot slots between two cycles.
 *
 * PHASE WARPING  one stride phase θ(t) runs at a frequency eased from the first gait's to the second's (a quintic over
 *   the transition window, so the change is C2); each hoof's footfall offset eases from the first gait's pattern to the
 *   second's (by the shorter way round); the speed, the stance length (the duty follows from it), where the hooves land
 *   and how wide, the lift and the fold ease with it. A hoof lands where its leg's phase θ − φ crosses a whole stride and lifts where it crosses that plus
 *   the duty, found by bisection: the footfalls come out of the warp, never listed.
 * THE STANCE     the hoof planted where it landed, its spot chosen at touchdown from the gait then (centred on the stance
 *   it expects, as in the cycles; a changing gait runs it off centre), its fetlock sinking under its share of the weight
 *   over the stance, rolling over its toe in breakover.
 * THE SWING      laid between the stance it leaves and the one it lands in, as the cycles lay it (schedule.js, legs.js).
 * THE BODY       the two cycles' bodies, each read at the warped phase, blended by the window: the clip opens on the
 *   first gait's pose and closes on the second's exactly (the gate measures both seams).
 * A HALT keeps the cadence while the speed falls; from a moment in the window each hoof's next landing is its last,
 *   on its standing spot, and the body settles into the stand once the last one is down. A MOVE OFF is the halt's
 *   opposite: the hooves leave their standing spots in the gait's own order as the speed rises.
 *
 *   oneShot(B, { from, to, strides, lead }) → { kind, duration, poseAt(t), rootAt(t), stances, entry, exit, A, B }
 *   from / to: a gait word ('walk', 'trot', 'canter', 'gallop') or 'stand'; strides: the window's length in strides.
 */
import { GAITS } from './reference.js';
import { gaitCycle, standPose } from './gait.js';
import { hoofForce } from './load.js';
import { sub, len } from './limb.js';
import { schedulePoser } from './schedule.js';
import { MECHANICS } from './reference.js';

const DEG = Math.PI / 180;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (v) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(v));
const lerp = (a, b, s) => a + (b - a) * s;
/** the quintic smoothstep and its integral (C2: the window's ends do not jerk) */
const S5 = (u) => { u = clamp01(u); return u * u * u * (10 - 15 * u + 6 * u * u); };
const I5 = (u) => (u <= 0 ? 0 : u >= 1 ? 0.5 + (u - 1) : u ** 4 * (2.5 - 3 * u + u * u));
const IDS = ['LF', 'RF', 'LH', 'RH'];
const wrap = (d) => d - Math.round(d);      // the shorter way round, in strides
const BODY_KEYS = ['z', 'pitch', 'psi', 'sway', 'rollF', 'rollH', 'nu', 'lat', 'tau'];

function standCycle(B) {
  const st = standPose(B);
  return {
    gait: 'stand', speed: 0, f: null, duty: 1, fold: { carpus: 0, fetlock: 0, peak: 0.4 }, lift: { fore: 0, hind: 0 }, stand: st,
    limbs: IDS.map((id) => { const pair = id[1] === 'F' ? 'fore' : 'hind', side = id[0] === 'R' ? 1 : -1;
      return { id, pair, side, phase: 0, yc: B[pair].hoofY, x: side * B[pair].hoofX, share: B.share[pair] / 2 }; }),
    bodyFull: () => ({ z: B.trunk.com[1], pitch: 0, psi: 0, sway: 0, rollF: 0, rollH: 0, nu: 0, lat: 0, tau: 0 }),
  };
}

export function oneShot(B, { from, to, strides = 1.5, lead = 'right' }) {
  if (from === 'stand' && to === 'stand') throw new Error('mount: a one-shot from the stand to the stand is no motion');
  const cyc = (g) => (g === 'stand' ? standCycle(B) : (() => { if (!GAITS[g]) throw new Error(`mount: '${g}' is not a gait`); return gaitCycle(B, g, { lead }); })());
  const A = cyc(from), Bc = cyc(to);
  const halt = to === 'stand', moveOff = from === 'stand';
  const kind = halt ? 'halt' : moveOff ? 'move-off' : 'change';
  const R = halt ? A : Bc;                                   // the moving gait of a halt or a move off
  // the timeline: a lead-in of half a stride of the first gait, the window, the rest of the second gait to a whole stride
  const fA = A.f ?? R.f, fB = Bc.f ?? R.f;
  // a full stride of lead-in for a change, so every stance standing at the clip's start has lifted before the window
  const Tin = (kind === 'change' ? 1 : 0.5) / fA, Tw = strides * 2 / (fA + fB);
  const t1 = Tin, t2 = Tin + Tw;
  const s = (t) => S5((t - t1) / Tw);
  const f = (t) => lerp(fA, fB, s(t));
  const v = (t) => lerp(A.speed, Bc.speed, s(t));
  // θ and the root's travel, exact: ∫ of a quintic-eased line
  const integ = (a, b, t) => a * t + (b - a) * Tw * I5((t - t1) / Tw);
  // a change or a halt opens on the first gait's phase 0; a move off is timed so its first hoof lifts just after the unlock
  const tUnlock = t1 + 0.1 * Tw;
  const theta0 = moveOff ? 0.1 - integ(fA, fB, tUnlock) : 0;
  const theta = (t) => theta0 + integ(fA, fB, t);
  const rootAt = (t) => integ(A.speed, Bc.speed, t);
  const off = {};
  for (const id of IDS) {
    const a = A.limbs.find((l) => l.id === id), b = Bc.limbs.find((l) => l.id === id);
    off[id] = { a: halt || moveOff ? R.limbs.find((l) => l.id === id).phase : a.phase, d: halt || moveOff ? 0 : wrap(b.phase - a.phase) };
  }
  const phi = (id, t) => off[id].a + off[id].d * s(t);
  // the duty follows from the STANCE LENGTH (the ground a hoof covers planted, L·duty), which is what eases: blending the
  // duty, the speed and the cadence each on its own makes the strides between two gaits longer underfoot than either
  const stanceLen = (C) => C.speed / C.f * C.duty;
  const duty = (t) => Math.min(0.95, Math.max(0.05, lerp(stanceLen(A), stanceLen(Bc), s(t)) * f(t) / v(t)));
  const pOf = (id, t) => theta(t) - phi(id, t);
  // the moving gait's duty is the one a halt or move off steps with (the stand's duty is not a stride's)
  const dutyStep = halt || moveOff ? () => R.duty : duty;

  // the duration: past the window to the next whole stride of the second gait (a halt: to the settle)
  let duration = Math.ceil(theta(t2) + 0.5) / fB;
  { let lo = t2, hi = t2 + 2 / fB; const target = Math.ceil(theta(t2) + 0.25); for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (theta(m) < target) lo = m; else hi = m; } duration = (lo + hi) / 2; }

  // FOOTFALLS from the warp: per limb, the stances (on, off) as its phase crosses n and n + duty, by bisection
  const cross = (g, a, b) => { let lo = a, hi = b; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (g(m) < 0) lo = m; else hi = m; } return (lo + hi) / 2; };
  const span0 = -1.5 / fA, span1 = t2 + 5 / fB, dt = 1 / 400;
  const stances = {};
  for (const id of IDS) {
    const list = [];
    const ons = [];
    for (let t = span0; t < span1; t += dt) {
      const p0 = pOf(id, t), p1 = pOf(id, t + dt);
      if (Math.floor(p1) > Math.floor(p0)) ons.push({ n: Math.floor(p1), on: cross((x) => pOf(id, x) - Math.floor(p1), t, t + dt) });
    }
    for (const { n, on } of ons) {
      let offT = null;
      if (kind === 'change') {
        // a change: the stance ends when the hoof has covered the stance length it landed for; the swings take up the
        // shifting footfalls (a leg changes its flight, not its reach)
        const goal = rootAt(on) + v(on) * duty(on) / f(on);
        offT = cross((x) => rootAt(x) - goal, on, on + 4 / Math.min(fA, fB));
      } else {
        let t = on;
        while (t < span1 + 1) { const tn = t + dt; if (pOf(id, tn) - dutyStep(tn) - n >= 0) { offT = cross((x) => pOf(id, x) - dutyStep(x) - n, t, tn); break; } t = tn; }
      }
      list.push({ n, on, off: offT ?? Infinity });
    }
    stances[id] = list;
  }
  // a halt: from the lock (the window's middle) each hoof's next landing is its last, on its standing spot; a move off:
  // each hoof stands on its spot until its first lift-off after the unlock
  const tLock = t1 + 0.45 * Tw, settle = 0.35;
  let tSettled = t2;
  if (halt) {
    for (const id of IDS) {
      const k = stances[id].findIndex((st) => st.on >= tLock);
      stances[id] = stances[id].slice(0, k + 1);
      stances[id][k] = { ...stances[id][k], off: Infinity, final: true };
      tSettled = Math.max(tSettled, stances[id][k].on + settle);
    }
  }
  if (moveOff) {
    for (const id of IDS) {
      const k = stances[id].findIndex((st) => st.off >= tUnlock);
      stances[id] = [{ n: -Infinity, on: -Infinity, off: stances[id][k].off, first: true }, ...stances[id].slice(k + 1)];
    }
  }
  if (halt) duration = tSettled + 0.3;
  else {
    // the clip ends on a whole stride of the second gait once no leg stands on, or swings from, a stance the window chose
    const thetaInv = (k) => { let lo = t2, hi = span1; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (theta(m) < k) lo = m; else hi = m; } return (lo + hi) / 2; };
    const clean = (t) => IDS.every((id) => { const list = stances[id]; const k = list.findIndex((st, i) => st.on <= t && (!list[i + 1] || list[i + 1].on > t)); return k >= 0 && list[k].on >= t2 && (k === 0 || list[k].on >= t2); });
    for (let k = Math.ceil(theta(t2) + 0.25); ; k++) { const te = thetaInv(k); if (clean(te) || te > span1 - 2 / fB) { duration = te; break; } }
  }
  // the body's blend: the window, or for a halt from the window's start to the settle
  const sBody = halt ? (t) => S5((t - t1) / (tSettled - t1)) : s;

  // the limbs at their blend: where they land, how wide, their share; the swing's lift and fold
  const limbAt = (id, t) => {
    const a = A.limbs.find((l) => l.id === id), b = Bc.limbs.find((l) => l.id === id), w = sBody(t);
    return { id, pair: a.pair, side: a.side, x: lerp(a.x, b.x, w), yc: lerp(a.yc, b.yc, w), share: lerp(a.share, b.share, w) };
  };
  for (const id of IDS) for (const st of stances[id]) {
    const mid = st.final || st.first ? null : (st.on + st.off) / 2;
    if (st.final) { st.y = rootAt(duration + 10) + B[id[1] === 'F' ? 'fore' : 'hind'].hoofY; st.x = limbAt(id, 1e9).x; }
    else if (st.first) { st.y = B[id[1] === 'F' ? 'fore' : 'hind'].hoofY; st.x = limbAt(id, -1e9).x; }
    // the landing is chosen at touchdown, from the gait then: centred on the stance it expects (its stance length then);
    // as the gait changes under it the stance runs off centre, as a horse's does
    else { const l = limbAt(id, st.on); st.y = rootAt(st.on) + v(st.on) * dutyStep(st.on) / f(st.on) / 2 + l.yc; st.x = l.x; void mid; }
  }

  const bo = MECHANICS.breakover, boPitch = MECHANICS.breakoverPitch * DEG;
  // the stance force's shape (the walk's double hump, the others' single) eased with the gaits
  const humpOf = (C) => GAITS[C.gait === 'stand' ? R.gait : C.gait].load ?? 0;
  // THE VAULT, for the strides between the two gaits: each girdle lowered by what its standing legs cannot comfortably
  // reach on this timeline (zero where the cycles already reach, so the seams stand), dilated and smoothed by a short
  // Gaussian; three passes, as the cycles do it
  const yFv = B.trunk.scapulaPivot[0], yHv = B.trunk.hip[0], dtV = 1 / 120;
  let dropF = null, dropH = null;
  const sample = (arr, t) => { const x = t / dtV, i = Math.max(0, Math.min(arr.length - 2, Math.floor(x))), u = Math.min(1, Math.max(0, x - i)); return arr[i] + (arr[i + 1] - arr[i]) * u; };
  const vaultAt = (t) => {
    if (!dropF) return { z: 0, pitch: 0 };
    // faded to nothing at the seams, so the clip still opens and closes on the cycles' own poses
    const m = S5(t / t1) * S5((duration - t) / Math.min(0.3, Math.max(1e-3, duration - t2)));
    const fr = m * sample(dropF, t), hh = m * sample(dropH, t);
    return { z: -(hh + (fr - hh) * (0 - yHv) / (yFv - yHv)), pitch: (hh - fr) / (yFv - yHv) };
  };
  const bodyAt = (t) => {
    const a = A.bodyFull(theta(t)), b = Bc.bodyFull(theta(t)), w = sBody(t), vt = vaultAt(t);
    const out = Object.fromEntries(BODY_KEYS.map((k) => [k, lerp(a[k] ?? 0, b[k] ?? 0, w)]));
    out.z += vt.z; out.pitch += vt.pitch;
    return out;
  };
  // a stance's load: the hump of the stride's force, held at the standing load once a final stance outlasts it
  const Is = (bb) => 2 / Math.PI + bb * 2 / (3 * Math.PI);
  const standLoad = (id) => B.share[id[1] === 'F' ? 'fore' : 'hind'] / 2;
  const loadOf = (id, st, t) => {
    const l = limbAt(id, t), bb = lerp(humpOf(A), humpOf(Bc), sBody(t)), d = dutyStep(t);
    if (st.first) { const w = clamp01((st.off - t) / (0.5 * d / f(t))); const u = 1 - w * 0.5; return lerp(hoofForce(u, l.share / (d * Is(bb)), bb), standLoad(id), w); }
    // the force's hump over the stance itself (a change ends it by the ground covered); a halt's last stance over the
    // stance it expected at touchdown
    const len = st.final ? dutyStep(st.on) / f(st.on) : st.off - st.on, u = (t - st.on) / len;
    const F = hoofForce(Math.min(u, 0.999999), l.share / (d * Is(bb)), bb);
    return st.final ? lerp(u < 0.5 ? F : Math.max(F, standLoad(id)), standLoad(id), sBody(t)) : F;
  };
  // breakover over the stance's last share; a first stance's over the same share of a nominal stance
  const etaOf = (id, st, t) => {
    const len = st.final || st.first ? Infinity : st.off - st.on, w = (t - st.on) / len;
    const boT = bo * dutyStep(t) / f(t);
    return st.first ? (t > st.off - boT ? -boPitch * ease((t - (st.off - boT)) / boT) : 0)
      : !st.final && w > 1 - bo ? -boPitch * ease((w - (1 - bo)) / bo) : 0;
  };
  // the stand's side of a blend steps as the moving gait does, shorter: a halt's last steps and a move off's first are
  // low and close (STAND_STEP of the gait's lift and fold)
  const STAND_STEP = 0.6;
  const foldOf = (C) => (C.gait === 'stand' ? { carpus: R.fold.carpus * STAND_STEP, fetlock: R.fold.fetlock * STAND_STEP, peak: R.fold.peak } : C.fold);
  const liftOf = (C, pair) => (C.gait === 'stand' ? R.lift[pair] * STAND_STEP : C.lift[pair]);
  const blendFold = (t) => { const fa = foldOf(A), fb = foldOf(Bc), w = sBody(t); return { carpus: lerp(fa.carpus, fb.carpus, w), fetlock: lerp(fa.fetlock, fb.fetlock, w), peak: lerp(fa.peak, fb.peak, w), k: B.motion.fold }; };
  const blendLift = (pair, t) => lerp(liftOf(A, pair), liftOf(Bc, pair), sBody(t));
  const swingParams = (id, a, b) => { const mid = (a.off + b.on) / 2; return { lift: blendLift(id[1] === 'F' ? 'fore' : 'hind', mid), fold: blendFold(mid) }; };
  const { rig, stanceState, poseAt } = schedulePoser(B, { stances, rootAt, bodyAt: (t) => bodyAt(t), limbAt, loadOf, etaOf, swingParams });

  {
    const NV = Math.ceil(duration / dtV) + 2, W = Math.round(0.025 / dtV), sig = 0.05 / dtV, R3 = Math.ceil(3 * sig);
    const kern = Array.from({ length: 2 * R3 + 1 }, (_, i) => Math.exp(-(((i - R3) / sig) ** 2) / 2)); const ks = kern.reduce((a, b) => a + b, 0);
    const accF = new Array(NV).fill(0), accH = new Array(NV).fill(0);
    const shortfall = (id, st, t) => {
      const bd = bodyAt(t), x = stanceState(id, st, t, bd), l = { ...limbAt(id, t), x: st.x };
      const from = l.pair === 'fore' ? x.solve.S : rig.girdle(l, bd, st.x);
      const vv = sub(x.distal.F, from), D = len(vv), over = D - (l.pair === 'fore' ? rig.reachF : rig.reachH);
      return over > 0 ? over * D / Math.max(0.3, -vv[1]) : 0;
    };
    for (let pass = 0; pass < 3; pass++) {
      const sF = new Array(NV).fill(0), sH = new Array(NV).fill(0);
      for (let i = 0; i < NV; i++) {
        const t = i * dtV;
        for (const id of IDS) {
          const st = stances[id].find((q) => t >= q.on - 1e-9 && t < q.off - 1e-9);
          if (!st) continue;
          const d = shortfall(id, st, t);
          if (id[1] === 'F') sF[i] = Math.max(sF[i], d); else sH[i] = Math.max(sH[i], d);
        }
      }
      for (const [sArr, acc] of [[sF, accF], [sH, accH]]) {
        const dil = sArr.map((_, i) => { let m = 0; for (let j = -W; j <= W; j++) m = Math.max(m, sArr[Math.min(NV - 1, Math.max(0, i + j))]); return m * 1.15; });
        for (let i = 0; i < NV; i++) { let a = 0; for (let j = -R3; j <= R3; j++) a += kern[j + R3] * dil[Math.min(NV - 1, Math.max(0, i + j))]; acc[i] += a / ks; }
      }
      // capped: a girdle sinks a hand's breadth at the most (lowering cannot buy every reach; it must not run away)
      const cap = 0.12 * B.scale;
      dropF = accF.map((x) => Math.min(x, cap)); dropH = accH.map((x) => Math.min(x, cap));
    }
  }

  const thEnd = theta(duration);
  return {
    kind, from, to, lead, duration, poseAt, rootAt, stances, A, B: Bc, speedAt: v,
    entry: { gait: from, phase: ((theta(0) % 1) + 1) % 1 },
    exit: { gait: to, phase: halt ? null : ((thEnd % 1) + 1) % 1 },
    window: [t1, t2],
  };
}
