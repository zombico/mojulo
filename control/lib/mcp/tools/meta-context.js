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
import { getAdapter } from '@/lib/mcp/adapters/loader';
import { getCatalyst } from '@/lib/mcp/catalysts/loader';
import { verifyArtifact } from '@/lib/mcp/meta-context/verification';

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
    default:
      throw new Error(
        `Unknown commit event type '${input.type}'. MVP supports: 'operator_kyc', 'artifact_materialization'.`,
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

function attachPrinciples({ principles, scopeMap, bindsEdgesByToolRef }) {
  if (!Array.isArray(principles) || principles.length === 0) return [];
  const created = [];
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
      created.push(
        MetaPrincipleRepository.insert({
          scope_kind: 'edge',
          scope_id: edge.id,
          body_md: p.body_md,
          source_event: 'artifact_materialization',
        }),
      );
      continue;
    }

    if (PRINCIPLE_NODE_SCOPES.has(scope)) {
      const node = scopeMap.nodes[scope];
      if (!node) throw new Error(`principle scope '${scope}' has no matching node in this commit`);
      created.push(
        MetaPrincipleRepository.insert({
          scope_kind: 'node',
          scope_id: node.id,
          body_md: p.body_md,
          source_event: 'artifact_materialization',
        }),
      );
      continue;
    }

    if (PRINCIPLE_EDGE_SCOPES.has(scope)) {
      if (scope === 'binds') {
        if (bindsEdgesByToolRef.size === 0) {
          throw new Error("principle scope 'binds' requires at least one binding in this commit");
        }
        for (const edge of bindsEdgesByToolRef.values()) {
          created.push(
            MetaPrincipleRepository.insert({
              scope_kind: 'edge',
              scope_id: edge.id,
              body_md: p.body_md,
              source_event: 'artifact_materialization',
            }),
          );
        }
        continue;
      }
      const edge = scopeMap.edges[scope];
      if (!edge) throw new Error(`principle scope '${scope}' has no matching edge in this commit`);
      created.push(
        MetaPrincipleRepository.insert({
          scope_kind: 'edge',
          scope_id: edge.id,
          body_md: p.body_md,
          source_event: 'artifact_materialization',
        }),
      );
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
// registration
// ---------------------------------------------------------------------------

export function registerMetaContextTools() {
  registerTool({
    name: 'meta_context_brief',
    description:
      "Ring 6 — DELIBERATION surface. Read the contextmap subgraph (nodes + edges + principles) for a scope: `{ kind: 'fleet' }` for the whole graph, or `{ kind: 'bot' | 'catalyst' | 'adapter' | 'artifact', ref: '<id>' }` for a 1-hop neighborhood. Call when wondering 'has the fleet already committed to something related to what I'm about to do?' or when the user asks 'why does bot-3 route field X to tool Y?' / 'why is this a Codex automation and not a skill?' (the `materialized_by` and `binds` edges carry principles that record the reasoning). An empty fleet brief returns `meta: { empty: true, suggest_kyc: true }` — surface the operator KYC at that point. **Brief returns the contextmap as *recorded*, not as *currently active*.** The graph is append-only by design — stale rows from deleted artifacts are not auto-pruned, so a `runs_for` / `binds` edge can outlive the artifact it describes. Cross-reference with `list_deployments` / filesystem checks before acting on a binding as if it's live. Do NOT call for routine orientation (`forward_context`), operational metrics (`fleet_*`), or content questions (`operate.*`). Read-only.",
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
      "Ring 6 — DELIBERATION surface. Seal a structural decision. Two event types in MVP: (1) `operator_kyc` — optional one-time bootstrap that anchors the fleet on role + primary_goal + locked-in constraints; subsequent commits with `revise: true` attach a new principle to the same operator node. (2) `artifact_materialization` — atomic per-materialization seal recording which catalyst was materialized into which artifact via which host adapter for which bot, plus the bindings (which MCP tools and which fields_bound) and any principles capturing the reasoning. Adapter-delegated verification runs BEFORE the write: claude-code/generic require existsSync; codex accepts opaque locators on assertion. Call ONLY AFTER materializing the artifact — never to declare an intention. If commit fails, roll back the artifact by the host adapter's own affordance (delete file / cancel automation).",
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['operator_kyc', 'artifact_materialization'],
        },
        // operator_kyc fields
        role: { type: 'string' },
        primary_goal: { type: 'string' },
        constraints: { type: 'array', items: { type: 'string' } },
        revise: { type: 'boolean' },
        // artifact_materialization fields
        adapter_id: { type: 'string' },
        artifact: {
          type: 'object',
          properties: {
            locator: { type: 'string' },
            label: { type: 'string' },
          },
        },
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
        principles: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              scope: {
                type: 'string',
                description:
                  "One of: 'artifact', 'catalyst', 'adapter', 'bot' (node scopes); 'seeded', 'materialized_by', 'runs_for', 'binds' (edge scopes); or 'binds:<mcp_tool_ref>' to target one specific binding edge.",
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
