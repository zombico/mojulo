/**
 * GET /api/beats/[ref]/meta — the studio page's data feed (B9.2): head facts,
 * the revision index, and annotations in one read. Pure projection of the same
 * rows get_beats serves the agent; the dashboard renders state, the host agent
 * authors (copy-revision-prompt is the bridge between them).
 */

import { NextResponse } from 'next/server';

import { BeatsAnnotationRepository, BeatsRevisionRepository } from '@/lib/db/repositories/beats';
import { resolveBeatsAt, BeatsHttpError } from '@/lib/graph/beats/beats-resolve';

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    const { sketch, manifest } = resolveBeatsAt(ref, null);
    const revisions = BeatsRevisionRepository.list(ref);
    return NextResponse.json({
      ok: true,
      ref,
      title: sketch.title,
      kind: manifest.kind,
      bpm: manifest.bpm ?? null,
      swing: manifest.swing ?? null,
      seed: manifest.seed ?? null,
      steps: manifest.steps ?? null,
      cues: manifest.cues ? Object.keys(manifest.cues) : null,
      headRev: revisions.length ? revisions[0].rev : null,
      revisions,
      annotations: BeatsAnnotationRepository.list(ref),
    });
  } catch (err) {
    if (err instanceof BeatsHttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err.message || 'Failed to read beats meta' }, { status: 500 });
  }
}
