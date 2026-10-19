/**
 * SPACE: where the levels are, how they join, and the camera that plays them. Shape as in reality.js.
 */
import { CAMERA_RULE } from '../../scene/engines/marks.js';
import { marksAcross } from '../../scene/engines/registry.js';

const NO_MODE = 'no gameplay camera of this kind was found in controllable, game or playscape (10-10)';
// a camera's mark in each engine is its rule's (the engine's RULE_MARKS through CAMERA_RULE)
const cam = (id) => marksAcross((M, e) => M.RULE_MARKS[CAMERA_RULE[id]][e]);

export const SPACE = Object.freeze({
  id: 'space',
  asks: 'where?',
  settings: {
    camera: {
      values: {
        'third-person': { status: 'built', ...cam('third-person'), lowers: 'lib/graph/worlds/controllable/rules-basic.js', note: 'the `follow` chase camera' },
        // built 10-12: the `fixed` camera rule (rules-basic.js: stations, the nearest focus holds the shot, a cut with a hold)
        // and a gameworld's camera 'fixed' (a station over each place of the way). A floormap's room cameras are not yet fed in.
        fixed: { status: 'built', ...cam('fixed'), lowers: 'lib/graph/gameworld/levels.js', note: 'fixed cameras over the way, cutting as the hero passes (camera: fixed; needs a hero); a floormap\'s room cameras not yet fed in' },
        // built 10-11: the `overhead` camera and the `move: 'world'` pilot, chosen by a gameworld's `camera`. Godot carries no camera
        // mode yet (its walker is first person, or a spring arm behind a suit), so a top-down game loses it on export.
        'top-down': { status: 'built', ...cam('top-down'), lowers: 'lib/graph/gameworld/levels.js', note: 'the ¾ `overhead` camera (north up), the hero moving in the screen\'s frame' },
        // built 10-11: the `side` camera and the `move: 'lane'` pilot held to a trail's own spine (2.5D: the lane bends with
        // the trail). A climb has no spine, so a side game is trails only. Godot carries no camera mode yet.
        side: { status: 'built', ...cam('side'), lowers: 'lib/graph/gameworld/levels.js', note: 'the `side` camera over a hero held to the trail\'s own line; trails only (a climb has no line to run)' },
        'first-person': { status: 'built', ...cam('first-person'), lowers: 'lib/graph/gameworld/levels.js', note: 'the `eye` camera: mouse look with pitch, the hero\'s body hidden, or the walker with no hero' },
      },
    },
    topology: {
      values: {
        linear: { status: 'built', godot: 'built', roblox: 'approximated', lowers: 'lib/graph/level/graph.js', note: "LEVEL_LAYOUTS is 'sequential'" },
        // Godot plays a hub as its level list with the gates held (kernel/game.gd, store.gd): no road between them
        hub: { status: 'built', godot: 'approximated', roblox: 'absent', lowers: 'lib/graph/gameworld/world.js', note: 'a gameworld joins its levels by road and gate' },
        open: { status: 'partial', godot: 'absent', effort: 'L', lowers: 'lib/graph/scene/channels/stream.js', note: 'terrain LOD and city tile streaming exist on world pages only; no game level is a streamed region, nothing loads content by region' },
        // built 10-11: a gameworld's topology: 'interconnected' plays as a map (exits, travel, arrival, keyed doors). Godot's
        // game.gd still plays a list from its menu, with no exits or arrival.
        interconnected: { status: 'built', lowers: 'lib/graph/gameworld/levels.js', note: 'a map: two-way links, levels left by named exits, the game travelling on and arriving at the matching end, doors opened by keys found elsewhere, an item or one of the hero\'s powers (whose move it then gives); trails only', godot: 'built', roblox: 'absent' },
      },
    },
    levelForm: {
      values: {
        rooms: { status: 'built', godot: 'built', roblox: 'approximated', lowers: 'lib/graph/era/stage.js' },
        floormap: { status: 'built', godot: 'built', roblox: 'approximated', lowers: 'lib/graph/era/floormap.js' },
        trail: { status: 'built', godot: 'built', roblox: 'approximated', lowers: 'lib/graph/era/out-trail.js' },
        meru: { status: 'built', godot: 'built', roblox: 'approximated', lowers: 'lib/graph/local-meru/plan.js' },
        arena: { status: 'built', godot: 'built', roblox: 'approximated', lowers: 'lib/graph/worlds/match-modes.js' },
        // built 10-12 (kart racer): a loop laid on a trail's land, gone round lap after lap
        circuit: { status: 'built', lowers: 'lib/graph/gameworld/lay-concerns.js', godot: 'built', roblox: 'approximated', note: 'an oval laid on the first trail\'s land (flattened, a low wall down its middle), its start the finish; a race goes round it' },
        // merged 10-12 (structure rails, broadened): a level that is a building, laid from its use
        building: { status: 'built', lowers: 'lib/graph/gameworld/levels.js', godot: 'built', roblox: 'approximated', note: 'a level that is a building: rooms laid from a use (tavern, keep, temple, crypt, library, lab, the town\'s six), walked from its way in to its goal room, up its stairs' },
        // built 10-14 (skyscape): a flight map, its ground meshed round the camera, its edge hidden in haze
        airspace: { status: 'built', lowers: 'lib/graph/skyscape/airspace.js', godot: 'absent', roblox: 'absent', note: 'a flight map: a field, a reach to turn back in, a backdrop and a haze that hides the edge (island, basin, canyon, plain); scapeshift\'s ground, a runway and a gate course' },
        // a city segment played as a level (city/plan/level.js, gameworld cityStages): its lots as solid boxes, lobbies walked
        // into, doors to insides, a ring of the city as its backdrop. No Godot fixture plays one: its traffic and walkers do
        // not step there (godot-marks.js), and the rest is unproven
        city: { status: 'built', lowers: 'lib/graph/city/plan/level.js', godot: 'absent', roblox: 'absent', note: 'a district of a planned city: a segment cut along its streets, left by its portals, its lots solid, lobbies walked into and doors to insides; played first person by a walker, no roofs to stand on yet' },
      },
    },
    // what stands on a walk's ground (merged 10-12): buildings walked into from the trail, a town's street along it
    places: {
      values: {
        none: { status: 'built', godot: 'built', roblox: 'built' },
        buildings: { status: 'built', lowers: 'lib/graph/era/stage-buildings.js', godot: 'built', roblox: 'approximated', note: 'buildings stood on the flattest land beside the trail, cut into their slope, walked into (or a door that changes the scene to their inside)' },
        street: { status: 'built', lowers: 'lib/graph/era/stage-buildings.js', godot: 'built', roblox: 'approximated', note: 'a town\'s first houses along the trail, in the town\'s own order, the hall walked into' },
      },
    },
    links: { source: { module: 'lib/graph/era/floormap.js', table: 'LINK_KINDS', marks: 'linkMarks' } },
    // the runtime rule each object lowers to (a lift and a moving deck: mover; a catapult: launcher; a ladder: a climb)
    traversal: {
      source: { module: 'lib/graph/playscape/objects/index.js', table: 'ENTRIES', marks: 'traversalMarks' },
      // the city stalker (10-19): every building's face a surface the hero holds, crawls, wraps and mantles off onto its
      // roof, read from the level's own lot boxes (a body owner beside the climb, not an object placed)
      planned: {
        wall: { status: 'absent', effort: 'M', godot: 'absent', roblox: 'absent', note: 'any building\'s face held and crawled, round its corners and up onto its roof, and launched from (a wall-jump, a charged leap); the climb holds only a placed ladder, rope or net' },
      },
    },
  },
});
