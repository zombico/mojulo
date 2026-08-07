import { describe, it, expect } from 'vitest';

import {
  HEARTBEATS,
  SPLATCHES,
  STRUCTURE_GLYPHS,
  CAMERAS,
  RENDER_STYLES,
  heartbeatIds,
  splatchIds,
  structureGlyphIds,
  cameraIds,
  resolveHeartbeat,
  derivePalette,
  resolveStructures,
  validatePaintedLandscape,
  renderPaintedLandscapeToSvg,
} from './painted-landscape.js';

describe('painted-landscape — closed-vocabulary tables', () => {
  it('ships at least the four heartbeats the primitive launches with', () => {
    const ids = heartbeatIds();
    for (const id of ['gentle-pulse', 'breathing', 'chop', 'ridge-step']) {
      expect(ids).toContain(id);
    }
  });

  it('every heartbeat has samples, defaultLight, and engine-appropriate params', () => {
    for (const [id, recipe] of Object.entries(HEARTBEATS)) {
      expect(recipe.samples?.u, `${id}: samples.u`).toBeGreaterThan(1);
      expect(recipe.samples?.v, `${id}: samples.v`).toBeGreaterThan(1);
      expect(Number.isFinite(recipe.defaultLight?.x)).toBe(true);
      expect(Number.isFinite(recipe.defaultLight?.y)).toBe(true);
      expect(Number.isFinite(recipe.defaultLight?.z)).toBe(true);
      const engine = recipe.engine || 'sine-stack';
      if (engine === 'sine-stack') {
        expect(Array.isArray(recipe.waves), `${id}: waves array`).toBe(true);
        expect(recipe.waves.length, `${id}: at least one wave component`).toBeGreaterThan(0);
        for (const w of recipe.waves) {
          expect(Array.isArray(w.amp) && w.amp.length === 2, `${id}: amp range`).toBe(true);
          expect(Array.isArray(w.cu) && w.cu.length === 2, `${id}: cu range`).toBe(true);
          expect(Array.isArray(w.cv) && w.cv.length === 2, `${id}: cv range`).toBe(true);
          expect(w.amp[0]).toBeLessThanOrEqual(w.amp[1]);
          expect(w.cu[0]).toBeLessThanOrEqual(w.cu[1]);
          expect(w.cv[0]).toBeLessThanOrEqual(w.cv[1]);
        }
      } else if (engine === 'fbm') {
        expect(recipe.fbm, `${id}: fbm payload`).toBeTruthy();
        for (const key of ['octaves', 'persistence', 'lacunarity', 'baseScale', 'amplitude']) {
          const r = recipe.fbm[key];
          expect(Array.isArray(r) && r.length === 2, `${id}: fbm.${key} range`).toBe(true);
          expect(r[0]).toBeLessThanOrEqual(r[1]);
        }
      } else {
        throw new Error(`${id}: unknown engine '${engine}'`);
      }
    }
  });

  it('every splatch has exactly three hex seed colours', () => {
    expect(splatchIds().length).toBeGreaterThan(0);
    for (const [id, splatch] of Object.entries(SPLATCHES)) {
      expect(splatch.seeds.length, `${id}: 3 seeds`).toBe(3);
      for (const hex of splatch.seeds) {
        expect(hex, `${id}: ${hex} hex format`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it('every structure glyph has a layout function returning sites in u/v', () => {
    for (const [id, glyph] of Object.entries(STRUCTURE_GLYPHS)) {
      expect(typeof glyph.layout, `${id}: layout fn`).toBe('function');
      // Feed it a deterministic stub rng so the test is reproducible.
      let counter = 0;
      const stubRng = () => (counter++ * 0.1) % 1;
      const sites = glyph.layout(stubRng);
      expect(Array.isArray(sites)).toBe(true);
      expect(sites.length).toBeGreaterThan(0);
      for (const s of sites) {
        expect(s.u, `${id}: u in [0,1]`).toBeGreaterThanOrEqual(0);
        expect(s.u, `${id}: u in [0,1]`).toBeLessThanOrEqual(1);
        expect(s.v, `${id}: v in [0,1]`).toBeGreaterThanOrEqual(0);
        expect(s.v, `${id}: v in [0,1]`).toBeLessThanOrEqual(1);
        expect(s.kind === 'obelisk' || s.kind === 'box').toBe(true);
        expect(s.width).toBeGreaterThan(0);
        expect(s.height).toBeGreaterThan(0);
      }
    }
  });
});

describe('painted-landscape — seeded determinism', () => {
  it('same seed → byte-identical wave parameters', () => {
    const a = resolveHeartbeat('gentle-pulse', 'autumn-1');
    const b = resolveHeartbeat('gentle-pulse', 'autumn-1');
    expect(a.waves).toEqual(b.waves);
  });

  it('different seed → different parameters within the same recipe', () => {
    const a = resolveHeartbeat('gentle-pulse', 'autumn-1');
    const c = resolveHeartbeat('gentle-pulse', 'autumn-2');
    expect(a.waves).not.toEqual(c.waves);
    // But the COUNT matches the heartbeat's component count (rules hold).
    expect(a.waves.length).toBe(HEARTBEATS['gentle-pulse'].waves.length);
    expect(c.waves.length).toBe(HEARTBEATS['gentle-pulse'].waves.length);
  });

  it('sampled values fall inside the heartbeat declared ranges', () => {
    const seedStr = 'range-check-1';
    const { waves } = resolveHeartbeat('chop', seedStr);
    const recipe = HEARTBEATS.chop;
    for (let i = 0; i < waves.length; i += 1) {
      const w = waves[i];
      const r = recipe.waves[i];
      expect(w.amplitude).toBeGreaterThanOrEqual(r.amp[0]);
      expect(w.amplitude).toBeLessThanOrEqual(r.amp[1]);
      expect(w.cycles.u).toBeGreaterThanOrEqual(r.cu[0]);
      expect(w.cycles.u).toBeLessThanOrEqual(r.cu[1]);
      expect(w.cycles.v).toBeGreaterThanOrEqual(r.cv[0]);
      expect(w.cycles.v).toBeLessThanOrEqual(r.cv[1]);
      expect(w.phase).toBeGreaterThanOrEqual(0);
      expect(w.phase).toBeLessThanOrEqual(2 * Math.PI);
    }
  });

  it('structures resolution is seed-deterministic', () => {
    const a = resolveStructures('village-cluster', 'kiln-2');
    const b = resolveStructures('village-cluster', 'kiln-2');
    expect(a).toEqual(b);
  });
});

describe('painted-landscape — palette derivation', () => {
  it('derives a 4-stop palette where shadow ≤ base ≤ mid ≤ highlight by luminance', () => {
    for (const id of splatchIds()) {
      const p = derivePalette(id);
      const lum = (rgb) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
      expect(lum(p.shadow), `${id} shadow ≤ base`).toBeLessThanOrEqual(lum(p.base));
      expect(lum(p.base), `${id} base ≤ mid`).toBeLessThanOrEqual(lum(p.mid));
      expect(lum(p.mid), `${id} mid ≤ highlight`).toBeLessThanOrEqual(lum(p.highlight));
    }
  });

  it('palette is deterministic per splatch (no per-call randomness)', () => {
    const a = derivePalette('dusk-trio');
    const b = derivePalette('dusk-trio');
    expect(a).toEqual(b);
  });

  it('attaches default positions [0, 1/3, 2/3, 1] and gamma 1.0', () => {
    const p = derivePalette('meadow-trio');
    expect(p.positions[0]).toBe(0);
    expect(p.positions[3]).toBe(1);
    expect(p.gamma).toBe(1.0);
  });
});

describe('painted-landscape — heartbeat overrides', () => {
  it('ampScale multiplies the heartbeat\'s amplitude range', () => {
    const base = resolveHeartbeat('gentle-pulse', 'hb-1');
    const scaled = resolveHeartbeat('gentle-pulse', 'hb-1', {
      waves: [{ ampScale: 2 }],
    });
    expect(scaled.waves[0].amplitude).toBeCloseTo(base.waves[0].amplitude * 2);
    // Second component (no override) is unchanged.
    expect(scaled.waves[1].amplitude).toBeCloseTo(base.waves[1].amplitude);
  });

  it('cuScale and cvScale multiply the cycles ranges', () => {
    const base = resolveHeartbeat('gentle-pulse', 'hb-2');
    const scaled = resolveHeartbeat('gentle-pulse', 'hb-2', {
      waves: [{ cuScale: 0.5, cvScale: 1.5 }],
    });
    expect(scaled.waves[0].cycles.u).toBeCloseTo(base.waves[0].cycles.u * 0.5);
    expect(scaled.waves[0].cycles.v).toBeCloseTo(base.waves[0].cycles.v * 1.5);
  });

  it('samples override replaces the recommended density', () => {
    const base = resolveHeartbeat('gentle-pulse', 'hb-3');
    const scaled = resolveHeartbeat('gentle-pulse', 'hb-3', {
      samples: { u: 8, v: 12 },
    });
    expect(base.samples).toEqual({ u: 16, v: 24 });
    expect(scaled.samples).toEqual({ u: 8, v: 12 });
  });

  it('phase is unchanged by amp/cycles scales (seed determines it)', () => {
    const a = resolveHeartbeat('gentle-pulse', 'hb-phase');
    const b = resolveHeartbeat('gentle-pulse', 'hb-phase', { waves: [{ ampScale: 3 }] });
    expect(a.waves[0].phase).toBe(b.waves[0].phase);
  });

  it('null entries in waves array skip those components', () => {
    const base = resolveHeartbeat('gentle-pulse', 'hb-null');
    const scaled = resolveHeartbeat('gentle-pulse', 'hb-null', {
      waves: [null, { ampScale: 2 }],
    });
    expect(scaled.waves[0].amplitude).toBeCloseTo(base.waves[0].amplitude);
    expect(scaled.waves[1].amplitude).toBeCloseTo(base.waves[1].amplitude * 2);
  });

  it('validation rejects too many wave entries for the heartbeat', () => {
    const errors = validatePaintedLandscape({
      kind: 'painted-landscape',
      heartbeat: 'gentle-pulse',  // 2 components
      splatch: 'meadow-trio',
      heartbeatOverrides: { waves: [{ ampScale: 1 }, { ampScale: 1 }, { ampScale: 1 }] },
    });
    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining('has 2 components but overrides specify 3'),
    ]));
  });

  it('validation rejects negative or zero scales', () => {
    expect(validatePaintedLandscape({
      kind: 'painted-landscape', heartbeat: 'gentle-pulse', splatch: 'meadow-trio',
      heartbeatOverrides: { waves: [{ ampScale: 0 }] },
    })).toEqual(expect.arrayContaining([expect.stringContaining('ampScale must be a positive finite number')]));

    expect(validatePaintedLandscape({
      kind: 'painted-landscape', heartbeat: 'gentle-pulse', splatch: 'meadow-trio',
      heartbeatOverrides: { waves: [{ cuScale: -1 }] },
    })).toEqual(expect.arrayContaining([expect.stringContaining('cuScale must be a positive finite number')]));
  });

  it('validation rejects unknown wave override keys', () => {
    const errors = validatePaintedLandscape({
      kind: 'painted-landscape', heartbeat: 'gentle-pulse', splatch: 'meadow-trio',
      heartbeatOverrides: { waves: [{ phaseScale: 2 }] },
    });
    expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("unknown key 'phaseScale'")]));
  });

  it('validation rejects non-integer samples', () => {
    expect(validatePaintedLandscape({
      kind: 'painted-landscape', heartbeat: 'gentle-pulse', splatch: 'meadow-trio',
      heartbeatOverrides: { samples: { u: 16.5, v: 24 } },
    })).toEqual(expect.arrayContaining([expect.stringContaining('samples.u must be an integer')]));
  });

  it('validation rejects samples < 2', () => {
    expect(validatePaintedLandscape({
      kind: 'painted-landscape', heartbeat: 'gentle-pulse', splatch: 'meadow-trio',
      heartbeatOverrides: { samples: { u: 1, v: 24 } },
    })).toEqual(expect.arrayContaining([expect.stringContaining('samples.u must be an integer >= 2')]));
  });

  it('valid heartbeatOverrides pass validation', () => {
    expect(validatePaintedLandscape({
      kind: 'painted-landscape', heartbeat: 'gentle-pulse', splatch: 'meadow-trio',
      heartbeatOverrides: {
        waves: [{ ampScale: 1.5 }, null],
        samples: { u: 20, v: 28 },
      },
    })).toEqual([]);
  });
});

describe('painted-landscape — renderStyle', () => {
  it('exposes the closed enum', () => {
    expect(RENDER_STYLES).toEqual(['painterly', 'topographic', 'wireframe']);
  });

  it('default (no renderStyle) renders polygons with stroke=fill (painterly)', () => {
    const svg = renderPaintedLandscapeToSvg({
      kind: 'painted-landscape',
      heartbeat: 'gentle-pulse',
      splatch: 'meadow-trio',
      seed: 'rs-default',
    });
    // painterly cells have stroke=fill so each polygon has the same
    // rgb(...) appearing in both `fill="..."` and `stroke="..."`.
    expect(svg).toMatch(/fill="rgb\([^"]+\)" stroke="rgb\([^"]+\)"/);
    // No `fill="none"` should appear under painterly mode.
    expect(svg).not.toContain('fill="none"');
  });

  it('wireframe renders cells as fill="none" with colored strokes', () => {
    const svg = renderPaintedLandscapeToSvg({
      kind: 'painted-landscape',
      heartbeat: 'gentle-pulse',
      splatch: 'terminal-amber',
      seed: 'rs-wire',
      renderStyle: 'wireframe',
    });
    // every cell has fill="none"
    const fillNoneCount = (svg.match(/fill="none"/g) || []).length;
    const polygonCount = (svg.match(/<polygon /g) || []).length;
    expect(fillNoneCount).toBe(polygonCount);
  });

  it('topographic renders cells with Lambert fill + a single shared stroke', () => {
    const svg = renderPaintedLandscapeToSvg({
      kind: 'painted-landscape',
      heartbeat: 'gentle-pulse',
      splatch: 'chart-primary',
      seed: 'rs-topo',
      renderStyle: 'topographic',
    });
    // Many cells should share the same stroke color (shadow stop) while
    // having different fills.
    const strokeMatches = svg.match(/stroke="rgb\([^"]+\)"/g) || [];
    const uniqueStrokes = new Set(strokeMatches);
    expect(uniqueStrokes.size).toBe(1);
  });

  it('the three render styles produce categorically different SVGs', () => {
    const base = {
      kind: 'painted-landscape',
      heartbeat: 'gentle-pulse',
      splatch: 'meadow-trio',
      seed: 'rs-cmp',
    };
    const a = renderPaintedLandscapeToSvg({ ...base, renderStyle: 'painterly' });
    const b = renderPaintedLandscapeToSvg({ ...base, renderStyle: 'topographic' });
    const c = renderPaintedLandscapeToSvg({ ...base, renderStyle: 'wireframe' });
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
    expect(a).not.toBe(c);
  });

  it('validation rejects unknown renderStyle', () => {
    const errors = validatePaintedLandscape({
      kind: 'painted-landscape',
      heartbeat: 'gentle-pulse',
      splatch: 'meadow-trio',
      renderStyle: 'fancy',
    });
    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining('renderStyle must be one of'),
    ]));
  });

  it('all RENDER_STYLES values pass validation', () => {
    for (const style of RENDER_STYLES) {
      expect(validatePaintedLandscape({
        kind: 'painted-landscape',
        heartbeat: 'gentle-pulse',
        splatch: 'meadow-trio',
        renderStyle: style,
      })).toEqual([]);
    }
  });
});

describe('painted-landscape — camera glyphs', () => {
  it('loads at least the five seeded cameras', () => {
    const ids = cameraIds();
    for (const id of ['medium-survey', 'wide-cinematic', 'close-up-detail', 'low-angle-hero', 'top-down-survey']) {
      expect(ids).toContain(id);
    }
  });

  it('each camera card carries vanishingPoints, verticalAxis, and roomBasis', () => {
    for (const [id, card] of Object.entries(CAMERAS)) {
      expect(card.camera.vanishingPoints.left, `${id} vp.left`).toHaveLength(2);
      expect(card.camera.vanishingPoints.right, `${id} vp.right`).toHaveLength(2);
      expect(card.camera.verticalAxis, `${id} verticalAxis`).toHaveLength(2);
      expect(card.roomBasis.xRange, `${id} xRange`).toHaveLength(2);
      expect(card.roomBasis.yRange, `${id} yRange`).toHaveLength(2);
      expect(card.roomBasis.frontLeft, `${id} frontLeft`).toHaveLength(2);
      expect(card.roomBasis.depthReach).toBeGreaterThan(0);
      expect(card.roomBasis.verticalUnit).toBeGreaterThan(0);
    }
  });

  it('default (no camera) renders identically to before the camera-glyph landing', () => {
    const a = renderPaintedLandscapeToSvg({
      kind: 'painted-landscape',
      heartbeat: 'gentle-pulse',
      splatch: 'meadow-trio',
      seed: 'cam-default',
    });
    const b = renderPaintedLandscapeToSvg({
      kind: 'painted-landscape',
      heartbeat: 'gentle-pulse',
      splatch: 'meadow-trio',
      seed: 'cam-default',
    });
    // Two renders with no camera should be byte-identical (substrate defaults).
    expect(a).toBe(b);
  });

  it('different camera glyphs change the SVG meaningfully', () => {
    const base = {
      kind: 'painted-landscape',
      heartbeat: 'rocky-irregular',
      splatch: 'bone-trio',
      seed: 'cam-cmp',
    };
    const cams = ['medium-survey', 'wide-cinematic', 'low-angle-hero', 'top-down-survey'];
    const svgs = cams.map((cam) => renderPaintedLandscapeToSvg({ ...base, camera: cam }));
    // All four must be distinct.
    for (let i = 0; i < svgs.length; i += 1) {
      for (let j = i + 1; j < svgs.length; j += 1) {
        expect(svgs[i], `${cams[i]} vs ${cams[j]}`).not.toBe(svgs[j]);
      }
    }
  });

  it('validation rejects unknown camera', () => {
    const errors = validatePaintedLandscape({
      kind: 'painted-landscape',
      heartbeat: 'gentle-pulse',
      splatch: 'meadow-trio',
      camera: 'never-shipped',
    });
    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining("unknown camera 'never-shipped'"),
    ]));
  });

  it('all CAMERAS values pass validation', () => {
    for (const id of cameraIds()) {
      expect(validatePaintedLandscape({
        kind: 'painted-landscape',
        heartbeat: 'gentle-pulse',
        splatch: 'meadow-trio',
        camera: id,
      })).toEqual([]);
    }
  });
});

describe('painted-landscape — new splatches ship under the closed enum', () => {
  it('all stylistic splatches are loaded', () => {
    for (const id of [
      'terminal-amber', 'synthwave-neon', 'vector-cyan', 'chart-primary',
      'velvet-cinema', 'harvest-gold', 'mist-coastal',
    ]) {
      expect(SPLATCHES[id], `${id} loaded`).toBeTruthy();
      expect(SPLATCHES[id].seeds, `${id} has 3 seed colors`).toHaveLength(3);
    }
  });
});

describe('painted-landscape — fBm engine', () => {
  it('resolveHeartbeat on an fBm card returns engine + fbm params', () => {
    const hb = resolveHeartbeat('gentle-roughness', 'fbm-1');
    expect(hb.engine).toBe('fbm');
    expect(hb.fbm).toBeTruthy();
    expect(Number.isInteger(hb.fbm.octaves)).toBe(true);
    expect(hb.fbm.octaves).toBeGreaterThanOrEqual(3);
    expect(hb.fbm.octaves).toBeLessThanOrEqual(4);
    expect(typeof hb.fbm.persistence).toBe('number');
    expect(typeof hb.fbm.lacunarity).toBe('number');
    expect(typeof hb.fbm.baseScale).toBe('number');
    expect(typeof hb.fbm.amplitude).toBe('number');
    expect(Number.isInteger(hb.fbm.noiseSeed)).toBe(true);
    expect(hb.waves).toBeUndefined();
  });

  it('seeded determinism holds for fBm heartbeats', () => {
    const a = resolveHeartbeat('rocky-irregular', 'fbm-det-1');
    const b = resolveHeartbeat('rocky-irregular', 'fbm-det-1');
    expect(a.fbm).toEqual(b.fbm);
  });

  it('different seeds produce different fBm parameters within the same recipe', () => {
    const a = resolveHeartbeat('rocky-irregular', 'A');
    const b = resolveHeartbeat('rocky-irregular', 'B');
    expect(a.fbm).not.toEqual(b.fbm);
  });

  it('renders an fBm heartbeat manifest to a non-empty SVG', () => {
    const svg = renderPaintedLandscapeToSvg({
      kind: 'painted-landscape',
      heartbeat: 'gentle-roughness',
      splatch: 'meadow-trio',
      seed: 'fbm-render-1',
    });
    expect(svg).toContain('<svg');
    const polygons = (svg.match(/<polygon /g) || []).length;
    // gentle-roughness ships 24 x 36 = 864 cells.
    expect(polygons).toBe(24 * 36);
  });

  it('fBm output differs from sine output at the same splatch + seed', () => {
    const fbmSvg = renderPaintedLandscapeToSvg({
      kind: 'painted-landscape',
      heartbeat: 'gentle-roughness',
      splatch: 'meadow-trio',
      seed: 'cross-engine',
    });
    const sineSvg = renderPaintedLandscapeToSvg({
      kind: 'painted-landscape',
      heartbeat: 'gentle-pulse',
      splatch: 'meadow-trio',
      seed: 'cross-engine',
    });
    expect(fbmSvg).not.toBe(sineSvg);
  });

  it('validation rejects wave overrides on an fBm heartbeat with a clear engine-mismatch error', () => {
    const errors = validatePaintedLandscape({
      kind: 'painted-landscape',
      heartbeat: 'gentle-roughness',
      splatch: 'meadow-trio',
      heartbeatOverrides: { waves: [{ ampScale: 2 }] },
    });
    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining("uses engine 'fbm'"),
    ]));
  });

  it('samples override still applies to fBm heartbeats', () => {
    const svg = renderPaintedLandscapeToSvg({
      kind: 'painted-landscape',
      heartbeat: 'glacial-smooth',
      splatch: 'glacier-trio',
      seed: 'samp',
      heartbeatOverrides: { samples: { u: 10, v: 14 } },
    });
    const polygons = (svg.match(/<polygon /g) || []).length;
    expect(polygons).toBe(10 * 14);
  });
});

describe('painted-landscape — palette overrides', () => {
  it('stops override replaces only the specified roles', () => {
    const base = derivePalette('meadow-trio');
    const overridden = derivePalette('meadow-trio', {
      stops: { shadow: '#000000', highlight: '#ffffff' },
    });
    expect(overridden.shadow).toEqual([0, 0, 0]);
    expect(overridden.highlight).toEqual([255, 255, 255]);
    // Untouched roles match the base palette.
    expect(overridden.base).toEqual(base.base);
    expect(overridden.mid).toEqual(base.mid);
  });

  it('positions override is preserved on the returned palette', () => {
    const p = derivePalette('meadow-trio', { positions: [0, 0.35, 0.7, 1] });
    expect(p.positions).toEqual([0, 0.35, 0.7, 1]);
  });

  it('gamma override is preserved on the returned palette', () => {
    const p = derivePalette('meadow-trio', { gamma: 1.6 });
    expect(p.gamma).toBe(1.6);
  });

  it('invalid hex in stops override is silently ignored at derive time', () => {
    // Validation rejects at manifest level; if it slips through (direct
    // API call), the deriver falls back to the derived stop rather than
    // crashing or producing garbage colors.
    const base = derivePalette('meadow-trio');
    const p = derivePalette('meadow-trio', { stops: { shadow: 'not-hex' } });
    expect(p.shadow).toEqual(base.shadow);
  });

  it('manifest-level validation rejects malformed paletteOverrides', () => {
    expect(validatePaintedLandscape({
      kind: 'painted-landscape', heartbeat: 'gentle-pulse', splatch: 'meadow-trio',
      paletteOverrides: { stops: { shadow: 'not-hex' } },
    })).toEqual(expect.arrayContaining([expect.stringContaining('paletteOverrides.stops.shadow')]));

    expect(validatePaintedLandscape({
      kind: 'painted-landscape', heartbeat: 'gentle-pulse', splatch: 'meadow-trio',
      paletteOverrides: { positions: [0, 0.5, 1] },  // wrong length
    })).toEqual(expect.arrayContaining([expect.stringContaining('paletteOverrides.positions must be an array of exactly 4')]));

    expect(validatePaintedLandscape({
      kind: 'painted-landscape', heartbeat: 'gentle-pulse', splatch: 'meadow-trio',
      paletteOverrides: { positions: [0.1, 0.3, 0.7, 1] },  // doesn't start at 0
    })).toEqual(expect.arrayContaining([expect.stringContaining('first stop must be 0 and last stop must be 1')]));

    expect(validatePaintedLandscape({
      kind: 'painted-landscape', heartbeat: 'gentle-pulse', splatch: 'meadow-trio',
      paletteOverrides: { positions: [0, 0.7, 0.3, 1] },  // not increasing
    })).toEqual(expect.arrayContaining([expect.stringContaining('strictly increasing')]));

    expect(validatePaintedLandscape({
      kind: 'painted-landscape', heartbeat: 'gentle-pulse', splatch: 'meadow-trio',
      paletteOverrides: { gamma: -1 },
    })).toEqual(expect.arrayContaining([expect.stringContaining('gamma must be a positive finite number')]));

    expect(validatePaintedLandscape({
      kind: 'painted-landscape', heartbeat: 'gentle-pulse', splatch: 'meadow-trio',
      paletteOverrides: { stops: { wrong_role: '#000000' } },
    })).toEqual(expect.arrayContaining([expect.stringContaining("unknown role 'wrong_role'")]));
  });

  it('valid paletteOverrides pass validation', () => {
    expect(validatePaintedLandscape({
      kind: 'painted-landscape', heartbeat: 'gentle-pulse', splatch: 'meadow-trio',
      paletteOverrides: {
        stops: { shadow: '#222222', highlight: '#eeeeee' },
        positions: [0, 0.25, 0.7, 1],
        gamma: 1.4,
      },
    })).toEqual([]);
  });
});

describe('painted-landscape — validation', () => {
  it('rejects unknown heartbeat / splatch / structure ids', () => {
    expect(validatePaintedLandscape({ kind: 'painted-landscape', heartbeat: 'unknown', splatch: 'meadow-trio' }))
      .toEqual(expect.arrayContaining([expect.stringContaining("unknown heartbeat 'unknown'")]));
    expect(validatePaintedLandscape({ kind: 'painted-landscape', heartbeat: 'gentle-pulse', splatch: 'unknown' }))
      .toEqual(expect.arrayContaining([expect.stringContaining("unknown splatch 'unknown'")]));
    expect(validatePaintedLandscape({ kind: 'painted-landscape', heartbeat: 'gentle-pulse', splatch: 'meadow-trio', structures: 'unknown' }))
      .toEqual(expect.arrayContaining([expect.stringContaining("unknown structure glyph 'unknown'")]));
  });

  it('rejects non-finite light vectors', () => {
    const errors = validatePaintedLandscape({
      kind: 'painted-landscape',
      heartbeat: 'gentle-pulse',
      splatch: 'meadow-trio',
      light: { x: 1, y: NaN, z: 0 },
    });
    expect(errors).toEqual(expect.arrayContaining([expect.stringContaining('light')]));
  });

  it('rejects wrong manifest.kind', () => {
    const errors = validatePaintedLandscape({ kind: 'sketch', heartbeat: 'gentle-pulse', splatch: 'meadow-trio' });
    expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("manifest.kind must be 'painted-landscape'")]));
  });

  it('accepts the minimal valid manifest', () => {
    const errors = validatePaintedLandscape({
      kind: 'painted-landscape',
      heartbeat: 'gentle-pulse',
      splatch: 'meadow-trio',
    });
    expect(errors).toEqual([]);
  });
});

describe('painted-landscape — render', () => {
  it('renders a minimal manifest to an SVG with polygons', () => {
    const svg = renderPaintedLandscapeToSvg({
      kind: 'painted-landscape',
      heartbeat: 'gentle-pulse',
      splatch: 'meadow-trio',
      seed: 'unit-test-1',
    });
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    const polygons = (svg.match(/<polygon /g) || []).length;
    // Cell count = 16 × 24 for gentle-pulse, no structures.
    expect(polygons).toBe(16 * 24);
  });

  it('renders with structures: cell count + 3 faces per structure', () => {
    const svg = renderPaintedLandscapeToSvg({
      kind: 'painted-landscape',
      heartbeat: 'gentle-pulse',
      splatch: 'meadow-trio',
      structures: 'monument-row',
      seed: 'unit-test-1',
    });
    // monument-row scatters 3 sites, each contributing 3 visible faces.
    const polygons = (svg.match(/<polygon /g) || []).length;
    expect(polygons).toBe(16 * 24 + 3 * 3);
  });

  it('throws on invalid manifest with a structured error', () => {
    expect(() =>
      renderPaintedLandscapeToSvg({
        kind: 'painted-landscape',
        heartbeat: 'no-such-heartbeat',
        splatch: 'meadow-trio',
      }),
    ).toThrow(/unknown heartbeat/);
  });

  it('respects light override (different svg than default)', () => {
    const base = {
      kind: 'painted-landscape',
      heartbeat: 'gentle-pulse',
      splatch: 'meadow-trio',
      seed: 'unit-test-1',
    };
    const a = renderPaintedLandscapeToSvg(base);
    const b = renderPaintedLandscapeToSvg({ ...base, light: { x: 0.8, y: -0.2, z: 0.3 } });
    expect(a).not.toBe(b);
  });

  it('paletteOverrides.stops changes the colors in the SVG', () => {
    const base = {
      kind: 'painted-landscape',
      heartbeat: 'gentle-pulse',
      splatch: 'meadow-trio',
      seed: 'unit-test-1',
    };
    const plain = renderPaintedLandscapeToSvg(base);
    const tweaked = renderPaintedLandscapeToSvg({
      ...base,
      paletteOverrides: { stops: { shadow: '#000000', highlight: '#ffffff' } },
    });
    // The override must change the rendered output. A specific colour
    // assertion would be brittle (gentle-pulse slopes never quite reach
    // the shadow stop under the default light); the deriver-level test
    // above proves stop replacement at the palette layer.
    expect(plain).not.toBe(tweaked);
  });

  it('paletteOverrides.gamma changes the SVG output', () => {
    const base = {
      kind: 'painted-landscape',
      heartbeat: 'gentle-pulse',
      splatch: 'meadow-trio',
      seed: 'unit-test-1',
    };
    const linear = renderPaintedLandscapeToSvg(base);
    const curved = renderPaintedLandscapeToSvg({
      ...base,
      paletteOverrides: { gamma: 2.0 },
    });
    expect(linear).not.toBe(curved);
  });

  it('paletteOverrides.positions changes the SVG output', () => {
    const base = {
      kind: 'painted-landscape',
      heartbeat: 'gentle-pulse',
      splatch: 'meadow-trio',
      seed: 'unit-test-1',
    };
    const linear = renderPaintedLandscapeToSvg(base);
    const reweighted = renderPaintedLandscapeToSvg({
      ...base,
      paletteOverrides: { positions: [0, 0.15, 0.5, 1] },
    });
    expect(linear).not.toBe(reweighted);
  });

  it('heartbeatOverrides.samples produces a different polygon count', () => {
    const base = {
      kind: 'painted-landscape',
      heartbeat: 'gentle-pulse',
      splatch: 'meadow-trio',
      seed: 'unit-test-1',
    };
    const defaultSvg = renderPaintedLandscapeToSvg(base);
    const coarseSvg = renderPaintedLandscapeToSvg({
      ...base,
      heartbeatOverrides: { samples: { u: 8, v: 12 } },
    });
    const defaultCells = (defaultSvg.match(/<polygon /g) || []).length;
    const coarseCells = (coarseSvg.match(/<polygon /g) || []).length;
    expect(defaultCells).toBe(16 * 24);
    expect(coarseCells).toBe(8 * 12);
  });

  it('heartbeatOverrides.waves changes the SVG output', () => {
    const base = {
      kind: 'painted-landscape',
      heartbeat: 'gentle-pulse',
      splatch: 'meadow-trio',
      seed: 'unit-test-1',
    };
    const plain = renderPaintedLandscapeToSvg(base);
    const louder = renderPaintedLandscapeToSvg({
      ...base,
      heartbeatOverrides: { waves: [{ ampScale: 2 }] },
    });
    expect(plain).not.toBe(louder);
  });
});
