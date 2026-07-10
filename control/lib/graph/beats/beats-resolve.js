/**
 * beats-resolve — shared ref/revision resolution for the beats HTTP surfaces
 * (B9): the /api/beats/[ref] namespace and the /api/sketches/[ref]/beats(.wav)
 * aliases all answer `?rev=` through this one seam. The sketches row is the
 * HEAD; beats_revisions is history.
 */

import { SketchRepository } from '../../db/repositories/sketches.js';
import { BeatsRevisionRepository } from '../../db/repositories/beats.js';
import { isBeatsKind } from './beats-manifest.js';

export class BeatsHttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * resolveBeatsAt(ref, revParam) → { sketch, manifest, rev } — rev null = head.
 * Throws BeatsHttpError with the right status for route handlers to surface.
 */
export function resolveBeatsAt(ref, revParam) {
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new BeatsHttpError(404, `Sketch '${ref}' not found`);
  if (!sketch.manifest || !isBeatsKind(sketch.manifest.kind)) {
    throw new BeatsHttpError(422, `Sketch '${ref}' is not a beats artifact — beats refs are minted by create_beats`);
  }
  if (revParam === null || revParam === undefined || revParam === '') {
    return { sketch, manifest: sketch.manifest, rev: null };
  }
  const rev = Number(revParam);
  if (!Number.isInteger(rev) || rev < 1) throw new BeatsHttpError(422, '`rev` must be a positive integer');
  const revision = BeatsRevisionRepository.get(ref, rev);
  if (!revision || !revision.manifest) throw new BeatsHttpError(404, `No revision ${rev} for '${ref}'`);
  return { sketch, manifest: revision.manifest, rev };
}
