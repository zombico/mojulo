/**
 * Server-side data loader for the Apps pane.
 *
 * Stitches together three sources into one view model the pane consumes:
 *   - contextmap (artifact nodes with payload.app) — the materialization record
 *   - app-runtime pidfiles — durable runtime state (running_ref, urls, startedAt)
 *   - inventory (server_kind='app') — the auto-declared MCP entry per running app
 *
 * The contextmap is the source of truth for "what apps exist". The runtime +
 * inventory layer over the top to mark which ones are currently running.
 *
 * Runtime state is read from the daemon's pidfiles (a synchronous on-disk
 * read), NOT by querying the daemon over HTTP. This deliberately decouples the
 * Apps pane from daemon availability — the pane renders correctly whether or
 * not the daemon process is up, and (unlike the pre-daemon in-memory map) it
 * survives a control-plane restart. A pidfile present ⇒ status 'running'; the
 * daemon sweeps dead pidfiles on its next reconcile, so transient staleness is
 * the cost of the decoupling. The bearer in the pidfile is never projected
 * into the view model.
 *
 * Reads node + inventory state directly from the repositories rather than via
 * `MetaContextRepository.brief({kind:'fleet'})` — the brief is capped by design
 * (it's the agent's reading window) and UI surfaces need uncapped ground truth.
 */

import { MetaContextRepository, MetaNodeRepository } from '@/lib/db/repositories/meta-context';
import { InventoryRepository } from '@/lib/db/repositories/mcp-inventory';
import { listPidfiles } from '@/lib/runners/daemon/pidfile';

function indexRunningByLocator() {
  const map = new Map();
  for (const rec of listPidfiles()) {
    // Project only the safe runtime fields — never the bearer.
    map.set(rec.artifactRef, {
      runningRef: rec.runningRef,
      url: rec.url,
      mcpUrl: rec.sidecarUrl,
      startedAt: rec.startedAt,
      status: 'running',
    });
  }
  return map;
}

function indexInventoryByRunningRef(inventory) {
  const map = new Map();
  const servers = inventory?.servers || [];
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
  const nodes = MetaNodeRepository.listByKind('artifact');
  const inventory = InventoryRepository.currentInventory();
  const runningByLocator = indexRunningByLocator();
  const inventoryByRunningRef = indexInventoryByRunningRef(inventory);

  const apps = [];
  for (const node of nodes) {
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
  // The artifact brief only includes 1-hop neighbors, not the fleet's
  // inventory — read inventory directly from the repository (the brief's
  // cap doesn't apply to inventory anyway, but consistency with listApps()
  // matters more than a second round-trip).
  const inventory = InventoryRepository.currentInventory();
  const inventoryByRunningRef = indexInventoryByRunningRef(inventory);

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
