/**
 * GET /api/sketches/[ref]/pattern.svg — the sewing pattern of a figure's cut-and-sewn
 * garment(s), at true scale (1 cm = 1 cm at 100 %). The 2D face of the same recipe the
 * figure wears in 3D: pieces, seam allowance, grain, notches at the seam ends, a datum grid.
 *
 * Query params:
 *   ?inline=1   — serve inline instead of as an attachment.
 *   ?page=<cm>  — page width in cm (default 84, A0 portrait).
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { figurePatternSheetSvg } from '@/lib/graph/polygonizer/pattern-sheet';

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    const sketch = SketchRepository.getByRef(ref);
    if (!sketch) return NextResponse.json({ error: `Sketch '${ref}' not found` }, { status: 404 });
    if (!sketch.manifest) return NextResponse.json({ error: `Sketch '${ref}' has no manifest` }, { status: 400 });
    if (sketch.manifest.kind !== 'figure') {
      return NextResponse.json({ error: `Sketch '${ref}' is a '${sketch.manifest.kind}' — a pattern sheet belongs to a figure wearing a fit:'pattern' garment` }, { status: 422 });
    }
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page'));
    const body = figurePatternSheetSvg({ ...sketch.manifest, title: sketch.title || sketch.manifest.title }, Number.isFinite(page) && page > 20 ? { page_width_cm: page } : {});
    if (!body) {
      return NextResponse.json({ error: `Sketch '${ref}' wears no fit:'pattern' garment — nothing to lay flat` }, { status: 422 });
    }
    const disposition = url.searchParams.get('inline') === '1' ? 'inline' : 'attachment';
    const safe = `${(sketch.title || 'figure').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'figure'}-pattern.svg`;
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Content-Disposition': `${disposition}; filename="${safe}"`, 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'pattern sheet failed' }, { status: 500 });
  }
}
