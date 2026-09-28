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
 * The factory left in 3.0.0, so these run live: they are the "nothing came back" regression.
 * A fourth, static check covers what a boot does not load: no carve path is back on disk, and
 * no retained server-side source (lib/, app/api/, scripts/, bin/, middleware.js) imports one.
 * The dashboard's pages, components and hooks are covered by the Next build, which fails on a
 * dangling import.
 *
 * The carve set below is the list pack-boundary.test.js ledgered while the fence stood
 * (CARVE_ENGINE, the bot tool modules, CARVE_DATA, CARVE_FILES), plus the bot API routes; it
 * lives here on its own because those ledgers retired with the fence.
 */
import { describe, it, expect, vi } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep, posix } from 'node:path';
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
  'lib/db/repositories/botSpaces.js',
  // the agent-facing markdown that routed to the factory or ran its loops
  'lib/mcp/routing-cards/bot.md',
  'lib/mcp/catalysts/appointment-to-calendar.md',
  'lib/mcp/catalysts/conversations-to-channel-digest.md',
  'lib/mcp/catalysts/document-extract-to-store.md',
  'lib/mcp/catalysts/knowledge-gap-miner.md',
  'lib/mcp/catalysts/qualify-lead-to-crm.md',
  'lib/mcp/catalysts/run-chat-builder-worker.md',
  'lib/mcp/catalysts/run-host-chat-worker.md',
  'lib/mcp/catalysts/scan-conversations-for-signal.md',
  'lib/mcp/catalysts/submission-to-ticket.md',
  'lib/mcp/catalysts/submissions-to-warehouse.md',
  'lib/mcp/catalysts/weekly-submissions-digest.md',
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
  // the pack-time staging of the bot runtime
  'scripts/stage-lite-template.mjs',
  // the dashboard's bot API routes
  'app/api/agent-ui/',
  'app/api/builder/',
  'app/api/data/',
  'app/api/deployments/',
  'app/api/documents/',
  'app/api/generate-form/',
  'app/api/preview/',
  'app/api/registry/bots/',
  'app/api/settings/app/',
  'app/api/vectorize-rag/',
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

// Every static import / export-from / require specifier in a source file, resolved to a
// control/-relative path ('@/x' and relative specifiers; bare packages are skipped). A dynamic
// import() of a template literal with no interpolation counts too.
const SPEC_RE = /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(?\s*['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)|import\s*\(\s*`([^`$]+)`\s*\)/g;
function importedPaths(code, fromRel) {
  const out = [];
  let m;
  SPEC_RE.lastIndex = 0;
  while ((m = SPEC_RE.exec(code))) {
    const spec = m[1] || m[2] || m[3] || m[4];
    if (spec.startsWith('@/')) out.push(spec.slice(2));
    else if (spec.startsWith('.')) out.push(posix.normalize(posix.join(posix.dirname(fromRel), spec)));
  }
  return out;
}
const withoutExt = (rel) => rel.replace(/\.(jsx?|mjs|cjs)$/, '').replace(/\/(index|route)$/, '');
function inCarveSetLoose(rel) {
  if (inCarveSet(rel)) return true;
  const bare = withoutExt(rel);
  return CARVE_SET.some((entry) => (entry.endsWith('/')
    ? `${bare}/`.startsWith(entry)
    : withoutExt(entry) === bare));
}
function sourceFiles(absDir, out = []) {
  if (!existsSync(absDir)) return out;
  for (const name of readdirSync(absDir)) {
    if (name === 'node_modules' || name === '.next' || name === 'data') continue;
    const abs = join(absDir, name);
    if (statSync(abs).isDirectory()) sourceFiles(abs, out);
    else if (/\.(jsx?|mjs|cjs)$/.test(name)) out.push(abs);
  }
  return out;
}

// What may sit under a carve directory without it counting as back. lite-template/integration/
// is the maintainer's gitignored plan and spike-output folder (root .gitignore, CLAUDE.md "Plans
// and changelog"); it outlived the runtime it sat beside, so a working tree may still have it.
const CARVE_RESIDUE = { '../lite-template/': ['integration'] };

function carvePathBack(entry) {
  const abs = join(CONTROL_ROOT, entry);
  if (!existsSync(abs)) return false;
  const residue = CARVE_RESIDUE[entry];
  if (!residue) return true;
  return readdirSync(abs).some((name) => !residue.includes(name) && name !== '.DS_Store');
}

describe('chatbot carve-out: a default install carries no bot code', () => {
  it('no carve path is back on disk, and no retained server-side source imports one', () => {
    const back = CARVE_SET.filter(carvePathBack);
    expect(back, `carve paths back in the tree:\n${back.join('\n')}`).toEqual([]);

    const roots = ['lib', 'app/api', 'scripts', 'bin'].map((d) => join(CONTROL_ROOT, d));
    const files = [...roots.flatMap((d) => sourceFiles(d)), join(CONTROL_ROOT, 'middleware.js')];
    const offenders = [];
    for (const abs of files) {
      const rel = relative(CONTROL_ROOT, abs).split(sep).join('/');
      if (rel === 'lib/mcp/carve-boundary.test.js') continue; // names the carve set on purpose
      const code = readFileSync(abs, 'utf8');
      for (const target of importedPaths(code, rel)) {
        if (inCarveSetLoose(target)) offenders.push(`${rel}  →  ${target}`);
      }
    }
    expect(offenders, `retained sources importing carve paths:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('the import scan sees a template-literal dynamic import', () => {
    const code = "const m = await import(`@/lib/builder/index.js`);\nconst n = await import(`./${x}.js`);";
    expect(importedPaths(code, 'lib/mcp/tools/x.js')).toEqual(['lib/builder/index.js']);
  });

  // The routing cards, catalysts (every shelf) and host adapters are what agents are served
  // (forward_context, get_catalyst, get_adapter, semantic_search). A body naming a removed tool
  // sends the agent to a name that answers with the moved notice.
  it('no shipped routing card, catalyst or adapter names a removed tool', async () => {
    const { REMOVED_BOT_TOOLS } = await import('@/lib/mcp/bot-factory-moved');
    const markdown = (dir, out = []) => {
      for (const name of readdirSync(dir)) {
        const abs = join(dir, name);
        if (statSync(abs).isDirectory()) markdown(abs, out);
        else if (name.endsWith('.md')) out.push(abs);
      }
      return out;
    };
    const files = ['lib/mcp/routing-cards', 'lib/mcp/catalysts', 'lib/mcp/adapters']
      .flatMap((d) => markdown(join(CONTROL_ROOT, d)));
    expect(files.length, 'the shelves were found').toBeGreaterThan(0);
    const hits = [];
    for (const abs of files) {
      const body = readFileSync(abs, 'utf8');
      for (const name of REMOVED_BOT_TOOLS) {
        if (new RegExp(`\\b${name}\\b`).test(body)) hits.push(`${relative(CONTROL_ROOT, abs)}: ${name}`);
      }
    }
    expect(hits, `shipped markdown naming removed tools:\n${hits.join('\n')}`).toEqual([]);
  });

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

// The runtime's own .gitignore left with it, but a checkout that ran a bot or staged the runtime
// for a 2.x pack still holds what that file ignored. Those must stay out of `git add -A`: bot
// provider keys, end-user conversation databases, a ~113 MB model.
const REPO_ROOT = resolve(CONTROL_ROOT, '..');
const inGitCheckout = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: REPO_ROOT, encoding: 'utf8' }).stdout?.trim() === 'true';
describe.skipIf(!inGitCheckout)('chatbot carve-out: a 2.x checkout\'s bot leftovers stay ignored', () => {
  it('the runtime folder, its staged copies and the plan folder are ignored', () => {
    const leftovers = [
      'lite-template/.env',
      'lite-template/data/conversation.db',
      'lite-template/models/multilingual-e5-small/onnx/model.onnx',
      'lite-template/package-lock.json',
      'lite-template/integration/some.plan.md',
      'control/lite-template/server.js',
      'control/ui-package/lite-template/.env',
    ];
    const res = spawnSync('git', ['check-ignore', '--no-index', ...leftovers], { cwd: REPO_ROOT, encoding: 'utf8' });
    expect(res.stdout.split('\n').filter(Boolean).sort()).toEqual([...leftovers].sort());
  });
});
