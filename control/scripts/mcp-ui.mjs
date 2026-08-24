#!/usr/bin/env node
/**
 * Boots the bundled Next.js dashboard (the "operations bridge").
 *
 * Sibling to [mcp-stdio.mjs](./mcp-stdio.mjs): the stdio bin is what Claude
 * MCP clients spawn; this is what humans run to scan the fleet and act on
 * outcomes. Both share `~/.mojulo/` state via [resolveMojuloPaths](./mojulo-paths.mjs).
 *
 * Usage:
 *   npx -y -p mojulo mojulo-ui                # port 3001 (or next free), opens browser
 *   npx -y -p mojulo mojulo-ui --port 3999    # pin the port
 *   npx -y -p mojulo mojulo-ui --no-open      # skip browser launch
 *
 * Binds to 127.0.0.1 only — the control plane is single-user, self-hosted,
 * and the auth middleware is opt-in. Local-only is the safe default.
 *
 * See [lite-template/integration/UI_PACKAGE_PLAN.md](../../lite-template/integration/UI_PACKAGE_PLAN.md).
 */

import net from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { resolveMojuloPaths } from './mojulo-paths.mjs';

const CONTROL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STANDALONE_SERVER = path.join(CONTROL_DIR, '.next', 'standalone', 'server.js');

function parseArgs(argv) {
  const args = { port: null, open: true };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--port' || arg === '-p') {
      const value = argv[++i];
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) {
        process.stderr.write(`mojulo-ui: invalid --port "${value}"\n`);
        process.exit(2);
      }
      args.port = parsed;
    } else if (arg.startsWith('--port=')) {
      const value = arg.slice('--port='.length);
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) {
        process.stderr.write(`mojulo-ui: invalid --port "${value}"\n`);
        process.exit(2);
      }
      args.port = parsed;
    } else if (arg === '--no-open') {
      args.open = false;
    } else if (arg === '-h' || arg === '--help') {
      process.stdout.write(
        [
          'Usage: mojulo-ui [--port <n>] [--no-open]',
          '',
          'Boots the mojulo dashboard on 127.0.0.1 and opens the browser.',
          'Shares ~/.mojulo/ state with the `mojulo` stdio MCP server.',
          '',
        ].join('\n')
      );
      process.exit(0);
    } else {
      process.stderr.write(`mojulo-ui: unknown arg "${arg}"\n`);
      process.exit(2);
    }
  }
  return args;
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen({ port: 0, host: '127.0.0.1' }, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function portIsFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(false));
    server.listen({ port, host: '127.0.0.1' }, () => server.close(() => resolve(true)));
  });
}

async function openInBrowser(url) {
  try {
    const { default: open } = await import('open');
    await open(url);
  } catch (err) {
    process.stderr.write(
      `mojulo-ui: could not open browser (${err.message || err}). Visit ${url} manually.\n`
    );
  }
}

const args = parseArgs(process.argv.slice(2));

if (!existsSync(STANDALONE_SERVER)) {
  process.stderr.write(
    `mojulo-ui: standalone bundle missing at ${STANDALONE_SERVER}.\n` +
      `If running from source, build it first: npm run build (inside control/).\n`
  );
  process.exit(1);
}

// User data lives under MOJULO_HOME (default ~/.mojulo). This populates
// SQLITE_PATH / ARTIFACTS_DIR / STORAGE_ROOT / MOJULO_MODELS_DIR so the lib
// code lands user state there instead of standalone-cwd-relative ./data/.
// Must fire before the standalone server import — Next route handlers read
// these env vars when modules first evaluate.
resolveMojuloPaths();

// The preview/* routes (wizard iframe + extract + chat) and offline-build
// deployer all read LITE_TEMPLATE_PATH. The stdio bin doesn't need this —
// it doesn't expose preview surfaces — but the UI does. Default to the
// lite-template/ directory staged into the package by stage-lite-template.mjs.
process.env.LITE_TEMPLATE_PATH ??= path.join(CONTROL_DIR, 'lite-template');

// Packaged-asset anchor for moduleDir (lib/module-dir.js). The webpack build
// inlines each lib module's import.meta.url as a LITERAL build-machine path,
// so the standalone bundle cannot locate vocab cards / catalysts / templates
// on any other host (and throws ERR_INVALID_FILE_URL_PATH on Windows). The
// package root ships the complete lib/ tree — resolve resources from it.
process.env.MOJULO_CONTROL_DIR ??= CONTROL_DIR;

// The docs (and every mojulo surface that prints a dashboard URL) say 3001 —
// prefer it, fall back to an OS-assigned free port only when it's taken.
const port = args.port ?? ((await portIsFree(3001)) ? 3001 : await findFreePort());
process.env.PORT = String(port);
// Loopback-only: the control plane is single-user and the auth middleware is
// opt-in. Don't bind to 0.0.0.0 from the npx entry.
process.env.HOSTNAME ??= '127.0.0.1';

const url = `http://127.0.0.1:${port}`;

// Same overlap rationale as mcp-stdio.mjs: first RAG bot build is the iconic
// genesis flow, and the embedder load (~113MB cold) is the longest single
// step. Kick it off in background so the download overlaps with the user
// scanning the dashboard. Failures surface at first use; don't crash the UI.
// pathToFileURL, not the bare path: on Windows a raw `C:\...` specifier is
// parsed as URL protocol `c:` and the ESM loader rejects it outright.
import(pathToFileURL(path.join(CONTROL_DIR, 'lib', 'embedder', 'local.js')).href)
  .then(({ preloadModel }) => preloadModel?.())
  .catch((err) => {
    process.stderr.write(`[mojulo-ui] embedder preload failed: ${err.message || err}\n`);
  });

process.stdout.write(`mojulo-ui: starting on ${url}\n`);
// A fresh install always lands in English — the locale is a per-browser
// NEXT_LOCALE cookie (no Accept-Language sniffing) — so tell the operator
// here that the UI speaks their language and where to switch it.
process.stdout.write(
  'mojulo-ui: the dashboard ships in ~two dozen languages (incl. RTL) — switch in Settings → Language.\n'
);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => process.exit(0));
}

if (args.open) {
  // Fire-and-forget; don't block the server boot on browser launch.
  openInBrowser(url);
}

// Standalone server.js is CJS and does `process.chdir(__dirname)` at
// evaluation time. All env vars must be set above this line.
await import(pathToFileURL(STANDALONE_SERVER).href);
