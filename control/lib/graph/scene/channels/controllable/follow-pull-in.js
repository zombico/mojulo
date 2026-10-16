/**
 * follow-pull-in.js — how near its look point a follow camera's eye is drawn (the page's WALL PULL-IN in
 * controllable/index.js, which inlines this function by its source, so it closes over nothing).
 *
 *   followPullIn(full, hitD, lead, hz, radius, height, near) → the eye's distance from the look point, as a fraction
 *   of `full` (1 = the eye where the follow rule put it)
 *
 *     full    the follow distance: the look point to the eased eye
 *     hitD    the nearest world surface on that line (`full` when nothing is in the way)
 *     lead    how far the look point stands ahead of the subject, across the ground
 *     hz      the line's share across the ground (1 level, 0 straight up)
 *     radius  the subject's own radius (its collide volume, its capsule, its body), 0 unknown
 *     height  the subject's capsule height, 0 unknown
 *     near    the camera's near plane (the page's camera.near)
 *
 * The eye stands `skin` short of the surface (the far end of the line counts as one, so the stand-off is part of
 * every follow camera's framing, wall or none). The stand-off is 3 m for anything a person's height or taller, the
 * framing a person's and a suit's chase was tuned at, and shrinks with a smaller subject's height. However close the
 * wall, the eye never comes nearer the look point than the subject's far side (`lead + radius` across the ground) and
 * its near plane clear of it, so a wall behind a small hero cannot drag the eye into it; a first-person camera, whose
 * look point leads its own eye, is never drawn in at all.
 */
export function followPullIn(full, hitD, lead, hz, radius, height, near) {
  const skin = 3 * (height > 0 ? Math.min(1, height / 1.7) : 1);
  const clear = (lead + radius + (near || 0)) / Math.max(hz, 1e-6);
  return Math.min(1, Math.max(0.15, clear / full, (hitD - skin) / full));
}
