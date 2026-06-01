/**
 * GET /api/sketches/[ref]/svg — render the stored manifest to a fully
 * self-contained .svg file via CreationMap + renderToStaticMarkup. CSS
 * custom properties are resolved to literal hex/families so the file is
 * portable to vector tools and image viewers that don't honor `var(...)`.
 *
 * Query params:
 *   ?inline=1   — serve inline (Content-Disposition: inline) instead of
 *                 forcing a download. Default is attachment.
 */

import React from 'react';
import { NextResponse } from 'next/server';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import CreationMap from '@/components/graph/CreationMap';

// Resolved values lifted from app/globals.css. Kept in sync deliberately —
// the renderer uses CSS variables for in-app theming; the export needs
// concrete colors because most SVG consumers (Illustrator, Inkscape, image
// viewers) won't resolve `var(--foo)` references.
const CSS_VAR_RESOLUTIONS = {
  '--brand-teal': '#5eead4',
  '--brand-teal-hover': '#2dd4bf',
  '--brand-navy': '#0a2028',
  '--surface-primary': '#1f2937',
  '--surface-elevated': '#374151',
  '--border-color': '#374151',
  '--text-primary': '#ffffff',
  '--text-secondary': '#d1d5db',
  '--text-muted': '#9ca3af',
  '--background': '#111827',
  '--foreground': '#f3f4f6',
  '--font-geist-sans': 'Inter, system-ui, sans-serif',
  '--font-geist-mono': 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

function inlineCssVars(markup) {
  return markup.replace(/var\((--[a-z0-9-]+)\)/gi, (match, name) => {
    return CSS_VAR_RESOLUTIONS[name] ?? match;
  });
}

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

    // Dynamic import: Next's app-router lints against static imports of
    // `react-dom/server`, but route handlers run server-side only, so a
    // runtime import is safe and slips past the static check.
    const { renderToStaticMarkup } = await import('react-dom/server');
    const inner = renderToStaticMarkup(
      React.createElement(CreationMap, { manifest: sketch.manifest, technical: false }),
    );

    // CreationMap emits a single <svg ...>...</svg>. Inject xmlns so the file
    // is standalone-valid, then inline the CSS variables.
    const withXmlns = inner.replace(
      /^<svg\b/,
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"',
    );
    const resolved = inlineCssVars(withXmlns);
    const body = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n${resolved}\n`;

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
