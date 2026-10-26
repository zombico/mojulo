---
{
  "id": "share-game",
  "name": "Share a finished game — a folder, a desktop app, an engine project",
  "summary": "Once a game is complete: ask how the creator wants to share it, then export it the way this host can carry.",
  "when": "\"how do I share my game\", \"send the game to a friend\", \"put my game online\", \"publish the game to GitHub Pages\", \"make it an app I can double-click\", \"turn the game into a desktop app\", \"open my game in Godot\", \"let people play it outside mojulo\"",
  "entry": "export_game",
  "form": "game"
}
---
→ `export_game` once the game is complete. `create_game`, `create_pixelizer_game` and `design_game` return a `share` offer: ask the creator which option they want, never export unasked. Each option's verdict says what this host allows (here | carry | ask | no). Default: a self-contained web folder any static host serves; `target: 'desktop'` makes the folder an Electron app (offline, no web server, unsigned); `'godot'` / `'unity'` / `'roblox'` translate it, with a portability report (Unreal takes the game's assets, not the game: `export_model { format: 'unreal' }`). The export's `handoff` names this host's door. Where a folder cannot leave the host (a file-card or drop-folder box), hand over the recipe: any host running mojulo re-mints the game. (Contrast: one object or figure → `export_model`; a world alone → `/world?download=1`.) Full family → `get_creative_toolset({ form: 'game' })`.
