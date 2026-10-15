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
 * Each pack sits in a `ring`, named for what its tools make: characters (a body
 * with a rig: heroes, creatures, animals), solids (Print),
 * audio (Hear), read (2D + publications), worlds (the testbed), games (Play),
 * kernel (Observe: motion), workflows (orchestration: plans, sweeps, stash and
 * cook, catalysts, worker handoffs). A pack with a `form` takes its body from
 * that FORM_TOOLSETS entry (lib/mcp/tools/context.js), so the prose has one
 * source; a pack without one carries a short `body` here. The generated member
 * menu (and `manual` on demand) is the meat either way. RETIRED_PACKS (the
 * office wing, 3.1.0) still dispatch but never list.
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
  // Characters lead (3.1.0): the Characters ring's one door.
  {
    id: 'pack_character',
    ring: 'characters',
    installGroup: 'creative',
    form: 'character',
    title: 'Characters: heroes, creatures & animals',
    description:
      "CHARACTERS — a body with a rig you can play, print or watch: create_character as a hero (a person by cast word, proportions, face, hair, clothes and armour), a creature (a dragon, a monster, a plush toy, any invented body) or an animal (a real species). Plays its clips on the World page and exports skinned. Open for 'a hero for my game', 'a low-poly knight I can rig', 'a cute plush bear', 'a dragon I can animate', 'a wolf I can 3D print', 'give her a ponytail and broader shoulders'.",
    members: ['create_character', 'update_character'],
    shared: ['get_solid_vocab'],
  },
  {
    id: 'pack_object',
    ring: 'solids',
    installGroup: 'creative',
    form: 'object',
    title: '3D solids, figures & objects',
    description:
      "3D SOLIDS — objects, posed figures, buildings, wordmarks, vehicles, OpenSCAD: mint_solid (kinds figure / manji-tree / workbench / scad (an OpenSCAD program) / assembler / carved-solid / solid-turntable / edifice / vehicle), edit_solid (skin / emote ops), measure_solid, fabricate_solid (real parts to buy), verify_machina. Open for 'model a wine glass true to size', 'a posed figure to print', 'our logo in shiny chrome', 'a bracket with bolt holes in OpenSCAD', 'put the wheels and the chassis together', 'turn this concept art into a 3D model'. Placing solids IN an environment is pack_world. A rigged character is pack_character. A house is pack_building; edifice is the institutional one-off.",
    members: ['mint_solid', 'edit_solid', 'get_solid_vocab', 'measure_solid', 'fabricate_solid', 'verify_machina'],
    // The Claude plugin profile leaves out the skin op and the concept-art dream loop
    // (lib/mcp/plugin-profile.js).
    profileEdits: [
      ['edit_solid (skin / emote ops)', 'edit_solid (the emote op)'],
      [", 'turn this concept art into a 3D model'", ''],
    ],
  },
  {
    id: 'pack_world',
    ring: 'worlds',
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
    ring: 'solids',
    installGroup: 'creative',
    form: 'building',
    title: 'Buildings (houses)',
    description:
      "BUILDINGS — walkable houses, apartments and furnished rooms, built up in steps: mint_building, then furnishing / storeys, framing / roof / drainage, and IFC for BIM tools (export_model); design_interior fits out and styles one room of a house. Each result's `next` names the next steps' cards. Open for 'design me a two-storey house', 'a 20 by 24 living room', 'frame the house', 'the house as IFC for Revit', 'make my living room Japandi'. An institutional one-off is pack_object (edifice).",
    members: ['mint_building', 'design_interior'],
    shared: ['update_sketch', 'get_sketch_vocab', 'export_model'],
  },
  {
    id: 'pack_game',
    ring: 'games',
    installGroup: 'creative',
    form: 'game',
    title: 'Game',
    description:
      "GAMES — the game rail first: design_game designs a game top down (a hero, its powers, gear and systems) and makes it. Then the doors it calls and the rest: create_game (levels are worlds with a game contract), pixelizer 2D games, sprite sheets, the game and play drawers, export_game. Open for 'a game where my hero gains powers', 'a playable dungeon crawler I can walk around in', 'a roguelike where my gear persists', 'a pixel-art game with sprites', 'export my game so a friend can play it'.",
    members: [
      'design_game',
      'tune_ground',
      'pick_palette',
      'create_game',
      'create_pixelizer_game',
      'create_sprite_sheet',
      'bake_sprite_sheet',
      'get_game_vocab',
      'get_play_vocab',
      'export_game',
    ],
    // The Claude plugin profile leaves out the sprite sheets, painted through the image-render
    // handoff (lib/mcp/plugin-profile.js).
    profileEdits: [
      [' sprite sheets,', ''],
    ],
  },
  {
    id: 'pack_view',
    ring: 'read',
    installGroup: 'creative',
    form: 'view',
    title: 'Study views (science / math / bio)',
    description:
      "STUDY VIEWS — animated 3D study objects that teach a phenomenon: create_view kinds across science / math / bio, view-vocab parameter manuals, measure_view for SI-honest time-series read-back from the stored recipe, and save_recipe to KEEP a tuned setup in the operator's cookbook (view and beats recipes alike), recallable by intent later. Open for 'help my kid understand black holes', 'an animated science explainer for my kid', 'animate how DNA copies itself', 'measure the orbit', 'save this setup for my class'.",
    members: ['create_view', 'get_view_vocab', 'measure_view', 'save_recipe'],
  },
  {
    id: 'pack_motion',
    ring: 'kernel',
    installGroup: 'creative',
    form: 'motion',
    forms: ['motion', 'motion-comic'],
    title: 'Motion, film & motion-comic',
    description:
      "MOTION & FILM (+ motion-comic) — add TIME to a static subject: forge_motion (camera moves and performances rendered to flipbook SVG + GIF), stitch_motion (clips → one film), motion-vocab cards, and the click-gated motion-comic authored via update_sketch. Open for 'give me a spinning view of that molecule', 'record the hero clearing the chasm and show me the clip', 'walk to the exit to check the level is beatable' (traversal proof), 'present these charts one after another as a click-through deck', 'merge the clips into a single movie'.",
    members: ['forge_motion', 'stitch_motion', 'get_motion_vocab', 'create_shoot_plan', 'update_shoot_plan'],
    shared: ['update_sketch', 'get_sketch_vocab'],
  },
  {
    id: 'pack_audio',
    ring: 'audio',
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
    ring: 'audio',
    installGroup: 'creative',
    form: 'voice',
    title: 'Voice — Mojulo Voice',
    description:
      "VOICE — deterministic voice registers (confidence × depth resolved to Kokoro blend weights, pure math): create / read a voice, bind worker-rendered WAV samples, and the voice-vocab drawer. Scope is voiceover and narration, not character acting. Open for 'a warm narrator voice', 'render this line in her voice', 'design how the guide sounds'.",
    members: ['create_voice', 'get_voice', 'bind_voice_sample', 'get_voice_vocab'],
  },
  {
    id: 'pack_illustration',
    ring: 'read',
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
    ring: 'read',
    installGroup: 'creative',
    form: 'reference',
    title: 'Visual reference (from a photo)',
    description:
      "VISUAL REFERENCE — read a photo YOU can see into mojulo dials: reference_protocol hands the extraction protocol (scene perspective or human pose — you are the vision adapter, no image sent), capture_reference files the read as a reusable cage + insights in a stash. Open for 'recreate the camera angle from this photo', 'match this pose'.",
    members: ['reference_protocol', 'capture_reference'],
  },
  {
    id: 'pack_image_render',
    ring: 'workflows',
    installGroup: 'creative',
    form: 'image-render',
    title: 'AI-image render pipeline',
    description:
      "AI-IMAGE + MESH RENDER pipeline — direct, queue, and gate externally-painted images and externally-sculpted meshes (the mesh quartet parks a greybox for Meshy / Tripo / Hunyuan3D…): render packets for image-outcome / comic / character-sheet sketches, the durable request → pull → submit → accept / reject worker loop, and binding finished PNGs and character sheets back onto their sketches. Open for 'have the image model paint this', 'an AI-painted portrait rendered by an image model', 'run the render queue', 'accept that render'.",
    members: [
      'get_image_render_packet',
      'render_handoff',
      'bind_image_render',
      'bind_character_sheet',
    ],
    // The loop STARTS with a create_sketch mint (image-outcome / sequential-art
    // / character-sheet kinds) — dispatchable here, homed in pack_diagram.
    shared: ['create_sketch'],
  },
  {
    id: 'pack_diagram',
    ring: 'read',
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
    id: 'pack_plan',
    ring: 'workflows',
    title: 'Plan mode (Ring 8)',
    description:
      "PLAN MODE — the speculative layer over sealed reality: enter plan mode, forge and revise plans, read and list them, compile a plan to a manifest of tool calls and execute it under per-execution operator approval, sketch a plan visual. Open for 'let's plan this out', 'turn this session into a plan', 'execute the plan'.",
    body: 'Plans are the PROPOSED layer; contextmap is sealed reality. A plan compiles to a manifest of tool calls that executes through the exact same handler path as operator-typed calls. A step takes an earlier step\'s result as `{ $step: n, path: \'/ref\' }`, so a chain is written once.',
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
    ring: 'workflows',
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
    ring: 'workflows',
    title: 'Gather / stash / cook / publish',
    description:
      "GATHER / STASH / COOK / PUBLISH — typed collection into stashes and their drawers (gather, mint / get / list / rename a stash, mint_drawer, update / archive items, bind / unbind to anchors), then COOK stashes into an Outcome Artifact (agent-authored report + visuals; recommend_kind ranks the kinds) and forge publications; sign_asset / verify_asset: a creator receipt for an exported file. Open for 'save this for later', 'collect these into a stash', 'cook these notes into a report', 'make a zine / picture book / publication'.",
    body: 'The typed-intake collection layer (seven item types, required-per-type metadata validated at the gate) and the multi-input collider on top of it. Cook files the report the AGENT authors — no server-side LLM call; outcomes land under data/outcomes/<cook_ref>/.',
    members: [
      'gather',
      'mint_stash',
      'mint_drawer',
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
      // the creator's receipt for a published file (docs/asset-receipts.md)
      'sign_asset',
      'verify_asset',
    ],
  },
  {
    id: 'pack_catalysts',
    ring: 'workflows',
    title: 'Catalysts, workers & connected MCPs',
    description:
      "CATALYSTS, WORKERS & CONNECTED MCPs — for flows that reach past mojulo: curated workflow recipes (get / list / recommend catalysts, mint a custom one) that land as a Skill on this host beside its other MCPs (get / list adapters), what those MCPs can do (declare the inventory, record / read a provider's capabilities), and the agent-task queue an outside worker drains (pull_agent_task → submit_envelope_inference → cancel). Open for 'is there a recipe for X', 'install this workflow as a skill', 'send this mesh to my Blender MCP', 'work the task queue'.",
    body: 'A catalyst is a curated workflow recipe the host adapter synthesizes into a Skill, which runs in the host beside the operator\'s other MCPs, so a flow across mojulo and another MCP lives there. The inventory and capability reads tell it what those MCPs can do. The agent-task queue parks work for an outside fulfiller (the long-poll pull_agent_task waits up to ~25s and does not block other calls).',
    members: [
      'get_catalyst',
      'list_catalysts',
      'recommend_catalysts',
      'mint_catalyst',
      'custom_catalyst',
      'get_adapter',
      'list_adapters',
      'meta_context_declare_inventory',
      'record_mcp_capabilities',
      'get_mcp_capabilities',
      'pull_agent_task',
      'submit_envelope_inference',
      'cancel_agent_task',
    ],
  },
];

// The office wing left the tool surface in 3.1.0 (mojulo makes things to Play, Print, Read, Hear and
// Observe; apps, daemons, the contextmap and MCP-to-MCP binding are not that). These dispatchers and
// their members stay registered and callable by name, listed:false, so a compiled plan or a skill that
// names one keeps working; nothing lists, indexes or routes to them. The tools a power user needs to
// reach other workers and MCPs moved to pack_catalysts.
export const RETIRED_PACKS = [
  {
    id: 'pack_runtime',
    ring: 'retired',
    retired: '3.1.0',
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
    ],
  },  {
    id: 'pack_connected_services',
    ring: 'retired',
    retired: '3.1.0',
    title: 'Connected services — MCP deliberation & binding',
    description:
      "CONNECTED SERVICES — deliberate over the operator's installed MCP servers and bind workflows over them: declare inventory & skills, record/read provider capabilities, browse mcp-orbit components, get composition recommendations, bind primitives and triggers, read the deliberation overview and the contextmap (brief / commit). Open for 'wire Gmail + Calendar into a routine', 'every Monday summarize new leads into our CRM', 'sync submissions to a sheet nightly', 'what MCPs do I have', 'automate X across my services'.",
    body: 'The Ring 6 deliberation surfaces. Mojulo is the anchor and audit trail here, not the runtime: the contextmap is sealed reality (append-only commits), inventory and skills are replace-semantic declarations about the present host, and bindings materialize session-scoped artifacts from the composer\'s component store.',
    members: [
      'get_deliberation_overview',
      'meta_context_brief',
      'meta_context_commit',
      'meta_context_analyze',
      'declare_skills',
      'list_mcp_orbit_components',
      'get_mcp_orbit_component',
      'recommend_mcp_orbit_compositions',
      'bind_primitives',
      'bind_trigger',
      'unbind_trigger',
      'get_trigger',
      'list_triggers',
      'get_meta_catalyst',
    ],
  },
  // A game project tied a game's rules, levels, characters, audio and art into one home (/games/<ref>). A game is
  // made on the game rail now (design_game, quick or full), whose gameworld is that home, and Play groups every game by
  // where it came from. The tools stay callable by name, so a stored project, a seed script or a plan step that names
  // one keeps working; create_game, create_pixelizer_game and create_sprite_sheet still take a legacy `project_ref`.
  {
    id: 'pack_game_projects',
    ring: 'retired',
    retired: '3.1.0',
    title: 'Game projects',
    description:
      "GAME PROJECTS — one home per game tying its rules, levels, characters, audio and art: create, read, update, bind members, list. Retired: a game's home is its gameworld (design_game).",
    body: 'Retired in 3.1.0 for the game rail. Callable by name for projects already made.',
    members: [
      'create_game_project',
      'get_game_project',
      'update_game_project',
      'bind_to_game_project',
      'list_game_projects',
    ],
  },
];

/** The office wing's packs, which left the surface in 3.1.0. */
const OFFICE_PACK_IDS = ['pack_runtime', 'pack_connected_services'];
/** Every tool the office wing took off the surface. */
export const RETIRED_OFFICE_TOOLS = Object.freeze(RETIRED_PACKS.filter((p) => OFFICE_PACK_IDS.includes(p.id)).flatMap((p) => p.members));
/** Every retired tool: registered and callable by name, never listed, indexed or routed to. */
export const RETIRED_TOOLS = Object.freeze(RETIRED_PACKS.flatMap((p) => p.members));

// ── lookups ─────────────────────────────────────────────────────────────────

const HOME_BY_TOOL = new Map();
const PACK_BY_ID = new Map();
// A pack's description under the Claude plugin profile, where its `profileEdits` name one.
const PROFILE_DESCRIPTION = new Map();
for (const pack of [...PACKS, ...RETIRED_PACKS]) {
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
// The workflows ring (plan / research / stash / catalysts) and the retired office
// packs declare no group and are therefore ALWAYS present.
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
