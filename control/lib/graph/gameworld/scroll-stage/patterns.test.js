// The foes' fire and the foes (scroll-stage/patterns.js). The concepts: the shipped patterns hold their laws (seen
// coming, a way through, told), and each law loses where a row breaks it; a foe and its pattern are lowered to metres,
// only the foes named carried, with the ship's hitbox, the safe distance and the foes' one hue no pod uses.
import { describe, it, expect } from 'vitest';
import { PATTERNS, FOES, FOE_IDS, FOE_HUE, HITBOX, SEEN, patternLaws, lowerFoes } from './patterns.js';
import { PODS } from './pods.js';

const law = (rows, id) => patternLaws(rows).find((l) => l.id === id).holds;
const ringLike = Object.keys(PATTERNS).find((id) => PATTERNS[id].spread >= 360);
const wallLike = Object.keys(PATTERNS).find((id) => PATTERNS[id].gap !== undefined);

describe('the foes\' fire', () => {
  it('the shipped patterns hold their laws', () => {
    for (const l of patternLaws()) expect(l.holds, l.says).toBe(true);
  });

  it('a law loses where a row breaks it: too fast, shut, untold', () => {
    const P = PATTERNS[ringLike];
    expect(law({ ...PATTERNS, x: { ...P, speed: SEEN * 1.5 } }, 'seen-coming')).toBe(false);
    expect(law({ ...PATTERNS, x: { ...P, shots: 90 } }, 'a-way-through')).toBe(false);
    expect(law({ ...PATTERNS, x: { ...PATTERNS[wallLike], gap: HITBOX } }, 'a-way-through')).toBe(false);
    expect(law({ ...PATTERNS, x: { ...P, tell: 0 } }, 'told')).toBe(false);
  });

  it('the foes\' bullets are one hue no pod uses', () => {
    expect(Object.values(PODS).map((p) => p.hue)).not.toContain(FOE_HUE);
  });

  it('a foe and its pattern are lowered to metres, only the foes named carried', () => {
    const armed = FOE_IDS.find((id) => FOES[id].pattern), A = lowerFoes([armed], { L: 10, S: 80 }), P = PATTERNS[FOES[armed].pattern];
    expect(Object.keys(A.foes)).toEqual([armed]);
    expect(Object.keys(A.patterns)).toEqual([FOES[armed].pattern]);
    expect(A.patterns[FOES[armed].pattern].speed).toBeCloseTo(P.speed * 80, 6);
    expect(A.foes[armed].speed).toBeCloseTo(FOES[armed].speed * 80, 6);
    expect(A.hitbox).toBeCloseTo(HITBOX * 10, 6);
    expect(A.hue).toBe(FOE_HUE);
    expect(() => lowerFoes(['kraken'], { L: 10, S: 80 })).toThrow(/not a foe/);
  });
});
