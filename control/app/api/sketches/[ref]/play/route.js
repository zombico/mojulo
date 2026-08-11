/**
 * GET /api/sketches/[ref]/play — serve a stored motion-comic as its
 * self-contained click-gated player (motion-comic.plan.md). The page inlines
 * every source face as a data URI, so the SAME emitter output is both the
 * live iframe view and the one-file export — `?download=1` just flips the
 * Content-Disposition. Deep links (`?s=&e=`) pass straight through to the
 * player's fold.
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { isMotionComicKind } from '@/lib/graph/motion-comic/motion-comic-manifest';
import { resolveMotionComicAssets } from '@/lib/graph/motion-comic/motion-comic-resolve';
import { renderMotionComicHtml } from '@/lib/graph/motion-comic/motion-comic-player';

function htmlFilename(sketch, ref) {
  const base = (sketch.title || sketch.manifest?.title || ref || 'motion-comic')
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'motion-comic'}.html`;
}

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    const sketch = SketchRepository.getByRef(ref);
    if (!sketch) {
      return NextResponse.json({ error: `Sketch '${ref}' not found` }, { status: 404 });
    }
    if (!isMotionComicKind(sketch.manifest?.kind)) {
      return NextResponse.json({
        eligible: false,
        reason: `'/play' serves kind 'motion-comic' only (this sketch is '${sketch.manifest?.kind}').`,
      }, { status: 422 });
    }

    const assets = await resolveMotionComicAssets(sketch.manifest, (r) => SketchRepository.getByRef(r));
    const html = renderMotionComicHtml(sketch.manifest, { assets, docTitle: sketch.title });

    const download = ['1', 'true'].includes(request.nextUrl.searchParams.get('download'));
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': download ? `attachment; filename="${htmlFilename(sketch, ref)}"` : 'inline',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
