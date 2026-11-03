// hero-throw — throws on a real hero rig: the ball leaves the hand at the technique's own speed along its own line, the
// hand holding it to the release and opening after, the arms on their places, the wrists in range at every key, the
// body over its feet. One case per procedure: a one-handed throw from the side stance (the overhand), a two-handed one
// (the chest pass), a left-handed one (the toss).
import { describe, expect, it } from 'vitest';
import { validateRig } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { heroThrow, heldBall, throwNodes, ballProp, THROWS } from './hero-throw.js';

const R = validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast: 'male', head: 'anime' }) }).recipe.rig);
const allTrue = (laws) => Object.fromEntries(Object.keys(laws).map((k) => [k, true]));

describe('hero-throw', () => {
  for (const name of ['overhand', 'chestPass', 'toss']) {
    it(`${name}: every law; the ball leaves at the technique's speed`, () => {
      const T = heroThrow(name, R), K = THROWS[name];
      expect(T.checks.laws, JSON.stringify(T.checks)).toEqual(allTrue(T.checks.laws));
      expect(Math.abs(T.release.speed - K.release.speed) / K.release.speed).toBeLessThan(0.1);
      expect(T.release.spec).toMatchObject({ speed: K.release.speed, elevation: K.release.elevation });
      // held to the release, gone after; the throwing hand open after it
      expect(throwNodes(T, R, T.release.t * 0.5).ball).toHaveLength(3);
      expect(throwNodes(T, R, Math.min(1, T.release.t + 0.05)).ball).toBeNull();
      expect(T.clip.fn(1)[`fingers${T.side}`]).not.toEqual(T.clip.fn(0)[`fingers${T.side}`]);
      if (name === 'overhand') {
        // the ball rides the hand: at the release it is where the clip's hand puts it, and the prop is on that hand's bone
        // (the release's moment is kept to four places: the ball within a millimetre there)
        const b = heldBall(R, T.clip, T.release.t, T.side, T.ball.centreRest);
        expect(Math.hypot(...b.map((v, i) => v - T.release.at[i]))).toBeLessThan(0.001);
        expect(ballProp(R, T).bone).toBe(R.boneIndex.handR);
        expect(T.seconds).toBeGreaterThan(0.5);
      }
    }, 240000);
  }
  it('refuses an unknown throw by name', () => {
    expect(() => heroThrow('lob', R)).toThrow(/no throw 'lob'/);
  });
});
