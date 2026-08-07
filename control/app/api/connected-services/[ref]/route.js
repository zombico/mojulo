import { NextResponse } from 'next/server';
import { getConnectedService } from '@/lib/connected-services/loader';

export async function GET(_req, ctx) {
  try {
    const { ref } = await ctx.params;
    const decoded = decodeURIComponent(ref);
    const service = getConnectedService(decoded);
    if (!service) {
      return NextResponse.json({ error: 'Connected service not found' }, { status: 404 });
    }
    return NextResponse.json(service);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to load connected service' },
      { status: 500 },
    );
  }
}
