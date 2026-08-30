/**
 * GET /api/home — everything the viewport home draws, in one request.
 *
 * The home is a composition, not a new data model: the head artifact and its
 * display modes (§8 phase 2), the Library shelf counts (phase 3), the render
 * queue depth (phase 5), the installed packs, and the tool-call rate. Phase 6 is
 * deliberately last precisely because every one of these already existed; this
 * route is the seam that puts them on one screen.
 *
 * One request rather than six, because the home is the first paint of the app and
 * six waterfalled fetches is what the drawer-and-tiles version felt like.
 *
 * Query params:
 *   - ref=<sketch ref>   open on a specific artifact instead of the head
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { RenderRequestRepository } from '@/lib/db/repositories/render-requests';
import { McpToolCallRepository } from '@/lib/db/repositories/mcpToolCalls';
import { hasBoundRender } from '@/lib/graph/image-outcomes/render-store';
import { sketchRenderMode } from '@/lib/graph/sketch/sketch-manifest';
import { shelfCountsFromTallies } from '@/lib/graph/sketch/library-shelves';
import { hudFacts, pickHead } from '@/lib/graph/sketch/outliner';
import { queueTotals } from '@/lib/render-bay/lanes';
import { scanOneOutcome } from '@/lib/render-bay/outputs-scan';
import { installedGroups } from '@/lib/mcp/packs';

/** How deep to look for an artifact the viewport can open. */
const HEAD_WINDOW = 40;

/**
 * The head artifact, plus the two display-mode facts that don't live in the
 * manifest — resolved here so the client never round-trips to find out which
 * readings exist (the same two the sketch detail page resolves server-side).
 */
function headArtifact(wantedRef) {
  const explicit = wantedRef ? SketchRepository.getByRef(wantedRef) : null;
  const sketch = explicit || pickHead(SketchRepository.recent({ limit: HEAD_WINDOW }), sketchRenderMode);
  if (!sketch) return null;
  const giVariantRef = SketchRepository.getByRef(`${sketch.ref}_gi`) ? `${sketch.ref}_gi` : null;
  return {
    ref: sketch.ref,
    title: sketch.title,
    manifest: sketch.manifest,
    createdAt: sketch.createdAt,
    bucket: sketch.bucket,
    renderMode: sketchRenderMode(sketch.manifest),
    giVariantRef,
    hasBoundRender: hasBoundRender(sketch.ref),
    hud: hudFacts({ sketch, giBakeFrom: sketch.manifest?.giBake?.from || null }),
  };
}

/**
 * The status bar. Install state is DERIVED, never asserted: a lean host should be
 * able to read why it has fewer doors rather than just having fewer of them.
 */
function statusBar() {
  let calls = null;
  try {
    // `aggregates` is per-tool; the bar wants the machine-on light, not a table.
    calls = McpToolCallRepository.aggregates({ sinceDays: 1 })
      .reduce((n, row) => n + (row.calls || 0), 0);
  } catch {
    calls = null;   // telemetry is optional; a missing rate is not an error
  }
  return { packs: [...installedGroups()].sort(), toolCalls: calls };
}

export async function GET(request) {
  try {
    const wantedRef = new URL(request.url).searchParams.get('ref');
    const head = headArtifact(wantedRef);
    const tallies = SketchRepository.bucketCounts();
    const outcome = head ? await scanOneOutcome(head.ref) : null;

    return NextResponse.json({
      head,
      outcome,
      library: { counts: shelfCountsFromTallies(tallies), total: tallies.total },
      queue: queueTotals(RenderRequestRepository.statusCounts()),
      status: statusBar(),
    });
  } catch (error) {
    console.error('[home] compose failed:', error);
    return NextResponse.json({ error: error.message || 'home read failed' }, { status: 500 });
  }
}
