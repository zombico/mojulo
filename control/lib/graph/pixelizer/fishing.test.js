// fishing — the reel-in minigame's core and skin: pure and deterministic, a zone held over the fish fills the meter and
// lands it, a zone left elsewhere lets it get away, a session ends after its casts, and every live frame is a valid
// pixelizer recipe.
import { describe, it, expect } from 'vitest';
import { newGame, step, FISH, ZONE } from './fishing-core.js';
import { buildWorldRecipe, resolveOverlay } from './fishing-skin.js';
import { validatePixelRecipe } from './pixelizer.js';

// a player who follows the fish: holds while the zone's middle is below it
const follow = (s) => ({ type: 'hold', on: !!s.fish && s.zone.z + ZONE / 2 < s.fish.f });
const play = (seed, mind, ms = 120000) => {
  let s = newGame(seed);
  for (let t = 0; t < ms && !s.over; t += 50) { s = step(s, mind(s)); s = step(s, { type: 'tick', dt: 50 }); }
  return s;
};

describe('fishing', () => {
  it('is pure: the same seed and the same hands land the same fish', () => {
    expect(JSON.stringify(play(7, follow))).toBe(JSON.stringify(play(7, follow)));
  });

  it('a player who follows the fish lands most of them; one who never holds loses them all; the session ends', () => {
    const good = play(3, follow), idle = play(3, () => ({ type: 'hold', on: false }));
    expect(good.over && idle.over).toBe(true);
    expect(good.caught.length).toBeGreaterThanOrEqual(3);
    expect(good.score).toBe(good.caught.reduce((s, id) => s + FISH.find((f) => f.id === id).value, 0));
    expect(idle.caught.length).toBe(0);
    expect(idle.escaped).toBe(5);
  });

  it('every live frame is a valid pixelizer recipe, and the overlay says what happened', () => {
    let s = newGame(2);
    for (let i = 0; i < 40; i++) { s = step(step(s, follow(s)), { type: 'tick', dt: 100 }); expect(validatePixelRecipe(buildWorldRecipe(s))).toEqual([]); }
    expect(resolveOverlay(s)).toMatchObject({ title: 'FISHING', status: 'playing' });
    expect(resolveOverlay(play(3, follow))).toMatchObject({ status: 'over', message: expect.stringMatching(/caught/) });
  });
});
