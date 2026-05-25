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
import { seedMcpCapabilities } from '@/lib/mcp/seeds/mcp-capabilities-seed';

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

  const result = CapabilitiesRepository.insert({
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
  // Seed the four shipped vendor bodies if not already present. Idempotent
  // per-provider — only inserts where no capability row exists yet, so
  // agent-authored research rows are never overwritten.
  try {
    seedMcpCapabilities();
  } catch (err) {
    // Match the mcp-orbit loader's failure posture: log + continue, so a
    // bad seed file doesn't take down the tool registration.
    // eslint-disable-next-line no-console
    console.error('[mcp-capabilities] seedMcpCapabilities failed:', err.message);
  }

  registerTool({
    name: 'record_mcp_capabilities',
    description:
      "Write a vendor knowledge body for one MCP (e.g. `gmail`, `notion`, `linear`) into the capabilities table — the agent-authored substitute for curated vendor docs. **Call after** running the `research-mcp-vendor` catalyst, which teaches the source discipline (primary sources only) and the canonical body shape; this is the persistence tool the catalyst drives. **Append-with-supersession** — if a current row already exists for this `provider_ref`, the new row becomes current and the old one is marked superseded in one transaction (full history preserved; query past states with `get_mcp_capabilities`'s `asOf`). Re-running is safe by design. The `provider_ref` is the canonical lowercase vendor key (NOT the install alias like `claude_ai_Gmail` — use `gmail`); shared with the inventory facet so the composer reads both as one provider. Pass `source_urls` so future readers can trace what was consulted; first URL starting with `mojulo://` marks the row as a build-time seed (vs. agent research). Returns `{ ok, id, providerId, providerRef, versionTag, discoveredAt, supersededId, provenance }` — `supersededId` is the id of the row just superseded (null on first write for this provider); `provenance` is `'research'` or `'seed'`; `warnings: ['no_operator_anchor']` means no KYC has been committed.",
    inputSchema: {
      type: 'object',
      properties: {
        provider_ref: {
          type: 'string',
          description:
            'Canonical lowercase vendor key — `gmail`, `notion`, `linear`, `google_drive`. Single token, underscores for multi-word. Shared with `meta_mcp_inventory.provider_id` and with the seed table — `notion` reaches the same row whether populated by inventory canonicalization, this catalyst, or the build-time seed.',
        },
        display_name: {
          type: 'string',
          description:
            'Human-readable vendor name (`Gmail`, `Notion`). First-writer-wins — subsequent calls do not overwrite. Optional.',
        },
        version_tag: {
          type: 'string',
          description:
            "Vendor's declared API version verbatim from the docs (e.g. `API 2025-09-03`). Null/omit when the vendor publishes nothing — `discovered_at` provides temporal ordering on its own. Don't fabricate a date.",
        },
        body_md: {
          type: 'string',
          description:
            'The full vendor knowledge body (markdown with JSON frontmatter). Match the shape the `research-mcp-vendor` catalyst defines — affordances, capabilities, intentKeywords, exposesKnobs in frontmatter; surface bodies per role + pitfalls + `<!-- sources -->` HTML comment in prose. Opaque to mojulo; returned as-is on read.',
        },
        source_urls: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Every URL consulted during research, in priority order. Stored as a JSON column and queryable separately from the body. Convention: a leading `mojulo://CHANGELOG#vX.Y.Z` URL marks the row as a build-time seed; vendor URLs (`https://developers.notion.com/...`) mark it as agent research.',
        },
      },
      required: ['provider_ref', 'body_md'],
    },
    handler: recordCapabilitiesHandler,
  });

  registerTool({
    name: 'get_mcp_capabilities',
    description:
      "Read the current vendor knowledge body for one MCP, keyed by canonical `provider_ref` (`gmail`, `notion`, `linear`). **Call before** binding primitives or composing an mcp-orbit workflow against an MCP — the body teaches the surfaces, the pitfalls, and the intent mapping that introspection alone can't surface. Optional `asOf` (ISO 8601 string) walks the supersession chain to retrieve the row that was current at that point in time — useful for auditing why a past composition was assembled the way it was. Returns `{ ok, found, providerRef, ... }` — when `found: false`, the response includes a `hint` pointing at the `research-mcp-vendor` catalyst (the composer can fall back to inventory introspection in the meantime). When `found: true`, returns `{ id, providerId, versionTag, bodyMd, sourceUrls, discoveredAt, supersededBy }` — `supersededBy: null` confirms this is the current row.",
    inputSchema: {
      type: 'object',
      properties: {
        provider_ref: {
          type: 'string',
          description:
            'Canonical lowercase vendor key. Use the same form as you would pass to `record_mcp_capabilities` — `gmail`, NOT `claude_ai_Gmail`.',
        },
        asOf: {
          type: 'string',
          description:
            'Optional ISO 8601 timestamp. When provided, walks the supersession chain to return the row that was current at that time. Omit for the current row.',
        },
      },
      required: ['provider_ref'],
    },
    handler: getCapabilitiesHandler,
  });
}

// Test seam.
export const _internals = { parseIsoToUnixSeconds };
