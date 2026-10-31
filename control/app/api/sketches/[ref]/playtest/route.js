/**
 * GET /api/sketches/[ref]/playtest[?level=<levelRef>] — playtest a stored game in the play shell (play-shell.js).
 *
 * Any world/level game plays here, whichever shell it ships with: the store lives in memory (nothing is saved),
 * every level is open, the debug drawer shows the store and what each run sent and got back, and `level`
 * launches straight into one level. The big design loop's levels are tested here; the game's own /game page is
 * what a player gets.
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveGame } from '@/lib/graph/game/game-resolve';
import { emitPlayShell } from '@/lib/graph/game/play-shell';

const levelSrc = (ref) => `/api/sketches/${encodeURIComponent(ref)}/world?walk=1&hud=0`;

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    const sketch = SketchRepository.getByRef(ref);
    if (!sketch) return NextResponse.json({ error: `Sketch '${ref}' not found` }, { status: 404 });
    if (!sketch.manifest || sketch.manifest.kind !== 'game') {
      return NextResponse.json({ error: `Sketch '${ref}' is not a game`, hint: 'Games have manifest.kind "game" (create_game, or design_game\'s run).' }, { status: 422 });
    }
    if (['pixelizer', 'tabletop', 'table-rpg'].includes(sketch.manifest.engine)) {
      return NextResponse.json({ error: `'${ref}' is a ${sketch.manifest.engine} game, with no levels to open: it plays at /api/sketches/${ref}/game` }, { status: 422 });
    }
    const level = new URL(request.url).searchParams.get('level');
    let html;
    try {
      const resolved = resolveGame(sketch.manifest, (r) => SketchRepository.getByRef(r), levelSrc);
      html = emitPlayShell(resolved.manifest, resolved.levels, { playtest: true, startLevel: level || null, stingers: resolved.music, frontArt: resolved.frontArt });
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': 'inline', 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to render the playtest' }, { status: 500 });
  }
}
