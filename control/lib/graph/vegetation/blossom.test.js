import { describe, it, expect } from 'vitest';
import { bloomFlowers, flowerGeometry, petalOutline, PEDICEL, BLOOM_DEFAULTS } from './blossom.js';
import { grow, ARCHITECTURES } from './grow.js';
import { SPECIES } from './species.js';

const S = SPECIES.cherry;
const cherry = () => grow({ ...ARCHITECTURES[S.arch], ...S.over, leafLife: S.leafLife }, { years: S.years, seed: 4242 });

describe('a cherry flower, from its parts', () => {
  it('the same bytes for the same seed, and finite', () => {
    const a = flowerGeometry({ seed: 3, depth: 2 }), b = flowerGeometry({ seed: 3, depth: 2 });
    expect(Buffer.from(a.pos.buffer).equals(Buffer.from(b.pos.buffer))).toBe(true);
    expect([...a.pos, ...a.nrm, ...a.col].every(Number.isFinite)).toBe(true);
    expect(Buffer.from(flowerGeometry({ seed: 4, depth: 2 }).pos.buffer).equals(Buffer.from(a.pos.buffer))).toBe(false);
  });
  it('a petal: its edge twice as fine each level, a notch at its tip, the claw to the tip one long', () => {
    const n = (d) => petalOutline({ depth: d }).length - 1;
    expect(n(1)).toBe(2 * n(0)); expect(n(3)).toBe(8 * n(0));
    const ring = petalOutline({ depth: 0 }), top = Math.max(...ring.map((p) => p[1])), mid = ring.find((p) => p[0] === 0 && p[1] > 0.5);
    expect(top).toBeGreaterThan(0.98); expect(mid[1]).toBeLessThan(top - 0.05);
  });
  it('levels: whole flowers cost more the finer their edge; the far star is five fans; petals are flagged', () => {
    const t = (o) => flowerGeometry(o).pos.length / 9;
    expect(t({ depth: 3 })).toBeGreaterThan(t({ depth: 1 })); expect(t({ depth: 1 })).toBeGreaterThan(t({ mid: true })); expect(t({ lo: true })).toBe(20);
    const g = flowerGeometry({ depth: 1 }), petals = [...g.part].filter((p) => p === 1).length;
    expect(petals).toBeGreaterThan(0); expect(petals).toBeLessThan(g.part.length);
    expect(Math.min(...[...g.pos].filter((_, i) => i % 3 === 2))).toBeCloseTo(-PEDICEL, 6);
  });
});

describe('a tree in bloom: flowers at the ends of its shoots', () => {
  it('deterministic, and every flower within reach of a shoot tip, none on the old wood', () => {
    const p = cherry(), a = bloomFlowers(p, { seed: 9 }), b = bloomFlowers(p, { seed: 9 });
    expect(Buffer.from(a.buffer).equals(Buffer.from(b.buffer))).toBe(true);
    expect(a.length % 9).toBe(0); expect(a.length / 9).toBeGreaterThan(2000);
    const live = p.nodes.filter((n) => !n.died && n.parent >= 0), kids = new Set(live.map((n) => n.parent));
    const tips = live.filter((n) => !kids.has(n.id) || !live.some((c) => c.parent === n.id && c.axis === n.axis)).map((n) => n.pos);
    const reach = BLOOM_DEFAULTS.tipL + 0.35, near = (q) => tips.some((t) => Math.hypot(t[0] - q[0], t[1] - q[1], t[2] - q[2]) < reach);
    for (let i = 0; i < a.length; i += 9 * 37) expect(near([a[i], a[i + 1], a[i + 2]])).toBe(true);
    for (let i = 0; i < a.length; i += 9) { expect(Math.hypot(a[i + 3], a[i + 4], a[i + 5])).toBeCloseTo(1, 5); expect(a[i + 8]).toBeGreaterThanOrEqual(0); expect(a[i + 8]).toBeLessThanOrEqual(1); }
  }, 60_000);
  it('the cherry has a hand: its limbs sweep one way round the trunk', () => {
    const p = cherry(); let turn = 0;
    for (const n of p.nodes) { if (n.parent < 0 || n.died || n.order < 1) continue; const q = p.nodes[n.parent]; if (q.axis !== n.axis || q.parent < 0) continue;
      const a = [q.pos[0] - p.nodes[q.parent].pos[0], q.pos[1] - p.nodes[q.parent].pos[1]], b = [n.pos[0] - q.pos[0], n.pos[1] - q.pos[1]]; turn += Math.sign(a[0] * b[1] - a[1] * b[0]); }
    const plain = grow({ ...ARCHITECTURES[S.arch], ...S.over, hand: undefined, leafLife: S.leafLife }, { years: S.years, seed: 4242 }); let t0 = 0;
    for (const n of plain.nodes) { if (n.parent < 0 || n.died || n.order < 1) continue; const q = plain.nodes[n.parent]; if (q.axis !== n.axis || q.parent < 0) continue;
      const a = [q.pos[0] - plain.nodes[q.parent].pos[0], q.pos[1] - plain.nodes[q.parent].pos[1]], b = [n.pos[0] - q.pos[0], n.pos[1] - q.pos[1]]; t0 += Math.sign(a[0] * b[1] - a[1] * b[0]); }
    expect(turn).toBeGreaterThan(Math.abs(t0) + 50);
  }, 60_000);
});

describe('the disc level: a tree in bloom drawn flower by flower in a terrain world', () => {
  it('a pool carries flowers and bare wood only for a species in bloom, and only when asked', async () => {
    const { plantPool } = await import('./pool.js');
    const asked = plantPool({ species: 'cherry', variants: 1, discs: true }).variants[0], plain = plantPool({ species: 'cherry', variants: 1 }).variants[0];
    expect(asked.bloom.length % 7).toBe(0); expect(asked.bloom.length / 7).toBeGreaterThan(2000); expect(asked.bare.L2.length).toBeLessThan(asked.levels.L2.length);
    expect(plain.bloom).toBeUndefined(); expect(plain.bare).toBeUndefined();
    const oak = (d) => JSON.stringify(plantPool({ species: 'oak', variants: 1, discs: d }).variants[0]);
    expect(oak(true)).toBe(oak(false));
    for (let i = 0; i < asked.bloom.length; i += 7) { expect(asked.bloom[i + 3]).toBeGreaterThan(0); expect(asked.bloom[i + 2]).toBeLessThan(1.2); }
  }, 120_000);
  it('the page channel carries discs only where a species blooms; the page script parses with and without them', async () => {
    const { plantsPageChannel } = await import('../terrain/terrain-plants.js');
    const { plantPool } = await import('./pool.js');
    const { terrainPlantsScript } = await import('../scene/channels/terrain-plants.js');
    const V = { species: [{ name: 'cherry' }] }, spec = { level: 'L2', radius: 600 };
    const withBloom = plantsPageChannel(V, [plantPool({ species: 'cherry', variants: 1, discs: true })], spec);
    const without = plantsPageChannel({ species: [{ name: 'oak' }] }, [plantPool({ species: 'oak', variants: 1, discs: true })], spec);
    expect(withBloom.discs).toBeGreaterThan(0); expect(withBloom.species[0].variants[0].fl.n).toBeGreaterThan(2000);
    expect(withBloom.species[0].variants[0].t.B2).toBeDefined(); expect(withBloom.species[0].variants[0].t.B1).toBeDefined();
    expect(without.discs).toBeUndefined(); expect(without.species[0].variants[0].fl).toBeUndefined();
    for (const [cfg, has] of [[withBloom, true], [without, false]]) for (const wind of [false, true]) {
      const src = terrainPlantsScript(cfg, wind);
      expect(src.includes('mojulo-disc')).toBe(has);
      expect(() => new Function('THREE', 'scene', 'camera', src)).not.toThrow();   // eslint-disable-line no-new-func
    }
  }, 120_000);
});

describe('a grove of many ages: trunks differ by growth, not by scale', () => {
  it('the cherry grows one variant an age: older is thicker, a stand lifts the crown', async () => {
    const { plantPool, plantRepeats } = await import('./pool.js');
    const { grow: g, measure } = await import('./grow.js');
    const pool = plantPool({ species: 'cherry', variants: 2 });
    expect(pool.variants.length).toBe(S.growth.length);
    expect(pool.variants.map((v) => v.years)).toEqual(S.growth.map((x) => x.years));
    const arch = { ...ARCHITECTURES[S.arch], ...S.over, leafLife: S.leafLife }, dbh = S.growth.map((x) => measure(g(arch, { years: x.years, seed: 777, ...(x.stand ? { stand: x.stand } : {}) })).dbh);
    expect(dbh[dbh.length - 1]).toBeGreaterThan(2.5 * dbh[0]);
    // the shortest plants take the shortest-grown variant, the tallest the tallest
    const items = [S.heights[0], S.heights[0], S.heights[1], S.heights[1]].map((height, i) => ({ x: i * 10, y: 0, z0: 0, height }));
    const rep = plantRepeats(pool, items, { level: 'L0' }).repeats, gh = pool.variants.map((v) => v.grownHeight);
    const which = (x) => { for (const r of rep) if (r.transforms.some((t) => t.pos[0] === x)) return pool.variants.findIndex((v) => v.levels.L0 === r.template); return -1; };
    expect(gh[which(0)]).toBeLessThan(gh[which(20)]);
  }, 180_000);
  it('the page picks by height only for a species grown at several ages', async () => {
    const { plantsPageChannel } = await import('../terrain/terrain-plants.js');
    const { plantPool } = await import('./pool.js');
    const { terrainPlantsScript } = await import('../scene/channels/terrain-plants.js');
    const spec = { level: 'L1', radius: 600 }, ch = plantsPageChannel({ species: [{ name: 'cherry' }] }, [plantPool({ species: 'cherry', variants: 2 })], spec);
    expect(ch.species[0].byH).toEqual(S.heights); expect([...ch.species[0].rank].sort()).toEqual([...S.growth.keys()]);
    const oak = plantsPageChannel({ species: [{ name: 'oak' }] }, [plantPool({ species: 'oak', variants: 2 })], spec);
    expect(oak.species[0].byH).toBeUndefined();
    expect(terrainPlantsScript(ch).includes('sp.byH')).toBe(true); expect(terrainPlantsScript(oak).includes('sp.byH')).toBe(false);
  }, 180_000);
});
