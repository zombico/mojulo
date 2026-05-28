/**
 * GET /api/plans — read-only list of plans for the dashboard inbox.
 *
 * Plans are forged / revised / compiled / executed exclusively through the
 * Ring 8 MCP tools (driven by a host-agent session). The dashboard is a view:
 * this route lists the inbox, /api/plans/[ref] reads one. There is no POST —
 * the UI does not write plans.
 */

import { NextResponse } from 'next/server';
import { PlanRepository } from '@/lib/db/repositories/plans';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const plans = PlanRepository.list(status ? { status } : {});
    // Summary shape only — the list view doesn't need full manifests.
    const summaries = plans.map((p) => ({
      planRef: p.planRef,
      title: p.title,
      lens: p.lens,
      status: p.status,
      seen: p.seen,
      archived: p.archived,
      archivedAt: p.archivedAt,
      steps: Array.isArray(p.manifest) ? p.manifest.length : 0,
      revisions: p.revisionLog.length,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
    return NextResponse.json({ plans: summaries });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to list plans' },
      { status: 500 },
    );
  }
}
