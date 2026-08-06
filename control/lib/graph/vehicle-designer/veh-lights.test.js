import { describe, it, expect } from 'vitest';

import { planWorkbench } from '../worlds/workbench.js';
import { generateVehLightsVariants, listVehLightsLanguage, resolveVehLightsRecipe } from './veh-lights.js';

describe('resolveVehLightsRecipe', () => {
  it('is deterministic and workbench-valid', () => {
    const a = resolveVehLightsRecipe({ family: 'roundDuo', palette: 'vintageCream', seed: 'lamps-01' });
    expect(resolveVehLightsRecipe({ family: 'roundDuo', palette: 'vintageCream', seed: 'lamps-01' })).toEqual(a);
    const { stats } = planWorkbench(a);
    expect(stats.lathes).toBe(4); // two bezels + two lenses
    expect(a.garage.mountFamily).toBeNull();
  });

  it('builds a duo as bezel + self-closing lens per side, facing +y', () => {
    const recipe = resolveVehLightsRecipe({ family: 'roundDuo', seed: 7 });
    const lensL = recipe.lathes.find((m) => m.id === 'lens_l');
    expect(lensL.tint).toBe(recipe.garage.colors.light);
    expect(lensL.profile[lensL.profile.length - 1].radius).toBeLessThanOrEqual(0.08);
    expect(lensL.axisTo.y).toBeGreaterThan(lensL.axisFrom.y); // lens points forward
  });

  it('makes tail lamps smaller via the function module, same light role', () => {
    const head = resolveVehLightsRecipe({ family: 'roundDuo', seed: 7 });
    const tail = resolveVehLightsRecipe({ family: 'roundDuo', seed: 7, overrides: { function: 'tail' } });
    expect(tail.garage.dims.lensRadius).toBeLessThan(head.garage.dims.lensRadius);
  });

  it('builds the bar family as a single light-role extrude', () => {
    const recipe = resolveVehLightsRecipe({ family: 'barSingle', seed: 2 });
    expect(recipe.extrudes).toHaveLength(1);
    expect(recipe.extrudes[0].tint).toBe(recipe.garage.colors.light);
  });

  it('generates deterministic variants that never randomize head/tail', () => {
    const a = generateVehLightsVariants({ count: 5, seed: 'lamp-line' });
    expect(generateVehLightsVariants({ count: 5, seed: 'lamp-line' })).toEqual(a);
    for (const r of a) expect(r.garage.modules.function).toBe('head');
    expect(listVehLightsLanguage().modules.function).toEqual(['head', 'tail']);
    expect(() => resolveVehLightsRecipe({ family: 'banana' })).toThrow(/Unknown veh-lights family/);
  });
});
