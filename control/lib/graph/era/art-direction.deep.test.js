import { describe, it, expect } from 'vitest';
import { assembleStageScene, planStage, STAGE_PAGE_BUDGET } from './stage.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { collectFaceTextures } from '../landscape/surface-textures.js';
import { rollArt, ART_KITS } from './art-direction.js';
import { checkStageLaws } from './law-checks.js';
import { PRINCIPLE_LAWS } from './laws.js';
import { starter } from './entries.js';

// the rails are honest: a direction rolled anywhere inside them keeps every law its kit's card states
const CARD = { 'gothic-stone': 'crypt', catacomb: 'catacomb' };

/** The fewest seeds whose rolls, together, take every choice the facets name: one roll per distinct way a kit builds. */
const seedsCovering = (kitId, facets) => {
  const seen = new Set(), seeds = [];
  for (let seed = 1; seed <= 64; seed++) {
    const f = facets(rollArt(kitId, seed));
    if (f.some((x) => !seen.has(x))) { seeds.push(seed); f.forEach((x) => seen.add(x)); }
  }
  return seeds;
};
// the generators a surface is drawn by, the set piece, the niche head and the cluster count: each its own code path
const BUILDS = (a) => [`wall:${a.materials.wall.gen}`, `floor:${a.materials.floor.gen}`, `set:${a.doodads.setPiece}`, `niche:${a.architecture.niche.head}`, `clusters:${a.doodads.clusters}`];
// the heaviest roll a kit makes: the most clusters, then the most props, then the most niche tiers (the page's worst case)
const heaviest = (kitId) => {
  const weight = (a) => [a.doodads.clusters, a.doodads.props.length, a.architecture.niche.tiers];
  let best = 1;
  for (let seed = 2; seed <= 64; seed++) {
    const w = weight(rollArt(kitId, seed)), b = weight(rollArt(kitId, best)), k = w.findIndex((x, i) => x !== b[i]);
    if (k >= 0 && w[k] > b[k]) best = seed;
  }
  return best;
};

describe('art direction: every roll inside the rails keeps the kit\'s laws', () => {
  for (const kitId of ART_KITS) {
    it.each(seedsCovering(kitId, BUILDS))(`${kitId}, seed %i`, (seed) => {
      // two rooms keep the sweep quick; the laws are read room by room
      const m = { ...starter(kitId), reference: 'gothic-night', art: rollArt(kitId, seed) };
      m.rooms = m.rooms.slice(0, 2); m.links = m.links.slice(0, 1);
      const r = checkStageLaws(assembleStageScene(m), { only: [...new Set(PRINCIPLE_LAWS[CARD[kitId]].flat())], plan: planStage(m) });
      for (const l of r.laws) expect(l.ok, `${l.law}: ${l.why} (${m.art.palette.family})`).toBe(true);
    }, 60000);
  }
});

// the six-room starter at the top of the lift range, with the most a roll can stand in it, opens under the page budget
describe('art direction: the heaviest roll opens under the stage page budget', () => {
  for (const kitId of ART_KITS) {
    it(`${kitId}, its heaviest roll, lifted to the top of its rail`, () => {
      const art = rollArt(kitId, heaviest(kitId)); art.architecture.lift = 1.3;
      const p = assembleStageScene({ ...starter(kitId), reference: 'gothic-night', art });
      expect(emitThreeWorld({ ...p, textures: collectFaceTextures(p.faces), inline: true }).length).toBeLessThan(STAGE_PAGE_BUDGET);
    }, 120000);
  }
});
