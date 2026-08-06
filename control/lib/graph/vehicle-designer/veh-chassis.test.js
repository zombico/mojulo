import { describe, it, expect } from 'vitest';

import { planWorkbench } from '../worlds/workbench.js';
import { generateVehChassisVariants, listVehChassisLanguage, resolveVehChassisRecipe } from './veh-chassis.js';

describe('resolveVehChassisRecipe', () => {
  it('is deterministic for the same family/palette/seed', () => {
    const a = resolveVehChassisRecipe({ family: 'unibodyPan', palette: 'factorySteel', seed: 'platform-01' });
    const b = resolveVehChassisRecipe({ family: 'unibodyPan', palette: 'factorySteel', seed: 'platform-01' });
    expect(b).toEqual(a);
  });

  it('produces a workbench-valid unibody pan at ride height', () => {
    const recipe = resolveVehChassisRecipe({ family: 'unibodyPan', palette: 'factorySteel', seed: 7 });
    const { stats } = planWorkbench(recipe);
    expect(stats.lathes).toBe(recipe.lathes.length);
    expect(stats.extrudes).toBe(recipe.extrudes.length);
    expect(stats.monomers).toBeGreaterThanOrEqual(12);
    // standard wheelbase 8 + overhangs ≈ 10.6 long, track 4.9 wide
    expect(stats.size.d).toBeGreaterThan(9);
    expect(stats.size.w).toBeGreaterThan(4.5);
    expect(recipe.garage.kind).toBe('veh-chassis');
    expect(recipe.garage.mountFamily).toBeNull();
    expect(recipe.garage.provides).toContain('hub-mount');
    expect(recipe.garage.dims.wheelbase).toBeCloseTo(8, 3);
    expect(recipe.garage.dims.hubZ).toBeCloseTo(1, 3);
    expect(recipe.garage.hardpoints.frontAxle).toEqual([0, 4, 1]);
    expect(recipe.garage.hardpoints.rearAxle).toEqual([0, -4, 1]);
  });

  it('produces a ladder frame with rails, crossmembers, and bumpers', () => {
    const recipe = resolveVehChassisRecipe({ family: 'ladderFrame', palette: 'murderedOut', seed: 3 });
    const { stats } = planWorkbench(recipe);
    expect(stats.monomers).toBeGreaterThanOrEqual(10);
    expect(recipe.extrudes.filter((m) => m.id.startsWith('rail_'))).toHaveLength(2);
    expect(recipe.extrudes.filter((m) => m.id.startsWith('crossmember_'))).toHaveLength(4);
    expect(recipe.extrudes.some((m) => m.id === 'bumper_front')).toBe(true);
    expect(recipe.garage.modules.frame).toBe('ladder');
    expect(recipe.garage.dims.wheelbase).toBeCloseTo(9.5, 3);
  });

  it('produces a towed frame with a tongue and hitch but no front bumper', () => {
    const recipe = resolveVehChassisRecipe({ family: 'towedFrame', seed: 'camper' });
    const { stats } = planWorkbench(recipe);
    expect(stats.sweeps).toBe(2);
    expect(recipe.lathes.some((m) => m.id === 'hitch_ball')).toBe(true);
    expect(recipe.extrudes.some((m) => m.id === 'bumper_front')).toBe(false);
    expect(recipe.garage.modules.nose).toBe('tongue');
    expect(recipe.garage.provides).toContain('hitch');
  });

  it('always carries exactly four axle stubs regardless of family', () => {
    for (const family of ['ladderFrame', 'unibodyPan', 'sportPan', 'towedFrame']) {
      const recipe = resolveVehChassisRecipe({ family, seed: 11 });
      const stubs = recipe.lathes.filter((m) => m.axisFrom.y === m.axisTo.y && m.axisFrom.z === m.axisTo.z && m.axisFrom.x !== m.axisTo.x);
      expect(stubs).toHaveLength(4);
    }
  });

  it('lets callers override modules while preserving the family shelf', () => {
    const recipe = resolveVehChassisRecipe({
      family: 'unibodyPan',
      seed: 33,
      overrides: { wheelbase: 'long', rideHeight: 'low', track: 'wide' },
    });
    expect(recipe.garage.family).toBe('unibodyPan');
    expect(recipe.garage.dims.wheelbase).toBeCloseTo(9.5, 3);
    expect(recipe.garage.dims.track).toBeCloseTo(5.6, 3);
    expect(recipe.garage.dims.clearance).toBeCloseTo(0.15, 3);
  });

  it('can generate deterministic seeded random variants', () => {
    const a = generateVehChassisVariants({ count: 5, seed: 'platform-line', randomize: true });
    const b = generateVehChassisVariants({ count: 5, seed: 'platform-line', randomize: true });
    expect(b).toEqual(a);
    expect(new Set(a.map((recipe) => JSON.stringify(recipe.garage.modules))).size).toBeGreaterThan(1);
    for (const recipe of a) {
      const { stats } = planWorkbench(recipe);
      expect(stats.monomers).toBeGreaterThan(0);
    }
  });

  it('exposes the composable chassis module shelf', () => {
    const language = listVehChassisLanguage();
    expect(language.families).toHaveProperty('ladderFrame');
    expect(language.families).toHaveProperty('towedFrame');
    expect(language.modules.frame).toEqual(['ladder', 'unibody']);
    expect(language.modules.nose).toEqual(['engine', 'tongue']);
    expect(language.colorRoles).toEqual(['paint', 'trim', 'glass', 'rubber', 'chrome', 'light']);
  });

  it('throws clear errors for unknown families, palettes, or colors', () => {
    expect(() => resolveVehChassisRecipe({ family: 'banana' })).toThrow(/Unknown veh-chassis family/);
    expect(() => resolveVehChassisRecipe({ palette: 'banana' })).toThrow(/Unknown veh-chassis palette/);
    expect(() => resolveVehChassisRecipe({ colors: { trim: 'gray' } })).toThrow(/#RRGGBB/);
    expect(() => resolveVehChassisRecipe({ colors: { shell: '#ff0000' } })).toThrow(/Unknown veh-chassis color role/);
  });
});
