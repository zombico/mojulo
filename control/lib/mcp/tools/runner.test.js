// Unit test for the runner MCP handlers — covers input validation +
// dispatch shape, and the daemon-down behavior of the LocalRunner HTTP client
// the handlers delegate to. The heavier integration smoke (real subprocess
// spawn through the MCP dispatcher against a live daemon) lives in
// runner.integration.test.js.
//
// MOJULO_HOME is isolated to a temp dir with no daemon port/bearer file, so
// these tests deterministically exercise the "no daemon" path regardless of
// what's running on the dev machine.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { closeDb } from '@/lib/db/index';
import {
  listRunnersHandler,
  startAppHandler,
  stopAppHandler,
  statusAppHandler,
  listRunningHandler,
  listEnvHandler,
  setEnvHandler,
  deleteEnvHandler,
} from './runner.js';

let homeRoot;

beforeEach(() => {
  closeDb();
  homeRoot = mkdtempSync(join(tmpdir(), 'mojulo-home-'));
  process.env.MOJULO_HOME = homeRoot;
});

afterEach(() => {
  rmSync(homeRoot, { recursive: true, force: true });
  delete process.env.MOJULO_HOME;
});

describe('list_runners', () => {
  it('returns the single `local` runner with its capability list', async () => {
    const out = await listRunnersHandler();
    expect(out.runners).toHaveLength(1);
    expect(out.runners[0].name).toBe('local');
    expect(Array.isArray(out.runners[0].capabilities)).toBe(true);
    expect(out.runners[0].capabilities).toContain('start_app');
  });
});

describe('list_running', () => {
  it('returns { running: [] } when the daemon is unreachable (degrades)', async () => {
    const out = await listRunningHandler();
    expect(out.running).toEqual([]);
  });
});

describe('start_app — validation', () => {
  it('rejects when no input is passed', async () => {
    await expect(startAppHandler(undefined)).rejects.toThrow(/start_app requires/);
  });

  it('rejects when artifact_ref is missing or non-string', async () => {
    await expect(startAppHandler({ app_name: 'x', materialization_ref: 'r' })).rejects.toThrow();
  });

  it('rejects when artifact_ref does not exist', async () => {
    await expect(
      startAppHandler({
        artifact_ref: '/tmp/__definitely-not-here__',
        app_name: 'x',
        materialization_ref: 'r',
      }),
    ).rejects.toThrow(/does not exist/);
  });
});

describe('stop_app — validation', () => {
  it('rejects when running_ref is missing', async () => {
    await expect(stopAppHandler({})).rejects.toThrow(/running_ref/);
  });

  it('throws a clear error when the daemon is unreachable', async () => {
    // stop is a write — it can't no-op when the daemon (which owns the
    // processes) is down. The unknown-ref no-op is covered against the live
    // engine in engine.integration.test.js.
    await expect(stopAppHandler({ running_ref: 'run-unknown' })).rejects.toThrow(/not reachable/);
  });
});

describe('status_app — validation', () => {
  it('rejects when running_ref is missing', async () => {
    await expect(statusAppHandler({})).rejects.toThrow(/running_ref/);
  });

  it('returns status: unknown for an unknown running_ref', async () => {
    const out = await statusAppHandler({ running_ref: 'run-unknown' });
    expect(out.status).toBe('unknown');
    expect(out.url).toBeNull();
    expect(out.mcp_url).toBeNull();
  });
});

describe('env handlers — validation', () => {
  it('list_env rejects when artifact_ref is missing', async () => {
    await expect(listEnvHandler({})).rejects.toThrow(/artifact_ref/);
  });

  it('set_env rejects when key/value missing or non-string', async () => {
    await expect(setEnvHandler({ artifact_ref: '/tmp' })).rejects.toThrow();
    await expect(setEnvHandler({ artifact_ref: '/tmp', key: 'FOO' })).rejects.toThrow(/value/);
    await expect(setEnvHandler({ artifact_ref: '/tmp', key: 'FOO', value: 1 })).rejects.toThrow(/value/);
  });

  it('delete_env rejects when key is missing', async () => {
    await expect(deleteEnvHandler({ artifact_ref: '/tmp' })).rejects.toThrow(/key/);
  });
});
