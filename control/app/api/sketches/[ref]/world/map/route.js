/**
 * GET /api/sketches/[ref]/world/map — the inspectable map of a `roadway` world (roads/roadway-map.js):
 * a straight-line diagram of every lane, wall, structure and vehicle at its true station, with the
 * profile, the alignment and a key map on one station axis, and deep links into /world?view=….
 *
 * Regenerated from the recipe like every sibling route, so the map and the world always agree. The
 * ETag folds the manifest and the code version (render-etag.js). Auth is the middleware's.
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { etagFor, renderCacheKey } from '@/lib/graph/sketch/render-etag';
import { planRoadway } from '@/lib/graph/roads/roadway';
import { roadwayMapData, renderRoadwayMap } from '@/lib/graph/roads/roadway-map';

// Bump when the map page's output changes inside a release (browsers drop held pages).
const MAP_CACHE_VERSION = 'v1';

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    const sketch = SketchRepository.getByRef(ref);
    if (!sketch) return NextResponse.json({ error: `Sketch '${ref}' not found` }, { status: 404 });
    if (!sketch.manifest || sketch.manifest.kind !== 'roadway') {
      return NextResponse.json({ error: 'The world map inspects roadway sketches only' }, { status: 404 });
    }
    const etag = etagFor('m', renderCacheKey({ ref, manifest: sketch.manifest, flags: {}, version: MAP_CACHE_VERSION }));
    if (request.headers.get('if-none-match') === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag, 'Cache-Control': 'no-cache' } });
    }
    const title = sketch.title || sketch.manifest.title || 'mojulo roadway';
    const data = roadwayMapData(planRoadway(sketch.manifest), { title });
    const html = renderRoadwayMap(data, { worldHref: `/api/sketches/${encodeURIComponent(ref)}/world` });
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', ETag: etag } });
  } catch (err) {
    console.error('world map failed:', err);
    return NextResponse.json({ error: err?.message || 'world map failed' }, { status: 500 });
  }
}
