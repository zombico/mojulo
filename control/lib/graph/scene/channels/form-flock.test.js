/**
 * A realistic crown as FLOCK on the page (channels/form-flock.js, drawn by channels/form-flora.js): its puffs a porous
 * sponge marched in the colour pass, its skin its species' own leaves, the sun through its thin parts, its shadow the
 * sponge, whole or none; a page without flock crowns carries none of it.
 */
import { describe, it, expect } from 'vitest';
import { formFloraScript } from './form-flora.js';
import { flockGlsl, flockFragment, flockLight, flockMarch, FLOCK_LOOK, FLOCK_TABLE } from './form-flock.js';

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

  it('bakes its far card from the very march the page runs: a puff seen side-on mostly covered, its holes the sky', () => {
    // (parallel rays into one puff, as a card's texels are: the share that meets the sponge)
    const C = [2, -1, 8], R = 0.7, cover = (D) => { let hit = 0, n = 0;
      for (let i = 0; i < 40; i++) for (let j = 0; j < 40; j++) {
        const u = ((i + 0.5) / 40 * 2 - 1) * R, v = ((j + 0.5) / 40 * 2 - 1) * R; if (u * u + v * v > R * R) continue; n++;
        const w = Math.sqrt(R * R - u * u - v * v), P = D[0] ? [C[0] - D[0] * w, C[1] + u, C[2] + v] : [C[0] + u, C[1] - D[1] * w, C[2] + v];
        if (flockMarch(P, D, C, R, FLOCK_LOOK.sponge, FLOCK_LOOK.shade.cell)) hit++;
      }
      return hit / n; };
    for (const D of [[1, 0, 0], [0, 1, 0]]) { const c = cover(D); expect(c).toBeGreaterThan(0.6); expect(c).toBeLessThan(0.97); }
    // (straight through its middle it is always met: the dense core; and the same ray the same answer)
    expect(flockMarch([C[0] - R, C[1], C[2]], [1, 0, 0], C, R, FLOCK_LOOK.sponge, FLOCK_LOOK.shade.cell)).not.toBeNull();
    expect(flockMarch([C[0], C[1] - R * 0.6, C[2] + R * 0.8], [0, 1, 0], C, R, FLOCK_LOOK.sponge, 0.2)).toEqual(flockMarch([C[0], C[1] - R * 0.6, C[2] + R * 0.8], [0, 1, 0], C, R, FLOCK_LOOK.sponge, 0.2));
    // (the twin's field is the GLSL's: the same hash)
    expect(flockGlsl()).toContain('vec3( 127.1, 311.7, 74.7 )');
    expect(flockMarch.toString()).toContain('x * 127.1 + y * 311.7 + z * 74.7');
    // (the page inlines it and bakes a flock crown's puffs with it, a thin texel marked for the light through; none on another page)
    const src = formFloraScript(flora({ leaves: true, shadow: 'sponge' }));
    expect(src).toContain('const flockMarch = function flockMarch(');
    expect(src).toContain('if (LSI && Math.hypot(o[0], o[1], o[2]) > 1.5) { spongeTri(');
    expect(src).toContain('impA.a > 0.75 && impA.a < 0.9');
    expect(formFloraScript(flora(null))).not.toContain('spongeTri');
  });
});
