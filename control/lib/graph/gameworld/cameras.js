/**
 * The camera a gameworld's levels are played through: the world's `camera`, a quick game's `quick.camera`, the cosmos
 * cube's space.camera. levels.js lowers each to a controllable pilot and camera.
 */
// absent: third person with a hero, first person without
export const CAMERAS = Object.freeze({
  'third-person': 'a chase camera behind the hero',
  'first-person': 'you look out of the hero\'s eyes (or are the walker, with no hero); the mouse looks',
  side: 'a side-scroller: the hero runs the trail\'s own line with A / D, the camera square to it and swinging round its bends (needs a hero, and a trail: a climb has no line to run)',
  'top-down': 'a ¾ overhead camera, north up the screen; W walks up the screen (needs a hero to watch)',
  fixed: 'fixed cameras along the way, high off its side, cutting from one to the next as the hero passes (the survival-horror shot; needs a hero)',
});

/** The fixed cameras of a stage: one over each of its places in order (the start, the beats, the end), standing off
 * the way to alternate sides, `up` metres high and a little back, its focus the place. → [{ at, focus }] */
export function fixedStations(ends, { off = 7, up = 5, back = 3 } = {}) {
  const pts = [ends.spawn, ...(ends.beats ?? []).filter((b) => b.beat !== 'exit' && b.beat !== 'trailhead').map((b) => b.at), ends.exit];
  const r3 = (v) => Math.round(v * 1000) / 1000;
  return pts.map((q, k) => {
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)], h = Math.atan2(b[1] - a[1], b[0] - a[0]), side = k % 2 ? -1 : 1;
    const at = [q[0] - Math.sin(h) * off * side - Math.cos(h) * back, q[1] + Math.cos(h) * off * side - Math.sin(h) * back, q[2] + up];
    return { at: at.map(r3), focus: q.map(r3) };
  });
}

/**
 * THE SCREEN'S CAMERAS (game/screen.js): how each camera rule frames an UPRIGHT frame, by rule, never by genre. A frame
 * on its side plays every camera as authored (the level's own fov across its width, held across its height).
 *   fov    the field of view across the frame's width, in degrees: an upright frame's short side
 *   pull   a chase's distance, height and lead scaled out, so the narrow width still holds the hero's surroundings
 *   rise   a follow camera's look point raised by this share of its own distance: the hero stands lower, above the
 *          thumbs (about a third of the way up, its feet clear of the bottom quarter), the way ahead above it
 *   lane   true: the camera looks across a lane that runs along the short side (advised: it sees little of it)
 * A walker's follow (dist under a metre: you are the camera) frames as the eye does.
 */
export const UPRIGHT = Object.freeze({
  follow: Object.freeze({ fov: 40, pull: 1.45, rise: 0.2 }),
  overhead: Object.freeze({ fov: 40, pull: 1.3 }),
  side: Object.freeze({ fov: 40, pull: 1.4, lane: true }),
  eye: Object.freeze({ fov: 48 }),
  fixed: Object.freeze({ fov: 48 }),
});
const WALKER_DIST = 1;
// the defaults each rule falls back to (worlds/controllable/rules-basic.js), for a camera that names none
const RULE_DEFAULTS = { follow: { dist: 6, height: 3, lead: 4, lookH: 1.5 }, overhead: { dist: 14 }, side: { dist: 11 } };
const r3c = (v) => Math.round(v * 1000) / 1000;

/** The table's row for a level's camera (its rule; a walker's follow and a camera-less level frame as the eye). */
export function uprightRow(camera) {
  const rule = camera?.rule;
  if (rule === 'follow' && (camera.dist ?? RULE_DEFAULTS.follow.dist) < WALKER_DIST) return { rule: 'eye', ...UPRIGHT.eye };
  return UPRIGHT[rule] ? { rule, ...UPRIGHT[rule] } : { rule: 'eye', ...UPRIGHT.eye };
}

/**
 * A level's camera framed for an upright frame: `camera` (the level manifest's, or null) → { camera, fov, lane? }.
 * `camera` is the chase pulled back and its look raised by the table (unchanged for the eye and the fixed stations);
 * `fov` the frame's width fov; `lane` the metres of a side camera's lane the frame sees across, and on a 16:9 screen
 * at the level's own fov (`laneWide`), for the advice. Pure.
 */
export function uprightCamera(camera, { levelFov = 75 } = {}) {
  const row = uprightRow(camera);
  if (!camera || !row.pull) return { camera, fov: row.fov };
  const d = { ...RULE_DEFAULTS[row.rule], ...camera }, out = { ...camera, dist: r3c(d.dist * row.pull) };
  if (row.rule === 'follow') Object.assign(out, { height: r3c(d.height * row.pull), lead: r3c(d.lead * row.pull), lookH: r3c(d.lookH + d.dist * row.rise) });
  const across = (dist, fov) => Math.round(2 * dist * Math.tan(fov * Math.PI / 360));
  return { camera: out, fov: row.fov, ...(row.lane ? { lane: across(out.dist, row.fov), laneWide: across(d.dist, levelFov) } : {}) };
}
