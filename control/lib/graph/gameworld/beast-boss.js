/**
 * A BEAST BOSS'S FIGURE — a vehicle boss of the boss shelf drawn as a beast (boss/vehicles.js, a row with a `figure`: the
 * hydra), built from the fauna it is grown from and its row's own words: each head's colour (its part's) and each turn's
 * times (boss/vehicles.js turnTimes: its strike as the move lands, its head hung low through the move's opening, where
 * a blade reaches it).
 *
 *   beastBossFigure(id) → the figure a page carries under the boss's name (boss/stand.js vehicleEntity)
 *   BEAST_MAKERS        { <figure>: { species, gait } }   what each beast is grown from
 *
 * The serpent's rig is the slow part (animalFigure keeps it). Pure but for that.
 */
import { readVehicle, turnTimes } from '../boss/vehicles.js';
import { animalFigure } from '../worlds/fauna-units.js';
import { hydraFigure } from '../figures/hydra.js';

export const BEAST_MAKERS = Object.freeze({ hydra: Object.freeze({ species: 'seaSerpent', gait: 'swim' }) });

export async function beastBossFigure(id) {
  const V = readVehicle(id), M = BEAST_MAKERS[V.figure];
  if (!M) throw new Error(`beast boss: the ${id} is drawn by '${V.figure}', which no maker builds (${Object.keys(BEAST_MAKERS).join(', ')})`);
  // (its heads: the states that are a part's turn, in the ring's order; each one's colour and times)
  const turns = Object.entries(V.states).filter(([, s]) => s.head), heads = turns.map(([st]) => st);
  const colours = Object.fromEntries(turns.map(([st, s]) => [st, V.parts[s.head].colour]).filter(([, c]) => c));
  const times = Object.fromEntries(heads.map((st) => [st, turnTimes(V, st)]));
  return hydraFigure(await animalFigure(M), { heads, colours, turns: times });
}
