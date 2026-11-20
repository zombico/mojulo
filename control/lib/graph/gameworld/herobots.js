/**
 * THE HEROBOTS: the side scroller's playable heroes, each the herobot body (game-bodies.js `herobot`) in the toy suit
 * (armor/styles.js `herobot`, armor/toy.js) under the hero robot's helm (headgear/cards.js heroBotHelm, its face window
 * open: a hero's face is its own), told apart by their colours, what grows from the helm, and what they fight with.
 *
 *   galaxy-boy   velour green, matcha and light green rims, a red gem, his suit plain (ornament 1); the School-Kid Hero
 *                face, its eyes taller and its cheeks fuller, on his own body; the arm cannon on his right arm (the buster)
 *   zero-boy     Galaxy Boy in dark indigo, lavender and light lavender rims, a gold gem, a yellow ponytail out of the
 *                helm's back, his suit and face Galaxy Boy's; no cannon: a saber in his right hand (equipment/styles.js
 *                `saber`: a neon blade out of a machined hilt)
 *
 *   HEROBOTS            { <id>: { name, palette, dials?, animeStyle?, face?, keepBody?, helm?, cannon?, gear?, variant } }
 *                       `dials` the suit's (armor expand.js: ornament 0 to 3) over the herobot style's; `animeStyle` a
 *                       head cast (polygonizer/anime-styles.js), `face` its own face words over the cast's, `keepBody`
 *                       the cast's body tune undone (its face on the hero's own body, its height in a level kept)   `variant` the feel's (feel/cards.js
 *                       galaxy-boy's variants: how the hero plays)
 *   herobotSpec(id)     → the hero door's spec (create_character { as: 'hero' } / mint_solid via hero)
 *
 * Pure.
 */
import { gameBody } from './game-bodies.js';
import { HEROBOT_HELM } from '../headgear/cards.js';
import { ANIME_STYLES } from '../polygonizer/anime-styles.js';

export const HEROBOTS = Object.freeze({
  'galaxy-boy': {
    name: 'Galaxy Boy',
    // (velour green: the armour a deep plush green, the suit between it (the lighter tone) a matcha, every rim of the
    // armour (its cuffs, its lips, the helm's window and V) a light green that catches the eye; the gem red across the wheel)
    palette: { Armor: '#2a6340', Cuff: '#c9f7a6', Chest: '#2a6340', Pec: '#3c7d52', Plaque: '#cfe6a4', Gem: '#c4122f', Top: '#9fbb64', Bottom: '#9fbb64', Shoes: '#2a6340',
      ArmorHighlight: '#78b089', CuffHighlight: '#f1fde6', GemHighlight: '#ff7d96', ChestHighlight: '#78b089', PecHighlight: '#82c18f' },
    // (its suit at ORNAMENT 1: the moulded pieces and their light rims, no plaques on the chest and belly and no thigh rims,
    // so it reads whole at a close-up as at the side map's distance)
    dials: { ornament: 1 },
    // (his FACE the School-Kid Hero cast's, a soft face to a small pointed chin, its eyes taller and its cheeks fuller
    // (`face`, over the cast's); his body his own: the cast's body tune cancelled (`keepBody`), so he stands as tall in
    // a level as he did)
    animeStyle: 'school-kid-hero', face: { eyeHeight: 1.18, cheekVolume: 1.12, lowerCheekVolume: 1.18, width: 1.03 }, keepBody: true,
    cannon: 'R', variant: 'buster',
  },
  'zero-boy': {
    name: 'Zero Boy',
    // (Galaxy Boy's roles in indigo: the armour a dark indigo, the suit between it (the lighter tone) a lavender, every
    // rim a light lavender; the gem gold across the wheel; the hair yellow)
    palette: { Armor: '#2e2a6b', Cuff: '#e2d9ff', Chest: '#2e2a6b', Pec: '#463e94', Plaque: '#d4cbf5', Gem: '#f2b630', Top: '#a99be0', Bottom: '#a99be0', Shoes: '#2e2a6b',
      ArmorHighlight: '#6f66b8', CuffHighlight: '#f6f2ff', GemHighlight: '#ffe39a', ChestHighlight: '#6f66b8', PecHighlight: '#7d72c9', Hair: '#f2c94c' },
    // (his suit plain and his face Galaxy Boy's, on his own body: the two heroes one family)
    dials: { ornament: 1 },
    animeStyle: 'school-kid-hero', face: { eyeHeight: 1.18, cheekVolume: 1.12, lowerCheekVolume: 1.18, width: 1.03 }, keepBody: true,
    // (a ponytail out of the helm's back: the rival cast's, wild, its tie in the cuff's colour)
    helm: { ponytail: { u: 0.55, len: 0.72, r: 0.042, n: 17, spread: 0.22, back: 0.28, wild: 0.7, group: 'Hair', tie: { group: 'Cuff' } } },
    gear: { right: { item: 'sword', style: 'saber' } }, variant: 'saber',
  },
});
export const HEROBOT_IDS = Object.freeze(Object.keys(HEROBOTS));

/** A herobot as the hero door makes it: the herobot body, the toy suit (its cannon where the hero has one), the hero
 * robot's helm with what grows from it, its colours, what it holds. */
export function herobotSpec(id) {
  const H = HEROBOTS[id];
  if (!H) throw new Error(`herobots: no hero '${id}' (${HEROBOT_IDS.join(', ')})`);
  const helm = { ...structuredClone(HEROBOT_HELM), signature: { ...structuredClone(HEROBOT_HELM.signature), ...structuredClone(H.helm ?? {}) } };
  // (a cast's FACE on the hero's own body: the cast's body tune undone, ratio by ratio, so its stature and build stand)
  const keep = H.animeStyle && H.keepBody ? Object.fromEntries(Object.entries(ANIME_STYLES[H.animeStyle].male.tune ?? {}).map(([k, v]) => [k, Math.round((1 / v) * 1e4) / 1e4])) : null;
  return {
    ...gameBody('herobot', 'hero').spec, hair: 'none',
    ...(H.animeStyle ? { animeStyle: H.animeStyle } : {}), ...(H.face ? { face: { ...H.face } } : {}), ...(keep ? { tune: keep } : {}),
    adorn: { type: 'armor', style: 'herobot', ...(H.dials ? { dials: { ...H.dials } } : {}), ...(H.cannon ? { language: { cannon: H.cannon } } : {}), with: [helm] },
    palette: { ...H.palette },
    ...(H.gear ? { gear: structuredClone(H.gear) } : {}),
  };
}
