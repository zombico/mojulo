/**
 * Runner engine — the in-process core that spawns an app + its MCP sidecar as
 * a pair, allocates ports, auto-declares the sidecar's tools into inventory,
 * and writes a durable pidfile per run.
 *
 * This is the engine the **app-runtime daemon** ([daemon/server.js]) wraps over
 * HTTP. The pre-daemon `LocalRunner` used to be this code directly; now
 * lib/runners/local.js is a thin HTTP client to the daemon, and this module is
 * the thing the daemon (and the engine integration tests) actually run.
 *
 * State model:
 *   - In-memory `running` Map keyed on running_ref — the live view.
 *   - A pidfile per run (~/.mojulo/app-runtime/runs/<ref>.json) — the durable
 *     view that survives a daemon restart. On boot, reconcile reads the
 *     pidfiles + inventory rows and either adopts (sidecar still answering) or
 *     sweeps (dead) — see daemon/reconcile.js.
 *
 * Atomicity contract: `start()` brings up BOTH processes or neither. If either
 * fails to come up within the startup timeout, the other is killed and the
 * call throws — no pidfile, no inventory rows.
 *
 * Adoption note: processes adopted on reconcile are tracked by pid only (no
 * ChildProcess handle), so we can signal them but cannot receive `exit`
 * events. Their status is last-known until the next reconcile re-probes.
 */

import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { installScaffold } from '@/lib/app-mcp-scaffold/install';
import { InventoryRepository } from '@/lib/db/repositories/mcp-inventory';
import { readEnv } from '@/lib/runners/env-file';
import { writePidfile, removePidfile } from '@/lib/runners/daemon/pidfile';

const STARTUP_TIMEOUT_MS = 10_000;
const SHUTDOWN_GRACE_MS = 1_500;
const APP_URL_PATTERNS = [
  /^APP_URL=(\S+)$/m,
  // Vite's default: "  Local:   http://localhost:5173/"
  /^\s*Local:\s+(https?:\/\/\S+)/m,
];
const SIDECAR_URL_PATTERN = /^APP_MCP_URL=(\S+)$/m;

// In-memory state. Keyed on running_ref. Value shape:
//   { artifactRef, appName, materializationRef, serverName, appProcess,
//     sidecarProcess, appPid, sidecarPid, url, mcpUrl, bearer, startedAt,
//     status, adopted, crashInfo? }
const running = new Map();

function newRunningRef() {
  return `run-${randomBytes(8).toString('hex')}`;
}

// ── child-process helpers ────────────────────────────────────────────────

function spawnAndWaitForUrl({ command, args, cwd, env, label, patterns, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdoutBuf = '';
    let stderrBuf = '';
    let settled = false;

    const settle = (cb) => {
      if (settled) return;
      settled = true;
      cb();
    };
    const fail = (err) => settle(() => {
      try { proc.kill('SIGTERM'); } catch { /* ignore */ }
      reject(err);
    });

    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (chunk) => {
      stdoutBuf += chunk;
      for (const re of patterns) {
        const m = stdoutBuf.match(re);
        if (m) {
          return settle(() => resolve({ proc, url: m[1], stdoutBuf, stderrBuf }));
        }
      }
    });
    proc.stderr.setEncoding('utf8');
    proc.stderr.on('data', (chunk) => {
      stderrBuf += chunk;
    });
    proc.on('error', (err) => fail(new Error(`${label} spawn error: ${err.message}`)));
    proc.on('exit', (code, signal) => {
      if (!settled) {
        fail(new Error(
          `${label} exited before printing URL (code=${code}, signal=${signal})` +
          (stderrBuf ? `\n--- stderr ---\n${stderrBuf}` : '') +
          (stdoutBuf ? `\n--- stdout ---\n${stdoutBuf}` : ''),
        ));
      }
    });

    setTimeout(() => fail(new Error(
      `${label} did not print URL within ${timeoutMs}ms` +
      (stderrBuf ? `\n--- stderr ---\n${stderrBuf}` : '') +
      (stdoutBuf ? `\n--- stdout ---\n${stdoutBuf}` : ''),
    )), timeoutMs);
  });
}

async function killGracefully(proc) {
  if (!proc || proc.killed) return;
  try { proc.kill('SIGTERM'); } catch { /* ignore */ }
  const exited = new Promise((resolve) => {
    if (proc.exitCode !== null) return resolve();
    proc.once('exit', () => resolve());
  });
  const raced = await Promise.race([exited, wait(SHUTDOWN_GRACE_MS).then(() => 'timeout')]);
  if (raced === 'timeout') {
    try { proc.kill('SIGKILL'); } catch { /* ignore */ }
  }
}

// Kill an adopted process we don't have a ChildProcess handle for (post-restart
// reconcile path). SIGTERM, then SIGKILL after the grace window. We can't await
// an `exit` event on a non-child, so we poll liveness via signal-0.
async function killByPid(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return;
  try { process.kill(pid, 'SIGTERM'); } catch { return; /* already gone */ }
  const deadline = Date.now() + SHUTDOWN_GRACE_MS;
  while (Date.now() < deadline) {
    await wait(100);
    try { process.kill(pid, 0); } catch { return; /* exited */ }
  }
  try { process.kill(pid, 'SIGKILL'); } catch { /* ignore */ }
}

async function killEntry(entry) {
  const tasks = [];
  if (entry.appProcess) tasks.push(killGracefully(entry.appProcess));
  else if (entry.appPid) tasks.push(killByPid(entry.appPid));
  if (entry.sidecarProcess) tasks.push(killGracefully(entry.sidecarProcess));
  else if (entry.sidecarPid) tasks.push(killByPid(entry.sidecarPid));
  await Promise.all(tasks);
}

// ── sidecar tool discovery (via the bearer-authenticated MCP) ────────────

async function discoverSidecarTools(mcpUrl, bearer) {
  const res = await fetch(mcpUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  });
  if (!res.ok) throw new Error(`sidecar tools/list returned ${res.status}`);
  const body = await res.json();
  if (!body?.result?.tools) {
    throw new Error('sidecar tools/list response missing result.tools');
  }
  return body.result.tools;
}

// ── public API ───────────────────────────────────────────────────────────

export const RunnerEngine = {
  name: 'local',
  capabilities: ['start_app', 'stop_app', 'status_app', 'list_running', 'env'],

  list() {
    return Array.from(running.entries()).map(([runningRef, app]) => ({
      runningRef,
      artifactRef: app.artifactRef,
      url: app.url,
      mcpUrl: app.mcpUrl,
      startedAt: app.startedAt,
      status: app.status,
      adopted: app.adopted === true,
    }));
  },

  status(runningRef) {
    const app = running.get(runningRef);
    if (!app) return { status: 'unknown', runningRef };
    return {
      runningRef,
      status: app.status,
      url: app.url,
      mcpUrl: app.mcpUrl,
      artifactRef: app.artifactRef,
      startedAt: app.startedAt,
      adopted: app.adopted === true,
    };
  },

  /**
   * Start an app + its sidecar atomically. Both processes come up or neither.
   *
   * @param {object} opts
   * @param {string} opts.artifactRef    — absolute path to the app's artifact directory.
   * @param {string} opts.appName        — used by installScaffold when (re)materializing the sidecar.
   * @param {string} opts.materializationRef — used by installScaffold.
   * @param {string} [opts.declaredPurpose]
   * @param {string} [opts.serverName]   — inventory `server` value. Defaults to appName.
   * @param {number} [opts.timeoutMs]    — startup timeout override (default 10s).
   */
  async start({
    artifactRef,
    appName,
    materializationRef,
    declaredPurpose,
    serverName,
    timeoutMs = STARTUP_TIMEOUT_MS,
  }) {
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

    // Idempotent scaffold materialization. Picks up an existing bearer from
    // .env or mints a new one. We need the bearer either way to authenticate
    // against the sidecar after spawn.
    installScaffold({
      targetDir: artifactRef,
      appName,
      materializationRef,
      declaredPurpose,
    });

    const { values: envVars } = readEnv(artifactRef);
    const bearer = envVars.APP_MCP_BEARER;
    if (!bearer) {
      throw new Error('APP_MCP_BEARER missing from .env after installScaffold — bearer policy broken');
    }

    const childEnv = {
      ...process.env,
      ...envVars,
      APP_MCP_BEARER: bearer,
      APP_MCP_PORT: '0',
      APP_MCP_HOST: '127.0.0.1',
    };

    // Sidecar first so we confirm scaffold integrity before the heavier SPA.
    let sidecarProc = null;
    let appProc = null;
    let sidecarUrl = null;
    let appUrl = null;
    try {
      const sidecar = await spawnAndWaitForUrl({
        command: process.execPath, // node
        args: ['server.js'],
        cwd: join(artifactRef, 'app-mcp'),
        env: childEnv,
        label: 'sidecar',
        patterns: [SIDECAR_URL_PATTERN],
        timeoutMs,
      });
      sidecarProc = sidecar.proc;
      sidecarUrl = sidecar.url;

      const app = await spawnAndWaitForUrl({
        command: 'npm',
        args: ['start'],
        cwd: artifactRef,
        env: childEnv,
        label: 'app',
        patterns: APP_URL_PATTERNS,
        timeoutMs,
      });
      appProc = app.proc;
      appUrl = app.url;
    } catch (err) {
      await Promise.all([killGracefully(sidecarProc), killGracefully(appProc)]);
      throw err;
    }

    // Discover the sidecar's tools so we can push them into inventory. Soft
    // failure — the sidecar is running, describe_app still works, inventory
    // just loses the agent-extended tools until the next start cycle.
    let inventoryTools = [];
    try {
      const tools = await discoverSidecarTools(sidecarUrl, bearer);
      inventoryTools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        introspectionConfidence: 'tools_list_full',
      }));
    } catch (err) {
      console.warn(`[runner-engine] sidecar tool discovery failed: ${err.message}`);
    }

    const runningRef = newRunningRef();
    const effectiveServerName = (serverName || appName).trim();

    if (inventoryTools.length > 0) {
      InventoryRepository.addAppInventory({
        server: effectiveServerName,
        tools: inventoryTools,
        runningRef,
      });
    }

    // Wire crash detection. If either process exits unexpectedly, flip status.
    // We do NOT auto-remove from inventory on crash — the orphan state is
    // observable (and reconcile sweeps it on the next daemon boot).
    const onAppExit = (code, signal) => {
      const app = running.get(runningRef);
      if (app) {
        app.status = 'crashed';
        app.crashInfo = { side: 'app', code, signal };
      }
    };
    const onSidecarExit = (code, signal) => {
      const app = running.get(runningRef);
      if (app) {
        app.status = 'crashed';
        app.crashInfo = { side: 'sidecar', code, signal };
      }
    };
    appProc.once('exit', onAppExit);
    sidecarProc.once('exit', onSidecarExit);

    const state = {
      artifactRef,
      appName: appName.trim(),
      materializationRef,
      serverName: effectiveServerName,
      appProcess: appProc,
      sidecarProcess: sidecarProc,
      appPid: appProc.pid,
      sidecarPid: sidecarProc.pid,
      url: appUrl,
      mcpUrl: sidecarUrl,
      bearer,
      startedAt: Date.now(),
      status: 'running',
      adopted: false,
    };
    running.set(runningRef, state);

    // Durable record — written AFTER inventory so a crash between the two
    // leaves at most an orphan inventory row (which reconcile sweeps), never a
    // pidfile pointing at processes with no inventory.
    writePidfile({
      runningRef,
      appPid: state.appPid,
      sidecarPid: state.sidecarPid,
      url: appUrl,
      sidecarUrl,
      bearer,
      artifactRef,
      appName: state.appName,
      serverName: effectiveServerName,
      materializationRef,
      startedAt: state.startedAt,
    });

    return {
      runningRef,
      url: appUrl,
      mcpUrl: sidecarUrl,
      bearer,
      inventoryToolsRegistered: inventoryTools.length,
    };
  },

  /**
   * Stop both processes, remove inventory entries + pidfile, drop from the
   * Map. Idempotent — stopping an unknown runningRef returns
   * { stopped: false }. Handles both spawned (ChildProcess handle) and adopted
   * (pid-only) entries.
   */
  async stop(runningRef) {
    const app = running.get(runningRef);
    if (!app) return { stopped: false, reason: 'unknown_running_ref' };

    // Drop exit listeners we attached in start() so they don't flip status to
    // 'crashed' on intentional shutdown. (No-op for adopted, pid-only entries.)
    if (app.appProcess) app.appProcess.removeAllListeners('exit');
    if (app.sidecarProcess) app.sidecarProcess.removeAllListeners('exit');

    await killEntry(app);

    InventoryRepository.removeAppInventory(runningRef);
    removePidfile(runningRef);
    running.delete(runningRef);

    return { stopped: true };
  },

  /**
   * Re-register a run from a reconcile-validated pidfile record without
   * spawning. Used by reconcile-on-boot when the sidecar of a pre-restart app
   * still answers. The processes are NOT this daemon's children, so they're
   * tracked by pid only — `stop()` signals them via killByPid, status stays
   * last-known until the next reconcile.
   */
  adopt(record) {
    if (!record || typeof record.runningRef !== 'string') {
      throw new Error('adopt requires a pidfile record with a runningRef');
    }
    running.set(record.runningRef, {
      artifactRef: record.artifactRef,
      appName: record.appName,
      materializationRef: record.materializationRef,
      serverName: record.serverName,
      appProcess: null,
      sidecarProcess: null,
      appPid: record.appPid,
      sidecarPid: record.sidecarPid,
      url: record.url,
      mcpUrl: record.sidecarUrl,
      bearer: record.bearer,
      startedAt: record.startedAt,
      status: 'running',
      adopted: true,
    });
    return { adopted: true, runningRef: record.runningRef };
  },

  // Test seam — kill everything and clear the Map. Pidfiles/inventory are left
  // to the caller (tests run against :memory: + a temp MOJULO_HOME).
  _reset() {
    for (const app of running.values()) {
      try { app.appProcess?.kill('SIGKILL'); } catch { /* ignore */ }
      try { app.sidecarProcess?.kill('SIGKILL'); } catch { /* ignore */ }
    }
    running.clear();
  },
};
