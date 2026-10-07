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
  ]),
  values: Object.freeze(['candle', 'torchlit', 'floor', 'vault']),
  // the blends (era/blends.js): moss up the wall bases and in the gutter; grime near the walls, off the walking line
  moss: { key: 'floor:moss', scale: 1.3, tint: [0.5, 0.6, 0.54], rise: [0.15, 1.4], max: 0.8, patch: [0.32, 0.64], wander: 0.45 },
  grime: { key: 'floor:grime', scale: 1.7, tint: [0.9, 0.86, 0.82], edge: [0.3, 2.2], max: 0.9, walk: 1.4, patch: [0.25, 0.6] },
  cobwebs: { share: 0.55, size: [0.4, 0.8], tint: [0.88, 0.88, 0.92] },
  // the tomb chest: a dais of `steps`, the chest, its lid overhanging; pale stone against the darker walls
  tomb: { dais: { w: 3.6, d: 2.4, step: 0.22, steps: 2, inset: 0.35 }, chest: { w: 2.2, d: 1.0, h: 0.85 }, lid: { over: 0.1, h: 0.16 },
    stone: { key: 'marble-carrara', scale: 1.2, tint: [0.84, 0.82, 0.78] } },
  // candles in a cluster at each dais corner: wax, a flame card, a small warm light baked like a torch
  candles: { per: 3, r: 0.035, h: [0.18, 0.34], wax: '#e8dcc0', color: '#ffc874', intensity: 1.15, radius: 4.2 },
});
