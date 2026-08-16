/**
 * Integration tests for the `npx mojulo init` config writers — the file-editing
 * hosts (Codex, Claude Desktop) driven through the real bin against a temp HOME.
 * This folds the manual temp-HOME smoke tests from the mcp-init plan into the
 * suite: fixture config in, one `node mcp-stdio.mjs init --host <h>` run, assert
 * on the bytes written (merge, backup, idempotency, repair, dry-run).
 *
 * The Claude Code writer shells out to the `claude` CLI and is deliberately not
 * driven here — its detect/repair classification (user-scope peek at
 * ~/.claude.json) is machine-dependent; it stays on the manual checklist.
 *
 * A fake `npx` is planted at $HOME/bin and prepended to PATH so npxCommand()'s
 * "first hit on PATH" resolution is deterministic in assertions.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
} from 'node:fs';
import { join, dirname, delimiter } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const STDIO = join(SCRIPTS_DIR, 'mcp-stdio.mjs');

let home;
let fakeNpx;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'mojulo-init-test-'));
  mkdirSync(join(home, 'bin'), { recursive: true });
  fakeNpx = join(home, 'bin', 'npx');
  writeFileSync(fakeNpx, '#!/bin/sh\nexit 0\n');
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

function runInit(...extraArgs) {
  const res = spawnSync(process.execPath, [STDIO, 'init', '--yes', '--no-ui', ...extraArgs], {
    encoding: 'utf8',
    timeout: 25000,
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      MOJULO_HOME: join(home, '.mojulo'),
      PATH: join(home, 'bin') + delimiter + (process.env.PATH || ''),
    },
  });
  expect(res.error).toBeUndefined();
  expect(res.status).toBe(0);
  return res;
}

// ── codex ─────────────────────────────────────────────────────────────────────

const codexCfg = () => join(home, '.codex', 'config.toml');

function seedCodex(text) {
  mkdirSync(dirname(codexCfg()), { recursive: true });
  writeFileSync(codexCfg(), text);
}

const codexBackups = () =>
  readdirSync(dirname(codexCfg())).filter((f) => f.startsWith('config.toml.mojulo-bak-'));

describe('init — codex writer', () => {
  it('appends mojulo, preserves existing servers, backs up once, re-run is idempotent', () => {
    seedCodex('# my config\n[mcp_servers.foo]\ncommand = "foo"\n');
    runInit('--host', 'codex');

    let text = readFileSync(codexCfg(), 'utf8');
    expect(text).toContain('[mcp_servers.foo]');
    expect(text).toContain('[mcp_servers.mojulo]');
    expect(text).toContain('args = ["-y", "mojulo"]');
    expect(codexBackups()).toHaveLength(1);

    const res = runInit('--host', 'codex');
    expect(res.stdout).toContain('already in config.toml');
    text = readFileSync(codexCfg(), 'utf8');
    expect(text.match(/\[mcp_servers\.mojulo\]/g)).toHaveLength(1);
    expect(codexBackups()).toHaveLength(1); // skip path takes no second backup
  });

  it.each([
    ['inline table', 'mcp_servers = { mojulo = { command = "npx", args = ["-y", "mojulo"] } }\n'],
    ['dotted key', 'mcp_servers.mojulo = { command = "npx", args = ["-y", "mojulo"] }\n'],
    ['section key', '[mcp_servers]\nmojulo = { command = "npx", args = ["-y", "mojulo"] }\n'],
  ])('detects hand-written %s form — no duplicate appended', (_label, toml) => {
    seedCodex(toml);
    const res = runInit('--host', 'codex');
    expect(res.stdout).toContain('already in config.toml');
    expect(readFileSync(codexCfg(), 'utf8')).toBe(toml);
    expect(codexBackups()).toHaveLength(0);
  });
});

// ── claude desktop ────────────────────────────────────────────────────────────

const desktopCfg = () =>
  process.platform === 'darwin'
    ? join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
    : join(home, '.config', 'Claude', 'claude_desktop_config.json');

function seedDesktop(json) {
  mkdirSync(dirname(desktopCfg()), { recursive: true });
  writeFileSync(
    desktopCfg(),
    typeof json === 'string' ? json : JSON.stringify(json, null, 2) + '\n'
  );
}

const readDesktop = () => JSON.parse(readFileSync(desktopCfg(), 'utf8'));
const desktopBackups = () =>
  readdirSync(dirname(desktopCfg())).filter((f) => f.includes('.mojulo-bak-'));

describe('init — desktop writer', () => {
  it('merges mojulo beside existing servers with an absolute npx', () => {
    seedDesktop({ mcpServers: { other: { command: 'other-cmd' } } });
    runInit('--host', 'desktop');

    const json = readDesktop();
    expect(json.mcpServers.other).toEqual({ command: 'other-cmd' });
    expect(json.mcpServers.mojulo).toEqual({ command: fakeNpx, args: ['-y', 'mojulo'] });
    expect(desktopBackups()).toHaveLength(1);
  });

  it('repairs the old bare-npx form to an absolute npx', () => {
    seedDesktop({ mcpServers: { mojulo: { command: 'npx', args: ['-y', 'mojulo'] } } });
    const res = runInit('--host', 'desktop');

    expect(res.stdout).toContain('updating to the current form');
    expect(readDesktop().mcpServers.mojulo).toEqual({ command: fakeNpx, args: ['-y', 'mojulo'] });
    expect(desktopBackups()).toHaveLength(1);
  });

  it('repairs an absolute npx path that no longer exists', () => {
    seedDesktop({
      mcpServers: { mojulo: { command: join(home, 'gone', 'npx'), args: ['-y', 'mojulo'] } },
    });
    const res = runInit('--host', 'desktop');

    expect(res.stdout).toContain('updating to the current form');
    expect(readDesktop().mcpServers.mojulo).toEqual({ command: fakeNpx, args: ['-y', 'mojulo'] });
  });

  it('leaves a working absolute-npx entry as-is', () => {
    seedDesktop({ mcpServers: { mojulo: { command: fakeNpx, args: ['-y', 'mojulo'] } } });
    const res = runInit('--host', 'desktop');

    expect(res.stdout).toContain('leaving it as-is');
    expect(desktopBackups()).toHaveLength(0);
  });

  it('never touches a customized entry', () => {
    const custom = {
      mcpServers: { mojulo: { command: 'npx', args: ['-y', 'mojulo'], env: { FOO: 'bar' } } },
    };
    seedDesktop(custom);
    const res = runInit('--host', 'desktop');

    expect(res.stdout).toContain('customized mojulo entry');
    expect(readDesktop()).toEqual(custom);
    expect(desktopBackups()).toHaveLength(0);
  });

  it('falls back to the manual snippet on invalid JSON without writing', () => {
    seedDesktop('{ not json');
    const res = runInit('--host', 'desktop');

    expect(res.stdout).toContain('not valid JSON');
    expect(readFileSync(desktopCfg(), 'utf8')).toBe('{ not json');
    expect(desktopBackups()).toHaveLength(0);
  });

  it('--print is a true dry run', () => {
    seedDesktop({ mcpServers: {} });
    const res = runInit('--host', 'desktop', '--print');

    expect(res.stdout).toContain('(--print) would write');
    expect(readDesktop()).toEqual({ mcpServers: {} });
    expect(desktopBackups()).toHaveLength(0);
  });
});
