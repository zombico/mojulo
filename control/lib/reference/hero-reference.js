/**
 * A hero's `reference` word: the stamp a hero made from a picture carries (capture_reference target 'character').
 *
 *   reference: { stash?, likeness: 'original' | 'x-like', like?, changed? }
 *
 * `stash` is the reference stash the read is filed in (its passes, its insights); `likeness` is the model's verdict on
 * the picture (character-protocol.js `likeness`): 'original' for an original character or the person themselves,
 * 'x-like' for a build in the spirit of identifiably trademarked work, with `like` (what it is like) and `changed` (what
 * the build changed). The stamp is data: no gate reads it, nothing refuses on it, and the person can change it or take
 * it off (`null`) like any word. Absent, it adds nothing to the row.
 *
 * Pure (no imports): the hero door (lib/mcp/tools/layered.js) validates, stores and reads it back through here.
 */

export const LIKENESS_VERDICTS = Object.freeze(['original', 'x-like']);
const STASH_REF = /^[A-Za-z0-9_-]{1,64}$/;
const LIKE_MAX = 200, CHANGED_MAX = 12;

/** Error strings for a `reference` word (empty = valid). */
export function validateHeroReference(ref, at = 'reference') {
  if (ref === undefined || ref === null) return [];
  if (typeof ref !== 'object' || Array.isArray(ref)) return [`${at}: { likeness: ${LIKENESS_VERDICTS.map((v) => `'${v}'`).join(' | ')}, like?, changed?, stash? } (the stamp a hero from a picture carries)`];
  const errs = [];
  const known = ['stash', 'likeness', 'like', 'changed'];
  for (const k of Object.keys(ref)) if (!known.includes(k)) errs.push(`${at}.${k}: not a reference word (${known.join(', ')})`);
  if (!LIKENESS_VERDICTS.includes(ref.likeness)) errs.push(`${at}.likeness: ${LIKENESS_VERDICTS.map((v) => `'${v}'`).join(' | ')}`);
  if (ref.like !== undefined && (typeof ref.like !== 'string' || !ref.like.trim() || ref.like.length > LIKE_MAX)) errs.push(`${at}.like: what it is like, a phrase (≤ ${LIKE_MAX} characters)`);
  if (ref.likeness === 'x-like' && ref.like === undefined) errs.push(`${at}.like: an x-like hero says what it is like`);
  if (ref.changed !== undefined && (!Array.isArray(ref.changed) || ref.changed.length > CHANGED_MAX || ref.changed.some((c) => typeof c !== 'string' || !c.trim() || c.length > LIKE_MAX))) {
    errs.push(`${at}.changed: a list of what the build changed (≤ ${CHANGED_MAX} phrases)`);
  }
  if (ref.stash !== undefined && (typeof ref.stash !== 'string' || !STASH_REF.test(ref.stash))) errs.push(`${at}.stash: a stash ref`);
  return errs;
}

/** The stamp as stored: its words as given, in a fixed order. */
export function heroReferenceRecord(ref) {
  return {
    likeness: ref.likeness,
    ...(ref.like !== undefined ? { like: ref.like.trim() } : {}),
    ...(ref.changed !== undefined ? { changed: ref.changed.map((c) => c.trim()) } : {}),
    ...(ref.stash !== undefined ? { stash: ref.stash } : {}),
  };
}

/** The readout's `reference`: the stamp, and for an x-like hero the caption derived work carries. */
export function heroReferenceReadout(ref) {
  if (!ref || typeof ref !== 'object') return null;
  return { ...ref, ...(ref.likeness === 'x-like' ? { caption: `X-like: inspired by ${ref.like}` } : {}) };
}
