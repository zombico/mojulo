/**
 * MCP Ring 6 — record_mcp_capabilities + get_mcp_capabilities.
 *
 * Sibling to meta_context_declare_inventory but covers the **research** facet
 * of a provider, not the introspection facet. The agent populates these rows
 * by running the [research-mcp-vendor](../catalysts/research-mcp-vendor.md)
 * catalyst — read primary sources, synthesize the body, cite the URLs, write
 * via record_mcp_capabilities. The catalyst is the methodology; these are
 * the persistence tools it drives.
 *
 * Both tools key on canonical `providerRef` (lowercase vendor name like
 * `gmail`, `notion`, `linear`). Inventory's introspection facet and these
 * research-facet rows converge on the same meta_mcp_providers row, so the
 * composer reads them as one consolidated picture.
 *
 * record_mcp_capabilities is append-with-supersession: a new write for an
 * existing provider supersedes the prior current row in one transaction.
 * Re-running it is safe by design — the supersession chain records the
 * trajectory.
 *
 * get_mcp_capabilities is a read-only lookup. Defaults to the current row;
 * pass `asOf` (ISO 8601 string) to walk the supersession chain for the row
 * that was current at that time.
 *
 * See lite-template/integration/MCP_DECURATION_PLAN.md.
 */

import { registerTool } from '@/lib/mcp/server';
import { CapabilitiesRepository } from '@/lib/db/repositories/mcp-capabilities';
import { MetaContextRepository } from '@/lib/db/repositories/meta-context';
import { seedMcpCapabilities, indexSeededCapabilities } from '@/lib/mcp/seeds/mcp-capabilities-seed';

function parseIsoToUnixSeconds(iso) {
  if (typeof iso !== 'string' || iso.length === 0) {
    throw new Error('asOf must be a non-empty ISO 8601 string');
  }
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    throw new Error(`asOf is not a valid ISO 8601 timestamp: "${iso}"`);
  }
  return Math.floor(ms / 1000);
}

export async function recordCapabilitiesHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('record_mcp_capabilities requires an object input');
  }
  const { provider_ref, display_name, version_tag, body_md, source_urls } = input;

  if (typeof provider_ref !== 'string' || provider_ref.trim().length === 0) {
    throw new Error('record_mcp_capabilities: `provider_ref` is required (non-empty string)');
  }
  if (typeof body_md !== 'string' || body_md.trim().length === 0) {
    throw new Error('record_mcp_capabilities: `body_md` is required (non-empty string)');
  }

  const result = await CapabilitiesRepository.insertWithEmbedding({
    providerRef: provider_ref.trim(),
    displayName: display_name ?? null,
    versionTag: version_tag ?? null,
    bodyMd: body_md,
    sourceUrls: source_urls ?? null,
  });

  const warnings = [];
  if (!MetaContextRepository.hasOperator()) warnings.push('no_operator_anchor');

  return {
    ok: true,
    id: result.id,
    providerId: result.providerId,
    providerRef: result.providerRef,
    versionTag: result.versionTag,
    discoveredAt: result.discoveredAt,
    supersededId: result.supersededId,
    provenance: result.provenance,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

export async function getCapabilitiesHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('get_mcp_capabilities requires an object input');
  }
  const { provider_ref, asOf } = input;

  if (typeof provider_ref !== 'string' || provider_ref.trim().length === 0) {
    throw new Error('get_mcp_capabilities: `provider_ref` is required (non-empty string)');
  }
  const ref = provider_ref.trim();

  const row =
    asOf !== undefined && asOf !== null
      ? CapabilitiesRepository.getAsOf(ref, parseIsoToUnixSeconds(asOf))
      : CapabilitiesRepository.getCurrent(ref);

  if (!row) {
    return {
      ok: true,
      found: false,
      providerRef: ref,
      hint:
        'No capability row recorded for this provider. Run the `research-mcp-vendor` catalyst (get_catalyst then materialize) to populate.',
    };
  }

  return {
    ok: true,
    found: true,
    providerRef: ref,
    id: row.id,
    providerId: row.providerId,
    versionTag: row.versionTag,
    bodyMd: row.bodyMd,
    sourceUrls: row.sourceUrls,
    discoveredAt: row.discoveredAt,
    supersededBy: row.supersededBy,
  };
}

export function registerCapabilitiesTools() {
  // Seed the shipped vendor bodies if not already present. Idempotent
  // per-provider — only inserts where no capability row exists yet, so
  // agent-authored research rows are never overwritten.
  let seededProviders = [];
  try {
    const result = seedMcpCapabilities();
    seededProviders = result.providers || [];
  } catch (err) {
    // Match the mcp-orbit loader's failure posture: log + continue, so a
    // bad seed file doesn't take down the tool registration.
    // eslint-disable-next-line no-console
    console.error('[mcp-capabilities] seedMcpCapabilities failed:', err.message);
  }
  // Index the freshly-seeded vendor bodies into meta_embeddings so the
  // sidecar is populated on first install. Fire-and-forget — embedding
  // failure is soft (recall degrades, host writes still committed) and tool
  // registration must not block on the ONNX model load.
  if (seededProviders.length > 0) {
    indexSeededCapabilities(seededProviders).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[mcp-capabilities] indexSeededCapabilities failed:', err.message);
    });
  }

  registerTool({
    name: 'record_mcp_capabilities',
    description:
      "Write what you researched about one of the operator's other MCPs (`gmail`, `notion`, `linear`) as its capability body. Call after the `research-mcp-vendor` catalyst, which teaches the sources to use and the body's shape; this is the write it drives. A new write becomes current and the old one is kept (read it back with `get_mcp_capabilities`'s `asOf`), so re-running is safe. `provider_ref` is the lowercase vendor key (`gmail`, not the install alias `claude_ai_Gmail`), shared with the declared inventory. Returns the row's id, `supersededId` and `provenance` ('research' or 'seed').",
    inputSchema: {
      type: 'object',
      properties: {
        provider_ref: { type: 'string', description: 'Lowercase vendor key: `gmail`, `notion`, `google_drive`. One token, underscores between words.' },
        display_name: { type: 'string', description: 'Readable vendor name (`Gmail`). The first write keeps it.' },
        version_tag: { type: 'string', description: "The vendor's declared API version, verbatim (`API 2025-09-03`). Omit when none is published; never invent one." },
        body_md: { type: 'string', description: 'The capability body: markdown with JSON frontmatter, in the shape the `research-mcp-vendor` catalyst defines. Returned as written.' },
        source_urls: { type: 'array', items: { type: 'string' }, description: 'Every URL consulted, in priority order. A leading `mojulo://` URL marks a build-time seed.' },
      },
      required: ['provider_ref', 'body_md'],
    },
    handler: recordCapabilitiesHandler,
  });

  registerTool({
    name: 'get_mcp_capabilities',
    description:
      "Read the capability body recorded for one of the operator's other MCPs, by its lowercase `provider_ref` (`gmail`, `notion`, `linear`): its surfaces, pitfalls and how intents map onto it, which reading its tool list alone does not tell you. Call before a catalyst works against that MCP. `asOf` (ISO 8601) returns the body that was current at that time. `found: false` comes with a `hint` to the `research-mcp-vendor` catalyst; `found: true` returns `{ id, versionTag, bodyMd, sourceUrls, discoveredAt, supersededBy }` (`supersededBy: null` is the current row).",
    inputSchema: {
      type: 'object',
      properties: {
        provider_ref: { type: 'string', description: 'Lowercase vendor key, as written by `record_mcp_capabilities`: `gmail`, not `claude_ai_Gmail`.' },
        asOf: { type: 'string', description: 'ISO 8601 time: the body current then. Omit for the current one.' },
      },
      required: ['provider_ref'],
    },
    handler: getCapabilitiesHandler,
  });
}

// Test seam.
export const _internals = { parseIsoToUnixSeconds };
