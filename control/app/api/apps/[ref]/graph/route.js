import { NextResponse } from 'next/server';
import { getApp } from '@/lib/apps/loader';
import { TriggerArtifactRepository } from '@/lib/db/repositories/trigger-artifacts';
import { deriveAppTopology } from '@/lib/graph/derivers/app';
import { layout } from '@/lib/graph/layout';
import { validateSketchManifest } from '@/lib/graph/sketch/sketch-manifest';

export async function GET(_req, ctx) {
  try {
    const { ref } = await ctx.params;
    const decoded = decodeURIComponent(ref);
    const app = getApp(decoded);
    if (!app) return NextResponse.json({ error: 'App not found' }, { status: 404 });

    const triggers = TriggerArtifactRepository.listActive({ artifactRef: decoded });
    const topology = deriveAppTopology({ app, triggers });
    const manifest = layout(topology);

    // Fail loudly if the deriver/layout pair produces something the
    // renderer would silently ignore — the manifest is derived, not
    // user-authored, so a validation failure here is a code bug.
    const { ok, errors } = validateSketchManifest(manifest);
    if (!ok) {
      return NextResponse.json(
        { error: `Derived manifest failed validation: ${errors.join('; ')}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ manifest });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to derive graph' }, { status: 500 });
  }
}
