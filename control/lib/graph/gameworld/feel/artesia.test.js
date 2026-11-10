import { describe, it, expect } from 'vitest';
import { poleCard } from './cards.js';
import { suggestFeels, feelSuggestion } from './suggest.js';

// FABLE OF ARTESIA (the practice room, 1108): the action-adventure's sword between Ebon Spirits (the Souls knight) and
// Fallen Angel (the stylish action game), on every dial that tells the three apart.
const between = (x, a, b) => x > Math.min(a, b) && x < Math.max(a, b);
describe('the Zelda-like template', () => {
  it('stands between the knight and the stylish game: the run, the gather, the first cut, the freeze', () => {
    const [K, Z, D] = ['ebon-spirits', 'fable-of-artesia', 'fallen-angel'].map((id) => poleCard(id));
    const dials = (c) => ({ run: c.ground.run, accel: c.ground.accel, commit: c.jump.commit, height: c.jump.height, startup: c.moves.string[0].startup, freeze: c.hit.hitstop.max });
    const [k, z, d] = [K, Z, D].map(dials);
    for (const key of Object.keys(z)) expect([key, between(z[key], k[key], d[key])]).toEqual([key, true]);
    // (a sword and shield's: a string of three, the shield's perfect guard, no air string and no dash)
    expect(Z.moves.string).toHaveLength(3);
    expect(Z.guard.perfect).toBeTruthy();
    expect(Z.air).toBeNull(); expect(Z.dash).toBeNull();
  });

  it('is what a Zelda-like brief or an adventure points at', () => {
    expect(suggestFeels('a zelda-like with a sword and shield')[0].pole).toBe('fable-of-artesia');
    expect(feelSuggestion({ intent: { from: 'top-down-adventure' } })).toMatchObject({ feel: 'fable-of-artesia', from: 'genre' });
  });
});
