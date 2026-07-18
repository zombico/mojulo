/**
 * GET /api/sketches/[ref]/svg — serve a stored sketch as a self-contained
 * SVG file. Rendering lives in @/lib/graph/sketch-svg so the picture-book
 * outcome writer can inline the same SVG into a static book without
 * re-implementing the CSS-var resolution + xmlns injection.
 *
 * Query params:
 *   ?inline=1   — serve inline (Content-Disposition: inline) instead of
 *                 forcing a download. Default is attachment.
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { renderStoredSketchSvg } from '@/lib/graph/sketch/stored-sketch-svg';
import { isBeatsKind } from '@/lib/graph/beats/beats-manifest';

function safeFilename(title, ref) {
  const base = [title, ref].filter(Boolean).join(' ');
  const safe = base
    .trim()
    .replace(/\.svg$/i, '')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '');
  return `${safe || 'sketch'}.svg`;
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
    // instead of falling through to the diagram renderer (which would throw).
    if (isBeatsKind(sketch.manifest.kind)) {
      return NextResponse.json({
        error: `Sketch '${ref}' is a beats artifact (audio) — it has no SVG form`,
        player: `/api/sketches/${encodeURIComponent(ref)}/beats`,
      }, { status: 422 });
    }

    const url = new URL(request.url);
    // ?panel=<id> — sequential-art scaffolds only: serve one panel's crop
    // (the per-panel render payload for the image-render worker).
    const panelId = url.searchParams.get('panel') || undefined;
    const body = await renderStoredSketchSvg(sketch, panelId ? { panelId } : {});

    const disposition = url.searchParams.get('inline') === '1' ? 'inline' : 'attachment';
    const filename = safeFilename(
      panelId ? `${sketch.title || ''} ${panelId}` : sketch.title,
      sketch.ref || ref,
    );

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Content-Disposition': `${disposition}; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to render sketch SVG' },
      { status: 500 },
    );
  }
}
