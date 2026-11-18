/**
 * THE FILLS (the traditional side-scroller map, docs/side-map-principles.md "The closed parts are painted"): what every
 * closed part of a side map the camera sees is drawn as, by the place it belongs to: never a plain face. A row a fill;
 * a new fill is a row. They are the reality facet's `fill` words (cosmos/facets/reality.js), the look the cube owns.
 *
 *   FILLS[id]   { says, carries }: what it is, and what runs through it from one zone to the next
 *
 * Painted by paint.js (the side map's build); this table names them so a map can say its own and the cube can key them.
 */
export const FILLS = Object.freeze({
  rock: Object.freeze({ says: 'rock: beds level across the level, joints along them, pockets and veins in a big mass, roots near the top', carries: 'roots, a seam of ore' }),
  built: Object.freeze({ says: 'built: courses of stone or brick, a trim at every lip, a recess toward the middle of a big wall', carries: 'a drain, a run of pipe' }),
  machine: Object.freeze({ says: 'machine: panels and their seams, pipes and cables threading through, a window into the works behind', carries: 'pipes, cables' }),
  padded: Object.freeze({ says: 'padded: blocks in a frame, each its own cushion, the frame lit at its edges', carries: 'a conduit along the frame' }),
});
export const FILL_IDS = Object.freeze(Object.keys(FILLS));
