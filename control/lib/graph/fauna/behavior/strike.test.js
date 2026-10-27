// strike — the blow a beast deals, built from its own posed body: a body on legs crouches (the telegraph) and springs
// forward out of it, a legless one rears into its coil and darts; both come home to the stand. The hit lands where the
// clip shows the blow, and an animal without the strike builds as it always did.
import { describe, it, expect } from 'vitest';
import { strikesOf, strikeFrames, strikeTiming, strikeSeconds, strikeWindow, STRIKE_TIMING } from './strike.js';
import { withMotion, packFaunaRig } from '../rig.js';
import { speciesPlan } from '../species.js';
import { motionSpec } from '../../../mcp/tools/animal.js';

const snout = (f) => f.bones.head.tail;
const BRUTE = { startup: 48, active: 8, recovery: 36 };

describe('a beast deals a blow', () => {
  it('on legs or legless on the ground it can strike; a swimmer cannot yet', () => {
    expect(strikesOf('wolf')).toEqual(['strike']);
    expect(strikesOf('snake')).toEqual(['strike']);
    expect(strikesOf('salmon')).toEqual([]);
    expect(() => strikeFrames('salmon')).toThrow(/cannot strike/);
  });

  it('its timing is the attack\'s, and the blow\'s window is its active frames', () => {
    expect(strikeTiming()).toEqual(STRIKE_TIMING);
    expect(strikeSeconds(BRUTE)).toBeCloseTo(92 / 60, 3);
    expect(strikeWindow(BRUTE)).toEqual([0.5217, 0.6087]);
    expect(() => strikeTiming({ startup: 0 })).toThrow(/whole frames/);
  });

  it('a body on legs crouches and draws back, head down, then springs forward of its stand; it comes home', () => {
    const F = strikeFrames('wolf', BRUTE, 93), [from, to] = strikeWindow(BRUTE), at = (u) => F[Math.round(u * 92)];
    expect(JSON.stringify(F[0])).toBe(JSON.stringify(F.at(-1)));
    const windup = at(from - 0.01), blow = at((from + to) / 2);
    expect(snout(windup)[2]).toBeLessThan(snout(F[0])[2]);   // gathered low: the telegraph
    expect(snout(windup)[1]).toBeLessThan(snout(F[0])[1]);   // drawn back: the anticipation
    expect(snout(blow)[1]).toBeGreaterThan(snout(F[0])[1] + 0.1);   // thrown at the mark
    expect(JSON.stringify(strikeFrames('wolf', BRUTE, 93))).toBe(JSON.stringify(F));   // deterministic
  });

  it('a legless body rears into its coil and darts the way its head points', () => {
    const F = strikeFrames('snake', undefined, 55), [from, to] = strikeWindow(), at = (u) => F[Math.round(u * 54)];
    const windup = at(from - 0.01), blow = at((from + to) / 2);
    expect(snout(windup)[2]).toBeGreaterThan(snout(F[0])[2]);   // reared
    expect(Math.hypot(snout(blow)[0] - snout(windup)[0], snout(blow)[1] - snout(windup)[1])).toBeGreaterThan(0.05);   // darted
  });

  it('an animal\'s motion takes it, as a word or at its attack\'s timing; absent, the rig is untouched', () => {
    expect(motionSpec('wolf', ['walk', 'strike'])).toMatchObject({ gaits: ['walk'], strike: true });
    expect(motionSpec('wolf', { strike: BRUTE })).toMatchObject({ gaits: [], strike: BRUTE });
    expect(motionSpec('wolf', ['walk'])).not.toHaveProperty('strike');
    expect(() => motionSpec('salmon', 'strike')).toThrow(/cannot strike/);
    expect(() => motionSpec('wolf', { strike: { wind: 3 } })).toThrow(/startup/);
    const plain = withMotion(speciesPlan('wolf'), 'wolf', ['walk']), armed = withMotion(speciesPlan('wolf'), 'wolf', ['walk'], 24, { strike: BRUTE });
    expect(plain.motion).not.toHaveProperty('strike');
    expect(armed.motion.strike).toEqual(BRUTE);
    expect({ ...armed.motion, strike: undefined }).toEqual({ ...plain.motion, strike: undefined });
  });
});
