/**
 * Fleet-wide conversations browser backend.
 *
 * Fans /api/conversations out across connected deployments, merges results
 * by last_activity desc, paginates in memory. Per-bot pages are capped to
 * keep memory tame; total fleet result cap is 500 pre-pagination.
 *
 * No persistence — pages re-fan-out on every request.
 */

import { NextResponse } from 'next/server';
import { fanOut, listConnectedDeployments } from '@/lib/deployers/bot-fleet';

const PER_BOT_LIMIT = 50;
const TOTAL_CAP = 500;
const DEFAULT_PAGE_SIZE = 50;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate') || '';
  const endDate = searchParams.get('endDate') || '';
  const conversationId = searchParams.get('conversationId') || '';
  const deploymentIds = searchParams.get('deploymentIds') || '';
  const limit = Math.min(parseInt(searchParams.get('limit'), 10) || DEFAULT_PAGE_SIZE, 200);
  const offset = parseInt(searchParams.get('offset'), 10) || 0;

  // Single-bot /api/conversations on the artifact requires *some* search
  // param — without one, it returns just a count. Mirror that contract here.
  const hasParams = startDate || endDate || conversationId;
  if (!hasParams) {
    return NextResponse.json({
      conversations: [],
      pagination: { limit, offset, total: 0, returned: 0, hasMore: false },
      fleet: { totalCount: 0, reachableCount: 0, unreachableCount: 0, unreachable: [] },
    });
  }

  let deployments = await listConnectedDeployments();
  if (deploymentIds) {
    const wanted = new Set(deploymentIds.split(',').filter(Boolean));
    deployments = deployments.filter((d) => wanted.has(d.id));
  }

  const qs = new URLSearchParams();
  if (startDate) qs.set('startDate', startDate);
  if (endDate) qs.set('endDate', endDate);
  if (conversationId) qs.set('conversationId', conversationId);
  qs.set('limit', String(PER_BOT_LIMIT));
  qs.set('offset', '0');
  const path = `/api/conversations?${qs.toString()}`;

  const { results, totalCount, reachableCount, unreachableCount } =
    await fanOut(path, { deployments });

  const merged = [];
  const unreachable = [];
  for (const r of results) {
    if (!r.ok) {
      unreachable.push({
        id: r.deployment.id,
        botName: r.deployment.botName,
        reason: r.reason,
        status: r.status,
      });
      continue;
    }
    const convos = (r.data && r.data.conversations) || [];
    for (const c of convos) {
      merged.push({
        deploymentId: r.deployment.id,
        botName: r.deployment.botName,
        conversationId: c.conversation_id,
        startedAt: c.started_at,
        lastActivity: c.last_activity,
        turnCount: c.turn_count,
      });
    }
  }

  merged.sort((a, b) => (a.lastActivity < b.lastActivity ? 1 : -1));
  const truncated = merged.length > TOTAL_CAP;
  const capped = truncated ? merged.slice(0, TOTAL_CAP) : merged;
  const page = capped.slice(offset, offset + limit);

  return NextResponse.json({
    conversations: page,
    pagination: {
      limit,
      offset,
      total: capped.length,
      returned: page.length,
      hasMore: offset + page.length < capped.length,
      truncated,
    },
    fleet: {
      totalCount,
      reachableCount,
      unreachableCount,
      unreachable,
    },
  });
}
