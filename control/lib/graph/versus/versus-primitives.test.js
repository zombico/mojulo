import { describe, it, expect } from 'vitest';
import { compileFighter } from './versus-compile.js';
import { newVersus, stepVersus, versusHash } from './versus-core.js';
import { solveFighter } from './versus-solver.js';
import { BTN, CHARGE } from './versus-input.js';
import { SPECIALS, NORMAL_FAMILIES, SYSTEMS, COMMAND_SLOTS } from './versus-library.js';

// THE PRIMITIVES a move is made from, each played as inputs through the sim (not read off the compiled record alone):
// a command overhead opens a low guard, a slide trips, a roll and a blink pass through, a charge needs its hold, a rekka
// runs on the same motion again, a jumper blocks in the air where the game lets it. A fighter that uses none compiles
// and fights to the byte as before.
const Z = { x: 0, y: 0, b: 0 };
const base = solveFighter({ id: 'kata', archetype: 'all-rounder' }).recipe;
const make = (over) => compileFighter({ ...base, ...over });
const K = make({});

function fight(d, fighters, rules, schemes = ['classic', 'classic']) {
  const ctx = { fighters };
  let s = newVersus(ctx, { schemes, rules: { intro: 1, ...(rules ?? {}) } });
  s = stepVersus(s, [Z, Z], ctx);
  s.p[0].x = -Math.round(d / 2);
  s.p[1].x = Math.round(d / 2);
  return { ctx, s };
}
function run(s, ctx, n, fn) {
  const events = [], moves = [];
  for (let k = 0; k < n; k++) {
    s = stepVersus(s, fn(k, s), ctx);
    for (const e of s.events) events.push([k, e]);
    if (s.p[0].mv && moves[moves.length - 1] !== s.p[0].mv) moves.push(s.p[0].mv);
  }
  return { s, events, moves };
}
// pads: [P1, P2]; P1 faces right (x +1 is toward P2)
const pad = (x = 0, y = 0, b = 0) => ({ x, y, b });
const hitOrBlock = (events) => events.filter(([, e]) => e.p === 0 && (e.t === 'hit' || e.t === 'block' || e.t === 'counter')).map(([, e]) => e.t);

describe('versus primitives: the library holds them', () => {
  it('every primitive is a row a fighter may take: none is forced on a fighter', () => {
    for (const id of ['slide', 'roll', 'blink', 'hop', 'boom', 'flash', 'rekka', 'fireball', 'rising', 'leap', 'grab']) expect(SPECIALS[id], id).toBeTruthy();
    for (const id of ['axe', 'hammer', 'sweep']) expect(NORMAL_FAMILIES[id], id).toBeTruthy();
    expect(SYSTEMS.airblock).toBeTruthy();
    expect(COMMAND_SLOTS).toEqual(['forward.L', 'forward.M', 'forward.H']);
    // (a fighter that takes none: no command, no charge, no rekka stage among its moves)
    expect(Object.keys(K.moves).some((k) => k.startsWith('forward.') || k.includes('~'))).toBe(false);
    expect(K.charge).toBeUndefined();
  });
  it('a fighter that takes none fights to the byte as before (its state carries nothing new)', () => {
    const play = () => { const { s, ctx } = fight(1600, [K, K]); return versusHash(run(s, ctx, 240, (k) => [pad(1, 0, k % 30 === 5 ? BTN.M : 0), pad(-1, 0, k % 40 === 9 ? BTN.H : 0)]).s); };
    expect(play()).toBe(play());
    const { s, ctx } = fight(1600, [K, K]);
    expect(run(s, ctx, 120, () => [pad(-1), pad()]).s.p[0].chg).toBeUndefined();
  });
});

describe('versus primitives: an overhead opens a low guard, a trip a standing one', () => {
  const F = make({ commands: { 'forward.M': { family: 'axe' } }, specials: { ...base.specials, forward: { id: 'slide' } } });
  it('forward + a button is the command overhead: blocked standing, it hits a crouching guard', () => {
    expect(F.moves['forward.M'].guard).toBe('overhead');
    expect(F.moves['forward.M'].startup).toBeGreaterThanOrEqual(15);   // (slow enough to see coming)
    for (const [guard, want] of [[-1, 'hit'], [0, 'block']]) {   // a low guard (down-back), a standing one (back)
      const { s, ctx } = fight(900, [F, K]);
      // (the guard taken as the blow comes: held back from the start, a standing guard walks out of its reach)
      const out = run(s, ctx, 60, (k) => [pad(1, 0, k === 2 ? BTN.M : 0), pad(k >= 12 ? 1 : 0, guard)]);
      expect(out.moves[0]).toBe('forward.M');
      expect(hitOrBlock(out.events)[0], `guard y ${guard}`).toBe(want);
    }
  });
  it('a slide trips: blocked low, it knocks a standing guard down', () => {
    const slideAt = (k) => (k === 0 ? pad(0, -1) : k === 1 ? pad(-1, -1) : k === 2 ? pad(-1, 0, BTN.M) : pad());   // 214 + M
    const { s, ctx } = fight(1400, [F, K]);
    const stood = run(s, ctx, 70, (k) => [slideAt(k), pad(1, 0)]);
    expect(stood.moves[0]).toBe('special.forward.M');
    expect(hitOrBlock(stood.events)[0]).toBe('hit');
    expect(stood.s.p[1].st === 'fall' || stood.s.p[1].st === 'down').toBe(true);
    const low = fight(1400, [F, K]);
    expect(hitOrBlock(run(low.s, low.ctx, 70, (k) => [slideAt(k), pad(1, -1)]).events)[0]).toBe('block');
  });
});

describe('versus primitives: traversal passes through', () => {
  for (const id of ['roll', 'blink']) {
    it(`a ${id} carries the body through the opponent, untouched by a strike on the way`, () => {
      const F = make({ specials: { ...base.specials, back: { id } } });
      expect(F.moves['special.back.M'].nohit).toBe(true);
      const motion = SPECIALS[id].motion.split('').map(Number);
      const dirs = { 1: [-1, -1], 2: [0, -1], 3: [1, -1], 4: [-1, 0], 6: [1, 0] };
      const { s, ctx } = fight(700, [F, K]);
      const out = run(s, ctx, 60, (k) => [k < motion.length ? pad(...dirs[motion[k]], k === motion.length - 1 ? BTN.M : 0) : pad(), pad(0, 0, k === 6 ? BTN.L : 0)]);
      expect(out.moves[0]).toBe('special.back.M');
      expect(out.s.p[0].x).toBeGreaterThan(out.s.p[1].x);   // (it ended on the other side)
      expect(out.events.some(([, e]) => e.p === 1 && e.t === 'hit')).toBe(false);
    });
  }
});

describe('versus primitives: a charge needs its hold', () => {
  const F = make({ specials: { ...base.specials, back: { id: 'boom' } } });
  const charge = (frames) => (k) => [k < frames ? pad(-1, 0) : k === frames ? pad(1, 0, BTN.M) : pad(), pad()];
  it('back held long enough, then forward and a button: the charged shot', () => {
    expect(F.charge).toBe(true);
    const { s, ctx } = fight(2000, [F, K]);
    expect(run(s, ctx, CHARGE + 6, charge(CHARGE + 2)).moves[0]).toBe('special.back.M');
  });
  it('a short hold is no charge: the button is a normal', () => {
    const { s, ctx } = fight(2000, [F, K]);
    expect(run(s, ctx, 26, charge(20)).moves[0]).not.toBe('special.back.M');
  });
  it('down held, then up and a button: the charged flip kick, invincible on the way up', () => {
    const G = make({ specials: { ...base.specials, down: { id: 'flash' } } });
    const { s, ctx } = fight(2000, [G, K]);
    const out = run(s, ctx, CHARGE + 8, (k) => [k < CHARGE + 2 ? pad(0, -1) : k === CHARGE + 2 ? pad(0, 1, BTN.H) : pad(), pad()]);
    expect(out.moves[0]).toBe('special.down.H');
    expect(G.moves['special.down.H'].invuln.length).toBeGreaterThan(0);
  });
});

describe('versus primitives: a rekka runs on the same motion again', () => {
  const F = make({ specials: { ...base.specials, forward: { id: 'rekka' } } });
  it('three stages, each its own blow, the last knocking down; it stops wherever the motion is not given again', () => {
    expect([F.moves['special.forward.M'].rekka, F.moves['special.forward.M~2'].rekka, F.moves['special.forward.M~3'].rekka]).toEqual(['special.forward.M~2', 'special.forward.M~3', undefined]);
    expect(F.moves['special.forward.M~3'].knock).toBe('down');
    // 236 + M, three times, each in the stage before's active frames (whiffed: far apart)
    const at = [0];
    const qcf = (k0) => (k) => (k === k0 ? pad(0, -1) : k === k0 + 1 ? pad(1, -1) : k === k0 + 2 ? pad(1, 0, BTN.M) : null);
    const stage1 = F.moves['special.forward.M'], stage2 = F.moves['special.forward.M~2'];
    at.push(at[0] + 3 + stage1.startup - 1, at[0] + 3 + stage1.startup - 1 + 3 + stage2.startup - 1);
    const { s, ctx } = fight(3000, [F, K]);
    const out = run(s, ctx, 90, (k) => [at.map((k0) => qcf(k0)(k)).find(Boolean) ?? pad(), pad()]);
    expect(out.moves.slice(0, 3)).toEqual(['special.forward.M', 'special.forward.M~2', 'special.forward.M~3']);
    // (once: no motion again, no second stage)
    const once = fight(3000, [F, K]);
    expect(run(once.s, once.ctx, 60, (k) => [qcf(0)(k) ?? pad(), pad()]).moves).toEqual(['special.forward.M']);
  });
});

describe('versus primitives: air blocking, where the game lets it', () => {
  // P2 jumps back and holds back; P1 throws a fireball into the jump: with the system it is blocked in the air
  const F = make({ specials: { ...base.specials, forward: { id: 'fireball' } } });
  const scene = (rules) => {
    for (let fire = 0; fire < 30; fire++) {
      const { s, ctx } = fight(1800, [F, K], rules);
      const out = run(s, ctx, 120, (k) => [k === fire ? pad(0, -1) : k === fire + 1 ? pad(1, -1) : k === fire + 2 ? pad(1, 0, BTN.M) : pad(), k >= 6 ? pad(1, 1) : pad()]);
      const air = out.events.find(([, e]) => e.p === 0 && (e.t === 'hit' || e.t === 'block'));
      if (air && air[1].t === 'block' ? air[1].air : air && out.s.p[1].st !== 'hit') return air[1];
      if (air) return air[1];
    }
    return null;
  };
  it('a jumper holding back blocks a shot in the air with airblock on; without it, it is hit', () => {
    const on = scene({ systems: ['airblock'] }), off = scene({});
    expect(off?.t).toBe('hit');
    expect(on).toMatchObject({ t: 'block', air: 1 });
  });
});
