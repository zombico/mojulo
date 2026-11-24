import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Mirrors the @/* alias defined in jsconfig.json so vitest can follow imports
// through modules that use the Next.js-style alias (notably lib/mcp/*).
const here = dirname(fileURLToPath(import.meta.url));

// The e2e tier (`npm run test:e2e`, vitest.e2e.config.js): whole worlds made through the real MCP handlers, and
// games minted with `autoAudit: true`, whose gate walks every level in headless Chrome. Together they were a third
// of the suite's time, so `npm test` leaves them out and CI runs them once, in their own job, rather than on every
// leg of the matrix. Listed here so both configs read one list; the e2e config re-exports it.
// A list, not a suffix: a rename would collide with every branch still editing these files.
export const E2E = [
  // a side map level resolved as its page resolves it and played to its goal by the side map's bot (gameworld/side-map/)
  'lib/graph/gameworld/side-map/level.e2e.test.js',
  'lib/graph/gameworld/race-hud.e2e.test.js',
  'lib/graph/gameworld/door-probes.e2e.test.js',
  // a shoot plan's contact sheet rendered through the door: its frames captured in headless Chrome and composed
  'lib/mcp/tools/shoot-contact.e2e.test.js',
  // the default heroes minted and exported as an engine takes them, held under their game budget (triangles, vertices,
  // the atlas, the body opaque)
  'lib/mcp/tools/hero-budget.e2e.test.js',
  // the exhibit starters made through create_exhibit: Pompeii resolves a whole historic town and its people
  'lib/graph/exhibit/starters.e2e.test.js',
  // a glyph map built whole through the kit's builder, tile by tile, and its laws measured (level/grid-scene.js)
  'lib/graph/level/grid-scene.e2e.test.js',
  'lib/graph/worlds/built-light.e2e.test.js',
  // a whole physical geocity resolved through world-scene (its metro, its ring's blocks, pieces and load audit): minutes
  'lib/graph/rupa/city-ring.e2e.test.js',
  'lib/mcp/tools/gameworld-city.test.js',
  'lib/mcp/tools/building-level.test.js',
  'lib/mcp/tools/design-game.test.js',
  'lib/mcp/tools/design-game.quick.test.js',
  'lib/mcp/tools/design-game.budget.test.js',
  // a game with a `music` made whole: its cues minted as steps, the game naming them (gameworld/cue-sheet.js)
  'lib/mcp/tools/design-game.score.e2e.test.js',
  'lib/mcp/tools/design-game.proof.test.js',
  'lib/mcp/tools/design-game.climb.test.js',
  'lib/mcp/tools/design-game.quest.test.js',
  'lib/mcp/tools/design-game.mission.test.js',
  'lib/graph/car-designer/racer-live.test.js',
  'lib/graph/gameworld/feel/hero-juice.live.test.js',
  'lib/graph/gameworld/practice-room.live.test.js',
  // a fight composed in the game room, resolved whole and played headless by the playthrough's players
  'lib/graph/gameworld/fight-play.test.js',
  // the action game's first level, a building of four fights, resolved whole and played through headless
  'lib/graph/gameworld/citadel-play.test.js',
  'lib/graph/scene/action-hero.live.test.js',
  'lib/graph/gameworld/gun-rooms.live.test.js',
  'lib/graph/gameworld/mission.live.test.js',
  'lib/graph/gameworld/mission-building.live.test.js',
  'lib/graph/gameworld/mission-site.live.test.js',
  'lib/graph/gameworld/mission-industrial.live.test.js',
  'lib/graph/car-designer/form-render.live.test.js',
  'lib/graph/cycle-shelf/cycle-ride.live.test.js',
  'lib/mcp/tools/export-model.realistic.test.js',
  'lib/mcp/tools/export-model.persona.test.js',
  'lib/mcp/tools/export-model.beast.test.js',
  'lib/mcp/tools/export-model.anime.test.js',
  'lib/graph/board/board-page.live.test.js',
  'lib/graph/contest/meet-page.live.test.js',
  'lib/graph/contest/court-page.live.test.js',
  'lib/graph/contest/turns-page.live.test.js',
  'lib/graph/contest/pitch-page.live.test.js',
  'lib/graph/contest/athletes-page.live.test.js',
  'lib/graph/contest/arcade-page.live.test.js',
  'lib/graph/contest/arcade-pitch.live.test.js',
  'lib/graph/contest/innings-page.live.test.js',
  'lib/graph/tabletop/holo-page.live.test.js',
  'lib/graph/book/book-pdf.live.test.js',
  'lib/graph/table-rpg/table-rpg-page.live.test.js',
  'lib/mcp/tools/table-rpg-portraits.live.test.js',
  'lib/graph/game/play-shell-final.live.test.js',
  'lib/graph/game/play-shell-atlas.live.test.js',
  // a zoned map's four zones built to a folder and walked gate by gate in headless Chrome (scripts/worldmap.mjs)
  'lib/graph/gameworld/worldmap-bed.live.test.js',
  // the JRPG starter's town played: a townsperson's talk in the talk box, the innkeeper's inn
  'lib/graph/gameworld/jrpg-town.live.test.js',
  // the hover bot over a little world in headless Chromium: its ground cast, its teleport, its flight's step and hole
  'lib/graph/scene/hover-bot.live.test.js',
  'lib/graph/game/pause-owner.live.test.js',
  'lib/graph/game/stage.live.test.js',
  'lib/graph/playscape/ui/scene-takes.live.test.js',
  'lib/graph/scene/channels/controllable/seats.live.test.js',
  'lib/graph/worlds/controllable/vayo-air.live.test.js',
  'lib/graph/worlds/controllable/vayo-move.live.test.js',
  'lib/graph/worlds/controllable/knock.live.test.js', 'lib/graph/scene/channels/controllable/shot-light.live.test.js', 'lib/graph/worlds/cel-body.e2e.test.js',
  'lib/graph/worlds/mount-ride.live.test.js',
  'lib/mcp/tools/design-game.seats.test.js',
  'lib/graph/science-worlds/conformance.chrome.test.js',
  'lib/graph/science-worlds/relativistic/conformance.chrome.test.js',
  'lib/graph/science-worlds/quantum/conformance.chrome.test.js',
  'lib/graph/science-worlds/classical/conformance.chrome.test.js',
  'lib/mcp/tools/science-setting.test.js',
  'lib/graph/scene/live-light.chrome.test.js',
  'lib/mana-ui/snapshot.chrome.test.js',
  'lib/graph/scene/channels/controllable/armed-body.chrome.test.js',
  // keying in play: a walking body on twos in headless Chrome, its pose on the key and its place on every frame
  'lib/graph/scene/channels/controllable/keying.chrome.test.js',
  // a set piece's chase line under its track camera in headless Chrome: the line run, the camera on its key
  'lib/graph/scene/channels/controllable/chase.chrome.test.js',
  // the quick-time prompt drawn in headless Chrome: told, open and closing, answered
  'lib/graph/scene/channels/controllable/prompt.chrome.test.js',
  // the stunt room played in headless Chrome: a bot clears its set piece, and is put back by a late press
  'lib/graph/gameworld/stunt-room.live.test.js',
  // set-piece kinds played in headless Chrome: the collapse's tower down, the climb climbed
  'lib/graph/gameworld/set-piece-kinds.live.test.js',
  // Lost Nomad's template movie played end to end in headless Chrome: each set-piece level ordered and won
  'lib/graph/gameworld/lost-nomad.live.test.js',
  // the ray budget: a walker on a gen-7 land in headless Chrome, no ray testing a big mesh triangle by triangle
  'lib/graph/scene/channels/controllable/ray-budget.chrome.test.js',
  // the firing range heard: its page in headless Chrome, each action's sound counted by the sources it starts
  'lib/graph/gameworld/combat/range-sound.chrome.test.js',
  'lib/graph/gameworld/combat/artillery.chrome.test.js',
  'lib/graph/scene/visual-gate.chrome.test.js',
  // a level's scene said through mana-ui's talk box: its page in headless Chrome, a line, a choice clicked
  'lib/graph/playscape/ui/talk-box.live.test.js',
  // a scene's lines said by a realistic and an anime face: each face's weights move while its line plays
  'lib/graph/playscape/ui/talk-mouth.live.test.js',
  // a recorded line heard: its bytes on the page, played after a press while its line is up, stopped at the next
  'lib/graph/playscape/ui/talk-voice.live.test.js',
];

// What no tier but its own runs (the e2e config takes this, less the e2e suites themselves).
export const EXCLUDE = [
  '**/node_modules/**',
  '.next/**',
  'data/**',
  'lite-template/**',
  // Generative illustration spikes: render SVGs to
  // lite-template/integration/**/spike-output for visual review, not
  // load-bearing assertions, and dump ~hundreds of MB per full run. Run
  // one on demand: npx vitest run --config '' path/to/foo.spike.gen.test.js
  // Covers both spike families: *.spike.gen.test.js and *.spike.test.js.
  '**/*.gen.test.js',
  '**/*.spike.test.js',
  // The deep tier: exhaustive sweeps (every word at its range ends, every named preset built) that take minutes
  // and only say something when the module they sweep changed. `npm run test:deep` runs them all;
  // `npm run test:deep:changed` runs only those whose imports touch a changed file; CI runs them all.
  '**/*.deep.test.js',
];

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(here, '.'),
    },
  },
  test: {
    // The heaviest generative tests (fractal-city / subway-building sampling
    // loops, plus the MCP-server import that populates the tool registry)
    // legitimately run several seconds each and cross Vitest's 5s default
    // under full-suite parallel load — flaking as timeouts and, worse, as
    // partial-registration assertion failures when ensureToolsRegistered()
    // is aborted mid-import. Give the slow tail real headroom.
    testTimeout: 30000,
    // Same headroom for hooks: mcp-orbit / runner.integration beforeEach
    // re-boots the DB + tool registry, which crosses the 10s hook default
    // under full-suite load and cascades into "Unknown tool" failures.
    hookTimeout: 30000,
    setupFiles: ['./vitest.setup.js'],
    // The realistic body's keeps shared across test files (lib/util/kept.js): a folder per hash of the sources.
    globalSetup: ['./vitest.global-setup.js'],
    include: ['{lib,app,components,middleware,scripts}/**/*.test.js', 'middleware.test.js'],
    exclude: [...EXCLUDE, ...E2E],
  },
});
