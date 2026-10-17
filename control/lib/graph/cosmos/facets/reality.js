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

// Roblox (scene/roblox-marks.js): a built era, kit or look travels as the place's voxel look and coloured floors
// (roblox-look.js), its sky, haze, tone and weather do not; the cast stands as block figures.
// Godot (scene/godot-marks.js): an era that is built rides the GLB as its bake, its fog only with weather; a figure in
// a game pack rides as rigid parts (no painted or blend-shape face, no ink); a planned era travels no more than it plays
const eraGodot = (row) => (row.status === 'built' ? 'approximated' : 'absent');
function castStatus(id) {
  const planned = eraCastConventions(id).filter((c) => c.status === 'planned').map((c) => c.id);
  return planned.length
    ? { status: 'partial', godot: 'approximated', roblox: 'approximated', lowers: 'lib/graph/era/cast-density.js', note: `the body is built, its density set by the target; planned: ${planned.join(', ')}` }
    : { status: 'built', godot: 'approximated', roblox: 'approximated', lowers: 'lib/graph/era/cast-density.js', note: 'its density set by the target' };
}

export const REALITY = Object.freeze({
  id: 'reality',
  asks: 'how does it look, and how are its assets made?',
  settings: {
    // the look's generation (era/eras.js), drawn at the target's resolution; how dense is the target's, not the era's
    era: { values: Object.fromEntries(ERA_IDS.map((id) => [id, { ...ERAS[id].world, godot: eraGodot(ERAS[id].world), roblox: eraGodot(ERAS[id].world) === 'absent' ? 'absent' : 'approximated' }])) },
    // the cast in the same era (era/cast-density.js): built where its body is, partial while conventions are planned
    cast: { values: Object.fromEntries(ERA_IDS.map((id) => [id, castStatus(id)])) },
    // a look's bake and palette ride the GLB; its sky and haze travel approximated, its tone whole (godot-marks.js PAGE_MARKS)
    look: { source: { module: 'lib/graph/era/sixth-gen.js', table: 'SIXTH_GEN_LOOKS', godot: { all: 'approximated' }, roblox: { all: 'approximated' } } },
    kit: { source: { module: 'lib/graph/era/stage.js', table: 'STAGE_KITS', godot: { all: 'built' }, roblox: { all: 'approximated' } } },
    medium: {
      values: {
        '3d': { status: 'built', godot: 'built', roblox: 'approximated', lowers: 'lib/graph/scene/scene-three.js' },
        // built 10-12: a world's `pixel` (a gameworld's style.pixel) draws the page small and blows it up unsmoothed
        pixel: { status: 'built', godot: 'built', roblox: 'absent', lowers: 'lib/graph/scene/scene-three.js', note: 'the World page drawn at 1/2 to 1/8 of its size, blown up without smoothing (style.pixel); no palette snap yet, and true 2D sprite levels are another thing' },
      },
    },
    // the weather's fog, colour and light play (kernel/weather.gd); its falls and lightning are the web's
    climate: { source: { module: 'lib/graph/weather/weather.js', table: 'CLIMATES', godot: { all: 'approximated' }, roblox: { all: 'absent' } } },
  },
});
