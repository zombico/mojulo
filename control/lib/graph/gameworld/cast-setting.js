/**
 * THE GAME'S SETTING: what a game already says about its people, read off it once for every character rolled for it
 * (egocube/setting.js), so a farm in a sakura valley and a deathmatch on the moon each roll their own.
 *
 *   tradition   the book's direction when it names one; else the world's, by its kit's pole (characters.js TRADITIONS:
 *               banded is anime, material western), the same rule that ledgers a book hero against its world
 *   era         the kit's (ERA_OF_KIT); a kit with no row names none
 *   genre       the quick game's goal
 *   ramps       the kit card's ramps the clothes are dressed from, the world's own materials first (CLOTHES_RAMPS)
 *
 *   settingOfGame(G, quick?)  → the setting; `G` a read world (readGameworld's), `quick` the world's quick spec
 *   quickFigure(G, quick, key, setting?, { variant?, uniform? })  → { spec, toon?, sheet, pending } a quick game's figure
 *                               it names none of (QUICK_FIGURES), rolled in the setting and dressed in the kit's
 *                               underlayer; `variant` another roll of the same role, `uniform` a rank's first member's spec
 *
 * Pure. A word the game does not say is left out, never guessed.
 */
import { TRADITIONS } from './characters.js';
import { kitCard, hasKitCard } from './style-guide.js';
import { UNDERLAYERS } from './hero-looks.js';
import { poleOf } from '../era/style/pole.js';
import { readSetting } from '../egocube/setting.js';
import { rollEgocube } from '../egocube/egocube.js';
import { planFromSheet } from '../egocube/plan.js';
import { fingerprint } from './review.js';

/** The era each kit's world is in: who it has people for. A kit with no row says nothing. */
export const ERA_OF_KIT = Object.freeze({
  'isekai-meadow': 'rustic', 'isekai-sakura': 'rustic', 'isekai-bamboo': 'rustic', 'isekai-garden': 'rustic',
  'gothic-nave': 'myth', 'gothic-stone': 'myth',
  'jungle-trail': 'modern', 'trail-valley': 'modern', 'island-plaza': 'modern', 'research-lab': 'modern',
  'alien-night': 'future', 'airless-plain': 'future',
});

/** The ramps people dress in, in the order they are offered: what is made and grown before the ground and the sky. */
export const CLOTHES_RAMPS = Object.freeze(['timber', 'stone', 'foliage', 'soil', 'rock', 'grass']);

/** A game's setting, from its book, its kit and its goal. */
export function settingOfGame(G, quick = null) {
  const kit = G?.style?.kit, out = {};
  const book = G?.characters?.direction?.tradition;
  if (book) out.tradition = book;
  else if (kit) out.tradition = Object.keys(TRADITIONS).find((t) => TRADITIONS[t].pole === poleOf(kit));
  if (kit && ERA_OF_KIT[kit]) out.era = ERA_OF_KIT[kit];
  if (quick?.goal) out.genre = quick.goal;
  if (kit && hasKitCard(kit)) {
    const ramps = kitCard(kit).ramps;
    const dress = CLOTHES_RAMPS.map((name) => ramps.find((r) => r.name === name)).filter(Boolean);
    if (dress.length) out.ramps = dress.map((r) => ({ name: r.name, stops: [...r.stops] }));
  }
  return readSetting(out);
}

/** How many figures a quick game rolls for one role at most: its members cycle over them (a crowd of foes is three
 * faces, never one) */
export const CAST_POOL = 3;

/**
 * The figures a quick game stands up when it names none (quick.foe, quick.tower, quick.farmhand, quick.guard): what the
 * goal asks of each (a facet, under the setting's lean for the rest) and what the play puts in its hands: a myth's or a
 * rustic world's `gear`, a modern or a future world's its `era` row (the firearms, equipment/firearm.js; a future's in
 * its own card).
 */
const armed = (gear) => ({ modern: gear, future: Object.fromEntries(Object.entries(gear).map(([slot, g]) => [slot, { ...g, style: 'future' }])) });
export const QUICK_FIGURES = Object.freeze({
  foe:      { facets: {}, gear: { right: { item: 'dagger' } }, era: armed({ right: { item: 'pistol' } }) },
  gunner:   { facets: { role: 'ranged' }, gear: { right: { item: 'bow' } }, era: armed({ right: { item: 'carbine' } }) },
  tower:    { facets: { role: 'ranged' }, gear: { right: { item: 'bow' } }, era: armed({ right: { item: 'carbine' } }) },
  farmhand: { facets: { role: 'non-combatant' } },
  guard:    { facets: { role: 'frontline' }, gear: { right: { item: 'sword' } }, era: armed({ right: { item: 'carbine' }, hip: { item: 'pistol' } }) },
});

/** A quick figure rolled in the game's setting: the Egocube's person on the hero door (a blind roll is human, so it is
 * always that door), in the game's tradition, wearing what the kit's world wears beneath everything (hero-looks.js
 * UNDERLAYERS, as a book hero's base does) in the world's ramps. */
export function quickFigure(G, quick, key, setting = settingOfGame(G, quick), { variant = 0, uniform = null } = {}) {
  const F = QUICK_FIGURES[key];
  if (!F) throw new Error(`quick figure: '${key}' is not one (${Object.keys(QUICK_FIGURES).join(', ')})`);
  const seed = Number.isInteger(G.seed) ? G.seed : 1;
  const sheet = rollEgocube({ facets: F.facets, seed, path: variant ? `quick/${key}/${variant + 1}` : `quick/${key}`, setting });
  const P = planFromSheet(sheet), pending = P.ledger.filter((r) => r.pending && r.from.startsWith('setting.')).map((r) => `${r.channel}: ${r.pending}`);
  let spec = P.create.spec;
  const rail = UNDERLAYERS[G.style?.kit];
  if (rail) {
    // the world's underlayer in place of the stock clothed body and the role's kit (the base a book hero wears)
    // (a modern or future person's era pieces, its role's kit, are worn over it: plan.js eraOutfit)
    const { detail: _d, adorn: _a, ...rest } = spec, worn = spec.outfit?.pieces ? { pieces: spec.outfit.pieces, intent: spec.outfit.intent } : {};
    spec = { ...rest, outfit: { type: 'outfit', style: rail.style, dials: { ornament: 0 }, ...(Object.keys(rail.language).length ? { language: rail.language } : {}), ...worn } };
  }
  // a rank's member wears the first's uniform (its clothes, their colours, its kit and gear) on a face of its own
  if (uniform) {
    const { outfit: _o, detail: _d, adorn: _a, gear: _g, ...own } = spec;
    spec = { ...own, ...Object.fromEntries(['outfit', 'detail', 'adorn', 'gear'].filter((k) => uniform[k] !== undefined).map((k) => [k, uniform[k]])),
      palette: { ...own.palette, ...Object.fromEntries(['Top', 'Bottom'].filter((g) => uniform.palette?.[g]).map((g) => [g, uniform.palette[g]])) } };
    return { spec, ...(P.create.toon ? { toon: P.create.toon } : {}), sheet: { print: fingerprint(sheet), reads: sheet.reads }, pending };
  }
  const gear = F.era?.[setting.era] ?? F.gear;
  if (gear) spec = { ...spec, gear };
  return { spec, ...(P.create.toon ? { toon: P.create.toon } : {}), sheet: { print: fingerprint(sheet), reads: sheet.reads }, pending };
}
