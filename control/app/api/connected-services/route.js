import { NextResponse } from 'next/server';
import { listConnectedServices } from '@/lib/connected-services/loader';

export async function GET() {
  try {
    return NextResponse.json(listConnectedServices());
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to list connected services' },
      { status: 500 },
    );
  }
}
