// THE GUN IN THE HANDS IS DRAWN LAST (gunplay-view.js). It clears the depth so it lies over the world; a material that
// is not transparent is drawn before every transparent one whatever its order, so a gun left opaque would clear the
// depth under the world's glass and glows and they would be drawn through every wall. The concept, on the page's own
// text: its materials are marked transparent where its order is set, before the depth is cleared.
import { describe, expect, it } from 'vitest';
import { gunplayScript } from './gunplay-view.js';
import { formScript } from '../form.js';

describe('the gun in the hands', () => {
  it('sorts with the transparent things, after the whole world, and only then clears the depth', () => {
    const src = gunplayScript(), order = src.indexOf('o.renderOrder = 1e6;'), marked = src.indexOf('m.transparent = true', order), clear = src.indexOf('clearDepth()');
    expect(order).toBeGreaterThan(0);
    expect(marked).toBeGreaterThan(order);
    expect(clear).toBeGreaterThan(marked);
  });
  it('is lit by the form render\'s own light on a page drawn as form, and is the paint it was on a painted page', () => {
    const src = gunplayScript();
    // (one material maker for the gun and the hands: the page's light where the form hands it one, else paint)
    expect(src).toContain('function __gpMatOf(kind, side)');
    expect(src).toContain('window.__mojForm && window.__mojForm.light');
    expect((src.match(/__gpMatOf\('metal'/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(src).toContain("__gpMatOf('cloth')");
    // (lit: the lamps and the ambient the form's own uniforms, the page's depth and its tone curve the same as the room's)
    for (const k of ['uFLp: U.uFLp', 'uFLk: U.uFLk', 'uFAmb: U.uFAmb', '#include <logdepthbuf_fragment>', '#include <tonemapping_fragment>']) expect(src).toContain(k);
    // (a colour laid unshaded where the light shades it: the baked turn-to-the-light is the painted page's alone)
    expect(src).toContain('const k = LIT ? 1 :');
    expect(formScript({ lights: [{ at: [0, 0, 3], key: [1, 1, 1], radius: 6, live: true }], ambient: [0.2, 0.2, 0.2], fall: 2, maps: {} })).toContain('probe.light = { U, K }');
  });
});
