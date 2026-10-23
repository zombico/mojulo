import { describe, it, expect } from 'vitest';
import { composeLive, emissionSource, EMISSION } from './compose.js';
import { readRunner } from './runner.js';

const E = composeLive();
const hooks = { ground: () => 0 };
const DT = 1 / 30;
const hero = { id: 'hero', pilotable: true, rule: { type: 'platform', speed: 9, turn: 2.6, jumpSpeed: 6.5, eye: 0, collideRadius: 0.3, collideHeight: 1.7 }, body: { type: 'none' }, transform: { pos: [0, 0, 0], heading: 0 } };
const run = (runner) => E.createWorld({ entities: [JSON.parse(JSON.stringify(hero))], runner });
const step = (w, input = {}) => E.stepWorld(w, input, DT, hooks);
const until = (w, cond, input = () => ({}), max = 900) => { for (let k = 0; k < max && !cond(w); k++) step(w, input(w)); return w; };
// a steady player: the next threat in its lane, met in time (a step aside for a block, a jump, a slide)
let last = {};
function dodge(w) {
  const R = w.runner, ahead = R.items.filter((it) => !it.gone && it.kind !== 'coin' && it.s > R.s && it.s - R.s < R.speed * 0.9);
  const mine = ahead.filter((it) => it.lane < 0 || it.lane === R.lane).sort((a, b) => a.s - b.s)[0];
  let i = {};
  if (mine && mine.kind === 'hurdle') i = mine.s - R.s < R.speed * 0.32 ? { jump: 1 } : {};
  else if (mine && mine.kind === 'bar') i = mine.s - R.s < R.speed * 0.3 ? { forward: -1 } : {};
  else if (mine) {
    const blocked = new Set(ahead.filter((it) => it.kind === 'block' && Math.abs(it.s - mine.s) < 2).map((it) => it.lane));
    for (const d of [1, -1, 2, -2]) { const l = R.lane + d; if (l >= 0 && l < R.spec.lanes && !blocked.has(l)) { i = { turn: Math.sign(d) }; break; } }
  }
  if (i.turn && last.turn === i.turn) i = {};   // a press, not a hold
  last = i;
  return i;
}

describe('the endless runner: the pilot runs on its own, the world comes at it', () => {
  it('a world without a runner has none, and its page carries none of it', () => {
    expect(E.createWorld({ entities: [hero] }).runner).toBeUndefined();
    expect(emissionSource()).not.toContain('buildRunner');
    expect(emissionSource({ runner: true })).toContain('function buildRunner(E)');
    expect(EMISSION.map((b) => b.name)).not.toContain('buildRunner');
  });

  it('runs ahead at its speed, climbing to its top, its rows laid ahead and dropped behind; the same seed the same rows', () => {
    const a = until(run({ seed: 4, speed: 10, accel: 3, max: 14 }), (w) => w.runner.s > 120 || w.runner.crashed, dodge);
    expect(a.runner.s).toBeGreaterThan(120);
    expect(a.runner.speed).toBeCloseTo(14, 6);
    expect(a.runner.items.every((it) => it.s > a.runner.s - a.runner.spec.behind && it.s < a.runner.s + a.runner.spec.ahead + 40)).toBe(true);
    last = {};
    const b = until(run({ seed: 4, speed: 10, accel: 3, max: 14 }), (w) => w.runner.s > 120 || w.runner.crashed, dodge);
    expect(b.runner.items).toEqual(a.runner.items);
    const first = (seed) => { const x = run({ seed }); step(x); return x.runner.items; };
    expect(first(5)).not.toEqual(first(4));
  });

  it('a press left or right steps one lane, eased across; a hold does not step again', () => {
    const w = run({ clear: 200 });
    expect(w.runner.lane).toBe(1);
    step(w, { turn: -1 }); for (let k = 0; k < 10; k++) step(w, { turn: -1 });
    expect(w.runner.lane).toBe(0);
    for (let k = 0; k < 20; k++) step(w);
    expect(w.byId.hero.transform.pos[1]).toBeCloseTo(w.runner.spec.laneW, 1);   // the left lane, +y off a +x heading
    step(w, { strafe: 1 }); step(w); step(w, { strafe: 1 });
    expect(w.runner.lane).toBe(2);
  });

  it('a hit is judged in 3D: a jump clears a hurdle, a slide passes under a bar, a block in the lane ends the run', () => {
    const lay = (kind, lane = -1) => { const w = run({ clear: 400 }); w.runner.items = [{ id: 'x', kind, lane, s: 12 }]; return w; };
    // straight on into each: a crash
    for (const [kind, lane] of [['hurdle', -1], ['bar', -1], ['block', 1]]) {
      const w = until(lay(kind, lane), (x) => x.runner.crashed || x.runner.s > 20);
      expect(w.runner.crashed, kind).toBe(true);
      expect(w.runner.crashedAt.kind).toBe(kind);
    }
    const near = (x, d) => x.runner.items[0] && x.runner.items[0].s - x.runner.s < d;
    const jumpIt = until(lay('hurdle'), (x) => x.runner.crashed || x.runner.s > 20, (x) => (near(x, 3) ? { jump: 1 } : {}));
    expect(jumpIt.runner.crashed).toBe(false);
    const slideIt = until(lay('bar'), (x) => x.runner.crashed || x.runner.s > 20, (x) => (near(x, 3) ? { forward: -1 } : {}));
    expect(slideIt.runner.crashed).toBe(false);
    const stepIt = until(lay('block', 1), (x) => x.runner.crashed || x.runner.s > 20, (x) => (near(x, 8) && x.runner.lane === 1 ? { turn: 1 } : {}));
    expect(stepIt.runner.crashed).toBe(false);
    // and once crashed, it runs no further
    const done = until(lay('block', 1), (x) => x.runner.crashed), at = done.runner.s;
    for (let k = 0; k < 30; k++) step(done, { forward: 1 });
    expect(done.runner.s).toBe(at);
  });

  it('every row leaves a way through: a steady player runs a minute at speed', () => {
    last = {};
    const w = until(run({ seed: 11 }), (x) => x.runner.crashed || x.runner.s > 900, dodge, 60 * 30);
    expect(w.runner.crashed).toBe(false);
    expect(w.runner.rows).toBeGreaterThan(30);
    expect(w.runner.coins).toBeGreaterThan(0);
  });

  it('the bus hears the run: a coin each, ten metres each, the crash once', () => {
    const w = run({ clear: 400 });
    w.runner.items = [{ id: 'c', kind: 'coin', lane: 1, s: 6 }, { id: 'b', kind: 'block', lane: 1, s: 25 }];
    let prev = E.castFacts(w, undefined).prev, events = [];
    until(w, (x) => { const f = E.castFacts(x, prev); prev = f.prev; events.push(...f.events); return x.runner.crashed && events.some((e) => e.type === 'runner:crash'); });
    const types = events.map((e) => e.type);
    expect(types.filter((t) => t === 'runner:coin').length).toBe(1);
    expect(types.filter((t) => t === 'runner:run').length).toBe(2);
    expect(types.filter((t) => t === 'runner:crash').length).toBe(1);
  });

  it('reads the recipe, refusing what is not a runner', () => {
    expect(readRunner(true)).toEqual({});
    expect(readRunner({ lanes: 4, palette: { coin: '#ffcc00' } })).toEqual({ lanes: 4, palette: { coin: '#ffcc00' } });
    expect(() => readRunner({ lanes: 9 })).toThrow(/lanes is a whole number 2 to 5/);
    expect(() => readRunner({ fly: 1 })).toThrow(/fly is not a runner setting/);
    expect(() => readRunner({ speed: 12, max: 8 })).toThrow(/at least speed/);
    expect(() => readRunner({ palette: { sky: '#000000' } })).toThrow(/palette/);
  });
});
