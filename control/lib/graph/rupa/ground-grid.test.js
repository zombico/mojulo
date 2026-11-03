import { describe, it, expect } from 'vitest';
import { groundGrid, DEPTH } from './ground-grid.js';
import { rupaPhysics, readScarsSpec } from './index.js';
import { SUBSTRATE_IDS } from '../era/substrate.js';
import { composeLive } from '../worlds/controllable/compose.js';
import { blockMatter } from './matter.js';

const CW = composeLive();
// a flat grid n×n points, dx apart, every facet one ground (or a function of its facet)
const grid = (n, dx, ground, z = 0) => {
  const cells = new Uint8Array((n - 1) * (n - 1));
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) cells[j * (n - 1) + i] = SUBSTRATE_IDS.indexOf(typeof ground === 'function' ? ground(i, j) : ground);
  return groundGrid({ x0: 0, y0: 0, dx, nx: n, ny: n, z: Buffer.from(new Float32Array(n * n).fill(z).buffer).toString('base64'), cells: Buffer.from(cells.buffer).toString('base64'), ids: [...SUBSTRATE_IDS] });
};
const step = (w, k = 1) => { for (let i = 0; i < k; i++) CW.stepWorld(w, {}, 1 / 60, { ground: () => 0 }); return w; };
const world = (ground, extra = {}) => CW.createWorld({ entities: [], rupa: { ground }, ...extra });
const blast = (w, pos, radius) => { w.bursts.push({ seq: ++w.burstSeq, pos, t: w.time, radius }); };
const net = (Gd) => Gd.z.reduce((s, v, k) => s + v - Gd.z0[k], 0) * Gd.dx * Gd.dx;

describe('the land as a soil grid', () => {
  it('each ground is its soil over bedrock: bare rock has none to dig, sand lies deepest', () => {
    const G = grid(4, 1, 'soil');
    expect(G.soils.map((s) => s.depth)).toEqual(SUBSTRATE_IDS.map((k) => DEPTH[k]));
    expect(G.soils[SUBSTRATE_IDS.indexOf('soil')]).toMatchObject({ id: 'loam' });
    expect(G.soils[SUBSTRATE_IDS.indexOf('bedrock')].depth).toBe(0);
    expect(groundGrid(null)).toBeNull();
  });

  it('a burst at the ground digs the crater its energy would in that soil; the bank lands in the rim, bulked by its swell', () => {
    const w = world(grid(41, 0.5, 'soil'));
    blast(w, [10, 10, 0.2], 2);
    step(w);
    const Gd = w.rupa.ground, c = w.rupa.craters[0], loam = Gd.soils[SUBSTRATE_IDS.indexOf('soil')];
    const J = rupaPhysics.blowJoules('burst', w.rupa, { radius: 2 }) * (1 - 0.2 / 2), want = rupaPhysics.craterSize(J, loam.dig);
    expect(c.radius).toBeCloseTo(want.radius, 9);
    expect(rupaPhysics.groundZ(Gd, 10, 10)).toBeLessThan(-0.5 * want.depth);
    // what was dug, bulked by the swell, is all laid back down: the land gains (swell − 1) × the bank
    expect(net(Gd)).toBeCloseTo((loam.swell - 1) * want.volume, 1);
    expect(Gd.version).toBe(1);
  });

  it('sand gives a wider crater than loam to the same charge; bare rock takes none', () => {
    const dug = (g) => { const w = world(grid(41, 0.5, g)); blast(w, [10, 10, 0.2], 2); step(w); return w.rupa.craters[0]?.radius ?? 0; };
    expect(dug('sand')).toBeGreaterThan(dug('soil'));
    expect(dug('bedrock')).toBe(0);
  });

  it('a crater stops at bedrock', () => {
    const w = world(grid(41, 0.5, 'scree'));   // a metre of scree over rock
    w.rupa.power = 1e3;
    blast(w, [10, 10, 0.1], 4);
    step(w);
    expect(Math.min(...w.rupa.ground.z)).toBeGreaterThanOrEqual(-DEPTH.scree - 1e-5);
  });

  it('a burst higher than its radius digs nothing', () => {
    const w = world(grid(21, 0.5, 'soil'));
    blast(w, [5, 5, 3], 2);
    step(w);
    expect(w.rupa.craters).toEqual([]);
    expect(net(w.rupa.ground)).toBe(0);
  });
});

describe('what stood on the land that went', () => {
  it('a footing whose ground is dug drops to it, and what it carried comes down', () => {
    const post = { id: 'post', min: [9.8, 9.8, 0], max: [10.2, 10.2, 2], hp: 6, ...blockMatter({ min: [9.8, 9.8, 0], max: [10.2, 10.2, 2] }, 'steel') };   // (a steel post: the charge digs under it, not through it)
    const w = step(CW.createWorld({ entities: [], breakables: [post], colliders: [{ min: [9.8, 9.8, -0.1], max: [10.2, 10.2, 0], of: 'post:footing' }], rupa: { ground: grid(41, 0.5, 'soil') }, breakFloor: -10 }));
    const foot = () => w.rupa.footings[0];   // (the world's colliders keep only their boxes: the physics knows its footings)
    expect(foot().max[2]).toBe(0);
    blast(w, [10.4, 10, 0.2], 2.5);
    step(w, 90);
    expect(foot().max[2]).toBeLessThan(-0.1);
    const b = w.breakables.find((q) => q.id === 'post');
    expect(b.min[2]).toBeCloseTo(foot().max[2], 2);   // it came down onto it
  });

  it('the same blows dig the same land', () => {
    const run = () => { const w = world(grid(41, 0.5, (i, j) => (i < 20 ? 'soil' : 'sand'))); blast(w, [9, 10, 0.2], 2); step(w); blast(w, [11, 10, 0.2], 2.5); step(w, 2); return Array.from(w.rupa.ground.z).join(','); };
    expect(run()).toBe(run());
  });
});

describe('on the page and in the world', () => {
  it('only a world with ground draws and probes it', async () => {
    const { controllableChannelScript, groundViewScript } = await import('../scene/channels/controllable/index.js');
    const hero = [{ id: 'hero', kind: 'walker', transform: { pos: [0, 0, 1], heading: 0 }, rule: {}, body: {} }];
    const page = (rupa) => controllableChannelScript(hero, null, {}, rupa ? { rupa } : {});
    expect(page({ ground: grid(4, 1, 'soil') })).toContain('__updateGround();');
    expect(page({ ground: grid(4, 1, 'soil') })).toContain(groundViewScript());
    expect(page({ scars: readScarsSpec(true) })).not.toContain('__updateGround');
    expect(() => new Function('THREE', 'meshes', '__world', '__CW', '__ground', groundViewScript())).not.toThrow();
  });

  it('a physical stage lays its land as the grid; any other stage carries none', async () => {
    const { resolveWorldScene } = await import('../worlds/world-scene.js');
    const { starter } = await import('../era/entries.js');
    const hero = { id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5 }, transform: { pos: [0, 0, 0] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } };
    const level = (extra) => ({ manifest: { ...starter('isekai-meadow'), entities: [hero], ...extra }, title: 'meadow' });
    const phys = (await resolveWorldScene(level({ destruction: 'physical' }))).payload, plain = (await resolveWorldScene(level({}))).payload;
    const Gd = phys.rupa.ground;
    expect(Gd.nx * Gd.ny).toBeGreaterThan(100);
    expect(rupaPhysics.unb64(Gd.z).length).toBe(Gd.nx * Gd.ny * 4);
    expect(Gd.soils.length).toBe(SUBSTRATE_IDS.length);
    expect(phys.physicalGround).toBeUndefined();
    expect(plain.physicalGround).toBeUndefined();
    expect(plain.rupa).toBeUndefined();
  }, 180000);
});
