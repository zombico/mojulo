/**
 * LocalRunner — the public runner surface the MCP runner tools (start_app,
 * stop_app, …) call. As of the app-runtime daemon promotion this is a thin
 * HTTP client to the standalone daemon (lib/runners/daemon/server.js), not the
 * engine itself. The engine now lives in the daemon's process so app lifecycle
 * survives a control-plane restart.
 *
 * Split of responsibilities:
 *   - Lifecycle verbs (start / stop / status / list) proxy to the daemon over
 *     loopback HTTP, reading the daemon's port + bearer from
 *     ~/.mojulo/app-runtime/{port,bearer} before each call.
 *   - Env CRUD (listEnv / setEnv / deleteEnv) stays LOCAL — it's pure
 *     filesystem work on the artifact's .env with no shared runtime state, so
 *     routing it through the daemon would needlessly make `set_env` fail when
 *     the daemon is down. (Deliberate deviation from the daemon plan's literal
 *     file list.)
 *
 * Daemon-down behavior:
 *   - Reads (status / list) degrade: no daemon means nothing is tracked, so
 *     list → [] and status → 'unknown'.
 *   - Writes (start / stop) throw a clear error pointing at the daemon. The
 *     control plane never auto-spawns the daemon (that would recreate the
 *     "control-plane lifecycle leaks into app lifecycle" problem the daemon
 *     exists to solve).
 */

import { existsSync } from 'node:fs';
import { readPort, readBearer } from '@/lib/runners/daemon/files';
import { readEnv, writeEnv } from '@/lib/runners/env-file';

const DAEMON_HINT =
  'app-runtime daemon is not reachable. Start it with the `mojulo-daemons` bin ' +
  '(MOJULO_DAEMONS=enabled) or the standalone `mojulo-app-runtime` bin ' +
  '(MOJULO_APP_RUNTIME=enabled). See docs/app-runtime.md.';

class AppRuntimeUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AppRuntimeUnavailableError';
    this.code = 'DAEMON_UNREACHABLE';
  }
}

/**
 * Issue a request to the daemon. Throws AppRuntimeUnavailableError when the
 * daemon isn't reachable (no port/bearer file, or a connection-level failure).
 * Throws a plain Error carrying the daemon's `error` message on a 4xx/5xx.
 */
async function daemonRequest(method, pathname, body) {
  const port = readPort();
  const bearer = readBearer();
  if (!port || !bearer) {
    throw new AppRuntimeUnavailableError(DAEMON_HINT);
  }
  let res;
  try {
    res = await fetch(`http://127.0.0.1:${port}${pathname}`, {
      method,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${bearer}`,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (err) {
    // ECONNREFUSED etc — the port file is stale (daemon died without cleanup).
    throw new AppRuntimeUnavailableError(`${DAEMON_HINT} (${err?.message || err})`);
  }
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error || `app-runtime daemon returned ${res.status}`);
  }
  return payload;
}

export const LocalRunner = {
  name: 'local',
  capabilities: ['start_app', 'stop_app', 'status_app', 'list_running', 'env'],

  async list() {
    try {
      const out = await daemonRequest('GET', '/list');
      return out.running || [];
    } catch (err) {
      if (err instanceof AppRuntimeUnavailableError) return [];
      throw err;
    }
  },

  async status(runningRef) {
    try {
      return await daemonRequest('GET', `/status/${encodeURIComponent(runningRef)}`);
    } catch (err) {
      if (err instanceof AppRuntimeUnavailableError) {
        return { status: 'unknown', runningRef };
      }
      throw err;
    }
  },

  /**
   * Start an app + sidecar via the daemon. Cheap preconditions are checked
   * locally (the artifact lives on this same host) so bad input fails fast
   * without a daemon round-trip; the daemon re-validates and owns the spawn.
   */
  async start({ artifactRef, appName, materializationRef, declaredPurpose, serverName, timeoutMs }) {
    if (!artifactRef || typeof artifactRef !== 'string') {
      throw new Error('start requires artifactRef (absolute path to the app directory)');
    }
    if (!existsSync(artifactRef)) {
      throw new Error(`artifactRef does not exist: ${artifactRef}`);
    }
    if (!appName || typeof appName !== 'string' || !appName.trim()) {
      throw new Error('start requires a non-empty appName');
    }
    if (!materializationRef || typeof materializationRef !== 'string') {
      throw new Error('start requires materializationRef');
    }
    return daemonRequest('POST', '/start', {
      artifactRef,
      appName,
      materializationRef,
      declaredPurpose,
      serverName,
      ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    });
  },

  async stop(runningRef) {
    return daemonRequest('POST', '/stop', { runningRef });
  },

  // ── env management (local filesystem — not proxied to the daemon) ────────

  listEnv(artifactRef) {
    if (!existsSync(artifactRef)) {
      throw new Error(`artifactRef does not exist: ${artifactRef}`);
    }
    const { values } = readEnv(artifactRef);
    return { keys: Object.keys(values).sort() };
  },

  setEnv(artifactRef, key, value) {
    if (!existsSync(artifactRef)) {
      throw new Error(`artifactRef does not exist: ${artifactRef}`);
    }
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(String(key || ''))) {
      throw new Error(`Invalid env key '${key}' — must match [A-Za-z_][A-Za-z0-9_]*`);
    }
    if (typeof value !== 'string') {
      throw new Error('env value must be a string');
    }
    const { envPath, entries } = readEnv(artifactRef);
    const existing = entries.findIndex((e) => e.kind === 'kv' && e.key === key);
    if (existing >= 0) {
      entries[existing] = { kind: 'kv', key, value };
    } else {
      entries.push({ kind: 'kv', key, value });
    }
    writeEnv(envPath, entries);
    return { set: key };
  },

  deleteEnv(artifactRef, key) {
    if (!existsSync(artifactRef)) {
      throw new Error(`artifactRef does not exist: ${artifactRef}`);
    }
    const { envPath, entries } = readEnv(artifactRef);
    const before = entries.length;
    const filtered = entries.filter((e) => !(e.kind === 'kv' && e.key === key));
    if (filtered.length === before) return { deleted: false };
    writeEnv(envPath, filtered);
    return { deleted: true };
  },

  // Test seam — fans out to the daemon's gated /reset endpoint. Best-effort:
  // a missing/locked daemon is a no-op (the engine tests reset the engine
  // directly; this path only matters for tests that run against a live daemon).
  async _reset() {
    try {
      await daemonRequest('POST', '/reset', {});
    } catch {
      /* no daemon or reset disabled — nothing to clear on the client side */
    }
  },
};

export { AppRuntimeUnavailableError };
