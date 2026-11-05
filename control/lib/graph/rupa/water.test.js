import { describe, it, expect } from 'vitest';
import { groundGrid, waterBodies } from './ground-grid.js';
import { SUBSTRATE_IDS } from '../era/substrate.js';
import { composeLive } from '../worlds/controllable/compose.js';
import { blockMatter } from './matter.js';

const CW = composeLive();
// a grid of n×m points dx apart, its heights z(i, j), all soil, and its still water
const grid = (n, m, dx, z, water = []) => {
  const zs = new Float32Array(n * m);
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) zs[j * n + i] = z(i, j);
  const cells = new Uint8Array((n - 1) * (m - 1)).fill(SUBSTRATE_IDS.indexOf('soil'));
  return { ...groundGrid({ x0: 0, y0: 0, dx, nx: n, ny: m, z: Buffer.from(zs.buffer).toString('base64'), cells: Buffer.from(cells.buffer).toString('base64'), ids: [...SUBSTRATE_IDS] }), water };
};
const step = (w, k = 1) => { for (let i = 0; i < k; i++) CW.stepWorld(w, {}, 1 / 60, { ground: () => 0 }); return w; };
const vol = (Gd) => Gd.w.reduce((s, v) => s + v, 0) * Gd.dx * Gd.dx;
// a basin: a bowl 1.5 m deep at its middle on a flat land, its lake at level −0.5
const basin = (extra = {}) => CW.createWorld({ entities: [], rupa: { ground: grid(41, 41, 0.5, (i, j) => -1.5 * Math.max(0, 1 - Math.hypot(i - 20, j - 20) / 12), [{ min: [0, 0, -9], max: [20, 20, -0.5], level: -0.5 }]) }, ...extra });

describe('the stage\'s still water', () => {
  it('a lake and the sea are still water; a river is not (its level falls along it)', () => {
    const hz = (of, top) => ({ kind: 'hazard', hazard: 'water', of, box: { min: [0, 0, -2], max: [5, 5, top] } });
    expect(waterBodies([hz('lake-1', 1.2), hz('coast-1', 0), hz('river-1', 3), { kind: 'house' }])).toEqual([
      { of: 'lake-1', min: [0, 0, -2], max: [5, 5, 1.2], level: 1.2 }, { of: 'coast-1', min: [0, 0, -2], max: [5, 5, 0], level: 0 },
    ]);
  });

  it('a lake is laid at its level and stays at rest', () => {
    const w = basin(), Gd = w.rupa.ground, k = 20 * 41 + 20;
    expect(Gd.w[k]).toBeCloseTo(1, 5);   // the middle: 1.5 m deep bowl under a −0.5 level
    expect(Gd.w[0]).toBe(0);              // the land above it, dry
    const before = Array.from(Gd.w);
    step(w, 60);
    expect(Gd.flowing).toBe(false);
    expect(Array.from(Gd.w)).toEqual(before);
  });
});

describe('water that moves', () => {
  it('a crater dug at its edge floods from it, the water kept', () => {
    const w = step(basin()), Gd = w.rupa.ground, v0 = vol(Gd);
    w.rupa.power = 30;
    w.bursts.push({ seq: ++w.burstSeq, pos: [14.5, 10, 0.1], t: w.time, radius: 2.5 });   // on the shore
    step(w, 240);
    const c = w.rupa.craters[0];
    expect(c).toBeTruthy();
    const at = Math.round((c.at[1] - 0) / 0.5) * 41 + Math.round((c.at[0] - 0) / 0.5);
    expect(Gd.w[at]).toBeGreaterThan(0.05);           // the crater holds water now
    expect(vol(Gd)).toBeCloseTo(v0, 0);               // no water made or lost
  });

  it('a levee holds water back; broken, the water goes through; its push breaches what cannot hold it', () => {
    // a flat channel, water 1 m deep behind a wall across it at x = 5
    const flat = () => grid(41, 9, 0.5, () => 0, [{ min: [0, -1, -1], max: [4.9, 5, 1], level: 1 }]);
    const wall = (matter, thick) => ({ id: 'levee', min: [5, -0.5, 0], max: [5 + thick, 4.5, 1.6], hp: 6, ...blockMatter({ min: [5, -0.5, 0], max: [5 + thick, 4.5, 1.6] }, matter) });
    const w = step(CW.createWorld({ entities: [], breakables: [wall('concrete', 0.6)], rupa: { ground: flat() } }), 120);
    const Gd = w.rupa.ground, past = () => Gd.w.reduce((s, v, k) => s + ((k % 41) * 0.5 > 6 ? v : 0), 0);
    expect(past()).toBe(0);
    CW.breakBlock(w, 'levee', Infinity);
    step(w, 120);
    expect(past()).toBeGreaterThan(1);
    // a thin board against the same water: the push beats its friction, and it goes
    const weak = step(CW.createWorld({ entities: [], breakables: [wall('pine', 0.05)], rupa: { ground: flat() } }), 60);
    expect(weak.breakables[0].broken).toMatchObject({ how: 'water' });
  });

  it('rain falls on the land at its rate, and runs to the low ground', () => {
    const w = step(basin()), Gd = w.rupa.ground, v0 = vol(Gd);
    w.rupa.rain = 50; w.rupa.rainTime = 3600;   // a thunderstorm, an hour a second
    step(w, 60);
    w.rupa.rain = 0;
    const land = 41 * 41 * 0.25;
    expect(vol(Gd) - v0).toBeCloseTo(0.05 * land, 0);   // 50 mm over the land
  });

  it('the same disturbance moves the same water', () => {
    const run = () => { const w = step(basin()); w.rupa.power = 30; w.bursts.push({ seq: ++w.burstSeq, pos: [14.5, 10, 0.1], t: w.time, radius: 2.5 }); step(w, 90); return Array.from(w.rupa.ground.w).map((v) => v.toFixed(6)).join(','); };
    expect(run()).toBe(run());
  });
});

describe('in a world', () => {
  it('a physical stage\'s lake is the grid\'s still water and the physics\' pool; any other stage\'s is drawn water only', async () => {
    const { resolveWorldScene } = await import('../worlds/world-scene.js');
    const hero = { id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5 }, transform: { pos: [0, 0, 0] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } };
    const level = (extra) => ({ manifest: { kind: 'stage', kit: 'isekai-meadow', trail: { ground: { water: { lake: {} } } }, entities: [hero], ...extra }, title: 'lake' });
    const phys = (await resolveWorldScene(level({ destruction: 'physical' }))).payload, plain = (await resolveWorldScene(level({}))).payload;
    const lake = (phys.anchors || []).find((a) => a.kind === 'hazard' && /^lake-/.test(String(a.of)));
    expect(lake).toBeTruthy();
    expect(phys.rupa.ground.water).toEqual([{ of: lake.of, min: lake.box.min, max: lake.box.max, level: lake.box.max[2] }]);
    expect(phys.rupa.pools.some((p) => p.liquid === 'water' && p.max[2] === lake.box.max[2])).toBe(true);
    expect(plain.rupa).toBeUndefined();
  }, 180000);
});

describe('a river', () => {
  // a channel 4 m wide down the middle of a 20 m slope falling a metre (y up the grid is downstream)
  const n = 41, m = 81, dx = 0.5, slope = (j) => 1 - (j * dx) / 40;
  const course = { y0: 0, dy: 0.5, hw: 2, xr: Array.from({ length: m }, () => 10), wl: Array.from({ length: m }, (_, j) => slope(j) - 0.1) };
  const valley = () => grid(n, m, dx, (i, j) => slope(j) + (Math.abs(i * dx - 10) < 2 ? -0.8 * (1 - ((i * dx - 10) / 2) ** 2) : 0.3));
  const river = (extra = {}) => CW.createWorld({ entities: [], rupa: { ground: { ...valley(), rivers: [course] } }, ...extra });

  it('is laid at its levels down its course and runs, never settling', () => {
    const w = step(river(), 240), Gd = w.rupa.ground;
    expect(Gd.running).toBe(true);
    expect(Gd.flowing).toBe(true);
    const mid = 40 * n + 20;
    expect(Gd.w[mid]).toBeGreaterThan(0.3);                         // the channel holds water all down it
    expect(Gd.w[40 * n + 2]).toBe(0);                               // its banks stay dry
    expect(Math.abs(Gd.w[mid] - Gd.w0[mid])).toBeLessThan(0.25);    // near the level it was drawn at
  });

  it('a dam across it ponds the water behind it', () => {
    const dam = { id: 'dam', min: [7.5, 19.5, -1], max: [12.5, 20.5, 1.8], hp: 6, ...blockMatter({ min: [7.5, 19.5, -1], max: [12.5, 20.5, 1.8] }, 'concrete') };
    const w = step(CW.createWorld({ entities: [], breakables: [dam], rupa: { ground: { ...valley(), rivers: [course] } }, breakFloor: -1 }), 600), Gd = w.rupa.ground;
    const above = 36 * n + 20;   // just upstream of the dam
    expect(Gd.z[above] + Gd.w[above]).toBeGreaterThan(Gd.z0[above] + Gd.w0[above] + 0.1);
  });

  it('the same river runs the same way', () => {
    const run = () => Array.from(step(river(), 120).rupa.ground.w).map((v) => v.toFixed(5)).join(',');
    expect(run()).toBe(run());
  });
});

describe('a stage\'s river in a world', () => {
  it('a physical stage hands over its river\'s course; any other carries none', async () => {
    const { resolveWorldScene } = await import('../worlds/world-scene.js');
    const hero = { id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5 }, transform: { pos: [0, 0, 0] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } };
    const level = (extra) => ({ manifest: { kind: 'stage', kit: 'isekai-meadow', trail: { ground: { water: { river: {} } } }, entities: [hero], ...extra }, title: 'river' });
    const P = (await resolveWorldScene(level({ destruction: 'physical' }))).payload;
    const [Rv] = P.rupa.ground.rivers;
    expect(Rv.xr.length).toBe(Rv.wl.length);
    expect(Rv.hw).toBeGreaterThan(0);
    expect((await resolveWorldScene(level({}))).payload.rupa).toBeUndefined();
  }, 180000);
});
