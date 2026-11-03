/**
 * role — WHO the character is in this piece, whatever its style: the state of mind it holds under every line, the face
 * it rests in, and its STATUS (Johnstone's: the high-status player keeps the head up and still and the eyes where they
 * are put; the low-status player drops the head and lets the eyes go). How it speaks is its delivery register
 * (persona/delivery.js), the persona's `register`: a role of speech.
 *
 *   { emote?: a held state (face-acting/emotes.js FACE_EMOTES: the base every beat's face adds to), face?: a resting
 *     emotion (face-acting/emotions.js, over the register's), status?: 'high' | 'even' | 'low' }
 *
 * Pure data and its checks.
 */
import { FACE_EMOTE_NAMES } from '../face-acting/emotes.js';
import { EMOTION_NAMES } from '../face-acting/emotions.js';

/** what a status does to the carriage and the eyes: `pitch` degrees on the register's head, `glance` a factor on the
 * style's glances */
export const STATUS = Object.freeze({
  high: Object.freeze({ reads: 'the head up and still, the eyes kept where they are put', pitch: 3, glance: 0.5 }),
  even: Object.freeze({ reads: 'as the register and the style carry it', pitch: 0, glance: 1 }),
  low: Object.freeze({ reads: 'the head dropped, the eyes leaving and coming back', pitch: -4, glance: 1.8 }),
});
export const STATUS_NAMES = Object.freeze(Object.keys(STATUS));
const ROLE_KEYS = ['emote', 'face', 'status'];

/** Error lines for a role (empty = valid) */
export function roleErrors(R, at = 'role') {
  if (!R || typeof R !== 'object' || Array.isArray(R)) return [`${at}: { emote?, face?, status? }`];
  const errs = [], extra = Object.keys(R).filter((k) => !ROLE_KEYS.includes(k));
  if (extra.length) errs.push(`${at}: a role takes ${ROLE_KEYS.join(', ')} (not ${extra.join(', ')})`);
  if (R.emote !== undefined && !FACE_EMOTE_NAMES.includes(R.emote)) errs.push(`${at}.emote: a held state (${FACE_EMOTE_NAMES.join(', ')})`);
  if (R.face !== undefined && !EMOTION_NAMES.includes(R.face)) errs.push(`${at}.face: an emotion (${EMOTION_NAMES.join(', ')})`);
  if (R.status !== undefined && !STATUS_NAMES.includes(R.status)) errs.push(`${at}.status: ${STATUS_NAMES.join(' | ')}`);
  return errs;
}

/** A role with its status resolved: { emote?, face?, status, pitch, glance } */
export function roleOf(R = {}) {
  const status = R.status ?? 'even';
  return { ...(R.emote ? { emote: R.emote } : {}), ...(R.face ? { face: R.face } : {}), status, pitch: STATUS[status].pitch, glance: STATUS[status].glance };
}
