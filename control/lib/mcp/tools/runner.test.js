// Unit test for the runner MCP handlers — covers input validation +
// dispatch shape. The heavier integration smoke (real subprocess spawn
// through the MCP dispatcher) lives in runner.integration.test.js.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
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
import { LocalRunner } from '@/lib/runners/local';

beforeEach(() => {
  closeDb();
  LocalRunner._reset();
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
  it('returns { running: [] } when nothing is started', async () => {
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

  it('returns stopped: false on unknown running_ref', async () => {
    const out = await stopAppHandler({ running_ref: 'run-unknown' });
    expect(out.stopped).toBe(false);
    expect(out.reason).toBe('unknown_running_ref');
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
