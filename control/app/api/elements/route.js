/**
 * GET /api/elements — what a world is styled from (lib/graph/elements/registry.js): every geocube, kit and city grammar
 * as a card (its title, what it reads as, its colours, the views it is seen in). Read from mojulo's tables; no recipe.
 */

import { NextResponse } from 'next/server';

import { ELEMENT_FAMILIES, listElements } from '@/lib/graph/elements/registry';

export async function GET() {
  try {
    return NextResponse.json({ families: ELEMENT_FAMILIES.map((f) => ({ ...f, elements: listElements(f.id) })) });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
