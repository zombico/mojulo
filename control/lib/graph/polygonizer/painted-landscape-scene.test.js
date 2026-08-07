import { describe, it, expect } from 'vitest';
import {
  SCENES,
  sceneIds,
  resolveScene,
  computeSceneCompletion,
  validatePaintedLandscape,
  renderPaintedLandscapeToSvg,
} from './painted-landscape.js';
import { SCATTER_KIND_IDS, SCENE_BAND_IDS } from '../painted-landscape-cards/loader.js';

describe('scene cards — loading', () => {
  it('loads at least the pine-forest scene card', () => {
    expect(sceneIds()).toContain('pine-forest');
    const pine = SCENES['pine-forest'];
    expect(pine.intent).toBeTruthy();
    expect(Object.keys(pine.fill)).toEqual(SCENE_BAND_IDS);
  });

  it('only references known scatter kinds in every band', () => {
    for (const id of sceneIds()) {
      for (const band of SCENE_BAND_IDS) {
        for (const entry of SCENES[id].fill[band]) {
          expect(SCATTER_KIND_IDS).toContain(entry.kind);
          expect(Number.isInteger(entry.count)).toBe(true);
        }
      }
    }
  });
});

describe('resolveScene — layout', () => {
  it('places exactly the declared count of items, within the world quad', () => {
    const items = resolveScene('pine-forest', 'seed-a');
    const total = computeSceneCompletion('pine-forest').total;
    expect(items.length).toBe(total);
    for (const it of items) {
      expect(it.x).toBeGreaterThanOrEqual(-12);
      expect(it.x).toBeLessThanOrEqual(12);
      expect(it.y).toBeGreaterThanOrEqual(-24);
      expect(it.y).toBeLessThanOrEqual(6);
      expect(it.height).toBeGreaterThan(0);
      expect(it.width).toBeGreaterThan(0);
    }
  });

  it('is deterministic for the same (scene, seed) and varies by seed', () => {
    expect(resolveScene('pine-forest', 'x')).toEqual(resolveScene('pine-forest', 'x'));
    expect(resolveScene('pine-forest', 'x')).not.toEqual(resolveScene('pine-forest', 'y'));
  });

  it('returns [] for a null scene', () => {
    expect(resolveScene(null, 'x')).toEqual([]);
    expect(resolveScene(undefined, 'x')).toEqual([]);
  });
});

describe('computeSceneCompletion', () => {
  it('reports per-band target == placed and complete', () => {
    const report = computeSceneCompletion('pine-forest');
    expect(report.scene).toBe('pine-forest');
    expect(report.complete).toBe(true);
    for (const band of SCENE_BAND_IDS) {
      expect(report.bands[band].placed).toBe(report.bands[band].target);
    }
    expect(report.total).toBe(
      SCENE_BAND_IDS.reduce((s, b) => s + report.bands[b].target, 0),
    );
  });
});

describe('validatePaintedLandscape — scene field', () => {
  it('accepts a known scene', () => {
    const errors = validatePaintedLandscape({
      kind: 'painted-landscape', heartbeat: 'rocky-irregular', splatch: 'verdure-trio', scene: 'pine-forest',
    });
    expect(errors).toEqual([]);
  });

  it('rejects an unknown scene', () => {
    const errors = validatePaintedLandscape({
      kind: 'painted-landscape', heartbeat: 'rocky-irregular', splatch: 'verdure-trio', scene: 'no-such-scene',
    });
    expect(errors.some((e) => e.includes('unknown scene'))).toBe(true);
  });
});

describe('renderPaintedLandscapeToSvg — scene fill', () => {
  it('emits more polygons with a scene than without (the fill is drawn)', () => {
    const base = { kind: 'painted-landscape', heartbeat: 'gentle-roughness', splatch: 'meadow-trio', seed: 's' };
    const without = renderPaintedLandscapeToSvg(base);
    const withScene = renderPaintedLandscapeToSvg({ ...base, scene: 'pine-forest' });
    const count = (svg) => (svg.match(/<polygon/g) || []).length;
    expect(count(withScene)).toBeGreaterThan(count(without));
  });
});
