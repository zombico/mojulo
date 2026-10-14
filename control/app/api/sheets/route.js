/**
 * GET /api/sheets — the repertoire: every sheet mojulo draws from its own tables, no recipe (lib/graph/sheets/registry.js
 * REPERTOIRE), each with the kits it draws in. A sheet itself is /api/sheets/<id>?kit=&seed=.
 */

import { NextResponse } from 'next/server';

import { repertoireList, ALL_KITS } from '@/lib/graph/sheets/registry';

export async function GET() {
  return NextResponse.json({ sheets: repertoireList(), kits: ALL_KITS });
}
