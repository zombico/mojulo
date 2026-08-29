import { NextResponse } from 'next/server';

import { listApps } from '@/lib/apps/loader';
import { listConnectedServices } from '@/lib/connected-services/loader';
import { InventoryRepository } from '@/lib/db/repositories/mcp-inventory';
import { PACKS, isPackInstalled } from '@/lib/mcp/packs';

/**
 * Workshop presence — per-destination record counts for the nav.
 *
 * The Workshop nav leads with the creative surface, which is ALWAYS shown: it is
 * the product, and an empty studio is an invitation, not clutter. The operational
 * destinations are the opposite — a bots tile on a host with no bots is noise —
 * so they appear only once they have records. This route supplies those counts.
 *
 * BOTS ARE READ THROUGH THE GATE, and the shape matters more than the number: the
 * count is taken only when the chatbot pack is installed, and the repository is
 * reached by a LAZY import, so no static edge from this retained route into bot
 * data exists (the same convention pack-boundary.test.js checks C and D rely on).
 * With the pack absent, `bots` is null and the tile is simply not there — absent,
 * not an empty stub. This is the optional-contributor template the fleet-scene
 * bots layer should adopt; see mojulo-2.0-pure-creative.plan.md, "The stance".
 */
async function botCount() {
  const chatbot = PACKS.find((p) => p.id === 'pack_bot_operate');
  if (!isPackInstalled(chatbot)) return null;
  try {
    const { DeploymentRepository } = await import('@/lib/db/repositories/deployments');
    return (await DeploymentRepository.list()).length;
  } catch {
    return null;
  }
}

function lengthOf(fn) {
  try {
    const rows = fn();
    return Array.isArray(rows) ? rows.length : 0;
  } catch {
    return 0;
  }
}

function serverCount() {
  try {
    return InventoryRepository.currentInventory().servers.length;
  } catch {
    return 0;
  }
}

export async function GET() {
  return NextResponse.json({
    bots: await botCount(),
    apps: lengthOf(listApps),
    services: lengthOf(listConnectedServices) + serverCount(),
  });
}
