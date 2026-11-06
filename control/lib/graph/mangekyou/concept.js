/**
 * THE CONCEPT — a variation asked for in words, read as weights on the axes and the way each should lean. The words
 * are the designer's; nothing refuses an unread word, it is carried with the order as context. A concept that names no
 * axis turns every axis the design has.
 *
 *   readConcept(text) → { weights: { axis: 0..1 }, lean: { light, chroma, size, detail }, heard: [word…], moods: [id…] }
 *     lean: -1..1 per direction (darker → light -1; bigger → size +1), 0 when the concept says nothing of it
 */
import { AXES } from './leaves.js';

// a word heard → the axes it turns (weight) and the way it leans
const LEXICON = [
  { re: /\b(colou?rs?|palettes?|hues?|recolou?r\w*|palette.?swap\w*|tints?|liver(y|ies)|colou?rways?|paint\w*)\b/i, axes: { colour: 1 } },
  { re: /\b(dark\w*|shadow\w*|night\w*|sinister|gloom\w*|grim)\b/i, axes: { colour: 0.8 }, lean: { light: -1 } },
  { re: /\b(light(er)?|bright\w*|pale\w*|pastel\w*|sunn?y|holy|radiant)\b/i, axes: { colour: 0.8 }, lean: { light: 1 } },
  { re: /\b(vivid|saturated|loud|neon|garish|punchy)\b/i, axes: { colour: 0.8 }, lean: { chroma: 1 } },
  { re: /\b(muted|desaturat\w*|washed|dusty|faded|drab|subtle)\b/i, axes: { colour: 0.8 }, lean: { chroma: -1 } },
  { re: /\b(sizes?|scales?|bigger|larger|huge|giant|massive|hulking|towering)\b/i, axes: { size: 1 }, lean: { size: 1 } },
  { re: /\b(smaller|tiny|little|mini\w*|runts?|petite|compact)\b/i, axes: { size: 1 }, lean: { size: -1 } },
  { re: /\b(silhouettes?|shapes?|outlines?|proportions?|forms?|profiles?|spik\w*|horn\w*|lanky|squat|stocky|lean|bulk\w*|chunky|sleek|angular|round\w*)\b/i, axes: { silhouette: 1 } },
  { re: /\b(textures?|surfaces?|finish\w*|materials?|treatments?|skins?|coats?|worn|weather\w*|rust\w*|polish\w*|glossy|matte|corrupt\w*|rott\w*|crystal\w*|frost\w*|fire|flam\w*|venom\w*|elemental|ooz\w*|mutat\w*)\b/i, axes: { surface: 1 } },
  { re: /\b(details?|ornate|ornament\w*|decorat\w*|elaborate|fancy|regal|royal|elite|boss|champion)\b/i, axes: { detail: 1 }, lean: { detail: 1 } },
  { re: /\b(plain|simple|stripped|minimal\w*|bare|grunt|basic|cheap)\b/i, axes: { detail: 1 }, lean: { detail: -1 } },
  { re: /\b(re-?rolls?|random\w*|wild\w*|different|anything|surprise|chaos|kaleidoscope|mangekyou)\b/i, axes: { roll: 1, colour: 0.5, silhouette: 0.5, surface: 0.5 } },
  { re: /\b(tiers?|ranks?|factions?|teams?|famil(y|ies)|variants?|versions?|takes?|options?)\b/i, axes: { colour: 0.6, surface: 0.5, detail: 0.4, size: 0.3 } },
];

// moods: whole concepts a designer names, each a preset of weights and leans (a new mood is a row)
const MOODS = [
  { id: 'corrupted', re: /\b(corrupt\w*|tainted|blighted|infected|undead|zombi\w*|rott\w*|cursed)\b/i, axes: { colour: 1, surface: 1, silhouette: 0.5 }, lean: { light: -0.6, chroma: -0.3 } },
  { id: 'elemental', re: /\b(elemental|elements?|fire|ice|frost|storm|venom|crystal)\b/i, axes: { colour: 1, surface: 1 }, lean: { chroma: 0.5 } },
  { id: 'tiered', re: /\b(tiers?|ranks?|elite|champion|boss|upgrades?|evolv\w*)\b/i, axes: { colour: 0.8, size: 0.8, detail: 1 }, lean: { size: 0.6, detail: 0.8 } },
  { id: 'faction', re: /\b(factions?|teams?|liver(y|ies)|clans?|houses?|uniforms?|colou?rways?)\b/i, axes: { colour: 1, surface: 0.4 } },
  { id: 'regional', re: /\b(regional|biomes?|climates?|desert|arctic|jungle|swamp|tundra|volcanic)\b/i, axes: { colour: 1, surface: 0.8, silhouette: 0.4 } },
];

/** The concept's words, read. */
export function readConcept(text = '') {
  const t = String(text ?? '');
  const weights = Object.fromEntries(AXES.map((a) => [a, 0]));
  const lean = { light: 0, chroma: 0, size: 0, detail: 0 };
  const heard = [], moods = [];
  const take = (row) => {
    for (const [a, w] of Object.entries(row.axes)) weights[a] = Math.max(weights[a], w);
    for (const [k, v] of Object.entries(row.lean ?? {})) lean[k] = Math.max(-1, Math.min(1, lean[k] + v));
  };
  for (const row of LEXICON) { const m = t.match(row.re); if (m) { heard.push(m[0].toLowerCase()); take(row); } }
  for (const row of MOODS) if (row.re.test(t)) { moods.push(row.id); take(row); }
  // a concept that names no axis turns every axis the design has (the kaleidoscope whole)
  if (AXES.every((a) => weights[a] === 0)) for (const a of AXES) weights[a] = a === 'roll' ? 0.6 : 1;
  return { weights, lean, heard: [...new Set(heard)], moods };
}
