/**
 * GET /api/render-bay — the three lanes of "mojulo is producing something".
 *
 * One request, three lanes, because they are one question: the queue
 * (`image_render_requests`), the GI bakes (a manifest field on the sketches they
 * baked), and the outputs (cooks in a table, exports on disk). Each lane already
 * had a home of its own or none at all; none of them had a place where the
 * operator could see all four together, which is the gap §5 names.
 *
 * The route READS. Nothing here mutates: the accept/reject gate is rendered as a
 * gate and handed to the operator's agent as prompt text (lib/render-bay/lanes.js),
 * per the dashboard golden rule.
 *
 * Query params:
 *   - lane=queue|bakes|outputs   (default: all three)
 *   - limit=<int>                (per-lane page cap, default 40, max 200)
 *
 * Every capped lane returns its true `total` beside the page. A count that is
 * really a cap is the bug the Library shipped and caught in §8 phase 3; the same
 * rule applies here.
 */

import { NextResponse } from 'next/server';

import { RenderRequestRepository } from '@/lib/db/repositories/render-requests';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { CookRepository } from '@/lib/db/repositories/cooks';
import { outcomeUrlFor } from '@/lib/outcomes-paths';
import { queueTotals } from '@/lib/render-bay/lanes';
import { scanArtifactExports, scanBeatsExports } from '@/lib/render-bay/outputs-scan';

const LANES = new Set(['queue', 'bakes', 'outputs']);

/**
 * The queue lane.
 *
 * Active rows — anything still waiting on a worker or on the eyes gate — come
 * back WHOLE rather than capped, because the surface folds them by ref and a
 * partial read would make the fold lie about how many targets an artifact is
 * waiting on. That is affordable precisely because the active set is bounded by
 * what the operator has parked, not by how long the workshop has existed; the
 * unbounded half is `accepted`, and that stays capped.
 *
 * Totals still come from the whole-table tally, never from the page.
 */
const ACTIVE_STATUSES = ['pending', 'in_flight', 'submitted', 'rejected'];
const SETTLED_STATUSES = ['accepted', 'expired', 'cancelled'];

function queueLane(limit) {
  const active = RenderRequestRepository.listRecent({ statuses: ACTIVE_STATUSES, limit: 500 });
  const settled = RenderRequestRepository.listRecent({ statuses: SETTLED_STATUSES, limit });
  return {
    rows: [...active, ...settled],
    activeComplete: active.length < 500,
    totals: queueTotals(RenderRequestRepository.statusCounts()),
  };
}

/**
 * The bakes lane. `giBake` is stamped on the sketch the bake produced, so the row
 * carries both refs where they differ: `ref` is what to open (the `<ref>_gi`
 * variant for a generated-mesh bake), `from` is the world it was baked from.
 */
function bakesLane(limit) {
  const sketches = SketchRepository.giBakes();
  const rows = sketches.slice(0, limit).map((sketch) => {
    const bake = sketch.manifest?.giBake || {};
    return {
      ref: sketch.ref,
      title: sketch.title,
      kind: sketch.manifest?.kind || null,
      adapter: bake.adapter || null,
      preset: bake.preset || null,
      bakedAt: bake.bakedAt || null,
      samples: bake.samples ?? null,
      matchRate: bake.matchRate ?? null,
      floorBlackFrac: bake.floorBlackFrac ?? null,
      meshN: bake.meshN ?? null,
      from: bake.from || sketch.ref,
      sha256: bake.sha256 || null,
    };
  });
  return { rows, total: sketches.length };
}

/**
 * How many rows each outputs group shows.
 *
 * Deliberately shorter than the queue's page, and deliberately NOT raised by
 * `?limit=`: the bay WATCHES production, and each of these three groups already
 * has a full home to open (`/outputs` for publications, the artifact's own page
 * for its outcome folder). A second forty-row inbox stacked under the queue would
 * push the thing the bay exists to show — what is moving — off the screen.
 */
const OUTPUT_GROUP_ROWS = 12;

/** The outputs lane: cooks from their table, exports from disk. */
async function outputsLane(limit) {
  // One unbounded read, sliced — the inbox is dozens of rows, and a second query
  // just to learn the total would be a bigger cost than the rows it counts.
  const cooks = CookRepository.list({ status: 'open' });
  const [artifacts, beats] = await Promise.all([
    scanArtifactExports({ limit }),
    scanBeatsExports({ limit }),
  ]);
  return {
    cooks: {
      rows: cooks.slice(0, limit).map((cook) => ({
        ref: cook.cookRef,
        aim: cook.aim,
        templateVersion: cook.templateVersion,
        createdAt: cook.createdAt,
        stashRefs: cook.stashRefs,
        url: outcomeUrlFor(cook.cookRef),
      })),
      total: cooks.length,
    },
    artifacts,
    beats,
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const laneParam = searchParams.get('lane');
    if (laneParam && !LANES.has(laneParam)) {
      return NextResponse.json(
        { error: `lane must be one of: ${[...LANES].join(', ')}` },
        { status: 400 },
      );
    }
    const limit = Math.max(1, Math.min(200, Number(searchParams.get('limit')) || 40));
    const wanted = laneParam ? [laneParam] : [...LANES];

    const payload = { now: Math.floor(Date.now() / 1000) };
    if (wanted.includes('queue')) payload.queue = queueLane(limit);
    if (wanted.includes('bakes')) payload.bakes = bakesLane(limit);
    if (wanted.includes('outputs')) payload.outputs = await outputsLane(Math.min(limit, OUTPUT_GROUP_ROWS));

    return NextResponse.json(payload);
  } catch (error) {
    console.error('[render-bay] lane read failed:', error);
    return NextResponse.json({ error: error.message || 'render bay read failed' }, { status: 500 });
  }
}
