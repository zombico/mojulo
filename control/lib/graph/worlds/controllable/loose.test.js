// Walk-through breakables (loose.js): what lies loose about a level, struck and gone, never a collider. One heap on the
// floor in front of a hero: a swing clears it; a round through it clears it and goes on; a burst clears what is in its
// splash and nothing past it; the hero wades through it whole; a world without loose things keeps no state of them.
import { describe, it, expect } from 'vitest';
import { composeLive } from './compose.js';

const CW = composeLive();
const HEAP = { id: 'heap-1', min: [1.2, -0.6, 0], max: [2.2, 0.6, 0.45] };
const hero = (over = {}) => ({ id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5, strike: 'melee', strikeReach: 1.4, strikeDur: 0.3 }, transform: { pos: [0, 0, 0], heading: 0 }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] }, ...over });
const world = (loose = [HEAP]) => CW.createWorld({ entities: [hero()], colliders: [], loose });
const step = (w, input = {}) => CW.stepWorld(w, input, 1 / 60, { ground: () => 0 });

describe('a loose thing', () => {
  it("is never a collider, and a swing in front of it clears it: a record for the page, the block's own", () => {
    const w = world();
    expect((w.colliders || []).some((c) => c.of === HEAP.id)).toBe(false);
    for (let i = 0; i < 40; i++) step(w, { fire: i < 2 });
    expect(w.loose[0].broken).toMatchObject({ how: 'swing', by: 'hero' });
    expect(w.breaks).toHaveLength(1);
    expect(w.breaks[0]).toMatchObject({ id: HEAP.id, how: 'swing', by: 'hero' });
    expect(w.breaks[0].at.map((v) => Math.round(v * 1000) / 1000)).toEqual([1.7, 0, 0.225]);
  });

  it('is cleared by a round that passes through it and by a burst that reaches it; one out of reach stays', () => {
    const far = { id: 'heap-2', min: [9, -0.5, 0], max: [10, 0.5, 0.4] };
    const shot = world([HEAP, far]);
    shot.byId.hero.lastShot = { mode: 'miss', t: shot.time, from: [0, 0, 0.3], to: [5, 0, 0.3] };
    step(shot);
    expect(shot.loose.map((b) => b.broken?.how ?? null)).toEqual(['shot', null]);
    const boom = world([HEAP, far]);
    boom.bursts = [{ t: boom.time, pos: [2.6, 0, 0.2], radius: 1 }];
    step(boom);
    expect(boom.loose.map((b) => b.broken?.how ?? null)).toEqual(['burst', null]);
  });

  it('is waded through: walking into it, the hero comes out the far side', () => {
    const w = world();
    for (let i = 0; i < 90; i++) step(w, { forward: 1 });
    expect(w.byId.hero.transform.pos[0]).toBeGreaterThan(HEAP.max[0]);
    expect(w.loose[0].broken).toBe(null);
  });

  it('keeps no state where a world has none', () => {
    const w = CW.createWorld({ entities: [hero()], colliders: [] });
    expect(w.loose).toBeUndefined();
    step(w, { fire: true });
    expect(w.breaks).toBeUndefined();
  });
});
