#!/usr/bin/env node
/**
 * mojulo-app-runtime — the standalone app-runtime daemon.
 *
 * Sibling to the trigger scheduler in posture, but a standalone process with its
 * own crash domain, env gate, bearer, and port file. The unified daemon host
 * (`mojulo-daemons`) can run both together; this bin remains the standalone
 * option. Promotes the in-process runner to a daemon so app lifecycle survives
 * a control-plane restart: on boot it reconciles the pidfiles + inventory rows
 * it left behind, then serves the loopback HTTP API the MCP `start_app` /
 * `stop_app` tools call.
 *
 * Usage:
 *   MOJULO_APP_RUNTIME=enabled node control/bin/app-runtime.js
 *   MOJULO_APP_RUNTIME=enabled npx -y -p mojulo mojulo-app-runtime
 *
 * Gating is symmetric with MOJULO_TRIGGER_RUNTIME: without the opt-in the bin
 * is a no-op so an operator who hasn't configured automation doesn't get a
 * background daemon. The control plane NEVER spawns this — if the daemon is
 * down, start_app returns a clear error pointing here (Phase 2 hands keep-alive
 * to launchd / systemd).
 *
 * Shares ~/.mojulo/ state with the other bins via scripts/mojulo-paths.mjs, and
 * resolves `@/...` imports through the same loader the stdio bin uses.
 */

import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveMojuloPaths } from '../scripts/mojulo-paths.mjs';

// Resolve `@/...` like Next.js / the stdio bin do, so the daemon can import the
// same engine + repository modules the Next.js routes use.
register('../scripts/mcp-stdio-loader.mjs', import.meta.url);

const v = process.env.MOJULO_APP_RUNTIME;
if (!v || v === 'disabled') {
  process.stderr.write(
    'mojulo-app-runtime: MOJULO_APP_RUNTIME is not enabled — nothing to do.\n' +
      'Set MOJULO_APP_RUNTIME=enabled to start the daemon. See docs/app-runtime.md.\n',
  );
  process.exit(0);
}
if (v !== 'enabled') {
  process.stderr.write(
    `mojulo-app-runtime: MOJULO_APP_RUNTIME='${v}' not recognized; expected 'enabled' or 'disabled'.\n`,
  );
  process.exit(2);
}

// Seed MOJULO_HOME / SQLITE_PATH / etc so the daemon hits the SAME SQLite the
// control plane uses. Honors explicit overrides (e.g. dev pointing at
// control/data) exactly like the other bins.
resolveMojuloPaths();

// chdir to control/ for any packaged-asset path the lib still reads from cwd
// (mirrors mcp-stdio.mjs). artifact_ref is always absolute, so this never
// affects app spawning.
const CONTROL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(CONTROL_DIR);

// A crashing app must not take the daemon down. Children already surface as
// 'exit' events (handled in the engine), but log-and-survive any stray throw.
process.on('uncaughtException', (err) => {
  process.stderr.write(`[app-runtime] uncaughtException (surviving): ${err?.stack || err}\n`);
});
process.on('unhandledRejection', (reason) => {
  process.stderr.write(`[app-runtime] unhandledRejection (surviving): ${reason}\n`);
});

const { startDaemonServer } = await import('@/lib/runners/daemon/server');

let handle;
try {
  handle = await startDaemonServer();
} catch (err) {
  process.stderr.write(`mojulo-app-runtime: failed to start: ${err?.stack || err}\n`);
  process.exit(1);
}

process.stdout.write(`mojulo-app-runtime: listening on http://127.0.0.1:${handle.port}\n`);

// Phase 2 hint: without an OS supervisor the daemon is just a process that can
// die. Point the operator at the recipe; don't try to supervise ourselves.
process.stdout.write(
  '[app-runtime] tip: for crash-restart, run under launchd (macOS) or a systemd ' +
    'user unit (Linux). See docs/app-runtime.md.\n',
);

// On signal: close the HTTP server and exit, but DO NOT kill the running apps —
// they survive as reparented processes and get re-adopted by reconcile on the
// next boot. That's the whole point of the daemon promotion.
let shuttingDown = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    handle.close().finally(() => process.exit(0));
  });
}
