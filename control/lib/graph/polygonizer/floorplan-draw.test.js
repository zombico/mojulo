process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { mintBuilding } from '@/lib/mcp/tools/building';
import { drawNewHouse, leavesHouseToDraw } from './floorplan-draw.js';
import { resolveTier, tierErrors, HOUSE_TIERS } from './floorplan-glyphs.js';
import { structurizeHouse } from './floorplan-structure.js';

beforeEach(() => { closeDb(); });
const house = (seed, extra = {}) => ({ kind: 'floorplan', seed, ...extra });

describe('tier names a base', () => {
  it('an override merges over its base, and over house when it names none', () => {
    expect(resolveTier({ base: 'villa', beds: 5 })).toEqual({ ...HOUSE_TIERS.villa, beds: 5 });
    expect(resolveTier({ beds: 2 })).toEqual({ ...HOUSE_TIERS.house, beds: 2 });
    expect(resolveTier('cottage')).toBe(HOUSE_TIERS.cottage);
  });

  it('refuses a bad tier, naming what is valid', () => {
    expect(tierErrors('mansion')[0]).toMatch(/tier: one of cottage, house, villa/);
    expect(tierErrors({ base: 'castle' })[0]).toMatch(/tier\.base/);
    expect(tierErrors({ beds: 2.5 })[0]).toMatch(/tier\.beds/);
    expect(tierErrors({ core: ['L', 'D'] })[0]).toMatch(/tier\.core/);
    expect(tierErrors({ base: 'villa', beds: 5, study: true, core: ['L', 'K', 'D'] })).toEqual([]);
  });
});

describe('a new house draws its program, storeys, footprint and front', () => {
  it('draws many houses across seeds, every draw well formed', () => {
    const draws = Array.from({ length: 80 }, (_, i) => drawNewHouse(house(i + 1)));
    for (const d of draws) {
      expect(tierErrors(d.tier)).toEqual([]);
      expect(d.levels.length === 1 || d.levels.length === 2).toBe(true);
      if (d.levels.length === 2) expect(d.stairs).toBe(true);
      expect(d.width).toBeGreaterThanOrEqual(26);
      expect(d.height).toBeGreaterThanOrEqual(22);
      expect(d).toMatchObject({ windows: true, entryDoor: true });
    }
    const shapes = new Set(draws.map((d) => `${d.tier.base}/${d.tier.beds}/${d.tier.study}/${d.tier.core.length}/${d.levels.length}`));
    expect(shapes.size).toBeGreaterThanOrEqual(15);
    for (const base of ['cottage', 'house', 'villa']) expect(draws.some((d) => d.tier.base === base), base).toBe(true);
    expect(draws.some((d) => d.porch) && draws.some((d) => d.stoop) && draws.some((d) => !d.porch && !d.stoop)).toBe(true);
    expect(drawNewHouse(house(9))).toEqual(drawNewHouse(house(9)));                // the seed is the whole draw
  });

  it('what the manifest gives wins, and an authored plan is not drawn', () => {
    const d = drawNewHouse(house(4, { tier: 'cottage', width: 40, height: 30, windows: false, porch: false }));
    expect(d.tier).toBeUndefined();
    expect(d.width).toBeUndefined();
    expect(d.windows).toBeUndefined();
    expect(d.porch).toBeUndefined();
    expect(d.stoop).toBeUndefined();
    for (const m of [{ rooms: [{ x: 0, y: 0, w: 12, h: 12, glyph: 'L' }] }, { levels: [{ role: 'ground' }] }, { storeys: 2 }, { storeys: 1 }, { program: false }, { bsp: true }]) {
      expect(leavesHouseToDraw(house(4, m)), JSON.stringify(m)).toBe(false);
      expect(drawNewHouse(house(4, m))).toEqual({});
    }
  });

  it('every drawn house has its bedrooms', () => {
    const programs = new Set();
    for (let seed = 1; seed <= 24; seed += 1) {
      const m = { ...house(seed), ...drawNewHouse(house(seed)) };
      const h = structurizeHouse(m, { ...m, furnish: false });
      const glyphs = h.levels.map((l) => (l.structure?.plan?.rooms || []).map((r) => r.glyph).join('')).join('/');
      programs.add(glyphs);
      // the bedrooms it drew (upstairs a study takes the last slot of three or more, as the generator counts)
      const want = m.tier.beds - (m.levels.length > 1 && m.tier.study && m.tier.beds >= 3 ? 1 : 0);
      expect((glyphs.match(/B/g) || []).length, `${seed}: ${JSON.stringify(m.tier)} ${glyphs}`).toBeGreaterThanOrEqual(want);
      expect(glyphs, `${seed}`).toMatch(/L/);                                      // the open core, its kitchen in it
    }
    expect(programs.size).toBeGreaterThanOrEqual(4);
  }, 300_000);
});

describe('minting a house with nothing but a title', () => {
  it('stamps the draw into the recipe', () => {
    const r = mintBuilding({ title: 'drawn', manifest: {} });
    const m = SketchRepository.getByRef(r.ref).manifest;
    expect(Number.isInteger(m.seed)).toBe(true);
    expect(tierErrors(m.tier)).toEqual([]);
    expect(Array.isArray(m.levels)).toBe(true);
    expect(m).toMatchObject({ style: 'auto', layout: 'varied', furnishing: 'composed', windows: true, entryDoor: true });
    expect(m.quality).toBeUndefined();                                             // a stack is not graded as one floor
  });
});
