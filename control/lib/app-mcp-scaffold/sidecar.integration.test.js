// Integration smoke test: install scaffold into a temp dir, boot the
// sidecar as a real child process, round-trip MCP JSON-RPC calls against
// it, send SIGTERM, confirm clean shutdown.
//
// Covers the parent plan's acceptance criterion:
//   "The scaffold copy helper materializes the files into a target
//    directory; `node app-mcp/server.js` boots and responds to a
//    describe_app call with the seeded name + materialization ref."
//
// Heavier than the unit tests in install.test.js — spawns Node and makes
// real HTTP calls. Run with `npx vitest run lib/app-mcp-scaffold/sidecar.integration.test.js`.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import { installScaffold } from './install.js';

let tmpRoot;
let proc;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'mojulo-app-mcp-smoke-'));
});

afterEach(async () => {
  if (proc && !proc.killed) {
    proc.kill('SIGTERM');
    // Give it a beat to flush, then nuke if still alive.
    await wait(150);
    if (!proc.killed) proc.kill('SIGKILL');
  }
  proc = null;
  rmSync(tmpRoot, { recursive: true, force: true });
});

async function spawnSidecar({ bearer, port = 0 }) {
  const scaffoldDir = join(tmpRoot, 'app-mcp');
  proc = spawn('node', ['server.js'], {
    cwd: scaffoldDir,
    env: {
      ...process.env,
      APP_MCP_BEARER: bearer,
      APP_MCP_PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // Wait for the resolved URL line.
  const url = await new Promise((resolve, reject) => {
    const onClose = () => reject(new Error('sidecar exited before printing APP_MCP_URL'));
    proc.on('exit', onClose);
    proc.stdout.setEncoding('utf8');
    let buf = '';
    proc.stdout.on('data', (chunk) => {
      buf += chunk;
      const m = buf.match(/^APP_MCP_URL=(\S+)$/m);
      if (m) {
        proc.off('exit', onClose);
        resolve(m[1]);
      }
    });
    proc.stderr.setEncoding('utf8');
    // Drain stderr so it doesn't backpressure.
    proc.stderr.on('data', () => {});
    setTimeout(() => {
      proc.off('exit', onClose);
      reject(new Error('timed out waiting for APP_MCP_URL'));
    }, 5000);
  });
  return url;
}

async function rpc(url, bearer, method, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

describe('app-mcp sidecar smoke', () => {
  it('boots, accepts authorized JSON-RPC, returns describe_app with seeded identity', async () => {
    const out = installScaffold({
      targetDir: tmpRoot,
      appName: 'image-extractor',
      materializationRef: 'claude-code:/tmp/app-smoke',
      declaredPurpose: 'Extract structured info from uploaded images',
    });

    const url = await spawnSidecar({ bearer: out.bearer });

    // tools/list returns describe_app + health.
    const listed = await rpc(url, out.bearer, 'tools/list', {});
    expect(listed.status).toBe(200);
    const toolNames = listed.body.result.tools.map((t) => t.name);
    expect(toolNames).toContain('describe_app');
    expect(toolNames).toContain('health');

    // tools/call describe_app reflects the seeded placeholders.
    const described = await rpc(url, out.bearer, 'tools/call', {
      name: 'describe_app',
      arguments: {},
    });
    expect(described.status).toBe(200);
    expect(described.body.result.isError).toBeUndefined();
    const text = described.body.result.content[0].text;
    const payload = JSON.parse(text);
    expect(payload.name).toBe('image-extractor');
    expect(payload.materialization_ref).toBe('claude-code:/tmp/app-smoke');
    expect(payload.declared_purpose).toBe('Extract structured info from uploaded images');
    expect(payload.registered_tools.map((t) => t.name).sort()).toEqual([
      'describe_app',
      'health',
    ]);

    // health returns ok.
    const healthed = await rpc(url, out.bearer, 'tools/call', {
      name: 'health',
      arguments: {},
    });
    expect(healthed.body.result.isError).toBeUndefined();
    const hPayload = JSON.parse(healthed.body.result.content[0].text);
    expect(hPayload.ok).toBe(true);
    expect(typeof hPayload.uptime_seconds).toBe('number');
  });

  it('rejects unauthorized requests with 401', async () => {
    const out = installScaffold({
      targetDir: tmpRoot,
      appName: 'x',
      materializationRef: 'r',
    });
    const url = await spawnSidecar({ bearer: out.bearer });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(res.status).toBe(401);
  });

  it('rejects requests with a wrong bearer', async () => {
    const out = installScaffold({
      targetDir: tmpRoot,
      appName: 'x',
      materializationRef: 'r',
    });
    const url = await spawnSidecar({ bearer: out.bearer });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer wrong' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(res.status).toBe(401);
  });

  it('exits cleanly on SIGTERM', async () => {
    const out = installScaffold({
      targetDir: tmpRoot,
      appName: 'x',
      materializationRef: 'r',
    });
    await spawnSidecar({ bearer: out.bearer });

    const exited = new Promise((resolve) => proc.once('exit', (code) => resolve(code)));
    proc.kill('SIGTERM');
    const code = await Promise.race([exited, wait(2000).then(() => 'timeout')]);
    expect(code).toBe(0);
  });
});
