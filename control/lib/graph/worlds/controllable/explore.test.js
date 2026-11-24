import { describe, expect, it } from 'vitest';
import { composeLive, emissionSource } from './compose.js';

// THE EXPLORED MAP's record (explore.js): a tile walked the moment the target stands in it, a map room walked into making
// its region's tiles known and said once; a page without an explored map carries none of it.

const E = composeLive();
const SPEC = { target: 'hero', tile: [10, 6], tiles: ['0,0', '1,0', '2,0', '0,1'], maps: [{ room: 'r1', name: 'the hall', rect: [10, 20, 0, 6], reveals: ['1,0', '2,0', '0,1'] }] };
const world = () => E.createWorld({ explored: SPEC,
  entities: [{ id: 'hero', pilotable: true, rule: { type: 'platform', speed: 6, eye: 0, collideRadius: 0.3, collideHeight: 1.7 }, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos: [0, 2, 0], heading: Math.PI / 2 } }] });
const run = (w, input, n) => { for (let k = 0; k < n; k++) E.stepWorld(w, input, 1 / 60, { ground: () => 0 }); return w; };

describe('the explored map\'s record', () => {
  it('walks a tile the moment the target stands in it, and a map room makes its region known, said once', () => {
    const w = run(world(), {}, 2);
    expect(Object.keys(w.explored.visited)).toEqual(['0,0']);
    expect(w.explored.at).toEqual([0, 0]);
    run(w, { forward: 1 }, 150);
    expect(Object.keys(w.explored.visited)).toEqual(['0,0', '1,0']);
    expect(Object.keys(w.explored.known)).toEqual(['1,0', '2,0', '0,1']);
    expect(w.explored.got.map((g) => g.name)).toEqual(['the hall']);
    run(w, {}, 30);
    expect(w.explored.got.length).toBe(1);
    expect(w.explored.percent()).toBe(50);
  });

  it('is in a page only when its world has an explored map', () => {
    expect(emissionSource({ explore: true })).toContain('createWithExplore');
    expect(emissionSource({})).not.toContain('createWithExplore');
  });
});
