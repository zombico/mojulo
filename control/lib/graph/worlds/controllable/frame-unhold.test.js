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
});
