/**
 * GEOCUBE HOURS — one cube at any hour of the day. A cube's light is one sixth-gen reference (era/sixth-gen.js), and the
 * references are hours already: sunshine a noon, mgs3 a mid-morning's height, colosseum a sunset, dmc3 a night. Those
 * are the keyframes; a recipe's `hour` moves between them through the cube's own reference:
 *
 *   the sun's path   one arc, rising at 6 and setting at 18 (the clock's dial, weather/clock-dial.js), peaking at the
 *                    reference's elevation or 58°, its azimuth turning 15° an hour; a day reference is read as the
 *                    afternoon its elevation falls on, a night one as 23:00, so at the reference's own hour the light
 *                    IS the reference's
 *   the sky's height `s` in −1…1: the sun's elevation over its noon less the dial's night, so the day runs from the
 *                    night (−1) through the golden horizon (0) to noon (1) without a jump at dawn or dusk
 *   the keyframes    night (dmc3's, or a night reference's own), golden (colosseum's), the reference at its height, noon
 *                    (sunshine's); each sky carried into the cube's own hue at the keyframe's value (`atValueOf`), the
 *                    golden horizon kept the sun's
 *   the key          the sun, warmed and dimmed toward the horizon, until the sky is past `MOON_AT` into the night:
 *                    then the cube's moon (its `light.moon`, else a pale one), brightening as the night deepens
 *
 * The air's thickness is the cube's (its reference's density by `outsideFog`): an hour moves colour, never haze. The
 * cube's colours are not re-solved: the land is the same paint under another light.
 *
 *   HOUR_WORDS            the dial's words → hours
 *   readHour(v)           a number in [0, 24) or one of the words → the hour, or throws
 *   referenceHour(ref)    the hour a reference card is lit at
 *   hourLight(cube, h)    → { hour, s, moonlit, key, gainK, ambient, dome, fog, water, night }
 *   hourAir(cube, h, clouds?)   the hour's light and air under the clouds, as an outside (the island, a city) takes them:
 *                         → { H, gain, ambient, fog, disc, band, dome }
 *
 * Pure.
 */
import { SIXTH_GEN_REFERENCES, resolveLook } from './sixth-gen.js';
import { nightAt } from '../weather/clock-dial.js';
import { oklch, lchOf, hexToRgb, rgbToHex } from '../color-theorist/oklab.js';
import { sunDir } from './sun.js';
import { WEATHERS } from '../matte-paint/sky.js';

export const HOUR_WORDS = Object.freeze({ dawn: 6, morning: 9, noon: 12, afternoon: 15, golden: 17.5, dusk: 19, night: 23 });
const DAY = SIXTH_GEN_REFERENCES.sunshine, GOLD = SIXTH_GEN_REFERENCES.colosseum, NIGHT = SIXTH_GEN_REFERENCES.dmc3;
// the noon a reference's sun peaks at, at least; the lowest a baked sun stands (a sun under the land lights it from below)
const NOON = 58, LOW_SUN = 6;
// the sky is a day's by the time the sun is this far to its noon: a warm horizon is a low sun's (and a warm-to-blue mix
// on the way passes through grey)
const DAY_AT = 0.4;
const skyS = (s) => (s > 0 ? Math.min(1, s / DAY_AT) : s);
// past this far into the night the moon is the key
const MOON_AT = -0.6;
// the twilight between the golden horizon and the night (no reference paints it): a deep blue overhead over the
// afterglow at the horizon, the shade cool. Straight from golden to night the sky passes through brown
const TWILIGHT = -0.45;
const TWI = Object.freeze({ zenith: [34, 44, 86], horizon: [206, 124, 104], fog: '#7a6474', ambient: '#4e5070' });
// a cube with no moon of its own is lit at night by this one (the city's, city/plan/look.js)
const MOON = Object.freeze({ color: '#9fb0e0', elevation: 34, azimuth: 300, gain: 0.8 });

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth = (u) => u * u * (3 - 2 * u);
const r3 = (v) => Math.round(v * 1000) / 1000;
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hexOf = (c) => '#' + c.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
// a colour at another's value: its hue and (quietened) chroma, the other's lightness (geocube.js solveInto's move)
const atValueOf = (hex, rgb) => { const [, C, h] = lchOf(hexToRgb(hex)), [L] = lchOf(rgb); return rgbToHex(oklch(L, Math.min(C, 0.06), h)); };

/** A recipe's hour → a number in [0, 24). */
export function readHour(v) {
  if (typeof v === 'string' && v in HOUR_WORDS) return HOUR_WORDS[v];
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 24) return v;
  throw new Error(`hour is a number from 0 up to 24, or one of ${Object.keys(HOUR_WORDS).join(', ')}; got ${JSON.stringify(v)}`);
}

const noonOf = (ref) => Math.max(NOON, ref.light.key ? ref.light.key.elevation : 0);
/** The hour a reference is lit at: a night's 23:00, else the afternoon its sun's elevation falls on. */
export function referenceHour(ref) {
  const key = ref.light.key;
  if (!key) return 23;
  const top = noonOf(ref);
  return key.elevation >= top ? 12 : 18 - (12 / Math.PI) * Math.asin(key.elevation / top);
}
const elevationAt = (h, top) => top * Math.sin((Math.PI * (h - 6)) / 12);
const heightAt = (h, top) => clamp(elevationAt(h, top) / top - nightAt(h * 60), -1, 1);

// a value along keyframes [{ s, v }] (sorted by s), linear between them, held past the ends
function along(keys, s, mix) {
  if (s <= keys[0].s) return keys[0].v;
  for (let i = 1; i < keys.length; i++) if (s <= keys[i].s) { const a = keys[i - 1], b = keys[i], t = (s - a.s) / (b.s - a.s || 1); return mix(a.v, b.v, t); }
  return keys[keys.length - 1].v;
}
const mixRgb = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
const mixHex = (a, b, t) => hexOf(mixRgb(rgbOf(a), rgbOf(b), t));
const mixSky = (a, b, t) => ({ zenith: mixRgb(a.zenith, b.zenith, t), horizon: mixRgb(a.horizon, b.horizon, t), fog: mixHex(a.fog, b.fog, t) });
// the keyframes, the reference's own height standing in for the keyframe nearest it (a noon reference for noon, a night
// one for the night)
function keyframes(refS, own, make) {
  const keys = [{ s: -1, v: make.night }, ...(make.twilight ? [{ s: TWILIGHT, v: make.twilight }] : []), { s: 0, v: make.golden }, { s: 1, v: make.day }].filter((k) => Math.abs(k.s - refS) > 1e-9);
  return [...keys, { s: refS, v: own }].sort((a, b) => a.s - b.s);
}

/**
 * The cube's light at hour `h`: the key (colour, elevation, azimuth) and its gain against the reference's (`gainK`,
 * the card's sun's or the moon's), the ambient, the dome (zenith, horizon as rgb), the fog's colour, the water's colour
 * (null: the cube's own) and the night's share for the dome's stars (`night`, 0 by day).
 */
export function hourLight(cube, h) {
  const ref = SIXTH_GEN_REFERENCES[resolveLook(cube.light.reference)], top = noonOf(ref), hRef = referenceHour(ref);
  const s = heightAt(h, top), refS = ref.light.key ? heightAt(hRef, top) : -1;
  // the cube's own sky at its own hour: its sky (a solved palette's), else the reference's dome
  const S = cube.light.sky, own = S ? { zenith: rgbOf(S.zenith), horizon: rgbOf(S.horizon), fog: S.fog ?? ref.air.fog.color } : { ...ref.air.dome, fog: ref.air.fog.color };
  const ownHex = { zenith: hexOf(own.zenith), horizon: hexOf(own.horizon), fog: own.fog };
  const carried = (R, keepHorizon = false) => ({ zenith: rgbOf(atValueOf(ownHex.zenith, R.air.dome.zenith)), horizon: keepHorizon ? [...R.air.dome.horizon] : rgbOf(atValueOf(ownHex.horizon, R.air.dome.horizon)),
    fog: keepHorizon ? R.air.fog.color : atValueOf(ownHex.fog, rgbOf(R.air.fog.color)) });
  const twilight = { zenith: rgbOf(atValueOf(ownHex.zenith, TWI.zenith)), horizon: [...TWI.horizon], fog: TWI.fog };
  const sky = along(keyframes(skyS(refS), own, { night: carried(NIGHT), twilight, golden: carried(GOLD, true), day: carried(DAY) }), skyS(s), mixSky);
  const ambient = along(keyframes(skyS(refS), ref.light.ambient, { night: NIGHT.light.ambient, twilight: TWI.ambient, golden: GOLD.light.ambient, day: DAY.light.ambient }), skyS(s), mixHex);
  const moonlit = s < MOON_AT, moon = { ...MOON, ...(cube.light.moon ?? {}) };
  let key, gainK;
  if (moonlit) {
    key = { color: moon.color, elevation: moon.elevation, azimuth: moon.azimuth };
    gainK = 0.4 + 0.6 * smooth(clamp((MOON_AT - s) / (1 + MOON_AT), 0, 1));
  } else {
    // the sun: the arc's elevation (no lower than LOW_SUN), its azimuth from the reference's (or the moon's at a night
    // reference's 23:00), its colour from golden through the reference to noon
    const az0 = ref.light.key ? ref.light.key.azimuth ?? 225 : moon.azimuth, refKey = ref.light.key ? ref.light.key.color : GOLD.light.key.color;
    const color = along(keyframes(ref.light.key ? refS : -1, refKey, { night: GOLD.light.key.color, golden: GOLD.light.key.color, day: DAY.light.key.color }), s, mixHex);
    key = { color, elevation: r3(Math.max(LOW_SUN, elevationAt(h, top))), azimuth: r3((((az0 + 15 * (h - hRef)) % 360) + 360) % 360) };
    gainK = 0.45 + 0.55 * smooth(clamp((s - MOON_AT) / (0.25 - MOON_AT), 0, 1));
  }
  // the water: a day cube's darkens into the night as a night cube's was solved (its hue at the night dome's value)
  const water = ref.light.key && cube.colour.water && s < 0 ? mixHex(cube.colour.water, atValueOf(cube.colour.water, sky.zenith), clamp(-s, 0, 1)) : null;
  return { hour: h, s: r3(s), moonlit, key, gainK: r3(gainK), ambient, dome: { zenith: sky.zenith.map(Math.round), horizon: sky.horizon.map(Math.round) }, fog: sky.fog, water,
    night: r3(clamp(-s, 0, 1)) };
}

/**
 * The hour's light and air under `clouds` (matte-paint/sky.js readClouds, or none): under cloud the key weakens, the shade
 * fills toward the sky's grey, the air thickens and greys, and the sun's disc is gone; clouds that follow a live weather
 * (`live`) lean only the disc, the live channel carrying the air (weather/weather.js). → { H (hourLight), gain (on the
 * key's own gain), ambient, fog: { color, density }, disc, band (the cloud band's spec, or null), dome }.
 */
export function hourAir(cube, hour, clouds) {
  const ref = SIXTH_GEN_REFERENCES[resolveLook(cube.light.reference)], H = hourLight(cube, hour), dome = H.dome;
  const W0 = clouds ? WEATHERS[clouds.kind].light : null, Wl = !W0 ? { gain: 1, ambient: 0, fog: 1, disc: true } : clouds.live ? { gain: 1, ambient: 0, fog: 1, disc: W0.disc } : W0;
  const grey = (() => { const m = dome.zenith.map((v, k) => (v + dome.horizon[k]) / 2), y = (m[0] + m[1] + m[2]) / 3; return m.map((v) => (v + 2 * y) / 3); })();
  const lean = (hex, t) => (t ? hexOf(rgbOf(hex).map((v, k) => v + (grey[k] - v) * t)) : hex);
  const band = clouds ? { clouds: { kind: clouds.kind, cover: clouds.cover, seed: clouds.seed }, sun: sunDir(H.key.elevation, H.key.azimuth).map((v) => Math.round(v * 1e5) / 1e5), key: H.key.color, zenith: dome.zenith, horizon: dome.horizon, night: H.night } : null;
  return { H, gain: H.gainK * Wl.gain, ambient: lean(H.ambient, Wl.ambient), fog: { color: lean(H.fog, Wl.ambient), density: +(ref.air.fog.density * cube.light.outsideFog * Wl.fog).toFixed(5) }, disc: Wl.disc, band, dome };
}
