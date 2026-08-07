process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createPaintedLandscapeHandler } from './painted-landscape.js';
import { renderPaintedLandscapeToSvg } from '@/lib/graph/polygonizer/painted-landscape';

beforeEach(() => {
  closeDb();
});

describe('create_painted_landscape', () => {
  it('mints a painted-landscape manifest into SketchRepository with kind: painted-landscape', async () => {
    const result = await createPaintedLandscapeHandler({
      title: 'gentle meadow',
      heartbeat: 'gentle-pulse',
      splatch: 'meadow-trio',
      structures: 'monument-row',
      seed: 'autumn-1',
      ref: 'pl_meadow_1',
    });
    expect(result.ok).toBe(true);
    expect(result.ref).toBe('pl_meadow_1');
    expect(result.url).toBe('/sketches/pl_meadow_1');
    expect(result.svgUrl).toBe('/api/sketches/pl_meadow_1/svg?inline=1');

    const stored = SketchRepository.getByRef('pl_meadow_1');
    expect(stored).toBeTruthy();
    expect(stored.manifest.kind).toBe('painted-landscape');
    expect(stored.manifest.heartbeat).toBe('gentle-pulse');
    expect(stored.manifest.splatch).toBe('meadow-trio');
    expect(stored.manifest.structures).toBe('monument-row');
    expect(stored.manifest.seed).toBe('autumn-1');
  });

  it('renders the stored manifest into a self-contained SVG', async () => {
    await createPaintedLandscapeHandler({
      title: 'gentle meadow svg',
      heartbeat: 'gentle-pulse',
      splatch: 'meadow-trio',
      structures: 'monument-row',
      seed: 'autumn-1',
      ref: 'pl_meadow_svg',
    });
    const stored = SketchRepository.getByRef('pl_meadow_svg');
    const svg = renderPaintedLandscapeToSvg(stored.manifest);
    expect(svg).toContain('<svg');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    // 16 × 24 terrain cells + 3 monument-row obelisks × 3 visible faces.
    const polygons = (svg.match(/<polygon /g) || []).length;
    expect(polygons).toBe(16 * 24 + 3 * 3);
  });

  it('handler accepts the minimal valid input', async () => {
    const result = await createPaintedLandscapeHandler({
      title: 'minimal',
      heartbeat: 'chop',
      splatch: 'glacier-trio',
      ref: 'pl_minimal',
    });
    expect(result.ok).toBe(true);
    const stored = SketchRepository.getByRef('pl_minimal');
    expect(stored.manifest.structures).toBeUndefined();
    expect(stored.manifest.seed).toBeUndefined();
  });

  it('rejects missing title', async () => {
    await expect(
      createPaintedLandscapeHandler({
        heartbeat: 'gentle-pulse',
        splatch: 'meadow-trio',
      }),
    ).rejects.toThrow(/title/);
  });

  it('rejects unknown heartbeat with available list in the error', async () => {
    await expect(
      createPaintedLandscapeHandler({
        title: 'oops',
        heartbeat: 'bogus',
        splatch: 'meadow-trio',
      }),
    ).rejects.toThrow(/unknown heartbeat 'bogus'/);
  });

  it('rejects unknown splatch with available list in the error', async () => {
    await expect(
      createPaintedLandscapeHandler({
        title: 'oops',
        heartbeat: 'gentle-pulse',
        splatch: 'bogus',
      }),
    ).rejects.toThrow(/unknown splatch 'bogus'/);
  });

  it('rejects unknown structure glyph', async () => {
    await expect(
      createPaintedLandscapeHandler({
        title: 'oops',
        heartbeat: 'gentle-pulse',
        splatch: 'meadow-trio',
        structures: 'bogus',
      }),
    ).rejects.toThrow(/unknown structure glyph 'bogus'/);
  });

  it('rejects invalid ref pattern', async () => {
    await expect(
      createPaintedLandscapeHandler({
        title: 'oops',
        heartbeat: 'gentle-pulse',
        splatch: 'meadow-trio',
        ref: 'has spaces',
      }),
    ).rejects.toThrow(/ref/);
  });

  it('seed-determinism: same input → same SVG output', async () => {
    await createPaintedLandscapeHandler({
      title: 't1',
      heartbeat: 'gentle-pulse',
      splatch: 'meadow-trio',
      structures: 'monument-row',
      seed: 'twin-1',
      ref: 'pl_twin_a',
    });
    await createPaintedLandscapeHandler({
      title: 't2',
      heartbeat: 'gentle-pulse',
      splatch: 'meadow-trio',
      structures: 'monument-row',
      seed: 'twin-1',
      ref: 'pl_twin_b',
    });
    const a = SketchRepository.getByRef('pl_twin_a');
    const b = SketchRepository.getByRef('pl_twin_b');
    const svgA = renderPaintedLandscapeToSvg(a.manifest);
    const svgB = renderPaintedLandscapeToSvg(b.manifest);
    // Strip the file-specific title metadata that doesn't appear in the
    // SVG body; only geometry + palette should be byte-identical.
    expect(svgA).toBe(svgB);
  });

  it('different seed → different SVG output (variation within recipe)', async () => {
    await createPaintedLandscapeHandler({
      title: 'a',
      heartbeat: 'gentle-pulse',
      splatch: 'meadow-trio',
      structures: 'monument-row',
      seed: 'seed-A',
      ref: 'pl_seed_a',
    });
    await createPaintedLandscapeHandler({
      title: 'b',
      heartbeat: 'gentle-pulse',
      splatch: 'meadow-trio',
      structures: 'monument-row',
      seed: 'seed-B',
      ref: 'pl_seed_b',
    });
    const a = SketchRepository.getByRef('pl_seed_a');
    const b = SketchRepository.getByRef('pl_seed_b');
    const svgA = renderPaintedLandscapeToSvg(a.manifest);
    const svgB = renderPaintedLandscapeToSvg(b.manifest);
    expect(svgA).not.toBe(svgB);
  });

  it('paletteOverrides round-trips through the manifest and changes the SVG', async () => {
    await createPaintedLandscapeHandler({
      title: 'plain',
      heartbeat: 'gentle-pulse',
      splatch: 'meadow-trio',
      seed: 'P1',
      ref: 'pl_pal_plain',
    });
    await createPaintedLandscapeHandler({
      title: 'tweaked',
      heartbeat: 'gentle-pulse',
      splatch: 'meadow-trio',
      seed: 'P1',
      paletteOverrides: {
        stops: { shadow: '#000000', highlight: '#ffffff' },
        gamma: 1.6,
        positions: [0, 0.25, 0.7, 1],
      },
      ref: 'pl_pal_tweaked',
    });
    const plain = SketchRepository.getByRef('pl_pal_plain');
    const tweaked = SketchRepository.getByRef('pl_pal_tweaked');
    expect(tweaked.manifest.paletteOverrides).toEqual({
      stops: { shadow: '#000000', highlight: '#ffffff' },
      gamma: 1.6,
      positions: [0, 0.25, 0.7, 1],
    });
    const svgPlain = renderPaintedLandscapeToSvg(plain.manifest);
    const svgTweaked = renderPaintedLandscapeToSvg(tweaked.manifest);
    expect(svgPlain).not.toBe(svgTweaked);
  });

  it('rejects malformed paletteOverrides at mint time', async () => {
    await expect(
      createPaintedLandscapeHandler({
        title: 'bad',
        heartbeat: 'gentle-pulse',
        splatch: 'meadow-trio',
        paletteOverrides: { gamma: -1 },
      }),
    ).rejects.toThrow(/gamma must be a positive finite number/);
  });

  it('heartbeatOverrides round-trip through the manifest and shape the render', async () => {
    await createPaintedLandscapeHandler({
      title: 'plain',
      heartbeat: 'gentle-pulse',
      splatch: 'meadow-trio',
      seed: 'HB1',
      ref: 'pl_hb_plain',
    });
    await createPaintedLandscapeHandler({
      title: 'tweaked',
      heartbeat: 'gentle-pulse',
      splatch: 'meadow-trio',
      seed: 'HB1',
      heartbeatOverrides: {
        waves: [{ ampScale: 1.5 }, { cuScale: 0.5 }],
        samples: { u: 20, v: 30 },
      },
      ref: 'pl_hb_tweaked',
    });
    const plain = SketchRepository.getByRef('pl_hb_plain');
    const tweaked = SketchRepository.getByRef('pl_hb_tweaked');
    expect(tweaked.manifest.heartbeatOverrides).toEqual({
      waves: [{ ampScale: 1.5 }, { cuScale: 0.5 }],
      samples: { u: 20, v: 30 },
    });
    const svgPlain = renderPaintedLandscapeToSvg(plain.manifest);
    const svgTweaked = renderPaintedLandscapeToSvg(tweaked.manifest);
    expect(svgPlain).not.toBe(svgTweaked);
    // Polygon count reflects the samples override (no structures).
    const tweakedCells = (svgTweaked.match(/<polygon /g) || []).length;
    expect(tweakedCells).toBe(20 * 30);
  });

  it('renderStyle round-trips through the manifest and changes the SVG', async () => {
    await createPaintedLandscapeHandler({
      title: 'painterly',
      heartbeat: 'gentle-pulse',
      splatch: 'terminal-amber',
      seed: 'RS-1',
      ref: 'pl_rs_painterly',
    });
    await createPaintedLandscapeHandler({
      title: 'wireframe',
      heartbeat: 'gentle-pulse',
      splatch: 'terminal-amber',
      seed: 'RS-1',
      renderStyle: 'wireframe',
      ref: 'pl_rs_wireframe',
    });
    const a = SketchRepository.getByRef('pl_rs_painterly');
    const b = SketchRepository.getByRef('pl_rs_wireframe');
    expect(a.manifest.renderStyle).toBeUndefined();
    expect(b.manifest.renderStyle).toBe('wireframe');
    const svgA = renderPaintedLandscapeToSvg(a.manifest);
    const svgB = renderPaintedLandscapeToSvg(b.manifest);
    expect(svgA).not.toBe(svgB);
    expect(svgB).toContain('fill="none"');
  });

  it('camera glyph round-trips through the manifest and changes the SVG', async () => {
    await createPaintedLandscapeHandler({
      title: 'medium',
      heartbeat: 'rocky-irregular',
      splatch: 'bone-trio',
      seed: 'CAM-1',
      camera: 'medium-survey',
      ref: 'pl_cam_med',
    });
    await createPaintedLandscapeHandler({
      title: 'overhead',
      heartbeat: 'rocky-irregular',
      splatch: 'bone-trio',
      seed: 'CAM-1',
      camera: 'top-down-survey',
      ref: 'pl_cam_top',
    });
    const a = SketchRepository.getByRef('pl_cam_med');
    const b = SketchRepository.getByRef('pl_cam_top');
    expect(a.manifest.camera).toBe('medium-survey');
    expect(b.manifest.camera).toBe('top-down-survey');
    const svgA = renderPaintedLandscapeToSvg(a.manifest);
    const svgB = renderPaintedLandscapeToSvg(b.manifest);
    expect(svgA).not.toBe(svgB);
  });

  it('rejects unknown camera at mint time', async () => {
    await expect(
      createPaintedLandscapeHandler({
        title: 'bad-cam',
        heartbeat: 'gentle-pulse',
        splatch: 'meadow-trio',
        camera: 'never-shipped',
      }),
    ).rejects.toThrow(/unknown camera/);
  });

  it('rejects unknown renderStyle at mint time', async () => {
    await expect(
      createPaintedLandscapeHandler({
        title: 'bad',
        heartbeat: 'gentle-pulse',
        splatch: 'meadow-trio',
        renderStyle: 'pixel-art',
      }),
    ).rejects.toThrow(/renderStyle must be one of/);
  });

  it('rejects too many wave entries for the chosen heartbeat at mint time', async () => {
    await expect(
      createPaintedLandscapeHandler({
        title: 'bad',
        heartbeat: 'gentle-pulse',
        splatch: 'meadow-trio',
        heartbeatOverrides: { waves: [{}, {}, {}] },
      }),
    ).rejects.toThrow(/has 2 components but overrides specify 3/);
  });

  it('light override propagates through the rendered SVG', async () => {
    await createPaintedLandscapeHandler({
      title: 'default light',
      heartbeat: 'gentle-pulse',
      splatch: 'meadow-trio',
      seed: 'L1',
      ref: 'pl_light_default',
    });
    await createPaintedLandscapeHandler({
      title: 'overridden light',
      heartbeat: 'gentle-pulse',
      splatch: 'meadow-trio',
      seed: 'L1',
      light: { x: 0.85, y: -0.2, z: 0.3 },
      ref: 'pl_light_override',
    });
    const a = SketchRepository.getByRef('pl_light_default');
    const b = SketchRepository.getByRef('pl_light_override');
    const svgA = renderPaintedLandscapeToSvg(a.manifest);
    const svgB = renderPaintedLandscapeToSvg(b.manifest);
    expect(svgA).not.toBe(svgB);
  });
});
