/**
 * SOUL: the characters. Shape as in reality.js.
 */
export const SOUL = Object.freeze({
  id: 'soul',
  asks: 'who?',
  settings: {
    hero: {
      values: {
        hero: { status: 'built', godot: 'built', roblox: 'approximated', lowers: 'lib/mcp/tools/create-character.js' },
        // makeable and rigged, not yet a game's pilot: a world's figure takes a hero alone (heroRef, world-scene.js)
        creature: { status: 'partial', godot: 'absent', effort: 'M', lowers: 'lib/mcp/tools/create-character.js', note: 'made and rigged through create_character; not pilotable: a world figure takes a hero (heroRef), no creatureRef' },
        animal: { status: 'partial', godot: 'absent', effort: 'M', lowers: 'lib/mcp/tools/create-character.js', note: 'made and rigged through create_character; not pilotable: a world figure takes a hero (heroRef), no animalRef' },
        // built 10-12: a quick game's `ride` (car, coupe, van) mints its build and pilots every stage on the drive rule,
        // its feel derived from the build's parts. Godot has no drive rule.
        vehicle: { status: 'built', godot: 'built', roblox: 'absent', lowers: 'lib/graph/gameworld/ride.js', note: 'a quick game\'s ride: a car, coupe or van built by the vehicle designer and driven (rules-drive.js); quick games only, no fly rule yet' },
        // built 10-14 (skyscape): a flight's aircraft, a class's envelope on the fly rule (a glider, a trainer, a jet).
        // Its body is a placeholder slab until the aircraft roster; Godot has no fly rule.
        aircraft: { status: 'built', godot: 'absent', lowers: 'lib/graph/skyscape/craft.js', note: 'a quick flight\'s craft (glider, trainer, jet, and the space fighter): its class on the fly rule (rules-fly.js), seated on its runway, launched aloft or flying in space; its body a slab until the aircraft roster' },
      },
    },
    // proportions and a vibe are baked into the figure and its clips; gear rides it (scene/godot-marks.js)
    cast: { source: { module: 'lib/graph/polygonizer/figure-cast.js', table: 'CAST_PRESETS', godot: { all: 'built' } } },
    vibe: { source: { module: 'lib/graph/gameworld/hero-vibe.js', table: 'VIBES', godot: { all: 'built' } } },
    // the suit plays its idle and walk; a jump or a stop happens without its clip; nothing plays a pose (gaitMark)
    gaits: { multi: true, source: { module: 'lib/graph/polygonizer/hero-motion.js', table: 'MOTION_GAITS', marks: 'gaitMarks' } },
    equipment: { multi: true, source: { module: 'lib/graph/equipment/expand.js', table: 'EQUIPMENT_ITEMS', godot: { all: 'built' }, roblox: { all: 'approximated' } } },
    // a creature's body and clips ride the GLB; how it behaves is a mind's, and the kernel has none
    species: { multi: true, source: { module: 'lib/graph/fauna/species.js', table: 'SPECIES', godot: { all: 'approximated' } } },
    party: {
      values: {
        solo: { status: 'built', godot: 'built', roblox: 'built', lowers: 'lib/graph/playscape/player.js' },
        party: { status: 'built', lowers: 'lib/graph/playscape/ui/party.js', godot: 'absent', note: 'a cast member who joins on a flag (cast.<id>.joins) escorts the hero in every level after; no party roster stats or menus yet; web only' },
      },
    },
  },
});
