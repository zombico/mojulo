import { NextResponse } from 'next/server';
import { getConnectedService } from '@/lib/connected-services/loader';
import { deriveConnectedServiceTopology } from '@/lib/graph/derivers/connected-service';
import { layoutConnectedService } from '@/lib/graph/layout/connected-service';
import { validateSketchManifest } from '@/lib/graph/sketch/sketch-manifest';

export async function GET(_req, ctx) {
  try {
    const { ref } = await ctx.params;
    const decoded = decodeURIComponent(ref);
    const service = getConnectedService(decoded);
    if (!service) {
      return NextResponse.json({ error: 'Connected service not found' }, { status: 404 });
    }

    const topology = deriveConnectedServiceTopology({ service });
    const manifest = layoutConnectedService(topology);
    const { ok, errors } = validateSketchManifest(manifest);
    if (!ok) {
      return NextResponse.json(
        { error: `Derived manifest failed validation: ${errors.join('; ')}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ manifest });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to derive connected service graph' },
      { status: 500 },
    );
  }
}
