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
import { ProvidersRepository } from '@/lib/db/repositories/mcp-providers';
import { CapabilitiesRepository } from '@/lib/db/repositories/mcp-capabilities';
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

// Parse JSON frontmatter from a capability body. Returns null on no frontmatter
// or invalid JSON. Shared by both the list/get handlers (when serving the
// `mcp` kind) and the composer's provider profiling.
function parseCapabilityFrontmatter(bodyMd) {
  if (typeof bodyMd !== 'string') return null;
  const match = bodyMd.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

// Project a consolidated provider view into the same shape the old
// `mcp_orbit_components` rows used to return, so `get_mcp_orbit_component`
// stays API-compatible for kind='mcp'. version comes from the capability's
// version_tag (vendor's declared API version) when set, else a stable '0.1.0'
// fallback so composition_refs stay normalized.
function mcpKindRowFromView(view) {
  if (!view) return null;
  const fm = view.capabilities ? parseCapabilityFrontmatter(view.capabilities.bodyMd) : null;
  return {
    kind: 'mcp',
    ref: view.providerRef,
    version: view.capabilities?.versionTag || '0.1.0',
    bodyMd: view.capabilities?.bodyMd || null,
    payload: fm || {},
    source: view.capabilities ? 'builtin' : null,
  };
}

export async function listComponentsHandler(input, _ctx) {
  const { kind, ref_pattern } = input || {};

  // 'mcp' kind reads from the providers identity layer (capabilities + inventory
  // facets), NOT the component store. Vendor knowledge moved out after
  // decuration; only the typed scaffolding (trigger/pattern/idempotency/render)
  // still ships through the loader.
  if (kind === 'mcp') {
    const allProviders = ProvidersRepository.listAll();
    let entries = allProviders
      .map((p) => CapabilitiesRepository.consolidatedView(p.providerRef))
      .filter((v) => v !== null)
      .map((v) => {
        const fm = v.capabilities ? parseCapabilityFrontmatter(v.capabilities.bodyMd) : null;
        return {
          kind: 'mcp',
          ref: v.providerRef,
          version: v.capabilities?.versionTag || '0.1.0',
          summary: fm?.summary || (v.inventory ? `${v.providerRef} (inventory only, no body yet)` : null),
          source: v.capabilities ? 'builtin' : null,
          // Surface state + provenance so the agent can route remediation
          // (run research catalyst / declare inventory / etc).
          state: providerState(v),
          provenance: v.capabilities?.provenance || null,
        };
      });
    if (ref_pattern) {
      const like = new RegExp('^' + String(ref_pattern).replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i');
      entries = entries.filter((e) => like.test(e.ref));
    }
    return { total: entries.length, components: entries };
  }

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

  // 'mcp' kind reads from the providers identity layer. The version arg is
  // accepted for API symmetry but ignored — the provider's "current" capability
  // is what matters (use get_mcp_capabilities({asOf}) to walk the chain).
  if (kind === 'mcp') {
    const view = CapabilitiesRepository.consolidatedView(ref);
    if (!view) {
      throw new Error(
        `Component not found: mcp/${ref}. No provider with this ref is known to mojulo yet. ` +
          `Declare inventory or run the research-mcp-vendor catalyst (get_catalyst) to populate.`,
      );
    }
    if (!view.capabilities) {
      throw new Error(
        `Component body not found: mcp/${ref}. Provider exists (from inventory) but no capability body is recorded. ` +
          `Run the research-mcp-vendor catalyst to populate.`,
      );
    }
    return mcpKindRowFromView(view);
  }

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

// (Pre-decuration helpers `normalizeName` / `inventoryMatchesHints` removed —
// provider identity now collapses install aliases at the canonicalizer step,
// so the composer no longer needs to fuzzy-match server names against hints
// at recommendation time.)

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

// Five-state classification of a provider's deliberation surface:
//   research          — both inventory + capabilities; capabilities is agent-research
//   seed              — both inventory + capabilities; capabilities is a build-time seed
//   inventory_only    — installed but no vendor knowledge body recorded
//   capabilities_only — vendor knowledge recorded but not installed in this environment
//   none              — provider row exists but neither facet (defensive; shouldn't reach the composer)
//
// State drives both the composer's warning tags and the catalyst suggestion
// — `inventory_only` and `seed` are the two states that nudge the agent to
// run the research-mcp-vendor catalyst.
function providerState(view) {
  const hasInventory = view?.inventory !== null && view?.inventory !== undefined;
  const hasCapabilities = view?.capabilities !== null && view?.capabilities !== undefined;
  if (hasInventory && hasCapabilities) {
    return view.capabilities.provenance === 'seed' ? 'seed' : 'research';
  }
  if (hasInventory) return 'inventory_only';
  if (hasCapabilities) return 'capabilities_only';
  return 'none';
}

// Collapse a consolidated provider view into the shape the composer reasons
// about: ref, affordances, hints (for intent matching), intent keywords (from
// capability frontmatter if present), state, and whether the provider is
// "installed" (has an inventory facet). Returns null for providers with
// neither inventory nor capabilities — those don't contribute to candidates.
//
// Affordances come from the capability body's frontmatter when present;
// inventory-only providers get a permissive `{read: true, write: true,
// watch: false}` default so the composer can still propose a candidate (the
// `inventory_only` state warning tells the agent to refresh via the catalyst
// for a tighter affordance read).
function providerProfile(view) {
  if (!view) return null;
  const state = providerState(view);
  if (state === 'none') return null;

  const fm = view.capabilities ? parseCapabilityFrontmatter(view.capabilities.bodyMd) : null;

  let affordances = null;
  if (fm?.affordances && typeof fm.affordances === 'object') {
    affordances = {
      read: fm.affordances.read === true,
      write: fm.affordances.write === true,
      watch: fm.affordances.watch === true,
    };
  } else if (view.inventory) {
    affordances = { read: true, write: true, watch: false };
  }
  if (!affordances) return null;

  // Hints for intent-text matching: provider_ref, the capability frontmatter's
  // inventoryServerHints aliases (when present), and the install aliases from
  // the inventory facet (when present). Wider net = better match rate for
  // natural-language intents like "weekly Linear digest into Drive."
  const hints = new Set([view.providerRef]);
  if (Array.isArray(fm?.requires?.inventoryServerHints)) {
    for (const h of fm.requires.inventoryServerHints) hints.add(h);
  }
  if (Array.isArray(view.inventory?.installAliases)) {
    for (const a of view.inventory.installAliases) hints.add(a);
  }

  return {
    ref: view.providerRef,
    displayName: view.displayName,
    state,
    installed: view.inventory !== null && view.inventory !== undefined,
    affordances,
    intentKeywords: Array.isArray(fm?.intentKeywords) ? fm.intentKeywords : [],
    hints: Array.from(hints),
  };
}

// Earliest index in `intent` at which any of this provider's identifying
// strings appears. Used to pick which provider plays the source role vs
// destination — natural-language ordering ("LINEAR digest into DRIVE")
// almost always names the source first and the destination second.
// Returns Infinity when no hint matches.
function profileIntentMentionIndex(intent, profile) {
  const lower = String(intent || '').toLowerCase();
  let min = Infinity;
  for (const h of profile.hints) {
    const idx = lower.indexOf(String(h).toLowerCase());
    if (idx >= 0 && idx < min) min = idx;
  }
  return min;
}

// Translate a chosen provider's state into a constraint warning tag the
// agent can route to a remediation action. Returns null for the `research`
// state (no warning needed). The role isn't part of the warning today — the
// `<ref>` suffix is unambiguous and the agent infers role from context.
function providerStateWarning(profile) {
  switch (profile.state) {
    case 'research':
      return null;
    case 'seed':
      return `seed_capabilities:${profile.ref}`;
    case 'inventory_only':
      return `no_capabilities_recorded:${profile.ref}`;
    case 'capabilities_only':
      return `not_installed:${profile.ref}`;
    default:
      return `no_mcp_data:${profile.ref}`;
  }
}

/**
 * Build a v0 candidate composition. Enumerates providers from the identity
 * layer (meta_mcp_providers), reads each through the consolidated view to
 * collapse inventory + capabilities facets, then picks source + destination
 * by intent ordering with installed providers preferred over uninstalled.
 *
 * Returns null when no provider in either pool affords its role, or when any
 * required non-mcp kind is empty in the component store.
 */
function buildCandidateComposition({ intent, kycPrinciple }) {
  // Enumerate providers from the identity layer. Each provider may have an
  // inventory facet, a capabilities facet, both, or neither — providerProfile
  // collapses that into one shape the composer reasons about.
  const allProviders = ProvidersRepository.listAll();
  const profiles = allProviders
    .map((p) => providerProfile(CapabilitiesRepository.consolidatedView(p.providerRef)))
    .filter((p) => p !== null);

  const triggers = MCPOrbitComponentRepository.list({ kind: 'trigger' });
  const patterns = MCPOrbitComponentRepository.list({ kind: 'pattern' });
  const idempotencies = MCPOrbitComponentRepository.list({ kind: 'idempotency' });

  const readPool = profiles.filter((p) => p.affordances.read);
  const writePool = profiles.filter((p) => p.affordances.write);

  if (!readPool.length || !writePool.length || !triggers.length || !patterns.length || !idempotencies.length) {
    return null;
  }

  // Source selection: prefer installed providers, then rank by earliest
  // mention in the intent. Natural-language ordering puts source first.
  const installedReads = readPool.filter((p) => p.installed);
  const sourcePool = installedReads.length > 0 ? installedReads : readPool;
  const source = sourcePool
    .slice()
    .sort((a, b) => profileIntentMentionIndex(intent, a) - profileIntentMentionIndex(intent, b))[0];

  // Destination selection: prefer installed + distinct from source (most
  // workflows pair distinct providers), then any installed, then fall back.
  // Rank by latest mention.
  const installedWrites = writePool.filter((p) => p.installed);
  const distinctInstalledWrites = installedWrites.filter((p) => p.ref !== source.ref);
  const destPool =
    distinctInstalledWrites.length > 0
      ? distinctInstalledWrites
      : installedWrites.length > 0
        ? installedWrites
        : writePool;
  const destination = destPool
    .slice()
    .sort((a, b) => profileIntentMentionIndex(intent, b) - profileIntentMentionIndex(intent, a))[0];

  // Trigger picked by intent-keyword match. Pattern + idempotency are then
  // constrained by the chosen trigger via fits.triggers — the pairing rules
  // in each component's frontmatter ARE the constraint table.
  const trigger = pickByIntent(triggers, intent) || triggers[0];
  const fittingPatterns = patterns.filter((p) => fitsTrigger(p, trigger.ref));
  const pattern = pickByIntent(fittingPatterns.length > 0 ? fittingPatterns : patterns, intent);
  const fittingIdempotencies = idempotencies.filter((i) => fitsTrigger(i, trigger.ref));
  const idempotency = pickByIntent(
    fittingIdempotencies.length > 0 ? fittingIdempotencies : idempotencies,
    intent,
  );

  // mcp entries carry a stable '0.1.0' version in component_refs — the
  // capability row's version_tag is the vendor's API version (e.g.
  // notion's '2025-09-03'), which is meaningful per-row but isn't the
  // composition-component version. Keeping it normalized here means
  // composition audit strings stay consistent across providers.
  const components = [
    { kind: 'mcp', ref: source.ref, version: '0.1.0', role: 'source' },
    { kind: 'mcp', ref: destination.ref, version: '0.1.0', role: 'destination' },
    { kind: trigger.kind, ref: trigger.ref, version: trigger.version },
    { kind: pattern.kind, ref: pattern.ref, version: pattern.version },
    { kind: idempotency.kind, ref: idempotency.ref, version: idempotency.version },
  ];

  // Inventory fit: 0.5 per chosen provider that's installed (has inventory).
  const inventoryFit = (source.installed ? 0.5 : 0) + (destination.installed ? 0.5 : 0);

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

  // State-aware warnings. The old `source_not_in_inventory:<ref>` and
  // `destination_not_in_inventory:<ref>` pattern is replaced by the
  // provider-state taxonomy:
  //   seed_capabilities:<ref>       — installed + seed body; agent should refresh
  //   no_capabilities_recorded:<ref> — installed but no body; agent should research
  //   not_installed:<ref>           — body exists but no install
  //   no_mcp_data:<ref>             — defensive (shouldn't fire post-enumeration)
  const constraintWarnings = [];
  if (trigger.ref === 'scheduled' && !idempotency) {
    constraintWarnings.push('scheduled_without_idempotency');
  }
  const sourceWarning = providerStateWarning(source);
  if (sourceWarning) constraintWarnings.push(sourceWarning);
  if (destination.ref !== source.ref) {
    const destWarning = providerStateWarning(destination);
    if (destWarning) constraintWarnings.push(destWarning);
  }

  // Surface the research-mcp-vendor catalyst as the remediation when any
  // chosen provider isn't research-grade. Agents reading the response can
  // route directly to `get_catalyst('research-mcp-vendor')` without the
  // composer prescribing it.
  const needsResearch = constraintWarnings.some(
    (w) =>
      w.startsWith('no_capabilities_recorded:') ||
      w.startsWith('seed_capabilities:') ||
      w.startsWith('not_installed:'),
  );
  const catalystHint = needsResearch
    ? "Some chosen providers are not research-grade — run `get_catalyst('research-mcp-vendor')` to populate or refresh vendor knowledge before materializing."
    : null;

  return {
    components,
    sourceState: source.state,
    destState: destination.state,
    score,
    rationale: {
      inventoryFit,
      kycHint,
      priorBonus,
      priorMaterializations: prior,
      catalystHint,
    },
    constraintWarnings,
  };
}

export async function recommendCompositionsHandler(input, _ctx) {
  const { intent } = input || {};
  if (!intent || typeof intent !== 'string' || !intent.trim()) {
    throw new Error('intent is required — one paragraph describing what the operator wants to compose');
  }

  // Inventory is read for warning-shape only (toolCount / ageSeconds /
  // serverCount); the composer itself reads providers + capabilities through
  // the consolidated view rather than re-walking inventory at recommendation
  // time.
  const inventory = InventoryRepository.currentInventory();
  const operatorAnchor = MetaContextRepository.getOperatorAnchor();
  const kycPrinciple = operatorAnchor?.latestPrinciple || null;

  const candidate = buildCandidateComposition({
    intent: intent.trim(),
    kycPrinciple,
  });

  if (!candidate) {
    return {
      ok: false,
      reason: 'no_providers_or_components',
      hint:
        'No provider has both read and write affordances, OR a required component kind (trigger / pattern / idempotency) is missing from the store. Declare inventory via `meta_context_declare_inventory`, or run the `research-mcp-vendor` catalyst to record at least one vendor body.',
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
      "Recommend mcp-orbit compositions for the operator's stated intent. Server enumerates providers from the identity layer (every MCP mojulo knows about, whether via inventory introspection, the research-mcp-vendor catalyst, or build-time seeds), reads each through the consolidated provider view, picks source + destination by intent ordering with installed providers preferred, and scores candidates. Each candidate persists as a `proposed` row in the composition log (audit). Returns 1-3 ranked candidates with `compositionRef`, typed component refs, scoring rationale (`catalystHint` is non-null when at least one chosen provider isn't research-grade), and constraint warnings. Warning vocabulary after decuration: `scheduled_without_idempotency` (composition shape), `seed_capabilities:<ref>` / `no_capabilities_recorded:<ref>` / `not_installed:<ref>` (per chosen provider's state). **Call FIRST on any mcp-orbit intent** ('weekly digest from X to Y', 'route signal from A to B', 'enrich C with D'); returned `nextSteps` walk through the rest of the flow.",
    inputSchema: {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          description:
            'One paragraph describing what the operator wants to compose — source → destination + the cognitive shape ("weekly Linear digest into Drive", "route triaged inbound to Linear and Slack", etc.). The recommendation is logged with this verbatim for audit.',
        },
      },
      required: ['intent'],
    },
    handler: recommendCompositionsHandler,
  });
}
