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
        // built 10-12: the `fixed` camera rule (rules-basic.js: stations, the nearest focus holds the shot, a cut with a hold)
        // and a gameworld's camera 'fixed' (a station over each place of the way). A floormap's room cameras are not yet fed in.
        fixed: { status: 'built', lowers: 'lib/graph/gameworld/levels.js', note: 'fixed cameras over the way, cutting as the hero passes (camera: fixed; needs a hero); a floormap\'s room cameras not yet fed in' },
        // built 10-11: the `overhead` camera and the `move: 'world'` pilot, chosen by a gameworld's `camera`.
        'top-down': { status: 'built', lowers: 'lib/graph/gameworld/levels.js', note: 'the ¾ `overhead` camera (north up), the hero moving in the screen\'s frame' },
        // built 10-11: the `side` camera and the `move: 'lane'` pilot held to a trail's own spine (2.5D: the lane bends with
        // the trail). A climb has no spine, so a side game is trails only.
        side: { status: 'built', lowers: 'lib/graph/gameworld/levels.js', note: 'the `side` camera over a hero held to the trail\'s own line; trails only (a climb has no line to run)' },
        'first-person': { status: 'built', lowers: 'lib/graph/gameworld/levels.js', note: 'the `eye` camera: mouse look with pitch, the hero\'s body hidden, or the walker with no hero' },
        // built 11-05 (1105-platformer-lv0-spike): a 3D platformer's two chases, the follow rule's `steer` (rules-basic.js)
        // with the platform rule's `move: 'camera'`: the hero runs the way the camera looks, the view held through a jump
        follow: { status: 'built', since: '2026-11-05', lowers: 'lib/graph/worlds/controllable/rules-basic.js', note: 'a 3D platformer\'s chase that follows by itself (steer: trail): it eases behind the run, holds while the hero turns back at it, and holds its height through a jump; the hero moves the way it looks' },
        orbit: { status: 'built', since: '2026-11-05', lowers: 'lib/graph/worlds/controllable/rules-basic.js', note: 'a 3D platformer\'s chase the player turns (steer: orbit: a drag, the right stick, yaw and pitch; an action hero\'s by the mouse, locked on by C, 11-07); the hero moves the way it looks; its height held through a jump' },
        // built 10-19 (strategy board): the board channel owns a battle level's camera (board/board-camera.js); a book's
        // board battles play through it (gameworld/board-levels.js), no camera word needed
        tactical: { status: 'built', lowers: 'lib/graph/board/board-camera.js', note: 'a locked pitch (two stops), quarter-turn rotation, zoom stops (the widest holds the board, the closer follow the cursor) and the focus held to the board, the cursor stepping the way the screen shows; an RTS form pans and edge-scrolls instead. A battle level on a board is played through it' },
      },
    },
    topology: {
      values: {
        linear: { status: 'built', lowers: 'lib/graph/level/graph.js', note: "LEVEL_LAYOUTS is 'sequential'" },
        hub: { status: 'built', lowers: 'lib/graph/gameworld/world.js', note: 'a gameworld joins its levels by road and gate' },
        // (11-10: what is left of it. Built since: a world map of zones (space.worldMap=zones), several segments walked
        // as one seamless page (glyphs.zoned groups) and the unbuilt rest of the map on the horizon (glyphs.far,
        // level/far-view.js). The quest open world's `stream` is a law measured on the recipe (qow/qow.js), not a streamer)
        open: { status: 'partial', effort: 'L', lowers: 'lib/graph/scene/channels/stream.js', note: 'terrain LOD and city tile streaming exist on world pages only. A world map\'s zones load as they are walked into, several segments can be one seamless page and the rest of the map stands on the horizon, but a crossing is at a gate, never anywhere along a border, each a whole page swapped behind the veil, never streamed or fetched ahead; an arrival sets place, not facing' },
        // built 10-11: a gameworld's topology: 'interconnected' plays as a map (exits, travel, arrival, keyed doors).
        interconnected: { status: 'built', lowers: 'lib/graph/gameworld/levels.js', note: 'a map: two-way links, levels left by named exits, the game travelling on and arriving at the matching end, doors opened by keys found elsewhere, an item or one of the hero\'s powers (whose move it then gives, the wall and the line among them); trails, and a city (its key on a roof the hero reaches); a megaworld\'s rings and a world map\'s zones lower to it (space.worldMap)' },
      },
    },
    // how a game's maps join at the scale above a level (11-05 the map whole and the megaworld, 11-07 the world map): the
    // loaded map the current map, not the next level. Both lower into the links an interconnected world already walks
    worldMap: {
      values: {
        none: { status: 'built', note: 'levels joined as the topology says, each its own place' },
        rings: { status: 'built', since: '2026-11-05', requires: ['space.topology=interconnected'], lowers: 'lib/graph/gameworld/megaworld.js', note: 'a megaworld: zones in rings (a mandala deeper inward to a gated core, a chain, a hub, an open ring), written once and lowered to links, keys and story flags; the shell\'s atlas shows the zones found by having been there, a mandala\'s core the win' },
        zones: { status: 'built', since: '2026-11-07', requires: ['space.topology=interconnected', 'space.levelForm=map'], lowers: 'lib/graph/level/zones.js', note: 'one planned map written in segments and built a zone a page (glyphs.zoned), crossed at the plan\'s gates and arrived at the matching end, an apron of the next zone past each border, segments grouped into one seamless page, the rest of the map far off (glyphs.far); streaming across a border is space.topology=open' },
      },
    },
    levelForm: {
      values: {
        rooms: { status: 'built', lowers: 'lib/graph/era/stage.js' },
        floormap: { status: 'built', lowers: 'lib/graph/era/floormap.js' },
        trail: { status: 'built', lowers: 'lib/graph/era/out-trail.js' },
        // built 11-05 (one map, the map whole; 11-07 a walked world that holds): a level written as a map, not rolled: a
        // glyph grid, or a plan of segments joined by gates (level/grid.js, level/plan.js), the stage's own words on every
        // tile, built on a geocube's ground, its laws measured (level/grid-scene.js)
        map: { status: 'built', since: '2026-11-05', lowers: 'lib/graph/level/grid-scene.js', note: 'a level written as a map (levels.<id>.glyphs): a glyph grid with its key and regions, or a plan of segments joined by gates, one page a chapter; the land a geocube paints, paths, places and ways walked, its laws measured; the form a world map\'s zones, a scenario and the play layer stand on' },
        // built 11-05 (the platformer's first level): a course over a trail, sized by the hero's reach
        course: { status: 'built', since: '2026-11-05', requires: ['power.rules=platform'], lowers: 'lib/graph/gameworld/course.js', note: 'a platformer\'s level (levels.<id>.course): floors, gaps and climbs sized by what the hero\'s tuned jump and run reach, laid over a trail, or as one side strip when every trail is a course under a side camera; coins along it, lives on its falls' },
        // a town on its cube, walked from its streets (geotown/); a roadway built for driving (roads/track.js)
        town: { status: 'built', lowers: 'lib/graph/geotown/scene.js', note: 'a geotown (levels.<id>.geotown): a town laid on its cube, its streets, lots and houses walked as a level' },
        roadway: { status: 'built', lowers: 'lib/graph/gameworld/levels.js', note: 'a level that is a road built for driving (levels.<id>.roadway): a lap or a stage by a course preset or spec, its land dressed, a scape beyond it' },
        meru: { status: 'built', lowers: 'lib/graph/local-meru/plan.js' },
        arena: { status: 'built', lowers: 'lib/graph/worlds/match-modes.js' },
        // local 11-09 (1109-gen-bodywork): the brawler's belt, a fight's lane opened up: a straight street with a depth band
        // across it, cut into screens the camera scrolls through, each held at a gate until its wave is beaten, the last
        // the boss's; the angle locked a stage; laid on the greybox street or an indoor level's rooms (brawl-levels.js)
        belt: { status: 'local', effort: 'M', pkg: 'brawler', lowers: 'lib/graph/brawl/brawl-belt.js', note: 'a beat-em-up\'s street: a depth band cut into screens, the camera held at each gate until its wave falls, its angle locked (classic, high, low, ahead); the greybox street or an indoor level\'s rooms (brawl-levels.js); reached from a greybox\'s brawl block, not yet from a gameworld' },
        // built 10-19 (mobile genres): a runner level, the run alone on its floor, its rows laid ahead as it is played
        run: { status: 'built', lowers: 'lib/graph/gameworld/levels.js', note: 'an endless run down lanes (worlds/controllable/runner.js): its rows laid at play time from its seed, drawn round the hero' },
        // built 10-12 (kart racer): a loop laid on a trail's land, gone round lap after lap
        circuit: { status: 'built', lowers: 'lib/graph/gameworld/lay-concerns.js', note: 'an oval laid on the first trail\'s land (flattened, a low wall down its middle), its start the finish; a race goes round it' },
        // merged 10-12 (structure rails, broadened): a level that is a building, laid from its use
        building: { status: 'built', lowers: 'lib/graph/gameworld/levels.js', note: 'a level that is a building: rooms laid from a use (tavern, keep, temple, crypt, library, lab, the town\'s six), walked from its way in to its goal room, up its stairs; a complex of buildings with basements on one yard joined by passages (building.complex, network/complex.js), a walled-core dungeon\'s spaces among them' },
        // built 10-14 (skyscape): a flight map, its ground meshed round the camera, its edge hidden in haze
        airspace: { status: 'built', lowers: 'lib/graph/skyscape/airspace.js', note: 'a flight map: a field, a reach to turn back in, a backdrop and a haze that hides the edge (island, basin, canyon, plain); scapeshift\'s ground, a runway and a gate course' },
        // a city segment played as a level (city/plan/level.js, gameworld cityStages): its lots as solid boxes, lobbies walked
        // into, doors to insides, a ring of the city as its backdrop
        city: { status: 'built', lowers: 'lib/graph/city/plan/level.js', note: 'a district of a planned city: a segment cut along its streets, left by its portals, its lots solid, lobbies walked into and doors to insides; played first person by a walker, or third person by a hero whose roofs are ground (level.hero)' },
        // built 10-25 (battle city): the venue of a contest, laid in an arena with stands
        court: { status: 'built', lowers: 'lib/graph/contest/match-arena.js', note: 'a court, a pitch, a track, a course or a lane laid in an arena with stands (a stage recipe: match-arena.js, meet-arena.js, turn-arena.js, team-arena.js): the contest kernel\'s named regions mirrored for the other side (a half, a service box, a box, a green, a gutter), the lines drawn on the ground from them, a camera square to the play (the broadcast, the end, the follow); played as the level of a quick meet or contest' },
      },
    },
    // what stands on a walk's ground (merged 10-12): buildings walked into from the trail, a town's street along it
    places: {
      values: {
        none: { status: 'built' },
        buildings: { status: 'built', lowers: 'lib/graph/era/stage-buildings.js', note: 'buildings stood on the flattest land beside the trail, cut into their slope, walked into (or a door that changes the scene to their inside)' },
        street: { status: 'built', lowers: 'lib/graph/era/stage-buildings.js', note: 'a town\'s first houses along the trail, in the town\'s own order, the hall walked into' },
      },
    },
    // a layer of spots over a level's ground, indoors or out (priced 10-19): one unit a spot, the moves listed
    board: {
      values: {
        none: { status: 'built' },
        spots: { status: 'built', lowers: 'lib/graph/board/board-kernel.js', note: 'square spots over a level\'s own ground (its rooms or its land) or a diorama, each a height, a type and one occupant; reach by move and jump, aim and area shapes, walls cutting steps, legal moves; a book\'s battles on boards are laid over their stages' },
        lattice: { status: 'built', lowers: 'lib/graph/polygonizer/lattice.js', note: 'a board game\'s own board, no map: square or hex cells, corners and edges with their relations, pieces whose moves are vectors under its symmetry; chess and checkers in its book, any other game written out on it from systems and meeples (tabletop/), played against the computer as their own page, or a game of moves lifted into a hologram arena on the World page (tabletop/holo-arena.js)' },
      },
    },
    // what level design lays on a written map to make its walk worth walking (11-07 the scenario, 11-08 the play layer:
    // level design its own department). Both stand on a map level's plan
    levelDesign: {
      multi: true,
      values: {
        scenario: { status: 'built', since: '2026-11-07', requires: ['space.levelForm=map'], lowers: 'lib/graph/level/pace.js', note: 'a level\'s scenario beat by beat (a fight, a find, a meeting, a climax) on its tiles, each beat doing something in play, and how much happens: the pace measured on the map\'s own paths at the hero\'s run (dead air, the shape of calm, tension, peak and rest, a segment\'s interest)' },
        'play-layer': { status: 'built', since: '2026-11-08', requires: ['space.levelForm=map'], lowers: 'lib/graph/level/play-layer.js', note: 'the play layer a block at a time (glyphs.play): foes cast in place, obstacles and cover in the world\'s style, pickups and gates, each a point in world metres and a yaw, so a terrain rebuilt under it keeps every piece and flags the ones it no longer suits' },
      },
    },
    // the frame a game is made for (11-05 the screen, game/screen.js; 11-06 the headset, scene/channels/xr.js): the camera
    // that plays is `camera` above; this is the device its view and its controls are laid out for
    screen: {
      values: {
        monitor: { status: 'built', since: '2026-11-05', lowers: 'lib/graph/game/screen.js', note: 'a monitor or a TV (screen: screen, 16:9; a wider one shows more at the sides)' },
        phone: { status: 'built', since: '2026-11-05', lowers: 'lib/graph/game/screen.js', note: 'a phone held upright (9:16, what design_game starts a game on): the frame, and a virtual pad drawn from the pilot\'s rule and camera, the menus risen to the thumb' },
        tablet: { status: 'built', since: '2026-11-05', lowers: 'lib/graph/game/screen.js', note: 'a tablet on its side (4:3), or stood up' },
        // partial 11-06 (mana-xr): a world's `xr` opens each stage level in a WebXR session, the controllers a game pad,
        // mana-ui's screens on a panel; what is left is said in the note
        headset: { status: 'partial', effort: 'M', lowers: 'lib/graph/scene/channels/xr.js', note: 'a world\'s xr: each stage level opens in a headset, the session driving the pilot, the controllers a game pad, mana-ui\'s screens on a panel in the world; the level\'s HUD reaches it as lines only, the contest, versus, brawl and board pages do not enter it, and no eyes gate has run on a headset' },
      },
    },
    links: { source: { module: 'lib/graph/era/floormap.js', table: 'LINK_KINDS' } },
    // the runtime rule each object lowers to (a lift and a moving deck: mover; a catapult: launcher; a ladder: a climb)
    traversal: {
      source: { module: 'lib/graph/playscape/objects/index.js', table: 'ENTRIES' },
      // the city stalker (10-19): every building's face a surface the hero holds, crawls, wraps and mantles off onto its
      // roof, read from the level's own lot boxes (a body owner beside the climb, not an object placed, so not the table's)
      planned: {
        // built 10-19 (phase 2): a body owner beside the climb, read off the level's own boxes
        wall: { status: 'built', lowers: 'lib/graph/worlds/controllable/wall.js', note: 'any box\'s face held (rule.wall), crawled, rounded at its outside corners and mantled off onto its roof; a wall-jump, a charged wall-launch; perched at a roof\'s lip, a dive off it; the climb holds only a placed ladder, rope or net' },
      },
    },
  },
});
