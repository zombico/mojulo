// The side map's HUD (side-map/hud.js). The concepts: a spec the runtime reads, its parts in their corners; the hero's
// energy a column split into its lives, the boss's beside it only while it fights, its name said as it comes in; READY
// and the keys only while their latches say; a controls line read as key caps; a level of a game with a look carries it
// in the galaxy look, and one with no look carries none.
import { describe, it, expect } from 'vitest';
import { manaUi } from '../../../mana-ui/index.js';
import { sideMapHud, sideMapHudSpec, keyRowsOf, BOSS_TICKS } from './hud.js';
import { platformerGame, SIDE_MAP_LOOK } from '../platformer-game.js';
import { gameStages, stageLevelOrder } from '../levels.js';
import { THEME_CARDS, cardTheme } from '../../playscape/ui/theme-cards/loader.js';
import { readTheme, themeAdvice } from '../../../mana-ui/theme.js';

const BOSS = { id: 'boss-crucible', name: 'Crucible', hp: 300 };
const view = (spec, sm) => manaUi.runtime(spec, { read: (p) => manaUi.readPath({ sm }, p), act() {}, now: () => 1 }).view();
const sm = (o = {}) => ({ lives: 3, bossOn: false, boss: 300, ready: false, keysOn: false, keys: [], moments: [], ...o });

describe('the side map\'s HUD', () => {
  it('is a spec the runtime reads, with or without a boss', () => {
    expect(() => manaUi.readSpec(sideMapHudSpec())).not.toThrow();
    expect(() => manaUi.readSpec(sideMapHudSpec({ lives: 3, boss: BOSS }))).not.toThrow();
  });

  it('the hero\'s column split into its lives; the boss\'s beside it only while it fights', () => {
    const S = sideMapHudSpec({ lives: 3, boss: BOSS });
    const quiet = view(S, sm()).split('data-at="top"')[0];
    expect(quiet).toContain('data-variant="hp"');
    expect(quiet.match(/<b /g) ?? []).toHaveLength(2);           // (three lives: two marks between them)
    expect(quiet).not.toContain('data-variant="boss"');
    const fight = view(S, sm({ bossOn: true, boss: 150 }));
    expect(fight).toContain('data-variant="boss"');
    expect(fight).toContain('width:50%');
    // (no figures on either: energy is read by its length)
    expect(fight).not.toContain('3/3');
    expect(fight).not.toContain('150/300');
    // (a level with no boss draws no boss column, ever)
    expect(view(sideMapHudSpec({ lives: 3 }), sm({ bossOn: true }))).not.toContain('data-variant="boss"');
  });

  it('READY and the keys only while their latches say', () => {
    const S = sideMapHudSpec({ lives: 3 });
    expect(view(S, sm())).not.toContain('Ready');
    expect(view(S, sm({ ready: true }))).toContain('Ready');
    const keys = keyRowsOf('A / D  run · Space  jump');
    expect(view(S, sm({ keys }))).not.toContain('jump');
    expect(view(S, sm({ keys, keysOn: true }))).toContain('jump');
  });

  it('reads a controls line as key caps', () => {
    expect(keyRowsOf('A / D  run · Space  jump · J  fire (hold: charge)')).toEqual([
      { actions: ['A', 'D'], label: 'run' }, { action: 'Space', label: 'jump' }, { action: 'J', label: 'fire (hold: charge)' },
    ]);
    expect(keyRowsOf('')).toEqual([]);
  });

  it('a manaHud: its feed, its columns stood up in fine ticks, what it puts away', () => {
    const H = sideMapHud({ theme: 'galaxy', lives: 3.4, boss: BOSS, keys: 'Space  jump' });
    expect(H.feed.sidemap).toEqual({ lives: 3, boss: BOSS, keys: [{ action: 'Space', label: 'jump' }] });
    expect(H.css).toContain('rotate(-90deg)');
    expect(H.css).toContain(`/ ${BOSS_TICKS})`);
    expect(H.css).toContain('.moj-c-radar');
    // (a boss with no id or no health is no boss)
    expect(sideMapHud({ boss: { name: 'x', hp: 0, id: 'b' } }).feed.sidemap.boss).toBeUndefined();
  });

  it('a side map level of a game with a look carries it, in the galaxy look', () => {
    const W = { id: 'gb', name: 'Galaxy Boy', ...platformerGame({ pole: 'galaxy-boy' }).words }, [stage] = gameStages(W);
    expect(W.ui).toEqual({ theme: SIDE_MAP_LOOK });
    expect(THEME_CARDS[SIDE_MAP_LOOK]).toMatchObject({ family: 'machine' });
    expect(themeAdvice(readTheme(cardTheme(SIDE_MAP_LOOK)))).toEqual([]);
    const m = stageLevelOrder(W, stage, { heroRef: 'hero-ref', heroStature: 1.67, ref: 'lvl' }).args.manifest;
    expect(m.manaHud.feed.sidemap.lives).toBe(W.mechanics?.lives ?? 3);
    expect(() => manaUi.readSpec(m.manaHud.spec)).not.toThrow();
    const bare = { ...W }; delete bare.ui;
    expect(stageLevelOrder(bare, gameStages(bare)[0], { heroRef: 'hero-ref', heroStature: 1.67, ref: 'lvl' }).args.manifest.manaHud).toBeUndefined();
  });
});
