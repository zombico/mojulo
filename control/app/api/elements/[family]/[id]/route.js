/**
 * GET /api/elements/[family]/[id] — one element: its card, its document, and the recipes that name it (a geocube a
 * stage or a world is drawn on, a kit a stage or a world is built in, a grammar a city is laid out by).
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { readElement, usedBy, NAMING_KINDS } from '@/lib/graph/elements/registry';

export async function GET(request, { params }) {
  try {
    const { family, id } = await params;
    let element;
    try { element = readElement(family, id); } catch (err) { return NextResponse.json({ error: err.message }, { status: 404 }); }
    const rows = SketchRepository.listByKinds({ kinds: NAMING_KINDS[family] ?? [], limit: 2000 });
    return NextResponse.json({ ...element, usedBy: usedBy(family, id, rows) });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
