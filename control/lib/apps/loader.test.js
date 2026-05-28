process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { closeDb } from '@/lib/db/index';
import { InventoryRepository } from '@/lib/db/repositories/mcp-inventory';
import { MetaNodeRepository } from '@/lib/db/repositories/meta-context';
import { commitAppMaterialization } from '@/lib/mcp/tools/meta-context';
import { installScaffold } from '@/lib/app-mcp-scaffold/install';
import { writePidfile } from '@/lib/runners/daemon/pidfile';
import { listApps, getApp } from './loader';

let tmpRoot;
let homeRoot;
let artifactDir;

function buildAppDir(root, name) {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify(
      { name, version: '0.0.1', private: true, type: 'module', scripts: { start: 'node ./stub.js' } },
      null,
      2,
    ),
  );
  return dir;
}

beforeEach(() => {
  closeDb();
  // Isolate MOJULO_HOME so the loader reads pidfiles from a temp dir, never
  // the real ~/.mojulo (which may have live apps on the dev machine).
  homeRoot = mkdtempSync(join(tmpdir(), 'mojulo-home-'));
  process.env.MOJULO_HOME = homeRoot;
  tmpRoot = mkdtempSync(join(tmpdir(), 'mojulo-apps-loader-'));
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
  rmSync(homeRoot, { recursive: true, force: true });
  delete process.env.MOJULO_HOME;
});

describe('apps loader — listApps', () => {
  it('returns empty when no app materialization commits exist', () => {
    const out = listApps();
    expect(out.apps).toEqual([]);
  });

  it('lists one app per app_materialization commit, runtime null when not running', async () => {
    artifactDir = buildAppDir(tmpRoot, 'app-one');
    installScaffold({
      targetDir: artifactDir,
      appName: 'app-one',
      materializationRef: `claude-code:${artifactDir}`,
    });
    await commitAppMaterialization({
      type: 'app_materialization',
      adapter_id: 'claude-code',
      app_name: 'app-one',
      artifact: { locator: artifactDir, label: 'App One' },
      bindings: {
        runner: { implementation: 'local' },
        durability: { kind: 'local-fs' },
        inference: { mode: 'agent-routed' },
        mcp_self: { server_kind: 'app', entrypoint: 'app-mcp/server.js' },
      },
    });

    const { apps } = listApps();
    expect(apps).toHaveLength(1);
    expect(apps[0].name).toBe('app-one');
    expect(apps[0].ref).toBe(`claude-code:${artifactDir}`);
    expect(apps[0].adapterId).toBe('claude-code');
    expect(apps[0].locator).toBe(artifactDir);
    expect(apps[0].bindings.runner).toEqual({ implementation: 'local' });
    expect(apps[0].bindings.durability).toEqual({ kind: 'local-fs' });
    expect(apps[0].bindings.inference).toEqual({ mode: 'agent-routed' });
    expect(apps[0].bindings.mcp_self).toEqual({ server_kind: 'app', entrypoint: 'app-mcp/server.js' });
    expect(apps[0].runtime).toBeNull();
    expect(apps[0].inventory).toBeNull();
  });

  it('surfaces runtime + inventory when an app is running (synthetic runner state)', async () => {
    artifactDir = buildAppDir(tmpRoot, 'app-two');
    installScaffold({
      targetDir: artifactDir,
      appName: 'app-two',
      materializationRef: `claude-code:${artifactDir}`,
    });
    await commitAppMaterialization({
      type: 'app_materialization',
      adapter_id: 'claude-code',
      app_name: 'app-two',
      artifact: { locator: artifactDir, label: 'App Two' },
      bindings: {
        runner: { implementation: 'local' },
        durability: { kind: 'local-fs' },
        inference: { mode: 'agent-routed' },
        mcp_self: { server_kind: 'app', entrypoint: 'app-mcp/server.js' },
      },
    });

    // Synthetic runtime entry — bypass actually spawning processes. Runtime
    // state is read from pidfiles, so seed a pidfile + the matching inventory
    // row (the same pair the engine writes on a real start_app).
    const runningRef = 'run-deadbeef00000000';
    InventoryRepository.addAppInventory({
      server: 'app-two',
      tools: [
        { name: 'describe_app', description: 'describe' },
        { name: 'health', description: 'health' },
      ],
      runningRef,
    });
    writePidfile({
      runningRef,
      appPid: 999999,
      sidecarPid: 999998,
      url: 'http://127.0.0.1:5173',
      sidecarUrl: 'http://127.0.0.1:5174',
      bearer: 'should-not-leak-into-view-model',
      artifactRef: artifactDir,
      appName: 'app-two',
      serverName: 'app-two',
      materializationRef: `claude-code:${artifactDir}`,
      startedAt: 1700000000000,
    });
    try {
      const { apps } = listApps();
      expect(apps).toHaveLength(1);
      expect(apps[0].runtime).toMatchObject({
        runningRef,
        url: 'http://127.0.0.1:5173',
        mcpUrl: 'http://127.0.0.1:5174',
        status: 'running',
      });
      // The bearer must never cross into the projected view model.
      expect(JSON.stringify(apps[0])).not.toContain('should-not-leak');
      expect(apps[0].inventory).toBeTruthy();
      expect(apps[0].inventory.serverName).toBe('app-two');
      expect(apps[0].inventory.tools.map((t) => t.name).sort()).toEqual(['describe_app', 'health']);
    } finally {
      InventoryRepository.removeAppInventory(runningRef);
    }
  });

  it('returns every app node past the brief cap (no truncation at 500)', () => {
    // Seed nodes directly via the repository — bypass commitAppMaterialization
    // so the test runs in well under a second. The loader doesn't care how
    // the nodes got there; it cares that an uncapped read returns all of them.
    const N = 600;
    for (let i = 0; i < N; i += 1) {
      MetaNodeRepository.upsert({
        kind: 'artifact',
        ref: `claude-code:/tmp/bulk-${i}`,
        label: `bulk-${i}`,
        payload: {
          adapter_id: 'claude-code',
          locator: `/tmp/bulk-${i}`,
          app: { name: `bulk-${i}`, bindings: {} },
        },
      });
    }
    const { apps } = listApps();
    expect(apps.length).toBe(N);
  });
});

describe('apps loader — getApp', () => {
  it('returns null for an unknown ref', () => {
    expect(getApp('claude-code:/nope')).toBeNull();
  });

  it('returns the projected app with principles for a known ref', async () => {
    artifactDir = buildAppDir(tmpRoot, 'app-detail');
    installScaffold({
      targetDir: artifactDir,
      appName: 'app-detail',
      materializationRef: `claude-code:${artifactDir}`,
    });
    await commitAppMaterialization({
      type: 'app_materialization',
      adapter_id: 'claude-code',
      app_name: 'app-detail',
      artifact: { locator: artifactDir, label: 'App Detail' },
      bindings: {
        runner: { implementation: 'local' },
        durability: { kind: 'local-fs' },
        inference: { mode: 'agent-routed' },
        mcp_self: { server_kind: 'app', entrypoint: 'app-mcp/server.js' },
      },
      principles: [
        { scope: 'artifact', body_md: 'A user-supplied principle.' },
      ],
    });

    const detail = getApp(`claude-code:${artifactDir}`);
    expect(detail).toBeTruthy();
    expect(detail.name).toBe('app-detail');
    expect(detail.principles.length).toBeGreaterThanOrEqual(1);
    const sourceEvents = detail.principles.map((p) => p.sourceEvent);
    expect(sourceEvents).toContain('app_materialization');
  });
});
