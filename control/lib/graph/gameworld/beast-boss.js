/**
 * A BEAST BOSS'S FIGURE — a vehicle boss of the boss shelf drawn as a beast (boss/vehicles.js, a row with a `figure`: the
 * hydra), built from the fauna it is grown from and its row's own words: each head's colour (its part's) and each turn's
 * times (boss/vehicles.js turnTimes: its strike as the move lands, its head hung low through the move's opening, where
 * a blade reaches it).
 *
 *   beastBossFigure(id, { lit? }) → the figure a page carries under the boss's name (boss/stand.js vehicleEntity);
 *                       `lit`, read for the cast rig (its colour under no light)
 *   beastPalette(id)    its colours as the cast rig reads a body's
 *   BEAST_MAKERS        { <figure>: { species, gait } }   what each beast is grown from
 *   dragonPrimaryFigure(id) → a dragon's primary form (boss/dragons.js): the beast on four legs its two-legged form
 *                       (dragonFigure) rises from, wearing that form's head, wings and ridge in its colours
 *                       (figures/dragon-primary.js)
 *   dragonFormFigure(id, form, { lit? }) → its 'primary' form, or its 'risen' (the two-legged form grown to stand beside
 *                       it: the same head, the same wings), the figure its rise swaps onto its body (boss/dragons.js);
 *                       `lit`, read for the cast rig (its colour under no light, its normals)
 *   dragonPalette(id)   its colours as the cast rig reads a body's
 *
 * The serpent's rig is the slow part (animalFigure keeps it). Pure but for that.
 */
import { readVehicle, turnTimes } from '../boss/vehicles.js';
import { animalFigure } from '../worlds/fauna-units.js';
import { hydraFigure } from '../figures/hydra.js';
import { DRAGONS, dragonFigure } from '../boss/dragons.js';
import { dragonPrimary, dragonRisen, PRIMARY } from '../figures/dragon-primary.js';
import { beastWords } from '../beast/tiered.js';
import { withDefaultForm } from '../polygonizer/motion-stamp.js';

export const BEAST_MAKERS = Object.freeze({ hydra: Object.freeze({ species: 'seaSerpent', gait: 'swim' }) });

export async function beastBossFigure(id, { lit = false } = {}) {
  const V = readVehicle(id), M = BEAST_MAKERS[V.figure];
  if (!M) throw new Error(`beast boss: the ${id} is drawn by '${V.figure}', which no maker builds (${Object.keys(BEAST_MAKERS).join(', ')})`);
  // (its heads: the states that are a part's turn, in the ring's order; each one's colour and times)
  const turns = Object.entries(V.states).filter(([, s]) => s.head), heads = turns.map(([st]) => st);
  const colours = Object.fromEntries(turns.map(([st, s]) => [st, V.parts[s.head].colour]).filter(([, c]) => c));
  const times = Object.fromEntries(heads.map((st) => [st, turnTimes(V, st)]));
  return hydraFigure(await animalFigure({ ...M, ...(lit ? { lit: true } : {}) }), { heads, colours, turns: times, ...(V.body ? { body: V.body } : {}) });
}

const risenOf = async (id, lit) => {
  // (the hero door, loaded when asked: the page that stands a beast boss is that door's own)
  const { heroFigure } = await import('../worlds/world-scene.js');
  return heroFigure(id, { hero: beastWords(withDefaultForm({ form: 'tiered', ...dragonFigure(id) })) }, lit ? { lit: true } : {});
};
const dragonOf = (id) => { const D = DRAGONS[id]; if (!D) throw new Error(`beast boss: no dragon '${id}' (${Object.keys(DRAGONS).join(', ')})`); return D; };

export async function dragonPrimaryFigure(id, { lit = false } = {}) {
  const D = dragonOf(id);
  return dragonPrimary(await risenOf(id, lit), await animalFigure({ species: PRIMARY.species, gait: PRIMARY.gait, ...(lit ? { lit: true } : {}) }), { scales: D.scales, horns: D.horns });
}

export async function dragonFormFigure(id, form, { lit = false } = {}) {
  if (form === 'primary') return dragonPrimaryFigure(id, { lit });
  if (form === 'risen') { dragonOf(id); return dragonRisen(await risenOf(id, lit)); }
  throw new Error(`beast boss: a dragon's form is 'primary' or 'risen', not '${form}'`);
}

export const beastPalette = (id) => { const V = readVehicle(id), b = V.body ?? '#808080'; return { Top: b, Bottom: b, Skin: b }; };

/** A dragon's colours as the cast rig reads a body's (its bulk its scales, color-theorist/cast-rig-core.js). */
export const dragonPalette = (id) => { const D = dragonOf(id); return { Top: D.scales, Bottom: D.scales, Skin: D.scales, Wings: D.wings, Horns: D.horns }; };
