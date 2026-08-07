import { NextResponse } from 'next/server';
import { getAllClientInfo } from '@/lib/mcp/client-bindings';
import { InventoryRepository } from '@/lib/db/repositories/mcp-inventory';

const LIVE_FRESHNESS_SECONDS = 5 * 60;

export async function GET() {
  const liveSessions = getAllClientInfo();
  const inv = InventoryRepository.currentInventory();
  const servers = inv.servers.map((s) => ({ name: s.name, toolCount: s.tools.length }));
  const fresh = inv.ageSeconds !== null && inv.ageSeconds <= LIVE_FRESHNESS_SECONDS;

  return NextResponse.json({
    liveSessions,
    inventory: {
      servers,
      toolCount: inv.toolCount,
      declaredAt: inv.declaredAt,
      ageSeconds: inv.ageSeconds,
      fresh,
    },
  });
}
