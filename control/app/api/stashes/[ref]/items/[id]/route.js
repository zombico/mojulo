/**
 * PATCH /api/stashes/[ref]/items/[id] — move an item between drawers.
 *
 * Body: { drawer: string | null }
 *   - null → move to root
 *   - drawer name → must exist in this stash
 *
 * Item edits (body/metadata) go through the MCP `update_item` tool; HTTP only
 * exposes the structural move here (the gather contract gate stays on the
 * single substrate path).
 */

import { NextResponse } from 'next/server';
import { StashRepository } from '@/lib/db/repositories/stashes';

export async function PATCH(request, { params }) {
  try {
    const { ref, id } = await params;
    const itemId = Number.parseInt(id, 10);
    if (!Number.isInteger(itemId)) {
      return NextResponse.json({ error: 'invalid item id' }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    if (!('drawer' in (body || {}))) {
      return NextResponse.json(
        { error: '`drawer` is required (string name or null for root)' },
        { status: 400 },
      );
    }
    const drawer = body.drawer;
    if (drawer !== null && typeof drawer !== 'string') {
      return NextResponse.json(
        { error: '`drawer` must be a string or null' },
        { status: 400 },
      );
    }
    const item = StashRepository.moveItem({ stashRef: ref, itemId, drawer });
    return NextResponse.json({
      item: {
        id: item.id,
        type: item.type,
        drawerId: item.drawerId,
        title: item.title,
      },
    });
  } catch (err) {
    let status = 500;
    if (/not found|does not exist|does not belong/i.test(err.message)) status = 404;
    else if (/must be a string|is required/i.test(err.message)) status = 400;
    return NextResponse.json(
      { error: err.message || 'Failed to move item' },
      { status },
    );
  }
}
