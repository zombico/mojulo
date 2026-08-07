import { describe, expect, it } from 'vitest';

import { buildMathRules, MATH_RULES } from './math-rules-kernel.js';

const EDGES = [
  { id: 'e1', a: 'A', b: 'B' },
  { id: 'e2', a: 'B', b: 'C' },
  { id: 'e3', a: 'C', b: 'A' },
];

describe('buildMathRules — consumable-edge reducer', () => {
  it('crosses adjacent bridges and advances the current node', () => {
    const K = buildMathRules();
    const t = K.makeTrail('A');
    expect(K.cross(EDGES, t, 'e1')).toMatchObject({ ok: true, from: 'A', to: 'B' });
    expect(t.at).toBe('B');
    expect(t.crossings).toEqual(['e1']);
  });

  it('retracts a crossed bridge — you cannot cross it twice', () => {
    const K = buildMathRules();
    const t = K.makeTrail('A');
    K.cross(EDGES, t, 'e1');       // A→B
    K.cross(EDGES, t, 'e2');       // B→C
    K.cross(EDGES, t, 'e3');       // C→A
    // every bridge is now retracted; from A there is no open bridge
    expect(K.cross(EDGES, t, 'e1')).toMatchObject({ ok: false, reason: 'bridge-retracted' });
    expect(K.complete(EDGES, t)).toBe(true);
    expect(K.stuck(EDGES, t)).toBe(false);
  });

  it('refuses a non-adjacent bridge', () => {
    const K = buildMathRules();
    const t = K.makeTrail('A');
    expect(K.cross(EDGES, t, 'e2')).toMatchObject({ ok: false, reason: 'not-adjacent' });
  });

  it('is self-contained — buildMathRules.toString() references nothing outside itself', () => {
    // the browser world runs the SAME source via .toString(); a free identifier would break there.
    const src = buildMathRules.toString();
    expect(src).not.toMatch(/\bimport\b/);
    expect(src).not.toMatch(/\brequire\(/);
    // reconstruct from source and confirm it behaves identically to the live instance
    const rebuilt = new Function(`return (${src})()`)();
    const t1 = MATH_RULES.makeTrail('A'); const t2 = rebuilt.makeTrail('A');
    expect(MATH_RULES.cross(EDGES, t1, 'e1')).toEqual(rebuilt.cross(EDGES, t2, 'e1'));
  });
});
