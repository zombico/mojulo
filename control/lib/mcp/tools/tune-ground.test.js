// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createSketchHandler, updateSketchHandler } from './sketches.js';
import { tuneGroundHandler, nextGround } from './tune-ground.js';
import { MEADOWMARK } from '@/lib/graph/gameworld/examples.js';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';

// tune_ground: a gameworld level's ground, previewed until applied, written to levels.<id>.ground.
beforeEach(() => { closeDb(); });
const make = async () => { await createSketchHandler({ title: 'Meadowmark', manifest: { kind: 'gameworld', ...MEADOWMARK }, ref: 'gw-ground' }); };
const stored = () => SketchRepository.getByRef('gw-ground').manifest.levels['meadow-ascent'].ground;

describe('nextGround', () => {
  it('merges dials (null clears one), replaces an edit by its id, removes by label, clears', () => {
    const cur = { tune: { amplitude: 8, bump: { height: 1, scale: 2 } }, edits: [{ op: 'raise', at: 'C4', height: 2 }, { op: 'gorge', id: 'cut', path: 'A9>J9', depth: 3 }] };
    expect(nextGround(cur, { tune: { amplitude: null, depth: 2, bump: { scale: null } } }).tune).toEqual({ depth: 2, bump: { height: 1 } });
    expect(nextGround(cur, { edits: [{ op: 'gorge', id: 'cut', path: 'A9>J9', depth: 6 }] }).edits[1].depth).toBe(6);
    expect(nextGround(cur, { remove: ['raise-1'] }).edits.map((e) => e.op)).toEqual(['gorge']);
    expect(() => nextGround(cur, { remove: ['ridge-4'] })).toThrow(/not an edit of this level \(edits: raise-1, cut\)/);
    expect(nextGround({ edits: cur.edits }, { clear: true })).toBe(undefined);
    expect(nextGround(undefined, { cell: 6 })).toBe(undefined);
  });
});

describe('tune_ground', () => {
  it('reads a level\'s ground: the map, the dials, hotspots and the vocabulary when it has none', async () => {
    await make();
    const r = await tuneGroundHandler({ ref: 'gw-ground' });
    expect(r).toMatchObject({ ok: true, level: 'meadow-ascent', changed: false, applied: false, ground: null });
    expect(r.map.split('\n')[1]).toMatch(/← trailhead/);
    expect(r.trails.map((t) => t.node)).toEqual(['trailhead', 'approach']);
    expect(Object.keys(r.vocab.edits)).toEqual(['raise', 'lower', 'flatten', 'cliff', 'gorge', 'ridge']);
    expect(r.vocab.heartbeat).toMatch(/ascent/);
    expect(r.heights).toBeUndefined();
  });

  it('previews a change without storing it; applied, it is the level\'s ground', async () => {
    await make();
    const ask = { ref: 'gw-ground', tune: { amplitude: 9 }, edits: [{ op: 'cliff', path: 'F8>J8', height: 6, high: 'H10' }] };
    const p = await tuneGroundHandler(ask);
    expect(p).toMatchObject({ changed: true, applied: false, diff: { comparable: true } });
    expect(p.diff.moved).toBeGreaterThan(0);
    expect(p.trails[0].dials.amplitude).toBe(9);
    expect(stored()).toBeUndefined();
    const a = await tuneGroundHandler({ ...ask, apply: true });
    expect(a.applied).toBe(true);
    expect(stored()).toEqual({ tune: { amplitude: 9 }, edits: [{ op: 'cliff', path: 'F8>J8', height: 6, high: 'H10' }] });
    // the same again changes nothing
    expect((await tuneGroundHandler({ ...ask, apply: true })).changed).toBe(false);
    expect((await tuneGroundHandler({ ref: 'gw-ground', remove: ['cliff-1'], tune: { amplitude: null }, apply: true })).applied).toBe(true);
    expect(stored()).toBeUndefined();
  });

  it('refuses what is not a gameworld level, and an edit off the grid, before writing', async () => {
    await make();
    await expect(tuneGroundHandler({ ref: 'gw-ground', level: 'nowhere' })).rejects.toThrow(/'nowhere' is not a level/);
    await expect(tuneGroundHandler({ ref: 'gw-ground', edits: [{ op: 'raise', at: 'Z99', height: 2 }], apply: true })).rejects.toThrow(/off the grid/);
    expect(stored()).toBeUndefined();
    await expect(tuneGroundHandler({ ref: 'missing' })).rejects.toThrow(/no sketch 'missing'/);
  });

  it('lays a heartbeat; exports the level\'s ground as one, saved as a sketch another level clones from', async () => {
    await make();
    const laid = await tuneGroundHandler({ ref: 'gw-ground', heartbeat: 'broken-ground', rise: [[1, 0], [20, 5]], edits: [{ op: 'raise', at: 'I4', height: 3 }], apply: true });
    expect(laid.applied).toBe(true);
    expect(stored()).toMatchObject({ heartbeat: 'broken-ground', rise: [[1, 0], [20, 5]] });
    expect(laid.placed.map((p) => p.edit)).toEqual(['heartbeat-1', 'heartbeat-2', 'level-rise', 'raise-1']);
    const ex = await tuneGroundHandler({ ref: 'gw-ground', export: { id: 'meadow-broken', title: 'Meadow, broken', save: 'hb-meadow' } });
    expect(ex.exported).toMatchObject({ saved: 'hb-meadow', heartbeat: { id: 'meadow-broken', pulse: { amplitude: 6, depth: 5 }, source: 'gw-ground/meadow-ascent' } });
    expect(ex.exported.heartbeat.marks.map((m) => m.op)).toEqual(['cliff', 'gorge', 'raise']);
    expect(ex.exported.heartbeat.rise.length).toBeGreaterThanOrEqual(2);
    // the saved heartbeat is a sketch of its own, seen as a greybox
    const row = SketchRepository.getByRef('hb-meadow');
    expect(row.manifest.kind).toBe('heartbeat');
    const { payload } = await resolveWorldScene(row);
    expect(payload.heartbeat.id).toBe('meadow-broken');
    expect(payload.faces.length).toBeGreaterThan(1000);
    // cloned into the other level: copied, its source noted
    const cl = await tuneGroundHandler({ ref: 'gw-ground', level: 'shell-shore', heartbeat: 'hb-meadow', apply: true });
    expect(cl.applied).toBe(true);
    const there = SketchRepository.getByRef('gw-ground').manifest.levels['shell-shore'].ground.heartbeat;
    expect(there).toMatchObject({ id: 'meadow-broken', source: 'hb-meadow' });
    await expect(tuneGroundHandler({ ref: 'gw-ground', heartbeat: 'gw-ground' })).rejects.toThrow(/is a gameworld, not a heartbeat/);
  });

  it('a painted level says what painted it, and its exported heartbeat remembers the terrain', async () => {
    await make();
    const cube = { from: 'gothic-night', outside: { terrain: 'moor', terrains: { shore: { base: 'isekai-sakura' } } } };
    await updateSketchHandler({ ref: 'gw-ground', patch: [{ op: 'set', path: '/levels/meadow-ascent/style', value: { geocube: cube, terrain: 'shore' } }] });
    const r = await tuneGroundHandler({ ref: 'gw-ground', export: { id: 'shore-walk' } });
    expect(r.paint).toMatchObject({ geocube: 'gothic-night-variant', terrain: 'shore', from: 'level', offered: ['moor', 'shore'] });
    expect(r.exported.heartbeat.terrain).toBe('shore');
  });
});
