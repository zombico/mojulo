/**
 * Plan → contextmap release bridge ("closing the loop").
 *
 * A plan is the PROPOSED layer; the contextmap is committed reality. When a
 * plan's executed manifest materializes an artifact into the contextmap (an
 * `app_materialization` / `primitive_artifact_materialization` /
 * `artifact_materialization` commit), the loop closes:
 *
 *   1. A `plan_release` principle is timestamped on the materialized artifact
 *      node — so the artifact's subhistory records *which plan released it*.
 *      It rides the same embedding path as every other principle, so
 *      semantic_search recalls it.
 *   2. The plan is archived (status untouched; `archived` is orthogonal) with a
 *      `release` record carrying the link back to the artifact(s).
 *
 * Coupling is one-way, mirroring the research→plan bridge (lib/research/
 * evaluate.js): plan mode depends on the contextmap (this module imports the
 * meta-context repositories + PlanRepository); the contextmap never imports
 * plan mode. The detection of *which* commits materialized lives in the
 * caller (execute_plan), which sees each manifest call's result.
 *
 * See lite-template/integration/app-system/0527/plan-feature/PLAN_MODE.md.
 */

import {
  MetaNodeRepository,
  MetaPrincipleRepository,
  MetaContextRepository,
} from '@/lib/db/repositories/meta-context';
import { PlanRepository } from '@/lib/db/repositories/plans';
import {
  embedPrincipleBodies,
  upsertPrincipleEmbedding,
} from '@/lib/mcp/meta-context/principle-embeddings';

// Only these commit types register a *new* service/artifact a plan can be the
// release of. Trigger binding (trigger_artifact_materialization) wires
// activation onto an EXISTING artifact and writes its own principle, so it
// doesn't archive the plan that bound it.
const RELEASE_COMMIT_TYPES = new Set([
  'app_materialization',
  'primitive_artifact_materialization',
  'artifact_materialization',
]);

export function isReleaseCommitType(type) {
  return RELEASE_COMMIT_TYPES.has(type);
}

function firstNonEmptyLine(text) {
  return (
    String(text || '')
      .split('\n')
      .map((s) => s.trim())
      .find(Boolean) || ''
  );
}

function composePlanReleaseBody({ plan, node, commitType }) {
  const steps = Array.isArray(plan.manifest) ? plan.manifest.length : 0;
  const lensClause = plan.lens ? `\`${plan.lens}\`` : 'plan';
  const lines = [
    `**Released by plan:** ${plan.title} (\`${plan.planRef}\`)`,
    '',
    `**Artifact:** ${node.label} (\`${node.ref}\`)`,
    '',
    `Materialized as the executed manifest of a ${lensClause} (\`${commitType}\`).`,
  ];
  const goalLine = firstNonEmptyLine(plan.goalMd);
  if (goalLine) {
    lines.push('', `**Plan goal:** ${goalLine}`);
  }
  lines.push('', `**Executed:** ${new Date().toISOString()} · **Manifest steps:** ${steps}`);
  return lines.join('\n');
}

/**
 * Graduate a plan's materializations into the contextmap and archive the plan.
 *
 * @param {object}   args
 * @param {object}   args.plan            The plan row (must carry planRef, title, lens, goalMd, manifest).
 * @param {Array}    args.materializations [{ artifactNodeId, commitType }] gathered from execute_plan.
 * @returns {Promise<{ release, plan }|null>} null when nothing materialized (no archive).
 */
export async function recordPlanReleases({ plan, materializations } = {}) {
  if (!plan || typeof plan.planRef !== 'string') {
    throw new Error('recordPlanReleases requires a plan with a planRef');
  }

  // Dedupe by artifact node; keep the first commit type seen for each.
  const byNode = new Map();
  for (const m of Array.isArray(materializations) ? materializations : []) {
    if (!m || !Number.isInteger(m.artifactNodeId)) continue;
    if (m.commitType && !RELEASE_COMMIT_TYPES.has(m.commitType)) continue;
    if (!byNode.has(m.artifactNodeId)) byNode.set(m.artifactNodeId, m.commitType || null);
  }
  if (byNode.size === 0) return null;

  // Resolve nodes + compose bodies OUTSIDE the txn (node reads + the async
  // embed both need to happen before the sync commit).
  const targets = [];
  for (const [nodeId, commitType] of byNode) {
    const node = MetaNodeRepository.findById(nodeId);
    if (!node) continue;
    targets.push({ node, commitType, bodyMd: composePlanReleaseBody({ plan, node, commitType }) });
  }
  if (targets.length === 0) return null;

  const bodyEmbeddings = await embedPrincipleBodies(targets.map((t) => t.bodyMd));

  const written = MetaContextRepository.commit(() => {
    const out = [];
    for (const t of targets) {
      const principle = MetaPrincipleRepository.insert({
        scope_kind: 'node',
        scope_id: t.node.id,
        body_md: t.bodyMd,
        source_event: 'plan_release',
      });
      upsertPrincipleEmbedding(principle, bodyEmbeddings);
      out.push({ node: t.node, commitType: t.commitType, principleId: principle.id });
    }
    return out;
  });

  const release = {
    archivedAt: Math.floor(Date.now() / 1000),
    artifacts: written.map((w) => ({
      artifactRef: w.node.ref,
      artifactNodeId: w.node.id,
      artifactLabel: w.node.label,
      commitType: w.commitType,
      principleId: w.principleId,
    })),
  };

  const archived = PlanRepository.archiveWithRelease(plan.planRef, release);
  return { release, plan: archived };
}

export const _internals = { RELEASE_COMMIT_TYPES, composePlanReleaseBody };
