// The finishes of a building level (finishes.js): what each surface will wear, read off the stage it is built as, toned
// when the level is, with its light; on the level's page of the book and beside its layer on the dungeon's page.
import { describe, expect, it } from 'vitest';
import { finishesOf, finishesHtml, finishesCss } from './finishes.js';
import { buildingStage } from './levels.js';
import { gameworldBibleHtml, esc } from './bible-html.js';
import { MEADOWMARK } from './index.js';
import { CONSTRUCTIONS } from '../era/style/bay-axes.js';
import { BASE_USES } from '../era/programs.js';

const use = BASE_USES.find((u) => u === 'armoury') ?? BASE_USES[0];
const stage = (look, more = {}) => buildingStage({ use, seed: 3, ...(look ? { look } : {}), ...more });

describe('the finishes', () => {
  it('are the look the stage is built in: its construction\'s cuts, at the metres they are laid at', () => {
    const F = finishesOf(stage({ construction: 'bunker', palette: 'military' }));
    expect(F.axes).toMatchObject({ construction: 'bunker', palette: 'military' });
    const wall = F.tiles.find((t) => t.role === 'wall');
    expect(wall.cut).toBe(CONSTRUCTIONS.bunker.surfaces.wall[0].dressed.cut);
    expect(wall.metres).toBe(CONSTRUCTIONS.bunker.surfaces.wall[0].metres);
    expect(F.light.length).toBeGreaterThan(0);
    // another construction, other materials; the same stage, the same finishes
    const other = finishesOf(stage({ construction: 'military', palette: 'military' }));
    expect(other.tiles.find((t) => t.role === 'wall').id).not.toBe(wall.id);
    expect(finishesOf(stage({ construction: 'bunker', palette: 'military' }))).toEqual(F);
  });

  it('take the level\'s tone, and say when its palette does not colour a bay building', () => {
    const look = { construction: 'bunker', palette: 'military' };
    const plain = finishesOf(stage(look)), toned = finishesOf(stage(look, { tone: 'noir' }));
    expect(toned.toned).toBe(true);
    expect(toned.tiles.find((t) => t.role === 'wall').id).not.toBe(plain.tiles.find((t) => t.role === 'wall').id);
    expect(finishesOf(stage(look), { palette: { seed: 4 } }).dropped).toBe(true);
    expect(plain.dropped).toBe(false);
    expect(finishesHtml(finishesOf(stage(look), { palette: { seed: 4 } }), esc)).toContain('does not colour a bay building');
  });

  it('carry a tile shown twice once', () => {
    const F = finishesOf(stage({ construction: 'bunker', palette: 'military' }));
    const css = finishesCss([F, F]);
    for (const t of F.tiles) expect(css.split(`.${t.id}{`).length).toBe(2);
  });

  it('are in the book on a building level, and beside its layer on the dungeon\'s page; a world with none has none', () => {
    const W = { ...MEADOWMARK, levels: { ...MEADOWMARK.levels, armoury: { name: 'Armoury', building: { use, seed: 3 } } },
      wcd: { core: 'armoury', spaces: { armoury: { kind: 'inner', depth: 0, level: 'armoury', look: { construction: 'bunker', palette: 'military' } } }, doors: [] } };
    const book = gameworldBibleHtml(W);
    expect(book).toContain('<h4>Its finishes</h4>');
    expect(book).toMatch(/<span class="fin-row"><i class="fin-/);
    expect(gameworldBibleHtml(MEADOWMARK)).not.toContain('.fin{');
  });
});
