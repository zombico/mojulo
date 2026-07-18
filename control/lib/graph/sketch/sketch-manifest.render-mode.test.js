import { describe, expect, it } from 'vitest';

import { classifyBucket, isBucket, isPolygomerManjiTree, sketchRenderMode } from './sketch-manifest.js';

// A polygomer: 3D manji-tree with lathe monomers (shape-from-dream / polygomerization).
const POLYGOMER = {
  kind: 'manji-tree',
  dimensions: '3d',
  tree: { id: 'world', spine: {} },
  lathes: [{ axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 1 }, profile: [{ t: 0, radius: 1 }] }],
};
// Same tree, lathes authored as in-tree leaf nodes instead of the top-level array.
const POLYGOMER_LEAF = {
  kind: 'manji-tree',
  dimensions: '3d',
  tree: { id: 'world', children: [{ kind: 'lathe', axisFrom: 'self/slot/a', axisTo: 'self/slot/b' }] },
};
// Structural manji-trees with no face-lowerable mass.
const MANJI_2D = { kind: 'manji-tree', tree: { id: 'root' } };
const MANJI_3D_BARE = { kind: 'manji-tree', dimensions: '3d', tree: { id: 'root' } };

describe('sketchRenderMode', () => {
  it('routes traversable box-world kinds to the three.js World renderer', () => {
    expect(sketchRenderMode({ kind: 'fractal-city' })).toBe('world');
    expect(sketchRenderMode({ kind: 'transportation-hub' })).toBe('world');
    expect(sketchRenderMode({ kind: 'vehicle-instance' })).toBe('world');
  });

  it('keeps the turntable as a preset-shot CSS-3D scene', () => {
    expect(sketchRenderMode({ kind: 'css3d-turntable' })).toBe('scene');
  });

  it('routes baked illustration kinds to the SVG still renderer', () => {
    expect(sketchRenderMode({ kind: 'painted-landscape' })).toBe('svg');
    expect(sketchRenderMode({ kind: 'manji-tree' })).toBe('svg');
    expect(sketchRenderMode({ kind: 'carved-solid' })).toBe('svg');
  });

  it('routes polygomer manji-trees to the World renderer; structural trees stay SVG', () => {
    expect(sketchRenderMode(POLYGOMER)).toBe('world');
    expect(sketchRenderMode(POLYGOMER_LEAF)).toBe('world');
    expect(sketchRenderMode(MANJI_2D)).toBe('svg');
    expect(sketchRenderMode(MANJI_3D_BARE)).toBe('svg');
  });

  it('falls through to the diagram renderer for charts / flows / unknown kinds', () => {
    expect(sketchRenderMode({ kind: 'stacked-bar' })).toBe('diagram');
    expect(sketchRenderMode({})).toBe('diagram');
    expect(sketchRenderMode(null)).toBe('diagram');
  });
});

describe('classifyBucket', () => {
  it('classifies traversable box-world kinds into the world concern', () => {
    expect(classifyBucket({ kind: 'fractal-city' })).toBe('world');
    expect(classifyBucket({ kind: 'transportation-hub' })).toBe('world');
  });

  it('keeps still / painterly kinds (incl. the turntable) in the illustration concern', () => {
    expect(classifyBucket({ kind: 'painted-landscape' })).toBe('illustration');
    expect(classifyBucket({ kind: 'figure' })).toBe('illustration');
    expect(classifyBucket({ kind: 'css3d-turntable' })).toBe('illustration');
  });

  it('classifies polygomer manji-trees into the world concern; structural trees stay illustration', () => {
    expect(classifyBucket(POLYGOMER)).toBe('world');
    expect(classifyBucket(MANJI_2D)).toBe('illustration');
    expect(classifyBucket(MANJI_3D_BARE)).toBe('illustration');
  });

  it('classifies charts / flows / unknown kinds as diagrams', () => {
    expect(classifyBucket({ kind: 'stacked-bar' })).toBe('diagram');
    expect(classifyBucket({})).toBe('diagram');
    expect(classifyBucket(null)).toBe('diagram');
  });
});

describe('isPolygomerManjiTree', () => {
  it('requires kind manji-tree, dimensions 3d, and lathe monomers', () => {
    expect(isPolygomerManjiTree(POLYGOMER)).toBe(true);
    expect(isPolygomerManjiTree(POLYGOMER_LEAF)).toBe(true);
    expect(isPolygomerManjiTree(MANJI_2D)).toBe(false);
    expect(isPolygomerManjiTree(MANJI_3D_BARE)).toBe(false);
    expect(isPolygomerManjiTree({ ...POLYGOMER, kind: 'workbench' })).toBe(false);
    expect(isPolygomerManjiTree(null)).toBe(false);
  });
});

describe('isBucket', () => {
  it('accepts the three concern buckets and rejects anything else', () => {
    for (const b of ['diagram', 'illustration', 'world']) expect(isBucket(b)).toBe(true);
    expect(isBucket('scene')).toBe(false);
    expect(isBucket('')).toBe(false);
    expect(isBucket(null)).toBe(false);
  });
});
