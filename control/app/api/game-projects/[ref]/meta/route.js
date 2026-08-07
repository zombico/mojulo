/**
 * GET /api/game-projects/[ref]/meta — the /games/<ref> studio's data feed:
 * the whole view model in one read (charter, members by role with derived
 * statuses, the active rules member, implied members). Pure projection of
 * get_game_project (game-developer.plan.md GP2); the studio renders state and
 * copies prompts, it never mutates.
 */

import { NextResponse } from 'next/server';

import { getGameProjectHandler } from '@/lib/mcp/tools/game-projects';

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    const result = await getGameProjectHandler({ ref });
    return NextResponse.json(result);
  } catch (err) {
    const message = err.message || 'Failed to read game project';
    const status = /not found/i.test(message) ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
