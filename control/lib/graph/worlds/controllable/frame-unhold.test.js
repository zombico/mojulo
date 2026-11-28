// AN ALLY THAT HOLDS (rules-frame.js `mind.hold`), let go: it stands its post turned to the pilot until the cast's
// `unhold` op, and from then it keeps by the pilot as a wingman does.
import { describe, it, expect } from 'vitest';
import { composeLive } from './compose.js';
import { frameEntity } from '../../assault-frame/pilot.js';

const E = composeLive();
const DT = 1 / 30;
const flat = { ground: () => 0 };
const run = (st, secs) => { for (let i = 0; i < secs / DT; i++) E.stepWorld(st, {}, DT, flat); return st; };

describe('an ally that holds', () => {
  it('stands its post until it is let go, then comes to the pilot', () => {
    const st = E.createWorld({ entities: [frameEntity('vanguard', { id: 'p', at: [0, 0, 0], heading: Math.PI / 2, pilot: true }), frameEntity('raptor', { id: 'cole', at: [0, 400, 0], heading: 0, mind: { range: 140, ally: true, engage: 250, hold: true } })], pilot: 'p' });
    const C = st.byId.cole;
    run(st, 4);
    expect(Math.hypot(C.transform.pos[0], C.transform.pos[1] - 400)).toBeLessThan(2);
    E.castOps(st, [{ op: 'unhold', who: 'cole' }]);
    run(st, 12);
    expect(Math.hypot(C.transform.pos[0], C.transform.pos[1])).toBeLessThan(120);
  });

  it('stands down with every other mind while the pilot\'s input is held (a scene playing), and takes up after', () => {
    const foe = frameEntity('raptor', { id: 'f', at: [0, 200, 0], heading: -Math.PI / 2, team: 'foes', mind: { range: 60, aggression: 1, dodge: 0 } });
    const st = E.createWorld({ entities: [frameEntity('vanguard', { id: 'p', at: [0, 0, 0], heading: Math.PI / 2, pilot: true }), foe], pilot: 'p' });
    const F = st.byId.f, step = (inp, secs) => { for (let i = 0; i < secs / DT; i++) E.stepWorld(st, inp, DT, flat); };
    step({ held: 1 }, 4);
    expect(Math.hypot(F.transform.pos[0], F.transform.pos[1] - 200)).toBeLessThan(2);
    step({}, 4);
    expect(F.transform.pos[1]).toBeLessThan(170);
  });
});

describe('a frame stood up again', () => {
  it('a downed pilot spawned fresh is whole and walks as before', () => {
    const st = E.createWorld({ entities: [frameEntity('vanguard', { id: 'p', at: [0, 0, 0], heading: Math.PI / 2, pilot: true })], pilot: 'p' });
    const P = st.byId.p;
    E.castOps(st, [{ op: 'kill', who: 'p' }]); P.stagger = 1.2; run(st, 1);
    expect(P.downed).toBe(true);
    E.castOps(st, [{ op: 'spawn', who: 'p', fresh: true }]);
    expect(P.downed).toBe(false);
    expect(P.body.hp).toBe(P.body.hpMax);
    // (its reel gone with its fall: no STAGGER on a frame stood up again)
    expect(P.stagger || 0).toBe(0);
    const y0 = P.transform.pos[1];
    for (let i = 0; i < 60; i++) E.stepWorld(st, { forward: 1 }, DT, flat);
    expect(P.transform.pos[1] - y0).toBeGreaterThan(5);
  });
});
