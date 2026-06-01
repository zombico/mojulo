import { describe, expect, it } from 'vitest';
import { normalizeGeometry } from './geometry.js';

describe('normalizeGeometry', () => {
  it('parses a Polygon into a single outer ring', () => {
    const out = normalizeGeometry({
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ],
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].role).toBe('outer');
    expect(out[0].polygonIndex).toBe(0);
  });

  it('parses a Polygon with a hole', () => {
    const out = normalizeGeometry({
      type: 'Polygon',
      coordinates: [
        [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
        [[2, 2], [8, 2], [8, 8], [2, 8], [2, 2]],
      ],
    });
    expect(out).toHaveLength(2);
    expect(out[0].role).toBe('outer');
    expect(out[1].role).toBe('hole');
    expect(out[0].polygonIndex).toBe(0);
    expect(out[1].polygonIndex).toBe(0);
  });

  it('parses a MultiPolygon with per-polygon indices', () => {
    const out = normalizeGeometry({
      type: 'MultiPolygon',
      coordinates: [
        [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
        [[[5, 5], [6, 5], [6, 6], [5, 6], [5, 5]]],
      ],
    });
    expect(out).toHaveLength(2);
    expect(out[0].polygonIndex).toBe(0);
    expect(out[1].polygonIndex).toBe(1);
    expect(out.every((r) => r.role === 'outer')).toBe(true);
  });

  it('rejects unsupported geometry types', () => {
    expect(() => normalizeGeometry({ type: 'LineString', coordinates: [] })).toThrow();
  });

  it('rejects degenerate rings', () => {
    expect(() =>
      normalizeGeometry({
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 0], [0, 0]]],
      }),
    ).toThrow();
  });
});
