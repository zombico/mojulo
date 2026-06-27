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
// primitives (stateful MCP server + process supervisor) and name the three
// creatable artifacts with their entry tools, then point at `forward_context`
// as a cheap routing index. The heavy lifting (concept glossary + register,
// deliberation surfaces, full tool index, dashboard map, substrate philosophy)
// lives behind the sibling drawers (`get_register_kit`, `get_tool_index`,
// `get_deliberation_overview`, `get_ui_map`, `get_substrate`) so the agent only
// pays each context cost when a task actually needs it.
// Budget ~180–200 words; paid once per session by every connecting agent.
const SERVER_INSTRUCTIONS = `Mojulo is a stateful MCP server on the operator's host — a SQLite + graph database the agent reads and writes through tools, plus a process supervisor (the runtime daemons) that spawns chatbots and local apps (apps come with their own MCP sidecar that mojulo registers into the local MCP graph). Unlike vendor MCPs (Gmail, Linear, Drive) that proxy a remote service, mojulo's tool calls mutate mojulo's own database — the agent's job is to compose that state into things that keep running after the chat ends.

Three things the agent can create:
- **Bot** — chatbot deployed as its own process. Entry: \`start_new_bot\`.
- **Connected Service** — a workflow over the operator's installed MCPs, no chatbot. Two forms: a Skill synthesized into the host adapter (entry: \`get_catalyst\`), or a materialized mcp-orbit composition (entry: \`meta_context_declare_inventory\` → \`recommend_mcp_orbit_compositions\` or \`bind_primitives\`). Mojulo is the deliberation anchor + audit trail here, not the runtime.
- **App** — local process + MCP sidecar; inference is parked back on the agent (no per-app LLM key). Entry: \`install_scaffold\` → commit → \`start_app\`.

**Standing secrets rule:** treat \`.env\` files under \`$MOJULO_HOME\` and inside any unzipped bot as user secrets. Use \`inspect_bot_env\`, never \`cat\` or \`Read\`.

Most tool descriptions in \`tools/list\` self-route — match the user's framing to a tool and call it. When you're unsure which entry point fits, call \`forward_context\`: it's a cheap routing index (\`user-framing → entry-tool\` rows + a directory of drawers), not a full briefing. Pull a drawer only when a task needs depth — \`get_register_kit\` (concept glossary + narration register), \`get_tool_index\` (every tool), \`get_deliberation_overview\` (the structural/non-bot surfaces), \`get_ui_map\` (dashboard pages), \`get_substrate\` (how mojulo compares to cloud).`;

const registeredTools = new Map();

export function registerTool(tool) {
  if (!tool || !tool.name || typeof tool.handler !== 'function') {
    throw new Error('registerTool requires { name, handler }');
  }
  registeredTools.set(tool.name, tool);
}

export function listTools() {
  return Array.from(registeredTools.values()).map((t) => ({
    name: t.name,
    description: t.description || '',
    inputSchema: t.inputSchema || { type: 'object', properties: {} },
  }));
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
  return await tool.handler(input || {}, context || {});
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
    const result = await tool.handler(toolInput, context);
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
  const { registerStashModeTools } = await import('@/lib/mcp/tools/stash-mode');
  const { registerCookTools } = await import('@/lib/mcp/tools/cook');
  const { registerVisualReferenceTools } = await import('@/lib/mcp/tools/visual-reference');
  const { registerSketchTools } = await import('@/lib/mcp/tools/sketches');
  const { registerModelerLingoTools } = await import('@/lib/mcp/tools/modeler-lingo');
  const { registerManjiTreeTools } = await import('@/lib/mcp/tools/manji-trees');
  const { registerPaintedLandscapeTools } = await import('@/lib/mcp/tools/painted-landscape');
  const { registerCarvedSolidTools } = await import('@/lib/mcp/tools/carved-solid');
  const { registerFigureTools } = await import('@/lib/mcp/tools/figure');
  const { registerSceneCityTools } = await import('@/lib/mcp/tools/scene-city');
  const { registerSceneControllableTools } = await import('@/lib/mcp/tools/scene-controllable');
  const { registerSceneTransportHubTools } = await import('@/lib/mcp/tools/scene-transport-hub');
  const { registerSolidTurntableTools } = await import('@/lib/mcp/tools/solid-turntable-tool');
  const { registerPlanetaryTools } = await import('@/lib/mcp/tools/scene-planetary');
  const { registerMoleculeViewTools } = await import('@/lib/mcp/tools/molecule-view');
  const { registerDnaViewTools } = await import('@/lib/mcp/tools/dna-view');
  const { registerDnaProcessTools } = await import('@/lib/mcp/tools/dna-process');
  const { registerEnergyCycleTools } = await import('@/lib/mcp/tools/energy-cycle');
  const { registerCellularViewTools } = await import('@/lib/mcp/tools/cellular-view');
  const { registerAtomViewTools } = await import('@/lib/mcp/tools/atom-view');
  const { registerMechanicsViewTools } = await import('@/lib/mcp/tools/mechanics-view');
  const { registerOrbitViewTools } = await import('@/lib/mcp/tools/orbit-view');
  const { registerCometViewTools } = await import('@/lib/mcp/tools/comet-view');
  const { registerFieldViewTools } = await import('@/lib/mcp/tools/field-view');
  const { registerFluidViewTools } = await import('@/lib/mcp/tools/fluid-view');
  const { registerOceanViewTools } = await import('@/lib/mcp/tools/ocean-view');
  const { registerGravityWaveViewTools } = await import('@/lib/mcp/tools/gravity-wave-view');
  const { registerParallelTransportViewTools } = await import('@/lib/mcp/tools/parallel-transport-view');
  const { registerWindmillViewTools } = await import('@/lib/mcp/tools/windmill-view');
  const { registerDoubleSlitViewTools } = await import('@/lib/mcp/tools/double-slit-view');
  const { registerBlackHoleViewTools } = await import('@/lib/mcp/tools/black-hole-view');
  const { registerSaturnViewTools } = await import('@/lib/mcp/tools/saturn-view');
  const { registerGalaxyViewTools } = await import('@/lib/mcp/tools/galaxy-view');
  const { registerStarBirthViewTools } = await import('@/lib/mcp/tools/star-birth-view');
  const { registerPulsarViewTools } = await import('@/lib/mcp/tools/pulsar-view');
  const { registerPlasmaGlobeViewTools } = await import('@/lib/mcp/tools/plasma-globe-view');
  const { registerLightningStormViewTools } = await import('@/lib/mcp/tools/lightning-storm-view');
  const { registerWavepacketViewTools } = await import('@/lib/mcp/tools/wavepacket-view');
  const { registerFissionViewTools } = await import('@/lib/mcp/tools/fission-view');
  const { registerCascadeViewTools } = await import('@/lib/mcp/tools/cascade-view');
  const { registerFusionViewTools } = await import('@/lib/mcp/tools/fusion-view');
  const { registerCherenkovViewTools } = await import('@/lib/mcp/tools/cherenkov-view');
  const { registerReactorViewTools } = await import('@/lib/mcp/tools/reactor-view');
  const { registerAtmosphereViewTools } = await import('@/lib/mcp/tools/atmosphere-view');
  const { registerTransformerViewTools } = await import('@/lib/mcp/tools/transformer-view');
  const { registerVectorMatchViewTools } = await import('@/lib/mcp/tools/vector-match-view');
  // education module — math explainers
  const { registerTransformViewTools } = await import('@/lib/mcp/tools/transform-view');
  const { registerFieldFlowViewTools } = await import('@/lib/mcp/tools/field-flow-view');
  const { registerSurfaceViewTools } = await import('@/lib/mcp/tools/surface-view');
  const { registerSeriesViewTools } = await import('@/lib/mcp/tools/series-view');
  const { registerProbabilityViewTools } = await import('@/lib/mcp/tools/probability-view');
  const { registerComplexViewTools } = await import('@/lib/mcp/tools/complex-view');
  const { registerTrigCircleViewTools } = await import('@/lib/mcp/tools/trig-circle-view');
  const { registerPythagorasViewTools } = await import('@/lib/mcp/tools/pythagoras-view');
  const { registerQuadraticViewTools } = await import('@/lib/mcp/tools/quadratic-view');
  const { registerCompleteSquareViewTools } = await import('@/lib/mcp/tools/complete-square-view');
  const { registerConicsViewTools } = await import('@/lib/mcp/tools/conics-view');
  const { registerDerivativeViewTools } = await import('@/lib/mcp/tools/derivative-view');
  const { registerFtcViewTools } = await import('@/lib/mcp/tools/ftc-view');
  const { registerMachinaTools } = await import('@/lib/mcp/tools/machina');
  const { registerWorkbenchTools } = await import('@/lib/mcp/tools/workbench');
  const { registerAssemblerTools } = await import('@/lib/mcp/tools/assembler');
  const { registerPreviewVehicleTools } = await import('@/lib/mcp/tools/preview-vehicle');
  const { registerMotionTools } = await import('@/lib/mcp/tools/motion');
  const { registerOperationsModeTools } = await import('@/lib/mcp/tools/operations-mode');
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
  // create_painted_landscape — closed-vocabulary landscape minter. The model
  // picks one heartbeat + one splatch + an optional structure-glyph; the
  // substrate resolves recipes, samples within ranges using a seed, derives a
  // 4-stop palette from the splatch's three seeds, and renders a flat-Lambert
  // borderless SVG. Persists with manifest.kind === 'painted-landscape'; the
  // /api/sketches/<ref>/svg route dispatches on that kind. Sibling to
  // create_manji_tree — both are sketch-authoring entry points; adjacent
  // ordering keeps illustration tools together in tools/list. See
  // lib/graph/polygonizer/painted-landscape.js for the renderer.
  registerPaintedLandscapeTools();
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
  // create_fractal_city — an autogenerative cityscape from a tiny RECIPE (seed + a
  // few params). Stores ONLY the recipe (kind `fractal-city`); the full city is
  // regenerated deterministically on render by /api/sketches/<ref>/scene as a
  // dependency-free CSS preserve-3d HTML scene. Fractal generation: thousands of
  // boxes from ~6 numbers, near-zero tokens.
  registerSceneCityTools();
  // create_controllable_world — a LIVE, interactive world the user drives (walk a figure, fly a
  // drone). Stores ONLY the recipe (kind `controllable`: entities = transform + rule + body, the
  // camera is an entity); the traversable world regenerates on render at /api/sketches/<ref>/world.
  registerSceneControllableTools();
  // create_transportation_hub — a transit-tuned sibling of create_fractal_city. Stores
  // ONLY the recipe (kind `transportation-hub`); the full hub (terminal + concourse
  // fingers + gates/platforms/bays + apron + runways/rails/lanes + parked aircraft/
  // trains/buses) is regenerated deterministically on render as a dependency-free CSS
  // preserve-3d HTML scene. mode picks airport | train-station | bus-terminal.
  registerSceneTransportHubTools();
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
  registerAssemblerTools();
  // preview_vehicle_instance — render a meta-fabricator vehicle family instance on the workbench
  // studio grid (the catalyst's eyeball-before-commit render affordance).
  registerPreviewVehicleTools();
  // create_planetary — a space-accurate body (Earth) hung in a full celestial sphere (kind
  // `planetary`). Built on the rotatable-starmap basis: a traversable three.js World at /world
  // whose world-fixed FULL-sphere starfield pans as you orbit. The subject fixes the AXIS MUNDI
  // (its tilted polar axis) and the MANDALA (its graticule cage) from the core. Orbit-only — no
  // CSS-3D /scene form. Sibling of the city/hub/workbench world-kinds. See planetary.plan.md.
  registerPlanetaryTools();
  // create_molecule_view — interactive ball-and-stick molecule (atoms + blobpla bond rods) in the
  // World, atoms/bonds pickable → metadata popups; canonically framed on the principal axis. Orbit-only,
  // no CSS-3D /scene form. Science/educational viewer. See molecule-view.plan.md.
  registerMoleculeViewTools();
  // create_dna_view — interactive 3D DNA double helix from one chiral taiji primitive lowered to
  // lit solids (beaded backbones + base-pair rungs), base pairs/backbones pickable → popups. Author
  // by A/T/G/C sequence or base-pair count; handedness = taiji twist sign. Orbit-only science viewer.
  registerDnaViewTools();
  // create_dna_process — animated DNA biology processes (meiosis / conception / recombination /
  // assortment) as a traversable World; the process is selected by `process`. Science explainer.
  registerDnaProcessTools();
  // create_energy_cycle — photosynthesis ⇄ respiration loop (chloroplast + mitochondrion) with a
  // timed reaction cascade; orbit-only science explainer.
  registerEnergyCycleTools();
  // create_cellular_view — interactive 3D cell: organelles (workbench-lowered) in superposition inside
  // a translucent jelly cytoplasm, organelles pickable → metadata popups. Orbit-only science/educational
  // viewer. Sibling of molecule-view. See cellular-view.plan.md.
  registerCellularViewTools();
  // create_atom_view — interactive 3D atom: nucleus + electron orbitals as wave primitives (lathe
  // s-spheres, phase-coloured vajra p-dumbbells with a nodal-plane waist), translucent superposition,
  // orbitals pickable → quantum-number popups. Orbit-only science/educational viewer. See atom-view.plan.md.
  registerAtomViewTools();
  // create_mechanics_view — a classical-Newtonian motion depictor: a solid body translating along its
  // real equal-dt trajectory (projectile / free-fall / inclined-plane / pendulum) with live
  // velocity/accel vectors + readout. Rides emitThreeWorld's mover channel. See mechanics-view.plan.md.
  registerMechanicsViewTools();
  // create_orbit_view — an orbital-mechanics orrery: bodies on real Kepler orbits around a central
  // mass (compressed scale, exact motion — Kepler's 2nd/3rd laws, real-units readout). Rides the
  // mover channel + its faint per-orbit track. See orbit-view.plan.md.
  registerOrbitViewTools();
  // create_comet_view — a comet on a real eccentric Kepler orbit growing a coma + anti-solar ion tail
  // + curved dust tail that bloom near perihelion (the "how the trail is made" sibling of orbit-view).
  // Rides emitThreeWorld's comet channel; path + closeup cameras. See comet-view.plan.md.
  registerCometViewTools();
  // create_field_view — an electromagnetism depictor: a travelling E⊥B wave, or magnetic field lines
  // + iron-filing needles (bar magnet / wire / solenoid). Rides emitThreeWorld's field channel (a
  // lattice of vector arrows + field-line curves). See field-view.plan.md.
  registerFieldViewTools();
  // create_fluid_view — a fluid-dynamics depictor (lift): an airfoil in a real Joukowski potential
  // flow where lift EMERGES (Kutta circulation, faster-over-top, L = ρVΓ). Composes the field +
  // tracer channels. See fluid-view.plan.md.
  registerFluidViewTools();
  // create_ocean_view — an animated ocean surface: a grid mesh deformed per frame by a Gerstner
  // waveform sequence (sum of moving wave trains), lit, with buoys riding the swell. Rides
  // emitThreeWorld's surface channel. See ocean-view.plan.md.
  registerOceanViewTools();
  // create_gravity_wave_view — a spacetime membrane rippling under a compact-binary inspiral: the
  // quadrupole GW strain (chirp → merger → ringdown), two bodies riding the sheet. Rides the surface
  // channel's new `gw` strain mode. See gravity-wave-view.plan.md.
  registerGravityWaveViewTools();
  // create_parallel_transport_view — holonomy made visible: an arrow parallel-transported around a loop
  // returns rotated by the enclosed curvature (Gauss-Bonnet); Foucault / Berry / flat scenarios. Rides
  // the new transport channel. See parallel-transport-view.plan.md.
  registerParallelTransportViewTools();
  // create_windmill_view — air moving a windmill: airfoil blades → lift → torque → a spinning rotor,
  // with wind streamlines. Rides the mover channel's new rotational `spin` mode. See windmill-view.plan.md.
  registerWindmillViewTools();
  // create_double_slit_view — the double-slit experiment as a ripple tank: two coherent slit sources
  // interfere into fringes (+ a quantum particle-buildup scenario). Rides the surface channel's new
  // point-source wavefield mode. See double-slit-view.plan.md.
  registerDoubleSlitViewTools();
  // create_black_hole_view — a Schwarzschild black hole via a per-pixel GR geodesic raymarcher:
  // gravitational lensing of the accretion disk, the photon ring, the shadow, Doppler beaming. Rides
  // emitThreeWorld's new raymarch mode. See black-hole-view.plan.md.
  registerBlackHoleViewTools();
  // create_saturn_view — Saturn + rings via the raymarch shader path: ring shadows on the planet, the
  // planet's shadow on the rings, semi-transparent rings, backlit forward-scatter glow.
  registerSaturnViewTools();
  // create_galaxy_view — a Milky Way barred spiral via a per-pixel VOLUME raymarcher: emission/absorption
  // through a 3-D stellar-density field, real dust-lane extinction (reddening), population colour, ACES
  // tone-map. Rides the same emitThreeWorld raymarch mode as the black hole. See galaxy-view.plan.md.
  registerGalaxyViewTools();
  // create_star_birth_view — a single-star nursery via the galaxy volume idiom: dusty molecular envelope,
  // embedded protostar, accretion disk, and bipolar outflow cavities in one emission/absorption shader.
  registerStarBirthViewTools();
  // create_pulsar_view — a rotating magnetised neutron star: a tiny bright remnant with twin lighthouse
  // beams sweeping from a tilted magnetic axis, via the star-birth/galaxy emission/absorption raymarch path.
  registerPulsarViewTools();
  // create_plasma_globe_view — a Tesla-style plasma globe: discrete jagged arcs leaping from a central
  // electrode to the glass, rendered as EMISSIVE plasma (ext=0) with a two-gas neon→argon/xenon gradient.
  registerPlasmaGlobeViewTools();
  // create_lightning_storm_view — a volumetric fbm storm deck threaded with an electric-arc primitive
  // whose strikes appear, travel along a bowed arc, flash, light the cloud, then vanish (ground / cloud-to-cloud).
  registerLightningStormViewTools();
  // create_wavepacket_view — a time-evolving |ψ(x,t)|² quantum wavepacket (free/coherent/box) via a
  // per-pixel VOLUME raymarcher. Roadmap Tier-1 #1; the first consumer of the reusable volume-raymarch
  // scaffold (lib/graph/volume-raymarch.js). See volume-raymarch.plan.md.
  registerWavepacketViewTools();
  // create_fission_view — the SINGLE fission event (liquid-drop split) as a time-evolving VOLUME.
  // Roadmap Category-3 (topology change), Tier-2 #6; third time-dependent consumer of the volume-raymarch
  // scaffold and first consumer of the shared SDF snippets (lib/graph/sdf-glsl.js). See fission-view.plan.md.
  registerFissionViewTools();
  // create_cascade_view — the CHAIN REACTION (branching neutron cascade) as mesh + movers, played on the
  // renderer's shared-clock mover lifetimes. The mesh companion to fission-view. See fission-view.plan.md.
  registerCascadeViewTools();
  // create_fusion_view — NUCLEAR FUSION (D–T merge → He-4 + neutron) as a time-evolving VOLUME, the
  // release-mechanism counterpart of fission-view (a topology-change MERGE). See fission-view.plan.md.
  registerFusionViewTools();
  // create_cherenkov_view — CHERENKOV RADIATION (the reactor-pool blue glow + the shock cone) as a
  // time-evolving emission VOLUME. A light-transport subject, not a topology change. See fission-view.plan.md.
  registerCherenkovViewTools();
  // create_reactor_view — a CONTROLLED chain reaction (cascade + control rods that absorb neutrons; the
  // SCRAM shutdown vs the runaway). Mesh + the Phase-2 mover lifetimes. See fission-view.plan.md.
  registerReactorViewTools();
  // create_atmosphere_view — atmospheric single-scattering (blue sky / red sunset / limb glow) via a
  // per-pixel VOLUME raymarcher. Roadmap Tier-1 #4; the second consumer of the volume-raymarch scaffold,
  // the one that added its rayDir + occluder generalizations. See volume-raymarch.plan.md.
  registerAtmosphereViewTools();
  // create_transformer_view — the TRANSFORMER's attention mechanic as a traversable World: token
  // strip + the N×N softmax weight matrix (back wall) + a focus token's value-gather streams. The
  // AI-architecture science view; mesh + tracer channel, NOT raymarch. See transformer-view.plan.md.
  registerTransformerViewTools();
  // create_vector_match_view — VECTOR MATCHING (semantic nearest-neighbour search): words as arrows on
  // the unit sphere, a query, and its top-k nearest by cosine. The mechanic behind vector RAG /
  // semantic_search. Mesh + tracer channel, NOT raymarch. See vector-match-view.js.
  registerVectorMatchViewTools();
  // ── education module — math explainers (sibling family to the science views). Advanced (linear
  // algebra → complex analysis) + high-school (geometry / trig / algebra / calculus) tiers; see
  // EDUCATION_VIEW_KINDS in sketch-manifest.js. All orbit-only Worlds on the shared primitives. ──
  registerTransformViewTools();
  registerFieldFlowViewTools();
  registerSurfaceViewTools();
  registerSeriesViewTools();
  registerProbabilityViewTools();
  registerComplexViewTools();
  registerTrigCircleViewTools();
  registerPythagorasViewTools();
  registerQuadraticViewTools();
  registerCompleteSquareViewTools();
  registerConicsViewTools();
  registerDerivativeViewTools();
  registerFtcViewTools();
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
  // Ring 11 (operations mode) — domain-scoped orchestration. An ops tag binds
  // a hand-curated set of committed-reality resources (bots, apps, mcp-orbit
  // compositions, cooks, catalysts, triggers, stashes) under one descriptor.
  // The descriptor is the THESIS members are measured against; the tag is the
  // bound. Consulted, not driving — no execute verb. Distinct from plan
  // (effort-shaped, pre-reality) and from stash (intake-oriented): operations
  // is the far-range domain view ("marketing", "finance"). Registers LAST so
  // every prior ring's resources are discoverable as bindable members. v0
  // ships the primitive only; multi-scope, audit, contextmap-node integration,
  // and the architecture-mode graph extension land in v0.5. See
  // lite-template/integration/app-system/0605/operations-view.md.
  registerOperationsModeTools();
}
