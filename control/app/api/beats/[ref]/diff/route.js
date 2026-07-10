/**
 * GET /api/beats/[ref]/diff?a=<rev>&b=<rev> — "what changed" between two
 * revisions of one artifact, for the studio's revision list (B9.3). The same
 * musical diff diff_beats serves the agent; omit `b` to diff against head.
 */

import { NextResponse } from 'next/server';

import { BeatsRevisionRepository } from '@/lib/db/repositories/beats';
import { resolveBeatsAt, BeatsHttpError } from '@/lib/graph/beats/beats-resolve';
import { diffBeatsManifests } from '@/lib/graph/beats/beats-diff';

function manifestAt(ref, head, revParam, name) {
  if (revParam === null || revParam === '') return { manifest: head, rev: null };
  const rev = Number(revParam);
  if (!Number.isInteger(rev) || rev < 1) throw new BeatsHttpError(422, `\`${name}\` must be a positive integer`);
  const revision = BeatsRevisionRepository.get(ref, rev);
  if (!revision || !revision.manifest) throw new BeatsHttpError(404, `No revision ${rev} for '${ref}'`);
  return { manifest: revision.manifest, rev };
}

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    const { manifest: head } = resolveBeatsAt(ref, null);
    const { searchParams } = new URL(request.url);
    const a = manifestAt(ref, head, searchParams.get('a'), 'a');
    const b = manifestAt(ref, head, searchParams.get('b'), 'b');
    const report = diffBeatsManifests(a.manifest, b.manifest);
    return NextResponse.json({ ok: true, ref, revA: a.rev, revB: b.rev, same: report.same, summary: report.summary });
  } catch (err) {
    if (err instanceof BeatsHttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err.message || 'Failed to diff' }, { status: 500 });
  }
}
