/**
 * The far field (scene/channels/far-field.js): past the view cone's reach the grass is a blanket in the ground's own
 * shader, and strokes stand only on the land's contour, surveyed from the eye's point of view. The blocks parse, and the
 * form channel carries the blanket in its ground and the far field after its grass.
 */
import { describe, expect, it } from 'vitest';

import { FAR_FIELD, FAR_BLANKET_GLSL, farFieldScript } from './far-field.js';
import { formLandScript } from './form-land.js';
import { contourScan } from '../../form/survey.js';

const land = { light: { sun: [1, 1, 1], ambient: [0.2, 0.2, 0.2] } };

describe('the far field', () => {
  it('spends the grass on the contour: strokes a pixel wide and a few tall, where the land peaks against what is past it', () => {
    expect(FAR_FIELD.fringe).toBeGreaterThanOrEqual(1);
    expect(FAR_FIELD.fringe).toBeLessThanOrEqual(4);
    expect(FAR_FIELD.edge).toBeGreaterThan(1);
    // (the surveyor is embedded whole: the page and the CLI run the same scan)
    expect(farFieldScript()).toContain(contourScan.toString());
  });

  it('draws the frame once to the canvas: the blanket in the ground, the strokes in one draw, no image read back', () => {
    const src = farFieldScript();
    expect(() => new Function('THREE', 'scene', 'LAYER_U', src)).not.toThrow();
    expect(src).not.toContain('WebGLRenderTarget');
    expect(src).not.toContain('renderer.render');
    expect(src).toContain("customProgramCacheKey = () => 'far-field-strokes'");
    expect(FAR_BLANKET_GLSL).toContain('vec4 farBlanket( vec3 P, vec3 nW )');
  });

  it('solves a point of view once a cell, keeps it once walked, and solves the cells round it while idle', () => {
    const src = farFieldScript();
    expect(src).toContain('if (kept.size > FC.keep)');
    expect(src).toContain('window.requestIdleCallback');
    expect(FAR_FIELD.cell).toBeGreaterThan(0);
  });

  it('the form channel carries the blanket in its ground and the far field after its grass', () => {
    const page = formLandScript(land);
    expect(page).toContain('farBlanket( vWPos, nW )');
    expect(page.indexOf('window.__formFar = {')).toBeLessThan(page.indexOf('the far field: the blanket past'));
  });
});
