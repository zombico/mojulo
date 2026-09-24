/**
 * GET /api/sketches/[ref]/world/tile?t=i,j&lod=full|massing|base — one ground tile of a streamed
 * fractal city (world streaming; the page is /world?stream=1).
 *
 * The recipe is regenerated here like every sibling route: the city is planned once (memoized in
 * lib/graph/city/city-tiles.js), cut into square tiles, and the asked tile assembled through the
 * same assembler as the whole city and packed as binary (u32 'MJT1' · u32 header length · JSON
 * header · Float32 positions / colours / uvs). The ETag folds the manifest, the tile, the level of
 * detail and the code version (render-etag.js), so a browser revalidates a held tile to a 304
 * without any geometry work. Auth is the middleware's, as for /world.
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { etagFor, renderCacheKey } from '@/lib/graph/sketch/render-etag';
import { resolveCityInsets } from '@/lib/graph/worlds/city-insets';
import {
  STREAM_LODS, STREAM_TILE, cityRegion, cityStreamRecipe, cityTileBytes, parseTileId, streamStandDown, tileGrid,
} from '@/lib/graph/city/city-tiles';

// Bump when the tile packing or the tile assembly changes inside a release (browsers drop held tiles).
const TILE_CACHE_VERSION = 'v1';

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    const sketch = SketchRepository.getByRef(ref);
    if (!sketch) return NextResponse.json({ error: `Sketch '${ref}' not found` }, { status: 404 });
    if (!sketch.manifest || sketch.manifest.kind !== 'fractal-city') {
      return NextResponse.json({ error: 'World tiles stream fractal-city sketches only' }, { status: 404 });
    }
    const reason = streamStandDown(sketch.manifest);
    if (reason) return NextResponse.json({ error: `This city does not stream: ${reason}` }, { status: 404 });

    const search = request.nextUrl.searchParams;
    const lod = search.get('lod') || 'full';
    if (!STREAM_LODS.includes(lod)) {
      return NextResponse.json({ error: `lod must be one of ${STREAM_LODS.join(', ')}` }, { status: 400 });
    }
    const grid = tileGrid(cityRegion(sketch.manifest), STREAM_TILE);
    const id = parseTileId(grid, search.get('t'));
    if (!id) {
      return NextResponse.json({ error: `t must be a tile id "i,j" on the ${grid.cols}×${grid.rows} grid` }, { status: 400 });
    }

    const etag = etagFor('t', renderCacheKey({ ref, manifest: sketch.manifest, flags: { t: id, lod, tile: STREAM_TILE }, version: TILE_CACHE_VERSION }));
    if (request.headers.get('if-none-match') === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag, 'Cache-Control': 'no-cache' } });
    }

    const recipe = cityStreamRecipe(sketch.manifest, resolveCityInsets(sketch.manifest));
    const bytes = cityTileBytes(recipe, id, { lod });
    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(bytes.length),
        'Cache-Control': 'no-cache',
        ETag: etag,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to build world tile' }, { status: 500 });
  }
}
