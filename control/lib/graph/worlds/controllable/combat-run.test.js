import { describe, expect, it } from 'vitest';
import { createWorld, stepWorld } from '@/lib/graph/worlds/controllable-world';

// A HERO IN COMBAT (rules-platform.js, a rule's `combat`): near a foe it walks at the combat pace unless the trigger is
// held; one whose combat runs (`combat.run`, a stylish game's: gameworld/levels.js) runs with nothing held.
const DT = 1 / 60, FLAT = { ground: () => 0 };
const COMBAT = { near: 10, far: 15, linger: 3, speed: 2.4, stride: 1.6 };
const mk = (run) => createWorld({ entities: [
  { id: 'h', pilotable: true, rule: { type: 'platform', eye: 0, speed: 7, walkSpeed: 1.6, move: 'camera', combat: { ...COMBAT, ...(run ? { run: true } : {}) } }, transform: { pos: [0, 0, 0], heading: 0 } },
  { id: 'f', team: 'foes', rule: { type: 'static' }, body: { type: 'box', size: [1, 1, 2], hittable: true, hp: 100 }, transform: { pos: [0, 6, 0], heading: 0 } },
], camera: { rule: 'follow', target: 'h', dist: 6, height: 3 } });
const pace = (w) => { for (let k = 0; k < 90; k++) stepWorld(w, { forward: 1 }, DT, FLAT); const a = w.byId.h.transform.pos.slice(); for (let k = 0; k < 30; k++) stepWorld(w, { forward: 1 }, DT, FLAT); const b = w.byId.h.transform.pos; return Math.hypot(b[0] - a[0], b[1] - a[1]) / (30 * DT); };

describe('the hero in combat', () => {
  it('walks at the combat pace with nothing held; a combat that runs, runs', () => {
    const walk = pace(mk(false)), run = pace(mk(true));
    expect(walk).toBeLessThanOrEqual(COMBAT.speed + 0.2);
    expect(run).toBeGreaterThan(COMBAT.speed * 1.5);
  });
});
