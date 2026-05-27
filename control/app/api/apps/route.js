import { NextResponse } from 'next/server';
import { listApps } from '@/lib/apps/loader';

export async function GET() {
  try {
    const data = listApps();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to list apps' }, { status: 500 });
  }
}
