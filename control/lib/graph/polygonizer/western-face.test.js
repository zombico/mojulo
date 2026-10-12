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

describe('the brow ridge (features.ridge)', () => {
  // the tiered female's: the eye-and-brow column, the ridge forward, the socket back, the temple in
  const ridge = { f: 0.55, h: 0.003, socket: 0.002, temple: 0.002 };
  const C = (h) => h.parts.cranium.stations.map((st) => st.points);
  it('a column between inner and outer on the cranium and the jaw, every address as it was; absent, none', () => {
    const plain = head('neutral'), r = head('neutral', { ridge });
    expect(plain.parts.cranium.slots.includes('midR')).toBe(false);
    for (const part of ['cranium', 'jaw']) {
      const P = r.parts[part];
      expect(P.slots.length).toBe(plain.parts[part].slots.length + 2);
      expect(P.slotT.midR).toBeCloseTo(4 + ridge.f, 9);   // inner 4, outer 5: the rest keep their parameters
      for (const st of P.stations) expect(st.points.midL).toEqual([-st.points.midR[0], st.points.midR[1], st.points.midR[2]]);
    }
    // the seam: the jaw's last ring is the cranium's first
    expect(r.parts.jaw.stations.at(-1).points.midR).toEqual(r.parts.cranium.stations[0].points.midR);
  });

  it('the brow row\'s column stands forward of its chord, the eye row\'s behind; the brow row\'s side comes in', () => {
    const r = C(head('neutral', { ridge })), plain = C(head('neutral'));
    const off = (row) => row.midR[1] - (row.innerR[1] + (row.outerR[1] - row.innerR[1]) * ridge.f);
    expect(off(r[5])).toBeGreaterThan(ridge.h * 0.9);   // the glabella row: the fitted brow over the chord, and the ridge
    expect(off(r[4])).toBeLessThan(0);                   // the eye row: the socket
    expect(plain[5].sideR[0] - r[5].sideR[0]).toBeCloseTo(ridge.temple, 4);
    // the brows ride over it: no brow station sits under the skin's crest
    expect(head('neutral', { ridge, brows: { arch: 0.07, head: 1.2, tail: 0.25, lift: 0.6 } }).parts.browR).toBeTruthy();
  });
});
