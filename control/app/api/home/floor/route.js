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
 * (turntable-strip.js `resolveTurntableForMode`).
 *
 * Design: components/3d-factory-ui.plan.md §10 (the splayed floor).
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { hasBoundRender } from '@/lib/graph/image-outcomes/render-store';
import { sketchRenderMode } from '@/lib/graph/sketch/sketch-manifest';
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
 * counts instead of counts-in-window.
 */
const BUCKET_WINDOW = 5000;

/** One strip face on the wire. Badge facts only — the manifest stays home. */
function lightFace(sketch) {
  const manifest = sketch.manifest || {};
  return {
    ref: sketch.ref,
    title: sketch.title || sketch.ref,
    kind: manifest.kind || null,
    renderMode: sketchRenderMode(manifest),
    createdAt: sketch.createdAt,
    stack: sketch.stack || 1,
    ...(sketch.kit ? { kit: sketch.kit } : {}),
    badges: {
      gi: Boolean(manifest.giBake),
      game: Boolean(manifest.game),
      audio: Boolean(manifest.audio),
      // Painted = an externally-rendered picture is bound to this recipe. The
      // provenance badge is never optional (docs/bicycles.md).
      painted: hasBoundRender(sketch.ref),
    },
  };
}

/** The rows a shelf's strip folds over, from the per-bucket windows. */
function shelfWindow(byBucket, shelfKey) {
  const buckets = {
    scenes: 'world',
    models: 'object',
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
      const faces = shelfKey === 'characters'
        ? castGroups(window).slice(0, STRIP_LIMITS.characters)
        : stripFaces(window, shelfKey);
      strips[shelfKey] = faces.map(lightFace);
    }

    // The bench's "picked up recently" — newest few library artifacts across
    // every shelf, each wearing its own kind on the floor.
    const recent = Object.values(byBucket)
      .flat()
      .filter(inLibrary)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, RECENT_PICKS)
      .map(lightFace);

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
