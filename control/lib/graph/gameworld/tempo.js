/**
 * tempo — a game's WORLD CLOCK (worlds/controllable/world-clock.js): the moments that slow or hold its live levels on what
 * happens in play, the camera keeping real time. Laid on every level as its `tempo`, as the juice is laid as `fxStyle`.
 *
 *   gameworld.tempo: 'auto' | false | a word | [words and moments] | { moments: [{ on, scale, hold, ramp?, cooldown? }] }
 *     'auto'   the game type's own (its juice flavor, juice.js): an action game slows on its finisher; the realistic, the
 *              platformer and the pinball's flavors keep real time (the impact is a hitstop's, not the world's)
 *     words    world-clock.js TEMPO_PRESETS: finisher, kill-cam, impact, bullet
 *
 *   readGameTempo(raw)          → raw, or throws naming what it takes (the world's read)
 *   tempoOfGame(G)              → { tempo, from, why } every level's `tempo`, or null (none written, false, or 'auto' on
 *                                 a game type that keeps real time)
 *   tempoSuggestion(G)          → what 'auto' would lay on a world that writes none, or null
 *
 * Pure.
 */
import { readTempo } from '../worlds/controllable/world-clock.js';
import { juiceOfGame, juiceSuggestion } from './juice.js';

/** each juice flavor's own tempo for 'auto' (null: real time) */
export const TEMPO_OF_FLAVOR = Object.freeze({ action: 'finisher', realistic: null, platformer: null, pinball: null });

/** A world's written tempo, read (throws naming what it takes); returns it as written. */
export function readGameTempo(raw) {
  if (raw === undefined || raw === null || raw === false || raw === 'auto') return raw;
  try { readTempo(raw); } catch (e) { throw new Error(`gameworld: ${e.message} ('auto' takes the game type's own; false keeps real time)`); }
  return raw;
}

const flavorOf = (G) => (juiceOfGame(G) ?? juiceSuggestion({ ...G, juice: undefined }))?.fxStyle?.flavor ?? null;

function resolve(G, own) {
  if (own !== 'auto') return { tempo: readTempo(own), from: 'operator', why: 'the operator\'s word' };
  const flavor = flavorOf(G), word = flavor ? TEMPO_OF_FLAVOR[flavor] ?? null : null;
  if (!word) return null;
  return { tempo: readTempo(word), from: 'flavor', why: `its game type plays the ${flavor} flavor, whose big moments slow the world: ${word}` };
}

/** The tempo every level of a world carries, or null. */
export function tempoOfGame(G) {
  const own = G?.tempo;
  if (own === undefined || own === null || own === false) return null;
  const R = resolve(G, own);
  return R && R.tempo ? R : null;
}

/** What `tempo: 'auto'` would lay on a world that writes no tempo (null when it writes one, or when auto lays none). */
export function tempoSuggestion(G) {
  if (!G || G.tempo !== undefined) return null;
  const R = resolve(G, 'auto');
  return R && R.tempo ? R : null;
}
