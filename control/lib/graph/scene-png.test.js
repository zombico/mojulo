import { describe, expect, it } from 'vitest';

import { CHROMIUM_LAUNCH_ARGS, CHROMIUM_WEBGL_ARGS } from '@/lib/graph/chromium';
import { renderSceneToPng, renderWorldToPng } from '@/lib/graph/scene-png';

// These guard the launch-arg contract and input validation WITHOUT launching a
// browser (an actual bake is exercised by the heavyweight spike under
// vitest.spike.config.js). The CSS-3D/SVG bake and the WebGL World bake need
// opposite GPU postures, so a regression that crossed the two args would silently
// produce blank stills — assert they stay distinct.
describe('chromium launch args', () => {
  it('CSS-3D/SVG bake disables the GPU (deterministic, no GL)', () => {
    expect(CHROMIUM_LAUNCH_ARGS).toContain('--disable-gpu');
    expect(CHROMIUM_LAUNCH_ARGS).not.toContain('--use-angle=swiftshader');
  });

  it('WebGL World bake routes GL through SwiftShader and never disables the GPU', () => {
    expect(CHROMIUM_WEBGL_ARGS).toContain('--use-angle=swiftshader');
    expect(CHROMIUM_WEBGL_ARGS).toContain('--enable-unsafe-swiftshader');
    expect(CHROMIUM_WEBGL_ARGS).not.toContain('--disable-gpu');
  });
});

describe('input validation', () => {
  it('renderSceneToPng rejects non-string HTML', async () => {
    await expect(renderSceneToPng(null)).rejects.toThrow(/requires scene HTML/);
  });

  it('renderWorldToPng rejects non-string HTML', async () => {
    await expect(renderWorldToPng(null)).rejects.toThrow(/requires World HTML/);
  });
});
