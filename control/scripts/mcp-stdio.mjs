#!/usr/bin/env node
/**
 * Stdio MCP transport for the control plane.
 *
 * One process per MCP connection (the client spawns this and communicates over
 * stdin/stdout). Newline-delimited JSON-RPC 2.0 frames; logs go to stderr only
 * because stdout is the protocol channel.
 *
 * Usage:
 *   claude mcp add mojulo --command "node /abs/path/to/control/scripts/mcp-stdio.mjs"
 *
 * This is the working-tree entry referenced in §12 Milestone 1 of
 * [lite-template/integration/npx_package_release_plan.md]. The npm package
 * (§12 Milestone 3) will ship a bundled equivalent as `bin/mojulo-mcp`.
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import readline from 'node:readline';
import { resolveMojuloPaths } from './mojulo-paths.mjs';

// Node floor — checked before anything version-sensitive loads. `register`
// from node:module (below, dynamic for this reason) doesn't exist before
// 20.6, so a static import of it would crash old Nodes with a cryptic
// missing-export error before this message could print. Stderr, not stdout:
// in server mode stdout is the MCP protocol channel.
//
// The floor stays 22.12 for a published-instance reason: package.json now
// declares `"type": "module"` (so lib/'s ESM `.js` loads without Node's
// module-syntax detection or its reparse warning), but installs that predate
// that field rely on detection, which is only on by default from Node
// >=22.12 / >=23. Keeping the floor means one supported matrix either way.
const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
if (nodeMajor < 22 || (nodeMajor === 22 && nodeMinor < 12)) {
  process.stderr.write(
    `mojulo needs Node.js 22.12 or newer — this is Node ${process.versions.node}.\n` +
      `Install the current LTS from https://nodejs.org (or ask your coding agent\n` +
      `to install it), then re-run: npx mojulo init\n`
  );
  process.exit(1);
}
const { register } = await import('node:module');

// `npx mojulo init` — one-shot installer. Branch out BEFORE this process
// configures itself as an stdio MCP server (register loader, chdir, the
// stdout→stderr pin, tool registration, embedder preload). mcp-init.mjs is
// self-contained and interactive — it owns real stdout — and exits itself;
// the guard exit here is a belt-and-suspenders no-fallthrough.
if (process.argv[2] === 'init') {
  await import('./mcp-init.mjs');
  process.exit(0);
}

// `mojulo install <creative|recall|chatbot>` — on-demand capability-pack installer. Branch
// out here for the same reason as `init`: it runs `npm install` for the creative
// optional deps and needs neither the @/ loader nor the tool registry. Self-
// contained and exits itself; the guard exit is belt-and-suspenders.
if (process.argv[2] === 'install') {
  await import('./mcp-install.mjs');
  process.exit(0);
}

// `mojulo --help|-h|help` and `mojulo --version|-v` — answered here, before
// the loader, paths, chdir and console pin, so a stranger's first
// `npx mojulo --help` prints usage at once and never falls through to
// stdio-server mode (which waits on stdin and, when it closes, exits with no
// output at all). Bare `help` with no tool name means the same thing; `help
// <tool|pack>` still goes to the CLI below. mcp-cli.mjs has no static
// imports, so USAGE is safe to read before `register()`.
const firstArg = process.argv[2];
if (firstArg === '--help' || firstArg === '-h' || (firstArg === 'help' && process.argv.length === 3)) {
  const { USAGE } = await import('./mcp-cli.mjs');
  process.stdout.write(`${USAGE}\n`);
  process.exit(0);
}
if (firstArg === '--version' || firstArg === '-v') {
  const { readFileSync } = await import('node:fs');
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  process.stdout.write(`mojulo ${version}\n`);
  process.exit(0);
}

// Resolve `@/...` like Next.js does, so the stdio entry can reuse the same
// server.js + tool modules the Next.js route uses.
register('./mcp-stdio-loader.mjs', import.meta.url);

// User data lives under MOJULO_HOME (default ~/.mojulo). This populates
// SQLITE_PATH / ARTIFACTS_DIR / STORAGE_ROOT / MOJULO_OUTCOMES_DIR /
// MOJULO_EXPORTS_DIR / MOJULO_MODELS_DIR so the lib
// code lands user state there instead of a cwd-relative ./data/.
resolveMojuloPaths();

// chdir to control/ for packaged-asset paths the lib still reads from cwd,
// and export the package root for moduleDir (lib/module-dir.js) — the
// env-first anchor that keeps bundled lib code (the standalone UI) off the
// build machine's baked import.meta.url paths. Raw-lib runs like this one
// don't strictly need it, but every bin exporting it keeps resolution uniform.
const CONTROL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.MOJULO_CONTROL_DIR ??= CONTROL_DIR;
process.chdir(CONTROL_DIR);

// Stdout is the MCP protocol channel — any stray log corrupts the frame
// stream. Several tool executors and the composer emit progress via
// console.log; pin those to stderr for the stdio process only. The Next.js
// route is unaffected.
console.log = console.error;
console.info = console.error;

// `npx mojulo tools|packs|help <name>|call|pack_* …` — the CLI front door (P1+P2 of
// [mojulo-cli.plan.md]). Branches AFTER the loader/paths/chdir/console pin
// (the CLI reuses the same `@/` resolution and data layout, and wants stray
// tool logs on stderr — its own output writes to process.stdout directly)
// but BEFORE the embedder preload: a spot-check command must not kick off a
// 113MB model fetch. Explicit allowlist plus the pack_ prefix — any other
// argv falls through to stdio-server mode exactly as before; these names
// (and the pack_ prefix) are now reserved words on the bin.
// `mojulo script <name> [args…]` — run one of the shipped worker scripts from the package
// root, so the floor-plan card's `node scripts/bake-world-gi.mjs …` has a door on an install
// where scripts/ sits inside the npx cache (house-compose-language). Allowlisted to the
// three that ship in `files`; the child inherits stdio and the paths env resolved above.
// `script` is one more reserved word on the bin.
const SCRIPT_COMMANDS = ['bake-world-gi', 'blender-bake', 'export-blender'];
if (process.argv[2] === 'script') {
  const name = process.argv[3];
  if (!SCRIPT_COMMANDS.includes(name)) {
    process.stderr.write(`Usage: mojulo script <${SCRIPT_COMMANDS.join('|')}> [args…]\n`);
    process.exit(2);
  }
  const { spawn } = await import('node:child_process');
  const child = spawn(process.execPath, [path.join(CONTROL_DIR, 'scripts', `${name}.mjs`), ...process.argv.slice(4)], {
    stdio: 'inherit', cwd: CONTROL_DIR, env: process.env,
  });
  const code = await new Promise((resolve) => child.on('close', resolve));
  process.exit(code ?? 1);
}

const CLI_COMMANDS = new Set(['tools', 'packs', 'help', 'call']);
if (CLI_COMMANDS.has(process.argv[2]) || process.argv[2]?.startsWith('pack_')) {
  const { runCli } = await import('./mcp-cli.mjs');
  process.exit(await runCli(process.argv.slice(2)));
}

const { dispatchMcpRequest, ensureToolsRegistered } = await import('@/lib/mcp/server');
await ensureToolsRegistered();

// Kick off the embedder model load in background — a no-op unless the recall
// install group is present (preloadModel returns at once without it; a default
// install has no runtime and nothing to fetch). With it, the model load (~130MB
// on a cold cache) is the longest single step of the first RAG bot build, and
// starting it now lets it overlap with Claude's initial exchanges. The lazy
// path in lib/embedder/local.js shares promise state, so a tool call arriving
// mid-load simply awaits whatever's left. Failures here surface at first use —
// don't crash the MCP server.
import('@/lib/embedder/local').then(({ preloadModel }) =>
  preloadModel().catch((err) =>
    console.error('[mcp-stdio] embedder preload failed:', err.message)
  )
);

const CONTEXT = { mcpSessionId: 'stdio', userId: 'local' };

function writeFrame(payload) {
  process.stdout.write(JSON.stringify(payload) + '\n');
}

function parseError() {
  return { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } };
}

async function handleLine(line) {
  let body;
  try {
    body = JSON.parse(line);
  } catch {
    writeFrame(parseError());
    return;
  }

  if (Array.isArray(body)) {
    const responses = [];
    for (const msg of body) {
      const resp = await dispatchMcpRequest(msg, CONTEXT);
      if (resp !== null) responses.push(resp);
    }
    if (responses.length > 0) writeFrame(responses);
    return;
  }

  const resp = await dispatchMcpRequest(body, CONTEXT);
  if (resp !== null) writeFrame(resp);
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on('line', (line) => {
  if (!line.trim()) return;
  handleLine(line).catch((err) => {
    console.error('[mcp-stdio] dispatch error:', err);
  });
});

rl.on('close', () => process.exit(0));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => process.exit(0));
}
