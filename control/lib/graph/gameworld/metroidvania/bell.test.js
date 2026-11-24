import { describe, it, expect } from 'vitest';
import { BELL_CARDS, bellFigure, bellHeight, readBellSpec } from './bell.js';

// THE GREAT BELL (bell.js): a card built as a rig figure, its chains still, the bell on its axle, the clapper hung from
// its crown; its moves its clips, the swing back and the swing through, under the names the page's wind-up plays.
const card = Object.keys(BELL_CARDS)[0];

describe('a castle\'s bell', () => {
  it('is a rig of three bones whose clips swing it about its axle, the clapper carried round with it', () => {
    const F = bellFigure({ card });
    expect(F.rig).toBe(true);
    expect(F.bones.map((b) => b.id)).toEqual(['root', 'bell', 'clapper']);
    expect(F.parts.every((p) => p && p.faces > 0)).toBe(true);
    const p = Object.keys(BELL_CARDS[card].swings)[0], W = F.clips[`wind_${p}`], S = F.clips[`strike_${p}`];
    expect(W.k).toBe(2); expect(S.k).toBe(2);
    // (key 0 the rest, key 1 swung: the bell's quaternion turned about +x, its head the axle's, the clapper's head moved)
    const at = (C, k, b) => C.b.slice((k * 3 + b) * 7, (k * 3 + b) * 7 + 7);
    expect(at(W, 0, 1).slice(0, 4)).toEqual([0, 0, 0, 1]);
    expect(Math.abs(at(W, 1, 1)[0])).toBeGreaterThan(0.05);
    expect(at(W, 1, 1).slice(4)).toEqual(F.bones[1].head);
    expect(at(W, 1, 2)[5]).not.toBeCloseTo(F.bones[2].head[1], 3);
    expect(at(S, 0, 1)).toEqual(at(W, 1, 1));
    expect(bellHeight({ card })).toBeGreaterThan(BELL_CARDS[card].height);
    expect(bellFigure({ card })).toEqual(F);
    expect(() => readBellSpec({ card: 'tin' })).toThrow(/card/);
  });
});
