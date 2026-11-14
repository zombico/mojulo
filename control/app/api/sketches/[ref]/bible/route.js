/**
 * GET /api/sketches/[ref]/bible[?book=world|characters|feel|practice|foes|atlas|combat|sound|score] — serve a stored gameworld as its bible: the world bible
 * (its map, its land, its civilizations' towns and castles, each level) by default, the character bible with
 * `book=characters` when the world has a character book, the feel book with `book=feel` when it writes a feel (the stick
 * view of its controls to sample, lib/graph/gameworld/feel/book.js; `cast=female` for the other body), the practice room
 * with `book=practice` when its feel fights hand to hand (lib/graph/gameworld/practice-room-page.js: its hero and a foe
 * on its template's stage, its arsenal on the runtime the game ships; the run's own hero and foes once made, stand-ins
 * before; `cast=female` for the stand-in), the cast sheet
 * with `book=foes` when it fields foes or fights something a casting call could cast for (lib/graph/gameworld/
 * foe-cast-html.js: each made foe photographed, lib/mcp/tools/foe-portraits.js, a download included)., the sound book
 * with `book=sound` (lib/graph/gameworld/sound-book.js: the game's sound sheet, each sound a button), the score
 * book with `book=score` (lib/graph/gameworld/score-book.js: its cue sheet, each cue a button). All are drawn
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
 * characters photographed into it when a browser is at hand. An exhibit's catalogue (lib/graph/exhibit/catalogue.js: its
 * aims, its stops in every audience's words, its claims with their sources and the expert's sign-off) is a gallery's book,
 * and any toured or briefed exhibit's with `book=exhibit` (or when it has no other book).
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { isGameworldKind, gameworldOf } from '@/lib/graph/gameworld/gameworld-kind';
import { gameworldBibleHtml, characterBibleHtml, foeCastHtml, castable, castingCall } from '@/lib/graph/gameworld/index';
import { feelBookHtml, BOOK_CASTS } from '@/lib/graph/gameworld/feel/book';
import { combatBookHtml, BOOK_VIEWS } from '@/lib/graph/gameworld/combat/book';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { gameworldAtlasHtml, ATLAS_LOOK_IDS } from '@/lib/graph/gameworld/atlas-html';
import { structureBookHtml } from '@/lib/graph/structure/book-html';
import { occupancyOf } from '@/lib/graph/structure/programs';
import { cityBookHtml } from '@/lib/graph/city/plan/book-html';
import { withSiteEdifices } from '@/lib/graph/city/plan/ref';
import { cachedPage } from '@/lib/sheet-cache';
import { historicGuideHtml } from '@/lib/graph/historic/field-guide';
import { catalogueHtml } from '@/lib/graph/exhibit/catalogue';
import { galleryRooms } from '@/lib/graph/exhibit/gallery';

/** An exhibit's or a gallery's catalogue, read from the store as it stands. */
async function catalogueOf(sketch) {
  const { exhibitLabel } = await import('@/lib/mcp/tools/create-exhibit');
  const get = (r) => SketchRepository.getByRef(r);
  const m = sketch.manifest;
  const rooms = m.kind === 'gallery'
    ? galleryRooms(m, get, { describe: exhibitLabel }).map((r) => ({ ...r, tour: get(r.ref)?.manifest?.tour ?? null, brief: get(r.ref)?.manifest?.curation ?? null }))
    : [{ title: m.tour?.title || sketch.title, label: exhibitLabel(sketch), tour: m.tour ?? null, brief: m.curation ?? null }];
  return catalogueHtml({ title: m.title || sketch.title, intro: m.intro, brief: m.curation ?? null, rooms });
}

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    const sketch = SketchRepository.getByRef(ref);
    if (!sketch) {
      return NextResponse.json({ error: `Sketch '${ref}' not found` }, { status: 404 });
    }
    const download = ['1', 'true'].includes(request.nextUrl.searchParams.get('download'));
    let html, base;
    const askedExhibit = request.nextUrl.searchParams.get('book') === 'exhibit';
    if (sketch.manifest?.kind === 'gallery' || (askedExhibit && (sketch.manifest?.tour || sketch.manifest?.curation))) {
      html = await catalogueOf(sketch);
      base = `${(sketch.title || ref).trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'exhibit'}-catalogue`;
    } else if (occupancyOf(sketch.manifest)) {
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
      if (!['world', 'characters', 'feel', 'practice', 'foes', 'atlas', 'combat', 'sound', 'score'].includes(book)) return NextResponse.json({ error: "book is 'world', 'characters', 'feel', 'practice', 'foes', 'atlas', 'combat', 'sound' or 'score'" }, { status: 400 });
      // the practice room (lib/graph/gameworld/practice-room-page.js): its feel played on the runtime the game ships
      if (book === 'practice') {
        // (which rooms the world has, practice.js: the action room, the platform room, the mount lane; `room` picks one,
        // the first by default)
        const { practiceFor, PRACTICE_ROOMS } = await import('@/lib/graph/gameworld/practice');
        const door = practiceFor(world);
        if (!door.rooms.length) return NextResponse.json({ eligible: false, reason: door.why }, { status: 422 });
        const room = request.nextUrl.searchParams.get('room') ?? door.rooms[0];
        if (!PRACTICE_ROOMS[room]) return NextResponse.json({ error: `room is ${Object.keys(PRACTICE_ROOMS).join(', ')}` }, { status: 400 });
        if (!door.rooms.includes(room)) return NextResponse.json({ eligible: false, reason: `this world has no ${PRACTICE_ROOMS[room].name.replace(/^The /, '').toLowerCase()} (it has ${door.rooms.join(', ')})` }, { status: 422 });
        const cast = request.nextUrl.searchParams.get('cast') ?? 'male';
        if (!['male', 'female'].includes(cast)) return NextResponse.json({ error: 'cast is male or female' }, { status: 400 });
        const { practiceHtml, roomRefs } = await import('@/lib/graph/gameworld/practice-room-page');
        const refs = await roomRefs(world, ref, (r) => !!SketchRepository.getByRef(r));
        html = await cachedPage(`bible:${ref}:${sketch.updatedAt}:practice:${room}:${cast}:${JSON.stringify(refs)}`, async () => (await practiceHtml(world, room, { refs, cast })).html);
        base = `${(sketch.title || world.name || ref).trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'gameworld'}-${room === 'practice' ? 'practice' : room}`;
      // the combat book (lib/graph/gameworld/combat/book.js): the made game's first level's player and foe, measured on
      // its runtime and set in the gym laid from those numbers; `view` its own camera or the other one
      } else if (book === 'combat') {
        const view = request.nextUrl.searchParams.get('view') ?? 'own';
        if (!BOOK_VIEWS.includes(view)) return NextResponse.json({ error: `view is one of ${BOOK_VIEWS.join(', ')}` }, { status: 400 });
        const game = world.made?.game?.ref ? SketchRepository.getByRef(world.made.game.ref) : null;
        const levelRef = game?.manifest?.levels?.[0]?.ref, level = levelRef ? SketchRepository.getByRef(levelRef) : null;
        if (!level) return NextResponse.json({ eligible: false, reason: 'this world is not made yet: design_game runs it, and the combat book plays its first level' }, { status: 422 });
        try {
          html = await cachedPage(`bible:${ref}:${sketch.updatedAt}:combat:${levelRef}:${level.updatedAt}:${view}`, async () => {
            const { payload } = await resolveWorldScene(level);
            const page = combatBookHtml(payload, world, { view });
            if (!page) throw Object.assign(new Error(view === 'other' ? 'its first level has no other camera to see it from (a first person with no body)' : 'its first level\'s player carries no gun (a shooter\'s goal, or arms)'), { ineligible: true });
            return page;
          });
        } catch (err) {
          if (err.ineligible) return NextResponse.json({ eligible: false, reason: err.message }, { status: 422 });
          throw err;
        }
        base = `${(sketch.title || world.name || ref).trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'gameworld'}-combat${view === 'own' ? '' : `-${view}`}`;
      // the sound book (lib/graph/gameworld/sound-book.js): the game's sound sheet read and heard, each sound a button
      } else if (book === 'sound') {
        const { soundBookHtml } = await import('@/lib/graph/gameworld/sound-book');
        html = await cachedPage(`bible:${ref}:${sketch.updatedAt}:sound`, () => soundBookHtml(world));
        base = `${(sketch.title || world.name || ref).trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'gameworld'}-sound`;
      // the score book (lib/graph/gameworld/score-book.js): the game's cue sheet read and heard, each cue a button
      } else if (book === 'score') {
        const { scoreBookHtml } = await import('@/lib/graph/gameworld/score-book');
        html = await cachedPage(`bible:${ref}:${sketch.updatedAt}:score`, () => scoreBookHtml(world, { ref }));
        base = `${(sketch.title || world.name || ref).trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'gameworld'}-score`;
      } else if (book === 'atlas') {
      // the atlas (lib/graph/gameworld/atlas-html.js): the world's levels, trails and ways drawn as a map, in a look
        const look = request.nextUrl.searchParams.get('look') ?? 'painted';
        if (!ATLAS_LOOK_IDS.includes(look)) return NextResponse.json({ error: `look is one of ${ATLAS_LOOK_IDS.join(', ')}` }, { status: 400 });
        html = await cachedPage(`bible:${ref}:${sketch.updatedAt}:atlas:${look}`, () => gameworldAtlasHtml(world, { look }));
        base = `${(sketch.title || world.name || ref).trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'gameworld'}-atlas`;
      } else {
        if (book === 'characters' && !world.characters) {
          return NextResponse.json({ eligible: false, reason: 'this world has no character book (characters: { direction, hero? })' }, { status: 422 });
        }
        if (book === 'feel' && (world.feel === undefined || world.feel === null)) {
          return NextResponse.json({ eligible: false, reason: "this world writes no feel (feel: '<template>' | { pole, … }): design_game's readout suggests one" }, { status: 422 });
        }
        if (book === 'foes' && !castable(world) && !castingCall(world)) {
          return NextResponse.json({ eligible: false, reason: 'this world fields no foe and fights nothing a casting call could cast for (foes: { <id>: { class, … } }, levels.<id>.foes, or an intent that fights)' }, { status: 422 });
        }
        // (each made foe photographed for the cast sheet and the world bible's Foes section, a download included: the
        // photographs are data; none without a browser, each foe its silhouette)
        const { foePortraits } = await import('@/lib/mcp/tools/foe-portraits');
        const shots = (book === 'foes' || book === 'world') && castable(world) ? await foePortraits(world) : { portraits: {}, key: '' };
        const cast = request.nextUrl.searchParams.get('cast') ?? 'male';
        if (book === 'feel' && !BOOK_CASTS.includes(cast)) return NextResponse.json({ error: `cast is one of ${BOOK_CASTS.join(', ')}` }, { status: 400 });
        // (the character book shows the hero the run made and pinned live, through its World; a download carries none)
        const pinned = book === 'characters' && !download ? world.characters?.hero?.looks?.base?.ref : null;
        const heroLive = pinned && SketchRepository.getByRef(pinned) ? { worldSrc: `/api/sketches/${encodeURIComponent(pinned)}/world` } : {};
        html = await cachedPage(`bible:${ref}:${sketch.updatedAt}:${book}${book === 'feel' ? `:${cast}` : ''}${heroLive.worldSrc ? ':live' : ''}${shots.key ? `:${shots.key}` : ''}`, () => (book === 'characters' ? characterBibleHtml(world, { renders: heroLive }) : book === 'feel' ? feelBookHtml(world, { cast }) : book === 'foes' ? foeCastHtml(world, { portraits: shots.portraits }) : gameworldBibleHtml(world, { foePortraits: shots.portraits })));
        base = `${(sketch.title || world.name || ref).trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'gameworld'}${book === 'world' ? '' : `-${book}`}`;
      }
    } else if (sketch.manifest?.tour || sketch.manifest?.curation) {
      html = await catalogueOf(sketch);
      base = `${(sketch.title || ref).trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'exhibit'}-catalogue`;
    } else {
      return NextResponse.json({
        eligible: false,
        reason: `'/bible' serves a gameworld, a building (floorplan, store, restaurant, mall), a city plan, a historic scene, a table game or an exhibit with a tour or a brief (its catalogue) only (this sketch is '${sketch.manifest?.kind}').`,
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
