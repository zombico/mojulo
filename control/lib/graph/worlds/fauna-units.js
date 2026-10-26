/**
 * FAUNA UNITS — a level's herds (era/biocube-fauna.js placeHerds) lowered onto the world it is resolved into: each
 * animal an `ai` body the controllable runtime walks (its mind passive: a grazer grazes, the rest wander), drawn by its
 * species' rig. The rig is built here, not stored: the species' plan bound to its skeleton with the gait it walks by and,
 * for a grazer, its eating (fauna/rig.js withMotion), resolved through the layered kind as a minted animal's is, once
 * per species and kept.
 *
 *   animalFigure({ species, gait, behaviors, reactions? })  → the packed rig figure: its gait plays the runtime's
 *                                                 `forward`, its eating `graze` (a grazer's head down in the grass), and
 *                                                 a killable one's flinch, fall and rise the runtime's `stagger`, `topple`
 *                                                 and `getup` (as a beast foe's: egocube/moves.js beastMovesOf)
 *   lowerFaunaUnits(payload)                    → the payload's `faunaUnits` taken off it and laid on: its entities after
 *                                                 the world's own, its figures beside them. None, the payload untouched
 */
import { WORLD_KINDS } from './world-kinds.js';
import { speciesPlan } from '../fauna/species.js';
import { withMotion } from '../fauna/rig.js';
import { expandPlan } from '../polygonizer/station-loft-plan.js';

// (a stride's keys: enough for a walk read across a field, a fraction of a hero's)
const KEYS = 12;
const FIGURES = new Map();

const REACT_STATES = Object.freeze({ stagger: 'flinch', topple: 'fall', getup: 'rise' });

export async function animalFigure({ species, gait, behaviors = [], reactions = [] }) {
  const key = JSON.stringify([species, gait, behaviors, reactions]);
  if (!FIGURES.has(key)) FIGURES.set(key, (async () => {
    const recipe = expandPlan(withMotion(speciesPlan(species), species, [gait], KEYS, { behaviors, reactions }));
    const scene = await WORLD_KINDS.layered.resolve({ kind: 'layered', recipe }, { title: species });
    const { preview, embodies, ...pack } = scene.figures.body;
    const reacts = Object.fromEntries(Object.entries(REACT_STATES).filter(([, w]) => pack.clips[w]).map(([st, w]) => [st, pack.clips[w]]));
    return { ...pack, clips: { ...pack.clips, forward: pack.clips[gait], ...(behaviors.includes('eat') ? { graze: pack.clips.eat } : {}), ...reacts } };
  })());
  return FIGURES.get(key);
}

export async function lowerFaunaUnits(payload) {
  const U = payload && payload.faunaUnits;
  if (!payload || !('faunaUnits' in payload)) return payload;
  delete payload.faunaUnits;
  if (!U || !U.entities?.length) return payload;
  const figures = {};
  for (const [name, spec] of Object.entries(U.figures)) figures[name] = await animalFigure(spec);
  payload.entities = [...(payload.entities || []), ...U.entities];
  payload.figures = { ...(payload.figures || {}), ...figures };
  payload.nonBakeable = true;
  return payload;
}
