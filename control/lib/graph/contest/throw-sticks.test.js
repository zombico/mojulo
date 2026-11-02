// throw-sticks — the baked throws as a contest page plays them: a stick turned to the thrower's facing and set on its
// spot, the ball in the hand to the release and gone after, the launch the library's (speed, line, spin turned with the
// thrower), aimed through a point by the low arc. One technique (the first) carries the concept; the bake's own freshness
// is throw-sticks.deep.test.js's.
import { describe, expect, it } from 'vitest';
import { throwStick, throwRelease, throwOf, THROW_STICK_NAMES } from './throw-sticks.js';
import { THROW_STICK_JOINTS } from './throw-sticks.data.js';

const name = THROW_STICK_NAMES[0];

describe('throw-sticks', () => {
  it('a stick has every joint, stands on its spot facing its way, and holds the ball until the release', () => {
    const T = throwOf(name), s0 = throwStick(name, 0, { at: [5, 5, 0], face: [1, 0] });
    expect(Object.keys(s0.stick).sort()).toEqual([...THROW_STICK_JOINTS].sort());
    expect(s0.stick.pelvis[0]).toBeCloseTo(5, 3); expect(s0.stick.pelvis[1]).toBeCloseTo(5, 3);
    expect(s0.ball).toHaveLength(3); expect(s0.released).toBe(false);
    const after = throwStick(name, Math.min(1, T.release.u + 0.05), { at: [5, 5, 0], face: [1, 0] });
    expect(after.ball).toBeNull(); expect(after.released).toBe(true);
    // turned with the facing: the same stick a quarter turn round
    const a = throwStick(name, 0.5, { face: [0, 1] }).stick.wristR, b = throwStick(name, 0.5, { face: [1, 0] }).stick.wristR;
    expect(b[0]).toBeCloseTo(a[1], 6); expect(b[1]).toBeCloseTo(-a[0], 6);
  });
  it('the launch: the technique\'s speed and line, the spin turned with the thrower; aimed through a point by the low arc', () => {
    const T = throwOf(name), L = throwRelease(name, { face: [0, 1] });
    expect(Math.hypot(...L.velocity)).toBeCloseTo(T.release.spec.speed, 6);
    expect(L.elevation).toBeCloseTo(T.release.spec.elevation, 6);
    const half = throwRelease(name, { power: 0.5 });
    expect(Math.hypot(...half.velocity)).toBeCloseTo(T.release.spec.speed * 0.5, 6);
    // through a point: a vacuum flight from the release passes it
    const target = [0, 12, 1.5], A = throwRelease(name, { toward: target }), p = A.position, v = A.velocity;
    const t = (target[1] - p[1]) / v[1], z = p[2] + v[2] * t - 4.905 * t * t;
    expect(z).toBeCloseTo(target[2], 2);
    expect(() => throwOf('lob')).toThrow(/no throw 'lob'/);
  });
});
