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

### Sixth-gen composer

- Planned: levels authored the way PS2, GameCube and Xbox levels were built. They use kit pieces on a
  grid, small painted tiles and trim sheets, two-tile vertex blends and hand-placed lights baked into
  vertex colour. The character stays slightly more detailed than the world through a measured fidelity
  ratio.
- Era card and reference moods (Devil May Cry 3, Pokémon Colosseum, Super Mario Sunshine, Metal Gear
  Solid 3) in `lib/graph/era/sixth-gen.js`.
- `measureFidelity` (`lib/graph/era/fidelity.js`): renders a z-buffer at the era's 640×448 frame from
  one camera. It reports triangles, vertices and texels per pixel for the cast and for the world, and
  the cast-to-world ratio. It is advisory only.
- New world kind `stage` (`lib/graph/era/stage.js`). It takes rooms on a grid joined by doorways and
  dresses them from a kit card. The first card, `gothic-stone`, adds plinths, cornices, pilasters,
  ceiling ribs, door frames and stone tiles. Torches are seated automatically or placed by hand. Each
  one is baked into the vertex colour of nearby corners, drawn as a sconce with a glowing flame, and
  exported as a point light in the GLB. The reference's fog becomes distance haze. The stage is walkable.
- A stage is built in three layers that never share a material: the floor, a band where floor meets wall,
  and the walls.
  - The floor is flagstone paving, a different shape from the coursed walls. It is laid one tile per
    structural bay, so its long joints line up with the pilasters, and each bay uses its own variant.
  - The band is a recessed gutter in front of the plinth, with basalt rubble from the rock pool fallen
    into it.
- New `flagstone` surface tiles (`flagstone`, `flagstone-warm`, `flagstone-slate`, four variants each).
  Square and oblong flags of mixed sizes sit on a grid, with wandering joints and worn, grimy edges.
  Some flags are cracked, and the odd one is lost to its gravel bed. Every tile edge is a joint, so
  each variant can have its own layout.
- The `gothic-nave` stage kit, with curved geometry in `lib/graph/era/gothic.js`. Pointed arches have
  real depth: a recess, reveals, a soffit and a moulded ring. Engaged columns are 10-sided. The ceiling is
  a tall pointed barrel vault with transverse ribs, a ridge rib and filled end walls. Each bay has a blind
  arcade arch, a string course, and a clerestory lancet whose glass glows and casts cool light. Torches
  stand on alternate columns.
- A stage room can leave sides `open`, a set seen from the open side for iterating on one view. The
  view is then framed from the open corner.
- First exterior stage kit: `delfino-plaza`, an open-air square (`lib/graph/era/plaza.js`).
  - Each side is a row of house fronts of different heights, giving a stepped skyline. Each house has its
    own stucco colour, a stone base band, an arched door, windows with surrounds and projecting sills,
    sometimes a balcony, and an eave over a pitched terracotta roof.
  - A raised pavement step runs along the house fronts, and the square is paved in warm flagstone bays.
- The `delfino-plaza` exterior is lit by a baked sun (`lib/graph/era/sun.js`). Each vertex is tested
  against the scene for a cast shadow, and faces that look down or sideways get a sky fill and warm
  ground bounce. It is drawn under the reference's painted sky dome.
- `trail-valley` stage kit: a nature level built to a style card. The card
  (`lib/graph/era/style/nature-trail.js`) states the art style as principles and also holds the numbers
  the builder reads. The builder (`lib/graph/era/nature.js`) makes:
  - faceted ground, with material chosen by slope;
  - a trail as a curved ribbon with grass edges;
  - a cliff of leaning rock bands with ledges, buttresses and gullies, with fallen rocks at its foot;
  - spruce trees planted in clusters;
  - red trail-marker posts;
  - ridges that fade into the fog.

  Moss, wet stains and wear are applied by cause. The scene is lit by the baked sun, and trees cast shadows.
  Each principle has an automated check, including the brightness order trail > rock > grass > foliage.
- The trail level is composed by where the eye lands. The style card names focus areas: a trailhead, and a
  boulder gate at a bend.
  - Inside a focus area, rocks are chipped (more detailed) and each one is different, grass tufts are
    fuller and denser, and two boulders frame the trail.
  - Outside, cheaper rocks and tufts repeat.
  - The trail's width and grass edges vary along its length, with pebbles along the edges.
  - Grass is instanced tufts (tussock, meadow, sedge), darkened where shade falls. Every boulder and tree
    sits on a soft contact shadow.
- The trail's cliff is now real geology on one heightfield with the valley, using mojulo's landform
  operators: a scarp, rock beds that form benches, jointed facets and a talus apron. Fallen rock lies where
  the scree came to rest.
- Debris on and beside the trail: roots surfacing from nearby trees, a fallen log with bark, sticks and
  cones, flat stones worn flush, and a puddle with wet soil around it.
- Walk mode on the trail no longer falls through the ground: the spawn is at eye height above the trail.
- The trail level's sky has weather: mojulo's cloud deck, lit by the level's sun.
- `composeCloudDeck` takes `depthClip`. With it, the deck reads the scene's depth and no longer paints over
  trees, cliffs or buildings that stand in front of it. `emitThreeWorld` gives any effect layer that asks
  for depth a shared depth pass before each render. Worlds that don't ask are unchanged.
- `jungle-trail` stage kit: a late sixth-gen jungle in the manner of Metal Gear Solid 3, built to the
  `jungle-mgs3` style card (`lib/graph/era/style/jungle-mgs3.js`) by `lib/graph/era/jungle.js`. It reuses the
  trail's ground, trail ribbon, rocks and debris, with a low mossy ravine wall and a mud trail. On it stand:
  - giant figs grown by mojulo's vegetation engine, kept for their wood (trunk, limbs, buttresses, barked near
    the trail). Their crowns are leaf cards placed at the grown tree's own leaf clusters;
  - tree ferns, fern and broadleaf understory, leaf litter on the floor, hanging vines and sagging lianas;
  - a canopy roof with holes, which opens over the trail;
  - layered walls of foliage beyond the visible area that fade into the fog.

  Detail is revealed by ring out from the trail: dense and distinct near, sparser and coarser further out,
  and only the fading walls beyond. Sunlight reaches the floor only through the canopy's holes, as dapples,
  with soft light shafts standing where it does. A filmic grade pulls every colour toward olive and sepia.
  Each principle has an automated check, including the brightness order dapples > trail > trunks > foliage
  > shade.
- The jungle trail blends into the floor. Trail, edge and floor share one mud tile mapped the same way, so
  there is no seam. The trail is told apart by brightness and wear instead: a packed, lighter centre that
  wanders out into the darker, patchier floor. Leaf litter piles along the edges, some lies on the trail,
  and twigs lie across it.
- Jungle shade is deeper, while sunlit dapples and shafts stay bright. Leaves carry their own shade: plants
  darken toward their base, crown clumps toward their undersides, and soft shadows lie under the plants
  near the trail.
- Each giant near the trail has its own bark (oak, chestnut or beech) and small ferns and broadleaf plants
  growing on its big limbs. Moss, pale lichen and dark wet streaks are applied by cause to the trunks and to
  the tree-fern trunks.
- The jungle's flora draws on mojulo's tropical plants, and twists:
  - Giants grow with stronger kinks and a stronger reach toward light, using the vegetation grower's own
    settings, so their limbs bend toward the canopy's gaps.
  - A banyan stands at the gate. Its pillar roots land on both sides of the trail, never on it, so the
    path runs between them. Each pillar wanders, flares at its foot and is braided with a thinner strand.
    Its hanging roots are curtains of a new root card.
  - Lianas wind up the trunks.
  - Clumps of mojulo's clumping bamboo stand on the wet ground at the foot of the ravine wall, with their
    foliage drawn as a new bamboo card. Culms on the wall side stand upright instead of leaning into the rock.
- The jungle takes five more principles from Snake Eater's own frames, each with a check:
  - The floor is two materials blended. A painted moss tile (`floor:moss`, `lib/graph/era/floor-tiles.js`)
    fades in over the soil at each corner. It is worn off the trail, thick in patches and in shade, and climbs
    the massive trunks.
  - The floor undulates. The style card's optional `lumps` adds mounds, hollows and banks either side of the
    trail, which sits sunk between them. Styles without it are unchanged.
  - Occasional massive trunks: low-poly boles 2.7–3.4 m across, lumpy and flared. They carry oak bark at a
    larger crack scale, buttress roots on the side away from the trail, and moss.
  - Tall grass is cards of broad blades (`card:grass`), placed where sunlight reaches the floor. It is lit
    and shaded with the rest of the scene, and walked through.
- The `trail-valley` kit takes three principles back from the jungle, each with a check:
  - One ground, two tiles. The trail ribbon and the meadow within 9 m of it share one soil, mapped the floor's
    way, so the ribbon's edge has no seam. The grass returns over it as a blend: worn off the trail, wandering
    at its edge, thinned under the spruce and in bare patches, and whole where the meadow tile takes over.
  - Foliage is painted cards. Spruces are grown (`vegetation/conifer.js`): the trunk is barked near the trail,
    and the crown is bough cards (`card:bough`) placed at the grown limbs. Cards are finer near the trail and
    coarser further off, and dark toward the trunk. Grass tufts are cards (`card:meadow`, `card:grass`) instead
    of instanced tufts, so they take the scene's light and shade. The sun falls through the cards' gaps.
  - The ground is never flat: mounds and hollows at three scales, and a bank either side of the trail. Roots
    surface in pieces instead of running as rails, and the trail's stones are its own rock.
- The `gothic-nave` kit is dressed to a style card (`lib/graph/era/style/gothic-nave.js`, dressing in
  `lib/graph/era/nave.js`), with a check for each principle:
  - Light leads, measured: glass > torchlit stone > the shafts' pools > the open floor > the vault. The vault's
    stone is darker than the shell's ceiling.
  - Each clerestory lancet facing the light throws a shaft across the nave as soft translucent sheets. Where it
    lands, a pool of light is baked into the floor. Pools are not exported as lights and leave no soot.
  - Two-tile blends by cause: moss (`floor:moss`) rises up the wall bases and fills the gutter. Grime
    (`floor:grime`, new; `lib/graph/era/floor-tiles.js` now holds the stage's painted tiles) gathers at the floor's edges and is worn off the walking line.
  - Painted cutouts, each placed for a reason: ivy spills from the string course, cobwebs sit in the angle
    between column and wall at the plinth and at the arcade's springing, and banners hang in alternate bays
    from iron rods. No two neighbouring bays are both bare.
  - A scale break at the focus: the end wall holds a great door (`portal` in `lib/graph/era/gothic.js`) in
    three stepped orders under a hood moulding, with an oak leaf banded in iron. It rises half again the
    arcade's height, with an oculus (`oculus`) above it and a torch on each flank.
  - The ceiling is its own material: the vault's web is plaster painted night-blue with gilt stars
    (`vault:stars`), flaked where damp has lifted it, between the stone ribs.
  - The floor is not the walls' grid: a runner of hexagonal tiles (`floor:hex`) down the walking line between
    slate kerbs, and irregular flags with no two alike (`floor:incertum`, opus incertum) either side.
  `gothic-stone` and `delfino-plaza` are unchanged.
- `card` and `crossed` (one painted card, and cards crossed about a vertical axis) move to
  `lib/graph/era/geom.js`, and `dice` is exported from `lib/graph/era/nature.js`, shared by the trail and the
  jungle. The jungle's output is unchanged.
- `emitThreeWorld` draws faces marked `blend: true` in their own translucent pass: a second texture faded in
  per corner by `cornerAlpha`, multiplied by the baked colour, drawn over the surface beneath it without
  flickering. This is the era's two-tile vertex blend. Worlds without blend faces are unchanged.
- Leaf cards (`lib/graph/era/leaf-cards.js`): painted RGBA leaf textures (`card:broadleaf`, `card:fern`,
  `card:spray`, `card:vine`, `card:litter`, `card:roots`, `card:bamboo`, `card:grass`, `card:bough`,
  `card:meadow`, `card:ivy`, `card:cobweb`, `card:banner`), resolved through the surface-texture registry. New
  `encodePngRgba` in `lib/graph/landscape/surface-textures.js`.
- `emitThreeWorld` takes `cutouts`, a list of texture keys whose alpha is cut out (alpha-tested). Those
  surfaces drop their clear texels, including from the depth pass, and are not walk colliders, so foliage
  is walked through. Worlds that don't pass it are unchanged.
- `makeSunShadow` takes `maskOf`, so a cutout card blocks the sun only where its texture is opaque.
- Dirt is baked into the vertex colour by cause (`lib/graph/era/dirt.js`):
  - soot above torches;
  - streaks under the cornice;
  - damp wall bases;
  - a worn walking path and grimy floor edges.

  The recipe's `dirt` scales each cause. Baked ambient occlusion is on for the `stage` kind.

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
