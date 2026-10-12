// the western face's channels: a word or { word?, …channels }, the blink closing the eye's stack; the words as before;
// one topology at every value (the face in motion differences builds)
import { describe, it, expect } from 'vitest';
import { humanoidHead, EXPRESSIONS, WESTERN_CHANNELS, resolveWesternExpression, westernExpressionErrors } from './humanoid-head.js';
import { validateHeroSpec } from '../../mcp/tools/layered.js';

const head = (expression, features = null) => humanoidHead({ preset: 'female', hair: 'none', expression, ...(features ? { features } : {}) });
const pts = (h, re) => Object.entries(h.parts).filter(([n]) => re.test(n)).flatMap(([, p]) => Object.values(p.offsets ?? p.points ?? {}));

describe('the western face\'s channels', () => {
  it('a word is its channels; an object takes a word\'s (neutral\'s) with its channels over them', () => {
    expect(resolveWesternExpression('smile')).toBe(EXPRESSIONS.smile);
    expect(resolveWesternExpression({ blink: 0.5 })).toEqual({ ...EXPRESSIONS.neutral, blink: 0.5 });
    expect(resolveWesternExpression({ word: 'smile', mouthCorner: 0.002 })).toEqual({ ...EXPRESSIONS.smile, mouthCorner: 0.002 });
    expect(JSON.stringify(head({ word: 'smile' }).parts)).toBe(JSON.stringify(head('smile').parts));
    expect(JSON.stringify(head({ blink: 0 }).parts)).toBe(JSON.stringify(head('neutral').parts));
  });

  it('refuses what is not a channel or out of its range, at the head and at the hero door', () => {
    expect(westernExpressionErrors({ wink: 1 })[0]).toMatch(/not a channel/);
    expect(westernExpressionErrors({ blink: 2 })[0]).toMatch(/expression\.blink: a number in 0 … 1/);
    expect(westernExpressionErrors('grin')[0]).toMatch(/one of neutral/);
    expect(() => head({ blink: -1 })).toThrow(/blink/);
    expect(validateHeroSpec({ cast: 'female', expression: { blink: 1 } })).toEqual([]);
    expect(validateHeroSpec({ cast: 'female', expression: { blink: 3 } })[0]).toMatch(/expression\.blink/);
    expect(WESTERN_CHANNELS).toContain('blink');
  });

  it('the blink closes the eye\'s stack and lowers it; every part keeps its topology', () => {
    for (const ft of [null, { eyeDome: 0.004, lid: { drop: 0.2, fold: 1.2, lower: 0.8 }, lowerLip: 1 }]) {
      const open = head({}, ft), half = head({ blink: 0.5 }, ft), shut = head({ blink: 1 }, ft);
      for (const h of [half, shut]) for (const [n, p] of Object.entries(open.parts)) expect(JSON.stringify(Object.keys(h.parts[n].faces ?? {})), n).toBe(JSON.stringify(Object.keys(p.faces ?? {})));
      // (the eye's points are pin-local: its height is its spread off the line through its two farthest points, its
      // width that line; the depth of a domed eye stays)
      const spread = (h) => {
        const P = pts(h, /^eyeR$/), d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        let A = P[0], B = P[0]; for (const a of P) for (const b of P) if (d(a, b) > d(A, B)) { A = a; B = b; }
        const u = [0, 1, 2].map((k) => (B[k] - A[k]) / d(A, B));
        return Math.max(...P.map((p) => { const v = [0, 1, 2].map((k) => p[k] - A[k]), t = v[0] * u[0] + v[1] * u[1] + v[2] * u[2]; return Math.hypot(v[0] - t * u[0], v[1] - t * u[1], v[2] - t * u[2]); }));
      };
      expect(spread(half)).toBeLessThan(spread(open) * 0.75); expect(spread(shut)).toBeLessThan(spread(open) * (ft ? 0.45 : 0.35));   // (a domed eye keeps its dome's depth)
      // the face around the eyes never moves
      expect(JSON.stringify(shut.parts.cranium)).toBe(JSON.stringify(open.parts.cranium));
    }
  });
});
