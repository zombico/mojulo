import { describe, expect, it } from 'vitest';

import { createWorld, stepWorld } from '../worlds/controllable-world.js';
import { deriveDrivetrain } from './drivetrain.js';
import { resolveVehEngineRecipe, VEH_ENGINE_DRIVETRAIN } from './veh-engine.js';

// ── D3 gate (drivable-vehicles.plan.md): the sedan derives (veeEight beats transverseFour on
// horsepower), the trailer derives null (not drivable BY DATA), and the towtruck's mass exceeds
// the coupe's with a LONGER derived braking distance under the D2 model — asserted by actually
// driving both derived configs through the drive rule.

describe('deriveDrivetrain (D3)', () => {
  it('a sedan with an engine derives; veeEight beats transverseFour on horsepower', () => {
    const v8 = deriveDrivetrain({ archetype: 'sedan', parts: [resolveVehEngineRecipe({ family: 'veeEight' })] });
    const t4 = deriveDrivetrain({ archetype: 'sedan', parts: [resolveVehEngineRecipe({ family: 'transverseFour' })] });
    expect(v8.horsepower).toBe(VEH_ENGINE_DRIVETRAIN.veeEight.horsepower);
    expect(v8.horsepower).toBeGreaterThan(t4.horsepower);
    expect(v8.mass).toBe(1450);
    expect(v8.brakeForce).toBeGreaterThan(0);
  });

  it('the drivetrain ladder holds: transverseFour < inlineFour < vintageStacks < veeEight', () => {
    const hp = (f) => VEH_ENGINE_DRIVETRAIN[f].horsepower;
    expect(hp('transverseFour')).toBeLessThan(hp('inlineFour'));
    expect(hp('inlineFour')).toBeLessThan(hp('vintageStacks'));
    expect(hp('vintageStacks')).toBeLessThan(hp('veeEight'));
  });

  it('the trailer derives NULL — no engine part, not drivable by data', () => {
    expect(deriveDrivetrain({ archetype: 'trailer', parts: [] })).toBeNull();
    // even handing it an engine part it has no bom slot for is the caller's audit problem —
    // deriveDrivetrain only refuses on the MISSING engine; an archetype typo throws loudly.
    expect(() => deriveDrivetrain({ archetype: 'wagon', parts: [] })).toThrow(/unknown vehicle archetype/);
  });

  it('a rig folds in wheelbase/wheelRadius through unitScale (cm → m)', () => {
    const d = deriveDrivetrain({
      archetype: 'sedan',
      parts: [resolveVehEngineRecipe({ family: 'inlineFour' })],
      rig: { wheelbase: 280, wheelRadius: 33 },
      unitScale: 0.01,
    });
    expect(d.wheelbase).toBeCloseTo(2.8, 5);
    expect(d.wheelRadius).toBeCloseTo(0.33, 5);
  });

  it('towtruck mass exceeds the coupe and it stops LONGER under the D2 model (driven, not asserted on paper)', () => {
    const engine = resolveVehEngineRecipe({ family: 'veeEight' });
    const rig = { wheelbase: 280, wheelRadius: 33 };
    const coupe = deriveDrivetrain({ archetype: 'coupe', parts: [engine], rig, unitScale: 0.01 });
    const truck = deriveDrivetrain({ archetype: 'towtruck', parts: [engine], rig: { wheelbase: 420, wheelRadius: 38 }, unitScale: 0.01 });
    expect(truck.mass).toBeGreaterThan(coupe.mass);

    const stopDist = (params) => {
      const w = createWorld({ entities: [{ id: 'v', rule: { type: 'drive', ...params, topSpeed: 15 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
      const flat = { ground: () => 0 };
      for (let i = 0; i < 900; i++) stepWorld(w, { forward: 1 }, 1 / 60, flat);
      const car = w.byId.v;
      expect(car.speed).toBeCloseTo(15, 0);
      const x0 = car.transform.pos[0];
      let i = 0;
      while (car.speed > 0 && i++ < 3000) stepWorld(w, { forward: -1 }, 1 / 60, flat);
      return car.transform.pos[0] - x0;
    };
    expect(stopDist(truck)).toBeGreaterThan(stopDist(coupe) * 1.4);
  });
});
