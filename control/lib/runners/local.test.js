// Unit test for the LocalRunner HTTP client (the public runner surface the
// MCP tools call). Two concerns, neither of which needs a live daemon:
//
//   1. Env CRUD stays local (filesystem) — listEnv / setEnv / deleteEnv.
//   2. Daemon-down behavior — reads degrade (list → [], status → unknown),
//      writes throw a clear AppRuntimeUnavailableError.
//
// MOJULO_HOME points at a fresh temp dir with no port/bearer file, so the
// client deterministically sees "no daemon" regardless of what's running on
// the dev machine's real ~/.mojulo.

process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LocalRunner, AppRuntimeUnavailableError } from './local.js';

let homeRoot;
let artifactDir;

beforeEach(() => {
  homeRoot = mkdtempSync(join(tmpdir(), 'mojulo-home-'));
  process.env.MOJULO_HOME = homeRoot;
  artifactDir = mkdtempSync(join(tmpdir(), 'mojulo-artifact-'));
});

afterEach(() => {
  rmSync(homeRoot, { recursive: true, force: true });
  rmSync(artifactDir, { recursive: true, force: true });
  delete process.env.MOJULO_HOME;
});

describe('LocalRunner — env management (local filesystem, no daemon)', () => {
  it('listEnv returns sorted keys (excluding non-KV lines)', () => {
    writeFileSync(join(artifactDir, '.env'), '# top comment\nALPHA=1\nBETA=2\n\nGAMMA=3\n');
    expect(LocalRunner.listEnv(artifactDir).keys).toEqual(['ALPHA', 'BETA', 'GAMMA']);
  });

  it('setEnv updates existing keys in place and appends new keys', () => {
    writeFileSync(join(artifactDir, '.env'), '# comment\nFOO=bar\n');
    LocalRunner.setEnv(artifactDir, 'FOO', 'newbar');
    LocalRunner.setEnv(artifactDir, 'BAZ', 'qux');
    const text = readFileSync(join(artifactDir, '.env'), 'utf8');
    expect(text).toContain('# comment');
    expect(text).toContain('FOO=newbar');
    expect(text).toContain('BAZ=qux');
    expect(text.match(/^FOO=/gm) || []).toHaveLength(1);
  });

  it('deleteEnv removes the line and reports deleted: true', () => {
    writeFileSync(join(artifactDir, '.env'), 'FOO=bar\nBAZ=qux\n');
    const out = LocalRunner.deleteEnv(artifactDir, 'FOO');
    expect(out.deleted).toBe(true);
    const text = readFileSync(join(artifactDir, '.env'), 'utf8');
    expect(text).not.toContain('FOO=');
    expect(text).toContain('BAZ=qux');
  });

  it('deleteEnv on a missing key returns deleted: false (no-op)', () => {
    writeFileSync(join(artifactDir, '.env'), 'FOO=bar\n');
    expect(LocalRunner.deleteEnv(artifactDir, 'NOPE').deleted).toBe(false);
  });

  it('rejects invalid env keys', () => {
    writeFileSync(join(artifactDir, '.env'), '');
    expect(() => LocalRunner.setEnv(artifactDir, '1bad', 'x')).toThrow(/Invalid env key/);
    expect(() => LocalRunner.setEnv(artifactDir, 'has space', 'x')).toThrow(/Invalid env key/);
  });
});

describe('LocalRunner — daemon-down behavior', () => {
  it('list() degrades to [] when the daemon is unreachable', async () => {
    expect(await LocalRunner.list()).toEqual([]);
  });

  it('status() degrades to { status: unknown } when the daemon is unreachable', async () => {
    const s = await LocalRunner.status('run-whatever');
    expect(s.status).toBe('unknown');
    expect(s.runningRef).toBe('run-whatever');
  });

  it('start() throws AppRuntimeUnavailableError (after local input validation passes)', async () => {
    // artifactDir exists so the local existsSync check passes — the failure is
    // specifically the unreachable daemon, not bad input.
    await expect(
      LocalRunner.start({
        artifactRef: artifactDir,
        appName: 'x',
        materializationRef: 'r',
      }),
    ).rejects.toBeInstanceOf(AppRuntimeUnavailableError);
  });

  it('stop() throws AppRuntimeUnavailableError when the daemon is unreachable', async () => {
    await expect(LocalRunner.stop('run-whatever')).rejects.toBeInstanceOf(
      AppRuntimeUnavailableError,
    );
  });

  it('start() still fails fast on bad input before reaching the daemon', async () => {
    await expect(
      LocalRunner.start({ artifactRef: '/tmp/__nope__', appName: 'x', materializationRef: 'r' }),
    ).rejects.toThrow(/does not exist/);
  });

  it('_reset() is a no-op (swallows) when the daemon is unreachable', async () => {
    await expect(LocalRunner._reset()).resolves.toBeUndefined();
  });
});
