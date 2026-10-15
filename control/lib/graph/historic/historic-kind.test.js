import { describe, it, expect } from 'vitest';
import { HISTORIC_SCENES, historicOptions, historicViews, historicFoci, assembleHistoricKindScene } from './historic-kind.js';
import { HISTORIC_CULTURES, assembleHistoricWorld } from './historic-city.js';
import { WORLD_KINDS } from '../worlds/world-kinds.js';
import { WALKABLE_WORLD_KINDS, sketchRenderMode } from '../sketch/sketch-manifest.js';

describe('the historic world kind', () => {
  it('is registered, walkable and rendered on the World page', () => {
    expect(WORLD_KINDS.historic.walk).toBe(true);
    expect(WALKABLE_WORLD_KINDS).toContain('historic');
    expect(sketchRenderMode({ kind: 'historic', culture: 'thebes' })).toBe('world');
  });

  it('solves every culture at every scale: the town, its region, a slice of life', () => {
    expect(Object.keys(HISTORIC_SCENES)).toEqual(['city', 'region', 'slice']);
    for (const s of Object.values(HISTORIC_SCENES)) expect(s.cultures).toEqual(Object.keys(HISTORIC_CULTURES));
  });

  it('refuses what it cannot draw, naming what it can (a builder alone would fall back to Sumer)', () => {
    expect(() => historicOptions({ culture: 'rome' })).toThrow(/unknown culture 'rome' — one of 'sumer', 'thebes'/);
    expect(() => historicOptions({})).toThrow(/unknown culture/);
    expect(() => historicOptions({ culture: 'thebes', scene: 'farm' })).toThrow(/unknown scene 'farm' — one of 'city', 'region', 'slice'/);
    expect(() => historicOptions({ culture: 'thebes', focus: 'farmstead' })).toThrow(/the 'city' scene has none/);
    expect(() => historicOptions({ culture: 'thebes', scene: 'slice', focus: 'nowhere' })).toThrow(/no slice of life round 'nowhere' — one of 'street'/);
    expect(() => historicOptions({ culture: 'thebes', view: 'nowhere' })).toThrow(/no view 'nowhere' — one of 'aerial'/);
  });

  it('takes a form: any part of the culture\'s town, checked by name', () => {
    expect(historicOptions({ culture: 'thebes', form: { streets: { jog: 0 } } }).opts.form).toEqual({ streets: { jog: 0 } });
    expect(() => historicOptions({ culture: 'thebes', form: { streets: { wiggle: 1 } } })).toThrow(/form.streets.wiggle is not a setting/);
    expect(() => historicOptions({ culture: 'thebes', form: 'dense' })).toThrow(/form is \{ …changes \}/);
  });

  it('defaults to the city at seed 1, and keeps an integer seed', () => {
    expect(historicOptions({ culture: 'qin' })).toEqual({ scene: 'city', opts: { culture: 'qin', scene: 'city', seed: 1 } });
    expect(historicOptions({ culture: 'qin', seed: 7 }).opts.seed).toBe(7);
    expect(historicOptions({ culture: 'qin', seed: 'x' }).opts.seed).toBe(1);
  });

  it("lists a scene's views and a slice's foci", () => {
    const v = historicViews({ culture: 'sumer', scene: 'city' });
    expect(v.slice(0, 2)).toEqual(['aerial', 'approach']);
    expect(v.length).toBeGreaterThan(2);
    expect(historicFoci({ culture: 'sumer' })).toContain('street');
  });

  it('draws exactly what the solver and the emitter draw (a manifest only names their options)', () => {
    const a = assembleHistoricKindScene({ culture: 'polis', seed: 3 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(assembleHistoricWorld({ culture: 'polis', scene: 'city', seed: 3 })));
  });

  it("keeps the builder's title unless the row names its own", async () => {
    const own = await WORLD_KINDS.historic.resolve({ kind: 'historic', culture: 'polis' }, { title: 'mojulo historic' });
    expect(own.title).toMatch(/A Hellenistic polis/);
    const named = await WORLD_KINDS.historic.resolve({ kind: 'historic', culture: 'polis' }, { title: 'my polis' });
    expect(named.title).toBe('my polis');
  });
});
