import { describe, expect, it } from 'vitest';
import { composeLive } from './compose.js';
import { SHOULDER } from '../../gameworld/quick.js';
import { kitSlot } from '../../gameworld/arms-kit.js';

// A LAUNCHER OVER THE SHOULDER (gameworld/arms-kit.js `launcher`, `bazooka`; combat-ranged.js lobAim, lobPath): its round
// travels, and is launched on the flight that passes the point under the crosshair (a grenade's low arc, a rocket's
// straight line), so it bursts where the crosshair is; the page's arc and landing ring are that flight, ahead of the
// trigger. The launcher's archetype carries its numbers; the test takes one case of each flight (gravity and none).

const E = composeLive();
const hooks = { ground: () => 0 };
const PERSON = { a: 0.35, c: 0.9, cz: 0.9 };
const world = (word, target) => {
  const slot = kitSlot(word, { damage: 25 }, { eye: 1.5, hand: 'right', converge: true });
  const w = E.createWorld({
    camera: { rule: 'follow', target: 'p', ...SHOULDER, transform: { pos: [-3, -1, 2] } },
    entities: [
      { id: 'p', pilotable: true, rule: { type: 'walk', speed: 0, eye: 0, collideRadius: 0.3, collideHeight: 1.7 }, weapon: slot.weapon, body: { type: 'mesh', hittable: true, egg: { ...PERSON } }, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 } },
      ...(target ? [{ id: 't', rule: { type: 'walk', speed: 0, eye: 0 }, body: { type: 'mesh', hittable: true, hp: 1e6, egg: { ...PERSON } }, transform: { pos: target, heading: Math.PI } }] : []),
    ],
  });
  for (let k = 0; k < 60; k++) E.stepWorld(w, {}, 1 / 30, hooks);   // the camera settles behind the shoulder
  return w;
};
// fire once and step until the round has gone off: → the burst's place
const burst = (w) => { E.stepWorld(w, { fire: 1 }, 1 / 60, hooks); for (let k = 0; k < 600 && !(w.bursts || []).length; k++) E.stepWorld(w, {}, 1 / 60, hooks); return w.bursts[0].pos; };

describe('a launcher over the shoulder', () => {
  it('a grenade is lobbed on the arc through the crosshair\'s point and bursts there, where the page\'s ring said', () => {
    const w = world('launcher'), P = w.byId.p;
    P.weapon.spread = null;   // (the flight alone: a round's seeded cone is the cone's own law, spread.test.js)
    const at = E.crosshairPoint(P, w, P.weapon.range, true), path = E.lobPath(P, w);
    expect(at[2]).toBeLessThan(0.05);                                            // (the crosshair on the ground ahead)
    expect(Math.hypot(path.at[0] - at[0], path.at[1] - at[1])).toBeLessThan(0.6);   // the ring is under the crosshair
    expect(path.pts.some((p) => p[2] > P.weapon.eye + 0.05)).toBe(true);           // on an arc, over the muzzle's height
    const b = burst(w);
    expect(Math.hypot(b[0] - path.at[0], b[1] - path.at[1])).toBeLessThan(0.6);    // and it goes off where the ring was
  });
  it('a rocket flies straight to a body under the crosshair, and the ring is red there (it ends on the body)', () => {
    // (a body where the settled crosshair's ray meets the ground's height of a chest, 12 m out)
    const w0 = world('bazooka'), C = w0.camera.transform.pos, A = w0.camera.lookAt, k = (12 - C[0]) / (A[0] - C[0]);
    const w = world('bazooka', [12, C[1] + k * (A[1] - C[1]), 0]), P = w.byId.p;
    const path = E.lobPath(P, w);
    expect(path.hit).toBe('t');
    const b = burst(w);
    expect(Math.hypot(b[0] - 12, b[1] - w.byId.t.transform.pos[1])).toBeLessThan(0.6);
    expect(w.byId.t.hits).toBeGreaterThan(0);
  });
  it('lobAim: the low arc of the two through a point, straight without gravity, the farthest past its reach', () => {
    const [, low] = E.lobAim([0, 0, 0], [30, 0, 0], 45, 9.8);
    expect(low).toBeGreaterThan(0); expect(low).toBeLessThan(Math.PI / 8);
    expect(E.lobAim([0, 0, 0], [10, 0, 5], 30, 0)[1]).toBeCloseTo(Math.atan2(5, 10), 9);
    expect(E.lobAim([0, 0, 0], [900, 0, 0], 45, 9.8)[1]).toBeCloseTo(Math.PI / 4, 9);
  });
});
