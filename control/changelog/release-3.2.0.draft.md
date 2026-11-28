<!--
DRAFT, not a theme file: changelog.mjs reads only <MMYY>/<MMDD>/ folders, so this file is not folded into Unreleased
and does not ship (package.json `files` names no changelog). Refresh it after the last merges into the release
candidate, then use it at the release and delete it.

At the release (CLAUDE.md "Release", plus what 3.2.0 adds):
1. Refresh this draft against what merged since 2026-11-28 (`node scripts/changelog.mjs` prints all of it).
2. Delete changelog/1026/1031/engine-handoff-plan.md: its own heading says "temporary … delete before release".
3. `node scripts/changelog.mjs --release 3.2.0`, then move the body of the new `## [3.2.0]` section into a new
   CHANGELOG-3.2.md ("# 3.2 development log", the shape of CHANGELOG-3.1.md) and put the section below (from
   "## [3.2.0]") in its place. Point CHANGELOG.md's preamble at CHANGELOG-3.2.md beside CHANGELOG-3.1.md.
4. Version pins, as the 3.1.1 release commit did: control/package.json and its lockfile, control/ui-package
   (version and its `mojulo` dependency), glama.json, server.json, plugins/mojulo-chatgpt (README, work-box.md,
   runner.mjs), CLAUDE.md's version line. plugin.json goes 3.2.0-rc.N → 3.2.0.
5. scripts/plugin-agents.mjs: empty AWAITING_RELEASE and LISTED_AT_RELEASE, then `node scripts/plugin-agents.mjs`.
6. `npm run smoke:tarball`; `npm publish`; `node scripts/plugin-lock.mjs` (the plugin README pins move with it);
   then measure the published install the way docs/tech-requirements.md measured 3.1.1 and replace its 3.1.1
   figures and the plugin README's "about twice that" estimate; tag v3.2.0 and push the tag.
-->

## [3.2.0] - YYYY-MM-DD

3.2 makes mojulo a 3D creative studio that takes a person from an idea to something they can play, print or walk
through. With nothing in mind, the agent offers five ways to start (a character, a game, an object, a 3D exhibit, a
home or a room); for a game, a home or an exhibit it asks a few questions first and says back what it will make; and a
game's first session aims at a first level the person plays. The detailed log behind this summary, theme by theme, is
[CHANGELOG-3.2.md](CHANGELOG-3.2.md).

### Upgrading from 3.1

- **The Claude plugin installs mojulo itself.** Claude Code installs the pinned `mojulo` from the plugin's lockfile
  when the plugin is added or updated and runs it from there; npm is not needed at start. The plugin adds a skill for
  each start (`make-character`, `design-game`, `design-object`, `make-exhibit`, `design-building`,
  `design-interior`). If mojulo was also registered with `mojulo init` or `claude mcp add`, remove that registration
  (`claude mcp remove mojulo -s user`) so one server runs. The `inference-worker` skill is gone (it served the apps
  retired in 3.1).
- **Engines take a game's levels and assets, not the game.** `export_game({ target })` for `godot`, `unity` and
  `roblox` refuses and names `export_model({ ref, engine })`, which hands a world, a game's levels or an asset to a
  Godot, Unity, Unreal or Blender project and keeps the team's own wiring when handed over again. The 3.1 Godot game
  pack is replaced by that handoff. `export_game` builds the web game and the desktop app.
- **No longer registered** (a call is an unknown tool):
  - the pre-3.0 aliases (`create_figure`, `create_workbench`, `skin_polygomer`, `create_fractal_city` and the
    `create_*_view` family): use `mint_solid`, `edit_solid`, `compose_world` and `create_exhibit`;
  - the figure-spec dream loop (`draft_figure_spec`, `get_figure_spec`, `resolve_figure_spec`,
    `build_figure_spec`, the `character-from-dream` catalyst): a character from a picture is
    `reference_protocol({ target: 'character' })` then `capture_reference`.
- **Folded onto another door, still callable by name:** `create_view` and `measure_view` into `create_exhibit` and
  `get_exhibit`; the research book into the stash (`mint_stash`, `gather`, `cook`); the stash links; and the list
  reads onto their doors (`list_world_themes` → `get_view_vocab({ themes })`, `list_plans` → `get_plan`, and the
  rest in `LISTED_AT_RELEASE`).
- **Versus on one keyboard is gone:** the keyboard is one player; player two takes a pad.
- **Deprecated, still read with a warning:** a hero's `form: 'classic'` and `core: 'streamlined'` (which the 3.1.1
  notes offered to restore the 3.0 body). New heroes are tiered.
- **Stored rows that render differently** (the exceptions to byte-identical re-render; each theme in the log names its
  opt-out where it has one):
  - **Realistic heroes:** the face is redrawn (proportions, eyes, brows, lashes, beards), light skin tones read
    warmer, the face rig is rebuilt with more expressions on its next export, and outfits are re-cut by the tailor.
  - **Game-body clothing** is re-cut (yokes, belts, collars, jackets that open), and buckles sit on the centre line.
  - **Cities and towns:** metros gain highways, industry, a waterfront, alleys, civic buildings and traffic by default
    (`highways: false`, `alleys: false` and their siblings opt out); gen-7 pages are drawn as form, with a tone
    curve and bloom (`light.finish: false` opts out); awnings and stalls are lifted to clear a hero's head.
  - **Play:** every level ends on a results screen; a hero collides at its own height; the on-foot chase camera stands
    further back; versus fights play at their own speed (they ran six times fast); platformer levels gain their dress;
    hero levels cast actor shadows.
  - **Board, strategy and arena games** with no `ui` are drawn by the game UI (menus, HUD, pad); `ui: false` keeps
    the old page.
- **Heavier pages and a bigger package.** A gen-7 town or a metro page is tens of MB, and the npm package is about
  twice 3.1.1's. No new Node requirement and no new required dependency.

### The studio

- **Five ways to start**, offered when the person has nothing in mind, each with its own skill under the Claude
  plugin.
- **A producer first.** `design_game({ world })`, `mint_building({ start })` and `create_exhibit({ start })` build
  nothing: they ask the one question for this turn and say back what will be made. A plain ask is made at once.
- **Bring what you have.** Drawings, plans, documents, lore and a bestiary are recorded as placed or set aside, never
  dropped. A 3D model of your own (GLB, VRM, glTF, OBJ, STL, 3MF) comes in with `mint_solid({ kind: 'model' })` or
  `create_character({ from })`, rigged as a body or a mascot.

### Games

- **From an idea to a first level.** A game is placed on a rail (a template it starts from) and sized: a pixelizer
  game, a quick game, a table game or a designed game. The first session's goalposts end at a first level the machine
  proves can be won and the person approves by playing.
- **New kinds of game:** side-scroll beat-em-ups and run & guns for one to four, a metroidvania castle, a party RPG
  from a town to its first boss and a world map, an action RPG over an open map, stylish action, a GTA-like open city
  (Hijack City), three flight rails and a scrolling shooter, a mech campaign, tactics and real-time strategy, sports
  with a TV broadcast, an endless runner, a match-3 saga, a work sim, a co-op kitchen and party games.
- **Whole games from one sentence** for most families (the hill-climb page's genre probes).
- **It plays as a game:** start screens, menus, a HUD for each genre, pause, results, the next level and a touch pad,
  on the game UI runtime (mana-ui); phones, tablets and monitors.
- **Couch play:** up to four on one screen or split screen, deathmatch, teams, turns, a lobby, drop-in co-op.
- **Play:** real guns (sights, scopes, reload, the bow), mounts, destructible physics, slow motion and impact cams,
  escape rooms, errands and wave gauntlets.

### Characters

- A mainstream realistic face across ancestries and ages, with expressions, blinks and lines spoken with timing.
- Wardrobes: tailored suits, fantasy dress, fatigues, armour, footwear and gloves, masks and helmets; beast-kin,
  undead, goblins and orcs; anime casts; feature-style animals.

### Worlds, cities and homes

- Locale metros (New York, LA, Miami, San Francisco, Boston, Toronto and more) with highways, waterfronts, traffic,
  shops you walk into, a museum and City Hall; old towns, subways, airports; the planets of the solar system and the
  sea floor.
- The seventh-generation look outdoors and in: grown trees and grass, live water, reflections, rain, snow, bloom.
- A home or a room from its plan or photo, produced before it is made; house forms by tradition; interiors from words.

### Exports and engines

- `export_model({ engine })` for Godot, Unity, Unreal and Blender; Unreal takes characters and solids with their rig
  and clips; GLBs carry PBR materials and pass the Khronos validator; a Blender film of a scene.

### Sound, film and exhibits

- A recorded sound library and recorded instruments (optional, installed on demand), the SFX shelf, a music
  department and a score book.
- Screenplay cutscenes, storyboards and animatics; actors who play roles; a camera directed in words.
- Exhibits fitted to their people and time; science views composed from laws (classical, microscopic, quantum,
  relativistic).
