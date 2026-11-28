# Architecture map

Where each part of mojulo lives, a pointer each; the target carries its own design notes. Moved here from
`CLAUDE.md`, which every agent session in this repo reads whole: this map is read when the work needs it.

Pointers only; each target carries its own design notes.

- MCP: [server.js](../control/lib/mcp/server.js), [tools/](../control/lib/mcp/tools/), [packs.js](../control/lib/mcp/packs.js).
  Claude plugin profile (`MOJULO_DISTRIBUTION=claude-plugin`): [plugin-profile.js](../control/lib/mcp/plugin-profile.js)
  and [plugin-profile-cards.js](../control/lib/mcp/plugin-profile-cards.js) hide the AI-generator handoffs, the
  keyed prompt door, automatic downloads and CDN pages; npm and source builds must stay byte-identical.
- Recipe dispatch: [sketch-manifest.js](../control/lib/graph/sketch/sketch-manifest.js) (render mode + bucket),
  [world-scene.js](../control/lib/graph/worlds/world-scene.js) (world resolution and opt-in channels),
  [world-kinds.js](../control/lib/graph/worlds/world-kinds.js) (the registry).
- Emitters: [control/lib/graph/scene/](../control/lib/graph/scene/); native frame is z-up, 1 unit = 1 m
  ([engine-score.js](../control/lib/graph/scene/engine-score.js)); each emitter owns its conversion.
  The engine handoff (`export_model { engine }`): `handoff.js` and an adapter per engine, Godot's in `handoff-godot.js`
  (a project of a world's or a game's levels), Blender's in `handoff-blender.js` (the same, built into a .blend; the art
  pack, `format: 'blender'`, stays `blender-pack.js`); Unreal's in `handoff-unreal.js` (the same, a UE5 project its
  Python importer builds; one thing by its ref stays the asset pack, `unreal-pack.js`); Unity's in `handoff-unity.js`
  (the same, a Unity 6 URP project its C# importer builds in batchmode); the registry in
  `scene/engines/`. The visual gate (`scene/visual-gate.js`, `scripts/visual-gate.mjs`) renders a level's cameras on the
  page and in each engine installed and scores each shot. Gates are advisory and need `MOJULO_GODOT` / `MOJULO_BLENDER` /
  `MOJULO_UNREAL` / `MOJULO_UNITY`; CI's `godot` job runs Godot's legs (the handoff, a humanoid's import, the visual
  gate's) on a pinned Godot; the others run locally. No outside engine runs a game: the game runtimes (Godot's,
  Roblox's, Unity's) are retired, and the web build, on mojulo's own runtime, is the game.
- The play runtime (mojulo's own engine, every game's: the world step and collision, the character controllers and the
  one jump every feel template tunes, the event bus the mechanics lower onto, navigation, mana-ui, three.js drawing; one
  source for Node and the page, `worlds/controllable/compose.js`), what sits on top, where an agent extends it and its
  gaps today: [docs/runtime.md](runtime.md). "Mojulo ships a lightweight game engine": unnamed on purpose (a part
  is named by what it is; the whole is mojulo), not a fidelity rival and not general-purpose.
- The realistic hero body (`form: 'realistic'`, the form field's slice): [docs/realistic-body.md](realistic-body.md).
  Its garments: the construction in [body-relational-tailor.js](../control/lib/graph/polygonizer/body-relational-tailor.js), the
  principles a silhouette is read by in [docs/garment-principles.md](garment-principles.md); skill: `/garment-design`.
  Played as an engine gets it (the skinned GLB, its clips and face morphs, variants bare and armoured): `/hero-live`.
- The anime face's principles (the brow never covers the eye, no line where the form carries it, drawings snap):
  [docs/anime-face-principles.md](anime-face-principles.md); its head casts (Shonen High the default; siblings by figure and theme, never by game type): `anime-styles.js`; its
  bodies (codenames, each a simplified form and a muscular form over the same base): `anime-bodies.js`, the muscles in
  `musculature/`; the socket each brow drawing carries: `anime-sockets.js`.
- What it wears: the wearable libraries [footwear/](../control/lib/graph/footwear/), [handwear/](../control/lib/graph/handwear/) and
  [plating/](../control/lib/graph/plating/) (card → passes → laws → adapter; a new look is a card): [docs/plating.md](plating.md).
  On the head, [headgear/](../control/lib/graph/headgear/): the cards (masks, cowls, eyegear, helmets, circlets and hats) worn by the hero door's
  `headgear` word, and the helmets by tradition an outfit's `language.head` wears; a new look is a card.
- Arms: [equipment/arms/](../control/lib/graph/equipment/arms/) (modern and future guns and knives for the gen-7 look: a
  model row and its builder → tunable parts → a finish card, held to the laws in `laws.js`; a new look is a finish card,
  a new archetype a model row). Manual: the `equipment` solid-vocab card; review: `scripts/render-arms.mjs`. In a
  shooter's hands a gun is its parts' boxes unless its slot asks for the arm itself (`gameworld/arms-kit.js` `armDetailed`;
  the mission and the firing range ask).
- Solids: [polygonizer/](../control/lib/graph/polygonizer/) (`field-terms.js`, `code-realm.js`,
  `field-exact.js` for `exact: true` through Manifold), [worlds/workbench.js](../control/lib/graph/worlds/workbench.js);
  manuals are the `solid-vocab/` cards. OpenSCAD both ways: [scad/scad-render.js](../control/lib/graph/scad/scad-render.js)
  (the `scad` kind, OpenSCAD-in-WASM) and [scene/scene-scad.js](../control/lib/graph/scene/scene-scad.js) (the transpiler).
- Models made elsewhere: [import/](../control/lib/graph/import/) (a file on this machine made one GLB at the door,
  `to-glb.js`; what it is by its shape, `classify.js`; a character's own skeleton read by `scene/rig-import.js`, else
  fitted onto the vajra, `autorig.js`; the machine gate, `rig-gate.js`; the `model` kind, `worlds/model.js`; the doors
  `mint_solid({ kind: 'model' })` and `create_character({ from })`, `tools/import-model.js`). Its reach against open
  files: [docs/import-corpus.md](import-corpus.md), generated by `node scripts/import-corpus.mjs --fetch`.
- Recipe book: [views/recipe-book/](../control/lib/graph/views/recipe-book/). Vocab cards: `*-vocab/` dirs.
- Retail: [retail/](../control/lib/graph/retail/) (concept cards → the `store` / `mall` kinds; a new store is a card, not code).
- Historic cultures: [historic/](../control/lib/graph/historic/) (a real place at its period → the `historic` kind and its
  encyclopedia entry); adding or deepening one: [docs/historic/README.md](historic/README.md), `/historic-culture`.
- Room furniture: [furnishings/roster.js](../control/lib/graph/furnishings/roster.js) names every piece (one row, the
  words people say, its handles into the floorplan, preset, net and room-asset tables); a new piece is a row first.
- Vehicles: [vehicle-registry/roster.js](../control/lib/graph/vehicle-registry/roster.js) names every vehicle (one row, the
  words people say, its handles into the tables that build it); the old tables are frozen behind it, every door reads a
  vehicle word through it, and a new vehicle is a row first. The shelves that build them (road, the car shelf's
  personal cars, the mecha shelf's legged frames, the craft shelf's aircraft and boats, the rail shelf), file by file:
  [docs/vehicles.md](vehicles.md).
- A track's design language: [roads/track-language.js](../control/lib/graph/roads/track-language.js) (one card says what a raced
  track is made of and how its parts are shaped: way, kerb, rail, flags, trees, sky; a kart track's chunky drawing,
  `roads/chunky-look.js`; a street circuit's town, `roads/street-frontage.js`; a mine's galleries under a hill, lit as
  a cave, `roads/mine.js`; a new map is a card), the principles a card is written by:
  [docs/track-design-principles.md](track-design-principles.md).
- Airports: [airport/](../control/lib/graph/airport/) (the transport hub's grammar laid at an airport's real figures, `plan.js`:
  piers, nose-in stands sized to the craft shelf's liners and their jet bridges, the taxiway and runway at their
  separations, the tower and hangar, each concourse a wing; drawn whole as a miniature on a plinth, `miniature.js`, or one
  wing at full scale, `wing.js`: its piers, its apron's marks, its stands' aircraft, crews and jet bridges, `jet-bridge.js`;
  the `/world` kind `airport`, minted by the transport hub's `mode: 'airport', show: 'miniature' | 'wing'`).
- Books: [book/](../control/lib/graph/book/) (the press: a style library of looks, formats and faces from the font shelf,
  one self-contained page a book, printed to PDF by headless Chromium; its drawn plates, `book/drawn-plate.js`: field-term
  forms seen from a two-point station under one light, toned in curves as a wash, an engraving or a woodcut):
  [docs/books.md](books.md).
- Publications: [publication/](../control/lib/graph/publication/) (a grimoire, a bestiary, a manual, a notebook, a comic as
  one recipe of data, its front a cover, `cover.js`, read as the press's printed book, as an open book turned a spread at a time, `reader.js`, and in a level as
  `play.library`, a shelf opened with L, `playscape/ui/library.js`; plates from the prop shelf, `props.js`, a new prop a
  row; the lorecube's manual and tree published by `from-lore.js`): [docs/publications.md](publications.md).
- Table RPG: [table-rpg/](../control/lib/graph/table-rpg/) (a pen-and-paper module played in text: rules as procedures, a
  generic starter each and no published game, portable words, the kernel a page emits; composed with the egocube, the
  live RPG, programs and the epoch map; its game book on the press; minted by `create_game({ table_rpg })`, engine
  `table-rpg`): [docs/table-rpg.md](table-rpg.md); play it with `node scripts/table-rpg.mjs`. "Tabletop" is the
  board-game type.
- Fractal structures: [fractal-structure/](../control/lib/graph/fractal-structure/) (towers from a plan, a rise, a crown and
  an echo, the `structures` world channel any kind takes; manual: the `structures` view-vocab card).
- Vegetation: [vegetation/](../control/lib/graph/vegetation/) (grown trees, palms, bamboo; pooled like `rock-pool.js`);
  read [docs/vegetation.md](vegetation.md) before changing a preset or a level of detail.
- The game book's chapters: [gameworld/chapters.js](../control/lib/graph/gameworld/chapters.js) (each page a chapter in one of
  the departments: the recipe paths, review parts, run steps and cards it owns, and the chapters it reads; a new one
  that joins no chapter fails `chapters.test.js`). `design_game`'s readout says them (`chapters`); `{ ref, chapter }`
  is one chapter's view ([gameworld/chapter-view.js](../control/lib/graph/gameworld/chapter-view.js)), a department's; the
  studio card (`gameworld-studio`, generated from the registry) teaches the agent to work them in waves.
- A game's flow (what plays when, from the first screen to the credits: screens, cinematics, levels, holds), the game
  director's page, the main agent's own: [game/flow.js](../control/lib/graph/game/flow.js) (the shape, the reader, the
  default, the kernel the play shell's flow runner inlines) and [gameworld/game-flow.js](../control/lib/graph/gameworld/game-flow.js)
  (a world's flow, the story's opening, prologue and ending placed in it, the storyboard): [docs/game-flow.md](game-flow.md).
- Game UI runtime (internal name mana-ui): [control/lib/mana-ui/](../control/lib/mana-ui/) (the one runtime playscape's UI
  words run on, so a screen is built once and not game by game: components with props passed down, the game's state
  read through bindings and never copied, a form that is a tree of data, a function that is cue effects; greybox first,
  styles a layer over it, `theme.js`, a world's guide reaching it through `playscape/ui/mana-theme.js`; a new look is a theme card in `playscape/ui/theme-cards/`, a game's `ui` dressed by the interface chapter in `playscape/ui/interface-look.js`; the shared screens and HUD parts as compositions in `idioms-*.js`, all drawn live by the
  wireframe board, `board.js`; imports nothing outside its folder; a view that reads no device: the controls layer drives
  it, `controls/mana-host.js`): [docs/mana-ui.md](mana-ui.md). Its surfaces: a designed game's title, set-up picks, pause, result, HUD and touch pad (`game/play-shell-mana.js`, `game/hud-mana.js`), the tabletop and board pages, and the RPG's battles, party menu and
  shops, a spec in `playscape/rpg/rpg-ui.js` hosted by the page's RPG channel.
- Combat: [gameworld/combat/](../control/lib/graph/gameworld/combat/) (a made game's player and foe measured on its runtime:
  movement against its feel's card, each gun's rounds to drop the foe, cone, climb, marks by matter, switching; the gym
  laid from those numbers; the combat book, `/bible?book=combat`; the firing range, `range.js`: a game being designed,
  its weapons by fire type and numbers, skins optional, measured and played before there are levels; the turret's mounts
  by class and their measures, `mount.js`, the runtime's turret `worlds/controllable/turret.js`: one gun on a mount,
  aimed by hand on any base; its rounds `ordnance.js`, what they do to matter `terminal.js`, the artillery range
  `artillery.js`, the mecha shelf's frames as its bases `frames.js`, the craft shelf's fighters `aircraft.js` and its
  helicopters and drones `rotorcraft.js` (on the runtime's `worlds/controllable/rules-hover.js`), its boats `boats.js` (on
  `worlds/controllable/rules-boat.js`, their water `scene/channels/controllable/boat-water.js`), its motorcycles
  `roadsters.js` (its cars through `artillery.js` `vehicleBase`), its page's view
  `scene/channels/controllable/turret-view.js`); the tester's spike, its findings and the grown arena are
  `control/scripts/spikes/combat-tester/`.
- Game feel: [gameworld/feel/](../control/lib/graph/gameworld/feel/) (the action lab's cards and templates, a gameworld's
  `feel` lowered onto the hero's platform rule, its suggestions, the feel book); the lab and its gate are
  `control/scripts/spikes/action-lab/` (`verify.mjs` holds the lowered rule to the lab's numbers). How a hero swings a
  blade (an arsenal's `art`: `SWORD_ARTS` in `polygonizer/hero-swing-body.js`): [docs/sword-arts.md](sword-arts.md). A game's play
  tried before its levels (the action and platform rooms, the mount lane, the firing and artillery ranges, the roll room, the work room and the game room, chosen by how
  it plays): [gameworld/practice.js](../control/lib/graph/gameworld/practice.js), [docs/practice-rooms.md](practice-rooms.md).
- Missions (a shooter's first level): [mission/](../control/lib/graph/mission/) (the firing range stretched into sections,
  each a band the world's guns are for with a task in it: the section table, the brief read from the guns, the seeded
  composition, the laws; a new section is a row) and [gameworld/mission-level.js](../control/lib/graph/gameworld/mission-level.js)
  (the level: `levels.<id>.mission`, a quick shooter's `mission`, the practice door's `mission` room; its tasks the
  `objectives` mechanic, `game/objectives.js`; its briefing, HUD, pause and debrief on mana-ui through the page's mission
  channel, `gameworld/mission-mana.js`; proved on the bus and played headless, `gameworld/mission-proof.js`):
  [docs/missions.md](missions.md). Arena maps (a fighting map as blocks on a grid, the principles of line-of-sight
  combat as laws, a generator that grows a template under them; laid as a mission's ground, `mission.map`, by `ground.js` and
  `phases.js`; a building's `fight` dials are the geocube's answer to the same laws; a town's or a city's cut read as a map, `read-town.js`; an industrial yard found under the laws, `facility.js`; a mission laid on a place the geocube builds, read off its colliders, `read-colliders.js`, `gameworld/mission-site.js`; an industrial level, a yard designed piece by piece under the laws and built by the geocube, `yard.js`, `gameworld/mission-industrial.js`):
  [arena-map/](../control/lib/graph/arena-map/), [docs/arena-maps.md](arena-maps.md). The damage ring (where a hit came from, round the aim) is its own concept,
  `gameworld/damage-ring.js`: a mission draws it on mana-ui, a quick shooter's level and a deathmatch through the page's
  damage ring channel.
- The rails and the producer's loop: [gameworld/rails.js](../control/lib/graph/gameworld/rails.js) (one row a game type,
  naming into the feel templates, genre cubes, quick goals and pixelizer games that measure it; the size call; the shape
  and a rail's sheet, served by id as `gameworld-rails` and `gameworld-rail-<id>`; the pitch, a gameworld's `rail`),
  the producer's steps and its one question in [gameworld/goalposts.js](../control/lib/graph/gameworld/goalposts.js), a
  locked pitch stored on its rail's starter level by [gameworld/pitch-start.js](../control/lib/graph/gameworld/pitch-start.js),
  and the first unit proposed to the director by [gameworld/hand-off.js](../control/lib/graph/gameworld/hand-off.js):
  [docs/zero-to-level-one.md](zero-to-level-one.md).
- The home producer (someone's own room, home, house, plans or shop, before it is made): [home/producer.js](../control/lib/graph/home/producer.js)
  (`mint_building({ start })`), its rails [home/rails.js](../control/lib/graph/home/rails.js) and what they bring
  [home/intake.js](../control/lib/graph/home/intake.js); the steps are the `home-producer` routing card's.
- The exhibit producer: [exhibit/producer.js](../control/lib/graph/exhibit/producer.js) (`create_exhibit({ start })`),
  [exhibit/scales.js](../control/lib/graph/exhibit/scales.js), [exhibit/fit.js](../control/lib/graph/exhibit/fit.js),
  [exhibit/intake.js](../control/lib/graph/exhibit/intake.js); the steps are the `exhibit-producer` routing card's.
- A game's trees (the skill tree on movement, the tech tree on spells and attacks: a world's `trees`, a node a row of
  `trees/movement.js` or `trees/techs.js`, learned at runtime by `worlds/controllable/trees.js` and on T by the trees
  channel): [gameworld/trees/](../control/lib/graph/gameworld/trees/), [docs/trees.md](trees.md).
- The metroidvania map (the spiralling box: one box of screens entered from the left, its walk spiralling ring by ring
  to a core, every ring a region against the last so a power found inside opens shortcuts out and pockets behind; its
  gates rows of `gates.js`; Vampire Sonata its template and Erina its hero, no stomp and no wall kick; a box's look a
  theme, ring by ring, `themes.js` (the castle; XenoJager's planet, `xeno-jager.js`), named by its words or by its
  level's geocube's `box` (`cube.js`; its page in the game book, `book.js`; its templates the galaxy-boy rail's box
  variants, each laid on its cube), laid by `dress.js`, its closed parts built as what they are by `fabric.js`, its
  climbs figures laid across the screen by `climbs.js`; its secret walls a gate no power opens; a world's
  `levels.<id>.metroidvania`, built as the geocube's `show: 'metroidvania'` and played on the side map's runtime, its
  gates held shut until the hero holds what opens them, `worlds/controllable/held-gates.js`; boxes of other shapes,
  `shapes.js`, joined port to port by connectors into a castle, `castle.js`, laid as one map or a map a box on the
  megaworld's chain, `segment`, her gains carried map to map by the journey):
  [gameworld/metroidvania/](../control/lib/graph/gameworld/metroidvania/), [docs/metroidvania-map.md](metroidvania-map.md).
- The platformer's rail (a mascot platformer from its feel to a first level and the flow that plays it, in two
  dimensions: `2d` the side-scroller, one strip and one turn, its home the title; `3d` opt-in, courses up a hill, a
  turn each, its home the courses screen; both on one flow shape, a start menu, a screen on its side, the
  `hilltop` theme card and the `sherbet-orchard` geocube; offered by `design_game` as `next: first-level`, never laid): [gameworld/platformer-game.js](../control/lib/graph/gameworld/platformer-game.js) over
  [gameworld/first-level.js](../control/lib/graph/gameworld/first-level.js); manual: the `gameworld-course` card. A course in
  the round is skinned by [gameworld/course-skin.js](../control/lib/graph/gameworld/course-skin.js) (floors the land's turf,
  dirt and rock; stairs and walls a geocube's stone and trim, the cube read from the level, the world or the kit). The
  land behind a side strip's lane is dressed by [docs/side-strip-principles.md](side-strip-principles.md). What makes any
  side-scroller's background good to look at (contrast, colour, composition, light, motion; the page's `ambient` channel):
  [docs/side-scroll-backgrounds.md](side-scroll-backgrounds.md); making a variation of one (a scenery, a place, a
  vista, a locale, a colour key): [docs/backdrop-variations.md](backdrop-variations.md).
- Title cards: [game/title-carve.js](../control/lib/graph/game/title-carve.js) (a HUD banner `as: 'title'`: its words carved
  by [motion/glyph-carver.js](../control/lib/motion/glyph-carver.js) into the glyph atlas the page plays, slam | rise | stamp,
  in the juice register's look; words by key in the world's `locale` from `control/messages/`: `game/title-words.js`);
  manual: the `hud-title` card. A host that cannot carve shows the banner.
- One room for a game (the game room): [gameroom/](../control/lib/graph/gameroom/) (room primitives, the brief read from the
  world, a seeded composition, the room laws, the dress by trade), played as the practice door's `room`
  (`gameworld/game-room.js`) and dressing the work room:
  [docs/game-room.md](game-room.md).
- Walled-core dungeons: [docs/walled-core-dungeon.md](walled-core-dungeon.md) (layers on a critical path toward a
  core, a `design_game` world's `wcd`; its principles as laws; a space builds its level; a military base's buildings,
  stocked by `era/stocking.js`).
- Facility pieces (a building designed to move through, not hallways and boxes): a room's floor laid in a figure,
  [era/room-layouts.js](../control/lib/graph/era/room-layouts.js) (aisles, machines, islands, stockpile, chicane, rows, each
  held to its laws; a program's `layouts`, a new figure a row), and a facility, [era/facilities.js](../control/lib/graph/era/facilities.js)
  (a use, its fighting dials, its layouts and its materials, named by a level's building or a WCD space; a new one a
  row); a core building laid larger for a third-person camera, `scale` (`era/program-core.js`, the `hall` stair); its
  crawl spaces, `vents` (`era/vents.js`); its glass and mesh, seen through and never walked through (`era/inner-windows.js`,
  the `cage` layout, `worlds/controllable/barrier.js`); their
  maps in the game book, `/bible?book=facilities` ([gameworld/facility-maps.js](../control/lib/graph/gameworld/facility-maps.js)):
  [docs/facility-pieces.md](facility-pieces.md).
- Offshore rigs (a stealth level of open decks over the sea, the facility's other pole): [offshore/](../control/lib/graph/offshore/)
  (three tiles, floor, rail and pillar, a row each in `tiles.js`, and the modules on them; a deck a map of glyphs, its
  rails and columns found, `plan.js`; its laws, `laws.js`; built over the sea, `build.js`; a new rig a row of `rigs.js`;
  drawn in the facility maps book): [docs/offshore-rigs.md](offshore-rigs.md).
- Museums and the city's other walk-ins (a civic building walked into on a page of its own: the museum's T of three
  gallery wings, its pieces things mojulo made on plinths; an arcade, a library, an aquarium's tanks, `era/aquarium.js`,
  a zoo's pens, `era/zoo.js`, a row each of `geocity/walkins.js`): the front `geocity/museum.js`, the program
  `era/programs.js` `museum`, the plinths [era/exhibits.js](../control/lib/graph/era/exhibits.js), the door
  `gameworld/levels.js` `museumDoor`: [docs/museum.md](museum.md).
- The movers (a house emptied into a moving truck: any piece lifted whole and carried in the hands, through any door, up
  and down any stair): the lifting [worlds/controllable/heave.js](../control/lib/graph/worlds/controllable/heave.js), an
  opt-in runtime builder, and its page view `scene/channels/controllable/heave-view.js`; the house `era/programs.js`
  `house` and its stock `era/stocking.js` `HOME_STOCK`; the move `game/movers-mechanics.js`; the job `gameworld/jobsified.js`
  `movers` and `gameworld/movers.js`: [docs/movers.md](movers.md).
- Room craft: [era/room-craft.js](../control/lib/graph/era/room-craft.js) (the craft laws of `era/laws.js` as the questions a room is
  asked, each with its reason and how different places answer it; a new interior answers the questions, never copies
  another kit's things; `readRoomCraft` says which a kit's card answers; the agent's card: `room-craft`).
- Networks of passages: [network/](../control/lib/graph/network/) (buildings or rooms joined by passages: `sections.js`, what
  a passage is, a new kind a row; `edges.js`, which nodes join and by what path, straight or a dog-leg; `passage.js`, one
  built to its section along its path, at its cover, level through its turns; `laws.js`; `walk-gate.js`, a payload walked
  as the page walks it). Its clients: the geocity's `under` (podiums and their concourses: `geocity/podium.js`) and a
  stage's `complex` (buildings with basements on one yard, `complex.js`; a WCD level's spaces; a campus by its name,
  `campuses.js`, a new campus a row).
- Hijack City (the open city's crime game, a starter for a GTA-like: the `hijack-city` rail and its starter,
  [gameworld/hijack-city.js](../control/lib/graph/gameworld/hijack-city.js), the `open-city-crime` genre):
  [docs/hijack-city.md](hijack-city.md).
- Quest open worlds: [docs/quest-open-world.md](quest-open-world.md) (the WCD's opposite pole: a geocity's regions
  joined sideways, never gated on the way on; a `design_game` world's `qow`; its principles as laws). The metro it is
  laid on: [geocity/](../control/lib/graph/geocity/) (the geocube's `show: 'geocity'`: major streets first, rings, roads,
  evocations at game scale, the street's kit near the camera only).
- Foes: [docs/foes.md](foes.md) (layer 0, the skeleton under every foe, and the shelves over it: behaviour, skin,
  modes, states, death; a new thing on a shelf is a row, never a foe special-cased). Their book is the cast sheet
  (`/bible?book=foes`, [gameworld/foe-cast-html.js](../control/lib/graph/gameworld/foe-cast-html.js)), and a world with
  none is proposed a cast by the casting call ([foe-casting.js](../control/lib/graph/gameworld/foe-casting.js)).
- Capital ships and stations: [fleet/](../control/lib/graph/fleet/) (the fleet's industrial-realism language, its classes and
  station kinds as rows, a builder laying each as blocks of matter; a ship read as one shape, a wedge, a concept solid
  or blobs on an anchor, `forms.js`, its volume cut into blocks and its surface clipped to them; the structures, a
  habitat cylinder, a torus station and a ring ship dressed civil or military by their `use`, `structures.js`; its
  detail the shader's parallax kibble by block, `scene/channels/hull-kibble.js`; a sortie's `capital` / `station`
  group; a procedural enemy, its named systems the targets, `systems.js`, blown up when they are gone; destructible in
  zero g, held by welds to its reactor, cut loose: [docs/rupa.md](rupa.md#in-space)).
- Space campaigns (a mission designed whole before its level is built): [campaign/](../control/lib/graph/campaign/) (the
  place, "Kessa System | Varn Cluster | Vigil Station | Moon IV", and its orrery, `theatre.js`; a mission's design, its
  laws and its compile onto a sortie, `mission.js`; the holo briefing the person approves it on, `briefing-page.js`, on
  mana-ui's campaign idioms; `node scripts/briefing.mjs rebel-storm mission-1`). The designer, `designer.js`: a world's
  `missions` drafted by the agent, edited and approved by the person on the holo table (the game's books,
  `?book=briefing&mission=<id>&edit=1`, saved through `POST /api/sketches/<ref>/missions`), an approved one laid as its
  level, briefed as it loads (`airspace.briefing`, `scene/channels/briefing.js`). Beacons (a sortie's `beacons`,
  `game/sortie.js`) are its places and triggers. Rebel Storm's rail writes its designs (`MISSION_DESIGNS`) as missions. An arcade stage is designed the same way (`stage.js`: its route, waves in formation,
  boss, points and medals), compiled onto a rail stage's `plan`; Wolf Squadron's rail writes its `STAGE_DESIGNS`. A
  ground stage's route is laid in segments (a canyon, open country, a sci-fi colony) on a route map under the flight
  sky, told over its real ground (`stage-ground.js`): [docs/flight-games.md](flight-games.md).
- Boss fights: [boss/](../control/lib/graph/boss/) (attack patterns as timelines, a tell, hazards and an opening, held to
  measured laws: told, escapable, survivable, opened; a human boss a gimmick over them in phases, a vehicle boss parts
  and states won by mechanics; a new attack, boss or vehicle a row), played by `worlds/controllable/boss.js` (and the
  mines, `mines.js`), seen by `scene/channels/controllable/boss-view.js`: [docs/boss-fights.md](boss-fights.md).
- The ground force: [groundforce/](../control/lib/graph/groundforce/) (a sci-fi army's ground units, a gun emplacement, a
  hover tank, a personnel walker, as cards of a few big shapes, the workbots' primitives in a military register, drawn
  larger than life; stood by a figures-map `unit`; an arcade stage's `ground` groups; a new unit is a card).
- Worker bots: [workbots/](../control/lib/graph/workbots/) (a toy world's worker bots in their own low-poly language: a
  few big primitives in toy colours by role, a face of two lit eyes and a mouth; a bot is a card, stood as a rig figure
  by a figures-map `workbot`; level 0's boss Bulwark is one).
- Fight levels (Mojulo Fighter, internal name versus): a fight is laid on any level by its LANE
  ([versus/versus-lane.js](../control/lib/graph/versus/versus-lane.js): where it runs, its walls, its floor, the camera's
  room); [versus/versus-levels.js](../control/lib/graph/versus/versus-levels.js) turns each kind of level into a world
  recipe and its lane (a new kind of level is a row); the runtime draws in the lane's frame. Blockouts:
  [level/greybox-scene.js](../control/lib/graph/level/greybox-scene.js).
- The cast rig (the one light every body is drawn under, in both eras): [color-theorist/cast-rig.js](../control/lib/graph/color-theorist/cast-rig.js)
  (the key the world's solved sun, the sky over the floor's bounce, the horizon's rim, a body's own gains) and the page's
  material, [scene/channels/cast-rig.js](../control/lib/graph/scene/channels/cast-rig.js) (the sky and the rim in the body's
  own shader, so they light nothing else; one key a page). Its clients: a fight's and a brawl's bodies under a register,
  the hero a player pilots on a form page, a vehicle's form body. It is light only: a body moves as its client moves it.
  [docs/hero-form-light.md](hero-form-light.md).
- The animation studio (a FILM of scenes: one cast, sets, a look, an edit; a sketch of kind `film`, its page its book):
  [film/](../control/lib/graph/film/) (the recipe, its departments and their waves, the readout, the book), the door
  `forge_motion`'s `film` and `subject.screenplay` ([tools/film.js](../control/lib/mcp/tools/film.js),
  [tools/scene-film.js](../control/lib/mcp/tools/scene-film.js): a scene's storyboard and animatic, its voice, dub and set,
  the film shot natively as a video, its Blender film pack as the high-end version; a cutscene another studio orders,
  `film/order.js`); craft in [docs/cinematics.md](cinematics.md). A camera directed in words (a shoot plan's
  framing and moves, `shoot/`; a scene's camera style, `actor/camera-styles.js`) and looked at on a contact sheet:
  `/direct`.
- The game's colour: [gameworld/colour.js](../control/lib/graph/gameworld/colour.js) (the bridge from a game to the colour
  theorist: its cast read as figures on its ground, `color-theorist/figures.js`, kept in their hue families; the ways it
  could be oriented, `color-theorist/directions.js`, each a patch; the colour book, `/bible?book=colour`; a new kind of
  figure, direction or genre decision is a row): [docs/colour.md](colour.md).
- A frame's field (Mech Battle Kai's lands, Warlords of Mars): [assault-frame/field.js](../control/lib/graph/assault-frame/field.js)
  (a geocube's own land at a mech's scale, pure terrain and no trail, read off the radar and the beacons; a frame hovers on
  its water) on the battlefield cubes, `assault-frame/geocubes.js`; its standing rock as words,
  [local-meru/massif.js](../control/lib/graph/local-meru/massif.js) (blocks stepped by one column of beds, gorges and clefts,
  talus and fallen blocks, pools and river beds; a new field is a card); its plate in the game book the operation map,
  `gameworld/frame-map.js`.
- Destructible physics (internal name rupa; `destruction: 'physical'`, opt-in, never a default):
  [rupa/](../control/lib/graph/rupa/) (matter, heat, ground) and the runtime builder
  [controllable/rupa.js](../control/lib/graph/worlds/controllable/rupa.js): [docs/rupa.md](rupa.md).
- Effects: [playscape/elements/](../control/lib/graph/playscape/elements/) (attacks, blasts, puffs, looks), raised to the style
  floor [scene/effect-style.js](../control/lib/graph/scene/effect-style.js), composed per game by
  [scene/juice-style.js](../control/lib/graph/scene/juice-style.js) (register anime | western × the game type's flavor; a
  gameworld's `juice`); the proving ground and its board are `control/scripts/spikes/effects/`.
- Broadcast: [broadcast/](../control/lib/graph/broadcast/) (the graphics over every contest and tabletop page: the packages,
  the colour theory, metal from measured reflectance, a cue per kernel call, the director's closeup; the board games in
  their own `table` furniture by `broadcast-dom.js`; a contest's or a tabletop's `broadcast` key):
  [docs/broadcast.md](broadcast.md). A new contest page feeds it or its guard test fails. It owns a sport's coverage;
  the menus around it are mana-ui's, in its look (`broadcast-mana.js`), the results read by `contest/contest-results.js`.
- The children of Sol: [sol/](../control/lib/graph/sol/) (one row per body, Mercury to Pluto and the Moon, in `roster.js`,
  its handles into the planet study `saturn-view`, a space level's worlds `planet-gen.js`, a geocube for each body with
  ground and its `light.heavens` (`era/heavens.js`), and a giant's flight over its cloud tops, an airspace's
  `sky: { world }`): [docs/sol.md](sol.md).
- Science worlds: [science-worlds/](../control/lib/graph/science-worlds/) (`classical`, `microscopic`, `quantum`, `relativistic`: a demo composed from a
  law table, model examined and dress declared; a law the scale lacks is a gap from `scales.js`, never approximated; a
  picture drawn by a shader is generated from the model's numbers and held to them by `conformance.js`).
- Beats [graph/beats/](../control/lib/graph/beats/), voice [graph/voice/](../control/lib/graph/voice/), image
  outcomes [graph/image-outcomes/](../control/lib/graph/image-outcomes/), edifice
  [architecture/edifice.js](../control/lib/graph/architecture/edifice.js).
- Game audio: the play department's sound sheet (which shelf sound plays each thing the game does, `gameworld/sound-sheet.js`,
  its book `/bible?book=sound`) and the music department's audio direction and cue sheet (the score by request, on one
  identity: `gameworld/audio-direction.js`, `gameworld/cue-sheet.js`; the recipe's `sound` and `music`): [docs/game-audio.md](game-audio.md).
- Game sounds: [sfx-shelf/](../control/lib/graph/sfx-shelf/) (the SFX library: one row per sound under the words people
  say, voiced by style, the palettes frozen behind it; recipes, never samples: cues, held voices, and families that
  build them from dials, a variation a dial point; measured on `measure.js`'s yardstick and held to `register.js`; a new
  sound is a row first, a new variation a dial value): [docs/sfx-shelf.md](sfx-shelf.md). The one opt-in exception:
  the recorded sound library ([sound-library/](../control/lib/graph/sound-library/), installed per machine, never in the
  package) voices the realistic one-shots it records, each falling back to its synthesized voice:
  [docs/sound-library.md](sound-library.md). Kits pick a thing's sounds by its axes (a new value is a row): a mobile
  suit's (`sfx-shelf/suit-sounds.js`: weight, drive, loadout) and magic's (`sfx-shelf/magic-sounds.js`: each element by
  phase and tier, statuses, spells, a battle's moments, the world's effects) and the animals' (`sfx-shelf/animal-sounds.js`:
  each species to a voice class by its family, order or name, each class's call, alert, hurt and death) and a flight's
  (`sfx-shelf/flight-sounds.js`: the kit by the pilot's rule, a trainer, an arcade fighter or a cockpit; played by
  `scene/channels/flight-audio.js`) and a boss fight's (`sfx-shelf/boss-sounds.js`: each director pattern's wind-up and
  strike, a boss's voice by what it is, a metroidvania's held gates; played by `scene/channels/boss-audio.js`), their variants
  recorded rows heard as a `standIn` (or silent) without the library.
- Underwater: [scene/channels/sea.js](../control/lib/graph/scene/channels/sea.js) (a geocube's `sea`: its land put under
  water by light alone on a gen-7 page, the air's sibling on three's fog chunk; waters and depth zones are rows, a zone
  says what the read stands on; lamps where the sun does not reach) and what grows on the bed,
  [marine/](../control/lib/graph/marine/) (a biocube's `flora.marine`: primitives in one kernel the page inlines, a roster by
  depth, mixes, a lay made as an aquarium is; the `seabed` biocube and biome; a new thing is a row, a new composition a
  mix) and who lives there (`marine/fauna.js`, a biocube's `fauna.sea`: the encyclopedia's sea animals called by depth,
  room, habitat and a pyramid, searched by `searchMarine` and `scripts/marine.mjs`, swum on loops by the walkers channel): [docs/underwater.md](underwater.md).
- Rendering docs: [docs/scene-css3d-lighting.md](scene-css3d-lighting.md),
  [docs/raymarch-effects-layer.md](raymarch-effects-layer.md), [docs/local-blender-worker.md](local-blender-worker.md).
