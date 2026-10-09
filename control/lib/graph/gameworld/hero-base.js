/**
 * THE HERO'S BASE — the bare, in-world version the creator calls the base, pinned as a revision. Adornment and motion
 * branch from it and never overwrite it: the sketch row always holds HEAD, and `sketch_revisions` keeps every earlier
 * manifest, so a pin is a `{ ref, rev, print }` and the print says whether the revision still reads as it did.
 *
 *   looks.base = { ref, rev, print }       the pin (characters.js reads its shape)
 *   basePrint(manifest)                    the print of what a hero IS: its `hero` spec, so a rename moves nothing
 *   pinBase({ ref, rev, manifest })        the pin for a revision the creator has settled on
 *   verifyBase(base, lookup)               'pinned' | 'drifted' | 'missing': does that revision still print as pinned?
 *   revisionLookup({ headRev, head, get }) the lookup over a row and its archive
 *
 * Pure: the database is the caller's. `lookup(ref, rev)` returns the manifest at that revision, or null.
 */
import { fingerprint } from './review.js';

/** What a hero is: its spec. A manifest with no hero stands for itself. */
export const basePrint = (manifest) => fingerprint(manifest && typeof manifest === 'object' && 'hero' in manifest ? manifest.hero : manifest);

/** The pin for a revision: `manifest` is that revision's own. */
export function pinBase({ ref, rev, manifest }) {
  if (typeof ref !== 'string' || !ref) throw new Error('base: a pin names the sketch ref');
  if (!Number.isInteger(rev) || rev < 1) throw new Error('base: a pin names a revision, 1 or more');
  if (!manifest || typeof manifest !== 'object') throw new Error('base: a pin reads the manifest of that revision');
  return { ref, rev, print: basePrint(manifest) };
}

/**
 * Does the pinned revision still print as it did? `pinned`: yes. `drifted`: the revision exists and prints differently.
 * `missing`: the sketch or the revision is gone. Advises; nothing refuses.
 */
export function verifyBase(base, lookup) {
  if (!base) return { status: 'missing', why: 'no base is pinned' };
  const manifest = lookup(base.ref, base.rev);
  if (!manifest) return { status: 'missing', why: `no revision ${base.rev} of '${base.ref}'` };
  const print = basePrint(manifest);
  return print === base.print ? { status: 'pinned', print } : { status: 'drifted', print, was: base.print, why: `revision ${base.rev} of '${base.ref}' prints ${print}, pinned as ${base.print}` };
}

/**
 * The lookup over a sketch row and its archive. The archive holds every revision before HEAD (revision N is written
 * when edit N+1 arrives), so `headRev` is one past the newest archived one: `head` is the row's manifest, `get(ref,
 * rev)` reads an archived one.
 */
export function revisionLookup({ ref, headRev, head, get }) {
  return (r, rev) => (r !== ref ? null : rev === headRev ? head : rev < headRev ? get(r, rev) : null);
}
