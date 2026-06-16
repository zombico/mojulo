/**
 * GET /api/operations — read-only list of ops tags for the dashboard inbox.
 * POST /api/operations — forge a new ops tag (title + descriptor).
 *
 * UI/MCP split (intentional): the operator owns the FRAME (title + descriptor)
 * and creates / edits tags directly from the dashboard. The agent owns the
 * BINDING (members are attached via Ring 11 MCP tools: bind_to_ops_tag /
 * unbind_from_ops_tag). The frame is human-curated; resolving committed-
 * reality refs to bind needs the agent's context. See operations-view.md.
 */

import { NextResponse } from 'next/server';
import { OpsTagRepository } from '@/lib/db/repositories/ops-tags';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const tags = OpsTagRepository.list(status ? { status } : {});
    const summaries = tags.map((t) => {
      const counts = OpsTagRepository.memberCounts(t.tagRef);
      const memberTotal = Object.values(counts).reduce((acc, n) => acc + n, 0);
      return {
        tagRef: t.tagRef,
        title: t.title,
        status: t.status,
        memberTotal,
        memberCounts: counts,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      };
    });
    return NextResponse.json({ tags: summaries });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to list ops tags' },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Request body must be JSON with { title, descriptor }' },
        { status: 400 },
      );
    }
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const descriptor = typeof body.descriptor === 'string' ? body.descriptor.trim() : '';
    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }
    if (!descriptor) {
      return NextResponse.json(
        { error: 'descriptor is required (the thesis members are measured against)' },
        { status: 400 },
      );
    }
    const tag = OpsTagRepository.forge({ title, descriptorMd: descriptor });
    return NextResponse.json(
      {
        tagRef: tag.tagRef,
        title: tag.title,
        descriptorMd: tag.descriptorMd,
        status: tag.status,
        createdAt: tag.createdAt,
        updatedAt: tag.updatedAt,
      },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to create ops tag' },
      { status: 500 },
    );
  }
}
