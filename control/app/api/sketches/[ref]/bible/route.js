/**
 * GET /api/sketches/[ref]/bible — serve a stored gameworld as its bible: the character bible when the world has a
 * character book, else the world bible. Resolved from the recipe on every read (nothing derived is stored), without
 * the colour plates (those need the optional Chromium worker and are drawn by the game book's door). `?download=1`
 * flips the Content-Disposition.
 *
 * A house (kind 'floorplan') is served as its structure book (lib/graph/structure/book-html.js): the sheets, the
 * schedules and the checks read from the recipe, the row's World framed in its Walk tab. A downloaded book leaves the
 * World out (its frame would point back at this dashboard) and says how to export one.
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { isGameworldKind, gameworldOf } from '@/lib/graph/gameworld/gameworld-kind';
import { gameworldBibleHtml, characterBibleHtml } from '@/lib/graph/gameworld/index';
import { structureBookHtml } from '@/lib/graph/structure/book-html';

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    const sketch = SketchRepository.getByRef(ref);
    if (!sketch) {
      return NextResponse.json({ error: `Sketch '${ref}' not found` }, { status: 404 });
    }
    const download = ['1', 'true'].includes(request.nextUrl.searchParams.get('download'));
    let html, base;
    if (sketch.manifest?.kind === 'floorplan') {
      const lookup = (r) => { const row = SketchRepository.getByRef(r); return row ? { title: row.title } : null; };
      html = structureBookHtml({ ...sketch.manifest, title: sketch.title || sketch.manifest.title }, {
        ref, lookup, world: download ? null : { src: `/api/sketches/${encodeURIComponent(ref)}/world` },
      });
      base = (sketch.title || ref).trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'structure-book';
    } else if (isGameworldKind(sketch.manifest?.kind)) {
      const world = gameworldOf(sketch.manifest);
      html = world.characters ? characterBibleHtml(world) : gameworldBibleHtml(world);
      base = (sketch.title || world.name || ref).trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'gameworld';
    } else {
      return NextResponse.json({
        eligible: false,
        reason: `'/bible' serves kinds 'gameworld' and 'floorplan' only (this sketch is '${sketch.manifest?.kind}').`,
      }, { status: 422 });
    }
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
