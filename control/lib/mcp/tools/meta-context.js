/**
 * MCP Ring 6 — meta_context (deliberation surface).
 *
 * Writeable, durable layer that records *why* structural decisions were made:
 * which catalyst materialized into which artifact via which host adapter for
 * which bot, what locked-in constraints the operator declared, what mapping
 * decisions specific bindings encode.
 *
 * Two MVP tools:
 *
 *   - meta_context_brief — read the contextmap subgraph + principles
 *   - meta_context_commit — seal a structural decision (two event types:
 *     operator_kyc, artifact_materialization)
 *
 * The bright line: writes happen ONLY at structural events, never at outcome
 * events. Outcomes happen at run-rate (conversations, automation runs);
 * structural decisions happen at deliberation-rate (a user pivoting their
 * fleet, an artifact being materialized). The asymmetry is what makes the
 * layer auditable.
 *
 * See lite-template/integration/META_CONTEXT_PLAN_v3.md for the design.
 */

import { registerTool } from '@/lib/mcp/server';
import {
  MetaContextRepository,
  MetaNodeRepository,
  MetaEdgeRepository,
  MetaPrincipleRepository,
} from '@/lib/db/repositories/meta-context';
import { DeploymentRepository } from '@/lib/db/repositories/deployments';
import { ProviderArtifactRepository } from '@/lib/db/repositories/mcp-orbit-provider-artifacts';
import { EmbeddingsRepository } from '@/lib/db/repositories/embeddings';
import { getAdapter } from '@/lib/mcp/adapters/loader';
import { getCatalyst } from '@/lib/mcp/catalysts/loader';
import { verifyArtifact } from '@/lib/mcp/meta-context/verification';

// Pre-embed every distinct principle body that'll be written by a commit.
// Principles are append-only, so the source_ref (the inserted row's id) is
// unknown until we're inside the sync txn — we batch on body_text instead
// and resolve to (hash, vector) inside the txn after each insert. Returns a
// Map keyed on body_text. Distinct-only to avoid redundant model work in
// the 'binds' fan-out case (one user-supplied principle body, N inserted
// rows sharing it). Soft on failure: callers walk the map and skip upsert
// when `vector` is null.
async function embedPrincipleBodies(bodies) {
  // Operator-facing kill switch — also doubles as the test escape hatch so
  // suites that don't care about the embedding sidecar can skip the ONNX
  // model load with one line at the top of the file.
  if (process.env.MOJULO_SEMANTIC_INDEX_DISABLED === '1') return new Map();
  const cleaned = (Array.isArray(bodies) ? bodies : [])
    .filter((b) => typeof b === 'string' && b.length > 0);
  if (cleaned.length === 0) return new Map();
  const distinct = Array.from(new Set(cleaned));
  const items = distinct.map((body) => ({
    sourceKind: 'principle',
    // Placeholder ref: principles are append-only so there's nothing to
    // hash-skip against. skipUnchanged: false below also short-circuits the
    // SELECT — we just want the model to run once per distinct body.
    sourceRef: '__pending__',
    bodyText: body,
  }));
  const embedded = await EmbeddingsRepository.embedMany(items, {
    skipUnchanged: false,
  });
  const map = new Map();
  for (const e of embedded) {
    map.set(e.bodyText, { hash: e.hash, vector: e.vector });
  }
  return map;
}

// Sync. Pair a freshly-inserted principle row with its pre-computed
// embedding and upsert the sidecar row. Soft on missing entries.
function upsertPrincipleEmbedding(principle, bodyEmbeddings) {
  if (!principle || !bodyEmbeddings) return;
  const e = bodyEmbeddings.get(principle.bodyMd);
  if (!e) return;
  EmbeddingsRepository.upsertSync({
    sourceKind: 'principle',
    sourceRef: String(principle.id),
    bodyText: principle.bodyMd,
    hash: e.hash,
    vector: e.vector,
  });
}

// ---------------------------------------------------------------------------
// brief
// ---------------------------------------------------------------------------

const BRIEF_SCOPE_KINDS = ['fleet', 'bot', 'catalyst', 'adapter', 'artifact'];

export async function briefHandler(input, _ctx) {
  const scope = input?.scope;
  if (!scope || typeof scope !== 'object') {
    throw new Error('scope is required, e.g. { kind: "fleet" } or { kind: "bot", ref: "dep-123" }');
  }
  if (!BRIEF_SCOPE_KINDS.includes(scope.kind)) {
    throw new Error(
      `scope.kind must be one of: ${BRIEF_SCOPE_KINDS.join(', ')} (got '${scope.kind}')`,
    );
  }
  return MetaContextRepository.brief(scope);
}

// ---------------------------------------------------------------------------
// commit — dispatcher
// ---------------------------------------------------------------------------

export async function commitHandler(input, ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('commit() requires an event object with a `type` field');
  }
  switch (input.type) {
    case 'operator_kyc':
      return commitOperatorKyc(input);
    case 'artifact_materialization':
      return commitArtifactMaterialization(input, ctx);
    case 'primitive_artifact_materialization':
      return commitPrimitiveArtifactMaterialization(input, ctx);
    default:
      throw new Error(
        `Unknown commit event type '${input.type}'. Supported: 'operator_kyc', 'artifact_materialization', 'primitive_artifact_materialization'.`,
      );
  }
}

// ---------------------------------------------------------------------------
// commit: operator_kyc
// ---------------------------------------------------------------------------

function composeOperatorKycBody({ role, primary_goal, constraints }) {
  const lines = [`**Role:** ${role}`];
  if (primary_goal) lines.push('', `**Primary goal:** ${primary_goal}`);
  lines.push('', '**Locked-in constraints:**');
  for (const c of constraints) lines.push(`- ${c}`);
  return lines.join('\n');
}

export async function commitOperatorKyc(input) {
  const { role, primary_goal, constraints, revise } = input;

  if (!role || typeof role !== 'string' || !role.trim()) {
    throw new Error('operator_kyc requires a non-empty `role` string');
  }
  if (!Array.isArray(constraints) || constraints.length === 0) {
    throw new Error('operator_kyc requires a non-empty `constraints` array');
  }
  for (const c of constraints) {
    if (typeof c !== 'string' || !c.trim()) {
      throw new Error('every entry in `constraints` must be a non-empty string');
    }
  }
  if (primary_goal !== undefined && primary_goal !== null && typeof primary_goal !== 'string') {
    throw new Error('`primary_goal` must be a string when provided');
  }

  const existing = MetaNodeRepository.findByRef('operator', 'self');
  if (existing && !revise) {
    // Don't throw — hand back a structured rejection so the agent can confirm
    // the pivot with the user and retry with revise: true.
    return {
      ok: false,
      reason: 'operator_anchor_already_exists',
      existing_operator: true,
      hint: 'Set `revise: true` to attach a new principle to the same operator node. Confirm the pivot with the user before re-committing.',
    };
  }

  const bodyMd = composeOperatorKycBody({ role: role.trim(), primary_goal, constraints });

  // Pre-embed the principle body before opening the sync txn — better-sqlite3
  // requires the txn fn to be sync, and the model call is async. The hash +
  // vector get applied inside the txn after the principle's id is known.
  const bodyEmbeddings = await embedPrincipleBodies([bodyMd]);

  const result = MetaContextRepository.commit(() => {
    const node = MetaNodeRepository.upsert({
      kind: 'operator',
      ref: 'self',
      label: role.trim(),
      payload: null,
    });
    const principle = MetaPrincipleRepository.insert({
      scope_kind: 'node',
      scope_id: node.id,
      body_md: bodyMd,
      source_event: 'operator_kyc',
    });
    upsertPrincipleEmbedding(principle, bodyEmbeddings);
    return { node, principle };
  });

  return {
    ok: true,
    operatorNodeId: result.node.id,
    principleId: result.principle.id,
    revised: Boolean(existing),
  };
}

// ---------------------------------------------------------------------------
// commit: artifact_materialization
// ---------------------------------------------------------------------------

const PRINCIPLE_NODE_SCOPES = new Set(['artifact', 'catalyst', 'adapter', 'bot']);
const PRINCIPLE_EDGE_SCOPES = new Set(['seeded', 'materialized_by', 'runs_for', 'binds']);

function buildArtifactRef(adapterId, locator) {
  // Composite ref so the same locator under different adapters doesn't
  // collide (e.g. a "workflows/foo.md" path that exists under generic AND
  // codex). Adapter prefix is part of the artifact's identity.
  return `${adapterId}:${locator}`;
}

function resolveCatalystLabel(catalystRef) {
  const catalyst = getCatalyst(catalystRef);
  return catalyst?.name || catalystRef;
}

function attachPrinciples({
  principles,
  scopeMap,
  bindsEdgesByToolRef,
  sourceEvent = 'artifact_materialization',
  bodyEmbeddings = null,
}) {
  if (!Array.isArray(principles) || principles.length === 0) return [];
  const created = [];
  // Insert + upsert the principle's embedding in one step. Each call site
  // already runs inside MetaContextRepository.commit(fn), so both writes
  // commit or roll back together.
  const insertAndEmbed = ({ scope_kind, scope_id, body_md }) => {
    const principle = MetaPrincipleRepository.insert({
      scope_kind,
      scope_id,
      body_md,
      source_event: sourceEvent,
    });
    upsertPrincipleEmbedding(principle, bodyEmbeddings);
    return principle;
  };
  for (const p of principles) {
    if (!p || typeof p !== 'object') {
      throw new Error('principles[] entries must be objects with { scope, body_md }');
    }
    if (!p.body_md || typeof p.body_md !== 'string' || !p.body_md.trim()) {
      throw new Error('principle.body_md must be a non-empty string');
    }
    const scope = p.scope;
    if (!scope || typeof scope !== 'string') {
      throw new Error('principle.scope is required');
    }

    // `binds:<mcp_tool_ref>` targets one specific binds edge; bare `binds`
    // fans out to every binds edge created in this commit.
    if (scope.startsWith('binds:')) {
      const toolRef = scope.slice('binds:'.length);
      const edge = bindsEdgesByToolRef.get(toolRef);
      if (!edge) {
        throw new Error(
          `principle scope 'binds:${toolRef}' has no matching binding in this commit`,
        );
      }
      created.push(insertAndEmbed({ scope_kind: 'edge', scope_id: edge.id, body_md: p.body_md }));
      continue;
    }

    if (PRINCIPLE_NODE_SCOPES.has(scope)) {
      const node = scopeMap.nodes[scope];
      if (!node) throw new Error(`principle scope '${scope}' has no matching node in this commit`);
      created.push(insertAndEmbed({ scope_kind: 'node', scope_id: node.id, body_md: p.body_md }));
      continue;
    }

    if (PRINCIPLE_EDGE_SCOPES.has(scope)) {
      if (scope === 'binds') {
        if (bindsEdgesByToolRef.size === 0) {
          throw new Error("principle scope 'binds' requires at least one binding in this commit");
        }
        for (const edge of bindsEdgesByToolRef.values()) {
          created.push(
            insertAndEmbed({ scope_kind: 'edge', scope_id: edge.id, body_md: p.body_md }),
          );
        }
        continue;
      }
      const edge = scopeMap.edges[scope];
      if (!edge) throw new Error(`principle scope '${scope}' has no matching edge in this commit`);
      created.push(insertAndEmbed({ scope_kind: 'edge', scope_id: edge.id, body_md: p.body_md }));
      continue;
    }

    throw new Error(
      `Unknown principle scope '${scope}'. Allowed: artifact, catalyst, adapter, bot, seeded, materialized_by, runs_for, binds, binds:<mcp_tool_ref>.`,
    );
  }
  return created;
}

export async function commitArtifactMaterialization(input, _ctx) {
  const { adapter_id, artifact, bot_ref, catalyst_ref, bindings, principles } = input;

  // ---- pre-transaction validation (cheap to fail fast) ----

  if (!adapter_id || typeof adapter_id !== 'string') {
    throw new Error('adapter_id is required');
  }
  const adapter = getAdapter(adapter_id);
  if (!adapter) {
    throw new Error(`Unknown adapter '${adapter_id}'. Call list_adapters to see what's available.`);
  }

  if (!artifact || typeof artifact !== 'object') {
    throw new Error('artifact is required, e.g. { locator: "...", label: "..." }');
  }
  if (!artifact.locator || typeof artifact.locator !== 'string') {
    throw new Error('artifact.locator is required');
  }
  if (!artifact.label || typeof artifact.label !== 'string') {
    throw new Error('artifact.label is required');
  }

  if (!bot_ref || typeof bot_ref !== 'string') {
    throw new Error('bot_ref is required');
  }
  if (!catalyst_ref || typeof catalyst_ref !== 'string') {
    throw new Error('catalyst_ref is required');
  }

  const bindingsList = Array.isArray(bindings) ? bindings : [];
  for (const b of bindingsList) {
    if (!b || typeof b !== 'object' || !b.mcp_tool || typeof b.mcp_tool !== 'string') {
      throw new Error('every binding requires { mcp_tool: "<tool ref>", fields_bound?: [...] }');
    }
    if (b.fields_bound !== undefined && !Array.isArray(b.fields_bound)) {
      throw new Error('binding.fields_bound must be an array of strings when provided');
    }
  }

  // Adapter-delegated verification BEFORE we touch the DB.
  const verification = verifyArtifact(adapter_id, artifact.locator);
  if (!verification.ok) {
    throw new Error(`Artifact verification failed: ${verification.reason}`);
  }

  // Resolve the bot — async, so do it outside the sync transaction.
  const deployment = await DeploymentRepository.findById(bot_ref);
  if (!deployment) {
    throw new Error(`Unknown bot_ref '${bot_ref}' — no deployment with that id`);
  }

  const catalystLabel = resolveCatalystLabel(catalyst_ref);
  const artifactRef = buildArtifactRef(adapter_id, artifact.locator);

  // Pre-embed every distinct user-supplied principle body before opening
  // the sync txn. Each insert inside attachPrinciples upserts using the map.
  const principleBodies = Array.isArray(principles)
    ? principles.map((p) => (p && typeof p.body_md === 'string' ? p.body_md : null))
    : [];
  const bodyEmbeddings = await embedPrincipleBodies(principleBodies);

  // ---- atomic write ----

  const result = MetaContextRepository.commit(() => {
    const botNode = MetaNodeRepository.upsert({
      kind: 'bot',
      ref: bot_ref,
      label: deployment.botName || bot_ref,
    });
    const adapterNode = MetaNodeRepository.upsert({
      kind: 'adapter',
      ref: adapter_id,
      label: adapter.name,
    });
    const catalystNode = MetaNodeRepository.upsert({
      kind: 'catalyst',
      ref: catalyst_ref,
      label: catalystLabel,
    });
    const artifactNode = MetaNodeRepository.upsert({
      kind: 'artifact',
      ref: artifactRef,
      label: artifact.label,
      payload: {
        adapter_id,
        locator: artifact.locator,
        host: adapter.name,
      },
    });

    const bindsEdgesByToolRef = new Map();
    for (const b of bindingsList) {
      const toolNode = MetaNodeRepository.upsert({
        kind: 'mcp_tool',
        ref: b.mcp_tool,
        label: b.mcp_tool,
      });
      const edge = MetaEdgeRepository.upsert({
        src_id: artifactNode.id,
        dst_id: toolNode.id,
        kind: 'binds',
        payload: b.fields_bound ? { fields_bound: b.fields_bound } : null,
      });
      bindsEdgesByToolRef.set(b.mcp_tool, edge);
    }

    const seededEdge = MetaEdgeRepository.upsert({
      src_id: catalystNode.id,
      dst_id: artifactNode.id,
      kind: 'seeded',
    });
    const materializedByEdge = MetaEdgeRepository.upsert({
      src_id: artifactNode.id,
      dst_id: adapterNode.id,
      kind: 'materialized_by',
    });
    const runsForEdge = MetaEdgeRepository.upsert({
      src_id: artifactNode.id,
      dst_id: botNode.id,
      kind: 'runs_for',
    });

    const scopeMap = {
      nodes: {
        artifact: artifactNode,
        catalyst: catalystNode,
        adapter: adapterNode,
        bot: botNode,
      },
      edges: {
        seeded: seededEdge,
        materialized_by: materializedByEdge,
        runs_for: runsForEdge,
      },
    };

    const principlesCreated = attachPrinciples({
      principles,
      scopeMap,
      bindsEdgesByToolRef,
      bodyEmbeddings,
    });

    return {
      botNode,
      adapterNode,
      catalystNode,
      artifactNode,
      seededEdge,
      materializedByEdge,
      runsForEdge,
      bindsEdges: Array.from(bindsEdgesByToolRef.entries()).map(([mcp_tool, edge]) => ({
        mcp_tool,
        edge,
      })),
      principlesCreated,
    };
  });

  const warnings = [];
  if (!MetaContextRepository.hasOperator()) warnings.push('no_operator_anchor');

  return {
    ok: true,
    artifactNodeId: result.artifactNode.id,
    nodes: {
      bot: result.botNode.id,
      adapter: result.adapterNode.id,
      catalyst: result.catalystNode.id,
      artifact: result.artifactNode.id,
    },
    edges: {
      seeded: result.seededEdge.id,
      materialized_by: result.materializedByEdge.id,
      runs_for: result.runsForEdge.id,
      binds: result.bindsEdges.map(({ mcp_tool, edge }) => ({ mcp_tool, edgeId: edge.id })),
    },
    principlesCreated: result.principlesCreated.length,
    verification,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

// ---------------------------------------------------------------------------
// commit: primitive_artifact_materialization
//
// Parallel to artifact_materialization but for compositions built via the
// primitive-binding architecture (no bot, no catalyst, runtime-introspected
// MCP tool names). The shape of the contextmap write differs:
//   - No bot node (operator-side composition, not bot-scoped)
//   - No catalyst node (composition is primitive-driven, not recipe-driven)
//   - No `seeded` edge (no catalyst → artifact predecessor)
//   - No `runs_for` edge (no bot to run for; v1 may link artifact → operator)
//   - `binds` edges name MCP tools resolved from the persisted provider
//     artifacts the agent produced via bind_primitives — same edge kind as
//     the bot-shaped path, payload carries primitive / role / affordance /
//     confidence / server for audit traceability.
//
// See lite-template/integration/MCP_PRIMITIVE_BINDING_PLAN.md.
// ---------------------------------------------------------------------------

function composeAutoSummaryPrinciple({ composition_intent, providerArtifacts }) {
  const lines = [
    '**Composition intent:** ' + composition_intent,
    '',
    '**Primitive bindings:**',
  ];
  for (const pa of providerArtifacts) {
    lines.push(
      `- \`${pa.primitiveRef}\` (${pa.role}) on \`${pa.server}\` — provider artifact \`${pa.ref}\` (snapshot ${pa.introspectedAt || 'unknown'}, confidence ${pa.snapshotConfidence || 'unknown'})`,
    );
    for (const b of pa.manifest?.bound || []) {
      lines.push(`    - \`${b.affordance}\` → \`${b.tool}\` (${b.confidence})`);
    }
    const unboundRefs = (pa.manifest?.unbound || []).map((u) => `\`${u.affordance}\``);
    if (unboundRefs.length > 0) {
      lines.push(`    - **unbound:** ${unboundRefs.join(', ')}`);
    }
  }
  return lines.join('\n');
}

export async function commitPrimitiveArtifactMaterialization(input, _ctx) {
  const {
    adapter_id,
    artifact,
    composition_intent,
    provider_artifact_refs,
    principles,
  } = input;

  // ---- pre-transaction validation ----

  if (!adapter_id || typeof adapter_id !== 'string') {
    throw new Error('adapter_id is required');
  }
  const adapter = getAdapter(adapter_id);
  if (!adapter) {
    throw new Error(`Unknown adapter '${adapter_id}'. Call list_adapters to see what's available.`);
  }

  if (!artifact || typeof artifact !== 'object') {
    throw new Error('artifact is required, e.g. { locator: "...", label: "..." }');
  }
  if (!artifact.locator || typeof artifact.locator !== 'string') {
    throw new Error('artifact.locator is required');
  }
  if (!artifact.label || typeof artifact.label !== 'string') {
    throw new Error('artifact.label is required');
  }

  if (!composition_intent || typeof composition_intent !== 'string' || !composition_intent.trim()) {
    throw new Error(
      'composition_intent is required — a one-paragraph operator-stated intent for audit',
    );
  }

  if (!Array.isArray(provider_artifact_refs) || provider_artifact_refs.length === 0) {
    throw new Error(
      'provider_artifact_refs must be a non-empty array of refs returned by bind_primitives',
    );
  }

  // Resolve every provider artifact up-front so we fail before touching the
  // contextmap if any ref is invalid.
  const providerArtifacts = provider_artifact_refs.map((ref) => {
    if (typeof ref !== 'string' || !ref) {
      throw new Error('every provider_artifact_ref must be a non-empty string');
    }
    const pa = ProviderArtifactRepository.findByRef(ref);
    if (!pa) {
      throw new Error(
        `Provider artifact '${ref}' not found. Refs come from bind_primitives's response.`,
      );
    }
    return pa;
  });

  // Adapter-delegated verification BEFORE we touch the DB.
  const verification = verifyArtifact(adapter_id, artifact.locator);
  if (!verification.ok) {
    throw new Error(`Artifact verification failed: ${verification.reason}`);
  }

  const artifactRef = buildArtifactRef(adapter_id, artifact.locator);

  // Pre-embed every principle body: the auto-summary plus every distinct
  // user-supplied body. Both flavors land in meta_principles inside the txn
  // below — the embedding rows commit / roll back atomically with them.
  const autoSummaryBody = composeAutoSummaryPrinciple({
    composition_intent: composition_intent.trim(),
    providerArtifacts,
  });
  const userBodies = Array.isArray(principles)
    ? principles.map((p) => (p && typeof p.body_md === 'string' ? p.body_md : null))
    : [];
  const bodyEmbeddings = await embedPrincipleBodies([autoSummaryBody, ...userBodies]);

  // ---- atomic write ----

  const result = MetaContextRepository.commit(() => {
    const adapterNode = MetaNodeRepository.upsert({
      kind: 'adapter',
      ref: adapter_id,
      label: adapter.name,
    });
    const artifactNode = MetaNodeRepository.upsert({
      kind: 'artifact',
      ref: artifactRef,
      label: artifact.label,
      payload: {
        adapter_id,
        locator: artifact.locator,
        host: adapter.name,
        composition: {
          intent_md: composition_intent.trim(),
          provider_artifact_refs: providerArtifacts.map((pa) => pa.ref),
        },
      },
    });

    // For every bound affordance across every provider artifact, upsert the
    // tool node and a binds edge. The binds payload carries the per-binding
    // context so a future reader can answer "which primitive role bound this
    // tool, with what confidence, from which provider artifact?" without
    // joining back to the provider_artifacts table.
    const bindsEdgesByToolRef = new Map();
    for (const pa of providerArtifacts) {
      for (const b of pa.manifest?.bound || []) {
        const toolRef = `${pa.server}.${b.tool}`;
        const toolNode = MetaNodeRepository.upsert({
          kind: 'mcp_tool',
          ref: toolRef,
          label: toolRef,
        });
        // If multiple provider artifacts bind the same tool, the existing
        // edge upsert handles it (idempotent). The payload from the FIRST
        // binding wins, which is fine for v0 — Phase B can de-overlap.
        if (!bindsEdgesByToolRef.has(toolRef)) {
          const edge = MetaEdgeRepository.upsert({
            src_id: artifactNode.id,
            dst_id: toolNode.id,
            kind: 'binds',
            payload: {
              primitive: pa.primitiveRef,
              role: pa.role,
              affordance: b.affordance,
              confidence: b.confidence,
              server: pa.server,
              provider_artifact_ref: pa.ref,
            },
          });
          bindsEdgesByToolRef.set(toolRef, edge);
        }
      }
    }

    const materializedByEdge = MetaEdgeRepository.upsert({
      src_id: artifactNode.id,
      dst_id: adapterNode.id,
      kind: 'materialized_by',
    });

    // Auto-summary principle: the row's own reason for existing. Future
    // sessions reading the artifact node should be able to recover the
    // composition's intent + binding shape from this single principle without
    // chasing refs.
    const autoSummaryPrinciple = MetaPrincipleRepository.insert({
      scope_kind: 'node',
      scope_id: artifactNode.id,
      body_md: autoSummaryBody,
      source_event: 'primitive_artifact_materialization',
    });
    upsertPrincipleEmbedding(autoSummaryPrinciple, bodyEmbeddings);

    // Optional user-provided principles. Same scope vocabulary as the bot-
    // shaped path EXCEPT 'catalyst', 'bot', 'seeded', 'runs_for' don't exist
    // here — attachPrinciples will throw on those because the scopeMap omits
    // them, which is the correct behavior.
    const scopeMap = {
      nodes: {
        artifact: artifactNode,
        adapter: adapterNode,
      },
      edges: {
        materialized_by: materializedByEdge,
      },
    };
    const userPrinciples = attachPrinciples({
      principles,
      scopeMap,
      bindsEdgesByToolRef,
      sourceEvent: 'primitive_artifact_materialization',
      bodyEmbeddings,
    });

    return {
      adapterNode,
      artifactNode,
      materializedByEdge,
      bindsEdges: Array.from(bindsEdgesByToolRef.entries()).map(([mcp_tool, edge]) => ({
        mcp_tool,
        edge,
      })),
      autoSummaryPrinciple,
      userPrinciples,
    };
  });

  const warnings = [];
  if (!MetaContextRepository.hasOperator()) warnings.push('no_operator_anchor');

  return {
    ok: true,
    artifactNodeId: result.artifactNode.id,
    nodes: {
      adapter: result.adapterNode.id,
      artifact: result.artifactNode.id,
    },
    edges: {
      materialized_by: result.materializedByEdge.id,
      binds: result.bindsEdges.map(({ mcp_tool, edge }) => ({ mcp_tool, edgeId: edge.id })),
    },
    autoSummaryPrincipleId: result.autoSummaryPrinciple.id,
    principlesCreated: 1 + result.userPrinciples.length,
    verification,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

// ---------------------------------------------------------------------------
// registration
// ---------------------------------------------------------------------------

export function registerMetaContextTools() {
  registerTool({
    name: 'meta_context_brief',
    description:
      "Read the contextmap subgraph for a scope: `{ kind: 'fleet' }` for the whole graph, or `{ kind: 'bot' | 'catalyst' | 'adapter' | 'artifact', ref }` for a 1-hop neighborhood. Use when checking \"has the fleet already committed to something related to what I'm about to do?\", or when the user asks why a binding looks the way it does — the `materialized_by` / `binds` edges carry the reasoning principles. Empty fleet brief returns `meta.suggest_kyc: true` — surface the operator KYC at that point. **Brief returns the graph as recorded, not as currently active.** Append-only by design — stale rows from deleted artifacts are not auto-pruned; cross-reference with `list_deployments` or filesystem checks before treating a binding as live. Read-only.",
    inputSchema: {
      type: 'object',
      properties: {
        scope: {
          type: 'object',
          properties: {
            kind: {
              type: 'string',
              enum: BRIEF_SCOPE_KINDS,
              description:
                "'fleet' returns the whole contextmap (capped). Per-scope kinds return a 1-hop neighborhood around the named node.",
            },
            ref: {
              type: 'string',
              description: "External id of the anchor node (deployment id, catalyst id, adapter id, or composite artifact ref). Required for every kind except 'fleet'.",
            },
          },
          required: ['kind'],
        },
      },
      required: ['scope'],
    },
    handler: briefHandler,
  });

  registerTool({
    name: 'meta_context_commit',
    description:
      "Seal a structural decision. Three event types: (1) `operator_kyc` — optional one-time bootstrap anchoring the fleet on role + primary_goal + locked-in constraints (use `revise: true` to attach a new principle to the same operator node). (2) `artifact_materialization` — atomic per-materialization seal for bot-shaped catalysts: which catalyst was materialized into which artifact via which host adapter for which bot, plus bindings (mcp_tool + fields_bound) and principles. (3) `primitive_artifact_materialization` — atomic per-materialization seal for primitive-binding compositions (no bot, no catalyst): adapter_id + artifact + composition_intent + `provider_artifact_refs` from prior `bind_primitives` calls. The contextmap auto-writes a summary principle on the artifact node listing every binding (primitive / role / affordance / bound tool / confidence) so future readers recover the composition's intent + shape from one row. Adapter-delegated verification runs before write (claude-code/generic require existsSync; codex accepts opaque locators on assertion). Call ONLY AFTER materializing the artifact — never to declare intent. On commit failure, roll back via the host adapter's own affordance (delete file / cancel automation).",
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['operator_kyc', 'artifact_materialization', 'primitive_artifact_materialization'],
        },
        // operator_kyc fields
        role: { type: 'string' },
        primary_goal: { type: 'string' },
        constraints: { type: 'array', items: { type: 'string' } },
        revise: { type: 'boolean' },
        // artifact_materialization + primitive_artifact_materialization shared fields
        adapter_id: { type: 'string' },
        artifact: {
          type: 'object',
          properties: {
            locator: { type: 'string' },
            label: { type: 'string' },
          },
        },
        // artifact_materialization (bot-shaped) only
        bot_ref: { type: 'string' },
        catalyst_ref: { type: 'string' },
        bindings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              mcp_tool: { type: 'string' },
              fields_bound: { type: 'array', items: { type: 'string' } },
            },
            required: ['mcp_tool'],
          },
        },
        // primitive_artifact_materialization only
        composition_intent: {
          type: 'string',
          description:
            'For primitive_artifact_materialization: a one-paragraph operator-stated intent for the composition (e.g. "weekly digest of open Linear issues into a Google Drive folder"). Used in the auto-generated audit principle.',
        },
        provider_artifact_refs: {
          type: 'array',
          items: { type: 'string' },
          description:
            'For primitive_artifact_materialization: the `prov_xxx` refs returned by prior `bind_primitives` calls — one per primitive slot in the composition. The commit walks these to build the binds edges in the contextmap.',
        },
        // shared
        principles: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              scope: {
                type: 'string',
                description:
                  "For artifact_materialization: 'artifact' | 'catalyst' | 'adapter' | 'bot' (node scopes); 'seeded' | 'materialized_by' | 'runs_for' | 'binds' (edge scopes); or 'binds:<mcp_tool_ref>' for one specific binding. For primitive_artifact_materialization: only 'artifact' | 'adapter' | 'materialized_by' | 'binds' | 'binds:<mcp_tool_ref>' are valid (no catalyst, bot, seeded, or runs_for in primitive compositions).",
              },
              body_md: { type: 'string' },
            },
            required: ['scope', 'body_md'],
          },
        },
      },
      required: ['type'],
    },
    handler: commitHandler,
  });
}
