/**
 * meta_context arbiter — read-only analysis lenses over the contextmap.
 *
 * Where meta_context_brief returns the graph verbatim and meta_context_commit
 * seals structural decisions, this module ANSWERS QUESTIONS about the graph
 * that need a cross-table join the raw readers don't do. The first lens is
 * `stale-bindings`: the deferred "stale-binding audit lens" from
 * docs/meta-context.md — cross-reference every sealed `binds` edge against the
 * current meta_mcp_inventory to surface connected services that bind to a tool
 * no longer in the operator's environment, plus vendor-knowledge that has aged
 * past a freshness threshold.
 *
 * Deterministic, no LLM. This is the ANCHOR of the connected-services refresher
 * loop (lite-template/integration/0824/connected-services-refresher.plan.md):
 * detection is a graph join, not a judgment call. The catalyst that acts on
 * these findings (re-research drifted vendors, draft an action plan) is a
 * separate, LLM-shaped layer built on top of this tool's output.
 *
 * SYNCHRONOUS — better-sqlite3 reads are sync; no transaction needed (read-only).
 */

import { getDb } from '@/lib/db/index';
import { InventoryRepository } from '@/lib/db/repositories/mcp-inventory';
import { CapabilitiesRepository } from '@/lib/db/repositories/mcp-capabilities';
import { MetaNodeRepository } from '@/lib/db/repositories/meta-context';
import { canonicalizeServerName } from '@/lib/mcp/providers/canonicalize';

// Reuse the 7-day inventory-staleness precedent from
// recommend_mcp_orbit_compositions (see docs/meta-context.md → "Freshness").
export const STALE_INVENTORY_SECONDS = 7 * 24 * 60 * 60;
// No prior precedent for capability-row staleness; 90 days is a first cut —
// tune once we see how fast operator vendor surfaces actually drift.
export const STALE_CAPABILITY_SECONDS = 90 * 24 * 60 * 60;

export const ANALYZE_LENSES = ['stale-bindings'];

// Severity ordering, most-actionable first. `missing` (a sealed service binds a
// tool that's gone) outranks capability staleness (softer drift signal), which
// outranks a service with no researched vendor knowledge at all. `unknown` means
// we couldn't judge (inventory not declared). `ok` is the clean case.
const SEVERITY_RANK = {
  missing: 0,
  'stale-capability': 1,
  'no-capability': 2,
  unknown: 3,
  ok: 4,
};

/**
 * Split a canonical tool ref `${server}.${tool}` into its server prefix.
 * Tool refs are composed as `${server}.${toolName}` at bind time (both the
 * bot-shaped and primitive-binding commit paths). Server + tool names don't
 * carry dots in practice, so the first-dot split recovers the server. Only
 * used as a fallback — for tools still present in inventory we read the
 * authoritative `server` off the inventory row instead.
 */
function serverFromToolRef(toolRef) {
  const dot = toolRef.indexOf('.');
  return dot === -1 ? toolRef : toolRef.slice(0, dot);
}

/** Every sealed `binds` edge with its artifact + tool node, fleet-wide or for one artifact. */
function loadBindEdges({ artifactRef } = {}) {
  const db = getDb();
  const base = `
    SELECT
      e.id            AS edge_id,
      e.payload_json  AS edge_payload,
      e.created_at    AS bound_at,
      art.id          AS art_id,
      art.ref         AS art_ref,
      art.label       AS art_label,
      tool.ref        AS tool_ref
    FROM meta_edges e
    JOIN meta_nodes art  ON art.id = e.src_id
    JOIN meta_nodes tool ON tool.id = e.dst_id
    WHERE e.kind = 'binds'`;
  const rows = artifactRef
    ? db.prepare(`${base} AND art.ref = ? ORDER BY art.ref ASC, tool.ref ASC`).all(artifactRef)
    : db.prepare(`${base} ORDER BY art.ref ASC, tool.ref ASC`).all();
  return rows.map((r) => ({
    edgeId: r.edge_id,
    boundAt: r.bound_at,
    fieldsBound: r.edge_payload ? JSON.parse(r.edge_payload).fields_bound ?? null : null,
    artifactId: r.art_id,
    artifactRef: r.art_ref,
    artifactLabel: r.art_label,
    toolRef: r.tool_ref,
  }));
}

function recommendationFor(severity, { toolRef, providerRef }) {
  switch (severity) {
    case 'missing':
      return `Tool \`${toolRef}\` is no longer in the declared inventory. Re-declare inventory (in case it was a transient snapshot), then — if still gone — re-run the research-mcp-vendor catalyst for \`${providerRef}\` and review whether this service should re-bind to a renamed tool or be retired.`;
    case 'stale-capability':
      return `Vendor knowledge for \`${providerRef}\` has aged past the freshness window. Re-run research-mcp-vendor for \`${providerRef}\` to supersede the capability row, then confirm this service's binding still matches the current surface.`;
    case 'no-capability':
      return `No researched vendor knowledge on record for \`${providerRef}\`. Run research-mcp-vendor for \`${providerRef}\` so drift on this service can be tracked going forward.`;
    default:
      return null;
  }
}

/**
 * The stale-bindings lens.
 *
 * @param {{ artifactRef?: string }} opts
 * @returns structured findings + inventory freshness + a rolled-up summary.
 */
export function analyzeStaleBindings({ artifactRef } = {}) {
  const inventory = InventoryRepository.currentInventory();
  const inventoryEmpty = inventory.toolCount === 0;
  const inventoryStale =
    !inventoryEmpty &&
    inventory.ageSeconds !== null &&
    inventory.ageSeconds > STALE_INVENTORY_SECONDS;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const bindings = loadBindEdges({ artifactRef });

  // Cache provider capability lookups — many bindings share a provider.
  const capViewCache = new Map();
  const capViewFor = (providerRef) => {
    if (!capViewCache.has(providerRef)) {
      capViewCache.set(providerRef, CapabilitiesRepository.consolidatedView(providerRef));
    }
    return capViewCache.get(providerRef);
  };

  const findings = bindings.map((b) => {
    const invRow = InventoryRepository.findByRef(b.toolRef);
    const present = !!invRow;
    const server = invRow?.server ?? serverFromToolRef(b.toolRef);
    const providerRef = canonicalizeServerName(server);

    let severity;
    let detail;
    let capabilityAgeSeconds = null;

    if (inventoryEmpty) {
      // Can't judge presence against an inventory that was never declared —
      // never emit a false `missing`. Nudge the operator to re-declare.
      severity = 'unknown';
      detail = 'Inventory has never been declared; cannot verify this binding is live.';
    } else if (!present) {
      severity = 'missing';
      detail = inventoryStale
        ? `Tool absent from inventory — but the inventory snapshot is ${Math.floor(inventory.ageSeconds / 86400)}d old, so re-declare before trusting this verdict.`
        : 'Tool absent from the current inventory.';
    } else {
      const capView = capViewFor(providerRef);
      const discoveredAt = capView?.capabilities?.discoveredAt ?? null;
      if (discoveredAt === null) {
        severity = 'no-capability';
        detail = 'Tool is present, but no researched vendor knowledge exists for its provider.';
      } else {
        capabilityAgeSeconds = Math.max(0, nowSeconds - discoveredAt);
        if (capabilityAgeSeconds > STALE_CAPABILITY_SECONDS) {
          severity = 'stale-capability';
          detail = `Tool is present, but vendor knowledge for its provider is ${Math.floor(capabilityAgeSeconds / 86400)}d old.`;
        } else {
          severity = 'ok';
          detail = 'Tool present and vendor knowledge is within the freshness window.';
        }
      }
    }

    return {
      severity,
      artifactRef: b.artifactRef,
      artifactLabel: b.artifactLabel,
      toolRef: b.toolRef,
      provider: providerRef,
      fieldsBound: b.fieldsBound,
      boundAt: b.boundAt,
      capabilityAgeSeconds,
      detail,
      recommendation: recommendationFor(severity, { toolRef: b.toolRef, providerRef }),
    };
  });

  findings.sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.toolRef.localeCompare(b.toolRef),
  );

  const bySeverity = { missing: 0, 'stale-capability': 0, 'no-capability': 0, unknown: 0, ok: 0 };
  const affected = new Set();
  const providersToRefresh = new Set();
  for (const f of findings) {
    bySeverity[f.severity] += 1;
    if (f.severity !== 'ok') affected.add(f.artifactRef);
    if (f.severity === 'missing' || f.severity === 'stale-capability' || f.severity === 'no-capability') {
      providersToRefresh.add(f.provider);
    }
  }

  const nudges = [];
  if (inventoryEmpty) {
    nudges.push(
      'Inventory has never been declared — call meta_context_declare_inventory before this audit can judge whether bindings are live.',
    );
  } else if (inventoryStale) {
    nudges.push(
      `Inventory snapshot is ${Math.floor(inventory.ageSeconds / 86400)}d old (> ${STALE_INVENTORY_SECONDS / 86400}d). Re-declare inventory so 'missing' verdicts reflect the current environment.`,
    );
  }

  return {
    lens: 'stale-bindings',
    inventory: {
      declaredAt: inventory.declaredAt,
      ageSeconds: inventory.ageSeconds,
      toolCount: inventory.toolCount,
      empty: inventoryEmpty,
      stale: inventoryStale,
    },
    findings,
    summary: {
      bindingsAnalyzed: findings.length,
      bySeverity,
      artifactsAffected: affected.size,
      providersToRefresh: Array.from(providersToRefresh).sort(),
    },
    nudges,
  };
}

/**
 * Lens dispatcher. Scope mirrors meta_context_brief: `{ kind: 'fleet' }` audits
 * every sealed binding; `{ kind: 'artifact', ref }` scopes to one connected
 * service. `bot` scope (audit all services running for one bot) is a follow-up.
 */
export function analyze({ scope, lens } = {}) {
  if (!lens || !ANALYZE_LENSES.includes(lens)) {
    throw new Error(`lens must be one of: ${ANALYZE_LENSES.join(', ')} (got '${lens}')`);
  }
  if (!scope || typeof scope !== 'object') {
    throw new Error("scope is required, e.g. { kind: 'fleet' } or { kind: 'artifact', ref }");
  }
  if (scope.kind === 'fleet') {
    return { scope: { kind: 'fleet' }, ...analyzeStaleBindings() };
  }
  if (scope.kind === 'artifact') {
    if (!scope.ref || typeof scope.ref !== 'string') {
      throw new Error("scope { kind: 'artifact' } requires a ref (the composite artifact ref)");
    }
    const anchor = MetaNodeRepository.findByRef('artifact', scope.ref);
    if (!anchor) {
      return {
        scope: { kind: 'artifact', ref: scope.ref },
        meta: { empty: true, reason: 'no_such_artifact' },
        ...analyzeStaleBindings({ artifactRef: scope.ref }),
      };
    }
    return {
      scope: { kind: 'artifact', ref: scope.ref },
      ...analyzeStaleBindings({ artifactRef: scope.ref }),
    };
  }
  throw new Error(
    `analyze() scope kind '${scope.kind}' is not supported; use 'fleet' or 'artifact'`,
  );
}
