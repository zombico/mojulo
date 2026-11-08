/**
 * THE COMBAT BOOK — a made game's gym, played: its first level's player (its rule, its weapon, its carried kit) and its
 * foe, measured on the runtime the game ships (measure.js) and set in the gym laid from those numbers (gym.js), the
 * readout and the laws beside them. The gameworld bible's sibling (`/api/sketches/<ref>/bible?book=combat`), as the feel
 * book is: where the feel book plays the card a game is made from, the combat book plays the game as it was made.
 *
 *   combatGame(world)        → whether a world fights with guns (game.js: its goal shoots, or it carries arms): the
 *                              readout links the book for it; the book itself asks the made level (an armed player)
 *   combatSample(payload, world)   → { minted, m, reach, gym, gate } for a level's payload, or null when its player is
 *                              not armed
 *   combatBookHtml(payload, world, { view? })   → the page ('own': the game's camera; 'other': the other one), or null
 *
 * The measures are the slow part (a few seconds a game); the route keeps the page.
 */
import { measureCombat, combatLaws, combatantsOf, armed } from './measure.js';
import { gymOf, gymPageHtml, otherCamera } from './gym.js';
export { combatGame } from './game.js';

export const BOOK_VIEWS = Object.freeze(['own', 'other']);

export function combatSample(payload, world = {}) {
  const { pilot, foe } = combatantsOf(payload);
  if (!armed(pilot)) return null;
  const m = measureCombat(pilot, foe, { feel: world.feel ?? null, camera: world.quick?.camera ?? world.camera ?? null, name: world.name ?? world.id ?? 'this game' });
  m.laws = combatLaws(m);
  return { minted: { pilot, foe, payload }, m, ...gymOf(pilot, m) };
}

export function combatBookHtml(payload, world = {}, { view = 'own' } = {}) {
  if (!BOOK_VIEWS.includes(view)) throw new Error(`combat book: view is one of ${BOOK_VIEWS.join(', ')}`);
  const S = combatSample(payload, world);
  if (!S) return null;
  const O = view === 'other' ? otherCamera(payload.camera, S.minted.pilot) : null;
  if (view === 'other' && !O) return null;
  return gymPageHtml(S.minted, S.m, S.gym, S.gate, { kind: 'combat book', tag: O ? `seen from the ${O.name}` : 'its own camera', ...(O ? { cam: O.cam, extraRule: O.rule } : {}) });
}
