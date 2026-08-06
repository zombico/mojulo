/**
 * GET /api/game-projects — the /maker/games gallery feed: pure projection of
 * the same rows list_game_projects serves the agent (game-developer.plan.md
 * GP2). The dashboard renders state; authoring stays with the host agent.
 */

import { NextResponse } from 'next/server';

import { listGameProjectsHandler } from '@/lib/mcp/tools/game-projects';

export async function GET(request) {
  try {
    const status = new URL(request.url).searchParams.get('status') || undefined;
    const result = await listGameProjectsHandler(status ? { status } : {});
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to list game projects' },
      { status: 500 },
    );
  }
}
