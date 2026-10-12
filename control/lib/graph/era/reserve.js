/**
 * RESERVE — ground a stage's buildings have claimed, planned before anything grows on it. A recipe's buildings and
 * town street are seated first (era/stage-buildings.js, a planning pass over the land alone), and their footprints
 * come back to the open-ground builders as `_keepOut` rects: trees, rocks, arrangements and live grass are placed on
 * the rest of the site, so nothing stands half in a wall or hangs its crown through a roof.
 *
 *   reserveSite(site, keep)   the site's `clear(x, y)` (what the trees and arrangements already keep out of) widened to
 *                             the reserved ground, a crown's reach round it; `site.reserved` the rects
 *   kept(keep, x, y, m)       true when (x, y) stands at least `m` off every reserved rect
 *
 * Absent `_keepOut`, nothing here is called and a stage lays as it did.
 */
export const CROWN = 2.5;   // m: a tree's reach past its trunk, kept off a wall

export function kept(keep, x, y, m = 0) {
  if (!keep) return true;
  for (const B of keep) if (x > B[0] - m && x < B[2] + m && y > B[1] - m && y < B[3] + m) return false;
  return true;
}

export function reserveSite(site, keep) {
  if (!keep || !keep.length) return site;
  const own = site.clear;
  site.reserved = keep;
  site.clear = (x, y) => !kept(keep, x, y, CROWN) || !!(own && own(x, y));
  return site;
}
