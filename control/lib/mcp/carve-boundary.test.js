/**
 * The chatbot carve-out's strong boundary: a default install carries no bot code.
 *
 * 3.0 moves the chatbot factory out of mojulo into its own project. pack-boundary.test.js
 * fences the carve by reading static imports; that cannot see what a boot actually loads
 * (registerAllTools() reaches every tool module through dynamic import()), what getDb()
 * creates, or what a tool call sends over the network. These checks measure those three
 * directly, with no chatbot marker on the host:
 *
 *   1. booting the stdio server loads no module of the carve set (traced by a Node module
 *      hook in a child process, the same entry `npx mojulo` runs);
 *   2. getDb() on a fresh database creates none of the bot tables;
 *   3. `version` makes no network call at all, and `check_for_updates` makes none to GHCR.
 *
 * The suite is `describe.todo` while the carve is in progress: each of the three fails on a
 * tree that still carries the factory. The removal phase makes them true and flips the
 * `.todo` off; after that they are the "nothing came back" regression.
 *
 * The carve set below is the list pack-boundary.test.js ledgers (CARVE_ENGINE, the bot tool
 * modules, CARVE_DATA, CARVE_FILES), kept here on its own so this file survives those
 * ledgers being retired once they have nothing left to fence.
 */
import { describe, it, expect, vi } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CONTROL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// Repo-relative to control/. A trailing slash is a directory prefix; anything else is one file.
const CARVE_SET = [
  // the factory's engine directories
  'lib/deployers/',
  'lib/builder/',
  'lib/composer/',
  'lib/fleet/',
  'lib/form-schema-config/',
  'lib/preview/',
  // the bot tool modules
  'lib/mcp/tools/build.js',
  'lib/mcp/tools/jobs-tools.js',
  'lib/mcp/tools/operate.js',
  'lib/mcp/tools/fleet.js',
  'lib/mcp/tools/agent-ui.js',
  // the bot repositories
  'lib/db/repositories/deployments.js',
  'lib/db/repositories/builderSessions.js',
  'lib/db/repositories/deploymentEvents.js',
  'lib/db/repositories/mcpJobs.js',
  'lib/db/repositories/appSettings.js',
  // the other bot-only modules
  'lib/agent-chat/',
  'lib/agent-ui/',
  'lib/audit-logger-new.js',
  'lib/auth/gate.js',
  'lib/auth/service.js',
  'lib/config-builder.js',
  'lib/document-parser.js',
  'lib/embedder/chunker.js',
  'lib/embedder/preview-rag.js',
  'lib/form-structure-schema.js',
  'lib/mcp/jobs.js',
  'lib/mcp/session-binding.js',
  'lib/net/public-fetch.js',
  'lib/rate-limiter.js',
  'lib/resolve-api-key.js',
  'lib/version/bot-image.js',
  // the bot runtime, beside control/
  '../lite-template/',
];
// The two packages only bot documents use.
const BOT_PACKAGES = ['officeparser', 'pdf2json'];
const BOT_TABLES = ['deployments', 'modular_sessions', 'mcp_jobs'];

function inCarveSet(rel) {
  return CARVE_SET.some((entry) => (entry.endsWith('/') ? rel.startsWith(entry) : rel === entry));
}

// Environment for a child that behaves like a fresh `npx mojulo` on a host with no chatbot
// marker: every MOJULO_* and path variable dropped (the vitest setup file turns the chatbot
// pack on, and a developer's shell may point at real data), MOJULO_HOME in a temp directory.
function freshInstallEnv(home) {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('MOJULO_') || key.startsWith('VITEST')) continue;
    if (['SQLITE_PATH', 'ARTIFACTS_DIR', 'STORAGE_ROOT', 'NODE_ENV', 'NODE_OPTIONS'].includes(key)) continue;
    env[key] = value;
  }
  env.MOJULO_HOME = home;
  return env;
}

// Boot scripts/mcp-stdio.mjs in stdio-server mode under a load hook that records every file the
// process loads, answer initialize and tools/list, close stdin, and return the loaded paths.
async function traceStdioBoot() {
  const dir = mkdtempSync(join(tmpdir(), 'mojulo-carve-boot-'));
  try {
    const home = join(dir, 'home');
    mkdirSync(home);
    const tracePath = join(dir, 'loaded.txt');
    const hooksPath = join(dir, 'trace-hooks.mjs');
    const registerPath = join(dir, 'trace-register.mjs');
    writeFileSync(
      hooksPath,
      [
        "import { appendFileSync } from 'node:fs';",
        'let out;',
        'export function initialize(data) { out = data.out; }',
        'export async function load(url, context, nextLoad) {',
        "  if (url.startsWith('file:')) appendFileSync(out, url + '\\n');",
        '  return nextLoad(url, context);',
        '}',
        '',
      ].join('\n'),
    );
    writeFileSync(
      registerPath,
      [
        "import { register } from 'node:module';",
        `register(${JSON.stringify(pathToFileURL(hooksPath).href)}, { data: { out: ${JSON.stringify(tracePath)} } });`,
        '',
      ].join('\n'),
    );

    const child = spawn(
      process.execPath,
      ['--import', pathToFileURL(registerPath).href, join(CONTROL_ROOT, 'scripts/mcp-stdio.mjs')],
      { cwd: CONTROL_ROOT, env: freshInstallEnv(home), stdio: ['pipe', 'pipe', 'pipe'] },
    );
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    const exited = new Promise((resolveExit) => child.on('exit', (code) => resolveExit(code)));

    const toolsList = await new Promise((resolveList, rejectList) => {
      let buffered = '';
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        rejectList(new Error(`stdio boot gave no tools/list answer in time. stderr:\n${stderr.slice(-2000)}`));
      }, 80_000);
      child.stdout.on('data', (chunk) => {
        buffered += chunk;
        let nl;
        while ((nl = buffered.indexOf('\n')) >= 0) {
          const line = buffered.slice(0, nl);
          buffered = buffered.slice(nl + 1);
          let frame;
          try { frame = JSON.parse(line); } catch { continue; }
          if (frame.id === 2) {
            clearTimeout(timer);
            resolveList(frame);
          }
        }
      });
      child.on('exit', (code) => {
        clearTimeout(timer);
        rejectList(new Error(`stdio server exited (${code}) before answering. stderr:\n${stderr.slice(-2000)}`));
      });
      child.stdin.write(`${JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'carve-boundary', version: '0' } },
      })}\n`);
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })}\n`);
    });
    child.stdin.end();
    await exited;

    const loaded = existsSync(tracePath)
      ? readFileSync(tracePath, 'utf8').split('\n').filter(Boolean).map((url) => fileURLToPath(url))
      : [];
    return { loaded, toolsList };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe.todo('chatbot carve-out: a default install carries no bot code', () => {
  it('booting the stdio server loads no module of the carve set', async () => {
    const { loaded, toolsList } = await traceStdioBoot();
    // The trace is only evidence if it saw the boot: the registry and a kernel tool module.
    expect(toolsList.result?.tools?.length, 'tools/list answered').toBeGreaterThan(0);
    const rels = loaded.map((abs) => relative(CONTROL_ROOT, abs).split(sep).join('/'));
    expect(rels).toContain('lib/mcp/server.js');
    expect(rels).toContain('lib/mcp/tools/context.js');

    const carve = rels.filter(inCarveSet);
    const packages = loaded.filter((abs) => BOT_PACKAGES.some((pkg) => abs.includes(`${sep}node_modules${sep}${pkg}${sep}`)));
    expect(carve, `bot modules loaded by a default boot:\n${carve.join('\n')}`).toEqual([]);
    expect(packages, `bot-only packages loaded by a default boot:\n${packages.join('\n')}`).toEqual([]);
  }, 90_000);

  it('getDb() on a fresh database creates no bot tables', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mojulo-carve-db-'));
    const prev = { SQLITE_PATH: process.env.SQLITE_PATH, MOJULO_PACKS: process.env.MOJULO_PACKS };
    const { getDb, closeDb } = await import('@/lib/db');
    closeDb();
    process.env.SQLITE_PATH = join(dir, 'fresh.db');
    process.env.MOJULO_PACKS = 'creative'; // no chatbot
    try {
      const tables = getDb()
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map((row) => row.name);
      expect(tables, 'the kernel schema was created').toContain('sketches');
      expect(tables.filter((name) => BOT_TABLES.includes(name))).toEqual([]);
    } finally {
      closeDb();
      for (const [key, value] of Object.entries(prev)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('version makes no network call, and check_for_updates makes none to GHCR', async () => {
    const calls = [];
    vi.stubGlobal('fetch', async (url) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ version: '0.0.0' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const prevPacks = process.env.MOJULO_PACKS;
    process.env.MOJULO_PACKS = 'creative'; // no chatbot
    try {
      const server = await import('@/lib/mcp/server');
      await server.ensureToolsRegistered();
      const call = (name) => server.dispatchMcpRequest(
        { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: {} } },
        { mcpSessionId: 'carve-boundary', userId: 'local' },
      );

      const version = await call('version');
      expect(version.result?.isError).not.toBe(true);
      expect(calls, 'version called the network').toEqual([]);

      const updates = await call('check_for_updates');
      expect(updates.result?.isError).not.toBe(true);
      expect(calls.filter((url) => /(^|\/\/|\.)ghcr\.io(\/|:|$)/.test(url))).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
      if (prevPacks === undefined) delete process.env.MOJULO_PACKS;
      else process.env.MOJULO_PACKS = prevPacks;
    }
  });
});
