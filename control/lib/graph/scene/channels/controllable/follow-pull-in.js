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
 *     standOff  (opt-in, the camera rule's `standOff`) the open-line stand-off in metres in place of the default: 0
 *             stands the eye where the rule puts it (a shooter's over the shoulder, gameworld/quick.js SHOULDER, whose
 *             rounds converge from the rule's own eye); absent, the default below
 *
 * Two stand-offs. With nothing in the way the eye stands `skin` short of the line's far end (the stand-off is part of
 * every follow camera's framing: 3 m for anything a person's height or taller, the framing a suit's chase was tuned at,
 * shrinking with a smaller subject's height; a hero's chase, playscape/player.js, is laid long by it). Against a wall it
 * stands only `wallSkin` short of the wall (half a metre for a person, its near plane clear of the face), never farther
 * out than the open line would put it: a hero two metres inside a room keeps the room's depth behind it instead of
 * losing 3 m of it to the stand-off (2026-11-02: the eye was drawn to the hero's back, 88 % of the frame indoors).
 * However close the wall, the eye never comes nearer the look point than the subject's far side (`lead + radius` across
 * the ground) and its near plane clear of it, so a wall behind a small hero cannot drag the eye into it; a first-person
 * camera, whose look point leads its own eye, is never drawn in at all.
 */
export function followPullIn(full, hitD, lead, hz, radius, height, near, standOff) {
  const k = height > 0 ? Math.min(1, height / 1.7) : 1, skin = standOff >= 0 ? standOff : 3 * k, wallSkin = 0.5 * k + (near || 0);
  const clear = (lead + radius + (near || 0)) / Math.max(hz, 1e-6);
  // (the wall's skin only where there is a wall: `hitD` is the whole line when nothing is in the way)
  return Math.min(1, Math.max(0.15, clear / full, Math.min(full - skin, hitD < full ? hitD - wallSkin : Infinity) / full));
}
