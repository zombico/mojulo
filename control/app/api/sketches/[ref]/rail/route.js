/**
 * GET /api/sketches/[ref]/rail — a recipe's rail as JSON (lib/graph/rail): its outcomes and each concern's state, its
 * parts and whether each is fresh, the pages it is looked at in, and the files it has been exported to (its outcome
 * folder). Read from the recipe, the store and the folder on every call; nothing is stored. A recipe on no rail answers
 * 422.
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { readRail } from '@/lib/graph/rail/index';
import { scanOneOutcome } from '@/lib/render-bay/outputs-scan';

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    const sketch = SketchRepository.getByRef(ref);
    if (!sketch) return NextResponse.json({ error: `Sketch '${ref}' not found` }, { status: 404 });
    const row = (r) => {
      const s = SketchRepository.getByRef(r);
      return s ? { kind: s.manifest?.kind ?? s.kind ?? null, manifest: s.manifest } : null;
    };
    const rail = readRail(sketch.manifest, { ref, row });
    if (!rail) {
      return NextResponse.json({ eligible: false, reason: `'${sketch.manifest?.kind}' is on no rail` }, { status: 422 });
    }
    // what it has been taken out as: each file in its outcome folder (sidecars are the files' receipts, not exits)
    const outcome = await scanOneOutcome(ref);
    const files = outcome.files.filter((f) => !f.sidecar).map((f) => ({ name: f.name, bytes: f.bytes, href: `${outcome.url}${encodeURIComponent(f.name)}` }));
    return NextResponse.json({ ref, title: sketch.title || null, updatedAt: sketch.updatedAt ?? null, ...rail, files }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
