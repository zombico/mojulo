/**
 * POST /api/sketches/delete — bulk delete sketches by ref.
 *
 * Body: { refs: string[] }
 *
 * Backs the multi-select "delete" affordance in the sketches index full
 * folder view. Single-sketch deletes go through DELETE /api/sketches/[ref].
 */

import { NextResponse } from 'next/server';
import { SketchRepository } from '@/lib/db/repositories/sketches';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const refs = Array.isArray(body?.refs)
      ? body.refs.filter((r) => typeof r === 'string' && r)
      : [];
    if (refs.length === 0) {
      return NextResponse.json(
        { error: '`refs` must be a non-empty array of sketch refs' },
        { status: 400 },
      );
    }
    const removed = SketchRepository.deleteMany({ refs });
    return NextResponse.json({ removed });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to delete sketches' },
      { status: 500 },
    );
  }
}
