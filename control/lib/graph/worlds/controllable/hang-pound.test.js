import { describe, expect, it } from 'vitest';
import { createWorld, stepWorld } from '@/lib/graph/worlds/controllable-world';
import { shippedRule } from '@/lib/graph/gameworld/feel/reach.js';
import { feelRule, lowerFeel, feelCard } from '@/lib/graph/gameworld/feel/lower.js';
import { POLE_IDS, poleCard } from '@/lib/graph/gameworld/feel/cards.js';

// THE HANG, THE LANDING'S LAG AND THE STOMP ATTACK (rules-platform.js, opt-in `hang`, `landLag`, `pound`, a feel's with
// its takes): the apex held while the jump is, a landing that lags by its fall, and the attack in the air turned
// downward (held, dropped straight, then a bounce or a lag with a pound's higher jump in it). One template a procedure,
// each chosen from the catalog; absent its takes, none is in the rule.

const DT = 1 / 60;
const find = (pred) => POLE_IDS.find((id) => pred(poleCard(id)));
const hangPole = find((C) => C.jump.hang > 0);
const heavyPole = find((C) => C.jump.heavy && !C.landing);
const byFallPole = find((C) => C.landing);
const poundPole = find((C) => C.pound?.kind === 'pound' && C.pound.jump > 1);
const plungePole = find((C) => C.pound?.kind === 'plunge' && C.pound.stick === 'back');
const bouncePole = find((C) => C.pound?.kind === 'bounce');

const FLOOR = { ground: () => 0 };
const mk = (rule, z = 0) => createWorld({ colliders: [], entities: [{ id: 'p', rule: { ...rule, eye: 0 }, transform: { pos: [0, 0, z], heading: 0 } }] });
const frame = (w) => { const e = w.byId.p; return { x: e.transform.pos[0], z: e.transform.pos[2], vz: e.vel[2], grounded: e.grounded, pound: !!e.pound, lag: (e.lagT || 0) + (e.poundLagT || 0) }; };
const run = (w, inputs, n) => Array.from({ length: n }, (_, f) => { stepWorld(w, inputs(f) ?? {}, DT, FLOOR); return frame(w); });
const settle = (w) => run(w, () => ({}), 20);
const without = (rule, k) => { const { [k]: _, ...rest } = rule; return rest; };
const airtime = (fr) => fr.filter((x) => !x.grounded).length;

describe('absent the takes', () => {
  it('the rule carries no hang, no landing lag and no stomp; the lowering says them lost', () => {
    for (const pole of [hangPole, heavyPole, byFallPole, poundPole, plungePole, bouncePole]) {
      const R = feelRule(pole);
      expect(R.hang).toBeUndefined();
      expect(R.landLag).toBeUndefined();
      expect(R.pound).toBeUndefined();
    }
    expect(lowerFeel(feelCard(poundPole)).lost.map((x) => x.field)).toContain('pound');
    expect(lowerFeel(feelCard(poundPole), { takes: true }).lost.map((x) => x.field)).not.toContain('pound');
  });
});

describe('the hang', () => {
  const R = shippedRule({ pole: hangPole, takes: true });
  const jump = (rule, held) => { const w = mk(rule); settle(w); return run(w, (f) => ({ jump: f === 0 ? 1 : 0, jumpHeld: held(f) ? 1 : 0 }), 180); };

  it('held through the apex, the body stays up for its hang', () => {
    expect(R.hang).toBeGreaterThan(0);
    const longer = airtime(jump(R, () => true)) - airtime(jump(without(R, 'hang'), () => true));
    expect(Math.abs(longer - R.hang / DT)).toBeLessThanOrEqual(1);
    // up there it does not move
    const fr = jump(R, () => true), still = fr.filter((x) => !x.grounded && x.vz === 0);
    expect(still.length).toBeGreaterThanOrEqual(Math.round(R.hang / DT) - 1);
    expect(new Set(still.map((x) => x.z)).size).toBe(1);
  });

  it('let go, there is no hang', () => {
    const tap = (rule) => airtime(jump(rule, (f) => f < 3));
    expect(tap(R)).toBe(tap(without(R, 'hang')));
  });
});

describe('the landing\'s lag', () => {
  // a drop from `z`, then the jump pressed every frame from the landing: the frames until it leaves the ground again
  const wait = (rule, z) => {
    const w = mk(rule, z); const fr = run(w, () => ({}), 120);
    expect(fr[fr.length - 1].grounded).toBe(true);
    const go = run(w, () => ({ jump: 1, jumpHeld: 1 }), 60);
    return go.findIndex((x) => !x.grounded);
  };
  const landedAt = (rule, z) => { const w = mk(rule, z); return run(w, () => ({}), 120).findIndex((x) => x.grounded); };

  it('a hard landing lags; a soft one does not; the jump pressed in it goes as it ends', () => {
    const R = shippedRule({ pole: heavyPole, takes: true });
    expect(R.landLag.heavy.lag).toBeGreaterThan(0);
    // pressed at the landing itself
    // (the frames from the press to the take-off, against the same rule without the lag: a gather counts in both)
    const hard = (rule, z) => { const w = mk(rule, z); run(w, () => ({}), landedAt(rule, z) + 1); return run(w, () => ({ jump: 1, jumpHeld: 1 }), 90).findIndex((x) => !x.grounded); };
    const bare = without(R, 'landLag');
    expect(hard(R, 0.3)).toBe(hard(bare, 0.3));
    expect(Math.abs(hard(R, 6) - hard(bare, 6) - R.landLag.heavy.lag / DT)).toBeLessThanOrEqual(2);
    expect(wait(R, 6)).toBe(wait(bare, 6));   // long after the landing, nothing is left of it
  });

  it('a heavy body lags by its fall, up to its most', () => {
    const R = shippedRule({ pole: byFallPole, takes: true });
    const lagAt = (z) => { const w = mk(R, z); let most = 0; run(w, () => ({}), 400).forEach((x) => { most = Math.max(most, x.lag); }); return most; };
    const low = lagAt(1), high = lagAt(4), huge = lagAt(40);
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(low);
    expect(huge).toBeCloseTo(R.landLag.by.max, 6);
  });
});

describe('the stomp attack', () => {
  // up to the apex, then the attack pressed (`stick`: the forward input with it)
  const up = (rule, stick = 0) => {
    const w = mk(rule); settle(w);
    const rise = run(w, (f) => ({ jump: f === 0 ? 1 : 0, jumpHeld: 1 }), 120);
    const apex = rise.findIndex((x, i) => i > 0 && !x.grounded && x.vz <= 0);
    const w2 = mk(rule); settle(w2); run(w2, (f) => ({ jump: f === 0 ? 1 : 0, jumpHeld: 1 }), apex);
    const fr = run(w2, (f) => ({ fire: f === 0 ? 1 : 0, forward: f === 0 ? stick : 0 }), 150);
    return { w: w2, fr };
  };

  it('a pound holds, drops straight, lags on the floor still, and its jump goes higher', () => {
    const R = shippedRule({ pole: poundPole, takes: true }), P = R.pound;
    const { w, fr } = up(R, 1);
    expect(fr[0].pound).toBe(true);
    const air = fr.slice(0, fr.findIndex((x) => x.grounded));
    // held where it was, then down at its speed, never sideways
    expect(new Set(air.slice(0, Math.floor(P.hang / DT)).map((x) => x.z)).size).toBe(1);
    expect(air.some((x) => x.vz === -P.speed)).toBe(true);
    expect(new Set(fr.map((x) => x.x)).size).toBe(1);
    // the floor: lagging, the stick moves nothing; a jump in the lag rises higher than the jump does
    const landed = fr.findIndex((x) => x.grounded);
    expect(fr[landed].lag).toBeGreaterThan(0);
    const x0 = fr[landed].x;
    const peak = (rule, world) => { let top = 0; run(world, (f) => ({ jump: f === 0 ? 1 : 0, jumpHeld: 1 }), 150).forEach((x) => { top = Math.max(top, x.z); }); return top; };
    const w3 = mk(R); settle(w3);
    const plain = peak(R, w3);
    const inLag = mk(R); settle(inLag); Object.assign(inLag.byId.p, { poundLagT: P.lag });
    expect(run(inLag, () => ({ forward: 1 }), 2).every((x) => x.x === 0)).toBe(true);
    Object.assign(inLag.byId.p, { poundLagT: P.lag });
    expect(peak(R, inLag) / plain).toBeCloseTo(P.jump, 1);
    expect(w.byId.p.transform.pos[0]).toBe(x0);
  });

  it('a plunge asks the stick held back; forward, the press is not a plunge', () => {
    const R = shippedRule({ pole: plungePole, takes: true });
    expect(R.pound.back).toBe(true);
    expect(up(R, 1).fr[0].pound).toBe(false);
    expect(up(R, -1).fr[0].pound).toBe(true);
  });

  it('a bounce attack springs back up off the floor', () => {
    const R = shippedRule({ pole: bouncePole, takes: true });
    const { fr } = up(R);
    const down = fr.findIndex((x) => x.vz < 0 && x.pound), back = fr.findIndex((x, i) => i > down && x.vz > 0);
    expect(down).toBeGreaterThanOrEqual(0);
    expect(back).toBeGreaterThan(down);
    expect(fr[back].pound).toBe(false);
  });

  it('too near the ground, the press is not a stomp', () => {
    const R = shippedRule({ pole: poundPole, takes: true });
    const w = mk(R); settle(w);
    const fr = run(w, (f) => ({ jump: f === 0 ? 1 : 0, jumpHeld: 1, fire: f === 1 ? 1 : 0 }), 3);
    expect(fr.some((x) => x.pound)).toBe(false);
  });
});
