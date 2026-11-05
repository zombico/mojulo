import { describe, it, expect } from 'vitest';
import { MATTER, blockMatter, isFluid } from './matter.js';
import { rupaPhysics, readMatterSpec } from './index.js';
import { jetOf, stepVessels } from './fluid.js';
import { settleSpeed } from './debris.js';

const { pressure, flowOf, immerse, windOf, windAt } = rupaPhysics;
const box = { min: [0, 0, 0], max: [1, 1, 1] };

describe('one fluid law: water and air', () => {
  it('air is a fluid in the same table, and no block', () => {
    expect(isFluid(MATTER.air)).toBe(true);
    expect(isFluid(MATTER.water)).toBe(true);
    expect(() => blockMatter(box, 'air')).toThrow(/gas/);
  });

  it('the same immersion lifts a box by the fluid it puts aside, in a pool or in the air', () => {
    const inWater = immerse(box, 1000, [0, 0, 0], { min: [-5, -5, -5], max: [5, 5, 5], density: MATTER.water.density, viscosity: MATTER.water.viscosity });
    const inAir = immerse(box, 1000, [0, 0, 0], MATTER.air);
    expect(inWater.lift / inAir.lift).toBeCloseTo(MATTER.water.density / MATTER.air.density, 6);
  });

  it('drag carries a body toward the medium\'s own flow: still water stops it, the wind takes it', () => {
    const w = immerse(box, 10, [0, 0, 0], MATTER.air, [20, 0, 0]);
    const v = rupaPhysics.stepIn([0, 0, 0], w, 10, 0.1);
    expect(v[0]).toBeGreaterThan(0);
    expect(v[0]).toBeLessThan(20);
  });

  it('one pressure: a tank\'s weight on its foot, a hose\'s jet and the wind on a wall', () => {
    expect(pressure(MATTER.water, { depth: 3 })).toBeCloseTo(1000 * 9.81 * 3, 6);
    expect(pressure(MATTER.air, { flow: 40 })).toBeCloseTo(0.5 * 1.204 * 1600, 6);   // a gale: under a kilopascal
    expect(flowOf(MATTER.water, pressure(MATTER.water, { flow: 30 }))).toBeCloseTo(30, 9);
    expect(jetOf(1e6, { radius: 0.0125 }).speed).toBeCloseTo(0.97 * flowOf(MATTER.water, 1e6), 9);
    const r = stepVessels({ vessels: [{ id: 'c', at: [0, 0, 0], radius: 1, height: 4, liquid: 'water', volume: Math.PI * 3.1, wall: { matter: 'brick', thick: 0.1 } }], pipes: [] }, { seconds: 0.05 });
    expect(r.events[0].stress).toBeCloseTo((pressure(MATTER.water, { depth: 3.1 }) * 1) / 0.1, 3);
  });

  it('a grain settles through the same air: its settling speed reads the air in the table', () => {
    const d = 0.004, newton = Math.sqrt((4 * 2650 * 9.81 * d) / (3 * 0.44 * MATTER.air.density));
    expect(settleSpeed(d)).toBeCloseTo(newton, 9);
  });
});

describe('the wind', () => {
  it('blows faster with height, slower near the ground in a city, and its gusts are seeded', () => {
    const open = windOf({ speed: 20, dir: 0, terrain: 'open' }), city = windOf({ speed: 20, dir: 0, terrain: 'city' });
    expect(windAt(open, [0, 0, 30], 0)[0]).toBeGreaterThan(windAt(open, [0, 0, 2], 0)[0]);
    expect(windAt(city, [0, 0, 2], 0)[0]).toBeLessThan(windAt(open, [0, 0, 2], 0)[0]);
    expect(windAt(open, [0, 0, 10], 0)[0]).toBeCloseTo(20, 9);
    const g1 = windOf({ speed: 20, gust: 0.4, seed: 3 }), g2 = windOf({ speed: 20, gust: 0.4, seed: 3 });
    const at = (w) => [0, 1, 2, 3].map((t) => windAt(w, [5, 0, 10], t)[0]);
    expect(at(g1)).toEqual(at(g2));
    expect(Math.max(...at(g1)) - Math.min(...at(g1))).toBeGreaterThan(0.5);
    expect(windAt(windOf({ speed: 10, dir: 90 }), [0, 0, 10], 0)[1]).toBeCloseTo(10, 9);
  });

  it('a level says its wind', () => {
    expect(readMatterSpec({ wind: { speed: 25, dir: 45, terrain: 'city', gust: 0.3 } }).wind).toEqual({ speed: 25, dir: 45, terrain: 'city', gust: 0.3 });
    expect(() => readMatterSpec({ wind: { speed: 25, terrain: 'jungle' } })).toThrow(/terrain/);
  });
});
