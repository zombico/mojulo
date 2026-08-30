/**
 * GET /api/sketches/[ref]/turntable.png — the gallery card's turntable strip:
 * one PNG holding 16 azimuth frames of the artifact, side by side, which the
 * card steps through with CSS `steps(16)`.
 *
 * Sibling to /png (one still) and /world (the live, navigable scene). This is
 * the middle rung the grid needs: a card cannot afford a WebGL context, and a
 * single still cannot show that the thing has a back.
 *
 * Baked lazily and cached on disk by manifest hash, so the strip is minted the
 * first time someone actually asks a card to turn and is a cache hit forever
 * after. Flat kinds (diagrams, scaffolds) 422 with the reason rather than
 * serving a still that pretends to rotate.
 *
 * Query params:
 *   ?cached=1 — serve ONLY an already-baked strip; 404 instead of baking. This is
 *               what lets a card ask "is there a picture of this lying around?"
 *               without committing the host to a render. A whole shelf can ask at
 *               once, which is exactly the case that must never start a bake.
 */

import { existsSync } from 'node:fs';

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { bakeTurntableStrip, stripCacheFile, stripCacheKey } from '@/lib/graph/sketch/turntable-bake';
import { isTurnable } from '@/lib/graph/sketch/turntable-strip';

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    const sketch = SketchRepository.getByRef(ref);
    if (!sketch) {
      return NextResponse.json({ error: `Sketch '${ref}' not found` }, { status: 404 });
    }
    if (!sketch.manifest) {
      return NextResponse.json({ error: `Sketch '${ref}' has no manifest` }, { status: 400 });
    }
    if (!isTurnable(sketch.manifest)) {
      return NextResponse.json({
        error: `Sketch '${ref}' (kind '${sketch.manifest.kind}') has no orbit — turntable strips are baked for the 3D kinds.`,
        still: `/api/sketches/${encodeURIComponent(ref)}/png?inline=1&scale=1`,
      }, { status: 422 });
    }

    // The cache key is a hash of the recipe plus the bake settings, so it is
    // exactly the right ETag: edit the manifest and the strip re-bakes, leave it
    // alone and the browser never re-downloads a few hundred KB per card.
    // ?cached=1: answer from disk or not at all. Cards use this to pick up a
    // strip the mint-time warm already baked, without a cold shelf turning into
    // one bake per card.
    if (request.nextUrl.searchParams.get('cached') === '1' && !existsSync(stripCacheFile(sketch))) {
      return NextResponse.json(
        { error: `No turntable strip baked for '${ref}' yet`, bake: `/api/sketches/${encodeURIComponent(ref)}/turntable.png` },
        { status: 404 },
      );
    }

    const etag = `"tt-${stripCacheKey(sketch)}"`;
    if (request.headers.get('if-none-match') === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }

    const png = await bakeTurntableStrip(sketch);
    return new Response(png, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'inline',
        ETag: etag,
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    });
  } catch (err) {
    const status = err.code === 'NOT_TURNABLE' ? 422 : 500;
    return NextResponse.json(
      { error: err.message || 'Failed to bake turntable strip' },
      { status },
    );
  }
}
