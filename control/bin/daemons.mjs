#!/usr/bin/env node
/**
 * mojulo-daemons — unified runtime daemon host.
 *
 * Starts the scheduler + app-runtime daemons behind a single loopback HTTP
 * surface so MCP can lifecycle them consistently. Gated by MOJULO_DAEMONS so
 * operators opt in explicitly; per-daemon overrides are honored via
 * MOJULO_TRIGGER_RUNTIME / MOJULO_APP_RUNTIME.
 */

import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveMojuloPaths } from '../scripts/mojulo-paths.mjs';

register('../scripts/mcp-stdio-loader.mjs', import.meta.url);

const v = process.env.MOJULO_DAEMONS;
if (!v || v === 'disabled') {
  process.stderr.write(
    'mojulo-daemons: MOJULO_DAEMONS is not enabled — nothing to do.\n' +
      'Set MOJULO_DAEMONS=enabled to start the host. See docs/app-runtime.md.\n',
  );
  process.exit(0);
}
if (v !== 'enabled') {
  process.stderr.write(
    `mojulo-daemons: MOJULO_DAEMONS='${v}' not recognized; expected 'enabled' or 'disabled'.\n`,
  );
  process.exit(2);
}

resolveMojuloPaths();

const CONTROL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(CONTROL_DIR);

process.on('uncaughtException', (err) => {
  process.stderr.write(`[daemons] uncaughtException (surviving): ${err?.stack || err}\n`);
});
process.on('unhandledRejection', (reason) => {
  process.stderr.write(`[daemons] unhandledRejection (surviving): ${reason}\n`);
});

const { startDaemonHostServer } = await import('@/lib/daemons/server');

let handle;
try {
  handle = await startDaemonHostServer();
} catch (err) {
  process.stderr.write(`mojulo-daemons: failed to start: ${err?.stack || err}\n`);
  process.exit(1);
}

process.stdout.write(`mojulo-daemons: listening on http://127.0.0.1:${handle.port}\n`);
process.stdout.write(
  '[daemons] tip: for crash-restart, run under launchd (macOS) or a systemd ' +
    'user unit (Linux). See docs/app-runtime.md.\n',
);

let shuttingDown = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    handle.close().finally(() => process.exit(0));
  });
}
