// Boot guard. `npx mojulo` must answer MCP `initialize` inside the host's startup timeout
// (Claude Code: 30 s, no retry for a stdio server), and a published install carries none of
// the devDependencies. So the stdio server must boot, and list exactly the tools it lists
// today, with every declared package except the boot set made unresolvable. A static import
// of a heavy or dev-only package anywhere on the tool-registration path fails this test;
// load it through lib/lazy-deps.js instead (or add it to BOOT_DEPENDENCIES, deliberately).
import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CONTROL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = path.join(CONTROL_DIR, 'scripts', 'boot-guard-hook.cjs');
const pkg = JSON.parse(readFileSync(path.join(CONTROL_DIR, 'package.json'), 'utf8'));

// The only packages a stdio boot may load: the database and the trigger scheduler.
const BOOT_DEPENDENCIES = ['better-sqlite3', 'croner'];

// Named explicitly so the guard still covers them if package.json stops declaring one.
// three is the old creative marker; @swc/core is required in the loader's hooks thread.
const MUST_NOT_LOAD = [
  'puppeteer-core', '@puppeteer/browsers', 'archiver', 'officeparser', 'pdf2json',
  'react', 'react-dom', '@swc/core', 'three',
];

const BLOCKED = [...new Set([
  ...MUST_NOT_LOAD,
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.optionalDependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
])].filter((name) => !BOOT_DEPENDENCIES.includes(name));

// One stdio session: initialize as Claude Code, then tools/list. Resolves with the names.
function listTools(nodeArgs = [], extraEnv = {}) {
  const home = mkdtempSync(path.join(os.tmpdir(), 'mojulo-boot-guard-'));
  // A default install: drop the test runner's MOJULO_PACKS floor and any path overrides.
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) =>
    !k.startsWith('MOJULO_') && !['SQLITE_PATH', 'ARTIFACTS_DIR', 'STORAGE_ROOT'].includes(k)));
  Object.assign(env, { HOME: home, USERPROFILE: home, MOJULO_HOME: path.join(home, '.mojulo') }, extraEnv);

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [...nodeArgs, path.join(CONTROL_DIR, 'scripts', 'mcp-stdio.mjs')], {
      cwd: home,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let stderr = '';
    const result = {};
    const timer = setTimeout(() => child.kill('SIGKILL'), 25000);
    const send = (msg) => child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...msg })}\n`);
    child.stderr.on('data', (d) => { stderr += d; });
    child.stdout.on('data', (d) => {
      out += d;
      let i;
      while ((i = out.indexOf('\n')) >= 0) {
        const line = out.slice(0, i);
        out = out.slice(i + 1);
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        if (msg.id === 1) {
          result.initialize = msg;
          send({ method: 'notifications/initialized' });
          send({ id: 2, method: 'tools/list' });
        } else if (msg.id === 2) {
          result.tools = msg;
          child.stdin.end();
          child.kill('SIGTERM');
        }
      }
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      rmSync(home, { recursive: true, force: true });
      resolve({
        ...result,
        stderr,
        exit: code ?? signal,
        names: (result.tools?.result?.tools ?? []).map((t) => t.name).sort(),
      });
    });
    send({
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'claude-code', version: '0' } },
    });
  });
}

describe('stdio boot guard', () => {
  it('blocks every declared package outside the boot set, including the named heavy ones', () => {
    for (const name of MUST_NOT_LOAD) expect(BLOCKED).toContain(name);
    for (const name of BOOT_DEPENDENCIES) expect(BLOCKED).not.toContain(name);
  });

  it('answers initialize and lists the same tools with those packages unresolvable', async () => {
    const [normal, guarded] = await Promise.all([
      listTools(),
      listTools(['--require', HOOK], { MOJULO_BLOCK_MODULES: BLOCKED.join(',') }),
    ]);

    expect(normal.initialize?.result?.serverInfo?.name, normal.stderr).toBeTruthy();
    expect(normal.names.length, normal.stderr).toBeGreaterThan(0);

    const attempts = guarded.stderr.split('\n').filter((l) => l.startsWith('[boot-guard] blocked'));
    expect(attempts, 'packages the boot tried to load').toEqual([]);
    expect(guarded.initialize?.error, guarded.stderr).toBeUndefined();
    expect(guarded.initialize?.result?.serverInfo, guarded.stderr).toEqual(normal.initialize.result.serverInfo);
    expect(guarded.tools?.error, guarded.stderr).toBeUndefined();
    expect(guarded.names).toEqual(normal.names);
  });
});
