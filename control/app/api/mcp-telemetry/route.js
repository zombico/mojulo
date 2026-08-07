/**
 * GET /api/mcp-telemetry — read-only MCP tool-call telemetry for the
 * /observability dashboard page.
 *
 * Telemetry is WRITTEN only from the MCP seam (lib/mcp/telemetry.js); this
 * route is a pure view over the mcp_tool_calls table — no POST. Localhost like
 * the rest of the control plane. Returns { aggregates, recent, errors } shaped
 * for the page. Records shapes only (top-level key names + byte sizes), never
 * input values or conversation content — see lib/mcp/observability.plan.md.
 */

import { NextResponse } from 'next/server';
import { McpToolCallRepository } from '@/lib/db/repositories/mcpToolCalls';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tool = searchParams.get('tool') || undefined;
    const sinceDays = Number(searchParams.get('sinceDays')) || 7;
    const limit = Number(searchParams.get('limit')) || 100;

    // { tool } drilldown → that tool's recent calls only.
    if (tool) {
      return NextResponse.json({ tool, recent: McpToolCallRepository.recent({ tool, limit }) });
    }

    const aggregates = McpToolCallRepository.aggregates({ sinceDays });
    const recent = McpToolCallRepository.recent({ limit });
    const errors = McpToolCallRepository.recent({ status: 'error', limit: 25 });
    return NextResponse.json({ aggregates, recent, errors, sinceDays });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to read telemetry' },
      { status: 500 },
    );
  }
}
