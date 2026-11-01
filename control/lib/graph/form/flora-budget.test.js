/**
 * The plants' budget (form/flora-read.js FLORA_BUDGET): a plant on a form page spends at most so many triangles a square
 * metre of its side's silhouette. Over it, it gives up its sprays, then its leaves' outlines, then clumps by rank, each
 * kept clump grown to hold the cover. A small form is enough to show it: no catalog sweep.
 */
import { describe, expect, it } from 'vitest';

import { budgeted, FLORA_BUDGET } from './flora-read.js';

// (a crown of n clumps on a ring of radius r, height h, each its rank and scale)
const form = (n, r, h, sites = 0) => ({ height: h, clumps: Array.from({ length: n }, (_, i) => ({ p: [r * Math.cos(i), r * Math.sin(i), h / 2], o: [0, 0, 1], d: [0, 0, 1], s: 1, e: 0, r: i / n })),
  sites: Array.from({ length: sites }, () => ({})) });
const T = { clumpTris: 60, leanTris: 24, sprayTris: 40, woodTris: 30 };

describe('the plants\' budget', () => {
  it('leaves a plant within it as it is', () => {
    const Q = budgeted(form(20, 4, 12), T);
    expect(Q.budget.kept).toBe(20);
    expect(Q.lean).toBe(false);
    expect(Q.budget.tris).toBeLessThanOrEqual(Q.budget.cap);
  });

  it('takes a small bush with a big crown down to its silhouette\'s share: sprays first, then lean leaves, then clumps', () => {
    const Q = budgeted(form(64, 0.6, 1.2, 192), T);
    expect(Q.sites).toHaveLength(0);
    expect(Q.lean).toBe(true);
    expect(Q.budget.tris).toBeLessThanOrEqual(Q.budget.cap);
    expect(Q.budget.cap).toBeCloseTo(Math.max(FLORA_BUDGET.floor, FLORA_BUDGET.perM2 * 2 * 0.6 * 1.2), 0);
    // (each kept clump grown so the crown holds its cover: the kept clumps' area the whole crown's)
    const area = (L) => L.reduce((a, c) => a + c.s * c.s, 0);
    expect(area(Q.clumps)).toBeCloseTo(64, 5);
  });

  it('never keeps fewer than its least', () => {
    expect(budgeted(form(9, 0.1, 0.1), T).clumps.length).toBeGreaterThanOrEqual(FLORA_BUDGET.least);
  });
});
