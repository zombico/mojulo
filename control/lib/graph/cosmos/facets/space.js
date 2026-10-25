/**
 * SPACE: where the levels are, how they join, and the camera that plays them. Shape as in reality.js.
 */
import { CAMERA_RULE } from '../../scene/engines/marks.js';
import { marksAcross } from '../../scene/engines/registry.js';

// the strategy board is the page's (board/*); no engine kernel plays it yet
const WEB = { godot: 'absent' };
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
        // built 10-19 (strategy board): the board channel owns a battle level's camera (board/board-camera.js); a book's
        // board battles play through it (gameworld/board-levels.js), no camera word needed
        tactical: { status: 'built', ...WEB, lowers: 'lib/graph/board/board-camera.js', note: 'a locked pitch (two stops), quarter-turn rotation, zoom stops (the widest holds the board, the closer follow the cursor) and the focus held to the board, the cursor stepping the way the screen shows; an RTS form pans and edge-scrolls instead. A battle level on a board is played through it' },
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
        interconnected: { status: 'built', lowers: 'lib/graph/gameworld/levels.js', note: 'a map: two-way links, levels left by named exits, the game travelling on and arriving at the matching end, doors opened by keys found elsewhere, an item or one of the hero\'s powers (whose move it then gives, the wall and the line among them); trails, and a city (its key on a roof the hero reaches)', godot: 'built', roblox: 'absent' },
      },
    },
    levelForm: {
      values: {
        rooms: { status: 'built', godot: 'built', roblox: 'approximated', lowers: 'lib/graph/era/stage.js' },
        floormap: { status: 'built', godot: 'built', roblox: 'approximated', lowers: 'lib/graph/era/floormap.js' },
        trail: { status: 'built', godot: 'built', roblox: 'approximated', lowers: 'lib/graph/era/out-trail.js' },
        meru: { status: 'built', godot: 'built', roblox: 'approximated', lowers: 'lib/graph/local-meru/plan.js' },
        arena: { status: 'built', godot: 'built', roblox: 'approximated', lowers: 'lib/graph/worlds/match-modes.js' },
        // built 10-19 (mobile genres): a runner level, the run alone on its floor, its rows laid ahead as it is played
        run: { status: 'built', godot: 'absent', roblox: 'absent', lowers: 'lib/graph/gameworld/levels.js', note: 'an endless run down lanes (worlds/controllable/runner.js): its rows laid at play time from its seed, drawn round the hero' },
        // built 10-12 (kart racer): a loop laid on a trail's land, gone round lap after lap
        circuit: { status: 'built', lowers: 'lib/graph/gameworld/lay-concerns.js', godot: 'built', roblox: 'approximated', note: 'an oval laid on the first trail\'s land (flattened, a low wall down its middle), its start the finish; a race goes round it' },
        // merged 10-12 (structure rails, broadened): a level that is a building, laid from its use
        building: { status: 'built', lowers: 'lib/graph/gameworld/levels.js', godot: 'built', roblox: 'approximated', note: 'a level that is a building: rooms laid from a use (tavern, keep, temple, crypt, library, lab, the town\'s six), walked from its way in to its goal room, up its stairs' },
        // built 10-14 (skyscape): a flight map, its ground meshed round the camera, its edge hidden in haze
        airspace: { status: 'built', lowers: 'lib/graph/skyscape/airspace.js', godot: 'absent', roblox: 'absent', note: 'a flight map: a field, a reach to turn back in, a backdrop and a haze that hides the edge (island, basin, canyon, plain); scapeshift\'s ground, a runway and a gate course' },
        // a city segment played as a level (city/plan/level.js, gameworld cityStages): its lots as solid boxes, lobbies walked
        // into, doors to insides, a ring of the city as its backdrop. No Godot fixture plays one: its traffic and walkers do
        // not step there (godot-marks.js), and the rest is unproven
        city: { status: 'built', lowers: 'lib/graph/city/plan/level.js', godot: 'absent', roblox: 'absent', note: 'a district of a planned city: a segment cut along its streets, left by its portals, its lots solid, lobbies walked into and doors to insides; played first person by a walker, or third person by a hero whose roofs are ground (level.hero)' },
        // priced 10-25 (battle city): the venue of a contest, laid in an arena with stands
        court: { status: 'absent', effort: 'L', pkg: 'battle-city', ...WEB, note: 'a court, a pitch, a track or a lane laid in an arena with stands: named regions mirrored for the other side (a half, a service box, a crease, a lane, a foul line), the lines drawn on the ground, a broadcast camera square to the play. The arena and the stage with stands exist (versus-arena.js), the school vocab draws a pitch and a court as scenery; no level is one yet' },
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
    // a layer of spots over a level's ground, indoors or out (priced 10-19): one unit a spot, the moves listed
    board: {
      values: {
        none: { status: 'built', godot: 'built', roblox: 'built' },
        spots: { status: 'built', ...WEB, lowers: 'lib/graph/board/board-kernel.js', note: 'square spots over a level\'s own ground (its rooms or its land) or a diorama, each a height, a type and one occupant; reach by move and jump, aim and area shapes, walls cutting steps, legal moves; a book\'s battles on boards are laid over their stages' },
        lattice: { status: 'built', ...WEB, lowers: 'lib/graph/polygonizer/lattice.js', note: 'a board game\'s own board, no map: square or hex cells, corners and edges with their relations, pieces whose moves are vectors under its symmetry; chess and checkers in its book, any other game written out on it from systems and meeples (tabletop/), played against the computer as their own page' },
      },
    },
    links: { source: { module: 'lib/graph/era/floormap.js', table: 'LINK_KINDS', marks: 'linkMarks' } },
    // the runtime rule each object lowers to (a lift and a moving deck: mover; a catapult: launcher; a ladder: a climb)
    traversal: {
      source: { module: 'lib/graph/playscape/objects/index.js', table: 'ENTRIES', marks: 'traversalMarks' },
      // the city stalker (10-19): every building's face a surface the hero holds, crawls, wraps and mantles off onto its
      // roof, read from the level's own lot boxes (a body owner beside the climb, not an object placed, so not the table's)
      planned: {
        // built 10-19 (phase 2): a body owner beside the climb, read off the level's own boxes; web only
        wall: { status: 'built', lowers: 'lib/graph/worlds/controllable/wall.js', godot: 'absent', roblox: 'absent', note: 'any box\'s face held (rule.wall), crawled, rounded at its outside corners and mantled off onto its roof; a wall-jump, a charged wall-launch; perched at a roof\'s lip, a dive off it; the climb holds only a placed ladder, rope or net' },
      },
    },
  },
});
