// The hair card's strand texture (hair-strands.js) and the card it draws on (hair-depict.js stripMesh `card`, realistic
// laws 7): the page is the same page every time, filled at the root and open between its strands toward the tip; each
// cell its own lay; a card is full width to its end, each point its place across and along it, its cell by its index.
import { describe, it, expect } from 'vitest';
import { strandPage, strandCellUV, STRAND_PAGE } from './hair-strands.js';
import { stripMesh, HAIR_CARD } from './hair-depict.js';

describe('the strand page', () => {
  const P = strandPage({ w: 256, h: 64 });
  const row = (y, c = 0) => { const cw = P.w / HAIR_CARD.cells, a = []; for (let x = c * cw; x < (c + 1) * cw; x++) a.push(P.rgba[(y * P.w + x) * 4 + 3]); return a; };
  it('is deterministic, white, filled at its root and open between strands toward the tip', () => {
    expect(Buffer.from(strandPage({ w: 256, h: 64 }).rgba).equals(Buffer.from(P.rgba))).toBe(true);
    expect(row(0).every((a) => a === 255)).toBe(true);
    const mid = row(Math.round(P.h * 0.5));
    expect(mid.some((a) => a === 0)).toBe(true); expect(mid.some((a) => a > 200)).toBe(true);
    // (past the shortest strand's end the cell thins: less cover than at mid length)
    const sum = (r) => r.reduce((s, a) => s + a, 0);
    expect(sum(row(P.h - 1))).toBeLessThan(sum(mid));
    // (white: a texel's value is the strand's, within the page's spread)
    for (let i = 0; i < P.rgba.length; i += 4) if (P.rgba[i + 3] > 0) { expect(P.rgba[i]).toBeGreaterThanOrEqual(Math.floor(255 * STRAND_PAGE.value[0])); expect(P.rgba[i]).toBe(P.rgba[i + 1]); }
    // (each cell its own lay)
    expect(row(32, 1)).not.toEqual(row(32, 0));
  });
  it('draws the hero\'s own strands under a dye: most its pigment, the share gone grey the cards\' colour itself', () => {
    const D = strandPage({ w: 256, h: 64, dye: { tint: [0.3, 0.2, 0.1], grey: 0.25 } });
    let dark = 0, grey = 0;
    for (let i = 0; i < D.rgba.length; i += 4) if (D.rgba[i + 3] === 255) { const [r, g, b] = D.rgba.subarray(i, i + 3); if (r === g && g === b) grey++; else { dark++; expect(r).toBeGreaterThan(g); expect(g).toBeGreaterThan(b); } }
    expect(dark).toBeGreaterThan(grey); expect(grey).toBeGreaterThan(0);
    // (the cover is the undyed page's: a dye moves colour, never alpha)
    for (let i = 3; i < D.rgba.length; i += 4) expect(D.rgba[i]).toBe(P.rgba[i]);
  });
  it('places a card point in its cell, its root at the top', () => {
    const [s0, t0] = strandCellUV(3, [0, 0]), [s1, t1] = strandCellUV(3, [1, 1]);
    expect(s0).toBeGreaterThan(3 / HAIR_CARD.cells); expect(s1).toBeLessThan(4 / HAIR_CARD.cells);
    expect(t0).toBeGreaterThan(0.99); expect(t1).toBeLessThan(0.01);
  });
});

describe('the alpha card', () => {
  const blade = { pts: [[0, 0, 0], [0, 0, 0.01], [0, 0, 0.02], [0, 0, 0.03]], half: [0.002, 0.0015, 0.001, 0], across: [[1, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]] };
  it('runs full width to its end, every point its place on the card; the blade without it as before', () => {
    const C = stripMesh([blade, blade], undefined, { card: true }), B = stripMesh([blade, blade]);
    expect(B.uv).toBeUndefined();
    expect(C.uv.length).toBe(C.vertices.length);
    expect(C.faces.length).toBe(2 * 2 * 3);
    // (its end as wide as HAIR_CARD.tip of its root, never a point)
    const end = C.vertices.slice(6, 8);
    expect(Math.abs(end[0][0] - end[1][0])).toBeCloseTo(2 * 0.002 * HAIR_CARD.tip, 6);
    expect(C.uv.slice(0, 8).map(([a, l]) => [a, +l.toFixed(3)])).toEqual([[0, 0], [1, 0], [0, 0.333], [1, 0.333], [0, 0.667], [1, 0.667], [0, 1], [1, 1]]);
    // (two cards, two cells)
    expect(C.uv[0][2]).not.toBe(C.uv[8][2]);
  });
});
