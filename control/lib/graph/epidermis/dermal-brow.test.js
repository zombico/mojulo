// The brows painted (dermal-brow.js): the groom's hairs as strokes in the head's chart frame, on the seated head (one
// sex: the procedure is the same for both). The strokes lie over the eye, the paint covers on a hair and nothing away
// from the brow, the same twice; no brow groom, no strokes.
import { describe, it, expect } from 'vitest';
import { relationalHead } from '../polygonizer/head-relational.js';
import { headMarks } from './dermal-head.js';
import { browStrokes, browAt } from './dermal-brow.js';

const head = relationalHead({ sex: 'female', seat: 2 });
const B = browStrokes(head, { from: 'default' }), M = headMarks(head);

describe('the painted brow', () => {
  it('lays the groom\'s hairs as strokes over each eye, the same twice', () => {
    expect(B.count).toBeGreaterThan(40);
    expect(B.segs.length).toBeGreaterThan(B.count * 3);
    // (over the eyes, either side of the middle, above the canthi)
    const xs = B.segs.map((s) => (s[0] + s[2]) / 2), ys = B.segs.map((s) => (s[1] + s[3]) / 2);
    expect(xs.some((x) => x > 10)).toBe(true); expect(xs.some((x) => x < -10)).toBe(true);
    expect(Math.min(...ys)).toBeGreaterThan(M.points.exR.Y);
    expect(browStrokes(head, { from: 'default' }).segs).toEqual(B.segs);
  });
  it('covers on a hair and leaves the skin away from the brow', () => {
    const [ax, ay, bx, by] = B.segs[Math.floor(B.segs.length / 2)], on = browAt(B, (ax + bx) / 2, (ay + by) / 2, 0.4);
    expect(on.cover).toBeGreaterThan(0.05); expect(on.root).toBeGreaterThan(0);
    expect(browAt(B, 0, M.points.sn.Y, 0.4)).toBeNull();
  });
  it('grows no strokes without a brow groom', () => {
    expect(browStrokes(head, { from: 'default', hair: { brows: false } })).toBeNull();
  });
});

describe('the painted lash line', () => {
  it('runs along each lid\'s margin, under the brow, darker on the upper', () => {
    const L = browStrokes(head, { from: 'default' }, { lashLine: true }), line = L.segs.filter((s) => s[4] === 1);
    expect(line.length).toBeGreaterThan(20);
    // (between the canthi's height and the brow's)
    const ys = line.map((s) => s[1]), brow = Math.min(...B.segs.map((s) => Math.min(s[1], s[3])));
    expect(Math.max(...ys)).toBeLessThan(brow); expect(Math.min(...ys)).toBeGreaterThan(M.points.al?.Y ?? M.points.alR.Y);
    const up = line.find((s) => s[5] === 1), at = browAt(L, (up[0] + up[2]) / 2, (up[1] + up[3]) / 2, 0.4);
    expect(at.line).toBeGreaterThan(0.5);
  });
});
