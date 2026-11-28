// A WINGMAN on the frame rule (rules-frame.js, a mind's `ally`): on the pilot's side, it leads to its places in order and
// waits at each for the pilot, keeps by the pilot past the last, and turns to fight a foe that comes within its reach.
import { describe, it, expect } from 'vitest';
import { composeLive } from './compose.js';
import { frameEntity } from '../../assault-frame/pilot.js';

const E = composeLive();
const DT = 1 / 30;
const flat = { ground: () => 0 };
const run = (st, inp, secs) => { for (let i = 0; i < secs / DT; i++) E.stepWorld(st, inp, DT, flat); return st; };
const PLACES = [{ at: [0, 300, 0], r: 40 }, { at: [300, 300, 0], r: 40 }];
const ally = (more = {}) => frameEntity('raptor', { id: 'cole', at: [40, -20, 0], heading: Math.PI / 2, mind: { range: 140, ally: true, engage: 500, lead: PLACES, ...more } });
const world = (extra = []) => E.createWorld({ entities: [frameEntity('vanguard', { id: 'p', at: [0, 0, 0], heading: Math.PI / 2, pilot: true }), ally(), ...extra], pilot: 'p' });
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe('a wingman', () => {
  it('leads to its first place and waits there while the pilot stands', () => {
    const st = run(world(), {}, 25), C = st.byId.cole;
    expect(dist(C.transform.pos, PLACES[0].at)).toBeLessThan(40);
    run(st, {}, 10);
    expect(dist(C.transform.pos, PLACES[0].at)).toBeLessThan(40);   // (still there: it waits for the pilot)
  });

  it('moves on to the next place once the pilot has reached the one it led to', () => {
    const st = run(world(), {}, 25), C = st.byId.cole, P = st.byId.p;
    P.transform.pos = [0, 300, 0];
    run(st, {}, 30);
    expect(C.leadI).toBe(1);
    expect(dist(C.transform.pos, PLACES[1].at)).toBeLessThan(60);
  });

  it('fights a foe that comes within its reach, and leaves one out past it alone', () => {
    const foe = frameEntity('vanguard', { id: 'f', at: [40, 1400, 0], team: 'foes', mind: { range: 120 } });
    const st = world([foe]), C = st.byId.cole;
    run(st, {}, 4);
    expect(C.lockOn).not.toBe('f');
    st.byId.f.transform.pos = [40, 200, 0];
    let locked = false;
    for (let i = 0; i < 6 / DT; i++) { E.stepWorld(st, {}, DT, flat); if (C.lockOn === 'f' && C.locked) locked = true; }
    expect(locked).toBe(true);
    const shots = Object.values(C.rule.slots).reduce((a, w) => a + ((w.st && w.st.shots) || 0), 0);
    expect(shots).toBeGreaterThan(0);
  });
});
