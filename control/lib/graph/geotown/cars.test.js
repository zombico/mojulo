import { describe, it, expect } from 'vitest';
import { townFleet, carModel, pickCar, parkCar, carRepeats, TOWN_CARS, CAR_PAINT_HEX, ROOF_EXTRAS } from './cars.js';
import { mulberry32 } from '../city/plan/dice.js';

describe('the town\'s cars: the registry\'s family cars, instanced', () => {
  it('reads its fleet through the registry to the car shelf\'s cards, and refuses what is no car', () => {
    const F = townFleet();
    expect(F.map((f) => f.word)).toEqual(Object.keys(TOWN_CARS));
    // (a fleet row the highway lofts plain, the hatchback, still parks its card)
    expect(F.find((f) => f.word === 'hatchback').card).toBe('familyHatch');
    expect(new Set(F.map((f) => f.card)).size).toBe(F.length);
    expect(() => townFleet({ 'tower crane': 1 })).toThrow(/cars 'tower crane'|no car the car shelf builds/);
    expect(() => townFleet({ sedan: 0 })).toThrow(/a number over 0/);
  });

  it('compiles a model once: its paint pale for the tint, its trim apart, its nose along +y on its tyres', () => {
    const m = carModel('familyHatch');
    expect(carModel('familyHatch')).toBe(m);
    expect(m.paint.length).toBeGreaterThan(100);
    expect(m.trim.length).toBeGreaterThan(100);
    const zs = [...m.paint, ...m.trim].flatMap((f) => f.corners.map((c) => c[2])), ys = m.paint.flatMap((f) => f.corners.map((c) => c[1]));
    expect(Math.min(...zs)).toBeCloseTo(0, 1);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(m.L * 0.9);
    // (the body baked from a white paint: its lightest faces near white, so a tint is the paint itself)
    expect(Math.max(...m.paint.map((f) => parseInt(f.fill.slice(1, 3), 16)))).toBeGreaterThan(200);
  });

  it('parks each car as its model\'s paint, tinted, and its trim, on one transform', () => {
    const F = townFleet(), R = mulberry32(5), list = [];
    for (let k = 0; k < 12; k++) parkCar(list, { x: k * 6, y: 2, z: 0.1, heading: k % 2 ? Math.PI : 0, paint: CAR_PAINT_HEX[k % CAR_PAINT_HEX.length], model: pickCar(F, R) });
    const reps = carRepeats(list, { group: 'g' }), paint = reps.filter((r) => r.group === 'g-paint'), trim = reps.filter((r) => r.group === 'g-trim');
    expect(paint.length).toBe(new Set(list.map((c) => c.model)).size);
    expect(paint.reduce((a, r) => a + r.transforms.length, 0)).toBe(12);
    expect(trim.map((r) => r.transforms.map((t) => t.pos))).toEqual(paint.map((r) => r.transforms.map((t) => t.pos)));
    expect(paint.every((r) => r.transforms.every((t) => t.tint.every((v) => v >= 0 && v <= 1)))).toBe(true);
    expect(trim.every((r) => r.transforms.every((t) => t.tint === undefined))).toBe(true);
    // (the same list, the same repeats)
    expect(JSON.stringify(carRepeats(list, { group: 'g' }).map((r) => r.transforms))).toBe(JSON.stringify(reps.map((r) => r.transforms)));
  });

  it('compiles a realistic loft by its class as a model too, its roof found on its cab, an extra stood on it', () => {
    const m = carModel('loft:van');
    expect(m.paint.length).toBeGreaterThan(50);
    expect(m.L).toBeGreaterThan(5);
    // (a van's roof extra on its cab, the front third)
    expect(m.roof.y).toBeGreaterThan(m.L / 6 - 0.5);
    expect(m.roof.z).toBeGreaterThan(2);
    const list = [];
    parkCar(list, { x: 1, y: 2, z: 0, heading: 0.5, paint: '#f4f4f0', model: 'loft:van', extra: 'lightbar-r' });
    parkCar(list, { x: 9, y: 2, z: 0, heading: 0.5, paint: '#f4f4f0', model: 'loft:van' });
    const reps = carRepeats(list, { group: 'g' }), bar = reps.find((r) => r.group === 'g-lightbar-r');
    expect(bar.transforms).toHaveLength(1);
    expect(Math.min(...bar.template.flatMap((f) => f.corners.map((c) => c[2])))).toBeGreaterThanOrEqual(m.roof.z - 0.03);
    expect(Object.keys(ROOF_EXTRAS)).toEqual(expect.arrayContaining(['lightbar-rb', 'lightbar-r', 'beacon', 'taxi-sign']));
    // (a traffic's POOL: each model it drives keyed for the page, there with none parked; the parked ones' as they were)
    const pooled = carRepeats(list, { group: 'g', pool: [{ model: 'loft:van', extra: 'beacon' }, { model: 'loft:van' }] });
    expect(pooled.filter((r) => r.pool).map((r) => r.pool).sort()).toEqual(['loft:van|beacon', 'loft:van|paint', 'loft:van|trim']);
    expect(pooled.find((r) => r.pool === 'loft:van|beacon').transforms).toHaveLength(0);
    expect(pooled.map(({ pool: _p, ...r }) => r).filter((r) => r.transforms.length)).toEqual(reps);
  });
});
