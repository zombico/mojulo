/**
 * Research → Plan bridge.
 *
 * `synthesize_abstract` distills a research book into a thesis; this is what
 * happens when that thesis is *evaluated by plan mojulo*. The abstract is
 * assessed against plan mode's tractability vocabulary (a lens, a tractable
 * verdict, what's still missing) and — when there's a spike — forged into a
 * Draft plan seeded from the abstract.
 *
 * Single source of truth for the evaluation, invoked from two places:
 *   - in-process by the `synthesize_abstract` MCP tool, and
 *   - over HTTP by `POST /api/plans/from-abstract` (the UI's "Send to plan"
 *     button, or an external research app).
 * The HTTP route is the documented research→plan boundary; the in-process tool
 * short-circuits to this same function rather than looping back over the wire.
 *
 * Coupling is one-way: research depends on plans (this module imports the plan
 * repository); plans never import research. A research-seeded plan is just a
 * normal Draft plan carrying a `research_ref` tag in its analysis.
 *
 * The judgment (which lens, whether tractable) is the agent's — supplied with
 * the abstract — consistent with mojulo's "agent judges, server structures"
 * posture. This function structures and acts on that judgment; it does not
 * second-guess it. Per the v0 decision, a plan is forged ONLY when the
 * recommendation is `forge`; otherwise the verdict is `keep_researching` and
 * the `missing` list flows back as guidance.
 *
 * See lite-template/integration/app-system/0528/research-mode.md.
 */

import { PlanRepository } from '@/lib/db/repositories/plans';

const PLAN_LENSES = new Set([
  'spike',
  'segment_expansion',
  'vertical_reinforcement',
  'collider',
]);
const RECOMMENDATIONS = new Set(['forge', 'keep_researching']);

function deriveTitle(abstract, researchRef) {
  const firstLine =
    String(abstract)
      .split('\n')
      .map((s) => s.trim())
      .find(Boolean) || `Research ${researchRef || ''}`.trim();
  return firstLine.length > 70 ? `${firstLine.slice(0, 67)}…` : firstLine;
}

/**
 * Evaluate a synthesized abstract against the plans paradigm.
 *
 * @returns {{ assessment: { tractable, suggested_lens, missing, recommendation }, planRef: string|null }}
 */
export function evaluateAbstract({
  researchRef,
  abstract,
  suggestedLens,
  recommendation,
  missing,
  planTitle,
} = {}) {
  if (!abstract || typeof abstract !== 'string') {
    throw new Error('abstract is required (the synthesized thesis text)');
  }
  const rec = recommendation || 'keep_researching';
  if (!RECOMMENDATIONS.has(rec)) {
    throw new Error(`recommendation must be one of: ${[...RECOMMENDATIONS].join(', ')}`);
  }
  if (suggestedLens != null && !PLAN_LENSES.has(suggestedLens)) {
    throw new Error(`suggested_lens must be one of: ${[...PLAN_LENSES].join(', ')}`);
  }
  const missingArr = Array.isArray(missing) ? missing.filter((m) => typeof m === 'string') : [];

  const assessment = {
    tractable: rec === 'forge',
    suggested_lens: suggestedLens || null,
    missing: missingArr,
    recommendation: rec,
  };

  // keep_researching → no plan; the missing list is the guidance back to the
  // research loop.
  if (rec !== 'forge') {
    return { assessment, planRef: null };
  }

  const plan = PlanRepository.forge({
    title: (planTitle && String(planTitle)) || deriveTitle(abstract, researchRef),
    goalMd: abstract,
    lens: suggestedLens || undefined,
    frame: {
      summary: abstract,
      source: 'research',
      research_ref: researchRef,
      discarded_lenses: [],
    },
    analysis: { origin: 'research_abstract', research_ref: researchRef, missing: missingArr },
  });
  return { assessment, planRef: plan.planRef };
}

export const _internals = { PLAN_LENSES, RECOMMENDATIONS, deriveTitle };
