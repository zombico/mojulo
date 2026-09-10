/**
 * Fleet-wide Analytics tab backend.
 *
 * Fan-outs /api/analytics/summary across every connected deployment, sums
 * the daily breakdowns and heatmap in process memory, returns a unified
 * view. Caches the result in-process for 60s keyed by
 * (startDate, endDate, deployment-set-hash). Nothing persists.
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { fanOut, listConnectedDeployments } from '@/lib/deployers/bot-fleet';

const CACHE_TTL_MS = 60_000;
const cache = new Map(); // key -> { expiresAt, payload }

function cacheKey(startDate, endDate, deployments) {
  const ids = deployments.map((d) => d.id).sort().join(',');
  const h = crypto.createHash('sha1').update(ids).digest('hex').slice(0, 12);
  return `${startDate || ''}|${endDate || ''}|${h}`;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate') || '';
  const endDate = searchParams.get('endDate') || '';

  const deployments = await listConnectedDeployments();
  const key = cacheKey(startDate, endDate, deployments);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({
      ...cached.payload,
      cache: {
        fromCache: true,
        cachedAt: new Date(cached.cachedAt).toISOString(),
        ttlMs: CACHE_TTL_MS,
      },
    });
  }

  const qs = new URLSearchParams();
  if (startDate) qs.set('startDate', startDate);
  if (endDate) qs.set('endDate', endDate);
  const path = `/api/analytics/summary${qs.toString() ? `?${qs.toString()}` : ''}`;

  const { results, totalCount, reachableCount, unreachableCount } =
    await fanOut(path, { deployments });

  // Aggregate.
  const totals = { conversations: 0, turns: 0 };
  const dailyMap = new Map();      // 'YYYY-MM-DD' -> { conversations, turns }
  const heatMap = new Map();        // `${dow}-${hour}` -> turns
  const topBots = [];               // { id, botName, conversations, turns }
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
    const d = r.data || {};
    const t = d.totals || {};
    totals.conversations += t.conversations || 0;
    totals.turns += t.turns || 0;
    topBots.push({
      id: r.deployment.id,
      botName: r.deployment.botName,
      conversations: t.conversations || 0,
      turns: t.turns || 0,
    });
    for (const row of d.daily || []) {
      const cur = dailyMap.get(row.date) || { conversations: 0, turns: 0 };
      cur.conversations += row.conversations || 0;
      cur.turns += row.turns || 0;
      dailyMap.set(row.date, cur);
    }
    for (const cell of d.heatmap || []) {
      const k = `${cell.dow}-${cell.hour}`;
      heatMap.set(k, (heatMap.get(k) || 0) + (cell.turns || 0));
    }
  }

  const daily = Array.from(dailyMap.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const heatmap = Array.from(heatMap.entries()).map(([k, turns]) => {
    const [dow, hour] = k.split('-').map(Number);
    return { dow, hour, turns };
  });
  topBots.sort((a, b) => b.turns - a.turns);

  const payload = {
    totals: {
      ...totals,
      avgTurnsPerConversation: totals.conversations
        ? Number((totals.turns / totals.conversations).toFixed(2))
        : 0,
      activeBots: reachableCount,
      totalBots: totalCount,
    },
    daily,
    heatmap,
    topBots: topBots.slice(0, 10),
    fleet: {
      totalCount,
      reachableCount,
      unreachableCount,
      unreachable,
    },
  };

  const now = Date.now();
  cache.set(key, { expiresAt: now + CACHE_TTL_MS, cachedAt: now, payload });
  // Opportunistic eviction.
  if (cache.size > 64) {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (v.expiresAt <= now) cache.delete(k);
    }
  }

  return NextResponse.json({
    ...payload,
    cache: {
      fromCache: false,
      cachedAt: new Date(now).toISOString(),
      ttlMs: CACHE_TTL_MS,
    },
  });
}
