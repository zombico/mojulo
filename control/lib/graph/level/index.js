/**
 * A level: a graph of sections (graph.js) laid out by a behaviour. `layLevel(recipe)` reads the graph and hands it to
 * its layout; each layout answers with its stage recipes, one page a section. Only `sequential` is laid out yet.
 */
import { readLevel, LEVEL_LAYOUTS, LEVEL_SECTIONS, LEVEL_EDGES } from './graph.js';
import { sequentialLevel, sequentialOrder } from './sequential.js';

const LAYOUTS = { sequential: sequentialLevel };

export function layLevel(recipe) {
  const G = readLevel(recipe);
  return LAYOUTS[G.layout](G);
}

export { readLevel, sequentialLevel, sequentialOrder, LEVEL_LAYOUTS, LEVEL_SECTIONS, LEVEL_EDGES };
