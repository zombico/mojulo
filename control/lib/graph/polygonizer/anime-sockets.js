/** anime-sockets.js — THE SOCKET LIBRARY: each brow drawing (anime-drawings.js) carries its own eye socket, so animating
 * the brows animates the socket for that frame. A socket is part of its drawing's build (anime-form.js `socket`: the
 * ridge over the eye, the socket's upper plane, its inner and outer ends, above the widest lid's lash band only), so the
 * drawing's 7G target carries it and it snaps with the drawing, held on twos (face-acting/anime-read.js).
 *
 * One base table for every anime head, tuned first on Shonen High's: the rest brow's socket is the head's own (the form's
 * `orbit`, tied to the brow by its rim); a raised brow lifts the ridge back and opens the socket's upper plane shallow; a
 * lowered one brings the ridge forward and hoods the outer end; a knit, angry brow brings the ridge forward hardest,
 * cuts the socket deeper and bunches its inner end toward the nose; a worried one eases the inner end back and lets the
 * outer end hood. Words (construction units, the head about 2.2 tall; 0 the head's own socket):
 *   ridge  the brow's ridge over the eye forward (back when negative)
 *   deep   the socket's upper plane cut deeper (shallower when negative)
 *   pinch  the inner end bunched forward toward the nose (eased back when negative)
 *   outer  the outer end hooded forward (lifted back when negative)
 * A hero reads the table under hero laws 20 on the head's form (anime-looks.js animeFormed); a row minted before draws
 * its brows as it did. Pure data and lookups; no dice.
 */
import { animeFormed } from './anime-looks.js';
import { DRAWING_RANGES } from './anime-drawings.js';

/** each word's range ([lo, hi]): the drawing word's (anime-drawings.js), so the head refuses what the table may not hold */
export const SOCKET_RANGES = DRAWING_RANGES.socket;

/** the base table: a brow drawing's socket by its name (a drawing not named keeps the head's own socket) */
export const SOCKETS = Object.freeze({
  'brows.raised': Object.freeze({ ridge: -0.008, deep: -0.008, outer: -0.004 }),
  'brows.low': Object.freeze({ ridge: 0.007, deep: 0.004, outer: 0.006 }),
  'brows.angry': Object.freeze({ ridge: 0.008, deep: 0.006, pinch: 0.014, outer: 0.004 }),
  'brows.worried': Object.freeze({ ridge: -0.004, pinch: -0.008, outer: 0.006 }),
});

/** the hero laws that read the table (hero-form.js HERO_LAWS_VERSION) */
export const SOCKET_LAWS = 20;
/** does this hero draw its brows with their sockets: its head's form (laws 19, not the child's face) under laws 20 */
export const socketsOn = (hero) => !!hero && hero.head === 'anime' && (hero.laws ?? 1) >= SOCKET_LAWS && animeFormed(hero);
/** a drawing's build words with its socket (when `on` and the table names one), else the words as they are */
export const withSocket = (name, words, on) => (on && SOCKETS[name] ? { ...words, socket: { ...SOCKETS[name] } } : words);

/** Error strings (empty = valid): the table's entries inside SOCKET_RANGES, each keyed by a brow drawing */
export function socketErrors(table = SOCKETS, drawings = null) {
  const errs = [];
  for (const [name, K] of Object.entries(table)) {
    if (!name.startsWith('brows.')) errs.push(`${name}: a socket is a brow drawing's`);
    if (drawings && !drawings[name]) errs.push(`${name}: not a drawing`);
    for (const [k, v] of Object.entries(K)) {
      const R = SOCKET_RANGES[k];
      if (!R) errs.push(`${name}.${k}: not a socket word (have ${Object.keys(SOCKET_RANGES).join(', ')})`);
      else if (!(Number.isFinite(v) && v >= R[0] && v <= R[1])) errs.push(`${name}.${k}: a number in [${R.join(', ')}]`);
    }
  }
  return errs;
}
