// A gameworld's `juice`: its effects' floor, composed from its register (the book's direction, else the kit's pole) and
// its game type (its feel's template, else its genre's), laid on every level as fxStyle; a world that writes none is the
// world it was, and design_game's suggestion is what 'auto' would lay.

import { describe, it, expect } from 'vitest';
import { readGameworld, MEADOWMARK } from './index.js';
import { gameStages, stageLevelOrder } from './levels.js';
import { juiceOfGame, juiceSuggestion } from './juice.js';
import { resolveTrailColor } from '../scene/juice-style.js';
import { settingOfGame } from './cast-setting.js';
import { POLE_IDS, POLES } from './feel/cards.js';
import { GENRE_FLAVOR } from './feel/flavor.js';

const order = (W) => { const G = readGameworld(W), st = gameStages(W)[0]; return stageLevelOrder(G, st, { ref: 'lv_0', heroRef: 'gw-hero' }).args.manifest; };
const other = (t) => (t === 'anime' ? 'western' : 'anime');

describe('a gameworld\'s juice', () => {
  it('reads with the world, and teaches on a word it does not know', () => {
    expect(readGameworld({ ...MEADOWMARK, juice: 'auto' }).juice).toBe('auto');
    expect(readGameworld(MEADOWMARK).juice).toBeUndefined();
    expect(() => readGameworld({ ...MEADOWMARK, juice: { register: 'baroque' } })).toThrow(/juice\.register is anime \| western/);
    expect(() => readGameworld({ ...MEADOWMARK, juice: 'loud' })).toThrow(/juice is 'auto'/);
  });

  it('lays nothing on a world that writes none, or false; and the same level with fxStyle on one that does', () => {
    const plain = order(MEADOWMARK), off = order({ ...MEADOWMARK, juice: false }), on = order({ ...MEADOWMARK, juice: 'auto' });
    expect(plain.fxStyle).toBeUndefined();
    expect(JSON.stringify(off)).toBe(JSON.stringify(plain));
    expect(on.fxStyle).toEqual(juiceOfGame(readGameworld({ ...MEADOWMARK, juice: 'auto' })).fxStyle);
    const { fxStyle: _f, ...rest } = on;
    expect(JSON.stringify(rest)).toBe(JSON.stringify(plain));
  });

  it('takes the register from the book\'s direction over the kit\'s pole, and the operator\'s word over both', () => {
    const G = readGameworld({ ...MEADOWMARK, juice: 'auto' }), pole = settingOfGame(G).tradition;
    expect(juiceOfGame(G)).toMatchObject({ fxStyle: { register: pole }, from: { register: 'pole' } });
    const book = { ...G, characters: { direction: { tradition: other(pole) } } };
    expect(juiceOfGame(book)).toMatchObject({ fxStyle: { register: other(pole) }, from: { register: 'direction' } });
    expect(juiceOfGame({ ...book, juice: { register: pole, rate: 2 } })).toMatchObject({ fxStyle: { register: pole, rate: 2 }, from: { register: 'operator' } });
  });

  it('takes the game type from the feel\'s template over the genre\'s, and realistic when nothing names one', () => {
    const G = readGameworld({ ...MEADOWMARK, juice: 'auto' });
    const genre = Object.entries(GENRE_FLAVOR).find(([f]) => f === 'pinball')[1][0];
    expect(juiceOfGame({ ...G, intent: { from: genre } }).fxStyle.flavor).toBe('pinball');
    const pole = POLE_IDS.find((id) => POLES[id].base === 'platformer');
    expect(juiceOfGame({ ...G, intent: { from: genre }, feel: { pole } })).toMatchObject({ fxStyle: { flavor: 'platformer' }, from: { flavor: 'feel' } });
    expect(juiceOfGame(G).fxStyle.flavor).toBe('realistic');
  });

  it('draws an anime fighter cel-shaded and an anime RPG in the isekai look; a western game in its material', () => {
    const G = readGameworld({ ...MEADOWMARK, juice: 'auto' }), anime = { ...G, characters: { direction: { tradition: 'anime' } } };
    expect(juiceOfGame({ ...anime, intent: { from: 'versus-fighter' } })).toMatchObject({ fxStyle: { look: 'cel' }, from: { look: 'versus-fighter' } });
    expect(juiceOfGame({ ...anime, intent: { from: 'jrpg' } }).fxStyle.look).toBe('isekai');
    expect(juiceOfGame({ ...anime, characters: { direction: { tradition: 'western' } }, intent: { from: 'versus-fighter' } }).fxStyle.look).toBe('material');
    expect(juiceOfGame({ ...anime, intent: { from: 'jrpg' }, juice: { look: 'cel' } })).toMatchObject({ fxStyle: { register: 'anime', look: 'cel' }, from: { look: 'operator' } });
  });

  it('colours the swing trail from the game: its element, its power colour, its palette, or a source the caller passes', () => {
    const G = { ...readGameworld({ ...MEADOWMARK, juice: 'auto' }), characters: { direction: { tradition: 'anime', primary: 'fire', palette: ['#00ff00'] } } };
    expect(juiceOfGame(G).fxStyle.trailColor).toEqual(resolveTrailColor('#d4572a'));   // the element first (fire's tint)
    expect(juiceOfGame({ ...G, juice: { trailColor: 'power' } }).fxStyle.trailColor).toEqual([0, 1, 0]);
    expect(juiceOfGame(G, { trailColor: (c) => c.power }).fxStyle.trailColor).toEqual([0, 1, 0]);   // a function the caller passes
    expect(juiceOfGame({ ...G, characters: { direction: { tradition: 'anime' } } }).fxStyle.trailColor).toBeUndefined();   // nothing: the look's own
  });

  it('suggests what auto would lay to a world that writes none, and nothing to one that writes it or false', () => {
    const G = readGameworld(MEADOWMARK);
    expect(juiceSuggestion(G).fxStyle).toEqual(juiceOfGame({ ...G, juice: 'auto' }).fxStyle);
    expect(juiceSuggestion({ ...G, juice: false })).toBeNull();
    expect(juiceSuggestion({ ...G, juice: 'auto' })).toBeNull();
  });
});
