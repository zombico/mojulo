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
 *   flow            a modular frame's tools working together: their hydraulic flow as a share of its pump's
 *   mass            the parts' mass against the class's (a share off)
 *   distal          the mass below the knee as a share of the leg's: a light lower leg swings easily
 *
 * Each law: { id, value, band, ok, says }. Read once a process per frame. Pure.
 */
import { G, apply, cross, dot, ramForce, sub } from './mecha-common.js';
import { isStrut } from '../construction-shelf/con-chain.js';
import { armGeometry, solveArm, solveLeg, legGeometry } from './mecha-ik.js';

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
    const v = r2(Math.max(P.stand.legs.r.knee, P.stand.legs.l.knee));
    law('knee', v, band.knee, within(v, band.knee), `it stands with its knees bent ${v}°`);
  }
  // ── stability on both feet ──
  const stab = (name) => {
    const p = P[name], M = massOf(p.joints, p.root), poly = hull(SIDES.flatMap((S) => solePoly(M.frames, S)));
    return { M, m: margin(poly, M.com), poly };
  };
  if (band.stability) for (const name of ['stand', 'board'].filter((n) => P[n])) {
    const { m } = stab(name), v = r3(m);
    law(`stability.${name}`, v, band.stability, within(v, band.stability), `${name}ing, its centre of mass is ${v} m inside its soles' polygon`);
  }
  // ── on one foot ──
  const stanceSide = (p) => (p.feet ? SIDES.find((S) => p.feet[S].lift < 1e-9 && p.feet[SIDES.find((x) => x !== S)].lift > 1e-9) : null);
  if (band.sway && P.lift) {
    const S = stanceSide(P.lift), M = massOf(P.lift.joints, P.lift.root), v = r3(margin(hull(solePoly(M.frames, S)), M.com));
    law('sway', v, band.sway, within(v, band.sway), `on its ${S === 'l' ? 'left' : 'right'} foot, its centre of mass is ${v} m inside the sole (the hips rolled ${r2(P.lift.joints[arch.legs[S].joints.roll])}°)`);
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
  if (P.lift) {
    const S = stanceSide(P.lift), M = massOf(P.lift.joints, P.lift.root);
    loads.push(...holding(P.lift, S, M.mass * G, [M.com[0], M.com[1], 0]).map((x) => ({ ...x, at: 'lift' })));
  }
  if (P.board) {
    const M = massOf(P.board.joints, P.board.root), xr = apply(M.frames[arch.legs.r.foot], ctx.hp(arch.legs.r.foot, 'sole')), xl = apply(M.frames[arch.legs.l.foot], ctx.hp(arch.legs.l.foot, 'sole'));
    const fr = (M.com[0] - xl[0]) / (xr[0] - xl[0]), W = M.mass * G;
    loads.push(...holding(P.board, 'r', W * fr, [xr[0], M.com[1], 0]).map((x) => ({ ...x, at: 'board' })));
    loads.push(...holding(P.board, 'l', W * (1 - fr), [xl[0], M.com[1], 0]).map((x) => ({ ...x, at: 'board' })));
  }
  /** Each arm joint's share of its actuator's rating holding still what hangs below it: the arm's own bodies and its
   *  half of a load in the claws (no ground under an arm). */
  const armHolding = (p, S, load) => {
    const M = massOf(p.joints, p.root, { load }), F = M.frames, out = [];
    for (const name of Object.values(arch.arms[S].joints)) {
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
  const carry = arch.arms && P.carry ? P.carry : null;
  // ── the arms: their reach, and the load they lift ──
  const armReach = { reach: 0, lift: 0 };
  if (arch.arms && (band.reach || band.lift)) {
    const Ga = armGeometry(arch, ctx, 'r'), Ja = arch.arms.r.joints, c = arch.arms.r.claw;
    const clawLen = -ctx.hp(arch.arms.r.wrist, 'claw')[2] - ctx.hp(c, 'tip')[2];
    const armFits = (W, claw) => { const a = solveArm(Ga, W, claw); return a.reach && Object.entries(a.values).every(([k, v]) => { const r = range(Ja[k]); return !r || (v >= r[0] - 1e-6 && v <= r[1] + 1e-6); }); };
    // (its claw's tip at its farthest ahead of the shoulder, level with it, its fingers ahead)
    // (scanned in from the arm's full length: a wrist too near the shoulder folds the elbow past its stop)
    let yMax = 0;
    for (let y = Ga.l1 + Ga.l2; y > 0.2; y -= 0.005) if (armFits([y, 0], 90)) { yMax = y; break; }
    armReach.reach = yMax + clawLen;
    if (band.reach) law('reach', r2(armReach.reach), band.reach, within(armReach.reach, band.reach), `its claws reach ${r2(armReach.reach)} m ahead of its shoulders, level with them`);
    // (what the tools hold as rated: the load is theirs to hold, and a breaker or an auger holds none)
    const holders = SIDES.filter((S) => (tool(S)?.holds ?? Infinity) > 0), held = holders.reduce((s, S) => s + (tool(S)?.holds ?? Infinity), 0);
    if (band.lift && carry && holders.length) {
      // (its rated load at the carry, as a lifting machine's is rated: the least of 75% of the load that tips it (its
      // centre of mass to its soles' edge), 87% of the load its arms' actuators hold (the hydraulic limit), and what its
      // tools hold as rated)
      const tips = (L) => { const M = massOf(carry.joints, carry.root, { load: L }); return margin(hull(SIDES.flatMap((S) => solePoly(M.frames, S))), M.com) > 0; };
      const holdsUp = (L) => SIDES.every((S) => armHolding(carry, S, L).every((x) => x.share <= 1));
      const Ltip = farthest(tips, 0, 5000), Lhyd = farthest(holdsUp, 0, 5000);
      const limits = [[Math.round(0.75 * Ltip), `75% of the ${Math.round(Ltip)} kg that tips it`], [Math.round(0.87 * Lhyd), `87% of the ${Math.round(Lhyd)} kg its arms' actuators hold`], [held, `its tools' rating (${holders.map((S) => `${tool(S)?.label ?? 'claw'} ${tool(S)?.holds ?? '∞'} kg`).join(', ')})`]];
      const [v, gives] = limits.reduce((a, b) => (b[0] < a[0] ? b : a));
      armReach.lift = v;
      law('lift', v, band.lift, within(v, band.lift), `it lifts ${v} kg at the carry in its ${holders.length === 2 ? 'two tools' : `${tool(holders[0])?.label ?? 'claw'}`} (${gives})`);
    }
  }
  // (the carry read at its stance's load, no more than it is rated to lift: a frame carries what it is rated for)
  const carried = carry ? Math.min(carry.load, armReach.lift) : 0;
  if (carry) for (const S of SIDES) loads.push(...armHolding(carry, S, carried).map((x) => ({ ...x, at: 'carry' })));
  // (the arms at the carry are rated by the lift law; this one holds the frame itself still)
  if (band.actuators && loads.some((x) => x.at !== 'carry')) {
    const worst = loads.filter((x) => x.at !== 'carry').reduce((w, x) => (x.share > w.share ? x : w));
    law('actuators', worst.share, band.actuators, within(worst.share, band.actuators), `its hardest-worked actuator is the ${worst.by === 'drive' ? `${worst.joint}'s drive` : worst.by} ${worst.at === 'lift' ? 'on one foot' : worst.at === 'carry' ? `carrying ${carried} kg` : 'in the crouch'}, at ${Math.round(worst.share * 100)}% of its rating${worst.way ? ` (${worst.way}ing ${worst.force} N on a ${worst.arm} m arm)` : ''}`);
  }
  // ── the ground ──
  const grossW = massOf(P.stand.joints, P.stand.root).mass * G;
  if (band.groundPressure) {
    const o = ctx.outline(arch.legs.r.foot), xs = o.map((p) => p[0]), ys = o.map((p) => p[1]);
    const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)), v = r2(grossW / area / 1000);
    law('groundPressure', v, band.groundPressure, within(v, band.groundPressure), `on one foot it bears ${v} kPa on its sole`);
  }
  // ── the step and the stride, by the legs' reach within their ranges ──
  const Gr = legGeometry(arch, ctx, 'r'), J = arch.legs.r.joints;
  const fits = (ankle, yaw = 0) => {
    const leg = solveLeg(Gr, ankle, yaw, arch.bend);
    if (!leg.reach) return false;
    return Object.entries(leg.values).every(([k, v]) => { const r = range(J[k]); return !r || (v >= r[0] - 1e-6 && v <= r[1] + 1e-6); });
  };
  const zs = P.stand.root.t[2], swayL = P.lift?.root.t ?? P.stand.root.t, foot = P.stand.feet.r;
  const stepAt = (h) => [foot.x - swayL[0], foot.y + 0.25 - swayL[1], h + Gr.hS - swayL[2]];
  const step = farthest((h) => fits(stepAt(h)), 0, 1.2), strideAt = (y) => [foot.x, y, Gr.hS - zs], stride = farthest((y) => fits(strideAt(y)), 0, 1.4);
  if (band.step) law('step', r2(step), band.step, within(step, band.step), `it sets a foot down flat ${r2(step)} m up, a pace ahead`);
  if (band.stride) law('stride', r2(stride), band.stride, within(stride, band.stride), `it sets a foot ${r2(stride)} m ahead, flat, standing`);
  // ── the tools' hydraulics: both arms' tools working at once, on the power pack's pump ──
  if (band.flow && arch.arms) {
    const supply = ctx.row(ctx.entry('pack').sku).dims.flow, draw = SIDES.reduce((s, S) => s + (tool(S)?.flow ?? 0), 0);
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
    const legBodies = arch.layout.filter((e) => e.side);
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
    const reachJoints = (ankle) => { const leg = solveLeg(Gr, ankle, 0, arch.bend); return { ...P.stand.joints, ...Object.fromEntries(Object.entries(leg.values).map(([k, v]) => [J[k], v])) }; };
    const samples = [...Object.entries(P).map(([k, p]) => [k, p.joints]), ['step', reachJoints(stepAt(step))], ['stride', reachJoints(strideAt(stride))]];
    let worst = { d: Infinity };
    for (const [k, j] of samples) { const c = at(j); if (c.d < worst.d) worst = { ...c, k }; }
    const v = r3(worst.d);
    law('clearance', v, band.clearance, within(v, band.clearance), v >= 0 ? `its legs keep ${v} m clear of the rider (nearest: its ${worst.who}, at its ${worst.k})` : `its ${worst.who} enters the rider's space by ${-v} m at its ${worst.k}`);
  }
  // ── the mass ──
  const M0 = massOf(P.stand.joints, P.stand.root, { rider: false });
  if (band.mass !== undefined && arch.mass) {
    const v = r3(M0.mass / arch.mass - 1);
    law('mass', Math.round(M0.mass), [Math.round(arch.mass * (1 - band.mass)), Math.round(arch.mass * (1 + band.mass))], Math.abs(v) <= band.mass, `its parts weigh ${Math.round(M0.mass)} kg against its class's ${arch.mass} kg`);
  }
  if (band.distal) {
    const legIds = new Set(arch.layout.filter((e) => e.side === 'r').map((e) => e.id)), below = under(arch.legs.r.joints.knee);
    const legMass = M0.parts.filter((q) => legIds.has(q.id)).reduce((s, q) => s + q.mass, 0);
    const lower = (q) => { const e = arch.layout.find((x) => x.id === q.id); return Boolean(e) && e.side === 'r' && (isStrut(e) ? e.ram.every((ref) => below.has(ref.split('.')[0])) : below.has(e.id)); };
    const distal = M0.parts.filter(lower).reduce((s, q) => s + q.mass, 0), v = r3(distal / legMass);
    law('distal', v, band.distal, within(v, band.distal), `${Math.round(v * 100)}% of a leg's mass is below its knee`);
  }
  const out = Object.freeze({ ok: laws.every((l) => l.ok), laws: Object.freeze(laws), loads: Object.freeze(loads), reach: Object.freeze({ step: r3(step), stride: r3(stride), ...(arch.arms ? { arms: r3(armReach.reach), lift: armReach.lift } : {}) }) });
  CACHE.set(key, out);
  return out;
}
