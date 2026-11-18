/**
 * THE RUN AND GUN'S FIRST LEVEL, SEEN FROM THE SIDE (the galaxy-boy rail's `level1`: "a level seen from the side, its first
 * power at the end"): the first level's teaching order (first-level.js: basic, meet, advanced, gauntlet, boss) written as a
 * side map's zone chain (zones.js), with the beats a strip never had between them. Jumping Giuseppe's strip is untouched:
 * this is the herobot's level.
 *
 *   the gate       a rest: the place shown, nothing asked, no pit (a move is taught safe first)
 *   basic          the run and the jump over the first pits
 *   meet           the first foes, from hatches a screen apart: the buster's
 *   the way down   a cascade of steps: going down is free
 *   advanced       the dash's gaps, past the running jump
 *   the chimney    the wall kick, sustained, under a frame that rises on its own: the screen from below
 *   a landing      after the climb: wide, flat, the place shown off, the next thing seen at its size
 *   gauntlet       movement and fire together, a hatch every screen
 *   the chute      the commit: a one-way drop, shut at its foot
 *   the boss       one screen, shut behind; its power the level's end (`goal.boss`; when not asked, the room holds the
 *                  power alone)
 *
 *   firstSideMap({ premise?, boss? }) → the zone chain (readSideMap's words), its premise the plant's unless said
 *   FIRST_SIDE_MAP_PREMISE
 *
 * Pure: words in, words out.
 */
export const FIRST_SIDE_MAP_PREMISE = 'Galaxy Boy breaks into the plant to stop the machine it makes';

/** The run and gun's first level as a zone chain. */
export function firstSideMap({ premise = FIRST_SIDE_MAP_PREMISE } = {}) {
  return {
    premise,
    // (crates on its runs, the buster's other target: hopped or shot apart, crates.js)
    crates: true,
    zones: [
      { run: 'across', screens: 2, beat: 'rest' },
      { run: 'across', screens: 4, teach: 'basic' },
      { run: 'across', screens: 3, teach: 'meet', spawners: 2 },
      { run: 'down', screens: 2, drop: 'cascade' },
      { run: 'across', screens: 4, teach: 'advanced' },
      { run: 'up', screens: 2, climb: 'chimney', rises: true },
      { run: 'across', screens: 2, beat: 'landing', reveal: true },
      { run: 'across', screens: 4, teach: 'gauntlet', spawners: 4 },
      { run: 'down', screens: 2, drop: 'chute' },
      { room: [1, 1], teach: 'boss' },
    ],
  };
}
