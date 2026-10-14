import { describe, it, expect } from 'vitest';
import { airspaceOf } from './airspace.js';
import { seatCraft } from './craft.js';
import { dogfightCast, guns, WING, RANGE_S } from './dogfight.js';
import { CRAFT } from './eye.js';

// a space craft from the registry, a dense field: the wing must still find clear air
const spaceCraft = Object.keys(CRAFT).find((k) => CRAFT[k].space);
const { map, field } = airspaceOf({ kind: 'airspace', map: { craft: spaceCraft }, space: { asteroids: 'dense' }, course: false });
const seat = seatCraft(map, field, null);

describe('the dogfight', () => {
  it('arms the craft with a cannon its cruise sizes, and flies it by the mouse', () => {
    const X = dogfightCast(map, field, seat);
    expect(X.pilot.weapon).toMatchObject({ fireClass: 'sight', auto: true, range: RANGE_S * map.craft.cruise });
    expect(X.pilot.body.hittable).toBe(true);
    expect(X.camera.mouseLook).toBe(true);
  });

  it('stands a wing of space minds ahead of the start, slower than the craft, out of the rocks and in the field', () => {
    const X = dogfightCast(map, field, seat, { foes: 6 }), F = map.rings.field, [sx, sy] = seat.transform.pos, h = seat.transform.heading;
    expect(X.entities).toHaveLength(6);
    for (const e of X.entities) {
      expect(e.id).toMatch(/^foe-/);
      expect(e.rule).toMatchObject({ type: 'ai', space: true });
      expect(e.rule.speed).toBeLessThan(map.craft.cruise);
      expect(e.weapon.rof).toBeLessThan(guns(map.craft).rof);
      expect(e.body).toMatchObject({ hittable: true, hp: WING.hp });
      const [x, y, z] = e.transform.pos;
      expect(field.hitAt(x, y, z, 1)).toBe(false);
      expect(Math.abs(x) <= F.hx && Math.abs(y) <= F.hy).toBe(true);
      expect((x - sx) * Math.cos(h) + (y - sy) * Math.sin(h)).toBeGreaterThan(0);   // ahead
    }
    expect(dogfightCast(map, field, seat, { foes: 99 }).entities).toHaveLength(WING.max);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(dogfightCast(map, field, seat))).toBe(JSON.stringify(dogfightCast(map, field, seat)));
  });
});
