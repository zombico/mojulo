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

import { register } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import readline from 'node:readline';
import { resolveMojuloPaths } from './mojulo-paths.mjs';

// `npx mojulo init` — one-shot installer. Branch out BEFORE this process
// configures itself as an stdio MCP server (register loader, chdir, the
// stdout→stderr pin, tool registration, embedder preload). mcp-init.mjs is
// self-contained and interactive — it owns real stdout — and exits itself;
// the guard exit here is a belt-and-suspenders no-fallthrough.
if (process.argv[2] === 'init') {
  await import('./mcp-init.mjs');
  process.exit(0);
}

// Resolve `@/...` like Next.js does, so the stdio entry can reuse the same
// server.js + tool modules the Next.js route uses.
register('./mcp-stdio-loader.mjs', import.meta.url);

// User data lives under MOJULO_HOME (default ~/.mojulo). This populates
// SQLITE_PATH / ARTIFACTS_DIR / STORAGE_ROOT / MOJULO_MODELS_DIR so the lib
// code lands user state there instead of a cwd-relative ./data/.
resolveMojuloPaths();

// chdir to control/ for packaged-asset paths the lib still reads from cwd
// (lib/composer/composer.js PROTOCOLS_DIR default). M3 v0.2.0 will swap
// these for __dirname-relative resolution when the UI bin lands and we
// re-ship lite-template/ for the wizard preview path.
const CONTROL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(CONTROL_DIR);

// Stdout is the MCP protocol channel — any stray log corrupts the frame
// stream. Several tool executors and the composer emit progress via
// console.log; pin those to stderr for the stdio process only. The Next.js
// route is unaffected.
console.log = console.error;
console.info = console.error;

const { dispatchMcpRequest, ensureToolsRegistered } = await import('@/lib/mcp/server');
await ensureToolsRegistered();

// Kick off the embedder model fetch in background. The first RAG bot build
// is the iconic genesis flow, and the model load (~113MB on a cold cache)
// is the longest single step. Starting it now lets the download/load overlap
// with Claude's initial exchanges instead of blocking process_documents at
// T6. The lazy path in lib/embedder/local.js shares promise state, so a
// tool call arriving mid-load simply awaits whatever's left. Failures here
// surface at first use — don't crash the MCP server.
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
