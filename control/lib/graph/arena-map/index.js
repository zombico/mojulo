/** The arena map: its blocks, its reading, its laws, its templates and the generator that grows one under the laws. */
export { CELL, RISE, BODY, EYE, HEAD, SLAB, LOW, FALL, SLOPE, BLOCKS, BLOCK_IDS } from './blocks.js';
export { indexMap, sees, visibility, distances, key, centre } from './map.js';
export { PRINCIPLES, LAW_IDS, kitOf, furnish, mapLaws } from './laws.js';
export { TEMPLATES, TEMPLATE_IDS, seal, blank } from './templates.js';
export { growArenaMap, mapAscii, mapPieces } from './generate.js';
export { mapGround, mapPoint, MAP_GREY } from './ground.js';
export { phasesOnMap, phaseLaws, mapRoute, nodeAt } from './phases.js';
