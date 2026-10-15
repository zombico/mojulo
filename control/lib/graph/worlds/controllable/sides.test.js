import { describe, expect, it } from 'vitest';
import { composeLive } from './compose.js';

// TWO SIDES in the minds: a match player on a side (`team`) fights only the other side; with `clearLine` it holds its
// fire rather than shoot through a teammate standing on the line; with an `objective` and no foe in sight it goes to
// the point and stands on it.

const E = composeLive();
const hooks = { ground: () => 0 };
const PERSON = { a: 0.35, c: 0.9, cz: 0.9 };
const gun = { fireClass: 'sight', auto: false, cooldown: 0.4, magazine: 99, damage: 1, range: 40, coreAngle: 1.5, eye: 1.4 };
const player = (id, team, pos, heading, rule = {}) => ({
  id, team, rule: { type: 'ai', mind: { motivation: 'frag', perception: 'memory', pathing: 'navmesh' }, sightRange: 40, sightCone: 1.4, navCell: 0.5, standoff: 30, speed: 3, turn: 4, strafe: 0, dodge: false, burst: 0.3, pause: 0.2, eye: 0, collideRadius: 0.3, collideHeight: 1.7, step: 0.3, ...rule },
  weapon: { ...gun }, body: { type: 'mesh', hittable: true, hp: 99, radius: 0.6, egg: { ...PERSON } }, transform: { pos, heading, pitch: 0 },
});
const stand = (id, team, pos) => ({ id, team, rule: { type: 'walk', speed: 0, eye: 0, collideRadius: 0.3, collideHeight: 1.7 }, body: { type: 'mesh', hittable: true, hp: 99, egg: { ...PERSON } }, transform: { pos, heading: 0, pitch: 0 } });
const run = (w, n) => { for (let k = 0; k < n; k++) E.stepWorld(w, {}, 1 / 30, hooks); };

describe('two sides', () => {
  it('a mind fights the other side, never its own', () => {
    const w = E.createWorld({ entities: [player('a', 'red', [0, 0, 0], 0), stand('mate', 'red', [6, 0, 0]), stand('foe', 'blue', [12, 3, 0])] });
    run(w, 10);
    expect(w.byId.a.fragTarget).toBe('foe');
  });
  it('clearLine: a teammate on the line holds its fire; stepped aside, it fires', () => {
    const shots = (clear, mateAt) => {
      const w = E.createWorld({ entities: [player('a', 'red', [0, 0, 0], 0, clear ? { clearLine: true } : {}), stand('mate', 'red', mateAt), stand('foe', 'blue', [14, 0, 0])] });
      run(w, 60);
      return w.byId.a.weapon.shots;
    };
    expect(shots(false, [7, 0, 0])).toBeGreaterThan(0);   // it shoots through (allies pass a round)
    expect(shots(true, [7, 0, 0])).toBe(0);
    expect(shots(true, [7, 3, 0])).toBeGreaterThan(0);
  });
  it('an objective: no foe in sight, it goes to the point and stands on it', () => {
    const w = E.createWorld({ entities: [player('a', 'red', [0, 0, 0], 0, { objective: { at: [10, 6, 0], radius: 2 } })] });
    run(w, 30 * 8);
    const p = w.byId.a.transform.pos;
    expect(Math.hypot(p[0] - 10, p[1] - 6)).toBeLessThanOrEqual(2.2);
  });
});
