/**
 * PATCH /api/stashes/[ref]/items/[id] — structural and content edits.
 *
 * Two shapes, dispatched on which field is present:
 *
 * 1. Drawer move:    { drawer: string | null }
 *      - null → root, string → must be an existing drawer in this stash.
 * 2. Content edit:   { title?, source_url?, body?, body_md?, body_svg? }
 *      - any subset; the per-type contract gate re-runs on the merged state,
 *        so a partial edit can never corrupt the type contract. Type itself
 *        is NOT mutable here — archive + re-gather to change it.
 *
 * Metadata edits stay on the MCP `update_item` tool — they're rarely the
 * thing an operator wants to poke from the dashboard, and exposing them via
 * HTTP would mean re-shipping the contract gate's required-keys vocabulary
 * to the browser.
 */

import { NextResponse } from 'next/server';
import { StashRepository } from '@/lib/db/repositories/stashes';

const CONTENT_FIELDS = ['title', 'source_url', 'body', 'body_md', 'body_svg'];

export async function PATCH(request, { params }) {
  try {
    const { ref, id } = await params;
    const itemId = Number.parseInt(id, 10);
    if (!Number.isInteger(itemId)) {
      return NextResponse.json({ error: 'invalid item id' }, { status: 400 });
    }
    const body = (await request.json().catch(() => ({}))) || {};

    if ('drawer' in body) {
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
    }

    const hasContentField = CONTENT_FIELDS.some((f) => f in body);
    if (!hasContentField) {
      return NextResponse.json(
        { error: '`drawer` or a content field (title, source_url, body, body_md, body_svg) is required' },
        { status: 400 },
      );
    }

    // Verify the item belongs to this stash so /api/stashes/[ref]/items/[id]
    // can't be used to mutate an item from a different stash by id alone.
    const existing = StashRepository.getItemById(itemId);
    if (!existing) {
      return NextResponse.json({ error: `Stash item '${itemId}' not found` }, { status: 404 });
    }
    const parent = StashRepository.getByRef(ref);
    if (!parent || existing.stashId !== parent.id) {
      return NextResponse.json(
        { error: `Stash item '${itemId}' does not belong to stash '${ref}'` },
        { status: 404 },
      );
    }

    const item = StashRepository.updateItem({
      itemId,
      title: 'title' in body ? body.title : undefined,
      sourceUrl: 'source_url' in body ? body.source_url : undefined,
      body: 'body' in body ? body.body : undefined,
      bodyMd: 'body_md' in body ? body.body_md : undefined,
      bodySvg: 'body_svg' in body ? body.body_svg : undefined,
    });

    return NextResponse.json({
      item: {
        id: item.id,
        type: item.type,
        title: item.title,
        sourceUrl: item.sourceUrl,
        body: item.body,
        bodyMd: item.bodyMd,
        metadata: item.metadata,
      },
    });
  } catch (err) {
    let status = 500;
    if (/not found|does not exist|does not belong/i.test(err.message)) status = 404;
    else if (/must be|is required|cannot|invalid/i.test(err.message)) status = 400;
    return NextResponse.json(
      { error: err.message || 'Failed to update item' },
      { status },
    );
  }
}
