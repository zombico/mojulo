import { describe, it, expect } from 'vitest';
import { assembleStageScene } from './stage.js';
import { starter } from './entries.js';
import { levelAddress } from '../scene/scene-gltf-level.js';
import { extractEngineScore } from '../scene/engine-score.js';
import { facesToGlb } from '../scene/scene-gltf.js';
import { glbJson } from '../scene/materials-gate.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { collectFaceTextures } from '../landscape/surface-textures.js';

// a built stage stays addressable: its rooms, the doorways between them, every thing it placed, and the hulls an
// engine walks against (era/anchors.js)
const DUNGEON = { ...starter('gothic-stone'), reference: 'gothic-night', items: [{ id: 'key', at: [6, 10] }], doors: [{ id: 'west', at: { side: '-x', u: 4 }, to: { map: 'plaza', door: 'church' }, locked: 'key' }] };
const CATACOMB = { ...starter('catacomb'), reference: 'gothic-night', art: { seed: 44 } };
const built = new Map();
const scene = (m) => built.get(m) || built.set(m, assembleStageScene(m)).get(m);
const inside = (p, c, pad = 0) => [0, 1, 2].every((k) => p[k] > c.min[k] - pad && p[k] < c.max[k] + pad);

describe('a stage is addressable', () => {
  it.each([['the castle dungeon', DUNGEON], ['an art-directed catacomb', CATACOMB]])('%s names its rooms and every doorway between them', (_, m) => {
    const p = scene(m);
    expect(p.rooms.map((r) => r.id)).toEqual(m.rooms.map((r) => r.id));
    const doorways = p.anchors.filter((a) => a.kind === 'doorway');
    expect(doorways.map((a) => a.between)).toEqual(m.links.map((l) => [l.from, l.to]));
    for (const r of p.rooms) for (const id of r.doorways) expect(doorways.find((a) => a.id === id).between).toContain(r.id);
    const ids = p.anchors.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of p.anchors) expect(p.rooms.map((r) => r.id)).toContain(a.room);
  });

  it.each([['the castle dungeon', DUNGEON], ['an art-directed catacomb', CATACOMB]])('%s names its set piece, its lid, its things and its torches, each thing its own node', (_, m) => {
    const p = scene(m), byId = new Map(p.anchors.map((a) => [a.id, a]));
    expect(byId.get('set-piece').form).toBeTruthy();
    expect(p.anchors.filter((a) => a.kind === 'torch').length).toBeGreaterThan(4);
    expect(p.anchors.filter((a) => a.kind === 'doodad').length).toBeGreaterThan(2);
    expect(p.anchors.filter((a) => a.kind === 'niche').length).toBeGreaterThan(10);
    // a thing with a node: the faces carrying it are its own, inside its box
    const nodes = new Set(p.faces.map((f) => f.node).filter(Boolean));
    for (const a of p.anchors.filter((q) => q.node && !q.node.startsWith('item:'))) {
      expect(nodes.has(a.node)).toBe(true);
      for (const f of p.faces.filter((q) => q.node === a.node)) for (const c of f.corners) expect(inside(c, a.box, 1e-4)).toBe(true);
    }
    expect(nodes.has('set-piece')).toBe(true);
  });

  it('the recipe\'s door and item are anchors too: the door\'s trigger and lock, the item a solid plinth', () => {
    const p = scene(DUNGEON), door = p.anchors.find((a) => a.id === 'west'), key = p.anchors.find((a) => a.id === 'key');
    expect(door).toMatchObject({ kind: 'door', room: 'nave', locked: 'key', to: { map: 'plaza', door: 'church' }, node: 'west' });
    expect(door.trigger.min.length).toBe(3);
    expect(key).toMatchObject({ kind: 'item', node: 'item:key', solid: true });
    expect(p.colliders.some((c) => c.of === 'key')).toBe(true);
  });

  it.each([['the castle dungeon', DUNGEON], ['an art-directed catacomb', CATACOMB]])('%s is walled where it is closed, open where its doorways are, and its solid things block', (_, m) => {
    const p = scene(m), C = p.colliders;
    for (const r of p.rooms) for (const s of ['-y', '+x', '+y', '-x']) expect(C.some((c) => c.of === `wall:${r.id}:${s}`)).toBe(true);
    // the walker stands clear at the spawn, and walks through every doorway at chest height
    const [sx, sy] = p.walk.spawn;
    expect(C.filter((c) => inside([sx, sy, 1], c, 0.3))).toEqual([]);
    for (const d of p.anchors.filter((a) => a.kind === 'doorway')) {
      for (const t of [-1, -0.5, 0, 0.5, 1]) {
        const q = [d.at[0] + d.N[0] * t * 0.9, d.at[1] + d.N[1] * t * 0.9, 1.2];
        expect(C.filter((c) => inside(q, c, 0.2)).map((c) => c.of)).toEqual([]);
      }
    }
    for (const a of p.anchors.filter((q) => q.solid)) expect(C.some((c) => c.of === a.id)).toBe(true);
    // a hull stands on the floor (the floor is the engine's ground plane); only a doorway's lintel hangs over the way
    for (const c of C) if (c.min[2] !== 0) expect(c.of.startsWith('wall:') && p.anchors.some((d) => d.kind === 'doorway' && d.height === c.min[2])).toBe(true);
  });

  it('the address leaves through the engine score and the GLB: rooms, anchors, colliders, a node per thing', () => {
    const p = scene(DUNGEON), score = extractEngineScore({ ref: 'sk_t', manifest: DUNGEON }, p);
    expect(score.rooms.length).toBe(6);
    expect(score.anchors.length).toBe(p.anchors.length);
    expect(score.colliders.length).toBe(p.colliders.length);
    expect(score.ledger.address_carried.count).toBe(p.anchors.length);
    const j = glbJson(Buffer.from(facesToGlb({ ...p, textures: collectFaceTextures(p.faces) }).bytes));
    const names = new Set(j.nodes.map((n) => n.name));
    for (const id of ['set-piece', 'set-piece-lid', 'west', 'torch-1', 'barrel-1']) expect([...names].some((n) => n === id || n.startsWith(`${id}:`))).toBe(true);
    expect(j.scenes[0].extras['moj:anchors'].length).toBe(p.anchors.length);
    expect(j.scenes[0].extras['moj:rooms'].map((r) => r.id)).toEqual(DUNGEON.rooms.map((r) => r.id));
  }, 60000);

  it('a unit scale runs through positions and lengths, never a normal', () => {
    const a = levelAddress({ anchors: [{ id: 'x', at: [1, 2, 3], N: [0, 1, 0], box: { min: [0, 0, 0], max: [1, 1, 1] }, width: 2 }] }, (v) => v.map((x) => x * 0.3), (x) => x * 0.3).anchors[0];
    expect(a.at.map((x) => +x.toFixed(4))).toEqual([0.3, 0.6, 0.9]);
    expect(a.N).toEqual([0, 1, 0]);
    expect(+a.width.toFixed(4)).toBe(0.6);
    expect(levelAddress({})).toEqual({});
  });

  it('the World page never reads the address: the page is the same with it as without it', () => {
    const p = scene(DUNGEON), textures = collectFaceTextures(p.faces);
    const bare = { ...p, rooms: undefined, anchors: undefined, colliders: undefined, faces: p.faces.map(({ node, ...f }) => f) };
    expect(emitThreeWorld({ ...p, textures, inline: true })).toBe(emitThreeWorld({ ...bare, textures, inline: true }));
  }, 60000);
});
