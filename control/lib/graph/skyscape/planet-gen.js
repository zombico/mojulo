/**
 * THE PLANET GENERATOR — a world for a space map's sky as a set of physical knobs, not a picture: what it is made of
 * (rock or gas), how much of it is sea, what colour its land and its plants are, how far its ice reaches, how cloudy, how
 * cratered, whether it burns or is lit by cities, its bands and storms if it is a giant, its air's colour and depth, its
 * rings. The space backdrop (backdrop.js) places them; one shader (scene/channels/space-backdrop.js) draws any of them.
 *
 *   PLANET_KINDS     the archetypes, a row each (the words people say: an earthlike world, a desert, a gas giant, a
 *                    hot jupiter, a city world, a black hole…): each knob's range and its palette; a new kind of world is
 *                    a row. `size` 'large' | 'small' | 'any' where the sky may use it; `weight` how often a random world is it
 *   generatePlanet(kind, rnd) → the world: { kind, gas, ocean, … } every knob a number or a colour (hex), its palette's
 *                    hues turned a little by the dice so no two are alike (and never into the cockpit's target magenta)
 *   pickKind(rnd, size) → a kind by weight among those the slot takes
 *   BLACK_HOLE       the black hole's numbers (it is no planet: a shadow, a photon ring, a disk, its lensing)
 *
 * Every knob 0..1 unless said: ocean (sea level: 0 none, 1 all), veg, ice (how far the caps reach), cloud, craters,
 * lava, lights (cities on the night side), dunes, haze (the air's tint over the disc), atmo (its rim's strength),
 * glow (the night side's own heat); a giant's bands (three colours), freq (bands round it), turb, storm.
 * Pure: the same dice, the same world.
 */

// (a row's palette: each a hex; `ranges` [lo, hi] each knob)
const K = (o) => Object.freeze(o);
export const PLANET_KINDS = Object.freeze({
  earthlike: K({ label: 'an earthlike world', size: 'any', weight: 3, gas: 0, ranges: { ocean: [0.55, 0.7], veg: [0.5, 0.75], ice: [0.1, 0.2], cloud: [0.4, 0.55], atmo: [0.8, 1] },
    colors: { land0: '#7a6a48', land1: '#a08f6a', sea: '#1f4f86', vegC: '#3f6e2c', iceC: '#eef4f8', cloudC: '#f2f4f6', atmoC: '#7fb2ff' } }),
  ocean: K({ label: 'an ocean world', size: 'any', weight: 2, gas: 0, ranges: { ocean: [0.88, 0.96], veg: [0.3, 0.6], ice: [0.08, 0.15], cloud: [0.5, 0.65], atmo: [0.9, 1] },
    colors: { land0: '#6f7a4a', land1: '#8f8f6a', sea: '#18508f', vegC: '#3f7a3a', iceC: '#eef6fb', cloudC: '#f4f6f8', atmoC: '#7fb7ff' } }),
  desert: K({ label: 'a desert world', size: 'any', weight: 2, gas: 0, ranges: { ocean: [0, 0.06], dunes: [0.5, 0.9], ice: [0.02, 0.08], cloud: [0.02, 0.1], atmo: [0.35, 0.55], haze: [0.08, 0.18] },
    colors: { land0: '#b4874f', land1: '#dcb77c', sea: '#2a5f74', vegC: '#7a7040', iceC: '#f3eee2', cloudC: '#efe6d6', atmoC: '#e8c28c' } }),
  jungle: K({ label: 'a jungle world', size: 'any', weight: 1, gas: 0, ranges: { ocean: [0.3, 0.45], veg: [0.85, 1], ice: [0, 0.05], cloud: [0.55, 0.7], atmo: [0.85, 1] },
    colors: { land0: '#5a5a32', land1: '#6e6a44', sea: '#1d5a6e', vegC: '#2a5a24', iceC: '#eef4f0', cloudC: '#eef2ee', atmoC: '#86c6d8' } }),
  arctic: K({ label: 'an ice world', size: 'any', weight: 2, gas: 0, ranges: { ocean: [0.35, 0.55], ice: [0.7, 0.95], cloud: [0.2, 0.4], atmo: [0.4, 0.6], craters: [0, 0.2] },
    colors: { land0: '#8f9aa4', land1: '#c2ccd4', sea: '#2d5873', vegC: '#7a8a8a', iceC: '#eaf4fb', cloudC: '#f2f6fa', atmoC: '#bfe2ff' } }),
  volcanic: K({ label: 'a volcanic world', size: 'any', weight: 1, gas: 0, ranges: { ocean: [0, 0.1], lava: [0.45, 0.7], cloud: [0.2, 0.4], atmo: [0.3, 0.5], haze: [0.1, 0.2], glow: [0.1, 0.25] },
    colors: { land0: '#2b2422', land1: '#4a3a33', sea: '#3a1a10', vegC: '#3a3330', iceC: '#d9d2ca', cloudC: '#6c6460', atmoC: '#c0785a', lavaC: '#ff6a1f' } }),
  toxic: K({ label: 'a toxic world', size: 'any', weight: 1, gas: 0, ranges: { ocean: [0.25, 0.45], cloud: [0.55, 0.75], atmo: [0.7, 0.9], haze: [0.3, 0.5] },
    colors: { land0: '#8a7f3a', land1: '#b3a750', sea: '#6c8a24', vegC: '#7a8a2a', iceC: '#e6e8c8', cloudC: '#e8d870', atmoC: '#d8d860' } }),
  barren: K({ label: 'a barren moon', size: 'small', weight: 3, gas: 0, ranges: { craters: [0.6, 1], atmo: [0, 0.05] },
    colors: { land0: '#6e6a66', land1: '#9c9893', sea: '#444444', vegC: '#666666', iceC: '#dddddd', cloudC: '#cccccc', atmoC: '#999999' } }),
  rust: K({ label: 'a rust world', size: 'any', weight: 2, gas: 0, ranges: { ocean: [0, 0.04], ice: [0.06, 0.14], craters: [0.2, 0.45], cloud: [0, 0.08], atmo: [0.25, 0.4], dunes: [0.2, 0.5] },
    colors: { land0: '#8a3f24', land1: '#c07045', sea: '#3a2a2a', vegC: '#7a4a30', iceC: '#f2ece6', cloudC: '#f0d8c8', atmoC: '#e0a58a' } }),
  crimson: K({ label: 'a world of crimson forests', size: 'any', weight: 1, gas: 0, ranges: { ocean: [0.4, 0.55], veg: [0.75, 0.95], ice: [0.05, 0.12], cloud: [0.35, 0.5], atmo: [0.8, 0.95] },
    colors: { land0: '#6a5a44', land1: '#8a7a5a', sea: '#1c5a66', vegC: '#8a2230', iceC: '#f2f2f4', cloudC: '#f4f0f0', atmoC: '#9fb8ff' } }),
  city: K({ label: 'a city world', size: 'any', weight: 1, gas: 0, ranges: { ocean: [0.15, 0.3], lights: [0.85, 1], cloud: [0.15, 0.3], atmo: [0.6, 0.8], haze: [0.05, 0.12] },
    colors: { land0: '#5a5c60', land1: '#7c7f84', sea: '#1d3a5a', vegC: '#4a5a44', iceC: '#e8ecf0', cloudC: '#dfe2e6', atmoC: '#9ab0d0' } }),
  molten: K({ label: 'a molten world', size: 'any', weight: 1, gas: 0, ranges: { lava: [0.85, 1], glow: [0.35, 0.6], atmo: [0.4, 0.6], haze: [0.1, 0.2] },
    colors: { land0: '#1a1210', land1: '#2e201a', sea: '#2a1008', vegC: '#2a1a14', iceC: '#d9d2ca', cloudC: '#5a4a44', atmoC: '#ff8a4a', lavaC: '#ff5a10' } }),
  jovian: K({ label: 'a gas giant', size: 'large', weight: 3, gas: 1, ranges: { freq: [6, 10], turb: [1.6, 2.6], storm: [0.4, 0.9], atmo: [0.5, 0.7] },
    colors: { band0: '#d8c3a0', band1: '#a87a52', band2: '#efe4cf', stormC: '#b5543a', atmoC: '#e8c89a' } }),
  'ice-giant': K({ label: 'an ice giant', size: 'large', weight: 2, gas: 1, ranges: { freq: [4, 7], turb: [0.8, 1.4], storm: [0.2, 0.5], atmo: [0.7, 0.9] },
    colors: { band0: '#4f83c9', band1: '#3a6aae', band2: '#7fb0e0', stormC: '#1f3a72', atmoC: '#9fd0ff' } }),
  'hot-jupiter': K({ label: 'a hot jupiter', size: 'large', weight: 1, gas: 1, ranges: { freq: [5, 8], turb: [2, 3], storm: [0.3, 0.6], atmo: [0.6, 0.8], glow: [0.25, 0.45] },
    colors: { band0: '#7a2e1a', band1: '#c0582a', band2: '#e89a4a', stormC: '#3a1208', atmoC: '#ff9a5a', lavaC: '#ff6a2a' } }),
  saturnian: K({ label: 'a ringed giant', size: 'large', weight: 2, gas: 1, rings: 1, ranges: { freq: [8, 12], turb: [0.6, 1.1], storm: [0, 0.2], atmo: [0.5, 0.7] },
    colors: { band0: '#e3cf9c', band1: '#c9ad74', band2: '#f1e6c4', stormC: '#a88a5a', atmoC: '#f0dcae', ringC: '#d8c8a0' } }),
  'black-hole': K({ label: 'a black hole', size: 'large', weight: 1, blackHole: 1, ranges: {}, colors: {} }),
});

/** The black hole: its shadow's angular radius (°) in the sky, the disk's inner and outer edges and the Einstein
 *  radius (in shadows), its inclination off edge-on (°), the disk's hot and cool colours. */
export const BLACK_HOLE = Object.freeze({ r: Object.freeze([3.5, 5]), disk: Object.freeze([1.6, 4.4]), einstein: 1.6, tilt: Object.freeze([5, 12]), hot: '#fff2d8', cool: '#ff7a2a' });

const KNOBS = ['ocean', 'veg', 'ice', 'cloud', 'craters', 'lava', 'lights', 'dunes', 'haze', 'atmo', 'glow', 'freq', 'turb', 'storm'];
const r3 = (v) => Math.round(v * 1000) / 1000;
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
function hsvOf(h) {
  const [r, g, b] = rgbOf(h), M = Math.max(r, g, b), m = Math.min(r, g, b), d = M - m;
  const x = !d ? 0 : M === r ? ((g - b) / d) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(x * 60 + 360) % 360, M ? d / M : 0, M];
}
function hexOf(h, s, v) {
  const f = (n) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return '#' + [f(5), f(3), f(1)].map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join('');
}
// (a colour turned a little: its hue by up to `dh`°, its value by up to a tenth; kept out of the target's magenta,
// 285°..345°, cockpit-look.js)
function turn(hex, rnd, dh = 12) {
  const [h, s, v] = hsvOf(hex);
  let H = (h + (rnd() * 2 - 1) * dh + 360) % 360;
  if (s > 0.25 && H > 285 && H < 345) H = H < 315 ? 284 : 346;
  return hexOf(H, s, Math.max(0, Math.min(1, v * (0.9 + rnd() * 0.2))));
}

export function pickKind(rnd, size = 'any') {
  const ok = Object.entries(PLANET_KINDS).filter(([, k]) => size === 'any' || k.size === 'any' || k.size === size);
  const sum = ok.reduce((s, [, k]) => s + k.weight, 0);
  let x = rnd() * sum;
  for (const [id, k] of ok) { x -= k.weight; if (x <= 0) return id; }
  return ok[ok.length - 1][0];
}

export function generatePlanet(kind, rnd) {
  const R = PLANET_KINDS[kind];
  if (!R) throw new Error(`planet: '${kind}' is not a kind of world (${Object.keys(PLANET_KINDS).join(', ')})`);
  if (R.blackHole) {
    const B = BLACK_HOLE, span = ([lo, hi]) => lo + rnd() * (hi - lo);
    return { kind, blackHole: true, tilt: r3(span(B.tilt)), spin: r3(rnd() * 360), disk: [...B.disk], einstein: B.einstein, hot: B.hot, cool: turn(B.cool, rnd, 8), seed: Math.floor(rnd() * 1e6) };
  }
  const w = { kind, gas: R.gas ? 1 : 0 };
  for (const k of KNOBS) { const r = R.ranges[k]; w[k] = r ? r3(r[0] + rnd() * (r[1] - r[0])) : 0; }
  for (const [k, c] of Object.entries(R.colors)) w[k] = turn(c, rnd, k === 'sea' || k === 'iceC' || k === 'cloudC' ? 6 : 12);
  if (R.rings || (R.gas && rnd() < 0.3)) w.rings = { inner: r3(1.35 + rnd() * 0.2), outer: r3(2 + rnd() * 0.5), tilt: r3(10 + rnd() * 25), color: turn(R.colors.ringC || R.colors.band2 || '#d8c8a0', rnd, 8) };
  w.seed = Math.floor(rnd() * 1e6);
  return w;
}
