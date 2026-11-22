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
 *   POWERS[id] = { says, beam, stock, special, pierce?, beat, knock?, float?, gale?, wall? }
 *     beam     its look, a BEAMS word (the colour it is drawn in; a hero's own `attack` in its place)
 *     stock    its uses a life (1 to 9): spent as it starts, filled again at a fall (brawl-crowd.js)
 *     special  the move: { from, …its changes } over the shipped special, as a recipe's library writes one
 *     pierce   the bodies its round passes through on its line (a projectile's; one unsaid, the fight's)
 *     knock    its ENERGY, rupa's knockback (brawl-kinetics.js): { kinetic?, impact?, lift? } in joules at a hero's tier
 *              (rupa's `heroic`, ten times a person's blow): a kinetic push on what it strikes (the beam, the flame), an
 *              impact's shock where it lands (the nova) or round its caster (the storm). Light bodies fly, heavy ones
 *              stagger; the shock falls off with distance. A card with none moves bodies as the fight's blows do
 *     float    its hero CARRIED ON THE AIR (a weather power's: the storm, the gale): it drifts, easing up to speed and
 *              gliding on, never walks, and stands on nothing, so no footing holds it (brawl-kinetics.js BRAWL_AIR)
 *     gale     a WIND called down the street: { speed m/s, length m, width m, frames, damage }; its drag on each body
 *              against the body's footing blows a grunt off its feet, braces a big body, sweeps a floating one away
 *     wall     an EARTH power's slab (brawl-kinetics.js, rupa's matter meets matter): { size [along, across, up] m,
 *              density, at (mm in front), push (the shove's joules), damage, rise, stand, rest (frames) }. The first press
 *              wrenches it up (a use spent) to stand as cover; S again while it stands shoves it (`wall.push`, free)
 *     beat     its SUPER BEAT, the moment it is called up: { freeze, screen } the street held still `freeze` frames
 *              (brawl-core.js, a fight super's freeze), and the camera's glass round the caster for it, `screen` a lens
 *              strike's kind (mana-ui's lens: lift, ring, shade, ink). Read while every figure stands still, which is
 *              the lens's own law (a still figure's place is where the page last drew it)
 *   POWER_IDS
 *   ATTACK_POWER     { <beam word>: <power id> } the power a hero's own `attack` (the actions page's beam) plays on the street
 *   powerOf(id)      → the card (throws naming the ids)
 *   readPower(v)     → { id, stock, beam, screen, name?, dials?, colour? } a power as a roster entry or a seat writes it:
 *                    an id, or a power DESIGNED, a kind made the person's own: { kind (or id), name?, stock?, beam?,
 *                    screen?, float?, strength?, speed?, size?, pierce? } (POWER_DIALS, each bounded; POWER_SCREENS its super
 *                    beat's screen, 'none' for none; its colour the page's, brawl-power-look.js)
 *   POWER_DIALS, isRound(id)   the dials a designed power turns; is a kind's move a round down the street
 *   powerHeft(power) → its hits by its uses as a share of its kind's card (1 the card as measured)
 *   powerAdvice(power, who?) → [lines]: a designed power far from what the street was measured with (advice, never a refusal)
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
// (its SUPER BEAT: the street held still `freeze` frames as it is called up, and the camera's glass round the caster for
// the beat, `screen`, a lens strike's kind (mana-ui: lift lights the air round it, ring bends it, shade darkens it, ink
// turns it to its negative, a comic's impact frame): the moment a super is, read while every figure stands still)
const beat = (freeze, screen) => Object.freeze({ freeze, screen });

export const POWERS = Object.freeze({
  // ── AT RANGE: a round down the street, through what is lined up on it ──
  beam: card('a beam from the eyes or the hands: there almost at once, down the street\'s whole length, through every body lined up on it', 'ray', 3,
    { from: 'fireball', says: 'the hero\'s beam: fast and long, it passes through the line', damage: 170, projectile: { w: 900, h: 260, y: -260, life: 70 }, at: { speed: 150, startup: 10, recovery: 26 }, hitstop: 8, push: 220, knock: 'down' },
    { pierce: 6, beat: beat(8, 'lift'), knock: Object.freeze({ kinetic: 3000, lift: 0.1 }) }),
  nova: card('a great ball of force raised and sent slowly down the street: it floors everything it meets on its way', 'nova', 2,
    { from: 'fireball', says: 'the hero\'s nova: slow and huge, it floors all it meets', damage: 260, projectile: { w: 700, h: 700, y: -500, life: 150 }, at: { speed: 40, startup: 18, recovery: 30 }, hitstop: 12, push: 300, knock: 'down' },
    { pierce: 8, beat: beat(16, 'ink'), knock: Object.freeze({ impact: 80000, lift: 0.4 }) }),
  barrage: card('a fistful of charged darts or cards flung down the street: quick to throw, through the first few bodies', 'barrage', 4,
    { from: 'boom', says: 'the hero\'s barrage: quick, through a few', damage: 130, projectile: { w: 500, h: 300, y: -260, life: 90 }, at: { speed: 95, startup: 8, recovery: 20 }, hitstop: 8, push: 200 },
    { pierce: 3, beat: beat(6, 'lift') }),
  flame: card('a gout of fire thrown from the hand: it burns through the first bodies it meets and knocks them down', 'fireball', 3,
    { from: 'fireball', says: 'the hero\'s flame', damage: 180, projectile: { w: 600, h: 320, y: -260, life: 80 }, at: { speed: 80, startup: 11, recovery: 26 }, hitstop: 10, push: 240, knock: 'down' },
    { pierce: 2, beat: beat(8, 'lift'), knock: Object.freeze({ kinetic: 2000, lift: 0.3 }) }),
  // ── ALL ROUND: the crowd that surrounds the hero ──
  storm: card('lightning called down all round: untouchable while it strikes, it floors every body near, before and behind', 'lightning', 2,
    { from: 'whirl', says: 'the hero\'s storm: all round, untouchable, it floors what is near', price: undefined, at: { damage: 200, startup: 6, active: 20, recovery: 22 }, push: 420 },
    { beat: beat(14, 'ink'), knock: Object.freeze({ impact: 200000, lift: 0.5 }), float: true }),
  // ── CLOSE: through the crowd, or a body taken ──
  frenzy: card('a berserk rush: on down the street through the crowd, a run of cuts that floors whoever it reaches, unstoppable', 'barrage', 3,
    { from: 'rush', says: 'the hero\'s frenzy: a rush of cuts that does not flinch', hits: 4, armor: [1, 23, 3], at: { damage: 220, startup: 8, active: 16, recovery: 20, travel: 120 }, knock: 'down', push: 300 },
    { beat: beat(8, 'shade') }),
  phase: card('a step through space: through the crowd, untouchable, and a blow from where it comes out', 'braid', 3,
    { from: 'spin', says: 'the hero\'s phase: through them untouchable, striking as it passes', hits: 2, through: true, invuln: ['strike', 'projectile', 'throw'], at: { damage: 160, startup: 6, active: 14, recovery: 18, travel: 170 }, knock: 'down' },
    { beat: beat(6, 'ring') }),
  might: card('a strongman\'s grip: a body taken from further than a hand reaches and slammed down for half its life', 'nova', 3,
    { from: 'grab', says: 'the hero\'s might: a body taken and slammed', at: { damage: 300, reach: 1.5, startup: 6, recovery: 30 } },
    { beat: beat(10, 'shade') }),
  // ── AIR: the weather (brawl-kinetics.js BRAWL_AIR: its hero carried on it, its wind's drag on a body against its footing) ──
  gale: card('a hurricane down the street: grunts blown off their feet, rounds out of the air; a big body braces', 'orb', 3,
    { from: 'boom', says: 'the hero\'s gale: a wind called down the street', projectile: undefined, nohit: true, at: { startup: 10, recovery: 24, damage: 1 } },
    // (a 65 m/s wind, a great hurricane's, 8 m down the street and 2.4 m across, for three quarters of a second)
    { beat: beat(8, 'ring'), float: true, gale: Object.freeze({ speed: 65, length: 8, width: 2.4, frames: 45, damage: 30 }) }),
  // ── EARTH: the street itself (brawl-kinetics.js, rupa's matter meets matter) ──
  wall: card('a slab of the street wrenched up as cover; pressed again, shoved down the street, flooring what it meets till the ground stops it', 'nova', 3,
    { from: 'boom', says: 'the hero\'s wall: a slab of the street wrenched up, then shoved', projectile: undefined, nohit: true, at: { startup: 12, recovery: 20, damage: 1 } },
    // (a slab of stone 0.6 m thick, 1.6 m across and 1.9 m up, 1.3 m in front; shoved with a hero's 180 kJ: about 9 m/s)
    { beat: beat(10, 'shade'), wall: Object.freeze({ size: Object.freeze([0.6, 1.6, 1.9]), density: 2400, at: 1300, push: 180000, damage: 110, rise: 14, stand: 300, rest: 36 }) }),
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

/** THE DIALS a designed power turns over its kind's card, each bounded: a person's own power is a kind made theirs, never
 * a new move. `strength` the share of the kind's damage, `speed` and `size` of its round's (a round down the street's
 * kinds only), `pierce` the bodies its round passes through. */
export const POWER_DIALS = Object.freeze({
  strength: Object.freeze({ min: 50, max: 200, says: 'how hard it hits, % of its kind' }),
  speed: Object.freeze({ min: 50, max: 200, round: true, says: 'how fast its round flies, % of its kind' }),
  size: Object.freeze({ min: 50, max: 200, round: true, says: 'how big its round is, % of its kind' }),
  pierce: Object.freeze({ min: 1, max: 8, round: true, says: 'how many bodies its round passes through' }),
});
/** A super beat's screen: a lens strike's kind round the caster as it is called up, or none. */
export const POWER_SCREENS = Object.freeze(['lift', 'ring', 'shade', 'ink', 'none']);
const WORDS = ['id', 'kind', 'name', 'stock', 'beam', 'screen', 'float', 'colour', ...Object.keys(POWER_DIALS)];
/** Is a kind's move a round down the street (a projectile)? */
export const isRound = (id) => !!POWERS[id]?.special.projectile;

/** A power as written: an id, or a power DESIGNED: { kind (or id), name?, stock?, beam?, strength?, speed?, size?, pierce? }. */
export function readPower(v, at = 'power') {
  // (a power read once comes back with its dials together, `dials`: read again as written)
  const W = typeof v === 'string' ? { id: v } : isObj(v) && isObj(v.dials) ? (({ dials, ...rest }) => ({ ...rest, ...dials }))(v) : v;
  if (!isObj(W)) throw fail(`${at} is a power (${POWER_IDS.join(', ')}) or one designed: { kind, name?, stock?, beam?, ${Object.keys(POWER_DIALS).join('?, ')}? }`);
  for (const k of Object.keys(W)) if (!WORDS.includes(k)) throw fail(`${at}.${k} is not a power's word (${WORDS.filter((w) => w !== 'colour').join(', ')})`);
  if (W.id !== undefined && W.kind !== undefined) throw fail(`${at}: its kind is said once (kind, or id)`);
  const id = W.kind ?? W.id, P = POWERS[id];
  if (!P) throw fail(`${at}.${W.kind !== undefined ? 'kind' : 'id'} is one of ${POWER_IDS.join(', ')}`);
  if (W.name !== undefined && !(typeof W.name === 'string' && W.name.trim() && W.name.length <= 24)) throw fail(`${at}.name is what the hero calls it, a few words (at most 24 letters)`);
  if (W.stock !== undefined && !(Number.isInteger(W.stock) && W.stock >= 1 && W.stock <= 9)) throw fail(`${at}.stock is its uses a life, 1 to 9`);
  if (W.beam !== undefined && !(typeof W.beam === 'string' && /^[a-z-]{2,24}$/.test(W.beam))) throw fail(`${at}.beam is its look, a beam's word (playscape/elements/beams.js)`);
  if (W.colour !== undefined && !(typeof W.colour === 'string' && /^#[0-9a-f]{6}$/i.test(W.colour))) throw fail(`${at}.colour is '#rrggbb' (its beam's, brawl-power-look.js)`);
  if (W.screen !== undefined && !POWER_SCREENS.includes(W.screen)) throw fail(`${at}.screen is its super beat round the caster: ${POWER_SCREENS.join(' | ')}`);
  if (W.float !== undefined && typeof W.float !== 'boolean') throw fail(`${at}.float is true (its hero carried on the air: it drifts, it does not walk) or false`);
  const dials = {};
  for (const [k, D] of Object.entries(POWER_DIALS)) {
    if (W[k] === undefined) continue;
    if (D.round && !isRound(id)) throw fail(`${at}.${k}: a ${id} throws no round (${k} is for ${POWER_IDS.filter(isRound).join(', ')})`);
    if (!(Number.isInteger(W[k]) && W[k] >= D.min && W[k] <= D.max)) throw fail(`${at}.${k} is ${D.says}, ${D.min} to ${D.max}`);
    dials[k] = W[k];
  }
  return { id, stock: W.stock ?? P.stock, beam: W.beam ?? P.beam, screen: W.screen ?? P.beat.screen, ...((W.float ?? P.float) ? { float: true } : {}), ...(W.name ? { name: W.name.trim() } : {}), ...(Object.keys(dials).length ? { dials } : {}), ...(W.colour ? { colour: W.colour } : {}) };
}

/** How much a designed power asks over its kind: its hits by its uses, as a share of the card's (1 the card as it is). */
export function powerHeft(power) {
  const R = readPower(power), P = POWERS[R.id];
  return Math.round(((R.dials?.strength ?? 100) / 100) * (R.stock / P.stock) * 100) / 100;
}
/** What a designed power is told (advice, never a refusal): one that asks much more than its kind is measured on. */
export function powerAdvice(power, who = 'a hero') {
  const h = powerHeft(power), R = readPower(power);
  return h > 1.5 ? [`${who}'s ${R.name ?? R.id} hits ${h}× as much in a life as the ${R.id} the street was measured with: the crowd will melt (lower its strength or its stock)`]
    : h < 0.5 ? [`${who}'s ${R.name ?? R.id} is ${h}× the ${R.id} the street was measured with: hardly worth its button (raise its strength or its stock)`] : [];
}

const libId = (id) => `power.${id}`;
const pct = (v, p) => Math.max(1, Math.round((v * p) / 100));

/** The kind's move with a designed power's dials turned (strength on its damage wherever the card says it, speed and size on
 * its round). */
function dialled(P, dials = {}) {
  if (!dials.strength && !dials.speed && !dials.size) return P.special;
  const sp = { ...P.special, at: { ...(P.special.at ?? {}) } };
  if (dials.strength) { if (sp.at.damage !== undefined) sp.at.damage = pct(sp.at.damage, dials.strength); if (sp.damage !== undefined) sp.damage = pct(sp.damage, dials.strength); }
  if (dials.speed && sp.at.speed !== undefined) sp.at.speed = pct(sp.at.speed, dials.speed);
  if (dials.size && sp.projectile) sp.projectile = { ...sp.projectile, w: pct(sp.projectile.w, dials.size), h: pct(sp.projectile.h, dials.size) };
  return sp;
}

/** The fighter's recipe with its power as every direction's special. */
export function powerRecipe(recipe, power) {
  const R = readPower(power);
  return {
    ...recipe,
    library: { ...(recipe.library ?? {}), specials: { ...(recipe.library?.specials ?? {}), [libId(R.id)]: dialled(POWERS[R.id], R.dials) } },
    specials: Object.fromEntries(SPECIAL_SLOTS.map((d) => [d, { id: libId(R.id) }])),
  };
}

/** The compiled fighter's moves with its power's marked and its round's pierce laid. */
export function powerMoves(F, power) {
  const R = readPower(power), id = R.id, P = POWERS[id], pierce = R.dials?.pierce ?? P.pierce, out = { ...F.moves };
  for (const [slot, m] of Object.entries(F.moves)) {
    if (m.kind !== 'special' || m.id !== libId(id)) continue;
    // (a round's pierce, and its knock where the card floors what it meets: a projectile's own stun is the fight's)
    // (its super beat: the street held still as it starts, brawl-core.js)
    // (and its energy, rupa's knockback (brawl-kinetics.js): on the move, and on its round where it throws one)
    const kin = P.knock ? { kin: P.knock } : {};
    out[slot] = { ...m, power: 1, ...(P.beat.freeze ? { freeze: P.beat.freeze } : {}), ...(m.projectile ? {} : kin), ...(m.projectile && (pierce || P.special.knock === 'down' || P.knock) ? { projectile: { ...m.projectile, ...(pierce ? { hits: pierce } : {}), ...(P.special.knock === 'down' ? { knock: 'down' } : {}), ...kin } } : {}) };
  }
  // (an EARTH power's two presses: the slab wrenched up (the power, its use spent), then, while it stands, the same move
  // shoving it (free): `wall.push`, which S throws while the hero's own slab stands, brawl-moves.js)
  // (a GALE: the wind called as the move strikes, on every direction of it; strength its wind's speed by the root, so its
  // drag by the strength)
  if (P.gale) {
    const G = R.dials?.strength ? { ...P.gale, speed: Math.round(P.gale.speed * Math.sqrt(R.dials.strength / 100)) } : P.gale;
    for (const [slot, m] of Object.entries(out)) if (m.power) out[slot] = { ...m, gale: G };
  }
  if (P.wall) {
    const W = R.dials?.strength ? { ...P.wall, push: Math.round((P.wall.push * R.dials.strength) / 100), damage: Math.round((P.wall.damage * R.dials.strength) / 100) } : P.wall;
    for (const [slot, m] of Object.entries(out)) if (m.power) out[slot] = { ...m, wall: W };
    const summon = out['special.neutral.M'];
    if (summon) { const { power: _p, wall: _w, freeze: _f, ...rest } = summon; out['wall.push'] = { ...rest, slot: 'wall.push', id: `${libId(id)}.push`, shove: 1 }; }
  }
  return out;
}
