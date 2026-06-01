import { describe, expect, it } from 'vitest';
import {
  PROJECTIONS,
  computeBbox,
  lonLatToMercator,
  pixelToleranceToDegrees,
  projectRings,
} from './project.js';

const squareRing = [
  [10, 50],
  [20, 50],
  [20, 60],
  [10, 60],
  [10, 50],
];

describe('computeBbox', () => {
  it('spans the input', () => {
    expect(computeBbox([squareRing])).toEqual({
      minLon: 10,
      minLat: 50,
      maxLon: 20,
      maxLat: 60,
    });
  });

  it('throws on empty input', () => {
    expect(() => computeBbox([[]])).toThrow();
  });
});

describe('projectRings — equirectangular-bbox', () => {
  it('fits inside the viewBox with margins', () => {
    const out = projectRings([squareRing], {
      projection: 'equirectangular-bbox',
      viewBox: { width: 600, height: 600 },
    });
    const xs = out[0].map(([x]) => x);
    const ys = out[0].map(([, y]) => y);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThanOrEqual(600);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(600);
  });

  it('inverts y so north renders up', () => {
    const out = projectRings([squareRing], {
      projection: 'equirectangular-bbox',
      viewBox: { width: 600, height: 600 },
    });
    const ringOut = out[0];
    const yAt50 = ringOut[0][1];
    const yAt60 = ringOut[2][1];
    expect(yAt60).toBeLessThan(yAt50);
  });

  it('is deterministic — same input, same output', () => {
    const a = projectRings([squareRing], {
      projection: 'equirectangular-bbox',
      viewBox: { width: 600, height: 600 },
    });
    const b = projectRings([squareRing], {
      projection: 'equirectangular-bbox',
      viewBox: { width: 600, height: 600 },
    });
    expect(a).toEqual(b);
  });
});

describe('projectRings — web-mercator', () => {
  it('fits inside the viewBox', () => {
    const out = projectRings([squareRing], {
      projection: 'web-mercator',
      viewBox: { width: 600, height: 600 },
    });
    const xs = out[0].map(([x]) => x);
    const ys = out[0].map(([, y]) => y);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThanOrEqual(600);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(600);
  });

  it('lonLatToMercator at equator returns (lon_rad, 0)', () => {
    const [x, y] = lonLatToMercator(45, 0);
    expect(x).toBeCloseTo((45 * Math.PI) / 180, 6);
    expect(y).toBeCloseTo(0, 6);
  });
});

describe('projectRings — errors', () => {
  it('rejects an unknown projection', () => {
    expect(() =>
      projectRings([squareRing], { projection: 'mollweide', viewBox: { width: 600, height: 600 } }),
    ).toThrow();
  });

  it('rejects a degenerate bbox', () => {
    const point = [[[10, 50]]];
    expect(() =>
      projectRings(point, { projection: 'equirectangular-bbox', viewBox: { width: 600, height: 600 } }),
    ).toThrow();
  });

  it('exposes the projection list', () => {
    expect(PROJECTIONS).toContain('equirectangular-bbox');
    expect(PROJECTIONS).toContain('web-mercator');
  });
});

describe('pixelToleranceToDegrees', () => {
  it('returns degrees that produce ~tolerance pixels in the equirectangular fit', () => {
    const bbox = { minLon: 10, minLat: 50, maxLon: 20, maxLat: 60 };
    const viewBox = { width: 600, height: 600 };
    const deg = pixelToleranceToDegrees({ pixelTolerance: 0.5, bbox, viewBox });
    const innerW = viewBox.width * 0.92;
    const scale = innerW / 10;
    expect(deg * scale).toBeCloseTo(0.5, 3);
  });
});
