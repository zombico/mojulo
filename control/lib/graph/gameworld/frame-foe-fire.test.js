// A FOE'S ROUNDS on a frame field are fired at where the pilot IS as they leave the gun, never where it will be, and fly
// slow enough to be seen coming: a round can be stepped or boosted out of. The drones' guns (frame-goal.js OPERATION's
// units) and an enemy frame's (rules-frame.js, a mind's guns unless `leadShots`), each against a pilot running across
// their line.
import { describe, expect, it } from 'vitest';
import { composeLive } from '../worlds/controllable/compose.js';
import { frameEntity } from '../assault-frame/pilot.js';
import { readOperation, operationCast, OPERATION } from './frame-goal.js';

const E = composeLive();
const DT = 1 / 30;
const flat = { ground: () => 0 };
const ends = { spawn: [0, 0, 0], heading: Math.PI / 2, ground: () => 0, frame: { half: 500, centre: [0, 0], gravity: 2.47 } };

// (the bearing a round leaves on, against the bearing to the pilot as it left: how far ahead of the pilot it was aimed)
function ahead(group) {
  const cast = operationCast(readOperation({ groups: [group], tasks: [{ hold: 60 }] }), ends);
  const st = E.createWorld({ entities: [frameEntity('vanguard', { id: 'p', at: [0, 0, 0], heading: 0, pilot: true }), ...cast.entities], pilot: 'p' });
  const P = st.byId.p, seen = new Set(), out = [];
  for (let i = 0; i < 30 * 12 && out.length < 4; i++) {
    E.stepWorld(st, { forward: 1, boost: 1 }, DT, flat);      // (the pilot running across their line, +x)
    for (const q of st.projectiles) {
      if (seen.has(q.id) || q.owner === 'p') continue;
      seen.add(q.id);
      const to = Math.atan2(P.transform.pos[1] - q.pos[1], P.transform.pos[0] - q.pos[0]), went = Math.atan2(q.vel[1], q.vel[0]);
      out.push(Math.abs(Math.atan2(Math.sin(went - to), Math.cos(went - to))));
    }
  }
  return out;
}

describe('a foe\'s rounds on a frame field', () => {
  it('a drone fires at where the pilot is, not ahead of it', () => {
    const a = ahead({ id: 'd', kind: 'gnat', at: [0, 0.3] });
    expect(a.length).toBeGreaterThan(0);
    expect(Math.max(...a)).toBeLessThan(0.08);
    // (and slow enough to see and step out of: its range in more than a second and a half)
    expect(OPERATION.units.gnat.range / OPERATION.units.gnat.speed).toBeGreaterThan(1.5);
  });

  it('an enemy frame\'s guns fire at where the pilot is, not ahead of it', () => {
    const a = ahead({ id: 'r', kind: 'frame', mt: 'rhino', at: [0, 0.3] });
    expect(a.length).toBeGreaterThan(0);
    expect(Math.max(...a)).toBeLessThan(0.08);
  });
});
