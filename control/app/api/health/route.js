import { NextResponse } from 'next/server';

// Liveness for the dashboard (the smoke script polls it, the middleware leaves it public).
export async function GET() {
  return NextResponse.json({ ok: true, ts: Date.now() });
}
