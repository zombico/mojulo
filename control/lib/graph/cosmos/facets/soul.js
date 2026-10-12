/**
 * SOUL: the characters. Shape as in reality.js.
 */
export const SOUL = Object.freeze({
  id: 'soul',
  asks: 'who?',
  settings: {
    hero: {
      values: {
        hero: { status: 'built', lowers: 'lib/mcp/tools/create-character.js' },
        creature: { status: 'built', lowers: 'lib/mcp/tools/create-character.js' },
        animal: { status: 'built', lowers: 'lib/mcp/tools/create-character.js' },
      },
    },
    cast: { source: { module: 'lib/graph/polygonizer/figure-cast.js', table: 'CAST_PRESETS' } },
    vibe: { source: { module: 'lib/graph/gameworld/hero-vibe.js', table: 'VIBES' } },
    gaits: { multi: true, source: { module: 'lib/graph/polygonizer/hero-motion.js', table: 'MOTION_GAITS' } },
    equipment: { multi: true, source: { module: 'lib/graph/equipment/expand.js', table: 'EQUIPMENT_ITEMS' } },
    species: { multi: true, source: { module: 'lib/graph/fauna/species.js', table: 'SPECIES' } },
    party: {
      values: {
        solo: { status: 'built', lowers: 'lib/graph/playscape/player.js' },
        party: { status: 'built', lowers: 'lib/graph/playscape/ui/party.js', godot: false, note: 'a cast member who joins on a flag (cast.<id>.joins) escorts the hero in every level after; no party roster stats or menus yet; web only' },
      },
    },
  },
});
