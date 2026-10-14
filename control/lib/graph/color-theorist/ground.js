/**
 * THE GROUND — what a palette says the land is made of, in the shapes the terrain kernels read. The kernels light and
 * mix (slope, apron, strata, the snowline, the water, all theirs: terrain/terrain-kernel.js, terrain/terrain-atlas.js);
 * the palette says what each of those grounds is coloured. A kernel ships to the page as its own source and closes
 * over nothing, so the palette reaches it as data: four-stop ramps, darkest first, `{ stops, pos, gamma }`.
 *
 *   terrainRamps(contract, beds)  → a painted terrain's { soil, stone, scree, beds: [×beds] }
 *   atlasGround(contract, sky)    → a composed world's ramps { forest, low, high, rock, snow, sand, silt, water, deep }
 *                                   and its sky { zenith, horizon, …the climate's own }
 *
 * The climate keeps the geography (its snowline, its treeline, where the sand lies); the palette colours it. Pure.
 */
import { rampOf, rampNear } from './solve.js';
import { oklch, lchOf, hexToRgb, mixHue } from './oklab.js';

const POS = [0, 1 / 3, 2 / 3, 1];
const four = (stops) => ({ stops: stops.map((c) => [c[0], c[1], c[2]]), pos: POS.slice(), gamma: 1 });

/** A painted terrain's grounds: the soil the world's ground, the stone its rock, the scree the rock paler and quieter,
 * each stratum the rock turned a little and stepped in value, alternately, so beds read as beds. */
export function terrainRamps(K, beds = 0) {
  return {
    soil: four(rampOf(K, 'ground', 4)),
    stone: four(rampOf(K, 'rock', 4)),
    scree: four(rampNear(K, 'rock', 4, 0, { dL: 0.06, kC: 0.8 })),
    beds: Array.from({ length: beds }, (_, i) => four(rampNear(K, 'rock', 4, i % 2 ? 12 : -12, { dL: ((i % 3) - 1) * 0.05, kC: i % 2 ? 1.1 : 0.85 }))),
  };
}

/** A composed world's grounds: the forest the foliage, darker; the lowland the ground; the highland the ground turned
 * and quieter; the rock; snow near-white, cool in its shade and warm in its light; sand and silt the soil's; the water
 * and the deep the sky's, sunk. Its sky: the climate's, its colours the palette's. */
export function atlasGround(K, sky = {}) {
  const [, , hL] = lchOf(hexToRgb(K.light)), [, , hS] = lchOf(hexToRgb(K.shadow));
  const snow = [0.72, 0.84, 0.93, 0.98].map((L, i) => oklch(L, 0.022, mixHue(hS, hL, i / 3)));
  return {
    ramps: {
      forest: four(rampNear(K, 'foliage', 4, 0, { dL: -0.1 })),
      low: four(rampOf(K, 'ground', 4)),
      high: four(rampNear(K, 'ground', 4, 15, { dL: 0.05, kC: 0.6 })),
      rock: four(rampOf(K, 'rock', 4)),
      snow: four(snow),
      sand: four(rampNear(K, 'soil', 4, 0, { dL: 0.12, kC: 0.7 })),
      silt: four(rampOf(K, 'soil', 4)),
      water: four(rampNear(K, 'sky', 4, 0, { dL: -0.3, kC: 1.2 })),
      deep: four(rampNear(K, 'sky', 4, 0, { dL: -0.45, kC: 1.1 })),
    },
    sky: { ...sky, zenith: hexToRgb(K.roles.sky[1]), horizon: hexToRgb(K.roles.sky[4]) },
  };
}
