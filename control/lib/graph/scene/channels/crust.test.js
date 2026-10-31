/**
 * The crust (scene/channels/crust.js): the far image past the view cone's reach, painted in 2D. Grass there is a blanket
 * of one colour offset by its cells, and a fringe of strands only on the land's contour; the page's block parses, and the
 * form channel carries it after its grass.
 */
import { describe, expect, it } from 'vitest';

import { CRUST, crustScript } from './crust.js';
import { formLandScript } from './form-land.js';

describe('the crust', () => {
  it('spends the grass on the contour: a fringe a few pixels tall where the edge meets what is past it', () => {
    expect(CRUST.fringe).toBeGreaterThanOrEqual(1);
    expect(CRUST.fringe).toBeLessThanOrEqual(4);
    expect(CRUST.edge).toBeGreaterThan(1);
    const src = crustScript();
    expect(src).toContain('viewW( b + ivec2( 0, 1 ) ) < wb * ');
    expect(src).toContain('the BLANKET');
  });

  it('draws the main slice to the reach over the painted crust, and only in POV', () => {
    const src = crustScript();
    expect(() => new Function('THREE', 'scene', 'renderer', 'LAYER_U', src)).not.toThrow();
    expect(src).toContain('cc.near = R');
    expect(src).toContain('c.far = R');
    expect(src).toContain('!FF.pov()');
  });

  it('the form channel carries it after its grass', () => {
    const page = formLandScript({ light: { sun: [1, 1, 1], ambient: [0.2, 0.2, 0.2] } });
    expect(page.indexOf('window.__formFar = {')).toBeLessThan(page.indexOf('the crust: the far image'));
  });
});
