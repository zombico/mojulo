/**
 * versus cpu — an opponent that plays the loop, in the modern scheme.
 *
 *   cpuPad(state, ctx, i, mem, level) → { pad, mem }
 *
 * Pure: its dice are a hash of (seed, frame, player), its memory (the plan it is holding, the buttons it held last
 * frame) is carried by the caller, so a CPU match is as replayable as a human one. It reads the fight the way the
 * loop says: block what is coming, jump a fireball, answer a jump with the reversal or the anti-air, throw a
 * blocker, poke at the edge of its reach, confirm a hit into a special, spend a full meter.
 *
 * level: { react (0..1, the chance a frame it sees the threat), guard (0..1, the chance it blocks right),
 *          aggression (0..1), seed }
 */

import { BTN } from './versus-input.js';

export const CPU_LEVELS = Object.freeze({
  novice: { react: 0.15, guard: 0.35, aggression: 0.35 },
  regular: { react: 0.35, guard: 0.6, aggression: 0.5 },
  veteran: { react: 0.55, guard: 0.8, aggression: 0.6 },
  ace: { react: 0.8, guard: 0.92, aggression: 0.7 },
});

/** A hash → 0..1, from integers. */
function cpuDice(seed, f, i, salt) {
  let h = (seed ^ Math.imul(f, 0x9e3779b1) ^ Math.imul(i + 1, 0x85ebca77) ^ Math.imul(salt + 7, 0xc2b2ae3d)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const newCpuMemory = () => ({ hold: 0, plan: null, lastB: 0 });

export function cpuPad(state, ctx, i, mem, level = CPU_LEVELS.regular) {
  const L = { ...CPU_LEVELS.regular, seed: 1, ...level };
  const m = { ...mem };
  const out = (x, y, b) => {
    const edge = b & ~m.lastB; // a button must be let go to press again
    m.lastB = edge ? b : 0;
    return { pad: { x, y, b: edge }, mem: m };
  };
  if (state.phase !== 'fight') return out(0, 0, 0);
  const p = state.p[i], o = state.p[1 - i];
  const F = ctx.fighters[i];
  const dice = (salt) => cpuDice(L.seed, state.f, i, salt);
  const fwd = Math.sign(o.x - p.x) || p.face;
  const dist = Math.abs(o.x - p.x);
  const reachM = F.moves['stand.M'].reach;
  const reachCM = F.moves['crouch.M'].reach;
  const has = (slot) => !!F.moves[slot];

  if (m.hold > 0 && m.plan) { m.hold--; return out(m.plan.x * fwd, m.plan.y, m.plan.b); }
  m.plan = null;

  // a hit is landing: confirm it into a special (or the super)
  if (p.mv && p.conn === 1 && p.st === 'move' && F.moves[p.mv].kind === 'normal' && dice(1) < L.react + 0.2) {
    if (p.meter >= 1000 && has('super') && !F.moves.super.throw) return out(0, 0, BTN.S | BTN.H);
    if (has('special.back.M') && !F.moves['special.back.M'].throw) return out(-fwd, 0, BTN.S);
    if (has('special.neutral.M') && !F.moves['special.neutral.M'].throw) return out(0, 0, BTN.S);
  }
  // a long combo on me: break it (system 'burst', once a round)
  if (p.burst === 0 && (p.st === 'hit' || p.st === 'fall') && p.combo >= 3 && dice(16) < L.react * 0.25) return out(0, 0, BTN.S | BTN.T);
  const busy = !(p.st === 'stand' || p.st === 'walkF' || p.st === 'walkB' || p.st === 'crouch' || p.st === 'block');
  // something is coming: block it (low if it is low)
  const oMove = o.mv ? ctx.fighters[1 - i].moves[o.mv] : null;
  const shotIn = state.shots.find((t) => t.o !== i && Math.sign(t.vx) === Math.sign(p.x - t.x) && Math.abs(t.x - p.x) < 1400);
  const threat = (oMove && o.mf <= oMove.startup + oMove.active && dist < (oMove.reach || 900) + 500) || shotIn;
  if (threat && (p.st === 'block' || !busy)) {
    if (shotIn && !p.mv && dist > 1700 && dice(2) < L.react * 0.6) return hold(m, out, 9, 0, 1, 0, fwd); // jump it
    if (dice(3) < L.guard) {
      const low = oMove && oMove.guard === 'low';
      const high = oMove && oMove.guard === 'overhead';
      return out(-fwd, low && !high ? -1 : (high ? 0 : (dice(4) < 0.5 ? -1 : 0)), 0);
    }
  }
  if (busy) return out(0, 0, 0);
  // a jump at me: the reversal, or the anti-air
  if ((o.st === 'air' || (o.y > 200 && !o.ko)) && dist < 1500 && Math.sign(o.vx) !== -Math.sign(o.x - p.x) && dice(5) < L.react) {
    if (has('special.forward.M') && F.moves['special.forward.M'].rps === 'reversal' && dist < 1100) return out(fwd, 0, BTN.S);
    if (dist < 1000) return out(0, 0, BTN.H);
  }
  // a waking body or a blocker up close: throw it, or the command throw
  if (dist < F.moves.throw.reach + 450 && (o.st === 'rise' || o.st === 'block' || o.st === 'stand' || o.st === 'crouch') && dice(6) < 0.08 + L.aggression * 0.1) {
    if (has('special.neutral.M') && F.moves['special.neutral.M'].throw && dice(7) < 0.6) return out(0, 0, BTN.S);
    return out(0, 0, BTN.T);
  }
  if (p.meter >= 1000 && has('super') && dist < 1400 && dice(8) < 0.02) return out(0, 0, BTN.S | BTN.H);
  // far: the fireball, or walk in, or jump in
  if (dist > reachM + 500) {
    const shotOut = state.shots.some((t) => t.o === i);
    if (has('special.neutral.M') && F.moves['special.neutral.M'].projectile && !shotOut && dice(9) < 0.05 + (1 - L.aggression) * 0.06) return out(0, 0, BTN.S);
    if (dist < 2400 && dist > 1500 && dice(10) < L.aggression * 0.02) return hold(m, out, 6, 1, 1, 0, fwd);
    if (dice(11) < 0.02) return hold(m, out, 12, 0, 0, 0, fwd);
    return out(fwd, 0, 0);
  }
  // the edge of reach: poke
  if (dist <= reachM + 60 && dist > reachM - 300 && dice(12) < 0.08 + L.aggression * 0.08) return out(0, 0, BTN.M);
  if (dist <= reachCM + 60 && dice(13) < 0.05 + L.aggression * 0.05) return out(0, -1, BTN.M);
  if (dist < reachM - 300) {
    const r = dice(14);
    if (r < 0.08 * L.aggression) return out(0, 0, BTN.L);
    if (r < 0.12 * L.aggression) return out(0, -1, BTN.L);
    if (r < 0.14) return hold(m, out, 10, -1, 0, 0, fwd);
    if (r < 0.2) return out(-fwd, -1, 0);
  }
  return out(dice(15) < 0.6 + L.aggression * 0.3 ? fwd : 0, 0, 0);
}

function hold(m, out, frames, x, y, b, fwd) {
  m.plan = { x, y, b };
  m.hold = frames;
  return out(x * fwd, y, b);
}
