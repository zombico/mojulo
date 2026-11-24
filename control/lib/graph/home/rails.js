/**
 * THE HOME'S RAILS — what a person's home starts from, one row each: what the home's producer (producer.js) knows
 * before anything is asked. A rail is a TEMPLATE, never their home: a person redoes their own bedroom and it starts from
 * `room`. The doors behind each rail are built already (mint_building, design_interior, forge_motion, export_model);
 * a row only NAMES into them, so nothing here is measured or copied.
 *
 * A row:
 *   name      the template's name, as the producer says it
 *   like      what the person hears first, in plain words
 *   doors     the listed tools it is made with, in the order it uses them (tool-lines.js names each)
 *   outcomes  the house's outcomes it reaches (structure/open.js OUTCOMES: concept, layout, drawings, build)
 *   cards     the vocab cards the agent reads before the first call (get_sketch_vocab)
 *   asks      the producer's questions this rail asks, in order (producer.js HOME_QUESTIONS): what it needs to know
 *   first    the first look: what the person sees and approves, the eyes gate, theirs
 *   words     the words people say for it
 *
 *   HOME_RAILS, HOME_RAIL_IDS, homeRailOf(id)
 *   HOME_LACKS     what no rail does: said before anything is made, never hidden
 *   HOME_BRIDGES   where a made home can go next, offered after the first look and never pushed
 *
 * Pure.
 */

const row = (o) => Object.freeze({ ...o, doors: Object.freeze(o.doors), outcomes: Object.freeze(o.outcomes), cards: Object.freeze(o.cards), asks: Object.freeze(o.asks), words: Object.freeze(o.words) });

// Least first: one room, the home they have, a house from nothing, the set to build from; a shop or a café beside them.
export const HOME_RAILS = Object.freeze({
  room: row({
    name: 'a room redone', like: 'one room: a style, the furniture placed at true size with the walkways kept clear, walls and floor',
    doors: ['design_interior'], outcomes: ['layout'], cards: ['interior', 'house-finishes'],
    asks: ['place', 'living', 'look', 'brought'],
    first: 'the room at eye height, then again after each change they ask for',
    words: ['redo my bedroom', 'decorate the lounge', 'where should the sofa go', 'a reading corner'],
  }),
  'move-in': row({
    name: 'the home you have', like: 'your plan built to the inch, and every room you name designed in a style of its own, walked through',
    doors: ['mint_building', 'design_interior', 'forge_motion', 'stitch_motion'], outcomes: ['concept', 'layout'], cards: ['house-layout', 'interior'],
    asks: ['place', 'living', 'look', 'brought'],
    first: 'a walkthrough of the rooms they named',
    words: ['we just moved in', 'here is our floor plan', 'ideas for living in our flat', 'our new place'],
  }),
  'new-house': row({
    name: 'a house from nothing', like: 'a house you would build: how big, how many floors, how it looks and sits on its lot, every room furnished',
    doors: ['mint_building', 'update_sketch', 'forge_motion'], outcomes: ['concept', 'layout'], cards: ['house-concept', 'house-livability'],
    asks: ['living', 'look', 'place', 'brought'],
    first: 'the house walked at eye height, and its plan read in the structure book',
    words: ['we are thinking of building', 'our dream house', 'a cottage with a porch', 'a house for a family of five'],
  }),
  plans: row({
    name: 'the set to build from', like: 'drawings to show or hand on, the frame and what it takes, the schedules, a model for an architect\'s software',
    doors: ['mint_building', 'update_sketch', 'export_model'], outcomes: ['drawings', 'build'], cards: ['house-drawings', 'house-build'],
    asks: ['place', 'brought'],
    first: 'the drawing set and the structure book\'s Checks tab',
    words: ['floor plans and elevations', 'what would it take to frame it', 'an IFC for our architect', 'a cut list'],
  }),
  'fit-out': row({
    name: 'a shop or a café fitted out', like: 'a store, a café or a restaurant laid out by what it is for, graded as that building, its furniture and fixtures scheduled',
    doors: ['mint_building', 'export_model'], outcomes: ['layout', 'drawings'], cards: ['building-commercial'],
    asks: ['place', 'living', 'look', 'brought'],
    first: 'the shop walked through, and its program\'s grade with the findings in words',
    words: ['fit out my café', 'a layout for our bakery', 'our new shop floor'],
  }),
});
export const HOME_RAIL_IDS = Object.freeze(Object.keys(HOME_RAILS));

export function homeRailOf(id) {
  const r = HOME_RAILS[id];
  if (!r) throw new Error(`home: '${id}' is no rail (${HOME_RAIL_IDS.join(', ')})`);
  return { id, ...r };
}

/** What no rail does: said to the person before anything is made. */
export const HOME_LACKS = Object.freeze([
  'no prices or quotes: the furniture schedule is quantities, which they price from',
  'no permit or code sign-off: the structure book\'s checks advise, a licensed reviewer signs',
  'no structural engineering: the frame is a carpenter\'s takeoff, not an engineer\'s calculation',
]);

/** Where a made home can go next: offered once, after the first look, never pushed. */
export const HOME_BRIDGES = Object.freeze([
  Object.freeze({ to: 'play', door: 'mint_building({ manifest: { …, level: { goal } } }), then design_game', says: 'the house as a game level (card building-level)' }),
  Object.freeze({ to: 'print', door: "mint_solid({ kind: 'furniture', spec: { like, buildable: true } })", says: 'a piece of theirs made to build: its cut list and bill of materials' }),
  Object.freeze({ to: 'engine', door: "export_model({ ref, format: 'glb' | 'ifc' | 'sheets' | 'schedules' }) · export_model({ ref, engine })", says: 'the house to a model, an architect\'s software or a team\'s engine' }),
]);
