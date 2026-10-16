import { describe, expect, it } from 'vitest';
import { composeLive } from './compose.js';
import { SHOULDER } from '../../gameworld/quick.js';

// OVER THE SHOULDER (gameworld/quick.js SHOULDER): a chase camera close behind a shooter and off its right shoulder.
// Its crosshair's line is not the gun's: a round sent down the body's heading lands beside the crosshair at every
// range. `weapon.converge` sends it from the muzzle to the point under the crosshair. And the camera sees past a corner
// the body hides behind (the third-person peek): the player sees, the foe does not, and the gun cannot clear the edge.

const E = composeLive();
const hooks = { ground: () => 0 };
const PERSON = { a: 0.35, c: 0.9, cz: 0.9 };
const rifle = { fireClass: 'sight', auto: false, cooldown: 0.3, magazine: 99, damage: 1, range: 80, coreAngle: 0.4, eye: 1.5, hand: 'right' };
const world = (weapon, target, colliders) => {
  const w = E.createWorld({
    ...(colliders ? { colliders } : {}),
    camera: { rule: 'follow', target: 'p', ...SHOULDER, transform: { pos: [-3, -1, 2] } },
    entities: [
      { id: 'p', pilotable: true, rule: { type: 'walk', speed: 0, eye: 0, collideRadius: 0.3, collideHeight: 1.7 }, weapon, body: { type: 'mesh', hittable: true, egg: { ...PERSON } }, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 } },
      { id: 't', rule: { type: 'walk', speed: 0, eye: 0 }, body: { type: 'mesh', hittable: true, hp: 1e6, egg: { ...PERSON } }, transform: { pos: target, heading: Math.PI } },
    ],
  });
  for (let k = 0; k < 60; k++) E.stepWorld(w, {}, 1 / 30, hooks);   // the camera settles behind the shoulder
  return w;
};
const fire = (w) => { for (let k = 0; k < 6; k++) E.stepWorld(w, { fire: k % 2 }, 1 / 30, hooks); return w.byId.t.hits || 0; };

describe('over the shoulder', () => {
  // where the crosshair's line crosses 20 m out
  const crosshairAt = (x) => { const C = [-SHOULDER.dist, -SHOULDER.shoulder], L = [SHOULDER.lead, 0]; return C[1] + ((x - C[0]) / (L[0] - C[0])) * (L[1] - C[1]); };
  it('the crosshair\'s line is not the gun\'s: a body under the crosshair 20 m out is missed down the heading, hit converged', () => {
    const at = [20, crosshairAt(20), 0];
    expect(Math.abs(at[1])).toBeGreaterThan(0.5);
    expect(fire(world({ ...rifle }, at))).toBe(0);
    const w = world({ ...rifle, converge: true }, at);
    expect(fire(w)).toBeGreaterThan(0);
    expect(Math.hypot(w.byId.p.crosshairAt[0] - 20, w.byId.p.crosshairAt[1] - at[1])).toBeLessThan(0.6);
  });
  it('the third-person peek: past a corner the camera sees a foe the body is hidden from, and the gun cannot clear the edge', () => {
    // a wall ahead and to the right, its end just past the right shoulder; the foe beyond it, off to the right
    const wall = [{ min: [1, -0.8, 0], max: [1.5, 3, 3] }], foe = [8, -3, 0];
    const w = world({ ...rifle, converge: true }, foe, wall);
    const cam = w.camera.transform.pos, chest = [foe[0], foe[1], 1.2];
    expect(E.sightBlocked(cam, chest, wall)).toBe(false);                                   // the player sees it
    expect(E.bodyExposure(w.byId.p, w.byId.p.transform.pos, [foe[0], foe[1], 1.6], wall)).toBe(0);   // it sees none of the player
    expect(E.sightBlocked(E.muzzleAt(w.byId.p, w.byId.p.weapon), chest, wall)).toBe(true);   // the gun cannot clear the edge
  });
});
