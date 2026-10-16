/**
 * GET /api/sketches/[ref]/bible[?book=world|characters] — serve a stored gameworld as its bible: the world bible (its
 * map, its land, its civilizations' towns and castles, each level) by default, the character bible with
 * `book=characters` when the world has a character book. Both are drawn from the recipe and kept in memory per
 * revision (lib/sheet-cache.js), never stored. `?download=1` flips the Content-Disposition.
 *
 * A building (a house, kind 'floorplan', or a store, restaurant or mall) is served as its structure book (lib/graph/structure/book-html.js): the sheets, the
 * schedules and the checks read from the recipe, the row's World framed in its Walk tab. A downloaded book leaves the
 * World out (its frame would point back at this dashboard) and says how to export one. A city plan (kind 'city') is
 * served as its plan book (lib/graph/city/plan/book-html.js). A historic scene (kind 'historic') is served as its field guide
 * (lib/graph/historic/field-guide.js): what the solver chose, the record it stands on, and the knob for each.
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { isGameworldKind, gameworldOf } from '@/lib/graph/gameworld/gameworld-kind';
import { gameworldBibleHtml, characterBibleHtml } from '@/lib/graph/gameworld/index';
import { structureBookHtml } from '@/lib/graph/structure/book-html';
import { occupancyOf } from '@/lib/graph/structure/programs';
import { cityBookHtml } from '@/lib/graph/city/plan/book-html';
import { withSiteEdifices } from '@/lib/graph/city/plan/ref';
import { cachedPage } from '@/lib/sheet-cache';
import { historicGuideHtml } from '@/lib/graph/historic/field-guide';

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    const sketch = SketchRepository.getByRef(ref);
    if (!sketch) {
      return NextResponse.json({ error: `Sketch '${ref}' not found` }, { status: 404 });
    }
    const download = ['1', 'true'].includes(request.nextUrl.searchParams.get('download'));
    let html, base;
    if (occupancyOf(sketch.manifest)) {
      const lookup = (r) => { const row = SketchRepository.getByRef(r); return row ? { title: row.title } : null; };
      html = structureBookHtml({ ...sketch.manifest, title: sketch.title || sketch.manifest.title }, {
        ref, lookup, world: download ? null : { src: `/api/sketches/${encodeURIComponent(ref)}/world` },
      });
      base = (sketch.title || ref).trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'structure-book';
    } else if (sketch.manifest?.kind === 'city') {
      html = cityBookHtml(withSiteEdifices({ ...sketch.manifest, title: sketch.title || sketch.manifest.title }, (r) => SketchRepository.getByRef(r)?.manifest), {
        ref, world: download ? null : { src: `/api/sketches/${encodeURIComponent(ref)}/world` },
      });
      base = (sketch.title || ref).trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'city-plan';
    } else if (sketch.manifest?.kind === 'historic') {
      html = await cachedPage(`guide:${ref}:${sketch.updatedAt}`, () => historicGuideHtml({ ...sketch.manifest, title: sketch.title || sketch.manifest.title }, { ref }));
      base = `${(sketch.title || ref).trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'historic'}-field-guide`;
    } else if (isGameworldKind(sketch.manifest?.kind)) {
      const world = gameworldOf(sketch.manifest);
      const book = request.nextUrl.searchParams.get('book') ?? 'world';
      if (book !== 'world' && book !== 'characters') return NextResponse.json({ error: "book is 'world' or 'characters'" }, { status: 400 });
      if (book === 'characters' && !world.characters) {
        return NextResponse.json({ eligible: false, reason: 'this world has no character book (characters: { direction, hero? })' }, { status: 422 });
      }
      html = await cachedPage(`bible:${ref}:${sketch.updatedAt}:${book}`, () => (book === 'characters' ? characterBibleHtml(world) : gameworldBibleHtml(world)));
      base = `${(sketch.title || world.name || ref).trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'gameworld'}${book === 'characters' ? '-characters' : ''}`;
    } else {
      return NextResponse.json({
        eligible: false,
        reason: `'/bible' serves a gameworld, a building (floorplan, store, restaurant, mall), a city plan or a historic scene only (this sketch is '${sketch.manifest?.kind}').`,
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
