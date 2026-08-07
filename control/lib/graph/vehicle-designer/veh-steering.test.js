import { describe, it, expect } from 'vitest';

import { planWorkbench } from '../worlds/workbench.js';
import { resolveVehChassisRecipe } from './veh-chassis.js';
import { planComponentFit } from './veh-garage.js';
import { generateVehSteeringVariants, listVehSteeringLanguage, resolveVehSteeringRecipe } from './veh-steering.js';

describe('resolveVehSteeringRecipe', () => {
  it('is deterministic and workbench-valid', () => {
    const a = resolveVehSteeringRecipe({ family: 'threeSpoke', palette: 'factorySteel', seed: 'wheel-01' });
    const b = resolveVehSteeringRecipe({ family: 'threeSpoke', palette: 'factorySteel', seed: 'wheel-01' });
    expect(b).toEqual(a);
    const { stats } = planWorkbench(a);
    expect(stats.lathes).toBe(2); // column + hub
    expect(stats.sweeps).toBe(a.sweeps.length);
    expect(a.garage.mountFamily).toBe('rail-mount');
  });

  it('builds the rim as a closed-loop sweep torus, not an open lathe ring', () => {
    const recipe = resolveVehSteeringRecipe({ family: 'threeSpoke', seed: 7 });
    const rim = recipe.sweeps.find((m) => m.id === 'steering_rim');
    expect(rim.path.length).toBe(17); // 16 segments, first point repeated to close
    expect(rim.path[0]).toEqual(rim.path[rim.path.length - 1]);
    expect(recipe.sweeps.filter((m) => m.id.startsWith('steering_spoke_'))).toHaveLength(3);
  });

  it('hangs on the driver side and rakes down-and-back from the rail', () => {
    const lhd = resolveVehSteeringRecipe({ family: 'threeSpoke', seed: 7 });
    const wc = lhd.garage.hardpoints.wheelCenter;
    expect(wc[0]).toBeCloseTo(-1.0, 3); // left-hand drive
    expect(wc[1]).toBeLessThan(0); // behind the rail (toward the driver)
    expect(wc[2]).toBeLessThan(0); // below the rail
    const rhd = resolveVehSteeringRecipe({ family: 'threeSpoke', seed: 7, overrides: { position: 'right' } });
    expect(rhd.garage.hardpoints.wheelCenter[0]).toBeCloseTo(1.0, 3);
  });

  it('gives the horn ring family its inner chrome ring', () => {
    const recipe = resolveVehSteeringRecipe({ family: 'hornRing', seed: 4 });
    expect(recipe.sweeps.some((m) => m.id === 'horn_ring')).toBe(true);
    expect(recipe.garage.modules.rimStyle).toBe('thin');
  });

  it('seats on the dash rail beside the dash and refuses a trailer', () => {
    const steering = resolveVehSteeringRecipe({ family: 'threeSpoke', seed: 'fitment' });
    const car = resolveVehChassisRecipe({ family: 'unibodyPan', seed: 'garage-test' });
    const { placements } = planComponentFit(steering, car);
    expect(placements[0].socket).toBe('dashRail');
    const trailer = resolveVehChassisRecipe({ family: 'towedFrame', seed: 'camper' });
    expect(() => planComponentFit(steering, trailer)).toThrow(/no dashRail socket/);
  });

  it('generates deterministic variants and exposes the shelf', () => {
    const a = generateVehSteeringVariants({ count: 4, seed: 'steering-line' });
    expect(generateVehSteeringVariants({ count: 4, seed: 'steering-line' })).toEqual(a);
    for (const recipe of a) expect(recipe.garage.modules.position).toBe('left');
    const language = listVehSteeringLanguage();
    expect(language.modules.spokes).toEqual(['two', 'three', 'four']);
  });

  it('throws clear errors', () => {
    expect(() => resolveVehSteeringRecipe({ family: 'banana' })).toThrow(/Unknown veh-steering family/);
    expect(() => resolveVehSteeringRecipe({ colors: { rim: '#000000' } })).toThrow(/Unknown veh-steering color role/);
  });
});
