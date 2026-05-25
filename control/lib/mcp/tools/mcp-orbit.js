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

function componentKey(c) {
  // Role-aware key so an mcp playing the source role isn't conflated with the
  // same mcp playing destination. Non-mcp kinds have no role and key cleanly.
  return c.role ? `${c.kind}/${c.ref}#${c.role}` : `${c.kind}/${c.ref}`;
}

function priorMaterializationSignal(components) {
  // Light v0 signal: a composition shape "matches a prior" if any role-aware
  // component key in the candidate appears in a prior materialized
  // composition row. v0 keeps it loose; calibrate after watching real data.
  const priors = MCPOrbitCompositionRepository.list({ status: 'materialized' });
  if (priors.length === 0) return { count: 0, refs: [] };
  const wantedKeys = new Set(components.map(componentKey));
  const overlapping = priors.filter((p) => {
    const priorKeys = new Set(p.componentRefs.map(componentKey));
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
 * shape — mcp(source) × mcp(destination) × trigger × pattern × idempotency —
 * picking the first mcp component whose affordances support each role, with
 * inventory matching as the tiebreaker. Future versions will enumerate
 * combinations.
 *
 * Returns null if no mcp component affords read (no source candidate) or
 * write (no destination candidate), or if any other required kind is empty.
 */
// Earliest index in `intent` at which any of this mcp component's identifying
// strings (ref + inventory server hints) appears. Used to pick which mcp plays
// the source role vs destination — natural-language ordering ("LINEAR digest
// into DRIVE") almost always names the source first and the destination
// second. Returns Infinity when no hint matches.
function intentMentionIndex(intent, mcp) {
  const hints = [mcp.ref, ...(mcp.payload?.requires?.inventoryServerHints || [])];
  const lower = String(intent || '').toLowerCase();
  let min = Infinity;
  for (const h of hints) {
    const idx = lower.indexOf(String(h).toLowerCase());
    if (idx >= 0 && idx < min) min = idx;
  }
  return min;
}

// Count of `intentKeywords` hits in the intent. Used to pick the
// trigger / pattern / idempotency / render that best fits the operator's
// natural-language ask. Components without an `intentKeywords` array score 0
// and only get picked when no other candidate matches.
function intentKeywordScore(intent, component) {
  const keywords = component.payload?.intentKeywords || [];
  if (keywords.length === 0) return 0;
  const lower = String(intent || '').toLowerCase();
  let count = 0;
  for (const k of keywords) {
    if (lower.includes(String(k).toLowerCase())) count++;
  }
  return count;
}

// Pick the component whose intentKeywords best match the intent. Ties broken
// by alphabetical order on ref for determinism. Returns the first component
// (alphabetical) when nothing matches — better to surface a candidate the
// agent can audit than to refuse to recommend.
function pickByIntent(components, intent) {
  if (components.length === 0) return null;
  const scored = components
    .slice()
    .map((c) => ({ c, score: intentKeywordScore(intent, c) }))
    .sort((a, b) => b.score - a.score || a.c.ref.localeCompare(b.c.ref));
  return scored[0].c;
}

// Does the candidate component pair with the chosen trigger? Components
// declare `fits.triggers` as an array of trigger refs they pair with; an
// empty / missing array means "no opinion" (fits anything).
function fitsTrigger(component, triggerRef) {
  const fits = component.payload?.fits?.triggers;
  if (!Array.isArray(fits) || fits.length === 0) return true;
  return fits.includes(triggerRef);
}

function buildCandidateComposition({ intent, inventory, kycPrinciple }) {
  const mcps = MCPOrbitComponentRepository.list({ kind: 'mcp' });
  const triggers = MCPOrbitComponentRepository.list({ kind: 'trigger' });
  const patterns = MCPOrbitComponentRepository.list({ kind: 'pattern' });
  const idempotencies = MCPOrbitComponentRepository.list({ kind: 'idempotency' });

  const readMcps = mcps.filter((m) => m.payload?.affordances?.read === true);
  const writeMcps = mcps.filter((m) => m.payload?.affordances?.write === true);

  if (!readMcps.length || !writeMcps.length || !triggers.length || !patterns.length || !idempotencies.length) {
    return null;
  }

  const declaredServers = inventory?.servers || [];
  const isInventoryMatched = (m) =>
    inventoryMatchesHints(declaredServers, m.payload?.requires?.inventoryServerHints || []).matched;

  // Source selection: prefer inventory-matched mcps, then rank by earliest
  // mention in the intent text (LINEAR mentioned first → likely the source).
  const inventoryMatchedReads = readMcps.filter(isInventoryMatched);
  const sourcePool = inventoryMatchedReads.length > 0 ? inventoryMatchedReads : readMcps;
  const source = sourcePool
    .slice()
    .sort((a, b) => intentMentionIndex(intent, a) - intentMentionIndex(intent, b))[0];

  // Destination selection: prefer inventory-matched mcps that are a DIFFERENT
  // ref from the chosen source (most workflows pair distinct MCPs), then any
  // inventory match, then fall back. Rank by latest mention in intent text
  // (DRIVE mentioned second → likely the destination).
  const inventoryMatchedWrites = writeMcps.filter(isInventoryMatched);
  const distinctMatchedWrites = inventoryMatchedWrites.filter((m) => m.ref !== source.ref);
  const destPool =
    distinctMatchedWrites.length > 0
      ? distinctMatchedWrites
      : inventoryMatchedWrites.length > 0
        ? inventoryMatchedWrites
        : writeMcps;
  const destination = destPool
    .slice()
    .sort((a, b) => intentMentionIndex(intent, b) - intentMentionIndex(intent, a))[0];

  // Trigger picked by intent-keyword match ("when X" → signal-polled,
  // "weekly Y" → scheduled). Pattern + idempotency are then constrained by
  // the chosen trigger via fits.triggers — the pairing rules in each
  // component's frontmatter ARE the constraint table from the meta-catalyst.
  const trigger = pickByIntent(triggers, intent) || triggers[0];
  const fittingPatterns = patterns.filter((p) => fitsTrigger(p, trigger.ref));
  const pattern = pickByIntent(fittingPatterns.length > 0 ? fittingPatterns : patterns, intent);
  const fittingIdempotencies = idempotencies.filter((i) => fitsTrigger(i, trigger.ref));
  const idempotency = pickByIntent(
    fittingIdempotencies.length > 0 ? fittingIdempotencies : idempotencies,
    intent,
  );

  const components = [
    { kind: 'mcp', ref: source.ref, version: source.version, role: 'source' },
    { kind: 'mcp', ref: destination.ref, version: destination.version, role: 'destination' },
    { kind: trigger.kind, ref: trigger.ref, version: trigger.version },
    { kind: pattern.kind, ref: pattern.ref, version: pattern.version },
    { kind: idempotency.kind, ref: idempotency.ref, version: idempotency.version },
  ];

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
        'The component store is empty or is missing at least one required kind (mcp with read affordance, mcp with write affordance, trigger, pattern, idempotency). The mcp-orbit component library may not have been seeded yet.',
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
      "List components in the mcp-orbit store. Components are typed building blocks (`mcp`, `trigger`, `pattern`, `idempotency`, `render`) that compose into MCP-to-MCP workflows. Each `mcp` component declares an `affordances` map (`read`/`write`/`watch`); `source`/`destination` are composition roles per-entry in `component_refs`, not separate kinds — the same Gmail MCP can play source in one composition and destination in another. Use this when the user wants a workflow that reads from one MCP and writes to another (e.g. 'weekly Linear digest into Drive'), NOT for bot or bot-shaped catalyst work. Bodies are omitted from list responses — fetch with `get_mcp_orbit_component`.",
    inputSchema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['mcp', 'trigger', 'pattern', 'idempotency', 'render'],
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
      "Fetch one mcp-orbit component by (kind, ref, version?). Returns the full markdown body plus structured payload (affordances, constraints, capabilities, exposed knobs). Omit `version` for the highest-version row. **Read in full before incorporating into a composition** — mapping intent and pitfalls are load-bearing; composers that skim get the integration wrong. For `mcp` components, BOTH source-role and destination-role sections inform affordances posture even if the composition only uses one. `exposesKnobs` is what you negotiate with the operator at composition time.",
    inputSchema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['mcp', 'trigger', 'pattern', 'idempotency', 'render'],
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
      "The mcp-orbit composition rulebook — pattern catalog, constraint table, composition discipline, ranking heuristic, dry-run + commit discipline. Read once per session before composing any mcp-orbit workflow, then re-read the constraint and dry-run sections at assembly time. Distinct from `get_catalyst` (which fetches a single bot-shaped recipe by id); this is the composer's posture for the component-store path, not a recipe.",
    inputSchema: { type: 'object', properties: {} },
    handler: getMetaCatalystHandler,
  });

  registerTool({
    name: 'recommend_mcp_orbit_compositions',
    description:
      "Recommend mcp-orbit compositions for the operator's stated intent. Server pre-filters available components against the declared inventory + operator KYC, scores candidates, and writes each as a `proposed` row in the composition log (audit). Returns 1-3 ranked candidates with `compositionRef`, the typed component refs that comprise it, scoring rationale, and any constraint warnings (e.g. `scheduled_without_idempotency`, `source_not_in_inventory:linear`). **Call FIRST on any mcp-orbit intent** ('weekly digest from X to Y', 'route signal from A to B', 'enrich C with D'); returned `nextSteps` walk through the rest of the flow. If `inventory.toolCount` is 0 or `ageSeconds > 604800`, prompt the operator to refresh via `meta_context_declare_inventory`.",
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
