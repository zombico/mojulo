// Shovels & Buckets: the card reads and teaches, the closed form's loads, the simulator's determinism and absence, an
// unattended shovel freeing the hands, the solver's targets. One card per procedure, chosen from the starters in code:
// an orders card with a station that runs alone, and a backlog card.
import { describe, it, expect } from 'vitest';
import { readCard, LEVERS, climbOf } from './card.js';
import { resolveObject } from '../playscape/objects/index.js';
import { analyze } from './analyze.js';
import { simulate } from './sim.js';
import { solve, targetOf, PRESETS } from './solve.js';
import { SCENARIOS } from './scenarios.js';

const cards = Object.values(SCENARIOS);
const ORDERS = cards.find((c) => (c.demand.mode ?? 'orders') === 'orders' && Object.values(c.stations).some((s) => s.wait));
const BACKLOG = cards.find((c) => c.demand.mode === 'backlog');
const tiny = (over = {}) => ({
  id: 'tiny', crew: { workers: 1, travel: 1 },
  stations: { cook: { verb: 'shovel', takes: { raw: 1 }, gives: { dish: 1 }, work: 2, wait: 6, hold: 6 } },
  demand: { every: 12, patience: 40, orders: [{ wants: { dish: 1 } }] }, session: 120, ...over,
});

describe('the card', () => {
  it('reads with every default written', () => {
    const C = readCard(tiny());
    expect(C.stations.cook).toMatchObject({ item: 'dish', batch: 1, slots: 1, far: 0, collect: 1 });
    expect(C.items.raw).toMatchObject({ fetch: 1, store: Infinity, prep: 0 });
    expect(C.demand).toMatchObject({ mode: 'orders', cadence: 'random', rush: null });
  });
  it('teaches what a station is', () => {
    expect(() => readCard(tiny({ stations: { cook: { verb: 'bucket', gives: { dish: 1 }, work: 1, wait: 3 } } }))).toThrow(/a bucket does not run alone/);
    expect(() => readCard(tiny({ stations: { a: { verb: 'shovel', takes: { y: 1 }, gives: { dish: 1 }, work: 1 }, b: { verb: 'shovel', takes: { dish: 1 }, gives: { y: 1 }, work: 1 } } }))).toThrow(/recipes loop/);
    expect(() => readCard(tiny({ demand: { mode: 'backlog', orders: [{ wants: { dish: 1 } }] } }))).toThrow(/standing job/);
  });
});

describe('a site', () => {
  // the line up on a deck, the hand-in below a real climb: its seconds the ladder's own, both ways on every hand-in
  it('reads its climb from the ladder object and walks it to every hand-in', () => {
    const C = readCard(tiny({ site: { up: 4 } })), base = readCard(tiny());
    const o = resolveObject({ entry: 'ladder', variant: 'ladder', to: [0, 0, 4], rise: 4, facing: [0, 1] });
    expect(C.site).toMatchObject({ up: 4, climb: 'ladder' });
    expect(C.site.seconds).toBeCloseTo(o.climb.seconds, 2);
    expect(C.demand.far).toBeCloseTo(base.demand.far + 2 * o.climb.seconds, 2);
    expect(climbOf({ up: 4, climb: 'rope' }).seconds).toBeGreaterThan(C.site.seconds);
    expect(() => readCard(tiny({ site: { up: 40 } }))).toThrow(/site is/);
    expect(() => readCard(tiny({ site: { up: 4, climb: 'escalator' } }))).toThrow(/site.climb/);
  });
});

describe('routes', () => {
  // land graded with a hoe or a leveller: two stations give one item, the cheaper preferred, the other found when it is busy
  const graded = (over = {}) => tiny({
    stations: {
      hoe: { verb: 'shovel', gives: { dish: 1 }, work: 9, slots: 2 },
      leveller: { verb: 'shovel', gives: { dish: 1 }, work: 3, far: 2 },
    },
    demand: { every: 4, patience: 30, orders: [{ wants: { dish: 1 } }] }, crew: { workers: 2, travel: 1 }, ...over,
  });
  it('reads every route and prefers the cheapest a unit', () => {
    const C = readCard(graded());
    expect(C.producers.dish).toEqual(['hoe', 'leveller']);
    expect(C.producer.dish).toBe('leveller');
    expect(C.routes.dish.map((r) => r.station)).toEqual(['hoe', 'leveller']);
  });
  it('the crew takes the other route when the preferred is busy', () => {
    const r = simulate(graded(), { seed: 1 });
    expect(r.stations.leveller).toBeGreaterThan(0);
    expect(r.stations.hoe).toBeGreaterThan(0);
    const one = simulate(graded({ stations: { leveller: { verb: 'shovel', gives: { dish: 1 }, work: 3, far: 2 } } }), { seed: 1 });
    expect(r.served).toBeGreaterThan(one.served);
  });
});

describe('the closed form', () => {
  it('splits each order into shovel, bucket and travel and loads the crew by it', () => {
    const a = analyze(ORDERS);
    for (const o of a.perOrder) expect(o.shovel + o.bucket + o.travel).toBeCloseTo(o.labour, 2);
    const two = analyze({ ...ORDERS, crew: { ...ORDERS.crew, workers: ORDERS.crew.workers * 2 } });
    expect(two.crew).toBeCloseTo(a.crew / 2, 2);
    expect(a.everyFor(a.crew)).toBeCloseTo(ORDERS.demand.every, 1);
  });
});

describe('the simulator', () => {
  it('is deterministic by seed', () => {
    expect(simulate(ORDERS, { seed: 4 })).toEqual(simulate(ORDERS, { seed: 4 }));
    expect(simulate(BACKLOG, { seed: 4 })).toEqual(simulate(BACKLOG, { seed: 4 }));
  });
  it('an absent opt-in changes nothing', () => {
    const base = simulate(ORDERS, { seed: 2 });
    expect(simulate({ ...ORDERS, demand: { ...ORDERS.demand, rush: { period: 60, length: 20, factor: 1 } } }, { seed: 2 })).toEqual(base);
    const items = Object.fromEntries(Object.entries(ORDERS.items ?? {}).map(([k, v]) => [k, { ...v, prep: 0 }]));
    expect(simulate({ ...ORDERS, items }, { seed: 2 })).toEqual(base);
  });
  it('a shovel that runs alone frees the hands, and asks to be juggled', () => {
    const alone = simulate(tiny(), { seed: 1 });
    const held = simulate(tiny({ stations: { cook: { verb: 'shovel', takes: { raw: 1 }, gives: { dish: 1 }, work: 8 } } }), { seed: 1 });
    expect(alone.pressure).toBeLessThan(held.pressure);
    expect(alone.juggle.mean).toBeGreaterThan(0);
    expect(held.juggle.peak).toBe(0);
  });
  it('a backlog left at the bell is lost', () => {
    const r = simulate({ ...BACKLOG, demand: { ...BACKLOG.demand, backlog: 200 } }, { seed: 1 });
    expect(r.missRate).toBeGreaterThan(0.5);
    expect(r.pressure).toBeGreaterThan(0.95);
  });
});

describe('the solver', () => {
  it('a challenge number meets the presets at their points', () => {
    expect(targetOf(0).bands).toEqual(PRESETS.beginner.bands);
    expect(targetOf(0.5).bands).toEqual(PRESETS.intermediate.bands);
    expect(targetOf(1).bands).toEqual(PRESETS.advanced.bands);
    expect(() => targetOf('expert')).toThrow(/preset/);
  });
  it('tunes an orders card harder from beginner to advanced, by the three families only', () => {
    const b = solve(ORDERS, 'beginner'), a = solve(ORDERS, 'advanced');
    expect(b.holds.pressure && a.holds.pressure).toBe(true);
    expect(a.metrics.pressure).toBeGreaterThan(b.metrics.pressure);
    expect(a.metrics.miss).toBeGreaterThan(b.metrics.miss);
    for (const mv of [...b.moves, ...a.moves]) expect(Object.keys(LEVERS)).toContain(mv.family);
    expect(solve(ORDERS, 'beginner')).toEqual(b);
  });
  it('tunes a backlog by the size of the job', () => {
    const r = solve(BACKLOG, 'intermediate');
    expect(r.holds.pressure).toBe(true);
    expect(r.moves.some((m) => m.lever === 'demand.backlog')).toBe(true);
  });
});
