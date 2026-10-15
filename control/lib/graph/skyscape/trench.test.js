import { describe, it, expect } from 'vitest';
import { airspaceOf, assembleAirspace, validateAirspace } from './airspace.js';
import { seatCraft } from './craft.js';
import { flyCourse } from './autopilot.js';
import { dogfightCast } from './dogfight.js';
import { CRAFT } from './eye.js';

const spaceCraft = Object.keys(CRAFT).find((k) => CRAFT[k].space);
const M = { kind: 'airspace', map: { craft: spaceCraft }, space: { trench: true }, course: false, fly: true };
const { map, field } = airspaceOf(M);
const T = field.trench, seat = seatCraft(map, field, null);

describe('the trench', () => {
  it('is a channel cut in the station\'s surface: the plate at 0, the floor its depth down, the greebles on it', () => {
    expect(field.groundAt(0, 0)).toBeCloseTo(-T.d, 1);
    expect(field.groundAt(T.w / 2 + 2 * 10 + 30, 0)).toBeGreaterThanOrEqual(0);
    expect(field.groundAt(-T.w / 2 - 3, 0)).toBeGreaterThanOrEqual(0);    // past the wall, the plate (or a block on it)
    expect(field.report.greebles).toBeGreaterThan(100);
    // nothing stands in the channel itself
    for (let y = T.y0 + 10; y < T.y1; y += 50) for (const x of [-T.w / 2 + 3, 0, T.w / 2 - 3]) expect(field.groundAt(x, y)).toBeCloseTo(-T.d, 1);
  });

  it('starts the craft down in its mouth, heading along it, the station its ground', () => {
    const p = seat.transform.pos;
    expect(Math.abs(p[0])).toBeLessThan(T.w / 2);
    expect(p[2]).toBeLessThan(0);
    expect(p[2]).toBeGreaterThan(-T.d);
    expect(field.groundAt(p[0], p[1])).toBeLessThan(p[2]);
    expect(seat.transform.heading).toBeCloseTo(Math.PI / 2, 6);
    expect(seat.rule.roofs).toHaveLength(1);
    expect(seat.rule.space).toBe(true);
  });

  it('is flown down its middle by the craft on its rule without meeting a wall', () => {
    const r = flyCourse(map, field, { gates: field.line.map((at) => ({ at, radius: T.w / 2 - 5 })), laps: 1, finish: null });
    expect(r.flown, r.reason).toBe(true);
  });

  it('puts the port at its end and turrets on its rims; the port alone is the goal', () => {
    const X = dogfightCast(map, field, seat);
    const port = X.entities.find((e) => e.id === 'foe-port'), turrets = X.entities.filter((e) => e.id.startsWith('turret-'));
    expect(port.transform.pos[1]).toBeGreaterThan(0.9 * T.y1);
    expect(port.body.hittable).toBe(true);
    expect(X.entities.filter((e) => /^foe-/.test(e.id))).toHaveLength(1);
    expect(turrets.length).toBe(field.turrets.length);
    expect(turrets.every((e) => Math.abs(e.transform.pos[0]) > T.w / 2 && e.rule.speed === 0)).toBe(true);
  });

  it('is laid on the page as faces and instances, with its laws holding; teaches; deterministic', () => {
    const P = assembleAirspace(M, { live: true });
    expect(P.meta.laws.filter((l) => !l.ok)).toEqual([]);
    expect(P.faces.some((f) => f.group === 'station')).toBe(true);
    expect(P.repeats.map((r) => r.group)).toEqual(['station:walls', 'station:roofs']);
    expect(validateAirspace({ ...M, space: { trench: true, asteroids: 'dense' } })[0]).toMatch(/no asteroids/);
    expect(JSON.stringify(assembleAirspace(M, { live: true }))).toBe(JSON.stringify(P));
  });
});
