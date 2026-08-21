/**
 * GET /api/cooks — list cook outcomes for the dashboard inbox.
 *
 * Cooks are created via the MCP `cook` tool; the dashboard is a view. This
 * route lists; the `/outcomes/<cook_ref>/` static route renders.
 *
 * Query params:
 *   - kind=essay|picture_book|slide_deck|all   (default: all; filters server-side)
 *   - q=<text>                                  (substring match on aim or ref)
 *   - limit=<int>                               (default 50, max 200)
 *
 * Each row carries the resolved source-stash titles so the inbox can show
 * lineage chips without a second round-trip. The publication kind is derived
 * from `template_version` per the COOKS_UI.plan.md mapping; when step 5 of
 * PUBLISHER.plan.md lands (template_version → publication_version), this
 * route reads the column directly instead.
 */

import { NextResponse } from 'next/server';
import { CookRepository } from '@/lib/db/repositories/cooks';
import { StashRepository } from '@/lib/db/repositories/stashes';
import { outcomeUrlFor } from '@/lib/outcomes-paths';

const PUBLICATION_KINDS = new Set([
  'essay', 'picture_book', 'slide_deck',
  'flyer', 'brief', 'resume', 'newsletter', 'field_guide', 'pamphlet',
  'textbook', 'novel', 'visual_guide',
  'all',
]);

/**
 * Derive the publication kind from a cook row's `template_version`. The
 * prefix is load-bearing on purpose (see PUBLISHER.plan.md / picture-book.js).
 */
function kindFromTemplateVersion(templateVersion) {
  if (templateVersion == null) return 'unknown';
  if (/^pb-/.test(templateVersion)) return 'picture_book';
  if (/^sd-/.test(templateVersion)) return 'slide_deck';
  if (/^fl-/.test(templateVersion)) return 'flyer';
  if (/^br-/.test(templateVersion)) return 'brief';
  if (/^re-/.test(templateVersion)) return 'resume';
  if (/^nl-/.test(templateVersion)) return 'newsletter';
  if (/^fg-/.test(templateVersion)) return 'field_guide';
  if (/^pa-/.test(templateVersion)) return 'pamphlet';
  if (/^tb-/.test(templateVersion)) return 'textbook';
  if (/^nv-/.test(templateVersion)) return 'novel';
  if (/^vg-/.test(templateVersion)) return 'visual_guide';
  if (/^\d+$/.test(templateVersion)) return 'essay';
  return 'unknown';
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const kindParam = (searchParams.get('kind') || 'all').toLowerCase();
    if (!PUBLICATION_KINDS.has(kindParam)) {
      return NextResponse.json(
        { error: `kind must be one of: ${[...PUBLICATION_KINDS].join(', ')}` },
        { status: 400 },
      );
    }
    const statusParam = (searchParams.get('status') || 'open').toLowerCase();
    if (!['open', 'archived', 'all'].includes(statusParam)) {
      return NextResponse.json(
        { error: "status must be one of: 'open', 'archived', 'all'" },
        { status: 400 },
      );
    }
    const q = (searchParams.get('q') || '').trim().toLowerCase();
    const limitRaw = parseInt(searchParams.get('limit') || '50', 10);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 200);

    // Repository returns rows newest-first. We over-pull a little so that
    // kind+text filtering doesn't truncate to fewer than `limit` rows when
    // the filter is selective; an exact bound would need server-side SQL
    // filtering which is deferred until counts justify it.
    const overFetch = kindParam === 'all' && !q ? limit : limit * 4;
    const cooks = CookRepository.list({ limit: overFetch, status: statusParam });

    // Memoize stash lookups across rows — most demo stashes show up under
    // multiple cooks. Missing/removed stashes get a null title; the row
    // still renders (see the "linked resource removed" framing on
    // stash_bindings).
    const stashCache = new Map();
    function resolveStash(stashRef) {
      if (!stashCache.has(stashRef)) {
        const row = StashRepository.getByRef(stashRef);
        stashCache.set(stashRef, row ? { stashRef: row.stashRef, title: row.title } : { stashRef, title: null });
      }
      return stashCache.get(stashRef);
    }

    const rows = cooks
      .map((c) => {
        const publicationKind = kindFromTemplateVersion(c.templateVersion);
        return {
          cookRef: c.cookRef,
          aim: c.aim,
          publicationKind,
          templateVersion: c.templateVersion,
          suggestedLens: c.suggestedLens,
          stashes: c.stashRefs.map(resolveStash),
          sliceCount: c.slices.length,
          outcomeUrl: outcomeUrlFor(c.cookRef),
          createdAt: c.createdAt,
          archivedAt: c.archivedAt,
        };
      })
      .filter((r) => kindParam === 'all' || r.publicationKind === kindParam)
      .filter((r) => {
        if (!q) return true;
        return (r.aim || '').toLowerCase().includes(q)
          || r.cookRef.toLowerCase().includes(q);
      })
      .slice(0, limit);

    return NextResponse.json({ cooks: rows });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to list cooks' },
      { status: 500 },
    );
  }
}
