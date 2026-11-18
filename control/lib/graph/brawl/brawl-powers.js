/**
 * brawl powers — a hero's POWER on the street, as CARDS: the one thing a hero does that a fist does not (a beam from the
 * eyes, a storm called down all round, a great ball of force, a frenzy, a strongman's grip, a step through space, a
 * barrage), on its own button (S, the special: every direction of it the power), with a STOCK of uses each life. The
 * superhero beat-em-up's signature (a team of heroes, each its one power, a few uses a life): a new power is a card.
 *
 * A card is a special over the fight's library (versus-library.js SPECIALS): `from` a shipped special and its changes, in
 * the library's own words (versus-compile.js readSpecial), so the fight's compiler lays its frames and no new primitive
 * is made; the brawl adds what the fight has no word for: how many bodies its round passes through (`pierce`) and its
 * stock. Its LOOK is a beam of the elements' shelf (playscape/elements/beams.js BEAMS: the same words the game book's
 * actions page writes a power's `attack` in), whose colour the page draws it in.
 *
 *   POWERS[id] = { says, beam, stock, special, pierce? }
 *     beam     its look, a BEAMS word (the colour it is drawn in; a hero's own `attack` in its place)
 *     stock    its uses a life (1 to 9): spent as it starts, filled again at a fall (brawl-crowd.js)
 *     special  the move: { from, …its changes } over the shipped special, as a recipe's library writes one
 *     pierce   the bodies its round passes through on its line (a projectile's; one unsaid, the fight's)
 *   POWER_IDS
 *   ATTACK_POWER     { <beam word>: <power id> } the power a hero's own `attack` (the actions page's beam) plays on the street
 *   powerOf(id)      → the card (throws naming the ids)
 *   readPower(v)     → { id, stock, beam, colour? } a power as a roster entry or a seat writes it: an id, or { id, stock?,
 *                    beam?, colour? } (its colour the page's: brawl-power-look.js powerLook)
 *   powerRecipe(recipe, power) → the fighter's recipe with its power as every direction's special (its own library
 *                    special, `power.<id>`), its other specials gone: S is the power, whichever way the stick points
 *   powerMoves(F, power) → the compiled fighter's moves with its power's marked (`power: 1`, the core's stock reads it)
 *                    and its round's pierce and knock laid (a projectile's `knock: 'down'` floors each body it meets)
 * Its beam is read against the elements' shelf where the page is made (brawl-power-look.js: the word checked, its colour),
 * so this module, which the page inlines (brawl-page.js BRAWL_PAGE_MODULES), carries no shelf of looks.
 *
 * Measured by the scripted hero (brawl-playthrough.js): see brawl-powers.test.js. Pure.
 */
import { SPECIAL_SLOTS } from '../versus/versus-library.js';

const card = (says, beam, stock, special, extra = {}) => Object.freeze({ says, beam, stock, special: Object.freeze(special), ...extra });

export const POWERS = Object.freeze({
  // ── AT RANGE: a round down the street, through what is lined up on it ──
  beam: card('a beam from the eyes or the hands: there almost at once, down the street\'s whole length, through every body lined up on it', 'ray', 3,
    { from: 'fireball', says: 'the hero\'s beam: fast and long, it passes through the line', damage: 170, projectile: { w: 900, h: 260, y: -260, life: 70 }, at: { speed: 150, startup: 10, recovery: 26 }, hitstop: 8, push: 220, knock: 'down' },
    { pierce: 6 }),
  nova: card('a great ball of force raised and sent slowly down the street: it floors everything it meets on its way', 'nova', 2,
    { from: 'fireball', says: 'the hero\'s nova: slow and huge, it floors all it meets', damage: 260, projectile: { w: 700, h: 700, y: -500, life: 150 }, at: { speed: 40, startup: 18, recovery: 30 }, hitstop: 12, push: 300, knock: 'down' },
    { pierce: 8 }),
  barrage: card('a fistful of charged darts or cards flung down the street: quick to throw, through the first few bodies', 'barrage', 4,
    { from: 'boom', says: 'the hero\'s barrage: quick, through a few', damage: 130, projectile: { w: 500, h: 300, y: -260, life: 90 }, at: { speed: 95, startup: 8, recovery: 20 }, hitstop: 8, push: 200 },
    { pierce: 3 }),
  flame: card('a gout of fire thrown from the hand: it burns through the first bodies it meets and knocks them down', 'fireball', 3,
    { from: 'fireball', says: 'the hero\'s flame', damage: 180, projectile: { w: 600, h: 320, y: -260, life: 80 }, at: { speed: 80, startup: 11, recovery: 26 }, hitstop: 10, push: 240, knock: 'down' },
    { pierce: 2 }),
  // ── ALL ROUND: the crowd that surrounds the hero ──
  storm: card('lightning called down all round: untouchable while it strikes, it floors every body near, before and behind', 'lightning', 2,
    { from: 'whirl', says: 'the hero\'s storm: all round, untouchable, it floors what is near', price: undefined, at: { damage: 200, startup: 6, active: 20, recovery: 22 }, push: 420 }),
  // ── CLOSE: through the crowd, or a body taken ──
  frenzy: card('a berserk rush: on down the street through the crowd, a run of cuts that floors whoever it reaches, unstoppable', 'barrage', 3,
    { from: 'rush', says: 'the hero\'s frenzy: a rush of cuts that does not flinch', hits: 4, armor: [1, 23, 3], at: { damage: 220, startup: 8, active: 16, recovery: 20, travel: 120 }, knock: 'down', push: 300 }),
  phase: card('a step through space: through the crowd, untouchable, and a blow from where it comes out', 'braid', 3,
    { from: 'spin', says: 'the hero\'s phase: through them untouchable, striking as it passes', hits: 2, through: true, invuln: ['strike', 'projectile', 'throw'], at: { damage: 160, startup: 6, active: 14, recovery: 18, travel: 170 }, knock: 'down' }),
  might: card('a strongman\'s grip: a body taken from further than a hand reaches and slammed down for half its life', 'nova', 3,
    { from: 'grab', says: 'the hero\'s might: a body taken and slammed', at: { damage: 300, reach: 1.5, startup: 6, recovery: 30 } }),
});
export const POWER_IDS = Object.freeze(Object.keys(POWERS));

/** The power a hero's own `attack` (gameworld/actions.js, a BEAMS word) plays on the street: a beam's kind, by its form. */
export const ATTACK_POWER = Object.freeze({
  orb: 'flame', serpent: 'flame', ray: 'beam', nova: 'nova', barrage: 'barrage', braid: 'beam', laser: 'beam',
  lightning: 'storm', fireball: 'flame', sigil: 'beam', itano: 'barrage', 'itano-laser': 'barrage',
});

const fail = (m) => new Error(`brawl: ${m}`);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export function powerOf(id) {
  const P = POWERS[id];
  if (!P) throw fail(`a power is one of ${POWER_IDS.join(', ')}`);
  return P;
}

/** A power as written: an id, or { id, stock?, beam? } (its uses a life, its look). */
export function readPower(v, at = 'power') {
  const W = typeof v === 'string' ? { id: v } : v;
  if (!isObj(W)) throw fail(`${at} is a power (${POWER_IDS.join(', ')}) or { id, stock?, beam? }`);
  for (const k of Object.keys(W)) if (!['id', 'stock', 'beam', 'colour'].includes(k)) throw fail(`${at}.${k} is not a power's word (id, stock, beam, colour)`);
  const P = POWERS[W.id];
  if (!P) throw fail(`${at}.id is one of ${POWER_IDS.join(', ')}`);
  if (W.stock !== undefined && !(Number.isInteger(W.stock) && W.stock >= 1 && W.stock <= 9)) throw fail(`${at}.stock is its uses a life, 1 to 9`);
  if (W.beam !== undefined && !(typeof W.beam === 'string' && /^[a-z-]{2,24}$/.test(W.beam))) throw fail(`${at}.beam is its look, a beam's word (playscape/elements/beams.js)`);
  if (W.colour !== undefined && !(typeof W.colour === 'string' && /^#[0-9a-f]{6}$/i.test(W.colour))) throw fail(`${at}.colour is '#rrggbb' (its beam's, brawl-power-look.js)`);
  return { id: W.id, stock: W.stock ?? P.stock, beam: W.beam ?? P.beam, ...(W.colour ? { colour: W.colour } : {}) };
}

const libId = (id) => `power.${id}`;

/** The fighter's recipe with its power as every direction's special. */
export function powerRecipe(recipe, power) {
  const { id } = readPower(power);
  const P = POWERS[id];
  return {
    ...recipe,
    library: { ...(recipe.library ?? {}), specials: { ...(recipe.library?.specials ?? {}), [libId(id)]: P.special } },
    specials: Object.fromEntries(SPECIAL_SLOTS.map((d) => [d, { id: libId(id) }])),
  };
}

/** The compiled fighter's moves with its power's marked and its round's pierce laid. */
export function powerMoves(F, power) {
  const { id } = readPower(power);
  const P = POWERS[id], out = { ...F.moves };
  for (const [slot, m] of Object.entries(F.moves)) {
    if (m.kind !== 'special' || m.id !== libId(id)) continue;
    // (a round's pierce, and its knock where the card floors what it meets: a projectile's own stun is the fight's)
    out[slot] = { ...m, power: 1, ...(m.projectile && (P.pierce || P.special.knock === 'down') ? { projectile: { ...m.projectile, ...(P.pierce ? { hits: P.pierce } : {}), ...(P.special.knock === 'down' ? { knock: 'down' } : {}) } } : {}) };
  }
  return out;
}
