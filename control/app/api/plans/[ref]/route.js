/**
 * GET /api/plans/[ref] — full plan for the detail pane.
 *
 * Read-only: does NOT flip the plan's read/unread (`seen`) flag. The inbox
 * read action belongs to the MCP `get_plan` tool (the agent opening a plan),
 * not to a safe GET from the dashboard. The UI surfaces `seen` but doesn't
 * mutate it.
 */

import { NextResponse } from 'next/server';
import { PlanRepository } from '@/lib/db/repositories/plans';

export async function GET(_request, { params }) {
  try {
    const { ref } = await params;
    const plan = PlanRepository.getByRef(ref);
    if (!plan) {
      return NextResponse.json({ error: `Plan '${ref}' not found` }, { status: 404 });
    }
    return NextResponse.json(plan);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to load plan' },
      { status: 500 },
    );
  }
}
