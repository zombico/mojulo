/**
 * GET /api/sketches/[ref] — returns { ref, title, manifest, createdAt }
 * for the page to render.
 */

import { NextResponse } from 'next/server';
import { SketchRepository } from '@/lib/db/repositories/sketches';

export async function GET(_request, { params }) {
  try {
    const { ref } = await params;
    const sketch = SketchRepository.getByRef(ref);
    if (!sketch) {
      return NextResponse.json({ error: `Sketch '${ref}' not found` }, { status: 404 });
    }
    return NextResponse.json(sketch);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to load sketch' },
      { status: 500 },
    );
  }
}
