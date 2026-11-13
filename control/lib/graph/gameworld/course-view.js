/**
 * WHAT A RUNNER'S SCREEN IS MADE OF — a course seen from behind its hero (roll-course.js) is read in three bands, top to
 * bottom, the vanishing point on the line between the first two (docs/course-dress-principles.md):
 *
 *   the top third      WHERE STUFF COMES FROM. Above the vanishing point: the far end of the way and what stands over
 *                      it. Its key: READABILITY AND DISTINCTION by what the game means (what kind of thing is coming,
 *                      told by colour and outline alone)
 *   ── the vanishing point ──
 *   the middle third   WHERE STUFF COMES TO VIEW. The way, from far off down to where the player must act. Its key:
 *                      READABILITY OF FORM. This is where a thing is made interesting.
 *   the bottom third   WHERE YOU REACT TO STUFF. The stretch the player acts in, and the hero. Its key: THE CHARACTER,
 *                      and nothing else.
 *
 * A camera FRAMES a course when the bands fall there: the way's far end on the upper line, the place the player's
 * reaction begins on the lower one, the hero inside the bottom band. `courseCamera` finds that camera for a course's
 * own numbers; `viewBands` says where the bands fall for any camera, and whether it frames.
 *
 *   project(camera, p, aspect?)   → [u, v] | null   a point's place on the screen, 0 to 1 from the left and from the
 *                                   top (null behind the camera); camera { pos, look, vfov } (degrees, the vertical one)
 *   courseCamera({ react, vfov?, dist?, lead? }) → { dist, height, lookH, lead, standOff: 0 }   the follow camera (behind
 *                                   the hero by `dist`, `height` over its feet, looking `lead` ahead of it at `lookH`)
 *                                   whose upper line is the horizon and whose lower line lies `react` metres ahead
 *   cameraAt(follow, vfov?)       → { pos, look, vfov }   that follow camera behind a hero at the origin running up +y
 *   viewBands(camera, { react, top?, tall?, aspect? }) → {
 *       horizon      v of the vanishing point
 *       line         the way's distance ahead that lies on the lower line (v = 2/3), metres
 *       middle       { from, to, seconds? }   the way the middle band shows: from `line` out (to: null when the far end
 *                    is in it), and how long a thing takes to come down it at `top` m/s
 *       bottom       { from, to, seconds? }   the way the bottom band shows, ahead of the hero
 *       figure       { head, feet }   v of a hero `tall` m high (1.7) at the origin
 *       laws         [{ law, holds, says }]: far-on-the-line (the vanishing point on the upper line), react-in-the-
 *                    bottom (the reaction's place on the lower line), figure-in-the-bottom (the hero below it) }
 *
 * The hero runs up +y from the origin; the camera stands behind it. Pure.
 */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
const r2 = (v) => Math.round(v * 100) / 100;
export const VFOV = 43.808, ASPECT = 1120 / 780;   // the World page's own view: its field of view and its frame's shape

export function project(camera, p, aspect = ASPECT) {
  const f = unit(sub(camera.look, camera.pos)), r = unit(cross(f, [0, 0, 1])), u = cross(r, f), d = sub(p, camera.pos), z = dot(d, f);
  if (z <= 1e-6) return null;
  const t = Math.tan((camera.vfov * Math.PI) / 360);
  return [0.5 + dot(d, r) / (z * t * aspect) / 2, 0.5 - dot(d, u) / (z * t) / 2];
}

export const cameraAt = (follow, vfov = VFOV) => ({ pos: [0, -follow.dist, follow.height], look: [0, follow.lead, follow.lookH], vfov });

export function courseCamera({ react, vfov = VFOV, dist = 7, lead = 1.5 } = {}) {
  // a line a sixth of the screen off its middle is seen at this slope off the camera's axis
  const k = Math.tan((vfov * Math.PI) / 360) / 3, pitch = Math.atan(k);
  // the upper line the horizon: the camera pitched down by `pitch`. The lower line the ground `react` ahead of the
  // hero: seen at twice that angle under the horizon, which sets the camera's height over it
  const height = (dist + react) * Math.tan(2 * pitch);
  // (`standOff: 0`: the eye stands where this puts it; a follow camera is otherwise drawn 3 m nearer its look point,
  // scene/channels/controllable/follow-pull-in.js, which would drop the hero off the bottom of the frame)
  return { dist: r2(dist), height: r2(height), lookH: r2(height - (dist + lead) * k), lead, standOff: 0 };
}

export function viewBands(camera, { react, top = null, tall = 1.7, aspect = ASPECT } = {}) {
  const v = (d) => { const p = project(camera, [0, d, 0], aspect); return p ? p[1] : Infinity; };
  // (v falls as d grows: found by halving)
  const where = (want) => { let lo = camera.pos[1] + 0.05, hi = 1e5; for (let i = 0; i < 70; i++) { const m = (lo + hi) / 2; if (v(m) > want) lo = m; else hi = m; } return (lo + hi) / 2; };
  const horizon = v(1e7), line = where(2 / 3), far = horizon >= 1 / 3 - 0.005 ? null : where(1 / 3), edge = Math.max(0, where(1));
  const head = project(camera, [0, 0, tall], aspect)[1], feet = v(0), vr = react != null ? v(react) : null;
  const secs = (m) => (top ? { seconds: r2(m / top) } : {});
  const laws = [
    { law: 'far-on-the-line', holds: Math.abs(horizon - 1 / 3) <= 0.03, says: `the vanishing point is ${Math.round(horizon * 100)} % of the way down (the upper line is at 33 %)` },
    ...(react != null ? [{ law: 'react-in-the-bottom', holds: Math.abs(vr - 2 / 3) <= 0.04, says: `the place the reaction begins (${r2(react)} m ahead) is ${Math.round(vr * 100)} % of the way down (the lower line is at 67 %)` }] : []),
    { law: 'figure-in-the-bottom', holds: head >= 2 / 3 - 0.04 && feet <= 1, says: `the hero stands from ${Math.round(head * 100)} % to ${Math.round(feet * 100)} % of the way down (the bottom band is 67 % to 100 %)` },
  ];
  return {
    horizon: r2(horizon), line: r2(line),
    middle: { from: r2(line), to: far == null ? null : r2(far), ...(far == null ? {} : secs(far - line)) },
    bottom: { from: r2(edge), to: r2(line), ...secs(line - edge) },
    figure: { head: r2(head), feet: r2(feet) },
    laws,
  };
}
