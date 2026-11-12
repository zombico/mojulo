// A land's debris (era/skandart-land.js): the cavern answers the debris question with talus at its walls' feet and
// breakdown standing free on its floor, each heap laid on the land under it. One cavern asked to be ruined holds the
// concept: its heaps keep the heaps' laws, stand off the walk, follow the ground and join its rock; asked nothing, or
// kept, it is the cavern it was; open ground asked for a condition says it has none (its debris is its own: skandart-trail).
import { describe, it, expect } from 'vitest';
import { CAVE_SKANDART } from './skandart-land.js';
import { buildHeap } from './skandart.js';
import { assembleStageScene } from './stage.js';

const CAVE = (over = {}) => ({ kind: 'stage', kit: 'isekai-meadow', trail: { ground: { cavern: true } }, ...over });

describe('a cavern\'s debris', () => {
  it('builds its heaps at its own scale, a cone free on every side, each at its fines\' repose, taller than a room\'s', () => {
    const A = CAVE_SKANDART, spec = { heights: A.heights, reach: A.reach };
    const cone = buildHeap({ plinth: { out: 0 } }, 'cone', A.cone.pieces, 1, 0.077, 7, 0, {}, spec);
    const xs = cone.faces.filter((f) => f.matter === 'grit').flatMap((f) => f.corners);
    // (round: as far out on every side)
    for (const k of [0, 1]) expect(Math.abs(Math.max(...xs.map((c) => c[k])) + Math.min(...xs.map((c) => c[k])))).toBeLessThan(0.6);
    expect(cone.body.H).toBeGreaterThan(0.6);
    expect(cone.pieces.some((q) => q.id === 'breakdown-slab')).toBe(true);
    // (the slabs at its foot, the spall up its face)
    const r = (q) => Math.hypot(q.x, q.y), mean = (id) => { const qs = cone.pieces.filter((q) => q.id === id); return qs.reduce((a, q) => a + r(q), 0) / qs.length; };
    expect(mean('breakdown-slab')).toBeGreaterThan(mean('spall'));
  });

  it('lays a ruined cavern\'s heaps on its land, its laws kept, joined to its rock; asked nothing or kept, the cavern is as it was', () => {
    const plain = assembleStageScene(CAVE(), {}), ruined = assembleStageScene(CAVE({ condition: 'ruined' }), {});
    expect(ruined.skandart).toMatchObject({ amount: 1, condition: 'ruined', laws: [] });
    expect(ruined.skandart.heaps).toBeGreaterThan(8);
    expect(plain.skandart).toBeUndefined();
    // (its heaps are the cavern's rock, banded and tiled as every rock of it is)
    const rock = (P) => P.faces.filter((f) => f.group === 'isekai:rock').length;
    expect(rock(ruined)).toBeGreaterThan(rock(plain));
    expect(ruined.faces.some((f) => f.group === 'cave:debris')).toBe(false);
    // (asked for none, kept, nothing came down: the same cavern)
    expect(JSON.stringify(assembleStageScene(CAVE({ condition: 'kept' }), {}).faces)).toBe(JSON.stringify(plain.faces));
    // (open ground has no condition word, and says so)
    expect(() => assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', trail: true, condition: 'ruined' }, {})).toThrow(/open ground has no condition word/);
  }, 400_000);
});
