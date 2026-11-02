// hero-ball-grip — a ball in a real hero's hand: each grip (a distinct way the hand meets the ball: wrapped, at the
// fingertips, spread across, cradled, pinched, sunk in holes) on a ball of the size it is for, every digit it names on the
// ball's skin and none pressed into it; a ball's own grip chosen by its size and its sport.
import { describe, expect, it } from 'vitest';
import { validateRig } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { ballGrip, gripFor, ballOf, BALL_GRIPS, BALL_GRIP_NAMES } from './hero-ball-grip.js';
import { BALLS } from '../contest/ball-card.js';

const rigOf = (cast) => validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast, head: 'anime' }) }).recipe.rig);
const RIGS = { male: rigOf('male'), female: rigOf('female') };
// a ball each grip is for: the first ball whose own grip it is, else (the cradle names no ball) a big ball on the palm
const ballFor = (g) => Object.keys(BALLS).find((b) => gripFor(b) === g) ?? 'volleyball';

describe('hero-ball-grip', () => {
  it('every grip holds its ball: the digits it names on the skin, none pressed in (a hole\'s aside); the casts alternate', () => {
    BALL_GRIP_NAMES.forEach((g, i) => {
      const R = RIGS[i % 2 ? 'female' : 'male'], b = ballFor(g), G = ballGrip(R, 'R', b, g);
      expect(G.laws, `${g} on ${b}: ${JSON.stringify(G.digits)}`).toEqual({ held: true, clear: true });
      for (const d of BALL_GRIPS[g].hold) expect(G.digits[d].touching, `${g} ${d}`).toBe(true);
      expect(G.centre).toHaveLength(3);
    });
  });
  it('a ball\'s own grip: a bowling ball by its holes, a baseball at the fingertips, then by size', () => {
    expect(gripFor('bowling')).toBe('bowling'); expect(gripFor('baseball')).toBe('fingertip');
    expect(gripFor('golf')).toBe('pinch'); expect(gripFor('softball')).toBe('power'); expect(gripFor('basketball')).toBe('spread');
    expect(gripFor({ radius: 0.2 })).toBe('spread');
  });
  it('the left hand holds as the right does (its mirror); an unknown grip or ball is refused by name', () => {
    expect(ballGrip(RIGS.male, 'L', 'softball', 'power').laws).toEqual({ held: true, clear: true });
    expect(() => ballGrip(RIGS.male, 'R', 'softball', 'claw')).toThrow(/no grip 'claw'/);
    expect(() => ballOf('meteor')).toThrow(/no ball 'meteor'/);
  });
});
