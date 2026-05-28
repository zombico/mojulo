/**
 * Reconcile-on-boot — the upgrade out of the pre-daemon "restart loses
 * tracking" failure mode.
 *
 * Before the daemon, a control-plane restart wiped the in-memory `running` Map
 * but left `meta_mcp_inventory` rows (server_kind='app') behind. The next
 * start_app minted a fresh running_ref, its replace-by-running_ref cleanup was
 * a no-op against the orphan rows, and the insert collided under
 * UNIQUE(server, tool_name). Reconcile fixes this by making the DB + pidfiles
 * the source of truth at boot:
 *
 *   1. For each pidfile, if both pids are alive AND the sidecar answers a
 *      bearer-authenticated tools/list → ADOPT (re-register in the engine,
 *      pid-tracked). Otherwise → SWEEP (drop its inventory rows + pidfile).
 *   2. For each inventory running_ref with NO pidfile (orphaned by a restart
 *      that predates the daemon, or a lost pidfile) → SWEEP its inventory rows.
 *
 * After reconcile the Map and the DB are in sync, and the next start_app
 * inserts cleanly.
 */

import { InventoryRepository } from '@/lib/db/repositories/mcp-inventory';
import { RunnerEngine } from '@/lib/runners/engine';
import { listPidfiles, removePidfile, isPidAlive } from './pidfile.js';

const PROBE_TIMEOUT_MS = 2_000;

/**
 * Is the sidecar at `mcpUrl` answering on its bearer? A successful
 * tools/list is proof the process we're about to adopt is the real sidecar
 * (not a stale pid the OS reassigned). Any error / timeout → not alive.
 */
async function probeSidecar(mcpUrl, bearer) {
  if (!mcpUrl || !bearer) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(mcpUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const body = await res.json().catch(() => null);
    return Boolean(body?.result?.tools);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function sweep(runningRef) {
  try {
    InventoryRepository.removeAppInventory(runningRef);
  } catch (err) {
    console.warn(`[reconcile] removeAppInventory(${runningRef}) failed:`, err?.message || err);
  }
  removePidfile(runningRef);
}

/**
 * Run reconcile. Safe to call once at daemon boot (before the HTTP server
 * starts accepting start_app). Returns a summary for logging/tests.
 */
export async function reconcile() {
  const adopted = [];
  const swept = [];

  const pidfiles = listPidfiles();
  const pidfileRefs = new Set(pidfiles.map((r) => r.runningRef));

  // Pass 1 — adopt or sweep each pidfile-backed run.
  for (const rec of pidfiles) {
    const pidsAlive = isPidAlive(rec.appPid) && isPidAlive(rec.sidecarPid);
    const alive = pidsAlive && (await probeSidecar(rec.sidecarUrl, rec.bearer));
    if (alive) {
      try {
        RunnerEngine.adopt(rec);
        adopted.push(rec.runningRef);
      } catch (err) {
        console.warn(`[reconcile] adopt(${rec.runningRef}) failed:`, err?.message || err);
        sweep(rec.runningRef);
        swept.push(rec.runningRef);
      }
    } else {
      sweep(rec.runningRef);
      swept.push(rec.runningRef);
    }
  }

  // Pass 2 — sweep inventory rows whose running_ref has no pidfile at all.
  // These are the classic orphans the daemon promotion exists to kill.
  let invRefs = [];
  try {
    invRefs = InventoryRepository.listAppRunningRefs();
  } catch (err) {
    console.warn('[reconcile] listAppRunningRefs failed:', err?.message || err);
  }
  for (const { runningRef } of invRefs) {
    if (!pidfileRefs.has(runningRef)) {
      sweep(runningRef);
      swept.push(runningRef);
    }
  }

  return { adopted, swept };
}
