/**
 * THE FOLK'S ROLES: who a town lot's use roots, and what each person implies. A role is an Egocube ask (egocube/
 * facets.js): its combat role asked (a townie is a non-combatant), its age and archetype LEANED, never asked, so the
 * seed still makes each person their own.
 *
 * What a person implies comes two ways:
 *   grows   people made under a lot's first person (one generation: deeper is an ask), path-keyed: `{ role, as, n }`, `as` the relation (RELATIONS) and `n` how many from
 *           the lot (`band`: its storeys, out-town.js heartbeatBand; a number: that many). The household over a
 *           counter, the master's apprentice, the captain's watch.
 *   seeks   someone the town must hold for this person to make sense: `{ need, roles, why }`, met by anyone of those
 *           roles anywhere in the town, never made. An unmet one is an OPEN NEED on the folk sheet: what the town is
 *           missing, said, so the next person to make becomes obvious.
 *
 *   ROLES[id] = { reads, title, service?, room?, facets, lean, pull?, slots, grows, seeks }
 *     title   the word the placeholder lines name them by (`[Keeper: greeting]`)
 *     room    where a person without a service is found inside their lot (era/programs.js PROGRAMS rooms): a room, or
 *             { <use>: room } for a role that lives on more than one use (a townie at a hearth, or behind the counter)
 *     slots   the line slots every person of the role has (`greeting`, `farewell`; a service adds its own)
 *   ROOTS[use] = the role a lot of that use (era/out-structures.js STRUCTURE_USES) is for
 *   RELATIONS[id] = { reads, born?, lean?, pull? }   `born`: shares the parent's ancestry (the born channel, egocube.js)
 *
 * A town's people are mostly decent: every roll's motivation is pulled toward the light (FOLK_PULL), a role's own pull
 * over it. First readings, to be calibrated at the eyes gate: a role whose people no one can tell from a neighbour's is cut.
 */
const R = (o) => Object.freeze(o);
const PLACEHOLDER = ['greeting', 'farewell'];

export const RELATIONS = Object.freeze({
  kin: R({ reads: 'of the household: born of the same people', born: true }),
  apprentice: R({ reads: 'learns the trade under the master', lean: { age: { child: 0.5, youth: 5, adult: 1, seasoned: 0, elder: 0 } } }),
  hand: R({ reads: 'works the land beside them', lean: { age: { child: 0, youth: 2, adult: 3, seasoned: 1 } } }),
  rank: R({ reads: 'stands in the same uniform under them', lean: { age: { child: 0, youth: 1, adult: 3, seasoned: 1 } } }),
});

export const ROLES = Object.freeze({
  townie: R({
    title: 'Townie',
    reads: 'lives here: a household round a hearth, out to the square and back',
    room: { dwelling: 'hearth', shop: 'backroom' }, facets: { role: 'non-combatant' },
    lean: { archetype: { everyman: 3, caregiver: 2, innocent: 2, jester: 1, lover: 1 } },
    slots: PLACEHOLDER,
    grows: [{ role: 'townie', as: 'kin', n: 'band' }],
    seeks: [{ need: 'provisions', roles: ['keeper'], why: 'a household buys what it does not grow or make' }],
  }),
  keeper: R({
    title: 'Keeper',
    reads: 'keeps the shop: a household over a counter',
    service: 'merchant', facets: { role: 'non-combatant' },
    lean: { age: { child: 0, youth: 0.5, adult: 3, seasoned: 3, elder: 1 }, archetype: { everyman: 2, ruler: 2, creator: 1, caregiver: 1 } },
    slots: PLACEHOLDER,
    grows: [{ role: 'townie', as: 'kin', n: 'band' }],
    seeks: [{ need: 'supplier', roles: ['farmhand', 'master'], why: 'a counter sells what someone grows or makes' }],
  }),
  master: R({
    title: 'Master',
    reads: 'works the trade: a work floor behind a wide door',
    service: 'smith', facets: { role: 'non-combatant' },
    lean: { age: { child: 0, youth: 0, adult: 2, seasoned: 4, elder: 1 }, build: { stout: 3, heroic: 2, brute: 1 }, archetype: { creator: 5, sage: 1 } },
    slots: PLACEHOLDER,
    grows: [{ role: 'apprentice', as: 'apprentice', n: 1 }],
    seeks: [{ need: 'buyer', roles: ['keeper'], why: 'a workshop\'s work is sold at a counter' }],
  }),
  apprentice: R({
    title: 'Apprentice',
    reads: 'learns the trade at the master\'s bench',
    service: 'smith', facets: { role: 'non-combatant' },
    lean: { archetype: { explorer: 2, innocent: 2, creator: 2, jester: 1 } },
    slots: PLACEHOLDER, grows: [], seeks: [],
  }),
  farmhand: R({
    title: 'Farmhand',
    reads: 'works the land: the barn, the field beyond it',
    room: 'floor', facets: { role: 'non-combatant' },
    lean: { age: { child: 0 }, build: { stout: 2, canonical: 2, heroic: 1 }, archetype: { everyman: 3, innocent: 2, caregiver: 1 } },
    slots: PLACEHOLDER,
    grows: [{ role: 'farmhand', as: 'hand', n: 1 }],
    seeks: [{ need: 'market', roles: ['keeper'], why: 'a farm\'s crop goes to market' }],
  }),
  elder: R({
    title: 'Elder',
    reads: 'speaks for the village: the hall, its dais',
    service: 'counsel', facets: { role: 'non-combatant' },
    lean: { age: { child: 0, youth: 0, adult: 0.2, seasoned: 2, elder: 10 }, archetype: { sage: 4, ruler: 2, caregiver: 1 } },
    pull: { order: { at: 0.3, spread: 0.15 } },
    slots: PLACEHOLDER, grows: [],
    seeks: [{ need: 'village', roles: ['townie'], why: 'a hall gathers a village: someone has to live here' }],
  }),
  captain: R({
    title: 'Captain',
    reads: 'leads the watch from the tower',
    service: 'watch', facets: { role: 'frontline' },
    lean: { age: { child: 0, youth: 0, adult: 1, seasoned: 3 }, build: { heroic: 3, stout: 1 }, archetype: { ruler: 3, hero: 2 } },
    pull: { order: { at: 0.2, spread: 0.1 } },
    slots: PLACEHOLDER,
    grows: [{ role: 'watch', as: 'rank', n: 'band' }],
    seeks: [{ need: 'answers-to', roles: ['elder'], why: 'a watch answers to the hall' }],
  }),
  watch: R({
    title: 'Watch',
    reads: 'stands the watch: a post, a round',
    service: 'watch', facets: { role: 'frontline' },
    lean: { age: { child: 0 }, archetype: { everyman: 2, hero: 2, caregiver: 1, outlaw: 0.5 } },
    pull: { order: { at: 0.3, spread: 0.15 } },
    slots: PLACEHOLDER, grows: [], seeks: [],
  }),
});
/** The pull under every folk roll: motivation leaning selfless, as most of a town's people are. */
export const FOLK_PULL = Object.freeze({ motivation: Object.freeze({ at: 0.35, spread: 0.2 }) });

export const ROLE_IDS = Object.freeze(Object.keys(ROLES));

/** The role a lot's use is for. A use with no row (a castle's lots) roots no one, and the folk sheet says so. */
export const ROOTS = Object.freeze({
  dwelling: 'townie', shop: 'keeper', workshop: 'master', barn: 'farmhand', hall: 'elder', tower: 'captain',
});
