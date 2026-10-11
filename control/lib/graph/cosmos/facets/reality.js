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
export const REALITY = Object.freeze({
  id: 'reality',
  asks: 'how does it look, and how are its assets made?',
  settings: {
    rung: {
      values: {
        'gen-6.0': { status: 'built', lowers: 'lib/graph/era/sixth-gen.js', note: "today's behaviour; the named preset arrives with the geocube" },
        'gen-6.5': { status: 'absent', note: 'planned: an HD budget over sixth-gen principles' },
        'gen-7.0': { status: 'absent', note: 'planned: normal maps, live sun, HDR' },
        'gen-7.5': { status: 'absent', note: 'planned: SSAO, IBL, height fog, cover by direction' },
      },
    },
    look: { source: { module: 'lib/graph/era/sixth-gen.js', table: 'SIXTH_GEN_LOOKS' } },
    kit: { source: { module: 'lib/graph/era/stage.js', table: 'STAGE_KITS' } },
    medium: {
      values: {
        '3d': { status: 'built', lowers: 'lib/graph/scene/scene-three.js' },
        pixel: { status: 'partial', lowers: 'lib/graph/pixelizer/pixelizer-games.js', note: 'the pixelizer plays only its bespoke reducers; the pixel rail is planned' },
      },
    },
    climate: { source: { module: 'lib/graph/weather/weather.js', table: 'CLIMATES' } },
  },
});
