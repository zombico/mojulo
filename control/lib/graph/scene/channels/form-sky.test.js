/**
 * The form render's sky (scene/channels/form-sky.js): the light that lights the land, seen. Its air's level is the solved
 * sky light's (by luminance, the palette its hue), its sun the solved sun, its clouds the recipe's weather, its haze the
 * air where the far land stands; it takes the place of what the stage painted for the sky. The block parses.
 */
import { describe, expect, it } from 'vitest';

import { FORM_SKY, formSkyScript, formSkyInput } from './form-sky.js';
import { emitThreeWorld } from '../scene-three.js';
import { formLandScript } from './form-land.js';
import { WEATHERS } from '../../matte-paint/sky.js';

describe('the form render\'s sky', () => {
  it('draws the air at the solved sky light\'s level, its hue the palette\'s, through the land\'s tone curve', () => {
    const src = formSkyScript();
    expect(() => new Function('THREE', 'scene', 'D', 'meshes', src)).not.toThrow();
    expect(src).toContain('a = lum(amb) / Math.max(1e-6, lum(shape) / wsum)');
    expect(src).toContain('#include <tonemapping_fragment>');
    expect(FORM_SKY.mie.g).toBeGreaterThan(0);
    expect(FORM_SKY.mie.g).toBeLessThan(1);
  });

  it('has a cloud layer for every weather the recipe can name, its cover within 0..1', () => {
    for (const k of Object.keys(WEATHERS)) {
      const K = FORM_SKY.clouds.kinds[k];
      expect(K, k).toBeTruthy();
      expect(K.cover[0]).toBeGreaterThanOrEqual(0);
      expect(K.cover[1]).toBeLessThanOrEqual(1);
    }
  });

  it('takes the place of the stage\'s painted sky, keeps a night\'s stars and moon, and hazes the far land in its air', () => {
    const src = formSkyScript();
    expect(src).toContain("o.userData.g === 'isekai:cloud' || o.renderOrder === -1.5 || (o.isSprite && o.renderOrder === -1 && day >= 0.5)");
    expect(src).toContain('scene.fog.color.setRGB(hz[0], hz[1], hz[2], THREE.LinearSRGBColorSpace)');
    expect(formLandScript({ light: { sun: [1, 1, 1], ambient: [0.2, 0.2, 0.2] } })).toContain('the light that lights the land, seen');
  });

  it('on a page without the form render (a gen-7 geocity) its light is the cube\'s own sky colours, and only when asked', () => {
    const I = formSkyInput({ sun: [0, -0.5, 0.86], zenith: [52, 122, 214], horizon: [200, 228, 246] });
    expect(I.light.ambient.every((v) => v > 0 && v < 1)).toBe(true);
    expect(I.light.sun[0]).toBeGreaterThan(I.light.ambient[0]);
    const face = { corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0]], normal: [0, 0, 1], fill: '#888888' };
    const withSky = emitThreeWorld({ faces: [face], formSky: { sun: [0, -0.5, 0.86], zenith: [52, 122, 214], horizon: [200, 228, 246] } });
    expect(withSky).toContain('the gen-7 sky over a page without the form render');
    expect(emitThreeWorld({ faces: [face] })).not.toContain('the gen-7 sky over a page without the form render');
  });
});
