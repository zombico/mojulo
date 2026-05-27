import { NextResponse } from 'next/server';
import { getApp } from '@/lib/apps/loader';
import { LocalRunner } from '@/lib/runners/local';

export async function POST(_req, ctx) {
  try {
    const { ref } = await ctx.params;
    const decoded = decodeURIComponent(ref);
    const app = getApp(decoded);
    if (!app) return NextResponse.json({ error: 'App not found' }, { status: 404 });
    if (!app.runtime) {
      return NextResponse.json({ stopped: false, reason: 'not_running' });
    }
    const out = await LocalRunner.stop(app.runtime.runningRef);
    return NextResponse.json(out);
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to stop app' }, { status: 500 });
  }
}
