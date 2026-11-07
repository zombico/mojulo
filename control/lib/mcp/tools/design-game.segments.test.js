// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { readGrid } from '@/lib/graph/level/grid.js';
import { designGameHandler } from './design-game.js';

// A PLANNED MAP WRITTEN BY A CREW (gameworld/segments.js): the map's plan settled, one req raises every segment, an
// author each in its own seat, handed its gates and role from the plan; each writes its segment only, held to the
// segment's law before anything is stored; the plan stitches what they wrote (and fills what they have not) into one map.

const plan = {
  size: 4, rows: ['A B', '. C'], route: ['A', 'B', 'C'],
  key: { A: { name: 'the town' }, B: { name: 'the woods', rise: 4 }, C: { name: 'the shrine', rise: 8, goal: { use: 'temple' } } },
};
const WORLD = { id: 'vale-game', name: 'The Vale', mode: 'gated', start: 'vale', levels: { vale: { name: 'The Vale', glyphs: { tile: 24, plan } } } };
const SEG = {
  A: { rows: ['h . . .', '# # # #', '. s . .', '. . . .'], key: { h: { use: 'dwelling' }, s: { use: 'shop' } } },
  B: { rows: ['. . . .', '# # . .', '. # # #', '. # . .'] },
  C: { rows: ['. # . .', 'h # . .', '. G . .', '. . . .'], key: { h: { use: 'dwelling', door: 'e' }, G: { use: 'temple', goal: true } } },
};
const set = (S, value) => [{ op: 'set', path: `/levels/vale/glyphs/segments/${S}`, value }];
const why = [{ slot: 'segment', because: 'the remit' }];

describe('design_game: a planned map\'s segments as a crew', () => {
  beforeEach(() => { closeDb(); });

  it('raises every segment as one req, an author each, and keeps each to its own segment and its law', async () => {
    await designGameHandler({ world: WORLD, ref: 'pm' });
    const out = await designGameHandler({ ref: 'pm', req: { unit: 'level:vale', segments: true } });
    expect(out.reqs.raised.at(-1)).toMatch(/^r\d+ level:vale\/A \+ level:vale\/B, level:vale\/C$/);
    const id = out.reqs.raised.at(-1).split(' ')[0];
    // (the segments' page laid, so each author's set lands)
    expect(SketchRepository.getByRef('pm').manifest.levels.vale.glyphs.segments).toEqual({});
    const started = await designGameHandler({ ref: 'pm', req: { id, start: true } });
    expect(started.reqs.raised).toEqual([`${id} j1 author level:vale/A issued`, `${id} j2 author level:vale/B issued`, `${id} j3 author level:vale/C issued`]);
    // each author's brief: its segment's pages, and its plan's remit (its role, its gates and whom they join)
    const view = await designGameHandler({ ref: 'pm', chapter: 'level:vale/B' });
    const j2 = view.req.jobs.find((j) => j.job === 'j2');
    expect(j2).toMatchObject({ writes: ['/levels/vale/glyphs/segments/B'], segment: { segment: 'B', name: 'the woods', role: 'passage', size: 4 } });
    expect(j2.segment.gates).toEqual(['in by the west side, row 2 column 1 a path (\'#\'), joining the town', 'out by the south side, row 4 column 2 a path (\'#\'), joining the shrine']);
    expect(j2.segment.floor.rows).toHaveLength(4);
    // a segment that breaks its law is refused before anything is written; the job stays issued
    await expect(designGameHandler({ ref: 'pm', req: { id, job: 'j2', patch: set('B', { rows: ['. . . .', '# # . .', '# # . .', '. # . .'] }), decisions: why } })).rejects.toThrow(/refused, nothing written[\s\S]*west side, which a neighbour lies beyond/);
    // and one that writes past its segment
    await expect(designGameHandler({ ref: 'pm', req: { id, job: 'j2', patch: [{ op: 'set', path: '/levels/vale/name', value: 'x' }], decisions: why } })).rejects.toThrow(/writes its segment only/);
    expect(SketchRepository.getByRef('pm').manifest.levels.vale.glyphs.segments).toEqual({});
    // each author kept in turn; the map is whole at every moment (the rest laid from the plan)
    const two = await designGameHandler({ ref: 'pm', req: { id, job: 'j2', patch: set('B', SEG.B), decisions: why } });
    expect(two.reqs.done[0]).toBe('j2 author kept: its patch applied');
    const mid = readGrid({ tile: 24, plan, segments: SketchRepository.getByRef('pm').manifest.levels.vale.glyphs.segments });
    expect(Object.values(mid.plan.segments).map((s) => s.written)).toEqual([false, true, false]);
    for (const j of ['j1', 'j3']) await designGameHandler({ ref: 'pm', req: { id, job: j, patch: set(j === 'j1' ? 'A' : 'C', SEG[j === 'j1' ? 'A' : 'C']), decisions: why } });
    const G = readGrid({ tile: 24, plan, segments: SketchRepository.getByRef('pm').manifest.levels.vale.glyphs.segments });
    expect(Object.values(G.plan.segments).map((s) => s.written)).toEqual([true, true, true]);
    // consolidated: every segment's proposal kept, the map played once (one level, however many segments)
    const R = (await designGameHandler({ ref: 'pm', chapter: 'level:vale/A' })).req.receipt;
    expect(R.checks.find((c) => c.check === 'proposal')).toMatchObject({ holds: true });
    expect(R.checks.find((c) => c.check === 'probe').says).toBe("no stage made: { chapter: 'level:vale', run: true }");
  });

  it('refuses segments of a level that is not planned, and a segment its plan does not lay out', async () => {
    await designGameHandler({ world: { ...WORLD, levels: { vale: { name: 'The Vale', glyphs: { tile: 24, rows: ['# #'] } } } }, ref: 'pr' });
    await expect(designGameHandler({ ref: 'pr', req: { unit: 'level:vale', segments: true } })).rejects.toThrow(/not a planned map/);
    await designGameHandler({ world: WORLD, ref: 'pz' });
    await expect(designGameHandler({ ref: 'pz', req: { unit: 'level:vale/D' } })).rejects.toThrow(/has no segment 'D'/);
    await expect(designGameHandler({ ref: 'pz', req: { unit: 'level:vale/A', segments: true } })).rejects.toThrow(/segments: true goes with a planned map's level/);
  });

  it('takes a crew\'s reports at once, each onto the recipe as the last left it: no author\'s segment written over', async () => {
    await designGameHandler({ world: WORLD, ref: 'pp' });
    const id = (await designGameHandler({ ref: 'pp', req: { unit: 'level:vale', segments: true } })).reqs.raised.at(-1).split(' ')[0];
    await designGameHandler({ ref: 'pp', req: { id, start: true } });
    await Promise.all([['j1', 'A'], ['j2', 'B'], ['j3', 'C']].map(([j, S]) => designGameHandler({ ref: 'pp', req: { id, job: j, patch: set(S, SEG[S]), decisions: why } })));
    expect(Object.keys(SketchRepository.getByRef('pp').manifest.levels.vale.glyphs.segments).sort()).toEqual(['A', 'B', 'C']);
  });
});

