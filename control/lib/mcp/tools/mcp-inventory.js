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
      "**Register the operator's broader MCP environment so mojulo can compose solutions that don't require deploying a chatbot.** Mojulo's mainline tooling is heavily bot-shaped (build → deploy → operate → catalyst-against-a-bot); this primitive is the entry point of the other axis — MCP-orchestrated workflows that synthesize over the user's installed MCPs (Gmail/Drive/Calendar/Linear/HubSpot/etc.) directly, with mojulo as the deliberation anchor and audit trail rather than the conversational runtime. Once inventory is declared, the operator's environment is part of mojulo's worldmodel and downstream composition can reason about what materials are actually available. **Call this first** when the user wants outcomes that don't need a conversational layer — operator-side workflows, MCP-to-MCP wiring, scheduled digests, signal-triggered automations — or when they ask to use mojulo without bots. Also call at session start if your environment has changed since the last declaration (new MCP installed, one removed, server reconnected). REPLACE semantics, not append — latest declaration wins; previously declared tools not in this call are wiped (mojulo can't introspect your environment over MCP, so you are the trust anchor and the freshest declaration is the authoritative one). The stored snapshot rides on `meta_context_brief({kind:'fleet'})` (`inventory.declaredAt`, `inventory.ageSeconds`). Distinct from `meta_context_commit` — that seals append-only structural decisions (a sealed catalyst materialization); this declares replaceable current environment state. Returns `{ ok, serversSeen, toolsSeen, replaced, declaredAt, warnings? }`. `warnings: ['no_operator_anchor']` is appended when no operator KYC has been committed yet — inventory still saves; consider offering the KYC if a sustained non-bot workflow is on the table.",
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
