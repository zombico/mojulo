/**
 * `mojulo-config` through the real bin against a temp MOJULO_HOME. The providers it takes are the
 * LLM providers mint_solid's via:'prompt' door reads; 3.0 dropped `fly`, the Fly deploy token only
 * the chatbot factory's cloud deployer read. A row a 2.x install saved for it still lists, and
 * `unset` still removes it.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { LLM_PROVIDERS } from '../lib/llm-providers.js';

const CONFIG = join(dirname(fileURLToPath(import.meta.url)), 'mcp-config.mjs');

let home;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'mojulo-config-test-'));
});
afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

function run(...args) {
  const env = { ...process.env, HOME: home, USERPROFILE: home, MOJULO_HOME: join(home, '.mojulo') };
  for (const k of ['SQLITE_PATH', 'MOJULO_DATA_DIR', 'API_KEY_ENCRYPTION_KEY']) delete env[k];
  const res = spawnSync(process.execPath, [CONFIG, ...args], { encoding: 'utf8', timeout: 25000, env });
  expect(res.error).toBeUndefined();
  return res;
}

describe('mojulo-config providers', () => {
  it('offers the prompt door LLM providers and not fly', () => {
    const res = run('--help');
    expect(res.status).toBe(0);
    const line = res.stdout.split('\n').find((l) => l.startsWith('Providers:'));
    expect(line).toBe(`Providers: ${Object.keys(LLM_PROVIDERS).join(', ')}`);
    expect(line).not.toMatch(/fly/);
    // The messages name the bin a user runs (package.json "bin"), not the script file.
    expect(res.stdout).toContain('  mojulo-config set <provider> <value>');
  });

  it('refuses to save a Fly deploy token', () => {
    const res = run('set', 'fly', 'fo1_not_a_real_token');
    expect(res.status).toBe(2);
    expect(res.stderr).toContain('Unknown provider: fly');
    expect(run('list').stdout).toContain('No provider keys configured.');
  });

  it('a Fly row an earlier install saved still lists, and unset removes it', () => {
    expect(run('set', 'anthropic', 'sk-ant-test-value').status).toBe(0);
    // Stand in for the 2.x row: same encryption, provider 'fly'.
    const db = new Database(join(home, '.mojulo', 'data', 'mojulo-lite.db'));
    db.prepare("UPDATE api_keys SET provider = 'fly', name = 'fly-cli'").run();
    db.close();

    const list = run('list');
    expect(list.status).toBe(0);
    expect(list.stdout).toMatch(/^fly\s+fly-cli/m);
    expect(list.stdout).toContain('Nothing in this version reads fly');
    expect(list.stdout).toContain('Remove with: mojulo-config unset fly');

    const unset = run('unset', 'fly');
    expect(unset.status).toBe(0);
    expect(unset.stdout).toContain('Removed 1 key(s) for fly.');
    expect(run('list').stdout).toContain('No provider keys configured.');
  });

  it('unset of a provider nothing ever saved is still an unknown provider', () => {
    const res = run('unset', 'fly');
    expect(res.status).toBe(2);
    expect(res.stderr).toContain('Unknown provider: fly');
    expect(run('unset', 'openai').stdout).toContain('No keys for openai.');
  });
});
