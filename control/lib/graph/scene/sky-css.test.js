/**
 * Codifies the atmosphere layer: the CSS sky backdrop (skyCss, reusing the
 * painted-landscape deriveSky) and the cool directional moonlight key.
 */

import { describe, it, expect } from 'vitest';
import { skyCss } from './sky-css.js';
import { applyMoonlight } from './scene-css3d.js';

const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

describe('skyCss — painted-landscape sky as a CSS backdrop', () => {
  it('always produces a horizon→zenith gradient backdrop', () => {
    expect(skyCss({ preset: 'day' })).toContain('linear-gradient(to bottom');
  });

  it('day has a warm sun glow; night has a moon disc + stars', () => {
    const day = skyCss({ preset: 'day' });
    const night = skyCss({ preset: 'night' });
    expect(day).toContain('radial-gradient(circle at');     // the sun glow
    expect(night).toContain('rgba(255,255,255');            // star dots
    expect(night).toMatch(/radial-gradient\(circle at .*rgb\(232,238,252\)/); // the pale moon disc
    expect(day).not.toBe(night);
  });

  it('is deterministic (seeded stars repeat byte-for-byte)', () => {
    expect(skyCss({ preset: 'night', seed: 4 })).toBe(skyCss({ preset: 'night', seed: 4 }));
  });
});

describe('applyMoonlight — cool directional key', () => {
  it('brightens toward cool blue, strongest on moon-facing surfaces', () => {
    const up = { corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], fill: '#202020' };   // normal +z (toward a high moon)
    const side = { corners: [[2, 0, 0], [2, 0, 1], [2, 1, 1], [2, 1, 0]], fill: '#202020' };  // normal ±x (grazing)
    const [u, s] = applyMoonlight([up, side]);
    const [ur, , ub] = rgbOf(u.fill), [, , sb] = rgbOf(s.fill);
    expect(ub).toBeGreaterThan(ur);   // cool: blue lifted more than red
    expect(ub).toBeGreaterThan(sb);   // the moon-facing (up) face out-lit the grazing one
    expect(ur).toBeGreaterThan(0x20); // and it is brighter than the unlit base
  });

  it('washes a CSS-bg (facade) face with a cool layer over its existing background', () => {
    const facade = { corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], bg: 'repeating-linear-gradient(#123,#456)' };
    const [out] = applyMoonlight([facade]);
    expect(out.bg).toContain('repeating-linear-gradient(#123,#456)'); // base preserved underneath
    expect(out.bg.indexOf('rgba(')).toBeLessThan(out.bg.indexOf('repeating')); // cool wash on top
  });
});
