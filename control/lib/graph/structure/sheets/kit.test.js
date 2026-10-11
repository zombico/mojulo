// The drawing kit: each mark in the field's conventions, in sheet millimetres, the same bytes every time.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  ftIn, parseFtIn, mmOf, areaText, n2, makeView, fitScale, SCALES, PENS, sheetStyle,
  dimension, dimChain, doorTag, windowTag, objectTag, wallTag, roomTag, gridBubble, sectionMarker, elevationMarker,
  sectionLine, northArrow, scaleBar, titleBlock, drawingTitle, sheetSvg,
} from './kit.js';

describe('numbers, written by hand', () => {
  it('writes feet and inches as a set does, to the half inch', () => {
    expect(ftIn(12.5)).toBe(`12'-6"`);
    expect(ftIn(0.75)).toBe(`0'-9"`);
    expect(ftIn(12 + 6.5 / 12)).toBe(`12'-6 1/2"`);
    expect(ftIn(11 + 11.9 / 12)).toBe(`12'-0"`);        // rounds once: never 11'-12"
    expect(ftIn(3)).toBe(`3'-0"`);
  });

  it('round-trips ft-in at the stated precision', () => {
    for (let i = 0; i < 400; i++) {
      const ft = (i * 7.31) % 60;
      const back = parseFtIn(ftIn(ft));
      expect(Math.abs(back - ft)).toBeLessThanOrEqual(0.25 / 12 + 1e-9);   // half of the half-inch step
    }
    expect(parseFtIn('nonsense')).toBeNull();
  });

  it('writes millimetres whole and areas as a room tag states them', () => {
    expect(mmOf(1)).toBe('305');
    expect(mmOf(10)).toBe('3048');
    expect(areaText(245.4)).toBe('245 SF');
    expect(areaText(245.4, 'metric')).toBe('22.8 m²');
    expect(n2(1.005)).toBe('1');
    expect(n2(2.5)).toBe('2.5');
  });

  it('uses no clock, no locale formatter and no unseeded dice', () => {
    const src = readFileSync(new URL('./kit.js', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(src).not.toMatch(/\bDate\b|\bIntl\b|Math\.random|toLocale/);
    expect(src).not.toMatch(/Math\.(sin|cos|atan2|hypot|pow)\b/);
  });
});

describe('scale and view', () => {
  it('maps plan feet onto the sheet at an architectural scale', () => {
    const v = makeView({ scale: '1/4', origin: [10, 10], at: [20, 30] });
    expect(v.mmPerFt).toBeCloseTo(6.35, 6);              // 1/4" per foot
    expect(v.p([10, 10])).toEqual([20, 30]);
    expect(v.x(14)).toBeCloseTo(20 + 4 * 6.35, 6);
    expect(SCALES['1/4'].name).toBe(`1/4" = 1'-0"`);
  });

  it('fits the largest standard scale that holds the plan', () => {
    expect(fitScale([40, 30], [300, 240])).toBe('1/4');   // 254 × 190 mm at 1/4"
    expect(fitScale([90, 60], [300, 240])).toBe('1/8');
    expect(fitScale([20, 15], [300, 240])).toBe('1/2');
    expect(fitScale([40, 30], [300, 240], 'metric')).toBe('1:50');
  });
});

describe('line weights', () => {
  it('reads by hierarchy: cut over projected over hidden over dimension', () => {
    expect(PENS.cut).toBeGreaterThan(PENS.proj);
    expect(PENS.proj).toBeGreaterThan(PENS.hidden);
    expect(PENS.hidden).toBeGreaterThan(PENS.dim);
    const st = sheetStyle();
    for (const c of ['s-cut', 's-poche', 's-proj', 's-hid', 's-dim', 's-grid']) expect(st).toContain(`.${c}{`);
    expect(st).toMatch(/\.s-hid\{[^}]*dasharray/);
  });
});

describe('dimensions', () => {
  it('states the length it measures, with two witness lines and two ticks (imperial)', () => {
    const d = dimension([0, 0], [63.5, 0], 10);
    expect(d).toContain(`10'-0"`);
    expect(d).toContain('data-ft="10"');
    expect((d.match(/class="s-dim"/g) || []).length).toBe(3);     // two witness lines + the dimension line
    expect((d.match(/class="s-proj"/g) || []).length).toBe(2);    // two arch ticks
  });

  it('closes with arrows and writes mm in metric', () => {
    const d = dimension([0, 0], [63.5, 0], 10, { units: 'metric' });
    expect(d).toContain('>3048<');
    expect((d.match(/class="s-fill"/g) || []).length).toBe(2);
  });

  it('reads from the bottom or the right: a vertical run turns its text -90', () => {
    expect(dimension([0, 50], [0, 0], 8)).toContain('rotate(-90');
    expect(dimension([0, 0], [0, 50], 8)).toContain('rotate(-90');
    expect(dimension([0, 0], [50, 0], 8)).not.toContain('rotate(');
  });

  it('chains consecutive stations on one line, and their sum is the overall', () => {
    const v = makeView({ scale: '1/4' });
    const chain = dimChain([0, 3, 9, 3, 20], (s) => [v.x(s), 0]);
    const fts = [...chain.matchAll(/data-ft="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(fts).toEqual([3, 6, 11]);
    expect(fts.reduce((a, b) => a + b, 0)).toBe(20);
  });
});

describe('tags and markers', () => {
  it('draws each tag in its conventional shape', () => {
    expect(doorTag([10, 10], '101A')).toMatch(/<rect[^>]*>.*101A/);
    expect(windowTag([10, 10], 'A')).toMatch(/<polygon[^>]*points="([^ ]+ ){5}[^ ]+"/);   // six points
    expect(objectTag([10, 10], 'CH-1')).toMatch(/<circle.*CH-1/);
    expect(wallTag([10, 10], '1')).toMatch(/<polygon[^>]*points="([^ ]+ ){3}[^ ]+"/);     // four points
    const room = roomTag([50, 50], { name: 'Living', number: '101', area: 245 });
    expect(room).toContain('LIVING');
    expect(room).toContain('101  ·  245 SF');
    expect(gridBubble([5, 5], 'A')).toContain('r="3.2"');
  });

  it('every tag carries its id for the book to link', () => {
    expect(doorTag([0, 0], '101A')).toContain('data-tag="101A"');
    expect(objectTag([0, 0], 'SO-1')).toContain('data-tag="SO-1"');
  });

  it('section and elevation markers name the detail and the sheet', () => {
    const s = sectionMarker([20, 20], { detail: '2', sheet: 'A-301', dir: 'E' });
    expect(s).toContain('>2<');
    expect(s).toContain('>A-301<');
    expect(elevationMarker([20, 20])).toContain('s-tag elevation');
    expect((sectionLine([0, 0], [80, 0]).match(/s-tag section/g) || []).length).toBe(2);
  });
});

describe('north arrow, scale bar, title block', () => {
  it('the scale bar marks 0 4 8 16 feet at the view scale', () => {
    const v = makeView({ scale: '1/4' });
    const bar = scaleBar([0, 0], v);
    expect(bar).toContain(`1/4" = 1'-0"`);
    expect(bar).toContain(`>16'<`);
    expect(bar).toContain(`width="${n2(v.len(4))}"`);
    expect(scaleBar([0, 0], makeView({ scale: '1:50' }), 'metric')).toContain('>5 m<');
  });

  it('the north arrow turns with the plan', () => {
    expect(northArrow([10, 10], 30)).toContain('rotate(30 10 10)');
    expect(northArrow([10, 10])).toContain('>N<');
  });

  it('the title block carries the project, title, scale and sheet id, and writes no date', () => {
    const tb = titleBlock({ project: 'Hillside house', title: 'Ground floor plan', id: 'A-101', scale: '1/4', revision: 3 });
    expect(tb.svg).toContain('Hillside house');
    expect(tb.svg).toContain('Ground floor plan');
    expect(tb.svg).toContain(`1/4" = 1'-0"`);
    expect(tb.svg).toContain('>A-101<');
    expect(tb.svg).toContain('>DATE<');
    expect(tb.svg).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    const [x, y, w, h] = tb.drawing;
    expect(x + w).toBeLessThan(tb.size[0] - 62);
    expect(y + h).toBeLessThan(tb.size[1]);
  });

  it('a sheet is mm on paper, with the style and the block', () => {
    const tb = titleBlock({ id: 'A-101' });
    const svg = sheetSvg({ body: drawingTitle([20, 200], { detail: '1', title: 'Floor plan', scale: '1/4' }), block: tb });
    expect(svg).toMatch(/^<svg[^>]*width="431.8mm" height="279.4mm" viewBox="0 0 431.8 279.4"/);
    expect(svg).toContain('<style>');
    expect(svg).toContain('FLOOR PLAN');
  });

  it('the same marks draw the same bytes', () => {
    const draw = () => [dimension([1, 2], [40, 30], 7.3), sectionMarker([5, 5], { dir: 'W' }), windowTag([3, 3], 'B'), northArrow([1, 1], 12)].join('');
    expect(draw()).toBe(draw());
  });
});
