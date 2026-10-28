/**
 * THE SERVICES: what a lot offers the player, each a card. A service names what it LOWERS onto, and every lowering is a
 * thing the game already runs: a menu kind (playscape/ui/menus.js MENU_KINDS), an effect (playscape/ui/cast.js
 * CAST_THEN) or a mind's motivation (mind/vocab.js MOTIVATIONS). A service whose work no menu, effect or mind carries
 * yet is a GAP: its people still stand at their place and talk, and the folk sheet says what is missing. Never faked.
 *
 *   SERVICES[id] = { reads, uniform, room, slots, lowers: { menu?, then?, mind? } | null, status, missing? }
 *     uniform   true: its people dress as one (a rank's uniform, gameworld/runner.js castOf), each keeping their face
 *     room      the room of its lot's inside where it is kept (era/programs.js PROGRAMS, the use's rooms)
 *     slots     the line slots its people add to their role's (Time's: the operator fills them, mojulo never does)
 *
 * Only the services a town lot's use roots (roles.js ROOTS) are here; a new one is a card, and a lot use or an ask that
 * roots it.
 */
const R = (o) => Object.freeze(o);

export const SERVICES = Object.freeze({
  merchant: R({
    reads: 'sells over a counter: the shop menu, its stock the game\'s items',
    uniform: true, room: 'shopfloor', slots: ['the shop'],
    lowers: { menu: 'shop' }, status: 'built',
  }),
  smith: R({
    reads: 'works metal for the player: mends and betters their gear',
    uniform: true, room: 'workfloor', slots: ['the work'],
    lowers: null, status: 'gap', missing: 'no menu mends or betters a held item yet (playscape/ui/menus.js): the smith stands at the work floor and talks',
  }),
  counsel: R({
    reads: 'the hall\'s voice: talk, and the quest giver\'s slot when a quest names them (Time\'s)',
    uniform: false, room: 'dais', slots: ['the village'],
    lowers: { menu: 'talk' }, status: 'built',
  }),
  watch: R({
    reads: 'keeps the town\'s peace: holds a post, engages intruders, then returns',
    uniform: true, room: 'guard', slots: ['the watch'],
    lowers: { mind: 'guard' }, status: 'built',
  }),
});
export const SERVICE_IDS = Object.freeze(Object.keys(SERVICES));
