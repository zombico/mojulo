/**
 * A realistic crown as FLOCK on the page (channels/form-flock.js, drawn by channels/form-flora.js): its puffs a porous
 * sponge marched in the colour pass, its skin its species' own leaves, the sun through its thin parts, its shadow the
 * sponge, whole or none; a page without flock crowns carries none of it.
 */
import { describe, it, expect } from 'vitest';
import { formFloraScript } from './form-flora.js';
import { flockGlsl, flockFragment, flockLight, FLOCK_LOOK, FLOCK_TABLE } from './form-flock.js';

const flora = (flock) => ({ templates: [], n: 0, trees: '', lod: { detail: [6, 16], mid: 25, sprayed: 6 }, leafRef: [0.1, 0.2, 0.1], barks: {}, ...(flock ? { flock } : {}) });
const parses = (src) => new Function('THREE', 'scene', 'D', 'bytes', 'camera', 'sunLight', src);

describe('a realistic crown as flock', () => {
  it('carries none of it on a page without flock crowns', () => {
    const src = formFloraScript(flora(null));
    for (const k of ['FLOCK', 'flock', 'spongeMarch', 'leafMarch', 'spMpp', 'uSunW']) expect(src).not.toContain(k);
  });

  it('marches the sponge in its puffs, with its leaves when they are on, the sun through its thin parts', () => {
    const on = formFloraScript(flora({ leaves: true, shadow: 'sponge' })), bare = formFloraScript(flora({ leaves: false, shadow: 'sponge' }));
    expect(() => parses(on)).not.toThrow();
    expect(() => parses(bare)).not.toThrow();
    expect(on).toContain("(flock ? '-flock' : '')");
    expect(on).toContain('leafMarch');
    expect(on).toContain(`uLeafW[ ${FLOCK_TABLE} ]`);
    expect(bare).toContain('spongeMarchT');
    expect(bare).not.toContain('leafMarch');
    // (in place of the mass's leaf cells, on a flock crown alone; every other crown keeps them)
    expect(on).toContain('(flock ? FLOCK.frag : MASS_CELLS)');
    expect(flockFragment({ leaves: true })).toContain('if ( spHit < 0.0 ) discard;');
    expect(flockLight()).toContain('spThin');
    // (deterministic: the same source each time, no dice)
    expect(flockGlsl({ leaves: true })).toBe(flockGlsl({ leaves: true }));
    expect(flockGlsl()).not.toMatch(/Math\.random|Date/);
  });

  it('casts the sponge\'s shadow, its puffs\' whole, or none', () => {
    const src = formFloraScript(flora({ leaves: true, shadow: 'none' }));
    expect(src).toContain("if (FLOCK.shadow === 'none') parts.crown.im.castShadow = false; else if (FLOCK.shadow === 'sponge') parts.crown.im.customDepthMaterial = flockDepth(leaf.userData.flockU);");
    expect(src).toContain("customProgramCacheKey = () => 'form-flock-depth'");
    expect(src).toContain('"shadow":"none"');
  });

  it('is porous at the skin and dense at the core, its leaves thinning out under a few pixels', () => {
    expect(FLOCK_LOOK.sponge.skin).toBeGreaterThan(FLOCK_LOOK.sponge.core);
    expect(FLOCK_LOOK.leaf.px[0]).toBeLessThan(FLOCK_LOOK.leaf.px[1]);
    expect(FLOCK_LOOK.shade.skin).toBeGreaterThan(FLOCK_LOOK.shade.core);
  });
});
