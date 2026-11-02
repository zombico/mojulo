/**
 * grade — a game's GRADE (scene/channels/grade.js): the look laid over every frame of its levels, the base its moments'
 * looks (world-clock.js) push from and return to. Laid on every level as its `grade`, as the juice is laid as `fxStyle`.
 *
 *   gameworld.grade: 'auto' | false | a word | dials | { from: word, …dials }
 *     'auto'   the register's own (its juice, juice.js): anime is drawn vivid, western on film
 *     words    grade.js GRADE_PRESETS: film, noir, bleach, vivid, dream, cold, warm
 *
 *   readGameGrade(raw)   → raw, or throws naming what it takes (the world's read)
 *   gradeOfGame(G)       → { grade, from, why } every level's `grade` (its dials), or null (none written, or false)
 *   gradeSuggestion(G)   → what 'auto' would lay on a world that writes none, or null
 *
 * Pure.
 */
import { readGrade } from '../scene/channels/grade.js';
import { juiceOfGame, juiceSuggestion } from './juice.js';

/** each juice register's own grade for 'auto' */
export const GRADE_OF_REGISTER = Object.freeze({ anime: 'vivid', western: 'film' });

/** A world's written grade, read (throws naming what it takes); returns it as written. */
export function readGameGrade(raw) {
  if (raw === undefined || raw === null || raw === false || raw === 'auto') return raw;
  try { readGrade(raw); } catch (e) { throw new Error(`gameworld: ${e.message} ('auto' takes the game's register; false draws the frame as it is)`); }
  return raw;
}

const registerOf = (G) => (juiceOfGame(G) ?? juiceSuggestion({ ...G, juice: undefined }))?.fxStyle?.register ?? null;

function resolve(G, own) {
  if (own !== 'auto') return { grade: readGrade(own), from: 'operator', why: 'the operator\'s word' };
  const register = registerOf(G), word = register ? GRADE_OF_REGISTER[register] ?? null : null;
  return word ? { grade: readGrade(word), from: 'register', why: `its register is ${register}, graded ${word}` } : null;
}

/** The grade every level of a world carries, or null. */
export function gradeOfGame(G) {
  const own = G?.grade;
  if (own === undefined || own === null || own === false) return null;
  const R = resolve(G, own);
  return R && R.grade ? R : null;
}

/** What `grade: 'auto'` would lay on a world that writes no grade (null when it writes one). */
export function gradeSuggestion(G) {
  if (!G || G.grade !== undefined) return null;
  const R = resolve(G, 'auto');
  return R && R.grade ? R : null;
}
