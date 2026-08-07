/**
 * GET /api/sketches/[ref]/skin.png — serve the latest SKINNED render for a
 * `manji-tree` polygomer (the deterministic render that WEARS a painted skin,
 * produced by `skin_polygomer`). Unlike /svg and /png?control=1 (deterministic
 * renders of the recipe), this serves the skin-projected artifact and 404s
 * until one is bound.
 *
 * Query params:
 *   ?n=<int>  — serve a specific binding instead of the latest.
 */

import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { latestSkin, skinDir } from '@/lib/graph/polygonizer/skin-store';

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    const sketch = SketchRepository.getByRef(ref);
    if (!sketch) {
      return NextResponse.json({ error: `Sketch '${ref}' not found` }, { status: 404 });
    }
    if (!['manji-tree', 'figure', 'workbench', 'assembler'].includes(sketch.manifest?.kind)) {
      return NextResponse.json(
        { error: `Sketch '${ref}' is not a manji-tree/workbench/assembler polygomer or figure — skinned renders only exist for those kinds` },
        { status: 422 },
      );
    }

    const url = new URL(request.url);
    const rawN = url.searchParams.get('n');
    let file;
    if (rawN != null) {
      const n = Number.parseInt(rawN, 10);
      const candidate = Number.isInteger(n) && n > 0 ? path.join(skinDir(ref), `skin-${n}.png`) : null;
      file = candidate && existsSync(candidate) ? candidate : null;
    } else {
      file = latestSkin(ref)?.path ?? null;
    }
    if (!file) {
      return NextResponse.json(
        {
          error: `No skin bound to '${ref}' yet — paint over the scaffold and submit via skin_polygomer`,
          scaffold: `/api/sketches/${encodeURIComponent(ref)}/png?control=1`,
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
      { error: err.message || 'Failed to serve skinned polygomer render' },
      { status: 500 },
    );
  }
}
