// THE GUN IN THE HANDS IS DRAWN LAST (gunplay-view.js). It clears the depth so it lies over the world; a material that
// is not transparent is drawn before every transparent one whatever its order, so a gun left opaque would clear the
// depth under the world's glass and glows and they would be drawn through every wall. The concept, on the page's own
// text: its materials are marked transparent where its order is set, before the depth is cleared.
import { describe, expect, it } from 'vitest';
import { gunplayScript } from './gunplay-view.js';

describe('the gun in the hands', () => {
  it('sorts with the transparent things, after the whole world, and only then clears the depth', () => {
    const src = gunplayScript(), order = src.indexOf('o.renderOrder = 1e6;'), marked = src.indexOf('m.transparent = true', order), clear = src.indexOf('clearDepth()');
    expect(order).toBeGreaterThan(0);
    expect(marked).toBeGreaterThan(order);
    expect(clear).toBeGreaterThan(marked);
  });
});
