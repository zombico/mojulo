/**
 * REALITY: how it looks and how its assets are made. The geocube's facet.
 *
 * A facet is data. Each setting either names a SOURCE (a table in the tree whose keys are the values; the generator
 * reads it, scripts/gen-cosmos-registry.mjs) or lists its VALUES by hand, each with a status and a note. Statuses:
 *   built    a general module makes it today
 *   local    it exists inside one game only: a mine, not a capability
 *   partial  part of it exists; the note says what is missing
 *   absent   nothing makes it yet
 * `lowers` names the module that makes a value. See ../cosmos.js for how a cosmos cube reads a facet.
 */
import { ERAS, ERA_IDS, eraCastConventions } from '../../era/eras.js';

function castStatus(id) {
  const planned = eraCastConventions(id).filter((c) => c.status === 'planned').map((c) => c.id);
  return planned.length
    ? { status: 'partial', lowers: 'lib/graph/era/cast-density.js', note: `the body is built, its density set by the target; planned: ${planned.join(', ')}` }
    : { status: 'built', lowers: 'lib/graph/era/cast-density.js', note: 'its density set by the target' };
}

export const REALITY = Object.freeze({
  id: 'reality',
  asks: 'how does it look, and how are its assets made?',
  settings: {
    // the look's generation (era/eras.js), drawn at the target's resolution; how dense is the target's, not the era's
    era: { values: Object.fromEntries(ERA_IDS.map((id) => [id, ERAS[id].world])) },
    // the cast in the same era (era/cast-density.js): built where its body is, partial while conventions are planned
    cast: { values: Object.fromEntries(ERA_IDS.map((id) => [id, castStatus(id)])) },
    look: { source: { module: 'lib/graph/era/sixth-gen.js', table: 'SIXTH_GEN_LOOKS' } },
    kit: { source: { module: 'lib/graph/era/stage.js', table: 'STAGE_KITS' } },
    medium: {
      values: {
        '3d': { status: 'built', lowers: 'lib/graph/scene/scene-three.js' },
        // built 10-12: a world's `pixel` (a gameworld's style.pixel) draws the page small and blows it up unsmoothed
        pixel: { status: 'built', godot: false, lowers: 'lib/graph/scene/scene-three.js', note: 'the World page drawn at 1/2 to 1/8 of its size, blown up without smoothing (style.pixel); no palette snap yet, and true 2D sprite levels are another thing' },
        // built 10-19 (mobile genres): a 2D board game on a pixelizer reducer (create_pixelizer_game): one page, no world
        board: { status: 'built', godot: false, lowers: 'lib/graph/pixelizer/pixelizer-games.js', note: 'a 2D board or falling-blocks game on a pixelizer reducer (falling blocks, match-3, the match-3 saga): one page, no world or level audit; falling blocks alone ports to Godot' },
      },
    },
    climate: { source: { module: 'lib/graph/weather/weather.js', table: 'CLIMATES' } },
  },
});
