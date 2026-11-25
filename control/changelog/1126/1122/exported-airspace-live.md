### An exported game's flight levels as the dashboard draws them: the sky's clouds, the country's buildings

`export_game` now builds a game's airspace levels the way the dashboard's `/world` route serves them (`live`), so a game
exported to files flies under its weather's sky and clouds. It also gets:
- its country's cover;
- its ground plan and its buildings under their facade shader (a colony's spires, domes and panels included);
- its sea and its lights at night.

Before, an exported flight level baked its country to plain faces and drew no clouds. Everything ships inline in the
page, so the folder still contacts no server. Every other kind of level exports as it did (`export-game.js`
`emitWorldPage`). Pilot School's lessons and Wolf Squadron's stages were checked by playing their exported shells.
