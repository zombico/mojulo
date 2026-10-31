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
  // 2026-10-10 (3.1.0): the office wing left the tool surface (RETIRED_PACKS in packs.js), so
  // bind_primitives, bind_trigger, declare_skills, install_scaffold, meta_context_commit and
  // recommend_mcp_orbit_compositions are unlisted and their entries are deleted; forward_context's
  // description lost its two-wing paragraph (now 541, under the ceiling) and leaves the list.
  // Ratcheted 2026-09-28 for the chatbot carve-out (3.0.0): these descriptions stopped naming the
  // bot factory (bot scopes, fleet modes, chat_turn, the bot trace, the bot-bound commit), so each
  // pin drops to its new length: forward_context 1081 -> 1012, get_worked_example 946 -> 903,
  // list_catalysts 833 -> 805, meta_context_brief 972 -> 963, meta_context_commit 2635 -> 2586,
  // meta_context_declare_inventory 1405 -> 1387, pull_agent_task 762 -> 718,
  // recommend_catalysts 1042 -> 1027.
  bind_research_item: 1233,
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
  cook: 1093,
  // create_beats / create_figure / export_beats / get_image_render_packet
  // re-pinned 2026-07-13 to bless visualization-layer branch growth measured
  // at the Mojulo Voice landing (figure garment/setup dials, beats export
  // midi handoff, render-packet control-scaffold pointer). Shrink-only.
  create_beats: 1150,
  // create_character joins 2026-10-31 (1030-broadcasting-personas) at 730 for one clause: `as: 'persona'`, a hero who
  // reads scripts (a record of its own, persona/persona.js); its spec and registers live on the `persona` card, off-payload.
  create_character: 730,
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
  diff_sketches: 875,
  execute_plan: 1314,
  export_beats: 1124,
  // export_game re-pinned 2026-09-03 (1253 → 1378) to bless the Unity Y1
  // clause that rode the third-engine-leg commit (`target:'unity'` routing —
  // the growth predates the greybox seam, which added only input-schema
  // bytes, not description). Shrink-only from here. Lowered 2026-10-15 (1378 -> 1290, 1015-desktop-export): the
  // desktop target's clause rode in on a tighter wording of the rest.
  export_game: 1290,
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
  gather: 1181,
  // get_game_vocab re-pinned 2026-09-14 to bless the sixth family clause (hud cards —
  // the screen-space UI language of hud-widgets.js: readouts / banners / legends in
  // slots + the style tokens), then again the same day for the toast (damage numbers)
  // naming in that clause. Shrink-only from here. Shrunk 2026-10-09 (1650 -> 858) when the game book's rail took
  // the lead: the families became one clause of machinery, and the rail's guide, page cards and samples are off-payload.
  get_game_vocab: 858,
  get_image_render_packet: 708,
  get_mcp_capabilities: 890,
  get_register_kit: 731,
  get_tool_ledger: 937,
  get_worked_example: 903,
  list_catalysts: 805,
  // measure_view re-pinned 2026-08-24: rocket-view landed as a measurable
  // kind (full-mission SI telemetry) and the description gained its one-line
  // column note. Shrink-only from here.
  measure_view: 1423,
  mint_catalyst: 850,
  meta_context_declare_inventory: 1387,
  // pull_agent_task 810 -> 762 (2026-09-27): the dead host_chat kind left its description.
  pull_agent_task: 718,
  recommend_catalysts: 1027,
  recommend_kind: 922,
  record_mcp_capabilities: 1301,
  reference_protocol: 1708,
  semantic_search: 2049,
  sketch_plan: 774,
  sketch_research: 712,
  sketch_stash: 817,
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
// RATCHETED DOWN 2026-10-06 (268_400 -> 254_600; measured 254,516) for the create_sketch diet: its listing
// went from 15,532 to 1,690 bytes. The diagram / marks / routing manual moved to the sketch_vocab cards
// `mark-primitives`, `construction-marks` and `edge-notation`. `bucket` and `preloadMetadata` are still
// accepted but no longer listed, and the description fits the 700-char ceiling (its allowlist entry is gone).
// Pinned just above actual so the next feature re-pins consciously. Shrink-only from here.
// Merged into the release candidate 2026-10-06 (268_900 -> 255_100; measured 255,009): the diet above plus
// the field score and loop points already on the candidate.
// RATCHETED DOWN 2026-10-06 (268_900 -> 256_800; measured 256,767) for the cook diet: cook's listing went
// from 16,227 to 4,321 bytes. Each publication kind's layout guide left the schema for PUBLICATION_GUIDE in
// cook.js, returned by sketch_stash({ target_kind }) for the one kind being published; the deprecated
// `template` alias is still accepted but no longer listed. Shrink-only from here.
// RATCHETED DOWN 2026-10-06 (256_800 -> 251_600; measured 251,525) for the contextmap trim: meta_context_commit
// 7,144 -> 3,283 bytes, meta_context_brief 1,700 -> 912, meta_context_analyze 1,413 -> 826. The 2.x
// `bot` brief scope still reads but is no longer listed.
// Merged into the release candidate 2026-10-06 (255_100 -> 237_700; measured 237,662): the create_sketch diet,
// the cook diet and the contextmap trim together.
// Merged with the building ladder 2026-10-06 (237_700 -> 238_700; measured 237,662 -> 238,593): mint_building's
// entry, less the house redirects it let create_sketch, mint_solid and compose_world drop.
// Re-pinned 2026-10-06 (268_900 -> 269_300; measured 269,246) for the industrial study's drawing leg: export_model's
// 'dxf' / 'svg' formats (two enum values and one sentence) and the `slice_z` / `part` properties that cut a scad row
// into a flat drawing. The mechanical library itself is off-payload (the scad card).
// Re-pinned 2026-10-06 (269_300 -> 269_600; measured 269,450) for the rigidity sensor: measure_solid's `strength`
// property (one sentence). The material table, the element checks and the reading live off-payload (the scad card).
// Re-pinned 2026-10-06 (-> 269_600 held; measured 269,543) on merging the rigidity sensor with industrial motion:
// measure_solid's `motion` boolean (one short property line) joins `strength`. The `mechanism` contract rides
// mint_solid's free-form spec and the scad card.
// Merged with the industrial study 2026-10-06 (238_700 -> 239_300; measured 238,593 -> 239,264): export_model's dxf/svg
// leg and measure_solid's `strength` and `motion` properties.
// Re-pinned 2026-10-06 (239_300 -> 239_400; measured 239,264 -> 239,327) for the scad ladder: get_solid_vocab's
// `section` property and one sentence on the sections menu. The six sections themselves are off-payload.
// Re-pinned 2026-10-06 (239_400 -> 240_600; measured 240,518 with the scad ladder merged) for fabricate_solid (1006-fabricator): one new tool,
// ~1,200 bytes with its schema cut to routing grade and its annotation title. The job words, need fields, inventory and provenance rule are
// off-payload (the `fabricate` solid-vocab card and the fabricate-parts routing card).
// Re-pinned 2026-10-06 (240_600 -> 240_700; measured 240,518 -> 240,600) for the bill-of-materials export (1006-fabricator-sizing):
// export_model's 'bom' format, one enum word and one clause. Sizing's need fields are off-payload (the `fabricate` card).
// Re-pinned 2026-10-07 (240_700 -> 240_900; measured 240,809) for the Blender film: forge_motion's `export` gains
// 'blender', one enum word and one clause. The pack, the scripts and the CLI are off-payload (the `blender-film` card).
// Re-pinned 2026-10-08 (240_900 -> 241_700; measured 241,592) for Playscape UI: one new drawer, get_play_vocab (the
// play ladder, scaled to the ask), its description cut to routing grade. The cards themselves are off-payload.
// Re-pinned 2026-10-09 (241_700 -> 242_400; measured 242,317) for the game rail: one new tool, design_game (~1,385 bytes,
// its schema cut to bare names), net of get_game_vocab shrinking ~800 the same day. Its guide, page cards and samples are
// off-payload (get_game_vocab's rail).
// Re-pinned 2026-10-10 (242_400 -> 208_300; measured 208,224) for 3.1.0's positioning: the office wing left the
// tool surface (apps, daemons, contextmap, mcp-orbit, triggers, primitive binding: RETIRED_PACKS in packs.js, still
// callable by name) and forward_context's description lost its two-wing paragraph.
// Re-pinned 2026-10-10 (208_300 -> 209_800; measured 209,691) for the Characters ring: one new tool, create_character
// (a door over mint_solid's layered and animal kinds), its description at routing grade; its manuals stay off-payload.
// Re-pinned 2026-10-10 (209_800 -> 210_300; measured 210,234) for readouts that become ids: `detail` on the six vocab
// readers (their no-id listings fell from 188 KB to 93 KB in all), `full` on measure_solid (a repeat in a session names
// the earlier reading) and `readout` on design_game. Each word buys back far more than it costs, off this payload.
// Re-pinned 2026-10-10 (210_300 -> 202_500; measured 202,411) for the Workflows phase: render_handoff({ medium, op })
// is the one listed door over the image and mesh worker loops (the ten per-op names stay callable, unlisted), net of
// run_experiment_sweep's variations form, fabricate_solid's `bodies` and cook's `items`.
// Re-pinned 2026-10-11 (202_500 -> 202_800; measured 202,722) for two branches merged the same day: the structure
// book (export_model's `sheets` and `schedules` formats; mint_building's description led on the book and its outcome
// `next`) and the solid ladder (mint_solid names `spec.ask`, look | fit | function | engineered, which caps `next`,
// with its kinds grouped by purpose). No new tool.
// Re-pinned 2026-10-11 (202_800 -> 203_000; measured 202,872) for the structure book broadened: mint_building's
// description and its manifest's schema line name the store, restaurant and mall it now mints (kind and the one field
// each needs). No new tool.
// Re-pinned 2026-10-11 (203_000 -> 203_300; measured 203,145) for buildings as game levels: mint_building names the
// office kind and `level: { goal }` (any building played as a level), create_game's levels say a building with
// `level` is one. No new tool.
// Re-pinned 2026-10-12 (203_300 -> 203_500; measured 203,368) for game buildings' doors: create_game takes `links`,
// door links between levels (a building whose scene changes at its door). No new tool.
// Re-pinned 2026-10-12 (202_800 -> 204_300; measured 204,250) for asset receipts: two new tools, sign_asset and
// verify_asset (pack_stash), the creator's signed receipt for an exported file.
// Re-pinned 2026-10-12 (204_300 -> 204_500; measured 204,367) for create_game's `shell: 'play'`, the light play shell design_game's
// games ship in (play-shell.js). No new tool.
// Re-pinned 2026-10-12 (204_500 -> 205_200; measured 205,013) for the merge of the two lines above (1011-structure-rails-broaden
// into the play shell's line): both sets of additions together. No new tool.
// Re-pinned 2026-10-12 (202_800 -> 204_200; measured 204,082) for one new tool, tune_ground: a gameworld level's ground
// authored in its own space (dials and edits on a top-down grid, a heartbeat laid or exported), apart from the geocube
// and from design_game's patch.
// Re-pinned 2026-10-12 (205_200 -> 206_600; measured 206,373) for the merge of the worldbible line (tune_ground) into the consolidated line above:
// both sets of additions together. One new tool (tune_ground).
// Re-pinned 2026-10-11 (202_800 -> 204_400; measured 204,282) for character harmonization: one new tool,
// update_character (the Characters ring's revise door over update_sketch: a hero's words, its target resolution, the geocube
// whose light bakes it), its description at routing grade; the density rule and the cube stay off-payload.
// Re-pinned 2026-10-13 (206_600 -> 208_300; measured 208,152) for the merge of 1012-consolidate into the character line: update_character
// (above) and tune_ground together. No new tool beyond those two.
// Re-pinned 2026-10-13 (206_600 -> 206_900; measured 206,733) for the merge of 1012-model-tiering into the consolidated
// line: pull_agent_task's optional `tiers` filter on top of the line's own additions. No new tool.
// Re-pinned 2026-10-13 (208_300 -> 208_700; measured 208,401) for the merge of 1012-consolidate (the model tiering) into
// the character line: update_character, tune_ground and pull_agent_task's `tiers` together. No new tool.
// Re-pinned 2026-10-13 (208_700 -> 209_300; measured 209,092) for the game menus line merged onto 1012-consolidate: create_cover's `format` (a game's key art,
// capsule, box, icon) and `art` (an uploaded stash picture as the illustration, the plugin profile's way to real art),
// and create_game's `front` (the light shell's title over a cover, start menu, credits, end). No new tool.
// Re-pinned 2026-10-14 (209_300 -> 203_900; measured 203,721) for UI on rails, merged over the game menus: the five
// game-project tools retired (RETIRED_PACKS' pack_game_projects, still callable by name), and project_ref's
// descriptions cut to a legacy line.
// Re-pinned 2026-10-14 (203_900 -> 204_200; measured 203,928) for the character stitch merged over UI on rails:
// create_character's `egocube` and `years` (a character made from a stored Egocube sheet, at an age on its thread),
// update_character's merge said in its description. No new tool.
// Re-pinned 2026-10-14 (204_200 -> 207_600; measured 207,398) for the shoot plan merged over the character stitch: two NEW tools,
// create_shoot_plan and update_shoot_plan (a world's cameras as visible keyed objects in After Effects terms, its set
// pieces, transitions, portals and event cuts; on its branch they measured +3,564 over its base), and forge_motion's
// 'plan' motion.
// Re-pinned 2026-10-14 (207_600 -> 209_900; measured 209,677) for 1014-interior-designer merged over the shoot plan:
// design_interior, the interior designer's door in the building pack (one new listed tool, its schema trimmed to names
// and shapes; on its branch it measured +2,279 over its base).
// Re-pinned 2026-10-14 (209_900 -> 212_600; measured 212,339) for the color theorist: one new tool, pick_palette (a palette
// solved for what a world is: key, chroma, scheme, ramps, checks), and a `palette` on create_game (the HUD solved
// under the theme) and create_cover (a spec beside the { bg, accent, ink } it took).
// Re-pinned 2026-10-14 (212_600 -> 212_900; measured 212,673) for the color theorist's C2: design_interior's `palette`
// (a room's 60-30-10 solved, its card's forms kept) and pick_palette naming it and a stage's art.palette.from.
// Re-pinned 2026-10-14 (212_900 -> 213_400; measured 213,128) for the color theorist's C3: pick_palette's `shift` (a
// palette moved, its identity kept) and `script` (a world's palette moved level by level along an arc).
// Re-pinned 2026-10-14 (213_400 -> 213_700; measured 213,449) for the color theorist's air: pick_palette's `air` (thin,
// none: a void for a sky) and `preset` (moon, asteroid-belt, mars, icy-moon, station, deep-space).
// Lowered 2026-10-15 (213_700 -> 210_800; measured 210,537) for 1015-tool-consolidation: the shoot plan folded into forge_motion.
// Raised 2026-10-15 (210_800 -> 211_100; measured 210,856) for the flight palette: four earth presets in pick_palette's
// `preset` enum (the palette's own list, a place a flight world names) and its line naming them.
// Raised 2026-10-15 (211_100 -> 211_300; measured 211,171) for the level demo: design_game's `compose` (the interpreter as a
// door: a world read from a few words), one schema property and its clause in the description. No new tool.
// Raised 2026-10-19 (211_300 -> 211_600; measured 211,490) for traditional board games: create_game's `tabletop` (chess,
// checkers or a game written out, played against the computer as its own page), one schema property. No new tool.
// Raised 2026-10-19 (211_600 -> 211_800; measured 211,664) merging the strategy board with the board games: create_game's
// `final` (the game's last level, its first win completing it) beside `tabletop`, each pinned on its own branch. No new tool.
// Raised 2026-10-19 (211_800 -> 212_000; measured 211,872) merging 1019-resolution-lock over the strategy board: the mobile
// genres' create_pixelizer_game `saga` (the match-3 saga) and its tool line, each pinned against the release on its own
// branch. No new tool.
// Held 2026-10-20 at 212_000 (measured 211,923) merging 1019-science-worlds: create_view's `kind` gains 'classical',
// 'microscopic', 'quantum' and 'relativistic' (laws composed into a demo, each an argument on the view door; on its own
// branch it raised the pin 211_300 -> 211_500). No new tool.
// Raised 2026-10-20 on 1024-geocube-composition-update (211_800 -> 212_000; measured 211,867) for geocube styles:
// pick_palette's `values` (value groups, the land in two or three masses of value), one schema property. No new tool.
// Held 2026-10-25 at 212_000 (measured 211,919) merging 1024-geocube-composition-update over 1023-consolidated: both
// lines' additions together fit under the pin. No new tool.
// Raised 2026-10-26 on 1026-gen7-form (212_000 -> 212_300; measured 212,161) for the era as a render: export_game's
// `era` (the same game's pages drawn in another era than its cube's), one schema property. No new tool.
// Raised 2026-10-27 on 1027-tabletop-rpg-gen (212_300 -> 212_500; measured 212,353) for the table game: create_game's
// `table_rpg` (a pen-and-paper RPG played in text, its characters rolled, its book printed), one schema property, its
// grammar on the vocab card. No new tool.
const PAYLOAD_CEILING = 212_500;

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
  }, 180_000);   // the first here to register every tool: 35-45 s with nothing cached, past the 30 s default

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
    // a PLACED station still needs a viewBox (an unplaced flow is auto-placed and gets one fitted)
    await expect(createSketchHandler({ title: 'Flow', manifest: { title: 'Flow', stations: [{ id: 'a', kind: 'mcp_tool', label: 'A', x: 0, y: 0, w: 100, h: 40 }] } })).rejects.toThrow(/manifest\.viewBox is required/);
  });
  it('the description keeps its iterate-in-place guidance beside the stroke pointer', async () => {
    const d = (await listedTools()).find((t) => t.name === 'update_sketch').description;
    expect(d).toContain('Re-mint only for a side-by-side variant.'); expect(d).toContain('new levels unaudited');
    expect(d).toContain("`strokes` + op 'solve' (get_solid_vocab layered)");
  });
});
