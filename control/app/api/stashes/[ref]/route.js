/**
 * GET   /api/stashes/[ref]  — full stash (stash row + drawers + items)
 * PATCH /api/stashes/[ref]  — rename and/or change status (archive / unarchive)
 *
 * Body for PATCH:
 *   { title?: string, status?: 'open' | 'archived' }
 *
 * Archived items are hidden by default (citable-atoms posture from
 * lite-template/integration/app-system/0602/STASH_RELATIONAL_ATOMS.md). Pass
 * ?include_archived=1 to surface them (e.g. an admin/audit view).
 */

import { NextResponse } from 'next/server';
import { StashRepository } from '@/lib/db/repositories/stashes';

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('include_archived') === '1';
    const full = StashRepository.getFull(ref, { includeArchived });
    if (!full) {
      return NextResponse.json({ error: `Stash '${ref}' not found` }, { status: 404 });
    }
    return NextResponse.json({
      stash: {
        stashRef: full.stash.stashRef,
        title: full.stash.title,
        status: full.stash.status,
        createdAt: full.stash.createdAt,
        updatedAt: full.stash.updatedAt,
      },
      drawers: full.drawers.map((d) => ({ name: d.name, createdAt: d.createdAt })),
      items: full.items.map((it) => ({
        id: it.id,
        type: it.type,
        drawer: it.drawer,
        title: it.title,
        sourceUrl: it.sourceUrl,
        body: it.body,
        bodyMd: it.bodyMd,
        mediaRef: it.mediaRef,
        metadata: it.metadata,
        createdAt: it.createdAt,
        archivedAt: it.archivedAt,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to load stash' },
      { status: 500 },
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const { ref } = await params;
    const body = await request.json().catch(() => ({}));
    const { title, status } = body || {};

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return NextResponse.json(
          { error: '`title` must be a non-empty string' },
          { status: 400 },
        );
      }
      const renamed = StashRepository.rename(ref, title.trim());
      if (!renamed) {
        return NextResponse.json({ error: `Stash '${ref}' not found` }, { status: 404 });
      }
    }

    if (status !== undefined) {
      if (status !== 'open' && status !== 'archived') {
        return NextResponse.json(
          { error: "`status` must be 'open' or 'archived'" },
          { status: 400 },
        );
      }
      if (status === 'archived') StashRepository.archive(ref);
      else StashRepository.unarchive(ref);
    }

    const stash = StashRepository.getByRef(ref);
    if (!stash) {
      return NextResponse.json({ error: `Stash '${ref}' not found` }, { status: 404 });
    }
    return NextResponse.json({
      stash: {
        stashRef: stash.stashRef,
        title: stash.title,
        status: stash.status,
        createdAt: stash.createdAt,
        updatedAt: stash.updatedAt,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to update stash' },
      { status: 500 },
    );
  }
}
