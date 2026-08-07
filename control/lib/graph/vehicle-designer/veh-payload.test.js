import { describe, it, expect } from 'vitest';

import { planWorkbench } from '../worlds/workbench.js';
import { resolveVehChassisRecipe } from './veh-chassis.js';
import { deriveBaySockets, planComponentFit } from './veh-garage.js';
import { generateVehPayloadVariants, listVehPayloadLanguage, resolveVehPayloadRecipe } from './veh-payload.js';

describe('resolveVehPayloadRecipe', () => {
  it('is deterministic and workbench-valid', () => {
    const a = resolveVehPayloadRecipe({ family: 'pickupBed', palette: 'factorySteel', seed: 'bed-01' });
    expect(resolveVehPayloadRecipe({ family: 'pickupBed', palette: 'factorySteel', seed: 'bed-01' })).toEqual(a);
    const { stats } = planWorkbench(a);
    expect(stats.monomers).toBeGreaterThan(0);
    expect(a.garage.mountFamily).toBe('rear-mount');
  });

  it('builds the pickup bed as one open-top shell extrude', () => {
    const recipe = resolveVehPayloadRecipe({ family: 'pickupBed', seed: 3 });
    const bed = recipe.extrudes.find((m) => m.id === 'bed_shell');
    expect(bed.wallThickness).toBeCloseTo(0.15, 3);
    expect(bed.openFace).toBe('to');
  });

  it('gives each truck form its signature part', () => {
    expect(resolveVehPayloadRecipe({ family: 'flatbedDeck', seed: 1 }).extrudes.some((m) => m.id === 'headboard')).toBe(true);
    expect(resolveVehPayloadRecipe({ family: 'boxVan', seed: 1 }).extrudes.some((m) => m.id === 'cargo_box')).toBe(true);
    const tow = resolveVehPayloadRecipe({ family: 'towBoom', seed: 1 });
    expect(tow.sweeps.some((m) => m.id === 'tow_boom')).toBe(true);
    expect(tow.lathes.some((m) => m.id === 'winch_drum')).toBe(true);
  });

  it('seats on the rearDeck socket of any chassis - trucks, cars, and trailers alike', () => {
    const payload = resolveVehPayloadRecipe({ family: 'pickupBed', seed: 'fitment' });
    const ladder = resolveVehChassisRecipe({ family: 'ladderFrame', seed: 'work-truck' });
    const { placements } = planComponentFit(payload, ladder);
    expect(placements[0].socket).toBe('rearDeck');
    expect(placements[0].at[1]).toBeCloseTo(-4.75, 3); // ladderFrame rear axle (wheelbase 9.5)
    const trailer = resolveVehChassisRecipe({ family: 'towedFrame', seed: 'camper' });
    expect(deriveBaySockets(trailer).rearDeck).toBeDefined();
    expect(planComponentFit(payload, trailer).placements[0].socket).toBe('rearDeck');
  });

  it('generates deterministic variants and throws clear errors', () => {
    const a = generateVehPayloadVariants({ count: 4, seed: 'payload-line' });
    expect(generateVehPayloadVariants({ count: 4, seed: 'payload-line' })).toEqual(a);
    expect(listVehPayloadLanguage().modules.form).toEqual(['bed', 'flat', 'box', 'boom']);
    expect(() => resolveVehPayloadRecipe({ family: 'banana' })).toThrow(/Unknown veh-payload family/);
  });
});
