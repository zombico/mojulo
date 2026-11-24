/**
 * keying — a game's KEYING (worlds/controllable/keying.js): its bodies drawn on twos or threes in play, each layer its
 * own grain, the world and the camera on ones. Laid on every level as its `keying`, as the tempo is laid as `tempo`.
 *
 *   gameworld.keying: 'auto' | false | 'ones' | 'twos' | 'threes' | { hero?, cast?, fps?, root? }
 *     'auto'   the juice's look (juice.js): the cel look (the anime fighter's and the brawler's, its effects already drawn
 *              on twos) keys its bodies on twos; the anime isekai look ("smooth, every frame") and the western register
 *              draw every frame
 *
 *   readGameKeying(raw)    → raw, or throws naming what it takes (the world's read)
 *   keyingOfGame(G)        → { keying, from, why } every level's `keying`, or null (none written, false, all on ones, or
 *                            'auto' on a look drawn every frame)
 *   keyingSuggestion(G)    → what 'auto' would lay on a world that writes none, or null
 *
 * Pure.
 */
import { readKeying } from '../worlds/controllable/keying.js';
import { juiceOfGame, juiceSuggestion } from './juice.js';

/** each juice look's own keying for 'auto' (null: every frame) */
export const KEYING_OF_LOOK = Object.freeze({ cel: 'twos', isekai: null, material: null });

/** A world's written keying, read (throws naming what it takes); returns it as written. */
export function readGameKeying(raw) {
  if (raw === undefined || raw === null || raw === false || raw === 'auto') return raw;
  try { readKeying(raw); } catch (e) { throw new Error(`gameworld: ${e.message} ('auto' takes the juice's look; false draws every frame)`); }
  return raw;
}

const lookOf = (G) => (juiceOfGame(G) ?? juiceSuggestion({ ...G, juice: undefined }))?.fxStyle?.look ?? null;

function resolve(G, own) {
  if (own !== 'auto') return { keying: readKeying(own), from: 'operator', why: 'the operator\'s word' };
  const look = lookOf(G), word = look ? KEYING_OF_LOOK[look] ?? null : null;
  if (!word) return null;
  return { keying: readKeying(word), from: 'look', why: `its juice is drawn in the ${look} look, whose effects are on ${word}: its bodies are too` };
}

/** The keying every level of a world carries, or null. */
export function keyingOfGame(G) {
  const own = G?.keying;
  if (own === undefined || own === null || own === false) return null;
  const R = resolve(G, own);
  return R && R.keying ? R : null;
}

/** What `keying: 'auto'` would lay on a world that writes no keying (null when it writes one, or when auto lays none). */
export function keyingSuggestion(G) {
  if (!G || G.keying !== undefined) return null;
  const R = resolve(G, 'auto');
  return R && R.keying ? R : null;
}
