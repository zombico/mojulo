// End-to-end smoke for Sub-plan B's headline acceptance criterion:
//
//   "A direct MCP call to `start_app(artifact_ref)` against a hand-built
//    test directory containing a trivial `npm start` script PLUS the
//    scaffolded `app-mcp/` directory results in both processes running,
//    both URLs returned, and the sidecar reachable via its bearer.
//    After start_app, `meta_context_brief({kind:'fleet'}).inventory`
//    includes the app's MCP entry; after stop_app, the entry is gone."
//
// Goes through the MCP dispatcher (`dispatchMcpRequest`) so the test
// exercises tool registration + protocol shape, not just handler bodies.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { closeDb } from '@/lib/db/index';
import { LocalRunner } from '@/lib/runners/local';
import { dispatchMcpRequest, ensureToolsRegistered } from '@/lib/mcp/server';
import { briefHandler, commitAppMaterialization } from '@/lib/mcp/tools/meta-context';

let tmpRoot;
let artifactDir;

function buildStubApp(rootDir) {
  const dir = join(rootDir, 'app-1');
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
  const a = s.address();
  console.log('APP_URL=http://' + a.address + ':' + a.port);
});
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => { s.close(() => process.exit(0)); });
}
`,
  );
  return dir;
}

async function rpc(method, params, id = 1) {
  return dispatchMcpRequest(
    { jsonrpc: '2.0', id, method, params },
    { mcpSessionId: 'test-session', userId: 'local' },
  );
}

async function callTool(name, args, id = 1) {
  const reply = await rpc('tools/call', { name, arguments: args }, id);
  if (reply.error) throw new Error(`JSON-RPC error: ${reply.error.message}`);
  if (reply.result?.isError) {
    throw new Error(`tool error: ${reply.result.content?.[0]?.text || 'unknown'}`);
  }
  const text = reply.result.content[0].text;
  return JSON.parse(text);
}

beforeEach(async () => {
  closeDb();
  LocalRunner._reset();
  tmpRoot = mkdtempSync(join(tmpdir(), 'mojulo-runner-mcp-smoke-'));
  artifactDir = buildStubApp(tmpRoot);
  await ensureToolsRegistered();
});

afterEach(async () => {
  // Stop anything still running so we don't leak processes between tests.
  for (const r of LocalRunner.list()) {
    await LocalRunner.stop(r.runningRef);
  }
  LocalRunner._reset();
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe('runner MCP — registered with the dispatcher', () => {
  it('tools/list includes the runner surface', async () => {
    const reply = await rpc('tools/list', {});
    const names = reply.result.tools.map((t) => t.name);
    expect(names).toContain('install_scaffold');
    expect(names).toContain('list_runners');
    expect(names).toContain('start_app');
    expect(names).toContain('stop_app');
    expect(names).toContain('status_app');
    expect(names).toContain('list_running');
    expect(names).toContain('list_env');
    expect(names).toContain('set_env');
    expect(names).toContain('delete_env');
  });

  it('list_runners returns the local runner', async () => {
    const out = await callTool('list_runners', {});
    expect(out.runners[0].name).toBe('local');
  });
});

describe('runner MCP — start_app → inventory → describe_app → stop_app', () => {
  it('full lifecycle hits the acceptance criterion', async () => {
    // 1. start_app — both processes come up, both URLs returned.
    const started = await callTool('start_app', {
      artifact_ref: artifactDir,
      app_name: 'stub-app',
      materialization_ref: 'claude-code:' + artifactDir,
      declared_purpose: 'Acceptance smoke',
    });
    expect(started.running_ref).toMatch(/^run-[a-f0-9]{16}$/);
    expect(started.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(started.mcp_url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(started.inventory_tools_registered).toBe(2);

    // 2. brief({kind:'fleet'}).inventory includes the app entry.
    const brief = await briefHandler({ scope: { kind: 'fleet' } });
    const stub = brief.inventory.servers.find((s) => s.name === 'stub-app');
    expect(stub).toBeTruthy();
    expect(stub.serverKind).toBe('app');
    expect(stub.runningRef).toBe(started.running_ref);
    expect(stub.tools.map((t) => t.name).sort()).toEqual(['describe_app', 'health']);

    // 3. sidecar is reachable via the bearer — query describe_app directly
    //    over HTTP using the bearer in the .env file (the runner never
    //    surfaces it in tool responses, by design).
    const fs = await import('node:fs');
    const env = fs.readFileSync(join(artifactDir, '.env'), 'utf8');
    const bearer = env.match(/^APP_MCP_BEARER=(\S+)$/m)[1];
    const res = await fetch(started.mcp_url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'describe_app', arguments: {} },
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const payload = JSON.parse(body.result.content[0].text);
    expect(payload.name).toBe('stub-app');
    expect(payload.materialization_ref).toBe('claude-code:' + artifactDir);
    expect(payload.declared_purpose).toBe('Acceptance smoke');

    // 4. status_app reports running.
    const status = await callTool('status_app', { running_ref: started.running_ref });
    expect(status.status).toBe('running');
    expect(status.url).toBe(started.url);
    expect(status.mcp_url).toBe(started.mcp_url);

    // 5. list_running has the entry.
    const listed = await callTool('list_running', {});
    expect(listed.running).toHaveLength(1);
    expect(listed.running[0].running_ref).toBe(started.running_ref);

    // 6. stop_app — both processes terminate, inventory entry removed.
    const stopped = await callTool('stop_app', { running_ref: started.running_ref });
    expect(stopped.stopped).toBe(true);

    const briefAfter = await briefHandler({ scope: { kind: 'fleet' } });
    expect(briefAfter.inventory.servers.find((s) => s.name === 'stub-app')).toBeUndefined();
    const listedAfter = await callTool('list_running', {});
    expect(listedAfter.running).toHaveLength(0);
    const statusAfter = await callTool('status_app', { running_ref: started.running_ref });
    expect(statusAfter.status).toBe('unknown');
  });

  it('survives the full scaffold → materialize → start → stop flow', async () => {
    // Step 1: install_scaffold — required before the materialization commit
    // because verification checks for app-mcp/server.js existence.
    const installed = await callTool('install_scaffold', {
      artifact_ref: artifactDir,
      app_name: 'stub-app',
      materialization_ref: 'claude-code:' + artifactDir,
      declared_purpose: 'Acceptance smoke (commit-flow)',
    });
    expect(installed.reused).toBe(false);
    expect(installed.bearer_generated).toBe(true);

    // Step 2: materialize via meta_context_commit so the contextmap has the
    // app_materialization record alongside the running entry.
    const m1 = await commitAppMaterialization({
      type: 'app_materialization',
      adapter_id: 'claude-code',
      app_name: 'stub-app',
      artifact: { locator: artifactDir, label: 'Stub app' },
      bindings: {
        runner: { implementation: 'local' },
        durability: { kind: 'local-fs' },
        inference: { mode: 'agent-routed' },
        mcp_self: { server_kind: 'app', entrypoint: 'app-mcp/server.js' },
      },
    });
    expect(m1.ok).toBe(true);

    // Then: start → confirm fleet brief shows BOTH the materialization
    // node + the inventory entry → stop → confirm inventory entry is gone
    // but the materialization stays (contextmap is append-only).
    const started = await callTool('start_app', {
      artifact_ref: artifactDir,
      app_name: 'stub-app',
      materialization_ref: 'claude-code:' + artifactDir,
    });
    try {
      const brief = await briefHandler({ scope: { kind: 'fleet' } });
      // Contextmap side: the artifact node from the materialization.
      const artifactNodes = brief.nodes.filter((n) => n.kind === 'artifact');
      expect(artifactNodes.length).toBeGreaterThan(0);
      expect(artifactNodes[0].payload.app.name).toBe('stub-app');
      // Inventory side: the running app's MCP entry.
      expect(brief.inventory.servers.find((s) => s.name === 'stub-app')).toBeTruthy();
    } finally {
      await callTool('stop_app', { running_ref: started.running_ref });
    }

    // Inventory cleared, materialization survives.
    const briefAfter = await briefHandler({ scope: { kind: 'fleet' } });
    expect(briefAfter.inventory.servers.find((s) => s.name === 'stub-app')).toBeUndefined();
    expect(briefAfter.nodes.some((n) => n.kind === 'artifact')).toBe(true);
  });
});

describe('runner MCP — env management through dispatcher', () => {
  it('list_env / set_env / delete_env round-trip', async () => {
    // Pre-populate via filesystem so list_env has something to read.
    writeFileSync(join(artifactDir, '.env'), 'EXISTING=value\n');
    let env = await callTool('list_env', { artifact_ref: artifactDir });
    expect(env.keys).toContain('EXISTING');

    await callTool('set_env', { artifact_ref: artifactDir, key: 'NEW', value: 'v' });
    env = await callTool('list_env', { artifact_ref: artifactDir });
    expect(env.keys).toContain('NEW');

    const deleted = await callTool('delete_env', { artifact_ref: artifactDir, key: 'EXISTING' });
    expect(deleted.deleted).toBe(true);
    env = await callTool('list_env', { artifact_ref: artifactDir });
    expect(env.keys).not.toContain('EXISTING');
  });

  it('list_env never returns the values themselves (control-plane invariant)', async () => {
    writeFileSync(join(artifactDir, '.env'), 'SECRET=should-not-leak\n');
    const env = await callTool('list_env', { artifact_ref: artifactDir });
    expect(env.keys).toContain('SECRET');
    // Verify the response has no `values` or `entries` field surfacing the value.
    expect(JSON.stringify(env)).not.toContain('should-not-leak');
  });
});
