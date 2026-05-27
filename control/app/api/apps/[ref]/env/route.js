/**
 * Env-flow boundary:
 *   - GET returns only keys (LocalRunner.listEnv).
 *   - POST accepts { key, value } and writes directly to the artifact's .env
 *     via LocalRunner.setEnv. The value transits the request body and lives
 *     in the runner's in-process .env file write; it is never logged, never
 *     written to the control-plane DB, and never echoed back to the client.
 */

import { NextResponse } from 'next/server';
import { getApp } from '@/lib/apps/loader';
import { LocalRunner } from '@/lib/runners/local';

export async function GET(_req, ctx) {
  try {
    const { ref } = await ctx.params;
    const decoded = decodeURIComponent(ref);
    const app = getApp(decoded);
    if (!app) return NextResponse.json({ error: 'App not found' }, { status: 404 });
    const out = LocalRunner.listEnv(app.locator);
    return NextResponse.json(out);
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to list env' }, { status: 500 });
  }
}

export async function POST(req, ctx) {
  try {
    const { ref } = await ctx.params;
    const decoded = decodeURIComponent(ref);
    const app = getApp(decoded);
    if (!app) return NextResponse.json({ error: 'App not found' }, { status: 404 });
    const body = await req.json();
    if (typeof body?.key !== 'string') {
      return NextResponse.json({ error: 'key is required' }, { status: 400 });
    }
    if (typeof body?.value !== 'string') {
      return NextResponse.json({ error: 'value is required' }, { status: 400 });
    }
    const out = LocalRunner.setEnv(app.locator, body.key, body.value);
    return NextResponse.json(out);
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to set env' }, { status: 500 });
  }
}
