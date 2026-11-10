import { describe, it, expect } from 'vitest';
import { newBrawl, stepBrawl, brawlHash, BRAWL_RULES } from './brawl-core.js';
import { readBelt, viewHalf, heldAt } from './brawl-belt.js';
import { compileFighter } from '../versus/versus-compile.js';
import { newVersus, stepVersus } from '../versus/versus-core.js';
import { solveFighter } from '../versus/versus-solver.js';
import { BTN } from '../versus/versus-input.js';

// THE BRAWL CORE: the fight's frame data on many bodies down a belt. A blow is the fight's (its timing, its damage, its
// knockdown), it lands only lined up across the belt, on the other side's bodies, on as many as it meets; no block; a
// flung body knocks down its own side; a risen body is untouchable a while; the camera goes on with the players.
const K = compileFighter(solveFighter({ id: 'kata', archetype: 'all-rounder' }).recipe);
const ctx = { fighters: [K] };
const P = (x, z = 0) => ({ fighter: 0, side: 'player', x, z });
const C = (x, z = 0) => ({ fighter: 0, side: 'crowd', x, z, face: -1 });
function run(s, n, fn, c = ctx) {
  const events = [];
  for (let k = 0; k < n; k++) { s = stepBrawl(s, fn(k, s), c); for (const e of s.events) events.push([k, e]); }
  return { s, events };
}
const hits = (events, t = 'hit') => events.filter(([, e]) => e.t === t);
// (the moves picked from the record, not by name: a ground strike that knocks down, and the plain light normal)
const DOWN = Object.keys(K.moves).find((k) => K.moves[k].knock === 'down' && K.moves[k].kind === 'normal' && K.moves[k].stance !== 'air');
const JAB = 'stand.L';

describe('brawl core: a blow is the fight\'s', () => {
  // the same blow thrown on the same frame at the same distance, in the fight and in the brawl: it lands on the same
  // frame for the same damage, and its body stands again (or lands, rises and stands) on the same frames
  for (const slot of [JAB, DOWN]) {
    it(`${slot}: the same frame, the same damage, the same recovery`, () => {
      const d = 700, press = 2;
      let v = newVersus({ fighters: [K, K] }, { rules: { intro: 1 } });
      v = stepVersus(v, [{ x: 0, y: 0, b: 0 }, { x: 0, y: 0, b: 0 }], { fighters: [K, K] });
      v.p[0].x = -d / 2; v.p[1].x = d / 2;
      const btn = { L: BTN.L, M: BTN.M, H: BTN.H }[slot.split('.')[1]], down = slot.startsWith('crouch');
      const fight = [], brawl = [];
      for (let k = 0; k < 120; k++) {
        v = stepVersus(v, [{ x: 0, y: down && k <= press ? -1 : 0, b: k === press ? btn : 0 }, { x: 0, y: 0, b: 0 }], { fighters: [K, K] });
        fight.push([v.p[1].st, v.p[1].hp, ...v.events.filter((e) => e.t === 'hit').map((e) => e.dmg)].join(':'));
      }
      let b = newBrawl(ctx, { bodies: [P(-d / 2), C(d / 2)] });
      for (let k = 0; k < 120; k++) {
        b = stepBrawl(b, [{ x: 0, z: 0, mv: k === press ? slot : undefined }, {}], ctx);
        brawl.push([b.bodies[1].st, b.bodies[1].hp, ...b.events.filter((e) => e.t === 'hit').map((e) => e.dmg)].join(':'));
      }
      // (the fight's walkF/walkB are the brawl's walk; nothing walks here)
      expect(brawl).toEqual(fight);
    });
  }
});

describe('brawl core: the line', () => {
  it('a blow lands only on a body lined up across the belt', () => {
    for (const [z, want] of [[0, 1], [BRAWL_RULES.line - 20, 1], [BRAWL_RULES.line + 80, 0]]) {
      const s = newBrawl(ctx, { bodies: [P(0), C(700, z)] });
      expect(hits(run(s, 30, (k) => [{ mv: k === 1 ? JAB : undefined }]).events).length, `across ${z}`).toBe(want);
    }
  });
});

describe('brawl core: many bodies', () => {
  it('a blow strikes every body of the other side its box meets, each once; never its own side', () => {
    // (two thugs side by side across the belt, both lined up with the striker; a partner in front of it as well)
    const s = newBrawl(ctx, { bodies: [P(0), C(720, -150), C(720, 150), P(650, 0)], rules: { body: 50 } });
    const out = run(s, 30, (k) => [{ mv: k === 1 ? JAB : undefined }]);
    const struck = hits(out.events).map(([, e]) => e.d).sort();
    expect(struck).toEqual([1, 2]);
    expect(out.s.bodies[3].hp).toBe(K.hp);
  });
  it('bodies lined up push each other along the belt; off the line they pass', () => {
    const on = newBrawl(ctx, { bodies: [C(0, 0), C(100, 0)] });
    const s1 = stepBrawl(on, [], ctx);
    expect(s1.bodies[1].x - s1.bodies[0].x).toBeGreaterThan(300);
    const off = newBrawl(ctx, { bodies: [C(0, 0), C(100, 2 * BRAWL_RULES.body + 10)] });
    expect(stepBrawl(off, [], ctx).bodies.map((p) => p.x)).toEqual([0, 100]);
  });
  it('a free body faces the nearest standing body of the other side', () => {
    const s = newBrawl(ctx, { bodies: [P(0), { ...C(-900), face: 1 }, C(1500)] });
    const t = stepBrawl(s, [], ctx);
    expect(t.bodies[1].tg).toBe(0);
    expect(t.bodies[1].face).toBe(1);
    expect(t.bodies[0].tg).toBe(1);
    expect(t.bodies[0].face).toBe(-1);
  });
});

describe('brawl core: a flung body is a blow', () => {
  it('thrown into the crowd, it knocks down the body it meets', () => {
    const s = newBrawl(ctx, { bodies: [P(0), C(500), C(1000)] });
    const out = run(s, 90, (k) => [{ mv: k === 1 ? 'throw' : undefined }]);
    expect(hits(out.events, 'grab').map(([, e]) => e.d)).toEqual([1]);
    const flung = hits(out.events).find(([, e]) => e.kind === 'flung');
    expect(flung?.[1]).toMatchObject({ p: 1, d: 2 });
    expect(out.s.bodies[1].hp).toBeLessThan(K.hp);
    expect(out.s.bodies[2].hp).toBe(K.hp - BRAWL_RULES.flung);
  });
});

describe('brawl core: knocked down, a body rises untouchable a while', () => {
  it('a blow on the risen body passes through for `wake` frames, then lands', () => {
    const s = newBrawl(ctx, { bodies: [P(0), C(700)] });
    const down = run(s, 200, (k) => [{ mv: k === 1 ? DOWN : undefined }]);
    const risen = down.s.bodies[1];
    expect(risen.st).toBe('stand');
    // (stood up `wake` frames ago at most: struck now, nothing; struck after, a hit)
    const at = (s0) => { const c = s0.bodies[1]; c.inv = BRAWL_RULES.wake; c.x = s0.bodies[0].x + 700; c.st = 'stand'; return s0; };
    const early = run(at(down.s), 12, (k) => [{ mv: k === 0 ? JAB : undefined }]);
    expect(hits(early.events).length).toBe(0);
    const late = run(at(down.s), BRAWL_RULES.wake + 14, (k) => [{ mv: k === BRAWL_RULES.wake ? JAB : undefined }]);
    expect(hits(late.events).length).toBe(1);
  });
});

describe('brawl core: the belt', () => {
  const belt = readBelt({ at: [0, 0], heading: 0, screens: [{ length: 14 }, { length: 16, gate: true }, { length: 16, boss: true }] });
  const half = viewHalf(belt);
  it('the camera goes on with the players and holds at a gate; a player stays in the view; cleared, it goes on', () => {
    const c = { ...ctx, belt };
    const s = newBrawl(c, { bodies: [P(2000), C(40000)] });
    expect(s.cam).toBe(Math.round(half * 1000));
    const walked = run(s, 900, () => [{ x: 1 }], c).s;
    expect(walked.cam).toBe(Math.round((heldAt(belt) - half) * 1000));
    expect(walked.bodies[0].x).toBeLessThanOrEqual(walked.cam + Math.round((half - 0.5) * 1000));
    const on = run({ ...walked, cleared: [1] }, 200, () => [{ x: 1 }], c).s;
    expect(on.cam).toBeGreaterThan(walked.cam);
  });
  it('every body stays in the band across the belt', () => {
    const c = { ...ctx, belt };
    const out = run(newBrawl(c, { bodies: [P(3000), C(9000)] }), 200, () => [{ z: 1 }, { z: -1 }], c).s;
    expect(out.bodies[0].z).toBe(Math.round(belt.depth[1] * 1000));
    expect(out.bodies[1].z).toBe(Math.round(belt.depth[0] * 1000));
  });
});

describe('brawl core: determinism', () => {
  it('the same start and pads are the same brawl to the byte; a different pad is another', () => {
    const play = (j) => { const s = newBrawl(ctx, { bodies: [P(0), C(800), C(1600, 300), C(-900, -200)] }); return brawlHash(run(s, 240, (k) => [{ x: k % 50 < 20 ? 1 : 0, z: k % 70 < 10 ? 1 : 0, mv: k % 23 === j ? JAB : k % 61 === 3 ? 'throw' : undefined }, { x: -1, mv: k % 31 === 5 ? JAB : undefined }, { x: -1 }]).s); };
    expect(play(4)).toBe(play(4));
    expect(play(4)).not.toBe(play(9));
  });
  it('refuses a body it cannot place', () => {
    expect(() => newBrawl(ctx, { bodies: [] })).toThrow(/bodies/);
    expect(() => newBrawl(ctx, { bodies: [{ fighter: 3, side: 'player' }] })).toThrow(/fighter/);
    expect(() => newBrawl(ctx, { bodies: [{ fighter: 0, side: 'boss' }] })).toThrow(/side/);
  });
});
