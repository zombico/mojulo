/**
 * The view cone (scene/channels/view-cone.js): full detail where the screen can show it. Its reach is the screen's (a
 * tall blade under its pixels), or a world's in metres; a reach out of range is refused; the page's block parses, and
 * the form channel carries it before its grass.
 */
import { describe, expect, it } from 'vitest';

import { VIEW_CONE, readCone, viewConeScript } from './view-cone.js';
import { GRASS_TIERS } from './form-grass.js';

// a pixel's size at a metre, at a vertical fov (deg) and a canvas's height (device px), as the page measures it
const pxAt = (fov, h) => (2 * Math.tan((fov * Math.PI) / 360)) / h;
const reachOf = (fov, h) => VIEW_CONE.blade / (VIEW_CONE.px * pxAt(fov, h));

describe('view cone', () => {
  it('its ruler is the tall grass blade, and its screen reach grows with the screen and narrows with the lens', () => {
    const tall = GRASS_TIERS.find((t) => t.sward === 'tall');
    expect(VIEW_CONE.blade).toBeGreaterThanOrEqual(tall.clump.width[0] * tall.scale);
    expect(VIEW_CONE.blade).toBeLessThanOrEqual(tall.clump.width[1] * tall.scale);
    expect(reachOf(60, 2160)).toBeCloseTo(2 * reachOf(60, 1080), 6);
    expect(reachOf(30, 1080)).toBeGreaterThan(reachOf(60, 1080));
    // (a common screen's reach lands inside the range, so the clamp is a guard, not the rule)
    const r = reachOf(60, 1080);
    expect(r).toBeGreaterThan(VIEW_CONE.range[0]);
    expect(r).toBeLessThan(VIEW_CONE.range[1]);
  });

  it('a world fixes it in metres, or leaves it to the screen; anything else is refused', () => {
    expect(readCone(undefined)).toBe(null);
    expect(readCone(null)).toBe(null);
    expect(readCone(40)).toEqual({ reach: 40 });
    expect(readCone({ reach: 25 })).toEqual({ reach: 25 });
    for (const bad of [0, VIEW_CONE.range[1] + 1, 'far', [40], { reach: 'x' }, NaN]) expect(() => readCone(bad)).toThrow(/cone is the view cone/);
  });

  it('true asks for the screen\'s reach, on a page without the form render too', () => {
    expect(readCone(true)).toEqual({ reach: null });
    expect(viewConeScript({ reach: null })).toContain('let fixed = null;');
  });

  it('the page\'s block parses, carries the fixed reach only when there is one, and adjusts live', () => {
    const screen = viewConeScript(), fixed = viewConeScript({ reach: 40 });
    for (const src of [screen, fixed]) expect(() => new Function('THREE', 'scene', src)).not.toThrow();
    expect(screen).toContain('let fixed = null;');
    expect(fixed).toContain('let fixed = 40;');
    expect(screen).toContain('window.__mojCone = K;');
    expect(screen).toContain('scene.onBeforeRender = function');
    expect(screen).toContain("e.key === '['");
  });
});
