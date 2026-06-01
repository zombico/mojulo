/**
 * PATCH /api/sketches/folders/[ref] — rename a folder { name } → { folder }
 * DELETE /api/sketches/folders/[ref] — remove a folder; contained sketches
 *   are detached back to root (not cascade-deleted, since sketches outlive
 *   folders).
 */

import { NextResponse } from 'next/server';
import { SketchFolderRepository } from '@/lib/db/repositories/sketch-folders';

export async function PATCH(request, { params }) {
  try {
    const { ref } = await params;
    const body = await request.json().catch(() => ({}));
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json(
        { error: '`name` is required (non-empty string)' },
        { status: 400 },
      );
    }
    const updated = SketchFolderRepository.update({ ref, name });
    if (!updated) {
      return NextResponse.json(
        { error: `Folder '${ref}' not found` },
        { status: 404 },
      );
    }
    return NextResponse.json({ folder: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to rename folder' },
      { status: 500 },
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { ref } = await params;
    const removed = SketchFolderRepository.remove(ref);
    if (!removed) {
      return NextResponse.json(
        { error: `Folder '${ref}' not found` },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to delete folder' },
      { status: 500 },
    );
  }
}
