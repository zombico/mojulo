/**
 * POST /api/plans/from-abstract — the research → plan bridge.
 *
 * This is the documented boundary where a synthesized research abstract is
 * *sent to plan mojulo to be evaluated*. The `synthesize_abstract` MCP tool
 * short-circuits to the same evaluator in-process; this HTTP route is for
 * out-of-process callers — the read-only /research drawer's "Send to plan"
 * button (Phase 2) or an external research app.
 *
 * Body: { research_ref, abstract, suggested_lens?, recommendation?, missing?,
 *         plan_title?, abstract_id? }
 * When recommendation is 'forge', a Draft plan is forged seeded from the
 * abstract. When `abstract_id` is provided, the originating research_abstracts
 * row is backfilled with the plan_ref + assessment.
 *
 * Returns { assessment, plan_ref? }.
 */

import { NextResponse } from 'next/server';
import { evaluateAbstract } from '@/lib/research/evaluate';
import { ResearchRepository } from '@/lib/db/repositories/research';

export async function POST(request) {
  try {
    const body = await request.json();
    const { research_ref, abstract, suggested_lens, recommendation, missing, plan_title, abstract_id } =
      body || {};
    const { assessment, planRef } = evaluateAbstract({
      researchRef: research_ref,
      abstract,
      suggestedLens: suggested_lens,
      recommendation,
      missing,
      planTitle: plan_title,
    });
    if (abstract_id) {
      ResearchRepository.attachAbstractEvaluation(abstract_id, { planRef, assessment });
    }
    return NextResponse.json({ assessment, plan_ref: planRef });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to evaluate abstract' },
      { status: 400 },
    );
  }
}
