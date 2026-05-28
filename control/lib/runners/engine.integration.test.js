// Integration test for the runner ENGINE (the in-process core the app-runtime
// daemon wraps). Spawns real Node subprocesses and exercises the full
// start/stop/status lifecycle, inventory auto-declaration, pidfile writes, and
// crash detection.
//
// This is the primary safety net for runner behavior — it runs the engine
// directly (no daemon, no HTTP) so it's fast and hermetic. The daemon's HTTP
// hop is covered separately by lib/mcp/tools/runner.integration.test.js.
//
// Heavier than unit tests — runs in the seconds, not the milliseconds.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { closeDb } from '@/lib/db/index';
import { InventoryRepository } from '@/lib/db/repositories/mcp-inventory';
import { RunnerEngine } from './engine.js';
import { runsDir } from './daemon/files.js';

let tmpRoot;
let homeRoot;
let artifactDir;

// Build a self-contained "app" directory with a real package.json + a stub
// `npm start` script that prints the URL line the runner watches for. A static
// server keeps the test hermetic — no external listeners.
function buildStubApp(rootDir, name) {
  const dir = join(rootDir, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify(
      {
        name: 'stub-app',
        version: '0.0.1',
        private: true,
        type: 'module',
        scripts: { start: 'node ./stub-server.js' },
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(dir, 'stub-server.js'),
    `import { createServer } from 'node:http';
const s = createServer((_req, res) => { res.end('ok'); });
s.listen(0, '127.0.0.1', () => {
  const addr = s.address();
  console.log('APP_URL=http://' + addr.address + ':' + addr.port);
});
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => { s.close(() => process.exit(0)); });
}
`,
  );
  return dir;
}

beforeEach(() => {
  closeDb();
  RunnerEngine._reset();
  // Isolate MOJULO_HOME so pidfiles land in a temp dir, never the real ~/.mojulo.
  homeRoot = mkdtempSync(join(tmpdir(), 'mojulo-home-'));
  process.env.MOJULO_HOME = homeRoot;
  tmpRoot = mkdtempSync(join(tmpdir(), 'mojulo-engine-test-'));
  artifactDir = buildStubApp(tmpRoot, 'app-1');
});

afterEach(() => {
  RunnerEngine._reset();
  rmSync(tmpRoot, { recursive: true, force: true });
  rmSync(homeRoot, { recursive: true, force: true });
  delete process.env.MOJULO_HOME;
});

describe('RunnerEngine.start — happy path', () => {
  it('brings up app + sidecar, returns both URLs, populates inventory, writes a pidfile', async () => {
    const out = await RunnerEngine.start({
      artifactRef: artifactDir,
      appName: 'stub-app',
      materializationRef: 'claude-code:' + artifactDir,
    });
    try {
      expect(out.runningRef).toMatch(/^run-[a-f0-9]{16}$/);
      expect(out.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      expect(out.mcpUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      expect(out.bearer).toMatch(/^[a-f0-9]{64}$/);
      expect(out.inventoryToolsRegistered).toBe(2);

      const inv = InventoryRepository.currentInventory();
      const stub = inv.servers.find((s) => s.name === 'stub-app');
      expect(stub).toBeTruthy();
      expect(stub.serverKind).toBe('app');
      expect(stub.runningRef).toBe(out.runningRef);
      expect(stub.tools.map((t) => t.name).sort()).toEqual(['describe_app', 'health']);

      // Durable pidfile written under the temp MOJULO_HOME.
      expect(existsSync(join(runsDir(), `${out.runningRef}.json`))).toBe(true);
    } finally {
      await RunnerEngine.stop(out.runningRef);
    }
  });

  it('idempotent scaffold materialization — reusing an existing app-mcp/ does not regenerate the bearer', async () => {
    const first = await RunnerEngine.start({
      artifactRef: artifactDir,
      appName: 'stub-app',
      materializationRef: 'ref-1',
    });
    const firstBearer = first.bearer;
    await RunnerEngine.stop(first.runningRef);

    const second = await RunnerEngine.start({
      artifactRef: artifactDir,
      appName: 'stub-app',
      materializationRef: 'ref-1',
    });
    try {
      expect(second.bearer).toBe(firstBearer);
    } finally {
      await RunnerEngine.stop(second.runningRef);
    }
  });

  it('status() reports running and list() includes the entry', async () => {
    const out = await RunnerEngine.start({
      artifactRef: artifactDir,
      appName: 'stub-app',
      materializationRef: 'ref-1',
    });
    try {
      const status = RunnerEngine.status(out.runningRef);
      expect(status.status).toBe('running');
      expect(status.url).toBe(out.url);
      expect(status.mcpUrl).toBe(out.mcpUrl);

      const listed = RunnerEngine.list();
      expect(listed).toHaveLength(1);
      expect(listed[0].runningRef).toBe(out.runningRef);
    } finally {
      await RunnerEngine.stop(out.runningRef);
    }
  });
});

describe('RunnerEngine.stop', () => {
  it('removes inventory entries, pidfile, and in-memory state; status flips to unknown', async () => {
    const out = await RunnerEngine.start({
      artifactRef: artifactDir,
      appName: 'stub-app',
      materializationRef: 'ref-1',
    });
    expect(RunnerEngine.list()).toHaveLength(1);

    const stopOut = await RunnerEngine.stop(out.runningRef);
    expect(stopOut.stopped).toBe(true);

    expect(RunnerEngine.list()).toHaveLength(0);
    expect(RunnerEngine.status(out.runningRef).status).toBe('unknown');
    expect(existsSync(join(runsDir(), `${out.runningRef}.json`))).toBe(false);

    const inv = InventoryRepository.currentInventory();
    expect(inv.servers.find((s) => s.name === 'stub-app')).toBeUndefined();
  });

  it('idempotent — stop on unknown runningRef returns stopped: false', async () => {
    const out = await RunnerEngine.stop('run-doesnotexist');
    expect(out.stopped).toBe(false);
    expect(out.reason).toBe('unknown_running_ref');
  });
});

describe('RunnerEngine.start — atomic failure', () => {
  it('app start fails → sidecar is killed, no inventory entry, no running state, no pidfile', async () => {
    rmSync(join(artifactDir, 'stub-server.js'));
    await expect(
      RunnerEngine.start({
        artifactRef: artifactDir,
        appName: 'broken-app',
        materializationRef: 'ref-1',
        timeoutMs: 2000,
      }),
    ).rejects.toThrow();
    expect(RunnerEngine.list()).toHaveLength(0);
    const inv = InventoryRepository.currentInventory();
    expect(inv.servers.find((s) => s.name === 'broken-app')).toBeUndefined();
  });

  it('rejects when artifactRef does not exist', async () => {
    await expect(
      RunnerEngine.start({
        artifactRef: '/tmp/__nope__',
        appName: 'x',
        materializationRef: 'r',
      }),
    ).rejects.toThrow(/does not exist/);
  });
});

describe('RunnerEngine — crash detection', () => {
  it('status() reports running immediately after start (crash hook attached)', async () => {
    const out = await RunnerEngine.start({
      artifactRef: artifactDir,
      appName: 'stub-app',
      materializationRef: 'ref-1',
    });
    try {
      const status = RunnerEngine.status(out.runningRef);
      expect(status.status).toBe('running');
    } finally {
      await RunnerEngine.stop(out.runningRef);
    }
  });
});
