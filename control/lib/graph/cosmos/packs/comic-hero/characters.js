/**
 * THE COMIC HERO PACK'S CHARACTERS: a cast member rolled as an egocube sheet (cast.js → egocube/egocube.js), read into
 * a hero plan by the egocube's own compiler (egocube/plan.js planFromSheet: the sheet's channel notes become the door's
 * dials; the outfit it designs is replaced by the pack's suit), and dressed for one stop of the look dial (looks.js):
 * the suit for that stop's BODY (suits.js), the realistic body at the realistic stop, the standard tiered body
 * elsewhere. Never cel shaded: no character light and no ink on any member (the world carries the register; the hero
 * is shaded smooth, as the tiered body is by default, or lit on material on the realistic one).
 *
 *   rollMember(id, { seed })                 → the egocube sheet (deterministic in the seed)
 *   memberOrders(id, lookId, { seed, era })  → { sheet: { facets, reading }, era, mint: { tool: 'mint_solid', args } }
 *                                            `era` a costume era (costumes.js); the look's stop suggests one (ERA_OF_STOP)
 *   bodyOf(lookId)                           → 'tiered' | 'realistic' (the look's stop's body, looks.js DIAL)
 */
import { rollEgocube } from '../../../egocube/egocube.js';
import { planFromSheet } from '../../../egocube/plan.js';
import { castMember } from './cast.js';
import { SUIT_KEYS } from './suits.js';
import { costumeOf, ERA_OF_STOP, ERAS } from './costumes.js';
import { lookOf, DIAL } from './looks.js';

export const bodyOf = (lookId) => DIAL.find((d) => d.id === lookOf(lookId).stop).body;

export function rollMember(id, { seed = 1 } = {}) {
  const m = castMember(id);
  return rollEgocube({ brief: m.brief, facets: m.facets, seed, path: 'hero' });
}

// the body words the realistic form refuses (layered.js realisticErrors): addressed on the stylized body's rings
const STYLIZED_ONLY = ['detail', 'body', 'girth', 'paint'];

export function memberOrders(id, lookId, { seed = 1, era: eraIn } = {}) {
  const m = castMember(id), L = lookOf(lookId), body = bodyOf(lookId), sheet = rollMember(id, { seed });
  const era = eraIn ?? ERA_OF_STOP[L.stop];
  if (!ERAS[era]) throw new Error(`comic-hero: no era '${era}' (known: ${Object.keys(ERAS).join(', ')})`);
  const plan = planFromSheet(sheet, { dress: 'designed', title: `${m.name} (${lookId})` });
  if (plan.create.as !== 'hero') throw new Error(`comic-hero: ${id} rolled a ${plan.create.as}, not a person`);
  const spec = { ...plan.create.spec };
  for (const k of SUIT_KEYS) delete spec[k];
  const { palette: suitPalette, ...dress } = costumeOf(m.suit, era, body);
  Object.assign(spec, dress);
  spec.palette = { ...(spec.palette || {}), ...suitPalette };
  spec.gesture = m.gesture;
  if (body === 'realistic') { spec.form = 'realistic'; for (const k of STYLIZED_ONLY) delete spec[k]; }
  // `vibe` is the hero door's own key (layered.js HERO_DOOR_KEYS) and rides INSIDE `spec`: mint_solid hands its handler
  // the spec alone (mint-solid.js mergeTop), so a key beside it is dropped without a word. No `toon`: never cel shaded
  delete spec.toon;
  return {
    sheet: { facets: sheet.facets, reading: sheet.reading, seed: sheet.seed }, era,
    mint: { tool: 'mint_solid', args: { kind: 'layered', via: 'hero', title: plan.create.title, spec: { ...spec, vibe: m.vibe } } },
  };
}
