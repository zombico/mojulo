// hero-kick — the kicks' laws on a real hero rig: each starts and ends on the fist's guard, its standing foot never
// leaves its spot, its kicking foot lands ahead of the body at its contact, its knee is folded in the chamber and open
// at the strike (the knee strike aside), and it moves smoothly: no frame jumps.
import { describe, expect, it } from 'vitest';
import { validateRig, rigNodesAt } from './station-loft-rig.js';
import { heroKick, KICKS, KICK_NAMES } from './hero-kick.js';
import { heroStrike } from './hero-strike.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';

const R = validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast: 'male' }) }).recipe.rig);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const bend = (n) => { const a = [n.hipL[0] - n.kneeL[0], n.hipL[1] - n.kneeL[1], n.hipL[2] - n.kneeL[2]], b = [n.ankleL[0] - n.kneeL[0], n.ankleL[1] - n.kneeL[1], n.ankleL[2] - n.kneeL[2]]; return 180 - (Math.acos((a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b))) * 180) / Math.PI; };

describe('the kicks', () => {
  for (const name of KICK_NAMES) {
    it(`${name}: out of the guard and back, planted, landing ahead, smooth`, () => {
      const K = heroKick(name, R), N = (u) => rigNodesAt(R, K.clip.fn(u)).nodes, tm = KICKS[name].timing;
      const guard = rigNodesAt(R, heroStrike('jab', R).clip.fn(0)).nodes, n0 = N(0), n1 = N(1), nc = N(tm.contact), nch = N(tm.chamber);
      // the guard at both ends: it chains with a punch with no step between
      for (const j of ['ankleL', 'ankleR', 'wristL', 'wristR', 'headTop']) { expect(dist(n0[j], guard[j])).toBeLessThan(1e-3); expect(dist(n1[j], guard[j])).toBeLessThan(1e-3); }
      // the standing foot holds its spot; nothing jumps between two frames (a sixtieth of the clip)
      let step = 0, prev = n0;
      for (let i = 1; i <= 60; i++) { const n = N(i / 60); expect(dist(n.toeTipR, n0.toeTipR)).toBeLessThan(0.02); step = Math.max(step, dist(n.ankleL, prev.ankleL)); prev = n; }
      // (the foot's fastest, in metres a second: a kick's snap, never a pop)
      expect((step * 60) / K.seconds).toBeLessThan(20);
      // the kicking foot is off the floor and ahead of the hips at the contact
      expect(nc.ankleL[2]).toBeGreaterThan(n0.ankleL[2] + 0.2);
      expect(nc[name === 'knee' ? 'kneeL' : 'ankleL'][1]).toBeGreaterThan(nc.pelvisHub[1] + (name === 'knee' ? 0.3 : 0.55));
      // chambered, then open (a knee stays folded: it is the knee that lands)
      expect(bend(nch)).toBeGreaterThan(95);
      if (name === 'knee') expect(bend(nc)).toBeGreaterThan(110); else expect(bend(nc)).toBeLessThan(25);
      expect(K.hand).toBe('L');
      expect(K.contact.t).toBeCloseTo(tm.contact * K.seconds, 3);
    });
  }
  it('a round kick comes in from the side; a word it lacks is refused', () => {
    const K = heroKick('roundKick', R), tm = KICKS.roundKick.timing, ch = rigNodesAt(R, K.clip.fn(tm.chamber)).nodes, c = rigNodesAt(R, K.clip.fn(tm.contact)).nodes;
    // (the knee out to the kicking side in the chamber, the foot swung in across the body's line by the contact)
    expect(ch.kneeL[0]).toBeLessThan(ch.pelvisHub[0] - 0.2);
    expect(c.ankleL[0]).toBeGreaterThan(ch.ankleL[0] + 0.15);
    expect(() => heroKick('axeKick', R)).toThrow(/no kick/);
  });
});
