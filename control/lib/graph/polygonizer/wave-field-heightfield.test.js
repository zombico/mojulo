/**
 * Tests for wave-field's heightField parameter (iteration 1 of the
 * iterative landscape closeout).
 *
 * Covers:
 *   - validator catches non-string heightField
 *   - validator catches heightField + waves both authored
 *   - validateWaveFieldsFieldRefs catches references to undeclared fields
 *   - sampleWaveField uses heightFn when provided; falls back to inline
 *     waves otherwise
 *   - renderer-level: a wave-field with heightField='flat' (constant 0)
 *     renders identically to a wave-field with empty waves
 */

import { describe, it, expect } from 'vitest';

import {
  validateWaveFields,
  validateWaveFieldsFieldRefs,
  sampleWaveField,
} from './wave-field.js';
import { renderManjiTreeToSvg } from './manji-svg.js';

const CORNERS = [
  { x: -5, y: -5, z: 0 },
  { x:  5, y: -5, z: 0 },
  { x:  5, y:  5, z: 0 },
  { x: -5, y:  5, z: 0 },
];

describe('validateWaveFields — heightField', () => {
  it('accepts a valid heightField string', () => {
    expect(validateWaveFields([
      { corners: CORNERS, heightField: 'elevation' },
    ], [])).toEqual([]);
  });

  it('rejects a non-string heightField', () => {
    const errors = validateWaveFields([
      { corners: CORNERS, heightField: 42 },
    ], []);
    expect(errors[0]).toMatch(/heightField: must be a non-empty string/);
  });

  it('rejects an empty-string heightField', () => {
    const errors = validateWaveFields([
      { corners: CORNERS, heightField: '' },
    ], []);
    expect(errors[0]).toMatch(/heightField: must be a non-empty string/);
  });

  it('rejects heightField + non-empty waves together', () => {
    const errors = validateWaveFields([
      {
        corners: CORNERS,
        heightField: 'elevation',
        waves: [{ amplitude: 1, cycles: { u: 1, v: 1 } }],
      },
    ], []);
    expect(errors[0]).toMatch(/mutually exclusive — author a sum field/);
  });

  it('accepts heightField with an empty waves array (waves is no-op)', () => {
    expect(validateWaveFields([
      { corners: CORNERS, heightField: 'elevation', waves: [] },
    ], [])).toEqual([]);
  });
});

describe('validateWaveFieldsFieldRefs — heightField cross-check', () => {
  it('accepts a heightField that points at a declared field', () => {
    expect(validateWaveFieldsFieldRefs(
      [{ corners: CORNERS, heightField: 'elevation' }],
      { elevation: { kind: 'constant', value: 0 } },
    )).toEqual([]);
  });

  it('rejects a heightField pointing at an undeclared field', () => {
    const errors = validateWaveFieldsFieldRefs(
      [{ corners: CORNERS, heightField: 'missing' }],
      { other: { kind: 'constant', value: 0 } },
    );
    expect(errors[0]).toMatch(/heightField: unknown field 'missing' \(available: other\)/);
  });

  it('passes when heightField is absent', () => {
    expect(validateWaveFieldsFieldRefs(
      [{ corners: CORNERS }],
      { other: { kind: 'constant', value: 0 } },
    )).toEqual([]);
  });
});

describe('sampleWaveField — heightFn callback', () => {
  it('uses the inline waveHeight when no heightFn is provided', () => {
    const { gridPoints } = sampleWaveField(
      { corners: CORNERS, waves: [{ amplitude: 2, cycles: { u: 1, v: 0 } }], samples: { u: 4, v: 4 } },
      { gravity: { x: 0, y: 0, z: 1 } },
      CORNERS,
    );
    // At u=0.25, sin(2π·0.25) = 1 → height = 2. Sample at iu=1, iv=any.
    // gravity (0,0,1) is the displacement direction; we expect z=2 at iu=1.
    expect(gridPoints[1][0].z).toBeCloseTo(2, 6);
  });

  it('uses heightFn when provided; replaces waves', () => {
    const constantHeight = () => 3.5;
    const { gridPoints } = sampleWaveField(
      { corners: CORNERS, waves: [], samples: { u: 4, v: 4 } },
      { gravity: { x: 0, y: 0, z: 1 } },
      CORNERS,
      constantHeight,
    );
    // Every sample should have z = 3.5 (the heightFn return).
    for (let iu = 0; iu <= 4; iu += 1) {
      for (let iv = 0; iv <= 4; iv += 1) {
        expect(gridPoints[iu][iv].z).toBeCloseTo(3.5, 6);
      }
    }
  });

  it('the heightFn receives the bilinear-interpolated base point', () => {
    // heightFn that returns its query's x — so the surface tilts along x.
    const heightFn = (p) => p.x;
    const { gridPoints } = sampleWaveField(
      { corners: CORNERS, samples: { u: 4, v: 4 } },
      { gravity: { x: 0, y: 0, z: 1 } },
      CORNERS,
      heightFn,
    );
    // At iu=0 → u=0 → base.x = -5 → z = -5.
    // At iu=4 → u=1 → base.x = +5 → z = +5.
    expect(gridPoints[0][0].z).toBeCloseTo(-5, 6);
    expect(gridPoints[4][0].z).toBeCloseTo(5, 6);
  });
});

describe('renderManjiTreeToSvg — heightField round-trip', () => {
  it('a heightField=flat (constant 0) renders identically to waves=[]', () => {
    const baseManifest = (extra) => ({
      kind: 'manji-tree',
      dimensions: '3d',
      physics: { gravity: { x: 0, y: 0, z: 1 } },
      showSlotMarkers: false,
      tree: {
        id: 'world',
        spine: { bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.2 } },
        anchor: { x: 0, y: 0, z: 0 },
        slots: [{ id: 'o', position: { x: 0, y: 0, z: 0 } }],
      },
      waveFields: [
        { corners: CORNERS, samples: { u: 8, v: 8 }, ...extra },
      ],
    });
    const noWaves = renderManjiTreeToSvg(baseManifest({}));
    const flatField = renderManjiTreeToSvg(baseManifest({
      heightField: 'flat',
      // The manifest also needs the field declaration for the resolver
      // to find it. Inject via outer manifest field.
    }));
    // Without a `fields` block, the renderer's field resolver short-
    // circuits to null, so the heightField param is ignored (callback
    // is null → falls back to inline waves). Both render identically.
    expect(flatField).toBe(noWaves);
  });

  it('a heightField=flat with a declared constant-0 field renders identically to waves=[]', () => {
    const baseTree = {
      id: 'world',
      spine: { bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.2 } },
      anchor: { x: 0, y: 0, z: 0 },
      slots: [{ id: 'o', position: { x: 0, y: 0, z: 0 } }],
    };
    const noFieldManifest = {
      kind: 'manji-tree',
      dimensions: '3d',
      physics: { gravity: { x: 0, y: 0, z: 1 } },
      showSlotMarkers: false,
      tree: baseTree,
      waveFields: [{ corners: CORNERS, samples: { u: 8, v: 8 }, waves: [] }],
    };
    const fieldManifest = {
      ...noFieldManifest,
      fields: { flat: { kind: 'constant', value: 0 } },
      waveFields: [{ corners: CORNERS, samples: { u: 8, v: 8 }, heightField: 'flat' }],
    };
    const a = renderManjiTreeToSvg(noFieldManifest);
    const b = renderManjiTreeToSvg(fieldManifest);
    expect(a).toBe(b);
  });

  it('a heightField=mountains renders the field-driven surface', () => {
    const manifest = {
      kind: 'manji-tree',
      dimensions: '3d',
      physics: { gravity: { x: 0, y: 0, z: 1 } },
      showSlotMarkers: false,
      tree: {
        id: 'world',
        spine: { bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.2 } },
        anchor: { x: 0, y: 0, z: 0 },
        slots: [{ id: 'o', position: { x: 0, y: 0, z: 0 } }],
      },
      fields: {
        mountains: {
          kind: 'wave-surface',
          corners: CORNERS,
          waves: [{ amplitude: 1.5, cycles: { u: 1, v: 1 } }],
        },
      },
      waveFields: [
        { corners: CORNERS, heightField: 'mountains', samples: { u: 8, v: 8 } },
      ],
    };
    const svg = renderManjiTreeToSvg(manifest);
    // Just confirm we got a non-trivial render (lines emitted).
    expect(svg).toMatch(/<line /);
  });
});
