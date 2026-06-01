/**
 * GET /api/sketches/[ref] — returns { ref, title, manifest, createdAt }
 * for the page to render.
 *
 * PATCH /api/sketches/[ref] — in-place update of an existing sketch's
 * title and/or manifest. Used by the rename affordance in the sketches
 * UI and by the update_sketch MCP tool so the agent can iterate on the
 * same ref instead of minting a new one on every revision.
 */

import { NextResponse } from 'next/server';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { SketchFolderRepository } from '@/lib/db/repositories/sketch-folders';
import {
  validateSketchManifest,
  expandGridLayout,
} from '@/lib/graph/sketch-manifest';
import { expandNeoRembrandt } from '@/lib/graph/neo-rembrandt/index.js';

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

export async function PATCH(request, { params }) {
  try {
    const { ref } = await params;
    const body = await request.json().catch(() => ({}));
    const { title, manifest, folderRef } = body || {};

    if (title === undefined && manifest === undefined && folderRef === undefined) {
      return NextResponse.json(
        { error: 'PATCH requires at least one of `title`, `manifest`, or `folderRef`' },
        { status: 400 },
      );
    }
    if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
      return NextResponse.json(
        { error: '`title` must be a non-empty string if provided' },
        { status: 400 },
      );
    }
    if (folderRef !== undefined && folderRef !== null) {
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

    let nextManifest;
    if (manifest !== undefined) {
      let expanded;
      try {
        expanded = expandNeoRembrandt(expandGridLayout(manifest));
      } catch (err) {
        return NextResponse.json(
          { error: `Sketch expansion error: ${err.message}` },
          { status: 400 },
        );
      }
      const { ok, errors } = validateSketchManifest(expanded);
      if (!ok) {
        return NextResponse.json(
          { error: `Invalid manifest:\n - ${errors.join('\n - ')}` },
          { status: 400 },
        );
      }
      nextManifest = expanded;
    }

    const updated = SketchRepository.update({
      ref,
      title: title !== undefined ? title.trim() : undefined,
      manifest: nextManifest,
      folderRef,
    });
    if (!updated) {
      return NextResponse.json(
        { error: `Sketch '${ref}' not found` },
        { status: 404 },
      );
    }
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to update sketch' },
      { status: 500 },
    );
  }
}
