import { describe, it, expect } from 'vitest';

import { planWorkbench } from '../worlds/workbench.js';
import { resolveVehChassisRecipe } from './veh-chassis.js';
import { planComponentFit } from './veh-garage.js';
import { generateVehCabinVariants, listVehCabinLanguage, resolveVehCabinRecipe } from './veh-cabin.js';

describe('resolveVehCabinRecipe', () => {
  it('is deterministic and workbench-valid', () => {
    const a = resolveVehCabinRecipe({ family: 'bucketsTwo', palette: 'factorySteel', seed: 'interior-01' });
    const b = resolveVehCabinRecipe({ family: 'bucketsTwo', palette: 'factorySteel', seed: 'interior-01' });
    expect(b).toEqual(a);
    const { stats } = planWorkbench(a);
    expect(stats.extrudes).toBe(a.extrudes.length);
    expect(a.garage.mountFamily).toBe('deck-mount');
  });

  it('builds a bench as one wide seat and buckets as two', () => {
    const bench = resolveVehCabinRecipe({ family: 'benchFront', seed: 3 });
    expect(bench.extrudes.filter((m) => m.id.endsWith('_cushion'))).toHaveLength(1);
    const buckets = resolveVehCabinRecipe({ family: 'bucketsTwo', seed: 3 });
    expect(buckets.extrudes.filter((m) => m.id.endsWith('_cushion'))).toHaveLength(2);
    expect(buckets.extrudes.filter((m) => m.id.endsWith('_headrest'))).toHaveLength(2);
  });

  it('adds a rear bench for two rows', () => {
    const recipe = resolveVehCabinRecipe({ family: 'twoPlusTwo', seed: 5 });
    expect(recipe.extrudes.some((m) => m.id.startsWith('rear_bench'))).toBe(true);
    expect(recipe.garage.dims.depth).toBeGreaterThan(3);
  });

  it('seats on the cabin deck of a car AND of a trailer - a caravan has furniture', () => {
    const cabin = resolveVehCabinRecipe({ family: 'benchFront', seed: 'fitment' });
    const car = resolveVehChassisRecipe({ family: 'unibodyPan', seed: 'garage-test' });
    const carFit = planComponentFit(cabin, car);
    expect(carFit.placements[0].socket).toBe('cabinDeck');
    expect(carFit.placements[0].at[2]).toBeCloseTo(1.5, 3);
    const trailer = resolveVehChassisRecipe({ family: 'towedFrame', seed: 'camper' });
    const trailerFit = planComponentFit(cabin, trailer);
    expect(trailerFit.placements[0].socket).toBe('cabinDeck');
  });

  it('generates deterministic variants and exposes the shelf', () => {
    const a = generateVehCabinVariants({ count: 4, seed: 'cabin-line' });
    expect(generateVehCabinVariants({ count: 4, seed: 'cabin-line' })).toEqual(a);
    const language = listVehCabinLanguage();
    expect(language.modules.seating).toEqual(['bench', 'buckets']);
    expect(language.colorRoles).toContain('trim');
  });

  it('throws clear errors', () => {
    expect(() => resolveVehCabinRecipe({ family: 'banana' })).toThrow(/Unknown veh-cabin family/);
    expect(() => resolveVehCabinRecipe({ colors: { seatColor: '#ff0000' } })).toThrow(/Unknown veh-cabin color role/);
  });
});
