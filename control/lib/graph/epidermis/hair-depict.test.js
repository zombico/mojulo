// The hair's depiction (the grass hat) and its score: a groom's blades and the coat under them on the head it grows on;
// a buzz the coat alone; the coat covers every scalp that grows hair, the part left open; the score sees no bald spot
// where the coat lies, and tells the blades' own cover from it.
import { describe, it, expect } from 'vitest';
import { relationalHead } from '../polygonizer/head-relational.js';
import { relationalHeadChart } from './dermal-head.js';
import { readDermis } from './dermal-map.js';
import { readScalp, bladeOf, SCALP_STYLES } from './dermal-hair.js';
import { depictHair, capMesh, stripMesh, hairClass } from './hair-depict.js';
import { scoreHair } from './hair-score.js';
import { prepareCase, solveClass, candidatesFor } from './hair-solve.js';

const chart = relationalHeadChart(relationalHead({ sex: 'male' }), { cells: 44 });
const D = readDermis({ from: 'male' });

describe('the hair\'s depiction', () => {
  it('grows blades and a coat for a cut, the coat alone for a buzz', () => {
    const cut = depictHair(chart, D, readScalp({ style: 'short', spacing: 0.02 }));
    expect(cut.strips.closure).toBe('open'); expect(cut.cap.closure).toBe('closed');
    expect(cut.strips.faces.length).toBe(cut.strips.groups.length);
    const buzz = depictHair(chart, D, readScalp('buzz'));
    expect(buzz.strips).toBeNull(); expect(buzz.cap.faces.length).toBeGreaterThan(0);
    // (a bald crown is not coated; a head with no scalp hair has no coat)
    expect(capMesh(chart, readDermis({ from: 'male', bald: 1 })).faces.length).toBeLessThan(cut.cap.faces.length);
    expect(stripMesh([]).faces).toEqual([]);
  }, 120_000);
  it('scores no bald spot where the coat lies, and the blades\' own cover apart from it', () => {
    const dep = depictHair(chart, D, readScalp({ style: 'short', spacing: 0.02 }));
    const s = scoreHair(chart, D, dep, { px: 96 });
    expect(s.coverage).toBeGreaterThan(0.97);
    expect(s.bladeCover).toBeLessThanOrEqual(s.coverage);
    expect(scoreHair(chart, D, { strips: null, cap: null }, { px: 96 }).coverage).toBe(0);
    expect(s.faces).toBe(dep.strips.faces.length + dep.cap.faces.length);
  }, 120_000);
  it('classes a groom by its procedure, one class a way of cutting the hat', () => {
    // (one style a class, found in the catalog by its trait)
    const find = (f) => readScalp(Object.keys(SCALP_STYLES).find((k) => f(readScalp(k))));
    expect(hairClass(find((S) => S.ties.some((T) => T.tail?.kind === 'loc')))).toBe('rope');
    expect(hairClass(find((S) => S.ties.some((T) => T.tail?.kind === 'bun')))).toBe('tied');
    expect(hairClass(find((S) => !S.ties.length && S.type === 'coily'))).toBe('coil');
    expect(hairClass(find((S) => !S.ties.length && S.type === 'straight' && S.cut?.strip))).toBe('standing');
    expect(hairClass(readScalp({ style: 'short', length: 0.04 }))).toBe('cropped');
    expect(hairClass(readScalp({ style: 'short', length: 0.5 }))).toBe('long');
  });
  it('lays a short blade flat, keeps a rope as wide, and caps a coil\'s spans', () => {
    const up = { pts: [[0, 0, 0.1], [0, 0, 0.11], [0, 0.001, 0.12], [0, 0.002, 0.13]] };
    const stood = bladeOf(up, 0.004, 3, 4, { centre: [0, 0, 0] }), lain = bladeOf(up, 0.004, 3, 4, { centre: [0, 0, 0], lie: 0.9 });
    expect(lain.pts.at(-1)[2]).toBeLessThan(stood.pts.at(-1)[2]);
    const len = (b) => b.pts.slice(1).reduce((a, p, i) => a + Math.hypot(...p.map((v, q) => v - b.pts[i][q])), 0);
    expect(len(lain)).toBeCloseTo(len(stood), 2);
    // (a long blade is the comb's, never pressed)
    const long = { pts: [[0, 0, 0.1], [0, 0, 0.2], [0, 0.01, 0.3]] };
    expect(bladeOf(long, 0.004, 3, 4, { lie: 0.9 }).pts).toEqual(bladeOf(long, 0.004, 3, 4).pts);
    const rope = bladeOf(long, 0.004, 3, 4, { rope: true });
    expect(rope.half.slice(0, -1).every((h) => h === 0.002)).toBe(true); expect(rope.half.at(-1)).toBe(0);
    const coil = { pts: Array.from({ length: 41 }, (_, i) => [0.003 * Math.cos(i), 0.003 * Math.sin(i), 0.1 + i * 0.002]) };
    expect(bladeOf(coil, 0.004, 3, 4).pts.length).toBeGreaterThan(9);
    expect(bladeOf(coil, 0.004, 3, 4, { cap: 6 }).pts.length).toBe(7);
  });
  it('solves a class to the candidate every case passes on, the rung its baseline', () => {
    const S = readScalp({ style: 'crop', spacing: 0.02 }), kase = prepareCase(chart, D, S, { level: 'L1' });
    const r = solveClass([kase], 'cropped', { level: 'L1', px: 64, candidates: [{}, { lie: 0.9 }] });
    expect(r.baseline.rules).toEqual({});
    expect(r.table).toHaveLength(2);
    expect(r.table.find((t) => t.rules === r.rules).passes || r.rules === r.baseline.rules).toBe(true);
    expect(candidatesFor('cropped')[0]).toEqual({});
  }, 240_000);
});

