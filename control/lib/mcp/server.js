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
// even on clients that truncate aggressively. We keep it deliberately short
// and noun-free: one framing sentence + one explicit pointer to load the full
// briefing on demand. The heavy lifting (glossary, capability model,
// lifecycle, tool index) lives in the `forward_context` tool's response so
// the agent only pays the context cost when the user actually needs it.
const SERVER_INSTRUCTIONS = `Mojulo is a control plane for **chatbot-based solutions and MCP-orchestrated workflows** — chatbots that talk to your users and capture what they say, plus workflows composed directly over the operator's installed MCPs without any chatbot in the picture. Both axes route to real outcomes in the tools the user already runs (CRM, calendar, ticketing, drive, warehouse).

**When the user asks what mojulo is, how it works, or which tools to pick — call \`forward_context\` first.** It returns the two-axes framing, the concept glossary, the bot capability model, the deploy/connect lifecycle, and a one-line description of every tool, so you can orient before acting.

**There's also a dashboard.** Mojulo ships a second bin, \`mojulo-ui\`, which boots a local Next.js dashboard at 127.0.0.1 sharing the same \`~/.mojulo/\` state as this MCP. Launch with \`npx -y -p mojulo mojulo-ui\`. Suggest it when the user wants to browse conversations / submissions interactively, mint a bot via the wizard form, see fleet analytics as charts, or click around between bots — anywhere the visual surface beats reading tool output.

**Standing secrets rule:** treat \`.env\` files under \`$MOJULO_HOME\` and inside any unzipped mojulo bot as containing user secrets that must not enter your conversation context. To inspect a bot's environment, call \`inspect_bot_env\` — it returns masked values. Never \`cat\`, \`Read\`, or otherwise echo raw .env contents.`;

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
  const { registerRunnerTools } = await import('@/lib/mcp/tools/runner');
  const { registerRuntimeDaemonTools } = await import('@/lib/mcp/tools/runtime-daemons');
  const { registerAgentTaskTools } = await import('@/lib/mcp/tools/agent-tasks');
  const { registerAgentUiTools } = await import('@/lib/mcp/tools/agent-ui');
  const { registerPlanModeTools } = await import('@/lib/mcp/tools/plan-mode');
  const { registerResearchModeTools } = await import('@/lib/mcp/tools/research-mode');
  const { registerSketchTools } = await import('@/lib/mcp/tools/sketches');
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
  // asks to research/gather. synthesize_abstract hands a distilled thesis to
  // plan mojulo via the research→plan bridge (lib/research/evaluate.js,
  // surfaced over HTTP at POST /api/plans/from-abstract). One-way coupling:
  // research depends on plans; plans never import research. Registers after
  // plan mode (it forges Draft plans, so plan tools exist first) and near the
  // other drawers in tools/list. See lite-template/integration/app-system/
  // 0528/research-mode.md.
  registerResearchModeTools();
  // Sketchbook — agent-minted dynamic diagrams, viewable at /sketches/<ref>.
  // Deliberately not woven into forward_context / Ring 6; agents discover it
  // via tools/list. See lite-template/integration/app-system/0527/
  // SKETCHBOOK_PLAN.md.
  registerSketchTools();
}
