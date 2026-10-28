/**
 * THE LIGHT PLOT (the scene composer, era/compose.js): a composed room lit as a theatre lights a set, from its role in
 * the walk (compose-roles.js). The shell's rhythm of lamps becomes the FILL, thinned by the mood; a KEY hangs over each
 * room's focus, its colour the plot's own that stands farthest in warmth from the fill, its intensity solved so the focus
 * is lit at the mood's ratio over the room's mean (the way on brighter than the room, the set piece the brightest thing
 * in it, a pocket's find a glint). Measured by the seventh generation's own falloff (form/room-light.js), without walls:
 * a model of the bake, not the bake (the bake tests each lamp's shadow; the sixth generation's falloff is its own).
 *
 *   MOODS        { mood: { ratio, fill, words } }: the focus's light over the room's mean, and the fill's share
 *   LIGHT_PLOT   the key's numbers: each role's weight on the ratio, where it hangs, its reach
 *   plotLights(plan, lights) → { lights, plot: [{ room, role, ratio, target, key?, short? }] }
 *     lights   the stage's placed lights (stage.js resolveStageLights); the fill thinned, a key added a room with one
 *     plot     per room: the ratio the model measures at its focus, the ratio asked, the key's intensity, and `short`
 *              when the room cannot reach it (the key's light spreads over the room as much as onto its focus)
 */
import { falloff } from '../form/room-light.js';
import { PLOTS } from './style/bay-axes.js';

export const MOODS = Object.freeze({
  even: Object.freeze({ ratio: 2, fill: 1, words: Object.freeze(['bright', 'calm', 'friendly', 'busy', 'open', 'welcoming', 'cheerful']) }),
  drama: Object.freeze({ ratio: 4, fill: 0.6, words: Object.freeze(['dramatic', 'moody', 'ominous', 'grand', 'cinematic', 'mysterious', 'theatrical']) }),
  noir: Object.freeze({ ratio: 8, fill: 0.35, words: Object.freeze(['dark', 'creepy', 'eerie', 'tense', 'stealth', 'horror', 'sinister', 'gloomy', 'abandoned', 'noir', 'menacing', 'haunted']) }),
});
export const MOOD_IDS = Object.freeze(Object.keys(MOODS));

export const LIGHT_PLOT = Object.freeze({
  // each role's weight on the mood's ratio: the goal and the great room the brightest, the way on near them, a find a
  // glint, a still room even (no key)
  roles: Object.freeze({ climax: 1, landmark: 1, arrival: 0.8, passage: 0.8, pocket: 0.5, rest: 0 }),
  // the key hangs `over` the focus, under the ceiling by `drop` at least; its reach a share of the room's diagonal, held
  // between `reach`'s ends (a key that reaches the whole room lights the room, not its focus)
  key: Object.freeze({ over: 2.2, drop: 0.6, share: 0.35, reach: Object.freeze([3, 9]) }),
  // the fixtures whose colour a key may take (a door's signal and the daylight are not a key's)
  colours: Object.freeze(['strip', 'highbay', 'ceilingStrip', 'cove', 'down', 'coffer']),
  // the room's mean measured at the eye, on a grid at most `cells` points, `inset` off the walls
  eye: 1.5, cells: 64, inset: 0.5,
});

const r4 = (v) => Math.round(v * 1e4) / 1e4;
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const warmth = (h) => { const [r, , b] = rgb(h); return r - b; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const lightAt = (ls, p) => ls.reduce((e, l) => e + l.intensity * falloff(dist(l.at, p), l.radius), 0);
const inRoom = (r, at) => at[0] >= r.x0 - 0.01 && at[0] <= r.x1 + 0.01 && at[1] >= r.y0 - 0.01 && at[1] <= r.y1 + 0.01 && at[2] >= (r.z0 ?? 0) - 0.01 && at[2] <= (r.z0 ?? 0) + r.h + 3;

// the eye-height grid a room's mean is measured on
function grid(r) {
  const { eye, cells, inset } = LIGHT_PLOT, w = r.x1 - r.x0 - 2 * inset, d = r.y1 - r.y0 - 2 * inset, z = (r.z0 ?? 0) + eye;
  const step = Math.max(0.5, Math.sqrt((Math.max(w, 0.1) * Math.max(d, 0.1)) / cells)), nx = Math.max(1, Math.round(w / step)), ny = Math.max(1, Math.round(d / step));
  const pts = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) pts.push([r.x0 + inset + ((i + 0.5) * w) / nx, r.y0 + inset + ((j + 0.5) * d) / ny, z]);
  return pts;
}

/** The plot over the placed lights: the fill thinned, a key over each room's focus solved to its ratio. */
export function plotLights(plan, lights) {
  const C = plan.compose, mood = MOODS[C.mood ?? 'even'], P = PLOTS[C.axes.plot].light, K = LIGHT_PLOT.key;
  const fill = lights.map((l) => ({ ...l, intensity: r4(l.intensity * mood.fill) }));
  const rooms = new Map(plan.rooms.map((r) => [r.id, r]));
  const keys = [], plot = [];
  for (const R of C.roles) {
    const w = LIGHT_PLOT.roles[R.role], r = rooms.get(R.room);
    if (!w) { plot.push({ room: R.room, role: R.role, ratio: null, target: null }); continue; }
    const own = fill.filter((l) => inRoom(r, l.at)), pts = grid(r), target = Math.max(1, mood.ratio * w);
    // the key's colour: the plot's own colour farthest in warmth from the room's fill (the plot's strip where it has none)
    const fw = own.length ? own.reduce((s, l) => s + warmth(l.color), 0) / own.length : warmth(P.strip.color);
    const colour = LIGHT_PLOT.colours.filter((k) => P[k]).map((k) => P[k].color).reduce((b, c) => (Math.abs(warmth(c) - fw) > Math.abs(warmth(b) - fw) ? c : b));
    const top = (r.z0 ?? 0) + r.h - K.drop, at = [R.focus[0], R.focus[1], Math.min(top, R.focus[2] + K.over)];
    const diag = Math.hypot(r.x1 - r.x0, r.y1 - r.y0), radius = r4(Math.min(K.reach[1], Math.max(K.reach[0], diag * K.share)));
    // E(focus) / mean E = target, the key k adding a at the focus and b to the mean: k = (target·Fm − Ff) / (a − target·b)
    const Ff = lightAt(own, R.focus), Fm = pts.reduce((s, p) => s + lightAt(own, p), 0) / pts.length;
    const a = falloff(dist(at, R.focus), radius), b = pts.reduce((s, p) => s + falloff(dist(at, p), radius), 0) / pts.length;
    const den = a - target * b, short = den <= 0;
    // (a room with no fill takes the key at the plot's strip; one that cannot reach its ratio, the most a key may give)
    const k = !own.length ? P.strip.intensity : short ? P.strip.intensity * mood.ratio : Math.max(0, (target * Fm - Ff) / den);
    const key = { at: at.map(r4), n: [0, 0, -1], color: colour, intensity: r4(k), radius, fixture: 'key' };
    if (key.intensity > 0) keys.push(key);
    const all = [...own, ...(key.intensity > 0 ? [key] : [])], mean = pts.reduce((s, p) => s + lightAt(all, p), 0) / pts.length;
    plot.push({ room: R.room, role: R.role, ratio: mean > 0 ? r4(lightAt(all, R.focus) / mean) : null, target, key: key.intensity, ...(short ? { short: true } : {}) });
  }
  return { lights: [...fill, ...keys], plot };
}
