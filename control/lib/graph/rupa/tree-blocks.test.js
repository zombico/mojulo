import { describe, it, expect } from 'vitest';
import { treeBlocks, COURSE, CROWN_FILL, CROWN_POROSITY, TREE_GROUPS } from './tree-blocks.js';
import { loadAudit } from './index.js';
import { plantKind, breakSpeed } from './wind-solver.js';
import { composeLive } from '../worlds/controllable/compose.js';

const CW = composeLive();
const tree = (id, x, h = 12) => ({ id, foot: [x, 0, 0], h, trunk: 0.015 * h, crownAt: [x, 0, 0.75 * h], crownR: 0.25 * h });
const storm = (T, speed, steps = 360) => {
  const w = CW.createWorld({ entities: [], breakables: T.breakables, rupa: { trees: T.trees, wind: { speed, dir: 0, gust: 0.5, alpha: 0.2248 } } });
  for (let i = 0; i < steps; i++) CW.stepWorld(w, {}, 1 / 60, { ground: () => 0 });
  return w;
};

describe('a tree as blocks', () => {
  const T = treeBlocks([tree('tree-0', 0), tree('tree-1', 15, 20)], []);
  const own = (id) => T.breakables.filter((b) => b.id.startsWith(`${id}:`));

  it('a trunk of its own cross-section in courses to its crown\'s underside, a crown of leaves and air resting on it', () => {
    const t = tree('tree-1', 15, 20), bs = own('tree-1'), trunk = bs.filter((b) => /:trunk#/.test(b.id)), crown = bs.find((b) => /:crown$/.test(b.id));
    const side = trunk[0].max[0] - trunk[0].min[0];
    expect(side * side).toBeCloseTo(Math.PI * t.trunk ** 2, 3);
    expect(trunk.every((b) => b.max[2] - b.min[2] <= COURSE + 1e-6)).toBe(true);
    expect(Math.max(...trunk.map((b) => b.max[2]))).toBeCloseTo(t.crownAt[2] - t.crownR, 3);
    expect(crown.min[2]).toBe(Math.max(...trunk.map((b) => b.max[2])));
    expect(crown).toMatchObject({ fill: CROWN_FILL, porosity: CROWN_POROSITY });
    expect(crown.fuel > 0 || crown.ignite > 0).toBe(true);   // it burns
    expect(loadAudit(T.breakables).holds).toBe(true);
  });

  it('the wind that snaps it is its plant form\'s at its height', () => {
    expect(T.trees[0].breakSpeed).toBeCloseTo(breakSpeed(plantKind('tree', 12)), 3);
    expect(T.trees[0]).toMatchObject({ id: 'tree-0', foot: 'tree-0:trunk#0', blocks: own('tree-0').map((b) => b.id) });
  });

  it('each tree face goes with the tree it stands by; every other face stays as it was', () => {
    const face = (x, z, group) => ({ corners: [[x - 0.1, 0, z], [x + 0.1, 0, z], [x, 0.1, z]], group });
    const F = treeBlocks([tree('tree-0', 0), tree('tree-1', 15, 20)], [face(0.1, 2, TREE_GROUPS[0]), face(15.2, 15, TREE_GROUPS[1]), face(7, 1, 'isekai:grass')]).faces;
    expect(F[0]).toMatchObject({ node: 'tree-0:trunk#0', group: 'break:tree-0:trunk#0' });
    expect(F[1]).toMatchObject({ node: 'tree-1:crown' });
    expect(F[2]).toEqual(face(7, 1, 'isekai:grass'));
  });

  it('no trees, none', () => { expect(treeBlocks([], [])).toBeNull(); });
});

describe('a tree in a storm', () => {
  it('a gale under its break speed leaves it standing (its trunk is one piece of wood on its roots, not a stack)', () => {
    const w = storm(treeBlocks([tree('tree-0', 0)], []), 20);
    expect(w.rupa.trees[0].snapped).toBeNull();
    expect(w.rupa.toppled).toEqual([]);
    expect(w.rupa.fells).toEqual([]);
  });

  it('past it the tree is thrown downwind about its foot and lies along the wind, its crown beyond its trunk', () => {
    const w = storm(treeBlocks([tree('tree-0', 0)], []), 45);
    const T = w.rupa.trees[0];
    expect(T.snapped.speed).toBeGreaterThan(T.breakSpeed);
    const f = w.rupa.fells[0];
    expect(f.done).toBe(true);
    const trunk = w.breakables.find((b) => b.id === 'tree-0:trunk#0'), crown = w.breakables.find((b) => b.id === 'tree-0:crown');
    expect(crown.min[0]).toBeGreaterThan(trunk.max[0] - 1e-6);   // downwind (+x), lying beyond its trunk
    expect(crown.max[2] - crown.min[2]).toBeCloseTo(2 * 3, 3);    // a crown lies as tall as it is wide
    expect(trunk.max[2] - trunk.min[2]).toBeLessThan(0.5);        // the trunk lies flat
  });

  it('the same storm throws the same trees the same way', () => {
    const run = () => JSON.stringify(storm(treeBlocks([tree('tree-0', 0), tree('tree-1', 10, 16)], []), 40).breakables.map((b) => [b.min, b.max]));
    expect(run()).toBe(run());
  });
});

describe('in a world', () => {
  it('a physical stage\'s trees near the trail are blocks the storm knows; any other stage\'s trees are scenery as before', async () => {
    const { resolveWorldScene } = await import('../worlds/world-scene.js');
    const { starter } = await import('../era/entries.js');
    const hero = { id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5 }, transform: { pos: [0, 0, 0] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } };
    const level = (extra) => ({ manifest: { ...starter('isekai-meadow'), entities: [hero], ...extra }, title: 'meadow' });
    const phys = (await resolveWorldScene(level({ destruction: 'physical' }))).payload, plain = (await resolveWorldScene(level({}))).payload;
    expect(phys.rupa.trees.length).toBeGreaterThan(0);
    expect(phys.breakables.some((b) => /^tree-\d+:crown$/.test(b.id))).toBe(true);
    expect(phys.faces.some((f) => /^break:tree-\d+:/.test(f.group || ''))).toBe(true);
    expect(phys.physicalTrees).toBeUndefined();
    expect(phys.rupaAudit).toMatchObject({ loose: [], crush: [], span: [] });
    expect(plain.physicalTrees).toBeUndefined();
    expect(plain.faces.some((f) => /^break:tree-/.test(f.group || ''))).toBe(false);
  }, 180000);
});
