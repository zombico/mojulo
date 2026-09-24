/**
 * GET /api/home/floor — the splayed-floor home's strips, in one light request.
 *
 * The floor shows a strip per shelf (scenes, models, characters, images,
 * diagrams) sorted into the 3D / 2D zones, plus the bench's "picked up
 * recently" column. Everything here is derived from the store the shelves
 * already read — one table scan (`newestByBucket`), the shelf split from
 * library-shelves, the stem folding from library-zones.
 *
 * The payload is deliberately LIGHT: a strip face carries ref, title, kind,
 * renderMode and a handful of badge facts — never the manifest. A city manifest
 * is tens of KB and the floor draws thirty faces; the full recipe belongs to
 * the room and the detail page, not the storefront. `renderMode` rides along
 * precisely so the client can resolve turntable stills without the manifest
 * (turntable-strip.js `resolveTurntableForMode`). The store side is light too:
 * `newestByBucket` returns light summaries off the persisted kind/bucket
 * columns, and only the faces that survive the fold are hydrated with facts
 * (`hydrateSummaries`), so no manifest is parsed to draw the floor.
 *
 * Design: components/3d-factory-ui.plan.md §10 (the splayed floor).
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { hasBoundRender } from '@/lib/graph/image-outcomes/render-store';
import {
  filterToShelf,
  inLibrary,
  shelfCountsFromTallies,
} from '@/lib/graph/sketch/library-shelves';
import {
  RECENT_PICKS,
  STRIP_LIMITS,
  STRIP_SHELVES,
  castGroups,
  stripFaces,
  zoneCounts,
} from '@/lib/graph/sketch/library-zones';

/**
 * Rows kept per bucket before folding — effectively the whole bucket, and
 * deliberately so. Two shelves are SUBSETS of the illustration bucket
 * (characters is CHARACTER_KINDS-only), and stem chains eat window rows before
 * folding: this store has back-to-back 116-sibling QA chains that swallowed a
 * 240-row window whole and left the characters strip empty. The scan cost does
 * not change with this number (`newestByBucket` walks and parses the whole
 * table either way, exactly as `bucketCounts()` does); it only extends how long
 * the parsed rows live before the fold discards them — and it buys true stack
 * counts instead of counts-in-window. The scan is a light SELECT over the
 * persisted columns, so it costs tens of milliseconds, not a parse of every
 * manifest.
 */
const BUCKET_WINDOW = 5000;

/**
 * One strip face on the wire, from a HYDRATED summary (facts attached). Badge
 * facts only — the manifest stays home.
 */
function lightFace(row) {
  const facts = row.facts || {};
  return {
    ref: row.ref,
    title: row.title || row.ref,
    kind: row.kind || null,
    renderMode: row.renderMode,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? row.createdAt,
    stack: row.stack || 1,
    ...(row.kit ? { kit: row.kit } : {}),
    badges: {
      gi: Boolean(facts.giBake),
      game: Boolean(facts.game),
      audio: Boolean(facts.audio),
      // Painted = an externally-rendered picture is bound to this recipe. The
      // provenance badge is never optional (docs/bicycles.md).
      painted: hasBoundRender(row.ref),
    },
  };
}

/** Fold survivors → hydrated summaries → wire faces. */
function faces(rows) {
  return SketchRepository.hydrateSummaries(rows).map(lightFace);
}

/** The rows a shelf's strip folds over, from the per-bucket windows. */
function shelfWindow(byBucket, shelfKey) {
  const buckets = {
    scenes: 'world',
    turntables: 'illustration',
    models: 'object',
    views: 'object',
    characters: 'illustration',
    images: 'illustration',
    diagrams: 'diagram',
  };
  return filterToShelf(byBucket[buckets[shelfKey]] || [], shelfKey);
}

export async function GET() {
  try {
    const { byBucket, tallies } = SketchRepository.newestByBucket({ perBucket: BUCKET_WINDOW });

    const strips = {};
    for (const shelfKey of STRIP_SHELVES) {
      const window = shelfWindow(byBucket, shelfKey);
      // Characters fold by NAME into cast entries with a kit; every other strip
      // folds iteration chains by title stem. Both cap at the strip's limit.
      const folded = shelfKey === 'characters'
        ? castGroups(window).slice(0, STRIP_LIMITS.characters)
        : stripFaces(window, shelfKey);
      strips[shelfKey] = faces(folded);
    }

    // The bench's "picked up recently" — the last-TOUCHED few library artifacts
    // across every shelf (a recipe edited in place counts, not just a mint),
    // each wearing its own kind on the floor.
    const touchedAt = (r) => r.updatedAt ?? r.createdAt ?? 0;
    const recent = faces(
      Object.values(byBucket)
        .flat()
        .filter(inLibrary)
        .sort((a, b) => touchedAt(b) - touchedAt(a) || (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, RECENT_PICKS),
    );

    const shelfCounts = shelfCountsFromTallies(tallies);
    return NextResponse.json({
      strips,
      recent,
      counts: shelfCounts,
      zones: zoneCounts(shelfCounts),
    });
  } catch (error) {
    console.error('[home/floor] compose failed:', error);
    return NextResponse.json({ error: error.message || 'floor read failed' }, { status: 500 });
  }
}
