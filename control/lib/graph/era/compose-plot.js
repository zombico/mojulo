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
 *   BEATS        { beat: { rate, colour?, words } }: a light a beat changes (an alarm, a slow pulse, a failing practical),
 *                lit live by the seventh generation's page and kept out of its bake; the sixth bakes it steady
 *   plotLights(plan, lights) → { lights, plot: [{ room, role, ratio, target, key?, short?, beat? }] }
 *   keyTuner(plan) → the seventh generation's bake's tuner (era/stage.js formLightFaces `tune`): each key scaled so its
 *            focus holds its ratio on the bake itself (the corners round the focus over the room's, ambient, shadows and
 *            bounce counted), where the model above only guessed; a key at most KEY_MOST times the middle fill lamp's
 *            light before the mood thinned it (past that it burns its focus out), else short. A beat's key is tuned for its peak, the bake holding none of it. `tune.record`:
 *            { room: { scale, ratio, short?, peak? } }, what it reached on the bake
 *   focusReach(room), roomOfPoint(plan, p): the reach round a room's focus it is read by, and a point's room by its
 *            height too
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

export const BEATS = Object.freeze({
  alarm: Object.freeze({ rate: 1.1, colour: 'door', words: 'a beacon sweeping round, the register\'s signal colour' }),
  pulse: Object.freeze({ rate: 0.2, words: 'a slow breath of light' }),
  flicker: Object.freeze({ rate: 12, words: 'a failing lamp, mostly on' }),
});
export const BEAT_IDS = Object.freeze(Object.keys(BEATS));

export const LIGHT_PLOT = Object.freeze({
  // the keys a beat takes, by role and mood (none where the mood is even): the goal breathes in drama and sounds its alarm
  // in the dark, a pocket's find flickers in the dark
  beats: Object.freeze({ climax: Object.freeze({ drama: 'pulse', noir: 'alarm' }), pocket: Object.freeze({ noir: 'flicker' }) }),
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

// (the reach round a focus a room is read by, in plan: the column round it, floor to ceiling; a share of the room's
// diagonal, held between FOCUS's ends: a fixed reach would cover half a small room's floor, and no key lifts a spot that
// big to a ratio over its room)
export const FOCUS = Object.freeze([1, 2.5]);
export const focusReach = (r) => Math.min(FOCUS[1], Math.max(FOCUS[0], 0.15 * Math.hypot(r.x1 - r.x0, r.y1 - r.y0)));
// (a key at most KEY_MOST times the middle fill lamp's light as it was before the mood thinned it: past that it burns
// its focus out)
const KEY_MOST = 10;
const r4 = (v) => Math.round(v * 1e4) / 1e4;
/** A point's room (its id): the room round it, by its height too (storeys stand over each other). */
export const roomOfPoint = (plan, p) => plan.rooms.find((r) => p[0] >= r.x0 - 0.3 && p[0] <= r.x1 + 0.3 && p[1] >= r.y0 - 0.3 && p[1] <= r.y1 + 0.3 && p[2] >= (r.z0 ?? 0) - 0.3 && p[2] <= (r.z0 ?? 0) + r.h + 0.3)?.id ?? null;
const lumOf = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
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
    // a beat (pinned per room, 'none' for none, else the role's in this mood): an alarm in the register's signal colour
    const pin = C.beats?.[R.room], beat = pin === 'none' ? null : pin ?? LIGHT_PLOT.beats[R.role]?.[C.mood ?? 'even'] ?? null;
    const hue = beat && BEATS[beat].colour ? P[BEATS[beat].colour].color : colour;
    const key = { at: at.map(r4), n: [0, 0, -1], color: hue, intensity: r4(k), radius, fixture: 'key', room: R.room, ...(beat ? { beat, rate: BEATS[beat].rate } : {}) };
    if (key.intensity > 0) keys.push(key);
    const all = [...own, ...(key.intensity > 0 ? [key] : [])], mean = pts.reduce((s, p) => s + lightAt(all, p), 0) / pts.length;
    plot.push({ room: R.room, role: R.role, ratio: mean > 0 ? r4(lightAt(all, R.focus) / mean) : null, target, key: key.intensity, ...(short ? { short: true } : {}), ...(beat ? { beat } : {}) });
  }
  return { lights: [...fill, ...keys], plot };
}

/** The bake's tuner: each steady key scaled so its room's focus holds its ratio on the baked corners themselves. */
export function keyTuner(plan) {
  const C = plan.compose, mood = MOODS[C.mood ?? 'even'];
  const record = {};
  const tune = ({ raw, shares, keys, ambient, lights }) => {
    const scale = lights.map(() => 1), Ka = lumOf(ambient), Kl = keys.map(lumOf), per = new Map(plan.rooms.map((r) => [r.id, []]));
    const fills = Kl.filter((_, j) => lights[j].fixture !== 'key').sort((a, b) => a - b), fill = fills.length ? fills[(fills.length - 1) >> 1] : 1;
    raw.forEach((f, i) => {
      if (!shares[i]) return;
      const c = [0, 1, 2].map((k) => f.corners.reduce((s, p) => s + p[k], 0) / f.corners.length), room = roomOfPoint(plan, c.map((v, k) => v + f.normal[k] * 0.15));
      if (!room) return;
      const pts = shares[i].length === f.corners.length ? f.corners : [c];
      shares[i].forEach((sh, k) => per.get(room).push({ p: pts[k], sh }));
    });
    for (const R of C.roles) {
      const w = LIGHT_PLOT.roles[R.role], k = lights.findIndex((l) => l.fixture === 'key' && l.room === R.room);
      if (!w || k < 0) continue;
      const reach = focusReach(plan.rooms.find((r) => r.id === R.room));
      // each corner's light parted into the key's and the rest's (the ambient, every other steady lamp)
      const parts = per.get(R.room).map(({ p, sh }) => {
        let other = Ka, key = 0;
        for (let j = 0; j < sh.length; j += 2) { if (sh[j] === k) key += Kl[k] * sh[j + 1]; else if (!lights[sh[j]].beat) other += Kl[sh[j]] * sh[j + 1]; }
        return { p, other, key, near: Math.hypot(p[0] - R.focus[0], p[1] - R.focus[1]) <= reach };
      });
      const near = parts.filter((x) => x.near);
      if (!near.length || !parts.length) continue;
      const avg = (xs, f) => xs.reduce((s, x) => s + f(x), 0) / xs.length, t = Math.max(1, mood.ratio * w);
      const Fo = avg(near, (x) => x.other), Fk = avg(near, (x) => x.key), Mo = avg(parts, (x) => x.other), Mk = avg(parts, (x) => x.key);
      // (focus over mean = t, the key scaled by s: s = (t·Mo − Fo) / (Fk − t·Mk))
      const most = (KEY_MOST * fill) / mood.fill / Math.max(Kl[k], 1e-9), den = Fk - t * Mk, want = den > 1e-9 ? (t * Mo - Fo) / den : Infinity, sk = Math.min(most, Math.max(0.05, want));
      scale[k] = sk;
      record[R.room] = { scale: r4(sk), ratio: r4((Fo + sk * Fk) / (Mo + sk * Mk)), ...(want > most ? { short: true } : {}), ...(lights[k].beat ? { peak: true } : {}) };
    }
    return scale;
  };
  tune.record = record;
  return tune;
}
