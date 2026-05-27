/**
 * Local runner — spawns an app + its scaffolded MCP sidecar as a pair, with
 * port allocation, env-file management, and inventory auto-declaration.
 *
 * The runner is the operational layer beneath the runner MCP tools
 * (`start_app`, `stop_app`, etc.). One singleton instance per control-plane
 * process. State is in-memory only — a control-plane restart loses tracking
 * of running apps; the OS still holds them, the operator stops them
 * manually. This is the spike's accepted posture; persistent runtime
 * tracking is a post-spike concern.
 *
 * Atomicity contract: `start(artifactRef)` brings up BOTH processes or
 * neither. If either fails to come up within `STARTUP_TIMEOUT_MS`, the
 * other is killed and the call throws.
 *
 * The sidecar's URL is parsed from its stdout (the scaffold prints
 * `APP_MCP_URL=...` on a dedicated line). The app's URL is parsed from
 * EITHER an `APP_URL=...` convention OR Vite's `Local:   http://...` line,
 * whichever shows up first.
 *
 * See lite-template/integration/app-system/APP_SPIKE_B_RUNNER_AND_SCHEMA_PLAN.md.
 */

import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { installScaffold } from '@/lib/app-mcp-scaffold/install';
import { InventoryRepository } from '@/lib/db/repositories/mcp-inventory';

const STARTUP_TIMEOUT_MS = 10_000;
const SHUTDOWN_GRACE_MS = 1_500;
const APP_URL_PATTERNS = [
  /^APP_URL=(\S+)$/m,
  // Vite's default: "  Local:   http://localhost:5173/"
  /^\s*Local:\s+(https?:\/\/\S+)/m,
];
const SIDECAR_URL_PATTERN = /^APP_MCP_URL=(\S+)$/m;

// In-memory state. Keyed on running_ref. Value shape:
//   { artifactRef, appProcess, sidecarProcess, url, mcpUrl, bearer,
//     startedAt, status }
const running = new Map();

function newRunningRef() {
  // Short, URL-safe, prefix-tagged so refs are distinguishable in logs and
  // inventory rows from other id schemes (dep-, prov-, etc.).
  return `run-${randomBytes(8).toString('hex')}`;
}

// ── .env handling ────────────────────────────────────────────────────────
//
// Minimal parser/serializer. Quoted values are unwrapped on read and
// preserved on write. Comments and blank lines round-trip via the
// representation: we keep raw lines for unknown content and only touch
// `KEY=value` lines on set/delete. This keeps an operator-edited .env's
// comments intact across set_env calls.

function parseEnvFile(text) {
  const entries = [];
  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine;
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      entries.push({ kind: 'raw', line });
      continue;
    }
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) {
      entries.push({ kind: 'raw', line });
      continue;
    }
    let value = m[2];
    // Strip a single layer of matching quotes if present.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries.push({ kind: 'kv', key: m[1], value });
  }
  return entries;
}

function serializeEnvFile(entries) {
  const out = [];
  for (const e of entries) {
    if (e.kind === 'raw') out.push(e.line);
    else out.push(`${e.key}=${e.value}`);
  }
  // Preserve trailing newline only if the original ended with one. Caller
  // doesn't see this distinction; we just want round-trip stability.
  return out.join('\n');
}

function readEnv(artifactDir) {
  const envPath = join(artifactDir, '.env');
  if (!existsSync(envPath)) return { envPath, entries: [], values: {} };
  const text = readFileSync(envPath, 'utf8');
  const entries = parseEnvFile(text);
  const values = {};
  for (const e of entries) {
    if (e.kind === 'kv') values[e.key] = e.value;
  }
  return { envPath, entries, values };
}

function writeEnv(envPath, entries) {
  let text = serializeEnvFile(entries);
  if (!text.endsWith('\n')) text += '\n';
  writeFileSync(envPath, text);
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

export const LocalRunner = {
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
   * @param {string} [opts.serverName]   — inventory `server` value for the app's MCP entry. Defaults to appName.
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

    // Idempotent scaffold materialization. Picks up an existing bearer
    // from .env or mints a new one. We need the bearer either way so the
    // runner can authenticate against the sidecar after spawn.
    installScaffold({
      targetDir: artifactRef,
      appName,
      materializationRef,
      declaredPurpose,
    });

    // Read the bearer + any other env the operator set. We pass them all
    // into both child processes so the SPA also has access to .env vars
    // (the SPA's npm start may need them).
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

    // Spawn the sidecar first so we can confirm scaffold integrity before
    // the (heavier) SPA process kicks off. If the sidecar fails, the SPA
    // never starts — saves teardown work on the common failure mode.
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
      // Atomic rollback: kill whichever side came up.
      await Promise.all([killGracefully(sidecarProc), killGracefully(appProc)]);
      throw err;
    }

    // Discover the sidecar's tools so we can push them into inventory.
    // If discovery fails, treat as a soft failure — the sidecar is running,
    // describe_app still works, but inventory loses the agent-extended
    // tools until the next start cycle.
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
      console.warn(`[local-runner] sidecar tool discovery failed: ${err.message}`);
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

    // Wire crash detection. If either process exits unexpectedly, flip the
    // status field. We do NOT auto-remove from inventory on crash — the
    // orphan state is observable, which is the spike's accepted posture.
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
      url: appUrl,
      mcpUrl: sidecarUrl,
      bearer,
      startedAt: Date.now(),
      status: 'running',
    };
    running.set(runningRef, state);

    return {
      runningRef,
      url: appUrl,
      mcpUrl: sidecarUrl,
      bearer,
      inventoryToolsRegistered: inventoryTools.length,
    };
  },

  /**
   * Stop both processes (SIGTERM, SIGKILL fallback), remove inventory
   * entries, drop from the in-memory map. Idempotent — calling stop on an
   * unknown runningRef returns { stopped: false }.
   */
  async stop(runningRef) {
    const app = running.get(runningRef);
    if (!app) return { stopped: false, reason: 'unknown_running_ref' };

    // Remove exit listeners we attached in start() so they don't flip
    // status to 'crashed' on intentional shutdown.
    app.appProcess.removeAllListeners('exit');
    app.sidecarProcess.removeAllListeners('exit');

    await Promise.all([
      killGracefully(app.appProcess),
      killGracefully(app.sidecarProcess),
    ]);

    InventoryRepository.removeAppInventory(runningRef);
    running.delete(runningRef);

    return { stopped: true };
  },

  // ── env management ─────────────────────────────────────────────────────

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

  // Test seam — reset in-memory state between vitest cases.
  _reset() {
    for (const app of running.values()) {
      try { app.appProcess.kill('SIGKILL'); } catch { /* ignore */ }
      try { app.sidecarProcess.kill('SIGKILL'); } catch { /* ignore */ }
    }
    running.clear();
  },
};
