// headgear/wear — the hero door's `headgear` WORD: a headgear card's id (cards.js HEADGEAR: a mask, a cowl, eyegear, a
// mouthpiece, a helmet, a respirator, a visor) or a helmet by tradition (helmets.js HELMETS), stored on the hero as the
// word and lowered on every read (layered.js heroPlanOf, beside a sport's kit), so an edit to the word re-dresses the
// hero. A card's colours sit beneath the operator's palette (a palette that names a card's group recolours it). Absent,
// the hero as it is, every byte.
//
// A card is worn on the BODY the hero has (the realistic form, else the game body) and refuses a body it is not fitted to
// by name. A helmet by tradition is worn as an outfit build's `language.head` (its cover, band, net and mount kept when
// the language already names them), so it needs an outfit build.
//
//   HEADGEAR_WORDS              every word the door takes
//   headgearBody(hero)          'realistic' | 'tiered'
//   headgearErrors(word, spec)  error strings (empty: the word is worn)
//   wearHeadgear(hero)          the hero record with its word lowered (no `headgear` key), or the record as given
//   headgearOf(word)            { word, family, reads, fits: [bodies], tradition? } or null
import { HEADGEAR, HEADGEAR_IDS, withHeadgear } from './cards.js';
import { HELMETS } from './helmets.js';
import { resolveHair } from '../polygonizer/humanoid-hair.js';

export const HEADGEAR_WORDS = Object.freeze([...HEADGEAR_IDS, ...Object.keys(HELMETS)]);
const BODIES = ['tiered', 'realistic'];
export const headgearBody = (hero) => (hero?.form === 'realistic' ? 'realistic' : 'tiered');
const isOutfitBuild = (O) => !!O && typeof O === 'object' && !Array.isArray(O) && O.type === 'outfit';

/** a word's card as the vocabulary reads it */
export function headgearOf(word) {
  if (HEADGEAR[word]) return { word, family: HEADGEAR[word].family, reads: HEADGEAR[word].reads, fits: BODIES.filter((b) => typeof HEADGEAR[word].at[b] === 'function') };
  if (HELMETS[word]) return { word, family: 'helmet', reads: HELMETS[word].reads, fits: ['tiered'], tradition: true };
  return null;
}

// the nearest word to a miss (an edit distance over the lower-cased words), so a typo is answered with the word
function nearest(w) {
  const d = (a, b) => { const r = Array.from({ length: b.length + 1 }, (_, j) => j); for (let i = 1; i <= a.length; i++) { let p = r[0]; r[0] = i; for (let j = 1; j <= b.length; j++) { const t = r[j]; r[j] = Math.min(r[j] + 1, r[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; } } return r[b.length]; };
  const best = HEADGEAR_WORDS.map((k) => [k, d(w.toLowerCase(), k.toLowerCase())]).sort((a, b) => a[1] - b[1])[0];
  return best && best[1] <= Math.max(2, Math.floor(w.length / 3)) ? best[0] : null;
}

/** Error strings for a `headgear` word on a hero spec (empty when it is worn). */
export function headgearErrors(word, spec = {}) {
  if (word === undefined || word === null) return [];
  const where = "the words: get_solid_vocab({ id: 'headgear' })";
  if (typeof word !== 'string') return [`headgear: a word (a mask, a cowl, eyegear, a helmet …; ${where})`];
  const H = headgearOf(word);
  if (!H) { const n = nearest(word); return [`headgear: no headgear '${word}'${n ? ` (did you mean ${n}?)` : ''}; ${where}`]; }
  const body = headgearBody(spec);
  if (!H.fits.includes(body)) return [`headgear: '${word}' is not fitted to the ${body} body (fits: ${H.fits.join(', ')})`];
  if (H.tradition && !isOutfitBuild(spec.outfit)) return [`headgear: '${word}' is a helmet by tradition, worn on an outfit build as its language's head: give the hero an outfit build (outfit: { type: 'outfit', style })`];
  try { wearHeadgear({ ...spec, headgear: word }); } catch (err) { return [err.message]; }
  return [];
}

/** The hero (a record or a spec) wearing its `headgear` word: the card lowered onto it and the word dropped. A helmet's
 * dropped hair is stored as the record stores a style (resolved) on the landmark head. No word: the hero as given. */
export function wearHeadgear(hero) {
  if (!hero || hero.headgear === undefined || hero.headgear === null) return hero;
  const { headgear: word, ...rest } = hero;
  if (HELMETS[word] && !HEADGEAR[word]) {
    const O = rest.outfit;
    if (!isOutfitBuild(O)) throw new Error(headgearErrors(word, rest)[0]);
    const L = O.language || {}, head = L.head && typeof L.head === 'object' ? { ...L.head, helmet: word } : word;
    return { ...rest, outfit: { ...O, language: { ...L, head } } };
  }
  const worn = withHeadgear(rest, headgearBody(rest), word);
  // (the card's colours beneath the operator's own palette, as a sport's kit's are)
  if (rest.palette) worn.palette = { ...worn.palette, ...rest.palette };
  // (the record stores the landmark head's hair resolved: a helm's 'none' as the record would have stored it)
  if (worn.hair === 'none' && (rest.head ?? 'landmark') === 'landmark' && rest.hair && typeof rest.hair === 'object') return { ...worn, hair: resolveHair('none') };
  return worn;
}
