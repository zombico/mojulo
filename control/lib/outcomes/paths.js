/**
 * Outcome path helpers — shared by all publication kinds and by the HTTP
 * route that serves outcome folders. Kept separate from any one kind's writer
 * so the kinds/ tree doesn't import from itself.
 */

import path from 'node:path';

export function outcomesBaseDir() {
  return process.env.MOJULO_OUTCOMES_DIR || path.join(process.cwd(), 'data', 'outcomes');
}

/** Resolve the on-disk folder for a cook_ref. */
export function outcomeDirFor(cookRef) {
  return path.join(outcomesBaseDir(), cookRef);
}

/** Public URL prefix for serving outcome files. */
export function outcomeUrlFor(cookRef) {
  return `/outcomes/${encodeURIComponent(cookRef)}/`;
}
