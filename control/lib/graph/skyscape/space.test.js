import { describe, it, expect } from 'vitest';
import { airspaceOf, assembleAirspace, validateAirspace, isSpace } from './airspace.js';
import { planCourse, flightLaps } from './course.js';
import { seatCraft } from './craft.js';
import { flyCourse } from './autopilot.js';
import { courseTubes, segDist, ASTEROIDS } from './space.js';
import { CRAFT } from './eye.js';

// the space craft from the registry, a dense field (the most rocks to keep off the course)
const spaceCraft = Object.keys(CRAFT).find((k) => CRAFT[k].space);
const M = { kind: 'airspace', map: { craft: spaceCraft }, space: { asteroids: 'dense' }, course: true, fly: true };
const { map, field } = airspaceOf(M);
const course = planCourse(map, field, { seed: 1 }), seat = seatCraft(map, field, course);

describe('a map in space', () => {
  it('is space for a space craft: no ground, a reach above and below, the fly rule\'s lift and gravity off', () => {
    expect(isSpace(M)).toBe(true);
    expect(map.form).toBe('void');
    expect(map.rings.reach.hz).toBeGreaterThan(map.rings.field.hz);
    expect(seat.rule).toMatchObject({ type: 'fly', gravity: false, lift: false, space: true, launchSpeed: map.craft.cruise });
    expect(seat.rule.bound.hz).toBe(map.rings.reach.hz);
    expect(seat.rule.leverStart).toBeGreaterThan(0);
  });

  it('keeps its rocks off the course and the start, and every law holds', () => {
    expect(field.asteroids.length).toBeGreaterThan(50);
    for (const q of field.asteroids) for (const [a, b, w] of courseTubes(map, course, seat.transform)) expect(segDist(q, a, b) - q[3] - w).toBeGreaterThanOrEqual(ASTEROIDS.clear - 1e-6);
    const page = assembleAirspace(M, { live: true });
    expect(page.meta.laws.filter((l) => !l.ok)).toEqual([]);
    expect(page.sky.space).toBe(true);
    expect(page.terrain).toBeUndefined();
    expect(page.repeats.reduce((n, r) => n + r.transforms.length, 0)).toBe(field.asteroids.length);
  });

  it('is a gate race with nothing to land on: the last gate the finish, every respawn aloft, the rocks the page\'s obstacles', () => {
    expect(course.finish).toBeNull();
    const L = flightLaps(course, map, field, seat);
    expect(L.land).toBeUndefined();
    expect(L.respawn.every((r) => r.aloft === 1)).toBe(true);
    expect(seat.rule.obstacles).toHaveLength(4 * field.asteroids.length);
  });

  it('is flown by its own craft, and a rock flown into is a crash', () => {
    const r = flyCourse(map, field, course);
    expect(r.flown, r.reason).toBe(true);
    expect(r.passed).toBe(r.of);
    const q = field.asteroids[0];
    expect(field.hitAt(q[0], q[1], q[2] + q[3] - 0.5)).toBe(true);
    expect(field.hitAt(q[0], q[1], q[2] + q[3] + 10)).toBe(false);
  });

  it('teaches on a bad ask, and is deterministic', () => {
    expect(validateAirspace({ ...M, ground: { pads: [] } })[0]).toMatch(/space has no ground/);
    expect(validateAirspace({ ...M, space: { asteroids: 'lots' } })[0]).toMatch(/space.asteroids/);
    expect(validateAirspace({ kind: 'airspace', space: { asteroids: 'dense' } })[0]).toMatch(/belongs to a space map/);
    expect(JSON.stringify(assembleAirspace(M, { live: true }))).toBe(JSON.stringify(assembleAirspace(M, { live: true })));
  });
});
