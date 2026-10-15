/**
 * A RACE'S MOOD — the light a race is run in, the way the games these cars live in sell it: a sunset run, a blue-hour
 * mountain pass, a city at night with its lamps and neon, a wet road throwing the lamps back.
 *
 *   RACE_MOODS                         golden | dusk | night | rain | night-rain: a time and its extras
 *   moodOf(name)                       → the mood (throws naming the moods)
 *   relightFaces(faces, mood, lamps)   every baked face un-lit from noon (road-faces.js LIGHT) and lit again by the
 *                                      mood's key and ambient, each lamp's pool added at its corners
 *   relightAlbedo(albedo, n, mood)     one colour under the mood (a figure that kept its albedo and normals)
 *   streetLights(sections, mood, opts) → { faces, lamps } posts along the road's edges and the lights on them
 *   moodScene(payload, plan, mood)     the track's payload in its mood: faces, sky, haze, bg, the wet road
 *   moodGround(mood)                   what a car is seen against in this mood (color-theorist/livery.js `against`)
 *
 * A face's light is albedo × (ambient + key · max(0, n·L)) per channel, the noon light grey: so a baked face's albedo
 * is its fill over the noon factor, and the mood's light is applied to it. Lamps add albedo × colour × I / (1 + (d/R)²)^1.5
 * × max(0, n·toward the lamp) at each corner (their pools then grade across a face). A track drawn in a kit's look
 * (track-kit.js) was baked under its pole's light, not noon's: its re-light is a grade, near but not exact. Pure.
 */
import { LIGHT } from './road-faces.js';

const r4 = (x) => Math.round(x * 1e4) / 1e4;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbHex = (c) => `#${c.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')}`;
const newell = (c) => {
  const n = [0, 0, 0];
  for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); }
  return unit(n);
};
// a sun or a moon placed on the sky dome ({ u, h }, sky-dome.js) and the way its light travels
const fromSky = ({ u, h }) => { const el = clamp(h, 0.25, 0.95) * (Math.PI / 2), az = -Math.PI / 2 + (u - 0.5) * Math.PI; return [-Math.cos(el) * Math.cos(az), -Math.cos(el) * Math.sin(az), -Math.sin(el)]; };

/** The times a race is run at: the key (its travel and colour, 0–1 per channel), the ambient, the sky and the air.
 *  `noon` is the light the track was baked in. */
export const MOOD_TIMES = Object.freeze({
  noon: { dir: LIGHT.dir, key: [LIGHT.diffuse, LIGHT.diffuse, LIGHT.diffuse], ambient: [LIGHT.ambient, LIGHT.ambient, LIGHT.ambient] },
  golden: { sun: { u: 0.3, h: 0.3 }, key: [1.0, 0.66, 0.4], ambient: [0.3, 0.28, 0.37], sky: { zenith: [64, 92, 150], horizon: [252, 176, 112], day: 1, stars: 0 }, haze: '#e7b590', visibility: 2400, headlamps: 0.35 },
  dusk: { sun: { u: 0.72, h: 0.26 }, key: [0.46, 0.26, 0.32], ambient: [0.2, 0.23, 0.36], sky: { zenith: [24, 34, 74], horizon: [206, 120, 116], day: 0.35, stars: 0.4 }, haze: '#4d4a6c', visibility: 1600, headlamps: 0.8, lamps: true, figure: { ambient: [0.34, 0.33, 0.44], key: [0.42, 0.3, 0.34] } },
  night: { moon: { u: 0.62, h: 0.62 }, key: [0.05, 0.06, 0.11], ambient: [0.025, 0.03, 0.055], sky: { zenith: [6, 9, 22], horizon: [26, 32, 58], day: 0, stars: 1 }, haze: '#10162a', visibility: 1300, headlamps: 1, lamps: true, figure: { ambient: [0.24, 0.24, 0.32], key: [0.34, 0.3, 0.3] } },
  overcast: { sun: { u: 0.45, h: 0.8 }, key: [0.16, 0.17, 0.19], ambient: [0.44, 0.46, 0.5], sky: { zenith: [92, 100, 112], horizon: [150, 156, 164], day: 0.8, stars: 0 }, haze: '#8b939d', visibility: 700, headlamps: 0.7 },
});

/** The moods: a time, and what comes with it. */
export const RACE_MOODS = Object.freeze({
  golden: { time: 'golden', reads: 'a sunset run: the sun low and gold down the straight, long shadows, a warm haze' },
  dusk: { time: 'dusk', reads: 'the blue hour on a pass: the last glow of the sky, the lamps coming on, headlights up' },
  night: { time: 'night', neon: true, reads: 'a city at night: sodium lamps down the road, neon among them, lit pools on black asphalt' },
  rain: { time: 'overcast', wet: true, weather: 'rain', reads: 'rain: a flat grey sky, the road dark and wet, spray and streaks' },
  'night-rain': { time: 'night', neon: true, wet: true, weather: 'rain', reads: 'a wet night: every lamp thrown back down the road, the rain in the light' },
});
export const RACE_MOOD_IDS = Object.freeze(Object.keys(RACE_MOODS));

export function moodOf(name) {
  if (!Object.hasOwn(RACE_MOODS, name)) throw new Error(`race mood: '${name}' is not a mood (${RACE_MOOD_IDS.join(', ')})`);
  const M = RACE_MOODS[name], T = MOOD_TIMES[M.time];
  const dir = unit(T.sun ? fromSky(T.sun) : T.moon ? fromSky(T.moon) : T.dir);
  return { id: name, ...M, ...T, dir, toLight: dir.map((v) => -v) };
}

const NOON = { toLight: LIGHT.toLight, key: MOOD_TIMES.noon.key, ambient: MOOD_TIMES.noon.ambient };
const factor = (n, L) => { const lam = Math.max(0, dot(n, L.toLight)); return [0, 1, 2].map((k) => L.ambient[k] + L.key[k] * lam); };

// the lamps near a point (a grid of R-sized cells; a lamp reaches three of its radii)
function lampGrid(lamps, cell) {
  const G = new Map(), key = (i, j) => `${i},${j}`;
  lamps.forEach((l, i) => { const k = key(Math.floor(l.at[0] / cell), Math.floor(l.at[1] / cell)); if (!G.has(k)) G.set(k, []); G.get(k).push(i); });
  return (p) => { const i0 = Math.floor(p[0] / cell), j0 = Math.floor(p[1] / cell), out = []; for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) for (const x of G.get(key(i, j)) ?? []) out.push(lamps[x]); return out; };
}
function pool(p, n, near) {
  const add = [0, 0, 0];
  for (const l of near(p)) {
    const d = [l.at[0] - p[0], l.at[1] - p[1], l.at[2] - p[2]], dist = Math.hypot(...d), w = Math.max(0, dot(n, d) / (dist || 1));
    if (dist > l.reach * 3 || w <= 0) continue;
    const fall = (l.intensity / (1 + (dist / l.reach) ** 2) ** 1.5) * (1 - clamp((dist - l.reach * 2) / l.reach, 0, 1)) * w;
    for (let k = 0; k < 3; k++) add[k] += (l.rgb[k] / 255) * fall;
  }
  return add;
}

/** One albedo under the mood at normal n (and the lamps' pool there, when given). `figure`: a car, lit as the games
 *  light one after dark — a fill the road does not get (the lamps along the way and their reflections), so its paint
 *  still reads as its own. */
export function relightAlbedo(albedo, n, mood, extra = [0, 0, 0], { figure = false } = {}) {
  const f = factor(n, figure && mood.figure ? { ...mood, ...mood.figure } : mood), a = hexRgb(albedo);
  return rgbHex(a.map((v, k) => v * (f[k] + extra[k])));
}

// a quad a lamp reaches, cut into a grid fine enough for its pool to show (its uv and corner colours with it)
const lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
function finer(f, near) {
  if (f.corners.length !== 4 || !near(f.corners[0]).length) return [f];
  const c = f.corners, step = Math.min(...near(c[0]).map((l) => l.reach)) * 0.5;
  const nu = Math.min(8, Math.ceil(Math.max(Math.hypot(...c[1].map((v, k) => v - c[0][k])), Math.hypot(...c[2].map((v, k) => v - c[3][k]))) / step));
  const nv = Math.min(8, Math.ceil(Math.max(Math.hypot(...c[3].map((v, k) => v - c[0][k])), Math.hypot(...c[2].map((v, k) => v - c[1][k]))) / step));
  if (nu * nv <= 1) return [f];
  const at = (q, u, v) => lerp(lerp(q[0], q[1], u), lerp(q[3], q[2], u), v), out = [];
  const rgb = f.cornerFills?.map(hexRgb);
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const uv4 = [[i / nu, j / nv], [(i + 1) / nu, j / nv], [(i + 1) / nu, (j + 1) / nv], [i / nu, (j + 1) / nv]];
    out.push({ ...f, corners: uv4.map(([u, v]) => at(c, u, v).map(r4)), ...(f.uv ? { uv: uv4.map(([u, v]) => at(f.uv, u, v).map(r4)) } : {}), ...(rgb ? { cornerFills: uv4.map(([u, v]) => rgbHex(at(rgb, u, v))) } : {}) });
  }
  return out;
}

/** The faces in the mood: each un-lit from noon and lit again, its corners taking the lamps' pools (a quad a lamp
 *  reaches cut finer first). A face with a `glow` (a lamp head) keeps its colour. */
export function relightFaces(faces, mood, lamps = []) {
  const near = lamps.length ? lampGrid(lamps, Math.max(...lamps.map((l) => l.reach * 3))) : null;
  return (near ? faces.flatMap((f) => (f.glow ? [f] : finer(f, near))) : faces).map((f) => {
    if (f.glow || typeof f.fill !== 'string' || f.fill[0] !== '#') return f;
    const n = newell(f.corners), k0 = factor(n, NOON), k1 = factor(n, mood);
    const at = (hex, p) => { const a = hexRgb(hex).map((v, k) => v / k0[k]), e = near ? pool(p, n, near) : [0, 0, 0]; return rgbHex(a.map((v, k) => v * (k1[k] + e[k]))); };
    const mid = f.corners.reduce((s, p) => s.map((v, k) => v + p[k] / f.corners.length), [0, 0, 0]);
    const out = { ...f, fill: at(f.fill, mid) };
    // (a face a lamp reaches takes its pool at its corners; one no lamp reaches stays one colour)
    if (f.cornerFills) out.cornerFills = f.cornerFills.map((h, i) => at(h, f.corners[i] ?? mid));
    else if (near && f.corners.some((p) => pool(p, n, near).some((v) => v > 1e-3))) out.cornerFills = f.corners.map((p) => at(f.fill, p));
    return out;
  });
}

const SODIUM = '#ffb25e', NEON = Object.freeze(['#ff3fa4', '#2ee6ff', '#b45cff']);
/** Street lights along the road: a post at the edge every `spacing` metres, the sides in turn, its arm over the road
 *  and its head glowing; at night one in three in neon. → { faces, lamps: [{ at, rgb, intensity, reach, hex }] } */
export function streetLights(sections, mood, { spacing = 26, height = 7.5, setback = 1.6 } = {}) {
  const faces = [], lamps = [];
  if (!mood.lamps || sections.length < 2) return { faces, lamps };
  let next = sections[0].s + spacing / 2, k = 0;
  for (const sec of sections) {
    if (sec.s < next) continue;
    next = sec.s + spacing;
    const side = k % 2 ? sec.left : sec.right, other = k % 2 ? sec.right : sec.left;
    const out = unit([side[0] - other[0], side[1] - other[1], 0]);
    const foot = [side[0] + out[0] * setback, side[1] + out[1] * setback, side[2]];
    const head = [foot[0] - out[0] * 2.2, foot[1] - out[1] * 2.2, foot[2] + height];
    const neon = mood.neon && k % 3 === 2, hex = neon ? NEON[Math.floor(k / 3) % NEON.length] : SODIUM;
    // the post and its arm: square sections, the dark steel of the night
    const bar = (a, b, w) => {
      const ax = unit([b[0] - a[0], b[1] - a[1], b[2] - a[2]]), up = Math.abs(ax[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
      const u = unit([ax[1] * up[2] - ax[2] * up[1], ax[2] * up[0] - ax[0] * up[2], ax[0] * up[1] - ax[1] * up[0]]), v = [ax[1] * u[2] - ax[2] * u[1], ax[2] * u[0] - ax[0] * u[2], ax[0] * u[1] - ax[1] * u[0]];
      const ring = (c) => [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([i, j]) => c.map((x, q) => r4(x + (u[q] * i + v[q] * j) * w)));
      const A = ring(a), B = ring(b);
      for (let i = 0; i < 4; i++) faces.push({ corners: [A[i], A[(i + 1) % 4], B[(i + 1) % 4], B[i]], fill: '#3a3f47' });
    };
    const top = [foot[0], foot[1], foot[2] + height + 0.3];
    bar(foot, top, 0.09); bar(top, [head[0], head[1], head[2] + 0.3], 0.06);
    // the head: a lit panel facing down, its glow a sprite on the page
    const h = 0.35;
    faces.push({ corners: [[head[0] - h, head[1] - h, head[2]], [head[0] + h, head[1] - h, head[2]], [head[0] + h, head[1] + h, head[2]], [head[0] - h, head[1] + h, head[2]]].map((p) => p.map(r4)), fill: hex, glow: `0 0 ${neon ? 34 : 26}px ${neon ? 12 : 8}px ${hex}` });
    lamps.push({ at: head.map(r4), hex, rgb: hexRgb(hex), intensity: neon ? 1.3 : 1.6, reach: neon ? 5 : 6 });
    k++;
  }
  return { faces, lamps };
}

/** What a car is seen against in this mood: the road, the kerb, the verge and the sky as the mood lights them. */
export function moodGround(mood) {
  const up = [0, 0, 1], under = (hex) => relightAlbedo(rgbHex(hexRgb(hex).map((v, k) => v / factor(up, NOON)[k])), up, mood);
  const sky = (c) => rgbHex(c);
  return [{ what: 'road', hex: under('#3b3d40') }, { what: 'road', hex: under('#55585c') }, { what: 'kerb', hex: under('#c8302c') },
    { what: 'kerb', hex: under('#e8e8e8') }, { what: 'grass', hex: under('#4f7a34') }, { what: 'sky', hex: sky(mood.sky?.horizon ?? [169, 200, 230]) }];
}

/** The track's payload in its mood. `plan.sections` lay the street lights; the road is what the wet film covers. */
export function moodScene(payload, plan, mood, { isRoad = () => false } = {}) {
  const { faces: posts, lamps } = streetLights(plan.sections ?? [], mood);
  // the wet road first: darker and a touch richer (then lit with the rest), and a film over it the page lights
  // (channels/wet-road.js)
  const quads = [], wet = (h) => rgbHex(hexRgb(h).map((v) => v * 0.62));
  const dressed = !mood.wet ? payload.faces : payload.faces.map((f) => {
    if (!isRoad(f)) return f;
    quads.push(f.corners.length === 4 ? f.corners : [f.corners[0], f.corners[1], f.corners[2], f.corners[2]]);
    return { ...f, fill: wet(f.fill), ...(f.cornerFills ? { cornerFills: f.cornerFills.map(wet) } : {}) };
  });
  const faces = relightFaces([...dressed, ...posts], mood, lamps);
  const sky = { preset: mood.sky.day >= 0.5 ? 'day' : 'night', ...mood.sky, seed: payload.sky?.seed ?? 7, ...(mood.sun ? { sun: mood.sun } : {}) };
  const out = { ...payload, bg: mood.haze, sky, haze: { color: mood.haze, density: 1.98 / mood.visibility } };
  if (mood.wet) out.wetRoad = { quads, lamps: lamps.map((l) => ({ at: l.at, rgb: l.rgb, intensity: l.intensity })), zenith: mood.sky.zenith, horizon: mood.sky.horizon };
  out.faces = faces;
  out.mood = { id: mood.id, reads: mood.reads, lamps: lamps.length, headlamps: mood.headlamps };
  return out;
}
