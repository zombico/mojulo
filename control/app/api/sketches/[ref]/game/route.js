/**
 * GET /api/sketches/[ref]/game — serve a stored game manifest as its playable shell
 * (the game sibling of /world, /scene, /beats). game-metacontext.plan.md.
 *
 * The stored row is a pure RECIPE (a store schema + promoted level refs); the shell HTML +
 * store kernel are regenerated per request, and each level's contract is resolved on demand
 * from its own level sketch (no contracts baked into the game row — recipes, not renders).
 * Levels are hosted in an iframe pointing at their live /world page; the shell owns the store
 * and speaks the postMessage contract. Play data stays in the browser — nothing is written back.
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveGame } from '@/lib/graph/game/game-resolve';
import { emitGameShell } from '@/lib/graph/game/game-shell';

const levelSrc = (ref) => `/api/sketches/${encodeURIComponent(ref)}/world?walk=1`;

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    const sketch = SketchRepository.getByRef(ref);
    if (!sketch) {
      return NextResponse.json({ error: `Sketch '${ref}' not found` }, { status: 404 });
    }
    if (!sketch.manifest || sketch.manifest.kind !== 'game') {
      return NextResponse.json({
        error: `Sketch '${ref}' is not a game`,
        hint: 'Games have manifest.kind "game" (create_game).',
      }, { status: 422 });
    }
    let resolved;
    try {
      resolved = resolveGame(sketch.manifest, (r) => SketchRepository.getByRef(r), levelSrc);
    } catch (err) {
      // A level was deleted or its contract drifted after the game was minted — teach, don't 500.
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    const html = emitGameShell(resolved.manifest, resolved.levels);
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': 'inline',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to render game shell' },
      { status: 500 },
    );
  }
}
