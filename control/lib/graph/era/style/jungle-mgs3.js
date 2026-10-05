/**
 * The JUNGLE-MGS3 style card: the late sixth-gen jungle (Snake Eater's Tselinoyarsk), written as principles and as the
 * numbers the builder (era/jungle.js) reads. The ground, trail, ravine wall, rocks and debris reuse the nature builder
 * (era/nature.js) and so carry its fields; what is the jungle's own is the foliage as painted cutout cards
 * (era/leaf-cards.js), the reveal rings, the canopy and the light that comes through it, and the grade.
 *
 * PROGRESSIVE REVEAL, the way a mojulo world reveals plants round the camera: the character walks the trail, so the
 * rings are bands out from the trail's line. NEAR is where the eye lands (every plant its own card, litter, vines);
 * MID is fewer, larger cards over the grown trunks; FAR is no plants at all, only layered walls of crown cards fading
 * into the fog: the illusion that the jungle goes on.
 */
export const JUNGLE_MGS3 = Object.freeze({
  id: 'jungle-mgs3',
  principles: Object.freeze([
    'The jungle is a wall and the trail is the cut: foliage fills every sightline but one, the way forward.',
    'Layers at every depth: litter, ferns and broadleaf, tree ferns, trunks and vines, the canopy; each sightline crosses three.',
    'Leaves are cards, wood is geometry: foliage is painted cutout cards, never solid blobs; trunks, buttresses, roots, rocks are mesh.',
    'Progressive reveal: detail by ring out from the trail; near is distinct, mid repeats, far is layered silhouettes in the fog.',
    'Light comes through: the sun reaches the floor only through the canopy\'s holes, in dapples; the rest is green shade.',
    'Value hierarchy: sunlit dapples > the trail\'s mud > trunks > foliage > the shade under it.',
    'Wet and rotten: mud, moss on every shaded stone, standing water, roots across the trail, a fallen giant, leaf litter.',
    'Filmic palette: olive, moss, mud and sepia, a grade over everything, and one rust accent.',
    'The air is thick: humid fog closes the far field; the sky shows only through the canopy.',
    'Giants anchor the composition: a few buttressed figs frame the trail; everything else grows round them.',
    // read off Snake Eater's own frames (PS2, 10-04)
    'The ground is two materials blended, never a tile: moss and soil melt into each other in soft patches metres across; the trail is where the moss is worn off.',
    'The floor undulates: mounds, hollows, and banks either side of the trail, which sits sunk between them.',
    'A massive trunk is a column, not a model: few faces, a strong bark tile at its own scale, moss climbing its foot and its shaded side.',
    'Grass is cards of broad, sharp blades, dark at the crown and lit at the tips, in the light gaps.',
    'Detail lives in the texture, softly: muted olive and brown, light pooling on the floor in patches.',
  ]),
  // the nature builder's fields (era/nature.js): ground, trail, ravine wall, rocks, debris
  tiles: {
    // ONE soil under the trail, its fringe and the floor: the trail is a value and a wear, not a seam between tiles
    trail: { key: 'soil-mud', scale: 1.4, tint: [1.8, 1.58, 1.22] },
    fringe: { key: 'soil-mud', scale: 1.4, tint: [1.8, 1.58, 1.22] },
    grass: { key: 'soil-mud', scale: 1.4, tint: [1.8, 1.58, 1.22] },
    talus: { key: 'soil-scree', scale: 1.6, tint: [0.62, 0.62, 0.5] },
    rock: { key: 'rock-mossy', scale: 3.5, tint: [0.78, 0.8, 0.66] },
    rockTop: { key: 'grass-meadow', scale: 2.2, tint: [0.5, 0.6, 0.36] },
  },
  slope: { rock: 0.6 },
  // the floor undulates (Snake Eater's banks and mounds): octaves of [amplitude m, frequency /m] over the valley, and
  // banks `h` metres high and `w` wide either side of the trail, which sits sunk between them
  lumps: { octaves: [[0.42, 0.11], [0.2, 0.32], [0.07, 0.9]], banks: { h: 0.55, w: 3.2 } },
  site: { w: 40, d: 64, cell: 1 },
  focus: [{ name: 'trailhead', y: 7, r: 10 }, { name: 'fig-gate', y: 30, r: 10, gate: true }],
  trail: { width: 1.9, fringe: 0.8, sway: [5, 0.08, 2.4, 0.19], x: 0.5, widthVary: 0.28, fringeVary: 0.6, dice: 3 },
  cliff: { x: 3, talus: 2.5 },
  landform: { cell: 0.5, back: 12, throw: 9, face: 72, bed: 1.8, joint: 2.2, retreat: 0.3, scree: 0.25, keep: [7, 11], apronMin: 0.06 },
  rubble: { rock: 'granite', tone: '#9a9a80', unit: 1.4, maxScree: 160, boulders: 5, variants: 8, gate: { sizes: [1.6, 1.3], off: 2.6 }, pebbles: { perMetre: 1.2, size: [0.07, 0.18] } },
  contact: { rock: 0.55, tree: 0.6, plant: 0.32 },
  debris: {
    wood: [0.44, 0.36, 0.26], cone: [0.36, 0.26, 0.16], rootReach: 7, root: [0.05, 0.2], litter: 6,
    log: { after: 5, len: 7.5, r: 0.55, yaw: 34, tile: 1.4, bark: 'bark-spruce', endTint: [0.6, 0.48, 0.34] },
    slabs: { every: 4.5, chance: 0.3, size: [0.35, 0.6], key: 'slate', tint: [0.62, 0.62, 0.52] },
    puddles: [{ focus: 'trailhead', dy: 3.5, dx: 0.1, r: 0.8 }, { focus: 'fig-gate', dy: -3, dx: -0.2, r: 0.65 }], water: '#5f6e5a',
  },
  // ── the jungle's own ──
  // the trail blended into the floor (era/jungle.js jungleMarks): packed and light at its centre, wandering out to the
  // floor's darker, patchier value between `edge` × its half-width and its fringe + `edge[1]` metres; `wander` metres of
  // noise on that edge, so it is never a ruled line
  blend: { floor: [0.4, 0.42, 0.33], edge: [0.5, 1.1], wander: 0.8, patch: 0.32 },
  // the reveal rings, in metres out from the trail's centreline
  rings: { near: 7, mid: 16 },
  // the giants: grown figs (vegetation/ficus.js) whose crowns are replaced by spray cards; they stand in pairs that
  // frame the trail, buttresses on the ground, roots running out across it
  giants: { species: 'rubberfig', alt: 'strangler', variants: 3, count: 9, heights: [24, 34], clearTrail: [3.2, 9], spacing: 9, barks: [{ key: 'oak', tint: [0.98, 0.94, 0.78] }, { key: 'chestnut', tint: [0.96, 0.9, 0.74] }, { key: 'beech', tint: [0.66, 0.7, 0.56] }], crownCell: 3.4, crownCard: [3.2, 5.2] },
  // the giants' wood by cause: moss up the base, on the limbs' tops and the shaded side; pale lichen blotches; dark
  // wet streaks running down the trunk; epiphytes (small fern and broadleaf cards) sitting on the big limbs
  woodMarks: { moss: [0.66, 0.92, 0.56], base: 5, lichen: [1.14, 1.12, 1.04], streak: 0.34 },
  epiphytes: { perGiant: 9, apart: 1.6, above: 3.5, size: [0.7, 1.3] },
  // the leaves' own shade: an understory plant darkens toward its foot, a crown clump toward its underside
  leafShade: { foot: 0.4, under: 0.68, vine: 0.82 },
  // TWIST by cause: a jungle tree grows toward the gaps, so its limbs wander and bend to the light (the grower's own
  // knobs: `wander` the kink per node, `wTrop` the pull back to its set angle, `wLight` the reach toward light)
  grow: { wander: 0.28, wTrop: 0.2, wLight: 0.55 },
  // the BANYAN, the set piece: one at the gate, its trunk off the trail, its limbs over it, its pillar roots landing on
  // either side (none on the trail: the way runs between them) and its hanging roots as curtains of root cards
  banyan: { focus: 'fig-gate', side: 1, dy: 2.5, off: 1, height: [19, 23], curtain: { cell: 1.8, width: [0.8, 1.5] } },
  // lianas that wind up the trunks: a helix from the foot to under the crown, `turns` round
  spirals: { count: 5, turns: 2.4, reach: 0.5, r: 0.06, tint: [0.38, 0.34, 0.22] },
  // BAMBOO on the wet ground at the ravine's foot (the seep): mojulo's clumping bamboo, its foliage as bamboo cards
  bamboo: { species: 'vulgaris', clumps: 2, culms: 13, radius: 1.2, height: [9, 13], off: 4.5, leaf: [1.6, 2.4], cards: 4, tint: [0.84, 0.86, 0.6] },
  // TALL GRASS where the sun reaches the floor (the gaps feed it), in patches, clear of the trail: crossed grass cards
  // (Snake Eater's grass is cards), shaded by the bake like every leaf, walked through
  tallGrass: { cell: 0.9, patch: 0.5, max: 260, height: [0.9, 1.7], clear: 0.5, tint: [0.86, 0.92, 0.72] },
  // the MOSS blend (Snake Eater's floor): a moss tile faded in over the soil per vertex — worn off the trail, thick
  // in patches and in shade, out to `ring` metres from the trail; on the massive trunks it climbs the base and the
  // shaded side. Alpha is the blend weight.
  moss: { key: 'floor:moss', scale: 1.3, tint: [1.3, 1.36, 1.06], ring: 10, max: 0.95, patch: [0.22, 0.5], wear: [0.3, 0.4], trunk: 0.95 },
  // the occasional MASSIVE TRUNK: a bole `R` metres in radius rising through the canopy — few faces, the bark tile at
  // a larger crack scale, lumpy, flared, buttressed away from the trail. At stations `y`, on `side`, `gap` past the
  // reach of its buttresses.
  colossi: { list: [{ y: 13, side: 1, R: 1.35, gap: 0.5 }, { y: 46, side: 1, R: 1.7, gap: 3 }], top: 34, sides: 14, bark: 'oak', barkScale: 2.4, tint: [0.86, 0.82, 0.66], buttress: { n: 5, h: 1.9 } },
  // tree ferns: a trunk and a crown of fern cards bowed outward (the era's palm)
  treeferns: { count: 22, height: [2.6, 5], frond: [2.4, 3.4], fronds: 6, trunk: [0.3, 0.25, 0.18] },
  // understory cards per square metre by ring, sizes in metres, the share that are ferns
  understory: { near: 0.62, mid: 0.2, size: [0.9, 2.2], ferns: 0.45, clearTrail: 0.35, tint: [0.84, 0.9, 0.74] },
  litter: { near: 0.5, edge: 2, onTrail: 0.3, size: [0.9, 1.6], tint: [0.9, 0.86, 0.74], twigs: 1.1, twig: [0.3, 0.24, 0.17] },
  vines: { count: 26, width: 0.55, tile: 0.9, lianas: 5, liana: 0.06, tint: [0.88, 0.94, 0.8] },
  // the canopy roof: crown cards on a jittered grid between `z` heights, `cover` of the cells filled (the rest are the
  // holes the sun and sky come through)
  canopy: { cell: 3.4, z: [17, 25], cover: 0.46, card: [4.5, 7.5], tint: [0.8, 0.9, 0.7] },
  // the cut overhead: within `width` metres of the trail's edge, this share of crown and canopy clumps is left out
  corridor: { width: 3, open: 0.75 },
  // light shafts: beams from the canopy's holes to sunlit spots near the trail, `apart` metres apart at least
  shafts: { count: 9, apart: 6, width: [0.8, 1.7], reach: 19, alpha: [0.05, 0.26], color: '#fff0c0' },
  // the far walls: rows of crown cards beyond the mid ring, each row deeper and further into the fog
  walls: { rows: 4, gap: 5, height: [8, 22], card: [6, 10], fog: [0.2, 0.75] },
  leafTint: [0.8, 0.88, 0.68],
  light: { key: { color: '#fff0c8', elevation: 58, azimuth: 70 }, ambient: '#728c60', fill: 0.44, bounce: [0.46, 0.56, 0.3], bounceGain: 0.1, sunGain: 1.75, leafLift: 0.06 },
  air: { fog: { color: '#8a9476', density: 0.024 }, dome: { zenith: [150, 168, 150], horizon: [196, 202, 176] } },
  clouds: { mode: 'undershot', base: 80, thickness: 30, coverage: 0.5, scale: 0.008, density: 0.5, drift: 0.5, fade: 500, color: [1.04, 1.04, 0.98], depthClip: true },
  // the grade: a filmic pull over every baked colour (lift the blacks, desaturate toward the luma, tint toward olive-sepia)
  grade: { lift: [0.035, 0.04, 0.02], sat: 0.78, tint: [1.02, 1.0, 0.86], gain: 1.04 },
  accent: '#8a3a22',
  values: ['dapple', 'trail', 'trunk', 'foliage', 'shade'],
});
