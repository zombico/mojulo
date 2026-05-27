import { NextResponse } from 'next/server';
import { getApp } from '@/lib/apps/loader';
import { LocalRunner } from '@/lib/runners/local';

export async function POST(_req, ctx) {
  try {
    const { ref } = await ctx.params;
    const decoded = decodeURIComponent(ref);
    const app = getApp(decoded);
    if (!app) return NextResponse.json({ error: 'App not found' }, { status: 404 });
    if (app.runtime) {
      return NextResponse.json({
        running_ref: app.runtime.runningRef,
        url: app.runtime.url,
        mcp_url: app.runtime.mcpUrl,
        already_running: true,
      });
    }
    const started = await LocalRunner.start({
      artifactRef: app.locator,
      appName: app.name,
      materializationRef: app.ref,
    });
    return NextResponse.json({
      running_ref: started.runningRef,
      url: started.url,
      mcp_url: started.mcpUrl,
      inventory_tools_registered: started.inventoryToolsRegistered,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to start app' }, { status: 500 });
  }
}
