/**
 * MCP Ring 6 — mcp-orbit component store + composer.
 *
 * Four tools exposed:
 *
 *   - list_mcp_orbit_components   → discovery; filter by kind / ref pattern
 *   - get_mcp_orbit_component     → fetch one row (body_md + structured payload)
 *   - get_meta_catalyst           → the composer's briefing (singleton)
 *   - recommend_mcp_orbit_compositions → constraint pre-filter + 2-3 ranked
 *                                        candidate compositions, persisted as
 *                                        'proposed' rows so the recommendation
 *                                        itself is auditable.
 *
 * The agent calls these IN ORDER on an mcp-orbit intent: recommend → meta-catalyst
 * (read once per session) → get_component per chosen ref → assemble + dry-run +
 * meta_context_commit at materialization.
 *
 * The composer is mostly an *agent* concern (judgment under uncertainty); the
 * server does only the deterministic part — constraint validation, inventory
 * matching, and writing the audit trail. Server-stored, agent-composed.
 *
 * See lite-template/integration/MCP_ORBIT_COMPONENT_STORE_PLAN.md.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MCPOrbitComponentRepository,
  MCPOrbitCompositionRepository,
} from '@/lib/db/repositories/mcp-orbit';
import { InventoryRepository } from '@/lib/db/repositories/mcp-inventory';
import { MetaContextRepository } from '@/lib/db/repositories/meta-context';
import { seedComponents } from '@/lib/mcp/mcp-orbit-components/loader';
import { registerTool } from '@/lib/mcp/server';

const META_CATALYST_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'mcp-orbit-components',
  'meta-catalyst.md',
);

let _metaCatalystBody = null;
function getMetaCatalystBody() {
  if (_metaCatalystBody) return _metaCatalystBody;
  _metaCatalystBody = readFileSync(META_CATALYST_PATH, 'utf8');
  return _metaCatalystBody;
}

// Test seam — invalidate the cached meta-catalyst body so tests can swap in a
// fixture without restarting the process.
export function _resetMetaCatalystCacheForTests() {
  _metaCatalystBody = null;
}

// ---------------------------------------------------------------------------
// list / get
// ---------------------------------------------------------------------------

export async function listComponentsHandler(input, _ctx) {
  const { kind, ref_pattern } = input || {};
  const components = MCPOrbitComponentRepository.list({ kind, refPattern: ref_pattern });
  // Body is intentionally NOT included here — discovery responses get fat very
  // fast otherwise. Callers fetch the body via get_mcp_orbit_component.
  return {
    total: components.length,
    components: components.map((c) => ({
      kind: c.kind,
      ref: c.ref,
      version: c.version,
      summary: c.payload?.summary || null,
      source: c.source,
    })),
  };
}

export async function getComponentHandler(input, _ctx) {
  const { kind, ref, version } = input || {};
  if (!kind || typeof kind !== 'string') throw new Error('kind is required');
  if (!ref || typeof ref !== 'string') throw new Error('ref is required');
  const component = MCPOrbitComponentRepository.findByRef(kind, ref, version || null);
  if (!component) {
    throw new Error(
      `Component not found: ${kind}/${ref}${version ? `@${version}` : ''}. Call list_mcp_orbit_components to discover what's available.`,
    );
  }
  return component;
}

export async function getMetaCatalystHandler(_input, _ctx) {
  const body = getMetaCatalystBody();
  return { content: [{ type: 'text', text: body }] };
}

// ---------------------------------------------------------------------------
// recommend
// ---------------------------------------------------------------------------

// Tolerant match: an inventory server name "matches" a hint if either string
// is a case-insensitive substring of the other after stripping non-alnum.
// MCPs ship under wildly inconsistent names (`gdrive`, `google_drive`,
// `claude_ai_Google_Drive`) and the component frontmatter can't enumerate
// every variant — a substring check is the pragmatic compromise.
function normalizeName(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function inventoryMatchesHints(servers, hints) {
  if (!Array.isArray(hints) || hints.length === 0) return { matched: false, server: null };
  const normalizedHints = hints.map(normalizeName);
  for (const server of servers) {
    const ns = normalizeName(server.name);
    for (const nh of normalizedHints) {
      if (ns.includes(nh) || nh.includes(ns)) {
        return { matched: true, server: server.name };
      }
    }
  }
  return { matched: false, server: null };
}

function priorMaterializationSignal(components) {
  // Light v0 signal: a composition shape "matches a prior" if every component
  // ref (regardless of version) appears as a binding ref on at least one
  // prior materialized artifact, OR if a prior composition row with the same
  // component shape exists in `materialized` status. Cheaper version: query
  // the composition log for prior `materialized` rows with overlapping
  // component_refs. v0 keeps it loose; calibrate after watching real data.
  const priors = MCPOrbitCompositionRepository.list({ status: 'materialized' });
  if (priors.length === 0) return { count: 0, refs: [] };
  const wantedKeys = new Set(components.map((c) => `${c.kind}/${c.ref}`));
  const overlapping = priors.filter((p) => {
    const priorKeys = new Set(p.componentRefs.map((c) => `${c.kind}/${c.ref}`));
    for (const k of wantedKeys) if (priorKeys.has(k)) return true;
    return false;
  });
  return { count: overlapping.length, refs: overlapping.map((p) => p.ref) };
}

function scoreCandidate({ inventoryFit, kycHint, priorBonus }) {
  // Weights from the meta-catalyst's ranking heuristic — small surface, easy
  // to retune as real composition data comes in.
  return inventoryFit * 0.7 + kycHint * 0.2 + priorBonus * 0.1;
}

/**
 * Build a v0 candidate composition. For now we wire a single canonical
 * shape — source × destination × trigger × pattern × idempotency — using
 * whatever five components match each kind first. Future versions will
 * enumerate combinations.
 *
 * Returns null if any required kind has no component available.
 */
function buildCandidateComposition({ intent, inventory, kycPrinciple }) {
  const sources = MCPOrbitComponentRepository.list({ kind: 'source' });
  const destinations = MCPOrbitComponentRepository.list({ kind: 'destination' });
  const triggers = MCPOrbitComponentRepository.list({ kind: 'trigger' });
  const patterns = MCPOrbitComponentRepository.list({ kind: 'pattern' });
  const idempotencies = MCPOrbitComponentRepository.list({ kind: 'idempotency' });

  if (!sources.length || !destinations.length || !triggers.length || !patterns.length || !idempotencies.length) {
    return null;
  }

  // Pick the inventory-matched source / destination if any; otherwise fall
  // back to the first available so the agent still has a candidate to read.
  const declaredServers = inventory?.servers || [];
  const source =
    sources.find((s) => inventoryMatchesHints(declaredServers, s.payload?.requires?.inventoryServerHints || []).matched) ||
    sources[0];
  const destination =
    destinations.find(
      (d) => inventoryMatchesHints(declaredServers, d.payload?.requires?.inventoryServerHints || []).matched,
    ) || destinations[0];

  const trigger = triggers[0];
  const pattern = patterns[0];
  const idempotency = idempotencies[0];

  const components = [source, destination, trigger, pattern, idempotency].map((c) => ({
    kind: c.kind,
    ref: c.ref,
    version: c.version,
  }));

  const sourceMatch = inventoryMatchesHints(declaredServers, source.payload?.requires?.inventoryServerHints || []);
  const destMatch = inventoryMatchesHints(declaredServers, destination.payload?.requires?.inventoryServerHints || []);
  const inventoryFit = (sourceMatch.matched ? 0.5 : 0) + (destMatch.matched ? 0.5 : 0);

  // Tiny v0 KYC signal: 1 if the operator's latest principle mentions any of
  // the chosen component refs (substring, case-insensitive). Otherwise 0.
  let kycHint = 0;
  if (kycPrinciple?.bodyMd) {
    const lower = kycPrinciple.bodyMd.toLowerCase();
    if (components.some((c) => lower.includes(c.ref.toLowerCase()))) kycHint = 1;
  }

  const prior = priorMaterializationSignal(components);
  const priorBonus = prior.count > 0 ? 1 : 0;

  const score = scoreCandidate({ inventoryFit, kycHint, priorBonus });

  // Constraint pre-filter (server-side, deterministic). The meta-catalyst
  // section 4 is the rulebook — these are the rules expressible in code:
  const constraintWarnings = [];
  if (trigger.ref === 'scheduled' && !idempotency) {
    constraintWarnings.push('scheduled_without_idempotency');
  }
  if (!sourceMatch.matched) constraintWarnings.push(`source_not_in_inventory:${source.ref}`);
  if (!destMatch.matched) constraintWarnings.push(`destination_not_in_inventory:${destination.ref}`);

  return {
    components,
    sourceMatch,
    destMatch,
    score,
    rationale: {
      inventoryFit,
      kycHint,
      priorBonus,
      priorMaterializations: prior,
    },
    constraintWarnings,
  };
}

export async function recommendCompositionsHandler(input, _ctx) {
  const { intent, inventory: inventoryOverride } = input || {};
  if (!intent || typeof intent !== 'string' || !intent.trim()) {
    throw new Error('intent is required — one paragraph describing what the operator wants to compose');
  }

  const inventory = inventoryOverride || InventoryRepository.currentInventory();
  const operatorAnchor = MetaContextRepository.getOperatorAnchor();
  const kycPrinciple = operatorAnchor?.latestPrinciple || null;

  const candidate = buildCandidateComposition({
    intent: intent.trim(),
    inventory,
    kycPrinciple,
  });

  if (!candidate) {
    return {
      ok: false,
      reason: 'no_components_available',
      hint:
        'The component store is empty or is missing at least one required kind (source, destination, trigger, pattern, idempotency). The mcp-orbit component library may not have been seeded yet.',
      candidates: [],
    };
  }

  // Persist the recommendation as a proposed row — the recommendation itself
  // is auditable, per the plan's option (b).
  const composition = MCPOrbitCompositionRepository.insert({
    intent_md: intent.trim(),
    component_refs: candidate.components,
    knobs: {},
    ranking_score: candidate.score,
    status: 'proposed',
  });

  const warnings = [];
  if (!MetaContextRepository.hasOperator()) warnings.push('no_operator_anchor');
  if (inventory.toolCount === 0) warnings.push('inventory_empty');
  if (inventory.ageSeconds !== null && inventory.ageSeconds > 7 * 24 * 60 * 60) {
    warnings.push('inventory_stale');
  }

  return {
    ok: true,
    operatorAnchor: operatorAnchor
      ? {
          role: operatorAnchor.node.label,
          latestPrinciple: kycPrinciple
            ? { id: kycPrinciple.id, bodyMd: kycPrinciple.bodyMd, createdAt: kycPrinciple.createdAt }
            : null,
        }
      : null,
    inventory: {
      declaredAt: inventory.declaredAt,
      ageSeconds: inventory.ageSeconds,
      toolCount: inventory.toolCount,
      serverCount: inventory.servers.length,
    },
    candidates: [
      {
        compositionRef: composition.ref,
        score: candidate.score,
        components: candidate.components,
        rationale: candidate.rationale,
        constraintWarnings: candidate.constraintWarnings,
      },
    ],
    nextSteps: [
      "Call `get_meta_catalyst` once per session — it's the composition discipline rulebook.",
      "Call `get_mcp_orbit_component({kind, ref})` for each component in the candidate to read its body in full.",
      'Negotiate the components\' `exposesKnobs` with the operator in ONE round, then update the composition.',
      'Dry-run against a draft destination artifact before promoting.',
      'On promotion: host-adapter materialization → `meta_context_commit({type:"artifact_materialization", ...})`. Record the compositionRef in an artifact-scope principle.',
    ],
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

// ---------------------------------------------------------------------------
// registration
// ---------------------------------------------------------------------------

export function registerMCPOrbitTools() {
  // Seed shipped components into the store on first registration. Safe to
  // call repeatedly — the loader's once-flag short-circuits and the repo's
  // upsert is idempotent on (kind, ref, version).
  try {
    seedComponents();
  } catch (err) {
    // A bad component file should fail loudly, but we don't want to take the
    // whole MCP server down if one .md file is malformed during dev. Log and
    // continue; the relevant tools will throw a clear error on use.
    console.error('[mcp-orbit] seedComponents failed:', err.message);
  }

  registerTool({
    name: 'list_mcp_orbit_components',
    description:
      "Ring 6 — DELIBERATION surface. List components in the mcp-orbit store. Components are typed building blocks (`source`, `destination`, `trigger`, `pattern`, `idempotency`, `render`) that combine multiplicatively into mcp-orbit workflow compositions — N sources × M destinations × T triggers × K patterns × idempotency × render. Use this when the user wants a workflow that reads from one MCP and writes to another (e.g. 'weekly Linear digest into Drive'), NOT when they want a bot or a bot-shaped catalyst. **For mcp-orbit intent, the right call order is: `recommend_mcp_orbit_compositions` (gets you 2-3 ranked candidates as proposed rows) → `get_meta_catalyst` (composition rulebook, read once per session) → `get_mcp_orbit_component` per chosen ref → assemble + dry-run + `meta_context_commit`.** This tool is the discovery surface for browsing what components are available; the per-component body lives behind `get_mcp_orbit_component`. Bodies are intentionally omitted from the list response (they're large).",
    inputSchema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['source', 'destination', 'trigger', 'pattern', 'idempotency', 'render'],
          description: 'Optional filter to one component category.',
        },
        ref_pattern: {
          type: 'string',
          description: "Optional LIKE-style pattern on the component ref (e.g. 'linear%').",
        },
      },
    },
    handler: listComponentsHandler,
  });

  registerTool({
    name: 'get_mcp_orbit_component',
    description:
      "Ring 6 — DELIBERATION surface. Fetch one mcp-orbit component by (kind, ref, version?). Returns the full markdown body plus structured payload (constraints, capabilities, exposed knobs, etc. that this component declares for the composer to honor). When `version` is omitted, returns the highest-version row for that ref — components follow semver, so highest string = latest release when shipped components follow the convention. **Always read this in full before incorporating a component into a composition** — the body's mapping intent and pitfalls sections are load-bearing; the composer that skims gets the integration wrong. The `exposesKnobs` array is what you negotiate with the operator at composition time.",
    inputSchema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['source', 'destination', 'trigger', 'pattern', 'idempotency', 'render'],
        },
        ref: { type: 'string', description: 'Component ref from list_mcp_orbit_components.' },
        version: {
          type: 'string',
          description:
            'Optional explicit semver string. Omit to get the highest-version row for this (kind, ref).',
        },
      },
      required: ['kind', 'ref'],
    },
    handler: getComponentHandler,
  });

  registerTool({
    name: 'get_meta_catalyst',
    description:
      "Ring 6 — DELIBERATION surface. Return the **mcp-orbit composition rulebook** — pattern catalog, constraint table, composition discipline, ranking heuristic, dry-run + commit discipline. This is the singleton briefing every mcp-orbit composition reads ONCE per session before assembling. **Read this before composing any mcp-orbit workflow, then re-read the constraint and dry-run sections at the moment you're assembling components.** Distinct from `get_catalyst` (which fetches a single bot-shaped recipe by id); this is the composer's posture and rulebook for the component-store path, not a recipe.",
    inputSchema: { type: 'object', properties: {} },
    handler: getMetaCatalystHandler,
  });

  registerTool({
    name: 'recommend_mcp_orbit_compositions',
    description:
      "Ring 6 — DELIBERATION surface. Recommend mcp-orbit compositions for the operator's stated intent. Server-side does only the deterministic part — pre-filters available components against the declared MCP inventory and the operator's KYC anchor, scores candidates, and writes each candidate to the composition log as a `proposed` row so the recommendation itself is auditable. Returns 1-3 ranked candidates, each with `compositionRef` (handle for later state transitions via `register_mcp_orbit_component`'s future write surface), the typed component refs that comprise it, the scoring rationale, and any constraint warnings (e.g. `scheduled_without_idempotency`, `source_not_in_inventory:linear`). **The agent does the composition** — pulls component bodies via `get_mcp_orbit_component`, negotiates knobs with the operator, runs the dry-run, materializes via host adapter, and seals via `meta_context_commit`. **Call this FIRST on any mcp-orbit intent** ('weekly digest from X to Y', 'route signal from A to B', 'enrich C with D'); it returns `nextSteps` that walk through the rest of the flow. If `inventory.toolCount` is 0 or `inventory.ageSeconds > 604800`, surface to the operator that the recommendation will be weaker without fresh inventory and offer to refresh via `meta_context_declare_inventory`.",
    inputSchema: {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          description:
            'One paragraph describing what the operator wants to compose — source → destination + the cognitive shape ("weekly Linear digest into Drive", "route triaged inbound to Linear and Slack", etc.). The recommendation is logged with this verbatim for audit.',
        },
        inventory: {
          type: 'object',
          description:
            'Optional inventory override. When omitted, the server reads the declared inventory via meta_context_declare_inventory. Use this only when you want to probe "what compositions would be available if I installed X" without re-declaring.',
        },
      },
      required: ['intent'],
    },
    handler: recommendCompositionsHandler,
  });
}
