/**
 * THE MISSION'S SECTIONS — what a shooter's first level is made of. The firing range tries a game's guns on a body at
 * three bands (5, 15 and 30 m); a mission is the same range stretched out down one line, each band a place with
 * something to do in it. A closed table, as the room primitives are: a section is what it teaches, the band it is sized
 * from, the task that ends it and who stands in it. A new kind of mission is a new order of these; a new section is a
 * row and its layer (compose.js LAY).
 *
 *   BANDS     the ranges a gun is used at, in metres: where its foes stand from the firing line (`m`), and the reach a
 *             foe may stand in and still be that band's (`reach`)
 *   TASKS     what ends a section: { says, text } (the mechanic that plays them: game/objectives.js)
 *   SECTIONS  { <kind>: { about, teaches, task, band, foes, fight, gap? } }   (gap: designed, not built: what it waits on)
 *   ARCHETYPE_BAND   the band each of the kit's archetypes (arms-kit.js ARMS_KIT `as`) is carried for
 *   FIRE_BAND        the band of a weapon written by its fire type (combat/range.js FIRE)
 *
 * Pure, no dice.
 */
export const BANDS = Object.freeze({
  close: Object.freeze({ m: 6, reach: Object.freeze([3, 10]), says: 'across a room: the range\'s 5 m body' }),
  mid: Object.freeze({ m: 15, reach: Object.freeze([8, 22]), says: 'down a hall: the range\'s 15 m body' }),
  long: Object.freeze({ m: 30, reach: Object.freeze([20, 40]), says: 'the long line: the range\'s 30 m body' }),
});
export const BAND_IDS = Object.freeze(Object.keys(BANDS));

export const ARCHETYPE_BAND = Object.freeze({ pump: 'close', spray: 'close', auto: 'mid', sidearm: 'mid', magnum: 'mid', marksman: 'long', bolt: 'long', bow: 'long' });
export const FIRE_BAND = Object.freeze({ hitscan: 'mid', projectile: 'mid', melee: null });

export const TASKS = Object.freeze({
  take: Object.freeze({ says: 'walk over what lies there', text: 'Take the rounds' }),
  clear: Object.freeze({ says: 'every foe of the section down', text: 'Clear the room' }),
  hold: Object.freeze({ says: 'still standing when the clock runs out, while they come in waves', text: 'Hold the yard' }),
  man: Object.freeze({ says: 'take the mounted gun, and every foe of the section down', text: 'Man the gun' }),
  reach: Object.freeze({ says: 'walk to the place', text: 'Get out' }),
});
export const TASK_IDS = Object.freeze(Object.keys(TASKS));

// (`radio`: the order as it is spoken when the section's task begins, a line on the pilot's radio)
export const SECTIONS = Object.freeze({
  staging: Object.freeze({
    radio: 'Gear up. Take the rounds off the floor.',
    about: 'the start: an empty room, the rounds on the floor, the way on shut until they are taken',
    teaches: 'the body and the kit: walk, look, take what lies there', task: 'take', text: 'Take the rounds', band: null, foes: 0, fight: false,
  }),
  contact: Object.freeze({
    radio: 'Contact front. Use the wall, and clear them out.',
    about: 'the first contact: a room, a low wall to fire over, a foe or two across it',
    teaches: 'the gun at the close band: fire from cover, reload behind it', task: 'clear', text: 'Clear the room', band: 'close', foes: 2, fight: true,
  }),
  lane: Object.freeze({
    radio: 'Push up. Cover to cover.',
    about: 'the push: a hall with cover down it, foes at its far end, health half way',
    teaches: 'the gun at the mid band: move from cover to cover, aim', task: 'clear', text: 'Push down the lane', band: 'mid', foes: 3, fight: true,
  }),
  overwatch: Object.freeze({
    radio: 'Take the high ground. Clear the long line.',
    about: 'the long line: a deck that sees down it, foes at the far end behind their cover',
    teaches: 'the long gun at the long band: the high ground, the sights', task: 'clear', text: 'Clear the long line', band: 'long', foes: 3, fight: true,
  }),
  emplacement: Object.freeze({
    radio: 'Get on the gun.',
    about: 'the mounted gun: a gun on its mount at the near end, a wave walking up the range to it',
    teaches: 'a machine\'s gun: get on it, lay it, get off', task: 'man', text: 'Man the gun and cut them down', band: 'long', foes: 4, fight: true,
    // (a GAP, named with what would close it, never laid half: brief.js refuses it until its gun is stood)
    gap: 'the mounted gun is not built: it needs an automatic round on a pintle mount (the artillery range\'s rounds are breech-loaded shells), the turret\'s sight on a page that also carries the gunplay view, and getting on and off by the pilot\'s swap',
  }),
  holdout: Object.freeze({
    radio: 'Hold here. They are coming.',
    about: 'the yard: cover round its middle, rounds and health in it, waves from the far side on a clock',
    teaches: 'everything at once, under pressure', task: 'hold', text: 'Hold the yard', band: 'mid', foes: 3, fight: true,
  }),
  extract: Object.freeze({
    radio: 'Move. Get to the way out.',
    about: 'the way out: a short room, the exit at its end',
    teaches: 'nothing: the breath after', task: 'reach', text: 'Get out', band: null, foes: 0, fight: false,
  }),
});
export const SECTION_IDS = Object.freeze(Object.keys(SECTIONS));
