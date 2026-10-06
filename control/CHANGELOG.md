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

### Pack menu

Opening a pack (`pack_x({})`) returned every member's full description and input schema, and those manuals were
about 85% of what came back: opening `pack_stash` to call `gather` also read the 16 KB `cook` manual. A pack now
opens to a menu, and a member's manual is read when the agent picks it. Dispatch is unchanged.

- **The menu.** The pack's orientation, one line per member, and the full manual inline for light members (800 B
  or less). A heavy member's line ends with its manual's size and how to read it, so the cost is visible before
  it is paid.
- **`manual`.** `pack_x({ manual: 'cook' })` returns that member's manual alone (the same description and schema
  the pack used to inline); a list returns several. A member homed in another pack, a spine tool, an unknown
  name and a member the Claude plugin profile hides answer as dispatch does.
- **Errors point at the manual.** A member's error through a pack ends with where its manual is. Structured
  refusals (a JSON body with a code and the next action) are passed through untouched.
- **The listing did not grow.** The pack input schema is repeated in every pack entry; its `tool` and `args`
  wording was shortened to pay for `manual`.
- **CLI.** `mojulo <pack_id> --manual <name>[,<name>]` reads manuals from a shell; `mojulo <pack_id>` opens the
  menu.

### Test cull

The suite carried tests for modules no product code reaches: spikes, renderers and planners that were built and
never wired into a tool, a kind or a route. They are gone with their tests, and a quick critical tier joins the full run.

- **Removed, with their tests:** the aircraft fuselage wrap-net (and its spike, which wrote review SVGs into the
  removed `lite-template/` tree on every run), the box-vehicle face-net and its cards and variants (plus a second
  spike writer), the civic-glyph city composer, the figure landmark slots, the houseplant, the manga-cel,
  imperfect-cel and field-cel renderers with their shared cell geometry, the terrain region plan, the wave-drape
  fitter, the face-material role selector, the pixelizer prerender seam, the mega-boy flipbook spike and the
  beats diff exhibit. None was reachable from `app/`, `bin/`, the MCP registry or a package script.
- **Kept on purpose:** the removal guards (chatbot carve-out, moved notices, pack boundaries), the deprecated
  `MOJULO_RECIPE_BOOK` loader tests (it still loads until 4.0), and the proof worlds the game runtime's tests use
  as fixtures.
- **The `wardrobe-construction` card** described the drape fit as a function call no tool exposes. It now states
  the principle.
- **`npm run test:critical`** (`vitest.critical.config.js`): the MCP surface and its pins, the plugin profile, the
  guards, the database, versions, auth, the bundled book, scripts, the dashboard and every characterization pin,
  without the geometry-heavy suites. About 2,400 tests in two minutes against the full run's eight; CI still runs
  `npm test`.
- **A deep tier for exhaustive sweeps.** `*.deep.test.js` files are left out of `npm test` and run with
  `npm run test:deep` (CI runs it after `npm test`). `npm run test:deep:changed` runs only the sweeps whose imports
  touch an uncommitted change, so editing a city kernel runs none and editing `anime-head.js`, `anime-sculpt.js` or
  `station-loft.js` runs the anime ones. First in: the anime head's range-end and named-cut sweeps and every look
  built on both bases (`anime-head.deep.test.js`, `anime-looks.deep.test.js`), about 160 of the suite's
  file-seconds. The law tests stay in `anime-head.test.js` and `anime-looks.test.js`.

### create_sketch diet

`create_sketch` listed a full drawing manual in `tools/list`: about 15.5 KB, the second-heaviest tool. It now
lists routing only (1.7 KB), and the manual is read on demand from cards. Nothing it accepts or stores changed.

- **A lean listing.** The description names the kinds (`floorplan`, `store` / `mall` / `restaurant`, `historic`,
  the painted kinds), the recipe door, hand-built marks and stations, and the world-recipe restore. It points
  plain flows and charts at `mint_diagram` and says to read the card before minting. `manifest` is an open object.
  `bucket` and `preloadMetadata` are still accepted but no longer listed, and `preload` lost its nested schema.
- **New sketch_vocab cards.** `mark-primitives` covers the 2D marks, style fields and station kinds.
  `construction-marks` covers blob, sphere, egg, cylinder, the volume cup, form, solid, partition, array, the
  presets, sticker shading, gesture placement and one-point perspective. Defaults are read from the expander, and
  every example mints. `edge-notation` gains `via` / `curvature` routing.
- **A lean result.** The `preload` echo names each prior (`ref`, `title`, and `as` / `note` / `metadata`) and no
  longer re-sends its whole manifest. With up to eight priors, that was up to eight full manifests riding back into
  the agent's context for nothing, since the agent composed against them before the call.
- **Ratchet.** The flat `tools/list` pin drops from 268,400 to 254,600 bytes. `create_sketch` leaves the
  description allowlist because it fits the 700-character ceiling.

### Diagram auto layout

A flow chart no longer needs a coordinate. Name the boxes and the arrows; the kernel places them. This was the
biggest reasoning cost left in `mint_diagram` and `create_sketch`: every station needed a hand-picked x, y, w and h.

- **Auto-placed stations.** When no station carries a position (no `x`/`y`, `cell` or `lane`), `lowerDiagramKinds`
  lays them out (`expandAutoLayout`, `lib/diagram-core.js`):
  - **Ranks:** longest path along the edges. A cycle's back edge is set aside in declaration order.
  - **Order:** barycenter sweeps within each rank.
  - **Box size:** fitted to the label, sublabel and items. A station's own `w`/`h` win.
  - **viewBox:** fitted when absent. A given one only grows.
  - **Direction:** `layout: { direction: 'LR' | 'TB' }`.

  It is deterministic, and the stored manifest holds the resolved coordinates. A manifest that places any station
  never reaches the pass, so every existing row is byte-identical. Both mint doors share it, and the binding holds.
- **Edges routed around boxes.** In an auto-placed diagram, an edge whose path or label pill would cross a box is
  routed on the clear side:
  - Rank-skipping edges, back edges, and a second edge between the same pair all count.
  - Lanes on the same side stack outward, and ties go to the emptier side.
  - An edge with its own `via` or `curvature` is left alone.
- **`edges[].channel`.** A new optional number pins a `via` edge's lane (x for left/right, y for top/bottom), so
  the lane can clear a wider box between the endpoints. Absent, nothing moves.
- **Readable without adjustment.** A contrast pass over diagram ink, measured on the app floor, the dark export
  and the light surface:
  - **SVG download and inline view:** the dark export was transparent, so opened directly or in a host page's
    `<img>` its pale ink sat on white at about 1.4:1. The route now paints the surface colour behind the drawing
    (`renderSketchToSvg({ backdrop: true })`). Decks, outcome pages and world textures, which composite onto
    their own backdrop, are unchanged.
  - **Station outlines:** all clear 3:1 on every surface. `input` was a 1.3:1 hairline, `filesystem` fell to 1.7
    on light, and `db_row` sat at 2.6–3.0; they now use the surface-aware `--text-muted` / `--entity-purple` inks.
    The `/graph` legend matches.
  - **Station sublabels:** move from `--text-muted` (about 4.0:1 at 10px) to `--text-secondary` (8:1 or more).
- **`mint_diagram`.** The listing says boxes are auto-placed when their positions are left out, and its arrowhead
  list moved to the `edge-notation` card (697 → 659 characters). The `mark-primitives` card teaches the auto-placed
  form first; `edge-notation` gains `channel`.

### cook diet

`cook` listed every publication kind's layout manual in `tools/list`: 16.2 KB, the heaviest tool. It now lists
4.3 KB, and each kind's guide is read for the one kind being published. What cook accepts and makes is unchanged.

- **A lean listing.** The description keeps the three steps (cleave, aim, nucleate) and the authoring model, names
  the kinds, and says to call `sketch_stash({ intent, target_kind })` before any kind but essay. The deprecated
  `template` alias is still accepted but no longer listed.
- **Each kind's guide.** `sketch_stash` answers with `guide`: the kind's layout (how items, drawers and metadata map
  onto it) and the least content that renders well, word for word what cook's listing used to carry.
- **Two kinds that could not be scaffolded now can.** `sketch_stash` listed `site` and `photojournal` but refused
  both. Each now has a stash recipe, and `photojournal` has a guide (it had none).
- **Ratchet.** The flat `tools/list` pin drops from 268,900 to 256,800 bytes.

### Contextmap trim

The contextmap tools came from the chatbot era and still read like it. Their listings are shorter, and the 2.x
parts no longer show. Nothing they accept or record changed.

- `meta_context_commit` lists 3.3 KB instead of 7.1 KB: one line per type, with the app, connected-service and
  trigger records first, since those are what the dashboard's Apps and Connected Services panes list.
- `meta_context_brief` (1.7 KB to 0.9 KB) and `meta_context_analyze` (1.4 KB to 0.8 KB) are shorter too.
- No longer listed, still accepted: the 2.x `artifact_materialization` commit, which answers with the chatbot
  notice, and the `bot` brief scope, which reads a 2.x install's rows.
- `gather` and `execute_plan` stop mentioning bots and deploys.
- **Ratchet.** The flat `tools/list` pin drops from 256,800 to 251,600 bytes.

### Statue maker

The hero door carves the Western character creator's figure as sculpture: posed, draped or nude, in a period's stone or
bronze, cut to a bust, a herm or a torso study, with losses, on a base. Opt-in; a hero without `statue` is
byte-identical. Being built on this branch; the sphinx comes next.

- **The statue build.** `statue: '<card>'` or `{ type: 'statue', style, material, crop, lose, base, dials: { wear } }`
  (`lib/graph/statue/`), stamped with its laws version like an outfit or armour build. Period cards, plain JSON:
  `archaic`, `classical`, `hellenistic`, `roman`, `roman-bust`, `egyptian`, `renaissance`. A card's stand, stillness and
  drapery (an outfit card per silhouette) sit beneath the hero's own words; its hair is set at mint.
- **Carved.** One material over every group: blank eyes, carved hair, the bare body's zones skin. `marble`,
  `limestone`, `sandstone`, `granite`, `basalt`, `bronze` (its patina by `wear`, from brown to verdigris), `gilt`, and
  `painted`: reconstructed polychromy over the card's stone, which the readout always calls conjecture.
- **Cut.** `crop`: `full`, `bust` (below the chest, through the upper arms), `herm`, `torso` (no head or arms, the
  thighs cut). `lose`: whole parts with what they carry (`forearmR` takes the hand), each closed in its own cap. No
  fracture surfaces yet.
- **On a base.** `block`, `attic`, `drum`, `socle`, `herm` or `none`, in stone, built at read time under the posed figure
  from the footprint it stands on; the figure is lifted onto it. The base rides every export as its own group.
- **A surface for the exports.** A layered recipe's `surfaces` (group → a shelf material or a metal surface, `'*'` the
  rest) tags its faces (`spec` and `pbr`; a metal surface's `metal`), so a bronze statue exports metallic, in its
  patina's colour, to GLB and Godot. Absent, byte-identical.
- **The readout.** `hero.statue`: the card, period, material, format, the parts lost, the base, wear, `basis:
  'unverified'` (the cards are drawn from the general record of each type, not from sources read) and the caption
  derived work carries ("inspired by …").
- **Statues in historic cities.** A `historic` manifest's `statues: [{ ref, at, figure, height }]` stands a stored statue
  on one of the city's statue slots in the World: a Forum monument (Marsyas at `ficus`, the Sibyls, the Concord pair,
  Vortumnus, the Castor cella's cult statues, the Basilica Aemilia's portico figures, …) or a statue asset's slot
  (`ln-statue:<n>` at Lindos, `pp-statue:<n>` at Pompeii, `votive-row:0` at Sumer, `eg-colossus:<n>` at Thebes, `pp-equestrian:<n>` at Pompeii). The stand-in comes down, its base stays, and the statue is
  fitted at the stand-in's height and facing, baked under the city's sun. The entry card's `STATUES` line lists the
  slots. Absent, the city is byte-identical.
- **Sumer's worshippers.** A `sumerian` card: the Early Dynastic votive figure, frontal, the forearms folded and the hands
  clasped at the chest, a flared skirt (the man shaven: no beard is carved yet), limestone; painted, the eyes lapis
  under bitumen brows. Sumer's votive row is a slot (`votive-row:0`), one figure per plinth numbered along the row, so a
  carved worshipper can stand among the others.
- **Seated statues.** `stand: 'seated'` on a statue build (or a card) sits the figure on a block throne built with its
  base: the thighs level, the shins hanging, the hands flat on the knees. A long skirt is cut at the knee, since a drape
  over the lap isn't carved yet. The rig gains an opt-in `seat` channel that turns the free legs forward past the hip's
  cone; absent, every pose is unchanged. Thebes's seated colossi are slots (`eg-colossus:<n>`): the stand-in king and his
  throne come down, and a seated statue sits there on its own throne. The nemes and the crowns aren't carved yet.
- **Carved animals.** The `animal` kind takes `statue` (`true`, or `{ type: 'statue', material, base, dials: { wear } }`):
  the animal in one stone or metal, its fur and skin textures dropped, tagged for the exports, on an oblong base the
  length of its body. Absent, every animal is byte-identical.
- **Equestrian statues.** `stand: 'mounted'` sets a hero statue astride a horse carved in the same material. The rider sits on the saddle
  found from its own hip joints, legs down the flanks, the right arm raised in address, both on one oblong block. The
  equestrian slots take it: the Forum's Octavian horseman and Pompeii's standing equestrian bronzes
  (`pp-equestrian:<n>`), each facing the way its stand-in's horse did. A standing statue on an equestrian slot, or a
  mounted one on a standing slot, is refused by name. Entry cards list a slot range with gaps one by one.
- **A horse in the library.** A horse ring plan for the layered kind, built with the creature-from-plan loop: a barrel
  body, an arched crested neck, a long wedge head carried down, straight cannons on single hooves, the hind leg angled at
  stifle and hock, 1.6 m at the withers. It is core (`horsePlan({ scale, palette })`), worked as
  `docs/examples/ring-plans/horse.plan.json` (mint it with `via: 'plan'`), and it is the equestrian statues' horse.
  A loft takes `frame: 'keep'`, which keeps a near-level barrel's rings from twisting (and a run along a flank from
  collapsing); absent, every loft is unchanged.
- **A sphinx in the library.** A sphinx ring plan, built the same way: a lion lying on its belly in the Great Sphinx's own
  proportions, forelegs reaching forward, hind legs folded, the tail along the right flank, wearing the hero's carved
  landmark head (no hair, no beard) in a nemes with the uraeus. The nemes is a striped wrap, not a cap: its opening
  tilted so the brow band crosses the forehead and the face looks out of it, its stripes radiating back over the crown;
  behind the face it folds out each side like a cobra's hood, the wings flaring past the shoulders, striped across, and
  the lappets hang striped down a breast that is broad and flat, as a man's chest, set back under the face. Carved, the stripes are grooves: a palette group named `…Groove` takes the
  stone a shade darker. The criosphinx's headcloth is striped the same way. Core as `sphinxPlan({ preset, scale, palette })`, worked as
  `docs/examples/ring-plans/sphinx.plan.json`.
- **Carved creatures and library forms.** Any layered plan that is not a hero takes `statue` (the creature filter: one
  material, an oblong base). A historic city's statue entry may name a library form instead of a stored statue:
  `{ "at": "gz-sphinx:0", "form": "sphinx", "material"? }` stands the carved sphinx in Giza's quarry in place of the
  block stand-in, limestone by default. Giza's entry card says so.
- **The criosphinx and the bull.** Two more ring plans built the same way. The criosphinx is Amun's ram-headed sphinx
  of Karnak's avenue: a domed ram's skull with horns coiled round the ears, the headcloth over the shoulders, a small
  king between the paws (`criosphinxPlan()`, sandstone). The bull is Sumer's copper guardian: a deep barrel, the
  shoulder hump, the head forward, horns out and up (`bullPlan()`, bronze gone green). Thebes's sphinx rows and Sumer's
  guardian pair are slots, one figure per pedestal or plinth, and take them as `form: 'criosphinx'` and `form: 'bull'`.
- **`statues: "carved"`.** One word on a historic city carves every slot with its period's statue: a slot's own form
  (the sphinxes, the bulls), the seated granite king on the Theban colossi, a bronze horseman on an equestrian slot
  and nowhere else, and the culture's card everywhere else (Roman at the Forum and Pompeii, Hellenistic at Lindos,
  Sumerian worshippers), men and women, marble and bronze, decided by each slot's own dice so the city carves the same
  each time. The city's standing figures use the hero's light body (the streamlined core, low-poly), since the Forum
  carves 38 of them. An entry may also give a hero statue inline (`hero: { cast, statue }`), with nothing stored.

### Recipe versions

- **Every recipe records the mojulo version that wrote it.** A mint stores the version that minted
  it; an edit to the recipe (`update_sketch`, `edit_solid` and the other in-place revisions) stores the
  version that last changed it. A retitle, a folder move or a gallery pin leaves it alone, since what
  renders is unchanged. Each archived revision of a solid and each beats revision carries the version
  that wrote that manifest.
- `export_model` answers with `versions: { minted, revised, rendered }`, so an export says which
  mojulo made the recipe and which one rendered it. To reproduce an export exactly as the recipe's own
  version drew it, render it under that version (`npx -y mojulo@<version>`) in a separate
  `MOJULO_HOME`.
- Recipes written before this release read `null`: they were made by 3.0 or earlier, and which one is
  not recorded, so nothing is guessed. The columns are added on first start; nothing else changes.

### Recipe book

- **The recipe book ships with mojulo.** The catalog that lived in the separate `mojulo-recipe-book`
  repo now lives at `control/book/` and is in the npm package, so every install has it with no setup,
  including an agent box (the Claude app and web, ChatGPT's Work box), where nothing can be cloned
  beside the package and the old attached book never loaded. It comes in at the book's 0.8.0: study
  objects, math, worlds, loops, solids, shots and the wardrobe (garments, outfits, footwear), and the
  `aurora` and `foucault-pendulum` view kinds. Named outfits such as `business-suit` now resolve on
  every install.
- Precedence is unchanged in spirit and gains one tier at the bottom: core kinds, then your cookbook,
  then an attached clone, then the bundled book. `MOJULO_BUNDLED_BOOK=off` leaves it unattached.
- **Deprecated:** `MOJULO_RECIPE_BOOK` and the separate `mojulo-recipe-book` repo. A clone you
  already point at still loads, ahead of the bundled book, and warns at boot; it is removed no earlier
  than 4.0. Book entries are now contributed to `control/book/` in this repo (see CONTRIBUTING.md).
- The ChatGPT Work-box runner installs 3.0.1 by default, so a Work box gets the bundled book.
- `npm run test:book` runs the book validator and the builders' own tests; CI runs it, and
  `npm test` checks the bundled book as well.

### MIDI orchestra

- **In progress.** The robot band learns styles from studied masters, written as manuals an agent reads
  before composing, not as presets. The first is **robot rock**: the 16-bit action-game sound of a rock band
  played by machines. The card `beats-robot-rock` (via `get_beats_vocab` or `semantic_search`) covers:
  - one fixed band and one room for a whole game, with each stage choosing only what is wet;
  - a riff-and-bass engine, with the bass answering the lead;
  - an intensity ladder from stage select to final boss, with a form for each scenario: stage, boss,
    fortress, select, victory;
  - an element (water, fire, ice, machine) signalled inside the groove rather than by swapping the band;
  - an 8-voice discipline.
- Every manual is white label: it names traits, never a franchise or composer.
- The second style manual, **field orchestra**, covers the 32-bit strategy-RPG score: an orchestra written for a
  few voices that still reads as orchestral. The card `beats-field-orchestra` covers:
  - an energy ladder (idyllic, adventurous, processional, battle), with a form and a mix for each step;
  - layers that enter one at a time;
  - one shared hall, with the sustained sections wet and the percussion dry;
  - the orchestra played as a band;
  - loops that never close V–i;
  - instrument families as dramatic tags.
- New authoring vocabulary. All of it is opt-in; recipes without it expand and render byte-identical:
  - rhythms `dotted`, `dotted-quarter` and the 6/8 `lilt`;
  - voicings `pedal`, `pedal-5` and `drone` (the key's tonic, fifth or open fifth held under any chart);
  - grooves `march`, `processional` and `travel`;
  - snare-rudiment fills `paradiddle`, `drag`, `five-stroke` and `long-roll`;
  - woodwind and timpani band roles;
  - bands `orchestra-pastoral`, `orchestra-field`, `orchestra-processional` and `orchestra-battle`.
- Harmony gains:
  - the Phrygian bII as the danger chord;
  - the tonic pedal;
  - loop-seam cadences;
  - the tonic flip;
  - the Aeolian march;
  - modes ranked by tension;
  - key shifts by a third or a fifth between sections.
- The worked set, `lib/graph/beats/field-moods.js`: idyllic `plains`, `desert`, `village` and `forest`; adventurous
  `highlands`, `expedition` and `wayfarer`. Each row carries an `energy`. Not yet wired to a world or a tool.
  Machine gates in `field-moods.test.js` hold each energy to its budget:
  - one colour alone at the opening;
  - parts and leads per bar;
  - no V–i at the seam;
  - a dynamics ceiling;
  - adventurous moods keep moving.
- Never the same score twice. `lib/graph/beats/field-score.js` generates field cues from these principles:
  - `scoreIdentity(gameSeed)` rolls a game's identity: home key, a palette flavour (orchestral, folk, chamber,
    synth-era, silk-road) with its instruments per role from the shelf, one hall, and a motif rhythm.
  - `fieldScore(mood, { seed, identity })` rolls a cue inside the mood: mode, tempo, meter, a progression from
    the mood's harmony family, new melodies, the arrangement order and the gear change.
  - Same seeds give the same music; new seeds give a different score. Over 60 seeds per mood every melody
    differs, every key appears, and all 420 recipes are distinct. Cues sharing an identity keep its tonic,
    palette, hall and motif.
  - `field-gates.js`: the principles as an advisory check over any beats composition, run on every generated
    seed and on the hand-written takes. The village take keeps its flute counterline as a recorded exception.
  - The card tells an agent composing by hand to use a fresh seed and a game identity.
- A field score is now one call away, and mojulo suggests one:
  - a world takes `audio: { soundtrack: 'field:plains' }` (or `{ score: { mood, seed, game } }`) and plays a
    generated field cue. `compose_world` stores a fresh seed, so every world sounds different until you keep one;
  - `create_beats({ kind: 'beats-composition', title, score: { mood } })` mints a field cue with fresh seeds and
    says how to keep a whole game in one identity (`game`);
  - a world composed without music gets a suggested mood and the exact `audio` line in the reply.
- Loop points. A render with `loop` (`export_beats { loop: true }`, `beats.wav?loop=1`, or the recipe's
  `export.loop`) is exactly one pass, cut at the next bar line. The ring-out is folded back onto the start, the way
  a live loop carries it, and a `smpl` loop chunk marks the loop for samplers and game engines. The Godot pack
  renders every music bed this way, so a level or menu loops without the old gap of silence. Off by default;
  renders without it are byte-identical.
- More than fields. The same generator now writes the rest of a game's non-battle music, each mood a set of
  leanings inside the same principles:
  - towns and interiors: `town`, `tavern` (folk instruments in any game), `shop`, `chapel`;
  - `night`;
  - `ceremony`, a stately procession with a brass lead (a new `processional` energy in the gates);
  - story cues: `prayer`, `sorrow`, `tension` (before a fight, not the fight), `betrayal`, `triumph`.
  Every mood carries its role (field, travel, town, interior, story), and the suggestion knows the new places.
  The existing moods are unchanged, note for note.

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
- Egypt's farm and works now use the Thebes town's own colours and wall skins, so a farm and the town
  beside it are the same Nile mud and the same gypsum wash.
- Thebes in its land: the town on the Nile's east bank, about 780 × 640 m of country around it.
  - The river runs on north and south past the town.
  - Downstream (north): the harbour, with stone quays, a barge and ships, a boatyard and granaries.
  - Upstream (south): the works, set by what each needs. The clay pits are at the water, with brick
    fields behind them. A stone quay and the masons' yard take the sandstone barged down from the
    quarries; then come the potters, carpenters, chariot makers, the foundry and the glass works.
  - East of the town: basins between their dykes, with the estates among them, out to the edge of the
    low desert. Shadufs and palms line the bank.
  - Three seasons: in the flood, the basins lie under water.
  - It opens from the air, in the fields, on a harbour quay, in the works, from a boat on the Nile,
    or in any of the town's own views.
- A region of an unknown culture is an error rather than a Sumerian town.
- The region's ground stays on the ground in the walkable World. A region is large enough that the
  World read the town's thin ground layers as one plane and stacked overlapping strips upward (by up
  to 4 m in Sumer's); its layers are now spread far enough apart to stay separate planes.

### Historic light

- **In progress.** A historic town takes the sixth-gen composer's light: the sun is baked once at build
  time and carried by the page. Each culture has a style card (`lib/graph/historic/style/`) that states
  how its town should look as principles, plus the numbers the builder reads. Each principle has a
  machine check (`style.test.js`).
- Cast shadows on the ground (`lib/graph/historic/light.js`). Every mass stands in an occluder
  heightfield. Battered walls, ziggurat tiers and pyramids are sliced so their slopes cast their true
  stepped profile. One sweep along the sun's azimuth then finds the ground in shade. A palm's crown
  floats and casts a gappy disc from its height.
- Sky occlusion darkens the foot of every wall and the floor of every narrow alley.
- The shade is a cool tint at the card's alpha, never black. It is one map for the whole town (about
  300 KB), laid into every ground face's background at that face's place, so overlapping shadows never
  darken twice.
- Measured on the current plans: Sumer's alleys are about a third in shade, against a twentieth of its
  main streets and a tenth of the precinct court.
- The page's backdrop is the card's sky, hazy blue overhead and pale with dust at the horizon,
  replacing the flat beige.
- `shade: false` leaves both off. The CSS 3D page only: the WebGL World ignores the map and keeps its own
  light. Shadows land on the ground, not yet on walls or lower roofs. The region, farmstead, works and
  asset-sheet scenes are unchanged.

### Historic Hellenic

- **In progress.** The first Greek city: Hellenistic Lindos on Rhodes, c. 180 BCE (`culture: 'lindos'`), and the
  first town on a sea cliff. The sanctuary of Athena stands on a rock 116 m over the water. Below it the town lies on
  the saddle between the great harbour and St Paul's bay. The picture is cropped to what the eye reads (the rock,
  the town, the two bays), not the whole district.
- Its record (`lib/graph/historic/record/lindos.js`) cites the temple (21.65 × 7.75 m, four Doric columns at each
  end), the propylaia, the 87 m stoa with its 42 columns and 21 m stair, the theatre and Pythokritos' ship relief. It
  lists what the scene must not show: the Knights' castle, the white cubic village, whitewash, the 1930s
  restorations, the Lindian Chronicle. Athena's sacrifices were fireless, so her altar never burns. Heights the
  record lacks are marked as conjecture in the kit.
- Rock is made, not drawn (`lib/graph/historic/rock.js`). The layout gives the rock its shape, and the landform
  operators weather it: strata bench and band the faces, joints break them into blocks, talus sheds scree at their
  feet. It is meshed in slices at the bed planes, so the cliff reads in bands. Only steep ground is weathered. The
  summit the temple stands on, the climb, the stair, the theatre and the town keep their exact levels.
- Ground that is not flat, for any culture (`lib/graph/historic/terrain.js`). A layout's height function may jump.
  Where it does, the step stands as a vertical face on the true contour, found by bisection: a cliff (bare rock) or,
  under 4 m, a dry-stone terrace wall. The town is built on terraces 3 m apart, with a street at the foot of every
  terrace wall and stairs climbing between them.
- The land casts. A style card can stand the land in the light bake (`light.terrain`), so the cliffs throw their
  shade on the sea. Lindos' card states six principles, each with a machine check: the value order of stucco,
  plaster, rock and cliff; the cliffs' shade on the water; the climb rising station by station, with nothing higher
  than the goddess; terrace walls no taller than a storey; turquoise shallows and a deep sea; fire in the town,
  never on the altar.
- A kit of the Doric order shared by every building: column, entablature with triglyphs, pediment, tile roof. It
  builds the temple, propylaia, stoa, great stair, theatre, courtyard houses on stone socles, the ship relief, statues,
  towers, kilns, a round tomb, warships and boats. Each was designed from a massing sheet dreamed on the local image
  worker. New patterns: classical order, tile roof, stoa, propylon, theatre, round tomb, peristyle, acropolis,
  terraced hillside, sea cliff, rock relief, statue base. New wall skins: dry stone, stuccoed poros, isodomic ashlar.
- Fire is opt-in (`fire: true`). The plan hands over its house hearths and potters' kilns as fire sources, in the
  fire channel's kinds. Without it the plan carries none.
- The generic Hellenistic polis (`culture: 'polis'`) is the same plan on a gentle hill, with no cliff and no open
  sea, so other Greek towns can start from it.
- **Historic cities on the WebGL World page** (`assembleHistoricWorld`, `renderHistoricCityToWorld`). The CSS 3D
  page draws each face as its own HTML element, and Chrome starts dropping faces when a town's eye-level views pass
  about ten thousand of them. On the World page the same faces are a few draw calls. Lindos loads in under a
  second and holds 60 fps in every view, at about 7.9 MB against 12.4 MB for the CSS page. The World page takes
  the scene as it is, its ground tiles and wall skins resolved to textures and the style card's sky as its sky
  dome. The CSS shade map is not baked for it (the World never reads it). The CSS page stays the light aerial
  preview.
- **Water you can see into.** On the World page the Lindos sea takes the native water look (`lagoon`): ripples,
  the sky reflected more strongly at a grazing angle, a sun glint, and froth where the water thins against the
  shore. Its depth comes from a seabed that shelves gently off the beaches and drops away under the cliffs, worked
  out from the distance to the shore. The water is clear turquoise over the sand in the shallows and opaque blue
  offshore, set by each corner's opacity on one translucent sheet whose pieces never overlap. The seabed (about a
  thousand triangles near the shore) is drawn on the World page only. The CSS page keeps its opaque two-tone sea.
  A culture opts in with `water.look`; terrain water takes `liquid`, `alphaAt`, `sheetFill` and `fine`.
- **Live fire on the World page.** With `fire: true` the potters' kilns and the hearths in the house courts burn
  live: flames, sparks, smoke and their light on the walls and ground. The painted flame cards stand down there,
  and the CSS page keeps them. The fire channel takes a new opt-in `unit` (metres per scene unit;
  `firePageChannel(…, { unit })`). The fires are given and burn in metres, since their buoyancy, smoke and sparks are
  physical, and the page scales them into the world's units, with their light falling off over the same metres.
  Without `unit` the fire script is byte-identical.
- Views: the great harbour from a boat (`bay`), the climb, the stoa's terrace and great stair, the temple court, the cliff from the sea, the
  theatre and a town street. Sumer, Thebes and Giza are byte-identical.

### Historic Qin

- **In progress.** Qin Xianyang and the Lishan works at c. 212 BCE, the first Chinese culture. Qin is the
  earliest Chinese city that still reads as Chinese (grey tile roofs, red columns, raised earth terraces,
  walled axial compounds), and early enough that its roofs are honestly straight.
- Its own record (`lib/graph/historic/record/qin.js`): Xianyang Palace No. 1, Epang's front hall begun,
  the Lishan mound, enclosures, gates and halls, terracotta Pit 1, the Wei bridge and the Zhengguo Canal.
  Each entry is cited and dated, with its confidence and the disputes between sources. Settled by the record:
  - No outer wall at Xianyang has been found, so none is drawn as fact.
  - Upswept eaves and glazed roof tiles are held with their much later dates.
  - The Han analogues (the Gaoyi que, pottery tower models, the Sichuan market brick) carry their CE dates,
    so a Qin scene uses one only by naming it as an analogue.
- A style card with a design language (`style/qin.js`):
  - One batter for every earth face, about 77°, with pounded courses of 6–10 cm.
  - Columns six to eight diameters tall on stone bases, one bracket block each.
  - Straight hip and gable roofs, with eave-end tiles 16 cm across.
  - A palette sampled from reference swatches.

  Each principle is checked on the kit before any town plan exists. The reference drawings, and what each
  one gives the kit, are indexed in `docs/historic/qin/`.
- The town (`culture: 'qin'`, layout `wei-wards`): Xianyang on the north bank of the Wei, with no outer
  wall.
  - The palace enclosure holds Palace No. 1 on its two-tier terrace, a lesser hall either side, and a
    pair of que in its south gate.
  - The axis runs on as a poplar-lined avenue to a timber pile bridge over the river.
  - Walled wards line the avenue, each with its gate on an east–west avenue and lanes of courtyard houses
    inside; the row under the palace is the elite's, with higher walls and tiled, hipped halls.
  - One ward is a walled market with its drum tower (a Han analogue, labelled as one).
  - Across the river, Epang's front hall is a building site of rising earth sections, plank forms, ramps
    and spoil.
  - Loess fields of millet and wheat lie round the town.
  - Views: palace, gate, avenue, ward, market, bridge, works.
- The Qin kit (`assets/qin.js`) builds every piece from the card's numbers: hall on terrace, que,
  rammed-earth wall, ward gate, courtyard house, market, terrace works, bridge and trees.
  - Roofs are frusta whose top is a ridge line, so they are straight by construction.
  - Two new wall skins: `hangtu` (pounded courses, rammer dimples, the board-form lifts and tie holes) and
    `tile-roof` (cover rows over pan channels). The tile skin is the first laid on a sloped face.
- New shared patterns: rammed earth, tiled roof, timber frame, terrace hall, walled ward, market and bridge.
- The page is about 21 MB, between Giza's and Thebes'. The other cultures are unchanged.
- The Qin ground in two steps, on the shared terrain mesher (`terrain.js`) as Lindos' is: the layout gives one
  height function and the mesher stands the steps up.
  - The palace stands on the lip of the Xianyang tableland, 10 m up. The bluff beneath it is sheer loess,
    ragged except under the palace, and cut by two gullies whose floors climb to the tableland.
  - The wards lie on the plain below. The axis climbs the bluff to the que as a rammed-earth causeway.
  - A new `bluff` view looks along the edge.
- The Wei through the same water channel as Lindos' sea. It uses the native `river` look, silty and flowing
  east, near opaque over the channel and clearer over the bars' shoulders, with a riverbed under it on the
  World page.
  - It is braided round sandbars. Each bar stands out of the bed with a low lip, so the mesher traces its
    outline on the true contour instead of stepping it to the grid.
- The World page is cropped to the town. A layout can ask for a skirt (`plan.world.skirt`): the land runs a short
  way past the frame, its heights carried out from the frame's edge, each corner fading to the sky's horizon
  colour with its distance. Past it there is only sky, so the town stays the focus however the World is turned.
  Qin's runs 260 m. Cultures without a skirt are unchanged.
  - Beyond it, on the World page only, a hazy Qinling in the south and the northern hills. They are brought in
    and scaled so they sit at about their real angle on the horizon.
- The height of the bluff and the line of the river are drawn, not measured. Both are in the record as
  unverified (`xianyang-tableland`, `wei-braided`); the Wei has since moved north over the old town.
- Qin opens on the shared World page (`renderHistoricCityToWorld`) like Lindos: about 15 MB self-contained,
  against about 21 MB for the CSS page.

### Historic entries

- **In progress.** The historic cities reach the agent. Until now they were reachable only from code.
- New world kind `historic`: `create_sketch({ manifest: { kind: 'historic', culture, scene, seed, … } })` mints
  a culture at its period as a walkable World:
  - `scene` is `city` (every culture), or `region`, `farm` or `works` where the culture has one;
  - an unknown culture or scene is refused with the list of ids;
  - the cities, regions, farms and works render as they did, byte-identical.
- Each culture card gains `readAt`, `period` and `place` as data, from its own documented header. Sumer has
  no read-at year yet: its card spans the Uruk and Early Dynastic periods. The generic polis has no place;
  it is invented.
- A caption for every historic scene (`lib/graph/depiction.js` `describeHistoric`), read from the cards.
  It keeps two questions apart: the PERIOD (when and where) and the DEPICTION (the era's budget plus a look).
  For example: "New Kingdom Thebes · New Kingdom, c. 1550–1070 BCE (read at c. 1250 BCE) · Thebes, Upper Egypt
  — drawn sixth-gen, to the thebes style card". A field a card lacks is never guessed.
- Encyclopedia entries, generated from the culture, record and style cards (`lib/graph/historic/entries.js`)
  and served as view-vocab cards of a new family `entry`. No tool is added and no tool description names an
  entry. An agent goes from a cold ask to a world in three calls:
  1. `semantic_search` finds the entry;
  2. `get_view_vocab({ id })` reads it;
  3. `create_sketch` mints one of its starters.
- What the cards carry:
  - **An entry** holds the infobox (subject, period, place, depiction, basis, checks), its parts by the ids
    its generators use, its scenes, and STARTERS: `historic` manifests to copy and change.
  - **Its record** (`<id>/record`) lists each record entry with its confidence and sources. It is read on
    demand and kept out of search, so an entry always answers before its sources.
  - **A region with more than one culture** (Egypt, the Greek world) gets a hub listing its entries in time
    order.
  - **BASIS** follows the record: read → ATTESTED, secondary → RECONSTRUCTED, unverified → CONJECTURAL. The
    town plan is never ATTESTED.
  - **SCOPE** says up front that each entry is a general depiction of its period, not one year's town, so
    anachronisms are expected: pieces from across the span side by side, gaps filled from parallels. The
    hubs and the routing card say the same, and the agent is told to say it when it hands a world over.
- Culture cards gain `region`, `aliases` (the words people search with: pharaoh, Luxor, ziggurat) and
  `record`, the record the entry stands on. The entries are found on the default lexical path, with no
  embedding model.
- A card contract test holds what an entry reads off each culture card: `years`, `period`, `readAt` (or null),
  `place` (or null when invented), `region`, `aliases` and `record` (or null). A new culture that lacks a line
  fails with the list of lines its card still needs. A card that says nothing about its place reads "place not
  recorded", never "invented". A region with no row of its own still gets its hub.
- Pompeii and the Forum Romanum (79 CE) are entries too, with their records and a Roman Italy hub: "pompeii",
  "vesuvius", "the roman forum" and "ancient rome" find them.
- `semantic_search` takes English terms, as its description already says. The host model translates first.
- A routing card, `historic`, sends a cold request to the entries. The routing eval gains rows for it.
- `get_view_vocab` takes the `entry` family. create_sketch's `manifest` property names the `historic` kind.
  The `tools/list` payload pin moves from 267,900 to 268,200 (measured 268,159).
- Fix: an upgraded install now indexes cards a release ships. The search index used to be built only when
  empty, so new cards (these entries, and any routing card added since) stayed unsearchable until a manual
  reindex. Once per process, before the first search, a corpus built by a reindex is checked for shipped
  cards it lacks, and one reindex adds them.
- Fix: record cards cite a group author whole ("various", not "various (sxlib").

### Historic on-ramp

- **In progress.** Adding a culture is a card, a registry line and a scaffold, at any depth:
  - depth 0: a card on another culture's layout and kit, in its own colours;
  - depth 1: plus its record and style card;
  - depth 2: plus its own assets;
  - depth 3: plus its own layout.
- Registries, one line per culture or layout: `historic/cultures/index.js`, `historic/layouts/index.js` and
  `historic/regions.js`, beside `historic/style/index.js`. `planHistoricCity` dispatches from the layout table
  and refuses an unknown layout id. A view the scale table does not name renders at eye level instead of an
  undefined scale. Every page is byte-identical.
- Each culture's depth is found, never claimed (`historic/depth.js`): what it shares with a culture
  registered before it, by identity. Its entry says it on a DEPTH line, for example "0 of 3: its own style
  card; record, assets and layout from lindos" for the polis.
- A card's `land` names its farm and works scenes, replacing a table written into three files. The scene lists
  follow the registry.
- `scripts/new-culture.mjs <id> --like <culture> …` scaffolds a culture at depth 0:
  - it writes a card spread from an existing culture, with every contract line filled or null, `record: null`
    and `land: null`;
  - it adds the registry line and `docs/historic/<id>/README.md`;
  - the culture renders, mints and is an entry on the first run;
  - `--dry` prints without writing; bad input is refused with what is on offer.
- A culture checklist test (`historic/cultures.test.js`): every layout is registered, every style card has
  its culture, every entry states its depth, every layout takes a card spread under a new id, and the
  scaffold is checked dry.
- The guide, `docs/historic/README.md`, covers the parts of a culture and their registries, the depths with
  the asset loop, new regions, the gates, and landing a culture on the trunk. A project skill,
  `/historic-culture`, runs it in order.

### Historic lineage

- **In progress.** Cultures draw on cultures. A culture card's `draws` names the earlier cultures it continues,
  inherits from, took forms from by contact, or varies, and what each relation carries (palette, skins,
  patterns, assets, layout, record).
- `historic/lineage.js` reads the tree off the cards. Its brief lists what a new culture can draw on at its
  year: patterns, skins and assets, and the record entries in use then. Drawn record entries stay the source's:
  each is a parallel to verify, never the new culture's own basis.
- What a record carries depends on the kind of relation. A tradition travels as its materials and methods
  (`inherits`, `contact`, `contemporary`); a culture's particular buildings and town form pass only on the same
  ground (`continues`) or to a version of the same town (`variant`).
- The relations now recorded: Thebes continues Giza; the polis is a variant of Lindos; Pompeii and the Forum
  inherit the Hellenistic orders from Lindos; the Forum is Pompeii's contemporary.
- Each entry gains a LINEAGE line, and a `historic-lineage` card in the encyclopedia holds the tree.
- `scripts/new-culture.mjs --draws <culture>:<kind>[:<parts>]` writes the relations on the new card, joins
  the patterns they carry, and writes the brief into its README. Dry runs for a Ptolemaic Thebes
  (continues Thebes, contact with Lindos) and a Byzantine Constantinople (inherits from the Forum and Lindos)
  each list what to start from.
- `historic/lineage.test.js` holds relations to history: every source registered, no culture its own ancestor,
  a source beginning before the culture drawing on it ends, a continuation beginning earlier, a variant on its
  source's layout. Every historic page is byte-identical.

### Animal entries

- The animal roster reaches search the way the historic cultures do. Each species gets an encyclopedia entry,
  generated from the roster (`lib/graph/fauna/entries.js`) and served as a solid-vocab card. No tool is added,
  and no tool description names an animal.
  - **The index** (`animals`) lists every animal by the name people say, plus the animals people ask for that
    aren't built yet, each with the built species that stands in.
  - **A hub per family** (`animal/feline`) lists its species and its NOT YET rows.
  - **An entry per species** (`animal/houseCat`) gives the subject, size, stance and basis, the STARTER spec to
    mint, and its kin.
- Each family module gains `about` (`common`, `aliases`, `sci`, `size`, `source`, moved out of the thesis
  comments into data) and `wanted` (`near`, `aliases`, `note`). The facts never reach a plan: every species
  builds byte-identically.
- `mint_solid` kind `animal` takes the name people say: `species: 'cat'` mints `houseCat`, and the result's
  `resolved_from` says so. Plurals and articles resolve too ('a penguin', 'wolves'). An asked-for animal
  that isn't built yet ('koala') is refused with its stand-in named. An unknown word points at the roster.
- A species minted as a ring plan reports its real stance (`four legs`, `two legs (a bird)`, `swims`,
  `legless`, …), not `quadruped` for all of them.
- A roster contract test holds what an entry reads:
  - every species has an `about` row;
  - every `wanted` row names a built stand-in and isn't built itself;
  - no name is claimed by two animals.
  A new roster (the arthropods) joins by adding itself to `ROSTERS`.
- The `get_solid_vocab` bare listing stays one row per kind and op: the generated entries are left out, and
  the `animal` card points at their index. The unknown-card error lists the hand-written cards and names the
  entries.
- The `animal` manual and routing card no longer list the old species ids or say `opts` work on a species.
  They point at the `animals` card.
- Fix: an upgraded install now indexes new solid-vocab cards too. The shipped-card check used to look at
  view-vocab and routing cards only.

### Animal locomotion studies

- **In progress.** Every animal gets the way it moves, written down by the biomechanics of its family, so it
  can later be animated by the leg-step and spine mechanics of its kind.
- The roster sorts into nine shared rigs (`lib/graph/fauna/locomotion/`): running toe-walkers, hoofed,
  flat-footed, pillar-legged, sprawling, hoppers, two-legged, wing-walkers, and whole-body wave (snakes and
  fish). Each rig file holds its families' entries:
  - the gaits, named in plain words (walk, trot, gallop, hop, slither, swim, …), each pointing at a footfall
    pattern or body wave with its duty factor, stride length per hip height and speed band (Froude number);
  - the spine bone counts, fixed per family;
  - how the spine, girdles, head and tail move with the stride;
  - species overrides where a family holds very different movers (snakes and the monitor lizard; the manta).
- Where scientists disagree, the entry takes the more visual reading and says so beside the value.
- Each species' encyclopedia entry lists its gaits (`MOVES`). No plan changes: every species builds
  byte-identically.
- Every species gets a bone tree (`lib/graph/fauna/skeleton.js`), derived from the plan it already builds:
  - spine, neck and tail bones laid along the body's own centreline, in the family's fixed counts, and a
    head bone pitched as worn; a camel's or plesiosaur's lofted neck is followed along its curve;
  - one bone per leg row, chained joint to joint; the main chain of each shoulder and hip limb carries a role
    (`fore.humerus` … `hind.metatarsus`), the shared animal profile a gait solver or a clip library maps by;
  - paired fins as their own bones; snakes and fish carve their tail from the rear of the body;
  - a binding for every plan part: torso, neck and tail stations ride the bones of their own region, a leg
    stripe rides its leg, other decorations ride the body.
  It is not wired into minting yet.
- A gait solver (`lib/graph/fauna/gait.js`) poses a species' skeleton through one stride of any of its gaits, in
  place on a treadmill:
  - feet plant at their phase offset for the gait's duty factor and swing forward between; the upper leg solves
    two-link to the foot block, the foot rolls over its ground contact at the ends of the stance and the girdle
    glides (the shoulder blade on the ribs) where the leg cannot reach;
  - the body dips with the stance legs and, in a flight phase, rises on a ballistic arc timed by the speed its
    stride implies (stride/h ≈ 2.3·Fr^0.3);
  - the spine flexes once a stride in gallops, bounds and hops, bends sideways as a standing wave in the
    sprawlers, and travels as a serpenoid wave in snakes and fish (the coiled snake straightened first);
  - fins and flippers stroke, heads hold level or nod, tails trail or counter-swing and drag on the ground.
  Wing beats wait for the wing bones. `scripts/fauna-gait-strip.mjs <species> <gait>` draws the stride as a
  stick GIF (side view over top view) for the eyes gate; a machine gate checks every gait of every species
  poses rigid bones and that planted feet stay down for their duty factor.
- The snakes' spine count rises to 20 trunk and 4 tail bones: two body waves need them.
- The skeleton gains the wing bones `wing.js` builds (the arm chain with `wing.humerus` / `wing.radius` /
  `wing.hand` roles, and the digits), and a penguin's flippers as fin bones. A `fly` gait rebuilds the wing at
  each instant's fold (spread on the downstroke, half folded coming up) and rolls it about the body's long axis;
  `glide` holds it spread. Strokes beat only their own limb group (wings, pectoral fins, flippers, paddles).
- **Animals move.** `mint_solid { kind: 'animal', spec: { species, motion } }` binds the minted solid to the
  species' skeleton and carries its gaits as clips. `motion` is `true` (every gait), a gait word or a list, or
  `{ gaits, keys }`; an unknown gait is refused with the species' own list. Without `motion` the plan is the
  species' own, byte-identical.
  - The plan gets a `bind` on every segment (a limb's joint rings shared with the bones either side, a body
    station blended toward the next bone as it nears that bone's end) and on the head, plus a `motion` record
    that expandPlan carries to the recipe.
  - The mint gate binds every vertex and checks the weights; the stats report the bones and the clips.
  - At read time `packFaunaRig` (`lib/graph/fauna/rig.js`) packs the mesh through `packLayeredRig` with a stand-in
    rig of the skeleton's bones and no clips (the humanoid path is untouched), then appends one clip per gait from
    the gait solver: the absolute rotation and posed head of every bone at every key, and the stride's own
    duration. The World page previews the clips, the skinned GLB carries them (`export_model { clips: '_all',
    skinned: true }`), and the Godot pack plays the first.
  - The worn wing still rides its root bone rigidly; weighting its surface from wing.js's own bindings is next.
- The equine trunk is shaped in its mammal regions instead of one even barrel: a rounded buttock, broad quarters
  over the hip, the loin and flank tucked in and up (the belly line climbs to the stifle), the rib barrel deepening to
  the girth behind the elbow, the withers, and a narrow breast. It sits on the stable ring frame (`torsoUp`) so the
  centres can rise and fall. The horse and zebra change (the zebra's stripe hoops now follow the trunk's height as
  well as its radius); the camel keeps its own level trunk and builds byte-identically.
- The horse and zebra heads are rebuilt level at true size and pitched nose-down (`headPitch`), instead of sheared
  (the shear stretched the skull along its slope to ~0.9 m, half again a horse's, and slanted every feature). Now
  ~0.59 m poll to lips (published 0.55–0.65 m): a broad flat forehead with the eyes set on the sides at its widest,
  seated and lidded (the set eye); a nasal line narrowing to ~0.10 m mid-face; a soft muzzle flaring at large open
  nostrils with no bare nose pad; a round jowl curving up into a thin under-jaw, chin and lower lip; the mouth line
  only over the last quarter (behind the corner the jaw covers the seam). The zebra's head grows to ~0.52 m.
  Three opt-in builder fields carry it, each zero bytes when absent: `nostrilR` / `nostrilSquash`, `nosePad: false`,
  `webJaw` (the jaw end of the mouth-corner web). The camel and the giraffe (whose head starts from the equine one,
  now exported as `CLASSIC_HEAD`) build byte-identically.
- Tails balance the body instead of swinging as decoration. A tail is the snakes' and fish's travelling wave run
  from the pelvis (one helper, `travelling`, now drives both; every snake and fish wave is bit-for-bit unchanged): its
  root answers the spin the swinging legs give the body, each foot's fore-aft travel signed by its side for the yaw
  and summed for the pitch, so a trot's diagonal pairs cancel and the tail rides calm, a biped's stride or a pace sways
  it, and a hop or bound swings it up and down. The plain tail words (`TAILS` in the locomotion data) carry the
  mechanics: a `counter`weight swings stiffly against the spin, a `trail`ing tail follows late with a whipping tip, a
  `prop` is planted as a fifth leg (the kangaroo's slow walk presses it to the ground with the forelegs), `drive`
  trails on land and rests while fins row. A heavy tail answers with a smaller swing (it shrinks as the tail outgrows
  the hip height). The kangaroo's tail is now `prop` and the crocodile's `counter`; every species card carries a
  `TAIL` line saying what the tail does.
- A tail's motion now follows from what it is made of and how long it is, measured from the model. `TAIL_BUILDS`
  (flesh, fur, hair switch, stub, feather) say how much of the drawn girth is mass, how freely it swings and whether
  air lifts it; each family has one (the squirrel's is fur). From the plan: the tail's inertia over the body's and
  over each leg pair's, and its swinging length (a horse's hair included). A counterweight answers the legs' angular
  momentum by their inertia over the tail's (a T. rex's heavy legs sway its tail; a squirrel's light legs barely
  move its), a share of it in steady straight gaits (turns and leaps use the rest). A trailing tail sways with the
  hips at a walk and trot and is braced at the gallop (Wada et al. 1993, dogs). On top, every free tail is a
  pendulum shaken at its root by the hips' sway and the body's real bob: a long hair switch swings late and wide, a
  bushy brush shaken fast stays put while the body bounds beneath it, and hair and fur stream up at speed. The
  white-tailed deer flags its tail in flight (`flag`); the moose holds its still. A body part that is not a tail no
  longer binds to tail bones (the kangaroo's trunk rode `tail0`). Cards read `TAIL  <build>: <use>`.
- The spine follows the footfalls instead of a fixed wave. From above, each girdle turns with its own pair's leading
  leg (`axial.yaw`, which the solver had ignored: the shoulder or hip swings forward with its leg, lengthening the
  stride), and the trunk bends between the two (`axial.lateral`, the sprawlers' standing wave, now locked to which
  feet are down): opposite turns in a trot bow it into a C that flips each step, the same turn in a pace bends
  nothing, and most of the girdles' common turn is cancelled so the trunk swings about its middle. From the side the
  back rounds as the legs gather (hind feet forward, forefeet back) and stretches as they extend (`axial.flex`): hard
  in a gallop and a bound, slight in a trot, none in a pronk. The planted feet still hold (the legs absorb the
  girdles' turn); every snake and fish wave is unchanged.

### Environmental sound

- **In progress.** A historic world can carry its period's music: add `"audio": { "soundtrack": "default" }`
  to a `historic` manifest and the world plays a synthesized bed in its culture's mood
  (`lib/graph/historic/soundtrack.js`). Each mood is led by a timbre standing in for an instrument the culture
  played:

  | Mood | Cultures | Lead instruments |
  |---|---|---|
  | Sumer | Sumer | a dark lyre pluck and a reed pipe over a drone |
  | Egypt | Thebes, Giza | a harp ostinato with sistrum shimmer |
  | Greek | Lindos, the polis | a kithara and a droning aulos over the sea |
  | Qin | Qin | a zheng with pressed bends, bronze bell chimes |
  | Roman | Pompeii, the Forum | a water organ, a cithara and a distant horn call |

- The instruments are attested; the scales, tempi and harmony are conjecture, since no ancient performance
  survives as sound. The world's seed re-rolls the performance, so two towns of one culture sound related but
  not the same.
- Without the opt-in a world is silent and unchanged. The other `audio` fields (wind, bindings, cues) still
  combine with it.
- A culture names its mood on its card (`soundtrack`). A culture scaffolded from another plays its parent's
  mood until it has its own, and a new mood is a row in `MOODS`.
- Each entry gains a SOUND line and a starter with its period music.

### Historic miniatures

- **Spike.** A historic city can stand its people about for scale and flavour: add `"people": true` (or
  `{ "density": 0–1, "citizens": false, "hands": false }`) to a `historic` manifest with the `city` scene, and
  the World page fills in two groups (`lib/graph/historic/miniatures.js`). Static figures only: no motion, no
  paths.
  - Citizens stand alone, in pairs or in households on the lanes, the open ground and the plan's square. They
    are thicker on a main street than in a back alley.
  - Field hands work in gangs on the flat ground outside the wall: stooped over the crop, at the hoe, or
    carrying.
- Each figure is the fractal city's pedestrian at a new `mini` level of detail, under 300 quads. Nobody is bare:
  every garment covers the torso and hangs a skirt of cloth to its hem (`cut`: knee, shin or ankle).
  - The skirt is fitted to the posed figure. Its top is the trunk's own waist, so it tilts when the figure bends;
    each ring below wraps the hips and legs at its height, so a stride or a bent knee pushes the cloth out
    instead of poking through. The legs under it are not drawn.
  - Sleeves carry the shirt down the forearm, and `legs` give trousers.
  - Colour is the culture's palette over the body's regions and the skirt.
  - Dress per culture: Roman tunic, toga and stola; Greek chiton, himation and peplos; the Egyptian linen tunic over
    a kilt, and the sheath; the Sumerian fleece skirt under a shawl; the Qin long dark robe, and the labourer's
    jacket over hemp trousers.
  - New work poses: `stoop`, `hoe`, `carry`.
- Beasts of burden (`lib/graph/historic/beasts.js`), on unless `beasts: false`:
  - In the fields, plough teams: two oxen abreast under a yoke at the neck, the ploughman behind.
  - On the open streets, pack donkeys and mules with panniers, and horses, each led by a driver at its head.
  - Each culture works its own herd: oxen and donkeys from Sumer to Egypt, mules among the Greeks and Romans,
    horses and oxen for Qin.
  - Each beast was designed with the creature creator (`mint_solid` kind `animal`, iterated with `update_sketch`)
    and is carried as the recipe that sketch stores. The ox is the bull gelded to a heavier draught body, short
    horns and a pale coat; the donkey and the mule are new, from the horse; the horse and the camel are the
    species. The camel is drawn by no culture here, since it came after these periods.
  - `lib/graph/figures/beast-asset.js` bakes a recipe low-poly (about 400 faces against about 9,000). It uses the
    animal kind's overlap body, keeps the coat and its pale belly, and drops the eye and nose dots.
  - Beasts come after the people on their own seeded stream, so turning them off moves no one. Each needs footing
    under all four hooves, clear of the people.
- The people and the beasts are shaded smooth (`lib/graph/figures/smooth-corners.js`). Each corner takes the
  normal averaged over the faces that share it in its own part (a limb, the trunk, the skirt), and the World page
  shades by corner (`cornerFills`), so the low-poly forms read as rounded rather than faceted. The silhouette and
  the face count are unchanged, and a colour edge (a hem, a sleeve, a belly) stays crisp. The pedestrian takes it
  as `smooth`, off by default, so the fractal city's people are unchanged.
- The region, the farm and the works take `people` too (`lib/graph/historic/crews.js`). Their kits build every
  tool and building at rest and say who belongs there, and this places them.
  - Hitching: every yoke with a pole run back from it gets its team, two abreast, necks at the yoke, facing away
    from the pole. The yoke and the pole's front end lift from the ground to the necks. Oxen draw the plough, the
    culture's pack animal the cart, oxen or (in Sumer, as its kit says) donkeys the threshing sledge, and horses
    the chariot. The ploughman stands behind the stilts; any other driver at the head.
  - Crews: each workshop and farm building names its workers in `CREWS` (reapers bent along the barley's cut edge,
    diggers in the clay pit, moulders on the brick field, smiths, potters, the haulers ahead of a stone sledge,
    scribes in the shade). They stand in the slot's own frame, at its working front, inside it or ahead of it,
    each in a pose for the work. Byres, stables and grain packs get their beasts.
  - The region's town has its citizens on the town's own claim grid, where the region set it down. Its strip
    fields have field hands and plough teams, and its estates and quarters their crews.
  - Outside a town, a figure stands on the scene's own ground heights, so the clay pit's diggers stand on its
    floor.
  - With `people` absent every scene is byte-identical, and the CSS pages never draw people. `crews: false` leaves
    out the crews. The town's own output is unchanged by the shared placing kit this needed (`folkKit`).
- The city takes the same crews. Its work places name their people too: priests and worshippers at the altars
  and before the temples, women with jars at the wells and fountains, shopkeepers at Pompeii's shop fronts with
  customers in the street, potters at the kilns, bakers and craftsmen in Giza's bakeries and workshops, quarrymen,
  porters on the quays, boatmen aboard, traffic and a pack animal at the gates, and traders and their beasts in
  the Qin market. A crew can now stand before a slot facing into it (`before`), work up on a quay's top or a
  ship's hull (`deck`), and fill a big market or court in proportion to its area (`per`). Priests, shopkeepers and
  guards wear the town's dress rather than the labourer's. The town's own people are unchanged; the Forum, whose
  layout has no slots, has none yet.
- Dress changes with the era. Clothing is now part of each culture's record, as dated and cited `dress` entries
  next to its materials and building types (`lib/graph/historic/dress.js`). Each entry is one garment: who wore
  it (the man or the woman of the street, or the labourer), its span, its hem, sleeves or trousers, and a few
  colourways. The people wear what was in use at the culture's year, and `people.year` asks for another year:
  the buildings stay as they are, and the people dress as that year's people did.
  - A culture with nothing recorded for a year dresses as the culture it draws its dress from (the new `dress`
    part of a lineage relation): the Forum from Pompeii, the polis from Lindos, Thebes before the New Kingdom
    from Giza, and Pompeii, before its Roman entries begin, from the Greek tradition.
  - `checkRecord` checks a dress entry like any other: its wearer, its hem, its colours, and that every look
    covers the torso.
- Cloaks and headwear. The miniature can wear a cloak, hung from a collar over the shoulders, the trunk and the
  upper arms to the hip or the knee, with the forearms coming out under it. It can also wear one of three head
  coverings: a `cap`, a broad-brimmed hat (`brim`), or a `veil` that falls past the chin onto the shoulders and
  leaves the face open. Each is fitted to the posed figure the way the skirt is, in its own colour, and the
  figure is unchanged without one (`lib/graph/figures/pedestrian-asset.js`). The record now dresses people in:
  - the Roman paenula, on labourers from the early Empire and on citizens from the 3rd century;
  - the Roman palla, and the Greek himation, drawn over the head;
  - the Greek chlamys, from the 5th to the 3rd century, and the petasos on labourers;
  - the Sumerian sheepskin over the kaunakes;
  - the fur cap of the Zhao horsemen's dress, and the Qin commoner's black headcloth from 221 BCE.
- A figure stands on a kerb or a step and refuses a spot taken by anything taller.
- Without the opt-in, a world and the CSS page are unchanged, and so are the fractal city's pedestrians.
- Not yet: instanced drawing, sheep and goats for the folds, people on the Forum (its layout returns no claim grid),
  and seated poses (the scribes stand). Pompeii
  with people is a little over twice the faces of Pompeii without. The Forum layout returns no claim grid yet, so
  it has no people.

### Pompeii's land

- Pompeii gets a farm scene (`scene: 'farm'`), and a works scene is next. Both draw on a new cited record of
  its land and workshops (`lib/graph/historic/record/pompeii-land.js`), spread into Pompeii's record.
  - The record covers:
    - the villas of Boscoreale: Villa Regina's 18 dolia (about 10,000 litres) and the Pisanella's olive mill;
    - the lever press of the Villa of the Mysteries;
    - the vineyard inside the walls;
    - the bakeries with their donkey mills, the fullery, the fish-sauce works, the tannery, the dyers, the
      potters, a building site and a smithy;
    - the carts and the stable of Civita Giuliana.

    Each entry is cited, with its confidence and its disputes. What was working at the eruption but has no
    recorded building date is held from 79, not back-dated.
  - The farm is a villa rustica at the vintage, its one season. It is a new `villa` layout beside the flood-plain
    farm, which stays as it was.
    - The villa stands round its court, facing a country road rutted at its cart's gauge, with the dolia sunk in
      the court.
    - The press room and the olive mill stand behind it, the stable beside it, and the threshing terrace and a
      barn with its pergola to the east.
    - The vineyard lies in blocks of staked rows over the north, with an olive grove and a reaped field.
    - A cart waits at the gate for the grapes, its pole down to the yoke.
  - Its nine pieces (`lib/graph/historic/assets/pompeii-land.js`) are placeholders, `designed: false`, massed to
    the record's numbers where it gives them and to stated conjecture where it does not.
  - With `people`, pickers work the vine rows, treaders and pressmen the press room, two men the olive mill, and
    the household the court. Horses stand in the stable, and the cart's pair is hitched with its carter.
  - The farm's aerial view can be aimed by its plan (`aerialAt`). Sumer's and Egypt's farm and works scenes are
    byte-identical.

### Historic Rome

- **In progress.** The first Roman culture: Pompeii on a summer morning of 79 CE, before the eruption. It is
  the best-attested Roman town, town-sized like Lindos and Xianyang, and it gives a fixed moment to read at.
  - The scene covers the western half: the forum, the old town, the theatres on the south bluff, the Stabian
    Baths, Via dell'Abbondanza to Via Stabiana, and the Porta Marina climb. That is about Qin's frame, so its
    page budget is known. The amphitheatre, about 1 km east, waits for a later phase.
- Its own record (`lib/graph/historic/record/pompeii.js`): the forum and its temples, halls and porticoes, the
  theatres, the baths, the houses, shops and bakeries, the walls and gates, the water, and the tombs outside
  Porta Ercolano. Each entry is cited and dated, with its confidence and the disputes between sources.
  Settled by the record:
  - Every building carries its state at 79 CE (standing, repaired, damaged, under repair, unfinished, relic).
    Seventeen years after the earthquake of 62 the town is mid-repair, and a scene draws it that way: the
    Capitolium awaits restoration, the Temple of Venus and the Central Baths are unfinished, and only the
    Temple of Isis was wholly rebuilt.
  - Marble is a veneer on a few buildings, much of it stripped or unfinished. The town is tufa, limestone,
    concrete and painted stucco.
  - Vesuvius is one broad mountain, flat-topped and in vines. The eruption and the modern cone are held from 80,
    so a 79 read excludes them; so are the excavated ruins, the 1943 bomb damage and the post-war rebuilds.
- A style card (`style/pompeii.js`) with six principles, each checked on the kit:
  - the podium temple rules the forum;
  - painted walls, never white;
  - low red roofs;
  - the street as a channel of lava between kerbs, with stepping stones;
  - the orders' proportions;
  - a Campanian sky.

  Its roof pitch, kerb and stepping-stone sizes are design numbers, since the sources read give none. Its
  palette is estimated until the reference swatches exist.
- A design brief for the reference drawings (`docs/historic/pompeii/README.md`), in the house style of Qin's,
  with the kit constants and the gaps the record leaves. The drawings themselves are not made yet.
- The town laid out before its pieces are designed (culture `pompeii`, layout `lava-spur`). Every building is a
  placeholder until it is designed, so the asset call lists all of them as still to design and gives the drawing
  brief real sizes.
  - The forum at the record's 143 × 38 m: the Capitolium on its podium at the north end between two arches,
    porticoes on three sides, and the halls round it where they stood.
  - Via dell'Abbondanza at its recorded widths, with the other named streets. Every street runs as lava paving
    sunk between kerbed pavements.
  - The Stabian Baths, the theatre quarter on the south bluff, and the Temple of Venus inside Porta Marina.
  - About 700 houses, those on the main streets with shops, and fountains at the main crossings.
  - The spur over the plain, with the Porta Marina ramp; Vesuvius and the Monti Lattari on the World page's
    horizon.
  - Each monument's slot carries its state from the record: the Capitolium stands roofless, and Venus, the
    Apollo repairs and the travertine colonnade have scaffolding.
- The placeholders are massing blocks in the card's numbers, plus pieces borrowed as they stand from Lindos
  (the courtyard house less its porch, the wall, towers, the theatre, statues). The World page is about 15 MB,
  Qin's size.
- New shared patterns: podium temple, forum, atrium house, taberna, arch, street fountain, kerbed street. The
  other cultures' pages are byte-identical.
- The town's art, sourced into the record first (Mau's *Pompeii, Its Life and Art*, the Naples museum, Pompeii in
  Pictures):
  - **Floors and pools.** About two houses in five have a black-and-white mosaic floor in the atrium (a new ground
    tile, `tessellatum`), and every atrium has its marble-rimmed impluvium.
  - **The House of the Faun.** About 3,000 m², with two atria, the bronze Dancing Faun (0.71 m) in the first one's
    pool, and the Alexander Mosaic (5.82 × 3.13 m) in its four colours on the exedra floor between the two gardens.
  - **Painted fronts.** House fronts in cream, yellow or red stucco, a red field on a black socle. Lots on the main
    streets now face them and open shops on them. Their walls carry the election notices: a new wall skin,
    `dipinti`, with red and black capitals on whitewashed panels at head height.
  - **The forum's statues.** A row of equestrian bases down the west side and four colossal bases across the south
    end. No forum statue survives and they were probably stored after 62, so most bases stand empty; the two
    statues drawn are conjecture.
  - **Burning altars.** Before the Temples of Apollo, Vespasian (newly placed) and Isis. Roman sacrifice was burnt,
    the opposite of Athena Lindia's fireless rite; with `fire: true` the World page burns them live.
- A second pass at Porta Marina and the roofs:
  - **The gate.** Its two passages are barrel-vaulted under round arches, ringed in paler stone, with a parapet on top.
    The climb to it is as wide as the gate: a cart ramp up to the wide passage and a stepped footway up to the narrow
    one, between cheek walls, and a paved space inside. The middle cheek wall fills the full width of the pier between
    the passages, and a stone footing carries the gate's front where it stands out past the spur's edge. A walker can
    go from the foot of the ramp through the gate into town without falling.
  - **The roofs.** The borrowed Lindos house roofs rise above the wall top to their outer edge, so they seemed to float.
    They are now closed onto the walls, and the halls' gable ends are closed flush in stucco.
- New shared patterns: mosaic floor, painted notice. The World page is about 19.7 MB. The other cultures' pages are
  still byte-identical.
- A close-scale study beside the town, in progress: the Forum Romanum on the same summer day of 79, about 240 × 160 m,
  where the detail goes into the buildings themselves.
  - **The orders as real parts** (`assets/orders.js`), measured in the column's lower diameter as the Romans wrote
    them. The Attic base has its plinth, tori and scotia; the shaft is fluted in 24 channels and tapers above its
    lower third. The Corinthian capital has two rows of acanthus with raised midribs and drooping tips, the
    caulicoli, corner volutes, inner helices, and the abacus with its flowers. Ionic and Tuscan capitals sit beside
    it. The entablature segment has three fasciae, the frieze, dentils, modillions, the corona and the sima.
  - Each part is built once, to stand many times as an instance on the World page, so the detail costs its faces
    once. A Corinthian column is about 1,200 panels.
  - **The record** (`record/forum.js`), read at Pompeii's moment with Pompeii's states, mostly from Platner & Ashby,
    Digital Augustan Rome and the Parco del Colosseo:
    - Each temple carries its podium and its order with column counts and sizes. The orders are dated methods, so a
      building can use only an order Rome already had.
    - In 79 the Temple of Vespasian does not exist yet, since Vespasian was deified only after his death that June.
      Its plot below the Tabularium stays open.
    - Vesta and the House of the Vestals stand rebuilt after the fire of 64, and the Capitoline temple after 69.
    - Anachronisms are held at their real dates: Saturn's late-antique Ionic porch, Diocletian's brick Curia and
      basilica piers, the Severan Vesta, the Equus Domitiani, the Umbilicus.
    - The disputes are recorded and the scene takes one side of each: Saturn Corinthian in 79, Concord's porch of
      six columns, Divus Julius Ionic.
  - **The style card** (`style/forum.js`), six principles, each measured on the built parts:
    - each order's height, base, capital and taper in lower diameters;
    - the entablature about a quarter of the column;
    - podia with a front stair, and close-set columns;
    - Luna marble brightest, then travertine, tufa, peperino and basalt;
    - the long open square;
    - the summer sky.
    The orders module reads its numbers from the card. The design brief, with nine drawing prompts, is in
    `docs/historic/forum/README.md`.
  - **The site** (`layouts/forum.js`, the `forum` culture): a measured plan, not a generated one. Every monument
    stands at the record's size and in its facing, all of them placeholders:
    - the Tabularium's arcade over its blank wall;
    - Concord's wide cella with its six-column pronaos;
    - Saturn on its 9 m podium;
    - the Rostra with two rows of bronze beaks;
    - the Arch of Tiberius and the Golden Milestone;
    - the Curia with its porch;
    - the Basilica Aemilia's two-storey arcade over the Tabernae Novae, and the Basilica Julia's, with their naves and
      clerestories;
    - Castor, octastyle peripteral with 8 × 11 columns on its 7 m podium, its tribunal part way up the stair;
    - Divus Julius on its beaked platform round the altar niche;
    - the three-bay Arch of Augustus;
    - the Regia, the round Temple of Vesta with its 20 columns, and the House of the Vestals;
    - in the square, the Lacus Curtius, and the fig and the olive with Marsyas.

    The plot where the Temple of Vespasian will stand is left open. On the World page the Capitoline rises behind the
    Tabularium with Vespasian's rebuilt Temple of Jupiter on it, and the Palatine to the south-east. Views: the square
    from Divus Julius, Castor's corner, the Sacra Via, the Rostra, and the Capitoline brow.
  - **Instancing.** The 315 columns, entablature runs and arcade bays are 55 templates (`assets/forum.js`), which the
    World page draws as instances (`repeats`). A part turned to another side is its own template, because templates
    are baked lit; columns never turn. The CSS page draws a light stand-in for each. The World page is about 7.4 MB.
  - New shared patterns: basilica, round temple, rostra. The other cultures' pages are byte-identical.
  - **Roofs, monuments and reliefs**, sourced into the record first (Pliny's *Natural History*, dedicated in 77, says
    what "still stands"; Velleius; Platner & Ashby):
    - **Tiled roofs.** Every slope is a bed of tegulae under rows of imbrices, each tile its own shade, with
      antefixes along the eaves, ridge tiles, and a soffit under the eaves so a roof seen from below closes.
      Jupiter's temple on the Capitol has gilt-bronze tiles, and Vesta's cone bronze ribs.
    - **By the Rostra:** Octavian's horseman on the platform; the three Sibyls and the Hercules in a tunic beside
      it; Duilius's rostral column and Octavian's gilded one with his statue.
    - **In the square:**
      - the Lacus Curtius, moved to its place near the west end, with the Curtius relief on its balustrade and a
        puteal;
      - the fig, the olive and the vine with Marsyas;
      - the praetor's timber tribunal;
      - Surdinus's inscription as written, `L·NAEVIVS·L·F·SVRDINVS·PR`, in bronze letters 30 cm high set into
        the travertine.
    - **Round the square:**
      - the shrine of Ianus Geminus at the Argiletum, its bronze doors shut, as Vespasian left them;
      - Venus Cloacina's railed round shrine and the Lapis Niger;
      - Hercules and Mercury at Concord's stair, and the Victory and statues on the Curia;
      - the kneeling captives in coloured marble and the portrait shields on the Basilica Aemilia's attic;
      - the bronze Vortumnus at the Vicus Tuscus, and Caesar's cuirassed statue;
      - the Dioscuri with their horses at the Juturna basin.
    - **Reliefs and lettering** (new wall skins drawn in `relief-art.js`):
      - an acanthus scroll on Divus Julius's frieze;
      - the Basilica Aemilia's Doric frieze of ox skulls and libation bowls;
      - the Fasti's lists in the Arch of Augustus's side bays;
      - one band of gilt-bronze capitals across the fronts of Saturn and Divus Julius. These are real Roman
        letterforms, but the record holds no text for those dedications, so the letters spell nothing.
    - **Festival dressing (opt-in, `festival: true`).** Livy has the aediles hang shields in the forum only on
      procession days, so the ordinary day shows none. The option hangs gilded shields on the basilicas' piers and
      garlands across the temple fronts. Awnings are Republican one-offs (Pliny) and are not drawn.
    - Fixed: a lifted building now lifts its beams too, so the roofs of temples set on platforms sit on them. The
      World page collects an instanced template's textures, so friezes and lettering show on it.
    - The World page is about 11.9 MB, or 12.3 MB with the festival.
  - **The Basilica Julia, opened.** In the forum, as at Rome generally, decorated floors were indoors: the square was
    travertine. The record gives the Julia a coloured-marble pavement in its central hall and white marble in its
    aisles, and about 80 game boards scratched into its steps and floor (Platner & Ashby). The basilica is now a hall to
    walk into:
    - steps up from the Sacra Via onto its podium;
    - the façade arcade on all four sides;
    - aisles all round, two deep along the long sides (the five aisles);
    - inner pier arcades on two storeys carrying the galleries;
    - the nave, 82 × 16 m, rising to clerestory windows under a trussed timber roof.

    Two new floor tiles in `ground.js`:
    - `opus-sectile`: panels of cut, veined marble framed in white, alternating a giallo field round a pavonazzetto
      lozenge and an africano roundel with a porta santa field round a cipollino ring;
    - `lusoria`: white marble slabs with merels boards, the eight-spoked wheel and twelve-line boards scratched in.

    A walker crosses from the nave through the arcades to the front aisle on the floor. The page is about 12.6 MB.
  - **The Temple of Castor, as Platner & Ashby describe it, and opened.**
    - **The stairs, corrected.** The platform's front is a sheer face, a speakers' platform with a balustrade, and is
      reached by "two narrow staircases, at the ends and not in front". The broad flight of eleven steps runs from the
      platform up to the porch.
    - **The podium's vaults:** chambers in its flanks behind bronze grilles, the banks and strongrooms of the fiscus and
      of private depositors.
    - **The cella:** at the record's 16 × 19.7 m, its bronze doors swung back. Inside are the Tiberian black-and-white
      mosaic floor (later replaced by coloured marble, date unknown: recorded as a dispute), smaller columns of giallo
      antico along the walls (Italian Wikipedia), and a coffered ceiling. The twins' cult statues stand on a base at
      the back; their form is unverified.
    - A walker goes from the porch through the doorway down the cella on its floor. The page is about 13.2 MB.

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
- The `delfino-plaza` kit is dressed to a style card (`lib/graph/era/style/delfino-plaza.js`, dressing in
  `lib/graph/era/plaza-dress.js`), with a check for each principle:
  - Hard sun, measured: sunlit stucco > sunlit paving > the shade (a pale blue, never black) > terracotta.
  - A fountain at the square's centre: a lathed marble basin, pedestal, bowl and finial, water standing in
    basin and bowl and falling from the bowl's lip in streams, ringed by sandstone paving.
  - The floor is fan-pattern setts (`floor:fan`, new): overlapping arcs, no two setts alike.
  - Blends by cause: sand blown against the house fronts and drifted deepest into the corner, worn off at
    the doors and along the way in; the ring round the basin dark where it splashes.
  - Painted cutouts on the fronts: flower boxes under windows, striped awnings over doors whose shade is
    striped (the sun reads the card), and laundry strung across the corner.
  - The town goes on: rows of rooftop cards beyond the closed sides, each row carried toward the reference's
    horizon colour by its distance (aerial perspective after the light, not baked).
  - No two neighbouring houses dress alike.
  - A Renaissance order (`lib/graph/era/piazza.js`): a portico of grey-stone columns and round arches along
    the sunlit side, with blue-and-white roundels in the spandrels. Its roof is a walkway of hexagonal cotto.
    The shade under it is warm, lit from below by the square (measured: warmer than a wall turned from the
    sun, darker than the paving). Houses behind it carry no balconies, and their doors no awnings.
  - Walkways railed in stone: lathed balusters between a plinth and a rail, pedestals on the column lines
    carrying urns, and a stair of even treads climbing the portico's front to a landing, with a raking rail.
  - Two red granite obelisks on stepped pedestals, either side of the fountain across the line from the way
    in, standing over every eave, with bronze balls under the shaft and a cross on the point.
  - Long-and-short quoins up every house edge.
  - The sky is a place: a cloud deck (`effects`, the `undershot` deck the trail uses) over the square, and
    the town's ribbed dome and banded bell tower over the roofs, faded toward the horizon like the rooftop
    rows. A stage carries `effects` only when its dressing names clouds.
  `plazaWall` takes an optional `record` that receives each house's door and windows. The nave's dressing and
  the plaza's share one shape the stage composes. `lathe` moves to `lib/graph/era/geom.js`. `gothic-stone`
  and `gothic-nave` are unchanged.
- `card` and `crossed` (one painted card, and cards crossed about a vertical axis) move to
  `lib/graph/era/geom.js`, and `dice` is exported from `lib/graph/era/nature.js`, shared by the trail and the
  jungle. The jungle's output is unchanged.
- `emitThreeWorld` draws faces marked `blend: true` in their own translucent pass: a second texture faded in
  per corner by `cornerAlpha`, multiplied by the baked colour, drawn over the surface beneath it without
  flickering. This is the era's two-tile vertex blend. Worlds without blend faces are unchanged.
- Leaf cards (`lib/graph/era/leaf-cards.js`): painted RGBA leaf textures (`card:broadleaf`, `card:fern`,
  `card:spray`, `card:vine`, `card:litter`, `card:roots`, `card:bamboo`, `card:grass`, `card:bough`,
  `card:meadow`, `card:ivy`, `card:cobweb`, `card:banner`, `card:flowers`, `card:laundry`, `card:awning`,
  `card:roofs`), resolved through the surface-texture registry. New
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

### Stage isekai

- A new stage kit, `isekai-meadow`, for the open-field anime look of current-era games. Its reference cards are
  Genshin Impact and Breath of the Wild (`lib/graph/era/current-gen.js`). It is built only from sixth-gen parts:
  - painted 256-px tiles;
  - baked vertex light;
  - cutout cards.
- A PALETTE LOCK (`lib/graph/era/palette.js`): the style card names ramps of colour stops. Every baked colour on a
  locked group is projected onto its ramp, so shading moves a colour along its ramp and never off it.
- PIXEL-LOCKED rocks and cliffs:
  - The tiles (`lib/graph/era/isekai-tiles.js`, the `isekai:` resolver) are painted only in their ramp's stops.
  - They are drawn unlit, and the light lives in the choice of tile: each facet takes a lit or a shade tile by the
    sun and its cast shadow. That gives two-tone cel bands with no new renderer.
  - The cliffs are the landform's own geology drawn with strata tiles.
  - The rocks are new chunky boulders, lofted from an irregular footprint to a flat top.
- HATS: a boulder's top wears a grass cap with a ragged fringe hanging round its rim, and every cliff lip gets the
  same fringe hanging over the face.
- Trees are crowns of overlapping round masses on a short trunk, with one hero tree where the eye lands. Grass is
  crossed blade cards, pixel-locked, and within reach of the trail it stands as one continuous field of blades.
- DEPTH BY PAINTED LAYERS:
  - Far ranges stand as rings round the site, each its own colour from the far ramp, with a peaked skyline.
  - The nearest layer is a skirt of land from the site's own edge up to its skyline, banded from grass to the
    hills' colour.
  - The haze is thin, so each layer keeps its colour.
- THE PAINTED SKY: heaped cumulus cards stand behind the ranges, pixel-locked to a cloud ramp and lit in crescents.
  The sun sits on the dome where the bake's sun is.
- Other stage kits are byte-identical.

### Stage isekai groves

- Two smaller isekai levels in the same art style. Every isekai level is a style card, and the builder reads it:
  - **`isekai-bamboo`:** clumps of bamboo culms. Each culm is a pole pixel-locked in a striped `culm` tile with pale
    node rings, two-toned by the sun. Cutout leaf sprays fan from the upper culm, and the sun bake reads their alpha,
    so the floor is dappled.
  - **`isekai-sakura`:** sakura trees. Dark leaning trunks fork into limbs under crowns of round masses locked to a
    pink blossom ramp, with petal litter on the ground beneath.
- New pixel-locked tiles: `culm`, `spray` and `petals`. The meadow is unchanged.
- With `wind`:
  - both groves take the live grass;
  - crowns, culms and sprays sway;
  - the sakura's petals fall, carried by the same gust field.

### Stage isekai sakura pass

- The sakura grove's trees are grown, not heaped: a branching skeleton (trunk, limbs, branches, twigs) with blossom
  clumps at its tips.
  - **Hero trees:** two framed sakura at full depth, with a `hero` camera under one crown's edge.
  - **The rest:** the same tree at a lower depth, so the limbs show in the gaps of the crown.
  - New pixel-locked tiles: `bark` (the sakura's horizontal lenticel bands), `bloom` (packed five-petal flowers on
    each clump) and `sprig` (cutout flower clusters that break each clump's silhouette).
- The petal litter is repainted as notched sakura petals in drifts.
- With `wind`:
  - live 3-D petals lie round the walker, pixel-locked like the grass and stirred by gusts. They gather in piles (drifts,
    the path's edges, the feet of the trunks) and stay thin on open grass, so the grass stays the main read;
  - falling petals take the same notched, cupped shape and tumble.
- The meadow and the bamboo grove are unchanged.

### Stage trail blend

- A trail no longer sits on the ground as a separate ribbon. The outdoor trail primitive has a blended rim along both
  edges: a narrow band out from the edge and its mirror in. In the band, the trail's soil and the outer ground meet
  along one ragged boundary that wanders both ways about the edge, so soil bleeds into the grass in some places and
  grass creeps over the trail in others.
- The isekai levels draw the rim in two new pixel-locked cutout tiles, `rim` and `creep`, painted from one shared noise
  field so the two sides meet. The boundary frays in a stipple of palette colours, so the colour lock holds. Each strip
  takes the palette stop nearest the baked colour of the lane it continues, so the blend matches the light on both
  sides. The meadow, bamboo and sakura trails all take it.
- The jungle takes it too, through the same primitive's shared edge (`trailEdgeCover`): one wandering boundary between
  the trail and the floor. The moss now gives out along that line, and the trail's packed-soil wear follows it too,
  so moss and mud meet along one edge instead of fading on two separate noises.
- The nature trail, which has its own grass blend, is unchanged.

### Stage live grass

- `wind` on an isekai recipe turns on a LIVE FIELD of grass on the World page (`lib/graph/scene/channels/stage-grass.js`).
  - Grown stylized blades stand within 30 m of the walker, placed in the page from grids the stage ships: heights, a
    grass mask that keeps them off the trail, rocks, trunks and the cliff, and the sun's shade.
  - They thin with distance and bend in the terrain's gust field.
- The palette lock holds through the motion. Each blade's colour is looked up from a nearest-filtered ramp texture of
  the grass stops by its height and its lit or shade window, so only palette stops reach the screen.
- A gust above the mean steps the upper blade up the ramp: the gust is seen as a bright band rolling across the field.
- Blades near the walker bend away from it.
- The static blade cards stay as the floor and as the band beyond 30 m. Inside the field's reach they dissolve, dithered
  across its edge.
- The tree crowns sway in the same gust field, weighted by height above the ground.
- Absent `wind`, the payload is byte-identical.

### Stage doors

- A stage recipe can name DOOR ENDS (`doors: [{ id, at, to: { map, door } }]`), resolved by
  `lib/graph/era/doors.js` from what the kit already knows (a plaza house door, the nave's great portal, a point
  on a wall). Each end carries a trigger in front of it and a spawn further in, facing into the room. The payload
  carries `doors` only when the recipe names them.
- The World page's doors channel (`lib/graph/scene/channels/doors.js`): walking into a trigger asks the parent
  page to cross (`map-door`); the parent places the walker at an end (`map-enter`). Absent doors, the page is
  byte-identical.
- A wall-point end on a closed wall gets a door: an oak leaf in a stone frame, in the middle of its bay, standing
  proud of the wall's plinth.
- ITEMS (`items: [{ id, at: [x, y] }]`): a thing on a plinth (a gold key, turning) in its own group. Walking up to
  it takes it; the page hides it and reports the taking.
- A LOCKED end (`locked: '<item id>'`) refuses the crossing until the run holds that item; the page says what the
  door needs.
- An ATLAS (`lib/graph/era/atlas.js`) joins maps by their door ends. `validateAtlas` checks that:
  - every end names an end that names it back;
  - every lock's item is held by some map;
  - no item is placed twice.

  `emitAtlasShell` hosts one map at a time, crosses on `map-door`, and carries the run's state across: the
  crossing log, the refusals, visits per map, the items held, and each map's own state. A key taken stays taken
  when you come back.
- Played maps are closed rooms. The plaza dressing no longer assumes the open-sided set:
  - the portico stands clear of a closed side it meets;
  - the obelisks take the way in from the square's first door, and their symmetric spread shrinks until both
    pedestals clear the walls and the portico.

  The open set is byte-identical.

### Stage decay

- `decay` on a stage whose style card carries one (the lab's): a number 0–1 for every event at that strength, or
  `{ collapse, leak, breach, blackout, abandon, seed }`, each 0–1. Every event is a cause, and the mess it leaves has
  a place it came from (era/decay.js picks where, from the rooms and the bays alone):
  - **collapse**: a bay of the roof came down. The deck is open over it, with torn sheets hanging from the edges.
    The duct broke at the bay's trusses (one length down to the floor, a stub drooping), one troffer hangs from a
    single chain and another lies in the debris heaped under the hole.
  - **leak**: a pipe burst at the service band. Streaks and rust run down the wall under it, there's a puddle at its
    foot and, with `water`, a thin stream.
  - **breach**: the tank broke. Its glass is a jagged ring, the liquid is drained to a skim, the glow is out and a
    hoop lies on the dais. The spill spreads toward the side it split, with shards strewn the same way.
  - **blackout**: most troffers are dead, the clerestory is dark and the screens are black but for a few on their
    batteries. Red emergency lamps on the columns are baked red, the ambient is down and the air thicker.
  - **abandon**: chairs tipped and shoved, monitors face down on the floor, the cart rolled and over, the
    extinguisher down and glassware broken. Papers are strewn, more of them against the walls. There's dust on
    everything that faces up, and the walked path has faded.
- The things are records, so abandonment changes them before they are built (`tip` lets a thing down onto the
  floor). The dressing hands the stage its extra lights, its dirt (`leaks`, `dust`) and its water. Spills and
  puddles take the water look with `water`.
- Dying lamps flicker on the page (scene/channels/stage-flicker.js): some troffers that survive the blackout stutter
  (baked on, they go off in bursts, taking their pool and their tube with them), and a troffer hanging by one chain
  sparks (baked off, it flashes now and then). The page scales each lit mesh's baked vertex colour by the lamp's change
  near it, so exports keep the floor (the bake). Absent `flicker` ⇒ the channel isn't emitted.
- The tank now has a frame of four struts, so its cap stands on something.
- The style card's decay principles are machine checks (lab-decay.test.js). The derelict lab is in the page budget.
  No decay (absent, 0, or every event at 0) is the clean lab, byte for byte. Other stages are byte-identical.

### Stage lab

- A fourth stage kit and the first modern one: `research-lab`, after a new reference card `doom3` (Doom 3's UAC
  labs). It's a tall closed lab whose structure shows (era/lab.js):
  - a vinyl tile floor with a darker band and a rubber skirting;
  - walls of steel I-columns at the bays, a kick band, painted panels, a service shelf and a clerestory of
    observation windows glowing cool;
  - a corrugated deck high up with trusses across the short span, two ducts and a cable tray down the long one, and
    troffers hung on chains between the trusses (the light);
  - a blast door with chamfered top corners, a hazard-striped surround and a red status lamp.
- Its painted surfaces are the stage's own `lab:` tiles (era/lab-tiles.js): vinyl tile, steel panel, corrugated deck,
  grating, hazard stripes, a screen, a server rack's face, a whiteboard.
- The dressing (era/lab-dress.js, style/research-lab.js):
  - a containment tank at the centre on a hazard-ringed dais, glowing, with cables down its steps into grated
    trenches that run to three walls (never across the way in);
  - benches in two rows, each carrying different things from its neighbours (monitors with lit screens, a
    microscope, glassware, papers, a toolbox), with chairs pulled out;
  - server racks, lockers, a whiteboard, an extinguisher and a cart.
  - Every thing is placed as a record first and built in its own frame after, so a later pass can move, tip or
    break it.
- The style card's principles are machine checks (era/lab.test.js), and the lab is in the page budget. Other stages
  are byte-identical.

### Stage night

- `time: 'night'` on a stage whose style card carries a night (the plaza's does): the card's moon becomes the bake's
  key (cool and low, casting the obelisks' long shadows) under a deep blue ambient, and the reference's air and dome
  give way to the night's. The sky shows stars and a phase-carved moon placed on the dome where the moonlight comes
  from, and the cloud deck is lit by the moon. The town beyond is dimmed.
- The placed light makes the picture (era/plaza-night.js): lanterns on iron brackets by most doors, lanterns hung in
  the portico's bays, a glow under the fountain's water, and some windows lit warm with their light spilled on the
  sill. All of it is baked like the nave's torches; the lanterns' panes glow and carry a halo.
- The style card's night has its own principles, each a machine check (plaza-night.test.js). `time: 'day'`, or no
  `time`, is the plaza as before, byte for byte; a kit without a night refuses one.
- Jets take an opt-in `lit` colour for the light their white water is seen in (`jetLight` on the page). The night
  fountain uses it so its falling sheets aren't daylight-white. Jets without it emit as before.

### Stage page budget

- A stage's World page now costs about 5 MB to open with every element on (the plaza was 8.7 MB), under a budget
  (`STAGE_PAGE_BUDGET`, 7 MB) a test holds each stage to.
- `pack` on `emitThreeWorld` (opt-in; a stage's payload sets it): each textured sub-mesh is welded, so corners equal
  in position, uv and colour are shared through an index, and its baked colour goes as 8-bit sRGB decoded back to
  linear in the page. Renders differ by at most 2 levels in 255. Without `pack` every page is byte-identical.

### Stage elements

- Sixth-gen is a floor, not a ceiling: a stage takes the merged fire and water elements as opt-ins, and without them
  it is byte-identical (the baked torches, the painted spill).
- `fire` on a stage (`true` or the fire object): its torches go to the fire channel as fires its bake already holds,
  so the page only flickers their light. The stage keeps an iron arm and a collar on the wall and leaves the staff
  and the flame to the channel. The nave's style card sizes its torches up (`fire.torch`) and stands two braziers by
  the great portal, their light baked into the room like the torches'.
- `water` on a stage: the plaza fountain's basin and bowl take the water look (a tinted `lagoon`, its shore foam
  turned down for a basin a hand deep). The bowl brims over its lip in falling sheets (`jets`) in place of the
  painted strips.
- Jets whose `controls` are all false carry no flow panel; pages with any other jets are byte-identical.
- `wind` on a stage (`true` or the terrain's wind object): the dressing's hung cloth swings in the terrain's gust
  field (the same GLSL, now shared as `WIND_AT_GLSL`; the terrain page is byte-identical). Each style card names the
  groups that take the wind (`sway`): the plaza's washing billows on its lines, an awning's valance flaps and the
  flowers nod; in the nave the wind is the draught through the doors (`draught`), and the banners and ivy stir. Those
  cards are cut into a small grid so they bend down their length; the bake and the sun's shadow stay at rest.

### Flame depiction

- Fire in worlds (`fire`, opt-in on any world): campfires, braziers, torches and candles drawn as live flames that puff at their own rate, lean in the wind and throw embers and smoke, and whose flicker lights the world around them. `fire: true` on a dungeon lights its chambers with braziers and its tunnels with torches; `fire: { sources }` places fires anywhere, on the ground in terrain worlds. Absent ⇒ byte-identical.
- Coloured fire (`fire.color`, or per source): as fireworks are coloured, by a metal salt in the flame (sodium, calcium, strontium, lithium, barium, boron, copper, potassium, or a mix), or any `'#rrggbb'` for a fire no salt gives. A coloured flame burns clean and lights the world in its hue; a dungeon bakes the hue into its walls. `smokeColor` gives a source a signal smoke.
- Fire that burns up and down (`life`: kindling, dying back; `flares`: a whoosh now and then; the wind feeding a fire it does not blow out), fireballs (`kind: 'fireball'` on a `path`: the tail is where the ball was a moment ago, and it bursts where it lands, swelling and throwing a shell of sparks), and grass fires on terrain (`fire.spread`: the front runs downwind as an ellipse after Rothermel and Anderson, with flames sized by Byram's law, black ground and a band of embers behind it, stopping at water and burning out at `extent`).
- Fire in a Blender Cycles still: a world with `fire` exported through the Blender pack (`export_model({ format: 'blender', fire_t })`, which writes the same pack as `scripts/export-blender.mjs --fire-t <seconds>` and hands back the render command) carries its fire at that instant as the World page draws it. Each flame becomes a volume of light (the page's flame shader evaluated per voxel, written to OpenVDB inside Blender), each fire's smoke a density volume, and the embers, coals and props come as mojulo geometry; each fire gets a light, and a `Fire` camera frames the brightest. `import_mojulo.py --mode render` renders a still at any resolution. All of it stays in a `mojulo-fire` collection that the machine gate and the return leave out. The props are now one description (`firePropParts`) shared by the page and the pack.
- A lit match (spike, `scripts/spikes/flame/`): fire drawn as a consumer of the wind's air field. The flame is a streakline, the burning gas rising on its own buoyancy while the room's air (`windField`, plus a breath) carries it sideways, so it leans downwind, flickers when a draught passes and blows out past a speed that grows with its size. φ = 0 stands it straight up in any wind. The match strikes (a flare and sparks), burns its head, then creeps along the stick at a rate set by its angle (head down races, head up starves); the stick chars, curls and glows at the front; blown out, the ember lets go a wisp that rises as a thread and snakes as it goes unstable. The page marches the flame as emission against the scene's depth, lights the scene from it in a match's balance of brightness, and shimmers the air above it.

### Wind element

- Terrain `wind` (opt-in, flat worlds with `grass` or `plants`): one seeded gust field that the live World page's grass and trees bend in. Gusts travel downwind and reshape as they go; a tuft or a tree sways as one stem of its height, lagging the gusts and ringing at its own frequency, its shape the production elastica under the wind's load (baked once, read as a 3D texture by a vertex shader). New principle, **flaccidity**: the share of the wind's push a thing takes, 0 for everything that existed before (unchanged, byte-identical pages without `wind`), 1 for grass and plants unless `flaccidity: { grass, plants }` says less. `compose_world` carries `wind` to the stored recipe. Exports carry none.
- Wind debris: fallen leaves and dust around the camera ride the same gust field (one self-contained field function shared by the shader's texture and the particles), lying still until a gust passes their lift, then tumbling downwind and settling. On by default with `wind`; `debris: false` for none, `flaccidity.debris` to dial it.
- Cherry grove (spike, `scripts/spikes/sakura/`): a `cherry` species in full bloom (Rauh made decurrent through a new species `over`; `bloom` recolours its leaves as blossom and `bloom.fill` fills its clusters), `plants.kinds` to grow named trees in place of the climate's, and petals as a new kind of wind debris, given off by crowns in bloom in gusts, fluttering down, carpeting the ground and lifting again. Other species and worlds without a cherry are byte-identical.
- Hero cherry grove (spike, `scripts/spikes/sakura/hero-grove.mjs`): a standalone close-up scene built from the ground up. The cherries are grown with the species' hand and smooth axes (below). Blossom sits in umbels at the ends of the shoots, and each flower is built from its parts with fractal-edged petals. Levels go by distance: whole flowers near the eye, one lit disc per flower beyond, then the pool's levels. One wind drives tree sway, flower flutter, the lawn and the petals, and the frame goes through an HDR lighting pass. The page has a season dial (bud, bloom, petal fall, leaf-out), a petal carpet that builds where petals land, three lighting moods, and compact encodings (8.5 MB).
- Trees with a hand (`arch.hand`, opt-in): new internodes are turned as they grow (a consistent twist, a winding lean, zig-zag laterals). Smooth axes (`arch.smooth`, opt-in) bend between nodes instead of kinking. The cherry has both; other species grow and mesh byte-identically.
- `vegetation/blossom.js`: where a grown tree carries its flowers (umbels at the shoot tips) and one flower built from its parts at its levels of detail.
- Terrain worlds draw a tree in bloom flower by flower: at L1 and L2, its bare wood plus one disc per flower (lit in the world's light, bent by the wind, at most about ten pixels), up to 1.2M flowers, largest trees on screen first; past that a tree keeps its clusters. Worlds without a species in bloom are byte-identical.
- Trees of many ages (`growth` on a species): one variant is grown at each age, some in a stand, so height, girth and clear trunk come from growth rather than scale. Each plant picks its age by its height in the species' range. The cherry has five ages, from 8 to 21 years. Other species are unchanged.
- Research spike behind it (`scripts/spikes/wind/`): one seeded wind field (gusts carried downwind, log profile, veer) that bends plants and carries debris. Introduces flaccidity φ ∈ [0, 1], the share of the air's push an element takes; everything before is φ = 0 and stays byte-identical. Plant poses reuse the production elastica through a baked table; debris (dust, leaves, twigs) lifts and settles by kind. Standalone interactive preview, no schema, exporter or runtime integration.

### Aqua rendering

- **Water has a look of its own.** A water preset (`ocean`, `lagoon`, `lake`, `river`, `canal`, `pool`,
  `falls`) shades it on the World page with light-weight maths instead of a flat tint: fine ripples
  layered over the waves, the sky reflected more strongly the lower you look (water is a mirror at a
  grazing angle and nearly clear head-on), and a sharp sun glint that softens with distance so far
  water does not shimmer.
- **Foam forms where waves fold.** The animated oceans, beaches, rivers and spillways now place
  whitecaps where the wave surface folds over itself, and draw foam as a lacy pattern of bubbles
  rather than a white tint. Shore breakers, river banks and the foot of a falling sheet froth the same
  way.
- **Rivers flow along their banks.** A river's surface runs in lanes parallel to its banks that turn
  with every bend; ripples stream downstream along them and foam gathers in lines that drift with the
  current.
- **You can see into the water.** Water now fades with depth the way real water does: sand and riverbeds
  show through the shallows in the water's own clear tint (turquoise for a lagoon, olive for a river), and
  deep water turns opaque. Where water is thin, against a beach, a bank or a floating buoy, it froths
  in bands that lap toward the edge. The beach view gains a seabed that falls away offshore so its water
  shades from shallows to deeps. Open sea with nothing beneath it looks as before.
- **Water leaves with the scene.** Exported GLBs carry each body of water as its own `water:<kind>` node
  with a clear-water material (transmission, index of refraction 1.333, and absorption that keeps
  blue and loses red), which Blender reads. Animated seas, beaches and rivers, which no export carried
  before, leave as one frozen frame with their foam baked in; the ocean view now exports at all. Godot
  packs (kernel 0.4.0) shade that water live with a water shader: the seabed seen through the water,
  bent by the ripples and fading red-first with depth, foam where the water thins, sky reflection and
  sun glint, and drifting ripples. The waves themselves stand still in an export.
- **Pools and ponds you can touch (groundwork).** A page can now carry shallow bodies of water whose
  surface is simulated rather than drawn: still until something disturbs it, with waves that slow in
  the shallows, bounce off a pool's walls and die out on a pond's bank. Walking in slows you with depth,
  splashes on entry and leaves a frothing wake; floating toys and leaves bob on the live surface and get
  pushed aside; rain rings it; a click splashes it. Everything that touches the water goes through one
  interface, `window.__aqWater` (`query`, `disturb`). The floor is seen through the water, bent by the
  ripples, with caustics where crests focus the sun. No world kind emits them yet.
- **Wet sand follows the swash.** On an aqua beach the swash now runs a thin sheet of water up the
  sand, with a lace of foam on its leading edge, then drains: the sheet shines with the sky and the
  sun for a second or two, and the sand it leaves stays dark while it dries, with a damp band above
  the highest reach. It is worked out from the swash's own timing, so it costs only a shader and an
  export carries the band as it stands at the first frame. Beaches take `detail`
  (`'still' | 'animated' | 'touch' | 'showpiece'`, default `'animated'`); `'still'` keeps the baked band.
- **Footprints in the sand (`detail: 'touch'`).** A beach at the touch tier opens in walk mode facing
  the sea, and the sand around you takes footprints: a bed of loose sand (3 cm cells) follows you as
  you walk and blends into the beach with no visible edge. Damp sand holds a print's walls, dry sand
  up the beach slumps them into soft dimples, and the backwash levels any print it runs over. The
  ground kernel graduated from the soft-ground spike with per-cell moisture, a window that slides
  with the walker, and slopes measured on the sand alone so loose sand never slides off the beach
  face; with neither in use it replays the spike byte for byte. The beach declares its unit
  (1 unit = 1 m at scale 1).
- **Wading into the surf.** At the touch tier the sea around you answers too: walking in slows you
  with depth, splashes on entry, and leaves a wake and a cloud of stirred-up sand in the water. The
  disturbance is simulated in a small window that follows you and rides on top of the existing
  waves (it reaches the water shader as a texture, so it adds no geometry and no seams). One step
  routes by depth: on dry or shallow ground it prints the sand, in the surf it prints the sand and
  stirs the water, and past waist depth only the water answers.
- **The swash strands its foam.** On every animated beach the foam the uprush carries is left on the
  sand where the sheet stops: it slides back with the backwash while the water still covers it, stays
  put once the water leaves, and opens into holes and pops over a few seconds. The backwash's edge
  carries no foam line of its own.
- **A faucet and the basin it fills (study).** A falling stream (`jets` on the World page) is drawn on
  the GPU along its fall: it thins as it speeds up, carries a ripple from the spout that grows until a
  thin stream breaks into a string of beads, and below a threshold set by the spout's width it drips
  instead. An aerator turns it white. Where it lands on a dry or barely wet floor it spreads into a
  hydraulic jump; in standing water it plunges, with a crater, rings and foam that push floating
  things away. Its basin is a new `basin` kind of shallow water whose level moves: it fills with the
  plug in, drains through the plug hole with it out, and stops at the overflow, and a duck in it rides
  up and settles on the floor when it empties. The page has a panel for flow, plug and aerator.
- **Waterfalls (`create_view` kind `waterfall`).** The same falling water, at landscape scale: a river
  runs along a plateau, pours off the cliff, falls, and plunges into a pool that drains away as a
  second river. Three kinds: `veil` (a tall thin ribbon that frays to streaks), `curtain` (a broad,
  heavy block of water) and `horsetail` (a round spout shot through a slot in the rock). Over the lip
  the water is glassy and pours at the depth a river takes going over an edge; it whitens as it falls
  and, past a break-up length set by how much water there is, frays into streaks and fingers and
  spreads, with mist at its foot. The pool's surface is simulated, so the fall churns it into foam and
  rings and pushes floating leaves away. A flow slider on the page turns the fall down to a trickle or
  up to five times its size. Falling water can now be a sheet over a lip as well as a round stream,
  so any world can place one.
- **Recipes choose the water.** The ocean, beach and river views and painted-landscape lakes take
  `aqua: '<kind>'` to pick another preset, or `aqua: false` to keep the previous look; canal cities
  use `canal`.
- **Glass is untouched.** Windows share the old translucent-water pass; only faces tagged `liquid`
  take the new look, and pages without water emit the same bytes as before.

### Particle vacuum spike

- Isolated development experiment: frozen wave-manji carriers activated by spatial contact events, with deterministic replay and a standalone interactive preview. No level schema or runtime integration.
- Wave-ground follow-up: conservative sand depth over sampled wave-field terrain, with 3D surface preview and slope-driven redistribution.
- Lightweight sand follow-up: bounded occupancy grid, sleeping grains, local support-change wakeups, hopper gate and editable terrain preview.
- Grain physics follow-up: integer gravity with terminal speed, work–energy Coulomb friction (dynamic μ sets the heap angle instead of the grid's 45°), static friction with avalanche hysteresis, and inelastic impact in the sand kernel; still no library.
- Sand-bed follow-up: integer depth layer where walking leaves persistent footprints (displaced sand forms a rim biased toward the push) and a pushed crate plows a berm, relaxed by the same static/sliding friction pair; walkable standalone preview, no production channel yet.
- Soft-ground materials: the same bed with a compaction ratio (snow packs under the boot and bears load, little rim) and viscosity (mud oozes back over seconds); dry sand, damp sand, fresh snow and mud presets in the walkable preview.

### Emote bridge

Steps toward playing common-parlance emotes and humanoid clip libraries on mojulo's figures
([docs/emote-bridge.md](../docs/emote-bridge.md)): the head turn the figure never had, a T-pose rest and an engine skeleton
for the engines, and Godot's retargeter set up on import.
Both are opt-in: without them every figure, hero and export is byte-identical. Being built on this branch; each bullet is
rewritten as its phase lands.

- **`turn` on the neck and head.** `neck: { turn }` and `head: { turn }` (degrees, + the face to the figure's left;
  35° and 45° caps) turn the skull about the neck line, so a nodded head's nod turns with the face. `glance: 'left' |
  'right' | 'ahead' | degrees` splits a glance across the two, and the hero's gestures and clips take it too.
- **Turned bones.** A turn reaches the frames that have an orientation: rigid armor heads, the hero's neck and head
  bones (and the jaw, face and hair that ride them), and the packed rig's head, so it bakes into the GLB and Godot
  clips. The joint graph does not move.
- **`headshake` turns the head.** The emote is a real "no" now, instead of a torso twist under a head tilt.
- **The T-pose mold.** `export_model { skinned: true, humanoid: true, rest: 'tpose' }` re-rests a humanoid figure or
  hero in the VRM T-pose the engines retarget from (arms straight out, palms down, legs straight, feet and head as
  they were), with every clip re-expressed on it so it plays the same motion. No recipe changes; without `rest` the
  export is byte-identical.
- **An engine skeleton, and Godot.** With `rest: 'tpose'` the skinned humanoid is written the way the engines read one:
  joints nested on the VRM humanoid tree (the biped's hand and foot leaves, and a clavicle each side, as weightless bones:
  an engine's humanoid profile hangs the arm off a shoulder with a large rest turn; and the chest and upper chest a rig
  lacks, split out of its torso bone with the torso's skin spread along them, so a retargeted chest turn bends the
  flesh), each parent-local, in
  the VRM space (y up, facing +z, the figure's left on +x), every rest rotation the identity. Beside the GLB come a
  Godot `BoneMap` per figure, a post-import script giving its surfaces their vertex colour (Godot imports a
  vertex-coloured GLB white), and the `.import` naming both (place the folder at `res://mojulo/<ref>/`); the engine
  figure is a scene-level node beside the z-up root, since Godot's rest fixer resets a skeleton's ancestors. On import Godot
  renames the bones to its humanoid profile and the skeleton becomes `%GeneralSkeleton`, so the project's humanoid
  animations play on the figure and its clips on any humanoid. `docs/examples/humanoid/godot-retarget.mjs` is the gate:
  a real Godot plays the flat figure's bow on a hero's skeleton.

### Figure adornment: clothes that fit

Clothes for the hero that fit the body they are worn on, in two tiers: second-skin garments painted on the body's own
faces, and garments with volume built on the adornment loop. Opt-in; no stored hero changes. Being built on this branch.

- **Second skin.** The hero door's `paint`: a word (`tank`, `crop`, `sportsBra`, `tee`, `longSleeve`, `leotard`,
  `leggings`, `bikeShorts`, `tights`, `catsuit`, `socks`, `gloves`), an entry `{ part, u?, run?, t?, only?, group }` or a
  list, worn in order over the detail. The swimsuit's band rule as declared data on the expanded rings (the plan
  grammar's `paint` block), so a segment's generated rings take it like a loft's; colour only, every ring point the
  bare body's, so it fits every cast, tune, core and pose. Words name only the parts the body has (the structured
  core's pelvis and toes, a breast), and one over the hips clears the swimwear beneath. Absent, zero bytes.
- **Outfits that follow the body.** The hero door's `outfit`: garments with volume (`tee`, `shirt`, `trousers`, `shorts`,
  `boots`, or a piece `{ id, part, u?, run?, ease, flare?, over?, group }`), built as new L1 parts copied from the body
  part's rings over a window, carried out by an ease that scales with the cast and lifted over the layers beneath (the
  chest's, earlier garments: worn in order, so a shirt can be worn out or tucked in). Each copies its body part's bind
  station by station, so every garment vertex skins exactly as the skin under it and bends at the elbow and knee; every
  dial naming the body part names its garment. The plan grammar's `garments` block. Absent, zero bytes.
- **Flat footwear.** A piece's `fit: 'shoe'` (the boots' foot) is built, not copied: a round ellipsoid over the heel and
  a flat half-ellipsoid over the forefoot, each fitted to hold the foot's and toes' points with the ease, their sections
  superposed ring by ring and cut on one flat sole, so a boot stands flat with a round heel cup and a low toe box over
  any foot; each ring binds as the foot's nearest station.
- **Cloth shades smoothly.** Under the studio light, cloth welds its corner normals at 70°, as the skin does
  (`STUDIO_SMOOTH_CREASE.$cloth`). Cloth is every face of a garment part (marked `garment`) and the faces a second skin
  painted (a part's `painted` groups). So a shirt reads as one draped form, while a right angle such as a boot's sole
  edge stays sharp. Other groups keep 35°, and a hero without cloth welds exactly as before.
- **Outfit builds.** `outfit: { type: 'outfit', style, dials?, language? }`: a styled look built the way an armour build
  is (`lib/graph/outfit/`), from laws, dials (`stylize`, `fit`, `coverage`, `ornament`), seeded JSON cards (`casual`,
  `office`, `athlete`, `adventurer`) and language words for lengths on landmarks, family (knit or woven), tuck and focal.
  It is expanded on every read in fixed passes:
  - **CUT:** the pieces.
  - **FIT:** ease and hang toward the free hems.
  - **LAYER:** tucked or worn out.
  - **CONSTRUCTION:** a woven placket.
  - **ORNAMENT:** from the focal out — a collar or a knit rib band, buttons as body-detail rows on the shirt, a belt as an
    adornment on the trousers; then cuffs, hems and the waistband painted on the garment parts; then the seams.
  - **TONE.**
  - **LEDGER:** the dress readout, with warnings, never refusals.

  The laws version is stamped on the hero record. Supporting changes:
  - A garment piece may add `rings` where its edges are finished, so a trim is as narrow as it is drawn.
  - Paint runs after the garments, so it reaches them.
  - A paint window too narrow for a coarse ring paints the band holding its middle.
  - A cap takes paint only from an entry that covers its part end to end.
  - The card's tones reach the head's include, as an armour kit's do.
- **Skirts and dresses.** A garment `fit: 'skirt'` is one hull round the hips and both legs, from the waist to a hem on a
  landmark:
  - each of its rings is the support of everything at that height, made symmetric;
  - it never narrows below the hips and widens by its cut (pencil, A-line, full);
  - it is two-faced, folded at the hem, so it is open beneath and its hem is an edge;
  - each point is skinned by nearness: the cloth over a leg follows that leg, and the cloth between and behind the legs
    stays with the pelvis, so a stride swings the skirt and the knees stay inside it.

  Outfit builds take `bottom { kind: 'skirt', leg, cut }` and `dress: true`. Tops drape from the bust and shoulder blades
  rather than hugging back in under them. New female cards: `sundress`, `blouse` and `athleisure`.

### Figure articulation: herobot

The hero robot on the hero door: the toy-hero read of the late platformer renders, an original robot on the anime head,
built from words the door already reads plus a few new ones. Every addition is opt-in, so no stored hero changes. Being
built on this branch; each bullet is rewritten as its phase lands.

- **`proportions: 'herobot'`.** A third proportion word beside `hero` and `anime`, at about 4.4 heads tall: a big head,
  a short torso, short arms (a cast may now scale both arm segments' lengths) and a short neck, with big hands and feet
  for the gauntlets and boots to sit on. Its hands are bigger still, puffed into a cartoon glove's fat, rounded digits and gloved in
  the palette's `Glove` (white unless named), its neck in the body stocking (`Top`), and its shins a little longer for an
  action hero's stride (a cast may carry `hands`, `puff`, `glove`, `suitNeck` and `shank`). The body keeps adult limbs and is not child-coded, unlike `chibi`.

- **The `volume` signature.** Figure-fluff's girth contrast on the rig: a free solid round its carrier, sized from the
  carrier's own measured axis and radius, riding that bone. It takes the fluff shapes (`football`, `cone`, `bell`,
  `slab`, `bead`), a superellipse section, a `bore` (a muzzle disc), a `lip` (a cuff) and a `half` cut (a flat sole, for a half-egg foot). The robot's ball pauldrons,
  barrel chest plate, collar, briefs, wide forearms, thigh rims, flared boots, pointed half-egg feet and knee pads are adornment data.
  A `bead` can point its crest back toward the window's start (`point: 'start'`), so a knee pad on the shank points up. The carrying shell
  of a volume is a slender core buried on the carrier's axis, so only the volume shows.

- **The `plaque` signature.** A thick trapezoid plate lying on its carrier between two stations, wider at one end,
  lifted forward off whatever lies beneath, with a bevelled face: an embossed ab plate jutting down under a chest plate. Set off the front by `c`, a pair
  makes pec plates.
  Every signature now also reads its adornment's `carrier`.

- **The helm's face window.** The `helm` signature takes a `window` (the face open, the helm wrapping the crown, temples
  and cheeks) with `brow`, `w`, `bottom`, `nape`, `rim`, cheek guards curled under the jaw (`jaw`: `drop`, `curl`,
  `wrap`), a back tucked round to the nape (`back`), the lower sides and back rounded in like an egg to hug the face (`hug`), and the window's top edge brought down as a raised V to the bridge of the nose
  (`v`), whose two lines can carry on as embossed `stripes` over the crown to the nape. A V `frame` grows the V into the visor's whole frame: wide
  cheek bands tapering to the jaw, a brow band, and two horns rising to points either side of a diamond gem set in its notch. It also takes ear domes
  (`ears`) and a brow gem (`gem`), round or a faceted `diamond` on a border plate (`fit: 'v'` sets its lower edges parallel to the V). Sized from `parts`, so `['face', 'earR', 'earL']` fits it to the anime head as raw
  kit data, and `scale` grows the whole helm about its centre. The armour builds' helms still refuse on the anime head.

- **The `gloss` highlight.** A third highlight kind on the character light: N·L above a high threshold anywhere on a
  group, with no band. This is the moulded-plastic hot spot on each rounded armour form. Like `ring` and `streak`, it
  is baked and conforming.

- **Horns, a ponytail and plate pauldrons.** The helm takes `horns` (a pair of tapering blades off the temples) and a
  `ponytail` (wild flattened clumps out of its back, scattered by a fixed pattern, so it stays deterministic). A `volume`
  takes the `plate` shape: an angular plate arched over the carrier's outer side in flat facets, a pauldron over a ball.

- **Worked casts.** `docs/examples/humanoid/cast/herobot-classic.json` and its rival, `herobot-rival.json`: red and white,
  horns and a ponytail, and a more angular silhouette from the same adornment kit.

### Figure hair

Four anime cuts from the operator's sketches, as hair words anywhere a hair word goes, and the construction words they
needed on the anime head. Being built on this branch.

- **The cuts.** `flipped-long` (long, curtain bangs framing the face, the ends kicked out), `blunt-bob` (a level fringe
  split off centre, the left side falling long), `side-tail` (the side-parted sheet gathered into a low tail over the
  left shoulder).
- **The words.** `flip`, `spikes`, `sideTail` (its clump `tail`, part `hairTail`) and `fringeNotch` join the hair form
  words; each is absent unless given, so every stored hero builds as before.
- **Hair as shapes.** `shapes` composes a hairstyle from one family of primitives placed on the cap or laid in rows
  that flow from the whorl — carrots (cut conical carrots), bananas (flat crescents) or peppers (chilis, thin strands)
  — scaled against the head, and may take over the studio's clump groups. Three male characters wear it: `broku`
  (carrots, classic shonen spikes), `jinto` (bananas, comma hair), his cousin `jingo` (bananas, few, grown from the dome like a cap, for a long face) and `kairo` (chili
  peppers, a wolf cut), the last three after a hairstylist's pass; the first heroine, `bidel`, wears bananas in a short tomboy cut. Shaped hair never cuts through the body: the hero's
  neck and torso are handed to the head and a lock that meets them drapes over them. A layer's `cap` grows each lock
  along the dome and lets it fall only past the hairline, so the crown's locks come out longest. A fourth family,
  PEELS (layered banana peels: thin leaf-shaped sheets cupped to the scalp), dresses `jona`, a side-swept swoop, `selene`, long hair heavy on her right, and `sintia`, flower petals to the shoulder blades. A layer's `flick` hooks
  a lock's end out from the head (or under it), and a layer's `length` now reaches 6. A layer's `gather: [az°, el°]` walks each lock
  into a TIE and ends it there, so `frieda` wears twin tails and `frieda-pony` one ponytail.
- **Blunt cuts and strands.** A layer's `hem` cuts its locks on a LEVEL line (`fringeHem` for the ones leaving over the
  face) and `blunt` keeps a lock's full width to the cut: `hiraku` is a bowl bob, `miwako` a
  neck-length one. The character light's `strands` draws lines inside the hair in its own tone darkened
  (the hue kept), never the ink's black; absent, every light's pieces are as before. The cast gains both as card specs.
- **Face zones and the veil.** `hairCoverage.face` reads the share of the face the hair hides from the front and both
  ¾: RED (each eye, the nose and mouth) and YELLOW (brows, lids, cheeks, jaw). Hair over red past 15 %, or curtaining
  yellow past 75 %, advises. The hair word `veil` (0 … 1) is the mystery and allure lever: one eye may go under the
  hair (to 75 %) and the yellow to 95 %; the other eye and the mouth stay restricted. Advice only; nothing it builds.
- **Sideburn patches.** Every anime head with hair now wears a thin patch in the hair's colour on the skin before each
  ear, from under the scalp's bottom edge (it follows the hairline, so no skin shows between) to the ear's bottom, so no bare gap shows between the hair and the ear
  (`hairSideburnL`, `hairSideburnR`), and the graphic face's ears sit a little closer in to the head. A bald head shows
  its own skin there. The anime heroes' pinned payloads moved
  with it.
  A layer's `swirl` turns its flow one way (a fringe swept off its part), and a style takes up to 12 layers.
  `sideburns` works on any style. The
  principles and recipes cross-referenced to shonen and JRPG heroes are in `docs/examples/humanoid/DESIGNING.md`.
- **Fixed.** An anime hero whose hair is a list (`['long', { locks }]`) now wears that family: before, the list was not
  read as naming one, the base's cut was worn under it and its clump edits were lost.

### Figure articulation: pelvic

The hero's midsection structured from the vajra core it already carries, on the regular and the anime hero alike, and
the default for every hero (`core: 'structured'`). Every hero changes: a stored hero regenerates with it. `core:
'streamlined'` is the hero before it, byte for byte. Being built on this branch; each bullet is rewritten as its phase
lands.

- **The default.** Every hero is built on the structured core unless it says `core: 'streamlined'`. The tune keeps its
  contract on it: `thigh` thickens the thigh about its own rings, `calf` the knee and the shin, `legs` moves the joints
  and no radius; and the outline is one curve in every register (each ring's radius solved from the width it draws).
  A swing word's keys stand on a base of their own, reachable on every verb.

- **The pelvis bone.** On the structured core the `pelvis` bone is the basin: it turns with the hip girdle alone, as
  the vajra's own pelvis does, so a spine curl or arch bends the lower back over a still pelvis instead of tipping it. A
  new `lumbar` bone carries what `pelvis` used to (the pelvis hub to the navel); the hem and the top of the thighs blend
  the two, and a hip-slung blade rides the basin. A rig bone may now take `align`, two joints whose line orients it.
- **The legs converge.** On the structured core the thigh slants in from the hip to the knee, more on the female, so
  the knees sit inside the hips and the feet under the knees. The female casts no longer stand with their knees wider
  than their hips and a deep V between the thighs: their narrowed hips had left the knees behind.
- **The stand owns its base.** New pose words `stance` (how far apart the planted feet stand, as a multiple of the hip
  spread) and `stagger` (one foot forward, one back), and `heelL` / `heelR` in a stand. With converged legs the
  presets plant both feet on a base of their own: the guard wide and bladed with the rear heel up, the relaxed and
  hand-on-hip stands close-set with a soft free knee, a swing on the guard's base. Without these words a planted foot
  stands where it always did.
- **The pelvis mesh.** On the structured core a `pelvis` part on the vajra basket runs from the crotch up into the
  hem, its back the seat, and the thigh is rooted at the hip socket inside it. The hip is one curve out from the waist:
  the female's widest at the trochanter and narrowing steadily to the knee, the male's straight. The front recedes to the
  crotch, the thighs meet under it, and the thigh comes out of the pelvis along the groin's diagonal. Gone: the corner
  and pinch at the side of the female hip, the front standing proud of the belly, the shelf at the hem, the step at the
  knee, and the flat seat.
- **The dress follows the pelvis.** On the structured core the hip pieces hang from the pelvis and ride it: a knight's
  faulds carry on down over the hips under the breastplate and the tassets hang from the crest over the hip, fitted close
  and clear of the thighs at every dial. Every piece that stands off the thighs (a fauld, a belt, a kit of the
  operator's) stands off the pelvis too, and thigh plates wrap the share of the thigh they were drawn for. On converged
  legs a hardsuit's inner knee plate turns less far in, clear of the other knee.
- **The torso.** On the structured core the torso is built on the vajra rib cage: a waist above the hem, the ribs
  widening to a lifted chest, the male's back widest under the arms and the female's narrower, and the shoulders sloping
  from the neck under the arm's own cap instead of a box with square corners. The new rings sit between the five the
  dress addresses, so every torso address (`s` 0 … 4, a collar's station) lands where it did.
- **The chest layers.** On the structured core a pectoral lies over each side of the rib cage, its own part hugging
  the chest: the pair meets at the sternum as one domed chest, its lower border standing proud as the shelf and its
  armpit end moving a little with the arm. The adult female hero carries a bust by default (a child or chibi cast, or
  the kid look, never does): a breast per side over the pectoral, each its own part and a bone each (`bustR`, `bustL`)
  an engine's spring can drive. The breast is a studied field over the chest (`breast-field.js`): its footprint and its
  poles' profiles are a handful of anatomy words, and gates measured on the field hold it to what an artist checks (the
  upper and lower poles 45 : 55, the fold a wall, the upper pole straight or concave, the lower pole full, the margins
  melting into the chest, one clean peak). The pair meets at the midline in a cleavage valley (the field's `cleft`, a
  share of the projection there), not two mounds with flat chest between them, and the triangle between the clavicles
  and the upper poles stays shallow. A bare belly carries a navel, set where the canon puts it: about level with the elbow, a little under the
  narrowest waist. A clothed jerkin covers the pectorals, and every piece worn on the torso stands off the layers. A trunk ring
  may now name its own `u` (the address parameter) and `push` named slots off the ring, a skin blend may weigh one point
  (`station.slot`) over its ring, a new plan kind `rings` gives a part's rings point by point, and a `ring20` slot
  family is there for a finely sampled form. The knight's and
  the ranger's pauldrons and the jerkin's quilt sit on the new shoulder.
- **The swimsuit view.** New `detail: 'swimsuit'` shows the body bare: every shirt, trouser and shoe colour is skin, and
  swimwear is painted on the body's own surface (the adult male's trunks, the adult female's two-piece — on the structured core a speedo and a thong — a child-coded
  figure's rash vest and trunks; the female's cups follow her breasts with a sweetheart top edge that dips into the
  cleft), in a `Swim` tone you can name (by default dark, so the swimwear sorts into the dark
  value band apart from the skin and the hair). A plan segment may now carry `bandGroups` (a group
  per band and slot) and `slotT` (each slot's address parameter).
- **The shoulders and the neck.** On the structured core the neck rises out of the chest: the sternal notch sits under
  the base of the neck at the back, so the neck shows from the front instead of the chin resting on the shoulders. The
  male's trapezius slopes from the neck to the shoulder instead of standing as a plateau, and the shoulder rounds over the arm as a deltoid instead of ending in a square corner. Under the
  anime head the neck's shade is the jaw's shadow, its lower edge a V toward the notch, no longer the whole neck down
  to its seam on the chest. The upper arm's widest point sits a quarter down it, as the deltoid's does, its top a
  dome over the joint; the western figure's neck is a round column whose back rises into the head, and the pectoral's
  top edge rises from the breastbone toward the shoulder as the clavicle does. A segment may name its caps' height (`cap`).
- **The seat.** On the structured core the female's seat is her own shape, not the male's a size up: fuller and
  set further back, fullest halfway down it, its two halves parted by a deep cleft (drawn on bare skin in a darker
  second shade), under a lower back that curves in over it; the male's is square and high, his back running
  straight down into it, two masses with a cleft between them. On the structured core the swimsuit is a speedo for
  the male (low and level, no leg, a clean leg line, the cleft a crease in it) and a thong for the female (a front
  triangle, a thin string rising over the hip and a V at the back narrowing into her cleft, her seat bare), so the two
  seats show; the thong's back is drawn under the studio light as well as the character light.
- **The hands.** On the structured core the hand is a palm and five digits instead of a mitten, on the regular and
  the anime hero alike (the anime casts' hands smaller, the same shape): the palm flat across the back with the thumb's
  and the little finger's pads in front, the knuckles on an arc, the fingers in a relaxed curl that deepens toward the
  little finger, the thumb opposed. The hand hangs facing the thigh, the forearm tapering into it at a rounded wrist. The wrist is a joint and the fingers bend: the
  pose words `wristL` / `wristR` (flex, or `{ flex, deviation, twist }`) and `fingersL` / `fingersR` (a curl, a curl
  per digit, or a hand word: `relaxed`, `open`, `fist`, `point`, `grip`) now move a structured hero instead of being
  refused; a streamlined hero still refuses them. Fifteen finger bones a hand, named as VRM and Godot name them. A rig
  may now carry `hands`, the wrist and digit chains its posing turns in the hand's own frame.
- **The arms.** On the structured core the upper arm and the forearm carry their muscles instead of running as two
  cones: under the deltoid the triceps fills the back of the upper arm and the biceps the front lower down, into an
  elbow that is wider across than it is deep; the forearm is fullest across just below the elbow and slims into the
  wrist over its last third. The male's are marked, the female's softer, the anime casts' softer still. Cuffs,
  bracers and armour land where they did; a streamlined hero is unchanged. A segment may carry shaping rings between
  its own (`shape`), addressed between its rings so its addresses keep their meaning.
- **The legs.** The same on the structured legs: the thigh's front fuller over its upper half, the hamstrings behind
  and the inner thigh full high, the inner bulge just above the knee and the knee narrower under it; the calf full at
  the back and lower on the inside, the leg slimming above the ankle. Swimsuit leg lines, wraps and greaves land where
  they did. A loft's station may name its `u` too.
- **The feet.** A bare structured hero (the swimsuit's) stands on feet instead of shoes: a rounded heel under the
  Achilles, the two ankle bones, the instep rising to the shin, the arch lifted on the inside, the ball wide on a
  slant; the big toe its own, apart from the rest (the grip), the other four side by side with the lines between them.
  The toes bend with the toe bone. Footwear replaces the foot: a hero in shoes, clothes or armour keeps the shoe as it
  was, and sandals and boots to come take the foot's place on the same joints.
- **The western forehead.** The landmark head's forehead rises from the brow instead of leaning back from it, and the
  brow's outer end stands level with the corner of the eye instead of sinking in behind it, so the far side of the face
  no longer caves in over the eye in the ¾ and the profile. The hair rides the new forehead. Every hero with the landmark
  head changes a little above the eyes, the streamlined core's too.
- **The ear.** The ear is an ear, not an egg, on the landmark and the anime head alike. From the side the broad top
  runs into a nearly straight back edge and down on a diagonal into a broad lobe, the front open where the rim ends, the
  ear leaning back. It is a thin plate, like a leaf, joined to the head at its front and angled off it toward its back.
  On the landmark ear the rim is raised, the antihelix rises inside it and the bowl dips behind, in the darker inner
  tone, so the light shows its depth; the anime ear is a simpler rim, fold and bowl, drawn by its outline. The anime
  head's studio-exact face (`sculpt: false`) keeps its own ear.
- **Smooth shading on the western hero.** A hero under the studio light (the landmark head, or no head) is shaded
  smoothly instead of one flat tone per triangle: the face reads as one form instead of facets over the nose and the
  cheeks, and the chest, the belly, the back and the limbs read as muscle instead of a grid. The skin blends across
  edges that turn up to 70°; hair, cloth and the swimsuit keep their edges. The clip preview shades the same way. The
  anime hero is unchanged (its two tones already follow a smoothed surface), and so is every layered sketch that is not
  a hero.
- **The jaw seam.** A standing hero with the landmark head no longer shows a dark line from the mouth along the jaw to
  the ear when the head is turned: the jaw now turns exactly with the head, so it stays closed against the skull, and it
  still opens at its hinge.
- **The hair over the temple.** The skull no longer pokes through the hair at the left temple like a horn: the hair's
  cap is folded outward over the skull on both sides alike, where its left half used to sink between its points. Every
  cut with a cap changes slightly, the anime cuts' cap under their locks too.
- **The head stored once.** A stored hero kept its anime head twice, once in the plan and again in the recipe the plan
  expands to: about half of every hero row. The recipe's copy is no longer stored; it comes back from the plan when the
  row is read, so every tool, render and export still sees the whole recipe. A head part edited by hand under
  `/recipe` is stored as edited. A hero row is about 1.2 MB instead of 2.35 MB; a row stored before shrinks on its next
  edit.
- **The torso's anatomy.** On the round register the structured torso and pelvis are rounder (twelve points a ring,
  addressed on the old scale, so every armour piece, kit and quilt lands where it did), and they carry the forms a
  silhouette is marked by: the male's chest and its shelf, the sternum, the belly and the navel, the lats and the
  waist's taper, the shoulder blades and the spine; the female's deeper waist and the curve of the lower back; the seat's
  two masses on the pelvis. The step at the waist is gone.
- **Core measures.** Every hero's readout carries `core`: the waist to hip, where the hip peaks, the seat, how far the
  front falls below the waist, any pouch, the largest step in the outline, and whether the legs converge, with advice
  against bands per body that names the word to move. On the structured core the advice is a warning; on a streamlined
  hero it stays in `core.advice`. The design loop's critic reads it. `render-pelvic-overlay.mjs`
  draws the vajra core over the hero mesh before and after.

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
