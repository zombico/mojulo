/**
 * The NATURE-TRAIL style card: a cohesive sixth-gen art style for a trail through a valley under a cliff, written as
 * principles and as the numbers the builder (era/nature.js) reads, so the style is enforced, not described. Draft
 * agreed with the operator 10-04; machine checks for the principles live in nature.test.js.
 */
import { accentOf, hexOfRgb } from './swatches.js';

export const NATURE_TRAIL = Object.freeze({
  id: 'nature-trail',
  principles: Object.freeze([
    'Big shapes first, detail in the tile: a cliff wall, the trail ribbon, tree clumps, one far ridge.',
    'Faceted, never smooth: ground and cliff are planar facets; each facet is lit flat, and that is the shading.',
    'Slope decides material: flat is grass, steep is rock, and a talus band of scree and stones sits at every cliff foot.',
    'The trail is the subject line: the brightest, warmest value, and it leads the eye.',
    'Value hierarchy: trail > sunlit rock > grass > foliage masses.',
    'Trees come in one family and in clusters of 3–7 with gaps; never an even scatter.',
    'Limited palette: warm rock ochre, moss and olive greens, cool shadow blue, and one small accent (red trail blazes).',
    'One sun, one sky: a warm key, a cool fill, cast shadows baked per vertex; trees throw shade across the trail.',
    'Depth by atmosphere: near is saturated, far fades to the fog colour; the far ridges are flat silhouettes.',
    'The sky has weather: one cloud deck, lit by the same sun, high above the cliff and fading toward the horizon.',
    'Nature by cause: moss on shaded rock, wet stains at the cliff foot, scree under steep faces, a packed trail centre.',
    'Distinct inside the radius, repetition outside it.',
    'One ground, two tiles: the trail is the meadow\'s own soil worn bare. The grass fades back over it by cause (worn by feet, thinned under the spruce, bare in patches), never at a seam.',
    'Foliage is painted cards: spruce boughs and grass tufts are cutouts on the grown wood; the sun falls through their gaps and the bake shades every card where it stands.',
    'The ground is never flat: low mounds and hollows at three scales, and a worn bank either side of the trail.',
  ]),
  // the palette, as tints over the tiles (1 = the tile's own colour) and as self-lit fills
  tiles: {
    trail: { key: 'soil-dirt', scale: 1.6, tint: [1.46, 1.3, 1.06] },
    fringe: { key: 'grass-dry', scale: 1.8, tint: [0.92, 0.94, 0.72] },
    grass: { key: 'grass-meadow', scale: 1.4, tint: [0.78, 0.86, 0.6] },
    talus: { key: 'soil-scree', scale: 1.6, tint: [0.95, 0.88, 0.78] },
    rock: { key: 'rock-cave', scale: 4, tint: [0.77, 0.69, 0.58] },
    rockTop: { key: 'grass-dry', scale: 2.2, tint: [0.8, 0.84, 0.6] },
  },
  accent: hexOfRgb(accentOf('nature-trail')),   // the blaze: style/swatches.js
  values: ['trail', 'rock', 'grass', 'foliage'],   // brightest first (principle 5)
  slope: { rock: 0.6 },                           // a ground facet whose normal z falls below this is rock (principle 3)
  site: { w: 44, d: 72, cell: 1 },
  // COMPOSITION: where the eye lands. Inside a focus radius every rock is chipped (detail 1) and its own variant, the
  // grass is denser and fuller; outside, cheap repetition. The boulder gate frames the trail at the bend.
  focus: [{ name: 'trailhead', y: 7, r: 11 }, { name: 'boulder-gate', y: 31, r: 10, gate: true }],
  trail: { width: 2.4, fringe: 0.9, sway: [6, 0.07, 3, 0.17], x: 0.48, widthVary: 0.22, fringeVary: 0.55, dice: 3 },
  // LUMPS (principle 15): octaves [amplitude m, frequency /m] over the valley, and a bank `h` high either side of the
  // trail, `w` wide
  lumps: { octaves: [[0.32, 0.1], [0.12, 0.3], [0.045, 0.9]], banks: { h: 0.3, w: 2.4 } },
  // ONE SOIL (principle 13): the trail's soil under the ribbon and the meadow within `ring` m; its value runs from the
  // packed centre (bright) to `floor` under the grass. The grass tile fades back over it: worn off from `wear`
  // (× half width, + m past the fringe), never thinner than `floor` cover in a bare patch, `duff` less within `duffR`
  // m of a spruce, whole at the ring
  soil: { floor: [0.8, 0.76, 0.64], edge: [0.5, 1.0], wander: 0.6, patch: 0.22 },
  grassBlend: { ring: 9, wear: [0.55, 0.45], wander: 0.6, bare: [0.16, 0.42], floor: 0.5, duff: 0.45, duffR: 3.2 },
  cliff: { x: 2.5, talus: 3.5 },
  // the geology (polygonizer/landform.js) the cliff is made of: a scarp `throw` metres high through a `face`° face,
  // strata `bed` metres thick, joints every `joint` metres, talus shedding `retreat` of the face into an apron with
  // scree; the geology is kept within `keep` metres of the cliff line and blends back to the valley beyond
  landform: { cell: 0.5, back: 14, throw: 17, face: 78, bed: 2.4, joint: 2.6, retreat: 0.35, scree: 0.35, keep: [9, 14], apronMin: 0.06 },
  rubble: { rock: 'granite', tone: '#c2ae92', unit: 1.5, maxScree: 260, boulders: 6, variants: 8,   // unit: a pooled rock is ~0.66 m at size 1
    gate: { sizes: [2.4, 1.9], off: 1.2 }, pebbles: { perMetre: 2.4, size: [0.07, 0.2] } },
  grass: {
    variants: 4, height: [0.45, 0.85], fringeEvery: 0.5, clusters: 52, perCluster: [6, 14], insideBoost: 2.2, spacing: 0.3,
    kinds: { fringe: 'tussock', meadow: 'meadow', cliff: 'sedge', scatter: 'meadow' }, scatter: 0.14,
    tint: { fringe: [0.98, 0.94, 0.68], meadow: [0.8, 0.92, 0.6], cliff: [0.66, 0.8, 0.58], scatter: [0.78, 0.9, 0.58] }, shade: 0.58,
    // tufts as painted cards (principle 14): `height` × the tuft's, `width` × that, dark at the `foot`
    cards: { keys: { fringe: 'card:meadow', meadow: 'card:meadow', scatter: 'card:meadow', cliff: 'card:grass' }, height: 0.95, width: 1.2, foot: 0.5 },
  },
  contact: { rock: 0.5, tree: 0.42 },   // soft shadow blobs under what stands on the ground
  // debris, each with a cause (era/nature.js debrisFaces)
  debris: {
    wood: [0.56, 0.45, 0.34], cone: [0.46, 0.3, 0.18], rootReach: 5.5, root: [0.04, 0.15], rootDive: 1.8, litter: 10,
    log: { after: 4.5, len: 4.6, r: 0.27, yaw: 28, tile: 1.2, bark: 'bark-spruce', endTint: [0.82, 0.66, 0.46] },
    slabs: { every: 3.2, chance: 0.45, size: [0.3, 0.55], key: 'rock-cave', tint: [0.8, 0.74, 0.64] },
    puddles: [{ focus: 'trailhead', dy: 4.5, dx: 0.2, r: 0.75 }], water: '#7f95ab',
  },
  trees: { species: 'spruce', variants: 3, level: 'L1', clusters: 7, perCluster: [3, 7], spread: 4.2, heights: [8, 15], clearTrail: 3.2, clearCliff: 4.5, foliage: [0.42, 0.56, 0.36],
    // the grown spruce in bough CARDS (principle 14): limbs binned per height `band` (m) and azimuth `sectors`, finer
    // within `near` m of the trail; each cell's cards `reach` × its longest limb, `width` [flat, standing] × that; the
    // trunk barked near; the crown dark toward the trunk (`inner`)
    bark: 'spruce', barkTint: [0.9, 0.84, 0.76],
    cards: { stand: 0.2, near: 12, fine: { band: 0.55, sectors: 8, reach: 1.25 }, coarse: { band: 0.8, sectors: 6, reach: 1.4 }, width: [1.15, 0.9], tilt: [0.2, 0.6], leader: 0.14, limbD: 0.05, seg: 0.9, tint: [0.92, 1, 0.96], inner: 0.5 } },
  blazes: { every: 18, colour: '#b8322a', post: [0.5, 0.36, 0.24] },
  light: { key: { color: '#ffe4bc', elevation: 36, azimuth: 62 }, ambient: '#8ea6cc', fill: 0.52, bounce: [0.62, 0.66, 0.44], bounceGain: 0.14, sunGain: 1.12, leafLift: 0.05 },
  air: { fog: { color: '#bcc8d0', density: 0.011 }, dome: { zenith: [74, 122, 190], horizon: [198, 212, 220] } },
  // the cloud deck (effects/effects-clouds.js, `undershot`: one plane hit per pixel, no march — the era's scrolling
  // cloud layer, lit): a band well above the cliff top, sparse cumulus, warm-white in the key light, slow drift
  clouds: { mode: 'undershot', base: 72, thickness: 28, coverage: 0.27, scale: 0.0095, density: 0.4, drift: 0.7, fade: 700, color: [1.12, 1.1, 1.06], depthClip: true },
  ridges: [{ at: 26, height: [18, 34], fog: 0.55, base: [72, 84, 92] }, { at: 70, height: [30, 52], fog: 0.8, base: [96, 110, 124] }],
});
