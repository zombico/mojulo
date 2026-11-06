import { describe, it, expect } from 'vitest';
import { gridEnds } from './grid-ends.js';
import { readGrid, mapStart } from './grid.js';
import { levelHeight } from '../era/out-tile.js';
import { gameStages, stageEnds } from '../gameworld/levels.js';

// A GLYPH MAP'S ENDS, read from its grid and its land (the page not built): the hero set down at the far end from the
// goal, the exit at the goal's door, the way between as beats, the side ways' ends as pockets, the places' doors.

const level = { seed: 7, grid: { tile: 32, rows: ['. T .', '# # #', '. # .', '. # .'], key: { T: { use: 'temple', goal: true } }, regions: { rows: ['p p p', 'p p p', 'v v v', 'v v v'], key: { p: { name: 'the pass', rise: 6 }, v: { name: 'the vale' } } } } };

describe('a glyph map\'s ends', () => {
  it('sets the hero down at the far end from its goal and ends at the goal\'s door, on the level\'s land', () => {
    const E = gridEnds(level), T = 32;
    expect(E.spawn.slice(0, 2)).toEqual([1.5 * T, -3.5 * T]);
    const G = readGrid(level.grid), x = mapStart(G);
    expect([x.r, x.c]).toEqual([3, 1]);
    expect(E.exitFrom).toMatch(/temple/);
    expect(E.exit[2]).toBeCloseTo(levelHeight(E.exit[0], E.exit[1], { seed: 7, rise: G.rise }), 3);
    expect(E.via.at(-1)).toEqual(E.exit.slice(0, 2));
    expect(E.heading).toBeCloseTo(Math.PI / 2, 3);
  });

  it('names the way\'s tiles as beats, the side ways\' ends as pockets, each in its region', () => {
    const E = gridEnds(level);
    expect(E.beats.filter((b) => b.beat === 'along').map((b) => b.tile)).toEqual([[2, 1], [1, 1]]);
    expect(E.beats.filter((b) => b.beat === 'pocket').map((b) => [b.tile, b.region])).toEqual([[[1, 0], 'the pass'], [[1, 2], 'the pass']]);
    expect(E.places).toEqual([expect.objectContaining({ id: 'T-0-1', use: 'temple', N: [0, -1], region: 'the pass' })]);
  });

  it('is a gameworld level of its own: one map stage, its ends the grid\'s', () => {
    const W = { id: 'w', start: 'vale', levels: { vale: { glyphs: { tile: 32, rows: level.grid.rows, key: level.grid.key } } } };
    const S = gameStages(W);
    expect(S.map((s) => [s.node, s.section, s.manifest.kind])).toEqual([['map', 'map', 'map']]);
    const E = stageEnds(S[0].manifest);
    expect(E.exitFrom).toMatch(/temple/);
    expect(E.townDoors.map((d) => d.use)).toEqual(['temple']);
    expect(() => gameStages({ ...W, levels: { vale: { glyphs: { rows: ['# q'] } } } })).toThrow(/'q' is a place the key does not name/);
    expect(() => gameStages({ ...W, levels: { vale: { glyphs: { rows: ['# #'] }, walk: { nodes: {} } } } })).toThrow(/the map alone/);
  });
});
