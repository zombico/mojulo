// Isolate to in-memory SQLite — must run before any import that pulls in
// db/index.js. Same pattern as context.test.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Description budget ratchet (orientation-diet.plan.md thread A0).
//
// tools/list is the one surface that can't be drawerized from inside: on hosts
// without deferred tool loading, every listed tool's description rides into
// the model's context whether or not the session touches it. The rule:
// **route in the description, teach in the drawer** — routing phrases + a
// vocab-card/drawer pointer fit the ceiling; lessons and parameter manuals
// don't belong in the list.
//
// - A NEW tool must fit DESCRIPTION_CEILING.
// - The allowlist below is a snapshot of the offenders at ratchet time
//   (2026-07-06). An allowlisted tool may shrink but never grow past its
//   snapshot; once it fits the ceiling, its entry must be DELETED (the test
//   fails on stale entries, so the list only ratchets down).
// - The payload pin holds the whole tools/list body under a deliberate
//   ceiling — growth is a conscious re-pin, same contract as the emit
//   char-net. Baseline at ratchet time: 150 tools, 314,028 bytes.
// ---------------------------------------------------------------------------

const DESCRIPTION_CEILING = 700;

// tool name → description length at ratchet time. Shrink freely; never grow.
// The A1–A3 prose-diet phases in orientation-diet.plan.md work this list down
// (forge_motion → motion vocab cards; create_manji_tree → manji_program cards;
// dna/energy/turntable → create_view kinds).
const DESCRIPTION_ALLOWLIST = {
  bind_primitives: 1904,
  bind_research_item: 1233,
  bind_trigger: 1227,
  capture_reference: 1523,
  compile_plan: 841,
  // compose_world / create_sketch / get_game_vocab re-pinned 2026-07-10 to
  // bless the visualization-layer branch growth (school base + game vocab
  // families + sketch kinds). Shrink-only from these new snapshots.
  compose_world: 1488,
  cook: 2756,
  create_assembler: 2100,
  // create_beats / create_figure / export_beats / get_image_render_packet
  // re-pinned 2026-07-13 to bless visualization-layer branch growth measured
  // at the Mojulo Voice landing (figure garment/setup dials, beats export
  // midi handoff, render-packet control-scaffold pointer). Shrink-only.
  create_beats: 1150,
  create_carved_solid: 2605,
  // create_cover / export_game allowlisted + sketch_polygomer re-pinned
  // 2026-08-04 to bless the 1.0 consolidation batch (publication covers,
  // the game-publish phase-2 export seam, the polygomer drapes/detail
  // growth). Shrink-only from these snapshots.
  create_cover: 1138,
  create_dna_process: 1137,
  create_energy_cycle: 1011,
  // create_figure re-pinned 2026-07-14: inline wardrobe-piece specs (the
  // character-from-dream C0b unlock — garment as data, mugen = looseness) +
  // the figure skin seam pointer (get_skin_packet/skin_polygomer). Shrink-only.
  create_figure: 4275,
  create_game: 2012,
  // create_manji_tree / export_model re-pinned + skin_polygomer /
  // sketch_polygomer allowlisted 2026-07-17 to bless the "dream, borrow,
  // keep" batch growth (drapes channel + detail dial on manji trees, the
  // skin-projection seam pointers, the sketch_polygomer parts grammar).
  // Shrink-only from these snapshots.
  create_manji_tree: 20151,
  create_polygonized_sketch: 932,
  create_sketch: 4003,
  create_solid_turntable: 1172,
  create_view: 723,
  create_workbench: 3150,
  custom_protocol: 791,
  declare_skills: 1041,
  diff_sketches: 875,
  execute_plan: 1314,
  export_beats: 1124,
  export_game: 1253,
  // export_model re-pinned 2026-07-17: the STL print-handoff format
  // (format:'glb'|'stl' + scale → mm) rides the same tool. Shrink-only.
  export_model: 2104,
  forge_motion: 12999,
  forge_plan: 1167,
  forge_publications: 955,
  forward_context: 1081,
  gather: 1181,
  get_adapter: 981,
  get_game_vocab: 1297,
  get_image_render_packet: 708,
  get_mcp_capabilities: 890,
  get_register_kit: 731,
  // get_substrate re-pinned 2026-08-05: Media promoted to a first-class
  // paradigm (five paradigms; Game reframed as composition) — the cloud-shape
  // mapping row grew. Shrink-only.
  get_substrate: 914,
  get_tool_telemetry: 906,
  get_worked_example: 946,
  install_scaffold: 1317,
  measure_view: 1327,
  meta_context_brief: 972,
  meta_context_commit: 2635,
  meta_context_declare_inventory: 1405,
  preview_vehicle_instance: 1193,
  pull_agent_task: 810,
  recommend_catalysts: 1042,
  recommend_kind: 922,
  recommend_mcp_orbit_compositions: 1056,
  record_mcp_capabilities: 1301,
  reference_protocol: 1708,
  request_chat_decision: 893,
  run_experiment_sweep: 866,
  semantic_search: 1768,
  sketch_plan: 774,
  sketch_polygomer: 1214,
  sketch_research: 712,
  skin_polygomer: 953,
  sketch_stash: 1016,
  sketch_what_possible: 1316,
  stitch_motion: 1435,
  synthesize_abstract: 1420,
  translate_modeler_lingo: 1178,
  verify_machina: 2180,
};

// Whole-body pin: baseline 314,028 bytes at ratchet time. Deliberate growth
// (a new tool, an intended description) re-pins this number in the same
// commit; silent growth fails here first.
// Re-pinned 2026-07-11 (was 320,000; measured 320,235) to bless the
// image-outcomes worker seam growth: get_image_render_packet +
// bind_character_sheet + the cook comic-format creation pointer.
// Re-pinned 2026-07-12 (was 324,000; measured 328,325) to bless the render
// handoff (render-handoff.plan.md): request_/pull_/submit_/accept_/
// reject_image_render — the durable render-worker bicycle.
// Re-pinned 2026-07-13 (was 332,000; measured 333,814) to bless Mojulo Voice
// (voice-worker.plan.md): create_voice / get_voice / get_voice_vocab.
// Re-pinned 2026-07-17 (was 336,000; measured 351,493) to bless the "dream,
// borrow, keep" batch: create_edifice, emote_figure, sketch_polygomer,
// get_skin_packet / skin_polygomer, bind_voice_sample, and the manji-tree
// drapes/detail growth.
// Re-pinned 2026-07-17 (was 352,000; measured 352,387) to bless the STL
// print handoff on export_model (format:'glb'|'stl' + scale → mm).
// Re-pinned 2026-07-19 (was 353,000; measured 353,675) to bless the in-flight
// armory/vehicle tool growth riding the tree (~600 bytes) plus the Qwen
// reweigh of the render-image-outcome-locally catalyst summary (~75 bytes,
// local-render-worker.plan.md L4).
// Re-pinned 2026-07-24 (was 354,000; measured 359,539) to bless the five
// game-project tools + create_game's project_ref (game-developer.plan.md
// GP1, ~4.6k) — noting ~1.2k of other in-flight growth had already crossed
// the old pin before GP1 (measured 354,897 without it).
// Re-pinned 2026-07-25 (360_000 → 362_000) to bless `create_pixelizer_game`
// (pixelizer.plan.md P5 — the 2D reducer-game arcade mint; description already
// trimmed to lean routing prose, drawer teaches). Measured 360,962 with it.
// Re-pinned 2026-08-04 (was 362,000; measured 371,050) to bless the 1.0
// consolidation batch: create_cover (cover-composition phase B) + export_game
// (game-publish phase 2) + create_sprite_sheet / bake_sprite_sheet
// (sprite-sheet.plan.md P0/P1) + the sketch_polygomer growth.
const PAYLOAD_CEILING = 372_000;

async function listedTools() {
  const { ensureToolsRegistered, listTools } = await import('@/lib/mcp/server');
  await ensureToolsRegistered();
  return listTools();
}

describe('tools/list description budget — the ratchet', () => {
  it(`every listed tool description fits its budget (${DESCRIPTION_CEILING} chars, or its allowlist snapshot)`, async () => {
    const offenders = (await listedTools())
      .map((t) => ({
        name: t.name,
        len: (t.description || '').length,
        budget: DESCRIPTION_ALLOWLIST[t.name] ?? DESCRIPTION_CEILING,
      }))
      .filter((t) => t.len > t.budget)
      .map((t) => `${t.name}: ${t.len} chars > budget ${t.budget}`);
    expect(offenders).toEqual([]);
  });

  it('the allowlist only ratchets down — stale entries must be deleted', async () => {
    const byName = new Map((await listedTools()).map((t) => [t.name, (t.description || '').length]));
    const stale = Object.keys(DESCRIPTION_ALLOWLIST)
      .filter((name) => {
        const len = byName.get(name);
        // Stale when the tool no longer exists as a listed name, or its
        // description now fits the ceiling on its own.
        return len === undefined || len <= DESCRIPTION_CEILING;
      })
      .map((name) => `${name} (now ${byName.get(name) ?? 'unlisted'})`);
    expect(stale).toEqual([]);
  });

  it(`total tools/list payload stays under the pin (${PAYLOAD_CEILING} bytes)`, async () => {
    const payload = JSON.stringify(await listedTools()).length;
    expect(payload).toBeLessThan(PAYLOAD_CEILING);
  });
});
