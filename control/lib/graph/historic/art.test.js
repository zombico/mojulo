import { describe, it, expect } from 'vitest';
import { planHistoricCity } from './historic-city.js';
import { PATTERNS } from './patterns.js';
import { SUMER_ASSETS } from './assets/sumer.js';

const within = (r, P, pad = 0) => r.x >= P.x - pad && r.y >= P.y - pad && r.x + r.w <= P.x + P.w + pad && r.y + r.d <= P.y + P.d + pad;

describe('historic art and street structures: placed by meaning', () => {
  const p = planHistoricCity({ seed: 7 }), P = p.stats.precinct, { cols, cell, data, codes } = p.grid;
  const cellAt = (x, y) => data[Math.floor(y / cell) * cols + Math.floor(x / cell)];
  const of = (a) => p.slots.filter((q) => q.asset === a);
  it('every art and street asset is built from the shared art / street families', () => {
    for (const id of ['door-posts', 'stele', 'votive-row', 'pillar-hall', 'guardians', 'ritual-vase', 'altar', 'well', 'pottery-kiln', 'granary', 'reed-boat']) {
      const fams = SUMER_ASSETS[id].patterns.map((k) => PATTERNS[k].family);
      expect(fams.some((f) => f === 'art' || f === 'street'), id).toBe(true);
    }
  });
  it('the sacred art gathers on the axis: vases, bulls and the altar at the stair foot, stelae within the gate, the worshippers and the pillar hall in the court', () => {
    const zig = of('ziggurat')[0].rect, ax = zig.x + zig.w / 2;
    for (const a of ['ritual-vase', 'guardians', 'altar']) {
      const [q] = of(a);
      expect(Math.abs(q.rect.x + q.rect.w / 2 - ax), a).toBeLessThan(0.01);   // centred on the axis
      expect(q.rect.y, a).toBeGreaterThan(zig.y + zig.d);                       // in front of the ziggurat
      expect(within(q.rect, P), a).toBe(true);
    }
    expect(of('stele').length).toBe(2);
    for (const a of ['stele', 'votive-row', 'pillar-hall']) for (const q of of(a)) expect(within(q.rect, P), a).toBe(true);
    // the goddess's posts: one pair outside the precinct gate, one at the white temple's door
    const posts = of('door-posts');
    expect(posts.length).toBe(2);
    expect(posts.some((q) => q.rect.y >= P.y + P.d)).toBe(true);
  });
  it('street structures go where they are needed: wells on lanes, kilns in the strip under the wall, boats on the water, granaries by the precinct', () => {
    expect(of('well').length).toBeGreaterThan(2);
    for (const q of of('well')) expect(cellAt(q.rect.x + q.rect.w / 2, q.rect.y + q.rect.d / 2)).toBe(codes.LANE);
    expect(of('pottery-kiln').length).toBeGreaterThan(1);
    for (const q of of('pottery-kiln')) expect(cellAt(q.rect.x + 1, q.rect.y + 1)).toBe(codes.OPEN);
    expect(of('reed-boat').length).toBeGreaterThan(0);
    for (const q of of('reed-boat')) expect(cellAt(q.rect.x + q.rect.w / 2, q.rect.y + q.rect.d / 2)).toBe(codes.WATER);
    const gr = of('granary');
    expect(gr.length).toBe(2);
    const dist = (r) => Math.max(P.x - (r.x + r.w), r.x - (P.x + P.w), P.y - (r.y + r.d), r.y - (P.y + P.d), 0);
    const courts = of('house-court').map((q) => dist(q.rect));
    for (const q of gr) expect(dist(q.rect)).toBeLessThanOrEqual(Math.min(...courts));
  });
});

import { assetBlueprint } from './historic-city.js';
describe('historic blueprints: the asset in pure geometry before the render', () => {
  it('draws an asset from its own parts: three views, every part kind in the table, its build notes', () => {
    const svg = assetBlueprint({ asset: 'stele' });
    expect(svg.startsWith('<svg')).toBe(true);
    for (const v of ['FRONT', 'SIDE', 'PLAN', 'PARTS', 'BUILD NOTES']) expect(svg).toContain(v);
    for (const k of ['stele-base', 'stele-ledge', 'stele-figures', 'vault']) expect(svg).toContain(k);
    expect(assetBlueprint({ asset: 'stele' })).toBe(svg);
  });
  it('every Sumer asset draws a blueprint', () => {
    for (const id of Object.keys(SUMER_ASSETS)) expect(assetBlueprint({ asset: id }).length, id).toBeGreaterThan(1000);
  });
});
