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
 *   quickFigure(G, quick, key, setting?)  → { spec, toon?, sheet, pending } a quick game's figure it names none of
 *                               (QUICK_FIGURES), rolled in the setting and dressed in the kit's underlayer
 *
 * Pure. A word the game does not say is left out, never guessed.
 */
import { TRADITIONS } from './characters.js';
import { kitCard, hasKitCard } from './style-guide.js';
import { UNDERLAYERS } from './hero-looks.js';
import { poleOf } from '../era/style/pole.js';
import { readSetting } from '../egocube/setting.js';
import { rollEgocube } from '../egocube/egocube.js';
import { planFromSheet, KITLESS_ERAS } from '../egocube/plan.js';
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

/**
 * The figures a quick game stands up when it names none (quick.foe, quick.tower, quick.farmhand, quick.guard): what the
 * goal asks of each (a facet, under the setting's lean for the rest) and what the play puts in its hands. Gear is a
 * myth's or a rustic world's: a modern or future one has none built yet, so its hands are left empty and it is said.
 */
export const QUICK_FIGURES = Object.freeze({
  foe:      { facets: {}, gear: { right: { item: 'dagger' } } },
  gunner:   { facets: { role: 'ranged' }, gear: { right: { item: 'bow' } } },
  tower:    { facets: { role: 'ranged' }, gear: { right: { item: 'bow' } } },
  farmhand: { facets: { role: 'non-combatant' } },
  guard:    { facets: { role: 'frontline' }, gear: { right: { item: 'sword' } } },
});

/** A quick figure rolled in the game's setting: the Egocube's person on the hero door (a blind roll is human, so it is
 * always that door), in the game's tradition, wearing what the kit's world wears beneath everything (hero-looks.js
 * UNDERLAYERS, as a book hero's base does) in the world's ramps. */
export function quickFigure(G, quick, key, setting = settingOfGame(G, quick)) {
  const F = QUICK_FIGURES[key];
  if (!F) throw new Error(`quick figure: '${key}' is not one (${Object.keys(QUICK_FIGURES).join(', ')})`);
  const seed = Number.isInteger(G.seed) ? G.seed : 1;
  const sheet = rollEgocube({ facets: F.facets, seed, path: `quick/${key}`, setting });
  const P = planFromSheet(sheet), pending = P.ledger.filter((r) => r.pending && r.from.startsWith('setting.')).map((r) => `${r.channel}: ${r.pending}`);
  let spec = P.create.spec;
  const rail = UNDERLAYERS[G.style?.kit];
  if (rail) {
    // the world's underlayer in place of the stock clothed body and the role's kit (the base a book hero wears)
    const { detail: _d, adorn: _a, ...rest } = spec;
    spec = { ...rest, outfit: { type: 'outfit', style: rail.style, dials: { ornament: 0 }, ...(Object.keys(rail.language).length ? { language: rail.language } : {}) } };
  }
  if (F.gear && KITLESS_ERAS.includes(setting.era)) pending.push(`gear: no ${setting.era} ${F.gear.right.item === 'bow' ? 'firearm' : 'weapon'} yet: the ${F.gear.right.item} is left out of its hands`);
  else if (F.gear) spec = { ...spec, gear: F.gear };
  return { spec, ...(P.create.toon ? { toon: P.create.toon } : {}), sheet: { print: fingerprint(sheet), reads: sheet.reads }, pending };
}
