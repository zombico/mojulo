/**
 * THE COMIC HERO PACK'S CHARACTERS: a cast member rolled as an egocube sheet (cast.js → egocube/egocube.js), read into
 * a hero plan by the egocube's own compiler (egocube/plan.js planFromSheet: the sheet's channel notes become the door's
 * dials; the outfit it designs is replaced by the pack's suit), and dressed for one stop of the look dial (looks.js):
 * the suit at that pole (suits.js), the realistic body at the material pole, and the toon the stop asks for: the
 * character light WITH ITS INK at the banded pole (vexar.js resolveToon `ink`: the silhouette hull the character book
 * never asks for), the ink alone at the painted stop, none at the material pole.
 *
 *   rollMember(id, { seed })                 → the egocube sheet (deterministic in the seed)
 *   memberOrders(id, lookId, { seed })       → { sheet: { facets, reading }, mint: { tool: 'mint_solid', args } }
 *   poleOf(lookId)                           → 'banded' | 'material' (the look's tradition's pole, characters.js TRADITIONS)
 */
import { rollEgocube } from '../../../egocube/egocube.js';
import { planFromSheet } from '../../../egocube/plan.js';
import { TRADITIONS } from '../../../gameworld/characters.js';
import { castMember } from './cast.js';
import { suitOf, SUIT_KEYS } from './suits.js';
import { lookOf } from './looks.js';

export const poleOf = (lookId) => TRADITIONS[lookOf(lookId).hero.tradition].pole;

export function rollMember(id, { seed = 1 } = {}) {
  const m = castMember(id);
  return rollEgocube({ brief: m.brief, facets: m.facets, seed, path: 'hero' });
}

// the body words the realistic form refuses (layered.js realisticErrors): addressed on the stylized body's rings
const STYLIZED_ONLY = ['detail', 'body', 'girth', 'paint'];

export function memberOrders(id, lookId, { seed = 1 } = {}) {
  const m = castMember(id), L = lookOf(lookId), pole = poleOf(lookId), sheet = rollMember(id, { seed });
  const plan = planFromSheet(sheet, { dress: 'designed', title: `${m.name} (${lookId})` });
  if (plan.create.as !== 'hero') throw new Error(`comic-hero: ${id} rolled a ${plan.create.as}, not a person`);
  const spec = { ...plan.create.spec };
  for (const k of SUIT_KEYS) delete spec[k];
  const suit = suitOf(m.suit, pole);
  const { palette: suitPalette, ...dress } = suit;
  Object.assign(spec, dress);
  spec.palette = { ...(spec.palette || {}), ...suitPalette };
  spec.gesture = m.gesture;
  if (L.hero.form === 'realistic') { spec.form = 'realistic'; for (const k of STYLIZED_ONLY) delete spec[k]; }
  // the ink's width is a share of the figure's bounding radius (scene-three.js toonInkCfg, 0.008 by default). The hull is
  // drawn round every part, the nose and the lips among them, so a bolder line (0.014 was tried) blots the face: the
  // comic page keeps the default, the painted cover draws it finer
  const toon = L.stop === 'comic' ? { light: true, ink: true } : L.stop === 'painted' ? { ink: { width: 0.005 } } : null;
  // `toon` and `vibe` are the hero door's own keys (layered.js HERO_DOOR_KEYS) and ride INSIDE `spec`: mint_solid hands
  // its handler the spec alone (mint-solid.js mergeTop), so a toon beside it is dropped without a word
  return {
    sheet: { facets: sheet.facets, reading: sheet.reading, seed: sheet.seed },
    mint: { tool: 'mint_solid', args: { kind: 'layered', via: 'hero', title: plan.create.title, spec: { ...spec, vibe: m.vibe, ...(toon ? { toon } : {}) } } },
  };
}
