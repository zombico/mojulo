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
