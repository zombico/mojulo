// THE SPECIMENS (specimens.js): each row's wireframe drawn by its own depictor (a crystal's habit, a metal's cubic
// form, a rock's creases), unit size and centred, the same every time; and a frame operation's scan that names one
// carries its find to the page.
import { describe, expect, it } from 'vitest';
import { SPECIMENS, specimenWire, readSpecimen } from './specimens.js';
import { readOperation, operationCast } from '../gameworld/frame-goal.js';

describe('a specimen', () => {
  it('is drawn by its kind\'s depictor, unit size and centred, the same each time', () => {
    // (one of each kind, picked from the shelf)
    for (const kind of ['crystal', 'metal', 'rock']) {
      const id = Object.keys(SPECIMENS).find((k) => SPECIMENS[k].kind === kind), W = specimenWire(id), L = W.lines;
      expect(L.length % 6).toBe(0);
      expect(L.length / 6).toBeGreaterThan(8);
      const ext = [0, 1, 2].map((k) => { const v = L.filter((_, i) => i % 3 === k); return [Math.min(...v), Math.max(...v)]; });
      expect(Math.max(...ext.map(([a, b]) => b - a))).toBeCloseTo(1, 2);
      for (const [a, b] of ext) expect(a + b).toBeCloseTo(0, 2);
      expect(W.colour).toBe(SPECIMENS[id].colour);
    }
    expect(() => readSpecimen('unobtainium')).toThrow(/is a specimen/);
  });

  it('a scan that names one carries its find, its yield and its wireframe, to the page', () => {
    const ends = { spawn: [0, 0, 0], heading: 0, ground: () => 0, frame: { half: 500, centre: [0, 0], gravity: 2.47 } };
    const op = readOperation({ groups: [{ id: 'd', kind: 'gnat', at: [0.5, 0] }], tasks: [{ scan: [0.2, 0], specimen: 'platinum', amount: 46, unit: 'kt', found: 'A seam' }, { down: ['d'] }] });
    const [F] = operationCast(op, ends).finds;
    expect(F).toMatchObject({ task: 't1', name: SPECIMENS.platinum.name, grade: SPECIMENS.platinum.grade, amount: { approx: 46, unit: 'kt' } });
    expect(F.wire).toBe(specimenWire('platinum'));
    expect(() => readOperation({ groups: [{ id: 'd', kind: 'gnat', at: [0.5, 0] }], tasks: [{ scan: [0.2, 0], amount: 4, unit: 't' }] })).toThrow(/name its specimen/);
  });
});
