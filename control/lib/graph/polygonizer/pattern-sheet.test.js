// pattern sheet — the 2D face of a pattern garment, at true scale.
import { describe, expect, it } from 'vitest';

import { offsetOutline, patternSheetLayout, patternSheetSvg, figurePatternSheetSvg, SHEET_DEFAULTS } from './pattern-sheet.js';
import { buildPatternGarment } from './pattern-garment.js';
import { readFileSync } from 'node:fs';
const wardrobeFixture = (dir) => JSON.parse(readFileSync(new URL(`../views/recipe-book/__fixtures__/book/chapters/wardrobe/${dir}/garment.json`, import.meta.url), 'utf8'));
const PATTERN_GARMENTS = { shiftDress: wardrobeFixture('shift-dress'), aLineSkirt: wardrobeFixture('a-line-skirt'), straightTrousers: wardrobeFixture('straight-trousers') };
import { buildProtoform } from './figure-proto.js';
import { articulate } from './figure-vajra.js';

const body = (proto = {}) => buildProtoform(articulate({}), proto);

describe('offsetOutline', () => {
  it('grows a square by the allowance on every side and keeps the vertex count', () => {
    const sq = [[0, 0], [10, 0], [10, 10], [0, 10]];
    const o = offsetOutline(sq, 1);
    expect(o).toEqual([[-1, -1], [11, -1], [11, 11], [-1, 11]]);
  });
  it('caps a needle corner instead of shooting off', () => {
    const needle = [[0, 0], [10, 0], [5, 40], [4.9, 40]];
    const o = offsetOutline(needle, 1);
    for (const [x, y] of o) { expect(Math.abs(x)).toBeLessThan(20); expect(Math.abs(y)).toBeLessThan(50); }
  });
});

describe('patternSheetLayout + patternSheetSvg', () => {
  const b = body({ sex: 'female' });
  const { report } = buildPatternGarment(b, PATTERN_GARMENTS.shiftDress);

  it('lays a mirrored piece out once, marked cut 2, and packs on shelves inside the page', () => {
    const layout = patternSheetLayout(report);
    expect(layout.width_cm).toBe(SHEET_DEFAULTS.page_width_cm);
    expect(layout.pieces.map((p) => p.id)).toEqual(['front', 'back', 'sleeveL']);
    expect(layout.pieces.find((p) => p.id === 'sleeveL').cut).toBe(2);
    expect(layout.pieces.find((p) => p.id === 'front').cut).toBe(1);
    for (const p of layout.pieces) {
      expect(p.x).toBeGreaterThanOrEqual(SHEET_DEFAULTS.margin_cm);
      expect(p.x + p.w).toBeLessThanOrEqual(layout.width_cm - SHEET_DEFAULTS.margin_cm + 1e-6);
      expect(p.y + p.h).toBeLessThanOrEqual(layout.height_cm);
      expect(p.allowance.length).toBe(p.outline.length);
      expect(p.seamEdges.length).toBeGreaterThan(0);
    }
    // no two pieces overlap
    const [a, c] = layout.pieces;
    expect(a.x + a.w <= c.x || c.x + c.w <= a.x || a.y + a.h <= c.y || c.y + c.h <= a.y).toBe(true);
  });

  it('is deterministic and renders every piece with an outline, allowance, grain, notches and a label at 1 cm = 10 units', () => {
    const l1 = patternSheetLayout(report), l2 = patternSheetLayout(report);
    expect(JSON.stringify(l1)).toBe(JSON.stringify(l2));
    const svg = patternSheetSvg(l1, { title: 'shift', stature_cm: 170 });
    expect(svg).toBe(patternSheetSvg(l2, { title: 'shift', stature_cm: 170 }));
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="84cm"')).toBe(true);
    const vb = svg.match(/viewBox="0 0 840 ([\d.]+)"/);
    expect(vb).toBeTruthy(); expect(Number(vb[1])).toBeCloseTo(l1.height_cm * 10, 6);
    expect((svg.match(/data-piece=/g) || []).length).toBe(3);
    expect((svg.match(/stroke-dasharray/g) || []).length).toBe(3);        // one allowance per piece
    expect((svg.match(/<circle/g) || []).length).toBeGreaterThan(6);       // notches at seam ends
    expect(svg).toContain('cut 2 (one mirrored)');
    expect(svg).toContain('drafted for 170 cm');
    expect(svg).toContain('10 cm');
  });

  it('figurePatternSheetSvg draws a sheet for a figure wearing a pattern garment and nothing for one that does not', () => {
    const svg = figurePatternSheetSvg({ kind: 'figure', title: 'Mira', proto: { sex: 'female' }, garment: ['trousers', PATTERN_GARMENTS.shiftDress] });
    expect(svg).toContain('Mira — shiftDress');
    expect((svg.match(/data-piece=/g) || []).length).toBe(3);
    expect(figurePatternSheetSvg({ kind: 'figure', garment: 'tee' })).toBeNull();
    expect(figurePatternSheetSvg({ kind: 'figure' })).toBeNull();
    // two pattern garments → ONE document, two pages nested at cm offsets
    const two = figurePatternSheetSvg({ kind: 'figure', garment: [PATTERN_GARMENTS.aLineSkirt, PATTERN_GARMENTS.shiftDress] });
    expect((two.match(/<svg xmlns=/g) || []).length).toBe(1);
    expect((two.match(/<svg x="0" y="/g) || []).length).toBe(2);
    expect(two.trim().endsWith('</svg>')).toBe(true);
  });

  it('is drafted on the STAND: a walking keyframe and the rest pose print the same sheet (the designer\'s rule)', () => {
    const rest = { kind: 'figure', proto: { sex: 'female' }, garment: [PATTERN_GARMENTS.shiftDress] };
    const walking = { ...rest, pose: { shL: { pitch: 35 }, shR: { pitch: -35 }, hipL: { pitch: 25 }, kneeR: 40, spine: { sagittal: 0.2 } } };
    expect(figurePatternSheetSvg(walking)).toBe(figurePatternSheetSvg(rest));
  });
});
