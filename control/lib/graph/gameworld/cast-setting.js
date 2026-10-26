/**
 * THE GAME'S SETTING: what a game already says about its people, read off it once for every character rolled for it
 * (egocube/setting.js), so a farm in a sakura valley and a deathmatch on the moon each roll their own.
 *
 *   tradition   the book's direction when it names one; else the world's, by its kit's pole (characters.js TRADITIONS:
 *               banded is anime, material western), the same rule that ledgers a book hero against its world. How a
 *               body is DRAWN; a fighter's own `tradition` (versus-traditions.js) is how it strikes, another word
 *   era         the kit's (ERA_OF_KIT); a kit with no row names none. A palette or a look recolours the kit under an id
 *               of its own (world.js looksOfKit): its era and pole are still the stock kit's it was made from
 *   genre       the quick game's goal
 *   ramps       the kit card's ramps the clothes are dressed from, the world's own materials first (CLOTHES_RAMPS): the
 *               look's own, so a palette's colours dress them
 *
 *   settingOfGame(G, quick?)  → the setting; `G` a read world (readGameworld's), `quick` the world's quick spec
 *   quickFigure(G, quick, key, setting?, { variant?, uniform?, colours?, paint? })  → { spec, toon?, sheet, pending } a
 *                               quick game's figure it names none of (QUICK_FIGURES), rolled in the setting and dressed
 *                               in the kit's underlayer (a role with a `kit` of its own, the athlete, in that); `variant`
 *                               another roll of the same role, `uniform` a rank's first member's spec, `colours` what a
 *                               side wears ({ Top?, Bottom? } over the roll's), `paint` the role kit's paint words instead
 *
 * Pure. A word the game does not say is left out, never guessed.
 */
import { TRADITIONS } from './characters.js';
import { kitCard, hasKitCard } from './style-guide.js';
import { UNDERLAYERS } from './hero-looks.js';
import { poleOf } from '../era/style/pole.js';
import { readSetting } from '../egocube/setting.js';
import { rollEgocube } from '../egocube/egocube.js';
import { planFromSheet, KIT_ERAS } from '../egocube/plan.js';
import { fingerprint } from './review.js';
import { looksOfKit } from './world.js';

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
// the stock kit a world's look was composed from (a palette or a look registers an id of its own over it, base first)
const stockKit = (kit) => looksOfKit(kit)?.[0]?.base ?? kit;

export function settingOfGame(G, quick = null) {
  const kit = G?.style?.kit, stock = kit && stockKit(kit), out = {};
  const book = G?.characters?.direction?.tradition;
  if (book) out.tradition = book;
  else if (kit) out.tradition = Object.keys(TRADITIONS).find((t) => TRADITIONS[t].pole === poleOf(stock));
  if (stock && ERA_OF_KIT[stock]) out.era = ERA_OF_KIT[stock];
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
  // a sport's player (contest/athletes.js): a grown person in the sport's own kit whatever the world's wardrobe: on the
  // authored body the kit painted on the bare body (hero-dress.js PAINT_WORDS, a second skin that fits every cast), on
  // the realistic body the outfit card (outfit/styles.js), whose garments take the body's suit off
  athlete:  { facets: { age: 'adult' }, kit: { paint: ['tank', 'bikeShorts', 'socks'], outfit: 'athlete' } },
});

const ATHLETE_SHOES = '#f0f0ee';
/** A quick figure rolled in the game's setting: the Egocube's person on the hero door (a blind roll is human, so it is
 * always that door), in the game's tradition, wearing what the kit's world wears beneath everything (hero-looks.js
 * UNDERLAYERS, as a book hero's base does) in the world's ramps. */
export function quickFigure(G, quick, key, setting = settingOfGame(G, quick), { variant = 0, uniform = null, colours = null, paint = null } = {}) {
  const F = QUICK_FIGURES[key];
  if (!F) throw new Error(`quick figure: '${key}' is not one (${Object.keys(QUICK_FIGURES).join(', ')})`);
  const seed = Number.isInteger(G.seed) ? G.seed : 1;
  const sheet = rollEgocube({ facets: F.facets, seed, path: variant ? `quick/${key}/${variant + 1}` : `quick/${key}`, setting });
  const P = planFromSheet(sheet), pending = P.ledger.filter((r) => r.pending && r.from.startsWith('setting.')).map((r) => `${r.channel}: ${r.pending}`);
  let spec = P.create.spec;
  // (a modern or future person dresses as its rolled look, egocube/outfit.js ERA_LOOKS: the look is its world's wardrobe,
  // so the kit's underlayer is not laid over it)
  const rail = F.kit || KIT_ERAS.includes(setting.era) ? null : UNDERLAYERS[G.style?.kit];
  if (F.kit) {
    // the role's own clothes in place of the world's: the clothes the roll would wear, their kit and gear and the look's
    // silhouette go; the roll's colours dress the kit, a side's over them
    const { detail: _d, adorn: _a, gear: _g, stylism: _s, outfit: _o, paint: _p, ...rest } = spec;
    const wear = rest.form === 'realistic' ? { outfit: { type: 'outfit', style: F.kit.outfit } } : { detail: 'swimsuit', paint: paint ?? F.kit.paint };
    // (the bare body's swimwear beneath the kit, where the paint leaves a band of it, is the shorts' colour; the shoes are
    // the sport's white unless the roll names its own)
    const palette = { Shoes: ATHLETE_SHOES, ...rest.palette, ...(colours ?? {}) };
    spec = { ...rest, ...wear, palette: wear.detail && palette.Bottom ? { ...palette, Swim: palette.Bottom } : palette };
  }
  if (rail) {
    // the world's underlayer in place of the stock clothed body and the role's kit (the base a book hero wears)
    const { detail: _d, adorn: _a, ...rest } = spec;
    spec = { ...rest, outfit: { type: 'outfit', style: rail.style, dials: { ornament: 0 }, ...(Object.keys(rail.language).length ? { language: rail.language } : {}) } };
  }
  // a rank's member wears the first's uniform (its clothes, their colours, its kit and gear) on a face of its own
  if (uniform) {
    // (the silhouette too, and the look's owned tones: a rank of troopers is one plate, one helm)
    const { outfit: _o, detail: _d, adorn: _a, gear: _g, stylism: _s, paint: _p, ...own } = spec;
    const { Outer: _out, Emblem: _em, Shoes: _sh, ...ownPalette } = own.palette;
    spec = { ...own, ...Object.fromEntries(['outfit', 'detail', 'adorn', 'gear', 'stylism', 'paint'].filter((k) => uniform[k] !== undefined).map((k) => [k, uniform[k]])),
      palette: { ...ownPalette, ...Object.fromEntries(['Top', 'Bottom', 'Outer', 'Emblem', 'Shoes'].filter((g) => uniform.palette?.[g]).map((g) => [g, uniform.palette[g]])) } };
    return { spec, ...(P.create.toon ? { toon: P.create.toon } : {}), sheet: { print: fingerprint(sheet), reads: sheet.reads }, pending };
  }
  const gear = F.era?.[setting.era] ?? F.gear;
  if (gear) spec = { ...spec, gear };
  return { spec, ...(P.create.toon ? { toon: P.create.toon } : {}), sheet: { print: fingerprint(sheet), reads: sheet.reads }, pending };
}
