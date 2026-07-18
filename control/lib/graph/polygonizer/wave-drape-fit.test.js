// wave-drape creatability gate — a dreamed drape is creatable iff a bounded
// superposition of plane waves reproduces its fold field. Proof and author are
// the same step: the fitted waves feed straight into a fit:'wave-drape' piece.
import { describe, expect, it } from 'vitest';

import { fitWaveDrape, sampleDrapeHeightField } from './wave-drape-fit.js';
import { buildWaveDrape, GARMENTS } from './figure-garments.js';
import { drapeSheet } from './wave-field.js';
import { renderManjiTreeToSvg } from './manji-svg.js';
import { buildProtoform } from './figure-proto.js';
import { articulate } from './figure-vajra.js';

function bodyStacks(proto = {}) {
  return buildProtoform(articulate({}), proto);
}

describe('fitWaveDrape — the creatability gate', () => {
  it('recovers a drape built from dictionary-frequency waves (proof = author)', () => {
    const known = [
      { amplitude: 1.15, cycles: { u: 3, v: 0.35 }, phase: 0.4 },
      { amplitude: 0.5, cycles: { u: 6, v: 0.6 }, phase: 1.1 },
    ];
    const field = sampleDrapeHeightField(known, { u: 22, v: 30 }, 2.0);
    const fit = fitWaveDrape(field);
    expect(fit.creatable).toBe(true);
    expect(fit.relativeResidual).toBeLessThan(0.05);
    expect(fit.waves.length).toBeGreaterThan(0);
    // the baseline (DC) is recovered separately from the folds
    expect(fit.baseline).toBeCloseTo(2.0, 1);
  });

  it('rejects a noise field as a vocabulary gap (not sculptable geometry)', () => {
    const noise = Array.from({ length: 23 }, (_, i) =>
      Array.from({ length: 31 }, (_, j) => (Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1));
    const fit = fitWaveDrape(noise);
    expect(fit.creatable).toBe(false);
    expect(fit.relativeResidual).toBeGreaterThan(0.5);
    expect(fit.reason).toMatch(/vocabulary gap/);
  });

  it('rejects a fold field outside the frequency dictionary', () => {
    const oob = sampleDrapeHeightField([{ amplitude: 1, cycles: { u: 17.3, v: 9.1 }, phase: 0.2 }], { u: 22, v: 30 });
    const fit = fitWaveDrape(oob);
    expect(fit.creatable).toBe(false);
  });

  it('honours the bounded-superposition cap (a giant-amplitude fit is refused)', () => {
    const huge = sampleDrapeHeightField([{ amplitude: 9, cycles: { u: 3, v: 0.35 }, phase: 0 }], { u: 22, v: 30 });
    const fit = fitWaveDrape(huge, { maxAmplitude: 4 });
    expect(fit.creatable).toBe(false);
    expect(fit.reason).toMatch(/unbounded/);
    expect(fit.maxAmplitude).toBeGreaterThan(4);
  });

  it('the fitted waves round-trip: re-sampling them reproduces the field', () => {
    const known = [{ amplitude: 1.0, cycles: { u: 4, v: 0.6 }, phase: 0.7 }];
    const field = sampleDrapeHeightField(known, { u: 20, v: 24 });
    const fit = fitWaveDrape(field, { epsilon: 0.05 });
    const back = sampleDrapeHeightField(fit.waves, { u: 20, v: 24 });
    // compare a few interior samples
    for (const [iu, iv] of [[5, 6], [10, 12], [15, 18]]) {
      expect(back[iu][iv]).toBeCloseTo(field[iu][iv], 1);
    }
  });
});

describe('buildWaveDrape — the drape piece', () => {
  it('produces an open sheet of rings over any body from the shoulders anchor', () => {
    const dp = buildWaveDrape(bodyStacks(), { fit: 'wave-drape', anchor: 'shoulders' }, '#6d2f3a');
    expect(dp).not.toBeNull();
    expect(dp.rings.length).toBeGreaterThan(2);
    expect(dp.rings[0].polyline.length).toBeGreaterThan(2);
    expect(dp.hex).toBe('#6d2f3a');
  });

  it('resolves waist and neck anchors from body parts', () => {
    const waist = buildWaveDrape(bodyStacks(), { fit: 'wave-drape', anchor: 'waist' }, '#2f4a6d');
    const neck = buildWaveDrape(bodyStacks(), { fit: 'wave-drape', anchor: 'neck', spread: 4 }, '#3a4a3a');
    expect(waist).not.toBeNull();
    expect(neck).not.toBeNull();
  });

  it('re-fits the SAME spec to a different body (body-relative pinning)', () => {
    const spec = { fit: 'wave-drape', anchor: 'shoulders' };
    const lean = buildWaveDrape(bodyStacks({ sex: 'male', stockiness: 0.8 }), spec, '#000');
    const heavy = buildWaveDrape(bodyStacks({ sex: 'female', stockiness: 1.4 }), spec, '#000');
    // the pinned top edge tracks the body's shoulders → different widths
    const width = (dp) => {
      const top = dp.rings.map((r) => r.polyline[0]);
      const xs = top.map((p) => p.x);
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(width(lean)).not.toBeCloseTo(width(heavy), 2);
  });

  it('the cloak/tabard/mantle/cowl presets are all wave-drape garments', () => {
    for (const key of ['cloak', 'tabard', 'mantle', 'cowl']) {
      expect(GARMENTS[key].pieces[0].fit).toBe('wave-drape');
    }
  });
});

describe('drapeSheet — the form-agnostic kernel', () => {
  it('drapes from explicit anchor points with NO body at all', () => {
    const d = drapeSheet({ cL: { x: -1, y: 0, z: 2 }, cR: { x: 1, y: 0, z: 2 }, drop: 3, hemZ: -1.5 });
    expect(d.rings.length).toBeGreaterThan(2);
    expect(d.isoUPolylines.length).toBe(d.rings.length);
    expect(d.isoVPolylines.length).toBeGreaterThan(2);
    expect(d.corners).toHaveLength(4);
  });

  it('the top edge stays PINNED at the anchor (pin→free keeps it still there)', () => {
    const cL = { x: -1, y: 0, z: 2 }, cR = { x: 1, y: 0, z: 2 };
    const d = drapeSheet({ cL, cR, back: 0, pinToFree: true });
    // v=0 (the pinned edge) should sit on the anchor line, unperturbed by folds
    const topLine = d.isoVPolylines[0];
    expect(topLine[0].z).toBeCloseTo(2, 5);
    expect(topLine.at(-1).z).toBeCloseTo(2, 5);
  });
});

describe('manji drapes[] — a covering over ANY polygonized form', () => {
  const baseTree = {
    id: 'world',
    spine: { bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.2 } },
    anchor: { x: 0, y: 0, z: 0 },
    slots: [{ id: 'o', position: { x: 0, y: 0, z: 0 } }],
  };
  const render = (drapes) => renderManjiTreeToSvg({
    kind: 'manji-tree', dimensions: '3d', physics: { gravity: { x: 0, y: 0, z: -1 } },
    showSlotMarkers: false, tree: baseTree, drapes,
  });

  it('renders a drape sheet pinned to inline anchor points (no human body)', () => {
    const svg = render([{
      anchor: [{ x: -1.2, y: 0.2, z: 2.1 }, { x: 1.2, y: 0.2, z: 2.1 }],
      hemZ: -1.8, style: { stroke: '#8e2f3a' },
    }]);
    expect(svg).toMatch(/8e2f3a/);          // the drape's strokes are painted
  });

  it('a drape with a malformed anchor is dropped, not fatal to the scene', () => {
    const svg = render([{ anchor: [{ x: 0, y: 0, z: 1 }], style: { stroke: '#8e2f3a' } }]);  // only one point
    expect(typeof svg).toBe('string');
    expect(svg).not.toMatch(/8e2f3a/);
  });
});
