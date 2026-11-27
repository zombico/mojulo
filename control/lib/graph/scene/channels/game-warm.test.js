/**
 * When a level is warm (game.js GAME_WARM, warmWatch): the shell's veil lifts (MSG_SHOWN) once the level's frames are
 * steady, never while it still hitches (compiling, uploading, building the people near it), and at the cap whatever.
 * The shell is told it is warming up from the first frame.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { GAME_WARM, warmWatch } from './game.js';
import { MSG_LOADING, MSG_SHOWN } from '../../game/level-contract.js';

// (the page's frames: each the time it is drawn at, played to the watch as requestAnimationFrame would)
function play(times) {
  const said = [], queue = [];
  globalThis.window = { parent: { postMessage: (m) => said.push(m) } };
  globalThis.requestAnimationFrame = (f) => queue.push(f);
  warmWatch({ ...GAME_WARM, shown: MSG_SHOWN, loading: MSG_LOADING });
  let i = 0;
  while (queue.length && i < times.length) queue.shift()(times[i++]);
  return { said, at: i };
}
afterEach(() => { delete globalThis.window; delete globalThis.requestAnimationFrame; });
const steady = (from, n, ms) => Array.from({ length: n }, (_, k) => from + k * ms);

describe('a level warm before its veil lifts', () => {
  it('told warming up from its first frame; shown once its frames are steady, at any steady speed', () => {
    for (const ms of [16.7, 120]) {
      const { said, at } = play(steady(0, 40, ms));
      expect(said[0]).toEqual({ moj: MSG_LOADING, progress: GAME_WARM.progress, step: 'warming up' });
      expect(said.at(-1)).toEqual({ moj: MSG_SHOWN });
      expect(at).toBe(GAME_WARM.frames + 1);
    }
  });
  it('held while it hitches: a frame of 600 ms among quick ones keeps the veil up until steady frames follow it', () => {
    const times = [...steady(0, 5, 16), 664, ...steady(680, 30, 16)];
    const { said, at } = play(times);
    expect(said.at(-1)).toEqual({ moj: MSG_SHOWN });
    expect(at).toBeGreaterThan(5 + GAME_WARM.frames);
  });
  it('shown at the cap when it never steadies', () => {
    const times = Array.from({ length: 400 }, (_, k) => k * 100 + (k % 2 ? 90 : 0));
    const { said, at } = play(times);
    expect(said.at(-1)).toEqual({ moj: MSG_SHOWN });
    expect(times[at - 1]).toBeGreaterThan(GAME_WARM.most);
  });
});
