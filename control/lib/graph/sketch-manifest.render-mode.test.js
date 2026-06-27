import { describe, expect, it } from 'vitest';

import { classifyBucket, isBucket, sketchRenderMode } from './sketch-manifest.js';

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

  it('classifies charts / flows / unknown kinds as diagrams', () => {
    expect(classifyBucket({ kind: 'stacked-bar' })).toBe('diagram');
    expect(classifyBucket({})).toBe('diagram');
    expect(classifyBucket(null)).toBe('diagram');
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
