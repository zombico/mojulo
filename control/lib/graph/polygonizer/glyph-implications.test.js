import { describe, expect, it } from 'vitest';
import { applyShotGlyphImplications } from './glyph-implications.js';
import { resolveShotGlyph } from './mandala-patterns.js';
import { runAuthorshipPreview } from '@/lib/graph/rendrant/authorship-preview.js';

describe('applyShotGlyphImplications', () => {
  it('returns the manifest unchanged when no shot glyph is referenced', () => {
    const manifest = {
      viewBox: { width: 800, height: 600 },
      polygonizer: { subject: 'thing', impactPoint: [0, 0], realityFacts: [], minimalAbstractions: [] },
    };
    expect(applyShotGlyphImplications(manifest)).toBe(manifest);
  });

  it('returns the manifest unchanged when the glyph reference is unknown', () => {
    const manifest = {
      polygonizer: { shotGlyph: { id: 'nope-not-a-real-glyph' } },
    };
    const result = applyShotGlyphImplications(manifest);
    // Unknown ref is left as-is. The manifest object is rebuilt (we set the
    // primary on layer/polygonizer) but the unknown glyph passes through.
    expect(result.polygonizer.shotGlyph).toEqual({ id: 'nope-not-a-real-glyph' });
  });

  it('lifts topology, hallMandala, roomConcept, and cameraWindow from a canonical glyph id', () => {
    const canonical = resolveShotGlyph('school-of-athens-central-hall');
    const manifest = {
      polygonizer: { shotGlyph: { id: 'school-of-athens-central-hall' } },
    };

    const result = applyShotGlyphImplications(manifest);

    expect(result.polygonizer.shotGlyph.topology).toEqual(canonical.topology);
    expect(result.polygonizer.shotGlyph.hallMandala.axisMundi).toEqual(canonical.hallMandala.axisMundi);
    expect(result.polygonizer.mandalaPatternLayer.hallMandala.axisMundi).toEqual(canonical.hallMandala.axisMundi);
    expect(result.polygonizer.mandalaPatternLayer.cameraWindow).toEqual(canonical.cameraWindow);
  });

  it('preserves operator-supplied fields over the library defaults', () => {
    const manifest = {
      polygonizer: {
        shotGlyph: {
          id: 'person-eye-room-window-light',
          topology: { cameraVector: 'custom-camera-override' },
          roomConcept: { kind: 'custom-room' },
        },
      },
    };

    const result = applyShotGlyphImplications(manifest);

    // Operator override wins where supplied; library fills the gaps.
    expect(result.polygonizer.shotGlyph.topology.cameraVector).toBe('custom-camera-override');
    expect(result.polygonizer.shotGlyph.topology.lightEntry).toBeTruthy();
    expect(result.polygonizer.shotGlyph.topology.support).toBeTruthy();
    expect(result.polygonizer.roomConcept.kind).toBe('custom-room');
    // Library-only roomConcept fields (placementSpace etc.) still come through.
    expect(result.polygonizer.roomConcept.placementSpace).toBeTruthy();
  });

  it('resolves a string shorthand reference inside mandalaPatternLayer', () => {
    const manifest = {
      polygonizer: {
        mandalaPatternLayer: { shotGlyph: 'tabletop-three-quarter-key' },
      },
    };

    const result = applyShotGlyphImplications(manifest);

    expect(result.polygonizer.mandalaPatternLayer.shotGlyph.id).toBe('tabletop-three-quarter-key');
    expect(result.polygonizer.mandalaPatternLayer.shotGlyph.topology.cameraVector).toBeTruthy();
    expect(result.polygonizer.shotGlyph.id).toBe('tabletop-three-quarter-key');
  });

  it('resolves a derived glyph via glyph.extends', () => {
    const manifest = {
      polygonizer: {
        shotGlyph: { id: 'my-tabletop', extends: 'tabletop-three-quarter-key' },
      },
    };

    const result = applyShotGlyphImplications(manifest);

    // Derived id is preserved when both id + extends are present.
    expect(result.polygonizer.shotGlyph.id).toBe('my-tabletop');
    expect(result.polygonizer.shotGlyph.topology.cameraVector).toBeTruthy();
    expect(result.polygonizer.shotGlyph.cameraWindow).toBeTruthy();
  });

  it('handles multiple shot glyphs and treats the first as primary', () => {
    const manifest = {
      polygonizer: {
        shotGlyphs: ['school-of-athens-central-hall', 'overhead-plan-soft-light'],
      },
    };

    const result = applyShotGlyphImplications(manifest);

    expect(result.polygonizer.shotGlyphs).toHaveLength(2);
    expect(result.polygonizer.shotGlyphs[0].id).toBe('school-of-athens-central-hall');
    expect(result.polygonizer.shotGlyphs[1].id).toBe('overhead-plan-soft-light');
    // Primary (first) drives the layer fields.
    expect(result.polygonizer.shotGlyph.id).toBe('school-of-athens-central-hall');
    expect(result.polygonizer.mandalaPatternLayer.hallMandala.axisMundi.role).toBe('central-asterisk');
  });

  it('dedupes the same canonical glyph referenced through multiple mounts', () => {
    const manifest = {
      polygonizer: {
        shotGlyph: { id: 'school-of-athens-central-hall' },
        mandalaPatternLayer: { shotGlyph: 'school-of-athens-central-hall' },
      },
    };

    const result = applyShotGlyphImplications(manifest);

    expect(result.polygonizer.shotGlyphs).toHaveLength(1);
    expect(result.polygonizer.mandalaPatternLayer.shotGlyphs).toHaveLength(1);
  });

  it('is idempotent: a second pass equals the first', () => {
    const manifest = {
      polygonizer: {
        shotGlyph: { id: 'driver-eye-road-cockpit' },
      },
    };

    const once = applyShotGlyphImplications(manifest);
    const twice = applyShotGlyphImplications(once);

    expect(twice).toEqual(once);
  });

  it('does not mutate the input manifest', () => {
    const manifest = {
      polygonizer: { shotGlyph: { id: 'person-eye-room-window-light' } },
    };
    const snapshot = JSON.parse(JSON.stringify(manifest));

    applyShotGlyphImplications(manifest);

    expect(manifest).toEqual(snapshot);
  });

  it('makes authorship-preview shot-glyph and hall-mandala checks pass for a canonical reference', () => {
    // A minimal planning manifest the LLM might emit once it knows the
    // substrate fills implications: just declare the shot contract and let
    // the substrate fill the consequences.
    const manifest = {
      title: 'Civic interior probe',
      viewBox: { width: 980, height: 610 },
      polygonizer: {
        subject: 'civic interior',
        impactPoint: [490, 305],
        realityFacts: [],
        minimalAbstractions: [],
        spatialPlanning: { mode: 'plan-before-skin', materializationGate: 'planning-valid' },
        shotGlyph: { id: 'school-of-athens-central-hall' },
        mandalaPatternLayer: { hallMandala: { kind: 'school-of-athens-central-hall' } },
      },
      scene: {},
    };

    const beforePreview = runAuthorshipPreview(manifest);
    expect(beforePreview.verdict).toBe('blocked');

    const enriched = applyShotGlyphImplications(manifest);
    const afterPreview = runAuthorshipPreview(enriched);

    expect(afterPreview.verdict).toBe('passed');
    const blockedRoles = afterPreview.checks
      .filter((c) => c.ok === false && c.gating === true)
      .map((c) => c.role);
    expect(blockedRoles).toEqual([]);
  });
});
