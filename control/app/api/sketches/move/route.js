/**
 * POST /api/sketches/move — bulk move sketches into a folder (or to root)
 *
 * Body: { refs: string[], folderRef: string|null }
 *   - folderRef === null  → move to root
 *   - folderRef === "fld_…" → move into that folder (validated to exist)
 *
 * Backs the multi-select "move to folder" affordance in the sketches index.
 * Single-sketch moves go through PATCH /api/sketches/[ref] instead.
 */

import { NextResponse } from 'next/server';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { SketchFolderRepository } from '@/lib/db/repositories/sketch-folders';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const refs = Array.isArray(body?.refs) ? body.refs.filter((r) => typeof r === 'string' && r) : [];
    if (refs.length === 0) {
      return NextResponse.json(
        { error: '`refs` must be a non-empty array of sketch refs' },
        { status: 400 },
      );
    }
    const folderRef = body?.folderRef ?? null;
    if (folderRef !== null) {
      if (typeof folderRef !== 'string' || !folderRef) {
        return NextResponse.json(
          { error: '`folderRef` must be a non-empty string or null' },
          { status: 400 },
        );
      }
      const folder = SketchFolderRepository.getByRef(folderRef);
      if (!folder) {
        return NextResponse.json(
          { error: `Folder '${folderRef}' not found` },
          { status: 404 },
        );
      }
    }
    const moved = SketchRepository.moveMany({ refs, folderRef });
    return NextResponse.json({ moved });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to move sketches' },
      { status: 500 },
    );
  }
}
