/**
 * MCP Ring 6 — meta_context (deliberation surface).
 *
 * Writeable, durable layer that records *why* structural decisions were made:
 * which composition or app materialized into which artifact via which host
 * adapter, what locked-in constraints the operator declared, what mapping
 * decisions specific bindings encode.
 *
 * Tools:
 *
 *   - meta_context_brief — read the contextmap subgraph + principles
 *   - meta_context_commit — seal a structural decision (operator_kyc,
 *     operator_workspace_setup, primitive / app / trigger materializations)
 *   - meta_context_analyze — read-only drift audit over sealed bindings
 *
 * artifact_materialization, the 2.x seal of a catalyst materialized FOR A
 * DEPLOYED BOT (it required a bot_ref resolved against the deployments table),
 * left with the chatbot factory in 3.0.0. A new commit of that type answers
 * with the moved notice and writes nothing; the events and graph rows it wrote
 * stay readable (brief, recommend_catalysts' priorMaterializations).
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
import { BOT_FACTORY_MOVED } from '@/lib/mcp/bot-factory-moved';
import { ProviderArtifactRepository } from '@/lib/db/repositories/mcp-orbit-provider-artifacts';
import { TriggerArtifactRepository } from '@/lib/db/repositories/trigger-artifacts';
import { getAdapter } from '@/lib/mcp/adapters/loader';
import { verifyArtifact, verifyAppArtifact } from '@/lib/mcp/meta-context/verification';
import {
  embedPrincipleBodies,
  upsertPrincipleEmbedding,
} from '@/lib/mcp/meta-context/principle-embeddings';
import { analyze, ANALYZE_LENSES } from '@/lib/mcp/meta-context/analyze';

// ---------------------------------------------------------------------------
// brief
// ---------------------------------------------------------------------------

// 'bot' stays a readable scope: a 2.x install's contextmap holds bot nodes that
// artifact_materialization wrote. Nothing writes a bot node since 3.0.0.
const BRIEF_SCOPE_KINDS = ['fleet', 'bot', 'catalyst', 'adapter', 'artifact'];
// 'bot' still reads a 2.x install's rows but is not listed: the chatbot factory left in 3.0.
const LISTED_BRIEF_SCOPE_KINDS = BRIEF_SCOPE_KINDS.filter((kind) => kind !== 'bot');

export async function briefHandler(input, _ctx) {
  const scope = input?.scope;
  if (!scope || typeof scope !== 'object') {
    throw new Error('scope is required, e.g. { kind: "fleet" } or { kind: "artifact", ref: "claude-code:/path/SKILL.md" }');
  }
  if (!BRIEF_SCOPE_KINDS.includes(scope.kind)) {
    throw new Error(
      `scope.kind must be one of: ${BRIEF_SCOPE_KINDS.join(', ')} (got '${scope.kind}')`,
    );
  }
  return MetaContextRepository.brief(scope);
}

// ---------------------------------------------------------------------------
// analyze — read-only arbiter lenses over the contextmap
// ---------------------------------------------------------------------------

export async function analyzeHandler(input, _ctx) {
  const scope = input?.scope;
  const lens = input?.lens || 'stale-bindings';
  if (!scope || typeof scope !== 'object') {
    throw new Error("scope is required, e.g. { kind: 'fleet' } or { kind: 'artifact', ref }");
  }
  return analyze({ scope, lens });
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
    case 'operator_workspace_setup':
      return commitOperatorWorkspaceSetup(input);
    case 'artifact_materialization':
      // The bot-bound seal left with the chatbot factory (see the header). Write nothing.
      throw new Error(ARTIFACT_MATERIALIZATION_MOVED);
    case 'primitive_artifact_materialization':
      return commitPrimitiveArtifactMaterialization(input, ctx);
    case 'app_materialization':
      return commitAppMaterialization(input, ctx);
    case 'trigger_artifact_materialization':
      return commitTriggerArtifactMaterialization(input, ctx);
    default:
      throw new Error(
        `Unknown commit event type '${input.type}'. Supported: 'operator_kyc', 'operator_workspace_setup', 'primitive_artifact_materialization', 'app_materialization', 'trigger_artifact_materialization'.`,
      );
  }
}

// ---------------------------------------------------------------------------
// commit: operator_kyc
// ---------------------------------------------------------------------------

// Register-tuning enums — kept here so the kyc validator and the
// forward_context handler share one source of truth for the allowed values.
// See lite-template/integration/REGISTER_TUNING_PLAN.md.
export const VOCABULARY_REGISTERS = ['plain', 'mixed', 'mojulo'];
export const PROCEDURAL_DISCLOSURES = ['terse', 'reflective', 'pedagogical'];
export const DEFAULT_VOCABULARY_REGISTER = 'mixed';
export const DEFAULT_PROCEDURAL_DISCLOSURE = 'reflective';

function composeOperatorKycBody({
  role,
  primary_goal,
  constraints,
  vocabulary_register,
  procedural_disclosure,
}) {
  const lines = [`**Role:** ${role}`];
  if (primary_goal) lines.push('', `**Primary goal:** ${primary_goal}`);
  lines.push('', '**Locked-in constraints:**');
  for (const c of constraints) lines.push(`- ${c}`);
  // Surface register prefs in the prose too so an agent reading
  // meta_context_brief sees them alongside the rest of the anchor.
  // forward_context still does the authoritative lookup against the
  // operator node's payload.
  if (vocabulary_register || procedural_disclosure) {
    lines.push('', '**Communication preferences:**');
    if (vocabulary_register) lines.push(`- vocabulary_register: ${vocabulary_register}`);
    if (procedural_disclosure) lines.push(`- procedural_disclosure: ${procedural_disclosure}`);
  }
  return lines.join('\n');
}

export async function commitOperatorKyc(input) {
  const { role, primary_goal, constraints, revise, vocabulary_register, procedural_disclosure } =
    input;

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
  if (vocabulary_register !== undefined && !VOCABULARY_REGISTERS.includes(vocabulary_register)) {
    throw new Error(
      `\`vocabulary_register\` must be one of: ${VOCABULARY_REGISTERS.join(', ')} (got '${vocabulary_register}')`,
    );
  }
  if (
    procedural_disclosure !== undefined &&
    !PROCEDURAL_DISCLOSURES.includes(procedural_disclosure)
  ) {
    throw new Error(
      `\`procedural_disclosure\` must be one of: ${PROCEDURAL_DISCLOSURES.join(', ')} (got '${procedural_disclosure}')`,
    );
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

  // Preserve existing register prefs across revisions when the user doesn't
  // re-specify them. Otherwise a revise call that only updates role would
  // silently reset register preferences set in an earlier commit.
  const existingPayload = (existing && existing.payload) || {};
  const mergedRegister = vocabulary_register ?? existingPayload.vocabulary_register;
  const mergedDisclosure = procedural_disclosure ?? existingPayload.procedural_disclosure;
  const nodePayload =
    mergedRegister || mergedDisclosure
      ? {
          ...(mergedRegister ? { vocabulary_register: mergedRegister } : {}),
          ...(mergedDisclosure ? { procedural_disclosure: mergedDisclosure } : {}),
        }
      : null;

  const bodyMd = composeOperatorKycBody({
    role: role.trim(),
    primary_goal,
    constraints,
    vocabulary_register: mergedRegister,
    procedural_disclosure: mergedDisclosure,
  });

  // Pre-embed the principle body before opening the sync txn — better-sqlite3
  // requires the txn fn to be sync, and the model call is async. The hash +
  // vector get applied inside the txn after the principle's id is known.
  const bodyEmbeddings = await embedPrincipleBodies([bodyMd]);

  const result = MetaContextRepository.commit(() => {
    const node = MetaNodeRepository.upsert({
      kind: 'operator',
      ref: 'self',
      label: role.trim(),
      payload: nodePayload,
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
// commit: operator_workspace_setup
//
// Records operator-level filesystem-workspace decisions on the operator node.
// Distinct from `operator_kyc` so the catalyst (most commonly the `local-storage`
// technique) doesn't have to preserve role/constraints across revises just to
// set workspace_root, and so the resulting principle isn't rendered under
// "Locked-in constraints:" — which is a KYC-shaped header, not a setup one.
//
// Append-only: every call writes a fresh principle (or pair). Readers that
// want "the current workspace_root" read the latest principle with
// source_event = 'operator_workspace_setup' on the operator node.
// ---------------------------------------------------------------------------

function isValidWorkspaceRoot(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  // Reject ../ escape segments — same discipline as the generator's
  // pathPrefix validation. Allow drive-letter roots and POSIX absolute paths;
  // relative paths are rejected because the filesystem MCP only accepts
  // absolute paths at runtime.
  if (trimmed.split(/[\\/]/).includes('..')) return false;
  const isPosixAbs = trimmed.startsWith('/');
  const isWindowsAbs = /^[A-Za-z]:[\\/]/.test(trimmed);
  return isPosixAbs || isWindowsAbs;
}

function composeWorkspaceRootBody(workspaceRoot) {
  return `**Workspace root:** \`${workspaceRoot}\`\n\nMojulo materializes \`local-storage\` bindings under this path. The filesystem MCP must be launched with this path (or an ancestor) in its allow-list for the bindings to be reachable at runtime.`;
}

function composeWorkspaceConventionsBody(conventions) {
  return `**Workspace conventions:**\n\n${conventions}`;
}

export async function commitOperatorWorkspaceSetup(input) {
  const { workspace_root, workspace_conventions } = input || {};

  if (!isValidWorkspaceRoot(workspace_root)) {
    throw new Error(
      'operator_workspace_setup requires a non-empty absolute `workspace_root` string (POSIX `/...` or Windows `C:\\...`; no `..` segments).',
    );
  }
  if (
    workspace_conventions !== undefined &&
    workspace_conventions !== null &&
    (typeof workspace_conventions !== 'string' || !workspace_conventions.trim())
  ) {
    throw new Error(
      '`workspace_conventions` must be a non-empty string when provided (omit the field to leave conventions unset).',
    );
  }

  const operator = MetaNodeRepository.findByRef('operator', 'self');
  if (!operator) {
    return {
      ok: false,
      reason: 'operator_anchor_missing',
      hint: "Commit `operator_kyc` first to establish the operator anchor before recording workspace setup.",
    };
  }

  const trimmedRoot = workspace_root.trim();
  const trimmedConventions = workspace_conventions?.trim() || null;
  const rootBody = composeWorkspaceRootBody(trimmedRoot);
  const conventionsBody = trimmedConventions
    ? composeWorkspaceConventionsBody(trimmedConventions)
    : null;

  // Pre-embed bodies before opening the sync txn — same discipline as KYC.
  const bodies = conventionsBody ? [rootBody, conventionsBody] : [rootBody];
  const bodyEmbeddings = await embedPrincipleBodies(bodies);

  const result = MetaContextRepository.commit(() => {
    const rootPrinciple = MetaPrincipleRepository.insert({
      scope_kind: 'node',
      scope_id: operator.id,
      body_md: rootBody,
      source_event: 'operator_workspace_setup',
    });
    upsertPrincipleEmbedding(rootPrinciple, bodyEmbeddings);
    let conventionsPrinciple = null;
    if (conventionsBody) {
      conventionsPrinciple = MetaPrincipleRepository.insert({
        scope_kind: 'node',
        scope_id: operator.id,
        body_md: conventionsBody,
        source_event: 'operator_workspace_setup',
      });
      upsertPrincipleEmbedding(conventionsPrinciple, bodyEmbeddings);
    }
    return { rootPrinciple, conventionsPrinciple };
  });

  return {
    ok: true,
    operatorNodeId: operator.id,
    workspaceRootPrincipleId: result.rootPrinciple.id,
    workspaceConventionsPrincipleId: result.conventionsPrinciple?.id ?? null,
  };
}

// ---------------------------------------------------------------------------
// commit: artifact_materialization — moved (3.0.0)
// ---------------------------------------------------------------------------

export const ARTIFACT_MATERIALIZATION_MOVED =
  "artifact_materialization sealed a catalyst materialized for a deployed bot; it left with the chatbot factory and writes nothing now. "
  + `${BOT_FACTORY_MOVED} `
  + "To seal a workflow over installed MCPs, use primitive_artifact_materialization (after bind_primitives); for an app, app_materialization. "
  + 'Events of this type recorded earlier stay readable through meta_context_brief.';

// ---------------------------------------------------------------------------
// shared: artifact refs and user principles
// ---------------------------------------------------------------------------

// The scopes a user principle may name. The 2.x bot-bound seal also offered
// catalyst / bot (nodes) and seeded / runs_for (edges); no retained commit
// creates those, so they are unknown scopes now.
const PRINCIPLE_NODE_SCOPES = new Set(['artifact', 'adapter']);
const PRINCIPLE_EDGE_SCOPES = new Set(['materialized_by', 'binds']);

function buildArtifactRef(adapterId, locator) {
  // Composite ref so the same locator under different adapters doesn't
  // collide (e.g. a "workflows/foo.md" path that exists under generic AND
  // codex). Adapter prefix is part of the artifact's identity.
  return `${adapterId}:${locator}`;
}

function attachPrinciples({
  principles,
  scopeMap,
  bindsEdgesByToolRef,
  sourceEvent,
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
      `Unknown principle scope '${scope}'. Allowed: artifact, adapter, materialized_by, binds, binds:<mcp_tool_ref>.`,
    );
  }
  return created;
}

// ---------------------------------------------------------------------------
// commit: primitive_artifact_materialization
//
// Seals a composition built via the primitive-binding architecture
// (runtime-introspected MCP tool names). It began as the sibling of the 2.x
// bot-bound artifact_materialization and differs from it the same way:
//   - No catalyst node (composition is primitive-driven, not recipe-driven)
//   - No `seeded` edge (no catalyst → artifact predecessor)
//   - No bot node or `runs_for` edge (operator-side; v1 may link artifact → operator)
//   - `binds` edges name MCP tools resolved from the persisted provider
//     artifacts the agent produced via bind_primitives; the payload carries
//     primitive / role / affordance / confidence / server for audit traceability.
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

    // Optional user-provided principles: artifact / adapter (nodes),
    // materialized_by / binds (edges). attachPrinciples throws on any other
    // scope, which is the correct behavior.
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
// commit: app_materialization
//
// App-paradigm spike: seals a generated SPA codebase (an app). The
// contextmap write:
//   - No catalyst node (spike uses an inline scaffold prompt, no catalyst
//     kind yet — see parent plan anti-scope "App catalyst formalization")
//   - No `seeded` edge
//   - No `binds` edges (the four app bindings live on the artifact node's
//     payload as structured data, summarized by an auto-summary principle —
//     payload-not-bindings precedent established by
//     primitive_artifact_materialization)
//
// The four bindings recorded in `payload.app.bindings`:
//   - runner       — which runner implementation lifecycle this app
//   - durability   — local-fs (spike) or github (post-spike)
//   - inference    — agent-routed (R1) or keyed:<provider> (R2); the R1↔R2
//                    boundary is recorded here
//   - mcp_self     — the structural fact that this app ships its own MCP
//                    sidecar; the live mcp_url is owned by the runner (not
//                    committed — lifecycle events stay run-rate, not
//                    deliberation-rate)
//
// Verification path goes through verifyAppArtifact, which additionally
// checks `<locator>/app-mcp/server.js` exists — the runner can't lifecycle
// an app whose scaffold is incomplete, so we refuse the commit at the gate.
//
// See lite-template/integration/app-system/APP_SPIKE_B_RUNNER_AND_SCHEMA_PLAN.md.
// ---------------------------------------------------------------------------

const APP_RUNNER_IMPLEMENTATIONS = ['local'];
const APP_DURABILITY_KINDS = ['local-fs', 'github'];
const APP_INFERENCE_MODES = ['agent-routed', 'keyed'];

function validateAppBindings(bindings) {
  if (!bindings || typeof bindings !== 'object') {
    throw new Error('app_materialization requires a `bindings` object with runner / durability / inference / mcp_self entries');
  }
  const { runner, durability, inference, mcp_self } = bindings;

  if (!runner || typeof runner !== 'object') {
    throw new Error('bindings.runner is required, e.g. { implementation: "local" }');
  }
  if (!APP_RUNNER_IMPLEMENTATIONS.includes(runner.implementation)) {
    throw new Error(
      `bindings.runner.implementation must be one of: ${APP_RUNNER_IMPLEMENTATIONS.join(', ')} (got '${runner.implementation}')`,
    );
  }

  if (!durability || typeof durability !== 'object') {
    throw new Error('bindings.durability is required, e.g. { kind: "local-fs" }');
  }
  if (!APP_DURABILITY_KINDS.includes(durability.kind)) {
    throw new Error(
      `bindings.durability.kind must be one of: ${APP_DURABILITY_KINDS.join(', ')} (got '${durability.kind}')`,
    );
  }
  if (durability.kind === 'github' && (typeof durability.git_url !== 'string' || !durability.git_url)) {
    throw new Error("bindings.durability.kind = 'github' requires a non-empty git_url");
  }

  if (!inference || typeof inference !== 'object') {
    throw new Error('bindings.inference is required, e.g. { mode: "agent-routed" }');
  }
  if (!APP_INFERENCE_MODES.includes(inference.mode)) {
    throw new Error(
      `bindings.inference.mode must be one of: ${APP_INFERENCE_MODES.join(', ')} (got '${inference.mode}')`,
    );
  }
  if (inference.mode === 'keyed' && (typeof inference.provider !== 'string' || !inference.provider)) {
    throw new Error("bindings.inference.mode = 'keyed' requires a non-empty provider");
  }

  if (!mcp_self || typeof mcp_self !== 'object') {
    throw new Error('bindings.mcp_self is required, e.g. { server_kind: "app", entrypoint: "app-mcp/server.js" }');
  }
  if (mcp_self.server_kind !== 'app') {
    throw new Error("bindings.mcp_self.server_kind must be 'app'");
  }
  if (typeof mcp_self.entrypoint !== 'string' || !mcp_self.entrypoint) {
    throw new Error('bindings.mcp_self.entrypoint must be a non-empty string (e.g. "app-mcp/server.js")');
  }
}

function composeAppAutoSummaryPrinciple({ app_name, bindings, locator }) {
  const lines = [
    `**App:** ${app_name}`,
    '',
    `**Materialized at:** \`${locator}\``,
    '',
    '**Bindings:**',
    `- **runner:** \`${bindings.runner.implementation}\``,
    `- **durability:** \`${bindings.durability.kind}\`` +
      (bindings.durability.git_url ? ` (\`${bindings.durability.git_url}\`)` : ''),
    `- **inference:** \`${bindings.inference.mode}\`` +
      (bindings.inference.provider ? `:\`${bindings.inference.provider}\`` : ''),
    `- **mcp_self:** \`${bindings.mcp_self.server_kind}\` sidecar at \`${bindings.mcp_self.entrypoint}\``,
  ];
  return lines.join('\n');
}

export async function commitAppMaterialization(input, _ctx) {
  const { adapter_id, artifact, app_name, bindings, principles } = input;

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

  if (!app_name || typeof app_name !== 'string' || !app_name.trim()) {
    throw new Error('app_name is required — a stable identifier for the materialized app');
  }

  validateAppBindings(bindings);

  // Adapter-delegated verification PLUS the app-MCP scaffold existence check.
  const verification = verifyAppArtifact(adapter_id, artifact.locator);
  if (!verification.ok) {
    throw new Error(`Artifact verification failed: ${verification.reason}`);
  }

  const artifactRef = buildArtifactRef(adapter_id, artifact.locator);

  // Pre-embed: auto-summary + every distinct user-supplied principle body.
  const autoSummaryBody = composeAppAutoSummaryPrinciple({
    app_name: app_name.trim(),
    bindings,
    locator: artifact.locator,
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
        app: {
          name: app_name.trim(),
          bindings,
        },
      },
    });
    const materializedByEdge = MetaEdgeRepository.upsert({
      src_id: artifactNode.id,
      dst_id: adapterNode.id,
      kind: 'materialized_by',
    });

    // Auto-summary principle scoped to the artifact node — the row's own
    // reason for existing. Future readers recover the app's bindings shape
    // from this one row without joining anywhere else.
    const autoSummaryPrinciple = MetaPrincipleRepository.insert({
      scope_kind: 'node',
      scope_id: artifactNode.id,
      body_md: autoSummaryBody,
      source_event: 'app_materialization',
    });
    upsertPrincipleEmbedding(autoSummaryPrinciple, bodyEmbeddings);

    // Optional user principles. Valid scopes for app_materialization:
    // 'artifact' | 'adapter' (node) and 'materialized_by' (edge). The
    // attachPrinciples scopeMap omits everything else — catalyst/bot/seeded/
    // runs_for/binds will throw, which is the correct posture (apps have no
    // catalyst or bot scope in the spike).
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
      bindsEdgesByToolRef: new Map(),
      sourceEvent: 'app_materialization',
      bodyEmbeddings,
    });

    return {
      adapterNode,
      artifactNode,
      materializedByEdge,
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
    },
    autoSummaryPrincipleId: result.autoSummaryPrinciple.id,
    principlesCreated: 1 + result.userPrinciples.length,
    verification,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

// ---------------------------------------------------------------------------
// commit: trigger_artifact_materialization
//
// Seals a binding between a typed composer trigger component (e.g.
// `trigger/scheduled@0.1.0`) and a target artifact node. Called by
// `bind_trigger` AFTER the trigger artifact row is inserted into
// `mcp_orbit_trigger_artifacts` — this handler resolves the trigger by ref,
// composes the audit principle, and attaches it to the target artifact node.
//
// Phase 1 requires the trigger to carry an `artifact_ref` (no composition-
// only triggers yet — those need either a composition-node representation
// or a new principle scope_kind, both deferred).
//
// Atomicity boundary: the trigger artifact insert in `bind_trigger` lands
// before this commit fires (same precedent as `bind_primitives` + the
// existing `primitive_artifact_materialization` commit). If this commit
// fails after the insert succeeded, the trigger artifact stays at
// `enabled = 1` with no audit principle; `unbind_trigger` is the recovery
// path. The window is small and observable.
// ---------------------------------------------------------------------------

function composeTriggerMaterializationPrincipleBody({
  triggerRef,
  componentRef,
  bindingParams,
  payloadTemplate,
  artifactRef,
  artifactLabel,
}) {
  const lines = [
    `**Trigger bound:** \`${triggerRef}\` (${componentRef})`,
    '',
    `**Drives artifact:** ${artifactLabel} (\`${artifactRef}\`)`,
    '',
    '**Binding params:**',
    '```json',
    JSON.stringify(bindingParams, null, 2),
    '```',
    '',
    '**Payload template:**',
    '```json',
    JSON.stringify(payloadTemplate, null, 2),
    '```',
  ];
  return lines.join('\n');
}

export async function commitTriggerArtifactMaterialization(input, _ctx) {
  const { trigger_ref } = input || {};

  if (!trigger_ref || typeof trigger_ref !== 'string') {
    throw new Error('trigger_ref is required (the ref returned by bind_trigger)');
  }

  const trigger = TriggerArtifactRepository.getByRef(trigger_ref);
  if (!trigger) {
    throw new Error(
      `Trigger '${trigger_ref}' not found. Call bind_trigger first; the returned trigger_ref is what this commit type seals.`,
    );
  }

  if (!trigger.artifactRef) {
    throw new Error(
      'trigger_artifact_materialization requires the trigger to carry an artifact_ref. ' +
        'Composition-only triggers are deferred to a later phase.',
    );
  }

  const artifactNode = MetaNodeRepository.findByRef('artifact', trigger.artifactRef);
  if (!artifactNode) {
    throw new Error(
      `Artifact '${trigger.artifactRef}' has no contextmap node. ` +
        'Materialize the artifact (via primitive_artifact_materialization or app_materialization) before binding triggers to it.',
    );
  }

  const bodyMd = composeTriggerMaterializationPrincipleBody({
    triggerRef: trigger.triggerRef,
    componentRef: trigger.componentRef,
    bindingParams: trigger.bindingParams,
    payloadTemplate: trigger.payloadTemplate,
    artifactRef: trigger.artifactRef,
    artifactLabel: artifactNode.label,
  });

  const bodyEmbeddings = await embedPrincipleBodies([bodyMd]);

  const result = MetaContextRepository.commit(() => {
    const principle = MetaPrincipleRepository.insert({
      scope_kind: 'node',
      scope_id: artifactNode.id,
      body_md: bodyMd,
      source_event: 'trigger_artifact_materialization',
    });
    upsertPrincipleEmbedding(principle, bodyEmbeddings);
    return { principle };
  });

  return {
    ok: true,
    triggerRef: trigger.triggerRef,
    componentRef: trigger.componentRef,
    artifactNodeId: artifactNode.id,
    principleId: result.principle.id,
  };
}

// ---------------------------------------------------------------------------
// registration
// ---------------------------------------------------------------------------

export function registerMetaContextTools() {
  registerTool({
    name: 'meta_context_brief',
    description:
      "Read what meta_context_commit recorded: `{ kind: 'fleet' }` for everything, or `{ kind: 'artifact' | 'catalyst' | 'adapter', ref }` for one node and its neighbors. Check it BEFORE making an app, workflow or trigger: if a related one exists, improve it instead of making a sibling. It is the record, not live state (deleted artifacts are not pruned; `list_running` says what runs). Read-only.",
    inputSchema: {
      type: 'object',
      properties: {
        scope: {
          type: 'object',
          properties: {
            kind: {
              type: 'string',
              enum: LISTED_BRIEF_SCOPE_KINDS,
            },
            ref: { type: 'string', description: "The node's id (artifact ref, catalyst id or adapter id). Not for 'fleet'." },
          },
          required: ['kind'],
        },
      },
      required: ['scope'],
    },
    handler: briefHandler,
  });

  registerTool({
    name: 'meta_context_analyze',
    description:
      "Check recorded connected-service workflows for drift (read-only). Each binding is classed `missing` (its tool is gone), `stale-capability`, `no-capability`, `unknown` (no inventory declared) or `ok`, with recommendations and `summary.providersToRefresh`. Re-declare inventory first.",
    inputSchema: {
      type: 'object',
      properties: {
        scope: {
          type: 'object',
          properties: {
            kind: {
              type: 'string',
              enum: ['fleet', 'artifact'],
            },
            ref: { type: 'string', description: "The artifact ref, for kind 'artifact'." },
          },
          required: ['kind'],
        },
        lens: {
          type: 'string',
          enum: ANALYZE_LENSES,
        },
      },
      required: ['scope'],
    },
    handler: analyzeHandler,
  });

  registerTool({
    name: 'meta_context_commit',
    description:
      "Record something that now exists, AFTER it exists (never to declare intent). The record is what the dashboard's Apps and Connected Services panes list. Types:\n" +
      "- `app_materialization`: an app made with install_scaffold: adapter_id, artifact, app_name, bindings. Refused until `<locator>/app-mcp/server.js` exists.\n" +
      "- `primitive_artifact_materialization`: a connected-service workflow: adapter_id, artifact, composition_intent, provider_artifact_refs from bind_primitives.\n" +
      "- `trigger_artifact_materialization`: a trigger: trigger_ref from bind_trigger.\n" +
      "- `operator_kyc` (optional: role, primary_goal, constraints, how the agent talks) and `operator_workspace_setup` (workspace_root for local storage; needs operator_kyc first).\n" +
      "Append-only. If the commit fails, undo the artifact with the host's own tools.",
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: [
            'app_materialization',
            'primitive_artifact_materialization',
            'trigger_artifact_materialization',
            'operator_kyc',
            'operator_workspace_setup',
          ],
        },
        adapter_id: { type: 'string' },
        artifact: {
          type: 'object',
          properties: {
            locator: { type: 'string' },
            label: { type: 'string' },
          },
        },
        app_name: { type: 'string' },
        bindings: {
          type: 'object',
          properties: {
            runner: {
              type: 'object',
              properties: { implementation: { type: 'string', enum: APP_RUNNER_IMPLEMENTATIONS } },
              required: ['implementation'],
            },
            durability: {
              type: 'object',
              properties: { kind: { type: 'string', enum: APP_DURABILITY_KINDS }, git_url: { type: 'string' } },
              required: ['kind'],
            },
            inference: {
              type: 'object',
              properties: { mode: { type: 'string', enum: APP_INFERENCE_MODES }, provider: { type: 'string' } },
              required: ['mode'],
            },
            mcp_self: {
              type: 'object',
              properties: { server_kind: { type: 'string', enum: ['app'] }, entrypoint: { type: 'string' } },
              required: ['server_kind', 'entrypoint'],
            },
          },
          required: ['runner', 'durability', 'inference', 'mcp_self'],
        },
        composition_intent: { type: 'string', description: 'One paragraph: what the workflow does.' },
        provider_artifact_refs: { type: 'array', items: { type: 'string' }, description: 'The prov_ refs bind_primitives returned, one per slot.' },
        trigger_ref: { type: 'string' },
        role: { type: 'string' },
        primary_goal: { type: 'string' },
        constraints: { type: 'array', items: { type: 'string' } },
        revise: { type: 'boolean', description: 'operator_kyc: add to the existing operator record.' },
        vocabulary_register: { type: 'string', enum: VOCABULARY_REGISTERS, description: 'operator_kyc: how technical your wording is (default mixed).' },
        procedural_disclosure: { type: 'string', enum: PROCEDURAL_DISCLOSURES, description: 'operator_kyc: how much you narrate (default reflective).' },
        workspace_root: { type: 'string', description: 'Absolute path, no `..`.' },
        workspace_conventions: { type: 'string' },
        principles: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              scope: { type: 'string', description: "'artifact' | 'adapter' | 'materialized_by' | 'binds' | 'binds:<mcp_tool_ref>'" },
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
