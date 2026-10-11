/**
 * SPACE: where the levels are, how they join, and the camera that plays them. Shape as in reality.js.
 */
const NO_MODE = 'no gameplay camera of this kind was found in controllable, game or playscape (10-10)';

export const SPACE = Object.freeze({
  id: 'space',
  asks: 'where?',
  settings: {
    camera: {
      values: {
        'third-person': { status: 'built', lowers: 'lib/graph/worlds/controllable/rules-basic.js', note: 'the `follow` chase camera' },
        fixed: { status: 'partial', lowers: 'lib/graph/era/floormap-cameras.js', note: 'the floormap places cameras; walkmesh plates do not reach the World page yet' },
        'top-down': { status: 'absent', note: NO_MODE },
        side: { status: 'absent', note: NO_MODE },
        'first-person': { status: 'absent', note: NO_MODE },
      },
    },
    topology: {
      values: {
        linear: { status: 'built', lowers: 'lib/graph/level/graph.js', note: "LEVEL_LAYOUTS is 'sequential'" },
        hub: { status: 'built', lowers: 'lib/graph/gameworld/world.js', note: 'a gameworld joins its levels by road and gate' },
        open: { status: 'partial', lowers: 'lib/graph/scene/channels/stream.js', note: 'terrain LOD and world streaming exist; no open-world game structure' },
        interconnected: { status: 'partial', lowers: 'lib/graph/gameworld/world.js', note: 'gates exist, but levels lay out in sequence only; no backtracking map' },
      },
    },
    levelForm: {
      values: {
        rooms: { status: 'built', lowers: 'lib/graph/era/stage.js' },
        floormap: { status: 'built', lowers: 'lib/graph/era/floormap.js' },
        trail: { status: 'built', lowers: 'lib/graph/era/out-trail.js' },
        meru: { status: 'built', lowers: 'lib/graph/local-meru/plan.js' },
        arena: { status: 'built', lowers: 'lib/graph/worlds/match-modes.js' },
      },
    },
    links: { source: { module: 'lib/graph/era/floormap.js', table: 'LINK_KINDS' } },
    traversal: { source: { module: 'lib/graph/playscape/objects/index.js', table: 'ENTRIES' } },
  },
});
