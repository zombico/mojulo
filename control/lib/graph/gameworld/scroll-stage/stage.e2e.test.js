// Blaze Gunner's stages, played (scroll-stage/bot.js): each stage resolved as its page resolves it (the world scene: its
// hulls on the play plane breakable by rupa) and played to its end by the bot on the rules it ships. The concepts: the
// stage is cleared (the track run to its end, its boss down, the ship up) with hp to spare; the foes are fought, not
// only passed; at no moment is the screen filled past what a player reads; the same stage plays the same way.
import { describe, it, expect } from 'vitest';
import { STAGE_IDS, stageManifest } from './stages.js';
import { stageSpec, playScrollStage } from './bot.js';
import { SHIP_HP } from './stage-scene.js';
import { DENSITY } from './patterns.js';

describe('the stages, played', () => {
  for (const id of STAGE_IDS) {
    it(`${id} is cleared by the bot with hp to spare, the same way each time`, async () => {
      const spec = await stageSpec(stageManifest(id)), R = playScrollStage(spec);
      expect(R.cleared, JSON.stringify(R)).toBe(true);
      expect(R.hp).toBeGreaterThanOrEqual(SHIP_HP / 2);
      expect(R.foes.down / R.foes.of).toBeGreaterThan(0.5);
      expect(R.peak).toBeLessThanOrEqual(DENSITY);
      expect(playScrollStage(await stageSpec(stageManifest(id)))).toEqual(R);
    }, 120000);
  }
});
