/**
 * GET /api/stashes — list stashes for the dashboard inbox.
 *
 * Stashes are created via the MCP `mint_stash` tool (title-at-moment-of-intent
 * belongs in the agent flow per
 * lite-template/integration/app-system/0601/STASH_VIEW_LAYER.md). The dashboard
 * is a view: this route lists; `/api/stashes/[ref]` reads one in full.
 *
 * Query params:
 *   - status=open|archived|all  (default: open)
 *
 * Each row carries item_count + drawer_count so the inbox can show density
 * without a second round-trip.
 */

import { NextResponse } from 'next/server';
import { StashRepository } from '@/lib/db/repositories/stashes';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status') || 'open';
    const filter = statusParam === 'all' ? {} : { status: statusParam };
    const stashes = StashRepository.list(filter);
    return NextResponse.json({
      stashes: stashes.map((s) => ({
        stashRef: s.stashRef,
        title: s.title,
        status: s.status,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        itemCount: StashRepository.countItems(s.stashRef),
        drawerCount: StashRepository.listDrawers(s.stashRef).length,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to list stashes' },
      { status: 500 },
    );
  }
}
