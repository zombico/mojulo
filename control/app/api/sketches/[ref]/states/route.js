/**
 * GET /api/sketches/[ref]/states — serve a prepared-states exhibit (exhibit/states.js): one exhibit's versions switched by
 * a slider, a toggle or a carousel, each state its own /world page framed with ?sync=1 so the camera stays where the
 * visitor left it. `?kiosk=1` makes it a kiosk. The offline folder of the same page is export_model({ ref, format: 'html' }).
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { isStatesKind, statesHtml } from '@/lib/graph/exhibit/states';

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    const sketch = SketchRepository.getByRef(ref);
    if (!sketch) return NextResponse.json({ error: `Sketch '${ref}' not found` }, { status: 404 });
    if (!isStatesKind(sketch.manifest?.kind)) {
      return NextResponse.json({ eligible: false, reason: `'/states' serves kind 'exhibit-states' only (this sketch is '${sketch.manifest?.kind}').` }, { status: 422 });
    }
    const m = sketch.manifest;
    const html = statesHtml({ title: m.title || sketch.title, label: m.label, control: m.control, states: m.states, start: m.start, kiosk: m.kiosk },
      { src: (s) => `/api/sketches/${encodeURIComponent(s.ref)}/world` });
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
