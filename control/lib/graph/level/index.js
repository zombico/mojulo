/**
 * A level: a graph of sections (graph.js) laid out by a behaviour. `layLevel(recipe)` reads the graph and hands it to
 * its layout: `sequential` answers with its stage recipes, one page a section; `map` with its sections placed on one
 * ground, one page (map.js).
 */
import { readLevel, LEVEL_LAYOUTS, LEVEL_SECTIONS, LEVEL_EDGES } from './graph.js';
import { sequentialLevel, sequentialOrder } from './sequential.js';
import { mapLevel, placeOf } from './map.js';

const LAYOUTS = { sequential: sequentialLevel, map: mapLevel };

export function layLevel(recipe) {
  const G = readLevel(recipe);
  return LAYOUTS[G.layout](G);
}

export { readLevel, sequentialLevel, sequentialOrder, mapLevel, placeOf, LEVEL_LAYOUTS, LEVEL_SECTIONS, LEVEL_EDGES };
