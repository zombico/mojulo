/**
 * MCP Ring 6 — meta_context_declare_inventory.
 *
 * Sibling to meta_context_commit but with REPLACE semantics, not append.
 * The connecting agent declares its current MCP environment (which servers
 * are connected, which tools they expose), and the control plane stores it
 * as a current-state cache so other rings (recommend_catalysts, future
 * composition primitives) can reason about what materials are actually
 * available.
 *
 * The bright line, made visible at the tool surface:
 *   - meta_context_commit   → seal a structural DECISION (append-only)
 *   - meta_context_declare_inventory → state CURRENT ENVIRONMENT (replace)
 *
 * MCP is one-way; mojulo cannot introspect the client. So the agent is the
 * trust anchor for what's actually connected. The replacement semantic +
 * declared_at timestamp + agent guidance to re-declare when the environment
 * changes during connected-service work are the mitigations. The declaration
 * runs on the user's ask, never at session start (directory policy 1.D/2.D:
 * it records the user's other MCP servers).
 *
 * See lite-template/integration/MCP_INVENTORY_PLAN.md for the design.
 */

import { registerTool } from '@/lib/mcp/server';
import { InventoryRepository } from '@/lib/db/repositories/mcp-inventory';
import { MetaContextRepository } from '@/lib/db/repositories/meta-context';

export async function declareInventoryHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('declare_inventory requires an object with a `servers` array');
  }
  const { servers } = input;
  if (!Array.isArray(servers)) {
    throw new Error('`servers` must be an array (use [] to wipe the inventory)');
  }

  const { replaced, inserted, declaredAt } =
    await InventoryRepository.replaceInventoryWithEmbeddings(servers);

  const warnings = [];
  if (!MetaContextRepository.hasOperator()) warnings.push('no_operator_anchor');

  return {
    ok: true,
    serversSeen: servers.length,
    toolsSeen: inserted,
    replaced,
    declaredAt,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

export function registerInventoryTools() {
  registerTool({
    name: 'meta_context_declare_inventory',
    description:
      "Record the operator's other installed MCPs (Gmail, Drive, Calendar, Linear …) so a catalyst can be matched to the source and destination it needs: `get_catalyst` materializes against the declared servers, and `semantic_search` recalls them. Call when the user asks for a workflow across their connected services, and again only if an MCP is added or removed mid-task. Not at session start or unprompted: it stores the names of the user's other MCPs. REPLACE semantics: the latest declaration wins and tools not in this call are wiped (mojulo cannot introspect your environment, so you are the trust anchor). Returns `{ ok, serversSeen, toolsSeen, replaced, declaredAt, warnings? }`.",
    inputSchema: {
      type: 'object',
      properties: {
        servers: {
          type: 'array',
          description: 'Every MCP server connected to this client; `[]` wipes the inventory.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: "Server name as the client sees it ('gmail', 'linear'); the prefix of each tool's ref." },
              tools: {
                type: 'array',
                description: 'Its tools; `[]` when you are not declaring them one by one.',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'Tool name; its ref is `<server>.<tool>`.' },
                    description: { type: 'string', description: "One line from the server's tool list." },
                    inputSchema: { type: 'object', description: "The tool's input JSON Schema, when you have it." },
                    introspectionConfidence: {
                      type: 'string',
                      enum: ['tools_list_full', 'agent_inferred', 'names_only'],
                      description: "Where the entry came from: the MCP's own tools/list, your guess from its name and description, or the name alone.",
                    },
                  },
                  required: ['name'],
                },
              },
            },
            required: ['name', 'tools'],
          },
        },
      },
      required: ['servers'],
    },
    handler: declareInventoryHandler,
  });
}
