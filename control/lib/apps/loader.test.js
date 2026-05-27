process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { closeDb } from '@/lib/db/index';
import { LocalRunner } from '@/lib/runners/local';
import { InventoryRepository } from '@/lib/db/repositories/mcp-inventory';
import { commitAppMaterialization } from '@/lib/mcp/tools/meta-context';
import { installScaffold } from '@/lib/app-mcp-scaffold/install';
import { listApps, getApp } from './loader';

let tmpRoot;
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
  LocalRunner._reset();
  tmpRoot = mkdtempSync(join(tmpdir(), 'mojulo-apps-loader-'));
});

afterEach(() => {
  LocalRunner._reset();
  rmSync(tmpRoot, { recursive: true, force: true });
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

    // Synthetic runtime entry — bypass actually spawning processes by
    // poking the in-memory map via LocalRunner.list's underlying state.
    // Use the same shape the runner sets in its `state` object.
    // We hook through the public surface by adding an inventory row and
    // a list() entry by spawning the real start IS heavy, so we shim
    // by directly inserting an inventory entry + monkey-patching list.
    const runningRef = 'run-deadbeef00000000';
    InventoryRepository.addAppInventory({
      server: 'app-two',
      tools: [
        { name: 'describe_app', description: 'describe' },
        { name: 'health', description: 'health' },
      ],
      runningRef,
    });
    const origList = LocalRunner.list;
    LocalRunner.list = () => [
      {
        runningRef,
        artifactRef: artifactDir,
        url: 'http://127.0.0.1:5173',
        mcpUrl: 'http://127.0.0.1:5174',
        startedAt: 1700000000000,
        status: 'running',
      },
    ];
    try {
      const { apps } = listApps();
      expect(apps).toHaveLength(1);
      expect(apps[0].runtime).toMatchObject({
        runningRef,
        url: 'http://127.0.0.1:5173',
        mcpUrl: 'http://127.0.0.1:5174',
        status: 'running',
      });
      expect(apps[0].inventory).toBeTruthy();
      expect(apps[0].inventory.serverName).toBe('app-two');
      expect(apps[0].inventory.tools.map((t) => t.name).sort()).toEqual(['describe_app', 'health']);
    } finally {
      LocalRunner.list = origList;
      InventoryRepository.removeAppInventory(runningRef);
    }
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
