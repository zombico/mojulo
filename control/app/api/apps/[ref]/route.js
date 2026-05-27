import { NextResponse } from 'next/server';
import { getApp } from '@/lib/apps/loader';

export async function GET(_req, ctx) {
  try {
    const { ref } = await ctx.params;
    const decoded = decodeURIComponent(ref);
    const data = getApp(decoded);
    if (!data) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to read app' }, { status: 500 });
  }
}
