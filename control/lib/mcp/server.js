/**
 * MCP server core — protocol dispatch and tool registry.
 *
 * The Next.js route ([api/mcp/route.js]) handles HTTP + bearer auth and
 * forwards parsed JSON-RPC messages here. This module owns the MCP
 * protocol semantics: initialize / tools/list / tools/call.
 *
 * Tools are registered in rings (see [tools/build.js], [tools/operate.js]).
 * Each registered tool has:
 *   - name, description, inputSchema (JSON Schema)
 *   - handler(input, context) → result | Promise<result>
 *
 * Execution context carries:
 *   - mcpSessionId — used by session-binding.js to attach a BuilderSession
 *   - userId — always 'local' (single-user posture, see auth/service.js)
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { rememberClientInfo } from '@/lib/mcp/client-bindings';
import { instrumentedInvoke } from '@/lib/mcp/telemetry';

export const PROTOCOL_VERSION = '2024-11-05';
export const SERVER_NAME = 'mojulo-control-plane';

// Resolve from package.json so a version bump propagates without a second
// edit. cwd is reliable in all three entry points: stdio bin chdirs to the
// installed package root, the standalone server chdirs to .next/standalone/
// (where Next copies package.json), and `next dev` runs from control/.
let _serverVersion = null;
export function getServerVersion() {
  if (_serverVersion !== null) return _serverVersion;
  try {
    const pkg = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    _serverVersion = pkg.version || '0.0.0';
  } catch {
    _serverVersion = '0.0.0';
  }
  return _serverVersion;
}

// Surfaced to the connecting model on `initialize`. Most MCP clients hand this
// to the agent as a system-prompt-style preamble — it has to fit and stick
// even on clients that truncate aggressively. We lead with mojulo's software
// primitives (stateful MCP server + process supervisor) and name the four
// creatable artifacts with their entry tools, then point at `forward_context`
// as a cheap routing index. The heavy lifting (concept glossary + register,
// deliberation surfaces, full tool index, dashboard map, substrate philosophy)
// lives behind the sibling drawers (`get_register_kit`, `get_tool_index`,
// `get_deliberation_overview`, `get_ui_map`, `get_substrate`) so the agent only
// pays each context cost when a task actually needs it.
// Budget ~230–260 words; paid once per session by every connecting agent.
// Exported for the paradigm-coverage sweep in context.test.js (every PARADIGMS
// member must be named here — the preamble is the first orientation surface).
export const SERVER_INSTRUCTIONS = `Mojulo is a stateful MCP server on the operator's host — a SQLite + graph database the agent reads and writes through tools, plus a process supervisor (the runtime daemons) that spawns chatbots and local apps (apps come with their own MCP sidecar that mojulo registers into the local MCP graph). Unlike vendor MCPs (Gmail, Linear, Drive) that proxy a remote service, mojulo's tool calls mutate mojulo's own database — mojulo is the agent's workshop, and the agent's job is to compose that state into things that keep existing after the chat ends.

Four things the agent can create:
- **Bot** — chatbot deployed as its own process. Entry: \`start_new_bot\`.
- **Connected Service** — a workflow over the operator's installed MCPs, no chatbot. Two forms: a Skill synthesized into the host adapter (entry: \`get_catalyst\`), or a materialized mcp-orbit composition (entry: \`meta_context_declare_inventory\` → \`recommend_mcp_orbit_compositions\` or \`bind_primitives\`). Mojulo is the deliberation anchor + audit trail here, not the runtime.
- **App** — local process + MCP sidecar; inference is parked back on the agent (no per-app LLM key). Entry: \`install_scaffold\` → commit → \`start_app\`.
- **Game** — playable standalone artifact: a typed store + levels that are worlds; a level is refused until proven completable. Entry: \`create_game\`.

The same discipline mints creative artifacts — diagrams, views, walkable worlds, figures, audio, films, publications — as tiny deterministic recipes, never renders. Entries: \`create_sketch\` / \`create_view\` / \`compose_world\` / \`cook\`.

**Standing secrets rule:** treat \`.env\` files under \`$MOJULO_HOME\` and inside any unzipped bot as user secrets. Use \`inspect_bot_env\`, never \`cat\` or \`Read\`.

Most tool descriptions in \`tools/list\` self-route — match the user's framing to a tool and call it. When you're unsure which entry point fits, call \`forward_context\`: it's a cheap routing index (\`user-framing → entry-tool\` rows + a directory of drawers), not a full briefing. Pull a drawer only when a task needs depth — \`get_register_kit\` (concept glossary + narration register), \`get_tool_index\` (every tool), \`get_deliberation_overview\` (the structural/non-bot surfaces), \`get_ui_map\` (dashboard pages), \`get_substrate\` (how mojulo compares to cloud).`;

const registeredTools = new Map();

export function registerTool(tool) {
  if (!tool || !tool.name || typeof tool.handler !== 'function') {
    throw new Error('registerTool requires { name, handler }');
  }
  // Optional `timeoutMs` overrides the global soft-timeout budget for handlers
  // that legitimately run long (heavy render bakes, gif encodes). See the soft
  // timeout in lib/mcp/telemetry.js.
  registeredTools.set(tool.name, tool);
}

export function listTools() {
  // `listed: false` tools (deprecated aliases) resolve in tools/call and
  // invokeRegisteredTool but are omitted from tools/list — retired names keep
  // executing for compiled plans / skills without costing context.
  return Array.from(registeredTools.values())
    .filter((t) => t.listed !== false)
    .map((t) => ({
      name: t.name,
      description: t.description || '',
      inputSchema: t.inputSchema || { type: 'object', properties: {} },
    }));
}

export function isToolListed(name) {
  const tool = registeredTools.get(name);
  return Boolean(tool) && tool.listed !== false;
}

export function hasRegisteredTool(name) {
  return registeredTools.has(name);
}

export function listRegisteredToolNames() {
  return Array.from(registeredTools.keys());
}

/**
 * Invoke a registered tool's handler directly, bypassing JSON-RPC framing.
 * Used by the plan-mode executor to run a compiled manifest of tool calls
 * through the exact same handler path a remote `tools/call` would hit, so
 * executed plans behave identically to operator-typed calls. Throws if the
 * tool is unknown or its handler throws — the executor maps both to the
 * per-call result it records.
 */
export async function invokeRegisteredTool(name, input, context) {
  const tool = registeredTools.get(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  return await instrumentedInvoke(tool, input || {}, context || {}, {
    via: 'plan-executor',
    name,
  });
}

function jsonRpcResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function jsonRpcError(id, code, message, data) {
  const err = { code, message };
  if (data !== undefined) err.data = data;
  return { jsonrpc: '2.0', id, error: err };
}

const ErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
};

export async function dispatchMcpRequest(message, context) {
  if (!message || message.jsonrpc !== '2.0') {
    return jsonRpcError(message?.id ?? null, ErrorCodes.INVALID_REQUEST, 'Invalid JSON-RPC request');
  }

  // Notifications (no id) — we accept and return nothing.
  const isNotification = message.id === undefined || message.id === null;

  try {
    switch (message.method) {
      case 'initialize': {
        // Capture clientInfo so the host adapter resolver (see
        // lib/mcp/adapters/loader.js) can auto-bind an adapter when later
        // get_catalyst / get_adapter calls don't pass an explicit `host`.
        const clientInfo = message.params?.clientInfo;
        if (clientInfo && context?.mcpSessionId) {
          rememberClientInfo(context.mcpSessionId, clientInfo);
        }
        return isNotification
          ? null
          : jsonRpcResult(message.id, {
              protocolVersion: PROTOCOL_VERSION,
              capabilities: {
                tools: { listChanged: false },
              },
              serverInfo: { name: SERVER_NAME, version: getServerVersion() },
              instructions: SERVER_INSTRUCTIONS,
            });
      }

      case 'notifications/initialized':
      case 'initialized':
        return null;

      case 'ping':
        return isNotification ? null : jsonRpcResult(message.id, {});

      case 'tools/list':
        return jsonRpcResult(message.id, { tools: listTools() });

      case 'tools/call':
        return await handleToolCall(message, context);

      default:
        if (isNotification) return null;
        return jsonRpcError(
          message.id,
          ErrorCodes.METHOD_NOT_FOUND,
          `Method not found: ${message.method}`
        );
    }
  } catch (err) {
    console.error('[mcp] dispatch error:', err);
    if (isNotification) return null;
    return jsonRpcError(
      message.id,
      ErrorCodes.INTERNAL_ERROR,
      err.message || 'Internal error'
    );
  }
}

async function handleToolCall(message, context) {
  const params = message.params || {};
  const toolName = params.name;
  const toolInput = params.arguments || {};

  const tool = registeredTools.get(toolName);
  if (!tool) {
    return jsonRpcError(
      message.id,
      ErrorCodes.METHOD_NOT_FOUND,
      `Unknown tool: ${toolName}`
    );
  }

  try {
    const result = await instrumentedInvoke(tool, toolInput, context, {
      via: 'rpc',
      name: toolName,
    });
    return jsonRpcResult(message.id, toMcpToolResult(result));
  } catch (err) {
    // Per MCP spec, tool execution failures are returned as a tool_result
    // with isError: true rather than a JSON-RPC error — so the client model
    // can see the failure and react.
    return jsonRpcResult(message.id, {
      content: [{ type: 'text', text: err.message || 'Tool execution failed' }],
      isError: true,
    });
  }
}

function toMcpToolResult(result) {
  if (result && typeof result === 'object' && Array.isArray(result.content)) {
    // Tool already returned MCP-shaped content; trust it.
    return result;
  }
  const text =
    typeof result === 'string' ? result : JSON.stringify(result ?? {}, null, 2);
  return { content: [{ type: 'text', text }] };
}

// Tool registrations run on first request rather than at module load. We use
// dynamic import to avoid a circular dependency: tool modules import
// `registerTool` from this file.
let _registered = false;
export async function ensureToolsRegistered() {
  if (_registered) return;
  _registered = true;
  const { registerContextTools } = await import('@/lib/mcp/tools/context');
  const { registerWorkedExampleTools } = await import('@/lib/mcp/tools/worked-examples');
  const { registerAdapterTools } = await import('@/lib/mcp/tools/adapters');
  const { registerBuildTools } = await import('@/lib/mcp/tools/build');
  const { registerJobsTools } = await import('@/lib/mcp/tools/jobs-tools');
  const { registerOperateTools } = await import('@/lib/mcp/tools/operate');
  const { registerFleetTools } = await import('@/lib/mcp/tools/fleet');
  const { registerCatalystTools } = await import('@/lib/mcp/tools/catalysts');
  const { registerMetaContextTools } = await import('@/lib/mcp/tools/meta-context');
  const { registerInventoryTools } = await import('@/lib/mcp/tools/mcp-inventory');
  const { registerSkillsTools } = await import('@/lib/mcp/tools/skills');
  const { registerCapabilitiesTools } = await import('@/lib/mcp/tools/mcp-capabilities');
  const { registerMCPOrbitTools } = await import('@/lib/mcp/tools/mcp-orbit');
  const { registerPrimitiveBindingTools } = await import('@/lib/mcp/tools/mcp-primitive-binding');
  const { registerTriggerBindingTools } = await import('@/lib/mcp/tools/mcp-trigger-binding');
  const { registerSemanticSearchTools } = await import('@/lib/mcp/tools/semantic-search');
  const { registerWhatPossibleTools } = await import('@/lib/mcp/tools/what-possible');
  const { registerRunnerTools } = await import('@/lib/mcp/tools/runner');
  const { registerRuntimeDaemonTools } = await import('@/lib/mcp/tools/runtime-daemons');
  const { registerAgentTaskTools } = await import('@/lib/mcp/tools/agent-tasks');
  const { registerAgentUiTools } = await import('@/lib/mcp/tools/agent-ui');
  const { registerPlanModeTools } = await import('@/lib/mcp/tools/plan-mode');
  const { registerResearchModeTools } = await import('@/lib/mcp/tools/research-mode');
  const { registerResearchSweepTools } = await import('@/lib/mcp/tools/research-sweep');
  const { registerStashModeTools } = await import('@/lib/mcp/tools/stash-mode');
  const { registerCookTools } = await import('@/lib/mcp/tools/cook');
  const { registerVisualReferenceTools } = await import('@/lib/mcp/tools/visual-reference');
  const { registerSketchTools } = await import('@/lib/mcp/tools/sketches');
  const { registerRenderHandoffTools } = await import('@/lib/mcp/tools/render-handoff');
  const { registerModelerLingoTools } = await import('@/lib/mcp/tools/modeler-lingo');
  const { registerManjiTreeTools } = await import('@/lib/mcp/tools/manji-trees');
  const { registerCarvedSolidTools } = await import('@/lib/mcp/tools/carved-solid');
  const { registerFigureTools } = await import('@/lib/mcp/tools/figure');
  const { registerFigureSpecTools } = await import('@/lib/mcp/tools/figure-specs');
  const { registerComposeWorldTools } = await import('@/lib/mcp/tools/compose-world');
  const { registerCreateViewTools } = await import('@/lib/mcp/tools/create-view');
  const { registerMeasureViewTools } = await import('@/lib/mcp/tools/measure-view');
  const { registerSolidTurntableTools } = await import('@/lib/mcp/tools/solid-turntable-tool');
  const { registerDnaProcessTools } = await import('@/lib/mcp/tools/dna-process');
  const { registerEnergyCycleTools } = await import('@/lib/mcp/tools/energy-cycle');
  const { registerMachinaTools } = await import('@/lib/mcp/tools/machina');
  const { registerWorkbenchTools } = await import('@/lib/mcp/tools/workbench');
  const { registerEdificeTools } = await import('@/lib/mcp/tools/edifice');
  const { registerAssemblerTools } = await import('@/lib/mcp/tools/assembler');
  const { registerPreviewVehicleTools } = await import('@/lib/mcp/tools/preview-vehicle');
  const { registerMotionTools } = await import('@/lib/mcp/tools/motion');
  const { registerBeatsTools } = await import('@/lib/mcp/tools/beats');
  const { registerVoiceTools } = await import('@/lib/mcp/tools/voice');
  const { registerGameTools } = await import('@/lib/mcp/tools/create-game');
  // Order matters only for tools/list output (insertion order). Putting
  // forward_context first means clients that surface the tool list to the
  // model see the orientation tool at the top. Adapter tools sit next to
  // orientation (they're the binding-orientation surface). Fleet tools sit
  // between per-bot operate and catalysts so the natural reading order is
  // per-bot → fleet → outcome. meta_context registers LAST as Ring 6 — it's
  // a deliberation surface, not an orientation or action surface, and reading
  // order should put it after the action rings. Inventory registers
  // immediately after the contextmap tools — it's the third Ring 6 surface
  // (current-environment cache alongside the append-only contextmap).
  // mcp-orbit tools register after inventory (composer ON TOP of inventory).
  // bind_primitives + bind_trigger are the composer-anchored binding surfaces
  // — bind_primitives operationalizes the `mcp` axis of mcp-orbit, bind_trigger
  // operationalizes the `trigger` axis. Both resolve a typed component_ref
  // against the composer's component store and materialize a session-scoped
  // artifact. They register adjacent so the natural reading order is
  // composer → primitive binding → trigger binding → semantic recall.
  // See MCP_PRIMITIVE_BINDING_PLAN.md and TRIGGER_BINDING_PLAN.md.
  registerContextTools();
  registerWorkedExampleTools();
  registerAdapterTools();
  registerBuildTools();
  registerJobsTools();
  registerOperateTools();
  registerFleetTools();
  registerCatalystTools();
  registerMetaContextTools();
  registerInventoryTools();
  // declare_skills registers immediately after inventory — both are
  // present-environment, replace-semantic declarations the agent makes about
  // the host (inventory = MCP servers/tools; skills = host-adapter skills).
  // Together they feed the Connected Services view. See
  // app-system/0527/CONNECTED_SERVICES_CANONIZATION_PLAN.md.
  registerSkillsTools();
  // Capabilities tools (record_mcp_capabilities / get_mcp_capabilities) slot
  // immediately after inventory — they're the research-facet sibling to
  // inventory's introspection-facet. Both write into provider rows on the
  // meta_mcp_providers identity layer; the agent reads them through the
  // composer's consolidated provider view.
  registerCapabilitiesTools();
  registerMCPOrbitTools();
  registerPrimitiveBindingTools();
  registerTriggerBindingTools();
  // semantic_search registers LAST within Ring 6 — it's a recall-over-state
  // tool that complements every prior Ring 6 reader (brief, inventory,
  // capabilities, composer, primitive-binding). Slotting it at the end of
  // the ring keeps the reading order: orientation → action → deliberation
  // (structured walks) → deliberation (fuzzy recall). See
  // lite-template/integration/SEMANTIC_INDEX_PLAN.md.
  registerSemanticSearchTools();
  // sketch_what_possible — domain-specific retrieval over sketch_method
  // records (inverse-stable-diffusion knob loop for scene/figure
  // illustration). Slots immediately after semantic_search since it's a
  // thin specialization of the same retrieval surface, scoped to the
  // create_sketch front-end.
  registerWhatPossibleTools();
  // Ring 7 (runtime) — daemon host lifecycle + app runner + agent-tasks
  // (mojulo's opinionated runtime primitive for agent-mediated,
  // schema-validated work: pull_agent_task → submit_envelope_inference (or
  // other per-kind submit tools) → cancel_agent_task). Runner tools register
  // first so the natural reading order in tools/list is lifecycle
  // (install_scaffold → start_app → status_app → stop_app) → daemon host
  // lifecycle (list/status/start/stop/restart) → agent-tasks (pull → submit
  // → cancel). See APP_SPIKE_B_RUNNER_AND_SCHEMA_PLAN.md and
  // APP_SPIKE_A_REFRAME_PLAN.md.
  registerRunnerTools();
  registerRuntimeDaemonTools();
  registerAgentTaskTools();
  // agent-ui registers right after agent-tasks — it's the chat-builder worker's
  // narration + decision surface, used while fulfilling a `chat_turn` task. The
  // reading order in tools/list stays pull → submit → cancel → emit → decide.
  registerAgentUiTools();
  // Ring 8 (plan mode) — the PROPOSED layer of the deliberation model: the
  // speculative counterpart to contextmap's committed reality. Sessions that
  // accumulate enough signal forge into Plans (sealed spike schematics) that
  // compile to a manifest of tool calls and execute under per-execution
  // operator approval. Registers after the action + runtime rings: a plan's
  // manifest composes the lower rings, so the executor needs them registered
  // first. See lite-template/integration/app-system/0527/plan-feature/
  // PLAN_MODE.md.
  registerPlanModeTools();
  // Ring 9 (research mode) — the ACCRETIVE / exploratory layer upstream of
  // plans. A low-prominence OPTIONAL DRAWER (posture-sibling to sketches):
  // deliberately NOT woven into forward_context, entered only when the user
  // asks to research/gather. The legacy research-book path still ships
  // (start_research / bind_research_item / synthesize_abstract) for existing
  // books; new gatherings should prefer the typed-intake stash path below.
  // synthesize_abstract hands a distilled thesis from a legacy book to plan
  // mojulo via the research→plan bridge (lib/research/evaluate.js, surfaced
  // over HTTP at POST /api/plans/from-abstract); cook outcomes hand to plan
  // mode via the cook→plan bridge on forge_plan's `source` parameter. One-way
  // coupling either way: research/cook depend on plans; plans never import
  // research/cook. Registers after plan mode (it forges Draft plans, so plan
  // tools exist first) and near the other drawers in tools/list. See
  // lite-template/integration/app-system/0528/research-mode.md and
  // 0601/RESEARCH_PATH_CONVERGENCE.md for the cook-stays-at-cook framing.
  registerResearchModeTools();
  // run_experiment_sweep — the parameter sweep as one deterministic call: N mechanics-view
  // mints + N provenance-carrying experiment binds + an auto-plotted param-vs-outcome
  // figure, all into one research book. Registers immediately after research-mode so the
  // sweep verb reads beside the bind/synthesize verbs it composes. See
  // research-science.plan.md (Phase 5).
  registerResearchSweepTools();
  // Ring 9 (stash mode) — the sharper-edged successor to research_sessions.
  // Gather/Stash/Drawer with a typed intake contract (seven item types, each
  // with required-per-type metadata validated at the gate). Registers
  // immediately after research-mode so legacy research_* tools and the new
  // stash_* tools sit adjacent in tools/list (coexistence — migration option
  // 3). See lite-template/integration/app-system/0531/GATHER_STASH_COOK.md.
  // Cook + Outcome Artifacts ship as a sibling registration in slice 2.
  registerStashModeTools();
  // Cook — the multi-input collider on Stashes. Materializes an Outcome
  // Artifact (folder under control/data/outcomes/<cook_ref>/ with
  // agent-authored report.md, static index.html, manifest.json, optional
  // visuals). Authoring model: AGENT authors the report; cook only files it.
  // No server-side LLM call. Registers immediately after stash-mode so
  // related verbs sit adjacent in tools/list. See
  // lite-template/integration/app-system/0531/GATHER_STASH_COOK.md.
  registerCookTools();
  // Visual Reference — the harness-as-vision-adapter scaffold. `reference_protocol`
  // hands the model HOW to read a photo it already sees (scene perspective / human
  // pose) into mojulo's own dials; `capture_reference` SINKS that read into a stash
  // as a reusable cage + insights. Registers immediately before the illustration
  // tools because a reference is the UPSTREAM scaffold they build inside (scene →
  // a perspective-frame sketch to preload; pose → a figure dummy to re-pose), and
  // the cage it mints rides the same SketchRepository the illustration tools serve.
  // No vision key, no pixels-for-understanding over the wire — only the model's
  // structured read. See lite-template/integration/0612/visual-reference.plan.md.
  registerVisualReferenceTools();
  // Sketchbook — agent-minted dynamic diagrams, viewable at /sketches/<ref>.
  // Deliberately not woven into forward_context / Ring 6; agents discover it
  // via tools/list. See lite-template/integration/app-system/0527/
  // SKETCHBOOK_PLAN.md.
  registerSketchTools();
  // The render handoff (render-handoff.plan.md) — durable request → pull →
  // submit → accept for the external image worker; registered right after the
  // sketch tools it extends (get_image_render_packet / bind_image_render).
  registerRenderHandoffTools();
  // translate_modeler_lingo — routes 3D-modeler vocabulary (blockout, retopo, kitbash,
  // bake, rig…) to mojulo execution + the export_model handoff, the modeler-facing
  // sibling of forward_context. Adjacent to registerSketchTools (its routes point at the
  // create_* / export_model surface those tools register). See modeler-lingo.js.
  registerModelerLingoTools();
  // create_manji_tree — the manji-program tree IR as a first-class authoring
  // surface. Mints into SketchRepository with manifest.kind === 'manji-tree';
  // the /api/sketches/<ref>/svg route dispatches on that kind to walk + project
  // + render the tree. Adjacent to registerSketchTools so the agent sees both
  // sketch-authoring paths next to each other in tools/list. See
  // lite-template/integration/0604/polygonizer-manji-tree.plan.md.
  registerManjiTreeTools();
  // create_carved_solid — a CARVED, metalified 3D solid (wordmark / logo / icon)
  // from any vector outline. Sits next to the other illustration mints; persists
  // with kind `carved-solid`, rendered by the /api/sketches svg route.
  registerCarvedSolidTools();
  // create_figure — a POSED protoform human figure (armature + flesh + spine bend
  // + garments). Sits next to the other illustration mints; persists with kind
  // `figure`, rendered by the /api/sketches svg route. The figure is a pure
  // function of (pose, proto, garment) — posing = choosing dials, clamped by the
  // armature LIMITS + spine caps. See lite-template/integration/0610/
  // figure-spine-articulation.plan.md and figure-proto-params.plan.md.
  registerFigureTools();
  // draft_figure_spec / get_figure_spec / resolve_figure_spec / build_figure_spec — the
  // character-from-dream propose→approve→build split (listed:false; the catalyst documents it).
  registerFigureSpecTools();
  // compose_world / list_world_themes — the generic world-composer: a BASE (geometry generator)
  // × a THEME (flavor pack from theme-registry) × overrides, minted through the same recipe→
  // render path as create_fractal_city. One tool → many worlds; themes extensible across
  // earth/scifi/fantasy families. MVP base: 'city'. See world-composer.plan.md.
  registerComposeWorldTools();
  // create_view / get_view_vocab — the consolidated study-object entry point
  // (science / math / bio explainers; the former 43 create_*_view tools) plus
  // the vocab-card reader that also serves compose_world's base manuals. The
  // per-kind prose lives in view-vocab cards behind semantic_search — see
  // tool-list-drawerization.plan.md. Registers right after compose_world so
  // the two consolidated visual entries read adjacently in tools/list. The
  // retired per-kind names remain callable as unlisted aliases.
  registerCreateViewTools();
  // measure_view — the physical read-back channel for the SI-honest science views
  // (mechanics-view dynamics, orbit-view): re-plan from the stored recipe, return the
  // time-series in declared real units. Registers right after create_view so mint and
  // measure read adjacently in tools/list. Also exports recomputeViewStats — the
  // deterministic reviewer behind research mode's synthesize_abstract({ review:true }).
  // See research-science.plan.md.
  registerMeasureViewTools();
  // create_solid_turntable — a single convex solid (lit ball / crystal polyhedron / gem)
  // spinning LIVE in CSS-3D from a tiny recipe (kind `css3d-turntable`). Highlight fixed in
  // the viewport via per-frame vexar re-shade. The live counterpart to the baked forge_motion
  // turntable — single convex solids only; interpenetrating molecules/helices stay baked.
  registerSolidTurntableTools();
  // create_workbench — a measured OBJECT vantage (kind `workbench`): a polygomer of `lathe`
  // monomers (candlestick / bottle / dumbbell …) baked via latheToFaces onto a measured grid at
  // literal scale, served traversable at /world + preset shots at /scene. Object-scale sibling of
  // the city/hub world-kinds; form accuracy over mood.
  registerWorkbenchTools();
  // create_edifice — a bespoke inhabitable BUILDING (kind `edifice`): a graph of MASSES
  // (footprint + floors + facade + roof + interior) connected by CONCOURSES, placed by
  // relation, rendered walkable. The building-scale sibling of create_workbench; for
  // one-off buildings the frozen fractal generators don't make. Advisory livability,
  // never gated. See dream-architecture.plan.md + the dream-edifice catalyst.
  registerEdificeTools();
  registerAssemblerTools();
  // preview_vehicle_instance — render a meta-fabricator vehicle family instance on the workbench
  // studio grid (the catalyst's eyeball-before-commit render affordance).
  registerPreviewVehicleTools();
  // create_dna_process — animated DNA biology processes (meiosis / conception / recombination /
  // assortment) as a traversable World; the process is selected by `process`. Science explainer.
  registerDnaProcessTools();
  // create_energy_cycle — photosynthesis ⇄ respiration loop (chloroplast + mitochondrion) with a
  // timed reaction cascade; orbit-only science explainer.
  registerEnergyCycleTools();
  registerMachinaTools();
  // forge_motion — put a manji-tree subject IN MOTION and render it to an
  // animated artifact (CSS flipbook SVG + GIF). An OUTPUT concern, sibling to
  // illustration and cook: it consumes a static subject and adds time. Registers
  // immediately after the illustration tools because it CONSUMES their output —
  // "make a picture → make it move" sit adjacent in tools/list. Filed as a
  // Motion Project resource group (ops tag + subject/recipe stash + outcome
  // folder), reusing existing primitives rather than a bespoke layer. Phase 1
  // ships subject-agnostic camera motions; performance motions land in Phase 2.
  // See lite-template/integration/0609/motion-as-mcp-concern.plan.md.
  registerMotionTools();
  // Mojulo Beats — the AUDIO mint, sibling to the visual mints: seeded
  // generative soundtracks, explicit-score compositions, and gesture-built
  // foley cues, all synthesized-WebAudio recipes (no media bytes stored).
  // Registers after motion so picture → motion → sound read adjacent in
  // tools/list. See lib/graph/beats/beats.plan.md.
  registerBeatsTools();
  // Mojulo Voice — the SPEECH mint, sibling to beats: voice registers as
  // deterministic axis→blend recipes over stock Kokoro embeddings; rendering
  // stays with an external worker through the voice seam. Registers after
  // beats so audio reads adjacent. See lib/graph/voice/voice-worker.plan.md.
  registerVoiceTools();
  // Mojulo Game Designer — the fourth creatable paradigm (sibling to bots /
  // connected services / apps): a standalone game artifact = a shell owning a
  // typed store + levels that are worlds minted with a `game:` contract channel.
  // Registers after beats so the visual-mint cluster (world → view → motion →
  // sound → game) reads adjacent in tools/list. See game-metacontext.plan.md.
  registerGameTools();
}
