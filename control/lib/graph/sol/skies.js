/**
 * sol/skies — THE GIANTS FLOWN: Jupiter, Saturn, Uranus and Neptune have no ground to stand on, so a game meets them as
 * a flight over their cloud tops (an airspace map's `sky: { world }`, skyscape/sky.js), never as a geocube. Each is a
 * weather of the flight sky's own shape (FLIGHT_SKIES): its LAYERS, the world's deck a floor of cloud closing the whole
 * sky under the pilot (the ground under it painted as more of the world's cloud, `ground`), its towers of convection and
 * its high haze over it; and its COLOURS in place of an Earth sky's, the sky over the deck its own (`aloft`), the deck
 * its bands' cream, gold, cyan or blue lit by a small far sun.
 *
 *   GIANT_SKIES   by body id: { read, base, layers, light, haze, wind, ground, colours: { zenith, horizon, cloudLit, cloudShade } }
 *                 (`ground` the colours the map's ground is painted under the deck, a geocube's key colours over the island's
 *                 light: the giant's deeper cloud, so what shows through the deck's gaps is more of it, never a field)
 *                 (`base` the flight sky whose machinery it rides: an overcast's, its deck a sunlit floor from above)
 *                 (`rings` a ringed giant's, over the deck as an arch across the sky: the latitude the pilot flies at
 *                 `tilt` (°), the rings' edges in the world's radii, their colour (0–255), opacity and profile, the
 *                 Saturn's C, B and A rings and the Cassini Division or 'thin' narrow dark ringlets; channels/flight-sky.js)
 *
 * Pure data.
 */
const G = (o) => Object.freeze(o);

export const GIANT_SKIES = Object.freeze({
  jupiter: G({ read: 'over Jupiter: a cream and rust deck to the horizon, towers of storm climbing out of it, a deep blue sky',
    base: 'overcast', layers: [{ type: 'deck', form: 'stratus', base: 900, depth: 700, cover: 1 }, { type: 'cumulus', towering: true, base: 1500, depth: [1800, 4200], cover: 0.07, size: [1400, 3200] }, { type: 'cirrus', base: 7500, cover: 0.3 }],
    light: { ambient: 0.5, gain: 0.5 }, haze: 0.6, wind: 18,
    ground: { stone: '#7a5034', floor: '#9a6a44', grass: '#c8a882', foliage: '#b08a64', sand: '#d8c4a0', water: '#8a6040' },
    colours: G({ zenith: [34, 62, 120], horizon: [214, 190, 152], cloudLit: [242, 230, 208], cloudShade: [158, 112, 78] }) }),
  saturn: G({ read: 'over Saturn: a soft gold deck under a pale hazy sky, a few towers far off',
    base: 'overcast', layers: [{ type: 'deck', form: 'stratus', base: 900, depth: 700, cover: 1 }, { type: 'cumulus', towering: true, base: 1500, depth: [1200, 2800], cover: 0.03, size: [1200, 2600] }],
    light: { ambient: 0.55, gain: 0.46 }, haze: 0.75, wind: 14,
    rings: G({ tilt: 28, inner: 1.24, outer: 2.27, color: G([228, 212, 172]), opacity: 0.9, profile: 'saturn' }),
    ground: { stone: '#9a7c4c', floor: '#b89660', grass: '#d8c294', foliage: '#c8b080', sand: '#e4d0a4', water: '#a88a5a' },
    colours: G({ zenith: [52, 74, 118], horizon: [232, 216, 176], cloudLit: [244, 234, 206], cloudShade: [190, 160, 108] }) }),
  uranus: G({ read: 'over Uranus: a pale cyan deck, featureless to a cool hazy horizon',
    base: 'overcast', layers: [{ type: 'deck', form: 'stratus', base: 900, depth: 700, cover: 1 }],
    light: { ambient: 0.6, gain: 0.4 }, haze: 1, wind: 10,
    rings: G({ tilt: 22, inner: 1.64, outer: 2.0, color: G([104, 108, 112]), opacity: 0.75, profile: 'thin' }),
    ground: { stone: '#5a9aa4', floor: '#78b2ba', grass: '#8cc6cc', foliage: '#86c0c6', sand: '#b4e2e4', water: '#5a9aa4' },
    colours: G({ zenith: [36, 96, 122], horizon: [166, 216, 220], cloudLit: [222, 242, 242], cloudShade: [118, 176, 184] }) }),
  neptune: G({ read: 'over Neptune: a deep blue deck streaked with white cirrus, the wind the fastest there is',
    base: 'overcast', layers: [{ type: 'deck', form: 'stratus', base: 900, depth: 700, cover: 1 }, { type: 'cirrus', base: 5000, cover: 0.55 }],
    light: { ambient: 0.5, gain: 0.44 }, haze: 0.6, wind: 26,
    ground: { stone: '#1a3070', floor: '#22408c', grass: '#2c50a0', foliage: '#2a4ea8', sand: '#4a76cc', water: '#1a3070' },
    colours: G({ zenith: [12, 34, 94], horizon: [78, 122, 206], cloudLit: [104, 146, 226], cloudShade: [30, 56, 132] }) }),
});
export const GIANT_IDS = Object.freeze(Object.keys(GIANT_SKIES));

/** The geocube a giant's map is painted with under its deck (skyscape/airspace.js, when the level names none). */
export const giantGround = (id) => ({ from: 'island-noon', colour: { ...GIANT_SKIES[id].ground } });
