import { describe, it, expect } from 'vitest';

import { planWorkbench } from '../worlds/workbench.js';
import { resolveVehChassisRecipe } from './veh-chassis.js';
import { planComponentFit } from './veh-garage.js';
import { generateVehDashVariants, listVehDashLanguage, resolveVehDashRecipe } from './veh-dash.js';

describe('resolveVehDashRecipe', () => {
  it('is deterministic and workbench-valid', () => {
    const a = resolveVehDashRecipe({ family: 'slabCluster', palette: 'factorySteel', seed: 'dash-01' });
    const b = resolveVehDashRecipe({ family: 'slabCluster', palette: 'factorySteel', seed: 'dash-01' });
    expect(b).toEqual(a);
    const { stats } = planWorkbench(a);
    expect(stats.monomers).toBeGreaterThanOrEqual(2);
    expect(a.garage.mountFamily).toBe('rail-mount');
  });

  it('puts the cluster on the driver side and flips for right-hand drive', () => {
    const lhd = resolveVehDashRecipe({ family: 'slabCluster', seed: 7 });
    const binnacleL = lhd.extrudes.find((m) => m.id === 'cluster_binnacle');
    expect((binnacleL.axisFrom.x + binnacleL.axisTo.x) / 2).toBeLessThan(0);
    expect(lhd.garage.localFrame.driver).toBe('-x');
    const rhd = resolveVehDashRecipe({ family: 'slabCluster', seed: 7, overrides: { position: 'right' } });
    const binnacleR = rhd.extrudes.find((m) => m.id === 'cluster_binnacle');
    expect((binnacleR.axisFrom.x + binnacleR.axisTo.x) / 2).toBeGreaterThan(0);
  });

  it('renders vintage gauges as self-closing glass lathes', () => {
    const recipe = resolveVehDashRecipe({ family: 'vintageGauges', seed: 9 });
    const gauges = recipe.lathes.filter((m) => m.id.startsWith('gauge_'));
    expect(gauges).toHaveLength(2);
    for (const g of gauges) {
      expect(g.tint).toBe(recipe.garage.colors.glass);
      expect(g.profile[g.profile.length - 1].radius).toBeLessThanOrEqual(0.08);
    }
  });

  it('seats on the dash rail and refuses a trailer', () => {
    const dash = resolveVehDashRecipe({ family: 'slabCluster', seed: 'fitment' });
    const car = resolveVehChassisRecipe({ family: 'unibodyPan', seed: 'garage-test' });
    const { placements } = planComponentFit(dash, car);
    expect(placements[0].socket).toBe('dashRail');
    expect(placements[0].at[2]).toBeCloseTo(2.6, 3);
    const trailer = resolveVehChassisRecipe({ family: 'towedFrame', seed: 'camper' });
    expect(() => planComponentFit(dash, trailer)).toThrow(/no dashRail socket/);
  });

  it('generates deterministic variants that never randomize the driving position', () => {
    const a = generateVehDashVariants({ count: 6, seed: 'dash-line' });
    expect(generateVehDashVariants({ count: 6, seed: 'dash-line' })).toEqual(a);
    for (const recipe of a) expect(recipe.garage.modules.position).toBe('left');
    const language = listVehDashLanguage();
    expect(language.modules.position).toEqual(['left', 'right']);
  });

  it('throws clear errors', () => {
    expect(() => resolveVehDashRecipe({ family: 'banana' })).toThrow(/Unknown veh-dash family/);
    expect(() => resolveVehDashRecipe({ palette: 'banana' })).toThrow(/Unknown veh-dash palette/);
  });
});
