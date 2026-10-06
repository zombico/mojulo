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
  // Ratcheted 2026-09-28 for the chatbot carve-out (3.0.0): these descriptions stopped naming the
  // bot factory (bot scopes, fleet modes, chat_turn, the bot trace, the bot-bound commit), so each
  // pin drops to its new length: forward_context 1081 -> 1012, get_worked_example 946 -> 903,
  // list_catalysts 833 -> 805, meta_context_brief 972 -> 963, meta_context_commit 2635 -> 2586,
  // meta_context_declare_inventory 1405 -> 1387, pull_agent_task 762 -> 718,
  // recommend_catalysts 1042 -> 1027.
  bind_primitives: 1904,
  bind_research_item: 1233,
  bind_trigger: 1227,
  capture_reference: 1523,
  compile_plan: 841,
  // compose_world / create_sketch / get_game_vocab re-pinned 2026-07-10 to
  // bless the visualization-layer branch growth (school base + game vocab
  // families + sketch kinds). compose_world re-pinned 2026-08-10 to bless
  // the 'dungeon' base clause (dungeon-designer wired into the world
  // registry; the parameter manual lives in its view-vocab card,
  // off-payload). Shrink-only from these new snapshots.
  // compose_world / create_sketch / mint_solid re-pinned 2026-09-22 (house-compose-language):
  // one routing sentence each saying a house / apartment / furnished room is
  // `create_sketch` kind 'floorplan' — the pointer a web session lacked when it opened
  // the object and world packs, found no house, and shipped an edifice. mint_solid was
  // 699 chars (one under the ceiling) and joins the allowlist for that sentence alone.
  // compose_world re-pinned 2026-09-28 (terrain-world): the 'terrain' base clause — a painted landscape made
  // real-scale ground (walk / fly / see whole); its manual lives in the view-vocab card `terrain`, off-payload.
  // compose_world re-pinned 2026-10-04 (flame-depiction): one sentence routing fire in a world (campfire, torches,
  // fireball, grass fire) to `overrides.fire` over the older carved-solid `flame` and sketch fire; the manual is
  // the 'Fire' section of the dungeon and terrain cards, off-payload.
  compose_world: 1998,
  cook: 2756,
  // create_beats / create_figure / export_beats / get_image_render_packet
  // re-pinned 2026-07-13 to bless visualization-layer branch growth measured
  // at the Mojulo Voice landing (figure garment/setup dials, beats export
  // midi handoff, render-packet control-scaffold pointer). Shrink-only.
  create_beats: 1150,
  // create_cover / export_game allowlisted + sketch_polygomer re-pinned
  // 2026-08-04 to bless the 1.0 consolidation batch (publication covers,
  // the game-publish phase-2 export seam, the polygomer drapes/detail
  // growth). Shrink-only from these snapshots.
  create_cover: 1138,
  // create_figure re-pinned 2026-07-14: inline wardrobe-piece specs (the
  // character-from-dream C0b unlock — garment as data, mugen = looseness) +
  // the figure skin seam pointer (get_skin_packet/skin_polygomer). Shrink-only.
  create_game: 2012,
  // create_manji_tree / export_model re-pinned + skin_polygomer /
  // sketch_polygomer allowlisted 2026-07-17 to bless the "dream, borrow,
  // keep" batch growth (drapes channel + detail dial on manji trees, the
  // skin-projection seam pointers, the sketch_polygomer parts grammar).
  // Shrink-only from these snapshots.
  create_sketch: 4366,
  // mint_solid re-pinned 2026-09-26 (871 -> 915, hero-tune): the `via` clause names the hero door
  // ("hero — a human by cast word + proportion tune"), the one phrase a host needs to find the
  // tune from tools/list; the tune's vocabulary itself is taught in layered.md, off-payload.
  mint_solid: 915,
  create_view: 723,
  // custom_catalyst / list_catalysts / mint_catalyst allowlisted 2026-08-06 to
  // bless the local-catalyst shelf (local-catalysts.plan.md): mint_catalyst is
  // the new local-shelf write path, list_catalysts/custom_catalyst grew to
  // route curated + local origins and the mint author-guide hand-off.
  // Shrink-only from these snapshots.
  custom_catalyst: 764,
  declare_skills: 1041,
  diff_sketches: 875,
  execute_plan: 1314,
  export_beats: 1124,
  // export_game re-pinned 2026-09-03 (1253 → 1378) to bless the Unity Y1
  // clause that rode the third-engine-leg commit (`target:'unity'` routing —
  // the growth predates the greybox seam, which added only input-schema
  // bytes, not description). Shrink-only from here.
  export_game: 1378,
  // export_model re-pinned 2026-07-17: the STL print-handoff format
  // (format:'glb'|'stl' + scale → mm) rides the same tool. Re-pinned
  // 2026-08-11 to bless the animated-GLB clause (interchange.plan.md I1:
  // `clips` bakes rig clips into glTF animations). Re-pinned 2026-08-11
  // (2228 → 2285) to bless the I2 eligibility widening: posed figures,
  // carved-solid wordmarks, and css3d-turntable solids export. Shrink-only.
  export_model: 2285,
  // forge_motion re-pinned 2026-08-29 (1409 → 1560) to bless the RE-FORGE
  // door (edit-3d-recipes.plan.md Phase 3): recipe/recipe_ref make the stored
  // recipe.json a legal input, closing the last mint-once 3D family.
  // Shrink-only from here.
  forge_motion: 1560,
  forge_plan: 1167,
  forge_publications: 955,
  forward_context: 1012,
  gather: 1181,
  // get_game_vocab re-pinned 2026-09-14 to bless the sixth family clause (hud cards —
  // the screen-space UI language of hud-widgets.js: readouts / banners / legends in
  // slots + the style tokens), then again the same day for the toast (damage numbers)
  // naming in that clause. Shrink-only from here.
  get_game_vocab: 1650,
  get_image_render_packet: 708,
  get_mcp_capabilities: 890,
  get_register_kit: 731,
  get_tool_ledger: 937,
  get_worked_example: 903,
  install_scaffold: 1317,
  list_catalysts: 805,
  // measure_view re-pinned 2026-08-24: rocket-view landed as a measurable
  // kind (full-mission SI telemetry) and the description gained its one-line
  // column note. Shrink-only from here.
  measure_view: 1423,
  meta_context_brief: 963,
  mint_catalyst: 850,
  meta_context_commit: 2586,
  meta_context_declare_inventory: 1387,
  // pull_agent_task 810 -> 762 (2026-09-27): the dead host_chat kind left its description.
  pull_agent_task: 718,
  recommend_catalysts: 1027,
  recommend_kind: 922,
  recommend_mcp_orbit_compositions: 1056,
  record_mcp_capabilities: 1301,
  reference_protocol: 1708,
  run_experiment_sweep: 866,
  semantic_search: 2049,
  sketch_plan: 774,
  sketch_research: 712,
  sketch_stash: 1016,
  sketch_what_possible: 1316,
  stitch_motion: 819,
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
// Re-pinned 2026-08-06 (was 372,000; measured 374,898) to bless the
// local-catalyst shelf (local-catalysts.plan.md): mint_catalyst + the
// list_catalysts/custom_catalyst/get_catalyst growth for curated + local
// origins and the mint/graduation hand-off.
// Re-pinned 2026-08-09 (was 376,000; measured 379,549) to bless the key-free
// polygonizer handoff: get_polygonizer_packet / submit_polygonizer_manifest —
// the calling agent authors the manifest itself, no provider key.
// Re-pinned 2026-08-14 (was 381,000) to bless the save_modular_bot `llm`
// gate (0813 persona sims R2): the deployed bot's provider/key is the
// operator's explicit choice, not a silent vault default.
// RATCHETED DOWN 2026-08-15 (was 381,500; measured 250,370) — the reclaim
// from the mint_solid + science-view-fold + motion-trim consolidation passes
// (tool-list-token-load.md §6.1) had left ~131KB of slack under the old pin,
// most of it predating that work. Pinning just above actual locks the ~12K-token
// reclaim in and makes the next feature RE-PIN consciously instead of silently
// spending the space back. No tools were added in the routing-effectiveness
// work of this session — the office paradigm cards (bot/app/connected-service)
// live in meta_embeddings behind semantic_search, not in tools/list — so the
// payload is byte-identical to the consolidation baseline.
// Re-pinned 2026-08-29 (was 255,000; measured 255,660) to bless the
// iterate-surface batch (edit-3d-recipes.plan.md): update_sketch's game
// branch + broadened routing prose, mint_solid/edit_solid/create_edifice
// update_sketch pointers, and forge_motion's recipe/recipe_ref re-forge
// inputs. All additions were compressed to routing grade first (teach in
// the drawer); this blesses the ~660-byte residue.
//
// Re-pinned 2026-08-31 (256_000 -> 256_500) for the object reference target's
// routing surface: `object` in reference_protocol's target enum, the
// parts-or-segments clause on capture_reference's `insights`, and the `replace`
// fusion escape hatch. Both tool DESCRIPTIONS stayed under their allowlist
// snapshots (the segment-first and fusion contracts are taught in
// OBJECT_PROTOCOL, which rides the reference_protocol RESULT, not the list);
// this blesses the ~300-byte input-schema residue.
//
// Re-pinned 2026-09-03 (256_500 -> 257_000; measured 256,832) to bless the
// greybox seam (skin-over-mesh.plan.md phase 0): export_game's `posture`
// input-schema property (~330 bytes — the handoff-posture routing lives in
// the schema, not the description, which stayed at its allowlist snapshot
// aside from the pre-existing Unity Y1 growth blessed above).
// Re-pinned 2026-09-03 (257_000 -> 257_500; measured 257,164) to bless the
// skinned export seam (skin-over-mesh.plan.md phase 4): export_model's
// `skinned` input-schema property. Same rule — schema routing only, the
// description stayed at its allowlist snapshot.
// Re-pinned 2026-09-04 (was 257,500; measured ~260,150) to bless the mesh
// handoff (interchange-seams.plan.md seam 5): request_/pull_/submit_/accept_/
// reject_mesh_render — the durable mesh-worker bicycle on the render-request
// table (medium 'mesh'). The export_model growth of the same day (3mf / usda /
// usdz / quantize / humanoid) was trimmed to routing grade and fit under the
// old pin; the five new tools are the blessed residue.
// re-pinned 2026-09-14 (measured 261,472) for the get_game_vocab hud-family clause and the
// create_game theme token description (game-ui-primitives). Shrink-only from here.
// Re-pinned 2026-09-15 (262_000 -> 263_500; measured 263,309) to bless the update_sketch
// `patch` + `readout` input-schema properties (update-sketch-patch). Same rule as the greybox
// and skinned seams: the op grammar is taught in the schema, and the description itself was
// re-cut to stay under its 700-char ceiling (it is NOT on the allowlist).
// Re-pinned 2026-09-22 (263_500 -> 264_500; measured 264,054) to bless remote-worker exports:
// export_model's `bundle` format (enum + one description sentence), the `cdn` property on the
// html leg, and the sentence saying every written result carries `handoff` + `fits`. The
// export_model description itself stays under its 2,285 allowlist pin.
// Re-pinned 2026-09-22 (263_500 -> 265_000; measured 264,304) for the house pointers on
// create_sketch / compose_world / mint_solid and the `floorplan` entry in create_sketch's
// manifest.kind schema list (house-compose-language). Shrink-only from here.
// Merged 2026-09-22: both growths land together (remote-worker exports + house pointers);
// pinned 265_500 for their sum. Shrink-only from here.
// Re-pinned 2026-09-26 (265_500 -> 266_000; measured 265,684) for the hero door (hero-tune): the
// `via: 'hero'` clause on mint_solid's description and its one-sentence entry in the `via` schema
// description. The tune keys, moves and ranges live in layered.md, off-payload. Shrink-only from here.
// Re-pinned 2026-09-27 (266_000 -> 295_500; measured 295,201) for tool annotations (directory policy
// 5.E): every entry now carries a top-level `title` and `annotations` { title, readOnlyHint,
// destructiveHint, idempotentHint, openWorldHint } from lib/mcp/tool-annotations.js, about 165 bytes
// per tool. No description grew past its budget. Shrink-only from here.
// Checked 2026-09-27 for the chatbot carve-out's rehomed tools (pin unchanged; measured 295,324).
// This pin is measured with the chatbot pack on (vitest.setup.js), so moving list_running,
// list_env, set_env, delete_env and recommend_kind out of the bot packs only reorders it. On a
// default install those five tools now list, about 4 KB more than before.
// Re-pinned 2026-09-28 (295_500 -> 267_500; measured 267,031, 148 tools) for the chatbot carve-out
// (3.0.0): the bot factory's tools left the registry, custom_protocol and the two chat_turn tools
// with them, and the retained descriptions stopped naming them. Shrink-only from here.
// Re-pinned 2026-09-29 (267_500 -> 267_619; +119 measured, 267,211 -> 267,330) for the stroke fixes
// (rel/fix-stroke): update_sketch's patch schema lists the `solve` op its handler runs, with a one-line
// `from` property, and its description gets back "Re-mint only for a side-by-side variant." and the
// unaudited-levels note inside its 700-char ceiling. Pin moved by the measured growth, headroom unchanged.
// Re-pinned 2026-09-29 (267_619 -> 267_588; -31 measured, 267,330 -> 267,299) for the same branch:
// create_sketch's manifest schema drops `required: ['title', 'viewBox']`, which bound diagrams only (the
// diagram validator still refuses a diagram without them) and refused an exported world recipe's restore.
// Not re-pinned (2026-09-30, rel/combine): the post-freeze lines' own growth is inside the pin — export_model's
// format 'ifc' (the enum value and one sentence, about +87 B, building materials) and the hero door's armour, gear
// and anime words (fantasy equipment, form articulation); create_solid_turntable's surface names that 'crystal'
// belongs to the crystal shape (+37 B).
// Re-pinned 2026-10-04 (267_588 -> 267_900; measured 267,877) for flame-depiction: export_model's format 'blender'
// (the Blender pack the export-blender CLI writes, a world's fire in it for a Cycles still: the enum value, one
// sentence, and the `fire_t` / `fire_detail` properties).
// Re-pinned 2026-10-05 (267_900 -> 268_200; measured 268,159) for historic entries: get_view_vocab names the
// encyclopedia entry family (a description clause, the `entry` enum value, the id hint) and create_sketch's
// manifest property names the `historic` kind and where its starters live. No per-entry text anywhere.
// Re-pinned 2026-10-05 (268_200 -> 268_400; measured 268,358) merging 1005-figure-consolidation into the release
// candidate: export_model's `rest` property (the emote bridge's T-pose mold, 'authored' | 'tpose', one sentence) is
// the growth. Each figure branch was inside its own 267_588 pin; only the sum crossed this one.
// Re-pinned 2026-10-05 (268_400 -> 268_800; measured 268,759) for the field score: create_beats takes
// `score: { mood, seed?, game?, role? }` (the mood and role enums, one sentence each in the description and the
// property). The description itself shrank to stay under its 1150 allowlist (dropped a stale "new work" line).
// Re-pinned 2026-10-06 (268_800 -> 268_900) for loop points: export_beats' `loop` property (one sentence).
// Re-pinned 2026-10-06 (268_900 -> 269_300; measured 269,246) for the industrial study's drawing leg: export_model's
// 'dxf' / 'svg' formats (two enum values and one sentence) and the `slice_z` / `part` properties that cut a scad row
// into a flat drawing. The mechanical library itself is off-payload (the scad card).
// Re-pinned 2026-10-06 (269_300 -> 269_600; measured 269,450) for the rigidity sensor: measure_solid's `strength`
// property (one sentence). The material table, the element checks and the reading live off-payload (the scad card).
const PAYLOAD_CEILING = 269_600;

async function listedTools() {
  const { ensureToolsRegistered, listTools } = await import('@/lib/mcp/server');
  await ensureToolsRegistered();
  // This file pins the FLAT connect surface (the 255KB payload + per-tool
  // description ratchet). Packs mode (now the default) would shrink tools/list
  // to spine + packs and let the ratchet go dark, so force flat here.
  const prevPacks = process.env.MOJULO_TOOL_PACKS;
  process.env.MOJULO_TOOL_PACKS = 'off';
  try {
    return listTools();
  } finally {
    if (prevPacks === undefined) delete process.env.MOJULO_TOOL_PACKS;
    else process.env.MOJULO_TOOL_PACKS = prevPacks;
  }
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

// A host that validates arguments against the listed inputSchema refuses an op the schema does not declare, so
// the schema must list every op the handler takes: update_sketch's layered `solve` op (layered-strokes.js).
describe('the sketch tools list schemas that admit what their handlers take', () => {
  // the subset of JSON Schema the patch items use: type, enum, properties, required, additionalProperties
  const accepts = (schema, v) => {
    if (schema.type === 'object') {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
      if ((schema.required || []).some((k) => !(k in v))) return false;
      return Object.entries(v).every(([k, x]) => (schema.properties?.[k] ? accepts(schema.properties[k], x) : schema.additionalProperties !== false));
    }
    if (schema.enum && !schema.enum.includes(v)) return false;
    return schema.type === undefined || (schema.type === 'string' ? typeof v === 'string' : schema.type === 'number' ? Number.isFinite(v) : true);
  };
  it('the patch item schema accepts a solve op and declares its `from`', async () => {
    const item = (await listedTools()).find((t) => t.name === 'update_sketch').inputSchema.properties.patch.items;
    expect(item.properties.op.enum).toEqual(['set', 'remove', 'add', 'solve']);
    expect(item.properties.from).toMatchObject({ type: 'string', description: expect.stringContaining('/strokes/<id>') });
    expect(accepts(item, { op: 'solve', from: '/strokes/s1' })).toBe(true);
    expect(accepts(item, { op: 'solve', from: '/strokes/b1', amp: 0.1, radius: 0.4 })).toBe(true);
    expect(accepts(item, { op: 'set', path: '/strokes/-', value: { id: 's1' } })).toBe(true);
    expect(accepts(item, { op: 'merge', path: '/x' })).toBe(false);   // the check itself refuses an undeclared op
  });
  it('create_sketch\'s manifest schema admits an exported world recipe; the handler still holds a diagram to title + viewBox', async () => {
    const manifest = (await listedTools()).find((t) => t.name === 'create_sketch').inputSchema.properties.manifest;
    expect(accepts(manifest, { kind: 'workbench', lathes: [{ id: 'cup', profile: [[0, 0], [0.04, 0], [0.04, 0.1]] }] })).toBe(true);
    expect(accepts(manifest, { title: 'Flow', viewBox: { width: 400, height: 200 }, stations: [] })).toBe(true);
    const { createSketchHandler } = await import('./sketches.js');
    await expect(createSketchHandler({ title: 'Flow', manifest: { title: 'Flow', stations: [{ id: 'a', kind: 'process', label: 'A' }] } })).rejects.toThrow(/manifest\.viewBox is required/);
  });
  it('the description keeps its iterate-in-place guidance beside the stroke pointer', async () => {
    const d = (await listedTools()).find((t) => t.name === 'update_sketch').description;
    expect(d).toContain('Re-mint only for a side-by-side variant.'); expect(d).toContain('new levels unaudited');
    expect(d).toContain("`strokes` + op 'solve' (get_solid_vocab layered)");
  });
});
