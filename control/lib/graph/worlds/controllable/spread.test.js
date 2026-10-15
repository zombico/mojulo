import { describe, expect, it } from 'vitest';
import { composeLive } from './compose.js';
import { shooterPole } from '../../gameworld/shooter-pole.js';

// SPREAD and RECOIL (opt-in on a weapon): a round leaves inside a cone the shooter's run widens and a spray blooms, and
// a spray climbs; where in the cone is a seeded hash of the shooter and its shot count. The realistic pole's: a
// planted, tapped shot is true, a run or a spray is not. Without them every round goes where it is aimed.

const E = composeLive();
const hooks = { ground: () => 0 };
const PERSON = { a: 0.35, c: 0.9, cz: 0.9 };
// a shooter 30 m from a target, aimed at its chest; `run`: m/s it strafes while it fires; `tap`: seconds between pulls
function range(weapon, { run = 0, tap = 0, seconds = 3 } = {}) {
  const w = E.createWorld({ entities: [
    { id: 'p', pilotable: true, rule: { type: 'walk', speed: 0, eye: 0 }, weapon: { ...weapon, eye: 1.3, hand: undefined }, body: { type: 'none' }, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 } },
    { id: 't', rule: { type: 'walk', speed: 0, eye: 0 }, body: { type: 'mesh', hittable: true, hp: 1e9, egg: { ...PERSON } }, transform: { pos: [30, 0, 0], heading: Math.PI } },
  ] });
  const P = w.byId.p, T = w.byId.t;
  let n = 0, fired = 0;
  for (let k = 0; k < 30 * seconds; k++) {
    P.transform.pos[1] += run / 30; T.transform.pos[1] = P.transform.pos[1];   // it keeps the target square ahead
    const pull = tap ? (k % Math.round(tap * 30) === 0 ? 1 : 0) : 1;
    E.stepWorld(w, { fire: pull }, 1 / 30, hooks);
    if (P.weapon.shots > fired) { fired = P.weapon.shots; n++; }
  }
  return { shots: n, hits: T.hits || 0, rate: (T.hits || 0) / Math.max(1, n), w: P.weapon };
}

describe('spread and recoil', () => {
  const R = shooterPole('realistic').weapon;
  it('without them every round lands', () => {
    const { spread: _s, recoil: _r, ...plain } = R;
    expect(range(plain, { seconds: 2 }).rate).toBe(1);
  });

  it('realistic: a planted tap is true; the same taps on the run, or one long spray, are not', () => {
    const tapped = range(R, { tap: 0.5 }), running = range(R, { tap: 0.5, run: 4 }), spray = range(R, { seconds: 3 });
    expect(tapped.rate).toBe(1);
    expect(running.rate).toBeLessThan(0.75);
    expect(spray.rate).toBeLessThan(tapped.rate);
    expect(spray.w.bloomNow).toBeGreaterThan(0);
  });

  it('a spray blooms and climbs, and settles once the trigger rests; the same run lands the same rounds', () => {
    const w = E.createWorld({ entities: [{ id: 'p', pilotable: true, rule: { type: 'walk', speed: 0, eye: 0 }, weapon: { ...R }, body: { type: 'none' }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    const W = w.byId.p.weapon;
    for (let k = 0; k < 30; k++) E.stepWorld(w, { fire: 1 }, 1 / 30, hooks);
    expect(W.bloomNow).toBeGreaterThan(1);
    expect(W.kickNow).toBeGreaterThan(1);
    for (let k = 0; k < 90; k++) E.stepWorld(w, {}, 1 / 30, hooks);
    expect([W.bloomNow, W.kickNow]).toEqual([0, 0]);
    expect(JSON.stringify(range(R, { seconds: 2 }))).toBe(JSON.stringify(range(R, { seconds: 2 })));
  });

  it('stylized: a run hardly widens the cone', () => {
    const S = shooterPole('stylized').weapon;
    expect(range(S, { tap: 0.5, run: 6 }).rate).toBeGreaterThan(range(R, { tap: 0.5, run: 6 }).rate);
  });
});
