/**
 * GET /api/sketches/[ref]/gallery — serve a stored gallery (exhibit/gallery.js): its lobby, and each room its exhibit's
 * own /world page framed (?gallery=1, and &kiosk=1 as a kiosk). The rooms are read from the store as they are now, so
 * an improved exhibit is improved in every gallery it stands in. `?kiosk=1` makes any gallery a kiosk. The offline
 * folder of the same page is export_model({ ref, format: 'html' }).
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { galleryHtml, galleryRooms, isGalleryKind } from '@/lib/graph/exhibit/gallery';
import { exhibitLabel } from '@/lib/mcp/tools/create-exhibit';

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    const sketch = SketchRepository.getByRef(ref);
    if (!sketch) return NextResponse.json({ error: `Sketch '${ref}' not found` }, { status: 404 });
    if (!isGalleryKind(sketch.manifest?.kind)) {
      return NextResponse.json({
        eligible: false,
        reason: `'/gallery' serves kind 'gallery' only (this sketch is '${sketch.manifest?.kind}'); a single exhibit is its /world page.`,
      }, { status: 422 });
    }
    const getSketch = (r) => SketchRepository.getByRef(r);
    const rooms = galleryRooms(sketch.manifest, getSketch, { describe: exhibitLabel });
    const html = galleryHtml({ title: sketch.manifest.title || sketch.title, intro: sketch.manifest.intro, rooms, kiosk: sketch.manifest.kiosk },
      { src: (room) => `/api/sketches/${encodeURIComponent(room.ref)}/${room.states ? 'states' : 'world'}` });
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
