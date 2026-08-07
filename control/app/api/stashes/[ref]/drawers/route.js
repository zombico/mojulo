/**
 * POST /api/stashes/[ref]/drawers — mint a drawer in a stash.
 *
 * Body: { name: string }
 *
 * Idempotent on (stash, name) — re-minting an existing drawer surfaces the
 * existing row rather than throwing UNIQUE.
 */

import { NextResponse } from 'next/server';
import { StashRepository } from '@/lib/db/repositories/stashes';

export async function POST(request, { params }) {
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
    const drawer = StashRepository.mintDrawer({ stashRef: ref, name });
    return NextResponse.json({
      drawer: { name: drawer.name, createdAt: drawer.createdAt },
    });
  } catch (err) {
    const status = /not found/i.test(err.message) ? 404 : 500;
    return NextResponse.json(
      { error: err.message || 'Failed to mint drawer' },
      { status },
    );
  }
}
