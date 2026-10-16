/**
 * GET /api/sketches/[ref]/sheet/[id] — one of the pages a recipe draws (lib/graph/sheets/registry.js recipeSheets): a
 * gameworld's own atlas (its land, flora, structures, blocks, fortified town, castle, technology, in its kit), a stage's
 * art board or landform board, a floormap's board, a world's UI board. Drawn from the recipe and kept in memory per
 * revision; never stored. A sheet the recipe does not draw answers 404. `?download=1` flips the Content-Disposition.
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { recipeSheets } from '@/lib/graph/sheets/registry';
import { cachedPage } from '@/lib/sheet-cache';

export async function GET(request, { params }) {
  try {
    const { ref, id } = await params;
    const sketch = SketchRepository.getByRef(ref);
    if (!sketch) return NextResponse.json({ error: `Sketch '${ref}' not found` }, { status: 404 });
    const sheet = recipeSheets(sketch.manifest).find((s) => s.id === id);
    if (!sheet) {
      const own = recipeSheets(sketch.manifest).map((s) => s.id);
      return NextResponse.json({ error: `'${ref}' draws no '${id}' sheet${own.length ? ` (it draws ${own.join(', ')})` : ''}` }, { status: 404 });
    }
    const html = await cachedPage(`sheet:${ref}:${sketch.updatedAt}:${id}`, () => sheet.build());
    const download = ['1', 'true'].includes(request.nextUrl.searchParams.get('download'));
    const base = `${(sketch.title || ref).trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'sheet'}-${id}`;
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': download ? `attachment; filename="${base}.html"` : 'inline',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
