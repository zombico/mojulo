/**
 * THE ATTACK CARDS — what a foe does to the hero, apart from the body that does it. A class says how a foe moves and
 * thinks and the KIND of harm it deals (./vocab.js ATTACKS: a blow, a shot, a lob, a charge…); a card says which blow
 * of that kind, and how each shape of body throws it. So one body takes several cards (a wolf that snaps, a wolf that
 * mauls), and one card is thrown by several bodies (a maul a bear's rear-and-slam and an orc's overhead cleave).
 *
 * A bestiary entry names one, `attack: '<card>'` (gameworld/foes.js); absent, the class's own attack as it always was,
 * every byte. A card keeps its class's verb (a melee class takes a melee card): a card re-skins the blow, the mind that
 * closes to throw it is the class's.
 *
 * A card:
 *   kind     the ATTACKS row it is (its verb must be the class's)
 *   reads    what the player sees it do, in a line (the cast sheet's)
 *   timing   { startup, active, recovery } frames at 60 Hz over the kind's: the wind-up the player reads, the blow, the
 *            way back (the contact window the runtime lands the hit in, and the clip's beats with it)
 *   reach?   metres it lands at, over the kind's (the page fits a held swing's to where its weapon goes: foe-blade.js)
 *   art?     the style a body with hands throws it in (polygonizer/hero-swing-body.js SWING_STYLES: action, inspired,
 *            freestyle, wild): a staggered stance, the weight moved onto the lead foot, the rear foot pivoting, the off
 *            hand countering, the whole body behind the arm. A person's or a kin's swing is always carried so
 *   ways     { <topology>: <way> } how each shape of body throws it (./fit.js TOPOLOGIES): a beast's a strike way
 *            (fauna/behavior/strike.js STRIKE_WAYS: strike the lunge, snap, maul, roar, channel); a person's or a kin's
 *            a held swing (polygonizer/hero-swing.js SWING_WORDS) or a strike (polygonizer/hero-strike.js STRIKES).
 *            A body whose topology the card has no way for cannot take it, and is refused naming the ones it has
 *
 *   ATTACK_CARDS, ATTACK_CARD_IDS
 *   attackCard(id)                         → the card (with its id), or throws naming the cards
 *   cardFor(id, classRow, topology)        → { card, way }: the card checked against the class's verb and the body's
 *                                            topology, throwing with words where it does not fit
 *   cardAttack(classRow, card)             → the class's attack with the card's kind, timing and reach over it
 *
 * Pure: no database, no clock, no dice.
 */
import { ATTACKS, TOPOLOGIES } from './vocab.js';
import { STRIKE_WAYS } from '../fauna/behavior/strike.js';
import { SWING_WORDS } from '../polygonizer/hero-swing.js';
import { STRIKES } from '../polygonizer/hero-strike.js';
import { SWING_STYLES } from '../polygonizer/hero-swing-body.js';

const card = (o) => Object.freeze({ ...o, ways: Object.freeze(o.ways) });
const BEASTS = ['quadruped', 'biped', 'limbless', 'winged'];
const FOLK = ['person', 'kin'];
const each = (tops, way) => Object.fromEntries(tops.map((t) => [t, way]));

export const ATTACK_CARDS = Object.freeze({
  lunge: card({ kind: 'strike', reads: 'crouches, then springs at you', timing: { startup: 30, active: 4, recovery: 20 }, ways: each(BEASTS, 'strike') }),
  snap: card({ kind: 'strike', reads: 'a quick bite with hardly a tell: stay out of reach', timing: { startup: 12, active: 3, recovery: 14 }, reach: 1, ways: each(['quadruped', 'biped', 'limbless'], 'snap') }),
  maul: card({ kind: 'strike', reads: 'rears up, then brings its weight down: a slow blow that hits hard', timing: { startup: 40, active: 6, recovery: 28 }, reach: 1.6, art: 'wild', ways: { quadruped: 'maul', biped: 'maul', ...each(FOLK, 'cleave') } }),
  chop: card({ kind: 'strike', reads: 'raises its weapon over its shoulder and chops down', timing: { startup: 26, active: 5, recovery: 22 }, reach: 1.3, art: 'action', ways: each(FOLK, 'chop') }),
  thrust: card({ kind: 'strike', reads: 'draws back and drives its point straight at you: step aside', timing: { startup: 20, active: 4, recovery: 24 }, reach: 1.8, art: 'inspired', ways: each(FOLK, 'thrust') }),
  bash: card({ kind: 'strike', reads: 'shoves its shield into you at close range', timing: { startup: 16, active: 5, recovery: 20 }, reach: 1, art: 'action', ways: each(FOLK, 'bash') }),
  punch: card({ kind: 'strike', reads: 'throws a punch from its guard', timing: { startup: 18, active: 4, recovery: 18 }, reach: 0.9, ways: each(FOLK, 'cross') }),
});
export const ATTACK_CARD_IDS = Object.freeze(Object.keys(ATTACK_CARDS));

// (held to its own words at load: a card's kind is an attack, its topologies the fit's, each way a body's)
for (const [id, C] of Object.entries(ATTACK_CARDS)) {
  if (!ATTACKS[C.kind]) throw new Error(`foe: attack card '${id}': no attack kind '${C.kind}'`);
  if (C.art !== undefined && !SWING_STYLES[C.art]) throw new Error(`foe: attack card '${id}': no art '${C.art}' (${Object.keys(SWING_STYLES).join(', ')})`);
  for (const [t, w] of Object.entries(C.ways)) {
    if (!TOPOLOGIES.includes(t)) throw new Error(`foe: attack card '${id}': no topology '${t}' (${TOPOLOGIES.join(', ')})`);
    const ok = FOLK.includes(t) ? SWING_WORDS.includes(w) || !!STRIKES[w] : STRIKE_WAYS.includes(w);
    if (!ok) throw new Error(`foe: attack card '${id}': '${w}' is not a way a ${t} throws a blow`);
  }
}

export function attackCard(id) {
  const C = ATTACK_CARDS[id];
  if (!C) throw new Error(`foe: no attack card '${id}' (the cards: ${ATTACK_CARD_IDS.join(', ')})`);
  return { id, ...C };
}

export function cardFor(id, c, topology) {
  const C = attackCard(id), verb = ATTACKS[C.kind].verb, own = ATTACKS[c.attack.kind].verb;
  if (verb !== own) throw new Error(`foe: a ${c.id}'s attack is a ${c.attack.kind} (${own}); the card '${id}' is a ${C.kind} (${verb}): a card re-skins its class's blow, never its kind`);
  const way = C.ways[topology];
  if (!way) throw new Error(`foe: the attack card '${id}' is thrown by a ${Object.keys(C.ways).join(' | ')}, not a ${topology}`);
  return { card: C, way };
}

export const cardAttack = (c, C) => ({
  ...c.attack, kind: C.kind, timing: { ...(c.attack.timing || {}), ...C.timing }, ...(C.reach !== undefined ? { reach: C.reach } : {}),
});
