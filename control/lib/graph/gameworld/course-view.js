/**
 * WHAT A RUNNER'S SCREEN IS MADE OF — a course seen from behind its hero (roll-course.js) is read in three places, and
 * a dress (course-dress.js) is made for them in this order (docs/course-dress-principles.md):
 *
 *   the figure   the hero's back, low on the screen: what the player is, always there
 *   the far      the vanishing point: where the eye rests to READ what is coming; a thing there is a few pixels, so it
 *                must be told by its colour and its outline alone, in time to be acted on
 *   the middle   the screen's middle third: where a thing is when it is ACTED on, and the only place it is ever seen
 *                large and whole. The highest fidelity belongs here, and nowhere else is worth it.
 *
 * So the size of one designed piece is the size a thing has when it fills a third of the screen: this says, for a
 * camera and a hero's speed, how far ahead that is, how long before the thing is met, and how long it stays that big.
 *
 *   project(camera, p, aspect?)   → [u, v] | null   a point's place on the screen, 0 to 1 from the left and from the
 *                                   top (null behind the camera); camera { pos, look, vfov } (degrees, the vertical one)
 *   viewZones(camera, { top, width?, aspect? }) → {
 *       horizon        v of the vanishing point (where the way's far end goes)
 *       figure         { v: [head, feet] } the hero on the screen (a body 1.7 m tall at the origin)
 *       middle         { from, to } metres ahead of the hero that the way's ground lies in the screen's middle third
 *       third          { at, seconds, px } how far ahead a thing as wide as the way (`width` m) fills a third of the
 *                      screen's width, how long before it is met at `top` m/s, and its width on a 1280 px screen
 *       far            { at, px } the same thing where it is first read (the course's sight, `sight` m, when given)
 *       dwell          seconds a thing spends between filling a sixth and a half of the screen's width: how long it is
 *                      looked at large }
 *
 * The hero runs up +y from the origin; the camera stands behind it. Pure.
 */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
const r2 = (v) => Math.round(v * 100) / 100;

export function project(camera, p, aspect = 16 / 9) {
  const f = unit(sub(camera.look, camera.pos)), r = unit(cross(f, [0, 0, 1])), u = cross(r, f), d = sub(p, camera.pos), z = dot(d, f);
  if (z <= 1e-6) return null;
  const t = Math.tan((camera.vfov * Math.PI) / 360);
  return [0.5 + dot(d, r) / (z * t * aspect) / 2, 0.5 - dot(d, u) / (z * t) / 2];
}

export function viewZones(camera, { top, width = 6.6, sight = null, aspect = 16 / 9 } = {}) {
  const v = (d) => project(camera, [0, d, 0], aspect)[1];
  // how wide a thing `width` m across, standing on the way d metres ahead, is on the screen (a share of its width)
  const share = (d) => { const a = project(camera, [-width / 2, d, 0], aspect), b = project(camera, [width / 2, d, 0], aspect); return a && b ? b[0] - a[0] : Infinity; };
  // (both fall as d grows: found by halving)
  const where = (fn, want, lo = -3, hi = 4000) => { for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (fn(m) > want) lo = m; else hi = m; } return (lo + hi) / 2; };
  const at = where(share, 1 / 3), sixth = where(share, 1 / 6), half = where(share, 1 / 2);
  return {
    horizon: r2(v(1e6)),
    figure: { v: [r2(project(camera, [0, 0, 1.7], aspect)[1]), r2(v(0))] },
    middle: { from: r2(where(v, 2 / 3)), to: r2(where(v, 1 / 3 + 0.02)) },
    third: { at: r2(at), ...(top ? { seconds: r2(at / top) } : {}), px: Math.round(1280 / 3) },
    ...(sight ? { far: { at: sight, px: Math.round(share(sight) * 1280) } } : {}),
    ...(top ? { dwell: r2((sixth - half) / top) } : {}),
  };
}
