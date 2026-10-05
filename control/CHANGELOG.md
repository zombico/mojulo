# Changelog

All notable changes to the `mojulo` npm package are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
From `3.0.0` the media, game, connected-service and app loops and the recipe
format are the stable surface, and the chatbot factory is no longer part of
mojulo. The dashboard package, `mojulo-ui`, is released at the same version.
Releases up to 2.1.0, and the detailed log behind 3.0.0, are archived in
[CHANGELOG-2.x.md](CHANGELOG-2.x.md).

## [Unreleased]

### Historic city

- **In progress.** A historic city becomes its own generator rather than a setting of the metro city,
  built one period at a time from the first cities of Sumer toward the present. A period is read as a
  composition of shared visual patterns (sun-dried earth, flat-roofed cubes, courtyard houses, stepped
  platforms, niched walls, towered ring walls, canals through town), so later cultures reuse them.
- The town is built in two steps. The layout claims ground and asks for buildings by slot: the
  ziggurat site, each house lot facing its lane, each wall run, tower and gate facing out. A per-period
  asset kit builds each slot on its own random stream, so redesigning one building moves nothing else.
  Each kit asset is designed from a massing sheet dreamed on the optional local image worker, then
  rebuilt as plain masses; the sheet is a design aid and is never stored. Until an asset is designed, a
  plain placeholder stands in its slot. The metro city is unchanged.
- Mud brick leans: walls, towers, tiers and platforms are battered, stairs climb on slopes, and the
  reed hall is a round vault. The ground is surfaced for street level — beaten mud alleys, rubble and
  sherd main streets, baked-brick quays, precinct and courts, cracked dry earth outside the wall — and
  the page opens on a street view or a view from the precinct court as well as from the air. Palms are
  low-poly date palms, which cut a whole town's page to about a quarter of its size.
- A town carries its art and its street life. The shared vocabulary gains art (votive figures,
  stelae, door emblems, guardian beasts, friezes, mosaic skins, ritual vessels, altars) and street
  structures (wells, kilns, granaries, boats), each noted where it recurs across cultures, and the
  layout places them by meaning: offerings, guardians and the altar on the sacred axis at the
  ziggurat's stair, the goddess's reed posts at her doors, stelae inside the precinct gate, worshippers
  facing the god, wells where lanes meet, kilns under the wall, granaries by the precinct, boats at the
  quays. Sumer's set includes the cone-mosaic Pillar Hall of Uruk, copper bulls, the Uruk vase and a
  temple portal with its cattle frieze and lion-headed eagle. Round, domed and hooped forms are new
  building blocks.
- Each asset can be drawn as an SVG blueprint from its own parts before it is rendered: front and side
  elevations, plan, dimensions, a parts table and build notes, so a design is checked in pure geometry
  first and the drawing never drifts from the model.
- Walls show what they are made of. A transparent material layer rides over each wall's own lit
  colour, so sun and shade are kept: bare mud brick with a herringbone course on the city wall and the
  platforms, baked brick in dark bitumen joints on the ziggurat's casing, mud render on the houses
  (rain streaks, a fallen patch, the courses showing through where the foot of the wall has worn), and
  lime whitewash with hairline cracks on the temples and pale houses. Each culture says which mass
  wears which material. The coursing is pinned to world height, so neighbouring faces line up. The
  layer shows in the CSS 3D page only; the WebGL World keeps flat colour for now.
- The town can be walked. A loose grid of narrow alleys runs between the blocks, so every house
  fronts a lane and no block is more than two houses deep (before, about a third of the houses had no
  way in), and each house stands a little in from its lot so neighbours read as separate buildings.
- The sacred precinct has room: it is larger, kept clear of the wall's towers, and its temples stand
  by measured clearance from the ziggurat and its long front stair instead of crowding them.
- The canal is a smooth channel sunk below the town between baked-brick embankments, with one quay
  strip along each bank and nothing laid over it. Where a main street crosses, a humped brick bridge
  climbs by stairs over a corbelled opening high enough for a reed boat's horns, and the boats float
  on the water. A canal view looks along the quay at the middle bridge.
- Brick walls read as brick in the walkable World as well as the page: bolder courses with relief,
  the reed-mat layers Sumerian builders laid between courses, a stamped course in the baked brick,
  and a share of houses left as bare brick instead of mud render.
- A second culture, New Kingdom Thebes, on the same template: the Nile along the town, the temple
  of Amun on an axis from its river quay through an avenue of sphinxes, obelisks and colossi, a
  pylon, a court and a hypostyle hall to the sanctuary, a sacred lake, and an unwalled town of
  mudbrick houses and villas. Each culture now brings its own layout; the grid, alleys, house lots
  and slot placement are shared.
- Thebes' temple walls show figures drawn to the Egyptian canon instead of one repeated group: the
  king in the blue crown making offerings to Amun, Mut, Khonsu and Ra-Horakhty, each god with their
  own crown and emblems, in a set of different ritual scenes with hieroglyph captions and
  cartouches. Each wall gets whole registers of scenes, and every scene faces into the temple; each
  pylon tower shows one smiting scene, centred, with the god standing by the gate.
- Thebes' ram-headed sphinxes are modelled in rounded forms instead of blocks: a barrel back,
  rounded shoulders and haunch, forelegs rising into the chest, a ram's head with a long sloping nose
  and horns curled round the ears, on a moulded pedestal. Small carved parts on every asset no longer
  show a jagged fringe at their edges.
- A third culture, Old Kingdom Giza (c. 2515 BCE, under Menkaure), shows the pyramids as they looked
  new: cased smooth in white limestone to the apex, Khafre's foot in red granite, Menkaure's lower
  casing in undressed granite. Each pyramid stands on its court with a mortuary temple on its east
  face, and a causeway runs down to a valley temple on a harbour. The site also has:
  - the Great Sphinx in its quarry, with no beard yet, and its temple before it;
  - Khufu's queens' pyramids and boat pits;
  - mastaba tombs laid out in streets;
  - the Wall of the Crow and the workers' town of galleries, bakeries and houses;
  - ships bringing stone along the canal.
  It is the first site on a raised plateau: the ground falls from the desert down an escarpment to the
  floodplain, and slanted faces now turn and lift with their asset.
- Giza at work: Khufu's and Khafre's satellite pyramids, and Menkaure's temples as a building site with
  stacked blocks, a mud-brick ramp and loaded sledges. The main quarry stands south of Khafre, stepped
  down from its rim, and Tura limestone sits stacked on the quays. Each capstone is plain limestone, as
  the one found at Giza is; `pyramidion: 'electrum'` gilds them as a labelled conjecture, since gilded
  capstones are attested only from the 5th Dynasty on. New views: the building site, and beside the
  Great Pyramid's apex.

### Historic countryside

- **In progress.** A historic city gains sub-scenes for what its people could make and grow, beside
  what they built: the first is the countryside that fed Sumer. A branch canal leads water through
  baked-brick sluices into channels on low banks, with long strip fields between them. Off in the
  fields stands a farmstead: a house round a walled yard (bread oven, reed shade, a ground loom), a
  blind storehouse filled from roof hatches up an end stair (the barn of a dry country), a stable of
  piers and mangers, a reed byre with ringed reed posts through its roof and its dairy jars, a
  reed-fenced sheepfold, a round threshing floor, a tool shed, a shaduf on the canal bank and a palm
  garden.
- The tools are the period's own. An ard plough (a seeder with its funnel in the sowing season),
  clay sickles (Sumer reaped with sickles; the scythe is Iron Age), hoes, mattocks and winnowing
  shovels, a two-wheeled cart and a four-wheeled wagon on solid three-plank wheels, a threshing
  sledge, grain heaps sealed in mud, measures, baskets and jars.
- The scene keeps to a season, because a Sumerian year kept the work apart. At harvest (the default)
  the barley stands and is being cut, sheaves are stooked and carted and the threshing floor is
  busy, while a fallow strip is broken with the plain ard. At sowing the seeder plough is in the
  furrow and the fields are furrowed and sprouting. Fields show as furrows, sown rows, stubble and
  standing barley. The page opens from the air, in the yard, at the threshing floor, at the edge of
  the reaping, or by the plough.
- Tools and buildings only, at rest: people and beasts are left to their own builders, so a plough
  stands with its yoke on the ground, a cart with its pole down, the pens and stalls empty.
- Each piece cites its record, every gap reported. A beam (a straight timber at any slope) joins the
  angled building blocks. Small faces no longer stretch along their length when they are sealed
  against hairline gaps; before, a long roof edge overshot its building by up to a third, in the
  town too.
- A second sub-scene shows the works: how Sumer made its tools and its building stuff, and from
  what. The plain had clay, reed, water and palm, and no stone, ore or tall timber.
  - Its quarry is a clay pit sunk into the plain by a canal. Beside it are treading pits with straw
    for temper, a moulding field of fresh bricks drying in rows (the wooden mould left at the end of
    the last row), stacked hacks, and an updraft brick kiln with its fuel, ash and baked bricks.
  - The potters have a shade over the wheel, greenware drying, stacks of bevelled-rim bowls,
    settling tanks, a wasters heap and the town's beehive kilns.
  - A landing takes in what the plain lacked: stone, basalt querns and flint, with a knapping
    floor. Bitumen boilers cook mastic beside it.
  - The forge is a coppersmiths' yard. Ingots smelted at the mines are melted there in crucibles on
    bowl hearths blown with reed pipes, then cast in stone moulds and finished at an anvil stone.
    Charcoal clamps burn beside it.
  - A wheelwright makes the carts' three-plank wheels.
  - The reed cutters stack and plait at the marsh.
  - The page opens from the air, or at eye level in the brickyard, the forge, the potters', the
    landing, the clay pit or the wheelwright's.
- A slanted panel now turns with its piece, so pieces can carry sloping faces like a pit's cut
  sides. A roof on posts draws its underside.
- A third scene sets the city in its land. The walled town stands in the middle and its canal runs
  on past the walls both ways. Around it the land is zoned by what each place needs:
  - Upstream: the brick and pottery quarter on both banks (clay pits, brick fields and kilns,
    potters' yards).
  - Below the town: the harbour (kar), with its quays and boats, merchants' storehouses, bitumen
    boilers, and the coppersmiths with their charcoal clamps.
  - Along the levees by the walls: palm gardens.
  - North and south: strip fields on their channels, with a farmstead in each quarter.
  - Where the canal runs out: the reed marsh. On the steppe at the edge: sheepfolds.
  - The page opens from the air, from low over the quarter or the harbour, or at eye level in the
    fields, at the harbour or by the kilns.
  - From the air the small things (jars, tools, fence posts) are left out. An eye-level page
    carries only its own view: it leaves out what is behind the camera and draws the ground only to
    about 220 m. Drawing a whole land's ground at that detail runs the page out of texture memory.
- The town can be planned without its own fields and palms outside the walls, and gives the line of
  its canal, so a larger scene can carry the canal on.
- Egypt gets the same sub-scenes, at the date of the Thebes town (about 1250 BCE): a countryside
  and its works, built from Egypt's own tools and buildings.
  - Kept from Sumer: the clay pit, the treading pits, the brick field and the hacks. Egypt made
    brick the same way and did not fire it, so there is no brick kiln.
  - The farm ploughs with a horn-yoked ard and broadcasts its seed. It reaps high with flint-toothed
    wooden sickles, and carries the grain off in rope nets and donkey panniers rather than carts.
  - The cattle trample the threshing floor inside its kerb. Scribes measure the grain under a shade,
    and it is stored in a court of domed silos. The A-shaped hoe sits in the tool shed.
  - Newer things Egypt had: an upright loom, a vineyard on forked-post pergolas with its treading vat,
    pottery beehives, and checkerboard garden beds by a shaduf pool.
  - A third season: the inundation, with the basins under water.
  - The works:
    - a sandstone quarry face with stepped benches and blocks freed by trenches and wedges;
    - sledges on wetted sleepers bringing blocks to a masons' yard, where a colossus stands in its
      scaffold;
    - a stone quay with a barge carrying a granite block;
    - a foundry blown by trodden pot bellows, with oxhide ingots;
    - a glass and faience works;
    - carpenters sawing a plank lashed to a post;
    - a chariot shop making spoked wheels;
    - a boatyard with a plank hull on stocks;
    - the potters' tall kilns and bread moulds;
    - papyrus works by the marsh.
  - The farm opens from the air, in the yard, at the threshing floor, at the reaping, by the plough
    or over the flooded basins. The works open from the air, or at eye level at the quarry face, on
    the sledge road, in the masons' yard, the foundry, on the quay, in the boatyard, the glass works,
    the chariot shop, the brickyard or the potters'.
  - Each piece cites its record, every gap reported.
- The farm's eye-level views (Sumer's too) cut the ground finer near the camera, so it no longer
  drops out in front of the eye.

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
