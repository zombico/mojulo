// A GAME PLAYED IN A HEADSET (`xr` at the world, and the quick game's): each stage level carries it, so its page opens a
// session that plays the game (scene/channels/xr.js). Absent, no level says it.
import { describe, it, expect } from 'vitest';
import { runSteps, readGameworld } from './index.js';
import { quickWorld, readQuick } from './quick.js';

const levelsOf = (W) => runSteps(W, { ref: 'gw' }).filter((s) => s.key.startsWith('level-'));

describe('a game played in a headset', () => {
  it('the quick game\'s xr moves up to the world, and every stage level carries it', () => {
    const W = quickWorld({ id: 'q', quick: { goal: 'reach', xr: { move: 'standing' } } });
    expect(W.xr).toEqual({ move: 'standing' });
    expect(W.quick.xr).toBeUndefined();
    expect(() => readGameworld(W)).not.toThrow();
    const L = levelsOf(W);
    expect(L.length).toBeGreaterThan(0);
    for (const s of L) expect(s.order.manifest.xr).toEqual({ move: 'standing' });
  });

  it('absent, or false, no world and no level says it', () => {
    for (const quick of [{ goal: 'reach' }, { goal: 'reach', xr: false }]) {
      const W = quickWorld({ id: 'q', quick });
      expect(W.xr).toBeUndefined();
      for (const s of levelsOf(W)) expect(s.order.manifest.xr).toBeUndefined();
    }
  });

  it('teaches what it is', () => {
    expect(() => readQuick({ goal: 'reach', xr: 'yes' })).toThrow(/\.xr is true/);
    expect(() => readGameworld({ ...quickWorld({ id: 'q', quick: { goal: 'reach' } }), xr: 'yes' })).toThrow(/gameworld: xr is true/);
  });
});
