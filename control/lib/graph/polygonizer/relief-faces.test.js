import { describe, expect, it } from 'vitest';

import { reliefToFaces } from './relief-faces.js';

// The front cap of a relief must READ correctly when viewed from +normal: an L's
// stem sits on the left and its foot runs to the right. Both contour sources
// (font text, SVG path) arrive y-up, so one right-handed frame serves both.
function stemSide(spec) {
  const faces = reliefToFaces(spec);
  const depth = 0.18;
  const pts = faces.filter((f) => f.corners.every((c) => c[2] > depth * 0.5)).flatMap((f) => f.corners);
  const ys = pts.map((p) => p[1]);
  const ymax = Math.max(...ys);
  const topBand = pts.filter((p) => p[1] >= ymax - 0.05).map((p) => p[0]);
  const xs = pts.map((p) => p[0]);
  const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
  return Math.max(...topBand) < mid ? 'left' : 'right';
}

describe('reliefToFaces orientation', () => {
  it('an L from font text reads unmirrored from +normal', () => {
    expect(stemSide({ shape: { text: 'L' }, size: 1, anchor: { x: 0, y: 0, z: 0 } })).toBe('left');
  });
  it('an L from an SVG path (y-down source) reads unmirrored from +normal', () => {
    expect(stemSide({ shape: { path: 'M0 0 H2 V10 H6 V12 H0 Z' }, size: 1, anchor: { x: 0, y: 0, z: 0 } })).toBe('left');
  });
  it('an explicit up/normal frame keeps the reading direction', () => {
    // raised along +y, glyph vertical +z: viewed from +y the right axis is −x
    const faces = reliefToFaces({ shape: { text: 'L' }, size: 1, anchor: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 }, up: { x: 0, y: 0, z: 1 } });
    const pts = faces.filter((f) => f.corners.every((c) => c[1] > 0.09)).flatMap((f) => f.corners);
    const zmax = Math.max(...pts.map((p) => p[2]));
    const top = pts.filter((p) => p[2] >= zmax - 0.05).map((p) => p[0]);
    const xs = pts.map((p) => p[0]);
    const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
    expect(Math.min(...top) > mid).toBe(true); // stem on the viewer's left = +x
  });
});
