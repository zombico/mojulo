/**
 * The form render's land page (scene/channels/form-land.js): the ground's own parallax kinds. Pebbles, cracked earth and
 * fractured plates, each drawn from its card in GROUND_PARALLAX, marched only near and faded by its cells' size on the
 * screen; a pebble a stone's colour.
 */
import { describe, expect, it } from 'vitest';

import { formLandScript, GROUND_PARALLAX } from './form-land.js';

const land = { light: { sun: [1, 1, 1], ambient: [0.2, 0.2, 0.2] } };

describe('the ground\'s parallax kinds', () => {
  it('draws each kind from its card, marched only within its reach, finer kinds smaller', () => {
    const page = formLandScript(land), P = GROUND_PARALLAX;
    for (const k of ['pebbles', 'cracks', 'plates']) {
      expect(page).toContain(P[k].cell.toFixed(3));
      expect(page).toContain(P[k].depth.toFixed(3));
    }
    expect(P.pebbles.cell).toBeLessThan(P.cracks.cell);
    expect(P.cracks.cell).toBeLessThan(P.plates.cell);
    expect(page).toContain(`camD < ${P.near.toFixed(1)}`);
    // (the bare soil's dry and damp field, the trail's stretches, and a pebble a stone's own colour)
    expect(page).toContain(`/ ${P.dry.toFixed(1)}`);
    expect(page).toContain(`/ ${P.stretch.toFixed(1)}`);
    expect(page).toContain('uStoneBase * tone');
  });

  it('carries the view cone before its grass, the reach fixed only when the world fixes it', () => {
    const page = formLandScript(land), cone = page.indexOf('window.__mojCone = K;');
    expect(cone).toBeGreaterThan(-1);
    expect(cone).toBeLessThan(page.indexOf('const CONE = window.__mojCone'));
    expect(page).toContain('let fixed = null;');
    expect(formLandScript({ ...land, cone: { reach: 40 } })).toContain('let fixed = 40;');
  });

  it('reads the same page twice', () => {
    expect(formLandScript(land)).toBe(formLandScript(land));
  });
});
