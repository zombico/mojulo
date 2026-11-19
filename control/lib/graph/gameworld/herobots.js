/**
 * THE HEROBOTS: the side scroller's playable heroes, each the herobot body (game-bodies.js `herobot`) in the toy suit
 * (armor/styles.js `herobot`, armor/toy.js) under the hero robot's helm (headgear/cards.js heroBotHelm, its face window
 * open: a hero's face is its own), told apart by their colours, what grows from the helm, and what they fight with.
 *
 *   galaxy-boy   blue and cyan, a red gem; the arm cannon on his right arm (the buster)
 *   zero-boy     Galaxy Boy in red, a yellow ponytail out of the helm's back, a blue gem; no cannon: a saber in his right
 *                hand (equipment/styles.js `saber`: a neon blade out of a machined hilt)
 *
 *   HEROBOTS            { <id>: { name, palette, helm?, cannon?, gear? } }
 *   herobotSpec(id)     → the hero door's spec (create_character { as: 'hero' } / mint_solid via hero)
 *
 * Pure.
 */
import { gameBody } from './game-bodies.js';
import { HEROBOT_HELM } from '../headgear/cards.js';

export const HEROBOTS = Object.freeze({
  'galaxy-boy': {
    name: 'Galaxy Boy',
    palette: { Armor: '#1f5fc8', Cuff: '#7fd4ff', Chest: '#1f5fc8', Pec: '#3f8ef2', Plaque: '#8fd6ff', Gem: '#c4122f', Top: '#4aa8ff', Bottom: '#4aa8ff', Shoes: '#1f5fc8',
      ArmorHighlight: '#a9d3ff', CuffHighlight: '#e8f8ff', GemHighlight: '#ff7d96', ChestHighlight: '#a9d3ff', PecHighlight: '#b4dcff' },
    cannon: 'R',
  },
  'zero-boy': {
    name: 'Zero Boy',
    // (Galaxy Boy's roles, in red: the armour a deep red, its cuffs and plaques a light one, the suit between them; the
    // gem blue across the wheel; the hair yellow)
    palette: { Armor: '#c41f2a', Cuff: '#ffb3a8', Chest: '#c41f2a', Pec: '#e8414a', Plaque: '#ffc2b8', Gem: '#2f7dff', Top: '#ef5a52', Bottom: '#ef5a52', Shoes: '#c41f2a',
      ArmorHighlight: '#ff9e9e', CuffHighlight: '#fff0ec', GemHighlight: '#bcd6ff', ChestHighlight: '#ff9e9e', PecHighlight: '#ff8a8a', Hair: '#f2c94c' },
    // (a ponytail out of the helm's back: the rival cast's, wild, its tie in the cuff's colour)
    helm: { ponytail: { u: 0.55, len: 0.72, r: 0.042, n: 17, spread: 0.22, back: 0.28, wild: 0.7, group: 'Hair', tie: { group: 'Cuff' } } },
    gear: { right: { item: 'sword', style: 'saber' } },
  },
});
export const HEROBOT_IDS = Object.freeze(Object.keys(HEROBOTS));

/** A herobot as the hero door makes it: the herobot body, the toy suit (its cannon where the hero has one), the hero
 * robot's helm with what grows from it, its colours, what it holds. */
export function herobotSpec(id) {
  const H = HEROBOTS[id];
  if (!H) throw new Error(`herobots: no hero '${id}' (${HEROBOT_IDS.join(', ')})`);
  const helm = { ...structuredClone(HEROBOT_HELM), signature: { ...structuredClone(HEROBOT_HELM.signature), ...structuredClone(H.helm ?? {}) } };
  return {
    ...gameBody('herobot', 'hero').spec, hair: 'none',
    adorn: { type: 'armor', style: 'herobot', ...(H.cannon ? { language: { cannon: H.cannon } } : {}), with: [helm] },
    palette: { ...H.palette },
    ...(H.gear ? { gear: structuredClone(H.gear) } : {}),
  };
}
