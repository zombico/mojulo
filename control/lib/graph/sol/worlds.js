/**
 * sol/worlds — THE CHILDREN OF SOL AS WORLDS IN A SPACE LEVEL'S SKY: each body of the roster (sol/roster.js) as a row of
 * the planet generator's kinds (skyscape/planet-gen.js PLANET_KINDS), its knobs FIXED to the real world: no range for the
 * dice to roll in, no hue turned, its axial tilt its own, a ringed giant's rings at their real radii. Never drawn by the
 * dice (`weight: 0`): a level names one (`space.backdrop.worlds: ['saturn']`, a theatre's moon, a ground stage's
 * `route.world`), and it is that body, the same every time.
 *
 * A row is a planet kind's (label, size, weight, gas, ranges, colors) and:
 *   sol     true: a child of Sol, its knobs fixed (planet-gen.js reads it)
 *   tilt    its axial tilt (°): how its bands and its rings lie in the sky
 *   rings   a ringed giant's: { inner, outer } (its radii) and the ring's colour, drawn baked far off and live up close
 *
 * Pure data.
 */
const W = (o) => Object.freeze(o);
// (a fixed knob: a range of one value)
const at = (o) => Object.freeze(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Object.freeze([v, v])])));
const ROCK = { sea: '#3a3a3c', vegC: '#666666', iceC: '#e8e6e2', cloudC: '#d8d6d2' };

export const SOL_WORLDS = Object.freeze({
  mercury: W({ label: 'Mercury', size: 'any', weight: 0, gas: 0, sol: true, tilt: 0.03, ranges: at({ craters: 0.95, atmo: 0.02 }),
    colors: W({ ...ROCK, land0: '#58534d', land1: '#9c958b', atmoC: '#9a948c' }) }),
  // (Venus seen from space is its cloud deck, featureless cream: drawn as a giant's soft bands)
  venus: W({ label: 'Venus', size: 'any', weight: 0, gas: 1, sol: true, tilt: 177.4, ranges: at({ freq: 2.5, turb: 1.8, storm: 0, atmo: 0.65 }),
    colors: W({ band0: '#e2c98c', band1: '#cfae6e', band2: '#f2e4ba', stormC: '#c9a866', atmoC: '#f2dca6' }) }),
  earth: W({ label: 'Earth', size: 'any', weight: 0, gas: 0, sol: true, tilt: 23.44, ranges: at({ ocean: 0.68, veg: 0.6, ice: 0.12, cloud: 0.5, atmo: 0.95 }),
    colors: W({ land0: '#7a6a48', land1: '#a89770', sea: '#1d4c86', vegC: '#3c6a2c', iceC: '#eef4f8', cloudC: '#f4f6f8', atmoC: '#7fb2ff' }) }),
  moon: W({ label: 'the Moon', size: 'any', weight: 0, gas: 0, sol: true, tilt: 1.54, ranges: at({ craters: 0.7, atmo: 0 }),
    colors: W({ ...ROCK, land0: '#56565a', land1: '#aba9a3', atmoC: '#999999' }) }),
  mars: W({ label: 'Mars', size: 'any', weight: 0, gas: 0, sol: true, tilt: 25.19, ranges: at({ ice: 0.09, craters: 0.3, cloud: 0.03, atmo: 0.3, dunes: 0.3, haze: 0.05 }),
    colors: W({ land0: '#8a3f24', land1: '#c47c4e', sea: '#3a2a2a', vegC: '#7a4a30', iceC: '#f4efe8', cloudC: '#f0dccc', atmoC: '#e0a58a' }) }),
  jupiter: W({ label: 'Jupiter', size: 'large', weight: 0, gas: 1, sol: true, tilt: 3.13, ranges: at({ freq: 8, turb: 2.2, storm: 0.85, atmo: 0.55 }),
    colors: W({ band0: '#d9c6a3', band1: '#a6764e', band2: '#f0e6d2', stormC: '#b5523a', atmoC: '#e8cc9e' }) }),
  saturn: W({ label: 'Saturn', size: 'large', weight: 0, gas: 1, sol: true, tilt: 26.73, rings: W({ inner: 1.24, outer: 2.27, color: '#dccca4' }), ranges: at({ freq: 10, turb: 0.8, storm: 0.05, atmo: 0.55 }),
    colors: W({ band0: '#e3cf9c', band1: '#c9ad74', band2: '#f1e6c4', stormC: '#a88a5a', atmoC: '#f0dcae', ringC: '#dccca4' }) }),
  uranus: W({ label: 'Uranus', size: 'large', weight: 0, gas: 1, sol: true, tilt: 97.77, ranges: at({ freq: 3, turb: 0.4, storm: 0, atmo: 0.8 }),
    colors: W({ band0: '#9fd3d8', band1: '#8cc6cc', band2: '#b8e3e5', stormC: '#8cc6cc', atmoC: '#bfeef0' }) }),
  neptune: W({ label: 'Neptune', size: 'large', weight: 0, gas: 1, sol: true, tilt: 28.32, ranges: at({ freq: 5, turb: 1.2, storm: 0.5, atmo: 0.85 }),
    colors: W({ band0: '#3f6fd0', band1: '#2f58b4', band2: '#80a8ee', stormC: '#16285e', atmoC: '#8fb8ff' }) }),
  pluto: W({ label: 'Pluto', size: 'any', weight: 0, gas: 0, sol: true, tilt: 122.5, ranges: at({ craters: 0.2, haze: 0.04, atmo: 0.18, ice: 0.04 }),
    colors: W({ ...ROCK, land0: '#6a4632', land1: '#e2d6c2', iceC: '#f2ece2', atmoC: '#7fa8e8' }) }),
});
