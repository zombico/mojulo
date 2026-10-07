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
  ]),
  values: Object.freeze(['candle', 'torchlit', 'floor', 'vault']),
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
