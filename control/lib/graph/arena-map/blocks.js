/**
 * THE ARENA MAP'S BUILDING BLOCKS — what a fighting map is made of, on one grid. A map is cells `CELL` metres square on
 * levels `RISE` metres apart; everything in it is one of a closed table of blocks set on that grid, so a map is data and
 * every law (laws.js) is measured on the same numbers. A new block is a row here, its reading in map.js and the laws
 * that hold it.
 *
 *   CELL, RISE        the grid: a cell's side and a level's height, in metres
 *   BODY, EYE, HEAD   a body: its height, its eye, the headroom it is owed
 *   SLAB, LOW         a floor panel's thickness; a low wall's height (it stops feet and breaks a line below it)
 *   FALL              how many levels a body may drop
 *   SLOPE             the steepest ramp walked (rise over run)
 *   BLOCKS            { <form>: { about, sits, walk, sight } }
 *
 * Pure, no dice.
 */
export const CELL = 3, RISE = 3, BODY = 1.8, EYE = 1.6, HEAD = 2.1, SLAB = 0.2, LOW = 1.1, FALL = 2, SLOPE = 0.5;

export const BLOCKS = Object.freeze({
  floor: Object.freeze({ about: 'a floor panel: one cell of a level to stand on', sits: 'a cell, at a level', walk: 'stood on', sight: 'stops a line that crosses its level' }),
  wall: Object.freeze({ about: 'a wall panel, a level high', sits: 'the edge between two cells, at a level', walk: 'stops a body', sight: 'stops a line' }),
  'low-wall': Object.freeze({ about: 'a low wall or a rail: cover on the flat, none from above', sits: 'the edge between two cells, at a level', walk: 'stops a body (and a fall)', sight: `stops a line lower than ${LOW} m over its floor` }),
  solid: Object.freeze({ about: 'a filled cell: a pillar, a core, a mass', sits: 'a cell, at a level', walk: 'stops a body', sight: 'stops a line' }),
  ramp: Object.freeze({ about: 'a ramp up one level over a run of cells, a landing at each end', sits: 'a run of cells in a line, from a level to the next', walk: 'walked both ways', sight: 'none stopped' }),
  ladder: Object.freeze({ about: 'a ladder up one level in one cell, onto the ledge beside it', sits: 'a cell and the side its ledge is on', walk: 'climbed both ways, slowly', sight: 'none stopped' }),
});
export const BLOCK_IDS = Object.freeze(Object.keys(BLOCKS));
