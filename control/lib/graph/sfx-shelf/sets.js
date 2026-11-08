/**
 * sfx-shelf/sets — the sets a sound's voice comes from. A set is a book of cues (beats-sfx gesture lists) under the
 * roster's ids; a row's `voices` names, per style, the set that voices it. A new set is a file under `sets/` and a line
 * here. Pure data.
 */
import { MECHA } from './sets/mecha.js';

export const SETS = Object.freeze({
  mecha: MECHA,
});

export const SET_NAMES = Object.freeze(Object.keys(SETS));

/** A set as a beats-sfx manifest: what `create_beats` mints, the /beats studio plays and beats-render renders. */
export function setManifest(name) {
  const S = SETS[name];
  if (!S) throw new Error(`sfx set '${name}': one of ${SET_NAMES.join(', ')}`);
  return { kind: 'beats-sfx', title: `${S.label} (sfx shelf: ${name})`, cues: S.cues };
}
