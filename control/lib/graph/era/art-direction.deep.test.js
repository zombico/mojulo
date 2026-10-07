import { describe, it, expect } from 'vitest';
import { assembleStageScene } from './stage.js';
import { rollArt, ART_KITS } from './art-direction.js';
import { checkStageLaws } from './law-checks.js';
import { PRINCIPLE_LAWS } from './laws.js';
import { starter } from './entries.js';

// the rails are honest: a direction rolled anywhere inside them keeps every law its kit's card states
const CARD = { 'gothic-stone': 'crypt', catacomb: 'catacomb' };
const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233];

describe('art direction: every roll inside the rails keeps the kit\'s laws', () => {
  for (const kitId of ART_KITS) {
    it.each(SEEDS)(`${kitId}, seed %i`, (seed) => {
      // two rooms keep the sweep quick; the laws are read room by room
      const m = { ...starter(kitId), reference: 'gothic-night', art: rollArt(kitId, seed) };
      m.rooms = m.rooms.slice(0, 2); m.links = m.links.slice(0, 1);
      const r = checkStageLaws(assembleStageScene(m), { only: [...new Set(PRINCIPLE_LAWS[CARD[kitId]].flat())] });
      for (const l of r.laws) expect(l.ok, `${l.law}: ${l.why} (${m.art.palette.family})`).toBe(true);
    }, 60000);
  }
});
