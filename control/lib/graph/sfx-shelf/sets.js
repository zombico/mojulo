/**
 * sfx-shelf/sets — the sets a sound's voice comes from. A set is a book of cues (beats-sfx gesture lists) under the
 * roster's ids; a row's `voices` names, per style, the set that voices it. A set may name its `floor`: the set it
 * improves on, cue for cue, each of its cues held to that floor's on the yardstick (measure.js meetsFloor). A floor
 * voices nothing itself once a better set stands on it; it stays as the measure. A new set is a file under `sets/` and
 * a line here. Pure data.
 */
import { MECHA } from './sets/mecha.js';
import { MECHA_LAYERED } from './sets/mecha-layered.js';

export const SETS = Object.freeze({
  mecha: MECHA,
  'mecha-layered': MECHA_LAYERED,
});

/** The sets some other set stands on. */
export const FLOOR_SETS = Object.freeze([...new Set(Object.values(SETS).map((s) => s.floor).filter(Boolean))]);

export const SET_NAMES = Object.freeze(Object.keys(SETS));

/** A set as a beats-sfx manifest: what `create_beats` mints, the /beats studio plays and beats-render renders. */
export function setManifest(name, { space } = {}) {
  const S = SETS[name];
  if (!S) throw new Error(`sfx set '${name}': one of ${SET_NAMES.join(', ')}`);
  return { kind: 'beats-sfx', title: `${S.label} (sfx shelf: ${name})`, cues: S.cues, ...(space ? { mix: { space } } : {}) };
}
