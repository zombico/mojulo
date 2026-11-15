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
