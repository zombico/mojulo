# Changelog

All notable changes to the `mojulo` npm package are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
From `1.0.0`, the five paradigm loops and the recipe format are the stable
surface (see "The 1.0 contract" below); the bundled bot image stays pinned
exact per control-plane version. From `2.0.0` the chatbot factory is an opt-in
pack (`mojulo install chatbot`) and the studio is the default read; the five
loops and the recipe format are unchanged.

## [Unreleased]

### House compose language

A Claude session on the web asked for a house on 2026-09-22, opened `pack_object` (no house), opened
`pack_world` (no house), read the edifice card and shipped an institutional block. The house was there
the whole time: `create_sketch { manifest: { kind: 'floorplan' } }`, homed in `pack_diagram` behind a
description about flowcharts. Its report called that "a routing bug, not a capability gap". This theme
makes the product match that report point for point.

- **A HOUSE row in `forward_context`'s mint dispatch** (house / apartment / cottage / townhouse /
  office floor plan / one furnished room → `create_sketch` kind `floorplan`); BUILDING now says
  edifice is the institutional one-off and a dwelling is HOUSE; PICTURE says a picture OF a house
  is `sketch_what_possible`'s `architecturalConstruction`. The world and diagram form drawers, the
  `compose_world`, `mint_solid` and `create_sketch` descriptions, and the `pack_world` /
  `pack_object` / `pack_diagram` recognizers each carry the same one-line pointer. A `house`
  routing card and two fixture rows back the retrieval hop.
- **`storeys: N` on a floorplan manifest** (alias `floors`) stacks the plate N high with a stair
  between consecutive floors — the shorthand the reporter reached for and found silently dropped.
  It lowers to the existing `levels[]` stack at render time; the recipe stays one field. Absent or
  `1` renders byte-identical. A non-integer refuses with the card pointer.
- **The floor-plan card shows the real call** — `create_sketch({ title, manifest: { kind:
  'floorplan', … } })` — instead of the flat form that cost the reporter four attempts, documents
  `storeys` and the authored `levels[]` stack (roles, per-level seed / rooms / height, `stairs`,
  `tier`, `explode`), and names `export_model({ lit: true })` as the lit handoff. README §3 shows the
  same call.
- **The Blender worker scripts ship.** `blender-bake`, `bake-world-gi` (and their `.py` halves) and
  `export-blender` are in the npm package's `files`, and `mojulo script <name> [args…]` runs one from
  the installed package root, so the card's command works where `scripts/` is inside the npx cache.
  The card, the render-bay re-bake prompt and the Blender worker doc name both doors.

### Release tooling

- **The README install-success smoke (CI) no longer fetches a control-plane model.** `scripts/smoke.sh`
  ran `npm run fetch-models` and asserted the ONNX file, which 2.0.7 made impossible on a bare clone
  (the runtime is the opt-in `recall` group) and failed the first CI run after the tag. The control
  half of the smoke now asserts the opposite on Linux: no runtime or model in the tree, `mojulo call
  version` answers, and `semantic_search` answers lexically with three routing cards. The bot
  runtime's own model check (lite-template) is unchanged. `fetch-embed-model.js` prints one line with
  the install line instead of a stack trace when the group is absent.

## [2.0.7] - 2026-09-21

The hosted-host release. A Claude cloud sandbox drove 2.0.6 end to end on 2026-09-21 (a 47-part phone
at true scale, exported as glTF) and reported the two things that blocked a clean first run: the
embedding runtime's install step needs a host the sandbox's proxy refuses, and `init` waits on a
keyboard that is not there. Both are gone. Nothing changes for a desktop install except that it is a
third smaller.

### Init on a host with no keyboard

- **`npx mojulo init` takes its defaults when stdin is not a terminal.** CI, a pipe, an agent driving
  the install or `</dev/null` used to hang at the first prompt and then die with exit 13 and a Node
  "unsettled top-level await" warning when stdin closed. Now a non-TTY stdin is announced once and
  behaves like `--yes` (`--no-ui` and `--print` compose as before); a terminal that closes mid-prompt
  exits with one plain line instead of the internals warning.

### Recall

- **The embedding model is an opt-in install group.** `@huggingface/transformers` (and with it
  `onnxruntime-node`, `onnxruntime-web`, the ~130 MB lazy model) leaves the package's dependencies.
  `mojulo install recall` installs the runtime into `~/.mojulo/recall/` (its own `package.json` and an
  `entry.mjs` shim; it survives package upgrades the way `~/.mojulo/models/` does) and fetches the model;
  `--remove` takes it away. `mojulo install chatbot` installs recall first, because the bot-builder preview
  RAG must behave like the deployed bot. `MOJULO_PACKS=recall` is the manual override, as for the other groups.
- **`semantic_search` works without it.** The index is now a lexical search (SQLite FTS5, trigram
  tokenizer, already inside `better-sqlite3`) over the same rows whenever the recall group is absent;
  with the group present it is the vector search it was. One path or the other, never a blend. Results
  carry `mode: 'vector' | 'lexical'`; a lexical `score` is the share of query terms the row contains, so
  the weak-match hint keeps its threshold. The index self-populates on the first search of a fresh
  install (text only, no model), so a cold CLI process answers on its first call. Query in English; the
  host translates the operator's ask before the first tool call. Measured: the routing fixture lands its
  entry tool in the top 3 for 32 of 34 phrasings through the lexical path (pinned at 85 % in
  `embeddings-lexical.test.js`; the vector gate in `routing-eval.integration.test.js` now needs the group).
- **Text-only rows.** `meta_embeddings.embedding` is nullable (existing DBs are rebuilt in place, rows
  preserved). A row whose vector could not be produced is still indexed by text; installing recall later
  backfills the vectors on the next boot.
- **`sharp` is an optionalDependency in its own right** (it used to arrive through the embedder) and
  stays part of the creative group; `sharp-lazy.js` already tolerates its absence.
- **Boot and status.** The bins no longer preload a model that is not installed; the settings
  embeddings-status route reports the group state and the install line; `smoke:tarball` runs the cold
  install without the group and asserts a lexical `semantic_search` result, and `--with-recall` installs
  the group into the temp dir first. Measured by that gate on macOS arm64: tarball 30 MB, unpacked 116 MB,
  `node_modules` 472 MB (2.0.6: ~775 MB), about 590 MB total against 885 MB before.
- **`adm-zip` is a devDependency.** The docker deployer test imported it while it arrived through
  `onnxruntime-node`; it is declared now that the runtime is gone.

### Release tooling

- **`npm run smoke:tarball` parses `npm pack --json` past prepack's own stdout.** Under the current npm
  the Next build banner lands in front of the JSON and the smoke died at the first step with
  "Unexpected token '▲'"; it now parses from the last array-opening line. The gate then passed with
  both WASM kernels in the tree, and a scad row and an exact cut minted, exported and rendered
  (`/world`, `/scene`, STL, GLB, PNG) through the fresh install's CLI and dashboard.

### Routing

- **Two routing cards learn the words the fixture uses.** The world card's When line gains "a little
  town I can wander around" and the motion-waypoints card gains "can the player get from the door to
  the goal": the two phrasings the lexical path missed on the routing fixture were both absent from
  the card vocabulary rather than mis-ranked.
- **The illustration pack names the graphic novel.** Its recognizer gains the anchor 'a graphic novel I
  click through page by page', so "present the graphic novel like a slideshow I click through" routes
  to the sketch packs again instead of sitting a few thousandths behind the game and motion packs (it
  had missed on the committed descriptions since before the OpenSCAD work; the eval is max-over-anchors,
  so a pack without a matching quote loses to any pack with a near one).

### OpenSCAD front door

- **`exact: true` on a `fields` entry or a `cuts` entry composes it with Manifold** (the boolean kernel
  under OpenSCAD 2025, already an optional creative dependency) instead of the surface-net grid: a bore
  has a sharp lip and a 12-unit disc measures 12 in `/world`, the `.glb`, the engine packs and the print,
  with no OpenSCAD in the loop. Reach: the nine field shapes, `add` / `subtract` / `intersect` without
  `blend`, `transform`, `repeat`; anything else (blend, stroke, displace, shell, round, expr, harmonic
  lathe, warps) is refused at mint by name. `segments` (8–256, default 48) facets curved primitives.
  Opt-in: every existing row renders byte for byte. Absent the package, the mint refuses with the install
  line. The kernel loads at the async seams (mint, world resolve, the scene route) before the synchronous
  lowering: the mint, the edit (`update_sketch`), the world resolve, the scene route, the SVG control
  scaffold, `capture_reference` and the scad mint, each only when the recipe wants exact. The
  `export_model` ledger reads an exact cut as `exact` with `edge_rounding: 0` (no grid, no rounding).
  Routing copy no longer says a sharp edge needs OpenSCAD.
- **Fixed: `export_model union: true` never found Manifold under the dashboard server.** `manifold-3d`
  is ESM-only, and Next's server bundle turned the literal `import()` into a `require()` Node refuses
  (`ERR_PACKAGE_PATH_NOT_EXPORTED`), so the union reported the package missing under `next dev` and the
  standalone server while the CLI and tests had it. The loader now falls back to the runtime's own
  import when the bundler's require is refused (the same fix the `scad` kind's loader carries).

- **`update_sketch` on a `scad` row answers with a readout.** The edit pays `planScad`'s gates as at
  mint (the fence, the parts contract, the embedded fields' audit, OpenSCAD's own errors), re-stamps
  the ledger, and hands back the readout: `changed` (the default for a `patch`) lists the parts by
  NAME that are new, moved, or named by a `/parts/<name>` op, plus new warnings and OpenSCAD log lines;
  `summary` and `full` as on the workbench. Before this an edited scad row re-resolved but returned no
  stats.
- **OpenSCAD's default colours never reach the World.** Its OFF writer paints uncoloured geometry in
  the preview scheme's yellow and the faces an uncoloured cutter leaves in its green; both now land as
  the card promised — the neutral grey, and in a one-colour part the cut faces wear that colour (a
  coloured body carved by a bare `mojulo_field()` stays the body's colour). The card also says how
  two overlapping parts weld for the print: `export_model { union: true }`, which already does.
- **The docs say what the doors do now.** The README's examples include a part written in OpenSCAD,
  the tour and the formats tables list `.scad` beside the print formats, and the substrate drawer,
  tech-requirements and the OpenSCAD worker doc no longer say a sampled field cannot give a sharp edge
  or that the round trip ends at OpenSCAD. The workbench card shows the shaped-cutter idiom (a nested
  sub-solid, subtracted) a D-bore needs.
- **`mint_solid kind:'scad'`: an OpenSCAD program IS the recipe.** `spec.source` is stored verbatim and
  meshed on every read by OpenSCAD itself, running in-process as WebAssembly (`openscad-wasm-prebuilt`,
  a new optional creative dep, same posture as `manifold-3d`; OpenSCAD 2025.01.19, Manifold backend,
  version pinned in the ledger). The mesh is the ordinary face list, so the object rides the workbench
  studio (`/world`, `/scene`, `facing`, `grid`, `movers`), every export leg (`.glb`, engines, USD, STL,
  3MF at true size — `units` defaults to mm) and the gates unchanged. `color()` is the tint; `parts`
  (`{ name: 'module();' }`) render each part as its own group so a hinge can swing it; `include` /
  `use` / `import()` / `surface()` are refused at mint (the recipe carries its own geometry). Absent the
  package, the mint refuses with the install line. `export_model format:'scad'` on a `scad` row returns
  the source verbatim (one exact term, nothing frozen). Card: `get_solid_vocab({ id: 'scad' })`; routing
  card `scad-object`. Existing workbench rows are untouched. Why: measured on the iPhone Duo block-in,
  the same object in OpenSCAD reads at about half the tokens of the workbench manifest, needs no
  14k-token card, renders in 0.2 s, and its booleans are exact.
- **`mojulo_field("<id>")` inside a scad source.** A `scad` spec may carry `fields` (the workbench's
  field entries, each with an `id`); the program reaches one as `mojulo_field("<id>")`, a module mojulo
  prepends holding that field baked as a `polyhedron()`. Blends, strokes, noise, expressions and warps
  stay mojulo's; the exact CSG around them is OpenSCAD's. A field whose surface net is not a
  2-manifold (a heavy `displace`) is refused at mint with the edge counts, because OpenSCAD's kernel
  would drop it from a boolean silently; and any OpenSCAD `ERROR` line fails a scad render even when a
  file was written.
- **`bind_mesh_render` takes a `.stl` or `.3mf` at `glb_path`.** The file is read into the standard
  face list (3MF `basematerials` colour and build transforms kept; an STL binds grey) and written as
  the GLB the bind stores, so an OpenSCAD or slicer-side part comes home as a bound mesh and places in
  any world via `meshRef`. The result carries `converted_from`. A GLB path behaves exactly as before.
- **The scad still is legible.** The CSS-3D scene and gallery PNG of a `scad` row fold coplanar
  triangles into one clipped panel per flat region (holes via an `evenodd` clip); the World and every
  export keep OpenSCAD's triangles.
- **Fixed: `export_model format:'scad'` dropped every stadium.** A rounded rect whose side equals `2r`
  (a pill button, a USB-C port, a camera plateau) transpiled to `offset(r) square([w, 0])`, a zero-area
  polygon OpenSCAD discards silently while the coverage ledger still counted the term exact; the Duo
  lost seven of twenty-three parts. Such a profile now emits as a `hull()` of circles (a disc as one
  `circle`). Non-degenerate profiles emit byte-for-byte as before. The OpenSCAD gate on the Duo agrees
  on every axis again.
- **Workbench mint stores `movers`, `grid` and `toon` from the spec.** The card documented all three as
  top-level spec keys but `mint_solid kind:'workbench'` / `'code'` dropped them; only an `update_sketch`
  patch could store a hinge. Absent, byte-identical.

### Mover ease: the magnetic latch

- `movers[].ease` on a states toggle (turn or slide). Absent → the smoothstep every existing recipe rides,
  byte-identical. `'snap'` (or `{ snap, gap }`) eases the part out to a hover just short of the detent, then
  accelerates the last stretch in — a lid clicking shut, a foldable closing on its magnets. An array is read
  by the state arrived at (`['snap', null]`: click into state 0, plain into state 1). Documented on the
  workbench card. The mover channel block's emitted bytes change, so the `emit-channels.char` hashes for the
  mover fixtures are re-pinned in the same change.

### Library performance

- **Changed: `GET /api/sketches` ships summaries, not manifests.** The Library's Scenes shelf was a
  62 MB JSON body on a workshop of ~3,000 sketches, because every `controllable` row stores its baked
  `faces` inline (up to 3.7 MB each) and the list route sent all of it for the browser to parse and hold.
  A list row now carries `ref, title, kind, renderMode, bucket, bucketOverride, createdAt, folderRef`, the
  badge facts the shelves actually read (`facts: { seed, giBake, giAdapter, game, audio }`),
  `hasBoundRender` and `associations`. The recipe itself rides along only where the client renders from it:
  rows whose render mode is `diagram` (CreationMap draws the manifest) and the voice shelf (the register
  card reads the recipe). Everything else fetches `/api/sketches/<ref>` when it needs the full recipe: the
  board room's outliner and "save as new" now do. `SketchRepository.list()` keeps returning full sketches
  for the arcade, the MCP tools and scripts; the projection is `SketchRepository.listSummary()`. The home
  floor folds light rows and hydrates only the faces it draws. Client helpers in
  `lib/graph/sketch/sketch-summary.js` (`renderModeOf`, `kindOf`, `factsOf`) read both shapes, so the
  detail page, which still has the manifest, is untouched. Measured on that workshop, route handler
  called directly: the Scenes shelf went from 1.3 s / 62.45 MB to 0.17 s / 0.11 MB, Models from
  0.93 s / 25.3 MB to 0.16 s / 0.4 MB, the recent list from 0.27 s / 1.46 MB to 0.04 s / 0.07 MB.
- **Changed: the sketch bucket and kind are persisted columns.** `sketches.kind` and
  `sketches.bucket_derived` (distinct from the `bucket` override column; effective bucket is
  `COALESCE(bucket, bucket_derived)`) are backfilled once on upgrade and kept in sync on every create and
  update. `list({ bucket })`, `bucketCounts()` and `newestByBucket()` now filter and tally in SQL instead
  of parsing every manifest in JS to classify it, which was a ~0.6 s floor under every shelf, the counts
  chips, `/api/home` and `/api/home/floor`. The derivation is versioned: a signature of the kind lists
  `classifyBucket` reads is stored in `app_settings`, and a mismatch (a kind added to a list, or a manual
  revision bump) re-backfills the columns. `rowToSketch` still derives `bucket` from the parsed manifest,
  so the value a caller sees is unchanged; a characterization test asserts the SQL path equals the old JS
  filter. Measured: the counts chips 0.6 s → 0.03 s, the home floor 0.7 s → 0.04 s, `bucketCounts()`
  575 ms → 28 ms; the one-time backfill of ~3,000 rows took 1.2 s on first use.
- **Fixed: `/api/sketches/[ref]/world` served stale HTML from the browser cache after an upgrade.** Its
  ETag was a hash of (ref, flags, manifest) with no code-version salt, so an emitter change on upgrade
  still matched the browser's `If-None-Match` and got a 304. The key now folds in `WORLD_CACHE_VERSION`
  and the package version (`getServerVersion`, moved to `lib/server-version.js` and re-exported from the
  MCP server module). Browser-held world pages revalidate once after this ships. `?nocache=1` stays
  `no-store`.
### Grok headless affordances

The remote-agent host class: a chat agent driving `npx mojulo` from an ephemeral Linux sandbox with
no MCP binding, no browser, and files as the only handoff to the human. A Grok session did exactly
that against 2.0.6 on 2026-09-21 (x64, Node 24.15, `npm install mojulo --omit=optional`); the
kernel held (its city GLB re-mints byte-identical on macOS, texture PNG aside) and five things
around it broke or misled. Each is fixed below.

- **Fixed: every CLI command, `version` included, crashed at tool registration when `sharp` could
  not load** (`Could not load the "sharp" module`: an `--omit=optional` install leaves out
  `@img/sharp-<platform>`, and a platform with no prebuilt libvips has the same shape). Thirteen
  modules on the registration path imported `sharp` statically — the world registry, the sketch
  rasterizer, the polygonizer and sprite-sheet tools, six image-outcome modules, the two motion
  encoders — and `@huggingface/transformers` (which imports `sharp` itself) rode in through the
  embedder. They now load `sharp` on first use through one helper (`lib/sharp-lazy.js`), and the
  embedder loads transformers on first use. A missing `sharp` is an in-band error on the raster
  call that needed it, naming the fix (`npm install sharp` in the package directory); the
  kernel, the CLI, and every non-raster tool are up without it. Pinned by a subprocess test that
  spawns the bin with a resolver hook that refuses `sharp` and asserts `call version` exits 0.
  Three static importers stay (`final-page.js`, `cover-compositor.js`, `motion-comic-resolve.js`):
  they are not on the registration path and load only when their tool runs.
- **Fixed: `mojulo-ui` bound to the machine hostname on Linux.** The bin set `HOSTNAME` only when it
  was absent; Linux containers and many shells export `HOSTNAME=<machine>`, so the standalone
  server printed `Local: http://<container>:3001` and `127.0.0.1` refused. It now binds `127.0.0.1`
  unconditionally; `MOJULO_UI_HOST` is the explicit override (loopback-only remains the default).
- **Fixed: the bins wrote exports into the package directory.** `resolveMojuloPaths` seeded
  `SQLITE_PATH` / `ARTIFACTS_DIR` / `STORAGE_ROOT` under `~/.mojulo/data` but not
  `MOJULO_OUTCOMES_DIR` or `MOJULO_EXPORTS_DIR`, and both fall back to `cwd/data/…`. The stdio bin
  chdirs to the package root and the dashboard to `.next/standalone`, so `export_model` landed in
  `node_modules/mojulo/data/outcomes/<ref>/` and the dashboard's `/outcomes` route read a different
  folder. The resolver now seeds both (`$MOJULO_DATA_DIR/outcomes`, `$MOJULO_DATA_DIR/exports`);
  repo-dev `next dev` keeps its cwd fallback. **Exports written by earlier versions stay where they
  were** (under the installed package's `data/outcomes/` and `data/exports/`); nothing is moved.
  `export_model` now also returns a `home` note when its path resolved under the package directory
  rather than the data dir, so a caller can see where the file landed.
- **Added: `export_model format: 'html'`, the remote eyes gate.** Writes `world.html` into the
  sketch's outcome folder beside `recipe.json` and `README.md`: the same self-contained page
  `/world` serves (`emitThreeWorld({ inline: true })`, three.js embedded as `data:` modules, walk
  mode and HUD included), resolved through the same `resolveWorldScene` the GLB leg uses. It opens
  from `file://` with no server and no network; a soundtrack is the one channel a `file://` open may
  block, as `export_game` already documents. Result carries `bytes`, `path`, `dir`, `download_url`
  and a `note` saying so; `vertices` / `triangles` are not reported (it is a page, not a mesh).
  Deterministic: the same row emits the same bytes (the seed-91 city is about 9 MB). Test pins
  zero `http(s)://` and zero `/vendor/three` references and the inline importmap.
- **Fixed: the flat tools/list payload had crossed its pin.** The `html` clause landed on an
  `export_model` description already carrying the batch's `3mf` / `usda` / `usdz` / `scad` growth,
  and the merged tree measured 263,619 bytes against the 263,500 pin (the branch-local number
  recorded when the clause was written did not survive the merge). The description is re-cut to
  routing grade instead — 2,179 → 1,915 chars, every routing fact kept, the fidelity rhetoric and
  the re-lightable-PBR aside dropped (the `lit` property already carries it) — and the payload
  measures 263,355. Pin unchanged.
- **Fixed: `compose_world` flagged `context` as "not reflected" on every themed city mint.** The
  city adapter lowers the slot keys (`context`, `asset`, `material`, `style`) onto the top level of
  the recipe, so the flat-key check never found them. A lowered slot now counts as reflected when
  every child key landed, under its own name or the name the adapter gives it (`asset.monument`
  is stored as `landmark`; the adapter is run on the one child to learn that), and the note names
  only the child keys that did not (`context.time` for an invalid `'noon'`), adding that the rest
  of the slot folded onto the recipe's top level. A slot with no child landed is still named whole.
- **Added: `blocks` on the fractal-city stats**: the count of street-grid parcels the quadrant
  recursion filled (each `fillBlock` leaf past the 1.3-unit floor), the unit an operator means by
  "block". The seed-91 fixture city has 47 blocks for its 44 buildings; the default city 8 for 3.
  The old stats had rows for what stands on a block, none for the block. A count only; no dice,
  no bytes change.
- **Docs**: `docs/tech-requirements.md` Linux bullet records the 2026-09-21 evidence and what is
  still unverified there; Node 24 is recorded as a verified runtime; the PNG-encoder caveat sits
  beside the byte-identical GLB claim. `README.md` platform sentence matches. `AGENTS.md` gains a
  "CLI-only / remote sandbox" host section and names the Grok chat / Grok Build collision;
  `grok-build.md` points chat-sandbox riders at it; `docs/install-capabilities.md` says what
  `--omit=optional` now leaves running.


## [2.0.6] - 2026-09-20

### Fresh installs get a working dashboard

- **Fixed: a clean `npm install mojulo@2.0.5` shipped a dashboard whose sketch list, render routes
  and embedding backfill all failed at module load** with `Cannot read properties of undefined
  (reading 'output')`. The standalone bundle is traced from the maintainer lockfile and carried a
  nested `sharp` 0.34.5, while the package deliberately strips sharp's native `@img/*` binaries so the
  hoisted copy from the user's install is the one that loads. Sharp is only a transitive dependency,
  and a fresh install today resolves `@huggingface/transformers` 4.3.0 → sharp 0.35.4, so 0.34.5
  JavaScript loaded 0.35.4 binaries and died on the first call. It never reproduced on the
  maintainer's machine because the npx caches there predate sharp 0.35.4 (2026-08-26) and the dev
  tree uses the lockfile. The rule the `files` list now follows: **a native package and everything
  that hard-pairs with it come from ONE place, the hoisted install.** `sharp`, `onnxruntime-common`
  and `@huggingface/transformers` join `better-sqlite3`, `@img`, `onnxruntime-node` and
  `node-web-audio-api` in the standalone exclusions. Already on 2.0.5: `npx mojulo@latest init`
  builds a fresh tree.
- **Fixed: the npm package was 639 MB unpacked (245 MB at 2.0.2).** 502 MB of it was 154 Next.js
  `.nft.json` output-trace manifests, build-time inputs the running server never reads. They are
  excluded; the dashboard boots and serves without them. 2.0.6 packs at 27 MB on the wire and
  110 MB unpacked; a cold install lands at about 885 MB before the embedding model.
- **Added: `npm run smoke:tarball`** (`scripts/smoke-cold-install.mjs`) — packs, installs the tarball
  into an empty temp directory, runs `mojulo call version`, boots `mojulo-ui` on a free port, reads
  `/api/sketches`, mints a floorplan through the CLI and fetches its SVG, and reports any
  nested-vs-hoisted version mismatch for the native pairs plus the unpacked size. It is the release
  gate this bug needed: verifying through the npx cache reuses an old tree and hides exactly this
  class of failure. Machine gate; advisory on the mismatch report, hard failure on a dead route.

## [2.0.5] - 2026-09-19

### vajra-sculpt — a character as hand-placed field terms, print-closed

- **Added: a contribution gate that reads `fields[].terms`** (`stats.contribution`, per term
  `{ exposure, protrusion, blend, buried, absorbed }`). The `fields` monomer never had one: the
  contribution and jut-shortfall checks that keep a workbench monomer from being swallowed by its
  neighbours are blind to a term list, so the failure they exist to catch — a mass buried inside its
  host, contributing no silhouette — was invisible until a render was looked at. Two failures are
  reported separately because the fixes are opposite. BURIED: the term's own surface lies inside the
  union of the others, so it breaks no silhouette and costs bytes and sampling time while drawing
  nothing — move it out. ABSORBED: the term IS proud of its neighbours, but by less than its own
  `blend` radius, so the smooth-union bulge swallows what little it clears — raise the protrusion or
  lower the blend. Method is point-in-solid against the union, which is exact here because every term
  already IS a signed distance function: each term is surfaced alone on a coarse net and every face
  centroid is tested against every other term. No AABBs — a bounding box lies about a taper, which is
  how the monomer check first got this wrong. Advisory, never gating; pure and deterministic.
  Retro-run against a 23-term first-pass head (97 ms) it named four real defects with no render, and
  cleared two ears that were in fact unreadable. That miss is the useful result, because it separates
  the classes: **a geometric gate finds CALIBRATION defects (buried, absorbed) with no eyes, and is
  blind to IDENTIFICATION defects (the wrong KIND of mass), which are fixed by a better reference and
  not by a better check.**
- **Added: `attachments` on a figure recipe** — any workbench recipe mounted on any named landmark,
  scaled to the figure and riding the pose: `{ recipe, at, t, size, fit, anchor, offset, rotate, align }`.
  A held shield was already possible and was welded to one prop and one landmark; a character with a
  helmet, a spear and greaves needs the same move at four more places. This is what lets a character's
  BODY come from the figure family — parametric, posable, nothing sculpted — while its GEAR comes from
  the object lane, where manufactured parts belong. The existing `hold` path is untouched. A mounted
  recipe carries any monomer but `drapes` (cloth needs the garment path's two-sided shading) and
  `reliefs` (carved lettering reads a font from disk, and the figure renderer is reachable from the
  browser bundle, where there is no disk); both remain workbench-path monomers.
- **Added: a connectivity readout on every workbench recipe** (`stats.components`). Closure asks whether
  every edge has a partner; a detached horn tip, a spear that never reached the hand and a crest fin short
  of the helmet all pass it, because each stray island is its own closed shell. Multi-body is not itself a
  defect — superposition is the construction method and a loose part is ordinarily its own solid — so the
  count is reported as a fact and only a declared `bodies: N` that the measurement contradicts warns.
  Method: parity voxelization along +x then a 6-connected flood fill, run over the WHOLE baked face
  list, so it crosses the field-hand / lathe-spear seam that no per-monomer check can see. It uses the
  NONZERO WINDING rule and not even-odd, and that is the whole point: superposition is the house
  construction method, so two separately closed shells that OVERLAP are the ordinary case, and parity
  fills their two rinds, leaves the overlap hollow and reports the pieces disconnected (measured: a
  shield read 11 bodies, a spear 4; winding puts both at 1). The sign is free — a triangle's `det` in
  the y–z projection is exactly the x-component of its normal. Two more things the build taught: a
  grid-aligned sample line lands on the shared edge of a dual mesh every time and doubles the crossing
  count, so lines are nudged off-lattice and the barycentric test is half-open; and the count is run at
  two resolutions, because a junction that only GRAZES merges at one grid and splits at the other — the
  instability IS the finding, and it is the same tangency Manifold's union cannot resolve. The gate also
  inherits the geometry's resolution ceiling, so each piece reports `across` (cells at its thinnest) and
  a split involving a ≤2-cell piece carries a caveat instead of an assertion. A slender member has to be
  verified on its own bounds, which is the same `h = longest / cells` argument that governs the sculpt.
- **Added: `figure-cluster` — one scale authority and one identity lock over a character's roles.**
  A character built as a body plus mounted gear is already a CLUSTER of independently authored recipes.
  Composing them by hand worked and showed exactly what was missing: the gear took four placement passes
  and came out oversized, because `attachments[].size` is an ABSOLUTE STAND number and nothing says what
  STAND is — measured at `headTop`, the default armature stands 0.93 and a `chibi` 0.52. That happened to
  one author with the whole thing in view; fan the roles out and it happens once per agent, in different
  directions, with nothing to reconcile them. The frame holds four things nothing else did: **the unit**
  (`measureFigure` poses the armature and reports its height, so scale is MEASURED rather than guessed),
  **the identity lock** (≤5 named traits in one sentence, required, riding the minted recipe so a later
  pass restates the same character instead of inventing a neighbouring one), **the interface** (each role
  declares its mount as validated data instead of a tuned literal), and **the ledger** (every role's own
  closure / contribution / connectivity gates on its OWN bounds — the only scale at which a slender member
  is resolvable at all). The rule that makes the scale trap impossible rather than merely documented:
  **a role declares its size as a FRACTION of the figure, never as an absolute** — `mount.size` is a
  validation error and `mount.span` is required. This is the object protocol's no-absolute-z discipline
  applied to scale: a spear is 1.19 figures long and a shield 0.34 across, and those are true of a chibi,
  an adult and a brute alike, so a role authored once ports to every cast and two agents cannot disagree
  about what 0.43 means. One unit was not enough — a chibi's head is a far larger share of its body than
  an adult's and a helmet is a fraction of the HEAD — so `mount.spanOf: 'figure' | 'head'` says which
  level a role answers to; offsets stay figure-relative whatever the span measures against, because an
  offset is a position on the body and positions belong to the body's frame even when a size belongs to a
  part's. Verified by resolving a hand-tuned three-role character to byte-identical absolutes, then
  rendering the same spec, with no number changed, on an adult and a brute: the unit re-measures, every
  span re-multiplies, and the gear arrives at the same proportions. `resolveCluster` returns a
  `kind: 'figure'` manifest that `mint_solid` stores plus the gate ledger; it is a build-path module, and
  there is no cluster dial on the tool surface yet.

### limb-mass — the arm and the leg in relation to the torso's weight

- **Added: `armWidth` and `thighWidth`** — the upper arm's and the thigh's LATERAL breadth, which
  no dial could reach. `bicep` scales the anterior and posterior upper-arm lobes and `quad` scales
  the thigh's front lobe, but every one of those lobes adds into the limb's FORE/AFT radius and the
  lateral radius was bare `baseR`: measured, `bicep: 2` moved the upper arm's width by ×1.000 and
  its depth by ×1.363, and `quad: 2` moved the thigh's width by ×1.000. A heavy arm and a lean arm
  were the same width head-on and only the profile ever moved. (`forearm` and `calf` never had the
  problem — they ride the ring radius itself.) `armWidth` eases along the lobe profile so the
  deltoid and elbow caps still cover the ends; `thighWidth` is localized to the thigh band and
  leaves the lower leg to `calf`. `bicep` and `quad` are untouched, so every stored recipe renders
  byte-identically.
- **Added: `tricep`, `hamstring` and `adductor`** — the lobes where gained weight actually sits.
  One dial drove both the bicep and the tricep, and the thigh's posterior and medial lobes had no
  dial at all, so the only thing a limb could do as it filled was grow a bigger bicep and a bigger
  quad. Muscle reads anterior and lateral; weight reads posterior and medial. `adductor` is what
  closes a heavy leg at the top. The fat↔muscle axis is now a choice rather than a side effect:
  `{ bicep: 1.5, armWidth: 1.2 }` and `{ tricep: 1.5, armWidth: 1.35 }` are different shapes at the
  same circumference.
- **Added: `deltoid` and `elbowCap`** — the joint caps, which had no dial and never saw `weight`,
  so segments could inflate while the joints they hang from held still. Each sizes its mass and
  leaves its centre on the sex pole, so a cap grows once rather than scaling its radius and sliding
  its centre away too. (The hip already had `hipFlare`.)
- **Fixed: `proto.weight` landed on the trunk and stopped there.** Across weight 1 → 2 the bust ran
  ×1.371 and the waist ×1.721 while the upper arm managed ×1.209 and the thigh ×1.191, so
  `upperArm/bust` fell 0.388 → 0.342 and `thigh/hip` fell 0.504 → 0.474 on both poles — a heavier
  figure read as a heavier TRUNK on the same limbs. It was not a matter of turning the limb gains
  up: there was no lateral axis for them to gain on, and raising `bicep` or `quad` builds muscle
  shape rather than fat shape. With the axes above in place the gains were SOLVED against the ratio
  rather than chosen, and both now hold within +5 / −0 % across weight 1 → 2 on both poles. The
  wrist and the ankle still fall away, which is correct — weight is proximal, and distal is bone.
- **Changed: `figure-torso.test.js`'s weight-distribution pin.** It asserted that the waist, hip and
  bust each outgain the wrist, thigh and upper arm, and that blanket ordering WAS the defect — it
  held only because the proximal limbs could not keep up by construction. What the dial promises,
  and what is now pinned, is the trunk↔EXTREMITY separation: the middle gains most, the hand and
  the foot barely move, and the proximal limbs sit between. The hip is the least responsive trunk
  landmark and no longer outgains the thigh; the anthropometry says a thigh gains slightly faster
  than a hip, and that is pinned instead.
- **Added: `forearmDrop` and `calfDrop`** — WHERE the distal belly sits along its own segment
  (0 = canonical). The distal limb had the opposite gap to the proximal one: `forearm` and `calf`
  ride the ring radius itself, so they always scaled both axes and never needed a width dial. What
  they could not say is where the mass sits — the forearm's crest was pinned at 0.400 of the segment
  and the calf's at 0.488 (against a knee trough at 0.442) for every dial and every weight, so a
  long low calf tapering into the ankle and a short high one were the same calf at different
  volumes. That is the axis a calf is actually read on. `calfDrop` travels DOWN freely (crest
  measured at 0.488 / 0.512 / 0.535 / 0.581 / 0.605) and is bounded going UP by the knee: a gastroc
  does not sit above the joint, so negative values concentrate the mass and read as a shorter,
  tighter calf rather than raising it.
- **Added: `wristGirth` and `ankleGirth`** — the terminal joints' own thickness. `wristTaper`
  FLATTENS the wrist (it is the flipper dial) and only ever moved girth as a side effect, and the
  ankle answered to nothing at all: `calf: 2` moved the measured ankle by 1.3 %. Each is localized
  to its own end and stays out of the belly above it (`wristGirth: 1.5` reaches the forearm belly by
  3.8 %, `ankleGirth: 1.5` leaves the calf crest untouched).
- **Measured, and deliberately NOT re-gained: `weight` already reaches the distal limb.** Unlike the
  proximal pass, no new gain was wired. `forearm` and `calf` already carry gains, and at `weight: 2`
  the wrist measures ×1.151 and the ankle ×1.148 against roughly ×1.12 and ×1.18 lean-to-obese —
  inside the reference's own slop, so chasing them would be over-fitting a remembered table. The
  distal gap was expressive, not relational, and the four dials above are absent from `WEIGHT_GAIN`
  on purpose. Pinned as such.
- **Found, not fixed (pinned): `bodyGirths` does not report the hip monotonically below `weight` 1**
  — 123.9 cm at 0.6, 118.2 at 0.85, back up to 121.4 at 1.0, so a leaner figure can measure a wider
  hip than a slightly-lean one. It is the chart and not the body: the trunk's own lower geometry is
  strictly monotone across the same range, and the hip landmark does not migrate there either
  (v holds at 0.900–0.903). Left alone because every cut-and-sewn garment reads that chart. It is
  why the new ratio gate starts at weight 1 — below that it would be measuring this.

### figure-cast — limb proportions as a dial, cast off the locked armature

- **Added: `cast` on `mint_solid { kind: 'figure' }`** — rest segment-length multipliers
  (`upperArm`, `forearm`, `thigh`, `shank`, `lumbar`, `thoracic`, `neck`, `skull`) plus
  `shoulderSpan` / `hipSpan`, and the groups `arm` / `leg` / `limb` / `torso`. They apply at the
  vajra level, before anything is fleshed: a length dial re-places a distal node along its own rest
  direction, a span dial translates a limb subtree, and the figure re-seats on the floor. The joint
  graph, the subtrees and the joint LIMITS are untouched — a cast moves rest lengths, never a
  joint's range. This is what makes a figure long-limbed, stubby, broad-shouldered, an ape-index
  brute or a mascot; `proto` remains girth and `proto.height` remains overall size.
- **Changed: the flesh, the balance IK, the gait, the spine warp, the garments and the exported
  rig all read the cast.** `articulate` / `applyPose` take an optional rest armature (the signature
  `articulateTransforms` already had); the 2-bone ground IK solves on the cast's own bone lengths;
  the walk converts its absolute ground stride against the cast's leg, so a long-legged figure
  strides instead of mincing; the spine warp's rest curve and the arm's anchor height come from the
  cast; the cut-and-sewn wardrobe follows because the body is its own tape measure.
- **Added: named cast presets** (`heroic`, `brute`, `lithe`, `stout`, `child`, `chibi`, and
  `canonical`), each a starter to nudge rather than a fixed look. They resolve BY VALUE at mint —
  the stored manifest carries the numbers plus `from` — so re-tuning a preset can never change an
  already-minted figure, and the recipe has something to read and edit.
- **Changed: `buildPosedFigure`'s positional tail is now an options object**
  (`{ fluffs, hold, hair, cast, fluffQuality, weld }`), and every render path reads the body half of
  a manifest through one reader instead of six argument lists.
- **Fixed: an emote minted from a stored figure kept its `garment` but silently dropped its
  `fluffs`**, so emoting a stylized figure produced an anatomical one. It now carries the whole
  body — `fluffs` and `cast` — as its comment always claimed.
- **Added: `cast.shoulderDrop`** — the girdle's CARRIAGE, in degrees rather than as a multiplier.
  The armature puts the neck root and both shoulders at the same height, so the clavicle line and
  the shoulder yoke run dead level out to the acromion: anatomically a permanent shrug, and the
  reason a neutral figure reads stiff and high through the girdle. + declines that line, − rides it
  into a shrug. The arm translates with the acromion instead of rotating with it, so the humerus
  keeps its rest hang and every cached rest bone direction stays valid. The canonical rest is
  unchanged (still level); declining it by default is blocked on the trunk chart's cap taking its
  footprint from the shoulder LINE rather than from whichever hull band is highest — past ~5° of
  drop the deltoids leave that band, the footprint collapses and a shoulder-seamed garment is
  misplaced. Pinned in `figure-cast.test.js`; shells and side-seam garments are unaffected.
- **Changed: `cast.shoulderSpan` scales the clavicle as a VECTOR**, not in x alone, so a broad
  shoulder keeps its shoulder ANGLE instead of flattening toward level. The angle is
  `shoulderDrop`'s business.
- **Added: `proto.chestDepth` and `proto.pelvisDepth`** — the torso's fore/aft, which nothing could
  reach. `chestWidth` has always scaled the ribcage's whole cross-section, breadth and depth by the
  same multiplier, so a deep-chested or slab-flat trunk was not a setting; these trim the depth
  alone on top of it (`chestWidth: 1.4` with `chestDepth: 0.71` is broad AND flat). The waist needs
  no dial: its depth is the interpolation of the two and follows them. `chestWidth`'s own behaviour
  is unchanged, so every stored recipe renders byte-identically.
- **Added: `proto.weight`** — one number for how heavy a figure reads, distributed across the
  region dials rather than scaling them evenly (which is what `stockiness` already did). The
  abdomen takes the most and takes it forward, the hips and thighs next, the waist un-tucks, the
  V-taper flattens, the wrist barely moves: at `weight: 1.6`, waist ×1.24 against wrist ×1.09. It
  is a global gain, so the operator's own region dials multiply on top, and it is relative to the
  frame because every gain is a multiplier. `weight: 1` is byte-identical on both poles. Distinct
  from `pose.weight`, which is which foot the figure stands over.
- **Fixed: a heavy figure grew spheres bolted to a torso.** Three faults compounded in the side
  profile. The trunk is authored back-anchored (`cy = bez + ap·ct` puts the spine at the back), so
  every millimetre a depth dial added travelled FORWARD — at weight 2 the front moved +1.24 and the
  back −0.20; depth dials now grow the section about its own centre. Weight's depth gain was nearly
  double its width gain, building a deep narrow slab; width now leads. And the belly and the seat
  are separate stacks that each grow twice over — radius and centre — with nothing bounding how
  proud of the torso they could stand, so `seatMass` now holds every superposed mass to the
  proportion of the trunk it has at canonical (the seat had reached 80 % of trunk depth against a
  canonical 55 %). Self-limiting, so a hand-set `gluteSize: 3` is bounded too.
- **Fixed: a concave belt across a heavy figure's waist.** The trunk's belly swell peaked below the
  waist and fell away before the ribcage picked up, leaving a groove exactly where a heavy body
  should be fullest — the lateral outline sat 0.091 below its own convex hull at weight 1.6 and
  0.166 at weight 2. The swell is re-centred and widened (uu 0.42, spread 0.42) so it reaches the
  ribs: 0.021 and 0.068. The waist's DEPTH pinch also now rides `waistTuck` exactly as its width
  pinch always has, so a relaxing tuck opens the groove instead of holding it at full strength.
  A lean figure keeps its waist — that narrowing is a waist, not a defect. Canonical unchanged.
- **Added: `proto.bellyFill`** — the trunk's OWN swell around the navel, and what `weight` now
  drives instead of inflating the `dantien` ellipsoid. A heavy middle is one continuous silhouette
  rather than a ball overlapping a torso; `dantien` remains the distinct mass for when that is
  wanted. Canonical at 0.
- **Added the STOMACH and HIP axes: `proto.bellyDepth`, `bellyDrop`, `gluteRear`, `hipFlare`.**
  `dantien` and `gluteSize` scale their mass uniformly, so a forward gut, a high or low belly, a
  shelf buttock and the hip's own flesh were all unreachable at any setting. `bellyDepth` grows the
  belly forward with the back edge pinned; `bellyDrop` slides it along its own height (0 =
  canonical); `gluteRear` projects the buttock rearward without widening it, multiplying the sex
  pole's rear scale rather than replacing it; `hipFlare` gives the hip cap the dial every other
  body mass already had. All default to canonical, so stored recipes render byte-identically.
- **Removed: `manifest.proportions`** (the chibi rig, which only ever reached a `fluffs` body and
  was never writable by any mint tool). The cast is its general form; a stored `proportions`
  migrates to the equivalent cast dials on read, so nothing re-mints.

### the head grows its features — the ear, the side wall, the nose tip, the eye

- **Added: the ear is a feature instead of a bulge.** It was one flattened lobe at the tragion,
  smooth-unioned at the face's 0.019·s blend — ~17 mm of softening over a 4 mm lobe, so it added
  7 mm of head width and no shape at all, and the lateral turntable showed a bare curve from
  temple to jaw. It is now a helix rim of round cones from the root, over the top, down the back
  to the lobule, thickened by two pads and closed by a thin pinna plate, in **its own blend group
  behind its own bounding gate** — the same treatment the nose already needed. The rim's outer
  edge spans the canon band, subnasale to glabella.
- **Added: the zygomatic arch and a light masseter.** The side of the face fell into a trough
  between the cheekbone and the ear — 3.7 mm real on the bare skull, which the new ear *deepened*
  to 4.5 mm by raising the wall behind it. The arch bridges cheekbone to ear canal and the
  masseter rounds the jaw's side below it. It costs nothing in the head's width band (both sit
  under the ear's peak) and it made the ear render **cleaner**: filling the valley stopped the
  latitude rays plunging into it, so the worst ring-to-ring step on the ear fell from 6.0 to 5.5 mm.
- **Changed: the nose tip domes and reads as a forward pyramid.** The tip was a sphere whose
  radius of curvature (~12 mm real) dwarfed the feature it was meant to be, so it rendered as a
  flat facet. It is now an ellipsoid plus an infratip lobule, with a **dorsal keel** carrying one
  continuous ridge from the bridge to the tip. The tip gained ~4 mm of projection and got
  **narrower**, not wider: all the volume went into projection and height, none into width.
- **Added: the eye.** A globe in the orbit under two C-wave lids, unioned **after** the orbit
  subtraction (before it, the socket cut simply erased the globe) with that cut trimmed to suit.
  At the eye a latitude ring is 5.9 mm real, so a 10 mm palpebral fissure spans 1.7 rings and
  cannot be a modelled gap — it is a **shadow step** between two lid ridges, the same answer the
  lip line arrived at. The eye reads on form and shading; it carries no colour.
- **Added: `earSize` and `eyeSize` head knobs.** `earSize` grows the ear in its own plane and its
  rim thickness but deliberately **not** its standoff, because the head's width is ear-driven and
  the width band is the guard on the whole skull. `eyeSize` grows the globe and the fissure
  together — a bigger eyeball behind the same aperture only buries itself.

### one machine, one answer — the cap tessellator and the rounded-rect profile

- **Fixed: a carved cap with two or more counters could fill one of them.** Bridging a hole into an
  outline leaves the ring touching itself at the bridge, and the ear clipper could cut straight
  through one of those contact points — emitting an inverted triangle and covering a counter twice,
  so a letter like `B` came out with a solid bowl. `triangulateRings` now spots the inverted
  triangle and re-clips that ring with the bridge contacts guarded, keeping whichever result
  actually matches the ring's area. Caps that were already correct are untouched, byte for byte.
- **Fixed: a rounded-rect extrude profile now emits the same bytes on Apple silicon and on x86.**
  `roundedRectPath` asked `Math.cos`/`Math.sin` for each of the four corner arcs by absolute angle,
  and V8's argument reduction past π/2 is not bit-identical across CPU targets — one face normal
  came out a ULP apart on the two architectures. It now takes a single quadrant and turns it by
  exact sign swaps. A recipe regenerates to the same bytes wherever it is read, which is the point.
- **Changed: the cap tessellator's regression pin no longer depends on the machine's fonts.** The
  glyph tests resolve whatever font is installed — Arial Black on macOS, DejaVu on the Linux CI
  image — so the two `B` bugs above only ever reproduced on CI. The failing contours are frozen in
  `triangulate.dejavu-b.fixture.js` and pinned everywhere.

### readme — worked examples instead of a manifesto

- **Changed: the repo README is now five concrete examples** (a mug, a living room, a city, a
  walkable world to a Godot export, a snowman), each with the sentence you say, the tool that
  fires, and the recipe that gets stored, followed by the export table and what stays on the
  machine. The long-form catalog moves unchanged to `docs/tour.md`.
- **Changed: the one-line self-description is "a 3D compiler for agents"** — a compiler, not a
  generator: the recipe is the source, kernels compile it back byte-for-byte, emitters are the
  targets, renders are derived. Said in one voice across the README, the npm README and
  `package.json` description, `server.json`, `glama.json`, the plugin manifests, the
  `SERVER_INSTRUCTIONS` preamble, the `get_substrate` one-breath answer and studio opener,
  `docs/AGENT-REFERENCE.md`, and the installer's chatbot note. "3D factory" survives only in
  code comments and the changelog history.
- **Fixed: `LICENSE` is the verbatim Apache-2.0 text** (two clauses had been paraphrased, so
  GitHub reported the license as "Other"); the copyright line moves to a new `NOTICE` file.
- **Removed: six scratch scripts** (`control/relief-test2.mjs` and the
  underscore-prefixed prototypes under `control/scripts/`) that carried absolute home paths;
  `scripts/_*.mjs` is now gitignored.

### terms — the open-source commitment and a possible mojulo cloud

- **Changed: TERMS.md, README, SECURITY.md, docs/responsibility-model.md, and the `get_substrate`
  facts** now state the stance in one voice: the open-source mojulo is and stays Apache-2.0 with no
  telemetry, ever. That commitment is about the software, not a bar on a hosted offering — a
  separately offered mojulo cloud on standard services may be explored if there is demand, as its
  own opt-in product that changes nothing about the local install. "There is no hosted service"
  lines become present-tense ("today") where they read as a permanent ruling-out.

### dungeon-rock-texture — a surface tile per cave surface, multiply-lit over the traced bake

- **Added: `texture` in the dungeon style bible.** `style.texture: '<key>' | { floor?, wall?,
  ceiling?, scale? }`, a per-chamber `texture` override, and `style.tunnel.texture` / per-tunnel
  `texture` (tunnels inherit the style's wall key: a cave is one rock). Keys are surface-textures
  tiles (`rock-cave`, `rock-granite`, `rock-sandstone`, or a `defineRockTile` custom tone); an
  unknown key refuses the mint like an unknown material does. Every shell face gets `texture`,
  `textureLit`, and a per-corner `uv` — walls along the ring by unwrapped azimuth × radius (no
  stretch, no ±π seam inside a face), floor and ceiling by world XY, tunnels by their dominant
  plane — so the World and the .glb draw tile × baked fire light. This is the texel-frequency
  stage a 6th-gen cave frame has and the bare bake lacked. `padTrianglesForWorld` now pads a fan
  triangle's `uv` with its corners. Absent `texture` ⇒ no face carries a key, byte-identical.
  Manual: the `dungeon` view-vocab card. Tests: `dungeon-texture.test.js`.

### figure-head — a structured head, male and female

- **Changed: the protoform's head is one closed form built from anatomy.** It was two overlapping
  open tubes: a three-bead vajra egg and a tapered "face mask" sleeve pushed forward of it. They
  z-fought where they crossed, the mask's lower rim read as a visor, and because a ring stack is
  capped at neither end the crown and the underside were holes about 5.5 cm and 7.5 cm across at a
  170 cm stature (the crown scoop was visible from behind; the underside hid behind the neck).
  `figure-head.js` now builds the head as a signed-distance field of named anatomical primitives
  (braincase, frontal, occiput, brow, subtracted orbits, zygomatics, maxilla, nasal, lips,
  mandible, ramus, chin, submandibular floor, ears) smooth-unioned into one skin, the way the
  welded animal skull is, and surfaces it by LATITUDE rings from a centre inside the braincase,
  so both poles close by construction. The `faceMask` stack is gone; `headEgg` keeps its id and
  its ring currency, so hair, hats, garments, the skin seam and the spine warp read it unchanged.
- **Changed: the head has a sex.** Male and female heads were byte-identical. `DIMORPH` carries a
  `head` pole (brow, jaw width and drop, chin point and size, forehead slope, cranial roundness,
  nose, cheek fullness, size, neck girth); the female basis is a rounder cranium, a vertical
  forehead, a smooth brow, a narrower jaw, a pointed chin, a smaller nose, fuller cheeks and a
  thinner neck. `proto` gains per-region multipliers on top: `browRidge`, `jawWidth`, `chinPoint`,
  `noseSize`, `noseWidth`, `noseDroop`, `cheekbone`, `cheek`, `foreheadSlope`, `neckGirth` (1 = canonical, absent = same bytes).
  The nose is articulated and seated AT the face plane, projecting past it — a narrow bony bridge
  from the nasion dip to a slightly proud mid-dorsum, a cartilage dorsum to a supratip break, a tip
  ball hanging below the dorsum line (`noseDroop`, the hook), two alae lower and wider than the tip
  (`noseWidth`), a nostril bar, and a flat columella back to the subnasale so the nose has an underside.
  The nose blends within itself far tighter than it blends into the face, with a shallow alar crease
  either side of the tip, so the two alae and the tip read as three lobes and not one bell — and the
  head's rings are sampled twice as densely at the face as at the nape (44 around), because at a
  uniform 36 the whole nose base was one or two samples wide. The philtrum is a shallow recess and
  the nose joins the face tighter than the face blends with itself, so the underside of the nose
  stands over air instead of filleting into the lip. The lips have mass: an upper lip rising to a
  cupid's bow — both lips are built on one M-shaped mouth path from inner cheek to inner cheek, the
  upper lip's bottom edge tracing the bow and overhanging the lower lip so the line reads as its
  shadow — a fuller lower lip that rides the jaw and sits just under the upper lip's overhang, and a
  sulcus under the lower lip; the mandible rests closed-up against the maxilla with the chin brought
  up and forward under the lips, so the profile does not read as an overbite (bone only — the lips
  rest where they belong and follow the open dial).
  `cheek` is the soft cheek under the cheekbone — the apple of the cheek, a pad standing proud of
  the maxilla, and a jowl blend into the jaw — so the face rounds out in the ¾ view instead of
  reading as a skull or as sullen; the female basis is fuller.
  The buccal plane is lateral and thin (the face beside the mouth is the maxilla's own curve),
  the lips join the face at a wider fillet than
  the nose does, so the upper lip's wings run out into the inner cheek instead of standing as a
  ridge with a trench either side, and the cheek is one convex mass whose inner lower edge runs in
  to the base of the nose with no concave section between them. The philtrum groove sits in the
  skin (it had stayed at the maxilla when the lips moved forward, a pocket inside the head that
  every latitude ring through the mouth zigzagged over), and the lips run out into the cheek at
  their corners instead of ending in a wall.
  `headScale` still scales the whole skull about the neck join.
- **Added: `pose.face` — the jaw and the mouth, structured in the field, not the armature.**
  `face: { jaw, mouth, brow }`: `jaw` (degrees, 0–30) rotates the jaw group about a hinge through
  the condyles so the chin swings down and back and the smooth union re-fuses it into the cheeks;
  `mouth` (0–1, default follows the jaw) subtracts a lip slot; `brow` (−1..1) lowers or raises the
  brow ridge. No new armature node, so the 17-node manji, `LIMITS`, the packed rig and the VRM map
  are untouched, and emotes/keyframes drive `face` through the same phase→dof contract as every
  other dial. Stated limit: the skinned GLB bakes rest geometry over rigid bones and the head is
  one bone, so jaw motion shows in SVG, GIF and world frames, not in the skinned export.
- **Added: the head-study camera.** `renderFigureToSvg` takes `crop: 'head'` (the head, the neck
  and whatever sits on the head) and `elev` (degrees), mirroring the animal path's crop and
  `animalCamera`, so a human head can be checked top-down and from under. `/head-study` renders
  the eight skull-study angles for both sexes, filled and wireframe, cropped to the head.
- **Added: head rows on the tailor's tape.** `bodyGirths` reports `head` (the widest ring's girth,
  the hat size), `head_height` and `head_width` in cm at stature, read off the head stack.
- **Changed: wigs and hats average the skull radius over height, not over rings.** The head's rings
  are latitudes now, dense and tiny at the poles; a per-ring mean read the dome about a quarter
  small. The trapezoid rule over the radius-by-height profile is the same number for rings spaced
  evenly along the axis. A curtain wig's apex also clears the crown by about 2 cm instead of
  grazing it: the old crown was an open ring, so a dome that touched it showed nothing; the closed
  skull poked through.
- Re-pins: the three `figure-absent.char.test.js` hashes and the world kinds that place figures
  (`world-scene.kinds.test.js.snap`) — the flesh moved; the absent-channel promise is unchanged.

### toon-shading — cel bands and ink outlines as a manifest dial

- **`toon` on any 3D manifest** (`toon: true` = `{ bands: 3, ink: true }`; also read at
  `scene.toon`). `bands` quantizes the baked Lambert term into N tones in
  [vexar.js](lib/graph/polygonizer/vexar.js) (`makeLight({ bands })`, `withBands`, `bandFactor`;
  the final key+fill factor is banded, so the shadow hemisphere steps too). Because every
  renderer draws the baked fills unlit, the bands show identically in the SVG still, the CSS-3D
  scene, the orbit World, the GLB's COLOR_0, and the Godot / Unity / Unreal / Blender packs. A
  material's own `cel` still wins per part; `FLAT_LIGHT` (unshaded export) ignores the dial.
- **Threaded** through `resolveWorldScene` (`ctx.toon`, `payload.toon`) into the workbench,
  assembler, manji-tree, figure, animal, edifice, fractal-city and room assemblers, and through
  `resolveLighting` for the CSS-3D room paths. `mint_solid { kind:'workbench', spec.toon }`
  stores it; other kinds take it via `update_sketch` (`set /toon`). Absent → byte-identical.
- **`toon.ink` in the World** — a new pre-runtime setup channel
  ([channels/toon-ink.js](lib/graph/scene/channels/toon-ink.js), provides `__mojInk`): per
  eligible group the emitter packs the opaque non-studio faces with their authored outward
  normals (`ink: { pos, nrm }`), and the page draws an inverted-hull silhouette (welded normals,
  winding made to agree with them, `BackSide`) plus `EdgesGeometry` crease lines; the fills take
  a polygon offset. `ink: { color, width, crease }` tunes it. Rooms' `shell:` groups, studio,
  water, decal, glow, wireframe and translucent faces are excluded. Zero bytes when absent; one
  new `toon-ink` fixture pinned in the char net.
- **Live ink** — every ink group owns its hull + line materials and registers by group name in
  `window.__mojInk` (`tint(name, '#hex')`, `width(name, k)` — the hull push is a vertex-shader
  uniform, so width is live — `reset(name)`, `set(on)`); hull/line meshes carry
  `userData.ink`. **Rig figures**: the controllable rig builder inks every part (hull + creases
  parented under the bone mesh, so they pose with it and survive loadout/livery rebuilds) when
  the world carries `toon.ink`; parts have no authored normals, so triangles orient off the
  part centroid. **fx verbs**: a standing state `{ ink: '#hex', pulse?: true }` and an
  `inkFlash` gesture (`{ gesture: 'inkFlash', color }` on a bus binding) recolour an entity's
  outline on the deterministic step clock; spliced only when an fx spec uses them, so every
  existing fx world is byte-identical. Two more fixtures pinned (`toon-ink-controllable`,
  `toon-ink-fx`).
- Docs: `docs/scene-css3d-lighting.md` (authoring dials), the workbench and figure vocab cards.

## [2.0.4] - 2026-09-16

### workbench-opacity — a translucent monomer (a window pane over a cassette)

- **New: `opacity` on any lathe / extrude / sweep / loft / drape / relief monomer** (`0 < opacity < 1`)
  stamps a face-level `alpha`, which the orbitable World and the glTF leg already render per group
  (the cellular-view jelly path). A thin `opacity: 0.25` extrude over a pocket reads as a window with
  whatever sits behind it visible — the Walkman's cassette door. Absent or `1` → faces untouched,
  byte-identical; the `glass` material row's `opacity` is still not read, so every minted glass part
  stays exactly as opaque as it was. Card: `solid-vocab/workbench.md` (Groups, a hinge, and a bare studio).
  The SVG still and CSS-3D shots draw the pane opaque (advisory, unchanged).

### relief-unmirror — raised outlines read the right way round

- **Fixed: every `reliefs` monomer rendered mirrored.** `reliefToFaces` negated the in-plane
  right axis on the belief that the raise flipped handedness; it does not (both contour sources
  arrive y-up — text from the font, SVG paths through `flipY`), so a wordmark embossed on a
  workbench part read backwards from the side it faces. The frame is now the plain right-handed
  `(up × normal, up, normal)`. Emission changes for every already-minted relief, which is the
  point: they were all backwards. `relief-faces.test.js` pins an L's stem on the left for text,
  for a path, and under an explicit `normal` / `up` frame.

### bound-mesh-decollide — a GI-baked object keeps its DCC planes in the World

- **Fixed: the World's de-collide pass skipped for bound meshes.** `emitThreeWorld` lifts a
  face stacked on coincident neighbours a hair along its normal, scaled by the face's size and
  by how many it overlaps. A DCC re-triangulates every cap as a fan of large overlapping
  triangles, so a `meshRef` bind-back (a Blender GI bake placed in a world) had its lid cap
  floated millimetres through the proud plate in front of it. Faces in a `mesh:<name>` render
  group now bypass the pass (`decollideExceptBound`); they arrive already resolved. Worlds
  without a bound mesh take the unchanged path, byte-identical.

### update-sketch-patch — iterate a stored recipe by naming the part

- **Added: `update_sketch { patch }`** — an ordered list of `set` / `remove` / `add` ops addressed
  by monomer `id` or JSON Pointer `path`, applied to the stored manifest and then run through the
  same mint gates a full replacement pays. The stored row is still the whole resolved manifest;
  the archived revision carries the ops as its diff. Exclusive with `manifest`.
- **Added: `update_sketch { readout }`** — `changed` (the default for a patch) returns only the
  parts a patch touched or moved (a touched cut operand surfaces its cut's part), `removed` parts,
  `parts_total`, plus new warnings (warnings already present on the previous revision collapse to
  one counted line); `summary` drops `parts[]`; `full` is the previous block unchanged, and stays
  the default for a `manifest` replacement. The previous readout comes from an in-process cache of
  the last edit's stats when this process made it, else one extra plan.
- **Added: `id` on each `stats.parts[]` row** of a workbench readout when the monomer carries one.
  Additive; the render is untouched.
- **Changed:** the tools/list payload pin in tool-descriptions.test.js re-pinned for the two new
  `update_sketch` input-schema properties (why: a legitimate addition crossed the pin; the
  description itself stays under its ceiling).

### pixelizer-godot — the 2D reducer games get a Godot leg, and the 3D leg learns to measure

- **Added: `export_game { target: 'godot' }` on a pixelizer game** (and `scripts/export-godot.mjs
  --ref <ref>`) emits a Godot 4 arcade pack instead of refusing. The pack is DATA — `game.json`,
  `skin.json` (the bank tiles, legend and palette), `probe/replay.json`, the groove and SFX WAVs when
  `music` is on — performed by a separate versioned kernel (`godot-arcade-kernel/`, 0.1.0):
  `brickster.gd` is a hand-authored port of the JS reducer (mulberry32 7-bag, SRS kicks, guideline
  hold, the same scoring), `arcade.gd` the shell (the web shell's key map, gravity timer, start
  gate, HUD, game-over card, music loop, SFX cues). One reducer, two instruments; the web build
  stays the reference. `philosophers-stone` is not ported yet and refuses with a teaching error.
- **Added: the replay probe, a machine-gate rung.** The pack carries a seeded action script and
  the JS reducer's expected outcome; the gate runs `godot --headless … -- --mojulo-replay` and
  compares board, score, lines, hold, queue and game-over flag field by field. A port that drifts
  from the reducer fails the gate, not the eyes.
- **Added: `[mojulo-perf]` on both headless probes.** Process and physics time plus node and object
  counts at the probe's last frame, stamped advisory under the gate result; the arcade probe adds
  `replay_ms`, the reducer port's wall time for the whole script. Headless has no renderer, so no
  render time is claimed. `--mojulo-shot=<png>` on a windowed arcade run saves the drawn viewport
  after the replay, so the eyes gate has a picture without opening the editor.
- **Changed: 3D kernel 0.2.2.** The HUD label is assigned only when its text changes; hazard and
  meshless-entity markers share one material and one unit mesh per kind instead of allocating
  their own. No visible change; fewer draw states, nothing allocated per frame.

### prepack-heap — the publish build gets an 8 GB heap

- **Fixed: `npm publish` aborted with `JavaScript heap out of memory`.** The webpack production
  build now needs more than V8's default ~4 GB old space; `prepack` sets
  `NODE_OPTIONS=--max-old-space-size=8192` for the `next build --webpack` step. Dev and the
  standalone runtime are untouched.

## [2.0.3] - 2026-09-15

### combo-hitstun — hitstun, juggle state and damage scaling, composed in the recipe

- **Added: `combo` on a controllable world** (`true` or `{ hitstun, juggle, scaling, reset }`,
  per-body `body.combo: false | {…}`). Hitstun: every hit re-arms the stun at `base·decay^(n−1)`
  seconds — static at decay 1, shrinking below it, floored at `min`; the legacy path ignored a
  hit mid-stagger. Juggle: a melee verb with `strikeLaunch` throws its target into an airborne
  state the reaction pass integrates itself (gravity `g·gravity^(n−1)`), follow-ups lift it until
  `max` hits, and the landing is the knockdown (the wake guard ends the combo) unless
  `land:'stand'`; a toppling hit mid-air knocks down on landing. Scaling: hit k deals `perHit^k`
  of its damage, floored. `reset` is the link window after recovery; a getup zeroes the count.
- **One damage seam.** All five damage sites (melee connect, tackle, stuffed counter, hitscan,
  projectile) pass their number through `comboDamage`, which counts and scales; without a combo
  config it hands the number straight back. Un-stunned chip never chains.
- **Replay-safe.** Combo fields land only on opted-in bodies, so the replay hash of every existing
  world is unchanged (trace pins hold); the engine source moves, so char pins are re-pinned.

### target-lock — a lock-on that turns the pilot toward its target, and a camera that can follow the lock

- **Added: target lock.** A controllable world may declare `lock: true | { range, cone, release,
  aimRate, los, pitch }`. On the press (C / middle mouse / pad R3) the piloted entity locks onto the
  hittable nearest its aim axis — never self, an ally, or a vanished wreck; within range and the
  cone; line of sight unless `los:false` — and is eased to face it (heading on the shortest arc,
  pitch too). Pressed again it cycles to the next candidate by angle, or releases when none is
  left; a dead / vanished / out-of-range target, a downed pilot or a pilot swap release it. Mouse
  look stands down while locked, so strafing orbits. Positions only, no dice: replay-safe.
- **Added: the camera follows the lock.** `camera.lockTrack: true | { mix, dist, rate }` on a
  follow camera eases the look point toward the target and pulls the chase back so the pair stays
  framed; it eases back out when the lock drops. Off, the chase arithmetic is unchanged.
- **Emitter.** A diamond bracket with a LOCK caption projects over the target; bracket and input
  listeners are emitted only with `lock`. The engine source is one toString for every controllable
  world, so every controllable fixture hash moves; re-pinned, plus the new `controllable-lock`
  fixture. `create_controllable_world` accepts `lock`.

### game-ui-primitives — the screen composes like the world does

- **Added: HUD widgets.** A row of a world's `events.hud` is now a widget in one of seven slots
  (four corners, top, center, bottom — the signage slot names): a readout of a bus var as `text`,
  `counter`, `bar` (value over a max, numeric or a var) or `clock` (m:ss); a banner that shows text
  when the bus emits a matching event, with `{var}` substitution and a `ttl`; a static legend for
  hints and prompts. A legacy `{ var, label }` row is a text readout at top-left, so every existing
  world means what it meant; two rows naming one var merge, first declared winning per field, so a
  hand row restyles a mechanic's default readout. Rows are validated at the compose_world resolve
  gate; the events channel paints the layer only when rows exist. Idioms `scoreCounter` and
  `countdownClock` pass slot / kind / color through; `banner()` and `legend()` join the catalog.
- **Added: one style token set for the shell and every level.** A game's `theme` grows from two
  accents to `accent, accent2, ink, bg, panel, line` (hex) + `font` (system / mono / serif /
  display); the shell maps them onto its own vars and posts them beside `game-init`, so the
  menu, the setup screen, the score screen and each level's HUD are one look. A world's
  `events.style` carries the same tokens for a shell-less game; the shell's theme wins. Hex only,
  re-guarded at emit — a token can never reach a CSS context.
- **Added: the result card is authorable.** A level's `game.complete` hides (`false`) or retitles
  (`{ text }`) the in-level result card, which reads the same tokens.
- **Added: hud cards.** `get_game_vocab` gains a sixth family (`scope: 'hud'`: hud-guide /
  hud-readout / hud-banner / hud-style) indexed as `game_hud`; the tool description pin is
  re-pinned for the family clause.
- **Added: the damage toast.** `as: 'toast'` on a hud row is a banner that STACKS — one rising,
  fading element per firing, capped per row, on the frame clock. Two forms: an event toast
  (`{ on: 'shot', text: '-{event.damage}' }`) reads the firing event's fields, which the bus log
  does not keep, so the events channel hands the frame's incoming list to the HUD sync; a var
  toast (`{ var: 'hp', as: 'toast' }`) fires when the var changes and reads `{delta}` / `{value}`,
  never merging with the var's readout, so an HP bar and its "-20" coexist, colored by sign when
  uncolored. `hitConfirm({ damage })` stamps the number on its shot; `toast()` joins the idioms;
  the substitution rule is one exported function shipped into the page by toString. Emission
  changes for every world with an events channel (the sync call gains the incoming argument);
  re-pinned.
- **Engine packs.** score.json carries the widget list as `hud` with a `hud_declared` ledger row;
  the Godot / Unity / Unreal kernels still paint their own default readout from `mechanics`. The
  piloted-world match HUD is not yet in the vocabulary. Both are recorded stopping points.

### workbench: named groups, a hinge mover, and a bare studio

- A monomer `group` (lathe / extrude / sweep / loft / drape / relief) tags its faces with a render group, so
  the World meshes it on its own and a channel can move it. Absent `group` → byte-identical faces.
- A workbench manifest's `movers` ride the World payload; the mover channel's `turn` mode gains
  `absolute: true`, which pivots a group about `center` while its geometry keeps world coordinates
  (`position = center − R·center`), so a hinged lid stays closed in the recipe, the still and every export
  and swings only in the live World.
- A `turn` mover can be a composable TOGGLE: `states` lists its resting angles (two by default, closed / open,
  any count), a click on the part or its `key` steps to the next (shift+key back, `window.__mojToggle`
  from script), `transition` eases the swing. State 0 holds until an input arrives, so captures stay
  deterministic. A `slide` mover is the translating twin (states are distances along `axis`), and `parent`
  lets a group ride another group's mesh, so a clasp slides along a door that is itself swinging. The channel script text changes, so the emit-channels pins for the fixtures that emit
  the mover channel re-pin: movers, planets, kitchen-sink, kitchen-sink-capture.
- `grid: false` on a workbench manifest drops the measured floor + grid (a bare product shot).

### reliefs keep their caps in the World

- `faceListToMesh` (the World / GLB packer) bakes a 3-corner face as one triangle instead of skipping it.
  Relief caps are ear-clipped triangles, so every embossed wordmark, label and glyph rendered as bevel
  walls around a hole in the World and in `.glb` exports; the STL path was unaffected. Quads, textured
  and clip-mapped faces keep their four-corner contract byte for byte.

### footwear — shoes, boots and sandals, and the figure that stands on them

- **Fixed: the figure stands flat.** A figure that says nothing about its feet is standing, and a
  standing sole is on the floor. Before this the sole-flattening weight fell back to zero, the foot
  was built perpendicular to the shank, and the rest shank tilts 11° back — so every standing
  figure balanced on its toe tip with the heel about 3.8 cm in the air (sole pitch 11.3°, one of
  seven sole stations touching the ground). Bare that read as a slight point; under a shoe's sole
  it would read as a ski. A pose that wants a pointed foot still says so, and the walk and the
  sprint — which set their feet explicitly — are byte-identical. Re-pins the three figure
  absent-channel hashes and the two world kinds that place figures (`subway-building`,
  `subway-station`); nothing else in the suite moves.
- **Added: the foot is a body chart.** `footL` / `footR` join the trunk, arms, legs and neck as
  charts a pattern piece can sit on — a tube laid across gravity, its rows running heel to toe,
  its `u` = 0 the instep and `u` = 0.5 the sole. Its landmarks are read off the tape the way the
  trunk's waist is: the instep is the fullest row behind the middle, the ball the fullest ahead of
  it, the arch the narrowest row between them. The tailor's tape gains `ball`, `instep` and
  `foot_length`. Every existing garment's readout is unchanged.
- **Changed: the big toe leads, and the feet are a pair.** The forefoot was a symmetric spearhead
  tapering to a point on the midline — the same shape on both feet, with no handedness at all.
  The hallux now leads: the toe line slants back from the big toe to the little one, the foot's
  point sits on its inner edge, and the two feet are exact mirrors, so a shoe last has a side to
  be drafted for.
- **Changed: the toe box is rounded.** The forefoot past 86 % of the foot used to be a single
  tapering cap — 8 % as wide as the ball and 0.7 cm deep near the tip, a knife edge that a medial
  point only sharpened. It now rolls: the box holds about two-thirds of the ball's width and
  2.7 cm of depth almost to the end, closed by a small tip ring. (A ring stack is an open tube —
  the renderer caps neither end — so the foot has always had a hole at the toe; the blunter box
  would have shown it, and the tip ring shuts it.)
- **Changed: the foot is in proportion.** It was 18 % of the figure's height — a EU 47 on a
  170 cm body, and the size a pattern sheet would have printed a sole at. It is now about 15 %,
  the human ratio, with length, breadth and depth scaled together so the shape is unchanged: 26 cm
  long and 10 cm broad on a 170 cm figure, holding at every stature and on both poles. `footLength`
  still means what it did, an extra multiplier on forward reach.
- **Added: a chart that lies across gravity carries no suspension.** The hang rule gives cloth the
  circumference of the widest row above it, tapering as it falls — but "down" a foot chart means
  "toward the toe", where a shoe would have flared to the heel's width. A foot chart is now marked
  level: cloth on it follows its own width and its seams, the way a shoe is lasted rather than
  hung. Every existing garment is unchanged.
- **Added: sandals and boot shafts need no new block.** With the foot chart and the level rule in
  place, a sandal (a footbed between the foot's two end rows, straps over the instep, a band at the
  ankle) and a boot shaft are ordinary outline pieces — the same move the book's tie makes on the
  trunk. They mirror per foot, lay out on the printable sheet, and a shod figure stands on its
  soles: the sole holds the foot off the ground on its own, with no ground-plane special case.
- **Added: shoe blocks, and shoes.** Three new blocks — `shoe-sole` (a footprint under the foot),
  `shoe-upper` (one wrap anchored on the sole line, closing over the instep ahead of its `throat`
  and falling to a collar behind it) and `boot-shaft` (the leg above the ankle, drafted to the
  leg's own girth at the calf, so it layers over a trouser hem instead of fighting it). Where the
  throat sits is the whole difference between a loafer, an oxford, a sneaker and a boot. The
  recipe book's wardrobe chapter gains six: `sneaker`, `loafer`, `oxford`, `ankle-boot`,
  `knee-boot` and `sandal`.
- **Added: a level chart measures its breadth.** A girth cannot say how broad a foot is — the
  instep is 25 cm around and 8 broad, the ball 24 and 10, because one is deep and the other flat.
  A shoe block is handed each of the chart's own rows with its breadth, depth and distance along,
  so a sole drafts to the rings that exist rather than to the foot's silhouette.
- **Added: the book's outfits are shod.** All eight named outfits gain a footwear layer, outermost,
  so a boot's shaft lands on the trouser's hang rather than under it.
- **Fixed: a level chart is not padded or cleared by the layers beneath it.** Two passes that read
  a stand-off as a radius about a vertical axis were mauling footwear worn over trousers — a
  trouser hem near the ankle counted as enclosing the foot and lifted the whole foot by more than
  twice, and the clearance pass shoved a hundred and seventy-five foot vertices. Footwear now
  drafts on the skin, as the hang rule already had it. Nothing else changes.
- **Not built: the heel.** A heel has to stand off further than the sole under it, and the only
  lever is the piece's own ease — which stretches a flat pattern by (r + e) / r around a section of
  radius r. On the foot's smallest rings that is a smear, not a lift, and it looked like one. It
  needs the sole placed in the ground plane instead of on the chart's radial. A shoe's lift today
  is its sole's own thickness.

### wardrobe-variety — the dials a pattern book lists, so the wardrobe chapter can grow without core

- **Added: draft on the padded form.** A block worn over other layers drafts to the layers' own
  girth per chart row (a shell ring's perimeter, a pattern garment's placed widths), the way a
  tailor pads the form, so a jacket over a shirt closes at the side seam instead of reporting the
  shirt as a gap; the sheet drafts the same way. The placement lift is pinned to that tape per row
  (direction kept, magnitude no more than the layer's circumference), which retires the bell-shaped
  hem every layered garment had. The readout says what each chart was drafted on and to.
- **Added: the sleeve cap is sewn to the armhole.** The sleeve block puts its cap's apex on the
  shoulder point and names the cap's front and back halves, so a bodice's two armhole edges each
  take a seam; the square shelf at the shoulder goes with it.
- **Added: the open front and partial seams.** `split: 'cf'` drafts a bodice front as two
  mirrored halves with an `overlap_cm` button stand and a `cf` edge; a seam may run over a
  `from`–`to` span of its edges (a vent, a jacket sewn only below the button). Shirts, vests,
  jackets and suits follow as book entries.
- **Added: necklines.** `neck` on the bodice: crew, scoop, v, square, boat.
- **Changed: ease is the tailor's total.** A block's `ease_*_cm` dial is now the whole
  circumference the cloth has over the tape at that line, never less than the stand-off ring;
  before, it was doubled and added on top of the ring, and a suit jacket over a shirt measured
  186 cm around a 102 cm chest. The sleeve is cut to the fullest upper arm at the underarm and
  tapers to a new `bicep` landmark below it.
- **Changed: a sewn piece follows its seams.** On the trunk, a bodice or a skirt hangs at its own
  width per row (or the ring), so a fitted block suppresses its waist; the suspension that carried
  the widest row down stays on the limbs and across a join.
- **Changed: the layering read is honest.** A closed shell ring lifts the charts whose axis it
  encloses (a sleeve the arm alone), the envelope is mean-smoothed so its perimeter is the layers'
  own, the padded form's tape is a horizontal slice of the placed cloth, and a final clearance pass
  pushes any vertex still inside a layer beneath out of it (`cleared` in the readout).
- **Fixed: the trouser hem reads its own height.** Knee-length trousers draft their hem to the
  knee's girth, not the ankle's.
- **Planned:** dress lengths (`midi` / `ankle` / `floor`), `taper` and `cuff_cm`, a `band`
  block, the gathered skirt, darts as sugar, and a `save_recipe` figure lane.

### outfit — apparel in the tailor's terms, translated downward to a named outfit on a turntable

- **The designer's rule.** A pattern garment is drafted on the STAND and worn on the pose: slopers
  read the stand body's charts, so the printable sheet is pose-invariant, while placement and
  seams run on the posed charts and the residual per pose is reported, not fought. Two pattern
  garments on one figure lay out as one SVG document; `create_figure` returns `patternSvgUrl`.
- **Added: the layering rule.** An outer pattern layer is placed on the inner layer's hang, not
  on the skin: every worn stack before it (shells included) lifts the chart rows it covers by its
  stand-off ratio, and the hang rule runs over that. A bodice over a skirt no longer interleaves
  at the hip.
- **Added: joined pieces and the trouser blocks.** A pattern piece may `join` a second chart below
  a piece height, its two placements blended across the join; `trouser-front` / `trouser-back`
  draft one leg on the trunk above the crotch and the leg below it, with a fork, a straight centre
  line sewn to the other leg, and a hem that clears the ankle. Cloth below its widest row hangs
  straight down from it (a skirt no longer dives between the thighs where the trunk's rows shrink),
  a leg chart is capped above its thigh (cloth cannot enter the pelvis), the trunk hull is never
  inside the raw flesh envelope, and a cut-and-sewn sheet gets a depth tie-break against the flesh
  it sits an ease off. Existing charts and shells are untouched.
- **Added: `outfit`.** A figure may be dressed by `outfit` instead of `garment`: a named outfit,
  or `{ fit: slim|regular|relaxed, layers: [...] }` inner → outer, where a layer is a garment
  name, `{ garment, dials, cloth }`, or an inline spec. Core lowers it to the `garment` array at
  render (pure, core tables only); `garment` is unchanged and remains the lowered form.
- **Added: the book's wardrobe lane.** Recipe-book (and cookbook) entries of type `garment` /
  `outfit` — data only — are readable by name from `create_figure`; a book name is resolved by
  value at mint and stamped `from: 'book:<id>'`, so book drift never changes a minted figure.
  Their cards join the sketch-vocab catalog. Named pattern garments leave core for the book:
  `PATTERN_GARMENTS` is gone; `shift-dress`, `a-line-skirt`, `trousers` and the outfit
  `shift-and-trousers` ship as fixture-book entries in the publishable format.
- **Fixed (pattern placement, pre-release).** Cloth centimetres now map onto the ease ring
  (girth + 2π·ease) instead of the skin's arc, so a piece as wide as the ring closes on itself
  instead of wrapping past; blocks draft to the ring. A hull chart's axis is vertical (the band
  centroids drift sideways and had been tilting the ease direction at the bust). Tube-chart
  landmarks are arc fractions, as every reader assumed. The sleeve's arm-length override no
  longer leaks into other blocks.
- **Added: the shoulder line.** The trunk chart gains a CAP: rows over the top of the yoke that
  close to the crest, the line from the neck base to the acromion measured off the flesh, so a
  bodice's shoulder seam is stitched ON the shoulder and cloth there rests a centimetre off it
  instead of standing an ease out sideways. The bodice block reads its shoulder width and slope
  from that crest and its neck opening from the neck's base, and an `over` seam can no longer
  pass through the yoke whatever outline it is given. Before this every bodice began below the
  shoulder with a ragged yoke and a boat neck. Every other chart is untouched. Two readings
  corrected on the way: trunk landmarks are along-arc fractions (they were height fractions read
  against an arc table, so every landmark sat a little off its row), and the hip is the fullest
  row between the waist and the crotch — the tailor's tape, not the glute's centre. The layering
  read now uses the radius ratio to choose the CHART a worn vertex lifts and lifts every row of
  that chart the vertex is level with; choosing the row by ratio handed a skirt's seat to the
  wider belly row above it and left the hip row bare at the front.
- **Absent, byte-identical.** Three pre-branch render hashes are pinned
  (`figure-absent.char.test.js`): a figure without a pattern garment or an `outfit` renders
  exactly as on 2.0.2.

### pattern-garment — a garment cut and sewn from flat pieces, on the existing garment dial

- **Added: `fit: 'pattern'` garment pieces.** A wardrobe piece can now be a flat pattern piece in
  centimetres — an outline, named edges, a body chart to sit on, and an anchor — instead of an
  offset shell. The body supplies a CHART (`body-chart.js`): every named region's posed rings as
  rows with arc-length tables, so a piece lands on the body by arc length (no stretch along its
  own axes) and stands off by `ease_cm`. Pieces mesh as a Coons patch over their outline and emit
  as the open two-sided sheets the renderer already draws; nothing in the mesher changed.
- **Added: seams.** `seams: [{ a:{piece,edge}, b:{piece,edge} }]` pull two placed edges together
  in closed form (average, or eased onto one side) and report each seam's flat lengths and
  `ease_cm` with the tailor's label (`flat | eased | gathered`). No solver: quadrature, not
  relaxation, as everywhere else in the tree.
- **Added: girths.** `bodyGirths(body, { stature_cm })` reads bust / waist / hip / thigh /
  upper-arm circumferences in cm off any figure — the first measured girth in the substrate, a
  perimeter sum over rings that already exist.
- **Added: slopers.** A piece may name a block instead of an outline — `bodice-front`,
  `bodice-back`, `sleeve`, `skirt-front`, `skirt-back` (`pattern-slopers.js`) — drafted at build
  time from the chart's own girths and drops, so one recipe re-drafts on every body. Two whole
  garments ride as dials over blocks (`PATTERN_GARMENTS.shiftDress`, `.aLineSkirt`). A shoulder
  seam is an `over: true` seam stitched across the top of the yoke, the one place a cylindrical
  chart has no row. `create_figure` answers with a `pattern` readout (girths, per-seam ease and
  gap, per-piece strain, warnings) whenever the figure wears one.
- **Added: the sheet.** `GET /api/sketches/<ref>/pattern.svg` lays the figure's pattern pieces
  flat at true scale (1 cm = 1 cm at 100 %, `?page=<cm>` for the page width): outline, seam
  allowance, grain line, notches at every seam end, cut counts (a mirrored piece is drawn once),
  a datum grid and a scale bar. The same rows the body wears, as the 2D face of the recipe
  (`pattern-sheet.js`); a mirrored page is not a second recipe.
- **The hang rule.** Cloth wider than the body cannot compress: it stands off by the ratio and
  keeps hanging below its widest row with a slow taper (the suspension `hullStacks` already
  uses), and below a chart's last row it hangs straight on — a knee-length skirt past the crotch
  row. Cloth narrower than the body is never stretched silently: it reads as strain and as a
  seam gap.
- **Absent, byte-identical.** A figure without a `pattern` piece renders exactly as before; the
  fit list grows by one entry at the end.

### sculpt-brief — brief the external sculptor properly, and measure what it hands back

- **Planned: the mesh handoff's brief becomes named views instead of a contact sheet.** The packet
  hands an image-conditioned generator `reference_urls.turntable` — which is the gallery card's
  strip: sixteen 256×192 cells glued into one ~4096×192 PNG for CSS `steps(16)`. No generator gets
  a usable view of the object from that. A brief plate bakes the named shots
  (`front` / `three-quarter` / `side` / `back` / `top`, `facing`-corrected) individually at
  generator resolution, over the printable set only, so the studio's measuring grid and floor plate
  stop being traced into the sculpt.
- **Planned: a part becomes its own sketch, so one part can be sculpted.** Hero detail belongs to
  one part; today the handoff is whole-object, so getting a detailed helmet resculpts the whole
  figure and throws away every deterministic part. `extract_part` splits at the RECIPE level — the
  named monomers copied into a new workbench sketch, nothing baked — and the host places the result
  back through the `figures.<name>.meshRef` entry that already exists. No new placement machinery.
- **Planned: the return is trimmed to a budget, and the trim is measured.** `budget.triangles_max`
  is a constant in the packet that the submit path gates nothing against, so a 400k-triangle return
  binds silently. The budget comes from the kind and print profile; `simplify: true` on the submit
  trims through Manifold's `simplify(tolerance)` with a measured maximum deviation, and the sidecar
  records what it was trimmed from. Advisory, opt-in, and it degrades to a stated skip when
  `manifold-3d` is absent or the return is not manifold.
- **Planned: the vendor knowledge goes on the catalyst shelf, not into core.** A
  `sculpt-object-externally` catalyst (the mesh sibling of `render-image-outcome-locally`) carries
  the capability ladder and the per-generator notes; `mesh-fit.js`'s up-axis switch becomes a named
  return-profile table. Mojulo still calls no generator and holds no key: `accept_mesh_render`
  requires a different `source` than the submit, so a mojulo that invoked the generator would be
  the submitter with nobody left to be the eyes gate.

## [2.0.2] - 2026-09-11

### openscad-leg — emit the recipe as an OpenSCAD program, not the mesh as a polyhedron

- **Added: `export_model({ format: 'scad' })` + `GET /api/sketches/<ref>/model.scad`.** The one
  ceiling the print leg cannot lift from inside is the field boolean's rounded edge — `union: true`
  unions SHELLS sharply, but an edge the recipe expressed as a sampled field stays rounded to about
  one grid cell, and the honest answer used to be "export and reach for Blender or OpenSCAD." This
  leg hands over the same part as editable exact solids: OpenSCAD's `difference()` computes the
  intersection curve, so the bore arrives with a sharp lip. The BOOLEAN is what is exact — curved
  primitives are still faceted by `$fn` at the head of the file.
- **It transpiles the MANIFEST, not the face payload — and coverage is measured, never claimed.**
  Every other emitter consumes `payload.faces`; one that did the same here would write a baked
  `polyhedron()` with no sharp edges and no dials. This reads the workbench spec after `lowerCuts`
  and lowers each TERM: the nine field shapes, the three booleans, the transforms and both arrays
  map exactly. A term with no equivalent (a `blend`, `stroke`, `displace`, `expr`, a warp, a
  harmonic lathe) is polygonized and frozen with a comment naming what forced it, and the result's
  ledger says how many went each way. A number becomes a named variable only where it provably
  drives the emitted geometry, so a frozen polyhedron carries literals and says it ignores the
  dials. No kind refuses: a world or figure transpiles fully baked with a note naming `stl` as the
  better file. Details, including the full coverage table: [docs/local-openscad-worker.md](../docs/local-openscad-worker.md).
- **Added: `scripts/scad-gate.mjs` + `scad-gate.js`, an optional worker in the settled shape.**
  `MOJULO_OPENSCAD`, then PATH, then the macOS bundle, in `findSlicer`'s pure and unit-tested form;
  render, measure the STL, compare against what `export_model` declared, stamp
  `mojulo-scad-gate.json`. It compares bounding box always and volume when one was declared, and
  **never triangle count** — OpenSCAD tessellates exact solids by `$fn` while mojulo marched a grid,
  so agreement would be coincidence; the stamp says so in-band. Absent the binary it skips with the
  install line. OpenSCAD never enters the render path: a recipe regenerates byte-identically with no
  binary installed, forever.
- **Both gates RUN and GREEN against OpenSCAD 2026.09.10, and the machine gate found a real bug on
  its first run.** Five fixtures rendered, all exit 0 with `Status: NoError`, including a fully
  baked figure whose 34,464-triangle `polyhedron` survived CGAL at an exact size match. Where mojulo
  declared 79.9 mm and OpenSCAD rendered 80, that 0.1 mm IS the prediction — the marched mesh sits
  about half a grid cell inside the ideal solid. The bug: `size_mm` read `facesBounds` over every
  face, so a workbench's studio grid was in the number and a 120 mm disc declared 302 mm; it now
  reads `printSoup`, the printable set the STL writes. Eyes gate: the same recipe emitted as exact
  solids and as mojulo's own field surface and rendered by the same renderer — the exact bore lip is
  a crisp ellipse, the field one carries a visible chamfer all the way round. (Install note: the
  stable `openscad` cask has been disabled since 2026-09-01 for Gatekeeper; use `openscad@snapshot`.)
- **Doctrine fit, stated so it is not re-litigated.** Not a CSG kernel in-substrate and not a native
  mesh reader — a text emitter, which D0 already permits and `scene-usd.js` already proves.
  OpenSCAD's boolean kernel since 2025 IS Manifold, which `union: true` already runs: same math,
  different author, not a rival kernel. The round trip ends there, because OpenSCAD writes no format
  `bind_mesh_render` accepts. `translate_modeler_lingo` (`boolean-cut`, `precision-cad`,
  `procedural-part`), the workbench card and `get_substrate` all name the new exit. Additive
  throughout: every existing format stays byte-identical and no existing pin moved.

### field-normals — ask the field for its normal at every corner

- **Added: `smooth` on `surfaceNetFaces`.** The surface net computed ONE normal per
  quad, at the quad's centre, and `litFaces` turned that into one flat fill — so an analytically
  smooth surface (a smooth-union of exact SDF primitives) arrived on screen as a field of visible
  flat facets. The gradient was always available at any point; it was simply asked 1,288 times
  instead of 5,152. `smooth` samples it per CORNER and the face carries `cornerNormals`.
- **Why it is nearly free: per-vertex colour is already plumbed end to end.** `faceListToMesh`
  already reads `cornerFills` and uploads per-vertex colour, `world-contract` already counts it as
  a fill, and two builders already produce it. The only missing piece was a producer of per-corner
  NORMALS. This is the "flat for now — phase 2 smooths it" the figure-render comment has been
  waiting on.
- **Added: `cornerFills` from the animal's watertight skin.** Carried through
  `animalSkinWatertight` -> `animalStacks` -> `litFaces`; the zone decision (which colour a face
  wears, countershading included) stays per face, and only the shading of that colour varies per
  corner. Stripping `cornerFills` off a smooth payload recovers the flat payload byte for byte.
- **Fixed: the animal vocab card never mentioned `skin: 'watertight'`.** It documented `skin` as
  a boolean, so the surface-net path — the closed mesh, the print path, and the only mode `smooth`
  applies to — was undiscoverable to any agent reading the card. Its "Print lane" limit was wrong
  as a result, stating that a closure audit reports EVERY animal as not closed; measured, the
  marched skin gives `closed: false` (864 boundary edges) and the watertight skin PASSES with zero
  significant holes. Both verdicts are now stated. `coat` was also described as "fur blades over
  the body" when it is paint — strand fur is reachable only through the ringtail.
- **Opt-in, hard.** `smooth` defaults false, so every existing pin, snapshot and export stays
  byte-identical until a kind deliberately asks; turning it on per kind is its own step and its own
  re-pin. What this does NOT change: the geometry, the polygon count, or the silhouette — smooth
  shading fixes the interior of a form, never its outline.

### field-splats — a second emission off the polygonizer's SDF

- **Added: `surfaceSplats` in `lib/graph/polygonizer/field-splats.js`.** The sibling
  of `surfaceNetFaces`: same `(field, bounds, opts)` contract, same uniform-grid walk of the zero
  set, same central-difference gradient — but it emits oriented gaussians instead of quads. Pure and
  deterministic; the coat is placed from the known field, never trained from images.
- **Why: fur is not a surface, and mojulo has the scars to prove it.** `figure-animal-pelage.js`
  is a complete coat builder, rewritten at least twice (its header records flat blades reading as
  "angular spikes"), and `coatBlades` is reachable from exactly one line in the repo — a tail plume.
  No shipped species wears it on the body; the raccoon picks painted `tailBands` over fur outright.
  A quad can only be a surface, so every strand minted to fake volume costs ~36 faces that ship to
  every engine, threaten the closure audit, and are unprintable at hair scale.
- **Added: the `splats` channel.** A `SETUP_CHANNELS` row rendering the coat as
  sorted surfels — quads spanned by the emission's own tangent axes, so they lie in the surface's
  tangent plane instead of facing the camera (which is why this cannot reuse the glow channel's
  sprites). Packed base64 through the page's existing decoders; zero bytes when absent, with every
  pre-existing fixture hash in the char net untouched.
- **Added: `coat: { fur }` on an animal.** `opts.coat.fur` grows the coat off the
  animal's own resolved body faces — which came from the skin field via the surface net, so the
  coat is field-derived while still inheriting planting, lighting, and the body's final colour.
  That last part is load-bearing: a coat over a differently-coloured body reads as a halo,
  because the opaque body eats the dense inner shells and only the silhouette survives. The body
  is the innermost shell. Fur grows only where the coat PAINT already is, so paw pads and nose
  leather stay bare. No shipped build is re-pointed yet.
- **Proof, not intention: a coat changes nothing mojulo fabricates.** With a coat present the
  faces, the STL printable set, the GLB, and the world-contract tier are byte-identical to the
  uncoated animal, and `splats` is the only payload key added — asserted, so a later change that
  leaks splats into the printable set or the tier ladder fails loudly.
- **Scope: the soft register only.** Splats never declare a surface — they contribute nothing to the
  T0-T4 world contract, are ignored by the STL/3MF printable set, and are skipped by the closure
  audit. A coat cannot break a print or move a tier by construction. Rooms and the box worlds are
  explicitly out: measured at 200x-2500x the primitives for a visually identical result, with
  crenellated edges where a quad had an exact straight one.

### Docs and registry metadata

- **Changed: Windows is described as verified natively, and the READMEs say what still is not.**
  Both READMEs and `docs/tech-requirements.md` now separate what has been run on Windows from what
  has not, rather than implying parity.
- **Fixed: the registry listing fits the hundred characters it allows.** `server.json`'s description
  was over the limit the registry enforces.

## [2.0.1] - 2026-09-10

### `--help` answers, the ledger tool is named for what it is, and the registry fields

- **Added: `mojulo --help`, `-h`, bare `help`, `--version`, `-v`.** A bare `npx mojulo --help` used
  to fall through to stdio-server mode and, with nothing on stdin, exit with no output at all — the
  first thing a stranger types printed nothing. The flags are answered before the loader, paths and
  console pin, so usage prints at once; `help <tool|pack>` still goes to the CLI.
- **Renamed: `get_tool_telemetry` → `get_tool_ledger`.** The tool reads the ledger the substrate
  keeps of its own MCP tool calls — shapes and timings, never values, never leaving the machine —
  and its old name sat in `npx mojulo tools` output beside the no-telemetry promise. Its
  description now leads with what it is. No alias: nothing shipped had wired the old name.
- **Changed: the first-connect surface leads with the factory.** `PACKS` is reordered so
  `tools/list` and `npx mojulo tools` show the studio packs first — `pack_object`, `pack_world`,
  `pack_game`, then views, motion, audio, voice, illustration, reference, image render, diagram —
  and the office packs after, with the three install-gated chatbot packs last. Nothing is hidden
  or removed; only the order changed. `get_substrate`'s description now opens on the 2.0 pitch
  (Media and Game as recipes, the two pipelines, the retained backend) instead of "the five
  paradigms".
- **Changed: `archiver` 7 → 8 and `better-sqlite3` 12 → 13.** The two dependencies that carried
  npm's deprecation warnings on a cold install: `archiver@7` pulled `glob@10` ("widely publicized
  security vulnerabilities"), `better-sqlite3@12` pulled `prebuild-install` ("no longer
  maintained"). `archiver@8` drops its default export, so the bot stager now imports `ZipArchive`;
  `better-sqlite3@13` is N-API and ships its prebuilt binaries in the package. Two benign warnings
  remain upstream of what this package can pin: `boolean` (via `onnxruntime-node`) and
  `node-domexception` (via `node-web-audio-api` → `node-fetch`).
- **Removed: the AWS Bedrock provider.** Bedrock was wired end-to-end (settings, wizard branch,
  `generateSummary` / `generateStructured`, the builder stream, the deployers) but hidden from
  the provider picker since 1.x, and it pulled the whole `@aws-sdk/client-bedrock-runtime` tree
  into every install. The provider entry, the four region/model-id helpers, the two Bedrock
  generators, the builder-stream branch, the wizard credential form, the deployer env lines and
  the five locale strings are gone, and so is the dependency. Providers are now Anthropic,
  OpenAI and Ollama. A saved `bedrock` row in `api_keys` from an older install is ignored.
- **Docs: why these dependencies.** Both READMEs and the trust page now say what the heavy
  dependencies do on the operator's machine.
- **Changed: `package.json` metadata.** `mcpName: io.github.zombico/mojulo` (required by the
  official MCP Registry's npm validation), `homepage` now `https://mojulo.ai`,
  `repository.directory: control` so npm resolves the README's relative paths, and keywords
  `gltf` and `blender`.

### The Data page reaches the repo (gitignore anchor)

- **Fixed: `control/.gitignore` ignored every directory named `data`.** The rule `data/` was meant
  for the SQLite home at `control/data/`, but unanchored it also swallowed the dashboard's Data
  page (`app/data/`, six components) and its four API routes (`app/api/data/`), so they existed
  only on the maintainer's disk: a fresh clone built a dashboard whose bots page linked to a
  `/data` that was not there, and CI's carve-fence ledger (`pack-boundary.test.js` check G)
  disagreed with the local run on every push. The rule is now `/data/` and the ten files are
  tracked. The published npm package was never affected — it is built from the local tree.

## [2.0.0] - 2026-09-10

**Mojulo 2.0 is the 3D-factory reposition.** An agent builds objects, worlds and games by
conversation as deterministic recipes, and hands them to Godot (a real project), Unity and Unreal
(data pack + importer, gated), Blender (art pass), OpenUSD, or a printer (STL / 3MF at true scale with
a slicer gate). Nothing was deleted; the automation backend is retained and demoted. The full
record follows, newest theme first; the three breaking changes are:

- **The chatbot factory is opt-in.** A default install no longer carries it. `mojulo install chatbot`
  adds it back; already-deployed bots are unaffected (they run from the separately versioned
  `bot-v*` image). See "Mojulo 2.0 — the pure-creative reposition".
- **The plain `.glb` lands at true size.** A unit-labelled recipe's glTF root now carries its scale,
  so a 9 cm mug imports 9 cm tall instead of 9 m. The glTF bytes of unit-labelled recipes change;
  label-less recipes are byte-identical. See "Launch fall-shorts".
- **The fractal city declares metres per unit (exports only).** Every city GLB, USD and engine pack
  re-exports 3.66× larger, in metres, with the score in step; the web render is untouched. See
  "A minted building in the generated city".

Also new since 1.5.0, in brief: the Unity and Unreal legs, the Blender destination leg and the
Cycles GI bake, OpenUSD and 3MF export, the slicer machine gate (PrusaSlicer, Bambu Studio), Manifold
union, skinned and VRM glTF, the mesh-worker handoff, field solids and `cuts[]` booleans on the
workbench, `levels[]` on the floorplan kind, the print advisory (process limits, overhang, walls),
`translate_modeler_lingo`, host neutrality (hosts as declared profiles), and the two READMEs and
`get_substrate` rewritten around the factory.

### An opened pack describes each member once (pack-unveil-dedupe)

Opening a studio pack returned the FORM body (one full paragraph per member, with its recognizer
tail) and then the member manual (the same tool's full description again, beside its schema).
The world pack cost about 13.8K characters for five tools.

- **One-line member index over one authoritative manual entry.** The unveil now carries the
  form's `makes` line and each member's FORM row cut at its first sentence; the tools/list
  description appears exactly once, in the manual. `get_creative_toolset` still serves the full
  FORM body for flat mode. Office packs, whose bodies are short prose, are unchanged. Pinned in
  `packs.test.js`.

### A no that carries its next move — `REF_EXISTS` (tool-refusal)

Minting with a ref that was already taken threw a bare "already exists" sentence from each of
some eighty call sites (every view, world, solid, beats and voice mint wrapped the same SQLite
UNIQUE failure by hand). An agent hitting it had to go back to the manuals to find the revision
tool, and the audio mints did not even name it.

- **`ToolRefusal`** in [lib/errors/tool-refusal.js](lib/errors/tool-refusal.js): an Error that
  renders itself as a JSON tool result (`isError: true`) with a stable `code`, the offending value,
  a `next_action` naming the tool to call, and `read_first` where a reader exists. `message` stays
  readable so the CLI, plan-step records and logs still say what to do. `dispatchMcpRequest`
  renders it on every call path (rpc, HTTP, stdio, pack dispatch).
- **`REF_EXISTS`** is thrown once, from `SketchRepository.create`, for every sketch-backed mint:
  beats refs point at `update_beats` (read `get_beats` first), a voice register points at
  `create_voice` under a new ref (voice never revises), everything else at `update_sketch`, plus
  the render URL and the omit-ref alternative. The per-tool UNIQUE catch wrappers are deleted;
  the mints call the repository directly.

### The substrate drawer says what it does (substrate-effectiveness)

`get_substrate` opened with the "PLAYful Cloud" framing: a PLAY acronym, the agent as "the grip in
the middle of the staff", a tri-staff, an essay on which cloud verbs mojulo borrows. None of it
changed what a connecting agent said or did next, and it cost every meta-question read.

- **The drawer now carries operating facts only.** What mojulo is (the one-breath answer and the
  five paradigms), the digital and physical pipeline claims and their honesty rule, "3D" as a
  pipeline-position claim, bots as an optional pack, inference running on the connecting agent,
  recipes as source with the promotion gates, what always-on requires, what the contextmap does and
  does not record, office routing by ask shape, and the cloud properties mojulo does not have
  (auto-scaling, multi-region, multi-tenancy, IAM, per-call billing). The substrate facts are
  unchanged. The framing devices, the acronym and the metaphors are gone from the drawer, its
  tools/list description, the `forward_context` pointers, the preamble comment and the architecture
  doc.
- **Description budget.** The `get_substrate` description now fits the 700-char ceiling on its own,
  so its allowlist entry in `tool-descriptions.test.js` is deleted per that test's shrink-only rule.

### README reposition — 3D asset generation leads (docs)

- **`README.md` refactored around the factory.** The opener states the ladder (object → world →
  level → game) and the two pipelines out; "What you can make" is organised by 3D kind (objects at
  literal scale with `cuts[]` and `measure_solid`, figures and animals, stacked floorplans, cities,
  drivable worlds, games, the assets that fold in); a new "Where it goes" table lists every target
  with what it emits and which gate runs, laddered as `get_substrate` says (Godot first-class,
  Unity and Unreal gated legs, Blender an art pass, STL/3MF with the slicer gate); "Recipes, not
  renders" carries iteration, the cookbook and the recipe book. Publications, research, directed
  images, connected services, apps and the chatbot pack fold into one "Also in the box" section.
  The quickstart's first look is a mug → city → walkable world → game → Godot sequence, and the
  export CLIs and 3D workers get their own subsections. Stale figures fixed against
  `docs/tech-requirements.md` (install size, embedding model size, the "nothing is fetched at
  runtime" claim now lists the lazy downloads); the enumerable counts (species, protocols, docs,
  slice kinds) are gone.
- **`control/README.md` (the npm page) follows.** Same shape at npm length: the ladder and both
  pipelines in the opener, a 3D-first "What you can make", the two-gate rule in "Why it's
  different". Fixed a false claim that every artifact writes the contextmap (studio mints do not;
  only office-wing bindings do), the "Godot + glb only" handoff line, the locale and binary counts,
  and the quickstart step that set an Anthropic key under a chatbot comment. Links added for
  tech-requirements, bicycles, the Night Run example, and every worker doc.

### Launch fall-shorts — the glTF root carries the recipe's units, forgiving workbench specs, one truth about manifoldness (launch-falls-short)

A first-session loop run cold on 2026-09-09 (mug → measure → edit → export → slicer gate → Blender
verify) found three things the site's floor example promised and the tree did not quite keep.

- **The plain `.glb` lands at true size (BREAKING for the glTF bytes of unit-labelled recipes).**
  `resolveWorldScene` now derives `payload.metersPerUnit` from a recipe's own `units` label
  (`declaredUnits`, source `manifest`) when neither the kind nor the recipe set one, so the
  workbench family's glTF root is scaled like its USD already was: a 9 cm mug imports 9 cm tall in
  Blender, Godot, Unity and Unreal instead of 9 m. Kinds that declare their own unit keep winning;
  a label-less recipe is byte-identical. The glb result reports `meters_per_unit` + `size_units`,
  so `verify-usd.mjs --glb` gets a real `size_m` check (it was `null` and passed the 9 m mug).
- **Workbench specs take both point shapes.** Sweeps accept `{x,y,z}` path points and lathes /
  extrudes accept `[x,y,z]` endpoints (`canonicalizeMonomers`, identity for canonical recipes);
  the material shelf resolves plain-word aliases (ceramic → satin, iron → gunmetal, brass →
  bronze, …) and the refusal says so. The workbench card gains a twelve-line quick start and
  stops calling `units` informational.
- **The slicer gate unions by default.** `slice-print.mjs` exports with `union: true`
  (`--no-union` opts out), stamps `union` under `declared`, and explains a slicer `manifold:
  false` with `manifold_note` instead of leaving it beside `measure_solid`'s "one solid".

### Tech requirements orientation (docs)

- **`docs/tech-requirements.md`.** One page of full disclosure for the site and for anyone confused
  later: Node floor, measured package and dependency footprint (dated, with the per-dependency
  breakdown), the lazy first-use downloads and where they cache, network posture, what each engine
  leg emits versus what the operator must install (Godot, Unity, Unreal, Blender, slicers), the
  optional workers, the chatbot pack, platform notes, and a "what the site must not claim" list.
  Records the discrepancies found while measuring (understated size figures, browser/ffmpeg caches
  outside `$MOJULO_HOME`, a floating AWS SDK range that broke a fresh install on 2026-09-09) without
  fixing them. README quickstart links to it.

### The building stacks — `levels[]` on the floorplan kind (paris-t4-stack)

A `floorplan` sketch was one storey. The multi-level kernel (`structurizeHouse`: one meru, per-level
plans and heights, stairs through the slabs, one roof on the top footprint) existed but no sketch
kind reached it, so a six-storey building could only be minted as six unrelated floors.

- **`levels[]` on the `floorplan` kind.** A floorplan manifest may carry
  `levels: [{ index, height, rooms, halls, doors, windows?, ceilings? }]` plus the house knobs
  (`stairs[]` with anchors, `explode`, `roof`, `view: 'exterior'`). The world kind routes such a
  manifest through the new `assembleHouseWorldScene` (the assemble-shaped sibling of
  `renderHouseToThreeWorld`, which now emits from it); the STILL path (`scene-html`) bakes the same
  manifest through `renderHouseToHtml`, which now honours `explode` like the World. A manifest
  without `levels` resolves exactly as before — byte-identical, pinned by the existing kinds snapshot. Each level extrudes its own
  footprint, so a set-back penthouse stacks on full-width floors and the roof caps the top one.
- **Validation and the mint-time improver know a stack.** `validateSketchManifest` accepts a
  floorplan with `levels[]` (no top-level `seed` / `rooms` needed); `improveFloorplanManifest`
  passes a stack through untouched instead of grading a seed-generated single floor and possibly
  writing top-level `rooms` into the recipe. Multi-level grading is not built.
- **Set-back terraces are real decks.** Where a storey's footprint reaches past the one above
  (a penthouse pulled back from the street), the upper floor slab now continues over the uncovered
  strip as a solid deck with a balustrade on its open edges (`terraceTint`, `terraceRailTint`,
  `terraceRailHeight`), tagged `group: 'terrace'` and riding the upper level so an exploded read
  lifts it with its floor. Before, the storey below was open to the sky there — the only cap was
  a ceiling plane, which the World fades for an overhead camera. Identical footprints subtract to
  nothing: a straight stack adds zero faces.
- **Fixed: an authored stack with `stairs[]` threw.** `structurizeHouse` read the program
  generator's reserved stair zone unconditionally; explicit per-level `rooms` never set one, so any
  hand-authored multi-level house with a stair crashed on a null deref. The anchor now derives only
  when a zone exists; an explicit `anchor` on the stair spec seats the flight, as documented.
- **Fixed: a furnished stack overflowed the call stack at camera framing.** The house scene's
  z-range spread every face corner into one `Math.min` / `Math.max` call; a furnished six-storey
  stack has millions. It is a loop now, same numbers for every house that framed before.
- **Not built:** per-side window control (party walls still take windows), a lot around a stack
  whose levels differ in footprint, per-level door heights.

### Cuts — a hole is a line in the recipe (parts-booleans B1, B2, B4) + the Bambu Studio slice (text-to-cad-seam T6)

The workbench could cut only inside a `fields` monomer; a flange authored as a lathe and a bolt
circle authored as sweeps had to be REWRITTEN as one field term list to bore the holes. Now the
recipe says it in a line, and the slicer gate has met the slicer most hobby printers actually run.

- **`cuts[]` — booleans between NAMED monomers (B1).** A workbench recipe may carry
  `cuts: [{ id?, from, subtract | intersect: [ids], cells?, blend? }]`. Monomers gain an optional
  `id`; a cut names its body and its operands by id, and the workbench does the rewrite: each
  named lathe / solid extrude / sweep / field is taken OUT of its array and re-expressed as its
  field twin, and ONE `fields` entry is emitted (`add` the body, then `subtract` or `intersect`
  each operand; `blend` fillets the rims), keeping the body's `tint` / `material`. The emitted
  field's `id` is the cut's (default `cut:<from>`), so a later cut can consume it — a cut of a
  cut. Kinds with no field twin (lofts, shells, drapes, reliefs, a shelled or tapered extrude, a
  wrapped monomer) refuse by name at mint; so do an unknown id, a duplicate id, an operand used
  twice, or an operand that is its own body. The lowering is a RENDER-TIME seam
  (`polygonizer/workbench-cuts.js`) in front of every consumer — the World, the stills, the
  export, `measure_solid`, the wrap collector — so the recipe stores the monomers and the cut,
  never the rewrite, and `update_sketch` moving a bore re-cuts. Absent `cuts`, the manifest
  passes through by identity: every existing workbench re-renders byte-for-byte. The stills
  depict the hole because they consume the same faces. Kernel ceiling unchanged and said in the
  result: every cut edge rounds to about one grid cell (`cells`, default 64) — `stats.cuts`
  lists each cut with its rounding in units, a `cut_rounds_edges` warning names it, and the
  per-part readout shows the cut part as ONE field part (`cut`, `from`) because the flange with
  holes IS one part now. Sharp edges stay the export's business (Manifold `union: true`);
  B3 (a Manifold `cut` at export) is not built.
- **The manuals and the router (B2).** The workbench card gains a `cuts` section beside
  `assembly`, and the two sentences that said "author the part as a `fields` monomer" now say
  "or name the parts in `cuts`". `translate_modeler_lingo`'s `boolean-cut` entry routes to the
  `cuts` form first, the hand-written term list second; `support` stays PARTIAL. The export
  ledger's `field_solids` block lists the cuts (`field_solids.cuts`), and `measure_solid` returns
  `cuts` beside `parts`.
- **The advisory sees the hole (B4).** `declaredFeatures` reads `cuts`: a sweep or lathe named as a
  `subtract` operand is a BORE, not a strut — its diameter is reported with role `bore`, and a bore
  under the process floor is a `tiny_feature` worded as a hole that will close up, instead of the
  old "prints as a thread" line that described a hole as a rod.
- **Bambu Studio in the slicer gate (T6, now run).** Bambu Studio 02.08.02 installed on this
  host and driven headless on the hook's 3MF with the A1 0.4 nozzle system profiles straight from
  the app bundle. Four things the wiki read did not say, each now in the driver and pinned by a
  test on the real output: the CLI HAS `--info` and prints PrusaSlicer's block (`size_x`,
  `manifold`, `number_of_parts`, `volume`), so `size_agrees` is real for this family (81 × 30 ×
  33 mm, agrees); the system profiles `inherits` from common presets and the CLI resolves them
  itself; Bambu's profile names say the printer, not the role, so `--profile` also takes
  `machine=…;process=…;filament=…`; and the plate G-code lands as `plate_1.gcode` in
  `--outputdir`, not under `--export-slicedata`. The header parser learns `[cm^3]`. The hook:
  165 layers at 0.2 mm, 1 h 15 min, 3,311 mm of filament, no supports, grams 0 because the
  profile carries no density. A scratch `--datadir` keeps the run out of the operator's GUI
  settings. The stamp says `verified: true` for `bambu`; OrcaSlicer shares the CLI and stays
  marked unrun. Eyes gate (the sliced project opened in the GUI) still open — no printer here.

### The print leg measures — process limits, overhang and sampled walls, the CAD return door (text-to-cad-seam T1–T6)

Reading `earthtojake/text-to-cad` (the mechanical-CAD neighbour: build123d over OpenCascade,
the same recipe-is-truth / advisory / look-before-handoff doctrine, no kernel overlap) turned up
three things its print leg does that ours did not, and one honest sentence ours owed. The hook
demo made the case concrete: PrusaSlicer's stamp said `supports: false` and a human found the
J arm's overhang; Grok's chariot signature reports the same catch at the eyes gate. Now the
stamp says it. Design + the neighbour survey: `lite-template/integration/0907/text-to-cad-seam.plan.md`.

- **Process limits (T1).** `printer.process: 'fdm' | 'sla' | 'sls' | 'mjf'` picks a row of
  `PROCESS_LIMITS` (`print-advisory.js`): wall floor, `self_support_deg` (null = powder supports
  everything), layer, a typical bed, and whether the process traps material. Explicit fields
  still override; a resolved profile round-trips. Resin / powder get a stated `trapped_volume`
  advisory (cavities need an escape hole; not measured). The advisory head names the process.
  Numbers are design-guide defaults with their sources in the table's comment.
- **Measured printability (T2) — `scene/print-measure.js`.** Over the very millimetre soup the
  STL / 3MF carry (post-union when `union: true`): `overhang` (area past the process's
  self-support angle, steepest angle, faces), `support` (footprint; a column-to-bed volume
  BOUND), `walls` (SAMPLED by one inward ray per triangle — up to 20,000 — counting shell depth
  so overlapping un-unioned shells read the union's depth; faces buried inside another shell and
  flush joints are set aside and counted), and an `orientation` hint (the axis of six with the
  least support footprint). No distance field, nothing in the recipe, deterministic. Rides
  `export_model` and `measure_solid` as `print_measure`, two new advisory kinds
  (`thin_wall_measured` at the 5th percentile, `overhang` with the better axis), the note, the
  README, and the slicer stamp's `declared.measure`. On the hook: 1,126 mm² of 90° overhang,
  best axis `y+` (on its side — what the demo plan guessed), walls thinnest 4 mm (the jaw).
  A closed cavity's ceiling is a bridge and is reported as one. Tests: `print-measure.test.js`
  (cube, T, inverted pyramid at 45°, hollow box, overlapping shells, flush joint, double wall,
  sample stride), and the export / measure suites re-pinned on the new profile shape.
- **The honesty sentence (T3).** `translate_modeler_lingo` gains `precision-cad` (tolerances,
  threads, gears, press fits, mates, STEP, B-rep): a HANDOFF — the workbench gets the FORM, a
  B-rep tool (text-to-cad, FreeCAD, Onshape) gets the FIT — with `bind_mesh_render` as the
  return door; `3d-print` names the measured rung and the second worker roster (a host's
  printability skills); `chamfer-fillet` points at it; the workbench routing card forks to it.
- **The return door (T4).** `bind_mesh_render { units: 'mm' | 'cm' | 'm' | 'in' | 'ft' }`
  (or a bare `scale`) converts a CAD GLB's unit into the sketch's declared unit — recorded on the
  SIDECAR as `source_units` / `scale_applied`, bytes untouched; the meshRef lowering composes it
  with the placement's `transform.scale`, so a 40 mm bracket lands as 4 cm in a cm workbench.
  `expected_box` (the CAD tool's own bbox, in file units) runs the worker path's 0.5×–2× size
  gate on a manual bind. A CAD-tagged `source` gets the not-travelled ledger (B-rep exactness,
  mates, materials; the .step stays the source). Absent `units`, byte-identical behaviour.
  `describeBoundMeshes` surfaces both fields. Tests: `bind-mesh-render.units.test.js`.
- **`print-object` catalyst (T5)** — the print bicycle written from the hook run: measure →
  export → the machine gate by what the host has (PrusaSlicer family via `slice-print.mjs`, or a
  printability skill over the same 3MF, or rung 0) → the eyes gate with the measured faces to
  look at → the read filed as a revision note.
- **Orca / Bambu Studio CLI (T6) — UNVERIFIED.** `slice-print.mjs` drives the `orca` family
  with the flags Bambu Studio's CLI wiki documents (`--load-settings machine;process`,
  `--load-filaments`, `--slice 0 --arrange 1`, `--export-3mf`, `--export-slicedata`): JSON
  profiles are REQUIRED (no defaults — absent, it skips with the reason), there is no `--info`
  twin (`size_agrees` null), the plate G-code is parsed by `parseOrcaGcodeHeader` (its own
  ledger keys). No Orca on this host: the stamp carries `verified: false` and a note until a
  real run lands. Pure halves (`orcaProfileFiles`, `orcaSliceArgs`, the parser) are unit-tested.
- Registry: no new listed tool; `measure_solid` and `export_model` descriptions trimmed to
  routing grade to fit `bind_mesh_render`'s three new properties under the unchanged 261,000 pin.

### Unreal demo — connected project levels

- **Stickers keep their blend (leg 0.4.2).** The importer swapped every mesh slot onto the opaque
  mojulo master, so the GLB's two `KHR_materials_unlit` + `alphaMode: BLEND` materials — the
  contact-shadow stickers under the furniture and the window panes — drew as solid grey slabs in
  every rendered Unreal frame of the lounge (eyes gate 2026-09-09; `materials_unlit` counted the
  slots and could not see it). `import_mojulo.py` now reads the GLB's JSON chunk for those
  materials and puts their slots on a third master, `M_MojuloSticker` (unlit, translucent,
  two-sided, emissive = texture × vertex colour, opacity = vertex alpha × texture alpha), by
  material name or, on a re-run over a swapped project, by one-slot mesh name. The verify count
  is unchanged: the sticker instances live under `Materials/` like the rest.
- Still open from the same frames: no engine pack shows the oak grain. The lounge GLB carries the
  floor as `floor:skin` (untextured plank coat, z 0.019 ft) over `floor:skin:wood-oak` (the
  texture, z 0.015 ft); Godot and Unreal both draw the coat, tan in one and white under Unreal's
  sun and auto-exposure, and only the Cycles frames show the grain. Which layer should win is a
  bake question, not an importer one. Beware the fresh-project first render: with seventeen
  Nanite meshes still building it drew the oak because the coat was not there yet.

- **The worked example ships.** `docs/examples/unreal-night-run/` carries the eight Night Run
  recipes, a one-command mint, and the project-side scripts and config lines that turn a copy of
  Epic's Game Animation Sample into the playable three-level game — so the demo is reproducible
  from a checkout, not from one machine's database.
- Optional project-side Niagara depiction paths decorate pickups, hazards and exits;
  missing assets retain marker behavior and do not block play.

- Foreign-pawn auto-walk sends forward input through the player controller and
  reports actual displacement at screenshot time. `-MojuloAutoJump=<seconds>` taps Space at
  that time and logs where the jump began, so a narrowed gap is checkable by the pawn's
  height at the shot. A recipe's `walk.yaw` (degrees, counter-clockwise from +x) rides the
  score as `yaw` and turns the PlayerStart, so held W heads where the level intends.
- The iteration beat is machine-proven: `update_sketch` moved a rooftop platform, the lit
  pack re-exported, the project re-imported, and the persistent dressing (light GUID, transform,
  intensity), game mode and depiction asset survived while the imported platform moved by the
  edit. Eyes gate not run; traversal of the narrowed gap unverified.

- In progress: optional project map routing lets the game menu open persistent levels
  containing generated sublevels, retaining project-owned characters and dressing.
  Default pack map paths remain the fallback.
- Cave lit exports now bypass traced lighting and carry chamber/tunnel sources as
  native point lights. The ordinary baked world path remains unchanged.
- Optional `walk.ground` positions the fallback plane below descending levels;
  absent it, the existing zero-height plane remains.
- **BREAKING (exports only) — the city says what a unit is.** The fractal city is authored at
  a town scale (a storey is 0.82 units), so every city export at 1 unit = 1 m read as a toy
  beside an engine character. The kind now declares `metersPerUnit` 3.66 (`CITY_METERS_PER_UNIT`,
  a storey read as 3.0 m — the value the operator's eyes gate passed), so every city GLB, USD,
  Godot, Unity, Unreal and Blender pack re-exports 3.66× larger, in metres, with the score in
  step. The web render is untouched. A recipe may override with its own `metersPerUnit`, and any
  world recipe may declare one: `resolveWorldScene` puts it on the payload when the kind has not
  declared its own (the floorplan's feet still win). New in the same change: the `at` / `radius`
  of every declarative mechanic (zone, pickup, hazard) scale too — a kernel reads them as
  metres, and the floorplan's feet had silently left them unscaled.
- **The sky travels (D2).** Under the lit export the city's bakes stand down but the recipe's
  declaration now rides the payload: the `sky` preset, and each streetlamp head as a `lights`
  point emitter (sampled by the same `maxLamps` cap as the night bake). The engine score gains a
  `sky: { preset }` row whenever a payload names one (any kind, any pack; absent ⇒ no row). The
  Unreal importer's light rig reads it: `night` turns the sun into a dim cool moon so the
  atmosphere goes dark and the lamp lights carry the scene, `dawn`/`dusk` set a low warm sun,
  and any outdoor preset spawns an ExponentialHeightFog. The dungeon's lit export declares
  `interior`: sun off, faint sky light, no fog, an exposure bias, the traced fires carry the
  cave (the first lit cave shot was auto-exposed to white). No preset ⇒ the pre-D2 rig, unchanged.
- **The lit fallback ground is a floor, not a void.** Hidden, the promoted ground plane showed the
  atmosphere below the horizon as black in every lit shot. Under `--lit` it is now visible in a
  neutral matte (`M_MojuloGround`), its top 2 cm under mojulo ground so the recipe's own floor
  faces win. Unlit packs keep the hidden plane. `unreal-project` snapshot re-pinned for the
  importer text (rig + ground + guide sentences).

### Package design — the carton takes a wrap, the assembler keeps the labels (soda-product-shot)

Building a six-pack for a Cycles product shot found two gaps at the texture seam. Only a
lathe took a `wrap`, so the printed carton — an extrude — had no way to wear its art; and the
assembler lowered each frozen part with its own `wrap_0` key and never resolved a texture map,
so a labelled can lost its label the moment it was placed beside anything.

- **`extrudes[].wrap`** — the lathe's label contract on a prism (`extrude-faces.js`). A prism's
  side is developable exactly like a cylinder's: u runs along the profile's perimeter in its
  winding order, each wall taking its edge's share, v runs along the axis; `seam`, `repeat` and
  `lit` as on the lathe; no band (a carton is printed edge to edge). Side walls only — a shell's
  outer walls — caps, rims and cavities stay bare. `workbench.js` keys them `xwrap_<i>` and
  `collectWrapSources` lists them after the lathes, so every source kind (`svg`, `dataUrl`,
  `sketchRef`, `outcomeRef`) and the `.glb` texture export work unchanged. Absent a `wrap`, every
  face is byte-identical (pinned).
- **Assembler labels.** `bakeOriented` scopes a part's texture keys per item
  (`p<index>:wrap_0`), `collectAssemblerWrapSources` lists the sources under the same keys, and
  the `assembler` world kind resolves them (`resolveAssemblerWrapTextures`) into the payload's
  texture map — so the can and the carton keep their prints in the assembly, in `/world`, and in
  the lit export. Absent any wrap, `{}` and byte-identical.
- **A rect's panel order does not depend on its corner radius.** A sharp rect's profile starts
  at its (+w/2, −h/2) corner; a rounded one starts on the (+w/2, +h/2) arc and closes with the
  +x wall — so the same print landed one face off between the two. The wrap's u origin is
  anchored at the start of the +x wall for rect profiles either way (points profiles keep the
  author's first point). Tested on a rounded rect.
- **GLB textures were upside down in every reader.** `facesToGlb` wrote TEXCOORD_0 in the
  viewer's bottom-left convention (three.js flips images on upload); glTF's origin is the top-
  left, so Blender, Godot, Unity and Unreal showed every label wrap and skin atlas inverted.
  The writer now emits `1 − v` and `glbToFaces` flips it back on ingest, so export → read is
  identity and a bound external mesh's texture reads right way up in `/world`. Repeating tiles
  flip the same way (a wrapping sampler resolves `1 − v` as it resolved `v`). Found by the
  first Cycles frame of the six-pack. Tests: `scene-gltf.texture.test.js` (the file is
  top-left), `scene-gltf-read.texture.test.js` (round trip is identity). One byte pin moved
  with it, on purpose: `skin-baseline.char.test.js` (GLB transport sha) re-pinned with a dated
  note; bytes, nodes and triangles unchanged.
- The tool schema and the workbench card document the extrude wrap and the `[side | front |
  side | back]` layout a carton's wrap takes. Tests: `extrude-faces.test.js`,
  `wrap-textures.test.js`.
- **Dense polygomers stage.** `assembleBoxCityScene` spread a polygomer's whole face list into
  `push` (`faces.push(...extraFaces)`); three field-solid cans beside a carton — ~185k faces —
  overflowed the call stack and the assembler refused the manifest. Looped (and the same for a
  world asset's faces); output byte-identical. Test: 200k faces through `studioSceneFromFaces`.

### World contract tiers — every pack says what it declares (world-contract-tiers W0–W2, W5)

Every finding the lit handoff produced last week was a property the base runtime never
needed and a downstream reader could not do without: back-faces bake black (`outNormal`),
the lounge lands at 3.28× (`metersPerUnit`), a sealed room imports black (`lights`), the sun
has to come through the panes (openings). Each arrived one at a time, at the most expensive
gate that happened to be open. The fix for the class is to say what the base must carry and
what each extension demands, and to measure it per kind in `lib/`.

- **`worlds/world-contract.js`** — `WORLD_TIERS`, plain data: T0 coherent (faces, fills, a
  walk seat, a floor under the spawn, valid units), T1 baked (`outNormal` on every face, lights
  in the `KHR_lights_punctual` shape), T2 transported (a walker's eye between 1.0 and 2.2 m
  after `metersPerUnit`, lights inside the world, a locomotion row where rigs exist), T3
  materialized (every face names a material or texture; every texture key resolves), T4
  physical (physical intensity and cones on every light; units declared, not inferred). Each
  tier names its gate and its witness engine. `assessWorldTier(payload)` measures the
  declarations only and returns the tier declared, the next tier, and what it is missing,
  `declaration — reason` per line. Monotonic, advisory, per kind; the gates stamp attainment.
- **The ledger row.** `extractEngineScore` carries `ledger.contract = { tier, next,
  missing_for_next, note }`, so every Godot, Unity and Unreal pack states what its level
  declares and what the next tier would need, in the README and the T-numbered guide.
- **The pin.** `world-scene.kinds.test.js` snapshots a `tier` beside the hash for every
  walkable kind. A dropped `metersPerUnit`, a lost walk seat or a light channel that stops
  riding the payload moves that cell here, not in an engine.
- **One unit table (D1).** `scene/world-units.js` is the only place a unit label becomes a
  number: `UNIT_TO_M`, `metersPerUnitFor`, `unitMillimetres`, and `AUTHORING_UNITS`, the
  kinds whose recipes are authored in a unit they never state (the floorplan family: feet).
  `declaredUnits(manifest)` reads the manifest's label first, then the family's. The print
  leg, the USD leg and the Blender pack read it; `structurizeFloorplan` returns `units` and
  `metersPerUnit` and both floorplan assemblers forward them. Consequence: a floorplan's
  USDZ now declares `metersPerUnit 0.3048` where it declared 1, so it lands at true scale in
  Quick Look; the restaurant forwards its pot lights and its unit, both dropped before.
- **The inverse door.** `glbToFaces` now undoes the uniform scale on a `mojulo` root that
  carries `moj:metersPerUnit` (the changelog already claimed this; it was not in the tree —
  a 10 ft edge read back as 3.048), and reports the factor as `ledger.metersPerUnit`. The
  mesh handoff and the Blender return compare in recipe units again.
- **`imports_dark` (W5).** `assessPortability` gains one advisory: a ceiling over the spawn,
  no lights, no openings — the check that would have caught the black-sky box in `lib/`.
  Reported, never gated.
- **W4, recorded.** The no-skip rule was applied this week before it was written down: the
  Godot lit gate found the candela clip (kernel 0.2.1), the Unity materials probe measured the
  lit lounge, and the Unreal light pin held at 9 of 9. Godot's is headless and cheapest; it
  runs first from here on.
- **What the first measurement said.** The lounge with pot lights declares T2 (every face
  carries `outNormal`, four lights in shape, the eye at 1.62 m); its T3 gap is honest: no face
  names a material, so the PBR Unity built is the exporter's default, not the recipe's. The
  bare fixtures of `condo-complex`, `school-complex`, `subway-building`, `edifice`, `dungeon`,
  `math-structure`, `koenigsberg`, `controllable`, `floorplan` and `restaurant` declare T0.
  Five walkable kinds declare no walk seat at all and ride the runtime's 1.6 default:
  `fractal-city` (where a storey is 0.82 units, so the default walker stands two storeys
  tall), `transportation-hub`, `subway-station`, `painted-landscape` and `room` — below T0,
  and pinned so. Four kinds walk in feet with no unit declared (`edifice` at 5.6, `condo` and
  `subway-building` at 5.4, `school` at 5.2): each is a one-row `AUTHORING_UNITS` entry once
  its builder is read, and the T2 eye check names them until then. `outNormal` coverage
  outside the floorplan is 0–83% (the restaurant's asset furniture, the condo's shells), which
  is why no other kind reaches T1 yet. The dungeon's fires are baked colour, not declared
  lights, so it advises `imports_dark` alongside the condo and the school. Signage cards and
  shadow decals carry `bg` or `card` and no `fill`; the contract counts them as coloured.

### A minted building in the generated city — `edifices` on the fractal city (print-loop-demo)

Until now the city planner could reserve a plot only for a NAMED landmark (a pyramid, a
stadium). A building the operator designed as an edifice had nowhere to go but its own lawn.
The city recipe now takes `edifices: [{ ref, at? }]` — minted edifice refs placed by their
footprint corner in city units (default: the region centre) — and treats each like a landmark:
the plot plus a sidewalk ring is claimed before the road glyph runs, so streets, blocks and
props route around it; the edifice's own faces (walls, roof, slab, textures) are scaled from
feet into city units (one storey = 0.82 units, `STOREY_H / FLOOR_FT`) and appended to the scene.
`compose_world({ base: 'city', overrides: { edifices: [...] } })` and `update_sketch` on a
stored city both carry it; the building stays the edifice's own recipe, so editing the
edifice re-renders the city.

- **`lib/graph/city/city-insets.js`** — `insetFromEdifice(manifest, { at, margin })`: the pure
  half (plan → faces → city units, footprint + plaza ring + fog envelopes).
  **`lib/graph/worlds/city-insets.js`** — `resolveCityInsets(cityManifest)`: the DB half
  (ref → stored edifice → inset; a ref that is not an edifice throws at mint with the kind it
  found). `planFractalCity` takes resolved `insets`, stays DB-free, and is byte-identical
  without them. `STOREY_H` is exported for the unit conversion.
- **Lot placement is the default.** The first cut reserved the region centre before the roads
  ran, so the building sat on the intersection like a monument. Now, unless `at` is given
  (`mode: 'plaza'`), the roads and blocks are laid first and the inset TAKES A PARCEL: every
  generated building's lot is tried as an anchor, both orientations, the plot must sit on
  block cells only (no road, verge, corridor or plaza) and the candidate that evicts the fewest
  neighbours wins; the evicted building, its lot and any prop on the plot are removed, the plot
  is claimed so later passes (cars, people, trees) stay off it, and the building fronts the
  sidewalk like the one it replaced. `stats.insets[i]` says `placement`, `yaw` and `replaced`.
  A city with no parcel that fits falls back to the plaza and says so.
- Gen-space aware: under `baseScale` the inset is placed in the enlarged region and rides the
  same output scale-down as everything else.
- Advisory, never a refusal: an inset that lands on a landmark plaza or off the region is
  placed anyway and named in `stats.insets`.
- Tests: `city-insets.test.js` — the conversion (units, footprint, face count, textures), the
  theme adapter, and the planner: a parcel taken with every road kept, the 90° seat, a
  parcel-sized building seated inside its lot, plaza mode with nothing on the plot, the same
  seed unchanged without insets, and the plot landing where `at` says under `baseScale`.

### The lounge review — recipe identity, eye height, and four small defects

A review of the assembled lounge handoff repository found the room carrying two manifest hashes
across three packs, a viewer's eye at a child's height, and a handful of importer defects. The
fixes land here; the packs re-mint on top.

- **The grade is no longer stored.** `sketch-mint.js` still selects the best seed and repairs a
  stranded room at mint and update, but the `quality` block that `improveFloorplanManifest`
  returns is discarded rather than written into the manifest. It is derived
  (`gradeFloorplanManifest` recomputes it from the recipe), nothing outside the grader read it,
  and storing it made the hash of a room move when its geometry had not. `manifestIdentity()`
  in `engine-score.js` strips a leftover grade from rows that still carry one, and the three
  pack hashes go through it, so old and new rows hash alike. The mint golden snapshot loses its
  `quality` key; re-pinned.
- **Eye and feet.** The floorplan walk eye was 42% of the storey, 4.2 ft under a 10 ft ceiling.
  It is now an adult's 5.3 ft, kept two feet under a low ceiling (`floorplan-structure.js`).
  A 2-D walk spawn used to take the eye height as its z, so `moj:spawn` and `eye` were the same
  number and a walker stood an eye above eye height; the spawn is now the feet on the floor
  (`scene-gltf-level.js`). Godot and Unity already lift and settle; the Unreal importer now lifts
  its PlayerStart by a capsule half-height so the pawn does not spawn buried.
- **Units, said plainly.** A scaled score carries `unitsNote` beside `metersPerUnit`: the
  numbers are already metres, the field is provenance, never a second scale.
- **Importer defects.** Unity: the level-complete path invoked `Go` on the level, which has no
  such method (the bridge already hosts the delayed call), and two importer errors cited guide
  steps off by one (T002→T003, T003→T004). Unreal: a null locomotion clip reached the sort;
  local lights were counted per actor, now per component.
- **Unity, re-gated.** The review read a September 6 probe log showing 15 of 16 materials unlit
  on the lit pack. Re-run today, the Unity gate builds 14 shaded, 2 unlit and 9 lights, exactly
  as the GLB declares: the lit-handoff work since the 6th had already fixed it, and the
  declared-versus-built comparison now judges it. Still open for Unity: whether its importer
  reads the spots' candela at a sane brightness, which only eyes can say. The shared
  `lights_carried` ledger note no longer describes Unity in Unreal's words.

### The chariot — a brief in the orientation gallery

"Assembler makes a chariot; workbench makes chariot parts" has been the assembler's doctrine
sentence since the ring was built. The orientation gallery (`scripts/orient-mcp.mjs`, 0.4.0) now
carries it as an exercise any host agent can drive cold: build a two-wheeled chariot from named
workbench parts, assemble it by relation, take it apart, hand the recipe on. One object touches
every load-bearing concept, so an agent that builds and deconstructs one has met the substrate
without reading it.

- **Brief works.** A gallery work may carry `brief` instead of `recipe`. `get_work` on a brief
  returns the brief (intent only, never a solution), five phases each with a machine exit and an
  eyes exit, the rules (pull the vocab yourself, read errors as the manual, never claim the eyes
  gate from stats), and the filing convention. The consent beat changes shape: an exercise mints
  several real rows, and says so.
- **Signatures.** `add_work` gains `answersBrief`; `list_works` groups signatures under the brief
  they answer. `get_work` on a brief lists the signatures already filed; touring a signature ends
  by running the brief's deconstruction phase on that recipe, so a different host's agent proves
  every piece of a stranger's chariot is knowable. That cross-agent step is the agent-agnostic
  claim, tested rather than asserted.
- Zero substrate changes. No chariot kind: composition is the lesson. The mesh handoff and the
  engine legs are the hand-on rungs; absence of a sculptor or a binary degrades a rung, never the
  exercise. Two frictions the exercise exposes stay separate work: no MCP tool reads a stored
  manifest back (the gallery carrying the recipe is the host-neutral path), and the "part touches
  nothing" advisory proposed in July is still unbuilt, so a pole meeting no bed is an eyes-gate
  catch.
- Gates: the server's stdio round-trip was exercised by hand (initialize, get_work on the brief,
  list_works, a refused `answersBrief`). The first signature is Claude's own run, filed as
  `chariot-claude-20260908` over `sk_chariot_claude`: six named parts, seven placements, no
  warnings; one eyes-gate flaw named in numbers and fixed in place; exploded and subtracted
  variants minted; `.glb`, `.stl` and a Godot pack whose machine gate ran clean on an assembler
  ref. The upscaler rung was skipped (no sculptor resolved). The cold run from a non-Claude host
  then happened: Grok Build drove the brief with nothing but `get_work` and filed
  `chariot-grok-20260908` over `sk_chariot_grok` (seven named parts, its own overhang flaw found
  and fixed at the eyes gate, minus-pole and minus-wheels subtractions, glb and stl). Its story
  reports one friction not fixed here: `update_sketch` on an assembler whose items carry `{ ref }`
  sources stores the refs live instead of freezing them, and the still goes empty; the freeze
  happens only in the mint tool.
- **The assembler freezes every monomer family.** A second signature, a Roman biga with a curved
  breastwork lofted along its D-shaped floor, entered the assembly as nothing: `monomersOf` in
  the assembler tool kept only lathes / extrudes / sweeps / reliefs and silently dropped `lofts`,
  `fields`, `shells` and `drapes` from a mixed part, and the planner's renderable check carried a
  second, shorter list. Both now read the workbench's `MONOMER_KEYS`. Existing assemblies carry
  only the kept kinds, so their bytes do not move. Filed as `chariot-claude-roman-20260908`.
- **The principles that outlive the chariot moved onto the cards.** What two builds taught about
  joints and frames is now where every object builder reads it, not in the brief: the assembler
  card gains "Placement principles" (seating measures the whole part's lowest point, not its
  joint; a joint that must meet a tip is a bridge, superposed with a jut and a collar; author
  every part with lowest z = 0; `repeat` copies are identical; only the eyes gate checks
  contact), the workbench card gains "Frames and arrays" (a horizontal path frames its profile
  sideways and down, so a rising wall runs `v` from `-h` to 0; arrayed copies translate and never
  tilt, so spokes are explicit sweeps or a `code` loop), and the object-lowering reference gains
  the lowest-point line. The brief now says the cards are the whole doctrine and drops its one
  hint about spokes, so signatures stay blind and comparable while the floor rises for everyone.
- **The brief names the style and frees the rest.** Deconstructing Grok's signature cold showed
  what the brief had left unsaid. Its exploded and subtracted variants carry a flat panel, a
  plain hub and an earlier yoke while the filed chariot carries a D-panel loft and a Roman nave:
  Grok revised the chariot after minting the variants, so the C3 exit ("differs only in at /
  gap") failed on a run that was otherwise sound, and the exploded rail, still `on` its bed but
  moved 120 cm away, hovered 24 cm over nothing because `on` seats z alone. None of that is a
  parity failure between agents; the brief was asking for something it did not need. It now
  names the target (a Roman racing biga, with the three things that make it read Roman), splits
  FIXED (pieces, relations, scale, the reading) from YOURS (proportion, spokes, materials,
  ornament, how the breastwork is built), says signatures are compared on structure and never
  on geometry, has the variants minted last from the recipe that is filed and re-minted after
  any change, and asks the `shows` line for the style choices, since that is the part meant to
  differ. Touring a signature now compares it with its siblings on structure alone.
- **A second brief: the V8.** The same exercise with the dial turned up — parts that repeat
  (eight of everything), mirror (two banks) and meet on tilted faces (bolted, not stacked). It
  asks for the `code` kind for the repeated pieces, field-space cuts for the block, `flip` for
  the second bank, superposition as the rule, a blow-apart variant, and a lit Blender frame as
  the hand-on rung. First signature `v8-claude-20260908`: ten parts, thirteen placements, no
  warnings; the block one field solid; crank and pistons two programs; Blender pack gate green;
  Cycles frames of the assembled and blown-apart engine. The Roman chariot also gained its
  blow-apart variant (`sk_chariot_roman_x`).
- **The assembler freezes a `code` part's program.** The first V8 assembly refused the crankshaft
  because the freeze kept only monomer arrays and a code part stores a program. `monomersOf`
  and the planner's renderable check now carry `program` inline; the assembler's lowering
  already expanded programs, so the code card's promise that the assembler slot is inherited is
  now true. Assembler tests pass unchanged.
- **The V8 assembles itself and runs, as a derived clip.** A script in the integration folder
  (not core) renders the blown-apart recipe flying together, then lifts the heads, covers and
  manifold to show the pistons pumping through two revolutions, then closes. Every frame is the
  same assembler recipe with placement fields interpolated and one program dial turned: the
  crank and pistons became one `code` part with a `params.angle`. Frames come from the
  substrate's own capture seams (`resolveWorldScene` → `emitThreeWorld` capture →
  `renderWorldFrames` → `encodeGifBuffers`); nothing is minted. Recorded because it names the
  gap: no kernel knob interpolates placements and no motion subject sweeps a dial. If the clip
  earns its place, an assembler `explode` dial and a `dial` motion subject are the promotion.

### The concave cap — an extrude's lid no longer spills across its own slot (print-loop-demo)

Found by the print loop's machine gate on the first object it tried: a desk-edge headphone
hook, whose clamp is a C-shaped `points` profile extruded along the desk edge. The walls were
right and the closure audit said closed, yet Manifold called the shell NotManifold and
PrusaSlicer counted three parts. The end caps are a fan from the profile's CENTROID, and for a
C the centroid sits in the open slot, so every cap triangle crosses the void and overlaps its
neighbours — the web tier drew a wedge notch where the slot should be. A star-shaped
assumption, never stated.

- **`polygonizer/ring-cap.js`** — `isConvexRing` and `earClipRing` (ear clipping over a simple
  polygon, either winding, degenerate ears skipped). `extrude-faces.js` and `loft-faces.js`
  keep the centroid fan for a CONVEX ring — every existing rect, rounded-rect, circle, and
  convex points profile is byte-identical — and switch to ear-clipped triangles only when the
  ring is concave, emitted in the same closed-quad `[a, b, c, a]` convention with the same
  `outNormal`.
- Machine gate: the C extrude now audits closed AND unions as one manifold with the volume of
  its profile area × length; PrusaSlicer's `--info` agrees. The recipe did not change.
- **The sweep's inside-out lid.** With the clamp closed, Manifold still refused the hook: the
  swept arm. An edge audit found every edge shared by two triangles, but one ring's worth run
  the same way twice — both end caps of a sweep shared one winding, so the START cap was
  inside-out. The unlit, double-sided web tier never showed it; a CSG union, a slicer's
  manifold check, and an engine's backface culling all see it. `sweep-faces.js` now flips
  the start cap exactly as the extrude does. This changes the corner order of every sweep's
  start cap, so the emitted bytes move wherever a sweep is capped: the floorplan furnish
  characterization (the lamp) and the per-kind world hash for `restaurant` are re-pinned with
  this note. Tests: a straight sweep unions to the 24-gon prism volume; the hook's bent arm
  unions as one manifold.
- Machine gate on the hook after both fixes (`measure_solid`, `slice-print.mjs`, PrusaSlicer
  2.9.6): closed, union applied, 15,244 mm³, genus 0; sliced, size agrees, manifold, 90 layers
  at 0.3 mm, 45 min, no supports. The recipe did not change.
- Leftover: a `fields` extrude twin does not cap (it is a distance field), and the shell
  (`wallThickness`) branch is rect-only, so neither had the cap bug. The lathe's seam
  duplicates its 2π vertex (eight edges at count one under exact comparison); Manifold's
  merge tolerance absorbs it today, noted rather than changed.

### Unreal demo — project-owned player

The Unreal game kernel accepts a project-owned pawn class through `MojuloPawnClass`
in `Config/DefaultGame.ini`. Pickups, hazards, exits and survival objectives follow
the possessed pawn; its input, camera and movement stay project-owned. The existing
walker remains the default, and invalid class paths fall back with a warning.
The generated import guide documents the setting.

Machine checks: the emitted plugin compiled against Unreal 5.8; isolated engine
runs verified stock `DefaultPawn` pickup, hazard, timed completion and exit, plus
legacy walker and invalid-class fallback. The Unreal emitter and handoff posture
suites passed. GASP, visual quality, movement feel and performance remain unverified.

### The Godot leg reads candela — kernel 0.2.1

The first time the lit lounge was opened in Godot, every surface clipped to white. The GLB carries
its pot lights as `KHR_lights_punctual` spots in candela; Unreal reads candela through exposure and
Blender converts to watts, but Godot's importer copies the number straight into `light_energy`, a
unitless multiplier where 1.0 is a lamp, and leaves range at its 4096 m default. A 400 cd downlight
landed at 400×, with no environment or tonemapper in the pack to catch it. Eyes-gate finding, not a
recipe knob.

- **`kernel/level.gd` — `_fix_lights()`.** After the material fixup, every imported non-directional
  light is scaled by `CANDELA_PER_ENERGY` (50, calibrated against the Cycles frame of the same
  room) and the importer's default range is replaced with 12 m; an authored range is kept.
  Directional lights carry lux and are left alone.
- **`_build_environment()`.** When the world carries lights, the kernel adds a `WorldEnvironment`
  with a sky-toned clear colour, a little ambient, and the AgX tonemapper — the ledger's
  `sky_approximated` promise, kept. Unlit packs get no environment: a tonemapper also remaps
  unshaded surfaces, and their reference look is the web build. A hand-authored environment in the
  scene wins.
- Kernel version 0.2.0 → 0.2.1; the pack copies it verbatim, nothing in the emitters changed.
- Gates: machine gate (import ×2, one-frame run, materials probe) reran clean on
  `sk_lkypzdim4y`; a frame captured from inside the room was looked at and reads like the Cycles
  night render. That is one room and one pair of eyes.

### The mesh handoff meets a generator (interchange-next N4)

Seam 5 shipped tested against a fake sculptor. First contact with a real one — TripoSR
on this M1 Max, no key, CPU — on the lighthouse, driven cold from the packet.

- **Generators normalise; the door now says so.** TripoSR returned a ~0.9-unit z-up
  mesh in its own frame; submitted raw it failed `size_agrees` as designed (0.016× /
  0.022× / 0.005×). `pull_mesh_render` now carries `greybox_box` ({ min, max }) beside
  `size_world_units`, and the instructions tell the worker to re-frame onto it before
  submitting. **`scripts/fit-mesh-to-greybox.mjs`** (pure half
  `lib/graph/scene/mesh-fit.js`: `fitFacesToBox(faces, { box, up })`) is that step in the
  face-list currency — stand it up (`--up triposr` for a z-up file, which the reader
  lands on −y), uniform scale on the height, base on the greybox floor, XY centred;
  vertex colours and albedo textures ride through `facesToGlb`. Tests: `mesh-fit.test.js`.
- **The 0.5×–2× band held**: fitted on height, the return sat at 1.72× / 1.28× in XY (a
  single view guesses girth) — inside, and the right shape of band. Slot 1 (raw, refused)
  and slot 2 (fitted, `size_agrees: true`, closure clean, 82,408 tris, vertex colours,
  no textures) are the record; slot 2 accepted by a different source after a Blender
  Workbench look (reads as the lighthouse, leans a few degrees, back is a guess), placed
  in a controllable world via `figures.<name>.meshRef` and exported (84,208 tris).
- Findings ledgered in `docs/local-mesh-worker.md`: the submit `contract` block is the
  Blender return's check and fails for any generator return (informational there);
  textured returns remain untested by a generator (TripoSR's texture bake needs `xatlas`,
  which does not build here); the host shims TripoSR needed (PyMCubes for `torchmcubes`,
  lazy `xatlas`, `rembg[cpu]`, `trimesh` unpinned for numpy 2).

### The engine gates learn to read materials (interchange-next N5)

The lit handoff shipped with "Godot / Unity import a lit GLB as lit on their own (not
verified in-engine)". Now it is verified, by a machine gate that asks the narrow
question: did the importer build the shading the GLB DECLARES?

- **`lib/graph/scene/materials-gate.js`** — `declaredShading(glb)` reads the file's own
  declaration two ways (per primitive, which is Godot's surface; per material, which
  is glTFast's Material) plus its `KHR_lights_punctual` count; `compareShading` returns
  named checks with both numbers. `--lit` only labels the run: an unlit export may
  carry a PBR primitive (the lounge's emissive pot-light disc) and a lit export keeps
  its unlit stickers (water, shadows); both are right when the importer built what the
  file says. Tests: `materials-gate.test.js`.
- **Godot** — `scripts/godot-materials-probe.gd`, a gate-only `--script` (nothing of it
  rides the pack) that instantiates each level's `model.glb` as imported and counts
  `BaseMaterial3D.shading_mode` per surface and `Light3D` nodes; `export-godot.mjs`
  runs it after the one-frame runs and stamps `gate.materials`. Measured on this host:
  the lit lounge 14 shaded + 2 unshaded of 16 surfaces, 9 lights of 9; the unlit lounge
  15 + 1, 9 lights; a two-level game pack 2 + 0. The kernel's `_fix_materials` only
  sets `vertex_color_use_as_albedo` — it does not touch shading, so the split survives.
- **Unity** — `export-unity.mjs` writes a scratch-side Editor script
  (`Assets/MojuloGate/Editor/MojuloGateProbe.cs`, outside `Assets/MojuloPack`, so the
  pack's byte pins are untouched) and runs `Mojulo.GateProbe.Materials`: the shader
  name of every Material glTFast built under the pack (`glTF/Unlit` vs
  `glTF/PbrMetallicRoughness`) and the prefab's `Light` components →
  `mojulo-materials.json` → `gate.materials`. Measured (glTFast 6.9.1, Unity
  6000.2.13f1): the lit lounge 14 PBR + 2 unlit of 16 materials, 9 lights of 9; the
  unlit lounge 1 + 15, 9 lights. glTFast imports the punctual lights on its own.
- The pot lights ride `KHR_lights_punctual` and both importers build them; the Unreal
  importer still spawns its SpotLights from `score.json` (unchanged).

### The slicer gate meets a slicer (interchange-next N2)

PrusaSlicer 2.9.6 on this host, the first real slice since seam 1b shipped against no
slicer. Two things the smoke run could not know:

- **Placement.** A mojulo 3MF places its objects around their own origin; the CLI reads
  that literally and refuses every model ("All objects are outside of the print
  volume"). `slice-print.mjs` now hands the slicer `--center` — the operator's
  `--center X,Y`, else the loaded profile's `bed_shape` centre
  (`bedCenterFromProfile`), else PrusaSlicer's built-in 200 × 200 bed — and stamps
  `center_mm`.
- **Named failures.** A slice that yields no G-code carries `reason` —
  `outside_print_volume`, `file_not_read`, `timeout`, or null with the log — instead
  of one generic line; the driver says what to do (`--target-mm`, or a profile whose
  bed is larger). The literal-scale lighthouse (1 m tall) is the honest first case.
- Measured: the lighthouse fitted to 180 mm slices under the defaults (`size_agrees`,
  manifold, 11 parts, 600 layers at 0.3 mm, a time and filament-length estimate;
  grams read 0 without a filament profile). Exact CLI and findings in
  `docs/local-slicer-worker.md`. Tests: `print-gate.test.js`.

### The USD verify gate reads its own numbers right (interchange-next N1)

The skinned-humanoid GLB gate's +80 triangles were never the export's. Blender's glTF
importer creates a custom bone-shape `Icosphere` (80 faces) for every armature and parks
it in a `glTF_not_exported` collection; `scripts/verify-usd.py` iterated
`bpy.data.objects` and counted it — and fed it into the world box, so the reported y
extent of exactly 2.0 on the figure was the unit icosphere. `facesToGlb`'s
`triangleCount` equals the file's index accessors in rigid, skinned and humanoid modes
(reproduced from the skinned test fixture and the stamped `sk_sprk_hero_3` export).

- `verify-usd.py` now drops anything in `glTF_not_exported` before every tally
  (triangles, box, meshes, objects, empties) and names what it dropped as
  `importer_only` in the report. `import_mojulo.py`'s verify counts the same way but only
  meets the static art-pass GLB (no armature, no shape); left under its byte pins.
- The USD verify gate entry below that blamed the writer is corrected in place.
- Re-run on this host: the skinned-humanoid figure gate is green (14,784 = 14,784, the
  box is the figure's own, `importer_only: ["Icosphere"]`); the lighthouse USDZ gate is
  unchanged and reports `importer_only: []`.

### Substrate drift — the self-description caught up to the code

An audit of `get_substrate`, the rules card, and the README against the tree found the
positioning text lagging the engine legs and overstating a few invariants. Text-only; no
tool behaviour changed.

- **Unreal was "spec-only".** The substrate drawer and the README said so; the Unreal leg
  (data pack, importer, `MojuloKernel` C++ plugin, gated `export-unreal.mjs`) had shipped,
  and the README never mentioned the gated Unity leg at all. Both now ladder as Godot
  first-class, Unity and Unreal as gated legs, Blender as the art-pass pack.
- **"True scale" is the literal profile.** Workbench / assembler / carved wordmark /
  turntable / vehicle export at true scale; figures, worlds and views are maquettes fit
  to a target size. The README's "objects, figures" row said figures; corrected.
- **"No auth layer" was wrong for HTTP.** Substrate fact 1 and the rules-card one-liner
  now say stdio is local and the HTTP route is bearer-gated on `CONTROL_PLANE_MCP_KEY`,
  which is what `app/api/mcp/route.js` has done all along.
- **"Every artifact is minted beside a contextmap record" held only for the office wing.**
  Creative mints deliberately do not write `meta_*` rows; the drawer now says a studio
  artifact is recalled by ref, `semantic_search`, and the cookbook card, and is sealed
  only by an explicit `meta_context_commit`.
- **"The one LLM flow that leaves the machine"** now names the chatbot pack's own
  builder and config generators alongside the running bot, and records that the
  polygonizer's listed path is the key-free packet/submit pair.
- **Persistent** now says bindings execute only while the daemon host or the in-process
  trigger runtime is up and a fulfiller polls the agent-tasks queue — no launch agent
  ships. **Primitives** lists the real `bind_primitives` vocabulary (document-store,
  structured-record-store, messaging-channel, message-thread); `local-storage` is a
  technique catalyst. **Credentials** names `API_KEY_ENCRYPTION_KEY` and the fixed
  development fallback. **Network** adds the first-render Chrome-for-Testing fetch and
  the disk-cached geo pulls. The craft floor now says the skill dry-run is a discipline
  asked of the agent, not a code gate, and that `verify_machina` is statics over a
  mechanism chain, not collision or joint-limit checking.


### Orientation reset — CLAUDE.md from a blind read, docs unlinked from plans, counts unpinned

Repo-facing only; nothing here changes the published package or a running install.

- **CLAUDE.md rewritten.** Produced from a fresh-eyes assessment with the file absent, then
  diffed against the old one. Golden rules kept; the "no auth layer" claim corrected to
  loopback + bearer; the architecture map collapsed to pointers. Added what the blind run
  stumbled on: the test command, the `tools/list` budgets and the tests that enforce them,
  the new-tool checklist, the plan lifecycle (plan → Unreleased section → code →
  `plan-archive/` on merge), the two data-path resolvers, `--webpack`, the three meanings
  of "graph", and the no-commit line. 29 KB → 9 KB.
- **Plans are not citable.** Docs, root markdown, and `.claude/skills/` no longer link to
  `*.plan.md` or `lite-template/integration/` paths — plans are working documents that
  move to `plan-archive/` on merge, and the tree is gitignored. Links reduced to bare
  names; full paths shortened. The rule is in CLAUDE.md. JS comment citations are left
  as-is: orientation debt, not runtime.
- **Links.** Every broken relative link across `docs/`, README, and the skills fixed —
  almost all `lib/graph` files that moved into `scene/`, `city/`, `effects/`,
  `architecture/`, `worlds/`; skill links were repo-root-relative and never resolved.
  The CHANGELOG's own historical links are left as provenance.
- **Counts unpinned.** Enumerable numbers in docs (kinds, packs, tools, locales, cards,
  test files) replaced with pointers to the list that defines them, so the docs cannot
  drift on a count again; rule added to CLAUDE.md.
- **bicycles.md** marks the render-handoff section shipped and links its narrative
  companion, which nothing linked before. Removed `page.html` (a committed dev-server
  dump) and `control/mojulo-0.2.2.tgz` (a stale tarball).

### Expressiveness — from a term list to a grammar, from a grammar to programs (expressiveness.plan.md E1–E5)

The polygonizer was never the ceiling (`surfaceNetFaces` takes any `(p) => number`); the
shape list in front of it was. Two moves lift it, ordered by how little they disturb the
promise — a grammar first, then a code door — plus the small lane and the harness that
make both keepable and measurable. Absent an `expr` term, a domain op, or a `program`,
every existing workbench re-renders byte-for-byte.

- **`expr` — a distance expression as a field term (E1).** A `fields` shape may now be
  `{ kind:'expr', d, vars?, bounds | reach }`: a signed-distance expression over `x y z`
  in a small GLSL-like infix grammar (`let` statements, a ternary whose condition is a
  comparison, `PI TAU E`, a frozen append-only whitelist of pure functions —
  `abs min max sqrt hypot sin cos tan asin acos atan atan2 pow exp log floor ceil fract
  mod clamp mix sign step smoothstep smin smax len2 len3 noise3`). `vars` are the dials
  `update_sketch` turns; `bounds` is REQUIRED and is a CLIP (the term is the expression
  intersected with its box, so a plane or a gyroid closes by construction instead of
  losing quads at the grid). The mint gate parses (caret + whitelist in the error) and
  SAMPLES a 9³ lattice plus corners: finite everywhere, both signs, else "no surface
  inside bounds". Compiled to a closure tree (no source text executed); `mod` is floored
  (GLSL), `%` truncated (JS). `EXPR_GRAMMAR_VERSION = 1` stamps the export ledger
  (`field_solids.expr_terms` / `expr_grammar_version`). Grammar + five idioms on the
  workbench card (a gyroid slab with the `/ k` normalisation so `t` is wall thickness in
  world units — walls under about two cells pinch, pinned in a test; a wavy plate; a
  bolt circle by polar `mod`; a twisted box; a fillet by `smin`).
  - **E1b — one AST, two emissions.** `emitFieldExprGlsl(ast, { name, vars })` emits the
    same program as a GLSL `float name(vec3 p)` (builtins direct, `hypot`/`len*` →
    `length(vec*)`, `smin`/`smax` → sdf-glsl's `sdfSmin`/`sdfSmax`, `%` → `trunc`-mod);
    `noise3` has no GLSL twin yet and refuses with a teaching note (CPU-only). Snapshot
    pinned; no raymarch consumer wires it yet — the compile is the eyes gate in a view.
- **Domain operators (E2).** `FIELD_OPS` gains six, append-only: `transform { translate,
  rotate (deg, Rz·Ry·Rx like the assembler), scale, mirror }`, `repeat { spacing, count }`
  (a COUNTED grid centred on the original — half-multiples for even counts) and
  `repeat { polar: { axis, count, radius } }`, `twist { axis, turns }`, `bend { axis,
  radius }`, `taper { axis, from, to }`, `elongate { by }`. Each is a point warp with
  conservative bounds; each applies to the whole solid so far OR — with a nested `terms`
  list — to a SUB-solid then `combine`d (`add | subtract | intersect`, `blend`), which is
  how the bolt circle is ONE bore repeated. The warp is applied to the solid's PARTS too,
  so group tags follow the geometry (every instance of the bore is `bore`; a transform
  moves the group). Fixtures pin closure + genus per op (polar flange genus 6, 4×2 and
  3×3 grilles, twist / bend / taper / elongate genus 0). The ledger lists `domain_ops` and
  says a warped field is a bound, not an exact distance.
- **The code door (E3, D2 "yolo mode").** `mint_solid({ kind:'code', spec:{ source,
  params?, seed?, budgetMs?, units? } })`: `source` is the body of `(params, ctx)` and
  RETURNS a workbench spec (monomer arrays / an `assembly`) or a face list; the return
  shape is detected. It runs in `node:vm` with the language and nothing of the host — no
  `process` / `require` / `fetch` / timers / `import()`; `Math.random` IS
  `mulberry32(seed)`; `Date` throws "the realm has no clock"; `Intl` removed; `console.*`
  captured onto `stats.program.log` (and onto a mint ERROR); the whole run including the
  JSON hand-back sits under vm's `timeout` (`budgetMs` default 5,000, cap 60,000) so no
  getter runs later; a Promise return is refused; `source` ≤ 64 KB. The recipe stores
  `kind:'workbench'` + `program` — the program is a PARAM — and one expansion seam in
  front of the kernel (`workbench-program.js`, memoised per source hash + params + seed)
  hands every leg a plain workbench: World, studio shots, skin scaffold, assembler parts,
  closure audit, `update_sketch`'s gate, `save_recipe`, `diff_sketches` (a text diff),
  and the export ledger (`code: { source_hash, realm_version, budget_ms, returned,
  monomers | faces }`). Toolkit v2 (`ctx.solids`: the field-terms constructors,
  combinators and domain ops, `compose`, `surfaceNet`, `fieldFaces`, `expr.parse/compile`,
  `noise3`, `mulberry32`, `transportFrames`, `vec`) reaches the program as `ctx`. Card
  `solid-vocab/code.md` carries the realm API and three worked programs (bolt-circle
  flange, parametric staircase, a train of parts from a parts table). E3b (promotion to a
  named kind) stays deferred.
- **The solids lane for `save_recipe` (E4).** A `workbench` sketch (program included) is
  keepable: `entry: 'mint_solid'`, chapter `solids`, family `object`, recalled through
  `get_solid_vocab` / `semantic_search({ kinds:['solid_vocab'] })`; the card says params
  nest under `spec` on re-mint. Assembler / motion still wait (instance-local refs).
- **Measure it (E5).** Every workbench mint now returns `stats.ledger = { recipe_bytes,
  wall_ms, faces, closed, program_ms? }` — recipe bytes as the honest proxy for the tokens
  the agent had to write. `roundtrip-eval.integration.test.js` (gated:
  `MOJULO_ROUNDTRIP_EVAL=1` + the claude CLI) renders twelve fixtures across monomers /
  fields / expr / domain ops / one program as three-yaw scaffold PNGs, hands a model only
  the views and the cards, re-mints its reply, and scores bbox-IoU × face-ratio per idiom
  (diff_sketches similarity reported beside it) into a tmpdir report.
- **Vocabulary cost held.** One clause on the `fields` line, `code` in the `mint_solid`
  enum plus one sentence, three `translate_modeler_lingo` entries (`sdf-expression`,
  `array-pattern`, `procedural-part`); `mint_solid` and `save_recipe` descriptions
  re-tightened under the 700-char budget; the 261,000 tools/list pin stands.

### Blender destination leg — B0 the art-pass pack, B1 the return door (export-blender.plan.md rev 3)

The DESTINATION half of the Blender seam: where the worker legs (`blender-bake.mjs`,
`bake-world-gi.mjs`) drive Blender headless and bind results back automatically, this
leg hands the operator (or their artist) a pack that realizes a mojulo object inside a
fresh `.blend` for a HAND surfacing pass, and names the door it comes home through
(`bind_mesh_render`, a bound derived variant — never a recipe edit).

- **`scripts/export-blender.mjs --ref <sketch> [--base lit|unlit|shaded] [--posture greybox]`**
  emits `data/outcomes/<ref>/blender/`: `model.glb` (the printable set — water, decals,
  studio furniture ledgered out — exported **`lit: true`** over the unshaded payload by
  default, so Blender's importer builds a Principled material an artist surfaces on;
  `unlit` / `shaded` are the taste dials), `pack.json` (ref, manifest hash, units +
  metres-per-unit, the node inventory with z-up bounds, the node → collection map, the
  frame landmark), `import_mojulo.py`, `export_return.py`, the T-numbered
  `ARTPASS-GUIDE.md`, `README.md`, `recipe/<ref>.json`. Written IN PLACE — the operator's
  `<ref>.blend`, `return-<n>.glb` and the gate stamp beside the pack survive a re-mint.
  Deterministic: re-mint verified byte-identical on all seven files.
- **`import_mojulo.py`** is transport-agnostic (`MOJULO_MODE=run|verify`, argv fallback):
  headless, from Blender's Text editor, or over the OPERATOR's blender-mcp
  (`execute_blender_code`) — no add-on, no socket, nothing of mojulo's inside Blender's
  process. `run`: fresh scene → import → one collection per pack part → viewport shading
  (Material Preview on Layout, Solid + vertex colour elsewhere) → unit DISPLAY scale from
  the recipe's units (coordinates untouched, so the return lands in the same frame) →
  framing camera → save `<ref>.blend`, REFUSING to overwrite an existing one (exit 3 —
  a pass in progress is never clobbered; `--force`). `verify`: open the `.blend` and
  report objects / bounds / collections / shading / units / camera → `mojulo-gate.json`.
  **`export_return.py`** is the return re-export with the pinned settings (GLB, +Y up,
  names kept, modifiers applied, vertex colours ACTIVE, images embedded, no Draco /
  meshopt, no cameras / lights / clips), filtered against the running Blender's own
  operator properties.
- **Machine gate** (D2 — extends the verify-usd lineage, no parallel gate): the driver
  runs the pack's OWN script twice headless (run → scratch `.blend`, verify → report),
  compares with `usd-gate.js` (triangles, world box, vertex colours, textures) plus the
  new `blender-gate.js` (`glbNodeInventory` reads what mojulo DECLARED off the POSITION
  accessors through the reader's node walk; `compareBlenderPack` checks every node
  present with its bounds inside epsilon, the collections, the SIGN-sensitive frame
  landmark — a mirrored import fails it — shading, units, the framing camera), stamps
  `mojulo-gate.json` and, on green, places the `.blend` beside the pack when none is
  there. Advisory; no Blender ⇒ rung 0, pack + guide only. Results on this host
  (Blender 5.2.0 LTS): the lighthouse (`cm`, 176 tris), the mk2 suit (101,100 tris,
  landmark `static:pbr1`, asymmetry 0.37) and the top-hat snowman (20,330 tris) all
  green; the lighthouse round trip `export_return.py` → `glbToFaces` returns 176
  triangles, identical bounds, the node name kept, colours present.
- **The operator-guide lift** (D10): `scene/operator-guide.js` now owns `fmt`,
  `ledgerLines`, `greyboxSection`, the `#101…` guide ledger, the `#003…` fact lines and
  the guide preamble; `unity-project.js` and `unreal-project.js` migrated onto it under
  their snapshot tests (byte-identical). The reader's matrix helpers
  (`IDENT` / `mul4` / `trsMatrix` / `xfPoint`) are exported from `scene-gltf-read.js`.
- **Finding, ledgered as `single_collection`:** the assembler kind's static export
  carries ONE render group (`static` + its pbr material buckets), so a three-part
  lighthouse and a many-part suit each land in one collection — per-part collections
  need per-part `group` tags upstream; the pbr buckets still make a usable landmark.
- **B1 — the return door.** `glbToScene` (`scene-gltf-read.js`, interchange-seams
  seam 6b): a primitive carrying `TEXCOORD_0` under a `baseColorTexture` lowers to the
  currency's own `{ texture, uv }` faces (+ `textureLit` when COLOR_0 rides) with the
  embedded PNG / JPEG re-hoisted byte-preserved under the writer's `<group>:<key>`
  spelling — so a Blender repaint of the shipped tile comes home under the same key;
  other maps are counted (`maps_dropped`), unsupported images and `TEXCOORD_1+` named
  (`textures_dropped`). `world-scene.js` carries a bound mesh's textures into
  `payload.textures` (collisions re-keyed `<key>@mesh:<name>`). The SHARED bind door
  (`bindMeshBytes` — `bind_mesh_render` and `submit_mesh_render`) now stamps the head
  `manifest_hash` on the sidecar, the texture ledger, and — when the sketch has a
  Blender pack — the return contract (`compareReturnContract`: per-node `missing /
  moved / resized / unexpected` rows, the sign-sensitive landmark, per-axis scale):
  ADVISORY, the bind always proceeds; the handoff's own size gate is where a re-scaled
  WORKER return is refused. `describeBoundMeshes(ref, { manifestHash })` derives
  `stale` per slot. Real loop on this host: a headless hand pass on the lighthouse
  (30 faces recoloured, one panel painted with a fresh image on a fresh unwrap) binds
  with no drift and its `paint` texture rides a meshRef world's payload; the mk2 with a
  part renamed and another moved binds with exactly three named drift rows. Deviation
  from the seam-6b gate as written: texture DATA round-trips byte-identical, whole-file
  bytes do not (the reader's padded-triangle form meets the writer's decollide lift —
  pre-existing since I3; the quad-reassembly fix is deferred as a kernel-output change).
- **Rev 3 of the plan** re-scoped the leg against the interchange commit (lit base,
  gate lineage, the return door's durable half in the mesh handoff, W1 owned by seam 6b,
  quantization tolerated on return) and DELETED rev 2's pack-carried listener add-on —
  it rebuilt blender-mcp's transport layer and contradicted interchange-seams' non-seam,
  which is rescoped to "no mojulo-SHIPPED add-on". blender-mcp, where the operator has
  it, is the third transport. Open: the guide followed cold by a human (the emit-side
  eyes gate), the live blender-mcp path (not installed here), B1's return contract check.

### Grok adapter — studio rider (host seam, not a kernel)

- **`grok-build` adapter v2** — the card is how Grok *rides* the studio, not only how it materializes a catalyst skill. Standing moves: split native image (look) from the Mojulo recipe (pose/scale/world/proof/print); paint scaffolds in-session and `bind_image_render`; `forge_motion` vs native video as two systems; a refusal is a next move; `save_recipe` `when` is this conversation's intent. Output-cap notes unchanged.
- **`forward_context` drawer pointer** — host-neutral: `get_adapter` once before making or synthesizing (studio office-drawers line + office drawer directory). Shared orientation still names no host; per-host guidance stays on the card.

### Field solids — `lofts` and `fields` workbench monomers (field-solids F1–F4)

- **`lofts`** — a profile that CHANGES along its path: ≥2 `stations` (`{ t, profile, roll? }`,
  one shared point count; a round station is `{ radius, sides? }`) interpolated ring to ring,
  `interp: 'linear' | 'smooth'` (Catmull-Rom through the stations, `segments` per gap on a
  straight axis). A 2-point path / `axisFrom`+`axisTo` is a straight loft framed like an
  extrude — a two-station straight loft is byte-identical to the matching `endProfile`
  extrude (pinned). Longer paths bend with the sweep's parallel-transport frames, now shared
  as `transportFrames` (`sweep-faces.js`, byte-identical extraction). Stacks in `assembly`
  as `kind:'loft'` (straight up the stack axis; curved lofts stay in the explicit array).
- **`fields`** — cuts, pockets, bores, blended masses and organic detail composed in FIELD
  SPACE and polygonized once by the surface net (`field-faces.js`): a `terms` list read
  top-down — `add` / `subtract` / `intersect` shapes (`sphere` / `ellipsoid` / `roundCone` /
  `box` / `capsule` and the field twins `lathe` / `extrude` / `sweep`), with `blend` for the
  smooth variants, plus the sculpt terms `stroke` (a dab in or out), `displace` (seeded 3D
  fBm), `shell`, `round`. `cells` (16–128, default 64) is the resolution dial — cubic cost,
  edges round to about one cell. Every face carries `group: <term id>` (nearest term at the
  centroid) so `selectFaces({ group:'bore' })` works over field output. Closed by
  construction (a bored flange is genus 1, pinned). `translate` places a whole solid;
  `assembly` `kind:'field'` stacks one (terms authored with z from 0 up to `height`).
- **`field-terms.js`** — the shared SDF term library (primitives with tight bounds,
  union/subtract/intersect + smooth twins, `shell`, `round`, `stroke`, `displace`,
  `composeFieldTerms`) the animal skins (blenderish phase 3) and the workbench compose from;
  `smax` (the CPU twin of the GLSL `sdfSmax`) in `vajra.js`; `noise3` / `noise3Amplitude` in
  `fields.js` (the open 3D-noise item in POLYGONIZER-SYNTHESIS).
- **Export ledger** — `export_model` reports `field_solids: { count, cells, edge_rounding }`
  (in mm on the print formats) so the handoff says in numbers what the recipe could not express
  sharply. Field quads flow through STL / 3MF / GLB / USD like every other face.
- **Doctrine (D0, decided 2026-09-05)** — cad-aid's "no CSG in-substrate" is narrowed to
  mesh-on-mesh CSG kernels; field-space composition and the Manifold export pass are in.
  `translate_modeler_lingo` gains `boolean-cut` (native, rounded) and `chamfer-fillet`
  (round = native fillet; sharp chamfer = handoff), and `sculpt-detail` becomes partial
  (form-level `stroke` / `displace` native; micro detail stays DCC). Absent the new
  monomers every existing workbench re-renders byte-identical.

### The lit handoff — from the PS2 frame to a lit frame (lit-handoff.plan.md)

- **`export_model({ lit: true })`** / `GET /model.glb?lit=1` / `--lit` on export-godot,
  export-unity and export-unreal: real `pbrMetallicRoughness` materials (metallic 0,
  roughness 0.85, no `KHR_materials_unlit`) over the UNSHADED payload, NORMAL where
  authored, so the importer's light is the only light. The Unreal pack gets a
  `M_MojuloLit` master (default-lit, base = texture × vertex colour, a Roughness
  parameter) beside the unlit one, selected by `LIT` in `import_mojulo.py`. The web
  runtime stays unlit; default exports are byte-identical.
- **`blender-bake.mjs --render`**: keep the Cycles FRAME instead of baking it — lit source,
  a sun (elevation/azimuth) + sky or the preset's studio rig, camera/fov/resolution/samples/
  exposure dials, `--open` for the dollhouse light — to `outcomes/<ref>/render-<light>.png`.
  A derived outcome, never a recipe change.
- **`floorTexture`** on the floorplan ('auto' for a one-cell furnished plan): the oak /
  carrara surface tile on the floor finish, multiply-lit in the World and the lit albedo in
  the GLB and the Cycles render; the bake tessellation now splits textured quads with uvs.
- **Pot lights** (`potLights: true` on a floorplan): recessed cans laid per room in the
  ceiling — baked pools on the floor finish (per-corner, the boards multiply them) and on the
  furniture (the furnish bake's `lamps`) for the unlit World, and a real
  `KHR_lights_punctual` spot per can in the GLB (`facesToGlb` `addLightNode`), carried on
  the engine score (`score.lights`, ledger `lights_carried`). The lens is an emissive PBR
  surface of its own (`KHR_materials_emissive_strength`), kept by the Unreal swap. Unreal: Interchange imports
  them itself (pinned at the gate: 9 of 9), the importer settles every local light Movable
  and would spawn SpotLights from the score if none came in; `lights_carried` is a verify
  check. The importer's rig is now sun + SkyAtmosphere + sky light, all Movable (the first
  lit eyes gate was a black-sky box: no atmosphere, stationary lights, no Lumen config —
  the driver writes the template's Lumen lines into the scratch project).
- **Couch facing** — the lounge sofa faces the television: the living arranger stamps
  `facing: 'S'` on the sofa, and `modern-couch` is now a `local: true` room-furniture asset
  (built centred / front +y and mapped through the footprint frame like its siblings), so the
  planner's facing spin reaches it. Unfaced placement is numerically unchanged.
- **`metersPerUnit`** — the floorplan is authored in FEET; the lounge landed in Unreal at
  3.28× with a 10 m ceiling. The floorplan payload now declares `metersPerUnit: 0.3048`;
  the GLB root carries it as a uniform scale (+ a `moj:metersPerUnit` extra), the engine
  score scales spawn / eye / cameras / colliders / entities / lights, and the GLB reader
  undoes a uniform scale on a `mojulo` root so bakes, mesh handoffs and Blender round trips
  decode to recipe units. `blender-bake.mjs` bakes in recipe units and renders in metres
  (`--camera`/`--look` stay recipe units). Metre-authored kinds are byte-identical.
- Room-realism leftovers: share mode snaps wall pieces to their wall; a `rim` contact-shadow
  profile grounds furniture from standing height (one-cell default).

### Floorplan — surfaces for the one-cell room (room-realism phase 4)

A furnished one-cell plan now defaults `wallDecor: true` with `interiorWallStyle:
'paint'` (the existing finish system: a 0.5 ft baseboard course + a painted swath per
wall run, clipped around every opening; houses keep their geometry-hashed
paint / wainscot / wallpaper mix), carries a new `plaster` procedural-material preset
on the swath (`wallMaterial`, grid 3, a whisper of top-lit ramp + mottle; `lit:false`
so the room's own shade is kept — the World tier expands it per vertex), and gets a
ceiling in the WALK tier only (`assembleFloorWorldScene` marks the tier; the cutaway
still looks down into the room; the World auto-hides the ceiling from an aerial
camera). Explicit `wallDecor` /
`interiorWallStyle` / `wallMaterial` / `ceilings` win; generated and multi-cell plans
are untouched (the char pins hold). Door and window casings already existed. Tests
in `floorplan-onecell.test.js`.

### Floorplan — the bake variant's stage centres on the room

- `controllable` worlds: the bare-stage checkerboard takes `ground.center` (`[x, y]`, default the
  origin). Absent, every existing manifest renders byte-identical.
- `scripts/bake-world-gi.mjs` (generated-mesh gear): a minted `<ref>_gi` variant now carries a
  `ground` centred on the source footprint and sized to clear it by whole cells, so a floorplan
  (which spans `0..w × 0..h`) no longer hangs off the corner of an origin-centred stage. Variants
  minted before this carry no `ground`; re-bake or add one by `update_sketch`.

### Floorplan — normals, contact shadows, and the first GI-baked room (room-realism phase 3)

- **Every furniture face carries `outNormal`.** The box-net path in `extractRoomSceneFaces`
  (card rects and lines, leg posts, the generic prop box, the plain top plane) stamps the
  outward normal; a `local` asset's authored normals now TURN with the piece (a
  side-facing chair used to export its front normal unturned); sweep tubes author theirs
  too. Export-only (GLB NORMAL + the bake's facing) — shading never reads it. The two
  lounge char pins re-based again (same face counts); the per-kind world snapshot
  re-based for the furnished kinds (condo complex, restaurant, school complex).
- **`contactShadows`** (default off; on for a one-cell furnished plan): the room
  renderer's under-furniture AO decals reach the floorplan's faces and the World's
  shadow-decal pass. Decals now sit on the footprint's OWN floor (an upper storey keeps
  them upstairs) with a `lift` that clears the rug asset. The rug casts none. Honest
  note: the existing radial profile fades to nothing before the footprint edge, so from
  standing height the effect is subtle; a "rim" profile is the follow-up.
- **The first floorplan GI bake shipped** — `sk_lkypzdim4y_gi`, 98% corner match, 1%
  dark floor. The blocker was never the normals: a Cycles bake lands per VERTEX, and a
  room-sized floor quad's four corners sit ON the wall planes, so the whole floor
  interpolated black. The driver now (a) tessellates large plain quads for the
  generated-mesh gear (`bake-prep.js`, `--cell`, default diag/32), (b) excludes floor
  cells covered from above (a rug, a seat) from the coverage gate, (c) keeps shadow
  decals out of the bake mesh, and (d) honours authored normals, probing only the faces
  that lack one (`--remigrate` re-derives all). Tests: `floorplan-normals.test.js`,
  `bake-prep.test.js`.

### Floorplan — the pieces that make a room are meshes (room-realism phase 2)

Ten workbench-authored furniture assets in `room-assets-makers.js`, registered
`local: true` in `ROOM_FURNITURE_ASSETS`: club armchair, coffee table (with a book
stack), media console (with its TV), bookcase (shelves + hashed rows of books),
platform bed (frame, mattress, duvet, pillows, headboard), bedside table (with a
lamp), low dresser, sideboard, plank dining table, and a bordered rug (a field
inside a border with a medallion — `contact: false`, so no contact shadow under a
floor skin). Their ids and aliases deliberately avoid the bare arranger type names;
`furnishScale: 'share'` attaches them via `asset:` (`SHARE_ASSETS`), and a spun
layout stamps the facing an unfaced asset needs so a north-door bedroom still puts
the headboard against the wall. Eyes gate: the one-cell lounge now reads as a TV
wall, a bookcase, two club chairs and a coffee table on a rug.

**Compat note — a planner bug fixed, two char pins re-based.** `normalizeElement` in
`room-scene-elements.js` dropped an element's `asset`, so only pieces whose TYPE was a
registry id (the desks, the kitchen units) ever reached a mesh; a lounge's
`asset: 'modern-couch'` sofa had always rendered as its box-net card. `asset` /
`assetRef` now survive normalization. Consequence: every feet-mode plan with a lounge
re-renders with the workbench couch its arranger has asked for since day one. The
`floorplan-furnish.char.test.js` pins for the seed plan and the two-cell plan are
re-based (the re-pin log in the file says why); the stacked-house pin is unchanged.
Tests: `room-assets-makers.test.js`.

### Floorplan — share-based furniture sizing (room-realism phase 1)

The floorplan arrangers authored every piece in fixed feet (a 2.5 ft armchair, a
3.2 ft-deep sofa) divided by the room, so the planner's `areaShare × aspect` sizing
never ran for a floorplan: a user-sized 20×24 lounge read sparse and a 12×12 one
overflowed. `furnishScale: 'share'` re-derives each arranged piece's SIZE from its
preset share of the actual floor, clamped to a real-world band (`FURNITURE_BANDS`)
so a couch never outgrows a couch nor shrinks to a stool, then drops the
lowest-priority pieces (`FURNISH_PRIORITY`) when the packed floor passes 1.4× the
archetype's packing target. The arrangers keep authoring placement and axis: they
call a sizer with their legacy feet, and in the default `'feet'` mode it returns
those feet untouched — every existing furnished recipe is byte-identical (the
char pins). Anchors derived from sizes (bed → nightstand, table → chairs) stay
consistent because the arranger sees the resolved feet. The kitchen run is exempt
(a counter is 2.2 ft deep in any room). One-cell furnished plans default to
`'share'`. Tests: `floorplan-share.test.js` (bands, preset-share tolerance,
monotone growth, budget drops, in-room footprints, the knob).

### Floorplan — one-cell furnished defaults (room-realism phase 0)

"Make me a living room" is an explicit single furnished `floorplan` cell, and every
wall of it is envelope. The opt-in posture tuned for generated houses (`windows`,
`entryDoor` off; bare slab) left it a windowless, doorless box, and the exterior-door
rule silently dropped the authored door because it did not say `entry: true`. A
furnished plan with exactly one explicit cell and no halls now defaults
`windows: true` and `floorStyle: 'auto'`, cuts its authored door as the front door
(or auto-cuts one when none is authored), and takes command position against it.
Keyed on the raw manifest keys, so explicit values still win and the stacked-house
path is untouched. Generated and multi-cell plans are byte-identical — pinned by
`floorplan-furnish.char.test.js`; the one-cell behaviour is `floorplan-onecell.test.js`.
Design + the remaining phases (share-based sizing, meshes, normals + GI bake,
surfaces): `lite-template/integration/0904/room-realism.plan.md`.

### 3MF print export — the print leg's second format (interchange-seams seam 1a)

`export_model({ format: '3mf' })` (and `GET /api/sketches/<ref>/model.3mf`)
ships the SAME printable set as the STL — `isPrintableFace` over base faces +
instanced repeats, water / decals / studio grid omitted, z-up — as a 3MF
package, the format slicers prefer (PrusaSlicer, Bambu Studio, OrcaSlicer,
Cura), carrying what STL structurally cannot:

- **Units in the file** (`unit="millimeter"`): the true-scale promise travels
  with the bytes instead of a README note. The scale strategy is the STL's,
  unchanged — explicit `scale` > `target_mm` fit > `units` derivation for
  literal kinds > palm-size fit for maquettes / ornaments.
- **Colour** — the baked vertex colours the World draws, averaged per triangle
  and quantized to a bounded `<basematerials>` palette (256 max; a big
  AO-shaded world drops bits deterministically, reported as `color_bits`).
  Multi-material printers map bases to filaments; single-filament printers
  ignore them.
- **Shell identity** — the base geometry is one `<object>`; every instanced
  repeat is its OWN object placed once per instance by a `<build><item
  transform>` (the STL's TRS as a row-vector 4×3 matrix), so a 500-tree block
  is one tree mesh + 500 placeable items rather than 500 expanded copies.
- The closure audit, print profile, printed size, and README print notes
  ride both formats; the note says plainly that shells are separate objects,
  not a boolean union (that is the Manifold seam, still open).
- Substrate: `scene-3mf.js` (indexed vertices by exact-coordinate dedup,
  slivers dropped) over the new `printableShells()` walk factored out of
  `scene-stl.js` — the STL is byte-identical before and after (verified
  against HEAD on a mixed fixture) — and `zip-writer.js`, a dependency-free
  deterministic ZIP builder (fixed 1980 timestamp, optional 64-byte
  alignment for the USDZ leg next) with a minimal reader for the tests and
  the bind-back doors. Routing: the `export_model` TOOL_INDEX row + dispatch
  line, the tool schema, and `translate_modeler_lingo`'s print entry now
  name 3MF first.

### Slicer machine gate — `scripts/slice-print.mjs` (interchange-seams seam 1b)

The print bicycle's measured gate: export a sketch as 3MF (or take an existing
one), run a local PrusaSlicer / SuperSlicer headless (`--info`, then
`--export-gcode`, optional `--profile <bundle.ini>` / `--supports`), and stamp
`mojulo-print-gate.json` beside the file — `sliced`, `size_agrees` (the
slicer's bounding box vs mojulo's declared printed size, the unit-slip check
the closure audit cannot see), `manifold` / `parts` / `volume_mm3`, estimated
`print_time_s`, `filament_g`, `supports`, `layers`. Advisory, never a refusal.
Operator-hosted like the Blender / image / voice workers (`MOJULO_SLICER`,
PATH, or the macOS bundle); no slicer ⇒ rung 0, the 3MF + closure audit still
ship and the gate says why it skipped. OrcaSlicer / Bambu Studio are detected
with an honest "CLI not wired — open the 3MF in the app" reason. Pure half
(`print-gate.js`: binary search order, `--info` + G-code ledger parsers, the
summary) is unit-tested; the driver was smoke-run at rung 0 only (this host
has no slicer). Doc: `docs/local-slicer-worker.md`.

### WebXR on the walkable worlds — `xr: true` (interchange-seams seam 7)

A headset walks any live `/world` with no engine: manifest `xr: true` (or
`{ eye, speed, snap }`), or `?xr=1` on the URL, adds an immersive-vr entry to
the emitted three.js page — a `vr` HUD button (shown only when the browser
reports an immersive-vr device), the session handshake under `local-floor`, a
RIG that carries the y-up XR reference space inside the z-up world
(`Qz(yaw − π/2) · Qx(π/2)`), left-stick locomotion on the gaze heading,
right-stick snap turn, and feet that snap to the walk channel's floor probe
when one is emitted (typeof-guarded; orbit-only worlds ride the `eye`
fallback). No `three/examples` import — the page stays self-contained. A
bespoke block spliced after the runtime channels: absent `xr` the page is
byte-identical (every char pin unchanged; two new fixtures pinned). Honest
limits: no wall collision in VR yet; fog / effect overlays were tuned for
the mono view. Documented beside `fog` in the `city` card.

### OpenUSD export — `format: 'usda' | 'usdz'` (interchange-seams seam 2a+2b)

The interchange sibling of the GLB for the DCC side converging on USD
(Blender, Houdini, Unreal, Omniverse, Apple), and — as USDZ — AR Quick Look on
iOS / visionOS at TRUE scale, an eyes gate the print leg never had. `export_model`
(+ `GET /api/sketches/<ref>/model.usdz`) mirrors the GLB writer's preprocessing
so both depict the same world (water split, surface cards, one global
de-collide, the AO bake with instanced phantoms), then writes:

- a z-up layer (`upAxis = "Z"` — coordinates land VERBATIM, no rotated root)
  whose `metersPerUnit` rides the recipe's declared `units` (cm → 0.01; none →
  1, the pinned MOJULO_UNITS);
- one indexed `Mesh` per render group with per-vertex `displayColor` (the
  AO-baked colours; untextured meshes bind NO material so every viewer shows
  them directly), `:pbr` splits as UsdPreviewSurface with the displayColor
  primvar as diffuse + constant metallic / roughness, textured groups as
  UsdPreviewSurface + UsdUVTexture on a sidecar image (`textures/<key>.png`,
  written beside `model.usda`, packed inside `model.usdz`), water and shadow
  decals with `displayOpacity`;
- instanced repeats as `PointInstancer` (one prototype, N positions /
  quath orientations / scales); level cameras as `Camera` prims; entity
  placements as `Xform`s carrying the `moj:` extras in customData; spawn /
  colliders / game in the layer's customLayerData.
- USDZ is `zip-writer`'s store-only, 64-byte-aligned package, `model.usda`
  first — byte-identical per recipe.
- Honest ledger in the note + README: USD viewers LIGHT the surface (the
  baked colours read as albedo, not the unlit web look); rig figures / clips
  are not in USD yet (UsdSkel is seam 2c, after the humanoid map);
  per-instance tints are dropped as in the GLB. The eyes gate (Blender
  import, Quick Look on a phone) is open — no USD toolchain on this host.

### Quantized GLB — `export_model({ quantize: true })` (interchange-seams seam 6a)

`KHR_mesh_quantization` on the static mesh paths, no dependency: POSITION as
normalized int16 under a per-mesh dequantizing node TRS (centre +
half-extents, so the int16 range spans each mesh's own box; instanced repeats
put the shared mesh on a dequantizing CHILD under each instance's TRS),
COLOR_0 as uint16, NORMAL as int8, TEXCOORD_0 as uint16 when the UVs sit in
[0,1] (repeating tiles stay float). Vertex-attribute strides pad to multiples
of 4 as the spec demands. 24 → 16 bytes per vertex before normals; the
extension is declared REQUIRED, so the note says which readers take it
(Blender, glTFast, Unreal, Godot, three.js) and to re-export plain for the
rest. Off (default) ⇒ byte-identical float export; the bind-back reader now
DECODES quantized positions instead of refusing them (the node walk applies
the dequant TRS), so a quantized export round-trips within its step. Result
carries `quantized` + `quantize_step` (coarsest step in world units). Rig
figures keep their own packed form; `export_game` packs stay float until the
engine gates are re-run with it.

### Humanoid map — VRM bone names on the skinned figure (interchange-seams seam 3a)

`figure-humanoid-map.js`: the packed biped rig's eleven bones (pelvis torso
head, upper/lower arms and legs) ↔ the VRM 1.0 humanoid names, plus the
17-joint FIGURE_NODES map for the ingest door, plus a resolver that adds
WEIGHTLESS LEAF JOINTS at the wrist / ankle tails so the fifteen bones VRM
REQUIRES (hands and feet included) all resolve — and reports what a
non-biped rig cannot supply instead of pretending. `export_model({ clips,
skinned: true, humanoid: true })` renames the skin joints to the VRM names,
adds the leaves, and stamps the `VRMC_vrm` extension (specVersion 1.0, meta
with the VRM licence URL, `humanoid.humanBones`) on the first humanoid
figure, so VRM-aware tools (three-vrm, Blender's VRM add-on, retarget
scripts, Unity's avatar builder) address the figure by name. Off ⇒ the
skinned export is byte-identical. Honest limits, in the result note and
the map's header: the skeleton is still FLAT (absolute rotations, no
parent chain) and the rest is the stand pose, not a T-pose — a strict VRM
validator or Unity Humanoid auto-config wants the parent-local hierarchy,
which is seam 3a-ii; clip INGEST (Mixamo / VRMA → mojulo clips) is 3b.

### Mesh handoff — the durable mesh-worker bicycle (interchange-seams seam 5)

`request_mesh_render` → `pull_mesh_render` → `submit_mesh_render` →
`accept_mesh_render` / `reject_mesh_render`: the MESH sibling of the image
render handoff on the SAME durable table. `image_render_requests` gains a
`medium` column ('image' | 'mesh', migrated with default 'image'); the
repository's park / listPending / claimNext take a medium and the image
tools default to 'image', so neither queue sees the other. The packet is
the greybox — the PRINTABLE set (no water / decals / studio grid) as
`data/outcomes/<ref>/greybox.glb`, the shape prior — plus the still /
turntable / world URLs, the declared size + units, a triangle budget, and
the instructions. Submit is the machine gate: GLB decoded at the door,
bounds checked against the greybox (0.5×–2× per axis — a re-scaled or
re-centred return fails loudly), closure audited, then stored through the
same append-only `meshRef` slot + provenance sidecar `bind_mesh_render`
uses (the shared `bindMeshBytes` door). Accept is the eyes gate: refuses a
self-accept and a failed size gate (`accept_audit.override_size` to
override). Registered beside the image handoff, listed in the image-render
pack + form drawer + TOOL_INDEX; the tools/list budget re-pinned to bless
the five tools. Worker posture in `docs/local-mesh-worker.md` (Hunyuan3D /
TripoSR local, Meshy / Tripo / Rodin with the OPERATOR's key in the worker
script — never in mojulo).

### Manifold CSG union — `export_model({ union: true })` (interchange-seams seam 4a)

The print leg's honest VOLUME gate. `manifold-3d` (Apache-2.0, WASM — the
boolean kernel under OpenSCAD 2025) joins the creative group as an optional
dependency (externalized like `three`; `next.config.mjs` + the install-
capabilities doc updated). With `union: true` on `stl` / `3mf`, the printable
shells (base + every repeat instance, transforms baked) are welded into
Manifolds, DECOMPOSED into their closed components (a base set is usually
several overlapping parts), unioned into ONE solid, and read back as the
standard face list with per-corner colours (the vertex RGB rides Manifold's
property channel through the boolean) — so the closure audit, 3MF colours,
and STL all see the merged body. The result carries `union: { applied,
unioned, non_manifold: [{ name, error }], volume_mm3, genus, triangles }`
and the note says it; a shell that is not a closed manifold (an uncapped
sweep) is named and left out, never fatal; no package ⇒ `applied: false`
with the install line and the plain shells ship. Off (default) ⇒ untouched.
Machine-checked: two overlapping unit boxes → volume 1.5 exactly, genus 0,
both colours present; the two-cylinder workbench → one 3MF object, closed,
volume between one and two cylinders. `translate_modeler_lingo`'s print
entry now names the option.

### USD verify gate — `scripts/verify-usd.mjs` (interchange-seams seam 2, the machine gate)

The OpenUSD export's own machine gate, closed with the tools already on the
host: `usdcat` (macOS ships it) parses the layer and, with `--usdc`, flattens
it to binary USDC beside the text; Blender imports the file headless
(`scripts/verify-usd.py`) and reports meshes / triangles / world box /
vertex colours / textures / cameras / bones; `usd-gate.js` compares that to
what `export_model` declared (which now returns `size_units`, the export's
world-unit box) and stamps `mojulo-usd-gate.json`. `--glb` runs the same gate
over a GLB export (`--quantize`, `--skinned --humanoid` add the VRM bone
check). Results on this host: the lighthouse USDZ and the snowman USDZ both
green (triangles equal, the box lands in metres at true scale, colours and
five cameras present; USDC 30 KB → 17 KB and 3.7 MB → 1.4 MB); the humanoid
figure GLB is green on bones / colours / cameras but the gate CAUGHT a
declared-triangle mismatch on the skinned rig (declared 14,784, Blender
built 14,864) — first read as a writer tally bug; it was the gate's own reader
counting the importer's bone-shape helper (see the interchange-next N1 entry above).

### World thumbnails for three.js-only kinds + floor-plan manifest docs

- **World thumbnails.** The PNG route used to 422 for kinds with no CSS-3D emitter
  (`controllable` / `action` / `dungeon` / `floorplan`), leaving the gallery card blank;
  it now bakes the navigable World itself through the software-GL path
  (`renderWorldToPng`), disk-cached like every scene still.
- **Docs.** The `floor-plan` sketch-vocab card now documents the MANIFEST fields
  (`kind: 'floorplan'`, `furnish: true`, `view: 'cutaway'`, the `glyph` default of `S`)
  instead of JavaScript functions. The `world` routing card, the worlds pack, and the
  `forward_context` WORLD row list the shipping `compose_world` bases (stale `operator`
  dropped; `school` / `dungeon` added).

### Unreal handoff — the fourth engine leg, U0+U1 (worlds, games, the MojuloKernel C++ plugin)

A world or game recipe now exports as an Unreal Engine 5 pack (proven against
UE 5.8): the shared engine score + GLB realized by a dependency-free editor
Python script, and — for games — PERFORMED by a pack-carried C++ code plugin
the operator's project compiles itself. One score, four instruments: web,
Godot, Unity, this. Leg v0.3.0.

- **`export-unreal` (U0, world scope).** `scripts/export-unreal.mjs` emits
  `data/outcomes/<ref>/unreal/`: `model.glb` + `score.json` + audio + recipe,
  `import_mojulo.py` (Interchange scene import; promoted ground, box
  colliders, PlayerStart, player-seat body hidden; idempotent — imported
  actors tagged and cleared on re-run), the T-numbered `IMPORT-GUIDE.md`, and
  a provenance README. No `.meta` sidecars — UE idempotency rides
  deterministic asset paths. Frame pinned by the machine gate:
  `P(v) = (x·100, −y·100, z·100)` (meters → cm, y negated).
- **The unlit vertex-colour material story.** Interchange imports glTF onto
  lit default-grey materials that ignore `COLOR_0` (found at the first eyes
  gate: black in Lit, flat grey in Unlit — invisible to the `-nullrhi`
  machine gate by construction). The importer builds `M_MojuloUnlit`
  (emissive = base texture × vertex colour) plus per-atlas-texture instances
  and swaps every imported mesh slot; a `materials_unlit` gate check asserts
  full coverage. Rendered screenshots confirm the web-build look.
- **Machine gate.** `MOJULO_UNREAL` (or auto-found under
  `/Users/Shared/Epic Games/`): a scratch project whose `.uproject` the
  driver writes as plain JSON (no create step), serial watchdogged headless
  launches (`-run=pythonscript -unattended -nullrhi`), log-grepped, verify →
  `mojulo-gate.json` — scene, world instance, collider count, spawn, ground,
  materials, and the frame landmark (off-axis entities preferred so a
  mirrored world fails loudly). No UE ⇒ capability rung 0, pack + guide only.
- **The MojuloKernel plugin (U1, game scope).** The kernel-language
  decision: emitted C++ source as a code plugin (`MojuloKernel/` →
  `<Project>/Plugins/`), never Python-built Blueprints (opaque,
  non-deterministic). 13 deterministic source files: score/game.json readers
  (engine JSON module), the first-person walker (ACharacter, polled input —
  zero Enhanced-Input assets or config edits, eye-scaled), the full
  mechanics vocabulary with Unity-identical semantics (reach-exit, collect
  with bag + HUD, hazard-damage with visible markers + 0.8 s cooldown,
  survive, fail-on-death), canvas HUD/banners, a keyboard menu with
  `[done]`/`[locked]` gating, music beds, and progression persisted to
  `Saved/mojulo.completed`. The driver compiles it headless
  (`Build.sh UnrealEditor Mac Development -Project=…`) as a gate rung.
- **Game pack assembly.** `game.json` + per-level
  `levels/<ref>/{model.glb,score.json}` + audio beds with the battle
  rotation stamped into sidecar data (the sibling behavior) — and the Unity
  menu-bed dedupe bug fixed: `audio/menu.wav` is always written.
- **MCP surface.** `export_game { target: 'unreal' }` — enum + one-sentence
  description growth, mirroring the Unity branch.
- **Proven.** `sk_ms_tutorial_rising` (45.6 MB GLB, 1.49 M triangles, 324
  animations, 86 colliders) walked in the stock Third Person template;
  `crypt-of-the-rune-key` 16/16 gate checks green and the loop played
  start→finish — menu, level, exit banner, gated level unlocked. macOS
  landmines pinned in the guide: full Xcode required for rendered runs, and
  Xcode 26+ additionally needs `xcodebuild -downloadComponent MetalToolchain`.

### The walking suit, backported — Unity leg v0.4.0 + Godot kernel 0.2.0 (walking-suit-backport.md)

What Unreal U2+U3 taught, written into the two sibling kernels: rigged
figures now MOVE in Unity and Godot packs too. Ambient rigged entities loop
their idle (one baked body per figure ⇒ first claimant only, the player's
figure pre-claimed), and a level whose player seat is a rigged suit plays in
third person — the suit follows the walker (wrapper follow: feet on the
walker origin, yaw composed on the imported base rotation, never a raw yaw)
and swaps walk/idle by planar velocity. Absent locomotion rows ⇒ both packs
byte-identical to before.

- **Godot G-L0 — the visible double (bug fix, shipped packs).** `level.gd`'s
  seat hide looked for `entity_<id>`, but a baked rig's node is the FIGURE
  wrapper; the player's own body stayed visible at spawn. Entities are now
  resolved figure-first (`_entity_node`, rule 8), names sanitized the way
  the importer does (`gd_name`: invalid chars → `_`, case kept — verified
  against the import cache: `gframe_mk2_multi:boost` → `gframe_mk2_multi_boost`).
- **Godot kernel 0.2.0 — rigs + the suit + the probe.** One `AnimationPlayer`
  per figure, added as a SIBLING of the imported player (same `root_node`,
  shared libraries — track paths stay rooted where the importer put them);
  clips looped `LOOP_LINEAR` once on the shared animation (BOTH cycles — a
  walk left at loop none ends after one cycle, the probe's first catch).
  The suit is one player, `play(walk|idle, 0.15)` — Godot blends, so no
  paused twin. Camera: `SpringArm3D` behind a chest-line pivot (`0.55·h`,
  `max(3.5·eye, 2·h)`), `h` from the wrapper subtree's global AABBs; mouse
  pitch orbits the pivot; the walker's `head` stays the key-0 toggle target.
  **G-P, the headless motion probe**: `godot --headless <level> -- --mojulo-autowalk --mojulo-frames=N`
  holds forward input and prints a `[mojulo-dump]` ledger (walker, suit,
  upright = the wrapper's local Z·up, current animation, per-figure idle)
  at t=1 and t=N — the Unreal `-MojuloAutoWalk` rung without a window.
- **Godot driver — `locomotion_probe` gate rung.** `export-godot.mjs` runs
  the probe for every scene whose player carries a locomotion row and
  asserts: walker travelled >1 m, suit planar-on-feet <5 cm, upright >0.9,
  walk cycle current while moving. Green on `sk_ms_tutorial_rising`
  (11.9 m in 120 frames, 24 m suit). Scores without a row: `skipped`.
- **Unity leg v0.4.0 — Y-L0..Y-G.** `MojuloLevel.Entity.Locomotion`
  (`Any()`, never a null test — JsonUtility builds a default instance);
  clips captured at IMPORT into a per-level `List<AnimationClip>` on the
  kernel from the level's own `model.glb` sub-assets (never
  `AssetDatabase.FindAssets` — a pack-wide index makes the last level win).
  Playback through one seam, `IRig`, chosen by the clips' own `legacy`
  flag: **`LegacyRig`** (the shipped-`.meta` default — glTFast's serialized
  importer setting is Legacy, so `World` carries an `Animation` component;
  one `AnimationState` layer per figure, `WrapMode.Loop`, suit swap =
  `CrossFade` same-layer) and **`MecanimRig`** (the operator flipped the
  importer: `PlayableGraph` + `AnimationLayerMixerPlayable` on `World`'s
  `Animator` — LAYERS, because a plain mixer fills un-animated properties
  with defaults at each input's weight and over-blends N figures). The
  seat is `SetActive(true)` again (the importer bakes it hidden); the
  walker gains `SetCameraRig` (a `Pivot` boom, `pitchNode`) and `Velocity`.
  Gate: `clips_bound` now means Unreal's — every clip named by
  `entities[].locomotion` exists in THAT level's GLB and moves ≥1 transform
  under the FIGURE'S wrapper (seat re-activated to sample, restored);
  detail names the flavour. Green on the tutorial: compile clean, 6/6 bind,
  legacy clips.
- **Ledgers + guides.** `locomotion_performed` line in both packs' ledgers;
  the Unity guide's eyes chunk gains `#006`/`#022` (the suit follows,
  animates, upright, turns); the Godot README names the probe.
- Tests: unity-project 9 (a locomotion-row case: kernel seam, importer
  scoping, ledger + guide lines, no-row byte-identity); scene suite 476/476.
- Sources: `lite-template/integration/0904/walking-suit-backport.md` (the
  engine-neutral rules + the build log at its foot).

### Unreal handoff — U2+U3: locomotion, rigs, the walking suit (leg v0.4.1)

Rigged figures MOVE in the Unreal pack: ambient entities loop their idle,
and a game whose player seat is a rigged suit plays in third person — the
suit follows the walker and swaps walk/idle with motion. Machine-closed on
the `sk_ms_arena_u3_slice` game (one arena, three suit figures, one battle
track: gate 11/11, `clips_bound` 21/21); the eyes gate (the suit follows
AND animates under WASD) is the operator's and still open.

- **The `locomotion` score row — engine-agnostic.** `extractEngineScore`
  now stamps `entities[].locomotion = { idle, walk, boost }` from the
  figure's own clip vocabulary (`<figure>:<clip>`; mojulo rigs name the
  travel cycle `forward`, `walk` is accepted as an alias). Additive: an
  entity without travel clips is byte-identical, so existing packs re-mint
  unchanged EXCEPT that rigged entities in Unity/Godot scores now carry the
  row too — it is the backport vehicle for teaching those kernels the same
  two-state machine.
- **Kernel v0.4 — sequences + the walking suit.** Interchange imports the
  GLB's rigid-hierarchy animations as LevelSequence assets whose transform
  tracks are PARENT-RELATIVE (they pose part actors around the figure's
  wrapper). The kernel indexes them by sanitized name, loops first-claimant
  ambient idles (a figure bakes once; the player's figure is pre-claimed),
  and drives the player suit by wrapper follow: `SetActorLocation` at the
  walker's feet + a yaw delta composed on the imported base quat. Camera rig
  framed from the SUIT's attachment-tree bounds, not the pilot eye. Debug
  rungs: `-MojuloShot=<s>` (HighResShot after N seconds of play + a
  `[mojulo-dump]` position ledger) and `-MojuloAutoWalk` (headless
  locomotion probe).
- **Runtime landmines pinned (UE 5.8, all in the kernel).** Interchange
  scene actors import STATIC (silent `SetActorLocation` no-ops, frozen
  clips) → whole attachment tree set Movable before driving; the player
  suit's imported part colliders wedge the pilot capsule at spawn (WASD runs
  in place) → its tree is collision-off, blocking belongs to the score
  colliders; a raw rotator strips the imported frame correction (suit
  face-down) → yaw composed on the base quat; sequence transform-origins are
  inert for these tracks (tried, removed). Verified: the auto-walk probe
  covers 34 m straight from spawn with the wrapper at the walker's exact xy.
- **Importer + gate.** `clips_bound` verify (every locomotion sequence the
  scores name exists with live bindings); Interchange cannot RE-import
  LevelSequences, so the GLB asset subtree is clean-deleted per run; the
  player seat is hidden as a whole tree (one actor per GLB node); the frame
  landmark prefers first-claimant entities (later claimants have no wrapper
  of their own); all actor lookups compare in punctuation-sanitized space.
- **Per-level sequence scope (found in review, before U4).** A game pack
  imports one asset subtree per level, so a 45-level pack holds 45 copies of
  a shared suit's sequences under identical names; a pack-wide index let the
  LAST level imported win with bindings into another map's actors. The
  kernel now scopes its index to `/Game/MojuloPack/Levels/<ref>` (root for
  world packs) and `clips_bound` checks each level's own copy.
- **Driver.** The plugin's `Binaries/` + `Intermediate/` are cleaned before
  UBT: with a live editor holding the project, UBT hot-reloads a `-00NN`
  dylib the `.modules` manifest never points at, so headless runs executed
  a STALE kernel. Kill editors before gate runs.

### Mojulo 2.0 — the pure-creative reposition (BREAKING)

Mojulo is now a **3D factory for agents**. The reposition is by DEMOTION, not
amputation: nothing was deleted, and the orchestration backend (connected
services, catalysts, triggers, apps, plan/research/stash) is retained in full.

**BREAKING — the chatbot factory is opt-in.** A default install no longer carries
it: 17 of 20 packs, no bot tools listed, every bot tool refusing with an advisory
naming the install. Add it back with `mojulo install chatbot` (writes a marker
under `$MOJULO_HOME`; `--remove` takes it away). **Already-deployed bots are
unaffected** — the bot image is separately versioned (`bot-v*`) and runs as its
own process; it was never part of the workshop install.

- **Install is PACK-grain, not wing-grain.** A pack declares an `installGroup`
  (`creative` / `chatbot`) or none; a pack declaring none is unconditional, like
  the kernel. `wing` is now taxonomy/routing only. `MOJULO_PACKS` takes
  `creative` / `chatbot`, with `ops` kept as a deprecated alias for `chatbot`.
- **Studio-first routing.** `forward_context` defaults to the creative wing;
  the automation backend is `mode:'office'`. `get_substrate`, the MCP
  `initialize` preamble, `PARADIGMS` order, both READMEs, and the package
  description/keywords all lead with the factory.
- **Fixed: three connect-time strings still taught `mode:'office'` as the
  default.** The code default has been the studio since the carve, but the
  `forward_context` tool description (the always-in-context string in
  `tools/list`), its `mode` parameter, and the `get_tool_index` row all
  still said office-first — so an agent read the opposite of what the tool
  did. All three corrected within the existing description ratchet budget,
  and pinned to the now-exported `DEFAULT_FORWARD_CONTEXT_MODE` by a
  mutation-checked test that fails on the old text.
- **Dashboard.** Studio is the first mode and opens by default; operational
  tiles appear only when they have records; diagrams moved to Studio.
- **CLI honesty.** `mojulo tools` / `mojulo packs` now list only INSTALLED packs,
  with a `not installed: … add with: …` footer — execution is walled, knowledge
  is not.
- **`tools/sketches.js` split by tool family** (2038 lines → a registration
  surface + six focused modules), proven byte-identical by new mint goldens.
- **Bot docs migrated to `docs/chatbot/`.** The thirteen bot-only docs (factory flow,
  both builders, protocol composition, forms, optical read, bot frontend, conversations
  API + event log, RAG, turn hashing, federated routing, orientation) moved out of the
  main-line `docs/` into one directory with its own index, so they travel as a unit when
  the factory becomes its own package. All inbound and outbound links rewritten; the
  README's inline bot section collapsed to a pointer, and CLAUDE.md's "First read" no
  longer leads with the bot architecture.
- **Carve fence.** `pack-boundary.test.js` gained checks F/G/H: nothing outside
  the chatbot factory may import it, plus two shrink-only ledgers over the
  dashboard routes and the retained code still reading bot tables.

### Host neutrality — hosts are declared profiles, not vendor special-cases

Mojulo serves whichever MCP host the operator drives it from. The stance is
best-effort host friendliness: whatever host support is in the tree ships,
no host is promised parity, and none is treated as the assumed one. The
Claude-isms scattered through the wiring and the taught surfaces are now
one declared registry.

- **`lib/mcp/hosts/` — one JSON profile per agent harness** (claude-code,
  codex, desktop, grok-build, hermes): how to DETECT the host, how to WIRE
  it (dispatched on `wire.format`, with `manual` — detect it, print its
  snippet, write nothing — as the honest default for a config format not
  verified), and what its runtime can do (`capabilities`). Deliberately a
  SIBLING of the adapter cards, not merged into them: a card answers "where
  do artifacts live on this host", a profile answers "how do we detect and
  wire it" — and the two differ in cardinality (Desktop is wirable but
  resolves the `claude-code` card; `generic` is a card with no host to
  detect). Adding a host is a JSON file plus (usually) an adapter card — no
  JS edit.
- **`mcp-init` is registry-driven.** Detection order, config writers,
  `--host <id>`, and the manual-snippet list all read the registry; the
  script gained its own test file, and `mcp-init.mjs` / `mcp-install.mjs`
  joined the published `files` list so the wiring path works from the
  npm tarball.
- **Two new adapter cards** — `grok-build` and `hermes` — plus an
  orientation host-neutrality test pinning that no orientation surface
  assumes the Claude family.
- **`clientDefersSchemas` reads a declared trait.** The packs-off default
  for schema-deferring hosts now keys on the profile's
  `capabilities.defersToolSchemas` instead of comparing the client name to
  a vendor id; a second deferrer is a JSON edit, not a new condition.
- **The rules card — the honest read for output-capped hosts.** Some hosts
  cap tool results (~20k on Grok) while `get_tool_index` is ~48k — a
  truncated read that silently loses the tail. When the resolved host
  profile declares `maxOutputBytes` under the index size (or the caller
  passes `budget_bytes`), the index is served as a sub-budget substitute:
  the standing rules, then one terse line per installed tool, fit by
  stepped degradation (72 → 48 → 32 chars → names only) with the landing
  step and anything dropped named in the footer. Mitigate, disclose, never
  block — the card says what it is in its first lines, and
  `get_tool_index({ full: true })` always returns the real thing.
- **The taught surfaces stopped assuming one host.** The glossary and
  drawer copy describe skills/adapters in per-host form ("`get_adapter`
  names YOUR host's form; don't assume another host's"), the worked
  examples seal with `adapter_id: '<your adapter id from get_adapter>'`
  instead of `'claude-code'`, and the agent-tasks timeout note names the
  `run-inference-worker` catalyst with whatever repeat affordance the host
  has — `/loop` being the Claude Code instance, not the definition.
  `MOJULO_AGENT_RUNTIME=claude-code-headless` is called what it is:
  Claude-Code-only today.

### Mechanics vocabulary V1 — the combat trio

Three new declarative level mechanics (mechanics-vocab.plan.md V1, the first
words grown since M0): **`win-when`** (the generic predicate terminal — any
numeric truth crossing a threshold ends the level in success, with an optional
hand-named audit), **`hp-pool`** (per-entity health as namespaced vars — a
clamped decrement on `hit:<id>`, an edge-watch emitting `enemy:down` and
toggling the entity off at zero), and **`defeat-all`** (counts `enemy:down` to
a target — explicit, or inferred from a sibling `hp-pool`'s entity list). All
three lower to existing bus verbs; no new runtime primitive.

Compose enforces the V0 correctness warning: a `defeat-all` that nothing in the
level declaratively produces `enemy:down` for is REFUSED with a hint —
`producer:'runtime'` is the explicit acknowledgment that hand-authored world
reactions emit it. Cards for all three (`get_game_vocab`), mechanics-guide
updated. Engine portability is intentionally unchanged: the new words do not
claim to travel until the Godot kernel performs them (V3) behind the
performed-vocabulary registry (V2).

### `half: true` — halving as a modifier on the parts door

- **Halving is now a modifier, not a shape name.** Every parts-door shape is a
  lathe profile over `t ∈ [0,1]`; `half: true` clips that profile to its
  `to`-side half and remaps it onto `[0,1]`, so the flat cut lands at `from` and
  the shape's own free end stays at `to`. One rule across the whole set:
  half-`ball` is a hemisphere, half-`barrel` a belly-cut cask, half-`cone` a
  frustum, half-`drum` a plinth. Swap `from`/`to` to move the flat face to the
  other end. Composes with `girth` / `taper` / `radial` / `mirror`.
- **New base shape `egg`** — a blunter ovoid than `ball` (`radius =
  girth·√(1 − |2t−1|³)`), rounder-shouldered than a sphere. Its halved form is
  the FOOT/PAW shape: flat cut mating the ankle, rounded toe box forward — and
  equally a boot toe, pad, hoof, thumb tip, acorn cap, or domed crown. Every
  other shape in the set is open-ended at both poles; a halved one is the only
  thing that reads flat-mounted. Routed as such in the tool description and the
  `manji-tree` solid-vocab card. `half-egg` is accepted as a shape name and is
  exactly `{ shape: 'egg', half: true }`.
- The cut is AXIAL (perpendicular to the axis) — the only half a surface of
  revolution can express, and the halved footprint stays circular in plan. A
  LENGTHWISE half (half-pipe, trough, D-section, a flat sole under a foot) is a
  clip plane parallel to the axis; no primitive does that today.

### The `object` reference target — reading a photo into a block-out

`capture_reference` / `reference_protocol` know a fourth target. Where
`scene` recovers a CAMERA and `pose` an ARMATURE, `object` recovers a
PART-GRAPH: the agent reads one object and states it as workbench monomers
(lathe / extrude / sweep / shell) bonded by a named junction move per part
(`stack` / `jut` / `composite`); the substrate lowers that to a
`kind:'workbench'` recipe and mints it like any other cage. Design + build
log: `lib/reference/object-reference.plan.md` (rev 4); first proof subject
run against a real photo.

- **No absolute z, structurally.** Every part height is a FRACTION of the
  object's `unitHeight` and the substrate multiplies — proportion drift from
  stacking absolute heights is impossible by construction, not by review.
- **Segment-first for complex subjects.** Three or more distinct seams (or
  ~10+ parts) routes the read to `segments[]`: each segment a whole
  sub-object at its own origin, minted as its own workbench recipe and
  judged ALONE, composed into an assembler cage by gravity seating.
  One-shotting a complex whole is the proven failure mode.
- **Multi-pass refinement FUSES.** A refining pass merges onto the last
  cage's insights (`fuseObjectInsights`) instead of replacing them, so a
  second look sharpens rather than forgets; `replace: true` is the explicit
  escape hatch, and a pass that could not fuse says so and keeps the
  previous cage in the stash.
- **The scene camera went photograph-first.** The `scene` target's taught
  protocol dropped the two-point drawing construction as its frame: a
  photograph has a HORIZON, one PRINCIPAL recession, and a scale anchor —
  two-point is optional and strictly downstream (`lib/reference/scene-camera.js`,
  pure functions). The depth mapping (depth ∝ 1/(row − horizon)) makes
  ground AREA arithmetic instead of eyeballing, and the frontal street
  canyon — where both façade rows converge on ONE point — stops being a
  degenerate case. `object` reads on non-orthographic photos run `scene`
  first and measure band heights in world units.
- The `tools/list` payload ceiling consciously re-pinned 256,000 →
  256,500 bytes for the target's routing surface; both tool descriptions
  stayed under their allowlist snapshots (the contracts are taught in the
  protocol RESULT, not the list).

### 3D factory UI — the surface learns the vocabulary (phases 1-9)

The dashboard now speaks the colloquial vocabulary of 3D work while the spine
underneath is unchanged: no primitive renamed, no tool signature moved, no
route deleted before its replacement carried the traffic. Design + per-phase
build log: `components/3d-factory-ui.plan.md`.

- **Tokens.** A bay/ink/signal/radius palette; the legacy names re-point at it,
  and both gray ramps move at once so ~1,700 hardcoded literals migrate without
  a component change. Every re-pointed step was contrast-measured first.
- **Display modes.** Wire / Shaded / Baked / Painted on the detail page and both
  gallery previews. Two of the four paths already existed and had simply never
  been surfaced. Unavailable modes are disabled WITH their reason; `painted`
  always carries its provenance badge.
- **Library fold.** `/library` with shelf chips replaces four routes that were
  one gallery with a different prop. A shelf is a FETCH SCOPE, not a client-side
  filter — the first cut showed 200 of 2,111 artifacts and hid the rest.
- **Turntable cards.** Grid cards turn through a baked 16-frame azimuth strip on
  hover, minted on first hover behind a dedupe queue rather than on the mint
  critical path. Closes a standing gap: orbit-only kinds had never had a
  thumbnail at all.
- **Render Bay.** `/render-bay` — the durable image-render queue, GI bakes, and
  cooks/exports in one place. Four stages, not three: `submitted` IS the eyes
  gate, and folding it into "in flight" would hide the one gate worth showing.
  Bakes report the machine gate's measured numbers beside an eyes gate that is
  honestly unrecorded. Queue rows fold by ref, matching `pull_image_render`'s
  own grain — 66 rows became 14 on a real workshop.
- **Viewport home.** `/` is a live artifact with an outliner, inspector, and
  status bar. The outliner reads each recipe's OWN branches (there is no shared
  scene spine to walk) and marks structure it has no word for rather than
  hiding it. Two readouts the plan asked for were dropped as false: the STL
  writer reads units as millimetres, not metres, and a triangle count costs a
  full world resolve.
- **The splayed floor (phase 7).** `/` now splays the library across the
  landing surface, sorted **3D** (scenes · models · characters · materials)
  over **2D** (images · diagrams) — the walk-vs-orbit-vs-flat split the
  substrate already draws, lifted to the surface. Each shelf is a strip
  wearing its own card (turntable cards, cast cards with a figure/sheet/sprites
  kit line, reading-room rows); strip headers open the `/library` shelf; the
  viewport-home reading of one artifact remains at `/?ref=`. Iteration chains
  fold by title stem into stacked faces (`×N`), characters fold by name
  (`library-zones.js`, pure + tested). Fed by one light request —
  `/api/home/floor` ships ref/title/kind/renderMode/badges and never a
  manifest, over a single-scan `SketchRepository.newestByBucket()`. Loading
  posture: poster still first and the one live iframe mounts after idle,
  below-fold strips render skeletons until approached, every card image
  lazy-loads, painted provenance badges ride the wall itself.
- **The library rooms (phase 8).** Each `/library` shelf now opens as its own
  contextual body, dispatched by a `view` field on `LIBRARY_SHELVES` exactly
  the way `registry` already swapped in the material shelf: scenes are a
  **location board** (kind facets, wide cards, a live focus modal
  with an outliner facts rail and an iterations filmstrip), models a
  **turntable wall** (dense §6 cards, version stacks, an inspector modal with
  `.STL`/`.GLB` exports off the existing model routes), characters a **cast
  board** (one card per character with a figure/sheet/sprites kit line; a
  missing piece is an amber copy-prompt, not an empty slot), images a
  **print wall** (natural-aspect masonry, always-on painted badges, a keyboard
  lightbox), diagrams a **reading room** (document rows with inline accordion
  expand and one-click SVG/PNG). All five fold iteration chains
  (`collapseStems` now carries the sibling filmstrip) and read the same
  bucket fetch the gallery already made — nothing new on the wire. The
  toggle relabels to **Room / Full folder view**, so management (folders,
  bulk move/delete) stays one click away and the Recent shelf keeps the
  classic gallery.
- **The floor moved to `/dashboard`; `/` is a directory (phase 9).** The floor is
  what you open to SEE the workshop, which made it a poor thing to stand between
  the operator and every other page. So `/` is now **Workshop Home**: one frame,
  every door as a link row grouped by mode, an icon and a mono line saying what
  is behind it, the route itself on the right edge, the library's 3D/2D tallies
  on the plate that opens the floor, and one amber copy-prompt card. Drawn in
  the brand system stated plainly — the Ben-Day field only where something can
  be minted, dot rows only as proportions beside their own number, a lit hue
  only as a state claim. `/dashboard` no longer redirects to `/bots` (everything
  that meant "take me to the fleet" now says `/bots`, and the nested
  `/dashboard/*` bot pages are unchanged); `/?ref=` moved with the floor to
  `/dashboard?ref=`. `/api/home?shallow=1` serves counts without resolving a
  head artifact or scanning outcomes. The old tile launcher (`HomeLauncher`) is
  retired — the directory replaces it, including as the empty-workshop fallback,
  so the two can no longer disagree about what exists.
- **The mark is ink; the surface owns the field.** `MojuloMark` used to render
  its latent cells as well, so the `m` carried a miniature dot field wherever it
  went — a rectangular patch with a hard edge on a plain surface, and two
  lattices at different pitches on a `.moj-field` plate. `--field-dot` means
  "space that can be minted into", which is a fact about a surface; a logo
  asserting it claims to be latent space, and the mark is the thing that already
  exists. The `field` prop is gone: put `.moj-field` on the plate behind the
  mark and get one lattice with the letterform condensed out of it.
- **The doors are reliefs too, and the home is a grid.** The icons were 1.25px
  hairlines that could have belonged to any dark dashboard, so the brand stopped
  at the logo. `scripts/build-brand-icons.mjs` now bakes every icon in
  workshop-nav.jsx into a 24-cell lattice with the mark's own radius ramp
  (`lib/brand/icon-dots.js`), drawn by `IconRelief` — a door and the `m` are
  samples of one instrument. The bake reads the React components rather than
  keeping a second copy of the geometry, with a strict parser that throws on
  anything it does not understand and a pinned re-bake test, so an icon that
  changes shape without a re-bake fails in CI. A tile now NAMES its icon
  (`DOOR_ICONS`) instead of holding the component, since a door is drawn two
  ways and a name is the only thing both readings can share. Above the lattice's
  floor the grid draws the relief; below it, the line icon unchanged — the same
  two-readings rule `MojuloMark` already follows. The home's link rows became a
  grid of plates with names and no descriptions: a door needs its face and its
  name, and a list's spare width pulled in prose that made the front door a
  document to read instead of a rack to scan.
  - *Measured, then cut:* the first bake fattened strokes 2.1x to give the
    lattice mass and turned every form into a lozenge; the mass moved into the
    radius ramp instead (fatten 1.3, gamma 0.45), which is why the gamepad still
    has a hollow. A dot-stroke reading for dense chrome was built and dropped —
    at 18px it puts a 0.9px dot every 1.5px and aliases to a grey smear at 1x.
- **The front door IS the nav, and the drawer is the same rack.** The whole home
  is one curved shell (`--radius-shell`, `.moj-shell`) whose top strip carries
  the brand, the locator, the install pills and **Settings** — so AuthNav stands
  down at `/` rather than stacking a second bar over a page whose entire job is
  "here are the doors". Settings stays chrome instead of becoming a thirteenth
  door (a mode holds what the agent MAKES), and `/` has no drawer trigger at
  all: on the rack itself the drawer would open a copy of the page behind it.
  The drawer now renders the SAME `DoorGrid` component at three columns in its
  own floating shell, so the two surfaces can no longer drift in shape the way
  they already could not drift in contents.
- **Fewer things counted at you.** The per-mode door counts are gone (a count of
  doors beside a grid of doors is the page counting what you can already see),
  the Dashboard plate's prose blurb is gone (its zone dot-rows say it better),
  and the ask card is one line.
- **The view-cube strip — a named not-done closes.** The camera lives inside
  the `/world` iframe's own three.js context and nothing outside could reach
  it; embedded frames now speak a three-message postMessage protocol
  (`lib/graph/scene/view-cube-contract.js`, the same `{moj}` dialect as the
  game shell's level contract): the frame announces `world-view-ready` with
  its REAL render groups, the parent asks for ¾ / Front / Side / Top
  (`world-view`) or isolates one render group (`world-focus`).
  `WorldViewStrip` draws the strip on the viewport home, the location
  board's focus modal, and the artifact detail page — protocol-gated, so a
  CSS-3D frame, a plain image, or a frame that failed to boot never grows
  buttons that do nothing. In the frame, focus outranks the cutaway (an
  isolated wall holds full opacity from any angle; siblings dim to a floor
  instead of auto-hiding), and the view fit separates the subject from the
  studio floor the same way the `?spin=1` showcase fit does.
- **Fixed: artifact pages opened in their own tab were stuck on a spinner.**
  On a full page load the SSR'd viewer iframe could finish loading before
  React hydrated and attached `onLoad`, so the loading overlay never cleared
  (and, being click-opaque, blocked orbiting). The detail page now peeks at
  the same-origin frame once after mount and clears the overlay if the
  document already completed; the overlay is also `pointer-events-none`, so
  even a genuinely slow frame never traps the pointer.

### CAD-grade STL export — the print handoff learns what it is printing

The physical-object edge hardened (design + phase log:
`lib/mcp/tools/cad-aid.plan.md`; phases 0–1 of five).

- **Print profiles.** Every STL now knows what it IS. `literal` kinds
  (workbench, assembler, carved-solid, turntable solids, vehicle instances)
  print at true scale derived structurally from declared `units`
  (mm/cm/m/in/ft) — never agent arithmetic; worlds and buildings print as
  `maquette` miniatures fit to `target_mm` (default 120mm — a stray
  `units:'ft'` on an edifice can no longer print a building at building
  scale); figure/manji-tree are `study` surface shells, the science views
  `ornament`. Precedence: explicit `scale` > `target_mm` fit > profile
  default; results carry `print_profile` + `size_mm`.
- **The studio stays home.** The workbench's measured floor plate and grid
  are tagged studio furniture: the GLB keeps them as the scale cue for DCC
  round-trips, the STL drops them — zero-thickness grid quads riding into a
  slicer are mesh-repair poison.
- **The machine gate travels with the artifact.** Every STL export runs an
  advisory whole-object closure audit over the final printable soup
  (post-repeat-expansion, post-floor-filter): hole count and widest gap in
  declared units, stamped into the result, the in-band note, and a generated
  README's Print notes. Advisory, never refusing — suitability belongs to
  the operator.

### Edit-in-place for 3D recipes — closing the mint-once gaps

Recipes are STARTERS — the agent iterates them in place on the same ref. That
was already true for worlds but broken for three 3D families; all three closed
(design + build log: `edit-3d-recipes.plan.md`, since archived).

- **Games are editable.** `update_sketch` gained a `kind:'game'` branch paying
  create_game's structural gate (schema + level resolution + per-level contract
  dry-run). Completability stays mint-time promotion discipline: levels newly
  added by an edit are named in the result `note` as unaudited, never silently
  promoted.
- **Solids and edifices say the quiet part.** Every `mint_solid` kind and
  `edifice` was already editable through `update_sketch`'s world branch, but the
  tool descriptions taught "re-mint" — they now teach iterate-in-place, and
  regression tests pin the path (including the clamp contract: an out-of-range
  figure dial is accepted because joint limits clamp at render).
- **Motion round-trips.** `forge_motion` accepts `recipe_ref` (an existing
  motion ref) or an edited `recipe` (its stored recipe.json) in place of
  subject+shot — the stored recipe is now a legal input, so the read-tweak-
  re-forge loop works. Compiled ticks win over waypoints for exact replay.
- Description growth compressed to routing grade; `forge_motion`'s allowlist
  and the tools/list payload ceiling consciously re-pinned.

### `clay-render` — the reconstruction style register

The dream loops (shape-from-dream, character-from-dream, mobile-suit, edifice)
used to prompt the image worker in a flat ILLUSTRATION register. They now
default to a **clay model** instead: a new `clay-render` style preset asks for
an untextured neutral-grey model on a plain backdrop — separable primitives,
visible seams, honest proportion, no colour or texture. It matches what the
loops actually build (lathe / extrude / sweep / manji, or ~20 body dials plus a
wardrobe spec), so the read-off step is close to mechanical and there is no
paint in the reference the substrate could never have carried.

- Two dials: `construction` (primitive blockout ↔ sculpted detail) and
  `finish` (`clay` / `matcap` / `ao` — occlusion states contact best).
- The flat illustration presets stay as the named ALTERNATE — for a target
  whose identity is a graphic/period style, or a second colour-only pass once
  the form is locked. `photo-realism` stays out of all four loops.

### Godot handoff — the engine leg of interchange (G0 → G6 kernel)

A world or game authored as recipes now exports as a ready-to-open Godot 4
project — playable when the gameplay is declarative, an honest asset handoff
when it is not. Full design + build logs in
`lib/graph/scene/godot-handoff.plan.md`; sibling plan alignment in
`lib/graph/game/export-unreal.plan.md`.

- **G0 verification gate (closed).** `scripts/godot-verify.mjs` + `.gd`
  repeat the Blender I4 gate against Godot 4.7: clips, cameras, `moj:*`
  extras, COLOR_0 + unlit all survive import. Load-bearing findings recorded:
  Godot never sets `vertex_color_use_as_albedo` (worlds render white without
  the fixup), clips resample at 30 fps, extras flatten to one meta dict.
- **`export-godot` (G1 + game scope).** `scripts/export-godot.mjs` emits
  `data/outcomes/<ref>/godot/` for a world ref (walkable level) or a game ref
  (menu, `completed`-gated progression persisted to `user://progress.cfg`,
  music beds with volumes). Machine gate built in: headless `--import` ×2
  plus a one-frame run of every scene (import compiles no GDScript, and
  Godot exits 0 on script-load failure — the gate greps the log); `--web`
  attempts the web build. Deterministic packs: same rows → same bytes, no
  timestamps, no uids.
- **The mojulo-godot kernel 0.1.0 (G6).** Packs ship DATA performed by a
  hand-authored, versioned kernel (`lib/graph/scene/godot-kernel/` — copied
  verbatim, never generated): score.json/game.json are interpreted at
  runtime for ground + colliders, cameras, the walker, material fixup, and
  the FULL declarative mechanics vocabulary — reach-exit, collect (bag +
  HUD), hazard-damage (HP + visible danger spheres), survive, fail-on-death.
  One score, two instruments: game-shell.js performs it on the web, the
  kernel performs it in Godot.
- **Portable profile (advisory).** `lib/graph/scene/engine-portability.js`
  assesses gameplay against the vocabulary at export; `portability.json`
  ships in every pack. Crypt-of-the-rune-key: portable, zero flags; Mobile
  Suit Arena: 47 named flags ("win condition lives in runtime code") — the
  score travels, the combat performance is re-orchestration by doctrine.
- **MCP surface.** `export_game { target: 'godot' }` emits the pack
  in-process via the shared assembly engine (`lib/graph/scene/godot-pack.js`,
  one code path behind both the CLI and the tool). One-sentence description
  growth against the payload ceiling.
- **Shared score extraction.** `lib/graph/scene/engine-score.js` — the
  engine-agnostic resolved-payload digest (colliders, spawn, cameras,
  entities, mechanics, audio, honest-loss ledger) that the planned Unreal
  leg consumes as-is; `export-unreal.plan.md` gains the implicit-ground-plane
  row the Godot spikes surfaced.
- **Proven cargo.** MSA chunky run: 45 levels / 1.66 GB / 12,216 animations,
  import + 46 one-frame runs clean, zero per-world code. Known export-side
  debts unchanged and named in ledgers (glyph/primitive entities bake no
  mesh — kernel draws placeholder markers; roster clump; per-level rig
  duplication).

### Unity handoff — the third engine leg, Y0+Y1 (worlds, games, the operator guide)

A world recipe now exports as a Unity 6 pack: the shared engine score + GLB
realized inside a stock URP project by a dependency-free C# editor script,
with a **T-numbered operator import guide** — the artifact this leg adds over
its siblings (Unity import has irreducible human steps; the guide protocol is
the field-tested one from a working studio's Unity agent doc). Design:
`lite-template/integration/0902/export-unity.plan.md`.

- **`export-unity` (Y0, world scope).** `scripts/export-unity.mjs` emits
  `data/outcomes/<ref>/unity/`: `model.glb` + `score.json` + audio + recipe,
  `Editor/MojuloImport.cs` (builds the scene: promoted ground, box colliders,
  spawn + camera, soundtrack, player-seat body hidden; menu item and two
  batchmode entries), `IMPORT-GUIDE.md`, provenance README, and a
  deterministic `.meta` beside every file/folder (GUIDs minted from
  `sha256(manifestHash + path)` — the Godot uid decision, transplanted).
  Same rows → same pack bytes, tree-hash verified.
- **Machine gate.** With `MOJULO_UNITY` set: a cached scratch project,
  glTFast (`com.unity.cloud.gltfast`, pinned 6.9.1) injected into the package
  manifest, headless `Mojulo.Import.Run` then `Mojulo.Import.Verify` —
  collider counts, spawn, ground, and a **frame landmark** that pins the
  z-up → Unity mapping against a named entity node (a mirrored import fails
  loudly). License-wall and compile errors reported by name; no Unity ⇒
  capability rung 0, pack + guide only.
- **The mojulo-unity kernel 0.2.0 (Y1).** Packs ship DATA performed by
  generated C# in two halves: `Editor/MojuloImport.cs` builds and saves the
  scenes (menu + per-level, written into the build settings list), and
  `Runtime/` performs the dynamic half live — the first-person walker
  (eye-scaled speed/jump/gravity, kill-plane respawn), the FULL declarative
  mechanics vocabulary (reach-exit, collect with bag + HUD, hazard-damage
  with visible danger spheres, survive, fail-on-death), gold markers for
  meshless entities, IMGUI HUD/banners/menu, music beds, and
  `completed`-gated progression persisted to PlayerPrefs. One score, three
  instruments: web, Godot kernel, this. Known wart, guide-stepped: new URP
  templates default to Input System-only — T002 sets Active Input Handling
  to Both (kernel uses classic Input + IMGUI, zero package dependencies).
- **Emitters + tests.** `lib/graph/scene/unity-project.js` /
  `unity-pack.js`, vitest coverage: determinism (world + game), guide T/`#`
  protocol (one-line steps, two-digit substeps, ascending), no
  wall-clock/dice, honest ledgers (interpreted vs unknown mechanics,
  `no_completion_path`, per-level game ledgers), guide snapshot.
- **MCP surface.** `export_game { target: 'unity' }` emits the game pack
  in-process via the shared assembly engine — enum + one-sentence
  description growth against the payload ceiling, mirroring the Godot
  branch.
- **Standalone player build (Y5).** `export-unity --build` runs
  `Mojulo.Import.BuildPlayer` headless after the gate: BuildPipeline over the
  importer's scene list for the host platform → `build/mojulo.app` /
  `mojulo.exe` inside the scratch project (reported, not packed — the pack
  stays deterministic). The guide grows a one-step "Ship it" chunk
  (Build Profiles > Build — the scene list is already filled). Proven at
  both ends of the scale: the crypt game as a 99 MB double-clickable macOS
  app, and Mobile Suit Arena — 45 scenes / 1.65 GB of assets — as a 2.4 GB
  app, both with zero gate failures.
- **Proven cargo.** Machine gates closed on all three proving grounds:
  `sk_ms_tutorial_rising` (86/86 colliders, frame landmark exact,
  `clips_bound` — 324 clips, the sampled boost cycle moved all 17 rig
  joints), `crypt-of-the-rune-key` (15/15, portable, zero flags, the full
  mechanics loop live), and the MSA chunky run — 45 levels / 1.65 GB /
  352 files imported headless with **318/318 checks passing**, portability
  honestly flagging the 47 runtime win-conditions that do not travel.

### The greybox seam — operator-declared handoff posture (skin-over-mesh phase 0)

Engine packs can now be stamped with a handoff posture: `greybox` declares a
BLOCKOUT (geometry/scale/layout authoritative, surfaces placeholder), `final`
the opposite. A **declaration, never an inference** — the vertex-colour look
is a legitimate final style, and mojulo does not grade its own output's
finishedness. Unstamped exports are byte-identical to before. Design:
`lite-template/integration/0903/skin-over-mesh.plan.md`.

- **The stamp.** `export_game { posture }` (godot/unity targets) and
  `--posture` on both CLI drivers, with a manifest `posture` as the durable
  per-recipe default (a game manifest defaults its whole pack). The score
  carries `posture`; a greybox pack's honest-loss ledger leads with the
  reframe (surfacing losses are *deferred to the downstream art pass, not
  lost*), and the Godot/Unity READMEs + IMPORT-GUIDEs carry the one-sentence
  handoff contract.
- **Skin-baseline characterization net** (phase 0 of the skin plan): hash
  pins over every face channel (face→mesh bake, GLB transport, the unstamped
  engine score) plus texture-path edge-case tests — the guards the upcoming
  recipe-emitted-UV work must keep green.
- **Fixed: unlit textured faces crashed GLB export.** `weldSoup` dereferenced
  the null colour buffer the unlit-sticker path (label wraps without
  `textureLit`) hands it — found by the new texture tests; welding now keys
  on position+uv alone when no COLOR_0 rides.

### Recipe-emitted UVs — surface textures on organic bodies (skin-over-mesh phase 1)

The ring-stack family now emits its own cylindrical UVs, so any
surface-textures tile (marble, stone, wood, …) rides an ORGANIC body — not
just slabs — end to end: live World, GLB, Unity via glTFast. No unwrap
solver: the recipe knows its own (u,v) — ring index along the axis, angle
around it; RepeatWrapping owns the one seam column. Opt-in, byte-identical
absent (the phase-0 characterization net pins it).

- **Lathe skins.** The label wrap widened into a full-surface skin:
  `wrap.lit` multiply-lights the tile (texel × baked Lambert — the vase
  keeps its form shading under the veining) and `wrap.repeat {u,v}` tiles
  the isotropic-grain family small. Caps stay untextured.
- **Figure skins.** `manifest.skin { texture, lit?, repeat? }` on a figure:
  flesh ring-stacks (tagged at build) carry per-face uv through the shared
  mesher; garments/hair/props keep their own paint. The packed FK rig keeps
  vertex colours (animated-body texturing is the phase-4/5 track).
- Eyes gate: front/¾/back spike shows independent texturing per side —
  real UVs, not the screen-projection wraparound of the camera-registered
  skin path.

### The skin atlas — deterministic cuts, reprojection, and the coverage gate (skin-over-mesh phase 2a)

The wrap loop's deterministic half: mojulo designs the CUTS, registers the
paint, and audits the result; an image worker (or any painter) owns only
pixels. `polygonizer/skin-atlas.js` packs a recipe's uv islands (one per
ring stack / lathe wall, tagged at mint) into a gutter-separated page as a
pure function of the face list; painted VIEWS from known cameras lower into
the atlas per-texel — facing test + a scene-aware depth buffer (self- and
prop-occlusion), best-facing view wins — and the machine gate reports
per-island coverage with a hole list that GENERATES the next views rather
than failing the job. The painted page binds through the existing texture
channel (`remapFacesToAtlas` + `manifest.textures`) with zero new
transport, and `atlas-<n>.png` joins the append-only skin store. Proven
closed-loop: a figure's own 4-view renders reproject into an atlas the
figure then WEARS correctly from a camera outside the view plan — the
multi-view answer to the single-view camera-registration skin ("back faces
wrap front colours" is retired where an atlas exists).

### The wrap loop — skin_polygomer mode:'atlas' (skin-over-mesh phase 2b)

The atlas core, wired as a tool seam — three calls of one (unlisted-alias)
tool, zero tools/list cost. PLAN: `skin_polygomer({ ref, mode:'atlas' })`
returns a deterministic 5-camera deck derived from the figure's own
bounding box, ready to hand to any painter (`request_image_render` img2img
or otherwise) — the camera parameters ARE the registration. PAINT: submit
the painted views with their cameras; mojulo reprojects them into the
atlas, runs the coverage gate, writes the append-only `atlas-<n>.png`, and
stamps `manifest.skin.atlas` — the figure then WEARS the page at resolve
(faces remapped into atlas space, the PNG riding `payload.textures`;
missing page degrades cleanly). LOOP: holes come back as ready-made
close-up inpaint cameras aimed down each hole island's outward normal —
resubmit until the audit runs dry. Advisory throughout: the operator ships
or reloops, never blocked.

### Textures are a carried line — engine packs say so (skin-over-mesh phase 3)

Surveying for the planned "Godot texture path" proved textures ALREADY
travel: the GLB embeds TEXCOORD_0 + PNGs, Godot's importer maps them to
`albedo_texture`, and the kernel fixup's vertex-colour albedo MULTIPLIES
with them — exactly the web renderer's texel × baked-light contract
(unlit stickers ride KHR_materials_unlit untinted). So phase 3 became
verify-and-state-it: the engine score names the payload's texture keys,
both Godot and Unity ledgers gain a `textures_carried` line (loss → carry,
same data, honest framing), and the kernel documents the texture contract
(mojulo-godot 0.1.1, doc-only).

### Animals enter the World — and the whole skin pipeline follows (skin-over-mesh follow-through)

`kind:'animal'` now resolves to a traversable World form (the same
buildAnimal recipe the SVG study renders, meshed un-culled through the
shared figure mesher — feet at z=0, countershading intact, self-framing
camera). Because every downstream seam is generic, one registry row lights
up everything at once: `/world` orbiting, `export_model` (.glb / printable
.stl), the Godot/Unity packs, `manifest.skin` surface textures (the plan's
ORIGINAL verify — a marble-coated canine beside its plain control — now
renders), and the full atlas wrap loop (`skin_polygomer mode:'atlas'`
accepts animals). Animals stay illustration-concern studies; the
WORLD_KINDS row is their export door, same posture as figure. Gait (a rig
half) is future work — animals pose statically in worlds today.

Also: the atlas machine gate gains an ADVISORY `seam_continuity` report —
each island's cylinder-seam columns (the same world ring painted twice)
compared over covered texels, per-island mean ΔRGB against a threshold.
A report line, never a refusal: intentional material transitions flag too,
and the eyes gate owns the ship call.

### Skinned glTF export — the engine deforms the flesh (skin-over-mesh phase 4)

`export_model({ clips, skinned: true })` exports each rig figure as ONE
SkinnedMesh + a glTF `skins` entry instead of rigid part nodes: per-vertex
`JOINTS_0`/`WEIGHTS_0`, inverse-bind matrices `T(−restHead)`, joints
driven by the same packed clips — `J·IBM·v` IS the runtime's rigid-FK
formula, now evaluated per-vertex by the importing engine, so extreme
bends crease smoothly instead of opening part seams. Weights derive from
the rest bone SEGMENTS `bakeRigFigure` now packs (`tail` beside `head`):
each vertex blends its part's bone with adjacent bones sharing the crease
joint, inverse-square by capsule distance, top-2 normalized. Rigs packed
without tails (mobile-suit armor, older bakes) bind hard — rigid plates
SHOULD stay rigid. Export-only: mojulo's own runtime keeps rigid FK (the
renderer-ladder decision stands — the cost is paid where the gain lives),
and absent the flag the rigid export is byte-identical. The optional
live-preview SkinnedMesh branch (plan phase 5) is deferred per its own
severability note.

## [1.5.0] - 2026-08-26

### Roles pack — operator-owned delegation (opt-in), Phases 0–4

Off by default: with `MOJULO_ROLES` unset a fresh install is byte-identical in
behavior to 1.4.2. See `lib/mcp/roles-pack.plan.md` for the full design.

- **Doctrine (Phase 0).** The posture docs reframe single-user as
  single-operator: there is no user identity *by default*; the operator may
  enable the roles pack to cut scoped, revocable keys for their own delegates —
  operator-owned delegation, never multi-tenancy, and the maintainer still
  gates nothing (responsibility-model, CLAUDE.md golden rule,
  MCP-ARCHITECTURE §5, README, mcp-integration; TERMS.md unchanged).
- **Identity (Phase 1).** Additive `users` table + `mcp_tool_calls.user_id`;
  bearer keys minted as `mjr_…` tokens stored hash-only, resolved at the one
  identity mint (`buildContext` in `api/mcp/route.js` — god-key first,
  delegate keys only when enabled; revoked/expired keys are indistinguishable
  from wrong keys). Admin-only `mint_role_key` / `list_role_keys` /
  `revoke_role_key` tools (unlisted until Phase 2's grant enforcement lists
  them as a pack). Every tool call is attributed to its caller's key in
  telemetry, and the minting tool is capture-exempt so the plaintext token
  never persists even under `MOJULO_MCP_TELEMETRY_CAPTURE=full`.
- **Capability enforcement (Phase 2).** Authorization becomes the third axis
  on the capability bays `packs.js` declares (install / presentation /
  authorization), enforced with the install gate's advisory idiom at the same
  three chokepoints (`handleToolCall`, `invokeRegisteredTool`, the pack
  dispatcher) by one pure function (`lib/roles/enforce.js` — grants and flags
  ride the execution context, loaded once at the identity mint). A privileged
  key is a bundle of boundaries: pack grants (validated against the manifest
  at mint), the hard deny-list (secrets/env, daemon control, roles admin —
  never grantable), propose-vs-seal (`propose_only` keys forge plans but
  never `execute_plan` / `meta_context_commit` / deploy), and
  outward/lifecycle action flags (leave-the-host and start/stop-process
  actions, default off). `tools/list` shows a delegate only their granted
  bays; admins with roles enabled additionally see the roles-admin tools.
  Spine orientation stays available to every key.
- **The 1:1 inference rule (Phase 3).** Every unit of inference the substrate
  mediates is attributable to exactly one account's own credential;
  subscription credentials never enter the substrate. BYOK per account:
  `api_keys.owner_user_id` (NULL = the operator's house key, so every
  existing row is already correct) with scoping in the one key-resolution
  funnel (`ApiKeyRepository.findByUserId`) — a delegate resolves only their
  own keys, plus house keys under the admin-granted `house_keys` flag (team
  API-key sharing, the provider-anticipated pattern). Side door 1 closed:
  agent-task lanes — parked tasks carry their originating account, a puller
  claims only its own lane (the in-process Node fulfiller claims 'local'
  only), and starvation is loud: an unfulfilled delegate task expires naming
  its lane instead of drifting to whoever else is online. Side door 2
  closed: a credential-shape guard at the api_keys write path refuses
  OAuth/subscription-shaped credentials (`sk-ant-oat…`, JWTs) — shape, not
  policing. Local inference (Ollama) is exempt by design: the rule governs
  credentials, not compute.
- **Workshop-spaces (Phase 4).** A room divider, not a wall: each delegate
  key mints one workshop space, and the four tables where delegates create
  things (`deployments` / `documents` / `sketches` / `plans`) gain a nullable
  `workshop_space_id` (NULL = the operator's default space — every existing
  row already correct). Scope rides an AsyncLocalStorage entered at the one
  handler-invocation seam, so the repositories self-scope with no per-call-site
  threading: a delegate's creates stamp their space, reads/lists see only it,
  and cross-space refs read as not-found (404-not-403, the ancestor lesson).
  Dashboard sessions are per-user: session tokens now carry signed claims
  (`userId` / `role` / `epoch` / expiry); the Edge layer still verifies
  signature+expiry only, and revocation is checked lazily in the Node layer
  against `users.token_epoch` (revoking a key kills its sessions). A delegate
  logs in with their key name + bearer key; pre-claims session tokens fail
  closed (one re-login on upgrade). Deferred, explicitly: per-space secrets,
  scoped cross-cutting reads, space sharing, dashboard affordance filtering.

### Recipe book — an attachable catalog of view recipes and builders

- **`MOJULO_RECIPE_BOOK`** — point at a local clone of the new
  `mojulo-recipe-book` repo (chapters of cards + recipes + builders; fully
  text/JSON, no dependencies) and the control plane attaches it at boot.
  Strictly additive: unset ⇒ byte-for-byte the shipped behavior; nothing is
  ever fetched at runtime (the operator clones and pins the book themselves).
- **Two doors.** Door 1 (data): the book's cards merge into the view-vocab
  catalog, so `semantic_search`, `get_view_vocab`, and the embeddings reindex
  surface them like shipped cards — a recipe entry is pure params over an
  existing kind. Door 2 (code): `builder` entries are dynamically imported and
  registered as additional `create_view` kinds — enum, mint (generic
  `mintBookView` path), `/world` render dispatch, and `sketchRenderMode` all
  inherit them. Core wins every id/kind collision; malformed entries are
  skipped with warnings, never fatal; a book whose `requiresMojulo` is newer
  than the installed control plane loads nothing and says the clone is ahead.
- **Injected toolkit (Tier-2 builders).** Book builders stay import-free;
  builders that need mojulo's shared GLSL primitives receive them as
  `ctx.toolkit` on every `plan`/`assemble` call
  (`lib/graph/views/recipe-book/toolkit.js` — versioned, frozen, append-only;
  currently `effects: { buildVolumeFrag, SDF_GLSL }`).
- **The cookbook + `save_recipe`** — the operator's OWN recipe book, the
  write path: `save_recipe({ ref, id, when })` promotes a minted-and-tuned
  study object into a named catalog entry under `<data dir>/cookbook`
  (`MOJULO_COOKBOOK` to override) — card + params, ledgered with a LOCAL git
  commit (no remote, ever; sharing is the operator's act). Saved entries join
  the same catalog as shipped kinds: recall by meaning via `semantic_search`
  (the agent writes the card's `when` line from the conversation's intent;
  the index upserts on save), read via `get_view_vocab`, re-mint via
  `create_view`. Attachment is now an ordered book list — core > cookbook >
  upstream clone, first-wins with warnings. The cookbook is Door-1 only
  (recipes, pure data); builder entries there are refused by design.
- **Multi-family Door 1** — the book now carries recipes for MORE than views:
  a card's `entry` frontmatter is its routing key, so `create_beats` cards
  merge into the beats-vocab catalog, `mint_solid`/`edit_solid` into
  solid-vocab, `forge_motion`/`stitch_motion` into motion-vocab (each with the
  view merge's rules — core wins collisions, warn-and-skip on malformed or
  unroutable cards, per-catalog id scoping). `get_*_vocab`, `semantic_search`,
  and the reindex inherit book cards per family for free. Door-2 builder
  lanes remain view-only: a builder entry declaring another family's entry
  tool is skipped with a warning until that lane is built by demonstrated
  need. `save_recipe` gained the beats lane: a minted-and-tuned
  `create_beats` loop saves to the cookbook's `beats` chapter (card routed
  by `entry`, recalled via `get_beats_vocab` / `semantic_search({ kinds:
  ['beats_vocab'] })`, re-minted via `create_beats`) — the keep-loop for the
  family where tuned params are hardest to rediscover. Solids / motion join
  by the same lane pattern later.
- **Pilot kinds (ship in the book, not in core):** `foucault-pendulum`
  (Tier-0 — a Foucault pendulum over a compass floor: latitude-driven
  precession Ω = 15.04°/h × sin lat, seamless-loop rosette trail, optional
  finite-differenced v/a arrows) and `aurora` (Tier-2, first toolkit
  consumer — volume-raymarched auroral-oval curtains over a night Earth:
  green 557.7 nm / red 630.0 nm oxygen ladder, N₂ purple fringe, activity
  presets quiet/active/storm). Design + seams:
  `lib/graph/views/recipe-book.plan.md`.

### Hydro view — a multi-arc science explainer for hydroelectric power

- **`create_view` kind `hydro` (`manifest.kind: 'hydro-view'`)** — one explainer told in
  five arcs, each a scenario of the one kind: `dam` (hydrostatic P = ρgh on a gravity dam +
  the Torricelli outlet jet — fluid-view's water-pressure principle scaled up), `penstock`
  (PE → KE down the pipe, Bernoulli, equal-time tracers that visibly accelerate), `turbine`
  (the machine principle — a Pelton runner spun live by the windmill's `spin` mover, jet
  momentum → force → torque, u = v/2), `generator` (N/S pole drum sweeping copper stator
  coils, Faraday's ε = −dΦ/dt drawn as a gold EMF wave with a riding pulse, f = p·n/60),
  and `plant` (the whole chain in one world — water tracers ride reservoir → penstock →
  runner → tailrace while a power pulse rides the transmission wire). Knobs `head` / `flow`.
- **`physics/hydro.js`** — the pure hydro energy chain beside `physics/rocket.js`: one spec
  resolves Torricelli, the Pelton match (u = v/2, ω, τ), stage-efficiency powers
  (P = ηρgQH) and the synchronous-generator pole count, so every arc quotes the SAME
  numbers — visual scale compressed, readouts honest.

### Rocket mission view — a Falcon-9-class launch + return, integrated with real forces

- **`create_view` kind `rocket` (48th kind, `manifest.kind: 'rocket-view'`)** — a full
  booster mission flown live in the orbit-camera World: liftoff, pitch-kick into a true
  gravity turn, Max-Q throttle bucket, MECO on the propellant return-reserve, stage
  separation (stage 2 departs on its own pose mover), the 180° flip, RTLS boostback (cutoff
  solved by deterministic iteration so the booster lands back at the pad) or the ASDS
  downrange arc, the entry burn, tail-first descent, and the hoverslam landing burn —
  forced, as in reality, by minimum thrust exceeding the near-dry booster's weight.
  Scenarios `rtls` / `asds`; params `payload`, `vehicle` ('falcon9' or a custom spec),
  `guidance` overrides, `playback`, plus the standard trace/strobe/scale knobs. Base-shape
  vehicles in v1 (likeness + effects deferred; see rocket-view.plan.md).
- **`physics/rocket.js`** — the launch-vehicle primitive beside `physics/flight.js`, same
  doctrine: pure, deterministic, zero-import; US Standard Atmosphere 1976, altitude-
  compensated thrust + mass flow, Mach-dependent ascent C_d, inverse-square gravity. The
  honesty line is enforced and stated: real forces, SCRIPTED guidance (not closed-loop).
  The `falcon9` preset ships source-commented public constants pinned by a webcast-telemetry
  test band (Max-Q window, MECO state, apogee, soft touchdown with propellant remaining).
- **`measure_view` learns `rocket-view`** — full-mission SI read-back ({ t, pos, speed,
  accel, mass, thrust, drag, q, phase } + the event table) and stats recompute for the
  research-mode reviewer.
- **Mover channel**: a `rocket` mission HUD (phase, real clock, altitude, speed/Mach, the
  draining mass, thrust, TWR, q, propellant bar) joins the pose-mover readouts; emission
  fixtures re-pinned (movers / planets / kitchen-sink ×2).

### Airplane flight view — the fixed-wing sibling, flown by the airport's own plane

- **`create_view` kind `airplane` (49th kind, `manifest.kind: 'airplane-view'`)** — a
  complete fixed-wing flight on the FOUR real forces: takeoff roll, rotation at Vr, climb,
  a held cruise, the standard 3° descent, gear-and-flaps approach, a sink-proportional
  flare to a soft touchdown, and the braked rollout (`mission:'hop'`) — or `'glide'`: the
  engines quit at cruise and the ship rides best-L/D to a deadstick landing, the published
  ~15-17:1 narrowbody glide ratio made visible. The BODY is the airport primitive's own
  fixed-wing net (vehicleFaces: airliner / widebody / regional / bizjet), lowered to mesh
  faces and pitched along the true-scale path by a pose mover, with a flight-deck HUD
  (phase, altitude, airspeed, angle of attack, C_L, live L/D, thrust, flap/gear config).
- **`physics/airplane.js`** — the atmospheric sibling of physics/rocket.js (shares its US76
  atmosphere): C_L(α) linear-to-stall with flap-config shifts, parasite + induced drag with
  gear/speedbrake penalties, jet thrust lapse, ground roll with rolling/braking friction.
  Real forces, SCRIPTED pilot (rate-limited pitch laws, speed-hold throttle) — stated.
  The `a320` preset ships public A320-class constants pinned by a performance test band
  (rotation speed, ground roll, held cruise L≈W, 3° approach, sub-2.5 m/s touchdown sink,
  the glide ratio, and the deadstick's honestly-steeper-than-3° path).
- **`measure_view` learns `airplane-view`** — SI read-back ({ t, pos, speed, accel, alpha,
  cl, lift, drag, thrust, phase } + the event table) and stats recompute.

## [1.4.2] - 2026-08-24

### Language picker surfaced on fresh install + game-copy reframe

Copy-only release; no runtime, schema, or API changes.

- **Fresh installs learn the dashboard speaks their language.** The dashboard
  ships fully translated in ~two dozen languages (including RTL scripts —
  Arabic, Farsi, Urdu), but a fresh install always lands in English: the locale
  is a per-browser `NEXT_LOCALE` cookie with no `Accept-Language` sniffing, so
  nothing ever told a non-English operator the picker exists. Now `mojulo init`'s
  summary and `mojulo-ui`'s startup output both point at **Settings → Language**,
  and the READMEs carry the same note (choice remembered per browser).
- **Game completability copy reframed as level audits.** Mint behavior is
  unchanged (every level still passes a contract dry-run, plus a `forge_motion`
  traversal audit via `audits` / `auto_audit:true`, with `allow_unaudited:true`
  recording a skip per level) — but the surface copy no longer leads with "a
  level is refused until proven completable." The `forward_context` glossaries,
  studio opener + routing index, game/pixelizer tool descriptions, packs,
  routing cards, server self-description, and READMEs now frame it as level
  audits recorded at mint.
- **README lead sharpened**: the two wings are now named as what they make —
  a chatbot factory + services hub (core) and a 3D & game studio (creative).

## [1.4.1] - 2026-08-24

### Connected-services drift audit + refresher (version control for one-time-created services)

Connected services (Skills / mcp-orbit compositions sealed once via
`meta_context_commit`) bind to installed MCP tools by name and then rot silently
as vendors rename or remove tools — nothing re-checks a sealed binding until it
fails. Two new surfaces close that loop, split by shape: detection is a
deterministic join (a tool), remediation is a judgment call (a catalyst).

- **`meta_context_analyze` (Ring 6, read-only)** — the deferred "stale-binding
  audit lens." One lens ships: `stale-bindings` cross-references every sealed
  `binds` edge against the current declared inventory (`meta_mcp_inventory`) and
  the researched capability layer (`meta_mcp_capabilities`), classifying each
  binding `missing` (bound tool gone — the service will fail at runtime),
  `stale-capability` (tool present but vendor knowledge aged past the freshness
  window), `no-capability`, `unknown` (inventory never declared — never a false
  `missing`), or `ok`. Returns findings ranked most-actionable-first with
  per-finding re-research recommendations, an `inventory` freshness block, and a
  `summary` (severity counts + `providersToRefresh`). Scope `{kind:'fleet'}` or
  `{kind:'artifact',ref}`. No LLM — the audit is a graph join, not a judgment.
- **`refresh-connected-services` catalyst** — the remediation half. Materializes
  a scheduled artifact that re-declares inventory, runs the audit, deltas against
  the last run (anti alert-fatigue), optionally fans out the `research-mcp-vendor`
  catalyst over drifted providers (`refreshPolicy: report-only` default, writes
  nothing), and produces a dated report + operator action plan. Reports and
  proposes — never auto-mutates a binding (the contextmap stays append-only,
  cleanup operator-driven) and never spams the audit trail (its only writes are
  capability-row supersessions).

`meta_context_analyze` folds into `pack_connected_services`, so it stays off the
default `tools/list` payload (behind the pack dispatcher) with its full detail in
the forward_context deliberation drawer. Curation/patch write-side
(`meta_context_propose_curation`) stays deferred until real hand-edited-artifact
drift surfaces.

## [1.4.0] - 2026-08-22

### Install-gated capability packs (kernel + ops / creative)

Mojulo now installs as a KERNEL + two install packs — ops (`wing: office`:
bots / connected services / apps, pure code) and creative (`wing: studio`:
the render / media / games stack). "Full install" is their union; ops-only and
creative-only are both valid. Install state is PHYSICAL — `installedWings()`
derives each wing from what's on disk (`WING_INSTALL`: office is
`alwaysInstalled`, studio is present iff its optional deps resolve), with
`MOJULO_PACKS` as an explicit override and a memoized, import-free probe; a
future install wing is one `WING_INSTALL` entry. The creative render deps
(`three` / `node-web-audio-api` / `opentype.js`, ~82 MB) move to
`optionalDependencies` so `npm install --omit=optional` sheds them and
`next build` still passes (a request-string `externals` matcher in
`next.config.mjs` tolerates their absence); the ~535 MB Chrome-for-Testing
fetch is gated on the creative wing. `sharp` stays (transitive via the kernel
embedder). `mojulo install creative` (`scripts/mcp-install.mjs`) grows a lean
install into the full workshop. Uninstalled tools neither list nor run — the
refusal is a wing-level terminal advisory pointing at `mojulo install creative`
(execution integrity, not information hiding), enforced at every tool
chokepoint and kept orthogonal by the `pack-boundary` static guard (Checks
A–E). The published bot image is unaffected (pack-agnostic). See
`docs/install-capabilities.md`.

**Upgrading from 1.2.x:** no action needed and nothing is lost. npm installs
`optionalDependencies` by default, so a normal update (`npm i mojulo@latest`,
`npx mojulo@latest`, `npm update`) keeps the full workshop — physical detection
sees the creative deps on disk and every tool behaves exactly as before, plus
the new `mint_diagram`. Going lean is strictly opt-in: only an install run with
`--omit=optional` (or an npm config already carrying `omit=optional`) sheds the
creative pack, and even then the loss self-describes — a creative tool answers
with a terminal advisory to run `mojulo install creative`, which restores it.
No schema/data migration; existing bots, sketches, and worlds are untouched.

### Kernel diagram maker

A creative-absent mojulo can now MINT a diagram, not just render one:
`mint_diagram` (SPINE, always-on) validates + persists a diagram from the pure
kernel `lib/diagram-core.js` (extracted verbatim from `sketch-manifest`, which
now delegates to it) and returns a `/sketches/<ref>` URL. `create_sketch`
(creative) is the superset; both share `diagram-core`, so they can't drift (a
binding test asserts identical rendered SVG + byte-identical manifest;
pack-boundary Check E keeps the kernel diagram surface off `lib/graph`).
Coverage is flowcharts + common charts (bar / donut / KPI / line) plus the
standard diagram patterns — sequence (lifelines + activation bars + self-
messages), swimlane lanes, ERD entities, containment/C4 boundaries, Gantt
schedules on a numeric scale, and richer edge notation (arrowhead styles,
multiplicities, self-loops) — all validated in `lib/diagram-core.js` and
covered by the `diagram-core.*` suites. See
`lib/mcp/diagram-patterns-spike.plan.md`.

### Consolidated tool packs (opt-in, `MOJULO_TOOL_PACKS=on`)

The connect-time `tools/list` surface can now ship as a 10-tool SPINE plus 20
stateless PACK dispatchers — 28,669 bytes measured, from ~250KB flat (89%
cut). A pack called bare returns its orientation body (studio packs serve the
FORM_TOOLSETS prose — one source with `get_creative_toolset`, which folds to
unlisted in packs mode) plus a member manual with real schemas; called with
`{ tool, args }` it dispatches to the member server-side through the
single-writer queue with the MEMBER's own concurrency flag (long-polls
bypass, writers stay FIFO). No session state, no `tools/list_changed` — works
on hosts that never re-list (the P0 spike finding). Flat mode (default) is
byte-identical to the previous surface. Partition (every listed tool: exactly
one home pack, spine, or folded), pack-description 700-char ceiling, and a
35KB packs-mode payload pin are all test-gated; the routing eval gains a
DERIVED pack-level layer (fixtures lift entry-tool → home-pack via the
partition; multi-vector max-pool proxy over recognizer anchors; collision
rows hold rank-0 + margin). See `lib/mcp/packs.js`.

### CLI subcommands on the `mojulo` bin

The `mojulo` bin now doubles as a command-line front door over the same
registry: `npx mojulo tools|packs|help|call|pack_* …` (bare `npx mojulo`
stays the stdio MCP server, byte-identical; the subcommand names and the
`pack_` prefix become reserved words on the bin). Invocation is in-process —
no HTTP, no bearer token, no running dashboard — dispatching through the
same `tools/call` path with `mcpSessionId: 'cli'`, so serialization,
telemetry, masking, and deprecated-alias resolution match the MCP surface.
Listings and help are generated from the registry and pack partition (the
CLI authors no prose). Arguments ride `--json` (inline / `@file` / stdin) or
schema-derived per-property flags (flags win); `--timeout` (exit 124),
`--quiet`, TTY-aware column output, exit codes 0/1/2. `mojulo <pack_id>`
unveils a pack; `mojulo <pack_id> <tool>` dispatches through the pack
dispatcher with server-side membership validation. Serves shell-driven
agents, no-AI automation (cron/CI), and human spot checks. See
`scripts/mcp-cli.mjs`.

## [1.2.2] — 2026-08-18

### Windows dashboard boots again (re-land)

The 1.2.1 rewrite of `scripts/mcp-ui.mjs` (module-dir anchor work) started
from a copy predating e6e42e5 and dropped its two `pathToFileURL` wraps,
regressing the published dashboard to fully unbootable on Windows: `await
import(...)` was handed a raw `C:\...` path, which the ESM loader parses as
URL protocol `c:` and rejects with `ERR_UNSUPPORTED_ESM_URL_SCHEME` before
the server starts. POSIX was unaffected (a bare absolute path happens to
parse as a URL), which is why it slipped through. Both wraps are re-landed —
the fatal standalone-server import and the non-fatal embedder preload —
field-verified on Windows 11 / Node 24.19.0 against the published 1.2.1
layout: dashboard boots, the module-dir anchor resolves the formerly baked
paths, and DB routes run on the per-platform native modules.

### Install slimming: tarball 249MB → 115MB unpacked, host install −~430MB

Two structural cuts to what a fresh `npx mojulo` pays, with no behavior
change (full measurements, audits, and the verification record in
`install-splitting.plan.md`):

- **The double-shipped natives are gone from the tarball.**
  `onnxruntime-node` (90MB) and `node-web-audio-api` (42MB) were shipped
  inside the standalone dashboard bundle's private `node_modules` AND
  installed again at the host root as runtime dependencies. They now join
  `better-sqlite3` / `@img` in the standalone `files` excludes and resolve
  via the same host walk-up — the mechanism the 1.2.1 Windows field report
  confirmed works cross-platform with no hand-copying. Tarball: 249MB →
  115.4MB unpacked (25.7MB download).
- **`next` + `next-intl` move to `devDependencies` (host install −~287MB).**
  A published install never executes host `next`: `mojulo-ui` boots the
  prebuilt standalone `server.js`, which carries its own traced Next subset,
  and the only `next` import outside `app/` is the app-route-only
  `lib/auth/gate.js`. `next-intl` is forced along — it peers on `next`, and
  npm auto-installs missing peers, which would silently pull `next` back
  (a sweep found no other runtime dep peering on `next`). `sharp` stays
  host-resolvable through the `@huggingface/transformers` edge, so the
  1.2.1 `@img` platform-binary fix is unaffected. `react` / `react-dom`
  stay: `sketch-svg` and `motion/deck` render JSX at runtime.

Verified against a real `npm pack` + clean tarball install: natives load
(not just resolve) from the standalone context via walk-up, the stdio MCP
server answers `initialize` + `tools/list` (168 tools), and the standalone
dashboard serves `/` and DB-backed API routes. The remaining 130MB of
`onnxruntime-web` (transitive, dead weight on a Node host) is documented as
not-fixable-from-here in the plan file: npm honors `overrides` only in the
root package.json, which a published package never is.

## [1.2.1] — 2026-08-18

### Published dashboard works off the build machine (Windows field report)

A 1.2.0 field report from Windows 11 exposed that the packaged `mojulo-ui`
standalone bundle only ever worked on the machine that built it — every npm
install, every platform:

- **Bundler-baked absolute paths:** `next build --webpack` inlines
  `import.meta.url` as a literal build-machine string, so ~40 lib modules that
  located sibling resources (vocab cards, catalysts, adapters, outcome
  templates, vendored fonts/three, the embedder cache fallback) resolved to
  `file:///Users/<builder>/…` inside the standalone bundle — nonexistent paths
  on macOS/Linux installs, an `ERR_INVALID_FILE_URL_PATH` module-scope throw
  (→ route 500s) on Windows. New `lib/module-dir.js` resolves resource dirs
  env-first from `MOJULO_CONTROL_DIR` (the installed package root, which ships
  the complete `lib/` tree), exported by all four bins; the `import.meta.url`
  fallback stays for repo-dev and is only parsed when the env var is absent.
  Same treatment for the `process.cwd()`-anchored readers (composer protocols,
  pixelizer game shells) whose dynamically-read siblings file tracing can't
  see. `public/vendor/**` now ships at the package root so the three.js
  vendor modes resolve there too.
- **Build-platform-only native binaries:** the standalone `node_modules`
  shipped `better-sqlite3` and sharp's `@img/*` as darwin-arm64 only
  (`better_sqlite3.node is not a valid Win32 application` from every
  DB-touching route). Both are now excluded from the tarball; Node module
  resolution walks up from `.next/standalone/` to the host install's
  `node_modules`, where npm already put the right platform build.
  (`onnxruntime-node` / `node-web-audio-api` ship all platforms in-package
  and are untouched.)
- **`city` vocab card documented knobs the adapter never read:** the card
  listed `time` / `anchor` / `landmark` / `civicAreas` as flat override keys,
  but `cityThemeAdapter` reads theme slots (`context.time`, `asset.anchor`,
  `asset.monument`, `asset.civic`) — flat keys silently produced a flat-lit
  render. The card now documents the real slot paths (with an example), and
  `region` / `viewBox` pass through the adapter top-level like `fog` / `audio`
  (they had no reachable path since `create_fractal_city` retired).

### Routing telemetry + retrieval hardening (routing context weaving)

The tool-routing path — `forward_context` rows, routing cards behind
`semantic_search({kinds:['routing']})`, vocab drawers — gets its measurement
floor and a hardened retrieval hop (threads A/B/C/E of the 0818
routing-context-weaving plan; thread D, multilingual intent surfaces, still
open):

- **First-hop attribution, no schema change:** `forward_context` emits a
  mode-tagged telemetry signal (office vs studio reads become distinguishable),
  and the orientation cut (`get_tool_telemetry({orientation:true})`) now
  derives a first-hop histogram — per routing read, the next non-orientation
  tool in the same session — plus routing-card coverage: cards whose entry
  tool saw zero calls in the window render as "never routed". This is the
  instrument for orientation-diet's parked question ("which routing rows never
  route?"); pruning still waits on weeks of real-session data.
- **Hybrid margin guard on routing-card retrieval:** routing-kind search
  re-ranks with a small lexical tiebreaker (`cosine + 0.03 ×` query-term
  overlap against the card's When line; case/diacritic folding, whole-phrase
  substring fallback for non-segmenting scripts) — anchor quotes now do double
  duty as retrieval signal. The collision fixture gates rank-0 AND
  `top1 − top2 ≥ 0.01`, printing margins every run; the thinnest pre-guard
  margin (~0.004) widened ~5×.
- **Weak retrieval is actionable in-band:** zero-result or weak-scoring
  searches append a `hint` (routing-specific: rephrase with the artifact's
  FORM or open `forward_context({mode:'studio'})`; generic otherwise) behind
  the shared `WEAK_SEARCH_TOP_SCORE` constant; query-embed failure returns
  `{ results: [], degraded: true, hint }` instead of a bare `[]`, and the
  telemetry signal records `degraded: true` — the agent can now tell "nothing
  exists" from "index degraded" from "rephrase".
- **Drawer-miss coverage completed:** every `get_*_vocab` /
  `get_creative_toolset` miss is countable by the orientation cut (`unknown
  card` / `unknown form` phrasing + hit/index signals), with a registry sweep
  test pinning the convention for every future drawer.

A broad routing simulation (178 authored multilingual paraphrases through the
real embedder) validated the top-3 entry contract at 91% — including zh/es/ja —
and its findings (the dead `WEAK_SEARCH_TOP_SCORE` threshold, the
`diagram-chart` card weakness, thin non-English margins) are recorded in the
plan as the next round of work.

### Mechanics view: real-air `flight` scenario (the physics/flight kernel)

The spin-aware ballistic primitive is promoted from `vehicles/ball-flight.js`
to `lib/graph/physics/flight.js` — gravity, drag with a speed-dependent C_d
(the drag crisis), and Magnus lift with a spin-ratio-dependent C_l, constants
from the soccer-ball aerodynamics literature (Goff & Carré; Asai). The
projectile registry is closed vocabulary (the validated FIFA soccer preset),
with a custom-sphere spec (`{ mass | density, radius | diameter |
circumference, aero? }`) as the operator's own explicit dial; pure and
deterministic (launch spec in → identical trajectory anywhere), zero imports
so page emitters can inline the very source the server tests validate.

`mechanics_view` gains the `flight` scenario on top of it: a ball in real air
with `curl` (sidespin) and `spin` (back/topspin) dials so carry, dip and curl
are physically faithful; `compare:'air'` races the identical launch against
its vacuum twin from the same spot, and `stage:'goal'` dresses a pitch with a
regulation goal at `goalDist` so the bend reads against something. The
`mechanics` vocab card carries the new framing ("a free kick that curls /
banana shot / knuckle-drop"). The interim `ball-kick-emit.js` spike is
superseded and removed.

## [1.2.0] — 2026-08-17

Two threads: games gain a provenance surface (an about page plus an
operator-owned attribution default), and the npm package's stdio MCP server
now actually boots on a clean install — the fix that came out of the first
Windows install attempt.

### Games: about page + attribution (operator-owned)

- **`kind:'about'` menu entry** — the game's provenance page, content carried
  on the entry itself (body paragraphs with inline anchors, link cards, footer
  lines), rendered by the shell as a static screen. A root-level about lives on
  the title screen (Start / About); nested inside a `kind:'menu'` group it
  renders as a normal menu row.
- **Attribution default:** a game with a menu but no declared about entry gets
  a generated default about page at resolve time — provenance + links back to
  mojulo, identical in the served copy and the export, injected at resolve so
  the stored recipe stays clean. A courtesy credit, not a lock: declare your
  own about entry to replace it wholesale, or set `menu.attribution: false` to
  remove it.
- **`music.about`** — the score's about-screen loop (falls back to the menu
  track when absent); `export_game` bundles its WAV render alongside
  menu/battle.

### npm package: stdio MCP server boots on a clean install

The published package could not start its stdio MCP server:
`ensureToolsRegistered()` reaches `@/components/graph/CreationMap` (a JSX
component) through `sketch-svg.js`, and that one import path was broken three
independent ways — the process died with `ERR_MODULE_NOT_FOUND` before writing
a single JSON-RPC frame.

- **`components/graph/CreationMap.jsx` now ships** — it was missing from the
  npm `files` list. It is the only component lib imports, and it pulls only
  `lib/graph/scene/signage-chrome`, so nothing else in the UI tree rides along.
- **The stdio loader resolves `.jsx` and extensionless relative imports**
  (`./files`, `./exports-dir`, `./meta-context`, `./motion-comic-manifest`) —
  specifiers Next resolves but Node rejects.
- **A loader `load` hook compiles `.jsx` via `@swc/core`**, loaded lazily so
  the native addon costs nothing on boots that never touch a `.jsx` file.
  `@swc/core` is now a direct dependency (it was never actually installed
  transitively — it sits in next's devDependencies); lockfile updated to match.
- **Node floor corrected to `>=22.12`:** `lib/` ships ESM in `.js` files with
  no `"type": "module"`, which only loads on runtimes where module-syntax
  detection is on by default — on Node 20/21 the first lib import fails well
  before the old `<20` guard could matter. Engines and the runtime check both
  move to 22.12.

## [1.1.1] — 2026-08-16

A first-contact release, shaped by a six-persona post-install simulation (0816
persona sims): a first-run install hardening pass — everything between "I have
an MCP host" and "mojulo is wired everywhere and I'm looking at the dashboard" —
plus the other half of first contact: the substrate can now answer questions
about *itself* (posture, privacy, cost, uninstall) through the same
ask-the-agent channel the install docs point at. One engine addition rides
along: boost inertia for the mobile-suit pack.

### Substrate self-description — meta-questions get in-substrate answers

The persona sims showed a clean split: agents routed *build* asks perfectly but
had no in-substrate source for questions about mojulo itself — "does it phone
home?" retrieved a declared vendor tool (`gmail.untrash_thread`), "how do I
uninstall?" had no answer anywhere on the tool surface.

- **`get_substrate` now ends with the substrate facts:** twelve falsifiable
  architecture invariants (localhost-only process, one SQLite under
  `$MOJULO_HOME`, bot data stays in the bot's own DB, no telemetry / no
  phone-home, the one LLM flow that leaves the machine, AES-256-GCM key storage,
  Apache-2.0 / no subscription, plain-file exports, tamper-evident hash chain,
  full uninstall steps, single-user tenancy, and the source-repo pointer read at
  the installed tag). Facts, not an FAQ — the agent *derives* answers, including
  to questions nobody anticipated, and each fact names its own check
  (`list_daemons`, `verify_chain`, `version`).
- **Three routes lead there,** because agents take different paths:
  meta-question trigger phrases in `get_substrate`'s tools/list description, the
  `forward_context` drawer directory (both wings), and a new `substrate-self`
  routing card in the semantic index — "phone home" and "uninstall" now surface
  the referral at rank 0 instead of vendor-tool noise.
- **Pinned:** new `context.test.js` assertions on the facts body, four
  meta-question families in the routing eval's office fixture, and the
  description-budget re-pin (`get_substrate` 914 → 1023 chars; tools/list grows
  109 bytes, everything else stays behind the drawer).

### Boost inertia — the mobile-suit dash ends in a skid

Ground dashes used to snap to walk speed the frame F was released. An opt-in
`boostInertia` (seconds) on the rule leaves the suit *sliding* along the last
thrust vector, full boost speed decaying linearly to zero — with the transposed
brake pose (lean against the momentum, thrusters vectored the other way).
Deterministic pure-dt math; walls still stop it; a fresh boost swallows the
slide, and a melee swing / dodge / tackle / stagger kills it on the spot (the
strike is always planted). Ground mode only — space keeps its own Newtonian
coasting undecorated. Absent the knob: byte-identical runtime behavior. The
maneuver source is inlined into every emitted world, so all 10
`emit-channels` characterization hashes were re-pinned.

### `init` fixes — first-run correctness

- **Claude Code is now wired at user scope.** The previous `init` used the CLI's
  default `local` scope, registering mojulo only for the directory `init` happened
  to run from. Now: `claude mcp add --scope user mojulo -- npx -y mojulo` (also
  the current CLI syntax — the old `--command "..."` form predated it).
- **Claude Desktop detection covers fresh installs.** A fresh Desktop has no
  `claude_desktop_config.json` until developer settings are opened — config-file
  detection missed exactly the first-timers `init` exists for. Detection now falls
  back to the app's install footprint (`/Applications/Claude.app`,
  `%LOCALAPPDATA%\AnthropicClaude`); the writer creates the config when missing.
- **Absolute `npx` for Desktop.** Desktop spawns MCP servers from the GUI
  environment, whose PATH often lacks nvm/homebrew node (`spawn npx ENOENT`).
  The writer now resolves an absolute npx — first hit on the installer's PATH
  (stable symlinks win), then the running node's sibling.
- **Windows:** host probes and `claude` shell-outs route through the shell so the
  `.cmd` shims resolve.
- **Dashboard port honesty:** prefer 3001 (what every doc says), fall back to the
  next free port, print the real URL in the final banner; the UI child's stderr
  stays attached so a failed boot is visible.

### `init` repairs stale entries

Re-running `npx mojulo init` now heals installs wired by older inits instead of
skipping them: a project-local Claude Code registration is re-added at user scope,
and a Desktop entry carrying bare `npx` (or an absolute npx path that no longer
exists) is rewritten to the current form — backup + atomic write as always.
Entries the operator customized (env, extra keys, different args) are never
touched. Codex detection now also recognizes hand-written config variants
(inline table, dotted key, `[mcp_servers]` section key) so none of them gets a
duplicate appended.

### Node.js floor made explicit

- The `mojulo` bin checks for Node 20+ **before** loading anything
  version-sensitive and exits with a plain-language pointer (nodejs.org, or ask
  your coding agent to install it) instead of the previous cryptic
  missing-export crash on old Nodes.
- READMEs state the prerequisite up front — Node 20+, installed manually or by
  asking your agent — and document a global-install alternative
  (`npm install -g mojulo && mojulo init`) for slow connections, since a global
  bin makes `npx -y mojulo` resolve locally without a registry round-trip.

### Tests

- The init config writers (Codex, Claude Desktop) are now covered by
  `scripts/mcp-init.test.js` — the real bin driven against a temp `HOME`:
  merge-beside-existing, backup-once, idempotent re-run, all three hand-written
  Codex forms, the bare-npx / dead-path repairs, customized-entry hands-off,
  invalid-JSON fallback, and `--print` as a true dry run.

## [1.1.0] — 2026-08-13

A creative-surface and engine release: one new creative FORM (the motion comic), one new
walkable world kind (the dungeon), a key-free authoring path for the polygonizer, the
match-mode layer promoted from game content into the tracked engine, a baked
coverage-shading pass for rigged units — and the glTF interchange arc: animated GLB
export, a bind-back door for externally refined meshes, semantic level export, and
Blender as an optional local worker that bakes Cycles GI into a world's (or a walking
figure's) own vertex colours at zero runtime cost. Additive throughout — absent the new
opt-ins, every existing recipe renders byte-identical. Under the hood, a tool-list
token-load pass consolidates the figure/solid family behind one door and extends the
routing-card two-step to the office paradigms — the callable surface shrinks while the
substrate does not.

### Motion comic — a new creative FORM

`create_sketch { kind: 'motion-comic' }` mints the click-gated comic presentation — "the
powerpoint of comics": a fixed BOX + matte, no pages, bound by PANELS. Each scene frames one
panel crop (`{pageRef, panel}`) as the showcase and its events piecemeal balloons and
elements out one click at a time. The delta vocabulary: `show` / `say` / `swap` (direct
single-panel action — same frame, new art, cut by default; the reader interpolates) /
`move` (the camera cheat: shrink = depth, grow = approach) / `letter` (SFX lettering as
mojulo-drawn z-index overlays — the image worker never letters) / `focus` / `hold` /
`hide` / `clear`; balloon `tail`s foreshadow. The grammar is Turbomedia (Balak / Marvel
Infinite Comics lineage); the keyframe cheat shelf ships as the `motion-comic-tricks`
vocab card. Scene layouts: `full-spread` / `splash` / `two-panel` (slot-placed,
aspect-fitted at mint). Two lettering modes over the same says: drawn `bubbles` or
movie-style `subtitles`. State is a pure fold — insert/reorder events freely. Plays at
`/api/sketches/<ref>/play` (four-move navigation, deep-linkable); `?download=1` exports
ONE self-contained HTML file (player + art inlined, opens from disk). The form costs a
vocab card + routing card + `FORM_TOOLSETS` entry — no new tool registrations.

### Dungeon — a new `compose_world` base

The fantasy-interior primitive graduates into the world registry: `base: 'dungeon'` mints
a torch-lit walkable INTERIOR from a tiny `{ chambers, tunnels }` graph recipe — organic
round chambers at elevation joined by sloping tube/corridor tunnels, traced-fire lit,
deliberately the opposite of the flat generative house/room generators (the one invariant:
there is a ceiling and a floor, but no surface is assumed flat). Structural validity (a
tunnel to an unknown chamber, an unknown material) fails at mint; the movement-flow check
is advisory, never gated. Walkable `/world` + `.glb` export follow free from
`WORLD_KINDS` membership; the parameter manual is the `dungeon` view-vocab card.

### Key-free polygonizer authoring

`get_polygonizer_packet` / `submit_polygonizer_manifest` — the key-free twin of
`create_polygonized_sketch`, where the calling agent IS the generative model. The packet
hands the agent the same system/user prompts + JSON schema the keyed path would send a
provider; the submit runs the model-independent tail (validate → deterministic repairs →
lower → mint). A failed submit returns `repairPrompt` — the server-side repair loop
becomes conversational. Plan-then-skin passes the planning manifest back into submit; the
solved scaffold is recomputed server-side, never trusted from the agent. The polygonizer
analogue of `get_skin_packet`: natural-language → sketch now needs no provider key at all.

### Match modes in the engine

The game-mode layer joins the tracked engine as `worlds/match-modes.js`: five suit-agnostic
mode builders (solo / practice / ffa / team / watch) + geometry/seat/match helpers +
`lightenMatchLevel`, with `prelude`/`nameOf` hooks for content packs. The `compose_world`
controllable base now takes `match: { mode, killTarget?, rivals?, teamNames?, … }` and
`mapRef` — ANY stored controllable world with pilotable entities mints as a match level in
light form, promotable via `create_game`. `mapRef` terrain inheritance
(`worlds/map-ref.js`: spread-merge, level wins, `null` tombstones) resolves at the top of
`resolveWorldScene`, so `/world`, `.glb` export, `export_game`, and the audit runner all
inherit through one seam — a level row stores the mode's own output (~46KB), not a terrain
clone. Game shells gain the `roster` setup style (named-member check-picks, spectate-aware:
all-AI setups drop the difficulty card and despawn unpicked fighters).

### Tutorial mode — the scripted teaching layer

The controllable engine gains the TUTORIAL DIRECTOR (`worlds/controllable/tutorial.js`): an
opt-in `tutorial: { steps }` manifest channel — ordered prompt + goal steps the director
advances by edge-detecting live sim state each frame (no emissions added to the combat
systems; a world without steps is byte-identical). Facts: move / ascend / descend (vertical
travel — the space thrust lessons) / boost / boost-steer /
jump / hit / clip-empty / switch / swing (directional) / combo / tackle / dodge / stagger /
destroy — the maneuver facts edge-read the engine commit counters
(`e.tackleCount` / `e.dodgeCount`), so the director stays pack-agnostic; a destroy `of`
may name an id SET (all must fall). The
director is the level terminal (no match layer): the objective HUD card renders the active
prompt top-center, completion (or losing the suit) emits the one outcome envelope. Steps'
entry actions: `activate` (wake dormant seats), `heal` (restore a body to its minted
hull + shield — the between-phases repair), `set.aiDifficulty` (retune mid-level); an
`optional: true` step is a BONUS phase — the clear is already earned when it enters, so
the pilot going down there ends the level in success, not fail. Two
sibling affordances land with it: the `patrol` rule (a passive waypoint walker — hittable,
staggerable, never fires) and DORMANT seats (`dormant: true` — minted into the roster but
absent from play until a step's `activate` wakes them with the sky drop-in; the
deterministic mid-level reinforcement). `aiDifficulty` on a manifest seeds the AI tier at
mint. A tutorial track's levels store light like every matrix cell. (The optional
step-`gate` mechanism — a level locked until a prior one clears — was exercised end-to-end
then retired by operator call; `evalGate` and the shell's lock rendering remain available.)

### `export_game` — shared asset banks

Exported level pages were ~98% inlined rigged-figure bank, repeated identically per page —
past static-host file limits at roster scale. The export now hoists the figure bank and
big geometry literals (`GROUPS`/`REPEATS`/`TEXTURES`) into content-hashed, deduped
`assets/figures/` and `assets/geometry/` files with a top-level-await fetch shim; mode
variants of one map ship their terrain once, and a referenced map recipe ships beside a
light level's recipe so `recipe/` stays re-mintable. Trade-off, recorded in the tool
description: exported folders now need an HTTP server — `file://` no longer loads levels.
(Real-world validation: a 35-level export dropped from ~5GB to under 1GB, no file over
20MB, and published clean to GitHub Pages.)

### Level-load performance

A roster-scale controllable level went from a ~40–55s server bake + a 148.5MB page on
EVERY play to **~0.6–1.5s warm bakes, a 47.7MB page (−68%), and ~10ms 304 replays**.
Five stacked fixes, all engine-general:

- **Rig-bake LRU** (`worlds/unit-rig.js`): `bakeUnitRig` is now a keyed cache
  (manifest + opts hash; function-bearing overrides bypass; hits return
  shallow-protected copies) — levels sharing a roster re-bake nothing.
- **Indexed + quantized rig parts** (`figures/rig-bake.js`): positions on a per-part
  uint16 grid (worst-case error 1.3e-4 world units, verified numerically), deduped
  vertices, uint16/uint32 triangle indices, spec as u8 pairs. Self-describing per part —
  pages without unit rigs stay byte-identical.
- **Figure-buffer pool**: the controllable channel dedupes repeated packed buffers across
  the figure bank into a `__FIGPOOL` + in-page rehydration (livery variants share
  geometry); `export_game` hoists the pool into the content-hashed figure bank.
- **`/world` browser-cache tier**: the route sends an `ETag` (= the server world-cache
  key) under `no-cache`; a matching `If-None-Match` 304s before any resolve work, even
  across server restarts. `?nocache=1` stays `no-store`; the world cache budget is
  env-tunable (`MOJULO_WORLD_CACHE_MB`).
- **Level pre-warm**: game shells warm level worlds after the suit previews, using the
  exact launch URL so the cache key + ETag match the play request.

Also in the engine from the same tuning pass: per-weapon `chargedRangeMul` /
`chargedDamage` knobs (combat-ranged), the AI tackle-guard facing cone (ms-ai), opt-in
`manifest.jets` thruster families (unit-rig), and AI maneuver playbacks now running the
same blocking resolution as pilot dashes.

### Baked coverage shading (visual layer)

- `bakeSkyShadow` (`effects/ao-bake.js`) — the directional sibling of the AO bake: per-corner
  overhead rays (a small cone fan tilted toward the face's open side) darken whatever sits
  under solid geometry, with distance falloff, multiplying into existing `vao`. Pure
  deterministic arithmetic; LRU-cached like the AO bake (cache sized up 16 → 32).
- `bakeUnitRig` opt-in `ao:` — crevice AO × sky shadow over the rest-pose body, folded into
  per-part vertex colours: armor that covers a section now shades it (the bicep under a
  pauldron), pose-invariant at zero runtime cost. Absent ⇒ byte-identical bake.
- `shadows.cast.noCastGroups` — a declared roof/ceiling group receives shadows but never
  casts, so enclosed interiors no longer blanket their floors; emitted only when declared.
- `materials/face-material-roles.js` — a pure manifest→manifest selector that stamps
  procedural-material presets onto a finished map's faces by height band or baked fill
  colour, preset-validated at mint.

### glTF interchange — standard formats at the edge (I1–I4)

The `interchange.plan.md` sequence landed whole: recipes stay sovereign at home; the
edge speaks standard glTF both directions.

- **Animated export** (`scene/scene-gltf.js`): `export_model` takes opt-in `clips`
  (names or `'_all'`) — every packed rig figure exports as bone-local mesh nodes with
  one glTF animation per clip (FK→TRS, LINEAR samplers, 1 s/cycle, K+1 wrap key so
  loops don't hitch, hemisphere continuity enforced per bone). Absent ⇒ byte-identical
  (pinned).
- **Three new exportable kinds** (`worlds/world-kinds.js`): `figure`
  (`figures/figure-world.js` — static posed mesh + the packed FK rig with a clip from
  the stored motion vocabulary; the rig declares `embodies:'body'` so the clips path
  drops the static ghost), `carved-solid` (`effects/carved-solid-world.js` — the SVG
  frame's geometry/shading kernels replicated so the GLB matches the still's palette;
  caps via the existing ear-clipper), and `css3d-turntable` (an assembler beside
  `planSolidTurntable`, CSS→z-up). All three also serve `/world` live orbit.
- **The bind-back door** (`bind_mesh_render`, `scene/mesh-store.js`,
  `scene/scene-gltf-read.js`): an externally refined GLB binds onto its sketch as an
  append-only derived artifact (`data/outcomes/<ref>/mesh-<n>.glb` + sha256 provenance
  sidecar), machine-gated by a FULL geometry decode at the door. `meshRef` joins the
  figures map as the sixth body source — lowered server-side into `payload.faces` (no
  runtime GLB loader ships; a bound mesh picks up `ao:` etc. for free and rides every
  consumer: svg / scene / world / export). Reader: pure-Buffer writer's-mirror —
  indexed+soup tris → padded quads, COLOR_0/baseColor → per-corner fills round-tripping
  flat hexes byte-exact, TRS and matrix trees, y-up→z-up.
- **Semantic level export** (`scene/scene-gltf-level.js`, default-on): `worldFraming`
  cameras become posed glTF cameras; entities become identifiable nodes (a baked rig's
  wrapper IS its placement, standing at spawn facing its heading) carrying
  `moj:entity`/`moj:rule`/`moj:body` extras; scene extras carry `moj:spawn`,
  `moj:colliders`, and the `moj:game` contract digest. `export_model({write:true})` now
  writes the sketch's outcome folder — `model.glb` beside `recipe.json` and a README
  with the import notes (`data/exports/` is beats-only now).
- **Gates closed in real Blender** (5.2 LTS, headless): 351 animations imported off a
  roster-level export with the designed key/duration shape; cameras and `moj:` extras
  readable; mid-stride eyes gate clean; a Blender edit re-exported by Blender decodes
  cleanly back through the bind gate (COLOR_0 survives the round trip).
- Bound statues can opt into `singleSide` front-face culling (`scene/scene-three.js`) —
  interior-culled closed solids halve fragment cost; absent ⇒ byte-identical. Game
  levels also stop rendering the corner control-hint (the pause menu teaches).

### Blender as a local worker — hero bakes, world GI, prelit figures

Same posture as the image/voice workers: optional, operator-hosted, produces bound
derived artifacts, holds no substrate state. The runtime stays 100% unlit vertex
colour — a bake is a colour swap, never a lighting engine, so baked results ship to any
player/bot/deploy with no Blender anywhere.

- **Hero-object bake** (`scripts/blender-bake.mjs` + `.py`,
  `docs/local-blender-worker.md`): export → Cycles diffuse GI baked into vertex
  colours → bound back through the `bind_mesh_render` gate → placed via `meshRef`.
  The `statue` preset carries the eyes-gate findings (ambient fill + no-cast shoulder
  groups, a dense plinth for the baked shadow).
- **World GI bake — the "blenderification" bicycle** (`scripts/bake-world-gi.mjs` +
  `.py`, design in `scene/map-gi-bake.plan.md`): a fixed drivetrain
  (FACING→EXPORT→BAKE→machine gate→BIND→eyes gate) with gear adapters per world kind —
  `inline-faces` (recolours frozen `manifest.faces` in place, so `mapRef` mode
  variants inherit) and `generated-mesh` (resolve→bake→a `<ref>_gi` meshRef variant).
  Presets `interior-day` / `exterior` / `space` / `interior-lit`.
- **Unshaded export mode** — the substrate change the bakes ride:
  `resolveWorldScene(sketch, { unshaded:true })` exports RAW ALBEDO (a `FLAT_LIGHT`
  in `vexar.js` plus skipping the material/AO/weathering darkening channels; the light
  seam threaded through workbench/assembler/polygomer/city paths), so the bake's GI is
  the only lighting. Deliberately not an MCP schema field (description-payload
  ceiling); lives in the resolver + workers. Absent the flag, every output byte is
  identical.
- **Authored outward normals, P1** (`export-normals.plan.md`): the root cause of black
  parts on baked mirror-built units is winding-derived normals flipping under mirror.
  Lathe parts now author `outNormal`, carried through the assembler mirror and emitted
  as the GLB NORMAL attribute with winding made to agree
  (`faceListToMesh({withNormals})` — opt-in, every other consumer byte-identical).
  P2 (remaining generators) / P3 (rig-packed path) staked in the plan.
- **Prelit figures, P1** (`worlds/prelit-transfer.js`): a `unitRef` figure may carry
  `prelit:'<ref>'` naming a bound GI-baked transfer mesh — the rig's rest faces are
  recoloured through a quantised position→colour map before packing, so a
  premium-lit suit WALKS at zero runtime cost (rigid FK parts carry baked form-shading
  correctly). Cacheable via `prelitKey` (append-only bind slots name the bake
  content). Absent ⇒ the bake is byte-identical.

### Painted landscape — ground, extent, builds

The painterly terrain kind grows a walkable-world material layer, all seeded and
deterministic, world-route (and glTF export) only — the SVG path is untouched.

- `ground` — slope-routed surface textures for the `/world` mesh (steep cliff faces vs
  gentle ground), with a world-space grime-cloud + weather-streak bake into the vertex
  colours so tiling can never show, and a deepened facet-shading curve. Presets:
  `sandstone` / `granite` / `red-rock` / `meadow` / `snow`; object form for per-world
  tuning. Two new rock tile FAMILIES in `landscape/surface-textures.js`
  (`rock-sandstone`, `rock-snowcrag` — one structural DNA, four seed variants rotated
  per tile-repeat region).
- `extent` — uniform world-mesh magnification: a longer crossing under proportionally
  taller relief, without re-gridding.
- `builds` — terrain-anchored placed structures (launchpads, towers, decks): boxes,
  `shape:'cylinder'` prisms, `slope` ramps you can walk up, `rotZ` spins, `sink`
  bedding (negative = elevated walkways); one finish channel per build — a
  procedural-material preset + tint, or a panel texture tile. Absent ⇒ byte-identical
  face list.

### Fixed

- Polygonizer house recipes: the whole house assembly is now authored in one
  compiler-owned oblique space (facade datum, shared recession, forward apron) instead of
  mixing in renderer-anchored solids — the bug that detached roofs from bodies. Plus
  entry-door and furnishing upgrades in `floorplan-structure.js`.
- `create_sketch` can now MINT the seeded interior kinds (`floorplan` / `restaurant`), not
  just render ones minted elsewhere — the manifest gate dispatches on kind.
- `procedural-material.js` imports vexar relatively so mint scripts run under plain `node`.

### Tool-list token load — consolidation + routing

The figure/solid family collapses behind one door: `mint_solid(kind)` / `edit_solid(op)` /
`get_solid_vocab` replace ~15 closed `create_*` tools (figure, manji-tree, workbench,
assembler, carved-solid, solid-turntable, edifice, vehicle; skin + emote as `edit_solid`
ops), every retired name kept callable as an unlisted alias and every per-kind manual
parked in a `solid_vocab` card pulled on demand. The science-process views fold into
`create_view` kinds (`dna-process` / `energy-cycle`), and `forge_motion` / `stitch_motion`
shed their essay descriptions into `motion_vocab` cards. The routing-card two-step then
extends from the studio wing to the OFFICE wing: new `bot` / `app` / `connected-service`
paradigm cards turn the "is this a bot, an app, or a service?" boundary into a
surface-the-candidate-set → decide-by-who-touches-it → ask-if-underdetermined flow,
relocating the build-flow prose out of the always-resident office index. Retrieval is
pinned by an expanded eval harness (rank-0 collision ordering, office top-3 entry, two-step
SET coverage). Net: the always-on `tools/list` payload holds at ~250 KB while ~15 tool
names leave the surface; `PAYLOAD_CEILING` ratchets 381,500 → 255,000 to lock the reclaim
in. Additive — every retired name still resolves; recipes and renders are byte-identical.

### Docs

- README: npm/license/node badges + the `npx mojulo init` install one-liner above the fold.
- README + `package.json` description repositioned around composability ("the range is
  what allows composability" — recipes compose into bigger works; no prompt
  engineering, the vocabularies carry the small decisions).
- New plan: `lib/graph/interchange.plan.md` — "standard formats at the edge, recipes at
  home" (animated GLB export, eligibility widening, the bind-back door, semantic level
  GLB), with blender-mcp as the standing verification rig. The dungeon kind above is its
  I0 — and I1–I4 landed in this release (see the interchange section above), with the
  build logs and closed Blender gates recorded in the plan.
- New worker doc: `docs/local-blender-worker.md` (posture + both bake legs); CLAUDE.md
  gains the world-GI-bake capability row.
- New plans from the Blender arc: `scene/map-gi-bake.plan.md` (the bicycle, generalized),
  `scene/level-gi-spike.plan.md` (the throwaway proof), `scene/export-normals.plan.md`
  (authored normals, P1 landed), `worlds/prelit-figure.plan.md` (the moving prelit suit),
  `interchange-render-leg.plan.md` (the Cycles render seam — orientation, no code).

## [1.0.3] — 2026-08-07

A CI-portability patch — test-only, no runtime or API change. Once 1.0.2 cleared the module-load
break, CI surfaced a second, older problem: the visualization-era characterization snapshots were
pinned on the developer's machine (node 24 / macOS) and hashed **full-precision, trig-derived
floats** (camera pitch, entity positions). Those values drift ~1 ULP across V8 versions and libm
builds, so the pins mismatched on CI (node 20, ubuntu/glibc) — the reason CI had been red across
1.0.0–1.0.2. This is why the local "6,134 green" gate never reproduced in CI: the char-net was
never environment-portable.

Fix — make the two offending pins portable by construction so they are byte-identical on any node/OS:

- `world-scene.kinds`' broad per-arm hash is now **structural** (integers/strings/booleans/array
  -lengths/key-sets exactly; non-integer numbers as presence only) **and local-only** (skipped under
  `CI`). The complex generated kinds (planetary, orbit-view, …) build geometry through threshold
  -based vertex/face decisions, and a few payload coordinates are near-zero cancellation values
  (~1e-9) that differ by V8 build — when one straddles a dedup/cull threshold the FACE COUNT itself
  flips, so even a structural hash diverges between environments. The payload is deterministic
  *within* an environment (the `resolves are deterministic` sub-test proves this and runs on CI); it
  is simply not portable *between* them. The pin stays a local transcription-error guard; the
  emitted-output char-net (`emit-channels.char` et al.) is the portable guard on the float geometry.
- The controllable golden traces round every float to 6 significant figures — coarser than the
  cross-environment drift, finer than any behavioral change (a maneuver firing, a hit landing shows
  as a structural diff). Both snapshots were regenerated in the full-suite context (async-texture
  warming makes the world-scene hashes context-sensitive, so an isolated regen would not match CI).
- Also fixes a time-seeded flake in the session-token test: flipping the **last** base64url char of
  a 32-byte HMAC signature can be a no-op on the trailing padding bits and still verify; flip the
  first char, which always maps to real signature bytes.

Green on node 24 across two consecutive full runs (424 files / 6,134 tests); the node-20
ubuntu+macOS CI matrix is the portability gate.

## [1.0.2] — 2026-08-07

A stability patch that closes the 1.0.0/1.0.1 CI break at its root. The controllable-world
decomposition in 1.0.0 had lifted three modules into the gitignored mobile-suit content pack and
then **statically imported them back** into tracked source — `ms-maneuvers.js` (dodge/tackle
maneuvers), `ms-ai.js` (the AI opponent brain), and `agent-commander.js` (the 0807 "agent-spectate"
spike: a live commander that reads the fight and drives a suit). On a clean checkout — CI or a
fresh `npx mojulo` — those imports resolved to absent files and threw `ERR_MODULE_NOT_FOUND` at
module load, taking down the whole controllable-world path. (The published 1.0.0 tarball happened
to bundle the pack via its `files` allowlist, so `npx` ran; CI on the bare repo did not.)

Resolution — **cull the spike, keep the behavior**:

- The `agentSpectate` / agent-commander plumbing (the "make an agent play the arena" experiment)
  is removed from tracked source. Its emit blocks were gated and byte-neutral when a manifest did
  not stamp `agentSpectate`, so no world or fixture changes bytes. Touches the controllable channel
  emitter, `scene-three.js`, and `world-scene.js`.
- `ms-maneuvers.js` and `ms-ai.js` are engine **behavior** — they carry tracked test coverage in
  `controllable-world.test.js` — not content, so they are now tracked directly (a `.gitignore`
  exception) and resolve on a clean checkout. The rest of the mobile-suit content pack stays
  gitignored.

Verified green in BOTH states: pack present (424 files / 6134 tests) and, crucially, pack absent —
the real clean-checkout condition — (412 files / 6025 tests). Folds in the 1.0.1 characterization
snapshot re-pin. No API or world-recipe change.

## [1.0.1] — 2026-08-07

A test-pin patch — no runtime or API change. The `1.0.0` release commit shipped a stale
characterization snapshot: the final edits in the controllable-world decomposition changed the
emitted bytes of the ten controllable / shadow / fx / capture channel fixtures, but
`lib/graph/scene/__snapshots__/emit-channels.char.test.js.snap` was regenerated one edit too
early, so `emitThreeWorld`'s byte-level pins failed in CI. The emitted world code itself was
correct throughout (the behavioral trace / parity / emit / determinism suites all passed on
`1.0.0`); only the stored hashes lagged. This release re-pins those ten hashes so the suite is
green (424 files / 6134 tests). No consumer of the package is affected — the snapshot is a
test-only artifact, never executed at runtime.

## [1.0.0] — 2026-08-07

An editorial release. Everything since 0.8.0 — the visualization era — consolidated into one
release, plus the statement of what the version number now promises. (The consolidation dated
2026-08-04; a coherent late batch landed 2026-08-06 and folded in before the merge — see "Late
additions" below.) 0.8.0 shipped a bot
factory that had just learned to run apps; 1.0.0 ships **the agent's workshop**: five creatable
paradigms — bot / connected service / app / **media** / **game** — where **Media** is the creative
arm promoted to first class (diagrams, walkable worlds, figures, synthesized music and song,
voice registers, films, publications, covers, directed pictures — all tiny deterministic
recipes, never renders) and a **Game** is composition over it: Media levels, music, and art
bound to a typed store with rules.

### The 1.0 contract

- **Stable surface:** the five paradigm loops (bot mint→deploy→verify_chain · connected-service
  deliberation→bind→trigger · app scaffold→start→envelope-inference · media mint→render→export ·
  game mint→play→export),
  the recipe→render doctrine (stored manifests re-render deterministically; derived renders are
  disposable, provenance-bound files under `data/outcomes/`), additive-only DB migrations
  (existing DBs upgrade at open), the loopback-only MCP transport, and the no-LLM-keys posture
  on creative/vision/inference paths.
- **Moving surface (minor releases):** the creative vocabularies — sketch/view/world/beats/game
  kinds, vocab cards, routing cards, registers, catalysts. Content-extensible by design;
  expected to keep accreting through 1.x without a major bump.
- **Bot image:** pinned exact (`bot-v0.5.1`); the bot runtime is unchanged in this release.
- **Taxonomy note:** Media is promoted from "the creative arm beside the paradigms" to the
  fourth paradigm, and Game moves to fifth as composition over it. The worked-example key
  `creative-mint` is renamed `media` (the old key still resolves as an alias).

### Media — the fourth paradigm (the visualization + audio substrate, Ring 10)

Recipe→render across four backends over one engine-agnostic payload: SVG (two-point
perspective), CSS-3D (dependency-free `matrix3d` scenes), three.js (traversable Worlds with
orbit/WASD, `.glb` + z-up `.stl` export), and GLSL raymarch (painted landscapes + the fog
effects overlay). Worlds/objects split into distinct concern buckets with their own rails;
45 science/math/bio study kinds drawerized under `create_view`; figures gained rigs, emotes,
garments-as-data, fluff bodies with SDF welding, and skin projection; per-surface material
response (Blinn-Phong over the baked vexar solve, diffuse-preserving); real-unit read-back via
`measure_view`; films via `forge_motion` / `stitch_motion`. `lib/graph/` folderized a second
pass (`derivers/`, `geo/`, `landmarks/`, `layout/`, the `scene/channels/` registry split).

### Game — the fifth paradigm: composition

`create_game` (typed store + levels-as-worlds, **completability-gated at mint**), level-verb
mechanics + game kits + the glyph/sfx UI language — all proven on the **Mobile Suit Arena**
build line, whose lasting deposit in the repo is *engine*: assembler units made posable →
walkable → playable (the station-graph walking-unit layer — unit-pose/anchors/rig,
dodge-poses, pose-lab), the controllable-world combat/match machinery (AI fire-back with
boost-juking, spawn drop-ins, contact shadows, egg-exact target reticle, match stats,
proximity audio), the game shell's hangar/setup/score-screen machinery, **gamepad support**
(standard-mapping pads merged into the one input snapshot, weapon-select chords, a
controller-diagram pause sheet) and **practice mode**. The arena's game *content* — weapons,
shields, maps, liveries, suit vocab — ships as an operator-local content pack behind guarded
lazy-import seams that degrade clean when absent: game content is an artifact, not source.
Around the paradigm, the project layer: **game projects** (`create_game_project` /
`bind_to_game_project`, the read-only Game Developer studio at `/games/<ref>`), the **Mojulo
Arcade** (`/arcade`), the **pixelizer** 2D register (declarative PPU-model frames, pure
`step(state, action)` reducer games — brickster + philosopher's stone seeded —
`create_pixelizer_game`), the **sprite-sheet** pipeline over the image-render handoff
(`create_sprite_sheet` / `bake_sprite_sheet`), publication **covers** (`create_cover`), and
**`export_game`** — a stored game materialized as a self-contained folder, one `git init` from
a public GitHub-Pages playable URL.

### Audio, voice, song

Beats (synthesized-never-sampled seeded recipes: ambient / composition / groove / SFX) grew a
domain layer (revisions + annotations + the `/beats/<ref>` studio), world bindings driven by
sim state, WAV/MIDI export, foley, and **song**: a composition sings via the in-process
parametric formant vocaloid (`patch:'voice'`) — grown in-house where a borrowed sense failed
the determinism bar. Voice registers (`create_voice` — confidence × depth resolved to Kokoro
blend weights, pure math) with WAVs as disposable derived renders via the optional local
worker. In-world combat audio is proximity-scaled.

### Borrowed senses (image outcomes)

Mojulo designs pictures it cannot paint: designed-picture sketch kinds (`image-outcome` /
`sequential-art` / `character-sheet` / keyframes / scene-motion), the durable render-worker
handoff (`request/pull/submit/accept/reject_image_render` over `image_render_requests`, two-gate
machine+eyes doctrine), the optional local ComfyUI worker reweighed SDXL → **Qwen-Image-Edit**
(one protocol over two transports), skin projection onto polygomers and assembled units, and
the agent-as-vision-adapter reference protocol.

### Orientation & operations

`forward_context` dieted to a thin routing index (routing cards + FORM-scoped
`get_creative_toolset` subdrawers), tool telemetry + `/observability`, worked examples + the
register kit, description-budget ratchets + payload pins enforced by test, the workshop nav
drawer + `/maker` hub tiles, and **mojulo-orient** — a separate consent-first stdio MCP
carrying founding works as mintable recipes for practical orientation.

### Deprecated / removed

Operations mode (Ring 11) removed as unused (`ops_tags` retained as motion's grouping store);
the ~40 per-view tools retired into `create_view` kinds (retired names still execute as
unlisted aliases); the pixelizer artifact gallery archived out of the tree (engine + two
reference games remain, gallery recipes retained as test fixtures); **the mobile-suit game
content extracted** to a gitignored operator-local pack (`lib/graph/mobile-suit/`) behind
guarded seams — the `g-series-livery` module and the g/z-series livery vocab cards leave the
tree, cold copies in `lite-template/integration/archive-mobile-suit/`; closed plan/spike
files consolidated into the changelog and `control/docs/` orientation docs.

### Data & migrations

All additive: `beats_revisions` / `beats_annotations`, `game_projects` (+ typed-role members),
`image_render_requests`, sketches `bucket` / `folder_ref` columns (buckets derive at read
time — existing rows reclassify with no migration), new embeddings kinds (routing / vocab
families). No destructive migration; existing 0.x DBs upgrade at open.

### Late additions (2026-08-06, folded into 1.0.0 before the merge)

A coherent batch landed on the branch after the 08-04 consolidation and ships in 1.0.0. Build
logs live in the plan files named inline.

- **Controllable-world engine decomposed** (`worlds/controllable-split.plan.md`, complete). The
  3,305-line `worlds/controllable-world.js` monolith — the whole action-game engine as one
  import-free closure — was split into **import-free builder closures composed over a shared
  namespace** (`worlds/controllable/`: `compose`/`core`/`gait`/`rules-*`/`combat-{hit,ranged,melee,match}`;
  the mobile-suit maneuvers + AI lifted into the operator-local content pack), so the
  single-source-of-truth browser emission survives per-system rather than as one blob.
  `stepWorld` became a **registered slot-runner** with the frame order test-pinned. The façade
  `controllable-world.js` shrank 3,305 → 86 lines, re-exporting the same API; behavior is
  **byte-identical**, gated by four golden scenario traces and a per-builder `new Function`
  self-containment tripwire (char-net re-pinned on the 10 controllable-channel fixtures — every
  carve changes emission bytes by design).

- **Drivable and flyable vehicles** (`vehicle-designer/drivable-vehicles.plan.md`, D1–D5 +
  gamepad + fly). The veh-* part shelf meets the worlds engine as the **first external tenants**
  of the decomposition — rule-level builders that needed zero engine edits. A `drive` rule
  (pure kinematic longitudinal dynamics: real `F=P/v` power curve capped by traction, quadratic
  drag, bicycle-model steering off the rig wheelbase, distance-true wheel spin) and a `fly` rule
  (energy-and-attitude flight with stall + coordinated bank-to-turn). A vehicle rig
  (`deriveVehicleRig`/`bakeVehicleRig`, wheels classified FL/FR/RL/RR by position, a single
  `roll` clip) renders through the existing figure-rig path; drivetrain data is seeded **on the
  parts** (`VEH_ENGINE_DRIVETRAIN`, `curbMass`/brake overrides on the archetypes) and composed by
  `deriveDrivetrain` — no engine part → not drivable, by data. Worlds bind a vehicle via
  `figures.vehicleRef` beside `unitRef`; board / drive / dismount ride the existing pilot-swap
  (T); gamepad RT/LT map to throttle/brake off the live pilot each frame; opt-in mesh `tilt`
  banks planes. The `veh-drive` vocab card names the affordance facts (`speed` / `throttle` /
  `braking` / `skidding` / `boarded` …) later fx/sfx layers bind against.

- **`forward_context` office/studio split** (`mcp/tools/orientation-containment.plan.md`, C1–C3).
  `forward_context` gains a stateless `mode: 'office' | 'studio'` (default office). The creative
  FORM recognizer rows + the game row relocate **verbatim** into a standalone studio body reached
  by one hook row, dieting the always-paid office body from ~11.6K to ~9.4K chars/cell; the single
  `BODY_CEILING` retires for per-mode pins (office 9,600 / studio 7,400). `SERVER_INSTRUCTIONS`
  Media/Game bullets collapse to one line each teaching the two wings. Follow-on schema-diet and
  result-shaped tool-pack work is staked in plan files; a host spike found
  `notifications/tools/list_changed` non-actionable on the primary host today (client never
  re-lists mid-session), so dynamic tool-packs park behind a dispatcher-hybrid fallback and the
  near-term economic fix stays the per-schema diet.

- **Volumetric fog depth-clip** (`map-treatment.plan.md`, engine seam). Fog gains an opt-in
  `depthClip`: a per-frame depth prepass clamps the raymarch at the rasterized scene's foreground
  meshes (rigged suits, walkers, cars) the box-field SDF doesn't carry, so fog stops painting over
  them. Opt-in — absent, the composed frag and every emitted page stay **byte-identical**.

Recorded gate at the batch's close: **6,075 tests green**. The description-budget ratchets were
re-pinned upward in the batch — `PAYLOAD_CEILING` 372,000 → 376,000 and three catalyst
descriptions allowlisted — to bless the local-catalyst shelf and absorb the `forward_context`
mode schema; the payload now sits at 374,898/376,000. The downward schema diet (moving the
`create_manji_tree` / `forge_motion` enums behind their vocab cards to shrink the ~94K-token
connect surface) stays open as an orientation-containment follow-up.

### Previously-unreleased sections

The six dated sections below were accumulated as "Unreleased" between 0.8.0 and this release;
they ship in 1.0.0 and are retained verbatim for the record.

### 2026-06-16
Bring visual capability to browser-based 3D via css3D and three.js. Enhance scene composition and enable figure drawing. See HTML-CSS-NATIVE-RENDERING and POLYGONIZER-SYNTHESIS 

### 2026-06-07 (was "Unreleased (minor)")

Painted landscapes — closed-vocabulary, glyph-driven landscape primitive. The model picks one **heartbeat** (geometry recipe), one **splatch** (3-seed palette), and an optional **structure-glyph** (scatter recipe); the substrate samples wave parameters within the heartbeat's declared ranges using a seed, derives a balanced 4-stop palette from the splatch via Rec.709 luminance-sorted interpolation, scatters obelisks/boxes at footprints whose `z_base` rides the wave surface, and renders a flat-Lambert borderless SVG with back-to-front depth sort. Authoring surface collapses to `{heartbeat, splatch, structures?, seed?, light?}` — measured at ~30 tokens vs ~14K for the equivalent raw SVG (~449× reduction) and ~250 for a fully-specified manifest (~8× reduction). Math provenance and design ladder in the spike series: [field-coupled-wedges.spike.gen.test.js](lib/graph/polygonizer/field-coupled-wedges.spike.gen.test.js) → [-lambert](lib/graph/polygonizer/field-coupled-wedges-lambert.spike.gen.test.js) → [-step3](lib/graph/polygonizer/field-coupled-wedges-step3.spike.gen.test.js) → [-step4](lib/graph/polygonizer/field-coupled-wedges-step4.spike.gen.test.js) → [-structures](lib/graph/polygonizer/field-coupled-wedges-structures.spike.gen.test.js) → [glyph-driven-landscape](lib/graph/polygonizer/glyph-driven-landscape.spike.gen.test.js).

### Added

- **`renderPaintedLandscapeToSvg` primitive** at [lib/graph/polygonizer/painted-landscape.js](lib/graph/polygonizer/painted-landscape.js). Closed-enum `HEARTBEATS` (4 entries: `gentle-pulse`, `breathing`, `chop`, `ridge-step`), `SPLATCHES` (6 entries: `meadow-trio`, `dusk-trio`, `glacier-trio`, `firelight-trio`, `bone-trio`, `verdure-trio`), `STRUCTURE_GLYPHS` (3 entries: `monument-row`, `village-cluster`, `scattered-totems`). Seeded variation via xmur3 + mulberry32 — same seed → byte-identical scene; new seed → coherent variation within recipe rules. Palette is splatch-deterministic (seed only varies geometry and structure placement). Validation surfaces "unknown X (available: …)" errors mirroring the substrate's `fields.js` pattern. Combinatorics shipped: 4 × 6 × 4 = 96 distinct scene templates, each with within-recipe variation.
- **`create_painted_landscape` MCP tool** at [lib/mcp/tools/painted-landscape.js](lib/mcp/tools/painted-landscape.js). Validates the manifest, persists via `SketchRepository` with `manifest.kind === 'painted-landscape'`, returns `{ ok, ref, url, svgUrl }`. Registered in [lib/mcp/server.js](lib/mcp/server.js) adjacent to `create_manji_tree` so both illustration entry points sit together in `tools/list`. The tool description embeds the glyph catalogues (heartbeat/splatch/structure intents) so the model can pick by intent without a separate lookup.
- **Sketch SVG route dispatches on `painted-landscape`** in [app/api/sketches/[ref]/svg/route.js](app/api/sketches/[ref]/svg/route.js). The route now branches `manji-tree → renderManjiTreeToSvg`, `painted-landscape → renderPaintedLandscapeToSvg`, fallthrough → `renderSketchToSvg`. No new persistence layer — painted landscapes ride the existing sketch artifact system like manji-trees.
- **Test coverage** at [lib/graph/polygonizer/painted-landscape.test.js](lib/graph/polygonizer/painted-landscape.test.js) (18 unit tests covering tables, seeded determinism, range conformance, palette derivation luminance ordering, validation surfaces, render output) and [lib/mcp/tools/painted-landscape.test.js](lib/mcp/tools/painted-landscape.test.js) (11 integration tests covering mint→persist→render flow, missing/unknown input rejection, seed determinism, and light-override propagation).
- **`paletteOverrides` on the manifest** for fine-grained color tuning that keeps the splatch contract. Three independent sub-fields: `stops: { shadow?, base?, mid?, highlight? }` replaces any subset of derived stops with explicit `#rrggbb` hex; `positions: [0, p1, p2, 1]` repositions the four stops on the brightness ramp (strictly increasing, default linear `[0, 1/3, 2/3, 1]`); `gamma: number` curves the Lambert→stop mapping (default 1.0). The closed-vocabulary splatch stays the default; overrides express "this splatch under tuned lighting" without inventing a new palette. Validation enforces hex format, strict-increase + endpoint constraints on positions, and positive-finite on gamma — bad overrides fail at mint, not render. Eight new unit tests + two new MCP integration tests cover the round-trip.
- **`heartbeatOverrides` on the manifest** for fine-grained geometry tuning that keeps the heartbeat enum. Two sub-fields: `waves: [{ ampScale?, cuScale?, cvScale? }, ...]` applies per-component multiplicative scales to amplitude / cycles-u / cycles-v ranges BEFORE seeded sampling (null entries skip; length must be ≤ the heartbeat's component count); `samples: { u, v }` overrides the heartbeat's recommended cell density (integers ≥ 2). The seeded property is preserved: `(heartbeat, seed, heartbeatOverrides)` → identical waves. Eleven new unit tests + two new MCP integration tests cover the round-trip and validation.
- **Shelf-card loader at [lib/graph/painted-landscape-cards/](lib/graph/painted-landscape-cards/)** with [loader.js](lib/graph/painted-landscape-cards/loader.js) scanning the directory for `*.md` files with JSON frontmatter, validating each card against its family schema, and exposing frozen `HEARTBEATS` / `SPLATCHES` registries keyed by card id. Heartbeat and splatch families are content-extensible — adding a glyph is a content edit (drop a new card here); shipping a new family kind is still a code change. Structure glyphs intentionally stay code-defined (algorithmic, not pure data). Ten seed cards now ride this path: four heartbeats (`gentle-pulse`, `breathing`, `chop`, `ridge-step`) and six splatches (`meadow-trio`, `dusk-trio`, `glacier-trio`, `firelight-trio`, `bone-trio`, `verdure-trio`). The renderer's `HEARTBEATS` and `SPLATCHES` exports re-export the loader's output, so callers see no API change. Five loader unit tests cover the seeded set, frozen-at-every-level invariant, and field shape conformance.
- **fBm engine for fractal terrain** — second wave-generation engine alongside `sine-stack`. Heartbeat cards declare `"engine": "fbm"` and a `fbm: { octaves, persistence, lacunarity, baseScale, amplitude }` parameter block (each a `[lo, hi]` range, same range-authoring discipline as sine cards). The renderer's value-noise + fractional-Brownian-motion implementation (~60 LOC) produces irregular omnidirectional bumpiness with statistical self-similarity — "bumpy throughout, scales naturally with the quad" — which sine waves cannot express. Engine is loader-dispatched: `evalHeightAt(x, y, hb)` and `evalLambertAt(x, y, hb, light)` branch on `hb.engine` so build helpers don't know which engine they're sampling. fBm uses world coords directly (slope by finite differences with ε=0.01); sine path uses normalized `(u, v)` (analytic slope). Three seed fBm cards land: `gentle-roughness` (3-4 octaves, soft naturalistic hills), `rocky-irregular` (5-7 octaves, broken ground), `glacial-smooth` (2-3 octaves, broad swells). Seven seven new unit tests + comparison spike at [`lite-template/integration/spike-output/fbm-engine-comparison/`](../lite-template/integration/spike-output/fbm-engine-comparison/) (sine vs fBm under matched splatch + seed). Engine guidance: pick `fbm` for natural terrain (meadows, dunes, glaciers, broken ground); pick `sine-stack` when periodicity is the intent (terraced fields, ocean swell stacks, ribbed forms).
- **`renderStyle` field on the manifest** — closed enum `['painterly', 'topographic', 'wireframe']`. Orthogonal to heartbeat and splatch; geometry + Lambert math unchanged across styles, only polygon stroke/fill changes. `painterly` (default) = stroke=fill, no visible borders, cinematic / classic-landscape read. `topographic` = Lambert fill WITH dark cell borders, vector-map / topo-chart / textbook-chart read. `wireframe` = `fill="none"` with Lambert-colored strokes on the shadow stop as background, pure-vector-display / 80s-textbook-math-cover / outrun-grid read. One additional token at authoring time unlocks three categorically different visual registers from the same scene. Six new unit tests + two new MCP integration tests cover the round-trip and the visual-mode invariants (`painterly` has no `fill="none"`; `wireframe` is all `fill="none"`; `topographic` has a single shared stroke color).
- **Seven new stylistic splatches** in [painted-landscape-cards/](lib/graph/painted-landscape-cards/) covering the cinematic / vector-technical / textbook registers: `terminal-amber` (amber-on-black phosphor / retrocomputing); `synthwave-neon` (deep-purple → hot-pink outrun / 80s math cover); `vector-cyan` (deep-blue → electric-cyan CAD / blueprint); `chart-primary` (deep textbook-blue + vermilion + bone-white scholastic chart); `velvet-cinema` (inky-midnight + velvet-violet + antique-gold noir); `harvest-gold` (deep-umber + fired-amber + burnished-gold autumnal); `mist-coastal` (slate + muted-teal + pale-fog overcast cinematic). Splatch count goes from 6 to 13; combinatorics now ~12K distinct templates excluding overrides. Showcase spike at [`lite-template/integration/spike-output/stylistic-register-showcase/`](../lite-template/integration/spike-output/stylistic-register-showcase/) demonstrates the same primitive covering cinematic / vector-technical / topographic registers.
- **`camera` glyph family** — closed-vocabulary cards that lock the scene's projection (vanishing points + room basis + vertical axis + depth foreshortening). The loader gains a third family (`camera`) alongside `heartbeat` and `splatch`; five seed cards land in [painted-landscape-cards/](lib/graph/painted-landscape-cards/): `medium-survey` (substrate default baseline), `wide-cinematic` (panoramic letterbox with deep room), `close-up-detail` (tight foreshortening + taller verticality), `low-angle-hero` (horizon pushed high + 48-unit verticality for monumental structures), `top-down-survey` (near-orthographic / topographic / map-view). The renderer threads `(camera, roomBasis)` through every `projectTwoPoint` call; omitting `camera` falls back to the substrate's prior default projection so existing renders are byte-identical. Six new loader/unit tests + two MCP integration tests cover the round-trip and the multi-camera differentiation. Showcase spike at [`lite-template/integration/spike-output/camera-lock-showcase/`](../lite-template/integration/spike-output/camera-lock-showcase/) renders the same fixed scene under all five cameras (1–5) plus four recommended pairings (P1–P4) demonstrating camera × renderStyle × splatch composability. **One extra named pick rotates / tilts / zooms the camera without touching terrain or palette** — combinatorics now roll in the camera dimension on top of heartbeat × splatch × structure × renderStyle.

### 2026-06-03 (was "Unreleased (patch)")

Stash mode (Ring 9 v2) earns its **operator-facing surface**. v0.9.0 shipped the substrate — `mint_stash` / `gather` / `mint_drawer` / `cook` as MCP tools, with the agent the only reader. This patch lands the **`/stashes` inbox + per-stash detail pane** so the operator can browse what the agent has gathered and shape it (rename, archive, file into drawers, move between drawers, prune) without round-tripping back through chat. Two structural beats ride along: a **`stash_bindings` adjacency table** (many-to-many edges from a stash to a bot / app / plan / cook / contextmap node — the substrate that turns "stash inbox" into "this bot's knowledge corpus, this plan's working memory"), and **soft-delete for stash items** (an `archived_at` column on `stash_items` so the operator can prune the inbox without breaking downstream cook citations — the citable-atoms posture).

The shared posture across the surface: **structural edits ride on HTTP; content edits stay on the MCP path.** The dashboard surfaces rename / move / archive / status — operations that don't touch the per-type contract gate — while item body / metadata edits stay on the MCP `update_item` path so the gather contract has a single substrate path. Plan at [lite-template/integration/app-system/0601/STASH_VIEW_LAYER.md](../lite-template/integration/app-system/0601/STASH_VIEW_LAYER.md); supporting atomicity work (citable atoms, adjacency table, soft-delete) at [lite-template/integration/app-system/0602/STASH_RELATIONAL_ATOMS.md](../lite-template/integration/app-system/0602/STASH_RELATIONAL_ATOMS.md).

### Added

- **`/stashes` inbox** at [app/stashes/page.jsx](app/stashes/page.jsx). Row-per-stash list with status filter (open / archived / all), title-or-ref search, item + drawer counts, and hover affordances for inline rename and archive / unarchive. Backed by `GET /api/stashes` ([app/api/stashes/route.js](app/api/stashes/route.js)) — item and drawer counts are computed server-side so the inbox shows density without a second round-trip.
- **`/stashes/[ref]` detail page** at [app/stashes/[ref]/page.jsx](app/stashes/[ref]/page.jsx). Header with inline title rename + status toggle; a drawer rail with "+ New drawer" inline input, per-drawer rename, and a Root pseudo-drawer for unfiled items; an item list that dispatches on `type` — `text` / `markdown` / `image` / `svg` / `link` render in full; `script` and `pointer` fall to small stub cards (placeholders for later). Each item card carries a move-to-drawer dropdown and an archive button — the two-step `pendingConfirm` flow surfaces a warning when an item is cited by any cook.
- **Stash HTTP surface** under [app/api/stashes/](app/api/stashes/). `GET /api/stashes/[ref]` returns the full stash (drawers + items; archived items hidden by default, `?include_archived=1` surfaces them for audit views). `PATCH /api/stashes/[ref]` accepts `{ title?, status? }` for rename and archive / unarchive. Drawer routes at `POST /api/stashes/[ref]/drawers` (mint, idempotent on existing `(stash, name)`) and `PATCH /api/stashes/[ref]/drawers/[name]` (rename, clean 409 on UNIQUE collision instead of a raw SQL error). Item routes at `PATCH /api/stashes/[ref]/items/[id]` (move between drawers; `drawer: null` for root) and `POST /api/stashes/[ref]/items/[id]/archive` (soft-delete with the two-step `pendingConfirm` flow for cook-cited items, mirroring the MCP `archive_item` gate). Image bytes streamed via `GET /api/stashes/[ref]/media/[id]` ([app/api/stashes/[ref]/media/[id]/route.js](app/api/stashes/[ref]/media/[id]/route.js)) — resolves `doc_…` media refs through `DocumentRepository`, treats anything else as a literal storage key under `control/data/storage/`. The route only serves items of `type:'image'` to keep the surface narrow.
- **`stash_bindings` table** in [lib/db/index.js](lib/db/index.js) — the adjacency layer: many-to-many edges from a stash to other substrate resources. Composite primary key `(stash_id, bound_kind, bound_ref)` with `bound_kind` CHECK-constrained to `'bot' | 'app' | 'plan' | 'cook' | 'contextmap_node'`. `bound_ref` is deliberately NOT a foreign key — deletion of a bound resource leaves the binding as a "linked resource removed" chip (stashes survive the resources they're linked to). Optional `role` slot (`corpus` / `working_memory` / `ingredient` / `reference`) for downstream framing without a code change. Reverse-edge index on `(bound_kind, bound_ref)` so "stashes linked to plan X" is a cheap lookup. Purely navigational in v0 — no automatic context injection mid-conversation.
- **Soft-delete for stash items** via the `archived_at` migration on `stash_items` (`migrateStashItemColumns` in [lib/db/index.js](lib/db/index.js)). Archived rows stay in the table so cook slices and other downstream citations still resolve to last-known content (the citable-atoms posture). List reads gain an `includeArchived` flag, default false; lookups by id (`getItemById`) always return the row regardless of state — hiding archived rows is a list-view concern, not a citation concern. Hard delete remains sweep-only and never user-triggered.
- **`stashes.*` i18n namespace** in [messages/en.json](messages/en.json) — inbox strings (title / subtitle, status pills, counts, search placeholder, empty / no-match states), detail-page strings (drawer rail, item-type labels, move / archive prompts, image fallback), and an `actions` sub-namespace (rename / archive / unarchive / save / cancel + error strings).
- **Home launcher "Stash" tile** in [components/HomeLauncher.jsx](components/HomeLauncher.jsx) — new `StashIcon` (tray of layered cards) routes to `/stashes` from the home grid, sibling to the existing Research tile. `home.tiles.stash` lands in the i18n catalog.

### Changed

- **`StashRepository` grows structural verbs** in [lib/db/repositories/stashes.js](lib/db/repositories/stashes.js). `renameDrawer({ stashRef, oldName, newName })` enforces the UNIQUE collision in JS for a clean error; `moveItem({ stashRef, itemId, drawer })` validates that the target drawer belongs to the same stash before flipping `drawer_id`; `unarchive(stashRef)` flips an archived stash back to open (idempotent on open). `updateItem` re-runs the per-type contract gate against the MERGED state (existing row + patch fields) so a partial update can't corrupt the contract — type itself is intentionally NOT mutable (items are citable atoms; archive + re-gather instead). `archiveItem({ itemId })` is the idempotent soft-delete verb; `scanItemReferences(itemId)` walks `stash_cooks` slices in-process to feed the warn-and-proceed UX.
- **`StashRepository.listItems` / `countItems` gain `includeArchived`** — defaults to `false` so the inbox surfaces only live items; the explicit-opt-in flag preserves the audit path.

### Notes

- **No bot image bump.** All changes are control-plane.
- **Two additive migrations.** New `stash_bindings` table (composite PK + reverse-edge index). One new column (`stash_items.archived_at`) plus its index. No data rewrites; existing items default to `archived_at IS NULL` (i.e. live).
- **Structural edits via HTTP, content edits via MCP.** The dashboard owns rename / move / archive / status — operations that don't touch the per-type contract gate. Item body / metadata edits stay on the MCP `update_item` path so there is one substrate path through the gate. The HTTP move route deliberately exposes only the structural slice.
- **Stash bindings are navigational in v0.** `stash_bindings` rows feed operator-facing chips ("linked to bot X, plan Y") without auto-injecting context mid-conversation. The wiring surface that turns a binding into a runtime side-effect ships in a later patch when a concrete consumer demands it.

### 2026-06-01 (was "Unreleased")

The release where mojulo's deliberation rings gain an **exit door** and the operator's host agent becomes the substrate's **inference layer**. Two complementary beats run through every other thread.

**Materialization across the deliberation stack.** **Ring 8 — plan mode** seals a session into a Plan that compiles to a manifest of tool calls and executes under per-execution operator approval; when an executed manifest commits an artifact to the contextmap, a **plan→contextmap bridge** stamps a `plan_release` principle on the artifact node and archives the plan. **Ring 9 — stash mode** (the sharper-edged successor to `research_sessions`) accretes typed gathered items into renameable buckets; **cook** then takes ≥2 stashes plus an agent-authored report and materializes an **Outcome Artifact** — a self-contained folder on disk (`report.md` + `index.html` + `manifest.json` + visuals) served at `/outcomes/<cook_ref>/`, frozen to the template version it was authored against. Deliberation stops being a place where thinking accumulates and becomes one where thinking produces durable, addressable artifacts.

**Agent-as-inference, mojulo-as-porthole.** Every browser inference surface is rewired to route through the operator's host MCP agent rather than a control-plane LLM key. The **chat builder** gains an `agent` driver mode that parks each user message as a `chat_turn` task on the agent-tasks queue and awaits the host agent's envelope; the **home-page chat** parks `host_chat` turns through the same relay (`lib/agent-chat/relay.js` is the shared seam). An **agent-ui signal bus** closes the loop on both surfaces — the fulfilling worker narrates progress (`emit_chat_signal`) and raises structured decisions (`request_chat_decision`) mid-turn, rendered as inline cards the operator answers without leaving the chat.

Three supporting threads ride alongside. The **app-runtime substrate** promotes from in-process singleton to a standalone `mojulo-app-runtime` daemon (and a unified `mojulo-daemons` host that co-manages the scheduler too) that reconciles pidfiles + inventory on boot — killing the orphan-row `UNIQUE` collision the v0 could hit after a restart. **Connected Services (Phase 1)** canonizes the agent-layer-solution paradigm via `declare_skills` (host-side skill mirror) and projects skills ∪ materialized mcp-orbit compositions through a single canonical loader, surfaced as list / detail / graph views at `/mcp-skills` and a live fleet topology at `/map`. And the **sketchbook** earns folders, SVG export, diff, and an auto-mint posterity link from plan compile and stash cook; a new **Rendrant** layer (a polygonizer + neo-rembrandt rendering engine) ships inside the sketchbook as a planning tool the agent uses to draft visuals — treated as scratch, not substrate.

Two structural refinements: **`forward_context` becomes a thin routing index** (~1.4K tokens) with the heavy briefing drawerized behind five new Ring 0 sibling tools — `get_tool_index` / `get_register_kit` / `get_deliberation_overview` / `get_ui_map` / `get_substrate` — so a connecting agent pays each slice of context only when a task needs it. And the **`initialize` preamble** is rewritten to name the three creatable artifacts (Bot / Connected Service / App) with their entry tools, so a connecting agent self-routes from `tools/list` without drilling further.

The load-bearing posture across plan mode, stash/cook, and Connected Services: **mojulo's deliberation surfaces own different temporal postures, and the storage shape follows the posture.** A Plan is pre-reality (sibling `plans` table); a Stash is collected-but-not-yet-thought (sibling `stashes` + gathered-items tables); a Cook is a thought that produced a document (sibling `cooks` table + filesystem folder under `data/outcomes/`); a Skill is present-environment owned by the host (replace-semantic `meta_skills` mirror). None are contextmap commits; all sit *beside* it deliberately. The contextmap remains the sealed audit chain.

### Added — Ring 8 (plan mode)

- **Plan-mode tool family** at [lib/mcp/tools/plan-mode.js](lib/mcp/tools/plan-mode.js): `enter_plan_mode` / `forge_plan` / `revise_plan` / `compile_plan` / `execute_plan` / `list_plans` / `get_plan`. The **proposed** layer of the deliberation model. `enter_plan_mode` returns the deliberation discipline (the four lenses held loosely — spike / segment-expansion / vertical-reinforcement / collider; the shadow-scratchpad step-0 where the agent drafts but never fires tool calls; introspection-on-signal; the frame-for-approval). `forge_plan` seals a Draft from a session (`{ title, goal, lens?, frame?, manifest?, analysis? }`); `revise_plan` appends to the revision log and resets status to `draft` (touching the schematic un-commits the compile). `compile_plan` is a **compile step, not a status flip** — it validates the manifest against the live tool registry; tractable (→ `actionable`) iff every call resolves to a shipped tool, else stays `draft` with a structured `unknown_tools` / `illegal_tools` / `errors` reason. `execute_plan` is the **per-execution gate** (requires `confirm:true` + status `actionable`), re-validates, runs each call in order through the same handler path a remote `tools/call` hits, and stops on first failure (completed steps recorded, plan marked `failed` for re-forge; full success → `executed`). Registered after Ring 7; indexed in [lib/mcp/tools/context.js](lib/mcp/tools/context.js).
- **`plans` table** in [lib/db/index.js](lib/db/index.js) (repository at [lib/db/repositories/plans.js](lib/db/repositories/plans.js)) — `status` (draft → actionable → executing → executed/failed), `seen` inbox flag, `lens` CHECK column, JSON columns `frame_json` / `manifest_json` / `analysis_json` / `revision_log_json` / `execution_log_json`. Migration-added columns: `archived` / `archived_at` / `release_json` (close-the-loop), `sketch_ref` / `sketch_pinned` (diagram posterity). Sibling table — not a contextmap commit type.
- **Plan→contextmap close-the-loop bridge** at [lib/mcp/meta-context/plan-release.js](lib/mcp/meta-context/plan-release.js). When `execute_plan` runs a manifest that contains an artifact-creating `meta_context_commit` (`app_materialization` / `primitive_artifact_materialization` / `artifact_materialization`), execute_plan detects the resulting `artifactNodeId` and calls the bridge: a `plan_release` principle is timestamped on each materialized artifact node's subhistory, and the plan is **archived** (`archived` is orthogonal to `status` — an archived plan stays `executed`; `release_json` carries the bidirectional link). Trigger binding does **not** archive. Release-recording is soft — a failure surfaces as `release_warning`, never failing a successful execution. Coupling is one-way: plan mode imports the bridge; the contextmap never imports plan mode.
- **Direct tool-invocation seam** in [lib/mcp/server.js](lib/mcp/server.js): `hasRegisteredTool(name)`, `listRegisteredToolNames()`, and `invokeRegisteredTool(name, input, context)`. The compile validator checks each manifest call against `hasRegisteredTool`; the executor runs the manifest through `invokeRegisteredTool`, bypassing JSON-RPC framing so executed plans behave identically to operator-typed calls.
- **Plan inbox page** at [app/plan/page.jsx](app/plan/page.jsx) — read-only list + detail view (status/lens chips, goal, frame + discarded lenses, manifest, revision log, execution log, release link, diagram link with "Pinned" badge) served by [`/api/plans`](app/api/plans/route.js) + [`/api/plans/[ref]`](app/api/plans/[ref]/route.js). Semi-hides archived plans behind a "Show archived" toggle. New Plan opens a modal with a paste-able host-agent starter prompt. New `plan.*` i18n namespace.
- **Plan-mode diagram posterity** in [lib/mcp/tools/plan-mode.js](lib/mcp/tools/plan-mode.js). `compile_plan` auto-mints a pipeline diagram of the compiled manifest and links it on the plan (`sketch_url` in the response) — unless the operator pinned a hand-authored sketch. `forge_plan` / `revise_plan` accept an optional `sketch_ref` to pin a `sk_<…>` sketch; pass an empty string on revise to clear the pin. Auto-mint is **soft-fail** — a sketch hiccup surfaces as `sketch_warning`, never failing a successful compile. `PlanRepository.setSketchRef()` + pin-aware `forge` / `revise` paths added in [lib/db/repositories/plans.js](lib/db/repositories/plans.js).

### Added — Ring 9 (stash mode + cook + Outcome Artifacts)

- **Stash-mode tool family** at [lib/mcp/tools/stash-mode.js](lib/mcp/tools/stash-mode.js): `mint_stash` / `gather` / `mint_drawer` / `rename_stash` / `list_stashes` / `get_stash`. A **Stash** is a renameable user-facing bucket with optional Drawers; **gather** is the verb that mints typed items into it. Seven item types — `text` / `markdown` / `image` / `svg` / `script` / `pointer` / `link` — each with a required-per-type contract validated at intake. The contract is what lets the UI dispatch on type and Cook treat items as ingredients. Coexists with the legacy `research_*` tools (migration option 3 — legacy data untouched; new gatherings land here).
- **Cook tool family** at [lib/mcp/tools/cook.js](lib/mcp/tools/cook.js): `cook` / `get_cook` / `list_cooks`. The **multi-input collider** on Stashes — takes ≥2 ingredients (≥1 stash + 1 user query, optional additional stashes + optional MCP `additional_context` the agent looped in) and materializes an Outcome Artifact. **Authoring model: the agent authors `report.md` (and provides visuals); cook just materializes the folder.** No server-side LLM call. Cook does NOT compile, NOT execute, and NOT flip a status flag — it writes a row + a folder, returns the URL, and is done. **Cook stops at cook** — there is no cook outlet to plan mode; if a cook outcome later reads as tractable work, plan mode pulls it via `forge_plan({ source: { kind: 'cook', cook_ref } })` (plan-side decision, made later — see the Cook→plan bridge entry below).
- **Outcome Artifact writer** at [lib/outcomes/write.js](lib/outcomes/write.js) (+ [markdown.js](lib/outcomes/markdown.js) and the HTML template). Materializes a Cook under `data/outcomes/<cook_ref>/` as a self-contained folder: `report.md` (the load-bearing artifact), `index.html` (static doc, all visuals inlined or referenced), `manifest.json` (machine-readable index recording the template version), and any `*.svg` / `*.png` the agent provided. Strictly static — no JS framework, no client-side rendering — so the folder can be opened directly from disk, served via the `/outcomes/<ref>/` route, or zipped and emailed.
- **Outcome serve route** at [app/outcomes/[...slug]/route.js](app/outcomes/[...slug]/route.js) — `GET /outcomes/<cook_ref>/[...path]` streams files from the outcome folder. Bare URL resolves to `index.html`. Strictly static — no React, no app shell. Path-traversal hardening: each segment is validated as a safe filename, and the resolved path is asserted to live within the outcomes base directory.
- **`stashes` + `cooks` repositories + tables** in [lib/db/index.js](lib/db/index.js) ([lib/db/repositories/stashes.js](lib/db/repositories/stashes.js), [lib/db/repositories/cooks.js](lib/db/repositories/cooks.js)). Stashes hold renameable buckets with optional drawers + typed gathered items; cooks record the multi-input materialization (slices, aim, agent-authored report, suggested lens, visuals manifest). Additive migrations; both are sibling tables, not contextmap commit types.
- **Ring 9 v1 — research mode (legacy path)** at [lib/mcp/tools/research-mode.js](lib/mcp/tools/research-mode.js): `enter_research_mode` / `start_research` / `bind_research_item` / `synthesize_abstract` / `get_research` / `list_research`. The original accretive layer (links / articles / summaries / screencaps / notes / quotes / snippets) plus `synthesize_abstract` distilling the book into a thesis. With `evaluate:true` it sends the thesis to plan mode via the **research→plan bridge** ([lib/research/evaluate.js](lib/research/evaluate.js), surfaced over HTTP at `POST /api/plans/from-abstract`); a Draft plan is forged only when the agent's `recommendation === 'forge'`. Ships in this entry but is now the legacy v1 path — stash/cook is the v2 path for new gatherings.
- **Ring 9 v1 tables** in [lib/db/index.js](lib/db/index.js) (repository at [lib/db/repositories/research.js](lib/db/repositories/research.js)) — `research_sessions`, `research_items`, `research_abstracts` (with a migration-added `sketch_ref` column for diagram posterity).
- **Research inbox page** at [app/research/page.jsx](app/research/page.jsx) — read-only list + notebook view served by `GET /api/research` + `/api/research/[ref]` ([app/api/research/](app/api/research/)). Items grouped by kind with optional source links and sketch links; abstracts with optional plan / sketch links. "+ New book" opens a host-agent starter-prompt modal. New `research.*` i18n namespace.
- **Stash / research diagram posterity.** `synthesize_abstract` auto-mints a hub-spoke diagram of the book (items → thesis) attached to each append-only abstract snapshot (`sketch_url` in the response, surfaced in the `/research` pane); soft-fail, same posterity posture as plan compile. The cook path mints the equivalent diagram for its ingredients → aim. `bind_research_item` gains a `sketch` item kind for pinning an existing `sk_<…>` diagram into a book via `media_ref`.

### Added — Cook→plan bridge (research path convergence)

- **`forge_plan` accepts `source: { kind: 'cook', cook_ref }`** in [lib/mcp/tools/plan-mode.js](lib/mcp/tools/plan-mode.js) — the plan-side cook→plan bridge. When a cook outcome later reads as tractable work, the agent seeds a Draft plan from it: the cook's `aim` becomes the seeded goal (overridable via the top-level `goal` arg), its `suggested_lens` becomes the seeded lens, and the source ref is recorded in `analysis.source` for the triangle backlink (stash → cook → plan). `goal` is now optional when a source is supplied; either path must produce one. The discriminator (`PLAN_SOURCE_KINDS`) is forward-compatible — future source kinds (`'stash'`, `'sketch'`, …) follow the same shape. Replaces the never-built `synthesize_abstract({ from_cook })` slice 3 path.
- **Cook stops at cook.** The `cook` tool gains a "**no outlet, cook is a node**" framing across [lib/mcp/tools/cook.js](lib/mcp/tools/cook.js) — header doc, tool description, the success message, and the `get_cook` / `list_cooks` descriptions all teach the new mental model: cook materializes one outcome and is done; any ring (plan via `forge_plan` source, future audit/compose/brief surfaces) reads the cook node and acts on it. The substrate-vibe replacement for a `cook({ outlet: 'plan' })` shape that was never going to exist.
- **`RESEARCH_BRIEF` rewrite** in [lib/mcp/tools/research-mode.js](lib/mcp/tools/research-mode.js) — `enter_research_mode` now teaches the "Cook stops at cook" subsection with an explicit anti-pattern callout ("Don't look for a `cook({ outlet: 'plan' })` shape. It doesn't exist on purpose."). The Gather/Stash section is sharpened from "coexists with the legacy book" to **"prefer Gather/Stash for new gatherings"** — the typed-intake path is the only one Cook collides and the only one that lands as a first-class deliberation node other rings can read.
- **`forward_context` routing updated** in [lib/mcp/tools/context.js](lib/mcp/tools/context.js) — the `ROUTING_INDEX` "gather / research broadly" row nudges new gatherings toward `mint_stash` → `gather` → optional `cook`, and names the `forge_plan({ source })` bridge inline. The `TOOL_INDEX` entry for `forge_plan` advertises the new `source?` parameter.
- **Research path convergence plan** at [../lite-template/integration/app-system/0601/RESEARCH_PATH_CONVERGENCE.md](../lite-template/integration/app-system/0601/RESEARCH_PATH_CONVERGENCE.md) — sequencing for the larger Book→Stash collapse (legacy alias layer + read-projection + `/research` → `/stashes` redirect + streaming notebook + triangle backlinks). Substrate-side bridge ships this entry; the alias/projection layer is a follow-up.

### Added — Agent-as-inference porthole

- **Builder driver mode** — the chat builder web UI can now be driven by the operator's own agent rather than the control plane's own Claude loop. When `builderDriverMode === 'agent'`, the `/chat-builder` SSE endpoint parks each user message as a `chat_turn` task on the agent-tasks queue and awaits the agent's envelope, resolving it back over the same SSE event vocabulary the self-hosted loop uses — the browser UI is unchanged. A new **Builder** tab in [app/settings/page.jsx](app/settings/page.jsx) (`BuilderModeSection`) lets the operator toggle the mode and shows a live worker-liveness indicator. API at [app/api/settings/app/route.js](app/api/settings/app/route.js). In `self-hosted` mode the existing control-plane Claude loop runs unchanged; the 409 LLM-key guard now applies only to non-agent mode so agent mode never requires a control-plane API key.
- **`app_settings` table + `AppSettingsRepository`** in [lib/db/index.js](lib/db/index.js) / [lib/db/repositories/appSettings.js](lib/db/repositories/appSettings.js) — key/value store for single-user control-plane preferences. Absence of a key IS its fresh-install default (resolved in the repository, no seed row). First use: `builderDriverMode` (`'agent'` | `'self-hosted'`).
- **`chat_turn` task kind** in [lib/mcp/tools/agent-tasks.js](lib/mcp/tools/agent-tasks.js) — sibling to `envelope_inference`. Rides `submit_envelope_inference` (both are envelope-shaped); the `pull_agent_task` tool gains an optional `kinds` filter so a specialized chat-builder worker can claim only `chat_turn` tasks. `chat_turn` submits do **not** write a contextmap principle. Claude Code headless adapter gains `chat_turn` support with its own `CHAT_TURN_SYSTEM_PROMPT` and `buildChatTurnUserPrompt()` (conversational relay: history + locale + `inputs.text`; answer goes in the `answer` envelope field).
- **`run-chat-builder-worker` catalyst** at [lib/mcp/catalysts/run-chat-builder-worker.md](lib/mcp/catalysts/run-chat-builder-worker.md) — operating instructions for running the chat-builder worker loop (`pull_agent_task({ kinds: ['chat_turn'] })` → answer → `submit_envelope_inference`). Designed to pair with `/loop` so the web chat is live whenever the operator is in the terminal. Includes a "Talking to the operator mid-turn" section documenting `emit_chat_signal` and `request_chat_decision`.
- **Home-page chat porthole** — the home page hosts a second chat window that talks directly to the operator's host agent (no builder persona, no protocol framing — full toolset). Backed by a new `host_chat` task kind in [lib/mcp/tools/agent-tasks.js](lib/mcp/tools/agent-tasks.js) + the [app/api/agent-chat/stream/route.js](app/api/agent-chat/stream/route.js) SSE route. Paired with the **`run-host-chat-worker` catalyst** at [lib/mcp/catalysts/run-host-chat-worker.md](lib/mcp/catalysts/run-host-chat-worker.md). "A porthole straight to you" is the framing — sibling to the chat builder, without the builder framing.
- **Shared agent-chat relay** at [lib/agent-chat/relay.js](lib/agent-chat/relay.js) — the common body the chat builder (`chat_turn`) and home-page chat (`host_chat`) share. Both subscribe the open SSE stream to the agent-ui signal bus for the turn, park the turn, stream the answer back, and unsubscribe. What differs — session bookkeeping, audit, the `done` payload — is injected via callbacks so neither surface leaks into the other.
- **`HomeLauncher` component** at [components/HomeLauncher.jsx](components/HomeLauncher.jsx) — extracted home-page launcher (6-tile grid + agent status footer) so the home page can host both the launcher and the home-chat porthole side by side.
- **Agent-ui signal bus** at [lib/agent-ui/signal-bus.js](lib/agent-ui/signal-bus.js) — in-memory pub/sub keyed on the builder `sessionId` (`subscribe` / `publish` / `hasSubscriber`) plus a pending-decision registry for the reverse operator→agent path (`createDecision` / `resolveDecision` / `awaitDecision` / `disposeDecision`). Decisions auto-expire after a 10-min TTL kept deliberately under the parked turn's HTTP timeout so a stuck decision settles as `expired` before the parked HTTP does. Bus events are shaped to the existing builder SSE `EventTypes` so subscribers forward them verbatim; settled decisions are GC'd 60s after settling. In-memory only — a control-plane restart drops subscribers and settles outstanding decisions as expired.
- **MCP Ring 7 — agent-ui tools** at [lib/mcp/tools/agent-ui.js](lib/mcp/tools/agent-ui.js): `emit_chat_signal` (fire-and-forget narration — `kind:'note'` → a `text` delta into the reply bubble, `kind:'phase'` → a `modulo_expression` avatar state; returns `{ delivered }` so the worker stops emitting once the stream is closed) and `request_chat_decision` (publishes a `decision` event the UI renders as an inline card, then long-polls up to `wait_ms` ≤45s; returns `answered` / `waiting` / `expired` / `no_listener`). Both take the builder `session_id` from the pulled task's `caller_ref.sessionId`; only the interactive MCP-connected worker can call them (the headless node-fulfiller has no MCP connection).
- **`/api/agent-ui/respond` route** at [app/api/agent-ui/respond/route.js](app/api/agent-ui/respond/route.js) — the reverse path. Browser-facing (same-origin, session-cookie auth via `getCurrentUser`, unlike the bearer-gated agent surface); POSTs the operator's `{ selected | text }` answer, resolves the pending decision in the signal bus, and unblocks the worker's `request_chat_decision` long-poll. Guards that the posting session owns the decision's `sessionId`.
- **`DecisionCard` + `respondToDecision`** — [components/ModularChat/DecisionCard.jsx](components/ModularChat/DecisionCard.jsx) renders a mid-turn decision (options and/or a free-text input), then disables and shows the chosen value once answered. [hooks/useModularStream.js](hooks/useModularStream.js) gains a `decision` event handler (new `MESSAGE_TYPES.DECISION`) and the `respondToDecision(promptId, answer)` action (optimistic answer with rollback on a failed POST); [InvertedModularChatPanel.jsx](components/ModularChat/InvertedModularChatPanel.jsx) wires the card into the grouped-message renderer.

### Added — App-runtime daemon

- **App-runtime daemon** at [lib/runners/daemon/server.js](lib/runners/daemon/server.js) and engine at [lib/runners/engine.js](lib/runners/engine.js). The runner engine moves out of the control plane's process into a standalone loopback-HTTP daemon gated by `MOJULO_APP_RUNTIME=enabled`. On boot the daemon **reconciles** ([lib/runners/daemon/reconcile.js](lib/runners/daemon/reconcile.js)): for each per-app pidfile (`~/.mojulo/app-runtime/runs/<ref>.json`) it adopts (sidecar still answers) or sweeps (dead), and sweeps inventory rows whose `running_ref` has no pidfile — killing the orphan-row `UNIQUE(server, tool_name)` collision from the in-process v0. SIGTERM + SIGINT drain in-flight starts before exiting. Phase 2 (launchd/systemd keep-alive) is deferred. See [docs/app-runtime.md](docs/app-runtime.md).
- **`mojulo-app-runtime` bin** in [bin/app-runtime.mjs](bin/app-runtime.mjs) — registered in `package.json`'s `bin` field alongside `mojulo` / `mojulo-config` / `mojulo-ui`. `MOJULO_APP_RUNTIME=enabled npx mojulo-app-runtime` starts the daemon; without the flag the bin is a no-op. The control plane never auto-spawns the daemon; if the daemon is down, `start_app`/`stop_app` throw a clear `AppRuntimeUnavailableError` pointing to the bin.
- **Unified runtime daemon host** at [lib/daemons/server.js](lib/daemons/server.js) and new **`mojulo-daemons` bin** in [bin/daemons.mjs](bin/daemons.mjs). Co-hosts the app-runtime daemon and the scheduler daemon under one loopback HTTP server so a single process manages all runtime side-effects. Gated by `MOJULO_DAEMONS=enabled`; per-daemon gates `MOJULO_APP_RUNTIME` / `MOJULO_TRIGGER_RUNTIME` default to enabled inside the host. The host exposes `/health`, `/daemons` (list), `/daemons/:name/status`, and `/daemons/:name` (POST start / stop / restart). Client at [lib/daemons/client.js](lib/daemons/client.js) reads the runtime port + bearer from `~/.mojulo/daemons/{port,bearer}` written by the host on boot; `bestEffortDaemonReload(name)` sends a reload signal without throwing if the host is down. The standalone `mojulo-app-runtime` bin remains for operators who don't want the scheduler co-hosted; the in-process scheduler fallback also remains.
- **MCP Ring 7 — daemon lifecycle tools** at [lib/mcp/tools/runtime-daemons.js](lib/mcp/tools/runtime-daemons.js): `list_daemons`, `status_daemon`, `start_daemon`, `stop_daemon`, `restart_daemon`. Thin client over the unified daemon host. Registered between the runner tools and agent-tasks tools so the natural Ring 7 reading order is app lifecycle → daemon host lifecycle → agent-tasks. `list_daemons` degrades gracefully when the host is down (returns `[]`).

### Added — Connected Services (Phase 1)

- **`declare_skills`** at [lib/mcp/tools/skills.js](lib/mcp/tools/skills.js). The mirror entry point for the **Skill** member of the Connected Services paradigm: a workflow synthesized into the host adapter (`.claude/skills/<name>/SKILL.md`) that the host owns and mojulo only reflects for observation — it never writes to the host. Replace-semantic, agent-declared, sibling to `meta_context_declare_inventory` (declares the MCP servers each skill `calls`, resolved against declared inventory to mark wired vs missing, plus any unbound capability `needs`).
- **`meta_skills` table** in [lib/db/index.js](lib/db/index.js) (repository at [lib/db/repositories/skills.js](lib/db/repositories/skills.js)) — replace-semantic mirror of host skills: `ref` (deterministic from `host_path` so re-mirroring is idempotent), `name`, `description`, `host_path`, `host_adapter`, `catalyst_id` (lineage if synthesized from a catalyst), `calls_json`, `needs_json`, `mirrored_at`. `declare()` is a DELETE-all + INSERT-set transaction.
- **Connected Services loader** at [lib/connected-services/loader.js](lib/connected-services/loader.js): `listConnectedServices()` / `getConnectedService(ref)`. The **canonical union view** — projects the skills mirror (kind `skill`) ∪ materialized mcp-orbit compositions (kind `mcp_solution`) into one shape, resolving each service's `calls` against the current MCP inventory (wired vs missing). Uncapped reads straight from the repositories, same posture as [lib/apps/loader.js](lib/apps/loader.js). The contract every downstream viewer consumes; defined here and projected, never redefined downstream.
- **Connected Services list / detail APIs** at [app/api/connected-services/route.js](app/api/connected-services/route.js) (list) and [app/api/connected-services/[ref]/route.js](app/api/connected-services/[ref]/route.js) (detail) — HTTP-facing projection of the canonical loader.
- **Connected Services topology** at [lib/graph/derivers/connected-service.js](lib/graph/derivers/connected-service.js) + [lib/graph/layout/connected-service.js](lib/graph/layout/connected-service.js) — pure projection from a canonical service shape into a `{ nodes, edges }` topology rendered through the existing `CreationMap`. Used by the per-service `/graph` view.
- **`/mcp-skills` surface.** [app/mcp-skills/page.jsx](app/mcp-skills/page.jsx) is the list view; [app/mcp-skills/[ref]/page.jsx](app/mcp-skills/[ref]/page.jsx) is the per-service detail pane; the per-service graph at `[ref]/graph/` renders the topology via the new deriver + layout pair. The previous Coming Soon stub graduates into the live Connected Services viewer.
- **Fleet scene + Map view** — a live topology of the full connected workspace. [lib/fleet-scene/loader.js](lib/fleet-scene/loader.js) assembles the view model (apps, bots, declared MCP servers, Connected Services) from existing repositories with no new DB I/O. [lib/graph/derivers/fleet-scene.js](lib/graph/derivers/fleet-scene.js) projects to a `{ nodes, edges }` topology (four existing station kinds: apps → `filesystem`, bots → `db_row`, servers → `mcp_tool`, services → `input`; framing-gated edge kinds: `exposes` for the stratified `/map` view, `exposes` + `calls` for the bipartite per-service web). Layout via the new slot-based [lib/graph/layout/](lib/graph/layout/) pass. Renders at [app/map/page.jsx](app/map/page.jsx) through the existing `CreationMap`; API at [app/api/connected-services/graph/route.js](app/api/connected-services/graph/route.js) with `?framing=map`. Read-on-refresh; nothing persisted.

### Added — Sketchbook (the planning surface, scratch)

- **Sketch folders** — [lib/db/repositories/sketch-folders.js](lib/db/repositories/sketch-folders.js) + a `folder_ref` column on `sketches`. Folders are a flat scratch-grouping over sketches; no nesting. APIs at [app/api/sketches/folders/route.js](app/api/sketches/folders/route.js) (list + create) and [app/api/sketches/folders/[ref]/route.js](app/api/sketches/folders/[ref]/route.js) (single fetch + delete), plus [app/api/sketches/move/route.js](app/api/sketches/move/route.js) for moving a sketch between folders. Per-folder sketch counts shown as badges so the operator can see folder density at a glance.
- **SVG export** at [app/api/sketches/[ref]/svg/route.js](app/api/sketches/[ref]/svg/route.js) — renders the stored manifest to a fully self-contained `.svg` via `CreationMap` + `renderToStaticMarkup`. CSS custom properties are resolved to literal hex/families so the file is portable to vector tools and image viewers that don't honor `var(...)`. `?inline=1` serves inline instead of forcing a download.
- **Sketch diff** at [lib/graph/sketch-diff.js](lib/graph/sketch-diff.js) — pure derived visual diff of two sketch manifests (no DB, no MCP, no renderer dependency). Exposed via the **`diff_sketches`** MCP tool — the agent reads two sketches, the tool returns a third manifest highlighting added / removed / changed / moved / unchanged stations, then persists through the normal sketchbook path.
- **Sketch vocab catalog** at [lib/graph/sketch-vocab/](lib/graph/sketch-vocab/) — markdown specs for each chart kind (`donut-ring`, `grid-layout`, `map-boundary`, `pipeline`, `stacked-bar`, `stat-tile`, `z-layering`). Loader at [lib/graph/sketch-vocab/loader.js](lib/graph/sketch-vocab/loader.js) feeds two consumers: the **`get_sketch_vocab`** MCP tool (the agent fetches vocab on demand rather than memorizing it) and a new `sketch_vocab` kind in `semantic_search` so the agent can pull the right vocab by intent.
- **Deterministic sketch derivation** at [lib/graph/sketch-derive.js](lib/graph/sketch-derive.js) — pure functions (no DB, no LLM) that turn structure into a sketch manifest: `planToSketchManifest` draws a compiled plan as a left→right pipeline (goal `input` station → one `mcp_tool` station per manifest call, chained in order), `researchToSketchManifest` draws a research / cook book as a hub-spoke (each bound item is a spoke feeding the central thesis `db_row`, capped at the 24 most recent with a "+N earlier" note). Emits the same manifest shape `validateSketchManifest` accepts and `/sketches/<ref>` renders. Coupling stays one-way — plan / research / cook import this + the sketch persister; sketches never import them.
- **`mintSketch()` shared persist seam** in [lib/mcp/tools/sketches.js](lib/mcp/tools/sketches.js) — the validate-and-store core (returns `{ ok, ref, url }`) extracted out of `createSketchHandler` so the plan-mode / stash-mode auto-mint path gets the same validation + ref + URL shape as a hand-authored `create_sketch`. `createSketchHandler` now wraps it.
- **Rendrant — the agent's visual planning layer** at [lib/graph/polygonizer/](lib/graph/polygonizer/) + [lib/graph/neo-rembrandt/](lib/graph/neo-rembrandt/) + [app/api/polygonizer/route.js](app/api/polygonizer/route.js). The agent describes a visual intent; Rendrant returns a sketch manifest (constellation grid + depiction layout + recipe compiler + neo-rembrandt rendering passes for cuboids, perspective, palette). Shipped as a **planning tool inside the sketchbook** — the manifests it produces are stored as ordinary sketches and treated as scratch. Not part of the deliberation rings.

### Added — Ring 0 drawer tools

- **Ring 0 drawer tools** in [lib/mcp/tools/context.js](lib/mcp/tools/context.js): `get_tool_index` / `get_register_kit` / `get_deliberation_overview` / `get_ui_map` / `get_substrate`, registered as siblings right after `forward_context`. `forward_context` becomes a **thin routing index** — a lean opener, a `user-framing → entry-tool` table (`ROUTING_INDEX`), a directory of the drawers, and the standing safety + commitment rules. The heavy content moves into the drawers, each pulled on demand: `get_tool_index` (the full one-line-per-tool `TOOL_INDEX` across every ring), `get_register_kit` (the concept glossary in the operator's active `vocabulary_register` + the disclosure directive + the commitment-level floor — the vocabulary now lives here, optional per-call `register` / `disclosure` override), `get_deliberation_overview` (the Ring 6 structural model + daemon runtime-gating posture), `get_ui_map` (the `mojulo-ui` dashboard page map), `get_substrate` (the PLAYful Cloud positioning). "Index, not glossary" is load-bearing — the glossary, lifecycle prose, and substrate philosophy stay out of the `forward_context` body.

### Added — Dev tooling

- **`gen-app.js` scaffold script** at [scripts/gen-app.js](scripts/gen-app.js) — generates a minimal mojulo app wired to one primitive end-to-end via agent-routed inference, with no hosted LLM API key required (the Claude Code agent is the inference engine via the `run-inference-worker` catalyst). Accepts `--name <slug>`, `--primitive <type>` (`document-store` / `structured-record-store` / `messaging-channel` / `message-thread`), `--out <dir>`, and `--wire` (bakes `MOJULO_CONTROL_PLANE_URL`/`KEY` into the app's `.env` from the current process env). Dev / onboarding tooling; not part of the shipped runtime package.
- **`find-unused-locale-keys` dev tooling** — repo-side garbage collector for the i18n catalog: [scripts/find-unused-locale-keys.mjs](scripts/find-unused-locale-keys.mjs) (conservative static analysis of next-intl translator usage — protects dynamically-built key prefixes, zero false positives by design) driven by the `/find-unused-locale-keys` skill. Reports first; deletes from `en.json` only on confirmation, then `/sync-locales` propagates the removals. Dev-only; not part of the shipped runtime.

### Changed

- **`LocalRunner` promoted to daemon client** in [lib/runners/local.js](lib/runners/local.js) — lifecycle verbs (`start` / `stop` / `status` / `list`) now proxy to the standalone app-runtime daemon over loopback HTTP, reading the daemon's `port` + `bearer` from `~/.mojulo/app-runtime/{port,bearer}` before each call. Env CRUD (`listEnv` / `setEnv` / `deleteEnv`) deliberately stays local — pure `.env` filesystem work with no shared runtime state. Reads degrade gracefully when the daemon is unreachable (`list_running → []`, `status_app → 'unknown'`); writes throw `AppRuntimeUnavailableError`.
- **`pull_agent_task` kinds filter** in [lib/mcp/tools/agent-tasks.js](lib/mcp/tools/agent-tasks.js) — optional `kinds: string[]` input. Enables specialized workers (chat-builder claims `chat_turn`; host-chat claims `host_chat`; inference claims `envelope_inference`) without task-kind collisions.
- **`submit_envelope_inference` services `chat_turn` + `host_chat`** — `ENVELOPE_SHAPED_KINDS` set grows; both new kinds skip principle recording (run-rate conversational turns, not structural outcomes).
- **`chat_turn` + `host_chat` skip principle recording in node-fulfiller** in [lib/agent-tasks/node-fulfiller.js](lib/agent-tasks/node-fulfiller.js). The fulfiller gates `recordInferenceOutcome` on the task kind, matching the existing gating in the MCP submit handler.
- **MCP server tool registration order** in [lib/mcp/server.js](lib/mcp/server.js) — `registerSkillsTools()` slots immediately after inventory; `registerAgentUiTools()` slots immediately after the agent-tasks tools (the chat worker's narration + decision surface, keeping the Ring 7 reading order pull → submit → cancel → emit → decide); `registerPlanModeTools()` slots after Ring 7; `registerResearchModeTools()` / `registerStashModeTools()` / `registerCookTools()` slot after plan mode (v1 then v2; research forges Draft plans, so plan tools exist first).
- **`runAgentChatTurn` subscribes the open SSE stream to the signal bus** in [app/api/builder/stream/route.js](app/api/builder/stream/route.js) and the shared [lib/agent-chat/relay.js](lib/agent-chat/relay.js) — for the duration of the turn, worker narration + decision prompts forward verbatim to the browser over the same `EventTypes`; unsubscribed in a `finally` before the controller closes. The parked turn's `submitTimeoutMs` is widened 180s → 900s (15 min) so the parked HTTP outlives an in-flight decision (10-min TTL) rather than expiring under the operator mid-choice.
- **`meta_context_brief({kind:'fleet'})` gains Ring 8 plan summary** — plan count by status appended to the fleet brief so the agent gets a lightweight signal about pending plans without a separate `list_plans` call.
- **`bind_trigger` / `unbind_trigger` dual-signal scheduler reload** in [lib/mcp/tools/mcp-trigger-binding.js](lib/mcp/tools/mcp-trigger-binding.js). Both handlers now call `signalSchedulerReload()` which fires both the in-process `requestSchedulerReload()` (effective when the control-plane hosts the scheduler) and `bestEffortDaemonReload('scheduler')` on the unified daemon host. Best-effort — if the daemon host is down the signal is a no-op and the binding row remains durable for the next boot.
- **Agent-tasks puller liveness signals** in [app/api/agent-tasks/status/route.js](app/api/agent-tasks/status/route.js). The status endpoint surfaces `waitingPullers`, `recentPullCount`, and `lastPullAt` alongside the existing `pendingCount` / `inFlightCount` / `fulfiller`. The `BuilderModeSection` worker-liveness indicator reads all three fields to show "live" only when a real puller is connected, not just the background daemon.
- **`CreationMap` clickable nodes and layer ordering** in [components/graph/CreationMap.jsx](components/graph/CreationMap.jsx). New `onNodeClick` prop — when a station carries `href` and `onNodeClick` is provided, the station renders as an accessible link. Layer ordering: stations are stable-sorted by `layer` before paint so `layer:'air'` stations always render above `layer:'ground'` — keeps `/graph` and `/sketches` pixel-identical while the fleet scene's two-plane layout paints correctly. New `elevation` SVG filter for air-layer stations.
- **Bots page deep-link from map** in [app/bots/page.jsx](app/bots/page.jsx). The page reads `?id=` from the query string and pre-selects that deployment in the detail pane as soon as the `/api/deployments` list resolves. Enables `/map` bot nodes to carry `href=/bots?id=<deployment_id>` and deep-link straight to the detail pane.
- **`isSchedulerRunning()` exported** from [lib/triggers/scheduler.js](lib/triggers/scheduler.js) — returns the boolean `started` flag. Consumed by the unified daemon host to surface scheduler status in `status_daemon` responses; also useful for health checks.
- **`InventoryRepository.listAppRunningRefs()`** added in [lib/db/repositories/mcp-inventory.js](lib/db/repositories/mcp-inventory.js) — returns the distinct `running_ref`s that currently have app inventory rows, each with server name + tool count. Consumed by the daemon's reconcile-on-boot to decide adopt vs sweep.
- **`principle-embeddings.js` extracted** from [lib/mcp/tools/meta-context.js](lib/mcp/tools/meta-context.js) into [lib/mcp/meta-context/principle-embeddings.js](lib/mcp/meta-context/principle-embeddings.js) — the async pre-embedding pass (batch distinct bodies before the sync transaction) now lives alongside the plan-release bridge rather than inline in the commit handler.
- **Rendrant guide-bound cuboids** in [lib/graph/neo-rembrandt/index.js](lib/graph/neo-rembrandt/index.js) — guide-binding for shelves and datacenter rows so cuboids snapped to constellation guides don't flare open. The opt-in `solidProjectionMode: "constellation-hit-cuboid"` resolves the eight named CCA hit points first and then skins the six cuboid faces from that coordinate lattice. Focused coverage in `index.test.js` guards structural guide binding, top guide binding, no-flare paired-edge propagation, and hit-point-first face skinning. (Internal to the sketchbook's planning layer; not part of the substrate.)
- **Branding: "Mojulo-Lite" → "Mojulo"** throughout source code. Comments, user-facing strings, auth service email (`local@mojulo`), MCP session binding workspace name ("Mojulo Control"), builder system prompt, deploy route comment, doc-string references updated. No functional change.
- **`initialize` preamble rewritten** in [lib/mcp/server.js](lib/mcp/server.js) — `SERVER_INSTRUCTIONS` now leads with mojulo's software primitives (stateful MCP server + process supervisor) and names the three creatable artifacts with their entry tools (Bot → `start_new_bot`; Connected Service → `get_catalyst` or the mcp-orbit path; App → `install_scaffold` → commit → `start_app`), then points at `forward_context` as a cheap routing index. Replaces the prior two-axes framing + inline dashboard pitch. Budgeted ~180–200 words, paid once per session by every connecting agent.
- **`forward_context` reframed to a thin routing index** in [lib/mcp/tools/context.js](lib/mcp/tools/context.js) — its tool description and body advertise the drawer directory instead of carrying the full glossary / lifecycle / substrate prose; the disclosure directive still branches on the operator's `procedural_disclosure`, but the register-varying glossary moves to `get_register_kit`. `context.test.js` updated to the new index/drawer shape.
- **`install_scaffold` description gains App-paradigm entry framing** in [lib/mcp/tools/runner.js](lib/mcp/tools/runner.js) — leads with "**Entry point for the App paradigm**" plus the user-framings that route to it and the `install_scaffold → meta_context_commit({type:'app_materialization'}) → start_app` path, so the tool self-routes from `tools/list` without the agent needing `forward_context` first.
- **Docs follow the drawerization** — [CLAUDE.md](../CLAUDE.md)'s Ring 0 description and [docs/MCP-ARCHITECTURE.md](../docs/MCP-ARCHITECTURE.md) §2 now describe `forward_context` as a thin routing index over the five sibling drawers, and note that a new tool must update both `TOOL_INDEX` and `ROUTING_INDEX` in [context.js](lib/mcp/tools/context.js).
- **`find-unused-locale-keys` GC run on `en.json`** — the dev-tooling garbage collector ran: ~900 lines of dead keys across no-longer-referenced namespaces (`auth`, `actions`, `deployments`, `analytics`, `logs`, `accessLevels`, `errors`, `deleteAccount`, `botSpaceInvite`, `auditLog*`, plus dead `dashboard.*` / `common.*` leaves) are removed.
- **i18n catch-up across the cycle's surfaces** in [messages/en.json](messages/en.json) — `home.*` (tile launcher + agent status), `sketches.*` / `sketchesIndex.*` + folder strings, `breadcrumbs.*`, `mcpSkills.*`, app-graph strings, `dashboard.dataLink`, `plan.*`, `research.*`, `chatBuilder.decision.*`, `stash.*` / `cook.*`, `outcomes.*` all land here. [messages/sv.json](messages/sv.json) brought back in sync via `/sync-locales`.

### Notes

- **No bot image bump.** All changes are control-plane.
- **Additive migrations.** New tables: `app_settings`, `plans`, `meta_skills`, `research_sessions`, `research_items`, `research_abstracts`, `stashes` (+ drawer / gathered-items shape), `cooks`, `sketch_folders`. Migration-added columns: `archived` / `archived_at` / `release_json` / `sketch_ref` / `sketch_pinned` on `plans`; `sketch_ref` on `research_abstracts`; `folder_ref` on `sketches`. No data rewrites.
- **App-runtime daemon is opt-in.** `MOJULO_APP_RUNTIME=enabled` is required when running the standalone `mojulo-app-runtime` bin; set `MOJULO_DAEMONS=enabled` instead to use the unified `mojulo-daemons` host (recommended — it co-manages the scheduler too). Without either, existing `start_app` / `stop_app` calls throw `AppRuntimeUnavailableError`. Upgrade path: start the daemon once; it reconciles any processes that survived from a prior in-process run.
- **Unified daemon host is the recommended runtime posture** for operators who use both the app-runtime and the trigger scheduler. The standalone `mojulo-app-runtime` bin and the in-process scheduler fallback (in `lib/db/index.js`, gated by `MOJULO_TRIGGER_RUNTIME`) remain for backward compatibility and standalone / split-process deployments.
- **Plan→contextmap close-the-loop ships in this entry.** The prior patch entry's Note about deferral is superseded: `plan-release.js` + the `archived` columns land here.
- **Research mode v1 ships and is now legacy.** The original `research_*` tools work as-is and remain wired; **new gatherings should use stash mode** (migration option 3 — legacy data is untouched, new data lands in `stashes` + gathered-items). The cook→plan bridge lives on the plan side via `forge_plan({ source: { kind: 'cook', cook_ref } })` — cook stops at cook, and any ring that wants to deliberate on a cook output reads it via `get_cook` / `list_cooks`. `synthesize_abstract` remains the Book→plan bridge for legacy research books.
- **Outcome Artifacts are frozen to the template version** they were authored against. Bumping `TEMPLATE_VERSION` does not regenerate existing outcomes — they stay as documents at their original version (recorded in `manifest.json`).
- **Sketch posterity keeps sketches scratch.** Plan compile and stash cook auto-mint a diagram, but the link is a pointer column (`sketch_ref`), not contextmap integration — auto-mint is soft-fail and an operator pin (`sketch_pinned`) is never clobbered. Sketches still aren't structural commits.
- **Rendrant is a planning tool, not a substrate surface.** It lives inside the sketchbook and produces ordinary sketch manifests. If a Rendrant output earns a durable place later, it graduates explicitly through a Ring 6 surface, not by feature-creep on the sketchbook.
- **Dashboard is not a conversational surface.** Mid-cycle we explored wiring `HomeAgentChat` into the home page and the `/plan` and `/research` detail panes, plus an inline iteration chat into `/sketches`. We've since formalized the inverse posture: the dashboard renders state and offers "New plan / New stash / New sketch" modals with paste-able host-agent starter prompts. The **chat builder** and the **home-page chat** remain as deliberate exceptions — both are framed as **portholes to the operator's host agent** (not chats with the substrate), and both route through the agent-tasks queue. A pair of golden rules lands in [CLAUDE.md](../CLAUDE.md): the MCP transport binds to localhost (no tunneling — the substrate has no auth layer and assumes loopback-only reachability), and dashboard surfaces do not host conversational chat with the MCP agent except via the porthole pattern. The shared backend (`/api/agent-chat/stream`, `host_chat` task kind, `lib/agent-chat/relay.js`) is the load-bearing primitive; fork-hackers wiring their own UI surface have a working hook to start from.
- **`forward_context` drawerization is backward-compatible.** Existing agents that call `forward_context` still get a coherent orientation (now a routing index); the five drawer tools are additive — an agent that never pulls them loses depth, not correctness. Most `tools/list` descriptions self-route, so the common path doesn't drill further.
- **Builder driver mode is additive and opt-in.** Fresh installs default to `self-hosted` (existing behavior unchanged). Switching to `agent` requires the operator to run the chat-builder worker loop (`run-chat-builder-worker` catalyst) in their host agent. The `self-hosted` path is unchanged end-to-end.
- **i18n synced this cycle.** Both `en.json` and `sv.json` are up to date; future locale additions should run `/sync-locales` against the new keys.
- **Going forward.** This entry is sealed as the comprehensive snapshot of the cycle that brought materialization + agent-as-inference online. Subsequent in-flight work — even still `Unreleased` — opens a new section above this one rather than appending here.

### 2026-05-27 (was "Unreleased (patch)")

The follow-up patch on 0.8.0's app substrate plus the **UI refactor that lets the new primitives breathe**. The dashboard's bot-centric home page assumed mojulo only built one kind of thing; 0.8.0 added apps and 0.9.0 added trigger-binding, and the home page didn't move with them. This patch reshapes `/` into a six-tile launcher (Bots / MCP+Skills / Apps / Sketch / Plan / Settings) and moves the prior bot-detail surface to `/bots`. Two new agent-facing surfaces ride along: a **sketchbook** (the operator agent mints flow-charty diagrams via a new `create_sketch` MCP tool that reuse the existing `CreationMap` renderer) and a **per-app derived graph view** (`/apps/<ref>/graph` projects an app's contextmap node + bindings + active triggers into a topology, lays it out via slot-based geometry, and renders it through the same compact-mode `CreationMap`). On the substrate side, two small follow-ups land: the app-MCP scaffold optionally seeds the app's `.env` with its own MCP bearer + URL + materialization ref (opt-in, bearer never crosses the response), and the apps loader stops routing reads through the agent-capped fleet brief.

The shared posture across the surfaces: **one renderer, three call sites.** [CreationMap.jsx](components/graph/CreationMap.jsx) already drove the curated `/graph` page; this patch grows it (four-sided `via` routing, `curvature` multiplier on the default S-curve, `compact` type-scale preset, label pills elevated via drop-shadow) and the new per-app graph + sketchbook surfaces consume it without a parallel SVG layer. The sketchbook is deliberately *not* integrated into `forward_context` / Ring 6 / the contextmap — sketches are scratch visualizations, not structural decisions; the agent discovers `create_sketch` through `tools/list` and earns its place if the surface proves out.

### Added

- **Home page tile launcher** at [app/page.jsx](app/page.jsx). Replaces the bot list/detail UI with a 2×3 grid of workspace tiles (Bots / MCP + Skills / Apps / Sketch / Plan / Settings). Each tile links to its surface; the old bot management surface moves to [app/bots/page.jsx](app/bots/page.jsx) intact. Brand identity in chrome: [AuthNav.jsx](components/AuthNav.jsx) swaps the line-art home icon for the actual favicon (3-card stack with teal gradient) and drops the inline Apps / Graph / Data nav links — discoverability lives in the launcher now. The Data link moves under `dashboard.dataLink`; consumers like the deployments pages still link to `/data` directly.
- **Agent status footer** on the home page ([app/page.jsx](app/page.jsx) `AgentStatus` component) backed by **[app/api/agent-status/route.js](app/api/agent-status/route.js)**. Surfaces the connected operator agent's harness name + version + session count (via the new [getAllClientInfo()](lib/mcp/client-bindings.js) accessor on the live MCP client bindings table) and the declared inventory's server + tool counts + age. Green dot when a session is currently connected *or* inventory was declared in the last 5 minutes; amber for older snapshots. Polls every 15s via SWR; renders nothing on a fresh install with no agent ever attached.
- **Sketchbook (`create_sketch` MCP tool)** at [lib/mcp/tools/sketches.js](lib/mcp/tools/sketches.js). The operator agent POSTs a manifest (same vocab as the curated `/graph` map — stations with explicit x/y/w/h, kinds `input` / `mcp_tool` / `filesystem` / `db_row`, edges with optional `via` + `curvature`) and gets back `{ ok, ref, url }`. The URL resolves to a viewer at [app/sketches/[ref]/page.jsx](app/sketches/[ref]/page.jsx); the index at [app/sketches/page.jsx](app/sketches/page.jsx) is a list-with-preview surface (search by title/ref, fullscreen-toggle). Manifest validator at [lib/graph/sketch-manifest.js](lib/graph/sketch-manifest.js) (shape check + station-id uniqueness + edge endpoint resolution + curvature clamps). Repository at [lib/db/repositories/sketches.js](lib/db/repositories/sketches.js) mints `sk_<10-char>` refs by default; user-supplied refs accepted. API surface at [app/api/sketches/route.js](app/api/sketches/route.js) (list) and [app/api/sketches/[ref]/route.js](app/api/sketches/[ref]/route.js) (single fetch). [AuthNav.jsx](components/AuthNav.jsx) hides surrounding chrome on `/sketches/*` routes so the agent can hand the user a bare URL and the diagram fills the viewport. See [lite-template/integration/app-system/0527/SKETCHBOOK_PLAN.md](../lite-template/integration/app-system/0527/SKETCHBOOK_PLAN.md).
- **`sketches` table** in [lib/db/index.js](lib/db/index.js) — `id`, `ref` (UNIQUE), `title`, `manifest_json`, `created_at`. Plus an index on `created_at DESC` so the list page's recency sort is cheap. Additive migration; no data rewrite. Deliberately separate from the contextmap stack — sketches are scratch, not commits.
- **Per-app graph view** at [app/apps/[ref]/graph/page.jsx](app/apps/[ref]/graph/page.jsx). For any materialized app, projects the contextmap node + four bindings (runner / durability / inference / mcp_self) + active triggers + aggregated `app_inference` / `trigger_firing` principle counts into a `{ nodes, edges }` topology via the pure [lib/graph/derivers/app.js](lib/graph/derivers/app.js) deriver, then lays it out via [lib/graph/layout.js](lib/graph/layout.js)'s slot-based geometry. Renders through the existing `CreationMap` in `compact` mode. Read-on-refresh; never persisted. API at [app/api/apps/[ref]/graph/route.js](app/api/apps/[ref]/graph/route.js). The split deriver / layout pair is the substrate for future entity-kind graphs (MCPs, bots, compositions reuse the same layout pass).
- **`CreationMap` renderer enhancements** in [components/graph/CreationMap.jsx](components/graph/CreationMap.jsx). Four-sided `via` routing (added `left` / `top` / `bottom` to the previously right-only channel router) so edges in either lane orientation can route around stations sitting in between. New `curvature` prop on edges (0.2 – 3, default 1) multiplies the default S-curve's control-point offset — swoop wider when the straight line slices through territory, flatten for short hops. New `compact` prop swaps the type scale (font sizes, paddings, pill height) to a tighter preset used by the derived per-app graph. Label pills now elevate via a small drop-shadow filter instead of a faint outline, so chips read as lifted tokens rather than inline gaps.
- **Stub pages** for [app/mcp-skills/page.jsx](app/mcp-skills/page.jsx) and [app/plan/page.jsx](app/plan/page.jsx) — coming-soon placeholders that round out the home tile grid without claiming surfaces that haven't shipped yet. New `mcpSkills.*` and `plan.*` namespaces in [messages/en.json](messages/en.json).
- **`wire_control_plane_key` opt-in on `install_scaffold`** in [lib/app-mcp-scaffold/install.js](lib/app-mcp-scaffold/install.js) and [lib/mcp/tools/runner.js](lib/mcp/tools/runner.js). When `true`, the control plane writes `MOJULO_CONTROL_PLANE_URL`, `MOJULO_CONTROL_PLANE_KEY`, and `MOJULO_APP_REF` into the app's `.env` from its own process env (`CONTROL_PLANE_MCP_KEY` / `CONTROL_PLANE_URL`). The bearer never crosses the tool's response — only the three `*_wired` booleans confirming what landed on disk. Idempotent: existing values are left intact (operator may have set them intentionally). Default `false` — pre-0.8.1 behavior is byte-identical without the flag. Test coverage in [install.test.js](lib/app-mcp-scaffold/install.test.js) pins all four paths (default off, on + key set, on + key unset, idempotent re-run).

### Changed

- **Bot management surface moves to `/bots`** ([app/bots/page.jsx](app/bots/page.jsx)) — same list / detail / connect-modal / embed surface that previously rendered at `/`. The home page now hosts the workspace launcher described above. Dashboard subpages ([dashboard/page.jsx](app/dashboard/page.jsx), [conversations](app/dashboard/deployments/[id]/conversations/page.jsx), [submissions](app/dashboard/deployments/[id]/submissions/page.jsx), [cloud-deploy](app/dashboard/deployments/[id]/cloud-deploy/page.jsx)) update their "back" links to point at `/bots`.
- **Apps loader bypasses the brief cap** in [lib/apps/loader.js](lib/apps/loader.js). `listApps()` and `getApp()` previously read app nodes via `MetaContextRepository.brief({kind:'fleet'})`, which is capped by design — the brief is the *agent's reading window*, not a ground-truth fetch. UI surfaces (`/apps`, the new `/graph` overlay, the apps loader's API consumers) want uncapped state. Switches to `MetaNodeRepository.listByKind('artifact')` + `InventoryRepository.currentInventory()` directly. New regression test in [loader.test.js](lib/apps/loader.test.js) seeds 600 app nodes and asserts every one comes back.
- **MCP server tool registration order** in [lib/mcp/server.js](lib/mcp/server.js) — `registerSketchTools()` slots after `registerAgentTaskTools()`. Sketches are deliberately outside the Ring 6 deliberation stack (not woven into `forward_context`); they sit at the tail of `tools/list` so the agent discovers them through the protocol surface rather than the orientation tool.

### Fixed

- **Filesystem capability seed self-citation** in [lib/mcp/seeds/mcp-capabilities/filesystem.md](lib/mcp/seeds/mcp-capabilities/filesystem.md). The `<!-- sources -->` block cited `mojulo://CHANGELOG#v0.7.0` but the seed shipped in 0.8.0; the citation now matches the version that actually introduced it.

### Notes

- **No bot image bump.** All changes are control-plane.
- **One additive migration.** New `sketches` table with one supporting index; no data rewrite, no column changes elsewhere. The apps-loader switch and the `wire_control_plane_key` flag are read-path / additive-input changes against existing tables.
- **Bearer posture preserved.** `wire_control_plane_key` was deliberately designed so the bearer never crosses the MCP tool's response value — the control plane writes its own key to the app's `.env` server-side; the app reads it from disk at boot. The static-per-app `APP_MCP_BEARER` policy from 0.8.0 is unchanged.
- **Sketches stay outside the contextmap on purpose.** They aren't structural commits; they're scratch visualizations. If a sketch surface earns a durable place later (e.g. attaching one to a materialization principle as a structural overlay), it graduates explicitly through a Ring 6 surface — not by gradual feature-creep on the sketchbook table.
- **Per-app graph derives, never persists.** Every `/apps/<ref>/graph` request walks the contextmap node + inventory + triggers fresh. There is no derived-graph cache row; rename a binding, restart a trigger, and the next refresh shows it.

### 2026-05-27 (was "Unreleased")

The release where mojulo's typed shapes become **more legible** — both to the operator (a new graph view at `/graph` that visualizes the app-creation paradigm) and to itself (composer-anchored runtime for the `trigger` axis: every activation binding references a typed component by ref, so the contextmap's audit chain walks back to *which shape* was bound, not just that something was bound). Capability growth slows here on purpose; the substrate has accreted Rings and surfaces across several quiet releases (0.5.0 primitives + capabilities; 0.6.0 semantic recall; 0.7.0 register tuning; 0.8.0 apps + local-storage). 0.9.0 lets the operator see what mojulo has become — at design time (the graph view) and at runtime (autonomous firing whose every fire leaves a `trigger_firing → app_inference` chain on the artifact node).

The first half — **`trigger` axis runtime**. Where 0.5.0 made the `mcp` axis operational via [bind_primitives](lib/mcp/tools/mcp-primitive-binding.js) — resolving a typed primitive against an operator's runtime-introspected tools — this release does the same for activation. A typed trigger component (Phase 1 ships `trigger/scheduled@0.1.0`) becomes the materialization target for a runtime daemon that fires at the operator's declared cadence. Composer goes from 1-of-5 axes operational to 2-of-5; the path for `pattern` / `idempotency` / `render` is now the same shape repeated *when those axes need runtime binding* — some may stay declarative because they aren't operator-environment-specific the way `mcp` and `trigger` are.

The second half — **the app-creation graph view at `/graph`**. A hand-curated declarative manifest of the App paradigm's creation flow ([control/lib/graph/creation-map.js](lib/graph/creation-map.js)) renders as a two-lane vertical map of stations (operator inputs / MCP tools / outputs) and edges (which tools consume which inputs and produce which outputs). The manifest is validated at render time against the live MCP registry + contextmap schema enums ([control/lib/graph/validate.js](lib/graph/validate.js)) — if the manifest references a tool that's been renamed or a node kind that's been retired, the page surfaces the divergence rather than rendering a quietly-out-of-date picture. Bi-register, per 0.7.0's register tuning: a "Technical" toggle in the toolbar swaps every station's labels between the codebase's exact tool names + payload shapes and the operator-facing translation ("Which generator to use" / "A name for the app" / "Where it lives on disk"). The page exists to make the substrate's structural decisions visible without requiring the operator to read MCP tool descriptions — a small step toward the substrate looking at itself in human terms.

The trigger-binding half deliberately ships **without** an applied first artifact. Per the posture captured in [TRIGGER_BINDING_PLAN.md](../lite-template/integration/app-system/0526/TRIGGER_BINDING_PLAN.md), each release plants one substrate axis; the demonstrated closed-loop artifact arrives when enough axes are operational to make a single artifact worth pointing at. Operators wanting to apply trigger-binding today can: `bind_trigger({component_ref:'trigger/scheduled@0.1.0', ...})` against a previously-materialized app artifact with `MOJULO_TRIGGER_RUNTIME=enabled` set.

The load-bearing posture across both halves is **composer-anchored runtime**: when a deliberation surface goes operational, it resolves against the composer's typed components, never a parallel enum. `bind_trigger` takes a `component_ref` and resolves it via `MCPOrbitComponentRepository.findByRef`; adding a new trigger kind = ship a typed component in [mcp-orbit-components/trigger/](lib/mcp/mcp-orbit-components/trigger/) plus its runtime daemon. The bind tool needs no per-kind code branch beyond the schema validator the component declares. This preserves the contextmap's audit chain: every binding row + every commit principle references the typed component by ref. The graph view enacts the same principle on the UI side — the manifest cites tool names + node kinds the schema actually exposes; render-time validation enforces it.

### Trigger-binding substrate (Ring 6)

The `trigger` axis becomes operational through a sibling shape to `bind_primitives`. A typed component → runtime-bound artifact → audit principle. Same shape as the primitive-binding layer; the agent's mental model carries forward without per-axis surprises.

#### Added

- **Ring 6 — Trigger binding tools** at [lib/mcp/tools/mcp-trigger-binding.js](lib/mcp/tools/mcp-trigger-binding.js): `bind_trigger`, `unbind_trigger`, `list_triggers`, `get_trigger`. `bind_trigger` accepts `{ component_ref, binding_params, payload_template, artifact_ref, composition_ref? }`. Composer-anchored ref resolution at bind time — unknown components, non-trigger kinds, and components whose runtime isn't shipped (e.g. `trigger/signal-polled@0.1.0` typed in 0.5.0 but its daemon ships in Phase 3) all reject with clear messages. Schedule-kind validation parses `binding_params.cron` via croner upfront, so invalid expressions fail at bind time, not at first fire. Returns `{ trigger_ref, component_ref, artifact_ref, principle_id, next_fire_at }`.
- **`mcp_orbit_trigger_artifacts` table** in [lib/db/index.js](lib/db/index.js) — sibling to `mcp_orbit_provider_artifacts`. Carries `trigger_ref` (PK), `component_ref`, `binding_params_json`, `payload_template_json`, `composition_ref` / `artifact_ref` (nullable), `enabled`, `superseded_by`, `created_at`. Unique partial index on `(COALESCE(composition_ref,''), COALESCE(artifact_ref,''), component_ref) WHERE enabled = 1 AND superseded_by IS NULL` — load-bearing COALESCE so two same-target bindings with null `composition_ref` correctly collide (SQLite's default UNIQUE treats NULL as distinct from NULL, which would let duplicates slip past). Repository at [lib/db/repositories/trigger-artifacts.js](lib/db/repositories/trigger-artifacts.js) with `insert` / `getByRef` / `listActive({componentRef, compositionRef, artifactRef})` / `disable`.
- **`trigger_artifact_materialization` commit event type** in [lib/mcp/tools/meta-context.js](lib/mcp/tools/meta-context.js). Resolves the trigger artifact by ref and writes an audit principle on the target artifact node summarizing the binding (component_ref, binding_params, payload_template). Phase 1 requires the trigger to carry an `artifact_ref` — composition-only triggers are deferred. The handler validates the target artifact node exists; the `bind_trigger` tool catches commit failure and auto-disables the orphan trigger row so the operator can retry cleanly without manual cleanup.
- **`trigger_firing` principle source_event** in [lib/db/repositories/meta-context.js](lib/db/repositories/meta-context.js) `PRINCIPLE_SOURCE_EVENTS` whitelist. Outcome-rate principle (sibling to `app_inference`) written by the scheduler daemon on every fire. The convention is formalized in [docs/meta-context.md](../docs/meta-context.md#the-trigger_firing-principle-convention) so future outcome principle kinds inherit the same shape.
- **Scheduler daemon** at [lib/triggers/scheduler.js](lib/triggers/scheduler.js) — croner-backed, UTC scheduling math throughout. Reads active triggers from `mcp_orbit_trigger_artifacts` at boot, registers each in a croner instance. On each fire: renders the payload template with `{{fired_at}}` / `{{fired_at_date}}` / `{{scheduled_at}}` / `{{fired_at_unix}}` flat-key substitutions, parks the task via `parkRequestForTrigger`, writes a `trigger_firing` principle with `scheduled_at / fired_at / drift_ms` evidence on the target artifact node. **Manual-drain shutdown discipline:** `stopScheduler()` cancels future schedules sync, then awaits an in-flight `Set` of fire promises via `Promise.allSettled` — verified clean against SIGTERM mid-fire via pre-flight spike (croner v10.0.1's `job.stop()` does NOT abort in-flight callbacks; the daemon owns the drain).
- **`parkRequestForTrigger(payload, opts)`** in [lib/mcp/agent-tasks/queue.js](lib/mcp/agent-tasks/queue.js) — fire-and-forget sibling to `parkRequest`. Returns `{ request_id }` synchronously; consumes the eventual promise rejection internally so an expired task (NO_AGENT_WORKER, etc.) doesn't bubble up as an unhandled rejection. The scheduler daemon (and future webhook / watch daemons) use this; the existing HTTP-driven `parkRequest` stays unchanged.
- **`MOJULO_TRIGGER_RUNTIME=enabled` opt-in gate** in [.env.example](.env.example). Without the flag, `bind_trigger` calls still succeed (the binding rows are durable) but nothing fires until a later boot enables the runtime. Symmetric with `MOJULO_AGENT_RUNTIME`'s opt-in posture so an operator who hasn't configured automation doesn't get background daemons by default. SIGTERM + SIGINT handlers installed once at boot when the runtime is enabled; both defer to `stopScheduler()` for the drain.
- **Filesystem capabilities seed update:** the `mojulo://CHANGELOG#` self-reference in [filesystem.md](lib/mcp/seeds/mcp-capabilities/filesystem.md) is unchanged — that seed shipped in 0.8.0 and continues to attribute itself to its actual ship date. Future seed bodies authored under 0.9.0+ should cite the version they ship in.
- **`triggers` summary on fleet brief** in [lib/db/repositories/meta-context.js](lib/db/repositories/meta-context.js). `meta_context_brief({kind:'fleet'})` now returns a `triggers: { count, byComponent }` field alongside `inventory` and `vendorKnowledge`. Counts active rows grouped by `component_ref` so the agent can see "what's wired to fire automatically" at a glance; decoupled from the daemon's runtime state (the brief returns the same shape regardless of `MOJULO_TRIGGER_RUNTIME`).
- **Croner dependency.** `croner@^10.0.1` added to [package.json](package.json). Used both for bind-time cron validation (so invalid expressions reject upfront with the same parser the daemon uses at runtime) and for the daemon's scheduling. Small, modern, no transitive deps, clean SIGTERM-mid-fire behavior verified.
- **Test coverage** — 84 new tests across 4 new files and 2 expanded files: trigger-artifacts repository (22), audit composer + recorder (6), meta-context commit handler (7), trigger-binding tool surface (29), scheduler daemon (18), plus 2 fleet-brief assertions covering the new `triggers` field. **All 996 tests pass.**

#### Changed

- **`meta_context_commit` tool description and input schema** updated to list six commit event types (added `trigger_artifact_materialization`) and surface the new `trigger_ref` input field. The dispatcher in [lib/mcp/tools/meta-context.js](lib/mcp/tools/meta-context.js) routes the new type to its handler.
- **Tool registration order** in [lib/mcp/server.js](lib/mcp/server.js) — `registerTriggerBindingTools()` slots immediately after `registerPrimitiveBindingTools()` and before `registerSemanticSearchTools()`. The natural reading order in `tools/list` is composer → primitive binding → trigger binding → semantic recall.

### App-creation graph view (UI)

A new page at `/graph` renders mojulo's app-creation paradigm as a hand-tuned two-lane vertical map of stations + edges. The point isn't to be a layout engine; it's to make the substrate's structural decisions legible without requiring the operator to navigate MCP tool descriptions. The manifest is the source of truth ([control/lib/graph/creation-map.js](lib/graph/creation-map.js)) and is validated at render time against the *live* MCP registry + contextmap schema enums — if a manifest claim ever falls out of sync with the code, the page surfaces the gap.

#### Added

- **`/graph` page** at [control/app/graph/page.jsx](app/graph/page.jsx). Refresh-on-demand (no streaming, no polling); the full per-app listing lives at `/apps`. Hydration-safe `localStorage` toggle for technical/friendly register persisted as `mojulo.graph.technical`.
- **Creation-map manifest** at [control/lib/graph/creation-map.js](lib/graph/creation-map.js). Hand-curated; each station declares `id`, `kind` (`input` / `mcp_tool` / `output`), positioning (`x, y, w, h` — no layout engine), the technical view (`label`, `sublabel`, `items`), and a `friendly` register-tuned translation. Two pipelines side by side: `install_scaffold` on the left, `meta_context_commit` on the right.
- **Render-time validator** at [control/lib/graph/validate.js](lib/graph/validate.js). Walks the manifest and confirms every claim — `mcp_tool` references resolve in the registered MCP tools, node-kind references appear in `NODE_KINDS`, edge-kind references appear in `EDGE_KINDS`, principle source_event references appear in `PRINCIPLE_SOURCE_EVENTS`. Successful validation returns counts; failures return per-issue messages the page renders inline so an out-of-date manifest is visible, not silent.
- **API endpoint** at [control/app/api/graph/creation-map/route.js](app/api/graph/creation-map/route.js). Returns `{ manifest, validation, overlay }` — the overlay carries `{ appCount, lastMaterializedAt }` read from [control/lib/apps/loader.js](lib/apps/loader.js)'s `listApps()` so the page shows live state alongside the static map. Validation failures don't error the endpoint; the page renders the gap and the manifest both, because a manifest with a tool rename in it is still useful as orientation.
- **`CreationMap` SVG component** at [control/components/graph/CreationMap.jsx](components/graph/CreationMap.jsx). Pure SVG; no graph library. Stations and edges respond to the technical/friendly toggle.
- **Nav entry** in [control/components/AuthNav.jsx](components/AuthNav.jsx) linking to `/graph`, alongside Bots / Apps / Data. New `graph` namespace in [control/messages/en.json](messages/en.json) (~20 lines for nav label, title/subtitle by register, technical toggle, validation messages, overlay strings, legend keys).
- **Plan that motivates the shape** lives at [lite-template/integration/APP_CREATION_MAP_PLAN.md](../lite-template/integration/APP_CREATION_MAP_PLAN.md). Names the manifest-as-source-of-truth claim, the validate-at-render rule, and why this stays read-only (deferred surfaces — clickability that drills into a station's MCP tool, per-app overlay highlighting which stations a specific app's audit chain traversed — earn their place when an operator demands them).

### Posture captured for future plans

Two design-shaping principles got named on 2026-05-26 and now apply across every successor plan in [lite-template/integration/app-system/](../lite-template/integration/app-system/):

1. **Composer-anchored runtime.** When a deliberation surface goes operational, it resolves against the composer's typed components, never a parallel enum. This release enacts the principle for the `trigger` axis (same shape as `bind_primitives` did for `mcp` in 0.5.0). Adding a new bindable kind = ship a typed component first, then the bind tool resolves against it — no per-kind code branch.
2. **Substrate-first; one artifact at the end.** Each release plants one substrate axis. Applied artifacts arrive once enough axes are operational that a single artifact demonstrates them all at once — at that point the operator-facing demo earns its place. Substrate-only releases are deliberate, not deferred.

Both are documented at the top of [TRIGGER_BINDING_PLAN.md](../lite-template/integration/app-system/0526/TRIGGER_BINDING_PLAN.md) and should propagate into a shared `RELEASE_POSTURE.md` if a third plan needs to reference them verbatim.

### Notes

- **No bot image bump.** All changes are control-plane; nothing in `lite-template/` changes. The pinned `BOT_IMAGE` tag in [.env.example](.env.example) and [lib/deployers/docker.js](lib/deployers/docker.js) stays at the v0.6.x value.
- **DB migration is additive.** One new table (`mcp_orbit_trigger_artifacts`), two indexes (one regular, one unique partial with COALESCE). No data rewrite. Two new principle source_events (`trigger_artifact_materialization`, `trigger_firing`) ride on the existing `meta_principles` table via the in-code whitelist.
- **Graph view is fully read-only and additive.** No schema changes, no migrations, no daemons. The `/graph` page reads the static manifest + live MCP registry + live contextmap enums + the existing apps loader; on a fresh DB the overlay shows "No apps made yet" rather than erroring. Open-on-load behavior is unauthed if `CONTROL_PLANE_PASSWORD` isn't set (same as the rest of the dashboard); behind the bearer / cookie middleware otherwise.
- **Phase 1 substrate ships without an applied artifact.** The folder-digester / scheduled-summarizer demo discussed during planning is deliberately not part of this release. When the operator decides what their first scheduled artifact should be, the substrate is ready to bind it; no further code is needed.
- **Webhook (Phase 2) and watch (Phase 3) intentionally deferred.** Webhook requires a deployment-posture decision (mojulo on localhost can't receive an internet POST without a tunnel — ngrok / cloudflare-tunnel / equivalent); shipping it alongside the scheduler would bundle two distinct topics. Watch carries materially more state than the other two combined (per-MCP cursor management, polling cadence vs source rate-limits, idempotency on partial failure). Both reuse `mcp_orbit_trigger_artifacts` and the `bind_trigger` tool without schema changes — they ship as new typed components plus their daemons.
- **The `trigger` axis has shipped typed components since 0.5.0** (`trigger/scheduled@0.1.0`, `trigger/signal-polled@0.1.0`). Until this release the components were declarative only; agents could `get_mcp_orbit_component('trigger/scheduled@0.1.0')` and read their bodies but nothing in mojulo actually fired anything. The composer was honest about typing the axis; the runtime caught up here.
- **Missed fires are not replayed.** If the control plane is down for hours across a scheduled fire, the daemon does not replay missed fires on restart — only future fires execute. The first post-restart firing's audit principle records `drift_ms` against `scheduled_at` so the gap is visible to the operator.
- **No rate cap.** Phase 1 ships no per-trigger or global rate limit. `/api/agent-tasks/status` surfaces queue depth so runaway burn is observable; rate-capping is deferred to a later phase if operator pain motivates it.

## [0.8.0] — 2026-05-26

Mojulo's artifact taxonomy expands. Before this release, the system materialized two kinds of thing — chatbots (compiled via the bot factory, shipped via Fly/Docker) and skills (synthesized via workflow catalysts into the operator's host adapter). Now there's a third: **apps** — local processes the control plane spawns, paired with their own MCP sidecar, with per-inference round-trips parked on an in-process queue so the operator's Claude Code session doesn't get occupied while the app does work. And the substrate that lets artifacts bind to runtime primitives (filesystem, future http-api, future local-sql) lands as **technique catalysts** — a second `kind` of catalyst alongside the existing workflow kind, with the first member (`local-storage`) shipping as substrate only.

The two tracks are independent on their faces but share one architectural beat: **bearer-first middleware**. Apps need their MCP sidecar to call `/api/app-inference/envelope` without a session cookie; the optional Node fulfiller pulls from `/api/agent-tasks` the same way. Both routes (and any future agent-callable surface) now accept `Authorization: Bearer <CONTROL_PLANE_MCP_KEY>` as a unified credential — the cookie path stays for browser UI; the bearer path serves external processes. The change is a small one in [middleware.js](middleware.js) and load-bearing for everything Track A ships.

### Apps + node-driven fulfillment (Ring 7)

The App paradigm spike landed: substrate → protocol → runner → audit → surface, MCP-only, single-operator, grep-verifiable on the "no LLM credentials on the inference path" claim. One app shape ships (R1-Inference image extraction) against one inference flavor with one operator and one agent. Every "one" is a planted axis to press against in subsequent releases.

Apps differ from bots and skills in the dimensions that matter operationally: they run **locally on the operator's machine** (no Fly deploy, no GHCR pull, no compiled artifact), they're **runner-mediated** (the control plane owns their lifecycle, not the operator's shell), and they **defer LLM work back to an agent** through the agent-tasks queue (no per-app API key, no inference credentials on the runtime path). Inventory rows for app MCPs auto-declare as the runner spawns them; `stop_app` removes the rows by `running_ref`.

The Node fulfiller is opt-in. Without it, the operator's own Claude Code session runs `/loop /get_catalyst run-inference-worker` and pulls inference tasks itself. With `MOJULO_AGENT_RUNTIME=claude-code-headless` set, the control plane also runs an in-process poller that spawns a one-shot `claude --print` subprocess per task — the operator's main session stays free. Both fulfillers can coexist; the queue is FIFO single-claim so each task is handled by exactly one.

#### Added

- **Ring 7 — Runner tools** at [lib/mcp/tools/runner.js](lib/mcp/tools/runner.js): `install_scaffold` (scaffold a new app with bundled MCP sidecar), `start_app` / `stop_app` / `status_app` (lifecycle), `list_runners` / `list_running` (introspection), `list_env` / `set_env` / `delete_env` (per-app env management). Backed by [lib/runners/local.js](lib/runners/local.js) — an in-memory singleton that spawns the app + sidecar as an atomic pair with port allocation, env-file management, and stdout parsing for URLs. Restart loses tracking (deliberate v0 scope; runner state is process-local).
- **Ring 7 — Agent-tasks queue tools** at [lib/mcp/tools/agent-tasks.js](lib/mcp/tools/agent-tasks.js): `pull_agent_task` (long-poll, optional `wait_ms` + `kinds` filter), `submit_envelope_inference` (per-kind submit surface validating against the envelope schema embedded in the task payload), `cancel_agent_task` (escape hatch — releases the parked HTTP with `INFERENCE_CANCELLED`). Backed by [lib/mcp/agent-tasks/queue.js](lib/mcp/agent-tasks/queue.js) — an in-memory FIFO single-claim queue; parked promises reject with `INFERENCE_PARKED_LOST` on control-plane restart. Today: one task kind (`envelope_inference`); the substrate generalizes to future classification / decision / structuring kinds.
- **App MCP scaffold** at [lib/app-mcp-scaffold/](lib/app-mcp-scaffold/) — template `server.js` + envelope-client helper + health/describe tools that get installed into every materialized app source tree. Apps don't write their own MCP plumbing; they import it.
- **Claude Code runtime adapter** at [lib/runtime-adapters/claude-code.js](lib/runtime-adapters/claude-code.js) — one-shot Claude subprocess executor for headless fulfillment. Builds system + user prompts from the task payload, validates the JSON response against the envelope schema, returns the result to the queue. The piece that lets `MOJULO_AGENT_RUNTIME=claude-code-headless` actually fulfill work without an interactive session.
- **`app_materialization` commit event type** added to `meta_context_commit` (handler in [lib/mcp/tools/meta-context.js](lib/mcp/tools/meta-context.js)). Per-app atomic seal: adapter_id + artifact + app_name + four bindings (runner / durability / inference / mcp_self). Verification additionally requires the scaffolded `<locator>/app-mcp/server.js` to exist — the runner can't lifecycle an app whose sidecar is incomplete, so the commit refuses at the gate.
- **`app_inference` principle source_event** in [lib/db/repositories/meta-context.js](lib/db/repositories/meta-context.js) `PRINCIPLE_SOURCE_EVENTS` whitelist. Per-inference principle written on the app's artifact node so future audit walks can recover what each inference cost / produced.
- **`run-inference-worker` catalyst** at [lib/mcp/catalysts/run-inference-worker.md](lib/mcp/catalysts/run-inference-worker.md) — the per-loop body the operator's agent runs (pull → dispatch by task_kind → submit via kind-specific tool → loop). Wrappable in `/loop` for continuous operation; finite without `/loop`.
- **Apps dashboard pane** at [app/apps/](app/apps/) and [app/api/apps/](app/api/apps/). Loader at [lib/apps/loader.js](lib/apps/loader.js) stitches contextmap artifact nodes (payload.app) + runner state + inventory (filtered to `server_kind='app'`) into one view model. New i18n strings in [messages/en.json](messages/en.json) under the `apps` namespace.
- **`MOJULO_AGENT_RUNTIME` env var** in [.env.example](.env.example) — opt-in switch for the Node fulfiller. Default unset means `/loop`-based fulfillment via the operator's interactive session; `claude-code-headless` enables the in-process headless poller. `disabled` is an explicit kill switch.
- **`meta_mcp_inventory.server_kind` + `running_ref` columns** via additive migration in [lib/db/index.js](lib/db/index.js). `server_kind` partitions vendor MCPs (default `'vendor'`) from runner-managed app MCPs (`'app'`); `running_ref` links app rows to runner state so `stop_app` removes inventory entries by ref. Indexes on both. Existing rows backfill to `'vendor'` — the inventory before this migration was vendor-only.

#### Changed

- **`meta_context_commit` tool description and input schema** in [lib/mcp/tools/meta-context.js](lib/mcp/tools/meta-context.js) — gains the `app_materialization` event-type branch alongside the existing `operator_kyc` / `artifact_materialization` / `primitive_artifact_materialization` types. The commit-discipline rule is the same as for primitive artifacts: call only after the artifact exists on disk; verification runs before write; the auto-summary principle on the artifact node renders the four bindings for audit + semantic recall.
- **Inventory snapshot logic** in [lib/db/repositories/mcp-inventory.js](lib/db/repositories/mcp-inventory.js) — read/write paths carry `server_kind` + `running_ref` so the apps loader, the runner, and `meta_context_brief({kind:'fleet'})` agree on which inventory rows are vendor vs app. Replace-semantic on declared inventory only touches `server_kind='vendor'` rows; app rows are owned by the runner.

### Local-storage technique infrastructure (Ring 6 + catalyst kinds)

The substrate gains a second catalyst `kind`. Workflow catalysts (the existing kind, unchanged) materialize a runnable artifact through a host adapter against a bot's data + a destination MCP. **Technique catalysts** bind a runtime substrate to an artifact, with the binding recorded as an artifact-scope principle in the contextmap. The technique catalyst is the curated walkthrough; the binding pipeline (`bind_primitives` → `meta_context_commit({type:'primitive_artifact_materialization'})`) is the existing substrate that the technique calls into.

One technique ships in this release: **`local-storage`** — bind a folder on the operator's machine as a `document-store` primitive against the filesystem MCP, with two variants (`:persistent` rooted under `operator.workspace_root`, `:temporary` rooted under `os.tmpdir()/mojulo/<artifact_ref>/`). The substrate is end-to-end — loader picks up the catalyst, generator accepts the `pathPrefix` scoping field, filesystem MCP has a seeded capabilities body, the new `operator_workspace_setup` commit type writes the principle — but **no first applied artifact ships against it yet**. The first demand drives the first application; per the "first ship one boring thing" discipline in [TECHNIQUE_FAMILY_TEMPLATE.md](../lite-template/integration/app-system/primitives/TECHNIQUE_FAMILY_TEMPLATE.md), shipping the substrate without a forced applied use is correct, not incomplete.

#### Added

- **`kind: 'technique'` discriminator** in the catalyst loader at [lib/mcp/catalysts/loader.js](lib/mcp/catalysts/loader.js). Two shelves: `catalysts/*.md` defaults to `kind: 'workflow'`, `catalysts/techniques/*.md` defaults to `kind: 'technique'`. Frontmatter `kind` is optional; if present, must match the shelf — mismatch throws. `listCatalysts({ kind })` filter, `getCatalyst(id)` returns `kind` on response.
- **`list_catalysts` gains a `kind` filter** in [lib/mcp/tools/catalysts.js](lib/mcp/tools/catalysts.js). Tool description carves the workflow/technique distinction explicitly. `get_catalyst` skips the workflow-shaped preamble + host adapter section for technique catalysts (they bind primitives directly, not through host adapters). `recommend_catalysts` filters out technique catalysts in both single-bot and fleet modes (techniques don't recommend against a bot's protocol set).
- **`pathPrefix` first-class through the binding pipeline.** Generator at [lib/mcp/mcp-orbit-components/generator.js](lib/mcp/mcp-orbit-components/generator.js) accepts an optional `pathPrefix` input, validates (non-empty string, no `..` segments), renders into `{{path_prefix}}` substitution + `{{if-path-prefix}}` / `{{if-no-path-prefix}}` conditional pair, and surfaces on the manifest as `manifest.pathPrefix` for programmatic consumers (the Runner MCP reading addressing, future deliberation surfaces). `bind_primitives` at [lib/mcp/tools/mcp-primitive-binding.js](lib/mcp/tools/mcp-primitive-binding.js) forwards the field; it persists into the `mcp_orbit_provider_artifacts` row body alongside the existing manifest.
- **Filesystem capabilities seed** at [lib/mcp/seeds/mcp-capabilities/filesystem.md](lib/mcp/seeds/mcp-capabilities/filesystem.md) — sixth seed alongside gmail / google_drive / linear / notion / slack. Honest about scope: POSIX-ish operations, launch-time allow-list, no auth, no soft-delete, no retention. Sub-path enforcement is mojulo's discipline (the binding's `pathPrefix`), not the MCP's — the body says so explicitly. Picked up automatically on first install via the existing idempotent seed migration; existing installs gain only the `filesystem` row on next boot.
- **`operator_workspace_setup` commit event type** in [lib/mcp/tools/meta-context.js](lib/mcp/tools/meta-context.js). Records `workspace_root` (absolute path) and optional `workspace_conventions` (free-form prose) as flat principles on the operator node. Append-only — re-running stacks fresh principles, latest wins for readers. Distinct from `operator_kyc`'s revise path because the principle body shape is different (`**Workspace root:**` header vs the KYC body's `**Locked-in constraints:**` list). Validation: requires the operator anchor to exist; rejects relative paths and `..` segments.
- **`local-storage` technique catalyst** at [lib/mcp/catalysts/techniques/local-storage.md](lib/mcp/catalysts/techniques/local-storage.md). Five-step walkthrough: resolve or set `operator.workspace_root` → confirm filesystem MCP in inventory → choose sub-path + apply `conflict-vs-claim` discipline → call `bind_primitives` with `pathPrefix` → graduate via `meta_context_commit({type:'primitive_artifact_materialization'})` → wire the artifact (skill: path baked into SKILL.md; app: injected as env var via the Runner MCP — naming convention `MOJULO_LOCAL_STORAGE_PATH` for single-binding artifacts, `MOJULO_LOCAL_STORAGE_<TAG>_PATH` for multi-binding). Two variants documented; pitfalls (workspace at home root, symlink escape, concurrent writers, no native retention) called out with concrete mitigations.
- **`operator_workspace_setup` in `PRINCIPLE_SOURCE_EVENTS` whitelist** in [lib/db/repositories/meta-context.js](lib/db/repositories/meta-context.js). No schema change — the existing `meta_principles` table accepts the new source_event value; the whitelist is the only thing that needed expanding.

#### Changed

- **`document-store.destination.template.md`** in [lib/mcp/mcp-orbit-components/primitive/](lib/mcp/mcp-orbit-components/primitive/document-store.destination.template.md) gains a `## Write scope (path prefix)` section that renders only when `pathPrefix` is bound. Body is candid that the MCP itself can't enforce sub-path scopes smaller than its launch-time allow-list — the constraint is *guidance* for honest agents, evidenced by the audit chain rather than blocked by the runtime. Operators relying on the audit trail to certify "nothing was written outside `<path_prefix>`" should pair the binding with regular contextmap reviews.
- **Setup doc for the filesystem MCP** added to [docs/mcp-integration.md](../docs/mcp-integration.md) — new "Technique catalysts" subsection covering the one-time `claude mcp add filesystem npx -y @modelcontextprotocol/server-filesystem <workspace_root>` install command, the `--scope user` choice for cross-project availability, and the workspace-root-change posture (manual re-materialization in v0).

### Cross-cutting: bearer-first middleware

The architectural beat that ties both tracks. Mojulo's middleware previously enforced a session-cookie gate on all `/api/*` paths, with `/api/mcp` carrying its own bearer-token check inside the route handler. With apps shipping their own MCP sidecar that calls back into `/api/app-inference/envelope`, and with the optional Node fulfiller pulling from `/api/agent-tasks`, every bearer-protected route would have needed per-route auth plumbing. Lifting the bearer check into middleware unifies the two auth schemes (cookie OR token) so any future agent-callable route just works.

#### Changed

- **[middleware.js](middleware.js) accepts bearer tokens.** New `presentedBearerMatchesMcpKey(req)` check fires before the session-cookie path; when the `Authorization: Bearer <CONTROL_PLANE_MCP_KEY>` header matches in constant-time, the request bypasses the cookie gate entirely. Tokens are compared via `constantTimeEquals` to avoid early-exit timing leaks on a mismatched prefix.
- **401 response shape upgraded** from plain text (`"Authentication required"`) to JSON with `code: 'SESSION_REQUIRED'` and a body explaining the two acceptable credentials. Existing browser clients keep working (cookie path unchanged); programmatic callers get a structured error.

### Notes

- **No bot image bump.** All changes are control-plane; nothing in `lite-template/` changes. The pinned `BOT_IMAGE` tag in [.env.example](.env.example) and [lib/deployers/docker.js](lib/deployers/docker.js) stays at the v0.6.x value.
- **DB migration is additive.** Two new columns on `meta_mcp_inventory` (`server_kind` default `'vendor'`, `running_ref` nullable) plus two indexes. No data rewrite, no breaking change for existing rows. The `meta_principles` table is unchanged — `app_inference` and `operator_workspace_setup` ride on the existing `source_event` column; the new values land via the in-code whitelist.
- **Track B substrate ships without an applied first artifact.** A daily-digest skill or a text-extraction app would be the canonical first use, but neither lands in 0.8.0. The first demand drives the first application; pressure-testing the technique against a real artifact is the next move and may reshape the substrate's open questions (path-prefix UX edge cases, retention enforcement, workspace-root migration). Operators wanting to apply the technique today can do so — the catalyst body is fully agent-walkable — but the canonical-shape claim is unproven until a real artifact uses it.
- **No mojulo CHANGELOG entry yet for the filesystem seed body's self-reference.** The seed body cites `mojulo://CHANGELOG#v0.7.0` in its `<!-- sources -->` block as a placeholder; that reference points at the *prior* release. The honest move once 0.8.0 ships is to update the citation to `mojulo://CHANGELOG#v0.8.0` — a one-line edit to [lib/mcp/seeds/mcp-capabilities/filesystem.md](lib/mcp/seeds/mcp-capabilities/filesystem.md). Not load-bearing; flagged for honesty in the provenance trail.
- **The bearer-first middleware change widens the auth surface.** A leaked `CONTROL_PLANE_MCP_KEY` now grants the same access as a valid session cookie — previously it granted only the MCP route. Mojulo's threat model (single-operator, self-hosted, opt-in HTTP login) accepts this; an operator who shares mojulo across machines or a future multi-tenant posture would need to revisit. The key was already the MCP credential; unifying it with the session is the explicit choice, not an accident.
- **Test count.** 912 passing across the control plane (up from 832 at 0.7.0 release). New coverage spans the Ring 7 runner + agent-tasks tools, the Apps loader and dashboard data path, the catalyst loader's kind discriminator, the generator's `pathPrefix` round-trip, the `bind_primitives` `pathPrefix` plumbing, the filesystem seed inclusion, and the `operator_workspace_setup` commit's round-trip via `meta_context_brief`.

## [0.7.0] — 2026-05-25

Ring 6's operator anchor gains a **communication-style dimension**, and `forward_context` learns to read it. Before this release the agent re-derived how technical to talk to the user every turn from in-conversation cues alone; the standing-rule directive said "respond at a reflective degree of technical sophistication" but gave the agent no durable signal for *which* register fit *this* user. Now the operator declares a preference once via two optional fields on `operator_kyc` (`vocabulary_register: 'plain' | 'mixed' | 'mojulo'`, `procedural_disclosure: 'terse' | 'reflective' | 'pedagogical'`), it persists on the operator node's payload, and `forward_context` branches three sections of its body — opening orientation, concept glossary, disclosure directive — to match. Two orthogonal axes, six real cells in the 3×3 (`plain + terse` is "novice in a hurry"; `plain + pedagogical` is "novice learning the model"; `mojulo + terse` is power-user; etc.). The plan that motivates the shape lives in [lite-template/integration/REGISTER_TUNING_PLAN.md](../lite-template/integration/REGISTER_TUNING_PLAN.md).

The load-bearing constraint is the **floor rule**: the four commitment gates the user needs to course-correct on (*proposed* vs *materialized*, *dry-run* vs *promoted*, *watched* vs *read-once*, *recorded in the audit trail* vs *not*) must stay legible in every register cell. `plain` is "gate language in plain English," not "no gate language." The unit suite includes a smoke test that fails if any cell drops any gate phrase — the design contract is structurally enforced, not aspirational.

The complementary `semantic_search` surface shipped in v0.6.0 is what makes the `plain` end of the register newly viable. Before, plain-English intent forced the agent to teach mojulo's nouns to the user just to disambiguate which tool to reach for. With semantic recall, the agent maps "log new Gmail to a sheet" → ranked refs for the gmail capability, sheets capability, messaging-channel and structured-record-store primitives **without surfacing those jargon names to the user at all**. The bridge claim was validated in a real 4-turn session before release: agent answered in depth without once naming a tool or primitive.

### Added

- **`operator_kyc` carries two new optional fields** in [lib/mcp/tools/meta-context.js](lib/mcp/tools/meta-context.js): `vocabulary_register` (`'plain' | 'mixed' | 'mojulo'`) and `procedural_disclosure` (`'terse' | 'reflective' | 'pedagogical'`). Enum-validated; both default to today's posture (`mixed + reflective`) when absent. Composed into the principle body under a `**Communication preferences:**` block so an agent reading `meta_context_brief({kind:'fleet'})` sees them alongside role + primary_goal + constraints. The programmatic source of truth lives on the operator node's `payload` (JSON-serialized) — `forward_context` reads from there.
- **Exported register enums + defaults** from [lib/mcp/tools/meta-context.js](lib/mcp/tools/meta-context.js): `VOCABULARY_REGISTERS`, `PROCEDURAL_DISCLOSURES`, `DEFAULT_VOCABULARY_REGISTER`, `DEFAULT_PROCEDURAL_DISCLOSURE`. One source of truth shared between the kyc validator, the `forward_context` handler, and the test suites.
- **`forward_context` learns per-call overrides** in [lib/mcp/tools/context.js](lib/mcp/tools/context.js). Input schema gains optional `register` and `disclosure` fields with the same enum validation. Override > operator anchor > defaults, resolved per-axis — overriding one axis inherits the other from the anchor. Useful when the agent wants to bump to `mojulo` for one detailed explanation mid-`plain` session without committing a new kyc revision. The override is local to the call; it does not write to the contextmap.
- **`buildForwardContextBody({register, disclosure, source})` composer** exported from [lib/mcp/tools/context.js](lib/mcp/tools/context.js). Pulls the three branched sections from variant tables (`OPENING_PARAGRAPH_VARIANTS`, `CONCEPT_GLOSSARY_VARIANTS`, `DISCLOSURE_DIRECTIVE_VARIANTS`) and stitches them with the ~10 shared section constants. The shared spine — lifecycle, tool index, two-faces, secrets, verification, catalyst texture, quick-orientation rules — is single-source; only the prose that actually carries register voice branches.
- **Dual-purpose preamble** at the top of every `forward_context` body. Names the document's two readers explicitly: the **agent** reading for orientation, and the **system reader** (a contributor adding a tool, the future `meta_context_arbitrate` coherence pass) reading it as mojulo's canonical reference. Replaces the older "cognitive assistance" directive — the new register signal does that work better, freeing the preamble to capture the most valuable insight from the dropped drawer/tier draft: that `forward_context` plays two roles, named here without paying for a tool split.
- **Communication settings notice** rendered into every `forward_context` body just under the preamble. Reports the active cell (`vocabulary_register: plain, procedural_disclosure: pedagogical`) and the resolution source (`override` / `operator_anchor` / `defaults`) so the agent has an explicit signal instead of an ambient directive, and so the user — if they read the body — can tell *why* the agent is talking the way it is.
- **Test coverage** — 5 new register-tuning tests added to [lib/mcp/tools/meta-context.test.js](lib/mcp/tools/meta-context.test.js) (round-trip onto payload + into principle body; omit when neither field set; enum validation for both axes; revise preserves prior payload when not re-specified; revise updates one axis without resetting the other). New [lib/mcp/tools/context.test.js](lib/mcp/tools/context.test.js) with 16 tests covering: every register × disclosure cell renders without throwing; **floor rule survives every cell** (the four-gate phrases asserted across the 3×3); dual-purpose preamble in every cell; branched-section content checks (`plain` says "Gmail, your calendar, Drive" + "Don't surface to the user"; `mojulo` strips ramp prose; disclosure variants each insert exactly one paragraph); concept names invariant across registers (`**Bot**`, `**Deployment**`, etc.); tool-index single-source (representative tool one-liner verbatim in every register); fallback to defaults on invalid inputs; and handler resolution (defaults / anchor / per-call override / per-axis composition / invalid rejects / floor in handler output). **All 69 tests pass.**

### Changed

- **`FORWARD_CONTEXT_BODY` refactored from a monolithic template literal into composable sections.** Today's body was ~200 lines of one template string; the refactor breaks it into ~10 shared section constants (`HEADER`, `DUAL_PURPOSE_PREAMBLE`, `TWO_FACES_ONE_STATE`, `SECRETS_HANDLING`, `VERIFICATION_POSTURE`, `STANDING_RULE_FLOOR`, `CATALYST_TEXTURE_PREVIEW`, `LIFECYCLE`, `TOOL_INDEX`, `QUICK_ORIENTATION_RULES`) plus the three variant tables. The exported `FORWARD_CONTEXT_BODY` constant survives as a back-compat shim that renders the `mixed + reflective` default cell — any importer that still references it (mostly tests) sees the same body shape the tool emitted before register tuning landed.
- **Operator node payload now carries register prefs.** [lib/mcp/tools/meta-context.js](lib/mcp/tools/meta-context.js) `commitOperatorKyc` reads the existing operator node's `payload` before upserting and merges per-axis: register fields explicitly provided in the new commit win; absent fields preserve their prior value. Without this, a revise call that only updates `role` would silently reset register prefs set in an earlier commit. The merged payload is what `forward_context` reads via `MetaNodeRepository.findByRef('operator', 'self')` at handler time.
- **`Commitment-level vocabulary` standing rule rewritten.** The original opening paragraph ("respond in a similar register with one degree of sophistication above, to ramp the user") was the old form of the register concept; it's superseded by the operator's declared `vocabulary_register` and the active-cell notice at the top of the body. The standing rule now leads directly with the four-gate floor list, then inserts the active disclosure directive (`terse` / `reflective` / `pedagogical`) below as a separate paragraph keyed on axis 2. The floor list itself is invariant across cells.
- **`forward_context` tool description and input schema updated.** The description now names the per-call override and explains which sections branch (opening, glossary, disclosure) vs. which stay invariant (concept names, tool descriptions). Input schema declares both new optional fields with enum and one-line descriptions.
- **`meta_context_commit` tool description and input schema** updated to declare `vocabulary_register` and `procedural_disclosure` alongside the other operator_kyc fields, including the "absence preserves any prior setting on revise" semantics.

### Notes

- **No migration.** No database column changes — register prefs ride on the operator node's existing `payload` column. No new repository, no new index, no schema bump. Existing operators with no register prefs keep getting today's `mixed + reflective` body verbatim.
- **No bot image bump.** Purely a control-plane MCP behavior; nothing in `lite-template/` changes. The pinned `BOT_IMAGE` tag in [.env.example](.env.example) and [lib/deployers/docker.js](lib/deployers/docker.js) stays at the v0.6.x value.
- **Floor rule is structurally enforced.** A unit test iterates every register × disclosure cell and asserts every gate phrase appears in the rendered body. Future edits to the branched sections cannot accidentally drop the floor without the test catching it — the design contract is mechanically protected, not authorial discipline.
- **Tool surface is invariant across registers.** Tool descriptions in MCP `list_tools` stay in mojulo idiom regardless (they're agent-facing — the agent uses them to call tools). Concept *names* (`primitive`, `composer`, `materialized`, `inventory`, `capabilities`) never branch (the agent uses them too). Only the user-facing prose in the three branched sections changes. Agent-to-agent surfaces — `meta_context_brief` outputs, future `meta_context_arbitrate` plans, catalyst bodies, meta-catalyst bodies, primitive role templates — all stay technical regardless of operator register. The boundary is "prose-to-user branches; data-and-tools-for-agents doesn't."
- **No auto-detection.** Tempting to infer the register from the user's word choice ("they said `primitive`, bump to mojulo") — explicitly rejected for v1. The register signal lives on the contextmap; auto-mutating it violates append-only discipline, and misdetection on a quoted doc shouldn't silently change session behavior. Promotion is an operator decision: the agent should surface it as a soft suggestion ("you've been asking about composer internals — want me to switch to the technical orientation?") and commit on explicit yes via `meta_context_commit({type:'operator_kyc', revise: true, vocabulary_register: 'mojulo'})`.
- **Validation step 3 field-validated.** The plan's load-bearing claim was that `semantic_search` makes `plain` mode viable by moving the noun-disambiguation bridge into the tool layer. Tested in a real 4-turn session before release: agent answered in depth across the chatbot-and-mcp-orbit axes without surfacing a single jargon term. The bridge holds.

## [0.6.0] — 2026-05-25

Ring 6 gains a **semantic recall surface** over the durable app state it already accumulates. The structured readers (`meta_context_brief`, `get_mcp_orbit_component`, `get_catalyst`, `get_mcp_capabilities`, …) answer "give me the full row at this ref"; the new `semantic_search` answers the other direction — "which refs are relevant to this intent at all?" One unified sidecar (`meta_embeddings`) covers seven source kinds — principles, declared MCP inventory tools, current capability bodies, mcp-orbit components / compositions / provider artifacts, and the shipped catalyst markdown — keyed on `(source_kind, source_ref)` with `content_hash`-based skip on re-embed. Embeddings are computed by the already-in-process multilingual-e5-small ONNX model that powers bot-side RAG; no new native dependency, no external API. The plan that motivates the shape lives in [lite-template/integration/SEMANTIC_INDEX_PLAN.md](../lite-template/integration/SEMANTIC_INDEX_PLAN.md).

### Added

- **`meta_embeddings` table** in [lib/db/index.js](lib/db/index.js) — single sidecar, `(source_kind, source_ref)` unique, raw little-endian `float32[384]` BLOB embedding, `content_hash` sha256 of the body, `model` column reserved for future model swaps without a destructive rebuild. CHECK constraint pins the seven source kinds. Backed by a per-kind index on `source_kind`.
- **`EmbeddingsRepository`** at [lib/db/repositories/embeddings.js](lib/db/repositories/embeddings.js) — split sync/async API forced by better-sqlite3's "transaction fn must be synchronous" rule against `generateEmbeddings(...)` being async. The contract every source-row write path follows: *compose body text → `await embed(...)` outside the txn → enter the sync `db.transaction(fn)` that writes the source row + `upsertSync` the embedding row together*. Atomicity is preserved end-to-end: if the host write rolls back, the embedding write rolls back with it. `embed` / `embedMany` are hash-skip-aware (existing row, same hash → returns `vector: null` so the upsert no-ops); pass `{ skipUnchanged: false }` from write paths whose host txn deletes the prior embedding row first (inventory replace) where the skip would silently lose the vector. `deleteByRefSync` and `deleteByRefPrefixSync` cover the deletion paths (the prefix variant LIKE-escapes wildcards so a server name containing `_` or `%` doesn't widen the delete). `search(query, { kinds, limit })` runs the query through the existing `generateEmbeddings(..., { inputType: 'search_query' })` (which owns the e5 `query: ` prefix), loads the optionally-kind-filtered rows, scores cosine in JS, sorts, slices — sub-50ms at expected corpus size after model warm-up.
- **Capability supersession filter on search** — `search` joins against `meta_mcp_capabilities` + `meta_mcp_providers` and quietly drops any `mcp_capability` row whose backing capability is no longer the current one for its provider. A row in `meta_embeddings` without a current capability entry is never returned. This is the load-bearing property pinned by the embeddings test suite — a regression here would let the agent recall stale vendor knowledge.
- **`semantic_search` MCP tool** at [lib/mcp/tools/semantic-search.js](lib/mcp/tools/semantic-search.js) — Ring 6, registered LAST so the reading order is *orientation → action → deliberation (structured walks: brief, inventory, capabilities, composer, primitive-binding) → deliberation (fuzzy recall: semantic_search)*. Returns `{ results: [{ source_kind, source_ref, score, snippet }] }` with snippets capped at ~280 chars — the contract is *retrieve, don't resolve*; the agent pairs results with the structured readers to pull full bodies for any row worth the context cost. Optional `kinds` filter restricts to one or more of the seven source kinds; default returns all. Read-only.
- **`reindexAll()` helper + `scripts/reindex-embeddings.js` CLI** at [scripts/reindex-embeddings.js](scripts/reindex-embeddings.js) — one-shot backfill across every source kind (`SELECT` per source table → compose body via the kind's `BodyComposition` helper → batched `embedMany` → single sync `db.transaction(fn)` of `upsertSync` calls). Idempotent (hash-skip on every row). Use when body-composition logic changes (e.g. mcp_tool body shape evolves) so existing rows recompute their hashes against the new shape, or when first-boot auto-run failed and the operator wants to retry manually, or when catalyst markdown was updated in-place without a source-row write to trigger the per-write hook.
- **First-boot auto-backfill** via `maybeBackfillEmbeddings(db)` in [lib/db/index.js](lib/db/index.js) — runs after `migrateInventoryColumns` + `reapStaleMcpJobs`. Short-circuits when `meta_embeddings` already has rows; further short-circuits when *no source-row exists yet across the entire corpus* (catalysts are filesystem-only and small; reindexing them on every fresh boot pre-source-write is wasteful). Fires the reindex as fire-and-forget so `getDb()` isn't blocked on model load. `MOJULO_SEMANTIC_INDEX_DISABLED=1` skips the auto-run; the CLI ignores that flag (it's the manual recovery path).
- **Body composition helpers** exported alongside the repo: `composeMcpToolRef`, `composeMcpToolBody`, `composeOrbitComponentRef`, and the per-kind `BodyComposition` map (`principle` / `capability` / `orbitComponent` / `orbitComposition` / `orbitArtifact` / `catalyst`). Centralizing composition keeps the index consistent across the per-write hooks and the bulk reindex — the canonical body shape per source kind is defined once.
- **Test suites** for every source kind's write-path integration with the sidecar: [embeddings.test.js](lib/db/repositories/embeddings.test.js), [mcp-capabilities-embedding.test.js](lib/db/repositories/mcp-capabilities-embedding.test.js), [mcp-inventory-embedding.test.js](lib/db/repositories/mcp-inventory-embedding.test.js), [mcp-orbit-embedding.test.js](lib/db/repositories/mcp-orbit-embedding.test.js), [mcp-orbit-provider-artifacts-embedding.test.js](lib/db/repositories/mcp-orbit-provider-artifacts-embedding.test.js), [meta-context-embedding.test.js](lib/mcp/tools/meta-context-embedding.test.js), and the cross-kind [semantic-search.integration.test.js](lib/mcp/tools/semantic-search.integration.test.js). Coverage pins: per-source upsert on insert, hash-skip on unchanged body, replace-semantic deletion of stale tool rows on inventory replace, current-row-only recall on capability supersession, soft-fail posture (host write commits even if the embed fails), and cross-kind cosine recall against a populated corpus.

### Changed

- **Source-row write paths upsert into the sidecar.** Per the plan's pre-embed-then-sync-txn discipline, every write that lands new body text in a source table now mirrors into `meta_embeddings` atomically:
  - **`meta_context_commit`** in [lib/mcp/tools/meta-context.js](lib/mcp/tools/meta-context.js) — pre-embeds every principle's `body_md` in one `embedMany` batch before opening the commit txn; inside the sync txn, `upsertSync('principle', String(insertedId), ...)` rides alongside each `INSERT INTO meta_principles`. A `meta_context_commit` that writes 10+ principles for an artifact materialization pays one batched embed call before the txn opens.
  - **`InventoryRepository.replaceInventory`** in [lib/db/repositories/mcp-inventory.js](lib/db/repositories/mcp-inventory.js) — batched `embedMany({ skipUnchanged: false })` for every tool body across all servers, then in the sync txn each server's prior tool embeddings are dropped via `deleteByRefPrefixSync('mcp_tool', `${server}::`)` and the new ones inserted. `skipUnchanged: false` is load-bearing — the prefix delete would otherwise lose any vector that hash-matched a since-deleted row.
  - **`CapabilitiesRepository.record`** in [lib/db/repositories/mcp-capabilities.js](lib/db/repositories/mcp-capabilities.js) — embed the new row's `body_md` before the 3-statement supersession dance; inside the sync txn, `upsertSync('mcp_capability', provider_ref, ...)` writes the new vector and the prior superseded row's embedding stays in place (search filters by `superseded_by IS NULL` so it never surfaces). No churn on supersession; full history walks (`asOf`) still work against the source table.
  - **`MCPOrbitComponentRepository.upsert` / `MCPOrbitCompositionRepository.create` / `MCPOrbitProviderArtifactRepository.create`** in [lib/db/repositories/mcp-orbit.js](lib/db/repositories/mcp-orbit.js) + [lib/db/repositories/mcp-orbit-provider-artifacts.js](lib/db/repositories/mcp-orbit-provider-artifacts.js) — embed `body_md` / `intent_md` / `body_md` (respectively) before the insert; `upsertSync` inside the txn under the kind's composed ref (`${kind}/${ref}@${version}` for components, raw `ref` for compositions, raw `ref` for provider artifacts).
  - **Catalyst seeds** in [lib/mcp/seeds/mcp-capabilities-seed.js](lib/mcp/seeds/mcp-capabilities-seed.js) — first-install seeding through the same `CapabilitiesRepository.record` path mirrors into the sidecar, so the four shipped vendor bodies (gmail / notion / linear / google_drive) are searchable from the first session without an explicit reindex.
  - **Catalyst markdown library** — no per-write hook (catalysts are filesystem-immutable per install). The auto-backfill on first boot picks them up via the `BodyComposition.catalyst` helper (full markdown recomposed from the loader's structured form); operators who hand-edit catalysts re-run `scripts/reindex-embeddings.js`.
- **`forward_context` Ring 6 tool index** in [lib/mcp/tools/context.js](lib/mcp/tools/context.js) gains a `semantic_search` entry that names the read-side relationship explicitly: *brief* / structured readers answer ref-then-fetch, *semantic_search* answers intent-then-rank. Cold-load posture (~2–4s on first call after a control-plane restart, sub-50ms thereafter) and the capability supersession filter are both surfaced in the tool description so the agent doesn't have to guess.

### Notes

- **Why not a vector DB?** SQLite + JS cosine over an in-memory result set is sufficient at the projected corpus size (hundreds → low thousands of rows). The `embedding BLOB` column shape is already compatible with [`sqlite-vec`](https://github.com/asg017/sqlite-vec)'s `vec0` virtual tables — the swap is a future migration with no row-shape change. Defer until the corpus actually crosses ~10k rows.
- **Why one sidecar, not per-table?** Source-table write disciplines diverge sharply (append-only / replace / append-with-supersession / append-on-version) — that divergence is meaningful at write time but has no equivalent at read time. The agent wants *relevant text*, regardless of which table holds it. One sidecar matches the read shape and lets each write path keep its own discipline; the cost is one extra coordinate (`source_kind`); the benefit is one place to evolve embedding strategy and one tool the agent has to learn.
- **Soft-fail posture.** Embed failures never block the host write: the repo logs and the source row commits without a corresponding embedding entry, and the agent loses recall on that specific row until the next `reindexAll`. The plan accepts this for individual rows (principles / components / compositions) and explicitly for bulk paths (a network blip during inventory replace leaves a whole server's tools un-indexed; the operator re-runs the CLI). Existing rows are NOT deleted on soft failure either — a prior good embedding stays in place even if the latest embed failed, so recall doesn't regress below the previous state.
- **Cold load.** First embed after a control-plane restart pays ~2–4s of model load (the same multilingual-e5-small q8 ONNX that powers bot-side RAG, hoisted in-process via [lib/embedder/local.js](lib/embedder/local.js)). Subsequent calls in the same process are sub-50ms at expected corpus size. The first embed is typically a write-path call (e.g. `meta_context_commit`), not a `semantic_search` — acceptable, both surfaces are deliberation-rate, not run-rate.
- **Explicit non-goals** (these keep the plan durable): not embedding the internal MCP tool registry (Rings 0–6 — small, taxonomic, already loaded via `forward_context`); not embedding conversation data (lives in bot SQLite, `bot-proxy.js`-mediated reads only); not embedding `meta_nodes` / `meta_edges` payloads (predominantly identifiers — low-signal noise; navigable via `meta_context_brief`); not coupling to meta-catalyst evolution (the index keys on stable schema row identifiers, content picks up content changes via `content_hash`).

## [0.5.0] — 2026-05-25

Ring 6 grows from three surfaces to five. The deliberation substrate v0.4.0 introduced (contextmap / inventory / mcp-orbit composer) gains two more first-class surfaces: **capabilities** (vendor knowledge with transactional supersession + asOf history, sibling to inventory's introspection facet — both write through one identity layer per provider) and **primitive binding** (a runtime-introspected composer that fills vendor-agnostic primitive templates with the operator's actual bound tool names + schemas). The vendor-shaped mcp-orbit composer that anchored v0.4.0 stays in place but steps back to seed-reasoning duty; `bind_primitives` is the supported path for MCP-to-MCP composition where the agent has runtime tool-schema knowledge — which is the common case for Claude Code, Codex, and similar hosts.

The composer rewires around a **consolidated provider view** that joins identity + inventory + capabilities into one record per logical MCP, with five composer states per chosen provider (`research` / `seed` / `inventory_only` / `capabilities_only` / `none`) that surface as their own warning tags so the agent routes remediation directly. Vendor curation gets decoupled from build-time, lifecycle-bound seeds: four curated vendor bodies (gmail / notion / linear / google_drive) ship as seeds on first install for cold-start reasoning, with the `research-mcp-vendor` catalyst as the agent-side refresh path. The primitive layer ships four primitives — `document-store`, `structured-record-store` (typed records across issue trackers + CRMs + spreadsheet-databases), `messaging-channel`, `message-thread` — each as body + source-role template + destination-role template, with a deterministic generator that fills the templates against capability snapshots at bind time.

`source` and `destination` lift from component kinds to **composition roles** carried per-entry in `component_refs`. Adding a new MCP to the library is now one `mcp` component declaring its affordances, not two source/destination components, and the same MCP plays both roles in compositions that read and write the same backend (Linear digest → Linear, HubSpot enrichment → HubSpot). Two new starter component kinds — `trigger/signal-polled` and `pattern/routing` — extend the composer past scheduled-aggregation into signal-driven shapes, proven end-to-end against the gmail-support-thread → linear-issue catalyst.

### Composer: source/destination as composition roles

First structural refinement past the 0.4.0 baseline. Surfaced as feedback after merge: the 0.4.0 shape encoded `source` and `destination` as **component kinds**, forcing each MCP that wanted to play either role to ship as two components (`source/gmail` + `destination/gmail`). That cut off real workflows where an MCP needs to be on both sides (Drive folder watcher → digest into another Drive doc; Linear closed issues → enrichment → back to Linear). The fix is structural but cheap: lift source/destination from component-kind to **composition-role**, carried per-entry in `component_refs`. The bones don't change; the unlock roughly doubles the addressable workflow space. Catching this before custom components ship prevents teaching external authors a confusing shape.

#### Changed

- **`mcp_orbit_components.kind` CHECK constraint** in [lib/db/index.js](lib/db/index.js) — drops `'source'` and `'destination'`, adds `'mcp'`. New enum: `('mcp','trigger','pattern','idempotency','render')`. The `MCPOrbitComponentRepository.COMPONENT_KINDS` array in [lib/db/repositories/mcp-orbit.js](lib/db/repositories/mcp-orbit.js) matches. Existing 0.4.0 composition rows that reference the old kinds are not migrated (5 in test fixtures only, none in production); the kinds change is a one-shot.
- **`component_refs` entries gain a `role` field** in [lib/db/repositories/mcp-orbit.js](lib/db/repositories/mcp-orbit.js) — required for `kind: 'mcp'` entries (`'source' | 'destination'`), rejected on non-mcp kinds (the other kinds are singletons in a composition). New `_MCP_ROLES_FOR_TESTS` export mirrors the pattern of the other test seams. Validation throws on missing role for mcp entries with a clear error pointing at the role enum.
- **Two MCP-shaped starter components re-authored** with bidirectional bodies: [mcp-orbit-components/mcp/linear.md](lib/mcp/mcp-orbit-components/mcp/linear.md) (was [mcp-orbit-components/source/linear.md](lib/mcp/mcp-orbit-components/) — now also covers `create_issue` / `update_issue` / `comment_on_issue` for destination-role usage) and [mcp-orbit-components/mcp/gdrive.md](lib/mcp/mcp-orbit-components/mcp/gdrive.md) (was [mcp-orbit-components/destination/gdrive.md](lib/mcp/mcp-orbit-components/) — now also covers `list_recent_files` / `search_files` / `read_file_content` for source-role usage). Each declares an `affordances: { read, write, watch }` map; the recommender uses these to gate which composition role this MCP can play. Bodies grew to ~50–60 lines (one surface/mapping section per role + shared pitfalls) — read-after-write same-MCP loop pitfalls called out explicitly. The legacy `source/` and `destination/` directories are removed.
- **Pattern aggregation frontmatter** in [mcp-orbit-components/pattern/aggregation.md](lib/mcp/mcp-orbit-components/pattern/aggregation.md) updated from `fits.sources / fits.destinations / requires.minSources / requires.minDestinations` to `fits.sourceMcpAffordances / fits.destinationMcpAffordances / requires.minMcpRoles: { source: 1, destination: 1 }` — the wildcard `"*"` framing didn't survive the role refinement; affordance-explicit is sharper.
- **Recommender** ([lib/mcp/tools/mcp-orbit.js](lib/mcp/tools/mcp-orbit.js) `buildCandidateComposition`) — lists `kind: 'mcp'` components once, partitions by affordance into `readMcps` / `writeMcps`, then selects per role with two new heuristics: (1) inventory-matched candidates take precedence; (2) within the pool, the source is ranked by **earliest mention** in the intent text and the destination is ranked by **latest mention** with a preference for a different ref from the chosen source (the natural-language ordering "X digest into Y" almost always names source first and destination second). `priorMaterializationSignal` keys on role-aware `${kind}/${ref}#${role}` so `mcp/linear@source` doesn't conflate with `mcp/linear@destination`. Constraint warnings still surface `source_not_in_inventory:<ref>` / `destination_not_in_inventory:<ref>` and now reflect the role-tagged refs.
- **Meta-catalyst body** at [mcp-orbit-components/meta-catalyst.md](lib/mcp/mcp-orbit-components/meta-catalyst.md) — six-categories table collapsed to five-categories; new "How roles work" subsection with an example `component_refs` JSON literal showing role tags; constraint table reworked (constraint 3 is the affordance/role invariant, constraint 4 references "≥2 distinct mcp entries in role: 'destination'" for branching, etc.); "What to avoid" list grows a bullet calling out the role tag as non-optional for mcp entries. The artifact-scope principle template in the commit-discipline section now writes `mcp/linear@0.1.0 (role=source), mcp/gdrive@0.1.0 (role=destination)` so the durable audit string carries the role.
- **Tool descriptions** in [lib/mcp/tools/mcp-orbit.js](lib/mcp/tools/mcp-orbit.js) — `list_mcp_orbit_components` and `get_mcp_orbit_component` input-schema enums now show `['mcp','trigger','pattern','idempotency','render']`, and descriptions teach the affordances + roles distinction. `recommend_mcp_orbit_compositions` description unchanged (the surface is the same; the inner shape changed).
- **Docs** — [docs/mcp-orbit.md](../docs/mcp-orbit.md) rewritten around the five-category + roles model; CLAUDE.md Ring 6 section, and `forward_context` Ring 6 + orientation-rule entries in [lib/mcp/tools/context.js](lib/mcp/tools/context.js) updated to use the new shape (the three places that listed the six-tuple `(source × destination × ...)` now list the five-tuple `(mcp × ...)` and explain roles inline).
- **Test suite** — repository tests gain coverage for: role validation (missing role on mcp entry, unknown role, role on non-mcp kind, same mcp ref in distinct roles), legacy-kind rejection, and the `MCP_ROLES` export. Loader tests use `mcp/` fixture dirs (the legacy `source/` dir is now skipped as a non-kind); a new test asserts every shipped mcp component declares its affordances map. Tool tests assert the recommender returns the expected role-tagged refs for the weekly-digest fixture (linear=source, gdrive=destination) and the e2e fixture's artifact-scope principle string uses the new `(role=source)` / `(role=destination)` shape. **All 391 lib tests pass.**

### Composer: signal-driven routing shape

The check that the role refinement actually generalizes. 0.4.0's substrate produced exactly one canonical workflow shape (scheduled aggregation: Linear → Drive weekly digest). If the composer can't generalize past that — if "ship more components" produces "more variants of the same canonical shape" — the role refactor's worth questioning. This change ships the components for an orthogonal shape (signal-driven routing: Gmail → Linear support handoff) and proves the composer assembles it end-to-end from the same store. The e2e test asserts the recommender picks `signal-polled / routing / source-side-label` for the gmail-support intent and `scheduled / aggregation / window-key` for the weekly-digest intent without any prompt engineering past the operator's natural-language ask. Composition surface validated.

#### Added

- **Four new starter components** that together compose the gmail-support-thread-to-linear-issue catalyst from typed parts:
  - [mcp-orbit-components/mcp/gmail.md](lib/mcp/mcp-orbit-components/mcp/gmail.md) — Gmail MCP with `affordances: { read: true, write: true, watch: true }`. Source-role surface covers `search_messages` + `get_thread` + `list_history` with the history-id cursor; destination-role covers `send_message` / `create_draft` / `modify_labels` with the draft-first discipline. Pitfalls call out the reply-loop hazard (the `exclude_self` knob is on by default), the history-id horizon (~7 days, fall back to date-window + re-baseline), and labels as the state surface for `idempotency/source-side-label`. Watch affordance declared `true` but the body explicitly notes that polling is the default — Pub/Sub push requires GCP setup almost no operator has done.
  - [mcp-orbit-components/trigger/signal-polled.md](lib/mcp/mcp-orbit-components/trigger/signal-polled.md) — cadence-based polling trigger for source MCPs that don't push. Carries the cursor discipline (advance ONLY after all per-event downstream writes succeed), the first-run cursor default (`now`, never `beginning` — backfill is an explicit opt-in), and the two-part safety constraint (requires source `capabilities.cursor: true` AND an idempotency component; pre-flight checks surface `signal_polled_without_source_cursor` as a warning). Re-entrant polling, cursor-horizon expiry, empty-poll burn, and quota cliffs are all called out as pitfalls with concrete mitigations.
  - [mcp-orbit-components/pattern/routing.md](lib/mcp/mcp-orbit-components/pattern/routing.md) — 1:1 cognitive shape (each source event → one destination record), the complement to `pattern/aggregation`'s N:1. Four knobs (`match_filter`, `routing_target`, `include_source_context`, `reply_to_source`) with prescriptive defaults; pitfalls cover TOCTOU under overlapping polls, reply loops, archived destinations, and PII in routed records. Redirect rules point intent that's actually aggregation / enrichment / branching back to those patterns instead of stretching routing past its shape.
  - [mcp-orbit-components/idempotency/source-side-label.md](lib/mcp/mcp-orbit-components/idempotency/source-side-label.md) — the TOCTOU-safe dedupe strategy for signal-driven workflows. After a successful destination write, apply a marker on the source-side event (Gmail label, Slack reaction, source-MCP-specific affordance) and auto-extend the source query with `-marker:<name>` so subsequent polls exclude processed events. Body explicitly maps the two timing modes (`on_destination_success` is the right default; `on_processing_start` is faster-but-loses-events-on-failure) and is candid about the residual TOCTOU window under overlapping polls — full safety requires either re-entrance prevention at the trigger (default v0 posture) or a destination-side existence check before write. Hard `fits.triggers: ['signal-polled', 'signal-push']` constraint means the recommender doesn't propose this with `scheduled`.
- **`intentKeywords` payload field** added to every shipped non-mcp component (`trigger/scheduled`, `trigger/signal-polled`, `pattern/aggregation`, `pattern/routing`, `idempotency/window-key`, `idempotency/source-side-label`). The recommender uses these to pick the trigger / pattern / idempotency that fit the operator's natural-language ask — "when X happens, file Y" picks `signal-polled + routing + source-side-label`; "weekly X digest into Y" picks `scheduled + aggregation + window-key`. The `mcp/linear`, `mcp/gdrive`, `mcp/gmail` components also gained `intentKeywords` but the mcp selection still uses the existing `intentMentionIndex` (earliest mention = source, latest = destination) — the keywords are additive metadata for future ranking refinements.

#### Changed

- **`buildCandidateComposition`** in [lib/mcp/tools/mcp-orbit.js](lib/mcp/tools/mcp-orbit.js) — generalized past the canonical-shape v0 picker. Two new helpers (`intentKeywordScore`, `pickByIntent`) rank candidates by `intentKeywords` matches in the operator's intent prose, with alphabetical tiebreak for determinism. `fitsTrigger` enforces the per-component `fits.triggers` constraint so a pattern / idempotency that only pairs with `scheduled` doesn't get proposed alongside `signal-polled`. The picking order is now: trigger → pattern (filtered to those that fit the trigger) → idempotency (filtered to those that fit the trigger). When the filter empties the candidate pool (no pattern fits the chosen trigger), the recommender falls back to the unfiltered pool rather than refusing to return a candidate — a candidate with a constraint warning is more useful than a `no_components_available` 4xx.
- **Loader test suite** in [lib/mcp/mcp-orbit-components/loader.test.js](lib/mcp/mcp-orbit-components/loader.test.js) — shipped-components assertion bumped from 5 to ≥9 components and now lists every kind/ref pair across both shapes. New test asserts every non-mcp shipped component declares a non-empty `intentKeywords` array (the recommender depends on this; a missing keyword set silently breaks shape disambiguation).
- **Tool test suite** in [lib/mcp/tools/mcp-orbit.test.js](lib/mcp/tools/mcp-orbit.test.js) — `list_mcp_orbit_components` assertion expanded to cover all 9 shipped refs. Two new test blocks exercise the gmail-support shape end-to-end: one asserts the recommender returns the right role-tagged components (`mcp/gmail@source`, `mcp/linear@destination`, `trigger/signal-polled`, `pattern/routing`, `idempotency/source-side-label`), and the second walks the full seven-step composition flow against this shape (recommend → meta-catalyst → component bodies → knob negotiation → status transitions → audit log entry). The second test also verifies the `mcp/gmail` body carries BOTH a source-role section AND a destination-role section — the role refinement only pays off if mcp bodies actually teach both sides. **All 394 lib tests pass** (391 → 394: +3 for the gmail-support shape coverage).

#### Composition outcomes

The composer now generalizes past the single canonical shape:

- **Weekly Linear digest into Drive** (intent: `"weekly Linear digest into Drive — Monday morning summary so I stop opening Linear every week"`) → composes `mcp/linear (source) + mcp/gdrive (destination) + trigger/scheduled + pattern/aggregation + idempotency/window-key`.
- **Gmail support thread routed into Linear** (intent: `"When a Gmail support thread arrives in the inbox, file a Linear issue with the conversation context"`) → composes `mcp/gmail (source) + mcp/linear (destination) + trigger/signal-polled + pattern/routing + idempotency/source-side-label`.

Both compositions assemble from the same store, validate against the same constraint table, and persist as audit-able rows in the composition log.

### Primitive-binding layer

A second layer parallel to the vendor-shaped mcp-orbit composer: curated **vendor-agnostic primitive bodies** (`document-store`, `structured-record-store`) plus a **deterministic generator** that fills role-specific markdown templates against a capability snapshot the agent introspects from each installed MCP. The two layers coexist intentionally — the vendor composer ships curated vendor-specific knowledge (pitfalls, intent), the primitive layer covers vendor-agnostic tool-shape via introspection. A cauterize gate (`MOJULO_MCP_ORBIT_VENDOR_DISABLED=1`) lets the operator force the agent through the primitive flow without removing the vendor surface — useful for proving end-to-end coverage before retiring vendor curation.

#### Added

- **Two primitives** under [mcp-orbit-components/primitive/](lib/mcp/mcp-orbit-components/primitive/), each as a body + source-role template + destination-role template:
  - `document-store` (Drive, Notion, OneDrive, Dropbox, S3-with-keys) — `find-by-key-in-scope` / `read-content` / `list-recent` / `get-metadata` / `subscribe-to-changes` affordance set. Per-role templates carry slot markers for tool name + schema fill at bind time.
  - `structured-record-store` (issue trackers — Linear, GitHub Issues, Jira; CRMs — HubSpot, Salesforce, Pipedrive; spreadsheet-databases — Airtable, Notion DB) — `find-by-filter` / `read-content` / `list-recent` / `create-record` / `comment-on-record` / `transition-status` / `update-fields` / `upsert-by-key` affordance set. The primitive deliberately spans typed-record backends across all three categories — what unifies them is the typed-record shape and structured-filter query. Cross-primitive overlap with `document-store` is called out in the body so authors of future primitives see when names should rhyme vs diverge.
- **Capability-snapshot generator** in [mcp-orbit-components/generator.js](lib/mcp/mcp-orbit-components/generator.js) — deterministic template fill (no LLM in the generator itself) that takes a primitive body, a role-specific template, and a capability snapshot and produces a session-scoped provider artifact with affordance binding manifest + tool-name resolution + confidence labels per affordance. Three-tier confidence: `tools_list_full` (introspected with schemas) > `names_only` (tool names but no schemas) > `agent_inferred` (agent best-guess from prior knowledge).
- **`mcp_orbit_provider_artifacts` table** in [control/data/mojulo-lite.db](data/) — stores generated artifacts so the agent can reference a stable ref between `bind_primitives` and the subsequent `meta_context_commit`, and so the artifact is auditable as the durable link between primitive + snapshot + bound tool names + confidence. Repository in [lib/db/repositories/mcp-orbit-provider-artifacts.js](lib/db/repositories/mcp-orbit-provider-artifacts.js); columns: `primitive_ref`, `role` (`source` | `destination` CHECK), `server`, `introspected_at`, `snapshot_confidence`, `body_md`, `manifest_json`, `bindings_json`.
- **`bind_primitives` MCP tool** in [lib/mcp/tools/mcp-primitive-binding.js](lib/mcp/tools/mcp-primitive-binding.js) — Ring 6 tool registered LAST. Takes a composition ref + per-primitive-role binding spec, loads each primitive's role-specific template, fetches the live capability snapshot from `meta_mcp_inventory`, runs the generator, persists the artifact, and returns the artifact ref + affordance binding manifest. The split from `get_meta_catalyst` is deliberate: meta-catalyst is the rulebook (cacheable per session), bindings are per-composition synthesis (not cacheable).
- **Extended capability snapshots in `meta_mcp_inventory`** — `input_schema_json` (per-tool JSON schema as introspected) + `introspection_confidence` (the three-tier confidence label) columns added via [migrateInventoryColumns](lib/db/index.js) (backward-compatible — existing rows have NULL, generator treats NULL as `names_only`). The `meta_context_declare_inventory` tool accepts the richer per-tool shape; old shape still works (silently downgrades to `names_only` confidence for those tools).
- **Adapter teaching** in [adapters/claude-code.md](lib/mcp/adapters/claude-code.md), [adapters/codex.md](lib/mcp/adapters/codex.md), [adapters/generic.md](lib/mcp/adapters/generic.md) — each adapter body grows a primitive-binding section explaining the introspection step the host agent is responsible for, the artifact-ref handoff to `meta_context_commit`, and how the artifact's bindings map onto the host's downstream rendering. Combined +266 lines.
- **Cauterize gate** in [lib/mcp/server.js](lib/mcp/server.js) — when `MOJULO_MCP_ORBIT_VENDOR_DISABLED=1`, `registerMCPOrbitTools()` is skipped. The primitive-binding tool registers regardless. Tests don't set the flag and continue to register the full surface. The gate exists for operators who want to force the agent through the primitive flow without removing the vendor composer's commits — a deliberate parallel-track posture during the transition.

#### Changed

- **`meta_context_brief`** in [lib/mcp/tools/meta-context.js](lib/mcp/tools/meta-context.js) — extended +280 lines to surface primitive-binding artifacts on fleet briefs, with corresponding test coverage +250 lines. `forward_context` Ring 6 section gains the primitive-binding flow as the second layer alongside the vendor composer.

### Decuration prep

Forward-declarations against the next change. Adds a fourth vendor body following the same bidirectional shape as the existing three, and a catalyst that defines the agent's research methodology for vendor knowledge. The catalyst references tools (`record_mcp_capabilities`, `get_mcp_capabilities`) that arrive in the next change — committed early as the prose-and-process is stable independent of the persistence side.

#### Added

- [mcp-orbit-components/mcp/notion.md](lib/mcp/mcp-orbit-components/mcp/notion.md) — fourth vendor body. Multi-faceted: page-side surface (`notion-search` / `notion-fetch` / block-tree content model) and data-source-side surface (`notion-query-data-sources` / row-in-data-source writes). Pitfalls cover the API 2025-09-03 `database` → `data_source` rename, search title-only semantics, the 100-block per-children cap, page-vs-data-source-row schema mismatch, and integration-sharing being page-level not workspace-level. The richest of the four vendor bodies — sets the bar for the depth a researcher should target.
- [catalysts/research-mcp-vendor.md](lib/mcp/catalysts/research-mcp-vendor.md) — catalyst defining the agent's methodology for researching an MCP end-to-end via primary web sources: source priority order (server source/README → official monorepo → vendor developer docs → package metadata → registry), the triangulation rule (non-trivial claims need a priority-1 or priority-3 backing), what to extract (tool list with input schemas, affordances, capabilities, intent keywords, pitfalls), the canonical output body shape (matching the four existing vendor bodies), honesty rules (mark unconfirmed claims, refuse training-data priors, cite even single-fact contributors), multi-server-per-vendor handling, behavior contract. Forward-declares against `record_mcp_capabilities` / `get_mcp_capabilities` — the catalyst is shape-stable; the tools land next.

### Decuration: provider identity layer + capabilities persistence

The implementation arrives behind the [research-mcp-vendor catalyst](lib/mcp/catalysts/research-mcp-vendor.md) committed earlier. Two new Ring 6 tables — `meta_mcp_providers` (identity layer) and `meta_mcp_capabilities` (vendor knowledge facet with append-with-supersession semantics) — plus a `provider_id` foreign key on `meta_mcp_inventory` so both paths to knowing an MCP (introspection and research) converge on the same provider row. The supersession invariant is enforced at the DB layer via a unique partial index; a deterministic four-rule canonicalizer derives `provider_ref` from raw server names so the identity layer populates as a side-effect of inventory writes — no `register_mcp_provider` tool needed, by design. This drop is the persistence side only; the MCP tool surface (`record_mcp_capabilities` / `get_mcp_capabilities`), the seed migration that ships the four vendor bodies as starter rows, the composer rewiring that consumes the consolidated view, and the cauterize gate removal land in subsequent drops.

#### Added

- **`meta_mcp_providers` + `meta_mcp_capabilities` tables** in [control/data/mojulo-lite.db](data/), schema in [lib/db/index.js](lib/db/index.js). Providers: one row per logical MCP keyed on canonical lowercase `provider_ref` (e.g. `gmail`, `notion`, `linear`) with first-writer-wins `display_name`. Capabilities: `provider_id` FK + `version_tag` (nullable when docs declare nothing) + `body_md` + `source_urls` (JSON array) + `discovered_at` + `superseded_by`, with a **unique partial index** `idx_meta_mcp_capabilities_current ON meta_mcp_capabilities(provider_id) WHERE superseded_by IS NULL` enforcing at most one current row per provider. Supersession is mandatory, not optional. `ON DELETE CASCADE` from providers so removing a provider row cleans up its capability chain.
- **`provider_id` column on `meta_mcp_inventory`** via the existing `migrateInventoryColumns` pattern, plus `idx_meta_mcp_inventory_provider` index. Backward-compatible — existing rows have NULL provider_id, populated lazily on the next inventory replace. Capabilities indexes follow the `idx_meta_mcp_*` naming convention for consistency with the inventory indexes.
- **Canonicalizer** in [lib/mcp/providers/canonicalize.js](lib/mcp/providers/canonicalize.js) — pure four-rule function (lowercase → strip leading host prefix `claude_ai_` / `claude-` / `@vendor/` scope → strip trailing MCP suffix `-mcp-server` / `_mcp_server` / `-mcp` / `_mcp` → normalize separators to underscore). Genuine ambiguity is the agent's job to disambiguate via explicit `provider_ref` on capability writes; v0 has no inventory-time override (additive v1 if collision rate justifies). Examples: `claude_ai_Gmail` → `gmail`; `claude_ai_Google_Drive` → `google_drive`; `@notionhq/notion-mcp-server` → `notion`; `notion-mcp-server` → `notion`; `linear` → `linear`.
- **Providers repository** in [lib/db/repositories/mcp-providers.js](lib/db/repositories/mcp-providers.js): `upsertByRef` (first-writer-wins on `display_name`; subsequent calls return the existing row without overwriting), `getByRef`, `getById`, `listAll`. No `register_mcp_provider` MCP tool — providers are upsert side-effects only, since a row with no facets is useless. Identity-row corrections (display_name typos, provider_ref splits) deferred to v1 per the plan.
- **Capabilities repository** in [lib/db/repositories/mcp-capabilities.js](lib/db/repositories/mcp-capabilities.js): `insert` (transactional upsert-provider + insert-with-supersession in one txn), `getCurrent`, `getAsOf` (walks the chain to find the row current at a given unix timestamp), `listForProvider`, `consolidatedView` (composer-facing JOIN of provider identity + inventory facet + capabilities facet, with `provenance: 'seed' | 'research'` derived from `sourceUrls[0]` — `mojulo://` prefix marks the row as a build-time seed, anything else as agent-research). The supersession dance is **three statements** (insert new with `superseded_by = prior.id` as non-NULL placeholder → flip prior's `superseded_by` to `new.id` → clear new's `superseded_by` to NULL) because SQLite's unique partial index fires per-statement, not at commit; briefly produces a benign FK cycle. Documented inline in the repository header.

#### Changed

- **`InventoryRepository.replaceInventory`** in [lib/db/repositories/mcp-inventory.js](lib/db/repositories/mcp-inventory.js) — within the existing replace transaction, each server name is canonicalized once and the matching provider row is upserted; `provider_id` is stamped on every tool row. Two install aliases that canonicalize to the same provider (e.g. `claude_ai_Notion` + `notion-mcp-server`) share the same `provider_id`, collapsing into one logical "notion" provider — the identity layer working as designed. The tool's input shape is **unchanged** — provider resolution is purely additive on the write path. Orphan provider rows persist after inventory replace (no cleanup in v0); their capabilities remain queryable for historical `getAsOf` walks, and the next inventory declare reuses them if the alias comes back. `rowToTool` now exposes `providerId` on returned rows.
- **Test suite** — **+100 new tests** across the new modules. 32 for the canonicalizer (example cases + lowercase normalization + leading prefix handling + trailing suffix handling + separator normalization + error cases + idempotency + rule-table invariants). 25 for the providers repository (schema bootstrap + UNIQUE enforcement + upsert idempotency + first-writer-wins + display_name normalization + multi-provider isolation + validation). 37 for the capabilities repository (schema bootstrap + unique partial index + FK cascade + first-insert + supersession chain across three writes + raw-SQL bypass rejection + isolation across providers + `getAsOf` walk + `consolidatedView` across five facet combinations + provenance derivation). 6 added to [lib/db/repositories/mcp-inventory.test.js](lib/db/repositories/mcp-inventory.test.js) (provider row creation + provider_id stamping + alias collapse + `rowToTool.providerId` + orphan persistence + linear edge case). [lib/db/repositories/meta-context.test.js](lib/db/repositories/meta-context.test.js) assertion lists updated for the new tables/indexes. **All 579 lib tests pass.**

### Decuration: capability tools + seed migration

The forward-declared tools land. `record_mcp_capabilities` and `get_mcp_capabilities` ship as Ring 6 MCP tools; the `research-mcp-vendor` catalyst's `mcpTools.mojulo` references are now real. The four curated vendor bodies relocate from `mcp-orbit-components/mcp/` to `seeds/mcp-capabilities/` and ship via a seed migration that materializes them as starter rows on first boot — honestly attributed to mojulo (`source_urls[0]` is `mojulo://CHANGELOG#v0.5.0`, `discovered_at` is the v0.5.0 release sentinel, `provenance` is `seed`). The `'mcp'` kind drops from the component loader's allowlist; vendor knowledge is no longer a composable component, it's a Ring 6 surface. The composer rewiring that consumes the consolidated provider view lands next.

#### Added

- **`record_mcp_capabilities` + `get_mcp_capabilities`** in [lib/mcp/tools/mcp-capabilities.js](lib/mcp/tools/mcp-capabilities.js), registered in [lib/mcp/server.js](lib/mcp/server.js) between `registerInventoryTools()` and the cauterize-gated mcp-orbit composer. Drive the capabilities repository's transactional supersession + `asOf` chain walks; surface a `no_operator_anchor` warning when KYC is missing; return a `hint` pointing at the catalyst when no row exists.
- **Seed migration** at [lib/mcp/seeds/mcp-capabilities-seed.js](lib/mcp/seeds/mcp-capabilities-seed.js) — `seedMcpCapabilities()` parses each seed body's frontmatter for `capabilities.apiVersion` and the `<!-- sources -->` URLs, inserts one starter row per provider where none exists. Per-provider idempotent — agent-research rows are never overwritten. Called lazily from `registerCapabilitiesTools()` so test isolation stays intact.
- **`seeds/mcp-capabilities/{gmail,linear,gdrive,notion}.md`** — the four curated vendor bodies in their new location.

#### Changed

- **`COMPONENT_KINDS` in [lib/db/repositories/mcp-orbit.js](lib/db/repositories/mcp-orbit.js)** drops `'mcp'`; new enum `['trigger', 'pattern', 'idempotency', 'render']`. The SQL `CHECK` constraint is intentionally untouched (v0.4.x DB compat; the loader's `deleteAllBuiltins()` clears any leftover `'mcp'` rows on next boot). Composition `component_refs` validation still recognizes `kind: 'mcp'` entries — those resolve to provider rows under the composer rewiring landing next.
- **Loader + repo tests** updated for the new layout: fixtures switched from `'mcp'` to `'pattern'` (behavior under test is kind-agnostic), shipped-component assertion drops the four `mcp/*` refs (≥9 → ≥6), legacy-kinds-skip test now covers `'mcp'`. **+46 tests across the two new modules (24 capabilities tools + 22 seed migration); 612 lib tests pass, 12 recommender failures expected — they resolve in the next drop.**

### Decuration: composer rewiring + cauterize revert + smoke

The closing chapter. The mcp-orbit composer now reads vendor knowledge through a **consolidated provider view** (`CapabilitiesRepository.consolidatedView`) that joins the identity layer with both facets — inventory introspection and capabilities research — into one record per logical MCP. Five composer states per chosen provider — `research`, `seed`, `inventory_only`, `capabilities_only`, `none` — each with its own warning tag (`seed_capabilities:<ref>` / `no_capabilities_recorded:<ref>` / `not_installed:<ref>`) so the agent routes remediation directly. The `rationale.catalystHint` field surfaces the research-mcp-vendor catalyst by name when at least one chosen provider isn't research-grade. With the composer reading from Ring 6 surfaces end-to-end, the cauterize gate becomes unnecessary and reverts: `MOJULO_MCP_ORBIT_VENDOR_DISABLED` no longer skips the composer, and the `forward_context` banner that warned about it is removed. The forward_context Ring 6 section is rewritten around the new architecture (identity layer + two facets + composer's consolidated read), and the fleet brief gains a `vendorKnowledge` section keyed by provider with `provenance` + freshness.

#### Added

- **Catalyst smoke tests** in [lib/mcp/tools/mcp-capabilities.test.js](lib/mcp/tools/mcp-capabilities.test.js) — five end-to-end scenarios exercising the full vertical: seed → tool surface → composer re-read. Verifies notion starts as `provenance: 'seed'`, the catalyst's `record_mcp_capabilities` call supersedes the seed and flips provenance to `'research'`, `asOf` walks back to the seed row from before the supersession, the composer drops the `seed_capabilities:notion` warning after the research write, and re-running the seed migration after research is a no-op (agent rows are never clobbered).
- **`vendorKnowledge` section on `meta_context_brief({kind:'fleet'})`** — keyed by provider, surfaces `{ provider_ref, display_name, hasInventory, hasCapabilities, capabilitiesVersionTag, capabilitiesDiscoveredAt, ageSeconds, capabilitiesProvenance }`. `provenance: 'seed' | 'research'` distinguishes build-time seed bodies from agent-research; `ageSeconds` computed at read time. Agents read this to decide when to invoke the research catalyst.

#### Changed

- **Composer in [lib/mcp/tools/mcp-orbit.js](lib/mcp/tools/mcp-orbit.js)** rewired around the providers identity layer. `buildCandidateComposition` enumerates providers via `ProvidersRepository.listAll()`, reads each through `CapabilitiesRepository.consolidatedView`, and collapses the result into a `providerProfile` (state + affordances + intent-matching hints + installed flag). Source/destination selection prefers installed providers, breaks ties on earliest/latest intent mention. The five composer states gate the warning vocabulary; `not_installed:<ref>` / `seed_capabilities:<ref>` / `no_capabilities_recorded:<ref>` replace the prior `source_not_in_inventory:` / `destination_not_in_inventory:` pattern. `listComponentsHandler({kind:'mcp'})` and `getComponentHandler({kind:'mcp'})` now serve from the providers identity layer (capabilities body + frontmatter parsed as payload) so the agent-facing API stays consistent across kinds without exposing the storage shift. The pre-decuration `inventoryMatchesHints` helper is removed — provider identity collapses install aliases at the canonicalizer step, so the composer no longer fuzzy-matches server names at recommendation time. The `inventory` input param to `recommend_mcp_orbit_compositions` is also removed — the composer reads providers directly.
- **`gdrive` → `google_drive` rename** in [seeds/mcp-capabilities/google_drive.md](lib/mcp/seeds/mcp-capabilities/google_drive.md) and the seed migration's `DISPLAY_NAMES` map. Aligns the seed body's `provider_ref` with what the canonicalizer produces for `claude_ai_Google_Drive` (the standard Claude Code MCP namespace for the Drive vendor), so seeded research-grade knowledge and operator inventory converge on the same provider row instead of fragmenting into `gdrive` + `google_drive`. Test fixtures and audit-string examples updated to match.
- **Cauterize gate reverted** — `MOJULO_MCP_ORBIT_VENDOR_DISABLED` env flag check in [lib/mcp/server.js](lib/mcp/server.js) removed; `registerMCPOrbitTools()` always registers now. The conditional banner in [lib/mcp/tools/context.js](lib/mcp/tools/context.js) that announced "vendor-shaped composer is disabled" is removed entirely. The composer is the supported primary path; the primitive-binding layer ([lib/mcp/tools/mcp-primitive-binding.js](lib/mcp/tools/mcp-primitive-binding.js)) continues to ship alongside it as the runtime-introspected alternative.
- **`forward_context` Ring 6 section** rewritten to introduce the providers identity layer + the two facets + the seeding posture + the research-mcp-vendor catalyst as the refresh path. Heading updated to "Deliberation (Ring 6 — the substrate for structural reasoning: contextmap, inventory, capabilities, composer)"; new `record_mcp_capabilities` / `get_mcp_capabilities` bullet; composer bullet rewritten around the five-state taxonomy and the warning tag vocabulary that drives the agent's remediation routing.

#### Composition outcomes

Identity layer in production. **All 629 lib tests pass across 26 files**: +5 from the catalyst smoke and the test suite updates that exercise the consolidated view, the new warning tags, and the catalyst hint. The 12 recommender failures from the previous drop resolve. The decuration arc closes: identity + facets + tools + seeds + composer + catalyst all wired together; vendor knowledge moves from build-time curation through agent research at the operator's own clock, with full audit chain via supersession.

### Primitive domain expansion + posture shift

With the primitive-binding architecture and the four-primitive ambition validated against `document-store` and the renamed `structured-record-store`, the next move was to push the primitive layer past the two original shapes and prove the generator + binding flow generalizes. This release also flips the recommended-composer posture: `bind_primitives` is now the supported path for MCP-to-MCP composition (the path most MCP-capable agents will take, since runtime tool-schema knowledge is the common case), and the vendor-shaped `recommend_mcp_orbit_compositions` flow steps back to seed-reasoning duty for first-encounter scaffolding.

#### Added

- **Two new primitives** under [mcp-orbit-components/primitive/](lib/mcp/mcp-orbit-components/primitive/), each as body + source-role template + destination-role template:
  - `messaging-channel` (Slack, Discord, Teams) — scope-addressable chat with thread sub-grouping, audience is scope members. `list-recent-in-scope` / `read-content` / `find-by-filter` / `get-metadata` / `subscribe-to-changes` source-role; `post-to-scope` / `post-to-thread` / `react-to-message` / `post-ephemeral` destination-role. The `-in-scope` suffix on `list-recent-in-scope` is load-bearing: messaging-channel reads require a scope id, unlike `document-store`'s flat `list-recent`. Cross-primitive overlap is called out per affordance — names rhyme across primitives only where the underlying shape genuinely transfers.
  - `message-thread` (Gmail, Outlook) — directed mail semantics with reply identity, audience is *named recipients*, threads grow by reply. `search-threads` / `read-thread` / `list-recent-in-mailbox` / `get-thread-metadata` / `subscribe-to-new-messages` source-role; `send-thread-message` / `create-draft` / `apply-label` destination-role. The audience model is what distinguishes this from `messaging-channel`: scope-broadcast (channel) vs recipient-directed (thread). The two primitives deliberately stay separate.
- **Capability-generator integration with all four primitives** — [generator.js](lib/mcp/mcp-orbit-components/generator.js) and [primitive-binding.js](lib/mcp/tools/mcp-primitive-binding.js) tool description now name all four primitives explicitly. Generator tests cover Linear and GitHub fixtures binding `structured-record-store` (typed-record shape across issue-tracker-flavored backends) to validate the generator + slot vocabulary survive a second primitive without changes; the test block frames the validation explicitly as "the gate before plumbing a tool surface around the architecture." CRM (HubSpot) and spreadsheet-database (Airtable, Notion DB) fixtures are deferred as future coverage.

#### Changed

- **`issue-tracker` → `structured-record-store` rename, with broadened backing scope.** The `issue-tracker` primitive (Linear / GitHub Issues / Jira / Asana / Shortcut) is renamed and generalized to `structured-record-store` — same affordance vocabulary, but the primitive now spans **issue trackers + CRMs (HubSpot, Salesforce, Pipedrive) + spreadsheet-databases (Airtable, Notion DB)**. The unifying shape is **typed records with stable ids, structured-field queries, and optional status / comment / upsert workflows**; what varies — status workflow vs stage-as-field, native upsert vs simulate, threading vs flat comments — is captured per-affordance in the support taxonomy. Affordances renamed to match the broader scope: `create-issue` → `create-record`, `comment-on-issue` → `comment-on-record`, `update-issue-fields` → `update-fields`, plus a new `upsert-by-key` affordance for CRM / spreadsheet-DB sync workflows (rare on issue trackers, defining on CRMs). Old primitive files (`primitive/issue-tracker.*`) deleted; mcpInventoryCategory `issue_tracker` → `structured_record_store` propagated through the linear seed body, the three mcp-orbit catalysts (`gmail-support-thread-to-linear-issue`, `linear-issue-closed-branched-notification`, `weekly-linear-digest-to-drive`), the `research-mcp-vendor` author guide, the mcp-orbit doc example, and the recommender test fixtures. Real-world descriptive uses of "issue tracker" (e.g. "Linear is an issue tracker") stay — those describe the world; the primitive name is what changed.
- **`bind_primitives` reframed as the recommended composer for MCP-to-MCP workflows.** The tool description in [mcp-primitive-binding.js](lib/mcp/tools/mcp-primitive-binding.js), the `forward_context` Ring 6 bullet in [context.js](lib/mcp/tools/context.js), and the three adapter docs (`adapters/claude-code.md`, `adapters/codex.md`, `adapters/generic.md`) all drop the "experimental / validating in parallel / parallel-track" framing and reframe as: primitive binding is the supported path; the vendor-shaped `recommend_mcp_orbit_compositions` flow remains as a seed-reasoning surface for first-encounter scaffolding when runtime tool-schema knowledge is missing. Section headings updated from "Primitive binding flow (parallel path, runtime-introspected)" → "Primitive binding flow (no-bot composition)" across all three adapters.
- **Doc orientation rewrite for the v0.5.0 surface.** [CLAUDE.md](../CLAUDE.md) Ring 6 section moves from three deliberation surfaces (contextmap / inventory / mcp-orbit composer) to **five** (adds capabilities and primitive-binding as distinct first-class surfaces with their own bullets), and the data-layout section now names every Ring 6 table including `meta_mcp_providers`, `meta_mcp_capabilities`, and `mcp_orbit_provider_artifacts`. [docs/mcp-orbit.md](../docs/mcp-orbit.md) gains a "Primitive-binding layer" section with the four-primitive table + the generator's deterministic-fill semantics + the artifact persistence + the `primitive_artifact_materialization` commit flow; the schema section adds the `mcp_orbit_provider_artifacts` DDL. [docs/meta-context.md](../docs/meta-context.md) documents the third `meta_context_commit` type (`primitive_artifact_materialization`) with full payload shape + behavior + audit-chain semantics, and the "What sits on top" section grows from one composer to three Ring 6 surfaces (capabilities + vendor-shaped composer + primitive-binding). [docs/mcp-integration.md](../docs/mcp-integration.md) Recipe 5 splits into "Primitive-binding flow (recommended)" + "Vendor-shaped composer flow (seed-reasoning fallback)" to teach the choice between the two paths.

### CI

#### Added

- **[.github/workflows/publish-release.yml](../.github/workflows/publish-release.yml)** — fires on `v*` tag push (e.g. `v0.4.0`), slices the matching `## [X.Y.Z]` section out of [CHANGELOG.md](CHANGELOG.md), and creates a GitHub Release with that body marked as `--latest`. Fails loudly if the section is missing — won't push a release tag with no changelog entry. `bot-v*` tags are unaffected — those start with `b` and are handled by `publish-bot-image.yml`.

## [0.4.0] — 2026-05-23

Ring 6 — the deliberation substrate — comes online. Three structurally-distinct surfaces (contextmap, inventory, mcp-orbit composer) decenter mojulo from the bot: the bot factory becomes one capability bay, Ring 6 becomes the hull. The release also activates the non-bot axis — operators can now use mojulo to compose MCP-orchestrated workflows over their installed MCPs (Gmail/Drive/Calendar/Linear/etc.) without deploying a chatbot at all, with the contextmap as the durable audit trail and the mcp-orbit composer as the synthesis surface.

`meta_context` ships as **Ring 6** — a writeable, durable deliberation surface that records *why* structural decisions were made, not just *what* happened. Two MVP write triggers (operator KYC and artifact materialization) with adapter-delegated verification, a graph schema of bots / catalysts / adapters / artifacts / mcp_tools / operator nodes plus seeded / materialized_by / runs_for / binds edges, and principles (markdown rationale) attached to either nodes or edges. The bright line is operational: writes happen at **structural** events (operator pivots, artifact materializations) — never at **outcome** events (conversations, automation runs). That asymmetry is what makes the layer auditable; outcomes happen at run-rate, structural decisions at deliberation-rate. The graph is **append-only by design** — no deprecation events, no tombstones, no auto-pruning. Operator owns manual cleanup via SQL. See [docs/meta-context.md](../docs/meta-context.md).

This release also closes a synthesis ↔ deliberation loop the design called out: `recommend_catalysts` now consults the contextmap automatically and surfaces both the operator anchor (`operatorAnchor` / `suggest_kyc`) and per-catalyst `priorMaterializations`, so the agent can triage overlap / synergy / orthogonality at the recommendation surface without remembering to call `meta_context_brief` first.

Building on the spine, this release also ships **`meta_context_declare_inventory`** — the entry point for using mojulo *without* deploying a chatbot. Mojulo's mainline tooling is heavily bot-shaped (build → deploy → operate → catalyst-against-a-bot); the inventory primitive activates the other axis: MCP-orchestrated workflows synthesized over the user's installed MCPs (Gmail/Drive/Calendar/Linear/HubSpot/etc.) directly, with mojulo as the deliberation anchor and audit trail rather than the conversational runtime. The connecting agent declares which MCPs are connected and which tools each exposes; once inventory is on record, the operator's broader environment is part of mojulo's worldmodel. The bright line gets a second axis at this surface: contextmap writes are sealed structural decisions (append-only); inventory writes are current environment state (replace). Mixing them would let the graph slowly diverge from reality — so inventory lives in its own table with **replace semantics** (DELETE + INSERT in one transaction), separate from `meta_nodes` / `meta_edges` / `meta_principles`. See [lite-template/integration/MCP_INVENTORY_PLAN.md](../lite-template/integration/MCP_INVENTORY_PLAN.md) for the design.

Sitting on top of inventory, this release also opens the **mcp-orbit component store** — the next infrastructure layer past hand-written mcp-orbit catalysts. Three monolithic mcp-orbit recipes gave us the vocabulary, but ~30% of every body was identical scaffolding and ~40% was pattern-shared with recipe-specific content; continuing down that path means hand-authoring N×M×T×K recipes for N sources × M destinations × T triggers × K patterns. The right move is to decompose: a constrained set of **typed components that combine multiplicatively** — `source` × `destination` × `trigger` × `pattern` × `idempotency` × `render` — that the agent assembles under the meta-catalyst's discipline. Server-stored (typed rows with validation), agent-composed (judgment under uncertainty). Each composition is logged as a first-class row so the recommendation itself is auditable, and the existing `meta_context_commit({type:'artifact_materialization', ...})` carries the composition ref forward as the durable link between the materialized artifact and the components it was built from. See [lite-template/integration/MCP_ORBIT_COMPONENT_STORE_PLAN.md](../lite-template/integration/MCP_ORBIT_COMPONENT_STORE_PLAN.md) for the design.

### Added
- **`meta_nodes` / `meta_edges` / `meta_principles` tables** in [control/data/mojulo-lite.db](data/) — three tables, six node kinds (`bot`, `mcp_tool`, `catalyst`, `adapter`, `artifact`, `operator`), four edge kinds (`binds`, `seeded`, `materialized_by`, `runs_for`), and principle scopes (`node` | `edge`) keyed by `(scope_kind, scope_id)`. `operator` is a singleton (`ref='self'`). Schema lives in [lib/db/index.js](lib/db/index.js); repository in [lib/db/repositories/meta-context.js](lib/db/repositories/meta-context.js). Sync methods (not async-by-convention like sibling repos) because better-sqlite3 transactions require sync work, and `MetaContextRepository.commit(fn)` is the entry point for atomic multi-row writes.
- **Ring 6 MCP tools** in [lib/mcp/tools/meta-context.js](lib/mcp/tools/meta-context.js):
  - `meta_context_brief({ scope: { kind, ref? } })` — read the contextmap subgraph + principles. `kind: 'fleet'` returns the whole graph (capped at 500 nodes; response carries `meta.capped: true` when hit); per-scope kinds return a 1-hop neighborhood. Empty fleet brief surfaces `meta: { empty: true, suggest_kyc: true }` so the agent knows to offer the operator KYC. Brief returns the contextmap as *recorded*, not as *currently active* — stale rows from operator-deleted artifacts are not auto-pruned (append-only by design); description tells the agent to cross-reference with `list_deployments` / filesystem before treating a binding as live.
  - `meta_context_commit({ type, ... })` — seal a structural decision. Two event types in MVP: `operator_kyc` (optional one-time bootstrap; `revise: true` stacks a new principle on the same operator node, old one stays for audit) and `artifact_materialization` (atomic per-materialization seal that upserts bot / adapter / catalyst / artifact / mcp_tool nodes, the four edges between them, and any principles attached to specific scopes — `'artifact' | 'catalyst' | 'adapter' | 'bot'` for nodes; `'seeded' | 'materialized_by' | 'runs_for' | 'binds' | 'binds:<mcp_tool_ref>'` for edges).
- **Adapter-delegated artifact verification** in [lib/mcp/meta-context/verification.js](lib/mcp/meta-context/verification.js) — runs BEFORE any DB write during `artifact_materialization`. `claude-code` and `generic` require `existsSync(locator)`. `codex` requires `existsSync` for filesystem-shaped locators (absolute / `./` / `../`) but **accepts opaque automation handles on the agent's assertion** with a `note: 'codex_accept_on_assertion'` in the response — deliberate MVP relaxation since the control plane can't round-trip to Codex from here. Unknown adapter ids are rejected (the adapter loader is the source of truth).
- **Operator anchor surfacing in `recommend_catalysts`** — both single-bot and fleet responses now carry either `operatorAnchor: { role, latestPrinciple }` (when the operator node exists) or `suggest_kyc: true` (when it's missing). Agent uses locked-in constraints to self-clamp suggestions; automated clamping is explicitly deferred to a post-MVP arbiter.
- **`priorMaterializations` per catalyst in `recommend_catalysts`** — every recommendation carries `[{ botRef, botName, artifactRef, artifactLabel, adapterId, materializedAt, latestArtifactPrinciple }]` listing every prior materialization of THAT catalyst anywhere in the fleet, most-recent-first. Reading rule (in tool description): empty → orthogonal pattern; prior on a *different* bot → fleet pattern, align with prior binding choices unless intentionally diverging; prior on the *same* bot → likely duplicate, confirm intent before re-materializing. Closes the synthesis ↔ deliberation loop without coupling `get_catalyst` to the graph.
- **`forward_context` Deliberation section** — new Ring 6 entry in the tool index documenting both meta_context tools, plus a "why was X bound this way?" entry in Quick orientation rules distinguishing the deliberation surface from operational rollups (`fleet_*`) and content reads (`operate.*`).
- **[docs/meta-context.md](../docs/meta-context.md)** — public-facing doc covering the bright line, two-layer (contextmap + principles) model, schema, both event types, adapter-delegated verification (including the codex accept-on-assertion relaxation), cross-ring integration, worked example end-to-end, append-only-by-design policy with the manual cleanup escape hatch, and explicitly-deferred extensions (arbiter, curation, passive writes, audit chain on principles, dashboard). Now also covers the **Inventory (current-state cache, alongside the contextmap)** section explaining why inventory got its own table with replace semantics instead of being shoehorned into the append-only graph.
- Lazy `DB_PATH` resolution in [lib/db/index.js](lib/db/index.js) — `process.env.SQLITE_PATH` is now read at first `getDb()` call instead of at module load, unblocking `:memory:` test isolation for the new repository tests (and any future DB-touching tests). Production behavior unchanged.
- **`meta_mcp_inventory` table** in [control/data/mojulo-lite.db](data/) — single table with `(server, tool_name, tool_ref, description, declared_at)` columns and `UNIQUE(server, tool_name)`. Sits alongside the append-only contextmap on purpose: inventory is the operator's present environment, not a sealed decision, so it gets replace semantics instead of append. Schema lives in [lib/db/index.js](lib/db/index.js); repository in [lib/db/repositories/mcp-inventory.js](lib/db/repositories/mcp-inventory.js). Sync methods matching the meta-context repository pattern.
- **`meta_context_declare_inventory` MCP tool** in [lib/mcp/tools/mcp-inventory.js](lib/mcp/tools/mcp-inventory.js) — atomic `DELETE FROM meta_mcp_inventory; INSERT` in one transaction; latest declaration wins. Returns `{ ok, serversSeen, toolsSeen, replaced, declaredAt, warnings? }`. `warnings: ['no_operator_anchor']` is appended when no operator KYC has been committed yet (inventory still saves; cue to surface KYC inline). Slotted into Ring 6 registration order in [lib/mcp/server.js](lib/mcp/server.js) immediately after `meta_context_commit` so the third Ring 6 surface (current-environment cache) sits next to the two contextmap surfaces. Tool description leads with the non-bot framing: *"Register the operator's broader MCP environment so mojulo can compose solutions that don't require deploying a chatbot."*
- **Inventory snapshot rides on fleet briefs** — `meta_context_brief({kind:'fleet'})` now returns `inventory: { servers, declaredAt, ageSeconds, toolCount }` alongside the contextmap subgraph. When never declared: `{ servers: [], declaredAt: null, ageSeconds: null, toolCount: 0 }`. Per-scope briefs do NOT include `inventory` — it's a fleet-level fact, not a neighborhood property. `ageSeconds` is computed at read time so consumers can decide freshness without re-querying.
- **`forward_context` quick-orientation rule for the non-bot axis** — new rule routing "user wants to automate something that doesn't involve a deployed chatbot" (operator-side workflows, MCP-to-MCP wiring, scheduled digests, signal-triggered automations) to `meta_context_declare_inventory` + direct synthesis, sitting next to the cross-bot catalyst rule for natural disambiguation. The Ring 6 glossary section is also re-framed as three distinct knowledge categories (what fired / why bound / what's available) rather than three flavors of audit tool.
- **[lite-template/integration/MCP_INVENTORY_PLAN.md](../lite-template/integration/MCP_INVENTORY_PLAN.md)** — design plan covering the philosophical move (mojulo decentered from the bot, two-tier epistemics for decisions vs environment, situated within the agent's broader ecosystem), the why-not-the-append-only-graph argument, the inventory tool surface, freshness mitigations, cross-ring touchpoints, and what's deferred for the broader MCP-orbit phase.
- **`mcp_orbit_components` and `mcp_orbit_compositions` tables** in [control/data/mojulo-lite.db](data/) — two-table substrate for the component store. Components: `(kind, ref, version, body_md, payload_json, source)` with `UNIQUE(kind, ref, version)`, six allowed kinds (`source`, `destination`, `trigger`, `pattern`, `idempotency`, `render`), `source` enum `builtin | custom` (schema accommodates user-registered custom components when `register_mcp_orbit_component` ships in v1). Compositions: `(ref, intent_md, component_refs, knobs_json, ranking_score, status, artifact_ref)` with status enum `proposed | dry_run | materialized | retired` — every recommendation persists as a `proposed` row so the recommendation itself is auditable, then state-machines forward as the agent dry-runs and materializes. Schema lives in [lib/db/index.js](lib/db/index.js); repositories in [lib/db/repositories/mcp-orbit.js](lib/db/repositories/mcp-orbit.js) with sync methods matching the meta-context pattern.
- **mcp-orbit component loader** in [lib/mcp/mcp-orbit-components/loader.js](lib/mcp/mcp-orbit-components/loader.js) — components ship as `.md` files under `<kind>/<ref>.md` with JSON frontmatter (required: `ref`, `version`, `summary`; optional: `requires`, `capabilities`, `constraints`, `exposesKnobs`, etc., all rolled into `payload_json` on the row). The filename basename must match the frontmatter `ref` so the file path is a stable typed identifier. `seedComponents()` drops all builtin rows and re-upserts on each call; the loader's once-flag short-circuits repeat calls in normal operation. Validation faults throw — the library is curated, not user input.
- **Five starter components** under [lib/mcp/mcp-orbit-components/](lib/mcp/mcp-orbit-components/) covering the weekly-digest assembly path: [source/linear.md](lib/mcp/mcp-orbit-components/source/linear.md) (cursor on `updated_at`, cost-based rate limit, pagination contract, PII-in-titles pitfall), [destination/gdrive.md](lib/mcp/mcp-orbit-components/destination/gdrive.md) (create-or-append, folder-scoped dedupe, draft posture, trash-isn't-delete pitfall), [trigger/scheduled.md](lib/mcp/mcp-orbit-components/trigger/scheduled.md) (cadence vocabulary, timezone resolution, **non-negotiable idempotency-required constraint**, DST drift), [idempotency/window-key.md](lib/mcp/mcp-orbit-components/idempotency/window-key.md) (composite key `${dest}-${period}`, ISO week disambiguation, search-before-create with exact-match verification), and [pattern/aggregation.md](lib/mcp/mcp-orbit-components/pattern/aggregation.md) (cognitive shape: many events → one summary, four knobs `window`/`grouping`/`depth`/`quiet_mode`, redirect rules to `routing` / `forwarding` / `enrichment` when this pattern doesn't fit).
- **Meta-catalyst body** at [lib/mcp/mcp-orbit-components/meta-catalyst.md](lib/mcp/mcp-orbit-components/meta-catalyst.md) — the composer's rulebook the agent reads once per session before assembling. Carries the six-category map, the hard constraint table (`trigger: scheduled` requires idempotency; `pattern: branching` requires ≥2 destinations; KYC PII constraint forbids body-summarizing render components; etc.), the ranking heuristic (inventory fit × 0.7 + KYC alignment × 0.2 + prior-materialization signal × 0.1), the seven-step composition flow (recognize → recommend → meta-catalyst → get_component per ref → negotiate knobs → dry-run → promote + meta_context_commit), the dry-run discipline (resolve → render → write one real reversible artifact), and the commit discipline (composition ref recorded in an artifact-scope principle as the durable link between artifact and components).
- **Four Ring 6 MCP tools** in [lib/mcp/tools/mcp-orbit.js](lib/mcp/tools/mcp-orbit.js):
  - `list_mcp_orbit_components({ kind?, ref_pattern? })` — discovery surface; returns kind/ref/version/summary per (kind, ref) — max-version row only so older versions don't pollute discovery. Bodies omitted on purpose; fetched via `get_mcp_orbit_component`.
  - `get_mcp_orbit_component({ kind, ref, version? })` — fetch one row with full `body_md` + structured payload (constraints, capabilities, `exposesKnobs`). Omitted `version` returns the highest semver string for that ref.
  - `get_meta_catalyst()` — singleton; returns the meta-catalyst body as plain-text content. Agents read it once per session before composing.
  - `recommend_mcp_orbit_compositions({ intent, inventory? })` — server-side does only the deterministic part: filters available components by the declared MCP inventory and the operator's KYC anchor, scores candidates, writes each as a `proposed` composition row, returns 1-3 ranked candidates with component refs + scoring rationale + constraint warnings (e.g. `scheduled_without_idempotency`, `source_not_in_inventory:linear`). The agent does the composition — pulls component bodies, negotiates knobs, dry-runs, materializes via host adapter, seals via `meta_context_commit`. Response also surfaces `operatorAnchor` / `nextSteps` walking the rest of the flow, and `warnings` (`no_operator_anchor`, `inventory_empty`, `inventory_stale`) when the recommendation is weaker than it could be.
- **mcp-orbit tools registered LAST within Ring 6** in [lib/mcp/server.js](lib/mcp/server.js) — the natural reading order is append-only contextmap → current-state inventory → composer (on top of both). `forward_context` tool index gains an entry routing mcp-orbit intents to `recommend_mcp_orbit_compositions` first, and the "automate something that doesn't involve a deployed chatbot" orientation rule now flows `meta_context_declare_inventory` → `recommend_mcp_orbit_compositions` instead of "declare inventory then synthesize a skill directly."
- **[lite-template/integration/MCP_ORBIT_COMPONENT_STORE_PLAN.md](../lite-template/integration/MCP_ORBIT_COMPONENT_STORE_PLAN.md)** — design plan covering the architectural lesson from meta-context applied forward (typed server-side store with disciplined write rules turns into queryable infrastructure), why typed-store-not-markdown, the six-category model with composition constraint examples, both table schemas with the option-(b) rationale for first-class compositions, the v0 validation slice exercised by this release, and what's deferred (user-custom components via `register_mcp_orbit_component`, composition templates, usage analytics, cross-operator sharing, composition arbiter).

### Changed
- **Tool registration order** in [lib/mcp/server.js](lib/mcp/server.js) — `registerMetaContextTools()` runs last, after `registerCatalystTools()`. Ring 6 sits at the bottom of `tools/list` so the natural reading order surfaces orientation → per-bot → fleet → outcome → deliberation. `forward_context` first, deliberation last.
- **`recommend_catalysts` tool description** rewritten to teach the agent how to consume the new `operatorAnchor` / `suggest_kyc` / `priorMaterializations` fields. The reading rule for prior materializations is in-description so the framing sits next to the data it applies to.
- **CLAUDE.md** updated with the Ring 6 paragraph in the MCP control surface ring list, plus `meta_nodes` / `meta_edges` / `meta_principles` named in the Data layout note.
- Test suite expanded by **104 new tests** across the new files: 44 for the repository, 15 for verification, 31 for the Ring 6 tools, and 14 for cross-ring integration in `catalysts.test.js`. Inventory adds **32 more**: 22 for [lib/db/repositories/mcp-inventory.test.js](lib/db/repositories/mcp-inventory.test.js) (schema, replace semantics, validation, atomicity), 8 for [lib/mcp/tools/mcp-inventory.test.js](lib/mcp/tools/mcp-inventory.test.js) (handler shape + no-operator warnings), and 2 added to [lib/db/repositories/meta-context.test.js](lib/db/repositories/meta-context.test.js) (inventory on fleet brief; absent on per-scope briefs). mcp-orbit adds **45 more**: 24 for [lib/db/repositories/mcp-orbit.test.js](lib/db/repositories/mcp-orbit.test.js) (schema + both repositories — kind/status CHECK enforcement, version coexistence, custom-row preservation on `deleteAllBuiltins`, composition state transitions), 9 for [lib/mcp/mcp-orbit-components/loader.test.js](lib/mcp/mcp-orbit-components/loader.test.js) (frontmatter parsing, filename-ref invariant, drop-on-reseed, bundled-components parse), and 12 for [lib/mcp/tools/mcp-orbit.test.js](lib/mcp/tools/mcp-orbit.test.js) including a **full seven-step e2e flow** (recommend → meta-catalyst → component bodies → state transitions → commit) that asserts the composed candidate matches the five components in the hand-written weekly-digest recipe. Total: **384 lib tests passing**.

## [0.3.0] — 2026-05-22

Catalysts go host-neutral. Until now, every catalyst body assumed the
synthesizing agent was Claude Code and would write a `.claude/skills/<...>/SKILL.md`
file. That assumption is unbundled into a separate **host adapter** layer, so
the same catalyst recipe can materialize as a Claude Code skill, a Codex
automation, or a generic `workflow.md` + runner depending on which agent is
connected. See [docs/catalysts.md](../docs/catalysts.md) and the per-host
prose in [control/lib/mcp/adapters/](lib/mcp/adapters/).

### Added
- **Host adapters** — three ship in [lib/mcp/adapters/](lib/mcp/adapters/),
  symmetric to the catalysts loader: `claude-code` (skill under
  `.claude/skills/`, scheduled via `/schedule`, secrets-guarded via
  `.claude/settings.json` deny rules), `codex` (Codex automation via
  `automation_update` for recurrence, or a workspace `./mojulo-workflows/<slug>/`
  workflow file Codex follows interactively), and `generic` (`workflow.md` +
  runner script for any other agent, scheduling out-of-band). Each adapter
  declares its artifact target, scheduling mechanism, state location, secrets
  posture, and `supportsClientInfoHint` list. The MCP server captures
  `clientInfo` at `initialize` ([client-bindings.js](lib/mcp/client-bindings.js))
  and auto-resolves the adapter for that session; pass `host` explicitly to
  `get_catalyst` / `get_adapter` to override.
- `list_adapters` / `get_adapter` MCP tools (Ring 0, registered next to
  `forward_context` so they show up at the top of `tools/list`). The
  connecting agent reads its bound adapter once per session before
  synthesizing from any catalyst.
- [AGENTS.md](../AGENTS.md) at repo root — orientation for non-Claude agents
  (Codex, future hosts) before mojulo's MCP is connected. Covers the dev MCP
  endpoint, the Codex `~/.codex/config.toml` snippet, and cross-host
  pointers. Claude Code's [CLAUDE.md](../CLAUDE.md) is host-neutral and
  remains the primary architecture doc; AGENTS.md only covers what other
  hosts need *before* the MCP handshake.
- Optional `outputContract` field on catalyst frontmatter — a structured
  description of the per-run output shape, so adapters can render reporting
  without parsing prose. All three shipped adapters read it (see the "Output
  reporting" section in each adapter body). Optional during migration;
  required for new catalysts after the Phase 2 cutover.
- Language packs for new locales: Arabic (ar), Danish (da), Estonian (et),
  Farsi (fa), Filipino (fil), Hindi (hi), Indonesian (id), Kiswahili (sw),
  Malay (ms), Swedish (sv), Thai (th), Turkish (tr), Urdu (ur), and
  Vietnamese (vi). UI strings are now internationalized across 27 languages
  total.

### Changed
- **Every shipped catalyst body rewritten to be host-neutral.** Claude-specific
  phrasing ("synthesize the skill", literal `.claude/skills/<...>/SKILL.md`
  paths, "the skill prints…") is replaced with "materialize the runnable
  artifact" delegated to the bound host adapter. Mapping intent, qualifying
  logic, idempotency strategy, and pitfalls — the *portable* contract — stay
  in the catalyst body. Artifact path, scheduling, dry-run encoding, state
  location, and output reporting move to the adapter. Touched:
  `appointment-to-calendar`, `conversations-to-channel-digest`,
  `document-extract-to-store`, `knowledge-gap-miner`, `qualify-lead-to-crm`,
  `scan-conversations-for-signal`, `submission-to-ticket`,
  `submissions-to-warehouse`, `weekly-submissions-digest`.
- `get_catalyst` response now composes three sections in order: the
  host-neutral **`CATALYST_CORE_PREAMBLE`** (renamed from
  `SYNTHESIZER_BRIEFING` — posture, vocabulary, safety defaults), the bound
  **host adapter body** (artifact target, scheduling, dry-run as a concrete
  step, state, secrets, output reporting), then the **catalyst body**
  itself. Response payload also includes a resolved
  `adapter: { id, name, artifactTarget }` block so callers can surface the
  materialization target in confirmation dialogs.
- `forward_context` rewritten around the host-neutral model: new **Host
  adapter** glossary entry next to the existing **Catalyst** entry,
  `list_adapters` / `get_adapter` added to the Orientation ring of the tool
  index, updated catalyst lifecycle text ("read your adapter once before
  synthesizing"), and the verification posture generalized from "synthesized
  skills" to "runnable workflow artifacts materialized via host adapters
  (Claude Code skills, Codex automations, generic workflow files)."
- `forward_context` tool now surfaces the embed URL of the widget.
- npm package description and keywords broadened from "MCP server for
  building self-hosted chatbots from inside Claude" to "from any MCP-capable
  agent (Claude Code, Codex, and friends)." Keywords add `mcp-server`,
  `codex`, `openai`.
- [docs/catalysts.md](../docs/catalysts.md) and
  [docs/mcp-integration.md](../docs/mcp-integration.md) rewritten around the
  catalyst/adapter split. The concepts table grows a fourth row (host
  adapter) and the "runnable artifact" row replaces the
  Claude-specific "Claude Code skill" row.
- Top-level [README.md](../README.md) and [control/README.md](README.md)
  updated for the multi-host story — host adapters are mentioned next to the
  `forward_context` orientation pointer.

### Security
- `get_deployment` credential redaction now actually redacts. The deployment
  config serializes its per-provider entries under `config.llm.*`, but
  `redactConfigCredentials` in [operate.js](lib/mcp/tools/operate.js) was
  walking `config.llmConfig.*` — a key that doesn't exist — and silently
  returning the config untouched. Anthropic / OpenAI / AWS / Fly API-key
  fields are now redacted before the tool returns. No control-plane DB
  change; the encrypted-at-rest copy in `api_keys` was never affected.
  Users on 0.2.x who routinely call `get_deployment` over MCP should
  assume any provider keys present in those responses were transmitted in
  the clear to the connected agent's session.

## [0.2.2] — 2026-05-21

Discoverability patch on top of 0.2.1. The `mojulo-ui` bin shipped in 0.2.0,
got fixed in 0.2.1, but no surface was telling users (or connecting agents)
it existed — the npm-page README actively said the dashboard wasn't shipped
yet, the MCP `initialize` preamble didn't mention it, and `forward_context`
had no framing for when to suggest it.

### Changed
- [README.md](README.md) — Quickstart adds step 4 for `npx -y -p mojulo
  mojulo-ui`; the top-of-fold lists the three bins (`mojulo`, `mojulo-ui`,
  `mojulo-config`); the "Dashboard" section flips from "clone the repo to
  run it" (the stale 0.1.x instruction) to actual `npx` commands with the
  bin's flags and concrete reasons to reach for it.
- `SERVER_INSTRUCTIONS` (MCP `initialize` preamble) — adds a short
  "There's also a dashboard" paragraph next to the existing orientation
  pointer and the secrets standing rule. Every connecting agent now sees
  the affordance on handshake without having to call `forward_context`
  first.
- `forward_context` — adds a "Two faces, one state" subsection near the
  top of orientation. Frames `mojulo` (MCP) and `mojulo-ui` (dashboard) as
  two faces of the same `~/.mojulo/` state, with concrete decision
  triggers (browse interactively, mint via wizard, fleet analytics as
  charts, click-through deploy management) and an explicit "default is
  still MCP" boundary so the agent doesn't push the dashboard for tasks
  that work fine in chat.

## [0.2.1] — 2026-05-21

Patch on top of 0.2.0. `0.2.0` shipped the Next.js standalone bundle without
its client static assets — the dashboard HTML served fine but every browser
request for `/_next/static/*` (CSS, font, JS chunks) hit 404, leaving the
page unstyled and non-interactive. `0.2.0` is deprecated on the registry
with a pointer to this version.

### Fixed
- `mojulo-ui` now serves the dashboard's client static assets. Root cause:
  Next.js's `output: 'standalone'` deliberately emits `.next/static/` and
  `public/` *outside* the standalone bundle, leaving each deployer
  responsible for copying them in. v0.2.0 packed both trees at the package
  root, which never made them reachable from the standalone server's cwd.
  v0.2.1 fixes this in `prepack` with [stage-standalone.mjs](scripts/stage-standalone.mjs),
  which copies `.next/static → .next/standalone/.next/static` and
  `public → .next/standalone/public` before the pack runs. The top-level
  `.next/static/**` and `public/**` entries are dropped from the `files`
  allowlist (now redundant — the standalone copy is what the server actually
  reads).

### Lesson logged for future Next.js standalone changes
- A `mojulo-ui` smoke that only checks the dashboard HTML returns `200` is
  not sufficient — the browser also has to be able to fetch at least one
  `/_next/static/*` URL successfully. Future smoke tests should `curl` a
  CSS chunk and a woff2 from the running server before declaring a UI
  change validated.

## [0.2.0] — 2026-05-20

Adds the Next.js dashboard as a second binary in the same npm package. The
launch story becomes: build the bot via Claude → operate the fleet via
dashboard → both shipped via one `npx -y mojulo` install. See
[lite-template/integration/UI_PACKAGE_PLAN.md](../lite-template/integration/UI_PACKAGE_PLAN.md).

### Added
- `mojulo-ui` bin — boots the bundled dashboard on a free local port and opens
  the browser ([scripts/mcp-ui.mjs](scripts/mcp-ui.mjs)). Flags: `--port <n>`,
  `--no-open`, `--help`. Binds 127.0.0.1 only. Shares `~/.mojulo/` state with
  the `mojulo` stdio bin, so a bot minted via MCP shows up immediately in the
  UI's fleet view.
- `version` MCP tool (Ring 0) — reports server version, MCP protocol version,
  Node version, platform os/arch, the pinned bot container image tag, the
  `MOJULO_OFFLINE_BUILD` flag, and the active `MOJULO_HOME`. Use to diagnose
  version mismatches between a user-reported issue and what their control
  plane is actually running.
- `inspect_bot_env` MCP tool (Ring 3) — read a bot's container `.env` safely.
  Returns `{ key, value, masked, valueLength? }` entries with sensitive values
  (Anthropic / OpenAI / AWS / Fly / GitHub / Slack tokens, and the
  auto-generated `MOJULO_API_KEY`) masked to first-4 + last-4. Non-sensitive
  entries (`LLM_PROVIDER`, ports, plain webhook URLs) come through clear.
  Takes either `deploymentId` (resolves under `MOJULO_HOME`) or an explicit
  `path` (basename must start with `.env`). The standing rule lives in the
  `initialize` preamble and the new "Secrets handling" section of
  `forward_context`: do not `cat`/`Read` `.env` files of mojulo bots — use this
  tool. Defense-in-depth: a recommended `.claude/settings.json` deny snippet
  is documented in `forward_context` so the harness can block the routine
  `cat .env` path even if an agent forgets the rule. Control-plane provider
  keys are unaffected — those already live encrypted in the `api_keys` table,
  managed via the `mojulo-config` CLI.
- `save_modular_bot` response now includes `artifactPath`, the absolute on-disk
  path to the compiled zip. Stdio MCP callers (which have no HTTP server to hit
  `downloadUrl` against) can surface this directly to the user.
- `open` runtime dep (~120 KB) — used only by the `mojulo-ui` shim for browser
  launch.

### Changed
- Next.js builds emit `output: 'standalone'`. The `mojulo-ui` bin imports the
  resulting `.next/standalone/server.js` directly; the pack ships the pruned
  standalone tree instead of the source app.
- `prepack` runs `stage-lite-template && next build --webpack`. The webpack
  build path is load-bearing — Turbopack's standalone output hashes external
  module names (e.g. `@huggingface/transformers-31f28a0eb9b916d1`), which
  Node's resolver can't find when standalone runs from inside `node_modules/`.
- `lite-template/` is bundled into the package again so the wizard preview
  routes (`/api/preview/bot/*`, `/api/preview/chat`, `/api/preview/extract`)
  resolve under bundled-`lite-template/` conditions. The `mojulo-ui` shim sets
  `LITE_TEMPLATE_PATH` to the bundled copy before booting the standalone
  server.
- `SERVER_VERSION` in the MCP `initialize` handshake reads from `package.json`
  via `getServerVersion()` instead of being a hardcoded constant. Both the
  `initialize` response and the new `version` tool will track future bumps
  automatically.
- `forward_context` tool index updated for the new `version` tool, the
  `artifactPath` field on `save_modular_bot`, and to steer stdio clients away
  from the legacy `downloadUrl` (which is a Next.js-route path, unreachable
  over stdio).
- `files` allowlist expanded with negations to exclude developer state from the
  pack: `.next/standalone/.env*`, `.next/standalone/data/**`,
  `.next/standalone/lib/embedder/models/**`, the duplicate
  `.next/standalone/lite-template/**`, stale `.tgz` artifacts, and test files
  inside the standalone bundle.

### Implementation notes
- Pack size moved from ~600 KB (0.1.0, stdio-only) to ~52 MB (0.2.0, includes
  Next.js standalone + lite-template + bundled deps). Webpack adds ~30 MB over
  the broken Turbopack pack but is the only build path that actually works
  from an `npm install` location.
- The bundled `lite-template/models/tokenizer.json` is 17 MB. Tokenizer cache
  sharing between the control-plane embedder and the bot-runtime embedder is
  deferred to v0.3.0 — currently each pulls from a different cache dir.

## [0.1.0] — 2026-05-19

Initial npm publish. Stdio-only MCP server for driving Mojulo bot design,
deploy, and operate workflows from Claude Code.

### Added
- `mojulo` bin — stdio MCP entrypoint ([scripts/mcp-stdio.mjs](scripts/mcp-stdio.mjs)).
- `mojulo-config` bin — config helper ([scripts/mcp-config.mjs](scripts/mcp-config.mjs)).
- Embedder cold-start: `preloadModel()` fires in the background on bin start so
  the first RAG bot mint avoids a cold ~113MB ONNX download.
- `LITE_TEMPLATE_PATH` env defaults to the bundled lite-template copy resolved
  at runtime from the install location.

### Changed
- `DockerDeployer` skips template file copying in prebuilt-image mode (the
  default). Previously it shipped `.gitignore` and test fixtures into every
  artifact. Offline-build mode (`MOJULO_OFFLINE_BUILD=1`) is unaffected.
- `TEMPLATE_EXCLUDES` excludes test and integration paths from offline-build
  artifacts.

### Removed
- `postinstall` hook. Model download is lazy on first use (with eager
  background preload on bin start) instead of running at `npm install` time.
