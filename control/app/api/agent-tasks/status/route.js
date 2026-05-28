/**
 * /api/agent-tasks/status — single-line status surface for terminal
 * status bars (Claude Code statusLine, Codex CLI status, etc.).
 *
 * Default response is plain text suitable for a status widget:
 *   - "mojulo: idle"
 *   - "mojulo: 2 in-flight (envelope_inference) · 1 queued"
 *   - "mojulo: ✓ delivered (node, 1.4s) · idle"
 *   - "mojulo: ✗ cancelled (image unreadable) · idle"
 *
 * Pass `?format=json` for structured data:
 *   {
 *     pendingCount, inFlightCount, idle,
 *     fulfiller: { running, runtime, supportedKinds },
 *     lastEvent: { kind, fulfiller, taskKind, durationMs, completedAt },
 *     recentEvents: [...],
 *   }
 *
 * Bearer-gated like the rest of the agent-callable surface (middleware
 * lets through any caller presenting the CONTROL_PLANE_MCP_KEY).
 *
 * See AGENT_TASKS_NODE_DRIVEN_PLAN.md (Phase 1.5).
 */

import { getQueueStats, getRecentEvents } from '@/lib/mcp/agent-tasks/queue';
import { getNodeFulfillerStatus, startNodeFulfiller } from '@/lib/agent-tasks/node-fulfiller';

function renderText({ stats, lastEvent, fulfillerStatus }) {
  const segments = [];
  if (stats.inFlightCount > 0) {
    segments.push(`${stats.inFlightCount} in-flight`);
  }
  if (stats.pendingCount > 0) {
    segments.push(`${stats.pendingCount} queued`);
  }
  if (segments.length === 0 && lastEvent) {
    const ago = Math.max(0, Math.round((Date.now() - lastEvent.recordedAt) / 1000));
    const fulfillerLabel = lastEvent.fulfiller?.kind === 'node-driven-runtime' ? 'node' : 'agent';
    if (lastEvent.kind === 'delivered') {
      const secs = (lastEvent.durationMs / 1000).toFixed(1);
      segments.push(`✓ delivered (${fulfillerLabel}, ${secs}s, ${ago}s ago)`);
    } else if (lastEvent.kind === 'cancelled') {
      segments.push(`✗ cancelled (${lastEvent.reason || 'no reason'}, ${ago}s ago)`);
    } else if (lastEvent.kind === 'expired') {
      segments.push(`✗ expired (${lastEvent.reason || 'timeout'}, ${ago}s ago)`);
    } else if (lastEvent.kind === 'invalid_envelope') {
      segments.push(`✗ invalid envelope (${ago}s ago)`);
    }
  }
  if (segments.length === 0) {
    segments.push('idle');
  }
  const prefix = fulfillerStatus.running ? `mojulo[${fulfillerStatus.runtime}]` : 'mojulo';
  return `${prefix}: ${segments.join(' · ')}`;
}

function lastEventFrom(events) {
  if (!events || events.length === 0) return null;
  return events[events.length - 1];
}

export async function GET(request) {
  // Calling startNodeFulfiller here is intentional: a fresh control-plane
  // process that hasn't otherwise touched the DB still gets the fulfiller
  // up the moment something queries the status endpoint. Idempotent —
  // returns the existing instance if already running.
  startNodeFulfiller();

  const url = new URL(request.url);
  const format = url.searchParams.get('format');
  const stats = getQueueStats();
  const events = getRecentEvents();
  const lastEvent = lastEventFrom(events);
  const fulfillerStatus = getNodeFulfillerStatus();

  if (format === 'json') {
    return new Response(JSON.stringify({
      pendingCount: stats.pendingCount,
      inFlightCount: stats.inFlightCount,
      idle: stats.pendingCount === 0 && stats.inFlightCount === 0,
      // Puller-liveness signals so a UI can detect an interactive /loop worker
      // (long-polling pull_agent_task) — not just the in-process Node fulfiller.
      waitingPullers: stats.waitingPullers,
      recentPullCount: stats.recentPullCount,
      lastPullAt: stats.lastPullAt,
      fulfiller: fulfillerStatus,
      lastEvent,
      recentEvents: events,
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(renderText({ stats, lastEvent, fulfillerStatus }), {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
