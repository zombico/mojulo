/**
 * Server-side data loader for the Apps pane.
 *
 * Stitches together three sources into one view model the pane consumes:
 *   - contextmap (artifact nodes with payload.app) — the materialization record
 *   - LocalRunner.list() — in-memory runtime state (running_ref, urls, status)
 *   - inventory (server_kind='app') — the auto-declared MCP entry per running app
 *
 * The contextmap is the source of truth for "what apps exist". The runner +
 * inventory layer over the top to mark which ones are currently running.
 */

import { MetaContextRepository } from '@/lib/db/repositories/meta-context';
import { LocalRunner } from '@/lib/runners/local';

function indexRunningByLocator() {
  const map = new Map();
  for (const r of LocalRunner.list()) {
    map.set(r.artifactRef, r);
  }
  return map;
}

function indexInventoryByRunningRef(brief) {
  const map = new Map();
  const servers = brief?.inventory?.servers || [];
  for (const s of servers) {
    if (s.serverKind === 'app' && s.runningRef) {
      map.set(s.runningRef, s);
    }
  }
  return map;
}

function projectAppFromNode(node, runningByLocator, inventoryByRunningRef) {
  const payload = node.payload || {};
  const app = payload.app || {};
  const locator = payload.locator || null;
  const runtime = locator ? runningByLocator.get(locator) || null : null;
  const inventory = runtime ? inventoryByRunningRef.get(runtime.runningRef) || null : null;

  const bindings = app.bindings || {};

  return {
    ref: node.ref,
    artifactNodeId: node.id,
    name: app.name || node.label || node.ref,
    label: node.label,
    adapterId: payload.adapter_id || null,
    host: payload.host || null,
    locator,
    materializedAt: node.createdAt,
    bindings: {
      runner: bindings.runner || null,
      durability: bindings.durability || null,
      inference: bindings.inference || null,
      mcp_self: bindings.mcp_self || null,
    },
    runtime: runtime
      ? {
          runningRef: runtime.runningRef,
          url: runtime.url,
          mcpUrl: runtime.mcpUrl,
          startedAt: runtime.startedAt,
          status: runtime.status,
        }
      : null,
    inventory: inventory
      ? {
          serverName: inventory.name,
          tools: inventory.tools,
        }
      : null,
  };
}

export function listApps() {
  const brief = MetaContextRepository.brief({ kind: 'fleet' });
  const runningByLocator = indexRunningByLocator();
  const inventoryByRunningRef = indexInventoryByRunningRef(brief);

  const apps = [];
  for (const node of brief.nodes) {
    if (node.kind !== 'artifact') continue;
    if (!node.payload?.app) continue;
    apps.push(projectAppFromNode(node, runningByLocator, inventoryByRunningRef));
  }
  apps.sort((a, b) => (b.materializedAt || 0) - (a.materializedAt || 0));
  return { apps };
}

export function getApp(ref) {
  if (!ref || typeof ref !== 'string') {
    throw new Error('getApp requires a string ref');
  }
  const brief = MetaContextRepository.brief({ kind: 'artifact', ref });
  const node = (brief.nodes || []).find((n) => n.kind === 'artifact' && n.ref === ref);
  if (!node || !node.payload?.app) return null;

  const runningByLocator = indexRunningByLocator();
  // The brief for an artifact node only includes 1-hop neighbors, not the
  // fleet's inventory — fetch inventory via the fleet brief specifically.
  const fleetBrief = MetaContextRepository.brief({ kind: 'fleet' });
  const inventoryByRunningRef = indexInventoryByRunningRef(fleetBrief);

  const projected = projectAppFromNode(node, runningByLocator, inventoryByRunningRef);

  const principles = (brief.principles || [])
    .filter((p) => p.scopeKind === 'node' && p.scopeId === node.id)
    .map((p) => ({
      id: p.id,
      bodyMd: p.bodyMd,
      sourceEvent: p.sourceEvent,
      createdAt: p.createdAt,
    }));

  return { ...projected, principles };
}
