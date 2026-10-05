/**
 * The DELFINO-PLAZA style card: what the `delfino-plaza` kit dresses its square with (era/plaza-dress.js), written as
 * principles and as the numbers the dressing reads. The jungle's and the nave's lessons in Sunshine's light: a set
 * piece at the focus, a floor that is not the walls' grid, blends by cause, painted cutouts, and a town that goes on;
 * and a Renaissance square's order: a portico carrying a walkway, balustrades, obelisks, quoins, a dome on the skyline
 * (era/piazza.js) under a sky of cumulus. Machine checks for the principles live in plaza.test.js.
 */
export const DELFINO_PLAZA = Object.freeze({
  id: 'delfino-plaza',
  principles: Object.freeze([
    'Hard sun: sunlit stucco is the brightest thing in the square and the sunlit paving next; the shade is a clean pale blue, never black, and the terracotta is the deepest colour of all.',
    'A set piece at the focus: a tiered fountain at the centre of the square, ringed by its own paving, water standing in its basin and spilling from its bowl.',
    'The floor is not a grid: fan-pattern setts, arcs overlapping like scales and no two setts alike, and a ring of granite laid round the fountain.',
    'Blends by cause: sand blown against the house fronts and drifted into the corner, worn off at the doors and along the way in; the paving round the basin dark where the water splashes.',
    'Life on the fronts, as painted cutouts: flower boxes under windows, striped awnings over doors that throw striped shade, laundry strung across the corner.',
    'The town goes on: rows of rooftops beyond the houses, paler and bluer with distance.',
    'Distinct inside the radius: no two neighbouring houses dress alike.',
    'A Renaissance order: a portico of grey-stone columns and round arches along the sunlit side, roundels in its spandrels, its roof a walkway; the shade under it is warm, lit from below by the sunlit square.',
    'Walkways railed in stone: turned balusters between a plinth and a rail, pedestals on the column lines carrying urns; a stair climbs to the walkway with its own raking balustrade.',
    'Obelisks measure the square: two red granite needles on stepped pedestals, either side of the fountain across the line from the way in, standing over every eave.',
    'Stone at the corners: long-and-short quoins up every house edge, so the fronts read as built and not as one painted sheet.',
    'The sky is a place: a deck of cumulus over the square, and the town\'s dome and bell tower rising over the roofs, faded like the rows below them.',
  ]),
  values: Object.freeze(['stucco', 'paving', 'shade', 'roof']),
  // the set piece, at the square's centre: a basin `R` m round and `rim` high, water at `water`; a pedestal to a bowl
  // `bowl.R` round at `bowl.z`; a finial to `top`; the stone `stone`; water spilling from the bowl's lip to the basin
  fountain: {
    R: 3.0, rim: 0.6, lip: 0.32, water: 0.46, pedestal: 0.42, bowl: { R: 1.45, z: 2.5, depth: 0.42 }, top: 4.1, sides: 24,
    stone: { key: 'marble-carrara', scale: 1.4, tint: [0.98, 0.95, 0.88] }, pool: '#4f9cc4', look: { kind: 'lagoon', tint: '#3aa8c8', shore: 0.04 }, jets: { count: 12, width: 0.5, flow: 0.9 }, spill: { color: '#e4f2fa', alpha: [0.1, 0.5], streams: 16, width: 0.28 },
    ring: { width: 1.6, key: 'rock-sandstone', scale: 1.6, tint: [0.94, 0.9, 0.84] },
  },
  floor: { field: { key: 'floor:fan', scale: 2.6 } },
  // sand against the closed sides (alpha `max` at the wall, gone by `reach` m), drifted deeper into the corner, worn off
  // within `door` m of a door and `walk` m of the walking line; the splash: grime within `splash` m of the basin
  sand: { key: 'soil-sand', scale: 2, tint: [1.02, 0.98, 0.9], max: 0.85, reach: 2.6, corner: 2.4, door: 1.3, walk: 1.6, patch: [0.3, 0.65] },
  splash: { key: 'floor:grime', scale: 1.6, tint: [1.2, 1.18, 1.16], width: 1.1, max: 0.55 },
  // the fronts: each house takes one dressing from the cycle (neighbours never match); a flower box under each
  // dressed window, an awning `out` m over a door, laundry across the corner on `lines` lines
  dressings: ['awning', 'flowers', 'awning+flowers', 'plain'],
  flowers: { box: [0.22, 0.24], tint: [1, 1, 1], boxTint: [0.74, 0.42, 0.3], h: 0.62, every: 0.6 },
  awning: { out: 1.3, drop: 0.6, over: 0.35, tint: [1, 1, 1] },
  laundry: { lines: 2, z: [5.5, 6.6], tint: [1, 1, 1], drop: 0.9 },
  // the rooftop rows: `rows` cards behind each closed side, `gap` m apart, rising and fading toward the horizon
  rooftops: { rows: 3, gap: 9, first: 6, height: [15, 21], fade: [0.35, 0.75], card: 26 },
  // the PORTICO along `side`: `depth` m out from the fronts, from the open end to `end` m short of the far corner, on a
  // `stylobate`; columns `bay` m apart springing round arches at `spring`; its roof a walkway at `deck` (just under the
  // first-floor sills); a stair `stair.width` wide climbs its front to a landing at the far end. Pietra serena: grey
  // stone on stucco. Roundels (glazed, blue and white) in the spandrels.
  portico: {
    side: '+y', depth: 3.4, end: 4.2, stylobate: 0.3, bay: 2.8, spring: 2.4, deck: 4.05, slab: 0.4, wall: 0.6, seg: 10,
    column: { r: 0.17, sides: 10 }, cornice: { h: 0.18, out: 0.2 }, roundel: { r: 0.22, sides: 14, blue: [0.24, 0.44, 0.78], white: [1.05, 1.04, 1] },
    stone: { key: 'marble-carrara', scale: 1.4, tint: [0.78, 0.8, 0.83] }, stucco: { key: 'stucco', scale: 1.5, tint: [1.04, 0.94, 0.78] },
    floor: { key: 'floor:hex', scale: 1.6, tint: [1.25, 0.78, 0.6] },
    stair: { width: 1.5, rise: 0.2, run: 0.29, landing: 1.8 },
  },
  // the BALUSTRADE: `h` m to the rail, balusters every `every` m (lathed, `sides`-gon), a pedestal `pedestal` wide on
  // every column line and at the ends, an urn on every `urn.every`th pedestal
  balustrade: { h: 1.0, plinth: 0.14, every: 0.3, baluster: { r: 0.085, sides: 6 }, pedestal: 0.36, stone: { key: 'marble-carrara', scale: 1.2, tint: [0.96, 0.94, 0.9] } },
  urn: { h: 0.72, r: 0.22, sides: 10, every: 2 },
  // the OBELISKS: `count` either side of the fountain, `spread` m off the line from the way in; granite needles on
  // stepped pedestals, bronze balls under the shaft, a bronze cross on the point
  obelisks: {
    spread: 6.6, steps: [[2.6, 0.3], [2.1, 0.3]], pedestal: { w: 1.5, h: 2.0 }, balls: 0.22, shaft: { base: 0.9, top: 0.6, h: 9.4 }, point: 0.7, cross: 0.9,
    granite: { key: 'granite-pink', scale: 1.4, tint: [1.08, 0.86, 0.8] }, stone: { key: 'rock-sandstone', scale: 1.4, tint: [1.02, 0.98, 0.92] }, bronze: [0.46, 0.36, 0.2],
  },
  // QUOINS: courses `h` high up each house edge, alternately `long` and `short`, `out` proud
  quoins: { h: 0.42, long: 0.7, short: 0.4, out: 0.05, tint: [1.06, 1.02, 0.94] },
  // the SKYLINE: a ribbed dome on a drum and a bell tower, placed from the room's (x0, y0) corner, not baked; lit by
  // which way a face turns to the sun, then faded `fade` toward the horizon colour
  skyline: {
    dome: { at: [-12, 46], drum: { R: 7.5, z: 11, h: 7, color: [0.95, 0.9, 0.8] }, R: 7.8, pointed: 1.55, ribs: 8, sides: 48, lantern: { r: 1.1, h: 4.2 }, color: [0.8, 0.42, 0.28], rib: [0.97, 0.95, 0.9], fade: 0.42 },
    campanile: { at: [-20, 28], w: 4.2, z: 6, h: 24, belfry: 4.4, spire: 6.5, color: [0.84, 0.58, 0.44], band: [0.92, 0.74, 0.6], roof: [0.74, 0.36, 0.24], dark: [0.14, 0.14, 0.18], fade: 0.3 },
  },
  // the SKY: mojulo's cloud deck (effects/effects-clouds.js, `undershot`) — fair-weather cumulus, bright, thin
  clouds: { mode: 'undershot', base: 85, thickness: 28, coverage: 0.3, scale: 0.0085, density: 0.3, drift: 0.6, fade: 640, color: [1.7, 1.66, 1.6], depthClip: true },
});
