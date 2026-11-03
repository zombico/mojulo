// hero-catch — catches on a real hero rig: the hands out to the ball's line, palms to it, closing on it at the touch
// already moving back along its line, giving with it over the give's distance, bringing it in; the arms on their places,
// the wrists in range at every key, the body over its feet. One case per procedure: a one-handed catch (the bare hand at
// the shoulder) and a two-handed one (the diamond).
import { describe, expect, it } from 'vitest';
import { validateRig } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { heroCatch, catchBall, CATCHES, SOFT, SOFT_MAX } from './hero-catch.js';

const R = validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast: 'male', head: 'anime' }) }).recipe.rig);
const allTrue = (laws) => Object.fromEntries(Object.keys(laws).map((k) => [k, true]));

describe('hero-catch', () => {
  for (const name of ['oneHand', 'high']) {
    it(`${name}: every law; the give takes the ball's speed over its distance`, () => {
      const C = heroCatch(name, R), K = CATCHES[name];
      expect(C.checks.laws, JSON.stringify(C.checks)).toEqual(allTrue(C.checks.laws));
      // the give's numbers: the hands' speed the technique's share of the ball's (capped), the sting the rest, the force
      // the even slowing over the give's distance
      const v = K.incoming.speed, vh = Math.min(SOFT * v, SOFT_MAX);
      expect(C.give.handSpeed).toBeCloseTo(vh, 3);
      expect(C.give.sting).toBeCloseTo(C.ball.mass * (v - vh), 3);
      expect(C.give.force).toBeCloseTo((C.ball.mass * vh * vh) / (2 * K.give), 1);
      // the ball flies into the hands: just before the touch it is a hand's breadth or two up its line, after it in the hand
      const u = C.contact.t, before = catchBall(C, R, u - 0.01 / C.seconds), at = catchBall(C, R, u);
      expect(Math.hypot(...before.map((q, i) => q - at[i]))).toBeCloseTo(v * 0.01, 1);
      expect(before[1]).toBeGreaterThan(at[1]);   // coming from the +y side
      expect(catchBall(C, R, 1)).toHaveLength(3);
    }, 240000);
  }
  it('another ball and another way in: the give scales with them; an unknown catch is refused', () => {
    const C = heroCatch('oneHand', R, { ball: 'tennis', incoming: { speed: 8 } });
    expect(C.ball.id).toBe('tennis'); expect(C.incoming.speed).toBe(8);
    expect(C.give.handSpeed).toBeCloseTo(SOFT * 8, 3);
    expect(() => heroCatch('juggle', R)).toThrow(/no catch 'juggle'/);
  }, 240000);
});
