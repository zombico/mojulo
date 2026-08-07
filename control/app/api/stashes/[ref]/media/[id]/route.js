/**
 * GET /api/stashes/[ref]/media/[id] — stream image bytes for a stash image item.
 *
 * media_ref resolution is two-flavored:
 *   - `doc_…`  → looks up DocumentRepository, streams via its storage_path
 *                (the path agent-gathered images take today by reusing the
 *                documents table).
 *   - anything else → treats media_ref as a literal storage key under
 *     control/data/storage/ — matches the per-stash storage scheme that
 *     lite-template/integration/app-system/0602/STASH_RELATIONAL_ATOMS.md
 *     introduces for the UI gather pipeline.
 *
 * The route only serves items of type `image` to keep the surface narrow —
 * other types would never hit this route from the renderer.
 */

import { NextResponse } from 'next/server';
import { StashRepository } from '@/lib/db/repositories/stashes';
import { DocumentRepository } from '@/lib/db/repositories/documents';
import { downloadToBuffer } from '@/lib/storage';

export async function GET(_request, { params }) {
  try {
    const { ref, id } = await params;
    const itemId = Number.parseInt(id, 10);
    if (!Number.isInteger(itemId)) {
      return NextResponse.json({ error: 'invalid item id' }, { status: 400 });
    }
    const item = StashRepository.getItemById(itemId);
    if (!item) {
      return NextResponse.json({ error: `Item '${itemId}' not found` }, { status: 404 });
    }
    const stash = StashRepository.getByRef(ref);
    if (!stash || stash.id !== item.stashId) {
      return NextResponse.json(
        { error: `Item '${itemId}' does not belong to stash '${ref}'` },
        { status: 404 },
      );
    }
    if (item.type !== 'image') {
      return NextResponse.json(
        { error: `Item '${itemId}' is not an image (type: ${item.type})` },
        { status: 400 },
      );
    }
    if (!item.mediaRef) {
      return NextResponse.json({ error: 'item has no media_ref' }, { status: 404 });
    }

    let storageKey = item.mediaRef;
    if (storageKey.startsWith('doc_')) {
      const doc = await DocumentRepository.findById(storageKey);
      if (!doc || !doc.storagePath) {
        return NextResponse.json(
          { error: `Document '${storageKey}' not found` },
          { status: 404 },
        );
      }
      storageKey = doc.storagePath;
    }

    const buffer = await downloadToBuffer(storageKey);
    const mime = item.metadata?.mime || 'application/octet-stream';
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (err) {
    if (err?.code === 'ENOENT') {
      return NextResponse.json({ error: 'media not found on disk' }, { status: 404 });
    }
    return NextResponse.json(
      { error: err.message || 'Failed to serve media' },
      { status: 500 },
    );
  }
}
