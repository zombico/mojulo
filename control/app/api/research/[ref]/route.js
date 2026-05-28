/**
 * GET /api/research/[ref] — the full book (session + items + abstracts) for the
 * notebook pane. Mirrors what the `get_research` MCP tool returns. Read-only.
 */

import { NextResponse } from 'next/server';
import { ResearchRepository } from '@/lib/db/repositories/research';

export async function GET(_request, { params }) {
  try {
    const { ref } = await params;
    const book = ResearchRepository.getFullBook(ref);
    if (!book) {
      return NextResponse.json({ error: `Research session '${ref}' not found` }, { status: 404 });
    }
    return NextResponse.json(book);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to load research book' },
      { status: 500 },
    );
  }
}
