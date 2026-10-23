// The hair's depiction (the grass hat) and its score: a groom's blades and the coat under them on the head it grows on;
// a buzz the coat alone; the coat covers every scalp that grows hair, the part left open; the score sees no bald spot
// where the coat lies, and tells the blades' own cover from it.
import { describe, it, expect } from 'vitest';
import { relationalHead } from '../polygonizer/head-relational.js';
import { relationalHeadChart } from './dermal-head.js';
import { readDermis } from './dermal-map.js';
import { readScalp } from './dermal-hair.js';
import { depictHair, capMesh, stripMesh } from './hair-depict.js';
import { scoreHair } from './hair-score.js';

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
});
