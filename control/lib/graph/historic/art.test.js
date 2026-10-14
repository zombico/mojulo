import { describe, it, expect } from 'vitest';
import { planHistoricCity } from './historic-city.js';
import { PATTERNS } from './patterns.js';
import { SUMER_ASSETS } from './assets/sumer.js';
import { FORMS } from './form/towns.js';
import { WHERE } from './form/schema.js';

const within = (r, P, pad = 0) => r.x >= P.x - pad && r.y >= P.y - pad && r.x + r.w <= P.x + P.w + pad && r.y + r.d <= P.y + P.d + pad;

describe('historic art and street structures: placed by meaning', () => {
  it('every art and street asset is built from the shared art / street families', () => {
    for (const id of ['door-posts', 'stele', 'votive-row', 'pillar-hall', 'guardians', 'ritual-vase', 'altar', 'well', 'pottery-kiln', 'granary', 'reed-boat']) {
      const fams = SUMER_ASSETS[id].patterns.map((k) => PATTERNS[k].family);
      expect(fams.some((f) => f === 'art' || f === 'street'), id).toBe(true);
    }
  });
  // one case per placement rule (../form/schema.js WHERE), the culture whose form uses it chosen in code
  const RULES = {
    'monument-front': (q, p) => { const m = p.stats.monuments[0].rect, c = [q.rect.x + q.rect.w / 2, q.rect.y + q.rect.d / 2], f = p.stats.monuments[0].facing;
      const onAxis = f === 'n' || f === 's' ? Math.abs(c[0] - (m.x + m.w / 2)) < 0.01 : Math.abs(c[1] - (m.y + m.d / 2)) < 0.01;
      const before = { n: c[1] < m.y, s: c[1] > m.y + m.d, w: c[0] < m.x, e: c[0] > m.x + m.w }[f];
      return onAxis && before && within(q.rect, p.stats.precinct, 1); },
    precinct: (q, p) => within(q.rect, p.stats.precinct, 1),
    'precinct-gate': (q, p) => within(q.rect, p.stats.precinct, 12),
    crossing: (q, p) => code(p, q.rect) === p.grid.codes.LANE,
    'wall-strip': (q, p) => code(p, q.rect, 1) === p.grid.codes.OPEN || code(p, q.rect, 1) === p.grid.codes.HOUSE,
    water: (q, p) => code(p, q.rect) === p.grid.codes.WATER,
    bank: (q, p) => code(p, q.rect) === p.grid.codes.REED,
  };
  const code = (p, r, at) => { const { cols, cell, data } = p.grid, [x, y] = at ? [r.x + at, r.y + at] : [r.x + r.w / 2, r.y + r.d / 2]; return data[Math.floor(y / cell) * cols + Math.floor(x / cell)]; };
  for (const [where, holds] of Object.entries(RULES)) {
    const id = Object.keys(FORMS).find((c) => (FORMS[c].placement || []).some((it) => it.where === where && it.asset));
    if (!id) continue;
    it(`${where} (${id}): ${WHERE[where]}`, () => {
      const p = planHistoricCity({ culture: id, seed: 7 }), it = FORMS[id].placement.find((x) => x.where === where && x.asset);
      const qs = p.slots.filter((q) => q.asset === it.asset && (where !== 'precinct' || within(q.rect, p.stats.precinct, 1)));
      expect(qs.length).toBeGreaterThan(0);
      for (const q of qs) expect(holds(q, p), `${it.asset} at ${JSON.stringify(q.rect)}`).toBe(true);
    });
  }
  it('near-monument: the large lots nearest the precinct are given over', () => {
    const id = Object.keys(FORMS).find((c) => (FORMS[c].placement || []).some((it) => it.where === 'near-monument')), it = FORMS[id].placement.find((x) => x.where === 'near-monument');
    expect(planHistoricCity({ culture: id, seed: 7 }).slots.filter((q) => q.asset === it.asset).length).toBeGreaterThanOrEqual(it.max ?? 1);
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
