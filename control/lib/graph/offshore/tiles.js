/**
 * THE RIG'S TILES — what an offshore rig level is built of, a row each. A rig is open decks stacked over the sea, so its
 * ground is three tiles before it is anything else:
 *
 *   FLOORS   a deck's cell, CELL metres square: what a body stands on (plate, grating, the helideck)
 *   RAILS    a deck's open edge: what keeps a body from the drop, and what it does to a gaze (a guard rail stops a body
 *            and no gaze, a bulwark a crouch's, a wind screen a standing one's)
 *   PILLARS  a grid node: what carries the deck above, and the cover a body has in the open (a main leg, a column)
 *
 * and over them the MODULES a deck carries (containers, tanks, pipe racks, the quarters, the derrick, a crane), each
 * a footprint and a height. What a piece hides is read from its height (`stopsOf`), never declared beside it, so a
 * taller tank is a better place to stand behind without a second word saying so. A new look is a row.
 *
 * Pure data and two readers; no dice, no clock.
 */

/** metres a deck's cell: a body with a camera behind it crosses one in a stride and a half each way */
export const CELL = 3;
/** a body: its radius, its width to pass, the eyes the gaze laws read (a watcher's, a standing, a crouching body's) */
export const BODY = Object.freeze({ r: 0.35, pass: 1.4, eye: 1.6, crouch: 0.9, prone: 0.45, watcher: 1.6 });

/** a piece's height as what it hides: a standing body (taller than a standing eye), a crouch, or a body lying down */
export const stopsOf = (h) => (h >= 1.6 ? 'stand' : h >= 0.85 ? 'crouch' : h >= 0.4 ? 'prone' : null);

export const FLOORS = Object.freeze({
  plate: { glyph: '#', fill: '#7a7c78', edge: '#5e605c', thick: 0.35, reads: 'chequer plate: solid steel, the production deck\'s floor' },
  grating: { glyph: '=', fill: '#5c6163', edge: '#45494b', thick: 0.3, reads: 'open bar grating: the cellar deck and the walkways, the sea seen through it' },
  helideck: { glyph: 'H', fill: '#3d5c47', edge: '#2f4a39', thick: 0.4, mark: '#e2c23a', open: true, reads: 'the helideck: plate painted green, its touchdown circle yellow' },
});
// (`open`: a floor bare by its use, a helideck's pad: the gaze and cover laws read the rest of its deck)
/** the glyph a deck's map writes for each floor, and '.' for none (the sea, or the deck below) */
export const GLYPHS = Object.freeze({ ...Object.fromEntries(Object.entries(FLOORS).map(([id, f]) => [f.glyph, id])), '.': null });

export const RAILS = Object.freeze({
  guard: { h: 1.1, see: true, fill: '#d6a628', reads: 'a handrail: top rail, knee rail and toe board on posts; it stops a body and no gaze' },
  bulwark: { h: 1.1, fill: '#858884', reads: 'a steel bulwark to the hip: a crouch hides behind it, a standing body is seen over it' },
  screen: { h: 2.8, fill: '#a3a69f', reads: 'a wind wall of cladding: it stops a standing gaze, the weather side\'s' },
});

export const PILLARS = Object.freeze({
  leg: { size: 3.2, sides: 8, fill: '#c9a03a', reads: 'a main leg: from the sea bed through every deck it meets to the highest' },
  column: { size: 1.0, sides: 4, fill: '#8d918d', reads: 'a box column carrying the deck above: the cover a body has in the open' },
});

/** the modules: `size` metres [along x, along y] before a turn, `h` metres; `draw` how the builder draws it (build.js),
 *  `solid` the boxes a body meets (none: drawn only, a boom over the sea) */
export const MODULES = Object.freeze({
  container: { size: [6.1, 2.44], h: 2.6, draw: 'container', fills: ['#2f5d8a', '#a23b2c', '#c46d21', '#4a7a3d', '#6f7579'], reads: 'a shipping container: a wall to stand behind' },
  skid: { size: [3.2, 2.2], h: 1.7, draw: 'skid', fills: ['#5d6f7d', '#7b6f4f'], reads: 'a machinery skid, pumps on a frame' },
  tank: { size: [3.2, 3.2], h: 4.5, draw: 'tank', fills: ['#d6d3ca', '#c9c2b0'], reads: 'a vertical tank: a round wall' },
  rack: { size: [6, 1.6], h: 1.05, draw: 'rack', fills: ['#a86b33', '#7d8a8f'], reads: 'a pipe rack: pipes on stands, a crouch\'s cover' },
  drums: { size: [1.6, 1.6], h: 0.95, draw: 'drums', fills: ['#2f4a6b', '#7a2e27', '#4c5c33'], reads: 'drums on a pallet' },
  quarters: { size: [9, 6], h: 7, draw: 'quarters', fills: ['#dad7ce'], window: '#34536b', reads: 'the living quarters: two storeys, its windows dark' },
  cabin: { size: [2.6, 2.6], h: 2.7, draw: 'cabin', fills: ['#d8d4c8'], window: '#2c4a60', reads: 'the driller\'s cabin' },
  drawworks: { size: [3, 2], h: 2.2, draw: 'skid', fills: ['#3f5f86'], reads: 'the drawworks: the winch that hoists the drill string' },
  derrick: { size: [9, 9], h: 32, draw: 'derrick', fills: ['#b23a2b'], foot: 0.9, solid: 'legs', reads: 'the derrick: a lattice tower over the drill floor, walked into between its legs' },
  crane: { size: [2.6, 2.6], h: 7, draw: 'crane', fills: ['#d9ae2c'], boom: 26, solid: 'pedestal', reads: 'a pedestal crane, its boom over the sea' },
  flare: { size: [1.2, 1.2], h: 1.2, draw: 'flare', fills: ['#8a8e8a'], boom: 30, solid: 'none', reads: 'the flare boom, out over the sea' },
  lifeboat: { size: [8, 3], h: 3, draw: 'lifeboat', fills: ['#e2671f'], solid: 'none', reads: 'a lifeboat on its davits, hung outside the rail' },
});
export const MODULE_IDS = Object.keys(MODULES);
