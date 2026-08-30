/**
 * GET /api/sketches/counts — true shelf totals for the Library chip row.
 *
 * The chips cannot count what the client holds, because the client deliberately
 * never holds the whole store: an unscoped list is capped at `rootLimit`, and a
 * shelf-scoped one only fetches its own bucket. So the counts come from one
 * server-side scan and ship as a handful of integers.
 *
 * Getting this wrong is not cosmetic — a chip reading "7" over a shelf holding
 * 121 is worse than no number at all.
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { shelfCountsFromTallies } from '@/lib/graph/sketch/library-shelves';

export async function GET() {
  try {
    const tallies = SketchRepository.bucketCounts();
    return NextResponse.json({ counts: shelfCountsFromTallies(tallies), total: tallies.total });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to count sketches' },
      { status: 500 },
    );
  }
}
