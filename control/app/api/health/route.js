import { NextResponse } from 'next/server';

// Liveness for the dashboard (the smoke script polls it, the middleware leaves it public). Until 3.0
// it also reported whether the chatbot runtime template (lite-template) was on disk; the template
// left with the chatbot factory.
export async function GET() {
  return NextResponse.json({ ok: true, ts: Date.now() });
}
