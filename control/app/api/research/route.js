/**
 * GET /api/research — read-only list of research sessions for the drawer.
 *
 * Research books are started / accreted / synthesized exclusively through the
 * Ring 9 MCP tools (driven by a host-agent session). The dashboard is a view:
 * this route lists sessions, /api/research/[ref] reads one full book. No POST —
 * the UI does not write research.
 */

import { NextResponse } from 'next/server';
import { ResearchRepository } from '@/lib/db/repositories/research';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const sessions = ResearchRepository.listSessions(status ? { status } : {});
    return NextResponse.json({
      sessions: sessions.map((s) => ({
        researchRef: s.researchRef,
        title: s.title,
        status: s.status,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to list research sessions' },
      { status: 500 },
    );
  }
}
