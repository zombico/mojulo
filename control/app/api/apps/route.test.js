process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { closeDb } from '@/lib/db/index';
import { commitAppMaterialization } from '@/lib/mcp/tools/meta-context';
import { installScaffold } from '@/lib/app-mcp-scaffold/install';
import { GET as listAppsGet } from './route';
import { GET as getAppGet } from './[ref]/route';

let tmpRoot;
let homeRoot;
let artifactDir;

function buildDir(root, name) {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name, scripts: { start: 'node ./x.js' } }, null, 2),
  );
  return dir;
}

beforeEach(() => {
  closeDb();
  // Isolate MOJULO_HOME so the loader's pidfile read sees an empty temp dir,
  // never the dev machine's real ~/.mojulo.
  homeRoot = mkdtempSync(join(tmpdir(), 'mojulo-home-'));
  process.env.MOJULO_HOME = homeRoot;
  tmpRoot = mkdtempSync(join(tmpdir(), 'mojulo-apps-api-'));
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
  rmSync(homeRoot, { recursive: true, force: true });
  delete process.env.MOJULO_HOME;
});

describe('GET /api/apps', () => {
  it('returns empty list', async () => {
    const res = await listAppsGet();
    const body = await res.json();
    expect(body.apps).toEqual([]);
  });

  it('returns the apps from the contextmap', async () => {
    artifactDir = buildDir(tmpRoot, 'a');
    installScaffold({
      targetDir: artifactDir,
      appName: 'a',
      materializationRef: `claude-code:${artifactDir}`,
    });
    await commitAppMaterialization({
      type: 'app_materialization',
      adapter_id: 'claude-code',
      app_name: 'a',
      artifact: { locator: artifactDir, label: 'A' },
      bindings: {
        runner: { implementation: 'local' },
        durability: { kind: 'local-fs' },
        inference: { mode: 'agent-routed' },
        mcp_self: { server_kind: 'app', entrypoint: 'app-mcp/server.js' },
      },
    });

    const res = await listAppsGet();
    const body = await res.json();
    expect(body.apps).toHaveLength(1);
    expect(body.apps[0].name).toBe('a');
  });
});

describe('GET /api/apps/[ref]', () => {
  it('404s on unknown ref', async () => {
    const res = await getAppGet(null, { params: Promise.resolve({ ref: encodeURIComponent('claude-code:/nope') }) });
    expect(res.status).toBe(404);
  });

  it('returns the projected app on a known ref', async () => {
    artifactDir = buildDir(tmpRoot, 'b');
    installScaffold({
      targetDir: artifactDir,
      appName: 'b',
      materializationRef: `claude-code:${artifactDir}`,
    });
    await commitAppMaterialization({
      type: 'app_materialization',
      adapter_id: 'claude-code',
      app_name: 'b',
      artifact: { locator: artifactDir, label: 'B' },
      bindings: {
        runner: { implementation: 'local' },
        durability: { kind: 'local-fs' },
        inference: { mode: 'agent-routed' },
        mcp_self: { server_kind: 'app', entrypoint: 'app-mcp/server.js' },
      },
    });
    const ref = `claude-code:${artifactDir}`;
    const res = await getAppGet(null, { params: Promise.resolve({ ref: encodeURIComponent(ref) }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('b');
    expect(body.bindings.runner.implementation).toBe('local');
    expect(Array.isArray(body.principles)).toBe(true);
    expect(body.principles.length).toBeGreaterThan(0);
  });
});
