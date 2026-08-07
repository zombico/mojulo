/**
 * GET /api/sketches/folders — list folders (with per-folder sketch counts)
 * POST /api/sketches/folders — create a folder { name } → { folder }
 *
 * Folders are a flat scratch-grouping over sketches; no nesting. The list
 * endpoint backs the sidebar folder rows, and the count is shown as a
 * badge so the operator can see folder density at a glance without having
 * to enter each one.
 */

import { NextResponse } from 'next/server';
import { SketchFolderRepository } from '@/lib/db/repositories/sketch-folders';

export async function GET() {
  try {
    const folders = SketchFolderRepository.list();
    return NextResponse.json({ folders });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to list folders' },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json(
        { error: '`name` is required (non-empty string)' },
        { status: 400 },
      );
    }
    const folder = SketchFolderRepository.create({ name });
    return NextResponse.json({ folder });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to create folder' },
      { status: 500 },
    );
  }
}
