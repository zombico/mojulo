/**
 * The GOTHIC-NAVE style card: what the `gothic-nave` kit dresses its shell with, written as principles and as the
 * numbers era/nave.js reads, so the style is enforced, not described. The lessons the jungle taught, brought indoors:
 * two tiles blended by cause, painted cutout cards, light that comes through things, and one scale break at the focus.
 * Machine checks for the principles live in nave.test.js.
 */
export const GOTHIC_NAVE = Object.freeze({
  id: 'gothic-nave',
  principles: Object.freeze([
    'Light leads: the windows are the brightest thing in the nave, torchlit stone next, the pools the shafts throw on the floor after, the open floor below that and the vault darkest.',
    'Light comes through things: each clerestory lancet on the sunward wall throws a shaft across the nave that lands as a pool on the flags.',
    'Stone is two tiles where water and feet have been: moss rises up the wall bases and fills the gutter, grime pools at the floor\'s edges and is worn off the walking line — faded in per vertex, never a seam.',
    'Dressing is painted cutouts: ivy spills from the string course, cobwebs hang under the capitals, banners hang in the bays; each is placed for a reason and none is a box.',
    'One scale break at the focus: the end wall holds a great door half again the arcade\'s height, in stepped orders under a hood, an oculus above it.',
    'Distinct inside the radius: no two neighbouring bays dress alike.',
    'The ceiling is its own material: a plastered web painted night-blue with gilt stars between the stone ribs, never the walls\' coursed stone carried overhead.',
    'The floor is not the walls\' grid: a runner of hexagonal tiles down the walking line between slate kerbs, and irregular flags either side, no two alike.',
  ]),
  values: Object.freeze(['glass', 'torchlit', 'pool', 'floor', 'vault']),
  // the vault's web: painted plaster, dark (the light from below dies before it reaches the crown)
  vault: { key: 'vault:stars', scale: 3.2, tint: [0.72, 0.72, 0.78] },
  // the floor: a hexagonal `runner` m wide along the room's long axis, `kerb` m slate kerbs either side, irregular flags
  // (opus incertum) beyond; scale = metres per repeat of each painted tile
  floor: { runner: 3.2, kerb: 0.28, kerbTint: [0.56, 0.55, 0.54], hex: { key: 'floor:hex', scale: 1.9 }, field: { key: 'floor:incertum', scale: 3.4 } },
  // the scale break: a portal `width` m wide in the `side` wall, springing at `spring` × the room's height, its arch
  // `rise` × its span, in `orders` steps `step` wide and `depth` deep; an oculus of radius `R` centred in the wall above
  portal: {
    side: '+y', width: 6.8, spring: 0.38, rise: 0.95, orders: 3, step: 0.3, depth: 0.32, hood: 0.3, hoodOut: 0.18, bands: 3, seg: 10,
    door: { key: 'wood-oak', scale: 1.4, tint: [0.46, 0.36, 0.28] }, iron: [0.16, 0.15, 0.15],
    oculus: { R: 0.85, ring: 0.2, depth: 0.45, sides: 16 },   // a multiple of 4: the square round it meets its corners
  },
  // shafts through the lancets of the walls that face the sun: the light travels at `azimuth`° from +x toward +y, falling
  // `elevation`° below the horizontal;
  // each lands as a pool: a light baked into the corners there (never exported, never soot)
  // live FIRE (only with the recipe's `fire`: the fire channel, fire/fire.js): the torches burn at `torch` × a torch's
  // size (a cathedral's sconce torch, not a hand torch); two braziers flank the great portal, `out` m into the nave and
  // `apart` m apart, their light baked into the room as the torches' is (the page then only flickers it)
  fire: { torch: 1.7, braziers: { out: 2.4, apart: 5.6, z: 1.0, size: 1.25, color: '#ff9a48', intensity: 2.4, radius: 8 } },
  shafts: { elevation: 48, azimuth: 14, alpha: [0.03, 0.13], color: '#c8d6f6', grow: 0.9,
    pool: { color: '#c0d0f8', intensity: 2, radius: 2.8, lift: 0.7 } },
  // the blends: moss up the wall bases (alpha falls from `max` at the floor to 0 at `rise[1]` m) and in the gutter;
  // grime over the floor within `edge[1]` m of a wall, worn off within `walk` m of the walking line
  moss: { key: 'floor:moss', scale: 1.3, tint: [0.56, 0.66, 0.6], rise: [0.15, 1.9], max: 0.9, patch: [0.3, 0.62], wander: 0.5 },
  grime: { key: 'floor:grime', scale: 1.7, tint: [1.0, 0.98, 0.94], edge: [0.3, 2.6], max: 0.95, walk: 1.5, patch: [0.25, 0.6] },
  // the cutouts, each with its cause
  ivy: { share: 0.4, len: [2.2, 3.8], width: [1.5, 2.4], tint: [0.8, 0.9, 0.82] },
  // cobwebs where nothing disturbs them: the angle between a column and the wall, above the plinth and at the arcade's
  // springing
  cobwebs: { share: 0.45, size: [0.45, 0.85], tint: [0.9, 0.9, 0.95] },
  banners: { every: 2, w: 1.5, h: 3.8, off: 0.55, drop: 0.3, tint: [1, 1, 1], rod: [0.16, 0.15, 0.15] },
});
