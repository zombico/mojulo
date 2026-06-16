/**
 * Smoke test for the imperfect-cel primitive. Verifies the public API
 * round-trips for each shape factory and that the renderer emits an SVG
 * containing the expected element types.
 */

import { describe, it, expect } from 'vitest';

import {
  renderImperfectCel,
  makeSphere,
  makeTorus,
  makePyramid,
  makeCone,
  makeCylinder,
  makeEllipsoid,
  makeLathe,
  DEFAULT_LIGHT_DIR,
} from './imperfect-cel.js';

describe('imperfect-cel primitive', () => {
  it('exports a sane default light direction', () => {
    expect(DEFAULT_LIGHT_DIR).toEqual(expect.objectContaining({
      x: expect.any(Number),
      y: expect.any(Number),
      z: expect.any(Number),
    }));
    const len = Math.hypot(DEFAULT_LIGHT_DIR.x, DEFAULT_LIGHT_DIR.y, DEFAULT_LIGHT_DIR.z);
    expect(len).toBeCloseTo(1, 5);
  });

  it('renders a single sphere', () => {
    const svg = renderImperfectCel([
      makeSphere({ center: { x: 0, y: -10, z: 2 }, radius: 2, baseColor: '#4a6080' }),
    ]);
    expect(svg).toMatch(/^<svg/);
    expect(svg).toMatch(/<path /);
    expect(svg).toMatch(/<linearGradient/);
    expect(svg).toMatch(/<\/svg>$/);
  });

  it('renders a mixed scene with all primitive shape kinds', () => {
    const svg = renderImperfectCel([
      makeSphere({ center: { x: -8, y: -8, z: 2 }, radius: 1.8, baseColor: '#3a5070' }),
      makeEllipsoid({ center: { x: -3, y: -8, z: 2 }, scaleX: 1.5, scaleY: 1.2, scaleZ: 2.2, baseColor: '#7a3580' }),
      makeCone({ center: { x: 2, y: -8, z: 0 }, radius: 1.5, height: 3.5, baseColor: '#c05030' }),
      makeTorus({ center: { x: -8, y: -14, z: 1.5 }, R: 1.8, r: 0.7, baseColor: '#b08a3a' }),
      makeCylinder({ center: { x: -1, y: -14, z: 2 }, radius: 1.2, height: 3.5, baseColor: '#3a8070' }),
      makePyramid({ center: { x: 6, y: -14, z: 0 }, baseHalf: 1.6, height: 3.2, baseColor: '#4a7050' }),
    ]);
    expect(svg).toMatch(/<path /);          // all cells bisect to S-curve paths
    expect(svg).toMatch(/<linearGradient/); // gradient defs (smooth cells)
    expect(svg).toMatch(/<line /);          // silhouette strokes
  });

  it('renders a lathe spec (with harmonics)', () => {
    const svg = renderImperfectCel([
      makeLathe({
        axisFrom: { x: 0, y: -10, z: 4 },
        axisTo:   { x: 0, y: -10, z: 0 },
        profile: [
          { t: 0.0, radius: 0.5 },
          { t: 0.5, radius: 1.2 },
          { t: 1.0, radius: 0.3 },
        ],
        harmonics: [{ n: 2, amplitude: -0.2, phase: 0 }],
        baseColor: '#a23838',
      }),
    ]);
    expect(svg).toMatch(/<path /);
    expect(svg).toMatch(/<linearGradient/);
  });

  it('produces different output for different light directions', () => {
    const sceneFn = () => [
      makeSphere({ center: { x: 0, y: -10, z: 2 }, radius: 2, baseColor: '#4a6080' }),
    ];
    const rightSvg = renderImperfectCel(sceneFn(), { lightDir: { x: 0.6, y: 0.3, z: 0.72 } });
    const leftSvg  = renderImperfectCel(sceneFn(), { lightDir: { x: -0.6, y: 0.3, z: 0.72 } });
    expect(rightSvg).not.toEqual(leftSvg);   // lighting direction is a real parameter
  });

  it('respects gravityDarken: false', () => {
    const scene = [makeSphere({ center: { x: 0, y: -10, z: 2 }, radius: 2, baseColor: '#4a6080' })];
    const withGravity = renderImperfectCel(scene, { gravityDarken: true });
    const withoutGravity = renderImperfectCel(scene, { gravityDarken: false });
    expect(withGravity).not.toEqual(withoutGravity);
  });
});
