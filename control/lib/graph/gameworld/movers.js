/**
 * THE MOVERS — a house emptied into a moving truck, a city's job (gameworld/jobsified.js SHIFTS `movers`): the job taken on
 * the phone, the truck had at the dock and driven to a house on a block of the district (geocity/walkins.js `house`: its
 * door a level's door into a family's house, era/programs.js `house`, two storeys and a basement, furnished as a home is,
 * era/stocking.js HOME_STOCK). Inside, ANY piece is lifted whole and carried in the hands (a couch, a fridge, a box:
 * worlds/controllable/heave.js), through any door, up and down any stair, nothing it would hit stopping it; carried to the
 * front door it goes on the truck. The truck full: paid into the bag (game/movers-mechanics.js).
 *
 *   MOVERS                     the company, its truck's load and its pay
 *   moversMechanics(M)         → the house level's mechanics: the move and the bag it pays into
 *
 * Pure.
 */
export const MOVERS = Object.freeze({ name: 'Lift & Shift Removals', load: 12, reward: Object.freeze([Object.freeze({ item: 'coin', n: 90 })]), done: 'Truck full', truck: 'moving truck' });

/** The house level's mechanics (levels.js interiorStage): the move, counted to the truck's load, and the bag it pays into. */
export function moversMechanics(M = {}) {
  const reward = (M.reward ?? MOVERS.reward).map((r) => ({ item: r.item, n: r.n }));
  return [{ kind: 'movers', id: 'movers', load: M.load ?? MOVERS.load, reward, name: 'Truck', done: M.done ?? MOVERS.done }, { kind: 'bag', slice: 'bag' }];
}
