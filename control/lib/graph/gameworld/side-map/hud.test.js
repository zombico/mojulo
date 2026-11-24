// The side map's HUD and screens (side-map/hud.js). The concepts: a spec the runtime reads, its parts in their corners;
// the hero's column its energy (its lives a block each where it has none), a special weapon's beside it while one is
// held, the boss's at the opposite corner only while it fights; READY with the lives under it, and the keys, only while
// their latches say; the screens it holds the level for (the start menu always, GAME OVER where it continues, the intro
// card where there is a boss to introduce); a controls line read as key caps; a level of a game with a look carries it in
// the galaxy look, and one with no look carries none.
import { describe, it, expect } from 'vitest';
import { manaUi } from '../../../mana-ui/index.js';
import { sideMapHud, sideMapHudSpec, keyRowsOf, BOSS_TICKS, MENU_KEY } from './hud.js';
import { platformerGame, SIDE_MAP_LOOK } from '../platformer-game.js';
import { gameStages, stageLevelOrder } from '../levels.js';
import { SIDE_ENERGY } from './level.js';
import { THEME_CARDS, cardTheme } from '../../playscape/ui/theme-cards/loader.js';
import { readTheme, themeAdvice } from '../../../mana-ui/theme.js';

const BOSS = { id: 'boss-crucible', name: 'Crucible', hp: 300 };
const INTRO = { world: 'The foundry', name: 'Crucible', line: 'Watch the bowl.', gives: 'a molten arc', hue: '#e0661a' };
const runtime = (spec, sm) => manaUi.runtime(spec, { read: (p) => manaUi.readPath({ sm }, p), act() {}, now: () => 1 });
const view = (spec, sm) => runtime(spec, sm).view();
const sm = (o = {}) => ({ lives: 3, livesWord: '×3', energy: 28, bossOn: false, boss: 300, ready: false, keysOn: false, keys: [], moments: [], weapons: [], gate: '', keep: '', ...o });

describe('the side map\'s HUD', () => {
  it('is a spec the runtime reads, with or without a boss, an intro or a continue', () => {
    expect(() => manaUi.readSpec(sideMapHudSpec())).not.toThrow();
    expect(() => manaUi.readSpec(sideMapHudSpec({ lives: 3, energy: 28, boss: BOSS, intro: INTRO, continues: true }))).not.toThrow();
  });

  it('the hero\'s column its energy, its lives a block each where it has none; the boss\'s at the top right while it fights', () => {
    const E = view(sideMapHudSpec({ lives: 3, energy: 28 }), sm({ energy: 14 })).split('data-at="top"')[0];
    expect(E).toContain('width:50%');
    expect(E.match(/<b /g) ?? []).toHaveLength(0);              // (energy: no blocks)
    const L = view(sideMapHudSpec({ lives: 3 }), sm()).split('data-at="top"')[0];
    expect(L.match(/<b /g) ?? []).toHaveLength(2);              // (three lives: two marks between them)
    const S = sideMapHudSpec({ lives: 3, energy: 28, boss: BOSS });
    expect(view(S, sm())).not.toContain('data-variant="boss"');
    const fight = view(S, sm({ bossOn: true, boss: 150 })), tr = fight.indexOf('data-at="top-right"');
    expect(fight.slice(tr)).toContain('data-variant="boss"');
    expect(fight.slice(0, tr)).not.toContain('data-variant="boss"');
    expect(fight).not.toContain('150/300');                       // (energy is read by its length)
  });

  it('a special weapon\'s column beside the hero\'s only while one is held, filled by its energy', () => {
    const S = sideMapHudSpec({ lives: 3, energy: 28 });
    expect(view(S, sm()).split('data-at="top"')[0]).not.toContain('data-variant="mp"');
    expect(view(S, sm({ weaponOn: true, weapon: 7, weaponMax: 28 }))).toContain('width:25%');
    expect(sideMapHud({ lives: 3 }).css).toContain('var(--sm-weapon,');
  });

  it('READY with the lives under it, and the keys, only while their latches say', () => {
    const S = sideMapHudSpec({ lives: 3, energy: 28 });
    expect(view(S, sm())).not.toContain('Ready');
    expect(view(S, sm({ ready: true, livesWord: '×2' }))).toContain('×2');
    const keys = keyRowsOf('A / D  run · Space  jump');
    expect(view(S, sm({ keys }))).not.toContain('jump');
    expect(view(S, sm({ keys, keysOn: true }))).toContain('jump');
  });

  it('its screens: the start menu always, GAME OVER where it continues, the intro where there is a boss', () => {
    expect(Object.keys(sideMapHudSpec({ lives: 3 }).screens)).toEqual(['menu']);
    expect(Object.keys(sideMapHudSpec({ lives: 3, continues: true, intro: INTRO }).screens).sort()).toEqual(['intro', 'menu', 'over']);
    // the menu: the weapons (a locked slot quiet), the lives
    const rt = runtime(sideMapHudSpec({ lives: 3, energy: 28 }), sm({ weapons: [{ name: 'Buster', icon: 'target', bar: false, e: 0, max: 1, then: { emit: 'sm:equip', i: -1 } }, { name: '— — —', icon: 'lock', bar: false, e: 0, max: 1, then: { emit: 'sm:none' } }] }));
    rt.open('menu');
    expect(rt.view()).toContain('Buster');
    expect(rt.view()).toContain('×3');
    // GAME OVER: how far, what is kept, continue and give up as the bus's events
    const O = runtime(sideMapHudSpec({ lives: 3, continues: true }), sm({ gate: 'Gate 2 of 10', keep: 'Weapons' }));
    O.open('over');
    for (const w of ['Game over', 'Gate 2 of 10', 'Continue', 'Give up']) expect(O.view(), w).toContain(w);
    // the intro: the boss's name, its world, its tell, what it gives
    const N = runtime(sideMapHudSpec({ lives: 3, intro: INTRO }), sm());
    N.open('intro');
    for (const w of ['Crucible', 'The foundry', 'Watch the bowl.', 'a molten arc']) expect(N.view(), w).toContain(w);
  });

  it('reads a controls line as key caps', () => {
    expect(keyRowsOf('A / D  run · Space  jump · J  fire (hold: charge)')).toEqual([
      { actions: ['A', 'D'], label: 'run' }, { action: 'Space', label: 'jump' }, { action: 'J', label: 'fire (hold: charge)' },
    ]);
    expect(keyRowsOf('')).toEqual([]);
  });

  it('a manaHud: its feed, its columns stood up in fine ticks, what it puts away', () => {
    const H = sideMapHud({ theme: 'galaxy', lives: 3.4, energy: 28, boss: BOSS, intro: INTRO, keys: 'Space  jump', continues: true });
    expect(H.feed.sidemap).toEqual({ lives: 3, energy: 28, boss: BOSS, intro: INTRO, continues: true, slots: 8, menuKey: MENU_KEY, keys: [{ action: 'Space', label: 'jump' }] });
    expect(H.css).toContain('rotate(-90deg)');
    expect(H.css).toContain(`/ ${BOSS_TICKS})`);
    expect(H.css).toContain('.moj-c-radar');
    // (a boss with no health is no boss; an intro with no name, none; a hue not a colour, left out)
    const Z = sideMapHud({ boss: { name: 'x', hp: 0, id: 'b' }, intro: { name: '' } }).feed.sidemap;
    expect(Z.boss).toBeUndefined(); expect(Z.intro).toBeUndefined();
    expect(sideMapHud({ intro: { ...INTRO, hue: 'red' } }).feed.sidemap.intro.hue).toBeNull();
  });

  it('a side map level of a game with a look carries it, in the galaxy look, its energy and a continue', () => {
    const W = { id: 'gb', name: 'Galaxy Boy', ...platformerGame({ pole: 'galaxy-boy' }).words }, [stage] = gameStages(W);
    expect(W.ui).toEqual({ theme: SIDE_MAP_LOOK });
    expect(THEME_CARDS[SIDE_MAP_LOOK]).toMatchObject({ family: 'machine' });
    expect(themeAdvice(readTheme(cardTheme(SIDE_MAP_LOOK)))).toEqual([]);
    const m = stageLevelOrder(W, stage, { heroRef: 'hero-ref', heroStature: 1.67, ref: 'lvl' }).args.manifest;
    const F = m.manaHud.feed.sidemap;
    expect(F).toMatchObject({ lives: W.mechanics.lives, energy: SIDE_ENERGY.max, continues: true, intro: { name: 'Bulwark', gives: '' } });
    expect(F.keys.at(-1)).toEqual({ action: MENU_KEY, label: 'menu' });
    expect(m.game.mechanics.find((x) => x.kind === 'lives')).toMatchObject({ energy: { max: SIDE_ENERGY.max, hit: SIDE_ENERGY.hit }, continues: true });
    expect(() => manaUi.readSpec(m.manaHud.spec)).not.toThrow();
    const bare = { ...W }; delete bare.ui;
    const mb = stageLevelOrder(bare, gameStages(bare)[0], { heroRef: 'hero-ref', heroStature: 1.67, ref: 'lvl' }).args.manifest;
    expect(mb.manaHud).toBeUndefined();
    // (no screens to answer it: none left fails at once, as before)
    expect(mb.game.mechanics.find((x) => x.kind === 'lives').continues).toBeUndefined();
  });
});
