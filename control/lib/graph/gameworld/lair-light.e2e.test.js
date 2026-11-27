// A LAIR LIT BY ITSELF (gameworld/lair.js `cast`, worlds/world-scene.js castLight `cave`): the boss and the hero drawn
// under the cave's own rig, as the foe audit asks (foe-lit), both of a dragon's forms built lit and cast.
import { describe, it, expect } from 'vitest';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { lairStage, LAIR } from './lair.js';
import { standFoe } from './foes.js';
import { foeAudit } from './foe-audit.js';
import { DRAGON_IDS } from '../boss/dragons.js';

describe('a lair lights its bodies by its own fire', () => {
  it('a dragon in it is drawn under the cave\'s rig, both its forms', async () => {
    const G = { foes: { boss: { class: 'brute', rank: 'boss', dragon: DRAGON_IDS[0] } } };
    const S = lairStage('lvl', 1, { kind: 'boss', beat: 'climax' }, G);
    expect(S.manifest.castLight).toEqual({ cave: LAIR.cast });
    const part = { figures: {}, entities: [] };
    standFoe(G, part, { id: 'foe-boss-1', eid: 'boss', entry: G.foes.boss, at: [...LAIR.boss], heading: 0 });
    const { payload } = await resolveWorldScene({ ref: 'lair-light', title: 'lair', manifest: { ...S.manifest, figures: part.figures, entities: part.entities } });
    for (const n of ['foe-boss', 'foe-boss-risen']) {
      const F = payload.figures[n];
      expect(F.cast, n).toMatchObject({ surface: 'paint', key: { toLight: expect.any(Array) } });
      expect(F.cast.key.gain).toBeGreaterThanOrEqual(1);
    }
    const A = foeAudit(payload);
    expect(A.laws.find((l) => l.law === 'foe-lit').ok).toBe(true);
  }, 240000);
});
