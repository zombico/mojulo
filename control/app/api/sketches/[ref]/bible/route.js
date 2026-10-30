/**
 * GET /api/sketches/[ref]/bible[?book=world|characters|feel|foes] — serve a stored gameworld as its bible: the world bible
 * (its map, its land, its civilizations' towns and castles, each level) by default, the character bible with
 * `book=characters` when the world has a character book, the feel book with `book=feel` when it writes a feel (the stick
 * view of its controls to sample, lib/graph/gameworld/feel/book.js; `cast=female` for the other body), the cast sheet
 * with `book=foes` when it fields foes or fights something a casting call could cast for (lib/graph/gameworld/
 * foe-cast-html.js: each made foe's figure its sketch's PNG, none in a download). All are drawn
 * from the recipe and kept in memory per revision (lib/sheet-cache.js), never stored. `?download=1` flips the
 * Content-Disposition.
 *
 * A building (a house, kind 'floorplan', or a store, restaurant or mall) is served as its structure book (lib/graph/structure/book-html.js): the sheets, the
 * schedules and the checks read from the recipe, the row's World framed in its Walk tab. A downloaded book leaves the
 * World out (its frame would point back at this dashboard) and says how to export one. A city plan (kind 'city') is
 * served as its plan book (lib/graph/city/plan/book-html.js). A historic scene (kind 'historic') is served as its field guide
 * (lib/graph/historic/field-guide.js): what the solver chose, the record it stands on, and the knob for each. A table game
 * (a game row, engine 'table-rpg') is served as its game book (lib/graph/table-rpg/table-rpg-book.js), in its own style or
 * `?style=<preset>`, the whole book or `?parts=party` (its characters' sheets alone; parts a comma list), its party's
 * characters photographed into it when a browser is at hand.
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { isGameworldKind, gameworldOf } from '@/lib/graph/gameworld/gameworld-kind';
import { gameworldBibleHtml, characterBibleHtml, foeCastHtml, castable, castingCall } from '@/lib/graph/gameworld/index';
import { feelBookHtml, BOOK_CASTS } from '@/lib/graph/gameworld/feel/book';
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
    } else if (sketch.manifest?.kind === 'game' && sketch.manifest.engine === 'table-rpg') {
      const { tableRpgBookOf, tableRpgPaper } = await import('@/lib/graph/table-rpg/table-rpg-manifest');
      const { tableRpgPortraits } = await import('@/lib/mcp/tools/table-rpg-portraits');
      const parts = request.nextUrl.searchParams.get('parts'), style = request.nextUrl.searchParams.get('style');
      try {
        // the party's and the cast's characters photographed on the book's paper (kept per character revision; none
        // without a browser)
        const { portraits, foes: foePortraits, items: itemPortraits } = await tableRpgPortraits(sketch.manifest, { paper: tableRpgPaper(sketch.manifest, style ? { style } : {}) });
        html = tableRpgBookOf(sketch.manifest, { title: sketch.title, portraits, foePortraits, itemPortraits, ...(parts ? { parts: parts.split(',') } : {}), ...(style ? { style } : {}) }).html;
      } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      base = `${(sketch.title || ref).trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'table-game'}${parts ? `-${parts.replace(/,/g, '-')}` : '-book'}`;
    } else if (isGameworldKind(sketch.manifest?.kind)) {
      const world = gameworldOf(sketch.manifest);
      const book = request.nextUrl.searchParams.get('book') ?? 'world';
      if (!['world', 'characters', 'feel', 'foes'].includes(book)) return NextResponse.json({ error: "book is 'world', 'characters', 'feel' or 'foes'" }, { status: 400 });
      if (book === 'characters' && !world.characters) {
        return NextResponse.json({ eligible: false, reason: 'this world has no character book (characters: { direction, hero? })' }, { status: 422 });
      }
      if (book === 'feel' && (world.feel === undefined || world.feel === null)) {
        return NextResponse.json({ eligible: false, reason: "this world writes no feel (feel: '<template>' | { pole, … }): design_game's readout suggests one" }, { status: 422 });
      }
      if (book === 'foes' && !castable(world) && !castingCall(world)) {
        return NextResponse.json({ eligible: false, reason: 'this world fields no foe and fights nothing a casting call could cast for (foes: { <id>: { class, … } }, levels.<id>.foes, or an intent that fights)' }, { status: 422 });
      }
      // (a made foe's figure, by its sketch's PNG while served; a download carries none, its page points back here)
      const portrait = (r) => (!download && SketchRepository.getByRef(r) ? `/api/sketches/${encodeURIComponent(r)}/png?inline=1` : null);
      const cast = request.nextUrl.searchParams.get('cast') ?? 'male';
      if (book === 'feel' && !BOOK_CASTS.includes(cast)) return NextResponse.json({ error: `cast is one of ${BOOK_CASTS.join(', ')}` }, { status: 400 });
      html = await cachedPage(`bible:${ref}:${sketch.updatedAt}:${book}${book === 'feel' ? `:${cast}` : ''}${book === 'foes' && download ? ':download' : ''}`, () => (book === 'characters' ? characterBibleHtml(world) : book === 'feel' ? feelBookHtml(world, { cast }) : book === 'foes' ? foeCastHtml(world, { portrait }) : gameworldBibleHtml(world)));
      base = `${(sketch.title || world.name || ref).trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'gameworld'}${book === 'world' ? '' : `-${book}`}`;
    } else {
      return NextResponse.json({
        eligible: false,
        reason: `'/bible' serves a gameworld, a building (floorplan, store, restaurant, mall), a city plan, a historic scene or a table game only (this sketch is '${sketch.manifest?.kind}').`,
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
