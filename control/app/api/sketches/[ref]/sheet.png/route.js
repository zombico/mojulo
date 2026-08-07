/**
 * GET /api/sketches/[ref]/sheet.png — serve the latest BOUND character-sheet
 * render for a `character-sheet` sketch (the externally-generated PNG
 * snapshotted by `bind_character_sheet`). This is the conditioning
 * reference render packets point at via `boundSheet.url`; unlike /svg and
 * /png (deterministic derived renders of the manifest), this serves an
 * externally-authored artifact and 404s until one is bound.
 *
 * Query params:
 *   ?n=<int>  — serve a specific binding instead of the latest.
 */

import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { latestBoundSheet, sheetDir } from '@/lib/graph/image-outcomes/sheet-store';
import { KIND_CHARACTER_SHEET } from '@/lib/graph/image-outcomes/manifest';

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    const sketch = SketchRepository.getByRef(ref);
    if (!sketch) {
      return NextResponse.json({ error: `Sketch '${ref}' not found` }, { status: 404 });
    }
    if (sketch.manifest?.kind !== KIND_CHARACTER_SHEET) {
      return NextResponse.json(
        { error: `Sketch '${ref}' is not a character-sheet — bound sheet renders only exist for that kind` },
        { status: 422 },
      );
    }

    const url = new URL(request.url);
    const rawN = url.searchParams.get('n');
    let file;
    if (rawN != null) {
      const n = Number.parseInt(rawN, 10);
      const candidate = Number.isInteger(n) && n > 0 ? path.join(sheetDir(ref), `sheet-${n}.png`) : null;
      file = candidate && existsSync(candidate) ? candidate : null;
    } else {
      file = latestBoundSheet(ref)?.path ?? null;
    }
    if (!file) {
      return NextResponse.json(
        {
          error: `No sheet render bound to '${ref}' yet — generate it (get_image_render_packet) and submit via bind_character_sheet`,
          scaffold: `/api/sketches/${encodeURIComponent(ref)}/png`,
        },
        { status: 404 },
      );
    }

    const png = await fs.readFile(file);
    return new Response(png, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'inline',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to serve bound character sheet' },
      { status: 500 },
    );
  }
}
