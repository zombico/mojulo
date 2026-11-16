/**
 * THE MAP DESIGNER — a world's planned map (level/plan.js) drawn in miniature from its recipe alone, before a tile of
 * it is built (level/worldmap-view.js): its blocks in their places, the ways each is laid with, the gates and the side
 * ways between them, its heights and its cliffs, each beat of its scenario where it stands. It is the look a map is
 * given BEFORE it is made: a block's page is tens of megabytes and minutes of work; the miniature is the recipe read.
 *
 *   plannedMaps(world)                 → the ids of its levels written as a planned map
 *   gameworldMapHtml(world, { level? }) → the miniature's page (the level named, else its first planned map); throws,
 *                                        naming what is missing, where the world has none
 * Pure.
 */
import { gridOfGlyphs } from './world.js';
import { worldmapView, worldmapHtml } from '../level/worldmap-view.js';

export const plannedMaps = (world) => Object.entries(world.levels ?? {}).filter(([, L]) => L?.glyphs?.plan).map(([id]) => id);

export function gameworldMapHtml(world, { level } = {}) {
  const ids = plannedMaps(world), id = level ?? ids[0];
  if (!ids.length) throw new Error('gameworld: no level of this world is a planned map (levels.<id>.glyphs.plan): the map designer draws a map\'s plan');
  if (!ids.includes(id)) throw new Error(`gameworld: level '${id}' is no planned map of this world (its planned maps: ${ids.join(', ')})`);
  const L = world.levels[id], g = L.glyphs;
  return worldmapHtml(worldmapView({ grid: gridOfGlyphs(g), ...(g.sketch !== undefined ? { sketch: g.sketch } : {}), seed: L.seed ?? 1 }, { title: L.name ?? world.name ?? id }));
}
