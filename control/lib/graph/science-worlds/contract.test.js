import { describe, it, expect } from 'vitest';
import { quantity, vector, normalizeBodies, normalizeLiberties, splitParams } from './contract.js';
import { gapFor } from './scales.js';
import { qty, add, dimensionOf } from '../machina/quantities.js';

describe('science worlds: the contract', () => {
  it('takes SI numbers as they are, and units with the dimension the slot wants', () => {
    expect(quantity(2, 'mass', 'm')).toBe(2);
    expect(quantity('250 g', 'mass', 'm')).toBe(0.25);
    expect(quantity([3, 'µC'], 'charge', 'q')).toBeCloseTo(3e-6, 18);
    expect(quantity('30 deg', 'scalar', 'tilt')).toBeCloseTo(Math.PI / 6, 12);
    expect(vector(['1 km', 0, '20 cm'], 'length', 'at')).toEqual([1000, 0, 0.2]);
    expect(() => quantity('2 s', 'length', 'at')).toThrow(/wants a length, got 's' \(a time\)/);
    expect(() => quantity('2 furlongs', 'length', 'at')).toThrow(/unknown unit/);
    expect(() => quantity(Infinity, 'mass', 'm')).toThrow(/finite/);
  });

  it('gives charge, temperature and amount their own dimensions without renaming the old ones', () => {
    expect(dimensionOf(qty(1, 'N'))).toBe('force');
    expect(dimensionOf(qty(1, 'kWh'))).toBe('work');
    expect(dimensionOf(qty(1, 'T'))).toBe('bfield');
    expect(() => add(qty(1, 'C'), qty(1, ''))).toThrow(/cannot add charge \+ scalar/);
    expect(() => add(qty(1, 'K'), qty(1, 'mol'))).toThrow(/cannot add/);
  });

  it('normalizes bodies: unique ids, a mass for anything that moves, a fixed body that never moves', () => {
    const [sun, rock] = normalizeBodies([{ id: 'sun', fixed: true, mass: 10, v: [5, 0, 0] }, { id: 'rock', mass: 1, at: [1, 0, 0] }]);
    expect(sun.v).toEqual([0, 0, 0]);
    expect(rock.radius).toBe(0);
    expect(() => normalizeBodies([{ id: 'a', mass: 1 }, { id: 'a', mass: 1 }])).toThrow(/used twice/);
    expect(() => normalizeBodies([{ id: 'a' }])).toThrow(/mass/);
    expect(() => normalizeBodies([])).toThrow(/at least one/);
  });

  it('keeps the model, the dress and the liberties apart', () => {
    expect(() => splitParams({ model: {}, colour: 'red' })).toThrow(/unknown field 'colour'/);
    expect(splitParams({ model: { bodies: [] } }).liberties).toEqual([]);
    expect(normalizeLiberties(['slowed 10×'])).toEqual([{ what: 'slowed 10×' }]);
    expect(() => normalizeLiberties([{ why: 'no what' }])).toThrow(/what/);
  });

  it('sends a law to the scale that owns it: chemistry goes where its explanation needs', () => {
    expect(gapFor('reaction', 'classical', []).why).toMatch(/microscopic/);
    expect(gapFor('bond', 'microscopic', []).why).toMatch(/quantum/);
    expect(gapFor('bond', 'quantum', ['x']).why).toMatch(/not a quantum law/);
  });
});
