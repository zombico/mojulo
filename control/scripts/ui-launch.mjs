/**
 * Starts the mojulo dashboard (the "operations bridge") from a Next.js standalone build, and finds
 * the dashboard package beside core.
 *
 * The standalone build ships in its own npm package (lib/version/ui-package.js has its name). Two
 * callers start it through startDashboard: that package's bin, with its standalone/, and core's
 * `mojulo-ui` shim for a repo checkout that ran `next build`
 * (control/.next/standalone). The code lives in core and the dashboard package depends on core's
 * exact version, so both callers run the same launcher.
 *
 * Binds to 127.0.0.1 only: the control plane is single-user and self-hosted, and the auth
 * middleware is opt-in. The bind host is set UNCONDITIONALLY (`MOJULO_UI_HOST` is the one
 * override): Linux containers and many shells export `HOSTNAME=<machine>`, and the standalone
 * server reads that variable as its bind address, so a `??=` let it bind to the container hostname
 * and refuse 127.0.0.1 (the 2026-09-21 Grok sandbox report).
 */

import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { resolveMojuloPaths } from './mojulo-paths.mjs';
import { UI_PACKAGE_BIN, UI_PACKAGE_NAME } from '../lib/version/ui-package.js';

/** The core package root: this file is <root>/scripts/ui-launch.mjs. */
export const CONTROL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const UI_USAGE = [
  'Usage: mojulo-ui [--port <n>] [--no-open]',
  '',
  'Boots the mojulo dashboard on 127.0.0.1 and opens the browser.',
  'Shares ~/.mojulo/ state with the `mojulo` stdio MCP server.',
  '',
].join('\n');

function parsePort(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 65535 && String(parsed) === String(value).trim()
    ? parsed
    : null;
}

/**
 * Parse the dashboard's arguments. Returns `{ port, open, help }`, or `{ error }` for an argument
 * it does not know, so a caller can forward exactly these flags and nothing else.
 */
export function parseUiArgs(argv) {
  const args = { port: null, open: true, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    let value = null;
    if (arg === '--port' || arg === '-p') value = argv[++i];
    else if (arg.startsWith('--port=')) value = arg.slice('--port='.length);
    else if (arg === '--no-open') {
      args.open = false;
      continue;
    } else if (arg === '-h' || arg === '--help') {
      args.help = true;
      continue;
    } else return { error: `unknown arg "${arg}"` };
    const port = parsePort(value ?? '');
    if (port === null) return { error: `invalid --port "${value}"` };
    args.port = port;
  }
  return args;
}

/** The flags that reproduce parsed arguments, for handing them to another process. */
export function uiArgsToArgv(args) {
  return [...(args.port ? ['--port', String(args.port)] : []), ...(args.open ? [] : ['--no-open'])];
}

/** Read a package.json, or null when it is missing or unreadable. */
export function readPackageJson(dir) {
  try {
    return JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Find the dashboard package at exactly `version`, resolving it the way Node would from each
 * directory in `from` (so a sibling in the same node_modules is found from the core root).
 * Returns `{ root, bin }` for a match, or `{ root: null, mismatched: [{ root, version }] }`.
 */
export function findUiPackage({ version, from = [CONTROL_DIR] }) {
  const mismatched = [];
  const seen = new Set();
  for (const dir of from) {
    let manifestPath;
    try {
      manifestPath = createRequire(path.join(dir, 'noop.js')).resolve(`${UI_PACKAGE_NAME}/package.json`);
    } catch {
      continue;
    }
    const root = path.dirname(manifestPath);
    if (seen.has(root)) continue;
    seen.add(root);
    const pkg = readPackageJson(root);
    const binRel = typeof pkg?.bin === 'string' ? pkg.bin : pkg?.bin?.[UI_PACKAGE_BIN];
    if (pkg?.version !== version || !binRel) {
      mismatched.push({ root, version: pkg?.version ?? null });
      continue;
    }
    return { root, bin: path.join(root, binRel) };
  }
  return { root: null, mismatched };
}

/** A repo checkout's own `next build`, which the shim runs when no dashboard package is installed. */
export const LOCAL_STANDALONE = path.join(CONTROL_DIR, '.next', 'standalone', 'server.js');

/**
 * How `mojulo-ui` starts the dashboard at `version`: the package beside core (`package`, with its
 * bin), a repo checkout's build (`local-build`), or a download with npm exec (`fetch`, with any
 * dashboard package found at another version).
 *
 * Only core's own install is searched, never the working directory: a `node_modules/mojulo-ui`
 * planted in whatever tree the command runs from (a cloned repo, an unpacked archive) would
 * otherwise be imported, since a matching version string is all findUiPackage checks. A real
 * install loses nothing, because mojulo-ui pins mojulo at its exact version, so any tree holding
 * the dashboard holds this core beside it.
 */
export function locateDashboard({ version, from = [CONTROL_DIR] }) {
  const found = findUiPackage({ version, from });
  if (found.root) return { source: 'package', bin: found.bin };
  if (existsSync(LOCAL_STANDALONE)) return { source: 'local-build', standaloneServer: LOCAL_STANDALONE };
  return { source: 'fetch', mismatched: found.mismatched };
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

async function defaultOpenUrl(url) {
  const { default: open } = await import('open');
  await open(url);
}

/**
 * Start the dashboard. Sets the env the standalone server reads, then imports its server.js,
 * which chdirs into the build and listens; this call does not return while it runs.
 *
 * @param {object} opts
 * @param {string} opts.standaloneServer — the build's server.js
 * @param {string[]} opts.argv — the dashboard's arguments (see UI_USAGE)
 * @param {(url: string) => Promise<void>} [opts.openUrl] — opens the browser; the dashboard
 *   package passes one that resolves `open` from its own dependencies
 */
export async function startDashboard({ standaloneServer, argv, openUrl = defaultOpenUrl }) {
  const args = parseUiArgs(argv);
  if (args.error) {
    process.stderr.write(`mojulo-ui: ${args.error}\n`);
    process.exit(2);
  }
  if (args.help) {
    process.stdout.write(UI_USAGE);
    process.exit(0);
  }

  if (!existsSync(standaloneServer)) {
    process.stderr.write(
      `mojulo-ui: standalone bundle missing at ${standaloneServer}.\n`
        + 'If running from source, build it first: npm run build (inside control/).\n',
    );
    process.exit(1);
  }

  // User data lives under MOJULO_HOME (default ~/.mojulo). This populates SQLITE_PATH /
  // STORAGE_ROOT / MOJULO_OUTCOMES_DIR / MOJULO_EXPORTS_DIR / MOJULO_MODELS_DIR so
  // the lib code lands user state there instead of standalone-cwd-relative ./data/. Must run
  // before the standalone server import: route handlers read these when modules first evaluate.
  resolveMojuloPaths();

  // Packaged-asset anchor for moduleDir (lib/module-dir.js). The webpack build inlines each lib
  // module's import.meta.url as a LITERAL build-machine path, so the standalone bundle cannot find
  // vocab cards / catalysts / templates on any other host (and throws ERR_INVALID_FILE_URL_PATH on
  // Windows). The core package ships the complete lib/ tree, so resources resolve from it, and
  // lazily loaded packages resolve from its install too (lib/motion/glyph-carver.js).
  process.env.MOJULO_CONTROL_DIR ??= CONTROL_DIR;

  // The docs (and every mojulo surface that prints a dashboard URL) say 3001: prefer it, fall
  // back to an OS-assigned free port only when it's taken.
  const port = args.port ?? ((await portIsFree(3001)) ? 3001 : await findFreePort());
  process.env.PORT = String(port);
  // Loopback only; an unconditional assignment, never a `??=` default (see the header).
  const host = process.env.MOJULO_UI_HOST || '127.0.0.1';
  process.env.HOSTNAME = host;

  const url = `http://${host}:${port}`;

  // Same overlap rationale as mcp-stdio.mjs: a no-op without the recall install group; with it,
  // the embedder load (~130MB cold) is the longest single step of the first vector search, so
  // start it in the background while the user scans the dashboard. Failures surface at first
  // use; don't crash the UI. pathToFileURL, not the bare path: on Windows a raw `C:\...`
  // specifier is parsed as URL protocol `c:` and the ESM loader rejects it.
  import(pathToFileURL(path.join(CONTROL_DIR, 'lib', 'embedder', 'local.js')).href)
    .then(({ preloadModel }) => preloadModel?.())
    .catch((err) => {
      process.stderr.write(`[mojulo-ui] embedder preload failed: ${err.message || err}\n`);
    });

  process.stdout.write(`mojulo-ui: starting on ${url}\n`);
  // A fresh install always lands in English (the locale is a per-browser NEXT_LOCALE cookie, no
  // Accept-Language sniffing), so say here that the UI speaks their language and where to switch.
  process.stdout.write(
    'mojulo-ui: the dashboard ships in ~two dozen languages (incl. RTL) — switch in Settings → Language.\n',
  );

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => process.exit(0));
  }

  if (args.open) {
    // Fire-and-forget; don't block the server boot on the browser.
    openUrl(url).catch((err) => {
      process.stderr.write(`mojulo-ui: could not open browser (${err.message || err}). Visit ${url} manually.\n`);
    });
  }

  // The standalone server.js is CJS and does `process.chdir(__dirname)` at evaluation time. All
  // env vars must be set above this line.
  await import(pathToFileURL(standaloneServer).href);
}
