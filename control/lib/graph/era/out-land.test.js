import { describe, it, expect } from 'vitest';
import { LAND_FORMS, LAND_FORM_IDS, LAND_LEVELS, designLand, landDials, landLaws, manyStep } from './out-land.js';
import { drawLand, outLandHtml, LAND_KITS } from './out-land-html.js';

describe('the land index: the natural world as designed forms', () => {
  it('every form, variant, level and step from little to many keeps its ring\'s face budget', () => {
    const over = [];
    for (const f of LAND_FORM_IDS) for (const v of Object.keys(LAND_FORMS[f].variants)) for (const level of Object.keys(LAND_LEVELS)) for (const many of [0, 0.5, 1]) {
      const d = designLand(f, v, 8, { level, many });
      expect(d.faces.length).toBeGreaterThan(0);
      if (landLaws(d).some((l) => l.law === 'budget')) over.push(`${f} ${v} ${level} ${many}: ${d.faces.length}`);
    }
    expect(over).toEqual([]);
  });

  it('little to many pins its dial, the same at any seed; five named steps', () => {
    for (const f of LAND_FORM_IDS) {
      const F = LAND_FORMS[f], v = Object.keys(F.variants)[0];
      expect(F.many.words).toHaveLength(5);
      const a = landDials(f, v, 3, { many: 1 }).X[F.many.dial], b = landDials(f, v, 91, { many: 1 }).X[F.many.dial];
      expect(a).toBe(b);
      expect(landDials(f, v, 3, { many: 0 }).X[F.many.dial]).toBeLessThan(a);
    }
    expect([0, 0.2, 0.5, 0.8, 1].map(manyStep)).toEqual([0, 1, 2, 3, 4]);
    // more rocks, more beds, more clouds as the step rises
    const n = (f, v, m) => designLand(f, v, 8, { level: 'mid', many: m }).elements.length;
    expect(n('rock', 'boulders', 1)).toBeGreaterThan(n('rock', 'boulders', 0));
    expect(n('landmark', 'monolith', 1)).toBeGreaterThan(n('landmark', 'monolith', 0));
  });

  it('pure: the same form builds the same faces; says what is wrong', () => {
    expect(designLand('strata', 'folded', 8, { level: 'near' })).toEqual(designLand('strata', 'folded', 8, { level: 'near' }));
    expect(() => designLand('volcano', 'big', 1)).toThrow(/not a land form/);
    expect(() => designLand('cloud', 'mammatus', 1)).toThrow(/not a cloud/);
  });

  it('draws in every kit with land ramps, and the sheet is byte-identical per call', () => {
    expect(LAND_KITS).toContain('alien-night');
    for (const k of LAND_KITS) expect(drawLand(designLand('landmark', 'arch', 8), k)).toMatch(/^<svg[\s\S]*<polygon/);
    expect(outLandHtml()).toBe(outLandHtml());
  }, 60000);
});
