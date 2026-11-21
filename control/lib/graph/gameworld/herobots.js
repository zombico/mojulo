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
 *   astro-girl   Zero Boy's sister and Galaxy Boy's co-star: his indigo, lavender and gold and his saber, on her own figure
 *                (the female cast, slimmer and longer at the boys' height, the hips flared by a short skirt in place of the
 *                brief), the kid cast's face made a girl's (larger almond eyes set wider under a lash flicked at its
 *                tail, thinner brows, a smaller nose and mouth, a softer jaw to a small chin), twin tails out of the
 *                helm and swept-back fins at its ears
 *
 *   HEROBOTS            { <id>: { name, palette, dials?, cast?, animeStyle?, face?, sculpt?, keepBody?, tune?, helm?, language?, cannon?, gear?, variant } }
 *                       `cast` the figure's (female: her body and her head's pole), `sculpt` its own sculpt words over the
 *                       cast's, `tune` its own body ratios over what keepBody keeps, `language` the toy suit's words
 *                       (armor/toy.js TOY_WORDS: a heroine's `brief: 'skirt'`)
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
  'astro-girl': {
    name: 'Astro Girl',
    // (her brother's colours, every role the same: the dark indigo armour, the lavender suit, the light lavender rims, the
    // gold gem, the yellow hair)
    palette: { Armor: '#2e2a6b', Cuff: '#e2d9ff', Chest: '#2e2a6b', Pec: '#463e94', Plaque: '#d4cbf5', Gem: '#f2b630', Top: '#a99be0', Bottom: '#a99be0', Shoes: '#2e2a6b',
      ArmorHighlight: '#6f66b8', CuffHighlight: '#f6f2ff', GemHighlight: '#ffe39a', ChestHighlight: '#6f66b8', PecHighlight: '#7d72c9', Hair: '#f2c94c' },
    dials: { ornament: 1 },
    // (HER FIGURE: the female cast, at the boys' height (keepBody), slimmer through the shoulders and the waist, the arms
    // finer, the legs a little longer, the hips wider: a heroine's line where theirs is a boy's block)
    cast: 'female', keepBody: true, tune: { shoulders: 0.9, waist: 0.92, hips: 1.05, upperArm: 0.9, forearm: 0.92, legs: 1.04, torso: 0.96 },
    // (HER FACE the kid cast's, her brothers' family, made a girl's: the eyes larger and set wider, almond under a heavier
    // lash flicked at its tail, the brows thinner and straighter, the nose smaller, the mouth narrower, the jaw softer
    // into a small chin, the cheeks round)
    animeStyle: 'school-kid-hero', face: { eyeHeight: 1.26, eyeWidth: 1.03, spacing: 1.04, iris: 1.1, chin: 0.78, jaw: 0.92, cheekVolume: 1.12, lowerCheekVolume: 1.14, width: 1.02, nose: 0.8, browDepth: 0.88 },
    sculpt: { lidWeight: 1.18, lidTail: 1.06, lidFlick: 12, lidAngle: -3, browThick: 0.85, browAngle: -2, tipProjection: 1.15, mouthWidth: 1.02 },
    // (TWIN TAILS out of the helm, long, swung out either side of the back, their ties in the rims' colour; FINS swept back
    // off the helm at her ears, in the rims' colour)
    helm: { ponytail: { u: 0.62, len: 0.9, r: 0.036, n: 11, spread: 0.16, back: 0.22, wild: 0.35, twin: 0.85, group: 'Hair', tie: { group: 'Cuff' } },
      horns: { u: 0.52, a: 1.58, len: 0.16, r: 0.02, out: 0.5, up: 0.7, back: 1.4, bend: 0.3, squash: [1, 0.3], group: 'Cuff' } },
    language: { brief: 'skirt', chest: 'bodice' },
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
  const pole = H.cast === 'female' ? 'female' : 'male';
  const keep0 = H.animeStyle && H.keepBody ? Object.fromEntries(Object.entries(ANIME_STYLES[H.animeStyle][pole]?.tune ?? {}).map(([k, v]) => [k, Math.round((1 / v) * 1e4) / 1e4])) : null;
  // (the hero's own body ratios over what keepBody keeps: a heroine's line, ratio by ratio)
  const keep = keep0 || H.tune ? Object.fromEntries([...new Set([...Object.keys(keep0 ?? {}), ...Object.keys(H.tune ?? {})])].map((k) => [k, Math.round((keep0?.[k] ?? 1) * (H.tune?.[k] ?? 1) * 1e4) / 1e4])) : null;
  const language = { ...(H.language ?? {}), ...(H.cannon ? { cannon: H.cannon } : {}) };
  return {
    ...gameBody('herobot', 'hero').spec, hair: 'none', ...(H.cast ? { cast: H.cast } : {}),
    ...(H.animeStyle ? { animeStyle: H.animeStyle } : {}), ...(H.face ? { face: { ...H.face } } : {}), ...(H.sculpt ? { sculpt: { ...H.sculpt } } : {}), ...(keep ? { tune: keep } : {}),
    adorn: { type: 'armor', style: 'herobot', ...(H.dials ? { dials: { ...H.dials } } : {}), ...(Object.keys(language).length ? { language } : {}), with: [helm] },
    palette: { ...H.palette },
    ...(H.gear ? { gear: structuredClone(H.gear) } : {}),
  };
}
