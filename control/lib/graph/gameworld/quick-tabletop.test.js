// The tabletop goal of the quick path: a board game lifted into a hologram arena (tabletop/holo-arena.js) is one level,
// the arena as a stage carrying the game and a hosted level's contract, and the game that plays it in the shell.
import { describe, it, expect } from 'vitest';
import { quickWorld, readQuick, tabletopArenas, QUICK_GOALS } from './quick.js';
import { runSteps } from './runner.js';
import { validateLevelContract } from '../game/level-contract.js';
import { holoArenaData } from '../tabletop/holo-arena.js';
import { quickGoalCardById } from './gameworld-cards.js';

describe('the tabletop goal', () => {
  it('reads the game, the seats and the lift; refuses what is not its own, teaching', () => {
    expect(QUICK_GOALS.tabletop).toMatch(/hologram arena/);
    expect(() => readQuick({ goal: 'tabletop', game: 'chess', players: 2, level: 'hard', lift: 'holo' })).not.toThrow();
    expect(() => readQuick({ goal: 'tabletop' })).toThrow(/game names the board game/);
    expect(() => readQuick({ goal: 'tabletop', game: 'chess', lift: 'paper' })).toThrow(/\.lift is holo/);
    expect(() => readQuick({ goal: 'tabletop', game: 'chess', hero: {} })).toThrow(/a tabletop takes goal, game, human, players, level, lift/);
    expect(() => readQuick({ goal: 'tabletop', game: 'chess', camera: 'fixed' })).toThrow(/seen from its arena's camera/);
    expect(() => readQuick({ goal: 'reach', game: 'chess' })).toThrow(/\.game belongs to the tabletop goal/);
    expect(() => readQuick({ goal: 'reach', lift: 'holo' })).toThrow(/\.lift belongs to the tabletop goal/);
  });

  it('is one level, the hologram arena carrying the game and a hosted level\'s contract, then the game in the shell', () => {
    const W = quickWorld({ id: 'kaiba-dome', seed: 3, quick: { goal: 'tabletop', game: 'checkers', players: 1, level: 'easy' } });
    const st = runSteps(W, { ref: 'gw_kd' });
    expect(st.map((s) => s.key)).toEqual(['level-arena-arena', 'game']);
    const L = st[0].order.manifest;
    expect(L).toMatchObject({ kind: 'stage', holo: { game: 'checkers', players: 1, level: 'easy', seed: 3 }, game: { levelRef: 'holo' } });
    expect(validateLevelContract(L.game, { slices: [] }).ok).toBe(true);
    expect(st[1].order).toMatchObject({ title: 'kaiba-dome', shell: 'play', levels: [{ ref: st[0].ref }] });
    // the arena's data reads the level's key as the page will
    expect(Object.values(holoArenaData(L.holo).kinds).map((k) => k.name)).toContain('man');
    expect(runSteps(W, { ref: 'gw_kd' })).toEqual(st);
    expect(tabletopArenas({ goal: 'tabletop', game: 'chess' }, { title: 'x' })[0].id).toBe('arena');
  });

  it('has its own card: the levers and the lift', () => {
    const c = quickGoalCardById('gameworld-quick-tabletop');
    expect(c.body).toContain(QUICK_GOALS.tabletop);
    expect(c.body).toMatch(/lift: holo/);
  });
});
