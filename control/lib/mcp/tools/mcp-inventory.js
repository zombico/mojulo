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
 * declared_at timestamp + agent guidance to re-declare on session start are
 * the mitigations.
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

  const { replaced, inserted, declaredAt } = InventoryRepository.replaceInventory(servers);

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
      "Register the operator's installed MCPs (Gmail/Drive/Calendar/Linear/HubSpot/etc.) so the mcp-orbit composer has materials to compose against. **Call first** when the user wants outcomes without a chatbot — operator-side workflows, MCP-to-MCP wiring, scheduled digests, signal-triggered automations — or at session start if your MCP environment has changed (new MCP installed, one removed). REPLACE semantics — latest declaration wins; tools not in this call are wiped (mojulo can't introspect your environment, so you are the trust anchor). Distinct from `meta_context_commit`, which seals append-only structural decisions. Snapshot rides on `meta_context_brief({kind:'fleet'})` as `inventory.{declaredAt, ageSeconds, toolCount}`. **Richer-snapshot mode (recommended when binding primitives):** include each tool's `inputSchema` and `introspectionConfidence` to upgrade the declaration into a capability snapshot the primitive-binding generator can consume directly. `introspectionConfidence` values: `tools_list_full` (you read the full schema from the MCP's tools/list), `agent_inferred` (you guessed the schema from tool name + description), `names_only` (you only know the tool exists). Returns `{ ok, serversSeen, toolsSeen, replaced, declaredAt, warnings? }` — `warnings: ['no_operator_anchor']` means inventory saved but no KYC; consider offering it if a sustained non-bot workflow is on the table.",
    inputSchema: {
      type: 'object',
      properties: {
        servers: {
          type: 'array',
          description:
            'Every MCP server currently connected to this client. Pass `[]` to explicitly wipe the inventory (e.g., when reporting that nothing is connected).',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description:
                  "Server name as the client sees it (e.g., 'gmail', 'gdrive', 'linear', 'hubspot'). Used as the prefix in canonical tool refs.",
              },
              tools: {
                type: 'array',
                description:
                  "Tools this server exposes. Use [] if the server is connected but you're not declaring its tools individually.",
                items: {
                  type: 'object',
                  properties: {
                    name: {
                      type: 'string',
                      description:
                        "Tool name. Combined with the server name into the canonical ref `${server}.${tool}`.",
                    },
                    description: {
                      type: 'string',
                      description:
                        "One-line description from the server's tool list. Optional but helps future readers and downstream consultation tools.",
                    },
                    inputSchema: {
                      type: 'object',
                      description:
                        "The tool's JSON Schema for its input parameters (typically from the MCP's tools/list response). When provided, downstream primitive binding can render the actual schema into generated provider artifacts instead of guessing. Optional.",
                    },
                    introspectionConfidence: {
                      type: 'string',
                      enum: ['tools_list_full', 'agent_inferred', 'names_only'],
                      description:
                        "How this tool entry was sourced. `tools_list_full` = inputSchema is from the MCP's actual tools/list; `agent_inferred` = inputSchema reflects an educated guess; `names_only` = no inputSchema available. Optional but recommended when you intend to bind primitives against this MCP.",
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
