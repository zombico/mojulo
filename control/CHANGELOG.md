# Changelog

All notable changes to the `mojulo` npm package are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
From `3.0.0` the media, game, connected-service and app loops and the recipe
format are the stable surface, and the chatbot factory is no longer part of
mojulo. From `3.1.0` the connected-service and app tools are no longer listed:
they still answer by name (the CLI, plan steps, skills that name them). The dashboard package, `mojulo-ui`, is released at the same version.
Releases up to 2.1.0, and the detailed log behind 3.0.0, are archived in
[CHANGELOG-2.x.md](CHANGELOG-2.x.md); the detailed log behind 3.1.1 is
[CHANGELOG-3.1.md](CHANGELOG-3.1.md).

## [Unreleased]

### Level age and crystals: a cube's metal tells its age, its land grows crystals

- **`materials: { age }`.** A cube's materials take an age, `new`, `worn`, `old` or `ancient`: copper, brass and bronze
  tarnish brown and then turn verdigris green by their measured film law, and steel dulls and then blackens to forged
  scale. The painted tone of each aged group follows, so the toon light, the paint and the live metal agree. A group the
  cube names ages too, unless it names its own film or finish. Gold does not age. Absent, metal is bright, as before.
- **Armour cards name their materials.** A style card's `materials` says what its pieces are made of where its
  family's table would be wrong: `grim-scifi`'s trim is blasted steel, `armored-hero`'s faceplate brushed stainless, the
  rest of a hardsuit painted. They are worn only on a level that names `materials`, under the level's own overrides and
  age, so sci-fi heroes now take live metal, the cube's light and its age where their designer said metal.
- **Creatures wear their level's materials.** A creature names its level beside its plan (`spec: { plan, geocube }`, or
  `update_character { geocube }`). Where the cube names `materials`, its horn, hoof, beak and shell take a satin gloss,
  its outfit's metal and leather theirs, and its plan's own `materials` (as an armour card's) say the rest, all at the
  cube's age. A creature keeps its character light, so its materials are drawn: a metal steps higher, shades darker
  and glints. A creature's tones are its parts' tints. Absent a level, a creature is as before.
- **A level's cloth and leather are painted.** On a level that names `materials`, a figure's cloth (its top and
  trousers, its outfit's cloth roles, a stylist's garments) takes the bake's painted `cloth` finish, deep in its folds
  and darker toward its hem, and its leather the `leather` finish, a low sheen with its edges rubbed lighter. A group a
  material dresses (metal, satin, glass, rubber) is left to it, and so is every other group. A figure with its own
  `bake` keeps it; the character light keeps its own look. A plain hero is dressed too.
- **Cloths.** `linen`, `cotton`, `canvas`, `wool`, `felt`, `denim`, `silk`, `velvet`, `nylon`, `polymer`, `carbon weave`,
  `ballistic nylon` and the alien `membrane`, `spun filament`, `resin weave` are materials. On a figure each is painted
  its own way: wool soft with no ridge, denim faded pale at its ridges, silk a sheen band toward the sky, velvet dark in
  its body and bright at its rims. Under the character light they are drawn: silk a soft sheen, velvet deep and more in
  shade, wool a soft step, denim a cool shade, the synthetics a small sheen. A stylist's hero wears its genre's cloths
  on its top, trousers and outer layer (fantasy linen and wool, modern cotton, denim and nylon), and a cube names one
  for a group (`materials: { Top: 'velvet', Outer: 'silk' }`). Anywhere a material is taken, a cloth word now resolves
  to its shelf row.
- **`outside.crystals`.** A cube's island grows crystals: `'amethyst'`, or `{ gem, where: 'crags' | 'hollows', count,
  size, glow, seed }`. Seeded clusters stand out of the cliff faces or sit in the land's hollows, off the trail and the
  seam. They are real gems (the crystal channel shades them live, each throwing its own light, and the GLB carries them
  as see-through). Absent, the land is as before.

### Look materials: armour as material, metal in the cube's light

- **`materials` on a geocube.** A hero whose `geocube` names a cube with `materials` wears real materials on its armour,
  outfit and dress: plate as brushed steel, a lamellar's kanamono as gold, leather as leather, a hardsuit as painted
  satin, each metal group's metal read from the tone its card already wrote. `materials: { <group>: <material> }`
  overrides one. Plate then shades as live metal on the World page, in its clips too (the rig pack carries the metal
  channel per part), and exports as PBR. Absent, every hero is as before.
- **Anime heroes draw their materials.** Under the character light (an anime hero whose manifest names `toon.light`)
  the materials are drawn, not reflected: metal steps higher and shades darker (gold leaning red-orange, steel blue)
  with a small gloss tinted by the metal's measured colour, lacquer takes a small sharp gloss, leather a warm shade and
  a dull band, glass a white glint, rubber a deeper shade (`materials/toon-materials.js`). Such a hero wears no live
  metal. An anime hero in the cube's cast light wears the live metal as any hero does.
- **`contrast.metal`: metal in the cube's light.** Metal faces take the cube's occlusion (the foot of a wall, a crease,
  contact) as a multiplier the live metal shader and the GLB carry, and the live metal reflects the cube's own world
  (its sky over a daylit dome, its ground leaned toward grey) instead of the studio's dim room. A hero on such a cube
  takes it on its metal alone. Absent, metal is shaded as it was. `upland-morning` turns both on.

### Sixth-gen land: ground, mix, facets, valley

Four opt-in words on a local meru (and a geocube's outside), each absent unless asked, so every cube and stage
renders byte-identically without them.

- **`ground`: a terrain world under the level.** `meru.ground` / geocube `outside.ground` takes a painted scene
  (`{ from: { heartbeat, splatch, seed }, span, height, at }`) through the `terrain` kind's field (its landform,
  erosion and fracture detail) and lays it under the plain: its lowest point under the level is the datum, its range
  scaled to `height`, eased in from the seam. The island's geology still reads only the mounds and the high shore as
  raised land.
- **`shading.mix`: surfaces mixed per corner.** Each corner takes rock, grass and sand by how much of each lies round
  it, spread `mix` metres and drawn back to a soft, noisy edge, on both sides of a seam: grass meets rock in a curve,
  not in the grid's steps.
- **`shading.facet`: rock in planes.** The rock's grid heights are drawn onto facet planes about `facet` metres wide
  before the land is lit, so a cliff reads as planes of stone instead of a checkerboard of half-metre quads; the
  grass's corners stay where they are.
- **`island.seabed: 'merged'`: the flat seabed in large quads.** Past the beach an island's floor is one plane under
  deep water, yet it was drawn in the land's half-metre quads and was most of the faces. Merged, it is a few dozen
  quads: the upland island goes from 31,944 faces to 10,395 and builds in under half the time, its renders matching the
  grid's to within 13/255 on 0.04% of pixels. `'grid'` (the default) draws it as before.
- **`upland-morning`, a geocube preset with them on.** Valley-morning's look (its colours, light and contrast) on a
  rocky upland: a `rocky-irregular` ground at 45 m and 3.5 m, mix, facet and valley. Its island merges its seabed. The shipped presets are unchanged.
  The geocube card took an `outside` line naming relief, ground and the land words (its ceiling re-pinned 4000 → 4600).
- **`shading.valley`: the sky a hollow loses.** The foot of a slope, a hollow and a gully darken toward the shade by
  how much sky the land round them hides, read over tens of metres and beyond what an even slope of the same grade
  hides.

### Perlin spike: relief for the geocube land

- **One noise module.** `lib/graph/noise/noise.js`: 2D gradient noise on the terrain kernel's integer hash and
  8-direction table (the same values as `terrain-kernel.js gn`), its analytic gradient, fractal sums in four flavours
  (`fbm`, `ridged`, `billow`, `damped`: detail suppressed where the slope is already steep, the eroded look) with
  octaves rotated off the lattice, domain warp and terraces. Only + − × ÷, floor and imul on the height path, so a
  field is the same in every engine.
- **`relief` on a geocube's outside.** `outside.relief` (and `outside.terrains.<name>.relief`) names a relief card
  (`rolling`, `craggy`, `eroded`, `terraced`, `dune`) or `{ from, …changes }`; the stage's meru carries it and the
  local meru lays it on the plain under the seam fade. On an island it only lifts the plain (a hollow would drown the
  grass in beach), and where the island draws its mountain as land (`walk: 'base'`) it runs up the mounds too, so the
  geology breaks already-broken ground. Octaves are set in metres, not by the mesh. A cube without relief lowers and
  renders byte-identically. The geocube routing card names the word.
- **Grain in the vertex.** The relief's octaves finer than the land's cells go to colour only, filtered over each
  corner's footprint (`relief.grain`), so the polygon land's light carries detail its geometry cannot.

## [3.1.1] - 2026-10-16

The first published release of the 3.1 line. `mojulo` 3.1.0 reached npm from a stale build of 2026-10-10 and is
deprecated (npm refuses to unpublish a package others depend on); no `mojulo-ui` 3.1.0 exists. Where this changelog
and the code say 3.1.0 for a change, it first ships here.

3.1 turns mojulo toward games: a sentence becomes a playable game in a named genre, with its own world, its own
people and its own look, played in the browser, shipped as a desktop app or exported to an engine. The detailed
log behind this summary, theme by theme, is [CHANGELOG-3.1.md](CHANGELOG-3.1.md).

### Upgrading from 3.0

- **Update the Claude plugin.** It runs `npx -y mojulo@3.1.1`; an unpinned `npx -y mojulo` moves to 3.1.1 once it
  is npm `latest`. `mojulo-ui` 3.1.1 is the matching dashboard. No new Node requirement and no new dependency.
- **Retired from the tool list, still callable by name**, so a plan step, script or skill that names one keeps
  working:
  - the office wing: apps, runtime daemons, the contextmap, mcp-orbit, triggers and primitive binding
    (`pack_runtime`, `pack_connected_services`; see `RETIRED_PACKS` in `lib/mcp/packs.js`);
  - game projects (`create_game_project` and its siblings): a game's home is its gameworld, through `design_game`;
  - `create_shoot_plan` and `update_shoot_plan`: a shoot plan is `forge_motion({ shoot })`.
- **The dashboard is view-only.** The copy-prompt buttons and the in-page edits (folders, gallery, stash) are gone;
  `/apps`, `/mcp-skills`, `/map` and `/graph` are removed, and `/maker` redirects home. Sign-in and Settings stay.
- **Stored rows that render differently** (the exceptions to byte-identical re-render):
  - **Heroes** get a structured midsection by default; `core: 'streamlined'` restores the 3.0 body byte for byte.
  - **Houses, stores, restaurants and malls** were the mirror image of their plans in the World and every export;
    they are now built the way the plan reads. House floors are muted. SVG stills were mirrored too and are now
    right-handed.
  - **The default animals'** silhouettes and proportions are retuned; a minted animal redraws on its next read.
- **The recipe book ships inside the package.** `MOJULO_RECIPE_BOOK` and the separate `mojulo-recipe-book` repo are
  deprecated: a clone still loads and warns at boot, until 4.0. `MOJULO_BUNDLED_BOOK=off` detaches the bundled book.
- **Every recipe records the mojulo version** that minted it and that last edited it.

### Games

- **The doors.** `design_game` makes a game: `quick: { goal }` for a genre in one call, `compose: { prompt }` for a
  whole gameworld from a sentence, or the full gameworld (world bible, character book, levels). `create_game`
  audits it; `export_game` ships it.
- **Genres** (`quick.goal`):
  - **Fighting game:** a side-view one-on-one fighter, local two-player, on 3D arena stages; every fighter is a
    character the character loop designs.
  - **RPG battles:** turn-based fights, a party of up to four switchable classes against groups of foes, with
    battle effects.
  - **Arena shooter:** deathmatch and team deathmatch against bots, first person or over the shoulder; the arena is
    made from words and one dial runs from realistic to stylized. Also a cover shooter along a trail.
  - **Racing:** a kart racer on a loop against rival drivers, and supercars on the grid (any paint, liveries, race
    moods, night driving). A true-scale divided freeway is the first piece of a driving world.
  - **Flight:** a flight sim (fly the ring gates and land), and air combat or a space shooter (`shoot` with a
    `craft`), on one flight model; craft are assembled from a shelf of aircraft and spacecraft parts.
  - **Also:** reach, collect, survive, avoid, sneak (guards and sightlines), rhythm, defend (tower defence), puzzle
    (block pushing) and farm.
- **Levels and places.** Buildings and room kits play as levels (a house, a store, a school, a crypt); a city is
  planned on a board and played as levels; towns, fixed-camera walkmesh scenes, and chapters of the same world over
  time.
- **What a game carries:** stats, inventory and shops, front menus, a cover and credits, scenes and two characters
  talking, a story bound to its world, weather, destruction, beams and explosions, and a soundtrack scored per level
  with action sounds.
- **Where it plays.** A browser shell runs title, levels and result. `export_game({ target: 'desktop' })` packs it
  as a desktop app with one seam for a store (Steam, GOG, Epic); mojulo ships no store SDK and uploads nothing.
  The Godot pack carries the event bus, combat and looks, and is the most complete engine translation.
- **What can be made next.** The cosmos cube describes a game as six facets, and its sweep measures what the builder
  can and cannot make yet ([docs/tool-surface/hillclimb.md](../docs/tool-surface/hillclimb.md)).

### Characters

- **`create_character`** (`as: 'hero' | 'creature' | 'animal'`) is the first door; `update_character` revises any
  part.
- **Each game's own people.** The Egocube rolls a cast from a game's setting and era: modern and future gear,
  mascots that walk as well as drive, and a palette that keeps its world's era.
- **The look.** An anime hero can be drawn painterly, with a painted face that animates. A stylism solver works
  silhouette, then value, then detail. Clothes fit the body, armour and creature apparel read as what they are,
  hair grows as locks, and light is painted onto the surface. Each character is drawn for its target screen.
- **Motion.** Showcase poses, ready stances, strikes, sitting and rising, vaults and carrying on the hero door, and
  a walk calibrated against measured human gait.
- **Animals.** Sea creatures, insects and other arthropods that move, behaviours said once and done per species,
  and an encyclopedia entry per species.

### Worlds and the look

- **The geocube** is a level's look as data. The color theorist solves its palette from what the world is
  for (land, sky, HUD and cover from one solve), and vertex contrast lights the whole world.
- **Stage kits** in the sixth-gen manner: an isekai meadow, bamboo and sakura groves, a research lab and night, with
  live grass, wind, fire and water.
- **Historic cultures** as walkable `historic` worlds from cited records, with period music and people: Sumer,
  Hellenistic Lindos, Qin Xianyang, Pompeii and Giza. Later eras through the same historic solver.
- **Buildings.** The `interior` kind furnishes one room of a house; houses gain finishes and composed or true-size
  furniture; a structure book documents a house, store, restaurant, mall or school.

### Making things

- **Solids.** The fabricator resolves a part's job from a shelf of standard parts and sizes it; `measure_solid`
  reads strength (bending, tension, print infill); mechanisms move with mass and friction; the `scad` kind gains a
  pinned library for threads, gears and text, and warns where they used to fail silently. Exploded views and teardowns.
- **Asset receipts.** `sign_asset` and `verify_asset` sign an exported file with a per-install creator key.
- **Audio, film and diagrams.** Orchestral strings and brass, a robot-rock style card; a world's shoot plan and a
  Blender film pack from `forge_motion`; flow charts lay themselves out.

### The agent's surface

- **One door per intent.** A new capability is an argument and a routing card on the tool that owns its intent,
  not a new listed tool. A pack opens to a menu; `create_sketch` and `cook` list routing only and read their manuals
  on demand. A routing eval with a held-out set measures where requests land.
- **Model tiering.** An agent task names how much judgment it needs (`ride`, `fill`, `judge`, `design`), never a
  model.
- **Self-description.** Mojulo describes itself by what it makes: things to Play, Print, Read, Hear and Observe.

### For contributors

- Test tiers: `test:critical` is quick again, the game and world suites that walk levels in headless Chrome are
  `test:e2e`, and range sweeps are `*.deep.test.js`. A test picks one case per procedure, never a whole catalog.

## [3.0.0] - 2026-10-01

### Upgrading from 2.x

- **3.0.0 is the release after 2.1.0.** A 2.2 was prepared and never published; everything it carried
  is in this release. Removing the chatbot factory is why this is a major version.
- **Node 22.14 or newer.** 2.x asked for 22.12, but on Node 22.12 and 22.13 the database library
  (better-sqlite3) crashes the process the first time it opens the database, with no message; 2.1.0
  crashes the same way. 3.0 checks the version at start-up and says which Node to install.
- **The 2.x line is unmaintained.** No 2.x release will be patched, and running one is not
  recommended. 2.1.0 and the bot image it deploys (`mojulo-bot` 0.5.1) have known security issues: an
  open relay on deployed bots (`/api/send-webhook`), SSRF in `upload_document_from_url`, path
  traversal in the Office-document parser, Fly credentials in the machine environment, dashboard DNS
  rebinding and cross-site writes, a revoked delegate's dashboard session that outlives the
  revocation, a delegate's dashboard session that holds the operator's authority, and an
  `update_sketch` patch that reaches the prototype chain
  ([SECURITY.md](https://github.com/zombico/mojulo/blob/v3.0.0/SECURITY.md#known-issues-in-2x)). Bots
  already deployed from 2.x run on their own, on that image, until you take them down.
- **Unpinned installs move to 3.0 on their next start once 3.0.0 is npm `latest`.** A host that runs
  `npx -y mojulo` (every config 2.x `mojulo init` wrote, the README's manual lines, and the Claude
  plugin up to 2.0.1) installs 3.0.0 on its next start, whether or not the plugin was updated. The
  3.0 plugin runs `npx -y mojulo@3.0.0`; update it, and remove any `mojulo init` or `claude mcp add`
  registration beside it (two registrations run two servers). Exact pins and a global
  `npm i -g mojulo` stay on their version until you change them. The first start downloads about
  79 MB (the package and its dependencies); if the host gives up, start Claude Code with
  `MCP_TIMEOUT=60000`, or run `npx -y mojulo@3.0.0 --help` once in a terminal. Restart every host
  afterwards so no 2.x server keeps running against the same `~/.mojulo`.
- **Saved provider keys become unreadable to 2.x.** With `API_KEY_ENCRYPTION_KEY` unset (the
  default), the first time a 3.0 process reads saved keys (`mojulo-config`, `list` included;
  `mojulo init`'s key prompt; the dashboard's key settings; `mint_solid` `via:'prompt'` without an
  inline `apiKey`), it re-encrypts every key a 2.x install saved, the Fly token included, under a
  per-install key at `$MOJULO_HOME/secret.key`. 2.x cannot decrypt them after that; the change is
  one way. **Back up `secret.key` together with the database:** without it 3.0 cannot read the keys
  either.
- **What left, and what it left behind.** The chatbot factory is no longer part of mojulo as of 3.0
  and is moving to its own project. Earlier 2.x versions that include it are unmaintained and have
  known security issues. Its tools, packs and dashboard pages are not in 3.0; calling one of its
  tools, `mojulo install chatbot` or an `artifact_materialization` commit does nothing and answers
  with that notice. Its tables (`deployments`, `modular_sessions`, `mcp_jobs`) and their rows, and the
  `packs/chatbot` marker, stay in `~/.mojulo`, inert: 3.0 does not use them, and you may delete them.
  **`~/.mojulo/data/artifacts/` holds each old bot's `.env` with its provider key in plain text:
  delete it.**
- **Downloaded helpers and draft figure specs move out of the npx cache.** 2.1.0 kept Chrome for
  Testing, ffmpeg, gallery stills, turntable strips and draft figure specs inside its package folder;
  3.0 keeps them under `$MOJULO_HOME`. An unpinned upgrade replaces that folder, so they are not
  carried over; pending figure specs are lost unless another version's npx folder still holds them
  (3.0 copies those across once). The browser (now build 154) is no longer fetched in the
  background: with no browser installed, gallery thumbnails stay blank until one is available (an
  installed one, `MOJULO_CHROMIUM`, or, outside the Claude plugin build, an explicit render's
  download).
  @puppeteer/browsers 3 has no proxy support, so a host behind an HTTP proxy sets `MOJULO_CHROMIUM`.
- **Other changes a 2.x setup can notice.**
  - `mojulo init` changes nothing without `--yes` when stdin is not a terminal: it prints its plan and
    exits 2. With the Claude plugin installed it leaves Claude Code to the plugin.
  - The dashboard is its own package, `mojulo-ui` (`npx -y mojulo-ui`); `npx -y -p mojulo mojulo-ui`
    downloads the matching version on first use (`MOJULO_UI_NO_FETCH=1` refuses). It answers 403 to
    a `Host` other than loopback, `MOJULO_UI_HOST` or a name in `MOJULO_UI_ALLOWED_HOSTS`, and to a
    cross-site write, so a LAN, proxy or tunnel setup needs `MOJULO_UI_ALLOWED_HOSTS`.
  - `mint_solid` `via:'prompt'` requires `provider`: nothing chooses the provider for you any more.
    The key is `apiKey`, the saved key named by `apiKeyId`, or else your saved key for the provider
    you name.
  - Exported World pages are self-contained by default again (`world.html`, no third-party fetch);
    `cdn: true` writes `world.cdn.html`, and `world.offline.html` is no longer written.
  - Stored `floorplan` and `condo-complex` rows that relied on the old room defaults re-render
    roomier, and the furnish pass doors sealed rooms, parks interior doors open against the wall and
    moves wall pieces out of a door's way
    ([Room livability](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#room-livability),
    [Furniture audit](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#furniture-audit)).
  - `chatbot` or `ops` in `MOJULO_PACKS` is ignored, so `MOJULO_PACKS=chatbot` alone now leaves the
    creative tools on.
  - `MOJULO_MCP_TELEMETRY=off` stops only the local tool-call log, no longer the tool timeout, and
    `MOJULO_MCP_TOOL_TIMEOUT_MS` can raise a tool's budget but not lower it. Render tools get 600 s.
  - `mojulo install creative` installs nothing (the creative pack always ships), and
    `mojulo install recall` now works from npm and npx. With the runtime already installed and the
    search model missing, it fetches the model instead of reporting nothing to do.
  - A delegate (roles pack) signed in to the dashboard reads and no longer writes (below).
  - A city minted from now on wears the round street kit (below); stored cities are unchanged, and
    `elements: { roundKit: false }` keeps the block kit.
  - A material object whose `metal` is a name (`{ metal: 'steel', finish: 'brushed' }`) is a metal
    surface (below); beside `base` or `preset` it is refused. The shelf's numeric `metal: 1` is
    unchanged.

### What 3.0 is

- **A 3D compiler for agents.** Your agent builds objects, walkable worlds and games by conversation
  as small deterministic recipes on your machine, compiled back to the same geometry (byte for byte on
  the same platform) and exported to STL / 3MF, glTF, OpenUSD, IFC4, self-contained HTML, Godot,
  Blender, Unity and Unreal. The bot factory, which never fit that, is gone.

### Determinism

- **What "the same geometry" means.** A recipe compiles to the same geometry every time: byte for byte
  on the same platform (OS, CPU and Node version), and to within floating-point rounding on any other.
  V8's `Math` is not one function everywhere: its arm64 builds round `sin`, `cos`, `exp`, `atan2` and the
  rest differently from x64, and since Node 24 `Math.pow` and `**` call the platform's C library. An
  embedded texture PNG can also differ in its compressed bytes between Node builds (Homebrew's Node links
  a different zlib), never in its pixels.
- **3.0's generators go further.** The vegetation engine, terrain worlds, the anime head and hero, stores
  and construction, metro and canal cities, the metro refacade and the Tian Tan Buddha take their
  transcendental functions from a deterministic math module (fdlibm in plain double arithmetic), so their
  pinned outputs are the same bytes on Linux and macOS, x64 and arm64, Node 22 and 24, and CI checks them
  on every runner. The older helpers they reach switch to it only inside a 3.0 build, so nothing minted
  with 2.x changes. A few older helpers still use the engine's `Math` (specular shading, sRGB conversion,
  some textures, roads, the metro World's walkers and cars).

### Lean install

- **3.0.0 against the published 2.1.0, one method.** A cold start with an empty npm cache and a
  fresh `HOME` and `MOJULO_HOME` (`npm exec --package=<tarball> -- mojulo`) through a local registry
  stand-in, timed from spawn to the `initialize` answer, on one macOS arm64 machine (M1 Max). Sizes
  are decimal MB; the installed and downloaded rows include the package itself, and "downloaded" is
  the unique tarballs plus the package metadata, estimated gzipped.

  | | 2.1.0 | 3.0.0 |
  |---|---|---|
  | npm tarball | 31.2 MB | 6.7 MB |
  | Unpacked package | 121.7 MB | 21.3 MB |
  | Installed, package and dependencies | 539 MB, 426 packages | 227 MB, 153 packages |
  | Downloaded on a cold start, package included | about 182 MB | about 79 MB |
  | Cold start to `initialize`, median (p90) | 12.7 s (15.7 s), 14 runs | 4.5 s (4.6 s), 6 runs |

- **Machine caveat.** The two timings come from separate sessions on a busy machine: 2.1.0 on
  2026-09-27 (load average 3 to 12), 3.0.0 on 2026-09-30 (7 to 11). In the 3.0.0 session, runs of a
  pre-release 3.0 candidate interleaved with the release's took a median 6.1 s: the release installs
  one copy of sharp instead of two, 26 packages fewer. Trust the sizes more than the seconds, and
  expect the real registry to be slower than the stand-in. npm also keeps the downloaded tarballs in
  its cache, about 140 MB for 3.0.0. 2.1.0's package carried the dashboard build; 3.0.0's dashboard
  is `mojulo-ui` (12.7 MB packed, 57.0 MB unpacked), fetched only when it is opened.
- **The package never carries a local content pack.** A tarball or `mojulo-ui` build made from a
  checkout holding the operator-local mobile-suit content pack carried it; the package file list
  leaves it out, a test fails any tarball carrying a gitignored file, and the dashboard build refuses
  such a checkout. A clean install no longer prints warnings about that absent pack.
- **What left the install:** the dashboard build, `@swc/core`, `three`, the dashboard-only libraries,
  `dotenv`, and the chatbot factory's `officeparser` and `pdf2json`. puppeteer-core, archiver and
  react load on first use, so the stdio server boots without them. Details:
  [docs/tech-requirements.md](https://github.com/zombico/mojulo/blob/v3.0.0/docs/tech-requirements.md),
  [Lean cold start](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#lean-cold-start).

### Security and consent

- Saved provider keys are encrypted under a random per-install key (`$MOJULO_HOME/secret.key`, mode
  0600) instead of a constant in the source. The dashboard refuses DNS-rebinding and cross-site
  requests. `mint_solid` `via:'prompt'` never chooses the LLM provider for the caller: `provider` is
  required, and the key is `apiKey`, the saved key `apiKeyId` names, or the caller's saved key for
  that provider.
- Chrome for Testing downloads only for an explicit render and says so (never under the Claude
  plugin, below); headless Chromium keeps its sandbox (on Linux it falls back only on Chrome's
  sandbox errors or as root); the ffmpeg download is SHA-256 pinned; everything mojulo writes lazily
  lands under `~/.mojulo`.
- `mojulo init` needs `--yes` when nobody is at a keyboard. "No telemetry" is now "no external
  telemetry", with the local tool-call log described. Core has no Docker, Fly, GHCR, webhook or
  uploaded-document code path.
  ([Security hardening](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#security-hardening),
  [Runtime footprint and consent](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#runtime-footprint-and-consent))
- **Revoking a delegate's key now ends their dashboard session on their next request.** Before, the
  dashboard checked only a session's signature and 7-day cookie expiry. A delegate (roles pack) whose
  key was revoked with `revoke_role_key`, had expired, or had its token epoch bumped could keep using
  the dashboard until the cookie ran out, even though their MCP bearer had already stopped working.
  Such a session now gets the same 401 on `/api/*` and redirect to `/login` as no session, and with
  the roles pack off a delegate session is refused outright. The dashboard middleware now runs on the
  Node runtime so it can make this check. The operator's own session, installs with login off, and
  installs without the roles pack make no database read.
- **A delegate's dashboard session is read-only.** No dashboard route checks a role, a grant or a
  flag, so on 2.x a signed-in delegate held the operator's authority there, whatever the role
  granted: deleting the operator's saved keys, writing an app's `.env` and starting the app, deleting
  sketches. A live delegate session now reads pages and the API, and gets 403 (`DELEGATE_READ_ONLY`)
  on every write and on the settings API. The roles pack's grants still bind the delegate's MCP key;
  the operator's session is unchanged.

- **sharp 0.35.5.** The image library moves past high-severity advisories in its bundled libvips and
  libheif (GHSA-f88m-g3jw-g9cj, GHSA-rgj7-g3m4-5g8c), and `mojulo-ui` no longer carries the older copy
  Next.js keeps for `next/image`, which the dashboard never imports. An image submitted for a render
  that does not decode is refused at submit.
- **A patch cannot reach the prototype chain.** An `update_sketch` patch path through `__proto__` or
  `constructor/prototype` set or deleted a property on every object in the server process until it
  restarted. Such a path, or the same key in a set-by-id merge, now refuses by name.

### Claude plugin and directory readiness

- Every tool carries a `title` and behavior `annotations`, `initialize` negotiates `2025-06-18`,
  `2025-03-26` or `2024-11-05`, and the Claude plugin pins `npx -y mojulo@3.0.0`
  ([annotations](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#mcp-tool-annotations-and-protocol-negotiation),
  [disclosure](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#directory-listing-and-disclosure)).
- **The Claude plugin build.** When the Claude plugin starts mojulo, it leaves out the handoff tools
  for AI image, voice and mesh generators. That covers the image-render and mesh handoffs, the voice
  registers, sprite sheets, style presets, the skin op, the painted sketch kinds, the painted cover
  title, `forge_motion`'s scene and cel sources, the character-from-dream figure specs and a
  figure's `dream_audit`, and the image-driven catalysts. The vocab cards and catalysts it keeps are
  served without their lines about those loops. It also leaves out the keyed
  `mint_solid via:'prompt'` door (use `via:'packet'`) and every automatic download:
  - renders use a Chrome, Chromium, Edge or Brave you already have, or `MOJULO_CHROMIUM`;
  - MP4 encodes use an ffmpeg you already have, or `MOJULO_FFMPEG`;
  - the search model arrives only through `install recall`.

  Exported World and game pages are always self-contained there: `cdn: true` is ignored, and the
  result says so. The host adapter cards are served without their image-generator and CDN lines, and
  the MCP Apps preview is not offered. A call to a tool the plugin build leaves out answers in-band.
  Installs from npm or a checkout are unchanged.
- **The plugin listing.** It is rewritten for 3.0 with three example prompts that work in the plugin
  build, a table of what it installs, fetches, runs and writes, a privacy policy link, an "Upgrading
  from 2.x" note, and an icon.

### Hosts

- **ChatGPT.** Its own adapter card (`get_adapter({ id: 'chatgpt' })`) and handoff profile, for
  connected MCP and for a shell-enabled Work box. A separate ChatGPT skills package
  ([plugins/mojulo-chatgpt](https://github.com/zombico/mojulo/blob/v3.0.0/plugins/mojulo-chatgpt/README.md))
  prefers connected MCP and otherwise sets up a pinned, workspace-local CLI in the box. Handoff notes
  keep a file on the MCP server apart from a file in the session, and promise no attachment or inline
  preview the session has not shown. Codex is no longer recognized by the bare OpenAI vendor name.
- **Meta Muse.** A host profile and adapter card for the shell-only agent on its own persistent Linux
  VM, where `npx mojulo call` is the whole surface and `MOJULO_HOST=muse` names its doors: pages leave
  through its Artifacts, files through its Library. A bundle export's `<ref>.courier.html` lists the
  export's files under `outcomes/<ref>/`, each with a Save where the viewer allows it, so one HTML page
  can deliver any of them. A host profile
  may name its own page words (`pageVerb`, `pageTool`, `pageOpensIn`), what its page door does with
  inline scripts (`inlinePage`), and a `drop-folder` file door.
- **`MOJULO_HOST`** picks the adapter card on the CLI, for `get_adapter`, catalyst composition and
  recommendations, when no client identity says which host is calling. An explicit adapter id or a
  recognized client still wins.
- **Recipe recovery.** `create_sketch` accepts an exported world recipe and passes it through the same
  validation and ledger stamp as `update_sketch`, so a recipe carried out of a temporary box comes back
  as it left, a hero with its hand edits. A duplicate ref refuses, and referenced assets must already
  exist.
- **MCP Apps preview, opt-in.** With `MOJULO_MCP_APPS=1`, `preview_world` shows an inline mesh
  snapshot of a stored ref in a host that supports MCP Apps; the exported HTML stays the full world.
  Nothing is hosted publicly.

### Dashboard package

- **The dashboard is its own npm package, `mojulo-ui`,** published at the same version as `mojulo`
  and depending on exactly that version. `npx -y mojulo-ui` starts it; core's `mojulo-ui` command
  runs the matching package or downloads it after saying so. It has no bot pages. Both packages
  carry LICENSE and NOTICE, and the dashboard lists every package it redistributes in
  `THIRD_PARTY_NOTICES.md`
  ([Dashboard package](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#dashboard-package)).

### Creative work

- **Characters and heroes:** the hero as a core form with a create-hero loop and tunes kept as the
  record, fitted landmark heads with a face tune and a hair library, the ring plan and creature loop,
  planar humanoids, and worn things that follow the dials
  ([Create hero](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#create-hero),
  [Hero detail](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#hero-detail),
  [Hero tune](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#hero-tune),
  [Fitted heads](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#fitted-heads),
  [Face tune](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#face-tune),
  [Hair library](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#hair-library),
  [Ring plan](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#ring-plan),
  [Planar detail](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#planar-detail),
  [Planar humanoid](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#planar-humanoid),
  [Read and attach](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#read-and-attach)).
  The hero also wears the Anime Form Studio's head (`head: 'anime'`) on anime proportions, with
  fitted hair forms, looks as composable words, a graphic face and neck, a character light with
  designed shadow shapes, draw layers and clips at the door; its skinned GLB and Godot pack carry the
  face. Worn armour (plate, samurai lamellar and hard-suits, with themes carried down a suit) and held
  gear with swings ride the hero door
  ([layered manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/solid-vocab/layered.md),
  [designing a hero](https://github.com/zombico/mojulo/blob/v3.0.0/docs/examples/humanoid/DESIGNING.md)).
- **Arms, metal and gems:** swords, daggers, greatswords, staves, bows and shields composed from a few
  dials and laws, pattern-welded blades included (`mint_solid` kind `equipment`); metal as a surface
  any part, facade, roof or trim can wear (a metal, a finish and an oxide film), reflected on the World
  page and kept in glTF and USD; gems with their optics and exact light prints, and crystals as light
  operators in worlds, performed in Godot
  ([equipment manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/solid-vocab/equipment.md),
  [workbench manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/solid-vocab/workbench.md)).
- **Cities and worlds:** metro and canal profiles for the fractal city, redrawn landmarks and sacred
  buildings, stores and malls from concept cards, and large cities streamed by tile
  ([City scale](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#city-scale),
  [Canal city](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#canal-city),
  [Local city refacade](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#local-city-refacade),
  [Retail concept cards](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#retail-concept-cards),
  [World streaming](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#world-streaming)).
  New cities wear a round street kit: lamps, poles, bins, bollards, piers, playground frames and
  rooftop equipment drawn round, a few of them in metal.
- **Interiors:** houses minted in a style, livable default room sizes, and a furniture audit that
  gives every room a way in
  ([House styles](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#house-styles),
  [Room livability](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#room-livability),
  [Furniture audit](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#furniture-audit)).
- **Buildings and furniture:** timber from a synthetic log, steel sections, reinforced concrete and
  masonry, joined by Western and Japanese joinery through the exact kernel and checked, never refused;
  houses framed, lined and wired by their building tradition, carrying a building model with a
  takeoff; tile roofs and drainage; houses exported as IFC4 (`export_model` `format: 'ifc'`); house
  design checks that measure the walkways, with a repair; furniture built from sheet goods and
  fittings (carcasses, tables, chairs, sofas with upholstery and cloth from a weave draft), checked for
  sag, racking and tipping, with wordless assembly manuals; and the built pieces placed in rooms and
  condos ([floor plan manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/sketch-vocab/floor-plan.md),
  [workbench manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/solid-vocab/workbench.md)).
- **Terrain and nature:** a painted landscape made real-scale ground you walk, fly and orbit, up to a
  small planet, or a world composed from features (a river, a range, a lake, a volcano, a coast) sized
  on real-world bands, with fractal cities sited on its hills; plants grown rather than drawn (trees by
  their architecture, palms, bamboo, figs and conifers), standing as forests where the ground is
  painted wood, and grass; rocks built from their minerals, and landforms and erosion on painted
  landscapes ([terrain manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/views/view-vocab/terrain.md),
  [vegetation](https://github.com/zombico/mojulo/blob/v3.0.0/docs/vegetation.md)).
- **Look and drawing:** shading normals from the hull, outlines and rims carried into Godot, Unity
  and Unreal, key-and-fill art direction, and the `layered` kind drawn from its compiled mesh, with
  rigs and clips
  ([Shader look](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#shader-look),
  [Art direction](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#art-direction),
  [Planar drawing](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#planar-drawing)).
  A line drawn on a `layered` solid becomes a recipe op (a silhouette solves the shape dials, a
  contour becomes a ridge strip, a brush a dial), with the share of the line it could not hold.
- **Audio:** stereo and per-hit variation, tuned strings, orchestral scoring and era synths, and
  anthem and roots song styles, all synthesized from formulas and opt-in
  ([Audio fidelity](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#audio-fidelity),
  [Orchestra and era synthesis](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#orchestra-and-era-synthesis),
  [Anthem styles](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#anthem-styles),
  [Roots styles](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#roots-styles)).

2.1.0 and earlier releases, and the detailed log behind this release, are in
[CHANGELOG-2.x.md](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md).
