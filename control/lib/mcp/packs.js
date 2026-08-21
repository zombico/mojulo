/**
 * Tool packs — the consolidated tools/list surface (tool-packs.plan.md P1-R/P2-D).
 *
 * Pure data, no imports: this module is the partition of the listed tool
 * registry into a small SPINE (always listed with full schemas) plus ~20
 * PACKS, each listed as ONE stateless dispatcher tool whose description is
 * its recognizer. In packs mode (MOJULO_TOOL_PACKS=on) connect-time
 * tools/list returns spine + pack tools only; a pack called bare returns its
 * orientation body + member manual, called with { tool, args } it dispatches
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
 * generated member manual is the meat either way.
 */

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
  'get_tool_telemetry',
  'version',
  'check_for_updates',
];

// Listed in flat mode; dropped from tools/list in packs mode (still callable).
// get_creative_toolset folds because its {form} bodies ARE the studio packs'
// unveil bodies and its no-arg form map is redundant with the pack
// descriptions sitting in the connect payload.
export const FOLDED = ['get_creative_toolset'];

export const PACKS = [
  // ── office ────────────────────────────────────────────────────────────────
  {
    id: 'pack_bot_build',
    wing: 'office',
    title: 'Chatbot — build & deploy',
    description:
      "Deploy a CHATBOT — the bot factory: builder session → identity & protocol composition → typed config generators (forms, triage, appointments, optical-read) → documents/RAG → save & deploy → build-job polling. Open for 'make me a bot / chatbot / assistant for X', 'a bot that answers from my documents', 'intake / booking / support bot'. Operating an already-deployed bot is pack_bot_operate.",
    body: 'The bot factory. A bot is built through a BuilderSession (chat builder and modular wizard converge on the same config composition), deployed as its own process, and polled to completion via poll_job. Documents uploaded here become the bot\'s RAG corpus.',
    members: [
      'start_new_bot',
      'get_builder_session',
      'save_modular_bot',
      'compose_identity',
      'infer_intent',
      'recommend_kind',
      'recommend_protocols',
      'custom_protocol',
      'generate_form_schema',
      'generate_triage_config',
      'generate_appointment_config',
      'generate_optical_read_config',
      'process_documents',
      'upload_document_from_url',
      'poll_job',
    ],
  },
  {
    id: 'pack_bot_operate',
    wing: 'office',
    title: 'Chatbot — operate deployed bots',
    description:
      "Run & read DEPLOYED bots: list deployments and running processes, read conversations and form submissions, export transcripts, summarize a bot, verify its turn hash-chain, inspect/set/delete bot env (secrets-safe), set suggested prompts. Open for 'what did people ask my bot', 'is my bot up', 'rotate its key', 'export the conversations'. Cross-bot analytics is pack_fleet.",
    body: 'Per-bot operation. Conversation and submission reads go through the bot proxy (conversation data never enters the control-plane DB); env inspection is masked — never cat a bot .env.',
    members: [
      'list_deployments',
      'get_deployment',
      'list_running',
      'query_conversations',
      'get_conversation',
      'query_submissions',
      'export_conversations',
      'generate_bot_summary',
      'verify_chain',
      'inspect_bot_env',
      'set_env',
      'list_env',
      'delete_env',
      'set_suggested_prompts',
    ],
  },
  {
    id: 'pack_fleet',
    wing: 'office',
    title: 'Fleet — cross-bot aggregation',
    description:
      "FLEET-level reads across ALL bots at once: scoped SQL over every bot's conversations, an aggregated analytics summary, and fleet-wide hash-chain verification. Open for 'across all my bots…', 'which bot is busiest', 'a weekly digest of every deployment'. Single-bot reads are pack_bot_operate.",
    body: 'Aggregation over the whole fleet through scoped SQL — reads fan out through the per-bot proxies and come back as one result.',
    members: ['fleet_query_conversations', 'fleet_analytics_summary', 'verify_fleet_chains'],
  },
  {
    id: 'pack_connected_services',
    wing: 'office',
    title: 'Connected services — MCP deliberation & binding',
    description:
      "CONNECTED SERVICES — deliberate over the operator's installed MCP servers and bind workflows over them (no chatbot): declare inventory & skills, record/read provider capabilities, browse mcp-orbit components, get composition recommendations, bind primitives and triggers, read the deliberation overview and the contextmap (brief / commit). Open for 'wire Gmail + Calendar into a routine', 'every Monday summarize new leads into our CRM', 'sync submissions to a sheet nightly', 'what MCPs do I have', 'automate X across my services'.",
    body: 'The Ring 6 deliberation surfaces. Mojulo is the anchor and audit trail here, not the runtime: the contextmap is sealed reality (append-only commits), inventory and skills are replace-semantic declarations about the present host, and bindings materialize session-scoped artifacts from the composer\'s component store.',
    members: [
      'get_deliberation_overview',
      'meta_context_brief',
      'meta_context_commit',
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
    id: 'pack_runtime',
    wing: 'office',
    title: 'Apps, daemons & agent tasks',
    description:
      "APPS & RUNTIME — local apps (install_scaffold → start / stop / status, runner listing), runtime daemons (list / status / start / stop / restart), and the agent-task loop (pull_agent_task → submit_envelope_inference → cancel; chat signals and decisions for the chat_turn worker). Open for 'scaffold and run a local app', 'watch a folder and process new files as they arrive', 'a background worker that reacts to events', 'restart the daemon', 'work the task queue'.",
    body: 'Ring 7. An app is a local process plus an MCP sidecar with inference parked back on the agent; daemons are the supervisor\'s long-lived hosts; agent tasks are the pull → submit → cancel work loop (the long-polls pull_agent_task and request_chat_decision park up to ~25s and do not block other calls).',
    members: [
      'install_scaffold',
      'start_app',
      'stop_app',
      'status_app',
      'list_runners',
      'list_daemons',
      'start_daemon',
      'stop_daemon',
      'restart_daemon',
      'status_daemon',
      'pull_agent_task',
      'submit_envelope_inference',
      'cancel_agent_task',
      'emit_chat_signal',
      'request_chat_decision',
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
      "GATHER / STASH / COOK / PUBLISH — typed collection into stashes (gather, mint / get / list / rename a stash, update / archive items, bind / unbind to anchors), then COOK stashes into an Outcome Artifact (agent-authored report + visuals) and forge publications. Open for 'save this for later', 'collect these into a stash', 'cook these notes into a report', 'make a zine / picture book / publication'.",
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

  // ── studio (bodies from FORM_TOOLSETS via `form`) ─────────────────────────
  {
    id: 'pack_diagram',
    wing: 'studio',
    form: 'diagram',
    title: 'Diagrams & charts',
    description:
      "DIAGRAMS & CHARTS + scene sketches viewed in the dashboard: flow charts (stations + edges), data charts (stacked bars, donut / ring, KPI tiles, marks), scene illustrations and keyframe / scene-motion animation of drawn characters; revise a sketch in place, visual-diff two sketches, read sketch-vocab layout cards and style presets. Open for 'draw / diagram X', 'a bar chart of signups by week', 'a donut chart of the split', 'sketch our pipeline as boxes and arrows', 'make my drawn character talk and blink', 'update that sketch'.",
    members: ['create_sketch', 'update_sketch', 'get_sketch_vocab', 'get_style_vocab', 'diff_sketches'],
  },
  {
    id: 'pack_illustration',
    wing: 'studio',
    form: 'illustration',
    title: 'Scene & figure illustration',
    description:
      "Painted scene & figure ILLUSTRATION + publication covers: the inverse-stable-diffusion knob-resolution loop (sketch_what_possible) that feeds create_sketch recipe families, and create_cover for title art composed under one art direction. Open for 'paint a moody mountain valley', 'illustrate my hero', 'a cover for this book'. Sketch minting is homed in pack_diagram; this pack dispatches it too.",
    members: ['sketch_what_possible', 'create_cover'],
    shared: ['create_sketch', 'update_sketch'],
  },
  {
    id: 'pack_reference',
    wing: 'studio',
    form: 'reference',
    title: 'Visual reference (from a photo)',
    description:
      "VISUAL REFERENCE — read a photo YOU can see into mojulo dials: reference_protocol hands the extraction protocol (scene perspective or human pose — you are the vision adapter, no image sent), capture_reference files the read as a reusable cage + insights in a stash. Open for 'recreate the camera angle from this photo', 'match this pose'.",
    members: ['reference_protocol', 'capture_reference'],
  },
  {
    id: 'pack_image_render',
    wing: 'studio',
    form: 'image-render',
    title: 'AI-image render pipeline',
    description:
      "AI-IMAGE RENDER pipeline — direct, queue, and gate externally-painted images: render packets for image-outcome / comic / character-sheet sketches, the durable request → pull → submit → accept / reject worker loop, and binding finished PNGs and character sheets back onto their sketches. Open for 'have the image model paint this', 'an AI-painted portrait rendered by an image model', 'run the render queue', 'accept that render'.",
    members: [
      'get_image_render_packet',
      'request_image_render',
      'pull_image_render',
      'submit_image_render',
      'accept_image_render',
      'reject_image_render',
      'bind_image_render',
      'bind_character_sheet',
    ],
    // The loop STARTS with a create_sketch mint (image-outcome / sequential-art
    // / character-sheet kinds) — dispatchable here, homed in pack_diagram.
    shared: ['create_sketch'],
  },
  {
    id: 'pack_object',
    wing: 'studio',
    form: 'object',
    title: '3D solids, figures & objects',
    description:
      "3D SOLIDS — figures, creatures, objects, buildings, wordmarks, vehicles: mint_solid (kinds figure / manji-tree / workbench / assembler / carved-solid / solid-turntable / edifice / vehicle), edit_solid (skin / emote ops), solid-vocab cards, and verify_machina feasibility checks. Open for 'model a wine glass true to size', 'a woman mid-stride' (a posed figure), 'our logo in shiny chrome', 'a 3D creature', 'put the wheels and the chassis together into one model', 'turn this concept art into a 3D model piece by piece', 'rebuild a drawing as a real 3D model, segment by segment'. Placing solids IN an environment is pack_world.",
    members: ['mint_solid', 'edit_solid', 'get_solid_vocab', 'verify_machina'],
  },
  {
    id: 'pack_world',
    wing: 'studio',
    form: 'world',
    title: 'Worlds (traversable)',
    description:
      "WORLDS — traversable three.js environments: compose_world (BASE × THEME × overrides — city, transport-hub, controllable, action, operator, planetary, painted-landscape, math), theme packs, glTF export (export_model), binding refined meshes back (bind_mesh_render), and modeler-lingo translation. Open for 'build a little town I can wander around', 'an airport', 'a game where I drive', 'export to Blender'.",
    members: ['compose_world', 'list_world_themes', 'export_model', 'bind_mesh_render', 'translate_modeler_lingo'],
  },
  {
    id: 'pack_view',
    wing: 'studio',
    form: 'view',
    title: 'Study views (science / math / bio)',
    description:
      "STUDY VIEWS — animated 3D study objects that teach a phenomenon: create_view kinds across science / math / bio, view-vocab parameter manuals, and measure_view for SI-honest time-series read-back from the stored recipe. Open for 'help my kid understand black holes', 'animate how DNA copies itself', 'measure the orbit'.",
    members: ['create_view', 'get_view_vocab', 'measure_view'],
  },
  {
    id: 'pack_motion',
    wing: 'studio',
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
    form: 'voice',
    title: 'Voice — Mojulo Voice',
    description:
      "VOICE — deterministic voice registers (confidence × depth resolved to Kokoro blend weights, pure math): create / read a voice, bind worker-rendered WAV samples, and the voice-vocab drawer. Scope is voiceover and narration, not character acting. Open for 'a warm narrator voice', 'render this line in her voice', 'design how the guide sounds'.",
    members: ['create_voice', 'get_voice', 'bind_voice_sample', 'get_voice_vocab'],
  },
  {
    id: 'pack_game',
    wing: 'studio',
    form: 'game',
    title: 'Game',
    description:
      "GAMES — playable standalone artifacts composed over media: create_game (levels are worlds minted with a game contract — refused until proven completable), pixelizer 2D reducer games, sprite sheets (create + bake), game projects (create / get / update / bind / list), game-vocab cards, and export_game (self-contained folder). Open for 'a playable dungeon crawler I can actually walk around in', 'a roguelike where my gear persists across floors', 'a pixel-art game with sprites', 'a pixel-art cutscene of my hero', 'export my game so a friend can play it'.",
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
  },
];

// ── lookups ─────────────────────────────────────────────────────────────────

const HOME_BY_TOOL = new Map();
const PACK_BY_ID = new Map();
for (const pack of PACKS) {
  PACK_BY_ID.set(pack.id, pack);
  for (const name of pack.members) {
    // Duplicate homes are a partition violation — surfaced by packs.test.js,
    // but keep first-wins here so runtime lookups stay deterministic.
    if (!HOME_BY_TOOL.has(name)) HOME_BY_TOOL.set(name, pack);
  }
}

// One schema for every pack tool — the dispatch grammar. Kept minimal: the
// real member schemas ride the unveil response, not the connect payload.
export const PACK_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    tool: {
      type: 'string',
      description:
        "Member tool to dispatch. OMIT on the first call to open the pack: you get its orientation body plus the member manual (names, descriptions, input schemas).",
    },
    args: {
      type: 'object',
      description: "Arguments for the member tool, exactly as its inputSchema in the pack manual specifies.",
    },
  },
};

/** The tools/list entry for a pack (used by listTools synthesis AND the
 * registered dispatcher, so the wire shape has one source). */
export function packToolEntry(pack) {
  return {
    name: pack.id,
    description: pack.description,
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

// ── install axis (install-capabilities.plan.md P2) ────────────────────────────
// packsModeEnabled above is the PRESENTATION axis — which schemas load into
// context within a full install. THIS is the INSTALL axis — which capability
// packs exist on the host at all. Two coarse install packs map onto the two
// wings; everything not in a pack (SPINE / FOLDED / unpacked) is kernel and
// always present. Read from MOJULO_PACKS (comma list of install-pack names).
// Unset OR unrecognized ⇒ full install (both wings): the default is byte-
// identical to today, and a typo never yields an empty workshop — an operator
// narrows the install only by naming packs explicitly.
const WING_BY_INSTALL_PACK = { ops: 'office', creative: 'studio' };
const INSTALL_PACK_BY_WING = { office: 'ops', studio: 'creative' };
const ALL_WINGS = ['office', 'studio'];

export function installedWings(env = process.env) {
  const raw = (env.MOJULO_PACKS || '').trim();
  if (!raw) return new Set(ALL_WINGS);
  const wings = new Set();
  for (const tok of raw.split(',')) {
    const wing = WING_BY_INSTALL_PACK[tok.trim().toLowerCase()];
    if (wing) wings.add(wing);
  }
  return wings.size ? wings : new Set(ALL_WINGS);
}

export function isPackInstalled(pack, env = process.env) {
  return installedWings(env).has(pack.wing);
}

export function installedPacks(env = process.env) {
  return PACKS.filter((pack) => isPackInstalled(pack, env));
}

/** True unless `name` is a pack member whose wing isn't installed. SPINE / FOLDED
 * / unpacked tools are kernel — always installed. Gates both listing and
 * invocation, so an uninstalled pack's tools neither list nor run. Default full
 * install ⇒ always true (no behavior change). */
export function isToolInstalled(name, env = process.env) {
  const pack = homePackForTool(name);
  return pack ? isPackInstalled(pack, env) : true;
}

/** Advisory message for a tool whose pack isn't installed, or null if it is.
 * Never a refusal of capability — a pointer to the install that enables it. */
export function installNotice(name, env = process.env) {
  const pack = homePackForTool(name);
  if (!pack || isPackInstalled(pack, env)) return null;
  const installPack = INSTALL_PACK_BY_WING[pack.wing] || pack.wing;
  return `'${name}' belongs to the ${installPack} capability pack, which is not installed on this host (set MOJULO_PACKS to include '${installPack}').`;
}

/** Pack-level advisory used by the dispatcher when a whole pack is uninstalled.
 * Wing-level + terminal on purpose: it tells the model the ENTIRE pack is
 * unavailable and to STOP retrying its tools (anti-spin), while pointing at the
 * install and the other wing. Knowing the pack exists is fine; running it is not.
 * Returns null when the pack is installed. */
export function packInstallNotice(pack, env = process.env) {
  if (!pack || isPackInstalled(pack, env)) return null;
  const installPack = INSTALL_PACK_BY_WING[pack.wing] || pack.wing;
  const otherWing = pack.wing === 'studio' ? 'office' : 'studio';
  return `The ${installPack} capability pack is not installed on this host, so ${pack.id} and its tools cannot run here. Install it (set MOJULO_PACKS to include '${installPack}') to enable them, or stay in the ${otherWing} wing. Do not retry ${installPack}-pack tools until it is installed.`;
}
