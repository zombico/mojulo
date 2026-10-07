/**
 * Breakable terrain: scapeshift gives the shape (its own boxes, or a form asked of the library here), playscape cuts
 * it into blocks and the runtime holds each block in one of two states: standing (it blocks) or broken (it does not).
 */
import { describe, expect, it } from 'vitest';

import { breakableTerrain, fromColliders, groundOf, blockPieces, TERRAIN_FORMS } from './terrain.js';
import { createWorld, stepWorld, breakBlock } from '../worlds/controllable-world.js';
import { assembleStageScene } from '../era/stage.js';
import { starter } from '../era/entries.js';

const vol = (b) => (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) * (b.max[2] - b.min[2]);
const overlap = (a, b) => [0, 1, 2].every((k) => Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]) > 1e-6);
const run = (w, input, n, ground = () => 0) => { for (let i = 0; i < n; i++) stepWorld(w, input, 1 / 60, { ground }); return w; };

describe('the shape: a form from the library, or scapeshift\'s own boxes', () => {
  it('a wall is coursed in running bond, filling its box exactly, no block over another', () => {
    const t = breakableTerrain({ form: 'wall', at: [0, 0, 0], N: [0, -1], length: 4, height: 2, thick: 0.4 });
    expect(t.blocks.reduce((a, b) => a + vol(b), 0)).toBeCloseTo(4 * 2 * 0.4, 6);
    for (let i = 0; i < t.blocks.length; i++) for (let j = i + 1; j < t.blocks.length; j++) expect(overlap(t.blocks[i], t.blocks[j])).toBe(false);
    const joints = (r) => new Set(t.blocks.filter((b) => b.id.includes(`:r${r}c`)).map((b) => b.min[0]));
    expect([...joints(0)].some((x) => joints(1).has(x) && x > -2)).toBe(false);   // no joint runs straight up two courses
    expect(new Set(t.blocks.map((b) => b.id)).size).toBe(t.blocks.length);
    expect(t.blocks.every((b) => b.hp === 1)).toBe(true);
  });

  it('every form in the library builds; each block\'s faces carry its node for the page to hide', () => {
    for (const form of TERRAIN_FORMS) {
      const t = breakableTerrain({ form, at: [0, 0, form === 'slab' ? 2 : 0], N: [1, 0] });
      expect(t.blocks.length).toBeGreaterThan(0);
      const nodes = new Set(t.faces.map((f) => f.node));
      for (const b of t.blocks) expect(nodes.has(`break:${b.id}`)).toBe(true);
      expect(t.faces.every((f) => f.group === 'obj:body')).toBe(true);
    }
    expect(breakableTerrain({ form: 'slab', at: [0, 0, 2], size: [3, 2] }).blocks).toHaveLength(6);
    expect(breakableTerrain({ form: 'crate', at: [0, 0, 0], stack: 3 }).blocks.map((b) => b.max[2])).toEqual([1, 2, 3]);
  });

  it('refuses what a collider cannot be, naming why', () => {
    expect(() => breakableTerrain({ form: 'wall', at: [0, 0, 0], N: [1, 1] })).toThrow(/faces ±x or ±y/);
    expect(() => breakableTerrain({ form: 'arch', at: [0, 0, 0] })).toThrow(/forms: wall, pillar, crate, slab/);
    expect(() => breakableTerrain({ form: 'wall' })).toThrow(/needs `at`/);
    expect(() => breakableTerrain({ form: 'crate', at: [0, 0, 0], bond: 'glue' })).toThrow(/not 'glue'/);
  });

  it('a stage\'s own walls, picked by name, come back breakable; the rest come back untouched', () => {
    const stage = assembleStageScene(starter('gothic-stone')), room = stage.rooms[0].id;
    const { terrain, colliders } = fromColliders(stage.colliders, `wall:${room}:`);
    const picked = stage.colliders.filter((c) => c.of.startsWith(`wall:${room}:`));
    expect(colliders.length + picked.length).toBe(stage.colliders.length);
    expect(terrain.blocks.reduce((a, b) => a + vol(b), 0)).toBeCloseTo(picked.reduce((a, c) => a + vol(c), 0), 3);
    expect(new Set(terrain.blocks.map((b) => b.of))).toEqual(new Set(picked.map((c) => c.of)));
    expect(fromColliders(stage.colliders, `wall:${room}:`, { course: false }).terrain.blocks).toHaveLength(picked.length);
    expect(() => fromColliders(stage.colliders, 'wall:nowhere')).toThrow(/no collider matches/);
    // in the world, every picked wall stands: the lintels over the doorways are held by their jambs
    const w = createWorld({ entities: [], breakables: terrain.world.breakables, colliders });
    run(w, {}, 60);
    expect(w.breakables.filter((b) => b.falling || b.landed)).toEqual([]);
    expect(terrain.blocks.some((b) => b.bond === 'lateral')).toBe(true);
  });

  it('a broken block\'s pieces are the destruct primitives\' cleave, the same volume', () => {
    const b = breakableTerrain({ form: 'crate', at: [0, 0, 0] }).blocks[0], p = blockPieces(b);
    expect(p.chunks.length).toBeGreaterThan(1);
    expect(p.chunks.reduce((a, c) => a + c.volume, 0)).toBeCloseTo(vol(b), 3);
  });
});

// a wall across +x at x = 5, 6 m long, 3 m high
const WALL = (x = 5, id = 'wall') => breakableTerrain({ form: 'wall', id, at: [x, 0, 0], N: [-1, 0], length: 6, height: 3, thick: 0.4 });
const world = (terrain, entities, colliders) => createWorld({ entities, breakables: [].concat(terrain).flatMap((t) => t.world.breakables), ...(colliders ? { colliders } : {}) });
// four legs under a 4 m slab's corners, scapeshift's own (never breaks)
const LEGS = [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]].map(([x, y], i) => ({ min: [x - 0.1, y - 0.1, 0], max: [x + 0.1, y + 0.1, 1.7], of: `leg-${i}` }));
const hero = (pos = [0, 0, 0], heading = 0, rule = {}) => ({ id: 'hero', pilotable: true, rule: { type: 'platform', eye: 0, speed: 6, collideRadius: 0.3, collideHeight: 1.8, ...rule }, transform: { pos, heading } });

describe('standing blocks, broken blocks no longer do', () => {
  it('a standing wall stops the walker; with the blocks before it broken, it walks through', () => {
    const t = WALL(), w = world(t, [hero()]);
    run(w, { forward: 1 }, 120);
    expect(w.byId.hero.transform.pos[0]).toBeLessThan(4.8);
    for (const b of t.blocks.filter((q) => q.min[2] < 2 && q.min[1] < 1 && q.max[1] > -1)) breakBlock(w, b.id);
    run(w, { forward: 1 }, 120);
    expect(w.byId.hero.transform.pos[0]).toBeGreaterThan(6);
  });

  it('a block is standing or broken: a break takes its collider out, keeps the rest, and leaves a record', () => {
    const t = WALL(), w = world(t, [hero()]), n = w.colliders.length, id = t.blocks[3].id;
    expect(w.breakables.find((b) => b.id === id)).toMatchObject({ hp: 1, broken: null });
    expect(breakBlock(w, id, 1, 'test')).toBe(true);
    expect(w.breakables.find((b) => b.id === id)).toMatchObject({ hp: 0, broken: { by: 'test', how: 'call' } });
    expect(w.colliders).toHaveLength(n - 1);
    expect(w.colliders.some((c) => c.of === id)).toBe(false);
    expect(w.breaks).toEqual([expect.objectContaining({ seq: 0, id, by: 'test' })]);
    expect(breakBlock(w, id)).toBe(false);   // once broken, it stays broken
    expect(w.breaks).toHaveLength(1);
  });

  it('a block with more hp takes more hits', () => {
    const t = breakableTerrain({ form: 'crate', at: [3, 0, 0] }, { hp: 3 }), w = world(t, [hero()]), id = t.blocks[0].id;
    expect([breakBlock(w, id), breakBlock(w, id), breakBlock(w, id)]).toEqual([false, false, true]);
  });

  it('a shot stops on the block it meets and breaks it; the next goes through the hole to the wall behind, the next through both', () => {
    const t1 = WALL(5, 'near'), t2 = WALL(9, 'far');
    const gun = { id: 'gun', rule: { type: 'static' }, transform: { pos: [0, 0.3, 0], heading: 0, pitch: 0 }, weapon: { fireClass: 'sight', auto: true, cooldown: 0.2, coreAngle: 1, range: 100, damage: 5, impact: 0, eye: 1.2 } };
    const w = world([t1, t2], [gun]);
    run(w, { fire: 1 }, 1);
    expect(w.breaks.map((b) => b.id)).toEqual([expect.stringMatching(/^near:/)]);
    expect(w.byId.gun.lastShot.to[0]).toBeCloseTo(4.8, 3);
    run(w, { fire: 1 }, 40);   // the next shot through the hole into the far wall, and the ones after through both
    expect(w.breaks.map((b) => b.id)).toEqual([expect.stringMatching(/^near:/), expect.stringMatching(/^far:/)]);
    expect(w.byId.gun.lastShot.to[0]).toBeCloseTo(100, 3);
    expect(w.breaks[1].by).toBe('gun');
  });

  it('a round bursting on the wall breaks every block its splash reaches', () => {
    const t = WALL();
    const gun = { id: 'gun', rule: { type: 'static' }, transform: { pos: [0, 0, 1.5], heading: 0, pitch: 0 }, weapon: { fireClass: 'lob', magazine: 1, projectileSpeed: 40, projectileGravity: 0, splashRadius: 0.8, projRadius: 0.1, damage: 50 } };
    const w = world(t, [gun]);
    run(w, { fire: 1 }, 1); run(w, {}, 30);
    const at = [4.8, 0, 1.5], near = t.blocks.filter((b) => Math.hypot(...[0, 1, 2].map((k) => Math.max(b.min[k] - at[k], 0, at[k] - b.max[k]))) <= 0.8);
    expect(w.breaks.length).toBeGreaterThan(1);
    expect(new Set(w.breaks.map((b) => b.id))).toEqual(new Set(near.map((b) => b.id)));
    expect(w.breaks.every((b) => b.how === 'burst')).toBe(true);
  });

  it('a swing breaks the blocks in front of it within reach, each once, never the one behind', () => {
    const front = breakableTerrain({ form: 'crate', id: 'front', at: [1.6, 0, 0] }), back = breakableTerrain({ form: 'crate', id: 'back', at: [-1.6, 0, 0] });
    const w = world([front, back], [hero([0, 0, 0], 0, { strike: 'melee', strikeDur: 0.4, strikeReach: 2 })]);
    run(w, {}, 5); run(w, { fire: 1 }, 30);
    expect(w.breaks.map((b) => b.id)).toEqual(['front:r0c0']);
    expect(w.breaks[0]).toMatchObject({ how: 'swing', by: 'hero' });
  });

  it('a slab on legs holds the walker up until the tile under it breaks; then it falls, and the rest of the slab holds', () => {
    const t = breakableTerrain({ form: 'slab', at: [0, 0, 2], size: [4, 4], tile: 1 }), w = world(t, [hero([0.5, 0.5, 2])], LEGS);
    const ground = (pos) => groundOf(w.colliders)(pos);
    run(w, {}, 30, ground);
    expect(w.byId.hero.transform.pos[2]).toBeCloseTo(2, 3);
    breakBlock(w, t.blocks.find((b) => b.min[0] <= 0.5 && b.max[0] >= 0.5 && b.min[1] <= 0.5 && b.max[1] >= 0.5).id);
    run(w, {}, 60, ground);
    expect(w.byId.hero.transform.pos[2]).toBeCloseTo(0, 3);
    expect(w.breakables.filter((b) => !b.broken).every((b) => !b.falling && b.max[2] === 2)).toBe(true);
  });
  it('a world without breakables has no breakable state, and steps as before', () => {
    const a = createWorld({ entities: [hero()] }), b = createWorld({ entities: [hero()], breakables: [] });
    expect(a.breakables).toBeUndefined();
    expect(a.colliders).toBeNull();
    run(a, { forward: 1 }, 30); run(b, { forward: 1 }, 30);
    expect(b.byId.hero.transform.pos).toEqual(a.byId.hero.transform.pos);
  });
});

const standing = (w) => w.breakables.filter((b) => !b.broken);
const byId = (w, id) => w.breakables.find((b) => b.id === id);
const settle = (w, n = 120) => run(w, {}, n);

describe('gravity: what holds, what falls, how it lands', () => {
  it('everything on the floor or on what stands holds still', () => {
    const w = world([WALL(), breakableTerrain({ form: 'crate', id: 'c', at: [3, 3, 0], stack: 3 })], []);
    settle(w);
    expect(w.breakables.every((b) => !b.falling && !b.landed)).toBe(true);
  });

  it('a slab with nothing under it falls as it is: from low it lands whole, from high it breaks', () => {
    const low = world(breakableTerrain({ form: 'slab', at: [0, 0, 1.2], size: [2, 2] }), []);
    settle(low);
    expect(standing(low)).toHaveLength(4);
    expect(low.breakables.every((b) => b.min[2] === 0 && Math.abs(b.landed.drop - 0.9) < 1e-9)).toBe(true);   // 0.9 m: a soft landing
    const high = world(breakableTerrain({ form: 'slab', at: [0, 0, 2.5], size: [2, 2] }), []);
    settle(high);
    expect(standing(high)).toHaveLength(0);
    expect(high.breaks.every((b) => b.how === 'fall')).toBe(true);
  });

  it('a running-bond wall: a block stands while either block under it stands, and drops a course when both go', () => {
    const t = breakableTerrain({ form: 'wall', id: 'w', at: [0, 0, 0], N: [0, -1], length: 4, height: 1.5, thick: 0.4 }), w = world(t, []);
    // course 1 is offset: its block over x ∈ [-0.5, 0.5] rests on course 0's blocks at [-1, 0] and [0, 1]
    const over = t.blocks.find((b) => b.id.startsWith('w:r1') && b.min[0] === -0.5), under = t.blocks.filter((b) => b.id.startsWith('w:r0') && b.min[0] < 0.5 && b.max[0] > -0.5);
    expect(under).toHaveLength(2);
    breakBlock(w, under[0].id); settle(w);
    expect(byId(w, over.id)).toMatchObject({ falling: null, landed: null });
    breakBlock(w, under[1].id); settle(w);
    expect(byId(w, over.id).min[2]).toBe(0);
    expect(byId(w, over.id).landed).toMatchObject({ drop: 0.5, on: null });
    expect(byId(w, over.id).broken).toBeNull();   // half a metre: it lands whole
  });

  it('a stack drops when its foot goes, and lands stacked again', () => {
    const t = breakableTerrain({ form: 'crate', id: 'c', at: [0, 0, 0], stack: 3 }), w = world(t, []);
    breakBlock(w, 'c:r0c0'); settle(w);
    expect(standing(w).map((b) => [b.id, b.min[2], b.max[2]])).toEqual([['c:r1c0', 0, 1], ['c:r2c0', 1, 2]]);
    expect(byId(w, 'c:r2c0').landed.on).toBe('c:r1c0');
  });

  it('a crate on a slab falls through the hole when the tile under it breaks; a hard landing breaks it', () => {
    const slab = breakableTerrain({ form: 'slab', id: 's', at: [0, 0, 2], size: [4, 4] }), crate = breakableTerrain({ form: 'crate', id: 'c', at: [0.5, 0.5, 2] });
    const w = world([slab, crate], [], LEGS);
    settle(w, 30);
    expect(byId(w, 'c:r0c0').falling).toBeNull();
    breakBlock(w, slab.blocks.find((b) => b.min[0] === 0 && b.min[1] === 0).id); settle(w);
    expect(byId(w, 'c:r0c0').broken).toMatchObject({ how: 'fall' });
    expect(w.breaks.at(-1)).toMatchObject({ id: 'c:r0c0', how: 'fall' });
  });

  it('a block dropped hard onto another breaks them both', () => {
    const slab = breakableTerrain({ form: 'slab', id: 's', at: [0, 0, 3.5], size: [4, 4] }), top = breakableTerrain({ form: 'crate', id: 'top', at: [0.5, 0.5, 3.5] });
    const floor = breakableTerrain({ form: 'crate', id: 'low', at: [0.5, 0.5, 0] });
    const tall = LEGS.map((c) => ({ ...c, max: [c.max[0], c.max[1], 3.2] }));
    const w = world([slab, top, floor], [], tall);
    settle(w, 30);
    breakBlock(w, slab.blocks.find((b) => b.min[0] === 0 && b.min[1] === 0).id); settle(w);
    expect(w.breaks.slice(1).map((b) => [b.id, b.how])).toEqual([['top:r0c0', 'fall'], ['low:r0c0', 'crush']]);
  });

  it('a falling block is still a collider: it blocks while it falls', () => {
    const t = breakableTerrain({ form: 'crate', id: 'c', at: [0, 0, 6] }), w = world(t, []);
    run(w, {}, 20);
    const b = byId(w, 'c:r0c0');
    expect(b.falling).not.toBeNull();
    expect(w.colliders.find((c) => c.of === 'c:r0c0').min[2]).toBe(b.min[2]);
    expect(b.min[2]).toBeLessThan(6);
  });
});
