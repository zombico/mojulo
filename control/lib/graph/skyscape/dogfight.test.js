import { describe, it, expect } from 'vitest';
import { airspaceOf } from './airspace.js';
import { seatCraft } from './craft.js';
import { dogfightCast, guns, WING, RANGE_S } from './dogfight.js';
import { CRAFT } from './eye.js';
import { createWorld, stepWorld } from '../worlds/controllable-world.js';

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

  it('in an atmosphere (air combat) stands the wing over the ground, three low passes clear of it', () => {
    const air = Object.keys(CRAFT).filter((k) => !CRAFT[k].space && CRAFT[k].engine !== false).sort((a, b) => CRAFT[b].max - CRAFT[a].max)[0];
    const A = airspaceOf({ kind: 'airspace', map: { craft: air }, ground: { pads: [{ at: [0.5, 0.25] }] }, course: false });
    const X = dogfightCast(A.map, A.field, seatCraft(A.map, A.field, null), { foes: 5 });
    for (const e of X.entities) { const [x, y, z] = e.transform.pos; expect(z - A.field.groundAt(x, y)).toBeGreaterThanOrEqual(3 * A.map.craft.lowPass - 0.01); }   // (positions kept to the cm)
  });

  it('a fighter over ground keeps its clearance: chasing a target low beyond a ridge, it climbs over it, not through', () => {
    // a ridge 300 m high across x = 600, the target low on its far side
    const ridge = (x) => 300 * Math.max(0, 1 - Math.abs(x - 600) / 200);
    const go = (clearance) => {
      const w = createWorld({ entities: [
        { id: 'target', pilotable: true, rule: { type: 'static' }, ambient: { type: 'static' }, body: { type: 'mesh', hittable: true, hp: 99, egg: { a: 3, c: 2, cz: 0 } }, transform: { pos: [1400, 0, 20], heading: 0 } },
        { id: 'foe-1', team: 'foes', rule: { type: 'ai', space: true, speed: 80, turn: 2, standoff: 50, eye: 0, ...(clearance ? { clearance } : {}) }, body: { type: 'mesh', hittable: true, hp: 3, egg: { a: 3, c: 2, cz: 0 } }, transform: { pos: [0, 0, 40], heading: 0, pitch: 0 } },
      ] });
      let lowest = Infinity; const f = w.byId['foe-1'];
      for (let i = 0; i < 600; i++) { stepWorld(w, {}, 1 / 30, { ground: (q) => ridge(q[0]) }); lowest = Math.min(lowest, f.transform.pos[2] - ridge(f.transform.pos[0])); }
      return { lowest, x: f.transform.pos[0] };
    };
    const kept = go(60), free = go(0);
    expect(kept.x).toBeGreaterThan(800);                 // it crossed the ridge
    expect(kept.lowest).toBeGreaterThanOrEqual(30 - 1e-6);   // never under half its clearance
    expect(free.lowest).toBeLessThan(0);                 // without it, through the hill
  });

  it('is deterministic', () => {
    expect(JSON.stringify(dogfightCast(map, field, seat))).toBe(JSON.stringify(dogfightCast(map, field, seat)));
  });
});
