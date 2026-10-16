import { describe, expect, it } from 'vitest';
import { composeLive } from './compose.js';

// THE RIGHT-HAND PEEKER'S ADVANTAGE, from where the gun is: a gun in hand (`weapon.hand`) has its muzzle a shoulder's
// width off the eye's line, and a shot clears a corner from the muzzle. A mind that peeks (`rule.peek`) sidesteps to the
// nearest spot that clears its eye and its gun: past an edge on its gun's side that is a short step with little of it
// out; past one on the other side its body leads and its gun follows. One corner, peeked from either side of it.

const E = composeLive();
const hooks = { ground: () => 0 };
const PERSON = { a: 0.35, c: 0.9, cz: 0.9 };
const gun = (hand) => ({ fireClass: 'sight', auto: false, cooldown: 0.5, magazine: 6, reload: 2, damage: 1, range: 40, coreAngle: 1.5, eye: 1.4, ...(hand ? { hand } : {}) });
const bot = (id, pos, heading, hand, extra = {}) => ({
  id, rule: { type: 'ai', mind: { motivation: 'hunt', perception: 'memory' }, peek: true, target: 'all', sightRange: 40, sightCone: 1.4, standoff: 30, speed: 3, turn: 4, dodge: false, burst: 0.3, pause: 1, eye: 0, collideRadius: 0.3, collideHeight: 1.7, step: 0.3, ...extra },
  weapon: gun(hand), body: { type: 'mesh', hittable: true, hp: 9, poise: 9, radius: 0.6, egg: { ...PERSON } }, transform: { pos, heading, pitch: 0 },
});
// the corner: a wall between the peeker (facing north) and the one holding the angle, its edge on the peeker's right;
// `mirror` puts the edge on its left
const corner = (mirror) => {
  const m = mirror ? -1 : 1;
  return { wall: mirror ? { min: [-0.5, 2, 0], max: [6, 2.6, 3] } : { min: [-6, 2, 0], max: [0.5, 2.6, 3] }, foe: [4 * m, 16, 0], start: [-1.2 * m, 0, 0] };
};

describe('a gun in hand', () => {
  it('its muzzle is a shoulder off the eye, to its hand\'s side; without a hand, at the eye as before', () => {
    const w = E.createWorld({ entities: [bot('r', [0, 0, 0], Math.PI / 2, 'right'), bot('l', [5, 0, 0], Math.PI / 2, 'left'), bot('n', [10, 0, 0], Math.PI / 2, null)] });
    const at = (id) => E.muzzleAt(w.byId[id], w.byId[id].weapon);
    expect(at('r')[0]).toBeCloseTo(0 + E.HAND.r, 6);
    expect(at('l')[0]).toBeCloseTo(5 - E.HAND.r, 6);
    expect(at('n')).toEqual([10, 0, 1.4]);
    expect(w.byId.n.weapon.muzzleOffset).toBe(null);
  });
});

describe('the right-hand peek', () => {
  it('past an edge on its gun\'s side it is ready with a shorter step and less of it out', () => {
    const spot = (mirror, hand) => {
      const C = corner(mirror), w = E.createWorld({ colliders: [C.wall], entities: [bot('p', [0, 0, 0], Math.PI / 2, hand)] });
      return E.mindPeekSpot(w.byId.p, w.byId.p.rule, { colliders: [C.wall] }, C.foe);
    };
    const gunSide = spot(false, 'right'), offSide = spot(true, 'right');
    expect(gunSide.side).toBe(1);
    expect(offSide.side).toBe(-1);
    expect(gunSide.k).toBeLessThan(offSide.k);
    expect(gunSide.exposure).toBeLessThan(offSide.exposure);
    // a left hand is the mirror of it: the same step, the same body out
    const left = spot(true, 'left');
    expect([left.k, left.exposure]).toEqual([gunSide.k, gunSide.exposure]);
  });

  it('a duel at the corner: peeking from its gun\'s side it lands the first hit; from the other, the holder does', () => {
    const duel = (mirror) => {
      const C = corner(mirror);
      const w = E.createWorld({ colliders: [C.wall], entities: [bot('p', C.start, Math.PI / 2, 'right'), bot('h', C.foe, -Math.PI / 2, 'right', { peek: false, speed: 0 })] });
      const p = w.byId.p, h = w.byId.h;
      p.lastSeen = { pos: C.foe.slice(), t: 0, id: 'h' };
      let first = null;
      for (let n = 0; n < 30 * 4 && !first; n++) {
        E.stepWorld(w, {}, 1 / 30, hooks);
        if ((h.hits || 0) > 0) first = 'peeker'; else if ((p.hits || 0) > 0) first = 'holder';
      }
      return first;
    };
    expect(duel(false)).toBe('peeker');
    expect(duel(true)).toBe('holder');
  });

  it('a peek that finds nothing steps back to where it stood', () => {
    const C = corner(false);
    // a match player with no one in sight peeks where it last saw a foe (who has since gone)
    const w = E.createWorld({ colliders: [C.wall], entities: [bot('p', C.start, Math.PI / 2, 'right', { mind: { motivation: 'frag', perception: 'memory' } })] });
    const p = w.byId.p;
    p.lastSeen = { pos: C.foe.slice(), t: 0, id: 'gone' };
    for (let n = 0; n < 30 * 1; n++) E.stepWorld(w, {}, 1 / 30, hooks);
    expect(Math.hypot(p.transform.pos[0] - C.start[0], p.transform.pos[1] - C.start[1])).toBeGreaterThan(0.5);
    for (let n = 0; n < 30 * 4; n++) E.stepWorld(w, {}, 1 / 30, hooks);
    expect(Math.hypot(p.transform.pos[0] - C.start[0], p.transform.pos[1] - C.start[1])).toBeLessThan(0.05);
    expect(p.peek).toBe(null);
  });
});
