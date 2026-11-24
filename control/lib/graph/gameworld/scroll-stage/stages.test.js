// Blaze Gunner's stages (scroll-stage/stages.js): a stage is a recipe in the scroll stage's words. The concepts: every
// stage reads (its words are the scroll stage's); its sections run in order along it, each adding one thing; a carrier
// brings a pod in every section but the boss's; its boss is a hull on the play plane the track holds the screen for.
import { describe, it, expect } from 'vitest';
import { STAGES, STAGE_IDS, stageManifest, bossOf } from './stages.js';
import { readScrollStage, scrollStageOf } from './stage-scene.js';

describe('the stages', () => {
  it('every stage reads in the scroll stage\'s words', () => {
    for (const id of STAGE_IDS) expect(readScrollStage(stageManifest(id).scroll)).toEqual([]);
  });

  it('its sections run in order along it, a carrier bringing a pod in each before the boss\'s', () => {
    for (const id of STAGE_IDS) {
      const S = STAGES[id], from = S.sections.map((x) => x.from);
      expect(from).toEqual([...from].sort((a, b) => a - b));
      const carries = S.scroll.waves.filter((w) => w.carries).map((w) => w.at);
      for (let k = 0; k < S.sections.length - 2; k++) expect(carries.some((a) => a >= from[k] && a < from[k + 1]), `${id}: ${S.sections[k].name}`).toBe(true);
    }
  });

  it('its boss is a hull on the play plane the track holds the screen for', () => {
    for (const id of STAGE_IDS) {
      const boss = bossOf(STAGES[id]), G = scrollStageOf(stageManifest(id));
      expect(boss).toBeTruthy();
      expect(G.plane.map((h) => h.id)).toContain(boss);
    }
  });

  it('refuses a stage it does not have, teaching', () => {
    expect(() => stageManifest('stage-99')).toThrow(/is not a stage/);
  });
});
