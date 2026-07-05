/**
 * GET /api/sketches/[ref]/png — serve a stored sketch as a rasterized PNG.
 *
 * Rendering lives in @/lib/graph/sketch-png, which dispatches on the sketch's
 * renderer mode: scene kinds (cities / hubs / turntables / rooms) are baked from
 * the live CSS-3D HTML by headless Chromium and disk-cached; SVG/diagram kinds are
 * rasterized from their self-contained SVG with sharp. The gallery uses this as a
 * scene preview (scenes render hard live) and as the "Download PNG" target.
 *
 * Query params:
 *   ?inline=1   — serve inline (Content-Disposition: inline) instead of forcing a
 *                 download. Default is attachment.
 *   ?scale=N    — pixel density / supersample factor (default 2; clamped 1–4).
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { rasterizeSketchToPng } from '@/lib/graph/sketch/sketch-png';
import { isBeatsKind } from '@/lib/graph/beats/beats-manifest';

function safeFilename(title, ref) {
  const base = [title, ref].filter(Boolean).join(' ');
  const safe = base
    .trim()
    .replace(/\.png$/i, '')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '');
  return `${safe || 'sketch'}.png`;
}

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
    // Beats artifacts are audio-only — no still form. Point at the live player
    // instead of falling through to the diagram rasterizer (which would throw).
    if (isBeatsKind(sketch.manifest.kind)) {
      return NextResponse.json({
        error: `Sketch '${ref}' is a beats artifact (audio) — it has no PNG form`,
        player: `/api/sketches/${encodeURIComponent(ref)}/beats`,
      }, { status: 422 });
    }

    const url = new URL(request.url);
    const rawScale = Number.parseFloat(url.searchParams.get('scale'));
    const scale = Number.isFinite(rawScale) ? Math.min(4, Math.max(1, rawScale)) : 2;

    const png = await rasterizeSketchToPng(sketch, { scale });

    const disposition = url.searchParams.get('inline') === '1' ? 'inline' : 'attachment';
    const filename = safeFilename(sketch.title, sketch.ref || ref);

    return new Response(png, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `${disposition}; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const status = err.code === 'SCENE_INELIGIBLE' ? 422 : 500;
    return NextResponse.json(
      { error: err.message || 'Failed to render sketch PNG' },
      { status },
    );
  }
}
