/**
 * mecha-laws — what a mecha frame is held to, MEASURED from what was built and how its chain moves, never stated: each
 * joint's range is its actuator's (a ram's stroke, a rotary drive's stops), each stance solved by its legs' inverse
 * kinematics (mecha-ik.js), each part's mass where it is posed.
 *
 *   arcs            each ram-driven joint's working arc (degrees): a ram too short or mounted wrong leaves a leg that
 *                   cannot fold or reach
 *   stances         every named stance stands as asked: each foot reached, each joint within its range (none clamped)
 *   knee            the standing knee's bend: never straight, so the leg is clear of its singularity and can take up a step
 *   stability       on both feet (stand, board), the centre of mass's margin inside the soles' support polygon (m)
 *   sway            on one foot (lift), the centre of mass's margin inside the stance sole once the pelvis has swayed over
 *                   it (a static step: the hip's roll must carry it there)
 *   actuators       each actuator's share of its rating holding the frame still: the whole gross weight on the stance leg
 *                   (lift), each leg its share in the crouch (board) (the arms at the carry are the lift law's); a ram's force from its moment arm at the pose against
 *                   its push (the bore) or its pull (the annulus) at the system pressure, a rotary drive's torque against
 *                   its rated torque
 *   groundPressure  the gross weight on one sole (kPa): soft ground holds it
 *   step            the highest a foot is set down flat a pace ahead (the pelvis at its standing height, swayed over the
 *                   other foot): a step, a kerb, a log (m)
 *   stride          the farthest a foot is set ahead, flat, the other where it stands (m)
 *   belly           standing, the lowest of the bodies the legs carry above the ground: what passes under it (m)
 *   tailTorque      a backpack's service tail: its hardest-worked drive's share of its rating holding the tail, and the
 *                   magazine in its grip, still at every service point
 *   recoil          a payload's sustained recoil at its muzzle's height, as a share of the frame's weight on its lever to
 *                   its soles' edge behind (it is not pushed over firing)
 *   backblast       a rocket's backblast, along its tubes' axis behind its breech, clear of the rider's space (m)
 *   fireClear       each payload's line of fire, at either end of its traverse, clear of the rider's space (m)
 *   rollContact     a frame on wheels collapsed onto them: its wheels' lowest points off the ground, the farthest (m)
 *   rollClearance   rolling, the lowest of what its wheels carry off the ground (m)
 *   rollStability   rolling, its centre of mass inside its wheels' contacts (m)
 *   rollActuators   rolling, its legs' hardest-worked ram's share of its rating, its wheels' loads on it
 *   seat            the saddle's or the seat's height standing; board, its height crouched to be boarded; stepIn, the boarding step's
 *   tipover         fallen on its side, it lands on its crash frame and its legs, never on the rider: the rider's space
 *                   inside the frame's outline seen from the front, at its sides (m)
 *   cab             a closed cab holds the operator's space inside its glass and under its roof, the nearest margin (m)
 *   clearance       the legs and their rams never enter the rider's space at any stance, nor at the step's or the
 *                   stride's reach (m, the nearest)
 *   reach           a frame with arms: its claws' tip at its farthest ahead of the shoulders, level with them (m)
 *   lift            its rated load at the carry stance, as a lifting machine's is rated (ISO 10567's shares): the least
 *                   of 75% of the load in its claws that tips it (its centre of mass to its soles' edge), 87% of the load
 *                   its arms' actuators hold, and what its tools hold as rated (kg; a frame whose tools hold nothing, a
 *                   breaker and an auger, is not read)
 *   packReach, packLift   a giant arm pack's arms, read as the frame's arms are, at its heave stance
 *   flow            a modular frame's tools working together (a giant arm pack's too): their flow as a share of its pump's
 *   mass            the parts' mass against the class's (a share off)
 *   distal          the mass below the knee as a share of the leg's: a light lower leg swings easily
 *   solarArea       a solar backpack's array: its panels' area spread (m²)
 *   droneGround     a frame carrying drones (mecha-drones.js): its drones' lowest point off the ground, docked at every
 *                   stance and launched at the stance that launches them (m)
 *   droneClear      the same drones clear of the frame's bodies (but the one each is docked on) and of each other, the
 *                   nearest (m, negative where they meet)
 *
 * Each law: { id, value, band, ok, says }. Read once a process per frame. Pure.
 */
import { G, apply, cross, dot, ramForce, sub } from './mecha-common.js';
import { isStrut } from '../construction-shelf/con-chain.js';
import { armGeometry, solveArm, solveLeg, legGeometry, legKeys } from './mecha-ik.js';
import { TAIL_POSES } from './mecha-backpacks.js';

const r2 = (n) => Math.round(n * 100) / 100;
const r3 = (n) => Math.round(n * 1000) / 1000;
const SIDES = ['r', 'l'];
const familyOf = (name) => name.replace(/[RL]$/, '');

/** The convex hull of points in the plane (x, y), anticlockwise. */
function hull(pts) {
  const p = pts.map((q) => [q[0], q[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && turn(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.slice().reverse()) { while (hi.length >= 2 && turn(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
/** Each support's share of a weight standing at `c` over supports at `pts` (x, y): its statics with three, the least-norm
 *  shares with more (as evenly as its balance allows), one alone all of it. */
function shares(pts, c) {
  if (pts.length === 1) return [1];
  const A = [pts.map(() => 1), pts.map((q) => q[0]), pts.map((q) => q[1])], b = [1, c[0], c[1]];
  const M = A.map((r) => A.map((q) => r.reduce((t, v, i) => t + v * q[i], 0)));
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(M), y = [0, 1, 2].map((k) => det(M.map((r, i) => r.map((v, j) => (j === k ? b[i] : v)))) / D);
  return pts.map((_, i) => y[0] * A[0][i] + y[1] * A[1][i] + y[2] * A[2][i]);
}
/** A point's margin inside an anticlockwise polygon: its distance to the nearest edge, negative outside. */
function margin(poly, q) {
  let m = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], ex = b[0] - a[0], ey = b[1] - a[1], L = Math.hypot(ex, ey);
    m = Math.min(m, (ex * (q[1] - a[1]) - ey * (q[0] - a[0])) / L);
  }
  return m;
}

const CACHE = new Map();
/**
 * kit: { ctx, posed(pose) (index.js posedFrame), massOf(joints, root), range(name), shape(sku, side, part), frames(joints,
 * root) (every body's frame in the machine's) }.
 */
export function mechaLaws(key, kit) {
  if (CACHE.has(key)) return CACHE.get(key);
  const { ctx, posed, massOf, range, shape, frames, tool = () => null } = kit, arch = ctx.arch, band = arch.laws, laws = [];
  const law = (id, value, b, ok, says) => laws.push({ id, value, band: b, ok, says });
  const within = (v, b) => v >= b[0] - 1e-9 && v <= b[1] + 1e-9;
  const solePoly = (F, S) => { const f = arch.legs[S].foot; return (ctx.outline(f) ?? []).map((p) => apply(F[f], p)); };
  // (its legs by their keys: a biped's r and l, a four-legged frame's own; the first the one its reach is read on)
  const LEGS = legKeys(arch), L0 = LEGS[0], biped = LEGS.length === 2;
  const soleAt = (F, S) => apply(F[arch.legs[S].foot], ctx.hp(arch.legs[S].foot, 'sole'));

  // ── the arcs ──
  if (band.arcs) {
    for (const [name, J] of Object.entries(arch.joints)) {
      if (!J.ram || !band.arcs[familyOf(name)]) continue;
      const r = range(name), b = band.arcs[familyOf(name)], v = r2(r[1] - r[0]);
      law(`arcs.${name}`, v, b, within(v, b), `its ${name} turns ${v}° on its ram (${r[0]}° to ${r[1]}°)`);
    }
  }
  // ── the stances ──
  const P = Object.fromEntries(Object.keys(arch.stances).map((k) => [k, posed(k)]));
  for (const [k, p] of Object.entries(P)) {
    const ok = p.reached && !p.clamped.length;
    law(`stances.${k}`, p.clamped.length, [0, 0], ok, ok ? `it holds its ${k} stance within every joint's range` : `its ${k} stance ${p.reached ? '' : 'is out of a leg\'s reach and '}clamps ${p.clamped.join(', ') || 'nothing'}`);
  }
  if (band.knee && P.stand) {
    const v = r2(Math.max(...LEGS.map((S) => P.stand.legs[S].knee)));
    law('knee', v, band.knee, within(v, band.knee), `it stands with its knees bent ${v}°`);
  }
  // ── stability on both feet ──
  // (what a stance stands on: its soles, or, collapsed onto its wheels, each wheel's lowest point)
  const wheelFeet = (Fw) => arch.wheels.map((w) => { const e = ctx.entry(w.id); return shape(e.sku, e.side).corners.map((c) => apply(Fw[w.id], c)).reduce((a, b) => (b[2] < a[2] ? b : a)); });
  const stab = (name) => {
    const p = P[name], M = massOf(p.joints, p.root), poly = hull(arch.stances[name]?.roll ? wheelFeet(M.frames).map((q) => [q[0], q[1]]) : LEGS.flatMap((S) => solePoly(M.frames, S)));
    return { M, m: margin(poly, M.com), poly };
  };
  if (band.stability) for (const name of ['stand', 'board'].filter((n) => P[n])) {
    const { m } = stab(name), v = r3(m);
    law(`stability.${name}`, v, band.stability, within(v, band.stability), `${name}ing, its centre of mass is ${v} m inside its soles' polygon`);
  }
  // ── on one foot ──
  const stanceSide = (p) => (p.feet ? SIDES.find((S) => p.feet[S].lift < 1e-9 && p.feet[SIDES.find((x) => x !== S)].lift > 1e-9) : null);
  // (a four-legged frame with a foot lifted: the feet it stands on)
  const grounded = (p) => (p.feet ? LEGS.filter((S) => p.feet[S].lift < 1e-9) : LEGS);
  if (band.sway && P.lift && biped) {
    const S = stanceSide(P.lift), M = massOf(P.lift.joints, P.lift.root), v = r3(margin(hull(solePoly(M.frames, S)), M.com));
    law('sway', v, band.sway, within(v, band.sway), `on its ${S === 'l' ? 'left' : 'right'} foot, its centre of mass is ${v} m inside the sole (the hips rolled ${r2(P.lift.joints[arch.legs[S].joints.roll])}°)`);
  } else if (band.sway && P.lift) {
    const on = grounded(P.lift), M = massOf(P.lift.joints, P.lift.root), v = r3(margin(hull(on.flatMap((S) => solePoly(M.frames, S))), M.com));
    law('sway', v, band.sway, within(v, band.sway), `on ${on.length} feet (its ${LEGS.filter((S) => !on.includes(S)).join(', ')} lifted), its centre of mass is ${v} m inside their soles' polygon`);
  }
  // ── the actuators holding it still ──
  const under = (name) => {
    const set = new Set();
    for (const e of arch.layout) {
      if (isStrut(e)) continue;
      for (let x = e; x; x = x.on ? arch.layout.find((y) => y.id === x.on.split('.')[0]) : null) if (x.joint === name) { set.add(e.id); break; }
    }
    return set;
  };
  const point = (F, ref) => { const i = ref.indexOf('.'); return apply(F[ref.slice(0, i)], ctx.hp(ref.slice(0, i), ref.slice(i + 1))); };
  /** Each joint of a leg's share of its actuator's rating, the leg carrying `W` newtons through the point `cop`. */
  const holding = (p, S, W, cop) => {
    const M = massOf(p.joints, p.root), F = M.frames, out = [];
    for (const name of Object.values(arch.legs[S].joints)) {
      const J = arch.joints[name], child = arch.layout.find((e) => e.joint === name), parent = child.on.split('.')[0];
      const pivot = F[child.id].t, axis = apply({ R: F[parent].R, t: [0, 0, 0] }, J.axis ?? (J.kind === 'slew' ? [0, 0, 1] : [1, 0, 0]));
      const below = under(name), Fg = [0, 0, W];
      let tau = dot(cross(sub(cop, pivot), Fg), axis);
      // (the weight of what hangs below the joint: its bodies, and a ram whose both pins are on them)
      const hangs = (q) => { const e = arch.layout.find((x) => x.id === q.id); return Boolean(e) && (isStrut(e) ? e.ram.every((ref) => below.has(ref.split('.')[0])) : below.has(e.id)); };
      for (const q of M.parts) if (hangs(q)) tau += dot(cross(sub(q.at, pivot), [0, 0, -q.mass * G]), axis);
      if (J.drive) {
        const T = ctx.row(ctx.entry(J.drive).sku).dims.torque;
        out.push({ joint: name, by: 'drive', torque: Math.round(Math.abs(tau)), share: r3(Math.abs(tau) / T) });
        continue;
      }
      const ram = ctx.entry(J.ram), [a, b] = ram.ram, onChild = below.has(b.split('.')[0]) ? b : a, other = onChild === b ? a : b;
      const B = point(F, onChild), A = point(F, other), u = sub(B, A), L = Math.hypot(...u), un = u.map((x) => x / L);
      const unit = dot(cross(sub(B, pivot), un), axis), force = -tau / unit, rate = ramForce(ctx.row(ram.sku).dims);
      out.push({ joint: name, by: ram.id, force: Math.round(force), way: force >= 0 ? 'push' : 'pull', arm: r3(Math.abs(unit)), share: r3(Math.abs(force) / (force >= 0 ? rate.push : rate.pull)) });
    }
    return out;
  };
  const loads = [];
  if (P.lift && biped) {
    const S = stanceSide(P.lift), M = massOf(P.lift.joints, P.lift.root);
    loads.push(...holding(P.lift, S, M.mass * G, [M.com[0], M.com[1], 0]).map((x) => ({ ...x, at: 'lift' })));
  } else if (P.lift) {
    // (on its other feet: each its share of the weight by the statics, at its sole)
    const on = grounded(P.lift), M = massOf(P.lift.joints, P.lift.root), at = on.map((S) => soleAt(M.frames, S)), w = shares(at, M.com);
    on.forEach((S, i) => loads.push(...holding(P.lift, S, M.mass * G * w[i], [at[i][0], at[i][1], 0]).map((x) => ({ ...x, at: 'lift' }))));
  }
  // (crouched on its feet: a frame boarded collapsed onto its wheels is read rolling, by rollActuators)
  if (P.board && !arch.stances.board?.roll && !biped) {
    const M = massOf(P.board.joints, P.board.root), at = LEGS.map((S) => soleAt(M.frames, S)), w = shares(at, M.com);
    LEGS.forEach((S, i) => loads.push(...holding(P.board, S, M.mass * G * w[i], [at[i][0], at[i][1], 0]).map((x) => ({ ...x, at: 'board' }))));
  } else if (P.board && !arch.stances.board?.roll) {
    const M = massOf(P.board.joints, P.board.root), xr = apply(M.frames[arch.legs.r.foot], ctx.hp(arch.legs.r.foot, 'sole')), xl = apply(M.frames[arch.legs.l.foot], ctx.hp(arch.legs.l.foot, 'sole'));
    const fr = (M.com[0] - xl[0]) / (xr[0] - xl[0]), W = M.mass * G;
    loads.push(...holding(P.board, 'r', W * fr, [xr[0], M.com[1], 0]).map((x) => ({ ...x, at: 'board' })));
    loads.push(...holding(P.board, 'l', W * (1 - fr), [xl[0], M.com[1], 0]).map((x) => ({ ...x, at: 'board' })));
  }
  /** Each arm joint's share of its actuator's rating holding still what hangs below it: the arm's own bodies and its
   *  share of a load in its tool (no ground under an arm); `set` the arms ('arms', or a giant arm pack's 'packArms'). */
  const armHolding = (p, S, load, set = 'arms') => {
    const M = massOf(p.joints, p.root, { load, loadOn: set }), F = M.frames, out = [];
    for (const name of Object.values(arch[set][S].joints)) {
      const J = arch.joints[name], child = arch.layout.find((e) => e.joint === name), parent = child.on.split('.')[0];
      const pivot = F[child.id].t, axis = apply({ R: F[parent].R, t: [0, 0, 0] }, J.axis ?? (J.kind === 'slew' ? [0, 0, 1] : [1, 0, 0]));
      const below = under(name);
      const hangs = (q) => q.id === `load.${S}` || (() => { const e = arch.layout.find((x) => x.id === q.id); return Boolean(e) && (isStrut(e) ? e.ram.every((ref) => below.has(ref.split('.')[0])) : below.has(e.id)); })();
      let tau = 0;
      for (const q of M.parts) if (hangs(q)) tau += dot(cross(sub(q.at, pivot), [0, 0, -q.mass * G]), axis);
      if (J.drive) {
        const T = ctx.row(ctx.entry(J.drive).sku).dims.torque;
        out.push({ joint: name, by: 'drive', torque: Math.round(Math.abs(tau)), share: r3(Math.abs(tau) / T) });
        continue;
      }
      const ram = ctx.entry(J.ram), [a, b] = ram.ram, onChild = below.has(b.split('.')[0]) ? b : a, other = onChild === b ? a : b;
      const B = point(F, onChild), A = point(F, other), u = sub(B, A), L = Math.hypot(...u), un = u.map((x) => x / L);
      const unit = dot(cross(sub(B, pivot), un), axis), force = -tau / unit, rate = ramForce(ctx.row(ram.sku).dims);
      out.push({ joint: name, by: ram.id, force: Math.round(force), way: force >= 0 ? 'push' : 'pull', arm: r3(Math.abs(unit)), share: r3(Math.abs(force) / (force >= 0 ? rate.push : rate.pull)) });
    }
    return out;
  };
  // (the farthest a test holds, from where it holds toward where it fails)
  const farthest = (f, lo, hi) => { if (!f(lo)) return lo; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (f(m)) lo = m; else hi = m; } return lo; };
  /**
   * An arm set's reach and its rated lift, read at its own stance (the frame's arms at the carry, a giant arm pack's at
   * the heave), its load on its own tools: ids { reach, lift }, `at` the loads' stance word, `what` the tools in prose.
   */
  const armSet = (set, stance, ids, at, what) => {
    const out = { reach: 0, lift: 0, carried: 0 };
    if (!arch[set] || !(band[ids.reach] || band[ids.lift])) return out;
    const Ga = armGeometry(arch, ctx, 'r', set), Ja = arch[set].r.joints, c = arch[set].r.claw;
    const clawLen = -ctx.hp(arch[set].r.wrist, 'claw')[2] - ctx.hp(c, 'tip')[2];
    const armFits = (W, claw) => { const a = solveArm(Ga, W, claw); return a.reach && Object.entries(a.values).every(([k, v]) => { const r = range(Ja[k]); return !r || (v >= r[0] - 1e-6 && v <= r[1] + 1e-6); }); };
    // (its tool's working point at its farthest ahead of the shoulder, level with it, pointing ahead; scanned in from the
    // arm's full length: a wrist too near the shoulder folds the elbow past its stop)
    let yMax = 0;
    for (let y = Ga.l1 + Ga.l2; y > 0.2; y -= 0.005) if (armFits([y, 0], 90)) { yMax = y; break; }
    out.reach = yMax + clawLen;
    if (band[ids.reach]) law(ids.reach, r2(out.reach), band[ids.reach], within(out.reach, band[ids.reach]), `its ${what} reach ${r2(out.reach)} m ahead of their shoulders, level with them`);
    // (what the tools hold as rated: the load is theirs to hold, and a breaker, an auger, a prop holds none)
    const holders = SIDES.filter((S) => (tool(S, set)?.holds ?? Infinity) > 0), held = holders.reduce((s, S) => s + (tool(S, set)?.holds ?? Infinity), 0);
    if (band[ids.lift] && stance && holders.length) {
      // (its rated load, as a lifting machine's is rated: the least of 75% of the load that tips it (its centre of mass
      // to its soles' edge), 87% of the load its arms' actuators hold (the hydraulic limit), and what its tools hold)
      const tips = (L) => { const M = massOf(stance.joints, stance.root, { load: L, loadOn: set }); return margin(hull(LEGS.flatMap((S) => solePoly(M.frames, S))), M.com) > 0; };
      const holdsUp = (L) => SIDES.every((S) => armHolding(stance, S, L, set).every((x) => x.share <= 1));
      const Ltip = farthest(tips, 0, 20000), Lhyd = farthest(holdsUp, 0, 20000);
      const limits = [[Math.round(0.75 * Ltip), `75% of the ${Math.round(Ltip)} kg that tips it`], [Math.round(0.87 * Lhyd), `87% of the ${Math.round(Lhyd)} kg its arms' actuators hold`], [held, `its tools' rating (${holders.map((S) => `${tool(S, set)?.label ?? 'claw'} ${tool(S, set)?.holds ?? '∞'} kg`).join(', ')})`]];
      const [v, gives] = limits.reduce((a, b) => (b[0] < a[0] ? b : a));
      out.lift = v;
      law(ids.lift, v, band[ids.lift], within(v, band[ids.lift]), `it lifts ${v} kg at the ${at} in its ${holders.length === 2 ? `${what}` : `${tool(holders[0], set)?.label ?? 'claw'}`} (${gives})`);
    }
    // (the stance read at its load, no more than it is rated to lift: a frame carries what it is rated for)
    out.carried = stance ? Math.min(stance.load, out.lift) : 0;
    if (stance) for (const S of SIDES) loads.push(...armHolding(stance, S, out.carried, set).map((x) => ({ ...x, at })));
    return out;
  };
  const carry = arch.arms && P.carry ? P.carry : null;
  const armReach = armSet('arms', carry, { reach: 'reach', lift: 'lift' }, 'carry', 'two tools');
  const packReach = armSet('packArms', P.heave ?? null, { reach: 'packReach', lift: 'packLift' }, 'heave', "giant arms' tools");
  const carried = armReach.carried;
  // (the arms at the carry are rated by the lift law; this one holds the frame itself still)
  if (band.actuators && loads.some((x) => x.at !== 'carry' && x.at !== 'heave')) {
    const worst = loads.filter((x) => x.at !== 'carry' && x.at !== 'heave').reduce((w, x) => (x.share > w.share ? x : w));
    law('actuators', worst.share, band.actuators, within(worst.share, band.actuators), `its hardest-worked actuator is the ${worst.by === 'drive' ? `${worst.joint}'s drive` : worst.by} ${worst.at === 'lift' ? (biped ? 'on one foot' : `on ${LEGS.length - 1} feet`) : worst.at === 'carry' ? `carrying ${carried} kg` : 'in the crouch'}, at ${Math.round(worst.share * 100)}% of its rating${worst.way ? ` (${worst.way}ing ${worst.force} N on a ${worst.arm} m arm)` : ''}`);
  }
  // ── the ground ──
  const grossW = massOf(P.stand.joints, P.stand.root).mass * G;
  if (band.groundPressure) {
    // (a biped on one foot bears its whole weight on that sole; a four-legged frame on all but one, shared)
    const o = ctx.outline(arch.legs[L0].foot), xs = o.map((p) => p[0]), ys = o.map((p) => p[1]);
    const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)), v = r2(grossW / (biped ? 1 : LEGS.length - 1) / area / 1000);
    law('groundPressure', v, band.groundPressure, within(v, band.groundPressure), biped ? `on one foot it bears ${v} kPa on its sole` : `on ${LEGS.length - 1} feet a sole bears ${v} kPa`);
  }
  // ── the step and the stride, by the legs' reach within their ranges ──
  const Gr = legGeometry(arch, ctx, L0), J = arch.legs[L0].joints;
  // (a leg mounted turned: its yaw drive's value from its mounting, in its drive's sense)
  const L0leg = arch.legs[L0], own = (k, v) => (k === 'yaw' && L0leg.yawSign ? (v - Gr.mount) * L0leg.yawSign : v);
  const fits = (ankle, yaw = Gr.mount) => {
    const leg = solveLeg(Gr, ankle, yaw, arch.bend);
    if (!leg.reach) return false;
    return Object.entries(leg.values).every(([k, v]) => { const r = range(J[k]), w = own(k, v); return !r || (w >= r[0] - 1e-6 && w <= r[1] + 1e-6); });
  };
  const zs = P.stand.root.t[2], swayL = P.lift?.root.t ?? P.stand.root.t, foot = P.stand.feet[L0];
  const stepAt = (h) => [foot.x - swayL[0], foot.y + 0.25 - swayL[1], h + Gr.hS - swayL[2]];
  const step = farthest((h) => fits(stepAt(h)), 0, 1.2), strideAt = (y) => [foot.x, foot.y + y, Gr.hS - zs], stride = farthest((y) => fits(strideAt(y)), 0, 1.4);
  if (band.step) law('step', r2(step), band.step, within(step, band.step), `it sets a foot down flat ${r2(step)} m up, a pace ahead`);
  if (band.stride) law('stride', r2(stride), band.stride, within(stride, band.stride), `it sets a foot ${r2(stride)} m ahead, flat, standing`);
  // ── the belly: standing, the lowest of what the legs carry (the pelvis, the rider's place, the cabin, the pack) above
  // the ground: the rocks and the ruts it walks over pass under it ──
  if (band.belly) {
    const F = frames(P.stand.joints, P.stand.root), carried = arch.layout.filter((e) => !e.ram && !e.side);
    let v = Infinity, low = null;
    for (const e of carried) for (const c of shape(e.sku, e.side).corners) { const z = apply(F[e.id], c)[2]; if (z < v) { v = z; low = e.id; } }
    v = r2(v);
    law('belly', v, band.belly, within(v, band.belly), `standing, its belly (its ${low}'s lowest) is ${v} m off the ground`);
  }
  // ── a backpack: its tail's drives holding it and a magazine at each service point; its payloads' recoil against the
  // frame's footing, their backblast and their line of fire clear of the rider ──
  const TAILS = arch.tails ? Object.entries(arch.tails) : arch.tail ? [[null, arch.tail]] : [];
  if (TAILS.length && band.tailTorque) {
    let v = 0, why = '';
    for (const [side, T] of TAILS) for (const [name, p] of Object.entries(P)) {
      const chainOf = { pitch: [T.seg1, T.seg2, T.head], elbow: [T.seg2, T.head], wrist: [T.head] };
      const st = arch.stances[name], pose = TAIL_POSES[st.tail ?? 'stow'], mine = pose?.carry && (side === null || pose.carry === side), carry = mine ? arch.payloads[pose.carry].magMass : 0;
      const F = frames(p.joints, p.root), grip = apply(F[T.head], ctx.hp(T.head, 'grip'));
      for (const [k, bodies] of Object.entries(chainOf)) {
        const J = arch.joints[T.joints[k]], B = bodies[0], pivot = F[B].t, axis = [F[B].R[0][0], F[B].R[1][0], F[B].R[2][0]];
        const torque = (m, c) => Math.abs(dot(cross(sub(c, pivot), [0, 0, -m * G]), axis));
        let tau = carry ? torque(carry, grip) : 0;
        for (const id of bodies) { const e = ctx.entry(id); tau += torque(ctx.row(e.sku).mass, apply(F[id], shape(e.sku, e.side).centroid)); }
        const share = tau / ctx.row(ctx.entry(J.drive).sku).dims.torque;
        if (share > v) { v = share; why = `its ${side ? `${side === 'r' ? 'right' : 'left'} ` : ''}tail's ${k} drive at its ${name}${carry ? `, a ${carry} kg magazine in its grip` : ''} (${Math.round(tau)} N·m)`; }
      }
    }
    v = r2(v);
    law('tailTorque', v, band.tailTorque, within(v, band.tailTorque), `its tail's hardest-worked drive is at ${Math.round(v * 100)}% of its rating: ${why}`);
  }
  if (arch.payloads && P.stand) {
    const F = frames(P.stand.joints, P.stand.root), root = P.stand.root.t;
    // (the rider's space where the frame stands, and how far a point is outside it)
    const boxes = (arch.envelope ?? []).map((E) => ({ x: E.x, y: E.y.map((y) => y + root[1]), z: E.z.map((z) => z + root[2]), cx: root[0] }));
    const clear = (q) => Math.min(...boxes.map((E) => Math.hypot(Math.max(0, Math.abs(q[0] - E.cx) - E.x), Math.max(0, E.y[0] - q[1], q[1] - E.y[1]), Math.max(0, E.z[0] - q[2], q[2] - E.z[1]))));
    const along = (a, u, L, n = 24) => Array.from({ length: n + 1 }, (_, i) => [a[0] + u[0] * L * i / n, a[1] + u[1] * L * i / n, a[2] + u[2] * L * i / n]);
    const fwd = (R) => [R[0][1], R[1][1], R[2][1]];
    if (band.recoil) {
      // (its sustained recoil pushing it back at the muzzle's height, against its weight's lever to its soles' edge behind;
      // braced to fire when it has a brace, else standing)
      const at = arch.fireStance && P[arch.fireStance] ? arch.fireStance : P.brace ? 'brace' : 'stand', Fb = frames(P[at].joints, P[at].root);
      // (on its soles, or on its wheels when it fires rolling: what it stands on behind its centre of mass)
      const onWheels = arch.wheels && P[at].stance === 'roll' || (arch.wheels && arch.stances[at]?.roll);
      const Mx = massOf(P[at].joints, P[at].root), support = onWheels
        ? arch.wheels.map((w) => { const e = ctx.entry(w.id); return shape(e.sku, e.side).corners.map((c) => apply(Fb[w.id], c)).reduce((a, b) => (b[2] < a[2] ? b : a)); })
        : hull(LEGS.flatMap((S) => solePoly(Mx.frames, S)));
      const M = Mx, poly = support, W = M.mass * G, back = M.com[1] - Math.min(...poly.map((q) => q[1]));
      let v = 0, why = '';
      for (const [S, card] of Object.entries(arch.payloads)) {
        if (!card.recoil) continue;
        const id = `weapon${S.toUpperCase()}`, h = apply(Fb[id], ctx.hp(id, 'muzzle'))[2], share = (card.recoil * h) / (W * back);
        if (share > v) { v = share; why = `its ${card.label}'s ${card.recoil} N at ${r2(h)} m`; }
      }
      v = r2(v);
      law('recoil', v, band.recoil, within(v, band.recoil), `firing ${onWheels ? 'collapsed on its wheels' : at === 'brace' ? 'braced' : 'standing'}, its recoil's lever is ${Math.round(v * 100)}% of its weight's to its heels (${why})`);
    }
    if (band.backblast) {
      let v = Infinity, why = '';
      for (const [S, card] of Object.entries(arch.payloads)) {
        if (!card.backblast) continue;
        const id = `weapon${S.toUpperCase()}`, u = fwd(F[id].R).map((x) => -x);
        for (const q of along(apply(F[id], ctx.hp(id, 'breech')), u, card.backblast)) { const c = clear(q); if (c < v) { v = c; why = `its ${card.label}'s`; } }
      }
      if (Number.isFinite(v)) { v = r2(v); law('backblast', v, band.backblast, within(v, band.backblast), `${why} backblast passes ${v} m clear of the rider`); }
    }
    if (band.fireClear) {
      // (each payload's line of fire at either end of its traverse, out to 4 m ahead of its muzzle)
      let v = Infinity, why = '';
      for (const [S, card] of Object.entries(arch.payloads)) {
        // (a payload that fires nothing has no line of fire: a sensor mast, a cargo carrier, a winch)
        if (card.fires === false) continue;
        const U = S.toUpperCase(), id = `weapon${U}`, J = `traverse${U}`;
        for (const t of range(J)) {
          const Fa = frames({ ...P.stand.joints, [J]: t }, P.stand.root);
          for (const q of along(apply(Fa[id], ctx.hp(id, 'muzzle')), fwd(Fa[id].R), 4)) { const c = clear(q); if (c < v) { v = c; why = `its ${card.label}'s at ${t}° of traverse`; } }
        }
      }
      if (Number.isFinite(v)) v = r2(v);
      if (Number.isFinite(v)) law('fireClear', v, band.fireClear, within(v, band.fireClear), `${why} line of fire passes ${v} m clear of the rider, the nearest`);
    }
  }
  // ── rolling: a frame on wheels collapsed onto them (its `roll` stance) ──
  if (arch.wheels && P.roll) {
    const p = P.roll, F = frames(p.joints, p.root), wheelIds = new Set(arch.wheels.map((w) => w.id));
    const cornersOf = (e) => shape(e.sku, e.side).corners.map((c) => apply(F[e.id], c));
    // (each wheel's lowest point: where it meets the ground)
    const contact = arch.wheels.map((w) => { const e = ctx.entry(w.id); return { ...w, at: cornersOf(e).reduce((a, b) => (b[2] < a[2] ? b : a)) }; });
    if (band.rollContact) {
      const v = r3(Math.max(...contact.map((c) => Math.abs(c.at[2]))));
      law('rollContact', v, band.rollContact, within(v, band.rollContact), `collapsed, its ${contact.length} wheels meet the ground within ${Math.round(v * 1000)} mm`);
    }
    if (band.rollClearance) {
      let v = Infinity, who = '';
      for (const e of arch.layout) { if (isStrut(e) || wheelIds.has(e.id)) continue; const z = Math.min(...cornersOf(e).map((c) => c[2])); if (z < v) { v = z; who = e.id; } }
      v = r3(v);
      law('rollClearance', v, band.rollClearance, within(v, band.rollClearance), `rolling, the lowest of what its wheels carry (its ${who}) is ${v} m off the ground`);
    }
    const M = massOf(p.joints, p.root), W = M.mass * G, poly = hull(contact.map((c) => [c.at[0], c.at[1]]));
    if (band.rollStability) {
      const v = r3(margin(poly, M.com));
      const ys = (axle) => contact.filter((c) => c.axle === axle).map((c) => c.at[1]), xs = contact.map((c) => c.at[0]);
      const base = r2(Math.abs(ys('front')[0] - ys('rear')[0])), track = r2(Math.max(...xs) - Math.min(...xs));
      law('rollStability', v, band.rollStability, within(v, band.rollStability), `on its wheels (a ${base} m wheelbase, a ${track} m track), its centre of mass is ${v} m inside them`);
    }
    if (band.rollActuators) {
      // (each wheel's share of the weight: its axle's by the centre of mass between the axles, its side's by it between
      // the sides; each leg's pitch, knee and ankle rams holding it there against its wheels' loads)
      const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
      const yR = avg(contact.filter((c) => c.axle === 'rear').map((c) => c.at[1])), yF = avg(contact.filter((c) => c.axle === 'front').map((c) => c.at[1]));
      const xr = avg(contact.filter((c) => c.side === 'r').map((c) => c.at[0])), xl = avg(contact.filter((c) => c.side === 'l').map((c) => c.at[0]));
      const fF = (M.com[1] - yR) / (yF - yR), fr = (M.com[0] - xl) / (xr - xl);
      const load = (c) => W * (c.axle === 'front' ? fF : 1 - fF) * (c.side === 'r' ? fr : 1 - fr);
      const lengthAt = (ram, joints) => { const Fj = frames(joints, p.root), [a, b] = ram.ram.map((ref) => point(Fj, ref)); return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); };
      let v = 0, why = '';
      for (const S of SIDES) {
        const L = arch.legs[S], mine = contact.filter((c) => c.side === S);
        for (const [k, body, carried] of [['pitch', L.pitch, mine], ['knee', L.knee, mine.filter((c) => c.axle === 'front')], ['anklePitch', L.ankle, mine.filter((c) => c.axle === 'front')]]) {
          const name = L.joints[k], J = arch.joints[name], ram = J?.ram ? ctx.entry(J.ram) : null;
          if (!ram) continue;
          const tau = Math.abs(carried.reduce((t, c) => t + (c.at[1] - F[body].t[1]) * load(c), 0));
          const arm = Math.abs(lengthAt(ram, { ...p.joints, [name]: p.joints[name] + 0.5 }) - lengthAt(ram, { ...p.joints, [name]: p.joints[name] - 0.5 })) / (Math.PI / 180);
          const rate = ramForce(ctx.row(ram.sku).dims), share = tau / arm / Math.min(rate.push, rate.pull);
          if (share > v) { v = share; why = `its ${J.ram} at ${Math.round(share * 100)}% (${Math.round(tau)} N·m on a ${r3(arm)} m arm)`; }
        }
      }
      v = r2(v);
      law('rollActuators', v, band.rollActuators, within(v, band.rollActuators), `rolling, its legs' hardest-worked ram is ${why}`);
    }
  }
  // ── the tools' hydraulics: both arms' tools working at once, on the power pack's pump ──
  if (band.flow && arch.arms) {
    const supply = ctx.row(ctx.entry('pack').sku).dims.flow, draw = ['arms', 'packArms'].filter((k) => arch[k]).reduce((t0, k) => t0 + SIDES.reduce((s, S) => s + (tool(S, k)?.flow ?? 0), 0), 0);
    if (supply) {
      const v = r2(draw / supply);
      law('flow', v, band.flow, within(v, band.flow), `its tools draw ${draw} l/min working together, ${Math.round(v * 100)}% of its pump's ${supply} l/min`);
    }
  }
  // ── the rider ──
  const sitOf = (p) => apply(frames(p.joints, p.root).seat, ctx.hp('seat', 'sit'));
  const station = `its ${arch.station ?? 'seat'}`;
  if (band.seat) { const v = r2(sitOf(P.stand)[2]); law('seat', v, band.seat, within(v, band.seat), `standing, ${station} is ${v} m up`); }
  if (band.board && P.board) { const v = r2(sitOf(P.board)[2]); law('board', v, band.board, within(v, band.board), `crouched to be boarded, ${station} is ${v} m up`); }
  if (band.stepIn && P.board) {
    const v = r2(apply(frames(P.board.joints, P.board.root).seat, ctx.hp('seat', 'step.r'))[2]);
    law('stepIn', v, band.stepIn, within(v, band.stepIn), `crouched, its boarding step is ${v} m up`);
  }
  if (band.tipover && arch.envelope) {
    // (on its side, the frame rests on its outermost points: the rider's space stays inside the hull of every part but
    // the rider, seen from the front, by this much at the sides; the hull's edges that face up or down are not where it
    // lands on its side)
    const F = frames(P.stand.joints, { R: P.stand.root.R, t: [0, 0, 0] }), pts = [];
    for (const e of arch.layout) {
      if (isStrut(e)) { for (const ref of e.ram) { const q = point(F, ref); pts.push([q[0], q[2]]); } continue; }
      for (const c of shape(e.sku, e.side).corners) { const q = apply(F[e.id], c); pts.push([q[0], q[2]]); }
    }
    const H = hull(pts), corners = arch.envelope.flatMap((E) => [-E.x, E.x].flatMap((x) => E.z.map((z) => [x, z])));
    let v = Infinity;
    for (let i = 0; i < H.length; i++) {
      const a = H[i], b = H[(i + 1) % H.length], ex = b[0] - a[0], ey = b[1] - a[1], L = Math.hypot(ex, ey);
      if (Math.abs(ey / L) < 0.5) continue;
      for (const q of corners) v = Math.min(v, (ex * (q[1] - a[1]) - ey * (q[0] - a[0])) / L);
    }
    v = r3(v);
    law('tipover', v, band.tipover, within(v, band.tipover), v >= 0 ? `on its side it lands on its frame, the rider ${v} m inside it` : `on its side the rider stands ${-v} m outside its frame`);
  }
  if (band.cab && arch.envelope) {
    // (a closed cab holds its operator's space inside its walls and under its roof, a margin all round: what its frame
    // protects in a rollover or under a falling load; its walls lean, so each is read at the height it is met)
    const D = ctx.row(ctx.entry('cage').sku).dims, o = ctx.hp('pelvis', 'cage'), t = D.post / 2;
    const wall = (z) => {
      const [a, b, f] = z >= D.belt.z ? [D.belt, D.roof, (z - D.belt.z) / (D.roof.z - D.belt.z)] : [{ ...D.base, z: D.z0 }, D.belt, (z - D.z0) / (D.belt.z - D.z0)];
      const L = (k) => a[k] + (b[k] - a[k]) * Math.max(0, Math.min(1, f));
      return { x: L('x') - t, y0: L('y0') + t, y1: L('y1') - t };
    };
    let v = Infinity, why = '';
    for (const E of arch.envelope) for (const x of [E.x]) for (const y of E.y) for (const z of E.z) {
      const q = [x, y - o[1], z - o[2]], W = wall(q[2]);
      for (const [m, w] of [[W.x - q[0], 'its sides'], [q[1] - W.y0, 'its back'], [W.y1 - q[1], 'its windshield'], [D.roof.z - q[2], 'its roof']]) if (m < v) { v = m; why = w; }
    }
    v = r3(v);
    law('cab', v, band.cab, within(v, band.cab), `its cab holds the operator's space ${v} m inside ${why}, the nearest`);
  }
  if (band.clearance && arch.envelope) {
    // (the legs, and a backpack's payloads and its tail: whatever moves near the rider)
    const legBodies = arch.layout.filter((e) => e.side || e.tail);
    // (how deep a point is in the rider's space: its depth in the box it is deepest in, negative outside every box)
    const inside = (q) => Math.max(...arch.envelope.map((E) => Math.min(E.x - Math.abs(q[0]), q[1] - E.y[0], E.y[1] - q[1], q[2] - E.z[0], E.z[1] - q[2])));
    // (the envelope in the pelvis's frame: each pose's leg points taken there)
    const at = (joints) => {
      const F = frames(joints, { R: P.stand.root.R, t: [0, 0, 0] });
      let best = Infinity, who = null;
      for (const e of legBodies) {
        if (isStrut(e)) {
          const [A, B] = e.ram.map((ref) => point(F, ref));
          for (let t = 0; t <= 1; t += 0.25) { const q = A.map((v, k) => v + (B[k] - v) * t), d = -inside(q); if (d < best) { best = d; who = e.id; } }
          continue;
        }
        for (const c of shape(e.sku, e.side).corners) { const d = -inside(apply(F[e.id], c)); if (d < best) { best = d; who = e.id; } }
      }
      return { d: best, who };
    };
    const reachJoints = (ankle) => { const leg = solveLeg(Gr, ankle, Gr.mount, arch.bend); return { ...P.stand.joints, ...Object.fromEntries(Object.entries(leg.values).map(([k, v]) => [J[k], own(k, v)])) }; };
    const samples = [...Object.entries(P).map(([k, p]) => [k, p.joints]), ['step', reachJoints(stepAt(step))], ['stride', reachJoints(strideAt(stride))]];
    let worst = { d: Infinity };
    for (const [k, j] of samples) { const c = at(j); if (c.d < worst.d) worst = { ...c, k }; }
    const v = r3(worst.d);
    law('clearance', v, band.clearance, within(v, band.clearance), v >= 0 ? `its legs keep ${v} m clear of the rider (nearest: its ${worst.who}, at its ${worst.k})` : `its ${worst.who} enters the rider's space by ${-v} m at its ${worst.k}`);
  }
  // ── its drones: docked in its legs' bays at every stance, launched at the stance that launches them; each clear of
  // the ground, of the frame's bodies (but the one it is docked on) and of the other drones ──
  if ((band.droneGround || band.droneClear) && arch.drones?.count && kit.drones) {
    let ground = Infinity, gWho = '', clear = Infinity, cWho = '';
    const cornersOf = (b) => [0, 1, 2, 3, 4, 5, 6, 7].map((m) => [m & 1 ? b.hi[0] : b.lo[0], m & 2 ? b.hi[1] : b.lo[1], m & 4 ? b.hi[2] : b.lo[2]]);
    const bodies = arch.layout.filter((e) => !isStrut(e));
    for (const [k, p] of Object.entries(P)) {
      if (arch.stances[k]?.roll && !band.droneClear) continue;
      const launch = !!arch.stances[k]?.launch, D = kit.drones(p.joints, p.root, launch), F = frames(p.joints, p.root);
      const boxes = D.map((d) => ({ ...d, pts: cornersOf(d).map((c) => apply(d.T, c)) }));
      const pts = bodies.map((e) => ({ id: e.id, pts: shape(e.sku, e.side).corners.map((c) => apply(F[e.id], c)) }));
      for (const b of boxes) {
        const z = Math.min(...b.pts.map((q) => q[2]));
        if (z < ground) { ground = z; gWho = `its ${b.dock} drone${launch ? ' launched' : ''} at its ${k}`; }
        // (how far a point stands outside the drone's box, along its axes: negative inside it)
        const R = b.T.R, out = (q) => { const d = [q[0] - b.T.t[0], q[1] - b.T.t[1], q[2] - b.T.t[2]]; let m = -Infinity; for (let a = 0; a < 3; a++) { const l = R[0][a] * d[0] + R[1][a] * d[1] + R[2][a] * d[2]; m = Math.max(m, b.lo[a] - l, l - b.hi[a]); } return m; };
        for (const body of pts) { if (body.id === b.body) continue; for (const q of body.pts) { const v = out(q); if (v < clear) { clear = v; cWho = `its ${b.dock} drone and its ${body.id}, at its ${k}`; } } }
        for (const o of boxes) if (o !== b) for (const q of o.pts) { const v = out(q); if (v < clear) { clear = v; cWho = `its ${b.dock} and ${o.dock} drones, at its ${k}`; } }
      }
    }
    if (band.droneGround) { const v = r3(ground); law('droneGround', v, band.droneGround, within(v, band.droneGround), `its drones keep ${v} m off the ground, the lowest ${gWho}`); }
    if (band.droneClear) { const v = r3(clear); law('droneClear', v, band.droneClear, within(v, band.droneClear), v >= 0 ? `its drones keep ${v} m clear of its frame and of each other (the nearest: ${cWho})` : `${cWho} meet, by ${-v} m`); }
  }
  // ── a solar array: its panels' area spread ──
  if (band.solarArea) {
    const panels = arch.layout.filter((e) => ctx.row(e.sku).kind === 'mecha-solar');
    const v = r2(panels.reduce((a, e) => { const d = ctx.row(e.sku).dims; return a + d.w * d.length; }, 0));
    law('solarArea', v, band.solarArea, within(v, band.solarArea), `spread, its array's ${panels.length} panels are ${v} m² of cells`);
  }
  // ── the mass ──
  const M0 = massOf(P.stand.joints, P.stand.root, { rider: false });
  if (band.mass !== undefined && arch.mass) {
    const v = r3(M0.mass / arch.mass - 1);
    law('mass', Math.round(M0.mass), [Math.round(arch.mass * (1 - band.mass)), Math.round(arch.mass * (1 + band.mass))], Math.abs(v) <= band.mass, `its parts weigh ${Math.round(M0.mass)} kg against its class's ${arch.mass} kg`);
  }
  if (band.distal) {
    const mine = (e) => (e.leg ?? e.side) === L0, legIds = new Set(arch.layout.filter(mine).map((e) => e.id)), below = under(arch.legs[L0].joints.knee);
    const legMass = M0.parts.filter((q) => legIds.has(q.id)).reduce((s, q) => s + q.mass, 0);
    const lower = (q) => { const e = arch.layout.find((x) => x.id === q.id); return Boolean(e) && mine(e) && (isStrut(e) ? e.ram.every((ref) => below.has(ref.split('.')[0])) : below.has(e.id)); };
    const distal = M0.parts.filter(lower).reduce((s, q) => s + q.mass, 0), v = r3(distal / legMass);
    law('distal', v, band.distal, within(v, band.distal), `${Math.round(v * 100)}% of a leg's mass is below its knee`);
  }
  const out = Object.freeze({ ok: laws.every((l) => l.ok), laws: Object.freeze(laws), loads: Object.freeze(loads), reach: Object.freeze({ step: r3(step), stride: r3(stride), ...(arch.arms ? { arms: r3(armReach.reach), lift: armReach.lift } : {}), ...(arch.packArms ? { packArms: r3(packReach.reach), packLift: packReach.lift } : {}) }) });
  CACHE.set(key, out);
  return out;
}
