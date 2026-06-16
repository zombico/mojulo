/**
 * GET   /api/operations/[ref] — full ops tag (descriptor + members) for the
 *                              detail pane.
 * PATCH /api/operations/[ref] — revise an ops tag (title / descriptor /
 *                              status). UI/MCP split: the operator owns the
 *                              FRAME (this PATCH); membership binding stays
 *                              MCP-only (Ring 11 bind_to_ops_tag).
 *
 * Members are returned with just member_kind + member_ref + bound_at — the
 * per-kind resource enrichment (status, last activity, edges) is the v0.5
 * architecture-mode work.
 */

import { NextResponse } from 'next/server';
import { OpsTagRepository } from '@/lib/db/repositories/ops-tags';

export async function GET(_request, { params }) {
  try {
    const { ref } = await params;
    const tag = OpsTagRepository.getByRef(ref);
    if (!tag) {
      return NextResponse.json({ error: `Ops tag '${ref}' not found` }, { status: 404 });
    }
    const members = OpsTagRepository.listMembers(ref);
    const counts = OpsTagRepository.memberCounts(ref);
    return NextResponse.json({
      tagRef: tag.tagRef,
      title: tag.title,
      descriptorMd: tag.descriptorMd,
      status: tag.status,
      memberCounts: counts,
      members: members.map((m) => ({
        memberKind: m.memberKind,
        memberRef: m.memberRef,
        boundAt: m.boundAt,
      })),
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to load ops tag' },
      { status: 500 },
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const { ref } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Request body must be JSON with at least one of: title, descriptor, status' },
        { status: 400 },
      );
    }
    const patch = {};
    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || !body.title.trim()) {
        return NextResponse.json({ error: 'title must be a non-empty string' }, { status: 400 });
      }
      patch.title = body.title.trim();
    }
    if (body.descriptor !== undefined) {
      if (typeof body.descriptor !== 'string' || !body.descriptor.trim()) {
        return NextResponse.json(
          { error: 'descriptor must be a non-empty string' },
          { status: 400 },
        );
      }
      patch.descriptorMd = body.descriptor.trim();
    }
    if (body.status !== undefined) {
      if (body.status !== 'active' && body.status !== 'archived') {
        return NextResponse.json(
          { error: "status must be 'active' or 'archived'" },
          { status: 400 },
        );
      }
      patch.status = body.status;
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: 'No fields to patch — include title, descriptor, or status' },
        { status: 400 },
      );
    }
    const tag = OpsTagRepository.revise(ref, patch);
    if (!tag) {
      return NextResponse.json({ error: `Ops tag '${ref}' not found` }, { status: 404 });
    }
    return NextResponse.json({
      tagRef: tag.tagRef,
      title: tag.title,
      descriptorMd: tag.descriptorMd,
      status: tag.status,
      updatedAt: tag.updatedAt,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to update ops tag' },
      { status: 500 },
    );
  }
}
