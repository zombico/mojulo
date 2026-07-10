/**
 * GET /api/beats/[ref]/annotations — read a beats artifact's annotations
 * (open first) for the studio panel and player markers (B9.1).
 *
 * Read-only by design: annotation WRITES stay on the MCP surface — the host
 * agent (or the operator through it) marks via the `annotate_beats` tool, and
 * resolves marks atomically with the fixing edit via `update_beats
 * resolveAnnotations`. The dashboard renders state; it does not author.
 */

import { NextResponse } from 'next/server';

import { BeatsAnnotationRepository } from '@/lib/db/repositories/beats';
import { resolveBeatsAt, BeatsHttpError } from '@/lib/graph/beats/beats-resolve';

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    resolveBeatsAt(ref, null);
    return NextResponse.json({ ok: true, ref, annotations: BeatsAnnotationRepository.list(ref) });
  } catch (err) {
    if (err instanceof BeatsHttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err.message || 'Failed to read annotations' }, { status: 500 });
  }
}
