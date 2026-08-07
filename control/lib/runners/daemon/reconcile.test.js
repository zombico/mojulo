// Reconcile-on-boot tests — the heart of the daemon promotion. Seeds orphan
// inventory rows + pidfiles into a temp MOJULO_HOME against an in-memory DB and
// asserts the sweep/adopt decisions:
//
//   - inventory row with NO pidfile          → sweep (the classic orphan bug)
//   - pidfile with dead pids                 → sweep
//   - pidfile with live pids + live sidecar  → adopt (pid-tracked)
//
// No real apps are spawned: liveness is faked with the test process's own pid
// (always alive) + an in-process HTTP server standing in for the sidecar.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import http from 'node:http';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { closeDb } from '@/lib/db/index';
import { InventoryRepository } from '@/lib/db/repositories/mcp-inventory';
import { RunnerEngine } from '@/lib/runners/engine';
import { reconcile } from './reconcile.js';
import { writePidfile, readPidfile } from './pidfile.js';

let homeRoot;

function refs() {
  return InventoryRepository.listAppRunningRefs().map((r) => r.runningRef);
}

beforeEach(() => {
  closeDb();
  RunnerEngine._reset();
  homeRoot = mkdtempSync(join(tmpdir(), 'mojulo-home-'));
  process.env.MOJULO_HOME = homeRoot;
});

afterEach(() => {
  RunnerEngine._reset();
  rmSync(homeRoot, { recursive: true, force: true });
  delete process.env.MOJULO_HOME;
});

describe('reconcile — orphan inventory (no pidfile)', () => {
  it('sweeps inventory rows whose running_ref has no pidfile', async () => {
    InventoryRepository.addAppInventory({
      server: 'ghost',
      tools: [{ name: 'describe_app' }, { name: 'health' }],
      runningRef: 'run-orphan',
    });
    expect(refs()).toContain('run-orphan');

    const res = await reconcile();
    expect(res.swept).toContain('run-orphan');
    expect(refs()).toHaveLength(0);
  });
});

describe('reconcile — dead pidfile', () => {
  it('sweeps the inventory rows + pidfile when pids are dead', async () => {
    InventoryRepository.addAppInventory({
      server: 'dead',
      tools: [{ name: 'describe_app' }],
      runningRef: 'run-dead',
    });
    writePidfile({
      runningRef: 'run-dead',
      appPid: 2_147_480_000, // implausible — kill(pid, 0) → ESRCH
      sidecarPid: 2_147_480_001,
      url: 'http://127.0.0.1:9/',
      sidecarUrl: 'http://127.0.0.1:1/',
      bearer: 'x',
      artifactRef: '/tmp/whatever',
      appName: 'dead',
      serverName: 'dead',
      materializationRef: 'r',
      startedAt: Date.now(),
    });

    const res = await reconcile();
    expect(res.swept).toContain('run-dead');
    expect(readPidfile('run-dead')).toBeNull();
    expect(refs()).toHaveLength(0);
    expect(RunnerEngine.list()).toHaveLength(0);
  });
});

describe('reconcile — live app', () => {
  it('adopts a run whose pids are alive and whose sidecar answers tools/list', async () => {
    const bearer = 'secret-bearer';
    const srv = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({ jsonrpc: '2.0', id: 1, result: { tools: [{ name: 'describe_app' }] } }),
        );
      });
    });
    await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
    const { port } = srv.address();
    const sidecarUrl = `http://127.0.0.1:${port}/`;

    try {
      InventoryRepository.addAppInventory({
        server: 'live',
        tools: [{ name: 'describe_app' }],
        runningRef: 'run-live',
      });
      writePidfile({
        runningRef: 'run-live',
        appPid: process.pid, // alive (this test process)
        sidecarPid: process.pid,
        url: 'http://127.0.0.1:9/',
        sidecarUrl,
        bearer,
        artifactRef: '/tmp/live-app',
        appName: 'live',
        serverName: 'live',
        materializationRef: 'r',
        startedAt: Date.now(),
      });

      const res = await reconcile();
      expect(res.adopted).toContain('run-live');
      expect(res.swept).not.toContain('run-live');

      const adopted = RunnerEngine.list().find((r) => r.runningRef === 'run-live');
      expect(adopted).toBeTruthy();
      expect(adopted.adopted).toBe(true);
      expect(adopted.status).toBe('running');

      // Inventory survives — adopt does not sweep.
      expect(refs()).toContain('run-live');
    } finally {
      await new Promise((resolve) => srv.close(resolve));
    }
  });
});
