/**
 * GET /api/sketches — the gallery's list, as SUMMARIES.
 *
 * A row carries ref, title, kind, renderMode, the effective bucket (+ the
 * override), createdAt, folderRef, the badge facts the shelves read, plus
 * `associations` and `hasBoundRender` from this route. The manifest rides along
 * only for the rows the client renders from it — diagram-mode rows (CreationMap)
 * and the voice shelf — per the rule in lib/graph/sketch/sketch-summary.js.
 * Everything else fetches `/api/sketches/<ref>` when it needs the recipe. The
 * Scenes shelf was a 62 MB body before this: every `controllable` row carries its
 * baked `faces` inline, and the browser parsed and held all of them.
 *
 * POST /api/sketches — non-MCP path for minting sketches.
 *
 * The primary writer is the create_sketch MCP tool; this route exists so
 * curl / future UI dialogs can hit the same surface without going through
 * MCP.
 */

import { NextResponse } from 'next/server';
import { createSketchHandler } from '@/lib/mcp/tools/sketches';
import { getDb } from '@/lib/db/index.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { SketchFolderRepository } from '@/lib/db/repositories/sketch-folders';
import { isBucket } from '@/lib/graph/sketch/sketch-manifest';
import { hasBoundRender } from '@/lib/graph/image-outcomes/render-store';

function sketchAssociationMap() {
  const db = getDb();
  const byRef = new Map();

  const add = (ref, kind, count) => {
    if (!ref || !count) return;
    const entry = byRef.get(ref) || new Map();
    entry.set(kind, (entry.get(kind) || 0) + count);
    byRef.set(ref, entry);
  };

  for (const row of db
    .prepare(
      `SELECT sketch_ref AS ref, COUNT(*) AS count
         FROM plans
        WHERE sketch_ref IS NOT NULL AND sketch_ref != ''
        GROUP BY sketch_ref`,
    )
    .all()) {
    add(row.ref, 'plan', row.count);
  }

  for (const row of db
    .prepare(
      `SELECT sketch_ref AS ref, COUNT(*) AS count
         FROM research_abstracts
        WHERE sketch_ref IS NOT NULL AND sketch_ref != ''
        GROUP BY sketch_ref`,
    )
    .all()) {
    add(row.ref, 'research', row.count);
  }

  for (const row of db
    .prepare(
      `SELECT media_ref AS ref, COUNT(*) AS count
         FROM research_items
        WHERE kind = 'sketch' AND media_ref IS NOT NULL AND media_ref != ''
        GROUP BY media_ref`,
    )
    .all()) {
    add(row.ref, 'research', row.count);
  }

  return byRef;
}

function withAssociations(sketches) {
  const byRef = sketchAssociationMap();
  return sketches.map((sketch) => {
    const kinds = byRef.get(sketch.ref);
    if (!kinds) return sketch;
    return {
      ...sketch,
      associations: Array.from(kinds.entries()).map(([kind, count]) => ({ kind, count })),
    };
  });
}

/**
 * Whether each row has an externally-painted render bound to it, so the gallery's
 * display-mode control can offer `painted` without a round-trip per card. Cheap:
 * one stat per ref, and a readdir only for the few refs that have an outcome
 * folder at all.
 */
function withRenderState(sketches) {
  return sketches.map((sketch) => ({ ...sketch, hasBoundRender: hasBoundRender(sketch.ref) }));
}

export async function GET(request) {
  try {
    // ?bucket=diagram|illustration|world narrows the list to one concern
    // (Sketches / Maker-Illustrations / Maker-Worlds); absent, every sketch is
    // returned. The bucket is the effective (override-or-derived) value computed
    // in the repository. Validated against BUCKETS via isBucket so the allow-list
    // isn't hand-maintained here.
    const bucketParam = new URL(request.url).searchParams.get('bucket');
    const bucket = isBucket(bucketParam) ? bucketParam : null;
    const sketches = withRenderState(withAssociations(SketchRepository.listSummary({ bucket })));
    const folders = SketchFolderRepository.list();
    return NextResponse.json({ sketches, folders });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to list sketches' },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const result = await createSketchHandler(body || {});
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to create sketch' },
      { status: 400 },
    );
  }
}
