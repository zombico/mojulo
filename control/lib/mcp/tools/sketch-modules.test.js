import { describe, it, expect } from 'vitest';

import * as barrel from './sketches.js';

/**
 * Barrel-surface contract for the Phase 1c split.
 *
 * WHY THIS EXISTS: when sketches.js was split, one constant moved to a sibling
 * without an `export` keyword. Every suite still passed — Vitest's ESM interop
 * resolves a missing named import to `undefined` rather than throwing — but
 * native ESM is strict, so the real MCP server died at load with
 * "does not provide an export named POLYGONIZER_PRELOAD_SCHEMA". A green test
 * run meant nothing; only launching the CLI caught it.
 *
 * So this asserts every name the barrel re-exports is actually DEFINED. Under
 * Vitest a missing sibling export arrives as undefined and fails here — which
 * turns a class of runtime-fatal bug back into a test failure.
 */
const HANDLERS = [
  'createSketchHandler', 'updateSketchHandler',
  'getSketchVocabHandler', 'getStyleVocabHandler',
  'diffSketchesHandler',
  'createPolygonizedSketchHandler', 'getPolygonizerPacketHandler',
  'submitPolygonizerManifestHandler', 'getSkinPacketHandler', 'skinPolygomerHandler',
  'exportModelHandler', 'bindMeshRenderHandler',
  'getImageRenderPacketHandler', 'bindCharacterSheetHandler', 'bindImageRenderHandler',
];
const VALUES = [
  'PRELOAD_MAX_ITEMS', 'resolvePreloads', 'resolvePreloadSketch',
  'resolveCharacterRefs', 'mintSketch', 'exportsBaseDir', 'registerSketchTools',
];

describe('sketches.js barrel — every re-export resolves', () => {
  it('exports every handler as a function', () => {
    const broken = HANDLERS.filter((n) => typeof barrel[n] !== 'function');
    expect(broken, `not functions on the barrel: ${broken.join(', ')}`).toEqual([]);
  });

  it('exports every shared value as something defined', () => {
    const broken = VALUES.filter((n) => barrel[n] === undefined);
    expect(broken, `undefined on the barrel: ${broken.join(', ')}`).toEqual([]);
  });

  it('the sibling modules resolve each other (no undefined cross-imports)', async () => {
    const mods = await Promise.all([
      import('./sketch-mint.js'),
      import('./sketch-vocab.js'),
      import('./sketch-diff-tool.js'),
      import('./sketch-polygonizer.js'),
      import('./sketch-model-export.js'),
      import('./sketch-image-render.js'),
    ]);
    for (const mod of mods) {
      const dead = Object.entries(mod).filter(([, v]) => v === undefined).map(([k]) => k);
      expect(dead, `module exports undefined: ${dead.join(', ')}`).toEqual([]);
    }
    // the one that actually broke
    const poly = mods[3];
    expect(poly.POLYGONIZER_PRELOAD_SCHEMA).toBeDefined();
  });
});
