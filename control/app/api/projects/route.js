/**
 * GET /api/projects[?group=worlds|places][&limit=n] — the projects on a rail, last touched first: a gameworld, a city,
 * a building, each { ref, title, kind, group, updatedAt }. A part a project made (a city's segment level, a door's
 * inside) is left to its project's page. Each card reads its own rail (/api/sketches/<ref>/rail), so this stays cheap.
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { PROJECT_GROUPS, PROJECT_KINDS, projectsOf } from '@/lib/graph/rail/groups';

export async function GET(request) {
  try {
    const q = request.nextUrl.searchParams;
    const group = q.get('group');
    if (group && !PROJECT_GROUPS[group]) {
      return NextResponse.json({ error: `group is one of ${Object.keys(PROJECT_GROUPS).join(', ')}` }, { status: 400 });
    }
    const limit = Math.max(1, Math.min(200, Number(q.get('limit')) || 48));
    // parts are read and dropped, so read past the limit before cutting to it
    const rows = SketchRepository.listByKinds({ kinds: group ? PROJECT_GROUPS[group] : PROJECT_KINDS, limit: limit * 8 });
    return NextResponse.json({ projects: projectsOf(rows, { group, limit }) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
