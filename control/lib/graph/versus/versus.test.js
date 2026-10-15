import { describe, it, expect } from 'vitest';
import { compileFighter, compileNormal } from './versus-compile.js';
import { newVersus, stepVersus, versusHash } from './versus-core.js';
import { solveFighter, ARCHETYPES } from './versus-solver.js';
import { lawsFor } from './versus-laws.js';
import { runVersus } from './versus-match.js';
import { versusBody } from './versus-rig.js';
import { BTN, traced, recordInput, readCommand } from './versus-input.js';

const Z = { x: 0, y: 0, b: 0 };
const all = solveFighter({ id: 'kata', archetype: 'all-rounder' }).recipe;
const K = compileFighter(all);

/** Two fighters `d` apart, already fighting. */
function fight(d, { fighters = [K, K], schemes } = {}) {
  const ctx = { fighters };
  let s = newVersus(ctx, { rules: { intro: 1 }, schemes });
  s = stepVersus(s, [Z, Z], ctx);
  s.p[0].x = -Math.round(d / 2);
  s.p[1].x = Math.round(d / 2);
  return { ctx, s };
}

/** Step n frames with pads from fn(k, s); → { s, events: [[k, event]] }. */
function run(s, ctx, n, fn) {
  const events = [];
  for (let k = 0; k < n; k++) {
    s = stepVersus(s, fn(k, s), ctx);
    for (const e of s.events) events.push([k, e]);
  }
  return { s, events };
}

const tap = (k, at, b) => (k === at ? b : 0);
const actionable = (p) => p.st === 'stand' && !p.mv;

/** The frame advantage measured in the sim: frames the defender is held after the attacker is free. */
function measure(slot, block) {
  let { ctx, s } = fight(900);
  let free = [null, null];
  let hitAt = null;
  for (let k = 0; k < 80; k++) {
    const pad0 = { x: 0, y: 0, b: tap(k, 0, BTN[slot.split('.')[1]]) };
    const pad1 = block ? { x: 1, y: 0, b: 0 } : Z;
    s = stepVersus(s, [pad0, pad1], ctx);
    if (s.events.some((e) => e.t === 'hit' || e.t === 'block')) hitAt = k;
    if (hitAt !== null) {
      if (free[0] === null && actionable(s.p[0])) free[0] = k;
      if (free[1] === null && actionable(s.p[1])) free[1] = k;
    }
  }
  return free[1] - free[0];
}

describe('versus: the move record', () => {
  it('measures in the sim the advantage the record derives, on hit and on block', () => {
    const m = K.moves['stand.M'];
    expect(measure('stand.M', false)).toBe(m.adv.hit);
    expect(measure('stand.M', true)).toBe(m.adv.block);
    expect(m.adv).toEqual({ hit: 4, block: -1 });
  });

  it('solves boxes from the body: a longer arm reaches further with the same key, and pays for it in frames', () => {
    const long = compileNormal(versusBody('heroic', { arm: 1.3 }), 'stand.M', { family: 'straight' });
    const short = compileNormal(versusBody('heroic', { arm: 0.8 }), 'stand.M', { family: 'straight' });
    expect(long.reach).toBeGreaterThan(short.reach);
    expect(long.startup).toBeGreaterThanOrEqual(short.startup);
  });

  it('opens a limb hurtbox while a strike is out (a whiff can be punished)', () => {
    const m = K.moves['stand.H'];
    expect(m.frames[m.startup].hurt.length).toBe(4);
    expect(m.frames[m.total].hurt.length).toBe(3);
  });
});

describe('versus: the loop', () => {
  it('a throw beats a block, and a throw teches a throw', () => {
    let { ctx, s } = fight(500);
    // a crouching blocker (one walking back would walk out of reach)
    const held = run(s, ctx, 60, (k) => [{ x: 0, y: 0, b: tap(k, 0, BTN.T) }, { x: 1, y: -1, b: 0 }]);
    expect(held.events.some(([, e]) => e.t === 'throw')).toBe(true);
    expect(held.s.p[1].hp).toBe(K.hp - K.moves.throw.damage);

    ({ ctx, s } = fight(500));
    const teched = run(s, ctx, 60, (k) => [{ x: 0, y: 0, b: tap(k, 0, BTN.T) }, { x: 1, y: -1, b: tap(k, 8, BTN.T) }]);
    expect(teched.events.some(([, e]) => e.t === 'tech')).toBe(true);
    expect(teched.s.p[1].hp).toBe(K.hp);
  });

  it('the invincible reversal beats a strike on the same frame', () => {
    const { ctx, s } = fight(600);
    const { events } = run(s, ctx, 30, (k) => [{ x: 0, y: 0, b: tap(k, 0, BTN.L) }, { x: -1, y: 0, b: tap(k, 0, BTN.S) }]);
    const hits = events.filter(([, e]) => e.t === 'hit' || e.t === 'counter').map(([, e]) => e.p);
    expect(hits).toContain(1);
    expect(hits).not.toContain(0);
  });

  it('a fireball crosses the screen and hits; a jump timed over it is not hit', () => {
    let { ctx, s } = fight(2400);
    const stood = run(s, ctx, 90, (k) => [{ x: 0, y: 0, b: tap(k, 0, BTN.S) }, Z]);
    expect(stood.events.some(([, e]) => e.t === 'hit' && e.p === 0)).toBe(true);
    let cleared = false;
    for (let at = 0; at < 40 && !cleared; at += 2) {
      ({ ctx, s } = fight(2400));
      const r = run(s, ctx, 90, (k) => [{ x: 0, y: 0, b: tap(k, 0, BTN.S) }, { x: 0, y: k >= at && k < at + 2 ? 1 : 0, b: 0 }]);
      cleared = !r.events.some(([, e]) => e.t === 'hit');
    }
    expect(cleared).toBe(true);
  });

  it('a low must be blocked crouching, a jump-in standing', () => {
    let { ctx, s } = fight(900);
    const standing = run(s, ctx, 30, (k) => [{ x: 0, y: -1, b: tap(k, 0, BTN.M) }, { x: 1, y: 0, b: 0 }]);
    expect(standing.events.some(([, e]) => e.t === 'hit')).toBe(true);
    ({ ctx, s } = fight(900));
    const crouched = run(s, ctx, 30, (k) => [{ x: 0, y: -1, b: tap(k, 0, BTN.M) }, { x: 1, y: -1, b: 0 }]);
    expect(crouched.events.some(([, e]) => e.t === 'block')).toBe(true);

    const outcomes = new Set();
    for (let at = 14; at <= 40; at += 2) {
      ({ ctx, s } = fight(1500));
      const r = run(s, ctx, 70, (k) => [{ x: k < 2 ? 1 : 0, y: k < 2 ? 1 : 0, b: tap(k, at, BTN.M) }, { x: 1, y: -1, b: 0 }]);
      for (const [, e] of r.events) if (e.t === 'hit' || e.t === 'block') outcomes.add(e.t);
    }
    expect(outcomes.has('hit')).toBe(true);
    expect(outcomes.has('block')).toBe(false);
  });
});

describe('versus: schemes', () => {
  it('the same special comes out of modern (S) and classic (236 + a button)', () => {
    let { ctx, s } = fight(2400, { schemes: ['modern', 'modern'] });
    let r = run(s, ctx, 3, (k) => [{ x: 0, y: 0, b: tap(k, 0, BTN.S) }, Z]);
    expect(r.s.p[0].mv).toBe('special.neutral.M');
    ({ ctx, s } = fight(2400, { schemes: ['classic', 'modern'] }));
    const motion = [{ x: 0, y: -1, b: 0 }, { x: 1, y: -1, b: 0 }, { x: 1, y: 0, b: BTN.L }];
    r = run(s, ctx, 3, (k) => [motion[k], Z]);
    expect(r.s.p[0].mv).toBe('special.neutral.L');
  });

  it('the simple scheme runs the auto-combo off one button', () => {
    const { ctx, s } = fight(900, { schemes: ['simple', 'modern'] });
    const seen = [];
    run(s, ctx, 70, (k, st) => {
      if (st.p[0].mv && !seen.includes(st.p[0].mv)) seen.push(st.p[0].mv);
      return [{ x: 0, y: 0, b: k % 3 === 0 ? BTN.L : 0 }, Z];
    });
    expect(seen.slice(0, 3)).toEqual(['stand.M', 'stand.H', 'special.back.M']);
  });

  it('traces a motion only when its last direction is fresh', () => {
    let p = { hist: [], held: 0 };
    for (const [x, y] of [[0, -1], [1, -1], [1, 0]]) p = { ...p, ...recordInput(p, { x, y, b: 0 }, 1) };
    expect(traced(p.hist, '236')).toBe(true);
    for (let i = 0; i < 8; i++) p = { ...p, ...recordInput(p, Z, 1) };
    expect(traced(p.hist, '236')).toBe(false);
    expect(readCommand(p.hist, 'classic', K, { stance: 'stand', meter: 0 })).toBe(null);
  });
});

describe('versus: matches', () => {
  it('a match is a function of its pads: the same seed is the same fight, and its pad log replays it', () => {
    const a = runVersus({ fighters: [all, all], seed: 5, log: true });
    const b = runVersus({ fighters: [all, all], seed: 5 });
    expect(a.hash).toBe(b.hash);
    expect(a.state.phase).toBe('matchEnd');
    expect(Math.max(...a.wins)).toBe(2);
    const replay = runVersus({ fighters: [all, all], players: [{ pads: a.pads.map((f) => f[0]) }, { pads: a.pads.map((f) => f[1]) }] });
    expect(replay.hash).toBe(a.hash);
  });

  it('the state stays integers (a snapshot is a clone; rollback stays possible)', () => {
    const { state } = runVersus({ fighters: [all, all], seed: 2, maxFrames: 900 });
    for (const p of state.p) for (const k of ['x', 'y', 'vx', 'vy', 'hp', 'meter']) expect(Number.isInteger(p[k])).toBe(true);
    expect(versusHash(state)).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('versus: the solver and the laws', () => {
  it('fills every slot from intent, closes the loop, and writes down what each word did', () => {
    const { recipe, notes } = solveFighter({ id: 'g', archetype: 'grappler', signature: ['kicks'] });
    expect(recipe.normals['stand.H'].family).toBe('uppercut'); // no reversal: an anti-air normal
    expect(recipe.normals['stand.L'].family).toBe('knee');
    expect(notes.some((n) => n.startsWith('no reversal'))).toBe(true);
    expect(() => solveFighter({ archetype: 'tank' })).toThrow(/archetype/);
  });

  it('each archetype solves to a fighter whose laws hold', () => {
    for (const archetype of Object.keys(ARCHETYPES)) {
      const F = compileFighter(solveFighter({ id: archetype, archetype }).recipe);
      expect(lawsFor(F).filter((l) => !l.ok).map((l) => `${archetype}: ${l.id}`)).toEqual([]);
    }
  });
});
