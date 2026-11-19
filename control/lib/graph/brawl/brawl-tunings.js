/**
 * brawl tunings — how hard a street hits, as CARDS: one word on a street chooses a whole set of numbers, so the intent
 * ("this is an arcade run & gun") is one decision and not thirty dials. A new feel is a new card.
 *
 *   TUNINGS[id] = { says, lives?, depth?, entrances?, playerHp?, crowdHp?, foeGuns?, crowd?, powers? }
 *     lives      the falls the players may take when the street says none
 *     depth      the band the bodies move in across the street, m ([near, far]; the belt's unsaid)
 *     entrances  how a stop's crowd comes in when its wave says none, a stop after another in turn (brawl-crowd.js)
 *     army       how many come for each one a stop's wave names (a boss's guard too; eight of a kind at most, twelve a
 *                stop): the design says who, the card how many of them an arcade street throws
 *     playerHp   a player's health (its fighter's own unsaid): how many rounds it takes
 *     crowdHp    the crowd's health as a share of each type's own (a boss keeps its own): how many rounds it takes
 *     foeGuns    dials over the crowd's guns, by gun (brawl-guns.js): its round's speed, its warning, its rate
 *     crowd      the crowd's rules over its own (brawl-crowd.js CROWD_RULES): how many stand at once, how soon they act
 *     powers     every seat a HERO with a power (brawl-powers.js): its own (a hero's `attack`, a roster entry's `power`)
 *                where it has one, else the team's in seat order (HERO_TEAM); unsaid, no seat has a power
 *
 *   measured   the street as the sim's own numbers have it: a long fight, a round a nudge, a warning before each shot
 *   arcade     the arcade run & gun (the genre of one soldier, an army and a few lives): a foot soldier falls to a
 *              couple of rounds, the hero to a few hits, the crowd's fire comes sooner and faster, more of them stand
 *              at once and they come from above and out of doors as well as the edges, on a narrow band that reads as
 *              a side view; five falls
 *   heroes     the superhero beat-em-up (a team of heroes against an army, its villains at the end): every seat a hero
 *              with its power, a few uses a life (S, the special), the crowd an army that drops in and comes out of
 *              doors as well as walking on, more of them at once, each falling to a few blows; five falls
 *
 *   tuningOf(id)       → the card (throws naming the ids)
 *   roomTune(card)     → what the room takes of it (streetRoomOf `tune`), or null for a card that changes none
 *   STREET_TUNINGS     the ids
 *   HERO_TEAM          the powers a heroes street gives its seats in order, where a seat has none of its own
 *   seatPower(card, k, own?) → a seat's power on this card: its own, else the team's k-th; null where the card has none
 *
 * Its numbers are held to targets by the scripted player (brawl-playthrough.js; brawl-tunings.test.js): on the arcade
 * card a rifleman falls within three of the machine gun's rounds, a player within six of a rifle's (and survives one
 * blow of a boss: at 150 and at 200 one basic player lost the default street at its boss with every fall gone), and the
 * basic player still wins the default street with falls to spare while taking hits. Pure.
 */
export const TUNINGS = Object.freeze({
  measured: Object.freeze({ says: 'the sim\'s own numbers: a long fight, each round a nudge, a warning before every shot' }),
  arcade: Object.freeze({
    says: 'an arcade run & gun: soldiers fall to a couple of rounds, the hero to a few hits, fire comes sooner and faster, more stand at once, from above and out of doors; five falls',
    lives: 5,
    depth: Object.freeze([-1.25, 1.25]),
    entrances: Object.freeze(['walk', 'drop', 'door']),
    army: 2,
    playerHp: 240,
    crowdHp: 0.13,
    foeGuns: Object.freeze({
      rifle: Object.freeze({ speed: 150, telegraph: 16, rate: 44 }),
      burst: Object.freeze({ speed: 160, telegraph: 14 }),
      lob: Object.freeze({ telegraph: 20 }),
      bazooka: Object.freeze({ telegraph: 30, speed: 110 }),
    }),
    crowd: Object.freeze({ limit: 8, cool: Object.freeze([30, 70]) }),
  }),
  heroes: Object.freeze({
    says: 'a superhero beat-em-up: every player a hero with a power on its own button, a few uses a life; an army that drops in and comes out of doors, more at once, each falling to a few blows; five falls',
    lives: 5,
    entrances: Object.freeze(['walk', 'drop', 'door']),
    army: 2,
    crowdHp: 0.5,
    crowd: Object.freeze({ limit: 8 }),
    powers: true,
  }),
});
/** The team a heroes street gives the seats with no power of their own, in seat order: the beam, the storm, the frenzy,
 * the strongman (a team's four corners: at range, all round, through the crowd, a body taken). */
export const HERO_TEAM = Object.freeze(['beam', 'storm', 'frenzy', 'might']);
export const STREET_TUNINGS = Object.freeze(Object.keys(TUNINGS));

export function tuningOf(id) {
  const T = TUNINGS[id];
  if (!T) throw new Error(`brawl: a street's tuning is one of ${STREET_TUNINGS.join(', ')}`);
  return T;
}

/** What the room takes of a card: its players' health, the crowd's, the crowd's guns and rules. */
export function roomTune(card) {
  const out = {};
  for (const k of ['playerHp', 'crowdHp', 'foeGuns', 'crowd']) if (card[k] !== undefined) out[k] = card[k];
  return Object.keys(out).length ? out : null;
}

/** A seat's power on a card: its own where it has one, else the team's in seat order; none where the card gives none. */
export function seatPower(card, k, own = null) {
  if (!card?.powers) return null;
  return own ?? HERO_TEAM[k % HERO_TEAM.length];
}
