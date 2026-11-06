import { describe, it, expect } from 'vitest';
import { gridEnds } from './grid-ends.js';
import { readGrid, mapStart } from './grid.js';
import { levelHeight } from '../era/out-tile.js';
import { gameStages, stageEnds } from '../gameworld/levels.js';
import { battlePlan, roomOf } from '../gameworld/battles.js';
import { readGameworld } from '../gameworld/world.js';
import { readMainQuest, mainQuestContext } from '../gameworld/main-quest.js';

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

  it('walks a bend on its arc, never across the tile\'s corner', () => {
    const E = gridEnds({ seed: 1, grid: { tile: 32, rows: ['. T .', '. # .', '. # #', '. . #'], key: { T: { use: 'temple', goal: true } } } });
    // (the L at row 2, column 2 opens west and south: its arc round its south-west corner, radius half the tile)
    const bend = E.beats.find((b) => b.tile[0] === 2 && b.tile[1] === 2).at, corner = [64, -96];
    expect(Math.hypot(bend[0] - corner[0], bend[1] - corner[1])).toBeCloseTo(16, 0);
  });

  it('is the whole chapter: its packs a stage\'s worth in each region past the town, laid along the way, none in the town', () => {
    const rows = ['. T .', '. # .', '. # .', '. # .', '. # .', '. # .', '. # .'];
    const regions = { rows: ['p p p', 'p p p', 'w w w', 'w w w', 'm m m', 't t t', 't t t'], key: { t: { name: 'the town' }, m: { name: 'the meadows' }, w: { name: 'the woods', rise: 4 }, p: { name: 'the pass', rise: 8 } } };
    const W = { id: 'w', start: 'vale', levels: { vale: { glyphs: { tile: 32, rows, key: { T: { use: 'temple', goal: true } }, regions } } }, battles: { per: 1 } };
    const S = gameStages(W), E = stageEnds(S[0].manifest);
    expect(E.home).toBe('the town');
    const plan = battlePlan(readGameworld(W), S, () => roomOf(E));
    expect(plan[0]).toHaveLength(3);
    // (a quest's beat plays a region of the map, by its name or its glyph; a region the map does not name is refused)
    const C = mainQuestContext(W), Q = (as) => ({ acts: [{ id: 'one', goal: 'go up', beats: [{ id: 'up', goal: 'climb', as }] }] });
    expect(readMainQuest(Q({ level: 'vale', region: 'w' }), C).acts[0].beats[0].as).toMatchObject({ kind: 'level', at: 'vale', region: 'the woods' });
    expect(() => readMainQuest(Q({ level: 'vale', region: 'the sea' }), C)).toThrow(/not a region of 'vale'/);
  });
});
