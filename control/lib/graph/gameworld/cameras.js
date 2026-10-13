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
