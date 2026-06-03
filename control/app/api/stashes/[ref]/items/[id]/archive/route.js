/**
 * POST /api/stashes/[ref]/items/[id]/archive — soft-delete a stash item.
 *
 * Two-step gate matching the MCP `archive_item` tool: if the item is cited
 * by any cook, the first call returns { pendingConfirm: true, references }
 * without archiving. Re-call with body { confirm: true } to proceed. No
 * references → archive straight through.
 *
 * Soft delete only (citable-atoms posture from
 * lite-template/integration/app-system/0602/STASH_RELATIONAL_ATOMS.md);
 * hard delete is sweep-only and not exposed here.
 */

import { NextResponse } from 'next/server';
import { StashRepository } from '@/lib/db/repositories/stashes';

export async function POST(request, { params }) {
  try {
    const { ref, id } = await params;
    const itemId = Number.parseInt(id, 10);
    if (!Number.isInteger(itemId)) {
      return NextResponse.json({ error: 'invalid item id' }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    const confirm = body?.confirm === true;

    const existing = StashRepository.getItemById(itemId);
    if (!existing) {
      return NextResponse.json({ error: `Item '${itemId}' not found` }, { status: 404 });
    }
    if (existing.stashId == null) {
      return NextResponse.json({ error: 'item has no parent stash' }, { status: 500 });
    }
    // Validate the item actually belongs to the stash named in the URL — keeps
    // the route honest, since the repo verbs don't cross-check.
    const stash = StashRepository.getByRef(ref);
    if (!stash || stash.id !== existing.stashId) {
      return NextResponse.json(
        { error: `Item '${itemId}' does not belong to stash '${ref}'` },
        { status: 404 },
      );
    }

    const refs = StashRepository.scanItemReferences(itemId);
    if (refs.cooks.length > 0 && !confirm) {
      return NextResponse.json({
        archived: false,
        pendingConfirm: true,
        itemId,
        references: { cookCount: refs.cooks.length, cookRefs: refs.cooks },
        warning: `This item appears in ${refs.cooks.length} cook(s). POST again with { "confirm": true } to archive — downstream citations will still resolve to the archived content.`,
      });
    }
    const result = StashRepository.archiveItem({ itemId });
    return NextResponse.json({
      archived: result.archived,
      alreadyArchived: result.alreadyArchived,
      itemId,
      references: { cookCount: refs.cooks.length, cookRefs: refs.cooks },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to archive item' },
      { status: 500 },
    );
  }
}
