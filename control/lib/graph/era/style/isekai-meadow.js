/**
 * The ISEKAI-MEADOW style card: the open-field anime look of the current era (Genshin Impact, Breath of the Wild:
 * era/current-gen.js), built from sixth-gen parts. Principles, and the numbers the builder (era/isekai.js) reads; the
 * machine checks live in isekai.test.js. Draft agreed with the operator 10-04.
 *
 * The site, the trail, the cliff's geology and the grass placement are the nature trail's (nature.js reads the same
 * fields); what differs is how everything is DRAWN: a locked palette, pixel-locked rocks and cliffs, hats.
 */
import { SWATCHES } from './swatches.js';

export const ISEKAI_MEADOW = Object.freeze({
  id: 'isekai-meadow',
  references: ['genshin', 'botw'],
  principles: Object.freeze([
    'A locked palette: every colour on the ground, the trees and the far layers sits on one of the card\'s ramps; light moves a colour along its ramp, never off it.',
    'Rocks and cliffs are pixel-locked: drawn only in their ramp\'s stops, unlit, the light in the choice of tile — a lit tile or a shade tile per facet, by the sun and its cast shadow.',
    'Shadows are a colour: the darkest stop of every ramp is a cool teal or blue, never black.',
    'Things that stand in the grass wear a hat: a boulder\'s top is a grass cap with a ragged fringe hanging round its rim; every cliff lip hangs the same fringe over its face.',
    'Big flat shapes: a boulder is a few broad facets lofted to a flat top; a cliff is its geology\'s benches and faces, banded by strata, not noise.',
    'The sky is the brightest thing, then the far layers, then the sunlit grass, then the shade.',
    'Depth by painted layers: each far ridge owns its colour from the far ramp; the haze is thin.',
    'The sky is painted: heaped cumulus cards stand behind the far ranges, pixel-locked to the cloud ramp and lit in crescents; the sun sits on the dome where the bake\'s sun is.',
  ]),
  // THE PALETTE: ramps of stops, darkest to lightest (sRGB 0–255). A group is locked to its ramp; a pixel-locked tile
  // is painted from a window of its ramp's stops (`lit` and `shade` below).
  palette: SWATCHES['isekai-meadow'].land,   // the ramps live in style/swatches.js
  // which stops each pixel-locked tile is painted from (indices into its ramp): lit tiles the upper window, shade the
  // lower, overlapping by one so a band edge between them reads as one surface turning
  tiles: {
    cliff: { ramp: 'rock', lit: [2, 3, 4], shade: [0, 1, 2], scale: 9 },
    rock: { ramp: 'rock', lit: [2, 3, 4], shade: [0, 1, 2], scale: 2.4 },
    hat: { ramp: 'grass', lit: [2, 3, 4], shade: [0, 1, 2], scale: 1.6 },
    fringe: { ramp: 'grass', lit: [1, 2, 3, 4], shade: [0, 1, 2] },
    blades: { ramp: 'grass', lit: [1, 2, 3, 4], shade: [0, 1, 2] },
    rim: { ramp: 'soil', lit: [1, 2, 3], shade: [0, 1, 2], match: true },
    creep: { ramp: 'grass', lit: [1, 2, 3], shade: [0, 1, 2], match: true },
    cumulus: { ramp: 'cloud', lit: [1, 2, 3], shade: [0, 1, 2] },
  },
  // the cel band: a facet is LIT when the sun's Lambert × its cast shadow reaches this
  cel: 0.28,
  // a cliff facet's band reads the mean normal of the cliff within `celR` cells, so the bands follow the big shapes
  cliffCelR: 2,
  // the groups whose baked colours are locked, and to which ramp
  lock: { 'isekai:ground': 'grass', 'isekai:trail': 'soil', 'isekai:scree': 'rock', 'isekai:crown': 'foliage', 'isekai:wood': 'bark', 'isekai:ridge': 'far' },
  // plain tints the bake starts from (then locked): the ramp's middle, more or less
  tint: { ground: [0.58, 0.82, 0.3], trail: [0.92, 0.76, 0.54], scree: [0.62, 0.64, 0.72], crown: [0.62, 0.92, 0.36], wood: [0.5, 0.42, 0.38] },
  // ── the site (natureSite reads these, as it does the trail's) ──
  site: { w: 44, d: 72, cell: 1 },
  focus: [{ name: 'trailhead', y: 7, r: 11 }, { name: 'boulder-gate', y: 31, r: 10, gate: true }],
  // the TRAIL BLEND (nature.js trailRims): along each edge, a band `width` m out (the `rim` tile: the soil bleeding into
  // the grass) and its mirror in (the `creep` tile: the grass over the trail), one ragged boundary between them; the
  // width wanders ± `wander` of itself at `freq` a metre; strips every `step` m, a tile every `scale` m along the trail,
  // `lift` m over the ground (over the ribbon's 5 cm)
  trailBlend: { width: 0.32, wander: 0.3, freq: 0.3, step: 0.75, scale: 1.6, lift: { bleed: 0.054, over: 0.057 } },
  trail: { width: 2.2, fringe: 0.8, sway: [6, 0.07, 3, 0.17], x: 0.5, widthVary: 0.22, fringeVary: 0.55, dice: 1 },
  lumps: { octaves: [[0.5, 0.06], [0.18, 0.2], [0.05, 0.7]], banks: { h: 0.25, w: 2.4 } },
  cliff: { x: 2.5, talus: 3 },
  slope: { rock: 0.6 },
  landform: { cell: 0.5, back: 14, throw: 15, face: 80, bed: 2.6, joint: 3.2, retreat: 0.25, scree: 0.2, keep: [9, 14], apronMin: 0.08 },
  // ROCKS: the landform's scree (a few) and boulders beside the trail, drawn new; `hat` from `minHat` (× unit) up
  rubble: { unit: 1.5, maxScree: 40, boulders: 9, variants: 8, gate: { sizes: [2.6, 2.1], off: 1.2 }, pebbles: { perMetre: 0.4, size: [0.12, 0.25] } },
  boulder: { sides: [5, 8], wobble: 0.14, rings: [[0, 0.92], [0.38, 1.0], [0.8, 0.84], [1, 0.62]], height: [0.55, 0.85], sink: 0.12, lean: 0.08, minHat: 0.7 },
  hat: { fringe: 0.22, out: 0.04, scale: 1.1 },   // fringe length (× the boulder's size), offset out off the rim
  lip: { fringe: 0.7, out: 0.06, scale: 2.2 },     // a cliff lip's fringe, metres
  grass: {
    variants: 4, height: [0.5, 0.95], fringeEvery: 0.45, clusters: 60, perCluster: [8, 16], insideBoost: 2.2, spacing: 0.3, scatter: 0.18,
    kinds: { fringe: 'tussock', meadow: 'meadow', cliff: 'sedge', scatter: 'meadow' },
    tint: { fringe: [1, 1, 1], meadow: [1, 1, 1], cliff: [1, 1, 1], scatter: [1, 1, 1] }, shade: 1,
    cards: { height: 1, width: 1.1 },
    // the FIELD: a sea of blades within `reach` m of the trail's edge (wandering), a tuft every `every` m
    field: { reach: 7, every: 0.7, height: [0.55, 1.0] },
  },
  // TREES: `height` × the tree's height is the crown's heart, `radius` × it the crown's reach; a top mass and a ring of
  // `masses` round it; `trunk` × height the trunk's radius at its foot
  trees: { variants: 3, clusters: 5, perCluster: [1, 4], spread: 5, heights: [6, 10], clearTrail: 3.5, clearCliff: 5, crown: { height: 0.62, radius: 0.34, masses: [5, 7], squash: 0.82, trunk: 0.045 },
    hero: { y: 47, side: 1, off: 7, h: 14, masses: [8, 9] } },
  // LIVE GRASS (with `wind`, scene/channels/stage-grass.js): grown stylized blades round the walker to `radius` m, every
  // tuft within `near`, thinning past it; a gust above the mean steps a blade `sheen` stops up its ramp; the walker
  // parts the grass within `part.r` m. The crowns sway: a pendulum push φ·u|u| (`phi`) over `reach`, a leaf `flutter`,
  // weighted from `from` to `full` m above the ground
  live: { win: { lit: [1, 3], shade: [0, 2] }, kind: 'meadow', variants: 3, radius: 30, near: 7, tile: 8, density: 5, height: [0.45, 0.9], px: { L2: 55, L1: 16 }, drawTris: 700000, sheen: 1, part: { r: 1.1, k: 0.5 },
    crowns: { phi: 0.5, reach: 1, flutter: 0.05, from: 1.2, full: 6 } },
  contact: { rock: 0.35, tree: 0.3 },
  light: { key: { color: '#fff2d0', elevation: 42, azimuth: 60 }, ambient: '#86aede', fill: 0.62, bounce: [0.7, 0.8, 0.5], bounceGain: 0.12, sunGain: 1.15 },
  // the haze is thin (FogExp2: a layer 300 m out keeps four fifths of its own colour): the layers make the depth
  air: { fog: { color: '#b4d8f0', density: 0.0015 } },
  // the sun on the dome, where the bake's sun is
  sun: { size: 1.4, glow: 1.3 },
  // THE PAINTED SKY: cumulus as cutout cards on a ring past the far layers, facing in, pixel-locked to the cloud ramp;
  // a card toward the sun is seen from its shaded side. Two tiers: a low band of big heaps behind the mountains, a few
  // smaller ones higher up. `at` m from the site's centre; `base` m up; `width` m; height × width
  cumulus: { tiers: [{ n: 14, at: [380, 460], base: [20, 50], width: [150, 240], tall: 0.85 }, { n: 7, at: [420, 480], base: [110, 170], width: [80, 130], tall: 0.75 }], towardSun: 50 },
  // far LAYERS: rings round the site, each its own colour (a stop of the far ramp) and a peaked skyline; the nearest is
  // a SKIRT of land from the site's edge up to its skyline, banded near to far
  layers: [{ at: 45, height: [3, 11], stop: 0, peaks: 5, skirt: [{ ramp: 'grass', stop: 2 }, { ramp: 'grass', stop: 1 }, { ramp: 'far', stop: 0 }, { ramp: 'far', stop: 0 }],
    clumps: { n: 16, trees: [3, 6], spread: 2.5, band: [0.06, 0.32], size: [1.8, 3.2], stops: [1, 2] } }, { at: 120, height: [14, 40], stop: 1, peaks: 3.5 }, { at: 260, height: [24, 70], stop: 2, peaks: 2.5 }],
});
