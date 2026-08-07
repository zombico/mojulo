import { describe, it, expect } from 'vitest';
import { renderPaintedLandscapeToSvg, validatePaintedLandscape, skyIds, resolveSkySpec, skyPrimitiveIds } from './painted-landscape.js';

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

  it('altitude moves the cloud band (low cumulus vs high cirrus differ)', () => {
    const low = renderPaintedLandscapeToSvg({ ...BASE, sky: { clouds: { coverage: 0.6, altitude: 0.2 } } });
    const high = renderPaintedLandscapeToSvg({ ...BASE, sky: { clouds: { coverage: 0.6, altitude: 0.85 } } });
    expect(low).toContain('fill-opacity');
    expect(high).toContain('fill-opacity');
    expect(low).not.toBe(high);
  });

  it('a break clearing thins the cloud cover (dual of a terrain basin)', () => {
    const cfg = { coverage: 0.85, style: 'wisp', altitude: 0.5 };
    const solid = renderPaintedLandscapeToSvg({ ...BASE, sky: { clouds: cfg } });
    const broken = renderPaintedLandscapeToSvg({ ...BASE, sky: { clouds: { ...cfg, breaks: [{ x: 0.5, y: 0.5, radius: 0.35 }] } } });
    const puffs = (svg) => (svg.match(/radialGradient/g) || []).length;
    expect(puffs(broken)).toBeLessThan(puffs(solid));
  });

  it('rejects malformed altitude and breaks', () => {
    const bad = (clouds) => validatePaintedLandscape({ kind: 'painted-landscape', heartbeat: 'breathing', splatch: 'dusk-trio', sky: { clouds } });
    expect(bad({ coverage: 0.5, altitude: 'high' }).some((e) => e.includes('altitude'))).toBe(true);
    expect(bad({ coverage: 0.5, breaks: 'none' }).some((e) => e.includes('breaks'))).toBe(true);
    expect(bad({ coverage: 0.5, breaks: [{ x: 0.5, y: 0.5, radius: -1 }] }).some((e) => e.includes('breaks[0]'))).toBe(true);
  });

  it('loads the named sky card family', () => {
    expect(skyIds()).toEqual(expect.arrayContaining([
      'clear', 'scattered-cumulus', 'high-cumulus', 'cirrus-high', 'overcast', 'broken-overcast', 'pixel-cumulus',
    ]));
  });

  it('resolves a sky-card id to its preset config', () => {
    expect(resolveSkySpec('high-cumulus').clouds.altitude).toBe(0.7);
    expect(resolveSkySpec('clear').clouds).toBeUndefined();
    expect(resolveSkySpec('broken-overcast').clouds.breaks.length).toBe(1);
    expect(resolveSkySpec(false).disabled).toBe(true);
    expect(resolveSkySpec('no-such-sky')).toEqual({}); // unknown → default (validation catches the name)
  });

  it('renders a named cloudy sky vs a clear one', () => {
    const cumulus = renderPaintedLandscapeToSvg({ ...BASE, sky: 'high-cumulus' });
    const clear = renderPaintedLandscapeToSvg({ ...BASE, sky: 'clear' });
    expect(cumulus).toContain('radialGradient'); // wisp puffs present
    expect(clear).not.toContain('radialGradient');
    expect(clear).not.toContain('fill-opacity');
    expect(clear).toContain('<linearGradient id="sky"'); // still has the gradient backdrop
  });

  it('rejects an unknown sky id', () => {
    expect(validatePaintedLandscape({ ...BASE, sky: 'tornado' }).some((e) => e.includes('unknown sky'))).toBe(true);
  });

  // ─── Adornments: sun disc, stars, moon ───────────────────────────────
  const DAY = { ...BASE, light: { x: 0.4, y: 0.4, z: 0.7 } };
  const NIGHT = { ...BASE, light: { x: 0.4, y: 0.3, z: -0.4 } };

  it('paints no adornments by default (opt-in)', () => {
    const svg = renderPaintedLandscapeToSvg(DAY);
    expect(svg).not.toContain('adornment-sun');
    expect(svg).not.toContain('adornment-star');
    expect(svg).not.toContain('adornment-moon');
  });

  it('paints a sun disc by day when sky.sun is on', () => {
    const svg = renderPaintedLandscapeToSvg({ ...DAY, sky: { sun: true } });
    expect(svg).toContain('class="adornment-sun"');
    expect(svg).toContain('<radialGradient id="sun-halo"');
  });

  it('hides the sun once it drops below the horizon (night)', () => {
    const svg = renderPaintedLandscapeToSvg({ ...NIGHT, sky: { sun: true } });
    expect(svg).not.toContain('adornment-sun');
  });

  it('sun glow changes the render deterministically', () => {
    const a = renderPaintedLandscapeToSvg({ ...DAY, sky: { sun: { glow: 0.3 } } });
    const b = renderPaintedLandscapeToSvg({ ...DAY, sky: { sun: { glow: 2.0 } } });
    expect(a).not.toBe(b);
    expect(renderPaintedLandscapeToSvg({ ...DAY, sky: { sun: { glow: 0.3 } } })).toBe(a);
  });

  it('paints stars only at night, never by day', () => {
    expect(renderPaintedLandscapeToSvg({ ...DAY, sky: { stars: 0.8 } })).not.toContain('adornment-star');
    const night = renderPaintedLandscapeToSvg({ ...NIGHT, sky: { stars: 0.8 } });
    expect(night).toContain('class="adornment-star"');
  });

  it('star density scales the count and is deterministic', () => {
    const count = (svg) => (svg.match(/adornment-star/g) || []).length;
    const few = renderPaintedLandscapeToSvg({ ...NIGHT, sky: { stars: 0.2 } });
    const many = renderPaintedLandscapeToSvg({ ...NIGHT, sky: { stars: 0.9 } });
    expect(count(many)).toBeGreaterThan(count(few));
    expect(renderPaintedLandscapeToSvg({ ...NIGHT, sky: { stars: 0.9 } })).toBe(many);
  });

  it('paints the moon only at night; phase carves a crescent', () => {
    expect(renderPaintedLandscapeToSvg({ ...DAY, sky: { moon: true } })).not.toContain('adornment-moon');
    const full = renderPaintedLandscapeToSvg({ ...NIGHT, sky: { moon: { phase: 1 } } });
    const crescent = renderPaintedLandscapeToSvg({ ...NIGHT, sky: { moon: { phase: 0.3 } } });
    expect(full).toContain('class="adornment-moon"');
    expect(full).not.toContain('moon-lit');       // full moon → solid disc, no lit-mask
    expect(crescent).toContain('mask="url(#moon-lit)"'); // crescent → body masked to the lit sliver
  });

  it('a crescent never paints the dark part (no sky-colored shadow disc)', () => {
    // The dark limb must show the sky/aurora behind it — the body is masked to
    // the lit sliver, so there is no shadow disc and no clip-path carve.
    const svg = renderPaintedLandscapeToSvg({ ...NIGHT, sky: { moon: { phase: 0.3 } } });
    expect(svg).toContain('mask="url(#moon-lit)"');
    expect(svg).not.toContain('moon-clip');
  });

  it('moon.blend renders a soft radial body instead of a sharp disc', () => {
    const sharp = renderPaintedLandscapeToSvg({ ...NIGHT, sky: { moon: true } });
    const soft = renderPaintedLandscapeToSvg({ ...NIGHT, sky: { moon: { blend: true } } });
    expect(sharp).not.toContain('moon-body');
    expect(soft).toContain('<radialGradient id="moon-body"');
    expect(soft).not.toBe(sharp);
  });

  it('paraselene adds a halo ring + two mock moons; off by default', () => {
    const plain = renderPaintedLandscapeToSvg({ ...NIGHT, sky: { moon: true } });
    const dogs = renderPaintedLandscapeToSvg({ ...NIGHT, sky: { moon: { paraselene: true } } });
    expect(plain).not.toContain('paraselene');
    expect(dogs).toContain('id="paraselene-l"');
    expect(dogs).toContain('id="paraselene-r"');
    expect(dogs).toContain('fill="none"'); // the halo ring stroke
  });

  it('aurora / comet / meteors are night-gated and off by default', () => {
    expect(renderPaintedLandscapeToSvg(DAY)).not.toContain('adornment-aurora');
    expect(renderPaintedLandscapeToSvg({ ...DAY, sky: { aurora: true, comet: true, meteors: 20 } }))
      .not.toMatch(/adornment-(aurora|comet|meteor)/);
    const night = renderPaintedLandscapeToSvg({ ...NIGHT, sky: { aurora: true, comet: true, meteors: 20 } });
    expect(night).toContain('class="adornment-aurora"');
    expect(night).toContain('class="adornment-comet"');
    expect(night).toContain('class="adornment-meteor"');
  });

  it('aurora hue shifts the palette; meteor count scales; both deterministic', () => {
    const green = renderPaintedLandscapeToSvg({ ...NIGHT, sky: { aurora: { hue: 0 } } });
    const magenta = renderPaintedLandscapeToSvg({ ...NIGHT, sky: { aurora: { hue: 0.7 } } });
    expect(green).not.toBe(magenta);
    const count = (svg) => (svg.match(/adornment-meteor/g) || []).length;
    expect(count(renderPaintedLandscapeToSvg({ ...NIGHT, sky: { meteors: 30 } })))
      .toBeGreaterThan(count(renderPaintedLandscapeToSvg({ ...NIGHT, sky: { meteors: 6 } })));
    const m = { ...NIGHT, sky: { meteors: 15, aurora: true } };
    expect(renderPaintedLandscapeToSvg(m)).toBe(renderPaintedLandscapeToSvg(m));
  });

  it('rejects malformed aurora / comet / meteors', () => {
    const bad = (sky) => validatePaintedLandscape({ ...BASE, sky });
    expect(bad({ aurora: { hue: 2 } }).some((e) => e.includes('aurora'))).toBe(true);
    expect(bad({ comet: { length: -1 } }).some((e) => e.includes('comet'))).toBe(true);
    expect(bad({ meteors: -5 }).some((e) => e.includes('meteors'))).toBe(true);
    expect(bad({ meteors: { radiant: { x: 0.5 } } }).some((e) => e.includes('radiant'))).toBe(true);
  });

  it('exposes the sky-adornment primitives in paint order (far→near)', () => {
    expect(skyPrimitiveIds()).toEqual(['stars', 'comet', 'moon', 'sun', 'aurora', 'meteors']);
  });

  it('adornments are sky-less in wireframe', () => {
    const svg = renderPaintedLandscapeToSvg({ ...NIGHT, sky: { stars: 0.8, moon: true }, renderStyle: 'wireframe' });
    expect(svg).not.toContain('adornment-star');
    expect(svg).not.toContain('adornment-moon');
  });

  it('the sun paints BEHIND clouds (so cover/breaks occlude it)', () => {
    const svg = renderPaintedLandscapeToSvg({ ...DAY, sky: { sun: true, clouds: { coverage: 0.5, style: 'wisp' } } });
    expect(svg.indexOf('sun-halo')).toBeLessThan(svg.indexOf('id="cw0"'));
  });

  it('rejects malformed sun / stars / moon', () => {
    const bad = (sky) => validatePaintedLandscape({ ...BASE, sky });
    expect(bad({ sun: { glow: -1 } }).some((e) => e.includes('sun'))).toBe(true);
    expect(bad({ stars: -2 }).some((e) => e.includes('stars'))).toBe(true);
    expect(bad({ stars: { density: 'lots' } }).some((e) => e.includes('stars'))).toBe(true);
    expect(bad({ moon: { phase: 2 } }).some((e) => e.includes('moon'))).toBe(true);
    expect(bad({ sun: { position: { x: 0.5 } } }).some((e) => e.includes('sun.position'))).toBe(true);
  });

  it('resolves the adornment sky cards', () => {
    expect(skyIds()).toEqual(expect.arrayContaining(['golden-sun', 'starry-night', 'harvest-moon']));
    expect(resolveSkySpec('golden-sun').sun.glow).toBe(1.3);
    expect(resolveSkySpec('starry-night').stars.density).toBe(0.75);
    expect(resolveSkySpec('harvest-moon').moon.phase).toBe(0.82);
  });

  it('renders a named adornment card (golden-sun puts a disc up by day)', () => {
    const svg = renderPaintedLandscapeToSvg({ ...DAY, sky: 'golden-sun' });
    expect(svg).toContain('class="adornment-sun"');
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
