import { describe, it, expect } from 'vitest';

import { planWorkbench } from '../worlds/workbench.js';
import { resolveVehChassisRecipe } from './veh-chassis.js';
import { planComponentFit } from './veh-garage.js';
import { generateVehEngineVariants, listVehEngineLanguage, resolveVehEngineRecipe } from './veh-engine.js';

describe('resolveVehEngineRecipe', () => {
  it('is deterministic for the same family/palette/seed', () => {
    const a = resolveVehEngineRecipe({ family: 'inlineFour', palette: 'factorySteel', seed: 'motor-01' });
    const b = resolveVehEngineRecipe({ family: 'inlineFour', palette: 'factorySteel', seed: 'motor-01' });
    expect(b).toEqual(a);
  });

  it('produces a workbench-valid dressed inline four within the fidelity floor', () => {
    const recipe = resolveVehEngineRecipe({ family: 'inlineFour', palette: 'factorySteel', seed: 7 });
    const { stats } = planWorkbench(recipe);
    expect(stats.monomers).toBeGreaterThanOrEqual(5);
    expect(stats.monomers).toBeLessThanOrEqual(9); // block + head + intake, not a greeble festival
    expect(recipe.extrudes.map((m) => m.id)).toEqual(expect.arrayContaining(['oil_pan', 'block', 'head', 'valve_cover']));
    expect(recipe.sweeps.some((m) => m.id === 'intake_log')).toBe(true);
    expect(recipe.lathes.some((m) => m.id === 'crank_pulley')).toBe(true);
    expect(recipe.garage.kind).toBe('veh-engine');
    expect(recipe.garage.mountFamily).toBe('bay-mount');
    expect(recipe.garage.hardpoints.mount).toEqual([0, 0, 0]);
    expect(recipe.garage.localFrame.crank).toBe('y');
  });

  it('produces a vee eight with two angled banks and a valley plenum', () => {
    const recipe = resolveVehEngineRecipe({ family: 'veeEight', palette: 'murderedOut', seed: 8 });
    const { stats } = planWorkbench(recipe);
    expect(stats.monomers).toBeGreaterThanOrEqual(6);
    expect(recipe.extrudes.some((m) => m.id === 'bank_a')).toBe(true);
    expect(recipe.extrudes.some((m) => m.id === 'bank_b')).toBe(true);
    expect(recipe.extrudes.some((m) => m.id === 'valley_plenum')).toBe(true);
    expect(recipe.sweeps.filter((m) => m.id.startsWith('exhaust_manifold'))).toHaveLength(2);
    // big displacement → wider than an inline
    expect(recipe.garage.dims.width).toBeGreaterThan(1.7);
  });

  it('produces vintage velocity stacks as self-closing chrome lathes', () => {
    const recipe = resolveVehEngineRecipe({ family: 'vintageStacks', seed: 'hot-rod' });
    const stacks = recipe.lathes.filter((m) => m.id.startsWith('stack_'));
    expect(stacks).toHaveLength(4);
    for (const s of stacks) {
      expect(s.profile[0].radius).toBeLessThanOrEqual(0.08); // self-closed base
      expect(s.profile[s.profile.length - 1].radius).toBeLessThanOrEqual(0.08); // self-closed tip
    }
    expect(recipe.extrudes.some((m) => m.id === 'valley_plenum')).toBe(false);
  });

  it('turns the crank across x for a transverse engine', () => {
    const recipe = resolveVehEngineRecipe({ family: 'transverseFour', seed: 4 });
    expect(recipe.garage.localFrame.crank).toBe('x');
    // block is wider (x) than long (y)
    expect(recipe.garage.dims.width).toBeGreaterThan(recipe.garage.dims.length);
    expect(recipe.garage.hardpoints.driveOutput[0]).toBeLessThan(0);
  });

  it('seats in a unibody engine bay via planComponentFit and refuses a trailer', () => {
    const engine = resolveVehEngineRecipe({ family: 'inlineFour', seed: 'fitment' });
    const chassis = resolveVehChassisRecipe({ family: 'unibodyPan', palette: 'factorySteel', seed: 'garage-test' });
    const { placements, warnings } = planComponentFit(engine, chassis);
    expect(warnings).toEqual([]);
    expect(placements).toHaveLength(1);
    expect(placements[0].socket).toBe('engineBay');
    expect(placements[0].at[0]).toBeCloseTo(0, 3);
    expect(placements[0].at[1]).toBeGreaterThan(3.5); // forward of the front axle midline
    expect(placements[0].at[2]).toBeCloseTo(1.5, 3); // deck height
    const trailer = resolveVehChassisRecipe({ family: 'towedFrame', seed: 'camper' });
    expect(() => planComponentFit(engine, trailer)).toThrow(/no engineBay socket/);
  });

  it('lets callers override modules while preserving the family shelf', () => {
    const recipe = resolveVehEngineRecipe({
      family: 'inlineFour',
      seed: 33,
      overrides: { intake: 'stacks', valveCover: 'chrome', displacement: 'big' },
    });
    expect(recipe.garage.family).toBe('inlineFour');
    expect(recipe.lathes.filter((m) => m.id.startsWith('stack_'))).toHaveLength(4);
    expect(recipe.sweeps.some((m) => m.id === 'intake_log')).toBe(false);
    expect(recipe.garage.dims.length).toBeCloseTo(1.6 * 1.15, 3);
  });

  it('can generate deterministic seeded random variants', () => {
    const a = generateVehEngineVariants({ count: 5, seed: 'engine-line', randomize: true });
    const b = generateVehEngineVariants({ count: 5, seed: 'engine-line', randomize: true });
    expect(b).toEqual(a);
    expect(new Set(a.map((recipe) => JSON.stringify(recipe.garage.modules))).size).toBeGreaterThan(1);
    for (const recipe of a) {
      const { stats } = planWorkbench(recipe);
      expect(stats.monomers).toBeGreaterThan(0);
    }
  });

  it('exposes the composable engine module shelf', () => {
    const language = listVehEngineLanguage();
    expect(language.families).toHaveProperty('inlineFour');
    expect(language.families).toHaveProperty('veeEight');
    expect(language.families).toHaveProperty('vintageStacks');
    expect(language.modules.layout).toEqual(['inline', 'vee', 'transverse']);
    expect(language.modules.intake).toEqual(['plenum', 'stacks']);
    expect(language.colorRoles).toEqual(['paint', 'trim', 'glass', 'rubber', 'chrome', 'light']);
  });

  it('throws clear errors for unknown families, palettes, or colors', () => {
    expect(() => resolveVehEngineRecipe({ family: 'banana' })).toThrow(/Unknown veh-engine family/);
    expect(() => resolveVehEngineRecipe({ palette: 'banana' })).toThrow(/Unknown veh-engine palette/);
    expect(() => resolveVehEngineRecipe({ colors: { trim: 'iron' } })).toThrow(/#RRGGBB/);
    expect(() => resolveVehEngineRecipe({ colors: { lens: '#ff0000' } })).toThrow(/Unknown veh-engine color role/);
  });
});
