import { NextResponse } from 'next/server';
import { loadFleetScene } from '@/lib/fleet-scene/loader';
import { deriveFleetSceneTopology } from '@/lib/graph/derivers/fleet-scene';
import { layoutFleetScene } from '@/lib/graph/layout/fleet-scene';
import { validateSketchManifest } from '@/lib/graph/sketch-manifest';

const FRAMINGS = new Set(['map', 'mcp-skills']);

// Shared fleet-scene route — both /map and (later) /mcp-skills fetch this.
// `framing` selects which edge kinds render; the scene itself is one projection.
function sceneForFraming(vm, framing) {
  if (framing !== 'mcp-skills') return vm;
  const servers = (vm.air?.servers || []).filter((server) => server.kind !== 'app');
  const serverIds = new Set(servers.map((server) => `server-${server.name}`));
  const crossLinks = (vm.crossLinks || []).filter((link) => serverIds.has(link.to?.id));
  return {
    ...vm,
    air: {
      ...(vm.air || {}),
      servers,
    },
    crossLinks,
  };
}

export async function GET(req) {
  try {
    const framingParam = new URL(req.url).searchParams.get('framing') || 'map';
    const framing = FRAMINGS.has(framingParam) ? framingParam : 'map';

    const vm = sceneForFraming(await loadFleetScene(), framing);
    const counts = {
      bots: vm.ground.bots.length,
      apps: vm.ground.apps.length,
      servers: vm.air.servers.length,
      services: vm.air.services.length,
    };

    const total = counts.bots + counts.apps + counts.servers + counts.services;
    if (total === 0) {
      return NextResponse.json({ manifest: null, counts, empty: true });
    }

    const topology = deriveFleetSceneTopology(vm, { framing });
    const manifest = layoutFleetScene(topology);

    // The manifest is derived, not user-authored, so a validation failure is a
    // code bug — fail loud rather than render something the renderer ignores.
    const { ok, errors } = validateSketchManifest(manifest);
    if (!ok) {
      return NextResponse.json(
        { error: `Derived manifest failed validation: ${errors.join('; ')}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ manifest, counts });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to derive fleet scene' },
      { status: 500 },
    );
  }
}
