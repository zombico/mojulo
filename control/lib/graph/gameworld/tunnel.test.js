import { describe, it, expect } from 'vitest';
import { readIntent, tunnel } from './tunnel.js';
import { tunnelBuilding, buildingDomain, BUILDING_TRAITS } from './tunnel-buildings.js';
import { STARTER_BLOCKS } from '../era/tech-blocks.js';

// a toy domain: a number that must reach a target; a law that holds once it is even
const toy = {
  id: 'toy', TRAITS: { big: { words: ['big', 'very big'], read: 'at least 5', at: 5 }, huge: { words: ['huge'], read: 'at least 9', at: 9 }, gold: { words: ['gold'], read: 'gold' } },
  start: (seed, base) => ({ n: base ?? 0 }),
  pull: (c, T, id) => (id === 'gold' ? { gap: { why: 'no gold here', proposal: 'a gold block' } } : { candidate: { n: c.n + 1 }, changed: [`+1 for ${id}`] }),
  build: (c) => ({ n: c.n }),
  measure: (T, id, b) => ({ ok: b.n >= T.at, value: b.n }),
  laws: (b) => [{ law: 'even', ok: b.n % 2 === 0, value: b.n }],
  tweak: (c) => ({ candidate: { n: c.n + 1 }, changed: ['+1'] }),
  plan: (c, b, rec) => ({ n: c.n, held: rec.held }),
};

describe('the tunnel', () => {
  it('reads an intent: phrases before words, each trait once, the rest unread', () => {
    const r = readIntent(toy, 'a very big, BIG and golden thing');
    expect(r.traits).toEqual([{ id: 'big', word: 'very big' }]);
    expect(r.unread).toEqual(['golden', 'thing']);
    expect(() => readIntent(toy, '  ')).toThrow(/an intent/);
  });

  it('pulls, assesses, tweaks and reassesses until it holds, logging every pass; a gap is named, never filled', () => {
    const r = tunnel(toy, { intent: 'big gold', seed: 1 });
    expect(r.gaps).toEqual([{ trait: 'gold', word: 'gold', read: 'gold', why: 'no gold here', proposal: 'a gold block' }]);
    expect(r.passes.map((p) => p.traits.failed.length + p.laws.failed.length > 0)).toEqual([true, true, true, true, true, false]);
    expect(r.passes.at(-1).traits.held).toEqual(['big']);
    expect(r).toMatchObject({ held: true, complete: false, plan: { n: 6, held: true } });
    // bounded: a trait out of reach stops after the passes, not held
    const h = tunnel(toy, { intent: 'huge', passes: 3 });
    expect(h.passes).toHaveLength(3);
    expect(h.held).toBe(false);
    expect(JSON.stringify(tunnel(toy, { intent: 'big gold', seed: 1 }))).toBe(JSON.stringify(r));
  });
});

describe('the civilization tunnel: buildings', () => {
  const INTENT = 'a modular sci-fi habitat, raised, with a comms mast and solar';

  it('a modular sci-fi habitat: flat roofs, two modules, panel walls, raised, small lights, an airlock, a mast and wings', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const r = tunnelBuilding(INTENT, { seed });
      expect(r.complete, `seed ${seed}`).toBe(true);
      const { L, b, mounts } = r.built;
      expect(L.vocab.cap).toBe('flat');
      expect(b.masses.length).toBeGreaterThanOrEqual(2);
      expect(L.bonds.every((x) => x === 'panels')).toBe(true);
      expect(L.proportions.socle.h).toBeGreaterThanOrEqual(0.6);
      expect(mounts.map((m) => m.block).sort()).toEqual(['roof-mast', 'solar-wing', 'solar-wing', 'status-light']);
      expect(b.faces.some((f) => f.part === 'bond') || b.tile.some((f) => f.part === 'bond')).toBe(true);
    }
    expect(JSON.stringify(tunnelBuilding(INTENT, { seed: 3 }).plan)).toBe(JSON.stringify(tunnelBuilding(INTENT, { seed: 3 }).plan));
  }, 60000);

  it('names what the civilization cannot say: a block it lacks, a word its rails lack', () => {
    const { 'roof-mast': _m, ...lib } = STARTER_BLOCKS;
    const r = tunnelBuilding('a habitat with a mast', { seed: 1, library: lib });
    expect(r.gaps.map((g) => g.trait)).toEqual(['mast']);
    expect(r.gaps[0].proposal).toMatch(/a block 'roof-mast'/);
    const D = buildingDomain(), c = D.start(1, 'timber-hall');
    const g = D.pull(c, { ops: [{ each: 'elements.wall.storeys', set: 'bond', to: 'hexagons' }] }, 'hex');
    expect(g.gap.proposal).toMatch(/add hexagons to the wall's bond rail/);
  });

  it('the first trait to set a thing keeps it', () => {
    const r = tunnelBuilding('low tall', { seed: 2, base: 'timber-hall' });
    expect(r.candidate.anchor.compose.storeys).toBe(1);
    expect(r.pulled.find((p) => p.trait === 'tall').changed).toEqual(['compose.storeys: kept from low']);
    expect(Object.keys(BUILDING_TRAITS)).toContain('panel-seams');
  });
});
