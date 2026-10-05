import { describe, it, expect } from 'vitest';
import { HISTORIC_SCENES, historicOptions, historicViews, assembleHistoricKindScene } from './historic-kind.js';
import { HISTORIC_CULTURES, assembleHistoricWorld } from './historic-city.js';
import { REGION_CULTURES } from './historic-region.js';
import { assembleFarmsteadScene } from './farmstead.js';
import { WORLD_KINDS } from '../worlds/world-kinds.js';
import { WALKABLE_WORLD_KINDS, sketchRenderMode } from '../sketch/sketch-manifest.js';

describe('the historic world kind', () => {
  it('is registered, walkable and rendered on the World page', () => {
    expect(WORLD_KINDS.historic.walk).toBe(true);
    expect(WALKABLE_WORLD_KINDS).toContain('historic');
    expect(sketchRenderMode({ kind: 'historic', culture: 'thebes' })).toBe('world');
  });

  it('offers a city for every culture, and the land, farm and works only where a culture has them', () => {
    expect(HISTORIC_SCENES.city.cultures).toEqual(Object.keys(HISTORIC_CULTURES));
    expect(HISTORIC_SCENES.region.cultures).toEqual(Object.keys(REGION_CULTURES));
    expect(HISTORIC_SCENES.farm.cultures.sort()).toEqual(['sumer', 'thebes']);
    expect(HISTORIC_SCENES.works.cultures.sort()).toEqual(['sumer', 'thebes']);
  });

  it('refuses what it cannot draw, naming what it can (a builder alone would fall back to Sumer)', () => {
    expect(() => historicOptions({ culture: 'rome' })).toThrow(/unknown culture 'rome' — one of 'sumer', 'thebes'/);
    expect(() => historicOptions({})).toThrow(/unknown culture/);
    expect(() => historicOptions({ culture: 'thebes', scene: 'harbour' })).toThrow(/unknown scene 'harbour' — one of 'city', 'region', 'farm', 'works'/);
    expect(() => historicOptions({ culture: 'giza', scene: 'region' })).toThrow(/giza has no 'region' scene — it has 'city'/);
    expect(() => historicOptions({ culture: 'sumer', scene: 'region', season: 'flood' })).toThrow(/one of 'harvest', 'sowing'/);
    expect(() => historicOptions({ culture: 'giza', season: 'flood' })).toThrow(/has no seasons/);
    expect(() => historicOptions({ culture: 'sumer', scene: 'farm', view: 'nowhere' })).toThrow(/no view 'nowhere' — one of 'aerial'/);
  });

  it('takes the seasons each land has: the Nile floods, the Sumerian canal does not', () => {
    expect(historicOptions({ culture: 'thebes', scene: 'region', season: 'flood' }).opts.season).toBe('flood');
    expect(historicOptions({ culture: 'thebes', scene: 'farm', season: 'flood' }).opts.season).toBe('flood');
    expect(() => historicOptions({ culture: 'sumer', scene: 'farm', season: 'flood' })).toThrow(/one of 'harvest', 'sowing'/);
  });

  it('defaults to the city at seed 1, and keeps an integer seed', () => {
    expect(historicOptions({ culture: 'qin' })).toEqual({ scene: 'city', opts: { culture: 'qin', seed: 1 } });
    expect(historicOptions({ culture: 'qin', seed: 7 }).opts.seed).toBe(7);
    expect(historicOptions({ culture: 'qin', seed: 'x' }).opts.seed).toBe(1);
  });

  it("lists a scene's views: the aerial, the town's approach, and the plan's own eye-level views", () => {
    const v = historicViews({ scene: 'farm', culture: 'sumer', seed: 1 });
    expect(v[0]).toBe('aerial');
    expect(v.length).toBeGreaterThan(1);
    expect(v).not.toContain('approach');
  });

  it('draws exactly what the builders draw (a manifest only names their options)', () => {
    const a = assembleHistoricKindScene({ culture: 'polis', seed: 3 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(assembleHistoricWorld({ culture: 'polis', seed: 3 })));
    const f = assembleHistoricKindScene({ culture: 'sumer', scene: 'farm', season: 'sowing' });
    const own = assembleFarmsteadScene({ culture: 'sumer', seed: 1, season: 'sowing' });
    expect(f.faces).toEqual(own.faces);
    expect(Object.keys(f.textures).length).toBeGreaterThan(0);
  });

  it("keeps the builder's title unless the row names its own", async () => {
    const own = await WORLD_KINDS.historic.resolve({ kind: 'historic', culture: 'polis' }, { title: 'mojulo historic' });
    expect(own.title).toMatch(/A Hellenistic polis/);
    const named = await WORLD_KINDS.historic.resolve({ kind: 'historic', culture: 'polis' }, { title: 'my polis' });
    expect(named.title).toBe('my polis');
  });
});
