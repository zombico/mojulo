/**
 * MCP Ring 6 — primitive binding (Phase A.1).
 *
 * Sibling to mcp-orbit's existing vendor-shaped composer, NOT a replacement.
 * Adds a new tool surface for the primitive-binding architecture so we can
 * compose end-to-end via the runtime-generated provider artifact path while
 * the existing mcp-shaped flow stays intact.
 *
 * Single tool exposed in Phase A.1:
 *   - bind_primitives — given { primitive, role, server, bindings }, looks up
 *     the server's capability snapshot from inventory, runs the deterministic
 *     generator, persists the result as a `mcp_orbit_provider_artifacts`
 *     row, and returns the artifact ref + inline body + binding manifest.
 *
 * Downstream of this tool (Phase A.1 continued):
 *   - meta_context_commit accepts a new event type that references the
 *     artifact ref + binds edges to the bound MCP tools, recording the full
 *     audit chain in the contextmap.
 *
 * See lite-template/integration/MCP_PRIMITIVE_BINDING_PLAN.md.
 */

import { generateProviderArtifact } from '@/lib/mcp/mcp-orbit-components/generator';
import { InventoryRepository } from '@/lib/db/repositories/mcp-inventory';
import { ProviderArtifactRepository } from '@/lib/db/repositories/mcp-orbit-provider-artifacts';
import { MetaContextRepository } from '@/lib/db/repositories/meta-context';
import { registerTool } from '@/lib/mcp/server';

const VALID_ROLES = new Set(['source', 'destination']);
const SNAPSHOT_STALE_SECONDS = 24 * 60 * 60; // 24h

export async function bindPrimitivesHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('bind_primitives requires an object with primitive / role / server / bindings');
  }
  const { primitive, role, server, bindings } = input;

  if (!primitive || typeof primitive !== 'string') {
    throw new Error('`primitive` is required (e.g. "document-store")');
  }
  if (!VALID_ROLES.has(role)) {
    throw new Error(`\`role\` must be one of: ${[...VALID_ROLES].join(', ')}`);
  }
  if (!server || typeof server !== 'string') {
    throw new Error(
      '`server` is required — the inventory server name to bind against (must already be in the declared inventory)',
    );
  }
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) {
    throw new Error(
      '`bindings` must be an object mapping affordance name → { tool, confidence? }',
    );
  }
  for (const [aff, b] of Object.entries(bindings)) {
    if (!b || typeof b !== 'object') {
      throw new Error(`bindings['${aff}'] must be an object { tool, confidence? }`);
    }
    if (!b.tool || typeof b.tool !== 'string') {
      throw new Error(`bindings['${aff}'].tool must be a non-empty string`);
    }
    if (
      b.confidence !== undefined &&
      b.confidence !== null &&
      !['agent-inferred', 'operator-confirmed'].includes(b.confidence)
    ) {
      throw new Error(
        `bindings['${aff}'].confidence must be 'agent-inferred' or 'operator-confirmed' when provided`,
      );
    }
  }

  // Look up the server's capability snapshot from inventory.
  const snapshot = InventoryRepository.snapshotForServer(server);
  if (!snapshot) {
    throw new Error(
      `Server '${server}' is not in the declared inventory. Call meta_context_declare_inventory first with this server's tools.`,
    );
  }

  // Surface inventory freshness hints — the agent decides whether to refresh.
  const warnings = [];
  if (!MetaContextRepository.hasOperator()) warnings.push('no_operator_anchor');
  if (snapshot.introspection_confidence === 'names_only') {
    warnings.push('snapshot_names_only');
  }
  // Compare introspected_at (ISO string) to now.
  const introspectedAtMs = Date.parse(snapshot.introspected_at);
  if (Number.isFinite(introspectedAtMs)) {
    const ageSeconds = Math.floor((Date.now() - introspectedAtMs) / 1000);
    if (ageSeconds > SNAPSHOT_STALE_SECONDS) warnings.push('snapshot_stale');
  }

  // Run the deterministic generator. It throws on unknown primitive / role
  // mismatch / template missing — let those bubble up as tool errors so the
  // agent gets a clear failure.
  const generated = generateProviderArtifact({
    primitive,
    role,
    snapshot,
    bindings,
  });

  // Persist the artifact so its ref is stable across the agent's subsequent
  // composition / dry-run / commit calls.
  const artifact = ProviderArtifactRepository.insert({
    primitiveRef: generated.primitive,
    role: generated.role,
    server: generated.server,
    introspectedAt: generated.introspectedAt,
    snapshotConfidence: generated.snapshotConfidence,
    bodyMd: generated.body,
    manifest: generated.manifest,
    bindings,
  });

  return {
    ok: true,
    artifact: {
      ref: artifact.ref,
      primitiveRef: artifact.primitiveRef,
      role: artifact.role,
      server: artifact.server,
      introspectedAt: generated.introspectedAt,
      snapshotConfidence: generated.snapshotConfidence,
      body: generated.body,
      manifest: generated.manifest,
    },
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

export function registerPrimitiveBindingTools() {
  registerTool({
    name: 'bind_primitives',
    description:
      "Ring 6 — DELIBERATION surface (primitive-binding architecture). Given a primitive (`document-store`, `structured-record-store`, ...), a role (`source` | `destination`), a server name from the declared inventory, and an affordance→tool bindings map, runs the deterministic primitive-binding generator and persists the result as a session-scoped provider artifact. Returns `{ ok, artifact: { ref, primitiveRef, role, server, introspectedAt, snapshotConfidence, body, manifest }, warnings? }`. The `body` is the runtime-generated markdown the agent should read in full before composing — it carries the actual bound tool names and schemas from the operator's installed MCP, not a curated guess. The `manifest.bound` array names each affordance → bound tool + confidence; `manifest.unbound` flags affordances the agent left unbound (often acceptable — e.g. `subscribe-to-changes` is `rare` on most document stores). `warnings` may include `snapshot_stale` (introspection > 24h old, suggest re-declaring inventory) or `snapshot_names_only` (no schemas captured — agent should treat all bindings as `agent-inferred` and seek operator confirmation). **Call order:** ensure inventory is declared with rich snapshots (tools/list schemas + `introspectionConfidence`) → call this tool once per primitive slot in your composition → reference returned `artifact.ref` in the subsequent `meta_context_commit`. Distinct from the existing mcp-orbit composer flow (`recommend_mcp_orbit_compositions` etc.) — that one composes from vendor-shaped components; this one composes from vendor-agnostic primitives bound to runtime-introspected MCPs.",
    inputSchema: {
      type: 'object',
      properties: {
        primitive: {
          type: 'string',
          description:
            "Primitive ref (e.g. 'document-store', 'structured-record-store', 'messaging-channel'). Must match a primitive declared in the mcp-orbit-components/primitive/ directory.",
        },
        role: {
          type: 'string',
          enum: ['source', 'destination'],
          description:
            "Which composition role this MCP plays. The primitive must declare affordances for this role.",
        },
        server: {
          type: 'string',
          description:
            "Server name from the declared inventory (e.g. 'claude_ai_Google_Drive'). The snapshot is looked up from meta_mcp_inventory; if the server isn't in inventory, the call errors.",
        },
        bindings: {
          type: 'object',
          description:
            "Map of affordance name → { tool, confidence }. Affordance names come from the primitive's declared affordances for this role; tool names must match entries in the server's snapshot. Affordances omitted from this map are treated as unbound in the generated artifact. `confidence` is `agent-inferred` (default) or `operator-confirmed`.",
          additionalProperties: {
            type: 'object',
            properties: {
              tool: {
                type: 'string',
                description: "The tool name in the server's snapshot to bind this affordance to.",
              },
              confidence: {
                type: 'string',
                enum: ['agent-inferred', 'operator-confirmed'],
                description: "How confident the binding is. Defaults to `agent-inferred`.",
              },
            },
            required: ['tool'],
          },
        },
      },
      required: ['primitive', 'role', 'server', 'bindings'],
    },
    handler: bindPrimitivesHandler,
  });
}
