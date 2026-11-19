// The bosses (gameworld/bosses.js): robots of the hero's family whose faces are never a person's. The concepts: a boss's
// face shuts the hero's window and keeps its eyes in the signal (a closed helm's face and an object head's alike); the
// hero's own helm, its window open, is the one a boss may not wear; a boss is the hero door's spec, the herobot body in the
// toy suit at its build, its helm the suit's `with`, its identity hue on its chest and its signal its eyes'; the same boss,
// the same spec.
import { describe, it, expect } from 'vitest';
import { BOSSES, BOSS_FACES, SIGNAL } from './bosses.js';
import { bossHelm, bossSpec, bossFaceFaults } from './boss-spec.js';
import { HEROBOT_HELM } from '../headgear/cards.js';
import { heroRecord } from '@/lib/mcp/tools/layered.js';

const kitOf = (helm) => ({ adorn: { type: 'armor', style: 'herobot', with: [helm] } });

describe('the bosses', () => {
  it('a face shuts the window and keeps its eyes in the signal: a closed helm\'s, an object head\'s', () => {
    // (one closed helm's face and the object head: the two procedures)
    const object = Object.keys(BOSS_FACES).find((f) => BOSS_FACES[f].helm.pool), closed = Object.keys(BOSS_FACES).find((f) => !BOSS_FACES[f].helm.pool);
    for (const f of [closed, object]) {
      const H = bossHelm(f);
      expect(H.signature.window).toBeUndefined();
      expect(H.signature.visorGroup).toBe(SIGNAL);
      expect(bossFaceFaults(kitOf(H))).toEqual([]);
    }
  });
  it('the hero\'s own helm, its window open, is the one a boss may not wear', () => {
    expect(bossFaceFaults(kitOf(HEROBOT_HELM)).join(' ')).toMatch(/window/);
    expect(bossFaceFaults({ adorn: [] }).join(' ')).toMatch(/no helm/);
  });
  it('a boss is the hero door\'s spec: the herobot body in the toy suit at its build, its colours its own', () => {
    const [id] = Object.keys(BOSSES), B = BOSSES[id], S = bossSpec(id);
    expect(S).toMatchObject({ proportions: 'herobot', cast: { build: B.build }, adorn: { type: 'armor', style: 'herobot' } });
    expect(S.palette).toMatchObject({ Armor: B.armor, Pec: B.hue, [SIGNAL]: B.signal });
    expect(bossFaceFaults(S)).toEqual([]);
    expect(() => heroRecord(S)).not.toThrow();
    expect(bossSpec(id)).toEqual(S);
  });
});
