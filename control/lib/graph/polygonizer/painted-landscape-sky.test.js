import { describe, it, expect } from 'vitest';
import { renderPaintedLandscapeToSvg, validatePaintedLandscape } from './painted-landscape.js';

const BASE = {
  kind: 'painted-landscape',
  heartbeat: 'gentle-roughness',
  splatch: 'dusk-trio',
  seed: 'sky-test',
  light: { x: 0.7, y: 0.4, z: 0.18 },
};

describe('painted-landscape — sky backdrop + haze (default-on)', () => {
  it('emits a zenith→horizon gradient backdrop — ON BY DEFAULT when sky is omitted', () => {
    const svg = renderPaintedLandscapeToSvg(BASE);
    expect(svg).toContain('<linearGradient id="sky"');
    expect(svg).toContain('fill="url(#sky)"');
  });

  it('disables the sky with sky: false (flat background restored)', () => {
    const svg = renderPaintedLandscapeToSvg({ ...BASE, sky: false });
    expect(svg).not.toContain('linearGradient');
    expect(svg).not.toContain('url(#sky)');
  });

  it('hazes the scene — default (sky on) differs from sky: false', () => {
    const off = renderPaintedLandscapeToSvg({ ...BASE, sky: false });
    const on = renderPaintedLandscapeToSvg(BASE);
    expect(on).not.toBe(off);
  });

  it('ignores sky in wireframe render style (no gradient backdrop)', () => {
    const svg = renderPaintedLandscapeToSvg({ ...BASE, sky: true, renderStyle: 'wireframe' });
    expect(svg).not.toContain('url(#sky)');
  });

  it('accepts a tunable haze strength object form', () => {
    const soft = renderPaintedLandscapeToSvg({ ...BASE, sky: { hazeStrength: 0.2 } });
    const strong = renderPaintedLandscapeToSvg({ ...BASE, sky: { hazeStrength: 0.9 } });
    expect(soft).toContain('url(#sky)');
    expect(strong).toContain('url(#sky)');
    expect(soft).not.toBe(strong);
  });

  it('goes to a deep indigo night when the sun drops below the horizon', () => {
    // A strongly negative light.z is night: day factor → 0, zenith → the
    // deep-night indigo stop rgb(9,13,28) (deterministic).
    const night = renderPaintedLandscapeToSvg({ ...BASE, sky: true, light: { x: 0.5, y: 0.3, z: -0.4 } });
    expect(night).toContain('rgb(9,13,28)');
    // A high sun is day — the zenith is a lifted palette tone, not the night stop.
    const day = renderPaintedLandscapeToSvg({ ...BASE, sky: true, light: { x: 0.3, y: 0.4, z: 0.9 } });
    expect(day).not.toContain('rgb(9,13,28)');
    expect(night).not.toBe(day);
  });

  it('paints a cloud band when sky.clouds coverage is given', () => {
    const clear = renderPaintedLandscapeToSvg({ ...BASE, sky: true });
    const cloudy = renderPaintedLandscapeToSvg({ ...BASE, sky: { clouds: 0.6 } });
    // Cloud cells are the only marks carrying fill-opacity.
    expect(clear).not.toContain('fill-opacity');
    expect(cloudy).toContain('fill-opacity');
    expect(cloudy).not.toBe(clear);
  });

  it('draws no clouds at zero coverage', () => {
    const svg = renderPaintedLandscapeToSvg({ ...BASE, sky: { clouds: 0 } });
    expect(svg).not.toContain('fill-opacity');
  });

  it('draws no clouds in wireframe (sky-less)', () => {
    const svg = renderPaintedLandscapeToSvg({ ...BASE, sky: { clouds: 0.6 }, renderStyle: 'wireframe' });
    expect(svg).not.toContain('fill-opacity');
  });

  it('rejects malformed sky.clouds', () => {
    expect(validatePaintedLandscape({ kind: 'painted-landscape', heartbeat: 'breathing', splatch: 'dusk-trio', sky: { clouds: -1 } })
      .some((e) => e.includes('clouds'))).toBe(true);
  });

  it('works in the elevation-field path too', () => {
    const svg = renderPaintedLandscapeToSvg({
      kind: 'painted-landscape', splatch: 'meadow-trio', sky: true,
      light: { x: 0.4, y: 0.5, z: 0.7 },
      elevation: {
        fields: {
          hill: { kind: 'terrain-region', center: { x: 0, y: -10, z: 0 }, radius: 9, peak: 5, waves: [] },
          elevation: { kind: 'sum', components: [{ field: 'hill' }] },
        },
        field: 'elevation', waterLevel: 0, samples: { u: 24, v: 24 },
      },
    });
    expect(svg).toContain('<linearGradient id="sky"');
  });
});
