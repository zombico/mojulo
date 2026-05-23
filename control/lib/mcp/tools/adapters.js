/**
 * MCP Ring 0.5 — host adapters.
 *
 * Adapters bridge between the host-neutral catalyst recipe and the host-
 * specific runnable artifact (Claude Code skill, Codex automation, generic
 * workflow file). The connecting agent reads the relevant adapter once per
 * session to learn how its substrate materializes catalysts; the agent then
 * passes `host` to `get_catalyst` (or relies on clientInfo auto-binding) and
 * the server composes the adapter body into every catalyst response.
 *
 * See [adapters/loader.js] for the file format and resolution rules, and
 * [tools/catalysts.js] for how adapters are composed into get_catalyst output.
 */

import { getAdapter, listAdapters, resolveAdapterId } from '@/lib/mcp/adapters/loader';
import { getClientInfo } from '@/lib/mcp/client-bindings';
import { registerTool } from '@/lib/mcp/server';

export async function listAdaptersHandler(_input, _ctx) {
  const adapters = listAdapters();
  return { total: adapters.length, adapters };
}

export async function getAdapterHandler(input, ctx) {
  const { id, clientInfoHint } = input || {};
  let resolvedId = id;
  if (!resolvedId) {
    // Resolution order: explicit clientInfoHint (agent self-identifying) >
    // captured clientInfo from initialize (auto-bind) > 'generic' fallback.
    // clientInfoHint matters when the connecting client's clientInfo.name
    // doesn't match any adapter's supportsClientInfoHint list — the agent
    // can pass "codex" / "claude-code" etc. directly to opt into the right
    // adapter.
    const captured = ctx?.mcpSessionId ? getClientInfo(ctx.mcpSessionId) : null;
    resolvedId = resolveAdapterId({
      clientName: clientInfoHint || captured?.name,
    });
  }
  const adapter = getAdapter(resolvedId);
  if (!adapter) throw new Error(`Adapter not found: ${resolvedId}`);
  return adapter;
}

export function registerAdapterTools() {
  registerTool({
    name: 'list_adapters',
    description:
      'List host adapters mojulo ships. An adapter bridges between a portable catalyst recipe and the host-specific runnable artifact that catalyst materializes — e.g. a Claude Code skill at .claude/skills/<slug>/SKILL.md, a Codex automation created via automation_update, or a generic workflow.md + runner script. Returns id, name, summary, artifactTarget, schedulingMechanism, and secretsPosture per adapter. Pair with get_adapter to read the full binding instructions before synthesizing from a catalyst.',
    inputSchema: { type: 'object', properties: {} },
    handler: listAdaptersHandler,
  });

  registerTool({
    name: 'get_adapter',
    description:
      "Get the full body of one host adapter. The body tells you (the connecting agent) how to materialize a catalyst on your specific substrate: artifact format and target path, parameter collection, tool discovery, dry-run enforcement as a concrete first step, scheduling, state storage, output reporting, and secrets posture. Resolution: explicit `id` wins; otherwise `clientInfoHint` wins; otherwise the server uses this session's captured clientInfo.name; otherwise falls back to 'generic'. Pass `clientInfoHint` to self-identify when you know your runtime but your client's clientInfo.name didn't match (e.g. your client reports itself as 'codex-cli-2.1' — pass `clientInfoHint: 'codex'`). Read this once per session; the binding instructions are stable across catalysts. When you later call `get_catalyst` with `host` set to the adapter's id, the server prepends this same adapter body to every catalyst response so the recipe and the host-specific materialization arrive together.",
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            "Adapter id from list_adapters (e.g. 'claude-code', 'codex', 'generic'). When set, wins over all other resolution.",
        },
        clientInfoHint: {
          type: 'string',
          description:
            "Self-identification string the server matches against each adapter's supportsClientInfoHint list (case-insensitive). Use when you know your runtime but the connecting client's clientInfo.name isn't recognized — e.g. pass 'codex' even if your client reports 'codex-cli-2.1'.",
        },
      },
    },
    handler: getAdapterHandler,
  });
}
