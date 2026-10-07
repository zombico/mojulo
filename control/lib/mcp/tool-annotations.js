/**
 * Tool annotations: the MCP `title` and behavior hints for every registered tool.
 *
 * `annotations` (readOnlyHint / destructiveHint / idempotentHint / openWorldHint)
 * arrived in MCP 2025-03-26 and the top-level tool `title` in 2025-06-18; Anthropic's
 * directory policy (5.E) asks for them on every tool. listTools() in server.js stamps
 * each tools/list entry from this table: the title twice (top level and inside
 * `annotations`, so clients on either revision show it) plus all four hints.
 *
 * One table keyed by tool name, so the whole classification reads and is corrected in
 * one place. Pure data plus one import of packs.js (itself import-free), so server.js
 * can import it statically. Resolution for a registered name:
 *   - its own row;
 *   - a deprecated alias registered with `aliasOf` takes its target's row;
 *   - a pack dispatcher (pack_*) is derived from the members it can dispatch
 *     (packAnnotations below): read-only only if every member is, destructive or
 *     open-world if any member is, idempotent only if every member is.
 * tool-annotations.test.js fails when a registered tool resolves to nothing, or when a
 * row names a tool that is not registered.
 *
 * What each hint means here (the rules every row was classified by):
 *   readOnly     never writes mojulo's DB, files, or processes. Per-call telemetry, a
 *                lazily created per-session scratch row, and filling a derived index
 *                on first use (semantic_search's lexical corpus) do not count.
 *   destructive  may delete, archive, stop, unbind, or overwrite existing state in place
 *                without keeping the previous version. Writes that only add rows or
 *                files, edits that archive the prior revision first, and rewrites of
 *                output regenerated from a stored recipe (exports, bakes) are not.
 *                Only meaningful when readOnly is false.
 *   idempotent   a second call with the same arguments has no further effect (a repeat
 *                that is refused as a duplicate counts).
 *   openWorld    reaches outside mojulo's DB and $MOJULO_HOME: the network (npm, an LLM
 *                provider, a URL, a deployed bot), the operator's app directories and
 *                the processes started from them, git, or arbitrary tool execution.
 *                mojulo's own daemon host is not outside. Neither are the headless
 *                Chromium and ffmpeg render helpers: many mints and exports rasterize
 *                through them, and the first use may download them into $MOJULO_HOME
 *                (lib/graph/scene/chromium.js, lib/motion/ffmpeg.js). That download is
 *                disclosed as a package behavior rather than flagged on every tool.
 */

import { getPack, dispatchTargets } from './packs.js';

const hints = (readOnlyHint, destructiveHint, idempotentHint, openWorldHint) =>
  Object.freeze({ readOnlyHint, destructiveHint, idempotentHint, openWorldHint });

// The common combinations. Rows outside these spell their hints out.
const READ = hints(true, false, true, false);
const READ_EXTERNAL = hints(true, false, true, true);
const ADDITIVE = hints(false, false, false, false);
const ADDITIVE_IDEMPOTENT = hints(false, false, true, false);
const DESTRUCTIVE = hints(false, true, false, false);
const DESTRUCTIVE_IDEMPOTENT = hints(false, true, true, false);
// MCP's own defaults for a tool that declares nothing. Used for a pack member with no
// row, so a pack never claims more safety than its members were classified with.
const UNCLASSIFIED = hints(false, true, false, true);

// name → [title, hints]. Grouped by the module that registers the tool, in
// registration order. A comment explains any row that is not obvious from its title.
export const TOOL_ANNOTATIONS = {
  // ── orientation (context.js, worked-examples.js, adapters.js) ──────────────
  forward_context: ['Routing index', READ],
  get_tool_index: ['Tool index', READ],
  get_creative_toolset: ['Creative toolset by form', READ],
  get_register_kit: ['Vocabulary and refusal legend', READ],
  get_deliberation_overview: ['Deliberation surfaces overview', READ],
  get_ui_map: ['Dashboard page map', READ],
  get_substrate: ['What mojulo is', READ],
  version: ['Server version', READ],
  check_for_updates: ['Check for updates', READ_EXTERNAL], // asks the npm registry
  get_tool_ledger: ['Tool-call ledger', READ],
  get_worked_example: ['Worked example', READ],
  list_adapters: ['List host adapters', READ],
  get_adapter: ['Get host adapter', READ],

  // ── catalysts (catalysts.js) ───────────────────────────────────────────────
  list_catalysts: ['List catalysts', READ],
  get_catalyst: ['Get catalyst', READ],
  mint_catalyst: ['Mint or archive a local catalyst', DESTRUCTIVE], // `archive: true` retires a row
  custom_catalyst: ['Catalyst authoring guide', READ],
  recommend_catalysts: ['Recommend catalysts', READ],

  // ── connected services: contextmap, inventory, composer (Ring 6) ───────────
  meta_context_brief: ['Contextmap brief', READ],
  meta_context_analyze: ['Audit connected-service drift', READ],
  meta_context_commit: ['Seal a decision in the contextmap', ADDITIVE], // append-only
  // Replace semantics: entries missing from the new declaration are dropped.
  meta_context_declare_inventory: ['Declare connected MCP servers', DESTRUCTIVE_IDEMPOTENT],
  declare_skills: ['Declare host skills', DESTRUCTIVE_IDEMPOTENT],
  record_mcp_capabilities: ['Record MCP vendor capabilities', ADDITIVE], // supersedes, keeps history
  get_mcp_capabilities: ['Get MCP vendor capabilities', READ],
  list_mcp_orbit_components: ['List mcp-orbit components', READ],
  get_mcp_orbit_component: ['Get mcp-orbit component', READ],
  get_meta_catalyst: ['mcp-orbit composition rulebook', READ],
  recommend_mcp_orbit_compositions: ['Recommend mcp-orbit compositions', ADDITIVE], // logs proposals
  bind_primitives: ['Bind MCP primitives', ADDITIVE],
  bind_trigger: ['Bind a trigger', ADDITIVE_IDEMPOTENT], // a duplicate binding is refused
  unbind_trigger: ['Unbind a trigger', DESTRUCTIVE_IDEMPOTENT],
  list_triggers: ['List triggers', READ],
  get_trigger: ['Get trigger', READ],
  semantic_search: ['Search mojulo state', READ],
  sketch_what_possible: ['Resolve illustration knobs', READ],

  // ── apps and runtime (Ring 7: runner.js, runtime-daemons.js) ───────────────
  // App tools act on the operator's app directory and the processes started from it.
  install_scaffold: ['Install app scaffold', hints(false, true, true, true)], // `overwrite: true` repaves
  list_runners: ['List app runners', READ],
  start_app: ['Start an app', hints(false, false, false, true)],
  stop_app: ['Stop an app', hints(false, true, true, true)],
  status_app: ['App status', READ], // asks mojulo's daemon host
  list_running: ['List running apps', READ],
  list_env: ['List app env keys', READ_EXTERNAL],
  set_env: ['Set app env var', hints(false, true, true, true)], // overwrites the key's value
  delete_env: ['Delete app env var', hints(false, true, true, true)],
  list_daemons: ['List runtime daemons', READ],
  status_daemon: ['Daemon status', READ],
  start_daemon: ['Start a daemon', ADDITIVE_IDEMPOTENT],
  stop_daemon: ['Stop a daemon', DESTRUCTIVE_IDEMPOTENT],
  restart_daemon: ['Restart a daemon', DESTRUCTIVE], // interrupts in-flight work

  // ── agent tasks (agent-tasks.js) ───────────────────────────────────────────
  pull_agent_task: ['Pull an agent task', ADDITIVE], // claims the next task
  submit_envelope_inference: ['Submit task inference', ADDITIVE_IDEMPOTENT], // a resubmit finds nothing in flight
  cancel_agent_task: ['Cancel an agent task', DESTRUCTIVE_IDEMPOTENT],

  // ── plan mode (Ring 8: plan-mode.js) ───────────────────────────────────────
  enter_plan_mode: ['Enter plan mode', READ],
  forge_plan: ['Forge a plan', ADDITIVE],
  revise_plan: ['Revise a plan', DESTRUCTIVE], // replaces fields; the log keeps only the note
  sketch_plan: ['Sketch a plan', ADDITIVE],
  compile_plan: ['Compile a plan', ADDITIVE],
  execute_plan: ['Execute a plan', hints(false, true, false, true)], // runs the manifest's tool calls
  list_plans: ['List plans', READ],
  get_plan: ['Get plan', READ],

  // ── research mode (Ring 9: research-mode.js, research-sweep.js) ────────────
  enter_research_mode: ['Enter research mode', READ],
  start_research: ['Start a research book', ADDITIVE],
  bind_research_item: ['Add a research item', ADDITIVE],
  synthesize_abstract: ['Synthesize a research abstract', ADDITIVE],
  sketch_research: ['Sketch a research book', ADDITIVE],
  get_research: ['Get research book', READ],
  list_research: ['List research books', READ],
  run_experiment_sweep: ['Run a parameter sweep', ADDITIVE],

  // ── stash, cook, publish (stash-mode.js, cook.js) ──────────────────────────
  mint_stash: ['Create a stash', ADDITIVE],
  gather: ['Gather an item into a stash', ADDITIVE],
  mint_drawer: ['Create a stash drawer', ADDITIVE_IDEMPOTENT],
  rename_stash: ['Rename a stash', DESTRUCTIVE_IDEMPOTENT],
  list_stashes: ['List stashes', READ],
  get_stash: ['Get stash', READ],
  update_item: ['Update a stash item', DESTRUCTIVE_IDEMPOTENT],
  archive_item: ['Archive a stash item', DESTRUCTIVE_IDEMPOTENT],
  bind_stash: ['Bind a stash', ADDITIVE_IDEMPOTENT],
  unbind_stash: ['Unbind a stash', DESTRUCTIVE_IDEMPOTENT],
  list_stash_bindings: ['List stash bindings', READ],
  cook: ['Cook stashes into a report', ADDITIVE],
  get_cook: ['Get cook outcome', READ],
  list_cooks: ['List cook outcomes', READ],
  sketch_stash: ['Propose a stash layout', READ],
  archive_cook: ['Archive a cook outcome', DESTRUCTIVE_IDEMPOTENT],
  forge_publications: ['Forge publications', ADDITIVE],
  recommend_kind: ['Recommend a publication kind', READ],

  // ── visual reference (visual-reference.js) ─────────────────────────────────
  reference_protocol: ['Photo-reading protocol', READ],
  capture_reference: ['Capture a photo reference', ADDITIVE],

  // ── sketches and the render hand-offs (sketches.js, diagram.js, *-handoff.js)
  create_sketch: ['Create a sketch', ADDITIVE],
  update_sketch: ['Update a sketch in place', DESTRUCTIVE], // only solid kinds keep revisions
  get_sketch_vocab: ['Sketch vocabulary cards', READ],
  get_style_vocab: ['Style presets', READ],
  diff_sketches: ['Diff two sketches', READ],
  get_image_render_packet: ['Image render packet', READ],
  bind_image_render: ['Bind a rendered image', ADDITIVE], // append-only slots
  bind_character_sheet: ['Bind a character sheet render', ADDITIVE],
  preview_world: ['Preview a stored mesh', ADDITIVE_IDEMPOTENT],
  export_model: ['Export a model file', ADDITIVE_IDEMPOTENT], // rewrites its own export files
  bind_mesh_render: ['Bind a refined mesh', ADDITIVE],
  mint_diagram: ['Mint a diagram', ADDITIVE],
  mint_building: ['Mint a building', ADDITIVE],
  request_image_render: ['Queue an image render', ADDITIVE_IDEMPOTENT], // deduped per manifest hash
  pull_image_render: ['Claim an image render', ADDITIVE],
  submit_image_render: ['Submit an image render', ADDITIVE],
  accept_image_render: ['Accept an image render', ADDITIVE_IDEMPOTENT],
  reject_image_render: ['Reject an image render', DESTRUCTIVE_IDEMPOTENT], // can overturn an accept
  request_mesh_render: ['Queue a mesh render', ADDITIVE_IDEMPOTENT],
  pull_mesh_render: ['Claim a mesh render', ADDITIVE],
  submit_mesh_render: ['Submit a mesh render', ADDITIVE],
  accept_mesh_render: ['Accept a mesh render', ADDITIVE_IDEMPOTENT],
  reject_mesh_render: ['Reject a mesh render', DESTRUCTIVE_IDEMPOTENT],
  translate_modeler_lingo: ['Translate 3D-modeler terms', READ],

  // ── solids, worlds, views (mint-solid.js, compose-world.js, create-view.js) ─
  mint_solid: ['Mint a 3D solid', hints(false, false, false, true)], // via:'prompt' calls the user's LLM provider
  edit_solid: ['Skin or emote a solid', ADDITIVE], // skins append a slot; emotes add a GIF or mint
  get_solid_vocab: ['Solid vocabulary cards', READ],
  measure_solid: ['Measure a solid', READ],
  fabricate_solid: ['Fabricate from standard parts', hints(false, false, false, false)], // the plan call writes nothing; the mint adds a row
  create_cover: ['Create a publication cover', ADDITIVE],
  compose_world: ['Compose a world', ADDITIVE],
  list_world_themes: ['List world themes', READ],
  create_view: ['Create a study view', ADDITIVE],
  get_view_vocab: ['View vocabulary cards', READ],
  save_recipe: ['Save a recipe to the cookbook', hints(false, false, true, true)], // commits with git
  measure_view: ['Measure a study view', READ],
  verify_machina: ['Check a mechanism', READ], // pure compute

  // ── motion, audio, voice (motion.js, beats.js, voice.js) ───────────────────
  forge_motion: ['Forge a motion clip', ADDITIVE],
  stitch_motion: ['Stitch clips into a film', ADDITIVE],
  get_motion_vocab: ['Motion vocabulary cards', READ],
  create_beats: ['Create beats', ADDITIVE],
  get_beats_vocab: ['Beats vocabulary cards', READ],
  get_beats: ['Get beats', READ],
  update_beats: ['Update beats', ADDITIVE], // appends a revision
  annotate_beats: ['Annotate beats', ADDITIVE],
  diff_beats: ['Diff beats revisions', READ],
  export_beats: ['Export beats audio', ADDITIVE_IDEMPOTENT],
  create_voice: ['Create a voice', ADDITIVE],
  get_voice: ['Get voice', READ],
  bind_voice_sample: ['Bind a voice sample', ADDITIVE],
  get_voice_vocab: ['Voice vocabulary cards', READ],

  // ── games (create-game.js, game-projects.js, pixelizer, sprites, export) ───
  create_game: ['Create a game', ADDITIVE],
  get_game_vocab: ['Game vocabulary cards', READ],
  create_game_project: ['Create a game project', ADDITIVE],
  get_game_project: ['Get game project', READ],
  update_game_project: ['Update a game project', DESTRUCTIVE_IDEMPOTENT],
  bind_to_game_project: ['Add or remove game project members', DESTRUCTIVE_IDEMPOTENT],
  list_game_projects: ['List game projects', READ],
  create_pixelizer_game: ['Create a pixel arcade game', ADDITIVE],
  create_sprite_sheet: ['Create a sprite sheet', ADDITIVE],
  bake_sprite_sheet: ['Bake a sprite sheet', ADDITIVE_IDEMPOTENT],
  // An engine target (godot / unity / unreal) deletes and rewrites its pack folder.
  export_game: ['Export a game', DESTRUCTIVE_IDEMPOTENT],

  // ── unlisted, callable by name (figure-specs.js, roles.js) ─────────────────
  draft_figure_spec: ['Draft a figure spec', ADDITIVE],
  get_figure_spec: ['Get figure spec', READ],
  resolve_figure_spec: ['Approve or reject a figure spec', ADDITIVE_IDEMPOTENT],
  build_figure_spec: ['Build an approved figure spec', ADDITIVE],
  mint_role_key: ['Mint a delegate key', ADDITIVE_IDEMPOTENT], // one key per name
  list_role_keys: ['List delegate keys', READ],
  revoke_role_key: ['Revoke a delegate key', DESTRUCTIVE_IDEMPOTENT],
};

function toMeta(title, h) {
  return { title, annotations: { title, ...h } };
}

/** A pack dispatcher's metadata, derived from every name it dispatches. */
export function packAnnotations(pack) {
  const rows = dispatchTargets(pack).map((name) => TOOL_ANNOTATIONS[name]?.[1] || UNCLASSIFIED);
  const every = (key) => rows.every((h) => h[key]);
  const some = (key) => rows.some((h) => h[key]);
  const readOnly = every('readOnlyHint');
  return toMeta(
    pack.title,
    hints(readOnly, !readOnly && some('destructiveHint'), every('idempotentHint'), some('openWorldHint')),
  );
}

/**
 * `{ title, annotations }` for a registered tool name, or null when nothing
 * classifies it. `aliasOf` is the target a deprecated alias was registered with.
 */
export function toolAnnotations(name, aliasOf) {
  const row = TOOL_ANNOTATIONS[name] || (aliasOf ? TOOL_ANNOTATIONS[aliasOf] : undefined);
  if (row) return toMeta(row[0], row[1]);
  const pack = getPack(name);
  return pack ? packAnnotations(pack) : null;
}
