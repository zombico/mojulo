/**
 * THE FLIGHT SKY — what a pilot looks at most: the weather of an airspace map, in the words the geocube's skies already
 * use (matte-paint/sky.js WEATHERS: clear, fair, high, haze, overcast, storm), resolved to what a flight needs in three
 * dimensions. A painted band round the dome serves a walker; a pilot climbs through the cloud, flies over its tops and
 * looks down through its gaps, so here each weather is LAYERS at their heights:
 *
 *   cumulus       heaped clouds over a flat base (fair weather's, at the condensation level), each a cluster of
 *                 puffs, placed in streets along the wind; `towering` ones (a storm's cumulonimbus) climb kilometres
 *   deck          a sheet between a base and a top: stratus (overcast's lid), stratocumulus (a storm's broken shelf),
 *                 altocumulus (mid-level ripples); its `cover` the share of the sky it closes
 *   cirrus        a thin high veil of streaks, never flown into
 *
 * and the LIGHT the weather leaves: the sun at the hour (its height and bearing over the map; low, it is warm and the
 * sky's horizon glows), the sky light's share (an overcast's flat light), the haze (thicker in haze and storm, never
 * thinner than the map planned: map.js holds its edge unseen), the wind (its bearing and speed, so the clouds drift
 * and the sea rises: Pierson-Moskowitz, a fully developed sea's height and its peak wave's length from the wind's
 * speed) and the sea's colour.
 *
 *   FLIGHT_SKIES, readSkyAsk(ask) → errors
 *   flightSky(ask, { map, seed }) → { kind, hour, night, sun: { dir, elev, az, color }, moon, light: { dir, ambient, gain, tint }, lightning,
 *     colours: { zenith, horizon, haze, cloudLit, cloudShade, sea, seaShallow }, hazeMul, wind: { from, speed, dir },
 *     layers, clouds: [[x, y, base, radius, height, seed]…], domain, sea: { height, waves: [[dirx, diry, length, amp, phase]…] }, aloft,
 *     metar }
 *
 * `ask`: a kind ('fair') or { kind?, cover?, hour?, wind?: { from?, speed? }, base?, seed?, lightning?, moon? }. Absent:
 * fair at mid afternoon, the sun where the map always lit its ground from. Metres, degrees for bearings (from north,
 * clockwise, the way a pilot reads them), hours 0–24.
 *
 * NIGHT: past sunset the day's colours fade through the twilight (its afterglow on the horizon) into the night's: a
 * dark sky with its stars, the moon (its lit share `moon`, else the dice's) lighting the ground and the clouds, the
 * ground's tint dark and blue. A town lights itself (the page's city lights, aerial.js and night-lights.js).
 * LIGHTNING (`lightning`, a storm's by default): the page's flashes in the thunderheads, by day or night.
 *
 * Pure, seeded (mulberry32).
 */
import * as dmath from '../../util/dmath.js';
import { streamOf } from '../city/plan/dice.js';

/** Each weather: its cloud layers (base and top in m, cover 0…1, a cumulus's size [min, max] m across), its light
 *  (ambient and gain: the kernel's lambert), its haze over the map's, its wind's default speed (m/s), its sea's colour. */
export const FLIGHT_SKIES = Object.freeze({
  clear: Object.freeze({ read: 'clear: a deep sky, a few streaks of cirrus, the sun hard', layers: [{ type: 'cirrus', base: 8500, cover: 0.18 }], light: { ambient: 0.4, gain: 0.66 }, haze: 1, wind: 4, sea: '#123c5c' }),
  fair: Object.freeze({ read: 'fair: fair-weather cumulus in streets along the wind, cirrus high over them', layers: [{ type: 'cumulus', base: 1100, depth: [220, 560], cover: 0.22, size: [900, 2400] }, { type: 'cirrus', base: 8000, cover: 0.22 }], light: { ambient: 0.42, gain: 0.62 }, haze: 1, wind: 6, sea: '#163f5c' }),
  high: Object.freeze({ read: 'high: altocumulus ripples at mid level, a cirrus veil, the sun through them', layers: [{ type: 'deck', form: 'altocumulus', base: 3600, depth: 250, cover: 0.45 }, { type: 'cirrus', base: 7500, cover: 0.6 }], light: { ambient: 0.46, gain: 0.56 }, haze: 1, wind: 8, sea: '#1d4660' }),
  haze: Object.freeze({ read: 'haze: a milky summer haze, a few small cumulus in it, the far land gone pale', layers: [{ type: 'cumulus', base: 1500, depth: [140, 320], cover: 0.08, size: [600, 1300] }], light: { ambient: 0.5, gain: 0.48 }, haze: 2.2, wind: 3, sea: '#2a5566' }),
  overcast: Object.freeze({ read: 'overcast: a lid of stratus, its base dark and its top a sunlit floor; flat light under it', layers: [{ type: 'deck', form: 'stratus', base: 750, depth: 450, cover: 1 }], light: { ambient: 0.62, gain: 0.22 }, haze: 1.25, wind: 9, sea: '#2c4a52' }),
  storm: Object.freeze({ read: 'storm: towering cumulonimbus over a broken shelf, dark under, the sea running high', layers: [{ type: 'cumulus', towering: true, base: 650, depth: [2500, 6500], cover: 0.12, size: [1800, 4200] }, { type: 'deck', form: 'stratocumulus', base: 950, depth: 400, cover: 0.62 }], light: { ambient: 0.5, gain: 0.2 }, haze: 1.45, wind: 16, sea: '#24383e' }),
});
export const FLIGHT_SKY_IDS = Object.freeze(Object.keys(FLIGHT_SKIES));
/** The hour a sky is at when none is asked: mid afternoon (the sun where the map's ground was always lit from). */
export const DEFAULT_HOUR = 14.5;
const G = 9.81;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const r2 = (v) => Math.round(v * 100) / 100, r4 = (v) => Math.round(v * 1e4) / 1e4;
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const hex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

/** Errors (strings) for an airspace's `sky`; [] when it resolves. */
export function readSkyAsk(ask, at = 'airspace.sky') {
  if (ask === undefined) return [];
  if (typeof ask === 'string') return FLIGHT_SKIES[ask] ? [] : [`${at} must be one of ${FLIGHT_SKY_IDS.join(', ')}, or { kind?, cover?, hour?, wind?, base?, seed? }`];
  if (!isObj(ask)) return [`${at} must be a weather (${FLIGHT_SKY_IDS.join(', ')}) or { kind?, cover?, hour?, wind?, base?, seed? }`];
  const e = [];
  for (const k of Object.keys(ask)) if (!['kind', 'cover', 'hour', 'wind', 'base', 'seed', 'lightning', 'moon'].includes(k)) e.push(`${at}.${k} is not a setting (kind, cover, hour, wind, base, seed, lightning, moon)`);
  if (ask.lightning !== undefined && typeof ask.lightning !== 'boolean') e.push(`${at}.lightning is true or false (a storm's is on)`);
  if (ask.moon !== undefined && !(Number.isFinite(ask.moon) && ask.moon >= 0 && ask.moon <= 1)) e.push(`${at}.moon is the moon's lit share, 0 (new) to 1 (full)`);
  if (ask.kind !== undefined && !FLIGHT_SKIES[ask.kind]) e.push(`${at}.kind must be one of ${FLIGHT_SKY_IDS.join(', ')}`);
  if (ask.cover !== undefined && !(Number.isFinite(ask.cover) && ask.cover >= 0 && ask.cover <= 1)) e.push(`${at}.cover is the share of the sky its main layer closes, 0–1`);
  if (ask.hour !== undefined && !(Number.isFinite(ask.hour) && ask.hour >= 0 && ask.hour <= 24)) e.push(`${at}.hour is the hour of the day, 0–24 (dusk past 18, night past 19.5, dawn from 4.5)`);
  if (ask.base !== undefined && !(Number.isFinite(ask.base) && ask.base >= 150 && ask.base <= 6000)) e.push(`${at}.base is its main layer's base in metres, 150–6000`);
  if (ask.seed !== undefined && !Number.isInteger(ask.seed)) e.push(`${at}.seed is a whole number`);
  if (ask.wind !== undefined && !(isObj(ask.wind) && Object.keys(ask.wind).every((k) => ['from', 'speed'].includes(k))
    && (ask.wind.from === undefined || (Number.isFinite(ask.wind.from) && ask.wind.from >= 0 && ask.wind.from <= 360))
    && (ask.wind.speed === undefined || (Number.isFinite(ask.wind.speed) && ask.wind.speed >= 0 && ask.wind.speed <= 30)))) e.push(`${at}.wind is { from?: degrees 0–360 (where it blows from), speed?: m/s 0–30 }`);
  return e;
}

/** The sun at an hour: its height (0 at 6 and 18, highest at noon, under the horizon at night) and its bearing (east at
 *  6, south at noon, west at 18: a northern map), and the unit vector toward it (x east, y north, z up). */
export function sunAt(hour) {
  const elev = 58 * dmath.sin(Math.PI * (hour - 6) / 12), bearing = (90 + 180 * (hour - 6) / 12 + 720) % 360;
  return { elev: r2(elev), az: r2(bearing), dir: dirOf(elev, bearing) };
}
const dirOf = (elev, bearing) => { const e = elev * Math.PI / 180, b = bearing * Math.PI / 180; return [r4(dmath.cos(e) * dmath.sin(b)), r4(dmath.cos(e) * dmath.cos(b)), r4(dmath.sin(e))]; };
/** How far into the night an hour is: 0 while the sun is up, rising through the twilight (the sun 2° over the horizon to
 *  10° under it), 1 past it. */
export const nightOf = (elev) => 1 - smooth(-10, 2, elev);
/** The night's own colours (0–255): its sky, its haze, its clouds (moonlit, or barely there), its sea; scaled by the
 *  moon's lit share. */
function nightColours(kind, phase, W) {
  const m = 0.55 + 0.45 * phase, veil = W.light.gain < 0.3 ? 1 : 0;
  const zenith = [4, 7, 17].map((v) => v * (veil ? 1.4 : 1)), horizon = [16, 21, 34].map((v) => v * (veil ? 1.25 : 1) * m);
  return { zenith, horizon, cloudLit: [62, 68, 84].map((v) => v * m * (veil ? 0.7 : 1)), cloudShade: [20, 23, 31], sea: [5, 10, 18],
    tint: [0.1, 0.125, 0.2].map((v) => v * m), sunCol: [190, 204, 230].map((v) => v * m) };
}

/** A fully developed sea under a wind (Pierson-Moskowitz): its significant height (m) and its peak wave's length (m);
 *  and the trains the page sums (each a direction, a length, an amplitude and a phase): the wind sea about the peak and a long
 *  swell from further off. */
export function seaOf(windDir, speed, seed) {
  const U = Math.max(1.5, speed), Hs = 0.21 * U * U / G, Lp = 2 * Math.PI * U * U / (0.769 * G);
  const R = streamOf(seed, 'sky', 'sea'), [dx, dy] = windDir, waves = [];
  // the wind sea: trains about the peak, the shorter spread wider about the wind (a short sea is confused), each its
  // own phase; their heights shares of the sea's, never steeper than a seventh of their length
  const trains = [[1.45, 0.2, 0.25], [1, 0.3, 0.35], [0.8, 0.16, 0.8], [0.62, 0.12, 1.0], [0.47, 0.09, 1.2], [0.35, 0.07, 1.3], [0.26, 0.06, 1.4]];
  for (const [k, share, spread] of trains) {
    const a = (R() - 0.5) * 2 * spread, c = dmath.cos(a), s = dmath.sin(a), L = Math.max(3, Lp * k * (0.9 + 0.2 * R()));
    waves.push([r4(dx * c - dy * s), r4(dx * s + dy * c), r2(L), r2(Math.min(L / 14, share * Hs * 0.5)), r2(R() * 6.283)]);
  }
  // the swell: long and low, from off the wind's own line
  const sa = 0.6 + R() * 0.5, c = dmath.cos(sa), s = dmath.sin(sa), L = Math.max(90, 2.2 * Lp);
  waves.push([r4(dx * c - dy * s), r4(dx * s + dy * c), r2(L), r2(Math.min(L / 50, 0.15 + 0.12 * Hs)), r2(R() * 6.283)]);
  return { height: r2(Hs), peak: r2(Lp), waves };
}

/** The cumulus of a layer over a square of `half` m about the map's middle: [x, y, base, radius, height, seed], placed on
 *  a jittered grid kept where a slow noise and the wind's streets allow, until the layer's cover is reached. */
function placeCumulus(L, cover, half, wind, seed) {
  const R = streamOf(seed, 'sky', `cumulus:${L.base}`), [s0, s1] = L.size, mean = (s0 + s1) / 2, step = mean * 1.1;
  const n = Math.ceil((2 * half) / step), out = [], area = (2 * half) ** 2;
  // a cloud street runs along the wind; across it they come in rows a couple of kilometres apart
  const [wx, wy] = wind.dir, gap = 2.2 * mean + 900, ph = R() * 6.283;
  const cand = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = -half + (i + R()) * step, y = -half + (j + R()) * step, across = -x * wy + y * wx;
    const street = 0.5 + 0.5 * dmath.cos(across / gap * 6.283 + ph), patch = R();
    cand.push({ x, y, score: 0.55 * street + 0.45 * patch, r: R(), h: R(), sd: Math.floor(R() * 1e6) });
  }
  cand.sort((a, b) => b.score - a.score);
  let covered = 0;
  for (const c of cand) {
    if (covered >= cover * area) break;
    const dia = s0 + (s1 - s0) * c.r ** 1.6, rad = dia / 2, depth = L.depth[0] + (L.depth[1] - L.depth[0]) * (L.towering ? c.h : c.h * (dia - s0) / Math.max(1, s1 - s0));
    out.push([r2(c.x), r2(c.y), r2(L.base + (c.h - 0.5) * 60), r2(rad), r2(depth), c.sd]);
    covered += Math.PI * rad * rad * 0.75;
  }
  return out;
}

/** A weather's colours at the sun's height: its zenith and horizon, the sun's colour, the ground's tint, the clouds' lit
 *  side and shade (0–255 lists, the tint 0–1). */
function skyColours(kind, sun, W) {
  const low = 1 - smooth(4, 28, sun.elev), dim = smooth(0, 14, sun.elev);
  const sunCol = mix([255, 248, 236], [255, 168, 96], low);
  const veil = W.light.gain < 0.3 ? 1 : 0;   // an overcast sky: the sun's colour is lost in it
  let zenith = [72, 126, 196], horizon = [192, 212, 228];
  if (kind === 'haze') { zenith = [120, 156, 196]; horizon = [214, 214, 206]; }
  if (kind === 'high') { zenith = [92, 136, 190]; horizon = [200, 212, 222]; }
  if (kind === 'overcast') { zenith = [148, 156, 164]; horizon = [186, 191, 196]; }
  if (kind === 'storm') { zenith = [84, 92, 102]; horizon = [132, 140, 146]; }
  horizon = mix(horizon, mix([250, 176, 120], horizon, 0.35 + 0.5 * veil), low * (1 - 0.6 * veil));
  zenith = mix(zenith, [52, 78, 130], low * 0.6 * (1 - veil));
  const level = 0.55 + 0.45 * dim;
  zenith = zenith.map((v) => v * level); horizon = horizon.map((v) => v * (0.6 + 0.4 * dim));
  // the ground's tint: the sun's colour where the sun lights it, the sky's where it does not
  const tint = mix([1, 1, 1], sunCol.map((v) => v / 255), (1 - veil) * low * 0.7).map((v, i) => v * (veil ? [0.94, 0.96, 1][i] : 1) * (0.7 + 0.3 * dim));
  const cloudLit = mix([250, 250, 252], sunCol, veil ? 0 : 0.35 + 0.4 * low).map((v) => v * (veil ? 0.82 : 1) * (0.65 + 0.35 * dim));
  const cloudShade = mix(zenith, [150, 156, 166], 0.55).map((v) => v * (kind === 'storm' ? 0.55 : 0.85));
  return { zenith, horizon, sunCol, tint, cloudLit, cloudShade };
}

/** The sky for an airspace map. */
export function flightSky(ask, { map, seed = 1 } = {}) {
  const errs = readSkyAsk(ask); if (errs.length) throw new Error(`sky: ${errs.join('; ')}`);
  const A = typeof ask === 'string' ? { kind: ask } : ask || {}, kind = A.kind ?? 'fair', W = FLIGHT_SKIES[kind], sd = A.seed ?? seed;
  const hour = A.hour ?? DEFAULT_HOUR, sun = sunAt(hour), night = nightOf(sun.elev);
  // the moon at night: high in the south-east of the sun's night, its lit share the ask's or the dice's
  const phase = A.moon ?? r2(0.45 + 0.55 * streamOf(sd, 'sky', 'moon')()), moonAz = (sun.az + 205) % 360, moon = { elev: 38, az: r2(moonAz), dir: dirOf(38, moonAz), phase };
  // the wind: from the kind's default bearing (west-south-west, the prevailing) unless said; its unit vector the way it blows
  const from = A.wind?.from ?? 250, speed = A.wind?.speed ?? W.wind, fb = (from * Math.PI) / 180, dir = [r4(-dmath.sin(fb)), r4(-dmath.cos(fb))];
  const wind = { from, speed, dir };
  // the light the hour leaves: low, the sun is warm and dim and the horizon glows
  const low = 1 - smooth(4, 28, sun.elev), dim = smooth(0, 14, sun.elev);
  // the day's colours (a set sun's: its afterglow), fading through the twilight into the night's
  const up = { ...sun, elev: Math.max(0.3, sun.elev) }, Nc = nightColours(kind, phase, W), Na = nightColours('clear', phase, FLIGHT_SKIES.clear);
  const fade = (D, N) => ({ zenith: mix(D.zenith, N.zenith, night), horizon: mix(D.horizon, N.horizon, night), sunCol: D.sunCol, tint: mix(D.tint, N.tint, night),
    cloudLit: mix(D.cloudLit, N.cloudLit, night), cloudShade: mix(D.cloudShade, N.cloudShade, night) });
  const C = fade(skyColours(kind, up, W), Nc), A0 = fade(skyColours('clear', up, FLIGHT_SKIES.clear), Na);
  const { zenith, horizon, sunCol, tint, cloudLit, cloudShade } = C;
  const sea = mix(mix(rgb(W.sea), horizon, 0.08 + 0.12 * low), Nc.sea, night);
  // the layers, the main one taking the ask's cover and base
  const layers = W.layers.map((L, i) => ({ ...L, ...(i === 0 && A.cover !== undefined ? { cover: A.cover } : {}), ...(i === 0 && A.base !== undefined ? { base: A.base } : {}) }));
  // the clouds placed over a square the ceiling's eye reaches across (at most 40 km)
  const half = Math.min(20000, Math.max(8000, (map?.rings?.reach?.hx ?? 6000) + 0.5 * (map?.haze?.see?.ceiling ?? 20000)));
  const clouds = [];
  layers.forEach((L) => { if (L.type === 'cumulus') for (const c of placeCumulus(L, L.cover, half, wind, sd)) clouds.push(c); });
  const metar = metarOf(kind, layers, wind, map);
  return {
    kind, read: W.read, hour, night: r4(night), sun: { ...sun, color: hex(sunCol) }, moon: { ...moon, color: hex(Nc.sunCol) },
    // the ground's light: the sun's by day, the moon's by night (its direction; how dark is the tint's)
    light: { dir: night > 0.5 ? moon.dir : dirOf(Math.max(2, sun.elev), sun.az), ambient: r4(W.light.ambient + (0.3 - W.light.ambient) * night), gain: r4(W.light.gain * (0.55 + 0.45 * Math.max(dim, night))), tint: tint.map(r4) },
    lightning: A.lightning ?? kind === 'storm',
    colours: { zenith: zenith.map(Math.round), horizon: horizon.map(Math.round), haze: hex(horizon), cloudLit: hex(cloudLit), cloudShade: hex(cloudShade), sea: hex(sea), seaShallow: hex(mix([46, 150, 150], sea, 0.35)) },
    // over the cloud: the clear sky of the hour, the sun's own colour on the tops (what a pilot sees on top of a deck)
    aloft: { zenith: A0.zenith.map(Math.round), horizon: A0.horizon.map(Math.round), sun: hex(A0.sunCol), cloudLit: hex(A0.cloudLit) },
    hazeMul: W.haze, wind, layers, clouds, domain: half, sea: seaOf(dir, speed, sd), metar,
  };
}

/** The sky as a pilot reads it in a report (a METAR's wind, visibility and cloud groups; no station, no time). */
function metarOf(kind, layers, wind, map) {
  const kt = Math.round(wind.speed * 1.944), deg = String(Math.round(wind.from / 10) * 10 % 360 || 360).padStart(3, '0');
  const okta = (c) => (c < 0.05 ? null : c <= 0.25 ? 'FEW' : c <= 0.5 ? 'SCT' : c < 0.9 ? 'BKN' : 'OVC');
  const groups = layers.filter((L) => L.type !== 'cirrus' || L.cover > 0.4).map((L) => { const o = okta(L.cover); return o ? `${o}${String(Math.round(L.base * 3.281 / 100)).padStart(3, '0')}${L.towering ? 'CB' : ''}` : null; }).filter(Boolean);
  const see = map?.haze?.see?.lowPass, vis = see ? Math.min(9999, Math.round(see / FLIGHT_SKIES[kind].haze / 100) * 100) : 9999;
  return `${deg}${String(kt).padStart(2, '0')}KT ${vis >= 9999 ? '9999' : String(vis).padStart(4, '0')} ${groups.length ? groups.join(' ') : 'NSC'}`;
}
