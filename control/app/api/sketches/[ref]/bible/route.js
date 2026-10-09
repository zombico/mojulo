/**
 * GET /api/sketches/[ref]/bible — serve a stored gameworld as its bible: the character bible when the world has a
 * character book, else the world bible. Resolved from the recipe on every read (nothing derived is stored), without
 * the colour plates (those need the optional Chromium worker and are drawn by the game book's door). `?download=1`
 * flips the Content-Disposition.
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { isGameworldKind, gameworldOf } from '@/lib/graph/gameworld/gameworld-kind';
import { gameworldBibleHtml, characterBibleHtml } from '@/lib/graph/gameworld/index';

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    const sketch = SketchRepository.getByRef(ref);
    if (!sketch) {
      return NextResponse.json({ error: `Sketch '${ref}' not found` }, { status: 404 });
    }
    if (!isGameworldKind(sketch.manifest?.kind)) {
      return NextResponse.json({
        eligible: false,
        reason: `'/bible' serves kind 'gameworld' only (this sketch is '${sketch.manifest?.kind}').`,
      }, { status: 422 });
    }
    const world = gameworldOf(sketch.manifest);
    const html = world.characters ? characterBibleHtml(world) : gameworldBibleHtml(world);
    const download = ['1', 'true'].includes(request.nextUrl.searchParams.get('download'));
    const base = (sketch.title || world.name || ref).trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'gameworld';
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': download ? `attachment; filename="${base}.html"` : 'inline',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
