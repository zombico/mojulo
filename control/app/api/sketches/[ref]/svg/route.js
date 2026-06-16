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
import { renderStoredSketchSvg } from '@/lib/graph/stored-sketch-svg';

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

    const body = await renderStoredSketchSvg(sketch);

    const url = new URL(request.url);
    const disposition = url.searchParams.get('inline') === '1' ? 'inline' : 'attachment';
    const filename = safeFilename(sketch.title, sketch.ref || ref);

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
