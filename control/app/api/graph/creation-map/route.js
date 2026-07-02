/**
 * GET /api/graph/creation-map
 *
 * Returns the static creation-map manifest, the result of validating it
 * against the live MCP registry + contextmap schema enums, and a small
 * live overlay (count of materialized apps + last materialization
 * timestamp).
 *
 * The page at /graph consumes this once per refresh — no streaming, no
 * polling. The full per-app listing lives at /apps.
 */

import { NextResponse } from 'next/server';
import { ensureToolsRegistered } from '@/lib/mcp/server';
import { CREATION_MAP } from '@/lib/graph/creation-map';
import { validateCreationMap } from '@/lib/graph/sketch/validate';
import { listApps } from '@/lib/apps/loader';

export async function GET() {
  try {
    await ensureToolsRegistered();
    const validation = validateCreationMap(CREATION_MAP);

    let overlay = { appCount: 0, lastMaterializedAt: null };
    try {
      const { apps } = listApps();
      const lastMaterializedAt = apps.reduce(
        (max, a) => (a.materializedAt && (max == null || a.materializedAt > max) ? a.materializedAt : max),
        null,
      );
      overlay = { appCount: apps.length, lastMaterializedAt };
    } catch {
      // If the contextmap can't be read (fresh install, migrations
      // pending), the manifest is still useful — render with a zero
      // overlay rather than erroring the whole page.
    }

    return NextResponse.json({
      manifest: CREATION_MAP,
      validation,
      overlay,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to load creation map' },
      { status: 500 },
    );
  }
}
