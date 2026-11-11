/**
 * The CRYPT style card: what the `gothic-stone` kit dresses its rooms with (era/crypt.js) — a burial vault under a
 * castle, written as principles and as the numbers the dressing reads, so the style is enforced, not described.
 * Draft numbers, tuned at the eyes gate.
 */
export const CRYPT = Object.freeze({
  id: 'crypt',
  principles: Object.freeze([
    'Light leads to the dead: the candles round the tomb and the torchlit stone are the brightest things, the open floor darker, the vault darkest of all.',
    'One set piece at the end of the way: a tomb chest on a stepped dais in the last room, its own candles burning at its corners.',
    'The vault is its own material: rough limewash between the ribs, never the walls\' coursed stone carried overhead.',
    'Stone is two tiles where water and feet have been: damp moss at the wall bases and in the gutter, grime pooled at the floor\'s edges and worn off the walking line, faded in per vertex, never a seam.',
    'Nothing disturbs the corners: cobwebs strung in the angle of a pilaster and the wall, above the plinth and under the cornice.',
    'Distinct inside the radius: no two neighbouring pilasters dress alike.',
    'Adjacent bare walls share a repeating element: a burial niche framed in stone centred in every bare bay, the same on every wall, an urn in one now and then.',
    'One accent wall: the wall behind the tomb breaks the repeat, its courses cut in larger, darker ashlar and bare of niches, so the eye lands on it.',
    'Things gather where floor meets wall: crates, barrels, planks leaning on the wall, stones, a boulder, debris; clusters in the corners and singles at the wall bases, off the way, never two of a kind side by side.',
    'Round, never boxed: doorways under semicircular heads, every room a barrel vault on ribs, the niches arched, the barrels turned and the tomb\'s lid coped; curves break the grid.',
    'Don\'t be afraid to make it tall: the great rooms rise well over the walker, their vaults lost in the dark above the torches.',
    'Motifs are small: a pattern carved in a band along the plinth or the cornice (a key, a rope, teeth), never an object.',
    'Doodads are the large things (the set piece, a coffin, a barrel, a boulder): never two together unless a corner gathers them on purpose.',
  ]),
  values: Object.freeze(['candle', 'torchlit', 'floor', 'vault']),
  // the torches' live flicker, against a real torch's: slower reads as still air underground, not a gale
  flicker: 0.45,
  // the blends (era/blends.js): moss up the wall bases and in the gutter; grime near the walls, off the walking line
  moss: { key: 'floor:moss', scale: 1.3, tint: [0.5, 0.6, 0.54], rise: [0.15, 1.4], max: 0.8, patch: [0.32, 0.64], wander: 0.45 },
  grime: { key: 'floor:grime', scale: 1.7, tint: [0.9, 0.86, 0.82], edge: [0.3, 2.2], max: 0.9, walk: 1.4, patch: [0.25, 0.6] },
  cobwebs: { share: 0.55, size: [0.4, 0.8], tint: [0.88, 0.88, 0.92] },
  // the tomb chest: a dais of `steps`, the chest, its lid overhanging; pale stone against the darker walls
  tomb: { dais: { w: 3.6, d: 2.4, step: 0.22, steps: 2, inset: 0.35 }, chest: { w: 2.2, d: 1.0, h: 0.85 }, lid: { over: 0.1, h: 0.12, round: 0.18 },
    stone: { key: 'marble-carrara', scale: 1.2, tint: [0.84, 0.82, 0.78] } },
  // the repeating element: a niche `w` wide and `h` high above the plinth, `sill` over it, framed `frame` thick
  // standing `out` proud; a second tier where the wall is tall; a share of them hold an urn
  niches: { head: 'round', tiers: 2, w: 1.3, h: 0.5, sill: 0.55, gap: 0.5, frame: 0.12, out: 0.08, dark: [0.16, 0.15, 0.15], urns: 0.3, urn: [0.6, 0.48, 0.38] },
  // the accent wall's stone: half the courses of the walls round it, warmer and darker, worn
  accent: { stone: { stone: [112, 96, 86], mortar: [58, 50, 44], rows: 3, cols: 2, radius: 0.22, shadow: 0.6, bevel: 0.3, vary: 26, accent: 0.1, jointDepth: 0.75, grime: 0.45, chips: 0.35 }, tint: [0.86, 0.84, 0.82] },
  // the corner things (era/props.js): which kinds, and the share of bare wall bases that get one
  props: { kinds: ['crate', 'barrel', 'planks', 'stones', 'boulder', 'debris'], share: 0.45, rock: 'basalt', tone: '#66625c' },
  // candles in a cluster at each dais corner: wax, a flame card, a small warm light baked like a torch
  candles: { per: 3, r: 0.035, h: [0.18, 0.34], wax: '#e8dcc0', color: '#ffc874', intensity: 1.15, radius: 4.2 },
});

/**
 * The crypt, SOBER: the same vault and the same principles in a graver register, for the `gothic-ashlar` kit. What the
 * first card says loudly this says quietly, so the room reads by its scale and its light and not by its outlines:
 * the niches' frames thin and close to the wall, their dark deeper; the tomb a grey stone that takes the candles'
 * light and never burns white; fewer, lower candles; the accent wall's blocks large but calm; the corner things
 * the ones a vault holds (stones, a boulder, fallen planks, debris), never a crate or a barrel; the moss and the
 * grime darker and thinner, a stain and not a stripe.
 */
export const CRYPT_SOBER = Object.freeze({
  ...CRYPT,
  // THE FORM REGISTER'S PRINCIPLES (era/laws.js 'crypt/form': the seventh generation's laws; era/form-laws.js measures
  // a kit against them). The crypt's own principles above hold as they are: these say how they are drawn now.
  form: Object.freeze({ principles: Object.freeze([
    'Stone is the size it is built at: courses a third of a metre high, slabs a stride long; nothing is enlarged to be read small.',
    'A joint is a shadow, not a line: every joint, chip and tool mark is relief the lamps find.',
    'Blocks agree and the light disagrees: a wall\'s stones are close in tone, and the room\'s contrast is torchlit stone against the dark.',
    'A curve is a curve: a doorway\'s head, a niche\'s and the vault are cut fine enough to read round at arm\'s length.',
    'The dark is part of the room: the torches stand high and reach far, and above them the vault is lost.',
    'What burns moves: a torch\'s flame is live.',
    'What stands proud of a wall stands a hand\'s breadth, in stone near the wall\'s own: a frame, a plinth, a cornice are quiet.',
    'The motif is cut, not painted: a small band of dentils under the cornice, in the wall\'s own tone, found by the light.',
    'Nothing is a box on its first pass: the torch is a cone of iron in a ring on an arm, turned, not stacked.',
    'A pilaster is worked like a column: a fluted shaft on a base, a ring and a capital over it, never a flat strip.',
    'A wall has layers: a coat of lime render over the ashlar, fallen away in patches, standing proud so its broken edge casts a shadow on the stone.',
    'A wall keeps a rhythm: along it never three bays alike and never a pair followed by the same pair (ABBA, never AAAA or ABAB); a wall all alike is a choice a recipe states, and then its bay is clean and repeatable.',
    'The second kind of bay is the first with less on it: one niche where its neighbour has two, and nothing in it; derived, never a new design.',
    'The floor is laid, not tiled: a darker course along the walls where nobody walks, a worn walk of larger slabs down the room to the tomb, and fields either side laid bay by bay, keeping the walls\' rhythm with the same slabs turned a quarter.',
  ]) }),
  // (its bays keep a rhythm, era/wall-rhythm.js: the second kind of bay is the first with a tier of niches less)
  niches: Object.freeze({ ...CRYPT.niches, rhythm: Object.freeze({ less: 1 }), seg: 14, frame: 0.07, out: 0.04, dark: [0.07, 0.07, 0.075], urns: 0.2, urn: [0.42, 0.36, 0.3] }),
  tomb: Object.freeze({ ...CRYPT.tomb, stone: { key: 'marble-carrara', scale: 1.2, tint: [0.56, 0.55, 0.54] } }),
  accent: Object.freeze({ stone: { gen: 'dressed', stone: [100, 96, 92], mortar: [62, 60, 58], rows: 4, cols: 1, joint: 0.014, recess: 0.008, tool: 'pitched', chamfer: 0.006, pillow: 0.005, spall: 0.35, pit: 0.3, vary: 9, grit: 0.55, scale: 2.4 }, tint: [0.74, 0.73, 0.73] }),
  props: Object.freeze({ ...CRYPT.props, kinds: ['stones', 'boulder', 'planks', 'debris'], share: 0.3 }),
  candles: Object.freeze({ ...CRYPT.candles, per: 2, h: [0.14, 0.26], color: '#ffb866', intensity: 0.9, radius: 3.6 }),
  cobwebs: Object.freeze({ ...CRYPT.cobwebs, tint: [0.6, 0.6, 0.63] }),
  moss: Object.freeze({ ...CRYPT.moss, tint: [0.3, 0.36, 0.32], max: 0.45 }),
  grime: Object.freeze({ ...CRYPT.grime, tint: [0.6, 0.58, 0.56], max: 0.7 }),
});
