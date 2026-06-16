/**
 * PATCH /api/cooks/<cook_ref> — flip a cook's archive state.
 *
 * Body: { archived: true }   → archive (idempotent on already-archived)
 *       { archived: false }  → unarchive (idempotent on already-open)
 *
 * The folder on disk is NOT touched (citable-atoms posture); only the row
 * state flips. Cook outcomes stay reachable at /outcomes/<cook_ref>/.
 */

import { NextResponse } from 'next/server';
import { CookRepository } from '@/lib/db/repositories/cooks';

export async function PATCH(request, ctx) {
  try {
    const params = await ctx.params;
    const cookRef = params.ref;
    if (!cookRef || typeof cookRef !== 'string') {
      return NextResponse.json({ error: 'cook_ref is required' }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    if (typeof body.archived !== 'boolean') {
      return NextResponse.json({ error: 'body.archived must be a boolean' }, { status: 400 });
    }
    const result = body.archived
      ? CookRepository.archive(cookRef)
      : CookRepository.unarchive(cookRef);
    if (result.notFound) {
      return NextResponse.json({ error: `Cook '${cookRef}' not found` }, { status: 404 });
    }
    return NextResponse.json({
      cook_ref: cookRef,
      archived: body.archived ? !!result.archived : false,
      unarchived: !body.archived ? !!result.unarchived : false,
      already_archived: !!result.alreadyArchived,
      already_open: !!result.alreadyOpen,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to update cook' },
      { status: 500 },
    );
  }
}
