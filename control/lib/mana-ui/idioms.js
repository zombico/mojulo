/**
 * MANA-UI's IDIOMS — the screens and HUD parts games share, as compositions of the components (defs: data, never code).
 * A game uses one by name and passes what it reads; the idiom says what it emits through the effects its rows and
 * inputs carry. A new idiom is a def first, a component only when no composition can draw it.
 *
 *   idioms-front.js   the front and the menus: attract, title, loading, mode / character / arena select, pause,
 *                     options, controls, confirm, results, save
 *   idioms-rpg.js     the deep menus: party, skill tree, level up, loadout, inventory, shop, quest log, dialogue
 *   idioms-hud.js     in-game: vitals, objective, compass, minimap, ammo, score, prompt, feed, crosshair, a moment, the
 *                     party strip; the enemies: plates, a boss bar, a target frame, damage numbers
 *
 *   IDIOMS        name → { kind: 'screen' | 'hud', about, reads, emits, params, node, example, waits? } (waits: the param
 *                 that must be true before a screen has anything to press, a loading screen's ready)
 *   IDIOM_IDS · SCREEN_IDIOMS · HUD_IDIOM_IDS
 *   withIdioms(spec)   → the spec with the idioms among its defs (its own defs win on a shared name)
 */
import { FRONT_IDIOMS } from './idioms-front.js';
import { RPG_IDIOMS } from './idioms-rpg.js';
import { HUD_IDIOMS } from './idioms-hud.js';

export const IDIOMS = Object.freeze({ ...FRONT_IDIOMS, ...RPG_IDIOMS, ...HUD_IDIOMS });
export const IDIOM_IDS = Object.keys(IDIOMS);
export const SCREEN_IDIOMS = IDIOM_IDS.filter((k) => IDIOMS[k].kind === 'screen');
export const HUD_IDIOM_IDS = IDIOM_IDS.filter((k) => IDIOMS[k].kind === 'hud');

/** The spec with the idioms among its defs; the spec's own defs win on a shared name. */
export function withIdioms(spec) {
  const defs = {};
  for (const [k, v] of Object.entries(IDIOMS)) defs[k] = { params: v.params, node: v.node };
  return { ...spec, defs: { ...defs, ...(spec && spec.defs) } };
}
