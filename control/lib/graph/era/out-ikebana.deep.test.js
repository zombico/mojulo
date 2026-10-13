import { describe, it, expect } from 'vitest';
import { clustersprout, IKEBANA_STYLES, IKEBANA_MATERIALS } from './out-ikebana.js';

// every material set (wide ones on their ground) and style, the hand, density and variation ends and walk mode taken
// pairwise (every two dials meet at all four of their ends), a new seed each row: the arrangement's laws hold
// (scalene, odd, ma, one-root, under, stands, mix, way-in)
const SCALE = { grove: 9, fungal: 5, reef: 2.4, garden: 4.5, oasis: 5, crater: 5 };
// [hand, density, variation, walk] as 0/1: five rows in which every pair of dials takes 00, 01, 10 and 11
const PAIRWISE = [[0, 0, 0, 0], [0, 1, 1, 1], [1, 0, 1, 1], [1, 1, 0, 1], [1, 1, 1, 0]];
describe('ikebana, swept', () => {
  for (const m of Object.keys(IKEBANA_MATERIALS)) it(`${m}: every style, at every pair of dial ends, keeps the laws`, () => {
    const bad = [];
    Object.keys(IKEBANA_STYLES).forEach((style, si) => PAIRWISE.forEach(([h, density, variation, w], r) => {
      const hand = ['left', 'right'][h], walk = ['open', 'thicket'][w], s = 1 + ((si * PAIRWISE.length + r) % 8);
      for (const l of clustersprout(s, { materials: m, style, hand, density, variation, walk, scale: SCALE[m] }).laws) bad.push(`${style}/${hand}/${density}/${variation}/${walk}/${s} ${l.line}`);
    }));
    expect(bad.slice(0, 5)).toEqual([]);
  });
});
