/**
 * POST /api/sketches — non-MCP path for minting sketches.
 *
 * The primary writer is the create_sketch MCP tool; this route exists so
 * curl / future UI dialogs can hit the same surface without going through
 * MCP.
 */

import { NextResponse } from 'next/server';
import { createSketchHandler } from '@/lib/mcp/tools/sketches';
import { SketchRepository } from '@/lib/db/repositories/sketches';

export async function GET() {
  try {
    const sketches = SketchRepository.list();
    return NextResponse.json({ sketches });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to list sketches' },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const result = await createSketchHandler(body || {});
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to create sketch' },
      { status: 400 },
    );
  }
}
