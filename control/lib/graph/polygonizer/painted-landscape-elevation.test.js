import { describe, it, expect } from 'vitest';
import { validatePaintedLandscape, renderPaintedLandscapeToSvg } from './painted-landscape.js';

// A composed elevation field drives the terrain instead of a heartbeat.
const HILL_AND_BASIN = {
  hill: { kind: 'terrain-region', center: { x: -4, y: -8, z: 0 }, radius: 8, peak: 4, waves: [] },
  basin: { kind: 'terrain-region', center: { x: 4, y: -14, z: 0 }, radius: 7, peak: -4, waves: [] },
  elevation: { kind: 'sum', components: [{ field: 'hill' }, { field: 'basin' }] },
};

describe('painted-landscape — elevation-field path', () => {
  it('validates an elevation manifest with no heartbeat', () => {
    expect(validatePaintedLandscape({
      kind: 'painted-landscape', splatch: 'meadow-trio',
      elevation: { fields: HILL_AND_BASIN, field: 'elevation' },
    })).toEqual([]);
  });

  it('rejects an elevation block whose field id is absent', () => {
    const errors = validatePaintedLandscape({
      kind: 'painted-landscape', splatch: 'meadow-trio',
      elevation: { fields: HILL_AND_BASIN, field: 'nope' },
    });
    expect(errors.some((e) => e.includes("elevation.field 'nope' not found"))).toBe(true);
  });

  it('still requires a heartbeat when no elevation block is given', () => {
    const errors = validatePaintedLandscape({ kind: 'painted-landscape', splatch: 'meadow-trio' });
    expect(errors.some((e) => e.includes('heartbeat is required'))).toBe(true);
  });

  it('renders the composed field as a painted SVG', () => {
    const svg = renderPaintedLandscapeToSvg({
      kind: 'painted-landscape', splatch: 'meadow-trio',
      elevation: { fields: HILL_AND_BASIN, field: 'elevation', samples: { u: 20, v: 20 } },
    });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toMatch(/<polygon/);
  });

  it('floods every cell below the waterline with depth-shaded water', () => {
    // A constant elevation of -2 with waterLevel 0 → the whole surface is
    // 2 units underwater → every cell is water-shaded (deterministic color).
    const svg = renderPaintedLandscapeToSvg({
      kind: 'painted-landscape', splatch: 'meadow-trio', sky: false, // raw water shade, no haze
      elevation: { fields: { flat: { kind: 'constant', value: -2 } }, field: 'flat', waterLevel: 0, samples: { u: 8, v: 8 } },
    });
    // waterShade(2): lerp([120,170,200],[20,48,78], 0.4) = (80,121,151).
    expect(svg).toContain('rgb(80,121,151)');
  });

  it('the same field renders differently with vs without a waterline', () => {
    const base = {
      kind: 'painted-landscape', splatch: 'meadow-trio',
      elevation: { fields: HILL_AND_BASIN, field: 'elevation', samples: { u: 24, v: 24 } },
    };
    const dry = renderPaintedLandscapeToSvg(base);
    const flooded = renderPaintedLandscapeToSvg({ ...base, elevation: { ...base.elevation, waterLevel: 0 } });
    expect(dry).not.toBe(flooded);
  });
});
