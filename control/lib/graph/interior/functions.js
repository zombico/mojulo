/**
 * interior/functions — the jobs a room does, one word each, and what each kind of room is for.
 *
 * A function is resolved by the strategy table (interior/strategies.js) the fabricator's way: its strategies in order,
 * the first that qualifies and fits the room wins, the rest are refused with why. A function no strategy can fill is a
 * gap, said in the readout, never a piece faked to fill it.
 */

export const FUNCTIONS = Object.freeze({
  converse: 'seats that face each other and a focal point, a surface in reach of each',
  media: 'a screen and what it stands on, on the focal wall',
  read: 'a chair, a light over the shoulder, a place to set a cup',
  display: 'shelves for books and things kept',
  dine: 'a table and its chairs, with room to pull them out',
  store: 'closed storage along a wall',
  sleep: 'a bed with a surface and a light each side',
  dress: 'drawers with room before them to stand',
  work: 'a desk and its chair',
  drop: 'a place to sit and set things down by the door',
  anchor: 'a rug under a group, holding it together',
  'light-task': 'a lamp where something is done: reading, working',
});
export const FUNCTION_NAMES = Object.freeze(Object.keys(FUNCTIONS));

// what each room is for, by the house's glyph (polygonizer/floorplan-glyphs.js ARCHETYPES): the program a room gets
// when the brief names no uses. The house's own room role names it too.
export const ROOM_PROGRAMS = Object.freeze({
  L: { label: 'living room', uses: ['media', 'converse', 'read', 'display'] },
  B: { label: 'bedroom', uses: ['sleep', 'dress', 'read'] },
  D: { label: 'dining room', uses: ['dine', 'store'] },
  O: { label: 'study', uses: ['work', 'display', 'read'] },
  E: { label: 'entry', uses: ['drop'] },
  S: { label: 'storage room', uses: ['display'] },
});
// rooms the interior does not fit out in this version: their fixtures are the house's (a fitted bathroom, a kitchen run)
export const FIXTURE_ROOMS = Object.freeze({ K: 'a kitchen is a fitted run of units', W: 'a bathroom is fitted with its fixtures', Y: 'a laundry is fitted with its appliances', H: 'a hall is circulation' });

// the order functions are solved in: what claims the focal wall first, then the groups that face it, then what fills in
export const SOLVE_ORDER = Object.freeze(['media', 'converse', 'sleep', 'dine', 'work', 'dress', 'read', 'store', 'display', 'drop', 'light-task', 'anchor']);

// closed tags a brief may carry; strategies qualify on them (`when`, `unless`)
export const TAGS = Object.freeze({
  compact: 'a small room, or one that should feel open: fewer, smaller pieces',
  entertaining: 'seats for guests: the larger group',
  symmetric: 'mirror pairs about the focal axis',
  kids: 'low and soft, a floor left to play on',
  pets: 'tough cloth, nothing fragile at tail height',
  wfh: 'somewhere to work as well',
  'no-tv': 'no screen; the focal point is the view or the hearth',
});
