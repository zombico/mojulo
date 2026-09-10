import { NextResponse } from 'next/server';
import { runScopedSql, FLEET_SCHEMA } from '@/lib/fleet/scoped-sql';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { sql } = body || {};
  const result = await runScopedSql(sql);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}

export async function GET() {
  return NextResponse.json({ schema: FLEET_SCHEMA });
}
