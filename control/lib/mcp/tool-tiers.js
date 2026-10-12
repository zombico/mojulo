/**
 * One tier per listed tool: how much judgment the AGENT needs to use it well (../agent-tasks/tiers.js).
 *
 *   ride    the server does the work; the agent only picks the call (reads, lists, exports, measures)
 *   fill    map a clear request onto params: an enum, a vocab card, a ref
 *   judge   author or revise a recipe; the eyes gate comes back here
 *   design  compose many steps into one thing (a plan, a game, a publication, a thesis)
 *
 * A host whose profile declares `capabilities.modelTiers` sees the tier as `_meta["mojulo/tier"]` on each
 * tool in tools/list (server.js), so it can hand light work to a lighter model. Every other host's list
 * is byte-identical. The table names tiers only, never a model: a runtime adapter maps tier → model.
 *
 * Kept apart from tool-lines.js so a tier change never touches a tool's line. New listed tool: add its
 * tier here (tool-tiers.test.js fails until it has one), or name it in TIER_DEFERRED.
 */

// Tools whose tier waits on their own branch (characters). Listed, untiered: no `_meta` for them.
export const TIER_DEFERRED = Object.freeze(['create_character', 'bind_character_sheet']);

export const TOOL_TIERS = Object.freeze({
  // ── orientation ──
  forward_context: 'ride',
  get_tool_index: 'ride',
  get_creative_toolset: 'ride',
  semantic_search: 'ride',
  get_register_kit: 'ride',
  get_worked_example: 'ride',
  get_ui_map: 'ride',
  get_substrate: 'ride',
  version: 'ride',
  check_for_updates: 'ride',
  get_tool_ledger: 'ride',
  mint_diagram: 'fill',

  // ── solids (Print) ──
  get_solid_vocab: 'ride',
  measure_solid: 'ride',
  mint_building: 'fill',
  edit_solid: 'fill',
  mint_solid: 'judge', // fill for furniture and gear; an `scad` program is authoring, so the ceiling wins
  fabricate_solid: 'judge',
  verify_machina: 'design',

  // ── worlds ──
  list_world_themes: 'ride',
  translate_modeler_lingo: 'ride',
  export_model: 'ride',
  bind_mesh_render: 'ride',
  compose_world: 'fill',

  // ── games (Play) ──
  get_game_vocab: 'ride',
  get_play_vocab: 'ride',
  list_game_projects: 'ride',
  get_game_project: 'ride',
  bind_to_game_project: 'ride',
  export_game: 'ride',
  bake_sprite_sheet: 'ride',
  create_game_project: 'fill',
  update_game_project: 'fill',
  create_pixelizer_game: 'fill',
  create_sprite_sheet: 'judge',
  tune_ground: 'judge',
  create_game: 'design',
  design_game: 'design',

  // ── pictures, diagrams, study views (Read) ──
  get_sketch_vocab: 'ride',
  get_style_vocab: 'ride',
  get_view_vocab: 'ride',
  reference_protocol: 'ride',
  diff_sketches: 'ride',
  measure_view: 'ride',
  save_recipe: 'ride',
  create_view: 'fill',
  create_sketch: 'judge',
  update_sketch: 'judge',
  sketch_what_possible: 'judge',
  capture_reference: 'judge',
  create_cover: 'judge',

  // ── audio (Hear) ──
  get_beats_vocab: 'ride',
  get_voice_vocab: 'ride',
  get_beats: 'ride',
  get_voice: 'ride',
  diff_beats: 'ride',
  export_beats: 'ride',
  bind_voice_sample: 'ride',
  create_voice: 'fill',
  annotate_beats: 'fill',
  create_beats: 'judge',
  update_beats: 'judge',

  // ── observe (motion) ──
  get_motion_vocab: 'ride',
  forge_motion: 'judge',
  stitch_motion: 'judge',

  // ── workflows: plans ──
  enter_plan_mode: 'ride',
  get_plan: 'ride',
  list_plans: 'ride',
  sketch_plan: 'ride',
  compile_plan: 'ride',
  execute_plan: 'ride', // runs a compiled manifest with no model in the loop
  revise_plan: 'judge',
  forge_plan: 'design',
  run_experiment_sweep: 'fill',

  // ── workflows: stash and cook ──
  list_stashes: 'ride',
  get_stash: 'ride',
  rename_stash: 'ride',
  mint_drawer: 'ride',
  bind_stash: 'ride',
  unbind_stash: 'ride',
  list_stash_bindings: 'ride',
  archive_item: 'ride',
  list_cooks: 'ride',
  get_cook: 'ride',
  archive_cook: 'ride',
  recommend_kind: 'ride',
  mint_stash: 'fill',
  gather: 'fill',
  update_item: 'fill',
  sketch_stash: 'fill',
  cook: 'design',
  forge_publications: 'design',

  // ── workflows: research ──
  enter_research_mode: 'ride',
  list_research: 'ride',
  get_research: 'ride',
  sketch_research: 'ride',
  start_research: 'fill',
  bind_research_item: 'fill',
  synthesize_abstract: 'design',

  // ── workflows: catalysts and hosts ──
  get_adapter: 'ride',
  list_adapters: 'ride',
  list_catalysts: 'ride',
  get_catalyst: 'ride',
  recommend_catalysts: 'ride',
  custom_catalyst: 'ride',
  get_mcp_capabilities: 'ride',
  record_mcp_capabilities: 'judge',
  meta_context_declare_inventory: 'judge',
  mint_catalyst: 'design',

  // ── workflows: worker handoffs and receipts ──
  pull_agent_task: 'ride',
  submit_envelope_inference: 'ride', // the answer's own tier rides the pulled task, not this tool
  cancel_agent_task: 'ride',
  get_image_render_packet: 'ride',
  bind_image_render: 'ride',
  render_handoff: 'fill',
  sign_asset: 'ride',
  verify_asset: 'ride',
});
