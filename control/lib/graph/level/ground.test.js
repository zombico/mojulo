import { describe, it, expect } from 'vitest';
import { readLevel } from './graph.js';
import { sequentialLevel, sequentialOrder } from './sequential.js';
import { parseCell, cellName, levelFrame, readLevelGround } from './ground.js';
import { surveyLevelGround, groundDiff } from './ground-survey.js';
import { outTrailOf } from '../era/out-trail-board.js';
import { resolveLevel } from '../gameworld/world.js';
import { MEADOWMARK } from '../gameworld/examples.js';

// A level's own ground (ground.js): a top-down grid over the level's frame, compiled into each trail's recipe in its
// own metres; and the survey (ground-survey.js) that reads it back as a map with hotspots.
const LEVEL = { kit: 'isekai-meadow', seed: 4, nodes: { meadow: { trail: { run: 14 } }, ridge: { trail: { run: 14, heartbeat: 0.8 } } } };
const sites = (L) => sequentialLevel(L).stages.map((s) => outTrailOf(s.manifest).site);

describe('the grid', () => {
  it('names cells as a board does', () => {
    expect(parseCell('C4')).toEqual({ c: 2, r: 4 });
    expect(parseCell('c12')).toEqual({ c: 2, r: 12 });
    expect(parseCell('C0')).toBe(null);
    expect(parseCell('4C')).toBe(null);
    expect(cellName(9, 31)).toBe('J31');
  });

  it('the frame is the built sites\': each trail starts where the one before leaves', () => {
    const G = readLevel(LEVEL), F = levelFrame(G, sequentialOrder(G)), S = sites(LEVEL);
    expect(F.spans.map((s) => s.origin)).toEqual([0, S[0].D]);
    expect(S[1].origin).toBe(S[0].D);
    expect(F.spans[1].D).toBe(S[1].D);
    expect(F.rows).toBe(Math.ceil((S[0].D + S[1].D) / F.cell));
    expect(F.x0).toBe(S[0].grid.x0);
  });

  it('a climb after the trails is framed open; the trails before it are the grid', () => {
    const lv = resolveLevel(MEADOWMARK, 'meadow-ascent').level, G = readLevel(lv), F = levelFrame(G, sequentialOrder(G));
    expect(F.spans.map((s) => [s.node, s.section])).toEqual([['trailhead', 'trail'], ['approach', 'trail'], ['lookout', 'meru']]);
    expect(F.spans[2].D).toBe(null);
  });

  it('teaches what is wrong', () => {
    expect(() => readLevelGround({ cells: 6 })).toThrow(/cells is not a ground setting/);
    expect(() => readLevelGround({ cell: 2 })).toThrow(/cell is the grid's cell in metres, 4 to 16/);
    expect(() => readLevelGround({ edits: [{ op: 'raise', path: 'A1>A2' }] })).toThrow(/stands at a cell or a block/);
    expect(() => readLevelGround({ edits: [{ op: 'gorge', at: 'A1' }] })).toThrow(/runs along a path of cells/);
    expect(() => readLevelGround({ edits: [{ op: 'cliff', path: 'A1>C1', height: 4 }] })).toThrow(/names its high side/);
    expect(() => readLevelGround({ edits: [{ op: 'raise', at: 'C4:Q' }] })).toThrow(/is a cell/);
    expect(() => sequentialLevel({ ...LEVEL, ground: { edits: [{ op: 'raise', at: 'Z99', height: 2 }] } })).toThrow(/'Z99' is off the grid \(A1 to J\d+, 6 m cells\)/);
    expect(() => sequentialLevel({ ...LEVEL, ground: { edits: [{ op: 'raise', at: 'C4' }] } })).toThrow(/level\.ground\.edits\[0\]: height is metres/);
    expect(() => sequentialLevel({ ...LEVEL, ground: { edits: [{ op: 'cliff', path: 'D3>D9', height: 4, high: 'D6' }] } })).toThrow(/is on the cliff's line/);
  });
});

describe('compiled into the trails', () => {
  it('a level without ground lays its stages as before, with no ground key', () => {
    const a = sequentialLevel(LEVEL);
    expect(a.ground).toBeUndefined();
    expect(a.stages[0].manifest.trail).toEqual({ run: 14, id: 'meadow' });
  });

  it('an edit is laid in each trail it reaches, in that trail\'s own metres; one across the seam is whole on both sides', () => {
    const G = readLevel(LEVEL), F = levelFrame(G, sequentialOrder(G)), D0 = F.spans[1].origin;
    const seamRow = Math.round(D0 / F.cell);
    const L = { ...LEVEL, ground: { edits: [{ op: 'ridge', path: `H${seamRow - 2}>H${seamRow + 3}`, height: 4, walk: 'keep' }, { op: 'raise', at: 'I3', height: 3, id: 'knoll' }] } };
    const laid = sequentialLevel(L);
    expect(laid.ground.placed).toEqual([
      { edit: 'ridge-1', op: 'ridge', nodes: ['meadow', 'ridge'], off: false },
      { edit: 'knoll', op: 'raise', nodes: ['meadow'], off: false },
    ]);
    const own = laid.stages[1].manifest.trail.ground.edits[0];
    expect(own.path[0][1]).toBeCloseTo((seamRow - 2.5) * F.cell - D0, 2);
    // the trail that follows carries the followed one's edits in its `after`
    expect(laid.stages[1].manifest.trail.after.ground.edits.length).toBe(2);
    const [a, b] = sites(L), [x] = F.at(parseCell('H1'));
    expect(Math.abs(b.ground(x, 0) - a.ground(x, a.D))).toBeLessThan(0.05);
    const base = sites(LEVEL);
    expect(a.ground(x, a.D - 4) - base[0].ground(x, a.D - 4)).toBeGreaterThan(3);
    expect(b.ground(x, 4) - base[1].ground(x, 4)).toBeGreaterThan(3);
  });

  it('the level\'s dials sit under a trail\'s own', () => {
    const L = { ...LEVEL, nodes: { ...LEVEL.nodes, ridge: { trail: { run: 14, ground: { depth: 1, bump: { scale: 2 } } } } }, ground: { tune: { amplitude: 9, bump: { height: 0.2 } } } };
    const st = sequentialLevel(L).stages.map((s) => s.manifest.trail.ground);
    expect(st[0]).toEqual({ amplitude: 9, bump: { height: 0.2 } });
    expect(st[1]).toEqual({ amplitude: 9, depth: 1, bump: { height: 0.2, scale: 2 } });
  });
});

describe('the survey', () => {
  it('maps the grid: a row a line, the walk and its beats marked, every trail\'s dials read', () => {
    const s = surveyLevelGround(LEVEL);
    const lines = s.map.split('\n');
    expect(lines.length).toBe(s.grid.rows + 1);
    expect(lines[0].trim().startsWith('A')).toBe(true);
    expect(lines[1]).toMatch(/← meadow/);
    expect(s.map).toMatch(/T/);
    expect(s.map).toMatch(/X/);
    expect(s.trails.map((t) => t.node)).toEqual(['meadow', 'ridge']);
    expect(s.trails[0].dials).toMatchObject({ amplitude: 3.5, depth: 3.5, grade: 0.3 });
    expect(s.heights.length).toBe(s.grid.rows * s.grid.cols);
  });

  it('every hotspot\'s suggestion is an edit the level takes as written', () => {
    const s = surveyLevelGround(LEVEL);
    expect(s.hotspots.length).toBeGreaterThan(0);
    const edits = s.hotspots.flatMap((h) => h.suggest.map(({ why: _w, ...e }) => e));
    expect(() => sequentialLevel({ ...LEVEL, ground: { edits } })).not.toThrow();
  });

  it('the diff says which cells moved and which laws broke', () => {
    const a = surveyLevelGround(LEVEL);
    const b = surveyLevelGround({ ...LEVEL, ground: { edits: [{ op: 'raise', at: 'I5:J7', height: 6, walk: 'keep' }] } });
    const d = groundDiff(a, b);
    expect(d.comparable).toBe(true);
    expect(d.cells[0].dz).toBeGreaterThan(4);
    expect(d.cells.every((c) => /^[HIJ]\d+$/.test(c.cell))).toBe(true);
    expect(surveyLevelGround(LEVEL, { inspect: ['C4', 'Z1'] }).inspect).toMatchObject([{ cell: 'C4', trail: 'meadow' }, { cell: 'Z1', error: expect.stringMatching(/not a cell/) }]);
  });
});
