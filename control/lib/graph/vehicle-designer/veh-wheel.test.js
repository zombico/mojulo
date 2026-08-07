import { describe, it, expect } from 'vitest';

import { planWorkbench } from '../worlds/workbench.js';
import { generateVehWheelVariants, listVehWheelLanguage, resolveVehWheelRecipe } from './veh-wheel.js';

describe('resolveVehWheelRecipe', () => {
  it('is deterministic for the same family/palette/seed', () => {
    const a = resolveVehWheelRecipe({ family: 'steelie', palette: 'factorySteel', seed: 'axle-front-left' });
    const b = resolveVehWheelRecipe({ family: 'steelie', palette: 'factorySteel', seed: 'axle-front-left' });
    expect(b).toEqual(a);
  });

  it('produces a workbench-valid steelie with a dome cap', () => {
    const recipe = resolveVehWheelRecipe({ family: 'steelie', palette: 'factorySteel', seed: 7 });
    const { stats } = planWorkbench(recipe);
    expect(stats.lathes).toBe(recipe.lathes.length);
    expect(stats.monomers).toBeGreaterThanOrEqual(4);
    // wheel diameter reads in y/z; standard radius 1.0 → ~2.0 tall
    expect(stats.size.h).toBeGreaterThan(1.8);
    expect(recipe.garage.kind).toBe('veh-wheel');
    expect(recipe.garage.mountFamily).toBe('hub-mount');
    expect(recipe.garage.hardpoints.hubCenter).toEqual([0, 0, 1]);
    expect(recipe.garage.hardpoints.contactPatch).toEqual([0, 0, 0]);
    expect(recipe.garage.dims.radius).toBeCloseTo(1.0, 3);
  });

  it('produces a five-spoke alloy with chrome spoke extrudes', () => {
    const recipe = resolveVehWheelRecipe({ family: 'fiveSpokeAlloy', palette: 'chromeAlloy', seed: 12 });
    const { stats } = planWorkbench(recipe);
    expect(stats.lathes).toBe(recipe.lathes.length);
    expect(stats.extrudes).toBe(recipe.extrudes.length);
    expect(recipe.extrudes.filter((m) => m.id.startsWith('spoke_'))).toHaveLength(5);
    expect(recipe.garage.modules.rimStyle).toBe('fiveSpoke');
    expect(recipe.garage.modules.sidewall).toBe('lowProfile');
  });

  it('produces a whitewall wire wheel defaulting to the vintage palette', () => {
    const recipe = resolveVehWheelRecipe({ family: 'wireVintage', seed: 'sunday-cruiser' });
    const { stats } = planWorkbench(recipe);
    expect(stats.monomers).toBeGreaterThanOrEqual(12);
    expect(recipe.garage.palette).toBe('vintageCream');
    expect(recipe.lathes.some((m) => m.id === 'sidewall_band')).toBe(true);
    expect(recipe.extrudes.filter((m) => m.id.startsWith('wire_spoke_'))).toHaveLength(8);
    expect(recipe.extrudes.filter((m) => m.id.startsWith('spinner_ear_'))).toHaveLength(3);
    // tall size → bigger wheel
    expect(stats.size.h).toBeGreaterThan(2.1);
  });

  it('produces a heavy-duty deep dish with a lug ring', () => {
    const recipe = resolveVehWheelRecipe({ family: 'heavyDuty', palette: 'murderedOut', seed: 3 });
    const { stats } = planWorkbench(recipe);
    expect(stats.monomers).toBeGreaterThanOrEqual(9);
    expect(stats.size.h).toBeGreaterThan(2.5);
    expect(recipe.extrudes.filter((m) => m.id.startsWith('lug_nut_'))).toHaveLength(6);
    expect(recipe.garage.modules.rimStyle).toBe('deepDish');
    expect(recipe.garage.dims.radius).toBeCloseTo(1.35, 3);
  });

  it('lets callers override modules while preserving the family shelf', () => {
    const recipe = resolveVehWheelRecipe({
      family: 'steelie',
      palette: 'factorySteel',
      seed: 33,
      overrides: { hub: 'spinner', sidewallBand: 'whitewall', size: 'tall' },
    });
    expect(recipe.garage.family).toBe('steelie');
    expect(recipe.garage.modules.hub).toBe('spinner');
    expect(recipe.garage.modules.sidewallBand).toBe('whitewall');
    expect(recipe.garage.dims.radius).toBeCloseTo(1.15, 3);
    expect(recipe.lathes.some((m) => m.id === 'sidewall_band')).toBe(true);
    expect(recipe.lathes.some((m) => m.id === 'spinner_dome')).toBe(true);
    expect(recipe.lathes.some((m) => m.id === 'hub_dome_cap')).toBe(false);
  });

  it('lets callers override color roles without changing geometry modules', () => {
    const recipe = resolveVehWheelRecipe({
      family: 'steelie',
      palette: 'factorySteel',
      seed: 7,
      colors: { paint: '#8a2f27', chrome: '#eef2f6', rubber: '#101112' },
    });
    const { stats } = planWorkbench(recipe);
    expect(stats.monomers).toBeGreaterThan(0);
    expect(recipe.garage.palette).toBe('factorySteel');
    expect(recipe.garage.colors.paint).toBe('#8a2f27');
    expect(recipe.garage.colors.chrome).toBe('#eef2f6');
    expect(recipe.garage.colors.rubber).toBe('#101112');
    expect(recipe.garage.modules.rimStyle).toBe('steel');
  });

  it('accepts inline palette objects for custom wheel colors', () => {
    const recipe = resolveVehWheelRecipe({
      family: 'fiveSpokeAlloy',
      seed: 'custom-color',
      palette: { id: 'brassEra', base: 'vintageCream', chrome: '#c9a44a', paint: '#2b3a2e' },
      colors: { trim: '#efe4c8' },
    });
    expect(recipe.garage.palette).toBe('brassEra');
    expect(recipe.garage.colors.chrome).toBe('#c9a44a');
    expect(recipe.garage.colors.paint).toBe('#2b3a2e');
    expect(recipe.garage.colors.trim).toBe('#efe4c8');
  });

  it('can generate deterministic seeded random variants', () => {
    const a = generateVehWheelVariants({ count: 5, seed: 'wheel-rack', randomize: true });
    const b = generateVehWheelVariants({ count: 5, seed: 'wheel-rack', randomize: true });
    expect(b).toEqual(a);
    expect(a).toHaveLength(5);
    expect(new Set(a.map((recipe) => JSON.stringify(recipe.garage.modules))).size).toBeGreaterThan(1);
    for (const recipe of a) {
      const { stats } = planWorkbench(recipe);
      expect(stats.monomers).toBeGreaterThan(0);
      expect(recipe.garage.randomize).toBe(true);
    }
  });

  it('exposes the composable wheel module shelf', () => {
    const language = listVehWheelLanguage();
    expect(language.families).toHaveProperty('steelie');
    expect(language.families).toHaveProperty('fiveSpokeAlloy');
    expect(language.families).toHaveProperty('wireVintage');
    expect(language.families).toHaveProperty('heavyDuty');
    expect(language.modules.rimStyle).toEqual(['steel', 'fiveSpoke', 'wire', 'deepDish']);
    expect(language.modules.sidewall).toEqual(['lowProfile', 'standard', 'tall']);
    expect(language.colorRoles).toEqual(['paint', 'trim', 'glass', 'rubber', 'chrome', 'light']);
  });

  it('throws clear errors for unknown families or palettes', () => {
    expect(() => resolveVehWheelRecipe({ family: 'banana' })).toThrow(/Unknown veh-wheel family/);
    expect(() => resolveVehWheelRecipe({ palette: 'banana' })).toThrow(/Unknown veh-wheel palette/);
    expect(() => resolveVehWheelRecipe({ colors: { rubber: 'black' } })).toThrow(/#RRGGBB/);
    expect(() => resolveVehWheelRecipe({ colors: { shell: '#ff0000' } })).toThrow(/Unknown veh-wheel color role/);
  });
});
