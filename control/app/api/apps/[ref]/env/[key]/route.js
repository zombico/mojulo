import { NextResponse } from 'next/server';
import { getApp } from '@/lib/apps/loader';
import { LocalRunner } from '@/lib/runners/local';

export async function DELETE(_req, ctx) {
  try {
    const { ref, key } = await ctx.params;
    const decodedRef = decodeURIComponent(ref);
    const decodedKey = decodeURIComponent(key);
    const app = getApp(decodedRef);
    if (!app) return NextResponse.json({ error: 'App not found' }, { status: 404 });
    const out = LocalRunner.deleteEnv(app.locator, decodedKey);
    return NextResponse.json(out);
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to delete env' }, { status: 500 });
  }
}
