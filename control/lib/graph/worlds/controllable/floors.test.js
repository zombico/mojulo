import { describe, expect, it } from 'vitest';
import { composeLive } from './compose.js';
import { arenaAsks, askBoxes, towerFloor } from '../../gameworld/lay-concerns.js';
import { groundOf } from '../../playscape/terrain.js';

// FLOORS for the minds (`rule.floors`): a goal on a tower's top is reached up its stair (steps a body climbs), and one on
// the ground from the top down it; the walk between floors goes by the flight, never through the tower's side.

const E = composeLive();
const tower = { form: 'tower', u: 10, v: 0, w: 5, d: 5, h: 2.5, dir: [-1, 0] };
const colliders = askBoxes(arenaAsks([tower], (u, v) => [u, v, 0]));
const hooks = { ground: groundOf(colliders, 0) };
const floor = towerFloor(tower);
const floors = [{ area: floor.area, z: floor.z, flights: floor.flights }];
const walker = (pos, extra = {}) => ({
  id: 'a', rule: { type: 'ai', mind: { motivation: 'frag', perception: 'memory', pathing: 'navmesh' }, sightRange: 40, navCell: 0.5, speed: 3, turn: 5, eye: 0, collideRadius: 0.3, collideHeight: 1.7, step: 0.3, floors, ...extra },
  body: { type: 'mesh', hittable: true, hp: 99, egg: { a: 0.35, c: 0.9, cz: 0.9 } }, transform: { pos, heading: 0, pitch: 0 },
});
const run = (w, s) => { let top = 0; for (let k = 0; k < 30 * s; k++) { E.stepWorld(w, {}, 1 / 30, hooks); top = Math.max(top, w.byId.a.transform.pos[2]); } return top; };

describe('floors for the minds', () => {
  it('the stair is steps a body climbs, and its flight runs from the floor before the first to the top', () => {
    const steps = colliders.filter((c) => c.max[2] < tower.h - 1e-6).map((c) => c.max[2]).sort((a, b) => a - b);
    steps.forEach((z, k) => expect(z - (steps[k - 1] ?? 0)).toBeLessThanOrEqual(0.25 + 1e-9));
    expect(tower.h - steps.at(-1)).toBeLessThanOrEqual(0.25 + 1e-9);
    expect(floor.flights[0].bottom[0]).toBeLessThan(Math.min(...colliders.map((c) => c.min[0])));
  });
  it('a perch on the top: it walks round to the stair and up it, and stands on the top', () => {
    const w = E.createWorld({ colliders, entities: [walker([0, 6, 0], { keepRange: true, perches: [[11, 0, 2.5]], loadout: [{ name: 'mid', band: [6, 35], weapon: { fireClass: 'sight', range: 40, eye: 1.4 } }, { name: 'long', band: [18, 90], weapon: { fireClass: 'sight', range: 90, eye: 1.4 } }] })] });
    run(w, 14);
    const p = w.byId.a.transform.pos;
    expect(p[2]).toBeCloseTo(2.5, 5);
    expect(Math.hypot(p[0] - 11, p[1])).toBeLessThanOrEqual(1);
  });
  it('a goal on the ground from the top: down the stair, not off the side', () => {
    const w = E.createWorld({ colliders, entities: [walker([11, 1, 2.5], { objective: { at: [10, 9, 0], radius: 1 } })] });
    const a = w.byId.a;
    let lowestOverTower = Infinity;
    for (let k = 0; k < 30 * 12; k++) {
      E.stepWorld(w, {}, 1 / 30, hooks);
      const p = a.transform.pos;
      if (p[0] > 7.6 && p[0] < 12.4 && Math.abs(p[1]) < 2.4) lowestOverTower = Math.min(lowestOverTower, p[2]);
    }
    expect(Math.hypot(a.transform.pos[0] - 10, a.transform.pos[1] - 9)).toBeLessThanOrEqual(1.2);
    expect(a.transform.pos[2]).toBeCloseTo(0, 5);
    expect(lowestOverTower).toBeGreaterThan(2.4);   // over the tower it stayed on its top
  });
});
