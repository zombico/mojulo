/**
 * GET /api/sketches/[ref]/revisions — the solid's revision history
 * (continuous-guardrails.plan.md G5): `{ ref, head: <live manifest>, revisions: [{ rev, note,
 * createdAt }] }` newest-first; `?rev=N` returns that one archived manifest in full.
 * The sketches row is HEAD; revisions are what update_sketch overwrote.
 */

import { NextResponse } from 'next/server';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { SketchRevisionRepository } from '@/lib/db/repositories/sketch-revisions';

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    const sketch = SketchRepository.getByRef(ref);
    if (!sketch) return NextResponse.json({ error: `Sketch '${ref}' not found` }, { status: 404 });
    const revParam = new URL(request.url).searchParams.get('rev');
    if (revParam != null) {
      const rev = Number.parseInt(revParam, 10);
      const one = Number.isInteger(rev) && rev > 0 ? SketchRevisionRepository.get(ref, rev) : null;
      if (!one) return NextResponse.json({ error: `Sketch '${ref}' has no revision ${revParam}` }, { status: 404 });
      return NextResponse.json({ ref, ...one });
    }
    return NextResponse.json({ ref, head: sketch.manifest, revisions: SketchRevisionRepository.list(ref) });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to load revisions' }, { status: 500 });
  }
}
