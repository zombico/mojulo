// Blaze Gunner's strikes drawn (scroll-pods-view.js) and the light they throw (shot-light-view.js's `more`). The concepts:
// the shot light without `more` is as it was, byte for byte (every side map's page); with it, the page's lights join the
// frame's and the strongest K are laid; the view gives the shot light its lights and draws what the runtime fires.
import { describe, it, expect } from 'vitest';
import { shotLightScript, SHOT_LIGHT_K } from './shot-light-view.js';
import { scrollPodsScript } from './scroll-pods-view.js';

describe('the strikes\' view and their light', () => {
  it('the shot light without `more` is as it was; with it the page\'s lights join and the strongest K are laid', () => {
    const plain = shotLightScript(), joined = shotLightScript({ more: '__SPV.lights' });
    expect(plain).toBe(shotLightScript({}));
    expect(plain).not.toContain('__SPV');
    expect(joined).toContain('.concat(__SPV.lights() || [])');
    expect(joined).toContain(`.slice(0, ${SHOT_LIGHT_K})`);
  });

  it('the view lights what is fired and draws the runtime\'s strikes, the foes\' fire and the impacts', () => {
    const v = scrollPodsScript();
    for (const word of ['function lights()', 'w.foeShots', 'w.podHits', 'w.podDrops', 'e.strikes', 'e.beam', 'e.orbit']) expect(v).toContain(word);
  });
});
