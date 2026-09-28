import { NextResponse } from 'next/server';

import { listApps } from '@/lib/apps/loader';
import { listConnectedServices } from '@/lib/connected-services/loader';
import { InventoryRepository } from '@/lib/db/repositories/mcp-inventory';

/**
 * Workshop presence — per-destination record counts for the nav.
 *
 * The Workshop nav leads with the creative surface, which is ALWAYS shown: it is
 * the product, and an empty studio is an invitation, not clutter. The operational
 * destinations are the opposite — an apps tile on a host with no apps is noise —
 * so they appear only once they have records. This route supplies those counts.
 *
 * Until 3.0 it also counted deployed bots (read through the chatbot pack's gate);
 * the chatbot factory left mojulo, and this route reads no bot data.
 */
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
    apps: lengthOf(listApps),
    services: lengthOf(listConnectedServices) + serverCount(),
  });
}
