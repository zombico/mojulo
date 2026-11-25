import { describe, expect, it } from 'vitest';

import { SPACE_BLAST, spaceBlastScript } from './space-blast.js';

// ── the space blast (space-blast.js): a ship blown up as the effects shops filmed it, a fireball, smoke and debris ──
describe('the space blast', () => {
  it('cools down one ramp, white-hot to soot, its stops in order', () => {
    const at = SPACE_BLAST.ramp.map((s) => s[0]);
    expect(at[0]).toBe(0);
    expect(at[at.length - 1]).toBe(1);
    expect(at.every((v, i) => i === 0 || v > at[i - 1])).toBe(true);
    const lum = (h) => [1, 3, 5].reduce((s, i, k) => s + parseInt(h.slice(i, i + 2), 16) * [0.2126, 0.7152, 0.0722][k], 0);
    const L = SPACE_BLAST.ramp.map((s) => lum(s[1]));
    expect(L.every((v, i) => i === 0 || v < L[i - 1])).toBe(true);
  });

  it('is fire, smoke, debris and embers: no shock rings, no image, its dice seeded', () => {
    const js = spaceBlastScript();
    expect(() => new Function('THREE', 'scene', '__world', js)).not.toThrow();
    expect(js).not.toMatch(/TorusGeometry|RingGeometry|Math\.random|new Image|\.png/);
    for (const k of ['__spaceBlast(', '__spaceBlastAge(', 'NormalBlending', 'AdditiveBlending']) expect(js).toContain(k);
    // (debris flies straight on: nothing pulls it down in space)
    expect(js).not.toMatch(/grav/);
  });
});
