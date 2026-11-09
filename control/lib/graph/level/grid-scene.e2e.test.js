import { describe, it, expect } from 'vitest';
import { resolveWorldScene } from '../worlds/world-scene.js';

// A GLYPH MAP built whole through the kit's own builder (the map world kind): a crossing, a bend, an end and a building
// on one page, and its laws, measured on the page as built, say it is one walkable level.

describe('a glyph map, built', () => {
  it('is one page whose seams meet, whose paths and doors are clear, its paths one network', async () => {
    const level = { kit: 'isekai-meadow', seed: 4, grid: { tile: 32, rows: ['. # .', '# # h', '. # .', '. # #'], key: { h: { use: 'dwelling' } } } };
    const { payload: P } = await resolveWorldScene({ ref: 'glyph-map', manifest: { kind: 'map', level } });
    expect(P.map.cells.filter((c) => c.kind === 'path').map((c) => c.shape)).toEqual(['end', 'end', 'X', 'I', 'L', 'end']);
    for (const l of P.map.laws) expect(l.ok, `${l.law}: ${l.value}`).toBe(true);
    // (the building stands, its door toward the crossing; the trail's ribbon runs on every path tile)
    expect(P.anchors.some((a) => /h-1-2/.test(JSON.stringify(a)))).toBe(true);
    expect(P.faces.filter((f) => /trail/.test(f.group || '')).length).toBeGreaterThan(100);
  }, 300000);

  it('is one page when planned as segments and written in them: the plan\'s fill and an author\'s segment, stitched', async () => {
    // (three segments of 3 × 3 tiles: the town, the woods written by its author (a crossing, its lookouts on the map's
    // north and east edges, its own sides), the shrine at its temple)
    const plan = { size: 3, rows: ['A B', '. C'], route: ['A', 'B', 'C'], key: { A: { name: 'the town' }, B: { name: 'the woods', rise: 4 }, C: { name: 'the shrine', rise: 8, goal: { use: 'temple' } } } };
    const segments = { B: { rows: ['. # .', '# # #', '. # .'] } };
    const level = { kit: 'isekai-meadow', seed: 4, grid: { tile: 24, plan, segments } };
    const { payload: P } = await resolveWorldScene({ ref: 'planned-map', manifest: { kind: 'map', level } });
    for (const l of P.map.laws) expect(l.ok, `${l.law}: ${l.value}`).toBe(true);
    expect(Object.values(P.map.regions).map((r) => r.name)).toEqual(['the town', 'the woods', 'the shrine']);
    expect(P.anchors.some((a) => /temple|G-4-4/.test(JSON.stringify(a)))).toBe(true);
  }, 300000);
});

