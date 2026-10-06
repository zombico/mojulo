/**
 * Tool packs — the consolidated tools/list surface (tool-packs.plan.md P1-R/P2-D).
 *
 * Pure data. Two top-level imports: lib/version/distribution.js, which writes the
 * install commands the advisories name (the running version, and the plugin's
 * or the checkout's form), and ./plugin-profile.js, whose text edits give a pack
 * its description under the Claude plugin profile (`profileEdits` below, applied
 * once at load; tools/list shows them only under that profile). The install axis
 * below does one local, import-free
 * filesystem probe to detect physical pack presence — see `installedGroups`.
 * This module is the partition of the listed tool
 * registry into a small SPINE (always listed with full schemas) plus ~20
 * PACKS, each listed as ONE stateless dispatcher tool whose description is
 * its recognizer. In packs mode (MOJULO_TOOL_PACKS=on) connect-time
 * tools/list returns spine + pack tools only; a pack called bare returns its
 * orientation body + member menu, `{ manual }` returns members' manuals, and
 * called with { tool, args } it dispatches
 * to the member server-side. Flat mode (default) is byte-identical to the
 * un-packed surface — pack tools register listed:false there, so dispatch
 * works everywhere but costs nothing at connect.
 *
 * Partition rules (enforced by packs.test.js):
 *  - every listed tool is in exactly ONE pack's `members`, or in SPINE, or
 *    in FOLDED (listed in flat mode, dropped in packs mode);
 *  - `shared` entries are tools HOMED elsewhere that this pack's unveil
 *    manual also lists and its dispatcher also accepts — kept deliberately
 *    tiny (composition normally rides refs-in-args, not shared dispatch);
 *  - pack descriptions fit PACK_DESCRIPTION_CEILING (the house 700 ratchet).
 *
 * Studio pack bodies are NOT authored here — `form` names the FORM_TOOLSETS
 * entry (lib/mcp/tools/context.js) whose body the unveil serves, so the
 * prose has one source. Office packs carry a short `body` here; the
 * generated member menu (and `manual` on demand) is the meat either way.
 */

import { mojuloCommand, runMojulo } from '../version/distribution.js';
import { profileEdit } from './plugin-profile.js';

export const PACK_DESCRIPTION_CEILING = 700;

// Always listed with full schemas, both modes.
export const SPINE = [
  'forward_context',
  'semantic_search',
  'get_tool_index',
  'get_register_kit',
  'get_worked_example',
  'get_ui_map',
  'get_substrate',
  'get_tool_ledger',
  'version',
  'check_for_updates',
  // mint_diagram — the KERNEL diagram maker (kernel-diagram-surface.plan.md).
  // Spine, not a pack: "a diagram is just SVG," so it stays available even in an
  // install without the creative pack. create_sketch (pack_diagram, studio) is
  // the creative superset; both delegate diagram validation to lib/diagram-core.
  'mint_diagram',
];

// Listed in flat mode; dropped from tools/list in packs mode (still callable).
// get_creative_toolset folds because its {form} bodies ARE the studio packs'
// unveil bodies and its no-arg form map is redundant with the pack
// descriptions sitting in the connect payload.
export const FOLDED = ['get_creative_toolset'];

export const PACKS = [
  // ── studio (bodies from FORM_TOOLSETS via `form`) ─────────────────────────
  // Listed FIRST, 3D packs leading: tools/list and `npx mojulo tools` read this
  // order, and a stranger's first screen should be the factory, not the office.
  {
    id: 'pack_object',
    wing: 'studio',
    installGroup: 'creative',
    form: 'object',
    title: '3D solids, figures & objects',
    description:
      "3D SOLIDS — figures, creatures, objects, buildings, wordmarks, vehicles, OpenSCAD: mint_solid (kinds figure / manji-tree / workbench / scad (an OpenSCAD program) / assembler / carved-solid / solid-turntable / edifice / vehicle), edit_solid (skin / emote ops), measure_solid, verify_machina. Open for 'model a wine glass true to size', 'a woman mid-stride', 'our logo in shiny chrome', 'a 3D creature', 'a bracket with bolt holes in OpenSCAD', 'put the wheels and the chassis together', 'turn this concept art into a 3D model'. Placing solids IN an environment is pack_world. A house is pack_building; edifice is the institutional one-off.",
    members: ['mint_solid', 'edit_solid', 'get_solid_vocab', 'measure_solid', 'verify_machina'],
    // The Claude plugin profile leaves out the skin op and the concept-art dream loop
    // (lib/mcp/plugin-profile.js).
    profileEdits: [
      ['edit_solid (skin / emote ops)', 'edit_solid (the emote op)'],
      [", 'turn this concept art into a 3D model'", ''],
    ],
  },
  {
    id: 'pack_world',
    wing: 'studio',
    installGroup: 'creative',
    form: 'world',
    title: 'Worlds (traversable)',
    description:
      "WORLDS — traversable three.js environments: compose_world (BASE × THEME × overrides — city, transport-hub, controllable, action, planetary, painted-landscape, math, school, dungeon), theme packs, glTF export (export_model), binding refined meshes back (bind_mesh_render), and modeler-lingo translation. Open for 'build a little town I can wander around', 'an airport', 'a game where I drive', 'export to Blender'. A house is pack_building.",
    members: ['compose_world', 'list_world_themes', 'export_model', 'bind_mesh_render', 'translate_modeler_lingo'],
    // The Claude plugin profile leaves out bind_mesh_render (lib/mcp/plugin-profile.js).
    profileEdits: [[', binding refined meshes back (bind_mesh_render),', ',']],
  },
  {
    id: 'pack_building',
    wing: 'studio',
    installGroup: 'creative',
    form: 'building',
    title: 'Buildings (houses)',
    description:
      "BUILDINGS — walkable houses, apartments and furnished rooms, built up in steps: mint_building, then furnishing / storeys, framing / roof / drainage, and IFC for BIM tools (export_model). Each result's `next` names the next steps' cards. Open for 'design me a two-storey house', 'a 20 by 24 living room', 'frame the house', 'the house as IFC for Revit'. An institutional one-off is pack_object (edifice).",
    members: ['mint_building'],
    shared: ['update_sketch', 'get_sketch_vocab', 'export_model'],
  },
  {
    id: 'pack_game',
    wing: 'studio',
    installGroup: 'creative',
    form: 'game',
    title: 'Game',
    description:
      "GAMES — playable standalone artifacts composed over media: create_game (levels are worlds minted with a game contract), pixelizer 2D reducer games, sprite sheets (create + bake), game projects (create / get / update / bind / list), game-vocab cards, and export_game (self-contained folder). Open for 'a playable dungeon crawler I can actually walk around in', 'a roguelike where my gear persists across floors', 'a pixel-art game with sprites', 'a pixel-art cutscene of my hero', 'export my game so a friend can play it'.",
    members: [
      'create_game',
      'create_pixelizer_game',
      'create_sprite_sheet',
      'bake_sprite_sheet',
      'create_game_project',
      'get_game_project',
      'update_game_project',
      'bind_to_game_project',
      'list_game_projects',
      'get_game_vocab',
      'export_game',
    ],
    // The Claude plugin profile leaves out the sprite sheets, painted through the image-render
    // handoff, and the painted pixel-art cutscene (lib/mcp/plugin-profile.js).
    profileEdits: [
      [' sprite sheets (create + bake),', ''],
      [" 'a pixel-art cutscene of my hero',", ''],
    ],
  },
  {
    id: 'pack_view',
    wing: 'studio',
    installGroup: 'creative',
    form: 'view',
    title: 'Study views (science / math / bio)',
    description:
      "STUDY VIEWS — animated 3D study objects that teach a phenomenon: create_view kinds across science / math / bio, view-vocab parameter manuals, measure_view for SI-honest time-series read-back from the stored recipe, and save_recipe to KEEP a tuned setup in the operator's cookbook (view and beats recipes alike), recallable by intent later. Open for 'help my kid understand black holes', 'an animated science explainer for my kid', 'animate how DNA copies itself', 'measure the orbit', 'save this setup for my class'.",
    members: ['create_view', 'get_view_vocab', 'measure_view', 'save_recipe'],
  },
  {
    id: 'pack_motion',
    wing: 'studio',
    installGroup: 'creative',
    form: 'motion',
    forms: ['motion', 'motion-comic'],
    title: 'Motion, film & motion-comic',
    description:
      "MOTION & FILM (+ motion-comic) — add TIME to a static subject: forge_motion (camera moves and performances rendered to flipbook SVG + GIF), stitch_motion (clips → one film), motion-vocab cards, and the click-gated motion-comic authored via update_sketch. Open for 'give me a spinning view of that molecule', 'record the hero clearing the chasm and show me the clip', 'walk to the exit to check the level is beatable' (traversal proof), 'present these charts one after another as a click-through deck', 'merge the clips into a single movie'.",
    members: ['forge_motion', 'stitch_motion', 'get_motion_vocab'],
    shared: ['update_sketch', 'get_sketch_vocab'],
  },
  {
    id: 'pack_audio',
    wing: 'studio',
    installGroup: 'creative',
    form: 'audio',
    title: 'Audio — Mojulo Beats',
    description:
      "AUDIO — Mojulo Beats: synthesized soundtracks, compositions, grooves and SFX as tiny seeded recipes (never samples): create / get / update / annotate / diff / export beats plus beats-vocab cards; a composition can SING via a voice part. Open for 'background music for the forest level', 'a sting when the boss appears', \"tweak bar 2's kick\", 'render the tune to a WAV'.",
    members: [
      'create_beats',
      'get_beats',
      'update_beats',
      'annotate_beats',
      'diff_beats',
      'export_beats',
      'get_beats_vocab',
    ],
  },
  {
    id: 'pack_voice',
    wing: 'studio',
    installGroup: 'creative',
    form: 'voice',
    title: 'Voice — Mojulo Voice',
    description:
      "VOICE — deterministic voice registers (confidence × depth resolved to Kokoro blend weights, pure math): create / read a voice, bind worker-rendered WAV samples, and the voice-vocab drawer. Scope is voiceover and narration, not character acting. Open for 'a warm narrator voice', 'render this line in her voice', 'design how the guide sounds'.",
    members: ['create_voice', 'get_voice', 'bind_voice_sample', 'get_voice_vocab'],
  },
  {
    id: 'pack_illustration',
    wing: 'studio',
    installGroup: 'creative',
    form: 'illustration',
    title: 'Scene & figure illustration',
    description:
      "Painted scene & figure ILLUSTRATION + publication covers: the inverse-stable-diffusion knob-resolution loop (sketch_what_possible) that feeds create_sketch recipe families, and create_cover for title art composed under one art direction. Open for 'paint a moody mountain valley', 'illustrate my hero', 'a cover for this book', 'a graphic novel I click through page by page'. Sketch minting is homed in pack_diagram; this pack dispatches it too.",
    members: ['sketch_what_possible', 'create_cover'],
    shared: ['create_sketch', 'update_sketch'],
  },
  {
    id: 'pack_reference',
    wing: 'studio',
    installGroup: 'creative',
    form: 'reference',
    title: 'Visual reference (from a photo)',
    description:
      "VISUAL REFERENCE — read a photo YOU can see into mojulo dials: reference_protocol hands the extraction protocol (scene perspective or human pose — you are the vision adapter, no image sent), capture_reference files the read as a reusable cage + insights in a stash. Open for 'recreate the camera angle from this photo', 'match this pose'.",
    members: ['reference_protocol', 'capture_reference'],
  },
  {
    id: 'pack_image_render',
    wing: 'studio',
    installGroup: 'creative',
    form: 'image-render',
    title: 'AI-image render pipeline',
    description:
      "AI-IMAGE + MESH RENDER pipeline — direct, queue, and gate externally-painted images and externally-sculpted meshes (the mesh quartet parks a greybox for Meshy / Tripo / Hunyuan3D…): render packets for image-outcome / comic / character-sheet sketches, the durable request → pull → submit → accept / reject worker loop, and binding finished PNGs and character sheets back onto their sketches. Open for 'have the image model paint this', 'an AI-painted portrait rendered by an image model', 'run the render queue', 'accept that render'.",
    members: [
      'get_image_render_packet',
      'request_image_render',
      'pull_image_render',
      'submit_image_render',
      'accept_image_render',
      'reject_image_render',
      'bind_image_render',
      'request_mesh_render',
      'pull_mesh_render',
      'submit_mesh_render',
      'accept_mesh_render',
      'reject_mesh_render',
      'bind_character_sheet',
    ],
    // The loop STARTS with a create_sketch mint (image-outcome / sequential-art
    // / character-sheet kinds) — dispatchable here, homed in pack_diagram.
    shared: ['create_sketch'],
  },
  {
    id: 'pack_diagram',
    wing: 'studio',
    installGroup: 'creative',
    form: 'diagram',
    title: 'Diagrams & charts',
    description:
      "DIAGRAMS & CHARTS + scene sketches viewed in the dashboard: flow charts (stations + edges), data charts (stacked bars, donut / ring, KPI tiles, marks), scene illustrations, keyframe / scene-motion animation of drawn characters; revise a sketch in place, visual-diff two, read sketch-vocab cards and style presets. Open for 'draw / diagram X', 'a bar chart of signups by week', 'sketch our pipeline as boxes and arrows', 'make my drawn character talk and blink', 'update that sketch'.",
    members: ['create_sketch', 'update_sketch', 'get_sketch_vocab', 'get_style_vocab', 'diff_sketches'],
    // The Claude plugin profile leaves out the painted animation kinds and the style presets.
    profileEdits: [
      [', keyframe / scene-motion animation of drawn characters;', ';'],
      ['read sketch-vocab cards and style presets.', 'read sketch-vocab cards.'],
      [" 'make my drawn character talk and blink',", ''],
    ],
  },
  // ── office — the retained automation backend, listed after the studio ────
  // (the chatbot factory's three packs left in 3.0.0; lib/mcp/bot-factory-moved.js answers for them)
  {
    id: 'pack_runtime',
    wing: 'office',
    title: 'Apps, daemons & agent tasks',
    description:
      "APPS & RUNTIME — local apps (install_scaffold → start / stop / status, the running list, per-app .env keys), runtime daemons (list / status / start / stop / restart), and the agent-task loop (pull_agent_task → submit_envelope_inference → cancel). Open for 'scaffold and run a local app', 'watch a folder and process new files as they arrive', 'a background worker that reacts to events', 'restart the daemon', 'work the task queue'.",
    body: 'Ring 7. An app is a local process plus an MCP sidecar with inference parked back on the agent; daemons are the supervisor\'s long-lived hosts; agent tasks are the pull → submit → cancel work loop (the long-poll pull_agent_task parks up to ~25s and does not block other calls).',
    members: [
      'install_scaffold',
      'start_app',
      'stop_app',
      'status_app',
      'list_runners',
      // list_running and the .env trio act on local apps (lib/runners/local.js). Until 3.0 they sat
      // in the chatbot factory's operate pack, so an install without that pack could not reach them.
      'list_running',
      'list_env',
      'set_env',
      'delete_env',
      'list_daemons',
      'start_daemon',
      'stop_daemon',
      'restart_daemon',
      'status_daemon',
      'pull_agent_task',
      'submit_envelope_inference',
      'cancel_agent_task',
    ],
  },
  {
    id: 'pack_connected_services',
    wing: 'office',
    title: 'Connected services — MCP deliberation & binding',
    description:
      "CONNECTED SERVICES — deliberate over the operator's installed MCP servers and bind workflows over them: declare inventory & skills, record/read provider capabilities, browse mcp-orbit components, get composition recommendations, bind primitives and triggers, read the deliberation overview and the contextmap (brief / commit). Open for 'wire Gmail + Calendar into a routine', 'every Monday summarize new leads into our CRM', 'sync submissions to a sheet nightly', 'what MCPs do I have', 'automate X across my services'.",
    body: 'The Ring 6 deliberation surfaces. Mojulo is the anchor and audit trail here, not the runtime: the contextmap is sealed reality (append-only commits), inventory and skills are replace-semantic declarations about the present host, and bindings materialize session-scoped artifacts from the composer\'s component store.',
    members: [
      'get_deliberation_overview',
      'meta_context_brief',
      'meta_context_commit',
      'meta_context_analyze',
      'meta_context_declare_inventory',
      'declare_skills',
      'record_mcp_capabilities',
      'get_mcp_capabilities',
      'list_mcp_orbit_components',
      'get_mcp_orbit_component',
      'recommend_mcp_orbit_compositions',
      'bind_primitives',
      'bind_trigger',
      'unbind_trigger',
      'get_trigger',
      'list_triggers',
    ],
  },
  {
    id: 'pack_plan',
    wing: 'office',
    title: 'Plan mode (Ring 8)',
    description:
      "PLAN MODE — the speculative layer over sealed reality: enter plan mode, forge and revise plans, read and list them, compile a plan to a manifest of tool calls and execute it under per-execution operator approval, sketch a plan visual. Open for 'let's plan this out', 'turn this session into a plan', 'execute the plan'.",
    body: 'Plans are the PROPOSED layer; contextmap is sealed reality. A plan compiles to a manifest of tool calls that executes through the exact same handler path as operator-typed calls.',
    members: [
      'enter_plan_mode',
      'forge_plan',
      'get_plan',
      'list_plans',
      'revise_plan',
      'compile_plan',
      'execute_plan',
      'sketch_plan',
    ],
  },
  {
    id: 'pack_research',
    wing: 'office',
    title: 'Research mode (Ring 9)',
    description:
      "RESEARCH MODE — accretive gathering upstream of plans: enter research mode, start a research book, bind items into it, read and list books, synthesize an abstract (with deterministic review), run a parameter experiment sweep with auto-plotted outcomes, sketch the research. Open for 'research this', 'gather sources into a book', 'sweep the parameter and plot the outcome'.",
    body: 'The exploratory drawer upstream of plans. A synthesized abstract can hand a distilled thesis to plan mode via the research→plan bridge; new gatherings should generally prefer the typed-intake stash path (pack_stash).',
    members: [
      'enter_research_mode',
      'start_research',
      'bind_research_item',
      'get_research',
      'list_research',
      'synthesize_abstract',
      'sketch_research',
      'run_experiment_sweep',
    ],
  },
  {
    id: 'pack_stash',
    wing: 'office',
    title: 'Gather / stash / cook / publish',
    description:
      "GATHER / STASH / COOK / PUBLISH — typed collection into stashes (gather, mint / get / list / rename a stash, update / archive items, bind / unbind to anchors), then COOK stashes into an Outcome Artifact (agent-authored report + visuals; recommend_kind ranks the kinds) and forge publications. Open for 'save this for later', 'collect these into a stash', 'cook these notes into a report', 'make a zine / picture book / publication'.",
    body: 'The typed-intake collection layer (seven item types, required-per-type metadata validated at the gate) and the multi-input collider on top of it. Cook files the report the AGENT authors — no server-side LLM call; outcomes land under data/outcomes/<cook_ref>/.',
    members: [
      'gather',
      'mint_stash',
      'get_stash',
      'list_stashes',
      'rename_stash',
      'update_item',
      'archive_item',
      'bind_stash',
      'unbind_stash',
      'list_stash_bindings',
      'sketch_stash',
      // recommend_kind ranks publication kinds for cook(); it sat in the chatbot factory's build
      // pack until 3.0.
      'recommend_kind',
      'cook',
      'get_cook',
      'list_cooks',
      'archive_cook',
      'forge_publications',
    ],
  },
  {
    id: 'pack_catalysts',
    wing: 'office',
    title: 'Catalysts, adapters & extension',
    description:
      "CATALYSTS & EXTENSION — curated workflow recipes shipped via MCP: get / list / recommend catalysts, the meta-catalyst, mint a custom catalyst or drawer, and host-adapter info (get / list adapters — how a recipe lands as a Skill on this host). Open for 'is there a recipe for X', 'install this workflow as a skill', 'extend mojulo with a new drawer'.",
    body: 'A catalyst is a curated workflow recipe the host adapter synthesizes into a Skill; adapters describe the host so the synthesis lands in the right shape. Minting tools extend the shelf.',
    members: [
      'get_catalyst',
      'list_catalysts',
      'recommend_catalysts',
      'mint_catalyst',
      'custom_catalyst',
      'get_meta_catalyst',
      'mint_drawer',
      'get_adapter',
      'list_adapters',
    ],
  },
];

// ── lookups ─────────────────────────────────────────────────────────────────

const HOME_BY_TOOL = new Map();
const PACK_BY_ID = new Map();
// A pack's description under the Claude plugin profile, where its `profileEdits` name one.
const PROFILE_DESCRIPTION = new Map();
for (const pack of PACKS) {
  PACK_BY_ID.set(pack.id, pack);
  if (pack.profileEdits) PROFILE_DESCRIPTION.set(pack.id, profileEdit(pack.description, pack.profileEdits, pack.id));
  for (const name of pack.members) {
    // Duplicate homes are a partition violation — surfaced by packs.test.js,
    // but keep first-wins here so runtime lookups stay deterministic.
    if (!HOME_BY_TOOL.has(name)) HOME_BY_TOOL.set(name, pack);
  }
}

// One schema for every pack tool — the dispatch grammar. Kept minimal: it is
// repeated in every pack's tools/list entry, and the real member schemas ride
// the unveil menu and `manual`, not the connect payload.
export const PACK_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    tool: {
      type: 'string',
      description: 'Member to call. Omit to open the pack: a menu of its members.',
    },
    args: {
      type: 'object',
      description: "The member's arguments, as its manual specifies.",
    },
    manual: {
      description: 'A member name, or a list: returns just their manuals (description + inputSchema).',
    },
  },
};

/** The tools/list entry for a pack (used by listTools synthesis AND the
 * registered dispatcher, so the wire shape has one source). `profile: true` gives
 * the description the Claude plugin profile shows (lib/mcp/plugin-profile.js). */
export function packToolEntry(pack, { profile = false } = {}) {
  return {
    name: pack.id,
    description: (profile && PROFILE_DESCRIPTION.get(pack.id)) || pack.description,
    inputSchema: PACK_INPUT_SCHEMA,
  };
}

export function getPack(id) {
  return PACK_BY_ID.get(id) || null;
}

export function isPackId(name) {
  return PACK_BY_ID.has(name);
}

/** The pack a tool is HOMED in (shared listings don't count), or null. */
export function homePackForTool(name) {
  return HOME_BY_TOOL.get(name) || null;
}

/** Names a pack's dispatcher accepts: members + shared. */
export function dispatchTargets(pack) {
  return [...pack.members, ...(pack.shared || [])];
}

/** True when the connect surface should be spine + packs. Read per call so
 * tests can toggle; in a real process the env is fixed at start. Tri-state:
 *   MOJULO_TOOL_PACKS=off → flat everywhere (the operator escape hatch);
 *   MOJULO_TOOL_PACKS=on  → packs everywhere (force — e.g. packs on a deferring host);
 *   unset (default)       → packs UNLESS the connecting host already defers tool
 *                           schemas client-side (`clientDefers`), in which case
 *                           flat is better (finer per-tool permissions, no unveil
 *                           round-trip, and the host already blunted the token tax).
 * `clientDefers` is resolved by the caller from clientInfo (see server.js) so this
 * stays pure data. Callers that need the whole registry regardless of connect mode
 * use listRegisteredToolNames()/getRegisteredTool(), not listTools(). */
export function packsModeEnabled(env = process.env, { clientDefers = false } = {}) {
  const flag = env.MOJULO_TOOL_PACKS;
  if (flag === 'off') return false;
  if (flag === 'on') return true;
  return !clientDefers;
}

// ── install axis — PACK-GRAIN (mojulo-2.0-pure-creative.plan.md, Phase 1a) ────
// packsModeEnabled above is the PRESENTATION axis — which schemas load into
// context within a full install. THIS is the INSTALL axis — which capability
// packs physically exist on the host.
//
// 2.0 moved this from WING-grain to PACK-grain. Under 1.5 a pack's install state
// was a function of its wing, which forced the whole former office wing to share
// the chatbot factory's fate. It no longer does: a pack declares its own
// `installGroup`, and a pack that declares NONE is always present, like the
// kernel. `wing` survives as the taxonomy/routing field only — install and wing
// are now orthogonal, which is the generalization Phase 3's pack-host ABI needs
// (a third-party pack declares a group; it does not join a wing).
//
// The groups:
//   creative — the render / media / games stack (the flagship default pack). Always
//              installed: its code is in the package and its tools list on every
//              install. The heavy helpers some of its calls need (manifold-3d,
//              node-web-audio-api, openscad-wasm-prebuilt, opentype.js, sharp) are
//              optionalDependencies; a call whose helper is missing says so in-band,
//              and the rest of the pack works. Only an explicit MOJULO_PACKS override
//              gates it off.
//   recall   — the embedding runtime, below. No pack joins it.
// The orchestration plumbing (connected-services / catalysts / triggers / runtime /
// plan / research / stash) declares no group and is therefore ALWAYS present.
// The chatbot group (2.0 to 2.x) left with the chatbot factory in 3.0.0: see
// RETIRED_GROUP_TOKENS below for what happens to an install that still names it.
//
// SOURCE OF TRUTH = physical presence per group — so an install self-describes
// and an env flag can't silently disagree with what's on disk.
// MOJULO_PACKS is an explicit OVERRIDE on top (a deliberate operator choice:
// dev/test, or gating a present group's tools off); a typo/unknown value falls
// through to physical detection, never an empty workshop.
const INSTALL_GROUPS = {
  // Until 3.0 creative was keyed on the `three` package resolving. No Node code
  // imports three (scene-three.js only names it inside browser template strings),
  // so the 37 MB dependency existed only to be detected, and removing it hid the
  // studio's tools although nothing needed it.
  creative: { alwaysInstalled: true },
  // The embedding runtime (@huggingface/transformers + onnxruntime + the e5 model).
  // Opt-in: `mojulo install recall` installs it OUTSIDE the package, under
  // $MOJULO_HOME/recall/ (its own package.json + an entry.mjs shim), so it survives
  // package upgrades and never touches the shipped dependencies. The module marker
  // covers repo-dev with the package installed by hand. No pack joins this group:
  // `semantic_search` runs lexically (FTS5) without it; the group only changes the
  // ranking.
  recall: {
    markerModule: '@huggingface/transformers',
    markerFile: 'recall/node_modules/@huggingface/transformers/package.json',
  },
};
const ALL_GROUPS = Object.keys(INSTALL_GROUPS);

// Install tokens that no longer name a group. `chatbot` was the bot factory's group (2.0 to
// 2.x, marker file $MOJULO_HOME/packs/chatbot, written by `mojulo install chatbot`) and `ops` its
// deprecated alias (the 1.5 office-wing token). The factory left mojulo in 3.0.0, so a host that
// still carries the marker or names either token in MOJULO_PACKS keeps working: the marker is
// never probed as a group, and in MOJULO_PACKS the token is skipped like any unknown one (the
// override then falls through to physical detection if nothing else is named). The CLI's pack
// listing says so (retiredInstallTokens); nothing else reacts to them.
const RETIRED_GROUP_TOKENS = ['chatbot', 'ops'];
const RETIRED_CHATBOT_MARKER = 'packs/chatbot';

let _groupPresence = null; // memoized: install state is fixed for a process's life.

// The "pure data, no imports" rule holds at the top level; physical presence is
// the one runtime fact that isn't static. process.getBuiltinModule (Node ≥22.12,
// our engines floor) yields createRequire WITHOUT a top-level import, so the probe
// stays local and the module stays import-free.
function moduleResolves(specifier) {
  try {
    const { createRequire } = process.getBuiltinModule('module');
    createRequire(import.meta.url).resolve(specifier);
    return true;
  } catch {
    return false;
  }
}

// Marker-file probe, same import-free discipline as moduleResolves: the path is
// resolved against $MOJULO_HOME (default ~/.mojulo) and the builtins are pulled
// locally so this module keeps its no-top-level-imports rule.
export function markerFilePath(rel) {
  const path = process.getBuiltinModule('path');
  const os = process.getBuiltinModule('os');
  const home = process.env.MOJULO_HOME || path.join(os.homedir(), '.mojulo');
  return path.join(home, rel);
}

function markerFileExists(rel) {
  try {
    return process.getBuiltinModule('fs').existsSync(markerFilePath(rel));
  } catch {
    return false;
  }
}

function detectedGroups() {
  if (_groupPresence) return _groupPresence;
  const present = new Set();
  for (const group of ALL_GROUPS) {
    const sig = INSTALL_GROUPS[group] || { alwaysInstalled: true };
    if (
      sig.alwaysInstalled
      || (sig.markerModule && moduleResolves(sig.markerModule))
      || (sig.markerFile && markerFileExists(sig.markerFile))
    ) present.add(group);
  }
  return (_groupPresence = present);
}

/** Test seam: force the memoized physical group probe (pass null to reset). */
export function _setGroupPresence(groups) {
  _groupPresence = groups ? new Set(groups) : null;
}

/** The install groups present on this host. Packs declaring no group are always
 * installed and are not represented here. */
export function installedGroups(env = process.env) {
  const raw = (env.MOJULO_PACKS || '').trim();
  if (raw) {
    const groups = new Set();
    for (const tok of raw.split(',')) {
      const name = tok.trim().toLowerCase();
      if (INSTALL_GROUPS[name]) groups.add(name); // a retired or unknown token is skipped
    }
    if (groups.size) return groups; // explicit override wins, even vs. disk
    // typo/unknown → fall through to physical detection (never an empty workshop)
  }
  return new Set(detectedGroups());
}

/** The retired chatbot-group signals this host still carries (see RETIRED_GROUP_TOKENS): each
 * MOJULO_PACKS token naming the old group, and its marker file when present. Empty on a host
 * that never installed the chatbot pack. Informational only; nothing is gated on it. */
export function retiredInstallTokens(env = process.env) {
  const out = [];
  for (const tok of (env.MOJULO_PACKS || '').split(',')) {
    const name = tok.trim().toLowerCase();
    if (RETIRED_GROUP_TOKENS.includes(name) && !out.includes(`MOJULO_PACKS=${name}`)) out.push(`MOJULO_PACKS=${name}`);
  }
  if (markerFileExists(RETIRED_CHATBOT_MARKER)) out.push(markerFilePath(RETIRED_CHATBOT_MARKER));
  return out;
}

/** A pack with no installGroup is kernel-adjacent: always present. */
export function isPackInstalled(pack, env = process.env) {
  if (!pack?.installGroup) return true;
  return installedGroups(env).has(pack.installGroup);
}

export function installedPacks(env = process.env) {
  return PACKS.filter((pack) => isPackInstalled(pack, env));
}

/** True unless `name` is a pack member whose install group isn't present. SPINE /
 * FOLDED / unpacked tools are kernel — always installed, as are packs declaring no
 * group. Gates both listing and invocation, so an uninstalled pack's tools neither
 * list nor run. Default full install ⇒ always true (no behavior change). */
export function isToolInstalled(name, env = process.env) {
  const pack = homePackForTool(name);
  return pack ? isPackInstalled(pack, env) : true;
}

// The action that actually enables an uninstalled group. creative is always
// installed, so it is only ever "off" through an explicit MOJULO_PACKS override and
// its fix is the flag. recall is a physical install (the runtime under
// $MOJULO_HOME/recall), so its fix is `mojulo install <group>`, written
// for this install: `npx -y mojulo@<running version> install <group>` from npm or the
// Claude plugin, the checkout's own bin from a clone.
function installAction(group, env = process.env) {
  return INSTALL_GROUPS[group]?.alwaysInstalled
    ? `include '${group}' in MOJULO_PACKS (${group} ships with the base install; it is only gated by an explicit override)`
    : `${runMojulo(`install ${group}`, { env })} (or include '${group}' in MOJULO_PACKS if you manage the install manually)`;
}

/** The command that installs `group` on this host (`npx -y mojulo@<version> install <group>`). */
export function installCommandFor(group, env = process.env) {
  return mojuloCommand(`install ${group}`, { env });
}

/**
 * The short fix for an uninstalled group, for a one-line list (the rules card, `mojulo tools`): the
 * install command, or for a group that ships with the base install (creative) the MOJULO_PACKS
 * override that left it out, since `install creative` changes nothing. The same split as
 * installAction. `code` wraps names in backticks for Markdown surfaces.
 */
export function installAdvice(group, env = process.env, { code = false } = {}) {
  const q = (t) => (code ? `\`${t}\`` : t);
  return INSTALL_GROUPS[group]?.alwaysInstalled
    ? `include '${group}' in ${q('MOJULO_PACKS')} (it ships with the base install; only that override leaves it out)`
    : q(installCommandFor(group, env));
}

/** The install groups a DEFAULT install has, for copy that must not overclaim. */
export const DEFAULT_ON_GROUPS = ALL_GROUPS.filter((g) => !INSTALL_GROUPS[g].markerFile);

/** Advisory message for a tool whose pack isn't installed, or null if it is.
 * Never a refusal of capability — a pointer to the install that enables it. */
export function installNotice(name, env = process.env) {
  const pack = homePackForTool(name);
  if (!pack || isPackInstalled(pack, env)) return null;
  const group = pack.installGroup;
  return `'${name}' belongs to the ${group} capability pack, which is not installed on this host — ${installAction(group, env)}.`;
}

/** Pack-level advisory used by the dispatcher when a whole pack is uninstalled.
 * Group-level + terminal on purpose: it tells the model the ENTIRE pack is
 * unavailable and to STOP retrying its tools (anti-spin), while pointing at the
 * install. Knowing the pack exists is fine; running it is not.
 * Returns null when the pack is installed. */
export function packInstallNotice(pack, env = process.env) {
  if (!pack || isPackInstalled(pack, env)) return null;
  const group = pack.installGroup;
  return `The ${group} capability pack is not installed on this host, so ${pack.id} and its tools cannot run here. To enable them, ${installAction(group, env)}. Everything outside the ${group} pack — the kernel and the always-present packs — still works. Do not retry ${group}-pack tools until it is installed.`;
}
