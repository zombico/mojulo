import { describe, it, expect } from 'vitest';

import {
  factsFromManifest,
  factsOf,
  kindOf,
  renderModeOf,
  summarizeSketch,
  summaryKeepsManifest,
} from '@/lib/graph/sketch/sketch-summary';

const full = (ref, manifest, extra = {}) => ({
  ref, title: ref, manifest, createdAt: 1, folderRef: null, bucket: 'world', bucketOverride: null, ...extra,
});

describe('summarizeSketch — the wire shape', () => {
  it('drops the manifest of a world row and keeps the badge facts', () => {
    const s = summarizeSketch(full('sk_w', {
      kind: 'controllable', seed: 7, faces: new Array(500).fill({ corners: [] }),
      giBake: { adapter: 'inline-faces', bakedAt: 1 }, game: { id: 'g' },
    }));
    expect(s.manifest).toBeUndefined();
    expect(s).toMatchObject({
      ref: 'sk_w', kind: 'controllable', renderMode: 'world', bucket: 'world', bucketOverride: null,
      facts: { seed: 7, giBake: true, giAdapter: 'inline-faces', game: true, audio: false },
    });
  });

  it('keeps the manifest of a diagram-mode row — CreationMap draws from it', () => {
    const manifest = { nodes: [], edges: [], viewBox: { width: 10, height: 10 } };
    const s = summarizeSketch(full('sk_d', manifest, { bucket: 'diagram' }));
    expect(s.renderMode).toBe('diagram');
    expect(s.kind).toBeNull();
    expect(s.manifest).toBe(manifest);
  });

  it('keeps the manifest of a voice row — the register card reads the recipe', () => {
    const manifest = { kind: 'voice-register', bank: 'jp-female' };
    const s = summarizeSketch(full('sk_v', manifest, { bucket: 'voice' }));
    expect(s.renderMode).toBe('voice');
    expect(s.manifest).toBe(manifest);
  });

  it('states the rule in one place', () => {
    expect(summaryKeepsManifest({ renderMode: 'diagram', bucket: 'illustration' })).toBe(true);
    expect(summaryKeepsManifest({ renderMode: 'svg', bucket: 'voice' })).toBe(true);
    expect(summaryKeepsManifest({ renderMode: 'world', bucket: 'world' })).toBe(false);
    expect(summaryKeepsManifest({ renderMode: 'svg', bucket: 'diagram' })).toBe(false);
  });
});

describe('facts', () => {
  it('follows JS truthiness and tolerates a missing manifest', () => {
    expect(factsFromManifest(null)).toEqual({ seed: null, giBake: false, giAdapter: null, game: false, audio: false });
    expect(factsFromManifest({ seed: 0, giBake: true, game: '', audio: [] }))
      .toEqual({ seed: 0, giBake: true, giAdapter: null, game: false, audio: true });
  });
});

describe('dual-shape readers', () => {
  const summary = { ref: 'sk_s', kind: 'workbench', renderMode: 'world', facts: { seed: 3, giBake: false, giAdapter: null, game: false, audio: false } };
  const sketch = full('sk_f', { kind: 'css3d-turntable', seed: 9, audio: { bed: 'x' } });

  it('prefer the summary\'s server-derived fields', () => {
    expect(renderModeOf(summary)).toBe('world');
    expect(kindOf(summary)).toBe('workbench');
    expect(factsOf(summary)).toBe(summary.facts);
  });

  it('fall back to the manifest on a full sketch', () => {
    expect(renderModeOf(sketch)).toBe('scene');
    expect(kindOf(sketch)).toBe('css3d-turntable');
    expect(factsOf(sketch)).toMatchObject({ seed: 9, audio: true });
  });

  it('answer null-ish for nothing', () => {
    expect(renderModeOf(null)).toBeNull();
    expect(kindOf({ ref: 'x' })).toBeNull();
    expect(renderModeOf({ ref: 'x' })).toBeNull();
  });
});
