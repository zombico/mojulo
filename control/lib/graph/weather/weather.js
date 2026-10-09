/**
 * WORLD WEATHER — what the sky does over a whole world, not round one body (playscape/elements: a status's drift, a
 * moment's strike). Three parts, all pure, node and page running the same source:
 *
 *   STATES     what the air can be: clear … thunderstorm … petals. Designed in VALUES, never hue: how thick the fog
 *              (a factor on the kit's own), the value it takes (0 dark … 1 light, the ramp's stop), how much light it
 *              takes off, the sky's value, the wind, what falls and what it does when it lands, the lightning. The
 *              style guide colours it, as it colours everything else.
 *   CLIMATES   what the sky does here, and how often: states weighed (or a preset), how long one holds, how long a
 *              change takes. `weatherAt(W, seed, t)` cuts time into slots, each its dwell and its state rolled by its
 *              own dice, the last `blend` seconds easing into the next. Same seed, same sky at every t.
 *   THE FALL   `fallPoints(F, cam, t)`: rain, snow, dust, petals in a box that follows the camera and wraps as they
 *              fall, so the weather is ON camera wherever it goes; `impactPoints(F, cam, t)`: where they land
 *              (rings, crowns, puffs), each slot re-rolled every cycle.
 *
 *   style.weather: { climate: { <state>: weight } | '<preset>', dwell?: [lo, hi] s, blend?: s, start?, surface? }
 */

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const r4 = (v) => Math.round(v * 1e4) / 1e4;

// ── the dice: one draw for (seed, slot, salt), mulberry32 over a folded seed ─────────────────────────────────────
/** A 0…1 draw for (seed, n, salt): the slot's own dice, the same every call. */
export function dice(seed, n, salt) {
  let h = ((seed >>> 0) ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (n >>> 0), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13) ^ Math.imul(salt >>> 0, 0x27d4eb2f), 0xc2b2ae35);
  let a = (h ^ (h >>> 16)) >>> 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ── the states ───────────────────────────────────────────────────────────────────────────────────────────────────
/** What falls: its glyph, how many to a cubic metre, how big (m), how fast (m a second), how far the wind leans it
 *  (degrees), how much it flutters (m), how fast it turns, what it does when it lands, and its value. */
export const FALL_GLYPHS = Object.freeze(['streak', 'drop', 'flake', 'soft', 'petal', 'leaf']);
export const IMPACTS = Object.freeze({
  none: 'nothing: it is gone where it lands',
  rings: 'a ring spreading on the ground or the water',
  crowns: 'a crown of droplets thrown up, then a ring: a downpour hitting hard',
  puffs: 'a low puff rolling off where it lands: dust, a soft snow',
  settles: 'it lies a moment where it lands, then fades: snow, petals, leaves',
});
export const FAMILIES = Object.freeze({ dry: 'clear air', wet: 'rain', cold: 'snow', dust: 'dust in the air', bloom: 'petals and leaves', grey: 'fog and cloud' });
/** The sound each state is rolled from (beats/weather-audio.js reads the bank by name). */
export const SOUND_BANKS = Object.freeze(['still', 'breeze', 'drizzle', 'rain', 'downpour', 'storm', 'hush', 'gale', 'dust', 'rustle']);

const S = (family, read, o) => Object.freeze({ family, read, fog: 1, veil: 0.7, dim: 0, sky: 0.8, wind: 0.1, gust: 0, ...o });
const FALL = (o) => Object.freeze({ slant: 0, sway: 0, spin: 0, impact: 'none', value: 0.85, ...o });
export const STATES = Object.freeze({
  clear: S('dry', 'clear air, a light breeze', { fog: 0.6, veil: 0.75, sky: 0.85, sound: 'breeze' }),
  haze: S('dry', 'a pale haze softening the far layers', { fog: 1.8, veil: 0.8, dim: 0.08, sky: 0.82, wind: 0.05, sound: 'still' }),
  overcast: S('grey', 'a lid of cloud, flat light', { fog: 1.5, veil: 0.65, dim: 0.25, sky: 0.62, wind: 0.2, sound: 'breeze' }),
  mist: S('grey', 'mist low on the ground, the near world clear', { fog: 3, veil: 0.78, dim: 0.12, sky: 0.72, wind: 0.03, sound: 'still' }),
  fog: S('grey', 'thick fog: the world ends twenty metres out', { fog: 8, veil: 0.72, dim: 0.3, sky: 0.66, wind: 0.02, sound: 'still' }),
  drizzle: S('wet', 'a fine drizzle: thin streaks, faint rings', { fog: 2, veil: 0.66, dim: 0.28, sky: 0.6, wind: 0.15, sound: 'drizzle',
    fall: FALL({ glyph: 'streak', rate: 0.18, size: 0.006, length: 0.18, speed: 5, slant: 6, impact: 'rings', value: 0.82 }) }),
  rain: S('wet', 'steady rain: streaks on camera, rings at every step', { fog: 2.6, veil: 0.6, dim: 0.38, sky: 0.52, wind: 0.3, gust: 0.2, sound: 'rain',
    fall: FALL({ glyph: 'streak', rate: 0.5, size: 0.008, length: 0.35, speed: 8, slant: 10, impact: 'rings', value: 0.8 }) }),
  downpour: S('wet', 'a downpour: heavy streaks, crowns thrown up off the ground', { fog: 4, veil: 0.55, dim: 0.5, sky: 0.42, wind: 0.45, gust: 0.35, sound: 'downpour',
    fall: FALL({ glyph: 'streak', rate: 1.1, size: 0.011, length: 0.55, speed: 10, slant: 16, impact: 'crowns', value: 0.78 }) }),
  thunderstorm: S('wet', 'a thunderstorm: a downpour, the sky lit white, thunder after', { fog: 4.5, veil: 0.45, dim: 0.62, sky: 0.3, wind: 0.65, gust: 0.6, sound: 'storm',
    fall: FALL({ glyph: 'streak', rate: 1.2, size: 0.012, length: 0.6, speed: 11, slant: 22, impact: 'crowns', value: 0.8 }),
    flash: Object.freeze({ every: [6, 22], near: 0.3, bright: 1 }) }),
  snow: S('cold', 'snow falling soft and slow, settling', { fog: 2.4, veil: 0.88, dim: 0.2, sky: 0.8, wind: 0.1, sound: 'hush',
    fall: FALL({ glyph: 'flake', rate: 0.35, size: 0.035, speed: 0.9, slant: 4, sway: 0.35, spin: 0.3, impact: 'settles', value: 0.95 }) }),
  blizzard: S('cold', 'a blizzard: snow driven sideways, the world white', { fog: 9, veil: 0.92, dim: 0.35, sky: 0.86, wind: 0.95, gust: 0.8, sound: 'gale',
    fall: FALL({ glyph: 'flake', rate: 1.4, size: 0.03, speed: 2.2, slant: 62, sway: 0.5, spin: 0.9, impact: 'puffs', value: 0.97 }) }),
  dust: S('dust', 'dust in the air, grit drifting low', { fog: 2.2, veil: 0.6, dim: 0.15, sky: 0.68, wind: 0.4, gust: 0.3, sound: 'dust',
    fall: FALL({ glyph: 'soft', rate: 0.12, size: 0.05, speed: 0.4, slant: 75, sway: 0.2, impact: 'none', value: 0.62 }) }),
  duststorm: S('dust', 'a dust storm: a wall of grit, the sun a disc', { fog: 10, veil: 0.55, dim: 0.55, sky: 0.5, wind: 0.95, gust: 0.85, sound: 'gale',
    fall: FALL({ glyph: 'streak', rate: 1.6, size: 0.012, length: 0.4, speed: 3, slant: 84, sway: 0.3, impact: 'puffs', value: 0.6 }) }),
  petals: S('bloom', 'petals drifting down, tumbling, lying where they land', { fog: 0.9, veil: 0.8, dim: 0.02, sky: 0.86, wind: 0.2, gust: 0.25, sound: 'rustle',
    fall: FALL({ glyph: 'petal', rate: 0.04, size: 0.05, speed: 0.6, slant: 20, sway: 0.6, spin: 0.7, impact: 'settles', value: 0.92 }) }),
  leaves: S('bloom', 'leaves blown across, turning over', { fog: 1.1, veil: 0.72, dim: 0.1, sky: 0.74, wind: 0.5, gust: 0.45, sound: 'rustle',
    fall: FALL({ glyph: 'leaf', rate: 0.03, size: 0.08, speed: 1.2, slant: 55, sway: 0.5, spin: 1.1, impact: 'settles', value: 0.55 }) }),
});
export const STATE_NAMES = Object.freeze(Object.keys(STATES));

// ── the climates ─────────────────────────────────────────────────────────────────────────────────────────────────
const C = (read, climate, o = {}) => Object.freeze({ read, climate: Object.freeze(climate), ...o });
export const CLIMATES = Object.freeze({
  temperate: C('mostly fair, overcast days, rain now and then, a morning mist', { clear: 4, overcast: 3, mist: 1, drizzle: 1.5, rain: 1.5, thunderstorm: 0.3 }),
  monsoon: C('heavy and wet: rain, downpours, storms rolling through', { overcast: 1, rain: 3, downpour: 3, thunderstorm: 2, mist: 1 }, { dwell: [60, 180] }),
  alpine: C('thin bright air, snow, now and then a blizzard', { clear: 3, haze: 1, snow: 3, blizzard: 1, fog: 1 }),
  desert: C('hard sun, haze, dust lifting, a storm of it now and then', { clear: 5, haze: 3, dust: 2, duststorm: 0.6 }),
  'spring-blossom': C('soft days, petals on the wind, a shower passing', { clear: 3, haze: 1, petals: 4, drizzle: 1 }),
  autumn: C('grey and blowing: leaves across the ground, fog, rain', { overcast: 3, leaves: 3, fog: 1.5, rain: 1.5, clear: 1 }),
  'storm-coast': C('a wild coast: fog off the sea, rain, storms', { fog: 2, overcast: 2, rain: 2, downpour: 1.5, thunderstorm: 1.5 }, { dwell: [50, 160] }),
});
export const CLIMATE_NAMES = Object.freeze(Object.keys(CLIMATES));
export const SURFACES = Object.freeze({ leaf: 'soft and high', stone: 'a dry click', tin: 'it rings', water: 'it plinks and rings out', sand: 'a hiss, nothing rings', snow: 'nothing but hush' });

export const WEATHER = Object.freeze({
  climate: `what the sky does here: { <state>: weight } (${STATE_NAMES.join(', ')}) or a preset (${CLIMATE_NAMES.join(', ')})`,
  dwell: 'how long one state holds, [lo, hi] seconds (each slot rolls its own)',
  blend: 'how long a change takes, seconds (the end of a slot eases into the next)',
  start: 'the state a level opens in (else the dice)',
  surface: `what the fall lands on: ${Object.keys(SURFACES).join(', ')} (its impacts and its sound)`,
});
const DWELL = [90, 240], BLEND = 20;

/** A weather (a preset's name, or { climate, dwell?, blend?, start?, surface? }): read, filled, every word checked. */
export function readWeather(w, where = 'weather') {
  if (typeof w === 'string') {
    if (CLIMATES[w]) return readWeather({ climate: w }, where);
    if (STATES[w]) return readWeather({ climate: { [w]: 1 } }, where);
    throw new Error(`${where} '${w}' is neither a climate (${CLIMATE_NAMES.join(', ')}) nor a state (${STATE_NAMES.join(', ')})`);
  }
  if (!isObj(w)) throw new Error(`${where} is a climate's name or { ${Object.keys(WEATHER).join(', ')} }`);
  for (const k of Object.keys(w)) if (!WEATHER[k]) throw new Error(`${where}.${k} is not a weather setting (${Object.keys(WEATHER).join(', ')})`);
  if (w.climate === undefined) throw new Error(`${where}.climate is what the sky does: ${WEATHER.climate}`);
  const preset = typeof w.climate === 'string' ? CLIMATES[w.climate] : null;
  if (typeof w.climate === 'string' && !preset) throw new Error(`${where}.climate '${w.climate}' is not a climate (${CLIMATE_NAMES.join(', ')}); or weigh states: { rain: 2, clear: 1 }`);
  const weights = preset ? preset.climate : w.climate;
  if (!isObj(weights) || !Object.keys(weights).length) throw new Error(`${where}.climate weighs at least one state: { ${STATE_NAMES.slice(0, 3).join(': 1, ')}: 1 }`);
  const climate = {};
  for (const [k, v] of Object.entries(weights)) {
    if (!STATES[k]) throw new Error(`${where}.climate.${k} is not a state (${STATE_NAMES.join(', ')})`);
    if (!num(v) || v < 0) throw new Error(`${where}.climate.${k} is a weight, 0 or more`);
    if (v > 0) climate[k] = v;
  }
  if (!Object.keys(climate).length) throw new Error(`${where}.climate gives every state weight 0: nothing can happen`);
  const dwell = w.dwell ?? preset?.dwell ?? DWELL;
  if (!(Array.isArray(dwell) && dwell.length === 2 && dwell.every(num) && dwell[0] >= 5 && dwell[1] >= dwell[0])) throw new Error(`${where}.dwell is [lo, hi] seconds, 5 or more, lo ≤ hi`);
  const blend = w.blend ?? BLEND;
  if (!num(blend) || blend < 0 || blend > dwell[0]) throw new Error(`${where}.blend is seconds from 0 to the shortest dwell (${dwell[0]})`);
  const out = { climate, dwell: dwell.slice(), blend };
  if (w.start !== undefined) {
    if (!STATES[w.start]) throw new Error(`${where}.start '${w.start}' is not a state (${STATE_NAMES.join(', ')})`);
    out.start = w.start;
  }
  if (w.surface !== undefined) {
    if (!SURFACES[w.surface]) throw new Error(`${where}.surface is one of: ${Object.keys(SURFACES).join(', ')}`);
    out.surface = w.surface;
  }
  return out;
}

// ── the schedule ─────────────────────────────────────────────────────────────────────────────────────────────────
// a slot's state: weighed, a state of the last one's family twice as likely (rain turns to a downpour more often
// than to a blizzard), the same state as likely as any other of its family
export function draw(W, seed, k, prev) {
  const names = Object.keys(W.climate), fam = prev ? STATES[prev].family : null;
  const ws = names.map((n) => W.climate[n] * (fam && STATES[n].family === fam ? 2 : 1));
  let x = dice(seed, k, 2) * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < names.length; i++) if ((x -= ws[i]) < 0) return names[i];
  return names[names.length - 1];
}
const smooth = (u) => u * u * (3 - 2 * u);

/** The sky at t seconds: { is, next, mix (0…1, how far into next), slot, from, to (the slot's seconds) }. A read
 *  weather (readWeather); pure in (W, seed, t): the page runs this source. */
export function weatherAt(W, seed, t) {
  const tt = Math.max(0, t);
  let k = 0, from = 0, is = W.start ?? draw(W, seed, 0, null);
  for (;;) {
    const to = from + W.dwell[0] + (W.dwell[1] - W.dwell[0]) * dice(seed, k, 1), next = draw(W, seed, k + 1, is);
    if (tt < to) {
      const u = W.blend > 0 ? (tt - (to - W.blend)) / W.blend : tt >= to ? 1 : 0;
      return { is, next, mix: next === is ? 0 : r4(smooth(Math.min(1, Math.max(0, u)))), slot: k, from, to };
    }
    k++; from = to; is = next;
  }
}

/** The first `span` seconds as runs: [{ is, from, to }] (the bible's strip; a test's long run). */
export function weatherRuns(W, seed, span) {
  const out = [];
  for (let t = 0; t < span;) { const s = weatherAt(W, seed, t); out.push({ is: s.is, from: s.from, to: Math.min(s.to, span) }); t = s.to; }
  return out;
}

// ── a state between two ──────────────────────────────────────────────────────────────────────────────────────────
const lerp = (a, b, u) => a + (b - a) * u;
/** Two states mixed: the fog eased in its log (a fog factor 1 → 8 halfway is about 2.8, not 4.5), the values
 *  straight, each fall kept at its share of its rate (rain thins as snow thickens), the lightning's rate its share. */
export function blendState(a, b, mix) {
  const A = typeof a === 'string' ? STATES[a] : a, B = typeof b === 'string' ? STATES[b] : b, u = Math.min(1, Math.max(0, mix));
  const falls = [];
  if (A.fall && u < 1) falls.push({ ...A.fall, rate: r4(A.fall.rate * (1 - u)) });
  if (B.fall && u > 0) falls.push({ ...B.fall, rate: r4(B.fall.rate * u) });
  const fl = A.flash && B.flash ? A.flash : A.flash || B.flash, share = A.flash && B.flash ? 1 : A.flash ? 1 - u : u;
  return {
    fog: r4(Math.exp(lerp(Math.log(A.fog), Math.log(B.fog), u))),
    veil: r4(lerp(A.veil, B.veil, u)), dim: r4(lerp(A.dim, B.dim, u)), sky: r4(lerp(A.sky, B.sky, u)),
    wind: r4(lerp(A.wind, B.wind, u)), gust: r4(lerp(A.gust, B.gust, u)),
    falls,
    ...(fl && share > 0 ? { flash: { ...fl, share: r4(share) } } : {}),
  };
}

// ── the fall, round the camera ───────────────────────────────────────────────────────────────────────────────────
export const FALL_BOX = Object.freeze({ half: 12, height: 14, cap: 4000 });
/** How many of a fall the camera's box holds (its rate × the box, capped). */
export const fallCount = (F, box = FALL_BOX) => Math.min(box.cap, Math.round(F.rate * 4 * box.half * box.half * box.height));

/** A fall's particles at t round camera cam [x, y, z] (z up): each { p, v (its velocity), s (size), len (a streak's
 *  length along v), rot, w (0 hidden) }. Each particle has its own place in a box the camera carries; it falls at
 *  its speed, leaned by the wind (slant, degrees off down, toward +x turned by `heading`), and wraps, so the box is
 *  always full. count entries always (a page's pool stays one size). Pure: the page runs this source. */
export function fallPoints(F, cam, t, count, heading = 0, box = FALL_BOX) {
  const out = [], TAU = 6.283185307179586, fr = (x) => x - Math.floor(x), hs = (a, b) => fr(Math.sin(a * 12.9898 + b * 78.233 + 1.7) * 43758.5453);
  const H = box.half * 2, Z = box.height, sl = (F.slant * Math.PI) / 180, ch = Math.cos(heading), sh = Math.sin(heading);
  for (let i = 0; i < count; i++) {
    const sp = F.speed * (0.8 + 0.4 * hs(i, 1)), vh = sp * Math.sin(sl), vz = -sp * Math.cos(sl);
    const vx = vh * ch, vy = vh * sh;
    // its place in the world's lattice of boxes, carried along with the camera: wrapped round the camera's cell
    const bx = hs(i, 2) * H + vx * t, by = hs(i, 3) * H + vy * t, bz = hs(i, 4) * Z + vz * t;
    const sw = F.sway ? F.sway * Math.sin(TAU * (0.3 + 0.4 * hs(i, 5)) * t + hs(i, 6) * TAU) : 0;
    const x = cam[0] - box.half + fr((bx - cam[0] + box.half) / H) * H + sw * -sh;
    const y = cam[1] - box.half + fr((by - cam[1] + box.half) / H) * H + sw * ch;
    const z = cam[2] - Z / 2 + fr((bz - cam[2] + Z / 2) / Z) * Z;
    // fade at the box's walls so the wrap never shows: 0 at a wall, 1 within the inner two-thirds
    const dx = Math.abs(x - cam[0]) / box.half, dy = Math.abs(y - cam[1]) / box.half, dz = Math.abs(z - cam[2]) / (Z / 2);
    const edge = Math.min(1, (1 - Math.max(dx, dy, dz)) * 3);
    out.push({ p: [x, y, z], v: [vx, vy, vz], s: F.size * (0.7 + 0.6 * hs(i, 7)), len: F.length ? F.length * (0.75 + 0.5 * hs(i, 8)) : 0, rot: hs(i, 9) * TAU + (F.spin || 0) * TAU * t, w: Math.max(0, edge) });
  }
  return out;
}

/** Where a fall lands round the camera: `count` slots, each a spot on the ground (x, y; the page finds z) re-rolled
 *  every cycle, and u, how far through its landing (0 → 1). The cycle is the impact's own length; slots are
 *  staggered so landings never pulse together. Pure: the page runs this source. */
export const IMPACT_LIFE = Object.freeze({ none: 0, rings: 0.5, crowns: 0.38, puffs: 0.9, settles: 2.6 });
export function impactPoints(F, cam, t, count, reach = 9) {
  const out = [], fr = (x) => x - Math.floor(x), hs = (a, b, c) => fr(Math.sin(a * 12.9898 + b * 78.233 + c * 37.719 + 2.3) * 43758.5453);
  const life = IMPACT_LIFE[F.impact] || 0.5;
  for (let i = 0; i < count; i++) {
    const cyc = life * (0.85 + 0.3 * hs(i, 1, 0)), ph = t / cyc + hs(i, 2, 0), n = Math.floor(ph), u = ph - n;
    const a = hs(i, n, 3) * 6.283185307179586, d = Math.sqrt(hs(i, n, 4)) * reach;
    out.push({ p: [cam[0] + d * Math.cos(a), cam[1] + d * Math.sin(a)], u, s: 0.7 + 0.6 * hs(i, n, 5) });
  }
  return out;
}

/** How many landings a fall shows round the camera at once (its rate, the impact's life). */
export const impactCount = (F) => (F.impact === 'none' ? 0 : Math.min(160, Math.round(F.rate * (F.impact === 'settles' ? 260 : 120))));

// ── lightning ────────────────────────────────────────────────────────────────────────────────────────────────────
/** The flashes in [t0, t1): each { at, near (a bolt you see strike, else a sheet lighting the cloud), dist (m: the
 *  thunder comes dist / 343 s after), seed }. Slots of the flash's own dice: within each slot of `every[0]` seconds at
 *  most one flash, kept at the share that makes the mean gap (lo + hi) / 2, so the rate holds and a flash can never be missed by a long frame. */
export function flashesIn(flash, seed, t0, t1) {
  const out = [], lo = flash.every[0], hi = flash.every[1], slot = lo;
  for (let k = Math.floor(t0 / slot); k * slot < t1; k++) {
    const keep = dice(seed, k, 11) < (2 * slot) / (lo + hi) * (flash.share ?? 1);
    if (!keep) continue;
    const at = k * slot + dice(seed, k, 12) * slot;
    if (at < t0 || at >= t1) continue;
    const near = dice(seed, k, 13) < flash.near;
    out.push({ at: r4(at), near, dist: Math.round(near ? 300 + 900 * dice(seed, k, 14) : 1500 + 6000 * dice(seed, k, 14)), seed: (seed * 31 + k) >>> 0 });
  }
  return out;
}

/** The sky's whole answer at t: the state blended, and its name now and next (the page and the bible read this). */
export function skyAt(W, seed, t) {
  const at = weatherAt(W, seed, t);
  return { ...at, state: blendState(at.is, at.next, at.mix) };
}
