// The work goal of the quick path: a Shovels & Buckets shift by the trail's start, seen from overhead and worked by a
// mascot unless the creator says otherwise; its line laid facing north (the work flowing up the screen), the work shown,
// and a counter under each place.
import { describe, it, expect } from 'vitest';
import { quickWorld, readQuick, goalMechanics, workShift, workCast, WORK_REACH, QUICK_GOALS } from './quick.js';

const ends = { spawn: [0, 0, 0], heading: 0.7, beats: [] };

describe('the work goal', () => {
  it('reads its card, its challenge and its count; refuses them on another goal, teaching', () => {
    expect(QUICK_GOALS.work).toMatch(/work shift/);
    expect(() => readQuick({ goal: 'work', card: 'kitchen', challenge: 'advanced', serve: 9 })).not.toThrow();
    expect(() => readQuick({ goal: 'work', card: 'nope' })).toThrow(/\.card is a starter/);
    expect(() => readQuick({ goal: 'work', challenge: 'expert' })).toThrow(/\.challenge/);
    expect(() => readQuick({ goal: 'farm', card: 'kitchen' })).toThrow(/\.card belongs to the work goal/);
  });
  it('is seen from overhead and worked by a mascot, unless the creator names a camera or no hero', () => {
    const W = quickWorld({ id: 'shift', quick: { goal: 'work' } });
    expect(W.camera).toBe('top-down');
    expect(W.quick.hero).toEqual({ mascot: true });
    const own = quickWorld({ id: 'shift', quick: { goal: 'work', camera: 'third-person', hero: { mascot: { seed: 3 } } } });
    expect(own.camera).toBe('third-person');
    expect(own.quick.hero).toEqual({ mascot: { seed: 3 } });
    const first = quickWorld({ id: 'shift', quick: { goal: 'work', hero: false } });
    expect(first.camera).toBeUndefined();
  });
  it('lays the line facing north with the work shown, and stands a counter under each of its places', () => {
    const [m] = goalMechanics({ goal: 'work' }, ends);
    expect(m).toMatchObject({ kind: 'work', heading: 0, show: true, counters: true, reach: WORK_REACH });
    const L = workShift({ goal: 'work' }, ends).layout;
    // north up the screen: the crates below the line, the hand-in above it
    const ys = (o) => Object.values(o).flatMap((v) => (Array.isArray(v[0]) ? v : [v])).map((q) => q[1]);
    expect(Math.max(...ys(L.crates))).toBeLessThan(Math.min(...ys(L.stations)));
    expect(L.serve[1]).toBeGreaterThan(Math.max(...ys(L.shelves)));
    const { blocks: [B] } = workCast({ goal: 'work' }, ends);
    const places = Object.values(L.stations).flat().length + Object.keys(L.crates).length + Object.keys(L.shelves).length + 1;
    expect(B.blocks.length).toBe(places);
    // a counter's middle is its place, its top a counter's height over it
    expect(B.blocks.some((b) => Math.abs((b.min[0] + b.max[0]) / 2 - L.serve[0]) < 1e-6 && Math.abs((b.min[1] + b.max[1]) / 2 - L.serve[1]) < 1e-6)).toBe(true);
  });
});

// COOKS IN A KITCHEN (quick.cooks, quick.kitchen): the cube's seats, a room of its own (never a trail) with the kitchen
// laid for them, each cook on its own side, the whole room on one fixed screen, the shift tuned to them on the proof
describe('the work goal with cooks', () => {
  it('reads cooks and a kitchen on the work goal only; one cook and none named is the line by the trail, as it was', async () => {
    const { kitchenOf } = await import('./kitchen-level.js');
    expect(() => readQuick({ goal: 'work', cooks: 2, kitchen: 'island' })).not.toThrow();
    expect(() => readQuick({ goal: 'work', cooks: 3 })).toThrow(/\.cooks is how many cooks/);
    expect(() => readQuick({ goal: 'work', kitchen: 'galley' })).toThrow(/\.kitchen is one of/);
    expect(() => readQuick({ goal: 'farm', cooks: 2 })).toThrow(/\.cooks belongs to the work goal/);
    expect([kitchenOf({ goal: 'work' }), kitchenOf({ goal: 'work', cooks: 1 }), kitchenOf({ goal: 'work', cooks: 2 }), kitchenOf({ goal: 'work', kitchen: 'island' })]).toEqual([null, null, 'split', 'island']);
  });
  it('two cooks: a kitchen room of its own, the hero and the second cook either side of its counter, one fixed station', async () => {
    const { readGameworld } = await import('./world.js');
    const { gameStages, stageLevelOrder } = await import('./levels.js');
    const { synthesizeLevel } = await import('../game/level-synth.js');
    const w = quickWorld({ id: 'kitchen', quick: { goal: 'work', cooks: 2 } }), G = readGameworld(w), stages = gameStages(w);
    expect(stages.map((s) => s.section)).toEqual(['kitchen']);
    const order = stageLevelOrder(G, stages[0], { ref: 'k', heroRef: 'h', goal: (e) => goalMechanics(w.quick, e) }), m = order.args.manifest;
    expect(m.seats).toEqual({ bodies: ['hero-2'], max: 2, join: 'drop-in', drop: 'pause' });
    expect(m.camera).toMatchObject({ rule: 'fixed', track: 0 });
    expect(m.faces.some((f) => /room:area/.test(f.group ?? ''))).toBe(true);   // the trade's area, not a trail's ground
    const [hero, two] = ['hero', 'hero-2'].map((id) => m.entities.find((e) => e.id === id));
    const counter = m.colliders.find((c) => c.max[2] > 1 && c.max[2] < 1.2 && c.max[1] - c.min[1] > 1.5 && c.max[0] - c.min[0] < 1);
    const cx = (counter.min[0] + counter.max[0]) / 2;
    expect(hero.transform.pos[0]).toBeLessThan(cx);
    expect(two.transform.pos[0]).toBeGreaterThan(cx);
    expect(Object.fromEntries(order.laws.map((l) => [l.law, l.holds]))).toMatchObject({ reachable: true, sealed: true, handoff: true, passes: true, frame: true });
    const ev = synthesizeLevel(m).mechEvents, work = m.game.mechanics.find((x) => x.kind === 'work');
    expect(ev.sources.filter((z) => z.seatUse).every((z) => z.watch === 'hero-2')).toBe(true);
    expect(work.goal).toBeGreaterThan(0);
  }, 120_000);
});
