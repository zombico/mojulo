/**
 * The CATACOMB style card: what the `catacomb` kit dresses its rooms with (era/crypt.js reads it as it reads the
 * crypt's) — burial galleries cut into soft rock under a city: low barrel-vaulted passages lined with loculi, an
 * ossuary wall of stacked bones and skulls, a sarcophagus at the end of the way. Written as principles and as the
 * numbers the dressing reads, so the style is enforced, not described. Draft numbers, tuned at the eyes gate.
 */
export const CATACOMB = Object.freeze({
  id: 'catacomb',
  principles: Object.freeze([
    'Light leads to the dead: the candles at the sarcophagus and the torchlit rock are the brightest things, the open floor darker, the sooted vault darkest of all.',
    'One set piece at the end of the way: a sarcophagus on a low dais in the last chamber, its candles burning at its corners.',
    'Carved, not built: walls, piers and vault are one soft rock cut away, the vault darker with lamp soot, the floor worn flags and earth; never coursed masonry overhead.',
    'Round, never boxed: every passage is a round-headed arch through the rock, every gallery a barrel vault on ribs; curves break the grid.',
    'Walls of the dead repeat: loculi in tiers in every bare bay, the same slot on every wall, some sealed with a slab, some open and dark.',
    'One ossuary wall: behind the sarcophagus, bones stacked end-on in courses with rows of skulls on ledges, so the eye lands on it.',
    'Dust and damp by cause: grime pooled at the walls and worn off the walking line, a little moss where water seeps.',
    'Cobwebs in the angle of a pier and the rock, never on two neighbouring piers.',
    'Things gather where floor meets wall: amphorae, heaps of bones, fallen stones, debris, a few old planks; clusters in the corners and singles at the wall bases, off the way, never two of a kind side by side.',
    'Don\'t be afraid to make it tall: the great rooms rise well over the walker, their vaults lost in the dark above the torches.',
    'Motifs are small: a pattern carved in a band along the plinth or the cornice (a key, a rope, teeth), never an object.',
    'Doodads are the large things (the set piece, a coffin, a barrel, a boulder): never two together unless a corner gathers them on purpose.',
  ]),
  values: Object.freeze(['candle', 'torchlit', 'floor', 'vault']),
  // the torches' live flicker, against a real torch's: slower reads as still air underground, not a gale
  flicker: 0.45,
  moss: { key: 'floor:moss', scale: 1.3, tint: [0.56, 0.62, 0.54], rise: [0.1, 0.8], max: 0.45, patch: [0.42, 0.7], wander: 0.4 },
  grime: { key: 'floor:grime', scale: 1.7, tint: [0.92, 0.88, 0.82], edge: [0.3, 2.4], max: 0.95, walk: 1.2, patch: [0.2, 0.55] },
  cobwebs: { share: 0.45, size: [0.35, 0.7], tint: [0.88, 0.87, 0.84] },
  tomb: { dais: { w: 3.2, d: 2.2, step: 0.2, steps: 1, inset: 0.3 }, chest: { w: 2.1, d: 0.95, h: 0.8 }, lid: { over: 0.08, h: 0.14, round: 0.16 },
    stone: { key: 'marble-carrara', scale: 1.2, tint: [0.8, 0.74, 0.66] } },
  // the loculi: long low slots in tiers up the bay, flat-headed (the arches are the passages' and the vault's)
  niches: { head: 'flat', tiers: 4, w: 1.7, h: 0.42, sill: 0.25, gap: 0.3, frame: 0.08, out: 0.05, dark: [0.1, 0.09, 0.08], urns: 0.12, urn: [0.6, 0.44, 0.32],
    sealed: 0.4, slab: [0.92, 0.88, 0.8] },
  // the ossuary wall: courses of bone ends (pale, small, rounded) and skulls on ledges
  // (`radius: 1` rounds each course stone to a disc, a bone seen end-on; `repeat` lays the tile that many times denser
  // than the wall's, so the bone ends are hand-sized)
  accent: { stone: { stone: [150, 136, 112], mortar: [40, 33, 27], rows: 10, cols: 10, radius: 1, shadow: 0.85, mortarThick: 0.18, bevel: 0.4, vary: 40, grain: 6, jointDepth: 0.9, grime: 0.5, chips: 0.3 },
    repeat: 2.6, tint: [0.86, 0.84, 0.8], skulls: { rows: [0.95, 1.8, 2.65, 3.5], r: 0.15, gap: 0.4, tone: [1, 0.95, 0.84], ledge: [0.34, 0.3, 0.27] } },
  props: { kinds: ['amphora', 'bones', 'stones', 'debris', 'planks'], share: 0.5, rock: 'basalt', tone: '#7a6e60' },
  // the view the walk leads to: from the way into the last chamber, a little high, on the sarcophagus and the wall behind
  camera: { z: 2.1, at: 1.3 },
  candles: { per: 3, r: 0.035, h: [0.16, 0.3], wax: '#e4d6b6', color: '#ffc070', intensity: 1.1, radius: 4 },
});
