import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { planRegion, assembleRegionScene, REGION_CULTURES } from './historic-region.js';
import { planHistoricCity, canalBankN } from './historic-city.js';

const hash = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const overlaps = (a, b) => a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.d - 1e-6 && b.y < a.y + a.d - 1e-6;

describe('historic region: the Sumerian city in its land', () => {
  const p = planRegion({ seed: 7 }), T = p.town;
  const at = (asset) => p.slots.filter((s) => s.asset === asset).map((s) => s.rect);
  it('is deterministic, and a different seed is a different land', () => {
    expect(hash(planRegion({ seed: 7 }))).toBe(hash(p));
    expect(hash(planRegion({ seed: 8 }))).not.toBe(hash(p));
  });
  it('sets the town in the middle, on the ground\'s 4 m columns', () => {
    expect(T.x % 4).toBe(0); expect(T.w % 4).toBe(0);
    expect(Math.abs(T.x + T.w / 2 - p.frame.w / 2)).toBeLessThan(4);
    expect(p.boxes.filter((b) => b.kind === 'city-wall' || b.asset === 'ziggurat').length).toBeGreaterThan(0);
  });
  it('zones its works by what they need: brick and pots upstream, the harbour below the town, the marsh at the end', () => {
    const east = REGION_CULTURES.sumer.downstream === 'e';
    for (const a of ['clay-pit', 'brick-kiln', 'brick-field', 'potters-yard']) {
      expect(at(a).length, a).toBeGreaterThan(0);
      for (const r of at(a)) expect(east ? r.x + r.w < T.x : r.x > T.x + T.w, a).toBe(true);
    }
    for (const a of ['stone-landing', 'copper-workshop', 'bitumen-works', 'charcoal-clamp']) {
      expect(at(a).length, a).toBeGreaterThan(0);
      for (const r of at(a)) expect(east ? r.x > T.x + T.w : r.x + r.w < T.x, a).toBe(true);
    }
    expect(at('reed-boat').length).toBe(at('stone-landing').length);
    expect(p.stats.farms).toBeGreaterThanOrEqual(3);
    expect(p.stats.gardens).toBeGreaterThan(20);
    expect(p.grounds.some((g) => g.kind === 'marsh')).toBe(true);
  });
  it('keeps every piece on the frame, apart, and off the town\'s built ground', () => {
    const town = planHistoricCity({ seed: 7, frame: REGION_CULTURES.sumer.town, countryside: false }), { cols, rows, cell, data, codes } = town.grid;
    const rs = p.slots.map((s) => s.rect);
    for (let i = 0; i < rs.length; i++) {
      const r = rs[i];
      expect(r.x >= 0 && r.y >= 0 && r.x + r.w <= p.frame.w && r.y + r.d <= p.frame.d, p.slots[i].asset).toBe(true);
      for (let j = i + 1; j < rs.length; j++) expect(overlaps(r, rs[j]), `${p.slots[i].asset} × ${p.slots[j].asset}`).toBe(false);
      for (let y = r.y; y < r.y + r.d; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) {
        const c = Math.floor((x - T.x) / cell), rr = Math.floor((y - T.y) / cell);
        if (c >= 0 && rr >= 0 && c < cols && rr < rows) expect(data[rr * cols + c], p.slots[i].asset).toBe(codes.OUTSIDE);
      }
    }
  });
  it('lays no region ground over the town\'s frame, and sinks the clay pits', () => {
    expect(p.grounds.filter((g) => g.kind === 'ground' && overlaps(g, T)).length).toBe(p.grounds.filter((g) => g.kind === 'ground' && g.x >= T.x && g.x + g.w <= T.x + T.w && g.y >= T.y && g.y + g.d <= T.y + T.d).length);
    for (const pit of at('clay-pit')) {
      expect(pit.x % 4).toBe(0);
      expect(p.grounds.filter((g) => !g.poly && g.z >= 0 && g.kind !== 'water' && overlaps(g, pit)).map((g) => g.kind)).toEqual([]);
    }
  });
  it('an eye-level page carries its one camera and leaves out what is behind it', () => {
    const air = assembleRegionScene({ seed: 7 }), eye = assembleRegionScene({ seed: 7, view: 'fields' });
    expect(air.cameras.map((c) => c.name)).toEqual(expect.arrayContaining(['aerial', 'fields', 'harbour', 'kilns', 'quarter-air', 'harbour-air']));
    expect(eye.cameras.map((c) => c.name)).toEqual(['fields']);
  });
});

describe('historic city hooks for the region', () => {
  it('a town planned without its countryside has no fields and no palms outside the ring; by default it has both', () => {
    const bare = planHistoricCity({ seed: 7, countryside: false }), full = planHistoricCity({ seed: 7 });
    expect(bare.grounds.some((g) => g.kind === 'field')).toBe(false);
    expect(full.grounds.some((g) => g.kind === 'field')).toBe(true);
    expect(bare.stats.palms).toBeLessThan(full.stats.palms);
  });
  it('the plan\'s canal line is the line its water is drawn on', () => {
    const t = planHistoricCity({ seed: 7 }), bank = canalBankN(t.canal);
    for (const g of t.grounds.filter((q) => q.kind === 'water').slice(0, 20)) {
      const [x, y] = g.poly[0];
      expect(bank(x)).toBeCloseTo(y, 6);
    }
  });
});
