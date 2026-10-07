import { describe, it, expect } from 'vitest';
import { clustersprout, IKEBANA_STYLES, IKEBANA_MATERIALS } from './out-ikebana.js';

// every material set, style, hand, density end and variation end, 12 seeds: the arrangement's laws hold (scalene,
// odd, ma, under, one-root, stands)
const SCALE = { grove: 9, fungal: 5, reef: 2.4 };
describe('ikebana, swept', () => {
  for (const m of Object.keys(IKEBANA_MATERIALS)) it(`${m}: every style, hand, density and variation keeps the laws`, () => {
    const bad = [];
    for (const style of Object.keys(IKEBANA_STYLES)) for (const hand of ['left', 'right']) for (const density of [0, 0.5, 1]) for (const variation of [0, 1]) for (let s = 1; s <= 12; s++)
      for (const l of clustersprout(s, { materials: m, style, hand, density, variation, scale: SCALE[m] }).laws) bad.push(`${style}/${hand}/${density}/${variation}/${s} ${l.line}`);
    expect(bad.slice(0, 5)).toEqual([]);
  }, 600000);
});
