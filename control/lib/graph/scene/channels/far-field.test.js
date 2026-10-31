/**
 * The far field (scene/channels/far-field.js): past the view cone's reach the grass is a blanket in the ground's own
 * shader and a fringe of strands only on the land's contour, painted in 2D over the frame drawn once. The blocks parse,
 * and the form channel carries the blanket in its ground and the contour pass after its grass.
 */
import { describe, expect, it } from 'vitest';

import { FAR_FIELD, FAR_BLANKET_GLSL, farFieldScript } from './far-field.js';
import { formLandScript } from './form-land.js';

const land = { light: { sun: [1, 1, 1], ambient: [0.2, 0.2, 0.2] } };

describe('the far field', () => {
  it('spends the grass on the contour: a fringe a few pixels tall where the edge meets what is past it', () => {
    expect(FAR_FIELD.fringe).toBeGreaterThanOrEqual(1);
    expect(FAR_FIELD.fringe).toBeLessThanOrEqual(4);
    expect(FAR_FIELD.edge).toBeGreaterThan(1);
    expect(farFieldScript()).toContain('viewW( b + ivec2( 0, 1 ) ) < wb * ');
  });

  it('draws the frame once: the blanket in the ground, the contour over the frame, the tone curve last', () => {
    const src = farFieldScript();
    expect(() => new Function('THREE', 'scene', 'renderer', 'LAYER_U', src)).not.toThrow();
    expect(src).not.toContain('cc.near');
    expect(src.match(/R0\(s, c\)/g)).toHaveLength(2);
    expect(src).toContain('#include <tonemapping_fragment>');
    expect(FAR_BLANKET_GLSL).toContain('vec4 farBlanket( vec3 P, vec3 nW )');
  });

  it('the form channel carries the blanket in its ground and the contour after its grass', () => {
    const page = formLandScript(land);
    expect(page).toContain('farBlanket( vWPos, nW )');
    expect(page.indexOf('window.__formFar = {')).toBeLessThan(page.indexOf('the far field: the blanket past'));
  });
});
