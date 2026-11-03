// A WALLED-CORE DUNGEON'S SPACES AS A COMPLEX: the spaces of a world's dungeon (wcd/wcd.js) that stand on one building
// level with `complex: true` become that level's buildings (network/complex.js), in the critical path's order, each of
// its use in its look; the doors between them its passages; played from the first one's front door to the last one's
// goal room (structure/level.js), the route walked by the page's ground probe over the payload's own faces and boxes;
// its network's laws advising beside the dungeon's (design_game's `advice.wcd`); drawn in plan in the book.
import { describe, it, expect } from 'vitest';
import { readGameworld, resolveLevel, MEADOWMARK } from '../gameworld/index.js';
import { gameStages, complexAdvice } from '../gameworld/levels.js';
import { withBuildingLevel } from '../structure/level.js';
import { assembleStageScene } from '../era/stage.js';
import { walker } from './walk-gate.js';
import { complexPlanSvg } from './complex-plan.js';
import { wcdPage } from '../gameworld/wcd-page.js';

const looks = { barracks: { construction: 'military', palette: 'everyday' }, command: { construction: 'science', palette: 'science' } };
// (the meadow's first level the way in; a base level the barracks and the command, the core)
const first = Object.keys(MEADOWMARK.levels)[0];
const WORLD = {
  ...MEADOWMARK,
  levels: { ...MEADOWMARK.levels, base: { building: { complex: true } } },
  links: [...(MEADOWMARK.links ?? []), { from: first, to: 'base' }],
  wcd: {
    core: 'command',
    spaces: {
      yard: { kind: 'outer', depth: 0, level: first },
      barracks: { kind: 'inner', depth: 1, level: 'base', use: 'barracks', look: looks.barracks },
      command: { kind: 'inner', depth: 2, level: 'base', use: 'command', look: looks.command },
    },
    doors: [{ from: 'yard', to: 'barracks', via: 'door' }, { from: 'barracks', to: 'command', via: 'stair', gate: { clearance: 2 } }],
  },
};

describe('a dungeon\'s spaces on one level, a complex', () => {
  const R = resolveLevel(WORLD, 'base'), stage = gameStages(WORLD).find((s) => s.level === 'base');

  it('stands each space as a building of its use in its look, in the path\'s order, beside the last; its doors the passages', () => {
    expect(R.building.complex.buildings).toEqual([
      { id: 'barracks', use: 'barracks', at: [0, 0], look: looks.barracks },
      { id: 'command', use: 'command', at: { beside: 'barracks', side: '+x' }, look: looks.command },
    ]);
    expect(R.building.complex.network).toEqual({ links: [['barracks', 'command']] });
    expect(R.building).toMatchObject({ from: 'barracks', to: 'command', use: 'command' });
    expect(stage.manifest).toMatchObject({ kind: 'stage', complex: R.building.complex, level: { from: 'barracks', to: 'command' } });
  });

  it('is played from the first one\'s front door, down, through the passage, up to the core\'s goal room: no step over a riser, no wall, no gap, no box', () => {
    const L = withBuildingLevel(stage.manifest, 'base-ref'), exit = L.game.mechanics.at(-1), eye = L.entities[0].rule.eye;
    expect(exit.kind).toBe('reach-exit');
    expect(L.entities[0].rule.probe).toBeGreaterThan(0);
    const P = assembleStageScene(stage.manifest, {}), pos = L.entities[0].transform.pos;
    const r = walker(P)([[pos[0], pos[1], pos[2] - eye], ...exit.via, [exit.at[0], exit.at[1], exit.at[2] - eye]]);
    expect({ steepest: r.steepest <= 0.36, crossed: r.crossed, gaps: r.gaps, boxes: r.boxes }).toEqual({ steepest: true, crossed: [], gaps: [], boxes: [] });
    // (won upstairs in the core: its goal room's floor, over the yard)
    expect(r.end).toBeCloseTo(exit.at[2] - eye, 1);
    expect(r.end).toBeGreaterThan(1);
  });

  it('advises its network\'s laws beside the dungeon\'s, and is drawn in plan in the book', () => {
    expect(complexAdvice(WORLD)).toEqual([]);
    const cut = { ...WORLD, levels: { ...WORLD.levels, base: { building: { complex: { network: { links: [] } } } } } };
    const said = complexAdvice(cut);
    expect(said.some((s) => s.startsWith('base: complex-reached:'))).toBe(true);
    expect(said.some((s) => s.startsWith('base: complex-route:') && /no passage leads from 'barracks' to 'command'/.test(s))).toBe(true);
    const svg = complexPlanSvg(stage.manifest, 300);
    for (const w of ['barracks (barracks) · in', 'command (command) · goal', 'stroke-dasharray']) expect(svg).toContain(w);
    // (the rings name the door between its two buildings a passage, the door in from the meadow by its via)
    const page = wcdPage(readGameworld(WORLD), (x) => String(x));
    expect(page).toContain('passage · CL-2');
    expect(page).toContain('door · open');
  });
});

describe('a building level among a dungeon\'s spaces', () => {
  it('takes the space of its use where several stand on it, and its space\'s use when it names none', () => {
    const W = { ...WORLD, levels: { ...WORLD.levels, base: { building: { use: 'command', seed: 2 } } } };
    expect(resolveLevel(W, 'base').building.look).toEqual(looks.command);
    const bare = { ...WORLD, levels: { ...WORLD.levels, base: { building: { seed: 2 } } } };
    expect(resolveLevel(bare, 'base').building).toMatchObject({ use: 'barracks', look: looks.barracks });
  });

  it('refuses a complex it cannot stand, by name', () => {
    const with_ = (base, wcd = WORLD.wcd) => readGameworld({ ...WORLD, levels: { ...WORLD.levels, base }, wcd });
    expect(() => with_({ building: { complex: { roads: 1 } } })).toThrow(/building.complex.roads is not a complex setting/);
    expect(() => with_({ building: { complex: true, use: 'command' } })).toThrow(/a complex is its buildings'/);
    const noUse = { ...WORLD.wcd, spaces: { ...WORLD.wcd.spaces, barracks: { ...WORLD.wcd.spaces.barracks, use: undefined } } };
    expect(() => resolveLevel({ ...WORLD, wcd: noUse }, 'base')).toThrow(/space 'barracks' on this level names no use/);
    expect(() => resolveLevel({ ...WORLD, levels: { ...WORLD.levels, base: { building: { complex: { to: 'mess' } } } } }, 'base')).toThrow(/complex.to 'mess' is not one of its buildings/);
  });
});
