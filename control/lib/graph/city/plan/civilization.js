/**
 * A CIVILIZATION AT CITY SCALE: the building language a world's civilization speaks (its anchor, decompiled by
 * era/out-town.js townLanguage into its vocabulary, proportions and ornaments) read as a city grammar document, so a
 * city in that world is built in the language its houses and castles are.
 *
 *   the base       a tiered language starts from Tokyo's grain, a shell language from the Mediterranean's (where the
 *                  organic masses grow), any other from London's; a level may name its own Earth grammar instead
 *   the roof       a gable or a hip caps the low masses with a hipped roof (steeper where the language pitches over
 *                  40°) in its covering's colours, chimneys where it has them; a language with no cap leaves them flat
 *   the walls      round-headed lights read as piers and punched windows, lenses as punched ones, banded or corniced
 *                  storeys as bands; a coursed wall brings brick into the mix
 *   the masses     a shell language swells into rippling walls and spindles, a tiered one steps back as it rises, a
 *                  crowning point raises spires
 *   the balconies  shutters become French balconies
 *
 * What the language does not say, the base grammar keeps. Pure: a language reads the same document every time.
 */
import { townLanguage } from '../../era/out-town.js';
import { structureStyle } from '../../era/out-structures.js';

// a covering's tints (era/out-structures.js COVERINGS), for the roofs it caps
const COVER_TINTS = Object.freeze({ tile: ['#9a5a3c', '#a8664a', '#8a4e36'], slate: ['#4a4f57', '#555b63', '#3f444b'], thatch: ['#9c8456', '#8a7349'], shingle: ['#6b6258', '#5f574e'] });
const coverOf = (lang) => String(lang.values?.cap?.group ?? '').replace(/^str:/, '');

/** A town language → a grammar document { from, label, … } (grammars.js holds it to the schema). */
export function grammarFromLanguage(lang, { base } = {}) {
  const V = lang.vocab ?? {}, P = lang.proportions ?? {}, orn = new Set(V.ornaments ?? []);
  const from = base ?? (V.tiers ? 'tokyo' : V.mass === 'shell' ? 'mediterranean' : 'london');
  const doc = { from, label: `${lang.id} city (${from}'s grain)`.slice(0, 80) };
  doc.facade = {
    roof: V.cap && V.cap !== 'none'
      ? { form: 'hip', p: 0.75, maxFloors: 8, on: ['stone', 'brick'], rise: (P.pitch ?? 30) >= 40 ? 1.6 : 1, tints: COVER_TINTS[coverOf(lang)] ?? ['#5d5a55', '#6a645c'], chimneys: orn.has('chimney') }
      : { p: 0 },
    ...(orn.has('shutters') ? { balcony: { p: 0.5, types: ['french'], bays: ['all'] } } : {}),
  };
  const rhythm = V.opening === 'arch' ? ['pier', 'punched'] : V.opening === 'lens' ? ['punched'] : orn.has('band') || orn.has('cornice') ? ['banded', 'grid'] : ['grid', 'punched'];
  const coursed = (lang.bonds ?? []).includes('coursed');
  doc.skin = { stoneRhythm: rhythm, mix: { glass: [0.15, 0.7, 0], stone: [1.2, 0.5, 1], brick: coursed ? [0.5, 0.2, 0.7] : [0, 0, 0] }, towerGlass: V.mass === 'shell' ? 0.2 : 0.6 };
  if (V.mass === 'shell') { doc.shapes = { box: 0.8, setback: 0.3, podium: 0.3, cylinder: 1, undulate: 3, spindle: 0.6, minFloors: 3 }; doc.tower = { spindle: 0.7 }; }
  else if (V.tiers) doc.shapes = { box: 1, setback: 4, podium: 1, cylinder: 0, minFloors: 4 };
  if (orn.has('point') && V.mass !== 'shell') doc.tower = { spindle: 0.35 };
  return doc;
}

/** A civilization's anchor (an anchor id, its elements, or a tunnelled language) on a kit → its city grammar document. */
export function civilizationGrammar(anchor, kit, seed = 1, opts = {}) {
  return grammarFromLanguage(townLanguage(structureStyle(kit, seed), anchor), opts);
}
