import { NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getApp } from '@/lib/apps/loader';

function readBearer(artifactDir) {
  const envPath = join(artifactDir, '.env');
  if (!existsSync(envPath)) return null;
  const text = readFileSync(envPath, 'utf8');
  const m = text.match(/^APP_MCP_BEARER=(\S+)$/m);
  return m ? m[1] : null;
}

export async function GET(_req, ctx) {
  try {
    const { ref } = await ctx.params;
    const decoded = decodeURIComponent(ref);
    const app = getApp(decoded);
    if (!app) return NextResponse.json({ error: 'App not found' }, { status: 404 });
    if (!app.runtime) {
      return NextResponse.json({ offline: true });
    }
    const bearer = readBearer(app.locator);
    if (!bearer) {
      return NextResponse.json(
        { error: 'APP_MCP_BEARER not found in .env' },
        { status: 500 },
      );
    }
    const res = await fetch(app.runtime.mcpUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'describe_app', arguments: {} },
      }),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `describe_app returned ${res.status}` },
        { status: 502 },
      );
    }
    const body = await res.json();
    if (body.error) {
      return NextResponse.json({ error: body.error.message || 'describe_app error' }, { status: 502 });
    }
    const payload = JSON.parse(body.result.content[0].text);
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json({ error: err.message || 'describe failed' }, { status: 502 });
  }
}
