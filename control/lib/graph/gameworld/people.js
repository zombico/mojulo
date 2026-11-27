/**
 * THE PEOPLE OF A STREET — who walks a played town's or district's pavements. Each is the hero door's own person: rolled
 * by the world's keys in its setting (egocube, through cast-setting.js quickFigure: the same body, skeleton, clothes and
 * palette a hero is made of), carried in the level inline (never minted or stored), baked at the play grade and SAMPLED
 * AGAIN to a crowd's budget (figures/crowd-figure.js, a figure's `crowd: true`). A street REUSES them: a few people are
 * rolled, and every walker wears one of them at a height of its own, so a pavement of thirty is a handful of bakes.
 *
 *   PEOPLE                 how many are rolled, a crowd figure's triangles, how far a walker's height varies
 *   PERSON                 a rolled person's figure name: `person-<n>` (what a scene's walkers wear: world-kinds.js)
 *   streetPeople(G, setting?, { sets? })  → { figures: { 'person-1': { hero, grade, crowd, budget }, … }, reads: [what
 *                            each is] }: `sets` sixes of different people (PEOPLE.pool each; geocity/crowd.js), one
 *   peopleExtra(G, { sets?, realistic?, locale? }) → (ends) → { figures, entities: [] } | null: a stage extra (stage-figures.js) for a stage
 *                            that has pavements walked (a town's, a district's)
 *
 * Pure: the same world rolls the same people.
 */
import { quickFigure, settingOfGame } from './cast-setting.js';
import { streetSix } from './street-cast.js';

export const PEOPLE = Object.freeze({ pool: 6, budget: 8000, height: 0.06 });
export const PERSON = /^person-\d+$/;

export function streetPeople(G, setting = settingOfGame(G, null), { sets = 1, realistic = false, locale = null } = {}) {
  const figures = {}, reads = [];
  // (REALISTIC people, a level's `people: 'realistic'` (geocity/crowd.js): the street's cast a six at a time
  // (gameworld/street-cast.js streetSix: the realistic body and face in everyday clothes), each drawn at the realistic
  // crowd grade, a near figure and a far one (figures/crowd-figure.js realCrowdFigure, worlds/world-scene.js))
  if (realistic) {
    const seed = Number.isInteger(G.seed) ? G.seed : 1;
    for (let set = 0; set < sets; set++) for (const [k, P] of streetSix(seed, { locale, set }).entries()) {
      figures[`person-${set * PEOPLE.pool + k + 1}`] = { hero: P.spec, grade: 'play', crowd: 'real' };
      reads.push([P.label]);
    }
    return { figures, reads };
  }
  // (a six of different people a set, geocity/crowd.js: a busy district rolls two sets, a packed one three)
  for (let i = 0; i < PEOPLE.pool * sets; i++) {
    const F = quickFigure(G, null, 'farmhand', setting, { path: `street/${i + 1}` });
    figures[`person-${i + 1}`] = { hero: F.spec, grade: 'play', crowd: true, budget: PEOPLE.budget };
    reads.push(F.sheet.reads);
  }
  return { figures, reads };
}

export function peopleExtra(G, { sets = 1, realistic = false, locale = null } = {}) {
  return () => ({ figures: streetPeople(G, settingOfGame(G, null), { sets, realistic, locale }).figures, entities: [] });
}
