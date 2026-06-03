/**
 * PATCH /api/stashes/[ref]/drawers/[name] — rename a drawer.
 *
 * Body: { name: string }   (the new name)
 *
 * Collides with UNIQUE(stash_id, name) if the new name already exists in this
 * stash — surfaces a clean 409 instead of a raw SQL error.
 */

import { NextResponse } from 'next/server';
import { StashRepository } from '@/lib/db/repositories/stashes';

export async function PATCH(request, { params }) {
  try {
    const { ref, name: oldName } = await params;
    const decodedOldName = decodeURIComponent(oldName);
    const body = await request.json().catch(() => ({}));
    const newName = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!newName) {
      return NextResponse.json(
        { error: '`name` is required (non-empty string)' },
        { status: 400 },
      );
    }
    const drawer = StashRepository.renameDrawer({
      stashRef: ref,
      oldName: decodedOldName,
      newName,
    });
    if (!drawer) {
      return NextResponse.json(
        { error: `Drawer '${decodedOldName}' not found in stash '${ref}'` },
        { status: 404 },
      );
    }
    return NextResponse.json({
      drawer: { name: drawer.name, createdAt: drawer.createdAt },
    });
  } catch (err) {
    let status = 500;
    if (/not found/i.test(err.message)) status = 404;
    else if (/already exists/i.test(err.message)) status = 409;
    return NextResponse.json(
      { error: err.message || 'Failed to rename drawer' },
      { status },
    );
  }
}
