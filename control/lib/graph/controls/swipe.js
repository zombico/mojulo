/**
 * swipe.js — a finger's flick read as a gesture: a TAP or a DIRECTION, the discrete verbs a touch game is played
 * with (a lane change, a jump, a slide, a swap on a board), in place of a held stick.
 *
 * A pointer that went down and came up: its travel (dx, dy in px, screen y pointing down) and its time (ms). Within
 * the dead zone it is a tap (a quick one; a press held still is neither); past the travel, quickly enough, it is the
 * direction it went most (left, right, up, down); a slow drag, or one between the two, is nothing. Pure, no DOM:
 * the page carries the same function (swipeOf.toString()), so a test reads exactly what a phone does.
 */

export const SWIPE = Object.freeze({ dead: 12, travel: 24, ms: 600 });

/** (dx, dy, ms, opts?) → 'tap' | 'left' | 'right' | 'up' | 'down' | null. opts: { dead, travel, ms } (SWIPE's). */
export function swipeOf(dx, dy, ms, opts) {
  const dead = opts && opts.dead != null ? opts.dead : 12, travel = opts && opts.travel != null ? opts.travel : 24, most = opts && opts.ms != null ? opts.ms : 600;
  const m = Math.hypot(dx, dy);
  if (m < dead) return ms <= most ? 'tap' : null;
  if (m < travel || ms > most) return null;
  return Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
}
