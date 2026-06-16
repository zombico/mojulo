import { describe, expect, it } from 'vitest';
import { applyDeterministicRepairs } from './repair-patches.js';
import { resolveShotGlyph } from './mandala-patterns.js';

describe('applyDeterministicRepairs', () => {
  it('returns the manifest unchanged when no errors match a patch', () => {
    const manifest = { marks: [{ kind: 'solid', role: 'wall' }] };
    const result = applyDeterministicRepairs(manifest, ['something the patcher does not know about']);
    expect(result.applied).toEqual([]);
    expect(result.manifest).toBe(manifest);
  });

  it('returns the manifest unchanged when errors array is empty', () => {
    const manifest = { marks: [] };
    const result = applyDeterministicRepairs(manifest, []);
    expect(result.applied).toEqual([]);
    expect(result.manifest).toBe(manifest);
  });

  describe('partition-target-rename', () => {
    it('renames a near-miss partition target to the closest prior mark role', () => {
      const manifest = {
        marks: [
          { kind: 'solid', role: 'bookshelf' },
          { kind: 'partition', role: 'shelves', target: 'bookshelves', axis: 'y', count: 4 },
        ],
      };
      const errors = ["partition 'shelves' target 'bookshelves' must match an earlier mark role"];

      const result = applyDeterministicRepairs(manifest, errors);

      expect(result.applied).toEqual(['partition-target-rename']);
      expect(result.manifest.marks[1].target).toBe('bookshelf');
      // Input manifest must not be mutated.
      expect(manifest.marks[1].target).toBe('bookshelves');
    });

    it('does not rename when no candidate is within the closeness threshold', () => {
      const manifest = {
        marks: [
          { kind: 'solid', role: 'sky' },
          { kind: 'solid', role: 'cloud' },
          { kind: 'partition', role: 'shelves', target: 'completely-unrelated-target', axis: 'y', count: 4 },
        ],
      };
      const errors = ["partition 'shelves' target 'completely-unrelated-target' must match an earlier mark role"];

      const result = applyDeterministicRepairs(manifest, errors);

      expect(result.applied).toEqual([]);
      expect(result.manifest).toBe(manifest);
    });

    it('only considers roles from marks emitted before the partition', () => {
      const manifest = {
        marks: [
          { kind: 'solid', role: 'roof' },
          { kind: 'partition', role: 'panels', target: 'cabinetx', axis: 'y', count: 3 },
          { kind: 'solid', role: 'cabinet' },
        ],
      };
      const errors = ["partition 'panels' target 'cabinetx' must match an earlier mark role"];

      const result = applyDeterministicRepairs(manifest, errors);

      // 'cabinet' arrives AFTER the partition, so it must not be picked.
      expect(result.applied).toEqual([]);
    });

    it('does not consider another partition mark as a valid target', () => {
      const manifest = {
        marks: [
          { kind: 'partition', role: 'rows', target: 'shelves', axis: 'y', count: 3 },
          { kind: 'partition', role: 'cols', target: 'rowz', axis: 'x', count: 2 },
        ],
      };
      const errors = [
        "partition 'rows' target 'shelves' must match an earlier mark role",
        "partition 'cols' target 'rowz' must match an earlier mark role",
      ];

      const result = applyDeterministicRepairs(manifest, errors);

      // No prior non-partition role exists for either partition.
      expect(result.applied).toEqual([]);
    });
  });

  describe('viewbox-from-bounds', () => {
    it('synthesizes a viewBox from rectangular mark bounds when viewBox is missing', () => {
      const manifest = {
        marks: [
          { kind: 'solid', role: 'a', x: 0, y: 0, width: 200, height: 100 },
          { kind: 'solid', role: 'b', x: 220, y: 60, width: 80, height: 140 },
        ],
      };
      const errors = ['manifest.viewBox is required ({ width, height })'];

      const result = applyDeterministicRepairs(manifest, errors);

      expect(result.applied).toEqual(['viewbox-from-bounds']);
      // bounds: minX=0,minY=0,maxX=300,maxY=200; padding 20 each side → 340x240.
      expect(result.manifest.viewBox).toEqual({ width: 340, height: 240 });
    });

    it('handles point/line mark shapes when computing bounds', () => {
      const manifest = {
        marks: [
          { kind: 'line', x1: 10, y1: 20, x2: 90, y2: 60 },
          { kind: 'polyline', points: [[100, 100], [150, 180]] },
        ],
      };
      const errors = ['Sketch expansion error: grid expansion requires a numeric viewBox { width, height }'];

      const result = applyDeterministicRepairs(manifest, errors);

      expect(result.applied).toEqual(['viewbox-from-bounds']);
      // bounds: minX=0(clamped),minY=0(clamped),maxX=150,maxY=180; +40 → 190x220.
      expect(result.manifest.viewBox).toEqual({ width: 190, height: 220 });
    });

    it('skips synthesis when marks have no usable coordinates', () => {
      const manifest = {
        marks: [
          { kind: 'solid', role: 'unsized' },
          { kind: 'partition', role: 'p', target: 'unsized', axis: 'y', count: 3 },
        ],
      };
      const errors = ['manifest.viewBox is required ({ width, height })'];

      const result = applyDeterministicRepairs(manifest, errors);

      expect(result.applied).toEqual([]);
      expect(result.manifest).toBe(manifest);
    });

    it('skips synthesis when viewBox is already valid', () => {
      const manifest = {
        viewBox: { width: 800, height: 600 },
        marks: [{ kind: 'solid', role: 'a', x: 0, y: 0, width: 200, height: 100 }],
      };
      const errors = ['manifest.viewBox.width must be a positive number'];

      const result = applyDeterministicRepairs(manifest, errors);

      // Both width and height are already positive — patch is a no-op.
      expect(result.applied).toEqual([]);
    });

    it('replaces a viewBox with non-positive dimensions', () => {
      const manifest = {
        viewBox: { width: 0, height: -1 },
        marks: [{ kind: 'solid', role: 'a', x: 0, y: 0, width: 200, height: 100 }],
      };
      const errors = ['manifest.viewBox.width must be a positive number'];

      const result = applyDeterministicRepairs(manifest, errors);

      expect(result.applied).toEqual(['viewbox-from-bounds']);
      expect(result.manifest.viewBox.width).toBeGreaterThan(0);
      expect(result.manifest.viewBox.height).toBeGreaterThan(0);
    });
  });

  describe('shot-glyph-topology-fill', () => {
    it('fills missing topology fields from the canonical glyph card', () => {
      const canonical = resolveShotGlyph('person-eye-room-window-light');
      expect(canonical.topology).toMatchObject({
        cameraVector: expect.any(String),
        lightEntry: expect.any(String),
        support: expect.any(String),
      });

      const manifest = {
        polygonizer: {
          shotGlyph: { id: 'person-eye-room-window-light', topology: {} },
        },
      };
      const errors = [
        "shotGlyph 'person-eye-room-window-light' must declare topology.cameraVector",
        "shotGlyph 'person-eye-room-window-light' must declare topology.lightEntry",
        "shotGlyph 'person-eye-room-window-light' must declare topology.support",
      ];

      const result = applyDeterministicRepairs(manifest, errors);

      expect(result.applied).toEqual(['shot-glyph-topology-fill']);
      expect(result.manifest.polygonizer.shotGlyph.topology).toEqual(canonical.topology);
    });

    it('preserves operator-supplied topology fields and only fills gaps', () => {
      const manifest = {
        polygonizer: {
          shotGlyphs: [
            {
              id: 'tabletop-three-quarter-key',
              topology: { cameraVector: 'custom-override' },
            },
          ],
        },
      };
      const errors = ["shotGlyph 'tabletop-three-quarter-key' must declare topology.lightEntry"];

      const result = applyDeterministicRepairs(manifest, errors);

      expect(result.applied).toEqual(['shot-glyph-topology-fill']);
      const patched = result.manifest.polygonizer.shotGlyphs[0].topology;
      expect(patched.cameraVector).toBe('custom-override');
      expect(patched.lightEntry).toBeTruthy();
      expect(patched.support).toBeTruthy();
    });

    it('falls back to glyph.extends / glyph.seed when no id is set', () => {
      const manifest = {
        polygonizer: {
          shotGlyph: { extends: 'tabletop-three-quarter-key', topology: {} },
        },
      };
      const errors = ["shotGlyph 'derived-shot' must declare topology.cameraVector"];

      const result = applyDeterministicRepairs(manifest, errors);

      expect(result.applied).toEqual(['shot-glyph-topology-fill']);
      expect(result.manifest.polygonizer.shotGlyph.topology.cameraVector).toBeTruthy();
    });

    it('does nothing when the glyph reference is unknown', () => {
      const manifest = {
        polygonizer: {
          shotGlyph: { id: 'some-unknown-glyph', topology: {} },
        },
      };
      const errors = ["shotGlyph 'some-unknown-glyph' must declare topology.cameraVector"];

      const result = applyDeterministicRepairs(manifest, errors);

      expect(result.applied).toEqual([]);
    });
  });

  it('chains multiple patches in a single call', () => {
    const manifest = {
      marks: [
        { kind: 'solid', role: 'bookshelf', x: 0, y: 0, width: 200, height: 100 },
        { kind: 'partition', role: 'shelves', target: 'bookshelv', axis: 'y', count: 4 },
      ],
      polygonizer: {
        shotGlyph: { id: 'person-eye-room-window-light', topology: {} },
      },
    };
    const errors = [
      "partition 'shelves' target 'bookshelv' must match an earlier mark role",
      'manifest.viewBox is required ({ width, height })',
      "shotGlyph 'person-eye-room-window-light' must declare topology.cameraVector",
    ];

    const result = applyDeterministicRepairs(manifest, errors);

    expect(result.applied).toEqual([
      'partition-target-rename',
      'viewbox-from-bounds',
      'shot-glyph-topology-fill',
    ]);
    expect(result.manifest.marks[1].target).toBe('bookshelf');
    expect(result.manifest.viewBox.width).toBeGreaterThan(0);
    expect(result.manifest.polygonizer.shotGlyph.topology.cameraVector).toBeTruthy();
  });
});
