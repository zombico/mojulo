/**
 * THE COMIC HERO PACK'S CHARACTERS: a cast member rolled as an egocube sheet (cast.js → egocube/egocube.js), read into
 * a hero plan by the egocube's own compiler (egocube/plan.js planFromSheet: the sheet's channel notes become the door's
 * dials; the outfit it designs is replaced by the pack's suit), and dressed for one stop of the look dial (looks.js):
 * the suit for that stop's BODY (suits.js), the realistic body at the realistic stop, the standard tiered body
 * elsewhere. The hero takes the stop's LIGHT (registerOf):
 *   anime      the sheet rolled in an anime setting (egocube/setting.js), so the egocube's compiler reads it onto the
 *              anime head (its hair families, its expression amounts, anime proportions); no cube on the hero, so the
 *              anime head's character light draws it (station-loft-shade.js, a read-time default)
 *   dcau       the landmark head, the hero wearing the look's cube (`spec.geocube`), so it is baked in the same light as
 *              its world: the key, the tinted ambient, the ground's bounce and the rim (era/cast-light.js)
 *   realistic  the realistic body, as before
 * No `toon` on any member: mint_solid drops a key beside the spec, and neither register needs one.
 *
 *   rollMember(id, { seed, pole })           → the egocube sheet (deterministic in the seed); `pole` in place of the member's
 *   memberOrders(id, lookId, { seed, era, pole })  → { sheet: { facets, reading }, era, mint: { tool: 'mint_solid', args } }
 *                                            `era` a costume era (costumes.js); the look's stop suggests one (ERA_OF_STOP)
 *                                            `ensemble` the body that answers the head (ensembles.js) in place of the
 *                                            costume: an ensemble id, or 'auto' for the one the headgear calls for (HARMONY)
 *                                            `accessories` accessory cards worn over the dress (accessories.js)
 *                                            `items` item cards in the gear's slots (items.js), or 'signature' for the
 *                                            member's own (cast.js `items`); `swing` stands the hero in a swing: true for
 *                                            the word the first item card suits, or a swing word. None of the three ⇒
 *                                            the orders exactly as without them; `words` the headgear as the hero
 *                                            door's `headgear` word (headgear/wear.js) in place of the card worn
 *   bodyOf(lookId)                           → 'tiered' | 'realistic' (the look's stop's body, looks.js DIAL)
 *   registerOf(lookId)                       → { setting?, geocube? } what the stop's light asks of a roll and a spec
 *   animeHair(style, pole)                   → the anime head's family for a landmark hair style, by the egocube's
 *                                            classes (bound, mid, free: egocube/plan.js)
 */
import { rollEgocube } from '../../../egocube/egocube.js';
import { planFromSheet } from '../../../egocube/plan.js';
import { castMember } from './cast.js';
import { SUIT_KEYS } from './suits.js';
import { costumeOf, ERA_OF_STOP, ERAS } from './costumes.js';
import { withPieces } from './pieces.js';
import { withHeadgear } from '../../../headgear/cards.js';
import { withAccessories } from './accessories.js';
import { withItems, swingOf } from './items.js';
import { ensembleOf, HARMONY, SKIN_TONE } from './ensembles.js';
import { lookOf, DIAL } from './looks.js';

export const bodyOf = (lookId) => DIAL.find((d) => d.id === lookOf(lookId).stop).body;

/** The stop's light as a roll and a spec take it: the anime tradition rolls the sheet in its setting (the anime head),
 * and a look that bakes its hero (`bake`) puts its cube on the spec. Neither ⇒ {}. */
export function registerOf(lookId) {
  const L = lookOf(lookId);
  return { ...(L.hero.tradition === 'anime' ? { setting: { tradition: 'anime' } } : {}), ...(L.bake ? { geocube: L.geocube } : {}) };
}

// a landmark hair style's class (egocube/plan.js HAIR_STYLE: bound, mid, free), and the anime family each class is drawn
// in on each pole (ANIME_HAIR_STYLE there)
const HAIR_CLASS = Object.freeze({ buzz: 'bound', crew: 'bound', taper: 'bound', undercut: 'bound', bun: 'bound', ponytail: 'bound', braid: 'bound',
  crop: 'mid', quiff: 'mid', bob: 'mid', pixie: 'mid', angled: 'mid', swept: 'free', long: 'free', wavy: 'free', layers: 'free', curtains: 'free' });
const ANIME_FAMILY = Object.freeze({ male: { bound: 'short', mid: 'short', free: 'long' }, female: { bound: 'hime', mid: 'bob', free: 'long' } });
export const animeHair = (style, pole) => ANIME_FAMILY[pole === 'female' ? 'female' : 'male'][HAIR_CLASS[style] ?? 'mid'];

export function rollMember(id, { seed = 1, pole, setting } = {}) {
  const m = castMember(id);
  return rollEgocube({ brief: m.brief, facets: pole ? { ...m.facets, pole } : m.facets, seed, path: 'hero', ...(setting ? { setting } : {}) });
}

// the body words the realistic form refuses (layered.js realisticErrors): addressed on the stylized body's rings
const STYLIZED_ONLY = ['detail', 'body', 'girth', 'paint'];

export function memberOrders(id, lookId, { seed = 1, pole, era: eraIn, pieces = [], headgear = null, ensemble = null, accessories = [], items = [], swing = null, words = false } = {}) {
  const m = castMember(id), L = lookOf(lookId), body = bodyOf(lookId), R = registerOf(lookId), sheet = rollMember(id, { seed, pole, setting: R.setting });
  const era = eraIn ?? ERA_OF_STOP[L.stop];
  if (!ERAS[era]) throw new Error(`comic-hero: no era '${era}' (known: ${Object.keys(ERAS).join(', ')})`);
  const plan = planFromSheet(sheet, { dress: 'designed', title: `${m.name} (${lookId})` });
  if (plan.create.as !== 'hero') throw new Error(`comic-hero: ${id} rolled a ${plan.create.as}, not a person`);
  const spec = { ...plan.create.spec };
  for (const k of SUIT_KEYS) delete spec[k];
  // (an ENSEMBLE dresses the body in the head's language in place of the costume, tiered as the headgear is)
  const eid = ensemble === 'auto' ? HARMONY[headgear] : ensemble;
  if (ensemble && !eid) throw new Error(`comic-hero: no ensemble answers the headgear '${headgear}' (HARMONY names: ${Object.keys(HARMONY).join(', ')})`);
  if (eid && body !== 'tiered') throw new Error(`comic-hero: ensembles dress the tiered body (the look '${lookId}' is ${body})`);
  const { palette: suitPalette, ...dress } = withAccessories(withPieces(eid ? ensembleOf(eid, headgear) : costumeOf(m.suit, era, body), pieces), accessories, body);
  Object.assign(spec, dress);
  spec.palette = { ...(spec.palette || {}), ...suitPalette };
  // (a group an ensemble leaves bare takes the figure's skin: the gladiator's chest)
  for (const [g, v] of Object.entries(spec.palette)) if (v === SKIN_TONE) spec.palette[g] = spec.palette.Skin ?? '#e0b9a0';
  spec.gesture = m.gesture;
  // (an armour on the anime head goes bareheaded, as the egocube's own armour looks do: no helm is fitted to that head)
  if (spec.head === 'anime' && spec.adorn?.type === 'armor') spec.adorn = { ...spec.adorn, language: { ...(spec.adorn.language || {}), helm: 'none' } };
  if (body === 'realistic') { spec.form = 'realistic'; for (const k of STYLIZED_ONLY) delete spec[k]; }
  // (the headgear worn over a COPY: a card returns a new spec, no card the one it was given; with `words`, the hero door's
  // own word, lowered on every read as the card would have been here, so the character keeps it editable by word; a
  // card's colours sit beneath the suit's, which never name the head's groups)
  const worn = words ? (withHeadgear({ ...spec }, body, headgear), { ...spec, ...(headgear ? { headgear } : {}) }) : withHeadgear({ ...spec }, body, headgear);
  for (const k of Object.keys(spec)) delete spec[k]; Object.assign(spec, worn);
  // (the items in their slots, and a swing to stand in: absent ⇒ no `gear` key and the member's own gesture)
  const itemIds = items === 'signature' ? (m.items || []) : items == null ? [] : Array.isArray(items) ? items : [items];
  if (itemIds.length) spec.gear = withItems(spec, itemIds, body).gear;
  if (swing) {
    const word = swing === true ? swingOf(itemIds) : swing;
    if (!word) throw new Error(`comic-hero: no item card worn names a swing (items: ${itemIds.join(', ') || 'none'})`);
    spec.gesture = word;
  }
  // (the look's cube on a hero it bakes: the world's light on the figure)
  if (R.geocube) spec.geocube = R.geocube;
  // `vibe` is the hero door's own key (layered.js HERO_DOOR_KEYS) and rides INSIDE `spec`: mint_solid hands its handler
  // the spec alone (mint-solid.js mergeTop), so a key beside it is dropped without a word. No `toon` (the header)
  delete spec.toon;
  return {
    sheet: { facets: sheet.facets, reading: sheet.reading, seed: sheet.seed }, era,
    mint: { tool: 'mint_solid', args: { kind: 'layered', via: 'hero', title: plan.create.title, spec: { ...spec, vibe: m.vibe } } },
  };
}
