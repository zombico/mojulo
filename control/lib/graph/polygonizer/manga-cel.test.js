/**
 * Smoke test for the manga-cel primitive. Verifies the public API
 * round-trips for each shape factory and that the renderer emits an SVG
 * containing the expected element types.
 */

import { describe, it, expect } from 'vitest';

import {
  renderMangaCel,
  makeSphere,
  makeTorus,
  makePyramid,
  makeCone,
  makeCylinder,
  makeEllipsoid,
  makeLathe,
  DEFAULT_LIGHT_DIR,
} from './manga-cel.js';

function uniquePolygonFills(svg) {
  const out = new Set();
  for (const m of svg.matchAll(/<polygon[^>]*fill="([^"]+)"/g)) {
    out.add(m[1]);
  }
  return out;
}

describe('manga-cel primitive', () => {
  it('re-exports DEFAULT_LIGHT_DIR', () => {
    const len = Math.hypot(DEFAULT_LIGHT_DIR.x, DEFAULT_LIGHT_DIR.y, DEFAULT_LIGHT_DIR.z);
    expect(len).toBeCloseTo(1, 5);
  });

  it('renders a single sphere with tonal fills + silhouette', () => {
    const svg = renderMangaCel([
      makeSphere({ center: { x: 0, y: -10, z: 2 }, radius: 2, baseColor: '#000000' }),
    ]);
    expect(svg).toMatch(/^<svg/);
    expect(svg).toMatch(/<polygon /);     // tonal cell fills
    expect(svg).toMatch(/<polyline /);    // silhouette
    expect(svg).not.toMatch(/<path /);    // no contour lines by default
    expect(svg).not.toMatch(/<linearGradient/);
    expect(svg).toMatch(/<\/svg>$/);
  });

  it('renders all primitive shape kinds in a mixed scene', () => {
    const svg = renderMangaCel([
      makeSphere({ center: { x: -8, y: -8, z: 2 }, radius: 1.8, baseColor: '#000' }),
      makeEllipsoid({ center: { x: -3, y: -8, z: 2 }, scaleX: 1.5, scaleY: 1.2, scaleZ: 2.2, baseColor: '#000' }),
      makeCone({ center: { x: 2, y: -8, z: 0 }, radius: 1.5, height: 3.5, baseColor: '#000' }),
      makeTorus({ center: { x: -8, y: -14, z: 1.5 }, R: 1.8, r: 0.7, baseColor: '#000' }),
      makeCylinder({ center: { x: -1, y: -14, z: 2 }, radius: 1.2, height: 3.5, baseColor: '#000' }),
      makePyramid({ center: { x: 6, y: -14, z: 0 }, baseHalf: 1.6, height: 3.2, baseColor: '#000' }),
    ]);
    expect(svg).toMatch(/<polygon /);
    expect(svg).toMatch(/<polyline /);
  });

  it('renders a lathe (with harmonics)', () => {
    const svg = renderMangaCel([
      makeLathe({
        axisFrom: { x: 0, y: -10, z: 4 },
        axisTo:   { x: 0, y: -10, z: 0 },
        profile: [
          { t: 0.0, radius: 0.5 },
          { t: 0.5, radius: 1.2 },
          { t: 1.0, radius: 0.3 },
        ],
        harmonics: [{ n: 2, amplitude: -0.2, phase: 0 }],
        baseColor: '#000',
      }),
    ]);
    expect(svg).toMatch(/<polyline /);
  });

  it('tier count drives polygon-fill diversity', () => {
    const scene = () => [makeSphere({ center: { x: 0, y: -10, z: 2 }, radius: 2, baseColor: '#000' })];
    const t1 = renderMangaCel(scene(), { tiers: 1 });
    const t2 = renderMangaCel(scene(), { tiers: 2 });
    const t3 = renderMangaCel(scene(), { tiers: 3 });
    expect(uniquePolygonFills(t1).size).toBe(1);
    expect(uniquePolygonFills(t2).size).toBe(2);
    expect(uniquePolygonFills(t3).size).toBe(3);
  });

  it('custom tones override the generated palette', () => {
    const svg = renderMangaCel(
      [makeSphere({ center: { x: 0, y: -10, z: 2 }, radius: 2, baseColor: '#000' })],
      { tiers: 2, tones: ['#cc8800', '#ffeecc'] },
    );
    const fills = uniquePolygonFills(svg);
    expect(fills.has('#cc8800')).toBe(true);
    expect(fills.has('#ffeecc')).toBe(true);
  });

  it('contourLines: true adds smoothed bezier paths over the fills', () => {
    const scene = [makeSphere({ center: { x: 0, y: -10, z: 2 }, radius: 2, baseColor: '#000' })];
    const noLines  = renderMangaCel(scene, { tiers: 2 });
    const withLines = renderMangaCel(scene, { tiers: 2, contourLines: true });
    expect(noLines).not.toMatch(/<path /);
    expect(withLines).toMatch(/<path /);
  });

  it('smoothContours: false with contourLines emits polyline contours', () => {
    const scene = [makeSphere({ center: { x: 0, y: -10, z: 2 }, radius: 2, baseColor: '#000' })];
    const smooth = renderMangaCel(scene, { tiers: 2, contourLines: true, smoothContours: true });
    const polyl  = renderMangaCel(scene, { tiers: 2, contourLines: true, smoothContours: false });
    expect(smooth).toMatch(/<path /);
    expect(polyl).not.toMatch(/<path /);
  });

  it('produces different output for different light directions', () => {
    const scene = () => [makeSphere({ center: { x: 0, y: -10, z: 2 }, radius: 2, baseColor: '#000' })];
    const a = renderMangaCel(scene(), { lightDir: { x: 0.6, y: 0.3, z: 0.72 } });
    const b = renderMangaCel(scene(), { lightDir: { x: -0.6, y: 0.3, z: 0.72 } });
    expect(a).not.toEqual(b);
  });

  it('respects custom background and stroke color', () => {
    const svg = renderMangaCel(
      [makeSphere({ center: { x: 0, y: -10, z: 2 }, radius: 2, baseColor: '#000' })],
      { background: '#f5f0e6', strokeColor: '#222' },
    );
    expect(svg).toMatch(/fill="#f5f0e6"/);
    expect(svg).toMatch(/stroke="#222"/);
  });

  it('frontOnly drops back-hemisphere cells for a torus', () => {
    const torus = [makeTorus({ center: { x: 0, y: -10, z: 2 }, R: 2.0, r: 0.7, baseColor: '#000' })];
    const full = renderMangaCel(torus, { tiers: 2, frontOnly: false });
    const front = renderMangaCel(torus, { tiers: 2, frontOnly: true });
    const fullPolys  = (full.match(/<polygon /g)  || []).length;
    const frontPolys = (front.match(/<polygon /g) || []).length;
    expect(frontPolys).toBeLessThan(fullPolys);
    expect(frontPolys).toBeGreaterThan(0);
  });
});
