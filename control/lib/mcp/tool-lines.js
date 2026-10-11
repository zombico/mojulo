/**
 * One line per listed tool: the single source of the drawers that name tools.
 *
 * `get_tool_index`, every `get_creative_toolset({ form })` body and the pack unveil indexes are generated
 * from this table (lib/mcp/tools/context.js, lib/mcp/tools/packs-tools.js). A tool's description stays its
 * manual; its line says what it is for and where to go next, so a pointer that matters (the vocab drawer
 * to read, the tool that revises what this one made) is written here once.
 *
 * - `verb`: what the tool does to a thing (VERBS). The ring is not written here: it is the home pack's
 *   `ring` in packs.js (`orientation` for the spine and folded tools), so it has one source too.
 * - `line`: at most LINE_MAX bytes. Name other tools in backticks.
 * - `plugin`: the line under the Claude plugin profile, when the plain one names a door that build closes.
 *   A tool the profile hides drops out by name and needs none.
 *
 * New tool: add its line here (the registry sweep in context.test.js fails until it has one).
 */

export const LINE_MAX = 200;

// create: makes a new thing at a ref · update: revises one in place · compose: puts made things together
// into a bigger one · observe: measures, compares or records a thing · maintain: keeps, lists, organizes
// or hands over work · orient: reads a map or a manual (the spine and the vocab drawers).
export const VERBS = ['create', 'update', 'compose', 'observe', 'maintain', 'orient'];

// Index order and section titles. `kernel` is the motion ring (Observe), named before the rings were.
export const RING_TITLES = {
  orientation: 'Orientation — where to start, what mojulo is',
  characters: 'Characters — heroes, creatures, animals',
  solids: 'Solids — objects, parts, houses (Print)',
  worlds: 'Worlds — places to walk, and their exports',
  games: 'Games — playable artifacts (Play)',
  read: 'Pictures, diagrams and study views (Read)',
  audio: 'Audio — scores, sound effects, voices (Hear)',
  kernel: 'Observe — motion, turntables, recorded runs',
  workflows: 'Workflows — plans, sweeps, stash and cook, catalysts, worker handoffs',
};

const L = (verb, line, plugin) => (plugin ? { verb, line, plugin } : { verb, line });

export const TOOL_LINES = {
  // ── orientation (spine + folded) ──────────────────────────────────────────
  forward_context: L('orient', 'The routing index: what mojulo makes, as FORM rows → the tool to call, the export dispatch and the guards. Call FIRST when unsure.'),
  get_tool_index: L('orient', 'This index: one line per listed tool, by ring. Call when `forward_context` is not specific enough.'),
  get_creative_toolset: L('orient', "One FORM's tools (character, object, world, game, audio, …). No arg → the form map. Call to MAKE something visual, audible or playable."),
  semantic_search: L('orient', 'Fuzzy recall over mojulo state and every card library (`kinds`: routing, solid_vocab, view_vocab, beats_vocab, …): refs and snippets for an intent.'),
  get_register_kit: L('orient', "The glossary in the operator's register, the refusal legend, the commitment vocabulary and the disclosure directive. Pull to define a term or decode a no."),
  get_worked_example: L('orient', 'An annotated end-to-end trace (`game` / `media`): the calls, the gate moments, one refusal and recovery. Pull before your first build of a kind.'),
  get_ui_map: L('orient', 'The dashboard, page by page, and when to point the user at each. Call when they want to look, browse or click.'),
  get_substrate: L('orient', 'What mojulo is and can honestly claim, plus the substrate facts (data, network, costs, uninstall). Answer questions about mojulo itself from it.'),
  get_tool_ledger: L('observe', "The server's own tool-call telemetry: per-tool calls, errors, latency; `{ orientation: true }` for the lexicon's misses. Shapes only, never values."),
  version: L('orient', 'Runtime versions: server, distribution, MCP protocol, Node, platform, MOJULO_HOME; `workers: true` adds which optional workers this host has. Local, no network.'),
  check_for_updates: L('orient', 'Compares the running `mojulo` against npm latest, with a one-line install hint. Read-only; never upgrades.'),
  mint_diagram: L('create', 'The kernel diagram maker (always installed): a flow chart or data chart from stations, edges and marks. `create_sketch` is the creative superset.'),

  // ── characters ────────────────────────────────────────────────────────────
  create_character: L('create', 'A character `as` hero, creature or animal: the `mint_solid` layered and animal recipes, rigged. Revise with `update_sketch`; manuals `get_solid_vocab`.'),

  // ── solids ────────────────────────────────────────────────────────────────
  mint_solid: L('create', "A 3D solid by `kind`: characters, equipment, furniture, scad parts, workbench objects, assemblies, vehicles and more. Manual: `get_solid_vocab`; revise: `update_sketch`."),
  edit_solid: L('update', "Operate on a minted solid's derived renders: `op:'skin'` paints it, `op:'emote'` poses a figure. Recipe edits go through `update_sketch`.", "Operate on a minted solid's derived renders: `op:'emote'` poses a figure in a looping GIF. Recipe edits go through `update_sketch`."),
  measure_solid: L('observe', 'Numbers off a stored solid: bounds, printed mm size, per-part sizes, closure, volume, print advisories. The check before `export_model`.'),
  fabricate_solid: L('compose', 'Make an object buildable: what each part must do → standard parts, a bill of materials and the cuts or joints that take them. Plan, then mint.'),
  verify_machina: L('observe', 'A checked feasibility verdict for a materials-handling problem: can this mechanism move this load within these limits?'),
  get_solid_vocab: L('orient', 'A `mint_solid` kind or `edit_solid` op manual (long ones open to `sections`). Omit `id` to list; find one with `semantic_search` kind solid_vocab.'),
  mint_building: L('create', 'A walkable house, apartment or furnished room with its structure book; `next` names what is open by outcome and its card. Revise: `update_sketch`.'),

  // ── worlds ────────────────────────────────────────────────────────────────
  compose_world: L('create', 'A traversable world: a BASE (city, transport-hub, controllable, action, dungeon, …) × a theme. Manual: `get_view_vocab`; themes: `list_world_themes`.'),
  list_world_themes: L('orient', 'The theme packs `compose_world` takes, optionally by family (earth / scifi / fantasy). Call before a themed world.'),
  export_model: L('maintain', "A stored world or solid as a file: .glb, print STL / 3MF (mm, true scale), USD, IFC for a house. Diagrams answer `eligible:false`."),
  bind_mesh_render: L('maintain', 'Bind a DCC-refined .glb of an `export_model` file back onto its sketch as a derived artifact; worlds place it by `meshRef`.'),
  translate_modeler_lingo: L('orient', 'Modeler words (blockout, kitbash, retopo, bake, rig, LOD) → what mojulo does and the `export_model` handoff for the rest.'),

  // ── games ─────────────────────────────────────────────────────────────────
  design_game: L('compose', 'THE GAME RAIL: design a game top down (hero, powers, gear, systems); `run: true` makes each ready step through `create_sketch` and the doors.'),
  create_game: L('compose', 'A playable game: a shell with a typed store and levels that are worlds. Store design: `get_game_vocab`; revise: `update_sketch`.'),
  create_pixelizer_game: L('create', 'A self-contained 2D reducer game (brickster and kin) for the Arcade; no levels, unlike `create_game`.'),
  create_sprite_sheet: L('create', 'A 2D sprite sheet as a director recipe: frames on a grid, each painted through the image-render handoff.'),
  bake_sprite_sheet: L('update', 'Quantize accepted sprite frames into pixel sprites under one palette, written back onto the sheet.'),
  get_game_vocab: L('orient', 'The GAME drawer: `gameworld-guide` and the page cards first, then store slices, level mechanics, kits, glyphs, sfx, hud. `samples` to browse a page.'),
  get_play_vocab: L('orient', 'The PLAY drawer: make a world interactive (a door, a lever, a HUD, a level) through a `play` block set with `update_sketch`.'),
  create_game_project: L('maintain', "A game project: one home tying a game's rules, levels, characters, audio and art together, at `/games/<ref>`."),
  get_game_project: L('maintain', 'One project in full: members by role, the active rules and play URL, level promotion, implied members.'),
  update_game_project: L('maintain', 'Rename a project, revise its charter, or move its status (active → shipped → archived). Members: `bind_to_game_project`.'),
  bind_to_game_project: L('maintain', 'Add or remove typed members (rules, level, character, audio, graphic, animation, reference) of a project.'),
  list_game_projects: L('maintain', 'Every game project: title, status, member counts, playable.'),
  export_game: L('maintain', 'A stored game as a self-contained folder (game.html, levels, score, recipes, README); the sibling of `export_model` and `export_beats`.'),

  // ── read: pictures, diagrams, study views ─────────────────────────────────
  create_sketch: L('create', 'A flow chart, data chart or scene illustration (stations, edges, marks, or a recipe). Find a layout with `semantic_search`, read it with `get_sketch_vocab`.'),
  update_sketch: L('update', 'Revise any stored recipe in place (`patch` ops or a full `manifest`): sketches, worlds, solids, characters, games. Never re-mint to change a thing.'),
  get_sketch_vocab: L('orient', 'A sketch-vocab card: layout math and example marks for one paradigm (donut-ring, stacked-bar, pipeline, …). Pair with `semantic_search`.'),
  get_style_vocab: L('orient', 'The style presets a `renderBrief` locks on image sketches (ukiyo-e, clay-render, …). Templates: fork them via overrides.'),
  diff_sketches: L('observe', 'A visual diff of two sketch refs: added, removed, changed and moved parts highlighted, with a similarity verdict.'),
  sketch_what_possible: L('create', 'VISUAL ONLY: resolve a scene illustration\'s knobs over turns, then `create_sketch` with the recipe. Charts go through `get_sketch_vocab`.'),
  create_cover: L('create', 'A publication cover: illustration, title and metadata under one art direction, ready to bind onto a `cook` outcome.'),
  reference_protocol: L('orient', 'Step 1 of reading a photo YOU can see into dials (scene perspective or pose); returns the protocol and the `capture_reference` call to make.'),
  capture_reference: L('create', 'Step 2: file what you read from a photo into a stash as a cage sketch; feeds `mint_solid` pose, `forge_motion` or `cook`.'),
  create_view: L('create', 'An animated 3D study object (physics, math, biology: fission, orbits, DNA, …). Manual: `get_view_vocab`; find a kind with `semantic_search`.'),
  get_view_vocab: L('orient', 'A `create_view` kind or `compose_world` base manual: depiction, routing phrases, parameters. Omit `id` for the index.'),
  measure_view: L('observe', 'The physical time series of a science view in declared real units: the measurement channel the render never shows.'),
  save_recipe: L('maintain', "Keep a tuned study object, beats loop or solid in the operator's cookbook, recallable by intent through `semantic_search`."),

  // ── audio ─────────────────────────────────────────────────────────────────
  create_beats: L('create', 'Music as a seeded recipe: ambient loop, composed score, step-sequenced pattern or sfx cues. Manual: `get_beats_vocab`; revise: `update_beats`.'),
  get_beats_vocab: L('orient', 'A `create_beats` kind manual: recipe shape, patches, effects, gestures. Pair with `semantic_search` kind beats_vocab.'),
  get_beats: L('observe', 'A beats artifact back: recipe, revisions, open annotations. Read before `update_beats`.'),
  update_beats: L('update', 'Revise a beats artifact (full manifest, a revision per change); `update_sketch` refuses beats and points here.'),
  annotate_beats: L('maintain', 'Mark a beats artifact in musical terms (bar, step, track, cue), resolve marks, list them.'),
  diff_beats: L('observe', 'A musical diff of two beats refs (tempo, tracks, patterns cell-wise); `diff_sketches` refuses beats.'),
  export_beats: L('maintain', 'A beats artifact as WAV, or its score as MIDI for a DAW; the audio sibling of `export_model`.'),
  create_voice: L('create', 'A voice register: how a voice sounds (confidence, depth) as a deterministic blend an external speech worker renders.'),
  get_voice: L('observe', 'A voice register back: its axes, the resolved blend, the bound sample. Read before a variant.'),
  bind_voice_sample: L('maintain', 'Bind a worker-rendered WAV onto a voice register so the shelf can play it.'),
  get_voice_vocab: L('orient', 'The voice drawer: recipe shape, banks, calibration, the worker ladder. Pull before your first `create_voice`.'),

  // ── observe: motion ───────────────────────────────────────────────────────
  forge_motion: L('observe', 'Put a subject in motion: camera moves, a slideshow deck, a world flythrough or a recorded traversal run. Decks read a stash `gather`ed in order.'),
  stitch_motion: L('compose', 'Join forged `forge_motion` clips end to end into one MP4 film.'),
  get_motion_vocab: L('orient', 'A `forge_motion` / `stitch_motion` family manual (camera, deck, effect, world, stitch).'),

  // ── workflows: catalysts, workers, connected MCPs ─────────────────────────
  recommend_catalysts: L('orient', 'The workflow shelf with what each needs and what it gives. The entry for "what can I automate?"; then `get_catalyst`.'),
  list_catalysts: L('orient', 'Every shipped and local catalyst, by category and kind.'),
  get_catalyst: L('orient', "One catalyst's full recipe, bound to your host's adapter; how a flow reaches Blender or another MCP."),
  custom_catalyst: L('orient', 'The guide to writing a new catalyst. Read before `mint_catalyst`.'),
  mint_catalyst: L('maintain', "Keep a drafted catalyst on the operator's local shelf, with revisions; returns the file for a PR."),
  list_adapters: L('orient', "The host adapters mojulo ships (`generic` is the fallback). Read yours with `get_adapter`; `version` names the build."),
  get_adapter: L('orient', 'Your host\'s card: how you ride mojulo, artifacts, dry runs, scheduling, secrets. Read once before making.'),
  meta_context_declare_inventory: L('maintain', "Record the host's other MCP servers and their tools so a catalyst can be matched to them. Only when the user asks."),
  record_mcp_capabilities: L('maintain', "Write a provider's capability body from research, with sources; history kept. Read it with `get_mcp_capabilities`."),
  get_mcp_capabilities: L('orient', "A provider's capability body by `provider_ref` (current, or `asOf`). Written by `record_mcp_capabilities`."),
  pull_agent_task: L('maintain', 'Long-poll for work parked for an outside fulfiller; answer with `submit_envelope_inference` or `cancel_agent_task`.'),
  submit_envelope_inference: L('maintain', 'Deliver the envelope for a pulled inference task; validated before the parked request resolves.'),
  cancel_agent_task: L('maintain', 'Release a pulled task with a typed error when it cannot be fulfilled.'),

  // ── workflows: plans ──────────────────────────────────────────────────────
  enter_plan_mode: L('orient', 'The plan discipline for a chain of calls: draft, frame for approval, then `forge_plan` → `compile_plan` → `execute_plan`.'),
  forge_plan: L('compose', 'Seal a draft plan: a goal and a manifest of tool calls, each step able to take an earlier result as `{ $step, path }`. Executes nothing.'),
  revise_plan: L('update', "Revise a plan's goal, lens or manifest with a note; always back to draft."),
  sketch_plan: L('observe', "Preview a plan's manifest as a pipeline diagram without compiling."),
  compile_plan: L('update', 'Check a plan against the live registry: actionable, or draft with the unknown tools named.'),
  execute_plan: L('compose', 'Run an actionable plan step by step with `confirm: true`; stops at the first failure.'),
  list_plans: L('maintain', 'The plan inbox, by status.'),
  get_plan: L('maintain', 'One plan in full: goal, manifest, revisions, execution log.'),

  // ── workflows: stash, gather, cook ────────────────────────────────────────
  mint_stash: L('create', 'A renameable bucket of typed items; the corpus a `cook` reads.'),
  gather: L('maintain', 'Bind a typed item (text, markdown, image, svg, link, sketch, …) into a stash; malformed items are refused at intake.'),
  mint_drawer: L('maintain', 'A drawer (chapter or section) inside a stash, idempotent.'),
  rename_stash: L('maintain', 'Relabel a stash; its ref stays.'),
  list_stashes: L('maintain', 'Stashes, most recently active first.'),
  get_stash: L('maintain', 'A stash in full: drawers and every item.'),
  update_item: L('update', 'Change a gathered item in place; the type contract re-checks the merged state.'),
  archive_item: L('maintain', 'Soft-delete an item; asks for `confirm` when a cook cites it.'),
  bind_stash: L('maintain', 'Link a stash to a plan, cook or other ref with a role. Undo with `unbind_stash`; read with `list_stash_bindings`.'),
  unbind_stash: L('maintain', 'Remove a stash link made by `bind_stash`.'),
  list_stash_bindings: L('maintain', "A stash's links, or what links to a ref."),
  sketch_stash: L('orient', 'Propose a stash for an intent: drawers, item slots and the `mint_stash` → `gather` → `cook` script. Writes nothing.'),
  recommend_kind: L('orient', 'Rank publication kinds for a stash by rules, before `cook`.'),
  cook: L('compose', 'One publication from stash slices, or `items` gathered in the same call, and ONE aim (essay, picture book, deck, comic, …), in `/outcomes/<cook_ref>/`.'),
  forge_publications: L('compose', 'Cook one stash into 2–4 candidate kinds at once; keep the winner, `archive_cook` the rest.'),
  get_cook: L('maintain', 'A cook row and its outcome folder.'),
  list_cooks: L('maintain', 'Cooks, most recent first.'),
  archive_cook: L('maintain', 'Hide a cook from the inbox; its folder stays.'),

  // ── workflows: sweeps and the research book ───────────────────────────────
  run_experiment_sweep: L('compose', 'Variations in one call: any recipe copied per value at a JSON Pointer, one folder of variants; or a mechanics experiment with its plot.'),
  enter_research_mode: L('orient', 'The light research discipline (the legacy book). Only when the user asks to research.'),
  start_research: L('create', 'A research book; bind items with `bind_research_item`.'),
  bind_research_item: L('maintain', 'Add a link, note, quote, summary or sketch to a research book.'),
  synthesize_abstract: L('compose', 'Distill a research book into a thesis, with a hub-and-spoke diagram.'),
  sketch_research: L('observe', 'Preview a research book as a diagram without synthesizing.'),
  get_research: L('maintain', 'A research book in full.'),
  list_research: L('maintain', 'Research books, most recently active first.'),

  // ── workflows: image and mesh render handoffs ─────────────────────────────
  get_image_render_packet: L('maintain', 'The render packet for an image-outcome, comic or character-sheet sketch: instructions, scaffold, style lock, references.'),
  bind_character_sheet: L('maintain', "Save a character sheet PNG onto its sketch so every comic casting it gets it as a reference."),
  bind_image_render: L('maintain', 'Save a painted page or panel PNG onto its sketch; once all targets are bound the page composites.'),
  render_handoff: L('maintain', 'The external worker loop, `medium` image or mesh: request → pull → submit → accept | reject (the eyes gate).'),
};
